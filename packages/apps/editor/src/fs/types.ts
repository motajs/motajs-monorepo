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
