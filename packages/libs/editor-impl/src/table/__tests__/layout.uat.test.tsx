import { act, cleanup, configure, render } from '@testing-library/react';
import { IEditorPanel, IEditorPanelFactoryParam, ResourceSystem, ShellSystem, UndoSystem } from '@motajs/editor-core';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tableDataResourceId, tablePanelType, tableSchemaResourceId, TablePanel } from '..';
import { FakeResourceInjection } from './fixtures';

configure({ testIdAttribute: 'data-test-id' });

// 用例开始前的原始窗口宽度，供 afterEach 复位
const ORIGINAL_INNER_WIDTH = window.innerWidth;

// 在 jsdom 下按窗口宽度驱动栏数：改写 window.innerWidth，视图据此计算可视栏数
function setWindowWidth(value: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value });
}

// 每个用例前把窗口宽度复位为足够宽的值，使缺省渲染铺出多栏
beforeEach(() => {
  setWindowWidth(1000);
});

interface TestSystem {
  /** 外壳系统 */
  readonly shellSystem: ShellSystem;
  /** 资源系统 */
  readonly resourceSystem: ResourceSystem;
  /** 内存资源后端 */
  readonly injection: FakeResourceInjection;
}

// 每个用例结束后卸载已挂载的组件并复位窗口宽度，避免状态在用例之间累积
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
  return { shellSystem, resourceSystem, injection };
}

// 预置一张带扁平字符串字段的表格及其 schema
function seedSampleTable(system: TestSystem, name: string): void {
  system.injection.seed(tableDataResourceId(name), { name: 'hello' });
  system.injection.seed(tableSchemaResourceId(name), {
    type: 'object',
    properties: { name: { type: 'string', description: '名字' } },
  });
}

// 注册一个捕获实例的面板类型，在空白标签页打开面板并返回实例
async function openTablePanel(system: TestSystem, panels: TablePanel[]): Promise<TablePanel> {
  system.shellSystem.registerPanelType({
    id: tablePanelType.id,
    name: tablePanelType.name,
    icon: tablePanelType.icon,
    create: (param: IEditorPanelFactoryParam): IEditorPanel => {
      const panel = new TablePanel(param);
      panels.push(panel);
      return panel;
    },
  });

  const tabId = system.shellSystem.listTabs()[0].id;

  await act(async () => {
    await system.shellSystem.openPanelInTab(tabId, tablePanelType.id);
  });

  return panels[0];
}

// 把面板目标指向给定表名，并等待一次切入刷新完成
async function setTarget(panel: TablePanel, name: string): Promise<void> {
  panel.setTable({ data: tableDataResourceId(name), schema: tableSchemaResourceId(name) });
  await panel.onSwitchIn();
}

describe('面板标题与工具栏布局（L1）', () => {
  // 表格面板按实例给出标题「表格 table.demo」
  it('面板 getTitle 按实例返回「表格 table.demo」', async () => {
    const system = await createSystem();

    seedSampleTable(system, 'demo');
    const panels: TablePanel[] = [];
    const panel = await openTablePanel(system, panels);

    await setTarget(panel, 'demo');

    expect(panel.getTitle()).toBe('表格 table.demo');
  });

  // 工具栏中表名节点位于「编辑 Schema」按钮之前，二者之间还有一条竖分隔线
  it('工具栏表名位于按钮左侧且带竖分隔线', async () => {
    const system = await createSystem();

    seedSampleTable(system, 'demo');
    const panels: TablePanel[] = [];
    const panel = await openTablePanel(system, panels);

    await setTarget(panel, 'demo');
    const { container } = render(createElement(system.shellSystem.render()));

    const title = container.querySelector('.etable-toolbar-title');
    const divider = container.querySelector('.etable-toolbar-divider');
    const schemaButton = container.querySelector('[data-test-id="table-edit-schema"]');

    if (title === null || divider === null || schemaButton === null) throw new Error('工具栏节点缺失');

    expect(title.compareDocumentPosition(schemaButton) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(divider.compareDocumentPosition(schemaButton) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(title.compareDocumentPosition(divider) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  });
});

describe('多栏布局（L4 结构）', () => {
  // 窗口宽度 / 每栏宽度决定栏数：floor(1000 / 400) = floor(1000 / 500) = 2 栏
  it('按窗口宽度铺出 floor(innerWidth / columnWidth) 栏', async () => {
    const system = await createSystem();

    seedSampleTable(system, 'demo');
    const panels: TablePanel[] = [];
    const panel = await openTablePanel(system, panels);

    await setTarget(panel, 'demo');
    setWindowWidth(1000);

    const { container } = render(createElement(system.shellSystem.render()));

    expect(container.querySelectorAll('.etable-column').length).toBe(2);
  });

  // 窗口宽度为 0 时保底渲染 1 栏
  it('窗口宽度为 0 时保底 1 栏', async () => {
    const system = await createSystem();

    seedSampleTable(system, 'demo');
    const panels: TablePanel[] = [];
    const panel = await openTablePanel(system, panels);

    await setTarget(panel, 'demo');
    setWindowWidth(0);

    const { container } = render(createElement(system.shellSystem.render()));

    expect(container.querySelectorAll('.etable-column').length).toBe(1);
  });

  // 缺省只有第 0 栏有目标：仅第 0 栏渲染 schema 驱动行，其余栏显示未设目标空态
  it('缺省只有第 0 栏有目标，其余栏为空态', async () => {
    const system = await createSystem();

    seedSampleTable(system, 'demo');
    const panels: TablePanel[] = [];
    const panel = await openTablePanel(system, panels);

    await setTarget(panel, 'demo');
    setWindowWidth(1000);

    const { container } = render(createElement(system.shellSystem.render()));

    const columns = container.querySelectorAll('.etable-column');

    expect(columns.length).toBe(2);
    expect(columns[0].querySelector('[data-test-id="table-row-name"]')).not.toBeNull();
    expect(columns[1].textContent).toContain('尚未设置目标表');
  });

  // 窗口宽度 1000、栏宽缺省时各栏等分：flex 值一致且不再使用固定像素宽度（末栏不再偏宽）
  it('各栏等分且不再使用固定像素宽度', async () => {
    const system = await createSystem();

    seedSampleTable(system, 'demo');
    const panels: TablePanel[] = [];
    const panel = await openTablePanel(system, panels);

    await setTarget(panel, 'demo');
    setWindowWidth(1000);

    const { container } = render(createElement(system.shellSystem.render()));

    const columns = Array.from(container.querySelectorAll<HTMLElement>('.etable-column'));

    expect(columns.length).toBe(2);
    expect(new Set(columns.map((column) => column.style.flexGrow)).size).toBe(1);
    expect(columns.every((column) => column.style.width === '')).toBe(true);
  });

  // 窗口宽度小于两倍栏宽时只铺 1 栏，且多栏容器不出现横向滚动条
  it('窄窗只铺 1 栏且不出现横向滚动条', async () => {
    const system = await createSystem();

    seedSampleTable(system, 'demo');
    const panels: TablePanel[] = [];
    const panel = await openTablePanel(system, panels);

    await setTarget(panel, 'demo');
    setWindowWidth(600);

    const { container } = render(createElement(system.shellSystem.render()));

    expect(container.querySelectorAll('.etable-column').length).toBe(1);

    const columns = container.querySelector('.etable-columns');

    if (columns === null) throw new Error('多栏容器缺失');

    expect(['auto', 'scroll']).not.toContain(getComputedStyle(columns).overflowX);
  });
});

describe('「编辑 Schema」复用空栏（P1）', () => {
  // 宽窗只剩空栏时，不调用打开器，直接把 schema 放进第 1 栏
  it('有空栏时「编辑 Schema」复用空栏而不新开面板', async () => {
    const system = await createSystem();

    seedSampleTable(system, 'demo');
    const panels: TablePanel[] = [];
    const panel = await openTablePanel(system, panels);

    await setTarget(panel, 'demo');
    setWindowWidth(1000);

    const { container } = render(createElement(system.shellSystem.render()));
    const opener = { open: vi.fn(async (): Promise<void> => {}) };

    await act(async () => {
      await panel.openSchemaPanel(opener);
      await panel.onSwitchIn();
    });

    expect(opener.open).not.toHaveBeenCalled();

    const columns = container.querySelectorAll('.etable-column');

    expect(columns.length).toBe(2);
    expect(columns[1].querySelector('[data-test-id="schema-banner"]')).not.toBeNull();
  });

  // 窄窗只有 1 栏且已设目标时，无空栏，经打开器新开面板
  it('窄窗无空栏时「编辑 Schema」经打开器新开面板', async () => {
    const system = await createSystem();

    seedSampleTable(system, 'demo');
    const panels: TablePanel[] = [];
    const panel = await openTablePanel(system, panels);

    await setTarget(panel, 'demo');
    setWindowWidth(400);

    render(createElement(system.shellSystem.render()));
    const opener = { open: vi.fn(async (): Promise<void> => {}) };

    await act(async () => {
      await panel.openSchemaPanel(opener);
    });

    expect(opener.open).toHaveBeenCalledTimes(1);
  });
});

describe('栏内尺寸与输入控件（L4 细节）', () => {
  // 值文本域渲染为 antd Input.TextArea（.ant-input + .etable-input-textarea），而非裸 textarea
  it('值文本域使用 antd Input.TextArea', async () => {
    const system = await createSystem();

    seedSampleTable(system, 'demo');
    const panels: TablePanel[] = [];
    const panel = await openTablePanel(system, panels);

    await setTarget(panel, 'demo');
    const { container } = render(createElement(system.shellSystem.render()));

    const cell = container.querySelector('[data-test-id="table-input-name"]');
    const textarea = cell === null ? null : cell.querySelector('textarea');

    if (textarea === null) throw new Error('值文本域缺失');

    expect(textarea.classList.contains('ant-input')).toBe(true);
    expect(textarea.classList.contains('etable-input-textarea')).toBe(true);
  });

  // 表头四列类名保持 name / comment / value / action（对应 2:2:4:1 的四列）
  it('表头四列类名保持 name / comment / value / action', async () => {
    const system = await createSystem();

    seedSampleTable(system, 'demo');
    const panels: TablePanel[] = [];
    const panel = await openTablePanel(system, panels);

    await setTarget(panel, 'demo');
    const { container } = render(createElement(system.shellSystem.render()));

    const header = container.querySelector('.etable-header');
    const cells = header === null ? [] : header.querySelectorAll('.etable-cell');

    expect(cells.length).toBe(4);
    expect(cells[0].classList.contains('etable-cell-name')).toBe(true);
    expect(cells[1].classList.contains('etable-cell-comment')).toBe(true);
    expect(cells[2].classList.contains('etable-cell-value')).toBe(true);
    expect(cells[3].classList.contains('etable-cell-action')).toBe(true);
  });
});
