/**
 * TableMeta Hooks
 *
 * 提供表格元数据的 React Hooks，基于 tableMetaService
 */

import { useSignal } from './useFs';
import { tableMetaService, type MetaFileKey } from '@/services/tableMeta/tableMetaService';
import type { Content } from '@/fs/types';
import type { CommentObject, FieldConfig } from '@/components/Table';

/**
 * useTableMeta - 完整元数据 Hook
 *
 * @param key - 元数据文件 key
 * @returns Content<CommentObject> 元数据内容
 */
export function useTableMeta(key: MetaFileKey): Content<CommentObject> {
  const handler = tableMetaService.getHandler(key);
  return useSignal(handler.content);
}

function objectData(data: CommentObject): Record<string, FieldConfig | CommentObject> {
  return typeof data._data === 'function' ? {} : (data._data ?? {});
}

function nestedMeta(data: CommentObject, parent: string, child: string): CommentObject {
  const parentValue = objectData(data)[parent];
  if (!parentValue || typeof parentValue !== 'object' || !('_data' in parentValue)) return {};
  const childValue = objectData(parentValue as CommentObject)[child];
  return childValue && typeof childValue === 'object' ? (childValue as CommentObject) : {};
}

// ==================== 预定义 Selectors ====================

/** 提取 floors._data.floor */
export const selectFloorMeta = (data: CommentObject): CommentObject => nestedMeta(data, 'floors', 'floor');

/** 提取 floors._data.loc */
export const selectLocMeta = (data: CommentObject): CommentObject => nestedMeta(data, 'floors', 'loc');
