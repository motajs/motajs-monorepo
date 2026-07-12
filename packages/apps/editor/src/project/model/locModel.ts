import type { LocPos, LocSelection } from "@/stores/locState";
import type { FloorData } from "@/types";

/**
 * 楼层文件中按 x,y 坐标索引的位置事件字段。
 */
export const LOC_FIELDS = [
  "events",
  "autoEvent",
  "changeFloor",
  "beforeBattle",
  "afterBattle",
  "afterGetItem",
  "afterOpenDoor",
  "cannotMove",
] as const;

export type LocField = (typeof LOC_FIELDS)[number];

export type LocData = {
  [K in LocField]: unknown;
};

export interface LocTarget {
  floorId: string;
  pos: LocPos;
  key: string;
}

export interface LocSummary {
  activeFields: LocField[];
  autoEventPageIds: string[];
}

export function locKey(pos: LocPos): string {
  return `${pos.x},${pos.y}`;
}

export function resolveLocTarget(
  selection: LocSelection | null,
  fallbackFloorId?: string,
): LocTarget | null {
  if (!selection) return null;
  const floorId = selection.floorId ?? fallbackFloorId;
  if (!floorId) return null;
  return {
    floorId,
    pos: selection.pos,
    key: locKey(selection.pos),
  };
}

export function getLocDataFromFloor(floorData: FloorData, pos: LocPos): LocData {
  const key = locKey(pos);
  const locData = {} as LocData;

  for (const field of LOC_FIELDS) {
    const fieldData = floorData[field];
    locData[field] =
      fieldData && typeof fieldData === "object" && key in fieldData
        ? (fieldData as Record<string, unknown>)[key]
        : null;
  }

  return locData;
}

export function isLocValuePresent(value: unknown): boolean {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

export function getAutoEventPageIds(locData: Pick<LocData, "autoEvent">): string[] {
  const autoEvent = locData.autoEvent;
  if (!autoEvent || typeof autoEvent !== "object" || Array.isArray(autoEvent)) return [];
  return Object.keys(autoEvent).sort((a, b) => Number(a) - Number(b));
}

export function summarizeLocData(locData: LocData): LocSummary {
  return {
    activeFields: LOC_FIELDS.filter((field) => isLocValuePresent(locData[field])),
    autoEventPageIds: getAutoEventPageIds(locData),
  };
}
