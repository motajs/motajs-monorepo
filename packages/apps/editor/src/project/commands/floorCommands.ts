import { produce } from "immer";
import { cloneDeep } from "es-toolkit";
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
import {
  partitionContainingFloor,
  validateFloorOrganization,
  type FloorPartition,
} from "@/project/model/floorOrganization";
import { buildFloorCoordinateTransformPlan } from "@/project/model/floorCoordinateReferences";
import {
  DEFAULT_MAP_LAYERS,
  getMapLayerSettingsSnapshot,
  type MapLayerDefinition,
} from "@/project/settings/mapLayerSettings";

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

export interface FloorOrganizationOptions {
  floorIds: string[];
  floorPartitions: FloorPartition[];
}

export type CopyFloorMode = "full" | "blank";

const BLANK_COPY_EVENT_FIELDS = [
  "events",
  "beforeBattle",
  "afterBattle",
  "afterGetItem",
  "afterOpenDoor",
  "changeFloor",
  "autoEvent",
  "cannotMove",
  "cannotMoveIn",
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
  layers: readonly MapLayerDefinition[] = DEFAULT_MAP_LAYERS,
): FloorData {
  const width = options.width ?? 13;
  const height = options.height ?? 13;
  const emptyMap = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => 0)
  );

  const floor: FloorData = {
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
    cannotMoveIn: {},
  };
  for (const layer of layers) {
    if (!(layer.property in floor)) floor[layer.property] = [];
  }
  return floor;
}

function validateFloorSize(width: number, height: number): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 || width > 128 || height > 128) {
    throw new Error("Floor width and height must be integers between 1 and 128");
  }
}

function createZeroMap(width: number, height: number): number[][] {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => 0));
}

function readPartitions(tower: { main: Record<string, unknown> }): unknown {
  return tower.main.floorPartitions;
}

function sameFloorSet(current: readonly string[], next: readonly string[]): boolean {
  if (current.length !== next.length) return false;
  const expected = new Set(current);
  return expected.size === current.length && next.every((floorId) => expected.has(floorId));
}

function partitionsAfterDelete(
  floorIds: readonly string[],
  partitions: readonly FloorPartition[],
  deletedFloorId: string,
): FloorPartition[] {
  return partitions.flatMap(([startId, endId]) => {
    const start = floorIds.indexOf(startId);
    const end = floorIds.indexOf(endId);
    const remaining = floorIds.slice(start, end + 1).filter((floorId) => floorId !== deletedFloorId);
    return remaining.length ? [[remaining[0], remaining.at(-1)!] as FloorPartition] : [];
  });
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

  async updateOrganization(options: FloorOrganizationOptions): Promise<CommandResult> {
    try {
      const tower = projectData.tower().value();
      if (!sameFloorSet(tower.main.floorIds, options.floorIds)) {
        throw new Error("楼层排序只能改变现有楼层的顺序，不能增删楼层");
      }
      const validation = validateFloorOrganization(options.floorIds, options.floorPartitions);
      if (!validation.valid) throw new Error(validation.diagnostics.join("；"));
      return executePatchCommand(projectData.tower(), [
        ["change", "['main']['floorIds']", options.floorIds],
        ["change", "['main']['floorPartitions']", validation.partitions],
      ], {
        label: "调整楼层顺序与分区",
        stage: "update-floor-organization",
      });
    } catch (error) {
      return commandError("update-floor-organization", error);
    }
  }

  async copy(sourceFloorId: string, targetFloorId: string, mode: CopyFloorMode): Promise<CommandResult> {
    const path = floorPath(targetFloorId);
    try {
      if (!isValidFloorId(targetFloorId)) throw new Error(`Invalid floorId: ${targetFloorId}`);
      const tower = projectData.tower().value();
      if (tower.main.floorIds.some((floorId) => floorId.toLowerCase() === targetFloorId.toLowerCase())) {
        throw new Error(`Floor ${targetFloorId} already exists`);
      }
      if (await FileHandlerManager.exists(path)) throw new Error(`Floor ${targetFloorId} already exists`);
      if (!tower.main.floorIds.includes(sourceFloorId)) throw new Error(`Floor ${sourceFloorId} does not exist`);

      const organization = validateFloorOrganization(tower.main.floorIds, readPartitions(tower));
      if (!organization.valid) throw new Error(organization.diagnostics.join("；"));
      const source = projectData.floor(sourceFloorId).value();
      const copied = cloneDeep(source);
      copied.floorId = targetFloorId;
      if (mode === "blank") {
        const layers = getMapLayerSettingsSnapshot();
        const width = copied.width ?? copied.map?.[0]?.length ?? 13;
        const height = copied.height ?? copied.map?.length ?? 13;
        validateFloorSize(width, height);
        for (const layer of layers) copied[layer.property] = createZeroMap(width, height);
        for (const field of BLANK_COPY_EVENT_FIELDS) copied[field] = {};
      }

      const sourceIndex = tower.main.floorIds.indexOf(sourceFloorId);
      const floorIds = [...tower.main.floorIds];
      floorIds.splice(sourceIndex + 1, 0, targetFloorId);
      const floorPartitions = organization.partitions.map((partition) => [...partition] as FloorPartition);
      const partition = partitionContainingFloor(tower.main.floorIds, organization.partitions, sourceFloorId);
      if (partition != null && floorPartitions[partition][1] === sourceFloorId) {
        floorPartitions[partition][1] = targetFloorId;
      }

      return executeCompositeCommand([
        writeTextFileOperation(path, serializeToJsMapFile(targetFloorId, copied), {
          label: `复制楼层 ${sourceFloorId}`,
          stage: `copy-floor:${targetFloorId}`,
        }, floorFileOptions(targetFloorId)),
        patchResourceOperation(projectData.tower(), [
          ["change", "['main']['floorIds']", floorIds],
          ["change", "['main']['floorPartitions']", floorPartitions],
        ], {
          label: `复制楼层 ${sourceFloorId}`,
          stage: "copy-floor:update-organization",
        }),
        navigateFloorOperation(targetFloorId, {
          label: `复制楼层 ${sourceFloorId}`,
          stage: "copy-floor:navigate",
        }),
      ], {
        label: `${mode === "blank" ? "复制空白地图" : "复制地图"} ${sourceFloorId} -> ${targetFloorId}`,
        stage: "copy-floor",
      });
    } catch (error) {
      return commandError("copy-floor", error);
    }
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
      const layers = getMapLayerSettingsSnapshot();
      const floorIds = tower.main.floorIds.includes(floorId)
        ? tower.main.floorIds
        : [...tower.main.floorIds, floorId];
      const towerActions: Action[] = [["change", "['main']['floorIds']", floorIds]];
      if (!tower.firstData.floorId) towerActions.push(["change", "['firstData']['floorId']", floorId]);
      const floorData = createInitialFloorData(floorId, options, layers);
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
      const layers = getMapLayerSettingsSnapshot();
      const operations: EditorOperation<unknown>[] = floors.map((floor) => writeTextFileOperation(
        floorPath(floor.floorId),
        serializeToJsMapFile(floor.floorId, createInitialFloorData(floor.floorId, floor, layers)),
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
      const organization = validateFloorOrganization(tower.main.floorIds, readPartitions(tower));
      if (!organization.valid) throw new Error(organization.diagnostics.join("；"));
      const floorPartitions = organization.partitions.map(([startId, endId]): FloorPartition => [
        startId === oldFloorId ? newFloorId : startId,
        endId === oldFloorId ? newFloorId : endId,
      ]);
      const towerActions: Action[] = [
        ["change", "['main']['floorIds']", floorIds],
        ["change", "['main']['floorPartitions']", floorPartitions],
      ];
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
      const organization = validateFloorOrganization(tower.main.floorIds, readPartitions(tower));
      if (!organization.valid) throw new Error(organization.diagnostics.join("；"));
      const deletedIndex = tower.main.floorIds.indexOf(floorId);
      if (deletedIndex < 0) throw new Error(`Floor ${floorId} does not exist`);
      if (tower.main.floorIds.length <= 1) throw new Error("工程必须至少保留一个楼层");
      const floorIds = tower.main.floorIds.filter((id) => id !== floorId);
      const floorPartitions = partitionsAfterDelete(tower.main.floorIds, organization.partitions, floorId);
      const nextFloorId = floorIds[deletedIndex] ?? floorIds[deletedIndex - 1] ?? "";
      const towerActions: Action[] = [
        ["change", "['main']['floorIds']", floorIds],
        ["change", "['main']['floorPartitions']", floorPartitions],
      ];
      if (tower.firstData.floorId === floorId) {
        towerActions.push(["change", "['firstData']['floorId']", nextFloorId]);
      }
      const operations: EditorOperation<unknown>[] = [
        navigateFloorOperation(nextFloorId, {
          label: `删除楼层 ${floorId}`, stage: "navigate-after-delete",
        }, floorId),
        patchResourceOperation(projectData.tower(), towerActions, {
          label: `删除楼层 ${floorId}`, stage: "update-floorIds",
        }),
      ];
      if (await FileHandlerManager.exists(floorPath(floorId))) {
        operations.push(deleteTextFileOperation(floorPath(floorId), {
          label: `删除楼层 ${floorId}`, stage: "delete-floor-file",
        }, floorFileOptions(floorId)));
      }
      return executeCompositeCommand(operations, { label: `删除楼层 ${floorId}`, stage: "delete-floor" });
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
      const layers = getMapLayerSettingsSnapshot();
      const actions: Action[] = [
        ["change", "['width']", width],
        ["change", "['height']", height],
      ];

      for (const { property: field } of layers) {
        actions.push([
          "change",
          `['${field}']`,
          resizeMap(record[field], width, height, offsetX, offsetY),
        ]);
      }
      const coordinatePlan = await buildFloorCoordinateTransformPlan(floorId, ([x, y]) => {
        const nextX = x + offsetX;
        const nextY = y + offsetY;
        return nextX >= 0 && nextX < width && nextY >= 0 && nextY < height
          ? [nextX, nextY]
          : null;
      });
      actions.push(...coordinatePlan.targetActions);
      if (coordinatePlan.blocked.length > 0) {
        throw new Error(
          `以下外部坐标会被裁掉，请先重新指定落点：${coordinatePlan.blocked.map((item) => `${item.owner}.${item.path}`).join("、")}`,
        );
      }

      const operations: EditorOperation<unknown>[] = [patchResourceOperation(projectData.floor(floorId), actions, {
        label: `调整楼层尺寸 ${floorId}`,
        stage: "resize-floor",
      })];
      operations.push(...coordinatePlan.patches.map((patch) => patchResourceOperation(
        patch.resource,
        patch.actions,
        { label: patch.label, stage: patch.stage },
      )));
      return executeCompositeCommand(operations, {
        label: `调整楼层尺寸 ${floorId}`,
        stage: "resize-floor",
      });
    } catch (error) {
      return commandError("resize-floor", error);
    }
  }
}

export const floorCommands = new FloorCommands();
