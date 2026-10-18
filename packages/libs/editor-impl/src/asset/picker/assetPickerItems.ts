import { IResourceAccess } from '@motajs/editor-core';
import { AssetCategoryKind, IAssetCategory, IMultiSelectItem } from '../../react';
import { parseTableText, TableTextParseStatus } from '../../shared/jsonc';
import { readAssetList, resolveAssetBytePath } from '../model';
import { IAssetPickerItems } from '../types';

// 选择器的数据来源：按分类读列表文件（与面板同一套模型），并为每条素材生成候选预览。
// 图片与音频读字节后生成可回收的 blob: 地址（缩略图 / 试听），动画只给预览提示、字体无预览；
// 单条读不到字节时跳过该项预览而不中断整份列表。

/** 素材列表正文无法解析时抛出的错误文案 */
const INVALID_PICKER_LIST_MESSAGE = '素材列表格式不正确';

/** 图片候选缩略图的 MIME 类型 */
const PICKER_IMAGE_MIME = 'image/*';

/** 音频候选试听的 MIME 类型 */
const PICKER_AUDIO_MIME = 'audio/*';

/**
 * 经资源层读一个分类下某条素材的字节
 * @param access 资源访问口
 * @param path 素材字节文件路径
 * @returns 字节；文件不存在或读取失败时为 undefined
 */
async function readAssetBytes(access: IResourceAccess, path: string): Promise<Uint8Array | undefined> {
  const resource = await access.requestResource(path);

  if (resource === null) return undefined;

  try {
    return await resource.requestBinary();
  } catch {
    return undefined;
  }
}

/**
 * 经资源层读取分类列表文件的原文，列表文件不存在时按空处理
 * @param access 资源访问口
 * @param category 素材分类
 * @returns 列表原文；列表文件不存在或为空时为 undefined
 */
async function readListText(access: IResourceAccess, category: IAssetCategory): Promise<string | undefined> {
  const directory = await access.listDirectory(category.dir);
  const paths = new Set<string>();

  for (const entry of directory) paths.add(entry.path);

  if (!paths.has(category.listPath)) return undefined;

  const resource = await access.requestResource(category.listPath);

  if (resource === null) return undefined;

  const content = await resource.request();

  if (content === undefined) return undefined;
  if (typeof content === 'string') return content;

  return new TextDecoder().decode(content);
}

/**
 * 由一条素材生成带预览的候选项：图片给缩略图、音频给试听、动画给预览提示、字体无预览
 * @param access 资源访问口
 * @param category 素材分类
 * @param name 素材名
 * @param objectUrls 本次已创建的 blob: 地址收集处
 * @returns 候选项
 */
async function buildPickerItem(
  access: IResourceAccess,
  category: IAssetCategory,
  name: string,
  objectUrls: string[],
): Promise<IMultiSelectItem> {
  if (category.kind === AssetCategoryKind.Animation) return { id: name, label: name, animation: true };
  if (category.kind === AssetCategoryKind.Font) return { id: name, label: name };

  const bytes = await readAssetBytes(access, resolveAssetBytePath(category, name));

  if (bytes === undefined) return { id: name, label: name };

  if (category.kind === AssetCategoryKind.Image) {
    const url = URL.createObjectURL(new Blob([bytes.slice()], { type: PICKER_IMAGE_MIME }));

    objectUrls.push(url);
    return { id: name, label: name, thumbnail: url };
  }

  if (category.kind === AssetCategoryKind.Audio) {
    const url = URL.createObjectURL(new Blob([bytes.slice()], { type: PICKER_AUDIO_MIME }));

    objectUrls.push(url);
    return { id: name, label: name, audio: url };
  }

  return { id: name, label: name };
}

/**
 * 按分类读列表文件并生成候选素材项（含图片缩略图 / 音频试听 / 动画预览）
 * @param access 资源访问口
 * @param category 素材分类
 * @returns 候选项与本次创建的 blob: 地址集合（供调用方回收）
 */
export async function loadPickerItems(access: IResourceAccess, category: IAssetCategory): Promise<IAssetPickerItems> {
  const text = await readListText(access, category);

  if (text === undefined) return { items: [], objectUrls: [] };

  const parsed = parseTableText(text);

  if (parsed.status !== TableTextParseStatus.Conforming) throw new Error(INVALID_PICKER_LIST_MESSAGE);

  const entries = readAssetList(category, parsed.value);
  const objectUrls: string[] = [];
  const items: IMultiSelectItem[] = [];

  for (const entry of entries) items.push(await buildPickerItem(access, category, entry.name, objectUrls));

  return { items, objectUrls };
}
