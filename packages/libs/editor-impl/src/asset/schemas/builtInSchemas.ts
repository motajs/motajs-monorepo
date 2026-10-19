import { AssetCategoryKind } from '../../react';
import { IEnumTitleMap, ITableSchemaNode } from '../../shared/schemaForm/types';

// 内置的「新引擎」分类 schema：图片按读取方式与用途区分，音频按类型区分；动画 / 字体留空对象 schema，
// 落回表格引擎既有的「尚未定义任何字段。」空态。legacy 那套引擎专有 schema 由装配方经 `IAssetCategory.schema`
// 注入，不写在这里（引擎专有词不得出现在包内源码）。

/** 图片读取方式的显示标签 */
const IMG_ASSET_READ_TITLES: IEnumTitleMap = Object.freeze({
  '0': '整图',
  '1': '网格',
  '2': '逐行动画',
  '3': '逐列动画',
  '4': '扫描动画',
});

/** 图片用途的显示标签 */
const IMG_ASSET_USAGE_TITLES: IEnumTitleMap = Object.freeze({
  '0': '常规图',
  '1': '图块',
  '2': '图块集',
});

/** 音频类型的显示标签 */
const AUDIO_ASSET_TYPE_TITLES: IEnumTitleMap = Object.freeze({
  '0': '背景音乐',
  '1': '音效',
});

/** 图片分类的内置 schema */
const IMAGE_ASSET_SCHEMA = Object.freeze<ITableSchemaNode>({
  type: 'object',
  properties: {
    source: { type: 'string', description: '素材图片文件名' },
    read: {
      type: 'number',
      enum: [0, 1, 2, 3, 4],
      'x-enum-titles': IMG_ASSET_READ_TITLES,
      description: '读取方式',
    },
    usage: {
      type: 'number',
      enum: [0, 1, 2],
      'x-enum-titles': IMG_ASSET_USAGE_TITLES,
      description: '用途',
    },
    grid: { type: 'array', items: { type: 'number' }, description: '网格单元宽高' },
    tiles: { type: 'array', items: { type: 'number' }, description: '图块序号列表' },
  },
  required: ['source', 'read', 'usage'],
});

/** 音频分类的内置 schema */
const AUDIO_ASSET_SCHEMA = Object.freeze<ITableSchemaNode>({
  type: 'object',
  properties: {
    type: {
      type: 'number',
      enum: [0, 1],
      'x-enum-titles': AUDIO_ASSET_TYPE_TITLES,
      description: '音频类型',
    },
    source: { type: 'string', description: '音频文件名' },
  },
  required: ['type', 'source'],
});

/** 动画 / 字体分类的内置 schema：空对象，落回表格引擎的空态 */
const EMPTY_ASSET_SCHEMA = Object.freeze<ITableSchemaNode>({ type: 'object', properties: {} });

/**
 * 取某个大分类的内置「新引擎」schema
 * @param kind 分类的种类
 * @returns 该种类的内置 schema 节点
 */
export function getBuiltInAssetSchema(kind: AssetCategoryKind): ITableSchemaNode {
  if (kind === AssetCategoryKind.Image) return IMAGE_ASSET_SCHEMA;
  if (kind === AssetCategoryKind.Audio) return AUDIO_ASSET_SCHEMA;

  return EMPTY_ASSET_SCHEMA;
}
