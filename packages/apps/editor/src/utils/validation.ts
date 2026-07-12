/**
 * 验证工具函数
 *
 * 提供各种数据验证的通用工具
 */

/** 地图尺寸最大值 */
export const MAX_MAP_DIMENSION = 128;

/**
 * 地图尺寸参数
 */
export interface MapDimensions {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

/**
 * 验证地图尺寸参数
 *
 * 验证规则：
 * - 宽度和高度不得大于 128
 * - 偏移量不得小于 0
 *
 * @param dimensions - 地图尺寸参数
 * @returns 验证结果，包含是否有效和错误信息
 *
 * @example
 * ```ts
 * validateMapDimensions({ width: 13, height: 13, offsetX: 0, offsetY: 0 })
 * // => { valid: true }
 *
 * validateMapDimensions({ width: 200, height: 13, offsetX: 0, offsetY: 0 })
 * // => { valid: false, error: '宽度不得大于128' }
 * ```
 */
export function validateMapDimensions(dimensions: MapDimensions): { valid: boolean; error?: string } {
  const { width, height, offsetX, offsetY } = dimensions;

  // 检查 NaN
  if (Number.isNaN(width) || Number.isNaN(height) || Number.isNaN(offsetX) || Number.isNaN(offsetY)) {
    return { valid: false, error: '参数必须是有效的数字' };
  }

  // 检查宽度
  if (width > MAX_MAP_DIMENSION) {
    return { valid: false, error: `宽度不得大于${MAX_MAP_DIMENSION}` };
  }

  // 检查高度
  if (height > MAX_MAP_DIMENSION) {
    return { valid: false, error: `高度不得大于${MAX_MAP_DIMENSION}` };
  }

  // 检查偏移量
  if (offsetX < 0) {
    return { valid: false, error: '偏移量 X 不得小于0' };
  }

  if (offsetY < 0) {
    return { valid: false, error: '偏移量 Y 不得小于0' };
  }

  return { valid: true };
}

/**
 * 检查地图尺寸参数是否有效
 *
 * 简化版本，只返回布尔值
 *
 * @param dimensions - 地图尺寸参数
 * @returns 是否有效
 */
export function isValidMapDimensions(dimensions: MapDimensions): boolean {
  return validateMapDimensions(dimensions).valid;
}
