/**
 * A single-path persistence controller.
 *
 * Editing code submits immutable intents. One intent may be executing while a
 * single, newer pending intent is retained. The controller never owns editor
 * state and persistence failures never roll editor state back.
 */

import { signal } from "alien-signals";
import { waitUntil } from "@/utils/base/signal";
import type { ReadonlySignal } from "./interfaces";

export type PersistenceIntent = {
  kind: "write" | "delete";
  execute: () => Promise<void>;
};

export type ExecutorStatus =
  | { status: "idle" }
  | { status: "executing"; pending: number }
  | { status: "error"; error: Error; pending: 0 };

export class PersistExecutor {
  private readonly legacyOperation?: () => Promise<void>;
  private pendingIntent: PersistenceIntent | null = null;
  private failedIntent: PersistenceIntent | null = null;
  private isExecuting = false;
  private _status: ReturnType<typeof signal<ExecutorStatus>>;
  readonly status: ReadonlySignal<ExecutorStatus>;

  constructor(legacyOperation?: () => Promise<void>) {
    this.legacyOperation = legacyOperation;
    this._status = signal<ExecutorStatus>({ status: "idle" });
    this.status = this._status as ReadonlySignal<ExecutorStatus>;
  }

  /** Submit an immutable desired-state intent for this path. */
  schedule(intent: PersistenceIntent): void {
    this.pendingIntent = intent;
    if (this.isExecuting) {
      this._status({ status: "executing", pending: 1 });
      return;
    }
    void this.processQueue();
  }

  /** Legacy test adapter. Production resources use schedule(). */
  exec(): void {
    if (!this.legacyOperation) {
      throw new Error("PersistExecutor.exec() requires a legacy operation");
    }
    this.schedule({ kind: "write", execute: this.legacyOperation });
  }

  retry(): void {
    if (!this.failedIntent || this._status().status !== "error") return;
    this.schedule(this.failedIntent);
  }

  private async processQueue(): Promise<void> {
    if (this.isExecuting || !this.pendingIntent) return;
    this.isExecuting = true;

    while (this.pendingIntent) {
      const intent = this.pendingIntent;
      this.pendingIntent = null;
      this._status({ status: "executing", pending: 0 });

      try {
        await intent.execute();
        this.failedIntent = null;
      } catch (error) {
        const normalized = error instanceof Error ? error : new Error(String(error));
        console.error("PersistExecutor: task failed", normalized);
        this.failedIntent = intent;
        if (!this.pendingIntent) {
          this.isExecuting = false;
          this._status({ status: "error", error: normalized, pending: 0 });
          return;
        }
      }
    }

    this.isExecuting = false;
    this._status({ status: "idle" });
  }

  /** Persistence-boundary/test API; ordinary editing code must not call it. */
  async whenQuiescent(): Promise<void> {
    await waitUntil(() => this._status().status !== "executing");
  }

  /** @deprecated Use PersistenceMonitor.flush() at explicit boundaries. */
  async waitForIdle(): Promise<void> {
    await this.whenQuiescent();
  }

  async flush(): Promise<void> {
    await this.whenQuiescent();
    const status = this._status();
    if (status.status === "error") throw status.error;
  }

  hasPending(): boolean {
    return this.isExecuting || this.pendingIntent !== null;
  }
}
