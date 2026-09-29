import { applyActionsWithInverse, Action } from './action';
import { AppliedOperation, IEditorOperation, OperationMeta } from '@motajs/editor-core';
import { IPatchableResource } from './types';

/**
 * 组合操作：把多个子操作按顺序执行；成功时交出一个把它们整体撤回来的组合逆操作，
 * 失败时把已成功的子操作按**逆序**用各自的逆操作回退，并标注失败阶段。
 */
class CompositeOperation implements IEditorOperation<unknown[]> {
  /** 这一步的元数据。 */
  readonly meta: OperationMeta;
  /** 按顺序执行的子操作。 */
  private readonly operations: readonly IEditorOperation<unknown>[];

  constructor(meta: OperationMeta, operations: readonly IEditorOperation<unknown>[]) {
    this.meta = meta;
    this.operations = operations;
  }

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
 * patch 操作：对一个可 patch 的资源应用一组表格动作，成功时交出把动作反向的逆操作。
 */
class ResourcePatchOperation<T> implements IEditorOperation {
  /** 这一步的元数据。 */
  readonly meta: OperationMeta;
  /** 被改写的资源。 */
  private readonly resource: IPatchableResource<T>;
  /** 这次要应用的表格动作。 */
  private readonly actions: readonly Action[];

  constructor(meta: OperationMeta, resource: IPatchableResource<T>, actions: readonly Action[]) {
    this.meta = meta;
    this.resource = resource;
    this.actions = actions;
  }

  async apply(): Promise<AppliedOperation<void>> {
    let inverseActions: Action[] = [];
    await this.resource.mutate((draft) => {
      inverseActions = applyActionsWithInverse(draft as Record<string, unknown>, this.actions as Action[]);
    });

    return {
      value: undefined,
      inverse: new ResourcePatchOperation(this.meta, this.resource, inverseActions),
      changed: inverseActions.length > 0,
    };
  }
}

/** 工厂：返回一个对可 patch 资源应用一组表格动作的 `IEditorOperation`。 */
export function patchResourceOperation<T>(
  resource: IPatchableResource<T>,
  actions: readonly Action[],
  meta: OperationMeta,
): IEditorOperation {
  return new ResourcePatchOperation(meta, resource, actions);
}

/** 工厂：把多个操作组合成一个按顺序执行的 `IEditorOperation`。 */
export function compositeOperation(
  operations: readonly IEditorOperation<unknown>[],
  meta: OperationMeta,
): IEditorOperation<unknown[]> {
  return new CompositeOperation(meta, operations);
}
