import { ColorPicker } from 'antd';
import { Color } from 'antd/es/color-picker';
import { ReactElement } from 'react';

export interface IColorInputProps {
  /** 当前值，形如 [r, g, b] 或 [r, g, b, a] */
  readonly value: unknown;
  /** 提交选中后的颜色数组 */
  readonly onChange: (value: readonly number[]) => void;
  /** 是否禁用 */
  readonly disabled?: boolean;
}

/**
 * 把颜色数组转换为 picker 可用的 css 颜色串
 * @param value 颜色数组
 * @returns css 颜色串；形状非法时为 undefined
 */
function toPickerColor(value: unknown): string | undefined {
  if (!Array.isArray(value) || value.length < 3) return undefined;

  const [r, g, b, a] = value;

  return `rgba(${r}, ${g}, ${b}, ${a ?? 1})`;
}

/**
 * 颜色控件：源值有四通道时保留 alpha，否则只回写三通道
 * @param props 控件 props
 * @returns 颜色选择器元素
 */
export function ColorInput(props: IColorInputProps): ReactElement {
  const hasAlpha = Array.isArray(props.value) && props.value.length === 4;

  return (
    <ColorPicker
      value={toPickerColor(props.value)}
      disabled={props.disabled}
      size="small"
      showText
      format="rgb"
      disabledFormat
      onChange={(color: Color): void => {
        const rgb = color.toRgb();

        if (hasAlpha) props.onChange([rgb.r, rgb.g, rgb.b, rgb.a]);
        else props.onChange([rgb.r, rgb.g, rgb.b]);
      }}
    />
  );
}
