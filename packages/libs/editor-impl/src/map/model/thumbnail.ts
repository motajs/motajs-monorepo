import { MAP_THUMBNAIL_MAX_SIZE } from '../constants';
import { IMapDocument, IMapThumbnail } from '../types';

// 大地图缩略描述的纯函数：把「文档格数 + 画布像素」算成纹理尺寸、显示尺寸与居中偏移。
// 这一层不 import React / Pixi / editor-core，也不读文件与图片；描述里没有任何重建键，重建判据由视图比较决定。

/**
 * 判断一份尺寸能否参与运算
 * @param value 待检查的尺寸
 * @returns 为有限正数时为 true
 */
function isPositive(value: number): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * 造一份全零的缩略描述，供非法尺寸退化使用
 * @returns 宽高、缩放与纹理尺寸全为 0 的缩略描述
 */
function buildZeroThumbnail(): IMapThumbnail {
  return { width: 0, height: 0, scale: 0, offsetX: 0, offsetY: 0, textureWidth: 0, textureHeight: 0 };
}

/**
 * 把整张地图算成一份缩略描述：显示尺寸按画布等比适配并居中，纹理尺寸受边长上限约束
 *
 * 只由文档尺寸与画布尺寸决定：视口 / 缩放 / 选区 / 悬停都不参与，因此同一文档 + 同一画布永远得到同一份描述。
 * 纹理按 1 源像素 / 格生成，超过 `MAP_THUMBNAIL_MAX_SIZE` 时按最长边等比降采样；任一尺寸非正时退回全零描述，不抛错。
 * @param document 中立文档（只用 width / height）
 * @param canvasWidth 画布的像素宽
 * @param canvasHeight 画布的像素高
 * @returns 缩略图在画布上的尺寸 / 缩放 / 偏移与纹理尺寸
 */
export function buildThumbnail(document: IMapDocument, canvasWidth: number, canvasHeight: number): IMapThumbnail {
  if (!isPositive(document.width) || !isPositive(document.height)) return buildZeroThumbnail();
  if (!isPositive(canvasWidth) || !isPositive(canvasHeight)) return buildZeroThumbnail();

  const scale = Math.min(canvasWidth / document.width, canvasHeight / document.height);
  if (!(scale > 0)) return buildZeroThumbnail();

  const width = document.width * scale;
  const height = document.height * scale;
  const textureScale = Math.min(
    1,
    MAP_THUMBNAIL_MAX_SIZE / document.width,
    MAP_THUMBNAIL_MAX_SIZE / document.height,
  );

  return {
    width,
    height,
    scale,
    offsetX: Math.max(0, (canvasWidth - width) / 2),
    offsetY: Math.max(0, (canvasHeight - height) / 2),
    textureWidth: Math.max(1, Math.round(document.width * textureScale)),
    textureHeight: Math.max(1, Math.round(document.height * textureScale)),
  };
}
