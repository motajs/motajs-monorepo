import { ReactNode } from 'react';
import {
  ICodeEditorOpenRequest,
  IEventEditorOpenRequest,
  IMultiSelectOpenRequest,
  IMultiSelectResult,
  IPointSelectOpenRequest,
  IPointSelectResult,
} from './types';

// 注入式能力接缝：表格经此触达外部编辑器与宿主能力，而不导入宿主或引擎代码。
// 每个能力都可缺省，缺省时表格优雅降级；本文件只声明契约，不实现任何组件。

export interface ICodeEditorOpener {
  /**
   * 在代码编辑器中打开一份内容并返回编辑结果
   * @param request 打开请求，携带标题与待编辑的整份内容
   * @returns 用户确认后的内容；用户取消时为 null
   */
  open(request: ICodeEditorOpenRequest): Promise<string | null>;
}

export interface IEventEditorOpener {
  /**
   * 在事件编辑器中打开一份内容并返回编辑结果
   * @param request 打开请求，携带标题与待编辑的整份内容
   * @returns 用户确认后的内容；用户取消时为 null
   */
  open(request: IEventEditorOpenRequest): Promise<string | null>;
}

export interface IMultiSelectOpener {
  /**
   * 打开通用多选弹窗并返回选中结果
   * @param request 打开请求，携带候选项与初始选中项
   * @returns 用户确认后的选中结果；用户取消时为 null
   */
  open(request: IMultiSelectOpenRequest): Promise<IMultiSelectResult | null>;
}

export interface IPointSelectOpener {
  /**
   * 打开坐标选择弹窗并返回选中坐标
   * @param request 打开请求，携带标题与可选初始坐标
   * @returns 用户确认后的坐标；用户取消时为 null
   */
  open(request: IPointSelectOpenRequest): Promise<IPointSelectResult | null>;
}

export interface ITablePanelOpener {
  /**
   * 打开一个已经设好目标的表格面板
   * @param param 打开参数，具体形状由表格面板声明、组合根收窄
   */
  open(param: Record<string, unknown>): Promise<void>;
}

export interface ICopyCapability {
  /**
   * 把文本写入剪贴板
   * @param text 要复制的文本
   */
  copyText(text: string): Promise<void>;
}

export interface ITableEditorCapabilities {
  /** 代码编辑器打开器；缺省时代码编辑能力不可用 */
  readonly codeEditor?: ICodeEditorOpener;
  /** 事件编辑器打开器；缺省时事件编辑能力不可用 */
  readonly eventEditor?: IEventEditorOpener;
  /** 通用多选打开器；缺省时多选能力不可用 */
  readonly multiSelect?: IMultiSelectOpener;
  /** 坐标选择打开器；缺省时坐标选择能力不可用 */
  readonly pointSelect?: IPointSelectOpener;
  /** 表格面板打开器（「编辑 Schema」使用）；缺省时无法新开表格面板 */
  readonly tablePanel?: ITablePanelOpener;
  /** 剪贴板复制能力；缺省时复制动作降级为不可用 */
  readonly copy?: ICopyCapability;
}

export interface ITableCapabilitiesProviderProps {
  /** 注入给表格的外部编辑器能力包；未提供任何能力时为 undefined */
  readonly capabilities?: ITableEditorCapabilities;
  /** Provider 包裹的子树 */
  readonly children: ReactNode;
}
