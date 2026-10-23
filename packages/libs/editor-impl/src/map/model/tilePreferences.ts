import {
  MAP_FAVORITE_SLOT_COUNT,
  MAP_FREQUENT_LIMIT,
  MAP_RECENT_TILES_KEY,
  MAP_TILE_PREFS_FAVORITES_KEY,
  MAP_TILE_PREFS_FREQUENT_KEY,
  MAP_TILE_PREFS_RECENT_KEY,
} from '../constants';
import { IMapTilePreferences } from '../types';
import { normalizeRecentTiles } from './recentTiles';

// 图块偏好的纯函数：把可能被改坏的偏好文件归一化成合法形状，并给「最常使用」与 9 格收藏排序。
// 这一层不读文件、不碰 React / Pixi / editor-core；面板负责解析文件与写回。

/**
 * 判断一个值是否为正整数
 * @param value 待判断的值
 * @returns 是正整数时为 true
 */
function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/**
 * 判断一个值是否是普通对象（非 null 且不是数组）
 * @param value 待判断的值
 * @returns 是普通对象时为 true
 */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 判断一个值是否是可用的使用次数
 * @param value 待判断的值
 * @returns 是有限正数时为 true
 */
function isPositiveCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * 判断一个字符串是否只由十进制数字组成
 * @param key 待判断的键
 * @returns 全部是数字字符时为 true
 */
function isDigitKey(key: string): boolean {
  return /^\d+$/.test(key);
}

/**
 * 生成 9 格全空的收藏
 * @returns 长度等于 `MAP_FAVORITE_SLOT_COUNT` 的 0 数组
 */
function createEmptyFavoriteSlots(): number[] {
  return Array.from({ length: MAP_FAVORITE_SLOT_COUNT }, () => 0);
}

/**
 * 生成一份全空的偏好
 * @returns 最近使用为空、次数表为空、收藏 9 个 0
 */
function createEmptyPreferences(): IMapTilePreferences {
  return {
    recent: [],
    favorites: createEmptyFavoriteSlots(),
    frequent: new Map<number, number>(),
  };
}

/**
 * 把任意输入归一化成固定的 9 格收藏
 *
 * 数组下标就是格位：只保留允许收藏的正整数编号，目录外、重复以及非正整数的格位留空位 0；
 * 不足 9 格补 0，超出 9 格截断。非数组退化为 9 个 0。
 * @param raw 任意原始输入
 * @param favoriteNumbers 允许收藏的编号集合
 * @returns 长度恒为 9 的收藏编号列表
 */
function normalizeFavoriteSlots(raw: unknown, favoriteNumbers: ReadonlySet<number>): number[] {
  const slots = createEmptyFavoriteSlots();

  if (!Array.isArray(raw)) return slots;

  const used: Set<number> = new Set();
  const count = Math.min(raw.length, MAP_FAVORITE_SLOT_COUNT);

  for (let index = 0; index < count; index += 1) {
    const item = raw[index];

    if (!isPositiveInteger(item)) continue;
    if (!favoriteNumbers.has(item)) continue;
    if (used.has(item)) continue;

    used.add(item);
    slots[index] = item;
  }

  return slots;
}

/**
 * 把次数表裁到写盘上限，超出时只留次数最高的条目
 * @param counts 归一化后的次数表
 * @returns 未超上限时是同一个 Map，否则是按次数降序（同次数编号升序）裁剪后的新 Map
 */
function trimFrequentCounts(counts: Map<number, number>): Map<number, number> {
  if (counts.size <= MAP_FREQUENT_LIMIT) return counts;

  const ordered = [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0] - right[0]);

  return new Map(ordered.slice(0, MAP_FREQUENT_LIMIT));
}

/**
 * 把任意输入归一化成「编号 → 次数」的表
 *
 * 只接受纯数字键（`__proto__` / `constructor` 一类键直接丢弃，避免原型污染），
 * 次数必须是有限正数，编号必须在目录里；条目超过 `MAP_FREQUENT_LIMIT` 时只留次数最高的那些。
 * @param raw 任意原始输入
 * @param knownNumbers 目录里存在的编号集合
 * @returns 新的次数表；没有任何可用条目时为空 Map
 */
function normalizeFrequentCounts(raw: unknown, knownNumbers: ReadonlySet<number>): Map<number, number> {
  const counts: Map<number, number> = new Map();

  if (!isPlainRecord(raw)) return counts;

  for (const key of Object.keys(raw)) {
    if (!isDigitKey(key)) continue;

    const number = Number(key);
    const count = raw[key];

    if (!isPositiveInteger(number)) continue;
    if (!knownNumbers.has(number)) continue;
    if (!isPositiveCount(count)) continue;

    counts.set(number, count);
  }

  return trimFrequentCounts(counts);
}

/**
 * 把收藏格位索引夹到 `0..MAP_FAVORITE_SLOT_COUNT-1`；非数按 0 处理
 * @param index 原始索引
 * @returns 可安全索引收藏数组的整数
 */
function clampSlotIndex(index: number): number {
  if (!Number.isFinite(index)) return 0;

  return Math.min(MAP_FAVORITE_SLOT_COUNT - 1, Math.max(0, Math.trunc(index)));
}

/**
 * 把任意收藏列表补齐 / 截断到 9 格
 * @param favorites 收藏列表
 * @returns 长度恒为 9 的新数组
 */
function padFavoriteSlots(favorites: readonly number[]): number[] {
  const slots = createEmptyFavoriteSlots();
  const count = Math.min(favorites.length, MAP_FAVORITE_SLOT_COUNT);

  for (let index = 0; index < count; index += 1) slots[index] = favorites[index];

  return slots;
}

/**
 * 把偏好文件的任意内容归一化成合法形状
 *
 * 三份数据各自独立退化：最近使用沿用 `normalizeRecentTiles` 的口径（非数组 / 非正整数 / 目录外 / 重复 / 超上限），
 * 次数表只接受数字键且编号必须在目录里，收藏恒为 9 格且只允许 `favoriteNumbers` 里的编号。
 * 任何非法输入都不抛错。
 * @param raw 任意原始输入（通常是 `parseTableText` 解析出来的对象）
 * @param knownNumbers 图块目录里存在的编号集合
 * @param favoriteNumbers 允许收藏的编号集合（不含 Tileset 一类不可收藏的编号）
 * @param limit 最近使用的条目上限
 * @returns 归一化后的偏好
 */
export function normalizeTilePreferences(
  raw: unknown,
  knownNumbers: ReadonlySet<number>,
  favoriteNumbers: ReadonlySet<number>,
  limit: number,
): IMapTilePreferences {
  if (!isPlainRecord(raw)) return createEmptyPreferences();

  return {
    recent: normalizeRecentTiles(raw[MAP_TILE_PREFS_RECENT_KEY], knownNumbers, limit),
    favorites: normalizeFavoriteSlots(raw[MAP_TILE_PREFS_FAVORITES_KEY], favoriteNumbers),
    frequent: normalizeFrequentCounts(raw[MAP_TILE_PREFS_FREQUENT_KEY], knownNumbers),
  };
}

/**
 * 把次数表排成「最常使用」的展示顺序
 *
 * 次数降序、同次数编号升序；非法条目（非正整数编号或非正数次数）不进入结果；最后按上限截断。
 * @param counts 「编号 → 次数」的表
 * @param limit 展示条目上限
 * @returns 排好序的编号列表；上限非正或没有可用条目时为空数组
 */
export function rankFrequentTiles(counts: ReadonlyMap<number, number>, limit: number): readonly number[] {
  if (limit <= 0) return [];

  const entries = [...counts.entries()].filter(
    ([number, count]) => isPositiveInteger(number) && isPositiveCount(count),
  );

  entries.sort((left, right) => right[1] - left[1] || left[0] - right[0]);

  return entries.slice(0, limit).map((entry) => entry[0]);
}

/**
 * 把一个收藏格位移到另一个格位
 *
 * 先补齐 / 截断到 9 格，再移动：来源与目标的越界索引被夹到 `0..8`，其余格位保持原有相对顺序。
 * 入参不被改动。
 * @param favorites 当前收藏列表
 * @param from 要移动的格位索引
 * @param to 目标格位索引
 * @returns 长度恒为 9 的新收藏列表
 */
export function reorderFavorite(favorites: readonly number[], from: number, to: number): readonly number[] {
  const slots = padFavoriteSlots(favorites);
  const source = clampSlotIndex(from);
  const target = clampSlotIndex(to);
  const moved = slots.splice(source, 1)[0];

  slots.splice(target, 0, moved);

  return slots;
}

/**
 * 把旧版「最近使用」文件的任意内容迁移成偏好形状
 *
 * 旧文件只有 `{ tiles: number[] }`：迁移只读出 `recent`（沿用最近使用的归一化口径），
 * `frequent` 与 `favorites` 一律为空。本函数是纯函数，既不读也不删任何文件——
 * 旧文件是否清理由宿主决定，编辑器只做只读迁移。
 * @param raw 旧文件的解析结果
 * @param knownNumbers 图块目录里存在的编号集合
 * @param limit 最近使用的条目上限
 * @returns 迁移后的偏好；旧文件形状不对时为空偏好
 */
export function migrateRecentTiles(
  raw: unknown,
  knownNumbers: ReadonlySet<number>,
  limit: number,
): IMapTilePreferences {
  const tiles = isPlainRecord(raw) ? raw[MAP_RECENT_TILES_KEY] : undefined;

  return {
    recent: normalizeRecentTiles(tiles, knownNumbers, limit),
    favorites: createEmptyFavoriteSlots(),
    frequent: new Map<number, number>(),
  };
}

/**
 * 把次数表写成「数字字符串键 → 次数」的普通对象
 *
 * 只输出正整数编号与有限正数次数；对象以 `Object.create(null)` 创建，因此不带任何原型键。
 * @param counts 次数表
 * @returns 可直接交给 `serializeTableText` 的普通对象
 */
function serializeFrequentCounts(counts: ReadonlyMap<number, number>): Record<string, number> {
  const result: Record<string, number> = Object.create(null);

  for (const [number, count] of counts) {
    if (!isPositiveInteger(number)) continue;
    if (!isPositiveCount(count)) continue;

    result[String(number)] = count;
  }

  return result;
}

/**
 * 把偏好写成可直接序列化的普通对象
 *
 * 只输出 `recent` / `frequent` / `favorites` 三个白名单字段：`recent` 与 `favorites` 复制成新数组，
 * `frequent` 的键一律转成数字字符串；外层对象没有原型，避免把任意输入原样写回。
 * @param preferences 归一化后的偏好
 * @returns 交给 `serializeTableText` 包成文件的对象
 */
export function serializeTilePreferences(preferences: IMapTilePreferences): Record<string, unknown> {
  const result: Record<string, unknown> = Object.create(null);

  result[MAP_TILE_PREFS_RECENT_KEY] = [...preferences.recent];
  result[MAP_TILE_PREFS_FREQUENT_KEY] = serializeFrequentCounts(preferences.frequent);
  result[MAP_TILE_PREFS_FAVORITES_KEY] = [...preferences.favorites];

  return result;
}
