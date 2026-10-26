import { IMapCanvasBounds, IMapCellMetrics, IMapCellPosition, IMapRect, IMapViewport } from '../types';

// 格子度量的纯函数：contain 目标矩形、度量组装与指针换算。
// 这一层不 import React / Pixi / editor-core，也不读文件与图片；视图与画布共用同一份度量来源。

/**
 * 按 contain 规则把素材放进格子：大素材按比例缩小、小素材保持原尺寸，并在格内水平 / 垂直居中
 *
 * 缩放的唯一来源是格子尺寸与素材尺寸；素材尺寸非法（0、负数或非数）时退化为整格矩形，不抛错。
 * 普通模式仍然只缩不放（小素材保持原尺寸并居中）；只有 `allowUpscale` 为 true 时才允许把小于格子的素材放大到贴满格。
 * @param cellX 格子左上角的横坐标（像素）
 * @param cellY 格子左上角的纵坐标（像素）
 * @param cellWidth 格子的像素宽
 * @param cellHeight 格子的像素高
 * @param srcWidth 素材的源像素宽
 * @param srcHeight 素材的源像素高
 * @param allowUpscale 为 true 时允许把小于格子的素材放大到贴满格；只给大地图缩略用，普通模式必须保持 false
 * @returns 素材在画布上的目标矩形
 */
export function resolveTileDest(
  cellX: number,
  cellY: number,
  cellWidth: number,
  cellHeight: number,
  srcWidth: number,
  srcHeight: number,
  allowUpscale: boolean = false,
): IMapRect {
  if (!(srcWidth > 0) || !(srcHeight > 0)) return { x: cellX, y: cellY, width: cellWidth, height: cellHeight };

  const scale = allowUpscale
    ? Math.min(cellWidth / srcWidth, cellHeight / srcHeight)
    : Math.min(1, cellWidth / srcWidth, cellHeight / srcHeight);

  if (!(scale > 0)) return { x: cellX, y: cellY, width: cellWidth, height: cellHeight };

  const width = srcWidth * scale;
  const height = srcHeight * scale;

  return { x: cellX + (cellWidth - width) / 2, y: cellY + (cellHeight - height) / 2, width, height };
}

/**
 * 组装一份格子度量：格宽 / 格高（已含缩放）与第一格左上角原点
 * @param cellWidth 一格的像素宽
 * @param cellHeight 一格的像素高
 * @param left 第一格左上角的横向原点（像素）
 * @param top 第一格左上角的纵向原点（像素）
 * @returns 格子度量
 */
export function resolveCellMetrics(cellWidth: number, cellHeight: number, left: number, top: number): IMapCellMetrics {
  return { cellWidth, cellHeight, left, top };
}

/**
 * 把整条路径的格子换算成画布像素矩形
 *
 * 普通模式由本函数把文档坐标减去 `viewport` 再乘格尺寸；画布只负责把矩形画成描边 + 填充。
 * 越界格照样输出（由画布裁剪），`cells` 为空时返回空数组。
 * @param cells 路径覆盖的格子
 * @param viewport 视口左上角所在的格子坐标
 * @param cellWidth 一格的像素宽
 * @param cellHeight 一格的像素高
 * @returns 每个格子的画布像素矩形，顺序与入参一致
 */
export function resolvePreviewCellRects(
  cells: readonly IMapCellPosition[],
  viewport: IMapViewport,
  cellWidth: number,
  cellHeight: number,
): readonly IMapRect[] {
  return cells.map((cell) => ({
    x: (cell.x - viewport.left) * cellWidth,
    y: (cell.y - viewport.top) * cellHeight,
    width: cellWidth,
    height: cellHeight,
  }));
}

/**
 * 把指针位置换算成格子坐标：同时扣掉画布容器原点与第一格留白原点，再叠加视口
 *
 * 视口由调用方按模式选择（普通模式传面板视口，大地图模式传零视口），本函数本身不判断模式。
 * 换算结果可能为负或越界，夹取由调用方负责；格尺寸非法时退回视口原点。
 * @param clientX 指针在视口中的横坐标
 * @param clientY 指针在视口中的纵坐标
 * @param bounds 画布容器左上角在视口中的位置
 * @param metrics 格宽 / 格高与第一格原点
 * @param viewport 视口左上角所在的格子坐标
 * @returns 指针所在的格子坐标
 */
export function resolvePointerCell(
  clientX: number,
  clientY: number,
  bounds: IMapCanvasBounds,
  metrics: IMapCellMetrics,
  viewport: IMapViewport,
): IMapCellPosition {
  if (!(metrics.cellWidth > 0) || !(metrics.cellHeight > 0)) return { x: viewport.left, y: viewport.top };

  const x = Math.floor((clientX - bounds.left - metrics.left) / metrics.cellWidth) + viewport.left;
  const y = Math.floor((clientY - bounds.top - metrics.top) / metrics.cellHeight) + viewport.top;

  return { x, y };
}
