/**
 * Suspense 版本的 useTernDefs
 *
 * 在数据未就绪时 throw handler
 * 业务组件只需要处理数据已加载的情况
 */

import { ternDefsService, type TernDefsData } from "@/services/ternDefs";
import { useDataSuspense } from "./useDataSuspense";

/**
 * Suspense 版本的 Tern 定义数据 Hook
 *
 * 在数据未就绪时 throw handler，由 ContentBoundary 捕获处理
 * 业务组件只需要写"数据已就绪"的逻辑
 *
 * 注意：TernDefs 是只读数据，不返回 update 函数
 *
 * @returns TernDefsData - Tern 定义数据数组
 * @throws IDataHandler - 当数据未就绪时抛出
 *
 * @example
 * // 业务组件只写正常逻辑
 * function TernEditor() {
 *   const ternDefs = useTernDefsSuspense();
 *
 *   // 这里 ternDefs 保证是 TernDefsData 类型，不需要检查状态
 *   return <div>{ternDefs.length} definitions loaded</div>;
 * }
 *
 * // 使用时包裹 ContentBoundary
 * <ContentBoundary>
 *   <TernEditor />
 * </ContentBoundary>
 */
export function useTernDefsSuspense(): TernDefsData {
  const handler = ternDefsService.getHandler();
  const [data] = useDataSuspense(handler);
  return data;
}
