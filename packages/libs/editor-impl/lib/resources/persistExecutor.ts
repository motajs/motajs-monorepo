import { signal } from 'alien-signals';
import { waitUntil } from './waitUntil';
import { ExecutorStatus, IPersistExecutor, PersistenceIntent, ReadonlySignal } from './types';

// 单路径持久化控制器
// 编辑代码提交不可变的意图；同一时刻最多一个意图在执行，另保留一个最新的待执行意图
// 控制器从不持有编辑状态，持久化失败也从不回滚编辑状态
export class PersistExecutor implements IPersistExecutor {
  /** 旧式测试适配器的遗留操作。 */
  private readonly legacyOperation?: () => Promise<void>;

  /** 待执行的最新意图。 */
  private pendingIntent: PersistenceIntent | null = null;

  /** 上一次失败的意图，供 retry 复用。 */
  private failedIntent: PersistenceIntent | null = null;

  /** 是否有意图正在执行。 */
  private isExecuting = false;

  /** 可写状态信号（真实来源）。 */
  private _status: ReturnType<typeof signal<ExecutorStatus>>;

  /** 只读状态信号。 */
  readonly status: ReadonlySignal<ExecutorStatus>;

  constructor(legacyOperation?: () => Promise<void>) {
    this.legacyOperation = legacyOperation;
    this._status = signal<ExecutorStatus>({ status: 'idle' });
    this.status = this._status as ReadonlySignal<ExecutorStatus>;
  }

  /**
   * 为当前路径提交一个不可变的期望状态意图。
   *
   * @param intent 要排程的持久化意图。
   */
  schedule(intent: PersistenceIntent): void {
    this.pendingIntent = intent;
    if (this.isExecuting) {
      this._status({ status: 'executing', pending: 1 });
      return;
    }
    void this.processQueue();
  }

  /**
   * 旧式测试适配入口：把遗留操作包装成一个写入意图；生产资源改用 `schedule()`。
   */
  exec(): void {
    if (!this.legacyOperation) {
      throw new Error('PersistExecutor.exec() requires a legacy operation');
    }
    this.schedule({ kind: 'write', execute: this.legacyOperation });
  }

  /**
   * 重试上一次失败的意图；当前状态不是 error 时不做任何事。
   */
  retry(): void {
    if (!this.failedIntent || this._status().status !== 'error') return;
    this.schedule(this.failedIntent);
  }

  /**
   * 串行执行意图队列：同一时刻最多一个在执行，另保留一个最新的待执行意图。
   */
  private async processQueue(): Promise<void> {
    if (this.isExecuting || !this.pendingIntent) return;
    this.isExecuting = true;

    while (this.pendingIntent) {
      const intent = this.pendingIntent;
      this.pendingIntent = null;
      this._status({ status: 'executing', pending: 0 });

      try {
        await intent.execute();
        this.failedIntent = null;
      } catch (error) {
        const normalized = error instanceof Error ? error : new Error(String(error));
        console.error('PersistExecutor: task failed', normalized);
        this.failedIntent = intent;
        if (!this.pendingIntent) {
          this.isExecuting = false;
          this._status({ status: 'error', error: normalized, pending: 0 });
          return;
        }
      }
    }

    this.isExecuting = false;
    this._status({ status: 'idle' });
  }

  /**
   * 等待执行队列静默（持久化边界/测试 API；普通编辑代码不应调用）。
   */
  async whenQuiescent(): Promise<void> {
    await waitUntil(() => this._status().status !== 'executing');
  }

  /**
   * 在显式边界等待静默。
   *
   * @deprecated 改用 `PersistenceMonitor.flush()`。
   */
  async waitForIdle(): Promise<void> {
    await this.whenQuiescent();
  }

  /**
   * 等待静默；若最终状态为错误则抛出该错误。
   */
  async flush(): Promise<void> {
    await this.whenQuiescent();
    const status = this._status();
    if (status.status === 'error') throw status.error;
  }

  /**
   * 是否有执行中或待执行的工作。
   */
  hasPending(): boolean {
    return this.isExecuting || this.pendingIntent !== null;
  }
}
