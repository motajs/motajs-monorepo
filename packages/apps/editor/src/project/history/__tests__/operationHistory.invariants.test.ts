/**
 * operationHistory 不变量特性化测试
 *
 * 只冻结 D-11 列出的不变量（容量、逆操作、多目标 checkpoint、组合失败恢复、
 * patch/set 后资源响应性），不录制完整状态转移快照。
 *
 * 本文件与现有 operationHistory.test.ts 并存且不改动它：现有测试是「原样」，
 * 这里是新增的独立安全网，供后续阶段迁移 lib/edit/* 时对照。
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileHandlerManager } from "@/fs/FileHandlerManager";
import { persistenceMonitor } from "@/fs/PersistenceMonitor";
import { tableCommands } from "@/project/commands/tableCommands";
import { projectData } from "@/project/data/projectData";
import { operationHistory } from "../operationHistory";
import { compositeOperation, type EditorOperation, type OperationTarget } from "../operations";
import { loadSampleProject, type SampleProjectContext } from "@test/utils/sampleProject";

describe("operationHistory invariants", () => {
  let value = 0;

  beforeEach(() => {
    value = 0;
    operationHistory.clear();
  });

  afterEach(() => {
    operationHistory.clear();
  });

  /**
   * 纯内存计数器操作：不读任何工程 fixture，也不需要 mota-js submodule。
   * 镜像现有 spec 的局部 counterOperation helper。
   */
  const counterOperation = (delta: number): EditorOperation<unknown> => ({
    meta: { label: "counter", stage: "counter" },
    targets: [],
    apply: async () => {
      value += delta;
      return { value, inverse: counterOperation(-delta), changed: delta !== 0 };
    },
  });

  /**
   * 自定义 OperationTarget 工厂：以每个 key 的 capture/restore 计数与调用顺序
   * 作为可观测量，不读取 operationHistory 的内部 entries。
   */
  function createTrackedTargets() {
    const log: string[] = [];
    const captures = new Map<string, number>();
    const restores = new Map<string, number>();
    const state = new Map<string, number>([["a", 1], ["b", 2], ["c", 3]]);

    function target(key: string): OperationTarget {
      return {
        key,
        path: `path:${key}`,
        capture: async () => {
          captures.set(key, (captures.get(key) ?? 0) + 1);
          log.push(`capture:${key}`);
          return state.get(key);
        },
        restore: async (checkpoint) => {
          restores.set(key, (restores.get(key) ?? 0) + 1);
          log.push(`restore:${key}`);
          state.set(key, checkpoint as number);
        },
      };
    }

    return { log, captures, restores, state, target };
  }

  function failingOperation(
    targets: readonly OperationTarget[],
    mutate: () => void,
  ): EditorOperation {
    return {
      meta: { label: "failing", stage: "failing-operation" },
      targets,
      apply: async () => {
        mutate();
        throw new Error("intentional failure");
      },
    };
  }

  it("keeps at most 100 entries and evicts the oldest once capacity is exceeded", async () => {
    for (let delta = 1; delta <= 101; delta++) {
      await operationHistory.execute(counterOperation(delta));
    }

    const observedUndoValues: number[] = [];
    let undoCount = 0;
    for (let attempt = 0; attempt < 150; attempt++) {
      const before = value;
      await operationHistory.undo();
      if (value === before) break;
      observedUndoValues.push(value);
      undoCount += 1;
    }

    // Capacity is frozen behaviourally: exactly 100 undos succeed, the 101st is a no-op.
    expect(undoCount).toBe(100);
    expect(new Set(observedUndoValues).size).toBe(100);
    // The first (oldest) commit was evicted, so its effect is never undone: value stays 1.
    expect(value).toBe(1);
  });

  it("applies the stored inverse on undo and re-applies it on redo", async () => {
    await operationHistory.execute(counterOperation(5));
    expect(value).toBe(5);

    await operationHistory.undo();
    expect(value).toBe(0);

    await operationHistory.redo();
    expect(value).toBe(5);

    await operationHistory.undo();
    expect(value).toBe(0);
  });

  it("truncates the redo tail when a new operation is committed after an undo", async () => {
    await operationHistory.execute(counterOperation(1));
    await operationHistory.undo();
    await operationHistory.execute(counterOperation(10));

    await operationHistory.redo();
    expect(value).toBe(10);
  });

  it("records nothing when a commit reports no change", async () => {
    const noChangeOperation: EditorOperation<unknown> = {
      meta: { label: "no-change", stage: "no-change" },
      targets: [],
      apply: async () => ({
        value: undefined,
        inverse: counterOperation(999),
        changed: false,
      }),
    };

    await operationHistory.execute(noChangeOperation);
    expect(value).toBe(0);

    // If the no-change commit had been recorded, this undo would apply its
    // inverse (a +999 counter) and the value would jump.
    await operationHistory.undo();
    expect(value).toBe(0);
  });

  it("captures and restores each distinct target once, de-duplicated by key", async () => {
    const tracked = createTrackedTargets();
    const duplicated = tracked.target("a");
    const operation = failingOperation([duplicated, duplicated, tracked.target("b")], () => {
      tracked.state.set("a", 100);
      tracked.state.set("b", 200);
    });

    await expect(operationHistory.execute(operation)).rejects.toThrow("intentional failure");

    // Each distinct target is captured once; restore runs in reverse (b before a).
    expect([...tracked.captures.entries()]).toEqual([["a", 1], ["b", 1]]);
    expect([...tracked.restores.entries()]).toEqual([["b", 1], ["a", 1]]);
    expect(tracked.state.get("a")).toBe(1);
    expect(tracked.state.get("b")).toBe(2);
  });

  it("restores distinct targets in the reverse of their capture order", async () => {
    const tracked = createTrackedTargets();
    const operation = failingOperation(
      [tracked.target("a"), tracked.target("b"), tracked.target("c")],
      () => {
        tracked.state.set("a", 10);
        tracked.state.set("b", 20);
        tracked.state.set("c", 30);
      },
    );

    await expect(operationHistory.execute(operation)).rejects.toThrow("intentional failure");

    // Restore order is the exact reverse of capture order.
    expect(tracked.log.join("|")).toBe(
      "capture:a|capture:b|capture:c|restore:c|restore:b|restore:a",
    );
  });

  it("leaves every target at its pre-apply value and records no entry when apply fails", async () => {
    const tracked = createTrackedTargets();
    const operation = failingOperation(
      [tracked.target("a"), tracked.target("b")],
      () => {
        tracked.state.set("a", 10);
        tracked.state.set("b", 20);
      },
    );

    await expect(operationHistory.execute(operation)).rejects.toThrow("intentional failure");
    expect(tracked.state.get("a")).toBe(1);
    expect(tracked.state.get("b")).toBe(2);

    const restoresAfterExecute = [...tracked.restores.entries()];
    await operationHistory.undo();

    expect(tracked.state.get("a")).toBe(1);
    expect(tracked.state.get("b")).toBe(2);
    // No entry was recorded, so undo performed no additional target restore.
    expect([...tracked.restores.entries()]).toEqual(restoresAfterExecute);
  });

  it("captures a target on a successful commit and applies the stored inverse on undo", async () => {
    const tracked = createTrackedTargets();
    const targetA = tracked.target("a");
    const operation: EditorOperation = {
      meta: { label: "success", stage: "success-operation" },
      targets: [targetA],
      apply: async () => {
        tracked.state.set("a", 42);
        return {
          value: undefined,
          inverse: {
            meta: { label: "success", stage: "success-operation" },
            targets: [targetA],
            apply: async () => {
              tracked.state.set("a", 7);
              return { value: undefined, inverse: operation, changed: true };
            },
          },
          changed: true,
        };
      },
    };

    await operationHistory.execute(operation);
    expect(tracked.state.get("a")).toBe(42);
    expect(tracked.captures.get("a")).toBe(1);
    // A successful apply does not roll back, so no restore happens.
    expect(tracked.restores.get("a")).toBeUndefined();

    await operationHistory.undo();
    expect(tracked.state.get("a")).toBe(7);
    expect(tracked.restores.get("a")).toBeUndefined();
  });

  it("recovers completed composite children through their semantic inverses and tags the failing stage", async () => {
    let counter = 0;
    const compositeCounter = (delta: number): EditorOperation<unknown> => ({
      meta: { label: "counter", stage: "counter" },
      targets: [],
      apply: async () => {
        counter += delta;
        return { value: counter, inverse: compositeCounter(-delta), changed: delta !== 0 };
      },
    });
    const failingChild: EditorOperation<unknown> = {
      meta: { label: "failure", stage: "composite-child" },
      targets: [],
      apply: async () => {
        throw new Error("composite failure");
      },
    };

    await expect(operationHistory.execute(compositeOperation(
      [compositeCounter(1), failingChild],
      { label: "composite", stage: "composite" },
    ))).rejects.toMatchObject({ commandStage: "composite-child" });
    expect(counter).toBe(0);
  });
});
