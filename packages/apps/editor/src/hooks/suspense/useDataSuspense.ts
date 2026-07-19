/**
 * 通用 Suspense 数据 Hook
 *
 * - idle → loading
 * - loading → throw Promise → Suspense fallback
 * - error/not-found → throw handler → Error boundary
 * - loaded → 返回数据
 */

import type { IDataHandler } from "@/fs/interfaces";
import { useHandlerUpdate, useSignal, type UpdateFn } from "../useFs";

const deferredRefetches = new WeakMap<object, Promise<void>>();

function deferredRefetch(handler: IDataHandler<unknown>): Promise<void> {
  const pending = deferredRefetches.get(handler);
  if (pending) return pending;
  const loading = Promise.resolve()
    .then(() => handler.refetch())
    .finally(() => {
      if (deferredRefetches.get(handler) === loading) deferredRefetches.delete(handler);
    });
  deferredRefetches.set(handler, loading);
  return loading;
}

export function useDataSuspense<T>(
  handler: IDataHandler<T>,
): [T, UpdateFn<T>] {
  const content = useSignal(handler.content);

  // idle → loading
  if (content.status === "idle") {
    throw deferredRefetch(handler);
  }

  // loading → throw Promise → Suspense
  if (content.status === "loading") {
    throw handler.waitForSettled();
  }

  // error/not-found → throw handler → Error boundary
  if (content.status !== "loaded") {
    throw handler;
  }

  return [content.value, useHandlerUpdate(handler)];
}
