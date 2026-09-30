import { ResourceDependencies } from '@motajs/editor-core';
import { FileHandler } from './fileHandler';
import { FileHandlerManager } from './fileHandlerManager';
import { Content, IDataHandler, ILoadableResource, ReadonlySignal } from './types';
import { ContentUtils } from './contentUtils';

// `FileResource<T>` —— core 中**唯一**允许持有「不透明 IO 地址」的类（D-06）
// 它是文件层之上的一层薄门面：把逻辑 id + 一个不透明 `address` + 处理器工厂绑定成一个
// `ILoadableResource<T>`，读取、加载锁与串行持久化全部委托给注入的 `FileHandlerManager`
// （per-path 缓存 + in-flight 加载锁）。本类**不**自己缓存、**不**加锁、**不**重写持久化
// 硬约束（D-06 / `@motajs/editor-core` 的 `lib/ports/fs.ts`）：
// - **地址不透明**：`address` 原样交给 `FileHandlerManager.get/load/reload`；本类不检查扩展名、
//   不拼接/解码/归一化任何路径——core 不拥有路径安全面，那是宿主的职责（T-05-02）
// - 文件层实例经构造参数 `deps.fileHandlers` 注入，**不**取自任何模块级单例（D-10）
export class FileResource<T> implements ILoadableResource<T> {
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
    // core 只把依赖缺口声明为 `unknown`（D-02/D-03）；默认实现层在此收窄回自己的文件层类型。
    this.manager = deps.fileHandlers as FileHandlerManager;
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
