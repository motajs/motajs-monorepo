import { beforeEach, describe, expect, it } from 'vitest';
import { UndoManager } from '../kernel/undoManager';
import { AppliedOperation, IEditorOperation, OperationMeta } from '../kernel/types';

describe('UndoManager invariants', () => {
  let value = 0;
  let manager: UndoManager;

  beforeEach(() => {
    value = 0;
    manager = new UndoManager();
  });

  // 纯内存计数器操作：成功时交出一个把这次增减撤回来的逆操作
  const counterOperation = (delta: number): IEditorOperation<unknown> => ({
    meta: { label: 'counter', stage: 'counter' },
    apply: async () => {
      value += delta;
      return { value, inverse: counterOperation(-delta), changed: delta !== 0 };
    },
  });

  // 组合操作测试替身：与 editor-impl 的 CompositeOperation 同契约——失败时把已成功的子操作
  // 按逆序用各自的逆操作回退，并给错误标上失败阶段 `commandStage`
  const compositeOperation = (
    operations: readonly IEditorOperation<unknown>[],
    meta: OperationMeta,
  ): IEditorOperation<unknown[]> => ({
    meta,
    apply: async () => {
      const applied: AppliedOperation<unknown>[] = [];
      const values: unknown[] = [];
      let current: IEditorOperation<unknown> | undefined;
      try {
        for (const operation of operations) {
          current = operation;
          const result = await operation.apply();
          applied.push(result);
          values.push(result.value);
        }
      } catch (error) {
        const rollbackErrors: unknown[] = [];
        for (const result of [...applied].reverse()) {
          if (!result.changed) continue;
          try {
            await result.inverse.apply();
          } catch (rollbackError) {
            rollbackErrors.push(rollbackError);
          }
        }
        if (rollbackErrors.length > 0) {
          throw new AggregateError([error, ...rollbackErrors], `${meta.stage} failed and semantic recovery failed`);
        }
        if (error && typeof error === 'object' && !('commandStage' in error)) {
          Object.assign(error, { commandStage: current?.meta.stage ?? meta.stage });
        }
        throw error;
      }
      const inverses = applied
        .filter((result) => result.changed)
        .map((result) => result.inverse)
        .reverse();
      return { value: values, inverse: compositeOperation(inverses, meta), changed: inverses.length > 0 };
    },
  });

  // 覆盖：容量 100；第 101 次 undo 是空操作，最旧一条已被移除
  it('keeps at most 100 entries and makes the 101st undo a no-op', async () => {
    for (let delta = 1; delta <= 101; delta++) {
      await manager.execute(counterOperation(delta));
    }

    const observed: number[] = [];
    for (let attempt = 0; attempt < 150; attempt++) {
      const before = value;
      await manager.undo();
      if (value === before) break;
      observed.push(value);
    }

    expect(observed).toHaveLength(100);
    // 最旧的一条（首笔 +1）已被移除，它的效果永远不会被撤销：终值为 1
    expect(value).toBe(1);
  });

  // 覆盖：撤销调历史里存下的逆操作，重做再调原操作
  it('applies the stored inverse on undo and re-applies it on redo', async () => {
    await manager.execute(counterOperation(5));
    expect(value).toBe(5);

    await manager.undo();
    expect(value).toBe(0);

    await manager.redo();
    expect(value).toBe(5);

    await manager.undo();
    expect(value).toBe(0);
  });

  // 覆盖：撤销后再提交新操作，redo 分支被截断
  it('truncates the redo tail when a new operation is committed after an undo', async () => {
    await manager.execute(counterOperation(1));
    await manager.undo();
    await manager.execute(counterOperation(10));

    await manager.redo();
    expect(value).toBe(10);
  });

  // 覆盖：报告 changed=false 的操作不进入历史
  it('records nothing when a commit reports no change', async () => {
    const noChange: IEditorOperation<unknown> = {
      meta: { label: 'no-change', stage: 'no-change' },
      apply: async () => ({ value: undefined, inverse: counterOperation(999), changed: false }),
    };

    await manager.execute(noChange);
    expect(value).toBe(0);

    // 若这条无改动被记进历史，下面的 undo 会调它的逆操作（+999），value 会跳
    await manager.undo();
    expect(value).toBe(0);
  });

  // 覆盖：组合操作失败时，已成功的子操作按逆序回退，并标出失败阶段
  it('rolls back completed composite children in reverse order and tags the failing stage', async () => {
    let counter = 0;
    const compositeCounter = (delta: number): IEditorOperation<unknown> => ({
      meta: { label: 'counter', stage: 'counter' },
      apply: async () => {
        counter += delta;
        return { value: counter, inverse: compositeCounter(-delta), changed: delta !== 0 };
      },
    });
    const failingChild: IEditorOperation<unknown> = {
      meta: { label: 'failure', stage: 'composite-child' },
      apply: async () => {
        throw new Error('composite failure');
      },
    };

    await expect(
      manager.execute(
        compositeOperation([compositeCounter(1), failingChild], { label: 'composite', stage: 'composite' }),
      ),
    ).rejects.toMatchObject({ commandStage: 'composite-child' });
    expect(counter).toBe(0);
  });
});
