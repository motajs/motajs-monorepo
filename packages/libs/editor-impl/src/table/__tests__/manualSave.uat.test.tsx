import { act, cleanup, configure, fireEvent, render, screen } from '@testing-library/react';
import { EditorCore, IEditorPanel, IEditorPanelFactoryParam } from '@motajs/editor-core';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deriveSchemaPath, TablePanel, tablePanelType } from '..';
import { CapabilityProvider, ITableEditorCapabilities } from '../../react';
import { createTableHarness, FakeFileSystem } from './fixtures';

configure({ testIdAttribute: 'data-test-id' });

// 每个用例结束后卸载已挂载组件并还原被替换的实现，避免 DOM 与替身在用例之间累积
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// 数据文件路径（`xxx.json`）
function tableDataPath(name: string): string {
  return `${name}.json`;
}

// schema 文件路径（按 `xxx.schema.json` 约定推导）
function tableSchemaPath(name: string): string {
  return deriveSchemaPath(tableDataPath(name));
}

// 注册一个捕获实例的表格面板类型，在首个标签页打开未设目标面板并返回实例
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
function valueOf(container: HTMLElement, field: string): string | undefined {
  const cell = container.querySelector(`[data-test-id="table-input-${field}"]`);
  const textarea = cell === null ? null : cell.querySelector('textarea');

  return textarea === null ? undefined : textarea.value;
}

// 在字段值文本域中输入文本并提交（失焦）
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

// 用能力 Provider 包裹外壳渲染根（打开列表实时同步用例可注入预设等能力）
function renderWithCapabilities(system: EditorCore, capabilities: ITableEditorCapabilities): ReturnType<typeof render> {
  return render(
    createElement(CapabilityProvider, {
      capabilities,
      children: createElement(system.shellSystem.render()),
    }),
  );
}

// 以文本预置一张表的数据与 schema
function seed(fs: FakeFileSystem, name: string, data: unknown, schema: unknown): void {
  fs.seed(tableDataPath(name), JSON.stringify(data));
  fs.seed(tableSchemaPath(name), JSON.stringify(schema));
}

describe('表格面板手动保存（G-02.1-3）', () => {
  // 行内改值只改内存不落盘：资源内容仍是旧值，本栏出现「未保存」标记且「保存」可点
  it('编辑只改内存并在本栏标记未保存、保存按钮可点', async () => {
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

    // 未点保存：资源内容仍是旧值
    expect(await readData(system, tableDataPath('hero'))).toEqual({ name: 'a' });
    // 本栏标记「未保存」，「保存」按钮可点
    expect(inColumn(container, 0, 'table-unsaved')).not.toBeNull();
    expect((inColumn(container, 0, 'table-save') as Element).hasAttribute('disabled')).toBe(false);
  });

  // 点「保存」才落盘：资源内容变为新值，「未保存」消失且保存按钮禁用
  it('点保存才写回资源并清未保存标记', async () => {
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

    await act(async () => {
      clickInColumn(container, 0, 'table-save');
    });
    await act(async () => {});

    expect(await readData(system, tableDataPath('hero'))).toEqual({ name: 'b' });
    expect(inColumn(container, 0, 'table-unsaved')).toBeNull();
    expect((inColumn(container, 0, 'table-save') as Element).hasAttribute('disabled')).toBe(true);
  });

  // 切出面板自动保存：改值不点保存，切出后资源内容已变为新值
  it('切出面板时自动保存已修改的栏', async () => {
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

    await act(async () => {
      await panel.onSwitchOut();
    });

    expect(await readData(system, tableDataPath('hero'))).toEqual({ name: 'b' });
  });
});

describe('注释剥离确认只提示一次（G-02.1-3）', () => {
  // 同一栏同一文件只提示一次；内容变化才重弹，原文未变不重弹
  it('同一文件只提示一次且内容变化才重弹', async () => {
    const fs = new FakeFileSystem();
    const first = '// 顶部注释\n{\n  "title": "hello",\n}\n';
    const second = '// 另一段注释\n{\n  "title": "world",\n}\n';
    const schema = { type: 'object', properties: { title: { type: 'string', description: '标题' } } };

    fs.seed('commented.jsonc', first);
    fs.seed(deriveSchemaPath('commented.jsonc'), JSON.stringify(schema));

    const system = await createTableHarness(fs);
    const created: TablePanel[] = [];
    const panel = await openTablePanel(system, created);

    panel.setTable({ dataPath: 'commented.jsonc' });

    await act(async () => {
      await panel.onSwitchIn();
    });

    const { container } = render(createElement(system.shellSystem.render()));

    // a) 首次切入弹出「删除注释」确认框
    expect(screen.queryByTestId('table-strip-confirm')).not.toBeNull();

    // b) 确认后再切一次（保存前）：不再弹框，内容已按剥离态呈现
    await act(async () => {
      fireEvent.click(screen.getByTestId('table-strip-confirm'));
    });
    await act(async () => {});

    expect(screen.queryByTestId('table-strip-confirm')).toBeNull();
    expect(valueOf(container, 'title')).toBe('"hello"');

    await act(async () => {
      await panel.onSwitchIn();
    });
    await act(async () => {});

    expect(screen.queryByTestId('table-strip-confirm')).toBeNull();

    // c) 先保存清掉未保存标记，再把文件外部改写为另一段非合规文本：重新弹框
    await act(async () => {
      await panel.save(0);
    });
    await act(async () => {
      await system.resourceSystem.writeContent('commented.jsonc', second);
    });
    await act(async () => {
      await panel.onSwitchIn();
    });
    await act(async () => {});

    expect(screen.queryByTestId('table-strip-confirm')).not.toBeNull();

    // d) 外部改写回原文并再次切入：原文未变（与确认时逐字相同）故不弹框，直接按剥离态打开
    await act(async () => {
      await system.resourceSystem.writeContent('commented.jsonc', first);
    });
    await act(async () => {
      await panel.onSwitchIn();
    });
    await act(async () => {});

    expect(screen.queryByTestId('table-strip-confirm')).toBeNull();
    expect(valueOf(container, 'title')).toBe('"hello"');
  });
});

describe('打开表格列表实时同步（G-02.1-3）', () => {
  // 资源更新通知到达时，处于打开态的栏立即重取目录、无需切出再切入
  it('打开态栏在资源更新通知后立即重取目录', async () => {
    const fs = new FakeFileSystem();
    const system = await createTableHarness(fs);
    const created: TablePanel[] = [];

    await openTablePanel(system, created);

    const { container } = renderWithCapabilities(system, {});

    await act(async () => {
      clickInColumn(container, 0, 'table-empty-open');
    });
    await act(async () => {});

    expect(inColumn(container, 0, 'table-list-entry-added.json')).toBeNull();

    // 外部新建数据文件：createResource 不广播，updateResource 才会通知面板
    await act(async () => {
      await system.resourceSystem.createResource('added.json', '{}');
      await system.resourceSystem.updateResource('added.json');
    });
    await act(async () => {});

    expect(inColumn(container, 0, 'table-list-entry-added.json')).not.toBeNull();
  });
});
