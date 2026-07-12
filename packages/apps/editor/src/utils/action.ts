/**
 * Action Utilities
 *
 * 数据修改操作的工具函数，用于应用 Action 到目标对象。
 */

import { isEqual } from 'es-toolkit';
import {
  deleteByFieldPath,
  buildFieldPath,
  getByFieldPath,
  parseFieldPath,
  setByFieldPath,
} from '@/utils/fieldPath';

/** 操作类型 */
export type ActionType = 'change' | 'add' | 'delete';

/** Action 元组：[操作类型, 字段路径, 值] */
export type Action = [ActionType, string, unknown];

function cloneActionValue<T>(value: T, seen = new WeakMap<object, unknown>()): T {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) return value;
  if (typeof value === 'function') return value;
  if (seen.has(value)) return seen.get(value) as T;
  if (value instanceof Date) return new Date(value.getTime()) as T;
  if (value instanceof RegExp) return new RegExp(value.source, value.flags) as T;
  if (value instanceof Map) {
    const result = new Map();
    seen.set(value, result);
    value.forEach((item, key) => result.set(cloneActionValue(key, seen), cloneActionValue(item, seen)));
    return result as T;
  }
  if (value instanceof Set) {
    const result = new Set();
    seen.set(value, result);
    value.forEach((item) => result.add(cloneActionValue(item, seen)));
    return result as T;
  }

  const result: object = Array.isArray(value) ? [] : Object.create(Object.getPrototypeOf(value));
  seen.set(value, result);
  for (const key of Reflect.ownKeys(value)) {
    if (Array.isArray(value) && key === 'length') continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor) continue;
    if ('value' in descriptor) descriptor.value = cloneActionValue(descriptor.value, seen);
    Object.defineProperty(result, key, descriptor);
  }
  return result as T;
}

/**
 * 应用单个 Action 到目标对象
 *
 * @param target - 目标对象
 * @param action - Action 元组 [type, path, value]
 *
 * @example
 * const obj = { a: 1 };
 * applyAction(obj, ['change', "['a']", 2]);
 * // obj = { a: 2 }
 *
 * applyAction(obj, ['add', "['b']", 3]);
 * // obj = { a: 2, b: 3 }
 *
 * applyAction(obj, ['delete', "['a']", undefined]);
 * // obj = { b: 3 }
 */
export function applyAction(target: Record<string, unknown>, action: Action): void {
  const [type, path, value] = action;

  // 当值为 undefined 或操作类型为 delete 时，删除字段
  if (type === 'delete' || value === undefined) {
    deleteByFieldPath(target, path);
    return;
  }

  // change 和 add 操作都是设置值
  setByFieldPath(target, path, value);
}

/**
 * 批量应用 Actions 到目标对象
 *
 * @param target - 目标对象
 * @param actions - Action 列表
 *
 * @example
 * const obj = {};
 * applyActions(obj, [
 *   ['add', "['a']", 1],
 *   ['add', "['b']['c']", 2],
 *   ['change', "['a']", 10],
 * ]);
 * // obj = { a: 10, b: { c: 2 } }
 */
export function applyActions(target: Record<string, unknown>, actions: Action[]): void {
  for (const action of actions) {
    applyAction(target, action);
  }
}

function firstMissingFieldPath(target: unknown, path: string): string | null {
  const keys = parseFieldPath(path);
  if (keys.length === 0) return path;

  let current = target;
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    if (
      current == null ||
      typeof current !== 'object' ||
      !Object.prototype.hasOwnProperty.call(current, key)
    ) {
      return buildFieldPath(keys.slice(0, index + 1));
    }
    current = (current as Record<string, unknown>)[key];
  }
  return null;
}

/**
 * Applies actions and returns the smallest inverse action list needed to restore
 * the original value. Inverses are returned in execution order.
 */
export function applyActionsWithInverse(
  target: Record<string, unknown>,
  actions: Action[],
): Action[] {
  const inverse: Action[] = [];

  for (const action of actions) {
    const [type, path, value] = action;
    const missingPath = firstMissingFieldPath(target, path);
    const existed = missingPath === null;
    const previous = existed ? cloneActionValue(getByFieldPath(target, path)) : undefined;
    const deleting = type === 'delete' || value === undefined;

    if ((!existed && deleting) || (existed && !deleting && isEqual(previous, value))) {
      continue;
    }

    applyAction(target, action);
    inverse.unshift(
      existed
        ? ['change', path, previous]
        : ['delete', missingPath ?? path, undefined],
    );
  }

  return inverse;
}
