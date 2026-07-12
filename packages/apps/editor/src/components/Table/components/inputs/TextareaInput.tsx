import { useCallback, useState, useEffect, type ChangeEvent, type FC } from 'react';
import type { TextareaInputProps } from '../../types';

/**
 * TextareaInput 组件
 *
 * 用于显示和编辑 JSON 值的文本域输入组件。
 * 支持 JSON 格式化显示、缩进配置、禁用和只读状态。
 */
export const TextareaInput: FC<TextareaInputProps> = (props) => {
  const { value, onChange, indent = 0, disabled = false, readonly = false } = props;

  // 将值序列化为 JSON 字符串用于显示
  const [displayValue, setDisplayValue] = useState(() =>
    JSON.stringify(value, null, indent)
  );

  // 当外部 value 变化时，更新显示值
  useEffect(() => {
    setDisplayValue(JSON.stringify(value, null, indent));
  }, [value, indent]);

  const handleChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    const newDisplayValue = e.target.value;
    setDisplayValue(newDisplayValue);
  }, []);

  const handleBlur = useCallback(() => {
    try {
      // 尝试解析 JSON
      const parsedValue = JSON.parse(displayValue);
      onChange(parsedValue);
    } catch {
      // 解析失败时，恢复为原始值
      setDisplayValue(JSON.stringify(value, null, indent));
    }
  }, [displayValue, onChange, value, indent]);

  return (
    <textarea
      spellCheck={false}
      disabled={disabled}
      readOnly={readonly}
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
};
