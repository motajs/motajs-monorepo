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
 * - 构造是**原子**的：构造末尾核对必需注册，任一未解析即逆序排空已创建的部分并抛出
 *   `EditorCoreStartupError`（携带全部诊断），绝不交出半成品（D-07/D-08）。
 * - 本文件是 D-10 module-state 门禁唯一豁免的生产文件（它拥有拆除栈与 disposed 标志）。
 */
import { createDiagnosticBus, DIAGNOSTIC_CODES, type Diagnostic, type DiagnosticBus } from './diagnostics';
import { EditorCoreStartupError } from './errors';
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
 */
const KIND_PATTERN = /^[A-Za-z][\w-]*(\.[A-Za-z][\w-]*)*$/;

/**
 * core 自有的必需注册清单（D-07 的「内置半边」）。
 *
 * Phase 3 刻意为空：core 还没有拥有任何 capability 种类（研究 A8）。常量存在是为了让 D-07 的
 * 「`config` 显式清单 ∪ core 内置清单」这一并集机制真实可用，而非停留在纸面。它是冻结的常量，
 * 不是可变状态；不导出，core 的种类常量随能力阶段到来（D-04）。
 */
const BUILTIN_REQUIRED_CAPABILITIES: readonly string[] = Object.freeze([]);

/** registry 的存储行（module-private；`CapabilityRef` 是它唯一的公开视图）。 */
interface RegistryEntry {
  readonly kind: string;
  readonly id: string;
  readonly value: unknown;
  readonly owner?: string;
  readonly replaceable: boolean;
}

/**
 * 逆序排空拆除栈，并逐项隔离抛出（D-09/D-21）。
 *
 * 这是「逆序 + 逐项 `try`/`catch` + 报告」的**唯一实现**：`EditorCore.dispose()` 与启动失败路径
 * 共用它，因此失败路径不会是第二份略有差异的副本。抛出的拆除钩子不会中断循环、不会被重跑、
 * 也不会以 throw 逃逸；每个失败追加一条 `lifecycle.teardown-failed` 诊断到同一条总线，并额外打印
 * 一行带 `editor-core:` 前缀的 console 记录（D-21 的两条通道：可被测试断言 + 现场可见）。
 */
function drainTeardowns(teardowns: Array<() => void>, diagnostics: DiagnosticBus): void {
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
    // 先置位再干活：从某个拆除钩子内部重入 `EditorCore.dispose()` 是 no-op，第二次调用也不会重跑或重报（D-09）。
    if (disposed) return;
    disposed = true;
    drainTeardowns(teardowns, diagnostics);
  }

  const registrar: CapabilityRegistrar = {
    register: registerCapability,
    addTeardown: (teardown) => {
      teardowns.push(teardown);
    },
  };

  config.install?.(registrar);

  // 构造末尾统一核对必需注册（D-07）：粒度是具体 `kind:id`，集合为 config 显式清单 ∪ core 内置清单。
  const requiredRefs = new Set<string>([...(config.requiredCapabilities ?? []), ...BUILTIN_REQUIRED_CAPABILITIES]);
  let missingCount = 0;
  for (const ref of requiredRefs) {
    if (entries.has(ref)) continue;
    missingCount += 1;
    diagnostics.push({
      severity: 'error',
      code: DIAGNOSTIC_CODES.capabilityRequiredMissing,
      message: `缺少必需的能力注册：${ref}`,
      target: ref,
    });
  }

  // 只有「必需项缺失」阻断启动（D-08）：逆序释放已创建的部分，再抛出携带全部诊断的专用错误。
  // 其它 error 级诊断（例如一次被拒的重复注册）不阻断，会随实例的正常返回保留在总线历史里。
  if (missingCount > 0) {
    drainTeardowns(teardowns, diagnostics);
    throw new EditorCoreStartupError(diagnostics.snapshot());
  }

  return {
    registerCapability,
    getCapability,
    getCapabilityOrThrow,
    snapshotCapabilities,
    diagnostics,
    dispose,
  };
}
