import { describe, expect, it } from 'vitest';
import { AssetCategoryKind, AssetListFormat, IAssetCategory } from '../../../react';
import {
  ASSET_ANIMATION_FILE_EXTENSIONS,
  ASSET_AUDIO_FILE_EXTENSIONS,
  ASSET_FONT_FILE_EXTENSIONS,
  ASSET_IMAGE_FILE_EXTENSIONS,
  ASSET_UNSUPPORTED_EXTENSION_PREFIX,
  isAssetFileAccepted,
  resolveAssetFileExtensions,
  resolveKindFileExtensions,
  unsupportedAssetExtensionMessage,
} from '../internal/assetFileTypes';

// 后缀白名单的单测：四类默认表、分类自带 extension 的优先级、大小写与无后缀的处理、拒绝文案。
// 白名单是面板内置默认值，不属于公开契约，因此从无桶的 `model/internal/` 直接 import。

/** 没有自带扩展名的图片分类：按大分类取内置清单 */
const IMAGE_CATEGORY: IAssetCategory = {
  id: 'texture',
  label: '图片',
  kind: AssetCategoryKind.Image,
  dir: 'content/texture',
  listPath: 'content/texture/.list.jsonc',
  listFormat: AssetListFormat.ObjectList,
  listKey: 'textures',
};

/** 自带 `.anim` 的动画分类：extension 优先，只认这一种 */
const ANIMATION_CATEGORY: IAssetCategory = {
  id: 'animation',
  label: '动画',
  kind: AssetCategoryKind.Animation,
  dir: 'content/animation',
  listPath: 'content/animation/.list.jsonc',
  listFormat: AssetListFormat.StringList,
  extension: '.anim',
};

/** 没有自带扩展名的字体分类 */
const FONT_CATEGORY: IAssetCategory = {
  id: 'font',
  label: '字体',
  kind: AssetCategoryKind.Font,
  dir: 'content/font',
  listPath: 'content/font/.list.jsonc',
  listFormat: AssetListFormat.StringList,
};

describe('素材后缀白名单', () => {
  // 四类内置清单逐项钉住：图片 6 项、音频 8 项、动画 .anim、字体 4 项
  it('四类默认后缀表与约定逐项一致', () => {
    expect(ASSET_IMAGE_FILE_EXTENSIONS).toEqual(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp']);
    expect(ASSET_AUDIO_FILE_EXTENSIONS).toEqual(['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac', '.opus', '.webm']);
    expect(ASSET_ANIMATION_FILE_EXTENSIONS).toEqual(['.anim']);
    expect(ASSET_FONT_FILE_EXTENSIONS).toEqual(['.ttf', '.otf', '.woff', '.woff2']);
  });

  // resolveKindFileExtensions 只看大分类，返回同一份内置清单
  it('按大分类取内置清单', () => {
    expect(resolveKindFileExtensions(AssetCategoryKind.Image)).toEqual(ASSET_IMAGE_FILE_EXTENSIONS);
    expect(resolveKindFileExtensions(AssetCategoryKind.Audio)).toEqual(ASSET_AUDIO_FILE_EXTENSIONS);
    expect(resolveKindFileExtensions(AssetCategoryKind.Animation)).toEqual(ASSET_ANIMATION_FILE_EXTENSIONS);
    expect(resolveKindFileExtensions(AssetCategoryKind.Font)).toEqual(ASSET_FONT_FILE_EXTENSIONS);
  });

  // 分类自带 extension 时只返回它一个，不是「再加一个」
  it('分类自带 extension 时只认它', () => {
    expect(resolveAssetFileExtensions(ANIMATION_CATEGORY)).toEqual(['.anim']);
    expect(isAssetFileAccepted(ANIMATION_CATEGORY, 'foo.anim')).toBe(true);
    expect(isAssetFileAccepted(ANIMATION_CATEGORY, 'foo.png')).toBe(false);
  });

  // 没有 extension 的分类按大分类取清单
  it('没有 extension 时按大分类取清单', () => {
    expect(resolveAssetFileExtensions(IMAGE_CATEGORY)).toEqual(ASSET_IMAGE_FILE_EXTENSIONS);
    expect(resolveAssetFileExtensions(FONT_CATEGORY)).toEqual(ASSET_FONT_FILE_EXTENSIONS);
  });

  // 后缀比较大小写不敏感：`.PNG` 按图片接受
  it('后缀比较大小写不敏感', () => {
    expect(isAssetFileAccepted(IMAGE_CATEGORY, 'hero.PNG')).toBe(true);
    expect(isAssetFileAccepted(ANIMATION_CATEGORY, 'sample.ANIM')).toBe(true);
  });

  // 没有后缀的文件与点在第 0 位的隐藏文件都不接受
  it('无后缀与点名在首位的文件不接受', () => {
    expect(isAssetFileAccepted(IMAGE_CATEGORY, 'hero')).toBe(false);
    expect(isAssetFileAccepted(IMAGE_CATEGORY, '.gitignore')).toBe(false);
  });

  // 不支持的格式给出「前缀 + 后缀清单」的文案
  it('拒绝文案含前缀与允许的后缀', () => {
    const message = unsupportedAssetExtensionMessage(ASSET_IMAGE_FILE_EXTENSIONS);

    expect(message.startsWith(ASSET_UNSUPPORTED_EXTENSION_PREFIX)).toBe(true);
    expect(message).toContain('.png');
    expect(message).toContain('、');
    expect(message).not.toContain('.txt');
  });
});
