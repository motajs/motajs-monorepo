import { describe, expect, it, vi } from 'vitest';
import {
  createBoundSchemaScope,
  ObjectReferenceRoot,
  parseReference,
  resolveCombinedReferences,
  resolveReference,
} from '../reference';

describe('SchemaTable references', () => {
  it.each([
    ['floor:title', 'floor', ['title']],
    ['params:floorId', 'params', ['floorId']],
    ['project:registry.name', 'project', ['registry', 'name']],
  ])('parses %s', (ref, root, path) => {
    expect(parseReference({ ref })).toEqual({ root, path });
  });

  it('distinguishes missing from a present null and exposes set/unset', async () => {
    const data: Record<string, unknown> = { nullable: null };
    const write = vi.fn(
      async (path: readonly string[], slot: { present: true; value: unknown } | { present: false }) => {
        if (slot.present) data[path[0]] = slot.value;
        else delete data[path[0]];
      },
    );
    const scope = { roots: { floor: new ObjectReferenceRoot('floor', () => data, write) } };
    const nullable = resolveReference(scope, { ref: 'floor:nullable' });
    const missing = resolveReference(scope, { ref: 'floor:missing' });
    expect(nullable.snapshot()).toEqual({ status: 'ready', value: { present: true, value: null } });
    expect(missing.snapshot()).toEqual({ status: 'ready', value: { present: false } });
    if (!('set' in missing) || !('unset' in nullable)) throw new Error('expected writable sources');
    await missing.set(3);
    await nullable.unset();
    expect(data).toEqual({ missing: 3 });
  });

  it('combines named references and batches only changed member writes', async () => {
    const data: Record<string, unknown> = { width: 13 };
    const write = vi.fn(async () => undefined);
    const writeBatch = vi.fn(
      async (
        updates: ReadonlyArray<{
          path: readonly string[];
          slot: { present: true; value: unknown } | { present: false };
        }>,
      ) => {
        for (const update of updates) {
          const key = update.path[0];
          if (update.slot.present) data[key] = update.slot.value;
          else delete data[key];
        }
      },
    );
    const scope = { roots: { floor: new ObjectReferenceRoot('floor', () => data, write, writeBatch) } };
    const source = resolveCombinedReferences(scope, {
      width: { ref: 'floor:width' },
      height: { ref: 'floor:height' },
    });
    expect(source.snapshot()).toEqual({
      status: 'ready',
      value: { present: true, value: { width: 13 } },
    });
    if (!('set' in source)) throw new Error('expected a writable combined source');
    await source.set({ width: 13, height: 15 });
    expect(writeBatch).toHaveBeenCalledWith([
      {
        path: ['height'],
        slot: { present: true, value: 15 },
      },
    ]);
    expect(write).not.toHaveBeenCalled();
  });

  it('repairs combined references even when their parent path has the wrong type', async () => {
    const data: Record<string, unknown> = { loc: 'broken' };
    const write = vi.fn(async () => undefined);
    const writeBatch = vi.fn(
      async (
        updates: ReadonlyArray<{
          path: readonly string[];
          slot: { present: true; value: unknown } | { present: false };
        }>,
      ) => {
        data.loc = Object.fromEntries(
          updates.flatMap((update) => (update.slot.present ? [[update.path.at(-1), update.slot.value]] : [])),
        );
      },
    );
    const scope = { roots: { floor: new ObjectReferenceRoot('floor', () => data, write, writeBatch) } };
    const source = resolveCombinedReferences(scope, {
      x: { ref: 'floor:loc.x' },
      y: { ref: 'floor:loc.y' },
    });
    expect(source.snapshot()).toMatchObject({
      status: 'type-mismatch',
      rawValue: { x: 'broken', y: 'broken' },
    });
    if (!('set' in source)) throw new Error('expected a writable combined source');
    await source.set({ x: 3, y: 4 });
    expect(writeBatch).toHaveBeenCalledWith([
      { path: ['loc', 'x'], slot: { present: true, value: 3 } },
      { path: ['loc', 'y'], slot: { present: true, value: 4 } },
    ]);
  });

  it('shallowly binds a local root to an addressable parent path', () => {
    const data = { hero: { hp: 100 } };
    const parent = { roots: { tower: new ObjectReferenceRoot('tower', () => data) } };
    const scope = createBoundSchemaScope(parent, { hero: { ref: 'tower:hero' } });
    expect(resolveReference(scope, { ref: 'hero:hp' }).snapshot()).toEqual({
      status: 'ready',
      value: { present: true, value: 100 },
    });
  });

  it.each(['floor:/title', 'floor:items[0]', 'floor:a..b'])('rejects unsupported v1 reference %s', (ref) => {
    expect(() => parseReference({ ref })).toThrow('Invalid v1 dotted reference');
  });
});
