import { EditorEntryKind, IFileEntry } from '@motajs/editor-core';
import { describe, expect, it } from 'vitest';
import { AssetCategoryKind, AssetListFormat, IAssetCategory } from '../../../react';
import { collectUnregisteredAssetNames, isAssetOriginFileName } from '../assetScan';

// 四个测试分类沿用素材面板的约定：图片 / 音频是对象数组，动画带固定扩展名，字体列表名即文件名
const TEXTURE_CATEGORY: IAssetCategory = {
  id: 'texture',
  label: '图片',
  kind: AssetCategoryKind.Image,
  dir: 'content/texture',
  listPath: 'content/texture/.list.jsonc',
  listFormat: AssetListFormat.ObjectList,
  listKey: 'textures',
  defaultsPath: 'content/texture/defaults.jsonc',
};

const AUDIO_CATEGORY: IAssetCategory = {
  id: 'audio',
  label: '音频',
  kind: AssetCategoryKind.Audio,
  dir: 'content/audio',
  listPath: 'content/audio/.list.jsonc',
  listFormat: AssetListFormat.ObjectList,
  listKey: 'audios',
};

const ANIMATION_CATEGORY: IAssetCategory = {
  id: 'animation',
  label: '动画',
  kind: AssetCategoryKind.Animation,
  dir: 'content/animation',
  listPath: 'content/animation/.list.jsonc',
  listFormat: AssetListFormat.StringList,
  extension: '.anim',
};

const FONT_CATEGORY: IAssetCategory = {
  id: 'font',
  label: '字体',
  kind: AssetCategoryKind.Font,
  dir: 'content/font',
  listPath: 'content/font/.list.jsonc',
  listFormat: AssetListFormat.StringList,
};

/**
 * 造一组分类目录下的直接文件条目
 * @param dir 分类目录
 * @param names 文件名列表
 * @returns 文件条目
 */
function entriesOf(dir: string, names: readonly string[]): readonly IFileEntry[] {
  return names.map((name) => ({ path: `${dir}/${name}`, name, kind: EditorEntryKind.File }));
}

/**
 * 造一个分类目录下的直接子目录条目
 * @param dir 分类目录
 * @param name 子目录名
 * @returns 目录条目
 */
function directoryOf(dir: string, name: string): IFileEntry {
  return { path: `${dir}/${name}`, name, kind: EditorEntryKind.Directory };
}

describe('collectUnregisteredAssetNames', () => {
  // 隐藏文件、列表文件与 schema 文件都不进候选
  it('排除隐藏文件、列表文件与 schema 文件', () => {
    const entries = entriesOf('content/texture', ['.DS_Store', '.list.jsonc', '.schema.jsonc', 'hero.png']);

    expect(collectUnregisteredAssetNames(TEXTURE_CATEGORY, entries, [])).toEqual(['hero.png']);
  });

  // 显式 defaultsPath 指向的文件被排除
  it('排除 defaultsPath 指向的文件', () => {
    const entries = entriesOf('content/texture', ['defaults.jsonc', 'hero.png']);

    expect(collectUnregisteredAssetNames(TEXTURE_CATEGORY, entries, [])).toEqual(['hero.png']);
  });

  // `-origin` 备份被排除，普通文件不会被误判
  it('排除 -origin 备份', () => {
    expect(isAssetOriginFileName('hero-origin.png')).toBe(true);
    expect(isAssetOriginFileName('hero.png')).toBe(false);

    const entries = entriesOf('content/audio', ['hero.mp3', 'hero-origin.mp3']);

    expect(collectUnregisteredAssetNames(AUDIO_CATEGORY, entries, [])).toEqual(['hero.mp3']);
  });

  // 已登记名字不会因为目录里有同名文件而再出现一次
  it('跳过已登记的名字', () => {
    const entries = entriesOf('content/texture', ['hero.png', 'extra.png']);

    expect(collectUnregisteredAssetNames(TEXTURE_CATEGORY, entries, ['hero.png'])).toEqual(['extra.png']);
  });

  // 带固定扩展名的分类只认自己的扩展名
  it('动画分类只产出 .anim 对应的名字', () => {
    const entries = entriesOf('content/animation', ['foo.png', 'foo.anim', 'bar.anim', 'foo-origin.anim']);

    expect(collectUnregisteredAssetNames(ANIMATION_CATEGORY, entries, [])).toEqual(['bar', 'foo']);
  });

  // 目录条目不算素材
  it('排除目录条目', () => {
    const entries = [directoryOf('content/texture', 'sub'), directoryOf('content/texture', 'ghost.png')];

    expect(collectUnregisteredAssetNames(TEXTURE_CATEGORY, entries, [])).toEqual([]);
  });

  // 命中的名字按升序返回
  it('结果按名字升序返回', () => {
    const entries = entriesOf('content/texture', ['zeta.png', 'alpha.png', 'middle.png']);

    expect(collectUnregisteredAssetNames(TEXTURE_CATEGORY, entries, [])).toEqual([
      'alpha.png',
      'middle.png',
      'zeta.png',
    ]);
  });

  // 输入顺序不同也得到同一结果（稳定排序）
  it('输入顺序不影响结果', () => {
    const forward = entriesOf('content/font', ['a.ttf', 'b.ttf', 'c.ttf']);
    const backward = entriesOf('content/font', ['c.ttf', 'a.ttf', 'b.ttf']);

    expect(collectUnregisteredAssetNames(FONT_CATEGORY, forward, [])).toEqual(
      collectUnregisteredAssetNames(FONT_CATEGORY, backward, []),
    );
  });
});
