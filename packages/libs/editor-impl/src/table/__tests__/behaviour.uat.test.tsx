import { act, cleanup, configure, fireEvent, render, screen, within } from '@testing-library/react';
import { IEditorPanel, IEditorPanelFactoryParam, ResourceSystem, ShellSystem, UndoSystem } from '@motajs/editor-core';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { tableDataResourceId, tablePanelType, tableSchemaResourceId, TableExternalEditor, TablePanel } from '..';
import { CapabilityProvider, ITableEditorCapabilities } from '../../react';
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

// 每个用例结束后卸载已挂载的组件并清理被 stub 的浏览器对话框，避免 DOM 与全局桩在用例之间累积
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

// 用能力 Provider 包裹外壳渲染根，注入假能力包（缺省时由 Provider 补齐默认弹窗打开器）
function renderWithCapabilities(system: TestSystem, capabilities: ITableEditorCapabilities): ReturnType<typeof render> {
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

// 连点两次某字段行，构成一次双击
async function doubleClickRow(field: string): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByTestId(`table-row-${field}`));
    fireEvent.click(screen.getByTestId(`table-row-${field}`));
  });
}

describe('B1 值校验失败的可见拒绝', () => {
  // 外部编辑器返回不满足字段 schema 的值时落行内拒绝，且不把非法值写回资源
  it('外部编辑器返回非法值时行内拒绝且不写回', async () => {
    const system = await createSystem();

    seed(
      system,
      't',
      { level: 1 },
      { type: 'object', properties: { level: { type: 'number', 'x-editor': TableExternalEditor.Code } } },
    );
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
    const system = await createSystem();

    seed(
      system,
      't',
      { script: 'old' },
      { type: 'object', properties: { script: { type: 'string', 'x-editor': TableExternalEditor.Code } } },
    );
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
    const system = await createSystem();

    seed(system, 't', { name: 'hello' }, { type: 'object', properties: { name: { type: 'string' } } });
    const panel = await openPanel(system);

    await setTarget(panel, 't');
    renderWithCapabilities(system, {});

    vi.stubGlobal(
      'prompt',
      vi.fn(() => 'extra'),
    );

    await act(async () => {
      fireEvent.click(screen.getByText('添加'));
    });
    await doubleClickRow('name');

    expect(await readData(system, 't')).toEqual({ name: 'hello', extra: null });
    expect(screen.getByTestId('table-notice').textContent).toBe('添加成功');
  });

  // 就绪但无提示时提示行容器仍常驻占位，故出现 / 消失不改变占用的垂直空间
  it('就绪但无提示时提示行容器常驻占位', async () => {
    const system = await createSystem();

    seed(system, 't', { name: 'hello' }, { type: 'object', properties: { name: { type: 'string' } } });
    const panel = await openPanel(system);

    await setTarget(panel, 't');
    renderWithCapabilities(system, {});

    expect(screen.getByTestId('table-notice').textContent).toBe('');
  });
});
