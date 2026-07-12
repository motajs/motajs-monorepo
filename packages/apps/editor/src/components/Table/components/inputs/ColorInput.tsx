import { useCallback, useMemo, type FC } from 'react';
import { ColorPicker, type ColorPickerProps } from 'antd';
import type { Color } from 'antd/es/color-picker';
import type { BaseInputProps } from '../../types';

/**
 * 颜色值类型
 * - [r, g, b] 其中 r, g, b 范围 0-255
 * - [r, g, b, a] 其中 r, g, b 范围 0-255，a 范围 0-1
 */
type ColorValue = [number, number, number] | [number, number, number, number];

/**
 * ColorInput 组件
 *
 * 使用 antd ColorPicker 渲染颜色选择器。
 * 值格式为 [r, g, b] 或 [r, g, b, a] 数组。
 */
export const ColorInput: FC<BaseInputProps> = (props) => {
  const { value, onChange, disabled = false } = props;

  // 将 [r, g, b, a?] 数组转换为 antd ColorPicker 的格式
  const colorValue = useMemo<ColorPickerProps['value']>(() => {
    if (!Array.isArray(value)) return undefined;
    const arr = value as number[];
    if (arr.length < 3) return undefined;

    const [r, g, b, a] = arr;
    return `rgba(${r}, ${g}, ${b}, ${a ?? 1})`;
  }, [value]);

  // 处理颜色变化
  const handleChange = useCallback((color: Color) => {
    // antd ColorPicker 的 Color 对象可以获取 rgb 值
    // 使用 toRgb() 方法获取 { r, g, b, a } 对象
    const rgb = color.toRgb();

    // 判断原始值是否有 alpha 通道
    const hasAlpha = Array.isArray(value) && (value as number[]).length === 4;

    if (hasAlpha || rgb.a !== 1) {
      // 有 alpha 通道或 alpha 不为 1 时，保留 alpha
      onChange([rgb.r, rgb.g, rgb.b, rgb.a] as ColorValue);
    } else {
      // 无 alpha 通道且 alpha 为 1，只保存 rgb
      onChange([rgb.r, rgb.g, rgb.b] as ColorValue);
    }
  }, [value, onChange]);

  return (
    <div>
      <ColorPicker
        value={colorValue}
        onChange={handleChange}
        disabled={disabled}
        size="small"
        showText
        format="rgb"
        disabledFormat
      />
    </div>
  );
};
