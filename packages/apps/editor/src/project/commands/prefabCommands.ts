import { projectData } from "@/project/data/projectData";
import type { PrefabInfo } from "@/services/prefab";
import type { Action } from "@/utils/action";
import { executePatchCommand } from "@/project/history";
import { commandError, commandOk, type CommandResult } from "./types";

export type PrefabType = "enemy" | "item" | "mapBlock";
export interface PrefabClipboardData {
  type: Exclude<PrefabType, "mapBlock">;
  data: unknown;
}

export interface ClearPrefabTemplates {
  enemy?: Record<string, unknown>;
}

function prefabType(info: PrefabInfo | null | undefined): PrefabType | null {
  if (!info?.images) return null;
  if (info.images === "enemys" || info.images === "enemy48") return "enemy";
  if (info.images === "items") return "item";
  return "mapBlock";
}

function prefixActions(prefix: string, actions: Action[]): Action[] {
  return actions.map(([type, path, value]) => [type, `${prefix}${path}`, value]);
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
      if (type !== "enemy" && type !== "item") {
        throw new Error("Only enemy and item prefabs can be copied");
      }
      if (!info.id) throw new Error("Prefab is missing id");
      return {
        ...commandOk(),
        data: {
          type,
          data: allData[info.id] ?? null,
        },
      };
    } catch (error) {
      return commandError("copy-prefab", error);
    }
  }

  async replaceFromClipboard(
    info: PrefabInfo,
    clipboard: PrefabClipboardData,
    allData: Record<string, unknown>,
  ): Promise<CommandResult> {
    try {
      const type = prefabType(info);
      if (type !== "enemy" && type !== "item") {
        throw new Error("Only enemy and item prefabs can be pasted");
      }
      if (clipboard.type !== type) {
        throw new Error(`Clipboard prefab type mismatch: expected ${type}, got ${clipboard.type}`);
      }
      if (!info.id) throw new Error("Prefab is missing id");
      const current = (allData[info.id] ?? {}) as Record<string, unknown>;
      const next = {
        ...(cloneRecord(clipboard.data)),
        id: info.id,
        name: current.name,
        ...(type === "enemy" ? { displayIdInBook: current.displayIdInBook } : {}),
      };
      return executePatchCommand(
        type === "enemy" ? projectData.enemys() : projectData.items(),
        [["change", `['${info.id}']`, next]],
        { label: `粘贴${type === "enemy" ? "怪物" : "物品"}属性 ${info.id}`, stage: "paste-prefab" },
      );
    } catch (error) {
      return commandError("paste-prefab", error);
    }
  }

  async clear(info: PrefabInfo, templates: ClearPrefabTemplates, allData: Record<string, unknown>): Promise<CommandResult> {
    try {
      const type = prefabType(info);
      if (type !== "enemy" && type !== "item") {
        throw new Error("Only enemy and item prefabs can be cleared");
      }
      if (!info.id) throw new Error("Prefab is missing id");
      const current = (allData[info.id] ?? {}) as Record<string, unknown>;
      const next = type === "enemy"
        ? {
            ...(templates.enemy ?? {}),
            id: info.id,
            name: current.name,
            displayIdInBook: current.displayIdInBook,
          }
        : {
            id: current.id,
            cls: current.cls,
            name: current.name,
          };
      return executePatchCommand(
        type === "enemy" ? projectData.enemys() : projectData.items(),
        [["change", `['${info.id}']`, next]],
        { label: `清空${type === "enemy" ? "怪物" : "物品"}属性 ${info.id}`, stage: "clear-prefab" },
      );
    } catch (error) {
      return commandError("clear-prefab", error);
    }
  }

  async clearAll(info: PrefabInfo, templates: ClearPrefabTemplates, allData: Record<string, unknown>): Promise<CommandResult> {
    try {
      const type = prefabType(info);
      if (type === "enemy") {
        const actions: Action[] = Object.keys(allData).map((id) => {
          const current = (allData[id] ?? {}) as Record<string, unknown>;
          return ["change", `['${id}']`, {
            ...(templates.enemy ?? {}),
            id,
            name: current.name,
            displayIdInBook: current.displayIdInBook,
          }];
        });
        return executePatchCommand(projectData.enemys(), actions, {
          label: "批量清空怪物属性",
          stage: "clear-all-prefabs",
        });
      } else if (type === "item") {
        const actions: Action[] = Object.keys(allData)
          .filter((id) => /^I\d+$/.test(id))
          .map((id) => {
            const current = (allData[id] ?? {}) as Record<string, unknown>;
            return ["change", `['${id}']`, {
              id: current.id,
              cls: current.cls,
              name: current.name,
            }];
          });
        return executePatchCommand(projectData.items(), actions, {
          label: "批量清空物品属性",
          stage: "clear-all-prefabs",
        });
      } else {
        throw new Error("Only enemy and item prefabs can be cleared");
      }
    } catch (error) {
      return commandError("clear-all-prefabs", error);
    }
  }
}

function cloneRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return { ...(value as Record<string, unknown>) };
}

export const prefabCommands = new PrefabCommands();
