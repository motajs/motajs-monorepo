import { IUndoContext, IUndoInjection, IUndoSystem, IUndoable } from './types';

interface UndoEntry {
  /** 可撤回对象 */
  readonly undo: IUndoable;
  /** 撤回上下文 */
  readonly context: IUndoContext<unknown>;
}

export class UndoSystem implements IUndoSystem {
  maxUndoStep: number = 0;

  /** 撤销历史栈 */
  private readonly undoStack: UndoEntry[] = [];

  /** 重做历史栈 */
  private readonly redoStack: UndoEntry[] = [];

  async initialize(injection: IUndoInjection): Promise<void> {
    this.maxUndoStep = injection.maxUndoStep;
  }

  addUndoContext(undo: IUndoable, context: IUndoContext<unknown>): void {
    if (this.maxUndoStep <= 0) return;

    this.undoStack.push({ undo, context });

    if (this.undoStack.length > this.maxUndoStep) {
      this.undoStack.shift();
    }

    this.redoStack.length = 0;
  }

  async undo(): Promise<void> {
    const entry = this.undoStack[this.undoStack.length - 1];

    if (!entry) return;

    await entry.undo.undo(entry.context);

    this.undoStack.pop();
    this.redoStack.push(entry);
  }

  async redo(): Promise<void> {
    const entry = this.redoStack[this.redoStack.length - 1];

    if (!entry) return;

    await entry.undo.redo(entry.context);

    this.redoStack.pop();
    this.undoStack.push(entry);
  }

  async dispose(): Promise<void> {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}
