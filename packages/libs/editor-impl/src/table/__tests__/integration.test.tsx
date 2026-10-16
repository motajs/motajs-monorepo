import { act, cleanup, configure, fireEvent, render, screen } from '@testing-library/react';
import { EditorCore, IEditorPanel, IEditorPanelFactoryParam } from '@motajs/editor-core';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deriveSchemaPath, tablePanelType, TablePanel } from '..';
import { ITablePanelTarget } from '../types';
import { CapabilityProvider, ITablePanelOpener } from '../../react';
import { createTableHarness, FakeFileSystem } from './fixtures';

configure({ testIdAttribute: 'data-test-id' });

// 每个用例结束后卸载已挂载的组件并清理被 stub 的浏览器对话框，避免 DOM 与全局桩在用例之间累积
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// 数据文件路径（`xxx.json`）
function tableDataPath(name: string): string {
  return `${name}.json`;
}

// schema 文件路径（按 `xxx.schema.json` 约定推导）
function tableSchemaPath(name: string): string {
  return deriveSchemaPath(tableDataPath(name));
}

// 注册一个捕获实例的面板类型：每次外壳创建表格面板都把实例推入 created，供测试与打开器引用
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

// 在第一个空白标签页打开表格面板并返回其实例
async function openFirstPanel(system: EditorCore, created: TablePanel[]): Promise<TablePanel> {
  registerTablePanel(system, created);

  const tabId = system.shellSystem.listTabs()[0].id;

  await act(async () => {
    await system.shellSystem.openPanelInTab(tabId, tablePanelType.id);
  });

  return created[0];
}

// 组合根注入的表格面板打开器：新开一个标签承载目标面板并设好目标（D-06）
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

// 以文本预置一张表的数据与 schema
function seed(fs: FakeFileSystem, name: string, data: unknown, schema: unknown): void {
  fs.seed(tableDataPath(name), JSON.stringify(data));
  fs.seed(tableSchemaPath(name), JSON.stringify(schema));
}

// 读取某个路径的当前内容（面板以文本写回，读取后解析）
async function readContent(system: EditorCore, path: string): Promise<unknown> {
  const text = await system.resourceSystem.readContent(path);

  if (typeof text !== 'string') return undefined;

  return JSON.parse(text);
}

// 把面板目标指向给定数据表，并等待一次切入刷新完成
async function setTarget(panel: TablePanel, name: string): Promise<void> {
  panel.setTable({ dataPath: tableDataPath(name) });
  await panel.onSwitchIn();
}

// 读取目标表的当前数据内容
async function readData(system: EditorCore, name: string): Promise<unknown> {
  return readContent(system, tableDataPath(name));
}

/**
 * 把面板内存中的未落盘改动写回资源（手动保存模型）
 * @param panel 表格面板实例
 */
async function savePanel(panel: TablePanel): Promise<void> {
  await panel.save();
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

// 切到工具栏中的某编辑模式（按分段控件文案点击）
async function switchMode(label: string): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByText(label));
  });
}

// 点某行 gutter 的「+」，在插入点输入名称并回车确认
async function gutterAdd(field: string, name: string): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByTestId(`table-add-after-${field}`));
  });

  const input = screen.getByTestId(`table-add-input-${field}`);

  await act(async () => {
    fireEvent.change(input, { target: { value: name } });
    fireEvent.keyDown(input, { key: 'Enter' });
  });
}

// 点某行 gutter 的「−」
async function gutterDelete(field: string): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByTestId(`table-delete-${field}`));
  });
}

// 用能力 Provider 包裹外壳渲染根，注入携带表格面板打开器的能力包
function renderWithOpener(system: EditorCore, opener: ITablePanelOpener): ReturnType<typeof render> {
  return render(
    createElement(CapabilityProvider, {
      capabilities: { tablePanel: opener },
      children: createElement(system.shellSystem.render()),
    }),
  );
}

// 点击工具栏「更多」触发按钮展开下拉（编辑 Schema / 在代码编辑器中打开收在此下拉内）
async function openToolbarMenu(): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByTestId('table-more'));
  });
}

describe('阶段集成：完整流程与安全边界', () => {
  // 单个用例端到端跑通「打开 → 编辑 → 添加 → 删除（各一步撤销 / 重做）→ 注入打开器新开 schema 面板 → 改 schema → 切回数据面板因切入刷新而重算」
  it('数据表完整流程与 schema 切入刷新端到端跑通', async () => {
    const fs = new FakeFileSystem();

    seed(
      fs,
      't',
      { name: 'a', note: 'x' },
      {
        type: 'object',
        properties: {
          name: { type: 'string', description: '名字' },
          note: { type: ['string', 'null'], description: '备注' },
        },
      },
    );
    const system = await createTableHarness(fs);
    const created: TablePanel[] = [];
    const panel = await openFirstPanel(system, created);
    const firstTab = system.shellSystem.listTabs()[0].id;

    await act(async () => {
      await setTarget(panel, 't');
    });

    const { container } = renderWithOpener(system, createOpener(system, created));

    // 打开后按 schema 驱动渲染行：列头齐备、姓名与备注各一行、值单元格显示 JSON 文本、注释取自 schema
    expect(screen.getByText('条目')).not.toBeNull();
    expect(screen.getByText('操作')).not.toBeNull();
    expect(valueOf(container, 'name')).toBe('"a"');
    expect(valueOf(container, 'note')).toBe('"x"');
    expect(screen.getByText('名字')).not.toBeNull();

    // 编辑一个值：写回资源并更新显示，撤销还原旧值、重做恢复新值（一次编辑恰为一步撤销）
    await commitText(container, 'name', '"b"');
    await savePanel(panel);

    expect(await readData(system, 't')).toEqual({ name: 'b', note: 'x' });
    expect(valueOf(container, 'name')).toBe('"b"');

    await act(async () => {
      await system.undoSystem.undo();
    });
    await savePanel(panel);

    expect(await readData(system, 't')).toEqual({ name: 'a', note: 'x' });

    await act(async () => {
      await system.undoSystem.redo();
    });
    await savePanel(panel);

    expect(await readData(system, 't')).toEqual({ name: 'b', note: 'x' });

    // 添加一行：添加模式点「name」行 gutter 的「+」并输入名字，新行插到 name 之后；撤销移除、重做加回
    await switchMode('添加');
    await gutterAdd('name', 'extra');
    await savePanel(panel);

    expect(await readData(system, 't')).toEqual({ name: 'b', note: 'x', extra: null });

    await act(async () => {
      await system.undoSystem.undo();
    });
    await savePanel(panel);

    expect(await readData(system, 't')).toEqual({ name: 'b', note: 'x' });

    await act(async () => {
      await system.undoSystem.redo();
    });
    await savePanel(panel);

    expect(await readData(system, 't')).toEqual({ name: 'b', note: 'x', extra: null });

    // 删除一行：schema 允许 null 的字段在删除模式点「−」直接移除；撤销恢复、重做再次删除
    await switchMode('删除');
    await gutterDelete('note');
    await savePanel(panel);

    expect(await readData(system, 't')).toEqual({ name: 'b', extra: null });

    await act(async () => {
      await system.undoSystem.undo();
    });
    await savePanel(panel);

    expect(await readData(system, 't')).toEqual({ name: 'b', note: 'x', extra: null });

    await act(async () => {
      await system.undoSystem.redo();
    });
    await savePanel(panel);

    expect(await readData(system, 't')).toEqual({ name: 'b', extra: null });

    // 经注入打开器新开 schema 面板：active 成为 schema 视图、渲染提示条且不再显示「编辑 Schema」菜单项
    await openToolbarMenu();

    await act(async () => {
      fireEvent.click(screen.getByTestId('table-edit-schema'));
    });

    expect(created.length).toBe(2);
    expect(screen.getByTestId('schema-banner')).not.toBeNull();

    await openToolbarMenu();

    expect(screen.getByTestId('table-open-code')).not.toBeNull();
    expect(screen.queryByTestId('table-edit-schema')).toBeNull();

    // 在 schema 面板里改 name 的注释：整份写回 schema 资源；此刻数据面板不可见、无跨面板广播
    await commitText(container, 'properties-name-description', '"改名"');
    await savePanel(created[1]);

    expect(await readContent(system, tableSchemaPath('t'))).toEqual({
      type: 'object',
      properties: {
        name: { type: 'string', description: '改名' },
        note: { type: ['string', 'null'], description: '备注' },
      },
      'x-order': ['name', 'extra', 'note'],
    });

    // 切回数据面板：外壳切入触发 onSwitchIn 重新请求 schema 并重算，注释更新为新值
    await act(async () => {
      system.shellSystem.activateTab(firstTab);
    });
    await act(async () => {});

    expect(screen.getByText('改名')).not.toBeNull();
    expect(screen.queryByText('名字')).toBeNull();
  }, 20000);

  // 字段名、注释与值均含脚本样文本时以字面文本渲染，绝不生成元素（XSS 回归守卫）
  it('脚本样字段名、注释与值以字面文本渲染', async () => {
    const fs = new FakeFileSystem();
    const fieldName = '<img src=x onerror="alert(1)">';
    const description = '<script>alert(2)</script>';
    const payload = '<img src=x onerror="alert(3)">';

    fs.seed(tableDataPath('xss'), JSON.stringify({ [fieldName]: payload }));
    fs.seed(
      tableSchemaPath('xss'),
      JSON.stringify({
        type: 'object',
        properties: { [fieldName]: { type: 'string', description } },
      }),
    );
    const system = await createTableHarness(fs);
    const created: TablePanel[] = [];
    const panel = await openFirstPanel(system, created);

    await act(async () => {
      await setTarget(panel, 'xss');
    });

    const { container } = render(createElement(system.shellSystem.render()));

    // 字段名与注释作为文本节点渲染
    expect(screen.getByText(fieldName)).not.toBeNull();
    expect(screen.getByText(description)).not.toBeNull();

    // 值显示为 JSON 文本而非标记
    const textarea = container.querySelector('textarea');

    expect(textarea === null ? undefined : textarea.value).toBe(JSON.stringify(payload));

    // 未生成任何由脚本样文本驱动的元素
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
  });
});
