import { FC } from 'react';
import { IUndoSystem } from './undo';
import { IEditorPanelContext } from './panel';

export interface IEditorCoreConfig {
  /** 最大撤回步数 */
  maxUndoStep: number;
}

export interface IEditorCore extends IEditorPanelContext {
  /** 编辑器版本 */
  readonly version: string;

  /** 撤回系统 */
  readonly undoSystem: IUndoSystem;

  /**
   * 获得此编辑器的渲染根组件
   */
  render(): FC;

  /**
   * 释放此编辑器
   */
  dispose(): Promise<void>;
}
