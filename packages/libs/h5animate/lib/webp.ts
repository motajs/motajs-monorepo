/**
 * WebP 图像处理模块
 *
 * 提供 PNG 到 WebP 的转换、精灵图创建和帧提取功能
 */

import sharp from "sharp";
import type { SpriteInfo, ImageConversionResult } from "./types.js";
import { createWebPProcessingError } from "./errors.js";

/**
 * WebP 压缩选项
 */
export type WebPOptions = sharp.WebpOptions;

/**
 * 将单个图像转换为 WebP 格式
 *
 * 支持无损和有损两种压缩模式
 *
 * @param imageBuffer - 输入图像的 Buffer（支持 PNG、JPEG 等格式）
 * @param options - WebP 压缩选项
 * @returns 转换后的 WebP 数据
 * @throws H5AnimateError 如果图像处理失败
 */
export async function convertToWebP(
  imageBuffer: Buffer,
  options: WebPOptions = {},
): Promise<Buffer> {
  const { lossless = true, quality = 80 } = options;

  try {
    const webpOptions: sharp.WebpOptions = lossless
      ? { lossless: true }
      : { lossless: false, quality };

    return await sharp(imageBuffer).webp(webpOptions).toBuffer();
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    throw createWebPProcessingError(`图像转换为 WebP 失败: ${message}`);
  }
}

/**
 * 单个图像的元数据
 */
interface ImageMeta {
  width: number;
  height: number;
}

/**
 * 获取图像的尺寸信息
 *
 * @param imageBuffer - 图像 Buffer
 * @returns 图像的宽度和高度
 */
async function getImageMeta(imageBuffer: Buffer): Promise<ImageMeta> {
  const metadata = await sharp(imageBuffer).metadata();
  return {
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
  };
}

/**
 * 将多个图像垂直合并为单个 WebP 精灵图
 *
 * 所有图像将垂直排列，宽度取最大值，高度为所有图像高度之和
 * 保持透明度信息（alpha 通道）
 *
 * @param imageBuffers - 输入图像的 Buffer 数组
 * @param options - WebP 压缩选项
 * @returns 包含 WebP 数据和精灵图信息的结果
 * @throws H5AnimateError 如果图像处理失败
 */
export async function createVerticalSpriteSheet(
  imageBuffers: Buffer[],
  options: WebPOptions = {},
): Promise<ImageConversionResult> {
  if (imageBuffers.length === 0) {
    throw createWebPProcessingError("没有图像可处理");
  }

  const { lossless = true, quality = 80 } = options;

  const webpOptions: sharp.WebpOptions = {
    lossless,
    quality,
    effort: 6,
  };

  try {
    // 获取所有图像的尺寸信息
    const imageMetas = await Promise.all(imageBuffers.map(getImageMeta));

    // 单个图像的情况，直接转换
    if (imageBuffers.length === 1) {

      const webpData = await sharp(imageBuffers[0]).webp(webpOptions).toBuffer();

      const spriteInfo: SpriteInfo = {
        count: 1,
        dimensions: [
          {
            width: imageMetas[0].width,
            height: imageMetas[0].height,
          },
        ],
      };

      return { webpData, spriteInfo };
    }

    // 多个图像的情况，创建垂直排列的精灵图
    const maxWidth = Math.max(...imageMetas.map((meta) => meta.width));
    const totalHeight = imageMetas.reduce((sum, meta) => sum + meta.height, 0);

    // 创建透明背景的画布
    const canvas = sharp({
      create: {
        width: maxWidth,
        height: totalHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    });

    // 准备合成操作
    const composite: sharp.OverlayOptions[] = [];
    let currentY = 0;

    for (let i = 0; i < imageBuffers.length; i++) {
      composite.push({
        input: imageBuffers[i],
        top: currentY,
        left: 0,
      });
      currentY += imageMetas[i].height;
    }

    // 合成并转换为 WebP
    const webpData = await canvas.composite(composite).webp(webpOptions).toBuffer();

    // 生成精灵图信息
    const spriteInfo: SpriteInfo = {
      count: 1,
      dimensions: [
        {
          width: maxWidth,
          height: totalHeight,
        },
      ],
    };

    return { webpData, spriteInfo };
  } catch (error) {
    if (error instanceof Error && error.name === "H5AnimateError") {
      throw error;
    }
    const message = error instanceof Error ? error.message : "未知错误";
    throw createWebPProcessingError(`创建精灵图失败: ${message}`);
  }
}

/**
 * 将 Base64 编码的图像数据转换为 Buffer
 *
 * @param base64Data - Base64 编码的图像数据（可包含 data URI 前缀）
 * @returns 图像 Buffer
 */
export function base64ToBuffer(base64Data: string): Buffer {
  // 移除 data URI 前缀（如果存在）
  const base64Content = base64Data.includes(",")
    ? base64Data.split(",")[1]
    : base64Data;

  return Buffer.from(base64Content, "base64");
}

/**
 * 将多个 Base64 编码的图像合并为 WebP 精灵图
 *
 * @param base64Images - Base64 编码的图像数组
 * @param options - WebP 压缩选项
 * @returns 包含 WebP 数据和精灵图信息的结果
 */
export async function combineBase64ImagesToWebP(
  base64Images: string[],
  options: WebPOptions = {},
): Promise<ImageConversionResult> {
  // 过滤空字符串并转换为 Buffer
  const imageBuffers = base64Images
    .filter((img) => img.length > 0)
    .map(base64ToBuffer);

  return createVerticalSpriteSheet(imageBuffers, options);
}

/**
 * 帧提取选项
 */
export interface ExtractFrameOptions {
  /** 帧的宽度（如果不指定，使用精灵图宽度） */
  width?: number;
  /** 帧的高度 */
  height: number;
}

/**
 * 从精灵图中按索引提取单个帧
 *
 * 假设精灵图是垂直排列的，每个帧具有相同的高度
 *
 * @param webpBuffer - WebP 精灵图数据
 * @param frameIndex - 帧索引（从 0 开始）
 * @param options - 提取选项
 * @returns 提取的帧图像 Buffer
 * @throws H5AnimateError 如果提取失败
 */
export async function extractFrameByIndex(
  webpBuffer: Buffer,
  frameIndex: number,
  options: ExtractFrameOptions,
): Promise<Buffer> {
  const { height } = options;

  try {
    const metadata = await sharp(webpBuffer).metadata();
    const spriteWidth = options.width ?? metadata.width ?? 0;
    const spriteHeight = metadata.height ?? 0;

    const top = frameIndex * height;

    // 检查是否超出边界
    if (top + height > spriteHeight) {
      throw createWebPProcessingError(
        `帧索引 ${frameIndex} 超出精灵图范围（精灵图高度: ${spriteHeight}, 请求位置: ${top}-${top + height}）`,
      );
    }

    return await sharp(webpBuffer)
      .extract({
        left: 0,
        top,
        width: spriteWidth,
        height,
      })
      .toBuffer();
  } catch (error) {
    if (error instanceof Error && error.name === "H5AnimateError") {
      throw error;
    }
    const message = error instanceof Error ? error.message : "未知错误";
    throw createWebPProcessingError(`提取帧失败: ${message}`);
  }
}

/**
 * 从精灵图中按位置提取单个帧
 *
 * @param webpBuffer - WebP 精灵图数据
 * @param top - 起始 Y 坐标
 * @param left - 起始 X 坐标
 * @param width - 帧宽度
 * @param height - 帧高度
 * @returns 提取的帧图像 Buffer
 * @throws H5AnimateError 如果提取失败
 */
export async function extractFrameByPosition(
  webpBuffer: Buffer,
  top: number,
  left: number,
  width: number,
  height: number,
): Promise<Buffer> {
  try {
    return await sharp(webpBuffer)
      .extract({ left, top, width, height })
      .toBuffer();
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    throw createWebPProcessingError(`提取帧失败: ${message}`);
  }
}

/**
 * 从精灵图中提取所有帧
 *
 * @param webpBuffer - WebP 精灵图数据
 * @param frameHeight - 每帧的高度
 * @param frameCount - 帧数量（如果不指定，根据精灵图高度自动计算）
 * @returns 所有帧的 Buffer 数组
 * @throws H5AnimateError 如果提取失败
 */
export async function extractAllFrames(
  webpBuffer: Buffer,
  frameHeight: number,
  frameCount?: number,
): Promise<Buffer[]> {
  try {
    const metadata = await sharp(webpBuffer).metadata();
    const spriteHeight = metadata.height ?? 0;
    const spriteWidth = metadata.width ?? 0;

    // 计算帧数量
    const count = frameCount ?? Math.floor(spriteHeight / frameHeight);

    const frames: Buffer[] = [];

    for (let i = 0; i < count; i++) {
      const frame = await sharp(webpBuffer)
        .extract({
          left: 0,
          top: i * frameHeight,
          width: spriteWidth,
          height: frameHeight,
        })
        .toBuffer();
      frames.push(frame);
    }

    return frames;
  } catch (error) {
    if (error instanceof Error && error.name === "H5AnimateError") {
      throw error;
    }
    const message = error instanceof Error ? error.message : "未知错误";
    throw createWebPProcessingError(`提取所有帧失败: ${message}`);
  }
}
