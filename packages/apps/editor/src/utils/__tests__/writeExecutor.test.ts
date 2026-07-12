/**
 * writeExecutor 单元测试
 *
 * 测试写入同步管理功能
 * - 单次写入执行
 * - 并发写入时的 flag 机制
 * - 多个执行器实例相互独立
 *
 * Requirements: 4.1, 4.2, 4.3
 */

import { describe, expect, it, vi } from 'vitest';
import { createWriteExecutor } from '../writeExecutor';

describe('writeExecutor', () => {
  describe('createWriteExecutor', () => {
    it('应该创建独立的执行器实例', () => {
      const executor1 = createWriteExecutor();
      const executor2 = createWriteExecutor();

      expect(executor1).not.toBe(executor2);
      expect(executor1.isWriting).toBe(false);
      expect(executor2.isWriting).toBe(false);
    });
  });

  describe('单次写入执行', () => {
    it('应该正确执行单次写入任务', async () => {
      const executor = createWriteExecutor();
      const mockTask = vi.fn().mockResolvedValue(undefined);

      await executor.exec(mockTask);

      expect(mockTask).toHaveBeenCalledTimes(1);
    });

    it('写入过程中 isWriting 应该为 true', async () => {
      const executor = createWriteExecutor();
      let isWritingDuringTask = false;

      await executor.exec(async () => {
        isWritingDuringTask = executor.isWriting;
      });

      expect(isWritingDuringTask).toBe(true);
      expect(executor.isWriting).toBe(false);
    });

    it('写入完成后 isWriting 应该为 false', async () => {
      const executor = createWriteExecutor();

      await executor.exec(async () => {
        // 模拟写入操作
      });

      expect(executor.isWriting).toBe(false);
    });

    it('写入失败时应该 reject 并传递错误', async () => {
      const executor = createWriteExecutor();
      const error = new Error('写入失败');

      await expect(
        executor.exec(async () => {
          throw error;
        }),
      ).rejects.toThrow('写入失败');

      expect(executor.isWriting).toBe(false);
    });
  });

  describe('并发写入时的 flag 机制', () => {
    it('并发写入时应该标记 needsRewrite 并在完成后执行', async () => {
      const executor = createWriteExecutor();
      const callOrder: number[] = [];

      // 创建一个可控的延迟任务
      let resolveFirst: () => void;
      const firstTaskPromise = new Promise<void>((resolve) => {
        resolveFirst = resolve;
      });

      // 启动第一个写入任务
      const firstExec = executor.exec(async () => {
        callOrder.push(1);
        await firstTaskPromise;
      });

      // 等待第一个任务开始执行
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(executor.isWriting).toBe(true);

      // 启动第二个写入任务（应该被标记为 needsRewrite）
      const secondExec = executor.exec(async () => {
        callOrder.push(2);
      });

      // 完成第一个任务
      resolveFirst!();
      await firstExec;
      await secondExec;

      expect(callOrder).toEqual([1, 2]);
      expect(executor.isWriting).toBe(false);
    });

    it('多次并发写入时只保留最后一个任务', async () => {
      const executor = createWriteExecutor();
      const callOrder: number[] = [];

      let resolveFirst: () => void;
      const firstTaskPromise = new Promise<void>((resolve) => {
        resolveFirst = resolve;
      });

      // 启动第一个写入任务
      const firstExec = executor.exec(async () => {
        callOrder.push(1);
        await firstTaskPromise;
      });

      // 等待第一个任务开始执行
      await new Promise((resolve) => setTimeout(resolve, 0));

      // 启动多个并发写入任务
      const secondExec = executor.exec(async () => {
        callOrder.push(2);
      });
      const thirdExec = executor.exec(async () => {
        callOrder.push(3);
      });

      // 完成第一个任务
      resolveFirst!();
      await firstExec;
      await Promise.all([secondExec, thirdExec]);

      // 只有第一个和最后一个任务被执行
      expect(callOrder).toEqual([1, 3]);
    });

    it('并发写入时第二个任务失败应该正确传递错误', async () => {
      const executor = createWriteExecutor();

      let resolveFirst: () => void;
      const firstTaskPromise = new Promise<void>((resolve) => {
        resolveFirst = resolve;
      });

      // 启动第一个写入任务
      const firstExec = executor.exec(async () => {
        await firstTaskPromise;
      });

      // 等待第一个任务开始执行
      await new Promise((resolve) => setTimeout(resolve, 0));

      // 启动第二个写入任务（会失败）
      const secondExec = executor.exec(async () => {
        throw new Error('第二个任务失败');
      });

      // 完成第一个任务
      resolveFirst!();
      await firstExec;

      await expect(secondExec).rejects.toThrow('第二个任务失败');
      expect(executor.isWriting).toBe(false);
    });
  });

  describe('多个执行器实例相互独立', () => {
    it('不同执行器的写入状态应该相互独立', async () => {
      const executor1 = createWriteExecutor();
      const executor2 = createWriteExecutor();

      let resolveFirst: () => void;
      const firstTaskPromise = new Promise<void>((resolve) => {
        resolveFirst = resolve;
      });

      // 在 executor1 上启动写入
      const exec1 = executor1.exec(async () => {
        await firstTaskPromise;
      });

      // 等待任务开始
      await new Promise((resolve) => setTimeout(resolve, 0));

      // executor1 正在写入，executor2 应该空闲
      expect(executor1.isWriting).toBe(true);
      expect(executor2.isWriting).toBe(false);

      // executor2 可以独立执行写入
      let executor2TaskExecuted = false;
      await executor2.exec(async () => {
        executor2TaskExecuted = true;
      });

      expect(executor2TaskExecuted).toBe(true);
      expect(executor1.isWriting).toBe(true);
      expect(executor2.isWriting).toBe(false);

      // 完成 executor1 的任务
      resolveFirst!();
      await exec1;

      expect(executor1.isWriting).toBe(false);
    });

    it('不同执行器的并发写入应该相互独立', async () => {
      const executor1 = createWriteExecutor();
      const executor2 = createWriteExecutor();
      const callOrder: string[] = [];

      let resolveFirst1: () => void;
      let resolveFirst2: () => void;
      const firstTask1Promise = new Promise<void>((resolve) => {
        resolveFirst1 = resolve;
      });
      const firstTask2Promise = new Promise<void>((resolve) => {
        resolveFirst2 = resolve;
      });

      // 在两个执行器上同时启动写入
      const exec1First = executor1.exec(async () => {
        callOrder.push('e1-1');
        await firstTask1Promise;
      });
      const exec2First = executor2.exec(async () => {
        callOrder.push('e2-1');
        await firstTask2Promise;
      });

      // 等待任务开始
      await new Promise((resolve) => setTimeout(resolve, 0));

      // 在两个执行器上同时添加并发写入
      const exec1Second = executor1.exec(async () => {
        callOrder.push('e1-2');
      });
      const exec2Second = executor2.exec(async () => {
        callOrder.push('e2-2');
      });

      // 完成所有任务
      resolveFirst1!();
      resolveFirst2!();
      await Promise.all([exec1First, exec2First, exec1Second, exec2Second]);

      // 验证两个执行器的任务都被执行
      expect(callOrder).toContain('e1-1');
      expect(callOrder).toContain('e1-2');
      expect(callOrder).toContain('e2-1');
      expect(callOrder).toContain('e2-2');
    });
  });
});
