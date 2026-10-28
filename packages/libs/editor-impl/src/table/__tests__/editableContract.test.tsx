import { act, cleanup, configure, fireEvent, render } from '@testing-library/react';
import { EditorCore, IEditorPanel, IEditorPanelFactoryParam } from '@motajs/editor-core';
import { createElement, createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deriveSchemaPath, EditableTable, TablePanel, tablePanelType } from '..';
import { ContentSaveStatus, IEditableContentHandle } from '../../shared/editable/types';
import { TablePanelStatus } from '../../shared/schemaForm/components/TableGrid';
import { ITableDocument, ITableEdit, ITableEditableProps, TableEditKind } from '../types';
import { createTableHarness, FakeFileSystem } from './fixtures';

configure({ testIdAttribute: 'data-test-id' });

// 每个用例结束后卸载已挂载组件并还原被替换的实现，避免 DOM 与替身在用例之间累积
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// 一栏的样例文档：一个字符串字段，行树里渲染为文本域
const DOC_A: ITableDocument = {
  data: { name: 'a' },
  schema: { type: 'object', properties: { name: { type: 'string', description: '名字' } } },
  schemaMode: false,
};

// 另一份内容：用于核对「版本号变化才重置草稿」
const DOC_Z: ITableDocument = {
  data: { name: 'z' },
  schema: DOC_A.schema,
  schemaMode: false,
};

// 数据文件路径（`xxx.json`）
function tableDataPath(name: string): string {
  return `${name}.json`;
}

// schema 文件路径（按 `xxx.schema.json` 约定推导）
function tableSchemaPath(name: string): string {
  return deriveSchemaPath(tableDataPath(name));
}

// 以文本预置一张表的数据与 schema
function seed(fs: FakeFileSystem, name: string, data: unknown, schema: unknown): void {
  fs.seed(tableDataPath(name), JSON.stringify(data));
  fs.seed(tableSchemaPath(name), JSON.stringify(schema));
}

// 注册一个捕获实例的表格面板类型，在首个标签页打开面板并返回实例
async function openTablePanel(system: EditorCore, created: TablePanel[]): Promise<TablePanel> {
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

  await act(async () => {
    await system.shellSystem.openPanelInTab(tabId, tablePanelType.id);
  });

  return created[0];
}

// 取表格面板第 index 栏的 DOM 元素：断言限定到单栏，避免加宽窗口时同 test-id 重复命中
function columnAt(container: HTMLElement, index: number): Element {
  const columns = container.querySelectorAll('.etable-column');
  const column = columns[index];

  if (column === undefined) throw new Error(`栏 ${index} 缺失`);

  return column;
}

// 在指定栏内按 data-test-id 查询元素
function inColumn(container: HTMLElement, index: number, testId: string): Element | null {
  return columnAt(container, index).querySelector(`[data-test-id="${testId}"]`);
}

// 点击指定栏内按 data-test-id 定位的元素
function clickInColumn(container: HTMLElement, index: number, testId: string): void {
  const element = inColumn(container, index, testId);

  if (element === null) throw new Error(`栏内元素缺失: ${testId}`);

  fireEvent.click(element);
}

// 读取某个字段值单元格内文本域的当前文本
function valueOf(root: ParentNode, field: string): string | undefined {
  const cell = root.querySelector(`[data-test-id="table-input-${field}"]`);
  const textarea = cell === null ? null : cell.querySelector('textarea');

  return textarea === null ? undefined : textarea.value;
}

// 在字段值文本域中输入文本并提交（失焦）
async function commitText(root: ParentNode, field: string, text: string): Promise<void> {
  const cell = root.querySelector(`[data-test-id="table-input-${field}"]`);
  const textarea = cell === null ? null : cell.querySelector('textarea');

  await act(async () => {
    fireEvent.change(textarea as HTMLTextAreaElement, { target: { value: text } });
    fireEvent.blur(textarea as HTMLTextAreaElement);
  });
}

// 读取某路径数据文件的解析值（面板以文本写回）
async function readData(system: EditorCore, path: string): Promise<unknown> {
  const text = await system.resourceSystem.readContent(path);

  return typeof text === 'string' ? JSON.parse(text) : undefined;
}

// 读取面板某栏内部的版本号：运行时按名读取私有字段，用于核对「本地编辑不递增版本号」
function contentVersionOf(panel: TablePanel, columnIndex: number): number {
  return Reflect.get(panel, 'columns')[columnIndex].contentVersion;
}

// 读取面板某栏内部的交回脏标记
function draftDirtyOf(panel: TablePanel, columnIndex: number): boolean {
  return Reflect.get(panel, 'columns')[columnIndex].draftDirty;
}

// 测试替身的一次改值：只覆盖本例用到的顶层字符串字段
function applyChange(document: ITableDocument, edit: ITableEdit): ITableDocument {
  if (edit.kind !== TableEditKind.Change) return document;

  const data = document.data as Record<string, unknown>;
  const field = edit.key.split("'")[1];

  return { data: { ...data, [field]: edit.value }, schema: document.schema, schemaMode: false };
}

// 直接渲染可编辑组件所需的完整 props：除内容 / 版本号外都用本例给的替身
function editableProps(
  content: ITableDocument,
  contentVersion: number,
  overrides: Partial<ITableEditableProps>,
): ITableEditableProps {
  return {
    content,
    contentVersion,
    status: TablePanelStatus.Ready,
    applyEdit: (edit, document): ITableDocument => applyChange(document, edit),
    ...overrides,
  };
}

// 手动结算的 Promise：用于观察保存进行中的按钮状态
function createDeferred(): {
  readonly promise: Promise<ContentSaveStatus>;
  resolve: (status: ContentSaveStatus) => void;
} {
  let release: (status: ContentSaveStatus) => void = (): void => {};

  const promise = new Promise<ContentSaveStatus>((resolve): void => {
    release = resolve;
  });

  return {
    promise,
    resolve: (status: ContentSaveStatus): void => release(status),
  };
}

describe('可编辑表格组件契约（D-01 / D-03 / D-04 / D-06）', () => {
  // 读取当前内容快照；用 setData 换内容后组件视为已保存基线
  it('getData 返回草稿，setData 后不再脏', async () => {
    const ref = createRef<IEditableContentHandle<ITableDocument> | null>();

    render(createElement(EditableTable, editableProps(DOC_A, 0, { ref })));

    expect(ref.current?.getData()).toEqual(DOC_A);

    await act(async () => ref.current?.setData(DOC_Z));

    expect(ref.current?.getData()).toEqual(DOC_Z);
    expect(ref.current?.isDirty()).toBe(false);
  });

  // 一次本地编辑后 isDirty 为真，markSaved 后回到干净
  it('编辑后 isDirty 为真，markSaved 后为假', async () => {
    const ref = createRef<IEditableContentHandle<ITableDocument> | null>();
    const rendered = render(createElement(EditableTable, editableProps(DOC_A, 0, { ref })));

    await commitText(rendered.container, 'name', '"b"');

    expect(ref.current?.isDirty()).toBe(true);

    await act(async () => ref.current?.markSaved());

    expect(ref.current?.isDirty()).toBe(false);
  });

  // 版本号不变时替换 content 对象：草稿与行树都保持本地编辑结果，不被新对象覆盖
  it('版本号不变时替换内容不重置草稿', async () => {
    const ref = createRef<IEditableContentHandle<ITableDocument> | null>();
    const rendered = render(createElement(EditableTable, editableProps(DOC_A, 0, { ref })));

    await commitText(rendered.container, 'name', '"b"');

    rendered.rerender(createElement(EditableTable, editableProps(DOC_Z, 0, { ref })));

    expect(ref.current?.getData().data).toEqual({ name: 'b' });
    expect(valueOf(rendered.container, 'name')).toBe('"b"');
    expect(ref.current?.isDirty()).toBe(true);
  });

  // 版本号递增时草稿重置为新内容并清脏
  it('版本号递增时草稿重置为新内容', async () => {
    const ref = createRef<IEditableContentHandle<ITableDocument> | null>();
    const rendered = render(createElement(EditableTable, editableProps(DOC_A, 0, { ref })));

    await commitText(rendered.container, 'name', '"b"');

    rendered.rerender(createElement(EditableTable, editableProps(DOC_Z, 1, { ref })));

    expect(ref.current?.getData()).toEqual(DOC_Z);
    expect(ref.current?.isDirty()).toBe(false);
    expect(valueOf(rendered.container, 'name')).toBe('"z"');
  });

  // 卸载时交回的是卸载那一刻的草稿与脏标记：先编辑再卸载必为 true
  it('编辑后卸载交回草稿与当时的脏标记', async () => {
    const ref = createRef<IEditableContentHandle<ITableDocument> | null>();
    const onDraftChange = vi.fn();
    const rendered = render(createElement(EditableTable, editableProps(DOC_A, 0, { ref, onDraftChange })));

    await commitText(rendered.container, 'name', '"b"');

    // 编辑本身也会交回一次（面板据此持副本）；这里的断言只针对卸载 cleanup 那一次
    onDraftChange.mockClear();
    rendered.unmount();

    expect(onDraftChange).toHaveBeenCalledTimes(1);
    expect(onDraftChange.mock.calls[0][0].data).toEqual({ name: 'b' });
    expect(onDraftChange.mock.calls[0][1]).toBe(true);
  });

  // 从未编辑就卸载：交回的脏标记必须是 false（防「空依赖 cleanup 读首帧值」）
  it('未编辑时卸载交回的脏标记为假', () => {
    const ref = createRef<IEditableContentHandle<ITableDocument> | null>();
    const onDraftChange = vi.fn();
    const rendered = render(createElement(EditableTable, editableProps(DOC_A, 0, { ref, onDraftChange })));

    rendered.unmount();

    expect(onDraftChange).toHaveBeenCalledTimes(1);
    expect(onDraftChange.mock.calls[0][0]).toEqual(DOC_A);
    expect(onDraftChange.mock.calls[0][1]).toBe(false);
  });

  // 面板侧：一次本地编辑之后组件与面板都判脏，且该栏版本号不动
  it('本地编辑后面板判脏但版本号不变', async () => {
    const fs = new FakeFileSystem();

    seed(fs, 'hero', { name: 'a' }, { type: 'object', properties: { name: { type: 'string', description: '名字' } } });
    const system = await createTableHarness(fs);
    const created: TablePanel[] = [];
    const panel = await openTablePanel(system, created);

    panel.setTable({ dataPath: tableDataPath('hero') });

    await act(async () => {
      await panel.onSwitchIn();
    });

    const { container } = render(createElement(system.shellSystem.render()));
    const versionBefore = contentVersionOf(panel, 0);

    await commitText(container, 'name', '"b"');

    expect(panel.isColumnDirty(0)).toBe(true);
    expect(contentVersionOf(panel, 0)).toBe(versionBefore);
    expect(draftDirtyOf(panel, 0)).toBe(true);
    expect(valueOf(container, 'name')).toBe('"b"');
  });

  // 面板侧：编辑本身不写盘；切走后磁盘等于最后一次编辑（B1：保存期间组件仍挂载）
  it('编辑不写盘，切走必然落盘', async () => {
    const fs = new FakeFileSystem();

    seed(fs, 'hero', { name: 'a' }, { type: 'object', properties: { name: { type: 'string', description: '名字' } } });
    const system = await createTableHarness(fs);
    const created: TablePanel[] = [];
    const panel = await openTablePanel(system, created);

    panel.setTable({ dataPath: tableDataPath('hero') });

    await act(async () => {
      await panel.onSwitchIn();
    });

    const { container } = render(createElement(system.shellSystem.render()));

    await commitText(container, 'name', '"b"');

    expect(await fs.readFile(tableDataPath('hero'))).toBe(JSON.stringify({ name: 'a' }));

    const blankTab = system.shellSystem.openBlankTab();

    await act(async () => {
      await system.shellSystem.activateTab(blankTab);
    });

    expect(await readData(system, tableDataPath('hero'))).toEqual({ name: 'b' });
  });

  // 面板侧：点保存走组件契约，onSave 恰好一次且参数是草稿快照；成功后清脏并落盘
  it('保存按钮把草稿快照交给面板并在成功后清脏', async () => {
    const fs = new FakeFileSystem();

    seed(fs, 'hero', { name: 'a' }, { type: 'object', properties: { name: { type: 'string', description: '名字' } } });
    const system = await createTableHarness(fs);
    const created: TablePanel[] = [];
    const panel = await openTablePanel(system, created);

    panel.setTable({ dataPath: tableDataPath('hero') });

    await act(async () => {
      await panel.onSwitchIn();
    });

    const { container } = render(createElement(system.shellSystem.render()));
    const saveSpy = vi.spyOn(panel, 'saveDocument');

    await commitText(container, 'name', '"b"');

    await act(async () => {
      clickInColumn(container, 0, 'table-save');
    });
    await act(async () => {});

    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(saveSpy.mock.calls[0][1].data).toEqual({ name: 'b' });
    expect(await readData(system, tableDataPath('hero'))).toEqual({ name: 'b' });
    expect(panel.isColumnDirty(0)).toBe(false);
    expect(inColumn(container, 0, 'table-unsaved')).toBeNull();
  });

  // 面板侧：写盘失败保留脏、显示错误、磁盘仍是旧内容
  it('保存失败保留脏并显示错误', async () => {
    const fs = new FakeFileSystem();

    seed(fs, 'hero', { name: 'a' }, { type: 'object', properties: { name: { type: 'string', description: '名字' } } });

    const system = await createTableHarness(fs);
    const created: TablePanel[] = [];
    const panel = await openTablePanel(system, created);

    panel.setTable({ dataPath: tableDataPath('hero') });

    await act(async () => {
      await panel.onSwitchIn();
    });

    const { container } = render(createElement(system.shellSystem.render()));

    // 读盘已成功，之后才把写盘置为失败，避免加载态一起失败
    fs.failing.add(tableDataPath('hero'));

    await commitText(container, 'name', '"b"');

    await act(async () => {
      clickInColumn(container, 0, 'table-save');
    });
    await act(async () => {});

    expect(panel.isColumnDirty(0)).toBe(true);

    const notice = inColumn(container, 0, 'table-notice');

    expect(notice === null ? '' : notice.textContent).toContain('写入失败');

    // 解除写盘故障后直接读文件：磁盘仍是旧内容，说明失败没有把改动写出去
    fs.failing.delete(tableDataPath('hero'));

    expect(await fs.readFile(tableDataPath('hero'))).toBe(JSON.stringify({ name: 'a' }));
  });

  // 面板侧：换表不带旧草稿——A 的编辑先写回 A，B 打开后内容与脏状态都来自 B
  it('换表后组件显示新表内容且不带旧草稿', async () => {
    const fs = new FakeFileSystem();
    const schema = { type: 'object', properties: { name: { type: 'string', description: '名字' } } };

    seed(fs, 'a', { name: 'aa' }, schema);
    seed(fs, 'b', { name: 'bb' }, schema);

    const system = await createTableHarness(fs);
    const created: TablePanel[] = [];
    const panel = await openTablePanel(system, created);

    panel.setTable({ dataPath: tableDataPath('a') });

    await act(async () => {
      await panel.onSwitchIn();
    });

    const { container } = render(createElement(system.shellSystem.render()));

    await commitText(container, 'name', '"edited"');

    await act(async () => {
      panel.setTable({ dataPath: tableDataPath('b') });
      await panel.onSwitchIn();
    });
    await act(async () => {});

    expect(valueOf(container, 'name')).toBe('"bb"');
    expect(panel.isColumnDirty(0)).toBe(false);
    expect(draftDirtyOf(panel, 0)).toBe(false);

    const blankTab = system.shellSystem.openBlankTab();

    await act(async () => {
      await system.shellSystem.activateTab(blankTab);
    });

    expect(await readData(system, tableDataPath('a'))).toEqual({ name: 'edited' });
    expect(await readData(system, tableDataPath('b'))).toEqual({ name: 'bb' });
  });

  // 面板侧：保存进行中按钮禁用且显示「保存中…」，结算后恢复为「保存」
  it('保存进行中按钮显示保存中并在结算后恢复', async () => {
    const fs = new FakeFileSystem();

    seed(fs, 'hero', { name: 'a' }, { type: 'object', properties: { name: { type: 'string', description: '名字' } } });
    const system = await createTableHarness(fs);
    const created: TablePanel[] = [];
    const panel = await openTablePanel(system, created);

    panel.setTable({ dataPath: tableDataPath('hero') });

    await act(async () => {
      await panel.onSwitchIn();
    });

    const { container } = render(createElement(system.shellSystem.render()));
    const deferred = createDeferred();

    vi.spyOn(panel, 'saveDocument').mockImplementation((): Promise<ContentSaveStatus> => deferred.promise);

    await commitText(container, 'name', '"b"');

    await act(async () => {
      clickInColumn(container, 0, 'table-save');
    });

    const button = inColumn(container, 0, 'table-save');

    expect(button?.hasAttribute('disabled')).toBe(true);
    expect(button?.textContent).toContain('保存中…');

    await act(async () => {
      deferred.resolve(ContentSaveStatus.Failed);
    });

    expect(button?.textContent).toContain('保存');
    expect(button?.hasAttribute('disabled')).toBe(false);
  });
});
