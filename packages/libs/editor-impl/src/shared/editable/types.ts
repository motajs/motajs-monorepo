import { Ref } from 'react';

// 可编辑组件的通用契约：面板传入内容与版本号，组件通过 ref 暴露「读内容 / 换内容 / 判脏 / 标记已保存」四项能力。
// 组件只接收内容、不接收文件路径、不主动读文件（D-01 / D-02 / D-03 / D-04）。
// 地图与素材不走这套 props（D-40）：它们由面板持有权威文档，组件只接收内容与回调。

export const enum ContentSaveStatus {
  /** 保存成功，组件可以把当前内容当作已保存基线 */
  Saved,
  /** 保存失败，组件保持脏状态并显示失败 */
  Failed,
}

export interface IEditableContentHandle<T> {
  /**
   * 读取组件当前持有的内容快照；面板在切走、关闭、保存前调用
   * @returns 组件此刻持有的内容
   */
  getData(): T;

  /**
   * 用给定内容替换组件当前内容；面板在外部刷新、撤销重做、换文件时调用，替换后视为已保存基线
   * @param data 要替换成的内容
   */
  setData(data: T): void;

  /**
   * 判断组件是否有尚未保存的改动；面板据此决定是否跳过写盘
   * @returns 有未保存改动时为 true
   */
  isDirty(): boolean;

  /**
   * 把当前内容标记为已保存；面板在保存成功后调用
   */
  markSaved(): void;
}

export interface IEditableContentProps<T> {
  /** 面板分配给此组件的内容；不要求与文件结构同构（D-39） */
  readonly content: T;

  /** 面板主动「换内容」时递增的版本号；组件只在它变化时重置草稿（D-02 / D-06） */
  readonly contentVersion: number;

  /** 面板主动拉取与替换组件内容的句柄；React 19 下 `ref` 是普通 prop（D-03） */
  readonly ref?: Ref<IEditableContentHandle<T>>;

  /**
   * 组件内部请求保存
   * @param content 组件当前内容的快照
   * @returns 保存结果，组件据此显示保存中、成功或失败
   */
  onSave?(content: T): Promise<ContentSaveStatus>;

  /**
   * 组件把最新草稿交回面板；每次草稿变化与卸载 cleanup 都调用，面板据此持有一份副本（D-06）
   * @param content 交回的内容
   * @param dirty 交回时刻的脏标记，必须是当时的值而不是首帧闭包值
   */
  onDraftChange?(content: T, dirty: boolean): void;
}
