import { isEqual } from 'es-toolkit';
import { deleteByFieldPath, buildFieldPath, getByFieldPath, parseFieldPath, setByFieldPath } from './fieldPath';
import { Action, ActionType } from './types';

// 数据修改操作的工具函数，用于应用 Action 到目标对象

/**
 * 深拷贝一个动作值：对象 / 数组 / Date / RegExp / Map / Set 递归复制，原始值直接返回。
 *
 * @param value 待拷贝的值。
 * @param seen 已拷贝对象到副本的映射，用于处理循环引用。
 */
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
 * applyAction(obj, [ActionType.Change, "['a']", 2]);
 * // obj = { a: 2 }
 *
 * applyAction(obj, [ActionType.Add, "['b']", 3]);
 * // obj = { a: 2, b: 3 }
 *
 * applyAction(obj, [ActionType.Delete, "['a']", undefined]);
 * // obj = { b: 3 }
 */
export function applyAction(target: Record<string, unknown>, action: Action): void {
  const [type, path, value] = action;

  // 当值为 undefined 或操作类型为 delete 时，删除字段
  if (type === ActionType.Delete || value === undefined) {
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
 *   [ActionType.Add, "['a']", 1],
 *   [ActionType.Add, "['b']['c']", 2],
 *   [ActionType.Change, "['a']", 10],
 * ]);
 * // obj = { a: 10, b: { c: 2 } }
 */
export function applyActions(target: Record<string, unknown>, actions: Action[]): void {
  for (const action of actions) {
    applyAction(target, action);
  }
}

/**
 * 返回路径中第一处缺失的字段路径；路径全部存在时返回 null。
 *
 * @param target 目标对象。
 * @param path 字段路径字符串。
 */
function firstMissingFieldPath(target: unknown, path: string): string | null {
  const keys = parseFieldPath(path);
  if (keys.length === 0) return path;

  let current = target;
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    if (current == null || typeof current !== 'object' || !Object.prototype.hasOwnProperty.call(current, key)) {
      return buildFieldPath(keys.slice(0, index + 1));
    }
    current = (current as Record<string, unknown>)[key];
  }
  return null;
}

/**
 * 应用一组动作，并返回恢复原值所需的最小逆操作列表；逆操作按执行顺序排列。
 *
 * @param target 目标对象。
 * @param actions 要应用的表格动作列表。
 */
export function applyActionsWithInverse(target: Record<string, unknown>, actions: Action[]): Action[] {
  const inverse: Action[] = [];

  for (const action of actions) {
    const [type, path, value] = action;
    const missingPath = firstMissingFieldPath(target, path);
    const existed = missingPath === null;
    const previous = existed ? cloneActionValue(getByFieldPath(target, path)) : undefined;
    const deleting = type === ActionType.Delete || value === undefined;

    if ((!existed && deleting) || (existed && !deleting && isEqual(previous, value))) {
      continue;
    }

    applyAction(target, action);
    inverse.unshift(
      existed ? [ActionType.Change, path, previous] : [ActionType.Delete, missingPath ?? path, undefined],
    );
  }

  return inverse;
}
