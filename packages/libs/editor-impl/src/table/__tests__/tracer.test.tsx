import { act, cleanup, configure, fireEvent, render, screen } from '@testing-library/react';
import { EditorCore, IEditorPanel, IEditorPanelFactoryParam } from '@motajs/editor-core';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { deriveSchemaPath, tablePanelType, TablePanel } from '..';
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

// 读取某个字段值单元格内输入控件（文本域或数字输入框）的当前文本（字段用连字符形态，如 `nested-inner`）
function inputValue(container: HTMLElement, field: string): string | undefined {
  const cell = container.querySelector(`[data-test-id="table-input-${field}"]`);
  const control = cell === null ? null : cell.querySelector('textarea, input');

  if (control instanceof HTMLTextAreaElement || control instanceof HTMLInputElement) return control.value;

  return undefined;
}

// 注册一个捕获实例的面板类型（元信息取自 tablePanelType），在空白标签页打开面板并返回实例
async function openTablePanel(system: EditorCore, panels: TablePanel[]): Promise<TablePanel> {
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
    panel.setTable({ dataPath: tableDataPath(name) });
    await panel.onSwitchIn();
  });
}

// 以文本预置一张带扁平字符串字段、嵌套 object 与数值字段的表格及其 schema
function seedSampleTable(fs: FakeFileSystem, name: string): void {
  fs.seed(tableDataPath(name), JSON.stringify({ name: 'hello', count: 42, nested: { inner: 'deep' } }));
  fs.seed(
    tableSchemaPath(name),
    JSON.stringify({
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
    }),
  );
}

describe('tablePanelType 注册与打开', () => {
  // 真实 tablePanelType 可注册进外壳
  it('tablePanelType 可注册进外壳', async () => {
    const system = await createTableHarness(new FakeFileSystem());
    const registered = system.shellSystem.registerPanelType(tablePanelType);

    expect(registered).toBe(true);
    expect(system.shellSystem.listPanelTypes().map((type) => type.id)).toEqual(['table']);
  });

  // 打开面板后未设目标时渲染未设置目标态
  it('未设目标时渲染未设置目标态', async () => {
    const system = await createTableHarness(new FakeFileSystem());
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
    const fs = new FakeFileSystem();

    seedSampleTable(fs, 'test');
    const system = await createTableHarness(fs);

    const panels: TablePanel[] = [];
    const panel = await openTablePanel(system, panels);

    await setTarget(panel, 'test');
    const { container } = render(createElement(system.shellSystem.render()));

    expect(screen.getByText('条目')).not.toBeNull();
    expect(screen.getByText('注释')).not.toBeNull();
    expect(screen.getByText('值')).not.toBeNull();
    expect(screen.getByText('操作')).not.toBeNull();
    expect(screen.getByTestId('gap-toggle-nested')).not.toBeNull();
    expect(screen.getByText('nested')).not.toBeNull();
    expect(inputValue(container, 'name')).toBe('"hello"');
    expect(inputValue(container, 'nested-inner')).toBe('"deep"');
    expect(inputValue(container, 'count')).toBe('42');
    expect(screen.getByText('名字')).not.toBeNull();
    expect(screen.getByText('内部字段')).not.toBeNull();
  });

  // 分组行折叠后子行离开 DOM，展开后回到 DOM
  it('分组行折叠与展开切换子行是否在 DOM 中', async () => {
    const fs = new FakeFileSystem();

    seedSampleTable(fs, 'fold');
    const system = await createTableHarness(fs);

    const panels: TablePanel[] = [];
    const panel = await openTablePanel(system, panels);

    await setTarget(panel, 'fold');
    const { container } = render(createElement(system.shellSystem.render()));

    expect(container.querySelector('[data-test-id="table-row-nested-inner"]')).not.toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByTestId('gap-toggle-nested'));
    });

    expect(container.querySelector('[data-test-id="table-row-nested-inner"]')).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByTestId('gap-toggle-nested'));
    });

    expect(container.querySelector('[data-test-id="table-row-nested-inner"]')).not.toBeNull();
  });

  // schema 存在但无字段时显示空态默认文案
  it('schema 无字段时显示空态默认文案', async () => {
    const fs = new FakeFileSystem();

    fs.seed(tableDataPath('empty'), JSON.stringify({}));
    fs.seed(tableSchemaPath('empty'), JSON.stringify({ type: 'object' }));
    const system = await createTableHarness(fs);

    const panels: TablePanel[] = [];
    const panel = await openTablePanel(system, panels);

    await setTarget(panel, 'empty');
    render(createElement(system.shellSystem.render()));

    expect(screen.getByText('暂无表格数据')).not.toBeNull();
    expect(screen.getByText('该表格当前没有可显示的字段，或内容为空。')).not.toBeNull();
  });

  // schema 文件缺失、数据为空时显示尚未定义任何字段
  it('schema 缺失时显示尚未定义任何字段', async () => {
    const fs = new FakeFileSystem();

    fs.seed(tableDataPath('noschema'), JSON.stringify({}));
    const system = await createTableHarness(fs);

    const panels: TablePanel[] = [];
    const panel = await openTablePanel(system, panels);

    await setTarget(panel, 'noschema');
    render(createElement(system.shellSystem.render()));

    expect(screen.getByText('暂无表格数据')).not.toBeNull();
    expect(screen.getByText('尚未定义任何字段。')).not.toBeNull();
  });

  // 资源请求失败时显示错误态与重试控件，面板保持打开
  it('资源请求失败时显示错误态且面板保持打开', async () => {
    const fs = new FakeFileSystem();

    seedSampleTable(fs, 'boom');
    fs.failing.add(tableDataPath('boom'));
    const system = await createTableHarness(fs);

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
    const fs = new FakeFileSystem();

    seedSampleTable(fs, 'slow');
    fs.hanging.add(tableDataPath('slow'));
    const system = await createTableHarness(fs);

    const panels: TablePanel[] = [];
    const panel = await openTablePanel(system, panels);

    await act(async () => {
      panel.setTable({ dataPath: tableDataPath('slow') });
    });
    render(createElement(system.shellSystem.render()));

    expect(screen.getByText('正在加载表格…')).not.toBeNull();
  });

  // 脚本样值以字面文本渲染，不生成任何元素
  it('危险值以字面文本渲染', async () => {
    const payload = '<img src=x onerror="alert(1)">';
    const fs = new FakeFileSystem();

    fs.seed(tableDataPath('xss'), JSON.stringify({ evil: payload }));
    fs.seed(tableSchemaPath('xss'), JSON.stringify({ type: 'object', properties: { evil: { type: 'string' } } }));
    const system = await createTableHarness(fs);

    const panels: TablePanel[] = [];
    const panel = await openTablePanel(system, panels);

    await setTarget(panel, 'xss');
    const { container } = render(createElement(system.shellSystem.render()));

    expect(inputValue(container, 'evil')).toBe(JSON.stringify(payload));
    expect(container.querySelector('img')).toBeNull();
  });
});
