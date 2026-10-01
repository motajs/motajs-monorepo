import { AppliedOperation, IEditorOperation, OperationMeta } from '@motajs/editor-core';

// 组合操作：把多个子操作按顺序执行；成功时交出一个把它们整体撤回来的组合逆操作，
// 失败时把已成功的子操作按**逆序**用各自的逆操作回退，并标注失败阶段
class CompositeOperation implements IEditorOperation<unknown[]> {
  /** 这一步的元数据。 */
  readonly meta: OperationMeta;
  /** 按顺序执行的子操作。 */
  private readonly operations: readonly IEditorOperation<unknown>[];

  constructor(meta: OperationMeta, operations: readonly IEditorOperation<unknown>[]) {
    this.meta = meta;
    this.operations = operations;
  }

  /** 按顺序执行全部子操作；成功给出把整体撤回的组合逆操作，失败逆序回退已成功的部分并抛出。 */
  async apply(): Promise<AppliedOperation<unknown[]>> {
    const applied: AppliedOperation<unknown>[] = [];
    const values: unknown[] = [];
    let currentOperation: IEditorOperation<unknown> | undefined;
    try {
      for (const operation of this.operations) {
        currentOperation = operation;
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
        throw new AggregateError([error, ...rollbackErrors], `${this.meta.stage} failed and semantic recovery failed`);
      }
      if (error && typeof error === 'object' && !('commandStage' in error)) {
        Object.assign(error, { commandStage: currentOperation?.meta.stage ?? this.meta.stage });
      }
      throw error;
    }

    const inverses = applied
      .filter((result) => result.changed)
      .map((result) => result.inverse)
      .reverse();
    return {
      value: values,
      inverse: new CompositeOperation(this.meta, inverses),
      changed: inverses.length > 0,
    };
  }
}

/**
 * 工厂：把多个操作组合成一个按顺序执行的 `IEditorOperation`。
 *
 * @param operations 按顺序执行的子操作。
 * @param meta 组合操作的元数据。
 */
export function compositeOperation(
  operations: readonly IEditorOperation<unknown>[],
  meta: OperationMeta,
): IEditorOperation<unknown[]> {
  return new CompositeOperation(meta, operations);
}
