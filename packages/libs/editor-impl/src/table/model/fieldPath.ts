// 字段路径工具：表格内部用 `['a']['b']` 形式表示字段路径，先解析为段数组，再按路径读写数据。
// 所有写操作都返回全新对象，绝不改动传入的数据——撤销路径在写盘成功前必须保持旧数据完整（T-02-18）。

/** 写入时应拒绝的危险段：命中这些键会改写原型链或构造器，构成原型污染（T-02-17） */
const UNSAFE_SEGMENTS = Object.freeze(['__proto__', 'constructor', 'prototype']);

/**
 * 判断一个路径段是否为危险键
 * @param segment 待判断的路径段
 * @returns 是危险键时为 true
 */
function isUnsafeSegment(segment: string): boolean {
  return UNSAFE_SEGMENTS.includes(segment);
}

/**
 * 解析字段路径字符串为段数组
 * @param path 形如 `['a']['b']` 的字段路径字符串
 * @returns 路径段数组；不含任何段时为空数组
 */
export function parseFieldPath(path: string): string[] {
  const matches = path.match(/\['([^']+)'\]/g);

  if (matches === null) return [];

  return matches.map((segment) => segment.slice(2, -2));
}

/**
 * 把字段路径段数组拼回字段路径字符串
 * @param segments 字段路径段数组
 * @returns 形如 `['a']['b']` 的字段路径字符串；空数组时为空串
 */
function joinFieldPath(segments: readonly string[]): string {
  return segments.map((segment) => `['${segment}']`).join('');
}

/**
 * 取字段路径去掉最后一段后的父路径
 * @param path 字段路径字符串
 * @returns 父路径字符串；没有父级时为空串
 */
export function getParentFieldPath(path: string): string {
  const segments = parseFieldPath(path);

  if (segments.length <= 1) return '';

  return joinFieldPath(segments.slice(0, -1));
}

/**
 * 取字段路径的最后一段作为短字段名
 * @param path 字段路径字符串
 * @returns 短字段名；路径为空时为空串
 */
export function getShortField(path: string): string {
  const segments = parseFieldPath(path);

  if (segments.length === 0) return '';

  return segments[segments.length - 1];
}

/**
 * 判断一个值是否为可读写的普通对象
 * @param value 待判断的值
 * @returns 是普通对象时为 true
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 按段数组不可变地写入一个值，逐层浅拷贝经过的对象
 * @param target 目标值
 * @param segments 剩余段数组
 * @param value 要写入的值
 * @returns 写入后的新对象
 */
function setAt(target: unknown, segments: readonly string[], value: unknown): Record<string, unknown> {
  const base = isRecord(target) ? { ...target } : {};
  const head = segments[0];

  if (head === undefined) return base;
  if (isUnsafeSegment(head)) return base;

  const rest = segments.slice(1);

  if (rest.length === 0) {
    base[head] = value;
    return base;
  }

  base[head] = setAt(base[head], rest, value);
  return base;
}

/**
 * 按段数组不可变地删除一个值，逐层浅拷贝经过的对象
 * @param target 目标值
 * @param segments 剩余段数组
 * @returns 删除后的新对象
 */
function deleteAt(target: unknown, segments: readonly string[]): Record<string, unknown> {
  const base = isRecord(target) ? { ...target } : {};
  const head = segments[0];

  if (head === undefined) return base;
  if (isUnsafeSegment(head)) return base;

  const rest = segments.slice(1);

  if (rest.length === 0) {
    delete base[head];
    return base;
  }

  if (isRecord(base[head])) base[head] = deleteAt(base[head], rest);

  return base;
}

/**
 * 按字段路径不可变地写入一个值
 * @param data 目标数据
 * @param path 字段路径字符串
 * @param value 要写入的值
 * @returns 写入后的新对象；路径为空时返回原数据的浅拷贝
 */
export function setByFieldPath(data: unknown, path: string, value: unknown): Record<string, unknown> {
  return setAt(data, parseFieldPath(path), value);
}

/**
 * 按字段路径不可变地删除一个值
 * @param data 目标数据
 * @param path 字段路径字符串
 * @returns 删除后的新对象；路径为空时返回原数据的浅拷贝
 */
export function deleteByFieldPath(data: unknown, path: string): Record<string, unknown> {
  return deleteAt(data, parseFieldPath(path));
}
