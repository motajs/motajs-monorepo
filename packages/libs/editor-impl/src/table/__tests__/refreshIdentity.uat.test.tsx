import { act, cleanup, configure, render } from '@testing-library/react';
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

// 把面板目标指向给定表名，并等待一次切入刷新完成
async function setTarget(panel: TablePanel, name: string): Promise<void> {
  panel.setTable({ dataPath: tableDataPath(name) });
  await panel.onSwitchIn();
}

// 读取某个字段值单元格内文本域的当前文本
function valueOf(container: HTMLElement, field: string): string | undefined {
  const cell = container.querySelector(`[data-test-id="table-input-${field}"]`);
  const textarea = cell === null ? null : cell.querySelector('textarea');

  return textarea === null ? undefined : textarea.value;
}

describe('刷新原地更新、不再整树重挂（P26）', () => {
  // 同一内容刷新后行 DOM 节点身份保持不变（修复前每次刷新都切加载态，此用例必然失败）
  it('同一内容刷新后行 DOM 节点身份不变', async () => {
    const fs = new FakeFileSystem();

    seed(fs, 't', { name: 'hello' }, { type: 'object', properties: { name: { type: 'string' } } });
    const system = await createTableHarness(fs);
    const panels: TablePanel[] = [];
    const panel = await openTablePanel(system, panels);

    await setTarget(panel, 't');

    const { container } = render(createElement(system.shellSystem.render()));
    const first = container.querySelector('[data-test-id="table-row-name"]');

    expect(first).not.toBeNull();

    await act(async () => {
      await panel.onSwitchIn();
    });

    expect(container.querySelector('[data-test-id="table-row-name"]')).toBe(first);
  });

  // 同一内容刷新后值单元格内输入控件的 DOM 节点身份不变（记忆化命中，整表重渲染被跳过）
  it('同一内容刷新后输入控件身份不变', async () => {
    const fs = new FakeFileSystem();

    seed(fs, 't', { name: 'hello' }, { type: 'object', properties: { name: { type: 'string' } } });
    const system = await createTableHarness(fs);
    const panels: TablePanel[] = [];
    const panel = await openTablePanel(system, panels);

    await setTarget(panel, 't');

    const { container } = render(createElement(system.shellSystem.render()));
    const first = container.querySelector('[data-test-id="table-input-name"] textarea');

    expect(first).not.toBeNull();

    await act(async () => {
      await panel.onSwitchIn();
    });

    expect(container.querySelector('[data-test-id="table-input-name"] textarea')).toBe(first);
  });

  // 对某字段写盘后刷新，其余未变更字段的行 DOM 节点身份保持不变
  it('未受影响的行刷新后不重挂', async () => {
    const fs = new FakeFileSystem();

    seed(
      fs,
      't',
      { a: 'x', b: 'y' },
      { type: 'object', properties: { a: { type: 'string' }, b: { type: 'string' } } },
    );
    const system = await createTableHarness(fs);
    const panels: TablePanel[] = [];
    const panel = await openTablePanel(system, panels);

    await setTarget(panel, 't');

    const { container } = render(createElement(system.shellSystem.render()));
    const rowA = container.querySelector('[data-test-id="table-row-a"]');
    const rowB = container.querySelector('[data-test-id="table-row-b"]');

    expect(rowA).not.toBeNull();
    expect(rowB).not.toBeNull();

    await act(async () => {
      await system.resourceSystem.writeContent(tableDataPath('t'), JSON.stringify({ a: 'z', b: 'y' }));
      await panel.onSwitchIn();
    });

    expect(valueOf(container, 'a')).toBe('"z"');
    expect(container.querySelector('[data-test-id="table-row-b"]')).toBe(rowB);
  });

  // 内容真的变了时行树仍正确更新（写盘产生新对象后读到新值，不与同内容用例冲突）
  it('内容变更后刷新仍更新为新值', async () => {
    const fs = new FakeFileSystem();

    seed(fs, 't', { name: 'a' }, { type: 'object', properties: { name: { type: 'string' } } });
    const system = await createTableHarness(fs);
    const panels: TablePanel[] = [];
    const panel = await openTablePanel(system, panels);

    await setTarget(panel, 't');

    const { container } = render(createElement(system.shellSystem.render()));

    expect(valueOf(container, 'name')).toBe('"a"');

    await act(async () => {
      await system.resourceSystem.writeContent(tableDataPath('t'), JSON.stringify({ name: 'c' }));
      await panel.onSwitchIn();
    });

    expect(valueOf(container, 'name')).toBe('"c"');
  });

  // 首载资源尚未返回时仍显示加载态，守住既有加载态语义
  it('首载资源未返回时仍显示加载态', async () => {
    const fs = new FakeFileSystem();

    seed(fs, 'slow', { name: 'hello' }, { type: 'object', properties: { name: { type: 'string' } } });
    fs.hanging.add(tableDataPath('slow'));
    const system = await createTableHarness(fs);
    const panels: TablePanel[] = [];
    const panel = await openTablePanel(system, panels);

    await act(async () => {
      panel.setTable({ dataPath: tableDataPath('slow') });
    });

    const { container } = render(createElement(system.shellSystem.render()));

    expect(container.textContent).toContain('正在加载表格…');
  });
});
