import { IMapCellPosition, IMapSize } from '../types';

// 四邻域连通填充：只收集与起点同值、且在上下左右方向上连通的格子。
// 用显式队列加访问集合，不做递归，因此大地图上也不会爆栈；越界一律不访问。

/**
 * 读某一格的编号；坐标越界或整行缺失时返回 undefined
 * @param cells 当前图层的二维格子（`[y][x]`）
 * @param position 要读的格子
 * @param size 地图宽高
 * @returns 该格编号；不可访问时为 undefined
 */
function readCell(
  cells: readonly (readonly number[])[],
  position: IMapCellPosition,
  size: IMapSize,
): number | undefined {
  if (position.x < 0 || position.y < 0) return undefined;
  if (position.x >= size.width || position.y >= size.height) return undefined;

  const row = cells[position.y];

  return row === undefined ? undefined : row[position.x];
}

/**
 * 把一个邻居格放进待访问队列：越界、非目标值、已经入队过的都直接跳过
 * @param queue 待访问队列
 * @param marked 已入队格子的键集合（键为 `y * 宽度 + x`）
 * @param cells 当前图层的二维格子（`[y][x]`）
 * @param position 邻居格坐标
 * @param size 地图宽高
 * @param target 起点格的编号
 */
function enqueueNeighbor(
  queue: IMapCellPosition[],
  marked: Set<number>,
  cells: readonly (readonly number[])[],
  position: IMapCellPosition,
  size: IMapSize,
  target: number,
): void {
  if (readCell(cells, position, size) !== target) return;

  const key = position.y * size.width + position.x;
  if (marked.has(key)) return;

  marked.add(key);
  queue.push(position);
}

/**
 * 找出与起点同值且四邻域连通的全部格子
 *
 * 结果从起点开始、按访问顺序排列；只做上 / 下 / 左 / 右四个方向，对角相邻不算连通。
 * 起点越界时返回空数组。
 * @param cells 当前图层的二维格子（`[y][x]`）
 * @param start 起点（点击格），包含在结果里
 * @param size 地图宽高
 * @returns 连通区域覆盖的格子
 */
export function fillConnectedPositions(
  cells: readonly (readonly number[])[],
  start: IMapCellPosition,
  size: IMapSize,
): readonly IMapCellPosition[] {
  const target = readCell(cells, start, size);
  if (target === undefined) return [];

  const queue: IMapCellPosition[] = [start];
  const marked: Set<number> = new Set([start.y * size.width + start.x]);
  const positions: IMapCellPosition[] = [];

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const position = queue[cursor];
    positions.push(position);

    enqueueNeighbor(queue, marked, cells, { x: position.x - 1, y: position.y }, size, target);
    enqueueNeighbor(queue, marked, cells, { x: position.x + 1, y: position.y }, size, target);
    enqueueNeighbor(queue, marked, cells, { x: position.x, y: position.y - 1 }, size, target);
    enqueueNeighbor(queue, marked, cells, { x: position.x, y: position.y + 1 }, size, target);
  }

  return positions;
}
