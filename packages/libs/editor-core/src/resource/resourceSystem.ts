import { Hookable, HookController, IHookController } from '../hook';
import { Resource } from './resource';
import {
  IResource,
  IResourceIdentifier,
  IResourceInjection,
  IResourceSystemAccess,
  IResourceSystemHooks,
} from './types';

export class ResourceSystem extends Hookable<IResourceSystemHooks> implements IResourceSystemAccess {
  private injection!: IResourceInjection;

  private readonly listCache: Map<number, readonly IResourceIdentifier[]> = new Map();

  private readonly contentCache: Map<number, Map<string, unknown>> = new Map();

  protected createController(hook: Partial<IResourceSystemHooks>): IHookController<IResourceSystemHooks> {
    return new HookController(this, hook);
  }

  async initialize(injection: IResourceInjection): Promise<void> {
    this.injection = injection;
  }

  // 仅供面板上下文内部使用
  async requestResourceList(type: number): Promise<readonly IResourceIdentifier[]> {
    const cached = this.listCache.get(type);

    if (cached) return cached;

    const list = await this.injection.requestResourceList(type);
    this.listCache.set(type, list);
    return list;
  }

  // 仅供面板上下文内部使用
  async requestResource<T>(id: IResourceIdentifier): Promise<IResource<T> | null> {
    const list = await this.requestResourceList(id.type);
    const found = list.some((item) => item.type === id.type && item.id === id.id);

    if (!found) return null;

    return new Resource<T>(id, this);
  }

  async readContent<T>(id: IResourceIdentifier): Promise<T> {
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
    await this.injection.writeResource(id, data);
    const target = this.contentCache.getOrInsertComputed(id.type, () => new Map());

    target.set(id.id, data);
  }

  // 仅供面板上下文内部使用
  async createResource<T>(id: IResourceIdentifier, content: T): Promise<IResource<T>> {
    await this.injection.createResource(id, content);
    const target = this.contentCache.getOrInsertComputed(id.type, () => new Map());

    target.set(id.id, content);

    await this.updateResourceList(id.type);
    return new Resource<T>(id, this);
  }

  // 仅供面板上下文内部使用
  async deleteResource(id: IResourceIdentifier): Promise<void> {
    await this.injection.deleteResource(id);
    this.contentCache.get(id.type)?.delete(id.id);
    await this.updateResourceList(id.type);
  }

  async updateResource(id: IResourceIdentifier): Promise<void> {
    this.contentCache.get(id.type)?.delete(id.id);
    await Promise.all(this.forEachHook((hook) => hook.onUpdateResource?.(id)));
  }

  async updateResourceList(type: number): Promise<void> {
    this.listCache.delete(type);
    await Promise.all(this.forEachHook((hook) => hook.onUpdateResourceList?.(type)));
  }

  async dispose(): Promise<void> {
    this.listCache.clear();
    this.contentCache.clear();
  }
}
