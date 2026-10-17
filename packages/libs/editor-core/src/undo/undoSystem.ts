import { Hookable, HookController, IHookController } from '../hook';
import { IUndoContext, IUndoInjection, IUndoSystem, IUndoSystemHooks, IUndoable } from './types';

interface UndoEntry {
  /** 可撤回对象 */
  readonly undo: IUndoable;
  /** 撤回上下文 */
  readonly context: IUndoContext<unknown>;
}

export class UndoSystem extends Hookable<IUndoSystemHooks> implements IUndoSystem {
  maxUndoStep: number = 0;

  /** 撤销历史栈 */
  private readonly undoStack: UndoEntry[] = [];

  /** 重做历史栈 */
  private readonly redoStack: UndoEntry[] = [];

  protected createController(hook: Partial<IUndoSystemHooks>): IHookController<IUndoSystemHooks> {
    return new HookController(this, hook);
  }

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

  async undo(): Promise<boolean> {
    const entry = this.undoStack[this.undoStack.length - 1];

    if (!entry) return false;

    if (entry.context.barrier === true) {
      this.forEachHook((hook) => hook.onUndoBlocked?.());
      return false;
    }

    await entry.undo.undo(entry.context);

    this.undoStack.pop();
    this.redoStack.push(entry);
    return true;
  }

  async redo(): Promise<boolean> {
    const entry = this.redoStack[this.redoStack.length - 1];

    if (!entry) return false;

    await entry.undo.redo(entry.context);

    this.redoStack.pop();
    this.undoStack.push(entry);
    return true;
  }

  async dispose(): Promise<void> {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}
