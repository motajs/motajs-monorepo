import { type ImageAssetSnapshot, projectAssets } from '@/project/assets';
import type { BlockRegistry, SpriteRegistry } from '@/project/model/projectModel';
import type { FloorData } from '@/types';
import type { MapLayerDefinition } from '@/project/settings/mapLayerSettings';
import { Application as PixiApplication, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import { type FC, useEffect, useMemo, useRef, useState } from 'react';
import { CANVAS_SIZE, GRID_COUNT, TILE_SIZE } from '../utils/coordinate';
import { collectFloorImagePaths, type FloorImagePart, resolveFloorImageParts } from './floorImages';
import { resolveCellSprite, resolveDefaultGroundSprite, type ResolvedSpriteInfo } from './spriteResolver';

type MapCell = unknown;

interface RenderCell {
  key: string;
  texture: Texture;
  x: number;
  y: number;
  width: number;
  height: number;
  alpha: number;
  order: number;
  reverse?: ':x' | ':y' | ':o';
}

interface MissingCell {
  key: string;
  x: number;
  y: number;
  size: number;
  message: string;
}

interface TextureState {
  pathsKey: string;
  textures: Map<string, Texture>;
  diagnostics: string[];
  loading: boolean;
}

type MapLayerName = string;

const DEFAULT_VIEWPORT_SIZE = [CANVAS_SIZE, CANVAS_SIZE] as const;

const frameTextureCache = new Map<string, Texture>();

function imageMimeType(path: string): string {
  if (/\.jpe?g$/i.test(path)) return 'image/jpeg';
  if (/\.gif$/i.test(path)) return 'image/gif';
  if (/\.webp$/i.test(path)) return 'image/webp';
  return 'image/png';
}

function loadImageTexture(path: string, snapshot: ImageAssetSnapshot): Promise<Texture> {
  const bytes = new Uint8Array(snapshot.bytes);
  const url = URL.createObjectURL(new Blob([bytes.buffer], { type: imageMimeType(path) }));
  return new Promise<Texture>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(Texture.from(image));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to load material ${path}`));
    };
    image.src = url;
  });
}

function destroyTextureFrames(texture: Texture): void {
  const prefix = `${texture.uid}:`;
  for (const [key, frame] of frameTextureCache) {
    if (!key.startsWith(prefix)) continue;
    frame.destroy(false);
    frameTextureCache.delete(key);
  }
}

function destroyMaterialTexture(texture: Texture): void {
  if (texture.destroyed) return;
  destroyTextureFrames(texture);
  texture.destroy(true);
}

interface PooledPixiApplication {
  app: PixiApplication;
  scene: Container;
}

const pixiApplicationPool: PooledPixiApplication[] = [];
const pooledPixiApps = new WeakSet<PixiApplication>();

function acquirePixiApplication(): PooledPixiApplication | undefined {
  const entry = pixiApplicationPool.pop();
  if (entry) pooledPixiApps.delete(entry.app);
  return entry;
}

function releasePixiApplication(app: PixiApplication, scene: Container): void {
  if (pooledPixiApps.has(app)) return;
  app.stop();
  app.canvas.remove();
  app.canvas.style.visibility = 'hidden';
  pooledPixiApps.add(app);
  pixiApplicationPool.push({ app, scene });
}

function abandonPixiApplication(app: PixiApplication): void {
  app.stop();
  app.canvas.remove();
  app.canvas.style.visibility = 'hidden';
}

interface PixiRenderSession {
  app: PixiApplication;
  generation: number;
  scene: Container | null;
  disposed: boolean;
  reusable: boolean;
}

function destroyDisplayObjects(children: Container[]): void {
  for (const child of children) {
    child.destroy({ children: true, context: true });
  }
}

export interface MapPixiRendererProps {
  floor: FloorData;
  blockRegistry: BlockRegistry;
  spriteRegistry: SpriteRegistry;
  tilesets: readonly string[];
  imageNameMap?: Readonly<Record<string, string>>;
  layers: readonly MapLayerDefinition[];
  activeLayer: MapLayerName;
  bigmap: boolean;
  viewportOffset: readonly [number, number];
  viewportSize?: readonly [number, number];
}

function getMapCell(map: unknown, x: number, y: number): MapCell {
  if (!Array.isArray(map)) return 0;
  const row = map[y];
  if (!Array.isArray(row)) return 0;
  return row[x] ?? 0;
}

function cellIdnum(cell: MapCell): number {
  if (cell == null || cell === 0) return 0;
  if (typeof cell === 'number') return cell;
  if (typeof cell === 'object') {
    const idnum = (cell as Record<string, unknown>).idnum;
    return typeof idnum === 'number' ? idnum : Number.NaN;
  }
  return Number(cell);
}

function textureFrame(texture: Texture, sprite: ResolvedSpriteInfo): Texture | string {
  const tilesetWidth = Math.floor(texture.width / 32);
  if (typeof sprite.tilesetLocalIndex === 'number' && tilesetWidth <= 0) {
    return `Invalid tileset texture width: ${sprite.path}`;
  }

  const sourceX =
    typeof sprite.tilesetLocalIndex === 'number' ? (sprite.tilesetLocalIndex % tilesetWidth) * 32 : sprite.x * 32;
  const sourceY =
    typeof sprite.tilesetLocalIndex === 'number'
      ? Math.floor(sprite.tilesetLocalIndex / tilesetWidth) * 32
      : sprite.y * sprite.height;
  const sourceWidth = sprite.width;
  const sourceHeight = sprite.height;

  if (sourceX < 0 || sourceY < 0 || sourceX + sourceWidth > texture.width || sourceY + sourceHeight > texture.height) {
    return `Sprite crop outside ${sprite.path}: ${sprite.id} (${sourceX},${sourceY},${sourceWidth},${sourceHeight})`;
  }

  const key = `${texture.uid}:${sourceX}:${sourceY}:${sourceWidth}:${sourceHeight}`;
  const cached = frameTextureCache.get(key);
  if (cached) return cached;

  const frameTexture = new Texture({
    source: texture.source,
    frame: new Rectangle(sourceX, sourceY, sourceWidth, sourceHeight),
  });
  frameTextureCache.set(key, frameTexture);
  return frameTexture;
}

function frameTexture(
  texture: Texture,
  sourceX: number,
  sourceY: number,
  sourceWidth: number,
  sourceHeight: number,
  diagnosticLabel: string,
): Texture | string {
  if (sourceX < 0 || sourceY < 0 || sourceX + sourceWidth > texture.width || sourceY + sourceHeight > texture.height) {
    return `Sprite crop outside ${diagnosticLabel}: (${sourceX},${sourceY},${sourceWidth},${sourceHeight})`;
  }

  const key = `${texture.uid}:${sourceX}:${sourceY}:${sourceWidth}:${sourceHeight}`;
  const cached = frameTextureCache.get(key);
  if (cached) return cached;

  const cropped = new Texture({
    source: texture.source,
    frame: new Rectangle(sourceX, sourceY, sourceWidth, sourceHeight),
  });
  frameTextureCache.set(key, cropped);
  return cropped;
}

function collectPaths(
  floor: FloorData,
  blockRegistry: BlockRegistry,
  spriteRegistry: SpriteRegistry,
  tilesets: readonly string[],
  imageNameMap: Readonly<Record<string, string>>,
  layers: readonly MapLayerDefinition[],
): string[] {
  const paths = new Set<string>();
  const defaultGround = resolveDefaultGroundSprite(floor, blockRegistry, spriteRegistry, tilesets);
  if (defaultGround && typeof defaultGround !== 'string') paths.add(defaultGround.path);

  for (const definition of layers) {
    const layer = floor[definition.property];
    if (!Array.isArray(layer)) continue;
    for (const row of layer) {
      if (!Array.isArray(row)) continue;
      for (const cell of row) {
        const resolved = resolveCellSprite(cellIdnum(cell), blockRegistry, tilesets);
        if (resolved && typeof resolved !== 'string') paths.add(resolved.path);
      }
    }
  }

  for (const path of collectFloorImagePaths(floor.images, imageNameMap)) paths.add(path);

  return [...paths];
}

function floorImageViewportRect(
  part: FloorImagePart,
  floor: FloorData,
  bigmap: boolean,
  viewportOffset: readonly [number, number],
  viewportSize: readonly [number, number],
): { x: number; y: number; width: number; height: number } {
  if (!bigmap) {
    return {
      x: part.x - viewportOffset[0],
      y: part.y - viewportOffset[1],
      width: part.sourceWidth,
      height: part.sourceHeight,
    };
  }

  const floorWidth = (floor.width ?? GRID_COUNT) as number;
  const floorHeight = (floor.height ?? GRID_COUNT) as number;
  const tileSize = Math.min(viewportSize[0] / Math.max(floorWidth, 1), viewportSize[1] / Math.max(floorHeight, 1));
  const left = Math.max(0, (viewportSize[0] - floorWidth * tileSize) / 2);
  const top = Math.max(0, (viewportSize[1] - floorHeight * tileSize) / 2);
  const scale = tileSize / TILE_SIZE;
  return {
    x: left + part.x * scale,
    y: top + part.y * scale,
    width: part.sourceWidth * scale,
    height: part.sourceHeight * scale,
  };
}

function useMaterialTextures(paths: string[]): TextureState {
  const pathsKey = paths.join('\n');
  const loadedRevisions = useRef(new Map<string, number>());
  const requestedRevisions = useRef(new Map<string, number>());
  const texturesRef = useRef(new Map<string, Texture>());
  const [state, setState] = useState<TextureState>({
    pathsKey,
    textures: new Map(),
    diagnostics: [],
    loading: paths.length > 0,
  });

  useEffect(() => {
    let cancelled = false;
    const nextPaths = pathsKey ? pathsKey.split('\n') : [];
    if (nextPaths.length === 0) {
      for (const texture of texturesRef.current.values()) {
        destroyMaterialTexture(texture);
      }
      texturesRef.current = new Map();
      loadedRevisions.current.clear();
      requestedRevisions.current.clear();
      setState({ pathsKey, textures: new Map(), diagnostics: [], loading: false });
      return;
    }

    const wanted = new Set(nextPaths);
    for (const [path, texture] of texturesRef.current) {
      if (wanted.has(path)) continue;
      destroyMaterialTexture(texture);
      texturesRef.current.delete(path);
      loadedRevisions.current.delete(path);
      requestedRevisions.current.delete(path);
    }

    const diagnostics = new Map<string, string>();
    const pending = new Set<string>();
    const publish = () => {
      if (cancelled) return;
      setState({
        pathsKey,
        textures: new Map(texturesRef.current),
        diagnostics: [...diagnostics.values()],
        loading: pending.size > 0,
      });
    };

    const loadResource = (path: string) => {
      const resource = projectAssets.image(path);
      const content = resource.content();
      if (content.status === 'idle') {
        pending.add(path);
        publish();
        void resource.ensureLoaded();
        return;
      }
      if (content.status === 'loading') {
        pending.add(path);
        publish();
        return;
      }
      if (content.status !== 'loaded') {
        pending.delete(path);
        diagnostics.set(path, content.status === 'error' ? content.error.message : `Missing material ${path}`);
        publish();
        return;
      }
      if (loadedRevisions.current.get(path) === content.value.revision) {
        pending.delete(path);
        diagnostics.delete(path);
        publish();
        return;
      }
      pending.add(path);
      requestedRevisions.current.set(path, content.value.revision);
      publish();
      void loadImageTexture(path, content.value)
        .then((texture) => {
          if (cancelled) {
            destroyMaterialTexture(texture);
            return;
          }
          if (requestedRevisions.current.get(path) !== content.value.revision) {
            destroyMaterialTexture(texture);
            return;
          }
          const old = texturesRef.current.get(path);
          if (old) destroyMaterialTexture(old);
          texturesRef.current.set(path, texture);
          loadedRevisions.current.set(path, content.value.revision);
          pending.delete(path);
          diagnostics.delete(path);
          publish();
        })
        .catch((error) => {
          if (requestedRevisions.current.get(path) !== content.value.revision) return;
          pending.delete(path);
          diagnostics.set(path, error instanceof Error ? error.message : String(error));
          publish();
        });
    };

    const unsubscribes = nextPaths.map((path) => projectAssets.image(path).subscribe(() => loadResource(path)));

    return () => {
      cancelled = true;
      for (const unsubscribe of unsubscribes) unsubscribe();
    };
  }, [pathsKey]);

  useEffect(
    () => () => {
      for (const texture of texturesRef.current.values()) {
        destroyMaterialTexture(texture);
      }
      texturesRef.current.clear();
      loadedRevisions.current.clear();
      requestedRevisions.current.clear();
    },
    [],
  );

  return state;
}

function visibleCells(
  floor: FloorData,
  bigmap: boolean,
  viewportOffset: readonly [number, number],
  viewportSize: readonly [number, number],
) {
  const floorWidth = (floor.width ?? GRID_COUNT) as number;
  const floorHeight = (floor.height ?? GRID_COUNT) as number;
  const cells: Array<{ cellX: number; cellY: number; drawX: number; drawY: number; size: number }> = [];

  if (bigmap) {
    const size = Math.min(viewportSize[0] / Math.max(floorWidth, 1), viewportSize[1] / Math.max(floorHeight, 1));
    const left = Math.max(0, (viewportSize[0] - floorWidth * size) / 2);
    const top = Math.max(0, (viewportSize[1] - floorHeight * size) / 2);
    for (let y = 0; y < floorHeight; y += 1) {
      for (let x = 0; x < floorWidth; x += 1) {
        cells.push({ cellX: x, cellY: y, drawX: left + x * size, drawY: top + y * size, size });
      }
    }
    return cells;
  }

  const offsetX = Math.floor(viewportOffset[0] / TILE_SIZE);
  const offsetY = Math.floor(viewportOffset[1] / TILE_SIZE);
  const rows = Math.ceil(viewportSize[1] / TILE_SIZE);
  const columns = Math.ceil(viewportSize[0] / TILE_SIZE);
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      const mapX = offsetX + x;
      const mapY = offsetY + y;
      if (mapX >= floorWidth || mapY >= floorHeight) continue;
      cells.push({ cellX: mapX, cellY: mapY, drawX: x * TILE_SIZE, drawY: y * TILE_SIZE, size: TILE_SIZE });
    }
  }
  return cells;
}

function layerAlpha(layer: MapLayerName, activeLayer: MapLayerName): number {
  if (activeLayer === 'map') return 1;
  return layer === activeLayer ? 1 : 0.3;
}

function isAutotileSprite(sprite: ResolvedSpriteInfo): boolean {
  return sprite.images === 'autotile';
}

function sameAutotileId(currId: number | undefined, x: number, y: number, map: unknown): boolean {
  if (!Array.isArray(map)) return true;
  if (x < 0 || y < 0 || y >= map.length) return true;
  const row = map[y];
  if (!Array.isArray(row) || x >= row.length) return true;
  return cellIdnum(row[x]) === currId;
}

function autotileIndexData(status: number, index: number, x: number, y: number, size: number): number[][] | undefined {
  return [
    [[96 * status, 0, 32, 32, x, y, size, size]],
    [
      [96 * status, 3 * 32, 16, 32, x, y, size / 2, size],
      [96 * status + 2 * 32 + 16, 3 * 32, 16, 32, x + size / 2, y, size / 2, size],
    ],
    [
      [96 * status + 2 * 32, 32, 32, 16, x, y, size, size / 2],
      [96 * status + 2 * 32, 3 * 32 + 16, 32, 16, x, y + size / 2, size, size / 2],
    ],
    [[96 * status + 2 * 32, 3 * 32, 32, 32, x, y, size, size]],
    [
      [96 * status, 32, 16, 32, x, y, size / 2, size],
      [96 * status + 2 * 32 + 16, 32, 16, 32, x + size / 2, y, size / 2, size],
    ],
    [
      [96 * status, 2 * 32, 16, 32, x, y, size / 2, size],
      [96 * status + 2 * 32 + 16, 2 * 32, 16, 32, x + size / 2, y, size / 2, size],
    ],
    [[96 * status + 2 * 32, 32, 32, 32, x, y, size, size]],
    [[96 * status + 2 * 32, 2 * 32, 32, 32, x, y, size, size]],
    [
      [96 * status, 32, 32, 16, x, y, size, size / 2],
      [96 * status, 3 * 32 + 16, 32, 16, x, y + size / 2, size, size / 2],
    ],
    [[96 * status, 3 * 32, 32, 32, x, y, size, size]],
    [
      [96 * status + 32, 32, 32, 16, x, y, size, size / 2],
      [96 * status + 32, 3 * 32 + 16, 32, 16, x, y + size / 2, size, size / 2],
    ],
    [[96 * status + 32, 3 * 32, 32, 32, x, y, size, size]],
    [[96 * status, 32, 32, 32, x, y, size, size]],
    [[96 * status, 2 * 32, 32, 32, x, y, size, size]],
    [[96 * status + 32, 32, 32, 32, x, y, size, size]],
    [[96 * status + 32, 2 * 32, 32, 32, x, y, size, size]],
    [[96 * status + 2 * 32, 0, 16, 16, x, y, size / 2, size / 2]],
    [[96 * status + 2 * 32 + 16, 0, 16, 16, x, y, size / 2, size / 2]],
    [[96 * status + 2 * 32 + 16, 16, 16, 16, x, y, size / 2, size / 2]],
    [[96 * status + 2 * 32, 16, 16, 16, x, y, size / 2, size / 2]],
  ][index];
}

function renderAutotileCut(
  data: number[][],
  done: Record<number, true>,
): Array<{ sx: number; sy: number; dx: number; dy: number; width: number; height: number }> {
  const drawData: Array<[number, number] | undefined> = [];

  if (data.length === 2) {
    for (const item of data) {
      let index = item[0] % 32 || item[1] % 32 ? 1 : 0;
      const horizontalCut = item[3] % 32 !== 0;
      if (horizontalCut) {
        index *= 2;
        if (!done[index]) drawData[index] = [item[0], item[1]];
        if (!done[index + 1]) drawData[index + 1] = [item[0] + 16, item[1]];
      } else {
        if (!done[index]) drawData[index] = [item[0], item[1]];
        if (!done[index + 2]) drawData[index + 2] = [item[0], item[1] + 16];
      }
    }
  } else {
    const item = data[0];
    if (!done[0]) drawData[0] = [item[0], item[1]];
    if (!done[1]) drawData[1] = [item[0] + 16, item[1]];
    if (!done[2]) drawData[2] = [item[0], item[1] + 16];
    if (!done[3]) drawData[3] = [item[0] + 16, item[1] + 16];
  }

  return drawData.flatMap((point, index) => {
    if (!point) return [];
    return [
      {
        sx: point[0],
        sy: point[1],
        dx: index % 2,
        dy: Math.floor(index / 2),
        width: 16,
        height: 16,
      },
    ];
  });
}

function autotileParts(
  map: unknown,
  cellX: number,
  cellY: number,
  drawX: number,
  drawY: number,
  size: number,
  currId: number,
): Array<{ sx: number; sy: number; x: number; y: number; width: number; height: number }> {
  const around = (offsetX: number, offsetY: number) =>
    sameAutotileId(currId, cellX + offsetX, cellY + offsetY, map) ? 1 : 0;
  const grid = {
    tl: around(-1, -1),
    t: around(0, -1),
    tr: around(1, -1),
    l: around(-1, 0),
    c: around(0, 0),
    r: around(1, 0),
    bl: around(-1, 1),
    b: around(0, 1),
    br: around(1, 1),
  };
  const done: Record<number, true> = {};
  const parts: Array<{ sx: number; sy: number; x: number; y: number; width: number; height: number }> = [];

  const addCorner = (index: number, quadrant: number, x: number, y: number) => {
    const data = autotileIndexData(0, index, x, y, size)?.[0];
    if (!data) return;
    parts.push({ sx: data[0], sy: data[1], x: data[4], y: data[5], width: size / 2, height: size / 2 });
    done[quadrant] = true;
  };

  if (grid.tl + grid.t + grid.c + grid.l === 3 && !grid.tl) addCorner(16, 0, drawX, drawY);
  if (grid.t + grid.tr + grid.r + grid.c === 3 && !grid.tr) addCorner(17, 1, drawX + size / 2, drawY);
  if (grid.c + grid.r + grid.br + grid.b === 3 && !grid.br) addCorner(18, 3, drawX + size / 2, drawY + size / 2);
  if (grid.l + grid.c + grid.b + grid.bl === 3 && !grid.bl) addCorner(19, 2, drawX, drawY + size / 2);

  const index = grid.t + 2 * grid.l + 4 * grid.b + 8 * grid.r;
  const data = autotileIndexData(0, index, drawX, drawY, size);
  if (!data) return parts;

  for (const part of renderAutotileCut(data, done)) {
    parts.push({
      sx: part.sx,
      sy: part.sy,
      x: drawX + (part.dx * size) / 2,
      y: drawY + (part.dy * size) / 2,
      width: size / 2,
      height: size / 2,
    });
  }
  return parts;
}

function buildRenderCells(
  floor: FloorData,
  blockRegistry: BlockRegistry,
  spriteRegistry: SpriteRegistry,
  textures: Map<string, Texture>,
  tilesets: readonly string[],
  activeLayer: MapLayerName,
  bigmap: boolean,
  viewportOffset: readonly [number, number],
  viewportSize: readonly [number, number],
  imageNameMap: Readonly<Record<string, string>>,
  layers: readonly MapLayerDefinition[],
): { renderCells: RenderCell[]; missingCells: MissingCell[]; diagnostics: string[] } {
  const renderCells: RenderCell[] = [];
  const missingCells: MissingCell[] = [];
  const diagnostics = new Set<string>();
  const defaultGround = resolveDefaultGroundSprite(floor, blockRegistry, spriteRegistry, tilesets);

  const textureSizes = new Map(
    [...textures].map(([path, texture]) => [path, { width: texture.width, height: texture.height }]),
  );
  const floorImages = resolveFloorImageParts(floor.images, textureSizes, imageNameMap);
  for (const diagnostic of floorImages.diagnostics) diagnostics.add(diagnostic);
  const eventLayerIndex = Math.max(
    0,
    layers.findIndex((layer) => layer.property === 'map'),
  );
  const foregroundImageOrder = 25 + eventLayerIndex * 10;
  for (const part of floorImages.parts) {
    const baseTexture = textures.get(part.path);
    if (!baseTexture) continue;
    const frame = frameTexture(baseTexture, part.sourceX, part.sourceY, part.sourceWidth, part.sourceHeight, part.path);
    if (typeof frame === 'string') {
      diagnostics.add(frame);
      continue;
    }
    const rect = floorImageViewportRect(part, floor, bigmap, viewportOffset, viewportSize);
    renderCells.push({
      key: part.key,
      texture: frame,
      ...rect,
      alpha: layerAlpha(part.layer === 'bg' ? 'bgmap' : 'fgmap', activeLayer),
      order: part.layer === 'bg' ? 10 : foregroundImageOrder,
      reverse: part.reverse,
    });
  }

  for (const loc of visibleCells(floor, bigmap, viewportOffset, viewportSize)) {
    const defaultSprite = defaultGround;
    if (defaultSprite) {
      const sprite = defaultSprite;
      if (!sprite) continue;
      if (typeof sprite === 'string') {
        diagnostics.add(sprite);
        missingCells.push({
          key: `${loc.cellX},${loc.cellY}:${sprite}`,
          x: loc.drawX,
          y: loc.drawY,
          size: loc.size,
          message: sprite,
        });
        continue;
      }

      const baseTexture = textures.get(sprite.path);
      if (!baseTexture) {
        const message = `Missing material texture: ${sprite.path}`;
        diagnostics.add(message);
        missingCells.push({
          key: `${loc.cellX},${loc.cellY}:${message}`,
          x: loc.drawX,
          y: loc.drawY,
          size: loc.size,
          message,
        });
        continue;
      }

      const frame = textureFrame(baseTexture, sprite);
      if (typeof frame === 'string') {
        diagnostics.add(frame);
        missingCells.push({
          key: `${loc.cellX},${loc.cellY}:${frame}`,
          x: loc.drawX,
          y: loc.drawY,
          size: loc.size,
          message: frame,
        });
        continue;
      }

      renderCells.push({
        key: `${loc.cellX},${loc.cellY}:${sprite.path}:${sprite.x}:${sprite.y}`,
        texture: frame,
        x: loc.drawX,
        y: loc.drawY - Math.max(0, sprite.height - 32) * (loc.size / 32),
        width: loc.size,
        height: sprite.height * (loc.size / 32),
        alpha: 1,
        order: 0,
      });
    }

    for (const [layerIndex, definition] of layers.entries()) {
      const layerName = definition.property;
      const layerMap = floor[layerName];
      const idnum = cellIdnum(getMapCell(layerMap, loc.cellX, loc.cellY));
      const sprite = resolveCellSprite(idnum, blockRegistry, tilesets);
      const alpha = layerAlpha(layerName, activeLayer);

      if (!sprite) continue;
      if (typeof sprite === 'string') {
        diagnostics.add(sprite);
        missingCells.push({
          key: `${loc.cellX},${loc.cellY}:${layerName}:${sprite}`,
          x: loc.drawX,
          y: loc.drawY,
          size: loc.size,
          message: sprite,
        });
        continue;
      }

      const baseTexture = textures.get(sprite.path);
      if (!baseTexture) {
        const message = `Missing material texture: ${sprite.path}`;
        diagnostics.add(message);
        missingCells.push({
          key: `${loc.cellX},${loc.cellY}:${layerName}:${message}`,
          x: loc.drawX,
          y: loc.drawY,
          size: loc.size,
          message,
        });
        continue;
      }

      if (isAutotileSprite(sprite)) {
        for (const [partIndex, part] of autotileParts(
          layerMap,
          loc.cellX,
          loc.cellY,
          loc.drawX,
          loc.drawY,
          loc.size,
          idnum,
        ).entries()) {
          const frame = frameTexture(baseTexture, part.sx, part.sy, 16, 16, sprite.path);
          if (typeof frame === 'string') {
            diagnostics.add(frame);
            missingCells.push({
              key: `${loc.cellX},${loc.cellY}:${layerName}:${frame}`,
              x: loc.drawX,
              y: loc.drawY,
              size: loc.size,
              message: frame,
            });
            continue;
          }
          renderCells.push({
            key: `${loc.cellX},${loc.cellY}:${layerName}:${sprite.path}:autotile:${partIndex}`,
            texture: frame,
            x: part.x,
            y: part.y,
            width: part.width,
            height: part.height,
            alpha,
            order: 20 + layerIndex * 10,
          });
        }
        continue;
      }

      const frame = textureFrame(baseTexture, sprite);
      if (typeof frame === 'string') {
        diagnostics.add(frame);
        missingCells.push({
          key: `${loc.cellX},${loc.cellY}:${layerName}:${frame}`,
          x: loc.drawX,
          y: loc.drawY,
          size: loc.size,
          message: frame,
        });
        continue;
      }

      renderCells.push({
        key: `${loc.cellX},${loc.cellY}:${layerName}:${sprite.path}:${sprite.x}:${sprite.y}`,
        texture: frame,
        x: loc.drawX,
        y: loc.drawY - Math.max(0, sprite.height - 32) * (loc.size / 32),
        width: loc.size,
        height: sprite.height * (loc.size / 32),
        alpha,
        order: 20 + layerIndex * 10,
      });
    }
  }

  renderCells.sort((left, right) => left.order - right.order);
  return { renderCells, missingCells, diagnostics: [...diagnostics] };
}

export const MapPixiRenderer: FC<MapPixiRendererProps> = ({
  floor,
  blockRegistry,
  spriteRegistry,
  tilesets,
  imageNameMap = {},
  layers,
  activeLayer,
  bigmap,
  viewportOffset,
  viewportSize: requestedViewportSize = DEFAULT_VIEWPORT_SIZE,
}) => {
  const viewportWidth = requestedViewportSize[0];
  const viewportHeight = requestedViewportSize[1];
  const viewportSize = useMemo(() => [viewportWidth, viewportHeight] as const, [viewportHeight, viewportWidth]);
  const rootRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<PixiRenderSession | null>(null);
  const generationRef = useRef(0);
  const [readyGeneration, setReadyGeneration] = useState(0);
  const [initializationError, setInitializationError] = useState<Error | null>(null);
  const paths = useMemo(
    () => collectPaths(floor, blockRegistry, spriteRegistry, tilesets, imageNameMap, layers),
    [floor, blockRegistry, spriteRegistry, tilesets, imageNameMap, layers],
  );
  const textureState = useMaterialTextures(paths);
  const pathsKey = paths.join('\n');
  const renderReady = textureState.pathsKey === pathsKey && !textureState.loading;
  const { renderCells, missingCells, diagnostics } = useMemo(
    () =>
      renderReady
        ? buildRenderCells(
            floor,
            blockRegistry,
            spriteRegistry,
            textureState.textures,
            tilesets,
            activeLayer,
            bigmap,
            viewportOffset,
            viewportSize,
            imageNameMap,
            layers,
          )
        : { renderCells: [], missingCells: [], diagnostics: [] },
    [
      renderReady,
      floor,
      blockRegistry,
      spriteRegistry,
      textureState.textures,
      tilesets,
      activeLayer,
      bigmap,
      viewportOffset,
      viewportSize,
      imageNameMap,
      layers,
    ],
  );

  const allDiagnostics =
    textureState.pathsKey === pathsKey && !textureState.loading ? [...textureState.diagnostics, ...diagnostics] : [];

  useEffect(() => {
    let initialized = false;
    const root = rootRef.current;
    if (!root) return undefined;

    const pooled = acquirePixiApplication();
    const app = pooled?.app ?? new PixiApplication();
    const session: PixiRenderSession = {
      app,
      generation: generationRef.current + 1,
      scene: pooled?.scene ?? null,
      disposed: false,
      reusable: true,
    };
    generationRef.current = session.generation;
    sessionRef.current = session;

    const activate = (scene: Container) => {
      initialized = true;
      session.scene = scene;
      if (session.disposed || sessionRef.current !== session) {
        releasePixiApplication(app, scene);
        return;
      }
      app.renderer.resize(viewportWidth, viewportHeight);
      app.canvas.style.display = 'block';
      app.canvas.style.imageRendering = 'pixelated';
      app.canvas.style.visibility = 'hidden';
      root.appendChild(app.canvas);
      setReadyGeneration(session.generation);
    };

    if (pooled) {
      activate(pooled.scene);
    } else
      void app
        .init({
          width: viewportWidth,
          height: viewportHeight,
          backgroundAlpha: 0,
          antialias: false,
          autoDensity: false,
          preference: 'webgl',
          preserveDrawingBuffer: true,
          autoStart: false,
        })
        .then(() => {
          const scene = new Container();
          app.stage.addChild(scene);
          activate(scene);
        })
        .catch((error: unknown) => {
          if (session.disposed || sessionRef.current !== session) return;
          session.disposed = true;
          sessionRef.current = null;
          setInitializationError(error instanceof Error ? error : new Error(String(error)));
        });

    return () => {
      session.disposed = true;
      if (sessionRef.current === session) sessionRef.current = null;
      if (initialized && session.scene) {
        if (session.reusable) releasePixiApplication(app, session.scene);
        else abandonPixiApplication(app);
      }
    };
  }, [viewportHeight, viewportWidth]);

  useEffect(() => {
    if (!renderReady) return;
    const session = sessionRef.current;
    if (!session || session.disposed || session.generation !== readyGeneration || !session.scene) return;
    const { app, scene } = session;

    const previousChildren = scene.removeChildren();

    const background = new Graphics();
    background.rect(0, 0, viewportWidth, viewportHeight);
    background.fill({ color: 0xf4f5f7 });
    scene.addChild(background);

    for (const cell of renderCells) {
      const sprite = new Sprite(cell.texture);
      sprite.x = cell.x;
      sprite.y = cell.y;
      sprite.width = cell.width;
      sprite.height = cell.height;
      sprite.alpha = cell.alpha;
      if (cell.reverse) {
        sprite.anchor.set(0.5);
        sprite.x += cell.width / 2;
        sprite.y += cell.height / 2;
        if (cell.reverse === ':x' || cell.reverse === ':o') sprite.scale.x *= -1;
        if (cell.reverse === ':y' || cell.reverse === ':o') sprite.scale.y *= -1;
      }
      sprite.roundPixels = true;
      scene.addChild(sprite);
    }

    const grid = new Graphics();
    grid.setStrokeStyle({ color: 0x242f42, alpha: 0.16, width: 1 });
    for (const loc of visibleCells(floor, bigmap, viewportOffset, viewportSize)) {
      grid.rect(loc.drawX + 0.5, loc.drawY + 0.5, loc.size - 1, loc.size - 1);
    }
    grid.stroke();
    scene.addChild(grid);

    if (missingCells.length > 0) {
      const missing = new Graphics();
      for (const cell of missingCells) {
        missing.setStrokeStyle({ color: 0xe60012, alpha: 1, width: 2 });
        missing.rect(cell.x + 2, cell.y + 2, Math.max(1, cell.size - 4), Math.max(1, cell.size - 4));
        missing.moveTo(cell.x + 5, cell.y + 5);
        missing.lineTo(cell.x + cell.size - 5, cell.y + cell.size - 5);
        missing.moveTo(cell.x + cell.size - 5, cell.y + 5);
        missing.lineTo(cell.x + 5, cell.y + cell.size - 5);
        missing.stroke();
      }
      scene.addChild(missing);
    }

    if (sessionRef.current === session && !session.disposed) {
      try {
        app.render();
      } catch (error) {
        session.reusable = false;
        throw error;
      }
      app.canvas.style.visibility = 'visible';
      destroyDisplayObjects(previousChildren);
    }
  }, [
    readyGeneration,
    renderReady,
    renderCells,
    missingCells,
    floor,
    bigmap,
    viewportOffset,
    viewportSize,
    viewportHeight,
    viewportWidth,
  ]);

  if (initializationError) throw initializationError;

  return (
    <div
      ref={rootRef}
      className="gameCanvas"
      id="ebm"
      data-test-id="map-pixi-renderer"
      style={{ width: viewportWidth, height: viewportHeight, lineHeight: 0 }}
    >
      {allDiagnostics.length > 0 && (
        <div
          data-test-id="map-render-diagnostics"
          style={{
            position: 'absolute',
            left: 4,
            top: 4,
            zIndex: 80,
            maxWidth: viewportWidth - 8,
            padding: '3px 5px',
            color: '#e60012',
            background: 'rgba(255,255,255,0.9)',
            fontSize: 12,
            lineHeight: '14px',
            pointerEvents: 'none',
          }}
        >
          {allDiagnostics.slice(0, 4).join(' / ')}
        </div>
      )}
    </div>
  );
};
