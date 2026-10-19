/** 单个维度允许的最大像素值，超过即视为伪造或损坏的头 */
const MAX_IMAGE_DIMENSION = 1000000;

/** PNG 的 8 字节文件签名 */
const PNG_SIGNATURE: readonly number[] = Object.freeze([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** WebP `VP8 ` 变体里的帧起始码 */
const WEBP_VP8_START_CODE: readonly number[] = Object.freeze([0x9d, 0x01, 0x2a]);

/** JPEG 里携带图像尺寸的帧开始标记（SOF0/1/2/3/5/6/7/9/10/11/13/14/15） */
const JPEG_FRAME_MARKERS: readonly number[] = Object.freeze([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

export interface IAssetImageDimensions {
  /** 图片宽度（像素） */
  readonly width: number;
  /** 图片高度（像素） */
  readonly height: number;
}

/**
 * 比较一段字节与给定的字节序列是否相同
 * @param bytes 待检查的字节
 * @param offset 比较起点
 * @param expected 期望的字节序列
 * @returns 起止范围有效且逐字节相同时为 true
 */
function matchesBytes(bytes: Uint8Array, offset: number, expected: readonly number[]): boolean {
  if (offset < 0 || offset + expected.length > bytes.length) return false;

  for (let index = 0; index < expected.length; index += 1) {
    if (bytes[offset + index] !== expected[index]) return false;
  }

  return true;
}

/**
 * 比较一段字节与给定的 ASCII 文本是否相同
 * @param bytes 待检查的字节
 * @param offset 比较起点
 * @param text 期望的 ASCII 文本
 * @returns 起止范围有效且逐字符相同时为 true
 */
function matchesText(bytes: Uint8Array, offset: number, text: string): boolean {
  if (offset < 0 || offset + text.length > bytes.length) return false;

  for (let index = 0; index < text.length; index += 1) {
    if (bytes[offset + index] !== text.charCodeAt(index)) return false;
  }

  return true;
}

/**
 * 读取 3 字节小端无符号整数
 * @param view 字节视图
 * @param offset 读取起点
 * @returns 读出的整数
 */
function readUint24LE(view: DataView, offset: number): number {
  return view.getUint8(offset) | (view.getUint8(offset + 1) << 8) | (view.getUint8(offset + 2) << 16);
}

/**
 * 判断一个尺寸值是否可接受
 * @param value 待检查的尺寸
 * @returns 有限、为正且不超过上限的整数时为 true
 */
function isValidDimension(value: number): boolean {
  return Number.isInteger(value) && value > 0 && value <= MAX_IMAGE_DIMENSION;
}

/**
 * 把宽高校验成解析结果
 * @param width 候选宽度
 * @param height 候选高度
 * @returns 合法时返回尺寸对象，否则为 undefined
 */
function validSize(width: number, height: number): IAssetImageDimensions | undefined {
  if (!isValidDimension(width) || !isValidDimension(height)) return undefined;

  return { width, height };
}

/**
 * 判断 JPEG 标记是否为携带尺寸的帧开始段
 * @param marker 标记字节（已去掉 `0xFF` 前缀）
 * @returns 是帧开始标记时为 true
 */
function isJpegFrameMarker(marker: number): boolean {
  return JPEG_FRAME_MARKERS.includes(marker);
}

/**
 * 从 PNG 的 `IHDR` 块读出宽高
 * @param view 字节视图
 * @param bytes 原始字节
 * @returns 尺寸；签名后的块类型不是 `IHDR` 或字节不足时为 undefined
 */
function readPngDimensions(view: DataView, bytes: Uint8Array): IAssetImageDimensions | undefined {
  if (view.byteLength < 24 || !matchesText(bytes, 12, 'IHDR')) return undefined;

  return validSize(view.getUint32(16, false), view.getUint32(20, false));
}

/**
 * 从 GIF 的逻辑屏幕描述符读出宽高
 * @param view 字节视图
 * @returns 尺寸；字节不足时为 undefined
 */
function readGifDimensions(view: DataView): IAssetImageDimensions | undefined {
  if (view.byteLength < 10) return undefined;

  return validSize(view.getUint16(6, true), view.getUint16(8, true));
}

/**
 * 扫描 JPEG 段直到帧开始段，读出宽高
 *
 * 只按段长度向后跳，遇到无长度的标记（`D8` / `D9` / `01` / `D0`–`D7`）与 `FF` 填充字节直接跳过；
 * 段长度小于 2 或越过字节末尾即判定为损坏。
 * @param view 字节视图
 * @param bytes 原始字节
 * @returns 尺寸；找不到帧开始段或字节损坏时为 undefined
 */
function readJpegDimensions(view: DataView, bytes: Uint8Array): IAssetImageDimensions | undefined {
  const length = view.byteLength;
  let offset = 2;

  while (offset + 1 < length) {
    if (bytes[offset] !== 0xff) return undefined;

    let markerOffset = offset + 1;
    while (markerOffset < length && bytes[markerOffset] === 0xff) markerOffset += 1;
    if (markerOffset >= length) return undefined;

    const marker = bytes[markerOffset];

    if (marker === 0xd9) return undefined;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset = markerOffset + 1;
      continue;
    }

    if (markerOffset + 2 >= length) return undefined;

    const segmentLength = view.getUint16(markerOffset + 1, false);
    if (segmentLength < 2) return undefined;

    if (isJpegFrameMarker(marker)) {
      if (markerOffset + 8 > length) return undefined;

      return validSize(view.getUint16(markerOffset + 6, false), view.getUint16(markerOffset + 4, false));
    }

    const next = markerOffset + 1 + segmentLength;
    if (next > length) return undefined;

    offset = next;
  }

  return undefined;
}

/**
 * 从 BMP 的信息头读出宽高
 * @param view 字节视图
 * @returns 尺寸；字节不足或宽高非法时为 undefined
 */
function readBmpDimensions(view: DataView): IAssetImageDimensions | undefined {
  if (view.byteLength < 26) return undefined;

  return validSize(view.getInt32(18, true), Math.abs(view.getInt32(22, true)));
}

/**
 * 从 WebP 的三种变体（`VP8X` / `VP8L` / `VP8 `）读出宽高
 * @param view 字节视图
 * @param bytes 原始字节
 * @returns 尺寸；变体未知或字节不足时为 undefined
 */
function readWebpDimensions(view: DataView, bytes: Uint8Array): IAssetImageDimensions | undefined {
  if (view.byteLength < 30) return undefined;

  if (matchesText(bytes, 12, 'VP8X')) {
    return validSize(readUint24LE(view, 24) + 1, readUint24LE(view, 27) + 1);
  }

  if (matchesText(bytes, 12, 'VP8L')) {
    if (bytes[20] !== 0x2f) return undefined;

    const bits = view.getUint32(21, true);

    return validSize((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
  }

  if (matchesText(bytes, 12, 'VP8 ')) {
    if (!matchesBytes(bytes, 23, WEBP_VP8_START_CODE)) return undefined;

    return validSize(view.getUint16(26, true) & 0x3fff, view.getUint16(28, true) & 0x3fff);
  }

  return undefined;
}

/**
 * 从图片字节头读出像素宽高
 *
 * 纯字节解析：只用 `DataView` 读取头部固定偏移，不创建 `Blob` / 图片对象，也不按声明尺寸分配像素数组。
 * 支持 PNG / GIF / JPEG / BMP / WebP；字节不足、格式不支持或尺寸非法时一律返回 undefined，不抛错。
 * @param bytes 图片字节
 * @returns 解析出的宽高；无法解析时为 undefined
 */
export function readImageDimensions(bytes: Uint8Array): IAssetImageDimensions | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (matchesBytes(bytes, 0, PNG_SIGNATURE)) return readPngDimensions(view, bytes);
  if (matchesText(bytes, 0, 'GIF87a') || matchesText(bytes, 0, 'GIF89a')) return readGifDimensions(view);
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) return readJpegDimensions(view, bytes);
  if (matchesText(bytes, 0, 'BM')) return readBmpDimensions(view);
  if (matchesText(bytes, 0, 'RIFF') && matchesText(bytes, 8, 'WEBP')) return readWebpDimensions(view, bytes);

  return undefined;
}
