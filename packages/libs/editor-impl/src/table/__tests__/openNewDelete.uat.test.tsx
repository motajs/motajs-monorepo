import { act, cleanup, configure, fireEvent, render, screen } from '@testing-library/react';
import { EditorCore, IEditorPanel, IEditorPanelFactoryParam } from '@motajs/editor-core';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deriveSchemaPath, TableListPanel, tableListPanelType, TablePanel, tablePanelType } from '..';
import { ITablePanelTarget } from '../types';
import { CapabilityProvider, ITableEditorCapabilities, ITablePanelOpener } from '../../react';
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

// 注册一个捕获实例的列表面板类型：外壳每次创建列表面板都把实例推入 created
function registerListPanel(system: EditorCore, created: TableListPanel[]): void {
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
}

// 组合根注入的表格面板打开器：新开一个标签承载目标面板并按目标设置（D-06）
function createOpener(system: EditorCore, created: TablePanel[]): ITablePanelOpener {
  return {
    open: async (param): Promise<void> => {
      const target = param.target as ITablePanelTarget;
      const tabId = system.shellSystem.openBlankTab();

      await system.shellSystem.openPanelInTab(tabId, tablePanelType.id);
      const panel = created[created.length - 1];

      panel.setTable(target);
      await panel.onSwitchIn();
    },
  };
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

// 用能力 Provider 包裹外壳渲染根，注入表格面板打开器与预设表
function renderWithCapabilities(system: EditorCore, capabilities: ITableEditorCapabilities): ReturnType<typeof render> {
  return render(
    createElement(CapabilityProvider, {
      capabilities,
      children: createElement(system.shellSystem.render()),
    }),
  );
}

describe('打开 / 新建 / 删除端到端集成', () => {
  // 单个用例贯穿：打开列表 → 预设打开 → 目录树打开并编辑撤销 → 切入刷新 → 新建 → 打开新表 → 删除确认后消失且不可撤销
  it(
    '打开 / 新建 / 删除端到端贯通且删除不可撤销',
    async () => {
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
      const listCreated: TableListPanel[] = [];

      registerTablePanel(system, created);
      registerListPanel(system, listCreated);

      const listTabId = system.shellSystem.listTabs()[0].id;

      await act(async () => {
        await system.shellSystem.openPanelInTab(listTabId, tableListPanelType.id);
      });

      const listPanel = listCreated[0];

      if (listPanel === undefined) throw new Error('列表面板实例缺失');

      await act(async () => {
        await listPanel.onSwitchIn();
      });

      const { container } = renderWithCapabilities(system, {
        tablePanel: createOpener(system, created),
        tablePresets: [{ name: '预设表', path: 'tables/demo.json' }],
      });

      // 目录树只列 json / jsonc 数据文件并排除 schema 约定文件与非表格文件；目录子项与预设表可见
      expect(screen.getByTestId('table-list-entry-hero.json')).not.toBeNull();
      expect(screen.getByTestId('table-list-entry-tables')).not.toBeNull();
      expect(screen.queryByTestId('table-list-entry-hero.schema.json')).toBeNull();
      expect(screen.queryByTestId('table-list-entry-notes.txt')).toBeNull();
      expect(screen.getByTestId('table-list-preset-预设表')).not.toBeNull();

      // 从预设打开演示表：外壳新开一个标签承载表格面板并渲染 schema 驱动行
      await act(async () => {
        fireEvent.click(screen.getByTestId('table-list-preset-预设表'));
      });
      await act(async () => {});

      expect(screen.getByText('标题')).not.toBeNull();
      expect(valueOf(container, 'title')).toBe('"demo"');

      // 切回列表并从目录树打开 hero 表：外壳新开一个标签承载表格面板并渲染字段行
      await act(async () => {
        system.shellSystem.activateTab(listTabId);
      });
      await act(async () => {});

      await act(async () => {
        fireEvent.click(screen.getByTestId('table-list-entry-hero.json'));
      });
      await act(async () => {});

      expect(screen.getByText('名字')).not.toBeNull();
      expect(valueOf(container, 'name')).toBe('"a"');

      // 编辑一个字段值：资源被写回；一次撤销后还原
      await commitText(container, 'name', '"b"');

      expect(await readData(system, tableDataPath('hero'))).toEqual({ name: 'b', note: 'x' });

      await act(async () => {
        await system.undoSystem.undo();
      });

      expect(await readData(system, tableDataPath('hero'))).toEqual({ name: 'a', note: 'x' });
      expect(valueOf(container, 'name')).toBe('"a"');

      // 切出再切入刷新：外部新增一个数据文件后切回列表，切入点重新列举目录并列出新文件
      await act(async () => {
        await system.resourceSystem.createResource('added.json', '{}');
      });

      const listSpy = vi.spyOn(system.resourceSystem, 'listDirectory');

      await act(async () => {
        system.shellSystem.activateTab(listTabId);
      });
      await act(async () => {});

      expect(listSpy).toHaveBeenCalled();
      expect(screen.getByTestId('table-list-entry-added.json')).not.toBeNull();

      // 新建一张表：在当前目录写出一对 name.json + name.schema.json，且目录树出现新表
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
      expect(screen.getByTestId('table-list-entry-newbie.json')).not.toBeNull();

      // 打开新表：外壳新开一个标签承载它，且面板标题指向该数据文件
      const tabsBefore = system.shellSystem.listTabs().length;

      await act(async () => {
        fireEvent.click(screen.getByTestId('table-list-entry-newbie.json'));
      });
      await act(async () => {});

      expect(system.shellSystem.listTabs().length).toBe(tabsBefore + 1);

      const newbiePanel = created[created.length - 1];

      expect(newbiePanel.getTitle()).toBe('表格 newbie.json');

      // 切回列表删除新表：经确认后一对文件消失、目录树不再出现，且未登记任何撤销（D-13）
      await act(async () => {
        system.shellSystem.activateTab(listTabId);
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
      expect(screen.queryByTestId('table-list-entry-newbie.json')).toBeNull();
      expect(addSpy).not.toHaveBeenCalled();
    },
    30000,
  );
});
