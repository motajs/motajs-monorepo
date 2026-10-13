import { InputNumber } from 'antd';
import { ReactElement } from 'react';

export interface INumberInputProps {
  /** 当前值；非数字时按空值呈现 */
  readonly value: unknown;
  /** 提交改动后的数字；清空时为 null */
  readonly onChange: (value: number | null) => void;
  /** 是否禁用 */
  readonly disabled?: boolean;
}

/**
 * 数字输入控件：包装 antd `InputNumber`，用于数字字段的单行数字编辑
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
