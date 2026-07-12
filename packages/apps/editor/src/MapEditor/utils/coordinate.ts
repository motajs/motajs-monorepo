/**
 * 地图编辑器坐标转换工具
 *
 * 基于 @/utils/coordinate 封装的编辑器专用坐标转换
 */

import { Grid, type LocPOD, type GridPOD } from "@/utils/coordinate";

/** 默认格子大小 */
export const DEFAULT_GRID: GridPOD = [32, 32];

/** Canvas 尺寸常量 */
export const CANVAS_SIZE = 416;
export const TILE_SIZE = 32;
export const GRID_COUNT = 13;

/**
 * 鼠标事件 -> 组件内像素坐标
 *
 * @param e - 鼠标事件
 * @param container - 容器元素
 * @returns 像素坐标 [x, y]
 */
export function eToLoc(
  e: MouseEvent | React.MouseEvent,
  container: HTMLElement
): LocPOD {
  const rect = container.getBoundingClientRect();
  return [e.clientX - rect.left, e.clientY - rect.top];
}

/**
 * 像素坐标 -> 地图格子位置
 *
 * @param loc - 像素坐标
 * @param offset - 视口偏移
 * @param grid - 格子大小，默认 [32, 32]
 * @returns 格子位置 [x, y]
 */
export function locToPos(
  loc: LocPOD,
  offset: LocPOD = [0, 0],
  grid: GridPOD = DEFAULT_GRID
): LocPOD {
  const [px, py] = loc;
  const [ox, oy] = offset;
  return Grid.unmapLoc([px + ox, py + oy], grid);
}

/**
 * 格子位置 -> 绘图像素坐标
 *
 * @param pos - 格子位置
 * @param offset - 视口偏移
 * @param grid - 格子大小，默认 [32, 32]
 * @returns 像素坐标 [x, y]
 */
export function posToDrawLoc(
  pos: LocPOD,
  offset: LocPOD = [0, 0],
  grid: GridPOD = DEFAULT_GRID
): LocPOD {
  const [x, y] = Grid.mapLoc(pos, grid);
  const [ox, oy] = offset;
  return [x - ox, y - oy];
}

/**
 * 大地图模式下的格子位置 -> 绘图像素坐标
 *
 * @param pos - 格子位置
 * @param bigmapInfo - 大地图信息 { top, left, size }
 * @returns 像素坐标 [x, y]
 */
export function posToDrawLocBigmap(
  pos: LocPOD,
  bigmapInfo: { top: number; left: number; size: number }
): LocPOD {
  const { top, left, size } = bigmapInfo;
  return [left + pos[0] * size, top + pos[1] * size];
}

/**
 * 大地图模式下的像素坐标 -> 格子位置
 *
 * @param loc - 像素坐标
 * @param bigmapInfo - 大地图信息 { top, left, size }
 * @param floorWidth - 楼层宽度
 * @param floorHeight - 楼层高度
 * @returns 格子位置 [x, y]
 */
export function locToPosBigmap(
  loc: LocPOD,
  bigmapInfo: { top: number; left: number; size: number },
  floorWidth: number,
  floorHeight: number
): LocPOD {
  const { top, left, size } = bigmapInfo;
  const x = Math.max(0, Math.min(Math.floor((loc[0] - left) / size), floorWidth - 1));
  const y = Math.max(0, Math.min(Math.floor((loc[1] - top) / size), floorHeight - 1));
  return [x, y];
}

/**
 * 限制坐标在边界内
 *
 * @param pos - 格子位置
 * @param width - 地图宽度
 * @param height - 地图高度
 * @returns 限制后的格子位置
 */
export function clampPos(pos: LocPOD, width: number, height: number): LocPOD {
  return [
    Math.max(0, Math.min(pos[0], width - 1)),
    Math.max(0, Math.min(pos[1], height - 1)),
  ];
}

/**
 * 检查两个位置是否相同
 */
export function isSamePos(a: LocPOD | null, b: LocPOD | null): boolean {
  if (a === null || b === null) return a === b;
  return a[0] === b[0] && a[1] === b[1];
}

/**
 * 格式化坐标为字符串
 */
export function formatLoc(pos: LocPOD): string {
  return `${pos[0]},${pos[1]}`;
}
