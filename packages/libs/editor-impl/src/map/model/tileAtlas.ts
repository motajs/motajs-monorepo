import { MAP_CELL_SIZE, MAP_FRAME_LIMIT } from '../constants';
import { IMapTileCrop, IMapTileGroup, MapAutotileType, MapTextureReadType } from '../types';

// 图集真实像素尺寸：缩略图与素材格必须按整张图集的真实大小贴图，按钮里才只露出一个源格。
// 用「目录里出现过的最大行号」推高度会把只有一条目录项的自动元件压成一行（U-18 的根因），
// 所以自动元件按整块行数算高度、按整块列数 × 帧数算宽度；其余读取方式按各自的帧轴铺开。
// 普通网格与横向动画的高度必须取来源图片真实行数（宿主填的 `rows`）：按目录最大行号会把只收录
// 第 0 行的分类组压成一行，相邻行的图块就一起画进同一个格子（U-25）。

/**
 * 把素材格尺寸归一化成正整数，非法值退回默认边长
 * @param size 目录给出的素材格尺寸
 * @returns 可用的素材格尺寸（源图像素）
 */
function resolveCellSize(size: number): number {
  if (!Number.isFinite(size) || size <= 0) return MAP_CELL_SIZE;

  return Math.trunc(size);
}

/**
 * 把帧数夹到 1..`MAP_FRAME_LIMIT`
 * @param count 目录给出的帧数
 * @returns 可用的帧数；非法值按 1 处理
 */
function clampFrameCount(count: number): number {
  if (!Number.isFinite(count)) return 1;

  return Math.min(MAP_FRAME_LIMIT, Math.max(1, Math.trunc(count)));
}

/**
 * 把格数夹成至少 1 的正整数
 * @param count 目录给出的列数或行数
 * @returns 可用的格数；非法值按 1 处理
 */
function clampCount(count: number): number {
  if (!Number.isFinite(count) || count < 1) return 1;

  return Math.trunc(count);
}

/**
 * 取自动元件整块横向占几格
 * @param type 自动元件形状
 * @returns 3×4 为 3 格、2×3 为 2 格
 */
function autotileBlockColumns(type: MapAutotileType): number {
  return type === MapAutotileType.Big3x4 ? 3 : 2;
}

/**
 * 取自动元件整块纵向占几格
 * @param type 自动元件形状
 * @returns 3×4 为 4 格、2×3 为 3 格
 */
function autotileBlockRows(type: MapAutotileType): number {
  return type === MapAutotileType.Big3x4 ? 4 : 3;
}

/**
 * 数出普通网格图集至少要占几行：目录里所有图块的最大行号 + 1
 * @param group 素材组
 * @returns 行数；目录里没有图块时为 1
 */
function countGridRows(group: IMapTileGroup): number {
  let rows = 1;

  for (const tile of group.tiles) rows = Math.max(rows, tile.row + 1);

  return rows;
}

/**
 * 求整张图集实际占几行：优先用宿主填的来源图片真实行数，缺省或非法时退回给定口径
 * @param group 素材组（`rows` 是来源图片真实的图块行数）
 * @param fallback 没有真实行数时按什么口径推算
 * @returns 至少 1 的整数行数
 */
function resolveImageRows(group: IMapTileGroup, fallback: number): number {
  const rows = group.rows;

  if (rows === undefined || !Number.isFinite(rows) || rows < 1) return clampCount(fallback);

  return Math.trunc(rows);
}

/**
 * 求整张图集在源图上的像素矩形
 *
 * 顺序即优先级：Tileset 用自身行列；自动元件用「整块列数 × 帧数」乘「整块行数」（高度不乘帧数，
 * 因为它的帧只沿横向推进）；横向动画在帧那一侧变长、高度取来源图片真实行数；纵向动画在高度那一侧
 * 变长；扫描动画按列数折行；整图一格就是素材格尺寸；普通网格按来源图片真实行数算行数
 * （缺省才退回目录最大行号）。`x` / `y` 恒为 0：这里只回答「图集有多大」，贴哪一格由帧矩形决定。
 * @param group 素材组（提供读取方式、素材格尺寸、帧数、列数与自动拼接 / Tileset 元数据）
 * @returns 整张图集的源图矩形
 */
export function resolveGroupAtlasRect(group: IMapTileGroup): IMapTileCrop {
  const cellWidth = resolveCellSize(group.cellWidth);
  const cellHeight = resolveCellSize(group.cellHeight);
  const frames = clampFrameCount(group.frames);
  const columns = clampCount(group.columns);

  if (group.tileset !== undefined) {
    return {
      x: 0,
      y: 0,
      width: clampCount(group.tileset.columns) * cellWidth,
      height: clampCount(group.tileset.rows) * cellHeight,
    };
  }

  if (group.autotile !== undefined) {
    return {
      x: 0,
      y: 0,
      width: autotileBlockColumns(group.autotile.type) * cellWidth * frames,
      height: autotileBlockRows(group.autotile.type) * cellHeight,
    };
  }

  if (group.read === MapTextureReadType.RowAnimate) {
    return { x: 0, y: 0, width: cellWidth * frames, height: resolveImageRows(group, 1) * cellHeight };
  }

  if (group.read === MapTextureReadType.ColumnAnimate) {
    return { x: 0, y: 0, width: cellWidth, height: cellHeight * frames };
  }

  if (group.read === MapTextureReadType.ScanAnimate) {
    return { x: 0, y: 0, width: columns * cellWidth, height: Math.ceil(frames / columns) * cellHeight };
  }

  if (group.read === MapTextureReadType.Full) {
    return { x: 0, y: 0, width: cellWidth, height: cellHeight };
  }

  return {
    x: 0,
    y: 0,
    width: columns * cellWidth,
    height: resolveImageRows(group, countGridRows(group)) * cellHeight,
  };
}
