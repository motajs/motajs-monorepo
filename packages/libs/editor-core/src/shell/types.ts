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
   * @returns 创建的面板实例，类型不存在或创建失败时为 null
   */
  createPanelInstance(typeId: string): Promise<IEditorPanel | null>;

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
   * @returns 新标签页的标识符
   */
  openBlankTab(): string;

  /**
   * 在指定标签页中打开一个面板实例
   * @param tabId 标签标识符
   * @param typeId 面板类型标识符
   * @returns 是否打开成功
   */
  openPanelInTab(tabId: string, typeId: string): Promise<boolean>;

  /**
   * 关闭指定的标签页
   * @param tabId 标签标识符
   */
  closeTab(tabId: string): Promise<void>;

  /**
   * 激活指定的标签页
   * @param tabId 标签标识符
   */
  activateTab(tabId: string): void;

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
