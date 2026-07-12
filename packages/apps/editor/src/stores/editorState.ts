/**
 * EditorState - 编辑器全局状态
 *
 * 使用 @tanstack/store 管理编辑器的全局状态，
 * 提供响应式的状态订阅机制。
 */

import { Store } from '@tanstack/store';
import { useStore } from '@tanstack/react-store';

interface EditorState {
  currentFloorId?: string;
}

/**
 * 编辑器状态 Store
 *
 * 楼层由工程数据和现代导航流程显式设置。
 */
export const editorStateStore = new Store<EditorState>({
  currentFloorId: undefined,
});

/**
 * 更新当前楼层 ID
 */
export function setCurrentFloorId(floorId: string): void {
  editorStateStore.setState((state) => ({
    ...state,
    currentFloorId: floorId,
  }));
}

/**
 * 获取当前楼层 ID 的 Hook
 *
 * 自动订阅状态变化，当 currentFloorId 变化时触发重渲染
 */
export function useCurrentFloorId(): string | undefined {
  return useStore(editorStateStore, (state) => state.currentFloorId);
}

/**
 * 获取当前楼层 ID（非 Hook，用于回调函数中）
 *
 * 直接读取 store 当前值，不触发重渲染
 */
export function getCurrentFloorId(): string | undefined {
  return editorStateStore.state.currentFloorId;
}
