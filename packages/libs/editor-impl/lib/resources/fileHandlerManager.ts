import { FileHandler } from './fileHandler';
import { FileHandlerDependencies, IFileHandlerManager } from './types';

/**
 * FileHandlerManager - FileHandler 实例管理器
 *
 * 职责：
 * - 管理 FileHandler 实例，确保同一文件路径只有一个实例（per-instance 缓存）
 * - 负责实例创建、加载协调、删除管理
 * - 提供加载锁机制，避免并发加载同一文件
 *
 * 去单例（D-06）：本模块只导出 class，不再有模块末尾的 `new`。实例由消费方（editor 的
 * `src/appInstances.ts`）构造；`FileHandler` 的协作者经 `this.deps` 透传，两者共享同一
 * `FileHandlerDependencies`，参数不可能写反。
 */
export class FileHandlerManager implements IFileHandlerManager {
  /** FileHandler 实例缓存：key = path（实例字段，非模块状态）。 */
  private handlers: Map<string, FileHandler> = new Map();

  /** 加载锁：key = path, value = 加载中的 Promise。 */
  private loadingPromises: Map<string, Promise<FileHandler>> = new Map();

  /** 共享的注入协作者。 */
  private readonly deps: FileHandlerDependencies;

  constructor(deps: FileHandlerDependencies) {
    this.deps = deps;
  }

  /**
   * 同步获取或创建 FileHandler（未加载状态）
   *
   * @example
   * const handler = FileHandlerManager.get('file.txt');
   * handler.subscribe(content => console.log(content));
   * FileHandlerManager.load('file.txt'); // 异步加载
   */
  get(path: string): FileHandler {
    let handler = this.handlers.get(path);

    if (!handler) {
      handler = new FileHandler(path, this.deps);
      this.handlers.set(path, handler);
    }

    return handler;
  }

  /**
   * 异步加载：确保文件已加载（带加载锁）
   *
   * 并发 load() 同一文件时，返回同一个 Promise，避免重复加载
   *
   * @example
   * const handler = await FileHandlerManager.load('file.txt');
   * const content = handler.getContent();
   */
  async load(path: string): Promise<FileHandler> {
    // 检查是否已有加载中的 Promise
    const existingPromise = this.loadingPromises.get(path);
    if (existingPromise) {
      return existingPromise;
    }

    // 获取或创建 handler
    const handler = this.get(path);

    // 如果已加载，直接返回
    if (handler.isLoaded()) {
      return handler;
    }

    // 创建加载 Promise
    const loadPromise = (async () => {
      try {
        await handler.ensureLoaded();
        return handler;
      } finally {
        // 加载完成后移除锁
        this.loadingPromises.delete(path);
      }
    })();

    // 保存加载 Promise
    this.loadingPromises.set(path, loadPromise);

    return loadPromise;
  }

  /**
   * 批量加载
   *
   * @example
   * await FileHandlerManager.loadAll(['file1.txt', 'file2.txt']);
   */
  async loadAll(paths: string[]): Promise<FileHandler[]> {
    return Promise.all(paths.map((path) => this.load(path)));
  }

  /**
   * 检查 FileHandler 是否存在
   */
  has(path: string): boolean {
    return this.handlers.has(path);
  }

  /**
   * 检查文件是否存在于文件系统
   */
  async exists(path: string): Promise<boolean> {
    const handler = this.handlers.get(path);
    const content = handler?.getContent();
    if (content?.status === 'loaded') return true;
    if (content?.status === 'not-found') return false;

    try {
      await this.deps.fs.readFile(path, 'utf-8');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 检查 FileHandler 是否已加载数据
   */
  isLoaded(path: string): boolean {
    const handler = this.handlers.get(path);
    return handler ? handler.isLoaded() : false;
  }

  /**
   * 删除文件和 FileHandler
   *
   * @param path 文件路径
   *
   * @example
   * await FileHandlerManager.delete('file.txt');
   */
  async delete(path: string): Promise<void> {
    const handler = this.get(path);
    await handler.delete();
  }

  /**
   * 移除 FileHandler 实例（不删除文件）
   *
   * @example
   * FileHandlerManager.remove('file.txt');
   */
  remove(path: string): void {
    this.handlers.delete(path);
  }

  /**
   * 强制重新加载
   *
   * @example
   * await FileHandlerManager.reload('file.txt');
   */
  async reload(path: string): Promise<void> {
    const handler = this.get(path);
    await handler.refetch();
  }

  /**
   * 清空所有 FileHandler（用于测试）
   */
  clear(): void {
    this.handlers.clear();
    this.loadingPromises.clear();
  }

  /**
   * 获取当前 FileHandler 数量（用于调试）
   */
  size(): number {
    return this.handlers.size;
  }
}
