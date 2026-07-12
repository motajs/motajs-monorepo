/**
 * JSON 工具函数
 *
 * 提供 JSON 序列化/反序列化的通用工具
 */

/**
 * 默认的 GUID 生成器
 * 生成一个符合 UUID v4 格式的唯一标识符
 *
 * @returns UUID 格式的字符串
 *
 * @example
 * ```ts
 * generateGuid() // => "550e8400-e29b-41d4-a716-446655440000"
 * ```
 */
export function generateGuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * 安全地解析 JSON 字符串
 *
 * @param str - JSON 字符串
 * @param defaultValue - 解析失败时的默认值
 * @returns 解析结果或默认值
 *
 * @example
 * ```ts
 * safeJsonParse('{"a": 1}', {}) // => { a: 1 }
 * safeJsonParse('invalid', {}) // => {}
 * ```
 */
export function safeJsonParse<T>(str: string, defaultValue: T): T {
  try {
    return JSON.parse(str) as T;
  } catch {
    return defaultValue;
  }
}
