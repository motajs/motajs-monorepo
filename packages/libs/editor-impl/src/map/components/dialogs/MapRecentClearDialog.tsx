import { Button, Modal } from 'antd';
import { ReactElement } from 'react';

// 清除最近使用记录的破坏性确认弹窗：受控打开，只有「清除记录」与「取消」两个动作。
// 弹窗不自己判断能不能清，确认后由调用方决定。

export interface IMapRecentClearDialogProps {
  /** 是否打开确认弹窗 */
  readonly open: boolean;
  /** 确认清除最近使用记录 */
  onConfirm(): void;
  /** 取消清除，保持记录不变 */
  onCancel(): void;
}

/**
 * 清除最近使用记录的确认弹窗
 * @param props 弹窗 props
 * @returns 确认弹窗元素
 */
export function MapRecentClearDialog(props: IMapRecentClearDialogProps): ReactElement | null {
  if (!props.open) return null;

  return (
    <Modal
      open
      title="清除最近使用的图块？"
      width={360}
      closable={false}
      maskClosable={false}
      keyboard={false}
      onCancel={props.onCancel}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button size="small" autoInsertSpace={false} data-test-id="map-recent-clear-cancel" onClick={props.onCancel}>
            取消
          </Button>
          <Button
            size="small"
            danger
            type="primary"
            autoInsertSpace={false}
            data-test-id="map-recent-clear-confirm"
            onClick={props.onConfirm}
          >
            清除记录
          </Button>
        </div>
      }
    >
      <div data-test-id="map-recent-clear-dialog">将清空本项目的最近使用记录，此操作不可撤销。</div>
    </Modal>
  );
}
