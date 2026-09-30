import { Diagnostic, DiagnosticBus, DiagnosticSeverity } from './types';

// 内核诊断总线（引擎无关）
// D-05/D-06：`Diagnostic` 是最小形状——稳定机器码 `code` 供测试与 CI 精确断言，中文 `message`
// 供人阅读，`cause` 保留原始抛出物；刻意不含 `timestamp`/`details`（需要时再扩）
// `DiagnosticBus` 同步派发并保留追加式历史：`DiagnosticBus.snapshot()` 读全部已发生的诊断，
// `DiagnosticBus.subscribe()` 只收订阅之后的诊断——这使得 `EditorCoreKernel` 构造期间产生的
// 诊断在构造返回后仍可读到
// 本模块没有任何模块级可变绑定：历史数组与订阅者集合都留在 `DiagnosticBusImpl` 的实例字段上，
// 因此每个实例互不干扰（KERN-06，D-10）。这与 `@motajs/editor` 的 `subscribeNotifications`
// 相反——那里是模块级 `const listeners = new Set(...)`，是 core 结构性门禁明确禁止的形态

// ==================== 机器码表 ====================

// 本阶段唯一稳定的诊断机器码表
// 表格（而非散落的字符串常量）使测试与 CI 能断言精确取值；改名等于破坏性变更
export const DIAGNOSTIC_CODES = {
  capabilityDuplicate: 'capability.duplicate',
  capabilityKindInvalid: 'capability.kind-invalid',
  capabilityRequiredMissing: 'capability.required-missing',
  diagnosticSubscriberError: 'diagnostic.subscriber-error',
  lifecycleTeardownFailed: 'lifecycle.teardown-failed',
} as const;

/** 从 `DIAGNOSTIC_CODES` 派生的联合类型，便于消费者穷举 `code`。 */
export type DiagnosticCode = (typeof DIAGNOSTIC_CODES)[keyof typeof DIAGNOSTIC_CODES];

// ==================== 实现 ====================

// 一个 per-instance 的诊断总线：历史数组与订阅者集合都是实例字段，模块本身不持有任何可变状态（D-05）
export class DiagnosticBusImpl implements DiagnosticBus {
  /** 追加式诊断历史；快照返回它的不可变副本。 */
  private readonly history: Diagnostic[] = [];

  /** 订阅者集合；subscribe 加入，返回的 unsubscribe 移除。 */
  private readonly listeners: Set<(diagnostic: Diagnostic) => void> = new Set();

  /**
   * 追加一条诊断并同步派发给全部订阅者。
   *
   * @param diagnostic 要记录并派发的诊断。
   */
  push(diagnostic: Diagnostic): void {
    this.history.push(diagnostic);
    this.dispatch(diagnostic);
  }

  /** 按顺序返回全部历史的不可变副本。 */
  snapshot(): readonly Diagnostic[] {
    return Object.freeze([...this.history]);
  }

  /**
   * 订阅订阅之后的诊断。
   *
   * @param listener 收到每条新诊断时同步调用。
   * @returns 取消订阅函数。
   */
  subscribe(listener: (diagnostic: Diagnostic) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 同步派发给全部订阅者，并逐项隔离抛错。
   *
   * append-without-dispatch：订阅者抛错只追加一条历史，**不再派发**，因此结构上不可能递归
   * （总线不会从 catch 里重新进入自己的派发循环），且其它订阅者仍会收到原始诊断。
   *
   * @param diagnostic 要派发的诊断。
   */
  private dispatch(diagnostic: Diagnostic): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(diagnostic);
      } catch (error) {
        this.history.push({
          severity: DiagnosticSeverity.Warning,
          code: DIAGNOSTIC_CODES.diagnosticSubscriberError,
          message: '诊断订阅者抛出错误，已隔离该订阅者。',
          cause: error,
        });
      }
    }
  }
}
