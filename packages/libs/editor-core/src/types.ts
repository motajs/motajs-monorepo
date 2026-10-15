import { IUndoInjection, IUndoSystem } from './undo';
import { IResourceSystem } from './resource';
import { IShellInjection, IShellSystem } from './shell';
import { IEditorFileSystem } from './fs';

export interface IEditorCoreInjection extends IUndoInjection, IShellInjection {
  /** 宿主注入的文件系统实现；core 只驱动它、不解析文件格式 */
  readonly fs: IEditorFileSystem;
  /** 建索引时跳过的目录 / 文件模式列表，可含通配，如 `node_modules`、`.git` */
  readonly ignore?: readonly string[];
}

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
