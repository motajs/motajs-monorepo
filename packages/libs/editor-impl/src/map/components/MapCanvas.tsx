import { KeyboardEvent, PointerEvent, ReactElement, useEffect, useId, useRef, useState } from 'react';
import { MAP_CELL_SIZE, MAP_FAVORITE_SLOT_COUNT } from '../constants';
import { buildFillWrites, buildRectWrites, buildStrokeWrites } from '../model/brush';
import { resolveCellMetrics, resolvePointerCell } from '../model/cellMetrics';
import { IPaintWrite } from '../model/document';
import { fillConnectedPositions } from '../model/fill';
import { clampRectToMap, normalizeRect, walkOrthogonalPath } from '../model/geometry';
import {
  IMapBrushPattern,
  IMapCellMetrics,
  IMapCellPosition,
  IMapClipboard,
  IMapDocument,
  IMapLayer,
  IMapPreview,
  IMapRect,
  IMapRenderModel,
  IMapViewport,
  MapBrushMode,
  MapGestureKind,
} from '../types';
import { MapContextMenu } from './MapContextMenu';
import { MapStatusBar } from './MapStatusBar';
import { MapSurface } from './MapSurface';

// 可聚焦的画布容器：手势 / 快捷键 / 行列标尺 / 状态条都在这里，Pixi 表面只负责照着渲染模型画。
// 笔画期间只有本地预览，提交时才把写列表交给面板（一笔一条撤销）；悬停 / 预览 / 框选 / 菜单都不进面板 Store。
// 键盘监听挂在容器上（tabIndex=0），不挂 window / document；撤销 / 重做仍由外壳统一绑定。

/** 读取图块图片字节的回调 */
type MapBytesLoader = (path: string) => Promise<Uint8Array | undefined>;

/** 画布当前进行中的手势；没有手势时为 undefined */
interface IMapGesture {
  /** 手势种类 */
  readonly kind: MapGestureKind;
  /** 起点格（图案左上角） */
  readonly start: IMapCellPosition;
  /** 线笔画经过的格子（含起点）；矩形与框选只保留起点 */
  readonly path: readonly IMapCellPosition[];
  /** 是否已经离开起点格 */
  readonly moved: boolean;
}

/** 右键菜单的打开位置（视口坐标） */
interface IMapMenuState {
  /** 指针在视口中的横坐标 */
  readonly x: number;
  /** 指针在视口中的纵坐标 */
  readonly y: number;
}

export interface IMapCanvasProps {
  /** 当前地图文档，用于尺寸、图层与指针换算 */
  readonly document: IMapDocument;
  /** 这一帧要画的渲染模型，由 `MapPanelView` 现算后传入 */
  readonly model: IMapRenderModel;
  /** 当前图层标识 */
  readonly currentLayerId: string;
  /** 视口左上角所在的格子坐标 */
  readonly viewport: IMapViewport;
  /** 是否处于大地图模式 */
  readonly bigMap: boolean;
  /** 当前画笔模式 */
  readonly brushMode: MapBrushMode;
  /** 当前调色板图案（宽高与内容） */
  readonly pattern: IMapBrushPattern;
  /** 面板内部剪贴板；没有复制过时为 undefined */
  readonly clipboard?: IMapClipboard;
  /** 图块目录是否有可用图块；为 false 时左键不进入绘制 */
  readonly canPaint: boolean;
  /** 当前图层显示名，供状态条使用 */
  readonly layerName: string;
  /** 是否为窄布局 */
  readonly narrow: boolean;
  /** 高于当前层的图层统一不透明度，0..1；转发给画布用于缩略纹理重建 */
  readonly aboveLayerOpacity?: number;
  /** 动画帧速（毫秒 / 帧）；缺省 `MAP_FRAME_SPEED_DEFAULT` */
  readonly cellFrameSpeed?: number;
  /**
   * 把滚动后的视口位置回报给面板
   * @param left 视口左上角所在的格子横坐标
   * @param top 视口左上角所在的格子纵坐标
   */
  onSetViewport?(left: number, top: number): void;
  /**
   * 选择擦除或某个收藏位（数字键 `1..9` / `0`）
   * @param index 0 表示擦除，1..9 对应第 1..9 个收藏格
   */
  onSelectFavoriteSlot?(index: number): void;
  /** 图块图片的重试计数 */
  readonly imageVersion?: number;
  /** 读取图块图片字节的回调 */
  readonly loadBytes?: MapBytesLoader;
  /**
   * 提交一笔写入；一笔只调用一次
   * @param writes 这一笔依次落下的写入
   */
  onCommitCells(writes: readonly IPaintWrite[]): void;
  /**
   * 复制一块区域（无选区时是 1×1）
   * @param rect 要复制的矩形
   */
  onCopyRegion(rect: IMapRect): void;
  /**
   * 以指针格为左上角粘贴
   * @param position 粘贴位置的左上角格子
   */
  onPasteAt(position: IMapCellPosition): void;
  /**
   * 清空一块选区
   * @param rect 要清空的矩形
   */
  onClearRegion(rect: IMapRect): void;
  /**
   * 开关大地图模式
   * @param value 为 true 时进入大地图
   */
  onToggleBigMap(value: boolean): void;
}

/** 行列标尺的宽度 / 高度（像素） */
const RULER_SIZE = 20;

/** 标尺每隔多少格标一个数字 */
const RULER_LABEL_STEP = 5;

/** 画布容器的可访问说明 id 前缀 */
const CANVAS_HINT_ID_PREFIX = 'emap-canvas-hint';

/**
 * 判断格子是否落在地图范围内
 * @param document 中立文档
 * @param position 格子坐标
 * @returns 在地图内时为 true
 */
function isPositionInside(document: IMapDocument, position: IMapCellPosition): boolean {
  if (position.x < 0 || position.y < 0) return false;

  return position.x < document.width && position.y < document.height;
}

/**
 * 算这一帧的屏幕格尺寸与第一格原点：普通模式取「显示格基准 × 整体倍率」，大地图按整图适配缩放并居中
 * @param document 中立文档
 * @param model 渲染模型（提供画布尺寸、显示格基准与整体倍率）
 * @param bigMap 是否处于大地图模式
 * @returns 格尺寸与第一格原点
 */
function buildCanvasCellMetrics(document: IMapDocument, model: IMapRenderModel, bigMap: boolean): IMapCellMetrics {
  if (!bigMap) {
    const renderScale = model.renderScale;

    return resolveCellMetrics(model.cellWidth * renderScale, model.cellHeight * renderScale, 0, 0);
  }

  if (document.width <= 0 || document.height <= 0) return resolveCellMetrics(MAP_CELL_SIZE, MAP_CELL_SIZE, 0, 0);

  const size = Math.min(model.width / document.width, model.height / document.height);

  if (!(size > 0)) return resolveCellMetrics(MAP_CELL_SIZE, MAP_CELL_SIZE, 0, 0);

  return resolveCellMetrics(
    size,
    size,
    (model.width - document.width * size) / 2,
    (model.height - document.height * size) / 2,
  );
}

/**
 * 按图层标识找图层
 * @param document 中立文档
 * @param layerId 图层标识
 * @returns 找到的图层；不存在时为 undefined
 */
function findLayer(document: IMapDocument, layerId: string): IMapLayer | undefined {
  return document.layers.find((layer) => layer.id === layerId);
}

/**
 * 造一个「图案左上角对齐到某格」的预览
 * @param position 图案左上角所在的格子
 * @param pattern 笔刷图案
 * @returns 绘制预览
 */
function createPositionPreview(position: IMapCellPosition, pattern: IMapBrushPattern): IMapPreview {
  return {
    rect: { x: position.x, y: position.y, width: pattern.width, height: pattern.height },
    patternWidth: pattern.width,
    patternHeight: pattern.height,
  };
}

/**
 * 把矩形裁到地图内；裁空时返回 undefined
 * @param rect 待裁剪的矩形
 * @param document 中立文档
 * @returns 裁剪后的矩形；完全在地图外时为 undefined
 */
function clampSelection(rect: IMapRect, document: IMapDocument): IMapRect | undefined {
  const clamped = clampRectToMap(rect, document.width, document.height).rect;

  return clamped.width === 0 || clamped.height === 0 ? undefined : clamped;
}

/**
 * 把一笔路径摊成去重后的格子集合：与真正落笔的写入完全一致
 * @param path 线笔画经过的格子（按移动顺序）
 * @param pattern 笔刷图案
 * @returns 去重后的格子列表，保持首次出现的顺序
 */
function resolveStrokePreviewCells(
  path: readonly IMapCellPosition[],
  pattern: IMapBrushPattern,
): readonly IMapCellPosition[] {
  const seen: Set<string> = new Set();
  const cells: IMapCellPosition[] = [];

  for (const write of buildStrokeWrites(path, pattern)) {
    const key = `${write.x}:${write.y}`;

    if (seen.has(key)) continue;

    seen.add(key);
    cells.push({ x: write.x, y: write.y });
  }

  return cells;
}

/**
 * 判断一次按下是否只能按「单击」处理：没有 pointerId 的按下来自合成事件或非指针设备，无法跟踪后续拖动
 *
 * 这类按下没有可用的拖动轨迹，因此立刻按单格落笔提交；真实指针事件始终带有 pointerId，仍走按下 → 拖动 → 松开。
 * @param event 指针按下事件
 * @returns 只能按单击处理时为 true
 */
function isDiscretePress(event: PointerEvent<HTMLDivElement>): boolean {
  return !Number.isFinite(event.pointerId);
}

/**
 * 地图画布：手势、快捷键、标尺与状态条
 * @param props 画布 props
 * @returns 画布区元素
 */
export function MapCanvas(props: IMapCanvasProps): ReactElement {
  const document = props.document;
  const pattern = props.pattern;
  const hintId = `${CANVAS_HINT_ID_PREFIX}-${useId()}`;
  const gestureRef = useRef<IMapGesture | undefined>(undefined);
  const pointerRef = useRef<IMapCellPosition | undefined>(undefined);
  const viewportRef = useRef<HTMLDivElement>(null);
  const scrollFrameRef = useRef<number | undefined>(undefined);
  const [hover, setHover] = useState<IMapCellPosition | undefined>(undefined);
  const [preview, setPreview] = useState<IMapPreview | undefined>(undefined);
  const [previewCells, setPreviewCells] = useState<readonly IMapCellPosition[] | undefined>(undefined);
  const [selection, setSelection] = useState<IMapRect | undefined>(undefined);
  const [menu, setMenu] = useState<IMapMenuState | undefined>(undefined);
  const [surfaceError, setSurfaceError] = useState(false);

  useEffect(() => {
    gestureRef.current = undefined;
    setPreview(undefined);
    setPreviewCells(undefined);
    setSelection(undefined);
    setMenu(undefined);
  }, [document.id, props.currentLayerId]);

  // 命中换算的视口：大地图缩略从 (0,0) 起画，必须用零视口；普通模式才叠加面板视口
  const pointerViewport: IMapViewport = props.bigMap ? { left: 0, top: 0 } : props.viewport;

  // 画布尺寸由模型给出（布局已按「32 × 缩放」算好）；屏幕格像素 = 显示格基准 × 整体倍率
  const renderScale = props.model.renderScale;
  const cellWidth = props.model.cellWidth * renderScale;
  const cellHeight = props.model.cellHeight * renderScale;
  const canvasWidth = props.model.width;
  const canvasHeight = props.model.height;
  // 大地图与滚动互斥：占位层取可见框尺寸，因此不产生滚动条
  const contentWidth = props.bigMap ? canvasWidth : Math.max(canvasWidth, document.width * cellWidth);
  const contentHeight = props.bigMap ? canvasHeight : Math.max(canvasHeight, document.height * cellHeight);

  useEffect((): (() => void) => {
    return (): void => {
      if (scrollFrameRef.current !== undefined) cancelAnimationFrame(scrollFrameRef.current);

      scrollFrameRef.current = undefined;
    };
  }, []);

  useEffect((): void => {
    if (props.bigMap) return;

    const element = viewportRef.current;

    if (element === null) return;

    const currentLeft = Math.floor(element.scrollLeft / cellWidth);
    const currentTop = Math.floor(element.scrollTop / cellHeight);

    if (currentLeft === props.viewport.left && currentTop === props.viewport.top) return;

    element.scrollLeft = props.viewport.left * cellWidth;
    element.scrollTop = props.viewport.top * cellHeight;
  }, [props.bigMap, props.viewport.left, props.viewport.top, cellWidth, cellHeight]);

  /**
   * 滚动：rAF 节流后把左上格回报给面板；大地图不滚动也不回报
   */
  const handleScroll = (): void => {
    if (props.bigMap) return;
    if (scrollFrameRef.current !== undefined) return;

    scrollFrameRef.current = requestAnimationFrame((): void => {
      scrollFrameRef.current = undefined;

      const element = viewportRef.current;

      if (element === null) return;

      props.onSetViewport?.(Math.floor(element.scrollLeft / cellWidth), Math.floor(element.scrollTop / cellHeight));
    });
  };

  /**
   * 取消进行中的手势，不提交、不登记撤销
   */
  const cancelGesture = (): void => {
    gestureRef.current = undefined;
    setPreview(undefined);
    setPreviewCells(undefined);
  };

  /**
   * 复制：有选区复制选区，否则复制指针所在的一格
   */
  const copyFromCanvas = (): void => {
    if (selection !== undefined) {
      props.onCopyRegion(selection);
      return;
    }

    const position = pointerRef.current ?? { x: pointerViewport.left, y: pointerViewport.top };

    props.onCopyRegion({ x: position.x, y: position.y, width: 1, height: 1 });
  };

  /**
   * 以指针格为左上角粘贴
   */
  const pasteOnCanvas = (): void => {
    const position = pointerRef.current ?? { x: pointerViewport.left, y: pointerViewport.top };

    props.onPasteAt(position);
  };

  /**
   * 按优先级处理 Escape：取消笔画 → 关闭菜单 → 清除框选
   */
  const handleEscape = (): void => {
    if (gestureRef.current?.kind === MapGestureKind.Paint) {
      cancelGesture();
      return;
    }

    if (menu !== undefined) {
      setMenu(undefined);
      return;
    }

    if (selection !== undefined) setSelection(undefined);
  };

  /**
   * 左键落笔：填充立即提交，其余进入笔画 / 矩形手势
   * @param position 指针格
   */
  const beginPaint = (position: IMapCellPosition, discrete: boolean): void => {
    pointerRef.current = position;
    setHover(position);
    setMenu(undefined);

    if (props.brushMode === MapBrushMode.Fill) {
      const layer = findLayer(document, props.currentLayerId);

      if (layer !== undefined) {
        const positions = fillConnectedPositions(layer.cells, position, {
          width: document.width,
          height: document.height,
        });

        props.onCommitCells(buildFillWrites(positions, pattern, position));
      }

      setPreview(undefined);
      return;
    }

    if (discrete) {
      const writes =
        props.brushMode === MapBrushMode.Rect
          ? buildRectWrites({ x: position.x, y: position.y, width: 1, height: 1 }, pattern, position)
          : buildStrokeWrites([position], pattern);

      props.onCommitCells(writes);
      return;
    }

    gestureRef.current = { kind: MapGestureKind.Paint, start: position, path: [position], moved: false };
    setPreview(createPositionPreview(position, pattern));
    setPreviewCells(props.brushMode === MapBrushMode.Rect ? undefined : resolveStrokePreviewCells([position], pattern));
  };

  /**
   * 指针按下：左键起笔，右键框选 / 取消笔画
   * @param event 指针按下事件
   */
  const handlePointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    const target = event.currentTarget;

    target.focus();

    if (event.button === 2) {
      if (gestureRef.current?.kind === MapGestureKind.Paint) {
        cancelGesture();
        return;
      }

      const rect = target.getBoundingClientRect();
      const position = resolvePointerCell(
        event.clientX,
        event.clientY,
        { left: rect.left, top: rect.top },
        buildCanvasCellMetrics(document, props.model, props.bigMap),
        pointerViewport,
      );

      if (!isPositionInside(document, position)) return;

      target.setPointerCapture?.(event.pointerId);
      pointerRef.current = position;
      setMenu(undefined);
      setHover(position);
      gestureRef.current = { kind: MapGestureKind.Marquee, start: position, path: [position], moved: false };
      return;
    }

    if (event.button !== 0) return;

    setMenu(undefined);

    const rect = target.getBoundingClientRect();
    const position = resolvePointerCell(
      event.clientX,
      event.clientY,
      { left: rect.left, top: rect.top },
      buildCanvasCellMetrics(document, props.model, props.bigMap),
      pointerViewport,
    );

    if (!isPositionInside(document, position)) return;
    if (!props.canPaint) return;

    if (!isDiscretePress(event)) target.setPointerCapture?.(event.pointerId);

    beginPaint(position, isDiscretePress(event));
  };

  /**
   * 指针移动：更新悬停格、补笔画路径或更新框选 / 矩形预览
   * @param event 指针移动事件
   */
  const handlePointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    const rect = event.currentTarget.getBoundingClientRect();
    const position = resolvePointerCell(
      event.clientX,
      event.clientY,
      { left: rect.left, top: rect.top },
      buildCanvasCellMetrics(document, props.model, props.bigMap),
      pointerViewport,
    );
    const inside = isPositionInside(document, position);

    setHover(inside ? position : undefined);

    const gesture = gestureRef.current;

    if (gesture === undefined) return;

    if (gesture.kind === MapGestureKind.Marquee) {
      if (!inside) return;

      const moved = gesture.moved || position.x !== gesture.start.x || position.y !== gesture.start.y;

      gestureRef.current = { ...gesture, moved, path: [gesture.start, position] };
      setSelection(clampSelection(normalizeRect(gesture.start, position), document));
      return;
    }

    const last = gesture.path[gesture.path.length - 1] ?? gesture.start;

    if (position.x === last.x && position.y === last.y) return;

    if (props.brushMode === MapBrushMode.Rect) {
      gestureRef.current = { ...gesture, moved: true, path: [gesture.start, position] };

      const rect = normalizeRect(gesture.start, position);

      setPreview({ rect, patternWidth: pattern.width, patternHeight: pattern.height });
      setPreviewCells(undefined);
      return;
    }

    const path = [...gesture.path, ...walkOrthogonalPath(last, position)];

    gestureRef.current = { ...gesture, moved: true, path };
    setPreview(createPositionPreview(position, pattern));
    setPreviewCells(resolveStrokePreviewCells(path, pattern));
  };

  /**
   * 指针松开：框选单击打开菜单，落笔在松开时提交一次
   * @param event 指针松开事件
   */
  const handlePointerUp = (event: PointerEvent<HTMLDivElement>): void => {
    const gesture = gestureRef.current;

    gestureRef.current = undefined;

    if (gesture === undefined) return;

    if (gesture.kind === MapGestureKind.Marquee) {
      if (!gesture.moved) setMenu({ x: event.clientX, y: event.clientY });

      return;
    }

    if (event.button !== 0) return;

    setPreview(undefined);
    setPreviewCells(undefined);

    if (props.brushMode === MapBrushMode.Rect) {
      const last = gesture.path[gesture.path.length - 1] ?? gesture.start;

      props.onCommitCells(buildRectWrites(normalizeRect(gesture.start, last), pattern, gesture.start));
      return;
    }

    props.onCommitCells(buildStrokeWrites(gesture.path, pattern));
  };

  /**
   * 键盘：复制 / 粘贴 / Escape / F / 数字键；只在画布聚焦时响应
   * @param event 键盘事件
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.ctrlKey || event.metaKey) {
      if (event.altKey) return;

      const key = event.key.toLowerCase();

      if (key === 'c') {
        event.preventDefault();
        copyFromCanvas();
        return;
      }

      if (key === 'v') {
        event.preventDefault();
        pasteOnCanvas();
      }

      return;
    }

    if (event.key.length === 1 && event.key >= '0' && event.key <= '9') {
      event.preventDefault();
      props.onSelectFavoriteSlot?.(event.key === '0' ? MAP_FAVORITE_SLOT_COUNT : Number(event.key) - 1);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      handleEscape();
      return;
    }

    if (event.key === 'f' || event.key === 'F') {
      event.preventDefault();
      props.onToggleBigMap(!props.bigMap);
    }
  };

  /**
   * 菜单里的复制动作：有选区复制选区，否则复制指针格
   */
  const handleMenuCopy = (): void => {
    copyFromCanvas();
    setMenu(undefined);
  };

  /**
   * 菜单里的粘贴动作：以指针格为左上角
   */
  const handleMenuPaste = (): void => {
    pasteOnCanvas();
    setMenu(undefined);
  };

  /**
   * 菜单里的清空动作：只清空选区覆盖的格子
   */
  const handleMenuClear = (): void => {
    if (selection !== undefined) props.onClearRegion(selection);

    setMenu(undefined);
  };

  /**
   * 菜单里的取消选区动作：只清除框选
   */
  const handleMenuCancelSelection = (): void => {
    setSelection(undefined);
    setMenu(undefined);
  };

  const metrics = buildCanvasCellMetrics(document, props.model, props.bigMap);
  const renderModel: IMapRenderModel = { ...props.model, selection, preview, previewCells, hover };
  const canvasClass = [
    'emap-canvas',
    document.layers.length === 0 ? 'is-empty-layer' : '',
    props.canPaint ? 'is-paintable' : 'is-readonly',
  ]
    .filter((name) => name.length > 0)
    .join(' ');
  const hasClipboard = props.clipboard !== undefined && props.clipboard.width > 0;

  return (
    <div className="emap-canvas-area">
      <div className="emap-canvas-scroll" style={{ padding: `${RULER_SIZE}px 0 0 ${RULER_SIZE}px` }}>
        {props.bigMap ? null : (
          <>
            <div
              className="emap-ruler emap-ruler-top"
              data-test-id="map-ruler-top"
              style={{ height: RULER_SIZE, top: 0, left: RULER_SIZE, width: canvasWidth }}
            >
              {renderTicks(document.width, props.viewport.left, metrics.cellWidth, hover?.x, true)}
            </div>
            <div
              className="emap-ruler emap-ruler-left"
              data-test-id="map-ruler-left"
              style={{ width: RULER_SIZE, top: RULER_SIZE, left: 0, height: canvasHeight }}
            >
              {renderTicks(document.height, props.viewport.top, metrics.cellHeight, hover?.y, false)}
            </div>
          </>
        )}
        <div
          className="emap-canvas-viewport"
          data-test-id="map-canvas-viewport"
          ref={viewportRef}
          style={{ position: 'relative', width: canvasWidth, height: canvasHeight, overflow: 'auto' }}
          onScroll={handleScroll}
        >
          <div
            className="emap-canvas-spacer"
            data-test-id="map-canvas-spacer"
            style={{ position: 'relative', width: contentWidth, height: contentHeight }}
          >
            <div
              className={canvasClass}
              data-test-id="map-canvas"
              tabIndex={0}
              aria-label="地图画布：左键绘制，右键框选，Ctrl+C / Ctrl+V 复制粘贴"
              aria-describedby={hintId}
              style={{ position: 'sticky', top: 0, left: 0, width: canvasWidth, height: canvasHeight, lineHeight: 0 }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={cancelGesture}
              onContextMenu={(event): void => event.preventDefault()}
              onKeyDown={handleKeyDown}
            >
              {document.layers.length === 0 ? (
                <div className="emap-canvas-empty-layer" data-test-id="map-empty-layer">
                  该地图没有图层
                </div>
              ) : null}
              {surfaceError ? (
                <div className="emap-canvas-state is-error" data-test-id="map-canvas-error">
                  <div className="emap-state-title">画布初始化失败</div>
                  <div className="emap-state-body">请检查浏览器是否支持 WebGL。</div>
                </div>
              ) : (
                <MapSurface
                  model={renderModel}
                  document={document}
                  currentLayerId={props.currentLayerId}
                  aboveLayerOpacity={props.aboveLayerOpacity}
                  cellFrameSpeed={props.cellFrameSpeed}
                  loadBytes={props.loadBytes}
                  imageVersion={props.imageVersion}
                  onError={(): void => setSurfaceError(true)}
                />
              )}
              <span id={hintId} className="emap-sr-only">
                快捷键：Ctrl+C 复制，Ctrl+V 粘贴，Escape 取消笔画或选区，F 切换大地图。
              </span>
              {menu === undefined ? null : (
                <MapContextMenu
                  x={menu.x}
                  y={menu.y}
                  hasClipboard={hasClipboard}
                  hasSelection={selection !== undefined}
                  onCopy={handleMenuCopy}
                  onPaste={handleMenuPaste}
                  onClear={handleMenuClear}
                  onCancelSelection={handleMenuCancelSelection}
                  onClose={(): void => setMenu(undefined)}
                />
              )}
            </div>
          </div>
        </div>
      </div>
      <MapStatusBar
        cursor={hover}
        selection={selection}
        mapSize={{ width: document.width, height: document.height }}
        layerName={props.layerName}
        bigMap={props.bigMap}
        narrow={props.narrow}
      />
    </div>
  );
}

/**
 * 画一条标尺上的数字刻度：每 5 格一个，悬停所在的 5 格区间用 accent 标记
 * @param count 总格数（宽或高）
 * @param offset 视口起点（列或行）
 * @param size 格边长（像素）
 * @param hover 悬停格（列或行）；没有悬停时传 undefined
 * @param horizontal 为 true 时是上方横向标尺，否则是左侧纵向标尺
 * @returns 刻度元素数组
 */
function renderTicks(
  count: number,
  offset: number,
  size: number,
  hover: number | undefined,
  horizontal: boolean,
): ReactElement[] {
  const ticks: ReactElement[] = [];
  const first = Math.max(0, Math.ceil(offset / RULER_LABEL_STEP) * RULER_LABEL_STEP);

  for (let index = first; index < count; index += RULER_LABEL_STEP) {
    const position = (index - offset) * size;
    const active = hover !== undefined && hover >= index && hover < index + RULER_LABEL_STEP;
    const className = active ? 'emap-ruler-tick is-active' : 'emap-ruler-tick';
    const style = horizontal ? { left: position } : { top: position };

    ticks.push(
      <span key={index} className={className} style={style}>
        {index}
      </span>,
    );
  }

  return ticks;
}
