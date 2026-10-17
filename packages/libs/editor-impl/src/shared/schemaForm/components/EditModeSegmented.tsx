import { Segmented } from 'antd';
import { ReactElement } from 'react';
import { TableEditMode } from '../types';

export interface IEditModeSegmentedProps {
  /** 当前编辑模式 */
  readonly value: TableEditMode;
  /** 模式变更回调 */
  readonly onChange: (mode: TableEditMode) => void;
}

/**
 * 编辑模式分段控件：编辑 / 添加 / 删除，映射到对应的编辑模式枚举
 * @param props 控件 props
 * @returns 分段控件元素
 */
export function EditModeSegmented(props: IEditModeSegmentedProps): ReactElement {
  const options = [
    { label: '编辑', value: TableEditMode.Change },
    { label: '添加', value: TableEditMode.Add },
    { label: '删除', value: TableEditMode.Delete },
  ];

  return (
    <Segmented
      size="small"
      data-test-id="table-edit-mode"
      value={props.value}
      options={options}
      onChange={(value): void => {
        const found = options.find((option) => option.value === Number(value));

        if (found !== undefined) props.onChange(found.value);
      }}
    />
  );
}
