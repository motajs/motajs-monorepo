import {
  MAP_DISPLAY_CELL_SIZE,
  MAP_PALETTE_BASE_WIDTH,
  MAP_PALETTE_MIN_WIDTH,
  MAP_VIEWPORT_DEFAULT_COLUMNS,
  MAP_VIEWPORT_DEFAULT_ROWS,
  MAP_ZOOM_DEFAULT,
  MAP_ZOOM_MAX,
  MAP_ZOOM_MIN,
} from '../constants';
import { IMapLayout, IMapLayoutOptions } from '../types';

// 布局的纯函数：把「缩放 + 视口格数 + 可用宽度」算成格像素、画布像素与右栏宽度。
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
 * 把缩放、视口格数与可用宽度算成画布像素、格像素与右栏宽度
 *
 * 画布 = 视口格数 × `MAP_DISPLAY_CELL_SIZE` × 缩放，与地图文档自己声明的格尺寸完全无关（D-39）；
 * 那对声明值只用于素材切分与数据本身。缩放是整张画布的等比倍率，屏幕格像素 = 32 × 缩放。
 * 可用宽度只决定素材区多宽：素材区拿「可用宽度 − 画布宽」，只有最小 240、**没有上限**（D-41 修订）；
 * 量不到可用宽度时回退到 `MAP_PALETTE_BASE_WIDTH`。`MAP_VIEWPORT_DEFAULT_*` 只是视图状态缺值时的兜底。
 * 本函数只吃入参：不读取窗口宽度，也不做任何 DOM 测量。
 * @param options 缩放倍率、可选的视口格数与视图量到的可用宽度
 * @returns 视口格数、整体倍率、格像素、画布像素与地图区 / 素材区宽度
 */
export function resolveMapLayout(options: IMapLayoutOptions): IMapLayout {
  const renderScale = clampZoom(options.zoom);
  const viewportColumns = resolveViewportCount(options.viewportColumns, MAP_VIEWPORT_DEFAULT_COLUMNS);
  const viewportRows = resolveViewportCount(options.viewportRows, MAP_VIEWPORT_DEFAULT_ROWS);
  const cellWidth = MAP_DISPLAY_CELL_SIZE * renderScale;
  const cellHeight = MAP_DISPLAY_CELL_SIZE * renderScale;
  const canvasWidth = viewportColumns * cellWidth;
  const canvasHeight = viewportRows * cellHeight;
  const availableWidth = resolvePositive(options.availableWidth, 0);
  const paletteWidth =
    availableWidth > 0 ? Math.max(MAP_PALETTE_MIN_WIDTH, availableWidth - canvasWidth) : MAP_PALETTE_BASE_WIDTH;
  const mapPaneWidth = availableWidth > 0 ? availableWidth - paletteWidth : canvasWidth;

  return {
    viewportColumns,
    viewportRows,
    renderScale,
    cellWidth,
    cellHeight,
    canvasWidth,
    canvasHeight,
    paletteWidth,
    mapPaneWidth,
  };
}
