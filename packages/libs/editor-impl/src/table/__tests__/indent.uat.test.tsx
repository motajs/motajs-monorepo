import { cleanup, configure, render } from '@testing-library/react';
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

// 每个用例结束后卸载已挂载的组件
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

// 渲染给定表并返回渲染容器
async function renderTable(system: TestSystem, name: string): Promise<HTMLElement> {
  const panel = await openPanel(system);

  await setTarget(panel, name);
  const { container } = render(createElement(system.shellSystem.render()));

  return container;
}

// 一张顶层含一个叶子字段与一个嵌套 object 的样例表
function levelSample(): { readonly data: unknown; readonly schema: unknown } {
  return {
    data: { top: 'x', nested: { inner: 'deep' } },
    schema: {
      type: 'object',
      properties: {
        top: { type: 'string' },
        nested: { type: 'object', properties: { inner: { type: 'string' } } },
      },
    },
  };
}

// 一张两层嵌套 object 的样例表（外层与内层都是可折叠的展开行）
function deepSample(): { readonly data: unknown; readonly schema: unknown } {
  return {
    data: { outer: { inner: { deep: 'v' } } },
    schema: {
      type: 'object',
      properties: {
        outer: {
          type: 'object',
          properties: { inner: { type: 'object', properties: { deep: { type: 'string' } } } },
        },
      },
    },
  };
}

// 取某一行的条目标题单元格，缺失时抛错
function nameCell(container: HTMLElement, testId: string): Element {
  const row = container.querySelector(`[data-test-id="${testId}"]`);

  if (row === null) throw new Error(`缺行：${testId}`);

  const cell = row.querySelector('.etable-cell-name');

  if (cell === null) throw new Error(`缺条目列：${testId}`);

  return cell;
}

describe('层级缩进只在条目列（P3）', () => {
  // 子层级只给条目列打层级标记，其余三列不带层级（故不会整体收窄 / 右移）
  it('子层级只在条目列带层级，其余三列不带', async () => {
    const system = await createSystem();
    const sample = levelSample();

    seed(system, 'lvl', sample.data, sample.schema);
    const container = await renderTable(system, 'lvl');
    const topRow = container.querySelector('[data-test-id="table-row-top"]');
    const childRow = container.querySelector('[data-test-id="table-row-nested-inner"]');

    if (topRow === null || childRow === null) throw new Error('行缺失');

    expect(topRow.querySelector('.etable-cell-name')?.getAttribute('data-level')).toBe('0');
    expect(childRow.querySelector('.etable-cell-name')?.getAttribute('data-level')).toBe('1');
    expect(childRow.querySelector('.etable-cell-comment')?.getAttribute('data-level')).toBeNull();
    expect(childRow.querySelector('.etable-cell-value')?.getAttribute('data-level')).toBeNull();
    expect(childRow.querySelector('.etable-cell-action')?.getAttribute('data-level')).toBeNull();
  });

  // 子行缩进没有丢列：条目 / 注释 / 值 / 操作四列仍在
  it('子行仍保留条目 / 注释 / 值 / 操作四列', async () => {
    const system = await createSystem();
    const sample = levelSample();

    seed(system, 'lvl', sample.data, sample.schema);
    const container = await renderTable(system, 'lvl');
    const childRow = container.querySelector('[data-test-id="table-row-nested-inner"]');

    if (childRow === null) throw new Error('子行缺失');

    const cells = childRow.querySelectorAll('.etable-cell');

    expect(cells.length).toBe(4);
    expect(childRow.querySelector('.etable-cell-name')).not.toBeNull();
    expect(childRow.querySelector('.etable-cell-comment')).not.toBeNull();
    expect(childRow.querySelector('.etable-cell-value')).not.toBeNull();
    expect(childRow.querySelector('.etable-cell-action')).not.toBeNull();
    expect(nameCell(container, 'table-row-nested-inner')).not.toBeNull();
  });
});

describe('树形引导线、外框与垂直居中（P4/P11）', () => {
  // 深层条目列里的引导竖线严格多于顶层（0 层 0 条、1 层 1 条）
  it('深层条目列的引导竖线多于顶层', async () => {
    const system = await createSystem();
    const sample = levelSample();

    seed(system, 'guide', sample.data, sample.schema);
    const container = await renderTable(system, 'guide');
    const topGuides = nameCell(container, 'table-row-top').querySelectorAll('.etable-tree-guide').length;
    const childGuides = nameCell(container, 'table-row-nested-inner').querySelectorAll('.etable-tree-guide').length;

    expect(topGuides).toBe(0);
    expect(childGuides).toBe(1);
    expect(childGuides).toBeGreaterThan(topGuides);
  });

  // 引导线只出现在条目列，其余三列不带引导竖线
  it('引导竖线只占条目列', async () => {
    const system = await createSystem();
    const sample = levelSample();

    seed(system, 'guide', sample.data, sample.schema);
    const container = await renderTable(system, 'guide');
    const childRow = container.querySelector('[data-test-id="table-row-nested-inner"]');

    if (childRow === null) throw new Error('子行缺失');

    expect(childRow.querySelectorAll('.etable-cell-comment .etable-tree-guide').length).toBe(0);
    expect(childRow.querySelectorAll('.etable-cell-value .etable-tree-guide').length).toBe(0);
    expect(childRow.querySelectorAll('.etable-cell-action .etable-tree-guide').length).toBe(0);
  });

  // 外框 / 居中结构就绪（jsdom 不做 CSS 布局，退化为结构断言：外框根、引导线、单元格均在）
  it('外框 / 引导线 / 居中结构就绪', async () => {
    const system = await createSystem();
    const sample = levelSample();

    seed(system, 'guide', sample.data, sample.schema);
    const container = await renderTable(system, 'guide');

    expect(container.querySelector('.etable')).not.toBeNull();
    expect(container.querySelectorAll('.etable-tree-guide').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.etable-cell').length).toBeGreaterThan(0);
  });
});

describe('嵌套展开行逐级加深与缩进步长（P8）', () => {
  // 外层 / 内层展开行分别标注 data-level 0 / 1，供逐级加深底色
  it('展开行按层级标注 data-level', async () => {
    const system = await createSystem();
    const sample = deepSample();

    seed(system, 'deep', sample.data, sample.schema);
    const container = await renderTable(system, 'deep');
    const outer = container.querySelector('[data-test-id="table-row-outer"]');
    const inner = container.querySelector('[data-test-id="table-row-outer-inner"]');

    if (outer === null || inner === null) throw new Error('展开行缺失');

    expect(outer.classList.contains('etable-row-group')).toBe(true);
    expect(inner.classList.contains('etable-row-group')).toBe(true);
    expect(outer.getAttribute('data-level')).toBe('0');
    expect(inner.getAttribute('data-level')).toBe('1');
  });

  // 子行（非展开行）不带层级底色属性，保持透明
  it('子行不带层级底色属性', async () => {
    const system = await createSystem();
    const sample = deepSample();

    seed(system, 'deep', sample.data, sample.schema);
    const container = await renderTable(system, 'deep');
    const leaf = container.querySelector('[data-test-id="table-row-outer-inner-deep"]');

    if (leaf === null) throw new Error('叶子行缺失');

    expect(leaf.classList.contains('etable-row-group')).toBe(false);
    expect(leaf.getAttribute('data-level')).toBeNull();
  });

  // 缩进步长缩到约 9px（原 12px 的 3/4）
  it('缩进步长约为 9px', async () => {
    const system = await createSystem();
    const sample = deepSample();

    seed(system, 'deep', sample.data, sample.schema);
    const container = await renderTable(system, 'deep');
    const guides = nameCell(container, 'table-row-outer-inner').querySelectorAll<HTMLElement>('.etable-tree-guide');

    expect(guides.length).toBe(1);
    expect(guides[0].style.width).toBe('9px');
  });
});
