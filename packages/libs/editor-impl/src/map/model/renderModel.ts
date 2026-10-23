import {
  MAP_BIG_MAP_DOT_CELL,
  MAP_BIG_MAP_MAX_SPRITES,
  MAP_CELL_SIZE,
  MAP_ZOOM_DEFAULT,
  MAP_ZOOM_MAX,
  MAP_ZOOM_MIN,
} from '../constants';
import {
  IMapCellPosition,
  IMapDocument,
  IMapLayer,
  IMapPassMark,
  IMapPreview,
  IMapRect,
  IMapRenderCell,
  IMapRenderGridLine,
  IMapRenderModel,
  IMapTileCrop,
  IMapViewport,
} from '../types';
import { resolveTileDest } from './cellMetrics';

// 一帧要画什么：把中立文档与视图参数算成纯数据。
// 这一层不 import React / Pixi / editor-core，也不读文件与图片；视图层每次渲染时现算，画布只照着数据画。

export interface IMapRenderView {
  /** 画布宽度（像素） */
  readonly width: number;
  /** 画布高度（像素） */
  readonly height: number;
  /** 当前图层标识 */
  readonly currentLayerId: string;
  /** 高于当前层的图层统一不透明度，0..1 */
  readonly aboveLayerOpacity: number;
  /** 视口左上角所在的格子坐标 */
  readonly viewport: IMapViewport;
  /** 是否处于大地图模式 */
  readonly bigMap: boolean;
  /** 缩放倍率；缺省 1，渲染模型据此把文档格尺寸换成像素（只在这里乘一次） */
  readonly zoom?: number;
  /** 面板算好的通行度标记，渲染模型只消费 */
  readonly passMarks: readonly IMapPassMark[];
  /** 当前框选矩形；没有选区时不传 */
  readonly selection?: IMapRect;
  /** 当前绘制预览；没有预览时不传 */
  readonly preview?: IMapPreview;
  /** 当前悬停的格子；指针不在画布上时不传 */
  readonly hover?: IMapCellPosition;
}

interface ITileImage {
  /** 图块所在图集的图片路径 */
  readonly imagePath: string;
  /** 图块在图集上的像素裁切 */
  readonly crop: IMapTileCrop;
  /** 素材单格的源像素宽；缺省按裁切宽度处理 */
  readonly srcWidth?: number;
  /** 素材单格的源像素高；缺省按裁切高度处理 */
  readonly srcHeight?: number;
}

/**
 * 取一份正的格尺寸；缺省或非法时回退到 `MAP_CELL_SIZE`
 * @param size 宿主给出的格尺寸
 * @returns 可参与运算的格尺寸
 */
function resolvePositiveSize(size: number | undefined): number {
  return size !== undefined && size > 0 ? size : MAP_CELL_SIZE;
}

/**
 * 把文档的图块目录摊平成「编号 → 图片路径 + 裁切 + 素材格尺寸」的索引
 *
 * 裁切矩形按「列 / 行 × 素材格尺寸」临时推导出第 0 帧的源图矩形；这是 Plan 03 的 `tileFrame` 接管前的过渡实现，
 * 目录里给不出尺寸时按 `MAP_CELL_SIZE` 处理。本层不读图片，素材格尺寸只能来自宿主注入的目录。
 * @param document 中立文档
 * @returns 图块编号索引；同编号重复时后出现的分组覆盖先出现的
 */
function buildTileImages(document: IMapDocument): Map<number, ITileImage> {
  const images: Map<number, ITileImage> = new Map();

  for (const group of document.tileGroups) {
    const cellWidth = resolvePositiveSize(group.cellWidth);
    const cellHeight = resolvePositiveSize(group.cellHeight);

    for (const entry of group.tiles) {
      // Plan 03 的 tileFrame 接管前，第 0 帧矩形按列 / 行 × 素材格尺寸临时推导
      const crop: IMapTileCrop = {
        x: entry.column * cellWidth,
        y: entry.row * cellHeight,
        width: cellWidth,
        height: cellHeight,
      };

      images.set(entry.number, { imagePath: group.imagePath, crop, srcWidth: cellWidth, srcHeight: cellHeight });
    }
  }

  return images;
}

/**
 * 按图层标识找当前层
 * @param document 中立文档
 * @param layerId 当前图层标识
 * @returns 找到的图层；没有对应图层时为 undefined
 */
function findLayer(document: IMapDocument, layerId: string): IMapLayer | undefined {
  return document.layers.find((layer) => layer.id === layerId);
}

/**
 * 按宿主给定的 zIndex 从低到高排列图层
 * @param layers 文档里的图层
 * @returns 排好序的新数组；入参不被修改
 */
function sortLayers(layers: readonly IMapLayer[]): readonly IMapLayer[] {
  return [...layers].sort((left, right) => left.zIndex - right.zIndex);
}

/**
 * 算某层这一帧的不透明度：当前层与低于当前层的层为 1，高于当前层的层取统一值
 * @param layer 待计算的图层
 * @param current 当前层；文档里找不到当前层时传 undefined
 * @param aboveLayerOpacity 高于当前层的统一不透明度
 * @returns 该层的不透明度
 */
function layerOpacity(layer: IMapLayer, current: IMapLayer | undefined, aboveLayerOpacity: number): number {
  if (current === undefined || layer.id === current.id) return 1;

  return layer.zIndex > current.zIndex ? aboveLayerOpacity : 1;
}

/**
 * 造一个渲染格：编号 0 表示空格（省略图片），目录里查不到的编号标 missing
 *
 * 有图片时目标矩形由 `resolveTileDest` 按 contain 算出，空格与缺图则占满整格。
 * @param layerId 图层标识，用于拼稳定的绘制 key
 * @param value 格子里的图块编号
 * @param x 格子横坐标
 * @param y 格子纵坐标
 * @param originX 格子目标区域的左上角横坐标
 * @param originY 格子目标区域的左上角纵坐标
 * @param cellWidth 格子的像素宽
 * @param cellHeight 格子的像素高
 * @param opacity 该层这一帧的不透明度
 * @param images 图块编号索引
 * @returns 渲染格
 */
function createRenderCell(
  layerId: string,
  value: number,
  x: number,
  y: number,
  originX: number,
  originY: number,
  cellWidth: number,
  cellHeight: number,
  opacity: number,
  images: Map<number, ITileImage>,
): IMapRenderCell {
  const image = value === 0 ? undefined : images.get(value);
  const key = `${layerId}:${x}:${y}`;

  if (image === undefined) {
    return { key, x: originX, y: originY, width: cellWidth, height: cellHeight, opacity, missing: value !== 0 };
  }

  const dest = resolveTileDest(
    originX,
    originY,
    cellWidth,
    cellHeight,
    image.srcWidth ?? image.crop.width,
    image.srcHeight ?? image.crop.height,
  );

  return {
    key,
    x: dest.x,
    y: dest.y,
    width: dest.width,
    height: dest.height,
    opacity,
    missing: false,
    imagePath: image.imagePath,
    crop: image.crop,
  };
}

/**
 * 按可见行列数生成网格线：每条格边界一条
 * @param columns 可见列数
 * @param rows 可见行数
 * @param cellWidth 格子的像素宽
 * @param cellHeight 格子的像素高
 * @returns 网格线；没有可见格时为空数组
 */
function buildGridLines(
  columns: number,
  rows: number,
  cellWidth: number,
  cellHeight: number,
): readonly IMapRenderGridLine[] {
  if (columns === 0 || rows === 0) return [];

  const lines: IMapRenderGridLine[] = [];

  for (let column = 0; column <= columns; column += 1) {
    lines.push({ x: column * cellWidth, y: 0, length: rows * cellHeight, vertical: true });
  }

  for (let row = 0; row <= rows; row += 1) {
    lines.push({ x: 0, y: row * cellHeight, length: columns * cellWidth, vertical: false });
  }

  return lines;
}

/**
 * 造一个没有格子的空渲染模型，只透传视图里的框选 / 预览 / 悬停
 * @param view 视图参数
 * @param cellWidth 格子的像素宽
 * @param cellHeight 格子的像素高
 * @returns 空渲染模型
 */
function buildEmptyModel(view: IMapRenderView, cellWidth: number, cellHeight: number): IMapRenderModel {
  return {
    width: view.width,
    height: view.height,
    cells: [],
    gridLines: [],
    passMarks: [],
    cellWidth,
    cellHeight,
    viewport: view.viewport,
    selection: view.selection,
    preview: view.preview,
    hover: view.hover,
  };
}

/**
 * 普通模式：按传入的缩放后格尺寸遍历视口覆盖的行列范围
 * @param document 中立文档
 * @param view 视图参数
 * @param current 当前层；找不到时为 undefined
 * @param images 图块编号索引
 * @param cellWidth 缩放后的格子像素宽
 * @param cellHeight 缩放后的格子像素高
 * @returns 这一帧的渲染模型
 */
function buildWindowModel(
  document: IMapDocument,
  view: IMapRenderView,
  current: IMapLayer | undefined,
  images: Map<number, ITileImage>,
  cellWidth: number,
  cellHeight: number,
): IMapRenderModel {
  const startX = Math.max(0, Math.floor(view.viewport.left));
  const startY = Math.max(0, Math.floor(view.viewport.top));
  const columns = Math.min(Math.ceil(view.width / cellWidth), Math.max(0, document.width - startX));
  const rows = Math.min(Math.ceil(view.height / cellHeight), Math.max(0, document.height - startY));
  const cells: IMapRenderCell[] = [];

  for (const layer of sortLayers(document.layers)) {
    const opacity = layerOpacity(layer, current, view.aboveLayerOpacity);

    for (let row = 0; row < rows; row += 1) {
      const sourceRow = layer.cells[startY + row];
      if (sourceRow === undefined) continue;

      for (let column = 0; column < columns; column += 1) {
        const x = startX + column;
        const y = startY + row;
        const value = sourceRow[x];

        cells.push(
          createRenderCell(
            layer.id,
            value,
            x,
            y,
            column * cellWidth,
            row * cellHeight,
            cellWidth,
            cellHeight,
            opacity,
            images,
          ),
        );
      }
    }
  }

  return {
    width: view.width,
    height: view.height,
    cells,
    gridLines: buildGridLines(columns, rows, cellWidth, cellHeight),
    passMarks: view.passMarks.map((mark) => ({ ...mark, dot: false })),
    cellWidth,
    cellHeight,
    viewport: view.viewport,
    selection: view.selection,
    preview: view.preview,
    hover: view.hover,
  };
}

/**
 * 大地图模式：整图按保持宽高比缩放到画布内并居中；格边长过小时通行度降级为红点
 *
 * 这里的「格边长」是整图适配后的缩略尺寸，与模型上报的 `cellWidth` / `cellHeight`（文档格 × 缩放）不是同一个值。
 * @param document 中立文档
 * @param view 视图参数
 * @param current 当前层；找不到时为 undefined
 * @param images 图块编号索引
 * @param cellWidth 缩放后的格子像素宽（模型上报值）
 * @param cellHeight 缩放后的格子像素高（模型上报值）
 * @returns 这一帧的渲染模型
 */
function buildBigMapModel(
  document: IMapDocument,
  view: IMapRenderView,
  current: IMapLayer | undefined,
  images: Map<number, ITileImage>,
  cellWidth: number,
  cellHeight: number,
): IMapRenderModel {
  if (document.width <= 0 || document.height <= 0) return buildEmptyModel(view, cellWidth, cellHeight);

  const size = Math.min(view.width / document.width, view.height / document.height);
  const offsetX = Math.max(0, (view.width - document.width * size) / 2);
  const offsetY = Math.max(0, (view.height - document.height * size) / 2);
  const limited = document.width * document.height * document.layers.length > MAP_BIG_MAP_MAX_SPRITES;
  const layers = limited && current !== undefined ? [current] : sortLayers(document.layers);
  const dot = size < MAP_BIG_MAP_DOT_CELL;
  const cells: IMapRenderCell[] = [];

  for (const layer of layers) {
    const opacity = layerOpacity(layer, current, view.aboveLayerOpacity);

    for (let y = 0; y < document.height; y += 1) {
      const sourceRow = layer.cells[y];
      if (sourceRow === undefined) continue;

      for (let x = 0; x < document.width; x += 1) {
        const value = sourceRow[x];

        cells.push(
          createRenderCell(layer.id, value, x, y, offsetX + x * size, offsetY + y * size, size, size, opacity, images),
        );
      }
    }
  }

  return {
    width: view.width,
    height: view.height,
    cells,
    gridLines: [],
    passMarks: view.passMarks.map((mark) => ({ ...mark, dot })),
    cellWidth,
    cellHeight,
    viewport: view.viewport,
    selection: view.selection,
    preview: view.preview,
    hover: view.hover,
  };
}

/**
 * 把一份中立文档与视图参数算成一帧要画的纯数据
 *
 * 唯一调用方是视图层 `MapPanelView`：面板只保存文档与视图状态，不计算也不缓存渲染模型。
 * 缩放只在本函数乘一次：`cellWidth / cellHeight = 文档格尺寸 × 缩放`，两条构建路径原样消费这一对值。
 * 普通模式只输出视口内的格子；大地图模式整图适配并居中，受 `MAP_BIG_MAP_MAX_SPRITES` 上限保护。
 * @param document 中立文档
 * @param view 视图参数（画布尺寸、当前层、视口、大地图、缩放、框选、预览、悬停、通行度标记）
 * @returns 这一帧的渲染模型
 */
export function buildMapRenderModel(document: IMapDocument, view: IMapRenderView): IMapRenderModel {
  const current = findLayer(document, view.currentLayerId);
  const images = buildTileImages(document);
  const zoom = Math.min(MAP_ZOOM_MAX, Math.max(MAP_ZOOM_MIN, view.zoom ?? MAP_ZOOM_DEFAULT));
  const cellWidth = resolvePositiveSize(document.cellWidth) * zoom;
  const cellHeight = resolvePositiveSize(document.cellHeight) * zoom;

  return view.bigMap
    ? buildBigMapModel(document, view, current, images, cellWidth, cellHeight)
    : buildWindowModel(document, view, current, images, cellWidth, cellHeight);
}
