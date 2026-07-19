/**
 * PersistExecutor 单元测试
 */

import { describe, it, expect } from "vitest";
import { PersistExecutor } from "../PersistExecutor";
import { wait } from "@test/utils/testHelpers";
import { effect } from "alien-signals";

describe("PersistExecutor", () => {
  describe("串行化执行", () => {
    it("应该按顺序执行任务", async () => {
      const results: number[] = [];
      let counter = 0;
      const executor = new PersistExecutor(async () => {
        await wait(10);
        results.push(++counter);
      });

      // 串行触发（等待每个任务开始执行）
      executor.exec();
      await wait(5); // 等待任务 1 开始执行
      executor.exec();
      await wait(5); // 等待任务 2 开始执行
      executor.exec();

      await executor.waitForIdle();

      // 应该按顺序执行
      expect(results).toEqual([1, 2, 3]);
    });

    it("应该等待前一个任务完成再执行下一个", async () => {
      let executing = false;
      const executor = new PersistExecutor(async () => {
        expect(executing).toBe(false); // 不应该有并发执行
        executing = true;
        await wait(20);
        executing = false;
      });

      executor.exec();
      executor.exec();
      executor.exec();

      await executor.waitForIdle();
    });
  });

  describe("队列优化", () => {
    it("应该合并待执行任务（最多保留 1 个）", async () => {
      const results: number[] = [];
      let counter = 0;
      const executor = new PersistExecutor(async () => {
        await wait(50); // 模拟慢速操作
        results.push(++counter);
      });

      // 快速连续触发
      executor.exec();
      executor.exec();
      executor.exec();
      executor.exec();
      executor.exec();

      await executor.waitForIdle();

      // 第一个任务已经开始执行，无法取消
      // 后续任务被合并，只执行一次
      expect(results).toEqual([1, 2]);
    });

    it("正在执行的任务不会被取消", async () => {
      const results: number[] = [];
      let counter = 0;
      const executor = new PersistExecutor(async () => {
        await wait(30);
        results.push(++counter);
      });

      executor.exec();

      // 等待第一个任务开始执行
      await wait(10);

      // 此时触发的任务会被合并
      executor.exec();
      executor.exec();

      await executor.waitForIdle();

      // 第一个任务已经在执行，后续合并为一次
      expect(results).toEqual([1, 2]);
    });
  });

  describe("waitForIdle", () => {
    it("应该等待所有任务完成", async () => {
      let counter = 0;
      const executor = new PersistExecutor(async () => {
        await wait(50);
        counter++;
      });

      executor.exec();
      executor.exec();
      executor.exec();

      expect(counter).toBe(0);

      await executor.waitForIdle();

      // 由于队列优化，快速连续的 exec 会被合并
      // 第一个开始执行，后续被合并为一次
      expect(counter).toBe(2);
    });

    it("队列为空时应该立即返回", async () => {
      const executor = new PersistExecutor(async () => {
        await wait(10);
      });

      const start = Date.now();
      await executor.waitForIdle();
      const duration = Date.now() - start;

      // 应该几乎立即返回
      expect(duration).toBeLessThan(20);
    });
  });

  describe("hasPending", () => {
    it("有任务时应该返回 true", async () => {
      const executor = new PersistExecutor(async () => {
        await wait(50);
      });

      expect(executor.hasPending()).toBe(false);

      executor.exec();
      expect(executor.hasPending()).toBe(true);

      await executor.waitForIdle();
      expect(executor.hasPending()).toBe(false);
    });
  });

  describe("期望状态意图", () => {
    it("写入执行中收到删除时最终执行删除", async () => {
      const executor = new PersistExecutor();
      const results: string[] = [];
      executor.schedule({ kind: "write", execute: async () => {
        await wait(20);
        results.push("write");
      } });
      executor.schedule({ kind: "delete", execute: async () => {
        results.push("delete");
      } });

      await executor.whenQuiescent();
      expect(results).toEqual(["write", "delete"]);
    });

    it("尚未执行的删除可以被更新的写入覆盖", async () => {
      const executor = new PersistExecutor();
      const results: string[] = [];
      executor.schedule({ kind: "write", execute: async () => {
        await wait(20);
        results.push("first");
      } });
      executor.schedule({ kind: "delete", execute: async () => {
        results.push("delete");
      } });
      executor.schedule({ kind: "write", execute: async () => {
        results.push("latest");
      } });

      await executor.whenQuiescent();
      expect(results).toEqual(["first", "latest"]);
    });
  });

  describe("错误处理", () => {
    it("任务失败不应该影响后续任务", async () => {
      const results: number[] = [];
      let counter = 0;
      const executor = new PersistExecutor(async () => {
        await wait(10);
        const current = ++counter;
        if (current === 2) {
          throw new Error("Task 2 failed");
        }
        results.push(current);
      });

      executor.exec();
      executor.exec();
      executor.exec();

      await executor.waitForIdle();

      // 由于队列优化，快速连续的 exec 会被合并
      // 第一个执行成功，后续被合并为一次（第二次）
      expect(results).toEqual([1]);
    });

    it("多个任务失败不应该中断队列", async () => {
      const results: number[] = [];
      let counter = 0;
      const executor = new PersistExecutor(async () => {
        await wait(20);
        const current = ++counter;
        if (current === 2) {
          throw new Error(`Task ${current} failed`);
        }
        results.push(current);
      });

      // 串行触发，确保每个任务都开始执行
      executor.exec();
      await wait(25); // 等待任务 1 完成（20ms）+ 缓冲
      executor.exec();
      await wait(25); // 等待任务 2 完成（20ms）+ 缓冲
      executor.exec();

      await executor.waitForIdle();

      // 任务 1 成功，任务 2 失败，任务 3 成功
      expect(results).toEqual([1, 3]);

      // 最终状态应该是 idle（任务 3 成功，清除了错误）
      expect(executor.status().status).toBe("idle");
    });
  });

  describe("状态 signal", () => {
    it("初始状态应该是 idle", () => {
      const executor = new PersistExecutor(async () => {
        await wait(10);
      });

      const status = executor.status();
      expect(status.status).toBe("idle");
    });

    it("执行时状态应该是 executing", async () => {
      const executor = new PersistExecutor(async () => {
        await wait(50);
      });

      executor.exec();
      executor.exec();

      // 立即检查状态
      const status = executor.status();
      expect(status.status).toBe("executing");
      if (status.status === "executing") {
        expect(status.pending).toBe(1); // 1 个在队列中
      }

      await executor.waitForIdle();
    });

    it("完成后状态应该回到 idle", async () => {
      const executor = new PersistExecutor(async () => {
        await wait(10);
      });

      executor.exec();
      await executor.waitForIdle();

      const status = executor.status();
      expect(status.status).toBe("idle");
    });

    it("失败时状态应该是 error", async () => {
      const executor = new PersistExecutor(async () => {
        await wait(10);
        throw new Error("Test error");
      });

      let errorStatus: import("../PersistExecutor").ExecutorStatus | null = null;
      const unsubscribe = effect(() => {
        const status = executor.status();
        if (status.status === "error") {
          errorStatus = status;
        }
      });

      executor.exec();
      await executor.waitForIdle();

      unsubscribe();

      // 应该在执行过程中捕获到 error 状态
      expect(errorStatus).not.toBeNull();
      expect(errorStatus!.status).toBe("error");
      if (errorStatus!.status === "error") {
        expect(errorStatus!.error.message).toBe("Test error");
      }

      // 队列清空后，状态应该保持 error（因为最后一次执行失败）
      const finalStatus = executor.status();
      expect(finalStatus.status).toBe("error");
      if (finalStatus.status === "error") {
        expect(finalStatus.error.message).toBe("Test error");
      }
    });

    it("应该能够订阅状态变化", async () => {
      const executor = new PersistExecutor(async () => {
        await wait(20);
      });

      const statuses: string[] = [];
      const unsubscribe = effect(() => {
        statuses.push(executor.status().status);
      });

      executor.exec();
      await executor.waitForIdle();

      unsubscribe();

      // 应该收到 idle -> executing -> idle
      expect(statuses).toContain("idle");
      expect(statuses).toContain("executing");
      expect(statuses.filter(s => s === "idle").length).toBeGreaterThanOrEqual(2);
    });

    it("pending 数量应该正确更新", async () => {
      const executor = new PersistExecutor(async () => {
        await wait(30);
      });

      const pendingCounts: number[] = [];
      const unsubscribe = effect(() => {
        const status = executor.status();
        if (status.status === "executing") {
          pendingCounts.push(status.pending);
        }
      });

      executor.exec();
      await wait(10); // 等待第一个任务开始
      executor.exec();
      await wait(10);
      executor.exec();

      await executor.waitForIdle();
      unsubscribe();

      // 应该看到 pending 从高到低变化
      expect(pendingCounts.length).toBeGreaterThan(0);
    });
  });

  describe("读取最新数据", () => {
    it("应该持久化最新数据而不是入队时的数据", async () => {
      let latestValue = "v1";
      const persistedValues: string[] = [];
      let executionStarted = false;

      const executor = new PersistExecutor(async () => {
        executionStarted = true;
        // 先读取值，再等待
        const valueToSave = latestValue;
        await wait(50);
        persistedValues.push(valueToSave);
      });

      // 第一次触发
      latestValue = "v1";
      executor.exec();

      // 等待第一个任务真正开始执行
      while (!executionStarted) {
        await wait(5);
      }

      // 现在第一个任务已经在执行中，更新数据并触发新的持久化
      latestValue = "v2";
      executor.exec();

      latestValue = "v3";
      executor.exec();

      await executor.waitForIdle();

      // 第一次持久化 v1（已经开始执行时读取的值）
      // 第二次和第三次被合并，持久化时数据已经是 v3
      expect(persistedValues).toEqual(["v1", "v3"]);
    });
  });
});
