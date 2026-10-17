import { Button } from 'antd';
import { ReactElement } from 'react';
import { TableControlKind, TableExternalEditor } from '../types';

export interface IActionButtonsProps {
  /** 字段描述；存在时显示注释动作并在 title 中暴露全文 */
  readonly description?: string;
  /** 字段使用的外部编辑器；存在时显示编辑动作 */
  readonly externalEditor?: TableExternalEditor;
  /** 字段推导出的行内控件种类 */
  readonly controlKind: TableControlKind;
  /** 字段是否只读；只读时显示复制动作 */
  readonly readOnly: boolean;
  /** 字段当前值的文本形式，作为复制动作的 title 预览 */
  readonly value: string;
  /** 编辑动作是否可用；不可用时禁用并提示 */
  readonly editEnabled: boolean;
  /** 编辑动作不可用时的提示文案 */
  readonly editDisabledHint?: string;
  /** 复制动作是否可用；不可用时禁用并提示 */
  readonly copyEnabled: boolean;
  /** 复制动作不可用时的提示文案 */
  readonly copyDisabledHint?: string;
  /** 注释动作点击回调 */
  readonly onCommentClick: () => void;
  /** 编辑动作点击回调 */
  readonly onEditClick: () => void;
  /** 复制动作点击回调 */
  readonly onCopyClick: () => void;
}

/**
 * 取编辑动作的按钮文案：外部多选显示「多选框编辑」，其余显示「编辑」
 * @param editor 字段使用的外部编辑器种类
 * @returns 编辑动作按钮文案
 */
function editButtonText(editor: TableExternalEditor): string {
  return editor === TableExternalEditor.MultiSelect ? '多选框编辑' : '编辑';
}

/**
 * 操作列按钮：按字段的 `description` / `x-editor` / `readOnly` 显示注释 / 编辑 / 复制动作
 *
 * 只渲染动作按钮，不触达任何能力；能力缺失时的禁用与提示由上层经 `editEnabled` / `copyEnabled`
 * 传入。所有可见文本均为 React 文本节点，绝不注入原始 HTML。
 * @param props 操作按钮 props
 * @returns 操作按钮组元素
 */
export function ActionButtons(props: IActionButtonsProps): ReactElement {
  const title = props.description;

  return (
    <div className="etable-actions">
      {title === undefined ? null : (
        <Button
          size="small"
          type="text"
          autoInsertSpace={false}
          title={title}
          aria-label="注释"
          onClick={props.onCommentClick}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M2 3.5A1.5 1.5 0 0 1 3.5 2h9A1.5 1.5 0 0 1 14 3.5v6A1.5 1.5 0 0 1 12.5 11H8l-3.5 3v-3H3.5A1.5 1.5 0 0 1 2 9.5z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
            />
          </svg>
        </Button>
      )}
      {props.externalEditor === undefined ? null : (
        <Button
          size="small"
          type="text"
          autoInsertSpace={false}
          disabled={!props.editEnabled}
          title={props.editEnabled ? undefined : props.editDisabledHint}
          onClick={props.onEditClick}
        >
          {editButtonText(props.externalEditor)}
        </Button>
      )}
      {props.readOnly ? (
        <Button
          size="small"
          type="text"
          autoInsertSpace={false}
          disabled={!props.copyEnabled}
          title={props.copyEnabled ? props.value : props.copyDisabledHint}
          onClick={props.onCopyClick}
        >
          复制
        </Button>
      ) : null}
    </div>
  );
}
