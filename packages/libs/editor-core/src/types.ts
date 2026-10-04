import { IUndoInjection, IUndoSystem } from './undo';
import { IPanelInjection, IPanelSystem } from './panel';
import { IResourceInjection, IResourceSystem } from './resource';

export interface IEditorCoreInjection extends IUndoInjection, IResourceInjection, IPanelInjection {}

export interface IEditorCore {
  /** 编辑器版本 */
  readonly version: string;

  /** 撤回系统 */
  readonly undoSystem: IUndoSystem;
  /** 面板管理系统 */
  readonly panelSystem: IPanelSystem;
  /** 资源系统 */
  readonly resourceSystem: IResourceSystem;

  /**
   * 初始化编辑器并注入功能对象
   * @param injection 功能注入对象
   */
  initialize(injection: IEditorCoreInjection): Promise<void>;

  /**
   * 释放此编辑器
   */
  dispose(): Promise<void>;
}
