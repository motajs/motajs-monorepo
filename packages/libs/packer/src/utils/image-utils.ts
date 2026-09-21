import sharp from 'sharp';
import { stat } from 'node:fs/promises';

/** 图片压缩阈值（256KB） */
const COMPRESS_THRESHOLD = 256 * 1024;

/** JPG 压缩质量 */
const JPG_QUALITY = 30;

/**
 * 图片压缩选项
 */
export interface ImageCompressOptions {
  /** 压缩质量（1-100），用于 JPG */
  quality?: number;
  /** 是否使用调色板模式，用于 PNG */
  palette?: boolean;
}

/**
 * 压缩图片
 * 对于超过 256KB 的图片：
 * - PNG: 转换为调色板模式 (P)
 * - JPG: 重新保存，质量设为 30
 *
 * @param imagePath 图片路径
 * @param options 压缩选项
 * @returns 是否进行了压缩
 */
export async function compressImage(imagePath: string, options?: ImageCompressOptions): Promise<boolean> {
  const stats = await stat(imagePath);

  // 小于阈值，不需要压缩
  if (stats.size < COMPRESS_THRESHOLD) {
    return false;
  }

  const isPng = imagePath.toLowerCase().endsWith('.png');
  const isJpg = /\.jpe?g$/i.test(imagePath);

  if (!isPng && !isJpg) {
    return false;
  }

  try {
    const image = sharp(imagePath);

    if (isPng) {
      // PNG: 使用调色板模式压缩
      await image
        .png({
          palette: options?.palette ?? true,
          quality: 80,
          compressionLevel: 9,
        })
        .toFile(imagePath + '.tmp');
    } else if (isJpg) {
      // JPG: 降低质量
      await image
        .jpeg({
          quality: options?.quality ?? JPG_QUALITY,
        })
        .toFile(imagePath + '.tmp');
    }

    // 检查压缩后的文件大小
    const { rename, unlink } = await import('node:fs/promises');
    const tmpStats = await stat(imagePath + '.tmp');

    // 只有压缩后更小才替换原文件
    if (tmpStats.size < stats.size) {
      await unlink(imagePath);
      await rename(imagePath + '.tmp', imagePath);
      return true;
    } else {
      await unlink(imagePath + '.tmp');
      return false;
    }
  } catch {
    // 压缩失败，保留原文件
    try {
      const { unlink } = await import('node:fs/promises');
      await unlink(imagePath + '.tmp');
    } catch {
      // 忽略清理错误
    }
    return false;
  }
}

/**
 * 创建透明图片
 * @param outputPath 输出路径
 * @param width 宽度
 * @param height 高度
 */
export async function createTransparentImage(outputPath: string, width: number, height: number): Promise<void> {
  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .png()
    .toFile(outputPath);
}

/**
 * 裁剪图片
 * @param imagePath 图片路径
 * @param x 起始 X 坐标
 * @param y 起始 Y 坐标
 * @param width 裁剪宽度
 * @param height 裁剪高度
 * @returns 裁剪后的图片 Buffer
 */
export async function cropImage(
  imagePath: string,
  x: number,
  y: number,
  width: number,
  height: number,
): Promise<Buffer> {
  return sharp(imagePath).extract({ left: x, top: y, width, height }).toBuffer();
}

/**
 * 裁剪图片并保存
 * @param imagePath 图片路径
 * @param outputPath 输出路径
 * @param x 起始 X 坐标
 * @param y 起始 Y 坐标
 * @param width 裁剪宽度
 * @param height 裁剪高度
 */
export async function cropImageToFile(
  imagePath: string,
  outputPath: string,
  x: number,
  y: number,
  width: number,
  height: number,
): Promise<void> {
  await sharp(imagePath).extract({ left: x, top: y, width, height }).toFile(outputPath);
}

/**
 * 获取图片尺寸
 * @param imagePath 图片路径
 * @returns 图片宽高
 */
export async function getImageSize(imagePath: string): Promise<{ width: number; height: number }> {
  const metadata = await sharp(imagePath).metadata();
  return {
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
  };
}

/**
 * 垂直拼接多个图片区域
 * @param imagePath 源图片路径
 * @param regions 要拼接的区域列表 [y, height]
 * @param tileWidth 每个 tile 的宽度
 * @param outputPath 输出路径
 */
export async function compositeVerticalRegions(
  imagePath: string,
  regions: Array<{ y: number; height: number }>,
  tileWidth: number,
  outputPath: string,
): Promise<void> {
  if (regions.length === 0) {
    // 没有区域，创建最小透明图
    await createTransparentImage(outputPath, tileWidth, 32);
    return;
  }

  // 计算总高度
  const totalHeight = regions.reduce((sum, r) => sum + r.height, 0);

  // 提取每个区域并拼接
  const buffers: Array<{ input: Buffer; top: number; left: number }> = [];
  let currentY = 0;

  for (const region of regions) {
    const buffer = await cropImage(imagePath, 0, region.y, tileWidth, region.height);
    buffers.push({ input: buffer, top: currentY, left: 0 });
    currentY += region.height;
  }

  // 创建目标图片并合成
  await sharp({
    create: {
      width: tileWidth,
      height: totalHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(buffers)
    .png()
    .toFile(outputPath);
}
