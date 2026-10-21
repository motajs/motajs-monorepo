import { AssetCategoryKind, IAssetCategory } from '../../../react';

// 素材后缀白名单：面板内置的默认值，不是公开契约（放在没有桶文件的 `model/internal/` 下）。
// 新增 / 替换 / 未登记扫描三处共用这里的判定；`accept` 只是选择框提示，真正的闸门是 `isAssetFileAccepted`。

/** 图片分类的默认可选后缀 */
export const ASSET_IMAGE_FILE_EXTENSIONS: readonly string[] = Object.freeze([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.bmp',
]);

/** 音频分类的默认可选后缀 */
export const ASSET_AUDIO_FILE_EXTENSIONS: readonly string[] = Object.freeze([
  '.mp3',
  '.wav',
  '.flac',
  '.ogg',
  '.m4a',
  '.aac',
  '.opus',
  '.webm',
]);

/** 动画分类的默认可选后缀 */
export const ASSET_ANIMATION_FILE_EXTENSIONS: readonly string[] = Object.freeze(['.anim']);

/** 字体分类的默认可选后缀 */
export const ASSET_FONT_FILE_EXTENSIONS: readonly string[] = Object.freeze(['.ttf', '.otf', '.woff', '.woff2']);

/** 拒绝文案的前半句 */
export const ASSET_UNSUPPORTED_EXTENSION_PREFIX = '不支持的素材格式，当前分类只接受：';

/**
 * 按大分类取内置的可选后缀清单
 * @param kind 分类的大分类
 * @returns 该大分类的内置后缀清单
 */
export function resolveKindFileExtensions(kind: AssetCategoryKind): readonly string[] {
  if (kind === AssetCategoryKind.Image) return ASSET_IMAGE_FILE_EXTENSIONS;
  if (kind === AssetCategoryKind.Audio) return ASSET_AUDIO_FILE_EXTENSIONS;
  if (kind === AssetCategoryKind.Animation) return ASSET_ANIMATION_FILE_EXTENSIONS;

  return ASSET_FONT_FILE_EXTENSIONS;
}

/**
 * 取某个分类能收的后缀清单：分类自带 `extension` 时只认它，否则按大分类取内置清单
 * @param category 素材分类
 * @returns 该分类允许的文件后缀（含前导点）
 */
export function resolveAssetFileExtensions(category: IAssetCategory): readonly string[] {
  const extension = category.extension;

  if (extension !== undefined && extension.length > 0) return [extension];

  return resolveKindFileExtensions(category.kind);
}

/**
 * 判断一个文件名是否属于当前分类：取最后一个点之后的后缀、转小写后比对
 * @param category 素材分类
 * @param fileName 用户选中的原始文件名
 * @returns 后缀在分类白名单内时为 true；没有扩展名或点在首位（如 `.gitignore`）时为 false
 */
export function isAssetFileAccepted(category: IAssetCategory, fileName: string): boolean {
  const dot = fileName.lastIndexOf('.');

  if (dot <= 0) return false;

  const extension = fileName.slice(dot).toLowerCase();

  return resolveAssetFileExtensions(category).some((item) => item.toLowerCase() === extension);
}

/**
 * 拼出「不支持该类型」的提示文案
 * @param extensions 当前分类允许的后缀清单
 * @returns 前缀加用「、」连接的允许后缀
 */
export function unsupportedAssetExtensionMessage(extensions: readonly string[]): string {
  return `${ASSET_UNSUPPORTED_EXTENSION_PREFIX}${extensions.join('、')}`;
}
