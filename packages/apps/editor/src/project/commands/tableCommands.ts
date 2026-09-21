import type { DataResource } from '@/project/data/DataResource';
import { projectData } from '@/project/data/projectData';
import type { LocPos } from '@/stores/locState';
import { applyActions, type Action } from '@/utils/action';
import { floorCommands } from './floorCommands';
import { locCommands } from './locCommands';
import { prefabCommands } from './prefabCommands';
import type { PrefabInfo } from '@/services/prefab';
import { executePatchCommand } from '@/project/history';
import { produce } from 'immer';
import { commandError, type CommandResult } from './types';

class TableCommands {
  async patchResource<T>(resource: DataResource<T>, actions: Action[]): Promise<CommandResult> {
    return executePatchCommand(resource, actions, {
      label: `修改 ${resource.id}`,
      stage: `patch:${resource.id}`,
    });
  }

  patchFunctions(actions: Action[]): Promise<CommandResult> {
    return this.patchResource(projectData.functions(), actions);
  }

  patchTower(actions: Action[]): Promise<CommandResult> {
    try {
      const tower = projectData.tower();
      const preview = produce(tower.value(), (draft) => {
        applyActions(draft as unknown as Record<string, unknown>, actions);
      });
      const floorIds = preview.main.floorIds;
      const firstFloorId = preview.firstData.floorId;
      const normalizedActions = [...actions];
      if (Array.isArray(floorIds) && firstFloorId && !floorIds.includes(firstFloorId) && floorIds.length > 0) {
        normalizedActions.push(['change', "['firstData']['floorId']", floorIds[0]]);
      }
      return executePatchCommand(tower, normalizedActions, {
        label: '修改全塔属性',
        stage: 'patch-tower',
      });
    } catch (error) {
      return Promise.resolve(commandError('patch-tower', error));
    }
  }

  patchCommonEvents(actions: Action[]): Promise<CommandResult> {
    return this.patchResource(projectData.commonEvents(), actions);
  }

  patchPlugins(actions: Action[]): Promise<CommandResult> {
    return this.patchResource(projectData.plugins(), actions);
  }

  patchFloor(floorId: string, actions: Action[]): Promise<CommandResult> {
    return floorCommands.patch(floorId, actions);
  }

  patchLoc(floorId: string, pos: LocPos, actions: Action[]): Promise<CommandResult> {
    return locCommands.patch(floorId, pos, actions);
  }

  patchPrefab(info: PrefabInfo, actions: Action[]): Promise<CommandResult> {
    return prefabCommands.patch(info, actions);
  }
}

export const tableCommands = new TableCommands();
