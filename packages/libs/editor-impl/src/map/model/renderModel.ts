import {
  MAP_BIG_MAP_AUTOTILE_CELL,
  MAP_BIG_MAP_DOT_CELL,
  MAP_CELL_SIZE,
  MAP_DISPLAY_CELL_SIZE,
  MAP_ZOOM_DEFAULT,
  MAP_ZOOM_MAX,
  MAP_ZOOM_MIN,
} from '../constants';
import {
  IMapAutotileQuarters,
  IMapCellPosition,
  IMapDirections,
  IMapDocument,
  IMapFrameInfo,
  IMapLayer,
  IMapPassMark,
  IMapPreview,
  IMapRect,
  IMapRenderCell,
  IMapRenderGridLine,
  IMapRenderModel,
  IMapTileCrop,
  IMapTileGroup,
  IMapViewport,
} from '../types';
import { computeAutotileConnection, resolveAutotileQuarters } from './autotile';
import { resolveTileDest } from './cellMetrics';
import { buildThumbnail } from './thumbnail';
import { resolveFrameInfo } from './tileFrame';

// 一帧要画什么：把中立文档与视图参数算成纯数据。
// 这一层不 import React / Pixi / editor-core，也不读文件与图片；视图层每次渲染时现算，画布只照着数据画。
// 格尺寸是固定的显示基准 32；缩放由画布整场景施加，可见格数按「32 × 缩放」折算。
// 帧只给「第 0 帧 + 帧轴 + 步长 + 帧数」，不往模型里塞 255 个矩形。

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
  /** 缩放倍率；缺省 1，渲染模型只用它把画布像素折算成可见格数（屏幕像素由画布整场景施加） */
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
  /** 图块第 0 帧在源图上的裁切 */
  readonly crop: IMapTileCrop;
  /** 素材单格的源像素宽；缺省按裁切宽度处理 */
  readonly srcWidth?: number;
  /** 素材单格的源像素高；缺省按裁切高度处理 */
  readonly srcHeight?: number;
  /** 图块所属的素材组；自动拼接规则与读取方式都从这里读 */
  readonly group: IMapTileGroup;
  /** 第 0 帧矩形、帧轴、帧步长与帧数 */
  readonly frame: IMapFrameInfo;
  /** 帧序列每行的格数；`ScanAnimate` 时等于素材列数 */
  readonly frameColumns: number;
  /** 条目自带的固定帧；缺省 -1 表示跟随动画时钟 */
  readonly defaultFrame: number;
  /** 自动元件的单方面连接集合；非自动元件为空集合 */
  readonly autotileConnections: ReadonlySet<number>;
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
 * 取一份可用的帧行格数；非法或非正时按 1 处理
 * @param columns 素材组声明的列数
 * @returns 可参与折行换算的列数
 */
function resolveFrameColumns(columns: number): number {
  return Number.isFinite(columns) && columns > 0 ? Math.trunc(columns) : 1;
}

/**
 * 把文档的图块目录摊平成「编号 → 图片路径 + 第 0 帧矩形 + 帧规则」的索引
 *
 * 裁切、帧轴、帧步长与帧数一律由 `resolveFrameInfo` 按素材组的读取方式算出；本层不读图片，
 * 素材格尺寸只能来自宿主注入的目录。Tileset 与自动元件在目录里固定声明为 `Grid`，因此每个编号拿到的是它自己那一格。
 * @param document 中立文档
 * @returns 图块编号索引；同编号重复时后出现的分组覆盖先出现的
 */
function buildTileImages(document: IMapDocument): Map<number, ITileImage> {
  const images: Map<number, ITileImage> = new Map();

  for (const group of document.tileGroups) {
    const cellWidth = resolvePositiveSize(group.cellWidth);
    const cellHeight = resolvePositiveSize(group.cellHeight);
    const frameColumns = resolveFrameColumns(group.columns);
    const connections: ReadonlySet<number> =
      group.autotile === undefined ? new Set<number>() : new Set(group.autotile.connections);

    for (const entry of group.tiles) {
      const frame = resolveFrameInfo(group, entry);

      images.set(entry.number, {
        imagePath: group.imagePath,
        crop: frame.base,
        srcWidth: cellWidth,
        srcHeight: cellHeight,
        group,
        frame,
        frameColumns,
        defaultFrame: entry.defaultFrame ?? -1,
        autotileConnections: connections,
      });
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
 * 算一个自动元件格要画的四块象限矩形
 *
 * 连接数由同层邻居与宿主注入的连接集合算出，四块各取素材单格的一半；普通图块返回 undefined。
 * @param cells 同层格子矩阵（`[y][x]`）
 * @param x 格子横坐标
 * @param y 格子纵坐标
 * @param image 图块索引项
 * @returns 四块象限矩形；非自动元件为 undefined
 */
function resolveCellAutotile(
  cells: readonly (readonly number[])[],
  x: number,
  y: number,
  image: ITileImage,
): IMapAutotileQuarters | undefined {
  const autotile = image.group.autotile;

  if (autotile === undefined) return undefined;

  const connection = computeAutotileConnection(cells, x, y, image.autotileConnections);

  return resolveAutotileQuarters(
    autotile.type,
    connection,
    image.srcWidth ?? image.crop.width,
    image.srcHeight ?? image.crop.height,
  );
}

/**
 * 造一个渲染格：编号 0 表示空格（省略图片），目录里查不到的编号标 missing
 *
 * 有图片时目标矩形由 `resolveTileDest` 按 contain 算出，空格与缺图则占满整格。
 * 自动元件格额外带四块象限矩形，`crop` 取左上那一块；动画格带帧轴 / 步长 / 帧数 / 行格数，静态格不带帧轴。
 * @param cells 同层格子矩阵（`[y][x]`），自动拼接按它读邻居
 * @param layerId 图层标识，用于拼稳定的绘制 key
 * @param value 格子里的图块编号
 * @param x 格子横坐标
 * @param y 格子纵坐标
 * @param originX 格子目标区域的左上角横坐标
 * @param originY 格子目标区域的左上角纵坐标
 * @param cellWidth 格子的像素宽（已含缩放）
 * @param cellHeight 格子的像素高（已含缩放）
 * @param opacity 该层这一帧的不透明度
 * @param images 图块编号索引
 * @param allowUpscale 为 true 时允许把小于格子的素材放大到贴满格；只给大地图缩略用，普通模式必须保持 false
 * @returns 渲染格
 */
function createRenderCell(
  cells: readonly (readonly number[])[],
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
  allowUpscale: boolean = false,
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
    allowUpscale,
  );
  const quarters = resolveCellAutotile(cells, x, y, image);
  const cell: IMapRenderCell = {
    key,
    x: dest.x,
    y: dest.y,
    width: dest.width,
    height: dest.height,
    opacity,
    missing: false,
    imagePath: image.imagePath,
    crop: quarters === undefined ? image.crop : quarters.lt,
    autotileQuarters: quarters,
    defaultFrame: image.defaultFrame,
  };

  if (image.frame.count <= 1) return cell;

  return {
    ...cell,
    frameAxis: image.frame.axis,
    frameStride: image.frame.stride,
    frameCount: image.frame.count,
    frameColumns: image.frameColumns,
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
 * 只保留落在可见行列内的通行度标记，并统一标成逐方向箭头
 * @param passMarks 面板算好的整层标记
 * @param startX 可见范围左上角的格子横坐标
 * @param startY 可见范围左上角的格子纵坐标
 * @param columns 可见列数
 * @param rows 可见行数
 * @returns 视口内的标记；条数上限是 `columns × rows`，与文档总格数无关
 */
function clipPassMarks(
  passMarks: readonly IMapPassMark[],
  startX: number,
  startY: number,
  columns: number,
  rows: number,
): readonly IMapPassMark[] {
  return passMarks
    .filter((mark) => mark.x >= startX && mark.x < startX + columns && mark.y >= startY && mark.y < startY + rows)
    .map((mark) => ({ ...mark, dot: false }));
}

/**
 * 造一个没有格子的空渲染模型，只透传视图里的框选 / 预览 / 悬停
 * @param view 视图参数
 * @param cellWidth 显示格的基准像素宽
 * @param cellHeight 显示格的基准像素高
 * @param renderScale 整体渲染倍率
 * @returns 空渲染模型
 */
function buildEmptyModel(
  view: IMapRenderView,
  cellWidth: number,
  cellHeight: number,
  renderScale: number,
): IMapRenderModel {
  return {
    width: view.width,
    height: view.height,
    cells: [],
    gridLines: [],
    passMarks: [],
    renderScale,
    cellWidth,
    cellHeight,
    viewport: view.viewport,
    previewCells: [],
    selection: view.selection,
    preview: view.preview,
    hover: view.hover,
  };
}

/**
 * 普通模式：按「显示格基准 × 整体倍率」折算可见行列范围
 *
 * 通行度标记同样按视口裁剪，因此这一帧的输出规模只与可见格数有关，与文档总格数无关。
 * @param document 中立文档
 * @param view 视图参数
 * @param current 当前层；找不到时为 undefined
 * @param images 图块编号索引
 * @param cellWidth 显示格的基准像素宽（不含缩放）
 * @param cellHeight 显示格的基准像素高（不含缩放）
 * @param renderScale 整体渲染倍率
 * @returns 这一帧的渲染模型
 */
function buildWindowModel(
  document: IMapDocument,
  view: IMapRenderView,
  current: IMapLayer | undefined,
  images: Map<number, ITileImage>,
  cellWidth: number,
  cellHeight: number,
  renderScale: number,
): IMapRenderModel {
  const startX = Math.max(0, Math.floor(view.viewport.left));
  const startY = Math.max(0, Math.floor(view.viewport.top));
  const columns = Math.min(Math.ceil(view.width / (cellWidth * renderScale)), Math.max(0, document.width - startX));
  const rows = Math.min(Math.ceil(view.height / (cellHeight * renderScale)), Math.max(0, document.height - startY));
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
            layer.cells,
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
    passMarks: clipPassMarks(view.passMarks, startX, startY, columns, rows),
    renderScale,
    cellWidth,
    cellHeight,
    viewport: view.viewport,
    previewCells: [],
    selection: view.selection,
    preview: view.preview,
    hover: view.hover,
  };
}

/**
 * 把两个格子被阻断的方向逐位合并
 * @param left 已合并的方向
 * @param right 新标记的方向
 * @returns 四个方向都取逻辑或的方向集合
 */
function mergeBlockedDirections(left: IMapDirections, right: IMapDirections): IMapDirections {
  return {
    up: left.up || right.up,
    right: left.right || right.right,
    down: left.down || right.down,
    left: left.left || right.left,
  };
}

/**
 * 把整层通行度标记按缩略格降采样
 *
 * 同一桶内的四个方向取逻辑或，每个桶只输出一条；输出条数上限是 `ceil(文档宽 / step) × ceil(文档高 / step)`，
 * 与文档总格数无关。`step = 1` 时一格一条，不做合并。
 * @param passMarks 面板算好的整层标记
 * @param step 每个缩略格覆盖的文档格数
 * @param dot 为 true 时画布只画一个单色点（D-12 的四色箭头只适用普通模式）
 * @returns 降采样后的标记
 */
function buildBigMapPassMarks(passMarks: readonly IMapPassMark[], step: number, dot: boolean): readonly IMapPassMark[] {
  const buckets: Map<string, IMapPassMark> = new Map();

  for (const mark of passMarks) {
    const bucketX = Math.floor(mark.x / step);
    const bucketY = Math.floor(mark.y / step);
    const key = `${bucketX}:${bucketY}`;
    const existing = buckets.get(key);

    buckets.set(key, {
      x: bucketX * step,
      y: bucketY * step,
      blocked: existing === undefined ? mark.blocked : mergeBlockedDirections(existing.blocked, mark.blocked),
      dot,
    });
  }

  return [...buckets.values()];
}

/**
 * 大地图模式：只输出一份缩略描述，不再生成逐格格子
 *
 * 缩略描述的显示尺寸、缩放与居中偏移由 `buildThumbnail` 按文档与画布算出；真正的逐格内容由画布用
 * `document` / `currentLayerId` / `aboveLayerOpacity` 铺进离屏纹理，因此模型里不需要 65536 个格子。
 * 通行度按缩略格降采样，并在格像素小于 `MAP_BIG_MAP_DOT_CELL` 时降级为单色点：
 * D-12 的「四个方向四种颜色」只承诺普通模式，`dot` 为 true 时画布统一用 `MAP_PASS_COLOR_UP` 画一个点。
 * @param document 中立文档
 * @param view 视图参数
 * @param cellWidth 显示格的基准像素宽（模型上报值）
 * @param cellHeight 显示格的基准像素高（模型上报值）
 * @param renderScale 整体渲染倍率；大地图固定为 1，缩略图已按画布像素算好
 * @returns 这一帧的渲染模型
 */
function buildBigMapModel(
  document: IMapDocument,
  view: IMapRenderView,
  cellWidth: number,
  cellHeight: number,
  renderScale: number,
): IMapRenderModel {
  if (document.width <= 0 || document.height <= 0) {
    return buildEmptyModel(view, cellWidth, cellHeight, renderScale);
  }

  const thumbnail = buildThumbnail(document, view.width, view.height);
  const dot = thumbnail.scale < MAP_BIG_MAP_DOT_CELL;
  const step = thumbnail.scale > 0 ? Math.max(1, Math.ceil(MAP_BIG_MAP_DOT_CELL / thumbnail.scale)) : 1;

  return {
    width: view.width,
    height: view.height,
    cells: [],
    gridLines: [],
    passMarks: buildBigMapPassMarks(view.passMarks, step, dot),
    renderScale,
    cellWidth,
    cellHeight,
    viewport: view.viewport,
    thumbnail,
    selection: view.selection,
    preview: view.preview,
    hover: view.hover,
  };
}

/**
 * 把整份文档算成大地图缩略纹理要铺的格子
 *
 * 逐格数据与普通模式共用 `buildTileImages` / `createRenderCell` / `layerOpacity`：同一格坐标、同一份裁切、
 * 同一个 contain 目标矩形，自动元件也同样拆成四块，所以缩略里的连接纹样与普通模式一致。
 * 缩略是概览，跳过空格与目录里查不到的编号（不画缺图橙块），也不跟随动画时钟——帧由画布固定取第 0 帧 / 条目固定帧。
 * 本函数不 import React / Pixi、不读图片、不建模块级缓存；只在缩略纹理重建时调用一次，结果不进 `IMapRenderModel`。
 * 图元数口径不变：每格最多一个图元；四块展开只在每格不小于 `MAP_BIG_MAP_AUTOTILE_CELL` 时发生，
 * 而纹理边长上限 512 ⇒ 只可能发生在文档 ≤ 128×128（≤ 16,384 格），因此「因四块展开而增加」的图元最多 65,536 个。
 * @param document 中立文档
 * @param textureWidth 缩略纹理的像素宽
 * @param textureHeight 缩略纹理的像素高
 * @param currentLayerId 当前图层标识；缺失时所有层都不透明
 * @param aboveLayerOpacity 高于当前层的图层统一不透明度，0..1
 * @returns 要铺的格子，顺序即绘制顺序（低层在前）；文档或纹理尺寸非法时为空数组
 */
export function buildThumbnailCells(
  document: IMapDocument,
  textureWidth: number,
  textureHeight: number,
  currentLayerId: string | undefined,
  aboveLayerOpacity: number,
): readonly IMapRenderCell[] {
  if (document.width <= 0 || document.height <= 0) return [];
  if (!(textureWidth > 0) || !(textureHeight > 0)) return [];

  const cellWidth = textureWidth / document.width;
  const cellHeight = textureHeight / document.height;
  const detailed = cellWidth >= MAP_BIG_MAP_AUTOTILE_CELL && cellHeight >= MAP_BIG_MAP_AUTOTILE_CELL;
  const images = buildTileImages(document);
  const current = currentLayerId === undefined ? undefined : findLayer(document, currentLayerId);
  const cells: IMapRenderCell[] = [];

  for (const layer of sortLayers(document.layers)) {
    const opacity = layerOpacity(layer, current, aboveLayerOpacity);
    const rows = Math.min(layer.cells.length, document.height);

    for (let y = 0; y < rows; y += 1) {
      const row = layer.cells[y];
      const columns = Math.min(row.length, document.width);

      for (let x = 0; x < columns; x += 1) {
        const value = row[x];

        if (value === 0) continue;
        if (!images.has(value)) continue;

        const cell = createRenderCell(
          layer.cells,
          layer.id,
          value,
          x,
          y,
          x * cellWidth,
          y * cellHeight,
          cellWidth,
          cellHeight,
          opacity,
          images,
          // 缩略图的一格就是显示格：小地图的格子会比源图块大，必须允许放大才能铺满、不出现大块间隙
          true,
        );
        const image = images.get(value)!;

        if (detailed || image.group.autotile === undefined) {
          cells.push(cell);
          continue;
        }

        // 可见性上限而非退回旧路径：四块各不足 2px 时改用整格裁切，contain 的 x / y / width / height 保持不动
        cells.push({ ...cell, crop: image.frame.base, autotileQuarters: undefined });
      }
    }
  }

  return cells;
}

/**
 * 把一份中立文档与视图参数算成一帧要画的纯数据
 *
 * 唯一调用方是视图层 `MapPanelView`：面板只保存文档与视图状态，不计算也不缓存渲染模型。
 * 显示格尺寸恒为 `MAP_DISPLAY_CELL_SIZE`，与文档声明的格尺寸无关；缩放作为整体倍率原样上报，
 * 可见格数按「显示格 × 缩放」折算（屏幕像素由画布整场景施加）。
 * 普通模式只输出视口内的格子与视口内的通行度标记；大地图模式只输出缩略描述与降采样后的通行度标记。
 * @param document 中立文档
 * @param view 视图参数（画布尺寸、当前层、视口、大地图、缩放、框选、预览、悬停、通行度标记）
 * @returns 这一帧的渲染模型
 */
export function buildMapRenderModel(document: IMapDocument, view: IMapRenderView): IMapRenderModel {
  const renderScale = Math.min(MAP_ZOOM_MAX, Math.max(MAP_ZOOM_MIN, view.zoom ?? MAP_ZOOM_DEFAULT));
  const cellWidth = MAP_DISPLAY_CELL_SIZE;
  const cellHeight = MAP_DISPLAY_CELL_SIZE;

  if (view.bigMap) return buildBigMapModel(document, view, cellWidth, cellHeight, 1);

  return buildWindowModel(
    document,
    view,
    findLayer(document, view.currentLayerId),
    buildTileImages(document),
    cellWidth,
    cellHeight,
    renderScale,
  );
}
