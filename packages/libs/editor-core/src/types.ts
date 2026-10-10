import { IUndoInjection, IUndoSystem } from './undo';
import { IResourceInjection, IResourceSystem } from './resource';
import { IShellInjection, IShellSystem } from './shell';

export interface IEditorCoreInjection extends IUndoInjection, IResourceInjection, IShellInjection {}

export interface IEditorCore {
  /** 编辑器版本 */
  readonly version: string;

  /** 撤回系统 */
  readonly undoSystem: IUndoSystem;
  /** 外壳系统 */
  readonly shellSystem: IShellSystem;
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
