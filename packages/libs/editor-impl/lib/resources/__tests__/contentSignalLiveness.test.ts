// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { FileHandler } from '../fileHandler';
import { JsonDataHandler } from '../jsonDataHandler';
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

  // FileHandler: 同一先前捕获的 content callable 在 update 后返回新五态值
  it('FileHandler: 同一先前捕获的 content callable 在 update 后返回新五态值', async () => {
    const handler = await createLoadedHandler('test.txt', 'old');

    // 变更之前捕获 callable（快照实现会在此刻冻结取值）
    const content = handler.content;

    handler.update('new');

    expect(content()).toEqual({ status: 'loaded', value: 'new' });
    expect(handler.getContent()).toEqual({ status: 'loaded', value: 'new' });
  });

  // FileHandler: 无写入时连续两次读取返回同值
  it('FileHandler: 无写入时连续两次读取返回同值', async () => {
    const handler = await createLoadedHandler('test.txt', 'stable');

    const first = handler.content();
    const second = handler.content();

    expect(second).toEqual(first);
    expect(second).toEqual({ status: 'loaded', value: 'stable' });
  });

  // FileHandler: 不依赖任何订阅即可读取当前值（非 effect 伪造）
  it('FileHandler: 不依赖任何订阅即可读取当前值（非 effect 伪造）', async () => {
    const handler = await createLoadedHandler('test.txt', 'value');

    // 从未调用 subscribe / effect，当前值必须已经可读
    expect(handler.content()).toEqual({ status: 'loaded', value: 'value' });
  });

  // DataHandler/JsonDataHandler: 同一先前捕获的 content callable 在 update 后返回新五态值
  it('DataHandler/JsonDataHandler: 同一先前捕获的 content callable 在 update 后返回新五态值', async () => {
    const fs = new MemoryFsPort();
    fs.setFile('data.json', JSON.stringify({ value: 'old' }));
    const fileHandler = new FileHandler('data.json', { fs, persistenceMonitor: new PersistenceMonitor() });
    const dataHandler = new JsonDataHandler<{ value: string }>(fileHandler, 'data');
    await fileHandler.load();
    await dataHandler.waitForSettled();

    // 变更之前捕获派生的 callable（快照实现会在此刻冻结取值）
    const content = dataHandler.content;
    expect(content()).toEqual({ status: 'loaded', value: { value: 'old' } });

    dataHandler.update({ value: 'new' });

    // 同一个先前捕获的 callable 必须返回新的五态值——computed 派生，而非快照
    expect(content()).toEqual({ status: 'loaded', value: { value: 'new' } });
    expect(dataHandler.getContent()).toEqual({ status: 'loaded', value: { value: 'new' } });
  });
});
