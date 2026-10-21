import { EditorCore, IEditorFileSystem } from '@motajs/editor-core';
import {
  createMapPanelType,
  IMapDirections,
  IMapEditorCapabilities,
  IMapTileEntry,
  IMapTileGroup,
} from '@motajs/editor-impl/map';
import { ITableSchemaNode, serializeTableText } from '@motajs/editor-impl/shared';
import { createMapCapabilities, IMapFileRecord, mapFilePath, MAP_LIST_PATH } from '../backend/mapFiles';
import { IMemoryBackend } from '../backend/types';

// 开发宿主的地图演示数据：两张尺幅不同的地图、两个图块分组（其中一组故意缺图）、一份两字段的属性 schema。
// 地图文件用演示宿主的扁平格式写出，图层名 / 属性 / 事件 / 额外字段都按宿主要求各就各位；
// 图块目录只经 `createMapCapabilities` 的 `tileGroups` 选项交给能力，能力包本身不自行装配。

/** 图块在源图片上的像素边长 */
const DEMO_TILE_SIZE = 32;

/** 地形图集相对项目根的路径；启动时会把一张 1×1 PNG 写进这个路径 */
const DEMO_TERRAIN_IMAGE_PATH = 'content/map/tiles-terrain.png';

/** 物件图集的路径；故意不写文件，用来验收「缺图占位」 */
const DEMO_OBJECTS_IMAGE_PATH = 'content/map/tiles-objects.png';

/** 四方向可通行的方向表 */
const OPEN_DIRECTIONS: IMapDirections = { up: true, right: true, down: true, left: true };

/** 四方向不可通行的方向表 */
const BLOCKED_DIRECTIONS: IMapDirections = { up: false, right: false, down: false, left: false };

/** 1×1 透明 PNG 的字节：演示图块只需要「有图」这件事成立，不追求画面 */
const DEMO_TILE_PNG: Uint8Array = new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137,
  0, 0, 0, 13, 73, 68, 65, 84, 120, 218, 99, 252, 207, 192, 80, 15, 0, 4, 133, 1, 128, 132, 169, 140, 33, 0, 0, 0, 0, 73,
  69, 78, 68, 174, 66, 96, 130,
]);

/**
 * 造一个图块条目；裁切矩形按列号 × 32 像素推导
 * @param number 写进地图格子的图块编号
 * @param column 图集内的列号
 * @param name 图块显示名
 * @param passable 为 true 时四方向都可通行
 * @param onlyEventLayer 为 true 时只在事件图层参与通行度显示
 * @returns 图块条目
 */
function createTileEntry(
  number: number,
  column: number,
  name: string,
  passable: boolean,
  onlyEventLayer: boolean = false,
): IMapTileEntry {
  const directions = passable ? OPEN_DIRECTIONS : BLOCKED_DIRECTIONS;

  return {
    number,
    column,
    row: 0,
    crop: { x: column * DEMO_TILE_SIZE, y: 0, width: DEMO_TILE_SIZE, height: DEMO_TILE_SIZE },
    name,
    pass: { out: directions, in: directions, onlyEventLayer },
  };
}

/** 演示图块目录：地形组有图、物件组缺图；通行属性覆盖全通 / 全阻 / 只在事件层生效三种 */
export const MAP_DEMO_TILES: readonly IMapTileGroup[] = [
  {
    id: 'terrain',
    name: '地形',
    imagePath: DEMO_TERRAIN_IMAGE_PATH,
    columns: 4,
    tiles: [
      createTileEntry(1, 0, '草地', true),
      createTileEntry(2, 1, '墙', false),
      createTileEntry(3, 2, '传送门', false, true),
      createTileEntry(4, 3, '沙地', true),
    ],
  },
  {
    id: 'objects',
    name: '物件',
    imagePath: DEMO_OBJECTS_IMAGE_PATH,
    columns: 4,
    tiles: [
      createTileEntry(5, 0, '宝箱', false),
      createTileEntry(6, 1, '路牌', false),
      createTileEntry(7, 2, '火把', true),
      createTileEntry(8, 3, '石碑', false),
    ],
  },
];

/** 演示地图属性 Schema：一个字符串字段（名称）与一个数字字段（初始金币），按 x-order 排列 */
export const MAP_DEMO_PROPERTY_SCHEMA: ITableSchemaNode = {
  type: 'object',
  properties: {
    name: { type: 'string', description: '地图名称' },
    initialGold: { type: 'number', description: '初始金币' },
  },
  'x-order': ['name', 'initialGold'],
};

/**
 * 按格子生成器造一层扁平行主序格子
 * @param width 地图宽度
 * @param height 地图高度
 * @param create 按横纵坐标求格子值的生成器
 * @returns 长度为宽 × 高的扁平数组
 */
function createLayer(width: number, height: number, create: (x: number, y: number) => number): number[] {
  const cells: number[] = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) cells.push(create(x, y));
  }

  return cells;
}

/** 小地图的宽度：小于视口，能一次看全边界 */
const DEMO_SMALL_WIDTH = 8;

/** 小地图的高度 */
const DEMO_SMALL_HEIGHT = 6;

/** 大地图的宽度：大于视口，用来验收视口移动与大地图模式 */
const DEMO_WIDE_WIDTH = 40;

/** 大地图的高度 */
const DEMO_WIDE_HEIGHT = 26;

/** 演示地图记录：一张小图（两层）与一张大图（一层），都带非空格子与要保留的事件 / 额外字段 */
export const MAP_DEMO_MAPS: readonly IMapFileRecord[] = [
  {
    id: 'small',
    name: '小营地',
    width: DEMO_SMALL_WIDTH,
    layers: {
      0: createLayer(DEMO_SMALL_WIDTH, DEMO_SMALL_HEIGHT, (x, y) => {
        const border = x === 0 || y === 0 || x === DEMO_SMALL_WIDTH - 1 || y === DEMO_SMALL_HEIGHT - 1;

        if (border) return 2;

        return (x + y) % 3 === 0 ? 3 : 1;
      }),
      1: createLayer(DEMO_SMALL_WIDTH, DEMO_SMALL_HEIGHT, (x, y) =>
        (x === 3 && y === 2) || (x === 4 && y === 3) ? 5 : 0,
      ),
    },
    layerNames: { 0: '地面层', 1: '遮挡层' },
    properties: { name: '小营地', initialGold: 30 },
    events: { '3,2': { type: 'battle', enemyId: 'greenSlime', once: true } },
    extra: { note: '演示地图：保存时必须原样保留', order: 1 },
  },
  {
    id: 'wide',
    name: '大平原',
    width: DEMO_WIDE_WIDTH,
    layers: {
      0: createLayer(DEMO_WIDE_WIDTH, DEMO_WIDE_HEIGHT, (x, y) => {
        const border = x === 0 || y === 0 || x === DEMO_WIDE_WIDTH - 1 || y === DEMO_WIDE_HEIGHT - 1;

        if (border) return 2;

        return (x * 3 + y * 5) % 7 === 0 ? 4 : 1;
      }),
    },
    layerNames: { 0: '地面层' },
    properties: { name: '大平原', initialGold: 120 },
    events: { '20,13': { type: 'trigger', script: 'onEnter' } },
    extra: { note: '大地图：验收视口移动', order: 2 },
  },
];

/**
 * 把演示地图文件、清单与一张图块图片写进内存后端；缺图的物件图集故意不写
 * @param backend 开发宿主的内存后端
 */
export async function seedMapDemo(backend: IMemoryBackend): Promise<void> {
  const maps = MAP_DEMO_MAPS.map((record) => ({ id: record.id, name: record.name }));

  backend.seed(MAP_LIST_PATH, serializeTableText({ maps }, ''));

  for (const record of MAP_DEMO_MAPS) {
    backend.seed(mapFilePath(record.id), serializeTableText(record, ''));
  }

  backend.seed(DEMO_TERRAIN_IMAGE_PATH, DEMO_TILE_PNG);
}

/**
 * 注册开发宿主的地图面板类型，并把图块目录、属性 schema、尺寸上限与最近使用路径一并注入
 * @param core 开发宿主的编辑器核心，经其外壳系统注册面板类型
 * @param backend 开发宿主的内存后端，地图能力的全部读写都经它
 * @returns 注入给地图面板的能力对象
 */
export function registerMapDemo(core: EditorCore, backend: IEditorFileSystem): IMapEditorCapabilities {
  const capabilities = createMapCapabilities(backend, {
    tileGroups: MAP_DEMO_TILES,
    propertiesSchema: MAP_DEMO_PROPERTY_SCHEMA,
    maxMapSize: { maxWidth: 64, maxHeight: 64 },
    recentTilesPath: '.editor/map-recent-tiles.json',
  });

  // 素材 demo 已订阅同一条「无法撤销」提示，这里不再重复订阅，避免一次撤销弹两次
  core.shellSystem.registerPanelType(createMapPanelType(capabilities));

  return capabilities;
}
