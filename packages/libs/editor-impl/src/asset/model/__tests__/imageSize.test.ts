import { describe, expect, it } from 'vitest';
import { readImageDimensions } from '../imageSize';

/**
 * 造一段带 PNG 签名与 `IHDR` 块头的字节
 * @param width 宽（像素）
 * @param height 高（像素）
 * @returns 可被解析的最小 PNG 头
 */
function createPng(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(29);

  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0x00, 0x00, 0x00, 0x0d], 8);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);

  const view = new DataView(bytes.buffer);

  view.setUint32(16, width, false);
  view.setUint32(20, height, false);

  return bytes;
}

/**
 * 造一段最小 GIF 头
 * @param width 宽（像素）
 * @param height 高（像素）
 * @returns 可被解析的最小 GIF 头
 */
function createGif(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(10);

  bytes.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], 0);

  const view = new DataView(bytes.buffer);

  view.setUint16(6, width, true);
  view.setUint16(8, height, true);

  return bytes;
}

/**
 * 造一段最小 BMP 信息头
 * @param width 宽（像素）
 * @param height 高（像素，可为负表示自上而下）
 * @returns 可被解析的最小 BMP 头
 */
function createBmp(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(26);

  bytes.set([0x42, 0x4d], 0);

  const view = new DataView(bytes.buffer);

  view.setInt32(18, width, true);
  view.setInt32(22, height, true);

  return bytes;
}

/**
 * 造一段最小 JPEG 头：`SOI` + `SOF0` + 精度 + 高宽 + 组件占位
 * @param width 宽（像素）
 * @param height 高（像素）
 * @returns 可被解析的最小 JPEG 头
 */
function createJpeg(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(21);

  bytes.set([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08], 0);

  const view = new DataView(bytes.buffer);

  view.setUint16(7, height, false);
  view.setUint16(9, width, false);

  return bytes;
}

/**
 * 造一段 RIFF / WEBP 容器头
 * @param fourCC 变体标识的四个字节
 * @param payloadSize 载荷长度
 * @returns 30 字节的容器头
 */
function createWebpHeader(fourCC: readonly number[], payloadSize: number): Uint8Array {
  const bytes = new Uint8Array(30);

  bytes.set([0x52, 0x49, 0x46, 0x46], 0);
  bytes.set([0x57, 0x45, 0x42, 0x50], 8);
  bytes.set(fourCC, 12);

  const view = new DataView(bytes.buffer);

  view.setUint32(16, payloadSize, true);

  return bytes;
}

/**
 * 写入 3 字节小端无符号整数
 * @param view 字节视图
 * @param offset 写入起点
 * @param value 要写入的值
 */
function writeUint24LE(view: DataView, offset: number, value: number): void {
  view.setUint8(offset, value & 0xff);
  view.setUint8(offset + 1, (value >>> 8) & 0xff);
  view.setUint8(offset + 2, (value >>> 16) & 0xff);
}

/**
 * 造一段 `VP8X` 变体的 WebP 头
 * @param width 宽（像素）
 * @param height 高（像素）
 * @returns 可被解析的 WebP 头
 */
function createWebpVp8x(width: number, height: number): Uint8Array {
  const bytes = createWebpHeader([0x56, 0x50, 0x38, 0x58], 10);
  const view = new DataView(bytes.buffer);

  bytes[20] = 0x10;
  writeUint24LE(view, 24, width - 1);
  writeUint24LE(view, 27, height - 1);

  return bytes;
}

/**
 * 造一段 `VP8L` 变体的 WebP 头
 * @param width 宽（像素）
 * @param height 高（像素）
 * @returns 可被解析的 WebP 头
 */
function createWebpVp8l(width: number, height: number): Uint8Array {
  const bytes = createWebpHeader([0x56, 0x50, 0x38, 0x4c], 5);
  const view = new DataView(bytes.buffer);

  bytes[20] = 0x2f;
  view.setUint32(21, (width - 1) | ((height - 1) << 14), true);

  return bytes;
}

/**
 * 造一段 `VP8 ` 变体的 WebP 头
 * @param width 宽（像素）
 * @param height 高（像素）
 * @returns 可被解析的 WebP 头
 */
function createWebpVp8(width: number, height: number): Uint8Array {
  const bytes = createWebpHeader([0x56, 0x50, 0x38, 0x20], 10);
  const view = new DataView(bytes.buffer);

  bytes.set([0x9d, 0x01, 0x2a], 23);
  view.setUint16(26, width, true);
  view.setUint16(28, height, true);

  return bytes;
}

describe('readImageDimensions', () => {
  // PNG：宽度在 IHDR 块偏移 16、高度在偏移 20，均为大端
  it('读取 PNG 的宽高', () => {
    expect(readImageDimensions(createPng(192, 128))).toEqual({ width: 192, height: 128 });
  });

  // GIF：逻辑屏幕描述符里是两段小端 uint16
  it('读取 GIF 的宽高', () => {
    expect(readImageDimensions(createGif(64, 32))).toEqual({ width: 64, height: 32 });
  });

  // BMP：信息头里的宽高是 int32，负高度表示自上而下，取绝对值
  it('读取 BMP 的宽高并把负高度转成正数', () => {
    expect(readImageDimensions(createBmp(40, 20))).toEqual({ width: 40, height: 20 });
    expect(readImageDimensions(createBmp(40, -20))).toEqual({ width: 40, height: 20 });
  });

  // JPEG：一直跳到 SOF0，再从段内读出高与宽（大端 uint16）
  it('读取 JPEG 的宽高', () => {
    expect(readImageDimensions(createJpeg(320, 240))).toEqual({ width: 320, height: 240 });
  });

  // WebP VP8X：3 字节小端的「宽高减一」
  it('读取 WebP VP8X 变体的宽高', () => {
    expect(readImageDimensions(createWebpVp8x(192, 128))).toEqual({ width: 192, height: 128 });
  });

  // WebP VP8L：一个 32 位小端位段里各取 14 位「宽高减一」
  it('读取 WebP VP8L 变体的宽高', () => {
    expect(readImageDimensions(createWebpVp8l(192, 128))).toEqual({ width: 192, height: 128 });
  });

  // WebP VP8：帧起始码之后是两段低 14 位有效的宽高
  it('读取 WebP VP8 变体的宽高', () => {
    expect(readImageDimensions(createWebpVp8(192, 128))).toEqual({ width: 192, height: 128 });
  });

  // 未知格式（含 SVG）一律返回 undefined
  it('未知格式返回 undefined', () => {
    expect(readImageDimensions(new Uint8Array([1, 2, 3, 4]))).toBeUndefined();
    expect(readImageDimensions(new TextEncoder().encode('<svg width="10" height="20"></svg>'))).toBeUndefined();
  });

  // 字节被截断时返回 undefined，不抛错
  it('截断字节返回 undefined', () => {
    expect(readImageDimensions(createPng(192, 128).slice(0, 20))).toBeUndefined();
    expect(readImageDimensions(createJpeg(320, 240).slice(0, 6))).toBeUndefined();
  });

  // 宽或高为 0 时视为非法尺寸
  it('宽或高为 0 返回 undefined', () => {
    expect(readImageDimensions(createPng(0, 128))).toBeUndefined();
    expect(readImageDimensions(createGif(64, 0))).toBeUndefined();
  });

  // 声明超大尺寸时拒绝，不据此分配任何内存
  it('超大尺寸返回 undefined', () => {
    expect(readImageDimensions(createPng(2000000, 128))).toBeUndefined();
    expect(readImageDimensions(createBmp(128, 2000000))).toBeUndefined();
  });
});
