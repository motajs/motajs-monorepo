import { Checkbox } from 'antd';
import { ReactElement } from 'react';

export interface ICheckboxInputProps {
  /** 当前布尔值 */
  readonly value: boolean;
  /** 提交切换后的布尔值 */
  readonly onChange: (value: boolean) => void;
  /** 是否禁用 */
  readonly disabled?: boolean;
}

/**
 * 复选框控件：用于布尔值字段，切换后提交布尔结果
 * @param props 控件 props
 * @returns 复选框元素
 */
export function CheckboxInput(props: ICheckboxInputProps): ReactElement {
  return (
    <Checkbox
      checked={props.value}
      disabled={props.disabled}
      onChange={(event): void => props.onChange(event.target.checked)}
    />
  );
}
