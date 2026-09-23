/**
 * 内核组合根（引擎无关）。
 *
 * `createEditorCore(config)` 是**唯一的构造入口**：它把一个 per-instance 的对象图装配起来——
 * 一个诊断总线、一个 capability registry、一条拆除栈——并把它以最小暴露面的 `EditorCore`
 * 实例交出去。`@motajs/editor` 现有的 6 个模块级 singleton 在本阶段**不受影响**（D-13 只增不删）；
 * 迁移在 Phase 4/5，切换与删除在 Phase 11。
 *
 * 设计约束：
 * - 组合根持有私有 service wiring，但**不对外暴露**；公开面只有注册表四件套 + `.diagnostics` + `.dispose()`（D-12）。
 * - 配置回调只拿到一个**窄接口** `CapabilityRegistrar`，绝不拿到实例本身（D-18）。
 * - 注册表存储与种类格式校验都在本文件的闭包内（`registry.ts` 只放契约类型，D-01/N-03）。
 * - 本文件是 D-10 module-state 门禁唯一豁免的生产文件（它拥有拆除栈与 disposed 标志）。
 */
import { createDiagnosticBus, DIAGNOSTIC_CODES, type Diagnostic, type DiagnosticBus } from './diagnostics';
import type { CapabilityRef, RegisterCapabilityOptions, RegisterCapabilityResult } from './registry';

/**
 * 公开 API 版本。未冻结期按 semver 惯例视为不稳定；Phase 12 冻结接口面时升到 `1.0.0`（D-11）。
 * 是导出的常量，**不是** `EditorCore` 实例成员。
 */
export const EDITOR_CORE_API_VERSION = '0.1.0';

/**
 * 交给 `config.install` 的**窄接口**（D-18）。
 *
 * 它绝不等于 `EditorCore` 实例：只允许在构造期间注册能力、登记拆除钩子。
 */
export interface CapabilityRegistrar {
  register(kind: string, id: string, value: unknown, options?: RegisterCapabilityOptions): RegisterCapabilityResult;
  addTeardown(teardown: () => void): void;
}

/** `createEditorCore` 的配置（N-02）。不提供任何暴露实例的通路（D-12）。 */
export interface EditorCoreConfig {
  readonly install?: (registrar: CapabilityRegistrar) => void;
  readonly requiredCapabilities?: readonly string[];
}

/** per-instance 内核的最小公开面（D-12）。 */
export interface EditorCore {
  registerCapability(
    kind: string,
    id: string,
    value: unknown,
    options?: RegisterCapabilityOptions,
  ): RegisterCapabilityResult;
  getCapability<T = unknown>(kind: string, id: string): T | undefined;
  getCapabilityOrThrow<T = unknown>(kind: string, id: string): T;
  snapshotCapabilities(): readonly CapabilityRef[];
  readonly diagnostics: DiagnosticBus;
  dispose(): void;
}

/**
 * 种类格式（D-17）：一段或多段以点分隔的段，允许 camelCase 与连字符。
 *
 * 注意：`BUILTIN_REQUIRED_CAPABILITIES`（core 内置必需清单，Phase 3 为空 `Object.freeze([])`）
 * 与「必需注册」的核对/原子失败路径属于 Plan 03-02；本 plan 不声明它，以免留下未使用的模块级绑定
 * （那会打破 lint 的 108 warning 基线）。
 */
const KIND_PATTERN = /^[A-Za-z][\w-]*(\.[A-Za-z][\w-]*)*$/;

/** registry 的存储行（module-private；`CapabilityRef` 是它唯一的公开视图）。 */
interface RegistryEntry {
  readonly kind: string;
  readonly id: string;
  readonly value: unknown;
  readonly owner?: string;
  readonly replaceable: boolean;
}

/**
 * 创建一个 per-instance 的 `EditorCore`。
 *
 * 全部可变容器（registry `Map`、拆除栈、`disposed` 标志、诊断总线历史）都在本函数的闭包内，
 * 因此两个实例天然互不干扰（KERN-06）。
 */
export function createEditorCore(config: EditorCoreConfig): EditorCore {
  const diagnostics = createDiagnosticBus();
  const entries = new Map<string, RegistryEntry>();
  const teardowns: Array<() => void> = [];
  let disposed = false;

  function keyOf(kind: string, id: string): string {
    return `${kind}:${id}`;
  }

  function noop(): void {}

  function registerCapability(
    kind: string,
    id: string,
    value: unknown,
    options?: RegisterCapabilityOptions,
  ): RegisterCapabilityResult {
    const target = keyOf(kind, id);

    if (!KIND_PATTERN.test(kind)) {
      const diagnostic: Diagnostic = {
        severity: 'error',
        code: DIAGNOSTIC_CODES.capabilityKindInvalid,
        message: `能力种类名不合法：${kind}`,
        target,
      };
      diagnostics.push(diagnostic);
      return { disposer: noop, diagnostics: [diagnostic] };
    }

    const existing = entries.get(target);
    if (existing && existing.replaceable !== true) {
      const diagnostic: Diagnostic = {
        severity: 'error',
        code: DIAGNOSTIC_CODES.capabilityDuplicate,
        message: `能力已被占用：${target}`,
        owner: existing.owner,
        target,
      };
      diagnostics.push(diagnostic);
      return { disposer: noop, diagnostics: [diagnostic] };
    }

    const entry: RegistryEntry = {
      kind,
      id,
      value,
      owner: options?.owner,
      replaceable: options?.replaceable === true,
    };
    const disposer = (): void => {
      if (entries.get(target) === entry) entries.delete(target);
    };

    entries.set(target, entry);
    teardowns.push(disposer);
    return { disposer, diagnostics: [] };
  }

  function getCapability<T = unknown>(kind: string, id: string): T | undefined {
    const entry = entries.get(keyOf(kind, id));
    return entry ? (entry.value as T) : undefined;
  }

  function getCapabilityOrThrow<T = unknown>(kind: string, id: string): T {
    const entry = entries.get(keyOf(kind, id));
    if (!entry) throw new Error(`Capability not registered: ${keyOf(kind, id)}`);
    return entry.value as T;
  }

  function snapshotCapabilities(): readonly CapabilityRef[] {
    return Object.freeze(
      [...entries.values()].map((entry) => ({
        kind: entry.kind,
        id: entry.id,
        value: entry.value,
        owner: entry.owner,
      })),
    );
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    for (let index = teardowns.length - 1; index >= 0; index -= 1) {
      const teardown = teardowns[index];
      try {
        teardown();
      } catch (error) {
        const normalized = error instanceof Error ? error : new Error(String(error));
        console.error('editor-core: teardown failed', normalized);
        diagnostics.push({
          severity: 'error',
          code: DIAGNOSTIC_CODES.lifecycleTeardownFailed,
          message: `拆除钩子抛出错误（位置 ${index}），已隔离并继续拆除其余钩子。`,
          cause: error,
        });
      }
    }
  }

  const registrar: CapabilityRegistrar = {
    register: registerCapability,
    addTeardown: (teardown) => {
      teardowns.push(teardown);
    },
  };

  config.install?.(registrar);

  return {
    registerCapability,
    getCapability,
    getCapabilityOrThrow,
    snapshotCapabilities,
    diagnostics,
    dispose,
  };
}
