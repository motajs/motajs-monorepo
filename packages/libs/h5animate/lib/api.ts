/**
 * H5Animate 用户友好 API
 *
 * 提供简化的编码、解码和转换接口，封装底层实现细节
 */

import { decodeH5Animate as decodeCore } from "./decoder.js";
import { encodeH5Animate as encodeCore } from "./encoder.js";
import {
  convertToH5Animate as convertCore,
  convertFromJsonString as convertFromJsonCore,
  parseLegacyAnimateFile,
  type ConvertOptions,
} from "./converter.js";
import {
  extractFrameByIndex,
  extractAllFrames,
  type WebPOptions,
} from "./webp.js";
import type {
  H5AnimateMeta,
  SpriteInfo,
  DecodedH5Animate,
  LegacyAnimateFile,
} from "./types.js";

// ============ 解码 API ============

/**
 * 解码 h5animate 文件
 *
 * 将 h5animate 二进制数据解码为结构化的动画数据
 *
 * @param data - h5animate 文件的二进制数据
 * @returns 解码后的动画数据，包含元信息、精灵图信息和 WebP 图像数据
 * @throws H5AnimateError 如果文件格式无效或数据损坏
 *
 * @example
 * ```typescript
 * import { decode } from "@motajs/h5animate";
 * import { readFileSync } from "fs";
 *
 * const buffer = readFileSync("animation.h5animate");
 * const animation = decode(buffer);
 *
 * console.log("缩放比例:", animation.meta.ratio);
 * console.log("帧数:", animation.meta.frame.length);
 * console.log("精灵图数量:", animation.spriteInfo.count);
 * ```
 */
export function decode(data: Buffer): DecodedH5Animate {
  return decodeCore(data);
}

// ============ 编码 API ============

/**
 * 编码选项
 */
export interface EncodeOptions {
  /** 元数据 */
  meta: H5AnimateMeta;
  /** 精灵图信息 */
  spriteInfo: SpriteInfo;
  /** WebP 图像数据 */
  webpData: Buffer;
}

/**
 * 编码为 h5animate 格式
 *
 * 将动画数据编码为 h5animate 二进制格式
 *
 * @param options - 编码选项，包含元数据、精灵图信息和 WebP 数据
 * @returns 编码后的 h5animate 二进制数据
 * @throws H5AnimateError 如果输入数据无效
 *
 * @example
 * ```typescript
 * import { encode } from "@motajs/h5animate";
 * import { writeFileSync } from "fs";
 *
 * const buffer = encode({
 *   meta: {
 *     ratio: 2,
 *     frame: [
 *       { objects: [{ index: 0, x: 0, y: 0, scale: 100, opacity: 255 }] }
 *     ]
 *   },
 *   spriteInfo: { count: 1, dimensions: [{ width: 100, height: 100 }] },
 *   webpData: webpBuffer
 * });
 *
 * writeFileSync("animation.h5animate", buffer);
 * ```
 */
export function encode(options: EncodeOptions): Buffer {
  return encodeCore(options.meta, options.spriteInfo, options.webpData);
}

// ============ 转换 API ============

/**
 * 从旧格式转换为 h5animate 格式
 *
 * 将旧的 .animate JSON 格式转换为新的 h5animate 二进制格式
 *
 * @param legacyData - 旧格式的动画数据对象
 * @param options - 转换选项（可选）
 * @returns 编码后的 h5animate 二进制数据
 * @throws H5AnimateError 如果转换失败
 *
 * @example
 * ```typescript
 * import { convert } from "@motajs/h5animate";
 * import { readFileSync, writeFileSync } from "fs";
 *
 * const legacyJson = JSON.parse(readFileSync("animation.animate", "utf-8"));
 * const buffer = await convert(legacyJson);
 *
 * writeFileSync("animation.h5animate", buffer);
 * ```
 */
export async function convert(
  legacyData: LegacyAnimateFile,
  options?: ConvertOptions,
): Promise<Buffer> {
  return convertCore(legacyData, options);
}

/**
 * 从 JSON 字符串转换为 h5animate 格式
 *
 * 直接从 JSON 字符串转换，无需手动解析
 *
 * @param jsonString - 旧格式的 JSON 字符串
 * @param options - 转换选项（可选）
 * @returns 编码后的 h5animate 二进制数据
 * @throws H5AnimateError 如果转换失败
 *
 * @example
 * ```typescript
 * import { convertFromJson } from "@motajs/h5animate";
 * import { readFileSync, writeFileSync } from "fs";
 *
 * const jsonString = readFileSync("animation.animate", "utf-8");
 * const buffer = await convertFromJson(jsonString);
 *
 * writeFileSync("animation.h5animate", buffer);
 * ```
 */
export async function convertFromJson(
  jsonString: string,
  options?: ConvertOptions,
): Promise<Buffer> {
  return convertFromJsonCore(jsonString, options);
}

/**
 * 解析旧格式 JSON 字符串
 *
 * 将旧格式的 JSON 字符串解析为结构化对象，用于检查或修改后再转换
 *
 * @param jsonString - 旧格式的 JSON 字符串
 * @returns 解析后的旧格式数据对象
 * @throws H5AnimateError 如果解析失败或格式无效
 *
 * @example
 * ```typescript
 * import { parseLegacy, convert } from "@motajs/h5animate";
 *
 * const legacyData = parseLegacy(jsonString);
 * // 可以在这里修改 legacyData
 * const buffer = await convert(legacyData);
 * ```
 */
export function parseLegacy(jsonString: string): LegacyAnimateFile {
  return parseLegacyAnimateFile(jsonString);
}

// ============ 帧提取 API ============

/**
 * 帧提取选项
 */
export interface ExtractFrameOptions {
  /** 帧的高度 */
  frameHeight: number;
  /** 帧的宽度（可选，默认使用精灵图宽度） */
  frameWidth?: number;
}

/**
 * 从解码后的动画中提取单个帧
 *
 * @param animation - 解码后的动画数据
 * @param frameIndex - 帧索引（从 0 开始）
 * @param options - 提取选项
 * @returns 提取的帧图像 Buffer
 * @throws H5AnimateError 如果提取失败
 *
 * @example
 * ```typescript
 * import { decode, extractFrame } from "@motajs/h5animate";
 *
 * const animation = decode(buffer);
 * const frame = await extractFrame(animation, 0, { frameHeight: 100 });
 * ```
 */
export async function extractFrame(
  animation: DecodedH5Animate,
  frameIndex: number,
  options: ExtractFrameOptions,
): Promise<Buffer> {
  return extractFrameByIndex(animation.webpData, frameIndex, {
    height: options.frameHeight,
    width: options.frameWidth,
  });
}

/**
 * 从解码后的动画中提取所有帧
 *
 * @param animation - 解码后的动画数据
 * @param frameHeight - 每帧的高度
 * @param frameCount - 帧数量（可选，默认根据精灵图高度自动计算）
 * @returns 所有帧的 Buffer 数组
 * @throws H5AnimateError 如果提取失败
 *
 * @example
 * ```typescript
 * import { decode, extractFrames } from "@motajs/h5animate";
 *
 * const animation = decode(buffer);
 * const frames = await extractFrames(animation, 100);
 *
 * frames.forEach((frame, index) => {
 *   writeFileSync(`frame_${index}.webp`, frame);
 * });
 * ```
 */
export async function extractFrames(
  animation: DecodedH5Animate,
  frameHeight: number,
  frameCount?: number,
): Promise<Buffer[]> {
  return extractAllFrames(animation.webpData, frameHeight, frameCount);
}

// ============ 重新导出常用类型 ============

export type { ConvertOptions, WebPOptions };
