/**
 * PrefabState - 图块选择状态
 *
 * 使用 @tanstack/store 管理当前选中的图块信息，
 * 提供响应式的状态订阅机制。
 */

import { Store } from '@tanstack/store';
import { useStore } from '@tanstack/react-store';
import type { PrefabInfo } from '@/services/prefab';

export type PrefabSelectionSource = 'material' | 'map';

export interface PrefabSelection {
  info: PrefabInfo;
  source: PrefabSelectionSource;
}

interface PrefabState {
  /** 当前选中的图块游标 */
  currentSelection: PrefabSelection | null;
}

/**
 * 图块状态 Store
 *
 * 初始值为 null，由素材或地图游标交互更新。
 */
export const prefabStateStore = new Store<PrefabState>({
  currentSelection: null,
});

export function setCurrentPrefabSelection(selection: PrefabSelection | null): void {
  prefabStateStore.setState((state) => ({
    ...state,
    currentSelection: selection,
  }));
}

/**
 * 设置当前选中的图块信息
 *
 * 素材和地图选择通过此入口更新 prefab 游标。
 */
export function setCurrentPrefabInfo(info: PrefabInfo | null, source: PrefabSelectionSource): void {
  prefabStateStore.setState((state) => ({
    ...state,
    currentSelection: info ? { info, source } : null,
  }));
}

export function useCurrentPrefabSelection(): PrefabSelection | null {
  return useStore(prefabStateStore, (state) => state.currentSelection);
}

export function getCurrentPrefabSelection(): PrefabSelection | null {
  return prefabStateStore.state.currentSelection;
}
