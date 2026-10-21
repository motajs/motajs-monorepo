import { IMapDirections, IMapDocument, IMapLayer, IMapPassMark, IMapTileEntry } from '../types';

// 只读通行度：按图块目录给出的四方向属性，算出每格「不能走」的方向，交给渲染模型画箭头或红点。
// 只读且纯粹：不写文档、不置脏、不进撤销；空格、未知编号与不在事件层的 onlyEventLayer 图块都不输出标记。

/**
 * 按图层标识找目标图层
 * @param document 中立文档
 * @param layerId 图层标识
 * @returns 找到的图层；没有对应图层时为 undefined
 */
function findLayer(document: IMapDocument, layerId: string): IMapLayer | undefined {
  return document.layers.find((layer) => layer.id === layerId);
}

/**
 * 判断某图块在指定方向是否不可通行：「不能离开」或「不能进入」任一为 false 即视为不可通行
 * @param tile 图块条目
 * @param direction 方向字段名
 * @returns 该方向不可通行时为 true
 */
function isDirectionBlocked(tile: IMapTileEntry, direction: 'up' | 'right' | 'down' | 'left'): boolean {
  return tile.pass.out[direction] === false || tile.pass.in[direction] === false;
}

/**
 * 算出一层里每个格子不可通行的方向
 *
 * 只画「不可通行」的方向：四方向都可通行的图块不输出标记；编号 0、目录里没有的编号、
 * 以及标了「只在事件层生效」却落在普通层的图块也都不输出。返回的是全新数组，文档不被修改。
 * @param document 中立文档
 * @param layerId 要计算的图层标识
 * @param tileIndex 图块编号到图块条目的只读索引
 * @returns 通行度标记；没有任何标记时为空数组
 */
export function computePassabilityMarks(
  document: IMapDocument,
  layerId: string,
  tileIndex: ReadonlyMap<number, IMapTileEntry>,
): readonly IMapPassMark[] {
  const layer = findLayer(document, layerId);

  if (layer === undefined) return [];

  const marks: IMapPassMark[] = [];

  for (let y = 0; y < layer.cells.length; y += 1) {
    const row = layer.cells[y];

    for (let x = 0; x < row.length; x += 1) {
      const value = row[x];

      if (value === 0) continue;

      const tile = tileIndex.get(value);

      if (tile === undefined) continue;
      if (tile.pass.onlyEventLayer && !layer.isEventLayer) continue;

      const blocked: IMapDirections = {
        up: isDirectionBlocked(tile, 'up'),
        right: isDirectionBlocked(tile, 'right'),
        down: isDirectionBlocked(tile, 'down'),
        left: isDirectionBlocked(tile, 'left'),
      };

      if (!blocked.up && !blocked.right && !blocked.down && !blocked.left) continue;

      marks.push({ x, y, blocked, dot: false });
    }
  }

  return marks;
}
