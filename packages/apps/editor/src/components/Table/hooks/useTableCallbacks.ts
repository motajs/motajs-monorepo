import { DataStore } from '../stores/DataStore';
import type { EditMode, FieldConfig, FieldType } from '../types';

/**
 * useTableCallbacks 返回类型
 */
export interface UseTableCallbacksReturn {
  /** 值变更回调 */
  onValueChange: (field: string, value: unknown) => void | Promise<void>;
  /** 添加项回调 */
  onAddItem: (field: string, name: string) => void;
  /** 删除项回调 */
  onDeleteItem: (field: string) => void;
  /** 打开外部编辑器回调 */
  onOpenExternalEditor: (field: string, type: FieldType | undefined, config: FieldConfig) => void;
  /** 编辑模式：'change' 编辑 | 'add' 添加 | 'delete' 删除 */
  editMode: EditMode;
}

/**
 * useTableCallbacks Hook - 获取表格操作回调
 *
 * 从 DataStore 读取回调函数，供子组件使用。
 *
 * @returns { onValueChange, onAddItem, onDeleteItem, onOpenExternalEditor, editMode }
 *
 * @example
 * ```tsx
 * const { onValueChange, onAddItem, onDeleteItem, onOpenExternalEditor, editMode } = useTableCallbacks();
 *
 * // 修改值
 * onValueChange("['main']['floorIds']", ['floor1', 'floor2']);
 *
 * // 添加新项
 * onAddItem("['enemies']", 'newEnemy');
 *
 * // 删除项
 * onDeleteItem("['enemies']['oldEnemy']");
 *
 * // 打开外部编辑器
 * onOpenExternalEditor("['main']['events']", 'event', config);
 *
 * // 检查编辑模式
 * if (editMode === 'change') { ... }
 * ```
 */
export function useTableCallbacks(): UseTableCallbacksReturn {
  const { onValueChange, onAddItem, onDeleteItem, onOpenExternalEditor, editMode } = DataStore.useStore();

  return {
    onValueChange,
    onAddItem,
    onDeleteItem,
    onOpenExternalEditor,
    editMode,
  };
}
