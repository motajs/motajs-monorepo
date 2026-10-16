import { act, cleanup, configure, fireEvent, render, screen } from '@testing-library/react';
import { EditorCore, IEditorPanel, IEditorPanelFactoryParam } from '@motajs/editor-core';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deriveSchemaPath, TablePanel, tablePanelType } from '..';
import { CapabilityProvider, ITableEditorCapabilities } from '../../react';
import { createTableHarness, FakeFileSystem } from './fixtures';

configure({ testIdAttribute: 'data-test-id' });

// 每个用例结束后卸载已挂载的组件并还原被替换的实现，避免 DOM 与替身在用例之间累积
afterEach(() => {
  cleanup();
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

// 注册一个捕获实例的表格面板类型：外壳每次创建表格面板都把实例推入 created
function registerTablePanel(system: EditorCore, created: TablePanel[]): void {
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
}

// 取表格面板第 index 栏的 DOM 元素：空栏断言限定到单栏，避免加宽窗口时同 test-id 重复命中
function columnAt(container: HTMLElement, index: number): Element | null {
  return container.querySelectorAll('.etable-column')[index] ?? null;
}

// 在指定栏内按 data-test-id 查询元素
function inColumn(container: HTMLElement, index: number, testId: string): Element | null {
  const column = columnAt(container, index);

  return column === null ? null : column.querySelector(`[data-test-id="${testId}"]`);
}

// 点击指定栏内按 data-test-id 定位的按钮
function clickInColumn(container: HTMLElement, index: number, testId: string): void {
  const element = inColumn(container, index, testId);

  if (element === null) throw new Error(`栏内元素缺失: ${testId}`);

  fireEvent.click(element);
}

// 读取某个字段值单元格内文本域的当前文本
function valueOf(container: HTMLElement, field: string): string | undefined {
  const cell = container.querySelector(`[data-test-id="table-input-${field}"]`);
  const textarea = cell === null ? null : cell.querySelector('textarea');

  return textarea === null ? undefined : textarea.value;
}

// 在字段值文本域中输入文本并提交（失焦）
async function commitText(container: HTMLElement, field: string, text: string): Promise<void> {
  const cell = container.querySelector(`[data-test-id="table-input-${field}"]`);
  const textarea = cell === null ? null : cell.querySelector('textarea');

  await act(async () => {
    fireEvent.change(textarea as HTMLTextAreaElement, { target: { value: text } });
    fireEvent.blur(textarea as HTMLTextAreaElement);
  });
}

// 读取某路径数据文件的解析值（面板以文本写回）
async function readData(system: EditorCore, path: string): Promise<unknown> {
  const text = await system.resourceSystem.readContent(path);

  return typeof text === 'string' ? JSON.parse(text) : undefined;
}

// 读取根目录当前直接子条目名列表
async function rootNames(system: EditorCore): Promise<string[]> {
  const entries = await system.resourceSystem.listDirectory('');

  return entries.map((entry) => entry.name);
}

// 用能力 Provider 包裹外壳渲染根，注入预设表
function renderWithCapabilities(system: EditorCore, capabilities: ITableEditorCapabilities): ReturnType<typeof render> {
  return render(
    createElement(CapabilityProvider, {
      capabilities,
      children: createElement(system.shellSystem.render()),
    }),
  );
}

describe('打开 / 新建 / 删除端到端集成', () => {
  // 单个用例贯穿：空栏三按钮 → 预设开进本栏 → 目录树打开并编辑撤销 → 目录重取 → 新建开进本栏 → 删除确认后一对文件消失且不可撤销
  it('表格面板空栏内贯通打开 / 新建 / 删除且删除不可撤销', async () => {
    const fs = new FakeFileSystem();

    fs.seed(tableDataPath('hero'), JSON.stringify({ name: 'a', note: 'x' }));
    fs.seed(
      tableSchemaPath('hero'),
      JSON.stringify({
        type: 'object',
        properties: {
          name: { type: 'string', description: '名字' },
          note: { type: ['string', 'null'], description: '备注' },
        },
      }),
    );
    fs.seed('notes.txt', 'x');
    fs.seed('tables/demo.json', JSON.stringify({ title: 'demo' }));
    fs.seed(
      'tables/demo.schema.json',
      JSON.stringify({ type: 'object', properties: { title: { type: 'string', description: '标题' } } }),
    );

    const system = await createTableHarness(fs);
    const created: TablePanel[] = [];

    registerTablePanel(system, created);

    // 在首个标签页打开一个未设目标的表格面板（进入空栏三按钮态）
    const tabId = system.shellSystem.listTabs()[0].id;

    await act(async () => {
      await system.shellSystem.openPanelInTab(tabId, tablePanelType.id);
    });

    const { container } = renderWithCapabilities(system, {
      tablePresets: [{ name: '预设表', path: 'tables/demo.json' }],
    });

    // 空栏初始态：本栏显示「打开表格 / 新建表格 / 删除表格」三个按钮
    expect(inColumn(container, 0, 'table-empty-open')).not.toBeNull();
    expect(inColumn(container, 0, 'table-empty-create')).not.toBeNull();
    expect(inColumn(container, 0, 'table-empty-delete')).not.toBeNull();

    // 点「打开表格」：本栏内联展示可复用浏览器
    await act(async () => {
      clickInColumn(container, 0, 'table-empty-open');
    });
    await act(async () => {});

    // 目录树只列 json / jsonc 数据文件并排除 schema 约定文件与非表格文件；预设表「预设表」可见
    expect(screen.getByTestId('table-list-entry-hero.json')).not.toBeNull();
    expect(screen.getByTestId('table-list-entry-tables')).not.toBeNull();
    expect(screen.queryByTestId('table-list-entry-hero.schema.json')).toBeNull();
    expect(screen.queryByTestId('table-list-entry-notes.txt')).toBeNull();
    expect(screen.getByTestId('table-list-preset-预设表')).not.toBeNull();

    // 从预设打开演示表：开进本栏（不新开标签）并渲染 schema 驱动行
    const tabsBefore = system.shellSystem.listTabs().length;

    await act(async () => {
      fireEvent.click(screen.getByTestId('table-list-preset-预设表'));
    });
    await act(async () => {});

    expect(screen.getByText('标题')).not.toBeNull();
    expect(valueOf(container, 'title')).toBe('"demo"');
    expect(system.shellSystem.listTabs().length).toBe(tabsBefore);

    // 点本栏 ✕ 关栏回三按钮（emptyMode 复位为 Buttons）
    await act(async () => {
      clickInColumn(container, 0, 'table-close-column');
    });
    await act(async () => {});

    expect(inColumn(container, 0, 'table-empty-open')).not.toBeNull();

    // 点「打开表格」→ 目录树打开 hero 表：开进本栏（不新开标签）并渲染字段行
    await act(async () => {
      clickInColumn(container, 0, 'table-empty-open');
    });
    await act(async () => {});

    await act(async () => {
      fireEvent.click(screen.getByTestId('table-list-entry-hero.json'));
    });
    await act(async () => {});

    expect(screen.getByText('名字')).not.toBeNull();
    expect(valueOf(container, 'name')).toBe('"a"');
    expect(system.shellSystem.listTabs().length).toBe(tabsBefore);

    // 编辑一个字段值：资源被写回；一次撤销后还原
    await commitText(container, 'name', '"b"');

    expect(await readData(system, tableDataPath('hero'))).toEqual({ name: 'b', note: 'x' });

    await act(async () => {
      await system.undoSystem.undo();
    });

    expect(await readData(system, tableDataPath('hero'))).toEqual({ name: 'a', note: 'x' });
    expect(valueOf(container, 'name')).toBe('"a"');

    // 目录重取：外部新增数据文件后重新进入「打开表格」态，本栏重新列举目录并列出新文件
    await act(async () => {
      await system.resourceSystem.createResource('added.json', '{}');
    });

    const listSpy = vi.spyOn(system.resourceSystem, 'listDirectory');

    await act(async () => {
      clickInColumn(container, 0, 'table-close-column');
    });
    await act(async () => {});

    await act(async () => {
      clickInColumn(container, 0, 'table-empty-open');
    });
    await act(async () => {});

    expect(listSpy).toHaveBeenCalled();
    expect(screen.getByTestId('table-list-entry-added.json')).not.toBeNull();

    // 返回三按钮后新建一张表：在当前目录写出一对 name.json + name.schema.json，且新表开进本栏
    await act(async () => {
      clickInColumn(container, 0, 'table-empty-back');
    });
    await act(async () => {});

    await act(async () => {
      clickInColumn(container, 0, 'table-empty-create');
    });
    await act(async () => {});

    await act(async () => {
      fireEvent.click(screen.getByTestId('table-list-create'));
    });

    const input = screen.getByTestId('table-list-create-input');

    await act(async () => {
      fireEvent.change(input, { target: { value: 'newbie' } });
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    await act(async () => {});

    expect(await rootNames(system)).toEqual(expect.arrayContaining(['newbie.json', 'newbie.schema.json']));
    expect(system.shellSystem.listTabs().length).toBe(tabsBefore);

    // 新表开进本栏：面板标题指向该数据文件（此刻面板内仅一栏有目标）
    expect(created[0].getTitle()).toBe('表格 newbie.json');

    // 点本栏 ✕ 关栏后删除新表：经确认后一对文件消失、目录树不再出现，且未登记任何撤销（D-13）
    await act(async () => {
      clickInColumn(container, 0, 'table-close-column');
    });
    await act(async () => {});

    await act(async () => {
      clickInColumn(container, 0, 'table-empty-delete');
    });
    await act(async () => {});

    const addSpy = vi.spyOn(system.undoSystem, 'addUndoContext');

    addSpy.mockClear();

    await act(async () => {
      fireEvent.click(screen.getByTestId('table-list-delete-newbie.json'));
    });

    expect(screen.getByTestId('table-list-delete-confirm')).not.toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByTestId('table-list-delete-confirm'));
    });
    await act(async () => {});

    const namesAfterDelete = await rootNames(system);

    expect(namesAfterDelete).not.toContain('newbie.json');
    expect(namesAfterDelete).not.toContain('newbie.schema.json');
    expect(screen.queryByTestId('table-list-delete-newbie.json')).toBeNull();
    expect(addSpy).not.toHaveBeenCalled();
  }, 30000);
});
