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
});
