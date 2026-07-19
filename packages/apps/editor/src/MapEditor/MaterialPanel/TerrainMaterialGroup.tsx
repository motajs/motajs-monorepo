import { useCallback, useEffect, useMemo, useRef, useState, type FC, type MouseEvent } from "react";
import { useImageAssetUrl } from "@/hooks/useImageAssetUrl";
import { Grid, type GridPOD, type LocPOD } from "@/utils/coordinate";
import { createMaterialLayout } from "./layout";
import type { MaterialImageProps } from "./types";

interface TerrainMaterialGroupProps {
  folded: boolean;
  foldPerCol: number;
  selection: MaterialImageProps["selection"];
  onClear(): void;
  onClick: MaterialImageProps["onClick"];
  airwallPath?: string;
}

const GRID: GridPOD = [32, 32];

function useLoadedImage(path: string) {
  const { url, revision } = useImageAssetUrl(path);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!url) return;
    const next = new Image();
    next.onload = () => setImage(next);
    next.src = url;
  }, [revision, url]);
  return { image, revision };
}

function drawClearCell(context: CanvasRenderingContext2D, x: number, y: number): void {
  context.fillStyle = "#eeeeee";
  context.fillRect(x, y, 32, 32);
  context.fillStyle = "#bbbbbb";
  context.fillRect(x + 16, y, 16, 16);
  context.fillRect(x, y + 16, 16, 16);
}

export const TerrainMaterialGroup: FC<TerrainMaterialGroupProps> = ({
  folded,
  foldPerCol,
  selection,
  onClear,
  onClick,
  airwallPath = "project/materials/airwall.png",
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { image: terrain, revision: terrainRevision } = useLoadedImage("project/materials/terrains.png");
  const { image: airwall, revision: airwallRevision } = useLoadedImage(airwallPath);
  const terrainRows = terrain ? Math.floor(terrain.height / 32) : 0;
  const layout = useMemo(() => createMaterialLayout({
    sourceSize: [32, (terrainRows + 2) * 32],
    cellSize: GRID,
    mode: folded ? "folded" : "full",
    rowsPerColumn: foldPerCol,
  }), [foldPerCol, folded, terrainRows]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || !terrain || !airwall) return;
    canvas.width = layout.displaySize[0];
    canvas.height = layout.displaySize[1];
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = false;
    layout.cells.forEach(({ target }, virtualRow) => {
      if (virtualRow === 0) drawClearCell(context, target.x, target.y);
      else if (virtualRow === 1) {
        context.drawImage(airwall, 0, 0, 32, 32, target.x, target.y, 32, 32);
      } else {
        context.drawImage(
          terrain,
          0, (virtualRow - 2) * 32, 32, 32,
          target.x, target.y, 32, 32,
        );
      }
    });
  }, [airwall, airwallRevision, layout, terrain, terrainRevision]);

  const virtualRowAt = useCallback((event: MouseEvent<HTMLElement>) => {
    const displayLoc = Grid.unmapLoc([event.nativeEvent.offsetX, event.nativeEvent.offsetY], GRID);
    return layout.displayToSource(displayLoc)[1];
  }, [layout]);

  const handleMouseUp = useCallback((event: MouseEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;
    const virtualRow = virtualRowAt(event);
    if (virtualRow === 0) onClear();
    else if (virtualRow === 1) onClick("airwall", [0, 0], GRID, [1, 1], [1, 1]);
    else onClick("terrains", [0, virtualRow - 2], GRID, [1, 1], [1, terrainRows]);
  }, [onClear, onClick, terrainRows, virtualRowAt]);

  const virtualSelection = selection?.id === "clear"
    ? [0, 0] as LocPOD
    : selection?.id === "airwall"
      ? [0, 1] as LocPOD
      : selection?.id === "terrains"
        ? [0, selection.gridLoc[1] + 2] as LocPOD
        : null;
  const selectionPixel = virtualSelection
    ? Grid.mapLoc(layout.sourceToDisplay(virtualSelection), GRID)
    : null;

  if (!terrain || !airwall) return null;
  return (
    <div
      data-test-id="material-terrain-group"
      data-material-layout={folded ? "folded" : "full"}
      style={{ position: "relative", width: layout.displaySize[0], height: layout.displaySize[1] }}
    >
      <canvas
        ref={canvasRef}
        data-test-id="material-image-terrains"
        draggable={false}
        onMouseUp={handleMouseUp}
        style={{ display: "block", imageRendering: "pixelated" }}
      />
      <button
        type="button"
        data-test-id="material-clear-block"
        title="清除块"
        onClick={onClear}
        style={{
          position: "absolute",
          left: layout.sourceToDisplay([0, 0])[0] * 32,
          top: layout.sourceToDisplay([0, 0])[1] * 32,
          width: 32,
          height: 32,
          padding: 0,
          border: 0,
          background: "transparent",
          cursor: "pointer",
        }}
      />
      {selectionPixel ? (
        <div
          className="dataSelection"
          data-test-id={`material-selection-${selection?.id ?? "terrain"}`}
          style={{ left: selectionPixel[0], top: selectionPixel[1], width: 26, height: 26, pointerEvents: "none" }}
        />
      ) : null}
    </div>
  );
};
