import { act, cleanup, configure, fireEvent, render } from '@testing-library/react';
import { EditorCore, IEditorPanel, IEditorPanelFactoryParam } from '@motajs/editor-core';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deriveSchemaPath, ITablePanelTarget, tablePanelType, TablePanel } from '..';
import { createTableHarness, FakeFileSystem } from './fixtures';

configure({ testIdAttribute: 'data-test-id' });

// 用例开始前的原始窗口宽度，供 afterEach 复位
const ORIGINAL_INNER_WIDTH = window.innerWidth;

// 在 jsdom 下按窗口宽度驱动可视栏数：改写 window.innerWidth，视图据此铺出多栏
function setWindowWidth(value: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value });
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

// 数据文件路径（`xxx.json`）
function tableDataPath(name: string): string {
  return `${name}.json`;
}

// schema 文件路径（按 `xxx.schema.json` 约定推导）
function tableSchemaPath(name: string): string {
  return deriveSchemaPath(tableDataPath(name));
}

// 在空白标签页打开表格面板并返回其实例
async function openPanel(system: EditorCore): Promise<TablePanel> {
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

// 以文本预置一张表的数据与 schema
function seed(fs: FakeFileSystem, name: string, data: unknown, schema: unknown): void {
  fs.seed(tableDataPath(name), JSON.stringify(data));
  fs.seed(tableSchemaPath(name), JSON.stringify(schema));
}

// 数据表目标：数据文件路径按 `xxx.json` 约定
function dataTarget(name: string): ITablePanelTarget {
  return { dataPath: tableDataPath(name) };
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
    const fs = new FakeFileSystem();

    seed(fs, 'demo', { name: 'hello' }, { type: 'object', properties: { name: { type: 'string' } } });
    const system = await createTableHarness(fs);
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

  // 有目标栏的 ✕ 可点；点后本栏回到空栏三按钮（空栏呈现改为内联控件，G-02.1-1）
  it('有目标栏的 ✕ 可点，点后本栏回到空栏三按钮', async () => {
    const fs = new FakeFileSystem();

    seed(fs, 'demo', { name: 'hello' }, { type: 'object', properties: { name: { type: 'string' } } });
    const system = await createTableHarness(fs);
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

    expect(column.querySelector('[data-test-id="table-empty-open"]')).not.toBeNull();
    expect(column.querySelector('[data-test-id="table-row-name"]')).toBeNull();
  });

  // 空栏呈现改为内联控件（G-02.1-1）：空栏不渲染表格工具栏 / ✕，改渲染空栏三按钮
  it('空栏不渲染 ✕，有目标栏的 ✕ 可点', async () => {
    const fs = new FakeFileSystem();

    seed(fs, 'demo', { name: 'hello' }, { type: 'object', properties: { name: { type: 'string' } } });
    const system = await createTableHarness(fs);
    const panel = await openPanel(system);

    panel.setTable(dataTarget('demo'), 0);
    await panel.onSwitchIn();
    setWindowWidth(1000);

    const { container } = render(createElement(system.shellSystem.render()));
    const emptyColumn = columnAt(container, 1);
    const readyColumn = columnAt(container, 0);
    const emptyClose = emptyColumn.querySelector('[data-test-id="table-close-column"]');
    const readyClose = readyColumn.querySelector('[data-test-id="table-close-column"]');

    expect(emptyClose).toBeNull();
    expect(emptyColumn.querySelector('[data-test-id="table-empty-open"]')).not.toBeNull();
    expect(emptyColumn.querySelector('[data-test-id="table-empty-create"]')).not.toBeNull();
    expect(emptyColumn.querySelector('[data-test-id="table-empty-delete"]')).not.toBeNull();

    if (readyClose === null) throw new Error('✕ 缺失');

    expect(readyClose.getAttribute('disabled')).toBeNull();
  });

  // 两栏都有表时关第 0 栏，只影响本栏，第 1 栏内容不变
  it('关闭只影响本栏，其它栏保持不变', async () => {
    const fs = new FakeFileSystem();

    seed(fs, 'demo', { name: 'hello' }, { type: 'object', properties: { name: { type: 'string' } } });
    seed(fs, 'other', { b: 'x' }, { type: 'object', properties: { b: { type: 'string' } } });
    const system = await createTableHarness(fs);
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

    expect(columnAt(container, 0).querySelector('[data-test-id="table-empty-open"]')).not.toBeNull();
    expect(columnAt(container, 1).querySelector('[data-test-id="table-row-b"]')).not.toBeNull();
  });
});

describe('关闭后空栏可被「编辑 Schema」复用（P15）', () => {
  // 两栏都有表、无空栏时；关掉第 1 栏后该空栏被「编辑 Schema」直接占用，不再经打开器新开面板
  it('关闭出来的空栏被「编辑 Schema」复用而非新开面板', async () => {
    const fs = new FakeFileSystem();

    seed(fs, 'demo', { a: '1' }, { type: 'object', properties: { a: { type: 'string' } } });
    const system = await createTableHarness(fs);
    const panel = await openPanel(system);

    panel.setTable(dataTarget('demo'), 0);
    panel.setTable(dataTarget('demo'), 1);
    await panel.onSwitchIn();
    setWindowWidth(1000);

    const { container } = render(createElement(system.shellSystem.render()));
    const close = columnAt(container, 1).querySelector('[data-test-id="table-close-column"]');

    if (close === null) throw new Error('✕ 缺失');

    await act(async () => {
      fireEvent.click(close);
    });

    expect(columnAt(container, 1).querySelector('[data-test-id="table-empty-open"]')).not.toBeNull();

    const opener = { open: vi.fn(async (): Promise<void> => {}) };

    await act(async () => {
      await panel.openSchemaPanel(opener);
      await panel.onSwitchIn();
    });

    expect(opener.open).not.toHaveBeenCalled();
    expect(columnAt(container, 1).querySelector('[data-test-id="schema-banner"]')).not.toBeNull();
  });
});
