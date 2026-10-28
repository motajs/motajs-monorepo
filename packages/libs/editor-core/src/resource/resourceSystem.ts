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
  ResourceContent,
} from './types';

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

    if (typeof data === 'string') await this.fs.writeFile(id, data);
    else await this.fs.writeBinary(id, data);

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

    this.index.remove(id);
    this.cache.invalidate(id);
  }

  async moveResource(source: IResourceIdentifier, destination: IResourceIdentifier): Promise<void> {
    if (!this.fs) {
      logger.error('system.notInitialized', 'Resource');
      return;
    }

    await this.fs.moveFile(source, destination);

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

  async updateResource(id: IResourceIdentifier): Promise<void> {
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
    this.unwatch?.();
    this.unwatch = null;
    this.index.clear();
    this.cache.clear();
    this.fs = null;
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
