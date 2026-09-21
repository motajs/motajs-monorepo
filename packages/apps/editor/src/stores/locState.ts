/**
 * LocState - 地图选点状态
 *
 * 使用 @tanstack/store 管理当前选中的位置信息，
 * 提供响应式的状态订阅机制。
 */

import { Store } from '@tanstack/store';
import { useStore } from '@tanstack/react-store';

export interface LocPos {
  x: number;
  y: number;
}

export interface LocSelection {
  floorId?: string;
  pos: LocPos;
}

interface LocState {
  /** 当前选中的地图游标 */
  currentSelection: LocSelection | null;
}

/**
 * 地图选点状态 Store
 *
 * 初始值为 null，由地图游标交互更新。
 */
export const locStateStore = new Store<LocState>({
  currentSelection: null,
});

/**
 * 设置当前选中的位置
 *
 * 地图点击和导航通过此入口更新位置游标。
 */
export function setCurrentLocPos(pos: LocPos | null, floorId?: string): void {
  locStateStore.setState((state) => ({
    ...state,
    currentSelection: pos
      ? {
          floorId: floorId ?? state.currentSelection?.floorId,
          pos,
        }
      : null,
  }));
}

/**
 * 更新当前游标所在楼层，保留已选中的坐标。
 */
export function setCurrentLocFloorId(floorId: string): void {
  locStateStore.setState((state) => ({
    ...state,
    currentSelection: state.currentSelection ? { ...state.currentSelection, floorId } : null,
  }));
}

/**
 * 获取当前地图游标 Hook。
 */
export function useCurrentLocSelection(): LocSelection | null {
  return useStore(locStateStore, (state) => state.currentSelection);
}

/**
 * 获取当前地图游标（非 Hook 版本）。
 */
export function getCurrentLocSelection(): LocSelection | null {
  return locStateStore.state.currentSelection;
}
