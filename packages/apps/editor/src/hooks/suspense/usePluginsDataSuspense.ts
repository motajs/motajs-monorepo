/**
 * Suspense 版本的 usePluginsData
 *
 * 在数据未就绪时 throw handler
 * 业务组件只需要处理数据已加载的情况
 */

import { pluginsService, type PluginsData } from "@/services/plugins";
import type { UpdateFn } from "../useFs";
import { useDataSuspense } from "./useDataSuspense";

/**
 * Suspense 版本的插件数据 Hook
 *
 * 在数据未就绪时 throw handler，由 ContentBoundary 捕获处理
 * 业务组件只需要写"数据已就绪"的逻辑
 *
 * @returns [PluginsData, UpdateFn] - 数据和更新函数
 * @throws IDataHandler - 当数据未就绪时抛出
 *
 * @example
 * // 业务组件只写正常逻辑
 * function PluginsEditor() {
 *   const [plugins, update] = usePluginsDataSuspense();
 *
 *   // 这里 plugins 保证是 PluginsData 类型，不需要检查状态
 *   return <div>{JSON.stringify(plugins.init)}</div>;
 * }
 *
 * // 使用时包裹 ContentBoundary
 * <ContentBoundary>
 *   <PluginsEditor />
 * </ContentBoundary>
 */
export function usePluginsDataSuspense(): [
  PluginsData,
  UpdateFn<PluginsData>,
] {
  const handler = pluginsService.getHandler();
  return useDataSuspense(handler);
}
