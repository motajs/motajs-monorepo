import { act, cleanup, configure, render } from '@testing-library/react';
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
  return { shellSystem, resourceSystem, injection };
}

// 注册一个捕获实例的面板类型，在空白标签页打开面板并返回实例
async function openTablePanel(system: TestSystem, panels: TablePanel[]): Promise<TablePanel> {
  system.shellSystem.registerPanelType({
    id: tablePanelType.id,
    name: tablePanelType.name,
    icon: tablePanelType.icon,
    create: (param: IEditorPanelFactoryParam): IEditorPanel => {
      const panel = new TablePanel(param);
      panels.push(panel);
      return panel;
    },
  });

  const tabId = system.shellSystem.listTabs()[0].id;

  await act(async () => {
    await system.shellSystem.openPanelInTab(tabId, tablePanelType.id);
  });
  return panels[0];
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

// 读取某个字段值单元格内文本域的当前文本
function valueOf(container: HTMLElement, field: string): string | undefined {
  const cell = container.querySelector(`[data-test-id="table-input-${field}"]`);
  const textarea = cell === null ? null : cell.querySelector('textarea');

  return textarea === null ? undefined : textarea.value;
}

describe('刷新原地更新、不再整树重挂（P26）', () => {
  // 同一内容刷新后行 DOM 节点身份保持不变（修复前每次刷新都切加载态，此用例必然失败）
  it('同一内容刷新后行 DOM 节点身份不变', async () => {
    const system = await createSystem();
    const panels: TablePanel[] = [];
    const panel = await openTablePanel(system, panels);

    seed(system, 't', { name: 'hello' }, { type: 'object', properties: { name: { type: 'string' } } });
    await setTarget(panel, 't');

    const { container } = render(createElement(system.shellSystem.render()));
    const first = container.querySelector('[data-test-id="table-row-name"]');

    expect(first).not.toBeNull();

    await act(async () => {
      await panel.onSwitchIn();
    });

    expect(container.querySelector('[data-test-id="table-row-name"]')).toBe(first);
  });

  // 同一内容刷新后值单元格内输入控件的 DOM 节点身份不变（记忆化命中，整表重渲染被跳过）
  it('同一内容刷新后输入控件身份不变', async () => {
    const system = await createSystem();
    const panels: TablePanel[] = [];
    const panel = await openTablePanel(system, panels);

    seed(system, 't', { name: 'hello' }, { type: 'object', properties: { name: { type: 'string' } } });
    await setTarget(panel, 't');

    const { container } = render(createElement(system.shellSystem.render()));
    const first = container.querySelector('[data-test-id="table-input-name"] textarea');

    expect(first).not.toBeNull();

    await act(async () => {
      await panel.onSwitchIn();
    });

    expect(container.querySelector('[data-test-id="table-input-name"] textarea')).toBe(first);
  });

  // 对某字段写盘后刷新，其余未变更字段的行 DOM 节点身份保持不变
  it('未受影响的行刷新后不重挂', async () => {
    const system = await createSystem();
    const panels: TablePanel[] = [];
    const panel = await openTablePanel(system, panels);

    seed(
      system,
      't',
      { a: 'x', b: 'y' },
      { type: 'object', properties: { a: { type: 'string' }, b: { type: 'string' } } },
    );
    await setTarget(panel, 't');

    const { container } = render(createElement(system.shellSystem.render()));
    const rowA = container.querySelector('[data-test-id="table-row-a"]');
    const rowB = container.querySelector('[data-test-id="table-row-b"]');

    expect(rowA).not.toBeNull();
    expect(rowB).not.toBeNull();

    await act(async () => {
      await system.resourceSystem.writeContent(tableDataResourceId('t'), { a: 'z', b: 'y' });
      await panel.onSwitchIn();
    });

    expect(valueOf(container, 'a')).toBe('"z"');
    expect(container.querySelector('[data-test-id="table-row-b"]')).toBe(rowB);
  });

  // 内容真的变了时行树仍正确更新（写盘产生新对象后读到新值，不与同内容用例冲突）
  it('内容变更后刷新仍更新为新值', async () => {
    const system = await createSystem();
    const panels: TablePanel[] = [];
    const panel = await openTablePanel(system, panels);

    seed(system, 't', { name: 'a' }, { type: 'object', properties: { name: { type: 'string' } } });
    await setTarget(panel, 't');

    const { container } = render(createElement(system.shellSystem.render()));

    expect(valueOf(container, 'name')).toBe('"a"');

    await act(async () => {
      await system.resourceSystem.writeContent(tableDataResourceId('t'), { name: 'c' });
      await panel.onSwitchIn();
    });

    expect(valueOf(container, 'name')).toBe('"c"');
  });

  // 首载资源尚未返回时仍显示加载态，守住既有加载态语义
  it('首载资源未返回时仍显示加载态', async () => {
    const system = await createSystem();
    const panels: TablePanel[] = [];
    const panel = await openTablePanel(system, panels);

    seed(system, 'slow', { name: 'hello' }, { type: 'object', properties: { name: { type: 'string' } } });
    system.injection.hanging.add('table.slow');

    await act(async () => {
      panel.setTable({ data: tableDataResourceId('slow'), schema: tableSchemaResourceId('slow') });
    });

    const { container } = render(createElement(system.shellSystem.render()));

    expect(container.textContent).toContain('正在加载表格…');
  });
});
