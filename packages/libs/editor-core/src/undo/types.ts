export interface IUndoContext<T> {
  /** 撤回操作类型 */
  readonly type: number;
  /** 撤回操作包含的数据 */
  readonly data: T;
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
  /** 最大撤回步数 */
  readonly maxUndoStep: number;
}

export interface IUndoSystem {
  /** 最大撤回步数 */
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
   */
  undo(): Promise<void>;

  /**
   * 执行重做操作
   */
  redo(): Promise<void>;
}
