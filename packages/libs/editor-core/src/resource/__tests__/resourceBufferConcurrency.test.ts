import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeFileSystem } from '../../__tests__/fixtures';
import { ResourceSystem } from '../resourceSystem';
import { ResourceContent } from '../types';
import { WriteBuffer } from '../writeBuffer';

// 写缓冲的并发与失败语义：在途写盘复用、写盘期间再写不丢、失败保留待写、释放清定时器。

const PATH = 'tables/demo.json';

let system: ResourceSystem | null = null;

interface IWriteGate {
  /** 写盘 Promise */
  readonly promise: Promise<void>;
  /** 放行本次写盘 */
  release(): void;
}

/**
 * 创建一个可手动放行的写盘闸门
 * @returns 写盘闸门
 */
function createWriteGate(): IWriteGate {
  let release: () => void = () => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });

  return { promise, release };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(async () => {
  if (system !== null) {
    await system.dispose();
    system = null;
  }

  vi.useRealTimers();
});

describe('资源写缓冲并发', () => {
  // 同一路径并发立刻写盘复用同一个在途写盘
  it('同一路径并发立刻写盘复用同一个在途写盘', async () => {
    const gate = createWriteGate();
    const writer = vi.fn(() => gate.promise);
    const buffer = new WriteBuffer(writer, () => {});

    buffer.schedule(PATH, 'next');

    const first = buffer.flush(PATH);
    const second = buffer.flush(PATH);

    expect(second).toBe(first);
    expect(writer).toHaveBeenCalledTimes(1);

    gate.release();
    await first;

    buffer.dispose();
  });

  // 写盘期间又写入：新内容不丢，最终磁盘是最后一次的内容
  it('写盘期间又写入：新内容不丢，最终磁盘是最后一次的内容', async () => {
    const gate = createWriteGate();
    const disk: Map<string, ResourceContent> = new Map();
    let gated = false;
    const writer = vi.fn(async (path: string, content: ResourceContent): Promise<void> => {
      if (!gated) {
        gated = true;
        await gate.promise;
      }

      disk.set(path, content);
    });
    const buffer = new WriteBuffer(writer, () => {});

    buffer.schedule(PATH, 'first');

    const inFlight = buffer.flush(PATH);

    buffer.schedule(PATH, 'second');
    gate.release();
    await inFlight;

    await vi.advanceTimersByTimeAsync(5000);

    expect(disk.get(PATH)).toBe('second');

    buffer.dispose();
  });

  // 写盘失败：立刻写盘 reject 且待写仍保留，下一次触发后磁盘更新
  it('写盘失败：立刻写盘 reject 且待写仍保留，下一次触发后磁盘更新', async () => {
    const fs = new FakeFileSystem();

    fs.seed(PATH, 'old');

    const resourceSystem = new ResourceSystem();

    system = resourceSystem;
    await resourceSystem.initialize(fs);

    await resourceSystem.writeContent(PATH, 'draft');
    fs.failing.add(PATH);

    await expect(resourceSystem.flushContent(PATH)).rejects.toThrow();
    expect(resourceSystem.listPendingPaths()).toEqual([PATH]);

    fs.failing.delete(PATH);
    await resourceSystem.writeContent(PATH, 'draft');
    await vi.advanceTimersByTimeAsync(5000);

    expect(await fs.readFile(PATH)).toBe('draft');
  });

  // 二进制内容写盘期间被替换：靠版本号识别期间又写过，最终磁盘是后一次的内容
  it('二进制内容写盘期间被替换：靠版本号识别期间又写过，最终磁盘是后一次的内容', async () => {
    const gate = createWriteGate();
    const disk: Map<string, ResourceContent> = new Map();
    let gated = false;
    const writer = vi.fn(async (path: string, content: ResourceContent): Promise<void> => {
      if (!gated) {
        gated = true;
        await gate.promise;
      }

      disk.set(path, content);
    });
    const buffer = new WriteBuffer(writer, () => {});
    const firstBytes = new Uint8Array([1, 2, 3]);
    const secondBytes = new Uint8Array([1, 2, 3]);

    buffer.schedule(PATH, firstBytes);

    const inFlight = buffer.flush(PATH);

    buffer.schedule(PATH, secondBytes);
    gate.release();
    await inFlight;

    expect(buffer.has(PATH)).toBe(true);

    await vi.advanceTimersByTimeAsync(5000);

    expect(writer).toHaveBeenCalledTimes(2);
    expect(disk.get(PATH)).toBe(secondBytes);

    buffer.dispose();
  });

  // 释放时清掉所有定时器
  it('释放时清掉所有定时器', async () => {
    const fs = new FakeFileSystem();

    fs.seed(PATH, 'old');

    const resourceSystem = new ResourceSystem();

    system = resourceSystem;
    await resourceSystem.initialize(fs);

    await resourceSystem.writeContent(PATH, 'next');
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    await resourceSystem.dispose();
    system = null;

    expect(vi.getTimerCount()).toBe(0);
  });

  // 外部变化落在在途写盘期间：在途句柄不被孤立、写盘照常完成、之后不再自动落盘
  it('外部变化落在在途写盘期间：在途句柄不被孤立、写盘照常完成、之后不再自动落盘', async () => {
    const gate = createWriteGate();
    const disk: Map<string, ResourceContent> = new Map();
    let calls = 0;
    const writer = vi.fn(async (path: string, content: ResourceContent): Promise<void> => {
      calls += 1;
      await gate.promise;
      disk.set(path, content);
    });
    const buffer = new WriteBuffer(writer, () => {});

    buffer.schedule(PATH, 'mine');

    const first = buffer.flush(PATH);

    buffer.noteExternalWrite(PATH, 'external');

    expect(buffer.has(PATH)).toBe(true);
    expect(buffer.flush(PATH)).toBe(first);
    expect(calls).toBe(1);
    expect(buffer.readPending(PATH)).toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);

    gate.release();
    await first;

    expect(disk.get(PATH)).toBe('mine');
    expect(buffer.has(PATH)).toBe(true);
    expect(buffer.readPending(PATH)).toBeUndefined();

    await vi.advanceTimersByTimeAsync(5000);
    expect(disk.get(PATH)).toBe('mine');

    await buffer.flush(PATH);
    expect(buffer.has(PATH)).toBe(false);

    buffer.dispose();
  });
});
