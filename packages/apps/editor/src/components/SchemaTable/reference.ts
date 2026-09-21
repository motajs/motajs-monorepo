import type { Content } from '@/fs/types';
import type {
  BlockResolution,
  DataReference,
  RawSlot,
  ReferenceRoot,
  ReferenceUpdate,
  SchemaScope,
  ValueSource,
  WritableValueSource,
} from './types';
import { isEqual } from 'es-toolkit';

export interface ParsedReference {
  root: string;
  path: string[];
}

export function parseReference(reference: DataReference): ParsedReference {
  const separator = reference.ref.indexOf(':');
  if (separator <= 0 || reference.ref.indexOf(':', separator + 1) !== -1) {
    throw new Error(`Invalid reference: ${reference.ref}`);
  }
  const root = reference.ref.slice(0, separator);
  const suffix = reference.ref.slice(separator + 1);
  if (
    !/^[A-Za-z_$][A-Za-z0-9_$-]*$/.test(root) ||
    suffix.includes('/') ||
    suffix.includes('[') ||
    suffix.includes(']')
  ) {
    throw new Error(`Invalid v1 dotted reference: ${reference.ref}`);
  }
  const path = suffix.length > 0 ? suffix.split('.') : [];
  if (path.some((segment) => segment.length === 0 || /[./:[\]]/.test(segment))) {
    throw new Error(`Invalid v1 dotted reference: ${reference.ref}`);
  }
  return { root, path };
}

export function resolveReference(scope: SchemaScope, reference: DataReference): ValueSource<unknown> {
  return resolveReferencePath(scope, parseReference(reference));
}

export function resolveReferencePath(scope: SchemaScope, reference: ParsedReference): ValueSource<unknown> {
  const root = scope.roots[reference.root];
  if (!root)
    return new ErrorValueSource(
      `${reference.root}:${reference.path.join('.')}`,
      new Error(`Unknown reference root: ${reference.root}`),
    );
  return root.resolve(reference.path);
}

export function appendReferencePath(reference: DataReference, relativePath: readonly string[]): ParsedReference {
  const parsed = parseReference(reference);
  return { root: parsed.root, path: [...parsed.path, ...relativePath] };
}

export function createBoundSchemaScope(
  parent: SchemaScope,
  bind: Readonly<Record<string, DataReference>> | undefined,
): SchemaScope {
  if (!bind || Object.keys(bind).length === 0) return parent;
  const roots = { ...parent.roots };
  for (const [name, base] of Object.entries(bind)) {
    const parsed = parseReference(base);
    roots[name] = {
      resolve: (path) => resolveReferencePath(parent, { root: parsed.root, path: [...parsed.path, ...path] }),
      writeMany: async (updates) => {
        const root = parent.roots[parsed.root];
        if (!root?.writeMany) throw new Error(`${base.ref} does not support atomic writes`);
        await root.writeMany(
          updates.map((update) => ({
            path: [...parsed.path, ...update.path],
            slot: update.slot,
          })),
        );
      },
    };
  }
  return { ...parent, roots };
}

function noopSubscribe(): () => void {
  return () => undefined;
}

export class ErrorValueSource implements ValueSource<unknown> {
  readonly id: string;
  private readonly error: Error;
  constructor(id: string, error: Error) {
    this.id = id;
    this.error = error;
  }
  snapshot(): BlockResolution<RawSlot<unknown>> {
    return { status: 'error', error: this.error };
  }
  subscribe(): () => void {
    return noopSubscribe();
  }
}

export class ConstantValueSource<T> implements ValueSource<T> {
  readonly id: string;
  private readonly getValue: () => RawSlot<T>;
  constructor(id: string, getValue: () => RawSlot<T>) {
    this.id = id;
    this.getValue = getValue;
  }
  snapshot(): BlockResolution<RawSlot<T>> {
    return { status: 'ready', value: this.getValue() };
  }
  subscribe(): () => void {
    return noopSubscribe();
  }
}

export class ObjectReferenceRoot implements ReferenceRoot {
  private readonly id: string;
  private readonly getRoot: () => unknown;
  private readonly write?: (path: readonly string[], slot: RawSlot<unknown>) => Promise<void>;
  private readonly writeBatch?: (updates: readonly ReferenceUpdate[]) => Promise<void>;
  constructor(
    id: string,
    getRoot: () => unknown,
    write?: (path: readonly string[], slot: RawSlot<unknown>) => Promise<void>,
    writeBatch?: (updates: readonly ReferenceUpdate[]) => Promise<void>,
  ) {
    this.id = id;
    this.getRoot = getRoot;
    this.write = write;
    this.writeBatch = writeBatch;
  }

  resolve(path: readonly string[]): ValueSource<unknown> {
    const sourceId = `${this.id}:${path.join('/')}`;
    const snapshot = (): BlockResolution<RawSlot<unknown>> => {
      let current = this.getRoot();
      if (path.length === 0) return { status: 'ready', value: { present: true, value: current } };
      for (const [index, key] of path.entries()) {
        if (current == null || typeof current !== 'object') {
          return {
            status: 'type-mismatch',
            rawValue: current,
            error: new Error(`Cannot resolve ${sourceId}: ${path.slice(0, index).join('/')} is not an object`),
          };
        }
        if (!Object.prototype.hasOwnProperty.call(current, key)) {
          return { status: 'ready', value: { present: false } };
        }
        current = (current as Record<string, unknown>)[key];
      }
      return { status: 'ready', value: { present: true, value: current } };
    };
    if (!this.write) {
      return { id: sourceId, snapshot, subscribe: () => noopSubscribe() };
    }
    const writable: WritableValueSource<unknown> = {
      id: sourceId,
      snapshot,
      subscribe: () => noopSubscribe(),
      set: (value: unknown) => this.write?.(path, { present: true, value }) ?? Promise.resolve(),
      unset: () => this.write?.(path, { present: false }) ?? Promise.resolve(),
    };
    return writable;
  }

  async writeMany(updates: readonly ReferenceUpdate[]): Promise<void> {
    if (!this.write) throw new Error(`${this.id} is read-only`);
    if (this.writeBatch) return this.writeBatch(updates);
    for (const update of updates) await this.write(update.path, update.slot);
  }
}

function combinedSnapshot(
  entries: ReadonlyArray<readonly [string, ValueSource<unknown>]>,
): BlockResolution<RawSlot<unknown>> {
  const value: Record<string, unknown> = {};
  let present = false;
  let mismatchError: Error | undefined;
  for (const [key, source] of entries) {
    const snapshot = source.snapshot();
    if (snapshot.status === 'loading' || snapshot.status === 'error') return snapshot;
    if (snapshot.status === 'type-mismatch') {
      value[key] = snapshot.rawValue;
      present = true;
      mismatchError ??= new Error(`${key}: ${snapshot.error.message}`);
      continue;
    }
    if (snapshot.value.present) {
      value[key] = snapshot.value.value;
      present = true;
    }
  }
  if (mismatchError) return { status: 'type-mismatch', rawValue: value, error: mismatchError };
  return present
    ? { status: 'ready', value: { present: true, value } }
    : { status: 'ready', value: { present: false } };
}

export function resolveCombinedReferences(
  scope: SchemaScope,
  references: Readonly<Record<string, DataReference>>,
): ValueSource<unknown> {
  const entries = Object.entries(references).map(
    ([key, reference]) => [key, resolveReference(scope, reference)] as const,
  );
  const base: ValueSource<unknown> = {
    id: `combine:${Object.entries(references)
      .map(([key, reference]) => `${key}=${reference.ref}`)
      .join(',')}`,
    snapshot: () => combinedSnapshot(entries),
    subscribe(listener) {
      const disposers = entries.map(([, source]) => source.subscribe(listener));
      return () => disposers.forEach((dispose) => dispose());
    },
    ensureLoaded: entries.some(([, source]) => source.ensureLoaded)
      ? async () => {
          await Promise.all(entries.map(([, source]) => source.ensureLoaded?.()));
        }
      : undefined,
    reload: entries.some(([, source]) => source.reload)
      ? async () => {
          await Promise.all(entries.map(([, source]) => source.reload?.()));
        }
      : undefined,
  };
  if (!entries.every(([, source]) => isWritableValueSource(source))) return base;

  const apply = async (nextValue: unknown) => {
    if (!nextValue || typeof nextValue !== 'object' || Array.isArray(nextValue)) {
      throw new Error('Combined field value must be an object');
    }
    const next = nextValue as Record<string, unknown>;
    const updatesByRoot = new Map<string, ReferenceUpdate[]>();
    const fallbackUpdates: Array<{ source: WritableValueSource<unknown>; slot: RawSlot<unknown> }> = [];
    for (const [key, source] of entries) {
      const current = source.snapshot();
      if (current.status === 'loading' || current.status === 'error') {
        throw new Error(`Cannot write ${key} while its source is ${current.status}`);
      }
      const slot: RawSlot<unknown> = Object.prototype.hasOwnProperty.call(next, key)
        ? { present: true, value: next[key] }
        : { present: false };
      const unchanged =
        current.status === 'ready' &&
        ((!current.value.present && !slot.present) ||
          (current.value.present && slot.present && isEqual(current.value.value, slot.value)));
      if (unchanged) continue;
      const parsed = parseReference(references[key]);
      const root = scope.roots[parsed.root];
      if (root?.writeMany) {
        const updates = updatesByRoot.get(parsed.root) ?? [];
        updates.push({ path: parsed.path, slot });
        updatesByRoot.set(parsed.root, updates);
      } else {
        fallbackUpdates.push({ source: source as WritableValueSource<unknown>, slot });
      }
    }
    for (const [rootName, updates] of updatesByRoot) await scope.roots[rootName].writeMany?.(updates);
    for (const update of fallbackUpdates) {
      if (update.slot.present) await update.source.set(update.slot.value);
      else await update.source.unset();
    }
  };
  return {
    ...base,
    set: apply,
    unset: () => apply({}),
  } as WritableValueSource<unknown>;
}

export class RegistryReferenceRoot implements ReferenceRoot {
  private readonly sources: ReadonlyMap<string, ValueSource<unknown>>;
  constructor(sources: ReadonlyMap<string, ValueSource<unknown>>) {
    this.sources = sources;
  }
  resolve(path: readonly string[]): ValueSource<unknown> {
    const key = path.join('.');
    return (
      this.sources.get(key) ?? new ErrorValueSource(`registry:${key}`, new Error(`Unknown registry source: ${key}`))
    );
  }
}

export class ContentValueSource<T> implements ValueSource<T> {
  readonly id: string;
  private readonly getContent: () => Content<T>;
  private readonly onSubscribe: (listener: () => void) => () => void;
  readonly ensureLoaded?: () => Promise<void>;
  readonly reload?: () => Promise<void>;
  constructor(
    id: string,
    getContent: () => Content<T>,
    onSubscribe: (listener: () => void) => () => void,
    ensureLoaded?: () => Promise<void>,
    reload?: () => Promise<void>,
  ) {
    this.id = id;
    this.getContent = getContent;
    this.onSubscribe = onSubscribe;
    this.ensureLoaded = ensureLoaded;
    this.reload = reload;
  }

  snapshot(): BlockResolution<RawSlot<T>> {
    const content = this.getContent();
    if (content.status === 'idle' || content.status === 'loading') return { status: 'loading' };
    if (content.status === 'error') return { status: 'error', error: content.error };
    if (content.status === 'not-found') return { status: 'error', error: new Error(`${this.id} was not found`) };
    return { status: 'ready', value: { present: true, value: content.value } };
  }

  subscribe(listener: () => void): () => void {
    return this.onSubscribe(listener);
  }
}

export function isWritableValueSource(source: ValueSource<unknown>): source is WritableValueSource<unknown> {
  return 'set' in source && typeof source.set === 'function' && 'unset' in source && typeof source.unset === 'function';
}
