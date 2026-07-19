import { cloneDeep } from "es-toolkit";
import type { DataResource } from "@/project/data/DataResource";
import { projectData } from "@/project/data/projectData";
import type { FloorData } from "@/types";
import type { Action } from "@/utils/action";

export type FloorPoint = [number, number];
export type FloorPointTransform = (point: FloorPoint) => FloorPoint | null;

export interface FloorCoordinateReference {
  /** Stable, user-facing identity for diagnostics and a future relocation UI. */
  id: string;
  owner: string;
  path: string;
  targetFloorId: string;
  point: FloorPoint;
  nextPoint: FloorPoint | null;
  behavior: "move" | "clear" | "crop" | "blocked";
}

export interface FloorCoordinatePatch {
  resource: DataResource<unknown>;
  actions: Action[];
  label: string;
  stage: string;
}

export interface FloorCoordinateTransformPlan {
  targetActions: Action[];
  patches: FloorCoordinatePatch[];
  references: FloorCoordinateReference[];
  blocked: FloorCoordinateReference[];
}

const COORDINATE_RECORD_FIELDS = [
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

const OPTIONAL_POINT_FIELDS = ["upFloor", "downFloor", "flyPoint"] as const;

function readPoint(value: unknown): FloorPoint | undefined {
  if (!Array.isArray(value) || value.length !== 2) return undefined;
  const [x, y] = value;
  return Number.isInteger(x) && Number.isInteger(y) ? [x, y] : undefined;
}

function changedPoint(current: FloorPoint, next: FloorPoint | null): boolean {
  return next === null || current[0] !== next[0] || current[1] !== next[1];
}

function coordinatePathKey(key: string): FloorPoint | undefined {
  const match = /^(-?\d+),(-?\d+)$/.exec(key);
  if (!match) return undefined;
  return [Number(match[1]), Number(match[2])];
}

function shiftCoordinateRecord(
  current: unknown,
  transform: FloorPointTransform,
): { value: Record<string, unknown>; references: FloorCoordinateReference[] } {
  const result: Record<string, unknown> = {};
  const references: FloorCoordinateReference[] = [];
  if (!current || typeof current !== "object" || Array.isArray(current)) {
    return { value: result, references };
  }

  for (const [key, value] of Object.entries(current as Record<string, unknown>)) {
    const point = coordinatePathKey(key);
    // Unknown keys are retained. The coordinate index must not silently discard data
    // merely because an older project contains an unconventional key.
    if (!point) {
      result[key] = value;
      continue;
    }
    const nextPoint = transform(point);
    references.push({
      id: `owned:${key}`,
      owner: "target-floor",
      path: key,
      targetFloorId: "",
      point,
      nextPoint,
      behavior: nextPoint ? "move" : "crop",
    });
    if (nextPoint) result[`${nextPoint[0]},${nextPoint[1]}`] = value;
  }
  return { value: result, references };
}

function resolveStaticFloorTarget(
  sourceFloorId: string,
  target: unknown,
  floorIds: readonly string[],
): string | undefined {
  if (target === ":now") return sourceFloorId;
  if (target === ":next" || target === ":before") {
    const index = floorIds.indexOf(sourceFloorId);
    if (index < 0) return undefined;
    return floorIds[index + (target === ":next" ? 1 : -1)];
  }
  return typeof target === "string" && !target.startsWith(":") ? target : undefined;
}

async function loadIfNeeded<T>(resource: DataResource<T>): Promise<T | undefined> {
  if (resource.snapshot().status !== "loaded") {
    // The reference index is also used in isolated command tests where only one
    // floor exists. Do not trigger a network-backed load for a file that is not
    // present in the current project filesystem.
    if (resource.raw().getContent().status !== "loaded") return undefined;
    try {
      await resource.ensureLoaded();
    } catch {
      return undefined;
    }
  }
  return resource.snapshot().status === "loaded" ? resource.value() : undefined;
}

function inspectChangeFloorRecord(
  record: unknown,
  sourceFloorId: string,
  targetFloorId: string,
  floorIds: readonly string[],
  transform: FloorPointTransform,
): { value: unknown; changed: boolean; references: FloorCoordinateReference[] } {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return { value: record, changed: false, references: [] };
  }
  const value = cloneDeep(record as Record<string, unknown>);
  const references: FloorCoordinateReference[] = [];
  let changed = false;
  for (const [sourceLoc, raw] of Object.entries(value)) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const entry = raw as Record<string, unknown>;
    if (resolveStaticFloorTarget(sourceFloorId, entry.floorId, floorIds) !== targetFloorId) continue;
    const point = readPoint(entry.loc);
    if (!point) continue;
    const nextPoint = transform(point);
    const reference: FloorCoordinateReference = {
      id: `change-floor:${sourceFloorId}:${sourceLoc}`,
      owner: sourceFloorId,
      path: `changeFloor[${sourceLoc}].loc`,
      targetFloorId,
      point,
      nextPoint,
      behavior: nextPoint ? "move" : "blocked",
    };
    references.push(reference);
    if (nextPoint && changedPoint(point, nextPoint)) {
      entry.loc = nextPoint;
      changed = true;
    }
  }
  return { value, changed, references };
}

/**
 * Builds a project-wide coordinate-reference plan for one floor.
 *
 * Resize, move, and future map-transform commands consume this plan without
 * knowing which model fields contain floor coordinates. Add new structured
 * reference providers here, not in individual commands.
 */
export async function buildFloorCoordinateTransformPlan(
  targetFloorId: string,
  transform: FloorPointTransform,
): Promise<FloorCoordinateTransformPlan> {
  const targetResource = projectData.floor(targetFloorId);
  const target = targetResource.value() as FloorData & Record<string, unknown>;
  const towerResource = projectData.tower();
  const tower = await loadIfNeeded(towerResource);
  const floorIds = tower?.main.floorIds ?? [targetFloorId];
  const targetActions: Action[] = [];
  const patches: FloorCoordinatePatch[] = [];
  const references: FloorCoordinateReference[] = [];

  let targetChangeFloor: unknown = target.changeFloor;
  for (const field of COORDINATE_RECORD_FIELDS) {
    const shifted = shiftCoordinateRecord(target[field], transform);
    for (const reference of shifted.references) {
      reference.id = `owned:${targetFloorId}:${field}:${reference.path}`;
      reference.owner = targetFloorId;
      reference.path = `${field}[${reference.path}]`;
      reference.targetFloorId = targetFloorId;
    }
    references.push(...shifted.references);
    if (field === "changeFloor") targetChangeFloor = shifted.value;
    else targetActions.push(["change", `['${field}']`, shifted.value]);
  }

  for (const field of OPTIONAL_POINT_FIELDS) {
    const point = readPoint(target[field]);
    if (!point) continue;
    const nextPoint = transform(point);
    references.push({
      id: `floor-point:${targetFloorId}:${field}`,
      owner: targetFloorId,
      path: field,
      targetFloorId,
      point,
      nextPoint,
      behavior: nextPoint ? "move" : "clear",
    });
    if (changedPoint(point, nextPoint)) {
      targetActions.push(["change", `['${field}']`, nextPoint]);
    }
  }

  for (const sourceFloorId of floorIds) {
    const sourceResource = projectData.floor(sourceFloorId);
    const source = sourceFloorId === targetFloorId
      ? target
      : await loadIfNeeded(sourceResource);
    if (!source) continue;
    const record = sourceFloorId === targetFloorId ? targetChangeFloor : source.changeFloor;
    const inspected = inspectChangeFloorRecord(
      record,
      sourceFloorId,
      targetFloorId,
      floorIds,
      transform,
    );
    references.push(...inspected.references);
    if (sourceFloorId === targetFloorId) {
      targetActions.push(["change", "['changeFloor']", inspected.value]);
    } else if (inspected.changed) {
      patches.push({
        resource: sourceResource as DataResource<unknown>,
        actions: [["change", "['changeFloor']", inspected.value]],
        label: `更新指向 ${targetFloorId} 的坐标`,
        stage: `floor-coordinate-reference:${sourceFloorId}`,
      });
    }
  }

  if (tower?.firstData.floorId === targetFloorId) {
    const hero = tower.firstData.hero as { loc?: unknown } | undefined;
    const loc = hero?.loc;
    if (loc && typeof loc === "object" && !Array.isArray(loc)) {
      const point = readPoint([(loc as Record<string, unknown>).x, (loc as Record<string, unknown>).y]);
      if (point) {
        const nextPoint = transform(point);
        references.push({
          id: "tower:firstData.hero.loc",
          owner: "tower",
          path: "firstData.hero.loc",
          targetFloorId,
          point,
          nextPoint,
          behavior: nextPoint ? "move" : "blocked",
        });
        if (nextPoint && changedPoint(point, nextPoint)) {
          patches.push({
            resource: towerResource as DataResource<unknown>,
            actions: [["change", "['firstData']['hero']['loc']", {
              ...(loc as Record<string, unknown>),
              x: nextPoint[0],
              y: nextPoint[1],
            }]],
            label: `更新 ${targetFloorId} 的初始位置`,
            stage: "floor-coordinate-reference:tower-start",
          });
        }
      }
    }
  }

  return {
    targetActions,
    patches,
    references,
    blocked: references.filter((reference) => reference.behavior === "blocked"),
  };
}
