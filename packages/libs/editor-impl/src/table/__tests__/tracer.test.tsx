import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { IEditorPanel, IEditorPanelFactoryParam, ResourceSystem, ShellSystem, UndoSystem } from '@motajs/editor-core';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
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

// 组装一套已初始化的外壳 / 资源 / 撤回系统与内存后端
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

// 注册一个捕获实例的面板类型（元信息取自 tablePanelType），在空白标签页打开面板并返回实例
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
  await act(async () => {
    panel.setTable({ data: tableDataResourceId(name), schema: tableSchemaResourceId(name) });
    await panel.onSwitchIn();
  });
}

// 预置一张带扁平字符串字段、嵌套 object 与数值字段的表格及其 schema
function seedSampleTable(system: TestSystem, name: string): void {
  system.injection.seed(tableDataResourceId(name), { name: 'hello', count: 42, nested: { inner: 'deep' } });
  system.injection.seed(tableSchemaResourceId(name), {
    type: 'object',
    properties: {
      name: { type: 'string', description: '名字' },
      count: { type: 'number', description: '数量' },
      nested: {
        type: 'object',
        description: '嵌套组',
        properties: { inner: { type: 'string', description: '内部字段' } },
      },
    },
  });
}

describe('tablePanelType 注册与打开', () => {
  // 真实 tablePanelType 可注册进外壳
  it('tablePanelType 可注册进外壳', async () => {
    const system = await createSystem();
    const registered = system.shellSystem.registerPanelType(tablePanelType);

    expect(registered).toBe(true);
    expect(system.shellSystem.listPanelTypes().map((type) => type.id)).toEqual(['table']);
  });

  // 打开面板后未设目标时渲染未设置目标态
  it('未设目标时渲染未设置目标态', async () => {
    const system = await createSystem();
    const panels: TablePanel[] = [];
    const panel = await openTablePanel(system, panels);

    render(createElement(system.shellSystem.render()));

    expect(panel.id).toBe('instance-1');
    expect(screen.getByText('尚未设置目标表')).not.toBeNull();
    expect(screen.getByText('请先为该表格面板指定要编辑的表格。')).not.toBeNull();
  });
});

describe('表格面板端到端读取与渲染', () => {
  // 设置目标后经资源层读取数据与 schema，渲染四栏网格与分组 / 叶子行
  it('设置目标后渲染四栏网格与分组 / 叶子行', async () => {
    const system = await createSystem();
    seedSampleTable(system, 'test');
    const panels: TablePanel[] = [];
    const panel = await openTablePanel(system, panels);

    await setTarget(panel, 'test');
    render(createElement(system.shellSystem.render()));

    expect(screen.getByText('条目')).not.toBeNull();
    expect(screen.getByText('注释')).not.toBeNull();
    expect(screen.getByText('值')).not.toBeNull();
    expect(screen.getByText('操作')).not.toBeNull();
    expect(screen.getByText("['nested']")).not.toBeNull();
    expect(screen.getByText('hello')).not.toBeNull();
    expect(screen.getByText('deep')).not.toBeNull();
    expect(screen.getByText('42')).not.toBeNull();
    expect(screen.getByText('名字')).not.toBeNull();
    expect(screen.getByText('内部字段')).not.toBeNull();
  });

  // 分组行折叠后子行离开 DOM，展开后回到 DOM
  it('分组行折叠与展开切换子行是否在 DOM 中', async () => {
    const system = await createSystem();
    seedSampleTable(system, 'fold');
    const panels: TablePanel[] = [];
    const panel = await openTablePanel(system, panels);

    await setTarget(panel, 'fold');
    render(createElement(system.shellSystem.render()));

    expect(screen.getByText('deep')).not.toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByText('折叠'));
    });

    expect(screen.queryByText('deep')).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByText('展开'));
    });

    expect(screen.getByText('deep')).not.toBeNull();
  });

  // schema 存在但无字段时显示空态默认文案
  it('schema 无字段时显示空态默认文案', async () => {
    const system = await createSystem();
    system.injection.seed(tableDataResourceId('empty'), {});
    system.injection.seed(tableSchemaResourceId('empty'), { type: 'object' });
    const panels: TablePanel[] = [];
    const panel = await openTablePanel(system, panels);

    await setTarget(panel, 'empty');
    render(createElement(system.shellSystem.render()));

    expect(screen.getByText('暂无表格数据')).not.toBeNull();
    expect(screen.getByText('该表格当前没有可显示的字段，或内容为空。')).not.toBeNull();
  });

  // schema 资源缺失、数据为空时显示尚未定义任何字段
  it('schema 缺失时显示尚未定义任何字段', async () => {
    const system = await createSystem();
    system.injection.seed(tableDataResourceId('noschema'), {});
    const panels: TablePanel[] = [];
    const panel = await openTablePanel(system, panels);

    await setTarget(panel, 'noschema');
    render(createElement(system.shellSystem.render()));

    expect(screen.getByText('暂无表格数据')).not.toBeNull();
    expect(screen.getByText('尚未定义任何字段。')).not.toBeNull();
  });

  // 资源请求失败时显示错误态与重试控件，面板保持打开
  it('资源请求失败时显示错误态且面板保持打开', async () => {
    const system = await createSystem();
    seedSampleTable(system, 'boom');
    system.injection.failing.add('table.boom');
    const panels: TablePanel[] = [];
    const panel = await openTablePanel(system, panels);

    await setTarget(panel, 'boom');
    render(createElement(system.shellSystem.render()));

    expect(screen.getByText('表格加载失败')).not.toBeNull();
    expect(screen.getByText('请检查该表格资源是否存在，或稍后重试。')).not.toBeNull();
    expect(screen.getByText('重试').closest('button')).not.toBeNull();
    expect(system.shellSystem.listTabs()[0].typeId).toBe('table');
  });

  // 资源尚未返回时显示加载态
  it('资源尚未返回时显示加载态', async () => {
    const system = await createSystem();
    seedSampleTable(system, 'slow');
    system.injection.hanging.add('table.slow');
    const panels: TablePanel[] = [];
    const panel = await openTablePanel(system, panels);

    await act(async () => {
      panel.setTable({ data: tableDataResourceId('slow'), schema: tableSchemaResourceId('slow') });
    });
    render(createElement(system.shellSystem.render()));

    expect(screen.getByText('正在加载表格…')).not.toBeNull();
  });

  // 脚本样值以字面文本渲染，不生成任何元素
  it('危险值以字面文本渲染', async () => {
    const payload = '<img src=x onerror="alert(1)">';
    const system = await createSystem();
    system.injection.seed(tableDataResourceId('xss'), { evil: payload });
    system.injection.seed(tableSchemaResourceId('xss'), { type: 'object', properties: { evil: { type: 'string' } } });
    const panels: TablePanel[] = [];
    const panel = await openTablePanel(system, panels);

    await setTarget(panel, 'xss');
    const { container } = render(createElement(system.shellSystem.render()));

    expect(screen.getByText(payload)).not.toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });
});
