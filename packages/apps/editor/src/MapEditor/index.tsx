/**
 * MapEditor - 地图编辑器主组件
 *
 * 整合所有子组件，提供完整的地图编辑功能
 */

import { ContentBoundary } from "@/components/ContentBoundary";
import { useModelResourceSuspense } from "@/hooks/suspense";
import { useSignal } from "@/hooks/useFs";
import { mapCommands, type MapRect, readMapInfo } from "@/project/commands/mapCommands";
import { projectData } from "@/project/data/projectData";
import { type EditorViewport, operationHistory, registerEditorViewportProvider } from "@/project/history";
import {
  captureSchemaCustomizationViewport,
  restoreSchemaCustomizationViewport,
} from "@/components/SchemaTable/schemaCustomizationState";
import { projectModel } from "@/project/model/projectModel";
import type { PrefabInfo } from "@/services/prefab";
import { getCurrentFloorId, setCurrentFloorId, useCurrentFloorId } from "@/stores/editorState";
import { getCurrentLocSelection, setCurrentLocFloorId, setCurrentLocPos } from "@/stores/locState";
import { PanelStore } from "@/stores/PanelStore";
import { getCurrentPrefabSelection, setCurrentPrefabInfo, setCurrentPrefabSelection } from "@/stores/prefabState";
import { useConfigItem } from "@/stores/useEditorConfig";
import type { GridPOD } from "@/utils/coordinate";
import { notifyCommandResult, notifyError, notifySuccess, subscribeNotifications } from "@/utils/notify";
import { cloneDeep } from "es-toolkit";
import { type ComponentProps, type FC, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ContextMenu } from "./ContextMenu";
import { MapCanvas } from "./MapCanvas";
import { MapEditorErrorBoundary } from "./MapEditorErrorBoundary";
import { MapEditorStore } from "./MapEditorStore";
import { MaterialPanel } from "./MaterialPanel";
import type { BlockInfo, SelectedBlock } from "./MaterialPanel/types";
import { RecentlyUsedPanel } from "./RecentlyUsedPanel";
import type { LastUsedItem, SortType } from "./RecentlyUsedPanel";
import { RowColMarks } from "./RowColMarks";
import { ToolBar } from "./ToolBar";

interface MaterialShortcutSlot {
  block: SelectedBlock;
  tileSize: GridPOD;
}

type MaterialShortcutSlots = Record<string, MaterialShortcutSlot>;

const ValidatedRecentlyUsedPanel: FC<ComponentProps<typeof RecentlyUsedPanel>> = (props) => {
  const blockRegistryResource = useMemo(() => projectModel.blockRegistry(), []);
  const blockRegistry = useModelResourceSuspense(blockRegistryResource);
  const tilesetCatalogResource = useMemo(() => projectModel.tilesetCatalog(), []);
  const tilesetCatalog = useModelResourceSuspense(tilesetCatalogResource);
  const validItems = useMemo(() =>
    props.items.flatMap((item) => {
      if (!Number.isInteger(item.idnum) || item.idnum <= 0) return [];
      if (item.idnum < 10000) {
        const block = blockRegistry.get(item.idnum);
        if (!block) return [];
        return [{
          ...item,
          materialPath: block.editorDisplay?.type === "image"
            ? block.materialPath
            : item.materialPath,
          x: block.editorDisplay?.x ?? item.x,
          y: block.editorDisplay?.y ?? item.y,
        }];
      }
      return tilesetCatalog.entries.some((entry) => (
        item.idnum >= entry.startIdnum
        && item.idnum < entry.startIdnum + entry.columns * entry.rows
      )) ? [item] : [];
    }), [blockRegistry, props.items, tilesetCatalog]);

  return <RecentlyUsedPanel {...props} items={validItems} />;
};

const PANEL_SHORTCUTS = {
  z: "map",
  x: "loc",
  c: "enemyitem",
  v: "floor",
} as const;

function shortcutDigit(event: KeyboardEvent): string | null {
  const codeMatch = /^Digit([0-9])$/.exec(event.code);
  if (codeMatch) return codeMatch[1];
  return /^[0-9]$/.test(event.key) ? event.key : null;
}

function isTextEditorTarget(target: EventTarget | null): boolean {
  const hasVisibleEditorOverlay = [
    "#uieventDiv",
    "[data-test-id='event-editor']",
    "[data-test-id='code-editor']",
  ].some((selector) => {
    const element = document.querySelector(selector);
    if (!(element instanceof HTMLElement) || element.getClientRects().length === 0) return false;
    const style = window.getComputedStyle(element);
    return style.display !== "none"
      && style.visibility !== "hidden"
      && Number(style.opacity || 1) > 0
      && style.zIndex !== "-1";
  });
  if (hasVisibleEditorOverlay) return true;
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return true;
  return Boolean(target.closest(".CodeMirror, .blocklyWidgetDiv, .blocklyHtmlInput, #uieventDiv"));
}

function selectionRect(
  area: readonly [readonly [number, number], readonly [number, number]] | null,
  pos: readonly [number, number],
): MapRect {
  const start = area?.[0] ?? pos;
  const end = area?.[1] ?? pos;
  return { x0: start[0], y0: start[1], x1: end[0], y1: end[1] };
}

function toPrefabInfo(block: SelectedBlock | undefined): PrefabInfo | null {
  return block && typeof block === "object" ? { ...block } : null;
}

/**
 * 地图编辑器内部组件（需要 Store Provider）
 */
const MapEditorInner: FC = () => {
  const [tipMessage, setTipMessage] = useState("");
  const [tipClass, setTipClass] = useState("");
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const [lastUsed, setLastUsed] = useConfigItem<LastUsedItem[]>("lastUsed", []);
  const [lastUsedType, setLastUsedType] = useConfigItem<SortType>("lastUsedType", "recent");
  const [materialShortcuts, setMaterialShortcuts] = useConfigItem<MaterialShortcutSlots>("mapMaterialShortcuts", {});
  const [legacyMaterialShortcuts] = useConfigItem<Record<string, SelectedBlock>>("shortcut", {});
  const midRef = useRef<HTMLDivElement>(null);
  const towerResource = useMemo(() => projectData.tower(), []);
  const towerContent = useSignal(towerResource.content);

  const store = MapEditorStore.useStore();
  const {
    activeWorkspace,
    activeMapPanel,
    activeScriptWorkspace,
    activePanel,
    setActivePanel,
    setActiveWorkspace,
    setActiveMapPanel,
    setActiveScriptWorkspace,
  } = PanelStore.useStore();
  const { state } = store;
  const { currentFloorId, selectedBlock } = state;
  const externalFloorId = useCurrentFloorId();

  const discoveredFloorId = towerContent.status === "loaded"
    ? (() => {
      const floorIds = Array.isArray(towerContent.value.main.floorIds)
        ? towerContent.value.main.floorIds
        : [];
      const initialFloorId = towerContent.value.firstData.floorId;
      return typeof initialFloorId === "string" && floorIds.includes(initialFloorId)
        ? initialFloorId
        : floorIds.find((item): item is string => typeof item === "string") ?? "";
    })()
    : "";
  const floorId = currentFloorId || externalFloorId || discoveredFloorId;
  const floorIdRef = useRef(floorId);

  useEffect(() => {
    if (towerContent.status === "idle") void towerResource.ensureLoaded();
  }, [towerContent.status, towerResource]);

  useEffect(() => {
    floorIdRef.current = floorId;
  }, [floorId]);

  useEffect(() => {
    if (externalFloorId && externalFloorId !== currentFloorId) {
      store.setCurrentFloorId(externalFloorId);
    }
  }, [externalFloorId, currentFloorId, store]);

  useEffect(() => {
    if (!currentFloorId && !externalFloorId && discoveredFloorId) {
      store.setCurrentFloorId(discoveredFloorId);
      setCurrentFloorId(discoveredFloorId);
    }
  }, [currentFloorId, discoveredFloorId, externalFloorId, store]);

  useEffect(() => {
    if (floorId) setCurrentLocFloorId(floorId);
  }, [floorId]);

  useEffect(() =>
    registerEditorViewportProvider({
      capture: (): EditorViewport => ({
        activeWorkspace,
        activeMapPanel,
        activeScriptWorkspace,
        activePanel,
        floorId: getCurrentFloorId() || state.currentFloorId,
        map: {
          pos: cloneDeep(state.pos),
          selectedBlock: cloneDeep(state.selectedBlock),
          layer: state.layerMod,
          brush: state.brushMod,
          bigmap: state.bigmap,
          bigmapInfo: cloneDeep(state.bigmapInfo),
          offset: cloneDeep(state.viewportOffset),
          selectedArea: cloneDeep(state.selectedArea),
          tileSize: cloneDeep(state.tileSize),
          showMovable: state.showMovable,
        },
        locSelection: cloneDeep(getCurrentLocSelection()),
        prefabSelection: cloneDeep(getCurrentPrefabSelection()),
        schemaCustomization: captureSchemaCustomizationViewport(),
      }),
      restore: (viewport) => {
        flushSync(() => {
          if (viewport.activeWorkspace) {
            if (viewport.activeMapPanel) setActiveMapPanel(viewport.activeMapPanel);
            if (viewport.activeScriptWorkspace) {
              setActiveScriptWorkspace(viewport.activeScriptWorkspace);
            }
            setActiveWorkspace(viewport.activeWorkspace);
          } else {
            setActivePanel(viewport.activePanel);
          }
          if (viewport.floorId) {
            setCurrentFloorId(viewport.floorId);
            store.setCurrentFloorId(viewport.floorId, { preserveViewport: true });
          }
          store.setPos(cloneDeep(viewport.map.pos));
          store.setSelectedBlock(cloneDeep(viewport.map.selectedBlock));
          store.setLayerMod(viewport.map.layer);
          store.setBrushMod(viewport.map.brush);
          store.setBigmap(viewport.map.bigmap);
          store.setBigmapInfo(cloneDeep(viewport.map.bigmapInfo));
          store.setViewportOffset(cloneDeep(viewport.map.offset));
          store.setSelectedArea(cloneDeep(viewport.map.selectedArea));
          store.setTileSize(cloneDeep(viewport.map.tileSize));
          store.setShowMovable(viewport.map.showMovable);
          store.clearStepPostfix();
          store.clearDragState();
          store.clearBindSpecialDoor();
          if (viewport.locSelection) {
            setCurrentLocPos(
              cloneDeep(viewport.locSelection.pos),
              viewport.locSelection.floorId,
            );
          } else {
            setCurrentLocPos(null);
          }
          setCurrentPrefabSelection(cloneDeep(viewport.prefabSelection));
          restoreSchemaCustomizationViewport(viewport.schemaCustomization);
        });
      },
    }), [
      activeMapPanel,
      activePanel,
      activeScriptWorkspace,
      activeWorkspace,
      setActiveMapPanel,
      setActivePanel,
      setActiveScriptWorkspace,
      setActiveWorkspace,
      state,
      store,
    ]);

  useEffect(() => {
    const handleHistoryShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || isTextEditorTarget(event.target)) return;
      const key = event.key.toLowerCase();
      const isUndo = key === "z" && !event.shiftKey;
      const isRedo = key === "y" || (key === "z" && event.shiftKey);
      if (!isUndo && !isRedo) return;
      event.preventDefault();
      void (isUndo ? operationHistory.undo() : operationHistory.redo()).catch(notifyError);
    };

    window.addEventListener("keydown", handleHistoryShortcut);
    return () => window.removeEventListener("keydown", handleHistoryShortcut);
  }, []);

  useEffect(() => subscribeNotifications(({ level, message }) => {
      setTipMessage(message);
      setTipClass(level === "success" ? "successText" : level === "error" ? "warnText" : "infoText");
    }), []);

  // 处理素材选中变化
  const handleSelectedBlockChange = useCallback(
    (block: SelectedBlock) => {
      store.setSelectedBlock(block);
      setCurrentPrefabInfo(toPrefabInfo(block), "material");
      setActivePanel("enemyitem");
    },
    [store, setActivePanel],
  );

  const handleLocSelect = useCallback(
    (pos: { x: number; y: number }, selectedFloorId: string) => {
      store.setSelectedBlock(undefined);
      setCurrentLocPos(pos, selectedFloorId);
      setActivePanel("loc");
    },
    [store, setActivePanel],
  );

  // 处理右键菜单显示
  const handleContextMenu = useCallback((x: number, y: number) => {
    setContextMenuPos({ x, y });
    setContextMenuVisible(true);
  }, []);

  // 关闭右键菜单
  const handleCloseContextMenu = useCallback(() => {
    setContextMenuVisible(false);
  }, []);

  // 双击选中素材
  const handleDoubleClickSelect = useCallback(
    (block: BlockInfo | 0) => {
      flushSync(() => {
        store.setSelectedBlock(block === 0 ? undefined : block);
        setCurrentPrefabInfo(toPrefabInfo(block), "map");
        setActivePanel("enemyitem");
      });
    },
    [store, setActivePanel],
  );

  // 从右键菜单选中素材
  const handleSelectBlockFromMenu = useCallback(
    (block: BlockInfo | 0) => {
      store.setSelectedBlock(block === 0 ? undefined : block);
      setCurrentPrefabInfo(toPrefabInfo(block), "map");
      setActivePanel("enemyitem");
    },
    [store, setActivePanel],
  );

  // 楼层切换
  const handleFloorChange = useCallback(
    (newFloorId: string) => {
      floorIdRef.current = newFloorId;
      store.setCurrentFloorId(newFloorId);
      setCurrentFloorId(newFloorId);
    },
    [store],
  );

  const handleFloorStep = useCallback((delta: number) => {
    const tower = projectData.tower().value();
    const floorIds = (tower.main.floorIds ?? []).filter((id): id is string => typeof id === "string");
    const current = floorIdRef.current;
    const index = floorIds.indexOf(current);
    const next = floorIds[index + delta];
    if (!next || next === current) return;
    floorIdRef.current = next;
    store.pushRecentFloor(current);
    store.setCurrentFloorId(next);
    setCurrentFloorId(next);
    setCurrentLocFloorId(next);
  }, [store]);

  useEffect(() => {
    const mid = midRef.current;
    if (!mid) return undefined;

    const handleWheel = (event: globalThis.WheelEvent) => {
      event.preventDefault();
      if (event.deltaY === 0) return;
      handleFloorStep(event.deltaY > 0 ? 1 : -1);
    };

    mid.addEventListener("wheel", handleWheel, { passive: false });
    return () => mid.removeEventListener("wheel", handleWheel);
  }, [handleFloorStep]);

  useEffect(() => {
    const handleMapShortcut = (event: KeyboardEvent) => {
      if (activeWorkspace !== "map") return;
      if (isTextEditorTarget(event.target)) return;
      const key = event.key.toLowerCase();
      const commandKey = event.ctrlKey || event.metaKey;

      if (event.key === "PageUp" || event.key === "PageDown") {
        event.preventDefault();
        handleFloorStep(event.key === "PageUp" ? 1 : -1);
        return;
      }

      if (commandKey && ["c", "x", "v"].includes(key) && state.selectedBlock === undefined) {
        event.preventDefault();
        const rect = selectionRect(state.selectedArea, state.pos);
        if (key === "v") {
          if (!state.copiedInfo) {
            notifyError("没有复制的事件");
            return;
          }
          void mapCommands.pasteInfo({
            floorId,
            layer: state.layerMod,
            pos: { x: state.pos[0], y: state.pos[1] },
            info: state.copiedInfo,
          }).then((result) => notifyCommandResult(result, "粘贴事件成功"));
          return;
        }
        const floor = projectData.floor(floorId).value() as unknown as Record<string, unknown>;
        const copied = readMapInfo(floor, state.layerMod, rect);
        store.setCopiedInfo(copied as typeof state.copiedInfo);
        if (key === "c") {
          notifySuccess("地图区域已复制");
          return;
        }
        void mapCommands.clearArea(floorId, state.layerMod, rect).then((result) => (
          notifyCommandResult(result, "地图区域已剪切")
        ));
        return;
      }

      if (event.key === "Delete" && state.selectedBlock === undefined) {
        event.preventDefault();
        void mapCommands.clearArea(
          floorId,
          state.layerMod,
          selectionRect(state.selectedArea, state.pos),
        ).then((result) => notifyCommandResult(result, "地图区域已删除"));
        return;
      }

      if (event.key === "Escape") {
        setContextMenuVisible(false);
        store.setSelectedBlock(undefined);
        store.setSelectedArea(null);
        store.setTileSize([1, 1]);
        return;
      }

      if (commandKey || event.altKey) return;
      const digit = shortcutDigit(event);
      if (digit !== null) {
        event.preventDefault();
        const legacyKey = String(digit.charCodeAt(0));
        const slot = materialShortcuts[digit]
          ?? (legacyMaterialShortcuts[legacyKey] !== undefined
            ? { block: legacyMaterialShortcuts[legacyKey], tileSize: [1, 1] as GridPOD }
            : undefined);
        if (!slot) {
          store.setSelectedBlock(undefined);
          setCurrentPrefabSelection(null);
          return;
        }
        const block = cloneDeep(slot.block);
        store.setSelectedBlock(block);
        store.setTileSize(cloneDeep(slot.tileSize));
        setCurrentPrefabInfo(toPrefabInfo(block), "material");
        setActivePanel("enemyitem");
        return;
      }
      const panel = PANEL_SHORTCUTS[key as keyof typeof PANEL_SHORTCUTS];
      if (panel) {
        event.preventDefault();
        setActivePanel(panel);
        return;
      }
      if (key === "w") store.moveViewport(0, -1);
      else if (key === "a") store.moveViewport(-1, 0);
      else if (key === "s") store.moveViewport(0, 1);
      else if (key === "d") store.moveViewport(1, 0);
      else if (key === "f") store.toggleBigmap();
      else return;
      event.preventDefault();
    };

    window.addEventListener("keydown", handleMapShortcut);
    return () => window.removeEventListener("keydown", handleMapShortcut);
  }, [
    activeWorkspace,
    floorId,
    handleFloorStep,
    legacyMaterialShortcuts,
    materialShortcuts,
    setActivePanel,
    state,
    store,
  ]);

  useEffect(() => {
    const handleMaterialShortcutSave = (event: KeyboardEvent) => {
      if (activeWorkspace !== "map") return;
      if (!event.altKey || event.ctrlKey || event.metaKey || isTextEditorTarget(event.target)) return;
      const digit = shortcutDigit(event);
      if (digit === null) return;
      event.preventDefault();
      if (state.selectedBlock === undefined) {
        notifyError("请先选择一个素材");
        return;
      }
      setMaterialShortcuts({
        ...materialShortcuts,
        [digit]: {
          block: cloneDeep(state.selectedBlock),
          tileSize: cloneDeep(state.tileSize),
        },
      });
      notifySuccess(`已保存快捷素材，按数字键 ${digit} 使用`);
    };
    window.addEventListener("keydown", handleMaterialShortcutSave);
    return () => window.removeEventListener("keydown", handleMaterialShortcutSave);
  }, [activeWorkspace, materialShortcuts, setMaterialShortcuts, state.selectedBlock, state.tileSize]);

  // 最近使用面板的选中回调
  const handleRecentlyUsedSelect = useCallback(
    (item: LastUsedItem) => {
      const block: BlockInfo = {
        idnum: item.idnum,
        id: item.id,
        images: item.images,
        y: item.y,
        x: item.x,
        isTile: item.isTile,
        materialPath: item.materialPath,
      };
      store.setSelectedBlock(block);
      setCurrentPrefabInfo(toPrefabInfo(block), "material");
      setActivePanel("enemyitem");
    },
    [store, setActivePanel],
  );

  const handlePaintSuccess = useCallback((block: BlockInfo) => {
    if (!Number.isInteger(block.idnum) || block.idnum <= 0) return;
    const now = Date.now();
    const existing = lastUsed.find((item) => item.idnum === block.idnum);
    const next: LastUsedItem = {
      idnum: block.idnum,
      id: block.id,
      images: block.images,
      x: block.x ?? 0,
      y: block.y,
      isTile: block.isTile,
      materialPath: block.materialPath,
      recent: now,
      frequent: (existing?.frequent ?? 0) + 1,
      istop: existing?.istop,
    };
    setLastUsed([...lastUsed.filter((item) => item.idnum !== block.idnum), next]);
  }, [lastUsed, setLastUsed]);

  return (
    <>
      <div ref={midRef} id="mid" data-test-id="map-editor-mid">
        {/* 行列标记 */}
        <RowColMarks />

        {/* 地图编辑区 */}
        {floorId
          ? (
            <ContentBoundary loadingUI={<div className="map" id="mapEdit" />}>
              <MapCanvas
                floorId={floorId}
                onContextMenu={handleContextMenu}
                onDoubleClickSelect={handleDoubleClickSelect}
                onLocSelect={handleLocSelect}
                onPaintSuccess={handlePaintSuccess}
              />
            </ContentBoundary>
          )
          : <div className="map" id="mapEdit" data-test-id="map-canvas-unavailable" />}

        {/* 工具栏 */}
        {floorId
          ? (
            <ContentBoundary key={`tools:${floorId}`} loadingUI={<div className="tools" />}>
              <ToolBar
                floorId={floorId}
                tipMessage={tipMessage}
                tipClass={tipClass}
                onFloorChange={handleFloorChange}
              />
            </ContentBoundary>
          )
          : <div className="tools" />}
      </div>

      {/* 最近使用面板 */}
      <ContentBoundary loadingUI={<></>}>
        <ValidatedRecentlyUsedPanel
          items={lastUsed}
          selectedIdnum={typeof selectedBlock === "object" ? selectedBlock.idnum : undefined}
          sortType={lastUsedType}
          onSortTypeChange={setLastUsedType}
          onSelect={handleRecentlyUsedSelect}
          onToggleTop={(item, istop) =>
            setLastUsed(lastUsed.map((one) => (
              one.idnum === item.idnum ? { ...one, istop: istop ? 1 : 0 } : one
            )))}
          onClear={() => setLastUsed([])}
        />
      </ContentBoundary>

      {/* 素材面板 */}
      <ContentBoundary loadingUI={<></>}>
        <MaterialPanel
          selectedBlock={selectedBlock}
          onSelectedBlockChange={handleSelectedBlockChange}
          onTileSizeChange={store.setTileSize}
        />
      </ContentBoundary>

      {/* 右键菜单 */}
      {floorId && (
        <ContentBoundary key={`context-menu:${floorId}`} loadingUI={<></>}>
          <ContextMenu
            floorId={floorId}
            visible={contextMenuVisible}
            x={contextMenuPos.x}
            y={contextMenuPos.y}
            onClose={handleCloseContextMenu}
            onSelectBlock={handleSelectBlockFromMenu}
            onSelectLoc={handleLocSelect}
          />
        </ContentBoundary>
      )}
    </>
  );
};

/**
 * MapEditor 导出组件
 *
 * Store Provider 位于 Workbench，供地图画布和同级楼层面板共享导航状态。
 */
export const MapEditor: FC = () => (
  <MapEditorErrorBoundary>
    <MapEditorInner />
  </MapEditorErrorBoundary>
);

export default MapEditor;
