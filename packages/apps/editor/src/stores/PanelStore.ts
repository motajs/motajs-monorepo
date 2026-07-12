/**
 * PanelStore - 面板状态管理
 *
 * 管理左侧面板的激活状态，控制哪个面板当前可见。
 */

import { useState } from 'react';
import { createStore } from '@/utils/store/store';

/**
 * 面板 ID 类型
 * 与 editModeSelect 的 value 保持一致
 */
export type PanelId =
  | 'map'
  | 'loc'
  | 'enemyitem'
  | 'floor'
  | 'tower'
  | 'functions'
  | 'appendpic'
  | 'commonevent'
  | 'plugins';

interface PanelStoreValue {
  /** 当前激活的面板 */
  activePanel: PanelId;
  /** 设置激活面板 */
  setActivePanel: (panelId: PanelId) => void;
}

/**
 * 面板状态 Hook
 * 默认显示全塔属性面板
 */
function usePanelStore(): PanelStoreValue {
  const [activePanel, setActivePanel] = useState<PanelId>('tower');

  return {
    activePanel,
    setActivePanel,
  };
}

/**
 * 面板状态 Store
 */
export const PanelStore = createStore(usePanelStore);

/**
 * 获取当前激活面板的 Hook
 */
export function useActivePanel(): PanelId {
  return PanelStore.useStore().activePanel;
}

/**
 * 判断指定面板是否激活的 Hook
 */
export function useIsPanelActive(panelId: PanelId): boolean {
  return PanelStore.useStore().activePanel === panelId;
}
