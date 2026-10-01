import { isValidResourceId, RESERVED_IDS } from '@motajs/editor-core';
import { IResourceRegistry, IResourceView, ResourceRegistryEntry } from './types';

/**
 * 校验逻辑 id；不合法即抛出普通 `Error`（不产生机器诊断，见模块说明的 Pitfall 10）。
 *
 * 判定委托给底层（`editor-core`）自持的共享谓词 `isValidResourceId`（连同一份保留名清单
 * `RESERVED_IDS`）：登记期与定义期不可能各自漂移（D-09）。
 *
 * @param id 待校验的逻辑 id。
 */
function assertValidLogicalId(id: string): void {
  // 合法判定委托给共享谓词；不合法时再按原顺序复现**逐字未变**的抛出消息。
  if (isValidResourceId(id)) return;
  if (id.length === 0) throw new Error('Resource id 不能为空');
  if (/\s/.test(id)) throw new Error(`Resource id 不能包含空白字符：${JSON.stringify(id)}`);
  if (RESERVED_IDS.includes(id)) throw new Error(`Resource id 不允许使用保留名：${id}`);
  throw new Error(`Resource id 形式不合法：${id}`);
}

export class ResourceRegistry implements IResourceRegistry {
  /** 逻辑 id → 条目（实例字段，非模块状态）。 */
  private readonly entries: Map<string, ResourceRegistryEntry> = new Map();

  register<T>(id: string, resource: IResourceView<T>): () => void {
    assertValidLogicalId(id);
    if (this.entries.has(id)) throw new Error(`Resource already registered: ${id}`);

    const entry: ResourceRegistryEntry = { id, resource };
    const disposer = (): void => {
      if (this.entries.get(id) === entry) this.entries.delete(id);
    };
    this.entries.set(id, entry);
    return disposer;
  }

  get<T>(id: string): IResourceView<T> | undefined {
    const entry = this.entries.get(id);
    return entry ? (entry.resource as IResourceView<T>) : undefined;
  }

  getOrThrow<T>(id: string): IResourceView<T> {
    const entry = this.entries.get(id);
    if (!entry) throw new Error(`Resource not registered: ${id}`);
    return entry.resource as IResourceView<T>;
  }

  has(id: string): boolean {
    return this.entries.has(id);
  }

  ids(): readonly string[] {
    return [...this.entries.keys()];
  }

  snapshot(): readonly ResourceRegistryEntry[] {
    return Object.freeze(
      [...this.entries.values()].map((entry) => Object.freeze({ id: entry.id, resource: entry.resource })),
    );
  }
}
