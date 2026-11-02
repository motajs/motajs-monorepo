import { FC } from 'react';
import { IEditorPanel, IEditorPanelType } from '../panel';

export interface IShellInjection {}

export interface IEditorMenuItem {
  /** 菜单项的唯一标识符 */
  readonly id: string;

  /** 菜单项的显示标题 */
  readonly title: string;

  /** 菜单项被点击时的回调 */
  readonly onClick: () => void;
}

export interface IEditorTab {
  /** 标签的唯一标识符 */
  readonly id: string;

  /** 标签承载的面板类型标识符；为 null 表示空白标签页 */
  readonly typeId: string | null;

  /** 标签承载的面板实例标识符；为 null 表示空白标签页 */
  readonly instanceId: string | null;
}

export interface IShellSystem {
  /**
   * 初始化外壳系统并注入
   * @param injection 外壳系统注入
   */
  initialize(injection: IShellInjection): Promise<void>;

  /**
   * 注册一个面板类型
   * @param type 面板类型的元信息
   * @returns 是否注册成功
   */
  registerPanelType(type: IEditorPanelType): boolean;

  /**
   * 注销指定标识符的面板类型
   * @param typeId 面板类型标识符
   */
  unregisterPanelType(typeId: string): Promise<void>;

  /**
   * 列出已注册的全部面板类型
   * @returns 已注册面板类型列表
   */
  listPanelTypes(): readonly IEditorPanelType[];

  /**
   * 创建指定面板类型的一个实例
   * @param typeId 面板类型标识符
   * @param openParam 打开面板时顺带携带的可选参数；内核只透传，不解释其内容
   * @returns 创建的面板实例，类型不存在或创建失败时为 null
   */
  createPanelInstance(typeId: string, openParam?: Record<string, unknown>): Promise<IEditorPanel | null>;

  /**
   * 关闭指定的面板实例
   * @param instanceId 面板实例标识符
   */
  closePanelInstance(instanceId: string): Promise<void>;

  /**
   * 注册一个菜单项
   * @param item 菜单项
   * @returns 是否注册成功
   */
  registerMenuItem(item: IEditorMenuItem): boolean;

  /**
   * 注销指定标识符的菜单项
   * @param itemId 菜单项标识符
   */
  unregisterMenuItem(itemId: string): void;

  /**
   * 列出已注册的全部菜单项
   * @returns 已注册菜单项列表
   */
  listMenuItems(): readonly IEditorMenuItem[];

  /**
   * 打开一个新的空白标签页并激活它
   *
   * 签名不变。已有面板挂载时，「激活」会延后一个微任务：标签立刻进入列表并可被填充，但真正的切换
   * 要等紧随其后的 `IShellSystem.openPanelInTab` 有机会先领走它——领走之后不再补激活，因此不会
   * 为切到空白标签而先保存一次旧面板；没人领走时（用户点「+」）微任务结束后仍会正常激活。
   * @returns 新标签页的标识符
   */
  openBlankTab(): string;

  /**
   * 在指定标签页中打开一个面板实例
   *
   * 调用方可以再交一条文件路径用于去重：外壳把路径归一后当键，同一路径已经开在另一个标签里时，
   * 外壳切到那个标签并返回成功，不创建新实例、也不保留调用方刚建出来的空白标签。
   * 路径只用来去重，外壳**不解释** `openParam` 的形状。
   *
   * 若目标类型声明了 `IEditorPanelType.reuseTab` 且调用方传入的是空白标签，外壳会复用该类型打开顺序
   * 最早的标签，而不是再开一个：复用前先等旧实例切出落盘；若旧实例 `IEditorPanel.hasPendingConflict()`
   * 为真，则只把那个标签切到前台并返回成功，不打开本次的目标文件；若切出保存没有结算（全量 flush 为假
   * 或 `IEditorPanel.hasUnsavedChanges()` 为真），保留原标签与原实例并返回假。
   * @param tabId 标签标识符
   * @param typeId 面板类型标识符
   * @param openParam 打开面板时顺带携带的可选参数；内核只透传，不解释其内容
   * @param path 调用方正在打开的那条文件路径；不传或传空串表示这次打开不对应任何文件，外壳因此不去重
   * @returns 是否打开成功
   */
  openPanelInTab(tabId: string, typeId: string, openParam?: Record<string, unknown>, path?: string): Promise<boolean>;

  /**
   * 关闭指定的标签页
   * @param tabId 标签标识符
   */
  closeTab(tabId: string): Promise<void>;

  /**
   * 激活指定的标签页。外壳会**先 `await` 即将离开的面板 `IEditorPanel.onSwitchOut` 结算完成**，再修改活动标签并通知 React 重渲染——因此保存期间旧面板的组件仍然挂载，面板可以在钩子里直接读取组件 ref。`IEditorPanel.onSwitchOut` 是唯一的切出保存点，不存在第二个保存钩子。
   * @param tabId 标签标识符
   */
  activateTab(tabId: string): Promise<void>;

  /**
   * 列出当前的全部标签页
   * @returns 标签页列表
   */
  listTabs(): readonly IEditorTab[];

  /**
   * 获取外壳系统的渲染根组件
   * @returns 外壳根组件
   */
  render(): FC;

  /**
   * 释放此外壳系统
   */
  dispose(): Promise<void>;
}
