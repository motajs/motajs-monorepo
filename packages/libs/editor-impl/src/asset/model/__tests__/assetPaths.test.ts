import { describe, expect, it } from 'vitest';
import { AssetCategoryKind, AssetListFormat, IAssetCategory } from '../../../react';
import {
  resolveAssetBytePath,
  resolveAssetName,
  resolveOriginPath,
  resolveTranscodedPath,
  sanitizeAssetFileName,
} from '../assetPaths';

const animationCategory: IAssetCategory = {
  id: 'animation',
  label: '动画',
  kind: AssetCategoryKind.Animation,
  dir: 'content/animation',
  listPath: 'content/animation/.list.jsonc',
  listFormat: AssetListFormat.StringList,
  extension: '.anim',
};

const fontCategory: IAssetCategory = {
  id: 'font',
  label: '字体',
  kind: AssetCategoryKind.Font,
  dir: 'content/font',
  listPath: 'content/font/.list.jsonc',
  listFormat: AssetListFormat.StringList,
};

describe('sanitizeAssetFileName', () => {
  // 含路径分隔符的名字被拒绝（防路径穿越）
  it('拒绝含分隔符的名字', () => {
    expect(sanitizeAssetFileName('a/b.png')).toBeNull();
    expect(sanitizeAssetFileName('a\\b.png')).toBeNull();
  });

  // `..` 与单点名字被拒绝
  it('拒绝 . 与 .. 名字', () => {
    expect(sanitizeAssetFileName('..')).toBeNull();
    expect(sanitizeAssetFileName('.')).toBeNull();
    expect(sanitizeAssetFileName('../a.png')).toBeNull();
  });

  // 前导点的名字被拒绝（含 `.list.jsonc` 这类约定文件）
  it('拒绝前导点的名字', () => {
    expect(sanitizeAssetFileName('.list.jsonc')).toBeNull();
    expect(sanitizeAssetFileName('.hidden.png')).toBeNull();
  });

  // 空串与纯空白被拒绝
  it('拒绝空串与纯空白', () => {
    expect(sanitizeAssetFileName('')).toBeNull();
    expect(sanitizeAssetFileName('   ')).toBeNull();
  });

  // 控制字符与 Windows 非法字符被拒绝
  it('拒绝控制字符与 Windows 非法字符', () => {
    expect(sanitizeAssetFileName('a\u0000b.png')).toBeNull();
    expect(sanitizeAssetFileName('a\nb.png')).toBeNull();
    expect(sanitizeAssetFileName('a:b.png')).toBeNull();
    expect(sanitizeAssetFileName('a?b.png')).toBeNull();
    expect(sanitizeAssetFileName('a*b.png')).toBeNull();
    expect(sanitizeAssetFileName('a|b.png')).toBeNull();
  });

  // 正常名字被接受并去掉两端空白
  it('接受正常名字并 trim', () => {
    expect(sanitizeAssetFileName('hero.png')).toBe('hero.png');
    expect(sanitizeAssetFileName('  hero.png  ')).toBe('hero.png');
  });

  // 超过长度上限的名字被拒绝
  it('拒绝过长的名字', () => {
    expect(sanitizeAssetFileName('a'.repeat(129))).toBeNull();
    expect(sanitizeAssetFileName('a'.repeat(128))).toBe('a'.repeat(128));
  });
});

describe('resolveAssetName', () => {
  // 动画分类名去掉 `.anim` 扩展名
  it('按分类扩展名去掉后缀', () => {
    expect(resolveAssetName(animationCategory, 'test.anim')).toBe('test');
  });

  // 分类无扩展名约定时名字原样返回
  it('无扩展名约定时原样返回', () => {
    expect(resolveAssetName(fontCategory, 'a.ttf')).toBe('a.ttf');
  });
});

describe('resolveAssetBytePath', () => {
  // 动画分类补 `.anim` 扩展名
  it('动画分类补扩展名', () => {
    expect(resolveAssetBytePath(animationCategory, 'test')).toBe('content/animation/test.anim');
  });

  // 字体分类不补扩展名
  it('字体分类不补扩展名', () => {
    expect(resolveAssetBytePath(fontCategory, 'a.ttf')).toBe('content/font/a.ttf');
  });
});

describe('resolveTranscodedPath', () => {
  // 替换最后一段的扩展名
  it('替换扩展名', () => {
    expect(resolveTranscodedPath('content/texture/a.png', '.webp')).toBe('content/texture/a.webp');
  });

  // 原路径没有扩展名时直接追加
  it('无扩展名时追加', () => {
    expect(resolveTranscodedPath('content/texture/a', '.webp')).toBe('content/texture/a.webp');
  });
});

describe('resolveOriginPath', () => {
  // 扩展名前插入 `-origin` 后缀
  it('扩展名前插入后缀', () => {
    expect(resolveOriginPath('content/texture/a.png')).toBe('content/texture/a-origin.png');
  });

  // 原路径没有扩展名时直接追加后缀
  it('无扩展名时追加后缀', () => {
    expect(resolveOriginPath('content/texture/a')).toBe('content/texture/a-origin');
  });
});
