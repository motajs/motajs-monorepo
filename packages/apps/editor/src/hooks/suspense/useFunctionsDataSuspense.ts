/**
 * Suspense 版本的 useFunctionsData
 *
 * 在数据未就绪时 throw handler
 * 业务组件只需要处理数据已加载的情况
 */

import { functionsService, type FunctionsData } from "@/services/functions";
import type { UpdateFn } from "../useFs";
import { useDataSuspense } from "./useDataSuspense";

/**
 * Suspense 版本的脚本函数数据 Hook
 *
 * 在数据未就绪时 throw handler，由 ContentBoundary 捕获处理
 * 业务组件只需要写"数据已就绪"的逻辑
 *
 * @returns [FunctionsData, UpdateFn] - 数据和更新函数
 * @throws IDataHandler - 当数据未就绪时抛出
 *
 * @example
 * // 业务组件只写正常逻辑
 * function FunctionsEditor() {
 *   const [functions, update] = useFunctionsDataSuspense();
 *
 *   // 这里 functions 保证是 FunctionsData 类型，不需要检查状态
 *   return <div>{JSON.stringify(functions.events)}</div>;
 * }
 *
 * // 使用时包裹 ContentBoundary
 * <ContentBoundary>
 *   <FunctionsEditor />
 * </ContentBoundary>
 */
export function useFunctionsDataSuspense(): [
  FunctionsData,
  UpdateFn<FunctionsData>,
] {
  const handler = functionsService.getHandler();
  return useDataSuspense(handler);
}
