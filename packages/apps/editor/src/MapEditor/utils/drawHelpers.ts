/**
 * 地图编辑器绘图辅助函数
 */

import type { LocPOD } from "@/utils/coordinate";
import { TILE_SIZE } from "./coordinate";

/**
 * 绘制箭头
 *
 * @param ctx - Canvas 2D 上下文
 * @param fromX - 起点 X
 * @param fromY - 起点 Y
 * @param toX - 终点 X
 * @param toY - 终点 Y
 * @param color - 箭头颜色
 * @param lineWidth - 线宽
 */
export function drawArrow(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  color: string = "#FF0000",
  lineWidth: number = 2
): void {
  const headLength = 10;
  const angle = Math.atan2(toY - fromY, toX - fromX);

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.lineTo(
    toX - headLength * Math.cos(angle - Math.PI / 6),
    toY - headLength * Math.sin(angle - Math.PI / 6)
  );
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - headLength * Math.cos(angle + Math.PI / 6),
    toY - headLength * Math.sin(angle + Math.PI / 6)
  );
  ctx.stroke();
}

/**
 * 绘制选区矩形
 *
 * @param ctx - Canvas 2D 上下文
 * @param startPos - 起点格子位置
 * @param endPos - 终点格子位置
 * @param offset - 视口偏移
 * @param color - 填充颜色
 */
export function drawSelectionRect(
  ctx: CanvasRenderingContext2D,
  startPos: LocPOD,
  endPos: LocPOD,
  offset: LocPOD = [0, 0],
  color: string = "rgba(0, 127, 255, 0.4)"
): void {
  let [x0, y0] = startPos;
  let [x1, y1] = endPos;

  // 确保 x0 <= x1, y0 <= y1
  if (x0 > x1) [x0, x1] = [x1, x0];
  if (y0 > y1) [y0, y1] = [y1, y0];

  const [ox, oy] = offset;

  ctx.fillStyle = color;
  ctx.fillRect(
    x0 * TILE_SIZE - ox,
    y0 * TILE_SIZE - oy,
    (x1 - x0 + 1) * TILE_SIZE,
    (y1 - y0 + 1) * TILE_SIZE
  );
}

/**
 * 绘制路径点标记
 *
 * @param ctx - Canvas 2D 上下文
 * @param pos - 格子位置
 * @param offset - 视口偏移
 */
export function fillPathPoint(
  ctx: CanvasRenderingContext2D,
  pos: LocPOD,
  offset: LocPOD = [0, 0]
): void {
  // 随机颜色
  const r = Math.floor(Math.random() * 8);
  const g = Math.floor(Math.random() * 8);
  const b = Math.floor(Math.random() * 8);
  ctx.fillStyle = `#${r}${g}${b}`;

  const [ox, oy] = offset;
  const x = pos[0] * TILE_SIZE - ox;
  const y = pos[1] * TILE_SIZE - oy;

  ctx.fillRect(
    x + (TILE_SIZE * 3) / 8,
    y + (TILE_SIZE * 3) / 8,
    TILE_SIZE / 4,
    TILE_SIZE / 4
  );
}

/**
 * 大地图模式下绘制选区矩形
 */
export function drawSelectionRectBigmap(
  ctx: CanvasRenderingContext2D,
  startPos: LocPOD,
  endPos: LocPOD,
  bigmapInfo: { top: number; left: number; size: number },
  color: string = "rgba(0, 127, 255, 0.4)"
): void {
  let [x0, y0] = startPos;
  let [x1, y1] = endPos;

  if (x0 > x1) [x0, x1] = [x1, x0];
  if (y0 > y1) [y0, y1] = [y1, y0];

  const { top, left, size } = bigmapInfo;

  ctx.fillStyle = color;
  ctx.fillRect(
    left + x0 * size,
    top + y0 * size,
    (x1 - x0 + 1) * size,
    (y1 - y0 + 1) * size
  );
}
