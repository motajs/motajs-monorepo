import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeFileSystem } from '../../__tests__/fixtures';
import { ResourceSystem } from '../resourceSystem';
import { WriteBuffer } from '../writeBuffer';

// 资源写缓冲的语义：写入只进缓冲、读优先命中缓冲、5 秒防抖后落盘、丢弃失效缓存、外部变化不被待写遮蔽。

const PATH = 'tables/demo.json';
const OTHER_PATH = 'tables/other.json';

let system: ResourceSystem | null = null;

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

describe('资源写缓冲', () => {
  // 写入只进缓冲：写完立刻读资源层是新值、磁盘仍是旧值
  it('写入只进缓冲：写完立刻 readContent 是新值、磁盘仍旧值', async () => {
    const fs = new FakeFileSystem();

    fs.seed(PATH, 'old');

    const resourceSystem = new ResourceSystem();

    system = resourceSystem;
    await resourceSystem.initialize(fs);

    await resourceSystem.writeContent(PATH, 'new');

    expect(await resourceSystem.readContent(PATH)).toBe('new');
    expect(await fs.readFile(PATH)).toBe('old');
  });

  // 写入只进缓冲：推进 5 000 毫秒后磁盘才更新，且到期前再写会重新计时
  it('写入只进缓冲：推进 5 000 毫秒后磁盘才更新，且到期前再写会重新计时', async () => {
    const fs = new FakeFileSystem();

    fs.seed(PATH, 'old');

    const resourceSystem = new ResourceSystem();

    system = resourceSystem;
    await resourceSystem.initialize(fs);

    await resourceSystem.writeContent(PATH, 'first');
    await vi.advanceTimersByTimeAsync(4000);

    expect(await fs.readFile(PATH)).toBe('old');

    await resourceSystem.writeContent(PATH, 'second');
    await vi.advanceTimersByTimeAsync(4000);

    expect(await fs.readFile(PATH)).toBe('old');

    await vi.advanceTimersByTimeAsync(1000);

    expect(await fs.readFile(PATH)).toBe('second');
  });

  // 立刻写盘是幂等的：没有待写时不抛错、也不新建条目
  it('立刻写盘是幂等的：没有待写的路径调用不抛错、也不新建条目', async () => {
    const fs = new FakeFileSystem();

    fs.seed(PATH, 'old');

    const resourceSystem = new ResourceSystem();

    system = resourceSystem;
    await resourceSystem.initialize(fs);

    await expect(resourceSystem.flushContent(PATH)).resolves.toBeUndefined();

    expect(resourceSystem.listPendingPaths()).toEqual([]);
    expect(await fs.readFile(PATH)).toBe('old');
  });

  // 全量写盘覆盖多条路径：两条路径各写一次，全部写盘后磁盘都更新
  it('全量写盘覆盖多条路径：两条路径各写一次，全部写盘后磁盘都更新', async () => {
    const fs = new FakeFileSystem();

    fs.seed(PATH, 'a');
    fs.seed(OTHER_PATH, 'b');

    const resourceSystem = new ResourceSystem();

    system = resourceSystem;
    await resourceSystem.initialize(fs);

    await resourceSystem.writeContent(PATH, 'a2');
    await resourceSystem.writeContent(OTHER_PATH, 'b2');
    await resourceSystem.flushAllContent();

    expect(await fs.readFile(PATH)).toBe('a2');
    expect(await fs.readFile(OTHER_PATH)).toBe('b2');
  });

  // 有无待写与待写路径列表随写入、写盘变化
  it('有无待写与待写路径列表随写入 / 写盘变化', async () => {
    const fs = new FakeFileSystem();

    fs.seed(PATH, 'old');

    const resourceSystem = new ResourceSystem();

    system = resourceSystem;
    await resourceSystem.initialize(fs);

    expect(resourceSystem.hasAnyPendingContent()).toBe(false);

    await resourceSystem.writeContent(PATH, 'next');

    expect(resourceSystem.hasAnyPendingContent()).toBe(true);
    expect(resourceSystem.listPendingPaths()).toEqual([PATH]);

    await resourceSystem.flushContent(PATH);

    expect(resourceSystem.hasAnyPendingContent()).toBe(false);
    expect(resourceSystem.listPendingPaths()).toEqual([]);
  });

  // 新建资源立刻落盘、不进缓冲
  it('新建资源立刻落盘、不进缓冲', async () => {
    const fs = new FakeFileSystem();
    const resourceSystem = new ResourceSystem();

    system = resourceSystem;
    await resourceSystem.initialize(fs);

    await resourceSystem.createResource(PATH, 'created');

    expect(await fs.readFile(PATH)).toBe('created');
    expect(resourceSystem.listPendingPaths()).toEqual([]);
  });

  // 删除资源丢弃该路径待写：写入后删除，推进 5 秒文件不会复活
  it('删除资源丢弃该路径待写：写入后删除，推进 5 秒文件不会复活', async () => {
    const fs = new FakeFileSystem();

    fs.seed(PATH, 'old');

    const resourceSystem = new ResourceSystem();

    system = resourceSystem;
    await resourceSystem.initialize(fs);

    await resourceSystem.writeContent(PATH, 'pending');
    await resourceSystem.deleteResource(PATH);
    await vi.advanceTimersByTimeAsync(5000);

    await expect(fs.readFile(PATH)).rejects.toThrow();
  });

  // 移动资源丢弃源路径待写：写入源路径后移动，推进 5 秒源路径不会复活
  it('移动资源丢弃源路径待写：写入源路径后移动，推进 5 秒源路径不会复活', async () => {
    const fs = new FakeFileSystem();

    fs.seed(PATH, 'old');

    const resourceSystem = new ResourceSystem();

    system = resourceSystem;
    await resourceSystem.initialize(fs);

    await resourceSystem.writeContent(PATH, 'pending');
    await resourceSystem.moveResource(PATH, OTHER_PATH);
    await vi.advanceTimersByTimeAsync(5000);

    await expect(fs.readFile(PATH)).rejects.toThrow();
    expect(await fs.readFile(OTHER_PATH)).toBe('old');
  });

  // 释放编辑器先写盘再清引用：写入后不写盘直接 dispose，释放结束后磁盘是新值
  it('释放编辑器先写盘再清引用：写入后直接 dispose，释放结束后磁盘是新值', async () => {
    const fs = new FakeFileSystem();

    fs.seed(PATH, 'old');

    const resourceSystem = new ResourceSystem();

    system = resourceSystem;
    await resourceSystem.initialize(fs);

    await resourceSystem.writeContent(PATH, 'new');
    await resourceSystem.dispose();
    system = null;

    expect(await fs.readFile(PATH)).toBe('new');
  });

  // 丢弃待写后 readContent 回到磁盘旧值（丢弃同时失效内容缓存）
  it('丢弃待写后 readContent 回到磁盘旧值', async () => {
    const fs = new FakeFileSystem();

    fs.seed(PATH, 'old');

    const resourceSystem = new ResourceSystem();

    system = resourceSystem;
    await resourceSystem.initialize(fs);

    expect(await resourceSystem.readContent(PATH)).toBe('old');

    await resourceSystem.writeContent(PATH, 'draft');
    expect(await resourceSystem.readContent(PATH)).toBe('draft');

    resourceSystem.discardPendingContent(PATH);

    expect(await resourceSystem.readContent(PATH)).toBe('old');
  });

  // 外部变化到达时标记待写、自己写盘的回声不标记
  it('外部变化到达时标记待写、自己写盘的回声不标记', async () => {
    const fs = new FakeFileSystem();

    fs.seed(PATH, 'old');

    const resourceSystem = new ResourceSystem();

    system = resourceSystem;
    await resourceSystem.initialize(fs);

    await resourceSystem.writeContent(PATH, 'mine');

    fs.seed(PATH, 'external');
    await resourceSystem.updateResource(PATH);

    expect(resourceSystem.listPendingPaths()).toEqual([PATH]);
    expect(await resourceSystem.readContent(PATH)).toBe('external');

    await vi.advanceTimersByTimeAsync(5000);
    expect(await fs.readFile(PATH)).toBe('external');

    await resourceSystem.writeContent(PATH, 'mine2');
    await resourceSystem.flushContent(PATH);
    await resourceSystem.writeContent(PATH, 'next');
    await resourceSystem.updateResource(PATH);

    expect(resourceSystem.listPendingPaths()).toEqual([PATH]);
    expect(await resourceSystem.readContent(PATH)).toBe('next');

    await vi.advanceTimersByTimeAsync(5000);
    expect(await fs.readFile(PATH)).toBe('next');
  });

  // 外部冲突之后该路径重新可读（标记不会永久关闭读穿透）：只断言 readPending，不经过内容缓存
  it('外部冲突之后该路径重新可读（标记不会永久关闭读穿透）', async () => {
    const written: string[] = [];
    const onChange = vi.fn();
    const buffer = new WriteBuffer(async (path: string, content): Promise<void> => {
      written.push(`${path}:${typeof content === 'string' ? content : 'binary'}`);
    }, onChange);

    buffer.schedule(PATH, 'first');
    buffer.noteExternalWrite(PATH, 'external-1');
    expect(buffer.readPending(PATH)).toBeUndefined();

    buffer.schedule(PATH, 'second');
    expect(buffer.readPending(PATH)).toBe('second');

    buffer.noteExternalWrite(PATH, 'external-2');
    expect(buffer.readPending(PATH)).toBeUndefined();

    await buffer.flush(PATH);
    expect(buffer.has(PATH)).toBe(false);

    buffer.schedule(PATH, 'fourth');
    expect(buffer.readPending(PATH)).toBe('fourth');

    buffer.noteExternalWrite(PATH, 'external-3');
    expect(buffer.readPending(PATH)).toBeUndefined();

    buffer.discard(PATH);
    expect(buffer.readPending(PATH)).toBeUndefined();
    expect(buffer.has(PATH)).toBe(false);

    buffer.schedule(PATH, 'fifth');
    expect(buffer.readPending(PATH)).toBe('fifth');

    buffer.dispose();

    expect(written).toEqual([`${PATH}:second`]);
    expect(onChange).toHaveBeenCalled();
  });
});
