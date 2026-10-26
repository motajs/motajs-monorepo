import { describe, expect, it } from 'vitest';
import { resolveGroupAtlasRect } from '../model/tileAtlas';
import { IMapTileEntry, IMapTileGroup, MapAutotileType, MapTextureReadType, MapTileCategory } from '../types';

// 图集真实像素尺寸的纯函数测试：七种布局各自的宽高，外加格尺寸 / 帧数 / 列数的非法值夹取。
// 全部断言具体像素（不 snapshot）：这些数字决定缩略图里到底露出几个源格。

/**
 * 造一个只带编号与行列的图块条目
 * @param column 图集列号
 * @param row 图集行号
 * @returns 图块条目
 */
function createEntry(column: number, row: number): IMapTileEntry {
  return {
    number: row * 10 + column + 1,
    column,
    row,
    name: '图块',
    pass: {
      out: { up: true, right: true, down: true, left: true },
      in: { up: true, right: true, down: true, left: true },
      onlyEventLayer: false,
    },
  };
}

/**
 * 造一个可覆盖任意字段的素材组：默认两列、只有一行两格、32×32、普通网格
 * @param overrides 覆盖的素材组字段
 * @returns 合法的素材组
 */
function createAtlasGroup(overrides: Partial<IMapTileGroup> = {}): IMapTileGroup {
  return {
    id: 'group-atlas',
    name: '图集分组',
    imagePath: 'content/map/atlas.png',
    columns: 2,
    tiles: [createEntry(0, 0), createEntry(1, 0)],
    category: MapTileCategory.Terrain,
    read: MapTextureReadType.Grid,
    cellWidth: 32,
    cellHeight: 32,
    frames: 1,
    ...overrides,
  };
}

describe('resolveGroupAtlasRect 图集真实尺寸', () => {
  // Tileset：用自身行列与自身分格尺寸，不受目录列数影响
  it('Tileset 用自身行列（3×2、48×48 → 144×96）', () => {
    const group = createAtlasGroup({
      cellWidth: 48,
      cellHeight: 48,
      tileset: { cellWidth: 48, cellHeight: 48, columns: 3, rows: 2 },
    });

    expect(resolveGroupAtlasRect(group)).toEqual({ x: 0, y: 0, width: 144, height: 96 });
  });

  // 自动元件四帧：宽 = 整块宽（3 格 × 32）× 帧数，高 = 整块高（4 格 × 32），高度不乘帧数
  it('Big3x4 四帧 32×32 → 384×128（高度不乘帧数）', () => {
    const group = createAtlasGroup({
      frames: 4,
      autotile: { type: MapAutotileType.Big3x4, connections: [] },
    });

    expect(resolveGroupAtlasRect(group)).toEqual({ x: 0, y: 0, width: 384, height: 128 });
  });

  // 自动元件单帧：帧数为 1 时宽度就是整块宽，高度仍是整块高
  it('Big3x4 单帧 32×32 → 96×128', () => {
    const group = createAtlasGroup({
      frames: 1,
      autotile: { type: MapAutotileType.Big3x4, connections: [] },
    });

    expect(resolveGroupAtlasRect(group)).toEqual({ x: 0, y: 0, width: 96, height: 128 });
  });

  // 2×3 自动元件：两帧时宽 = 2 格 × 32 × 2，高 = 3 格 × 32
  it('Small2x3 两帧 32×32 → 128×96', () => {
    const group = createAtlasGroup({
      frames: 2,
      autotile: { type: MapAutotileType.Small2x3, connections: [] },
    });

    expect(resolveGroupAtlasRect(group)).toEqual({ x: 0, y: 0, width: 128, height: 96 });
  });

  // 横向动画：帧沿横向排开，高度只有一格
  it('RowAnimate 四帧 32×32 → 128×32', () => {
    const group = createAtlasGroup({ read: MapTextureReadType.RowAnimate, frames: 4 });

    expect(resolveGroupAtlasRect(group)).toEqual({ x: 0, y: 0, width: 128, height: 32 });
  });

  // 纵向动画：帧沿纵向排开，宽度只有一格
  it('ColumnAnimate 四帧 32×32 → 32×128', () => {
    const group = createAtlasGroup({ read: MapTextureReadType.ColumnAnimate, frames: 4 });

    expect(resolveGroupAtlasRect(group)).toEqual({ x: 0, y: 0, width: 32, height: 128 });
  });

  // 扫描动画：7 帧 3 列需要折成 3 行
  it('ScanAnimate 7 帧 3 列 32×32 → 96×96', () => {
    const group = createAtlasGroup({ read: MapTextureReadType.ScanAnimate, columns: 3, frames: 7 });

    expect(resolveGroupAtlasRect(group)).toEqual({ x: 0, y: 0, width: 96, height: 96 });
  });

  // 普通网格：宽按目录列数，高按目录里最大的行号 + 1
  it('Grid 两列两行 32×32 → 64×64', () => {
    const group = createAtlasGroup({
      tiles: [createEntry(0, 0), createEntry(1, 0), createEntry(0, 1), createEntry(1, 1)],
    });

    expect(resolveGroupAtlasRect(group)).toEqual({ x: 0, y: 0, width: 64, height: 64 });
  });

  // 普通网格只有一个 (0,0) 条目：高度就是一格，不按目录列数虚构行
  it('Grid 只有 (0,0) 一条 16×16 → 16×16', () => {
    const group = createAtlasGroup({ columns: 1, cellWidth: 16, cellHeight: 16, tiles: [createEntry(0, 0)] });

    expect(resolveGroupAtlasRect(group)).toEqual({ x: 0, y: 0, width: 16, height: 16 });
  });

  // 整图一格：素材格尺寸就是整张源图尺寸
  it('Full 96×64 → 96×64', () => {
    const group = createAtlasGroup({ read: MapTextureReadType.Full, cellWidth: 96, cellHeight: 64 });

    expect(resolveGroupAtlasRect(group)).toEqual({ x: 0, y: 0, width: 96, height: 64 });
  });

  // 非法格宽（0 / NaN）退回 32：宽度按两列 × 32 而不是 0 或 NaN
  it('非法 cellWidth 退回 32', () => {
    expect(resolveGroupAtlasRect(createAtlasGroup({ cellWidth: 0 })).width).toBe(64);
    expect(resolveGroupAtlasRect(createAtlasGroup({ cellWidth: Number.NaN })).width).toBe(64);
  });

  // 帧数 0 或负数按 1 帧处理
  it('frames 为 0 或负数按 1 处理', () => {
    const zero = createAtlasGroup({ read: MapTextureReadType.RowAnimate, frames: 0 });
    const negative = createAtlasGroup({ read: MapTextureReadType.RowAnimate, frames: -3 });

    expect(resolveGroupAtlasRect(zero).width).toBe(32);
    expect(resolveGroupAtlasRect(negative).width).toBe(32);
  });
});
