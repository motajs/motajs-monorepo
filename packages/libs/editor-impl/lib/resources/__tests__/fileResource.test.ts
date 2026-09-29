// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { ResourceDependencies } from '@motajs/editor-core';
import { FileHandler } from '../fileHandler';
import { FileHandlerManager } from '../fileHandlerManager';
import { JsonDataHandler } from '../jsonDataHandler';
import { PersistenceMonitor } from '../persistenceMonitor';
import { FileResource } from '../fileResource';
import { MemoryFsPort } from './memoryFsPort';

/**
 * `FileResource` 单元测试（PORT-04，TDD）。
 *
 * 证明 core 唯一持有「不透明 IO 地址」的类只经注入的 `IFsPort` 读文件：
 * 命中地址得 `loaded`（值由 `JsonDataHandler` 解析）、缺失地址得 `not-found`（保留 RES-05 语义）、
 * `reload` 重读使改动反映出来，且 `id` 全程不变。
 *
 * fixture 纪律（D-22 的约定半边）：不声明模块级夹具表；每个用例自建 `MemoryFsPort` 与描述符，
 * 期望值直接写在用例内。
 */

/** 一次性构造注入的 `MemoryFsPort` 依赖；测试持有所需句柄。 */
function createDeps(fs: MemoryFsPort): ResourceDependencies {
  return { fileHandlers: new FileHandlerManager({ fs, persistenceMonitor: new PersistenceMonitor() }) };
}

/** 文件支撑描述符使用的处理器工厂：core 的通用 `JsonDataHandler`。 */
function jsonHandlerFactory<T>(id: string): (file: FileHandler) => JsonDataHandler<T> {
  return (file) => new JsonDataHandler<T>(file, id);
}

describe('FileResource', () => {
  it('命中地址时经注入的 IFsPort 加载为 loaded，并给出解析后的值', async () => {
    const fs = new MemoryFsPort();
    fs.setFile('notes.txt', '{"answer":42}');
    const resource = new FileResource<{ answer: number }>(
      'engineB.catalog',
      'notes.txt',
      jsonHandlerFactory('engineB.catalog'),
      createDeps(fs),
    );

    await resource.ensureLoaded();

    expect(resource.snapshot()).toEqual({ status: 'loaded', value: { answer: 42 } });
    expect(resource.value()).toEqual({ answer: 42 });
  });

  it('缺失地址时加载为 not-found（保留 RES-05 语义）', async () => {
    const fs = new MemoryFsPort();
    const resource = new FileResource<{ answer: number }>(
      'engineB.index',
      'missing.txt',
      jsonHandlerFactory('engineB.index'),
      createDeps(fs),
    );

    await resource.ensureLoaded();

    expect(resource.snapshot()).toEqual({ status: 'not-found' });
  });

  it('reload 重读地址，改动被反映，且 id 全程不变', async () => {
    const fs = new MemoryFsPort();
    fs.setFile('notes.txt', '{"answer":42}');
    const resource = new FileResource<{ answer: number }>(
      'engineB.catalog',
      'notes.txt',
      jsonHandlerFactory('engineB.catalog'),
      createDeps(fs),
    );

    await resource.ensureLoaded();
    expect(resource.id).toBe('engineB.catalog');
    expect(resource.value()).toEqual({ answer: 42 });

    fs.setFile('notes.txt', '{"answer":43}');
    await resource.reload();

    expect(resource.id).toBe('engineB.catalog');
    expect(resource.snapshot()).toEqual({ status: 'loaded', value: { answer: 43 } });
    expect(resource.value()).toEqual({ answer: 43 });
  });
});
