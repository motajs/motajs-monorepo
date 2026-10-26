import { IAssetImageDimensions } from '@motajs/editor-impl/asset';
import {
  IMapAutotileRule,
  IMapDirections,
  IMapTileEntry,
  IMapTileGroup,
  IMapTilePass,
  IMapTilesetMeta,
  MAP_CELL_SIZE,
  MAP_FRAME_LIMIT,
  MapAutotileType,
  MapTileCategory,
  MapTextureReadType,
} from '@motajs/editor-impl/map';
import { parseTableText } from '@motajs/editor-impl/shared';
import { ITileCatalogSource } from './types';

// 宿主侧的图块目录解析器：把引擎的纹理清单与图块表读成中立的 `IMapTileGroup[]`。
// 这里只出现引擎的字段名（`type` / `source` / `map` / `identifier` / `autotileType` 等），
// `editor-impl/map` 永远看不到它们；解析结果只给规则与编号，切片与自动拼接由能力包现算。
// 畸形条目一律跳过而不是抛错：宿主拿到半份数据也比整个地图面板打不开好。

/** 引擎默认的 Tileset 编号段起点：宿主没给 `tilesetReserve` 时使用 */
const DEFAULT_TILESET_RESERVE = 100000;

/** 引擎默认的每个 Tileset 编号段容量：宿主没给 `tilesetUnit` 时使用 */
const DEFAULT_TILESET_UNIT = 10000;

/** 一张图集里的一条图块表记录：分类与通行属性来自图块表，编号即键 */
interface ITileTableEntry {
  /** 图块在目录里的分类 */
  readonly category: MapTileCategory;
  /** 图块的通行属性 */
  readonly pass: IMapTilePass;
  /** 图块显示名 */
  readonly name: string;
}

/** 一个图块条目与它所属的分类：分桶前的中间形状 */
interface ICategorizedTile {
  /** 图块所属分类 */
  readonly category: MapTileCategory;
  /** 图块条目 */
  readonly tile: IMapTileEntry;
}

/** 造一个中立素材组所需的全部信息 */
interface IGroupSpec {
  /** 分组所属的六类之一 */
  readonly category: MapTileCategory;
  /** 素材图片相对项目根的路径 */
  readonly imagePath: string;
  /** 读取方式 */
  readonly read: MapTextureReadType;
  /** 素材单格的源像素宽 */
  readonly cellWidth: number;
  /** 素材单格的源像素高 */
  readonly cellHeight: number;
  /** 素材横向的格数 */
  readonly columns: number;
  /** 来源图片真实的图块行数（= 图片高 ÷ 素材格高）；普通网格与动画都要它来算图集高度 */
  readonly rows: number;
  /** 每个图块的帧数 */
  readonly frames: number;
  /** 分组内的图块 */
  readonly tiles: readonly IMapTileEntry[];
  /** 自动拼接规则；普通素材不传 */
  readonly autotile?: IMapAutotileRule;
  /** Tileset 元数据；只有 Tileset 组传 */
  readonly tileset?: IMapTilesetMeta;
}

/**
 * 判断一个值是否为非空、非数组的普通对象
 * @param value 待判断的值
 * @returns 是普通对象时为 true
 */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 读一个非空字符串字段
 * @param value 待读取的值
 * @returns 非空字符串原样返回，否则为 undefined
 */
function readText(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * 读一个正整数；小数向下取整，非正数与非法数值返回 undefined
 * @param value 待读取的值
 * @returns 正整数值或 undefined
 */
function readPositiveInt(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;

  const result = Math.trunc(value);

  return result > 0 ? result : undefined;
}

/**
 * 读一个图块编号：既接受数字，也接受 Tileset 的 `{ index }` 形状
 * @param value 待读取的值
 * @returns 正整数编号或 undefined
 */
function readIdentifier(value: unknown): number | undefined {
  if (isPlainRecord(value)) return readPositiveInt(value.index);

  return readPositiveInt(value);
}

/**
 * 读一个编号数组；非法元素直接跳过
 * @param value 待读取的值
 * @returns 正整数编号数组
 */
function readNumberArray(value: unknown): readonly number[] {
  if (!Array.isArray(value)) return [];

  const numbers: number[] = [];

  for (const item of value) {
    const number = readPositiveInt(item);

    if (number !== undefined) numbers.push(number);
  }

  return numbers;
}

/**
 * 把两份引擎文本的根收成条目数组：根可以是数组，也可以是带 `textures` / `tiles` / `list` 的对象
 * @param text 引擎文件原文
 * @returns 普通对象条目数组；无法解析时为空数组
 */
function readEntryList(text: string): readonly Record<string, unknown>[] {
  const parsed = parseTableText(text);
  const value = parsed.value;

  if (Array.isArray(value)) return value.filter(isPlainRecord);
  if (!isPlainRecord(value)) return [];

  for (const key of ['textures', 'tiles', 'list']) {
    const list = value[key];

    if (Array.isArray(list)) return list.filter(isPlainRecord);
  }

  return [];
}

/**
 * 把图块表的 `type` 数字映射到六类；未知类型返回 undefined
 * @param type 图块表的类型数字
 * @returns 对应的分类或 undefined
 */
function resolveCategory(type: unknown): MapTileCategory | undefined {
  if (typeof type !== 'number') return undefined;

  switch (type) {
    case 2:
    case 3:
      return MapTileCategory.Terrain;
    case 4:
      return MapTileCategory.Item;
    case 5:
      return MapTileCategory.Enemy;
    case 6:
      return MapTileCategory.Npc;
    case 7:
      return MapTileCategory.Autotile;
    case 8:
      return MapTileCategory.Tileset;
    default:
      return undefined;
  }
}

/**
 * 把纹理清单的 `type` 字符串映射到读取方式
 *
 * `tileset` 与 `autotile` 一律 `Grid`：`Full` 会把整张图集当成一格，Tileset 的逐格编号与
 * 自动元件的单帧回退都必须按格取矩形。
 * @param entry 纹理清单条目
 * @returns 读取方式
 */
function resolveReadType(entry: Record<string, unknown>): MapTextureReadType {
  const kind = readText(entry.type);

  if (kind === 'grid') return MapTextureReadType.Grid;
  if (kind === 'rowAnimate') return MapTextureReadType.RowAnimate;
  if (kind === 'columnAnimate') return MapTextureReadType.ColumnAnimate;
  if (kind === 'scanAnimate') return MapTextureReadType.ScanAnimate;
  if (kind === 'tileset' || kind === 'autotile') return MapTextureReadType.Grid;
  if (kind === 'full') return MapTextureReadType.Full;

  return entry.map === undefined ? MapTextureReadType.Full : MapTextureReadType.Grid;
}

/**
 * 读自动元件的形状：接受演示用的字符串与引擎用的数字两种写法
 * @param value 纹理清单里的 `autotileType`
 * @returns 自动元件形状；无法识别时按 3×4 处理
 */
function resolveAutotileType(value: unknown): MapAutotileType {
  if (value === 'Big3x4' || value === 1) return MapAutotileType.Big3x4;
  if (value === 'Small2x3' || value === 0) return MapAutotileType.Small2x3;

  return MapAutotileType.Big3x4;
}

/**
 * 自动元件横向占几格：3×4 是 3 格、2×3 是 2 格
 * @param type 自动元件形状
 * @returns 横向格数
 */
function autotileBlockColumns(type: MapAutotileType): number {
  return type === MapAutotileType.Big3x4 ? 3 : 2;
}

/**
 * 把帧数夹到 1..`MAP_FRAME_LIMIT`
 * @param count 原始帧数
 * @returns 可用的帧数
 */
function clampFrames(count: number): number {
  if (!Number.isFinite(count) || count < 1) return 1;

  return Math.min(MAP_FRAME_LIMIT, Math.trunc(count));
}

/**
 * 由读取方式与图片尺寸算出帧数
 * @param kind 纹理清单的 `type`
 * @param image 图片像素尺寸
 * @param cellWidth 素材单格宽
 * @param cellHeight 素材单格高
 * @param autotileType 自动元件形状（仅 `autotile` 用）
 * @returns 夹取后的帧数
 */
function resolveFrames(
  kind: string | undefined,
  image: IAssetImageDimensions,
  cellWidth: number,
  cellHeight: number,
  autotileType: MapAutotileType,
): number {
  if (kind === 'rowAnimate') return clampFrames(Math.floor(image.width / cellWidth));
  if (kind === 'columnAnimate') return clampFrames(Math.floor(image.height / cellHeight));

  if (kind === 'autotile') {
    const blockWidth = cellWidth * autotileBlockColumns(autotileType);

    return clampFrames(Math.floor(image.width / blockWidth));
  }

  return 1;
}

/**
 * 读一个布尔方向值；缺失按 true（四方向可通行）处理
 * @param value 待读取的值
 * @returns 方向是否可通行
 */
function readDirection(value: unknown): boolean {
  return typeof value === 'boolean' ? value : true;
}

/**
 * 读四方向通行表
 * @param value 待读取的值
 * @returns 四方向通行表
 */
function readDirections(value: unknown): IMapDirections {
  const record = isPlainRecord(value) ? value : {};

  return {
    up: readDirection(record.up),
    right: readDirection(record.right),
    down: readDirection(record.down),
    left: readDirection(record.left),
  };
}

/**
 * 读图块的通行属性；整个字段缺失时按四方向可通行、且不在事件层独占
 * @param value 图块表里的 `pass`
 * @returns 通行属性
 */
function readPass(value: unknown): IMapTilePass {
  const record = isPlainRecord(value) ? value : {};

  return {
    out: readDirections(record.out),
    in: readDirections(record.in),
    onlyEventLayer: record.onlyEventLayer === true,
  };
}

/**
 * 把图块表收成「编号 → 分类 / 通行 / 名字」的查询表
 * @param entries 图块表条目
 * @returns 查询表；同一编号后出现的条目覆盖先出现的
 */
function buildTileTable(entries: readonly Record<string, unknown>[]): ReadonlyMap<number, ITileTableEntry> {
  const table: Map<number, ITileTableEntry> = new Map();

  for (const entry of entries) {
    const number = readIdentifier(entry.identifier) ?? readPositiveInt(entry.num);
    const category = resolveCategory(entry.type);

    if (number === undefined || category === undefined) continue;

    table.set(number, {
      category,
      pass: readPass(entry.pass),
      name: readText(entry.name) ?? readText(entry.id) ?? `#${number}`,
    });
  }

  return table;
}

/**
 * 取路径的最后一段并去掉扩展名，用来给素材组起可读的标识
 * @param source 素材图片路径
 * @returns 不含目录与扩展名的名字
 */
function sourceBaseName(source: string): string {
  const last = source.slice(source.lastIndexOf('/') + 1);
  const dot = last.lastIndexOf('.');

  return dot > 0 ? last.slice(0, dot) : last;
}

/**
 * 取分类的稳定英文标识，用于素材组 id
 * @param category 分类
 * @returns 英文标识
 */
function categorySlug(category: MapTileCategory): string {
  switch (category) {
    case MapTileCategory.Terrain:
      return 'terrain';
    case MapTileCategory.Enemy:
      return 'enemy';
    case MapTileCategory.Npc:
      return 'npc';
    case MapTileCategory.Item:
      return 'item';
    case MapTileCategory.Autotile:
      return 'autotile';
    case MapTileCategory.Tileset:
      return 'tileset';
    default:
      return 'tile';
  }
}

/**
 * 取分类的中文名，用于素材组显示名
 * @param category 分类
 * @returns 中文名
 */
function categoryLabel(category: MapTileCategory): string {
  switch (category) {
    case MapTileCategory.Terrain:
      return '地形';
    case MapTileCategory.Enemy:
      return '敌人';
    case MapTileCategory.Npc:
      return '人物';
    case MapTileCategory.Item:
      return '物品';
    case MapTileCategory.Autotile:
      return '自动元件';
    case MapTileCategory.Tileset:
      return 'Tileset';
    default:
      return '图块';
  }
}

/**
 * 造一个全目录唯一的素材组 id
 * @param category 分类
 * @param imagePath 素材图片路径
 * @param usedIds 已用过的 id 集合，本函数会写入新 id
 * @returns 唯一的素材组 id
 */
function createGroupId(category: MapTileCategory, imagePath: string, usedIds: Set<string>): string {
  const base = `${categorySlug(category)}-${sourceBaseName(imagePath)}`;
  let id = base;
  let index = 2;

  while (usedIds.has(id)) {
    id = `${base}-${index}`;
    index += 1;
  }

  usedIds.add(id);

  return id;
}

/**
 * 造一个图块条目：裁切由素材组的读取规则与行列现算，条目只带编号与图集位置
 * @param number 写进地图格子的编号
 * @param column 图块在素材里的列号
 * @param row 图块在素材里的行号
 * @param tile 图块表里的分类 / 通行 / 名字
 * @returns 图块条目
 */
function createTileEntry(number: number, column: number, row: number, tile: ITileTableEntry): IMapTileEntry {
  return {
    number,
    column,
    row,
    name: tile.name,
    pass: tile.pass,
  };
}

/**
 * 把一份素材规格收成 `IMapTileGroup`
 * @param spec 素材组规格
 * @param usedIds 已用过的 id 集合
 * @returns 中立素材组
 */
function createGroup(spec: IGroupSpec, usedIds: Set<string>): IMapTileGroup {
  const group: IMapTileGroup = {
    id: createGroupId(spec.category, spec.imagePath, usedIds),
    name: `${categoryLabel(spec.category)} ${sourceBaseName(spec.imagePath)}`,
    imagePath: spec.imagePath,
    columns: spec.columns,
    rows: spec.rows,
    tiles: spec.tiles,
    category: spec.category,
    read: spec.read,
    cellWidth: spec.cellWidth,
    cellHeight: spec.cellHeight,
    frames: spec.frames,
  };

  if (spec.autotile !== undefined) return { ...group, autotile: spec.autotile };
  if (spec.tileset !== undefined) return { ...group, tileset: spec.tileset };

  return group;
}

/**
 * 按分类把一批图块分桶，桶的顺序即分类第一次出现的顺序
 * @param tiles 图块条目与它所属的分类
 * @returns 分类 → 图块列表
 */
function bucketByCategory(tiles: readonly ICategorizedTile[]): Map<MapTileCategory, IMapTileEntry[]> {
  const buckets: Map<MapTileCategory, IMapTileEntry[]> = new Map();

  for (const item of tiles) {
    const list = buckets.get(item.category);

    if (list === undefined) buckets.set(item.category, [item.tile]);
    else list.push(item.tile);
  }

  return buckets;
}

/**
 * 从纹理清单 + 图块表生成中立的图块目录
 *
 * 每个纹理清单条目先按 `source` 查图片尺寸，缺失即跳过（不猜尺寸）；普通素材的编号来自
 * 条目的 `map` 数组，自动元件的编号来自 `identifier`。
 * Tileset 编号按引擎的 `tilesetReserve` + `tilesetUnit` 累计编号段：第 k 张图的起点是
 * `reserve + 已占用段数 × unit`，每张图按图片格数 `ceil(count / unit)` 占段（至少 1 段），
 * 因此多张图占用连续且互不重叠的编号段，不再每张图从固定基号枚举（D-51）。
 * 同一个 `map` 数组里混有多个分类时按图块表的 `type` 各生成一个组，图块保留它在整个数组里的行列。
 * @param source 宿主解析输入：两份文本、图片尺寸查询表、自动拼接连接表与 Tileset 编号段参数
 * @returns 六类图块目录；没有可解析的条目时为空数组
 */
export function buildTileCatalog(source: ITileCatalogSource): readonly IMapTileGroup[] {
  const textureEntries = readEntryList(source.textureText);
  const tileTable = buildTileTable(readEntryList(source.tileText));
  const usedIds: Set<string> = new Set();
  const groups: IMapTileGroup[] = [];
  let usedTilesetSegments = 0;

  for (const entry of textureEntries) {
    const kind = readText(entry.type);
    const imagePath = readText(entry.source);

    if (imagePath === undefined) continue;

    const image = source.dimensions[imagePath];

    if (image === undefined) continue;

    const cellWidth = readPositiveInt(entry.cellWidth) ?? readPositiveInt(entry.width) ?? MAP_CELL_SIZE;
    const cellHeight = readPositiveInt(entry.cellHeight) ?? readPositiveInt(entry.height) ?? MAP_CELL_SIZE;
    const columns = Math.floor(image.width / cellWidth);
    // 真实行数只能按图片高现算：分类分桶后一组可能只收录第 0 行，
    // 用「目录里的最大行号 + 1」会把 128×64 的地形图压成一行（U-25）。
    const imageRows = Math.max(1, Math.floor(image.height / cellHeight));

    if (columns <= 0) continue;

    if (kind === 'autotile') {
      const identifier = readIdentifier(entry.identifier);
      const tile = identifier === undefined ? undefined : tileTable.get(identifier);

      if (identifier === undefined || tile === undefined) continue;

      const autotileType = resolveAutotileType(entry.autotileType);
      const autotile: IMapAutotileRule = { type: autotileType, connections: source.connections[identifier] ?? [] };

      groups.push(
        createGroup(
          {
            category: tile.category,
            imagePath,
            read: MapTextureReadType.Grid,
            cellWidth,
            cellHeight,
            columns,
            rows: imageRows,
            frames: resolveFrames(kind, image, cellWidth, cellHeight, autotileType),
            tiles: [createTileEntry(identifier, 0, 0, tile)],
            autotile,
          },
          usedIds,
        ),
      );

      continue;
    }

    if (kind === 'tileset') {
      const rows = Math.floor(image.height / cellHeight);

      if (rows <= 0) continue;

      const count = columns * rows;
      const reserve = readPositiveInt(source.tilesetReserve) ?? DEFAULT_TILESET_RESERVE;
      const unit = readPositiveInt(source.tilesetUnit) ?? DEFAULT_TILESET_UNIT;
      const base = reserve + usedTilesetSegments * unit;
      const tileset: IMapTilesetMeta = { cellWidth, cellHeight, columns, rows };
      const collected: ICategorizedTile[] = [];

      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const number = base + row * columns + column;
          const tile = tileTable.get(number);

          if (tile === undefined) continue;

          collected.push({
            category: tile.category,
            tile: createTileEntry(number, column, row, tile),
          });
        }
      }

      usedTilesetSegments += Math.max(1, Math.ceil(count / unit));

      for (const [category, tiles] of bucketByCategory(collected)) {
        groups.push(
          createGroup(
            {
              category,
              imagePath,
              read: MapTextureReadType.Grid,
              cellWidth,
              cellHeight,
              columns,
              rows: imageRows,
              frames: 1,
              tiles,
              tileset: category === MapTileCategory.Tileset ? tileset : undefined,
            },
            usedIds,
          ),
        );
      }

      continue;
    }

    const read = resolveReadType(entry);
    const frames = resolveFrames(kind, image, cellWidth, cellHeight, MapAutotileType.Big3x4);
    const collected: ICategorizedTile[] = [];

    readNumberArray(entry.map).forEach((number: number, index: number) => {
      const tile = tileTable.get(number);

      if (tile === undefined) return;

      const column = index % columns;
      const row = Math.floor(index / columns);

      if (row * cellHeight + cellHeight > image.height) return;

      collected.push({
        category: tile.category,
        tile: createTileEntry(number, column, row, tile),
      });
    });

    for (const [category, tiles] of bucketByCategory(collected)) {
      groups.push(
        createGroup(
          {
            category,
            imagePath,
            read,
            cellWidth,
            cellHeight,
            columns,
            rows: imageRows,
            frames,
            tiles,
          },
          usedIds,
        ),
      );
    }
  }

  return groups;
}
