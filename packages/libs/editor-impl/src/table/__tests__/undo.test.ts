import { EditorCore, IEditorPanel, IEditorPanelFactoryParam } from '@motajs/editor-core';
import { describe, expect, it } from 'vitest';
import { deriveSchemaPath, tablePanelType, TablePanel } from '..';
import { createTableHarness, FakeFileSystem } from './fixtures';

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

// 把面板目标指向给定表名，并等待一次切入刷新完成
async function setTarget(panel: TablePanel, name: string): Promise<void> {
  panel.setTable({ dataPath: tableDataPath(name) });
  await panel.onSwitchIn();
}

// 读取目标表的当前数据内容（面板以文本写回，读取后解析）
async function readData(system: EditorCore, name: string): Promise<unknown> {
  const text = await system.resourceSystem.readContent(tableDataPath(name));

  if (typeof text !== 'string') return undefined;

  return JSON.parse(text);
}

// 一张带单个字符串字段、顶层可新增的样例表
function stringTable(): { readonly data: unknown; readonly schema: unknown } {
  return {
    data: { name: 'a' },
    schema: { type: 'object', properties: { name: { type: 'string' } } },
  };
}

describe('表格统一撤销路径', () => {
  // 一次编辑写入资源并记录一步撤销，撤销与重做分别还原旧值与新值
  it('一次编辑是一步撤销，撤销还原旧值、重做恢复新值', async () => {
    const fs = new FakeFileSystem();
    const sample = stringTable();

    seed(fs, 't', sample.data, sample.schema);
    const system = await createTableHarness(fs, 100);
    const panel = await openPanel(system);
    await setTarget(panel, 't');

    await panel.commitValue("['name']", 'b');
    expect(await readData(system, 't')).toEqual({ name: 'b' });

    await system.undoSystem.undo();
    expect(await readData(system, 't')).toEqual({ name: 'a' });

    await system.undoSystem.redo();
    expect(await readData(system, 't')).toEqual({ name: 'b' });
  });

  // 撤销后再次撤回为空操作，证明一次编辑恰好只产生一步撤销
  it('一次编辑恰好一步：撤销后再次撤回为空操作', async () => {
    const fs = new FakeFileSystem();
    const sample = stringTable();

    seed(fs, 't', sample.data, sample.schema);
    const system = await createTableHarness(fs, 100);
    const panel = await openPanel(system);
    await setTarget(panel, 't');

    await panel.commitValue("['name']", 'b');
    await system.undoSystem.undo();
    await system.undoSystem.undo();

    expect(await readData(system, 't')).toEqual({ name: 'a' });
  });

  // 撤销后新的编辑会清空重做路径，其后的重做为空操作
  it('撤销后新编辑清空重做路径', async () => {
    const fs = new FakeFileSystem();
    const sample = stringTable();

    seed(fs, 't', sample.data, sample.schema);
    const system = await createTableHarness(fs, 100);
    const panel = await openPanel(system);
    await setTarget(panel, 't');

    await panel.commitValue("['name']", 'b');
    await system.undoSystem.undo();
    await panel.commitValue("['name']", 'c');
    await system.undoSystem.redo();

    expect(await readData(system, 't')).toEqual({ name: 'c' });
  });

  // 新增一项可撤销：撤销移除新增字段，重做把它加回
  it('新增是一项可撤销操作', async () => {
    const fs = new FakeFileSystem();
    const sample = stringTable();

    seed(fs, 't', sample.data, sample.schema);
    const system = await createTableHarness(fs, 100);
    const panel = await openPanel(system);
    await setTarget(panel, 't');

    await panel.addItem('', 'extra');
    expect(await readData(system, 't')).toEqual({ name: 'a', extra: null });

    await system.undoSystem.undo();
    expect(await readData(system, 't')).toEqual({ name: 'a' });

    await system.undoSystem.redo();
    expect(await readData(system, 't')).toEqual({ name: 'a', extra: null });
  });

  // 删除一项可撤销：撤销恢复字段与旧值，重做再次删除
  it('删除是一项可撤销操作', async () => {
    const fs = new FakeFileSystem();
    const sample = stringTable();

    seed(fs, 't', { name: 'a', extra: 'x' }, sample.schema);
    const system = await createTableHarness(fs, 100);
    const panel = await openPanel(system);
    await setTarget(panel, 't');

    await panel.deleteItem("['extra']");
    expect(await readData(system, 't')).toEqual({ name: 'a' });

    await system.undoSystem.undo();
    expect(await readData(system, 't')).toEqual({ name: 'a', extra: 'x' });

    await system.undoSystem.redo();
    expect(await readData(system, 't')).toEqual({ name: 'a' });
  });

  // 新增名为原型污染键时拒绝写入，数据保持不变、不产生 __proto__ 自有属性
  it('新增原型污染键时拒绝写入', async () => {
    const fs = new FakeFileSystem();
    const sample = stringTable();

    seed(fs, 't', sample.data, sample.schema);
    const system = await createTableHarness(fs, 100);
    const panel = await openPanel(system);
    await setTarget(panel, 't');

    await panel.addItem('', '__proto__');

    const data = await readData(system, 't');

    expect(data).toEqual({ name: 'a' });
    expect(Object.prototype.hasOwnProperty.call(data, '__proto__')).toBe(false);
  });

  // maxUndoStep 为 0 时禁用撤销，但写入依然发生
  it('maxUndoStep 为 0 时不记录撤销但仍写入', async () => {
    const fs = new FakeFileSystem();
    const sample = stringTable();

    seed(fs, 't', sample.data, sample.schema);
    const system = await createTableHarness(fs, 0);
    const panel = await openPanel(system);
    await setTarget(panel, 't');

    await panel.commitValue("['name']", 'b');
    await system.undoSystem.undo();

    expect(await readData(system, 't')).toEqual({ name: 'b' });
  });
});
