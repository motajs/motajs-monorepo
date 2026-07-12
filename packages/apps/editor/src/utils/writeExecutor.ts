/**
 * 写入执行器模块
 *
 * 管理并发写入操作，使用工厂函数创建独立的执行器实例。
 * 每个数据服务（如 towerData、itemData、enemyData）可以拥有独立的写入执行器，
 * 避免不同文件的写入操作相互阻塞。
 */

/** 写入执行器接口 */
export interface WriteExecutor {
  /** 当前是否正在写入 */
  readonly isWriting: boolean;
  /** 执行写入操作，处理并发情况 */
  exec(writeTask: () => Promise<void>): Promise<void>;
}

/**
 * 创建写入执行器
 *
 * 内部维护 isWriting 和 needsRewrite 标志位：
 * - isWriting: 标记当前是否有写入操作正在进行
 * - needsRewrite: 标记在写入过程中是否有新的写入请求
 *
 * 当写入操作正在进行时，新的写入请求会设置 needsRewrite 标志。
 * 当前写入完成后，如果 needsRewrite 为 true，会触发新一轮写入。
 *
 * @returns WriteExecutor 实例
 */
export function createWriteExecutor(): WriteExecutor {
  let isWriting = false;
  let needsRewrite = false;
  let pendingTask: (() => Promise<void>) | null = null;
  // 存储所有等待中的 Promise 回调
  let pendingCallbacks: Array<{
    resolve: () => void;
    reject: (error: Error) => void;
  }> = [];

  const executor: WriteExecutor = {
    get isWriting() {
      return isWriting;
    },

    async exec(writeTask: () => Promise<void>): Promise<void> {
      // 如果当前正在写入，标记需要重写并保存最新的任务
      if (isWriting) {
        needsRewrite = true;
        pendingTask = writeTask;

        // 返回一个 Promise，在重写完成时 resolve
        return new Promise<void>((resolve, reject) => {
          pendingCallbacks.push({ resolve, reject });
        });
      }

      // 开始写入
      isWriting = true;
      needsRewrite = false;

      try {
        await writeTask();

        // 写入完成后，检查是否需要重写
        while (needsRewrite && pendingTask) {
          needsRewrite = false;
          const taskToRun = pendingTask;
          const callbacksToNotify = pendingCallbacks;
          pendingTask = null;
          pendingCallbacks = [];

          try {
            await taskToRun();
            // 通知所有等待的 Promise
            callbacksToNotify.forEach((cb) => cb.resolve());
          } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            // 通知所有等待的 Promise
            callbacksToNotify.forEach((cb) => cb.reject(err));
          }
        }
      } finally {
        isWriting = false;
      }
    },
  };

  return executor;
}
