import { useCallback } from 'react';
import { FoldStore } from '../stores/FoldStore';
import type { UseFoldReturn } from '../types';

/**
 * useFold Hook - 获取指定字段的折叠状态和切换方法
 *
 * 从 FoldStore 读取状态，返回当前字段是否折叠以及切换折叠的方法。
 *
 * @param field - 字段路径，如 "['main']"
 * @returns { isFolded, toggleFold }
 *
 * @example
 * ```tsx
 * const { isFolded, toggleFold } = useFold("['main']");
 * return (
 *   <button onClick={toggleFold}>
 *     {isFolded ? '展开' : '折叠'}
 *   </button>
 * );
 * ```
 */
export function useFold(field: string): UseFoldReturn {
  const { foldedFields, toggleFold: storeToggleFold } = FoldStore.useStore();

  const isFolded = foldedFields.has(field);

  // 包装 toggleFold，绑定当前 field
  const toggleFold = useCallback(() => {
    storeToggleFold(field);
  }, [storeToggleFold, field]);

  return {
    isFolded,
    toggleFold,
  };
}
