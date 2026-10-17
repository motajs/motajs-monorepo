import { IHookable, IHookBase } from '../hook';

export interface IUndoContext<T> {
  /** 撤回操作类型 */
  readonly type: number;
  /** 撤回操作包含的数据 */
  readonly data: T;
  /** 标记这条记录是不可撤销的屏障：撤销碰到即停，不跳过它 */
  readonly barrier?: boolean;
}

export interface IUndoSystemHooks extends IHookBase {
  /** 撤销命中屏障时被调用 */
  onUndoBlocked?(): void;
}

export interface IUndoable {
  /**
   * 执行撤回操作
   * @param context 撤回操作上下文
   */
  undo<T>(context: IUndoContext<T>): Promise<void>;

  /**
   * 执行重做操作
   * @param context 重做操作上下文
   */
  redo<T>(context: IUndoContext<T>): Promise<void>;
}

export interface IUndoInjection {
  /** 最大撤回步数；0 或负数表示禁用撤销 */
  readonly maxUndoStep: number;
}

export interface IUndoSystem extends IHookable<IUndoSystemHooks> {
  /** 最大撤回步数；0 或负数表示禁用撤销 */
  readonly maxUndoStep: number;

  /**
   * 初始化并注入撤回对象
   * @param injection 撤回注入对象
   */
  initialize(injection: IUndoInjection): Promise<void>;

  /**
   * 添加撤回操作及其上下文
   * @param undo 撤回对象
   * @param context 撤回操作的上下文
   */
  addUndoContext(undo: IUndoable, context: IUndoContext<unknown>): void;

  /**
   * 执行撤回操作
   * @returns true 表示真的执行了一步；false 表示没有可撤销的记录或命中屏障
   */
  undo(): Promise<boolean>;

  /**
   * 执行重做操作
   * @returns true 表示真的执行了一步；false 表示没有可重做的记录
   */
  redo(): Promise<boolean>;

  /**
   * 释放此撤回系统
   */
  dispose(): Promise<void>;
}
