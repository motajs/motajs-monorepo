/**
 * 坐标转换工具函数
 *
 * 提供地图坐标转换的通用工具
 */

/**
 * 坐标字段数据类型
 * 键为 "x,y" 格式的字符串，值为任意数据
 */
export type CoordFieldData = Record<string, unknown>;

/**
 * 转换坐标字段数据
 *
 * 将坐标字段中的所有坐标按偏移量转换，并过滤掉超出边界的坐标
 *
 * @param data - 原始坐标字段数据
 * @param offsetX - X 轴偏移量
 * @param offsetY - Y 轴偏移量
 * @param newWidth - 新地图宽度
 * @param newHeight - 新地图高度
 * @returns 转换后的坐标字段数据
 *
 * @example
 * ```ts
 * const data = { '1,1': { type: 'event' }, '5,5': { type: 'npc' } };
 * const result = transformCoordField(data, 2, 2, 10, 10);
 * // => { '3,3': { type: 'event' }, '7,7': { type: 'npc' } }
 * ```
 */
export function transformCoordField(
  data: CoordFieldData,
  offsetX: number,
  offsetY: number,
  newWidth: number,
  newHeight: number,
): CoordFieldData {
  const result: CoordFieldData = {};

  for (const loc in data) {
    const [oxStr, oyStr] = loc.split(',');
    const ox = parseInt(oxStr, 10);
    const oy = parseInt(oyStr, 10);

    // 跳过无效的坐标
    if (Number.isNaN(ox) || Number.isNaN(oy)) {
      continue;
    }

    const nx = ox + offsetX;
    const ny = oy + offsetY;

    // 检查新坐标是否在边界内
    if (nx >= 0 && nx < newWidth && ny >= 0 && ny < newHeight) {
      result[`${nx},${ny}`] = data[loc];
    }
  }

  return result;
}

/**
 * 转换单个坐标点
 *
 * @param coord - 原始坐标 [x, y]
 * @param offsetX - X 轴偏移量
 * @param offsetY - Y 轴偏移量
 * @returns 转换后的坐标 [newX, newY]
 *
 * @example
 * ```ts
 * transformCoordPoint([1, 1], 2, 3) // => [3, 4]
 * ```
 */
export function transformCoordPoint(
  coord: [number, number],
  offsetX: number,
  offsetY: number,
): [number, number] {
  return [coord[0] + offsetX, coord[1] + offsetY];
}

/**
 * 检查坐标是否在边界内
 *
 * @param x - X 坐标
 * @param y - Y 坐标
 * @param width - 地图宽度
 * @param height - 地图高度
 * @returns 是否在边界内
 */
export function isCoordInBounds(
  x: number,
  y: number,
  width: number,
  height: number,
): boolean {
  return x >= 0 && x < width && y >= 0 && y < height;
}

/**
 * 解析坐标字符串
 *
 * @param coordStr - 坐标字符串，格式为 "x,y"
 * @returns 坐标数组 [x, y]，如果解析失败返回 null
 */
export function parseCoordString(coordStr: string): [number, number] | null {
  const parts = coordStr.split(',');
  if (parts.length !== 2) {
    return null;
  }

  const x = parseInt(parts[0], 10);
  const y = parseInt(parts[1], 10);

  if (Number.isNaN(x) || Number.isNaN(y)) {
    return null;
  }

  return [x, y];
}

/**
 * 格式化坐标为字符串
 *
 * @param x - X 坐标
 * @param y - Y 坐标
 * @returns 坐标字符串，格式为 "x,y"
 */
export function formatCoordString(x: number, y: number): string {
  return `${x},${y}`;
}
