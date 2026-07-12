import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FC,
  type WheelEvent,
} from "react";
import { clamp } from "es-toolkit";
import { GridCanvas, labelText, selectionBox } from "@/components/GridCanvas";
import type { GridMarker } from "@/components/GridCanvas";
import { LongPressButton } from "@/components/LongPressButton";
import { useModelResourceSuspense, useResourceSuspense } from "@/hooks/suspense";
import { projectData } from "@/project/data/projectData";
import { projectModel } from "@/project/model/projectModel";
import { useCurrentFloorId } from "@/stores/editorState";
import { getLastCoordinate, isMultipointString, parseMultipoints } from "@/utils/coordinate";
import type { LocPOD } from "@/utils/coordinate";
import { FloorThumbnail } from "../shared/FloorThumbnail";
import type { SelectPointResult } from "../shared/types";

const TILE_SIZE = 32;
const VIEW_SIZE = 13;
const VIEW_PIXELS = TILE_SIZE * VIEW_SIZE;
const HALF_VIEW = Math.floor(VIEW_SIZE / 2);

interface SelectPointContentProps {
  initialFloorId?: string;
  initialX?: number | string;
  initialY?: number | string;
  initialBigmap?: boolean;
  onTitleChange: (title: string) => void;
  onResultChange: (result: SelectPointResult) => void;
}

export function parseStaticPointCoordinate(value: number | string | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && /^[-+]?\d+$/.test(value.trim())) {
    return Number.parseInt(value, 10);
  }
  return 0;
}

export const SelectPointContent: FC<SelectPointContentProps> = ({
  initialFloorId,
  initialX,
  initialY,
  initialBigmap,
  onTitleChange,
  onResultChange,
}) => {
  const storeFloorId = useCurrentFloorId();
  const floorListResource = useMemo(() => projectModel.floorList(), []);
  const floorList = useModelResourceSuspense(floorListResource);
  const floorOptions = useMemo(() => floorList.map((floor) => floor.id), [floorList]);
  if (floorOptions.length === 0) throw new Error("工程中没有可选楼层");

  const fallbackFloorId = floorOptions.includes(storeFloorId ?? "")
    ? storeFloorId!
    : floorOptions[0];
  const [currentFloorId, setCurrentFloorId] = useState(() => (
    initialFloorId && floorOptions.includes(initialFloorId) ? initialFloorId : fallbackFloorId
  ));
  const [floor] = useResourceSuspense(projectData.floor(currentFloorId));
  const width = Math.max(1, floor.width ?? VIEW_SIZE);
  const height = Math.max(1, floor.height ?? VIEW_SIZE);

  const initialCoordinate = useCallback((value: number | string | undefined) => (
    isMultipointString(initialX, initialY)
      ? getLastCoordinate(value as string)
      : parseStaticPointCoordinate(value)
  ), [initialX, initialY]);

  const [multipoints, setMultipoints] = useState<string[]>(() => (
    isMultipointString(initialX, initialY)
      ? parseMultipoints(initialX as string, initialY as string)
      : []
  ));
  const [posX, setPosX] = useState(() => initialCoordinate(initialX));
  const [posY, setPosY] = useState(() => initialCoordinate(initialY));
  const [isBigmap, setIsBigmap] = useState(() => Boolean(initialBigmap));
  const [leftRaw, setLeft] = useState(() => initialCoordinate(initialX) - HALF_VIEW);
  const [topRaw, setTop] = useState(() => initialCoordinate(initialY) - HALF_VIEW);
  const lastWheelAt = useRef(0);

  const maxLeft = Math.max(0, width - VIEW_SIZE);
  const maxTop = Math.max(0, height - VIEW_SIZE);
  const left = clamp(leftRaw, 0, maxLeft);
  const top = clamp(topRaw, 0, maxTop);

  useEffect(() => {
    setPosX((value) => clamp(value, 0, width - 1));
    setPosY((value) => clamp(value, 0, height - 1));
    setLeft((value) => clamp(value, 0, maxLeft));
    setTop((value) => clamp(value, 0, maxTop));
    setMultipoints((points) => points.filter((point) => {
      const [x, y] = point.split(",").map(Number);
      return x >= 0 && x < width && y >= 0 && y < height;
    }));
  }, [height, maxLeft, maxTop, width]);

  const { logicalGridSize, gridOffset } = useMemo(() => {
    if (!isBigmap) {
      return { logicalGridSize: TILE_SIZE, gridOffset: [0, 0] as LocPOD };
    }
    const scale = VIEW_SIZE / Math.max(width, height);
    return {
      logicalGridSize: TILE_SIZE * scale,
      gridOffset: [
        VIEW_PIXELS * Math.max(0, (1 - width / height) / 2),
        VIEW_PIXELS * Math.max(0, (1 - height / width) / 2),
      ] as LocPOD,
    };
  }, [height, isBigmap, width]);

  const markers = useMemo((): GridMarker[] => {
    const result = multipoints.map((point, index): GridMarker => {
      const [x, y] = point.split(",").map(Number);
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
    onTitleChange(`地图选点【右键多选】 (${posX},${posY})`);
  }, [onTitleChange, posX, posY]);

  useEffect(() => {
    if (multipoints.length > 0) {
      onResultChange({
        floorId: currentFloorId,
        x: multipoints.map((point) => point.split(",")[0]).join(","),
        y: multipoints.map((point) => point.split(",")[1]).join(","),
      });
      return;
    }
    onResultChange({ floorId: currentFloorId, x: posX, y: posY });
  }, [currentFloorId, multipoints, onResultChange, posX, posY]);

  const setPoint = useCallback((targetFloorId?: string, nextX?: number, nextY?: number) => {
    const nextFloorId = targetFloorId && floorOptions.includes(targetFloorId)
      ? targetFloorId
      : fallbackFloorId;
    const x = nextX ?? posX;
    const y = nextY ?? posY;
    setCurrentFloorId(nextFloorId);
    setPosX(x);
    setPosY(y);
    setLeft(x - HALF_VIEW);
    setTop(y - HALF_VIEW);
  }, [fallbackFloorId, floorOptions, posX, posY]);

  const move = useCallback((dx: number, dy: number) => {
    if (isBigmap) return;
    setLeft((value) => clamp(value + dx, 0, maxLeft));
    setTop((value) => clamp(value + dy, 0, maxTop));
  }, [isBigmap, maxLeft, maxTop]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === "KeyW") move(0, -1);
      if (event.code === "KeyA") move(-1, 0);
      if (event.code === "KeyS") move(0, 1);
      if (event.code === "KeyD") move(1, 0);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [move]);

  const handleFloorChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setMultipoints([]);
    setPoint(event.target.value);
  };

  const handleCanvasClick = useCallback((gridPos: LocPOD) => {
    const x = isBigmap ? gridPos[0] : left + gridPos[0];
    const y = isBigmap ? gridPos[1] : top + gridPos[1];
    setPosX(clamp(x, 0, width - 1));
    setPosY(clamp(y, 0, height - 1));
  }, [height, isBigmap, left, top, width]);

  const handleCanvasContextMenu = useCallback((gridPos: LocPOD) => {
    if (isBigmap) return;
    const x = left + gridPos[0];
    const y = top + gridPos[1];
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const key = `${x},${y}`;
    setMultipoints((points) => (
      points.includes(key) ? points.filter((point) => point !== key) : [...points, key]
    ));
    setPosX(x);
    setPosY(y);
  }, [height, isBigmap, left, top, width]);

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
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
      alert("无法复制楼层ID");
    }
  };

  return (
    <>
      <div id="uieventBody" style={{ overflow: "hidden" }} onWheel={handleWheel}>
        <div style={{ position: "relative", width: VIEW_PIXELS, height: VIEW_PIXELS }}>
          <FloorThumbnail
            floorId={currentFloorId}
            bigmap={isBigmap}
            viewportOffset={[left * TILE_SIZE, top * TILE_SIZE]}
            style={{ position: "absolute", inset: 0, margin: 0 }}
          />
          <GridCanvas
            source={null}
            width={VIEW_PIXELS}
            height={VIEW_PIXELS}
            gridSize={[logicalGridSize, logicalGridSize]}
            offset={gridOffset}
            markers={markers}
            onClick={handleCanvasClick}
            onContextMenu={handleCanvasContextMenu}
            className="gameCanvas"
            testId="select-point-canvas"
            style={{ position: "absolute", inset: 0, zIndex: 100 }}
          />
        </div>
        <div id="uieventExtraBody" style={{ display: "none", marginTop: "-10px" }} />
      </div>
      <div id="selectPoint" data-test-id="select-point-controls">
        <select
          id="selectPointFloor"
          data-test-id="select-point-floor"
          value={currentFloorId}
          onChange={handleFloorChange}
        >
          {floorList.map((floorItem) => (
            <option key={floorItem.id} value={floorItem.id}>
              {floorItem.id}{floorItem.title ? `（${floorItem.title}）` : ""}
            </option>
          ))}
        </select>
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
          <input type="button" value="复制楼层ID" onClick={copyFloorId} />
        </div>
      </div>
    </>
  );
};
