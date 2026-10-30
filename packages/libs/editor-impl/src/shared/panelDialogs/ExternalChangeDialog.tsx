import { Button, Modal } from 'antd';
import { ReactElement } from 'react';
import { IExternalChangeDialogProps } from './types';
import './panel-dialogs.css';

// 外部变化冲突弹窗：两个选项都会产生后果，因此没有主按钮、没有取消按钮、Esc 不关闭，
// 用户必须显式选择；弹窗自身不执行动作，只把选择交回面板（D-17）。
// 两个动作名的文案可由调用方替换：表格面板传定稿文案，地图 / 素材不传、保持默认那一套（D-21）。

/** 「要编辑器这一份」按钮的默认文案 */
const DEFAULT_KEEP_LABEL = '保留我的改动，下次保存覆盖';

/** 「要外部那一份」按钮的默认文案 */
const DEFAULT_DISCARD_LABEL = '放弃我的改动并刷新';

/** 正文下方补充说明的默认文案 */
const DEFAULT_NOTE_TEXT = '刷新会丢弃你的改动；保留则下次保存会覆盖外部内容。';

/**
 * 外部变化冲突弹窗
 * @param props 弹窗的展示态、两个选项的可选文案与两个选项回调
 * @returns 冲突弹窗元素
 */
export function ExternalChangeDialog(props: IExternalChangeDialogProps): ReactElement {
  return (
    <Modal
      open={props.open}
      title="文件已被外部修改"
      width={480}
      style={{ maxWidth: 'calc(100vw - 32px)' }}
      closable={false}
      maskClosable={false}
      keyboard={false}
      footer={
        <div className="eimodal-footer">
          <Button
            size="small"
            danger
            autoInsertSpace={false}
            data-test-id="panel-conflict-discard"
            onClick={props.onDiscard}
          >
            {props.discardLabel ?? DEFAULT_DISCARD_LABEL}
          </Button>
          <Button size="small" autoInsertSpace={false} data-test-id="panel-conflict-keep" onClick={props.onKeep}>
            {props.keepLabel ?? DEFAULT_KEEP_LABEL}
          </Button>
        </div>
      }
    >
      <div data-test-id="panel-conflict-dialog">
        <div className="edlg-text">这个文件在编辑器之外被修改了，你还有未保存的改动。</div>
        <div className="edlg-note">{props.noteText ?? DEFAULT_NOTE_TEXT}</div>
      </div>
    </Modal>
  );
}
