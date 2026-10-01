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
 * 一次性构造注入的 `MemoryFsPort` 依赖；测试持有所需句柄。
 *
 * @param fs 注入的宿主文件能力替身。
 */
function createDeps(fs: MemoryFsPort): ResourceDependencies {
  return { fileHandlers: new FileHandlerManager({ fs, persistenceMonitor: new PersistenceMonitor() }) };
}

/**
 * 文件支撑描述符使用的处理器工厂：core 的通用 `JsonDataHandler`。
 *
 * @param id 资源身份（逻辑 id）。
 */
function jsonHandlerFactory<T>(id: string): (file: FileHandler) => JsonDataHandler<T> {
  return (file) => new JsonDataHandler<T>(file, id);
}

describe('FileResource', () => {
  // 命中地址时经注入的 IFsPort 加载为 loaded，并给出解析后的值
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

  // 缺失地址时加载为 not-found（保留 RES-05 语义）
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

  // reload 重读地址，改动被反映，且 id 全程不变
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
