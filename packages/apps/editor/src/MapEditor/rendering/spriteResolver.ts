import type { BlockRegistry, RegistrySpriteInfo, SpriteRegistry } from "@/project/model/projectModel";
import type { FloorData } from "@/types";

const TILESET_START_OFFSET = 10000;
const TILESET_OFFSET_STEP = 10000;

export interface ResolvedSpriteInfo extends RegistrySpriteInfo {
  tilesetLocalIndex?: number;
}

export function resolveCellSprite(
  idnum: number,
  blockRegistry: BlockRegistry,
  tilesets: readonly string[],
): ResolvedSpriteInfo | string | undefined {
  if (idnum === 0) return undefined;
  if (!Number.isFinite(idnum)) return `Invalid map cell idnum: ${String(idnum)}`;

  if (idnum >= TILESET_START_OFFSET) {
    const zeroBased = idnum - TILESET_START_OFFSET;
    const tilesetIndex = Math.floor(zeroBased / TILESET_OFFSET_STEP);
    const tilesetName = tilesets[tilesetIndex];
    if (!tilesetName) return `Missing tileset for idnum ${idnum}`;
    return {
      key: `tileset:${idnum}`,
      id: `X${idnum}`,
      images: tilesetName,
      path: `project/tilesets/${tilesetName}`,
      x: 0,
      y: 0,
      width: 32,
      height: 32,
      isTile: true,
      idnum,
      tilesetLocalIndex: zeroBased % TILESET_OFFSET_STEP,
    };
  }

  const block = blockRegistry.get(idnum);
  if (!block) return `Missing block registry entry for idnum ${idnum}`;
  if (!block.materialPath) return `Missing sprite metadata for idnum ${idnum} (${block.id ?? "unknown"})`;
  if (typeof block.y !== "number") return `Missing sprite index for idnum ${idnum} (${block.id ?? "unknown"})`;

  return {
    key: `${block.images}:${block.id}`,
    id: block.id ?? String(idnum),
    images: block.images ?? "",
    path: block.materialPath,
    x: block.x ?? 0,
    y: block.y,
    width: typeof block.width === "number" ? block.width : 32,
    height: typeof block.height === "number"
      ? block.height
      : block.images?.endsWith("48") ? 48 : 32,
    isTile: block.isTile,
    idnum,
  };
}

export function resolveDefaultGroundSprite(
  floor: FloorData,
  blockRegistry: BlockRegistry,
  spriteRegistry: SpriteRegistry,
  tilesets: readonly string[],
): ResolvedSpriteInfo | string | undefined {
  const configured = typeof floor.defaultGround === "string" && floor.defaultGround.length > 0
    ? floor.defaultGround
    : "ground";
  if (configured === "none") return undefined;

  const tileset = /^X(\d+)$/.exec(configured);
  if (tileset) return resolveCellSprite(Number(tileset[1]), blockRegistry, tilesets);

  const registered = [...blockRegistry.values()].find((block) => block.id === configured);
  if (registered && registered.idnum !== 0) {
    return resolveCellSprite(registered.idnum, blockRegistry, tilesets);
  }

  return spriteRegistry.get(`terrains:${configured}`)
    ?? `Missing default ground sprite: ${configured}`;
}
