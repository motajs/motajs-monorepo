import { AssetCategoryKind } from '../../react';

// 素材字节的 MIME 解析：预览与选择器共用一处，按文件扩展名推出真实类型，
// 不再假设「图片就是 png、音频就是 mpeg」——转码后字节是 WebP / WebM。

/** 无法从扩展名判断时的图片兜底 MIME */
const FALLBACK_IMAGE_MIME = 'image/png';

/** 无法从扩展名判断时的音频兜底 MIME */
const FALLBACK_AUDIO_MIME = 'audio/mpeg';

/** 非图片 / 音频分类的兜底 MIME */
const FALLBACK_BINARY_MIME = 'application/octet-stream';

/**
 * 取路径末段的小写扩展名（含前导点）
 * @param path 文件路径
 * @returns 小写扩展名；路径末段没有扩展名时为空串
 */
function extensionOf(path: string): string {
  const slash = path.lastIndexOf('/');
  const dot = path.lastIndexOf('.');

  if (dot <= slash) return '';

  return path.slice(dot).toLowerCase();
}

/**
 * 由图片扩展名推断 MIME 类型
 * @param extension 小写扩展名（含前导点）
 * @returns 对应的图片 MIME；无法识别时为兜底 MIME
 */
function imageMimeOf(extension: string): string {
  if (extension === '.webp') return 'image/webp';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.gif') return 'image/gif';
  if (extension === '.bmp') return 'image/bmp';
  if (extension === '.svg') return 'image/svg+xml';

  return FALLBACK_IMAGE_MIME;
}

/**
 * 由音频扩展名推断 MIME 类型
 * @param extension 小写扩展名（含前导点）
 * @returns 对应的音频 MIME；无法识别时为兜底 MIME
 */
function audioMimeOf(extension: string): string {
  if (extension === '.webm') return 'audio/webm';
  if (extension === '.mp3') return 'audio/mpeg';
  if (extension === '.ogg' || extension === '.oga') return 'audio/ogg';
  if (extension === '.wav') return 'audio/wav';
  if (extension === '.m4a' || extension === '.aac') return 'audio/mp4';
  if (extension === '.flac') return 'audio/flac';

  return FALLBACK_AUDIO_MIME;
}

/**
 * 由素材字节文件路径与分类推断字节的 MIME 类型
 * @param path 素材字节文件路径
 * @param kind 素材的大分类
 * @returns 该素材字节对应的 MIME 类型
 */
export function resolveAssetMime(path: string, kind: AssetCategoryKind): string {
  const extension = extensionOf(path);

  if (kind === AssetCategoryKind.Image) return imageMimeOf(extension);
  if (kind === AssetCategoryKind.Audio) return audioMimeOf(extension);

  return FALLBACK_BINARY_MIME;
}
