import { fs as defaultFs, type Fs } from '@/services/fs';
import { CanvasRasterCodec } from './CanvasRasterCodec';
import { ImageAssetResource } from './ImageAssetResource';
import { AutotileMaterialCollection, SpriteSheetMaterialCollection } from './MaterialCollectionResource';
import type { MaterialCollectionResource, RasterCodec } from './types';
import { AssetDirectoryResource } from './AssetDirectoryResource';
import { AnimationAssetResource } from './AnimationAssetResource';

export class ProjectAssets {
  private readonly fs: Fs;
  private readonly codec: RasterCodec;
  private readonly images = new Map<string, ImageAssetResource>();
  private readonly collections = new Map<string, MaterialCollectionResource>();
  private readonly directories = new Map<string, AssetDirectoryResource>();
  private readonly animations = new Map<string, AnimationAssetResource>();

  constructor(fs: Fs = defaultFs, codec: RasterCodec = new CanvasRasterCodec()) {
    this.fs = fs;
    this.codec = codec;
  }

  image(path: string): ImageAssetResource {
    const normalized = path.replace(/^\.\//, '');
    let resource = this.images.get(normalized);
    if (!resource) {
      resource = new ImageAssetResource(normalized, this.fs);
      this.images.set(normalized, resource);
    }
    return resource;
  }

  directory(path: string): AssetDirectoryResource {
    const normalized = path.replace(/^\.\//, '').replace(/\/*$/, '/');
    let resource = this.directories.get(normalized);
    if (!resource) {
      resource = new AssetDirectoryResource(normalized, this.fs);
      this.directories.set(normalized, resource);
    }
    return resource;
  }

  animation(path: string): AnimationAssetResource {
    const normalized = path.replace(/^\.\//, '');
    let resource = this.animations.get(normalized);
    if (!resource) {
      resource = new AnimationAssetResource(normalized, this.image(normalized));
      this.animations.set(normalized, resource);
    }
    return resource;
  }

  materialCollection(images: string): MaterialCollectionResource {
    let collection = this.collections.get(images);
    if (collection) return collection;
    if (images === 'autotile') {
      collection = new AutotileMaterialCollection({
        fs: this.fs,
        codec: this.codec,
        image: (path) => this.image(path),
        release: (path) => this.release(path),
      });
    } else {
      collection = new SpriteSheetMaterialCollection(images, this.image(`project/materials/${images}.png`), this.codec);
    }
    this.collections.set(images, collection);
    return collection;
  }

  rasterCodec(): RasterCodec {
    return this.codec;
  }

  release(path: string): void {
    this.images.delete(path.replace(/^\.\//, ''));
  }

  reset(): void {
    this.images.clear();
    this.collections.clear();
    this.directories.clear();
    this.animations.clear();
  }
}

export const projectAssets = new ProjectAssets();
