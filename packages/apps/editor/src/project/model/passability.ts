import type { RegistryBlockInfo } from "./projectModel";

export type MapDirection = "left" | "down" | "up" | "right";

export interface PassabilityCell {
  allowed: MapDirection[];
}

export interface FloorPassability {
  width: number;
  height: number;
  cells: PassabilityCell[][];
}

const DIRECTIONS: MapDirection[] = ["left", "down", "up", "right"];
const OFFSETS: Record<MapDirection, readonly [number, number]> = {
  left: [-1, 0],
  down: [0, 1],
  up: [0, -1],
  right: [1, 0],
};
export const OPPOSITE_DIRECTION: Record<MapDirection, MapDirection> = {
  left: "right",
  right: "left",
  up: "down",
  down: "up",
};

function cellIdnum(layer: unknown, x: number, y: number): number {
  if (!Array.isArray(layer) || !Array.isArray(layer[y])) return 0;
  const cell = layer[y][x];
  if (typeof cell === "number") return cell;
  if (cell && typeof cell === "object") {
    const idnum = (cell as Record<string, unknown>).idnum;
    return typeof idnum === "number" ? idnum : 0;
  }
  return Number(cell) || 0;
}

function directionList(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function locDirections(floor: Record<string, unknown>, field: string, x: number, y: number): readonly string[] {
  const record = floor[field] as Record<string, unknown> | undefined;
  return directionList(record?.[`${x},${y}`]);
}

function blocksDirection(
  blocks: readonly number[],
  registry: ReadonlyMap<number, RegistryBlockInfo>,
  field: "cannotOut" | "cannotIn",
  direction: MapDirection,
): boolean {
  const checkedDirection = field === "cannotIn" ? OPPOSITE_DIRECTION[direction] : direction;
  return blocks.some((idnum) => {
    const block = registry.get(idnum) as (RegistryBlockInfo & Record<string, unknown>) | undefined;
    return directionList(block?.[field]).includes(checkedDirection);
  });
}

export function buildFloorPassability(
  floor: Record<string, unknown>,
  registry: ReadonlyMap<number, RegistryBlockInfo>,
): FloorPassability {
  const map = Array.isArray(floor.map) ? floor.map : [];
  const width = typeof floor.width === "number" ? floor.width : Array.isArray(map[0]) ? map[0].length : 0;
  const height = typeof floor.height === "number" ? floor.height : map.length;
  const layers = [floor.bgmap, floor.fgmap, floor.map];
  const cells = Array.from({ length: height }, (_, y) => (
    Array.from({ length: width }, (_, x): PassabilityCell => ({
      allowed: DIRECTIONS.filter((direction) => {
        if (locDirections(floor, "cannotMove", x, y).includes(direction)) return false;
        const [dx, dy] = OFFSETS[direction];
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) return false;
        if (locDirections(floor, "cannotMoveIn", nx, ny).includes(OPPOSITE_DIRECTION[direction])) return false;
        const sourceBlocks = layers.map((layer) => cellIdnum(layer, x, y));
        const targetBlocks = layers.map((layer) => cellIdnum(layer, nx, ny));
        if (blocksDirection(sourceBlocks, registry, "cannotOut", direction)) return false;
        if (blocksDirection(targetBlocks, registry, "cannotIn", direction)) return false;
        return true;
      }),
    }))
  ));
  return { width, height, cells };
}

export function canMove(
  passability: FloorPassability,
  x: number,
  y: number,
  direction: MapDirection,
): boolean {
  return passability.cells[y]?.[x]?.allowed.includes(direction) ?? false;
}
