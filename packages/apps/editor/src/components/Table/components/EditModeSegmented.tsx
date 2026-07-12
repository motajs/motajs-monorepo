/**
 * EditModeSegmented - 编辑模式切换组件
 *
 * Table 的附属组件，用于切换编辑/添加/删除模式。
 * 可复用于任何需要 Table 编辑模式控制的场景。
 */

import type { FC } from 'react';
import { Segmented } from 'antd';
import type { EditMode } from '../types';

export interface EditModeSegmentedProps {
  /** 当前编辑模式 */
  value: EditMode;
  /** 模式变更回调 */
  onChange: (mode: EditMode) => void;
  /** 组件尺寸 */
  size?: 'small' | 'middle' | 'large';
  testId?: string;
}

/** 默认的模式选项配置 */
const MODE_OPTIONS = [
  { label: '编辑', value: 'change' as const },
  { label: '添加', value: 'add' as const },
  { label: '删除', value: 'delete' as const },
];

export const EditModeSegmented: FC<EditModeSegmentedProps> = (props) => {
  const { value, onChange, size = 'small', testId = 'table-edit-mode' } = props;

  return (
    <Segmented
      size={size}
      data-test-id={testId}
      value={value}
      onChange={(v) => onChange(v as EditMode)}
      options={MODE_OPTIONS}
    />
  );
};
