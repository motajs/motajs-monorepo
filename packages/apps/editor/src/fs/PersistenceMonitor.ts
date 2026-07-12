/**
 * PersistenceMonitor - 全局持久化状态监控器
 *
 * 职责：
 * - 作为 PersistExecutor 的工厂，创建被监控的 executor
 * - 维护全局持久化状态（正在持久化的文件、失败的文件）
 * - 提供响应式 signal 供 UI 订阅
 */

import { signal, effect } from "alien-signals";
import { PersistExecutor } from "./PersistExecutor";
import type { ReadonlySignal } from "./interfaces";

/**
 * 持久化失败信息
 */
export interface PersistFailure {
  path: string;
  error: Error;
}

export class PersistenceMonitor {
  // 内部 Set 用于高效增删
  private persistingSet = new Set<string>();
  private failedMap = new Map<string, Error>();

  // 对外暴露的 signal（存储数组）
  private _persistingFiles: ReturnType<typeof signal<string[]>>;
  private _failedFiles: ReturnType<typeof signal<PersistFailure[]>>;

  readonly persistingFiles: ReadonlySignal<string[]>;
  readonly failedFiles: ReadonlySignal<PersistFailure[]>;

  constructor() {
    this._persistingFiles = signal<string[]>([]);
    this._failedFiles = signal<PersistFailure[]>([]);

    this.persistingFiles = this._persistingFiles as ReadonlySignal<string[]>;
    this.failedFiles = this._failedFiles as ReadonlySignal<PersistFailure[]>;
  }

  /**
   * 创建一个被监控的 PersistExecutor
   *
   * @param path 文件路径（用于标识）
   * @param operation 持久化操作
   * @returns 被监控的 PersistExecutor 实例
   */
  createExecutor(path: string, operation: () => Promise<void>): PersistExecutor {
    const executor = new PersistExecutor(operation);

    // 订阅 executor 的状态变化
    effect(() => {
      const status = executor.status();

      if (status.status === "executing") {
        // 正在执行持久化
        if (!this.persistingSet.has(path)) {
          this.persistingSet.add(path);
          this.failedMap.delete(path); // 清除之前的错误
          this.updateSignals();
        }
      } else if (status.status === "error") {
        // 持久化失败
        this.persistingSet.delete(path);
        this.failedMap.set(path, status.error);
        this.updateSignals();
      } else if (status.status === "idle") {
        // 持久化完成（成功）
        const changed = this.persistingSet.delete(path) || this.failedMap.delete(path);
        if (changed) {
          this.updateSignals();
        }
      }
    });

    return executor;
  }

  /**
   * 更新 signal（从 Set/Map 计算数组）
   */
  private updateSignals(): void {
    this._persistingFiles(Array.from(this.persistingSet));
    this._failedFiles(
      Array.from(this.failedMap.entries()).map(([path, error]) => ({ path, error }))
    );
  }

  /**
   * 是否有未保存的修改（正在持久化）
   */
  hasUnsavedChanges(): boolean {
    return this.persistingSet.size > 0;
  }

  /**
   * 是否有持久化错误
   */
  hasPersistErrors(): boolean {
    return this.failedMap.size > 0;
  }

  /**
   * 获取正在持久化的文件数量
   */
  getPersistingCount(): number {
    return this.persistingSet.size;
  }

  /**
   * 获取持久化失败的文件数量
   */
  getFailedCount(): number {
    return this.failedMap.size;
  }
}

/**
 * 全局 PersistenceMonitor 实例
 */
export const persistenceMonitor = new PersistenceMonitor();
