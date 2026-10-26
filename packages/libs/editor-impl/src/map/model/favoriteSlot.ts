import { MAP_FAVORITE_SLOT_COUNT } from '../constants';

// 数字键到面板槽位的映射只写一次：`1` 是擦除、`2`..`9` 是第 1..8 个收藏位、`0` 是第 9 个收藏位。
// 口径与 `MapPanel.selectFavoriteSlot` 一致：0 表示擦除，1..9 表示从 1 开始的收藏位下标。

/**
 * 把按下的数字键翻译成面板槽位索引
 * @param key 键盘事件的 `key`
 * @returns 0 表示擦除，1..9 表示第 1..9 个收藏位；不是单个数字键时为 undefined
 */
export function resolveFavoriteSlotIndex(key: string): number | undefined {
  if (key.length !== 1 || key < '0' || key > '9') return undefined;
  if (key === '1') return 0;
  if (key === '0') return MAP_FAVORITE_SLOT_COUNT;

  return Number(key) - 1;
}
