import { describe, expect, it } from 'vitest';
import { IMapBrushPattern, IMapCellPosition } from '../types';
import { IPaintWrite } from '../model/document';
import { buildFillWrites, buildRectWrites, buildStrokeWrites, tileNumberAt } from '../model/brush';

/**
 * 造一个行主序的笔刷图案
 * @param width 图案宽度（格子数）
 * @param height 图案高度（格子数）
 * @param tiles 行主序的图块编号，可以少于宽高乘积（缺格按 0 处理）
 * @returns 笔刷图案
 */
function createPattern(width: number, height: number, tiles: readonly number[]): IMapBrushPattern {
  return { width, height, tiles };
}

/**
 * 按写入顺序折叠成一格一个值：后写覆盖先写
 * @param writes 依次落下的写入
 * @returns 「x:y」到最终编号的映射
 */
function resolveWrites(writes: readonly IPaintWrite[]): Map<string, number> {
  const values: Map<string, number> = new Map();

  for (const write of writes) values.set(`${write.x}:${write.y}`, write.value);

  return values;
}

describe('tileNumberAt 图案取号', () => {
  // 1×1 图案在任何格子上都取到唯一编号
  it('1×1 图案只有一个编号', () => {
    const pattern = createPattern(1, 1, [7]);

    expect(tileNumberAt(pattern, { x: 2, y: 3 }, { x: 9, y: 9 })).toBe(7);
  });

  // 2×2 图案按图案内偏移取号，锚点是图案左上角
  it('2×2 图案按图案内偏移取号', () => {
    const pattern = createPattern(2, 2, [1, 2, 3, 4]);
    const anchor: IMapCellPosition = { x: 5, y: 5 };

    expect(tileNumberAt(pattern, anchor, { x: 5, y: 5 })).toBe(1);
    expect(tileNumberAt(pattern, anchor, { x: 6, y: 5 })).toBe(2);
    expect(tileNumberAt(pattern, anchor, { x: 5, y: 6 })).toBe(3);
    expect(tileNumberAt(pattern, anchor, { x: 6, y: 6 })).toBe(4);
  });

  // 空图案没有可取的内容，一律按 0 处理
  it('空图案返回 0', () => {
    expect(tileNumberAt(createPattern(0, 0, []), { x: 0, y: 0 }, { x: 0, y: 0 })).toBe(0);
    expect(buildStrokeWrites([{ x: 0, y: 0 }], createPattern(0, 0, []))).toEqual([]);
  });
});

describe('buildStrokeWrites 线笔刷', () => {
  // 1×1 图案在单点落笔只写一格
  it('1×1 图案单点落笔写一格', () => {
    expect(buildStrokeWrites([{ x: 2, y: 3 }], createPattern(1, 1, [7]))).toEqual([{ x: 2, y: 3, value: 7 }]);
  });

  // 2×2 图案单点落笔写出四格，指针格是图案左上角
  it('2×2 图案单点落笔写四格', () => {
    const writes = buildStrokeWrites([{ x: 5, y: 5 }], createPattern(2, 2, [1, 2, 3, 4]));

    expect(writes).toEqual([
      { x: 5, y: 5, value: 1 },
      { x: 6, y: 5, value: 2 },
      { x: 5, y: 6, value: 3 },
      { x: 6, y: 6, value: 4 },
    ]);
  });

  // 相邻位置重叠时以最后一次写入为准：数组顺序本身就是覆盖规则
  it('线上连续落笔时后写覆盖先写', () => {
    const writes = buildStrokeWrites(
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      createPattern(2, 2, [1, 2, 3, 4]),
    );
    const values = resolveWrites(writes);

    expect(writes).toHaveLength(8);
    expect(values.get('0:0')).toBe(1);
    expect(values.get('1:0')).toBe(1);
    expect(values.get('2:0')).toBe(2);
    expect(values.get('0:1')).toBe(3);
    expect(values.get('1:1')).toBe(3);
    expect(values.get('2:1')).toBe(4);
  });
});

describe('buildRectWrites 矩形笔刷', () => {
  // 矩形内按图案宽高取模平铺，不是把单个笔刷拉伸到整块
  it('矩形内按图案平铺', () => {
    const writes = buildRectWrites({ x: 0, y: 0, width: 6, height: 3 }, createPattern(2, 2, [1, 2, 3, 4]), {
      x: 0,
      y: 0,
    });
    const values = resolveWrites(writes);

    expect(writes).toHaveLength(18);
    expect(values.get('0:0')).toBe(1);
    expect(values.get('5:2')).toBe(2);
    expect(values.get('3:1')).toBe(4);
    expect(values.get('4:2')).toBe(1);
  });

  // 锚点偏移决定平铺相位：图案左上角落在锚点上，而不是矩形左上角
  it('锚点决定平铺相位', () => {
    const writes = buildRectWrites({ x: 1, y: 1, width: 2, height: 1 }, createPattern(2, 2, [1, 2, 3, 4]), {
      x: 1,
      y: 2,
    });
    const values = resolveWrites(writes);

    expect(values.get('1:1')).toBe(3);
    expect(values.get('2:1')).toBe(4);
  });
});

describe('buildFillWrites 填充笔刷', () => {
  // 连通区域上的每个格子按图案平铺取号，锚点为点击格
  it('填充位置按图案平铺', () => {
    const writes = buildFillWrites(
      [
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 1, y: 2 },
        { x: 3, y: 3 },
      ],
      createPattern(2, 2, [1, 2, 3, 4]),
      { x: 1, y: 1 },
    );

    expect(writes).toEqual([
      { x: 1, y: 1, value: 1 },
      { x: 2, y: 1, value: 2 },
      { x: 1, y: 2, value: 3 },
      { x: 3, y: 3, value: 1 },
    ]);
  });
});

describe('擦除与缺格', () => {
  // 全 0 图案就是擦除：与画笔走同一条写路径，只是把覆盖范围写成 0
  it('全 0 图案写出 0', () => {
    const writes = buildStrokeWrites([{ x: 0, y: 0 }], createPattern(2, 2, [0, 0, 0, 0]));

    expect(writes).toHaveLength(4);
    expect(writes.every((write) => write.value === 0)).toBe(true);
  });

  // 图案组内缺格（编号数组比宽高乘积短）按 0 处理，不产生越界编号
  it('图案缺格按 0 处理', () => {
    const writes = buildStrokeWrites([{ x: 0, y: 0 }], createPattern(2, 2, [9]));

    expect(writes).toEqual([
      { x: 0, y: 0, value: 9 },
      { x: 1, y: 0, value: 0 },
      { x: 0, y: 1, value: 0 },
      { x: 1, y: 1, value: 0 },
    ]);
  });
});
