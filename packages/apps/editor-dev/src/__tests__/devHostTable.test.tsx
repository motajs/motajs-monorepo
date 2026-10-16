import { act, cleanup, configure, fireEvent, render, screen } from '@testing-library/react';
import { EditorCore } from '@motajs/editor-core';
import { CapabilityProvider } from '@motajs/editor-impl/react';
import { tablePanelType } from '@motajs/editor-impl/table';
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
  TABLE_DEMO_DATA,
  TABLE_DEMO_DATA_PATH,
  TABLE_DEMO_ENTRY_COUNT,
  TABLE_DEMO_SCHEMA,
  TABLE_DEMO_SCHEMA_PATH,
  TABLE_PRESETS,
} from '../demo/tableDemo';

configure({ testIdAttribute: 'data-test-id' });

// 每个用例结束后卸载已挂载的组件，避免 DOM 在用例之间累积
afterEach(() => {
  cleanup();
});

// 装配开发宿主组合根：内存文件系统 seed demo 示例与 demo 表、注册演示 / 表格两种面板类型与撤销重做菜单
async function createHost(): Promise<EditorCore> {
  const core = new EditorCore();
  const backend = new MemoryBackend();

  backend.seed(TABLE_DEMO_DATA_PATH, TABLE_DEMO_DATA);
  backend.seed(TABLE_DEMO_SCHEMA_PATH, TABLE_DEMO_SCHEMA);
  core.shellSystem.registerPanelType(DEMO_PANEL_TYPE);
  core.shellSystem.registerPanelType(tablePanelType);
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

// 点击工具栏「更多」触发按钮展开下拉（编辑 Schema / 在代码编辑器中打开收在此下拉内）
async function openToolbarMenu(): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByTestId('table-more'));
  });
}

// 取某菜单项的菜单容器（aria-disabled 断言用）
function menuItemOf(testId: string): Element | null {
  return screen.getByTestId(testId).closest('[role="menuitem"]');
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

// 取面板第 index 栏的 DOM 元素：空栏控件与其 data-test-id 在多栏下重复，断言须限定到单栏
function columnAt(container: HTMLElement, index: number): Element | null {
  return container.querySelectorAll('.etable-column')[index] ?? null;
}

// 在第 index 栏内按 data-test-id 查询元素
function inColumn(container: HTMLElement, index: number, testId: string): Element | null {
  const column = columnAt(container, index);

  return column === null ? null : column.querySelector(`[data-test-id="${testId}"]`);
}

// 点击第 index 栏内按 data-test-id 定位的元素
function clickInColumn(container: HTMLElement, index: number, testId: string): void {
  const element = inColumn(container, index, testId);

  if (element === null) throw new Error(`栏内元素缺失: ${testId}`);

  fireEvent.click(element);
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

  // 组合根接好线：只注册表格 / 演示两种面板类型，且不再有「打开表格」工具栏入口
  it('只注册表格 / 演示面板类型且无「打开表格」菜单项', async () => {
    const core = await createHost();

    const typeIds = core.shellSystem.listPanelTypes().map((type) => type.id);

    expect(typeIds).toContain(tablePanelType.id);
    expect(typeIds).toContain(DEMO_PANEL_TYPE.id);
    expect(typeIds).not.toContain('table-list');

    const menuTitles = core.shellSystem.listMenuItems().map((item) => item.title);

    expect(menuTitles).not.toContain('打开表格');
  });

  // 注入表格打开器后，数据表格工具栏「更多」下拉里的「编辑 Schema」菜单项存在且可用
  it('注入表格打开器后「编辑 Schema」菜单项可用', async () => {
    const core = await createHost();

    await act(async () => {
      await openDemoTable(core);
    });

    renderWithTableOpener(core);
    await openToolbarMenu();

    expect(screen.getByTestId('table-edit-schema')).not.toBeNull();
    expect(menuItemOf('table-edit-schema')?.getAttribute('aria-disabled')).not.toBe('true');
  });

  // 经「更多」下拉点「编辑 Schema」后按 D-06 新开一个标签承载 schema 视图面板，且一打开即渲染 schema 提示条
  it('点击「编辑 Schema」新开 schema 视图面板', async () => {
    const core = await createHost();

    await act(async () => {
      await openDemoTable(core);
    });

    const { container } = renderWithTableOpener(core);
    const tabsBefore = core.shellSystem.listTabs().length;

    await openToolbarMenu();

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

    // 手动保存模型：编辑只留内存，读回资源前先点「保存」落盘
    await act(async () => {
      fireEvent.click(screen.getByTestId('table-save'));
    });
    await act(async () => {});

    const edited = await readData(core, TABLE_DEMO_DATA_PATH);

    expect(edited === undefined ? undefined : edited.title).toBe('改后标题');

    await act(async () => {
      fireEvent.click(screen.getByText(DEV_UNDO_MENU_TITLE));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('table-save'));
    });
    await act(async () => {});

    const restored = await readData(core, TABLE_DEMO_DATA_PATH);

    expect(restored === undefined ? undefined : restored.title).toBe('示例条目');
  });
});

describe('开发宿主表格端到端', () => {
  // 端到端：在表格面板空栏内贯通「打开（含预设）/ 新建 / 删除」，全程就在该栏内、不再出现覆盖外壳的独立面板
  it('在表格面板空栏内贯通打开 / 新建 / 删除 端到端', async () => {
    const core = await createHost();

    // 开一个未设目标的表格面板标签，进入第 0 栏的空栏三按钮态
    const tabId = core.shellSystem.openBlankTab();

    await act(async () => {
      await core.shellSystem.openPanelInTab(tabId, tablePanelType.id);
    });

    const { container } = renderWithTableOpener(core);

    // 空栏初始态：本栏显示「打开表格 / 新建表格 / 删除表格」三个按钮
    expect(inColumn(container, 0, 'table-empty-open')).not.toBeNull();
    expect(inColumn(container, 0, 'table-empty-create')).not.toBeNull();
    expect(inColumn(container, 0, 'table-empty-delete')).not.toBeNull();

    // 点「打开表格」：本栏内联展示可复用浏览器，预设表「演示表」可见
    await act(async () => {
      clickInColumn(container, 0, 'table-empty-open');
    });
    await act(async () => {});

    expect(screen.getByTestId('table-list-preset-演示表')).not.toBeNull();

    // 从预设打开演示表：开进本栏（不新开标签）并渲染 schema 驱动行
    const tabsBefore = core.shellSystem.listTabs().length;

    await act(async () => {
      fireEvent.click(screen.getByTestId('table-list-preset-演示表'));
    });
    await act(async () => {});

    expect(screen.getByText('position')).not.toBeNull();
    expect(screen.getByText('标题')).not.toBeNull();
    expect(core.shellSystem.listTabs().length).toBe(tabsBefore);

    // 表已开进本栏，本栏不再是空栏；点本栏 ✕ 关栏后回到三按钮
    await act(async () => {
      clickInColumn(container, 0, 'table-close-column');
    });
    await act(async () => {});

    expect(inColumn(container, 0, 'table-empty-open')).not.toBeNull();

    // 再点「打开表格」→ 目录树点「tables」导航进入并列出其数据文件 → 点「..」回根 → 点「返回」回三按钮
    await act(async () => {
      clickInColumn(container, 0, 'table-empty-open');
    });
    await act(async () => {});

    await act(async () => {
      fireEvent.click(screen.getByTestId('table-list-entry-tables'));
    });
    await act(async () => {});

    expect(screen.getByTestId('table-list-entry-tables/demo.json')).not.toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByTestId('table-list-up'));
    });
    await act(async () => {});

    await act(async () => {
      clickInColumn(container, 0, 'table-empty-back');
    });
    await act(async () => {});

    expect(inColumn(container, 0, 'table-empty-create')).not.toBeNull();

    // 点「新建表格」→ 在新建表单里进入 tables 目录选定新建位置 → 输入 hero 回车：
    // 一对文件写在 tables 目录下、新表开进本栏（不新开标签）
    await act(async () => {
      clickInColumn(container, 0, 'table-empty-create');
    });
    await act(async () => {});

    await act(async () => {
      fireEvent.click(screen.getByTestId('table-list-entry-tables'));
    });
    await act(async () => {});

    await act(async () => {
      fireEvent.click(screen.getByTestId('table-list-create'));
    });

    const input = screen.getByTestId('table-list-create-input');

    await act(async () => {
      fireEvent.change(input, { target: { value: 'hero' } });
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    await act(async () => {});

    const createdNames = (await core.resourceSystem.listDirectory('tables')).map((entry) => entry.name);

    expect(createdNames).toEqual(expect.arrayContaining(['hero.json', 'hero.schema.json']));
    expect(core.shellSystem.listTabs().length).toBe(tabsBefore);
    expect(inColumn(container, 0, 'data-table')).not.toBeNull();

    // 点本栏 ✕ 关栏后删除 hero 表：目录在根、无预设区，导航进 tables 后经二次确认一对文件消失
    await act(async () => {
      clickInColumn(container, 0, 'table-close-column');
    });
    await act(async () => {});

    await act(async () => {
      clickInColumn(container, 0, 'table-empty-delete');
    });
    await act(async () => {});

    expect(inColumn(container, 0, 'table-list-preset-演示表')).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByTestId('table-list-entry-tables'));
    });
    await act(async () => {});

    await act(async () => {
      fireEvent.click(screen.getByTestId('table-list-delete-tables/hero.json'));
    });

    expect(screen.getByTestId('table-list-delete-confirm')).not.toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByTestId('table-list-delete-confirm'));
    });
    await act(async () => {});

    const remainingNames = (await core.resourceSystem.listDirectory('tables')).map((entry) => entry.name);

    expect(remainingNames).not.toContain('hero.json');
    expect(remainingNames).not.toContain('hero.schema.json');
    expect(inColumn(container, 0, 'table-list-delete-tables/hero.json')).toBeNull();
  });
});
