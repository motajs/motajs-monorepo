import { useCallback, useMemo, type ChangeEvent, type FC } from 'react';
import type { CheckboxSetProps } from '../../types';

/**
 * CheckboxSet 组件
 *
 * 渲染复选框组，用于多选值的编辑。
 * 支持 keys 和 prefixStrings 配置，以及动态添加未知选项。
 *
 * 值格式：数组，包含选中的 key 值
 * 例如：[1, 'option2', 3]
 */
export const CheckboxSet: FC<CheckboxSetProps> = (props) => {
  const { value, onChange, disabled = false, keys, prefixStrings } = props;

  // 规范化 value 为数组
  const normalizedValue = useMemo((): (string | number)[] => {
    if (value == null) return [];
    if (!Array.isArray(value)) {
      // 如果值为 0，视为空数组；否则包装为单元素数组
      if (value === 0) return [];
      return [value as string | number];
    }
    return value as (string | number)[];
  }, [value]);

  // 合并已知选项和未知选项（值中存在但 keys 中不存在的选项）
  const { mergedKeys, mergedPrefixes } = useMemo(() => {
    const resultKeys = [...keys];
    const resultPrefixes = [...prefixStrings];

    // 检查 value 中是否有 keys 中不存在的选项
    for (const item of normalizedValue) {
      if (!resultKeys.includes(item)) {
        resultKeys.push(item);
        // 为未知选项添加前缀标签，格式为换行 + key + ': '
        resultPrefixes.push(`${item}: `);
      }
    }

    return { mergedKeys: resultKeys, mergedPrefixes: resultPrefixes };
  }, [keys, prefixStrings, normalizedValue]);

  // 处理单个复选框变化
  const handleCheckboxChange = useCallback(
    (key: string | number, checked: boolean) => {
      let newValue: (string | number)[];

      if (checked) {
        // 添加选中的 key
        newValue = [...normalizedValue, key];
      } else {
        // 移除取消选中的 key
        newValue = normalizedValue.filter((v) => v !== key);
      }

      onChange(newValue);
    },
    [normalizedValue, onChange],
  );

  return (
    <div className="checkboxSet">
      {mergedKeys.map((key, index) => {
        const isChecked = normalizedValue.includes(key);
        const prefix = mergedPrefixes[index] || '';
        // 判断是否为动态添加的未知选项（需要换行显示）
        const isUnknownOption = index >= keys.length;

        return (
          <CheckboxSetMember
            key={`${key}-${index}`}
            itemKey={key}
            checked={isChecked}
            prefix={prefix}
            disabled={disabled}
            isUnknownOption={isUnknownOption}
            onChange={handleCheckboxChange}
          />
        );
      })}
    </div>
  );
};

/** CheckboxSetMember 组件的 Props */
interface CheckboxSetMemberProps {
  /** 选项的 key 值 */
  itemKey: string | number;
  /** 是否选中 */
  checked: boolean;
  /** 前缀标签文本 */
  prefix: string;
  /** 是否禁用 */
  disabled: boolean;
  /** 是否为动态添加的未知选项 */
  isUnknownOption: boolean;
  /** 变化回调 */
  onChange: (key: string | number, checked: boolean) => void;
}

/**
 * CheckboxSetMember 组件
 *
 * 渲染复选框组中的单个复选框成员。
 */
const CheckboxSetMember: FC<CheckboxSetMemberProps> = (props) => {
  const { itemKey, checked, prefix, disabled, isUnknownOption, onChange } = props;

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onChange(itemKey, e.target.checked);
    },
    [itemKey, onChange],
  );

  return (
    <>
      {isUnknownOption && <br />}
      {prefix}
      <input
        type="checkbox"
        className="checkboxSetMember"
        checked={checked}
        disabled={disabled}
        onChange={handleChange}
        data-key={itemKey}
        data-ctype={typeof itemKey}
      />
    </>
  );
};
