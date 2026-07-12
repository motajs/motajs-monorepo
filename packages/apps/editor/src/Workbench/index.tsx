import { useEffect, type FC } from "react";
import { PanelSlot } from "./components/PanelSlot";
import { MapPanel } from "./MapPanel";
import { AppendPicPanel } from "./AppendPicPanel";
import { LocPanel } from "./LocPanel";
import { PrefabPanel } from "./PrefabPanel";
import { FloorPanel } from "./FloorPanel";
import { TowerPanel } from "./TowerPanel";
import { EventsEditor } from "./EventsEditor";
import { PluginPanel } from "./PluginPanel";
import { CommonEventPanel } from "./CommonEventPanel";
import { FunctionsPanel } from "./FunctionsPanel";
import { CodeEditor } from "./CodeEditor";
import { MapEditor } from "@/MapEditor";
import { projectData } from "@/project/data/projectData";

const ProjectDataPreloader: FC = () => {
  useEffect(() => {
    void projectData.preloadAll()
      .then(({ failures }) => {
        for (const failure of failures) {
          console.warn(`Failed to preload ${failure.path}`, failure.error);
        }
      })
      .catch((error) => {
        console.warn("Failed to preload project data", error);
      });
  }, []);

  return null;
};

export const Workbench: FC = () => {
  return (
    <>
      <ProjectDataPreloader />
      <div className="main" data-test-id="workbench">
        <PanelSlot panelId="map">
          <MapPanel />
        </PanelSlot>
        <PanelSlot panelId="appendpic">
          <AppendPicPanel />
        </PanelSlot>
        <PanelSlot panelId="loc">
          <LocPanel />
        </PanelSlot>
        <PanelSlot panelId="enemyitem">
          <PrefabPanel />
        </PanelSlot>
        <PanelSlot panelId="floor">
          <FloorPanel />
        </PanelSlot>
        <PanelSlot panelId="tower">
          <TowerPanel />
        </PanelSlot>
        <EventsEditor />
        <CodeEditor />
        <PanelSlot panelId="functions">
          <FunctionsPanel />
        </PanelSlot>
        <PanelSlot panelId="commonevent">
          <CommonEventPanel />
        </PanelSlot>
        <PanelSlot panelId="plugins">
          <PluginPanel />
        </PanelSlot>
        <MapEditor />
      </div>
    </>
  );
};
