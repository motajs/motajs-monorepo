import { describe, expect, it } from 'vitest';
import { resolveAutotileQuarters } from '../model/autotile';
import { IMapAutotileQuarters, IMapTileCrop, MapAutotileType } from '../types';

// 本文件把仓库外引擎的 `AutotileProcessor.mapAutotile` 与 `getSliceRect` 逐字搬进来做对拍。
// 端口函数只服务本测试，不导出、不进生产代码：引擎是仓库外代码，不能 import，只能内联复刻。
// 比对范围是 0…255 全部连接值 × 两种形状（3×4 / 2×3），任何未来偏离都会在这里立刻变红。

/**
 * 逐字复刻引擎的 `mapAutotile`：由十个形状常量算出每个连接值的四块象限索引
 * @param type 自动元件形状
 * @returns 连接值（0…255）到四块象限索引 `[左上, 右上, 右下, 左下]` 的映射
 */
function portMapAutotile(type: MapAutotileType): Map<number, readonly [number, number, number, number]> {
  const h = type === MapAutotileType.Big3x4 ? 2 : 1; // 横向偏移因子
  const v = type === MapAutotileType.Big3x4 ? 12 : 4; // 纵向偏移因子
  const luo = type === MapAutotileType.Big3x4 ? 12 : 8; // leftup origin
  const ruo = type === MapAutotileType.Big3x4 ? 17 : 11; // rightup origin
  const ldo = type === MapAutotileType.Big3x4 ? 42 : 20; // leftdown origin
  const rdo = type === MapAutotileType.Big3x4 ? 47 : 23; // rightdown origin
  const luc = type === MapAutotileType.Big3x4 ? 4 : 2; // leftup corner
  const ruc = type === MapAutotileType.Big3x4 ? 5 : 3; // rightup corner
  const rdc = type === MapAutotileType.Big3x4 ? 11 : 7; // rightdown corner
  const ldc = type === MapAutotileType.Big3x4 ? 10 : 6; // leftdown corner

  const result = new Map<number, readonly [number, number, number, number]>();

  for (let index = 0; index <= 0b1111_1111; index += 1) {
    let lu = luo;
    let ru = ruo;
    let ld = ldo;
    let rd = rdo;

    if (index & 0b0000_0001) {
      lu += h * 2;
      ld += h * 2;

      if (index & 0b0001_0000) {
        ru += h;
        rd += h;
      }
    }

    if (index & 0b0000_0100) {
      ld -= v * 2;
      rd -= v * 2;

      if (index & 0b0100_0000) {
        lu -= v;
        ru -= v;
      }
    }

    if (index & 0b0001_0000) {
      ru -= h * 2;
      rd -= h * 2;

      if (index & 0b0000_0001) {
        lu -= h;
        ld -= h;
      }
    }

    if (index & 0b0100_0000) {
      lu += v * 2;
      ru += v * 2;

      if (index & 0b0000_0100) {
        ld += v;
        rd += v;
      }
    }

    if ((index & 0b1100_0001) === 0b0100_0001) lu = luc;
    if ((index & 0b0111_0000) === 0b0101_0000) ru = ruc;
    if ((index & 0b0001_1100) === 0b0001_0100) rd = rdc;
    if ((index & 0b0000_0111) === 0b0000_0101) ld = ldc;

    result.set(index, [lu, ru, rd, ld]);
  }

  return result;
}

/**
 * 把一个象限索引换算成源图矩形：逐字复刻引擎 `getSliceRect` 的取模与整除
 * @param index 象限索引
 * @param columns 每行可容纳的象限数：3×4 为 6，2×3 为 4
 * @param halfWidth 半格宽（源图像素）
 * @param halfHeight 半格高（源图像素）
 * @returns 该象限的源图矩形
 */
function portCrop(index: number, columns: number, halfWidth: number, halfHeight: number): IMapTileCrop {
  return {
    x: (index % columns) * halfWidth,
    y: Math.floor(index / columns) * halfHeight,
    width: halfWidth,
    height: halfHeight,
  };
}

/**
 * 逐字复刻引擎的 `getSliceRect`：由连接值取四块象限索引，再换算成源图矩形
 * @param table 端口表（连接值 → 四块象限索引）
 * @param type 自动元件形状
 * @param connection 8 位连接值
 * @param halfWidth 半格宽（源图像素）
 * @param halfHeight 半格高（源图像素）
 * @returns 左上 / 右上 / 右下 / 左下四块源图矩形
 */
function portSliceRect(
  table: ReadonlyMap<number, readonly [number, number, number, number]>,
  type: MapAutotileType,
  connection: number,
  halfWidth: number,
  halfHeight: number,
): IMapAutotileQuarters {
  const data = table.get(connection);

  if (data === undefined) throw new Error(`端口表缺少连接值：${connection}`);

  const columns = type === MapAutotileType.Big3x4 ? 6 : 4;

  return {
    lt: portCrop(data[0], columns, halfWidth, halfHeight),
    rt: portCrop(data[1], columns, halfWidth, halfHeight),
    rb: portCrop(data[2], columns, halfWidth, halfHeight),
    lb: portCrop(data[3], columns, halfWidth, halfHeight),
  };
}

/** 尺寸换算用例挑出的代表性连接值：四个角、四个方向、十字与全连接 */
const REPRESENTATIVE_CONNECTIONS: readonly number[] = [0, 15, 51, 68, 80, 170, 204, 255];

describe('自动拼接与引擎的黄金对拍', () => {
  // 3×4 形状：256 种连接值的四块矩形必须与引擎逐字一致
  it('3×4 的 256 种连接全部与引擎一致', () => {
    const table = portMapAutotile(MapAutotileType.Big3x4);

    for (let connection = 0; connection <= 0b1111_1111; connection += 1) {
      expect(resolveAutotileQuarters(MapAutotileType.Big3x4, connection, 32, 32)).toEqual(
        portSliceRect(table, MapAutotileType.Big3x4, connection, 16, 16),
      );
    }
  });

  // 2×3 形状：同样的 256 种连接值逐一比对
  it('2×3 的 256 种连接全部与引擎一致', () => {
    const table = portMapAutotile(MapAutotileType.Small2x3);

    for (let connection = 0; connection <= 0b1111_1111; connection += 1) {
      expect(resolveAutotileQuarters(MapAutotileType.Small2x3, connection, 32, 32)).toEqual(
        portSliceRect(table, MapAutotileType.Small2x3, connection, 16, 16),
      );
    }
  });

  // 尺寸换算：48×48 的格子取 24×24 半格，证明半格是现算的而不是写死的
  it('48×48 的格子按现算半格对齐引擎', () => {
    const bigTable = portMapAutotile(MapAutotileType.Big3x4);
    const smallTable = portMapAutotile(MapAutotileType.Small2x3);

    for (const connection of REPRESENTATIVE_CONNECTIONS) {
      expect(resolveAutotileQuarters(MapAutotileType.Big3x4, connection, 48, 48)).toEqual(
        portSliceRect(bigTable, MapAutotileType.Big3x4, connection, 24, 24),
      );
      expect(resolveAutotileQuarters(MapAutotileType.Small2x3, connection, 48, 48)).toEqual(
        portSliceRect(smallTable, MapAutotileType.Small2x3, connection, 24, 24),
      );
    }
  });

  // 两张端口表必须各有 256 项，防止循环写漏
  it('两张端口表都覆盖 256 种连接', () => {
    expect(portMapAutotile(MapAutotileType.Big3x4).size).toBe(256);
    expect(portMapAutotile(MapAutotileType.Small2x3).size).toBe(256);
  });
});
