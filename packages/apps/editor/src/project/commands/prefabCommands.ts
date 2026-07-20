import { projectData } from "@/project/data/projectData";
import type { PrefabInfo } from "@/services/prefab";
import type { Action } from "@/utils/action";
import { executePatchCommand } from "@/project/history";
import { commandError, commandOk, type CommandResult } from "./types";
import { cloneDeep, isEqual } from "es-toolkit";

export type PrefabType = "enemy" | "item" | "mapBlock";
export type PrefabPasteMode = "replace" | "merge";

export interface PrefabClipboardData {
  kind: "mota-prefab-properties";
  version: 1;
  type: PrefabType;
  source: {
    id: string;
    idnum?: number;
    name?: string;
  };
  data: Record<string, unknown>;
}

export interface PrefabPropertyChange {
  key: string;
  kind: "add" | "change" | "delete";
  before?: unknown;
  after?: unknown;
}

export interface PrefabPastePreview {
  next: Record<string, unknown>;
  changes: PrefabPropertyChange[];
  preservedKeys: string[];
}

const CLIPBOARD_PREFIX = "mota-prefab:";
const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);

const ENEMY_RESET_DEFAULTS: Record<string, unknown> = {
  hp: 0,
  atk: 0,
  def: 0,
  money: 0,
  exp: 0,
  point: 0,
  special: 0,
};

function prefabType(info: PrefabInfo | null | undefined): PrefabType | null {
  if (!info?.images) return null;
  if (info.images === "enemys" || info.images === "enemy48") return "enemy";
  if (info.images === "items") return "item";
  return "mapBlock";
}

function prefixActions(prefix: string, actions: Action[]): Action[] {
  return actions.map(([type, path, value]) => [type, `${prefix}${path}`, value]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertSafeJson(value: unknown, path: string = "data"): void {
  if (value == null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafeJson(item, `${path}[${index}]`));
    return;
  }
  if (!isRecord(value)) throw new Error(`${path} 不是合法 JSON 值`);
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) throw new Error(`${path}.${key} 是不允许的字段`);
    assertSafeJson(child, `${path}.${key}`);
  }
}

function preservedKeys(type: PrefabType): string[] {
  if (type === "enemy") return ["id", "name", "displayIdInBook", "faceIds"];
  if (type === "item") return ["id", "name"];
  return ["id", "idnum", "cls"];
}

function preserveTargetFields(
  next: Record<string, unknown>,
  current: Record<string, unknown>,
  keys: readonly string[],
): void {
  for (const key of keys) {
    delete next[key];
    if (Object.prototype.hasOwnProperty.call(current, key)) next[key] = cloneDeep(current[key]);
  }
}

function buildPasteRecord(
  type: PrefabType,
  current: Record<string, unknown>,
  source: Record<string, unknown>,
  mode: PrefabPasteMode,
): Record<string, unknown> {
  const next = mode === "merge"
    ? { ...cloneDeep(current), ...cloneDeep(source) }
    : cloneDeep(source);
  preserveTargetFields(next, current, preservedKeys(type));
  return next;
}

function propertyChanges(
  current: Record<string, unknown>,
  next: Record<string, unknown>,
): PrefabPropertyChange[] {
  const keys = new Set([...Object.keys(current), ...Object.keys(next)]);
  return [...keys].flatMap((key): PrefabPropertyChange[] => {
    const beforePresent = Object.prototype.hasOwnProperty.call(current, key);
    const afterPresent = Object.prototype.hasOwnProperty.call(next, key);
    const before = current[key];
    const after = next[key];
    if (beforePresent === afterPresent && isEqual(before, after)) return [];
    return [{
      key,
      kind: !beforePresent ? "add" : !afterPresent ? "delete" : "change",
      ...(beforePresent ? { before: cloneDeep(before) } : {}),
      ...(afterPresent ? { after: cloneDeep(after) } : {}),
    }];
  });
}

function resetRecord(type: PrefabType, current: Record<string, unknown>): Record<string, unknown> {
  const next = type === "enemy" ? cloneDeep(ENEMY_RESET_DEFAULTS) : {};
  const resetPreserved = type === "item" ? ["id", "cls", "name"] : preservedKeys(type);
  preserveTargetFields(next, current, resetPreserved);
  return next;
}

export function serializePrefabClipboard(data: PrefabClipboardData): string {
  return `${CLIPBOARD_PREFIX}${JSON.stringify(data)}`;
}

export function parsePrefabClipboard(text: string): PrefabClipboardData {
  const source = text.startsWith(CLIPBOARD_PREFIX) ? text.slice(CLIPBOARD_PREFIX.length) : text;
  const value = JSON.parse(source) as unknown;
  if (!isRecord(value) || value.kind !== "mota-prefab-properties" || value.version !== 1) {
    throw new Error("剪贴板不是受支持的图块属性数据");
  }
  if (value.type !== "enemy" && value.type !== "item" && value.type !== "mapBlock") {
    throw new Error("剪贴板中的图块类型无效");
  }
  if (!isRecord(value.source) || typeof value.source.id !== "string" || !isRecord(value.data)) {
    throw new Error("剪贴板中的图块属性结构无效");
  }
  assertSafeJson(value.data);
  return cloneDeep(value) as unknown as PrefabClipboardData;
}

class PrefabCommands {
  getType(info: PrefabInfo | null | undefined): PrefabType | null {
    return prefabType(info);
  }

  async patch(info: PrefabInfo, actions: Action[]): Promise<CommandResult> {
    try {
      const type = prefabType(info);
      if (type === "enemy") {
        if (!info.id) throw new Error("Enemy prefab is missing id");
        return executePatchCommand(
          projectData.enemys(),
          prefixActions(`['${info.id}']`, actions),
          { label: `修改怪物 ${info.id}`, stage: "patch-prefab" },
        );
      } else if (type === "item") {
        if (!info.id) throw new Error("Item prefab is missing id");
        return executePatchCommand(
          projectData.items(),
          prefixActions(`['${info.id}']`, actions),
          { label: `修改物品 ${info.id}`, stage: "patch-prefab" },
        );
      } else if (type === "mapBlock") {
        if (info.idnum == null) throw new Error("Map block prefab is missing idnum");
        return executePatchCommand(
          projectData.mapBlocks(),
          prefixActions(`['${info.idnum}']`, actions),
          { label: `修改图块 ${info.idnum}`, stage: "patch-prefab" },
        );
      } else {
        throw new Error("Unknown prefab type");
      }
    } catch (error) {
      return commandError("patch-prefab", error);
    }
  }

  getClipboardData(info: PrefabInfo, allData: Record<string, unknown>): CommandResult & { data?: PrefabClipboardData } {
    try {
      const type = prefabType(info);
      if (!type) throw new Error("Unknown prefab type");
      const dataKey = type === "mapBlock" ? String(info.idnum ?? "") : info.id ?? "";
      if (!dataKey) throw new Error("Prefab is missing identity");
      const data = allData[dataKey];
      if (!isRecord(data)) throw new Error("Prefab data is unavailable");
      return {
        ...commandOk(),
        data: {
          kind: "mota-prefab-properties",
          version: 1,
          type,
          source: {
            id: info.id ?? (typeof data.id === "string" ? data.id : dataKey),
            ...(info.idnum == null ? {} : { idnum: info.idnum }),
            ...(typeof data.name === "string" ? { name: data.name } : {}),
          },
          data: cloneDeep(data),
        },
      };
    } catch (error) {
      return commandError("copy-prefab", error);
    }
  }

  previewPaste(
    info: PrefabInfo,
    clipboard: PrefabClipboardData,
    allData: Record<string, unknown>,
    mode: PrefabPasteMode,
  ): PrefabPastePreview {
    const type = prefabType(info);
    if (!type || clipboard.type !== type) {
      throw new Error(`类型不匹配：剪贴板中是 ${clipboard.type}，当前是 ${type ?? "unknown"}`);
    }
    const dataKey = type === "mapBlock" ? String(info.idnum ?? "") : info.id ?? "";
    const current = allData[dataKey];
    if (!dataKey || !isRecord(current)) throw new Error("当前图块属性不存在");
    assertSafeJson(clipboard.data);
    const next = buildPasteRecord(type, current, clipboard.data, mode);
    return { next, changes: propertyChanges(current, next), preservedKeys: preservedKeys(type) };
  }

  async pasteFromClipboard(
    info: PrefabInfo,
    clipboard: PrefabClipboardData,
    allData: Record<string, unknown>,
    mode: PrefabPasteMode,
  ): Promise<CommandResult> {
    try {
      const type = prefabType(info);
      if (!type) throw new Error("Unknown prefab type");
      const dataKey = type === "mapBlock" ? String(info.idnum ?? "") : info.id ?? "";
      if (!dataKey) throw new Error("Prefab is missing identity");
      const { next } = this.previewPaste(info, clipboard, allData, mode);
      return executePatchCommand(
        getPrefabResource(type),
        [["change", `['${dataKey}']`, next]],
        { label: `粘贴${prefabTypeLabel(type)}属性 ${dataKey}`, stage: "paste-prefab" },
      );
    } catch (error) {
      return commandError("paste-prefab", error);
    }
  }

  previewReset(info: PrefabInfo, allData: Record<string, unknown>): PrefabPastePreview {
    const type = prefabType(info);
    if (!type) throw new Error("Unknown prefab type");
    const dataKey = type === "mapBlock" ? String(info.idnum ?? "") : info.id ?? "";
    const current = allData[dataKey];
    if (!dataKey || !isRecord(current)) throw new Error("当前图块属性不存在");
    const next = resetRecord(type, current);
    return {
      next,
      changes: propertyChanges(current, next),
      preservedKeys: type === "item" ? ["id", "cls", "name"] : preservedKeys(type),
    };
  }

  async reset(info: PrefabInfo, allData: Record<string, unknown>): Promise<CommandResult> {
    try {
      const type = prefabType(info);
      if (!type) throw new Error("Unknown prefab type");
      const dataKey = type === "mapBlock" ? String(info.idnum ?? "") : info.id ?? "";
      if (!dataKey) throw new Error("Prefab is missing identity");
      const { next } = this.previewReset(info, allData);
      return executePatchCommand(
        getPrefabResource(type),
        [["change", `['${dataKey}']`, next]],
        { label: `重置${prefabTypeLabel(type)}属性 ${dataKey}`, stage: "reset-prefab" },
      );
    } catch (error) {
      return commandError("clear-prefab", error);
    }
  }

  batchResetIds(info: PrefabInfo, allData: Record<string, unknown>): string[] {
    const type = prefabType(info);
    if (type === "enemy") return Object.keys(allData);
    if (type === "item") return Object.keys(allData).filter((id) => /^I\d+$/.test(id));
    return [];
  }

  async resetAll(info: PrefabInfo, allData: Record<string, unknown>): Promise<CommandResult> {
    try {
      const type = prefabType(info);
      if (type !== "enemy" && type !== "item") throw new Error("Only enemies and items support batch reset");
      const ids = this.batchResetIds(info, allData);
      const actions: Action[] = ids.map((id) => {
        const current = allData[id];
        if (!isRecord(current)) throw new Error(`Prefab ${id} is invalid`);
        return ["change", `['${id}']`, resetRecord(type, current)];
      });
      return executePatchCommand(getPrefabResource(type), actions, {
        label: `批量重置${prefabTypeLabel(type)}属性`,
        stage: "reset-all-prefabs",
      });
    } catch (error) {
      return commandError("clear-all-prefabs", error);
    }
  }
}

function getPrefabResource(type: PrefabType) {
  if (type === "enemy") return projectData.enemys();
  if (type === "item") return projectData.items();
  return projectData.mapBlocks();
}

function prefabTypeLabel(type: PrefabType): string {
  if (type === "enemy") return "怪物";
  if (type === "item") return "道具";
  return "图块";
}

export const prefabCommands = new PrefabCommands();
