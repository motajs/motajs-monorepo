import { EditorCore } from '@motajs/editor-core';
import { readImageDimensions } from '@motajs/editor-impl/asset';
import { IMapTileGroup, MapAutotileType, MapTextureReadType, MapTileCategory } from '@motajs/editor-impl/map';
import { describe, expect, it } from 'vitest';
import { MemoryBackend } from '../backend/memoryBackend';
import {
  buildDemoTileCatalog,
  DEMO_TEXTURE_LIST_TEXT,
  DEMO_TILE_TABLE_TEXT,
  encodeDemoAnimateAtlas,
  encodeDemoAutotileBigAtlas,
  encodeDemoAutotileSmallAtlas,
  encodeDemoLargeTileAtlas,
  encodeDemoSmallTileAtlas,
  encodeDemoTileAtlas,
  encodeDemoTilesetAtlas,
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
  [AUTOTILE_BIG_PATH, 192, 128],
  [AUTOTILE_SMALL_PATH, 128, 96],
  [TILESET_PATH, 128, 64],
  [LARGE_PATH, 192, 64],
  [SMALL_PATH, 64, 32],
];

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

describe('开发宿主演示图集与图块目录', () => {
  // 七张图集都是真实 PNG，尺寸与用途一一对应
  it('七张图集尺寸与用途对应', () => {
    expect(readImageDimensions(encodeDemoTileAtlas())).toEqual({ width: 128, height: 64 });
    expect(readImageDimensions(encodeDemoAnimateAtlas())).toEqual({ width: 128, height: 32 });
    expect(readImageDimensions(encodeDemoAutotileBigAtlas())).toEqual({ width: 192, height: 128 });
    expect(readImageDimensions(encodeDemoAutotileSmallAtlas())).toEqual({ width: 128, height: 96 });
    expect(readImageDimensions(encodeDemoTilesetAtlas())).toEqual({ width: 128, height: 64 });
    expect(readImageDimensions(encodeDemoLargeTileAtlas())).toEqual({ width: 192, height: 64 });
    expect(readImageDimensions(encodeDemoSmallTileAtlas())).toEqual({ width: 64, height: 32 });
  });

  // 目录里每个图块的裁切都落在对应图片内
  it('所有图块的裁切都在图内', () => {
    const groups = buildDemoTileCatalog();
    const sizes = new Map<string, { readonly width: number; readonly height: number }>();

    for (const [path, width, height] of ATLAS_SIZES) sizes.set(path, { width, height });

    for (const group of groups) {
      const size = sizes.get(group.imagePath);

      if (size === undefined) throw new Error(`未知图集：${group.imagePath}`);

      for (const tile of group.tiles) {
        expect(tile.crop.x).toBeGreaterThanOrEqual(0);
        expect(tile.crop.y).toBeGreaterThanOrEqual(0);
        expect(tile.crop.x + tile.crop.width).toBeLessThanOrEqual(size.width);
        expect(tile.crop.y + tile.crop.height).toBeLessThanOrEqual(size.height);
        expect(tile.crop.x).toBe(tile.column * (group.cellWidth ?? 32));
        expect(tile.crop.y).toBe(tile.row * (group.cellHeight ?? 32));
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

  // 两种自动元件各 1 个图块、2 帧、read 为 Grid
  it('两种自动元件都是单格 2 帧且 read 为 Grid', () => {
    const groups = buildDemoTileCatalog();
    const big = findGroup(groups, AUTOTILE_BIG_PATH, MapTileCategory.Autotile);
    const small = findGroup(groups, AUTOTILE_SMALL_PATH, MapTileCategory.Autotile);

    expect(big.read).toBe(MapTextureReadType.Grid);
    expect(big.frames).toBe(2);
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
    expect(entry.crop).toEqual({ x: 32, y: 32, width: 32, height: 32 });
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
    expect(plain.recentTilesPath).toBeUndefined();
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
