/**
 * MapCanvas - 地图画布交互组件
 *
 * 处理地图编辑区域的所有鼠标交互
 * 迁移自 editor_mappanel.ts 的鼠标事件处理
 */

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, type FC, type MouseEvent } from 'react';
import { useNode } from '@motajs/react-hooks';
import { useModelResourceSuspense, useTowerDataSuspense } from '@/hooks/suspense';
import { deferredEnsureLoaded } from '@/hooks/suspense/deferredEnsureLoaded';
import { useSignal } from '@/hooks/useFs';
import { mapCommands, type MapLayer, type TilesetPaintPattern } from '@/project/commands/mapCommands';
import { projectData } from '@/project/data/projectData';
import { projectModel, type BlockRegistry, type RegistryBlockInfo } from '@/project/model/projectModel';
import { useMapLayerSettings } from '@/project/settings/mapLayerSettings';
import type { FloorData } from '@/types';
import { notifyCommandResult, notifyError, notifySuccess } from '@/utils/notify';
import type { LocPOD } from '@/utils/coordinate';
import { MapEditorStore } from './MapEditorStore';
import { EventOverlay } from './EventOverlay';
import {
  eToLoc,
  locToPos,
  locToPosBigmap,
  posToDrawLoc,
  isSamePos,
  formatLoc,
  CANVAS_SIZE,
  TILE_SIZE,
  GRID_COUNT,
} from './utils/coordinate';
import { drawArrow, drawSelectionRect, drawSelectionRectBigmap } from './utils/drawHelpers';
import { walkOrthogonalPath } from './utils/brushGeometry';
import { createPaintPreviewFloor, resolvePaintPositions } from './utils/paintPreview';
import type { BlockInfo, SelectedBlock } from './MaterialPanel/types';
import { MapPixiRenderer } from './rendering/MapPixiRenderer';

export interface MapCanvasProps {
  /** 楼层 ID */
  floorId: string;
  /** 右键菜单显示回调 */
  onContextMenu?: (x: number, y: number) => void;
  /** 双击选中素材回调 */
  onDoubleClickSelect?: (block: BlockInfo | 0) => void;
  /** 空手点击地图位置回调 */
  onLocSelect?: (pos: { x: number; y: number }, floorId: string) => void;
  onPaintSuccess?: (block: BlockInfo) => void;
}

type MapCell = unknown;

interface DisplayFloorState {
  floorId: string;
  floor: FloorData;
}

function blockToSelectedBlock(block: RegistryBlockInfo): BlockInfo {
  const record = block as RegistryBlockInfo & { cls?: string; images?: string; y?: number };
  return {
    ...record,
    idnum: block.idnum,
    id: record.id ?? '',
    images: record.images ?? record.cls ?? 'terrains',
    y: typeof record.y === 'number' ? record.y : block.idnum,
    isTile: block.kind === 'tileset',
  };
}

function cellToSelectedBlock(cell: MapCell, registry: BlockRegistry): SelectedBlock | undefined {
  if (cell == null) return undefined;
  if (cell === 0) return 0;
  if (typeof cell === 'number') {
    const block = registry.get(cell);
    if (block) return blockToSelectedBlock(block);
    return { idnum: cell, id: '', images: 'terrains', y: cell };
  }
  if (typeof cell === 'object') {
    const record = cell as Partial<BlockInfo>;
    if (typeof record.idnum === 'number') return record as BlockInfo;
  }
  return undefined;
}

function parseLocKey(key: string): { x: number; y: number } | null {
  const [x, y] = key.split(',').map(Number);
  if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
  return { x, y };
}

function isEnemyBlock(block: SelectedBlock | undefined): boolean {
  if (block === undefined || block === 0) return false;
  return block.images === 'enemys' || block.images === 'enemy48';
}

function useDisplayFloor(floorId: string): DisplayFloorState {
  const resource = useMemo(() => projectData.floor(floorId), [floorId]);
  const content = useSignal(resource.content);

  if (content.status === 'idle') {
    throw deferredEnsureLoaded(resource);
  }

  if (content.status === 'loaded') {
    return { floorId, floor: content.value };
  }

  if (content.status === 'loading') {
    throw resource.waitForSettled();
  }

  throw resource;
}

/**
 * MapCanvas 组件
 */
export const MapCanvas: FC<MapCanvasProps> = ({
  floorId,
  onContextMenu,
  onDoubleClickSelect,
  onLocSelect,
  onPaintSuccess,
}) => {
  const [uiCanvas, mountUiCanvas] = useNode<HTMLCanvasElement>();
  const containerRef = useRef<HTMLDivElement>(null);
  const gestureStart = useRef<LocPOD | null>(null);
  const gesturePath = useRef<LocPOD[]>([]);
  const suppressContextMenu = useRef(false);
  const pendingLocSelect = useRef<number | undefined>(undefined);

  const deferredFloorId = useDeferredValue(floorId);
  const { floor, floorId: displayFloorId } = useDisplayFloor(deferredFloorId);
  const isStale = deferredFloorId !== floorId;
  const [tower] = useTowerDataSuspense();
  const layerSettings = useMapLayerSettings();
  const tilesets = useMemo(
    () =>
      Array.isArray(tower.main.tilesets)
        ? tower.main.tilesets.filter((item): item is string => typeof item === 'string')
        : [],
    [tower.main.tilesets],
  );
  const imageNameMap = useMemo(
    () =>
      tower.main.nameMap && typeof tower.main.nameMap === 'object'
        ? (tower.main.nameMap as Record<string, string>)
        : {},
    [tower.main.nameMap],
  );
  const blockRegistryResource = useMemo(() => projectModel.blockRegistry(), []);
  const blockRegistry = useModelResourceSuspense(blockRegistryResource);
  const spriteRegistryResource = useMemo(() => projectModel.spriteRegistry(), []);
  const spriteRegistry = useModelResourceSuspense(spriteRegistryResource);
  const tilesetCatalogResource = useMemo(() => projectModel.tilesetCatalog(), []);
  const tilesetCatalog = useModelResourceSuspense(tilesetCatalogResource);
  const store = MapEditorStore.useStore();
  const { setViewportBounds } = store;
  const { state } = store;

  const {
    selectedBlock,
    layerMod,
    brushMod,
    bigmap,
    bigmapInfo,
    viewportOffset,
    holdingPath,
    stepPostfix,
    startPos,
    endPos,
    bindSpecialDoor,
    tileSize,
  } = state;

  const floorWidth = (floor.width ?? GRID_COUNT) as number;
  const floorHeight = (floor.height ?? GRID_COUNT) as number;

  useEffect(() => {
    setViewportBounds([
      Math.max(0, (floorWidth - GRID_COUNT) * TILE_SIZE),
      Math.max(0, (floorHeight - GRID_COUNT) * TILE_SIZE),
    ]);
  }, [displayFloorId, floorHeight, floorWidth, setViewportBounds]);

  // 获取当前图层的地图数据
  const activeLayerMap = useMemo(() => {
    const source = Array.isArray(floor[layerMod]) ? (floor[layerMod] as unknown[]) : [];
    return Array.from({ length: floorHeight }, (_, y) => {
      const row = source[y];
      return Array.from({ length: floorWidth }, (_, x) => (Array.isArray(row) ? (row[x] ?? 0) : 0));
    });
  }, [floor, floorHeight, floorWidth, layerMod]);
  const getLayerMap = useCallback(() => activeLayerMap, [activeLayerMap]);

  const selectedInfo = selectedBlock && typeof selectedBlock === 'object' ? selectedBlock : undefined;
  const selectedTileset = selectedInfo?.isTile ? tilesetCatalog.byName.get(selectedInfo.images) : undefined;
  const selectedPattern = useMemo<TilesetPaintPattern | undefined>(
    () =>
      selectedInfo && selectedTileset
        ? {
            startIdnum: selectedTileset.startIdnum,
            sourceX: selectedInfo.x ?? 0,
            sourceY: selectedInfo.y ?? 0,
            width: tileSize[0],
            height: tileSize[1],
            columns: selectedTileset.columns,
            rows: selectedTileset.rows,
          }
        : undefined,
    [selectedInfo, selectedTileset, tileSize],
  );

  const previewPositions = useMemo(() => {
    if (!holdingPath || selectedBlock === undefined || !startPos) return [];
    return resolvePaintPositions({
      brush: brushMod,
      start: startPos,
      end: endPos ?? startPos,
      path: stepPostfix,
      tileSize,
      layerMap: getLayerMap(),
      floorWidth,
      floorHeight,
    });
  }, [
    brushMod,
    endPos,
    floorHeight,
    floorWidth,
    getLayerMap,
    holdingPath,
    selectedBlock,
    startPos,
    stepPostfix,
    tileSize,
  ]);

  const previewFloor = useMemo(
    () =>
      holdingPath && selectedBlock !== undefined && startPos
        ? createPaintPreviewFloor(
            floor,
            layerMod as MapLayer,
            previewPositions,
            startPos,
            selectedBlock,
            selectedPattern,
          )
        : floor,
    [floor, holdingPath, layerMod, previewPositions, selectedBlock, selectedPattern, startPos],
  );

  // 清除 UI Canvas
  const clearUiCanvas = useCallback(() => {
    if (!uiCanvas) return;
    const ctx = uiCanvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    }
  }, [uiCanvas]);

  const clearPaintGesture = useCallback(() => {
    gestureStart.current = null;
    gesturePath.current = [];
    store.clearStepPostfix();
    store.clearDragState();
    clearUiCanvas();
  }, [clearUiCanvas, store]);

  // 获取格子位置
  const getPos = useCallback(
    (e: MouseEvent): LocPOD => {
      if (!containerRef.current) return [0, 0];

      const loc = eToLoc(e, containerRef.current);

      if (bigmap) {
        return locToPosBigmap(loc, bigmapInfo, floorWidth, floorHeight);
      }

      return locToPos(loc, viewportOffset);
    },
    [bigmap, bigmapInfo, viewportOffset, floorWidth, floorHeight],
  );

  // 判断是否已选中素材
  const isBlockSelected = useCallback(() => selectedBlock !== undefined, [selectedBlock]);

  useEffect(
    () => () => {
      if (pendingLocSelect.current != null) window.clearTimeout(pendingLocSelect.current);
    },
    [],
  );

  // 鼠标按下
  const handleMouseDown = useCallback(
    async (e: MouseEvent) => {
      store.setSelectedArea(null);
      if (isStale) return;

      if (e.button === 2 && (gestureStart.current !== null || holdingPath)) {
        suppressContextMenu.current = true;
        clearPaintGesture();
        return;
      }
      suppressContextMenu.current = false;

      const currentPos = getPos(e);
      // A map press always starts a fresh interaction, but only an actual
      // left-button paint press may create a paint gesture. Loc selection and
      // context-menu presses must not leave a latent paint origin behind.
      gestureStart.current = null;
      gesturePath.current = [];
      store.setPos(currentPos);

      // 机关门绑定模式
      if (bindSpecialDoor.loc !== null) {
        const loc = formatLoc(currentPos);
        const map = getLayerMap();
        const cell = map[currentPos[1]]?.[currentPos[0]] as unknown;
        const block = cellToSelectedBlock(cell, blockRegistry);

        if (isEnemyBlock(block)) {
          const index = bindSpecialDoor.enemys.indexOf(loc);
          const newEnemys = [...bindSpecialDoor.enemys];

          if (index >= 0) {
            newEnemys.splice(index, 1);
          } else {
            newEnemys.push(loc);
          }

          store.setBindSpecialDoor({
            ...bindSpecialDoor,
            enemys: newEnemys,
          });

          // 检查是否完成绑定
          if (newEnemys.length === bindSpecialDoor.n) {
            const doorPos = parseLocKey(bindSpecialDoor.loc);
            if (!doorPos) {
              notifyError(`机关门坐标不合法：${bindSpecialDoor.loc}`);
              store.clearBindSpecialDoor();
              return;
            }

            const result = await mapCommands.bindSpecialDoor(
              displayFloorId,
              doorPos,
              newEnemys.map((key) => {
                const parsed = parseLocKey(key);
                if (!parsed) throw new Error(`怪物坐标不合法：${key}`);
                return parsed;
              }),
            );
            notifyCommandResult(result, '绑定机关门事件成功');
            store.clearBindSpecialDoor();
          }
        } else {
          notifyError('请选择怪物位置');
        }
        return;
      }

      // 未选中素材时进入选点模式
      if (!isBlockSelected()) {
        if (pendingLocSelect.current != null) window.clearTimeout(pendingLocSelect.current);
        pendingLocSelect.current = window.setTimeout(() => {
          pendingLocSelect.current = undefined;
          onLocSelect?.({ x: currentPos[0], y: currentPos[1] }, displayFloorId);
        }, 200);
        store.setStartPos(currentPos);
        return;
      }

      // 已选中素材时开始绘图
      if (e.button !== 0) return;
      gestureStart.current = currentPos;
      gesturePath.current = [currentPos];
      store.clearStepPostfix();
      store.setHoldingPath(true);
      store.setStartPos(currentPos);
      store.setEndPos(currentPos);
      store.pushStepPostfix(currentPos);
      clearUiCanvas();
    },
    [
      store,
      getPos,
      displayFloorId,
      bindSpecialDoor,
      isStale,
      isBlockSelected,
      getLayerMap,
      blockRegistry,
      clearUiCanvas,
      clearPaintGesture,
      holdingPath,
      onLocSelect,
    ],
  );

  // 鼠标移动
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isStale) return;
      const currentPos = getPos(e);

      // 更新悬停位置（用于行列标记高亮）
      if (!bigmap) {
        store.setHoverPos(currentPos);
      }

      // 未选中素材时绘制箭头或选区
      if (!isBlockSelected()) {
        if (startPos === null) return;

        if (isSamePos(endPos, currentPos)) return;
        store.setEndPos(currentPos);

        if (!uiCanvas) return;
        const ctx = uiCanvas.getContext('2d');
        if (!ctx) return;

        clearUiCanvas();

        if (!isSamePos(startPos, currentPos)) {
          if (e.buttons === 2) {
            // 右键拖拽：绘制选区
            if (bigmap) {
              drawSelectionRectBigmap(ctx, startPos, currentPos, bigmapInfo);
            } else {
              drawSelectionRect(ctx, startPos, currentPos, viewportOffset);
            }
          } else {
            // 左键拖拽：绘制箭头
            const startDraw = bigmap
              ? [
                  bigmapInfo.left + startPos[0] * bigmapInfo.size + bigmapInfo.size / 2,
                  bigmapInfo.top + startPos[1] * bigmapInfo.size + bigmapInfo.size / 2,
                ]
              : posToDrawLoc(startPos, viewportOffset);
            const endDraw = bigmap
              ? [
                  bigmapInfo.left + currentPos[0] * bigmapInfo.size + bigmapInfo.size / 2,
                  bigmapInfo.top + currentPos[1] * bigmapInfo.size + bigmapInfo.size / 2,
                ]
              : posToDrawLoc(currentPos, viewportOffset);

            drawArrow(
              ctx,
              startDraw[0] + TILE_SIZE / 2,
              startDraw[1] + TILE_SIZE / 2,
              endDraw[0] + TILE_SIZE / 2,
              endDraw[1] + TILE_SIZE / 2,
            );
          }
        }
        return;
      }

      // 绘图模式
      if (!gestureStart.current || (e.buttons & 1) === 0) return;

      if (brushMod === 'fill') return;

      if (brushMod === 'rectangle') {
        if (!isSamePos(endPos, currentPos)) store.setEndPos(currentPos);
        return;
      }

      const lastPos = gesturePath.current[gesturePath.current.length - 1];
      if (!lastPos) return;

      // 计算与最后一点相邻的方向
      const dx = currentPos[0] - lastPos[0];
      const dy = currentPos[1] - lastPos[1];

      if (dx === 0 && dy === 0) return;
      for (const nextPos of walkOrthogonalPath(lastPos, currentPos)) {
        gesturePath.current.push(nextPos);
        store.pushStepPostfix(nextPos);
      }
      store.setEndPos(currentPos);
    },
    [
      getPos,
      isBlockSelected,
      startPos,
      endPos,
      store,
      isStale,
      uiCanvas,
      bigmap,
      bigmapInfo,
      viewportOffset,
      brushMod,
      clearUiCanvas,
    ],
  );

  // 鼠标抬起
  const handleMouseUp = useCallback(
    async (e: MouseEvent) => {
      e.preventDefault();
      store.setSelectedArea(null);
      e.stopPropagation();

      if (e.button === 2 && suppressContextMenu.current) {
        suppressContextMenu.current = false;
        clearPaintGesture();
        return;
      }

      if (isStale) {
        clearPaintGesture();
        return;
      }

      // 右键单击显示菜单
      if (e.button === 2 && (endPos === null || isSamePos(startPos, endPos))) {
        onContextMenu?.(e.clientX, e.clientY);
        store.clearStepPostfix();
        clearUiCanvas();
        store.clearDragState();
        return;
      }

      // 未选中素材时的拖拽操作
      if (!isBlockSelected()) {
        if (e.button === 2 && startPos && endPos) {
          // 右键拖拽：选中区域
          store.setSelectedArea([startPos, endPos]);
          notifySuccess('已经选中该区域');
        } else if (startPos && endPos && !isSamePos(startPos, endPos)) {
          // 左键拖拽：交换位置
          const result = await mapCommands.exchangeLoc({
            floorId: displayFloorId,
            layer: layerMod as MapLayer,
            from: { x: startPos[0], y: startPos[1] },
            to: { x: endPos[0], y: endPos[1] },
          });
          notifyCommandResult(result, '交换位置成功');
        }
        clearUiCanvas();
        store.clearDragState();
        return;
      }

      const gestureEnd = getPos(e);
      const firstPos = gestureStart.current;
      if (!firstPos) {
        clearPaintGesture();
        return;
      }
      const positions = resolvePaintPositions({
        brush: brushMod,
        start: firstPos,
        end: gestureEnd,
        path: gesturePath.current,
        tileSize,
        layerMap: getLayerMap(),
        floorWidth,
        floorHeight,
      });

      if (positions.length > 0) {
        const targetPositions = positions.map(([x, y]) => ({ x, y }));
        // The gesture is an input concern, not a persistence lifecycle. Detach
        // its immutable payload before awaiting the memory command so a prior
        // completion can never clear a newer gesture.
        clearPaintGesture();
        try {
          const result = selectedPattern
            ? await mapCommands.paintPattern({
                floorId: displayFloorId,
                layer: layerMod as MapLayer,
                targetPositions,
                anchor: { x: firstPos[0], y: firstPos[1] },
                tileset: selectedPattern,
              })
            : await mapCommands.paint({
                floorId: displayFloorId,
                layer: layerMod as MapLayer,
                positions: targetPositions,
                block: selectedBlock,
              });
          if (result.ok) {
            if (selectedBlock && typeof selectedBlock === 'object') onPaintSuccess?.(selectedBlock);
          } else {
            notifyCommandResult(result, '');
          }
        } catch (error) {
          notifyError(error);
        }
        return;
      }

      clearPaintGesture();
    },
    [
      getPos,
      endPos,
      startPos,
      onContextMenu,
      store,
      clearUiCanvas,
      clearPaintGesture,
      isBlockSelected,
      brushMod,
      tileSize,
      floorWidth,
      floorHeight,
      getLayerMap,
      layerMod,
      selectedBlock,
      displayFloorId,
      isStale,
      onPaintSuccess,
      selectedPattern,
    ],
  );

  // 鼠标移出
  const handleMouseLeave = useCallback(() => {
    // 清除悬停位置（取消行列标记高亮）
    store.setHoverPos(null);
  }, [store]);

  // 双击选中素材
  const handleDoubleClick = useCallback(
    (e: MouseEvent) => {
      if (bindSpecialDoor.loc !== null) return;
      if (isStale) return;
      if (pendingLocSelect.current != null) {
        window.clearTimeout(pendingLocSelect.current);
        pendingLocSelect.current = undefined;
      }

      const currentPos = getPos(e);
      const map = getLayerMap();
      const cell = map[currentPos[1]]?.[currentPos[0]];
      const block = cellToSelectedBlock(cell, blockRegistry);

      if (block !== undefined) {
        onDoubleClickSelect?.(block);
      }
    },
    [bindSpecialDoor, isStale, getPos, getLayerMap, blockRegistry, onDoubleClickSelect],
  );

  // 阻止右键菜单
  const handleContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault();
  }, []);

  return (
    <div
      ref={containerRef}
      className="map"
      id="mapEdit"
      data-test-id="map-editor-surface"
      data-floor-id={floorId}
      data-bigmap={bigmap ? 'true' : 'false'}
      data-viewport-x={viewportOffset[0]}
      data-viewport-y={viewportOffset[1]}
      data-selected-idnum={typeof selectedBlock === 'object' ? selectedBlock.idnum : selectedBlock === 0 ? 0 : ''}
      data-paint-preview-count={previewPositions.length}
    >
      {/* 背景层 Pixi 渲染 */}
      <MapPixiRenderer
        floor={previewFloor}
        blockRegistry={blockRegistry}
        spriteRegistry={spriteRegistry}
        tilesets={tilesets}
        imageNameMap={imageNameMap}
        layers={layerSettings.layers}
        activeLayer={layerMod}
        bigmap={bigmap}
        viewportOffset={viewportOffset}
      />
      {/* 事件标记层 */}
      <EventOverlay floorId={displayFloorId} />
      {/* UI 交互层 Canvas */}
      <canvas
        ref={mountUiCanvas}
        className="gameCanvas"
        id="eui"
        data-test-id="map-canvas-input"
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        style={{ position: 'absolute', zIndex: 100, pointerEvents: isStale ? 'none' : undefined }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      />
    </div>
  );
};

export default MapCanvas;
