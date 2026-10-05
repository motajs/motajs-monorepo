import { IUndoContext, IUndoInjection, IUndoSystem, IUndoable } from './types';

// 撤销历史里的一条记录，保存可撤回对象与撤回上下文
interface UndoEntry {
  readonly undo: IUndoable;
  readonly context: IUndoContext<unknown>;
}

export class UndoSystem implements IUndoSystem {
  maxUndoStep = 0;

  private readonly undoStack: UndoEntry[] = [];

  private readonly redoStack: UndoEntry[] = [];

  async initialize(injection: IUndoInjection): Promise<void> {
    this.maxUndoStep = injection.maxUndoStep;
  }

  addUndoContext(undo: IUndoable, context: IUndoContext<unknown>): void {
    this.undoStack.push({ undo, context });

    if (this.maxUndoStep > 0 && this.undoStack.length > this.maxUndoStep) {
      this.undoStack.shift();
    }

    this.redoStack.length = 0;
  }

  async undo(): Promise<void> {
    const entry = this.undoStack.pop();

    if (!entry) return;

    await entry.undo.undo(entry.context);

    this.redoStack.push(entry);
  }

  async redo(): Promise<void> {
    const entry = this.redoStack.pop();

    if (!entry) return;

    await entry.undo.redo(entry.context);

    this.undoStack.push(entry);
  }

  async dispose(): Promise<void> {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}
