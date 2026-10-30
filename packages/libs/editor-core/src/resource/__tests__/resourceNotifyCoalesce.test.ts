import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeFileSystem } from '../../__tests__/fixtures';
import { EditorFileChangeKind } from '../../fs';
import { ResourceSystem } from '../resourceSystem';
import { ResourceContent } from '../types';

// 合并通知的语义：一条路径的连续写入在 50 毫秒内只通知一次、首次排程不重置、只投递「内容变化」、
// 不预读内容也不携带来源；丢弃待写与释放编辑器都会取消还没发出的通知。

const PATH = 'tables/demo.json';
const OTHER_PATH = 'tables/other.json';

/** 一条收到的资源变化通知 */
interface IReceivedChange {
  /** 发生变化的路径 */
  readonly path: string;
  /** 变化的种类 */
  readonly kind: EditorFileChangeKind;
}

let system: ResourceSystem | null = null;

/**
 * 装配一个已初始化的资源系统，并登记到用例级清理变量
 * @param fs 注入的文件系统替身
 * @returns 已初始化的资源系统
 */
async function createSystem(fs: FakeFileSystem): Promise<ResourceSystem> {
  const resourceSystem = new ResourceSystem();

  system = resourceSystem;
  await resourceSystem.initialize(fs);

  return resourceSystem;
}

/**
 * 挂一个只记录路径与变化种类的资源变化钩子
 * @param resourceSystem 目标资源系统
 * @returns 按到达顺序追加的通知记录
 */
function addRecordingHook(resourceSystem: ResourceSystem): IReceivedChange[] {
  const received: IReceivedChange[] = [];

  resourceSystem.addHook({
    onResourceChange: async (path, kind) => {
      received.push({ path, kind });
    },
  });

  return received;
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

describe('资源合并通知', () => {
  // 同一路径在一个窗口内连续写三次，50 毫秒到点只收到一次通知，路径与种类都正确
  it('同一路径在 50 毫秒窗口内连续写三次只通知一次', async () => {
    const fs = new FakeFileSystem();

    fs.seed(PATH, 'old');

    const resourceSystem = await createSystem(fs);
    const received = addRecordingHook(resourceSystem);

    await resourceSystem.writeContent(PATH, 'v1');
    await resourceSystem.writeContent(PATH, 'v2');
    await resourceSystem.writeContent(PATH, 'v3');
    await vi.advanceTimersByTimeAsync(50);

    expect(received).toEqual([{ path: PATH, kind: EditorFileChangeKind.Change }]);
  });

  // 两条不同路径各写一次，50 毫秒后各收到一次通知，两条通知按路径可分辨
  it('两条不同路径各写一次各收到一次通知', async () => {
    const fs = new FakeFileSystem();

    fs.seed(PATH, 'old');
    fs.seed(OTHER_PATH, 'old');

    const resourceSystem = await createSystem(fs);
    const received = addRecordingHook(resourceSystem);

    await resourceSystem.writeContent(PATH, 'a');
    await resourceSystem.writeContent(OTHER_PATH, 'b');
    await vi.advanceTimersByTimeAsync(50);

    expect(received).toHaveLength(2);
    expect(received.map((item) => item.path).sort()).toEqual([PATH, OTHER_PATH]);
    expect(received.every((item) => item.kind === EditorFileChangeKind.Change)).toBe(true);
  });

  // 首次排程不重置：每 10 毫秒写一次连写五次，到第一次写入后 50 毫秒时仍只收到一次通知
  it('首次排程不重置：持续写入仍在第一次写入后 50 毫秒通知一次', async () => {
    const fs = new FakeFileSystem();

    fs.seed(PATH, 'old');

    const resourceSystem = await createSystem(fs);
    const received = addRecordingHook(resourceSystem);

    await resourceSystem.writeContent(PATH, 'v1');
    await vi.advanceTimersByTimeAsync(10);
    await resourceSystem.writeContent(PATH, 'v2');
    await vi.advanceTimersByTimeAsync(10);
    await resourceSystem.writeContent(PATH, 'v3');
    await vi.advanceTimersByTimeAsync(10);
    await resourceSystem.writeContent(PATH, 'v4');
    await vi.advanceTimersByTimeAsync(10);
    await resourceSystem.writeContent(PATH, 'v5');

    expect(received).toEqual([]);

    await vi.advanceTimersByTimeAsync(10);

    expect(received).toEqual([{ path: PATH, kind: EditorFileChangeKind.Change }]);
  });

  // 通知到达时读到的已经是缓冲内容，而底层磁盘仍是旧值
  it('通知到达时读到的已经是缓冲内容而磁盘仍是旧值', async () => {
    const fs = new FakeFileSystem();

    fs.seed(PATH, 'old');

    const resourceSystem = await createSystem(fs);

    let contentAtNotify: ResourceContent | undefined;

    resourceSystem.addHook({
      onResourceChange: async () => {
        contentAtNotify = await resourceSystem.readContent(PATH);
      },
    });

    await resourceSystem.writeContent(PATH, 'new');
    await vi.advanceTimersByTimeAsync(50);

    expect(contentAtNotify).toBe('new');
    expect(await fs.readFile(PATH)).toBe('old');
  });

  // 丢弃待写后即使推进到 50 毫秒，也不再收到这条路径的通知
  it('丢弃待写后到点不再收到通知', async () => {
    const fs = new FakeFileSystem();

    fs.seed(PATH, 'old');

    const resourceSystem = await createSystem(fs);
    const received = addRecordingHook(resourceSystem);

    await resourceSystem.writeContent(PATH, 'draft');
    resourceSystem.discardPendingContent(PATH);
    vi.advanceTimersByTime(50);

    expect(received).toEqual([]);
  });

  // 释放编辑器会清掉全部通知定时器：推进 50 毫秒后不再有任何通知
  it('释放编辑器后推进 50 毫秒不再有任何通知', async () => {
    const fs = new FakeFileSystem();

    fs.seed(PATH, 'old');

    const resourceSystem = await createSystem(fs);
    const received = addRecordingHook(resourceSystem);

    await resourceSystem.writeContent(PATH, 'draft');
    await resourceSystem.dispose();
    system = null;
    vi.advanceTimersByTime(50);

    expect(received).toEqual([]);
  });
});
