import { act, cleanup, configure, render, screen } from '@testing-library/react';
import { EditorCore, IEditorPanel, IEditorPanelFactoryParam } from '@motajs/editor-core';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deriveSchemaPath, ITablePanelTarget, tablePanelType, TablePanel } from '..';
import { ICodeEditorOpener } from '../../react';
import { createTableHarness, FakeFileSystem } from './fixtures';

configure({ testIdAttribute: 'data-test-id' });

// 一栏一条路径：同一个表格面板内不许两栏指向同一个数据文件，另一个标签已经持有这条路径时本栏不改目标。
// 这里钉住两种落点——同面板另一栏持有则让那一栏闪一下边框，另一个标签持有则切到那个标签；以及仍然
// 合法的「数据栏 + 它的 schema 栏」组合里的联动刷新与兄弟 schema 栏写盘不被记成外部冲突。

// 用例开始前的原始窗口宽度，供 afterEach 复位
const ORIGINAL_INNER_WIDTH = window.innerWidth;

// 在 jsdom 下按窗口宽度驱动可视栏数：改写 window.innerWidth，视图据此铺出多栏
function setWindowWidth(value: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value });
}

// 每个用例前把窗口宽度复位为足够宽的值，使缺省渲染能铺出两栏
beforeEach(() => {
  setWindowWidth(1000);
});

// 每个用例结束后卸载已挂载组件、恢复真定时器与替身并复位窗口宽度
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
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

// 数据表目标：数据文件路径按 `xxx.json` 约定
function dataTarget(name: string): ITablePanelTarget {
  return { dataPath: tableDataPath(name) };
}

// schema 表目标：数据路径指向 `xxx.schema.json` 的 schema 视图
function schemaTarget(name: string): ITablePanelTarget {
  return { dataPath: tableSchemaPath(name) };
}

// 以文本预置一张表的数据与 schema
function seed(fs: FakeFileSystem, name: string, data: unknown, schema: unknown): void {
  fs.seed(tableDataPath(name), JSON.stringify(data));
  fs.seed(tableSchemaPath(name), JSON.stringify(schema));
}

/**
 * 装配一个已初始化的编辑器核心，并注册一个捕获表格面板实例的类型
 * @param fs 内存文件系统替身
 * @returns 编辑器核心与按创建顺序收集的面板实例
 */
async function createTableSystem(fs: FakeFileSystem): Promise<{ system: EditorCore; created: TablePanel[] }> {
  const system = await createTableHarness(fs);
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

  return { system, created };
}

/**
 * 在首个标签页打开表格面板并返回其实例
 * @param system 编辑器核心
 * @param created 面板实例收集数组
 * @returns 首个表格面板实例
 */
async function openTablePanel(system: EditorCore, created: TablePanel[]): Promise<TablePanel> {
  const tabId = system.shellSystem.listTabs()[0].id;

  await act(async (): Promise<void> => {
    await system.shellSystem.openPanelInTab(tabId, tablePanelType.id);
  });

  return created[0];
}

// 让已排队的资源读取与外壳切换微任务全部落定，再冲刷 React 更新
async function flush(): Promise<void> {
  await act(async (): Promise<void> => {
    await new Promise<unknown>((resolve): void => {
      setTimeout(resolve, 0);
    });
  });
}

// 推进假定时器并冲刷一次 React 更新：合并通知与闪烁消失都是定时器驱动的
async function advance(milliseconds: number): Promise<void> {
  await act(async (): Promise<void> => {
    await vi.advanceTimersByTimeAsync(milliseconds);
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

// 读取某路径在裸磁盘上的解析值：不经缓冲，用来证明写盘确实发生
async function readDisk(fs: FakeFileSystem, path: string): Promise<unknown> {
  return JSON.parse(await fs.readFile(path));
}

describe('另一个标签已持有该路径（D-28）', () => {
  // 标签 B 想打开标签 A 已经持有的文件：B 的目标保持不变，外壳切回 A，文件没有被写盘
  it('本栏不改目标、切到持有者标签、不写盘', async () => {
    const fs = new FakeFileSystem();

    seed(fs, 'a', { value: '1' }, { type: 'object', properties: { value: { type: 'string' } } });

    const seedText = await fs.readFile(tableDataPath('a'));
    const { system, created } = await createTableSystem(fs);

    const firstTab = system.shellSystem.listTabs()[0].id;

    await act(async () => {
      await system.shellSystem.openPanelInTab(firstTab, tablePanelType.id, undefined, tableDataPath('a'));
    });

    created[0].setTable(dataTarget('a'), 0);
    await flush();

    const secondTab = system.shellSystem.openBlankTab();

    await act(async () => {
      await system.shellSystem.openPanelInTab(secondTab, tablePanelType.id);
    });

    await act(async () => {
      await system.shellSystem.activateTab(secondTab);
    });

    const { container } = render(createElement(system.shellSystem.render()));

    await act(async () => {
      created[1].setTable(dataTarget('a'), 0);
    });
    await flush();

    expect(created[1]['columns'][0].target).toBeNull();

    const activeTabs = container.querySelectorAll('.editor-shell-tab.is-active');

    expect(activeTabs.length).toBe(1);
    expect(container.querySelector('.editor-shell-content')?.textContent).toContain('value');
    expect(await fs.readFile(tableDataPath('a'))).toBe(seedText);
  });
});

describe('同一个面板内一栏一条路径（D-28 / D-29）', () => {
  // 第 1 栏选到第 0 栏已持有的路径：第 1 栏仍是空栏，第 0 栏闪 600 毫秒后自动消失，无弹窗与提示
  it('选到同面板另一栏持有的路径：本栏不改目标、持有栏闪 600 毫秒后消失', async () => {
    const fs = new FakeFileSystem();

    seed(fs, 't', { a: '1' }, { type: 'object', properties: { a: { type: 'string' } } });
    const { system, created } = await createTableSystem(fs);
    const panel = await openTablePanel(system, created);

    panel.setTable(dataTarget('t'), 0);
    await panel.onSwitchIn();

    const { container } = render(createElement(system.shellSystem.render()));

    vi.useFakeTimers();

    await act(async () => {
      panel.setTable(dataTarget('t'), 1);
    });

    expect(panel['columns'][1].target).toBeNull();
    expect(panel['columns'][0].target?.dataPath).toBe(tableDataPath('t'));

    const owner = columnAt(container, 0);

    expect(owner.getAttribute('data-test-id')).toBe('table-column-duplicate-flash');
    expect(owner.classList.contains('etable-column-duplicate-flash')).toBe(true);
    expect(columnAt(container, 1).querySelector('[data-test-id="table-empty-open"]')).not.toBeNull();
    expect(columnAt(container, 1).querySelector('[data-test-id^="table-row-"]')).toBeNull();
    expect(screen.queryByTestId('panel-conflict-dialog')).toBeNull();
    expect(columnAt(container, 0).querySelector('[data-test-id="table-notice"]')?.textContent ?? '').toBe('');

    await advance(600);

    expect(columnAt(container, 0).getAttribute('data-test-id')).not.toBe('table-column-duplicate-flash');
    expect(columnAt(container, 0).classList.contains('etable-column-duplicate-flash')).toBe(false);
  });

  // 同一栏重新选自己已经拿着的路径：查重跳过本栏自己，照旧走换目标 / 刷新
  it('同一栏重复选自己已持有的路径不被拒绝，照旧刷新', async () => {
    const fs = new FakeFileSystem();

    seed(fs, 't', { a: '1' }, { type: 'object', properties: { a: { type: 'string' } } });
    const { system, created } = await createTableSystem(fs);
    const panel = await openTablePanel(system, created);

    panel.setTable(dataTarget('t'), 0);
    await panel.onSwitchIn();

    const { container } = render(createElement(system.shellSystem.render()));

    await flush();

    const readSpy = vi.spyOn(system.resourceSystem, 'readContent');

    readSpy.mockClear();

    await act(async () => {
      panel.setTable(dataTarget('t'), 0);
    });
    await flush();

    expect(panel['columns'][0].target?.dataPath).toBe(tableDataPath('t'));
    expect(readSpy.mock.calls.some((call) => call[0] === tableDataPath('t'))).toBe(true);
    expect(columnAt(container, 0).getAttribute('data-test-id')).not.toBe('table-column-duplicate-flash');
    expect(columnAt(container, 0).querySelector('[data-test-id="table-row-a"]')).not.toBeNull();
  });

  // 两条不同路径照旧各占一栏；同一张表的 schema 路径与数据路径不是同一条，可以各自打开
  it('没人持有的路径与 schema 路径照旧打开', async () => {
    const fs = new FakeFileSystem();

    seed(fs, 't', { a: '1' }, { type: 'object', properties: { a: { type: 'string' } } });
    seed(fs, 'u', { b: 'x' }, { type: 'object', properties: { b: { type: 'string' } } });
    const { system, created } = await createTableSystem(fs);
    const panel = await openTablePanel(system, created);

    panel.setTable(dataTarget('t'), 0);
    panel.setTable(dataTarget('u'), 1);
    panel.setTable(schemaTarget('t'), 2);
    await panel.onSwitchIn();

    setWindowWidth(1600);

    const { container } = render(createElement(system.shellSystem.render()));

    expect(columnAt(container, 0).querySelector('[data-test-id="table-row-a"]')).not.toBeNull();
    expect(columnAt(container, 1).querySelector('[data-test-id="table-row-b"]')).not.toBeNull();
    expect(columnAt(container, 2).querySelector('[data-test-id="schema-banner"]')).not.toBeNull();
    expect(container.querySelector('[data-test-id="table-column-duplicate-flash"]')).toBeNull();
  });

  // 数据栏因代码编辑器写回而 unsaved 时，兄弟 schema 栏写盘不被记成外部冲突：不弹框、草稿保留、schema 写入被接受
  it('数据栏 unsaved 时兄弟 schema 栏写盘：不记外部冲突、草稿保留、schema 写入被接受', async () => {
    const fs = new FakeFileSystem();

    seed(fs, 't', { a: '1' }, { type: 'object', properties: { a: { type: 'string' } } });
    const { system, created } = await createTableSystem(fs);
    const panel = await openTablePanel(system, created);

    panel.setTable(dataTarget('t'), 0);
    panel.setTable(schemaTarget('t'), 1);
    await panel.onSwitchIn();

    const { container } = render(createElement(system.shellSystem.render()));

    const codeEditor: ICodeEditorOpener = {
      open: vi.fn(async (): Promise<string | null> => JSON.stringify({ a: '1', b: '2' })),
    };

    await act(async () => {
      await panel.openCurrentViewInCodeEditor(codeEditor, 0);
    });

    expect(panel['columns'][0].unsaved).toBe(true);
    expect(panel['columns'][0].data).toEqual({ a: '1', b: '2' });

    vi.useFakeTimers();

    await act(async () => {
      await panel.commitValue("['properties']['a']['type']", 'number', 1);
    });
    await act(async () => {
      await panel.save(1);
    });
    await advance(50);

    expect(panel['columns'][0].pendingConflict).toBeUndefined();
    expect(panel['columns'][0].unsaved).toBe(true);
    expect(panel['columns'][0].data).toEqual({ a: '1', b: '2' });
    expect(screen.queryByTestId('panel-conflict-dialog')).toBeNull();
    expect(selectText(columnAt(container, 1), 'table-input-properties-a-type')).toBe('number');
    expect(await readDisk(fs, tableSchemaPath('t'))).toEqual({
      type: 'object',
      properties: { a: { type: 'number' } },
    });
  });
});
