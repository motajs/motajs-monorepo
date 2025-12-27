/**
 * 输入验证函数
 *
 * 提供元数据结构完整性验证和数据类型检查
 */

import {
  createTypeMismatchError,
  createMissingFieldError,
  createValueOutOfRangeError,
  createValidationError,
} from "./errors.js";
import type {
  H5AnimateMeta,
  H5AnimateFrame,
  H5AnimateObject,
  SoundMeta,
  SpriteInfo,
  SpriteDimension,
  LegacyAnimateFile,
} from "./types.js";

/**
 * 验证结果
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * 获取值的类型描述
 */
function getTypeDescription(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

/**
 * 验证 SoundMeta 对象
 *
 * @param sound - 待验证的音效元数据
 * @param path - 字段路径
 * @throws H5AnimateError 如果验证失败
 */
export function validateSoundMeta(sound: unknown, path: string): asserts sound is SoundMeta {
  if (sound === null || typeof sound !== "object") {
    throw createTypeMismatchError(path, "object", getTypeDescription(sound));
  }

  const obj = sound as Record<string, unknown>;

  // 验证必需字段 name
  if (!("name" in obj)) {
    throw createMissingFieldError(["name"], path);
  }

  if (typeof obj.name !== "string") {
    throw createTypeMismatchError(`${path}.name`, "string", getTypeDescription(obj.name));
  }

  // 验证可选字段 volume
  if ("volume" in obj && obj.volume !== undefined) {
    if (typeof obj.volume !== "number") {
      throw createTypeMismatchError(`${path}.volume`, "number", getTypeDescription(obj.volume));
    }
  }

  // 验证可选字段 pitch
  if ("pitch" in obj && obj.pitch !== undefined) {
    if (typeof obj.pitch !== "number") {
      throw createTypeMismatchError(`${path}.pitch`, "number", getTypeDescription(obj.pitch));
    }
  }
}

/**
 * 验证 H5AnimateObject 对象
 *
 * @param obj - 待验证的对象数据
 * @param path - 字段路径
 * @throws H5AnimateError 如果验证失败
 */
export function validateH5AnimateObject(obj: unknown, path: string): asserts obj is H5AnimateObject {
  if (obj === null || typeof obj !== "object") {
    throw createTypeMismatchError(path, "object", getTypeDescription(obj));
  }

  const data = obj as Record<string, unknown>;
  const requiredFields = ["index", "x", "y", "scale", "opacity"];
  const missingFields: string[] = [];

  for (const field of requiredFields) {
    if (!(field in data)) {
      missingFields.push(field);
    }
  }

  if (missingFields.length > 0) {
    throw createMissingFieldError(missingFields, path);
  }

  // 验证必需字段类型
  if (typeof data.index !== "number") {
    throw createTypeMismatchError(`${path}.index`, "number", getTypeDescription(data.index));
  }

  if (typeof data.x !== "number") {
    throw createTypeMismatchError(`${path}.x`, "number", getTypeDescription(data.x));
  }

  if (typeof data.y !== "number") {
    throw createTypeMismatchError(`${path}.y`, "number", getTypeDescription(data.y));
  }

  if (typeof data.scale !== "number") {
    throw createTypeMismatchError(`${path}.scale`, "number", getTypeDescription(data.scale));
  }

  if (typeof data.opacity !== "number") {
    throw createTypeMismatchError(`${path}.opacity`, "number", getTypeDescription(data.opacity));
  }

  // 验证可选字段
  if ("mirror" in data && data.mirror !== undefined) {
    if (typeof data.mirror !== "number") {
      throw createTypeMismatchError(`${path}.mirror`, "number", getTypeDescription(data.mirror));
    }
  }

  if ("rotate" in data && data.rotate !== undefined) {
    if (typeof data.rotate !== "number") {
      throw createTypeMismatchError(`${path}.rotate`, "number", getTypeDescription(data.rotate));
    }
  }

  // 验证值范围
  if (data.index < 0) {
    throw createValueOutOfRangeError(`${path}.index`, data.index as number, 0);
  }

  if ((data.opacity as number) < 0 || (data.opacity as number) > 255) {
    throw createValueOutOfRangeError(`${path}.opacity`, data.opacity as number, 0, 255);
  }
}

/**
 * 验证 H5AnimateFrame 对象
 *
 * @param frame - 待验证的帧数据
 * @param path - 字段路径
 * @throws H5AnimateError 如果验证失败
 */
export function validateH5AnimateFrame(frame: unknown, path: string): asserts frame is H5AnimateFrame {
  if (frame === null || typeof frame !== "object") {
    throw createTypeMismatchError(path, "object", getTypeDescription(frame));
  }

  const data = frame as Record<string, unknown>;

  // 验证可选字段 sound
  if ("sound" in data && data.sound !== undefined) {
    if (!Array.isArray(data.sound)) {
      throw createTypeMismatchError(`${path}.sound`, "array", getTypeDescription(data.sound));
    }

    for (let i = 0; i < data.sound.length; i++) {
      validateSoundMeta(data.sound[i], `${path}.sound[${i}]`);
    }
  }

  // 验证可选字段 objects
  if ("objects" in data && data.objects !== undefined) {
    if (!Array.isArray(data.objects)) {
      throw createTypeMismatchError(`${path}.objects`, "array", getTypeDescription(data.objects));
    }

    for (let i = 0; i < data.objects.length; i++) {
      validateH5AnimateObject(data.objects[i], `${path}.objects[${i}]`);
    }
  }
}

/**
 * 验证 H5AnimateMeta 元数据结构
 *
 * @param meta - 待验证的元数据
 * @throws H5AnimateError 如果验证失败
 */
export function validateH5AnimateMeta(meta: unknown): asserts meta is H5AnimateMeta {
  if (meta === null || typeof meta !== "object") {
    throw createTypeMismatchError("meta", "object", getTypeDescription(meta));
  }

  const data = meta as Record<string, unknown>;
  const missingFields: string[] = [];

  // 检查必需字段
  if (!("ratio" in data)) {
    missingFields.push("ratio");
  }

  if (!("frame" in data)) {
    missingFields.push("frame");
  }

  if (missingFields.length > 0) {
    throw createMissingFieldError(missingFields, "meta");
  }

  // 验证 ratio 类型
  if (typeof data.ratio !== "number") {
    throw createTypeMismatchError("meta.ratio", "number", getTypeDescription(data.ratio));
  }

  // 验证 ratio 值范围
  if (data.ratio <= 0) {
    throw createValueOutOfRangeError("meta.ratio", data.ratio, 0);
  }

  // 验证 frame 类型
  if (!Array.isArray(data.frame)) {
    throw createTypeMismatchError("meta.frame", "array", getTypeDescription(data.frame));
  }

  // 验证每一帧
  for (let i = 0; i < data.frame.length; i++) {
    validateH5AnimateFrame(data.frame[i], `meta.frame[${i}]`);
  }
}

/**
 * 验证 SpriteDimension 对象
 *
 * @param dimension - 待验证的尺寸数据
 * @param path - 字段路径
 * @throws H5AnimateError 如果验证失败
 */
export function validateSpriteDimension(dimension: unknown, path: string): asserts dimension is SpriteDimension {
  if (dimension === null || typeof dimension !== "object") {
    throw createTypeMismatchError(path, "object", getTypeDescription(dimension));
  }

  const data = dimension as Record<string, unknown>;
  const missingFields: string[] = [];

  if (!("width" in data)) {
    missingFields.push("width");
  }

  if (!("height" in data)) {
    missingFields.push("height");
  }

  if (missingFields.length > 0) {
    throw createMissingFieldError(missingFields, path);
  }

  if (typeof data.width !== "number") {
    throw createTypeMismatchError(`${path}.width`, "number", getTypeDescription(data.width));
  }

  if (typeof data.height !== "number") {
    throw createTypeMismatchError(`${path}.height`, "number", getTypeDescription(data.height));
  }

  if (data.width <= 0) {
    throw createValueOutOfRangeError(`${path}.width`, data.width, 1);
  }

  if (data.height <= 0) {
    throw createValueOutOfRangeError(`${path}.height`, data.height, 1);
  }
}

/**
 * 验证 SpriteInfo 精灵图信息
 *
 * @param spriteInfo - 待验证的精灵图信息
 * @throws H5AnimateError 如果验证失败
 */
export function validateSpriteInfo(spriteInfo: unknown): asserts spriteInfo is SpriteInfo {
  if (spriteInfo === null || typeof spriteInfo !== "object") {
    throw createTypeMismatchError("spriteInfo", "object", getTypeDescription(spriteInfo));
  }

  const data = spriteInfo as Record<string, unknown>;
  const missingFields: string[] = [];

  if (!("count" in data)) {
    missingFields.push("count");
  }

  if (!("dimensions" in data)) {
    missingFields.push("dimensions");
  }

  if (missingFields.length > 0) {
    throw createMissingFieldError(missingFields, "spriteInfo");
  }

  if (typeof data.count !== "number") {
    throw createTypeMismatchError("spriteInfo.count", "number", getTypeDescription(data.count));
  }

  if (data.count < 0) {
    throw createValueOutOfRangeError("spriteInfo.count", data.count, 0);
  }

  if (!Array.isArray(data.dimensions)) {
    throw createTypeMismatchError("spriteInfo.dimensions", "array", getTypeDescription(data.dimensions));
  }

  // 验证每个尺寸
  for (let i = 0; i < data.dimensions.length; i++) {
    validateSpriteDimension(data.dimensions[i], `spriteInfo.dimensions[${i}]`);
  }
}

/**
 * 验证旧格式文件结构
 *
 * @param data - 待验证的数据
 * @throws H5AnimateError 如果验证失败
 */
export function validateLegacyAnimateFile(data: unknown): asserts data is LegacyAnimateFile {
  if (data === null || typeof data !== "object") {
    throw createTypeMismatchError("legacyData", "object", getTypeDescription(data));
  }

  const obj = data as Record<string, unknown>;
  const requiredFields = ["ratio", "bitmaps", "frame_max", "frames"];
  const missingFields: string[] = [];

  for (const field of requiredFields) {
    if (!(field in obj)) {
      missingFields.push(field);
    }
  }

  if (missingFields.length > 0) {
    throw createMissingFieldError(missingFields, "legacyData");
  }

  // 验证 ratio
  if (typeof obj.ratio !== "number") {
    throw createTypeMismatchError("legacyData.ratio", "number", getTypeDescription(obj.ratio));
  }

  // 验证 bitmaps
  if (!Array.isArray(obj.bitmaps)) {
    throw createTypeMismatchError("legacyData.bitmaps", "array", getTypeDescription(obj.bitmaps));
  }

  // 验证 frame_max
  if (typeof obj.frame_max !== "number") {
    throw createTypeMismatchError("legacyData.frame_max", "number", getTypeDescription(obj.frame_max));
  }

  if (obj.frame_max < 0) {
    throw createValueOutOfRangeError("legacyData.frame_max", obj.frame_max, 0);
  }

  // 验证 frames
  if (!Array.isArray(obj.frames)) {
    throw createTypeMismatchError("legacyData.frames", "array", getTypeDescription(obj.frames));
  }

  // 验证可选字段 se
  if ("se" in obj && obj.se !== undefined) {
    if (typeof obj.se !== "string" && (typeof obj.se !== "object" || obj.se === null)) {
      throw createTypeMismatchError("legacyData.se", "string | object", getTypeDescription(obj.se));
    }
  }

  // 验证可选字段 pitch
  if ("pitch" in obj && obj.pitch !== undefined) {
    if (typeof obj.pitch !== "object" || obj.pitch === null) {
      throw createTypeMismatchError("legacyData.pitch", "object", getTypeDescription(obj.pitch));
    }
  }
}

/**
 * 非抛出式验证 H5AnimateMeta
 *
 * @param meta - 待验证的元数据
 * @returns 验证结果
 */
export function validateH5AnimateMetaSafe(meta: unknown): ValidationResult {
  const errors: string[] = [];

  try {
    validateH5AnimateMeta(meta);
    return { valid: true, errors: [] };
  } catch (error) {
    if (error instanceof Error) {
      errors.push(error.message);
    }
    return { valid: false, errors };
  }
}

/**
 * 非抛出式验证 SpriteInfo
 *
 * @param spriteInfo - 待验证的精灵图信息
 * @returns 验证结果
 */
export function validateSpriteInfoSafe(spriteInfo: unknown): ValidationResult {
  const errors: string[] = [];

  try {
    validateSpriteInfo(spriteInfo);
    return { valid: true, errors: [] };
  } catch (error) {
    if (error instanceof Error) {
      errors.push(error.message);
    }
    return { valid: false, errors };
  }
}

/**
 * 验证编码输入的完整性
 *
 * @param meta - 元数据
 * @param spriteInfo - 精灵图信息
 * @param webpData - WebP 数据
 * @throws H5AnimateError 如果验证失败
 */
export function validateEncodeInputComplete(
  meta: unknown,
  spriteInfo: unknown,
  webpData: unknown,
): void {
  // 验证 meta
  validateH5AnimateMeta(meta);

  // 验证 spriteInfo
  validateSpriteInfo(spriteInfo);

  // 验证 webpData
  if (!Buffer.isBuffer(webpData)) {
    throw createValidationError("webpData 必须是 Buffer 类型");
  }

  if (webpData.length === 0) {
    throw createValidationError("webpData 不能为空");
  }
}
