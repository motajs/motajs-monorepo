import { Segmented } from 'antd';
import { CSSProperties, ReactElement } from 'react';
import { MAP_CELL_SIZE } from '../constants';
import { resolveFrameInfo, resolveFrameRect } from '../model/tileFrame';
import {
  IMapBottomTabsProps,
  IMapPaletteSelection,
  IMapTileCrop,
  IMapTileEntry,
  IMapTileGroup,
  MapBottomTab,
  MapImageStatus,
  MapPaletteKind,
} from '../types';

// 地图下方的三页：最近使用 / 最常使用 / 收藏。
// 三份编号都来自面板视图状态，组件自己不持久化、不读文件；切换页签只改显示，不碰地图。
// 每个格子都按「目录 + 图片地址 + 第 0 帧矩形」现算背景；格子只显示缩略图，编号不落到界面上。

/** 列表为空时的文案 */
const EMPTY_TEXT = '暂无记录';

/** 图块图片读取中的文案 */
const LOADING_TEXT = '正在加载图块…';

/** 图块图片读取失败的文案 */
const ERROR_TEXT = '图块加载失败';

/** 一个底部页签的显示信息 */
interface IMapBottomTabOption {
  /** 该页签对应的枚举值 */
  readonly tab: MapBottomTab;
  /** 页签显示名 */
  readonly label: string;
  /** 页签的测试标识 */
  readonly testId: string;
}

/** 编号在目录里的归属：素材组与图块条目 */
interface IMapBottomTileLookup {
  /** 图块所属的素材组 */
  readonly group: IMapTileGroup;
  /** 图块条目 */
  readonly entry: IMapTileEntry;
}

/** 一个底部图块格的渲染输入 */
interface IMapBottomTileProps {
  /** 图块编号 */
  readonly number: number;
  /** 当前文档的图块目录；缺失时画不出图块 */
  readonly groups?: readonly IMapTileGroup[];
  /** 素材组标识 → 图片地址 */
  readonly groupUrls: Readonly<Record<string, string | undefined>>;
  /** 当前调色板选中 */
  readonly selection: IMapPaletteSelection;
  /**
   * 点中该格
   * @param number 被点中的图块编号
   */
  onSelect(number: number): void;
}

/** 三个页签的固定顺序与显示名 */
const TAB_OPTIONS: readonly IMapBottomTabOption[] = [
  { tab: MapBottomTab.Recent, label: '最近使用', testId: 'map-bottom-tab-recent' },
  { tab: MapBottomTab.Frequent, label: '最常使用', testId: 'map-bottom-tab-frequent' },
  { tab: MapBottomTab.Favorites, label: '收藏', testId: 'map-bottom-tab-favorites' },
] as const;

/**
 * 把素材格尺寸归一化成正整数，非法值退回默认边长
 * @param size 目录给出的素材格尺寸
 * @returns 可用的素材格尺寸（源图像素）
 */
function resolveAssetSize(size: number | undefined): number {
  if (size === undefined) return MAP_CELL_SIZE;
  if (!Number.isFinite(size) || size <= 0) return MAP_CELL_SIZE;

  return Math.trunc(size);
}

/**
 * 求素材图集在源图上的像素宽
 * @param group 素材组
 * @returns 图集宽度（列数 × 素材格宽）
 */
function atlasWidthOf(group: IMapTileGroup): number {
  const columns = group.tileset === undefined ? group.columns : group.tileset.columns;

  return Math.max(1, columns) * resolveAssetSize(group.cellWidth);
}

/**
 * 求素材图集在源图上的像素高
 * @param group 素材组
 * @returns 图集高度（行数 × 素材格高）
 */
function atlasHeightOf(group: IMapTileGroup): number {
  const cellHeight = resolveAssetSize(group.cellHeight);

  if (group.tileset !== undefined) return Math.max(1, group.tileset.rows) * cellHeight;

  let rows = 1;

  for (const tile of group.tiles) rows = Math.max(rows, tile.row + 1);

  return rows * cellHeight;
}

/**
 * 按编号在目录里找图块：编号在目录里唯一，找不到时返回 undefined
 * @param groups 整份图块目录
 * @param number 图块编号
 * @returns 素材组与图块条目；目录缺失或编号不存在时为 undefined
 */
function findBottomTile(
  groups: readonly IMapTileGroup[] | undefined,
  number: number,
): IMapBottomTileLookup | undefined {
  if (groups === undefined) return undefined;

  for (const group of groups) {
    for (const tile of group.tiles) {
      if (tile.number === number) return { group, entry: tile };
    }
  }

  return undefined;
}

/**
 * 把背景偏移写成一段：0 写成 `0px`，其余写成负偏移
 * @param value 源图上的像素偏移
 * @returns 背景定位的一段
 */
function backgroundOffset(value: number): string {
  return value === 0 ? '0px' : `-${value}px`;
}

/**
 * 求图块第一帧在源图上的矩形
 * @param lookup 编号在目录里的归属
 * @returns 第 0 帧的源图矩形；查不到编号时为 undefined
 */
function frameRectOf(lookup: IMapBottomTileLookup | undefined): IMapTileCrop | undefined {
  if (lookup === undefined) return undefined;

  return resolveFrameRect(resolveFrameInfo(lookup.group, lookup.entry), 0);
}

/**
 * 求图块格的背景样式：整张图集按列 / 行尺寸铺开，再负偏移到该图块的第一帧
 * @param lookup 编号在目录里的归属
 * @param url 该组图片的 blob 地址
 * @param rect 第一帧的源图矩形
 * @returns 内联样式；缺目录或图片时为空对象
 */
function tileBackgroundStyle(
  lookup: IMapBottomTileLookup | undefined,
  url: string | undefined,
  rect: IMapTileCrop | undefined,
): CSSProperties {
  if (lookup === undefined || url === undefined || rect === undefined) return {};

  return {
    backgroundImage: `url("${url}")`,
    backgroundPosition: `${backgroundOffset(rect.x)} ${backgroundOffset(rect.y)}`,
    backgroundSize: `${atlasWidthOf(lookup.group)}px ${atlasHeightOf(lookup.group)}px`,
  };
}

/**
 * 判断某个图块是否为当前选中；擦除选择不点亮任何图块
 * @param number 图块编号
 * @param selection 当前调色板选中
 * @returns 该图块被选中时为 true
 */
function isBottomTileSelected(number: number, selection: IMapPaletteSelection): boolean {
  if (selection.kind === MapPaletteKind.Empty) return false;

  return selection.primaryTileNumber === number;
}

/**
 * 造一个 1×1 的最近使用选中
 * @param number 图块编号
 * @returns 1×1 选中结果
 */
function createRecentSelection(number: number): IMapPaletteSelection {
  return {
    kind: MapPaletteKind.Recent,
    pattern: { width: 1, height: 1, tiles: [number] },
    primaryTileNumber: number,
  };
}

/**
 * 把当前页签对应的编号列表取出来：收藏页过滤掉空位 0
 * @param props 底部三页 props
 * @returns 当前页要显示的编号
 */
function numbersOfTab(props: IMapBottomTabsProps): readonly number[] {
  if (props.tab === MapBottomTab.Frequent) return props.frequentTiles;
  if (props.tab === MapBottomTab.Favorites) return props.favorites.filter((number) => number > 0);

  return props.recentTiles;
}

/**
 * 渲染一个底部图块格：只画缩略图，悬停 / 无障碍文案用图块名
 * @param props 图块格渲染输入
 * @returns 图块格元素
 */
function renderBottomTile(props: IMapBottomTileProps): ReactElement {
  const number = props.number;
  const lookup = findBottomTile(props.groups, number);
  const url = lookup === undefined ? undefined : props.groupUrls[lookup.group.id];
  const rect = frameRectOf(lookup);
  const selected = isBottomTileSelected(number, props.selection);
  const className = selected ? 'emap-material-cell is-selected' : 'emap-material-cell';
  const label = lookup === undefined || lookup.entry.name.length === 0 ? '未知图块' : lookup.entry.name;

  return (
    <button
      key={number}
      type="button"
      className={className}
      data-test-id={`map-bottom-tile-${number}`}
      data-frame-rect={rect === undefined ? '' : `${rect.x},${rect.y},${rect.width},${rect.height}`}
      style={tileBackgroundStyle(lookup, url, rect)}
      title={label}
      aria-label={label}
      aria-pressed={selected}
      onClick={(): void => props.onSelect(number)}
    />
  );
}

/**
 * 渲染当前页的编号网格或空 / 加载 / 失败态
 * @param props 底部三页 props
 * @param numbers 当前页要显示的编号
 * @returns 当前页内容元素
 */
function renderTabBody(props: IMapBottomTabsProps, numbers: readonly number[]): ReactElement {
  if (props.imageStatus === MapImageStatus.Loading) {
    return (
      <div className="emap-material-empty" data-test-id="map-bottom-loading">
        {LOADING_TEXT}
      </div>
    );
  }

  if (props.imageStatus === MapImageStatus.Error) {
    return (
      <div className="emap-material-empty" data-test-id="map-bottom-error">
        {ERROR_TEXT}
      </div>
    );
  }

  if (numbers.length === 0) {
    return (
      <div className="emap-material-empty" data-test-id="map-bottom-empty">
        {EMPTY_TEXT}
      </div>
    );
  }

  return (
    <div className="emap-material-grid" data-test-id="map-bottom-grid">
      {numbers.map((number) =>
        renderBottomTile({
          number,
          groups: props.groups,
          groupUrls: props.groupUrls,
          selection: props.selection,
          onSelect: (picked): void => props.onSelectPattern(createRecentSelection(picked)),
        }),
      )}
    </div>
  );
}

/**
 * 地图下方的三页签：最近使用 / 最常使用 / 收藏
 * @param props 底部三页 props
 * @returns 底部三页元素
 */
export function MapBottomTabs(props: IMapBottomTabsProps): ReactElement {
  const numbers = numbersOfTab(props);

  return (
    <div className="emap-bottom-tab" data-test-id="map-bottom-tabs">
      <Segmented<MapBottomTab>
        size="small"
        value={props.tab}
        options={TAB_OPTIONS.map((option) => ({
          label: (
            <span data-test-id={option.testId} onClick={(): void => props.onSelectTab(option.tab)}>
              {option.label}
            </span>
          ),
          value: option.tab,
        }))}
        onChange={(tab): void => props.onSelectTab(tab)}
      />
      {renderTabBody(props, numbers)}
    </div>
  );
}
