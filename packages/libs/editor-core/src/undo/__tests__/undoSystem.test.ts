import { describe, expect, test } from 'vitest';
import { IUndoContext, IUndoable } from '../types';
import { UndoSystem } from '../undoSystem';

class FakeUndoable implements IUndoable {
  undoCount = 0;

  redoCount = 0;

  lastUndoContext?: IUndoContext<unknown>;

  lastRedoContext?: IUndoContext<unknown>;

  async undo<T>(context: IUndoContext<T>): Promise<void> {
    this.undoCount += 1;
    this.lastUndoContext = context;
  }

  async redo<T>(context: IUndoContext<T>): Promise<void> {
    this.redoCount += 1;
    this.lastRedoContext = context;
  }
}

describe('UndoSystem 最小闭环', () => {
  // 入栈后调用 undo，记录对象的 undo 以同一 context 被调用一次
  test('undo 以同一 context 调用记录对象的 undo', async () => {
    const system = new UndoSystem();
    await system.initialize({ maxUndoStep: 10 });
    const undoable = new FakeUndoable();
    const context: IUndoContext<unknown> = { type: 1, data: 'alpha' };

    system.addUndoContext(undoable, context);
    await system.undo();

    expect(undoable.undoCount).toBe(1);
    expect(undoable.lastUndoContext).toBe(context);
  });

  // 调用 redo，记录对象的 redo 以同一 context 被调用一次
  test('redo 以同一 context 调用记录对象的 redo', async () => {
    const system = new UndoSystem();
    await system.initialize({ maxUndoStep: 10 });
    const undoable = new FakeUndoable();
    const context: IUndoContext<unknown> = { type: 1, data: 'beta' };

    system.addUndoContext(undoable, context);
    await system.undo();
    await system.redo();

    expect(undoable.redoCount).toBe(1);
    expect(undoable.lastRedoContext).toBe(context);
  });
});

describe('UndoSystem 边界', () => {
  // 超过 maxUndoStep 时从栈底裁剪，最早一条被丢弃，仅保留最近 maxUndoStep 条
  test('超出 maxUndoStep 时从栈底裁剪最早记录', async () => {
    const system = new UndoSystem();
    await system.initialize({ maxUndoStep: 2 });
    const first = new FakeUndoable();
    const second = new FakeUndoable();
    const third = new FakeUndoable();

    system.addUndoContext(first, { type: 1, data: 'first' });
    system.addUndoContext(second, { type: 1, data: 'second' });
    system.addUndoContext(third, { type: 1, data: 'third' });

    await system.undo();
    await system.undo();

    expect(third.undoCount).toBe(1);
    expect(second.undoCount).toBe(1);
    expect(first.undoCount).toBe(0);
  });

  // 新操作入栈后 redo 栈被清空，随后的 redo 为空操作
  test('新操作入栈后清空 redo 栈', async () => {
    const system = new UndoSystem();
    await system.initialize({ maxUndoStep: 10 });
    const first = new FakeUndoable();
    const second = new FakeUndoable();

    system.addUndoContext(first, { type: 1, data: 'first' });
    await system.undo();
    system.addUndoContext(second, { type: 1, data: 'second' });

    await system.redo();

    expect(first.redoCount).toBe(0);
    expect(second.redoCount).toBe(0);
  });

  // 空栈 undo/redo 不抛错且不调用任何记录对象
  test('空栈 undo/redo 为空操作', async () => {
    const system = new UndoSystem();
    const undoable = new FakeUndoable();

    await expect(system.undo()).resolves.toBeUndefined();
    await expect(system.redo()).resolves.toBeUndefined();

    expect(undoable.undoCount).toBe(0);
    expect(undoable.redoCount).toBe(0);
  });

  // dispose 后两栈清空，undo/redo 均为空操作
  test('dispose 清空两栈', async () => {
    const system = new UndoSystem();
    await system.initialize({ maxUndoStep: 10 });
    const undoable = new FakeUndoable();

    system.addUndoContext(undoable, { type: 1, data: 'alpha' });
    system.dispose();

    await system.undo();
    await system.redo();

    expect(undoable.undoCount).toBe(0);
    expect(undoable.redoCount).toBe(0);
  });
});
