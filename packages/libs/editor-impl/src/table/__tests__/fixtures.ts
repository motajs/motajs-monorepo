import { IResourceIdentifier, IResourceInjection } from '@motajs/editor-core';

export class FakeResourceInjection implements IResourceInjection {
  /** 资源类型号到（资源 id 到内容）的映射 */
  readonly content: Map<number, Map<string, unknown>> = new Map();

  /** 资源类型号到资源标识符列表的映射 */
  readonly list: Map<number, IResourceIdentifier[]> = new Map();

  /** 请求时应抛错的资源 id 集合 */
  readonly failing: Set<string> = new Set();

  /** 请求时应永久挂起的资源 id 集合 */
  readonly hanging: Set<string> = new Set();

  // 向内存后端预置一个资源的内容及其所属的资源列表
  seed(id: IResourceIdentifier, value: unknown): void {
    let byId = this.content.get(id.type);

    if (!byId) {
      byId = new Map();
      this.content.set(id.type, byId);
    }

    byId.set(id.id, value);

    const ids = this.list.get(id.type) ?? [];
    ids.push(id);
    this.list.set(id.type, ids);
  }

  async requestResource<T>(id: IResourceIdentifier): Promise<T> {
    if (this.hanging.has(id.id)) return new Promise<T>(() => {});

    if (this.failing.has(id.id)) throw new Error(`request failed: ${id.id}`);

    return this.content.get(id.type)?.get(id.id) as T;
  }

  async requestResourceList(type: number): Promise<readonly IResourceIdentifier[]> {
    return this.list.get(type) ?? [];
  }

  async writeResource(id: IResourceIdentifier, content: unknown): Promise<void> {
    this.content.get(id.type)?.set(id.id, content);
  }

  async createResource(id: IResourceIdentifier, content: unknown): Promise<void> {
    this.seed(id, content);
  }

  async deleteResource(id: IResourceIdentifier): Promise<void> {
    this.content.get(id.type)?.delete(id.id);
  }
}
