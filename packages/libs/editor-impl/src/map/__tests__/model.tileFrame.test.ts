import { describe, expect, it } from 'vitest';
import { MAP_FRAME_LIMIT, MAP_FRAME_SPEED_DEFAULT } from '../constants';
import { resolveCellFrame, resolveFrameInfo, resolveFrameRect, resolveFrameTickAt } from '../model/tileFrame';
import { IMapTileEntry, MapAutotileType, MapFrameAxis, MapTextureReadType } from '../types';
import { createSizedTileGroup } from './fixtures';

// 读取方式到帧信息的纯函数测试：五种读取方式的帧数 / 帧矩形 / 帧轴 / 帧步长，帧数夹取，动画时钟。
// 全部断言具体数值（不 snapshot）：这些数字是画布动画与素材区预览共同的帧契约。

/**
 * 造一个只带编号与行列的图块条目
 * @param column 图集列号
 * @param row 图集行号
 * @param defaultFrame 固定显示第几帧；缺省表示跟随动画时钟
 * @returns 图块条目
 */
function createEntry(column: number, row: number, defaultFrame?: number): IMapTileEntry {
  return {
    number: 1,
    column,
    row,
    crop: { x: 0, y: 0, width: 0, height: 0 },
    name: '图块 1',
    pass: {
      out: { up: true, right: true, down: true, left: true },
      in: { up: true, right: true, down: true, left: true },
      onlyEventLayer: false,
    },
    defaultFrame,
  };
}

describe('resolveFrameInfo 读取方式 → 帧信息', () => {
  // Full：整张图就是一帧，矩形覆盖整张源图（素材格尺寸即图片尺寸）
  it('Full 只有一帧且覆盖整张源图', () => {
    const group = createSizedTileGroup({ read: MapTextureReadType.Full, cellWidth: 64, cellHeight: 48, frames: 1 });

    expect(resolveFrameInfo(group, createEntry(0, 0))).toEqual({
      axis: MapFrameAxis.None,
      stride: 0,
      count: 1,
      base: { x: 0, y: 0, width: 64, height: 48 },
    });
  });

  // Grid：每格一帧，列 1 行 0 的矩形从素材格宽处开始
  it('Grid 每格一帧且按行列定位', () => {
    const group = createSizedTileGroup({ read: MapTextureReadType.Grid, columns: 2, frames: 1 });

    expect(resolveFrameInfo(group, createEntry(1, 0))).toEqual({
      axis: MapFrameAxis.None,
      stride: 0,
      count: 1,
      base: { x: 32, y: 0, width: 32, height: 32 },
    });
  });

  // RowAnimate：帧沿横向排列，帧数为素材组帧数，第 0 帧从该行起点开始
  it('RowAnimate 横向为帧且按行定位', () => {
    const group = createSizedTileGroup({ read: MapTextureReadType.RowAnimate, columns: 4, frames: 4 });

    expect(resolveFrameInfo(group, createEntry(0, 1))).toEqual({
      axis: MapFrameAxis.X,
      stride: 32,
      count: 4,
      base: { x: 0, y: 32, width: 32, height: 32 },
    });
  });

  // ColumnAnimate：帧沿纵向排列，步长为素材格高，第 0 帧从该列起点开始
  it('ColumnAnimate 纵向为帧且按列定位', () => {
    const group = createSizedTileGroup({ read: MapTextureReadType.ColumnAnimate, columns: 2, frames: 3 });

    expect(resolveFrameInfo(group, createEntry(2, 0))).toEqual({
      axis: MapFrameAxis.Y,
      stride: 32,
      count: 3,
      base: { x: 64, y: 0, width: 32, height: 32 },
    });
  });

  // ScanAnimate：整个图块是一组动画，帧轴为逐行扫描，第 0 帧从左上角开始
  it('ScanAnimate 整块一组动画且从左上角开始', () => {
    const group = createSizedTileGroup({ read: MapTextureReadType.ScanAnimate, columns: 2, frames: 4 });

    expect(resolveFrameInfo(group, createEntry(0, 0))).toEqual({
      axis: MapFrameAxis.Scan,
      stride: 32,
      count: 4,
      base: { x: 0, y: 0, width: 32, height: 32 },
    });
  });

  // 自动元件的帧步长是整块宽度：3×4 为 3 格宽，2×3 为 2 格宽
  it('自动元件按形状给出整块宽度的帧步长', () => {
    const big = createSizedTileGroup({
      read: MapTextureReadType.Grid,
      frames: 4,
      autotile: { type: MapAutotileType.Big3x4, connections: [] },
    });
    const small = createSizedTileGroup({
      read: MapTextureReadType.Grid,
      frames: 2,
      autotile: { type: MapAutotileType.Small2x3, connections: [] },
    });

    expect(resolveFrameInfo(big, createEntry(0, 0))).toEqual({
      axis: MapFrameAxis.X,
      stride: 96,
      count: 4,
      base: { x: 0, y: 0, width: 32, height: 32 },
    });
    expect(resolveFrameInfo(small, createEntry(0, 0))).toEqual({
      axis: MapFrameAxis.X,
      stride: 64,
      count: 2,
      base: { x: 0, y: 0, width: 32, height: 32 },
    });
  });

  // 帧数夹在 1..255：目录给 0 按 1，给 999 按上限，没给按 1
  it('帧数被夹取到 1 到上限之间', () => {
    const zero = createSizedTileGroup({ read: MapTextureReadType.RowAnimate, frames: 0 });
    const huge = createSizedTileGroup({ read: MapTextureReadType.RowAnimate, frames: 999 });
    const missing = createSizedTileGroup({ read: MapTextureReadType.RowAnimate, frames: undefined });

    expect(resolveFrameInfo(zero, createEntry(0, 0)).count).toBe(1);
    expect(resolveFrameInfo(huge, createEntry(0, 0)).count).toBe(MAP_FRAME_LIMIT);
    expect(resolveFrameInfo(missing, createEntry(0, 0)).count).toBe(1);
  });
});

describe('resolveFrameRect 帧矩形', () => {
  // 横向帧轴：第 n 帧的横坐标 = 第 0 帧 + n × 步长
  it('横向帧轴按步长右移', () => {
    const group = createSizedTileGroup({ read: MapTextureReadType.RowAnimate, frames: 4 });
    const info = resolveFrameInfo(group, createEntry(0, 1));

    expect(resolveFrameRect(info, 2)).toEqual({ x: 64, y: 32, width: 32, height: 32 });
  });

  // 纵向帧轴：第 n 帧的纵坐标 = 第 0 帧 + n × 步长
  it('纵向帧轴按步长下移', () => {
    const group = createSizedTileGroup({ read: MapTextureReadType.ColumnAnimate, frames: 3 });
    const info = resolveFrameInfo(group, createEntry(2, 0));

    expect(resolveFrameRect(info, 1)).toEqual({ x: 64, y: 32, width: 32, height: 32 });
  });

  // 扫描帧轴：列数 2 时第 3 帧折到第 2 行第 2 列
  it('扫描帧轴按每行格数折行', () => {
    const group = createSizedTileGroup({ read: MapTextureReadType.ScanAnimate, columns: 2, frames: 4 });
    const info = resolveFrameInfo(group, createEntry(0, 0));

    expect(resolveFrameRect(info, 3, 2)).toEqual({ x: 32, y: 32, width: 32, height: 32 });
  });

  // 静态帧轴：任何帧号都返回第 0 帧矩形
  it('静态帧轴始终返回同一矩形', () => {
    const group = createSizedTileGroup({ read: MapTextureReadType.Grid, columns: 2 });
    const info = resolveFrameInfo(group, createEntry(1, 1));

    expect(resolveFrameRect(info, 5)).toEqual({ x: 32, y: 32, width: 32, height: 32 });
  });
});

describe('resolveCellFrame 格子该显示第几帧', () => {
  // defaultFrame >= 0 时永远优先于全局帧号
  it('defaultFrame 优先于全局帧号', () => {
    expect(resolveCellFrame(2, 7, 4)).toBe(2);
    expect(resolveCellFrame(0, 7, 4)).toBe(0);
  });

  // 跟随时钟：全局帧号对帧数取余，帧数为 1 时恒为 0
  it('没有 defaultFrame 时按帧数取余', () => {
    expect(resolveCellFrame(undefined, 7, 4)).toBe(3);
    expect(resolveCellFrame(-1, 6, 4)).toBe(2);
    expect(resolveCellFrame(undefined, 7, 1)).toBe(0);
  });
});

describe('resolveFrameTickAt 动画时钟', () => {
  // 默认帧速为 300ms：0 / 299 / 599 / 600 毫秒分别落在第 0 / 0 / 1 / 2 帧
  it('默认 300ms 帧速下的全局帧号', () => {
    expect(MAP_FRAME_SPEED_DEFAULT).toBe(300);
    expect(resolveFrameTickAt(0, MAP_FRAME_SPEED_DEFAULT)).toBe(0);
    expect(resolveFrameTickAt(299, MAP_FRAME_SPEED_DEFAULT)).toBe(0);
    expect(resolveFrameTickAt(599, MAP_FRAME_SPEED_DEFAULT)).toBe(1);
    expect(resolveFrameTickAt(600, MAP_FRAME_SPEED_DEFAULT)).toBe(2);
  });

  // 宿主覆盖为 150ms 时，同样的时间给出两倍速的帧号
  it('宿主覆盖 150ms 帧速下的全局帧号', () => {
    expect(resolveFrameTickAt(150, 150)).toBe(1);
    expect(resolveFrameTickAt(299, 150)).toBe(1);
    expect(resolveFrameTickAt(300, 150)).toBe(2);
  });

  // 非法输入退化为第 0 帧，不抛错
  it('帧速为 0 或时间倒流时返回第 0 帧', () => {
    expect(resolveFrameTickAt(500, 0)).toBe(0);
    expect(resolveFrameTickAt(500, -1)).toBe(0);
    expect(resolveFrameTickAt(-1, 300)).toBe(0);
  });
});
