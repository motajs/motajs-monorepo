import { Store } from '@tanstack/store';
import type { AppliedOperation, EditorOperation, OperationTarget } from './operations';
import type { UndoSystem } from './undoSystem';

interface OperationCheckpoint {
  target: OperationTarget;
  content: unknown;
}

/** 单个已注册系统在某一时刻的快照。 */
interface SystemSnapshot {
  id: string;
  snapshot: unknown;
}

interface HistoryEntryInternal {
  id: number;
  label: string;
  timestamp: number;
  paths: string[];
  operation: EditorOperation<unknown>;
  systemsBefore: readonly SystemSnapshot[];
  systemsAfter: readonly SystemSnapshot[];
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

/**
 * 采集**所有已注册**系统当前状态，按注册顺序返回。
 *
 * 是 D-03 委托接缝的上半部：每个 `OperationHistory.execute()` 都调用它（且必须在**入队之前同步调用**），
 * 不区分操作是否「声明」涉及某系统——否则一个纯数据操作就无法在 undo 时还原视图（见 `operationHistory.test.ts`）。
 */
function captureSystems(registry: ReadonlyMap<string, UndoSystem>): SystemSnapshot[] {
  return [...registry.values()].map((system) => ({ id: system.id, snapshot: system.capture() }));
}

/**
 * 按注册的**逆序**还原系统：先取快照里对应 `id` 的那份，找不到（系统在该条目之后才注册）就跳过。
 *
 * 是 D-03 委托接缝的下半部；错误聚合成 `AggregateError`，与 `restoreTargets` 的错误形状一致。
 */
async function restoreSystems(
  registry: ReadonlyMap<string, UndoSystem>,
  snapshots: readonly SystemSnapshot[],
): Promise<void> {
  const snapshotById = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot.snapshot]));
  const errors: unknown[] = [];
  for (const [id, system] of [...registry].reverse()) {
    if (!snapshotById.has(id)) continue;
    try {
      await system.restore(snapshotById.get(id));
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 0) {
    throw new AggregateError(errors, 'Failed to restore undo systems');
  }
}

export class OperationHistory {
  private nextId = 1;
  private pending = 0;
  private queue: Promise<void> = Promise.resolve();
  private readonly capacity = 100;
  /** per-instance 的 `UndoSystem` 注册表；注册顺序定义还原顺序（D-03/D-06）。 */
  private readonly registry = new Map<string, UndoSystem>();

  /**
   * per-instance 的 Store（D-11）。挂到实例而非模块级，既过 D-10 门禁，也让 `useOperationHistory` 能订阅。
   */
  readonly store = new Store<OperationHistoryState>({
    entries: [],
    current: 0,
    busy: false,
  });

  /**
   * 注册一个可撤销系统，返回只移除自己那一项的 disposer（形状对齐 `EditorCore.registerCapability`）。
   * 同一个 `id` 的二次注册被拒绝（抛错），而不是静默覆盖——两个系统抢同一 id 是调用方 bug。
   */
  registerUndoSystem<Snapshot>(system: UndoSystem<Snapshot>): () => void {
    if (this.registry.has(system.id)) {
      throw new Error(`UndoSystem already registered: ${system.id}`);
    }
    const registered: UndoSystem = system;
    this.registry.set(system.id, registered);
    return () => {
      if (this.registry.get(system.id) === registered) this.registry.delete(system.id);
    };
  }

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

  private async applyWithCheckpoint<T>(
    operation: EditorOperation<T>,
    rollbackSystems: readonly SystemSnapshot[],
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
        await restoreSystems(this.registry, rollbackSystems);
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
    // 同步、在入队之前采集 —— 与旧代码在调用时刻捕获视口状态的位置一致（T-04-09）。
    const invokedSystems = captureSystems(this.registry);
    return this.enqueue(async () => {
      const beforeSystems = invokedSystems.length > 0 ? invokedSystems : captureSystems(this.registry);
      const applied = await this.applyWithCheckpoint(operation, beforeSystems);
      if (!applied.changed) return applied.value;

      const afterSystems = captureSystems(this.registry);
      this.store.setState((state) => {
        const entries = state.entries.slice(0, state.current);
        entries.push({
          id: this.nextId++,
          label: operation.meta.label,
          timestamp: Date.now(),
          paths: uniqueTargets(operation.targets).map((target) => target.path),
          operation: applied.inverse,
          systemsBefore: beforeSystems,
          systemsAfter: afterSystems,
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
      const entry = state.entries[index];
      const rollbackSystems = captureSystems(this.registry);
      const applied = await this.applyWithCheckpoint(entry.operation, rollbackSystems, () =>
        restoreSystems(this.registry, entry.systemsBefore),
      );
      this.store.setState((currentState) => {
        const entries = [...currentState.entries];
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
      const entry = state.entries[index];
      const rollbackSystems = captureSystems(this.registry);
      const applied = await this.applyWithCheckpoint(entry.operation, rollbackSystems, () =>
        restoreSystems(this.registry, entry.systemsAfter),
      );
      this.store.setState((currentState) => {
        const entries = [...currentState.entries];
        entries[index] = { ...entry, operation: applied.inverse };
        return { ...currentState, entries, current: index + 1 };
      });
    });
  }

  clear(): void {
    this.store.setState((state) => ({
      ...state,
      entries: [],
      current: 0,
    }));
  }
}
