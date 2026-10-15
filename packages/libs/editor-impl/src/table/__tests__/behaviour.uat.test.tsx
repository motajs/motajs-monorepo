import { act, cleanup, configure, fireEvent, render, screen, within } from '@testing-library/react';
import { EditorCore, IEditorPanel, IEditorPanelFactoryParam } from '@motajs/editor-core';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deriveSchemaPath, TableExternalEditor, tablePanelType, TablePanel } from '..';
import { CapabilityProvider, ITableEditorCapabilities } from '../../react';
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

// 读取某个路径的当前内容（面板以文本写回，读取后解析）
async function readContent(system: EditorCore, path: string): Promise<unknown> {
  const text = await system.resourceSystem.readContent(path);

  if (typeof text !== 'string') return undefined;

  return JSON.parse(text);
}

// 读取目标表的当前数据内容
async function readData(system: EditorCore, name: string): Promise<unknown> {
  return readContent(system, tableDataPath(name));
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

// 点击某字段操作列中指定文案的按钮，并等待一次分发完成
async function clickAction(field: string, name: string): Promise<void> {
  const cell = screen.getByTestId(`table-edit-${field}`);

  await act(async () => {
    fireEvent.click(within(cell).getByRole('button', { name }));
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

describe('B1 值校验失败的可见拒绝', () => {
  // 外部编辑器返回不满足字段 schema 的值时落行内拒绝，且不把非法值写回资源
  it('外部编辑器返回非法值时行内拒绝且不写回', async () => {
    const fs = new FakeFileSystem();

    seed(
      fs,
      't',
      { level: 1 },
      { type: 'object', properties: { level: { type: 'number', 'x-editor': TableExternalEditor.Code } } },
    );
    const system = await createTableHarness(fs);
    const panel = await openPanel(system);

    await setTarget(panel, 't');

    const codeEditor = { open: vi.fn(async (): Promise<string | null> => '不是数字') };

    renderWithCapabilities(system, { codeEditor });

    await clickAction('level', '编辑');

    expect(screen.getByTestId('table-error-level')).not.toBeNull();
    expect(await readData(system, 't')).toEqual({ level: 1 });
  });

  // 外部编辑器返回满足字段 schema 的值时正常提交，且不出现行内拒绝
  it('外部编辑器返回合法值时正常提交', async () => {
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

    const codeEditor = { open: vi.fn(async (): Promise<string | null> => 'new') };

    renderWithCapabilities(system, { codeEditor });

    await clickAction('script', '编辑');

    expect(screen.queryByTestId('table-error-script')).toBeNull();
    expect(await readData(system, 't')).toEqual({ script: 'new' });
  });
});

describe('B3 成功提示文案与常驻预留', () => {
  // 新增成功后提示行只显示「添加成功」，不含「刷新」
  it('新增成功后提示为「添加成功」且不含刷新', async () => {
    const fs = new FakeFileSystem();

    seed(fs, 't', { name: 'hello' }, { type: 'object', properties: { name: { type: 'string' } } });
    const system = await createTableHarness(fs);
    const panel = await openPanel(system);

    await setTarget(panel, 't');
    renderWithCapabilities(system, {});

    await switchMode('添加');
    await gutterAdd('name', 'extra');

    expect(await readData(system, 't')).toEqual({ name: 'hello', extra: null });
    expect(screen.getByTestId('table-notice').textContent).toBe('添加成功');
  });

  // 就绪但无提示时提示行容器仍常驻占位，故出现 / 消失不改变占用的垂直空间
  it('就绪但无提示时提示行容器常驻占位', async () => {
    const fs = new FakeFileSystem();

    seed(fs, 't', { name: 'hello' }, { type: 'object', properties: { name: { type: 'string' } } });
    const system = await createTableHarness(fs);
    const panel = await openPanel(system);

    await setTarget(panel, 't');
    renderWithCapabilities(system, {});

    expect(screen.getByTestId('table-notice').textContent).toBe('');
  });
});

describe('B2 数字字段的单行数字控件', () => {
  // 数字字段渲染 antd InputNumber 而非多行文本域，输入后提交数字值
  it('数字字段渲染 InputNumber 并提交数字', async () => {
    const fs = new FakeFileSystem();

    seed(fs, 't', { level: 1 }, { type: 'object', properties: { level: { type: 'number' } } });
    const system = await createTableHarness(fs);
    const panel = await openPanel(system);

    await setTarget(panel, 't');
    const { container } = renderWithCapabilities(system, {});

    const cell = container.querySelector('[data-test-id="table-input-level"]');

    expect(cell === null ? null : cell.querySelector('.ant-input-number')).not.toBeNull();
    expect(cell === null ? null : cell.querySelector('textarea')).toBeNull();

    const input = cell === null ? null : cell.querySelector('input');

    if (!(input instanceof HTMLInputElement)) throw new Error('数字输入框缺失');

    await act(async () => {
      fireEvent.change(input, { target: { value: '5' } });
      fireEvent.blur(input);
    });

    expect(await readData(system, 't')).toEqual({ level: 5 });
  });
});
