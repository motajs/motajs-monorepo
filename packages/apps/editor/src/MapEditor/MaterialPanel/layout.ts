import type { GridPOD, LocPOD } from "@/utils/coordinate";

export type MaterialLayoutMode = "full" | "folded";
export type MaterialLayoutKind = "rows" | "single" | "spatial";

export interface MaterialLayoutCell {
  source: { x: number; y: number; width: number; height: number };
  target: { x: number; y: number; width: number; height: number };
}

export interface MaterialLayout {
  displaySize: GridPOD;
  sourceToDisplay(loc: LocPOD): LocPOD;
  displayToSource(loc: LocPOD): LocPOD;
  cells: MaterialLayoutCell[];
}

export interface MaterialLayoutOptions {
  sourceSize: GridPOD;
  cellSize: GridPOD;
  mode: MaterialLayoutMode;
  rowsPerColumn: number;
  kind?: MaterialLayoutKind;
}

function positiveInteger(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
}

export function createMaterialLayout(options: MaterialLayoutOptions): MaterialLayout {
  const { sourceSize, cellSize, mode } = options;
  const kind = options.kind ?? "rows";
  const rowsPerColumn = positiveInteger(options.rowsPerColumn);
  const [sourceWidth, sourceHeight] = sourceSize;
  const [cellWidth, cellHeight] = cellSize;

  if (kind === "spatial") {
    return {
      displaySize: sourceSize,
      sourceToDisplay: (loc) => loc,
      displayToSource: (loc) => loc,
      cells: [{
        source: { x: 0, y: 0, width: sourceWidth, height: sourceHeight },
        target: { x: 0, y: 0, width: sourceWidth, height: sourceHeight },
      }],
    };
  }

  if (kind === "single") {
    const folded = mode === "folded";
    return {
      displaySize: folded ? cellSize : sourceSize,
      sourceToDisplay: () => [0, 0],
      displayToSource: () => [0, 0],
      cells: [{
        source: { x: 0, y: 0, width: cellWidth, height: cellHeight },
        target: { x: 0, y: 0, width: cellWidth, height: cellHeight },
      }],
    };
  }

  const rowCount = Math.max(0, Math.floor(sourceHeight / cellHeight));
  const folded = mode === "folded";
  const columns = rowCount === 0 ? 0 : Math.ceil(rowCount / rowsPerColumn);
  const visibleRows = rowCount === 0 ? 0 : Math.min(rowCount, rowsPerColumn);
  const displaySize: GridPOD = folded
    ? [columns * cellWidth, visibleRows * cellHeight]
    : sourceSize;
  const cells = Array.from({ length: rowCount }, (_, row): MaterialLayoutCell => {
    const column = folded ? Math.floor(row / rowsPerColumn) : 0;
    const displayRow = folded ? row % rowsPerColumn : row;
    return {
      source: { x: 0, y: row * cellHeight, width: cellWidth, height: cellHeight },
      target: {
        x: column * cellWidth,
        y: displayRow * cellHeight,
        width: cellWidth,
        height: cellHeight,
      },
    };
  });

  const normalizeRow = (row: number) => Math.max(0, Math.min(rowCount - 1, row));
  return {
    displaySize,
    sourceToDisplay: ([, sourceRow]) => {
      const row = normalizeRow(sourceRow);
      return folded
        ? [Math.floor(row / rowsPerColumn), row % rowsPerColumn]
        : [0, row];
    },
    displayToSource: ([displayColumn, displayRow]) => {
      const row = normalizeRow(folded
        ? displayColumn * rowsPerColumn + displayRow
        : displayRow);
      return [0, row];
    },
    cells,
  };
}
