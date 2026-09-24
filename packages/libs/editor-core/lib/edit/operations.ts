import type { IContentHandler } from '../resources/interfaces';
import type { Content } from '../resources/types';
import { applyActionsWithInverse, type Action } from './action';

export interface OperationMeta {
  label: string;
  stage: string;
}

export interface OperationTarget {
  readonly key: string;
  readonly path: string;
  capture(): unknown | Promise<unknown>;
  restore(checkpoint: unknown): Promise<void>;
}

export interface AppliedOperation<T = void> {
  value: T;
  inverse: EditorOperation<unknown>;
  changed: boolean;
}

export interface EditorOperation<T = void> {
  readonly meta: OperationMeta;
  readonly targets: readonly OperationTarget[];
  apply(): Promise<AppliedOperation<T>>;
}

/**
 * core 的 patch 操作所需的**窄**资源契约。
 *
 * 只声明 `patchResourceOperation` 真正用到的三个成员：`path`、`raw()`、`mutate()`。
 * 编辑器的数据资源在结构上满足它，因此命令层无需任何改动即可传入。
 * 刻意不接受编辑器的名义类型，避免把编辑器/引擎类型拖进 core（D-04）。
 */
export interface PatchableResource<T> {
  readonly path: string;
  raw(): IContentHandler<string>;
  mutate(recipe: (draft: T) => void): Promise<void>;
}

function dataResourceTarget<T>(resource: PatchableResource<T>): OperationTarget {
  const raw = resource.raw();
  return {
    key: `text:${resource.path}`,
    path: resource.path,
    capture: () => raw.getContent(),
    restore: async (checkpoint) => {
      const content = checkpoint as Content<string>;
      if (content.status !== 'loaded') {
        throw new Error(`Cannot restore ${resource.path} from ${content.status}`);
      }
      await Promise.resolve(raw.update(content.value));
    },
  };
}

class CompositeOperation implements EditorOperation<unknown[]> {
  readonly targets: readonly OperationTarget[];
  readonly meta: OperationMeta;
  private readonly operations: readonly EditorOperation<unknown>[];

  constructor(meta: OperationMeta, operations: readonly EditorOperation<unknown>[]) {
    this.meta = meta;
    this.operations = operations;
    this.targets = operations.flatMap((operation) => operation.targets);
  }

  async apply(): Promise<AppliedOperation<unknown[]>> {
    const applied: AppliedOperation<unknown>[] = [];
    const values: unknown[] = [];
    let currentOperation: EditorOperation<unknown> | undefined;
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

class ResourcePatchOperation<T> implements EditorOperation {
  readonly targets: readonly OperationTarget[];
  readonly meta: OperationMeta;
  private readonly resource: PatchableResource<T>;
  private readonly actions: readonly Action[];

  constructor(meta: OperationMeta, resource: PatchableResource<T>, actions: readonly Action[]) {
    this.meta = meta;
    this.resource = resource;
    this.actions = actions;
    this.targets = [dataResourceTarget(resource)];
  }

  async apply(): Promise<AppliedOperation> {
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

export function patchResourceOperation<T>(
  resource: PatchableResource<T>,
  actions: readonly Action[],
  meta: OperationMeta,
): EditorOperation {
  return new ResourcePatchOperation(meta, resource, actions);
}

export function compositeOperation(
  operations: readonly EditorOperation<unknown>[],
  meta: OperationMeta,
): EditorOperation<unknown[]> {
  return new CompositeOperation(meta, operations);
}

export function operationPathTarget(key: string, path: string): OperationTarget {
  return {
    key,
    path,
    capture: () => undefined,
    restore: async () => undefined,
  };
}
