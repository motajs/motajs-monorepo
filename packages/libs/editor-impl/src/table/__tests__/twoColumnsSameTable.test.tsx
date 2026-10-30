import { act, cleanup, configure, fireEvent, render, screen } from '@testing-library/react';
import { EditorCore, EditorFileChangeKind, IEditorPanel, IEditorPanelFactoryParam } from '@motajs/editor-core';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deriveSchemaPath, ITablePanelTarget, tablePanelType, TablePanel } from '..';
import { ICodeEditorOpener } from '../../react';
import { createTableHarness, FakeFileSystem } from './fixtures';

// 同一张表在同一个表格面板的两栏同时打开（D-12…D-16）：
// 一栏确认后另一栏 50 毫秒内更新；两栏之间永不弹冲突框，各自按「最后写盘者胜」结算，
// 另一栏有脏草稿时保留它自己的草稿；真正来自外部工具 / 另一个标签页的写入仍按既有规则提示冲突。
// 读回一律走资源层（命中缓冲即正确），冲突既看每栏的待决状态也看弹窗元素。

configure({ testIdAttribute: 'data-test-id' });

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

// 以文本预置一张双字段表的数据与 schema
function seed(fs: FakeFileSystem, name: string, data: unknown): void {
  fs.seed(tableDataPath(name), JSON.stringify(data));
  fs.seed(
    tableSchemaPath(name),
    JSON.stringify({
      type: 'object',
      properties: { a: { type: 'string', description: '甲' }, b: { type: 'string', description: '乙' } },
    }),
  );
}

// 注册一个捕获实例的表格面板类型，在首个标签页打开面板并返回实例
async function openTablePanel(system: EditorCore): Promise<TablePanel> {
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

  await act(async () => {
    await system.shellSystem.openPanelInTab(tabId, tablePanelType.id);
  });

  return created[0];
}

// 装配一个已渲染的表格面板：把同一张表铺进前 columnCount 栏
async function openRenderedPanel(
  fs: FakeFileSystem,
  table: string,
  columnCount: number = 2,
): Promise<{ system: EditorCore; panel: TablePanel; container: HTMLElement }> {
  const system = await createTableHarness(fs);
  const panel = await openTablePanel(system);

  for (let index = 0; index < columnCount; index += 1) panel.setTable(dataTarget(table), index);

  await act(async () => {
    await panel.onSwitchIn();
  });

  setWindowWidth(1500);

  const { container } = render(createElement(system.shellSystem.render()));

  return { system, panel, container };
}

// 按渲染顺序取第 index 栏的容器
function columnAt(container: HTMLElement, index: number): Element {
  const columns = container.querySelectorAll('.etable-column');
  const column = columns[index];

  if (column === undefined) throw new Error(`栏 ${index} 缺失`);

  return column;
}

// 读取某栏某字段值文本域的当前文本
function valueIn(container: HTMLElement, index: number, field: string): string | undefined {
  const cell = columnAt(container, index).querySelector(`[data-test-id="table-input-${field}"]`);
  const textarea = cell === null ? null : cell.querySelector('textarea');

  return textarea === null ? undefined : textarea.value;
}

// 在指定栏的字段值文本域中输入文本并确认提交（失焦），走面板唯一的编辑入口
async function confirmIn(container: HTMLElement, index: number, field: string, text: string): Promise<void> {
  const cell = columnAt(container, index).querySelector(`[data-test-id="table-input-${field}"]`);
  const textarea = cell === null ? null : cell.querySelector('textarea');

  if (textarea === null) throw new Error(`栏 ${index} 的字段文本域缺失: ${field}`);

  await act(async () => {
    fireEvent.change(textarea, { target: { value: text } });
    fireEvent.blur(textarea);
  });
  await act(async () => {});
}

// 在指定栏的字段值文本域里只输入、不失焦（草稿留在控件本地，尚未确认）
async function typeIn(container: HTMLElement, index: number, field: string, text: string): Promise<void> {
  const cell = columnAt(container, index).querySelector(`[data-test-id="table-input-${field}"]`);
  const textarea = cell === null ? null : cell.querySelector('textarea');

  if (textarea === null) throw new Error(`栏 ${index} 的字段文本域缺失: ${field}`);

  await act(async () => {
    fireEvent.change(textarea, { target: { value: text } });
  });
}

// 读取某路径数据文件的解析值（资源层优先命中缓冲）
async function readContent(system: EditorCore, path: string): Promise<unknown> {
  const text = await system.resourceSystem.readContent(path);

  return typeof text === 'string' ? JSON.parse(text) : undefined;
}

// 投递一次外部变化：先让资源层按宿主口径失效缓存并标记待写，再交给面板
async function dispatchChange(system: EditorCore, panel: TablePanel, path: string): Promise<void> {
  await act(async () => {
    await system.resourceSystem.updateResource(path);
    await panel.onResourceChange(path, EditorFileChangeKind.Change);
  });
  await act(async () => {});
}

// 取某栏当前待决的外部冲突路径；没有冲突时为空
function conflictPathOf(panel: TablePanel, index: number): string | undefined {
  return panel['columns'][index].pendingConflict?.path;
}

// 判断面板的冲突弹窗是否渲染出来（弹窗走 antd 的挂载点，不在栏容器里）
function hasConflictDialog(): boolean {
  return screen.queryByTestId('panel-conflict-dialog') !== null;
}

// 推进假定时器并冲刷一次 React 更新：50 毫秒合并通知与 5 秒自动写盘都是定时器驱动的异步链
async function advance(milliseconds: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
}

describe('同一张表在同一个面板的两栏（D-12 / D-13 / D-15 / D-16）', () => {
  // 一栏确认一格后，另一栏在同一次合并通知的 50 毫秒内显示新内容，两栏都不出现冲突
  it('一栏确认后另一栏在 50 毫秒内更新', async () => {
    const fs = new FakeFileSystem();

    seed(fs, 't', { a: '1', b: '2' });
    const { system, panel, container } = await openRenderedPanel(fs, 't');

    vi.useFakeTimers();

    await confirmIn(container, 0, 'a', '"x"');
    await advance(50);

    expect(await readContent(system, tableDataPath('t'))).toEqual({ a: 'x', b: '2' });
    expect(valueIn(container, 1, 'a')).toBe('"x"');
    expect(conflictPathOf(panel, 0)).toBeUndefined();
    expect(conflictPathOf(panel, 1)).toBeUndefined();
    expect(hasConflictDialog()).toBe(false);
  });

  // 两栏相继确认同一格：最后写盘者胜，最终内容与两栏显示都是后确认的那一份，全程不弹冲突框
  it('两栏相继确认同一格：最后写盘者胜且不弹冲突', async () => {
    const fs = new FakeFileSystem();

    seed(fs, 't', { a: '1', b: '2' });
    const { system, panel, container } = await openRenderedPanel(fs, 't');

    vi.useFakeTimers();

    await confirmIn(container, 0, 'a', '"x"');
    await confirmIn(container, 1, 'a', '"y"');
    await advance(50);

    expect(await readContent(system, tableDataPath('t'))).toEqual({ a: 'y', b: '2' });
    expect(valueIn(container, 0, 'a')).toBe('"y"');
    expect(valueIn(container, 1, 'a')).toBe('"y"');
    expect(conflictPathOf(panel, 0)).toBeUndefined();
    expect(conflictPathOf(panel, 1)).toBeUndefined();
    expect(hasConflictDialog()).toBe(false);
  });

  // 另一栏有未落盘的脏草稿（代码编辑器写回整份内容、还没写盘）时保留它自己的草稿、不弹冲突
  it('另一栏有脏草稿时保留草稿、不弹冲突', async () => {
    const fs = new FakeFileSystem();

    seed(fs, 't', { a: '1', b: '2' });
    const { system, panel, container } = await openRenderedPanel(fs, 't');

    vi.useFakeTimers();

    const codeEditor: ICodeEditorOpener = {
      open: vi.fn(async (): Promise<string | null> => JSON.stringify({ a: '1', b: '9' })),
    };

    await act(async () => {
      await panel.openCurrentViewInCodeEditor(codeEditor, 1);
    });

    expect(panel['columns'][1].unsaved).toBe(true);
    expect(valueIn(container, 1, 'b')).toBe('"9"');

    await confirmIn(container, 0, 'a', '"x"');
    await advance(50);

    expect(valueIn(container, 1, 'b')).toBe('"9"');
    expect(conflictPathOf(panel, 0)).toBeUndefined();
    expect(conflictPathOf(panel, 1)).toBeUndefined();
    expect(hasConflictDialog()).toBe(false);
  });

  // 另一栏只输入、未确认（草稿留在控件本地）时，另一栏的写入不清掉这段已输入的文本
  it('另一栏只输入未确认时保留已输入的文本', async () => {
    const fs = new FakeFileSystem();

    seed(fs, 't', { a: '1', b: '2' });
    const { system, panel, container } = await openRenderedPanel(fs, 't');

    vi.useFakeTimers();

    await typeIn(container, 1, 'b', '"y"');
    await confirmIn(container, 0, 'a', '"x"');
    await advance(50);

    expect(valueIn(container, 1, 'a')).toBe('"x"');
    expect(valueIn(container, 1, 'b')).toBe('"y"');
    expect(conflictPathOf(panel, 0)).toBeUndefined();
    expect(conflictPathOf(panel, 1)).toBeUndefined();
    expect(hasConflictDialog()).toBe(false);
  });

  // 外部写入仍按既有规则提示冲突：只开一栏的情况下，外部改文件与该栏脏草稿并存时照旧弹冲突
  it('外部写入仍按既有规则提示冲突', async () => {
    const fs = new FakeFileSystem();

    seed(fs, 'solo', { a: '1', b: '2' });
    const { system, panel, container } = await openRenderedPanel(fs, 'solo', 1);

    await confirmIn(container, 0, 'a', '"draft"');
    expect(panel['columns'][0].pendingConflict).toBeUndefined();

    fs.seed(tableDataPath('solo'), JSON.stringify({ a: 'external', b: '2' }));
    await dispatchChange(system, panel, tableDataPath('solo'));

    expect(conflictPathOf(panel, 0)).toBe(tableDataPath('solo'));
    expect(hasConflictDialog()).toBe(true);
    expect(valueIn(container, 0, 'a')).toBe('"draft"');
  });
});
