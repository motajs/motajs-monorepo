import { projectData } from '@/project/data/projectData';
import { getCurrentFloorId } from '@/stores/editorState';
import type { DataResource } from '@/project/data/DataResource';
import type { RuntimePreviewContext } from './protocol';
import { projectModel, type ModelResource, type BlockRegistry } from '@/project/model/projectModel';

async function loadValue<T>(resource: DataResource<T>): Promise<T> {
  await resource.ensureLoaded();
  return resource.value();
}

async function loadModelValue<T>(resource: ModelResource<T>): Promise<T> {
  await resource.ensureLoaded();
  return resource.value();
}

export async function buildRuntimePreviewContext(): Promise<RuntimePreviewContext> {
  const tower = await loadValue(projectData.tower());
  const floorId = getCurrentFloorId() || tower.firstData.floorId || tower.main.floorIds[0];
  const [floor, maps, icons, items, enemys, registry] = await Promise.all([
    floorId ? loadValue(projectData.floor(floorId)) : undefined,
    loadValue(projectData.mapBlocks()),
    loadValue(projectData.icons()),
    loadValue(projectData.items()),
    loadValue(projectData.enemys()),
    loadModelValue(projectModel.blockRegistry()),
  ]);

  return {
    floorId,
    floor,
    tower: {
      firstData: tower.firstData,
      values: tower.values ?? {},
      flags: tower.flags ?? {},
      nameMap: (tower.main.nameMap ?? {}) as Record<string, string>,
    },
    blockRegistry: {
      maps: maps as Record<string, unknown>,
      icons,
      items: items as Record<string, Record<string, unknown>>,
      enemys: enemys as Record<string, Record<string, unknown>>,
      assets: [...(registry as BlockRegistry).values()]
        .filter((entry) => typeof entry.materialPath === 'string')
        .map((entry) => ({ path: entry.materialPath!, images: entry.images, id: entry.id })),
    },
  };
}
