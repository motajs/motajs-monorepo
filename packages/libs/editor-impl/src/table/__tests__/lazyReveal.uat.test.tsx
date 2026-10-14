import { act, cleanup, configure, fireEvent, render, screen } from '@testing-library/react';
import { IEditorPanel, IEditorPanelFactoryParam, ResourceSystem, ShellSystem, UndoSystem } from '@motajs/editor-core';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tableDataResourceId, tablePanelType, tableSchemaResourceId, TablePanel } from '..';
import { FakeResourceInjection } from './fixtures';

configure({ testIdAttribute: 'data-test-id' });

/**
 * 受控 IntersectionObserver 桩：jsdom 无真实布局，用例经它手动触发「相交」，
 * 以在无观察器的环境里验证分组行的懒展开路径。
 */
class ControlledIntersectionObserver implements IntersectionObserver {
  /** 当前存活的桩实例（用例经它触发相交） */
  static readonly instances: ControlledIntersectionObserver[] = [];

  /** 观察器根（默认视口） */
  readonly root: Element | Document | null = null;

  /** 根外边距（默认 0） */
  readonly rootMargin: string = '0px';

  /** 滚动外边距（默认 0） */
  readonly scrollMargin: string = '0px';

  /** 相交阈值（默认 0） */
  readonly thresholds: ReadonlyArray<number> = [0];

  /** 已观察的目标元素 */
  readonly targets: Element[] = [];

  /** 是否已被断开 */
  disconnected = false;

  /** 相交回调 */
  private readonly callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    ControlledIntersectionObserver.instances.push(this);
  }

  observe(target: Element): void {
    this.targets.push(target);
  }

  unobserve(target: Element): void {
    const index = this.targets.indexOf(target);

    if (index !== -1) this.targets.splice(index, 1);
  }

  disconnect(): void {
    this.disconnected = true;
    this.targets.length = 0;
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  // 清空实例表，让每条用例从干净的观察器状态开始
  static reset(): void {
    ControlledIntersectionObserver.instances.length = 0;
  }

  // 触发所有已观察实例的相交回调，模拟目标进入 / 离开视野
  static triggerAll(isIntersecting: boolean): void {
    for (const instance of ControlledIntersectionObserver.instances) {
      const target = instance.targets[0];

      if (target === undefined) continue;

      const entry = { isIntersecting, target } as IntersectionObserverEntry;

      instance.callback([entry], instance);
    }
  }
}

interface TestSystem {
  /** 外壳系统 */
  readonly shellSystem: ShellSystem;
  /** 资源系统 */
  readonly resourceSystem: ResourceSystem;
  /** 撤销系统 */
  readonly undoSystem: UndoSystem;
  /** 内存资源后端 */
  readonly injection: FakeResourceInjection;
}

// 每条用例前装上受控观察器，让分组行走「观察 → 相交才展开」的路径
beforeEach(() => {
  ControlledIntersectionObserver.reset();
  vi.stubGlobal('IntersectionObserver', ControlledIntersectionObserver);
});

// 每条用例后卸载已挂载组件并还原全局观察器
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// 组装一套已初始化的外壳 / 资源 / 撤销系统与内存后端
async function createSystem(): Promise<TestSystem> {
  const injection = new FakeResourceInjection();
  const resourceSystem = new ResourceSystem();
  await resourceSystem.initialize(injection);
  const undoSystem = new UndoSystem();
  await undoSystem.initialize({ maxUndoStep: 100 });
  const shellSystem = new ShellSystem(undoSystem, resourceSystem);
  await shellSystem.initialize();
  return { shellSystem, resourceSystem, undoSystem, injection };
}

// 在空白标签页打开表格面板并返回其实例
async function openPanel(system: TestSystem): Promise<TablePanel> {
  const created: TablePanel[] = [];

  system.shellSystem.registerPanelType({
    id: tablePanelType.id,
    name: tablePanelType.name,
    icon: tablePanelType.icon,
    create: (param: IEditorPanelFactoryParam): IEditorPanel => {
      const panel = new TablePanel(param);
      created.push(panel);
      return panel;
    },
  });

  const tabId = system.shellSystem.listTabs()[0].id;

  await system.shellSystem.openPanelInTab(tabId, tablePanelType.id);

  return created[0];
}

// 预置一张表的数据与 schema
function seed(system: TestSystem, name: string, data: unknown, schema: unknown): void {
  system.injection.seed(tableDataResourceId(name), data);
  system.injection.seed(tableSchemaResourceId(name), schema);
}

// 把面板目标指向数据表，并等待一次切入刷新完成
async function setTarget(panel: TablePanel, name: string): Promise<void> {
  panel.setTable({ data: tableDataResourceId(name), schema: tableSchemaResourceId(name) });
  await panel.onSwitchIn();
}

// 一张带嵌套 object 的样例表
function nestedTable(): { readonly data: unknown; readonly schema: unknown } {
  return {
    data: { nested: { inner: 'deep' } },
    schema: {
      type: 'object',
      properties: {
        nested: { type: 'object', properties: { inner: { type: 'string' } } },
      },
    },
  };
}

// 读取表体内某 data-test-id 的行元素
function row(container: HTMLElement, testId: string): Element | null {
  return container.querySelector(`[data-test-id="${testId}"]`);
}

describe('分组行懒展开（P29）', () => {
  // 受控观察器下分组行默认折叠：子行不挂载
  it('分组行默认折叠，子行不挂载', async () => {
    const system = await createSystem();
    const sample = nestedTable();

    seed(system, 'fold', sample.data, sample.schema);
    const panel = await openPanel(system);

    await setTarget(panel, 'fold');
    const { container } = render(createElement(system.shellSystem.render()));

    expect(screen.getByTestId('gap-toggle-nested').getAttribute('aria-expanded')).toBe('false');
    expect(row(container, 'table-row-nested-inner')).toBeNull();
  });

  // 分组行首次进入视野即自动展开：触发相交后子行出现
  it('分组行首次可见即自动展开', async () => {
    const system = await createSystem();
    const sample = nestedTable();

    seed(system, 'fold', sample.data, sample.schema);
    const panel = await openPanel(system);

    await setTarget(panel, 'fold');
    const { container } = render(createElement(system.shellSystem.render()));

    expect(row(container, 'table-row-nested-inner')).toBeNull();

    await act(async () => {
      ControlledIntersectionObserver.triggerAll(true);
    });

    expect(row(container, 'table-row-nested-inner')).not.toBeNull();
    expect(screen.getByTestId('gap-toggle-nested').getAttribute('aria-expanded')).toBe('true');
  });

  // 用户点击折叠后接管：再次相交不再自动展开
  it('用户点击折叠后不再被自动展开', async () => {
    const system = await createSystem();
    const sample = nestedTable();

    seed(system, 'fold', sample.data, sample.schema);
    const panel = await openPanel(system);

    await setTarget(panel, 'fold');
    const { container } = render(createElement(system.shellSystem.render()));

    await act(async () => {
      ControlledIntersectionObserver.triggerAll(true);
    });

    expect(row(container, 'table-row-nested-inner')).not.toBeNull();

    const groupName = container.querySelector('.etable-group-name');

    if (groupName === null) throw new Error('分组行条目名缺失');

    await act(async () => {
      fireEvent.click(groupName);
    });

    expect(row(container, 'table-row-nested-inner')).toBeNull();

    await act(async () => {
      ControlledIntersectionObserver.triggerAll(true);
    });

    expect(row(container, 'table-row-nested-inner')).toBeNull();
  });

  // 无 IntersectionObserver 时退化为立即展开，内容不永久隐藏
  it('无 IntersectionObserver 时立即展开（退化）', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);

    const system = await createSystem();
    const sample = nestedTable();

    seed(system, 'fold', sample.data, sample.schema);
    const panel = await openPanel(system);

    await setTarget(panel, 'fold');
    const { container } = render(createElement(system.shellSystem.render()));

    expect(row(container, 'table-row-nested-inner')).not.toBeNull();
    expect(screen.getByTestId('gap-toggle-nested').getAttribute('aria-expanded')).toBe('true');
  });

  // 首次相交后观察器即断开，避免观察器累积 / 泄漏
  it('首次相交后观察器断开', async () => {
    const system = await createSystem();
    const sample = nestedTable();

    seed(system, 'fold', sample.data, sample.schema);
    const panel = await openPanel(system);

    await setTarget(panel, 'fold');
    render(createElement(system.shellSystem.render()));

    const observer = ControlledIntersectionObserver.instances[0];

    expect(observer.disconnected).toBe(false);

    await act(async () => {
      ControlledIntersectionObserver.triggerAll(true);
    });

    expect(observer.disconnected).toBe(true);
  });
});
