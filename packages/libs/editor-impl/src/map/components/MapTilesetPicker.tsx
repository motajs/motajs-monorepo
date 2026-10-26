import { Button, Spin } from 'antd';
import { CSSProperties, PointerEvent, ReactElement, useState } from 'react';
import {
  IMapBrushPattern,
  IMapPaletteSelection,
  IMapRect,
  IMapTileEntry,
  IMapTilesetMeta,
  IMapTilesetPickerProps,
  MapImageStatus,
  MapPaletteKind,
} from '../types';

// Tileset 单独视图：一张整图 + 按 Tileset 自身格尺寸画的网格线，可点单格，也可拖出多格框选。
// 只吃 props：图片地址与状态由面板传入；编号一律按目录查表，缺格填 0，不自己算引擎编号。
// 不逐格建 DOM：整图只有一层背景 + 一层网格线，指针命中按格尺寸换算行列。

/** 图片读取中的文案 */
const LOADING_TEXT = '正在加载 Tileset…';

/** 图片失败时的标题 */
const ERROR_TEXT = 'Tileset 加载失败';

/** 没有 Tileset 元数据时的文案 */
const MISSING_META_TEXT = 'Tileset 缺少格尺寸信息';

/** 一次进行中的框选：起点与终点都按 Tileset 内的列 / 行记录 */
interface ITilesetDrag {
  /** 起点列号 */
  readonly startColumn: number;
  /** 起点行号 */
  readonly startRow: number;
  /** 当前终点列号 */
  readonly endColumn: number;
  /** 当前终点行号 */
  readonly endRow: number;
}

/** 指针命中的一格 */
interface ITilesetCell {
  /** 列号 */
  readonly column: number;
  /** 行号 */
  readonly row: number;
}

/**
 * 把拖拽状态的起点 / 终点归一化成格矩形
 * @param drag 进行中的框选
 * @returns 左上角与宽高（格子数）
 */
function toDragRect(drag: ITilesetDrag): IMapRect {
  return {
    x: Math.min(drag.startColumn, drag.endColumn),
    y: Math.min(drag.startRow, drag.endRow),
    width: Math.abs(drag.endColumn - drag.startColumn) + 1,
    height: Math.abs(drag.endRow - drag.startRow) + 1,
  };
}

/**
 * 把非负整数夹到允许区间
 * @param value 待夹取的数
 * @param max 允许的最大值
 * @returns 0..max 之间的整数
 */
function clampIndex(value: number, max: number): number {
  return Math.min(max, Math.max(0, Math.trunc(value)));
}

/**
 * 从指针位置换算出 Tileset 里的格子；指针在容器外时夹到边缘
 * @param event 画布上的指针事件
 * @param meta Tileset 元数据
 * @returns 命中的格子；容器尺寸不可用时为 undefined
 */
function readCell(event: PointerEvent<HTMLDivElement>, meta: IMapTilesetMeta): ITilesetCell | undefined {
  const rect = event.currentTarget.getBoundingClientRect();

  if (rect.width <= 0 || rect.height <= 0) return undefined;

  const offsetX = event.clientX - rect.left;
  const offsetY = event.clientY - rect.top;

  return {
    column: clampIndex(offsetX / meta.cellWidth, meta.columns - 1),
    row: clampIndex(offsetY / meta.cellHeight, meta.rows - 1),
  };
}

/**
 * 在 Tileset 分组里按列 / 行查图块
 * @param group Tileset 素材组
 * @param column 列号
 * @param row 行号
 * @returns 该格上的图块；目录里没有该格时为 undefined
 */
function findTileAt(group: IMapTilesetPickerProps['group'], column: number, row: number): IMapTileEntry | undefined {
  return group.tiles.find((tile) => tile.column === column && tile.row === row);
}

/**
 * 按矩形里每个格子的列 / 行查编号，组成行主序图案；缺格填 0
 * @param group Tileset 素材组
 * @param rect 归一化后的框选矩形
 * @returns 选中结果，主图块取左上角那一格
 */
function buildPatternSelection(group: IMapTilesetPickerProps['group'], rect: IMapRect): IMapPaletteSelection {
  const tiles: number[] = [];

  for (let row = 0; row < rect.height; row += 1) {
    for (let column = 0; column < rect.width; column += 1) {
      const tile = findTileAt(group, rect.x + column, rect.y + row);

      tiles.push(tile === undefined ? 0 : tile.number);
    }
  }

  const anchor = findTileAt(group, rect.x, rect.y);
  const pattern: IMapBrushPattern = { width: rect.width, height: rect.height, tiles };

  return { kind: MapPaletteKind.Tiles, pattern, primaryTileNumber: anchor === undefined ? 0 : anchor.number };
}

/**
 * 由当前选中反推出它在 Tileset 里的矩形；选中不属于本组时为 undefined
 * @param group Tileset 素材组
 * @param selection 当前调色板选中
 * @returns 选中矩形；不属于本组或不是图块选中时为 undefined
 */
function selectionRect(group: IMapTilesetPickerProps['group'], selection: IMapPaletteSelection): IMapRect | undefined {
  if (selection.kind !== MapPaletteKind.Tiles) return undefined;

  const anchor = group.tiles.find((tile) => tile.number === selection.primaryTileNumber);

  if (anchor === undefined) return undefined;

  return { x: anchor.column, y: anchor.row, width: selection.pattern.width, height: selection.pattern.height };
}

/**
 * 求框选覆盖层的绝对定位样式
 * @param rect 格矩形
 * @param meta Tileset 元数据
 * @returns 相对画布的定位与尺寸
 */
function rectStyle(rect: IMapRect, meta: IMapTilesetMeta): CSSProperties {
  return {
    left: rect.x * meta.cellWidth,
    top: rect.y * meta.cellHeight,
    width: rect.width * meta.cellWidth,
    height: rect.height * meta.cellHeight,
  };
}

/**
 * 渲染图片读取中的条
 * @returns 读取中元素
 */
function renderLoading(): ReactElement {
  return (
    <div className="emap-material-state" data-test-id="map-tileset-loading">
      <Spin size="small" />
      <span>{LOADING_TEXT}</span>
    </div>
  );
}

/**
 * 渲染图片失败条：固定标题 + 重试
 * @param onRetry 重新读取图片的回调
 * @returns 失败元素
 */
function renderError(onRetry: () => void): ReactElement {
  return (
    <div className="emap-material-state is-error" data-test-id="map-tileset-error">
      <span className="emap-material-state-title">{ERROR_TEXT}</span>
      <Button type="link" size="small" autoInsertSpace={false} data-test-id="map-tileset-retry" onClick={onRetry}>
        重试
      </Button>
    </div>
  );
}

/**
 * 渲染没有 Tileset 素材 / 元数据时的空态
 * @param text 空态文案
 * @returns 空态元素
 */
function renderEmpty(text: string): ReactElement {
  return (
    <div className="emap-material-empty" data-test-id="map-tileset-empty">
      {text}
    </div>
  );
}

/**
 * 渲染整图分格线：竖线按列、横线按行
 * @param meta Tileset 元数据
 * @returns 网格线元素
 */
function renderGridLines(meta: IMapTilesetMeta): ReactElement {
  const lines: ReactElement[] = [];

  for (let column = 1; column < meta.columns; column += 1) {
    lines.push(
      <span
        key={`column-${column}`}
        className="emap-tileset-line is-vertical"
        style={{ left: column * meta.cellWidth }}
      />,
    );
  }

  for (let row = 1; row < meta.rows; row += 1) {
    lines.push(
      <span key={`row-${row}`} className="emap-tileset-line is-horizontal" style={{ top: row * meta.cellHeight }} />,
    );
  }

  return (
    <div className="emap-tileset-grid" data-test-id="map-tileset-grid" aria-hidden="true">
      {lines}
    </div>
  );
}

/**
 * Tileset 选择器：整图 + 分格线，单击取 1×1、拖动取多格
 * @param props Tileset 选择器 props
 * @returns Tileset 选择器元素
 */
export function MapTilesetPicker(props: IMapTilesetPickerProps): ReactElement {
  const state = useState<ITilesetDrag | undefined>(undefined);
  const drag = state[0];
  const setDrag = state[1];
  const meta = props.group.tileset;

  if (meta === undefined) return renderEmpty(MISSING_META_TEXT);
  if (props.status === MapImageStatus.Loading) return renderLoading();
  if (props.status === MapImageStatus.Error || props.groupUrl === undefined) return renderError(props.onRetryImages);

  const width = meta.columns * meta.cellWidth;
  const height = meta.rows * meta.cellHeight;
  const dragRect = drag === undefined ? undefined : toDragRect(drag);
  const activeRect = dragRect ?? selectionRect(props.group, props.selection);

  return (
    <div className="emap-tileset" data-test-id="map-tileset-item" data-group-id={props.group.id}>
      <div className="emap-tileset-scroll">
        <div
          className="emap-tileset-canvas"
          data-test-id="map-tileset-canvas"
          data-cell-width={meta.cellWidth}
          data-cell-height={meta.cellHeight}
          style={{
            width,
            height,
            backgroundImage: `url("${props.groupUrl}")`,
            backgroundSize: `${width}px ${height}px`,
          }}
          onPointerDown={(event): void => {
            const cell = readCell(event, meta);

            if (cell === undefined) return;

            setDrag({ startColumn: cell.column, startRow: cell.row, endColumn: cell.column, endRow: cell.row });
          }}
          onPointerMove={(event): void => {
            if (drag === undefined) return;

            const cell = readCell(event, meta);

            if (cell === undefined) return;
            if (cell.column === drag.endColumn && cell.row === drag.endRow) return;

            setDrag({ ...drag, endColumn: cell.column, endRow: cell.row });
          }}
          onPointerUp={(): void => {
            if (drag === undefined) return;

            setDrag(undefined);
            props.onSelectPattern(buildPatternSelection(props.group, toDragRect(drag)));
          }}
          onPointerLeave={(): void => {
            if (drag === undefined) return;

            setDrag(undefined);
            props.onSelectPattern(buildPatternSelection(props.group, toDragRect(drag)));
          }}
        >
          {renderGridLines(meta)}
          {activeRect === undefined ? null : (
            <div
              className={dragRect === undefined ? 'emap-tileset-selection' : 'emap-tileset-select'}
              data-test-id={dragRect === undefined ? 'map-tileset-selection' : 'map-tileset-select'}
              style={rectStyle(activeRect, meta)}
            >
              {dragRect === undefined ? null : (
                <span className="emap-tileset-size">
                  {dragRect.width}×{dragRect.height}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
