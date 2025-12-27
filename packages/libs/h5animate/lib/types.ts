/**
 * H5Animate 格式的核心类型定义
 */

// ============ H5Animate 格式类型 ============

/**
 * H5Animate 格式的元信息结构
 */
export interface H5AnimateMeta {
  ratio: number;
  frame: H5AnimateFrame[];
}

/**
 * H5Animate 帧数据
 */
export interface H5AnimateFrame {
  sound?: SoundMeta[];
  objects?: H5AnimateObject[];
}

/**
 * 音效元数据
 */
export interface SoundMeta {
  name: string;
  volume?: number;
  pitch?: number;
}

/**
 * H5Animate 对象数据
 */
export interface H5AnimateObject {
  index: number;
  x: number;
  y: number;
  scale: number;
  opacity: number;
  mirror?: number;
  rotate?: number;
}

/**
 * 精灵图信息
 */
export interface SpriteInfo {
  count: number;
  dimensions: SpriteDimension[];
}

/**
 * 精灵图尺寸
 */
export interface SpriteDimension {
  width: number;
  height: number;
}

// ============ 旧格式类型 ============

/**
 * 旧格式的 .animate 文件结构
 */
export interface LegacyAnimateFile {
  ratio: number;
  se?: string | Record<number, string>;
  pitch?: Record<number, number>;
  bitmaps: string[];
  frame_max: number;
  frames: FrameLayer[][];
}

/**
 * 旧格式的帧图层数据
 * [index, x, y, scale, opacity, mirror?, rotate?]
 */
export type FrameLayer = [number, number, number, number, number, number?, number?];

// ============ 解码结果类型 ============

/**
 * 解码后的 H5Animate 数据
 */
export interface DecodedH5Animate {
  meta: H5AnimateMeta;
  spriteInfo: SpriteInfo;
  webpData: Buffer;
}

/**
 * 文件头结构
 */
export interface FileHeader {
  signature: string;
  version: number;
  imageDataSize: number;
  metaDataSize: number;
}

// ============ 转换结果类型 ============

/**
 * 图像转换结果
 */
export interface ImageConversionResult {
  webpData: Buffer;
  spriteInfo: SpriteInfo;
}
