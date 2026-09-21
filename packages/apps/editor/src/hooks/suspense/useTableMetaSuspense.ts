/**
 * Suspense 版本的 useTableMeta
 *
 * 在数据未就绪时 throw handler
 * 业务组件只需要处理数据已加载的情况
 */

import type { MetaFileKey } from '@/services/tableMeta/tableMetaService';
import type { CommentObject } from '@/components/Table';
import { projectModel } from '@/project/model/projectModel';
import { useModelResourceSuspense } from './useModelResourceSuspense';

/**
 * Suspense 版本的表格元数据 Hook
 *
 * 在数据未就绪时 throw handler，由 ContentBoundary 捕获处理
 * 业务组件只需要写"数据已就绪"的逻辑
 *
 * @param key - 元数据文件 key
 * @returns CommentObject - 元数据对象
 * @throws IDataHandler - 当数据未就绪时抛出
 *
 * @example
 * // 业务组件只写正常逻辑
 * function MetaViewer() {
 *   const meta = useTableMetaSuspense('dataComment');
 *
 *   // 这里 meta 保证是 CommentObject 类型，不需要检查状态
 *   return <div>{JSON.stringify(meta)}</div>;
 * }
 *
 * // 使用时包裹 ContentBoundary
 * <ContentBoundary>
 *   <MetaViewer />
 * </ContentBoundary>
 */
export function useTableMetaSuspense(key: MetaFileKey): CommentObject {
  return useModelResourceSuspense(projectModel.tableSchema(key)).schema;
}
