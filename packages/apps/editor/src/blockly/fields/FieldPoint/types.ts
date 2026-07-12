/**
 * FieldPoint 类型定义
 */

/**
 * 相对楼层标识
 * - :now - 当前楼
 * - :before - 前一楼
 * - :next - 后一楼
 */
export type RelativeFloor = ':now' | ':before' | ':next';

/**
 * 检查是否为相对楼层
 */
export function isRelativeFloor(
  value: string | undefined,
): value is RelativeFloor {
  return value === ':now' || value === ':before' || value === ':next';
}

/**
 * 相对楼层的显示文本
 */
export const RELATIVE_FLOOR_DISPLAY: Record<RelativeFloor, string> = {
  ':now': '当前',
  ':before': '前一楼',
  ':next': '后一楼',
};

/**
 * 单点坐标值
 */
export interface PointValue {
  x: number;
  y: number;
  /**
   * 楼层标识
   * - undefined: 不指定楼层（某些块不需要）
   * - RelativeFloor: 相对楼层（:now / :before / :next）
   * - string: 具体楼层 ID（如 "MT1"）
   */
  floorId?: string | RelativeFloor;
}

/**
 * 多点坐标值（暂时保留，后续迭代）
 */
export type MultiPointValue = PointValue[];

/**
 * FieldPoint 配置项
 */
export interface FieldPointConfig {
  /** 是否包含楼层字段，默认 true */
  includeFloor?: boolean;

  /**
   * 是否允许选择相对楼层（:now / :before / :next），默认 false
   * - true: 选点器显示"当前楼/前一楼/后一楼"选项
   * - false: 只能选择具体楼层
   */
  allowRelativeFloor?: boolean;

  /** 是否支持多选，默认 false（暂不实现） */
  multiSelect?: boolean;
}

/**
 * FieldPoint 的 JSON 定义格式
 * 用于 block schema 的 args 定义
 */
export interface FieldPointJsonConfig extends FieldPointConfig {
  type: 'field_point';
  name: string;
  /** 初始 x 坐标 */
  x?: number;
  /** 初始 y 坐标 */
  y?: number;
  /** 初始楼层 ID（可以是相对楼层） */
  floorId?: string;
}

/**
 * 默认配置
 */
export const DEFAULT_CONFIG: Required<FieldPointConfig> = {
  includeFloor: true,
  allowRelativeFloor: false,
  multiSelect: false,
};

/**
 * 默认点值
 */
export const DEFAULT_POINT: PointValue = {
  x: 0,
  y: 0,
};
