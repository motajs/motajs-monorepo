import { EditorCore } from '@motajs/editor-core';
import { readImageDimensions } from '@motajs/editor-impl/asset';
import {
  computePassabilityMarks,
  IMapDocument,
  IMapTileEntry,
  IMapTileGroup,
  MapAutotileType,
  MapTextureReadType,
  MapTileCategory,
} from '@motajs/editor-impl/map';
import { describe, expect, it } from 'vitest';
import { IMapFileRecord, toMapDocument } from '../backend/mapFiles';
import { MemoryBackend } from '../backend/memoryBackend';
import {
  buildDemoTileCatalog,
  DEMO_TEXTURE_LIST_TEXT,
  DEMO_TILE_TABLE_TEXT,
  encodeDemoAnimateAtlas,
  encodeDemoAutotileSmallAtlas,
  encodeDemoLargeTileAtlas,
  encodeDemoSmallTileAtlas,
  encodeDemoTileAtlas,
  encodeDemoTilesetAtlas,
  MAP_DEMO_MAPS,
  readDemoAutotileBigBytes,
  registerMapDemo,
  seedMapDemo,
} from '../demo/mapDemo';

// 开发宿主演示数据的单元测试：七张图集尺寸、裁切在图内、六类齐全、动画 / 自动元件 / Tileset 的读取规则，
// 以及 `registerMapDemo` 的能力覆盖。这里不渲染面板，面板行为由 devHostMap.test.tsx 覆盖。

/** 地形图集路径 */
const TERRAIN_PATH = 'content/map/tiles-terrain.png';

/** 动画图集路径 */
const ANIMATE_PATH = 'content/map/tiles-animate.png';

/** 3×4 自动元件图集路径 */
const AUTOTILE_BIG_PATH = 'content/map/tiles-autotile-big.png';

/** 2×3 自动元件图集路径 */
const AUTOTILE_SMALL_PATH = 'content/map/tiles-autotile-small.png';

/** Tileset 图集路径 */
const TILESET_PATH = 'content/map/tiles-tileset.png';

/** 大素材图集路径 */
const LARGE_PATH = 'content/map/tiles-large.png';

/** 小素材图集路径 */
const SMALL_PATH = 'content/map/tiles-small.png';

/** 七张演示图集各自的期望尺寸 */
const ATLAS_SIZES: readonly (readonly [string, number, number])[] = [
  [TERRAIN_PATH, 128, 64],
  [ANIMATE_PATH, 128, 32],
  [AUTOTILE_BIG_PATH, 384, 128],
  [AUTOTILE_SMALL_PATH, 128, 96],
  [TILESET_PATH, 128, 64],
  [LARGE_PATH, 192, 64],
  [SMALL_PATH, 64, 32],
];

/** PNG 文件头的八个字节 */
const PNG_SIGNATURE: readonly number[] = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * 按图片路径与分类找素材组
 * @param groups 整份目录
 * @param imagePath 素材图片路径
 * @param category 期望分类
 * @returns 命中的素材组
 */
function findGroup(groups: readonly IMapTileGroup[], imagePath: string, category: MapTileCategory): IMapTileGroup {
  const group = groups.find((candidate) => candidate.imagePath === imagePath && candidate.category === category);

  if (group === undefined) throw new Error(`素材组缺失：${imagePath} / ${category}`);

  return group;
}

/**
 * 取素材组里每个图块的行列
 * @param group 素材组
 * @returns 行列对数组
 */
function positions(group: IMapTileGroup): readonly (readonly number[])[] {
  return group.tiles.map((tile) => [tile.column, tile.row]);
}

/**
 * 取素材组里每个图块的编号
 * @param group 素材组
 * @returns 编号数组
 */
function numbers(group: IMapTileGroup): readonly number[] {
  return group.tiles.map((tile) => tile.number);
}

/**
 * 按标识找演示地图记录
 * @param mapId 地图标识
 * @returns 演示记录
 */
function findRecord(mapId: string): IMapFileRecord {
  const record = MAP_DEMO_MAPS.find((candidate) => candidate.id === mapId);

  if (record === undefined) throw new Error(`演示地图缺失：${mapId}`);

  return record;
}

/**
 * 按编号找演示图块条目
 * @param groups 整份目录
 * @param number 图块编号
 * @returns 命中的图块条目
 */
function findTile(groups: readonly IMapTileGroup[], number: number): IMapTileEntry {
  for (const group of groups) {
    const tile = group.tiles.find((candidate) => candidate.number === number);

    if (tile !== undefined) return tile;
  }

  throw new Error(`图块缺失：${number}`);
}

/**
 * 把整份目录摊平成编号索引；通行度计算只需要这一个入参
 * @param groups 整份目录
 * @returns 编号到图块条目的只读索引
 */
function createTileIndex(groups: readonly IMapTileGroup[]): ReadonlyMap<number, IMapTileEntry> {
  return new Map(groups.flatMap((group) => group.tiles).map((tile) => [tile.number, tile]));
}

describe('开发宿主演示图集与图块目录', () => {
  // 七张图集都是真实 PNG，尺寸与用途一一对应
  it('七张图集尺寸与用途对应', () => {
    expect(readImageDimensions(encodeDemoTileAtlas())).toEqual({ width: 128, height: 64 });
    expect(readImageDimensions(encodeDemoAnimateAtlas())).toEqual({ width: 128, height: 32 });
    expect(readImageDimensions(readDemoAutotileBigBytes())).toEqual({ width: 384, height: 128 });
    expect(readImageDimensions(encodeDemoAutotileSmallAtlas())).toEqual({ width: 128, height: 96 });
    expect(readImageDimensions(encodeDemoTilesetAtlas())).toEqual({ width: 128, height: 64 });
    expect(readImageDimensions(encodeDemoLargeTileAtlas())).toEqual({ width: 192, height: 64 });
    expect(readImageDimensions(encodeDemoSmallTileAtlas())).toEqual({ width: 64, height: 32 });
  });

  // 大号自动元件直接来自仓库内素材：字节以 PNG 签名开头，证明 `?inline` 解出的是真图片而不是缺省数据
  it('大号自动元件字节带 PNG 签名', () => {
    const bytes = readDemoAutotileBigBytes();

    expect(Array.from(bytes.subarray(0, PNG_SIGNATURE.length))).toEqual(PNG_SIGNATURE);
    expect(bytes.length).toBeGreaterThan(PNG_SIGNATURE.length);
  });

  // 目录里每个图块的图集位置换算出的单格都落在对应图片内
  it('所有图块的单格都在图内', () => {
    const groups = buildDemoTileCatalog();
    const sizes = new Map<string, { readonly width: number; readonly height: number }>();

    for (const [path, width, height] of ATLAS_SIZES) sizes.set(path, { width, height });

    for (const group of groups) {
      const size = sizes.get(group.imagePath);

      if (size === undefined) throw new Error(`未知图集：${group.imagePath}`);

      for (const tile of group.tiles) {
        expect(tile.column).toBeGreaterThanOrEqual(0);
        expect(tile.row).toBeGreaterThanOrEqual(0);
        expect((tile.column + 1) * group.cellWidth).toBeLessThanOrEqual(size.width);
        expect((tile.row + 1) * group.cellHeight).toBeLessThanOrEqual(size.height);
      }
    }
  });

  // 六类齐全，且都指向七张真实图集之一（不再有 tiles-objects 这种缺图占位）
  it('六类齐全且都指向真实图集', () => {
    const groups = buildDemoTileCatalog();
    const categories = new Set(groups.map((group) => group.category));
    const known = new Set(ATLAS_SIZES.map(([path]) => path));

    expect(categories).toEqual(
      new Set([
        MapTileCategory.Terrain,
        MapTileCategory.Enemy,
        MapTileCategory.Npc,
        MapTileCategory.Item,
        MapTileCategory.Autotile,
        MapTileCategory.Tileset,
      ]),
    );

    for (const group of groups) expect(known.has(group.imagePath)).toBe(true);

    expect(groups.some((group) => group.imagePath.includes('tiles-objects'))).toBe(false);
  });

  // 地形图集的 8 个编号按整图位置分组：地形 1–4、敌人 5/6、NPC 7、物品 8
  it('地形图集按编号分组并保留整图行列', () => {
    const groups = buildDemoTileCatalog();
    const terrain = findGroup(groups, TERRAIN_PATH, MapTileCategory.Terrain);
    const enemy = findGroup(groups, TERRAIN_PATH, MapTileCategory.Enemy);
    const npc = findGroup(groups, TERRAIN_PATH, MapTileCategory.Npc);
    const item = findGroup(groups, TERRAIN_PATH, MapTileCategory.Item);

    expect(numbers(terrain)).toEqual([1, 2, 3, 4]);
    expect(positions(terrain)).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
    ]);
    expect(numbers(enemy)).toEqual([5, 6]);
    expect(positions(enemy)).toEqual([
      [0, 1],
      [1, 1],
    ]);
    expect(numbers(npc)).toEqual([7]);
    expect(positions(npc)).toEqual([[2, 1]]);
    expect(numbers(item)).toEqual([8]);
    expect(positions(item)).toEqual([[3, 1]]);

    for (const group of [terrain, enemy, npc, item]) expect(group.read).toBe(MapTextureReadType.Grid);
  });

  // 大素材每格 96×64、小素材每格 16×16，行列与编号一一对应
  it('大素材与小素材的格尺寸与行列正确', () => {
    const groups = buildDemoTileCatalog();
    const large = findGroup(groups, LARGE_PATH, MapTileCategory.Item);
    const small = findGroup(groups, SMALL_PATH, MapTileCategory.Item);

    expect(large.cellWidth).toBe(96);
    expect(large.cellHeight).toBe(64);
    expect(numbers(large)).toEqual([20, 21]);
    expect(positions(large)).toEqual([
      [0, 0],
      [1, 0],
    ]);

    expect(small.cellWidth).toBe(16);
    expect(small.cellHeight).toBe(16);
    expect(numbers(small)).toEqual([30, 31, 32, 33, 34, 35, 36, 37]);
    expect(positions(small)).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
    ]);
  });

  // 动画组只有编号 10、4 帧：编号来自 rowAnimate 的 map，帧数来自图片宽 ÷ 单格宽
  it('动画组 4 帧且编号来自 map 数组', () => {
    const groups = buildDemoTileCatalog();
    const animate = findGroup(groups, ANIMATE_PATH, MapTileCategory.Terrain);

    expect(animate.read).toBe(MapTextureReadType.RowAnimate);
    expect(animate.frames).toBe(4);
    expect(numbers(animate)).toEqual([10]);
    expect(positions(animate)).toEqual([[0, 0]]);
  });

  // 两种自动元件各 1 个图块、read 为 Grid；大号的是真实四帧素材（384 ÷ 96 = 4），小号的仍两帧
  it('两种自动元件都是单格且 read 为 Grid', () => {
    const groups = buildDemoTileCatalog();
    const big = findGroup(groups, AUTOTILE_BIG_PATH, MapTileCategory.Autotile);
    const small = findGroup(groups, AUTOTILE_SMALL_PATH, MapTileCategory.Autotile);

    expect(big.read).toBe(MapTextureReadType.Grid);
    expect(big.imagePath).toBe('content/map/tiles-autotile-big.png');
    expect(big.frames).toBe(4);
    expect(numbers(big)).toEqual([90]);
    expect(positions(big)).toEqual([[0, 0]]);
    expect(big.autotile).toEqual({ type: MapAutotileType.Big3x4, connections: [1, 2] });

    expect(small.read).toBe(MapTextureReadType.Grid);
    expect(small.frames).toBe(2);
    expect(numbers(small)).toEqual([91]);
    expect(positions(small)).toEqual([[0, 0]]);
    expect(small.autotile).toEqual({ type: MapAutotileType.Small2x3, connections: [1, 2] });
  });

  // Tileset 恰好 8 格、编号连续 1000..1007，read 为 Grid 且每格裁切就是自己那一格
  it('Tileset 逐格编号且 read 为 Grid', () => {
    const groups = buildDemoTileCatalog();
    const tileset = findGroup(groups, TILESET_PATH, MapTileCategory.Tileset);

    expect(tileset.read).toBe(MapTextureReadType.Grid);
    expect(tileset.tiles).toHaveLength(8);
    expect(numbers(tileset)).toEqual([1000, 1001, 1002, 1003, 1004, 1005, 1006, 1007]);
    expect(positions(tileset)).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
    ]);
    expect(tileset.tileset).toEqual({ cellWidth: 32, cellHeight: 32, columns: 4, rows: 2 });

    const entry = tileset.tiles[5];

    expect([entry.column, entry.row]).toEqual([1, 1]);
  });

  // registerMapDemo 能把视口格数与帧速覆盖并入能力对象，不传时保持缺省
  it('registerMapDemo 支持视口与帧速覆盖', () => {
    const overridden = registerMapDemo(new EditorCore(), new MemoryBackend(), {
      viewportColumns: 15,
      viewportRows: 9,
      frameSpeed: 150,
    });

    expect(overridden.viewportColumns).toBe(15);
    expect(overridden.viewportRows).toBe(9);
    expect(overridden.frameSpeed).toBe(150);

    const plain = registerMapDemo(new EditorCore(), new MemoryBackend());

    expect(plain.viewportColumns).toBeUndefined();
    expect(plain.viewportRows).toBeUndefined();
    expect(plain.frameSpeed).toBeUndefined();
    expect(plain.maxMapSize).toEqual({ maxWidth: 256, maxHeight: 256 });
  });

  // seedMapDemo 把七张图集与两份引擎文本真的写进演示项目
  it('seedMapDemo 写入七张图集与两份引擎文本', async () => {
    const backend = new MemoryBackend();

    await seedMapDemo(backend);

    for (const [path, width, height] of ATLAS_SIZES) {
      const bytes = await backend.readBinary(path);

      expect(readImageDimensions(bytes)).toEqual({ width, height });
    }

    expect(await backend.readFile('content/map/texture/.list.jsonc')).toBe(DEMO_TEXTURE_LIST_TEXT);
    expect(await backend.readFile('content/map/tiles.jsonc')).toBe(DEMO_TILE_TABLE_TEXT);
  });
});

describe('开发宿主演示图块的通行属性', () => {
  // 地形主格四面可通行：开启通行度也不该出现标记（对照组）
  it('编号 1 四面可通行', () => {
    const tile = findTile(buildDemoTileCatalog(), 1);
    const open = { up: true, right: true, down: true, left: true };

    expect(tile.pass.out).toEqual(open);
    expect(tile.pass.in).toEqual(open);
    expect(tile.pass.onlyEventLayer).toBe(false);
  });

  // 边界墙四面不可通行：小营地边框一圈会立刻出现四色箭头
  it('编号 2 四面都不可通行', () => {
    const tile = findTile(buildDemoTileCatalog(), 2);
    const blocked = { up: false, right: false, down: false, left: false };

    expect(tile.pass.out).toEqual(blocked);
    expect(tile.pass.in).toEqual(blocked);
  });

  // 点缀地形只有向右可通行：宽图 / 大地图上能同时看到两种方向
  it('编号 4 只有向右可通行', () => {
    const tile = findTile(buildDemoTileCatalog(), 4);
    const rightOnly = { up: false, right: true, down: false, left: false };

    expect(tile.pass.out).toEqual(rightOnly);
    expect(tile.pass.in).toEqual(rightOnly);
  });

  // 敌人四面不可通行
  it('编号 5 四面都不可通行', () => {
    const tile = findTile(buildDemoTileCatalog(), 5);
    const blocked = { up: false, right: false, down: false, left: false };

    expect(tile.pass.out).toEqual(blocked);
    expect(tile.pass.in).toEqual(blocked);
  });

  // 地图上真正出现过的编号在图块表里都写了 pass：不会被缺省值悄悄改成「全通」
  it('地图实际使用的编号都带显式 pass', () => {
    const entries = JSON.parse(DEMO_TILE_TABLE_TEXT) as readonly Record<string, unknown>[];
    const used = new Set<number>();

    for (const record of MAP_DEMO_MAPS) {
      for (const cells of Object.values(record.layers)) {
        for (const value of cells) used.add(value);
      }
    }

    used.delete(0);

    for (const number of used) {
      const entry = entries.find((candidate) => candidate.identifier === number);

      if (entry === undefined) throw new Error(`图块表缺少编号：${number}`);

      expect(entry.pass).toBeDefined();
    }
  });

  // 端到端纯函数断言：演示目录 + 只含编号 2 的 1×1 文档 → 一条四面 blocked 的标记
  // 这证明「演示数据 → 目录 → 标记」整条链路是通的，而不只是数据里多了个字段
  it('演示目录能把编号 2 算成四面 blocked 标记', () => {
    const groups = buildDemoTileCatalog();
    const document: IMapDocument = {
      id: 'pass-2',
      name: '通行度',
      width: 1,
      height: 1,
      layers: [{ id: 'layer-0', name: '地面层', zIndex: 0, isEventLayer: false, cells: [[2]] }],
      tileGroups: groups,
      cellWidth: 32,
      cellHeight: 32,
    };

    expect(computePassabilityMarks(document, 'layer-0', createTileIndex(groups))).toEqual([
      { x: 0, y: 0, blocked: { up: true, right: true, down: true, left: true }, dot: false },
    ]);
  });
});

describe('开发宿主演示地图记录', () => {
  // 演示项目里有一张真正的 256×256 地图，图层长度是 65536
  it('存在 256×256 地图且图层长度完整', () => {
    const record = findRecord('huge');
    const document = toMapDocument(record, []);

    expect(record.width).toBe(256);
    expect(record.layers[0]).toHaveLength(65536);
    expect(document.width).toBe(256);
    expect(document.height).toBe(256);
  });

  // 细节图是 48×48 格，图上同时有大素材（20 / 21）与小素材（30..37）
  it('细节图是 48×48 格且含大 / 小素材', () => {
    const record = findRecord('detail');
    const cells = record.layers[0];

    expect(record.cellWidth).toBe(48);
    expect(record.cellHeight).toBe(48);
    expect(record.width).toBe(16);
    expect(record.layers[0]).toHaveLength(16 * 14);

    expect(cells[1 * 16 + 1]).toBe(20);
    expect(cells[1 * 16 + 2]).toBe(21);

    for (let x = 1; x <= 8; x += 1) expect(cells[3 * 16 + x]).toBe(29 + x);
  });

  // 小营地第 0 层直接放着 4 帧动画与两种自动元件的成片区域
  it('小营地第 0 层含动画与两种自动元件', () => {
    const record = findRecord('small');
    const cells = record.layers[0];

    expect(cells[1 * 8 + 1]).toBe(10);
    expect(cells[4 * 8 + 6]).toBe(10);

    for (const [x, y] of [
      [4, 2],
      [5, 2],
      [6, 2],
      [4, 3],
      [5, 3],
      [6, 3],
    ]) {
      expect(cells[y * 8 + x]).toBe(90);
    }

    for (const [x, y] of [
      [1, 2],
      [2, 2],
      [1, 3],
      [2, 3],
    ]) {
      expect(cells[y * 8 + x]).toBe(91);
    }
  });
});
