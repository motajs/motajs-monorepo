import { act, cleanup, configure, fireEvent, render } from '@testing-library/react';
import { IEditorPanel, IEditorPanelFactoryParam, ResourceSystem, ShellSystem, UndoSystem } from '@motajs/editor-core';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ITablePanelTarget, tableDataResourceId, tablePanelType, tableSchemaResourceId, TablePanel } from '..';
import { FakeResourceInjection } from './fixtures';

configure({ testIdAttribute: 'data-test-id' });

// 用例开始前的原始窗口宽度，供 afterEach 复位
const ORIGINAL_INNER_WIDTH = window.innerWidth;

// 在 jsdom 下按窗口宽度驱动可视栏数：改写 window.innerWidth，视图据此铺出多栏
function setWindowWidth(value: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value });
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

// 每个用例前把窗口宽度复位为足够宽的值，使渲染能铺出两栏
beforeEach(() => {
  setWindowWidth(1000);
});

// 每个用例结束后卸载已挂载组件并复位窗口宽度，避免状态在用例之间累积
afterEach(() => {
  cleanup();
  setWindowWidth(ORIGINAL_INNER_WIDTH);
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

// 数据表目标：数据资源指向 `table.<名>`、schema 资源指向 `table#schema.<名>`
function dataTarget(name: string): ITablePanelTarget {
  return { data: tableDataResourceId(name), schema: tableSchemaResourceId(name) };
}

// 按渲染顺序取第 index 栏的容器
function columnAt(container: HTMLElement, index: number): HTMLElement {
  const columns = container.querySelectorAll<HTMLElement>('.etable-column');
  const column = columns[index];

  if (column === undefined) throw new Error(`栏 ${index} 缺失`);

  return column;
}

describe('每栏关闭按钮（P15）', () => {
  // ✕ 渲染在「在代码编辑器中打开」右侧
  it('✕ 位于「在代码编辑器中打开」右侧', async () => {
    const system = await createSystem();

    seed(system, 'demo', { name: 'hello' }, { type: 'object', properties: { name: { type: 'string' } } });
    const panel = await openPanel(system);

    panel.setTable(dataTarget('demo'), 0);
    await panel.onSwitchIn();
    setWindowWidth(1000);

    const { container } = render(createElement(system.shellSystem.render()));
    const column = columnAt(container, 0);
    const close = column.querySelector('[data-test-id="table-close-column"]');
    const open = column.querySelector('[data-test-id="table-open-code"]');

    if (close === null || open === null) throw new Error('工具栏按钮缺失');

    expect(open.compareDocumentPosition(close) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  });

  // 有目标栏的 ✕ 可点；点后本栏回到「尚未设置目标表」空态
  it('有目标栏的 ✕ 可点，点后本栏回到未设目标态', async () => {
    const system = await createSystem();

    seed(system, 'demo', { name: 'hello' }, { type: 'object', properties: { name: { type: 'string' } } });
    const panel = await openPanel(system);

    panel.setTable(dataTarget('demo'), 0);
    await panel.onSwitchIn();
    setWindowWidth(1000);

    const { container } = render(createElement(system.shellSystem.render()));
    const column = columnAt(container, 0);
    const close = column.querySelector('[data-test-id="table-close-column"]');

    if (close === null) throw new Error('✕ 缺失');

    expect(close.getAttribute('disabled')).toBeNull();
    expect(column.querySelector('[data-test-id="table-row-name"]')).not.toBeNull();

    await act(async () => {
      fireEvent.click(close);
    });

    expect(column.textContent).toContain('尚未设置目标表');
    expect(column.querySelector('[data-test-id="table-row-name"]')).toBeNull();
  });

  // 本栏没有打开任何表时 ✕ 禁用
  it('空栏的 ✕ 禁用，有目标栏的 ✕ 可点', async () => {
    const system = await createSystem();

    seed(system, 'demo', { name: 'hello' }, { type: 'object', properties: { name: { type: 'string' } } });
    const panel = await openPanel(system);

    panel.setTable(dataTarget('demo'), 0);
    await panel.onSwitchIn();
    setWindowWidth(1000);

    const { container } = render(createElement(system.shellSystem.render()));
    const emptyClose = columnAt(container, 1).querySelector('[data-test-id="table-close-column"]');
    const readyClose = columnAt(container, 0).querySelector('[data-test-id="table-close-column"]');

    if (emptyClose === null || readyClose === null) throw new Error('✕ 缺失');

    expect(emptyClose.getAttribute('disabled')).not.toBeNull();
    expect(readyClose.getAttribute('disabled')).toBeNull();
  });

  // 两栏都有表时关第 0 栏，只影响本栏，第 1 栏内容不变
  it('关闭只影响本栏，其它栏保持不变', async () => {
    const system = await createSystem();

    seed(system, 'demo', { name: 'hello' }, { type: 'object', properties: { name: { type: 'string' } } });
    seed(system, 'other', { b: 'x' }, { type: 'object', properties: { b: { type: 'string' } } });
    const panel = await openPanel(system);

    panel.setTable(dataTarget('demo'), 0);
    panel.setTable(dataTarget('other'), 1);
    await panel.onSwitchIn();
    setWindowWidth(1000);

    const { container } = render(createElement(system.shellSystem.render()));
    const close = columnAt(container, 0).querySelector('[data-test-id="table-close-column"]');

    if (close === null) throw new Error('✕ 缺失');

    await act(async () => {
      fireEvent.click(close);
    });

    expect(columnAt(container, 0).textContent).toContain('尚未设置目标表');
    expect(columnAt(container, 1).querySelector('[data-test-id="table-row-b"]')).not.toBeNull();
  });
});
