import { FileHandler } from './fileHandler';
import { FileHandlerDependencies, IFileHandlerManager } from './types';

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

  get(path: string): FileHandler {
    let handler = this.handlers.get(path);

    if (!handler) {
      handler = new FileHandler(path, this.deps);
      this.handlers.set(path, handler);
    }

    return handler;
  }

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

  async loadAll(paths: string[]): Promise<FileHandler[]> {
    return Promise.all(paths.map((path) => this.load(path)));
  }

  has(path: string): boolean {
    return this.handlers.has(path);
  }

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

  isLoaded(path: string): boolean {
    const handler = this.handlers.get(path);
    return handler ? handler.isLoaded() : false;
  }

  async delete(path: string): Promise<void> {
    const handler = this.get(path);
    await handler.delete();
  }

  remove(path: string): void {
    this.handlers.delete(path);
  }

  async reload(path: string): Promise<void> {
    const handler = this.get(path);
    await handler.refetch();
  }

  clear(): void {
    this.handlers.clear();
    this.loadingPromises.clear();
  }

  size(): number {
    return this.handlers.size;
  }
}
