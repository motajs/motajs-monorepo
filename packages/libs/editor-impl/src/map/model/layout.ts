import {
  MAP_CELL_SIZE,
  MAP_PALETTE_BASE_WIDTH,
  MAP_PALETTE_MAX_WIDTH,
  MAP_PALETTE_MIN_WIDTH,
  MAP_VIEWPORT_DEFAULT_COLUMNS,
  MAP_VIEWPORT_DEFAULT_ROWS,
  MAP_ZOOM_DEFAULT,
  MAP_ZOOM_MAX,
  MAP_ZOOM_MIN,
} from '../constants';
import { IMapDocument, IMapLayout, IMapLayoutOptions } from '../types';

// 布局的纯函数：把「文档格尺寸 + 缩放 + 视口格数」算成格像素、画布像素与右栏宽度。
// 这一层不 import React / Pixi / editor-core，也不读 window / document 全局；视图层只照结果摆位置。

/**
 * 取一份正的数值；缺省或非法时回退到给定默认值
 * @param value 宿主给出的数值
 * @param fallback 非法时使用的默认值
 * @returns 可参与运算的数值
 */
function resolvePositive(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return fallback;
  return value;
}

/**
 * 把缩放夹到 `MAP_ZOOM_MIN`..`MAP_ZOOM_MAX`；非数时回退到默认缩放
 * @param zoom 宿主或滑块给出的缩放倍率
 * @returns 夹取后的缩放倍率
 */
function clampZoom(zoom: number): number {
  if (typeof zoom !== 'number' || !Number.isFinite(zoom)) return MAP_ZOOM_DEFAULT;
  return Math.min(MAP_ZOOM_MAX, Math.max(MAP_ZOOM_MIN, zoom));
}

/**
 * 取一个视口格数；缺省、非正整数时回退到默认格数
 * @param value 宿主注入的视口格数
 * @param fallback 非法时使用的默认格数
 * @returns 可参与运算的视口格数
 */
function resolveViewportCount(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) return fallback;
  return value;
}

/**
 * 把文档格尺寸、缩放与视口格数算成画布像素、格像素与右栏宽度
 *
 * 格像素 = 文档格尺寸 × 缩放（与渲染模型同一个 `zoom`，两边得到同一个格像素）；
 * 视口格数缺省取 `MAP_VIEWPORT_DEFAULT_COLUMNS` / `MAP_VIEWPORT_DEFAULT_ROWS`，非法时同样回退；
 * 右栏宽度 = `clamp(round(基准宽度 / 缩放), 最小, 最大)`，保证素材区永远不会被挤到不可用。
 * 本函数只吃入参：不读取窗口宽度，也不做任何 DOM 测量。
 * @param document 中立文档（只用 cellWidth / cellHeight）
 * @param options 缩放倍率与可选的视口格数、右栏基准宽度
 * @returns 视口格数、格像素、画布像素与右栏宽度
 */
export function resolveMapLayout(document: IMapDocument, options: IMapLayoutOptions): IMapLayout {
  const zoom = clampZoom(options.zoom);
  const viewportColumns = resolveViewportCount(options.viewportColumns, MAP_VIEWPORT_DEFAULT_COLUMNS);
  const viewportRows = resolveViewportCount(options.viewportRows, MAP_VIEWPORT_DEFAULT_ROWS);
  const cellWidth = resolvePositive(document.cellWidth, MAP_CELL_SIZE) * zoom;
  const cellHeight = resolvePositive(document.cellHeight, MAP_CELL_SIZE) * zoom;
  const paletteBaseWidth = resolvePositive(options.paletteBaseWidth, MAP_PALETTE_BASE_WIDTH);
  const paletteWidth = Math.min(
    MAP_PALETTE_MAX_WIDTH,
    Math.max(MAP_PALETTE_MIN_WIDTH, Math.round(paletteBaseWidth / zoom)),
  );

  return {
    viewportColumns,
    viewportRows,
    cellWidth,
    cellHeight,
    canvasWidth: viewportColumns * cellWidth,
    canvasHeight: viewportRows * cellHeight,
    paletteWidth,
  };
}
