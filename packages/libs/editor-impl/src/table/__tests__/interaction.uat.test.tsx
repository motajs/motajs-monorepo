import { act, cleanup, configure, fireEvent, render, screen } from '@testing-library/react';
import { EditorCore, IEditorPanel, IEditorPanelFactoryParam } from '@motajs/editor-core';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deriveSchemaPath, tablePanelType, TablePanel } from '..';
import tableCss from '../table.css?inline';
import { createTableHarness, FakeFileSystem } from './fixtures';

configure({ testIdAttribute: 'data-test-id' });

/** 表格样式表原文：jsdom 不应用外部 CSS，折叠行边框断言改为核对样式规则文本 */
const TABLE_CSS = tableCss;

// 每个用例结束后卸载已挂载的组件并清理被 stub 的浏览器对话框
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// 数据文件路径（`xxx.json`）
function tableDataPath(name: string): string {
  return `${name}.json`;
}

// schema 文件路径（按 `xxx.schema.json` 约定推导）
function tableSchemaPath(name: string): string {
  return deriveSchemaPath(tableDataPath(name));
}

// 在空白标签页打开表格面板并返回其实例
async function openPanel(system: EditorCore): Promise<TablePanel> {
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

// 以文本预置一张表的数据与 schema
function seed(fs: FakeFileSystem, name: string, data: unknown, schema: unknown): void {
  fs.seed(tableDataPath(name), JSON.stringify(data));
  fs.seed(tableSchemaPath(name), JSON.stringify(schema));
}

// 把面板目标指向数据表，并等待一次切入刷新完成
async function setTarget(panel: TablePanel, name: string): Promise<void> {
  panel.setTable({ dataPath: tableDataPath(name) });
  await panel.onSwitchIn();
}

// 读取某个路径的当前内容（面板以文本写回，读取后解析）
async function readContent(system: EditorCore, path: string): Promise<unknown> {
  const text = await system.resourceSystem.readContent(path);

  if (typeof text !== 'string') return undefined;

  return JSON.parse(text);
}

// 读取目标表的当前数据内容
async function readData(system: EditorCore, name: string): Promise<unknown> {
  return readContent(system, tableDataPath(name));
}

/**
 * 把面板内存中的未落盘改动写回资源（手动保存模型）
 * @param panel 表格面板实例
 */
async function savePanel(panel: TablePanel): Promise<void> {
  await panel.save();
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

// 一张带嵌套 object 的样例表
function nestedTable(): { readonly data: unknown; readonly schema: unknown } {
  return {
    data: { nested: { inner: 'deep' } },
    schema: {
      type: 'object',
      properties: {
        nested: { type: 'object', properties: { inner: { type: 'string' } } },
      },
    },
  };
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

describe('分组行呈现（L2）', () => {
  // 分组行最左有折叠控件与对象名
  it('分组行显示折叠控件与对象名', async () => {
    const fs = new FakeFileSystem();
    const sample = nestedTable();

    seed(fs, 'fold', sample.data, sample.schema);
    const system = await createTableHarness(fs);
    const panel = await openPanel(system);

    await setTarget(panel, 'fold');
    const { container } = render(createElement(system.shellSystem.render()));

    const groupRow = container.querySelector('[data-test-id="table-row-nested"]');

    expect(groupRow).not.toBeNull();
    expect(groupRow === null ? '' : groupRow.textContent).toContain('nested');
    expect(screen.getByTestId('gap-toggle-nested')).not.toBeNull();
  });

  // 子行位于带缩进的折叠分组容器内
  it('子行位于带缩进的分组容器内', async () => {
    const fs = new FakeFileSystem();
    const sample = nestedTable();

    seed(fs, 'fold', sample.data, sample.schema);
    const system = await createTableHarness(fs);
    const panel = await openPanel(system);

    await setTarget(panel, 'fold');
    const { container } = render(createElement(system.shellSystem.render()));

    const child = container.querySelector('[data-test-id="table-row-nested-inner"]');

    expect(child).not.toBeNull();
    expect(child?.parentElement?.classList.contains('etable-group-children')).toBe(true);
  });
});

describe('折叠行整行点击（P19）', () => {
  // 点折叠行非按钮处折叠，再次点击展开
  it('点折叠行任意处切换折叠', async () => {
    const fs = new FakeFileSystem();
    const sample = nestedTable();

    seed(fs, 'fold', sample.data, sample.schema);
    const system = await createTableHarness(fs);
    const panel = await openPanel(system);

    await setTarget(panel, 'fold');
    const { container } = render(createElement(system.shellSystem.render()));

    const groupName = container.querySelector('.etable-group-name');

    if (groupName === null) throw new Error('分组行条目名缺失');

    fireEvent.click(groupName);
    expect(container.querySelector('[data-test-id="table-row-nested-inner"]')).toBeNull();

    fireEvent.click(groupName);
    expect(container.querySelector('[data-test-id="table-row-nested-inner"]')).not.toBeNull();
  });

  // 点折叠箭头一次只切换一次：子行消失且不立即重现（未与整行点击重复切换）
  it('点折叠箭头只切换一次', async () => {
    const fs = new FakeFileSystem();
    const sample = nestedTable();

    seed(fs, 'fold', sample.data, sample.schema);
    const system = await createTableHarness(fs);
    const panel = await openPanel(system);

    await setTarget(panel, 'fold');
    const { container } = render(createElement(system.shellSystem.render()));

    fireEvent.click(screen.getByTestId('gap-toggle-nested'));

    expect(container.querySelector('[data-test-id="table-row-nested-inner"]')).toBeNull();
  });

  // 点折叠行的子行不折叠父行
  it('点子行不折叠父行', async () => {
    const fs = new FakeFileSystem();
    const sample = nestedTable();

    seed(fs, 'fold', sample.data, sample.schema);
    const system = await createTableHarness(fs);
    const panel = await openPanel(system);

    await setTarget(panel, 'fold');
    const { container } = render(createElement(system.shellSystem.render()));

    const child = container.querySelector('[data-test-id="table-row-nested-inner"]');

    if (child === null) throw new Error('子行缺失');

    fireEvent.click(child);

    expect(container.querySelector('[data-test-id="table-row-nested-inner"]')).not.toBeNull();
  });
});

describe('折叠行上下边框加粗（P16）', () => {
  // 折叠行样式含比普通单元格（1px）更粗的上下边框
  it('折叠行上下边框加粗', () => {
    expect(TABLE_CSS).toMatch(/\.etable-row-group\s*\{[^}]*border-top:\s*2px[^}]*\}/);
    expect(TABLE_CSS).toMatch(/\.etable-row-group\s*\{[^}]*border-bottom:\s*2px[^}]*\}/);
  });
});

describe('左侧 ± 圆形按钮（B4）', () => {
  // 添加模式下每行位置出现绿底圆形「+」
  it('添加模式在行上出现 + 按钮', async () => {
    const fs = new FakeFileSystem();
    const sample = pairTable();

    seed(fs, 'add', sample.data, sample.schema);
    const system = await createTableHarness(fs);
    const panel = await openPanel(system);

    await setTarget(panel, 'add');
    render(createElement(system.shellSystem.render()));

    await switchMode('添加');

    expect(screen.getByTestId('table-add-after-a')).not.toBeNull();
    expect(screen.getByTestId('table-add-after-b')).not.toBeNull();
  });

  // 删除模式下每行位置出现红底圆形「−」，点击直接删除且不调用原生 confirm
  it('删除模式点 − 直接删除且不调用原生 confirm', async () => {
    const fs = new FakeFileSystem();
    const sample = pairTable();
    const confirmStub = vi.fn(() => true);

    vi.stubGlobal('confirm', confirmStub);

    seed(fs, 'del', sample.data, sample.schema);
    const system = await createTableHarness(fs);
    const panel = await openPanel(system);

    await setTarget(panel, 'del');
    render(createElement(system.shellSystem.render()));

    await switchMode('删除');

    expect(screen.getByTestId('table-delete-a')).not.toBeNull();

    await gutterDelete('a');
    await savePanel(panel);

    expect(await readData(system, 'del')).toEqual({ b: '2' });
    expect(confirmStub).not.toHaveBeenCalled();
  });

  // 新增全程不触碰浏览器原生 prompt
  it('新增全程不调用原生 prompt', async () => {
    const fs = new FakeFileSystem();
    const sample = pairTable();
    const promptStub = vi.fn();

    vi.stubGlobal('prompt', promptStub);

    seed(fs, 'add', sample.data, sample.schema);
    const system = await createTableHarness(fs);
    const panel = await openPanel(system);

    await setTarget(panel, 'add');
    render(createElement(system.shellSystem.render()));

    await switchMode('添加');
    await gutterAdd('a', 'mid');
    await savePanel(panel);

    expect(await readData(system, 'add')).toEqual({ a: '1', mid: null, b: '2' });
    expect(promptStub).not.toHaveBeenCalled();
  });
});

describe('新增位置与 x-order（L3）', () => {
  // 新增行插在锚点行之后，而不是落到末尾
  it('新增行插到锚点行之后', async () => {
    const fs = new FakeFileSystem();
    const sample = pairTable();

    seed(fs, 'ins', sample.data, sample.schema);
    const system = await createTableHarness(fs);
    const panel = await openPanel(system);

    await setTarget(panel, 'ins');
    const { container } = render(createElement(system.shellSystem.render()));

    await switchMode('添加');
    await gutterAdd('a', 'mid');

    expect(rowKeys(container)).toEqual(['table-row-a', 'table-row-mid', 'table-row-b']);
  });

  // 行序按 schema 的 x-order 排列，而非 properties 自然顺序
  it('行序按 schema 的 x-order 排列', async () => {
    const fs = new FakeFileSystem();

    seed(
      fs,
      'order',
      { a: '1', b: '2' },
      {
        type: 'object',
        properties: { a: { type: 'string' }, b: { type: 'string' } },
        'x-order': ['b', 'a'],
      },
    );
    const system = await createTableHarness(fs);
    const panel = await openPanel(system);

    await setTarget(panel, 'order');
    const { container } = render(createElement(system.shellSystem.render()));

    expect(rowKeys(container)).toEqual(['table-row-b', 'table-row-a']);
  });

  // 新增后撤销，数据与行序都回到新增前
  it('新增后撤销还原数据与行序', async () => {
    const fs = new FakeFileSystem();
    const sample = pairTable();

    seed(fs, 'undo', sample.data, sample.schema);
    const system = await createTableHarness(fs);
    const panel = await openPanel(system);

    await setTarget(panel, 'undo');
    const { container } = render(createElement(system.shellSystem.render()));

    await switchMode('添加');
    await gutterAdd('a', 'mid');
    await savePanel(panel);

    expect(await readData(system, 'undo')).toEqual({ a: '1', mid: null, b: '2' });

    await act(async () => {
      await system.undoSystem.undo();
    });
    await savePanel(panel);

    expect(await readData(system, 'undo')).toEqual({ a: '1', b: '2' });
    expect(rowKeys(container)).toEqual(['table-row-a', 'table-row-b']);
  });
});
