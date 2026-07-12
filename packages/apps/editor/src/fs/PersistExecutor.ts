/**
 * PersistExecutor - 持久化执行器
 *
 * 负责串行化持久化操作，确保同一文件的持久化按顺序执行
 * 优化：最多保留 2 个任务（正在执行 + 待执行）
 *
 * 通过构造函数传入操作函数，exec() 触发执行（无需传参）
 */

import { signal } from "alien-signals";
import { waitUntil } from "@/utils/base/signal";
import type { ReadonlySignal } from "./interfaces";

/**
 * PersistExecutor 的状态
 */
export type ExecutorStatus =
  | { status: "idle" } // 空闲，无任务
  | { status: "executing"; pending: number } // 执行中，pending = 队列中待执行的数量
  | { status: "error"; error: Error; pending: number }; // 最后一次执行失败

export class PersistExecutor {
  private pendingCount = 0; // 待执行任务数量
  private isExecuting = false;
  private deletionPending = false;
  private operation: () => Promise<void>;

  // 状态 signal
  private _status: ReturnType<typeof signal<ExecutorStatus>>;
  readonly status: ReadonlySignal<ExecutorStatus>;

  /**
   * @param operation 要执行的操作函数（应该是幂等的，每次读取最新数据）
   */
  constructor(operation: () => Promise<void>) {
    this.operation = operation;
    this._status = signal<ExecutorStatus>({ status: "idle" });
    this.status = this._status as ReadonlySignal<ExecutorStatus>;
  }

  /**
   * 标记删除意图（阻止新的持久化操作）
   */
  markDeletionPending(): void {
    this.deletionPending = true;
  }

  /**
   * 检查是否标记了删除意图
   */
  isDeletionPending(): boolean {
    return this.deletionPending;
  }

  /**
   * 触发持久化执行
   * 优化：最多保留 2 个任务（正在执行 + 待执行）
   */
  exec(): void {
    // 如果标记了删除意图，拒绝新的持久化
    if (this.deletionPending) {
      throw new Error("Cannot execute persist task: deletion pending");
    }

    // 优化：最多保留 1 个待执行任务
    if (this.pendingCount === 0) {
      this.pendingCount = 1;
    }
    // 如果已经有待执行任务，不增加计数（保留最新的一次执行即可）

    // 更新状态
    if (this.isExecuting) {
      this._status({ status: "executing", pending: this.pendingCount });
    }

    this.processQueue();
  }

  /**
   * 处理队列
   */
  private async processQueue(): Promise<void> {
    if (this.isExecuting || this.pendingCount === 0) {
      return;
    }

    this.isExecuting = true;
    let lastError: Error | null = null;

    while (this.pendingCount > 0) {
      this.pendingCount--;

      // 更新状态：正在执行，显示剩余待执行数量
      this._status({ status: "executing", pending: this.pendingCount });

      try {
        await this.operation();
        // 成功执行，清除之前的错误
        lastError = null;
      } catch (err) {
        const error = err as Error;
        console.error("PersistExecutor: task failed", err);

        // 记录最后一次错误
        lastError = error;

        // 更新状态为错误
        this._status({ status: "error", error, pending: this.pendingCount });

        // 继续处理下一个任务
      }
    }

    this.isExecuting = false;

    // 根据是否有错误决定最终状态
    if (lastError) {
      // 保持 error 状态
      this._status({ status: "error", error: lastError, pending: 0 });
    } else {
      // 更新状态为空闲
      this._status({ status: "idle" });
    }
  }

  /**
   * 检查是否处于空闲状态（idle 或 error）
   */
  private isIdle(): boolean {
    const status = this._status().status;
    return status === "idle" || status === "error";
  }

  /**
   * 等待队列清空
   * 使用 signal 的响应式特性，不需要轮询
   */
  async waitForIdle(): Promise<void> {
    return waitUntil(() => this.isIdle());
  }

  /**
   * 检查是否有待处理的任务
   */
  hasPending(): boolean {
    return this.isExecuting || this.pendingCount > 0;
  }
}
