import { describe, expect, it } from 'vitest';
import { computeAutotileConnection, resolveAutotileQuarters } from '../model/autotile';
import { IMapAutotileQuarters, MapAutotileType } from '../types';

// 自动拼接的纯函数测试：8 位连接数（连接位、边缘掩码、地图外视为已连接）与 3×4 / 2×3 的四块象限矩形。
// 连接位与形状常量逐字来自引擎，断言写具体数值而不是关系，任何一位错位都会让测试红。

describe('computeAutotileConnection 连接数', () => {
  // 单格地图：八个方向全在地图外，全部视为已连接
  it('单格地图连接数为全 1', () => {
    expect(computeAutotileConnection([[5]], 0, 0, new Set())).toBe(0b1111_1111);
  });

  // 单行地图：首位右侧还有格子、末位左侧还有格子，因此首末各少一位；中间两侧都在图内
  it('单行地图的三个位置给出专用掩码', () => {
    const cells = [[1, 2, 3]];

    expect(computeAutotileConnection(cells, 0, 0, new Set())).toBe(0b1110_1111);
    expect(computeAutotileConnection(cells, 1, 0, new Set())).toBe(0b1110_1110);
    expect(computeAutotileConnection(cells, 2, 0, new Set())).toBe(0b1111_1110);
  });

  // 单列地图：首末各少一位上下方向的连接；中间上下都在图内
  it('单列地图的三个位置给出专用掩码', () => {
    const cells = [[1], [2], [3]];

    expect(computeAutotileConnection(cells, 0, 0, new Set())).toBe(0b1111_1011);
    expect(computeAutotileConnection(cells, 0, 1, new Set())).toBe(0b1011_1011);
    expect(computeAutotileConnection(cells, 0, 2, new Set())).toBe(0b1011_1111);
  });

  // 3×3 同值地图：中心与周围八格全部同值，最高位左上、顺时针
  it('同值地图中心格八个方向全部连接', () => {
    const cells = [
      [7, 7, 7],
      [7, 7, 7],
      [7, 7, 7],
    ];

    expect(computeAutotileConnection(cells, 1, 1, new Set())).toBe(0b1111_1111);
  });

  // 3×3 上方一行不同值：左上的三位（LeftUp / Up / RightUp）断开，其余五方向仍连接
  it('上方一行不同值时只断开上方三位', () => {
    const cells = [
      [3, 3, 3],
      [7, 7, 7],
      [7, 7, 7],
    ];
    const connection = computeAutotileConnection(cells, 1, 1, new Set());

    expect(connection).toBe(0b0001_1111);
    expect(connection & 0b1000_0000).toBe(0);
    expect(connection & 0b0100_0000).toBe(0);
    expect(connection & 0b0010_0000).toBe(0);
  });

  // 地图外一律视为已连接：左上角格子的左上、上、左三位必然为 1
  it('地图外视为已连接', () => {
    const cells = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ];
    const connection = computeAutotileConnection(cells, 0, 0, new Set());

    expect(connection).toBe(0b1110_0011);
    expect(connection & 0b1000_0000).toBe(0b1000_0000);
    expect(connection & 0b0100_0000).toBe(0b0100_0000);
    expect(connection & 0b0000_0001).toBe(0b0000_0001);
  });

  // 宿主给了连接集合时按「是否在集合里」判定单方面连接，而不是按同值判定
  it('连接集合非空时按集合判定', () => {
    const cells = [
      [1, 2, 2],
      [2, 2, 2],
      [2, 2, 2],
    ];

    expect(computeAutotileConnection(cells, 0, 0, new Set())).toBe(0b1110_0011);
    expect(computeAutotileConnection(cells, 0, 0, new Set([2]))).toBe(0b1111_1111);
  });

  // 非自动元件（中心格为 0）与越界坐标都返回 0，不抛错
  it('空格与越界坐标返回 0', () => {
    const cells = [
      [0, 1],
      [1, 1],
    ];

    expect(computeAutotileConnection(cells, 0, 0, new Set())).toBe(0);
    expect(computeAutotileConnection(cells, -1, 0, new Set())).toBe(0);
    expect(computeAutotileConnection(cells, 2, 1, new Set())).toBe(0);
    expect(computeAutotileConnection([], 0, 0, new Set())).toBe(0);
  });
});

describe('resolveAutotileQuarters 四块象限矩形', () => {
  // 3×4 无连接：四个角分别取 luo / ruo / rdo / ldo，每块是素材单格的一半
  it('3×4 无连接时取四个角且互不相同', () => {
    const quarters = resolveAutotileQuarters(MapAutotileType.Big3x4, 0, 32, 32);

    expect(quarters).toEqual({
      lt: { x: 0, y: 32, width: 16, height: 16 },
      rt: { x: 80, y: 32, width: 16, height: 16 },
      rb: { x: 80, y: 112, width: 16, height: 16 },
      lb: { x: 0, y: 112, width: 16, height: 16 },
    });
    expect(countDistinctQuarters(quarters)).toBe(4);
  });

  // 2×3 无连接：每行只容纳 4 个象限，四个角落在各自的格位
  it('2×3 无连接时取四个角且互不相同', () => {
    const quarters = resolveAutotileQuarters(MapAutotileType.Small2x3, 0, 32, 32);

    expect(quarters).toEqual({
      lt: { x: 0, y: 32, width: 16, height: 16 },
      rt: { x: 48, y: 32, width: 16, height: 16 },
      rb: { x: 48, y: 80, width: 16, height: 16 },
      lb: { x: 0, y: 80, width: 16, height: 16 },
    });
    expect(countDistinctQuarters(quarters)).toBe(4);
  });

  // 四方向都连接：四块落在十字正中，取自十字内容而非四个角
  it('3×4 十字连接时使用十字内容', () => {
    expect(resolveAutotileQuarters(MapAutotileType.Big3x4, 0b0101_0001, 32, 32)).toEqual({
      lt: { x: 64, y: 0, width: 16, height: 16 },
      rt: { x: 80, y: 0, width: 16, height: 16 },
      rb: { x: 80, y: 16, width: 16, height: 16 },
      lb: { x: 64, y: 16, width: 16, height: 16 },
    });
  });

  // 每块宽高是素材单格的一半（不是整格），随素材格尺寸变化
  it('矩形宽高为素材单格的一半', () => {
    const quarters = resolveAutotileQuarters(MapAutotileType.Big3x4, 0b1111_1111, 48, 24);

    expect(quarters.lt.width).toBe(24);
    expect(quarters.lt.height).toBe(12);
    expect(quarters.rt.width).toBe(24);
    expect(quarters.rb.height).toBe(12);
  });

  // 非法形状输入：格尺寸为 0 时给四个零矩形，连接数越界时夹取而不是抛错
  it('非法输入退化为零矩形或夹取', () => {
    const empty = resolveAutotileQuarters(MapAutotileType.Big3x4, 0b1111_1111, 0, 32);
    const zeroRect = { x: 0, y: 0, width: 0, height: 0 };

    expect(empty).toEqual({ lt: zeroRect, rt: zeroRect, rb: zeroRect, lb: zeroRect });
    expect(resolveAutotileQuarters(MapAutotileType.Big3x4, -1, 32, 32)).toEqual(
      resolveAutotileQuarters(MapAutotileType.Big3x4, 0, 32, 32),
    );
  });
});

/**
 * 统计四块矩形里互不相同的个数
 * @param quarters 四块象限矩形
 * @returns 去重后的矩形数
 */
function countDistinctQuarters(quarters: IMapAutotileQuarters): number {
  const keys: Set<string> = new Set();

  for (const rect of [quarters.lt, quarters.rt, quarters.rb, quarters.lb]) {
    keys.add(`${rect.x}:${rect.y}:${rect.width}:${rect.height}`);
  }

  return keys.size;
}
