import type { PersistStatus } from '@/project/data/DataResource';
import type { LoadableResource } from '@/project/resources';

export interface ImageAssetSnapshot {
  bytes: Uint8Array;
  revision: number;
}

export interface AssetDirectorySnapshot {
  entries: string[];
  revision: number;
}

export interface AssetDirectoryResourceLike extends LoadableResource<AssetDirectorySnapshot> {
  readonly id: string;
  readonly path: string;
}

export interface RasterImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface RasterCodec {
  decode(bytes: Uint8Array): Promise<RasterImage>;
  encode(image: RasterImage): Promise<Uint8Array>;
  fromSource(source: CanvasImageSource): RasterImage;
}

export interface ImageAssetResourceLike extends LoadableResource<ImageAssetSnapshot> {
  readonly id: string;
  readonly path: string;
  persistStatus(): PersistStatus;
  setBytes(bytes: Uint8Array): void;
  delete(): Promise<void>;
}

export type MaterialSlot = { kind: 'sheet-row'; row: number } | { kind: 'file'; name: string };

export interface MaterialAssetEntry {
  key: string;
  images: string;
  path: string;
  slot: MaterialSlot;
  width: number;
  height: number;
}

export interface MaterialCollectionSnapshot {
  images: string;
  revision: number;
  entries: MaterialAssetEntry[];
}

export interface MaterialMutation {
  entry?: MaterialAssetEntry;
  removed?: MaterialAssetEntry;
  rowRemap: Map<number, number>;
  revision: number;
}

export interface MaterialCollectionAppendOptions {
  name?: string;
}

export interface MaterialCollectionResource extends LoadableResource<MaterialCollectionSnapshot> {
  readonly id: string;
  readonly images: string;
  persistStatus(): PersistStatus;
  entries(): MaterialAssetEntry[];
  read(entry: MaterialAssetEntry): Promise<RasterImage>;
  append(image: RasterImage, options?: MaterialCollectionAppendOptions): Promise<MaterialMutation>;
  insert(entry: MaterialAssetEntry, image: RasterImage): Promise<MaterialMutation>;
  replace(entry: MaterialAssetEntry, image: RasterImage): Promise<MaterialMutation>;
  remove(entry: MaterialAssetEntry): Promise<MaterialMutation>;
}
