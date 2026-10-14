import { act, cleanup, configure, render } from '@testing-library/react';
import { IEditorPanel, IEditorPanelFactoryParam, ResourceSystem, ShellSystem, UndoSystem } from '@motajs/editor-core';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tableDataResourceId, tablePanelType, tableSchemaResourceId, TablePanel, ITablePanelTarget } from '..';
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

// 每个用例前把窗口宽度复位为足够宽的值，使缺省渲染能铺出多栏
beforeEach(() => {
  setWindowWidth(1000);
});

// 每个用例结束后卸载已挂载组件、复位窗口宽度并还原被替换的读取方法
afterEach(() => {
  cleanup();
  setWindowWidth(ORIGINAL_INNER_WIDTH);
  vi.restoreAllMocks();
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

// schema 表目标：数据与 schema 资源都指向 `table#schema.<名>`
function schemaTarget(name: string): ITablePanelTarget {
  return { data: tableSchemaResourceId(name), schema: tableSchemaResourceId(name) };
}

// 让已排队的资源读取 / 重算微任务全部落定，再冲刷 React 更新（写盘后的同面板刷新是即发即忘的）
async function flush(): Promise<void> {
  await act(async (): Promise<void> => {
    await new Promise<unknown>((resolve): void => {
      setTimeout(resolve, 0);
    });
  });
}

// 按渲染顺序取第 index 栏的容器
function columnAt(container: HTMLElement, index: number): HTMLElement {
  const columns = container.querySelectorAll<HTMLElement>('.etable-column');
  const column = columns[index];

  if (column === undefined) throw new Error(`栏 ${index} 缺失`);

  return column;
}

// 读取某栏内某下拉单元格当前选中的显示文本
function selectText(column: HTMLElement, testId: string): string | null {
  const cell = column.querySelector(`[data-test-id="${testId}"]`);
  const value = cell === null ? null : cell.querySelector('.ant-select-content-value');

  return value === null ? null : value.textContent;
}

describe('同面板依赖栏即时同步（P18 / P20）', () => {
  // 同一面板内改 schema 后，另一 schema 栏与主数据表都立即跟随，不再需要切入 / focus
  it('改 schema 后同面板的其它 schema 栏与主数据表立即同步', async () => {
    const system = await createSystem();

    seed(system, 't', { a: '1' }, { type: 'object', properties: { a: { type: 'string' } } });
    const panel = await openPanel(system);

    panel.setTable(dataTarget('t'), 0);
    panel.setTable(schemaTarget('t'), 1);
    panel.setTable(schemaTarget('t'), 2);
    await panel.onSwitchIn();

    setWindowWidth(1500);

    const { container } = render(createElement(system.shellSystem.render()));

    expect(selectText(columnAt(container, 2), 'table-input-properties-a-type')).toBe('string');
    expect(columnAt(container, 0).querySelector('[data-test-id="table-input-a"] textarea')).not.toBeNull();

    await act(async () => {
      await panel.commitValue("['properties']['a']['type']", 'number', 1);
    });
    await flush();

    expect(selectText(columnAt(container, 2), 'table-input-properties-a-type')).toBe('number');
    expect(columnAt(container, 0).querySelector('[data-test-id="table-input-a"] .ant-input-number')).not.toBeNull();
  });

  // 写盘只刷新引用被写资源的栏：引用其它表的栏不被这次写盘触发重读
  it('写盘不刷新引用其它表的栏', async () => {
    const system = await createSystem();

    seed(system, 't', { a: '1' }, { type: 'object', properties: { a: { type: 'string' } } });
    seed(system, 'other', { b: 'x' }, { type: 'object', properties: { b: { type: 'string' } } });
    const panel = await openPanel(system);

    panel.setTable(dataTarget('t'), 0);
    panel.setTable(schemaTarget('t'), 1);
    panel.setTable(dataTarget('other'), 2);
    await panel.onSwitchIn();

    setWindowWidth(1500);

    render(createElement(system.shellSystem.render()));

    const readSpy = vi.spyOn(system.resourceSystem, 'readContent');

    readSpy.mockClear();

    await act(async () => {
      await panel.commitValue("['properties']['a']['type']", 'number', 1);
    });
    await flush();

    const unrelatedReads = readSpy.mock.calls.filter(
      (call) => call[0].id === 'table.other' || call[0].id === 'table#schema.other',
    );
    const relatedReads = readSpy.mock.calls.filter((call) => call[0].id === 'table#schema.t');

    expect(unrelatedReads.length).toBe(0);
    expect(relatedReads.length).toBeGreaterThan(0);
  });
});
