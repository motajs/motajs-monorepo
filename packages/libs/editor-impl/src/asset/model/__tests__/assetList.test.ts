import { describe, expect, it } from 'vitest';
import { AssetCategoryKind, AssetListFormat, IAssetCategory } from '../../../react';
import { IAssetListEntry } from '../../types';
import { readAssetList, renameAssetListEntry, writeAssetList } from '../assetList';

const textureCategory: IAssetCategory = {
  id: 'texture',
  label: '图片',
  kind: AssetCategoryKind.Image,
  dir: 'content/texture',
  listPath: 'content/texture/.list.jsonc',
  listFormat: AssetListFormat.ObjectList,
  listKey: 'textures',
};

const animationCategory: IAssetCategory = {
  id: 'animation',
  label: '动画',
  kind: AssetCategoryKind.Animation,
  dir: 'content/animation',
  listPath: 'content/animation/.list.jsonc',
  listFormat: AssetListFormat.StringList,
  extension: '.anim',
};

describe('readAssetList', () => {
  // 对象数组形态：按 listKey 取出条目，config 原样保留，index 保序
  it('解析对象数组形态', () => {
    const document = {
      textures: [
        { source: 'a.png', read: 0 },
        { source: 'b.png', read: 1 },
      ],
    };
    const entries = readAssetList(textureCategory, document);

    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({ name: 'a.png', config: { source: 'a.png', read: 0 }, index: 0 });
    expect(entries[1]).toEqual({ name: 'b.png', config: { source: 'b.png', read: 1 }, index: 1 });
  });

  // 字符串数组形态：元素对应条目，无 config
  it('解析字符串数组形态', () => {
    const entries = readAssetList(animationCategory, ['test', 'walk']);

    expect(entries).toEqual([
      { name: 'test', index: 0 },
      { name: 'walk', index: 1 },
    ]);
  });

  // 对象数组里缺来源字段或来源为空串的条目被跳过，不中断其余条目
  it('跳过缺来源字段的条目', () => {
    const document = { textures: [{ source: 'a.png' }, { read: 1 }, { source: '' }, { source: 'b.png' }] };
    const entries = readAssetList(textureCategory, document);

    expect(entries.map((entry) => entry.name)).toEqual(['a.png', 'b.png']);
    expect(entries.map((entry) => entry.index)).toEqual([0, 3]);
  });

  // 容器形态不符时抛错
  it('容器形态不符时抛错', () => {
    expect(() => readAssetList(textureCategory, {})).toThrow('素材列表格式不正确');
    expect(() => readAssetList(textureCategory, { textures: {} })).toThrow('素材列表格式不正确');
    expect(() => readAssetList(animationCategory, {})).toThrow('素材列表格式不正确');
  });

  // 含路径分隔符 / `..` 的名字在解析时被丢弃，绝不进路径推导（防目录穿越）
  it('丢弃含路径穿越的名字', () => {
    const document = {
      textures: [{ source: '../../secret' }, { source: 'ok.png' }, { source: 'a/b.png' }, { source: '..' }],
    };
    const entries = readAssetList(textureCategory, document);

    expect(entries.map((entry) => entry.name)).toEqual(['ok.png']);
    expect(readAssetList(animationCategory, ['../x', 'walk']).map((entry) => entry.name)).toEqual(['walk']);
  });
});

describe('writeAssetList', () => {
  // 对象数组形态写回：保留基底其余键，config 逐条写回，缺配置的条目补来源字段
  it('写回对象数组形态并保留其余键', () => {
    const previous = { textures: [{ source: 'a.png' }], version: 2 };
    const entries: IAssetListEntry[] = [
      { name: 'a.png', config: { source: 'a.png', read: 0 }, index: 0 },
      { name: 'b.png', index: 1 },
    ];

    expect(writeAssetList(textureCategory, entries, previous)).toEqual({
      version: 2,
      textures: [{ source: 'a.png', read: 0 }, { source: 'b.png' }],
    });
  });

  // 字符串数组形态写回为纯名字数组
  it('写回字符串数组形态', () => {
    const entries: IAssetListEntry[] = [
      { name: 'test', index: 0 },
      { name: 'walk', index: 1 },
    ];

    expect(writeAssetList(animationCategory, entries, ['old'])).toEqual(['test', 'walk']);
  });

  // 基底不是普通对象时新建空对象
  it('基底不是对象时新建', () => {
    const entries: IAssetListEntry[] = [{ name: 'a.png', config: { source: 'a.png' }, index: 0 }];

    expect(writeAssetList(textureCategory, entries, null)).toEqual({ textures: [{ source: 'a.png' }] });
  });

  // ObjectList 分类缺 listKey 时写回抛错，而不是静默写出一份未改动的文档
  it('ObjectList 缺 listKey 时抛错', () => {
    const missingKeyCategory: IAssetCategory = { ...textureCategory, listKey: undefined };

    expect(() => writeAssetList(missingKeyCategory, [], {})).toThrow('素材列表缺少容器键定义');
  });
});

describe('readAssetList / writeAssetList round-trip', () => {
  // 对象数组形态读写一轮后正文相等（其余键也还在）
  it('对象数组形态 round-trip', () => {
    const document = {
      version: 1,
      textures: [
        { source: 'a.png', read: 0 },
        { source: 'b.png', read: 1 },
      ],
    };
    const entries = readAssetList(textureCategory, document);

    expect(writeAssetList(textureCategory, entries, document)).toEqual(document);
  });

  // 字符串数组形态读写一轮后正文相等
  it('字符串数组形态 round-trip', () => {
    const document = ['test', 'walk'];
    const entries = readAssetList(animationCategory, document);

    expect(writeAssetList(animationCategory, entries, document)).toEqual(document);
  });
});

describe('renameAssetListEntry', () => {
  // 字符串数组形态只换名字
  it('字符串形态只换名字', () => {
    expect(renameAssetListEntry(animationCategory, { name: 'test', index: 0 }, 'walk')).toEqual({
      name: 'walk',
      index: 0,
    });
  });

  // 对象数组形态同时改 config 的来源字段，且不改原条目
  it('对象数组形态改来源字段', () => {
    const entry: IAssetListEntry = { name: 'a.png', config: { source: 'a.png', read: 0 }, index: 0 };

    expect(renameAssetListEntry(textureCategory, entry, 'b.png')).toEqual({
      name: 'b.png',
      config: { source: 'b.png', read: 0 },
      index: 0,
    });
    expect(entry.config).toEqual({ source: 'a.png', read: 0 });
  });
});
