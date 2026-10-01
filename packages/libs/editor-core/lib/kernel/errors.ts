import { DIAGNOSTIC_CODES } from './diagnostics';
import { Diagnostic } from './types';

export class EditorCoreStartupError extends Error {
  /** 构造末尾 `DiagnosticBus.snapshot()` 的全量诊断快照，已复制并冻结。 */
  public readonly diagnostics: readonly Diagnostic[];

  constructor(diagnostics: readonly Diagnostic[]) {
    const missing = diagnostics
      .filter((diagnostic) => diagnostic.code === DIAGNOSTIC_CODES.capabilityRequiredMissing)
      .map((diagnostic) => diagnostic.target ?? '(unknown)');
    const summary = missing.length > 0 ? missing.join('、') : 'unknown required capability';
    super(`Editor core startup failed: missing required capabilities: ${summary}`);
    this.name = 'EditorCoreStartupError';
    // 复制并冻结：`diagnostics` 承载传入的全量诊断，之后总线的历史再变化也不会改写它（D-08）
    this.diagnostics = Object.freeze([...diagnostics]);
  }
}
