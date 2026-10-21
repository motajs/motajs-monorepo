import { IMapCellPosition, IMapClipboard, IMapRect, IMapSize } from '../types';
import { IPaintWrite } from './document';
import { clampRectToMap } from './geometry';

// 区域复制 / 粘贴 / 清空：复制只取当前图层的数字块，粘贴以给定格为左上角、越界逐格跳过。
// 三个函数都只算「要写哪些格、写什么」，不读文档、不碰撤销；被跳过的格数由这里统计，视图层拿它提示用户。

export interface IMapPasteResult {
  /** 依次要落下的写入；完全落在地图外时为空 */
  readonly writes: readonly IPaintWrite[];
  /** 因为越出地图而被跳过的格子数 */
  readonly clipped: number;
}

/**
 * 复制一块区域：先把矩形裁到地图内，再按行主序把编号拷进剪贴板
 *
 * 剪贴板只含宽、高与编号，不含任何事件或引擎字段。
 * @param cells 当前图层的二维格子（`[y][x]`）
 * @param rect 要复制的矩形
 * @param size 地图宽高
 * @returns 剪贴块；矩形完全在地图外或被裁空时宽高都是 0、编号为空
 */
export function copyMapRegion(cells: readonly (readonly number[])[], rect: IMapRect, size: IMapSize): IMapClipboard {
  const clamped = clampRectToMap(rect, size.width, size.height).rect;
  if (clamped.width === 0 || clamped.height === 0) return { width: 0, height: 0, tiles: [] };

  const tiles: number[] = [];

  for (let y = clamped.y; y < clamped.y + clamped.height; y += 1) {
    const row = cells[y];

    for (let x = clamped.x; x < clamped.x + clamped.width; x += 1) tiles.push(row === undefined ? 0 : (row[x] ?? 0));
  }

  return { width: clamped.width, height: clamped.height, tiles };
}

/**
 * 算出一次粘贴要写的格子：以 topLeft 为左上角，逐格判断是否落在地图内
 *
 * 越界格只计入 clipped，绝不产生越界写入；剪贴板尺寸与地图尺寸无关。
 * @param clipboard 剪贴块
 * @param topLeft 粘贴位置的左上角
 * @param size 地图宽高
 * @returns 要落下的写入与被跳过的格子数
 */
export function buildPasteWrites(clipboard: IMapClipboard, topLeft: IMapCellPosition, size: IMapSize): IMapPasteResult {
  const writes: IPaintWrite[] = [];
  let clipped = 0;

  for (let row = 0; row < clipboard.height; row += 1) {
    for (let column = 0; column < clipboard.width; column += 1) {
      const x = topLeft.x + column;
      const y = topLeft.y + row;

      if (x < 0 || y < 0 || x >= size.width || y >= size.height) {
        clipped += 1;
        continue;
      }

      writes.push({ x, y, value: clipboard.tiles[row * clipboard.width + column] ?? 0 });
    }
  }

  return { writes, clipped };
}

/**
 * 算出「清空一块区域」要写的格子：先把矩形裁到地图内，再全部写成 0
 * @param rect 要清空的矩形
 * @param size 地图宽高
 * @returns 行主序排列、编号全为 0 的写入
 */
export function buildClearWrites(rect: IMapRect, size: IMapSize): readonly IPaintWrite[] {
  const clamped = clampRectToMap(rect, size.width, size.height).rect;
  const writes: IPaintWrite[] = [];

  for (let y = clamped.y; y < clamped.y + clamped.height; y += 1) {
    for (let x = clamped.x; x < clamped.x + clamped.width; x += 1) writes.push({ x, y, value: 0 });
  }

  return writes;
}
