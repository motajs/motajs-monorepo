import { act, cleanup, configure, fireEvent, render, screen } from '@testing-library/react';
import { IEditorPanel, IEditorPanelFactoryParam, ResourceSystem, ShellSystem, UndoSystem } from '@motajs/editor-core';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { tableDataResourceId, tablePanelType, tableSchemaResourceId, TablePanel } from '..';
import { ITableGridProps, TableGrid, TablePanelStatus } from '../components/TableGrid';
import { ITableRowNode } from '../types';
import { FakeResourceInjection } from './fixtures';

configure({ testIdAttribute: 'data-test-id' });

interface TestSystem {
  /** 外壳系统 */
  readonly shellSystem: ShellSystem;
  /** 资源系统 */
  readonly resourceSystem: ResourceSystem;
  /** 内存资源后端 */
  readonly injection: FakeResourceInjection;
}

// 每个用例结束后卸载已挂载的组件并清理被 stub 的浏览器对话框
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// 组装一套已初始化的外壳 / 资源 / 撤销系统与内存后端
async function createSystem(): Promise<TestSystem> {
  const injection = new FakeResourceInjection();
  const resourceSystem = new ResourceSystem();
  await resourceSystem.initialize(injection);
  const undoSystem = new UndoSystem();
  await undoSystem.initialize({ maxUndoStep: 100 });
  const shellSystem = new ShellSystem(undoSystem, resourceSystem);
  await shellSystem.initialize();
  return { shellSystem, resourceSystem, injection };
}

// 在空白标签页打开表格面板并返回其实例
async function openPanel(system: TestSystem): Promise<TablePanel> {
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

// 预置一张表的数据与 schema
function seed(system: TestSystem, name: string, data: unknown, schema: unknown): void {
  system.injection.seed(tableDataResourceId(name), data);
  system.injection.seed(tableSchemaResourceId(name), schema);
}

// 把面板目标指向给定表名，并等待一次切入刷新完成
async function setTarget(panel: TablePanel, name: string): Promise<void> {
  panel.setTable({ data: tableDataResourceId(name), schema: tableSchemaResourceId(name) });
  await panel.onSwitchIn();
}

// 读取目标表的当前数据内容
async function readData(system: TestSystem, name: string): Promise<unknown> {
  return system.resourceSystem.readContent(tableDataResourceId(name));
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

// 在字段值数字输入框中输入数字并提交（失焦）
async function commitNumber(container: HTMLElement, field: string, text: string): Promise<void> {
  const cell = container.querySelector(`[data-test-id="table-input-${field}"]`);
  const input = cell === null ? null : cell.querySelector('input');

  if (!(input instanceof HTMLInputElement)) return;

  await act(async () => {
    fireEvent.change(input, { target: { value: text } });
    fireEvent.blur(input);
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

// 构造一个只含单行的表格 props
function singleRowGrid(row: ITableRowNode, onChange: (key: string, value: unknown) => void): ITableGridProps {
  return { status: TablePanelStatus.Ready, rows: [row], onChange };
}

// 一张带单个字符串字段的样例表
function stringTable(): { readonly data: unknown; readonly schema: unknown } {
  return {
    data: { name: 'hello' },
    schema: { type: 'object', properties: { name: { type: 'string' } } },
  };
}

describe('表格内联编辑', () => {
  // 合法值提交后写回资源并把显示更新为新值
  it('合法值提交后写回资源并更新显示', async () => {
    const system = await createSystem();
    const sample = stringTable();

    seed(system, 't', sample.data, sample.schema);
    const panel = await openPanel(system);

    await setTarget(panel, 't');
    const { container } = render(createElement(system.shellSystem.render()));

    expect(valueOf(container, 'name')).toBe('"hello"');

    await commitText(container, 'name', '"world"');

    expect(await readData(system, 't')).toEqual({ name: 'world' });
    expect(valueOf(container, 'name')).toBe('"world"');
  });

  // 值不合 schema 要求时被拒绝、显示精确文案，且不触发提交回调
  it('非法值被拒绝并显示精确文案', async () => {
    const onChange = vi.fn();
    const row: ITableRowNode = { key: "['count']", value: 5, config: { type: 'number', minimum: 10 } };

    const { container } = render(createElement(TableGrid, singleRowGrid(row, onChange)));

    await commitNumber(container, 'count', '3');

    expect(screen.getByText("['count'] : 输入的值不合要求，请鼠标放置在注释上查看说明")).not.toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  // 添加模式下点 gutter 的「+」在插入点输入名称后追加子项；全程不调用原生 prompt
  it('添加模式下用 gutter 的名称输入追加子项', async () => {
    const system = await createSystem();
    const sample = stringTable();
    const promptStub = vi.fn();

    vi.stubGlobal('prompt', promptStub);

    seed(system, 't', sample.data, sample.schema);
    const panel = await openPanel(system);

    await setTarget(panel, 't');
    render(createElement(system.shellSystem.render()));

    await switchMode('添加');
    await gutterAdd('name', 'extra');

    expect(await readData(system, 't')).toEqual({ name: 'hello', extra: null });
    expect(screen.getByText('添加成功')).not.toBeNull();
    expect(promptStub).not.toHaveBeenCalled();
  });
});

describe('表格删除', () => {
  // schema 允许 null 时，点 gutter 的「−」直接删除该字段，且不调用原生 confirm
  it('删除模式点 gutter 的「−」直接删除', async () => {
    const onDelete = vi.fn();
    const confirmStub = vi.fn(() => true);
    const row: ITableRowNode = { key: "['name']", value: 'a', config: { type: ['string', 'null'] } };

    vi.stubGlobal('confirm', confirmStub);

    render(createElement(TableGrid, { ...singleRowGrid(row, vi.fn()), onDelete }));

    await switchMode('删除');
    await gutterDelete('name');

    expect(onDelete).toHaveBeenCalledWith("['name']");
    expect(confirmStub).not.toHaveBeenCalled();
  });

  // schema 不允许 null 时 gutter 的「−」禁用，点击不请求删除
  it('schema 禁止 null 时删除按钮禁用', async () => {
    const onDelete = vi.fn();
    const row: ITableRowNode = { key: "['name']", value: 'a', config: { type: 'string' } };

    render(createElement(TableGrid, { ...singleRowGrid(row, vi.fn()), onDelete }));

    await switchMode('删除');

    const button = screen.getByTestId('table-delete-name');

    expect(button.hasAttribute('disabled')).toBe(true);

    await gutterDelete('name');

    expect(onDelete).not.toHaveBeenCalled();
  });
});
