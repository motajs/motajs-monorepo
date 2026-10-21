import { EditorEntryKind, IFileEntry } from '@motajs/editor-core';
import { IAssetCategory } from '../../react';
import {
  ASSET_ORIGIN_SUFFIX,
  ASSET_SCHEMA_FILE_NAME,
  resolveAssetBytePath,
  resolveAssetName,
  sanitizeAssetFileName,
} from './assetPaths';

// 未登记素材的扫描规则：只看分类目录的直接文件，只按名字判断，不读文件内容。
// 目录里那些不属于素材的文件（隐藏文件、列表 / schema / defaults、`-origin` 备份）都在这里统一排除。

/**
 * 取路径的最后一段名
 * @param path 完整路径
 * @returns 末段名
 */
function lastSegment(path: string): string {
  const index = path.lastIndexOf('/');

  return index === -1 ? path : path.slice(index + 1);
}

/**
 * 判断一个文件名是否是「保留旧文件」改名产生的备份
 * @param fileName 文件名
 * @returns 去掉最后一段扩展名后以 `-origin` 结尾时为 true
 */
export function isAssetOriginFileName(fileName: string): boolean {
  const dot = fileName.lastIndexOf('.');
  const stem = dot > 0 ? fileName.slice(0, dot) : fileName;

  return stem.endsWith(ASSET_ORIGIN_SUFFIX);
}

/**
 * 从分类目录的直接文件里挑出「还没登记进列表」的素材名
 * @param category 素材分类
 * @param entries 分类目录的直接子条目
 * @param registeredNames 已登记进列表的素材名
 * @returns 去重后按名字升序排列的未登记素材名；输入顺序不影响结果
 */
export function collectUnregisteredAssetNames(
  category: IAssetCategory,
  entries: readonly IFileEntry[],
  registeredNames: readonly string[],
): readonly string[] {
  const listFileName = lastSegment(category.listPath);
  const schemaFileName = lastSegment(category.schemaPath ?? `${category.dir}/${ASSET_SCHEMA_FILE_NAME}`);
  const defaultsFileName = category.defaultsPath === undefined ? undefined : lastSegment(category.defaultsPath);
  const registered = new Set(registeredNames);
  const names = new Set<string>();

  for (const entry of entries) {
    if (entry.kind !== EditorEntryKind.File) continue;
    if (entry.name.startsWith('.')) continue;
    if (entry.name === listFileName || entry.name === schemaFileName) continue;
    if (entry.name === defaultsFileName) continue;
    if (isAssetOriginFileName(entry.name)) continue;
    if (sanitizeAssetFileName(entry.name) === null) continue;

    const name = resolveAssetName(category, entry.name);

    // 带固定扩展名的分类（如动画只认 `.anim`）不能把别的类型文件当成候选：名字反推的路径必须与原路径逐字相等
    if (resolveAssetBytePath(category, name) !== `${category.dir}/${entry.name}`) continue;
    if (registered.has(name)) continue;

    names.add(name);
  }

  return [...names].sort((left, right) => left.localeCompare(right));
}
