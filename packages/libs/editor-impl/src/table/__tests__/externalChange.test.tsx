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

// 每个用例结束后卸载已挂载的组件，避免 DOM 在用例之间累积；假定时器必须还原，不能漏到下一个用例
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
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

// 读取某路径数据文件的裸磁盘内容：`FakeFileSystem.readFile` 不经缓冲，用来证明「磁盘上到底是什么」
async function readDisk(fs: FakeFileSystem, path: string): Promise<unknown> {
  return JSON.parse(await fs.readFile(path));
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

// 推进假定时器并冲刷一次微任务链（与 tableAutoSave 用例的写法保持一致）
async function advance(milliseconds: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(milliseconds);
  await act(async () => {});
}

// 切到工具栏中的某编辑模式（按分段控件文案点击）
async function switchMode(label: string): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByText(label));
  });
}

// 在「添加」模式下点某行 gutter 的「+」→ 输入新字段名 → 失焦提交（数据与 schema 两条路径同时变脏）
async function addFieldByBlur(field: string, name: string): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByTestId(`table-add-after-${field}`));
  });

  const input = screen.getByTestId(`table-add-input-${field}`);

  await act(async () => {
    fireEvent.change(input, { target: { value: name } });
    fireEvent.blur(input);
  });
}

// 装配一个打开了一张表并已渲染的表格面板（缺省是单字段 `name` 的表，可换用带数字字段的表）
async function openRenderedTable(
  fs: FakeFileSystem,
  data: unknown = { name: 'a' },
  schema: unknown = { type: 'object', properties: { name: { type: 'string' } } },
): Promise<{
  system: EditorCore;
  panel: TablePanel;
  container: HTMLElement;
}> {
  seed(fs, 't', data, schema);

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

  // 有待写时外部改文件：读取回落到外部内容、冲突框记录外部原文而不是待写草稿
  it('有待写时外部改文件不被缓冲遮蔽且仍弹冲突框', async () => {
    const fs = new FakeFileSystem();
    const { system, panel, container } = await openRenderedTable(fs);

    await commitText(container, 'name', '"draft"');

    await act(async () => {
      await system.resourceSystem.writeContent(tableDataPath('t'), JSON.stringify({ name: 'draft' }));
    });

    fs.seed(tableDataPath('t'), JSON.stringify({ name: 'external' }));
    await dispatchChange(system, panel, tableDataPath('t'));

    expect(await readData(system, tableDataPath('t'))).toEqual({ name: 'external' });
    expect(JSON.parse(panel['columns'][0].pendingConflict?.text ?? 'null')).toEqual({ name: 'external' });
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

  // 选「保存编辑器的」：立刻把编辑器内容写盘覆盖外部修改，待写与未保存标记一起消失，全程不推进定时器
  it('选「保存编辑器的」：磁盘立刻变成编辑器内容、待写清空、未保存标记消失', async () => {
    const fs = new FakeFileSystem();
    const { system, panel, container } = await openRenderedTable(fs);

    await commitText(container, 'name', '"draft"');

    fs.seed(tableDataPath('t'), JSON.stringify({ name: 'external' }));
    await dispatchChange(system, panel, tableDataPath('t'));

    expect(screen.queryByTestId('panel-conflict-dialog')).not.toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByTestId('panel-conflict-keep'));
    });
    await act(async () => {});

    expect(valueOf(container, 'name')).toBe('"draft"');
    expect(await readDisk(fs, tableDataPath('t'))).toEqual({ name: 'draft' });
    expect(system.resourceSystem.hasAnyPendingContent()).toBe(false);
    expect(inColumn(container, 0, 'table-unsaved')).toBeNull();
    expect(screen.queryByTestId('panel-conflict-dialog')).toBeNull();
  });

  // 保存后宿主回声被忽略：点保存 -> 显式写盘 -> 回送同内容变化，版本号与内容都不变、不弹框
  it('保存后宿主回声被忽略', async () => {
    const fs = new FakeFileSystem();
    const { system, panel, container } = await openRenderedTable(fs);

    await commitText(container, 'name', '"b"');

    await act(async () => {
      clickInColumn(container, 0, 'table-save');
    });
    await act(async () => {});

    // 保存只进缓冲，显式写盘之后回落的变化才算宿主回声
    await act(async () => {
      await system.resourceSystem.flushContent(tableDataPath('t'));
    });

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

  // 有待写时外部改文件：立刻记冲突并弹窗，但用户没表态之前一个字节都不写
  it('有待写时外部改文件：弹冲突、磁盘仍是外部内容、一个字节都没写', async () => {
    const fs = new FakeFileSystem();
    const { system, panel, container } = await openRenderedTable(fs);

    await commitText(container, 'name', '"draft"');

    fs.seed(tableDataPath('t'), JSON.stringify({ name: 'external' }));
    await dispatchChange(system, panel, tableDataPath('t'));

    expect(screen.queryByTestId('panel-conflict-dialog')).not.toBeNull();
    expect(await readDisk(fs, tableDataPath('t'))).toEqual({ name: 'external' });
    expect(system.resourceSystem.hasAnyPendingContent()).toBe(true);
    expect(inColumn(container, 0, 'table-unsaved')).not.toBeNull();
  });

  // 正在输入时不弹：焦点在可编辑字段里时冲突只记进栏状态，失焦那一刻才弹
  it('正在输入时不弹、失焦后立刻弹', async () => {
    const fs = new FakeFileSystem();
    const { system, panel, container } = await openRenderedTable(fs);

    await commitText(container, 'name', '"draft"');

    const cell = container.querySelector('[data-test-id="table-input-name"]');
    const textarea = cell === null ? null : cell.querySelector('textarea');

    if (!(textarea instanceof HTMLTextAreaElement)) throw new Error('字段文本域缺失');

    await act(async () => {
      fireEvent.focusIn(textarea);
    });

    fs.seed(tableDataPath('t'), JSON.stringify({ name: 'external' }));
    await dispatchChange(system, panel, tableDataPath('t'));

    expect(screen.queryByTestId('panel-conflict-dialog')).toBeNull();
    expect(panel['columns'][0].pendingConflict?.path).toBe(tableDataPath('t'));

    await act(async () => {
      fireEvent.focusOut(textarea);
    });
    await act(async () => {});

    expect(screen.queryByTestId('panel-conflict-dialog')).not.toBeNull();
  });

  // 选「保存外部修改」：丢弃本栏待写（同时失效内容缓存）后按外部原文换内容，磁盘一个字节都不动
  it('选「保存外部修改」：磁盘不变、待写清空、面板显示外部内容', async () => {
    const fs = new FakeFileSystem();
    const { system, panel, container } = await openRenderedTable(fs);

    await commitText(container, 'name', '"draft"');

    fs.seed(tableDataPath('t'), JSON.stringify({ name: 'external' }));
    await dispatchChange(system, panel, tableDataPath('t'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('panel-conflict-discard'));
    });
    await act(async () => {});

    expect(await readDisk(fs, tableDataPath('t'))).toEqual({ name: 'external' });
    expect(system.resourceSystem.hasAnyPendingContent()).toBe(false);
    expect(valueOf(container, 'name')).toBe('"external"');
    expect(screen.queryByTestId('panel-conflict-dialog')).toBeNull();
  });

  // 回车确认后立刻弹：数字框按回车提交后不失焦，也算「停手」，推迟必须由这次确认解除
  it('回车确认后立刻弹：数字框不失焦也解除推迟', async () => {
    const fs = new FakeFileSystem();
    const { system, panel, container } = await openRenderedTable(
      fs,
      { name: 'a', level: 1 },
      { type: 'object', properties: { name: { type: 'string' }, level: { type: 'number' } } },
    );

    const cell = container.querySelector('[data-test-id="table-input-level"]');
    const input = cell === null ? null : cell.querySelector('input');

    if (!(input instanceof HTMLInputElement)) throw new Error('数字输入框缺失');

    // 一、回车确认一次，先让本栏有内容进缓冲
    await act(async () => {
      fireEvent.focusIn(input);
      fireEvent.change(input, { target: { value: '2' } });
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    await act(async () => {});

    expect(system.resourceSystem.hasAnyPendingContent()).toBe(true);

    // 二、再点回字段并改值：这次只改不提交，焦点仍在输入框里
    await act(async () => {
      fireEvent.focusIn(input);
      fireEvent.change(input, { target: { value: '3' } });
    });

    // 三、外部改文件：冲突只记进栏状态，弹窗推迟
    fs.seed(tableDataPath('t'), JSON.stringify({ name: 'external', level: 9 }));
    await dispatchChange(system, panel, tableDataPath('t'));

    expect(screen.queryByTestId('panel-conflict-dialog')).toBeNull();
    expect(panel['columns'][0].pendingConflict?.path).toBe(tableDataPath('t'));

    // 四、只按回车、不移动焦点：这一次确认提交就是「停手」，弹窗立刻出现
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    await act(async () => {});

    expect(screen.queryByTestId('panel-conflict-dialog')).not.toBeNull();
  });

  // 「保存编辑器的」写盘失败：确定性结算，待写与弹窗都保留、磁盘仍是外部内容，点击处理器不抛异常
  it('「保存编辑器的」写盘失败：待写保留、弹窗不关、磁盘仍是外部内容', async () => {
    const fs = new FakeFileSystem();
    const { system, panel, container } = await openRenderedTable(fs);

    await commitText(container, 'name', '"draft"');

    fs.seed(tableDataPath('t'), JSON.stringify({ name: 'external' }));
    await dispatchChange(system, panel, tableDataPath('t'));

    // 只让这一次落盘失败，读取仍然正常，否则裸磁盘断言会被连带的读失败污染
    vi.spyOn(fs, 'writeFile').mockRejectedValueOnce(new Error('write failed'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('panel-conflict-keep'));
    });
    await act(async () => {});

    expect(screen.queryByTestId('panel-conflict-dialog')).not.toBeNull();
    expect(await readDisk(fs, tableDataPath('t'))).toEqual({ name: 'external' });
    expect(system.resourceSystem.hasAnyPendingContent()).toBe(true);
    expect(inColumn(container, 0, 'table-unsaved')).not.toBeNull();
  });

  // 冲突未表态时窗口失焦不写盘；末尾用「保存编辑器的」做反向对照，并证明未编辑的 schema 路径逐字未变
  it('冲突未表态时窗口失焦不写盘，「保存编辑器的」才写出草稿', async () => {
    const fs = new FakeFileSystem();
    const { system, panel, container } = await openRenderedTable(fs);

    const schemaSeedText = await fs.readFile(tableSchemaPath('t'));

    await commitText(container, 'name', '"draft"');

    fs.seed(tableDataPath('t'), JSON.stringify({ name: 'external' }));
    await dispatchChange(system, panel, tableDataPath('t'));

    expect(screen.queryByTestId('panel-conflict-dialog')).not.toBeNull();

    // 窗口失焦会发起一次全量写盘；被标记的条目必须被跳过，等一个宏任务让写盘链结算
    await act(async () => {
      window.dispatchEvent(new Event('blur'));
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });

    expect(await readDisk(fs, tableDataPath('t'))).toEqual({ name: 'external' });
    expect(system.resourceSystem.hasAnyPendingContent()).toBe(true);
    expect(panel['columns'][0].pendingConflict?.path).toBe(tableDataPath('t'));
    expect(screen.queryByTestId('panel-conflict-dialog')).not.toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByTestId('panel-conflict-keep'));
    });
    await act(async () => {});

    expect(await readDisk(fs, tableDataPath('t'))).toEqual({ name: 'draft' });
    expect(system.resourceSystem.hasAnyPendingContent()).toBe(false);
    expect(screen.queryByTestId('panel-conflict-dialog')).toBeNull();
    // 这条路径从未被编辑：结算不得顺带 persist / flush 它
    expect(await fs.readFile(tableSchemaPath('t'))).toBe(schemaSeedText);
  });

  // 冲突未表态时切标签往返：切回后草稿不变、弹窗还在，「保存编辑器的」写的是草稿；未编辑的 schema 路径逐字未变
  it('冲突未表态时切标签往返不重读磁盘，草稿与弹窗都保留', async () => {
    const fs = new FakeFileSystem();
    const { system, panel, container } = await openRenderedTable(fs);

    const schemaSeedText = await fs.readFile(tableSchemaPath('t'));

    await commitText(container, 'name', '"draft"');

    fs.seed(tableDataPath('t'), JSON.stringify({ name: 'external' }));
    await dispatchChange(system, panel, tableDataPath('t'));

    // 外壳只渲染活动面板：切到空白标签期间表格面板与其弹窗一起卸载，因此这时只断言磁盘、待写与栏状态
    const originalTabId = system.shellSystem.listTabs()[0].id;
    const blankTabId = system.shellSystem.openBlankTab();

    await act(async () => {
      await system.shellSystem.activateTab(blankTabId);
    });

    expect(await readDisk(fs, tableDataPath('t'))).toEqual({ name: 'external' });
    expect(system.resourceSystem.hasAnyPendingContent()).toBe(true);
    expect(panel['columns'][0].pendingConflict?.path).toBe(tableDataPath('t'));

    // 切回原标签：刷新若不看待决冲突 / 待写，就会把磁盘上的外部内容重读进来，草稿被换掉
    await act(async () => {
      await system.shellSystem.activateTab(originalTabId);
    });
    await act(async () => {});

    expect(screen.queryByTestId('panel-conflict-dialog')).not.toBeNull();
    expect(panel['columns'][0].pendingConflict?.path).toBe(tableDataPath('t'));
    expect(valueOf(container, 'name')).toBe('"draft"');

    await act(async () => {
      fireEvent.click(screen.getByTestId('panel-conflict-keep'));
    });
    await act(async () => {});

    expect(await readDisk(fs, tableDataPath('t'))).toEqual({ name: 'draft' });
    expect(system.resourceSystem.hasAnyPendingContent()).toBe(false);
    expect(screen.queryByTestId('panel-conflict-dialog')).toBeNull();
    expect(await fs.readFile(tableSchemaPath('t'))).toBe(schemaSeedText);
  });

  // 冲突未表态时 pagehide 不写盘：磁盘、待写、pendingConflict、弹窗四项都不变
  it('冲突未表态时 pagehide 不写盘', async () => {
    const fs = new FakeFileSystem();
    const { system, panel, container } = await openRenderedTable(fs);

    await commitText(container, 'name', '"draft"');

    fs.seed(tableDataPath('t'), JSON.stringify({ name: 'external' }));
    await dispatchChange(system, panel, tableDataPath('t'));

    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });

    expect(await readDisk(fs, tableDataPath('t'))).toEqual({ name: 'external' });
    expect(system.resourceSystem.hasAnyPendingContent()).toBe(true);
    expect(panel['columns'][0].pendingConflict?.path).toBe(tableDataPath('t'));
    expect(screen.queryByTestId('panel-conflict-dialog')).not.toBeNull();
  });

  // 冲突未表态时确认编辑不会清掉标记：写缓冲不被重排，资源层仍读外部内容，弹窗照常出现
  it('冲突未表态时确认编辑不会清掉标记', async () => {
    const fs = new FakeFileSystem();
    const { system, panel, container } = await openRenderedTable(
      fs,
      { name: 'a', level: 1 },
      { type: 'object', properties: { name: { type: 'string' }, level: { type: 'number' } } },
    );

    const cell = container.querySelector('[data-test-id="table-input-level"]');
    const input = cell === null ? null : cell.querySelector('input');

    if (!(input instanceof HTMLInputElement)) throw new Error('数字输入框缺失');

    // 一、回车确认一次，先让本栏有内容进缓冲
    await act(async () => {
      fireEvent.focusIn(input);
      fireEvent.change(input, { target: { value: '2' } });
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    await act(async () => {});

    // 二、再聚焦并改值，这次只改不提交，焦点仍在输入框里
    await act(async () => {
      fireEvent.focusIn(input);
      fireEvent.change(input, { target: { value: '3' } });
    });

    // 三、外部改文件：正在输入时只记录冲突、不弹窗
    fs.seed(tableDataPath('t'), JSON.stringify({ name: 'external', level: 9 }));
    await dispatchChange(system, panel, tableDataPath('t'));

    expect(screen.queryByTestId('panel-conflict-dialog')).toBeNull();
    expect(panel['columns'][0].pendingConflict?.path).toBe(tableDataPath('t'));

    // 四、回车确认一次：必须被入口守卫挡住，不得经 `WriteBuffer.schedule` 清掉「外部已改」标记
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    await act(async () => {});

    expect(await readData(system, tableDataPath('t'))).toEqual({ name: 'external', level: 9 });
    expect(system.resourceSystem.hasAnyPendingContent()).toBe(true);
    expect(screen.queryByTestId('panel-conflict-dialog')).not.toBeNull();
  });

  // 撤销不替用户结算冲突：推进 5 000 毫秒后磁盘仍是外部内容、该路径仍在待写
  it('撤销不替用户结算冲突，推进 5 000 毫秒后磁盘仍是外部内容', async () => {
    const fs = new FakeFileSystem();
    const { system, panel, container } = await openRenderedTable(fs);

    await commitText(container, 'name', '"draft"');

    fs.seed(tableDataPath('t'), JSON.stringify({ name: 'external' }));
    await dispatchChange(system, panel, tableDataPath('t'));

    expect(screen.queryByTestId('panel-conflict-dialog')).not.toBeNull();

    vi.useFakeTimers();

    // 撤销走安静保存：入口守卫若只看非安静分支，这里会 persist 并重排 5 秒定时器，到点写出草稿
    await act(async () => {
      await system.undoSystem.undo();
    });
    await act(async () => {});

    expect(await readDisk(fs, tableDataPath('t'))).toEqual({ name: 'external' });
    expect(system.resourceSystem.listPendingPaths()).toContain(tableDataPath('t'));
    expect(panel['columns'][0].pendingConflict?.path).toBe(tableDataPath('t'));
    expect(screen.queryByTestId('panel-conflict-dialog')).not.toBeNull();

    await advance(5000);

    expect(await readDisk(fs, tableDataPath('t'))).toEqual({ name: 'external' });
    expect(system.resourceSystem.listPendingPaths()).toContain(tableDataPath('t'));
  });

  // 一栏两条路径同时冲突：一次「保存编辑器的」把数据与 schema 都写盘、待写清空
  it('两条路径同时冲突时一次「保存编辑器的」把两条都结算', async () => {
    const fs = new FakeFileSystem();
    const { system, panel } = await openRenderedTable(fs);

    await switchMode('添加');
    await addFieldByBlur('name', 'added');

    // 新增字段会让数据与镜像 schema 同时进入待写（字段确认的自动保存随后把两个脏标志清零）
    expect(system.resourceSystem.listPendingPaths()).toEqual(
      expect.arrayContaining([tableDataPath('t'), tableSchemaPath('t')]),
    );

    const draft = panel['columns'][0].draft;
    const editorData = draft === null ? undefined : draft.data;
    const editorSchema = draft === null ? undefined : draft.schema;

    fs.seed(tableDataPath('t'), JSON.stringify({ name: 'external' }));
    fs.seed(tableSchemaPath('t'), JSON.stringify({ type: 'object', properties: { name: { type: 'string' } } }));

    await dispatchChange(system, panel, tableDataPath('t'));
    await dispatchChange(system, panel, tableSchemaPath('t'));

    expect(screen.queryByTestId('panel-conflict-dialog')).not.toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByTestId('panel-conflict-keep'));
    });
    await act(async () => {});

    expect(await readDisk(fs, tableDataPath('t'))).toEqual(editorData);
    expect(await readDisk(fs, tableSchemaPath('t'))).toEqual(editorSchema);
    expect(system.resourceSystem.hasAnyPendingContent()).toBe(false);
    expect(screen.queryByTestId('panel-conflict-dialog')).toBeNull();
  });

  // 一栏两条路径同时冲突：一次「保存外部修改」把两条都丢弃，两条裸磁盘都没被改
  it('两条路径同时冲突时一次「保存外部修改」把两条都丢弃', async () => {
    const fs = new FakeFileSystem();
    const { system, panel, container } = await openRenderedTable(fs);

    await switchMode('添加');
    await addFieldByBlur('name', 'added');

    const externalDataText = JSON.stringify({ name: 'external' });
    const externalSchemaText = JSON.stringify({ type: 'object', properties: { name: { type: 'string' } } });

    fs.seed(tableDataPath('t'), externalDataText);
    fs.seed(tableSchemaPath('t'), externalSchemaText);

    await dispatchChange(system, panel, tableDataPath('t'));
    await dispatchChange(system, panel, tableSchemaPath('t'));

    expect(screen.queryByTestId('panel-conflict-dialog')).not.toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByTestId('panel-conflict-discard'));
    });
    await act(async () => {});

    expect(await fs.readFile(tableDataPath('t'))).toBe(externalDataText);
    expect(await fs.readFile(tableSchemaPath('t'))).toBe(externalSchemaText);
    expect(system.resourceSystem.hasAnyPendingContent()).toBe(false);
    expect(valueOf(container, 'name')).toBe('"external"');
    expect(screen.queryByTestId('panel-conflict-dialog')).toBeNull();
  });
});
