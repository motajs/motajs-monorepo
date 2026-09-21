import type { FloorData } from '@/types';
import type { GridPOD, LocPOD } from '@/utils/coordinate';
import { tilesetPatternIdnum, type MapLayer, type TilesetPaintPattern } from '@/project/commands/mapCommands';
import type { BrushMod } from '../MapEditorStore';
import type { BlockInfo, SelectedBlock } from '../MaterialPanel/types';
import { rectanglePositions } from './brushGeometry';
import { fillModeBfs } from './fillBfs';

interface ResolvePaintPositionsOptions {
  brush: BrushMod;
  start: LocPOD;
  end: LocPOD;
  path: readonly LocPOD[];
  tileSize: GridPOD;
  layerMap: unknown;
  floorWidth: number;
  floorHeight: number;
}

function inBounds(position: LocPOD, width: number, height: number): boolean {
  return position[0] >= 0 && position[1] >= 0 && position[0] < width && position[1] < height;
}

function uniquePositions(positions: readonly LocPOD[]): LocPOD[] {
  const unique = new Map<string, LocPOD>();
  for (const position of positions) unique.set(`${position[0]},${position[1]}`, position);
  return [...unique.values()];
}

export function resolvePaintPositions(options: ResolvePaintPositionsOptions): LocPOD[] {
  const { brush, start, end, path, tileSize, layerMap, floorWidth, floorHeight } = options;

  let positions: LocPOD[];
  if (brush === 'fill') {
    positions = fillModeBfs(layerMap as (BlockInfo | number | 0)[][], start[0], start[1], floorWidth, floorHeight);
  } else if (brush === 'rectangle') {
    positions = rectanglePositions(start, end);
  } else {
    positions = path.length > 0 ? [...path] : [start];
  }

  if (brush !== 'fill' && positions.length === 1 && (tileSize[0] > 1 || tileSize[1] > 1)) {
    positions = rectanglePositions(start, [
      Math.min(floorWidth - 1, start[0] + tileSize[0] - 1),
      Math.min(floorHeight - 1, start[1] + tileSize[1] - 1),
    ]);
  }

  return uniquePositions(positions.filter((position) => inBounds(position, floorWidth, floorHeight)));
}

function selectedIdnum(block: SelectedBlock): number {
  return block === 0 ? 0 : block.idnum;
}

export function createPaintPreviewFloor(
  floor: FloorData,
  layer: MapLayer,
  positions: readonly LocPOD[],
  anchor: LocPOD,
  block: SelectedBlock,
  pattern?: TilesetPaintPattern,
): FloorData {
  if (positions.length === 0) return floor;
  const width = typeof floor.width === 'number' ? floor.width : (floor.map?.[0]?.length ?? 0);
  const height = typeof floor.height === 'number' ? floor.height : (floor.map?.length ?? 0);
  const source = Array.isArray(floor[layer]) ? (floor[layer] as unknown[]) : [];
  const matrix = Array.from({ length: height }, (_, y) => {
    const row = source[y];
    return Array.from({ length: width }, (_, x) => (Array.isArray(row) ? (row[x] ?? 0) : 0));
  });

  for (const [x, y] of positions) {
    const row = matrix[y];
    if (!row || x < 0 || x >= row.length) continue;
    row[x] = pattern ? tilesetPatternIdnum(pattern, { x: anchor[0], y: anchor[1] }, { x, y }) : selectedIdnum(block);
  }

  return { ...floor, [layer]: matrix };
}
