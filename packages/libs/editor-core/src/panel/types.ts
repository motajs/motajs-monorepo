import { FC } from 'react';
import { IUndoable, IUndoContext } from '@/undo';
import { IResource, IResourceIdentifier } from '@/resource';

export interface IEditorPanelContext {
  /**
   * 请求指定资源
   * @param id 资源标识符
   */
  requestResource<T>(id: IResourceIdentifier): Promise<IResource<T> | null>;

  /**
   * 获取指定资源类型的资源列表
   * @param type 资源类型
   */
  requestResourceList(type: number): Promise<readonly IResourceIdentifier[]>;

  /**
   * 创建新的资源
   * @param id 资源标识符
   * @param content 资源的初始内容
   */
  createResource<T>(id: IResourceIdentifier, content: T): Promise<IResource<T>>;

  /**
   * 删除指定资源
   * @param id 资源标识符
   */
  deleteResource(id: IResourceIdentifier): Promise<void>;

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
   * 当从其他面板切换至此面板时执行
   * @param param 切换至此面板时，向此面板传入的参数
   */
  onSwitchIn(param?: Record<string, unknown>): Promise<void>;

  /**
   * 当从此面板切换至其他面板时执行
   */
  onSwitchOut(): Promise<void>;

  /**
   * 当资源数据更新时执行
   * @param id 资源统一标识符
   * @param data 更新后的资源数据
   */
  onUpdateResource<T>(id: IResourceIdentifier, data: T): Promise<void>;

  /**
   * 当指定资源列表更新时执行
   * @param type 资源类型
   * @param list 更新后的资源列表
   */
  onUpdateResourceList(type: number, list: readonly IResourceIdentifier[]): Promise<void>;
}

export type EditorPanelCreator = (context: IEditorPanelContext) => Promise<IEditorPanel>;

export interface IPanelInjection {}

export interface IPanelSystem extends IUndoable {
  /** 当前正在前台的编辑器面板 */
  readonly currentPanel: IEditorPanel | null;

  /**
   * 初始化编辑器面板系统并注入
   * @param injection 面板系统注入
   */
  initialize(injection: IPanelInjection): Promise<void>;

  /**
   * 注册编辑器面板
   * @param panel 面板对象的工厂函数
   */
  registerPanel(panel: EditorPanelCreator): Promise<IEditorPanel>;

  /**
   * 释放指定编辑器面板对象
   * @param panel 要释放的面板对象
   */
  disposePanel(panel: IEditorPanel): Promise<void>;

  /**
   * 根据面板标识符获取指定面板
   * @param id 面板标识符
   */
  getPanel(id: string): IEditorPanel | null;

  /**
   * 切换至指定编辑器面板
   * @param panel 要切换至的编辑器面板
   * @param param 向切换至的面板传入的参数
   */
  switchTo(panel: IEditorPanel, param?: Record<string, unknown>): Promise<void>;

  /**
   * 获取面板系统的渲染根组件
   */
  render(): FC;

  /**
   * 释放此面板管理器
   */
  dispose(): Promise<void>;
}
