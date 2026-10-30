import { act, cleanup, configure, fireEvent, render, screen } from '@testing-library/react';
import { EditorCore, IEditorPanel, IEditorPanelFactoryParam, PanelCloseChoice } from '@motajs/editor-core';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deriveSchemaPath, ITablePanelTarget, tablePanelType, TablePanel } from '..';
import { createTableHarness, FakeFileSystem } from './fixtures';

// 表格面板的关闭三态：没脏直放行、脏就弹框、三个选择各走各的结算。
// 「不保存关闭」经真实 EditorCore 装配会真的走到 onDiscard 与跳过落盘的释放路径，
// 因此这里的断言一律以「标签是否存在 + 磁盘内容 + 弹窗数量」为准，而不是只看枚举值。

configure({ testIdAttribute: 'data-test-id' });

const ORIGINAL_INNER_WIDTH = window.innerWidth;

// 在 jsdom 下按窗口宽度驱动可视栏数：改写 window.innerWidth，视图据此铺出多栏
function setWindowWidth(value: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value });
}

// 每个用例前把窗口宽度复位为可铺出两栏的值，并让用例起点一致
beforeEach(() => {
  setWindowWidth(1000);
});

// 每个用例结束后卸载已挂载组件、还原替身并复位窗口宽度
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  setWindowWidth(ORIGINAL_INNER_WIDTH);
});

/** 装配好的面板与它所在的标签 */
interface ICloseHarness {
  /** 已初始化的编辑器核心 */
  readonly system: EditorCore;
  /** 被捕获的表格面板实例 */
  readonly panel: TablePanel;
  /** 面板所在标签的标识 */
  readonly tabId: string;
}

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

// 以文本预置一张表的数据与 schema：单一字符串字段 `name`
function seed(fs: FakeFileSystem, name: string, value: string): void {
  fs.seed(tableDataPath(name), JSON.stringify({ name: value }));
  fs.seed(
    tableSchemaPath(name),
    JSON.stringify({ type: 'object', properties: { name: { type: 'string', description: '名字' } } }),
  );
}

// 在首个标签页打开表格面板并返回实例与标签标识
async function openPanel(system: EditorCore): Promise<ICloseHarness> {
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

  return { system, panel: created[0], tabId };
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

// 在指定栏的字段值文本域中输入文本并提交（失焦），走面板唯一的编辑入口
async function commitTextIn(container: HTMLElement, index: number, field: string, text: string): Promise<void> {
  const cell = inColumn(container, index, `table-input-${field}`);
  const textarea = cell === null ? null : cell.querySelector('textarea');

  if (textarea === null) throw new Error(`栏 ${index} 的字段文本域缺失: ${field}`);

  await act(async () => {
    fireEvent.change(textarea, { target: { value: text } });
    fireEvent.blur(textarea);
  });
}

// 读取某路径数据文件的解析值（资源层优先命中缓冲）
async function readData(system: EditorCore, path: string): Promise<unknown> {
  const text = await system.resourceSystem.readContent(path);

  return typeof text === 'string' ? JSON.parse(text) : undefined;
}

// 读取某路径数据文件的裸磁盘内容：`FakeFileSystem.readFile` 不经缓冲
async function readDisk(fs: FakeFileSystem, path: string): Promise<unknown> {
  return JSON.parse(await fs.readFile(path));
}

// 判断某个标签是否还在外壳里
function hasTab(system: EditorCore, tabId: string): boolean {
  return system.shellSystem.listTabs().some((tab) => tab.id === tabId);
}

describe('表格面板：关闭三态', () => {
  // 没有脏改动：关闭后标签直接消失，全程不出现关闭弹窗、也不写盘
  it('没有脏改动时直接关闭且不弹框', async () => {
    const fs = new FakeFileSystem();

    seed(fs, 'hero', 'a');
    const system = await createTableHarness(fs);
    const harness = await openPanel(system);

    harness.panel.setTable(dataTarget('hero'));
    await act(async () => {
      await harness.panel.onSwitchIn();
    });

    render(createElement(system.shellSystem.render()));
    await act(async () => {
      await system.shellSystem.closeTab(harness.tabId);
    });

    expect(hasTab(system, harness.tabId)).toBe(false);
    expect(screen.queryByTestId('panel-close-dialog')).toBeNull();
    expect(await readData(system, tableDataPath('hero'))).toEqual({ name: 'a' });
  });

  // 有脏改动：关闭时出现关闭弹窗，三个选择按钮齐全
  it('有脏改动时弹出三态框且三个选择都在', async () => {
    const fs = new FakeFileSystem();

    seed(fs, 'hero', 'a');
    const system = await createTableHarness(fs);
    const harness = await openPanel(system);

    harness.panel.setTable(dataTarget('hero'));
    await act(async () => {
      await harness.panel.onSwitchIn();
    });

    const { container } = render(createElement(system.shellSystem.render()));

    await commitTextIn(container, 0, 'name', '"b"');

    let closing: Promise<void> = Promise.resolve();

    await act(async () => {
      closing = system.shellSystem.closeTab(harness.tabId);
      await Promise.resolve();
    });

    expect(screen.queryByTestId('panel-close-dialog')).not.toBeNull();
    expect(screen.queryByTestId('panel-close-cancel')).not.toBeNull();
    expect(screen.queryByTestId('panel-close-discard')).not.toBeNull();
    expect(screen.queryByTestId('panel-close-save')).not.toBeNull();

    fireEvent.click(screen.getByTestId('panel-close-cancel'));

    await act(async () => {
      await closing;
    });
  });

  // 取消：标签仍在、磁盘仍是旧内容、改动仍算脏，弹窗消失
  it('取消后标签保持打开且磁盘与脏标记都不变', async () => {
    const fs = new FakeFileSystem();

    seed(fs, 'hero', 'a');
    const system = await createTableHarness(fs);
    const harness = await openPanel(system);

    harness.panel.setTable(dataTarget('hero'));
    await act(async () => {
      await harness.panel.onSwitchIn();
    });

    const { container } = render(createElement(system.shellSystem.render()));

    await commitTextIn(container, 0, 'name', '"b"');

    let closing: Promise<void> = Promise.resolve();

    await act(async () => {
      closing = system.shellSystem.closeTab(harness.tabId);
      await Promise.resolve();
    });

    fireEvent.click(screen.getByTestId('panel-close-cancel'));

    await act(async () => {
      await closing;
    });

    expect(hasTab(system, harness.tabId)).toBe(true);
    expect(screen.queryByTestId('panel-close-dialog')).toBeNull();
    // 取消后资源层读到新值（缓冲命中），磁盘仍是旧值
    expect(await readData(system, tableDataPath('hero'))).toEqual({ name: 'b' });
    expect(await readDisk(fs, tableDataPath('hero'))).toEqual({ name: 'a' });
    // 脏依据换成「本栏还有待写」：字段确认时草稿已被自动保存清掉，缓冲里那一条还在
    expect(harness.panel.isColumnDirty(0)).toBe(true);
  });

  // 不保存关闭：标签消失、磁盘仍是旧内容，缓冲写入次数必须为 0（证明 dispose 兜底保存没写）
  it('不保存关闭时标签消失且一次盘都没写', async () => {
    const fs = new FakeFileSystem();

    seed(fs, 'hero', 'a');
    const system = await createTableHarness(fs);
    const harness = await openPanel(system);

    harness.panel.setTable(dataTarget('hero'));
    await act(async () => {
      await harness.panel.onSwitchIn();
    });

    const { container } = render(createElement(system.shellSystem.render()));

    await commitTextIn(container, 0, 'name', '"b"');

    // 这里数的是「缓冲写入次数」：字段确认那一次已经写过缓冲，之后的「不保存关闭」必须一次都不再写
    const writes = vi.spyOn(system.resourceSystem, 'writeContent');
    let closing: Promise<void> = Promise.resolve();

    await act(async () => {
      closing = system.shellSystem.closeTab(harness.tabId);
      await Promise.resolve();
    });

    fireEvent.click(screen.getByTestId('panel-close-discard'));

    await act(async () => {
      await closing;
    });

    expect(hasTab(system, harness.tabId)).toBe(false);
    expect(screen.queryByTestId('panel-close-dialog')).toBeNull();
    expect(writes).not.toHaveBeenCalled();
    expect(await readData(system, tableDataPath('hero'))).toEqual({ name: 'a' });
  });

  // 保存并关闭：标签消失，磁盘变成新内容
  it('保存并关闭时标签消失且磁盘写为新内容', async () => {
    const fs = new FakeFileSystem();

    seed(fs, 'hero', 'a');
    const system = await createTableHarness(fs);
    const harness = await openPanel(system);

    harness.panel.setTable(dataTarget('hero'));
    await act(async () => {
      await harness.panel.onSwitchIn();
    });

    const { container } = render(createElement(system.shellSystem.render()));

    await commitTextIn(container, 0, 'name', '"b"');

    let closing: Promise<void> = Promise.resolve();

    await act(async () => {
      closing = system.shellSystem.closeTab(harness.tabId);
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('panel-close-save'));
    });
    await act(async () => {
      await closing;
    });

    expect(hasTab(system, harness.tabId)).toBe(false);
    expect(screen.queryByTestId('panel-close-dialog')).toBeNull();
    expect(await readData(system, tableDataPath('hero'))).toEqual({ name: 'b' });
  });

  // 保存失败：标签仍在、弹窗留在屏幕上显示原因，三个按钮恢复可用
  it('保存失败时保持打开并显示失败原因', async () => {
    const fs = new FakeFileSystem();

    seed(fs, 'hero', 'a');
    const system = await createTableHarness(fs);
    const harness = await openPanel(system);

    harness.panel.setTable(dataTarget('hero'));
    await act(async () => {
      await harness.panel.onSwitchIn();
    });

    const { container } = render(createElement(system.shellSystem.render()));

    await commitTextIn(container, 0, 'name', '"b"');

    fs.failing.add(tableDataPath('hero'));

    let choice: PanelCloseChoice = PanelCloseChoice.Save;
    let closing: Promise<PanelCloseChoice> = Promise.resolve(PanelCloseChoice.Cancel);

    await act(async () => {
      closing = harness.panel.onRequestClose();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('panel-close-save'));
    });
    await act(async () => {
      choice = await closing;
    });

    expect(choice).toBe(PanelCloseChoice.Cancel);
    expect(screen.queryByTestId('panel-close-dialog')).not.toBeNull();
    expect(screen.getByTestId('panel-close-error').textContent).toContain('写入失败');
    expect(screen.getByTestId('panel-close-save').hasAttribute('disabled')).toBe(false);
    expect(screen.getByTestId('panel-close-discard').hasAttribute('disabled')).toBe(false);
    expect(screen.getByTestId('panel-close-cancel').hasAttribute('disabled')).toBe(false);
    expect(hasTab(system, harness.tabId)).toBe(true);
  });

  // 普通切走：仍然落盘且不出现关闭弹窗（关闭决策不改变切走语义，D-11）
  it('普通切走仍然落盘且不出现关闭弹窗', async () => {
    const fs = new FakeFileSystem();

    seed(fs, 'hero', 'a');
    const system = await createTableHarness(fs);
    const harness = await openPanel(system);

    harness.panel.setTable(dataTarget('hero'));
    await act(async () => {
      await harness.panel.onSwitchIn();
    });

    const { container } = render(createElement(system.shellSystem.render()));

    await commitTextIn(container, 0, 'name', '"b"');

    const blankTabId = system.shellSystem.openBlankTab();

    await act(async () => {
      await system.shellSystem.activateTab(blankTabId);
    });

    expect(screen.queryByTestId('panel-close-dialog')).toBeNull();
    expect(await readData(system, tableDataPath('hero'))).toEqual({ name: 'b' });
  });

  // 只做一次本地编辑就点关闭：必须弹框，不能因草稿被重置而被判成干净
  it('只编辑一次就点关闭也一定弹框', async () => {
    const fs = new FakeFileSystem();

    seed(fs, 'hero', 'a');
    const system = await createTableHarness(fs);
    const harness = await openPanel(system);

    harness.panel.setTable(dataTarget('hero'));
    await act(async () => {
      await harness.panel.onSwitchIn();
    });

    const { container } = render(createElement(system.shellSystem.render()));

    await commitTextIn(container, 0, 'name', '"b"');

    let closing: Promise<void> = Promise.resolve();

    await act(async () => {
      closing = system.shellSystem.closeTab(harness.tabId);
      await Promise.resolve();
    });

    expect(screen.queryByTestId('panel-close-dialog')).not.toBeNull();

    fireEvent.click(screen.getByTestId('panel-close-cancel'));

    await act(async () => {
      await closing;
    });
  });

  // 三栏都有脏改动：整块面板只有一个关闭弹窗，取消后三栏与标签都还在，再点关闭仍只弹一个
  it('铺出三栏时只渲染一份关闭弹窗', async () => {
    const fs = new FakeFileSystem();

    seed(fs, 'hero', 'a');
    seed(fs, 'other', 'b');
    seed(fs, 'third', 'c');
    const system = await createTableHarness(fs);
    const harness = await openPanel(system);

    harness.panel.setTable(dataTarget('hero'), 0);
    harness.panel.setTable(dataTarget('other'), 1);
    harness.panel.setTable(dataTarget('third'), 2);
    await act(async () => {
      await harness.panel.onSwitchIn();
    });
    setWindowWidth(1600);

    const { container } = render(createElement(system.shellSystem.render()));

    expect(container.querySelectorAll('.etable-column')).toHaveLength(3);

    await commitTextIn(container, 0, 'name', '"x"');
    await commitTextIn(container, 1, 'name', '"y"');

    let closing: Promise<void> = Promise.resolve();

    await act(async () => {
      closing = system.shellSystem.closeTab(harness.tabId);
      await Promise.resolve();
    });

    expect(screen.queryAllByTestId('panel-close-dialog')).toHaveLength(1);

    fireEvent.click(screen.getByTestId('panel-close-cancel'));

    await act(async () => {
      await closing;
    });

    expect(screen.queryAllByTestId('panel-close-dialog')).toHaveLength(0);
    expect(hasTab(system, harness.tabId)).toBe(true);
    expect(container.querySelectorAll('.etable-column')).toHaveLength(3);

    let closingAgain: Promise<void> = Promise.resolve();

    await act(async () => {
      closingAgain = system.shellSystem.closeTab(harness.tabId);
      await Promise.resolve();
    });

    expect(screen.queryAllByTestId('panel-close-dialog')).toHaveLength(1);

    fireEvent.click(screen.getByTestId('panel-close-cancel'));

    await act(async () => {
      await closingAgain;
    });
  });
});
