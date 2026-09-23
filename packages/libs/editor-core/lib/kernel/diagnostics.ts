/**
 * 内核诊断总线（引擎无关）。
 *
 * D-05/D-06：`Diagnostic` 是最小形状——稳定机器码 `code` 供测试与 CI 精确断言，中文 `message`
 * 供人阅读，`cause` 保留原始抛出物；刻意不含 `timestamp`/`details`（需要时再扩）。
 * `DiagnosticBus` 同步派发并保留追加式历史：`DiagnosticBus.snapshot()` 读全部已发生的诊断，
 * `DiagnosticBus.subscribe()` 只收订阅之后的诊断——这使得 `createEditorCore` 构造期间产生的
 * 诊断在构造返回后仍可读到。
 *
 * 本模块没有任何模块级可变绑定：历史数组与订阅者集合都留在 `createDiagnosticBus` 的闭包内，
 * 因此每个实例互不干扰（KERN-06，D-10）。这与 `@motajs/editor` 的 `subscribeNotifications`
 * 相反——那里是模块级 `const listeners = new Set(...)`，是 core 结构性门禁明确禁止的形态。
 */

// ==================== 类型定义 ====================

/** 诊断级别：与 `severity` 字段一一对应。 */
export type DiagnosticSeverity = 'error' | 'warning' | 'info';

/**
 * 一条诊断。
 *
 * `code` 是稳定机器码（见 `DIAGNOSTIC_CODES`）；`message` 是中文人读说明；
 * `owner`/`target` 用于定位归属与目标 `kind:id`；`cause` 保留原始 `Error`/抛出值。
 */
export interface Diagnostic {
  readonly severity: DiagnosticSeverity;
  readonly code: string;
  readonly message: string;
  readonly owner?: string;
  readonly target?: string;
  readonly cause?: unknown;
}

/** 诊断总线：生产者 `push`，消费者 `snapshot` / `subscribe`。 */
export interface DiagnosticBus {
  push(diagnostic: Diagnostic): void;
  snapshot(): readonly Diagnostic[];
  subscribe(listener: (diagnostic: Diagnostic) => void): () => void;
}

// ==================== 机器码表 ====================

/**
 * 本阶段唯一稳定的诊断机器码表。
 *
 * 表格（而非散落的字符串常量）使测试与 CI 能断言精确取值；改名等于破坏性变更。
 */
export const DIAGNOSTIC_CODES = {
  capabilityDuplicate: 'capability.duplicate',
  capabilityKindInvalid: 'capability.kind-invalid',
  capabilityRequiredMissing: 'capability.required-missing',
  diagnosticSubscriberError: 'diagnostic.subscriber-error',
  lifecycleTeardownFailed: 'lifecycle.teardown-failed',
} as const;

/** 从 `DIAGNOSTIC_CODES` 派生的联合类型，便于消费者穷举 `code`。 */
export type DiagnosticCode = (typeof DIAGNOSTIC_CODES)[keyof typeof DIAGNOSTIC_CODES];

// ==================== 工厂 ====================

/**
 * 创建一个 **per-instance** 的诊断总线。
 *
 * 用工厂而非类：实现得以保持为闭包，模块本身不持有任何可变状态。
 */
export function createDiagnosticBus(): DiagnosticBus {
  const history: Diagnostic[] = [];
  const listeners = new Set<(diagnostic: Diagnostic) => void>();

  function dispatch(diagnostic: Diagnostic): void {
    for (const listener of [...listeners]) {
      try {
        listener(diagnostic);
      } catch (error) {
        // append-without-dispatch：订阅者抛错只追加一条历史，**不再派发**，因此结构上不可能递归
        // （总线不会从 catch 里重新进入自己的派发循环），且其它订阅者仍会收到原始诊断。
        history.push({
          severity: 'warning',
          code: DIAGNOSTIC_CODES.diagnosticSubscriberError,
          message: '诊断订阅者抛出错误，已隔离该订阅者。',
          cause: error,
        });
      }
    }
  }

  function push(diagnostic: Diagnostic): void {
    history.push(diagnostic);
    dispatch(diagnostic);
  }

  function snapshot(): readonly Diagnostic[] {
    return Object.freeze([...history]);
  }

  function subscribe(listener: (diagnostic: Diagnostic) => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  return { push, snapshot, subscribe };
}
