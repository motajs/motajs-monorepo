import { isValidResourceId, RESERVED_IDS } from '@motajs/editor-core';
import { IResourceRegistry, IResourceView, ResourceRegistryEntry } from './types';

/**
 * 逻辑 id → 资源 的注册表（RES-02，引擎无关）。
 *
 * 这是 RES-02 要求的「通用逻辑 id 注册」这一最小机制：把任意 `IResourceView<T>` 以字符串逻辑 id
 * 登记进来，供上层（Phase 5 的引擎描述符、preview 网关、project model）按 id 取用。
 *
 * 设计约束：
 * - **per-instance 可变状态**：存储是实例字段上的 `Map`（不是模块级容器，D-10 门禁的前提），
 *   两个实例天然互不干扰（T-04-02）。
 * - **原型污染安全**（T-04-01/V5）：只用 `Map` 键，绝不往普通对象上赋值；`__proto__`/`constructor`/
 *   `prototype` 等保留名与一切非法形式在登记前被拒。
 * - **与 `DiagnosticBus` 解耦**（Pitfall 10）：本文件不 import 诊断总线、不新增机器码；重复 id 与非法 id
 *   都是普通抛错。`lib/__tests__/coreApiSurface.test.ts` 断言 `DIAGNOSTIC_CODES` 恰好五个，耦合会误红。
 * - 与 `createEditorCore` 一致：登记返回**只删除自己那一条**的 disposer，快照返回冻结数组。
 * - 本阶段**刻意不接线**：`projectData` 等不使用它，引擎描述符由 Phase 5 注入（RES-02 的诚实范围）。
 */

/**
 * 校验逻辑 id；不合法即抛出普通 `Error`（不产生机器诊断，见模块说明的 Pitfall 10）。
 *
 * 判定委托给底层（`editor-core`）自持的共享谓词 `isValidResourceId`（连同一份保留名清单
 * `RESERVED_IDS`）：登记期与定义期不可能各自漂移（D-09）。
 */
function assertValidLogicalId(id: string): void {
  // 合法判定委托给共享谓词；不合法时再按原顺序复现**逐字未变**的抛出消息。
  if (isValidResourceId(id)) return;
  if (id.length === 0) throw new Error('Resource id 不能为空');
  if (/\s/.test(id)) throw new Error(`Resource id 不能包含空白字符：${JSON.stringify(id)}`);
  if (RESERVED_IDS.includes(id)) throw new Error(`Resource id 不允许使用保留名：${id}`);
  throw new Error(`Resource id 形式不合法：${id}`);
}

/**
 * per-instance 的逻辑 id 资源注册表。
 *
 * 构造后即用，无模块级实例（D-06）；`ResourceRegistry.register` 返回的 disposer 只删除自己那一条，
 * 因此「过期 disposer」不会误删后来重新登记的同名条目。
 */
export class ResourceRegistry implements IResourceRegistry {
  /** 逻辑 id → 条目（实例字段，非模块状态）。 */
  private readonly entries: Map<string, ResourceRegistryEntry> = new Map();

  /** 以逻辑 id 登记一个资源；返回只删除本次登记的 disposer。重复 id 或非法 id 抛出普通 `Error`。 */
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

  /** 按逻辑 id 取用资源；未登记返回 `undefined`。 */
  get<T>(id: string): IResourceView<T> | undefined {
    const entry = this.entries.get(id);
    return entry ? (entry.resource as IResourceView<T>) : undefined;
  }

  /** 按逻辑 id 取用资源；未登记抛出命名该 id 的 `Error`（镜像 `Capability not registered: …`）。 */
  getOrThrow<T>(id: string): IResourceView<T> {
    const entry = this.entries.get(id);
    if (!entry) throw new Error(`Resource not registered: ${id}`);
    return entry.resource as IResourceView<T>;
  }

  /** 该逻辑 id 是否已登记。 */
  has(id: string): boolean {
    return this.entries.has(id);
  }

  /** 已登记的逻辑 id 列表（返回新数组，改动它不影响注册表）。 */
  ids(): readonly string[] {
    return [...this.entries.keys()];
  }

  /** 冻结的条目快照（数组与每个条目都冻结）。 */
  snapshot(): readonly ResourceRegistryEntry[] {
    return Object.freeze(
      [...this.entries.values()].map((entry) => Object.freeze({ id: entry.id, resource: entry.resource })),
    );
  }
}
