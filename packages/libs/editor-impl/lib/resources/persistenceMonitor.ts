import { effect, signal } from 'alien-signals';
import { PersistExecutor } from './persistExecutor';
import { IPersistenceMonitor, PersistFailure, PersistenceIntent, ReadonlySignal } from './types';

/**
 * 把反斜杠与 `./` 前缀归一化，使同一路径只拥有一个控制器。
 *
 * @param path 原始路径。
 */
function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\/+/, '');
}

// 项目级、按路径归属的持久化管理器
// 汇总各路径的持久化状态，提供 flush、失败记录与统一重试
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

  /** 只读的正在持久化路径信号。 */
  readonly persistingFiles = this._persistingFiles as ReadonlySignal<string[]>;

  /** 只读的失败列表信号。 */
  readonly failedFiles = this._failedFiles as ReadonlySignal<PersistFailure[]>;

  /** 只读的重试中信号。 */
  readonly retrying = this._retrying as ReadonlySignal<boolean>;

  /**
   * 取得（或惰性创建）某路径的持久化控制器，并把它的状态变化汇入项目级信号。
   *
   * @param path 文件路径。
   * @param legacyOperation 旧式测试适配器的遗留操作。
   */
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
        // 重试进行中时保留旧的失败记录可见
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

  /**
   * 旧式测试适配入口：为一个路径创建受监控的执行器；生产资源改用 `schedule()`。
   *
   * @param path 文件路径。
   * @param operation 遗留的写入操作。
   */
  createExecutor(path: string, operation: () => Promise<void>): PersistExecutor {
    return this.controller(path, operation);
  }

  /**
   * 为某个路径排程一个持久化意图。
   *
   * @param path 文件路径。
   * @param intent 要排程的持久化意图。
   */
  schedule(path: string, intent: PersistenceIntent): void {
    this.controller(path).schedule(intent);
  }

  /**
   * 重试全部失败路径，返回仍未恢复的失败。
   */
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

  /**
   * 等待指定路径（缺省为全部）静默；存在失败时抛出聚合错误。
   *
   * @param paths 要等待的路径；缺省为全部。
   */
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

  /**
   * 等待指定路径（缺省为全部）静默；刻意不因失败而 reject。
   *
   * @param paths 要等待的路径；缺省为全部。
   */
  async whenQuiescent(paths?: readonly string[]): Promise<void> {
    const controllers = paths
      ? paths.map((path) => this.controllers.get(normalizePath(path))).filter((item): item is PersistExecutor => !!item)
      : [...this.controllers.values()];
    await Promise.all(controllers.map((controller) => controller.whenQuiescent()));
  }

  /**
   * 查询某路径的持久化状态。
   *
   * @param path 文件路径。
   */
  statusFor(path: string): 'idle' | 'persisting' | 'error' {
    const normalized = normalizePath(path);
    if (this.failedMap.has(normalized)) return 'error';
    if (this.persistingSet.has(normalized)) return 'persisting';
    return 'idle';
  }

  /**
   * 查询某路径的失败原因。
   *
   * @param path 文件路径。
   */
  errorFor(path: string): Error | undefined {
    return this.failedMap.get(normalizePath(path));
  }

  /**
   * 是否有尚未落盘的改动。
   */
  hasUnsavedChanges(): boolean {
    return this.persistingSet.size > 0;
  }

  /**
   * 是否存在持久化失败。
   */
  hasPersistErrors(): boolean {
    return this.failedMap.size > 0;
  }

  /**
   * 正在持久化的路径数量。
   */
  getPersistingCount(): number {
    return this.persistingSet.size;
  }

  /**
   * 持久化失败的路径数量。
   */
  getFailedCount(): number {
    return this.failedMap.size;
  }

  /**
   * 清空全部状态（测试用）。
   */
  resetForTests(): void {
    this.controllers.clear();
    this.persistingSet.clear();
    this.failedMap.clear();
    this._retrying(false);
    this.updateSignals();
  }

  /**
   * 把内部集合快照回写到只读信号。
   */
  private updateSignals(): void {
    this._persistingFiles([...this.persistingSet]);
    this._failedFiles([...this.failedMap].map(([path, error]) => ({ path, error })));
  }
}
