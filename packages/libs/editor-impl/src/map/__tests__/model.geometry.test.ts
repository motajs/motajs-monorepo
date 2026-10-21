import { describe, expect, it } from 'vitest';
import { IMapCellPosition } from '../types';
import { clampRectToMap, normalizeRect, rectanglePositions, walkOrthogonalPath } from '../model/geometry';

/**
 * 断言一条路径是正交且连续的：每一步只改变一个轴，且相邻两步的曼哈顿距离为 1
 * @param start 路径起点
 * @param path 路径上的格子
 */
function expectOrthogonalPath(start: IMapCellPosition, path: readonly IMapCellPosition[]): void {
  let previous = start;

  for (const step of path) {
    expect(Math.abs(step.x - previous.x) + Math.abs(step.y - previous.y)).toBe(1);
    previous = step;
  }
}

describe('walkOrthogonalPath 正交路径', () => {
  // 斜向拖动补齐斜线经过的格子：路径正交、连续，终点恰好是拖到的格子
  it('斜向拖动得到无断点的正交路径', () => {
    const path = walkOrthogonalPath({ x: 0, y: 0 }, { x: 3, y: 2 });

    expect(path).toHaveLength(5);
    expect(path[path.length - 1]).toEqual({ x: 3, y: 2 });
    expectOrthogonalPath({ x: 0, y: 0 }, path);
  });

  // 起点与终点相同表示没有移动，路径为空（不会写入起点那一格）
  it('起点与终点相同时返回空路径', () => {
    expect(walkOrthogonalPath({ x: 4, y: 4 }, { x: 4, y: 4 })).toEqual([]);
  });

  // 纯纵向拖动逐行前进，不产生横向偏移
  it('纯纵向拖动只改变纵坐标', () => {
    const path = walkOrthogonalPath({ x: 2, y: 5 }, { x: 2, y: 2 });

    expect(path).toEqual([
      { x: 2, y: 4 },
      { x: 2, y: 3 },
      { x: 2, y: 2 },
    ]);
  });
});

describe('rectanglePositions 矩形展开', () => {
  // 矩形包含起止两条边界，并按行主序排列
  it('包含起止边界且行优先', () => {
    const positions = rectanglePositions({ x: 2, y: 1 }, { x: 0, y: 0 });

    expect(positions).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ]);
  });

  // 两个角点重合时矩形退化成单格
  it('两角重合时只有一格', () => {
    expect(rectanglePositions({ x: 7, y: 7 }, { x: 7, y: 7 })).toEqual([{ x: 7, y: 7 }]);
  });
});

describe('normalizeRect 矩形归一化', () => {
  // 无论两个角点以哪个方向给出，都整理成同一个左上角 + 宽高
  it('四个方向的两点给出同一矩形', () => {
    const pairs: readonly (readonly [IMapCellPosition, IMapCellPosition])[] = [
      [
        { x: 1, y: 1 },
        { x: 5, y: 4 },
      ],
      [
        { x: 5, y: 4 },
        { x: 1, y: 1 },
      ],
      [
        { x: 5, y: 1 },
        { x: 1, y: 4 },
      ],
      [
        { x: 1, y: 4 },
        { x: 5, y: 1 },
      ],
    ];

    for (const [a, b] of pairs) expect(normalizeRect(a, b)).toEqual({ x: 1, y: 1, width: 5, height: 4 });
  });
});

describe('clampRectToMap 越界裁剪', () => {
  // 完全在地图内的矩形原样返回，没有格子被裁掉
  it('完全在地图内时不裁剪', () => {
    const result = clampRectToMap({ x: 1, y: 1, width: 2, height: 2 }, 4, 3);

    expect(result.rect).toEqual({ x: 1, y: 1, width: 2, height: 2 });
    expect(result.clipped).toBe(0);
  });

  // 部分越界时裁到地图边界，被裁格数等于原面积减去保留面积
  it('部分越界时裁剪并统计被裁格数', () => {
    const result = clampRectToMap({ x: 3, y: 2, width: 3, height: 3 }, 4, 3);

    expect(result.rect).toEqual({ x: 3, y: 2, width: 1, height: 1 });
    expect(result.clipped).toBe(8);
  });

  // 负坐标同样按地图左上边界裁剪，不产生越界写入
  it('负坐标被夹到地图左上角', () => {
    const result = clampRectToMap({ x: -2, y: -1, width: 4, height: 3 }, 4, 3);

    expect(result.rect).toEqual({ x: 0, y: 0, width: 2, height: 2 });
    expect(result.clipped).toBe(8);
  });

  // 完全在地图外时宽高为 0，被裁格数等于原矩形的全部格子
  it('完全在地图外时宽高为 0', () => {
    const result = clampRectToMap({ x: 10, y: 10, width: 2, height: 3 }, 4, 3);

    expect(result.rect.width).toBe(0);
    expect(result.rect.height).toBe(0);
    expect(result.clipped).toBe(6);
  });
});
