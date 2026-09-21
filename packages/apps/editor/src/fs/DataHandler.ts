/**
 * DataHandler - 数据层可写处理器（抽象基类）
 *
 * 职责：
 * - 在 FileHandler（文本层）之上提供数据层抽象
 * - 使用 computed 自动处理 parse/stringify 和缓存
 * - 实现 IContentHandler<T> 接口
 * - 子类只需实现 parse 和 stringify 方法
 *
 * 设计理念：
 * - 使用 computed 自动追踪 FileHandler 的 signal
 * - parse 错误不影响文件层
 * - 写入时自动 stringify 并更新 FileHandler
 */

import { computed, effect } from 'alien-signals';
import { waitUntil } from '@/utils/base/signal';
import type { FileHandler } from './FileHandler';
import type { Content } from './types';
import type { IDataHandler, ReadonlySignal } from './interfaces';
import { ContentUtils } from './ContentUtils';

export abstract class DataHandler<T> implements IDataHandler<T> {
  // 数据层 signal（computed，自动追踪 FileHandler）
  readonly content: ReadonlySignal<Content<T>>;

  protected fileHandler: FileHandler;
  private resourceName: string;

  constructor(fileHandler: FileHandler, resourceName: string) {
    this.fileHandler = fileHandler;
    this.resourceName = resourceName;

    // 使用 computed 自动追踪 FileHandler 的 signal
    // computed 返回一个函数，直接赋值给 ReadonlySignal
    const computedContent = computed(() => {
      const fileContent = fileHandler.content(); // 自动追踪依赖

      return ContentUtils.andThen(fileContent, (text) => {
        try {
          const data = this.parse(text);
          return { status: 'loaded' as const, value: data };
        } catch (err) {
          return { status: 'error' as const, error: err as Error };
        }
      });
    });

    this.content = computedContent;
  }

  // ==================== 子类实现 ====================

  /**
   * 解析文本为数据
   *
   * 子类必须实现此方法
   */
  protected abstract parse(text: string): T;

  /**
   * 序列化数据为文本
   *
   * 子类必须实现此方法
   */
  protected abstract stringify(data: T): string;

  // ==================== IContentView 接口 ====================

  /**
   * 兼容方法：获取当前内容
   */
  getContent(): Content<T> {
    return this.content();
  }

  /**
   * unwrap: 获取值或抛出异常
   *
   * 便捷方法，等价于 ContentUtils.unwrap(this.getContent(), this.resourceName)
   *
   * @example
   * const data = handler.unwrap();
   */
  unwrap(): T {
    return ContentUtils.unwrap(this.getContent(), this.resourceName);
  }

  /**
   * 兼容方法：订阅内容变化
   */
  subscribe(listener: (content: Content<T>) => void): () => void {
    return effect(() => {
      listener(this.content());
    });
  }

  /**
   * 重新加载（委托给 FileHandler）
   */
  async refetch(): Promise<void> {
    return this.fileHandler.refetch();
  }

  async ensureLoaded(): Promise<void> {
    return this.fileHandler.ensureLoaded();
  }

  /**
   * 获取路径（委托给 FileHandler）
   */
  getPath(): string {
    return this.fileHandler.getPath();
  }

  /**
   * 等待数据层加载完成（包括 parse 成功）
   *
   * 注意：这里等待的是 DataHandler 的 content（parsed data），
   * 而不是 FileHandler 的 content（raw text）
   *
   * 对于 error/not-found 状态，Promise 会等到状态变为 loaded
   * （比如用户执行 retry 操作后）
   */
  waitForLoaded(): Promise<void> {
    return waitUntil(() => this.content().status === 'loaded');
  }

  /**
   * 等待状态 settled（loaded/error/not-found）
   *
   * 与 waitForLoaded 不同，此方法在 error/not-found 时也会 resolve
   * 用于 Suspense：loading 时挂起，settled 后继续渲染（可能是错误状态）
   */
  waitForSettled(): Promise<void> {
    return waitUntil(() => {
      const status = this.content().status;
      return status !== 'loading' && status !== 'idle';
    });
  }

  /**
   * 获取底层 FileHandler（用于 openAsText 等场景）
   *
   * 当 DataHandler 解析失败时，可以通过这个方法获取 FileHandler
   * 直接编辑原始文本内容
   */
  getFileHandler(): FileHandler {
    return this.fileHandler;
  }

  // ==================== IContentHandler 接口（可写部分） ====================

  /**
   * 统一的 update API（支持三种模式）
   *
   * 1. 直接设置新值：update(newData)
   * 2. 同步转换：update(current => ({ ...current, title: 'New' }))
   * 3. 异步转换：await update(async current => await process(current))
   */
  update(value: T): void;
  update(transform: (current: T) => T): void;
  update(transform: (current: T) => Promise<T>): Promise<void>;
  update(valueOrTransform: T | ((current: T) => T | Promise<T>)): void | Promise<void> {
    // 情况 1: 直接值
    if (typeof valueOrTransform !== 'function') {
      const text = this.stringify(valueOrTransform);
      this.fileHandler.update(text);
      return;
    }

    // 情况 2 & 3: 转换函数
    const transform = valueOrTransform as (current: T) => T | Promise<T>;

    // 获取当前数据
    const currentContent = this.content();
    if (!ContentUtils.isLoaded(currentContent)) {
      throw new Error(`Cannot update: data not loaded (status: ${currentContent.status})`);
    }

    const currentData = currentContent.value;

    // 执行转换
    const result = transform(currentData);

    // 判断是同步还是异步
    if (result instanceof Promise) {
      // 异步转换
      return result.then((newData) => {
        const text = this.stringify(newData);
        this.fileHandler.update(text);
      });
    } else {
      // 同步转换
      const text = this.stringify(result);
      this.fileHandler.update(text);
    }
  }
}
