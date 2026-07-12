import { useCallback } from "react";
import type { DataResource } from "@/project/data/DataResource";
import { useSignal } from "../useFs";

export type ResourceUpdateFn<T> = {
  (value: T): void;
  (transform: (current: T) => T): void;
};

export function useResourceSuspense<T>(
  resource: DataResource<T>,
): [T, ResourceUpdateFn<T>] {
  const content = useSignal(resource.content);

  if (content.status === "idle") {
    void resource.reload();
  }

  if (content.status === "loading" || content.status === "idle") {
    throw resource.waitForSettled();
  }

  if (content.status !== "loaded") {
    throw resource;
  }

  const update = useCallback<ResourceUpdateFn<T>>(
    ((valueOrTransform: T | ((current: T) => T)) => {
      void resource.update(valueOrTransform as T);
    }) as ResourceUpdateFn<T>,
    [resource],
  );

  return [content.value, update];
}
