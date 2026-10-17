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

// 首次调用可失败的撤回对象，用于验证失败后历史不丢失、可重试
class FlakyUndoable implements IUndoable {
  undoCount = 0;

  redoCount = 0;

  failUndoOnce = false;

  failRedoOnce = false;

  async undo<T>(context: IUndoContext<T>): Promise<void> {
    this.undoCount += 1;

    if (this.failUndoOnce) {
      this.failUndoOnce = false;
      throw new Error('undo failed');
    }
  }

  async redo<T>(context: IUndoContext<T>): Promise<void> {
    this.redoCount += 1;

    if (this.failRedoOnce) {
      this.failRedoOnce = false;
      throw new Error('redo failed');
    }
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

    await expect(system.undo()).resolves.toBe(false);
    await expect(system.redo()).resolves.toBe(false);

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

describe('UndoSystem 撤回失败可重试', () => {
  // undo 首次失败时条目仍留在撤销栈，第二次成功后才迁入重做栈，随后 redo 可用
  test('undo 首次失败不丢历史，成功后才迁入重做栈', async () => {
    const system = new UndoSystem();
    await system.initialize({ maxUndoStep: 10 });
    const undoable = new FlakyUndoable();
    undoable.failUndoOnce = true;
    const context: IUndoContext<unknown> = { type: 1, data: 'alpha' };

    system.addUndoContext(undoable, context);

    await expect(system.undo()).rejects.toThrow('undo failed');
    expect(undoable.undoCount).toBe(1);

    await system.undo();
    expect(undoable.undoCount).toBe(2);

    await system.redo();
    expect(undoable.redoCount).toBe(1);
  });

  // redo 首次失败时条目仍留在重做栈，第二次成功后才迁回撤销栈，随后 undo 可用
  test('redo 首次失败不丢历史，成功后才迁回撤销栈', async () => {
    const system = new UndoSystem();
    await system.initialize({ maxUndoStep: 10 });
    const undoable = new FlakyUndoable();
    const context: IUndoContext<unknown> = { type: 1, data: 'beta' };

    system.addUndoContext(undoable, context);
    await system.undo();

    undoable.failRedoOnce = true;

    await expect(system.redo()).rejects.toThrow('redo failed');
    expect(undoable.redoCount).toBe(1);

    await system.redo();
    expect(undoable.redoCount).toBe(2);

    await system.undo();
    expect(undoable.undoCount).toBe(2);
  });
});

describe('UndoSystem 禁用撤销', () => {
  // maxUndoStep 为 0 表示禁用撤销，addUndoContext 不记录历史、undo 为空操作
  test('maxUndoStep 为 0 时禁用撤销', async () => {
    const system = new UndoSystem();
    await system.initialize({ maxUndoStep: 0 });
    const undoable = new FakeUndoable();

    system.addUndoContext(undoable, { type: 1, data: 'alpha' });
    await system.undo();

    expect(undoable.undoCount).toBe(0);
  });

  // maxUndoStep 为负数同样表示禁用撤销
  test('maxUndoStep 为负数时禁用撤销', async () => {
    const system = new UndoSystem();
    await system.initialize({ maxUndoStep: -1 });
    const undoable = new FakeUndoable();

    system.addUndoContext(undoable, { type: 1, data: 'alpha' });
    await system.undo();

    expect(undoable.undoCount).toBe(0);
  });
});
