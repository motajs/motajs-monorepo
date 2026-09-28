/**
 * `FileResource<T>` —— core 中**唯一**允许持有「不透明 IO 地址」的类（D-06）。
 *
 * 它是文件层之上的一层薄门面：把逻辑 id + 一个不透明 `address` + 处理器工厂绑定成一个
 * `LoadableResource<T>`，读取、加载锁与串行持久化全部委托给注入的 `FileHandlerManager`
 * （per-path 缓存 + in-flight 加载锁）。本类**不**自己缓存、**不**加锁、**不**重写持久化。
 *
 * 硬约束（D-06 / ports/fs.ts:16-18）：
 * - **地址不透明**：`address` 原样交给 `FileHandlerManager.get/load/reload`；本类不检查扩展名、
 *   不拼接/解码/归一化任何路径——core 不拥有路径安全面，那是宿主的职责（T-05-02）。
 * - 文件层实例经构造参数 `deps.fileHandlers` 注入，**不**取自任何模块级单例（D-10）。
 */

import type { ResourceDependencies } from '../ports/engine';
import type { FileHandler } from './fileHandler';
import type { FileHandlerManager } from './fileHandlerManager';
import type { IDataHandler } from './interfaces';
import type { Content } from './types';
import type { ReadonlySignal } from './interfaces';
import type { LoadableResource } from './combinators';
import { ContentUtils } from './contentUtils';

export class FileResource<T> implements LoadableResource<T> {
  readonly id: string;
  readonly content: ReadonlySignal<Content<T>>;

  /** 不透明 IO 地址：本类只透传给文件层，绝不解释（D-06）。 */
  private readonly address: string;

  /** 注入的 per-instance 文件层；加载锁与 refetch 语义都在它那里。 */
  private readonly manager: FileHandlerManager;

  /** 数据层处理器：由适配器侧的处理器工厂在构造时建立。 */
  private readonly handler: IDataHandler<T>;

  constructor(
    id: string,
    address: string,
    handlerFactory: (file: FileHandler) => IDataHandler<T>,
    deps: ResourceDependencies,
  ) {
    this.id = id;
    this.address = address;
    this.manager = deps.fileHandlers;
    // per-path 缓存：同一地址复用同一 FileHandler；首次遇到时创建。
    const file = this.manager.get(address);
    this.handler = handlerFactory(file);
    this.content = this.handler.content;
  }

  snapshot(): Content<T> {
    return this.handler.getContent();
  }

  value(): T {
    return ContentUtils.unwrap(this.handler.getContent(), this.id);
  }

  subscribe(listener: (content: Content<T>) => void): () => void {
    return this.handler.subscribe(listener);
  }

  async ensureLoaded(): Promise<void> {
    // 加载锁与「已加载则跳过」的语义由 manager 拥有（FileHandlerManager.load）。
    await this.manager.load(this.address);
  }

  async reload(): Promise<void> {
    await this.manager.reload(this.address);
  }

  async waitForSettled(): Promise<void> {
    await this.handler.waitForSettled();
  }
}
