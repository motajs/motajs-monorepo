import { Checkbox } from 'antd';
import { ReactElement } from 'react';

export interface ICheckboxSetProps {
  /** 当前值，规范化为成员数组 */
  readonly value: unknown;
  /** 可选成员，来自数组 schema 的 items */
  readonly keys: readonly (string | number)[];
  /** 每个成员的前缀标签 */
  readonly prefixStrings: readonly string[];
  /** 提交更新后的成员数组 */
  readonly onChange: (value: readonly (string | number)[]) => void;
  /** 是否禁用 */
  readonly disabled?: boolean;
}

/**
 * 把字段值规范化为成员数组
 * @param value 字段值
 * @returns 成员数组；空值或非法形状时为空数组
 */
function normalizeMembers(value: unknown): (string | number)[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value as (string | number)[];
  return [value as string | number];
}

/**
 * 多选框组控件：成员来自 items，值中出现但不在 items 中的成员被保留为额外一项
 * @param props 控件 props
 * @returns 多选框组元素
 */
export function CheckboxSet(props: ICheckboxSetProps): ReactElement {
  const current = normalizeMembers(props.value);
  const keys = [...props.keys];
  const prefixes = [...props.prefixStrings];

  for (const member of current) {
    if (keys.includes(member)) continue;

    keys.push(member);
    prefixes.push(`${member}: `);
  }

  return (
    <div className="etable-input-checkbox-set">
      {keys.map((key, index) => (
        <Checkbox
          key={`${key}-${index}`}
          checked={current.includes(key)}
          disabled={props.disabled}
          onChange={(event): void => {
            const next = event.target.checked ? [...current, key] : current.filter((member) => member !== key);

            props.onChange(next);
          }}
        >
          {prefixes[index]}
        </Checkbox>
      ))}
    </div>
  );
}
