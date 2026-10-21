import { describe, expect, it } from 'vitest';
import { normalizeRecentTiles, updateRecentTiles } from '../model/recentTiles';

// 最近使用列表的用例：坏输入、未知编号、去重、截断，以及置顶更新。

/** 用例共用的「目录里存在」编号集合 */
const KNOWN_NUMBERS: ReadonlySet<number> = new Set([1, 2, 3, 4, 5]);

describe('normalizeRecentTiles', () => {
  // 非数组输入一律退化为空数组，不抛错
  it('非法输入得到空数组', () => {
    expect(normalizeRecentTiles(null, KNOWN_NUMBERS, 24)).toEqual([]);
    expect(normalizeRecentTiles('abc', KNOWN_NUMBERS, 24)).toEqual([]);
    expect(normalizeRecentTiles({ tiles: [1] }, KNOWN_NUMBERS, 24)).toEqual([]);
    expect(normalizeRecentTiles(42, KNOWN_NUMBERS, 24)).toEqual([]);
    expect(normalizeRecentTiles(undefined, KNOWN_NUMBERS, 24)).toEqual([]);
  });

  // 负数、0 与小数被过滤，只留正整数
  it('非正整数被过滤', () => {
    expect(normalizeRecentTiles([1, -1, 0, 2.5, 2], KNOWN_NUMBERS, 24)).toEqual([1, 2]);
  });

  // 目录里不存在的编号被丢弃
  it('目录里不存在的编号被丢弃', () => {
    expect(normalizeRecentTiles([1, 9, 2], KNOWN_NUMBERS, 24)).toEqual([1, 2]);
  });

  // 同一编号只留第一次出现的位置，保持原顺序
  it('去重并保持顺序', () => {
    expect(normalizeRecentTiles([3, 1, 3, 2, 1], KNOWN_NUMBERS, 24)).toEqual([3, 1, 2]);
  });

  // 超过上限时丢弃尾部（最早的记录）
  it('超过上限时丢掉尾部', () => {
    expect(normalizeRecentTiles([1, 2, 3, 4, 5], KNOWN_NUMBERS, 3)).toEqual([1, 2, 3]);
  });

  // 上限为 0 时没有可用条目
  it('上限为 0 时得到空数组', () => {
    expect(normalizeRecentTiles([1, 2], KNOWN_NUMBERS, 0)).toEqual([]);
  });
});

describe('updateRecentTiles', () => {
  // 已在列表里的编号被移到首位，且不会重复
  it('把已有编号移到首位且不重复', () => {
    expect(updateRecentTiles([1, 2, 3], 2, 24)).toEqual([2, 1, 3]);
  });

  // 新编号直接插到首位
  it('新编号插到首位', () => {
    expect(updateRecentTiles([1, 2, 3], 4, 24)).toEqual([4, 1, 2, 3]);
  });

  // 非正整数不改变列表
  it('非正整数不改变列表', () => {
    const list = [1, 2, 3];

    expect(updateRecentTiles(list, 0, 24)).toBe(list);
    expect(updateRecentTiles(list, -2, 24)).toBe(list);
    expect(updateRecentTiles(list, 1.5, 24)).toBe(list);
  });

  // 更新后仍按上限截断
  it('更新后按上限截断', () => {
    expect(updateRecentTiles([1, 2, 3], 4, 2)).toEqual([4, 1]);
  });
});
