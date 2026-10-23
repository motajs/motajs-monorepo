import { MAP_CELL_SIZE, MAP_FRAME_LIMIT, MAP_FRAME_SPEED_DEFAULT } from '../constants';
import {
  IMapFrameInfo,
  IMapTileCrop,
  IMapTileEntry,
  IMapTileGroup,
  MapAutotileType,
  MapFrameAxis,
  MapTextureReadType,
} from '../types';

// 读取方式 → 帧信息：按素材组的读取规则算出帧数 / 帧轴 / 帧步长与第 0 帧矩形，再按帧号给出裁切矩形。
// 全部是纯计算：不读图片、不缓存、不创建模块级可变状态；非法输入一律夹取而不是抛错。
// 自动元件分支优先于读取方式：它的每一帧是整块（3×4 或 2×3）宽度的横向排列。

/**
 * 把素材格尺寸归一化成正整数，非法值退回默认边长
 * @param size 目录给出的素材格尺寸
 * @param fallback 非法时使用的默认边长
 * @returns 可用的素材格尺寸（源图像素）
 */
function resolveCellSize(size: number | undefined, fallback: number): number {
  if (typeof size !== 'number' || !Number.isFinite(size) || size <= 0) return fallback;

  return Math.trunc(size);
}

/**
 * 把帧数夹到 1..`MAP_FRAME_LIMIT`
 * @param count 目录给出的帧数
 * @returns 可用的帧数；非法值按 1 处理
 */
function clampFrameCount(count: number | undefined): number {
  if (typeof count !== 'number' || !Number.isFinite(count)) return 1;

  return Math.min(MAP_FRAME_LIMIT, Math.max(1, Math.trunc(count)));
}

/**
 * 把帧号夹成非负整数
 * @param frame 帧号
 * @returns 非负整数帧号；非法值按 0 处理
 */
function clampFrameIndex(frame: number): number {
  if (!Number.isFinite(frame)) return 0;

  return Math.max(0, Math.trunc(frame));
}

/**
 * 由素材组规则与图块行列算出该图块的帧信息
 *
 * 五种读取方式的帧数 / 帧轴逐条对应引擎语义：`Full` 整图一帧；`Grid` 每格一帧；
 * `RowAnimate` 横向为帧；`ColumnAnimate` 纵向为帧；`ScanAnimate` 整块一组、先左到右再上到下。
 * 帧数一律夹在 `1..MAP_FRAME_LIMIT`；自动元件存在且帧数大于 1 时，帧轴为横向、帧步长为整块宽度。
 * @param group 图块所在的素材组（提供读取方式、单格尺寸、帧数与自动拼接规则）
 * @param entry 图块条目（提供它在素材里的列号与行号）
 * @returns 第 0 帧矩形、帧数、帧轴与帧步长
 */
export function resolveFrameInfo(group: IMapTileGroup, entry: IMapTileEntry): IMapFrameInfo {
  const cellWidth = resolveCellSize(group.cellWidth, MAP_CELL_SIZE);
  const cellHeight = resolveCellSize(group.cellHeight, MAP_CELL_SIZE);
  const count = clampFrameCount(group.frames);
  const cellBase: IMapTileCrop = {
    x: entry.column * cellWidth,
    y: entry.row * cellHeight,
    width: cellWidth,
    height: cellHeight,
  };

  if (group.autotile && count > 1) {
    const blockColumns = group.autotile.type === MapAutotileType.Big3x4 ? 3 : 2;

    return { axis: MapFrameAxis.X, stride: cellWidth * blockColumns, count, base: cellBase };
  }

  const read = group.read ?? MapTextureReadType.Grid;

  if (read === MapTextureReadType.RowAnimate) {
    return {
      axis: MapFrameAxis.X,
      stride: cellWidth,
      count,
      base: { x: 0, y: entry.row * cellHeight, width: cellWidth, height: cellHeight },
    };
  }

  if (read === MapTextureReadType.ColumnAnimate) {
    return {
      axis: MapFrameAxis.Y,
      stride: cellHeight,
      count,
      base: { x: entry.column * cellWidth, y: 0, width: cellWidth, height: cellHeight },
    };
  }

  if (read === MapTextureReadType.ScanAnimate) {
    return {
      axis: MapFrameAxis.Scan,
      stride: cellWidth,
      count,
      base: { x: 0, y: 0, width: cellWidth, height: cellHeight },
    };
  }

  return { axis: MapFrameAxis.None, stride: 0, count: 1, base: cellBase };
}

/**
 * 由帧信息与当前帧号算出该帧在源图上的裁切矩形
 *
 * 静态图块与非法帧号都退回第 0 帧；扫描帧轴需要每行格数才能折行，缺省按一行处理。
 * @param info 帧信息
 * @param frame 帧号（0 基）
 * @param frameColumns 扫描帧轴每行的格数；缺省 1
 * @returns 该帧的源图裁切矩形
 */
export function resolveFrameRect(info: IMapFrameInfo, frame: number, frameColumns: number = 1): IMapTileCrop {
  const base = info.base;
  const index = clampFrameIndex(frame);

  if (info.axis === MapFrameAxis.X) {
    return { x: base.x + index * info.stride, y: base.y, width: base.width, height: base.height };
  }

  if (info.axis === MapFrameAxis.Y) {
    return { x: base.x, y: base.y + index * info.stride, width: base.width, height: base.height };
  }

  if (info.axis === MapFrameAxis.Scan) {
    const columns = Number.isFinite(frameColumns) && frameColumns >= 1 ? Math.trunc(frameColumns) : 1;
    const column = index % columns;
    const row = Math.floor(index / columns);

    return {
      x: base.x + column * info.stride,
      y: base.y + row * base.height,
      width: base.width,
      height: base.height,
    };
  }

  return { x: base.x, y: base.y, width: base.width, height: base.height };
}

/**
 * 由全局帧号与格子的固定帧算出这个格子该显示第几帧
 *
 * `defaultFrame >= 0` 时永远优先于全局帧号；否则按帧数取余，帧数为 1 时恒为 0。
 * @param defaultFrame 格子固定显示第几帧；缺省或负数表示跟随动画时钟
 * @param frameIndex 全局帧号
 * @param frameCount 帧数，1..`MAP_FRAME_LIMIT`
 * @returns 该格子该显示的帧号（0 基）
 */
export function resolveCellFrame(
  defaultFrame: number | undefined,
  frameIndex: number,
  frameCount: number | undefined,
): number {
  if (defaultFrame !== undefined && Number.isFinite(defaultFrame) && defaultFrame >= 0) {
    return Math.trunc(defaultFrame);
  }

  const count = clampFrameCount(frameCount);

  if (count <= 1) return 0;

  return clampFrameIndex(frameIndex) % count;
}

/**
 * 由累计毫秒与帧速算出全局帧号
 *
 * 这是画布动画时钟唯一的时间换算入口：默认帧速 300ms，宿主可覆盖；非法帧速或倒流的时间都退化为第 0 帧。
 * @param elapsedMs 已经过的毫秒数
 * @param frameSpeedMs 每帧毫秒数；缺省 `MAP_FRAME_SPEED_DEFAULT`
 * @returns 全局帧号（0 基）
 */
export function resolveFrameTickAt(elapsedMs: number, frameSpeedMs: number = MAP_FRAME_SPEED_DEFAULT): number {
  if (!Number.isFinite(elapsedMs) || !Number.isFinite(frameSpeedMs)) return 0;
  if (elapsedMs < 0 || frameSpeedMs <= 0) return 0;

  return Math.floor(elapsedMs / frameSpeedMs);
}
