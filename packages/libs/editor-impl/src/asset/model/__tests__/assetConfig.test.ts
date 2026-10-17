import { describe, expect, it } from 'vitest';
import { AssetCategoryKind, AssetListFormat, IAssetCategory } from '../../../react';
import { ITableSchemaNode } from '../../../shared/schemaForm/types';
import { AssetSchemaSource } from '../../types';
import { getBuiltInAssetSchema } from '../../schemas/builtInSchemas';
import { collectRequiredPaths, mergeAssetDefaults, validateAssetConfig } from '../assetDefaults';
import { resolveAssetSchema, resolveAssetSchemaPath } from '../assetSchema';

const injectedSchema: ITableSchemaNode = { type: 'object', properties: { source: { type: 'string' } } };

describe('mergeAssetDefaults', () => {
  // 逐属性合并：目标已有对象则递归保留目标值，缺省才补默认值
  it('逐属性合并并保留目标值', () => {
    const defaults = { source: 'default.png', read: 1, grid: [32, 32], nested: { a: 1, b: 2 } };
    const config = { source: 'mine.png', nested: { a: 9 } };
    const merged = mergeAssetDefaults(defaults, config);

    expect(merged).toEqual({ source: 'mine.png', read: 1, grid: [32, 32], nested: { a: 9, b: 2 } });
  });

  // `@required` 键不会被写进合并结果
  it('不把 @required 写进结果', () => {
    const merged = mergeAssetDefaults({ '@required': ['source'], source: 'default.png' }, {});

    expect(merged).toEqual({ source: 'default.png' });
    expect('@required' in merged).toBe(false);
  });

  // 目标缺省时写入默认值的深拷贝（不是同一引用）
  it('目标缺省时写入深拷贝', () => {
    const defaults = { tiles: [1, 2, 3] };
    const merged = mergeAssetDefaults(defaults, {});

    expect(merged).toEqual({ tiles: [1, 2, 3] });
    expect(merged.tiles).not.toBe(defaults.tiles);
  });

  // 不改任何入参
  it('不改入参', () => {
    const config = { source: 'mine.png' };
    mergeAssetDefaults({ '@required': ['source'], read: 1 }, config);

    expect(config).toEqual({ source: 'mine.png' });
  });
});

describe('collectRequiredPaths', () => {
  // 收集顶层必填路径
  it('收集顶层必填路径', () => {
    const paths = collectRequiredPaths({ '@required': ['source', 'read'], source: 'a', read: 0 });

    expect(paths).toEqual(['source', 'read']);
  });

  // 嵌套对象的必填路径带 `.` 前缀
  it('收集嵌套必填路径', () => {
    const defaults = { '@required': ['source'], nested: { '@required': ['w', 'h'], w: 1 } };

    expect(collectRequiredPaths(defaults)).toEqual(['source', 'nested.w', 'nested.h']);
  });

  // 非对象时为空
  it('非对象时为空', () => {
    expect(collectRequiredPaths(undefined)).toEqual([]);
    expect(collectRequiredPaths([])).toEqual([]);
  });
});

describe('validateAssetConfig', () => {
  // schema 不符时给出整份配置的错误文案
  it('schema 不符时给出错误', () => {
    expect(validateAssetConfig({ type: 'object' }, 'not-object', [])).toEqual(['配置不符合该分类的字段定义']);
  });

  // 必填路径缺失时逐条给出可读错误
  it('必填缺失时逐条给出错误', () => {
    expect(validateAssetConfig({ type: 'object' }, { source: 'a' }, ['source', 'read'])).toEqual([
      '字段「read」为必填',
    ]);
  });

  // 全部满足时返回空数组
  it('通过时返回空数组', () => {
    const schema: ITableSchemaNode = {
      type: 'object',
      required: ['source'],
      properties: { source: { type: 'string' } },
    };

    expect(validateAssetConfig(schema, { source: 'a' }, ['source'])).toEqual([]);
  });
});

describe('resolveAssetSchema', () => {
  // 工程内 schema 优先，来源标为 ProjectFile
  it('工程 schema 优先', () => {
    const text = JSON.stringify({ type: 'object', properties: { source: { type: 'string' } } });
    const resolution = resolveAssetSchema(AssetCategoryKind.Image, text, injectedSchema);

    expect(resolution!.source).toBe(AssetSchemaSource.ProjectFile);
    expect(resolution!.schema).toEqual({ type: 'object', properties: { source: { type: 'string' } } });
  });

  // 无工程 schema 时用注入的 schema
  it('无工程 schema 时用注入', () => {
    const resolution = resolveAssetSchema(AssetCategoryKind.Image, undefined, injectedSchema);

    expect(resolution!.source).toBe(AssetSchemaSource.Injected);
    expect(resolution!.schema).toBe(injectedSchema);
  });

  // 都没有时用内置 schema
  it('都没有时用内置', () => {
    const resolution = resolveAssetSchema(AssetCategoryKind.Audio, undefined, undefined);

    expect(resolution!.source).toBe(AssetSchemaSource.BuiltIn);
    expect(resolution!.schema).toBe(getBuiltInAssetSchema(AssetCategoryKind.Audio));
  });

  // 工程内 schema 非法时返回 null（不静默回退）
  it('工程 schema 非法时返回 null', () => {
    expect(resolveAssetSchema(AssetCategoryKind.Image, '{oops', injectedSchema)).toBeNull();
  });

  // 工程内 schema 需剥离注释时返回 null
  it('工程 schema 需剥离注释时返回 null', () => {
    expect(resolveAssetSchema(AssetCategoryKind.Image, '{ // note\n "type": "object" }', injectedSchema)).toBeNull();
  });
});

describe('resolveAssetSchemaPath', () => {
  const baseCategory: IAssetCategory = {
    id: 'texture',
    label: '图片',
    kind: AssetCategoryKind.Image,
    dir: 'content/texture',
    listPath: 'content/texture/.list.jsonc',
    listFormat: AssetListFormat.ObjectList,
    listKey: 'textures',
  };

  // 未指定时按分类目录推导
  it('未指定时按目录推导', () => {
    expect(resolveAssetSchemaPath(baseCategory)).toBe('content/texture/.schema.jsonc');
  });

  // 指定时用指定值
  it('指定时用指定值', () => {
    expect(resolveAssetSchemaPath({ ...baseCategory, schemaPath: 'custom/schema.jsonc' })).toBe('custom/schema.jsonc');
  });
});

describe('getBuiltInAssetSchema', () => {
  // 图片内置 schema 覆盖读取方式与用途，并声明必填
  it('图片 schema 覆盖读取方式与用途', () => {
    const schema = getBuiltInAssetSchema(AssetCategoryKind.Image);

    expect(schema.properties).toBeDefined();
    expect(schema.properties!.read).toBeDefined();
    expect(schema.properties!.usage).toBeDefined();
    expect(schema.required).toEqual(['source', 'read', 'usage']);
  });

  // 音频内置 schema 用类型字段区分背景音乐与音效
  it('音频 schema 含类型字段', () => {
    const schema = getBuiltInAssetSchema(AssetCategoryKind.Audio);

    expect(schema.properties!.type).toBeDefined();
    expect(schema.required).toEqual(['type', 'source']);
  });

  // 动画内置 schema 属性为空，落回空态
  it('动画 schema 的属性为空', () => {
    const schema = getBuiltInAssetSchema(AssetCategoryKind.Animation);

    expect(schema.type).toBe('object');
    expect(Object.keys(schema.properties ?? {})).toEqual([]);
  });

  // 字体内置 schema 属性为空，落回空态
  it('字体 schema 的属性为空', () => {
    const schema = getBuiltInAssetSchema(AssetCategoryKind.Font);

    expect(Object.keys(schema.properties ?? {})).toEqual([]);
  });
});
