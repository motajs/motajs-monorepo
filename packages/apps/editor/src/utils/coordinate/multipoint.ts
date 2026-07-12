/**
 * 多点坐标工具函数
 *
 * 用于处理形如 "1,2,3" 格式的多点坐标字符串
 */

const MULTIPOINT_PATTERN = /^\d+(,\d+)+$/;

/**
 * 检查 x 和 y 是否都是多点坐标字符串
 *
 * 多点坐标字符串格式：数字用逗号分隔，如 "1,2,3"
 *
 * @example
 * isMultipointString("1,2,3", "4,5,6") // true
 * isMultipointString("1", "2") // false (单点不算多点)
 * isMultipointString(1, 2) // false (非字符串)
 */
export function isMultipointString(x: unknown, y: unknown): boolean {
  return (
    typeof x === "string" &&
    typeof y === "string" &&
    MULTIPOINT_PATTERN.test(x) &&
    MULTIPOINT_PATTERN.test(y)
  );
}

/**
 * 解析多点坐标字符串为坐标点数组
 *
 * @param x - x 坐标字符串，如 "1,2,3"
 * @param y - y 坐标字符串，如 "4,5,6"
 * @returns 坐标点数组，如 ["1,4", "2,5", "3,6"]
 *
 * @example
 * parseMultipoints("1,2,3", "4,5,6") // ["1,4", "2,5", "3,6"]
 */
export function parseMultipoints(x: string, y: string): string[] {
  const xx = x.split(",");
  const yy = y.split(",");
  return xx.map((xVal, i) => `${xVal},${yy[i]}`);
}

/**
 * 获取多点坐标字符串中的最后一个坐标值
 *
 * @param coordString - 坐标字符串，如 "1,2,3"
 * @returns 最后一个坐标值
 *
 * @example
 * getLastCoordinate("1,2,3") // 3
 */
export function getLastCoordinate(coordString: string): number {
  const parts = coordString.split(",");
  return parseInt(parts[parts.length - 1], 10) || 0;
}
