import { AppliedOperation, IEditorOperation, OperationMeta } from '@motajs/editor-core';
import { IPatchableResource } from '../edit/types';
import { applyActionsWithInverse } from './action';
import { Action } from './types';

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

/**
 * 工厂：返回一个对可 patch 资源应用一组表格动作的 `IEditorOperation`。
 *
 * @param resource 被改写的可 patch 资源。
 * @param actions 要应用的表格动作。
 * @param meta 操作的元数据。
 */
export function patchResourceOperation<T>(
  resource: IPatchableResource<T>,
  actions: readonly Action[],
  meta: OperationMeta,
): IEditorOperation {
  return new ResourcePatchOperation(meta, resource, actions);
}
