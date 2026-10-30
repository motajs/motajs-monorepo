import { PanelCloseChoice } from '@motajs/editor-core';

// 两个共享面板弹窗的 props：只描述展示态与用户的选择。
// 弹窗自身不判断脏、不调保存、不持有面板状态；三个面板各自在自己的视图里挂载（D-08 / D-17 / D-38）。

export interface IPanelCloseDialogProps {
  /** 弹窗是否打开 */
  readonly open: boolean;

  /** 是否正在保存 */
  readonly saving?: boolean;

  /** 保存失败的原因 */
  readonly error?: string;

  /** 用户点了哪一个选择 */
  readonly onChoose: (choice: PanelCloseChoice) => void;
}

export interface IExternalChangeDialogProps {
  /** 弹窗是否打开 */
  readonly open: boolean;

  /**
   * 「要编辑器这一份」按钮的文案
   *
   * 表格面板传定稿的「保存编辑器的」；地图 / 素材面板不传，继续用默认那一套（本阶段不改它们的冲突处置，D-21）。
   */
  readonly keepLabel?: string;

  /**
   * 「要外部那一份」按钮的文案
   *
   * 表格面板传定稿的「保存外部修改」；地图 / 素材面板不传，保持默认文案。
   */
  readonly discardLabel?: string;

  /**
   * 正文下方的一句补充说明
   *
   * 表格面板用它讲清「点哪个都立刻生效、没表态就不写盘」；地图 / 素材面板不传，保持默认那一句。
   */
  readonly noteText?: string;

  /** 选择「要外部那一份」：落点是 `TablePanel.discardExternalConflict` */
  readonly onDiscard: () => void;

  /** 选择「要编辑器这一份」：落点是 `TablePanel.keepExternalConflict` */
  readonly onKeep: () => void;
}
