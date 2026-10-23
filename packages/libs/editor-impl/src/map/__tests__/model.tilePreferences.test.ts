import { describe, expect, it } from 'vitest';
import { MAP_FAVORITE_SLOT_COUNT, MAP_FREQUENT_LIMIT } from '../constants';
import {
  migrateRecentTiles,
  normalizeTilePreferences,
  rankFrequentTiles,
  reorderFavorite,
  serializeTilePreferences,
} from '../model/tilePreferences';

// 图块偏好的用例：坏输入归一化、次数表排序、收藏移位、旧文件迁移与写回形状。
// 输入一律当成「可能被用户或别的工具改坏的文件」处理，不抛错、不落半截数据。

/** 用例共用的「目录里存在」编号集合（故意不含 99） */
const KNOWN_NUMBERS: ReadonlySet<number> = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12]);

/** 用例共用的「允许收藏」编号集合（比目录少 12，用来验证分类过滤） */
const FAVORITE_NUMBERS: ReadonlySet<number> = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

/** 一份 9 格全空的收藏 */
const EMPTY_SLOTS: readonly number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0];

describe('normalizeTilePreferences 的最近使用', () => {
  // 非对象输入整体退化为空偏好，不抛错
  it('非对象输入得到空偏好', () => {
    for (const raw of [null, undefined, 'abc', 42, [1, 2]]) {
      const preferences = normalizeTilePreferences(raw, KNOWN_NUMBERS, FAVORITE_NUMBERS, 24);

      expect(preferences.recent).toEqual([]);
      expect(preferences.frequent.size).toBe(0);
      expect(preferences.favorites).toEqual(EMPTY_SLOTS);
    }
  });

  // recent 不是数组时退化为空数组
  it('recent 不是数组时为空', () => {
    const preferences = normalizeTilePreferences({ recent: 'abc' }, KNOWN_NUMBERS, FAVORITE_NUMBERS, 24);

    expect(preferences.recent).toEqual([]);
  });

  // 0、负数、小数与字符串都被丢掉
  it('recent 丢掉非正整数', () => {
    const preferences = normalizeTilePreferences(
      { recent: [1, -1, 0, 2.5, '3', 2] },
      KNOWN_NUMBERS,
      FAVORITE_NUMBERS,
      24,
    );

    expect(preferences.recent).toEqual([1, 2]);
  });

  // 目录里不存在的编号被丢掉
  it('recent 丢掉目录里不存在的编号', () => {
    const preferences = normalizeTilePreferences({ recent: [1, 99, 2] }, KNOWN_NUMBERS, FAVORITE_NUMBERS, 24);

    expect(preferences.recent).toEqual([1, 2]);
  });

  // 同一编号只留第一次出现的位置
  it('recent 去重并保持顺序', () => {
    const preferences = normalizeTilePreferences({ recent: [3, 1, 3, 2, 1] }, KNOWN_NUMBERS, FAVORITE_NUMBERS, 24);

    expect(preferences.recent).toEqual([3, 1, 2]);
  });

  // 超过上限时丢掉尾部
  it('recent 超过上限截断', () => {
    const preferences = normalizeTilePreferences({ recent: [1, 2, 3, 4, 5] }, KNOWN_NUMBERS, FAVORITE_NUMBERS, 3);

    expect(preferences.recent).toEqual([1, 2, 3]);
  });

  // 上限为 0 时没有可用条目
  it('recent 上限为 0 时为空', () => {
    const preferences = normalizeTilePreferences({ recent: [1, 2] }, KNOWN_NUMBERS, FAVORITE_NUMBERS, 0);

    expect(preferences.recent).toEqual([]);
  });
});

describe('normalizeTilePreferences 的使用次数表', () => {
  // JSON 里的数字字符串键被读成数字键
  it('数字字符串键转成数字键', () => {
    const preferences = normalizeTilePreferences({ frequent: { '12': 3 } }, KNOWN_NUMBERS, FAVORITE_NUMBERS, 24);

    expect([...preferences.frequent.entries()]).toEqual([[12, 3]]);
  });

  // 原型相关键与非十进制写法（`0x10` / `1e1`）一律丢弃：`Number()` 会把它们读成合法编号
  it('原型相关键与非十进制键被丢弃', () => {
    const raw = JSON.parse('{"frequent":{"__proto__":9,"constructor":4,"abc":2,"0x10":5,"1e1":6,"12":3}}');
    const preferences = normalizeTilePreferences(raw, KNOWN_NUMBERS, FAVORITE_NUMBERS, 24);

    expect([...preferences.frequent.entries()]).toEqual([[12, 3]]);
  });

  // 原型键不会污染全局对象原型
  it('不污染对象原型', () => {
    const raw = JSON.parse('{"frequent":{"__proto__":{"polluted":true}}}');
    normalizeTilePreferences(raw, KNOWN_NUMBERS, FAVORITE_NUMBERS, 24);

    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  // 0、负数与非数字的次数被丢弃
  it('非法次数被丢弃', () => {
    const preferences = normalizeTilePreferences(
      { frequent: { '1': 0, '2': -3, '3': 'x', '5': 2 } },
      KNOWN_NUMBERS,
      FAVORITE_NUMBERS,
      24,
    );

    expect([...preferences.frequent.entries()]).toEqual([[5, 2]]);
  });

  // 目录里不存在的编号即使有次数也被丢弃
  it('目录里不存在的编号被丢弃', () => {
    const preferences = normalizeTilePreferences(
      { frequent: { '12': 3, '99': 5 } },
      KNOWN_NUMBERS,
      FAVORITE_NUMBERS,
      24,
    );

    expect([...preferences.frequent.entries()]).toEqual([[12, 3]]);
  });

  // 超大次数表按次数保留前 MAP_FREQUENT_LIMIT 条，避免被一个巨型文件拖垮
  it('超过存储上限时只留次数最高的条目', () => {
    const numbers: Set<number> = new Set();
    const frequent: Record<string, number> = {};

    for (let number = 1; number <= 300; number += 1) {
      numbers.add(number);
      frequent[String(number)] = number;
    }

    const preferences = normalizeTilePreferences({ frequent }, numbers, FAVORITE_NUMBERS, 24);
    const kept: number[] = [...preferences.frequent.keys()];

    expect(preferences.frequent.size).toBe(MAP_FREQUENT_LIMIT);
    expect(Math.min(...kept)).toBe(101);
    expect(preferences.frequent.has(300)).toBe(true);
    expect(preferences.frequent.has(1)).toBe(false);
  });
});

describe('normalizeTilePreferences 的收藏', () => {
  // 收藏恒为 9 格，不足补 0
  it('不足 9 格补 0', () => {
    const preferences = normalizeTilePreferences({ favorites: [1, 2] }, KNOWN_NUMBERS, FAVORITE_NUMBERS, 24);

    expect(preferences.favorites).toEqual([1, 2, 0, 0, 0, 0, 0, 0, 0]);
    expect(preferences.favorites).toHaveLength(MAP_FAVORITE_SLOT_COUNT);
  });

  // 超过 9 格的部分被截断
  it('超过 9 格截断', () => {
    const preferences = normalizeTilePreferences(
      { favorites: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12] },
      KNOWN_NUMBERS,
      FAVORITE_NUMBERS,
      24,
    );

    expect(preferences.favorites).toHaveLength(MAP_FAVORITE_SLOT_COUNT);
    expect(preferences.favorites).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  // 目录里有但不允许收藏的编号（Tileset 一类）被置 0
  it('不允许收藏的编号置 0', () => {
    const preferences = normalizeTilePreferences({ favorites: [1, 12, 2] }, KNOWN_NUMBERS, FAVORITE_NUMBERS, 24);

    expect(preferences.favorites).toEqual([1, 0, 2, 0, 0, 0, 0, 0, 0]);
  });

  // 同一编号第二次起置 0，只保留第一次出现的位置
  it('重复编号第二次起置 0', () => {
    const preferences = normalizeTilePreferences({ favorites: [1, 1, 2] }, KNOWN_NUMBERS, FAVORITE_NUMBERS, 24);

    expect(preferences.favorites).toEqual([1, 0, 2, 0, 0, 0, 0, 0, 0]);
  });

  // favorites 不是数组时是 9 个 0
  it('favorites 不是数组时是 9 个 0', () => {
    const preferences = normalizeTilePreferences({ favorites: 'abc' }, KNOWN_NUMBERS, FAVORITE_NUMBERS, 24);

    expect(preferences.favorites).toEqual(EMPTY_SLOTS);
  });
});

describe('rankFrequentTiles', () => {
  // 次数降序，同次数按编号升序
  it('次数降序、同次数编号升序', () => {
    const counts: ReadonlyMap<number, number> = new Map([
      [3, 5],
      [1, 5],
      [2, 9],
    ]);

    expect(rankFrequentTiles(counts, 24)).toEqual([2, 1, 3]);
  });

  // 超过上限时截断
  it('超过上限截断', () => {
    const counts: ReadonlyMap<number, number> = new Map([
      [1, 1],
      [2, 2],
      [3, 3],
    ]);

    expect(rankFrequentTiles(counts, 2)).toEqual([3, 2]);
  });

  // 上限为 0 或空表时为空
  it('上限为 0 或空表时为空', () => {
    const counts: ReadonlyMap<number, number> = new Map([[1, 3]]);

    expect(rankFrequentTiles(counts, 0)).toEqual([]);
    expect(rankFrequentTiles(new Map(), 24)).toEqual([]);
  });

  // 非法次数不进入结果
  it('非法次数不进入结果', () => {
    const counts: ReadonlyMap<number, number> = new Map([
      [1, 0],
      [2, 3],
      [3, -1],
    ]);

    expect(rankFrequentTiles(counts, 24)).toEqual([2]);
  });
});

describe('reorderFavorite', () => {
  // 把索引 1 移到 4，其余元素顺序保持
  it('把索引 1 移到 4', () => {
    expect(reorderFavorite([1, 2, 3, 4, 5, 6, 7, 8, 9], 1, 4)).toEqual([1, 3, 4, 5, 2, 6, 7, 8, 9]);
  });

  // 越界的目标索引被夹到最后一格
  it('目标索引越界时夹取', () => {
    expect(reorderFavorite([1, 2, 3, 4, 5, 6, 7, 8, 9], 1, 100)).toEqual([1, 3, 4, 5, 6, 7, 8, 9, 2]);
  });

  // 越界的来源索引被夹到第一格
  it('来源索引越界时夹取', () => {
    expect(reorderFavorite([1, 2, 3, 4, 5, 6, 7, 8, 9], -3, 8)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 1]);
  });

  // 不足 9 格先补齐再移动，返回的数组长度仍是 9
  it('不足 9 格先补齐', () => {
    const result = reorderFavorite([1, 2], 1, 4);

    expect(result).toHaveLength(MAP_FAVORITE_SLOT_COUNT);
    expect(result).toEqual([1, 0, 0, 0, 2, 0, 0, 0, 0]);
  });

  // 返回新数组，入参不被改动
  it('返回新数组且不改动入参', () => {
    const input: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const result = reorderFavorite(input, 0, 8);

    expect(result).not.toBe(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(result).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 1]);
  });
});

describe('migrateRecentTiles', () => {
  // 旧文件的 { tiles } 只读迁移成 recent：重复、空位与目录外编号都丢掉
  it('旧文件迁移成最近使用', () => {
    const preferences = migrateRecentTiles({ tiles: [3, 1, 3, 0, 99] }, KNOWN_NUMBERS, 24);

    expect(preferences.recent).toEqual([3, 1]);
    expect(preferences.frequent.size).toBe(0);
    expect(preferences.favorites).toEqual(EMPTY_SLOTS);
  });

  // 旧文件不是对象、或 tiles 不是数组时都返回空偏好
  it('畸形旧文件得到空偏好', () => {
    for (const raw of [null, 'abc', [], {}, { tiles: 'abc' }, { recent: [1] }]) {
      const preferences = migrateRecentTiles(raw, KNOWN_NUMBERS, 24);

      expect(preferences.recent).toEqual([]);
      expect(preferences.frequent.size).toBe(0);
      expect(preferences.favorites).toEqual(EMPTY_SLOTS);
    }
  });

  // 迁移不改动读到的旧内容（纯函数、不执行任何文件操作）
  it('不改动传入的旧内容', () => {
    const raw = { tiles: [3, 1] };
    const snapshot = JSON.stringify(raw);

    migrateRecentTiles(raw, KNOWN_NUMBERS, 24);

    expect(JSON.stringify(raw)).toBe(snapshot);
  });
});

describe('serializeTilePreferences', () => {
  // 写回形状只包含 recent / frequent / favorites 三个字段
  it('只输出三个字段', () => {
    const preferences = normalizeTilePreferences(
      { recent: [3], frequent: { '12': 2 }, favorites: [1] },
      KNOWN_NUMBERS,
      FAVORITE_NUMBERS,
      24,
    );
    const serialized = serializeTilePreferences(preferences);

    expect(Object.keys(serialized).sort()).toEqual(['favorites', 'frequent', 'recent']);
    expect(serialized.recent).toEqual([3]);
    expect(serialized.favorites).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(JSON.stringify(serialized)).toBe('{"recent":[3],"frequent":{"12":2},"favorites":[1,0,0,0,0,0,0,0,0]}');
  });

  // 次数表的键是数字字符串，写出的 JSON 里没有原型相关键
  it('次数键是数字字符串且不含原型键', () => {
    const raw = JSON.parse('{"frequent":{"__proto__":9,"12":2}}');
    const preferences = normalizeTilePreferences(raw, KNOWN_NUMBERS, FAVORITE_NUMBERS, 24);
    const text = JSON.stringify(serializeTilePreferences(preferences));

    expect(text).toContain('"12":2');
    expect(text).not.toContain('__proto__');
    expect(text).not.toContain('constructor');
  });

  // 写回后再归一化一轮，结果与写回前等价
  it('写回后往返稳定', () => {
    const preferences = normalizeTilePreferences(
      { recent: [3, 1], frequent: { '12': 2, '5': 7 }, favorites: [1, 2, 0] },
      KNOWN_NUMBERS,
      FAVORITE_NUMBERS,
      24,
    );
    const text = JSON.stringify(serializeTilePreferences(preferences));
    const reparsed = normalizeTilePreferences(JSON.parse(text), KNOWN_NUMBERS, FAVORITE_NUMBERS, 24);

    expect(reparsed.recent).toEqual(preferences.recent);
    expect(reparsed.favorites).toEqual(preferences.favorites);
    expect(reparsed.frequent.size).toBe(preferences.frequent.size);

    for (const [number, count] of preferences.frequent) expect(reparsed.frequent.get(number)).toBe(count);
  });
});
