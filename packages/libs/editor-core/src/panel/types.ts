import { FC, ReactNode } from 'react';
import { EditorFileChangeKind } from '../fs';
import { IUndoable, IUndoContext } from '../undo';
import { IFileEntry, IResource, IResourceIdentifier, PendingChangeListener, ResourceContent } from '../resource';

export const enum PanelCloseChoice {
  /** 保存并关闭：面板已保存成功，外壳跳过普通切走落盘 */
  Save,
  /** 不保存关闭：外壳先投递 `IEditorPanel.onDiscard`，再跳过落盘释放 */
  Discard,
  /** 取消关闭：标签保持打开 */
  Cancel,
}

/**
 * 面板请求外壳把「已经把这条路径开在手里」的标签切成活动标签
 *
 * 同步返回：真表示有别的标签持有该路径、切换已经发起（不等待完成）；假表示没有别的标签持有它。
 */
export type ResourceTabFocuser = (identifier: IResourceIdentifier) => boolean;

/**
 * 面板把「这个标签当前显示的全部路径」上报给外壳的函数类型
 *
 * 外壳把它当作该标签的去重登记：整份替换、不合并；空数组表示不再显示任何资源。
 */
export type ResourcePathReporter = (identifiers: readonly IResourceIdentifier[]) => void;

export interface IEditorPanelContext {
  /**
   * 请求指定资源
   * @param identifier 资源标识（纯路径）
   * @returns 资源句柄；资源不存在时为 null
   */
  requestResource(identifier: IResourceIdentifier): Promise<IResource | null>;

  /**
   * 创建新的资源
   * @param identifier 资源标识（纯路径）
   * @param content 资源的初始内容
   * @returns 新建的资源句柄；创建失败时为 null
   */
  createResource(identifier: IResourceIdentifier, content: ResourceContent): Promise<IResource | null>;

  /**
   * 删除指定资源
   * @param identifier 资源标识（纯路径）
   */
  deleteResource(identifier: IResourceIdentifier): Promise<void>;

  /**
   * 移动（改名）指定资源
   * @param source 源路径
   * @param destination 目标路径
   */
  moveResource(source: IResourceIdentifier, destination: IResourceIdentifier): Promise<void>;

  /**
   * 列出指定目录下的直接子条目
   * @param path 目录路径
   * @returns 目录下的直接子条目列表
   */
  listDirectory(path: string): Promise<readonly IFileEntry[]>;

  /**
   * 把指定路径的待写内容立刻写进磁盘
   *
   * 面板的保存按钮用它把本栏的待写内容写到磁盘。
   * @param identifier 资源标识（纯路径）
   */
  flushResource(identifier: IResourceIdentifier): Promise<void>;

  /**
   * 丢弃指定路径还没落盘的待写内容
   *
   * 用户选「不保存关闭」时用它把该路径还没落盘的内容丢掉，避免 5 秒后又被写回磁盘；
   * 丢弃同时会让资源层忘掉该路径的缓存内容。
   * @param identifier 资源标识（纯路径）
   */
  discardPendingResource(identifier: IResourceIdentifier): void;

  /**
   * 订阅「当前全部待写路径」的变化
   *
   * 回调会收到当前全部待写路径，且订阅时立刻用当前值回调一次（之后每次「有待写」这件事变化再回调）；
   * 面板据此维护每栏的未保存标记。
   * @param listener 待写路径变化的回调
   * @returns 退订函数
   */
  watchPendingChange(listener: PendingChangeListener): () => void;

  /**
   * 询问外壳「这条路径是不是已经开在别的标签里」
   *
   * 同步返回，不等待切换完成：真表示有别的标签持有该路径、切换已经发起；假表示没有别的标签持有它，
   * 包括「当前标签自己持有那条登记」的情形——关掉某一栏后再打开同一文件仍须能开。
   * 调用方据此决定要不要改自己的目标。
   * @param identifier 资源标识（纯路径）
   * @returns 有别的标签持有该路径并已发起切换时为 true
   */
  focusResourceTab(identifier: IResourceIdentifier): boolean;

  /**
   * 面板换目标后，把「这个标签当前显示的全部路径」上报给外壳
   *
   * 外壳把它当作该标签的去重登记：**整份替换、不合并**——新集合里没有的路径自动释放；
   * 空数组表示这个标签不再显示任何资源（登记随之清空）。
   * 每条路径都会先归一，归一后为空串的条目被丢弃，重复路径只保留一次。
   * 实例已经不再拥有标签（已被替换、没有挂在任何标签里）时是空操作；
   * 在工厂 `create` 阶段调用同样是空操作，因为标签记录还没写入，首次登记由打开入口的 `path` 参数负责。
   * @param identifiers 当前显示的资源标识列表
   */
  reportResourcePaths(identifiers: readonly IResourceIdentifier[]): void;

  /**
   * 添加某个面板的撤回操作
   * @param panel 添加撤回操作的面板
   * @param context 撤回操作上下文
   */
  addUndoContext(panel: IEditorPanel, context: IUndoContext<unknown>): void;
}

export interface IEditorPanel extends IUndoable {
  /** 编辑器功能的标识符 */
  readonly id: string;

  /**
   * 获取此面板实例的显示标题，供外壳渲染标签时使用
   * @returns 面板实例的显示标题；返回 undefined（或未实现）时，外壳回退到面板类型名
   */
  getTitle?(): string | undefined;

  /**
   * 当用户主动关闭承载此面板的标签时，外壳询问这一次关闭该怎么办
   *
   * 外壳在询问前会先把目标标签切换为活动标签。返回 `Cancel` 时标签保持打开；
   * `Save` 表示面板已自行保存成功，外壳跳过普通切走落盘；
   * `Discard` 表示丢弃内存改动，外壳会先投递 `IEditorPanel.onDiscard` 再跳过落盘释放。
   * 钩子抛错时外壳记录日志并按取消关闭处理。未实现本方法的旧面板继续走 `IEditorPanel.onBeforeClose`。
   * @returns 保存并关闭 / 不保存关闭 / 取消关闭
   */
  onRequestClose?(): Promise<PanelCloseChoice>;

  /**
   * 用户选择「不保存关闭」时，外壳在释放实例之前投递
   *
   * 面板据此清掉内存里的脏状态，使 `IEditorPanel.dispose` 的兜底保存成为空操作。
   * 只有「不保存关闭」会投递；注销面板类型、释放整个编辑器等内部路径永不投递。
   */
  onDiscard?(): void;

  /**
   * 外壳复用承载此面板的标签之前询问：面板是否正卡在一个还没表态的外部冲突里
   *
   * 返回真表示面板正在等用户决定「外部改动与内存改动听谁的」，此时外壳**不得复用它、也不得写盘**，
   * 只把该标签切到前台让用户先处理。询问发生在任何切出落盘、释放与新建之前，因此返回值必须是同步的。
   * 未实现时外壳按「没有冲突」处理。
   * @returns 存在未表态的外部冲突时为 true
   */
  hasPendingConflict?(): boolean;

  /**
   * 外壳在复用前的切出落盘之后询问：是否仍有没写成功的改动
   *
   * 返回真表示切出保存没有真正结算（写盘失败或被守卫跳过），此时外壳不得释放实例、不得重建，
   * 应保留原标签与原实例并让本次打开失败。未实现时外壳只按全量 flush 的布尔结果判断。
   * @returns 仍有未落盘改动时为 true
   */
  hasUnsavedChanges?(): boolean;

  /**
   * 旧语义：用户主动关闭标签时询问是否允许关闭；外壳优先 `IEditorPanel.onRequestClose`，没有它时才退回这里
   *
   * 返回 `true` 表示允许关闭（仍会走普通切走落盘）；返回 `false` 表示取消关闭，标签保留且实例不释放。
   * 未保存改动由 `IEditorPanel.onSwitchOut` 自动落盘覆盖，因此此方法**不再**用于询问「要不要保存」，
   * 只允许用于确实不该继续的破坏性场景（例如面板内正在执行不可中断的流程）。
   * 外壳在询问前会先把目标标签切换为活动标签；钩子抛错时外壳记录日志并按取消关闭处理。
   * 释放整个编辑器、注销面板类型、内部关闭面板实例等路径不会调用此方法。
   * @returns 允许关闭时为 true，取消关闭时为 false
   */
  onBeforeClose?(): Promise<boolean>;

  /**
   * 初始化此编辑器面板
   */
  initialize(): Promise<void>;

  /**
   * 释放此编辑器面板
   */
  dispose(): Promise<void>;

  /**
   * 获取此编辑器面板的渲染组件
   */
  render(): FC;

  /**
   * 当浏览器窗口焦点转移至当前编辑器时执行
   */
  onFocus(): Promise<void>;

  /**
   * 当浏览器窗口焦点转移出当前编辑器时执行
   */
  onBlur(): Promise<void>;

  /**
   * 当从其他面板切换至此面板时执行；外壳在收到前一个面板的落盘结算之后才投递
   * @param param 切换至此面板时，向此面板传入的参数
   */
  onSwitchIn(param?: Record<string, unknown>): Promise<void>;

  /**
   * 当从此面板切换至其他面板时执行；这是此面板**唯一的落盘点**
   *
   * 外壳会 await 它结算完成，然后才让下一个面板切入、或释放此面板实例；
   * 因此实现必须在返回前把未保存改动全部写完。不允许弹确认框、也不允许把「是否保存」交给用户决定；
   * 落盘失败请在面板自己的提示区显示错误，不要抛给外壳去弹窗，外壳对抛错只记录日志。
   * 外壳在「切换标签、关闭标签、标签被替换、注销面板类型」四条路径上都会调用它。
   */
  onSwitchOut(): Promise<void>;

  /**
   * 当资源层确认某个路径发生变化时投递；面板据此自行读取需要的内容，外壳不预读
   *
   * 与既有的 `IEditorPanel.onUpdateResource` 并存：外壳优先投递本钩子，未实现时才退回预读通道。
   * 变化种类包含新增 / 修改 / 删除，删除事件的路径同样会被投递。
   * @param identifier 资源统一标识符
   * @param kind 变化种类
   */
  onResourceChange?(identifier: IResourceIdentifier, kind: EditorFileChangeKind): Promise<void>;

  /**
   * 当资源数据更新时执行
   * @param id 资源统一标识符
   * @param data 更新后的资源数据
   */
  onUpdateResource<T>(id: IResourceIdentifier, data: T): Promise<void>;
}

/** 面板实例工厂的入参对象：打包面板上下文与 core 生成的实例 id */
export interface IEditorPanelFactoryParam {
  /** 面板侧上下文，提供资源读写与撤销能力 */
  readonly context: IEditorPanelContext;

  /** core 生成的唯一实例 id，用于区分同类型的多个实例 */
  readonly instanceId: string;

  /** 工厂收到的可选打开参数；内核只透传，不假定其形状 */
  readonly openParam?: Record<string, unknown>;
}

/** 面板实例工厂：接收入参对象并同步返回一个面板实例（无 Promise） */
export type EditorPanelFactory = (param: IEditorPanelFactoryParam) => IEditorPanel;

export interface IEditorPanelType {
  /** 面板类型的唯一标识符 */
  readonly id: string;

  /** 面板类型的显示名称 */
  readonly name: string;

  /** 外部提供的可渲染图标，core 不解析图标名 */
  readonly icon: ReactNode;

  /** 创建此类型面板实例的工厂 */
  readonly create: EditorPanelFactory;

  /**
   * 再次打开这个类型时复用已有的那个标签
   *
   * 默认不声明表示每次新开标签。声明为真时，外壳在资源管理器传入空白标签打开本类型的情况下，
   * 会复用打开顺序最早的那个同类标签，而不是再开一个；复用的语义由外壳保证——同一个标签、
   * 先等旧实例切出落盘、再按新的打开参数重建实例。素材管理器与地图编辑器声明此能力；表格面板不声明。
   */
  readonly reuseTab?: boolean;

  /**
   * 判断一个完整路径能否由此面板类型打开
   *
   * 入参是索引里的规范化相对路径（无前导 `/`、以 `/` 分隔、不含 `..` 段）。
   * 与 `IEditorPanelType.createOpenParam` 同时声明时，此面板类型才会成为资源管理器的候选。
   * @param path 完整路径：相对项目根、以 `/` 分隔、无前导斜线
   * @returns 能打开时为 true
   */
  canOpen?(path: string): boolean;

  /**
   * 把完整路径转成本面板类型的打开参数
   *
   * 必须是同步纯函数、禁止 I/O，且每次返回新对象；参数形状由面板类型自己解释，
   * `IEditorPanelType.create` 收到的 `openParam` 即此返回值，core 不校验其形状。
   * @param path 完整路径：相对项目根、以 `/` 分隔、无前导斜线
   * @returns 交给外壳的打开参数
   */
  createOpenParam?(path: string): Record<string, unknown>;
}
