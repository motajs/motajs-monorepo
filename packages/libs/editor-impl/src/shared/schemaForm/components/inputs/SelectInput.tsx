import { Select } from 'antd';
import { ReactElement } from 'react';
import { IEnumTitleMap } from '../../types';

export interface ISelectInputProps {
  /** 当前值 */
  readonly value: unknown;
  /** 可选项目，来自字段 schema 的 enum */
  readonly options: readonly unknown[];
  /** 提交选中的选项 */
  readonly onChange: (value: unknown) => void;
  /** 是否禁用 */
  readonly disabled?: boolean;
  /** 枚举值 → 显示标签的映射；缺省时显示原值 */
  readonly titles?: IEnumTitleMap;
}

/**
 * 取标签映射的键：字符串原样，其余用 `String`（数字 `0` 的键是 `"0"`）
 * @param option 选项值
 * @returns 标签映射使用的字符串键
 */
function enumTitleKey(option: unknown): string {
  return typeof option === 'string' ? option : String(option);
}

/**
 * 取选项的显示文本：标签映射命中时用标签，否则字符串原样、其余用 JSON 文本
 * @param option 选项值
 * @param titles 枚举值 → 显示标签的映射；缺省时显示原值
 * @returns 选项显示文本
 */
function optionLabel(option: unknown, titles: IEnumTitleMap | undefined): string {
  const title = titles === undefined ? undefined : titles[enumTitleKey(option)];

  if (title !== undefined) return title;

  return typeof option === 'string' ? option : (JSON.stringify(option) ?? String(option));
}

/**
 * 下拉选择控件：选项来自字段的 enum，选中后提交解析后的值
 * @param props 控件 props
 * @returns 下拉元素
 */
export function SelectInput(props: ISelectInputProps): ReactElement {
  const options = props.options.map((option) => ({
    value: JSON.stringify(option) ?? String(option),
    label: optionLabel(option, props.titles),
  }));

  return (
    <Select
      size="small"
      className="etable-input-select"
      value={JSON.stringify(props.value) ?? String(props.value)}
      options={options}
      disabled={props.disabled}
      virtual={false}
      onChange={(text: string): void => {
        try {
          props.onChange(JSON.parse(text));
        } catch {
          // 选项值始终是我们自己写入的合法 JSON 文本，解析失败时不提交
        }
      }}
    />
  );
}
