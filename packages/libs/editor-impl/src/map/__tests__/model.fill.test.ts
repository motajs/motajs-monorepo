import { describe, expect, it } from 'vitest';
import { IMapCellPosition } from '../types';
import { fillConnectedPositions } from '../model/fill';

/**
 * 把坐标列表折叠成「x:y」集合，便于断言「恰好是这些格」
 * @param positions 坐标列表
 * @returns 坐标字符串集合
 */
function toKeySet(positions: readonly IMapCellPosition[]): Set<string> {
  return new Set(positions.map((position) => `${position.x}:${position.y}`));
}

describe('fillConnectedPositions 四邻域填充', () => {
  // 四周都不同的单格区域只返回起点本身
  it('单格区域只返回起点', () => {
    const cells: readonly (readonly number[])[] = [
      [1, 2, 1],
      [2, 1, 2],
      [1, 2, 1],
    ];

    expect(fillConnectedPositions(cells, { x: 0, y: 0 }, { width: 3, height: 3 })).toEqual([{ x: 0, y: 0 }]);
  });

  // 一整片同值区域全部返回，起点排在第一个
  it('一整片同值区域全返回', () => {
    const cells: readonly (readonly number[])[] = [
      [1, 1, 1],
      [1, 1, 1],
    ];
    const positions = fillConnectedPositions(cells, { x: 1, y: 1 }, { width: 3, height: 2 });

    expect(positions).toHaveLength(6);
    expect(positions[0]).toEqual({ x: 1, y: 1 });
    expect(toKeySet(positions)).toEqual(new Set(['0:0', '1:0', '2:0', '0:1', '1:1', '2:1']));
  });

  // 遇到不同编号就停止：一列异值把左右两块隔开
  it('不同编号形成的墙会挡住填充', () => {
    const cells: readonly (readonly number[])[] = [
      [1, 2, 1],
      [1, 2, 1],
    ];
    const positions = fillConnectedPositions(cells, { x: 0, y: 0 }, { width: 3, height: 2 });

    expect(toKeySet(positions)).toEqual(new Set(['0:0', '0:1']));
  });

  // 对角相邻不算连通：L 形的一块只填到起点所在的那一侧
  it('对角相邻不算连通', () => {
    const cells: readonly (readonly number[])[] = [
      [1, 2, 2],
      [2, 1, 2],
      [2, 2, 1],
    ];
    const positions = fillConnectedPositions(cells, { x: 0, y: 0 }, { width: 3, height: 3 });

    expect(toKeySet(positions)).toEqual(new Set(['0:0']));
  });

  // 空格（编号 0）区域同样可以填充，用于把空白处整块铺满
  it('空格区域也可以填充', () => {
    const cells: readonly (readonly number[])[] = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    const positions = fillConnectedPositions(cells, { x: 1, y: 1 }, { width: 3, height: 3 });

    expect(positions).toHaveLength(9);
  });

  // 起点在地图角落时不访问越界坐标，结果全部落在 0..宽高-1 之内
  it('起点在角落时不越界', () => {
    const cells: readonly (readonly number[])[] = [
      [5, 5, 0],
      [5, 5, 0],
    ];
    const positions = fillConnectedPositions(cells, { x: 0, y: 0 }, { width: 3, height: 2 });

    expect(positions).toHaveLength(4);
    expect(positions.every((position) => position.x >= 0 && position.y >= 0)).toBe(true);
    expect(positions.every((position) => position.x < 3 && position.y < 2)).toBe(true);
  });

  // 起点在地图外时没有可填的东西，直接返回空数组
  it('起点越界时返回空数组', () => {
    const cells: readonly (readonly number[])[] = [[1, 1]];

    expect(fillConnectedPositions(cells, { x: 2, y: 0 }, { width: 2, height: 1 })).toEqual([]);
    expect(fillConnectedPositions(cells, { x: 0, y: -1 }, { width: 2, height: 1 })).toEqual([]);
  });

  // 200×200 全同值：显式队列能一次走完，不会栈溢出
  it('大区域不爆栈', () => {
    const size = 200;
    const rows: number[][] = [];

    for (let y = 0; y < size; y += 1) {
      const row: number[] = [];
      for (let x = 0; x < size; x += 1) row.push(3);
      rows.push(row);
    }

    const positions = fillConnectedPositions(rows, { x: 0, y: 0 }, { width: size, height: size });

    expect(positions).toHaveLength(size * size);
  });
});
