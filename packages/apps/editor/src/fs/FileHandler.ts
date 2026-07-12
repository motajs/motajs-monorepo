/**
 * FileHandler - 文件系统的直接接口
 *
 * 职责：
 * - 文件系统的直接接口，实现 IContentHandler<string>
 * - 使用 signal 管理状态，自动通知订阅者
 * - 同步更新内存 + 异步落盘
 * - 内置 PersistExecutor 处理持久化队列
 */

import { effect, signal } from "alien-signals";
import { fs as defaultFs, type Fs } from "@/services/fs";
import { waitUntil } from "@/utils/base/signal";
import type { Content } from "./types";
import type { IContentHandler, ReadonlySignal } from "./interfaces";
import type { PersistExecutor } from "./PersistExecutor";
import { persistenceMonitor } from "./PersistenceMonitor";

export class FileHandler implements IContentHandler<string> {
  // 内部 signal（私有）- signal 返回的是函数
  private _content: ReturnType<typeof signal<Content<string>>>;

  // 暴露只读引用 - 直接暴露函数
  readonly content: ReadonlySignal<Content<string>>;

  // 持久化执行器（暴露给 PersistenceMonitor）
  readonly persistExecutor: PersistExecutor;

  // 文件系统接口（可注入，用于测试）
  private fs: Fs;

  private path: string;

  constructor(
    path: string,
    fs?: Fs,
  ) {
    this.path = path;
    // 初始化 signal - signal 返回一个函数
    this._content = signal<Content<string>>({ status: "idle" });
    // 直接暴露为只读函数
    this.content = this._content as ReadonlySignal<Content<string>>;
    this.fs = fs || defaultFs;

    // 从 PersistenceMonitor 创建 executor（自动监控）
    this.persistExecutor = persistenceMonitor.createExecutor(
      path,
      () => this.persistToDisk()
    );
  }

  // ==================== IContentView 接口 ====================

  /**
   * 兼容方法：获取当前内容
   */
  getContent(): Content<string> {
    return this._content();
  }

  /**
   * 兼容方法：订阅内容变化
   */
  subscribe(listener: (content: Content<string>) => void): () => void {
    return effect(() => {
      listener(this._content());
    });
  }

  /**
   * 重新加载（从文件重新读取）
   */
  async refetch(): Promise<void> {
    // 直接调用 load，它会处理状态转换
    await this.load();
  }

  /**
   * 获取路径（用于调试）
   */
  getPath(): string {
    return this.path;
  }

  // ==================== IContentHandler 接口（可写部分） ====================

  /**
   * 统一的 update API（支持三种模式）
   *
   * 1. 直接设置新值：update('new content')
   * 2. 同步转换：update(current => current + ' appended')
   * 3. 异步转换：await update(async current => await process(current))
   */
  // TODO: 考虑用版本号机制让 loading 状态也能 update
  // load 本质上也是一种 update（数据来源是磁盘），可以用版本号实现"后发生的操作生效"语义：
  // - load 开始时记录 version
  // - update 时增加 version
  // - load 完成时检查 version，如果变了就不覆盖
  // 这样可以统一 load 和 update 的语义，允许 loading 期间 update

  update(value: string): void;
  update(transform: (current: string) => string): void;
  update(transform: (current: string) => Promise<string>): Promise<void>;
  update(valueOrTransform: string | ((current: string) => string | Promise<string>)): void | Promise<void> {
    // 检查是否标记了删除意图
    if (this.persistExecutor.isDeletionPending()) {
      throw new Error(`Cannot update file: deletion pending for ${this.path}`);
    }

    // 获取当前内容
    const currentContent = this._content();
    // 禁止 loading（状态不确定）和 error（可能有 IO 问题）
    if (currentContent.status === "loading" || currentContent.status === "error") {
      throw new Error(`Cannot update file: current status is ${currentContent.status}`);
    }

    // 情况 1: 直接值 - 允许 loaded/idle/not-found 状态（创建新文件）
    if (typeof valueOrTransform === "string") {
      const newValue = valueOrTransform;

      // 同步更新 signal
      this._content({ status: "loaded", value: newValue });

      // 触发异步持久化
      this.persistExecutor.exec();

      return;
    }

    // 情况 2 & 3: 转换函数 - 只允许 loaded 状态（需要当前值）
    if (currentContent.status !== "loaded") {
      throw new Error(`Cannot use transform function: file not loaded (status: ${currentContent.status})`);
    }

    const currentValue = currentContent.value;
    const transform = valueOrTransform;
    const result = transform(currentValue);

    // 情况 2: 同步转换
    if (!(result instanceof Promise)) {
      const newValue = result;

      // 同步更新 signal
      this._content({ status: "loaded", value: newValue });

      // 触发异步持久化
      this.persistExecutor.exec();

      return;
    }

    // 情况 3: 异步转换
    return (async () => {
      const newValue = await result;

      // 同步更新 signal
      this._content({ status: "loaded", value: newValue });

      // 触发异步持久化
      this.persistExecutor.exec();
    })();
  }

  /**
   * 等待持久化队列清空
   */
  async waitForIdle(): Promise<void> {
    return this.persistExecutor.waitForIdle();
  }

  /**
   * 等待文件加载完成（用于 Suspense）
   *
   * 利用 waitUntil 自动追踪 signal 变化
   * 当状态变为 loaded 时 Promise resolve
   *
   * 注意：对于 error/not-found 状态，Promise 会等到状态变为 loaded
   * （比如用户执行 retry 操作后）
   */
  waitForLoaded(): Promise<void> {
    return waitUntil(() => this._content().status === "loaded");
  }

  /**
   * 等待状态 settled（loaded/error/not-found）
   *
   * 与 waitForLoaded 不同，此方法在 error/not-found 时也会 resolve
   * 用于 Suspense：loading 时挂起，settled 后继续渲染（可能是错误状态）
   */
  waitForSettled(): Promise<void> {
    return waitUntil(() => {
      const status = this._content().status;
      return status !== "loading" && status !== "idle";
    });
  }

  /**
   * 检查是否有未保存的修改
   */
  hasPendingWrites(): boolean {
    return this.persistExecutor.hasPending();
  }

  /**
   * 删除文件（内部方法，由 Manager 调用）
   *
   * @param force 是否强制删除（忽略未保存的修改）
   */
  async delete(force: boolean = true): Promise<void> {
    // 非强制删除：先检查是否有未保存的修改
    if (!force && this.hasPendingWrites()) {
      throw new Error(`Cannot delete file with unsaved changes: ${this.path}`);
    }

    // 标记删除意图（阻止新持久化）
    this.persistExecutor.markDeletionPending();

    // 等待持久化队列清空
    await this.waitForIdle();

    // 删除文件
    try {
      await this.fs.promises.deleteFile(this.path);
    } catch (err) {
      const error = err as Error;
      if (!error.message || !error.message.includes("not found")) {
        throw error;
      }
    }

    // 标记为已删除，通知订阅者
    this._content({ status: "not-found" });
  }

  // ==================== 内部方法 ====================

  /**
   * 加载文件内容（由 FileHandlerManager 调用）
   */
  async load(): Promise<void> {
    if (this._content().status === "loading") {
      await waitUntil(() => this._content().status !== "loading");
      return;
    }

    // 转换到 loading 状态
    this._content({ status: "loading" });

    try {
      const content = await this.fs.promises.readFile(this.path, "utf-8");
      this._content({ status: "loaded", value: content });
    } catch (err) {
      const error = err as Error;

      // 检查是否是文件不存在错误
      if (error.message && error.message.includes("not found")) {
        this._content({ status: "not-found" });
      } else {
        this._content({ status: "error", error });
      }
    }
  }

  /**
   * 持久化到磁盘（读取当前最新的 content）
   */
  private async persistToDisk(): Promise<void> {
    // 读取当前最新的内容
    const currentContent = this._content();
    if (currentContent.status !== "loaded") {
      console.warn(`Cannot persist file ${this.path}: current status is ${currentContent.status}`);
      return;
    }

    const content = currentContent.value;

    try {
      await this.fs.promises.writeFile(this.path, content, "utf-8");
    } catch (err) {
      const error = err as Error;
      console.error(`Failed to persist file ${this.path}:`, error);

      // 注意：不更新 content 状态
      // 内存中的数据仍然有效，只是持久化失败
      // 持久化状态应该由 PersistenceMonitor 管理

      throw error;
    }
  }

  /**
   * 检查是否已加载过（不管成功、失败还是不存在）
   */
  isLoaded(): boolean {
    const status = this._content().status;
    return status !== "idle" && status !== "loading";
  }
}
