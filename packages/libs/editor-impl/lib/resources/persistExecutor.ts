import { signal } from 'alien-signals';
import { waitUntil } from './waitUntil';
import { ExecutorStatus, IPersistExecutor, PersistenceIntent, ReadonlySignal } from './types';

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
  private statusSignal: ReturnType<typeof signal<ExecutorStatus>>;

  /** 只读状态信号。 */
  readonly status: ReadonlySignal<ExecutorStatus>;

  constructor(legacyOperation?: () => Promise<void>) {
    this.legacyOperation = legacyOperation;
    this.statusSignal = signal<ExecutorStatus>({ status: 'idle' });
    this.status = this.statusSignal as ReadonlySignal<ExecutorStatus>;
  }

  schedule(intent: PersistenceIntent): void {
    this.pendingIntent = intent;
    if (this.isExecuting) {
      this.statusSignal({ status: 'executing', pending: 1 });
      return;
    }
    void this.processQueue();
  }

  exec(): void {
    if (!this.legacyOperation) {
      throw new Error('PersistExecutor.exec() requires a legacy operation');
    }
    this.schedule({ kind: 'write', execute: this.legacyOperation });
  }

  retry(): void {
    if (!this.failedIntent || this.statusSignal().status !== 'error') return;
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
      this.statusSignal({ status: 'executing', pending: 0 });

      try {
        await intent.execute();
        this.failedIntent = null;
      } catch (error) {
        const normalized = error instanceof Error ? error : new Error(String(error));
        console.error('PersistExecutor: task failed', normalized);
        this.failedIntent = intent;
        if (!this.pendingIntent) {
          this.isExecuting = false;
          this.statusSignal({ status: 'error', error: normalized, pending: 0 });
          return;
        }
      }
    }

    this.isExecuting = false;
    this.statusSignal({ status: 'idle' });
  }

  async whenQuiescent(): Promise<void> {
    await waitUntil(() => this.statusSignal().status !== 'executing');
  }

  async waitForIdle(): Promise<void> {
    await this.whenQuiescent();
  }

  async flush(): Promise<void> {
    await this.whenQuiescent();
    const status = this.statusSignal();
    if (status.status === 'error') throw status.error;
  }

  hasPending(): boolean {
    return this.isExecuting || this.pendingIntent !== null;
  }
}
