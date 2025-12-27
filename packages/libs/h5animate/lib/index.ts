/**
 * H5Animate 编解码器
 *
 * 提供 h5animate 格式的编码、解码和从旧 .animate 格式的转换功能
 *
 * @packageDocumentation
 *
 * @example 基本使用
 * ```typescript
 * import { decode, encode, convert } from "@motajs/h5animate";
 *
 * // 解码 h5animate 文件
 * const animation = decode(buffer);
 *
 * // 编码为 h5animate 格式
 * const encoded = encode({ meta, spriteInfo, webpData });
 *
 * // 从旧格式转换
 * const converted = await convert(legacyData);
 * ```
 */

// ============ 用户友好 API（推荐使用）============

// 导出简化的 API 函数
export {
  decode,
  encode,
  convert,
  convertFromJson,
  parseLegacy,
  extractFrame,
  extractFrames,
} from "./api.js";

// 导出 API 相关类型
export type { EncodeOptions, ExtractFrameOptions } from "./api.js";

// ============ 类型定义 ============

// 导出核心类型定义
export type {
  H5AnimateMeta,
  H5AnimateFrame,
  SoundMeta,
  H5AnimateObject,
  SpriteInfo,
  SpriteDimension,
  LegacyAnimateFile,
  FrameLayer,
  DecodedH5Animate,
  FileHeader,
  ImageConversionResult,
} from "./types.js";

// ============ 错误处理 ============

// 导出错误类型和工厂函数
export {
  H5AnimateErrorCode,
  H5AnimateError,
  createInvalidSignatureError,
  createInvalidVersionError,
  createCorruptedHeaderError,
  createInvalidImageDataError,
  createInvalidMetadataError,
  createConversionFailedError,
  createWebPProcessingError,
  createValidationError,
  createTypeMismatchError,
  createMissingFieldError,
  createValueOutOfRangeError,
  createInvalidArrayLengthError,
  createFileTruncatedError,
  createSizeMismatchError,
  createJsonParseError,
  createBase64DecodeError,
  createImageMergeError,
  createFrameExtractionError,
  getErrorCodeDescription,
} from "./errors.js";

// ============ 底层 API（高级用法）============

// 导出二进制工具类
export { BinaryParser, BinaryWriter } from "./binary.js";

// 导出解码器函数
export {
  parseHeader,
  parseSpriteInfo,
  getSpriteInfoSize,
  convertArraysToObjects,
  decodeH5Animate,
} from "./decoder.js";

// 导出编码器函数
export {
  convertObjectToArray,
  convertObjectsToArrays,
  metaReplacer,
  validateEncodeInput,
  encodeH5Animate,
} from "./encoder.js";

// 导出 WebP 处理函数
export type { WebPOptions, ExtractFrameOptions as WebPExtractFrameOptions } from "./webp.js";
export {
  convertToWebP,
  createVerticalSpriteSheet,
  base64ToBuffer,
  combineBase64ImagesToWebP,
  extractFrameByIndex,
  extractFrameByPosition,
  extractAllFrames,
} from "./webp.js";

// 导出格式转换函数
export type { ConvertOptions } from "./converter.js";
export {
  validateLegacyFormat,
  parseLegacyAnimateFile,
  convertImages,
  convertSoundData,
  convertFrameLayer,
  convertMetadata,
  convertToH5Animate,
  convertFromJsonString,
} from "./converter.js";

// ============ 验证函数 ============

// 导出验证函数
export type { ValidationResult } from "./validation.js";
export {
  validateSoundMeta,
  validateH5AnimateObject,
  validateH5AnimateFrame,
  validateH5AnimateMeta,
  validateSpriteDimension,
  validateSpriteInfo,
  validateLegacyAnimateFile,
  validateH5AnimateMetaSafe,
  validateSpriteInfoSafe,
  validateEncodeInputComplete,
} from "./validation.js";
