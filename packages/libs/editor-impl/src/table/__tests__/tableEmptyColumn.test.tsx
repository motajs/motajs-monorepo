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

// 点击指定栏内按 data-test-id 定位的元素
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

// 读取某路径资源原文；不存在时为 undefined
async function readText(system: EditorCore, path: string): Promise<string | undefined> {
  try {
    const text = await system.resourceSystem.readContent(path);

    return typeof text === 'string' ? text : undefined;
  } catch {
    return undefined;
  }
}

// 读取某目录当前直接子条目名列表
async function directoryNames(system: EditorCore, path: string): Promise<string[]> {
  const entries = await system.resourceSystem.listDirectory(path);

  return entries.map((entry) => entry.name);
}

// 用能力 Provider 包裹外壳渲染根，注入预设表等能力
function renderWithCapabilities(system: EditorCore, capabilities: ITableEditorCapabilities): ReturnType<typeof render> {
  return render(
    createElement(CapabilityProvider, {
      capabilities,
      children: createElement(system.shellSystem.render()),
    }),
  );
}

// 装配一个已注册表格面板类型、已在首个标签页打开未设目标面板（进入空栏）的用例环境
async function openEmptyColumnTablePanel(fs: FakeFileSystem): Promise<{ system: EditorCore; created: TablePanel[] }> {
  const system = await createTableHarness(fs);
  const created: TablePanel[] = [];

  registerTablePanel(system, created);

  const tabId = system.shellSystem.listTabs()[0].id;

  await act(async () => {
    await system.shellSystem.openPanelInTab(tabId, tablePanelType.id);
  });

  return { system, created };
}

describe('表格面板空栏内联控件', () => {
  // 未设目标的那一栏显示「打开表格 / 新建表格 / 删除表格」三个按钮
  it('空栏显示打开 / 新建 / 删除三个按钮', async () => {
    const fs = new FakeFileSystem();
    const { system } = await openEmptyColumnTablePanel(fs);

    const { container } = renderWithCapabilities(system, {});

    expect(inColumn(container, 0, 'table-empty-open')).not.toBeNull();
    expect(inColumn(container, 0, 'table-empty-create')).not.toBeNull();
    expect(inColumn(container, 0, 'table-empty-delete')).not.toBeNull();
  });

  // 打开态目录树只列 json / jsonc 数据文件并排除 schema 约定文件与非表格文件
  it('打开态目录树只列 json / jsonc 数据文件并排除 schema 文件', async () => {
    const fs = new FakeFileSystem();

    fs.seed('a.json', '{}');
    fs.seed('a.schema.json', '{}');
    fs.seed('b.jsonc', '{}');
    fs.seed('b.schema.jsonc', '{}');
    fs.seed('note.txt', 'x');
    fs.seed('sub/c.json', '{}');
    const { system } = await openEmptyColumnTablePanel(fs);

    const { container } = renderWithCapabilities(system, {});

    await act(async () => {
      clickInColumn(container, 0, 'table-empty-open');
    });
    await act(async () => {});

    expect(inColumn(container, 0, 'table-list-entry-a.json')).not.toBeNull();
    expect(inColumn(container, 0, 'table-list-entry-b.jsonc')).not.toBeNull();
    expect(inColumn(container, 0, 'table-list-entry-sub')).not.toBeNull();
    expect(inColumn(container, 0, 'table-list-entry-a.schema.json')).toBeNull();
    expect(inColumn(container, 0, 'table-list-entry-b.schema.jsonc')).toBeNull();
    expect(inColumn(container, 0, 'table-list-entry-note.txt')).toBeNull();
  });

  // 打开态点预设表把该表开进本栏（外壳标签数不变），并渲染 schema 驱动的行
  it('打开态点预设表开进本栏且不新开标签', async () => {
    const fs = new FakeFileSystem();

    fs.seed(tableDataPath('demo'), JSON.stringify({ title: 'demo' }));
    fs.seed(
      tableSchemaPath('demo'),
      JSON.stringify({ type: 'object', properties: { title: { type: 'string', description: '标题' } } }),
    );
    const { system } = await openEmptyColumnTablePanel(fs);

    const { container } = renderWithCapabilities(system, {
      tablePresets: [{ name: '示例表', path: tableDataPath('demo') }],
    });

    await act(async () => {
      clickInColumn(container, 0, 'table-empty-open');
    });
    await act(async () => {});

    const preset = inColumn(container, 0, 'table-list-preset-示例表');

    expect(preset).not.toBeNull();

    const tabsBefore = system.shellSystem.listTabs().length;

    await act(async () => {
      fireEvent.click(preset as Element);
    });
    await act(async () => {});

    expect(screen.getByText('标题')).not.toBeNull();
    expect(valueOf(container, 'title')).toBe('"demo"');
    expect(system.shellSystem.listTabs().length).toBe(tabsBefore);
  });

  // 新建态可先进入子目录选定位置：在选定子目录写出一对 name.json（空对象）+ name.schema.json（空 schema）并把新表开进本栏
  it('新建态进入子目录后在选定目录写出一对文件并把新表开进本栏', async () => {
    const fs = new FakeFileSystem();

    fs.seed('sub/existing.json', '{}');
    const { system, created } = await openEmptyColumnTablePanel(fs);

    const { container } = renderWithCapabilities(system, {});

    await act(async () => {
      clickInColumn(container, 0, 'table-empty-create');
    });
    await act(async () => {});

    // 进入目标子目录 sub 作为新建位置
    await act(async () => {
      clickInColumn(container, 0, 'table-list-entry-sub');
    });
    await act(async () => {});

    await act(async () => {
      clickInColumn(container, 0, 'table-list-create');
    });

    const input = inColumn(container, 0, 'table-list-create-input');

    if (input === null) throw new Error('名称输入缺失');

    await act(async () => {
      fireEvent.change(input, { target: { value: 'hero' } });
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    await act(async () => {});

    // 一对文件写在该目录（sub），而不是根目录
    expect(await readText(system, tableDataPath('sub/hero'))).toBe('{}');
    expect(await readText(system, tableSchemaPath('sub/hero'))).toBe('{"type":"object","properties":{}}');
    expect(await directoryNames(system, 'sub')).toEqual(expect.arrayContaining(['hero.json', 'hero.schema.json']));
    expect(await directoryNames(system, '')).not.toEqual(expect.arrayContaining(['hero.json']));

    // 新表开进本栏：本栏不再是空栏三按钮态，面板标题指向该数据文件
    expect(inColumn(container, 0, 'table-empty-open')).toBeNull();
    expect(created[0].getTitle()).toBe('表格 sub/hero.json');
  });

  // 删除态经二次确认后数据 + schema 一对文件同删、目录树不再出现，且未登记任何撤销（D-13）
  it('删除态经二次确认后一对文件消失且不登记撤销', async () => {
    const fs = new FakeFileSystem();

    fs.seed(tableDataPath('hero'), '{}');
    fs.seed(tableSchemaPath('hero'), '{}');
    const { system } = await openEmptyColumnTablePanel(fs);

    const { container } = renderWithCapabilities(system, {
      tablePresets: [{ name: '示例表', path: 'tables/demo.json' }],
    });

    await act(async () => {
      clickInColumn(container, 0, 'table-empty-delete');
    });
    await act(async () => {});

    // 删除态浏览器不渲染预设区：与打开态的唯一差异就是是否注入预设表
    expect(inColumn(container, 0, 'table-list-preset-示例表')).toBeNull();

    const deleteEntry = inColumn(container, 0, 'table-list-delete-hero.json');

    if (deleteEntry === null) throw new Error('删除入口缺失');

    const addSpy = vi.spyOn(system.undoSystem, 'addUndoContext');

    addSpy.mockClear();

    await act(async () => {
      fireEvent.click(deleteEntry);
    });

    expect(screen.getByTestId('table-list-delete-confirm')).not.toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByTestId('table-list-delete-confirm'));
    });
    await act(async () => {});

    const names = await directoryNames(system, '');

    expect(names).not.toContain('hero.json');
    expect(names).not.toContain('hero.schema.json');
    expect(inColumn(container, 0, 'table-list-delete-hero.json')).toBeNull();
    expect(addSpy).not.toHaveBeenCalled();
  });

  // 删除二次确认取消时一对文件都保留、不触发删除
  it('删除二次确认取消时一对文件都保留', async () => {
    const fs = new FakeFileSystem();

    fs.seed(tableDataPath('hero'), '{}');
    fs.seed(tableSchemaPath('hero'), '{}');
    const { system } = await openEmptyColumnTablePanel(fs);

    const { container } = renderWithCapabilities(system, {});

    await act(async () => {
      clickInColumn(container, 0, 'table-empty-delete');
    });
    await act(async () => {});

    const deleteEntry = inColumn(container, 0, 'table-list-delete-hero.json');

    if (deleteEntry === null) throw new Error('删除入口缺失');

    await act(async () => {
      fireEvent.click(deleteEntry);
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('table-list-delete-cancel'));
    });

    expect(await readText(system, tableDataPath('hero'))).toBe('{}');
    expect(await readText(system, tableSchemaPath('hero'))).toBe('{}');
  });
});
