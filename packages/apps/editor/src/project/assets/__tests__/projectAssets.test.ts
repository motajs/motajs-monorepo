import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryFileSystem } from '@test/utils/MemoryFileSystem';
import { ProjectAssets } from '../projectAssets';
import {
  appendMaterialOperation,
  operationHistory,
  removeMaterialOperation,
  replaceMaterialOperation,
} from '@/project/history';
import { appendRasterRow, cropRaster, insertRasterRow, removeRasterRow, replaceRasterRow } from '../raster';
import type { RasterCodec, RasterImage } from '../types';
import { persistenceMonitor } from '@/fs/PersistenceMonitor';

beforeEach(() => persistenceMonitor.resetForTests());

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

class FakeRasterCodec implements RasterCodec {
  async decode(bytes: Uint8Array): Promise<RasterImage> {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const width = view.getUint32(16);
    const height = view.getUint32(20);
    return {
      width,
      height,
      data: new Uint8ClampedArray(bytes.slice(24)),
    };
  }

  async encode(image: RasterImage): Promise<Uint8Array> {
    const bytes = new Uint8Array(24 + image.data.length);
    bytes.set(PNG_SIGNATURE);
    const view = new DataView(bytes.buffer);
    view.setUint32(16, image.width);
    view.setUint32(20, image.height);
    bytes.set(image.data, 24);
    return bytes;
  }

  fromSource(): RasterImage {
    throw new Error('Not used in this test');
  }
}

function raster(width: number, height: number, value: number): RasterImage {
  return {
    width,
    height,
    data: new Uint8ClampedArray(width * height * 4).fill(value),
  };
}

async function base64Raster(codec: RasterCodec, image: RasterImage): Promise<string> {
  return Buffer.from(await codec.encode(image)).toString('base64');
}

describe('raster material operations', () => {
  it('appends, replaces, crops and removes rows without changing other pixels', () => {
    const first = raster(32, 2, 1);
    const second = raster(32, 2, 2);
    const appended = appendRasterRow(first, second);
    expect([...cropRaster(appended, 0, 0, 32, 2).data]).toEqual([...first.data]);
    expect([...cropRaster(appended, 0, 2, 32, 2).data]).toEqual([...second.data]);

    const replaced = replaceRasterRow(appended, 2, 0, raster(32, 2, 3));
    expect([...cropRaster(replaced, 0, 0, 32, 2).data]).toEqual([...raster(32, 2, 3).data]);
    expect([...cropRaster(replaced, 0, 2, 32, 2).data]).toEqual([...second.data]);

    const removed = removeRasterRow(appended, 2, 0);
    expect([...removed.image.data]).toEqual([...second.data]);
    expect([...removed.rowRemap.entries()]).toEqual([[1, 0]]);

    const inserted = insertRasterRow(appended, 2, 1, raster(32, 2, 4));
    expect([...cropRaster(inserted.image, 0, 2, 32, 2).data]).toEqual([...raster(32, 2, 4).data]);
    expect([...cropRaster(inserted.image, 0, 4, 32, 2).data]).toEqual([...second.data]);
    expect([...inserted.rowRemap.entries()]).toEqual([
      [0, 0],
      [1, 2],
    ]);
  });

  it('rejects incompatible rows and deleting the only row', () => {
    expect(() => appendRasterRow(raster(32, 32, 1), raster(64, 32, 2))).toThrow(/width/);
    expect(() => removeRasterRow(raster(32, 32, 1), 32, 0)).toThrow(/at least one/);
    expect(() => replaceRasterRow(raster(32, 64, 1), 32, 0, raster(32, 48, 2))).toThrow(/incompatible/);
    expect(() => insertRasterRow(raster(32, 64, 1), 32, 3, raster(32, 32, 2))).toThrow(/range/);
  });
});

describe('ProjectAssets', () => {
  it('parses animation documents and persists cue changes without dropping unknown fields', async () => {
    const memory = new MemoryFileSystem();
    const document = {
      ratio: 2,
      custom: { keep: true },
      bitmaps: ['data:image/png;base64,AA=='],
      frame_max: 3,
      frames: [[], [], []],
      se: 'attack.mp3',
    };
    memory.setFile('project/animates/test.animate', Buffer.from(JSON.stringify(document)).toString('base64'));
    const assets = new ProjectAssets(memory.createFsInterface(), new FakeRasterCodec());
    const animation = assets.animation('project/animates/test.animate');
    expect(animation).toBe(assets.animation('project/animates/test.animate'));
    await animation.reload();
    expect(animation.value().cues).toEqual([{ frame: 1, sound: 'attack.mp3', pitch: 100 }]);

    animation.setDocument({
      ...animation.value().document,
      se: { 2: 'zone.mp3' },
      pitch: { 2: 150 },
    });
    await persistenceMonitor.whenQuiescent([animation.path]);
    const persisted = JSON.parse(Buffer.from(memory.getFile('project/animates/test.animate')!, 'base64').toString());
    expect(persisted.custom).toEqual({ keep: true });
    expect(persisted.bitmaps).toEqual(document.bitmaps);
    expect(persisted.se).toEqual({ 2: 'zone.mp3' });
    expect(persisted.pitch).toEqual({ 2: 150 });
  });

  it('keeps animation memory state after persist failure and recovers on the next edit', async () => {
    const memory = new MemoryFileSystem();
    const path = 'project/animates/test.animate';
    memory.setFile(path, Buffer.from(JSON.stringify({ frame_max: 2, frames: [[], []] })).toString('base64'));
    const assets = new ProjectAssets(memory.createFsInterface(), new FakeRasterCodec());
    const animation = assets.animation(path);
    await animation.reload();

    memory.setWriteErrorForPath(path, new Error('animation disk unavailable'));
    animation.setDocument({ ...animation.value().document, se: { 1: 'first.mp3' } });
    await persistenceMonitor.whenQuiescent([animation.path]);
    expect(animation.persistStatus().status).toBe('error');
    expect(animation.value().document.se).toEqual({ 1: 'first.mp3' });

    memory.clearWriteErrorForPath(path);
    animation.setDocument({ ...animation.value().document, se: { 2: 'second.mp3' } });
    await persistenceMonitor.whenQuiescent([animation.path]);
    expect(animation.persistStatus().status).toBe('idle');
    expect(JSON.parse(Buffer.from(memory.getFile(path)!, 'base64').toString()).se).toEqual({ 2: 'second.mp3' });
  });

  it('shares directory resources and reloads sorted project asset names', async () => {
    const memory = new MemoryFileSystem();
    memory.setFile('project/images/z.png', 'z');
    memory.setFile('project/images/a.png', 'a');
    const assets = new ProjectAssets(memory.createFsInterface(), new FakeRasterCodec());
    const directory = assets.directory('./project/images/');

    expect(directory).toBe(assets.directory('project/images'));
    await directory.reload();
    expect(directory.snapshot()).toEqual({
      status: 'loaded',
      value: { entries: ['a.png', 'z.png'], revision: 1 },
    });

    memory.setFile('project/images/m.png', 'm');
    await directory.reload();
    expect(directory.snapshot()).toEqual({
      status: 'loaded',
      value: { entries: ['a.png', 'm.png', 'z.png'], revision: 2 },
    });
  });

  it('shares image resources and serializes concurrent sprite sheet mutations', async () => {
    const memory = new MemoryFileSystem();
    const codec = new FakeRasterCodec();
    memory.setFile('project/materials/items.png', await base64Raster(codec, raster(32, 64, 1)));
    const assets = new ProjectAssets(memory.createFsInterface(), codec);
    expect(assets.image('project/materials/items.png')).toBe(assets.image('project/materials/items.png'));

    const collection = assets.materialCollection('items');
    await collection.reload();
    const [first, second] = await Promise.all([
      collection.append(raster(32, 32, 2)),
      collection.append(raster(32, 32, 3)),
    ]);
    await persistenceMonitor.whenQuiescent();

    expect(first.entry?.slot).toEqual({ kind: 'sheet-row', row: 2 });
    expect(second.entry?.slot).toEqual({ kind: 'sheet-row', row: 3 });
    expect(collection.entries()).toHaveLength(4);
    expect((await collection.read(collection.entries()[3])).data[0]).toBe(3);

    const removed = await collection.remove(collection.entries()[1]);
    await collection.insert(removed.removed!, raster(32, 32, 4));
    expect(collection.entries()).toHaveLength(4);
    expect((await collection.read(collection.entries()[1])).data[0]).toBe(4);
  });

  it('uses 48 pixel rows only for 48 material sheets', async () => {
    const memory = new MemoryFileSystem();
    const codec = new FakeRasterCodec();
    memory.setFile('project/materials/enemys.png', await base64Raster(codec, raster(64, 64, 1)));
    memory.setFile('project/materials/enemy48.png', await base64Raster(codec, raster(128, 96, 1)));
    const assets = new ProjectAssets(memory.createFsInterface(), codec);
    await assets.materialCollection('enemys').reload();
    await assets.materialCollection('enemy48').reload();
    expect(assets.materialCollection('enemys').entries()).toHaveLength(2);
    expect(assets.materialCollection('enemy48').entries()).toHaveLength(2);
  });

  it('keeps failed image writes in memory and clears the error after a later update', async () => {
    const memory = new MemoryFileSystem();
    const codec = new FakeRasterCodec();
    const path = 'project/materials/items.png';
    memory.setFile(path, await base64Raster(codec, raster(32, 32, 1)));
    const assets = new ProjectAssets(memory.createFsInterface(), codec);
    const image = assets.image(path);
    await image.reload();
    memory.setWriteErrorForPath(path, new Error('disk unavailable'));
    image.setBytes(await codec.encode(raster(32, 32, 2)));
    await persistenceMonitor.whenQuiescent([image.path]);
    expect(image.persistStatus().status).toBe('error');
    expect((await codec.decode(image.value().bytes)).data[0]).toBe(2);

    memory.clearWriteErrorForPath(path);
    image.setBytes(await codec.encode(raster(32, 32, 3)));
    await persistenceMonitor.whenQuiescent([image.path]);
    expect(image.persistStatus().status).toBe('idle');
    expect((await codec.decode(new Uint8Array(await memory.readFileBinary(path)))).data[0]).toBe(3);
  });

  it('creates, replaces and deletes autotile files while updating the directory', async () => {
    const memory = new MemoryFileSystem();
    const codec = new FakeRasterCodec();
    memory.setFile('project/autotiles/autotile.png', await base64Raster(codec, raster(96, 128, 1)));
    const assets = new ProjectAssets(memory.createFsInterface(), codec);
    const collection = assets.materialCollection('autotile');
    await collection.reload();

    const appended = await collection.append(raster(192, 128, 2));
    expect(appended.entry?.slot).toEqual({ kind: 'file', name: 'autotile1' });
    expect(collection.entries()).toHaveLength(2);
    await collection.replace(appended.entry!, raster(96, 128, 3));
    expect((await collection.read(appended.entry!)).data[0]).toBe(3);
    await collection.remove(appended.entry!);
    expect(collection.entries()).toHaveLength(1);
    expect(memory.hasFile('project/autotiles/autotile1.png')).toBe(false);
  });

  it('undoes and redoes sprite append, replace and middle-row removal with row payloads', async () => {
    operationHistory.clear();
    const memory = new MemoryFileSystem();
    const codec = new FakeRasterCodec();
    memory.setFile('project/materials/items.png', await base64Raster(codec, raster(32, 96, 1)));
    const assets = new ProjectAssets(memory.createFsInterface(), codec);
    const collection = assets.materialCollection('items');
    await collection.reload();

    const appended = await operationHistory.execute(
      appendMaterialOperation(collection, raster(32, 32, 2), undefined, { label: 'append', stage: 'append' }),
    );
    expect(collection.entries()).toHaveLength(4);
    await operationHistory.undo();
    expect(collection.entries()).toHaveLength(3);
    await operationHistory.redo();
    expect(collection.entries()).toHaveLength(4);
    expect((await collection.read(collection.entries()[3])).data[0]).toBe(2);

    const appendedEntry = appended.entry!;
    await operationHistory.execute(
      replaceMaterialOperation(collection, appendedEntry, raster(32, 32, 3), { label: 'replace', stage: 'replace' }),
    );
    expect((await collection.read(collection.entries()[3])).data[0]).toBe(3);
    await operationHistory.undo();
    expect((await collection.read(collection.entries()[3])).data[0]).toBe(2);
    await operationHistory.redo();
    expect((await collection.read(collection.entries()[3])).data[0]).toBe(3);

    await collection.replace(collection.entries()[0], raster(32, 32, 10));
    await collection.replace(collection.entries()[1], raster(32, 32, 11));
    await collection.replace(collection.entries()[2], raster(32, 32, 12));
    operationHistory.clear();
    await operationHistory.execute(
      removeMaterialOperation(collection, collection.entries()[1], { label: 'remove', stage: 'remove' }),
    );
    expect(collection.entries()).toHaveLength(3);
    expect((await collection.read(collection.entries()[1])).data[0]).toBe(12);
    await operationHistory.undo();
    expect(collection.entries()).toHaveLength(4);
    expect((await collection.read(collection.entries()[0])).data[0]).toBe(10);
    expect((await collection.read(collection.entries()[1])).data[0]).toBe(11);
    expect((await collection.read(collection.entries()[2])).data[0]).toBe(12);
    await operationHistory.redo();
    expect(collection.entries()).toHaveLength(3);
    expect((await collection.read(collection.entries()[1])).data[0]).toBe(12);
    operationHistory.clear();
  });

  it('undoes and redoes autotile file creation and deletion', async () => {
    operationHistory.clear();
    const memory = new MemoryFileSystem();
    const codec = new FakeRasterCodec();
    memory.setFile('project/autotiles/autotile.png', await base64Raster(codec, raster(96, 128, 1)));
    const assets = new ProjectAssets(memory.createFsInterface(), codec);
    const collection = assets.materialCollection('autotile');
    await collection.reload();

    const mutation = await operationHistory.execute(
      appendMaterialOperation(
        collection,
        raster(96, 128, 2),
        { name: 'historyAutotile' },
        { label: 'append autotile', stage: 'append-autotile' },
      ),
    );
    await persistenceMonitor.whenQuiescent();
    expect(memory.hasFile('project/autotiles/historyAutotile.png')).toBe(true);
    await operationHistory.undo();
    expect(memory.hasFile('project/autotiles/historyAutotile.png')).toBe(false);
    await operationHistory.redo();
    await persistenceMonitor.whenQuiescent();
    expect(memory.hasFile('project/autotiles/historyAutotile.png')).toBe(true);

    operationHistory.clear();
    await operationHistory.execute(
      removeMaterialOperation(collection, mutation.entry!, { label: 'remove autotile', stage: 'remove-autotile' }),
    );
    expect(memory.hasFile('project/autotiles/historyAutotile.png')).toBe(false);
    await operationHistory.undo();
    expect(memory.hasFile('project/autotiles/historyAutotile.png')).toBe(true);
    expect(
      (await collection.read(collection.entries().find((entry) => entry.key.includes('historyAutotile'))!)).data[0],
    ).toBe(2);
    operationHistory.clear();
  });
});
