/**
 * Suspense 版本的 useTowerData
 *
 * 在数据未就绪时 throw handler
 * 业务组件只需要处理数据已加载的情况
 */

import { towerService, type TowerData } from "@/services/tower";
import type { UpdateFn } from "../useFs";
import { useDataSuspense } from "./useDataSuspense";

/**
 * Suspense 版本的全塔数据 Hook
 *
 * 在数据未就绪时 throw handler，由 ContentBoundary 捕获处理
 * 业务组件只需要写"数据已就绪"的逻辑
 *
 * @returns [TowerData, UpdateFn] - 数据和更新函数
 * @throws IDataHandler - 当数据未就绪时抛出
 *
 * @example
 * // 业务组件只写正常逻辑
 * function TowerEditor() {
 *   const [tower, update] = useTowerDataSuspense();
 *
 *   // 这里 tower 保证是 TowerData 类型，不需要检查状态
 *   return <Input value={tower.main.title} onChange={...} />;
 * }
 *
 * // 使用时包裹 ContentBoundary
 * <ContentBoundary>
 *   <TowerEditor />
 * </ContentBoundary>
 */
export function useTowerDataSuspense(): [TowerData, UpdateFn<TowerData>] {
  const handler = towerService.getHandler();
  return useDataSuspense(handler);
}
