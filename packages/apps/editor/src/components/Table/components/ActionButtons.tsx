import type { FC } from 'react';
import type { ActionButtonsProps, FieldType } from '../types';

/**
 * 判断是否应该显示编辑按钮
 *
 * 根据字段类型决定是否显示编辑按钮：
 * - select、checkbox、checkboxSet、color、disable 类型不显示编辑按钮
 * - popCheckboxSet 显示"多选框编辑"按钮
 * - 其他类型显示"编辑"按钮
 */
const shouldShowEditButton = (type?: FieldType): boolean => {
  if (!type) return true;
  return type !== 'select' && type !== 'checkbox' && type !== 'checkboxSet' && type !== 'color' && type !== 'disable';
};

/**
 * 获取编辑按钮文本
 */
const getEditButtonText = (type?: FieldType): string => {
  return type === 'popCheckboxSet' ? '多选框编辑' : '编辑';
};

/**
 * 操作按钮组件
 *
 * 根据字段类型和配置渲染操作按钮：
 * - 注释按钮：当 showComment 为 true 时显示
 * - 编辑按钮：根据字段类型决定是否显示
 * - 复制按钮：当字段类型为 disable 时显示
 */
export const ActionButtons: FC<ActionButtonsProps> = (props) => {
  const { testId, showComment, type, onCommentClick, onOpenExternalEditor, onCopyClick } = props;

  return (
    <>
      {/* 注释按钮 - 当有短注释时显示 */}
      {showComment && <button onClick={onCommentClick}>注释</button>}

      {/* 编辑按钮 - 根据类型决定是否显示 */}
      {shouldShowEditButton(type) && (
        <button data-test-id={testId} onClick={onOpenExternalEditor} className="editorTableEditBtn">
          {getEditButtonText(type)}
        </button>
      )}

      {/* 复制按钮 - 仅 disable 类型显示 */}
      {type === 'disable' && <button onClick={onCopyClick}>复制</button>}
    </>
  );
};
