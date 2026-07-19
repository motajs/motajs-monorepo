import { projectData } from "@/project/data/projectData";
import type { Action } from "@/utils/action";
import { cloneDeep } from "es-toolkit";
import { executePatchCommand } from "@/project/history";
import { commandError, type CommandResult } from "./types";
import { assertMapMatrixSize, type MapMatrix } from "./mapMatrix";
import { buildFieldPath } from "@/utils/fieldPath";
import { getMapLayerSettingsSnapshot } from "@/project/settings/mapLayerSettings";

/** 楼层上的图块矩阵属性名。map 是唯一携带坐标事件的图层。 */
export type MapLayer = string;

export interface MapPosition {
  x: number;
  y: number;
}

export type PaintBlock =
  | 0
  | number
  | {
      id?: string;
      idnum?: number;
    };

export interface PaintOptions {
  floorId: string;
  layer?: MapLayer;
  pos?: MapPosition;
  positions?: MapPosition[];
  idnum?: number;
  block?: PaintBlock;
}

export interface CopiedMapCell {
  map: unknown;
  events: Record<string, unknown>;
}

export interface CopiedMapInfo {
  w?: number;
  h?: number;
  layer?: MapLayer;
  data?: CopiedMapCell[];
}

export interface PasteMapInfoOptions {
  floorId: string;
  layer?: MapLayer;
  pos: MapPosition;
  info: CopiedMapInfo;
}

export interface MoveLocOptions {
  floorId: string;
  layer?: MapLayer;
  from: MapPosition;
  to: MapPosition;
}

export interface MapRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface TilesetPaintPattern {
  startIdnum: number;
  sourceX: number;
  sourceY: number;
  width: number;
  height: number;
  columns: number;
  rows: number;
}

export interface PaintPatternOptions {
  floorId: string;
  layer?: MapLayer;
  targetPositions: MapPosition[];
  anchor: MapPosition;
  tileset: TilesetPaintPattern;
}

export interface ChangeFloorTarget {
  floorId: string;
  pos?: MapPosition;
}

export type ResolveChangeFloorTargetResult =
  | { ok: true; target: ChangeFloorTarget }
  | { ok: false; stage: string; error: Error };

export const MAP_EVENT_FIELDS = [
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

function layerPath(layer: MapLayer, pos: MapPosition): string {
  return buildFieldPath([layer, String(pos.y), String(pos.x)]);
}

function locKey(pos: MapPosition): string {
  return `${pos.x},${pos.y}`;
}

function normalizePositions(options: Pick<PaintOptions, "positions" | "pos">): MapPosition[] {
  const positions = options.positions ?? (options.pos ? [options.pos] : []);
  const unique = new Map<string, MapPosition>();

  for (const pos of positions) {
    if (!Number.isInteger(pos.x) || !Number.isInteger(pos.y)) {
      throw new Error(`Invalid map position: ${pos.x},${pos.y}`);
    }
    unique.set(locKey(pos), pos);
  }

  if (unique.size === 0) {
    throw new Error("No map positions to paint");
  }

  return [...unique.values()];
}

export function tilesetPatternIdnum(
  pattern: TilesetPaintPattern,
  anchor: MapPosition,
  position: MapPosition,
): number {
  const dx = ((position.x - anchor.x) % pattern.width + pattern.width) % pattern.width;
  const dy = ((position.y - anchor.y) % pattern.height + pattern.height) % pattern.height;
  return pattern.startIdnum
    + (pattern.sourceY + dy) * pattern.columns
    + pattern.sourceX + dx;
}

function resolvePaintValue(options: PaintOptions): number {
  if (typeof options.idnum === "number") return options.idnum;
  if (options.block === 0) return 0;
  if (typeof options.block === "number") return options.block;
  if (options.block?.idnum != null) return options.block.idnum;
  throw new Error("Paint block is missing idnum");
}

function stairActions(layer: MapLayer, pos: MapPosition, block: PaintBlock | undefined): Action[] {
  if (layer !== "map" || !block || typeof block !== "object") return [];

  const changeFloor = changeFloorForStairBlock(block.id);
  if (!changeFloor) return [];

  const key = locKey(pos);
  return [["change", `['changeFloor']['${key}']`, changeFloor]];
}

function changeFloorForStairBlock(blockId: string | undefined): Record<string, unknown> | null {
  switch (blockId) {
    case "upFloor":
      return { floorId: ":next", stair: "downFloor" };
    case "downFloor":
      return { floorId: ":before", stair: "upFloor" };
    case "leftPortal":
    case "rightPortal":
      return { floorId: ":next", stair: ":symmetry_x" };
    case "upPortal":
    case "downPortal":
      return { floorId: ":next", stair: ":symmetry_y" };
    default:
      return null;
  }
}

function clearEventActions(pos: MapPosition): Action[] {
  const key = locKey(pos);
  return MAP_EVENT_FIELDS.map((field) => [
    "delete",
    `['${field}']['${key}']`,
    undefined,
  ]);
}

function isInsideLayer(layerMap: unknown, pos: MapPosition): boolean {
  if (!Array.isArray(layerMap)) return false;
  const row = layerMap[pos.y];
  return Array.isArray(row) && pos.x >= 0 && pos.x < row.length;
}

function getMatrixSize(floor: Record<string, unknown>): { width: number; height: number } {
  const map = Array.isArray(floor.map) ? floor.map : [];
  const width = typeof floor.width === "number" ? floor.width : (Array.isArray(map[0]) ? map[0].length : 0);
  const height = typeof floor.height === "number" ? floor.height : map.length;
  return { width, height };
}

function createZeroMatrix(width: number, height: number): number[][] {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => 0));
}

function normalizedLayerMatrix(floor: Record<string, unknown>, layer: MapLayer): unknown[][] {
  const { width, height } = getMatrixSize(floor);
  const source = Array.isArray(floor[layer]) ? floor[layer] as unknown[] : [];
  return Array.from({ length: height }, (_, y) => {
    const row = source[y];
    return Array.from({ length: width }, (_, x) => Array.isArray(row) ? row[x] ?? 0 : 0);
  });
}

function initializeLayerActions(floor: Record<string, unknown>, layer: MapLayer): Action[] {
  const { width, height } = getMatrixSize(floor);
  const current = floor[layer];
  const valid = Array.isArray(current)
    && current.length === height
    && current.every((row) => Array.isArray(row) && row.length === width);
  return valid ? [] : [["change", buildFieldPath([layer]), normalizedLayerMatrix(floor, layer)]];
}

function readLayerCell(floor: Record<string, unknown>, layer: MapLayer, pos: MapPosition): unknown {
  const layerMap = floor[layer];
  if (!Array.isArray(layerMap)) return 0;
  const row = layerMap[pos.y];
  return Array.isArray(row) ? row[pos.x] ?? 0 : 0;
}

function readLocEvents(floor: Record<string, unknown>, pos: MapPosition): Record<string, unknown> {
  const key = locKey(pos);
  const result: Record<string, unknown> = {};
  for (const field of MAP_EVENT_FIELDS) {
    const record = floor[field] as Record<string, unknown> | undefined;
    if (record?.[key] != null) result[field] = cloneDeep(record[key]);
  }
  return result;
}

function normalizeRect(rect: MapRect): MapRect {
  const values = [rect.x0, rect.y0, rect.x1, rect.y1];
  if (values.some((value) => !Number.isInteger(value))) {
    throw new Error(`Invalid map rectangle: ${values.join(",")}`);
  }
  return {
    x0: Math.min(rect.x0, rect.x1),
    y0: Math.min(rect.y0, rect.y1),
    x1: Math.max(rect.x0, rect.x1),
    y1: Math.max(rect.y0, rect.y1),
  };
}

export function readMapInfo(
  floor: Record<string, unknown>,
  layer: MapLayer,
  rect: MapRect,
): CopiedMapInfo {
  const normalized = normalizeRect(rect);
  const data: CopiedMapCell[] = [];
  for (let y = normalized.y0; y <= normalized.y1; y += 1) {
    for (let x = normalized.x0; x <= normalized.x1; x += 1) {
      const pos = { x, y };
      data.push({
        map: cloneDeep(readLayerCell(floor, layer, pos)),
        events: layer === "map" ? readLocEvents(floor, pos) : {},
      });
    }
  }
  return {
    w: normalized.x1 - normalized.x0 + 1,
    h: normalized.y1 - normalized.y0 + 1,
    layer,
    data,
  };
}

function writeLocEventActions(
  actions: Action[],
  pos: MapPosition,
  events: Record<string, unknown>,
): void {
  const key = locKey(pos);
  for (const field of MAP_EVENT_FIELDS) {
    actions.push([
      events[field] == null ? "delete" : "change",
      `['${field}']['${key}']`,
      cloneDeep(events[field]),
    ]);
  }
}

function resolveRelativeFloorId(currentFloorId: string, targetFloorId: unknown, floorIds: string[]): string {
  if (typeof targetFloorId !== "string" || targetFloorId.length === 0) {
    throw new Error("changeFloor target is missing floorId");
  }

  if (targetFloorId === ":next" || targetFloorId === ":before") {
    const index = floorIds.indexOf(currentFloorId);
    if (index < 0) throw new Error(`Current floor ${currentFloorId} is not in floorIds`);
    const offset = targetFloorId === ":next" ? 1 : -1;
    const resolved = floorIds[index + offset];
    if (!resolved) throw new Error(`Cannot resolve ${targetFloorId} from ${currentFloorId}`);
    return resolved;
  }

  if (targetFloorId.startsWith(":")) {
    throw new Error(`Unsupported dynamic floor target: ${targetFloorId}`);
  }

  if (floorIds.length > 0 && !floorIds.includes(targetFloorId)) {
    throw new Error(`Target floor ${targetFloorId} is not in floorIds`);
  }

  return targetFloorId;
}

function readExplicitTargetPos(changeFloor: Record<string, unknown>): MapPosition | undefined {
  const loc = changeFloor.loc;
  if (!Array.isArray(loc)) return undefined;

  const [x, y] = loc;
  if (Number.isInteger(x) && Number.isInteger(y)) return { x, y };
  throw new Error(`Invalid changeFloor loc: ${JSON.stringify(loc)}`);
}

class MapCommands {
  async patchFloor(
    floorId: string,
    actions: Action[],
    label = `修改地图 ${floorId}`,
    stage = "patch-map-floor",
  ): Promise<CommandResult> {
    return executePatchCommand(projectData.floor(floorId), actions, { label, stage });
  }

  async paint(options: PaintOptions): Promise<CommandResult> {
    try {
      const layer = options.layer ?? "map";
      const positions = normalizePositions(options);
      const value = resolvePaintValue(options);
      const floor = projectData.floor(options.floorId).value() as unknown as Record<string, unknown>;
      const actions: Action[] = initializeLayerActions(floor, layer);

      for (const pos of positions) {
        actions.push(["change", layerPath(layer, pos), value]);
        actions.push(...stairActions(layer, pos, options.block));
      }

      return this.patchFloor(
        options.floorId,
        actions,
        `绘制地图 ${options.floorId}（${positions.length} 格）`,
        "paint-map",
      );
    } catch (error) {
      return commandError("paint-map", error);
    }
  }

  async paintPattern(options: PaintPatternOptions): Promise<CommandResult> {
    try {
      const layer = options.layer ?? "map";
      const positions = normalizePositions({ positions: options.targetPositions });
      const pattern = options.tileset;
      if (
        !Number.isInteger(pattern.width) || pattern.width <= 0
        || !Number.isInteger(pattern.height) || pattern.height <= 0
        || !Number.isInteger(pattern.columns) || pattern.columns <= 0
        || !Number.isInteger(pattern.rows) || pattern.rows <= 0
      ) {
        throw new Error("Invalid tileset pattern dimensions");
      }
      if (
        pattern.sourceX < 0 || pattern.sourceY < 0
        || pattern.sourceX + pattern.width > pattern.columns
        || pattern.sourceY + pattern.height > pattern.rows
      ) {
        throw new Error("Tileset pattern source is outside the image");
      }

      const floor = projectData.floor(options.floorId).value() as unknown as Record<string, unknown>;
      const actions: Action[] = [...initializeLayerActions(floor, layer), ...positions.map((pos): Action => [
        "change",
        layerPath(layer, pos),
        tilesetPatternIdnum(pattern, options.anchor, pos),
      ])];
      return this.patchFloor(
        options.floorId,
        actions,
        `平铺 tileset ${options.floorId}（${positions.length} 格）`,
        "paint-tileset-pattern",
      );
    } catch (error) {
      return commandError("paint-tileset-pattern", error);
    }
  }

  async clearArea(
    floorId: string,
    layer: MapLayer,
    rect: MapRect,
    includeEvents = true,
  ): Promise<CommandResult> {
    try {
      const normalized = normalizeRect(rect);
      const floor = projectData.floor(floorId).value() as unknown as Record<string, unknown>;
      const layerMap = floor[layer];
      const actions: Action[] = [];
      for (let y = normalized.y0; y <= normalized.y1; y += 1) {
        for (let x = normalized.x0; x <= normalized.x1; x += 1) {
          const pos = { x, y };
          if (!isInsideLayer(layerMap, pos)) continue;
          actions.push(["change", layerPath(layer, pos), 0]);
          if (layer === "map" && includeEvents) actions.push(...clearEventActions(pos));
        }
      }
      if (actions.length === 0) throw new Error("Map area does not intersect the floor");
      return this.patchFloor(
        floorId,
        actions,
        `清除地图区域 ${floorId}`,
        "clear-map-area",
      );
    } catch (error) {
      return commandError("clear-map-area", error);
    }
  }

  async clearEvents(floorId: string, pos: MapPosition): Promise<CommandResult> {
    return this.patchFloor(
      floorId,
      clearEventActions(pos),
      `清除位置事件 ${floorId} (${pos.x},${pos.y})`,
      "clear-map-events",
    );
  }

  async clearBlock(floorId: string, layer: MapLayer, pos: MapPosition): Promise<CommandResult> {
    const floor = projectData.floor(floorId).value() as unknown as Record<string, unknown>;
    return this.patchFloor(
      floorId,
      [...initializeLayerActions(floor, layer), ["change", layerPath(layer, pos), 0]],
      `清除图块 ${floorId} (${pos.x},${pos.y})`,
      "clear-map-block",
    );
  }

  async clearLoc(floorId: string, layer: MapLayer, pos: MapPosition): Promise<CommandResult> {
    const floor = projectData.floor(floorId).value() as unknown as Record<string, unknown>;
    const actions: Action[] = [...initializeLayerActions(floor, layer), ["change", layerPath(layer, pos), 0]];
    if (layer === "map") actions.push(...clearEventActions(pos));

    return this.patchFloor(
      floorId,
      actions,
      `清除位置 ${floorId} (${pos.x},${pos.y})`,
      "clear-map-loc",
    );
  }

  async pasteInfo(options: PasteMapInfoOptions): Promise<CommandResult> {
    const targetLayer = options.layer ?? "map";
    const sourceLayer = options.info.layer ?? "map";
    const width = options.info.w ?? 1;
    const height = options.info.h ?? 1;
    const data = options.info.data ?? [];

    try {
      if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
        throw new Error("Copied map info has invalid size");
      }

      const floor = projectData.floor(options.floorId).value() as Record<string, unknown>;
      const layerMap = normalizedLayerMatrix(floor, targetLayer);
      const actions: Action[] = initializeLayerActions(floor, targetLayer);
      let index = 0;

      for (let y = options.pos.y; y < options.pos.y + height; y++) {
        for (let x = options.pos.x; x < options.pos.x + width; x++) {
          const one = data[index++];
          if (!one || !isInsideLayer(layerMap, { x, y })) continue;

          const targetPos = { x, y };
          actions.push(["change", layerPath(targetLayer, targetPos), one.map]);

          if (sourceLayer === "map" && targetLayer === "map") {
            const key = locKey(targetPos);
            for (const field of MAP_EVENT_FIELDS) {
              actions.push([
                one.events[field] == null ? "delete" : "change",
                `['${field}']['${key}']`,
                structuredClone(one.events[field]),
              ]);
            }
          }
        }
      }

      return this.patchFloor(
        options.floorId,
        actions,
        `粘贴地图区域 ${options.floorId}（${width}x${height}）`,
        "paste-map-info",
      );
    } catch (error) {
      return commandError("paste-map-info", error);
    }
  }

  async replaceLayer(
    floorId: string,
    layer: MapLayer,
    matrix: MapMatrix,
  ): Promise<CommandResult> {
    try {
      const floor = projectData.floor(floorId).value() as Record<string, unknown>;
      const { width, height } = getMatrixSize(floor);
      assertMapMatrixSize(matrix, { width, height });
      return this.patchFloor(
        floorId,
        [["change", `['${layer}']`, matrix]],
        `替换地图图层 ${floorId} / ${layer}`,
        "replace-map-layer",
      );
    } catch (error) {
      return commandError("replace-map-layer", error);
    }
  }

  async clearFloorMap(floorId: string): Promise<CommandResult> {
    try {
      const record = projectData.floor(floorId).value() as unknown as Record<string, unknown>;
      const layers = getMapLayerSettingsSnapshot();
      const { width, height } = getMatrixSize(record);
      const zero = createZeroMatrix(width, height);
      const actions: Action[] = [
        ...layers.map(({ property }): Action => ["change", buildFieldPath([property]), cloneDeep(zero)]),
        ["change", "['firstArrive']", []],
        ["change", "['eachArrive']", []],
        ...MAP_EVENT_FIELDS.map((field): Action => ["change", `['${field}']`, {}]),
      ];
      return this.patchFloor(floorId, actions, `清空楼层地图 ${floorId}`, "clear-floor-map");
    } catch (error) {
      return commandError("clear-floor-map", error);
    }
  }

  async moveLoc(options: MoveLocOptions): Promise<CommandResult> {
    const layer = options.layer ?? "map";
    try {
      const record = projectData.floor(options.floorId).value() as unknown as Record<string, unknown>;
      const value = cloneDeep(readLayerCell(record, layer, options.from));
      const actions: Action[] = [...initializeLayerActions(record, layer),
        ["change", layerPath(layer, options.from), 0],
        ["change", layerPath(layer, options.to), value],
      ];
      if (layer === "map") {
        actions.push(...clearEventActions(options.from));
        writeLocEventActions(actions, options.to, readLocEvents(record, options.from));
      }
      return this.patchFloor(
        options.floorId,
        actions,
        `移动位置 ${options.floorId} (${options.from.x},${options.from.y}) -> (${options.to.x},${options.to.y})`,
        "move-map-loc",
      );
    } catch (error) {
      return commandError("move-map-loc", error);
    }
  }

  async exchangeLoc(options: MoveLocOptions): Promise<CommandResult> {
    const layer = options.layer ?? "map";
    try {
      const record = projectData.floor(options.floorId).value() as unknown as Record<string, unknown>;
      const actions: Action[] = [...initializeLayerActions(record, layer),
        ["change", layerPath(layer, options.from), cloneDeep(readLayerCell(record, layer, options.to))],
        ["change", layerPath(layer, options.to), cloneDeep(readLayerCell(record, layer, options.from))],
      ];
      if (layer === "map") {
        writeLocEventActions(actions, options.from, readLocEvents(record, options.to));
        writeLocEventActions(actions, options.to, readLocEvents(record, options.from));
      }
      return this.patchFloor(
        options.floorId,
        actions,
        `交换位置 ${options.floorId} (${options.from.x},${options.from.y}) <-> (${options.to.x},${options.to.y})`,
        "exchange-map-loc",
      );
    } catch (error) {
      return commandError("exchange-map-loc", error);
    }
  }

  async bindStartPoint(floorId: string, pos: MapPosition): Promise<CommandResult> {
    return executePatchCommand(projectData.tower(), [
      ["change", "['firstData']['floorId']", floorId],
      ["change", "['firstData']['hero']['loc']['x']", pos.x],
      ["change", "['firstData']['hero']['loc']['y']", pos.y],
    ], {
      label: `绑定出生点 ${floorId} (${pos.x},${pos.y})`,
      stage: "bind-start-point",
    });
  }

  async bindStair(floorId: string, pos: MapPosition, blockId: string): Promise<CommandResult> {
    try {
      const changeFloor = changeFloorForStairBlock(blockId);
      if (!changeFloor) throw new Error(`Unsupported stair block: ${blockId}`);
      return this.patchFloor(
        floorId,
        [["change", `['changeFloor']['${locKey(pos)}']`, changeFloor]],
        `绑定楼传 ${floorId} (${pos.x},${pos.y})`,
        "bind-stair",
      );
    } catch (error) {
      return commandError("bind-stair", error);
    }
  }

  async bindSpecialDoor(
    floorId: string,
    doorPos: MapPosition,
    enemyPositions: MapPosition[],
  ): Promise<CommandResult> {
    try {
      if (enemyPositions.length === 0) {
        throw new Error("Special door binding requires at least one enemy");
      }

      const doorKey = locKey(doorPos);
      const doorFlag = `flag:door_${floorId}_${doorKey.replace(",", "_")}`;
      const floor = projectData.floor(floorId).value() as unknown as Record<string, unknown>;
      const afterBattle = floor.afterBattle as Record<string, unknown> | undefined;
      const actions: Action[] = [[
        "change",
        `['autoEvent']['${doorKey}']`,
        {
          "0": {
            condition: `${doorFlag}==${enemyPositions.length}`,
            currentFloor: true,
            priority: 0,
            delayExecute: false,
            multiExecute: false,
            data: [
              { type: "openDoor" },
              { type: "setValue", name: doorFlag, operator: "=", value: "null" },
            ],
          },
        },
      ]];

      for (const enemyPos of enemyPositions) {
        const enemyKey = locKey(enemyPos);
        const events = Array.isArray(afterBattle?.[enemyKey])
            ? cloneDeep(afterBattle[enemyKey]) as unknown[]
            : [];
        events.push({ type: "setValue", name: doorFlag, operator: "+=", value: "1" });
        actions.push(["change", `['afterBattle']['${enemyKey}']`, events]);
      }
      return this.patchFloor(
        floorId,
        actions,
        `绑定机关门 ${floorId} (${doorPos.x},${doorPos.y})`,
        "bind-special-door",
      );
    } catch (error) {
      return commandError("bind-special-door", error);
    }
  }

  resolveChangeFloorTarget(
    floorId: string,
    pos: MapPosition,
    floorIds: string[],
  ): ResolveChangeFloorTargetResult {
    try {
      const floor = projectData.floor(floorId).value() as Record<string, unknown>;
      const changeFloorRecord = floor.changeFloor as Record<string, unknown> | undefined;
      const changeFloor = changeFloorRecord?.[locKey(pos)];
      if (!changeFloor || typeof changeFloor !== "object") {
        throw new Error(`No changeFloor event at ${locKey(pos)}`);
      }

      const changeFloorData = changeFloor as Record<string, unknown>;
      return {
        ok: true,
        target: {
          floorId: resolveRelativeFloorId(floorId, changeFloorData.floorId, floorIds),
          pos: readExplicitTargetPos(changeFloorData),
        },
      };
    } catch (error) {
      return {
        ok: false,
        stage: "resolve-change-floor-target",
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }
}

export const mapCommands = new MapCommands();
