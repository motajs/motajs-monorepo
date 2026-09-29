/**
 * Content<T> - 统一的状态类型
 *
 * 受 Rust 的 Result<T, E> 和 Option<T> 启发，使用 Tagged Union 表示数据的所有可能状态
 */

/** 通用的 Content 类型 - 适用于所有层 */
export type Content<T> =
  | { status: 'idle' } // 空闲，未开始加载
  | { status: 'loading' } // 加载中
  | { status: 'loaded'; value: T } // 已加载，包含数据
  | { status: 'not-found' } // 文件未找到
  | { status: 'error'; error: Error }; // 错误（权限、IO、解析等）

/** 文件层内容类型（文本内容） */
export type FileContent = Content<string>;

/**
 * PersistenceIntent - 一次持久化意图
 *
 * 编辑代码提交不可变的期望状态：要么写、要么删，并带上真正执行的函数。
 */
export interface PersistenceIntent {
  /** 意图种类：写入或删除。 */
  kind: 'write' | 'delete';

  /** 真正执行持久化的函数。 */
  execute: () => Promise<void>;
}

/**
 * ExecutorStatus - 单个持久化控制器的执行状态
 *
 * idle 空闲；executing 执行中并给出待执行数量；error 终态失败并带上错误。
 */
export type ExecutorStatus =
  { status: 'idle' } | { status: 'executing'; pending: number } | { status: 'error'; error: Error; pending: 0 };

/**
 * PersistFailure - 一条路径的持久化失败记录
 */
export interface PersistFailure {
  /** 失败的路径。 */
  path: string;

  /** 失败原因。 */
  error: Error;
}
