import { Button, InputNumber, Modal, Spin } from 'antd';
import { ReactElement, useState } from 'react';
import { IPointSelectResult } from '../types';
import '../modal.css';

export interface IPointPickerModalProps {
  /** 是否打开弹窗 */
  readonly open: boolean;
  /** 弹窗标题 */
  readonly title: string;
  /** 打开时显示的初始 x 坐标；无初始值时为 undefined */
  readonly x?: number;
  /** 打开时显示的初始 y 坐标；无初始值时为 undefined */
  readonly y?: number;
  /** 是否正在加载候选坐标；为 true 时显示加载态 */
  readonly loading?: boolean;
  /** 加载失败的提示；存在时显示错误态 */
  readonly error?: string;
  /** 确认选中的坐标 */
  readonly onConfirm: (point: IPointSelectResult) => void;
  /** 取消选择 */
  readonly onCancel: () => void;
}

/**
 * 渲染弹窗主体：错误态优先于加载态，其次 2D 坐标输入区
 * @param props 弹窗 props
 * @param x 当前 x 坐标
 * @param y 当前 y 坐标
 * @param onXChange x 坐标变更回调
 * @param onYChange y 坐标变更回调
 * @returns 弹窗主体元素
 */
function renderBody(
  props: IPointPickerModalProps,
  x: number | null,
  y: number | null,
  onXChange: (value: number | null) => void,
  onYChange: (value: number | null) => void,
): ReactElement {
  if (props.error !== undefined) {
    return (
      <div className="eimodal-status eimodal-error" data-test-id="point-error">
        {props.error}
      </div>
    );
  }

  if (props.loading === true) {
    return (
      <div className="eimodal-status" data-test-id="point-loading">
        <Spin size="small" />
      </div>
    );
  }

  return (
    <div className="eimodal-coords" data-test-id="point-picker">
      <label className="eimodal-axis">
        <span className="eimodal-axis-label">x</span>
        <InputNumber size="small" value={x} onChange={onXChange} />
      </label>
      <label className="eimodal-axis">
        <span className="eimodal-axis-label">y</span>
        <InputNumber size="small" value={y} onChange={onYChange} />
      </label>
    </div>
  );
}

/**
 * 坐标选择弹窗：以 2D 坐标确认，取消时不返回结果
 * @param props 弹窗 props
 * @returns 坐标选择弹窗元素
 */
export function PointPickerModal(props: IPointPickerModalProps): ReactElement {
  const xState = useState<number | null>(props.x ?? null);
  const x = xState[0];
  const setX = xState[1];
  const yState = useState<number | null>(props.y ?? null);
  const y = yState[0];
  const setY = yState[1];

  return (
    <Modal
      open={props.open}
      title={props.title}
      onCancel={props.onCancel}
      footer={
        <div className="eimodal-footer">
          <Button size="small" autoInsertSpace={false} data-test-id="point-cancel" onClick={props.onCancel}>
            取消
          </Button>
          <Button
            size="small"
            type="primary"
            autoInsertSpace={false}
            data-test-id="point-confirm"
            onClick={(): void => props.onConfirm({ x: x ?? 0, y: y ?? 0 })}
          >
            确定
          </Button>
        </div>
      }
    >
      {renderBody(props, x, y, setX, setY)}
    </Modal>
  );
}
