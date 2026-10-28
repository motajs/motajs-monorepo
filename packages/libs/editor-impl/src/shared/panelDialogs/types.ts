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

  /** 选择「放弃我的改动并刷新」 */
  readonly onDiscard: () => void;

  /** 选择「保留我的改动，下次保存覆盖」 */
  readonly onKeep: () => void;
}
