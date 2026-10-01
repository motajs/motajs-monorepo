// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { computedResource, FileHandlerManager, PersistenceMonitor, ResourceRegistry } from '../index';
import { ILoadableResource } from '../index';
import { defineEngine, EngineDefinitionError, resolvePreloadOrder } from '@motajs/editor-core';
import { PreloadStrategy, ResourceDependencies, ResourceDescriptor } from '@motajs/editor-core';
import { MemoryFsPort } from '../resources/__tests__/memoryFsPort';

// 引擎适配器契约测试（PORT-03 / PORT-04，TDD）
// 本文件驱动 defineEngine 的**端到端闭环**：
// 一个合法的引擎描述 → 冻结的适配器 → 描述符 create(deps) 产出 IResourceView →
// 经 ResourceRegistry 登记并按逻辑 id 取回同一对象；非法描述以单个 EngineDefinitionError
// 一次性携带**全部**问题被拒；resolvePreloadOrder 给出纯、稳定的拓扑序
// fixture 纪律（D-22 的约定半边）：本文件不声明模块级 fixture 表；每个用例自建描述与依赖，
// 期望值直接写在用例内（createDeps() / loadedView() 只构造一次性对象，不是可复用夹具表）

// 构造一份一次性内存依赖；描述符 create 只取用其中的 fileHandlers
function createDeps(): ResourceDependencies {
  const fs = new MemoryFsPort();
  return { fileHandlers: new FileHandlerManager({ fs, persistenceMonitor: new PersistenceMonitor() }) };
}

// 构造一个立即 loaded 的只读视图；不碰任何文件层，用于证明描述符来源无关
function loadedView<T>(id: string, value: T): ILoadableResource<T> {
  return computedResource<T>(id, [], () => ({ status: 'loaded', value }));
}

describe('defineEngine 契约', () => {
  // 把一份描述构造成冻结的适配器，资源按声明顺序排列
  it('把一份描述构造成冻结的适配器，资源按声明顺序排列', () => {
    const adapter = defineEngine({
      id: 'engineB',
      resources: [{ id: 'engineB.notes', create: () => loadedView('engineB.notes', 1) }],
    });

    expect(adapter.id).toBe('engineB');
    expect(adapter.resources.map((descriptor) => descriptor.id)).toEqual(['engineB.notes']);
    expect(Object.isFrozen(adapter)).toBe(true);
    expect(Object.isFrozen(adapter.resources)).toBe(true);
  });

  // create(deps) 产出的视图经 ResourceRegistry 登记后按 id 取回同一对象
  it('create(deps) 产出的视图经 ResourceRegistry 登记后按 id 取回同一对象', async () => {
    const adapter = defineEngine({
      id: 'engineB',
      resources: [{ id: 'engineB.notes', create: () => loadedView('engineB.notes', 1) }],
    });

    const descriptor = adapter.resources[0];
    const view = (await descriptor.create(createDeps())) as ILoadableResource<unknown>;
    const registry = new ResourceRegistry();
    registry.register(descriptor.id, view);

    expect(registry.get('engineB.notes')).toBe(view);
  });

  // 非法描述符 id 抛出 EngineDefinitionError 并点名该 id
  it('非法描述符 id 抛出 EngineDefinitionError 并点名该 id', () => {
    let thrown: unknown;
    try {
      defineEngine({
        id: 'engineB',
        resources: [{ id: 'bad id', create: () => loadedView('bad id', 1) }],
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(EngineDefinitionError);
    expect((thrown as Error).message).toContain('bad id');
  });

  // 两处问题（重复 id + 非函数 create）只抛一次且同时携带
  it('两处问题（重复 id + 非函数 create）只抛一次且同时携带', () => {
    const notAFunction = 42 as unknown as ResourceDescriptor['create'];
    let thrown: unknown;
    try {
      defineEngine({
        id: 'engineB',
        resources: [
          { id: 'engineB.dup', create: () => loadedView('engineB.dup', 1) },
          { id: 'engineB.dup', create: notAFunction },
        ],
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(EngineDefinitionError);
    const message = (thrown as Error).message;
    expect(message).toContain('engineB.dup');
    expect(message).toContain('重复');
    expect(message).toContain('create');
  });

  // 悬空的 preloadDependsOn 抛出并点名该目标 id
  it('悬空的 preloadDependsOn 抛出并点名该目标 id', () => {
    expect(() =>
      defineEngine({
        id: 'engineB',
        resources: [
          {
            id: 'engineB.chapter',
            preloadDependsOn: ['engineB.missing'],
            create: () => loadedView('engineB.chapter', 1),
          },
        ],
      }),
    ).toThrowError(/engineB\.missing/);
  });

  // 依赖环抛出并点名闭环涉及的每一个 id
  it('依赖环抛出并点名闭环涉及的每一个 id', () => {
    let thrown: unknown;
    try {
      defineEngine({
        id: 'engineB',
        resources: [
          { id: 'engineB.a', preloadDependsOn: ['engineB.b'], create: () => loadedView('engineB.a', 1) },
          { id: 'engineB.b', preloadDependsOn: ['engineB.a'], create: () => loadedView('engineB.b', 2) },
        ],
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(EngineDefinitionError);
    const message = (thrown as Error).message;
    expect(message).toContain('engineB.a');
    expect(message).toContain('engineB.b');
  });

  // 非法的 preload 字面量抛出
  it('非法的 preload 字面量抛出', () => {
    expect(() =>
      defineEngine({
        id: 'engineB',
        resources: [
          {
            id: 'engineB.x',
            preload: 'always' as unknown as PreloadStrategy,
            create: () => loadedView('engineB.x', 1),
          },
        ],
      }),
    ).toThrowError(EngineDefinitionError);
  });

  // 空的 apiVersion 字符串抛出
  it('空的 apiVersion 字符串抛出', () => {
    expect(() =>
      defineEngine({
        id: 'engineB',
        apiVersion: '',
        resources: [{ id: 'engineB.y', create: () => loadedView('engineB.y', 1) }],
      }),
    ).toThrowError(EngineDefinitionError);
  });
});

describe('resolvePreloadOrder', () => {
  // 把依赖排在依赖者之前，且跨调用稳定
  it('把依赖排在依赖者之前，且跨调用稳定', () => {
    const resources: readonly ResourceDescriptor[] = [
      { id: 'chapter', preloadDependsOn: ['index'], create: () => loadedView('chapter', 1) },
      { id: 'index', create: () => loadedView('index', 2) },
    ];

    const first = resolvePreloadOrder(resources);
    const second = resolvePreloadOrder(resources);

    expect(first).toEqual(['index', 'chapter']);
    expect(second).toEqual(first);
    expect(Object.isFrozen(first)).toBe(true);
  });

  // 无 preloadDependsOn 的图按声明顺序返回
  it('无 preloadDependsOn 的图按声明顺序返回', () => {
    const resources: readonly ResourceDescriptor[] = [
      { id: 'c', create: () => loadedView('c', 1) },
      { id: 'a', create: () => loadedView('a', 2) },
      { id: 'b', create: () => loadedView('b', 3) },
    ];

    expect(resolvePreloadOrder(resources)).toEqual(['c', 'a', 'b']);
  });

  // 多级依赖按拓扑序排列（catalog → index → chapter）
  it('多级依赖按拓扑序排列（catalog → index → chapter）', () => {
    const resources: readonly ResourceDescriptor[] = [
      { id: 'chapter', preloadDependsOn: ['index'], create: () => loadedView('chapter', 1) },
      { id: 'index', preloadDependsOn: ['catalog'], create: () => loadedView('index', 2) },
      { id: 'catalog', create: () => loadedView('catalog', 3) },
    ];

    expect(resolvePreloadOrder(resources)).toEqual(['catalog', 'index', 'chapter']);
  });
});
