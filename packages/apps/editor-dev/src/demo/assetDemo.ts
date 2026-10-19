import { message } from 'antd';
import { EditorCore } from '@motajs/editor-core';
import { createAssetPanelType, UNDO_BLOCKED_MESSAGE } from '@motajs/editor-impl/asset';
import {
  AssetCategoryKind,
  AssetListFormat,
  IAssetCategory,
  IAssetEditorCapabilities,
} from '@motajs/editor-impl/react';
import { SYSTEM_PREFIX_END_MARKER } from '@motajs/editor-impl/shared';
import DEMO_FONT_DATA_URL from '../../../editor/src/assets/FiraCode.ttf?inline';

// 开发宿主的素材演示数据与注册函数：给素材面板注入四个分类（图片 / 音频 / 动画 / 字体）与一批可浏览、
// 可编辑、可转码的示例文件，并在顶层把素材面板类型注册进 core、订阅「无法撤销」提示。本文件只服务开发
// 宿主、不进入产品路径，也不改动 editor-core / editor-impl 的任何契约；模块顶层不产生任何副作用。

/** 一个演示素材文件：要 seed 进内存后端的路径与内容 */
interface IAssetDemoFile {
  /** seed 的目标路径 */
  readonly path: string;
  /** seed 的内容：文本或原始字节 */
  readonly content: string | Uint8Array;
}

/** 一张演示图片的描述：名字、像素尺寸与调色板序号 */
interface IAssetDemoTextureSpec {
  /** 演示图片的素材名，如 `hero.png` */
  readonly name: string;
  /** 图片宽度（像素） */
  readonly width: number;
  /** 图片高度（像素） */
  readonly height: number;
  /** 调色板序号，决定棋盘格的两种颜色 */
  readonly palette: number;
}

/** 内置图片素材的数量：三四十张用来压测网格滚动与不同宽高比 */
export const DEMO_TEXTURE_COUNT = 36;

/** 内置图片素材的尺寸与配色：前两张沿用 hero / tile，其余覆盖多组长方形与正方形 */
export const DEMO_TEXTURE_SPECS: readonly IAssetDemoTextureSpec[] = Object.freeze([
  { name: 'hero.png', width: 16, height: 16, palette: 0 },
  { name: 'tile.png', width: 16, height: 16, palette: 1 },
  { name: 'tex-03.png', width: 64, height: 32, palette: 2 },
  { name: 'tex-04.png', width: 32, height: 64, palette: 3 },
  { name: 'tex-05.png', width: 48, height: 24, palette: 4 },
  { name: 'tex-06.png', width: 80, height: 40, palette: 5 },
  { name: 'tex-07.png', width: 96, height: 48, palette: 6 },
  { name: 'tex-08.png', width: 120, height: 40, palette: 7 },
  { name: 'tex-09.png', width: 160, height: 48, palette: 8 },
  { name: 'tex-10.png', width: 128, height: 64, palette: 9 },
  { name: 'tex-11.png', width: 144, height: 48, palette: 10 },
  { name: 'tex-12.png', width: 104, height: 52, palette: 11 },
  { name: 'tex-13.png', width: 60, height: 100, palette: 12 },
  { name: 'tex-14.png', width: 100, height: 60, palette: 13 },
  { name: 'tex-15.png', width: 32, height: 32, palette: 14 },
  { name: 'tex-16.png', width: 48, height: 48, palette: 15 },
  { name: 'tex-17.png', width: 64, height: 64, palette: 16 },
  { name: 'tex-18.png', width: 96, height: 96, palette: 17 },
  { name: 'tex-19.png', width: 160, height: 160, palette: 18 },
  { name: 'tex-20.png', width: 24, height: 48, palette: 19 },
  { name: 'tex-21.png', width: 40, height: 80, palette: 20 },
  { name: 'tex-22.png', width: 56, height: 112, palette: 21 },
  { name: 'tex-23.png', width: 72, height: 36, palette: 22 },
  { name: 'tex-24.png', width: 88, height: 44, palette: 23 },
  { name: 'tex-25.png', width: 112, height: 56, palette: 24 },
  { name: 'tex-26.png', width: 136, height: 68, palette: 25 },
  { name: 'tex-27.png', width: 152, height: 76, palette: 26 },
  { name: 'tex-28.png', width: 36, height: 72, palette: 27 },
  { name: 'tex-29.png', width: 44, height: 88, palette: 28 },
  { name: 'tex-30.png', width: 52, height: 104, palette: 29 },
  { name: 'tex-31.png', width: 68, height: 136, palette: 30 },
  { name: 'tex-32.png', width: 76, height: 152, palette: 31 },
  { name: 'tex-33.png', width: 20, height: 20, palette: 32 },
  { name: 'tex-34.png', width: 80, height: 60, palette: 33 },
  { name: 'tex-35.png', width: 60, height: 80, palette: 34 },
  { name: 'tex-36.png', width: 128, height: 32, palette: 35 },
]);

/** 演示图片分类的全部素材名（与列表文件登记的来源字段一致） */
const DEMO_TEXTURE_NAMES: readonly string[] = DEMO_TEXTURE_SPECS.map((spec) => spec.name);

/** 演示 WAV 的采样率（Hz） */
const DEMO_WAV_SAMPLE_RATE = 16000;

/** 演示 WAV 的采样数：16 kHz 下正好 0.4 秒 */
const DEMO_WAV_SAMPLE_COUNT = 6400;

/** 演示 WAV 的正弦波频率（Hz），取标准音 A4，浏览器里能听清 */
const DEMO_WAV_FREQUENCY = 440;

/** 演示 WAV 的振幅（相对满量程），留足余量避免削波 */
const DEMO_WAV_AMPLITUDE = 0.25;

/** 演示 WAV 首尾淡入淡出的时长（秒），避免起止处爆音 */
const DEMO_WAV_FADE_SECONDS = 0.02;

/** 16 位采样的满量程 */
const DEMO_WAV_FULL_SCALE = 32767;

/** 演示字体数据地址里 base64 正文之前的 `data:` 前缀分隔符 */
const DATA_URL_SEPARATOR = ',';

/** 演示音频分类的素材名 */
const DEMO_AUDIO_NAME: string = 'bgm.wav';

/** 演示动画分类的素材名（无扩展名，字节文件为 `sample.anim`） */
const DEMO_ANIMATION_NAME: string = 'sample';

/** 演示字体分类的素材名（字符串列表的分类名即完整文件名） */
const DEMO_FONT_NAME: string = 'sample.ttf';

/** PNG 每个像素的字节数：8 位 RGBA */
const PNG_BYTES_PER_PIXEL = 4;

/** PNG 位深：8 位 */
const PNG_BIT_DEPTH = 8;

/** PNG 颜色类型：真彩色带 alpha */
const PNG_COLOR_TYPE_RGBA = 6;

/** PNG 扫描行的滤波类型：不滤波 */
const PNG_FILTER_NONE = 0;

/** 棋盘格边长（像素）：像素按 8×8 的格子交替两种颜色 */
const PNG_CHECKER_SIZE = 8;

/** 完全不透明的 alpha 值 */
const PNG_ALPHA_OPAQUE = 255;

/** 单个 stored deflate 块能容纳的最大字节数 */
const DEFLATE_STORED_MAX = 65535;

/** zlib 头的压缩方法 / 标志字节：32K 窗口、无预置字典、最快压缩级 */
const ZLIB_HEADER = Object.freeze([0x78, 0x01]);

/** Adler-32 的模数 */
const ADLER_MODULUS = 65521;

/** CRC-32 的多项式（反射形式） */
const CRC_POLYNOMIAL = 0xedb88320;

/** CRC-32 的初值 / 终值掩码 */
const CRC_MASK = 0xffffffff;

/** 一个 32 位掩码的位宽 */
const BITS_PER_BYTE = 8;

/** 颜色通道的位移量：红 / 绿 / 蓝 */
const COLOR_SHIFT_RED = 16;
const COLOR_SHIFT_GREEN = 8;
const COLOR_SHIFT_BLUE = 0;

/** 调色板的通道取值范围（0–255） */
const COLOR_CHANNEL_MAX = 255;

/** 调色板每个通道的基础偏移，保证两种颜色都足够亮、肉眼可见 */
const PALETTE_CHANNEL_BASE = 32;

/** 调色板每个通道的步进，令相邻序号的颜色明显不同 */
const PALETTE_CHANNEL_SPAN = 96;

/** 两种棋盘色之间的通道差，令同一张图里的格子有对比 */
const PALETTE_VARIANT_SPAN = 64;

/** 开发宿主的四个素材分类：图片 / 音频为对象数组（listKey 分别为 textures / audios），动画 / 字体为字符串数组 */
export const ASSET_DEMO_CATEGORIES: readonly IAssetCategory[] = [
  {
    id: 'texture',
    label: '图片',
    kind: AssetCategoryKind.Image,
    dir: 'content/texture',
    listPath: 'content/texture/.list.jsonc',
    listFormat: AssetListFormat.ObjectList,
    listKey: 'textures',
    defaultsPath: 'content/defaults/texture.jsonc',
  },
  {
    id: 'audio',
    label: '音频',
    kind: AssetCategoryKind.Audio,
    dir: 'content/audio',
    listPath: 'content/audio/.list.jsonc',
    listFormat: AssetListFormat.ObjectList,
    listKey: 'audios',
    defaultsPath: 'content/defaults/audio.jsonc',
  },
  {
    id: 'animation',
    label: '动画',
    kind: AssetCategoryKind.Animation,
    dir: 'content/animation',
    listPath: 'content/animation/.list.jsonc',
    listFormat: AssetListFormat.StringList,
    extension: '.anim',
    defaultsPath: 'content/defaults/animation.jsonc',
  },
  {
    id: 'font',
    label: '字体',
    kind: AssetCategoryKind.Font,
    dir: 'content/font',
    listPath: 'content/font/.list.jsonc',
    listFormat: AssetListFormat.StringList,
    defaultsPath: 'content/defaults/font.jsonc',
  },
];

/**
 * 把 base64 文本解码成原始字节
 * @param text base64 文本
 * @returns 解码后的字节
 */
function decodeBase64(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);

  return bytes;
}

/**
 * 计算一段字节的 CRC-32 校验值（PNG 每个块尾部都要带）
 * @param bytes 参与校验的字节（块类型 + 块数据）
 * @returns 32 位无符号校验值
 */
function crc32(bytes: Uint8Array): number {
  let crc = CRC_MASK;

  for (let index = 0; index < bytes.length; index += 1) {
    crc ^= bytes[index];

    for (let bit = 0; bit < BITS_PER_BYTE; bit += 1) {
      const mask = -(crc & 1) & CRC_MASK;
      crc = (crc >>> 1) ^ (CRC_POLYNOMIAL & mask);
    }
  }

  return (crc ^ CRC_MASK) >>> 0;
}

/**
 * 计算一段字节的 Adler-32 校验值（zlib 流尾部要带）
 * @param bytes 参与校验的字节（未压缩扫描行数据）
 * @returns 32 位无符号校验值
 */
function adler32(bytes: Uint8Array): number {
  let low = 1;
  let high = 0;

  for (let index = 0; index < bytes.length; index += 1) {
    low = (low + bytes[index]) % ADLER_MODULUS;
    high = (high + low) % ADLER_MODULUS;
  }

  return ((high << 16) | low) >>> 0;
}

/**
 * 拼装一个 PNG 块：长度 + 类型 + 数据 + CRC
 * @param type 四个 ASCII 字符的块类型
 * @param data 块数据
 * @returns 完整的块字节
 */
function createPngChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);

  view.setUint32(0, data.length, false);

  for (let index = 0; index < type.length; index += 1) chunk[4 + index] = type.charCodeAt(index);

  chunk.set(data, 8);
  view.setUint32(8 + data.length, crc32(chunk.subarray(4, 8 + data.length)), false);

  return chunk;
}

/**
 * 把未压缩数据包成合法的 zlib 流：头 + 若干 stored deflate 块 + Adler-32
 * @param data 未压缩数据（PNG 扫描行）
 * @returns 合法的 zlib 流字节
 */
function createZlibStream(data: Uint8Array): Uint8Array {
  const blockCount = Math.max(1, Math.ceil(data.length / DEFLATE_STORED_MAX));
  const stream = new Uint8Array(2 + data.length + blockCount * 5 + 4);

  stream[0] = ZLIB_HEADER[0];
  stream[1] = ZLIB_HEADER[1];

  let offset = 2;

  for (let index = 0; index < blockCount; index += 1) {
    const start = index * DEFLATE_STORED_MAX;
    const length = Math.min(DEFLATE_STORED_MAX, data.length - start);
    const inverse = ~length & 0xffff;

    stream[offset] = index === blockCount - 1 ? 0x01 : 0x00;
    stream[offset + 1] = length & 0xff;
    stream[offset + 2] = (length >>> 8) & 0xff;
    stream[offset + 3] = inverse & 0xff;
    stream[offset + 4] = (inverse >>> 8) & 0xff;
    stream.set(data.subarray(start, start + length), offset + 5);
    offset += 5 + length;
  }

  const checksum = adler32(data);

  stream[offset] = (checksum >>> 24) & 0xff;
  stream[offset + 1] = (checksum >>> 16) & 0xff;
  stream[offset + 2] = (checksum >>> 8) & 0xff;
  stream[offset + 3] = checksum & 0xff;

  return stream;
}

/**
 * 由调色板序号与棋盘色变体算出一个 0xRRGGBB 颜色
 * @param palette 调色板序号
 * @param variant 变体：0 为底色、1 为棋盘亮色
 * @returns 打包成 24 位的 RGB 值
 */
function paletteColor(palette: number, variant: number): number {
  const red = PALETTE_CHANNEL_BASE + (palette * 37 + variant * PALETTE_VARIANT_SPAN) % PALETTE_CHANNEL_SPAN;
  const green = PALETTE_CHANNEL_BASE + (palette * 53 + variant * PALETTE_VARIANT_SPAN + 40) % PALETTE_CHANNEL_SPAN;
  const blue = PALETTE_CHANNEL_BASE + (palette * 71 + variant * PALETTE_VARIANT_SPAN + 80) % PALETTE_CHANNEL_SPAN;

  return (red << COLOR_SHIFT_RED) | (green << COLOR_SHIFT_GREEN) | (blue << COLOR_SHIFT_BLUE);
}

/**
 * 用 8 位 RGBA 与 8×8 棋盘格现场编码一张可被浏览器解码的 PNG
 * @param width 图片宽度（像素）
 * @param height 图片高度（像素）
 * @param palette 调色板序号，决定两种棋盘颜色
 * @returns 完整的 PNG 字节
 */
function encodePng(width: number, height: number, palette: number): Uint8Array {
  const header = new Uint8Array(13);
  const headerView = new DataView(header.buffer);

  headerView.setUint32(0, width, false);
  headerView.setUint32(4, height, false);
  header[8] = PNG_BIT_DEPTH;
  header[9] = PNG_COLOR_TYPE_RGBA;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  const baseColor = paletteColor(palette, 0);
  const checkerColor = paletteColor(palette, 1);
  const rowLength = width * PNG_BYTES_PER_PIXEL + 1;
  const pixels = new Uint8Array(rowLength * height);
  let offset = 0;

  for (let y = 0; y < height; y += 1) {
    pixels[offset] = PNG_FILTER_NONE;
    offset += 1;

    for (let x = 0; x < width; x += 1) {
      const checkerIndex = Math.floor(x / PNG_CHECKER_SIZE) + Math.floor(y / PNG_CHECKER_SIZE);
      const color = checkerIndex % 2 === 0 ? baseColor : checkerColor;

      pixels[offset] = (color >> COLOR_SHIFT_RED) & COLOR_CHANNEL_MAX;
      pixels[offset + 1] = (color >> COLOR_SHIFT_GREEN) & COLOR_CHANNEL_MAX;
      pixels[offset + 2] = (color >> COLOR_SHIFT_BLUE) & COLOR_CHANNEL_MAX;
      pixels[offset + 3] = PNG_ALPHA_OPAQUE;
      offset += PNG_BYTES_PER_PIXEL;
    }
  }

  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const chunks = [
    createPngChunk('IHDR', header),
    createPngChunk('IDAT', createZlibStream(pixels)),
    createPngChunk('IEND', new Uint8Array(0)),
  ];
  const totalLength = signature.length + chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const png = new Uint8Array(totalLength);
  let pngOffset = signature.length;

  png.set(signature, 0);

  for (const chunk of chunks) {
    png.set(chunk, pngOffset);
    pngOffset += chunk.length;
  }

  return png;
}

/**
 * 按描述现场生成一张演示 PNG
 * @param spec 演示图片的描述（名字 / 宽高 / 调色板）
 * @returns 解码后的 PNG 字节
 */
function createDemoPng(spec: IAssetDemoTextureSpec): Uint8Array {
  return encodePng(spec.width, spec.height, spec.palette);
}

/**
 * 往数据视图的指定偏移写入 ASCII 文本
 * @param view 数据视图
 * @param offset 起始偏移
 * @param text 要写入的 ASCII 文本
 */
function writeAscii(view: DataView, offset: number, text: string): void {
  for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index));
}

/**
 * 由代码合成一段 0.4 秒 440 Hz 正弦波 PCM WAV：44 字节 RIFF 头 + 16 位单声道采样，
 * 首尾各做短淡入淡出，供音频分类的播放与转码演示
 * @returns 可被音频解码器读取、且真的听得到声音的 WAV 字节
 */
function createDemoWav(): Uint8Array {
  const sampleRate = DEMO_WAV_SAMPLE_RATE;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const sampleCount = DEMO_WAV_SAMPLE_COUNT;
  const dataSize = sampleCount * bytesPerSample;
  const fadeSamples = sampleRate * DEMO_WAV_FADE_SECONDS;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, bitsPerSample, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  for (let index = 0; index < sampleCount; index += 1) {
    const envelope = Math.max(0, Math.min(1, index / fadeSamples, (sampleCount - 1 - index) / fadeSamples));
    const phase = (2 * Math.PI * DEMO_WAV_FREQUENCY * index) / sampleRate;
    const sample = Math.round(Math.sin(phase) * DEMO_WAV_AMPLITUDE * envelope * DEMO_WAV_FULL_SCALE);

    view.setInt16(44 + index * bytesPerSample, sample, true);
  }

  return new Uint8Array(buffer);
}

/**
 * 取工作区已有的 Fira Code 字体字节，作为字体分类的演示字体
 * @returns 从 `?inline` 数据地址里解码出的真实字体字节
 */
function createDemoFont(): Uint8Array {
  const separator = DEMO_FONT_DATA_URL.indexOf(DATA_URL_SEPARATOR);

  return decodeBase64(DEMO_FONT_DATA_URL.slice(separator + 1));
}

/**
 * 造一份带系统前缀的列表文件文本，令列表文件与素材包期望的 `.jsonc` 前缀形态一致
 * @param document 列表正文值
 * @returns 系统前缀 + 格式化 JSON 正文
 */
function createListText(document: unknown): string {
  return `${SYSTEM_PREFIX_END_MARKER}\n${JSON.stringify(document, null, 2)}`;
}

/** 开发宿主要 seed 进内存后端的全部演示素材文件：四个分类的列表文件与示例字节（36 张多尺寸彩色 PNG、一段有声音的 WAV、一个空 .anim、一份真实的 Fira Code 字体） */
export const ASSET_DEMO_FILES: readonly IAssetDemoFile[] = [
  {
    path: 'content/texture/.list.jsonc',
    content: createListText({
      textures: DEMO_TEXTURE_NAMES.map((source, index) => ({
        source,
        read: index % 5,
        usage: index % 3,
      })),
    }),
  },
  { path: 'content/audio/.list.jsonc', content: createListText({ audios: [{ source: DEMO_AUDIO_NAME, type: 0 }] }) },
  { path: 'content/animation/.list.jsonc', content: createListText([DEMO_ANIMATION_NAME]) },
  { path: 'content/font/.list.jsonc', content: createListText([DEMO_FONT_NAME]) },
  ...DEMO_TEXTURE_SPECS.map((spec) => ({ path: `content/texture/${spec.name}`, content: createDemoPng(spec) })),
  { path: `content/audio/${DEMO_AUDIO_NAME}`, content: createDemoWav() },
  { path: `content/animation/${DEMO_ANIMATION_NAME}.anim`, content: new Uint8Array(0) },
  { path: `content/font/${DEMO_FONT_NAME}`, content: createDemoFont() },
];

/**
 * 注册开发宿主的素材面板类型并订阅「无法撤销」提示
 * @param core 开发宿主的编辑器核心，经其外壳系统注册面板类型、经其撤销系统订阅屏障提示
 * @returns 注入给素材能力 Provider 的能力对象（分类清单）
 */
export function registerAssetDemo(core: EditorCore): IAssetEditorCapabilities {
  core.shellSystem.registerPanelType(createAssetPanelType({ categories: ASSET_DEMO_CATEGORIES }));
  core.undoSystem.addHook({
    onUndoBlocked: (): void => {
      message.error(UNDO_BLOCKED_MESSAGE);
    },
  });

  return { categories: ASSET_DEMO_CATEGORIES };
}
