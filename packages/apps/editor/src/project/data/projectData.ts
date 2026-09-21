import { Json2xDataHandler } from '@/fs/Json2xDataHandler';
import { FileHandlerManager } from '@/fs/FileHandlerManager';
import { TowerDataHandler } from '@/services/tower/TowerDataHandler';
import type { TowerData } from '@/services/tower';
import { FloorDataHandler } from '@/services/floor/FloorDataHandler';
import type { FloorData } from '@/types';
import { ItemsDataHandler, type ItemsData } from '@/services/item';
import { EnemysDataHandler, type EnemysData } from '@/services/enemy';
import { MapsBlocksDataHandler, type MapsBlocksData } from '@/services/mapBlock';
import { IconsDataHandler, type IconsData } from '@/services/icons';
import { FunctionsDataHandler, type FunctionsData } from '@/services/functions/FunctionsDataHandler';
import { PluginsDataHandler, type PluginsData } from '@/services/plugins/PluginsDataHandler';
import { TableMetaDataHandler } from '@/services/tableMeta/TableMetaDataHandler';
import { META_FILE_CONFIG, VALID_META_FILE_KEYS, type MetaFileKey } from '@/services/tableMeta/tableMetaService';
import type { CommentObject } from '@/components/Table';
import type { CommonEventData } from '@/services/commonEvent';
import { HandlerDataResource, MappedDataResource, type DataResource } from './DataResource';
import type { Action } from '@/utils/action';

const TOWER_DATA_PATH = 'project/data.js';
const ITEMS_DATA_PATH = 'project/items.js';
const ENEMYS_DATA_PATH = 'project/enemys.js';
const MAPS_BLOCKS_DATA_PATH = 'project/maps.js';
const ICONS_DATA_PATH = 'project/icons.js';
const FUNCTIONS_DATA_PATH = 'project/functions.js';
const PLUGINS_DATA_PATH = 'project/plugins.js';
const EVENTS_DATA_PATH = 'project/events.js';
const EVENTS_VAR_NAME = 'events_c12a15a8_c380_4b28_8144_256cba95f760';

interface EventsData {
  commonEvent: CommonEventData;
  [key: string]: unknown;
}

export interface ProjectDataPreloadFailure {
  id: string;
  path: string;
  error: Error;
}

export interface ProjectDataPreloadReport {
  loaded: string[];
  failures: ProjectDataPreloadFailure[];
}

const PRELOAD_CONCURRENCY = 6;

async function preloadResource<T>(resource: DataResource<T>): Promise<T> {
  const initial = resource.snapshot();
  if (initial.status === 'loaded') return initial.value;
  if (['idle', 'loading'].includes(initial.status)) {
    await FileHandlerManager.load(resource.path);
    await resource.waitForSettled();
  }

  const settled = resource.snapshot();
  if (settled.status === 'loaded') return settled.value;
  if (settled.status === 'error') throw settled.error;
  throw new Error(`Cannot preload ${resource.path}: ${settled.status}`);
}

async function preloadInBatches(
  resources: readonly DataResource<unknown>[],
  load: (resource: DataResource<unknown>) => Promise<void>,
): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(PRELOAD_CONCURRENCY, resources.length) }, async () => {
    while (next < resources.length) {
      const resource = resources[next++];
      await load(resource);
    }
  });
  await Promise.all(workers);
}

function floorPath(floorId: string): string {
  return `project/floors/${floorId}.js`;
}

function prefixActions(prefix: string, actions: Action[]): Action[] {
  return actions.map(([type, path, value]) => [type, `${prefix}${path}`, value]);
}

class ProjectDataImpl {
  private towerResource: DataResource<TowerData> | null = null;
  private itemResource: DataResource<ItemsData> | null = null;
  private enemyResource: DataResource<EnemysData> | null = null;
  private mapBlockResource: DataResource<MapsBlocksData> | null = null;
  private iconsResource: DataResource<IconsData> | null = null;
  private functionsResource: DataResource<FunctionsData> | null = null;
  private pluginsResource: DataResource<PluginsData> | null = null;
  private eventsResource: DataResource<EventsData> | null = null;
  private commonEventsResource: DataResource<CommonEventData> | null = null;
  private readonly floorResources = new Map<string, DataResource<FloorData>>();
  private readonly tableMetaResources = new Map<MetaFileKey, DataResource<CommentObject>>();
  private preloadPromise: Promise<ProjectDataPreloadReport> | null = null;

  tower(): DataResource<TowerData> {
    if (!this.towerResource) {
      this.towerResource = new HandlerDataResource(
        'tower',
        TOWER_DATA_PATH,
        new TowerDataHandler(FileHandlerManager.get(TOWER_DATA_PATH)),
      );
    }
    return this.towerResource;
  }

  floor(floorId: string): DataResource<FloorData> {
    let resource = this.floorResources.get(floorId);
    if (!resource) {
      const path = floorPath(floorId);
      resource = new HandlerDataResource(
        `floor:${floorId}`,
        path,
        new FloorDataHandler(FileHandlerManager.get(path), floorId),
      );
      this.floorResources.set(floorId, resource);
    }
    return resource;
  }

  items(): DataResource<ItemsData> {
    if (!this.itemResource) {
      this.itemResource = new HandlerDataResource(
        'items',
        ITEMS_DATA_PATH,
        new ItemsDataHandler(FileHandlerManager.get(ITEMS_DATA_PATH)),
      );
    }
    return this.itemResource;
  }

  enemys(): DataResource<EnemysData> {
    if (!this.enemyResource) {
      this.enemyResource = new HandlerDataResource(
        'enemys',
        ENEMYS_DATA_PATH,
        new EnemysDataHandler(FileHandlerManager.get(ENEMYS_DATA_PATH)),
      );
    }
    return this.enemyResource;
  }

  mapBlocks(): DataResource<MapsBlocksData> {
    if (!this.mapBlockResource) {
      this.mapBlockResource = new HandlerDataResource(
        'mapBlocks',
        MAPS_BLOCKS_DATA_PATH,
        new MapsBlocksDataHandler(FileHandlerManager.get(MAPS_BLOCKS_DATA_PATH)),
      );
    }
    return this.mapBlockResource;
  }

  icons(): DataResource<IconsData> {
    if (!this.iconsResource) {
      this.iconsResource = new HandlerDataResource(
        'icons',
        ICONS_DATA_PATH,
        new IconsDataHandler(FileHandlerManager.get(ICONS_DATA_PATH)),
      );
    }
    return this.iconsResource;
  }

  functions(): DataResource<FunctionsData> {
    if (!this.functionsResource) {
      this.functionsResource = new HandlerDataResource(
        'functions',
        FUNCTIONS_DATA_PATH,
        new FunctionsDataHandler(FileHandlerManager.get(FUNCTIONS_DATA_PATH)),
      );
    }
    return this.functionsResource;
  }

  plugins(): DataResource<PluginsData> {
    if (!this.pluginsResource) {
      this.pluginsResource = new HandlerDataResource(
        'plugins',
        PLUGINS_DATA_PATH,
        new PluginsDataHandler(FileHandlerManager.get(PLUGINS_DATA_PATH)),
      );
    }
    return this.pluginsResource;
  }

  events(): DataResource<EventsData> {
    if (!this.eventsResource) {
      this.eventsResource = new HandlerDataResource(
        'events',
        EVENTS_DATA_PATH,
        new Json2xDataHandler<EventsData>(FileHandlerManager.get(EVENTS_DATA_PATH), EVENTS_VAR_NAME, 'Events Data'),
      );
    }
    return this.eventsResource;
  }

  commonEvents(): DataResource<CommonEventData> {
    if (!this.commonEventsResource) {
      this.commonEventsResource = new MappedDataResource(
        'commonEvents',
        EVENTS_DATA_PATH,
        this.events(),
        (events) => events.commonEvent,
        (events, commonEvent) => ({ ...events, commonEvent }),
        (actions) => prefixActions("['commonEvent']", actions),
      );
    }
    return this.commonEventsResource;
  }

  tableMetaSource(key: MetaFileKey): DataResource<CommentObject> {
    let resource = this.tableMetaResources.get(key);
    if (!resource) {
      const config = META_FILE_CONFIG[key];
      resource = new HandlerDataResource(
        `tableMeta:${key}`,
        config.filePath,
        new TableMetaDataHandler(FileHandlerManager.get(config.filePath), config.varName, config.resourceName),
      );
      this.tableMetaResources.set(key, resource);
    }
    return resource;
  }

  clearFloorCache(floorId: string): void {
    this.floorResources.delete(floorId);
  }

  preloadAll(): Promise<ProjectDataPreloadReport> {
    if (this.preloadPromise) return this.preloadPromise;

    this.preloadPromise = (async () => {
      const loaded = new Set<string>();
      const failures: ProjectDataPreloadFailure[] = [];
      const load = async (resource: DataResource<unknown>): Promise<void> => {
        try {
          await preloadResource(resource);
          loaded.add(resource.id);
        } catch (error) {
          failures.push({
            id: resource.id,
            path: resource.path,
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      };

      const coreResources = [
        this.items(),
        this.enemys(),
        this.mapBlocks(),
        this.icons(),
        this.functions(),
        this.plugins(),
        this.events(),
      ];
      const tableMetaResources = VALID_META_FILE_KEYS.map((key) => this.tableMetaSource(key));

      const tower = this.tower();
      const towerTrack = (async (): Promise<TowerData | undefined> => {
        try {
          const towerValue = await preloadResource(tower);
          loaded.add(tower.id);
          return towerValue;
        } catch (error) {
          failures.push({
            id: tower.id,
            path: tower.path,
            error: error instanceof Error ? error : new Error(String(error)),
          });
          return undefined;
        }
      })();

      const floorTrack = towerTrack.then(async (towerValue) => {
        if (!towerValue) return;
        const floorIds = Array.isArray(towerValue.main?.floorIds) ? towerValue.main.floorIds : [];
        const floorResources = [...new Set(floorIds)]
          .filter((floorId): floorId is string => typeof floorId === 'string' && floorId.length > 0)
          .map((floorId) => this.floor(floorId));
        await preloadInBatches(floorResources, load);
      });

      await Promise.all([
        preloadInBatches(coreResources, load),
        preloadInBatches(tableMetaResources, load),
        floorTrack,
      ]);

      return { loaded: [...loaded], failures };
    })();

    return this.preloadPromise;
  }

  resetForTests(): void {
    this.towerResource = null;
    this.itemResource = null;
    this.enemyResource = null;
    this.mapBlockResource = null;
    this.iconsResource = null;
    this.functionsResource = null;
    this.pluginsResource = null;
    this.eventsResource = null;
    this.commonEventsResource = null;
    this.floorResources.clear();
    this.tableMetaResources.clear();
    this.preloadPromise = null;
  }
}

export const projectData = new ProjectDataImpl();
