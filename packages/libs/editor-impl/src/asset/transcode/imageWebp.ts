import { ASSET_DEFAULT_WEBP_QUALITY } from './types';

// 图片转 WebP：解码用浏览器自带的 createImageBitmap，编码用 OffscreenCanvas，
// 全程不碰 DOM 与网络；环境缺少这两项能力时先探测再抛可读错误。

/** 环境缺少图片转码能力时的错误文案 */
const IMAGE_TRANSCODE_UNSUPPORTED_MESSAGE = '当前环境不支持图片转码';

/** 编码器没有输出 WebP 时的错误文案 */
const WEBP_ENCODE_UNSUPPORTED_MESSAGE = '当前环境不支持 WebP 编码';

/** WebP 质量下界 */
const QUALITY_MIN = 0;

/** WebP 质量上界 */
const QUALITY_MAX = 100;

/**
 * 判断当前环境是否具备图片转 WebP 的能力
 * @returns 同时存在 OffscreenCanvas 与 createImageBitmap 时为 true
 */
export function canUseImageTranscode(): boolean {
  return typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap === 'function';
}

/**
 * 把 0–100 的质量值换算成编码器需要的 0–1 比例；非法值回落到默认质量
 * @param quality 质量值（0–100）
 * @returns 0–1 的质量比例
 */
function toQualityRatio(quality: number): number {
  if (!Number.isFinite(quality)) return ASSET_DEFAULT_WEBP_QUALITY / 100;

  return Math.min(Math.max(quality, QUALITY_MIN), QUALITY_MAX) / 100;
}

/**
 * 把图片字节转码为 WebP
 * @param bytes 原始图片字节
 * @param quality WebP 质量（0–100）
 * @returns 转码后的 WebP 字节
 */
export async function transcodeImageToWebp(bytes: Uint8Array, quality: number): Promise<Uint8Array> {
  if (!canUseImageTranscode()) throw new Error(IMAGE_TRANSCODE_UNSUPPORTED_MESSAGE);

  const bitmap = await createImageBitmap(new Blob([bytes.slice()]));
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    bitmap.close();
    throw new Error(IMAGE_TRANSCODE_UNSUPPORTED_MESSAGE);
  }

  context.imageSmoothingEnabled = false;
  context.drawImage(bitmap, 0, 0);
  bitmap.close();

  const blob = await canvas.convertToBlob({ type: 'image/webp', quality: toQualityRatio(quality) });
  if (blob.type !== 'image/webp') throw new Error(WEBP_ENCODE_UNSUPPORTED_MESSAGE);

  return new Uint8Array(await blob.arrayBuffer());
}
