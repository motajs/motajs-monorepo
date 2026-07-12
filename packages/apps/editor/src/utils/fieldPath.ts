/**
 * Field Path Utilities
 *
 * 字段路径解析和操作工具函数。
 * 字段路径格式: "['key1']['key2']['key3']"
 */

import { get, set, unset } from 'es-toolkit/compat';

/**
 * 解析字段路径字符串为键数组
 *
 * @param field - 字段路径字符串，如 "['main']['floorIds']"
 * @returns 键数组，如 ['main', 'floorIds']
 *
 * @example
 * parseFieldPath("['main']['floorIds']") // ['main', 'floorIds']
 * parseFieldPath("") // []
 * parseFieldPath("['a']['b']['c']") // ['a', 'b', 'c']
 */
export function parseFieldPath(field: string): string[] {
  if (!field || field.length === 0) {
    return [];
  }

  // 匹配所有 ['key'] 模式并提取键
  const matches = field.match(/\['([^']+)'\]/g);
  if (!matches) {
    return [];
  }

  return matches
    .map((match) => {
      // 从 ['key'] 格式中提取键
      const keyMatch = match.match(/\['([^']+)'\]/);
      return keyMatch ? keyMatch[1] : '';
    })
    .filter((key) => key !== '');
}

/**
 * 获取字段路径的短名称（最后一段）
 *
 * @param field - 字段路径字符串，如 "['main']['floorIds']"
 * @returns 短字段名，如 'floorIds'
 *
 * @example
 * getShortField("['main']['floorIds']") // 'floorIds'
 * getShortField("['single']") // 'single'
 * getShortField("") // ''
 */
export function getShortField(field: string): string {
  if (!field || field.length === 0) {
    return '';
  }

  // 按 "'][" 分割并获取最后一段，然后清理
  const segments = field.split("']");
  const lastSegment = segments[segments.length - 2]; // -2 因为分割后最后一个元素为空

  if (!lastSegment) {
    // 尝试单段的替代解析
    const match = field.match(/\['([^']+)'\]$/);
    return match ? match[1] : '';
  }

  // 从 "['key" 格式中提取键
  const keyMatch = lastSegment.match(/\['([^']+)$/);
  return keyMatch ? keyMatch[1] : '';
}

/**
 * 从键数组构建字段路径
 *
 * @param keys - 键数组
 * @returns 字段路径字符串
 *
 * @example
 * buildFieldPath(['main', 'floorIds']) // "['main']['floorIds']"
 * buildFieldPath([]) // ""
 */
export function buildFieldPath(keys: string[]): string {
  if (!keys || keys.length === 0) {
    return '';
  }
  return keys.map((key) => `['${key}']`).join('');
}

/**
 * 获取父级字段路径（移除最后一段）
 *
 * @param field - 字段路径字符串
 * @returns 父级字段路径，如果没有父级则返回空字符串
 *
 * @example
 * getParentField("['main']['floorIds']") // "['main']"
 * getParentField("['single']") // ""
 */
export function getParentField(field: string): string {
  const keys = parseFieldPath(field);
  if (keys.length <= 1) {
    return '';
  }
  return buildFieldPath(keys.slice(0, -1));
}

/**
 * getParentField 的别名
 * 获取父级字段路径（移除最后一段）
 *
 * @param fieldPath - 字段路径字符串
 * @returns 父级字段路径，如果没有父级则返回空字符串
 *
 * @example
 * getParentFieldPath("['main']['floorIds']") // "['main']"
 * getParentFieldPath("['single']") // ""
 */
export const getParentFieldPath = getParentField;

/**
 * 根据 field path 从对象中安全获取值
 * 使用 es-toolkit 的 get 函数，不使用 new Function 或 eval
 *
 * @param obj - 数据对象
 * @param fieldPath - 字段路径，如 "['main']['floorIds']"
 * @returns 字段值，如果路径无效则返回 undefined
 *
 * @example
 * getByFieldPath({ main: { floorIds: [1, 2] } }, "['main']['floorIds']") // [1, 2]
 * getByFieldPath({ a: { b: 'value' } }, "['a']['b']") // 'value'
 * getByFieldPath({}, "['nonexistent']") // undefined
 */
export function getByFieldPath(obj: unknown, fieldPath: string): unknown {
  if (!fieldPath) return obj;
  const keys = parseFieldPath(fieldPath);
  if (keys.length === 0) return obj;
  return get(obj, keys);
}

/**
 * 根据 field path 设置对象中的值
 * 如果中间路径不存在，自动创建空对象
 *
 * @param obj - 目标对象
 * @param fieldPath - 字段路径，如 "['main']['floorIds']"
 * @param value - 要设置的值
 *
 * @example
 * const obj = {};
 * setByFieldPath(obj, "['a']['b']['c']", 'value');
 * // obj = { a: { b: { c: 'value' } } }
 */
export function setByFieldPath(
  obj: Record<string, unknown>,
  fieldPath: string,
  value: unknown
): void {
  if (!fieldPath) return;
  const keys = parseFieldPath(fieldPath);
  if (keys.length === 0) return;
  set(obj, keys, value);
}

/**
 * 根据 field path 删除对象中的字段
 *
 * @param obj - 目标对象
 * @param fieldPath - 字段路径，如 "['main']['floorIds']"
 * @returns 是否成功删除
 *
 * @example
 * const obj = { a: { b: { c: 'value' } } };
 * deleteByFieldPath(obj, "['a']['b']['c']"); // true
 * // obj = { a: { b: {} } }
 */
export function deleteByFieldPath(
  obj: Record<string, unknown>,
  fieldPath: string
): boolean {
  if (!fieldPath) return false;
  const keys = parseFieldPath(fieldPath);
  if (keys.length === 0) return false;
  return unset(obj, keys);
}

/**
 * 将字段路径转换为 data-field 属性格式
 * 用于 CSS 选择器和 DOM 属性
 *
 * @param field - 字段路径字符串
 * @returns 用连字符分隔的字符串，用于 data-field 属性
 *
 * @example
 * fieldToDataAttr("['main']['floorIds']") // "main-floorIds"
 */
export function fieldToDataAttr(field: string): string {
  const keys = parseFieldPath(field);
  return keys.join('-');
}
