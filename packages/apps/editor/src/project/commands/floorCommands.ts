import { produce } from "immer";
import { FileHandlerManager } from "@/fs/FileHandlerManager";
import { projectData } from "@/project/data/projectData";
import type { FloorData } from "@/types";
import { serializeToJsMapFile } from "@/utils/serialize";
import type { Action } from "@/utils/action";
import { isValidFloorId } from "@/utils/string";
import {
  deleteTextFileOperation,
  executeCompositeCommand,
  executePatchCommand,
  navigateFloorOperation,
  patchResourceOperation,
  writeTextFileOperation,
  type EditorOperation,
  type PatchCommandOptions,
} from "@/project/history";
import { commandError, type CommandResult } from "./types";

export interface CreateFloorOptions {
  title?: string;
  name?: string;
  width?: number;
  height?: number;
  canFlyTo?: boolean;
  canFlyFrom?: boolean;
}

export interface BatchCreateFloorOptions extends CreateFloorOptions {
  floorId: string;
}

export interface BatchFloorPatch {
  floorId: string;
  actions: Action[];
}

export interface ResizeFloorOptions {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

const MAP_FIELDS = ["map", "bgmap", "fgmap"] as const;
const COORD_FIELDS = [
  "events",
  "beforeBattle",
  "afterBattle",
  "afterGetItem",
  "afterOpenDoor",
  "changeFloor",
  "autoEvent",
  "cannotMove",
] as const;

function floorPath(floorId: string): string {
  return `project/floors/${floorId}.js`;
}

function floorFileOptions(floorId: string) {
  return { invalidate: () => projectData.clearFloorCache(floorId) };
}

function createInitialFloorData(
  floorId: string,
  options: CreateFloorOptions = {},
): FloorData {
  const width = options.width ?? 13;
  const height = options.height ?? 13;
  const emptyMap = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => 0)
  );

  return {
    floorId,
    title: options.title ?? floorId,
    name: options.name ?? floorId,
    width,
    height,
    canFlyTo: options.canFlyTo ?? true,
    canFlyFrom: options.canFlyFrom ?? true,
    map: emptyMap,
    bgmap: [],
    fgmap: [],
    events: {},
    beforeBattle: {},
    afterBattle: {},
    afterGetItem: {},
    afterOpenDoor: {},
    changeFloor: {},
    autoEvent: {},
    cannotMove: {},
  };
}

function validateFloorSize(width: number, height: number): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 || width > 128 || height > 128) {
    throw new Error("Floor width and height must be integers between 1 and 128");
  }
}

function resizeMap(
  currentMap: unknown,
  width: number,
  height: number,
  offsetX: number,
  offsetY: number,
): unknown[][] {
  const map = Array.isArray(currentMap) ? currentMap : [];
  const result: unknown[][] = [];

  for (let y = 0; y < height; y++) {
    const row: unknown[] = [];
    for (let x = 0; x < width; x++) {
      const oldX = x - offsetX;
      const oldY = y - offsetY;
      const oldRow = map[oldY];
      row.push(Array.isArray(oldRow) ? oldRow[oldX] ?? 0 : 0);
    }
    result.push(row);
  }

  return result;
}

function shiftCoordRecord(
  current: unknown,
  width: number,
  height: number,
  offsetX: number,
  offsetY: number,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (!current || typeof current !== "object") return result;

  for (const [key, value] of Object.entries(current as Record<string, unknown>)) {
    const [oldXRaw, oldYRaw] = key.split(",");
    const oldX = Number(oldXRaw);
    const oldY = Number(oldYRaw);
    if (!Number.isInteger(oldX) || !Number.isInteger(oldY)) continue;

    const x = oldX + offsetX;
    const y = oldY + offsetY;
    if (x >= 0 && x < width && y >= 0 && y < height) {
      result[`${x},${y}`] = value;
    }
  }

  return result;
}

function shiftPoint(value: unknown, width: number, height: number, offsetX: number, offsetY: number): unknown {
  if (!Array.isArray(value) || value.length !== 2) return value;
  const x = Number(value[0]) + offsetX;
  const y = Number(value[1]) + offsetY;
  if (!Number.isInteger(x) || !Number.isInteger(y)) return value;
  if (x < 0 || x >= width || y < 0 || y >= height) return value;
  return [x, y];
}

class FloorCommands {
  async patch(
    floorId: string,
    actions: Action[],
    options: PatchCommandOptions = {
      label: `修改楼层 ${floorId}`,
      stage: "patch-floor",
    },
  ): Promise<CommandResult> {
    return executePatchCommand(projectData.floor(floorId), actions, options);
  }

  async batchPatch(changes: BatchFloorPatch[]): Promise<CommandResult> {
    return executeCompositeCommand(changes.map((change) => patchResourceOperation(
      projectData.floor(change.floorId),
      change.actions,
      { label: `批量修改楼层`, stage: `batch-patch-floor:${change.floorId}` },
    )), { label: "批量修改楼层", stage: "batch-patch-floor" });
  }

  async create(floorId: string, options: CreateFloorOptions = {}): Promise<CommandResult> {
    const path = floorPath(floorId);
    try {
      if (!isValidFloorId(floorId)) throw new Error(`Invalid floorId: ${floorId}`);
      validateFloorSize(options.width ?? 13, options.height ?? 13);
      if (await FileHandlerManager.exists(path)) {
        throw new Error(`Floor ${floorId} already exists`);
      }
    } catch (error) {
      return commandError("check-new-floor", error);
    }

    try {
      const tower = projectData.tower().value();
      const floorIds = tower.main.floorIds.includes(floorId)
        ? tower.main.floorIds
        : [...tower.main.floorIds, floorId];
      const towerActions: Action[] = [["change", "['main']['floorIds']", floorIds]];
      if (!tower.firstData.floorId) towerActions.push(["change", "['firstData']['floorId']", floorId]);
      const floorData = createInitialFloorData(floorId, options);
      return executeCompositeCommand([
        writeTextFileOperation(path, serializeToJsMapFile(floorId, floorData), {
          label: `新建楼层 ${floorId}`, stage: "write-new-floor",
        }, floorFileOptions(floorId)),
        patchResourceOperation(projectData.tower(), towerActions, {
          label: `新建楼层 ${floorId}`, stage: "update-floorIds",
        }),
        navigateFloorOperation(floorId, {
          label: `新建楼层 ${floorId}`, stage: "navigate-new-floor",
        }),
      ], { label: `新建楼层 ${floorId}`, stage: "create-floor" });
    } catch (error) {
      return commandError("update-floorIds", error);
    }
  }

  async batchCreate(floors: BatchCreateFloorOptions[]): Promise<CommandResult> {
    try {
      if (floors.length === 0) {
        throw new Error("No floors to create");
      }
      const tower = projectData.tower().value();
      const seen = new Set<string>();
      const existing = new Set(tower.main.floorIds.map((id) => id.toLowerCase()));

      for (const floor of floors) {
        const normalized = floor.floorId.toLowerCase();
        if (!isValidFloorId(floor.floorId)) {
          throw new Error(`Invalid floorId: ${floor.floorId}`);
        }
        if (seen.has(normalized)) {
          throw new Error(`Duplicate floorId: ${floor.floorId}`);
        }
        if (existing.has(normalized) || await FileHandlerManager.exists(floorPath(floor.floorId))) {
          throw new Error(`Floor ${floor.floorId} already exists`);
        }
        validateFloorSize(floor.width ?? 13, floor.height ?? 13);
        seen.add(normalized);
      }
    } catch (error) {
      return commandError("precheck-batch-create-floors", error);
    }

    try {
      const tower = projectData.tower().value();
      const operations: EditorOperation<unknown>[] = floors.map((floor) => writeTextFileOperation(
        floorPath(floor.floorId),
        serializeToJsMapFile(floor.floorId, createInitialFloorData(floor.floorId, floor)),
        { label: "批量新建楼层", stage: `batch-create-floor:${floor.floorId}` },
        floorFileOptions(floor.floorId),
      ));
      const nextFloorIds = [...tower.main.floorIds, ...floors.map((floor) => floor.floorId)];
      const towerActions: Action[] = [["change", "['main']['floorIds']", nextFloorIds]];
      if (!tower.firstData.floorId) {
        towerActions.push(["change", "['firstData']['floorId']", floors[0].floorId]);
      }
      operations.push(patchResourceOperation(projectData.tower(), towerActions, {
        label: "批量新建楼层", stage: "batch-create-floor:update-floorIds",
      }));
      operations.push(navigateFloorOperation(floors[0].floorId, {
        label: "批量新建楼层", stage: "batch-create-floor:navigate",
      }));
      return executeCompositeCommand(operations, {
        label: `批量新建 ${floors.length} 个楼层`, stage: "batch-create-floors",
      });
    } catch (error) {
      return commandError("batch-create-floors", error);
    }
  }

  async rename(oldFloorId: string, newFloorId: string): Promise<CommandResult> {
    const newPath = floorPath(newFloorId);
    try {
      if (!isValidFloorId(newFloorId)) throw new Error(`Invalid floorId: ${newFloorId}`);
      if (await FileHandlerManager.exists(newPath)) {
        throw new Error(`Floor ${newFloorId} already exists`);
      }
    } catch (error) {
      return commandError("check-new-floor", error);
    }

    try {
      const oldData = projectData.floor(oldFloorId).value();
      const newData = produce(oldData, (draft) => { draft.floorId = newFloorId; });
      const tower = projectData.tower().value();
      const floorIds = tower.main.floorIds.map((id) => id === oldFloorId ? newFloorId : id);
      const towerActions: Action[] = [["change", "['main']['floorIds']", floorIds]];
      if (tower.firstData.floorId === oldFloorId) {
        towerActions.push(["change", "['firstData']['floorId']", newFloorId]);
      }
      return executeCompositeCommand([
        writeTextFileOperation(newPath, serializeToJsMapFile(newFloorId, newData), {
          label: `重命名楼层 ${oldFloorId}`, stage: "write-renamed-floor",
        }, floorFileOptions(newFloorId)),
        patchResourceOperation(projectData.tower(), towerActions, {
          label: `重命名楼层 ${oldFloorId}`, stage: "update-floorIds",
        }),
        navigateFloorOperation(newFloorId, {
          label: `重命名楼层 ${oldFloorId}`, stage: "navigate-renamed-floor",
        }, oldFloorId),
        deleteTextFileOperation(floorPath(oldFloorId), {
          label: `重命名楼层 ${oldFloorId}`, stage: "delete-old-floor",
        }, floorFileOptions(oldFloorId)),
      ], { label: `重命名楼层 ${oldFloorId} -> ${newFloorId}`, stage: "rename-floor" });
    } catch (error) {
      return commandError("update-floorIds", error);
    }
  }

  async delete(floorId: string): Promise<CommandResult> {
    try {
      const tower = projectData.tower().value();
      const floorIds = tower.main.floorIds.filter((id) => id !== floorId);
      const towerActions: Action[] = [["change", "['main']['floorIds']", floorIds]];
      if (tower.firstData.floorId === floorId) {
        towerActions.push(["change", "['firstData']['floorId']", floorIds[0] ?? ""]);
      }
      return executeCompositeCommand([
        navigateFloorOperation(floorIds[0] ?? "", {
          label: `删除楼层 ${floorId}`, stage: "navigate-after-delete",
        }, floorId),
        patchResourceOperation(projectData.tower(), towerActions, {
          label: `删除楼层 ${floorId}`, stage: "update-floorIds",
        }),
        deleteTextFileOperation(floorPath(floorId), {
          label: `删除楼层 ${floorId}`, stage: "delete-floor-file",
        }, floorFileOptions(floorId)),
      ], { label: `删除楼层 ${floorId}`, stage: "delete-floor" });
    } catch (error) {
      return commandError("update-floorIds", error);
    }
  }

  async resize(floorId: string, options: ResizeFloorOptions): Promise<CommandResult> {
    const { width, height, offsetX, offsetY } = options;

    try {
      validateFloorSize(width, height);
    } catch (error) {
      return commandError("validate-floor-size", error);
    }
    if (!Number.isInteger(offsetX) || !Number.isInteger(offsetY)) {
      return commandError("validate-floor-offset", new Error("Floor resize offsets must be integers"));
    }

    try {
      const record = projectData.floor(floorId).value() as unknown as Record<string, unknown>;
      const actions: Action[] = [
        ["change", "['width']", width],
        ["change", "['height']", height],
      ];

      for (const field of MAP_FIELDS) {
        actions.push([
          "change",
          `['${field}']`,
          resizeMap(record[field], width, height, offsetX, offsetY),
        ]);
      }
      for (const field of COORD_FIELDS) {
        actions.push([
          "change",
          `['${field}']`,
          shiftCoordRecord(record[field], width, height, offsetX, offsetY),
        ]);
      }
      actions.push(
        ["change", "['upFloor']", shiftPoint(record.upFloor, width, height, offsetX, offsetY)],
        ["change", "['downFloor']", shiftPoint(record.downFloor, width, height, offsetX, offsetY)],
      );

      return this.patch(floorId, actions, {
        label: `调整楼层尺寸 ${floorId}`,
        stage: "resize-floor",
      });
    } catch (error) {
      return commandError("resize-floor", error);
    }
  }
}

export const floorCommands = new FloorCommands();
