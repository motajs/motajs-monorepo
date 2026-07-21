import { Activity, lazy, Suspense, useEffect, useState, type FC, type ReactNode } from "react";
import { AppTopBar } from "./AppTopBar";
import { PanelSlot } from "./components/PanelSlot";
import { MapPanel } from "./MapPanel";
import { LocPanel } from "./LocPanel";
import { PrefabPanel } from "./PrefabPanel";
import { FloorPanel } from "./FloorPanel";
import { TowerPanel } from "./TowerPanel";
import { EventsEditor } from "./EventsEditor";
import { MapEditor } from "@/MapEditor";
import { MapEditorStore } from "@/MapEditor/MapEditorStore";
import { projectData } from "@/project/data/projectData";
import {
  PanelStore,
  type MapPanelId,
  type WorkspaceId,
} from "@/stores/PanelStore";
import { ContentBoundary } from "@/components/ContentBoundary";
import { PanelErrorBoundary } from "./components/PanelErrorBoundary";
import { ResourcesWorkspace } from "./ResourcesWorkspace";
import { CommonEventsWorkspace } from "./CommonEventsWorkspace";
import { useCodeEditorHostRequested } from "./CodeEditor/CodeEditorContext";
import { shouldWarnBeforeWorkspaceUnload } from "./draftGuard";
import { migrateLegacyAirwall } from "@/project/migrations";
import { notifyError, notifySuccess } from "@/utils/notify";
import { useProjectSchemaSuspense } from "@/components/SchemaTable";
import { floorSchemaDefinition } from "@/components/SchemaTable/builtinSchemas";
import { scheduleMonacoPreload } from "./monacoPreload";

const MAP_PANELS: Array<{
  id: MapPanelId;
  label: string;
  shortcut: string;
}> = [
  { id: "map", label: "楼层列表", shortcut: "Z" },
  { id: "loc", label: "地图选点", shortcut: "X" },
  { id: "enemyitem", label: "图块属性", shortcut: "C" },
  { id: "floor", label: "楼层属性", shortcut: "V" },
];

const LazyCodeEditor = lazy(() => import("./CodeEditor").then((module) => ({ default: module.CodeEditor })));

const DeferredScriptsWorkspace: FC = () => {
  const { activeWorkspace } = PanelStore.useStore();
  const [Surface, setSurface] = useState<FC>();
  useEffect(() => {
    if (activeWorkspace !== "scripts" || Surface) return;
    let live = true;
    void import("./ScriptsWorkspace").then((module) => {
      if (live) setSurface(() => module.ScriptsWorkspace);
    });
    return () => { live = false; };
  }, [activeWorkspace, Surface]);
  if (Surface) return <Surface />;
  return activeWorkspace === "scripts" ? <div className="scriptEmpty">正在加载代码编辑器…</div> : null;
};

const DeferredCodeEditor: FC = () => {
  const requested = useCodeEditorHostRequested();
  return requested ? <Suspense fallback={null}><LazyCodeEditor /></Suspense> : null;
};

const MapPanelTabs: FC = () => {
  const { activeMapPanel, setActiveMapPanel } = PanelStore.useStore();

  return (
    <nav className="mapPanelTabs" aria-label="地图编辑面板" role="tablist">
      {MAP_PANELS.map((panel) => (
        <button
          aria-selected={activeMapPanel === panel.id}
          className={activeMapPanel === panel.id ? "mapPanelTab is-active" : "mapPanelTab"}
          data-test-id={`map-panel-tab-${panel.id}`}
          key={panel.id}
          onClick={() => setActiveMapPanel(panel.id)}
          role="tab"
          title={`${panel.label}（${panel.shortcut}）`}
          type="button"
        >
          <span>{panel.label}</span>
          <kbd>{panel.shortcut}</kbd>
        </button>
      ))}
    </nav>
  );
};

const ProjectDataPreloader: FC = () => {
  useEffect(() => {
    void projectData.preloadAll()
      .then(({ failures }) => {
        for (const failure of failures) {
          console.warn(`Failed to preload ${failure.path}`, failure.error);
        }
        return migrateLegacyAirwall();
      })
      .then((result) => {
        if (result.status === "migrated") notifySuccess("已将旧空气墙升级为工程注册图块");
      })
      .catch((error) => {
        console.warn("Failed to preload project data", error);
        notifyError(error);
      });
  }, []);

  return null;
};

const MonacoPreloader: FC = () => {
  useEffect(() => scheduleMonacoPreload(), []);
  return null;
};

const ProjectSchemaBootstrap: FC<{ children: ReactNode }> = ({ children }) => {
  useProjectSchemaSuspense(floorSchemaDefinition);
  return children;
};

const WorkspaceSurface: FC<{
  id: WorkspaceId;
  children: ReactNode;
}> = ({ id, children }) => {
  const { activeWorkspace } = PanelStore.useStore();
  const panelId = id === "common-events"
    ? "commonevent"
    : id === "resources"
      ? "appendpic"
      : id === "scripts" ? "functions" : "tower";
  return (
    <Activity mode={activeWorkspace === id ? "visible" : "hidden"}>
      <main className="workspaceSurface" data-test-id={`workspace-surface-${id}`}>
        <PanelErrorBoundary panelId={panelId}>
          <ContentBoundary loadingUI={<></>}>{children}</ContentBoundary>
        </PanelErrorBoundary>
      </main>
    </Activity>
  );
};

export const Workbench: FC = () => {
  const { activeWorkspace } = PanelStore.useStore();
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!shouldWarnBeforeWorkspaceUnload()) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  return (
    <MapEditorStore.Provider>
      <div className="editorAppShell">
        <ProjectDataPreloader />
        <MonacoPreloader />
        <AppTopBar />
        <ContentBoundary loadingUI={<div className="workspaceSchemaLoading">正在加载表格配置...</div>}>
        <ProjectSchemaBootstrap>
        <div className="editorAppContent">
        <div
          className={activeWorkspace === "map" ? "mapWorkspace" : "mapWorkspace is-inactive"}
          data-test-id="workbench"
        >
          <MapPanelTabs />
          <PanelSlot panelId="map"><MapPanel /></PanelSlot>
          <PanelSlot panelId="loc"><LocPanel /></PanelSlot>
          <PanelSlot panelId="enemyitem"><PrefabPanel /></PanelSlot>
          <PanelSlot panelId="floor"><FloorPanel /></PanelSlot>
          <MapEditor />
        </div>

        <WorkspaceSurface id="resources">
          <ResourcesWorkspace />
        </WorkspaceSurface>
        <WorkspaceSurface id="tower"><TowerPanel /></WorkspaceSurface>
        <WorkspaceSurface id="common-events">
          <CommonEventsWorkspace />
        </WorkspaceSurface>
        <WorkspaceSurface id="scripts"><DeferredScriptsWorkspace /></WorkspaceSurface>

        <EventsEditor />
        <DeferredCodeEditor />
        </div>
        </ProjectSchemaBootstrap>
        </ContentBoundary>
      </div>
    </MapEditorStore.Provider>
  );
};
