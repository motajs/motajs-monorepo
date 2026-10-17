import { FC, ReactNode } from 'react';
import { IUndoable, IUndoContext } from '../undo';
import { IFileEntry, IResource, IResourceIdentifier, ResourceContent } from '../resource';

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
}
