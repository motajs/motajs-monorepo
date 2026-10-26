import { describe, expect, it } from 'vitest';
import { resolveTileBackgroundStyle } from '../components/tileBackgroundStyle';
import {
  IMapTileCrop,
  IMapTileEntry,
  IMapTileGroup,
  MapAutotileType,
  MapTextureReadType,
  MapTileCategory,
} from '../types';

// 背景样式纯函数测试：一个源格贴进 32px 按钮时的缩放倍数与居中偏移。
// 四种源格比例（32×32 / 16×16 / 96×64 / 64×96）都断言具体像素，确保矩形格缩完仍是矩形。

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

/**
 * 造一个源图矩形
 * @param x 左边界
 * @param y 上边界
 * @param width 宽
 * @param height 高
 * @returns 源图矩形
 */
function createRect(x: number, y: number, width: number, height: number): IMapTileCrop {
  return { x, y, width, height };
}

describe('resolveTileBackgroundStyle 等比贴一个源格', () => {
  // 32×32 源格在 32px 按钮里原样显示：图集 64×32，第二格负偏移一格
  it('32×32 源格不缩放且第二格负偏移', () => {
    const style = resolveTileBackgroundStyle('blob:atlas', createAtlasGroup(), createRect(32, 0, 32, 32), 32);

    expect(style.backgroundSize).toBe('64px 32px');
    expect(style.backgroundPosition).toBe('-32px 0px');
  });

  // 16×16 源格放大 2 倍填满按钮
  it('16×16 源格放大 2 倍', () => {
    const group = createAtlasGroup({ cellWidth: 16, cellHeight: 16 });
    const style = resolveTileBackgroundStyle('blob:atlas', group, createRect(16, 0, 16, 16), 32);

    expect(style.backgroundSize).toBe('64px 32px');
    expect(style.backgroundPosition).toBe('-32px 0px');
  });

  // 96×64 源格等比缩到 32 宽、21.33 高，纵向居中留 5.33；宽高比不变成 1:1
  it('96×64 源格等比缩小并纵向居中', () => {
    const group = createAtlasGroup({ cellWidth: 96, cellHeight: 64 });
    const style = resolveTileBackgroundStyle('blob:atlas', group, createRect(0, 0, 96, 64), 32);

    expect(style.backgroundSize).toBe('64px 21.33px');
    expect(style.backgroundPosition).toBe('0px 5.33px');
  });

  // 64×96 源格（自动元件 Big3x4 两帧，图集 384×384）等比缩到 21.33 宽、32 高，横向居中留 5.33
  it('64×96 自动元件源格横向居中', () => {
    const group = createAtlasGroup({
      cellWidth: 64,
      cellHeight: 96,
      frames: 2,
      autotile: { type: MapAutotileType.Big3x4, connections: [] },
    });
    const style = resolveTileBackgroundStyle('blob:atlas', group, createRect(0, 0, 64, 96), 32);

    expect(style.backgroundSize).toBe('128px 128px');
    expect(style.backgroundPosition).toBe('5.33px 0px');
  });

  // 源格宽或高为 0 时不抛错，退回 1 倍（图集 64×32 原尺寸，横向居中 16）
  it('源格尺寸为 0 时退回 1 倍', () => {
    const style = resolveTileBackgroundStyle('blob:atlas', createAtlasGroup(), createRect(0, 0, 0, 32), 32);

    expect(style.backgroundSize).toBe('64px 32px');
    expect(style.backgroundPosition).toBe('16px 0px');
  });

  // 素材框是直角
  it('返回直角与背景图', () => {
    const style = resolveTileBackgroundStyle('blob:atlas', createAtlasGroup(), createRect(0, 0, 32, 32), 32);

    expect(style.borderRadius).toBe(0);
    expect(style.backgroundImage).toBe('url("blob:atlas")');
  });
});
