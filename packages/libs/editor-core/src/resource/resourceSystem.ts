import { EditorEntryKind, EditorFileChangeKind, IEditorFileChange, IEditorFileSystem } from '../fs';
import { Hookable, HookController, IHookController } from '../hook';
import { logger } from '../log';
import { ContentCache } from './contentCache';
import { FileIndex } from './fileIndex';
import { Resource } from './resource';
import {
  IFileEntry,
  IResource,
  IResourceIdentifier,
  IResourceSystemAccess,
  IResourceSystemHooks,
  IResourceSystemOptions,
  PendingChangeListener,
  ResourceContent,
} from './types';
import { WriteBuffer } from './writeBuffer';

/**
 * 校验宿主报告的变化路径是否为规范化相对路径
 * @param path 待校验的变化路径
 * @returns 路径合法时为 true
 */
function isValidChangePath(path: string): boolean {
  if (path === '') return false;
  if (path.startsWith('/')) return false;
  if (path.includes('\\')) return false;
  if (path.includes(':')) return false;

  return path.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

export class ResourceSystem extends Hookable<IResourceSystemHooks> implements IResourceSystemAccess {
  /** 宿主注入的文件系统实现，未初始化时为空 */
  private fs: IEditorFileSystem | null = null;
  /** 项目文件索引，驱动目录列举并按增删移增量更新 */
  private readonly index: FileIndex = new FileIndex();
  /** 内容缓存池，按字节上限 + LRU 缓存已读内容 */
  private readonly cache: ContentCache = new ContentCache();
  /** 按路径的待写缓冲：内容改动先进这里，5 秒防抖到期后才写磁盘 */
  private readonly buffer: WriteBuffer = new WriteBuffer(
    (path, content) => this.writeToDisk(path, content),
    (paths) => this.handlePendingChange(paths),
  );
  /** 待写路径变化的订阅者集合 */
  private readonly pendingListeners: Set<PendingChangeListener> = new Set();
  /** 上一次「是否有待写」的通知值：只在有无变化时通知钩子，避免每次写入都刷新外壳 */
  private pendingNotified: boolean = false;
  /** 宿主文件变化流的退订函数，未订阅时为空 */
  private unwatch: (() => void) | null = null;

  protected createController(hook: Partial<IResourceSystemHooks>): IHookController<IResourceSystemHooks> {
    return new HookController(this, hook);
  }

  async initialize(fs: IEditorFileSystem, options?: IResourceSystemOptions): Promise<void> {
    this.fs = fs;

    await this.index.initialize(fs, options?.ignore ?? []);

    // 重复 initialize 也只保留一条订阅，绝不叠加
    this.unwatch?.();
    this.unwatch = fs.watch?.((change) => void this.handleFileChange(change)) ?? null;
  }

  async requestResource(id: IResourceIdentifier): Promise<IResource | null> {
    if (!this.fs) {
      logger.error('system.notInitialized', 'Resource');
      return null;
    }

    return new Resource(id, this);
  }

  async readContent(id: IResourceIdentifier): Promise<ResourceContent | undefined> {
    if (!this.fs) {
      logger.error('system.notInitialized', 'Resource');
      return undefined;
    }

    const pending = this.buffer.readPending(id);

    if (pending !== undefined) return pending;

    const cached = this.cache.get(id);

    if (cached !== undefined) return cached;

    const content = await this.fs.readFile(id);

    this.cache.set(id, content);
    return content;
  }

  /**
   * 读取指定路径文件的原始字节，命中缓存时直接返回
   * @param id 资源标识（纯路径）
   * @returns 文件的原始字节；资源不存在时为 undefined
   */
  async readBinary(id: IResourceIdentifier): Promise<Uint8Array | undefined> {
    if (!this.fs) {
      logger.error('system.notInitialized', 'Resource');
      return undefined;
    }

    const pending = this.buffer.readPending(id);

    if (pending instanceof Uint8Array) return pending;

    const cached = this.cache.get(id);

    if (cached instanceof Uint8Array) return cached;

    const content = await this.fs.readBinary(id);

    this.cache.set(id, content);
    return content;
  }

  async writeContent(id: IResourceIdentifier, data: ResourceContent): Promise<void> {
    if (!this.fs) {
      logger.error('system.notInitialized', 'Resource');
      return;
    }

    this.buffer.schedule(id, data);
    this.cache.set(id, data);
  }

  async createResource(id: IResourceIdentifier, content: ResourceContent): Promise<IResource | null> {
    if (!this.fs) {
      logger.error('system.notInitialized', 'Resource');
      return null;
    }

    if (typeof content === 'string') await this.fs.writeFile(id, content);
    else await this.fs.writeBinary(id, content);

    this.index.insert(id, EditorEntryKind.File);
    this.cache.set(id, content);

    return new Resource(id, this);
  }

  async deleteResource(id: IResourceIdentifier): Promise<void> {
    if (!this.fs) {
      logger.error('system.notInitialized', 'Resource');
      return;
    }

    await this.fs.deleteFile(id);

    if (this.buffer.has(id)) {
      this.buffer.discard(id);
      logger.warn('resource.pendingDiscarded', id);
    }

    this.index.remove(id);
    this.cache.invalidate(id);
  }

  async moveResource(source: IResourceIdentifier, destination: IResourceIdentifier): Promise<void> {
    if (!this.fs) {
      logger.error('system.notInitialized', 'Resource');
      return;
    }

    await this.fs.moveFile(source, destination);

    if (this.buffer.has(source)) {
      this.buffer.discard(source);
      logger.warn('resource.pendingDiscarded', source);
    }

    this.index.move(source, destination);
    this.cache.invalidate(source);
  }

  async listDirectory(path: string): Promise<readonly IFileEntry[]> {
    if (!this.fs) {
      logger.error('system.notInitialized', 'Resource');
      return [];
    }

    return this.index.list(path);
  }

  flushContent(identifier: IResourceIdentifier): Promise<void> {
    return this.buffer.flush(identifier);
  }

  discardPendingContent(identifier: IResourceIdentifier): void {
    this.buffer.discard(identifier);
    this.cache.invalidate(identifier);
  }

  watchPendingChange(listener: PendingChangeListener): () => void {
    this.pendingListeners.add(listener);
    listener(this.buffer.paths());

    return (): void => {
      this.pendingListeners.delete(listener);
    };
  }

  flushAllContent(): Promise<void> {
    return this.buffer.flushAll();
  }

  hasAnyPendingContent(): boolean {
    return this.buffer.size() > 0;
  }

  listPendingPaths(): readonly string[] {
    return this.buffer.paths();
  }

  async updateResource(id: IResourceIdentifier): Promise<void> {
    await this.noteExternalWrite(id);
    this.cache.invalidate(id);

    await Promise.all(
      this.forEachHook((hook) =>
        Promise.resolve()
          .then(() => hook.onUpdateResource?.(id))
          .catch((error: unknown) => {
            logger.error('resource.hookFailed', String(error));
          }),
      ),
    );
  }

  async dispose(): Promise<void> {
    try {
      await this.buffer.flushAll();
    } catch (error: unknown) {
      logger.error('resource.flushFailed', String(error));
    }

    this.buffer.clear();
    this.pendingListeners.clear();
    this.pendingNotified = false;
    this.unwatch?.();
    this.unwatch = null;
    this.index.clear();
    this.cache.clear();
    this.fs = null;
  }

  /**
   * 待写集合变化时先通知订阅者，再在「有没有待写」发生变化时通知一次钩子
   * @param paths 当前全部待写路径
   */
  private handlePendingChange(paths: readonly string[]): void {
    for (const listener of [...this.pendingListeners]) listener(paths);

    const hasPending = paths.length > 0;

    if (hasPending === this.pendingNotified) return;

    this.pendingNotified = hasPending;
    void this.emitPendingChange();
  }

  /** 通知钩子「有没有待写」发生了变化；单个钩子失败只记日志，不打断其余钩子 */
  private async emitPendingChange(): Promise<void> {
    await Promise.all(
      this.forEachHook((hook) =>
        Promise.resolve()
          .then(() => hook.onPendingChange?.())
          .catch((error: unknown) => {
            logger.error('resource.hookFailed', String(error));
          }),
      ),
    );
  }

  /**
   * 外部内容发生变化时，把该路径的待写标记成「外部已改」，保证待写不遮蔽外部写入
   *
   * 用文件系统裸读磁盘内容（不能走 `readContent`，它优先命中缓冲，等于拿待写内容跟自己比）；
   * 读失败或文件已被外部删除时按「不同内容」处理，让标记生效。
   * @param path 资源标识（纯路径）
   */
  private async noteExternalWrite(path: IResourceIdentifier): Promise<void> {
    const pending = this.buffer.readPending(path);

    if (pending === undefined) return;

    const fs = this.fs;

    if (!fs) return;

    let diskContent: ResourceContent | undefined;

    try {
      diskContent = typeof pending === 'string' ? await fs.readFile(path) : await fs.readBinary(path);
    } catch {
      diskContent = undefined;
    }

    this.buffer.noteExternalWrite(path, diskContent);
  }

  /**
   * 把一份内容真正写进磁盘；文件系统引用为空时只记日志、不抛出
   * @param path 资源标识（纯路径）
   * @param content 要写进磁盘的内容
   */
  private async writeToDisk(path: string, content: ResourceContent): Promise<void> {
    const fs = this.fs;

    if (!fs) {
      logger.error('system.notInitialized', 'Resource');
      return;
    }

    if (typeof content === 'string') await fs.writeFile(path, content);
    else await fs.writeBinary(path, content);
  }

  /**
   * 处理一条宿主文件变化：先校验路径，再按种类更新索引与缓存，最后原样通知钩子
   * @param change 宿主报告的变化事件
   */
  private async handleFileChange(change: IEditorFileChange): Promise<void> {
    const path = change.path;

    if (!isValidChangePath(path)) {
      logger.error('resource.invalidChangePath', path);
      return;
    }

    await this.noteExternalWrite(path);

    if (change.kind === EditorFileChangeKind.Add) {
      this.index.insert(path, EditorEntryKind.File);
    } else if (change.kind === EditorFileChangeKind.Delete) {
      this.index.remove(path);
      this.cache.invalidate(path);
    } else {
      this.cache.invalidate(path);
    }

    await Promise.all(
      this.forEachHook((hook) =>
        Promise.resolve()
          .then(() => hook.onResourceChange?.(path, change.kind))
          .catch((error: unknown) => {
            logger.error('resource.hookFailed', String(error));
          }),
      ),
    );
  }
}
