/**
 * Category 默认颜色映射
 *
 * 为了降低用户接受成本，完全接受原先的颜色配置。
 * 每种 category 有一个基础颜色，如果块没有显式指定颜色，就使用其 category 的默认颜色。
 *
 * 基于 BlockColours 定义，保持颜色一致性。
 */

import { BlockColours } from './colours';

export const CategoryColours = {
  /** 入口块 - 紫色 */
  entry: BlockColours.ENTRY,

  /** 文本块 - 橙色 */
  text: BlockColours.TEXT,

  /** 数据操作 - 绿色 */
  data: BlockColours.DATA,

  /** 地图块 - 青绿色 */
  map: BlockColours.MAP,

  /** 控制流 - 红色 */
  control: BlockColours.CONTROL,

  /** 特效表现 - 红色（与控制流相同，使用 ANIMATION） */
  effect: BlockColours.ANIMATION,

  /** 交互功能 - 橙色（使用 TEXT 颜色） */
  interaction: BlockColours.TEXT,

  /** 杂项 - 粉色 */
  misc: BlockColours.MISC,

  /** UI 绘制 */
  ui: BlockColours.UI,

  /** 音像处理 */
  sound: BlockColours.SOUND,

  /** 值块 */
  value: BlockColours.EXPRESSION,

  /** 未知块 - 黑色 */
  unknown: 0,
} as const;

/**
 * 获取 category 的默认颜色
 *
 * @param category - 分类名称
 * @returns 颜色值（0-360），如果 category 不存在返回 undefined
 */
export function getCategoryColour(category?: string): number | undefined {
  if (!category) {
    return undefined;
  }
  return CategoryColours[category as keyof typeof CategoryColours];
}
