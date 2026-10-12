import { IResourceIdentifier } from '@motajs/editor-core';
import { IMemoryBackend } from './types';

export class MemoryBackend implements IMemoryBackend {
  readonly maxUndoStep: number = 100;

  /** 按资源类型分桶的资源内容：类型编号 -> 资源 id -> 内容 */
  private readonly content: Map<number, Map<string, unknown>> = new Map();

  /** 按资源类型分桶的资源标识符列表：类型编号 -> 标识符列表 */
  private readonly list: Map<number, IResourceIdentifier[]> = new Map();

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

    const ids = this.list.get(id.type);

    if (!ids) return;

    this.list.set(
      id.type,
      ids.filter((item) => item.id !== id.id),
    );
  }
}
