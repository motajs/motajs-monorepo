// @vitest-environment node
/**
 * 假引擎 B 端到端测试（PORT-08 / D-11 / D-04）。
 *
 * 本文件驱动完整的适配器闭环：`defineEngine` → 校验 → `ResourceRegistry` 登记 / 按 id 取回 →
 * `resolvePreloadOrder`，且全部使用**非魔塔**的 `engineB.*` id。两条关键证明：
 * - `engineB.notes` 是 `computedResource` 现场构造的**非文件**资源，加载它不产生任何 `IFsPort` 读取
 *   （T-05-09），因此通用描述符不假定「内容来自文件」；
 * - 多级 `preloadDependsOn` 图被 `resolvePreloadOrder` 正确拓扑排序。
 *
 * 额外的回归守卫：夹具源码必须不含任何被禁引擎术语，防止从别处复制粘贴把引擎词汇带进夹具。
 * 源码经 `node:fs` 直接读入；core 未安装 `@types/node`，故对内置模块导入加 `@ts-expect-error`
 * （运行时由 vitest 的 node 环境解析）。
 */
// @ts-expect-error core 未安装 @types/node；运行时由 vitest 的 node 环境提供内置模块
import { readFileSync } from 'node:fs';
// @ts-expect-error core 未安装 @types/node；运行时由 vitest 的 node 环境提供内置模块
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { computedResource, FileHandlerManager, PersistenceMonitor, ResourceRegistry } from '../index';
import { ILoadableResource } from '../index';
import { defineEngine, EngineDefinitionError, resolvePreloadOrder } from '@motajs/editor-core';
import type { EngineDescription, ResourceDependencies, ResourceDescriptor } from '@motajs/editor-core';
import { MemoryFsPort } from '../resources/__tests__/memoryFsPort';
import { createEngineBDescription, engineBDescription } from './engineB';

/** 声明顺序（夹具的既有事实，直接写在用例内而非模块级夹具表）。 */
const DECLARED_IDS = ['engineB.catalog', 'engineB.index', 'engineB.notes', 'engineB.chapter'];

/** 构造一次性内存依赖；描述符 `create` 只取用其中的 `fileHandlers`。 */
function createDeps(fs: MemoryFsPort): ResourceDependencies {
  return { fileHandlers: new FileHandlerManager({ fs, persistenceMonitor: new PersistenceMonitor() }) };
}

/** 构造立即 loaded 的只读视图（非文件）；用于多问题描述的无副作用 `create`。 */
function loadedView<T>(id: string, value: T): ILoadableResource<T> {
  return computedResource<T>(id, [], () => ({ status: 'loaded', value }));
}

/** 从 engine B 描述里按 id 取描述符；缺失即抛错（用例内断言用）。 */
function findDescriptor(id: string): ResourceDescriptor {
  const descriptor = engineBDescription.resources.find((candidate) => candidate.id === id);
  if (!descriptor) throw new Error(`engine B 描述缺少 ${id}`);
  return descriptor;
}

/** 按 id 建出一个可加载视图（描述符契约只承诺 `IResourceView`，这里收窄到 `ILoadableResource`）。 */
async function createLoadable(id: string, deps: ResourceDependencies): Promise<ILoadableResource<unknown>> {
  return (await findDescriptor(id).create(deps)) as ILoadableResource<unknown>;
}

describe('fake engine B 的适配器闭环', () => {
  it('defineEngine 得到 id 为 engineB 的冻结适配器，资源按声明顺序', () => {
    const adapter = defineEngine(engineBDescription);

    expect(adapter.id).toBe('engineB');
    expect(adapter.resources.map((descriptor) => descriptor.id)).toEqual(DECLARED_IDS);
    expect(Object.isFrozen(adapter.resources)).toBe(true);
  });

  it('每个 create(deps) 产出视图，登记后按 id 取回同一对象，ids() 与声明一致', async () => {
    const deps = createDeps(new MemoryFsPort());
    const registry = new ResourceRegistry();

    for (const descriptor of engineBDescription.resources) {
      const view = (await descriptor.create(deps)) as ILoadableResource<unknown>;
      expect(typeof view.snapshot).toBe('function');
      expect(typeof view.value).toBe('function');
      expect(typeof view.subscribe).toBe('function');
      expect(view.id).toBe(descriptor.id);

      registry.register(descriptor.id, view);
      expect(registry.get(descriptor.id)).toBe(view);
    }

    expect(registry.ids()).toEqual(DECLARED_IDS);
  });

  it('createEngineBDescription(deps) 把 manager 预绑定进各描述符', async () => {
    const fs = new MemoryFsPort();
    fs.setFile('catalog.json', '{"entries":["alpha"]}');
    const bound = createEngineBDescription(createDeps(fs));

    expect(bound.id).toBe('engineB');
    expect(bound.resources.map((descriptor) => descriptor.id)).toEqual(DECLARED_IDS);

    // 预绑定后，即便 create 收到另一份空依赖，仍读取被捕获的 manager。
    const catalog = (await bound.resources[0].create(createDeps(new MemoryFsPort()))) as ILoadableResource<unknown>;
    await catalog.ensureLoaded();
    expect(catalog.snapshot()).toEqual({ status: 'loaded', value: { entries: ['alpha'] } });
  });

  it('文件支撑视图经 MemoryFsPort 读取：命中得 loaded，缺失得 not-found', async () => {
    const populated = new MemoryFsPort();
    populated.setFile('catalog.json', '{"entries":["alpha","beta"]}');

    const catalog = await createLoadable('engineB.catalog', createDeps(populated));
    await catalog.ensureLoaded();
    expect(catalog.snapshot()).toEqual({ status: 'loaded', value: { entries: ['alpha', 'beta'] } });

    const empty = new MemoryFsPort();
    const index = await createLoadable('engineB.index', createDeps(empty));
    await index.ensureLoaded();
    expect(index.snapshot()).toEqual({ status: 'not-found' });
  });

  it('非文件视图 engineB.notes 加载时对 IFsPort 零读取', async () => {
    const fs = new MemoryFsPort();
    fs.setFile('catalog.json', '{"entries":["alpha","beta"]}');
    const readPaths: string[] = [];
    const originalRead = fs.readFile.bind(fs);
    fs.readFile = async (path: string): Promise<string> => {
      readPaths.push(path);
      return originalRead(path);
    };

    const deps = createDeps(fs);
    const catalog = await createLoadable('engineB.catalog', deps);
    await catalog.ensureLoaded();
    const readsAfterCatalog = readPaths.length;
    expect(readsAfterCatalog).toBeGreaterThan(0);

    const notes = await createLoadable('engineB.notes', deps);
    await notes.ensureLoaded();

    // catalog 已就绪，notes 自身没有任何地址——加载它不得新增任何读取。
    expect(readPaths.length).toBe(readsAfterCatalog);
    expect(readPaths).not.toContain('notes.json');
    expect(notes.snapshot()).toEqual({ status: 'loaded', value: { summary: 'catalog has 2 entries' } });
  });

  it('环依赖与悬空 preloadDependsOn 一次性聚合抛出全部问题', () => {
    const description: EngineDescription = {
      id: 'engineB',
      resources: [
        { id: 'engineB.a', preloadDependsOn: ['engineB.b'], create: () => loadedView('engineB.a', 1) },
        { id: 'engineB.b', preloadDependsOn: ['engineB.a'], create: () => loadedView('engineB.b', 2) },
        {
          id: 'engineB.chapter',
          preloadDependsOn: ['engineB.missing'],
          create: () => loadedView('engineB.chapter', 3),
        },
      ],
    };

    let thrown: unknown;
    try {
      defineEngine(description);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(EngineDefinitionError);
    const message = (thrown as Error).message;
    expect(message).toContain('engineB.a');
    expect(message).toContain('engineB.b');
    expect(message).toContain('engineB.missing');
  });

  it('重复 id 与非函数 create 都被拒', () => {
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
    expect(message).toContain('重复');
    expect(message).toContain('create');
  });

  it('resolvePreloadOrder 把每个依赖排在依赖者之前', () => {
    const order = resolvePreloadOrder(engineBDescription.resources);

    expect(order).toEqual(['engineB.catalog', 'engineB.index', 'engineB.notes', 'engineB.chapter']);
    expect(order.indexOf('engineB.catalog')).toBeLessThan(order.indexOf('engineB.index'));
    expect(order.indexOf('engineB.index')).toBeLessThan(order.indexOf('engineB.chapter'));
    expect(order.indexOf('engineB.catalog')).toBeLessThan(order.indexOf('engineB.notes'));
  });

  it('夹具源码不含任何被禁引擎术语（防复制粘贴回归）', () => {
    const fixtureSource = readFileSync(fileURLToPath(new URL('./engineB.ts', import.meta.url)), 'utf8');
    const bannedTerms = [
      'tower',
      'floor',
      'loc',
      'autopass',
      'autotile',
      'idnum',
      'airwall',
      'commonEvent',
      'prefab',
      'mota',
    ];

    const violations: string[] = [];
    for (const term of bannedTerms) {
      const pattern = new RegExp(`\\b${term}\\b`, 'g');
      let match = pattern.exec(fixtureSource);
      while (match !== null) {
        // 与 coreEngineNeutral 同规则：`floor` 的成员访问（前一个字符为 `.`）豁免。
        const exempt = term === 'floor' && fixtureSource[match.index - 1] === '.';
        if (!exempt) violations.push(term);
        match = pattern.exec(fixtureSource);
      }
    }

    expect(violations).toEqual([]);
  });
});
