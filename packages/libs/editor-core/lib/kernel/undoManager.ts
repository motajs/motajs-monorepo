import { Store } from '@tanstack/store';
import { IEditorOperation, IUndoManager, OperationHistoryEntry, OperationHistoryState } from './types';

/**
 * 管理器内部的历史条目：在对外条目之外，额外记住「怎么把这一步撤回来」的那个操作。
 *
 * 对外只暴露 `OperationHistoryEntry`（编号 / 标签 / 时刻 / 路径）；操作本体留在管理器内部，
 * 撤销时调它的 `apply()`，重做时把返回的新逆操作写回同一条。
 */
interface ManagedEntry extends OperationHistoryEntry {
  /** 这一步对应的逆操作；撤销时调它，重做时再调并写回新逆操作。 */
  readonly operation: IEditorOperation<unknown>;
}

/**
 * UndoManager —— 只记录操作先后的撤销管理器（D-04/D-05）。
 *
 * 它不认识任何被编辑的内容：执行操作时只调用操作自己的 `apply()`，把返回的逆操作记进历史；
 * 撤销 / 重做时只调用历史里那个操作的 `apply()`。全程不保存任何快照，状态全部落在实例字段上，
 * 因此两个实例天然互不干扰（D-10）。
 */
export class UndoManager implements IUndoManager {
  /** 下一条历史记录的编号，逐条自增。 */
  private nextId: number = 1;

  /** 正在排队（含执行中）的任务数：从 0 变 1 置 busy，回落 0 清 busy。 */
  private pending: number = 0;

  /** 串行队列的队尾：新任务接在它后面，保证同一时刻只有一个操作在跑。 */
  private queue: Promise<void> = Promise.resolve();

  /** 历史上限：只保留最近 100 条，超出的从最旧一端移除。 */
  private readonly capacity: number = 100;
  /** per-instance 的状态容器（D-11）：供界面订阅历史条目、当前指针与忙碌状态。 */
  readonly store = new Store<OperationHistoryState>({ entries: [], current: 0, busy: false });

  /** 把任务排进串行队列，并维护 busy 计数（IUndoManager 的并发语义）。 */
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    this.pending += 1;
    if (this.pending === 1) {
      this.store.setState((state) => ({ ...state, busy: true }));
    }

    const result = this.queue.then(task, task);
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result.finally(() => {
      this.pending -= 1;
      if (this.pending === 0) {
        this.store.setState((state) => ({ ...state, busy: false }));
      }
    });
  }

  execute<T>(operation: IEditorOperation<T>): Promise<T> {
    return this.enqueue(async () => {
      const applied = await operation.apply();
      if (!applied.changed) return applied.value;

      const paths = operation.meta.paths ? [...operation.meta.paths] : [];
      this.store.setState((state) => {
        const entries = state.entries.slice(0, state.current) as ManagedEntry[];
        entries.push({
          id: this.nextId++,
          label: operation.meta.label,
          timestamp: Date.now(),
          paths,
          operation: applied.inverse,
        });
        if (entries.length > this.capacity) entries.shift();
        return { ...state, entries, current: entries.length };
      });
      return applied.value;
    });
  }

  undo(): Promise<void> {
    return this.enqueue(async () => {
      const state = this.store.state;
      if (state.current <= 0) return;
      const index = state.current - 1;
      const entry = state.entries[index] as ManagedEntry;
      const applied = await entry.operation.apply();
      this.store.setState((currentState) => {
        const entries = [...currentState.entries] as ManagedEntry[];
        entries[index] = { ...entry, operation: applied.inverse };
        return { ...currentState, entries, current: index };
      });
    });
  }

  redo(): Promise<void> {
    return this.enqueue(async () => {
      const state = this.store.state;
      if (state.current >= state.entries.length) return;
      const index = state.current;
      const entry = state.entries[index] as ManagedEntry;
      const applied = await entry.operation.apply();
      this.store.setState((currentState) => {
        const entries = [...currentState.entries] as ManagedEntry[];
        entries[index] = { ...entry, operation: applied.inverse };
        return { ...currentState, entries, current: index + 1 };
      });
    });
  }

  clear(): void {
    this.store.setState((state) => ({ ...state, entries: [], current: 0 }));
  }
}
