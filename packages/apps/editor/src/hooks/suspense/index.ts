/**
 * Suspense Hooks 导出
 *
 * 提供 Suspense 版本的数据 hooks
 * 在数据未就绪时 throw handler，由 ContentBoundary 捕获处理
 */

export { useFloorDataSuspense } from './useFloorDataSuspense';
export { useTowerDataSuspense } from './useTowerDataSuspense';
export { useFunctionsDataSuspense } from './useFunctionsDataSuspense';
export { usePluginsDataSuspense } from './usePluginsDataSuspense';
export { useCommonEventDataSuspense } from './useCommonEventDataSuspense';
export { useTableMetaSuspense } from './useTableMetaSuspense';
export { useLocTableMetaSuspense } from './useLocTableMetaSuspense';
export { useDataSuspense } from './useDataSuspense';
export { useResourceSuspense } from './useResourceSuspense';
export { useModelResourceSuspense } from './useModelResourceSuspense';
export type { ResourceUpdateFn } from './useResourceSuspense';
