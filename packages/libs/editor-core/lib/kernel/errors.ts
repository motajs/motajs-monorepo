/**
 * 内核启动失败错误（引擎无关）。
 *
 * D-08：只有当必需注册未解析时 `createEditorCore` 才抛错，且必须携带**全部**诊断，
 * 使调用方与测试能区分「启动失败」与「代码 bug」。专用类名为此而设。
 *
 * 注意：不调用 `Error.captureStackTrace`。它是 V8/`@types/node` 专有 API，而 core 的
 * tsconfig（`lib: ESNext, DOM, DOM.Iterable`，无 `types`）刻意不依赖 `@types/node`，
 * 该调用会让 core 自己的 `typecheck` 失败；`super(message)` 已经捕获堆栈，对浏览器侧库足够。
 */
import { DIAGNOSTIC_CODES, type Diagnostic } from './diagnostics';

/**
 * 构造无法完成时抛出的唯一错误。
 *
 * `diagnostics` 是构造末尾 `DiagnosticBus.snapshot()` 的全量快照。
 */
export class EditorCoreStartupError extends Error {
  public readonly diagnostics: readonly Diagnostic[];

  constructor(diagnostics: readonly Diagnostic[]) {
    const missing = diagnostics
      .filter((diagnostic) => diagnostic.code === DIAGNOSTIC_CODES.capabilityRequiredMissing)
      .map((diagnostic) => diagnostic.target ?? '(unknown)');
    const summary = missing.length > 0 ? missing.join('、') : 'unknown required capability';
    super(`Editor core startup failed: missing required capabilities: ${summary}`);
    this.name = 'EditorCoreStartupError';
    // 复制并冻结：`diagnostics` 承载传入的全量诊断，之后总线的历史再变化也不会改写它（D-08）。
    this.diagnostics = Object.freeze([...diagnostics]);
  }
}
