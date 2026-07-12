/**
 * 下拉列表选项定义
 *
 * 定义入口块和其他块使用的通用下拉列表选项
 */

// ============================================
// 通行状态列表
// ============================================

/**
 * B_0_List - 通行状态
 * 用于 event_m 中的 noPass 字段
 */
export const B_0_LIST_OPTIONS: Array<[string, string]> = [
  ['不改变', 'null'],
  ['不可通行', 'true'],
  ['可以通行', 'false'],
];

// ============================================
// 楼层相关列表
// ============================================

/**
 * Floor_List - 楼层选择
 * 用于 changeFloor_m 中的楼层选择
 */
export const FLOOR_LIST_OPTIONS: Array<[string, string]> = [
  ['楼层ID', 'floorId'],
  ['前一楼', ':before'],
  ['后一楼', ':next'],
  ['当前楼', ':now'],
];

/**
 * Stair_List - 楼梯类型
 * 用于 changeFloor_m 中的楼梯定位方式
 */
export const STAIR_LIST_OPTIONS: Array<[string, string]> = [
  ['坐标', 'loc'],
  ['上楼梯', 'upFloor'],
  ['下楼梯', 'downFloor'],
  ['保持不变', ':now'],
  ['中心对称点', ':symmetry'],
  ['x对称点', ':symmetry_x'],
  ['y对称点', ':symmetry_y'],
  ['楼传落点', 'flyPoint'],
];

// ============================================
// 方向列表
// ============================================

/**
 * DirectionEx_List - 扩展方向列表
 * 用于 changeFloor_m 中的朝向
 */
export const DIRECTION_EX_LIST_OPTIONS: Array<[string, string]> = [
  ['不变', 'null'],
  ['朝上', 'up'],
  ['朝下', 'down'],
  ['朝左', 'left'],
  ['朝右', 'right'],
  ['左转', ':left'],
  ['右转', ':right'],
  ['背对', ':back'],
  ['角色同向', ':hero'],
  ['角色反向', ':backhero'],
];

// ============================================
// 穿透性列表
// ============================================

/**
 * IgnoreChangeFloor_List - 穿透性
 * 用于 changeFloor_m 中的穿透设置
 */
export const IGNORE_CHANGE_FLOOR_LIST_OPTIONS: Array<[string, string]> = [
  ['全局默认值', 'null'],
  ['可穿透', 'true'],
  ['不可穿透', 'false'],
];
