/**
 * MapEditor 状态管理
 *
 * 使用 createStore 管理地图编辑器的交互状态
 */

import { useState, useCallback } from "react";
import { createStore } from "@motajs/react-store";
import type { LocPOD, GridPOD, RectPOD } from "@/utils/coordinate";
import type { SelectedBlock, BlockInfo } from "./MaterialPanel/types";

/** 图层模式 */
export type LayerMod = "map" | "bgmap" | "fgmap";

/** 画笔模式 */
export type BrushMod = "line" | "rectangle" | "tileset" | "fill";

/** 复制的位置信息 */
export interface CopiedInfo {
  /** 宽度 */
  w: number;
  /** 高度 */
  h: number;
  /** 来源图层 */
  layer: LayerMod;
  /** 数据 */
  data: Array<{
    map: BlockInfo | 0;
    events: Record<string, unknown>;
  }>;
}

/** 机关门绑定状态 */
export interface BindSpecialDoorState {
  /** 机关门位置 */
  loc: string | null;
  /** 绑定的怪物位置列表 */
  enemys: string[];
  /** 需要绑定的怪物数量 */
  n: number;
}

/** MapEditor Store 状态 */
export interface MapEditorState {
  /** 当前楼层 ID */
  currentFloorId: string;
  /** 当前选中坐标 */
  pos: LocPOD;
  /** 当前悬停坐标（用于行列标记高亮） */
  hoverPos: LocPOD | null;
  /** 当前选中素材 */
  selectedBlock: SelectedBlock | undefined;
  /** 当前编辑图层 */
  layerMod: LayerMod;
  /** 画笔模式 */
  brushMod: BrushMod;
  /** 是否大地图模式 */
  bigmap: boolean;
  /** 大地图信息 */
  bigmapInfo: { top: number; left: number; size: number };
  /** 视口偏移 */
  viewportOffset: LocPOD;
  /** 视口允许的最大偏移 */
  viewportBounds: LocPOD;
  /** 是否正在绘制 */
  holdingPath: boolean;
  /** 绘制路径点队列 */
  stepPostfix: LocPOD[];
  /** 拖拽起点 */
  startPos: LocPOD | null;
  /** 拖拽终点 */
  endPos: LocPOD | null;
  /** 选中区域 */
  selectedArea: RectPOD | null;
  /** 复制的数据 */
  copiedInfo: CopiedInfo | null;
  /** tileset 尺寸 */
  tileSize: GridPOD;
  /** 是否显示通行度 */
  showMovable: boolean;
  /** 机关门绑定状态 */
  bindSpecialDoor: BindSpecialDoorState;
  /** 楼层历史栈 */
  recentFloors: string[];
}

/** Store 返回值类型 */
export interface MapEditorStoreValue {
  state: MapEditorState;
  // 基础状态操作
  setCurrentFloorId: (floorId: string, options?: { preserveViewport?: boolean }) => void;
  setPos: (pos: LocPOD) => void;
  setHoverPos: (pos: LocPOD | null) => void;
  setSelectedBlock: (block: SelectedBlock | undefined) => void;
  setLayerMod: (layer: LayerMod) => void;
  setBrushMod: (brush: BrushMod) => void;
  // 大地图模式
  toggleBigmap: () => void;
  setBigmap: (bigmap: boolean) => void;
  setBigmapInfo: (info: { top: number; left: number; size: number }) => void;
  // 视口操作
  setViewportOffset: (offset: LocPOD) => void;
  setViewportBounds: (bounds: LocPOD) => void;
  moveViewport: (dx: number, dy: number) => void;
  // 绘制状态
  setHoldingPath: (holding: boolean) => void;
  pushStepPostfix: (pos: LocPOD) => void;
  clearStepPostfix: () => void;
  // 拖拽状态
  setStartPos: (pos: LocPOD | null) => void;
  setEndPos: (pos: LocPOD | null) => void;
  clearDragState: () => void;
  // 选区操作
  setSelectedArea: (area: RectPOD | null) => void;
  // 复制粘贴
  setCopiedInfo: (info: CopiedInfo | null) => void;
  // Tileset
  setTileSize: (size: GridPOD) => void;
  // 显示选项
  setShowMovable: (show: boolean) => void;
  // 机关门绑定
  setBindSpecialDoor: (state: BindSpecialDoorState) => void;
  clearBindSpecialDoor: () => void;
  // 楼层历史
  pushRecentFloor: (floorId: string) => void;
  popRecentFloor: () => string | undefined;
}

/** 初始状态 */
const initialState: MapEditorState = {
  currentFloorId: "",
  pos: [0, 0],
  hoverPos: null,
  selectedBlock: undefined,
  layerMod: "map",
  brushMod: "line",
  bigmap: false,
  bigmapInfo: { top: 0, left: 0, size: 32 },
  viewportOffset: [0, 0],
  viewportBounds: [0, 0],
  holdingPath: false,
  stepPostfix: [],
  startPos: null,
  endPos: null,
  selectedArea: null,
  copiedInfo: null,
  tileSize: [1, 1],
  showMovable: false,
  bindSpecialDoor: { loc: null, enemys: [], n: 0 },
  recentFloors: [],
};

/**
 * MapEditor Store Hook
 *
 * 管理地图编辑器的所有交互状态
 */
function useMapEditorStoreHook(): MapEditorStoreValue {
  const [state, setState] = useState<MapEditorState>(initialState);

  // 基础状态操作
  const setCurrentFloorId = useCallback((floorId: string, options?: { preserveViewport?: boolean }) => {
    setState((s) => {
      if (s.currentFloorId === floorId) return s;
      return {
        ...s,
        currentFloorId: floorId,
        viewportOffset: options?.preserveViewport ? s.viewportOffset : [0, 0],
      };
    });
  }, []);

  const setPos = useCallback((pos: LocPOD) => {
    setState((s) => ({ ...s, pos }));
  }, []);

  const setHoverPos = useCallback((pos: LocPOD | null) => {
    setState((s) => ({ ...s, hoverPos: pos }));
  }, []);

  const setSelectedBlock = useCallback((block: SelectedBlock | undefined) => {
    setState((s) => ({ ...s, selectedBlock: block }));
  }, []);

  const setLayerMod = useCallback((layer: LayerMod) => {
    setState((s) => ({ ...s, layerMod: layer }));
  }, []);

  const setBrushMod = useCallback((brush: BrushMod) => {
    setState((s) => ({ ...s, brushMod: brush }));
  }, []);

  // 大地图模式
  const toggleBigmap = useCallback(() => {
    setState((s) => ({ ...s, bigmap: !s.bigmap }));
  }, []);

  const setBigmap = useCallback((bigmap: boolean) => {
    setState((s) => ({ ...s, bigmap }));
  }, []);

  const setBigmapInfo = useCallback(
    (info: { top: number; left: number; size: number }) => {
      setState((s) => ({ ...s, bigmapInfo: info }));
    },
    []
  );

  // 视口操作
  const setViewportOffset = useCallback((offset: LocPOD) => {
    setState((s) => ({ ...s, viewportOffset: offset }));
  }, []);

  const setViewportBounds = useCallback((bounds: LocPOD) => {
    const normalized: LocPOD = [Math.max(0, bounds[0]), Math.max(0, bounds[1])];
    setState((s) => {
      const viewportOffset: LocPOD = [
        Math.max(0, Math.min(s.viewportOffset[0], normalized[0])),
        Math.max(0, Math.min(s.viewportOffset[1], normalized[1])),
      ];
      if (
        s.viewportBounds[0] === normalized[0]
        && s.viewportBounds[1] === normalized[1]
        && s.viewportOffset[0] === viewportOffset[0]
        && s.viewportOffset[1] === viewportOffset[1]
      ) return s;
      return { ...s, viewportBounds: normalized, viewportOffset };
    });
  }, []);

  const moveViewport = useCallback((dx: number, dy: number) => {
    setState((s) => {
      const [ox, oy] = s.viewportOffset;
      const viewportOffset: LocPOD = [
        Math.max(0, Math.min(ox + dx * 32, s.viewportBounds[0])),
        Math.max(0, Math.min(oy + dy * 32, s.viewportBounds[1])),
      ];
      if (viewportOffset[0] === ox && viewportOffset[1] === oy) return s;
      return { ...s, viewportOffset };
    });
  }, []);

  // 绘制状态
  const setHoldingPath = useCallback((holding: boolean) => {
    setState((s) => ({ ...s, holdingPath: holding }));
  }, []);

  const pushStepPostfix = useCallback((pos: LocPOD) => {
    setState((s) => ({ ...s, stepPostfix: [...s.stepPostfix, pos] }));
  }, []);

  const clearStepPostfix = useCallback(() => {
    setState((s) => ({ ...s, stepPostfix: [], holdingPath: false }));
  }, []);

  // 拖拽状态
  const setStartPos = useCallback((pos: LocPOD | null) => {
    setState((s) => ({ ...s, startPos: pos }));
  }, []);

  const setEndPos = useCallback((pos: LocPOD | null) => {
    setState((s) => ({ ...s, endPos: pos }));
  }, []);

  const clearDragState = useCallback(() => {
    setState((s) => ({ ...s, startPos: null, endPos: null }));
  }, []);

  // 选区操作
  const setSelectedArea = useCallback((area: RectPOD | null) => {
    setState((s) => ({ ...s, selectedArea: area }));
  }, []);

  // 复制粘贴
  const setCopiedInfo = useCallback((info: CopiedInfo | null) => {
    setState((s) => ({ ...s, copiedInfo: info }));
  }, []);

  // Tileset
  const setTileSize = useCallback((size: GridPOD) => {
    setState((s) => ({ ...s, tileSize: size }));
  }, []);

  // 显示选项
  const setShowMovable = useCallback((show: boolean) => {
    setState((s) => ({ ...s, showMovable: show }));
  }, []);

  // 机关门绑定
  const setBindSpecialDoor = useCallback((doorState: BindSpecialDoorState) => {
    setState((s) => ({ ...s, bindSpecialDoor: doorState }));
  }, []);

  const clearBindSpecialDoor = useCallback(() => {
    setState((s) => ({
      ...s,
      bindSpecialDoor: { loc: null, enemys: [], n: 0 },
    }));
  }, []);

  // 楼层历史
  const pushRecentFloor = useCallback((floorId: string) => {
    setState((s) => {
      if (!floorId || s.recentFloors.at(-1) === floorId) return s;
      return {
        ...s,
        recentFloors: [...s.recentFloors, floorId].slice(-100),
      };
    });
  }, []);

  const popRecentFloor = useCallback(() => {
    let poppedFloor: string | undefined;
    setState((s) => {
      const newFloors = [...s.recentFloors];
      poppedFloor = newFloors.pop();
      return { ...s, recentFloors: newFloors };
    });
    return poppedFloor;
  }, []);

  return {
    state,
    setCurrentFloorId,
    setPos,
    setHoverPos,
    setSelectedBlock,
    setLayerMod,
    setBrushMod,
    toggleBigmap,
    setBigmap,
    setBigmapInfo,
    setViewportOffset,
    setViewportBounds,
    moveViewport,
    setHoldingPath,
    pushStepPostfix,
    clearStepPostfix,
    setStartPos,
    setEndPos,
    clearDragState,
    setSelectedArea,
    setCopiedInfo,
    setTileSize,
    setShowMovable,
    setBindSpecialDoor,
    clearBindSpecialDoor,
    pushRecentFloor,
    popRecentFloor,
  };
}

// 创建 Store
export const MapEditorStore = createStore(useMapEditorStoreHook);
