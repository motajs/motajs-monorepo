import type { Content } from "@/fs/types";
import { ContentUtils } from "@/fs/ContentUtils";
import { projectData } from "@/project/data/projectData";
import {
  aggregateResource,
  computedResource,
  optional,
  type LoadableResource,
} from "@/project/resources";
import type { BlockInfo, MapsBlocksData } from "@/services/mapBlock";
import type { EnemysData } from "@/services/enemy";
import type { ItemsData } from "@/services/item";
import type { IconsData } from "@/services/icons";
import type { MetaFileKey } from "@/services/tableMeta";
import {
  MATERIAL_SHEET_IMAGES,
  projectAssets,
  type MaterialAssetEntry,
  type MaterialCollectionSnapshot,
} from "@/project/assets";
import type { PrefabInfo } from "@/services/prefab";
import {
  buildTilesetCatalog,
  type TilesetCatalog,
} from "./tilesetCatalog";
import { buildFloorPassability, type FloorPassability } from "./passability";
import {
  buildBlocklyCompletionCatalog,
  buildFlagUsageIndex,
  type BlocklyCompletionCatalog,
  type FlagUsageIndex,
} from "./blocklyModels";
import { isStatusBarIconId } from "./statusBarModel";
import { diagnoseBlocklyEvents, type BlocklyDiagnostic } from "@/blockly/diagnostics/asyncDiagnostics";
import {
  createEnemySpecialResource,
  createProjectImageResource,
  createTableSchemaResource,
  type EnemySpecialCatalog,
  type ProjectImageCatalog,
  type TableSchemaBundle,
} from "./tableModels";

export * from "./tilesetCatalog";
export * from "./passability";
export type {
  BlocklyCompletionCatalog,
  BlocklyCompletionItem,
  FlagUsage,
  FlagUsageIndex,
} from "./blocklyModels";
export type {
  EnemySpecialCatalog,
  EnemySpecialDefinition,
  ProjectImageCatalog,
  ProjectImageEntry,
  TableSchemaBundle,
} from "./tableModels";

export interface ProjectDiagnostic {
  source: string;
  severity: "error" | "warning" | "info";
  message: string;
}

export interface FloorListItem {
  id: string;
  exists: boolean;
  title?: string;
  name?: string;
}

export interface RegistryBlockInfo extends BlockInfo {
  idnum: number;
  kind: "terrain" | "item" | "enemy" | "mapBlock" | "autotile" | "tileset";
  images?: string;
  x?: number;
  y?: number;
  isTile?: boolean;
  materialPath?: string;
  editorDisplay?: BlockInfo["editorDisplay"];
}

export type BlockRegistry = Map<number, RegistryBlockInfo>;

export interface RegistrySpriteInfo {
  key: string;
  id: string;
  images: string;
  path: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isTile?: boolean;
  idnum?: number;
}

export type SpriteRegistry = Map<string, RegistrySpriteInfo>;

export interface MaterialCatalogRegistration {
  id: string;
  idnum?: number;
}

export interface MaterialCatalogEntry extends MaterialAssetEntry {
  id?: string;
  idnum?: number;
  registered: boolean;
  registrations: MaterialCatalogRegistration[];
}

export interface MaterialCatalog {
  entries: MaterialCatalogEntry[];
  byImages: Map<string, MaterialCatalogEntry[]>;
  diagnostics: ProjectDiagnostic[];
}

export type ModelResource<T> = LoadableResource<T>;

function spriteKey(images: string, id: string): string {
  return `${images}:${id}`;
}

function materialPath(images: string, id: string): string {
  if (images === "autotile") return `project/autotiles/${id}.png`;
  return `project/materials/${images}.png`;
}

function spriteHeight(images: string): number {
  return images.endsWith("48") ? 48 : 32;
}

function blockKind(cls: string | undefined): RegistryBlockInfo["kind"] {
  if (cls === "items") return "item";
  if (cls === "enemys" || cls === "enemy48") return "enemy";
  if (cls === "terrains" || cls === "animates" || cls === "npcs" || cls === "npc48") return "terrain";
  if (cls === "autotile") return "autotile";
  if (cls === "tileset") return "tileset";
  return "mapBlock";
}

function readIconY(icons: IconsData, images: string | undefined, id: string | undefined): number | undefined {
  if (!images || !id) return undefined;
  const value = icons[images]?.[id];
  return typeof value === "number" ? value : undefined;
}

function buildSpriteRegistry(icons: IconsData): SpriteRegistry {
  const registry: SpriteRegistry = new Map();

  for (const [images, values] of Object.entries(icons)) {
    for (const [id, index] of Object.entries(values)) {
      if (typeof index !== "number") continue;
      registry.set(spriteKey(images, id), {
        key: spriteKey(images, id),
        id,
        images,
        path: materialPath(images, id),
        x: 0,
        y: index,
        width: 32,
        height: spriteHeight(images),
      });
    }
  }

  return registry;
}

function mergeSpriteMetadata(
  sprite: RegistrySpriteInfo | undefined,
  idnum: number,
): Partial<RegistryBlockInfo> {
  if (!sprite) return {};
  return {
    images: sprite.images,
    x: sprite.x,
    y: sprite.y,
    isTile: sprite.isTile,
    materialPath: sprite.path,
    idnum,
  };
}

function mergeEditorDisplayMetadata(
  display: BlockInfo["editorDisplay"],
  idnum: number,
): Partial<RegistryBlockInfo> {
  if (display?.type !== "image" || !display.path) return {};
  return {
    materialPath: display.path,
    x: display.x ?? 0,
    y: display.y ?? 0,
    width: display.width ?? 32,
    height: display.height ?? 32,
    idnum,
  };
}

function addMapBlocks(
  registry: BlockRegistry,
  spriteRegistry: SpriteRegistry,
  blocks: MapsBlocksData,
  icons: IconsData,
  items: ItemsData,
  enemys: EnemysData,
): void {
  for (const [idnum, info] of Object.entries(blocks)) {
    const numericId = Number(idnum);
    if (!Number.isFinite(numericId)) continue;
    const images = info.cls;
    const id = info.id;
    const y = readIconY(icons, images, id);
    const sprite = images && id
      ? spriteRegistry.get(spriteKey(images === "autotile" ? "autotile" : images, id))
      : undefined;
    const itemInfo = id && images === "items" ? items[id] : undefined;
    const enemyInfo = id && (images === "enemys" || images === "enemy48") ? enemys[id] : undefined;
    registry.set(numericId, {
      ...itemInfo,
      ...enemyInfo,
      ...info,
      ...mergeSpriteMetadata(sprite, numericId),
      idnum: numericId,
      images,
      y,
      kind: blockKind(info.cls),
      ...mergeEditorDisplayMetadata(info.editorDisplay, numericId),
    });
  }
}

function addItems(registry: BlockRegistry, items: ItemsData): void {
  for (const [id, item] of Object.entries(items)) {
    const idnum = Number(item.idnum);
    if (!Number.isFinite(idnum)) continue;
    registry.set(idnum, {
      id,
      idnum,
      images: "items",
      cls: item.cls,
      name: item.name,
      kind: "item",
    });
  }
}

function addEnemies(registry: BlockRegistry, enemys: EnemysData): void {
  for (const [id, enemy] of Object.entries(enemys)) {
    const idnum = Number(enemy.idnum);
    if (!Number.isFinite(idnum)) continue;
    registry.set(idnum, {
      id,
      idnum,
      images: "enemys",
      name: enemy.name,
      kind: "enemy",
    });
  }
}

function buildBlockRegistry(
  blocks: MapsBlocksData,
  items: ItemsData,
  enemys: EnemysData,
  icons: IconsData,
): BlockRegistry {
  const registry: BlockRegistry = new Map();
  const spriteRegistry = buildSpriteRegistry(icons);
  addMapBlocks(registry, spriteRegistry, blocks, icons, items, enemys);
  addItems(registry, items);
  addEnemies(registry, enemys);
  const ground = spriteRegistry.get(spriteKey("terrains", "ground"));
  registry.set(0, {
    idnum: 0,
    id: "empty",
    images: ground?.images ?? "terrains",
    y: ground?.y,
    materialPath: ground?.path,
    kind: "terrain",
  });
  return registry;
}

function buildMaterialCatalog(
  collections: MaterialCollectionSnapshot[],
  icons: IconsData,
  blocks: MapsBlocksData,
  assetDiagnostics: ProjectDiagnostic[],
): MaterialCatalog {
  const diagnostics = [...assetDiagnostics];
  const entries: MaterialCatalogEntry[] = [];
  const mapBlocksById = new Map<string, number[]>();
  for (const [idnum, block] of Object.entries(blocks)) {
    if (!block.id) continue;
    const key = `${block.cls}:${block.id}`;
    const values = mapBlocksById.get(key) ?? [];
    values.push(Number(idnum));
    mapBlocksById.set(key, values);
  }

  for (const collection of collections) {
    const iconGroup = icons[collection.images] ?? {};
    const physicalRows = new Set<number>();
    for (const asset of collection.entries) {
      const sheetRow = asset.slot.kind === "sheet-row" ? asset.slot.row : undefined;
      const aliases = asset.slot.kind === "file"
        ? [asset.slot.name].filter((id) => Object.prototype.hasOwnProperty.call(iconGroup, id))
        : Object.entries(iconGroup)
          .filter(([, row]) => row === sheetRow)
          .map(([id]) => id);
      if (asset.slot.kind === "sheet-row") physicalRows.add(asset.slot.row);

      const registrations = aliases.flatMap((id): MaterialCatalogRegistration[] => {
        const idnums = mapBlocksById.get(`${collection.images}:${id}`) ?? [];
        if (idnums.length === 0) return [{ id }];
        return idnums.map((idnum) => ({ id, idnum }));
      });
      const first = registrations[0];
      entries.push({
        ...asset,
        id: first?.id ?? (asset.slot.kind === "file" ? asset.slot.name : undefined),
        idnum: first?.idnum,
        registered: registrations.length > 0,
        registrations,
      });

      if (registrations.length === 0) {
        diagnostics.push({
          source: `material:${asset.key}`,
          severity: "info",
          message: `${asset.key} is not registered`,
        });
      }
      if (aliases.length > 1) {
        diagnostics.push({
          source: `material:${asset.key}`,
          severity: "warning",
          message: `${asset.key} has multiple icon aliases: ${aliases.join(", ")}`,
        });
      }
      for (const registration of registrations) {
        if (registration.idnum == null) {
          diagnostics.push({
            source: `material:${collection.images}:${registration.id}`,
            severity: "warning",
            message: `${registration.id} has an icon entry but no map block`,
          });
        }
      }
    }

    for (const [id, row] of Object.entries(iconGroup)) {
      const exists = collection.images === "autotile"
        ? collection.entries.some((entry) => entry.slot.kind === "file" && entry.slot.name === id)
        : typeof row === "number" && physicalRows.has(row);
      if (!exists) {
        diagnostics.push({
          source: `material:${collection.images}:${id}`,
          severity: "warning",
          message: `${collection.images}:${id} points to a missing material asset`,
        });
      }
    }
  }

  const byImages = new Map<string, MaterialCatalogEntry[]>();
  for (const entry of entries) {
    const group = byImages.get(entry.images) ?? [];
    group.push(entry);
    byImages.set(entry.images, group);
  }
  return { entries, byImages, diagnostics };
}

function materialCatalogContent(): Content<MaterialCatalog> {
  const iconsContent = projectData.icons().content();
  const blocksContent = projectData.mapBlocks().content();
  if (iconsContent.status === "error") return iconsContent as Content<MaterialCatalog>;
  if (blocksContent.status === "error") return blocksContent as Content<MaterialCatalog>;
  if (iconsContent.status === "idle" || blocksContent.status === "idle") return { status: "idle" };
  if (iconsContent.status === "loading" || blocksContent.status === "loading") return { status: "loading" };
  if (iconsContent.status === "not-found" || blocksContent.status === "not-found") return { status: "not-found" };

  const collections: MaterialCollectionSnapshot[] = [];
  const diagnostics: ProjectDiagnostic[] = [];
  for (const images of [...MATERIAL_SHEET_IMAGES, "autotile"] as const) {
    const resource = projectAssets.materialCollection(images);
    const content = resource.content();
    if (content.status === "idle") return { status: "idle" };
    if (content.status === "loading") return { status: "loading" };
    if (content.status === "loaded") collections.push(content.value);
    else {
      diagnostics.push({
        source: resource.id,
        severity: content.status === "error" ? "error" : "warning",
        message: content.status === "error" ? content.error.message : `${images} material asset not found`,
      });
    }
  }
  return {
    status: "loaded",
    value: buildMaterialCatalog(collections, iconsContent.value, blocksContent.value, diagnostics),
  };
}

export function resolveMaterialCatalogEntry(
  catalog: MaterialCatalog,
  info: PrefabInfo,
): MaterialCatalogEntry | undefined {
  if (!info.images) return undefined;
  const group = catalog.byImages.get(info.images) ?? [];
  if (info.images === "autotile" && info.id) {
    return group.find((entry) => entry.slot.kind === "file" && entry.slot.name === info.id);
  }
  if (info.idnum != null) {
    const byIdnum = group.find((entry) => entry.registrations.some((registration) => registration.idnum === info.idnum));
    if (byIdnum) return byIdnum;
  }
  if (info.id) {
    const byId = group.find((entry) => entry.registrations.some((registration) => registration.id === info.id));
    if (byId) return byId;
  }
  if (typeof info.y === "number") {
    return group.find((entry) => entry.slot.kind === "sheet-row" && entry.slot.row === info.y);
  }
  return undefined;
}

class ProjectModelImpl {
  private floorListResource: ModelResource<FloorListItem[]> | null = null;
  private blockRegistryResource: ModelResource<BlockRegistry> | null = null;
  private spriteRegistryResource: ModelResource<SpriteRegistry> | null = null;
  private materialCatalogResource: ModelResource<MaterialCatalog> | null = null;
  private tilesetCatalogResource: ModelResource<TilesetCatalog> | null = null;
  private readonly floorPassabilityResources = new Map<string, ModelResource<FloorPassability>>();
  private blocklyCompletionsResource: ModelResource<BlocklyCompletionCatalog> | null = null;
  private flagUsageResource: ModelResource<FlagUsageIndex> | null = null;
  private enemySpecialResource: ModelResource<EnemySpecialCatalog> | null = null;
  private projectImageResource: ModelResource<ProjectImageCatalog> | null = null;
  private readonly tableSchemaResources = new Map<MetaFileKey, ModelResource<TableSchemaBundle>>();

  hasStatusBarIcon(id: string): boolean {
    return isStatusBarIconId(id);
  }

  floorList(): ModelResource<FloorListItem[]> {
    return this.floorListResource ??= computedResource(
      "floorList",
      [projectData.tower()],
      () =>
        ContentUtils.map(projectData.tower().content(), (tower) =>
          tower.main.floorIds.map((id) => {
            const content = projectData.floor(id).content();
            const floor = content.status === "loaded" ? content.value : undefined;
            return {
              id,
              exists: content.status === "loaded",
              title: typeof floor?.title === "string" ? floor.title : undefined,
              name: typeof floor?.name === "string" ? floor.name : undefined,
            };
          }),
        ),
    );
  }

  blockRegistry(): ModelResource<BlockRegistry> {
    return this.blockRegistryResource ??= aggregateResource(
      "blockRegistry",
      [
        optional(projectData.mapBlocks(), {}),
        optional(projectData.items(), {}),
        optional(projectData.enemys(), {}),
        optional(projectData.icons(), {}),
      ] as const,
      buildBlockRegistry,
    );
  }

  spriteRegistry(): ModelResource<SpriteRegistry> {
    return this.spriteRegistryResource ??= aggregateResource(
      "spriteRegistry",
      [projectData.icons()] as const,
      buildSpriteRegistry,
    );
  }

  materialRegistry(): ModelResource<BlockRegistry> {
    return this.blockRegistry();
  }

  materialCatalog(): ModelResource<MaterialCatalog> {
    const dependencies = [
      projectData.icons(),
      projectData.mapBlocks(),
      ...[...MATERIAL_SHEET_IMAGES, "autotile"].map((images) =>
        projectAssets.materialCollection(images)),
    ];
    return this.materialCatalogResource ??= computedResource(
      "materialCatalog",
      dependencies,
      materialCatalogContent,
    );
  }

  tilesetCatalog(): ModelResource<TilesetCatalog> {
    const dependencies = () => {
      const tower = projectData.tower();
      const towerContent = tower.content();
      if (towerContent.status !== "loaded") return [tower];
      const names = Array.isArray(towerContent.value.main.tilesets)
        ? towerContent.value.main.tilesets.filter((name): name is string => typeof name === "string")
        : [];
      return [tower, ...names.map((name) => projectAssets.image(`project/tilesets/${name}`))];
    };
    return this.tilesetCatalogResource ??= computedResource(
      "tilesetCatalog",
      dependencies,
      () => {
        const towerContent = projectData.tower().content();
        if (towerContent.status !== "loaded") return towerContent as Content<TilesetCatalog>;
        const names = Array.isArray(towerContent.value.main.tilesets)
          ? towerContent.value.main.tilesets.filter((name): name is string => typeof name === "string")
          : [];
        const contents = new Map(names.map((name) => {
          const path = `project/tilesets/${name}`;
          return [path, projectAssets.image(path).content()] as const;
        }));
        return buildTilesetCatalog(names, contents);
      },
    );
  }

  floorPassability(floorId: string): ModelResource<FloorPassability> {
    const blockRegistry = this.blockRegistry();
    let resource = this.floorPassabilityResources.get(floorId);
    if (resource) return resource;
    resource = computedResource(
      `floorPassability:${floorId}`,
      [projectData.floor(floorId), blockRegistry],
      () => {
        const floorContent = projectData.floor(floorId).content();
        const registryContent = blockRegistry.content();
        if (floorContent.status !== "loaded") return floorContent as Content<FloorPassability>;
        if (registryContent.status !== "loaded") return registryContent as Content<FloorPassability>;
        return {
          status: "loaded",
          value: buildFloorPassability(
            floorContent.value as unknown as Record<string, unknown>,
            registryContent.value,
          ),
        };
      },
    );
    this.floorPassabilityResources.set(floorId, resource);
    return resource;
  }

  enemySpecialCatalog(): ModelResource<EnemySpecialCatalog> {
    return this.enemySpecialResource ??= createEnemySpecialResource();
  }

  projectImageCatalog(): ModelResource<ProjectImageCatalog> {
    return this.projectImageResource ??= createProjectImageResource();
  }

  tableSchema(key: MetaFileKey): ModelResource<TableSchemaBundle> {
    let resource = this.tableSchemaResources.get(key);
    if (!resource) {
      resource = createTableSchemaResource(key, this.enemySpecialCatalog(), this.projectImageCatalog());
      this.tableSchemaResources.set(key, resource);
    }
    return resource;
  }

  blocklyCompletions(): ModelResource<BlocklyCompletionCatalog> {
    if (!this.blocklyCompletionsResource) {
      this.blocklyCompletionsResource = aggregateResource(
        "blocklyCompletions",
        [
          projectData.tower(), projectData.items(), projectData.enemys(),
          projectData.mapBlocks(), projectData.commonEvents(),
        ] as const,
        (tower, items, enemys, mapBlocks, commonEvents) =>
          buildBlocklyCompletionCatalog({
            tower,
            items,
            enemys,
            mapBlocks,
            commonEvents,
            floorIds: tower.main.floorIds,
          }),
      );
    }
    return this.blocklyCompletionsResource!;
  }

  flagUsage(): ModelResource<FlagUsageIndex> {
    if (!this.flagUsageResource) {
      const dependencies = () => {
        const tower = projectData.tower();
        const towerContent = tower.content();
        const core = [
          tower, projectData.items(), projectData.enemys(),
          projectData.mapBlocks(), projectData.commonEvents(),
        ];
        return towerContent.status === "loaded"
          ? [...core, ...towerContent.value.main.floorIds.map((id) => projectData.floor(id))]
          : core;
      };
      this.flagUsageResource = computedResource(
        "flagUsage",
        dependencies,
        () => {
          const towerContent = projectData.tower().content();
          if (towerContent.status !== "loaded") return towerContent as Content<FlagUsageIndex>;
          const dependencies = [
            projectData.items().content(), projectData.enemys().content(),
            projectData.mapBlocks().content(), projectData.commonEvents().content(),
          ];
          const floorContents = towerContent.value.main.floorIds.map((id) => [id, projectData.floor(id).content()] as const);
          const all = [...dependencies, ...floorContents.map(([, content]) => content)];
          const error = all.find((content) => content.status === "error");
          if (error?.status === "error") return { status: "error", error: error.error };
          if (all.some((content) => content.status === "loading")) return { status: "loading" };
          if (all.some((content) => content.status === "idle")) return { status: "idle" };
          if (dependencies.some((content) => content.status === "not-found")) return { status: "not-found" };
          const loaded = dependencies as Array<{ status: "loaded"; value: unknown }>;
          return {
            status: "loaded",
            value: buildFlagUsageIndex({
              tower: towerContent.value,
              items: loaded[0].value,
              enemys: loaded[1].value,
              mapBlocks: loaded[2].value,
              commonEvents: loaded[3].value,
              floors: Object.fromEntries(floorContents.flatMap(([id, content]) => (
                content.status === "loaded" ? [[id, content.value]] : []
              ))),
            }),
          };
        },
      );
    }
    return this.flagUsageResource!;
  }

  blocklyDiagnostics(events: unknown): BlocklyDiagnostic[] {
    return diagnoseBlocklyEvents(events);
  }

  diagnostics(): ProjectDiagnostic[] {
    const diagnostics: ProjectDiagnostic[] = [];
    const resources = [
      projectData.tower(),
      projectData.items(),
      projectData.enemys(),
      projectData.mapBlocks(),
      projectData.icons(),
      projectData.functions(),
      projectData.commonEvents(),
      projectData.plugins(),
    ];

    for (const resource of resources) {
      const content = resource.content();
      if (content.status === "error") {
        diagnostics.push({
          source: resource.id,
          severity: "error",
          message: content.error.message,
        });
      } else if (content.status === "not-found") {
        diagnostics.push({
          source: resource.id,
          severity: "warning",
          message: `${resource.path} not found`,
        });
      }
    }
    return diagnostics;
  }

  resetForTests(): void {
    this.floorListResource = null;
    this.blockRegistryResource = null;
    this.spriteRegistryResource = null;
    this.materialCatalogResource = null;
    this.tilesetCatalogResource = null;
    this.floorPassabilityResources.clear();
    this.blocklyCompletionsResource = null;
    this.flagUsageResource = null;
    this.enemySpecialResource = null;
    this.projectImageResource = null;
    this.tableSchemaResources.clear();
  }
}

export const projectModel = new ProjectModelImpl();
