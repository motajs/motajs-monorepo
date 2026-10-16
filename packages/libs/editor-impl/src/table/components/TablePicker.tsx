import { IFileEntry } from '@motajs/editor-core';
import { ITablePreset } from '../../react';

// 可复用的表格浏览器契约：可选预设表 + 项目目录树。
// 「打开表格」（注入预设）与「删除表格」（不注入预设）共用同一组 props，唯一差异是 presets 是否传入。

export interface ITablePickerProps {
  /** 预设表清单；缺省或无项时不渲染预设区，这是打开态与删除态的唯一差异 */
  readonly presets?: readonly ITablePreset[];
  /** 当前目录路径；根目录为空串 */
  readonly directory: string;
  /** 该目录的直接子条目 */
  readonly entries: readonly IFileEntry[];
  /** 目录读取失败时的提示文案；缺省时不显示 */
  readonly error?: string;
  /** 为真时每个数据文件行渲染删除入口；删除态用 */
  readonly deletable?: boolean;
  /** 进入某目录 */
  onNavigate(path: string): void;
  /** 打开某数据表；打开态的数据文件行点击，删除态传空操作满足此必填契约 */
  onSelect(dataPath: string): void;
  /** 请求删除某数据表；删除态用，缺省时数据文件行不渲染删除入口 */
  onRequestDelete?(dataPath: string): void;
}
