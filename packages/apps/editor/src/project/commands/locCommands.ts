import type { LocPos } from "@/stores/locState";
import type { Action } from "@/utils/action";
import { projectData } from "@/project/data/projectData";
import { floorCommands } from "./floorCommands";
import { commandError, commandOk, type CommandResult } from "./types";

function locKey(pos: LocPos): string {
  return `${pos.x},${pos.y}`;
}

function toFloorActions(pos: LocPos, actions: Action[]): Action[] {
  const key = locKey(pos);
  return actions.map(([type, path, value]) => {
    if (/\['autoEvent'\]\['\d+'\]$/.test(path)) {
      return [
        type,
        path.replace(/\['\d+'\]$/, (page) => `['${key}']${page}`),
        value,
      ];
    }
    return [type, `${path}['${key}']`, value];
  });
}

class LocCommands {
  async patch(floorId: string, pos: LocPos, actions: Action[]): Promise<CommandResult> {
    return floorCommands.patch(floorId, toFloorActions(pos, actions), {
      label: `修改位置 ${floorId} (${pos.x},${pos.y})`,
      stage: "patch-loc",
    });
  }

  async addAutoEventPage(floorId: string, pos: LocPos): Promise<CommandResult & { pageId?: string }> {
    try {
      const floor = projectData.floor(floorId).value();
      const key = locKey(pos);
      const pages = (floor.autoEvent as Record<string, Record<string, unknown>> | undefined)?.[key] ?? {};
      let pageId = 2;
      while (Object.prototype.hasOwnProperty.call(pages, String(pageId))) pageId += 1;
      const result = await floorCommands.patch(floorId, [[
        "add",
        `['autoEvent']['${key}']['${pageId}']`,
        null,
      ]], {
        label: `添加自动事件页 ${floorId} (${pos.x},${pos.y})`,
        stage: "add-auto-event-page",
      });
      return result.ok ? { ...commandOk(), pageId: String(pageId) } : result;
    } catch (error) {
      return commandError("add-auto-event-page", error);
    }
  }
}

export const locCommands = new LocCommands();
