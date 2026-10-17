import { IAssetCategory } from '../../react';

// 素材的目录 / 文件命名约定：分类列表文件名、分类自带 schema 文件名，以及「保留旧文件」的改名后缀。
// 文件名清洗与路径推导也在这里：上传名字先进 sanitizeAssetFileName，再由分类约定拼出字节目录下的路径。

/** 每个分类目录下列表文件的固定名 */
export const ASSET_LIST_FILE_NAME = '.list.jsonc';

/** 分类目录下「引擎自带 schema」的固定名 */
export const ASSET_SCHEMA_FILE_NAME = '.schema.jsonc';

/** 不覆盖旧文件时旧文件的改名后缀 */
export const ASSET_ORIGIN_SUFFIX = '-origin';

/** 文件名长度上限 */
const MAX_ASSET_FILE_NAME_LENGTH = 128;

/** Windows 非法字符的集合 */
const WINDOWS_ILLEGAL_CHARS = ':*?"<>|';

/**
 * 判断字符串里是否含控制字符（U+0000–U+001F）
 * @param value 待检查的字符串
 * @returns 含控制字符时为 true
 */
function hasControlChar(value: string): boolean {
  for (const char of value) {
    if (char.charCodeAt(0) <= 0x1f) return true;
  }

  return false;
}

/**
 * 判断字符串里是否含集合中任一字符
 * @param value 待检查的字符串
 * @param chars 要查找的字符集合
 * @returns 含任一字符时为 true
 */
function containsAnyChar(value: string, chars: string): boolean {
  for (const char of chars) {
    if (value.includes(char)) return true;
  }

  return false;
}

/**
 * 清洗一次上传的文件名：这是防路径穿越的第一道闸，注入的文件系统仍会拒绝 `..`
 * @param fileName 用户提供的原始文件名
 * @returns 清洗后的名字；含分隔符 / `..` / 前导点 / 控制字符 / Windows 非法字符或过长时为 null
 */
export function sanitizeAssetFileName(fileName: string): string | null {
  const trimmed = fileName.trim();

  if (trimmed.length === 0 || trimmed.length > MAX_ASSET_FILE_NAME_LENGTH) return null;
  if (trimmed === '.' || trimmed === '..') return null;
  if (trimmed.startsWith('.')) return null;
  if (trimmed.includes('/') || trimmed.includes('\\')) return null;
  if (hasControlChar(trimmed)) return null;
  if (containsAnyChar(trimmed, WINDOWS_ILLEGAL_CHARS)) return null;

  return trimmed;
}

/**
 * 把文件名换成列表里登记的素材名：按分类约定去掉扩展名
 * @param category 素材分类
 * @param fileName 素材的字节文件名
 * @returns 去掉分类约定扩展名后的名字；不匹配任何约定时原样返回
 */
export function resolveAssetName(category: IAssetCategory, fileName: string): string {
  const extension = category.extension ?? '';

  if (extension.length > 0 && fileName.endsWith(extension)) return fileName.slice(0, -extension.length);

  return fileName;
}

/**
 * 由分类与素材名推出字节文件的资源路径
 * @param category 素材分类
 * @param name 列表里登记的素材名
 * @returns 分类目录下的完整文件路径
 */
export function resolveAssetBytePath(category: IAssetCategory, name: string): string {
  return `${category.dir}/${name}${category.extension ?? ''}`;
}

/**
 * 把路径最后一段的扩展名替换为目标扩展名
 * @param path 原文件路径
 * @param extension 目标扩展名（含前导点）
 * @returns 换过扩展名的路径；原路径没有扩展名时直接追加
 */
export function resolveTranscodedPath(path: string, extension: string): string {
  const slash = path.lastIndexOf('/');
  const dot = path.lastIndexOf('.');

  if (dot > slash) return `${path.slice(0, dot)}${extension}`;

  return `${path}${extension}`;
}

/**
 * 把路径改成「保留旧文件」的名字：在扩展名前插入后缀
 * @param path 原文件路径
 * @returns 插入后缀后的路径；原路径没有扩展名时直接追加后缀
 */
export function resolveOriginPath(path: string): string {
  const slash = path.lastIndexOf('/');
  const dot = path.lastIndexOf('.');

  if (dot > slash) return `${path.slice(0, dot)}${ASSET_ORIGIN_SUFFIX}${path.slice(dot)}`;

  return `${path}${ASSET_ORIGIN_SUFFIX}`;
}
