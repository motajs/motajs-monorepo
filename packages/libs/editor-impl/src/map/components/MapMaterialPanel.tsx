import { Button, Checkbox, Spin } from 'antd';
import { CSSProperties, ReactElement } from 'react';
import { resolveFrameInfo, resolveFrameRect } from '../model/tileFrame';
import {
  IMapMaterialPanelProps,
  IMapPaletteSelection,
  IMapTileCrop,
  IMapTileEntry,
  IMapTileGroup,
  MapImageStatus,
  MapPaletteKind,
  MapTileCategory,
} from '../types';
import { MapCategoryNav } from './MapCategoryNav';
import { MapTilesetPicker } from './MapTilesetPicker';

// 右侧素材区：顶部「显示帧数」勾选框 + 六类同一排的分类导航 + 当前分类的素材视图。
// 组件只吃 props：目录、图片地址与状态、当前分类 / 选中 / 回调；它不读文件、不读字节、不持有选中。
// 帧矩形一律由 model/tileFrame 现算，不读目录里的 crop（那个字段 Plan 15 会删掉）。

/** 图片读取中的文案 */
const LOADING_TEXT = '正在加载图块…';

/** 图片失败时的标题 */
const ERROR_TEXT = '图块加载失败';

/** 分类下没有素材时的文案 */
const CATEGORY_EMPTY_TEXT = '该分类暂无素材';

/** 整个目录没有普通素材时的文案 */
const CATALOG_EMPTY_TEXT = '暂无可用分类';

/** 目录里没有 Tileset 素材时的文案 */
const TILESET_EMPTY_TEXT = '暂无 Tileset 素材';

/** 一个普通素材按钮的渲染输入 */
interface IMaterialTileProps {
  /** 图块所属分组 */
  readonly group: IMapTileGroup;
  /** 图块条目 */
  readonly tile: IMapTileEntry;
  /** 该组图片的 blob 地址；没读到时为 undefined */
  readonly url: string | undefined;
  /** 该组图片是否不可用 */
  readonly missing: boolean;
  /** 该图块是否为当前选中 */
  readonly selected: boolean;
  /** 是否显示帧数角标 */
  readonly showFrameCount: boolean;
  /**
   * 点中该图块
   * @param tile 被点中的图块条目
   */
  onSelect(tile: IMapTileEntry): void;
  /**
   * 右键把该图块上报收藏
   * @param number 要收藏的图块编号
   */
  onFavorite(number: number): void;
}

/**
 * 取素材组所属分类：目录没写分类时按地形处理
 * @param group 素材组
 * @returns 该组的分类
 */
function categoryOf(group: IMapTileGroup): MapTileCategory {
  return group.category ?? MapTileCategory.Terrain;
}

/**
 * 取某一分类下的素材组；Tileset 组永远不参与普通分类
 * @param groups 整份图块目录
 * @param category 目标分类
 * @returns 该分类下的素材组
 */
function groupsOfCategory(groups: readonly IMapTileGroup[], category: MapTileCategory): readonly IMapTileGroup[] {
  return groups.filter((group) => categoryOf(group) === category && categoryOf(group) !== MapTileCategory.Tileset);
}

/**
 * 统计目录里的普通素材组数量（不含 Tileset）
 * @param groups 整份图块目录
 * @returns 普通素材组数量
 */
function countOrdinaryGroups(groups: readonly IMapTileGroup[]): number {
  return groups.filter((group) => categoryOf(group) !== MapTileCategory.Tileset).length;
}

/**
 * 取某个分组的图片读取状态：没有显式状态时按地址是否存在推断
 * @param group 素材组
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
 * @param group 素材组
 * @param urls 分组标识 → 图片地址
 * @param statuses 分组标识 → 读取状态
 * @returns 该组图块应显示棋盘格占位时为 true
 */
function isGroupImageMissing(
  group: IMapTileGroup,
  urls: Readonly<Record<string, string | undefined>>,
  statuses: Readonly<Record<string, MapImageStatus | undefined>>,
): boolean {
  if (groupImageStatus(group, urls, statuses) === MapImageStatus.Loading) return false;

  return groupImageStatus(group, urls, statuses) === MapImageStatus.Error || urls[group.id] === undefined;
}

/**
 * 取某个分类要渲染的图块条目：Autotile 只留左上角一格，其余分组原样
 * @param group 素材组
 * @param category 该组所属分类
 * @returns 要渲染的图块条目
 */
function tilesToRender(group: IMapTileGroup, category: MapTileCategory): readonly IMapTileEntry[] {
  if (category !== MapTileCategory.Autotile) return group.tiles;

  const anchor = group.tiles.find((tile) => tile.column === 0 && tile.row === 0) ?? group.tiles[0];

  return anchor === undefined ? [] : [anchor];
}

/**
 * 取某个图块第一帧在源图上的矩形
 * @param group 图块所属分组
 * @param tile 图块条目
 * @returns 第 0 帧的源图矩形
 */
function frameRectOf(group: IMapTileGroup, tile: IMapTileEntry): IMapTileCrop {
  return resolveFrameRect(resolveFrameInfo(group, tile), 0);
}

/**
 * 把像素偏移写成背景定位的一段：0 写成 `0px`，其余写成负偏移
 * @param value 源图上的像素偏移
 * @returns 背景定位的一段
 */
function backgroundOffset(value: number): string {
  return value === 0 ? '0px' : `-${value}px`;
}

/**
 * 求某个图块按钮的内联样式：按第一帧矩形负偏移到源图片上的对应位置
 * @param url 该组图片的 blob 地址
 * @param rect 第一帧的源图矩形
 * @returns 内联样式；没有地址时显式清空图片
 */
function tileStyle(url: string | undefined, rect: IMapTileCrop): CSSProperties {
  if (url === undefined) return { backgroundImage: 'none', borderRadius: 0 };

  return {
    backgroundImage: `url("${url}")`,
    backgroundPosition: `${backgroundOffset(rect.x)} ${backgroundOffset(rect.y)}`,
    borderRadius: 0,
  };
}

/**
 * 求某个图块的可访问名
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
 * 判断某个图块是否为当前选中；擦除选择不点亮任何图块
 * @param tile 图块条目
 * @param selection 当前调色板选中
 * @returns 该图块被选中时为 true
 */
function isTileSelected(tile: IMapTileEntry, selection: IMapPaletteSelection): boolean {
  if (selection.kind === MapPaletteKind.Empty) return false;

  return selection.primaryTileNumber === tile.number;
}

/**
 * 造一个 1×1 的图块选中
 * @param number 图块编号
 * @returns 1×1 选中结果
 */
function createTileSelection(number: number): IMapPaletteSelection {
  return {
    kind: MapPaletteKind.Tiles,
    pattern: { width: 1, height: 1, tiles: [number] },
    primaryTileNumber: number,
  };
}

/**
 * 渲染一个普通素材按钮
 * @param props 图块渲染输入
 * @returns 素材按钮元素
 */
function renderMaterialTile(props: IMaterialTileProps): ReactElement {
  const rect = frameRectOf(props.group, props.tile);
  const frameCount = resolveFrameInfo(props.group, props.tile).count;
  const className = props.selected ? 'emap-material-cell is-selected' : 'emap-material-cell';

  return (
    <button
      key={props.tile.number}
      type="button"
      className={props.missing ? `${className} is-missing` : className}
      data-test-id={`map-tile-${props.tile.number}`}
      data-missing={String(props.missing)}
      data-frame-rect={`${rect.x},${rect.y},${rect.width},${rect.height}`}
      style={tileStyle(props.url, rect)}
      title={tileTitle(props.tile, props.missing)}
      aria-label={tileLabel(props.tile)}
      aria-pressed={props.selected}
      onClick={(): void => props.onSelect(props.tile)}
      onContextMenu={(event): void => {
        event.preventDefault();
        props.onFavorite(props.tile.number);
      }}
    >
      {props.missing ? (
        <span className="emap-material-missing-mark" aria-hidden="true">
          !
        </span>
      ) : null}
      {props.showFrameCount && frameCount > 1 ? (
        <span className="emap-tile-frames" data-test-id={`map-tile-frames-${props.tile.number}`}>
          {frameCount}
        </span>
      ) : null}
    </button>
  );
}

/**
 * 渲染一个普通素材分组：组名 + 图块网格
 * @param props 面板 props
 * @param group 该分类下的一个素材组
 * @returns 分组元素
 */
function renderCategoryGroup(props: IMapMaterialPanelProps, group: IMapTileGroup): ReactElement {
  const url = props.groupUrls[group.id];
  const missing = isGroupImageMissing(group, props.groupUrls, props.groupStatus);
  const category = categoryOf(group);

  return (
    <section className="emap-material-group" key={group.id}>
      <div className="emap-material-group-head" title={group.name}>
        {group.name}
      </div>
      <div className="emap-material-grid" data-test-id="map-material-grid">
        {tilesToRender(group, category).map((tile) =>
          renderMaterialTile({
            group,
            tile,
            url,
            missing,
            selected: isTileSelected(tile, props.selection),
            showFrameCount: props.showFrameCount,
            onSelect: (picked): void => props.onSelectPattern(createTileSelection(picked.number)),
            onFavorite: (number): void => props.onFavoriteTile?.(number),
          }),
        )}
      </div>
    </section>
  );
}

/**
 * 渲染图片失败条：固定标题 + 重试
 * @param onRetry 重新读取图片的回调
 * @returns 失败条元素
 */
function renderErrorStrip(onRetry: () => void): ReactElement {
  return (
    <div className="emap-material-state is-error" data-test-id="map-material-error">
      <span className="emap-material-state-title">{ERROR_TEXT}</span>
      <Button type="link" size="small" autoInsertSpace={false} data-test-id="map-material-retry" onClick={onRetry}>
        重试
      </Button>
    </div>
  );
}

/**
 * 渲染图片读取中的条
 * @returns 读取中条元素
 */
function renderLoadingStrip(): ReactElement {
  return (
    <div className="emap-material-state" data-test-id="map-material-loading">
      <Spin size="small" />
      <span>{LOADING_TEXT}</span>
    </div>
  );
}

/**
 * 渲染 Tileset 单独视图：目录里没有 Tileset 组时给空态，否则交给选择器
 * @param props 素材区 props
 * @returns Tileset 视图元素
 */
function renderTilesetView(props: IMapMaterialPanelProps): ReactElement {
  const group = props.groups.find((candidate) => candidate.tileset !== undefined);

  if (group === undefined) {
    return (
      <div className="emap-material-empty" data-test-id="map-tileset-empty">
        {TILESET_EMPTY_TEXT}
      </div>
    );
  }

  return (
    <MapTilesetPicker
      group={group}
      groupUrl={props.groupUrls[group.id]}
      status={groupImageStatus(group, props.groupUrls, props.groupStatus)}
      selection={props.selection}
      onSelectPattern={props.onSelectPattern}
      onRetryImages={props.onRetryImages}
    />
  );
}

/**
 * 右侧素材区：六类同一排的分类导航 + 当前分类的素材视图
 * @param props 素材区 props
 * @returns 素材区元素
 */
export function MapMaterialPanel(props: IMapMaterialPanelProps): ReactElement {
  // 当前分类就是 Tileset 视图的唯一真源：选中 Tileset 即显示 Tileset 视图（D-47）
  const isTilesetView = props.activeCategory === MapTileCategory.Tileset;
  const categoryGroups = isTilesetView ? [] : groupsOfCategory(props.groups, props.activeCategory);
  const ordinaryCount = countOrdinaryGroups(props.groups);
  const anyLoading = categoryGroups.some(
    (group) => groupImageStatus(group, props.groupUrls, props.groupStatus) === MapImageStatus.Loading,
  );
  const allFailed =
    categoryGroups.length > 0 &&
    !anyLoading &&
    categoryGroups.every((group) => isGroupImageMissing(group, props.groupUrls, props.groupStatus));

  return (
    <div className="emap-material" data-test-id="map-material">
      <div className="emap-material-head">
        <Checkbox
          className="emap-frame-count"
          data-test-id="map-frame-count"
          checked={props.showFrameCount}
          onChange={(event): void => props.onToggleFrameCount(event.target.checked)}
        >
          显示帧数
        </Checkbox>
      </div>
      <MapCategoryNav
        activeCategory={props.activeCategory}
        onSelectCategory={props.onSelectCategory}
      />
      <div className="emap-material-body">
        {isTilesetView ? (
          renderTilesetView(props)
        ) : (
          <>
            {anyLoading ? renderLoadingStrip() : null}
            {allFailed ? renderErrorStrip(props.onRetryImages) : null}
            {categoryGroups.length === 0 ? (
              <div className="emap-material-empty" data-test-id="map-material-empty">
                {ordinaryCount === 0 ? CATALOG_EMPTY_TEXT : CATEGORY_EMPTY_TEXT}
              </div>
            ) : null}
            {categoryGroups.map((group) => renderCategoryGroup(props, group))}
          </>
        )}
      </div>
    </div>
  );
}
