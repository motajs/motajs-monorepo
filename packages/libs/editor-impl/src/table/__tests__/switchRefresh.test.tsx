import { act, cleanup, render } from '@testing-library/react';
import { IEditorPanel, IEditorPanelFactoryParam, ResourceSystem, ShellSystem, UndoSystem } from '@motajs/editor-core';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { tableDataResourceId, tablePanelType, tableSchemaResourceId, TablePanel } from '..';
import { FakeResourceInjection } from './fixtures';

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

// 读取某个字段值单元格内文本域的当前文本
function valueOf(container: HTMLElement, field: string): string | undefined {
  const cell = container.querySelector(`[data-test-id="table-input-${field}"]`);
  const textarea = cell === null ? null : cell.querySelector('textarea');

  return textarea === null ? undefined : textarea.value;
}

describe('切入时刷新（D-15 修订版 / D-31）', () => {
  // 外壳切入面板时，面板重新请求数据与 schema 资源并重算行树
  it('外壳切入面板时重新请求数据与 schema 并重算', async () => {
    const system = await createSystem();
    const panels: TablePanel[] = [];
    const panel = await openTablePanel(system, panels);

    seed(system, 't', { name: 'a' }, { type: 'object', properties: { name: { type: 'string' } } });
    panel.setTable({ data: tableDataResourceId('t'), schema: tableSchemaResourceId('t') });

    await act(async () => {
      await panel.onSwitchIn();
    });

    const { container } = render(createElement(system.shellSystem.render()));

    expect(valueOf(container, 'name')).toBe('"a"');

    const requestSpy = vi.spyOn(system.resourceSystem, 'requestResource');

    requestSpy.mockClear();

    // 切到第二个标签：第一个面板切出
    const second = system.shellSystem.openBlankTab();

    await act(async () => {
      await system.shellSystem.openPanelInTab(second, tablePanelType.id);
    });

    // 外部改变资源内容，再切回第一个标签触发 onSwitchIn 重新请求
    await act(async () => {
      await system.resourceSystem.writeContent(tableDataResourceId('t'), { name: 'c' });
    });

    const first = system.shellSystem.listTabs()[0].id;

    await act(async () => {
      system.shellSystem.activateTab(first);
    });
    await act(async () => {});

    expect(valueOf(container, 'name')).toBe('"c"');

    const ids = requestSpy.mock.calls.map((call) => call[0].id);

    expect(ids).toContain('table.t');
    expect(ids).toContain('table#schema.t');
  });
});
