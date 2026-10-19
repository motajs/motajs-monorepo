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

/** 1×1 透明 PNG 的 base64 常量，经解码后作为图片分类的演示字节 */
const DEMO_PNG_BASE64: string =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

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
 * 造一份 1×1 PNG 字节，作为图片分类的演示素材
 * @returns 解码后的 PNG 字节
 */
function createDemoPng(): Uint8Array {
  return decodeBase64(DEMO_PNG_BASE64);
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
 * 由代码合成一段最小 PCM WAV：44 字节 RIFF 头 + 0.1 秒 16 位静音采样，供音频分类的转码演示
 * @returns 可被音频解码器读取的 WAV 字节
 */
function createDemoWav(): Uint8Array {
  const sampleRate = 8000;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const sampleCount = 800;
  const dataSize = sampleCount * bytesPerSample;
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

  // 采样区默认即为全零（ArrayBuffer 零初始化），可直接表示静音
  return new Uint8Array(buffer);
}

/**
 * 造一份占位字体字节：仅让字体分类有一条可浏览的素材，并非真正的字体文件
 * @returns 占位字体字节
 */
function createDemoFont(): Uint8Array {
  return new Uint8Array([0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
}

/**
 * 造一份带系统前缀的列表文件文本，令列表文件与素材包期望的 `.jsonc` 前缀形态一致
 * @param document 列表正文值
 * @returns 系统前缀 + 格式化 JSON 正文
 */
function createListText(document: unknown): string {
  return `${SYSTEM_PREFIX_END_MARKER}\n${JSON.stringify(document, null, 2)}`;
}

/** 开发宿主要 seed 进内存后端的全部演示素材文件：四个分类的列表文件与示例字节（两张 1×1 PNG、一个合成 WAV、一个空 .anim、一个占位 .ttf） */
export const ASSET_DEMO_FILES: readonly IAssetDemoFile[] = [
  {
    path: 'content/texture/.list.jsonc',
    content: createListText({ textures: DEMO_TEXTURE_NAMES.map((source) => ({ source, read: 0, usage: 0 })) }),
  },
  { path: 'content/audio/.list.jsonc', content: createListText({ audios: [{ source: DEMO_AUDIO_NAME, type: 0 }] }) },
  { path: 'content/animation/.list.jsonc', content: createListText([DEMO_ANIMATION_NAME]) },
  { path: 'content/font/.list.jsonc', content: createListText([DEMO_FONT_NAME]) },
  { path: `content/texture/${DEMO_TEXTURE_NAMES[0]}`, content: createDemoPng() },
  { path: `content/texture/${DEMO_TEXTURE_NAMES[1]}`, content: createDemoPng() },
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
