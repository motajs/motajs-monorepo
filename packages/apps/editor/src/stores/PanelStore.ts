/**
 * 应用工作区与地图子面板状态。
 *
 * `PanelId` 和 `setActivePanel` 保留为迁移期兼容层：历史记录与少量旧组件
 * 仍然使用旧的九面板命名，但新的应用壳只暴露五个一级工作区。
 */

import { useCallback, useMemo, useState } from 'react';
import { createStore } from '@motajs/react-store';

export type WorkspaceId = 'map' | 'resources' | 'tower' | 'common-events' | 'scripts';

export type MapPanelId = 'map' | 'loc' | 'enemyitem' | 'floor';
export type ScriptWorkspaceId = 'functions' | 'plugins';

export type PanelId = MapPanelId | 'tower' | 'functions' | 'appendpic' | 'commonevent' | 'plugins';

export interface PanelStoreValue {
  activeWorkspace: WorkspaceId;
  activeMapPanel: MapPanelId;
  activeScriptWorkspace: ScriptWorkspaceId;
  /** 旧面板标识的兼容投影。 */
  activePanel: PanelId;
  setActiveWorkspace: (workspace: WorkspaceId) => void;
  setActiveMapPanel: (panel: MapPanelId) => void;
  setActiveScriptWorkspace: (workspace: ScriptWorkspaceId) => void;
  /** 使用旧面板标识导航到对应的新工作区。 */
  setActivePanel: (panel: PanelId) => void;
}

function legacyPanelFor(workspace: WorkspaceId, mapPanel: MapPanelId, scriptWorkspace: ScriptWorkspaceId): PanelId {
  switch (workspace) {
    case 'map':
      return mapPanel;
    case 'resources':
      return 'appendpic';
    case 'tower':
      return 'tower';
    case 'common-events':
      return 'commonevent';
    case 'scripts':
      return scriptWorkspace;
  }
}

function usePanelStore(): PanelStoreValue {
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceId>('map');
  const [activeMapPanel, setActiveMapPanelState] = useState<MapPanelId>('map');
  const [activeScriptWorkspace, setActiveScriptWorkspaceState] = useState<ScriptWorkspaceId>('functions');

  const setActiveMapPanel = useCallback((panel: MapPanelId) => {
    setActiveMapPanelState(panel);
    setActiveWorkspace('map');
  }, []);

  const setActiveScriptWorkspace = useCallback((workspace: ScriptWorkspaceId) => {
    setActiveScriptWorkspaceState(workspace);
    setActiveWorkspace('scripts');
  }, []);

  const setActivePanel = useCallback((panel: PanelId) => {
    switch (panel) {
      case 'map':
      case 'loc':
      case 'enemyitem':
      case 'floor':
        setActiveMapPanelState(panel);
        setActiveWorkspace('map');
        break;
      case 'tower':
        setActiveWorkspace('tower');
        break;
      case 'appendpic':
        setActiveWorkspace('resources');
        break;
      case 'commonevent':
        setActiveWorkspace('common-events');
        break;
      case 'functions':
      case 'plugins':
        setActiveScriptWorkspaceState(panel);
        setActiveWorkspace('scripts');
        break;
    }
  }, []);

  const activePanel = useMemo(
    () => legacyPanelFor(activeWorkspace, activeMapPanel, activeScriptWorkspace),
    [activeMapPanel, activeScriptWorkspace, activeWorkspace],
  );

  return {
    activeWorkspace,
    activeMapPanel,
    activeScriptWorkspace,
    activePanel,
    setActiveWorkspace,
    setActiveMapPanel,
    setActiveScriptWorkspace,
    setActivePanel,
  };
}

export const PanelStore = createStore(usePanelStore);

export function useActivePanel(): PanelId {
  return PanelStore.useStore().activePanel;
}

export function useIsPanelActive(panelId: PanelId): boolean {
  return PanelStore.useStore().activePanel === panelId;
}
