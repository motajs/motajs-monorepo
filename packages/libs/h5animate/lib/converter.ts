/**
 * 格式转换器
 *
 * 提供从旧 .animate 格式到新 h5animate 格式的转换功能
 */

import { encodeH5Animate } from "./encoder.js";
import { createConversionFailedError, createValidationError } from "./errors.js";
import { combineBase64ImagesToWebP, type WebPOptions } from "./webp.js";
import type {
  LegacyAnimateFile,
  H5AnimateMeta,
  H5AnimateFrame,
  H5AnimateObject,
  SoundMeta,
  ImageConversionResult,
} from "./types.js";

/**
 * 旧格式必需字段列表
 */
const REQUIRED_FIELDS = ["ratio", "bitmaps", "frame_max", "frames"] as const;

/**
 * 验证旧格式文件的必需字段
 *
 * @param data - 待验证的数据
 * @throws H5AnimateError 如果必需字段缺失
 */
export function validateLegacyFormat(data: unknown): asserts data is LegacyAnimateFile {
  if (data === null || typeof data !== "object") {
    throw createValidationError("输入数据必须是对象");
  }

  const obj = data as Record<string, unknown>;
  const missingFields: string[] = [];

  for (const field of REQUIRED_FIELDS) {
    if (!(field in obj)) {
      missingFields.push(field);
    }
  }

  if (missingFields.length > 0) {
    throw createValidationError("旧格式文件缺少必需字段", missingFields);
  }

  // 验证字段类型
  if (typeof obj.ratio !== "number") {
    throw createValidationError("ratio 字段必须是数字");
  }

  if (!Array.isArray(obj.bitmaps)) {
    throw createValidationError("bitmaps 字段必须是数组");
  }

  if (typeof obj.frame_max !== "number" || obj.frame_max < 0) {
    throw createValidationError("frame_max 字段必须是非负数字");
  }

  if (!Array.isArray(obj.frames)) {
    throw createValidationError("frames 字段必须是数组");
  }
}

/**
 * 解析旧格式的 .animate 文件
 *
 * @param jsonString - JSON 格式的 .animate 文件内容
 * @returns 解析后的旧格式数据
 * @throws H5AnimateError 如果解析失败或格式无效
 */
export function parseLegacyAnimateFile(jsonString: string): LegacyAnimateFile {
  let data: unknown;

  try {
    data = JSON.parse(jsonString);
  } catch {
    throw createConversionFailedError("JSON 解析失败");
  }

  validateLegacyFormat(data);

  return data;
}

/**
 * 转换图像数据
 *
 * 将 Base64 编码的 PNG 图片转换为 WebP 格式并生成精灵图信息
 *
 * @param bitmaps - Base64 编码的图片数组
 * @param options - WebP 压缩选项
 * @returns 包含 WebP 数据和精灵图信息的结果
 * @throws H5AnimateError 如果图像转换失败
 */
export async function convertImages(
  bitmaps: string[],
  options: WebPOptions = {},
): Promise<ImageConversionResult> {
  // 过滤空字符串，只保留有效的图片数据
  const validBitmaps = bitmaps.filter((bitmap) => bitmap.length > 0);

  if (validBitmaps.length === 0) {
    throw createConversionFailedError("没有有效的图片数据可转换");
  }

  try {
    return await combineBase64ImagesToWebP(validBitmaps, options);
  } catch (error) {
    if (error instanceof Error && error.name === "H5AnimateError") {
      throw error;
    }
    const message = error instanceof Error ? error.message : "未知错误";
    throw createConversionFailedError(`图像转换失败: ${message}`);
  }
}

/**
 * 转换音效数据
 *
 * 将旧格式的音效配置转换为新格式的音效元数据
 *
 * @param legacy - 旧格式数据
 * @param frameIndex - 当前帧索引
 * @returns 音效元数据数组，如果没有音效则返回 undefined
 */
export function convertSoundData(
  legacy: LegacyAnimateFile,
  frameIndex: number,
): SoundMeta[] | undefined {
  if (!legacy.se) {
    return undefined;
  }

  const sounds: SoundMeta[] = [];

  if (typeof legacy.se === "string") {
    // 全局音效，只在第一帧添加
    if (frameIndex === 0) {
      sounds.push({ name: legacy.se });
    }
  } else {
    // 帧特定音效
    const soundName = legacy.se[frameIndex];
    if (soundName) {
      const sound: SoundMeta = { name: soundName };

      // 添加音调信息
      if (legacy.pitch && legacy.pitch[frameIndex] !== undefined) {
        sound.pitch = legacy.pitch[frameIndex];
      }

      sounds.push(sound);
    }
  }

  return sounds.length > 0 ? sounds : undefined;
}

/**
 * 转换帧图层数据为对象格式
 *
 * 将旧格式的数组格式图层数据转换为新格式的对象格式
 *
 * @param layer - 旧格式的图层数据 [index, x, y, scale, opacity, mirror?, rotate?]
 * @returns 新格式的对象数据
 */
export function convertFrameLayer(layer: [number, number, number, number, number, number?, number?]): H5AnimateObject {
  return {
    index: layer[0],
    x: layer[1],
    y: layer[2],
    scale: layer[3],
    opacity: layer[4],
    mirror: layer[5] ?? 0,
    rotate: layer[6] ?? 0,
  };
}

/**
 * 转换元数据
 *
 * 将旧格式的帧数据和音效配置转换为新格式的元数据
 *
 * @param legacy - 旧格式数据
 * @returns 新格式的元数据
 */
export function convertMetadata(legacy: LegacyAnimateFile): H5AnimateMeta {
  const frames: H5AnimateFrame[] = [];

  for (let i = 0; i < legacy.frame_max; i++) {
    const frameData = legacy.frames[i] || [];
    const frame: H5AnimateFrame = {};

    // 转换对象数据
    if (frameData.length > 0) {
      frame.objects = frameData.map(convertFrameLayer);
    }

    // 转换音效数据
    const sound = convertSoundData(legacy, i);
    if (sound) {
      frame.sound = sound;
    }

    frames.push(frame);
  }

  return {
    ratio: legacy.ratio,
    frame: frames,
  };
}

/**
 * 转换选项
 */
export interface ConvertOptions {
  /** WebP 压缩选项 */
  webp?: WebPOptions;
}

/**
 * 将旧格式转换为新格式
 *
 * 整合图像转换和元数据转换，生成最终的 h5animate 文件
 *
 * @param legacyData - 旧格式数据
 * @param options - 转换选项
 * @returns 编码后的 h5animate 二进制数据
 * @throws H5AnimateError 如果转换失败
 */
export async function convertToH5Animate(
  legacyData: LegacyAnimateFile,
  options: ConvertOptions = {},
): Promise<Buffer> {
  // 验证输入数据
  validateLegacyFormat(legacyData);

  // 转换图像数据并生成精灵图信息
  const { webpData, spriteInfo } = await convertImages(
    legacyData.bitmaps,
    options.webp,
  );

  // 转换元数据
  const meta = convertMetadata(legacyData);

  // 编码为新格式
  return encodeH5Animate(meta, spriteInfo, webpData);
}

/**
 * 从 JSON 字符串转换为 h5animate 格式
 *
 * 便捷函数，直接从 JSON 字符串转换
 *
 * @param jsonString - JSON 格式的 .animate 文件内容
 * @param options - 转换选项
 * @returns 编码后的 h5animate 二进制数据
 * @throws H5AnimateError 如果转换失败
 */
export async function convertFromJsonString(
  jsonString: string,
  options: ConvertOptions = {},
): Promise<Buffer> {
  const legacyData = parseLegacyAnimateFile(jsonString);
  return convertToH5Animate(legacyData, options);
}
