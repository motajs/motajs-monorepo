import { computed, effect } from 'alien-signals';
import { waitUntil } from './waitUntil';
import { FileHandler } from './fileHandler';
import { Content, IDataHandler, ReadonlySignal } from './types';
import { ContentUtils } from './contentUtils';

export abstract class DataHandler<T> implements IDataHandler<T> {
  /** 数据层内容信号（computed，自动追踪 FileHandler）。 */
  readonly content: ReadonlySignal<Content<T>>;

  /** 底层文本处理器。 */
  protected fileHandler: FileHandler;

  /** 资源名称，仅用于错误消息。 */
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

  //#region 子类实现

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

  //#endregion

  //#region IContentView 接口

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

  subscribe(listener: (content: Content<T>) => void): () => void {
    return effect(() => {
      listener(this.content());
    });
  }

  async refetch(): Promise<void> {
    return this.fileHandler.refetch();
  }

  async ensureLoaded(): Promise<void> {
    return this.fileHandler.ensureLoaded();
  }

  getPath(): string {
    return this.fileHandler.getPath();
  }

  waitForLoaded(): Promise<void> {
    return waitUntil(() => this.content().status === 'loaded');
  }

  waitForSettled(): Promise<void> {
    return waitUntil(() => {
      const status = this.content().status;
      return status !== 'loading' && status !== 'idle';
    });
  }

  getFileHandler(): FileHandler {
    return this.fileHandler;
  }

  //#endregion

  //#region IContentHandler 接口（可写部分）

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

  //#endregion
}
