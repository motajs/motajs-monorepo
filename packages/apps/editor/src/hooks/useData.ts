/**
 * 通用数据 Hook（非 Suspense 版本）
 *
 * 订阅 handler 的 content，并提供更新函数
 */

import type { Content } from "@/fs/types";
import type { IContentHandler } from "@/fs/interfaces";
import { useHandlerUpdate, useSignal, type UpdateFn } from "./useFs";

export function useData<T>(
  handler: IContentHandler<T>,
): [Content<T>, UpdateFn<T>] {
  const content = useSignal(handler.content);
  return [content, useHandlerUpdate(handler)];
}
