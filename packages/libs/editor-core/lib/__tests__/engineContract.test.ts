// @vitest-environment node
/**
 * 引擎适配器契约测试（PORT-03 / PORT-04，TDD tracer）。
 *
 * 本文件驱动 `defineEngine` 的**最小端到端闭环**：一个合法的引擎描述 → 冻结的适配器 →
 * 描述符 `create(deps)` 产出 `ResourceView` → 经 `ResourceRegistry` 登记并按逻辑 id 取回同一对象。
 * 它同时证明非法描述符 id 会以 `EngineDefinitionError` 被拒。
 *
 * fixture 纪律（D-22 的约定半边）：本文件不声明模块级 fixture 表；每个用例自建描述与依赖，
 * 期望值直接写在用例内（`createDeps()` 只构造一次性的内存依赖，不是可复用夹具表）。
 */
import { describe, expect, it } from 'vitest';

import {
  computedResource,
  defineEngine,
  EngineDefinitionError,
  FileHandlerManager,
  PersistenceMonitor,
  ResourceRegistry,
} from '../index';
import type { ResourceDependencies } from '../index';
import { MemoryFsPort } from '../resources/__tests__/memoryFsPort';

/** 构造一份一次性内存依赖；描述符 `create` 只取用其中的 `fileHandlers`。 */
function createDeps(): ResourceDependencies {
  const fs = new MemoryFsPort();
  return { fileHandlers: new FileHandlerManager({ fs, persistenceMonitor: new PersistenceMonitor() }) };
}

describe('defineEngine 契约（tracer）', () => {
  it('把一份描述构造成冻结的适配器，资源按声明顺序排列', () => {
    const adapter = defineEngine({
      id: 'engineB',
      resources: [
        {
          id: 'engineB.notes',
          create: () => computedResource('engineB.notes', [], () => ({ status: 'loaded', value: 1 })),
        },
      ],
    });

    expect(adapter.id).toBe('engineB');
    expect(adapter.resources.map((descriptor) => descriptor.id)).toEqual(['engineB.notes']);
  });

  it('create(deps) 产出的视图经 ResourceRegistry 登记后按 id 取回同一对象', async () => {
    const adapter = defineEngine({
      id: 'engineB',
      resources: [
        {
          id: 'engineB.notes',
          create: () => computedResource('engineB.notes', [], () => ({ status: 'loaded', value: 1 })),
        },
      ],
    });

    const descriptor = adapter.resources[0];
    const view = await descriptor.create(createDeps());
    const registry = new ResourceRegistry();
    registry.register(descriptor.id, view);

    expect(registry.get('engineB.notes')).toBe(view);
  });

  it('非法描述符 id 抛出 EngineDefinitionError 并点名该 id', () => {
    let thrown: unknown;
    try {
      defineEngine({
        id: 'engineB',
        resources: [
          {
            id: 'bad id',
            create: () => computedResource('bad id', [], () => ({ status: 'loaded', value: 1 })),
          },
        ],
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(EngineDefinitionError);
    expect((thrown as Error).message).toContain('bad id');
  });
});
