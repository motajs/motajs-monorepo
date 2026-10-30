import { act, cleanup, configure, fireEvent, render } from '@testing-library/react';
import { EditorCore, IEditorPanel, IEditorPanelFactoryParam } from '@motajs/editor-core';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deriveSchemaPath, tablePanelType, TablePanel } from '..';
import { createTableHarness, FakeFileSystem } from './fixtures';

// 表格字段确认后的自动保存（D-09 / D-10 / D-11）：确认即写缓冲、5 秒后落盘、保存按钮立刻写盘、
// 自动保存不刷「已保存」提示、「未保存」同时覆盖组件草稿与缓冲待写。
// 断言分三层读：资源层（命中缓冲）、裸磁盘（FakeFileSystem.readFile）、工具栏标记；
// 需要定时器的用例才装假定时器，需要 React 更新的地方一律走 act。

configure({ testIdAttribute: 'data-test-id' });

// 每个用例结束后卸载已挂载组件、恢复真定时器与替身，避免用例之间累积
afterEach(() => {
  cleanup();
  vi.useRealTimers();
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

// 注册一个捕获实例的表格面板类型，在首个标签页打开面板并返回实例
async function openTablePanel(system: EditorCore, created: TablePanel[]): Promise<TablePanel> {
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

// 以文本预置一张表的数据与 schema：单一字符串字段 `name`
function seed(fs: FakeFileSystem, name: string): void {
  fs.seed(tableDataPath(name), JSON.stringify({ name: 'a' }));
  fs.seed(
    tableSchemaPath(name),
    JSON.stringify({ type: 'object', properties: { name: { type: 'string', description: '名字' } } }),
  );
}

// 按渲染顺序取第 index 栏的容器
function columnAt(container: HTMLElement, index: number): Element {
  const columns = container.querySelectorAll('.etable-column');
  const column = columns[index];

  if (column === undefined) throw new Error(`栏 ${index} 缺失`);

  return column;
}

// 在指定栏内按 data-test-id 查询元素
function inColumn(container: HTMLElement, index: number, testId: string): Element | null {
  return columnAt(container, index).querySelector(`[data-test-id="${testId}"]`);
}

// 在字段值文本域中输入文本并提交（失焦），走面板唯一的编辑入口
async function commitText(container: HTMLElement, field: string, text: string): Promise<void> {
  const cell = container.querySelector(`[data-test-id="table-input-${field}"]`);
  const textarea = cell === null ? null : cell.querySelector('textarea');

  await act(async () => {
    fireEvent.change(textarea as HTMLTextAreaElement, { target: { value: text } });
    fireEvent.blur(textarea as HTMLTextAreaElement);
  });
}

// 点本栏工具栏上的「保存」按钮
async function clickSave(container: HTMLElement): Promise<void> {
  const button = inColumn(container, 0, 'table-save');

  if (button === null) throw new Error('保存按钮缺失');

  await act(async () => {
    fireEvent.click(button);
  });
  await act(async () => {});
}

// 读取某路径数据文件的解析值（资源层优先命中缓冲）
async function readContent(system: EditorCore, path: string): Promise<unknown> {
  const text = await system.resourceSystem.readContent(path);

  return typeof text === 'string' ? JSON.parse(text) : undefined;
}

// 读取某路径数据文件的裸磁盘内容：`FakeFileSystem.readFile` 不经缓冲，用来证明「磁盘上到底是什么」
async function readDisk(fs: FakeFileSystem, path: string): Promise<unknown> {
  return JSON.parse(await fs.readFile(path));
}

// 推进假定时器并冲刷一次 React 更新：缓冲到期写盘是一条异步链，要等它把视图状态发布完
async function advance(milliseconds: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(milliseconds);
  await act(async () => {});
}

// 装配一个已打开并渲染了一张表的面板
async function openRenderedTable(fs: FakeFileSystem): Promise<{
  system: EditorCore;
  container: HTMLElement;
}> {
  seed(fs, 't');

  const system = await createTableHarness(fs);
  const created: TablePanel[] = [];
  const panel = await openTablePanel(system, created);

  panel.setTable({ dataPath: tableDataPath('t') });

  await act(async () => {
    await panel.onSwitchIn();
  });

  const { container } = render(createElement(system.shellSystem.render()));

  return { system, container };
}

describe('表格字段确认后的自动保存（D-09 / D-10 / D-11）', () => {
  // 确认一格后资源层立刻读得到新值，但磁盘仍是旧值（写盘要等 5 秒防抖）
  it('确认即写缓冲：确认一格后资源层读得到新值、磁盘仍是旧值', async () => {
    const fs = new FakeFileSystem();
    const { system, container } = await openRenderedTable(fs);

    await commitText(container, 'name', '"b"');

    expect(await readContent(system, tableDataPath('t'))).toEqual({ name: 'b' });
    expect(await readDisk(fs, tableDataPath('t'))).toEqual({ name: 'a' });
  });

  // 推进 5 000 毫秒后防抖到期，磁盘才变成新值
  it('确认即写缓冲：推进 5 000 毫秒后磁盘才是新值', async () => {
    const fs = new FakeFileSystem();
    const { container } = await openRenderedTable(fs);

    vi.useFakeTimers();

    await commitText(container, 'name', '"b"');

    expect(await readDisk(fs, tableDataPath('t'))).toEqual({ name: 'a' });

    await advance(5000);

    expect(await readDisk(fs, tableDataPath('t'))).toEqual({ name: 'b' });
  });

  // 自动保存走安静模式：提示区不出现「已保存」，只有用户点保存才刷
  it('确认即写缓冲：自动保存不刷「已保存」提示', async () => {
    const fs = new FakeFileSystem();
    const { container } = await openRenderedTable(fs);

    await commitText(container, 'name', '"b"');

    const notice = inColumn(container, 0, 'table-notice');

    expect(notice === null ? '' : notice.textContent).not.toContain('已保存');
  });

  // 保存按钮 = 立刻写盘：不推进任何定时器，磁盘立刻是新值
  it('保存按钮立刻写盘：点保存后磁盘立刻是新值', async () => {
    const fs = new FakeFileSystem();
    const { container } = await openRenderedTable(fs);

    await commitText(container, 'name', '"b"');

    await clickSave(container);

    expect(await readDisk(fs, tableDataPath('t'))).toEqual({ name: 'b' });
  });

  // 「未保存」同时覆盖草稿脏与缓冲待写：缓冲落盘完成后标记自动消失
  it('未保存标记覆盖草稿脏与缓冲待写：写盘完成后消失', async () => {
    const fs = new FakeFileSystem();
    const { container } = await openRenderedTable(fs);

    vi.useFakeTimers();

    await commitText(container, 'name', '"b"');

    expect(inColumn(container, 0, 'table-unsaved')).not.toBeNull();

    await advance(5000);

    expect(await readDisk(fs, tableDataPath('t'))).toEqual({ name: 'b' });
    expect(inColumn(container, 0, 'table-unsaved')).toBeNull();
  });
});
