import { Button, Spin } from 'antd';
import { CSSProperties, PointerEvent, ReactElement, useRef, useState } from 'react';
import { IMapPaletteSelection, IMapTileEntry, IMapTileGroup, MapImageStatus, MapPaletteKind } from '../types';
import { MapRecentClearDialog } from './dialogs';

// 左侧图块调色板：自上而下固定为擦除格 / 最近使用 / 分组折叠网格三段。
// 组件只吃 props：分组、分组图片地址与状态、最近使用列表、当前选中与回调；它不读文件、不读字节，也不持有选中。

/** 擦除格的 title 与 tooltip 文案 */
const ERASE_TITLE = '擦除：选中后在画布上绘制会清空对应格子';

/** 最近使用为空时的两句连排文案 */
const RECENT_EMPTY_TEXT = '暂无最近使用的图块。在画布上绘制后，用过的图块会出现在这里。';

/** 图片读取中的文案 */
const LOADING_TEXT = '正在加载图块…';

/** 单元格边长（像素） */
const CELL_SIZE = 32;

/** 单元格间距（像素） */
const CELL_GAP = 4;

/** 单元格步进 = 边长 + 间距 */
const CELL_STEP = CELL_SIZE + CELL_GAP;

/** 网格内边距（像素） */
const GRID_PADDING = 8;

/** 最近使用最多显示两行 */
const RECENT_MAX_HEIGHT = CELL_SIZE * 2 + CELL_GAP;

/** 拖拽状态记录的分组内格子 */
interface IMapPaletteDragCell {
  /** 起点所在分组 */
  readonly groupId: string;
  /** 被指向的列号 */
  readonly column: number;
  /** 被指向的行号 */
  readonly row: number;
}

/** 一次进行中的框选：起点与当前终点都按分组内的列 / 行记录 */
interface IMapPaletteDrag {
  /** 起点所在分组 */
  readonly groupId: string;
  /** 框选起点的列号 */
  readonly startColumn: number;
  /** 框选起点的行号 */
  readonly startRow: number;
  /** 当前终点的列号 */
  readonly endColumn: number;
  /** 当前终点的行号 */
  readonly endRow: number;
}

/** 归一化后的框选矩形：左上角与宽高都按格子数记 */
interface IMapPaletteRect {
  /** 矩形最左列 */
  readonly column: number;
  /** 矩形最上行 */
  readonly row: number;
  /** 矩形宽度（格子数） */
  readonly width: number;
  /** 矩形高度（格子数） */
  readonly height: number;
}

/** 在目录里查到的图块及其所属分组 */
interface IMapPaletteTileRef {
  /** 图块所属分组 */
  readonly group: IMapTileGroup;
  /** 图块条目 */
  readonly tile: IMapTileEntry;
}

export interface IMapPaletteProps {
  /** 宿主给的图块分组，按数组顺序渲染 */
  readonly groups: readonly IMapTileGroup[];
  /** 分组标识 → 该组图片的 blob 地址；没有地址时该组图块画棋盘格占位 */
  readonly groupUrls: Readonly<Record<string, string | undefined>>;
  /** 分组标识 → 该组图片的读取状态；缺省时按地址是否存在推断 */
  readonly groupStatus: Readonly<Record<string, MapImageStatus | undefined>>;
  /** 整体图片状态，决定网格位置显示加载中还是失败重试 */
  readonly imageStatus: MapImageStatus;
  /** 当前选中；由挂载方持有，组件只读 */
  readonly selection: IMapPaletteSelection;
  /** 最近使用的图块编号，按最近程度排序 */
  readonly recentTiles: readonly number[];
  /** 最近使用图片的读取状态 */
  readonly recentStatus: MapImageStatus;
  /**
   * 提交一次选择
   * @param selection 新的选中
   */
  onSelectPattern(selection: IMapPaletteSelection): void;
  /** 请求重新读取图块图片；只上报，不改选中、不落笔 */
  onRetryImages(): void;
  /** 确认清除最近使用记录 */
  onClearRecent(): void;
}

/**
 * 图块的可访问名与 title 文案
 * @param tile 图块条目
 * @returns 「图块 {名称}（编号 {编号}）」
 */
function tileLabel(tile: IMapTileEntry): string {
  return `图块 ${tile.name}（编号 ${tile.number}）`;
}

/**
 * 求某个图块按钮的 title：缺图时追加固定提示
 * @param tile 图块条目
 * @param missing 该图块的图片是否不可用
 * @returns 按钮 title
 */
function tileTitle(tile: IMapTileEntry, missing: boolean): string {
  const label = tileLabel(tile);

  return missing ? `${label}，该图块的图片不可用` : label;
}

/**
 * 求某个图块按钮的背景样式：按裁切矩形负偏移到源图片上的对应位置
 * @param url 该组图片的 blob 地址
 * @param tile 图块条目
 * @returns 内联样式；没有地址时显式清空图片
 */
function tileStyle(url: string | undefined, tile: IMapTileEntry): CSSProperties {
  if (url === undefined) return { backgroundImage: 'none' };

  return {
    backgroundImage: `url("${url}")`,
    backgroundPosition: `-${tile.crop.x}px -${tile.crop.y}px`,
  };
}

/**
 * 取某个分组图片的读取状态：没有显式状态时按地址是否存在推断
 * @param group 图块分组
 * @param urls 分组标识 → 图片地址
 * @param statuses 分组标识 → 读取状态
 * @returns 该组图片的读取状态
 */
function groupImageStatus(
  group: IMapTileGroup,
  urls: Readonly<Record<string, string | undefined>>,
  statuses: Readonly<Record<string, MapImageStatus | undefined>>,
): MapImageStatus {
  const status = statuses[group.id];

  if (status !== undefined) return status;

  return urls[group.id] === undefined ? MapImageStatus.Error : MapImageStatus.Ready;
}

/**
 * 判断某个分组的图片是否不可用：读取中不算缺图，失败或没有地址才算
 * @param group 图块分组
 * @param urls 分组标识 → 图片地址
 * @param statuses 分组标识 → 读取状态
 * @returns 该组图块应显示棋盘格占位时为 true
 */
function isGroupImageMissing(
  group: IMapTileGroup,
  urls: Readonly<Record<string, string | undefined>>,
  statuses: Readonly<Record<string, MapImageStatus | undefined>>,
): boolean {
  const status = groupImageStatus(group, urls, statuses);

  if (status === MapImageStatus.Loading) return false;

  return status === MapImageStatus.Error || urls[group.id] === undefined;
}

/**
 * 在分组内按列 / 行查图块
 * @param group 图块分组
 * @param column 列号
 * @param row 行号
 * @returns 该格上的图块；组内缺格时为 undefined
 */
function findTileAt(group: IMapTileGroup, column: number, row: number): IMapTileEntry | undefined {
  return group.tiles.find((tile) => tile.column === column && tile.row === row);
}

/**
 * 在整个目录里按编号查图块
 * @param groups 全部图块分组
 * @param number 图块编号
 * @returns 图块及其分组；目录里没有该编号时为 undefined
 */
function findTile(groups: readonly IMapTileGroup[], number: number): IMapPaletteTileRef | undefined {
  for (const group of groups) {
    const tile = group.tiles.find((candidate) => candidate.number === number);

    if (tile !== undefined) return { group, tile };
  }

  return undefined;
}

/**
 * 统计目录里的图块总数，用于判断「暂无可用的图块」
 * @param groups 全部图块分组
 * @returns 图块总数
 */
function countTiles(groups: readonly IMapTileGroup[]): number {
  let count = 0;

  for (const group of groups) count += group.tiles.length;

  return count;
}

/**
 * 按给定顺序把最近使用的编号翻成图块；目录里已不存在的编号直接跳过
 * @param groups 全部图块分组
 * @param numbers 最近使用的编号列表
 * @returns 可渲染的最近使用条目
 */
function collectRecentEntries(
  groups: readonly IMapTileGroup[],
  numbers: readonly number[],
): readonly IMapPaletteTileRef[] {
  const entries: IMapPaletteTileRef[] = [];

  for (const number of numbers) {
    const entry = findTile(groups, number);

    if (entry !== undefined) entries.push(entry);
  }

  return entries;
}

/**
 * 把拖拽状态的起点 / 终点归一化成一个矩形
 * @param drag 进行中的框选
 * @returns 左上角与宽高
 */
function toDragRect(drag: IMapPaletteDrag): IMapPaletteRect {
  return {
    column: Math.min(drag.startColumn, drag.endColumn),
    row: Math.min(drag.startRow, drag.endRow),
    width: Math.abs(drag.endColumn - drag.startColumn) + 1,
    height: Math.abs(drag.endRow - drag.startRow) + 1,
  };
}

/**
 * 按矩形里每个格子的列 / 行查图块，组成行主序图案；组内缺格填 0
 * @param group 起点所在分组
 * @param drag 进行中的框选
 * @returns 选中结果，主图块取左上角那一格
 */
function buildPatternSelection(group: IMapTileGroup, drag: IMapPaletteDrag): IMapPaletteSelection {
  const rect = toDragRect(drag);
  const tiles: number[] = [];

  for (let row = 0; row < rect.height; row += 1) {
    for (let column = 0; column < rect.width; column += 1) {
      const tile = findTileAt(group, rect.column + column, rect.row + row);

      tiles.push(tile === undefined ? 0 : tile.number);
    }
  }

  const anchor = findTileAt(group, rect.column, rect.row);

  return {
    kind: MapPaletteKind.Tiles,
    pattern: { width: rect.width, height: rect.height, tiles },
    primaryTileNumber: anchor === undefined ? 0 : anchor.number,
  };
}

/**
 * 造一个 1×1 的选中结果
 * @param kind 选中种类
 * @param number 图块编号；擦除时为 0
 * @returns 1×1 选中结果
 */
function buildSingleSelection(kind: MapPaletteKind, number: number): IMapPaletteSelection {
  return {
    kind,
    pattern: { width: 1, height: 1, tiles: [number] },
    primaryTileNumber: number,
  };
}

/**
 * 求框选覆盖层的绝对定位样式
 * @param rect 归一化后的框选矩形
 * @returns 相对网格容器的定位与尺寸
 */
function rectStyle(rect: IMapPaletteRect): CSSProperties {
  return {
    left: GRID_PADDING + rect.column * CELL_STEP,
    top: GRID_PADDING + rect.row * CELL_STEP,
    width: rect.width * CELL_STEP - CELL_GAP,
    height: rect.height * CELL_STEP - CELL_GAP,
  };
}

/**
 * 从指针事件的目标元素上读出所属分组与格子；目标不是图块时返回 undefined
 * @param event 网格上的指针事件
 * @returns 指针指向的格子；不在图块上时为 undefined
 */
function readDragCell(event: PointerEvent<HTMLDivElement>): IMapPaletteDragCell | undefined {
  const target = event.target;

  if (!(target instanceof HTMLElement)) return undefined;

  const dataset = target.dataset;
  const groupId = dataset.emapTileGroup;
  const column = Number(dataset.emapTileColumn);
  const row = Number(dataset.emapTileRow);

  if (groupId === undefined) return undefined;
  if (Number.isNaN(column) || Number.isNaN(row)) return undefined;

  return { groupId, column, row };
}

/**
 * 判断某个图块是否落在当前选中里；擦除选择不点亮任何图块
 * @param group 图块所属分组
 * @param tile 图块条目
 * @param selection 当前选中
 * @returns 命中选中时为 true
 */
function isTileSelected(group: IMapTileGroup, tile: IMapTileEntry, selection: IMapPaletteSelection): boolean {
  if (selection.kind === MapPaletteKind.Recent) return tile.number === selection.primaryTileNumber;
  if (selection.kind !== MapPaletteKind.Tiles) return false;

  const anchor = group.tiles.find((candidate) => candidate.number === selection.primaryTileNumber);

  if (anchor === undefined) return false;

  const column = tile.column - anchor.column;
  const row = tile.row - anchor.row;

  if (column < 0 || row < 0 || column >= selection.pattern.width || row >= selection.pattern.height) return false;

  return selection.pattern.tiles[row * selection.pattern.width + column] === tile.number;
}

/**
 * 求图块按钮的类名：基础类 + 选中 / 缺图标记
 * @param selected 该图块是否被选中
 * @param missing 该图块的图片是否不可用
 * @returns 按钮类名
 */
function tileClassName(selected: boolean, missing: boolean): string {
  const names = ['emap-palette-cell'];

  if (selected) names.push('is-selected');
  if (missing) names.push('is-missing');

  return names.join(' ');
}

/**
 * 图块调色板：擦除格 / 最近使用 / 分组折叠网格，同组内可拖拽多格框选
 * @param props 调色板 props
 * @returns 调色板元素
 */
export function MapPalette(props: IMapPaletteProps): ReactElement {
  const collapseState = useState<readonly string[]>([]);
  const collapsedGroups = collapseState[0];
  const setCollapsedGroups = collapseState[1];
  const dragState = useState<IMapPaletteDrag | undefined>(undefined);
  const drag = dragState[0];
  const setDrag = dragState[1];
  const clearState = useState(false);
  const clearOpen = clearState[0];
  const setClearOpen = clearState[1];
  const suppressClick = useRef(false);

  const tileCount = countTiles(props.groups);
  const recentEntries = collectRecentEntries(props.groups, props.recentTiles);
  const dragRect = drag === undefined ? undefined : toDragRect(drag);

  return (
    <div className="emap-palette" data-test-id="map-palette">
      <div className="emap-palette-erase-row">
        <button
          type="button"
          className={
            props.selection.kind === MapPaletteKind.Empty ? 'emap-palette-erase is-selected' : 'emap-palette-erase'
          }
          data-test-id="map-palette-erase"
          title={ERASE_TITLE}
          aria-label="空"
          aria-pressed={props.selection.kind === MapPaletteKind.Empty}
          onClick={(): void => props.onSelectPattern(buildSingleSelection(MapPaletteKind.Empty, 0))}
        >
          <span className="emap-palette-checker" aria-hidden="true" />
          <svg className="emap-palette-erase-mark" viewBox="0 0 32 32" aria-hidden="true">
            <path d="M4 28L28 4" />
          </svg>
        </button>
      </div>
      <div className="emap-palette-body">
        {tileCount === 0 ? (
          <div className="emap-palette-empty" data-test-id="map-palette-empty">
            暂无可用的图块
          </div>
        ) : (
          <>
            <section className="emap-palette-recent" data-test-id="map-palette-recent">
              <div className="emap-palette-recent-head">
                <span className="emap-palette-section-title">最近使用</span>
                <Button
                  type="text"
                  size="small"
                  autoInsertSpace={false}
                  className="emap-palette-clear"
                  data-test-id="map-recent-clear"
                  title="清除记录"
                  disabled={recentEntries.length === 0}
                  onClick={(): void => setClearOpen(true)}
                >
                  清除记录
                </Button>
              </div>
              {props.recentStatus === MapImageStatus.Loading ? (
                <div className="emap-palette-recent-muted" data-test-id="map-recent-loading">
                  {LOADING_TEXT}
                </div>
              ) : null}
              {props.recentStatus !== MapImageStatus.Loading && recentEntries.length === 0 ? (
                <div className="emap-palette-recent-empty" data-test-id="map-recent-empty">
                  {RECENT_EMPTY_TEXT}
                </div>
              ) : null}
              {props.recentStatus !== MapImageStatus.Loading && recentEntries.length > 0 ? (
                <div
                  className="emap-palette-recent-grid"
                  style={{ gridTemplateColumns: `repeat(6, ${CELL_SIZE}px)`, maxHeight: RECENT_MAX_HEIGHT }}
                >
                  {recentEntries.map((entry) => {
                    const url = props.groupUrls[entry.group.id];
                    const missing = isGroupImageMissing(entry.group, props.groupUrls, props.groupStatus);
                    const selected =
                      props.selection.kind === MapPaletteKind.Recent &&
                      props.selection.primaryTileNumber === entry.tile.number;

                    return (
                      <button
                        key={entry.tile.number}
                        type="button"
                        className={tileClassName(selected, missing)}
                        data-test-id={`map-recent-${entry.tile.number}`}
                        data-missing={String(missing)}
                        title={tileTitle(entry.tile, missing)}
                        aria-label={tileLabel(entry.tile)}
                        aria-pressed={selected}
                        style={tileStyle(url, entry.tile)}
                        onClick={(): void =>
                          props.onSelectPattern(buildSingleSelection(MapPaletteKind.Recent, entry.tile.number))
                        }
                      >
                        {missing ? (
                          <span className="emap-palette-missing-mark" aria-hidden="true">
                            !
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </section>
            {props.groups.map((group, index) => {
              const collapsed = collapsedGroups.includes(group.id);
              const url = props.groupUrls[group.id];
              const missing = isGroupImageMissing(group, props.groupUrls, props.groupStatus);

              return (
                <section className="emap-palette-group" key={group.id}>
                  <button
                    type="button"
                    className="emap-palette-group-head"
                    data-test-id={`map-palette-group-${index}`}
                    title={group.name}
                    aria-expanded={!collapsed}
                    onClick={(): void => {
                      setCollapsedGroups(
                        collapsed ? collapsedGroups.filter((id) => id !== group.id) : [...collapsedGroups, group.id],
                      );
                    }}
                  >
                    <svg className="emap-palette-group-arrow" viewBox="0 0 16 16" aria-hidden="true">
                      <path d={collapsed ? 'M6 4L10 8L6 12' : 'M4 6L8 10L12 6'} />
                    </svg>
                    <span className="emap-palette-group-name">{group.name}</span>
                    <span className="emap-palette-group-count">{group.tiles.length}</span>
                  </button>
                  {group.tiles.length > 0 || collapsed || props.imageStatus !== MapImageStatus.Ready ? null : (
                    <div className="emap-palette-group-empty">该分组暂无图块</div>
                  )}
                  {group.tiles.length === 0 || collapsed || props.imageStatus !== MapImageStatus.Ready ? null : (
                    <div
                      className="emap-palette-grid"
                      onPointerMove={(event): void => {
                        const cell = readDragCell(event);

                        if (drag === undefined || cell === undefined || cell.groupId !== drag.groupId) return;
                        if (cell.column === drag.endColumn && cell.row === drag.endRow) return;

                        setDrag({ ...drag, endColumn: cell.column, endRow: cell.row });
                      }}
                      onPointerUp={(): void => {
                        if (drag === undefined || drag.groupId !== group.id) return;

                        suppressClick.current = true;
                        setDrag(undefined);
                        props.onSelectPattern(buildPatternSelection(group, drag));
                      }}
                      onPointerLeave={(): void => {
                        if (drag === undefined || drag.groupId !== group.id) return;

                        suppressClick.current = true;
                        setDrag(undefined);
                        props.onSelectPattern(buildPatternSelection(group, drag));
                      }}
                    >
                      {group.tiles.map((tile) => {
                        const selected = isTileSelected(group, tile, props.selection);

                        return (
                          <button
                            key={tile.number}
                            type="button"
                            className={tileClassName(selected, missing)}
                            data-test-id={`map-tile-${tile.number}`}
                            data-missing={String(missing)}
                            data-emap-tile-group={group.id}
                            data-emap-tile-column={tile.column}
                            data-emap-tile-row={tile.row}
                            title={tileTitle(tile, missing)}
                            aria-label={tileLabel(tile)}
                            aria-pressed={selected}
                            style={tileStyle(url, tile)}
                            onPointerDown={(): void => {
                              suppressClick.current = false;
                              setDrag({
                                groupId: group.id,
                                startColumn: tile.column,
                                startRow: tile.row,
                                endColumn: tile.column,
                                endRow: tile.row,
                              });
                            }}
                            onClick={(): void => {
                              if (suppressClick.current) {
                                suppressClick.current = false;
                                return;
                              }

                              props.onSelectPattern(buildSingleSelection(MapPaletteKind.Tiles, tile.number));
                            }}
                          >
                            {missing ? (
                              <span className="emap-palette-missing-mark" aria-hidden="true">
                                !
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                      {drag !== undefined && dragRect !== undefined && drag.groupId === group.id ? (
                        <div
                          className="emap-palette-select-rect"
                          data-test-id="map-palette-select-rect"
                          style={rectStyle(dragRect)}
                        >
                          <span className="emap-palette-select-size" data-test-id="map-palette-select-size">
                            {dragRect.width}×{dragRect.height}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  )}
                </section>
              );
            })}
            {props.imageStatus === MapImageStatus.Loading ? (
              <div className="emap-palette-state" data-test-id="map-palette-loading">
                <Spin size="small" />
                <span>{LOADING_TEXT}</span>
              </div>
            ) : null}
            {props.imageStatus === MapImageStatus.Error ? (
              <div className="emap-palette-state is-error" data-test-id="map-palette-error">
                <span className="emap-palette-state-title">图块加载失败</span>
                <Button
                  type="link"
                  size="small"
                  autoInsertSpace={false}
                  data-test-id="map-palette-retry"
                  onClick={(): void => props.onRetryImages()}
                >
                  重试
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
      <MapRecentClearDialog
        open={clearOpen}
        onConfirm={(): void => {
          setClearOpen(false);
          props.onClearRecent();
        }}
        onCancel={(): void => setClearOpen(false)}
      />
    </div>
  );
}
