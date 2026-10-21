import { IMapBrushPattern, IMapCellPosition, IMapRect } from '../types';
import { IPaintWrite } from './document';

// 多格笔刷：把图案按「指针格 = 图案左上角」盖到地图上，矩形与填充按图案宽高平铺。
// 这四个函数只产出 IPaintWrite[]，不读文档、不做裁剪；越界交给 clampRectToMap 与调用方。

/**
 * 取模并把负数结果折回非负，用于平铺时算图案内的相位
 * @param value 可能为负的偏移
 * @param size 模数（图案宽或高）
 * @returns 落在 0..size-1 的相位
 */
function wrapIndex(value: number, size: number): number {
  const remainder = value % size;
  return remainder < 0 ? remainder + size : remainder;
}

/**
 * 按行主序取图案内某一格的编号；空图案、越出图案范围与组内缺格都按 0 处理
 * @param pattern 笔刷图案
 * @param column 图案内的列号（从 0 开始）
 * @param row 图案内的行号（从 0 开始）
 * @returns 该格应写入的图块编号；没有内容时为 0
 */
function patternTileAt(pattern: IMapBrushPattern, column: number, row: number): number {
  if (pattern.width <= 0 || pattern.height <= 0) return 0;
  if (column < 0 || row < 0 || column >= pattern.width || row >= pattern.height) return 0;

  return pattern.tiles[row * pattern.width + column] ?? 0;
}

/**
 * 以 anchor 为图案左上角，取地图上某一格应写入的编号
 *
 * 相位按图案宽高取模，因此同一图案可以平铺到任意大的区域；空图案一律返回 0。
 * @param pattern 笔刷图案
 * @param anchor 图案左上角所在的格子
 * @param position 要取编号的格子
 * @returns 该格应写入的图块编号
 */
export function tileNumberAt(pattern: IMapBrushPattern, anchor: IMapCellPosition, position: IMapCellPosition): number {
  if (pattern.width <= 0 || pattern.height <= 0) return 0;

  return patternTileAt(
    pattern,
    wrapIndex(position.x - anchor.x, pattern.width),
    wrapIndex(position.y - anchor.y, pattern.height),
  );
}

/**
 * 线笔刷：路径上每个格子都把图案左上角对齐到该格盖一次
 *
 * 相邻位置会重叠，重叠部分以数组里靠后的写入为准；返回的顺序即写入顺序。
 * @param positions 路径经过的格子（按移动顺序）
 * @param pattern 笔刷图案
 * @returns 依次要落下的写入
 */
export function buildStrokeWrites(
  positions: readonly IMapCellPosition[],
  pattern: IMapBrushPattern,
): readonly IPaintWrite[] {
  const writes: IPaintWrite[] = [];

  for (const position of positions) {
    for (let row = 0; row < pattern.height; row += 1) {
      for (let column = 0; column < pattern.width; column += 1) {
        writes.push({
          x: position.x + column,
          y: position.y + row,
          value: patternTileAt(pattern, column, row),
        });
      }
    }
  }

  return writes;
}

/**
 * 矩形笔刷：把图案在矩形内平铺，而不是把一个笔刷拉伸到整块
 * @param rect 要覆盖的矩形
 * @param pattern 笔刷图案
 * @param anchor 决定平铺相位的格子（通常是矩形第一个角点）
 * @returns 行主序排列的写入
 */
export function buildRectWrites(
  rect: IMapRect,
  pattern: IMapBrushPattern,
  anchor: IMapCellPosition,
): readonly IPaintWrite[] {
  const writes: IPaintWrite[] = [];

  for (let y = rect.y; y < rect.y + rect.height; y += 1) {
    for (let x = rect.x; x < rect.x + rect.width; x += 1) {
      writes.push({ x, y, value: tileNumberAt(pattern, anchor, { x, y }) });
    }
  }

  return writes;
}

/**
 * 填充笔刷：在给定的连通区域上按图案平铺，锚点为点击格
 * @param positions 连通区域覆盖的格子
 * @param pattern 笔刷图案
 * @param anchor 决定平铺相位的格子（点击格）
 * @returns 按传入位置顺序排列的写入
 */
export function buildFillWrites(
  positions: readonly IMapCellPosition[],
  pattern: IMapBrushPattern,
  anchor: IMapCellPosition,
): readonly IPaintWrite[] {
  const writes: IPaintWrite[] = [];

  for (const position of positions) {
    writes.push({ x: position.x, y: position.y, value: tileNumberAt(pattern, anchor, position) });
  }

  return writes;
}
