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

// 预置一张带扁平字符串字段的表格及其 schema
function seedSampleTable(system: TestSystem, name: string): void {
  system.injection.seed(tableDataResourceId(name), { name: 'hello' });
  system.injection.seed(tableSchemaResourceId(name), {
    type: 'object',
    properties: { name: { type: 'string', description: '名字' } },
  });
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

// 把面板目标指向给定表名，并等待一次切入刷新完成
async function setTarget(panel: TablePanel, name: string): Promise<void> {
  panel.setTable({ data: tableDataResourceId(name), schema: tableSchemaResourceId(name) });
  await panel.onSwitchIn();
}

describe('面板标题与工具栏布局（L1）', () => {
  // 表格面板按实例给出标题「表格 table.demo」
  it('面板 getTitle 按实例返回「表格 table.demo」', async () => {
    const system = await createSystem();

    seedSampleTable(system, 'demo');
    const panels: TablePanel[] = [];
    const panel = await openTablePanel(system, panels);

    await setTarget(panel, 'demo');

    expect(panel.getTitle()).toBe('表格 table.demo');
  });

  // 工具栏中表名节点位于「编辑 Schema」按钮之前，二者之间还有一条竖分隔线
  it('工具栏表名位于按钮左侧且带竖分隔线', async () => {
    const system = await createSystem();

    seedSampleTable(system, 'demo');
    const panels: TablePanel[] = [];
    const panel = await openTablePanel(system, panels);

    await setTarget(panel, 'demo');
    const { container } = render(createElement(system.shellSystem.render()));

    const title = container.querySelector('.etable-toolbar-title');
    const divider = container.querySelector('.etable-toolbar-divider');
    const schemaButton = container.querySelector('[data-test-id="table-edit-schema"]');

    if (title === null || divider === null || schemaButton === null) throw new Error('工具栏节点缺失');

    expect(title.compareDocumentPosition(schemaButton) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(divider.compareDocumentPosition(schemaButton) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(title.compareDocumentPosition(divider) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  });
});
