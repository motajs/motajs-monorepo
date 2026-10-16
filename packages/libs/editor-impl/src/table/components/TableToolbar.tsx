import { Button } from 'antd';
import { ReactElement } from 'react';
import { TableEditMode } from '../types';
import { EditModeSegmented } from './EditModeSegmented';

export interface ITableToolbarProps {
  /** 当前编辑模式 */
  readonly mode: TableEditMode;
  /** 编辑模式变更回调 */
  readonly onModeChange: (mode: TableEditMode) => void;
  /** 可选的面板标题（资源名等），单行省略号并暴露 title */
  readonly title?: string;
  /** 是否显示「编辑 Schema」按钮；schema 目标下不显示 */
  readonly showSchemaButton: boolean;
  /** 「编辑 Schema」按钮是否可用 */
  readonly schemaButtonEnabled: boolean;
  /** 「编辑 Schema」点击回调 */
  readonly onOpenSchema: () => void;
  /** 「在代码编辑器中打开」按钮是否可用 */
  readonly codeButtonEnabled: boolean;
  /** 「在代码编辑器中打开」点击回调 */
  readonly onOpenInCodeEditor: () => void;
  /** ✕ 关闭本栏表格的点击回调；缺省时不显示 ✕ */
  readonly onCloseColumn?: () => void;
  /** ✕ 是否可点；缺省视作不可点 */
  readonly closeButtonEnabled?: boolean;
  /** 本栏是否有未落盘的改动；为真时显示「未保存」标记并启用「保存」 */
  readonly unsaved?: boolean;
  /** 「保存」按钮的点击回调 */
  readonly onSave?: () => void;
}

/**
 * 表格工具栏：编辑模式控件 + 可选 muted 标题 + 「编辑 Schema」主按钮 + 「在代码编辑器中打开」按钮 +
 * 可选 ✕ 关闭本栏按钮
 * @param props 工具栏 props
 * @returns 工具栏元素
 */
export function TableToolbar(props: ITableToolbarProps): ReactElement {
  const title = props.title;

  return (
    <div className="etable-toolbar">
      <EditModeSegmented value={props.mode} onChange={props.onModeChange} />
      {title === undefined ? (
        <span className="etable-toolbar-spacer" aria-hidden="true" />
      ) : (
        <>
          <span className="etable-toolbar-title" title={title}>
            {title}
          </span>
          <span className="etable-toolbar-divider" aria-hidden="true" />
        </>
      )}
      {props.showSchemaButton ? (
        <Button
          size="small"
          type="primary"
          autoInsertSpace={false}
          disabled={!props.schemaButtonEnabled}
          data-test-id="table-edit-schema"
          onClick={props.onOpenSchema}
        >
          编辑 Schema
        </Button>
      ) : null}
      <Button
        size="small"
        autoInsertSpace={false}
        disabled={!props.codeButtonEnabled}
        data-test-id="table-open-code"
        onClick={props.onOpenInCodeEditor}
      >
        在代码编辑器中打开
      </Button>
      {props.onCloseColumn === undefined ? null : (
        <Button
          size="small"
          autoInsertSpace={false}
          aria-label="关闭本栏表格"
          disabled={!props.closeButtonEnabled}
          data-test-id="table-close-column"
          onClick={props.onCloseColumn}
        >
          ✕
        </Button>
      )}
    </div>
  );
}
