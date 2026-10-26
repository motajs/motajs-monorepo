import { describe, expect, it } from 'vitest';
import { MAP_FAVORITE_SLOT_COUNT } from '../constants';
import { resolveFavoriteSlotIndex } from '../model/favoriteSlot';

// 数字键映射的纯函数用例：`1` 是擦除、`2`..`9` 是第 1..8 个收藏位、`0` 是第 9 个收藏位，其余按键不参与。

describe('resolveFavoriteSlotIndex', () => {
  // `1` 固定映射到擦除（槽位 0）
  it('1 映射到擦除', () => {
    expect(resolveFavoriteSlotIndex('1')).toBe(0);
  });

  // `2`..`9` 依次映射到第 1..8 个收藏位
  it('2..9 映射到第 1..8 个收藏位', () => {
    for (let key = 2; key <= 9; key += 1) {
      expect(resolveFavoriteSlotIndex(String(key))).toBe(key - 1);
    }
  });

  // `0` 映射到第 9 个收藏位，与收藏格角标口径一致
  it('0 映射到第 9 个收藏位', () => {
    expect(resolveFavoriteSlotIndex('0')).toBe(MAP_FAVORITE_SLOT_COUNT);
  });

  // 非单字符数字的按键一律返回 undefined
  it('其它按键返回 undefined', () => {
    expect(resolveFavoriteSlotIndex('ArrowRight')).toBeUndefined();
    expect(resolveFavoriteSlotIndex('a')).toBeUndefined();
    expect(resolveFavoriteSlotIndex('')).toBeUndefined();
    expect(resolveFavoriteSlotIndex('10')).toBeUndefined();
  });
});
