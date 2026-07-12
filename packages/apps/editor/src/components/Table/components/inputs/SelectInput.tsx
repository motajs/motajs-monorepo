import { useCallback, type ChangeEvent, type FC } from 'react';
import type { SelectInputProps } from '../../types';

/**
 * SelectInput 组件
 *
 * 渲染下拉选择框，支持 options 配置。
 * 选项值会被 JSON 序列化后作为 option 的 value。
 */
export const SelectInput: FC<SelectInputProps> = (props) => {
  const { value, options, onChange, disabled = false } = props;

  // 将当前值序列化为字符串用于比较
  const currentValueStr = JSON.stringify(value);

  const handleChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
    const selectedValueStr = e.target.value;
    try {
      // 解析选中的 JSON 值
      const parsedValue = JSON.parse(selectedValueStr);
      onChange(parsedValue);
    } catch {
      // 解析失败时不做任何操作
    }
  }, [onChange]);

  return (
    <select
      value={currentValueStr}
      onChange={handleChange}
      disabled={disabled}
    >
      {options.map((option, index) => {
        const optionValueStr = JSON.stringify(option);
        // 显示文本：如果是字符串直接显示，否则显示 JSON 序列化结果
        const displayText = typeof option === 'string' ? option : optionValueStr;
        return (
          <option key={`${optionValueStr}-${index}`} value={optionValueStr}>
            {displayText}
          </option>
        );
      })}
    </select>
  );
};
