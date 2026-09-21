import { cloneDeep } from 'es-toolkit';
import { projectData } from '@/project/data/projectData';
import type { DataResource } from '@/project/data/DataResource';
import type { PrefabInfo } from '@/services/prefab';
import type { IconsData } from '@/services/icons';
import type { MapsBlocksData } from '@/services/mapBlock';
import {
  projectAssets,
  type MaterialAssetEntry,
  type MaterialCollectionResource,
  type MaterialMutation,
  type RasterImage,
} from '@/project/assets';
import {
  projectModel,
  resolveMaterialCatalogEntry,
  type MaterialCatalog,
  type ModelResource,
} from '@/project/model/projectModel';
import {
  appendMaterialOperation,
  compositeOperation,
  executeCompositeCommand,
  operationHistory,
  patchResourceOperation,
  removeMaterialOperation,
  replaceMaterialOperation,
  type EditorOperation,
} from '@/project/history';
import type { Action } from '@/utils/action';
import { commandError, commandOk, type CommandResult } from './types';
import { getMapLayerSettingsSnapshot } from '@/project/settings/mapLayerSettings';

export interface MaterialTemplates {
  item?: Record<string, unknown>;
  enemy?: Record<string, unknown>;
}

export interface MaterialRegisterOptions {
  rowCount?: number;
  bindFaceIds?: boolean;
  templates?: MaterialTemplates;
}

export interface MaterialAppendOptions extends MaterialRegisterOptions {
  images: string;
  image: RasterImage;
  name?: string;
  autoRegister?: boolean;
}

export interface MaterialUsage {
  floorId: string;
  layer: string;
  x: number;
  y: number;
  idnum: number;
}

export interface MaterialRemoveOptions {
  force?: boolean;
}

export type MaterialRemoveResult =
  | { ok: true; warnings?: MaterialUsage[] }
  | { ok: false; stage: string; error: Error; usages?: MaterialUsage[]; canForce?: boolean };

export type MaterialAppendResult =
  { ok: true; entry: MaterialAssetEntry; filename?: string } | { ok: false; stage: string; error: Error };

export type AppendAutotileResult = { ok: true; filename: string } | { ok: false; stage: string; error: Error };

async function ensureValue<T>(resource: DataResource<T>): Promise<T> {
  await resource.ensureLoaded();
  return resource.value();
}

async function ensureModel<T>(resource: ModelResource<T>): Promise<T> {
  await resource.ensureLoaded();
  return resource.value();
}

async function ensureCollection(resource: MaterialCollectionResource): Promise<MaterialCollectionResource> {
  await resource.ensureLoaded();
  resource.value();
  return resource;
}

function isEnemyImages(images: string | undefined): boolean {
  return images === 'enemys' || images === 'enemy48';
}

function isItemImages(images: string | undefined): boolean {
  return images === 'items';
}

function idPrefix(images: string): string {
  return images.toUpperCase().charAt(0);
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function nextIdnum(blocks: MapsBlocksData, start: number): number {
  let idnum = start;
  while (blocks[String(idnum)] != null) idnum += 1;
  return idnum;
}

function nextReservedIdnum(reserved: Set<string>, start: number): number {
  let idnum = start;
  while (reserved.has(String(idnum))) idnum += 1;
  reserved.add(String(idnum));
  return idnum;
}

function assertUniqueIdnum(blocks: MapsBlocksData, idnum: number): void {
  if (blocks[String(idnum)] != null) throw new Error('idnum重复了');
}

function assertUniqueId(blocks: MapsBlocksData, id: string, currentIdnum?: number): void {
  for (const [idnum, block] of Object.entries(blocks)) {
    if (Number(idnum) === currentIdnum) continue;
    if (block.id === id) throw new Error('id重复了');
  }
}

function iconRowsForImage(icons: IconsData, images: string): Map<number, string> {
  const rows = new Map<number, string>();
  const iconGroup = icons[images] ?? {};
  for (const [id, row] of Object.entries(iconGroup)) {
    if (typeof row === 'number') rows.set(row, id);
  }
  return rows;
}

async function imageRowCount(images: string): Promise<number> {
  return (await ensureCollection(projectAssets.materialCollection(images))).entries().length;
}

function decodeBase64(base64: string): Uint8Array {
  if (typeof atob === 'function') {
    const binary = atob(base64);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  }
  const nodeBuffer = (globalThis as { Buffer?: { from: (input: string, encoding: string) => Uint8Array } }).Buffer;
  if (!nodeBuffer) throw new Error('Base64 decoding unavailable');
  return new Uint8Array(nodeBuffer.from(base64, 'base64'));
}

function cellIdnum(cell: unknown): number {
  if (typeof cell === 'number') return cell;
  if (cell && typeof cell === 'object') {
    const value = (cell as { idnum?: unknown }).idnum;
    return typeof value === 'number' ? value : Number.NaN;
  }
  return Number(cell);
}

async function findMaterialUsages(idnums: Set<number>): Promise<MaterialUsage[]> {
  if (idnums.size === 0) return [];
  const tower = await ensureValue(projectData.tower());
  const usages: MaterialUsage[] = [];
  const layers = getMapLayerSettingsSnapshot();
  for (const floorId of tower.main.floorIds) {
    const floor = await ensureValue(projectData.floor(floorId));
    for (const { property: layer } of layers) {
      const matrix = floor[layer];
      if (!Array.isArray(matrix)) continue;
      matrix.forEach((row, y) => {
        if (!Array.isArray(row)) return;
        row.forEach((cell, x) => {
          const idnum = cellIdnum(cell);
          if (idnums.has(idnum)) usages.push({ floorId, layer, x, y, idnum });
        });
      });
    }
  }
  return usages;
}

async function readTemplates(options?: MaterialRegisterOptions): Promise<Required<MaterialTemplates>> {
  if (options?.templates) {
    return {
      item: cloneDeep(options.templates.item ?? {}),
      enemy: cloneDeep(options.templates.enemy ?? {}),
    };
  }

  try {
    const meta = await ensureValue(projectData.tableMetaSource('comment'));
    const data = (meta as { _data?: Record<string, unknown> })._data;
    return {
      item: cloneDeep((data?.items_template as Record<string, unknown> | undefined) ?? {}),
      enemy: cloneDeep((data?.enemys_template as Record<string, unknown> | undefined) ?? {}),
    };
  } catch {
    return { item: {}, enemy: {} };
  }
}

async function createRegisterOperations(
  info: PrefabInfo,
  options?: MaterialRegisterOptions,
): Promise<EditorOperation<unknown>[]> {
  const images = info.images;
  if (!images) throw new Error('Missing material images');
  if (images === 'autotile') throw new Error('不能对自动元件进行自动注册！');

  const rowCount = options?.rowCount ?? (await imageRowCount(images));
  const blocks = await ensureValue(projectData.mapBlocks());
  const icons = await ensureValue(projectData.icons());
  const templates = await readTemplates(options);
  const iconRows = iconRowsForImage(icons, images);
  const prefix = idPrefix(images);
  let idnum = 300;
  const iconActions: Action[] = [];
  const mapActions: Action[] = [];
  const itemActions: Action[] = [];
  const enemyActions: Action[] = [];
  const faceIds: Array<{ idnum: number; id: string } | string> = [];
  const reservedIdnums = new Set(Object.keys(blocks));

  for (let y = 0; y < rowCount; y += 1) {
    const existingId = iconRows.get(y);
    if (existingId != null) {
      faceIds.push(existingId);
      continue;
    }

    idnum = nextReservedIdnum(reservedIdnums, idnum);
    const id = `${prefix}${idnum}`;
    iconActions.push(['add', `['${images}']['${id}']`, y]);
    mapActions.push(['add', `['${idnum}']`, { cls: images, id }]);
    faceIds.push({ idnum, id });

    if (isItemImages(images)) {
      itemActions.push(['add', `['${id}']`, cloneDeep(templates.item)]);
    } else if (isEnemyImages(images)) {
      enemyActions.push(['add', `['${id}']`, cloneDeep(templates.enemy)]);
    }
    idnum += 1;
  }

  if (options?.bindFaceIds && faceIds.length >= 4) {
    const lastFour = faceIds.slice(-4);
    if (lastFour.every((item): item is { idnum: number; id: string } => typeof item === 'object')) {
      const [down, left, right, up] = lastFour;
      const faceObj = { down: down.id, left: left.id, right: right.id, up: up.id };
      if (isEnemyImages(images)) {
        for (const one of lastFour) {
          enemyActions.push(['add', `['${one.id}']['faceIds']`, faceObj]);
        }
      } else {
        for (const one of lastFour) {
          mapActions.push(['add', `['${one.idnum}']['faceIds']`, faceObj]);
        }
      }
    }
  }

  if (mapActions.length === 0) throw new Error('没有要注册的项！');

  const operations: EditorOperation<unknown>[] = [];
  if (iconActions.length > 0) {
    operations.push(
      patchResourceOperation(projectData.icons(), iconActions, {
        label: '注册素材',
        stage: 'material-register:icons',
      }),
    );
  }
  operations.push(
    patchResourceOperation(projectData.mapBlocks(), mapActions, {
      label: '注册素材',
      stage: 'material-register:maps',
    }),
  );
  if (itemActions.length > 0) {
    operations.push(
      patchResourceOperation(projectData.items(), itemActions, {
        label: '注册素材',
        stage: 'material-register:items',
      }),
    );
  }
  if (enemyActions.length > 0) {
    operations.push(
      patchResourceOperation(projectData.enemys(), enemyActions, {
        label: '注册素材',
        stage: 'material-register:enemys',
      }),
    );
  }
  return operations;
}

async function createAutotileRegisterOperations(filename: string): Promise<EditorOperation<unknown>[]> {
  const blocks = await ensureValue(projectData.mapBlocks());
  await ensureValue(projectData.icons());
  const idnum = nextIdnum(blocks, 140);
  return [
    patchResourceOperation(projectData.icons(), [['add', `['autotile']['${filename}']`, 0]], {
      label: '注册自动元件',
      stage: 'material-register-autotile:icons',
    }),
    patchResourceOperation(projectData.mapBlocks(), [['add', `['${idnum}']`, { cls: 'autotile', id: filename }]], {
      label: '注册自动元件',
      stage: 'material-register-autotile:maps',
    }),
  ];
}

function commandStage(error: unknown, fallback: string): string {
  return error && typeof error === 'object' && 'commandStage' in error ? String(error.commandStage) : fallback;
}

export class MaterialCommands {
  async changeIdAndIdnum(
    id: string,
    idnum: number | null,
    info: PrefabInfo,
    options?: MaterialRegisterOptions,
  ): Promise<CommandResult> {
    const stage = 'material-change-id';
    try {
      const images = info.images;
      if (!images) throw new Error('Missing material images');
      const blocks = await ensureValue(projectData.mapBlocks());
      await ensureValue(projectData.icons());
      const templates = await readTemplates(options);

      if (!info.id) {
        if (idnum == null || !Number.isInteger(idnum)) throw new Error('不合法的idnum');
        if (typeof info.y !== 'number') throw new Error('Missing material row');
        assertUniqueIdnum(blocks, idnum);
        assertUniqueId(blocks, id);

        const operations: EditorOperation<unknown>[] = [
          patchResourceOperation(projectData.mapBlocks(), [['add', `['${idnum}']`, { cls: images, id }]], {
            label: '注册素材',
            stage: 'material-change-id:maps',
          }),
          patchResourceOperation(projectData.icons(), [['add', `['${images}']['${id}']`, info.y]], {
            label: '注册素材',
            stage: 'material-change-id:icons',
          }),
        ];

        if (isItemImages(images)) {
          operations.push(
            patchResourceOperation(projectData.items(), [['add', `['${id}']`, cloneDeep(templates.item)]], {
              label: '注册素材',
              stage: 'material-change-id:items',
            }),
          );
        } else if (isEnemyImages(images)) {
          operations.push(
            patchResourceOperation(projectData.enemys(), [['add', `['${id}']`, cloneDeep(templates.enemy)]], {
              label: '注册素材',
              stage: 'material-change-id:enemys',
            }),
          );
        }
        return executeCompositeCommand(operations, {
          label: '注册素材',
          stage: 'material-change-id',
        });
      }

      if (typeof info.idnum !== 'number') throw new Error('Missing material idnum');
      assertUniqueId(blocks, id, info.idnum);
      const oldId = info.id;
      const icons = await ensureValue(projectData.icons());
      const items = await ensureValue(projectData.items());
      const enemys = await ensureValue(projectData.enemys());
      const operations: EditorOperation<unknown>[] = [
        patchResourceOperation(projectData.mapBlocks(), [['change', `['${info.idnum}']['id']`, id]], {
          label: '修改素材 id',
          stage: 'material-change-id:maps',
        }),
      ];

      const iconActions: Action[] = [];
      for (const [groupName, group] of Object.entries(icons)) {
        if (!group || typeof group !== 'object' || !Object.prototype.hasOwnProperty.call(group, oldId)) continue;
        const value = (group as Record<string, unknown>)[oldId];
        iconActions.push(['add', `['${groupName}']['${id}']`, cloneDeep(value)]);
        iconActions.push(['delete', `['${groupName}']['${oldId}']`, undefined]);
      }
      if (iconActions.length > 0) {
        operations.push(
          patchResourceOperation(projectData.icons(), iconActions, {
            label: '修改素材 id',
            stage: 'material-change-id:icons',
          }),
        );
      }

      if (Object.prototype.hasOwnProperty.call(items, oldId)) {
        operations.push(
          patchResourceOperation(
            projectData.items(),
            [
              ['add', `['${id}']`, cloneDeep((items as Record<string, unknown>)[oldId])],
              ['delete', `['${oldId}']`, undefined],
            ],
            { label: '修改素材 id', stage: 'material-change-id:items' },
          ),
        );
      }
      if (Object.prototype.hasOwnProperty.call(enemys, oldId)) {
        operations.push(
          patchResourceOperation(
            projectData.enemys(),
            [
              ['add', `['${id}']`, cloneDeep((enemys as Record<string, unknown>)[oldId])],
              ['delete', `['${oldId}']`, undefined],
            ],
            { label: '修改素材 id', stage: 'material-change-id:enemys' },
          ),
        );
      }

      return executeCompositeCommand(operations, {
        label: '修改素材 id',
        stage: 'material-change-id',
      });
    } catch (error) {
      return commandError(commandStage(error, stage), error);
    }
  }

  async register(info: PrefabInfo, options?: MaterialRegisterOptions): Promise<CommandResult> {
    try {
      return executeCompositeCommand(await createRegisterOperations(info, options), {
        label: '注册素材',
        stage: 'material-register',
      });
    } catch (error) {
      return commandError(commandStage(error, 'material-register'), error);
    }
  }

  async registerAutotile(filename: string): Promise<CommandResult> {
    try {
      return executeCompositeCommand(await createAutotileRegisterOperations(filename), {
        label: '注册自动元件',
        stage: 'material-register-autotile',
      });
    } catch (error) {
      return commandError(commandStage(error, 'material-register-autotile'), error);
    }
  }

  async appendMaterialImage(
    images: string,
    pngBase64: string,
    options?: MaterialRegisterOptions & { autoRegister?: boolean },
  ): Promise<CommandResult> {
    let stage = 'material-append-image';
    try {
      stage = 'material-append-image:write';
      const image = projectAssets.image(`project/materials/${images}.png`);
      await image.ensureLoaded();
      image.setBytes(decodeBase64(pngBase64));
      if (options?.autoRegister) {
        const result = await this.register({ images }, options);
        if (!result.ok) return result;
      }
      return commandOk();
    } catch (error) {
      return commandError(stage, error);
    }
  }

  async appendAutotileImage(
    pngBase64: string,
    options?: { filename?: string; autoRegister?: boolean },
  ): Promise<AppendAutotileResult> {
    try {
      const raster = await projectAssets.rasterCodec().decode(decodeBase64(pngBase64));
      const result = await this.append({
        images: 'autotile',
        image: raster,
        name: options?.filename,
        autoRegister: options?.autoRegister !== false,
      });
      if (!result.ok) return result;
      return { ok: true, filename: result.filename! };
    } catch (error) {
      return {
        ok: false,
        stage: 'material-append-autotile',
        error: toError(error),
      };
    }
  }

  async nextAutotileFilename(): Promise<string> {
    const collection = await ensureCollection(projectAssets.materialCollection('autotile'));
    const files = collection
      .entries()
      .flatMap((entry) => (entry.slot.kind === 'file' ? [`${entry.slot.name}.png`] : []));
    for (let i = 1; ; i += 1) {
      const filename = `autotile${i}`;
      if (!files.includes(`${filename}.png`)) return filename;
    }
  }

  async append(options: MaterialAppendOptions): Promise<MaterialAppendResult> {
    let stage = 'material-append:asset';
    try {
      const collection = await ensureCollection(projectAssets.materialCollection(options.images));
      const name = options.images === 'autotile' ? (options.name ?? (await this.nextAutotileFilename())) : options.name;
      const operations: EditorOperation<unknown>[] = [
        appendMaterialOperation(
          collection,
          options.image,
          { name },
          { label: '追加素材', stage: 'material-append:asset' },
        ),
      ];

      if (options.autoRegister !== false) {
        stage = 'material-append:registry';
        operations.push(
          ...(options.images === 'autotile'
            ? await createAutotileRegisterOperations(name!)
            : await createRegisterOperations(
                { images: options.images },
                { ...options, rowCount: collection.entries().length + 1 },
              )),
        );
      }

      const values = await operationHistory.execute(
        compositeOperation(operations, {
          label: options.autoRegister === false ? '追加素材' : '追加并注册素材',
          stage: 'material-append',
        }),
      );
      const mutation = values[0] as MaterialMutation;
      if (!mutation.entry) throw new Error('Material append did not create an entry');

      return {
        ok: true,
        entry: mutation.entry,
        filename: mutation.entry.slot.kind === 'file' ? mutation.entry.slot.name : undefined,
      };
    } catch (error) {
      return { ok: false, stage: commandStage(error, stage), error: toError(error) };
    }
  }

  async replace(info: PrefabInfo, image: RasterImage): Promise<CommandResult> {
    let stage = 'material-replace:resolve';
    try {
      const catalog = await ensureModel(projectModel.materialCatalog());
      const entry = resolveMaterialCatalogEntry(catalog, info);
      if (!entry) throw new Error('Material asset not found');
      stage = 'material-replace:asset';
      const collection = await ensureCollection(projectAssets.materialCollection(entry.images));
      await operationHistory.execute(replaceMaterialOperation(collection, entry, image, { label: '替换素材', stage }));
      return commandOk();
    } catch (error) {
      return commandError(stage, error);
    }
  }

  async remove(info: PrefabInfo, options: MaterialRemoveOptions = {}): Promise<MaterialRemoveResult> {
    let stage = 'material-remove:resolve';
    try {
      const catalog: MaterialCatalog = await ensureModel(projectModel.materialCatalog());
      const entry = resolveMaterialCatalogEntry(catalog, info);
      if (!entry) throw new Error('Material asset not found');
      const aliases = new Set(entry.registrations.map((registration) => registration.id));
      if (entry.images === 'autotile' && entry.id) aliases.add(entry.id);
      const blocks = await ensureValue(projectData.mapBlocks());
      const idnums = new Set(
        entry.registrations.flatMap((registration) => (registration.idnum == null ? [] : [registration.idnum])),
      );
      for (const [idnum, block] of Object.entries(blocks)) {
        if (block.cls === entry.images && block.id && aliases.has(block.id)) idnums.add(Number(idnum));
      }

      stage = 'material-remove:references';
      const usages = await findMaterialUsages(idnums);
      if (usages.length > 0 && !options.force) {
        return {
          ok: false,
          stage,
          error: new Error(`素材仍在 ${usages.length} 个地图位置使用`),
          usages,
          canForce: true,
        };
      }

      const collection = await ensureCollection(projectAssets.materialCollection(entry.images));
      await ensureValue(projectData.icons());
      const operations: EditorOperation<unknown>[] = [
        removeMaterialOperation(collection, entry, {
          label: '删除素材',
          stage: entry.images === 'autotile' ? 'material-remove:autotile-file' : 'material-remove:asset',
        }),
      ];

      const iconActions: Action[] = [];
      const iconGroup = projectData.icons().value()[entry.images];
      const rowCount = collection.entries().length;
      for (const [id, row] of Object.entries(iconGroup ?? {})) {
        if (entry.slot.kind === 'file') {
          if (aliases.has(id) || id === entry.slot.name) {
            iconActions.push(['delete', `['${entry.images}']['${id}']`, undefined]);
          }
          continue;
        }
        if (typeof row !== 'number') continue;
        if (row === entry.slot.row) {
          iconActions.push(['delete', `['${entry.images}']['${id}']`, undefined]);
        } else if (row > entry.slot.row && row < rowCount) {
          iconActions.push(['change', `['${entry.images}']['${id}']`, row - 1]);
        }
      }
      if (iconActions.length > 0) {
        operations.push(
          patchResourceOperation(projectData.icons(), iconActions, {
            label: '删除素材',
            stage: 'material-remove:icons',
          }),
        );
      }

      const mapActions: Action[] = [];
      for (const [idnum, block] of Object.entries(blocks)) {
        if (idnums.has(Number(idnum)) || (block.cls === entry.images && block.id && aliases.has(block.id))) {
          mapActions.push(['delete', `['${idnum}']`, undefined]);
        }
      }
      if (mapActions.length > 0) {
        operations.push(
          patchResourceOperation(projectData.mapBlocks(), mapActions, {
            label: '删除素材',
            stage: 'material-remove:maps',
          }),
        );
      }

      if (isItemImages(entry.images)) {
        const items = await ensureValue(projectData.items());
        const itemActions: Action[] = [...aliases]
          .filter((id) => Object.prototype.hasOwnProperty.call(items, id))
          .map((id) => ['delete', `['${id}']`, undefined]);
        if (itemActions.length > 0) {
          operations.push(
            patchResourceOperation(projectData.items(), itemActions, {
              label: '删除素材',
              stage: 'material-remove:items',
            }),
          );
        }
      }
      if (isEnemyImages(entry.images)) {
        const enemys = await ensureValue(projectData.enemys());
        const enemyActions: Action[] = [...aliases]
          .filter((id) => Object.prototype.hasOwnProperty.call(enemys, id))
          .map((id) => ['delete', `['${id}']`, undefined]);
        if (enemyActions.length > 0) {
          operations.push(
            patchResourceOperation(projectData.enemys(), enemyActions, {
              label: '删除素材',
              stage: 'material-remove:enemys',
            }),
          );
        }
      }

      stage = 'material-remove';
      await operationHistory.execute(
        compositeOperation(operations, {
          label: '删除素材',
          stage,
        }),
      );
      return { ok: true, warnings: usages.length > 0 ? usages : undefined };
    } catch (error) {
      const commandStage = (error as { commandStage?: string }).commandStage;
      return { ok: false, stage: commandStage ?? stage, error: toError(error) };
    }
  }
}

export const materialCommands = new MaterialCommands();
