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

/** hero.png 的 base64：16×16 彩色棋盘 RGBA PNG，用作看得见的演示图片 */
const DEMO_HERO_PNG_BASE64: string =
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAALElEQVR4nGO4/erff2QsVv4fBROSZxgGBpCqAV1+OBgw8LEw8AYMfCwMuAEApzsmrhAADF0AAAAASUVORK5CYII=';

/** tile.png 的 base64：另一张 16×16 彩色棋盘，内容与 hero 不同，便于分辨 */
const DEMO_TILE_PNG_BASE64: string =
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAK0lEQVR4nGP4/+nFfxRc5YqKCcgzDAcDSNSALj8sDBj4WBh4AwY+FgbaAADMEUqucDL8wQAAAABJRU5ErkJggg==';

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

/** 演示图片分类的两个素材名（与列表文件登记的来源字段一致） */
const DEMO_TEXTURE_NAMES: readonly string[] = ['hero.png', 'tile.png'];

/** 演示音频分类的素材名 */
const DEMO_AUDIO_NAME: string = 'bgm.wav';

/** 演示动画分类的素材名（无扩展名，字节文件为 `sample.anim`） */
const DEMO_ANIMATION_NAME: string = 'sample';

/** 演示字体分类的素材名（字符串列表的分类名即完整文件名） */
const DEMO_FONT_NAME: string = 'sample.ttf';

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
 * 造一份 16×16 彩色棋盘 PNG 字节，作为图片分类的演示素材
 * @param name 演示图片的素材名
 * @returns 解码后的 PNG 字节（两张演示图内容不同）
 */
function createDemoPng(name: string): Uint8Array {
  return decodeBase64(name === DEMO_TEXTURE_NAMES[1] ? DEMO_TILE_PNG_BASE64 : DEMO_HERO_PNG_BASE64);
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

/** 开发宿主要 seed 进内存后端的全部演示素材文件：四个分类的列表文件与示例字节（两张 16×16 彩色 PNG、一段有声音的 WAV、一个空 .anim、一份真实的 Fira Code 字体） */
export const ASSET_DEMO_FILES: readonly IAssetDemoFile[] = [
  {
    path: 'content/texture/.list.jsonc',
    content: createListText({ textures: DEMO_TEXTURE_NAMES.map((source) => ({ source, read: 0, usage: 0 })) }),
  },
  { path: 'content/audio/.list.jsonc', content: createListText({ audios: [{ source: DEMO_AUDIO_NAME, type: 0 }] }) },
  { path: 'content/animation/.list.jsonc', content: createListText([DEMO_ANIMATION_NAME]) },
  { path: 'content/font/.list.jsonc', content: createListText([DEMO_FONT_NAME]) },
  { path: `content/texture/${DEMO_TEXTURE_NAMES[0]}`, content: createDemoPng(DEMO_TEXTURE_NAMES[0]) },
  { path: `content/texture/${DEMO_TEXTURE_NAMES[1]}`, content: createDemoPng(DEMO_TEXTURE_NAMES[1]) },
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
