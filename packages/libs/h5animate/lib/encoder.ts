/**
 * H5Animate 编码器
 *
 * 提供 h5animate 格式的编码功能
 */

import { BinaryWriter } from "./binary.js";
import { createValidationError } from "./errors.js";
import type {
  H5AnimateMeta,
  H5AnimateFrame,
  H5AnimateObject,
  SpriteInfo,
} from "./types.js";

/** 文件签名常量 */
const FILE_SIGNATURE = "ANIM";

/** 当前版本号 */
const CURRENT_VERSION = 1;

/**
 * 将 H5AnimateObject 转换为数组格式
 *
 * 内存中使用对象格式以提供更好的类型安全性和可读性
 * 文件中存储数组格式 [index, x, y, scale, opacity, mirror, rotate] 以节省空间
 *
 * @param obj - H5AnimateObject 对象
 * @returns 数组格式的数据
 */
export function convertObjectToArray(obj: H5AnimateObject): number[] {
  return [
    obj.index,
    obj.x,
    obj.y,
    obj.scale,
    obj.opacity,
    obj.mirror ?? 0,
    obj.rotate ?? 0,
  ];
}

/**
 * JSON.stringify 的 replacer 函数
 *
 * 将 H5AnimateObject 数组转换为数组格式以节省存储空间
 *
 * @param key - JSON 键名
 * @param value - JSON 值
 * @returns 转换后的值
 */
export function metaReplacer(key: string, value: unknown): unknown {
  if (key === "objects" && Array.isArray(value)) {
    return (value as H5AnimateObject[]).map(convertObjectToArray);
  }
  return value;
}

/**
 * 将元数据中的对象格式转换为数组格式
 *
 * @param meta - H5AnimateMeta 元数据
 * @returns 转换后的原始元数据（objects 为数组格式）
 */
export function convertObjectsToArrays(meta: H5AnimateMeta): {
  ratio: number;
  frame: Array<{
    sound?: Array<{ name: string; volume?: number; pitch?: number }>;
    objects?: number[][];
  }>;
} {
  return {
    ratio: meta.ratio,
    frame: meta.frame.map((frame: H5AnimateFrame) => ({
      sound: frame.sound,
      objects: frame.objects?.map(convertObjectToArray),
    })),
  };
}

/**
 * 计算精灵图信息占用的字节数
 *
 * @param spriteInfo - 精灵图信息
 * @returns 字节数
 */
export function getSpriteInfoSize(spriteInfo: SpriteInfo): number {
  // 4 字节用于 count + 每个精灵图 8 字节 (width + height)
  return 4 + spriteInfo.count * 8;
}

/**
 * 验证编码输入数据
 *
 * @param meta - 元数据
 * @param spriteInfo - 精灵图信息
 * @param webpData - WebP 数据
 * @throws H5AnimateError 如果输入数据无效
 */
export function validateEncodeInput(
  meta: H5AnimateMeta,
  spriteInfo: SpriteInfo,
  webpData: Buffer,
): void {
  const missingFields: string[] = [];

  if (meta === null || meta === undefined) {
    missingFields.push("meta");
  } else {
    if (typeof meta.ratio !== "number") {
      missingFields.push("meta.ratio");
    }
    if (!Array.isArray(meta.frame)) {
      missingFields.push("meta.frame");
    }
  }

  if (spriteInfo === null || spriteInfo === undefined) {
    missingFields.push("spriteInfo");
  } else {
    if (typeof spriteInfo.count !== "number") {
      missingFields.push("spriteInfo.count");
    }
    if (!Array.isArray(spriteInfo.dimensions)) {
      missingFields.push("spriteInfo.dimensions");
    }
  }

  if (!Buffer.isBuffer(webpData)) {
    missingFields.push("webpData");
  }

  if (missingFields.length > 0) {
    throw createValidationError("输入数据缺少必需字段", missingFields);
  }
}

/**
 * 编码为 h5animate 格式
 *
 * 将动画元数据、精灵图信息和 WebP 数据编码为 h5animate 二进制格式
 *
 * @param meta - H5Animate 元数据
 * @param spriteInfo - 精灵图信息
 * @param webpData - WebP 图像数据
 * @returns 编码后的二进制数据
 * @throws H5AnimateError 如果输入数据无效
 */
export function encodeH5Animate(
  meta: H5AnimateMeta,
  spriteInfo: SpriteInfo,
  webpData: Buffer,
): Buffer {
  // 验证输入
  validateEncodeInput(meta, spriteInfo, webpData);

  // 序列化元数据，使用 replacer 将对象转换为数组格式
  const metaJson = JSON.stringify(meta, metaReplacer);
  const metaBuffer = Buffer.from(metaJson, "utf8");

  // 计算精灵图信息大小
  const spriteInfoSize = getSpriteInfoSize(spriteInfo);
  const totalImageDataSize = spriteInfoSize + webpData.length;

  // 计算总大小: 文件头 (16 字节) + 图像数据 + 元数据
  const headerSize = 16; // 4 (签名) + 4 (版本) + 4 (图像数据大小) + 4 (元数据大小)
  const totalSize = headerSize + totalImageDataSize + metaBuffer.length;

  const writer = new BinaryWriter(totalSize);

  // 写入文件头
  writer.writeString(FILE_SIGNATURE);
  writer.writeUInt32LE(CURRENT_VERSION);
  writer.writeUInt32LE(totalImageDataSize);
  writer.writeUInt32LE(metaBuffer.length);

  // 写入精灵图信息
  writer.writeUInt32LE(spriteInfo.count);
  for (const dimension of spriteInfo.dimensions) {
    writer.writeUInt32LE(dimension.width);
    writer.writeUInt32LE(dimension.height);
  }

  // 写入 WebP 数据
  writer.writeBuffer(webpData);

  // 写入元数据
  writer.writeBuffer(metaBuffer);

  return writer.getBuffer();
}
