import { IMapCellChange, IMapDocument } from '../types';

// 中立地图文档的纯逻辑：校验、把一笔写入合并成净变化、按层做不可变写入、判断图块目录是否为空。
// 这一层不读文件、不碰渲染、不认识宿主格式，因此可以脱离 DOM 在单元测试里直接跑。
// IPaintWrite 是笔刷写路径共用的输入形状（已登记名），先在这里落成唯一声明，绘制与净变化都只认它。

export interface IPaintWrite {
  /** 格子横坐标 */
  readonly x: number;
  /** 格子纵坐标 */
  readonly y: number;
  /** 要写进去的图块编号；0 表示清空 */
  readonly value: number;
}

/**
 * 判断一份中立文档是否可用：宽高为正整数、至少一个图层、每层行列数与宽高一致、每格为非负整数
 * @param document 待校验的中立文档
 * @returns 全部条件满足时为 true；任一不满足为 false
 */
export function isMapDocumentValid(document: IMapDocument): boolean {
  if (!Number.isInteger(document.width) || document.width <= 0) return false;
  if (!Number.isInteger(document.height) || document.height <= 0) return false;
  if (document.layers.length === 0) return false;

  return document.layers.every(
    (layer) =>
      layer.cells.length === document.height &&
      layer.cells.every(
        (row) => row.length === document.width && row.every((cell) => Number.isInteger(cell) && cell >= 0),
      ),
  );
}

/**
 * 把一笔里重复落到的格子合并成净变化：后写覆盖先写，值没有改变的格子被丢弃
 * @param cells 当前图层的二维格子（`[y][x]`）
 * @param writes 这一笔依次落下的写入
 * @returns 按坐标首次出现顺序排列的净变化；超出图层范围的写入被丢弃
 */
export function collectNetCellChanges(
  cells: readonly (readonly number[])[],
  writes: readonly IPaintWrite[],
): readonly IMapCellChange[] {
  const pending: Map<string, IPaintWrite> = new Map();

  for (const write of writes) pending.set(`${write.x}:${write.y}`, write);

  const changes: IMapCellChange[] = [];

  for (const write of pending.values()) {
    const row = cells[write.y];
    if (row === undefined || write.x < 0 || write.x >= row.length) continue;

    const before = row[write.x];
    if (before === write.value) continue;

    changes.push({ x: write.x, y: write.y, before, after: write.value });
  }

  return changes;
}

/**
 * 把一组格子变化应用到指定图层，返回新文档；入参不被修改
 *
 * 只复制被触及的行、被改动的图层对象与图层数组，未触及的行与其余图层保持原引用，
 * 因此一笔横画只复制一行，不会为整张地图产生垃圾。
 * @param document 原文档
 * @param layerId 目标图层标识（撤销载荷只带它，不带层序号）
 * @param changes 要写入的格子变化
 * @returns 应用后的新文档；找不到图层或没有变化时原样返回入参
 */
export function applyCellChanges(
  document: IMapDocument,
  layerId: string,
  changes: readonly IMapCellChange[],
): IMapDocument {
  const layerIndex = document.layers.findIndex((layer) => layer.id === layerId);
  if (layerIndex === -1) return document;
  if (changes.length === 0) return document;

  const updatesByRow: Map<number, Map<number, number>> = new Map();

  for (const change of changes) {
    let rowUpdates = updatesByRow.get(change.y);

    if (rowUpdates === undefined) {
      rowUpdates = new Map();
      updatesByRow.set(change.y, rowUpdates);
    }

    rowUpdates.set(change.x, change.after);
  }

  const previousLayer = document.layers[layerIndex];
  const cells = previousLayer.cells.map((row, y) => {
    const rowUpdates = updatesByRow.get(y);
    if (rowUpdates === undefined) return row;

    const nextRow = [...row];

    for (const [x, value] of rowUpdates) {
      if (x < 0 || x >= nextRow.length) continue;

      nextRow[x] = value;
    }

    return nextRow;
  });

  const layers = document.layers.map((layer, index) => (index === layerIndex ? { ...previousLayer, cells } : layer));

  return { ...document, layers };
}

/**
 * 判断图块目录里是否一个图块都没有；只看目录结构，不看图片字节是否读取成功
 *
 * 它是「禁止落笔」的唯一判据：无分组、或所有分组都不含图块时才为 true；
 * 图片缺失但编号有效仍算可用，不在此列。
 * @param document 中立文档
 * @returns 目录里没有任何图块时为 true
 */
export function isTileCatalogEmpty(document: IMapDocument): boolean {
  return document.tileGroups.every((group) => group.tiles.length === 0);
}
