import { GridCanvas, labelText, selectionBox } from '@/components/GridCanvas';
import type { GridMarker } from '@/components/GridCanvas';
import { LongPressButton } from '@/components/LongPressButton';
import { useModelResourceSuspense, useResourceSuspense } from '@/hooks/suspense';
import { projectData } from '@/project/data/projectData';
import { projectModel } from '@/project/model/projectModel';
import { useCurrentFloorId } from '@/stores/editorState';
import { getLastCoordinate, isMultipointString, parseMultipoints } from '@/utils/coordinate';
import type { LocPOD } from '@/utils/coordinate';
import { clamp } from 'es-toolkit';
import { type ChangeEvent, type FC, useCallback, useEffect, useMemo, useRef, useState, type WheelEvent } from 'react';
import { FloorThumbnail } from '../shared/FloorThumbnail';
import type { SelectPointResult } from '../shared/types';

const TILE_SIZE = 32;
const MAX_VIEW_COLUMNS = 20;
const MAX_VIEW_ROWS = 15;

function availableViewportGrid(): LocPOD {
  if (typeof window === 'undefined') return [MAX_VIEW_COLUMNS, MAX_VIEW_ROWS];
  return [
    clamp(Math.floor((window.innerWidth - 80) / TILE_SIZE), 1, MAX_VIEW_COLUMNS),
    clamp(Math.floor((window.innerHeight - 180) / TILE_SIZE), 1, MAX_VIEW_ROWS),
  ];
}

interface SelectPointContentProps {
  initialFloorId?: string;
  floorSelection?: 'selectable' | 'fixed';
  initialX?: number | string;
  initialY?: number | string;
  initialBigmap?: boolean;
  multiple?: boolean;
  onTitleChange: (title: string) => void;
  onResultChange: (result: SelectPointResult) => void;
  onConfirm: () => void;
}

export function parseStaticPointCoordinate(value: number | string | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string' && /^[-+]?\d+$/.test(value.trim())) {
    return Number.parseInt(value, 10);
  }
  return 0;
}

export const SelectPointContent: FC<SelectPointContentProps> = ({
  initialFloorId,
  floorSelection = 'selectable',
  initialX,
  initialY,
  initialBigmap,
  multiple = false,
  onTitleChange,
  onResultChange,
  onConfirm,
}) => {
  const storeFloorId = useCurrentFloorId();
  const floorListResource = useMemo(() => projectModel.floorList(), []);
  const floorList = useModelResourceSuspense(floorListResource);
  const floorOptions = useMemo(() => floorList.map((floor) => floor.id), [floorList]);
  if (floorOptions.length === 0) throw new Error('工程中没有可选楼层');
  if (floorSelection === 'fixed' && (!initialFloorId || !floorOptions.includes(initialFloorId))) {
    throw new Error(`固定楼层不存在：${initialFloorId ?? '未指定'}`);
  }

  const fallbackFloorId = floorOptions.includes(storeFloorId ?? '') ? storeFloorId! : floorOptions[0];
  const fixedFloorId = initialFloorId && floorOptions.includes(initialFloorId) ? initialFloorId : fallbackFloorId;
  const [currentFloorId, setCurrentFloorId] = useState(() =>
    floorSelection === 'fixed'
      ? fixedFloorId
      : initialFloorId && floorOptions.includes(initialFloorId)
        ? initialFloorId
        : fallbackFloorId,
  );
  const [floor] = useResourceSuspense(projectData.floor(currentFloorId));
  const width = Math.max(1, floor.width ?? 13);
  const height = Math.max(1, floor.height ?? 13);
  const [viewportLimit, setViewportLimit] = useState<LocPOD>(availableViewportGrid);
  useEffect(() => {
    const update = () => setViewportLimit(availableViewportGrid());
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  const viewColumns = Math.min(width, viewportLimit[0]);
  const viewRows = Math.min(height, viewportLimit[1]);
  const viewWidth = viewColumns * TILE_SIZE;
  const viewHeight = viewRows * TILE_SIZE;
  const needsViewportNavigation = width > viewColumns || height > viewRows;
  const halfViewX = Math.floor(viewColumns / 2);
  const halfViewY = Math.floor(viewRows / 2);

  const initialCoordinate = useCallback(
    (value: number | string | undefined) =>
      multiple && isMultipointString(initialX, initialY)
        ? getLastCoordinate(value as string)
        : parseStaticPointCoordinate(value),
    [initialX, initialY, multiple],
  );

  const [multipoints, setMultipoints] = useState<string[]>(() =>
    multiple && isMultipointString(initialX, initialY) ? parseMultipoints(initialX as string, initialY as string) : [],
  );
  const [posX, setPosX] = useState(() => initialCoordinate(initialX));
  const [posY, setPosY] = useState(() => initialCoordinate(initialY));
  const [isBigmap, setIsBigmap] = useState(() => Boolean(initialBigmap));
  const [leftRaw, setLeft] = useState(() => initialCoordinate(initialX) - halfViewX);
  const [topRaw, setTop] = useState(() => initialCoordinate(initialY) - halfViewY);
  const lastWheelAt = useRef(0);

  const maxLeft = Math.max(0, width - viewColumns);
  const maxTop = Math.max(0, height - viewRows);
  const left = clamp(leftRaw, 0, maxLeft);
  const top = clamp(topRaw, 0, maxTop);

  useEffect(() => {
    setPosX((value) => clamp(value, 0, width - 1));
    setPosY((value) => clamp(value, 0, height - 1));
    setLeft((value) => clamp(value, 0, maxLeft));
    setTop((value) => clamp(value, 0, maxTop));
    setMultipoints((points) =>
      points.filter((point) => {
        const [x, y] = point.split(',').map(Number);
        return x >= 0 && x < width && y >= 0 && y < height;
      }),
    );
  }, [height, maxLeft, maxTop, width]);

  const { logicalGridSize, gridOffset } = useMemo(() => {
    if (!isBigmap) {
      return { logicalGridSize: TILE_SIZE, gridOffset: [0, 0] as LocPOD };
    }
    const gridSize = Math.min(viewWidth / width, viewHeight / height);
    return {
      logicalGridSize: gridSize,
      gridOffset: [
        Math.max(0, (viewWidth - width * gridSize) / 2),
        Math.max(0, (viewHeight - height * gridSize) / 2),
      ] as LocPOD,
    };
  }, [height, isBigmap, viewHeight, viewWidth, width]);

  const markers = useMemo((): GridMarker[] => {
    const result = multipoints.map((point, index): GridMarker => {
      const [x, y] = point.split(',').map(Number);
      return {
        gridPos: isBigmap ? [x, y] : [x - left, y - top],
        render: labelText(String(index + 1)),
      };
    });
    result.push({
      gridPos: isBigmap ? [posX, posY] : [posX - left, posY - top],
      render: selectionBox(),
    });
    return result;
  }, [isBigmap, left, multipoints, posX, posY, top]);

  useEffect(() => {
    onTitleChange(`地图选点${multiple ? '【右键多选】' : ''} (${posX},${posY})`);
  }, [multiple, onTitleChange, posX, posY]);

  useEffect(() => {
    if (multiple && multipoints.length > 0) {
      onResultChange({
        floorId: currentFloorId,
        x: multipoints.map((point) => point.split(',')[0]).join(','),
        y: multipoints.map((point) => point.split(',')[1]).join(','),
      });
      return;
    }
    onResultChange({ floorId: currentFloorId, x: posX, y: posY });
  }, [currentFloorId, multiple, multipoints, onResultChange, posX, posY]);

  const setPoint = useCallback(
    (targetFloorId?: string, nextX?: number, nextY?: number) => {
      const nextFloorId =
        floorSelection === 'fixed'
          ? fixedFloorId
          : targetFloorId && floorOptions.includes(targetFloorId)
            ? targetFloorId
            : fallbackFloorId;
      const x = nextX ?? posX;
      const y = nextY ?? posY;
      setCurrentFloorId(nextFloorId);
      setPosX(x);
      setPosY(y);
      setLeft(x - halfViewX);
      setTop(y - halfViewY);
    },
    [fallbackFloorId, fixedFloorId, floorOptions, floorSelection, halfViewX, halfViewY, posX, posY],
  );

  const move = useCallback(
    (dx: number, dy: number) => {
      if (isBigmap) return;
      setLeft((value) => clamp(value + dx, 0, maxLeft));
      setTop((value) => clamp(value + dy, 0, maxTop));
    },
    [isBigmap, maxLeft, maxTop],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'KeyW') move(0, -1);
      if (event.code === 'KeyA') move(-1, 0);
      if (event.code === 'KeyS') move(0, 1);
      if (event.code === 'KeyD') move(1, 0);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [move]);

  const handleFloorChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setMultipoints([]);
    setPoint(event.target.value);
  };

  const handleCanvasClick = useCallback(
    (gridPos: LocPOD) => {
      const x = isBigmap ? gridPos[0] : left + gridPos[0];
      const y = isBigmap ? gridPos[1] : top + gridPos[1];
      setPosX(clamp(x, 0, width - 1));
      setPosY(clamp(y, 0, height - 1));
    },
    [height, isBigmap, left, top, width],
  );

  const handleCanvasDoubleClick = useCallback(
    (gridPos: LocPOD) => {
      const x = clamp(isBigmap ? gridPos[0] : left + gridPos[0], 0, width - 1);
      const y = clamp(isBigmap ? gridPos[1] : top + gridPos[1], 0, height - 1);
      setPosX(x);
      setPosY(y);
      if (multiple && multipoints.length > 0) {
        onResultChange({
          floorId: currentFloorId,
          x: multipoints.map((point) => point.split(',')[0]).join(','),
          y: multipoints.map((point) => point.split(',')[1]).join(','),
        });
      } else {
        onResultChange({ floorId: currentFloorId, x, y });
      }
      onConfirm();
    },
    [currentFloorId, height, isBigmap, left, multiple, multipoints, onConfirm, onResultChange, top, width],
  );

  const handleCanvasContextMenu = useCallback(
    (gridPos: LocPOD) => {
      if (!multiple) return;
      const x = isBigmap ? gridPos[0] : left + gridPos[0];
      const y = isBigmap ? gridPos[1] : top + gridPos[1];
      if (x < 0 || x >= width || y < 0 || y >= height) return;
      const key = `${x},${y}`;
      setMultipoints((points) => (points.includes(key) ? points.filter((point) => point !== key) : [...points, key]));
      setPosX(x);
      setPosY(y);
    },
    [height, isBigmap, left, multiple, top, width],
  );

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (floorSelection === 'fixed') return;
    const now = Date.now();
    if (now - lastWheelAt.current < 180) return;
    lastWheelAt.current = now;
    const index = floorOptions.indexOf(currentFloorId);
    const nextIndex = clamp(index + (event.deltaY > 0 ? -1 : 1), 0, floorOptions.length - 1);
    setMultipoints([]);
    setPoint(floorOptions[nextIndex]);
  };

  const copyFloorId = async () => {
    try {
      await navigator.clipboard.writeText(currentFloorId);
      alert(`楼层ID ${currentFloorId} 已成功复制到剪切板`);
    } catch {
      alert('无法复制楼层ID');
    }
  };

  return (
    <>
      <div
        id="uieventBody"
        className="selectPointViewport"
        style={{ width: viewWidth, height: viewHeight, overflow: 'hidden' }}
        onWheel={handleWheel}
      >
        <div style={{ position: 'relative', width: viewWidth, height: viewHeight }}>
          <FloorThumbnail
            floorId={currentFloorId}
            bigmap={isBigmap}
            viewportOffset={[left * TILE_SIZE, top * TILE_SIZE]}
            viewportSize={[viewWidth, viewHeight]}
            style={{ position: 'absolute', inset: 0, margin: 0 }}
          />
          <GridCanvas
            source={null}
            width={viewWidth}
            height={viewHeight}
            gridSize={[logicalGridSize, logicalGridSize]}
            offset={gridOffset}
            markers={markers}
            onClick={handleCanvasClick}
            onDoubleClick={handleCanvasDoubleClick}
            onContextMenu={multiple ? handleCanvasContextMenu : undefined}
            className="gameCanvas"
            testId="select-point-canvas"
            style={{ position: 'absolute', inset: 0, zIndex: 100 }}
          />
        </div>
        <div id="uieventExtraBody" style={{ display: 'none', marginTop: '-10px' }} />
      </div>
      {floorSelection === 'selectable' || needsViewportNavigation ? (
        <div id="selectPoint" data-test-id="select-point-controls">
          {floorSelection === 'selectable' ? (
            <select
              id="selectPointFloor"
              data-test-id="select-point-floor"
              value={currentFloorId}
              onChange={handleFloorChange}
            >
              {floorList.map((floorItem) => (
                <option key={floorItem.id} value={floorItem.id}>
                  {floorItem.id}
                  {floorItem.title ? `（${floorItem.title}）` : ''}
                </option>
              ))}
            </select>
          ) : null}
          {needsViewportNavigation ? (
            <div id="selectPointButtons">
              <LongPressButton onPress={() => move(-1, 0)}>←</LongPressButton>
              <LongPressButton onPress={() => move(0, -1)}>↑</LongPressButton>
              <LongPressButton onPress={() => move(0, 1)}>↓</LongPressButton>
              <LongPressButton onPress={() => move(1, 0)}>→</LongPressButton>
              <input
                type="button"
                value="切换大地图"
                data-test-id="select-point-bigmap"
                style={{ marginLeft: 10 }}
                onClick={() => {
                  setIsBigmap((value) => !value);
                  setMultipoints([]);
                }}
              />
            </div>
          ) : null}
          {floorSelection === 'selectable' ? <input type="button" value="复制楼层ID" onClick={copyFloorId} /> : null}
        </div>
      ) : null}
    </>
  );
};
