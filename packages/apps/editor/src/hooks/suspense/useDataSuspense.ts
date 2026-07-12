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

export function useDataSuspense<T>(
  handler: IDataHandler<T>,
): [T, UpdateFn<T>] {
  const content = useSignal(handler.content);

  // idle → loading
  if (content.status === "idle") {
    handler.refetch();
  }

  // loading → throw Promise → Suspense
  if (content.status === "loading" || content.status === "idle") {
    throw handler.waitForSettled();
  }

  // error/not-found → throw handler → Error boundary
  if (content.status !== "loaded") {
    throw handler;
  }

  return [content.value, useHandlerUpdate(handler)];
}
