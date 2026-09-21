import type { Content } from '@/fs/types';
import { readPngDimensions } from '@/project/assets';
import type { ImageAssetSnapshot } from '@/project/assets';
import type { ProjectDiagnostic } from './projectModel';

export const TILESET_START_OFFSET = 10000;
export const TILESET_OFFSET_STEP = 10000;

export interface TilesetCatalogEntry {
  name: string;
  path: string;
  index: number;
  startIdnum: number;
  width: number;
  height: number;
  columns: number;
  rows: number;
}

export interface TilesetCatalog {
  entries: TilesetCatalogEntry[];
  byName: Map<string, TilesetCatalogEntry>;
  diagnostics: ProjectDiagnostic[];
}

export function tilesetStartIdnum(index: number): number {
  return TILESET_START_OFFSET + index * TILESET_OFFSET_STEP;
}

export function tilesetCellIdnum(entry: TilesetCatalogEntry, x: number, y: number): number {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0) {
    throw new Error(`Invalid tileset position: ${x},${y}`);
  }
  if (x >= entry.columns || y >= entry.rows) {
    throw new Error(`Tileset position outside ${entry.name}: ${x},${y}`);
  }
  const localIndex = y * entry.columns + x;
  if (localIndex >= TILESET_OFFSET_STEP) {
    throw new Error(`Tileset ${entry.name} exceeds its idnum range`);
  }
  return entry.startIdnum + localIndex;
}

export function buildTilesetCatalog(
  names: readonly string[],
  imageContents: ReadonlyMap<string, Content<ImageAssetSnapshot>>,
): Content<TilesetCatalog> {
  const entries: TilesetCatalogEntry[] = [];
  const diagnostics: ProjectDiagnostic[] = [];
  let pending: 'idle' | 'loading' | null = null;

  names.forEach((name, index) => {
    const path = `project/tilesets/${name}`;
    const content = imageContents.get(path);
    if (!content || content.status === 'idle' || content.status === 'loading') {
      if (!content || content.status === 'idle') pending = 'idle';
      else if (pending !== 'idle') pending = 'loading';
      return;
    }
    if (content.status !== 'loaded') {
      diagnostics.push({
        source: `tileset:${name}`,
        severity: 'error',
        message: content.status === 'error' ? content.error.message : `Missing tileset ${path}`,
      });
      return;
    }
    try {
      const { width, height } = readPngDimensions(content.value.bytes);
      if (width % 32 !== 0 || height % 32 !== 0) {
        throw new Error(`${name} width and height must be multiples of 32`);
      }
      const columns = width / 32;
      const rows = height / 32;
      if (columns * rows >= TILESET_OFFSET_STEP) {
        throw new Error(`${name} contains too many cells for one tileset idnum range`);
      }
      if (columns * rows > 3000) {
        diagnostics.push({
          source: `tileset:${name}`,
          severity: 'warning',
          message: `${name} contains more than 3000 cells`,
        });
      }
      entries.push({
        name,
        path,
        index,
        startIdnum: tilesetStartIdnum(index),
        width,
        height,
        columns,
        rows,
      });
    } catch (error) {
      diagnostics.push({
        source: `tileset:${name}`,
        severity: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  if (pending) return { status: pending };
  return {
    status: 'loaded',
    value: {
      entries,
      byName: new Map(entries.map((entry) => [entry.name, entry])),
      diagnostics,
    },
  };
}
