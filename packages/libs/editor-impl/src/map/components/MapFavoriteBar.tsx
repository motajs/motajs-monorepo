import { CSSProperties, ReactElement, useState } from 'react';
import { MAP_CELL_SIZE, MAP_FAVORITE_SLOT_COUNT } from '../constants';
import { resolveFrameInfo, resolveFrameRect } from '../model/tileFrame';
import {
  IMapFavoriteBarProps,
  IMapPaletteSelection,
  IMapTileCrop,
  IMapTileEntry,
  IMapTileGroup,
  MapPaletteKind,
} from '../types';

// 地图底部的收藏栏：1 个擦除格 + 9 个收藏格。
// 索引口径只在这里写一次：擦除格调 `onSelectSlot(0)`，第 i 个收藏格调 `onSelectSlot(i + 1)`；
// 拖拽从第 i 格到第 j 格调 `onReorder(i, j)`，排序只保留拖拽，没有上移 / 下移按钮。
// 每格都按「目录 + 图片地址 + 第 0 帧矩形」现算背景，空位留空格子；组件不读文件、不持久化。
// 格子上写的数字是「按哪个数字键能选它」，不是图块编号。

/** 擦除格的文案 */
const ERASE_TEXT = '擦';

/** 擦除格对应的数字键 */
const ERASE_SLOT_KEY = '1';

/** 第 i 个收藏格对应的数字键：依次是 `2`…`9`、`0`（与 `MapCanvas` 的键盘映射一致） */
const MAP_FAVORITE_SLOT_KEYS: readonly string[] = Object.freeze(['2', '3', '4', '5', '6', '7', '8', '9', '0']);

/** 编号在目录里的归属：素材组与图块条目 */
interface IFavoriteTileLookup {
  /** 图块所属的素材组 */
  readonly group: IMapTileGroup;
  /** 图块条目 */
  readonly entry: IMapTileEntry;
}

/** 一次进行中的拖拽：起点格与当前悬停格（都是 0..8 的槽位索引） */
interface IFavoriteDrag {
  /** 起点槽位索引 */
  readonly from: number;
  /** 当前悬停的槽位索引 */
  readonly over: number;
}

/** 一个收藏格的渲染输入 */
interface IFavoriteSlotProps {
  /** 槽位索引（0..8） */
  readonly index: number;
  /** 该槽位上的图块编号；0 表示空位 */
  readonly number: number;
  /** 该格的内联样式（背景图与偏移） */
  readonly style: CSSProperties;
  /** 该格是否为当前选中 */
  readonly selected: boolean;
  /** 这一格是否正在被拖动（拖动源降低不透明度，D-48） */
  readonly dragging: boolean;
  /** 指针是否正悬停在这一格且它不是拖动源（悬停目标加描边，D-48） */
  readonly dragOver: boolean;
  /**
   * 选中该槽位
   * @param index 1..9 的收藏位索引（0 留给擦除格）
   */
  onSelect(index: number): void;
  /**
   * 指针按在收藏格上，开始拖拽
   * @param index 起点槽位索引
   */
  onDragStart(index: number): void;
  /**
   * 指针进入某个收藏格，更新悬停格
   * @param index 悬停槽位索引
   */
  onDragOver(index: number): void;
  /**
   * 指针在某个收藏格上松开，结算拖拽
   * @param index 松开所在的槽位索引
   */
  onDragEnd(index: number): void;
}

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
 * @returns 素材组与图块条目；目录缺失、编号为 0 或不存在时为 undefined
 */
function findFavoriteTile(
  groups: readonly IMapTileGroup[] | undefined,
  number: number,
): IFavoriteTileLookup | undefined {
  if (groups === undefined || number <= 0) return undefined;

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
function frameRectOf(lookup: IFavoriteTileLookup | undefined): IMapTileCrop | undefined {
  if (lookup === undefined) return undefined;

  return resolveFrameRect(resolveFrameInfo(lookup.group, lookup.entry), 0);
}

/**
 * 求收藏格的背景样式：整张图集按列 / 行尺寸铺开，再负偏移到该图块的第一帧
 * @param lookup 编号在目录里的归属
 * @param url 该组图片的 blob 地址
 * @param rect 第一帧的源图矩形
 * @returns 内联样式；空位或缺图片时为空对象
 */
function tileBackgroundStyle(
  lookup: IFavoriteTileLookup | undefined,
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
 * 判断某个收藏格是否为当前选中；空位永远不点亮
 * @param number 收藏格上的图块编号
 * @param selection 当前调色板选中
 * @returns 该格被选中时为 true
 */
function isFavoriteSelected(number: number, selection: IMapPaletteSelection): boolean {
  if (number <= 0) return false;
  if (selection.kind === MapPaletteKind.Empty) return false;

  return selection.primaryTileNumber === number;
}

/**
 * 求一个收藏格的可访问名
 * @param index 槽位索引（0..8）
 * @param number 该槽位上的图块编号
 * @returns 「第 N 个收藏位：图块 M」或「第 N 个收藏位：空」
 */
function favoriteSlotLabel(index: number, number: number): string {
  return number > 0 ? `第 ${index + 1} 个收藏位：图块 ${number}` : `第 ${index + 1} 个收藏位：空`;
}

/**
 * 拼接一个收藏格的类名：基础类 + 收藏标记 + 选中 + 拖动态 + 悬停态
 * @param props 收藏格渲染输入
 * @returns 空格分隔的类名；空串会被过滤掉
 */
function favoriteSlotClassName(props: IFavoriteSlotProps): string {
  const names = ['emap-material-cell', 'emap-favorite-tile', 'is-favorite'];

  if (props.selected) names.push('is-selected');
  if (props.dragging) names.push('is-dragging');
  if (props.dragOver) names.push('is-drag-over');

  return names.join(' ');
}

/**
 * 渲染一个收藏格：图块按钮与键位角标
 * @param props 收藏格渲染输入
 * @returns 收藏格元素
 */
function renderFavoriteSlot(props: IFavoriteSlotProps): ReactElement {
  const className = favoriteSlotClassName(props);

  return (
    <div className="emap-favorite-slot" key={props.index} data-empty={String(props.number <= 0)}>
      <button
        type="button"
        className={className}
        data-test-id={`map-favorite-${props.index}`}
        data-tile-number={props.number}
        style={props.style}
        title={favoriteSlotLabel(props.index, props.number)}
        aria-label={favoriteSlotLabel(props.index, props.number)}
        aria-pressed={props.selected}
        onClick={(): void => props.onSelect(props.index + 1)}
        onPointerDown={(): void => props.onDragStart(props.index)}
        onPointerEnter={(): void => props.onDragOver(props.index)}
        onPointerUp={(): void => props.onDragEnd(props.index)}
      >
        <span className="emap-favorite-key" data-test-id={`map-favorite-key-${props.index}`}>
          {MAP_FAVORITE_SLOT_KEYS[props.index]}
        </span>
      </button>
    </div>
  );
}

/**
 * 地图底部的收藏栏：1 个擦除格 + 9 个收藏格
 * @param props 收藏栏 props
 * @returns 收藏栏元素
 */
export function MapFavoriteBar(props: IMapFavoriteBarProps): ReactElement {
  const state = useState<IFavoriteDrag | undefined>(undefined);
  const drag = state[0];
  const setDrag = state[1];
  const eraseSelected = props.selection.kind === MapPaletteKind.Empty;

  return (
    <div className="emap-favorite" data-test-id="map-favorite" onPointerLeave={(): void => setDrag(undefined)}>
      <div className="emap-favorite-slot" data-empty="false">
        <button
          type="button"
          className={eraseSelected ? 'emap-material-cell is-selected' : 'emap-material-cell'}
          data-test-id="map-favorite-erase"
          data-tile-number="0"
          title="擦除（数字键 1）"
          aria-label="擦除（数字键 1）"
          aria-pressed={eraseSelected}
          onClick={(): void => props.onSelectSlot(0)}
        >
          {ERASE_TEXT}
          <span className="emap-favorite-key" data-test-id="map-favorite-key-erase">
            {ERASE_SLOT_KEY}
          </span>
        </button>
      </div>
      {Array.from({ length: MAP_FAVORITE_SLOT_COUNT }, (_unused, index) => index).map((index) => {
        const number = props.favorites[index] ?? 0;
        const lookup = findFavoriteTile(props.groups, number);
        const url = lookup === undefined ? undefined : props.groupUrls[lookup.group.id];

        return renderFavoriteSlot({
          index,
          number,
          style: tileBackgroundStyle(lookup, url, frameRectOf(lookup)),
          selected: isFavoriteSelected(number, props.selection),
          dragging: drag !== undefined && drag.from === index,
          dragOver: drag !== undefined && drag.over === index && drag.from !== index,
          onSelect: props.onSelectSlot,
          onDragStart: (from): void => {
            if (props.reorderDisabled) return;

            setDrag({ from, over: from });
          },
          onDragOver: (over): void => {
            if (drag === undefined || drag.over === over) return;

            setDrag({ from: drag.from, over });
          },
          onDragEnd: (to): void => {
            if (drag === undefined) return;

            setDrag(undefined);

            if (drag.from !== to) props.onReorder(drag.from, to);
          },
        });
      })}
    </div>
  );
}
