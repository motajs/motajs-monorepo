import { act, cleanup, configure, fireEvent, render, screen } from '@testing-library/react';
import { EditorCore, IEditorPanel, IEditorPanelFactoryParam } from '@motajs/editor-core';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deriveSchemaPath, TableListPanel, tableListPanelType } from '..';
import { ITablePanelTarget } from '../types';
import { CapabilityProvider, ITableEditorCapabilities, ITablePanelOpener } from '../../react';
import { createTableHarness, FakeFileSystem } from './fixtures';

configure({ testIdAttribute: 'data-test-id' });

// 每个用例结束后卸载已挂载的组件，避免 DOM 在用例之间累积
afterEach(() => {
  cleanup();
});

// 数据文件路径（`xxx.json`）
function tableDataPath(name: string): string {
  return `${name}.json`;
}

// schema 文件路径（按 `xxx.schema.json` 约定推导）
function tableSchemaPath(name: string): string {
  return deriveSchemaPath(tableDataPath(name));
}

// 注册一个捕获实例的列表面板类型，在首个标签页打开并返回实例
async function openListPanel(system: EditorCore, created: TableListPanel[]): Promise<TableListPanel> {
  system.shellSystem.registerPanelType({
    id: tableListPanelType.id,
    name: tableListPanelType.name,
    icon: tableListPanelType.icon,
    create: (param: IEditorPanelFactoryParam): IEditorPanel => {
      const panel = new TableListPanel(param);
      created.push(panel);
      return panel;
    },
  });

  const tabId = system.shellSystem.listTabs()[0].id;

  await act(async () => {
    await system.shellSystem.openPanelInTab(tabId, tableListPanelType.id);
  });

  return created[0];
}

// 用能力 Provider 包裹外壳渲染根，注入预设表与表格面板打开器
function renderWithCapabilities(system: EditorCore, capabilities: ITableEditorCapabilities): ReturnType<typeof render> {
  return render(
    createElement(CapabilityProvider, {
      capabilities,
      children: createElement(system.shellSystem.render()),
    }),
  );
}

// 读取某路径的原文（面板以文本写回），不存在时返回 undefined
async function readText(system: EditorCore, path: string): Promise<string | undefined> {
  try {
    const text = await system.resourceSystem.readContent(path);

    return typeof text === 'string' ? text : undefined;
  } catch {
    return undefined;
  }
}

// 读取根目录当前直接子条目名列表
async function rootNames(system: EditorCore): Promise<string[]> {
  const entries = await system.resourceSystem.listDirectory('');

  return entries.map((entry) => entry.name);
}

// 一个记录被打开路径的表格面板打开器
function createRecordingOpener(opened: string[]): ITablePanelOpener {
  return {
    open: async (param): Promise<void> => {
      opened.push((param.target as ITablePanelTarget).dataPath);
    },
  };
}

describe('打开表格列表：目录树过滤与预设', () => {
  // 目录树只列 json / jsonc 数据文件，排除 schema 约定文件与非表格文件，目录子项照常列出
  it('目录树只列 json / jsonc 数据文件并排除 schema 文件', async () => {
    const fs = new FakeFileSystem();

    fs.seed('a.json', '{}');
    fs.seed('a.schema.json', '{}');
    fs.seed('b.jsonc', '{}');
    fs.seed('b.schema.jsonc', '{}');
    fs.seed('note.txt', 'x');
    fs.seed('sub/c.json', '{}');
    const system = await createTableHarness(fs);
    const created: TableListPanel[] = [];
    const panel = await openListPanel(system, created);

    await act(async () => {
      await panel.onSwitchIn();
    });
    renderWithCapabilities(system, { tablePanel: createRecordingOpener([]) });

    expect(screen.getByTestId('table-list-entry-a.json')).not.toBeNull();
    expect(screen.getByTestId('table-list-entry-b.jsonc')).not.toBeNull();
    expect(screen.getByTestId('table-list-entry-sub')).not.toBeNull();
    expect(screen.queryByTestId('table-list-entry-a.schema.json')).toBeNull();
    expect(screen.queryByTestId('table-list-entry-b.schema.jsonc')).toBeNull();
    expect(screen.queryByTestId('table-list-entry-note.txt')).toBeNull();
  });

  // 预设表显示在列表上半区，点击经注入打开器打开其数据路径
  it('预设表显示并可经注入打开器打开', async () => {
    const fs = new FakeFileSystem();
    const system = await createTableHarness(fs);
    const created: TableListPanel[] = [];
    const panel = await openListPanel(system, created);

    await act(async () => {
      await panel.onSwitchIn();
    });

    const opened: string[] = [];

    renderWithCapabilities(system, {
      tablePanel: createRecordingOpener(opened),
      tablePresets: [{ name: '示例表', path: 'tables/demo.json' }],
    });

    expect(screen.getByTestId('table-list-preset-示例表')).not.toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByTestId('table-list-preset-示例表'));
    });

    expect(opened).toEqual(['tables/demo.json']);
  });

  // 点击目录树中的数据表经注入打开器打开，参数携带该数据路径
  it('点击目录树中的数据表经注入打开器打开', async () => {
    const fs = new FakeFileSystem();

    fs.seed('a.json', '{}');
    const system = await createTableHarness(fs);
    const created: TableListPanel[] = [];
    const panel = await openListPanel(system, created);

    await act(async () => {
      await panel.onSwitchIn();
    });

    const opened: string[] = [];

    renderWithCapabilities(system, { tablePanel: createRecordingOpener(opened) });

    await act(async () => {
      fireEvent.click(screen.getByTestId('table-list-entry-a.json'));
    });

    expect(opened).toEqual(['a.json']);
  });
});

describe('新建表格', () => {
  // 在当前选中目录下新建，写出一对 name.json（{}）与 name.schema.json（空对象 schema）
  it('新建在当前目录写出一对数据与 schema 文件', async () => {
    const fs = new FakeFileSystem();
    const system = await createTableHarness(fs);
    const created: TableListPanel[] = [];
    const panel = await openListPanel(system, created);

    await act(async () => {
      await panel.onSwitchIn();
    });
    renderWithCapabilities(system, { tablePanel: createRecordingOpener([]) });

    await act(async () => {
      fireEvent.click(screen.getByTestId('table-list-create'));
    });

    const input = screen.getByTestId('table-list-create-input');

    await act(async () => {
      fireEvent.change(input, { target: { value: 'hero' } });
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    await act(async () => {});

    expect(await readText(system, tableDataPath('hero'))).toBe('{}');
    expect(await readText(system, tableSchemaPath('hero'))).toBe('{"type":"object","properties":{}}');
    expect(await rootNames(system)).toEqual(expect.arrayContaining(['hero.json', 'hero.schema.json']));
  });
});

describe('删除表格', () => {
  // 删除前弹确认；确认后数据 + schema 一对文件同删，且不登记任何撤销上下文（D-13）
  it('删除经确认后删掉一对文件且不登记撤销', async () => {
    const fs = new FakeFileSystem();

    fs.seed('hero.json', '{}');
    fs.seed('hero.schema.json', '{}');
    const system = await createTableHarness(fs);
    const created: TableListPanel[] = [];
    const panel = await openListPanel(system, created);

    await act(async () => {
      await panel.onSwitchIn();
    });

    const addSpy = vi.spyOn(system.undoSystem, 'addUndoContext');

    renderWithCapabilities(system, { tablePanel: createRecordingOpener([]) });

    await act(async () => {
      fireEvent.click(screen.getByTestId('table-list-delete-hero.json'));
    });

    expect(screen.getByTestId('table-list-delete-confirm')).not.toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByTestId('table-list-delete-confirm'));
    });
    await act(async () => {});

    const names = await rootNames(system);

    expect(names).not.toContain('hero.json');
    expect(names).not.toContain('hero.schema.json');
    expect(addSpy).not.toHaveBeenCalled();
  });

  // 取消删除时一对文件都保留、不触发删除
  it('取消确认时不删除任何文件', async () => {
    const fs = new FakeFileSystem();

    fs.seed('hero.json', '{}');
    fs.seed('hero.schema.json', '{}');
    const system = await createTableHarness(fs);
    const created: TableListPanel[] = [];
    const panel = await openListPanel(system, created);

    await act(async () => {
      await panel.onSwitchIn();
    });
    renderWithCapabilities(system, { tablePanel: createRecordingOpener([]) });

    await act(async () => {
      fireEvent.click(screen.getByTestId('table-list-delete-hero.json'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('table-list-delete-cancel'));
    });

    expect(await readText(system, tableDataPath('hero'))).toBe('{}');
    expect(await readText(system, tableSchemaPath('hero'))).toBe('{}');
  });
});
