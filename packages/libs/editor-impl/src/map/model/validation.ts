import { IMapSize, IMapSizeLimit } from '../types';

// 输入校验：地图名 / 图层名 / 尺寸，统一返回「错误文案或 null」。
// 不做 UI、不抛错、不夹取；调用方只负责把返回的文案显示在对应字段下。

/** 地图名为空时的文案 */
const MAP_NAME_REQUIRED = '请输入地图名称。';

/** 地图名与现有地图重名时的文案 */
const MAP_NAME_EXISTS = '名称已存在。';

/** 图层名为空时的文案 */
const LAYER_NAME_REQUIRED = '请输入图层名称。';

/** 图层名与现有图层重名时的文案 */
const LAYER_NAME_EXISTS = '图层名称已存在。';

/** 没有尺寸上限时，宽度不是正整数时的文案 */
const MAP_WIDTH_POSITIVE = '宽度必须是正整数。';

/** 没有尺寸上限时，高度不是正整数时的文案 */
const MAP_HEIGHT_POSITIVE = '高度必须是正整数。';

/**
 * 判断一个尺寸是否合法：必须是整数、至少为 1，且不超过上限（没有上限时只看下限）
 * @param value 宽或高
 * @param max 该维度的上限；undefined 表示不限制
 * @returns 合法时为 true
 */
function isValidDimension(value: number, max: number | undefined): boolean {
  if (!Number.isInteger(value) || value < 1) return false;

  return max === undefined || value <= max;
}

/**
 * 校验地图名：去首尾空白后不能为空，也不能与现有地图同名（区分大小写）
 * @param name 用户输入的地图名
 * @param existingNames 现有地图名
 * @returns 首个错误文案；通过时为 null
 */
export function validateMapName(name: string, existingNames: readonly string[]): string | null {
  const trimmed = name.trim();

  if (trimmed.length === 0) return MAP_NAME_REQUIRED;
  if (existingNames.some((existing) => existing.trim() === trimmed)) return MAP_NAME_EXISTS;

  return null;
}

/**
 * 校验图层名：去首尾空白后不能为空，也不能与现有图层同名（区分大小写）
 * @param name 用户输入的图层名
 * @param existingNames 现有图层名
 * @returns 首个错误文案；通过时为 null
 */
export function validateLayerName(name: string, existingNames: readonly string[]): string | null {
  const trimmed = name.trim();

  if (trimmed.length === 0) return LAYER_NAME_REQUIRED;
  if (existingNames.some((existing) => existing.trim() === trimmed)) return LAYER_NAME_EXISTS;

  return null;
}

/**
 * 校验地图尺寸：宽高必须是 1 到上限之间的整数；超限返回错误文案而不是夹取
 *
 * 没有上限时只校验「是正整数」；有上限时文案固定为「必须是 1 到 {最大} 之间的整数。」。
 * @param size 用户输入的宽高
 * @param limit 宿主给出的尺寸上限；缺省表示不限制
 * @returns 首个错误文案；通过时为 null
 */
export function validateMapSize(size: IMapSize, limit?: IMapSizeLimit): string | null {
  if (!isValidDimension(size.width, limit?.maxWidth)) {
    if (limit === undefined) return MAP_WIDTH_POSITIVE;

    return `宽度必须是 1 到 ${limit.maxWidth} 之间的整数。`;
  }

  if (!isValidDimension(size.height, limit?.maxHeight)) {
    if (limit === undefined) return MAP_HEIGHT_POSITIVE;

    return `高度必须是 1 到 ${limit.maxHeight} 之间的整数。`;
  }

  return null;
}
