import { IFileEntry } from '@motajs/editor-core';
import { ReactNode } from 'react';

// 单目录列表 + 面包屑的共用文件浏览器：组件只渲染，不碰文件系统。
// 目录状态由组件自持，面板只提供「读目录 / 过滤 / 打开」三项输入（D-24）。

export interface IFileBrowserProps {
  /** 起始目录路径；根目录为空串 */
  readonly directory: string;

  /** 读取某目录的直接子条目；组件不接触文件系统，只调用面板给的回调 */
  readonly loadChildren: (path: string) => Promise<readonly IFileEntry[]>;

  /** 文件行是否显示；目录行永不受此过滤 */
  readonly filter?: (path: string) => boolean;

  /** 点击文件行时调用 */
  readonly onOpen: (path: string) => void;

  /** `data-test-id` 前缀；缺省 `file-browser`，表格传 `table-list`、资源管理器传 `explorer` */
  readonly testIdPrefix?: string;

  /** 空目录提示文案；缺省「该目录下没有文件」 */
  readonly emptyText?: string;

  /** 目录读取失败时的提示文案；缺省「目录读取失败，请稍后重试。」 */
  readonly errorText?: string;

  /** 文件行右侧的附加内容（表格删除态用）；缺省不渲染 */
  readonly renderRowAction?: (entry: IFileEntry) => ReactNode;

  /** 外部刷新令牌；变化时重读当前目录 */
  readonly reloadToken?: number;
}
