import { act, cleanup, configure, fireEvent, render, screen } from '@testing-library/react';
import { EditorCore } from '@motajs/editor-core';
import { CapabilityProvider } from '@motajs/editor-impl/react';
import { tableListPanelType, tablePanelType } from '@motajs/editor-impl/table';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryBackend } from '../backend/memoryBackend';
import { DEMO_PANEL_TYPE } from '../demo/demoPanel';
import {
  DEV_REDO_MENU_ID,
  DEV_REDO_MENU_TITLE,
  DEV_UNDO_MENU_ID,
  DEV_UNDO_MENU_TITLE,
  registerDevMenu,
} from '../demo/devMenu';
import {
  createTablePanelOpener,
  openTableDemoPanel,
  TABLE_DEMO_DATA,
  TABLE_DEMO_DATA_PATH,
  TABLE_DEMO_ENTRY_COUNT,
  TABLE_DEMO_MENU_ID,
  TABLE_DEMO_MENU_TITLE,
  TABLE_DEMO_SCHEMA,
  TABLE_DEMO_SCHEMA_PATH,
  TABLE_PRESETS,
} from '../demo/tableDemo';

configure({ testIdAttribute: 'data-test-id' });

// 每个用例结束后卸载已挂载的组件，避免 DOM 在用例之间累积
afterEach(() => {
  cleanup();
});

// 装配开发宿主组合根：内存文件系统 seed demo 示例与 demo 表、注册三种面板类型与「打开表格」菜单项
async function createHost(): Promise<EditorCore> {
  const core = new EditorCore();
  const backend = new MemoryBackend();

  backend.seed(TABLE_DEMO_DATA_PATH, TABLE_DEMO_DATA);
  backend.seed(TABLE_DEMO_SCHEMA_PATH, TABLE_DEMO_SCHEMA);
  core.shellSystem.registerPanelType(DEMO_PANEL_TYPE);
  core.shellSystem.registerPanelType(tablePanelType);
  core.shellSystem.registerPanelType(tableListPanelType);
  core.shellSystem.registerMenuItem({
    id: TABLE_DEMO_MENU_ID,
    title: TABLE_DEMO_MENU_TITLE,
    onClick: (): void => {
      void openTableDemoPanel(core);
    },
  });
  registerDevMenu(core);

  await core.initialize({ fs: backend, maxUndoStep: backend.maxUndoStep });
  return core;
}

// 直接瞄准备 demo 数据路径打开表格面板（绕过列表面板；供断言表格渲染的用例复用）
async function openDemoTable(core: EditorCore): Promise<void> {
  const tabId = core.shellSystem.openBlankTab();

  await core.shellSystem.openPanelInTab(tabId, tablePanelType.id, { target: { dataPath: TABLE_DEMO_DATA_PATH } });
}

// 读取某个字段值单元格内文本域的当前文本
function inputValue(container: HTMLElement, field: string): string | undefined {
  const cell = container.querySelector(`[data-test-id="table-input-${field}"]`);
  const textarea = cell === null ? null : cell.querySelector('textarea');

  return textarea === null ? undefined : textarea.value;
}

// 读取某个数字字段值单元格内数字输入的当前文本
function numberValue(container: HTMLElement, field: string): string | undefined {
  const cell = container.querySelector(`[data-test-id="table-input-${field}"]`);
  const input = cell === null ? null : cell.querySelector('input');

  return input === null ? undefined : input.value;
}

// 读取某路径数据文件的解析值（面板以文本写回）
async function readData(core: EditorCore, path: string): Promise<Record<string, unknown> | undefined> {
  const text = await core.resourceSystem.readContent(path);

  return typeof text === 'string' ? (JSON.parse(text) as Record<string, unknown>) : undefined;
}

// 用能力 Provider 包裹外壳渲染根，注入开发宿主的表格面板打开器与预设表（对应 main.tsx 的接线）
function renderWithTableOpener(core: EditorCore): ReturnType<typeof render> {
  return render(
    createElement(CapabilityProvider, {
      capabilities: { tablePanel: createTablePanelOpener(core), tablePresets: TABLE_PRESETS },
      children: createElement(core.shellSystem.render()),
    }),
  );
}

describe('开发宿主表格接入', () => {
  // 经打开参数打开 demo 表格后，外壳渲染出 schema 驱动的嵌套分组行与叶子行
  it('经打开参数打开 demo 表格并渲染 schema 驱动行', async () => {
    const core = await createHost();

    await act(async () => {
      await openDemoTable(core);
    });

    const { container } = render(
      createElement(CapabilityProvider, { children: createElement(core.shellSystem.render()) }),
    );

    expect(screen.getByText('position')).not.toBeNull();
    expect(screen.getByText('标题')).not.toBeNull();
    expect(screen.getByText('等级')).not.toBeNull();
    expect(screen.getByText('横坐标')).not.toBeNull();
    expect(screen.getByText('纵坐标')).not.toBeNull();
    expect(inputValue(container, 'title')).toBe(JSON.stringify('示例条目'));
    expect(numberValue(container, 'level')).toBe('3');
    expect(numberValue(container, 'position-x')).toBe('12');
    expect(numberValue(container, 'position-y')).toBe('34');
  });

  // 组合根接好线：已注册「打开表格」菜单项与表格 / 列表两种面板类型
  it('已注册「打开表格」菜单项与表格面板类型', async () => {
    const core = await createHost();

    const matching = core.shellSystem.listMenuItems().filter((item) => item.id === TABLE_DEMO_MENU_ID);

    expect(matching.length).toBe(1);
    expect(matching[0].title).toBe(TABLE_DEMO_MENU_TITLE);

    const typeIds = core.shellSystem.listPanelTypes().map((type) => type.id);

    expect(typeIds).toContain('table');
    expect(typeIds).toContain('table-list');
  });

  // 注入表格打开器后，数据表格工具栏的「编辑 Schema」按钮存在且未被禁用
  it('注入表格打开器后「编辑 Schema」按钮可用', async () => {
    const core = await createHost();

    await act(async () => {
      await openDemoTable(core);
    });

    const { container } = renderWithTableOpener(core);
    const button = container.querySelector('[data-test-id="table-edit-schema"]');

    expect(button).not.toBeNull();
    expect(button === null ? undefined : button.getAttribute('disabled')).toBeNull();
  });

  // 点击「编辑 Schema」后按 D-06 新开一个标签承载 schema 视图面板，且一打开即渲染 schema 提示条
  it('点击「编辑 Schema」新开 schema 视图面板', async () => {
    const core = await createHost();

    await act(async () => {
      await openDemoTable(core);
    });

    const { container } = renderWithTableOpener(core);
    const tabsBefore = core.shellSystem.listTabs().length;

    await act(async () => {
      fireEvent.click(screen.getByTestId('table-edit-schema'));
    });

    expect(core.shellSystem.listTabs().length).toBe(tabsBefore + 1);
    expect(container.querySelector('[data-test-id="schema-banner"]')).not.toBeNull();
    expect(screen.getByText('正在编辑表格结构（Schema）')).not.toBeNull();
  });

  // 打开 demo 表格后表体渲染出约 TABLE_DEMO_ENTRY_COUNT 个可见行（含 position 的两个子行），量级足以触发纵向滚动（P7）
  it('演示表数据量约 100 条', async () => {
    const core = await createHost();

    await act(async () => {
      await openDemoTable(core);
    });

    const { container } = renderWithTableOpener(core);
    const rows = container.querySelectorAll('[data-test-id^="table-row-"]');

    expect(rows.length).toBeGreaterThanOrEqual(TABLE_DEMO_ENTRY_COUNT - 10);
    expect(rows.length).toBeLessThanOrEqual(TABLE_DEMO_ENTRY_COUNT + 20);
  });

  // demo 表体由独立的滚动容器承载（.etable-body 声明 overflow:auto），行数超出可视高度即可上下滚动（P7）；
  // jsdom 不落地外部 CSS，故此处断言滚动容器存在并携带滚动类名，真实滚动高度由手动验收核对
  it('表体是可纵向滚动的独立容器', async () => {
    const core = await createHost();

    await act(async () => {
      await openDemoTable(core);
    });

    const { container } = renderWithTableOpener(core);
    const body = container.querySelector('[data-test-id="data-table-grid"]');

    expect(body).not.toBeNull();
    expect(body === null ? false : body.classList.contains('etable-body')).toBe(true);
  });

  // 组合根接好线：已注册「撤销」「重做」菜单项，标题分别为「撤销」「重做」（P10）
  it('已注册「撤销」「重做」菜单项', async () => {
    const core = await createHost();
    const items = core.shellSystem.listMenuItems();
    const undo = items.find((item) => item.id === DEV_UNDO_MENU_ID);
    const redo = items.find((item) => item.id === DEV_REDO_MENU_ID);

    expect(undo === undefined ? undefined : undo.title).toBe(DEV_UNDO_MENU_TITLE);
    expect(redo === undefined ? undefined : redo.title).toBe(DEV_REDO_MENU_TITLE);
  });

  // 点击顶部「撤销」「重做」菜单项分别调用 core 的撤销系统（P10）
  it('「撤销」「重做」菜单项点击触发 core 的撤销 / 重做', async () => {
    const core = await createHost();

    render(createElement(CapabilityProvider, { children: createElement(core.shellSystem.render()) }));

    const undoSpy = vi.spyOn(core.undoSystem, 'undo');
    const redoSpy = vi.spyOn(core.undoSystem, 'redo');

    await act(async () => {
      fireEvent.click(screen.getByText(DEV_UNDO_MENU_TITLE));
    });

    await act(async () => {
      fireEvent.click(screen.getByText(DEV_REDO_MENU_TITLE));
    });

    expect(undoSpy).toHaveBeenCalledTimes(1);
    expect(redoSpy).toHaveBeenCalledTimes(1);

    undoSpy.mockRestore();
    redoSpy.mockRestore();
  });

  // 点击顶部「撤销」按钮能把 demo 表的一次改值编辑还原，证明按钮可用于测试撤销 / 重做（P10 端到端）
  it('点击「撤销」按钮还原表格的改值编辑', async () => {
    const core = await createHost();

    await act(async () => {
      await openDemoTable(core);
    });

    const { container } = renderWithTableOpener(core);
    const cell = container.querySelector('[data-test-id="table-input-title"]');
    const textarea = cell === null ? null : cell.querySelector('textarea');

    if (textarea === null) throw new Error('标题值文本域缺失');

    await act(async () => {
      fireEvent.change(textarea, { target: { value: JSON.stringify('改后标题') } });
      fireEvent.blur(textarea);
    });

    const edited = await readData(core, TABLE_DEMO_DATA_PATH);

    expect(edited === undefined ? undefined : edited.title).toBe('改后标题');

    await act(async () => {
      fireEvent.click(screen.getByText(DEV_UNDO_MENU_TITLE));
    });

    const restored = await readData(core, TABLE_DEMO_DATA_PATH);

    expect(restored === undefined ? undefined : restored.title).toBe('示例条目');
  });
});
