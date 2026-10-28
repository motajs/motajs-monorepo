import { act, cleanup, configure, fireEvent, render, screen } from '@testing-library/react';
import { EditorCore, EditorFileChangeKind, IEditorPanel, IEditorPanelFactoryParam } from '@motajs/editor-core';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deriveSchemaPath, tablePanelType, TablePanel } from '..';
import { createTableHarness, FakeFileSystem } from './fixtures';

// 表格面板的外部变化同步：逐栏路径匹配、按基线原文比较，不脏自动刷新、脏则弹冲突、自写回声忽略。
// 这里直接投递 IEditorPanel.onResourceChange（路径合法性与索引维护由 core 的既有用例覆盖），
// 因此每条用例都能精确断言「内容有没有变、版本号有没有动、冲突框有没有出现」。

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

// 注册一个捕获实例的面板类型，在空白标签页打开面板并返回实例
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

// 以文本预置一张表的数据与 schema
function seed(fs: FakeFileSystem, name: string, data: unknown, schema: unknown): void {
  fs.seed(tableDataPath(name), JSON.stringify(data));
  fs.seed(tableSchemaPath(name), JSON.stringify(schema));
}

// 读取某个字段值单元格内文本域的当前文本
function valueOf(container: HTMLElement, field: string): string | undefined {
  const cell = container.querySelector(`[data-test-id="table-input-${field}"]`);
  const textarea = cell === null ? null : cell.querySelector('textarea');

  return textarea === null ? undefined : textarea.value;
}

// 按渲染顺序取第 index 栏的容器
function columnAt(container: HTMLElement, index: number): Element {
  const column = container.querySelectorAll('.etable-column')[index];

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

// 在字段值文本域中输入文本并提交（失焦），使该栏进入未保存态
async function commitText(container: HTMLElement, field: string, text: string): Promise<void> {
  const cell = container.querySelector(`[data-test-id="table-input-${field}"]`);
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

// 投递一次外部变化：先让资源层失效缓存（真实宿主在变化事件里做同一件事），再交给面板
async function dispatchChange(
  system: EditorCore,
  panel: TablePanel,
  path: string,
  kind: EditorFileChangeKind = EditorFileChangeKind.Change,
): Promise<void> {
  await act(async () => {
    await system.resourceSystem.updateResource(path);
    await panel.onResourceChange(path, kind);
  });
  await act(async () => {});
}

// 装配一个打开了一张表并已渲染的表格面板
async function openRenderedTable(fs: FakeFileSystem): Promise<{
  system: EditorCore;
  panel: TablePanel;
  container: HTMLElement;
}> {
  seed(fs, 't', { name: 'a' }, { type: 'object', properties: { name: { type: 'string' } } });

  const system = await createTableHarness(fs);
  const panels: TablePanel[] = [];
  const panel = await openTablePanel(system, panels);

  panel.setTable({ dataPath: tableDataPath('t') });

  await act(async () => {
    await panel.onSwitchIn();
  });

  const { container } = render(createElement(system.shellSystem.render()));

  return { system, panel, container };
}

describe('表格面板外部变化（D-15 / D-16 / D-17 / D-36 / D-37）', () => {
  // 不脏时外部改文件：自动刷新内容并递增版本号，不弹冲突框
  it('不脏时外部改文件自动刷新并递增版本号', async () => {
    const fs = new FakeFileSystem();
    const { system, panel, container } = await openRenderedTable(fs);

    expect(valueOf(container, 'name')).toBe('"a"');

    const versionBefore = panel['columns'][0].contentVersion;

    fs.seed(tableDataPath('t'), JSON.stringify({ name: 'b' }));
    await dispatchChange(system, panel, tableDataPath('t'));

    expect(valueOf(container, 'name')).toBe('"b"');
    expect(panel['columns'][0].contentVersion).toBeGreaterThan(versionBefore);
    expect(screen.queryByTestId('panel-conflict-dialog')).toBeNull();
  });

  // 有未保存改动时外部改文件：内容不换，记录待决冲突并弹出冲突框
  it('脏时外部改文件弹冲突框且内容不变', async () => {
    const fs = new FakeFileSystem();
    const { system, panel, container } = await openRenderedTable(fs);

    await commitText(container, 'name', '"draft"');

    fs.seed(tableDataPath('t'), JSON.stringify({ name: 'external' }));
    await dispatchChange(system, panel, tableDataPath('t'));

    expect(valueOf(container, 'name')).toBe('"draft"');
    expect(panel['columns'][0].pendingConflict?.path).toBe(tableDataPath('t'));
    expect(screen.queryByTestId('panel-conflict-dialog')).not.toBeNull();
  });

  // 选「放弃我的改动并刷新」：内容换成外部内容，未保存标记消失
  it('选放弃后用外部内容替换并清掉脏标记', async () => {
    const fs = new FakeFileSystem();
    const { system, panel, container } = await openRenderedTable(fs);

    await commitText(container, 'name', '"draft"');

    fs.seed(tableDataPath('t'), JSON.stringify({ name: 'external' }));
    await dispatchChange(system, panel, tableDataPath('t'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('panel-conflict-discard'));
    });
    await act(async () => {});

    expect(valueOf(container, 'name')).toBe('"external"');
    expect(screen.queryByTestId('panel-conflict-dialog')).toBeNull();
    expect(inColumn(container, 0, 'table-unsaved')).toBeNull();
  });

  // 选「保留我的改动」：内容仍是草稿、基线已推进，下一次保存把草稿写回并覆盖外部内容
  it('选保留后内容不变且下一次保存覆盖外部内容', async () => {
    const fs = new FakeFileSystem();
    const { system, panel, container } = await openRenderedTable(fs);

    await commitText(container, 'name', '"draft"');

    fs.seed(tableDataPath('t'), JSON.stringify({ name: 'external' }));
    await dispatchChange(system, panel, tableDataPath('t'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('panel-conflict-keep'));
    });
    await act(async () => {});

    expect(valueOf(container, 'name')).toBe('"draft"');
    expect(screen.queryByTestId('panel-conflict-dialog')).toBeNull();

    await act(async () => {
      clickInColumn(container, 0, 'table-save');
    });
    await act(async () => {});

    expect(await readData(system, tableDataPath('t'))).toEqual({ name: 'draft' });
  });

  // 保存后宿主回送同内容：基线相同，判为自写回声，不刷新、不弹框
  it('保存后宿主回声被忽略', async () => {
    const fs = new FakeFileSystem();
    const { system, panel, container } = await openRenderedTable(fs);

    await commitText(container, 'name', '"b"');

    await act(async () => {
      clickInColumn(container, 0, 'table-save');
    });
    await act(async () => {});

    const versionAfterSave = panel['columns'][0].contentVersion;

    // 不修改文件，只回送一次「内容变化」事件，模拟编辑器自己写入的宿主回声
    await dispatchChange(system, panel, tableDataPath('t'));

    expect(panel['columns'][0].contentVersion).toBe(versionAfterSave);
    expect(valueOf(container, 'name')).toBe('"b"');
    expect(screen.queryByTestId('panel-conflict-dialog')).toBeNull();
  });

  // 同一次变化连发两次：只处理一次，版本号只递增一次
  it('同一次变化连发两次只处理一次', async () => {
    const fs = new FakeFileSystem();
    const { system, panel, container } = await openRenderedTable(fs);

    const versionBefore = panel['columns'][0].contentVersion;

    fs.seed(tableDataPath('t'), JSON.stringify({ name: 'b' }));
    await act(async () => {
      await system.resourceSystem.updateResource(tableDataPath('t'));
      await Promise.all([
        panel.onResourceChange(tableDataPath('t'), EditorFileChangeKind.Change),
        panel.onResourceChange(tableDataPath('t'), EditorFileChangeKind.Change),
      ]);
    });
    await act(async () => {});

    expect(panel['columns'][0].contentVersion).toBe(versionBefore + 1);
    expect(valueOf(container, 'name')).toBe('"b"');
  });

  // 外部文件被删除：不抛错、不清空内容，只降级为一条提示
  it('外部文件删除不抛错且保留内容', async () => {
    const fs = new FakeFileSystem();
    const { system, panel, container } = await openRenderedTable(fs);

    fs.deleteFile(tableDataPath('t'));

    await expect(
      dispatchChange(system, panel, tableDataPath('t'), EditorFileChangeKind.Delete),
    ).resolves.toBeUndefined();

    expect(valueOf(container, 'name')).toBe('"a"');
    expect(screen.queryByTestId('panel-conflict-dialog')).toBeNull();
    expect(inColumn(container, 0, 'table-notice')?.textContent).toContain('删除');
  });

  // 读取外部内容失败：提示「读取外部改动失败，已保留你的改动」且不替换内容
  it('读取外部内容失败时提示并保留内容', async () => {
    const fs = new FakeFileSystem();
    const { system, panel, container } = await openRenderedTable(fs);

    fs.failing.add(tableDataPath('t'));

    await dispatchChange(system, panel, tableDataPath('t'));

    expect(valueOf(container, 'name')).toBe('"a"');
    expect(screen.queryByTestId('panel-conflict-dialog')).toBeNull();
    expect(inColumn(container, 0, 'table-notice')?.textContent).toContain('读取外部改动失败，已保留你的改动');
  });

  // 非本栏路径：一次文件读取都不发生，版本号与内容都不变
  it('非本栏路径零副作用', async () => {
    const fs = new FakeFileSystem();
    const { system, panel, container } = await openRenderedTable(fs);

    const versionBefore = panel['columns'][0].contentVersion;
    const readSpy = vi.spyOn(fs, 'readFile');

    await act(async () => {
      await panel.onResourceChange('other.json', EditorFileChangeKind.Change);
    });

    expect(readSpy).not.toHaveBeenCalled();
    expect(panel['columns'][0].contentVersion).toBe(versionBefore);
    expect(valueOf(container, 'name')).toBe('"a"');
  });
});
