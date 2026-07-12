import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileHandler } from "@/fs/FileHandler";
import { FileHandlerManager } from "@/fs/FileHandlerManager";
import { MemoryFileSystem } from "@test/utils/MemoryFileSystem";
import { serializeToJsMapFile } from "@/utils/serialize";
import { floorCommands } from "../floorCommands";
import { projectData } from "@/project/data/projectData";
import type { FloorData } from "@/types";

function createFloorData(floorId: string, overrides: Partial<FloorData> = {}): FloorData {
  return {
    floorId,
    title: floorId,
    name: floorId,
    width: 2,
    height: 2,
    canFlyTo: true,
    canFlyFrom: true,
    map: [
      [1, 2],
      [3, 4],
    ],
    bgmap: [
      [5, 0],
      [0, 6],
    ],
    fgmap: [],
    events: { "0,0": [{ type: "event" }] },
    beforeBattle: {},
    afterBattle: { "1,1": [{ type: "afterBattle" }] },
    afterGetItem: {},
    afterOpenDoor: {},
    changeFloor: { "1,0": { floorId: "NEXT" } },
    autoEvent: { "0,1": { "2": null } },
    cannotMove: {},
    upFloor: [0, 0],
    downFloor: [1, 1],
    ...overrides,
  };
}

describe("floorCommands", () => {
  let memoryFs: MemoryFileSystem;

  beforeEach(() => {
    memoryFs = new MemoryFileSystem();
    FileHandlerManager.clear();
  });

  afterEach(() => {
    FileHandlerManager.clear();
  });

  async function setupFloor(floorId: string, data: FloorData): Promise<void> {
    const path = `project/floors/${floorId}.js`;
    memoryFs.setFile(path, serializeToJsMapFile(floorId, data));
    const handler = new FileHandler(path, memoryFs.createFsInterface());
    await handler.load();
    (FileHandlerManager as unknown as { handlers: Map<string, FileHandler> }).handlers.set(path, handler);
    projectData.clearFloorCache(floorId);
  }

  it("resizes maps and shifts coordinate fields with positive offsets", async () => {
    const floorId = "ResizePositive";
    await setupFloor(floorId, createFloorData(floorId));

    const result = await floorCommands.resize(floorId, {
      width: 3,
      height: 3,
      offsetX: 1,
      offsetY: 1,
    });

    expect(result).toEqual({ ok: true });
    const floor = projectData.floor(floorId).value();
    expect(floor.width).toBe(3);
    expect(floor.height).toBe(3);
    expect(floor.map).toEqual([
      [0, 0, 0],
      [0, 1, 2],
      [0, 3, 4],
    ]);
    expect(floor.bgmap).toEqual([
      [0, 0, 0],
      [0, 5, 0],
      [0, 0, 6],
    ]);
    expect(floor.events).toEqual({ "1,1": [{ type: "event" }] });
    expect(floor.afterBattle).toEqual({ "2,2": [{ type: "afterBattle" }] });
    expect(floor.changeFloor).toEqual({ "2,1": { floorId: "NEXT" } });
    expect(floor.autoEvent).toEqual({ "1,2": { "2": null } });
    expect(floor.upFloor).toEqual([1, 1]);
    expect(floor.downFloor).toEqual([2, 2]);
  });

  it("crops maps and drops out-of-bounds coordinate fields with negative offsets", async () => {
    const floorId = "ResizeNegative";
    await setupFloor(floorId, createFloorData(floorId));

    const result = await floorCommands.resize(floorId, {
      width: 1,
      height: 1,
      offsetX: -1,
      offsetY: -1,
    });

    expect(result).toEqual({ ok: true });
    const floor = projectData.floor(floorId).value();
    expect(floor.width).toBe(1);
    expect(floor.height).toBe(1);
    expect(floor.map).toEqual([[4]]);
    expect(floor.bgmap).toEqual([[6]]);
    expect(floor.events).toEqual({});
    expect(floor.afterBattle).toEqual({ "0,0": [{ type: "afterBattle" }] });
    expect(floor.changeFloor).toEqual({});
    expect(floor.autoEvent).toEqual({});
    expect(floor.upFloor).toEqual([0, 0]);
    expect(floor.downFloor).toEqual([0, 0]);
  });
});
