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
