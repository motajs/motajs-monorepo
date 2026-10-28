import { Store } from '@tanstack/store';
import { IEditorPanel, IEditorPanelType, IFileEntry } from '@motajs/editor-core';

// 文件资源管理器：只做浏览 + 打开，不提供新建 / 重命名 / 删除 / 移动 / 预览（D-23 / D-30）。
// 过滤隐藏以 `.` 开头的路径段，但索引照常收录 `.editor`；目录级的隐藏必须由面板的
// `IFileExplorerPanel.loadChildren` 完成——共用浏览器规定「目录永不受过滤」，`filterPath` 挡不住目录行（D-24）。

export interface IFileExplorerCapabilities {
  /** 列出当前已注册的面板类型；由宿主在创建面板类型时注入，core 不因此扩大面板上下文（D-29） */
  readonly listPanelTypes: () => readonly IEditorPanelType[];

  /** 新开一个标签并打开指定面板类型；返回 false 表示打开失败，面板据此关掉刚开的空白标签 */
  readonly openPanel: (typeId: string, openParam: Record<string, unknown>) => Promise<boolean>;
}

export interface IFileExplorerPanel extends IEditorPanel {
  /**
   * 打开一个文件路径：视图点击文件行时调用，内部求候选并打开
   * @param path 来自索引的规范化相对路径
   */
  openPath(path: string): Promise<void>;

  /**
   * 读取某目录的直接子条目：视图的读目录入口，必须在此层剔除名字以 `.` 开头的目录与文件
   * @param path 目录路径；根目录为空串
   * @returns 该目录的直接子条目
   */
  loadChildren(path: string): Promise<readonly IFileEntry[]>;

  /**
   * 文件行是否显示：无点开头的路径段，且存在能打开它的面板类型
   * @param path 文件的规范化相对路径
   * @returns 显示时为 true
   */
  filterPath(path: string): boolean;

  /**
   * 候选弹窗选中某一面板类型时调用；必须同时清空待打开路径与候选列表，否则弹窗会原地复活
   * @param typeId 选中的面板类型标识
   */
  selectCandidate(typeId: string): void;

  /**
   * 候选弹窗点「取消」时调用；与 `IFileExplorerPanel.selectCandidate` 一样要清空待打开路径与候选列表
   */
  cancelCandidate(): void;
}

export interface IFileExplorerViewState {
  /** 当前浏览的目录；根目录为空串 */
  readonly directory: string;

  /** 外部刷新令牌；变化时浏览器重读当前目录 */
  readonly reloadToken: number;

  /** 正在等用户选面板类型的文件路径；没有待决选择时为 undefined */
  readonly pendingPath?: string;

  /** 候选面板类型标识；只有候选 ≥ 2 时才弹窗（D-27） */
  readonly candidateTypeIds?: readonly string[];

  /** 读取或打开失败时的提示文案；无错误时为 undefined */
  readonly error?: string;
}

export interface IFileExplorerViewProps {
  /** 面板发布的视图快照；视图用 `useStore` 订阅，不自己持有目录状态 */
  readonly store: Store<IFileExplorerViewState>;

  /** 已注册面板类型的全集；由面板从宿主能力取得，视图只在候选 ≥ 2 时筛出弹窗要显示的那些 */
  readonly candidates: readonly IEditorPanelType[];

  /** 读目录：由面板提供（内部剔除点开头的路径段，并走索引） */
  readonly loadChildren: (path: string) => Promise<readonly IFileEntry[]>;

  /** 文件行过滤：由面板提供，目录行不经过它 */
  readonly filterPath: (path: string) => boolean;

  /** 点击文件行：由面板提供，内部求候选并打开 */
  readonly onOpen: (path: string) => void;

  /** 候选弹窗选中某一面板类型 */
  readonly onSelectCandidate: (typeId: string) => void;

  /** 候选弹窗取消 */
  readonly onCancelCandidate: () => void;
}

export interface IPanelCandidateModalProps {
  /** 要打开的文件完整路径；只用于展示「文件：…」一行与行内 title */
  readonly path: string;

  /** 候选面板类型；候选名称与图标只从这里读，弹窗不查注册表 */
  readonly candidates: readonly IEditorPanelType[];

  /** 选中某个面板类型 */
  readonly onSelect: (typeId: string) => void;

  /** 取消选择 */
  readonly onCancel: () => void;
}
