import { Hookable, HookController, IHookController } from '../hook';
import { logger } from '../log';
import { Resource } from './resource';
import {
  IResource,
  IResourceIdentifier,
  IResourceInjection,
  IResourceSystemAccess,
  IResourceSystemHooks,
} from './types';

export class ResourceSystem extends Hookable<IResourceSystemHooks> implements IResourceSystemAccess {
  /** 后端资源注入对象，未初始化时为空 */
  private injection: IResourceInjection | null = null;

  /** 资源类型到资源标识符列表的缓存 */
  private readonly listCache: Map<number, readonly IResourceIdentifier[]> = new Map();

  /** 资源类型到（资源 id 到内容）的缓存 */
  private readonly contentCache: Map<number, Map<string, unknown>> = new Map();

  protected createController(hook: Partial<IResourceSystemHooks>): IHookController<IResourceSystemHooks> {
    return new HookController(this, hook);
  }

  async initialize(injection: IResourceInjection): Promise<void> {
    this.injection = injection;
  }

  async requestResourceList(type: number): Promise<readonly IResourceIdentifier[]> {
    if (!this.injection) {
      logger.error('system.notInitialized', 'Resource');
      return [];
    }

    const cached = this.listCache.get(type);

    if (cached) return cached;

    const list = await this.injection.requestResourceList(type);
    this.listCache.set(type, list);
    return list;
  }

  async requestResource<T>(id: IResourceIdentifier): Promise<IResource<T> | null> {
    if (!this.injection) {
      logger.error('system.notInitialized', 'Resource');
      return null;
    }

    const list = await this.requestResourceList(id.type);
    const found = list.some((item) => item.type === id.type && item.id === id.id);

    if (!found) return null;

    return new Resource<T>(id, this);
  }

  async readContent<T>(id: IResourceIdentifier): Promise<T | undefined> {
    if (!this.injection) {
      logger.error('system.notInitialized', 'Resource');
      return undefined;
    }

    const byId = this.contentCache.get(id.type);

    if (byId) {
      if (byId.has(id.id)) return byId.get(id.id) as T;
    }

    const content = await this.injection.requestResource<T>(id);
    const target = this.contentCache.getOrInsertComputed(id.type, () => new Map());

    target.set(id.id, content);
    return content;
  }

  async writeContent<T>(id: IResourceIdentifier, data: T): Promise<void> {
    if (!this.injection) {
      logger.error('system.notInitialized', 'Resource');
      return;
    }

    await this.injection.writeResource(id, data);
    const target = this.contentCache.getOrInsertComputed(id.type, () => new Map());

    target.set(id.id, data);
  }

  async createResource<T>(id: IResourceIdentifier, content: T): Promise<IResource<T> | null> {
    if (!this.injection) {
      logger.error('system.notInitialized', 'Resource');
      return null;
    }

    await this.injection.createResource(id, content);
    const target = this.contentCache.getOrInsertComputed(id.type, () => new Map());

    target.set(id.id, content);

    await this.updateResourceList(id.type);
    return new Resource<T>(id, this);
  }

  async deleteResource(id: IResourceIdentifier): Promise<void> {
    if (!this.injection) {
      logger.error('system.notInitialized', 'Resource');
      return;
    }

    await this.injection.deleteResource(id);
    this.contentCache.get(id.type)?.delete(id.id);
    await this.updateResourceList(id.type);
  }

  async updateResource(id: IResourceIdentifier): Promise<void> {
    this.contentCache.get(id.type)?.delete(id.id);
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

  async updateResourceList(type: number): Promise<void> {
    this.listCache.delete(type);
    await Promise.all(
      this.forEachHook((hook) =>
        Promise.resolve()
          .then(() => hook.onUpdateResourceList?.(type))
          .catch((error: unknown) => {
            logger.error('resource.hookFailed', String(error));
          }),
      ),
    );
  }

  async dispose(): Promise<void> {
    this.listCache.clear();
    this.contentCache.clear();
    this.injection = null;
  }
}
