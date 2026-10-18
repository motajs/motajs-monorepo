import { AssetListFormat, IAssetCategory } from '../../react';
import { IAssetListEntry } from '../types';
import { sanitizeAssetFileName } from './assetPaths';

// 列表文件正文的读写：两种分类格式——图片 / 音频是「对象数组挂在某个键下」，动画 / 字体是 `string[]`。
// 这一层只处理正文值，不含读文件、不碰系统前缀；写回时的前缀逐字保留由调用方（面板数据层）完成。

/** 列表正文格式不正确时抛出的错误文案：容器形态与分类约定不符 */
const INVALID_ASSET_LIST_MESSAGE = '素材列表格式不正确';

/** `ObjectList` 分类缺少数组容器键时抛出的错误文案 */
const MISSING_LIST_KEY_MESSAGE = '素材列表缺少容器键定义';

/** `ObjectList` 条目里存文件名的默认键名 */
const DEFAULT_SOURCE_FIELD = 'source';

/**
 * 判断一个未知值是否为普通对象（非 null、非数组）
 * @param value 待判断的值
 * @returns 是普通对象时为 true
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 把一个列表元素清洗成可用的素材名：非字符串或清洗不通过（含分隔符 / `..` / 前导点 / 非法字符）时为 null
 *
 * 列表文件正文来自工程内容，可能被写成 `../../secret` 之类：名字在进入路径推导前先过一遍上传同款清洗，
 * 以免拼出越出分类目录的路径（注入的文件系统仍会拒绝 `..`，这里只是多一道边界）。
 * @param value 列表里的候选项
 * @returns 清洗后的素材名；不可用时为 null
 */
function toAssetName(value: unknown): string | null {
  return typeof value === 'string' ? sanitizeAssetFileName(value) : null;
}

/**
 * 把列表正文解析成条目数组；两种分类格式各按约定解析
 * @param category 素材分类
 * @param document 列表文件的正文值
 * @returns 解析出的条目（保序、含原始下标）；单条格式不慎时跳过
 */
export function readAssetList(category: IAssetCategory, document: unknown): readonly IAssetListEntry[] {
  if (category.listFormat === AssetListFormat.StringList) return readStringList(document);

  return readObjectList(category, document);
}

/**
 * 解析 `string[]` 形态的列表正文
 * @param document 列表文件的正文值
 * @returns 非空字符串元素对应的条目
 */
function readStringList(document: unknown): readonly IAssetListEntry[] {
  if (!Array.isArray(document)) throw new Error(INVALID_ASSET_LIST_MESSAGE);

  const entries: IAssetListEntry[] = [];
  document.forEach((element, index) => {
    const name = toAssetName(element);

    if (name !== null) entries.push({ name, index });
  });

  return entries;
}

/**
 * 解析「对象数组挂在某个键下」形态的列表正文
 * @param category 素材分类（取 listKey / sourceField）
 * @param document 列表文件的正文值
 * @returns 含文件名条目对应的条目（保序、含原始下标）
 */
function readObjectList(category: IAssetCategory, document: unknown): readonly IAssetListEntry[] {
  if (!isRecord(document)) throw new Error(INVALID_ASSET_LIST_MESSAGE);

  const listKey = category.listKey;
  const rawList = listKey === undefined ? undefined : document[listKey];
  if (!Array.isArray(rawList)) throw new Error(INVALID_ASSET_LIST_MESSAGE);

  const sourceField = category.sourceField ?? DEFAULT_SOURCE_FIELD;
  const entries: IAssetListEntry[] = [];
  rawList.forEach((element, index) => {
    if (!isRecord(element)) return;

    const name = toAssetName(element[sourceField]);

    if (name !== null) entries.push({ name, config: element, index });
  });

  return entries;
}

/**
 * 把条目数组序列化回列表正文；`ObjectList` 时保留基底对象的其余键
 * @param category 素材分类
 * @param entries 条目数组（保序）
 * @param previousDocument 写回前的列表正文，作为保留其余键的基底
 * @returns 写回用的列表正文值
 */
export function writeAssetList(
  category: IAssetCategory,
  entries: readonly IAssetListEntry[],
  previousDocument: unknown,
): unknown {
  if (category.listFormat === AssetListFormat.StringList) return entries.map((entry) => entry.name);

  return writeObjectList(category, entries, previousDocument);
}

/**
 * 把条目数组序列化回「对象数组挂在某个键下」的列表正文
 * @param category 素材分类（取 listKey / sourceField）
 * @param entries 条目数组（保序）
 * @param previousDocument 写回前的列表正文，作为保留其余键的基底
 * @returns 写回用的列表正文值
 */
function writeObjectList(
  category: IAssetCategory,
  entries: readonly IAssetListEntry[],
  previousDocument: unknown,
): Record<string, unknown> {
  const sourceField = category.sourceField ?? DEFAULT_SOURCE_FIELD;
  const listKey = category.listKey;

  // 读侧在缺 listKey 时会抛错；写侧也必须显式失败，否则会静默写出一份没被改动的文档
  if (listKey === undefined) throw new Error(MISSING_LIST_KEY_MESSAGE);

  const base: Record<string, unknown> = isRecord(previousDocument) ? { ...previousDocument } : {};

  base[listKey] = entries.map((entry) => entry.config ?? { [sourceField]: entry.name });

  return base;
}

/**
 * 改某条条目的文件名：`ObjectList` 时同时改配置里的来源字段
 * @param category 素材分类
 * @param entry 要改的条目
 * @param newName 新的素材名
 * @returns 改过名字的新条目；原条目不被打扰
 */
export function renameAssetListEntry(
  category: IAssetCategory,
  entry: IAssetListEntry,
  newName: string,
): IAssetListEntry {
  if (category.listFormat === AssetListFormat.StringList) return { name: newName, index: entry.index };

  const sourceField = category.sourceField ?? DEFAULT_SOURCE_FIELD;
  const config = entry.config ?? {};

  return { name: newName, config: { ...config, [sourceField]: newName }, index: entry.index };
}
