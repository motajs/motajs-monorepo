import { useCallback, type ChangeEvent, type FC } from 'react';
import type { CheckboxInputProps } from '../../types';

/**
 * CheckboxInput 组件
 *
 * 渲染单个复选框，用于布尔值的编辑。
 */
export const CheckboxInput: FC<CheckboxInputProps> = (props) => {
  const { value, onChange, disabled = false } = props;

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.checked);
  }, [onChange]);

  return (
    <input
      type="checkbox"
      className="checkbox"
      checked={value}
      onChange={handleChange}
      disabled={disabled}
    />
  );
};
