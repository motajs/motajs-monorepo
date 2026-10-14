import { act, cleanup, configure, fireEvent, render, screen } from '@testing-library/react';
import { IEditorPanel, IEditorPanelFactoryParam, ResourceSystem, ShellSystem, UndoSystem } from '@motajs/editor-core';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { tableDataResourceId, tablePanelType, tableSchemaResourceId, TablePanel } from '..';
import { FakeResourceInjection } from './fixtures';

configure({ testIdAttribute: 'data-test-id' });

interface TestSystem {
  /** 外壳系统 */
  readonly shellSystem: ShellSystem;
  /** 资源系统 */
  readonly resourceSystem: ResourceSystem;
  /** 撤销系统 */
  readonly undoSystem: UndoSystem;
  /** 内存资源后端 */
  readonly injection: FakeResourceInjection;
}

// 每个用例结束后卸载已挂载的组件，避免 DOM 在用例之间累积
afterEach(() => {
  cleanup();
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
  return { shellSystem, resourceSystem, undoSystem, injection };
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

// 把面板目标指向数据表，并等待一次切入刷新完成
async function setTarget(panel: TablePanel, name: string): Promise<void> {
  panel.setTable({ data: tableDataResourceId(name), schema: tableSchemaResourceId(name) });
  await panel.onSwitchIn();
}

// 读取目标表的当前数据内容
async function readData(system: TestSystem, name: string): Promise<unknown> {
  return system.resourceSystem.readContent(tableDataResourceId(name));
}

// 读取目标表当前的 schema 内容
async function readSchema(system: TestSystem, name: string): Promise<unknown> {
  return system.resourceSystem.readContent(tableSchemaResourceId(name));
}

// 按渲染顺序取表体内所有行的 data-test-id
function rowKeys(container: HTMLElement): string[] {
  const body = container.querySelector('[data-test-id="data-table-grid"]');

  if (body === null) return [];

  return Array.from(body.querySelectorAll('[data-test-id^="table-row-"]')).map(
    (element) => element.getAttribute('data-test-id') ?? '',
  );
}

// 切到工具栏中的某编辑模式（按分段控件文案点击）
async function switchMode(label: string): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByText(label));
  });
}

// 点某行 gutter 的「+」打开新增名称输入
async function openAddInput(field: string): Promise<HTMLElement> {
  await act(async () => {
    fireEvent.click(screen.getByTestId(`table-add-after-${field}`));
  });

  return screen.getByTestId(`table-add-input-${field}`);
}

// 点某行 gutter 的「+」→ 输入名称 → 失焦提交（不按 Enter）
async function gutterAddByBlur(field: string, name: string): Promise<void> {
  const input = await openAddInput(field);

  await act(async () => {
    fireEvent.change(input, { target: { value: name } });
    fireEvent.blur(input);
  });
}

// 一张带两个同级可空字符串字段的样例表
function pairTable(): { readonly data: unknown; readonly schema: unknown } {
  return {
    data: { a: '1', b: '2' },
    schema: {
      type: 'object',
      properties: { a: { type: ['string', 'null'] }, b: { type: ['string', 'null'] } },
    },
  };
}

describe('添加流程（P12）', () => {
  // 失焦（不按 Enter）也应提交：新字段插到锚点行之后，且行序为 a / 新名 / b
  it('失焦提交把新字段插到锚点行之后', async () => {
    const system = await createSystem();
    const sample = pairTable();

    seed(system, 'blur', sample.data, sample.schema);
    const panel = await openPanel(system);

    await setTarget(panel, 'blur');
    const { container } = render(createElement(system.shellSystem.render()));

    await switchMode('添加');
    await gutterAddByBlur('a', 'mid');

    expect(await readData(system, 'blur')).toEqual({ a: '1', mid: null, b: '2' });
    expect(rowKeys(container)).toEqual(['table-row-a', 'table-row-mid', 'table-row-b']);
  });

  // 点明确的「确定」按钮也应提交（不再只能靠 Enter）
  it('点确定按钮提交新字段', async () => {
    const system = await createSystem();
    const sample = pairTable();

    seed(system, 'confirm', sample.data, sample.schema);
    const panel = await openPanel(system);

    await setTarget(panel, 'confirm');
    render(createElement(system.shellSystem.render()));

    await switchMode('添加');
    const input = await openAddInput('a');

    await act(async () => {
      fireEvent.change(input, { target: { value: 'mid' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('table-add-confirm-a'));
    });

    expect(await readData(system, 'confirm')).toEqual({ a: '1', mid: null, b: '2' });
  });

  // 新增把新名写进父对象的 x-order，且紧接锚点 a 之后
  it('新增把新名写进 schema 的 x-order 且紧接锚点', async () => {
    const system = await createSystem();
    const sample = pairTable();

    seed(system, 'order', sample.data, sample.schema);
    const panel = await openPanel(system);

    await setTarget(panel, 'order');
    render(createElement(system.shellSystem.render()));

    await switchMode('添加');
    await gutterAddByBlur('a', 'mid');

    const schema = await readSchema(system, 'order');

    expect((schema as Record<string, unknown>)['x-order']).toEqual(['a', 'mid', 'b']);
  });

  // 名称输入位于独立浮层，不再把「条目」单元格本身变成输入框
  it('名称输入位于独立浮层而非条目单元格内', async () => {
    const system = await createSystem();
    const sample = pairTable();

    seed(system, 'layer', sample.data, sample.schema);
    const panel = await openPanel(system);

    await setTarget(panel, 'layer');
    const { container } = render(createElement(system.shellSystem.render()));

    await switchMode('添加');
    const input = await openAddInput('a');
    const nameCell = container.querySelector('[data-test-id="table-row-a"] .etable-cell-name');

    expect(nameCell).not.toBeNull();
    expect(nameCell === null ? true : nameCell.contains(input)).toBe(false);
    expect(input.closest('.etable-add-popover')).not.toBeNull();
  });

  // 新增后可撤销，数据与 schema（含 x-order）都回到新增前
  it('新增后撤销还原数据与 schema', async () => {
    const system = await createSystem();
    const sample = pairTable();

    seed(system, 'undo', sample.data, sample.schema);
    const panel = await openPanel(system);

    await setTarget(panel, 'undo');
    render(createElement(system.shellSystem.render()));

    await switchMode('添加');
    await gutterAddByBlur('a', 'mid');

    expect(await readData(system, 'undo')).toEqual({ a: '1', mid: null, b: '2' });

    await act(async () => {
      await system.undoSystem.undo();
    });

    expect(await readData(system, 'undo')).toEqual({ a: '1', b: '2' });

    const schema = await readSchema(system, 'undo');

    expect((schema as Record<string, unknown>)['x-order']).toBeUndefined();
  });
});
