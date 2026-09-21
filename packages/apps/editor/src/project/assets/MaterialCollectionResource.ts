import { computed, effect, signal } from 'alien-signals';
import { ContentUtils } from '@/fs/ContentUtils';
import type { ReadonlySignal } from '@/fs/interfaces';
import type { Content } from '@/fs/types';
import type { PersistStatus } from '@/project/data/DataResource';
import type { Fs } from '@/services/fs';
import { waitUntil } from '@/utils/base/signal';
import {
  appendRasterRow,
  assertSheetShape,
  cropRaster,
  insertRasterRow,
  readPngDimensions,
  removeRasterRow,
  replaceRasterRow,
} from './raster';
import { materialRowHeight } from './materialSpecs';
import type {
  ImageAssetResourceLike,
  MaterialCollectionAppendOptions,
  MaterialAssetEntry,
  MaterialCollectionResource,
  MaterialCollectionSnapshot,
  MaterialMutation,
  RasterCodec,
  RasterImage,
} from './types';

function emptyRemap(): Map<number, number> {
  return new Map<number, number>();
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

async function ensureImage(resource: ImageAssetResourceLike): Promise<void> {
  await resource.ensureLoaded();
}

abstract class BaseMaterialCollection implements MaterialCollectionResource {
  abstract readonly id: string;
  abstract readonly images: string;
  abstract readonly content: ReadonlySignal<Content<MaterialCollectionSnapshot>>;
  abstract snapshot(): Content<MaterialCollectionSnapshot>;
  abstract ensureLoaded(): Promise<void>;
  abstract reload(): Promise<void>;
  abstract persistStatus(): PersistStatus;
  abstract read(entry: MaterialAssetEntry): Promise<RasterImage>;
  abstract append(image: RasterImage, options?: MaterialCollectionAppendOptions): Promise<MaterialMutation>;
  abstract insert(entry: MaterialAssetEntry, image: RasterImage): Promise<MaterialMutation>;
  abstract replace(entry: MaterialAssetEntry, image: RasterImage): Promise<MaterialMutation>;
  abstract remove(entry: MaterialAssetEntry): Promise<MaterialMutation>;

  value(): MaterialCollectionSnapshot {
    return ContentUtils.unwrap(this.snapshot(), this.id);
  }

  subscribe(listener: (content: Content<MaterialCollectionSnapshot>) => void): () => void {
    return effect(() => listener(this.content()));
  }

  async waitForSettled(): Promise<void> {
    await waitUntil(() => !['idle', 'loading'].includes(this.snapshot().status));
  }

  entries(): MaterialAssetEntry[] {
    return this.value().entries;
  }
}

export class SpriteSheetMaterialCollection extends BaseMaterialCollection {
  readonly id: string;
  readonly images: string;
  readonly content: ReadonlySignal<Content<MaterialCollectionSnapshot>>;
  private readonly image: ImageAssetResourceLike;
  private readonly codec: RasterCodec;
  private readonly rowHeight: number;
  private mutationQueue: Promise<void> = Promise.resolve();

  constructor(images: string, image: ImageAssetResourceLike, codec: RasterCodec) {
    super();
    this.id = `material-sheet:${images}`;
    this.images = images;
    this.image = image;
    this.codec = codec;
    this.rowHeight = materialRowHeight(images);
    this.content = computed(() => {
      const content = image.content();
      if (content.status !== 'loaded') return content as Content<MaterialCollectionSnapshot>;
      try {
        const dimensions = readPngDimensions(content.value.bytes);
        const rowCount = assertSheetShape(dimensions, this.rowHeight);
        const entries = Array.from({ length: rowCount }, (_, row): MaterialAssetEntry => ({
          key: `${images}:row:${row}`,
          images,
          path: image.path,
          slot: { kind: 'sheet-row', row },
          width: dimensions.width,
          height: this.rowHeight,
        }));
        return {
          status: 'loaded',
          value: { images, revision: content.value.revision, entries },
        };
      } catch (error) {
        return { status: 'error', error: toError(error) };
      }
    });
  }

  snapshot(): Content<MaterialCollectionSnapshot> {
    return this.content();
  }

  async reload(): Promise<void> {
    await this.image.reload();
  }

  async ensureLoaded(): Promise<void> {
    await this.image.ensureLoaded();
  }

  persistStatus(): PersistStatus {
    return this.image.persistStatus();
  }

  async read(entry: MaterialAssetEntry): Promise<RasterImage> {
    const row = this.assertEntry(entry);
    await ensureImage(this.image);
    const raster = await this.codec.decode(this.image.value().bytes);
    return cropRaster(raster, 0, row * this.rowHeight, raster.width, this.rowHeight);
  }

  append(row: RasterImage): Promise<MaterialMutation> {
    return this.enqueue(async () => {
      await ensureImage(this.image);
      const current = await this.codec.decode(this.image.value().bytes);
      assertSheetShape(current, this.rowHeight);
      if (row.width !== current.width || row.height !== this.rowHeight) {
        throw new Error(`Material row must be ${current.width}x${this.rowHeight}`);
      }
      const oldRowCount = current.height / this.rowHeight;
      this.image.setBytes(await this.codec.encode(appendRasterRow(current, row)));
      return {
        entry: this.value().entries[oldRowCount],
        rowRemap: emptyRemap(),
        revision: this.image.value().revision,
      };
    });
  }

  insert(entry: MaterialAssetEntry, inserted: RasterImage): Promise<MaterialMutation> {
    return this.enqueue(async () => {
      if (entry.images !== this.images || entry.slot.kind !== 'sheet-row') {
        throw new Error(`Material entry does not belong to ${this.images}`);
      }
      await ensureImage(this.image);
      const current = await this.codec.decode(this.image.value().bytes);
      const { image, rowRemap } = insertRasterRow(current, this.rowHeight, entry.slot.row, inserted);
      this.image.setBytes(await this.codec.encode(image));
      return {
        entry: this.value().entries[entry.slot.row],
        rowRemap,
        revision: this.image.value().revision,
      };
    });
  }

  replace(entry: MaterialAssetEntry, replacement: RasterImage): Promise<MaterialMutation> {
    return this.enqueue(async () => {
      const row = this.assertEntry(entry);
      await ensureImage(this.image);
      const current = await this.codec.decode(this.image.value().bytes);
      this.image.setBytes(await this.codec.encode(replaceRasterRow(current, this.rowHeight, row, replacement)));
      return {
        entry: this.value().entries[row],
        rowRemap: emptyRemap(),
        revision: this.image.value().revision,
      };
    });
  }

  remove(entry: MaterialAssetEntry): Promise<MaterialMutation> {
    return this.enqueue(async () => {
      const row = this.assertEntry(entry);
      await ensureImage(this.image);
      const current = await this.codec.decode(this.image.value().bytes);
      const { image, rowRemap } = removeRasterRow(current, this.rowHeight, row);
      this.image.setBytes(await this.codec.encode(image));
      return { removed: entry, rowRemap, revision: this.image.value().revision };
    });
  }

  private assertEntry(entry: MaterialAssetEntry): number {
    if (entry.images !== this.images || entry.slot.kind !== 'sheet-row') {
      throw new Error(`Material entry does not belong to ${this.images}`);
    }
    return entry.slot.row;
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.mutationQueue.then(operation, operation);
    this.mutationQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

interface AutotileCollectionDependencies {
  fs: Fs;
  codec: RasterCodec;
  image(path: string): ImageAssetResourceLike;
  release(path: string): void;
}

export class AutotileMaterialCollection extends BaseMaterialCollection {
  readonly id = 'material-directory:autotile';
  readonly images = 'autotile';
  readonly content: ReadonlySignal<Content<MaterialCollectionSnapshot>>;
  private readonly mutableContent = signal<Content<MaterialCollectionSnapshot>>({ status: 'idle' });
  private readonly dependencies: AutotileCollectionDependencies;
  private mutationQueue: Promise<void> = Promise.resolve();
  private revision = 0;

  constructor(dependencies: AutotileCollectionDependencies) {
    super();
    this.dependencies = dependencies;
    this.content = this.mutableContent as ReadonlySignal<Content<MaterialCollectionSnapshot>>;
  }

  snapshot(): Content<MaterialCollectionSnapshot> {
    return this.mutableContent();
  }

  async reload(): Promise<void> {
    if (this.mutableContent().status === 'loading') {
      await this.waitForSettled();
      return;
    }
    this.mutableContent({ status: 'loading' });
    try {
      const files = (await this.dependencies.fs.promises.readdir('project/autotiles'))
        .map((file) => file.replace(/\\/g, '/').split('/').pop() ?? file)
        .filter((file) => file.toLowerCase().endsWith('.png'))
        .sort();
      const entries = await Promise.all(
        files.map(async (file) => {
          const path = `project/autotiles/${file}`;
          const resource = this.dependencies.image(path);
          await ensureImage(resource);
          const { width, height } = readPngDimensions(resource.value().bytes);
          return this.fileEntry(file.replace(/\.png$/i, ''), width, height);
        }),
      );
      this.revision += 1;
      this.mutableContent({ status: 'loaded', value: { images: this.images, revision: this.revision, entries } });
    } catch (error) {
      this.mutableContent({ status: 'error', error: toError(error) });
    }
  }

  async ensureLoaded(): Promise<void> {
    const content = this.snapshot();
    if (content.status === 'idle') await this.reload();
    else if (content.status === 'loading') await this.waitForSettled();
  }

  persistStatus(): PersistStatus {
    if (this.snapshot().status !== 'loaded') return { status: 'unknown' };
    let pending = 0;
    for (const entry of this.entries()) {
      const status = this.dependencies.image(entry.path).persistStatus();
      if (status.status === 'error') return status;
      if (status.status === 'persisting') pending += status.pending ?? 1;
    }
    return pending > 0 ? { status: 'persisting', pending } : { status: 'idle' };
  }

  async read(entry: MaterialAssetEntry): Promise<RasterImage> {
    const name = this.assertEntry(entry);
    const resource = this.dependencies.image(`project/autotiles/${name}.png`);
    await ensureImage(resource);
    return this.dependencies.codec.decode(resource.value().bytes);
  }

  append(image: RasterImage, options?: MaterialCollectionAppendOptions): Promise<MaterialMutation> {
    return this.enqueue(async () => {
      this.assertAutotile(image);
      await this.ensureValueLoaded();
      const name = options?.name ?? this.nextName();
      if (this.entries().some((entry) => entry.slot.kind === 'file' && entry.slot.name === name)) {
        throw new Error(`Autotile already exists: ${name}`);
      }
      const path = `project/autotiles/${name}.png`;
      const resource = this.dependencies.image(path);
      resource.setBytes(await this.dependencies.codec.encode(image));
      const entry = this.fileEntry(name, image.width, image.height);
      this.updateEntries([...this.entries(), entry]);
      return { entry, rowRemap: emptyRemap(), revision: this.revision };
    });
  }

  insert(entry: MaterialAssetEntry, image: RasterImage): Promise<MaterialMutation> {
    if (entry.images !== this.images || entry.slot.kind !== 'file') {
      return Promise.reject(new Error('Material entry does not belong to autotile'));
    }
    return this.append(image, { name: entry.slot.name });
  }

  replace(entry: MaterialAssetEntry, image: RasterImage): Promise<MaterialMutation> {
    return this.enqueue(async () => {
      const name = this.assertEntry(entry);
      this.assertAutotile(image);
      const resource = this.dependencies.image(`project/autotiles/${name}.png`);
      await ensureImage(resource);
      resource.setBytes(await this.dependencies.codec.encode(image));
      const nextEntry = this.fileEntry(name, image.width, image.height);
      this.updateEntries(this.entries().map((current) => (current.key === entry.key ? nextEntry : current)));
      return { entry: nextEntry, rowRemap: emptyRemap(), revision: this.revision };
    });
  }

  remove(entry: MaterialAssetEntry): Promise<MaterialMutation> {
    return this.enqueue(async () => {
      const name = this.assertEntry(entry);
      const path = `project/autotiles/${name}.png`;
      await this.dependencies.image(path).delete();
      this.dependencies.release(path);
      this.updateEntries(this.entries().filter((current) => current.key !== entry.key));
      return { removed: entry, rowRemap: emptyRemap(), revision: this.revision };
    });
  }

  private async ensureValueLoaded(): Promise<void> {
    await this.ensureLoaded();
    this.value();
  }

  private updateEntries(entries: MaterialAssetEntry[]): void {
    this.revision += 1;
    this.mutableContent({
      status: 'loaded',
      value: {
        images: this.images,
        revision: this.revision,
        entries: [...entries].sort((a, b) => a.key.localeCompare(b.key)),
      },
    });
  }

  private nextName(): string {
    const names = new Set(this.entries().map((entry) => (entry.slot.kind === 'file' ? entry.slot.name : '')));
    for (let index = 1; ; index += 1) {
      const name = `autotile${index}`;
      if (!names.has(name)) return name;
    }
  }

  private assertAutotile(image: RasterImage): void {
    if (image.width <= 0 || image.width % 96 !== 0 || image.height !== 128) {
      throw new Error('Autotile must have a width divisible by 96 and a height of 128');
    }
  }

  private assertEntry(entry: MaterialAssetEntry): string {
    if (entry.images !== this.images || entry.slot.kind !== 'file') {
      throw new Error('Material entry does not belong to autotile');
    }
    return entry.slot.name;
  }

  private fileEntry(name: string, width: number, height: number): MaterialAssetEntry {
    return {
      key: `autotile:file:${name}`,
      images: this.images,
      path: `project/autotiles/${name}.png`,
      slot: { kind: 'file', name },
      width,
      height,
    };
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.mutationQueue.then(operation, operation);
    this.mutationQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
