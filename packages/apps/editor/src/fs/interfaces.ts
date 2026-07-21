/**
 * 核心接口定义
 */

import type { Content } from "./types";

/**
 * ReadonlySignal<T> - 只读 signal（函数式）
 *
 * 调用函数获取当前值
 */
export type ReadonlySignal<T> = () => T;

/**
 * IContentView<T> - 只读内容视图
 *
 * 定义只读内容访问接口，支持多层嵌套
 */
export interface IContentView<T> {
  /** 主要接口：只读 signal（推荐使用） */
  readonly content: ReadonlySignal<Content<T>>;

  /** 兼容方法：获取当前内容 */
  getContent(): Content<T>;

  /** 兼容方法：订阅内容变化 */
  subscribe(listener: (content: Content<T>) => void): () => void;

  /** 重新加载 */
  refetch(): Promise<void>;

  /** 确保完成首次加载；已在加载时仅等待，不重新读取 */
  ensureLoaded(): Promise<void>;

  /** 获取路径（用于调试） */
  getPath(): string;
}

/**
 * IContentHandler<T> - 可写内容处理器
 *
 * 扩展 IContentView，添加写入能力
 */
export interface IContentHandler<T> extends IContentView<T> {
  /** 统一的 update API（支持三种模式） */
  update(value: T): void;
  update(transform: (current: T) => T): void;
  update(transform: (current: T) => Promise<T>): Promise<void>;

  /** 等待内容加载完成（包括解析成功） */
  waitForLoaded(): Promise<void>;

  /** 等待状态 settled（loaded/error/not-found，非 loading/idle） */
  waitForSettled(): Promise<void>;
}

/**
 * IDataHandler<T> - 数据层处理器（DataHandler）
 *
 * 扩展 IContentHandler，补充数据层专有能力
 */
export interface IDataHandler<T> extends IContentHandler<T> {
  /** 获取底层文件内容（用于构造错误原因） */
  getFileHandler(): { getContent(): Content<string> };
}

/**
 * RecoverableResource - 可被 ContentBoundary 恢复的数据源
 *
 * 这是 DataHandler/FileHandler 之外的公共恢复协议。上层资源可以隐藏具体
 * handler 实现，但仍保留 retry、raw 文件修复和状态展示能力。
 */
export interface RecoverableResource<T = unknown> extends IContentHandler<T> {
  /** 获取底层原始文件资源；解析错误时用于打开原文修复 */
  raw?(): IContentHandler<string>;

  /** 返回自身恢复句柄，便于 resource.recoverable() 形式使用 */
  recoverable(): RecoverableResource<T>;
}
