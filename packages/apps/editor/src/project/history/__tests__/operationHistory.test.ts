import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileHandlerManager } from "@/fs/FileHandlerManager";
import { persistenceMonitor } from "@/fs/PersistenceMonitor";
import { projectData } from "@/project/data/projectData";
import { tableCommands } from "@/project/commands/tableCommands";
import { operationHistory } from "../operationHistory";
import { compositeOperation, type EditorOperation, type OperationTarget } from "../operations";
import {
  registerEditorViewportProvider,
  type EditorViewport,
} from "../viewport";
import { loadSampleProject, type SampleProjectContext } from "@test/utils/sampleProject";

function viewport(floorId: string): EditorViewport {
  return {
    activePanel: "floor",
    floorId,
    map: {
      pos: [2, 3],
      layer: "map",
      brush: "line",
      bigmap: false,
      bigmapInfo: { top: 0, left: 0, size: 32 },
      offset: [0, 0],
      selectedArea: null,
      tileSize: [1, 1],
      showMovable: false,
    },
    locSelection: null,
    prefabSelection: null,
  };
}

describe("OperationHistory", () => {
  let project: SampleProjectContext;
  let currentViewport: EditorViewport;
  let disposeViewport: () => void;

  beforeEach(async () => {
    operationHistory.clear();
    project = await loadSampleProject();
    currentViewport = viewport("sample0");
    disposeViewport = registerEditorViewportProvider({
      capture: () => structuredClone(currentViewport),
      restore: (next) => {
        currentViewport = structuredClone(next);
      },
    });
  });

  afterEach(() => {
    disposeViewport();
    operationHistory.clear();
    FileHandlerManager.clear();
    projectData.resetForTests();
  });

  it("uses inverse actions for undo and redo and restores the command viewport", async () => {
    const floor = await project.loadResource(projectData.floor("sample0"));
    const originalTitle = floor.title;

    expect(await tableCommands.patchFloor("sample0", [
      ["change", "['title']", "History title"],
    ])).toEqual({ ok: true });
    expect(projectData.floor("sample0").value().title).toBe("History title");

    currentViewport = viewport("sample1");
    await operationHistory.undo();
    expect(projectData.floor("sample0").value().title).toBe(originalTitle);
    expect(currentViewport.floorId).toBe("sample0");

    currentViewport = viewport("sample1");
    await operationHistory.redo();
    expect(projectData.floor("sample0").value().title).toBe("History title");
    expect(currentViewport.floorId).toBe("sample0");
  });

  it("finishes memory history before persistence and allows undo while a write is pending", async () => {
    const floorResource = projectData.floor("sample0");
    const floor = await project.loadResource(floorResource);
    const originalTitle = floor.title;
    project.fs.setWriteDelay(80);

    expect(await tableCommands.patchFloor("sample0", [
      ["change", "['title']", "Memory first title"],
    ])).toEqual({ ok: true });

    expect(floorResource.value().title).toBe("Memory first title");
    expect(persistenceMonitor.hasUnsavedChanges()).toBe(true);

    await operationHistory.undo();
    expect(floorResource.value().title).toBe(originalTitle);
    await persistenceMonitor.flush([floorResource.path]);
    expect(project.readText(floorResource.path)).not.toContain("Memory first title");
  });

  it("restores the temporary checkpoint when apply fails after a mutation", async () => {
    const floorResource = projectData.floor("sample0");
    const floor = await project.loadResource(floorResource);
    const originalTitle = floor.title;
    const raw = floorResource.raw();
    const target: OperationTarget = {
      key: `text:${floorResource.path}`,
      path: floorResource.path,
      capture: () => raw.getContent(),
      restore: async (checkpoint) => {
        const content = checkpoint as ReturnType<typeof raw.getContent>;
        if (content.status !== "loaded") throw new Error("invalid checkpoint");
        await Promise.resolve(raw.update(content.value));
      },
    };
    const operation: EditorOperation = {
      meta: { label: "失败操作", stage: "failing-operation" },
      targets: [target],
      apply: async () => {
        await floorResource.patch([["change", "['title']", "Partial title"]]);
        throw new Error("intentional failure");
      },
    };

    await expect(operationHistory.execute(operation)).rejects.toThrow("intentional failure");
    expect(floorResource.value().title).toBe(originalTitle);

    await operationHistory.undo();
    expect(floorResource.value().title).toBe(originalTitle);
  });

  it("uses semantic inverses to recover completed children when a composite operation fails", async () => {
    let value = 0;
    const counterOperation = (delta: number): EditorOperation<unknown> => ({
      meta: { label: "counter", stage: "counter" },
      targets: [],
      apply: async () => {
        value += delta;
        return {
          value,
          inverse: counterOperation(-delta),
          changed: delta !== 0,
        };
      },
    });
    const failingOperation: EditorOperation<unknown> = {
      meta: { label: "failure", stage: "composite-child" },
      targets: [],
      apply: async () => {
        throw new Error("composite failure");
      },
    };

    await expect(operationHistory.execute(compositeOperation(
      [counterOperation(1), failingOperation],
      { label: "composite", stage: "composite" },
    ))).rejects.toMatchObject({ commandStage: "composite-child" });
    expect(value).toBe(0);
  });
});
