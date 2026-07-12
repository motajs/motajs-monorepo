/**
 * PersistenceMonitor 单元测试
 */

import { describe, it, expect, beforeEach } from "vitest";
import { PersistenceMonitor } from "../PersistenceMonitor";
import { wait } from "@test/utils/testHelpers";
import { effect } from "alien-signals";

describe("PersistenceMonitor", () => {
  let monitor: PersistenceMonitor;

  beforeEach(() => {
    monitor = new PersistenceMonitor();
  });

  describe("createExecutor", () => {
    it("应该创建 PersistExecutor 实例", () => {
      const executor = monitor.createExecutor("test.txt", async () => {
        await wait(10);
      });

      expect(executor).toBeDefined();
      expect(typeof executor.exec).toBe("function");
    });

    it("创建的 executor 应该被自动监控", async () => {
      const executor = monitor.createExecutor("test.txt", async () => {
        await wait(50);
      });

      // 初始状态
      expect(monitor.persistingFiles()).toEqual([]);

      // 触发持久化
      executor.exec();

      // 等待状态更新
      await wait(10);

      // 应该在持久化列表中
      expect(monitor.persistingFiles()).toContain("test.txt");

      // 等待完成
      await executor.waitForIdle();

      // 应该从列表中移除
      expect(monitor.persistingFiles()).toEqual([]);
    });
  });

  describe("persistingFiles signal", () => {
    it("应该追踪正在持久化的文件", async () => {
      const executor1 = monitor.createExecutor("file1.txt", async () => {
        await wait(50);
      });
      const executor2 = monitor.createExecutor("file2.txt", async () => {
        await wait(50);
      });

      executor1.exec();
      await wait(10);

      expect(monitor.persistingFiles()).toEqual(["file1.txt"]);

      executor2.exec();
      await wait(10);

      expect(monitor.persistingFiles()).toContain("file1.txt");
      expect(monitor.persistingFiles()).toContain("file2.txt");

      await executor1.waitForIdle();
      await executor2.waitForIdle();

      expect(monitor.persistingFiles()).toEqual([]);
    });

    it("应该能够订阅状态变化", async () => {
      const executor = monitor.createExecutor("test.txt", async () => {
        await wait(30);
      });

      const states: string[][] = [];
      const unsubscribe = effect(() => {
        states.push([...monitor.persistingFiles()]);
      });

      executor.exec();
      await executor.waitForIdle();

      unsubscribe();

      // 应该收到状态变化：[] -> ["test.txt"] -> []
      expect(states.length).toBeGreaterThanOrEqual(2);
      expect(states[0]).toEqual([]);
      expect(states.some(s => s.includes("test.txt"))).toBe(true);
    });
  });

  describe("failedFiles signal", () => {
    it("应该追踪持久化失败的文件", async () => {
      const executor = monitor.createExecutor("test.txt", async () => {
        await wait(10);
        throw new Error("Persist failed");
      });

      executor.exec();
      await executor.waitForIdle();

      const failed = monitor.failedFiles();
      expect(failed).toHaveLength(1);
      expect(failed[0].path).toBe("test.txt");
      expect(failed[0].error.message).toBe("Persist failed");
    });

    it("成功持久化后应该清除失败记录", async () => {
      let shouldFail = true;
      const executor = monitor.createExecutor("test.txt", async () => {
        await wait(10);
        if (shouldFail) {
          throw new Error("Persist failed");
        }
      });

      // 第一次失败
      executor.exec();
      await executor.waitForIdle();

      expect(monitor.failedFiles()).toHaveLength(1);

      // 第二次成功
      shouldFail = false;
      executor.exec();
      await executor.waitForIdle();

      expect(monitor.failedFiles()).toEqual([]);
    });
  });

  describe("hasUnsavedChanges", () => {
    it("有文件正在持久化时应该返回 true", async () => {
      const executor = monitor.createExecutor("test.txt", async () => {
        await wait(50);
      });

      expect(monitor.hasUnsavedChanges()).toBe(false);

      executor.exec();
      await wait(10);

      expect(monitor.hasUnsavedChanges()).toBe(true);

      await executor.waitForIdle();

      expect(monitor.hasUnsavedChanges()).toBe(false);
    });
  });

  describe("hasPersistErrors", () => {
    it("有文件持久化失败时应该返回 true", async () => {
      const executor = monitor.createExecutor("test.txt", async () => {
        await wait(10);
        throw new Error("Persist failed");
      });

      expect(monitor.hasPersistErrors()).toBe(false);

      executor.exec();
      await executor.waitForIdle();

      expect(monitor.hasPersistErrors()).toBe(true);
    });
  });

  describe("多文件场景", () => {
    it("应该正确追踪多个文件的持久化状态", async () => {
      const executor1 = monitor.createExecutor("file1.txt", async () => {
        await wait(30);
      });
      const executor2 = monitor.createExecutor("file2.txt", async () => {
        await wait(30);
        throw new Error("File2 failed");
      });
      const executor3 = monitor.createExecutor("file3.txt", async () => {
        await wait(30);
      });

      // 同时触发
      executor1.exec();
      executor2.exec();
      executor3.exec();

      await wait(10);

      // 应该有 3 个文件正在持久化
      expect(monitor.getPersistingCount()).toBe(3);

      await executor1.waitForIdle();
      await executor2.waitForIdle();
      await executor3.waitForIdle();

      // file1 和 file3 成功，file2 失败
      expect(monitor.persistingFiles()).toEqual([]);
      expect(monitor.failedFiles()).toHaveLength(1);
      expect(monitor.failedFiles()[0].path).toBe("file2.txt");
    });
  });

  describe("队列优化场景", () => {
    it("快速连续触发应该合并持久化", async () => {
      let executionCount = 0;
      const executor = monitor.createExecutor("test.txt", async () => {
        await wait(50);
        executionCount++;
      });

      // 快速连续触发
      executor.exec();
      executor.exec();
      executor.exec();

      await executor.waitForIdle();

      // 由于队列优化，应该只执行 2 次
      expect(executionCount).toBe(2);
    });
  });
});
