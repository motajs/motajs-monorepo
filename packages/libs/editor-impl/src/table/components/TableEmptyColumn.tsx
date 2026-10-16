import { IFileEntry } from '@motajs/editor-core';
import { ITablePreset } from '../../react';
import { TableEmptyMode } from '../types';

// 空栏内联控件契约：把「当前内联视图 + 目录数据 + 预设表 + 各回调」聚到一处，
// 供表格面板某一栏在未设目标时渲染。

export interface ITableEmptyStateProps {
  /** 当前内联视图 */
  readonly mode: TableEmptyMode;
  /** 预设表清单；缺省时打开态不渲染预设区 */
  readonly presets?: readonly ITablePreset[];
  /** 当前目录路径；根目录为空串 */
  readonly directory: string;
  /** 该目录的直接子条目 */
  readonly entries: readonly IFileEntry[];
  /** 目录读取失败时的提示文案；缺省时不显示 */
  readonly error?: string;
  /** 切换内联视图，含「返回」到按钮态 */
  onModeChange(mode: TableEmptyMode): void;
  /** 进入某目录 */
  onNavigate(path: string): void;
  /** 在该栏内打开某数据表 */
  onOpen(dataPath: string): void;
  /** 在该栏内新建某表格 */
  onCreate(directory: string, name: string): void;
  /** 删除某表格；删除前由本组件二次确认 */
  onDelete(dataPath: string): void;
}
