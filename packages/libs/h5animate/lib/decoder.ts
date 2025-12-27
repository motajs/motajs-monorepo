/**
 * H5Animate 解码器
 *
 * 提供 h5animate 格式的解码功能
 */

import { BinaryParser } from "./binary.js";
import {
  createInvalidSignatureError,
  createInvalidMetadataError,
} from "./errors.js";
import type {
  FileHeader,
  SpriteInfo,
  H5AnimateMeta,
  H5AnimateFrame,
  H5AnimateObject,
  DecodedH5Animate,
} from "./types.js";

/** 文件签名常量 */
const FILE_SIGNATURE = "ANIM";

/**
 * 解析文件头
 *
 * 验证 "ANIM" 标识符并提取版本号和数据大小信息
 *
 * @param parser - 二进制解析器
 * @returns 文件头信息
 * @throws H5AnimateError 如果签名无效
 */
export function parseHeader(parser: BinaryParser): FileHeader {
  const signature = parser.readString(4);
  if (signature !== FILE_SIGNATURE) {
    throw createInvalidSignatureError(signature);
  }

  const version = parser.readUInt32LE();
  const imageDataSize = parser.readUInt32LE();
  const metaDataSize = parser.readUInt32LE();

  return {
    signature,
    version,
    imageDataSize,
    metaDataSize,
  };
}

/**
 * 解析精灵图信息
 *
 * 解析精灵图数量和尺寸信息
 *
 * @param parser - 二进制解析器
 * @returns 精灵图信息
 */
export function parseSpriteInfo(parser: BinaryParser): SpriteInfo {
  const count = parser.readUInt32LE();
  const dimensions: Array<{ width: number; height: number }> = [];

  for (let i = 0; i < count; i++) {
    dimensions.push({
      width: parser.readUInt32LE(),
      height: parser.readUInt32LE(),
    });
  }

  return { count, dimensions };
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
 * 将数组格式的对象数据转换为对象格式
 *
 * 文件中存储的是数组格式 [index, x, y, scale, opacity, mirror, rotate]
 * 转换为内存中的对象格式以提供更好的类型安全性和可读性
 *
 * @param objArray - 数组格式的对象数据
 * @returns 对象格式的数据
 */
function convertArrayToObject(objArray: number[]): H5AnimateObject {
  return {
    index: objArray[0],
    x: objArray[1],
    y: objArray[2],
    scale: objArray[3],
    opacity: objArray[4],
    mirror: objArray[5] ?? 0,
    rotate: objArray[6] ?? 0,
  };
}

/**
 * 将原始元数据中的数组格式转换为对象格式
 *
 * @param rawMeta - 原始元数据（包含数组格式的 objects）
 * @returns 转换后的元数据（包含对象格式的 objects）
 */
export function convertArraysToObjects(rawMeta: {
  ratio: number;
  frame: Array<{
    sound?: Array<{ name: string; volume?: number; pitch?: number }>;
    objects?: number[][];
  }>;
}): H5AnimateMeta {
  if (!rawMeta.frame) {
    return rawMeta as H5AnimateMeta;
  }

  return {
    ratio: rawMeta.ratio,
    frame: rawMeta.frame.map((frame): H5AnimateFrame => ({
      sound: frame.sound,
      objects: frame.objects?.map(convertArrayToObject),
    })),
  };
}

/**
 * 解码 h5animate 文件
 *
 * 整合文件头、精灵图信息和元数据解析，返回完整的解码结果
 *
 * @param buffer - h5animate 文件的二进制数据
 * @returns 解码后的数据，包含元信息、精灵图信息和 WebP 数据
 * @throws H5AnimateError 如果文件格式无效或数据损坏
 */
export function decodeH5Animate(buffer: Buffer): DecodedH5Animate {
  const parser = new BinaryParser(buffer);

  // 解析文件头
  const header = parseHeader(parser);

  // 解析精灵图信息
  const spriteInfo = parseSpriteInfo(parser);

  // 计算剩余的图像数据大小（总图像数据大小 - 精灵图信息大小）
  const spriteInfoSize = getSpriteInfoSize(spriteInfo);
  const webpDataSize = header.imageDataSize - spriteInfoSize;

  // 提取 WebP 数据
  const webpData = parser.readBytes(webpDataSize);

  // 提取并解析元信息
  const metaBuffer = parser.readBytes(header.metaDataSize);
  const metaJson = metaBuffer.toString("utf8");

  let rawMeta: {
    ratio: number;
    frame: Array<{
      sound?: Array<{ name: string; volume?: number; pitch?: number }>;
      objects?: number[][];
    }>;
  };

  try {
    rawMeta = JSON.parse(metaJson);
  } catch {
    throw createInvalidMetadataError("JSON 解析失败");
  }

  // 将数组格式的对象数据转换为对象格式
  const meta = convertArraysToObjects(rawMeta);

  return { meta, spriteInfo, webpData };
}
