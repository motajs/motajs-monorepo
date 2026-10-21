import { Button, Modal, Spin } from 'antd';
import { ReactElement } from 'react';
import { MapUnsavedChoice } from '../../types';

// 未保存确认弹窗：正文是固定短文案，只有三个动作。
// 三个按钮不做任何判断，只把「用户按了哪个」交给 MapPanel.resolveUnsavedDecision；结算与继续由面板负责。

export interface IMapUnsavedDialogProps {
  /** 是否打开弹窗 */
  readonly open: boolean;
  /** 是否正在保存；保存中三个按钮都禁用 */
  readonly saving: boolean;
  /** 保存失败的原因；没有失败时为 undefined */
  readonly saveError?: string;
  /**
   * 把用户选择的动作交给面板
   * @param choice 用户按下的按钮
   */
  onUnsavedDecision(choice: MapUnsavedChoice): void;
}

/**
 * 未保存确认弹窗：保存并继续 / 放弃改动 / 取消
 * @param props 弹窗 props
 * @returns 未保存确认弹窗元素
 */
export function MapUnsavedDialog(props: IMapUnsavedDialogProps): ReactElement {
  return (
    <Modal
      open={props.open}
      title="有未保存的改动"
      width={420}
      closable={false}
      maskClosable={false}
      keyboard={false}
      onCancel={(): void => props.onUnsavedDecision(MapUnsavedChoice.Cancel)}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button
            size="small"
            autoInsertSpace={false}
            autoFocus
            disabled={props.saving}
            data-test-id="map-unsaved-cancel"
            onClick={(): void => props.onUnsavedDecision(MapUnsavedChoice.Cancel)}
          >
            取消
          </Button>
          <Button
            size="small"
            danger
            autoInsertSpace={false}
            disabled={props.saving}
            data-test-id="map-unsaved-discard"
            onClick={(): void => props.onUnsavedDecision(MapUnsavedChoice.Discard)}
          >
            放弃改动
          </Button>
          <Button
            size="small"
            type="primary"
            autoInsertSpace={false}
            disabled={props.saving}
            data-test-id="map-unsaved-save"
            onClick={(): void => props.onUnsavedDecision(MapUnsavedChoice.SaveAndContinue)}
          >
            保存并继续
          </Button>
        </div>
      }
    >
      <div data-test-id="map-unsaved-dialog" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span>当前地图还有未保存的改动。要先保存吗？</span>
        {props.saveError === undefined ? null : (
          <span data-test-id="map-unsaved-error" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            保存失败：{props.saveError}
          </span>
        )}
        {props.saving ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }} data-test-id="map-unsaved-saving">
            <Spin size="small" />
            正在保存…
          </span>
        ) : null}
      </div>
    </Modal>
  );
}
