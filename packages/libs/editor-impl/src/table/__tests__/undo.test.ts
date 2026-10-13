import { IEditorPanel, IEditorPanelFactoryParam, ResourceSystem, ShellSystem, UndoSystem } from '@motajs/editor-core';
import { describe, expect, it } from 'vitest';
import { tableDataResourceId, tablePanelType, tableSchemaResourceId, TablePanel } from '..';
import { FakeResourceInjection } from './fixtures';

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

// 组装一套已初始化的外壳 / 资源 / 撤销系统与内存后端
async function createSystem(maxUndoStep: number): Promise<TestSystem> {
  const injection = new FakeResourceInjection();
  const resourceSystem = new ResourceSystem();
  await resourceSystem.initialize(injection);
  const undoSystem = new UndoSystem();
  await undoSystem.initialize({ maxUndoStep });
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

// 把面板目标指向给定表名，并等待一次切入刷新完成
async function setTarget(panel: TablePanel, name: string): Promise<void> {
  panel.setTable({ data: tableDataResourceId(name), schema: tableSchemaResourceId(name) });
  await panel.onSwitchIn();
}

// 读取目标表的当前数据内容
async function readData(system: TestSystem, name: string): Promise<unknown> {
  return system.resourceSystem.readContent(tableDataResourceId(name));
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
    const system = await createSystem(100);
    const sample = stringTable();

    seed(system, 't', sample.data, sample.schema);
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
    const system = await createSystem(100);
    const sample = stringTable();

    seed(system, 't', sample.data, sample.schema);
    const panel = await openPanel(system);
    await setTarget(panel, 't');

    await panel.commitValue("['name']", 'b');
    await system.undoSystem.undo();
    await system.undoSystem.undo();

    expect(await readData(system, 't')).toEqual({ name: 'a' });
  });

  // 撤销后新的编辑会清空重做路径，其后的重做为空操作
  it('撤销后新编辑清空重做路径', async () => {
    const system = await createSystem(100);
    const sample = stringTable();

    seed(system, 't', sample.data, sample.schema);
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
    const system = await createSystem(100);
    const sample = stringTable();

    seed(system, 't', sample.data, sample.schema);
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
    const system = await createSystem(100);
    const sample = stringTable();

    seed(system, 't', { name: 'a', extra: 'x' }, sample.schema);
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
    const system = await createSystem(100);
    const sample = stringTable();

    seed(system, 't', sample.data, sample.schema);
    const panel = await openPanel(system);
    await setTarget(panel, 't');

    await panel.addItem('', '__proto__');

    const data = await readData(system, 't');

    expect(data).toEqual({ name: 'a' });
    expect(Object.prototype.hasOwnProperty.call(data, '__proto__')).toBe(false);
  });

  // maxUndoStep 为 0 时禁用撤销，但写入依然发生
  it('maxUndoStep 为 0 时不记录撤销但仍写入', async () => {
    const system = await createSystem(0);
    const sample = stringTable();

    seed(system, 't', sample.data, sample.schema);
    const panel = await openPanel(system);
    await setTarget(panel, 't');

    await panel.commitValue("['name']", 'b');
    await system.undoSystem.undo();

    expect(await readData(system, 't')).toEqual({ name: 'b' });
  });
});
