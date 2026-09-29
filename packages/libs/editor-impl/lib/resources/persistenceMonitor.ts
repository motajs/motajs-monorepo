import { effect, signal } from 'alien-signals';
import { PersistExecutor } from './persistExecutor';
import { PersistFailure, PersistenceIntent } from './types';
import { IPersistenceMonitor, ReadonlySignal } from './interfaces';

/** 把反斜杠与 `./` 前缀归一化，使同一路径只拥有一个控制器。 */
function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\/+/, '');
}

/**
 * 项目级、按路径归属的持久化管理器。
 *
 * 汇总各路径的持久化状态，提供 flush、失败记录与统一重试。
 */
export class PersistenceMonitor implements IPersistenceMonitor {
  /** 路径 → 持久化控制器。 */
  private readonly controllers: Map<string, PersistExecutor> = new Map();

  /** 正在持久化的路径集合。 */
  private readonly persistingSet: Set<string> = new Set();

  /** 持久化失败的路径 → 错误。 */
  private readonly failedMap: Map<string, Error> = new Map();

  /** 可写的正在持久化路径信号。 */
  private _persistingFiles: ReturnType<typeof signal<string[]>> = signal<string[]>([]);

  /** 可写的失败列表信号。 */
  private _failedFiles: ReturnType<typeof signal<PersistFailure[]>> = signal<PersistFailure[]>([]);

  /** 可写的重试中信号。 */
  private _retrying: ReturnType<typeof signal<boolean>> = signal(false);

  readonly persistingFiles = this._persistingFiles as ReadonlySignal<string[]>;
  readonly failedFiles = this._failedFiles as ReadonlySignal<PersistFailure[]>;
  readonly retrying = this._retrying as ReadonlySignal<boolean>;

  private controller(path: string, legacyOperation?: () => Promise<void>): PersistExecutor {
    const normalized = normalizePath(path);
    const existing = this.controllers.get(normalized);
    if (existing) return existing;

    const controller = new PersistExecutor(legacyOperation);
    this.controllers.set(normalized, controller);
    effect(() => {
      const status = controller.status();
      if (status.status === 'executing') {
        this.persistingSet.add(normalized);
        // Keep an existing failure visible while its retry is in progress.
      } else if (status.status === 'error') {
        this.persistingSet.delete(normalized);
        this.failedMap.set(normalized, status.error);
      } else {
        this.persistingSet.delete(normalized);
        this.failedMap.delete(normalized);
      }
      this.updateSignals();
    });
    return controller;
  }

  /** Legacy/test adapter. Production resources submit immutable intents. */
  createExecutor(path: string, operation: () => Promise<void>): PersistExecutor {
    return this.controller(path, operation);
  }

  schedule(path: string, intent: PersistenceIntent): void {
    this.controller(path).schedule(intent);
  }

  async retryFailed(): Promise<PersistFailure[]> {
    const paths = [...this.failedMap.keys()];
    if (paths.length === 0) return [];
    this._retrying(true);
    try {
      for (const path of paths) {
        const controller = this.controllers.get(path);
        if (controller?.status().status === 'error') controller.retry();
      }
      await Promise.all(paths.map((path) => this.controllers.get(path)?.whenQuiescent()));
      return this.failedFiles();
    } finally {
      this._retrying(false);
    }
  }

  async flush(paths?: readonly string[]): Promise<void> {
    const controllers = paths
      ? paths.map((path) => this.controllers.get(normalizePath(path))).filter((item): item is PersistExecutor => !!item)
      : [...this.controllers.values()];
    await Promise.all(controllers.map((controller) => controller.whenQuiescent()));
    const failures = paths
      ? paths.flatMap((path) => {
          const error = this.failedMap.get(normalizePath(path));
          return error ? [{ path: normalizePath(path), error }] : [];
        })
      : this.failedFiles();
    if (failures.length > 0) {
      throw new AggregateError(
        failures.map((failure) => failure.error),
        '工程文件写入失败',
      );
    }
  }

  /** Test/low-level ordering primitive. It intentionally does not reject failures. */
  async whenQuiescent(paths?: readonly string[]): Promise<void> {
    const controllers = paths
      ? paths.map((path) => this.controllers.get(normalizePath(path))).filter((item): item is PersistExecutor => !!item)
      : [...this.controllers.values()];
    await Promise.all(controllers.map((controller) => controller.whenQuiescent()));
  }

  statusFor(path: string): 'idle' | 'persisting' | 'error' {
    const normalized = normalizePath(path);
    if (this.failedMap.has(normalized)) return 'error';
    if (this.persistingSet.has(normalized)) return 'persisting';
    return 'idle';
  }

  errorFor(path: string): Error | undefined {
    return this.failedMap.get(normalizePath(path));
  }

  hasUnsavedChanges(): boolean {
    return this.persistingSet.size > 0;
  }

  hasPersistErrors(): boolean {
    return this.failedMap.size > 0;
  }

  getPersistingCount(): number {
    return this.persistingSet.size;
  }

  getFailedCount(): number {
    return this.failedMap.size;
  }

  resetForTests(): void {
    this.controllers.clear();
    this.persistingSet.clear();
    this.failedMap.clear();
    this._retrying(false);
    this.updateSignals();
  }

  private updateSignals(): void {
    this._persistingFiles([...this.persistingSet]);
    this._failedFiles([...this.failedMap].map(([path, error]) => ({ path, error })));
  }
}
