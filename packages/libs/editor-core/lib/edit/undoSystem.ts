/**
 * UndoSystem —— D-03 的委托式撤销接缝。
 *
 * core 的编辑层**不认识**视口 / 素材 / 引擎语义，只认识一个 `id` 加两个回调：每次
 * `OperationHistory.execute()` 都对每个已注册的系统各取一份快照，撤销/重做时按注册的**逆序**
 * 逐个回调 `restore`。编辑器把 viewport（或其他上层状态）实现成 system 注册进去即可。
 */
export interface UndoSystem<Snapshot = unknown> {
  /** 注册键；同一个 `OperationHistory` 内必须唯一。 */
  readonly id: string;

  /**
   * 取一份可还原的当前状态。
   *
   * **必须同步**：`OperationHistory.execute()` 在**调用时刻**（入队之前）就采集 "before" 快照，
   * 以保证「操作被调用的那一刻的上层状态」是撤销目标。异步 capture 会静默破坏该保证（T-04-09）。
   */
  capture(): Snapshot;

  /** 用 `capture()` 产出的快照还原该系统的状态。 */
  restore(snapshot: Snapshot): void | Promise<void>;
}
