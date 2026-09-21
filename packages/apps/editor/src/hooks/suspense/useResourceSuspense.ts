import { useCallback } from 'react';
import type { DataResource } from '@/project/data/DataResource';
import { useSignal } from '../useFs';
import { deferredEnsureLoaded } from './deferredEnsureLoaded';

export type ResourceUpdateFn<T> = {
  (value: T): void;
  (transform: (current: T) => T): void;
};

export function useResourceSuspense<T>(resource: DataResource<T>): [T, ResourceUpdateFn<T>] {
  const content = useSignal(resource.content);

  if (content.status === 'idle') {
    throw deferredEnsureLoaded(resource);
  }

  if (content.status === 'loading') {
    throw resource.waitForSettled();
  }

  if (content.status !== 'loaded') {
    throw resource;
  }

  const updateCallback = useCallback(
    (valueOrTransform: T | ((current: T) => T)) => {
      void resource.update(valueOrTransform as T);
    },
    [resource],
  );

  return [content.value, updateCallback as ResourceUpdateFn<T>];
}
