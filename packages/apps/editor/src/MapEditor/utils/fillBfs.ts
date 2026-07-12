/**
 * 填充算法 - BFS 寻找连通区域
 *
 * 迁移自 editor.uifunctions._fillMode_bfs
 */

import type { LocPOD } from "@/utils/coordinate";
import type { BlockInfo } from "../MaterialPanel/types";

/** 地图数据类型 */
type MapCell = BlockInfo | number | 0;
type MapData = MapCell[][];

/**
 * 获取地图单元格的数字标识
 */
function getCellNumber(cell: MapCell): number {
  if (typeof cell === "number") return cell;
  if (cell && typeof cell === "object" && "idnum" in cell) {
    return cell.idnum;
  }
  return 0;
}

/**
 * BFS 寻找与目标点相连的全部相同图块坐标
 *
 * @param array - 二维地图数组
 * @param startX - 起始 X 坐标
 * @param startY - 起始 Y 坐标
 * @param maxWidth - 地图宽度
 * @param maxHeight - 地图高度
 * @returns 所有连通的相同图块坐标数组
 */
export function fillModeBfs(
  array: MapData,
  startX: number,
  startY: number,
  maxWidth: number,
  maxHeight: number
): LocPOD[] {
  const getNumber = (x: number, y: number): number | null => {
    if (x < 0 || y < 0 || x >= maxWidth || y >= maxHeight) return null;
    return getCellNumber(array[y][x]);
  };

  const targetNumber = getNumber(startX, startY) ?? 0;
  const visited = new Set<string>();
  const result: LocPOD[] = [];
  const queue: LocPOD[] = [[startX, startY]];

  // 四方向偏移
  const directions: LocPOD[] = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];

  while (queue.length > 0) {
    const [x, y] = queue.shift()!;
    const key = `${x},${y}`;

    if (visited.has(key)) continue;
    visited.add(key);
    result.push([x, y]);

    for (const [dx, dy] of directions) {
      const nx = x + dx;
      const ny = y + dy;
      const cellNumber = getNumber(nx, ny);

      if (cellNumber === targetNumber) {
        queue.push([nx, ny]);
      }
    }
  }

  return result;
}
