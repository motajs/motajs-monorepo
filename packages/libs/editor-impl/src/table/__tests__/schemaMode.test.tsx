import { act, cleanup, configure, fireEvent, render, screen } from '@testing-library/react';
import { IEditorPanel, IEditorPanelFactoryParam, ResourceSystem, ShellSystem, UndoSystem } from '@motajs/editor-core';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { tableDataResourceId, tablePanelType, tableSchemaResourceId, TablePanel } from '..';
import { ICodeEditorOpenRequest, ITableEditorCapabilities } from '../../react';
import { TableCapabilitiesContext } from '../../react/capabilitiesContext';
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

// 按渲染顺序取表体内所有行的 data-test-id
function rowKeys(container: HTMLElement): string[] {
  const body = container.querySelector('[data-test-id="data-table-grid"]');

  if (body === null) return [];

  return Array.from(body.querySelectorAll('[data-test-id^="table-row-"]')).map(
    (element) => element.getAttribute('data-test-id') ?? '',
  );
}

// 把面板目标指向数据表，并等待一次切入刷新完成
async function setDataTarget(panel: TablePanel, name: string): Promise<void> {
  panel.setTable({ data: tableDataResourceId(name), schema: tableSchemaResourceId(name) });
  await panel.onSwitchIn();
}

// 把面板目标指向 schema 表，并等待一次切入刷新完成
async function setSchemaTarget(panel: TablePanel, name: string): Promise<void> {
  panel.setTable({ data: tableSchemaResourceId(name), schema: tableSchemaResourceId(name) });
  await panel.onSwitchIn();
}

// 用能力 Provider 包裹外壳渲染根，注入假能力包
function renderWithCapabilities(system: TestSystem, capabilities: ITableEditorCapabilities): ReturnType<typeof render> {
  return render(
    createElement(
      TableCapabilitiesContext.Provider,
      { value: capabilities },
      createElement(system.shellSystem.render()),
    ),
  );
}

// 一张带单个字符串字段的样例表
function stringTable(): { readonly data: unknown; readonly schema: unknown } {
  return {
    data: { name: 'a' },
    schema: { type: 'object', properties: { name: { type: 'string' } } },
  };
}

describe('表格 schema 模式与工具栏', () => {
  // schema 目标下不显示「编辑 Schema」按钮，且网格上方渲染 schema 提示条
  it('schema 目标下不显示「编辑 Schema」按钮并渲染提示条', async () => {
    const system = await createSystem();

    system.injection.seed(tableSchemaResourceId('t'), { type: 'object', properties: { name: { type: 'string' } } });
    const panel = await openPanel(system);

    await setSchemaTarget(panel, 't');
    renderWithCapabilities(system, {});

    expect(screen.queryByTestId('table-edit-schema')).toBeNull();
    expect(screen.getByTestId('schema-banner')).not.toBeNull();
  });

  // 数据目标下「编辑 Schema」存在，点击经注入打开器以 table#schema.<名> 打开新面板
  it('数据目标下「编辑 Schema」经注入打开器打开 schema 面板', async () => {
    const system = await createSystem();
    const sample = stringTable();

    seed(system, 't', sample.data, sample.schema);
    const panel = await openPanel(system);

    await setDataTarget(panel, 't');

    const captured: Record<string, unknown>[] = [];
    const tablePanel = {
      open: vi.fn(async (param: Record<string, unknown>): Promise<void> => {
        captured.push(param);
      }),
    };

    renderWithCapabilities(system, { tablePanel });

    await act(async () => {
      fireEvent.click(screen.getByTestId('table-edit-schema'));
    });

    expect(tablePanel.open).toHaveBeenCalledTimes(1);
    expect(captured.length).toBe(1);
    expect(JSON.stringify(captured[0])).toContain('table#schema.t');
    expect(JSON.stringify(captured[0])).toContain('"data"');
  });

  // schema 目标下成对关键字合成一行两个小数字输入，紧凑标量为一行单控件
  it('schema 目标下成对关键字合行、紧凑标量单控件', async () => {
    const system = await createSystem();
    const schemaDoc = { type: 'object', properties: { level: { type: 'integer', minimum: 0, maximum: 100 } } };

    system.injection.seed(tableSchemaResourceId('t'), schemaDoc);
    const panel = await openPanel(system);

    await setSchemaTarget(panel, 't');
    const { container } = renderWithCapabilities(system, {});

    const pair = container.querySelector('[data-test-id="schema-pair-minimum"]');

    expect(pair).not.toBeNull();
    expect(pair === null ? 0 : pair.querySelectorAll('input').length).toBe(2);

    const compact = container.querySelector('[data-test-id="table-input-type"]');

    expect(compact === null ? 0 : compact.querySelectorAll('textarea').length).toBe(1);
  });

  // schema 资源加载中时「编辑 Schema」按钮禁用
  it('schema 资源加载中「编辑 Schema」按钮禁用', async () => {
    const system = await createSystem();
    const sample = stringTable();

    seed(system, 't', sample.data, sample.schema);
    system.injection.hanging.add('table#schema.t');
    const panel = await openPanel(system);

    await act(async () => {
      panel.setTable({ data: tableDataResourceId('t'), schema: tableSchemaResourceId('t') });
    });
    renderWithCapabilities(system, { tablePanel: { open: vi.fn(async (): Promise<void> => {}) } });

    expect(screen.getByTestId('table-edit-schema').getAttribute('disabled')).not.toBeNull();
  });

  // schema 资源不可用时「编辑 Schema」按钮隐藏
  it('schema 资源不可用时「编辑 Schema」按钮隐藏', async () => {
    const system = await createSystem();
    const sample = stringTable();

    seed(system, 't', sample.data, sample.schema);
    system.injection.failing.add('table#schema.t');
    const panel = await openPanel(system);

    await setDataTarget(panel, 't');
    renderWithCapabilities(system, { tablePanel: { open: vi.fn(async (): Promise<void> => {}) } });

    expect(screen.queryByTestId('table-edit-schema')).toBeNull();
  });
});

describe('「在代码编辑器中打开」（D-30）', () => {
  // 数据视图下经注入代码打开器打开数据文件，整份写回并记一次可逆操作
  it('数据视图下打开数据文件并整份写回记一次可逆操作', async () => {
    const system = await createSystem();
    const sample = stringTable();

    seed(system, 't', sample.data, sample.schema);
    const panel = await openPanel(system);

    await setDataTarget(panel, 't');

    const requests: ICodeEditorOpenRequest[] = [];
    const codeEditor = {
      open: vi.fn(async (request: ICodeEditorOpenRequest): Promise<string | null> => {
        requests.push(request);
        return JSON.stringify({ name: 'b' });
      }),
    };

    renderWithCapabilities(system, { codeEditor });

    await act(async () => {
      fireEvent.click(screen.getByTestId('table-open-code'));
    });

    expect(requests.length).toBe(1);
    expect(requests[0].title).toBe('table.t');
    expect(JSON.parse(requests[0].content)).toEqual({ name: 'a' });
    expect(await system.resourceSystem.readContent(tableDataResourceId('t'))).toEqual({ name: 'b' });

    await system.undoSystem.undo();
    expect(await system.resourceSystem.readContent(tableDataResourceId('t'))).toEqual({ name: 'a' });
  });

  // 代码编辑器返回非法 JSON 时拒绝写回，资源保持不变并提示
  it('代码编辑器返回非法 JSON 时拒绝写回', async () => {
    const system = await createSystem();
    const sample = stringTable();

    seed(system, 't', sample.data, sample.schema);
    const panel = await openPanel(system);

    await setDataTarget(panel, 't');

    const codeEditor = { open: vi.fn(async (): Promise<string | null> => '{not json') };

    renderWithCapabilities(system, { codeEditor });

    await act(async () => {
      fireEvent.click(screen.getByTestId('table-open-code'));
    });

    expect(await system.resourceSystem.readContent(tableDataResourceId('t'))).toEqual({ name: 'a' });
    expect(screen.getByText('内容不是合法的 JSON，未写回。')).not.toBeNull();
  });

  // schema 视图下经注入代码打开器打开的是 schema 文件
  it('schema 视图下打开 schema 文件', async () => {
    const system = await createSystem();

    system.injection.seed(tableSchemaResourceId('t'), { type: 'object', properties: { name: { type: 'string' } } });
    const panel = await openPanel(system);

    await setSchemaTarget(panel, 't');

    const requests: ICodeEditorOpenRequest[] = [];
    const codeEditor = {
      open: vi.fn(async (request: ICodeEditorOpenRequest): Promise<string | null> => {
        requests.push(request);
        return null;
      }),
    };

    renderWithCapabilities(system, { codeEditor });

    await act(async () => {
      fireEvent.click(screen.getByTestId('table-open-code'));
    });

    expect(requests.length).toBe(1);
    expect(requests[0].title).toBe('table#schema.t');
    expect(JSON.parse(requests[0].content)).toEqual({ type: 'object', properties: { name: { type: 'string' } } });
  });

  // 能力缺失时「在代码编辑器中打开」按钮禁用
  it('无代码编辑器能力时按钮禁用', async () => {
    const system = await createSystem();
    const sample = stringTable();

    seed(system, 't', sample.data, sample.schema);
    const panel = await openPanel(system);

    await setDataTarget(panel, 't');
    renderWithCapabilities(system, {});

    expect(screen.getByTestId('table-open-code').getAttribute('disabled')).not.toBeNull();
  });
});

describe('schema 关键字 x-order 的编辑（P21）', () => {
  // 纯重排 x-order 数组次序被接受、写回 schema，且数据表行序随之变化
  it('x-order 纯重排被接受并改变行序', async () => {
    const system = await createSystem();

    seed(
      system,
      't',
      { a: '1', b: '2' },
      { type: 'object', properties: { a: { type: 'string' }, b: { type: 'string' } }, 'x-order': ['a', 'b'] },
    );
    const panel = await openPanel(system);

    await setSchemaTarget(panel, 't');
    const { container } = renderWithCapabilities(system, {});

    const textarea = container.querySelector('[data-test-id="table-input-x-order"] textarea');

    expect(textarea).not.toBeNull();

    await act(async () => {
      fireEvent.change(textarea as HTMLTextAreaElement, { target: { value: '["b","a"]' } });
      fireEvent.blur(textarea as HTMLTextAreaElement);
    });

    expect(container.querySelector('[data-test-id="table-error-x-order"]')).toBeNull();

    const schema = (await system.resourceSystem.readContent(tableSchemaResourceId('t'))) as Record<string, unknown>;

    expect(schema['x-order']).toEqual(['b', 'a']);

    await act(async () => {
      panel.setTable({ data: tableDataResourceId('t'), schema: tableSchemaResourceId('t') });
      await panel.onSwitchIn();
    });

    expect(rowKeys(container)).toEqual(['table-row-b', 'table-row-a']);
  });

  // 非字符串数组的 x-order 值被拒，schema 文档不变并给出错误提示
  it('x-order 非字符串数组被拒且文档不变', async () => {
    const system = await createSystem();

    seed(
      system,
      't',
      { a: '1', b: '2' },
      { type: 'object', properties: { a: { type: 'string' }, b: { type: 'string' } }, 'x-order': ['a', 'b'] },
    );
    const panel = await openPanel(system);

    await setSchemaTarget(panel, 't');
    const { container } = renderWithCapabilities(system, {});

    const textarea = container.querySelector('[data-test-id="table-input-x-order"] textarea');

    await act(async () => {
      fireEvent.change(textarea as HTMLTextAreaElement, { target: { value: '[1,2]' } });
      fireEvent.blur(textarea as HTMLTextAreaElement);
    });

    expect(container.querySelector('[data-test-id="table-error-x-order"]')).not.toBeNull();

    const schema = (await system.resourceSystem.readContent(tableSchemaResourceId('t'))) as Record<string, unknown>;

    expect(schema['x-order']).toEqual(['a', 'b']);
  });
});
