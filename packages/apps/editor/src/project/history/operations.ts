import type { Content } from '@/fs/types';
import type { DataResource } from '@/project/data/DataResource';
import { applyActionsWithInverse, type Action } from '@/utils/action';
import { captureEditorViewport, restoreEditorViewport, type EditorViewport } from './viewport';

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

function dataResourceTarget<T>(resource: DataResource<T>): OperationTarget {
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
  private readonly resource: DataResource<T>;
  private readonly actions: readonly Action[];

  constructor(meta: OperationMeta, resource: DataResource<T>, actions: readonly Action[]) {
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
  resource: DataResource<T>,
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

class RestoreViewportOperation implements EditorOperation {
  readonly targets = [];
  readonly meta: OperationMeta;
  private readonly viewport: EditorViewport;

  constructor(meta: OperationMeta, viewport: EditorViewport) {
    this.meta = meta;
    this.viewport = viewport;
  }

  async apply(): Promise<AppliedOperation> {
    const current = captureEditorViewport();
    if (!current) return { value: undefined, inverse: this, changed: false };
    await restoreEditorViewport(this.viewport);
    return {
      value: undefined,
      inverse: new RestoreViewportOperation(this.meta, current),
      changed: true,
    };
  }
}

class NavigateFloorOperation implements EditorOperation {
  readonly targets = [];
  readonly meta: OperationMeta;
  private readonly floorId: string;
  private readonly onlyFromFloorId?: string;

  constructor(meta: OperationMeta, floorId: string, onlyFromFloorId?: string) {
    this.meta = meta;
    this.floorId = floorId;
    this.onlyFromFloorId = onlyFromFloorId;
  }

  async apply(): Promise<AppliedOperation> {
    const current = captureEditorViewport();
    if (!current || (this.onlyFromFloorId && current.floorId !== this.onlyFromFloorId)) {
      return { value: undefined, inverse: this, changed: false };
    }
    await restoreEditorViewport({ ...current, floorId: this.floorId });
    return {
      value: undefined,
      inverse: new RestoreViewportOperation(this.meta, current),
      changed: current.floorId !== this.floorId,
    };
  }
}

export function navigateFloorOperation(
  floorId: string,
  meta: OperationMeta,
  onlyFromFloorId?: string,
): EditorOperation {
  return new NavigateFloorOperation(meta, floorId, onlyFromFloorId);
}
