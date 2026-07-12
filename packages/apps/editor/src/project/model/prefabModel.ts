import { projectData } from "@/project/data/projectData";
import type { CommentObject } from "@/components/Table";
import type { PrefabInfo } from "@/services/prefab";

export type PrefabType = "enemy" | "item" | "mapBlock";

export type PrefabResource =
  | ReturnType<typeof projectData.enemys>
  | ReturnType<typeof projectData.items>
  | ReturnType<typeof projectData.mapBlocks>;

export interface PrefabTarget {
  info: PrefabInfo;
  type: PrefabType;
  displayId: string;
  dataKey: string | null;
  resource: PrefabResource;
  registered: boolean;
}

export function getPrefabType(info: PrefabInfo | null | undefined): PrefabType | null {
  if (!info?.images) return null;
  if (info.images === "enemys" || info.images === "enemy48") return "enemy";
  if (info.images === "items") return "item";
  return "mapBlock";
}

export function getPrefabResourceByType(type: PrefabType): PrefabResource {
  if (type === "enemy") return projectData.enemys();
  if (type === "item") return projectData.items();
  return projectData.mapBlocks();
}

export function getPrefabDataKey(info: PrefabInfo, type: PrefabType): string | null {
  if (type === "enemy" || type === "item") return info.id || null;
  return info.idnum == null ? null : String(info.idnum);
}

export function resolvePrefabTarget(info: PrefabInfo | null | undefined): PrefabTarget | null {
  const type = getPrefabType(info);
  if (!info || !type) return null;
  const dataKey = getPrefabDataKey(info, type);

  return {
    info,
    type,
    displayId: getPrefabDisplayId(info, type),
    dataKey,
    resource: getPrefabResourceByType(type),
    registered: Boolean(info.id && dataKey),
  };
}

export function getPrefabDisplayId(info: PrefabInfo, type: PrefabType = getPrefabType(info) ?? "mapBlock"): string {
  if (type === "enemy" || type === "item") return info.id || "";
  return info.id || (info.idnum == null ? "" : String(info.idnum));
}

export function getPrefabComment(meta: CommentObject, target: PrefabTarget): CommentObject | null {
  const metaData = (meta as { _data?: Record<string, CommentObject | undefined> })._data;
  if (!metaData) return null;
  if (target.type === "enemy") return metaData.enemys || null;
  if (target.type === "item") return metaData.items || null;
  return metaData.maps || null;
}

export function getPrefabItemData(
  data: Record<string, unknown> | null,
  target: PrefabTarget | null,
): Record<string, unknown> | null {
  if (!data || !target?.dataKey) return null;
  const value = data[target.dataKey];
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function canCopyPastePrefab(target: PrefabTarget): boolean {
  return target.type === "enemy" || target.type === "item";
}
