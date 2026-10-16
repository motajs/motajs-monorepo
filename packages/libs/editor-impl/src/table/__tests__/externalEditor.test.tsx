import { act, cleanup, configure, fireEvent, render, screen, within } from '@testing-library/react';
import { EditorCore, IEditorPanel, IEditorPanelFactoryParam } from '@motajs/editor-core';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deriveSchemaPath, tablePanelType, TableExternalEditor, TablePanel } from '..';
import { CapabilityProvider, ICodeEditorOpenRequest, ITableEditorCapabilities } from '../../react';
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

// 在空白标签页打开表格面板并返回其实例
async function openPanel(system: EditorCore): Promise<TablePanel> {
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

  await system.shellSystem.openPanelInTab(tabId, tablePanelType.id);

  return created[0];
}

// 以文本预置一张表的数据与 schema
function seed(fs: FakeFileSystem, name: string, data: unknown, schema: unknown): void {
  fs.seed(tableDataPath(name), JSON.stringify(data));
  fs.seed(tableSchemaPath(name), JSON.stringify(schema));
}

// 把面板目标指向数据表，并等待一次切入刷新完成
async function setTarget(panel: TablePanel, name: string): Promise<void> {
  panel.setTable({ dataPath: tableDataPath(name) });
  await panel.onSwitchIn();
}

// 读取目标表的当前数据内容（面板以文本写回，读取后解析）
async function readData(system: EditorCore, name: string): Promise<unknown> {
  const text = await system.resourceSystem.readContent(tableDataPath(name));

  if (typeof text !== 'string') return undefined;

  return JSON.parse(text);
}

/**
 * 把面板内存中的未落盘改动写回资源（手动保存模型）
 * @param panel 表格面板实例
 */
async function savePanel(panel: TablePanel): Promise<void> {
  await panel.save();
}

// 用能力 Provider 包裹外壳渲染根，注入假能力包（缺省时由 Provider 补齐默认弹窗打开器）
function renderWithCapabilities(system: EditorCore, capabilities: ITableEditorCapabilities): ReturnType<typeof render> {
  return render(
    createElement(CapabilityProvider, {
      capabilities,
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

// 点击某字段操作列中指定文案的按钮，并等待一次分发完成
async function clickAction(field: string, name: string): Promise<void> {
  const cell = screen.getByTestId(`table-edit-${field}`);

  await act(async () => {
    fireEvent.click(within(cell).getByRole('button', { name }));
  });
}

// 连点两次某字段行，构成一次双击
async function doubleClickRow(field: string): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByTestId(`table-row-${field}`));
    fireEvent.click(screen.getByTestId(`table-row-${field}`));
  });
}

describe('操作列显示规则', () => {
  // 「编辑」仅在字段声明 `x-editor` 时显示，其余字段不显示编辑动作
  it('「编辑」仅在声明 x-editor 的字段显示', async () => {
    const fs = new FakeFileSystem();

    seed(
      fs,
      't',
      { script: 'a', plain: 'b' },
      {
        type: 'object',
        properties: {
          script: { type: 'string', 'x-editor': TableExternalEditor.Code },
          plain: { type: 'string' },
        },
      },
    );
    const system = await createTableHarness(fs);
    const panel = await openPanel(system);

    await setTarget(panel, 't');
    renderWithCapabilities(system, {});

    expect(within(screen.getByTestId('table-edit-script')).getByRole('button', { name: '编辑' })).not.toBeNull();
    expect(within(screen.getByTestId('table-edit-plain')).queryByRole('button', { name: '编辑' })).toBeNull();
  });

  // `x-editor: MultiSelect` 显示「多选框编辑」并打开通用多选弹窗，结果经统一路径写回
  it('「多选框编辑」打开多选弹窗并写回选中 id', async () => {
    const fs = new FakeFileSystem();

    seed(
      fs,
      't',
      { tags: ['a'] },
      {
        type: 'object',
        properties: {
          tags: { type: 'array', items: { enum: ['a', 'b'] }, 'x-editor': TableExternalEditor.MultiSelect },
        },
      },
    );
    const system = await createTableHarness(fs);
    const panel = await openPanel(system);

    await setTarget(panel, 't');

    const multiSelect = { open: vi.fn(async () => ({ ids: ['a', 'b'] })) };

    renderWithCapabilities(system, { multiSelect });

    await clickAction('tags', '多选框编辑');
    await savePanel(panel);

    expect(multiSelect.open).toHaveBeenCalledTimes(1);
    expect(await readData(system, 't')).toEqual({ tags: ['a', 'b'] });
  });

  // 只读字段显示「复制」，点击经注入的剪贴板能力复制当前值文本
  it('只读字段的「复制」经注入能力复制值文本', async () => {
    const fs = new FakeFileSystem();

    seed(fs, 't', { note: 'text' }, { type: 'object', properties: { note: { type: 'string', readOnly: true } } });
    const system = await createTableHarness(fs);
    const panel = await openPanel(system);

    await setTarget(panel, 't');

    const copy = { copyText: vi.fn(async (): Promise<void> => {}) };

    renderWithCapabilities(system, { copy });

    await clickAction('note', '复制');

    expect(copy.copyText).toHaveBeenCalledWith('text');
  });
});

describe('外部编辑器分发', () => {
  // `x-editor: Material` 的「编辑」分发到多选弹窗（而非代码面板），选中结果写回
  it('material 字段分发到多选弹窗而非代码面板', async () => {
    const fs = new FakeFileSystem();

    seed(
      fs,
      't',
      { pic: [] },
      { type: 'object', properties: { pic: { type: 'array', 'x-editor': TableExternalEditor.Material } } },
    );
    const system = await createTableHarness(fs);
    const panel = await openPanel(system);

    await setTarget(panel, 't');

    const multiSelect = { open: vi.fn(async () => ({ ids: ['a'] })) };
    const codeEditor = { open: vi.fn(async (): Promise<string | null> => 'x') };

    renderWithCapabilities(system, { multiSelect, codeEditor });

    await clickAction('pic', '编辑');
    await savePanel(panel);

    expect(multiSelect.open).toHaveBeenCalledTimes(1);
    expect(codeEditor.open).not.toHaveBeenCalled();
    expect(await readData(system, 't')).toEqual({ pic: ['a'] });
  });

  // `x-editor: Code` 的「编辑」打开独立面板打开器，返回值经校验后可撤销路径写回
  it('code 字段打开独立面板并经可撤销路径提交', async () => {
    const fs = new FakeFileSystem();

    seed(
      fs,
      't',
      { script: 'old' },
      { type: 'object', properties: { script: { type: 'string', 'x-editor': TableExternalEditor.Code } } },
    );
    const system = await createTableHarness(fs);
    const panel = await openPanel(system);

    await setTarget(panel, 't');

    const requests: ICodeEditorOpenRequest[] = [];
    const codeEditor = {
      open: vi.fn(async (request: ICodeEditorOpenRequest): Promise<string | null> => {
        requests.push(request);
        return 'new';
      }),
    };

    renderWithCapabilities(system, { codeEditor });

    await clickAction('script', '编辑');
    await savePanel(panel);

    expect(codeEditor.open).toHaveBeenCalledTimes(1);
    expect(requests[0]).toEqual({ title: 'script', content: 'old' });
    expect(await readData(system, 't')).toEqual({ script: 'new' });

    await system.undoSystem.undo();
    await savePanel(panel);
    expect(await readData(system, 't')).toEqual({ script: 'old' });
  });

  // 双击行与「编辑」按钮走同一条分发：双击代码字段同样打开面板
  it('双击代码字段同样打开面板', async () => {
    const fs = new FakeFileSystem();

    seed(
      fs,
      't',
      { script: 'old' },
      { type: 'object', properties: { script: { type: 'string', 'x-editor': TableExternalEditor.Code } } },
    );
    const system = await createTableHarness(fs);
    const panel = await openPanel(system);

    await setTarget(panel, 't');

    const codeEditor = { open: vi.fn(async (): Promise<string | null> => null) };

    renderWithCapabilities(system, { codeEditor });

    await doubleClickRow('script');

    expect(codeEditor.open).toHaveBeenCalledTimes(1);
  });

  // 能力缺失时「编辑」按钮禁用并在 title 中给出中文提示
  it('能力缺失时「编辑」禁用并提示', async () => {
    const fs = new FakeFileSystem();

    seed(
      fs,
      't',
      { script: 'old' },
      { type: 'object', properties: { script: { type: 'string', 'x-editor': TableExternalEditor.Code } } },
    );
    const system = await createTableHarness(fs);
    const panel = await openPanel(system);

    await setTarget(panel, 't');
    renderWithCapabilities(system, {});

    const button = within(screen.getByTestId('table-edit-script')).getByRole('button', { name: '编辑' });

    expect(button.hasAttribute('disabled')).toBe(true);
    expect(button.getAttribute('title')).toBe('未注入代码编辑器能力');
  });

  // 只读字段缺少剪贴板能力时「复制」禁用并提示
  it('剪贴板能力缺失时「复制」禁用并提示', async () => {
    const fs = new FakeFileSystem();

    seed(fs, 't', { note: 'text' }, { type: 'object', properties: { note: { type: 'string', readOnly: true } } });
    const system = await createTableHarness(fs);
    const panel = await openPanel(system);

    await setTarget(panel, 't');
    renderWithCapabilities(system, {});

    const button = within(screen.getByTestId('table-edit-note')).getByRole('button', { name: '复制' });

    expect(button.hasAttribute('disabled')).toBe(true);
    expect(button.getAttribute('title')).toBe('未注入剪贴板能力');
  });

  // D-30 的「在代码编辑器中打开」与字段级代码编辑复用同一个代码编辑器打开器
  it('整份文件打开与字段级代码编辑复用同一个代码编辑器打开器', async () => {
    const fs = new FakeFileSystem();

    seed(
      fs,
      't',
      { script: 'old' },
      { type: 'object', properties: { script: { type: 'string', 'x-editor': TableExternalEditor.Code } } },
    );
    const system = await createTableHarness(fs);
    const panel = await openPanel(system);

    await setTarget(panel, 't');

    const requests: ICodeEditorOpenRequest[] = [];
    const codeEditor = {
      open: vi.fn(async (request: ICodeEditorOpenRequest): Promise<string | null> => {
        requests.push(request);
        return null;
      }),
    };

    renderWithCapabilities(system, { codeEditor });

    await openToolbarMenu();

    await act(async () => {
      fireEvent.click(screen.getByTestId('table-open-code'));
    });
    await clickAction('script', '编辑');

    expect(codeEditor.open).toHaveBeenCalledTimes(2);
    expect(requests[0].title).toBe(tableDataPath('t'));
    expect(requests[1].title).toBe('script');
  });
});
