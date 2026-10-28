import { PanelCloseChoice } from '@motajs/editor-core';
import { Button, Modal, Spin } from 'antd';
import { ReactElement } from 'react';
import { IPanelCloseDialogProps } from './types';
import './panel-dialogs.css';

// 关闭三态确认框：只按 props 渲染「取消 / 不保存关闭 / 保存并关闭」三个选择，
// 以及保存中与保存失败两种展示态。组件不判断脏、不调保存、不读资源，
// 选择结果一律经 onChoose 交回面板（D-08 / D-09 / D-10）。

/**
 * 关闭三态确认框
 * @param props 弹窗的展示态与选择回调
 * @returns 关闭确认弹窗元素
 */
export function PanelCloseDialog(props: IPanelCloseDialogProps): ReactElement {
  const saving = props.saving === true;

  return (
    <Modal
      open={props.open}
      title="有未保存的改动"
      width={420}
      style={{ maxWidth: 'calc(100vw - 32px)' }}
      closable={false}
      maskClosable={false}
      keyboard
      onCancel={(): void => {
        if (saving) return;

        props.onChoose(PanelCloseChoice.Cancel);
      }}
      footer={
        <div className="edlg-footer">
          {props.error === undefined ? null : (
            <div className="eimodal-error edlg-error" data-test-id="panel-close-error">
              保存失败：{props.error}
            </div>
          )}
          <div className="eimodal-footer">
            <Button
              size="small"
              autoInsertSpace={false}
              disabled={saving}
              data-test-id="panel-close-cancel"
              onClick={(): void => props.onChoose(PanelCloseChoice.Cancel)}
            >
              取消
            </Button>
            <Button
              size="small"
              danger
              autoInsertSpace={false}
              disabled={saving}
              data-test-id="panel-close-discard"
              onClick={(): void => props.onChoose(PanelCloseChoice.Discard)}
            >
              不保存关闭
            </Button>
            <Button
              size="small"
              type="primary"
              autoInsertSpace={false}
              disabled={saving}
              data-test-id="panel-close-save"
              onClick={(): void => props.onChoose(PanelCloseChoice.Save)}
            >
              {saving ? (
                <>
                  <Spin size="small" />
                  正在保存…
                </>
              ) : (
                '保存并关闭'
              )}
            </Button>
          </div>
        </div>
      }
    >
      <div data-test-id="panel-close-dialog">
        <div className="edlg-text">当前面板还有未保存的改动。关闭前要保存吗？</div>
      </div>
    </Modal>
  );
}
