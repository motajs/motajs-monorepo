import { get } from 'es-toolkit/compat';
import { validateValue } from '../../shared/schemaForm/model/validation';
import { ITableSchemaNode } from '../../shared/schemaForm/types';

// 新素材的默认值合并与必填校验：defaults 里的 `@required`（字符串数组）只用于必填判定，不写进素材配置；
// 合并按「逐属性比较」语义——目标已有对象则递归，目标缺省才补默认值的深拷贝。

/** 整份配置不符合分类 schema 时的错误文案 */
const CONFIG_INVALID_MESSAGE = '配置不符合该分类的字段定义';

/** defaults 里声明必填属性的键名 */
const REQUIRED_KEY = '@required';

/**
 * 判断一个未知值是否为普通对象（非 null、非数组）
 * @param value 待判断的值
 * @returns 是普通对象时为 true
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 判断一个键是否为会改动对象原型链的危险键
 * @param key 待判断的键
 * @returns 为 `__proto__` / `constructor` / `prototype` 之一时为 true
 */
function isUnsafeKey(key: string): boolean {
  return key === '__proto__' || key === 'constructor' || key === 'prototype';
}

/**
 * 深拷贝一个默认值：数组与对象重建，标量原样返回
 * @param value 待拷贝的值
 * @returns 与入参结构相同的全新值
 */
function deepCopyValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => deepCopyValue(item));
  if (!isRecord(value)) return value;

  const copy: Record<string, unknown> = {};
  for (const key of Object.keys(value)) if (!isUnsafeKey(key)) copy[key] = deepCopyValue(value[key]);

  return copy;
}

/**
 * 逐属性把默认值合并进新条目配置：返回新对象、不改任何入参
 * @param defaults defaults 文件的正文值
 * @param config 目标配置（通常是新条目已填的内容）
 * @returns 合并后的新配置；defaults 不是普通对象时返回目标配置的浅拷贝
 */
export function mergeAssetDefaults(defaults: unknown, config: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...config };
  if (!isRecord(defaults)) return result;

  for (const key of Object.keys(defaults)) {
    if (key.startsWith('@') || isUnsafeKey(key)) continue;

    const defaultValue = defaults[key];
    const targetValue = result[key];
    if (isRecord(defaultValue) && isRecord(targetValue)) result[key] = mergeAssetDefaults(defaultValue, targetValue);
    else if (targetValue === undefined) result[key] = deepCopyValue(defaultValue);
  }

  return result;
}

/**
 * 递归收集 defaults 里的必填字段路径
 * @param defaults defaults 文件的正文值
 * @param prefix 当前层的前缀（子对象前缀会补一个 `.`）
 * @returns 必填字段路径列表；defaults 不是普通对象时为空
 */
export function collectRequiredPaths(defaults: unknown, prefix: string = ''): readonly string[] {
  if (!isRecord(defaults)) return [];

  const paths: string[] = [];
  const required = defaults[REQUIRED_KEY];
  if (Array.isArray(required)) {
    for (const name of required) {
      if (typeof name === 'string' && name.length > 0) paths.push(`${prefix}${name}`);
    }
  }

  for (const key of Object.keys(defaults)) {
    if (key.startsWith('@') || isUnsafeKey(key)) continue;

    const child = defaults[key];
    if (isRecord(child)) paths.push(...collectRequiredPaths(child, `${prefix}${key}.`));
  }

  return paths;
}

/**
 * 校验一份素材配置：先按分类 schema 判整份，再逐条查必填路径
 * @param schema 分类的配置表单 schema
 * @param config 待校验的配置
 * @param requiredPaths 由 defaults 收集的必填字段路径
 * @returns 可读的错误文案列表；空数组表示通过
 */
export function validateAssetConfig(
  schema: ITableSchemaNode,
  config: unknown,
  requiredPaths: readonly string[],
): readonly string[] {
  const errors: string[] = [];
  if (!validateValue(schema, config)) errors.push(CONFIG_INVALID_MESSAGE);

  for (const path of requiredPaths) {
    if (get(config, path) === undefined) errors.push(`字段「${path}」为必填`);
  }

  return errors;
}
