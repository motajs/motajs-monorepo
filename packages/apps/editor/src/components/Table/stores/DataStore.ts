import { useMemo, useCallback } from 'react';
import { createStore } from '@motajs/react-store';
import { noop } from '@/utils/empty';
import type { CommentObject, EditMode, FieldConfig, FieldType, TableNode, TableAction } from '../types';
import { buildTableTree } from '../utils/traversal';
import { getByFieldPath, validateId } from '../utils';
import { notifyError, notifySuccess } from '@/utils/notify';

/**
 * DataStore - 管理表格数据状态和回调
 *
 * 使用 ParameterfulStore 模式，接收 data、commentObj 和回调函数作为参数。
 * 构建表格树结构并暴露回调供子组件使用。
 *
 * 架构说明：
 * - TableRow 直接调用 DataStore.useStore() 获取回调
 * - 避免了 props drilling，简化组件层级
 * - checkRange 验证在 TableRow 中统一处理，DataStore 只负责数据和回调
 */

/** DataStore Provider 的参数 */
export interface DataStoreArgument {
  /** 数据对象 */
  data: Record<string, unknown>;
  /** 注释配置对象 */
  commentObj: CommentObject;
  /** 统一的变更回调 */
  onChange?: (action: TableAction) => void | Promise<void>;
  /** 打开外部编辑器回调 - 用于外部编辑器集成 */
  onOpenExternalEditor?: (field: string, type: FieldType | undefined, config: FieldConfig) => void;
  /** 编辑模式：'change' 编辑 | 'add' 添加 | 'delete' 删除 */
  editMode?: EditMode;
}

export interface DataStoreValue {
  /** 表格节点树结构 */
  rootNodes: TableNode[];
  /** 所有可折叠的字段路径（gap 行） */
  gapFields: string[];
  /** 数据对象引用，用于内部获取值 */
  data: Record<string, unknown>;
  /** 值变更回调，供子组件使用 */
  onValueChange: (field: string, value: unknown) => void | Promise<void>;
  /** 添加项回调，供子组件使用 */
  onAddItem: (field: string, name: string) => void;
  /** 删除项回调，供子组件使用 */
  onDeleteItem: (field: string) => void;
  /** 打开外部编辑器回调，供子组件使用 */
  onOpenExternalEditor: (field: string, type: FieldType | undefined, config: FieldConfig) => void;
  /** 编辑模式：'change' 编辑 | 'add' 添加 | 'delete' 删除 */
  editMode: EditMode;
}

function useDataStore(argument: DataStoreArgument): DataStoreValue {
  const { data, commentObj, onChange, onOpenExternalEditor, editMode } = argument;

  // 从 data 和 commentObj 构建表格树，使用 useMemo 避免重复构建
  const { rootNodes, gapFields } = useMemo(
    () => buildTableTree(data, commentObj),
    [data, commentObj],
  );

  // 值变更回调 - 转换为 Action 格式
  const handleValueChange = useCallback((field: string, value: unknown) => {
    return onChange?.(['change', field, value]);
  }, [onChange]);

  // 添加项回调 - 内部处理验证逻辑
  const handleAddItem = useCallback((parentField: string, name: string) => {
    // 验证名称
    let existingKeys: string[] = [];
    const parentObj = getByFieldPath(data, parentField);
    if (parentObj && typeof parentObj === 'object') {
      existingKeys = Object.keys(parentObj as Record<string, unknown>);
    }
    const validation = validateId(name, existingKeys, false);
    if (!validation.valid) {
      notifyError(validation.error || '名称无效');
      return;
    }

    const newField = parentField + "['" + name + "']";
    onChange?.(['add', newField, null]);
    notifySuccess('添加成功，刷新后生效。');
  }, [data, onChange]);

  // 删除项回调
  const handleDeleteItem = useCallback((field: string) => {
    onChange?.(['delete', field, undefined]);
    notifySuccess('删除成功，刷新后生效。');
  }, [onChange]);

  // 打开外部编辑器回调
  const handleOpenExternalEditor = useMemo(() => onOpenExternalEditor ?? noop, [onOpenExternalEditor]);

  // 编辑模式默认为 'change'
  const mode: EditMode = editMode ?? 'change';

  return {
    rootNodes,
    gapFields,
    data,
    onValueChange: handleValueChange,
    onAddItem: handleAddItem,
    onDeleteItem: handleDeleteItem,
    onOpenExternalEditor: handleOpenExternalEditor,
    editMode: mode,
  };
}

export const DataStore = createStore(useDataStore);
