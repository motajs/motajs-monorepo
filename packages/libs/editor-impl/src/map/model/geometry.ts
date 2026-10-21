import { IMapCellPosition, IMapRect } from '../types';

// 格子几何：正交路径、矩形展开、矩形归一化与按地图尺寸裁剪。
// 全部是纯计算，不读文档、不碰渲染；越界裁剪是后面每条写入路径共用的唯一护栏。

export interface IMapClampResult {
  /** 裁剪后的矩形；完全落在地图外时宽高都是 0 */
  readonly rect: IMapRect;
  /** 被裁掉的格子数 */
  readonly clipped: number;
}

/**
 * 把一个可能为负或超界的坐标夹到地图范围内，用于「完全在外」时给出矩形位置
 * @param value 原始坐标
 * @param limit 地图宽或高
 * @returns 夹取到 0..limit 之间的坐标
 */
function clampIndex(value: number, limit: number): number {
  return Math.min(Math.max(value, 0), Math.max(limit, 0));
}

/**
 * 把任意两个角点整理成左上角 + 宽高，宽高按「包含两端」计算
 * @param a 第一个角点
 * @param b 第二个角点
 * @returns 左上角在 (min x, min y)、宽高至少为 1 的矩形
 */
export function normalizeRect(a: IMapCellPosition, b: IMapCellPosition): IMapRect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x) + 1,
    height: Math.abs(a.y - b.y) + 1,
  };
}

/**
 * 算出从起点之后到终点的逐格正交路径：每一步只沿一个轴移动一格，斜向拖动不会留下断点
 *
 * 轴向选择与旧编辑器一致：先走差值大的那个轴；两个轴差值相等时先走横轴。
 * @param from 起点（不包含在结果里）
 * @param to 终点（包含在结果里）
 * @returns 按移动顺序排列的格子；起点与终点相同时为空数组
 */
export function walkOrthogonalPath(from: IMapCellPosition, to: IMapCellPosition): IMapCellPosition[] {
  const path: IMapCellPosition[] = [];
  let x = from.x;
  let y = from.y;

  while (x !== to.x || y !== to.y) {
    const dx = to.x - x;
    const dy = to.y - y;

    if (Math.abs(dx) >= Math.abs(dy)) x += Math.sign(dx);
    else y += Math.sign(dy);

    path.push({ x, y });
  }

  return path;
}

/**
 * 展开一个矩形覆盖的全部格子，行优先
 * @param from 第一个角点（含）
 * @param to 第二个角点（含）
 * @returns 行主序排列的格子；两个角点相同时只含一格
 */
export function rectanglePositions(from: IMapCellPosition, to: IMapCellPosition): IMapCellPosition[] {
  const rect = normalizeRect(from, to);
  const positions: IMapCellPosition[] = [];

  for (let y = rect.y; y < rect.y + rect.height; y += 1) {
    for (let x = rect.x; x < rect.x + rect.width; x += 1) positions.push({ x, y });
  }

  return positions;
}

/**
 * 把矩形裁到地图范围内，并统计被裁掉的格子数
 *
 * 坐标为负、宽高越过地图边界都只做裁剪，不抛错；完全在地图外时返回宽高为 0 的空矩形。
 * @param rect 待裁剪的矩形
 * @param width 地图宽度（格子数）
 * @param height 地图高度（格子数）
 * @returns 裁剪后的矩形与被裁掉的格子数
 */
export function clampRectToMap(rect: IMapRect, width: number, height: number): IMapClampResult {
  const emptyRect: IMapRect = { x: clampIndex(rect.x, width), y: clampIndex(rect.y, height), width: 0, height: 0 };

  if (rect.width <= 0 || rect.height <= 0) return { rect: emptyRect, clipped: 0 };

  const left = Math.max(0, rect.x);
  const top = Math.max(0, rect.y);
  const right = Math.min(width, rect.x + rect.width);
  const bottom = Math.min(height, rect.y + rect.height);
  const keptWidth = Math.max(0, right - left);
  const keptHeight = Math.max(0, bottom - top);
  const total = rect.width * rect.height;
  const kept = keptWidth * keptHeight;

  if (kept === 0) return { rect: emptyRect, clipped: total };

  return { rect: { x: left, y: top, width: keptWidth, height: keptHeight }, clipped: total - kept };
}
