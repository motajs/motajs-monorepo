/**
 * Registry 辅助函数
 *
 * 提供解析和生成过程中常用的工具函数
 */

import type {
  BlockState,
  ConnectionState,
  EventData,
  ParseContext,
} from '../parser/types';

// ============================================
// 表达式块创建
// ============================================

/**
 * 创建表达式输入块
 *
 * @param expr - 表达式字符串
 * @returns ConnectionState 包含表达式块
 */
export function createExpressionBlock(expr: string): ConnectionState {
  return {
    block: {
      type: 'mota_expression',
      fields: {
        EXPR: expr,
      },
    },
  };
}

// ============================================
// 事件列表解析
// ============================================

// 这个函数需要引用 blockRegistry，会在初始化后设置
let parseEventListFn: ((events: EventData[], context: ParseContext) => BlockState | null) | null =
  null;

/**
 * 设置事件列表解析函数（避免循环依赖）
 */
export function setParseEventListFn(
  fn: (events: EventData[], context: ParseContext) => BlockState | null,
): void {
  parseEventListFn = fn;
}

/**
 * 解析事件列表
 *
 * @param events - 事件数组
 * @param context - 解析上下文
 * @returns 第一个块的状态，后续块通过 next 链接
 */
export function parseEventList(
  events: EventData[],
  context: ParseContext,
): BlockState | null {
  if (!parseEventListFn) {
    console.warn('parseEventListFn not initialized');
    return null;
  }
  return parseEventListFn(events, context);
}

// ============================================
// 值转换辅助函数
// ============================================

/**
 * 将值转换为字符串
 */
export function toString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

/**
 * 将值转换为数字
 */
export function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  const num = Number(value);
  return isNaN(num) ? 0 : num;
}

/**
 * 将值转换为布尔值
 */
export function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'TRUE' || value === 'true' || value === '1') return true;
  return false;
}

/**
 * 检查值是否为空（用于判断是否省略字段）
 */
export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (value === '') return true;
  if (value === false) return true;
  return false;
}

// ============================================
// JSON 生成辅助函数
// ============================================

/**
 * 生成事件 JSON 字符串
 *
 * @param event - 事件对象
 * @returns JSON 字符串，带尾部逗号和换行
 */
export function generateEventJson(event: Record<string, unknown>): string {
  return JSON.stringify(event) + ',\n';
}

/**
 * 移除字符串两端的引号
 */
export function stripQuotes(str: string): string {
  if (str.startsWith('"') && str.endsWith('"')) {
    return str.slice(1, -1);
  }
  if (str.startsWith("'") && str.endsWith("'")) {
    return str.slice(1, -1);
  }
  return str;
}
