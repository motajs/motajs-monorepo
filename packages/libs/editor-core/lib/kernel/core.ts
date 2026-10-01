import { DiagnosticBusImpl, DIAGNOSTIC_CODES } from './diagnostics';
import { EditorCoreStartupError } from './errors';
import {
  CapabilityRef,
  CapabilityRegistrar,
  Diagnostic,
  DiagnosticBus,
  DiagnosticSeverity,
  EditorCore,
  EditorCoreConfig,
  RegisterCapabilityOptions,
  RegisterCapabilityResult,
} from './types';

// 公开 API 版本。未冻结期按 semver 惯例视为不稳定；Phase 12 冻结接口面时升到 `1.0.0`（D-11）
// 是导出的常量，**不是** `EditorCore` 实例成员
export const EDITOR_CORE_API_VERSION = '0.1.0';

// 种类格式（D-17）：一段或多段以点分隔的段，允许 camelCase 与连字符
const KIND_PATTERN = /^[A-Za-z][\w-]*(\.[A-Za-z][\w-]*)*$/;

// core 自有的必需注册清单（D-07 的「内置半边」）
// Phase 3 刻意为空：core 还没有拥有任何 capability 种类（研究 A8）。常量存在是为了让 D-07 的
// 「`config` 显式清单 ∪ core 内置清单」这一并集机制真实可用，而非停留在纸面。它是冻结的常量，
// 不是可变状态；不导出，core 的种类常量随能力阶段到来（D-04）
const BUILTIN_REQUIRED_CAPABILITIES: readonly string[] = Object.freeze([]);

interface RegistryEntry {
  readonly kind: string;
  readonly id: string;
  readonly value: unknown;
  readonly owner?: string;
  readonly replaceable: boolean;
}

export class EditorCoreKernel implements EditorCore {
  /** 诊断总线：构造期间与之后产生的诊断都留在它上面。 */
  readonly diagnostics: DiagnosticBus;

  /** 能力登记表：键是 `kind:id`，值是该条登记行。 */
  private readonly entries: Map<string, RegistryEntry>;

  /** 拆除栈：构造期间与之后登记，销毁时逆序释放。 */
  private readonly teardowns: Array<() => void>;

  /** 是否已拆除：置位后 `EditorCore.dispose()` 重入为 no-op。 */
  private disposed: boolean;

  constructor(config: EditorCoreConfig) {
    this.diagnostics = new DiagnosticBusImpl();
    this.entries = new Map<string, RegistryEntry>();
    this.teardowns = [];
    this.disposed = false;

    const registrar: CapabilityRegistrar = {
      register: this.registerCapability.bind(this),
      addTeardown: this.addTeardown.bind(this),
    };

    config.install?.(registrar);

    // 构造末尾统一核对必需注册（D-07）：粒度是具体 `kind:id`，集合为 config 显式清单 ∪ core 内置清单
    const requiredRefs = new Set<string>([...(config.requiredCapabilities ?? []), ...BUILTIN_REQUIRED_CAPABILITIES]);
    let missingCount = 0;
    for (const ref of requiredRefs) {
      if (this.entries.has(ref)) continue;
      missingCount += 1;
      this.diagnostics.push({
        severity: DiagnosticSeverity.Error,
        code: DIAGNOSTIC_CODES.capabilityRequiredMissing,
        message: `缺少必需的能力注册：${ref}`,
        target: ref,
      });
    }

    // 只有「必需项缺失」阻断启动（D-08）：逆序释放已创建的部分，再抛出携带全部诊断的专用错误
    // 其它 error 级诊断（例如一次被拒的重复注册）不阻断，会随实例的正常返回保留在总线历史里
    if (missingCount > 0) {
      this.drainTeardowns();
      throw new EditorCoreStartupError(this.diagnostics.snapshot());
    }
  }

  registerCapability(
    kind: string,
    id: string,
    value: unknown,
    options?: RegisterCapabilityOptions,
  ): RegisterCapabilityResult {
    const target = this.keyOf(kind, id);

    if (!KIND_PATTERN.test(kind)) {
      const diagnostic: Diagnostic = {
        severity: DiagnosticSeverity.Error,
        code: DIAGNOSTIC_CODES.capabilityKindInvalid,
        message: `能力种类名不合法：${kind}`,
        target,
      };
      this.diagnostics.push(diagnostic);
      return { disposer: this.noop, diagnostics: [diagnostic] };
    }

    const existing = this.entries.get(target);
    if (existing && existing.replaceable !== true) {
      const diagnostic: Diagnostic = {
        severity: DiagnosticSeverity.Error,
        code: DIAGNOSTIC_CODES.capabilityDuplicate,
        message: `能力已被占用：${target}`,
        owner: existing.owner,
        target,
      };
      this.diagnostics.push(diagnostic);
      return { disposer: this.noop, diagnostics: [diagnostic] };
    }

    const entry: RegistryEntry = {
      kind,
      id,
      value,
      owner: options?.owner,
      replaceable: options?.replaceable === true,
    };
    const disposer = (): void => {
      if (this.entries.get(target) === entry) this.entries.delete(target);
    };

    this.entries.set(target, entry);
    this.teardowns.push(disposer);
    return { disposer, diagnostics: [] };
  }

  getCapability<T = unknown>(kind: string, id: string): T | undefined {
    const entry = this.entries.get(this.keyOf(kind, id));
    return entry ? (entry.value as T) : undefined;
  }

  getCapabilityOrThrow<T = unknown>(kind: string, id: string): T {
    const entry = this.entries.get(this.keyOf(kind, id));
    if (!entry) throw new Error(`Capability not registered: ${this.keyOf(kind, id)}`);
    return entry.value as T;
  }

  snapshotCapabilities(): readonly CapabilityRef[] {
    return Object.freeze(
      [...this.entries.values()].map((entry) => ({
        kind: entry.kind,
        id: entry.id,
        value: entry.value,
        owner: entry.owner,
      })),
    );
  }

  dispose(): void {
    // 先置位再干活：从某个拆除钩子内部重入 `EditorCore.dispose()` 是 no-op，第二次调用也不会重跑或重报（D-09）
    if (this.disposed) return;
    this.disposed = true;
    this.drainTeardowns();
  }

  addTeardown(teardown: () => void): void {
    this.teardowns.push(teardown);
  }

  /**
   * 拼出登记表的主键。
   *
   * @param kind 能力种类名。
   * @param id 该种类内的实例 id。
   * @returns 形如 `kind:id` 的主键。
   */
  private keyOf(kind: string, id: string): string {
    return `${kind}:${id}`;
  }

  /**
   * 逆序排空拆除栈，并逐项隔离抛出（D-09/D-21）。
   *
   * 这是「逆序 + 逐项 `try`/`catch` + 报告」的**唯一实现**：`EditorCore.dispose()` 与启动失败路径
   * 共用它，因此失败路径不会是第二份略有差异的副本。抛出的拆除钩子不会中断循环、不会被重跑、
   * 也不会以 throw 逃逸；每个失败追加一条 `lifecycle.teardown-failed` 诊断到同一条总线，并额外打印
   * 一行带 `editor-core:` 前缀的 console 记录（D-21 的两条通道：可被测试断言 + 现场可见）。
   */
  private drainTeardowns(): void {
    for (let index = this.teardowns.length - 1; index >= 0; index -= 1) {
      const teardown = this.teardowns[index];
      try {
        teardown();
      } catch (error) {
        const normalized = error instanceof Error ? error : new Error(String(error));
        console.error('editor-core: teardown failed', normalized);
        this.diagnostics.push({
          severity: DiagnosticSeverity.Error,
          code: DIAGNOSTIC_CODES.lifecycleTeardownFailed,
          message: `拆除钩子抛出错误（位置 ${index}），已隔离并继续拆除其余钩子。`,
          cause: error,
        });
      }
    }
  }

  /** 空操作：无效登记返回的 disposer（本身不持有任何状态，故不绑定 `this`）。 */
  private noop(): void {}
}
