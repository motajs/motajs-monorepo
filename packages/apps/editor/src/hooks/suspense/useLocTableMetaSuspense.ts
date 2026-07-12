/**
 * Suspense 版本的 loc 表格元数据 Hook
 */

import type { CommentObject } from "@/components/Table";
import { selectLocMeta } from "../useTableMeta";
import { projectModel } from "@/project/model/projectModel";
import { useModelResourceSuspense } from "./useModelResourceSuspense";

/**
 * Suspense 版本的位置表格元数据 Hook
 *
 * 在数据未就绪时 throw handler，由 ContentBoundary 捕获处理
 * 业务组件只需要写"数据已就绪"的逻辑
 *
 * @returns CommentObject - loc 元数据对象
 * @throws IDataHandler - 当数据未就绪时抛出
 *
 * @example
 * function LocViewer() {
 *   const meta = useLocTableMetaSuspense();
 *
 *   // 这里 meta 保证是 CommentObject 类型，不需要检查状态
 *   return <Table commentObj={meta} />;
 * }
 */
export function useLocTableMetaSuspense(): CommentObject {
  return selectLocMeta(useModelResourceSuspense(projectModel.tableSchema("comment")).schema);
}
