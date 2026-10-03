import { FC } from 'react';
import { IUndoable, IUndoContext } from '@/undo';
import { IResourceIdentifier } from '@/resource';

export interface IEditorPanelContext {
  /**
   * 请求指定资源
   * @param id 资源标识符
   */
  requestSource<T>(id: IResourceIdentifier): Promise<T>;

  /**
   * 获取指定资源类型的资源列表
   * @param type 资源类型
   */
  requestSourceList(type: number): readonly IResourceIdentifier[];

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
   * 初始化此编辑器功能
   */
  initialize(): Promise<void>;

  /**
   * 释放此编辑器功能
   */
  dispose(): Promise<void>;

  /**
   * 获取此编辑器功能的渲染组件
   */
  render(): FC;

  /**
   * 当焦点转移至当前编辑器面板时执行，注意如果是从其他面板切换至此面板，那么不会触发
   */
  onFocus(): Promise<void>;

  /**
   * 当焦点转移出当前编辑器面板时执行，注意如果是从此面板切换至其他面板，那么不会触发
   */
  onBlur(): Promise<void>;

  /**
   * 当从其他面板切换至此面板时执行
   */
  onSwitchIn(): Promise<void>;

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
  onUpdateResourceList(type: number, list: IResourceIdentifier[]): Promise<void>;
}

export type EditorPanelCreator = (context: IEditorPanelContext) => IEditorPanel;

export interface IPanelSystem {
  /** 当前正在前台的编辑器面板 */
  readonly currentPanel: IEditorPanel | null;

  /**
   * 注册编辑器面板
   * @param panel 面板对象的工厂函数
   */
  registerPanel(panel: EditorPanelCreator): Promise<void>;

  /**
   * 释放指定编辑器面板对象
   * @param panel 要释放的面板对象
   */
  disposePanel(panel: IEditorPanelContext): Promise<void>;

  /**
   * 切换至指定编辑器面板
   * @param panel 要切换至的编辑器面板
   */
  switchTo(panel: IEditorPanel): Promise<void>;
}
