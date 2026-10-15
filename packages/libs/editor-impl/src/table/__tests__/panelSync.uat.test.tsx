import { act, cleanup, configure, render } from '@testing-library/react';
import { EditorCore, IEditorPanel, IEditorPanelFactoryParam } from '@motajs/editor-core';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deriveSchemaPath, ITablePanelTarget, tablePanelType, TablePanel } from '..';
import { ICodeEditorOpener } from '../../react';
import { createTableHarness, FakeFileSystem } from './fixtures';

configure({ testIdAttribute: 'data-test-id' });

// 用例开始前的原始窗口宽度，供 afterEach 复位
const ORIGINAL_INNER_WIDTH = window.innerWidth;

// 在 jsdom 下按窗口宽度驱动可视栏数：改写 window.innerWidth，视图据此铺出多栏
function setWindowWidth(value: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value });
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

// 读取某个路径的当前内容（面板以文本写回，读取后解析）
async function readContent(system: EditorCore, path: string): Promise<unknown> {
  const text = await system.resourceSystem.readContent(path);

  if (typeof text !== 'string') return undefined;

  return JSON.parse(text);
}

// 数据表目标：数据文件路径按 `xxx.json` 约定
function dataTarget(name: string): ITablePanelTarget {
  return { dataPath: tableDataPath(name) };
}

// schema 表目标：数据路径指向 `xxx.schema.json` 的 schema 视图
function schemaTarget(name: string): ITablePanelTarget {
  return { dataPath: tableSchemaPath(name) };
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
    const fs = new FakeFileSystem();

    seed(fs, 't', { a: '1' }, { type: 'object', properties: { a: { type: 'string' } } });
    const system = await createTableHarness(fs);
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
    const fs = new FakeFileSystem();

    seed(fs, 't', { a: '1' }, { type: 'object', properties: { a: { type: 'string' } } });
    seed(fs, 'other', { b: 'x' }, { type: 'object', properties: { b: { type: 'string' } } });
    const system = await createTableHarness(fs);
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
      (call) => call[0] === tableDataPath('other') || call[0] === tableSchemaPath('other'),
    );
    const relatedReads = readSpy.mock.calls.filter((call) => call[0] === tableSchemaPath('t'));

    expect(unrelatedReads.length).toBe(0);
    expect(relatedReads.length).toBeGreaterThan(0);
  });
});

describe('代码编辑器写回与撤销 / 重做也走同面板同步（P18 / P20）', () => {
  // 代码编辑器整份写回 schema 后，同面板其它 schema 栏与主数据表立即同步
  it('代码编辑器写回 schema 后同面板其它栏立即同步', async () => {
    const fs = new FakeFileSystem();

    seed(fs, 't', { a: '1' }, { type: 'object', properties: { a: { type: 'string' } } });
    const system = await createTableHarness(fs);
    const panel = await openPanel(system);

    panel.setTable(dataTarget('t'), 0);
    panel.setTable(schemaTarget('t'), 1);
    panel.setTable(schemaTarget('t'), 2);
    await panel.onSwitchIn();

    setWindowWidth(1500);

    const { container } = render(createElement(system.shellSystem.render()));
    const codeEditor: ICodeEditorOpener = {
      open: vi.fn(async (): Promise<string | null> =>
        JSON.stringify({ type: 'object', properties: { a: { type: 'number' } } }),
      ),
    };

    await act(async () => {
      await panel.openCurrentViewInCodeEditor(codeEditor, 1);
    });
    await flush();

    expect(selectText(columnAt(container, 2), 'table-input-properties-a-type')).toBe('number');
    expect(columnAt(container, 0).querySelector('[data-test-id="table-input-a"] .ant-input-number')).not.toBeNull();
  });

  // 数据栏新增（写 schema 的 x-order）后撤销，同面板 schema 栏与数据栏都回到撤销后的状态
  it('撤销新增后同面板 schema 栏与数据栏都同步回退', async () => {
    const fs = new FakeFileSystem();

    seed(fs, 't', { a: '1' }, { type: 'object', properties: { a: { type: 'string' } } });
    const system = await createTableHarness(fs);
    const panel = await openPanel(system);

    panel.setTable(dataTarget('t'), 0);
    panel.setTable(schemaTarget('t'), 1);
    await panel.onSwitchIn();

    setWindowWidth(1000);

    const { container } = render(createElement(system.shellSystem.render()));

    await act(async () => {
      await panel.addItem("['a']", 'mid', 0);
    });
    await flush();

    expect(await readContent(system, tableDataPath('t'))).toEqual({ a: '1', mid: null });
    expect(columnAt(container, 0).querySelector('[data-test-id="table-row-mid"]')).not.toBeNull();
    expect(columnAt(container, 1).querySelector('[data-test-id="table-row-x-order"]')).not.toBeNull();

    await act(async () => {
      await system.undoSystem.undo();
    });
    await flush();

    expect(columnAt(container, 0).querySelector('[data-test-id="table-row-mid"]')).toBeNull();
    expect(columnAt(container, 1).querySelector('[data-test-id="table-row-x-order"]')).toBeNull();
  });
});
