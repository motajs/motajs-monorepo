// @vitest-environment node
/**
 * RES-06 —— 资源层的五态信号活性断言。
 *
 * 这些用例证明「响应式是真的」，而不是快照或被 `effect` 伪造的：
 * - 捕获 `content` callable，**变更之前**保存引用，随后 `update(...)`，再调用**同一个先前捕获的**
 *   callable，必须返回新的五态值。快照式实现会在变更后仍返回旧值而变红。
 * - 无写入时连续两次读取返回同值（派生值稳定）。
 * - 当前值无需任何订阅即可读取——`content` 由 `signal`/`computed` 派生，读取不依赖 `effect` 刷新。
 *
 * fixture 纪律（D-22 的约定半边）：本文件不声明模块级 fixture 表；数据写在用例内。
 */

import { describe, expect, it } from 'vitest';
import { FileHandler } from '../fileHandler';
import { PersistenceMonitor } from '../persistenceMonitor';
import { MemoryFsPort } from './memoryFsPort';

describe('resource signal liveness (RES-06)', () => {
  async function createLoadedHandler(path: string, initial: string): Promise<FileHandler> {
    const fs = new MemoryFsPort();
    fs.setFile(path, initial);
    const handler = new FileHandler(path, { fs, persistenceMonitor: new PersistenceMonitor() });
    await handler.load();
    return handler;
  }

  it('FileHandler: 同一先前捕获的 content callable 在 update 后返回新五态值', async () => {
    const handler = await createLoadedHandler('test.txt', 'old');

    // 变更之前捕获 callable（快照实现会在此刻冻结取值）
    const content = handler.content;

    handler.update('new');

    expect(content()).toEqual({ status: 'loaded', value: 'new' });
    expect(handler.getContent()).toEqual({ status: 'loaded', value: 'new' });
  });

  it('FileHandler: 无写入时连续两次读取返回同值', async () => {
    const handler = await createLoadedHandler('test.txt', 'stable');

    const first = handler.content();
    const second = handler.content();

    expect(second).toEqual(first);
    expect(second).toEqual({ status: 'loaded', value: 'stable' });
  });

  it('FileHandler: 不依赖任何订阅即可读取当前值（非 effect 伪造）', async () => {
    const handler = await createLoadedHandler('test.txt', 'value');

    // 从未调用 subscribe / effect，当前值必须已经可读
    expect(handler.content()).toEqual({ status: 'loaded', value: 'value' });
  });
});
