import {
  cloneRaster,
  type MaterialCollectionAppendOptions,
  type MaterialAssetEntry,
  type MaterialCollectionResource,
  type MaterialMutation,
  type RasterImage,
} from '@/project/assets';
import { operationPathTarget, type AppliedOperation, type EditorOperation, type OperationMeta } from './operations';

function collectionPath(collection: MaterialCollectionResource, entry?: MaterialAssetEntry): string {
  if (entry) return entry.path;
  return collection.images === 'autotile' ? 'project/autotiles' : `project/materials/${collection.images}.png`;
}

function collectionTarget(collection: MaterialCollectionResource, entry?: MaterialAssetEntry) {
  return operationPathTarget(`material:${collection.id}`, collectionPath(collection, entry));
}

function currentEntry(collection: MaterialCollectionResource, requested: MaterialAssetEntry): MaterialAssetEntry {
  const entry = collection.entries().find((candidate) => {
    if (candidate.slot.kind !== requested.slot.kind) return false;
    if (candidate.slot.kind === 'sheet-row' && requested.slot.kind === 'sheet-row') {
      return candidate.slot.row === requested.slot.row;
    }
    if (candidate.slot.kind === 'file' && requested.slot.kind === 'file') {
      return candidate.slot.name === requested.slot.name;
    }
    return false;
  });
  if (!entry) throw new Error(`Material entry no longer exists: ${requested.key}`);
  return entry;
}

class AppendMaterialOperation implements EditorOperation<MaterialMutation> {
  readonly targets;
  readonly meta: OperationMeta;
  private readonly collection: MaterialCollectionResource;
  private readonly image: RasterImage;
  private readonly options?: MaterialCollectionAppendOptions;

  constructor(
    meta: OperationMeta,
    collection: MaterialCollectionResource,
    image: RasterImage,
    options?: MaterialCollectionAppendOptions,
  ) {
    this.meta = meta;
    this.collection = collection;
    this.image = image;
    this.options = options;
    this.targets = [collectionTarget(collection)];
  }

  async apply(): Promise<AppliedOperation<MaterialMutation>> {
    const mutation = await this.collection.append(cloneRaster(this.image), this.options);
    if (!mutation.entry) throw new Error('Material append did not create an entry');
    return {
      value: mutation,
      inverse: new RemoveMaterialOperation(this.meta, this.collection, mutation.entry),
      changed: true,
    };
  }
}

class InsertMaterialOperation implements EditorOperation<MaterialMutation> {
  readonly targets;
  readonly meta: OperationMeta;
  private readonly collection: MaterialCollectionResource;
  private readonly entry: MaterialAssetEntry;
  private readonly image: RasterImage;

  constructor(
    meta: OperationMeta,
    collection: MaterialCollectionResource,
    entry: MaterialAssetEntry,
    image: RasterImage,
  ) {
    this.meta = meta;
    this.collection = collection;
    this.entry = entry;
    this.image = image;
    this.targets = [collectionTarget(collection, entry)];
  }

  async apply(): Promise<AppliedOperation<MaterialMutation>> {
    const mutation = await this.collection.insert(this.entry, cloneRaster(this.image));
    if (!mutation.entry) throw new Error('Material insert did not restore an entry');
    return {
      value: mutation,
      inverse: new RemoveMaterialOperation(this.meta, this.collection, mutation.entry),
      changed: true,
    };
  }
}

class RemoveMaterialOperation implements EditorOperation<MaterialMutation> {
  readonly targets;
  readonly meta: OperationMeta;
  private readonly collection: MaterialCollectionResource;
  private readonly entry: MaterialAssetEntry;

  constructor(meta: OperationMeta, collection: MaterialCollectionResource, entry: MaterialAssetEntry) {
    this.meta = meta;
    this.collection = collection;
    this.entry = entry;
    this.targets = [collectionTarget(collection, entry)];
  }

  async apply(): Promise<AppliedOperation<MaterialMutation>> {
    const entry = currentEntry(this.collection, this.entry);
    const image = await this.collection.read(entry);
    const mutation = await this.collection.remove(entry);
    return {
      value: mutation,
      inverse: new InsertMaterialOperation(this.meta, this.collection, entry, image),
      changed: true,
    };
  }
}

class ReplaceMaterialOperation implements EditorOperation<MaterialMutation> {
  readonly targets;
  readonly meta: OperationMeta;
  private readonly collection: MaterialCollectionResource;
  private readonly entry: MaterialAssetEntry;
  private readonly replacement: RasterImage;

  constructor(
    meta: OperationMeta,
    collection: MaterialCollectionResource,
    entry: MaterialAssetEntry,
    replacement: RasterImage,
  ) {
    this.meta = meta;
    this.collection = collection;
    this.entry = entry;
    this.replacement = replacement;
    this.targets = [collectionTarget(collection, entry)];
  }

  async apply(): Promise<AppliedOperation<MaterialMutation>> {
    const entry = currentEntry(this.collection, this.entry);
    const previous = await this.collection.read(entry);
    const mutation = await this.collection.replace(entry, cloneRaster(this.replacement));
    if (!mutation.entry) throw new Error('Material replace did not return an entry');
    return {
      value: mutation,
      inverse: new ReplaceMaterialOperation(this.meta, this.collection, mutation.entry, previous),
      changed: true,
    };
  }
}

export function appendMaterialOperation(
  collection: MaterialCollectionResource,
  image: RasterImage,
  options: MaterialCollectionAppendOptions | undefined,
  meta: OperationMeta,
): EditorOperation<MaterialMutation> {
  return new AppendMaterialOperation(meta, collection, image, options);
}

export function removeMaterialOperation(
  collection: MaterialCollectionResource,
  entry: MaterialAssetEntry,
  meta: OperationMeta,
): EditorOperation<MaterialMutation> {
  return new RemoveMaterialOperation(meta, collection, entry);
}

export function replaceMaterialOperation(
  collection: MaterialCollectionResource,
  entry: MaterialAssetEntry,
  replacement: RasterImage,
  meta: OperationMeta,
): EditorOperation<MaterialMutation> {
  return new ReplaceMaterialOperation(meta, collection, entry, replacement);
}
