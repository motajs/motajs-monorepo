/**
 * capability registry 的**契约类型**（引擎无关）。
 *
 * D-01：注册表是 `EditorCore` 实例上的成员，实例是调用方唯一入口；因此这里只放契约类型——
 * 存储（`Map<string, RegistryEntry>`）与种类格式校验都留在 `createEditorCore` 的闭包内
 * （见 `lib/kernel/core.ts`），不额外导出第二个注册表工厂。
 *
 * 形状参照仓内先例 `RegisterPackResult`（`packages/apps/editor/src/blockly/registry/types.ts`）：
 * 注册结果携带诊断而非抛错（D-02）。
 */
import type { Diagnostic } from './diagnostics';

/** `EditorCore.snapshotCapabilities()` 返回的只读条目（D-19）。 */
export interface CapabilityRef {
  readonly kind: string;
  readonly id: string;
  readonly value: unknown;
  readonly owner?: string;
}

/** `EditorCore.registerCapability` 的第 4 参数（D-03）。 */
export interface RegisterCapabilityOptions {
  readonly owner?: string;
  readonly replaceable?: boolean;
}

/** `EditorCore.registerCapability` 的返回契约（D-02）。 */
export interface RegisterCapabilityResult {
  readonly disposer: () => void;
  readonly diagnostics: readonly Diagnostic[];
}
