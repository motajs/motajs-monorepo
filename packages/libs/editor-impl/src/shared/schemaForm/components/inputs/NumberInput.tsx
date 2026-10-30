import { InputNumber } from 'antd';
import { ReactElement } from 'react';

export interface INumberInputProps {
  /** 当前值；非数字时按空值呈现 */
  readonly value: unknown;
  /**
   * 提交改动后的数字；清空时为 null
   *
   * 只在「输入框失焦、按下回车、或值被清空」这三种确认动作之后各触发一次，不再随每次按键触发；
   * 未确认期间输入内容只活在控件本地，不改动上层内容
   */
  readonly onChange: (value: number | null) => void;
  /** 是否禁用 */
  readonly disabled?: boolean;
}

/**
 * 数字输入控件：包装 antd `InputNumber`，用于数字字段的单行数字编辑
 *
 * 本控件与文本域共用同一套「确认后才提交」的语义：失焦 / 回车 / 清空时才提交一次，
 * 未确认的输入只活在控件本地
 * @param props 控件 props
 * @returns 数字输入元素
 */
export function NumberInput(props: INumberInputProps): ReactElement {
  const value = typeof props.value === 'number' ? props.value : undefined;

  return (
    <InputNumber
      size="small"
      className="etable-input-number"
      value={value}
      disabled={props.disabled}
      onChange={(next): void => props.onChange(next)}
    />
  );
}
