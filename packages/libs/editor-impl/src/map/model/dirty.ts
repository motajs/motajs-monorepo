import { isEqual } from 'es-toolkit';
import { IMapDocument, IMapLayer } from '../types';

// 脏状态：拿「当前内存」与「最近一次已保存快照」比较，撤销回基线后必须重新变干净。
// 只有纯比较：不改入参、不缓存结果；发现第一处差异立刻返回，避免在大地图上逐格跑完整张。

/**
 * 比较两个图层是否完全一致：名称、是否事件层、每行每格
 * @param layer 当前图层
 * @param baseline 基线图层
 * @returns 全部一致时为 true
 */
function isLayerSame(layer: IMapLayer, baseline: IMapLayer): boolean {
  if (layer.name !== baseline.name) return false;
  if (layer.isEventLayer !== baseline.isEventLayer) return false;
  if (layer.cells.length !== baseline.cells.length) return false;

  for (let y = 0; y < layer.cells.length; y += 1) {
    const row = layer.cells[y];
    const baseRow = baseline.cells[y];

    if (baseRow === undefined || row.length !== baseRow.length) return false;

    for (let x = 0; x < row.length; x += 1) {
      if (row[x] !== baseRow[x]) return false;
    }
  }

  return true;
}

/**
 * 判断文档几何是否与基线不同
 *
 * 宽高、图层数、图层顺序（按数组位置与标识）、图层名、是否事件层、每行每格任一不同即脏；
 * 基线为 undefined 表示从未保存过，此时只要文档还有图层就视为脏。
 * 发现第一处差异立即返回，不做深层递归比较。
 * @param document 当前文档
 * @param baseline 最近一次已保存的快照；从未保存过时为 undefined
 * @returns 有差异时为 true
 */
export function isMapDataDirty(document: IMapDocument, baseline: IMapDocument | undefined): boolean {
  if (baseline === undefined) return document.layers.length > 0;

  if (document.width !== baseline.width) return true;
  if (document.height !== baseline.height) return true;
  if (document.layers.length !== baseline.layers.length) return true;

  for (let index = 0; index < document.layers.length; index += 1) {
    const layer = document.layers[index];
    const baseLayer = baseline.layers[index];

    if (baseLayer === undefined || layer.id !== baseLayer.id) return true;
    if (!isLayerSame(layer, baseLayer)) return true;
  }

  return false;
}

/**
 * 判断属性表是否与基线不同
 *
 * 属性表是小对象，用结构比较即可；键顺序不同但内容相同不算脏。
 * 基线为 undefined 表示从未保存过，此时只要属性表还有键就视为脏。
 * @param properties 当前属性表
 * @param baseline 最近一次已保存的属性表；从未保存过时为 undefined
 * @returns 有差异时为 true
 */
export function isMapPropertiesDirty(
  properties: Record<string, unknown>,
  baseline: Record<string, unknown> | undefined,
): boolean {
  if (baseline === undefined) return Object.keys(properties).length > 0;

  return !isEqual(properties, baseline);
}
