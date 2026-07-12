/**
 * signal 工具函数单元测试
 */

import { describe, it, expect } from "vitest";
import { signal } from "alien-signals";
import { waitUntil } from "../base/signal";
import { wait } from "@test/utils/testHelpers";

describe("waitUntil", () => {
  it("条件已满足时应该立即返回", async () => {
    const status = signal<string>("idle");

    const start = Date.now();
    await waitUntil(() => status() === "idle");
    const duration = Date.now() - start;

    // 应该几乎立即返回
    expect(duration).toBeLessThan(10);
  });

  it("应该等待条件满足", async () => {
    const status = signal<string>("loading");

    // 异步更新状态
    setTimeout(() => {
      status("idle");
    }, 50);

    const start = Date.now();
    await waitUntil(() => status() === "idle");
    const duration = Date.now() - start;

    // 应该等待约 50ms
    expect(duration).toBeGreaterThanOrEqual(45);
    expect(duration).toBeLessThan(100);
  });

  it("应该支持复杂条件判断", async () => {
    const counter = signal<number>(0);

    // 异步递增计数器
    const interval = setInterval(() => {
      counter(counter() + 1);
    }, 10);

    await waitUntil(() => counter() >= 5);

    clearInterval(interval);

    // 计数器应该 >= 5
    expect(counter()).toBeGreaterThanOrEqual(5);
  });

  it("应该支持对象状态判断", async () => {
    type Status = { status: "idle" | "loading"; data?: string };
    const state = signal<Status>({ status: "loading" });

    setTimeout(() => {
      state({ status: "idle", data: "result" });
    }, 30);

    await waitUntil(() => state().status === "idle");

    expect(state().status).toBe("idle");
    expect(state().data).toBe("result");
  });

  it("多次调用应该独立工作", async () => {
    const status = signal<string>("loading");

    // 两个独立的等待
    const promise1 = waitUntil(() => status() === "idle");
    const promise2 = waitUntil(() => status() === "idle");

    // 延迟更新状态
    setTimeout(() => {
      status("idle");
    }, 30);

    // 两个 Promise 都应该 resolve
    await Promise.all([promise1, promise2]);

    expect(status()).toBe("idle");
  });

  it("应该在条件满足后立即取消订阅", async () => {
    const status = signal<string>("loading");
    let effectCount = 0;

    // 启动等待
    const promise = waitUntil(() => {
      effectCount++;
      return status() === "idle";
    });

    await wait(10);
    status("idle");
    await promise;

    // 记录当前 effect 执行次数
    const countAfterResolve = effectCount;

    // 再次更新状态
    await wait(10);
    status("loading");
    await wait(10);
    status("idle");

    // effect 执行次数不应该增加（已取消订阅）
    expect(effectCount).toBe(countAfterResolve);
  });
});
