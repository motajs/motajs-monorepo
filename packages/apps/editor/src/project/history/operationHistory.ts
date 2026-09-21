import { Store } from '@tanstack/store';
import { useStore } from '@tanstack/react-store';
import type { AppliedOperation, EditorOperation, OperationTarget } from './operations';
import { captureEditorViewport, restoreEditorViewport, type EditorViewport } from './viewport';

interface OperationCheckpoint {
  target: OperationTarget;
  content: unknown;
}

interface HistoryEntryInternal {
  id: number;
  label: string;
  timestamp: number;
  paths: string[];
  operation: EditorOperation<unknown>;
  beforeViewport: EditorViewport | null;
  afterViewport: EditorViewport | null;
}

export interface OperationHistoryEntry {
  id: number;
  label: string;
  timestamp: number;
  paths: string[];
}

export interface OperationHistoryState {
  entries: HistoryEntryInternal[];
  current: number;
  busy: boolean;
}

const historyStore = new Store<OperationHistoryState>({
  entries: [],
  current: 0,
  busy: false,
});

function uniqueTargets(targets: readonly OperationTarget[]): OperationTarget[] {
  return [...new Map(targets.map((target) => [target.key, target])).values()];
}

async function captureTargets(targets: readonly OperationTarget[]): Promise<OperationCheckpoint[]> {
  return Promise.all(
    uniqueTargets(targets).map(async (target) => ({
      target,
      content: await target.capture(),
    })),
  );
}

async function restoreTargets(checkpoints: readonly OperationCheckpoint[]): Promise<void> {
  const errors: unknown[] = [];
  for (const checkpoint of [...checkpoints].reverse()) {
    try {
      await checkpoint.target.restore(checkpoint.content);
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 0) {
    throw new AggregateError(errors, 'Failed to restore operation checkpoint');
  }
}

class OperationHistory {
  private nextId = 1;
  private pending = 0;
  private queue: Promise<void> = Promise.resolve();
  private readonly capacity = 100;

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    this.pending += 1;
    if (this.pending === 1) {
      historyStore.setState((state) => ({ ...state, busy: true }));
    }

    const result = this.queue.then(task, task);
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result.finally(() => {
      this.pending -= 1;
      if (this.pending === 0) {
        historyStore.setState((state) => ({ ...state, busy: false }));
      }
    });
  }

  private async applyWithCheckpoint<T>(
    operation: EditorOperation<T>,
    rollbackViewport: EditorViewport | null,
    afterApply?: (applied: AppliedOperation<T>) => void | Promise<void>,
  ): Promise<AppliedOperation<T>> {
    const checkpoints = await captureTargets(operation.targets);
    try {
      const applied = await operation.apply();
      await afterApply?.(applied);
      return applied;
    } catch (error) {
      try {
        await restoreTargets(checkpoints);
        await restoreEditorViewport(rollbackViewport);
      } catch (rollbackError) {
        throw new AggregateError(
          [error, rollbackError],
          `${operation.meta.stage} failed and checkpoint recovery failed`,
        );
      }
      throw error;
    }
  }

  execute<T>(operation: EditorOperation<T>): Promise<T> {
    const invokedViewport = captureEditorViewport();
    return this.enqueue(async () => {
      const beforeViewport = invokedViewport ?? captureEditorViewport();
      const applied = await this.applyWithCheckpoint(operation, beforeViewport);
      if (!applied.changed) return applied.value;

      const afterViewport = captureEditorViewport();
      historyStore.setState((state) => {
        const entries = state.entries.slice(0, state.current);
        entries.push({
          id: this.nextId++,
          label: operation.meta.label,
          timestamp: Date.now(),
          paths: uniqueTargets(operation.targets).map((target) => target.path),
          operation: applied.inverse,
          beforeViewport,
          afterViewport,
        });
        if (entries.length > this.capacity) entries.shift();
        return { ...state, entries, current: entries.length };
      });
      return applied.value;
    });
  }

  undo(): Promise<void> {
    return this.enqueue(async () => {
      const state = historyStore.state;
      if (state.current <= 0) return;
      const index = state.current - 1;
      const entry = state.entries[index];
      const rollbackViewport = captureEditorViewport();
      const applied = await this.applyWithCheckpoint(entry.operation, rollbackViewport, () =>
        restoreEditorViewport(entry.beforeViewport),
      );
      historyStore.setState((currentState) => {
        const entries = [...currentState.entries];
        entries[index] = { ...entry, operation: applied.inverse };
        return { ...currentState, entries, current: index };
      });
    });
  }

  redo(): Promise<void> {
    return this.enqueue(async () => {
      const state = historyStore.state;
      if (state.current >= state.entries.length) return;
      const index = state.current;
      const entry = state.entries[index];
      const rollbackViewport = captureEditorViewport();
      const applied = await this.applyWithCheckpoint(entry.operation, rollbackViewport, () =>
        restoreEditorViewport(entry.afterViewport),
      );
      historyStore.setState((currentState) => {
        const entries = [...currentState.entries];
        entries[index] = { ...entry, operation: applied.inverse };
        return { ...currentState, entries, current: index + 1 };
      });
    });
  }

  clear(): void {
    historyStore.setState((state) => ({
      ...state,
      entries: [],
      current: 0,
    }));
  }
}

export const operationHistory = new OperationHistory();

export function useOperationHistory(): {
  entries: OperationHistoryEntry[];
  current: number;
  busy: boolean;
} {
  return useStore(historyStore, (state) => ({
    entries: state.entries.map(({ id, label, timestamp, paths }) => ({
      id,
      label,
      timestamp,
      paths,
    })),
    current: state.current,
    busy: state.busy,
  }));
}
