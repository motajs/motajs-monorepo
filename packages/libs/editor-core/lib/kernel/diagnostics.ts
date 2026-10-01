import { Diagnostic, DiagnosticBus, DiagnosticSeverity } from './types';

//#region 机器码表

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

//#endregion

//#region 实现

export class DiagnosticBusImpl implements DiagnosticBus {
  /** 追加式诊断历史；快照返回它的不可变副本。 */
  private readonly history: Diagnostic[] = [];

  /** 订阅者集合；subscribe 加入，返回的 unsubscribe 移除。 */
  private readonly listeners: Set<(diagnostic: Diagnostic) => void> = new Set();

  push(diagnostic: Diagnostic): void {
    this.history.push(diagnostic);
    this.dispatch(diagnostic);
  }

  snapshot(): readonly Diagnostic[] {
    return Object.freeze([...this.history]);
  }

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

//#endregion
