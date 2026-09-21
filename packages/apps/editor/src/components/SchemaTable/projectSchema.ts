import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { FileHandlerManager } from '@/fs/FileHandlerManager';
import type { FileHandler } from '@/fs/FileHandler';
import type { Content } from '@/fs/types';
import type { FieldSchema, FieldSchemaBundle, UISchema } from './types';
import {
  createFieldSchemaRegistry,
  createGlobalFieldSchemaRegistry,
  parseFieldSchemaBundle,
  parseUISchema,
} from './schema';

export type SchemaLayer = 'field' | 'ui';

export interface BuiltinSchemaDefinition {
  fieldSource: FieldSchemaBundle;
  uiSource: UISchema;
  fieldBundle: FieldSchemaBundle;
  fieldSchemas: ReadonlyMap<string, FieldSchema>;
  uiSchema: UISchema;
}

interface ResolutionBase {
  hasFieldOverride: boolean;
  hasUiOverride: boolean;
}

export type ProjectSchemaResolution =
  | { status: 'loading' }
  | (ResolutionBase & {
      status: 'error';
      layer: SchemaLayer;
      error: Error;
      fieldSchemas?: ReadonlyMap<string, FieldSchema>;
      ambiguousFieldIds?: ReadonlySet<string>;
    })
  | (ResolutionBase & {
      status: 'ready';
      fieldBundle: FieldSchemaBundle;
      fieldSchemas: ReadonlyMap<string, FieldSchema>;
      ambiguousFieldIds: ReadonlySet<string>;
      fieldOwners: ReadonlyMap<string, BuiltinSchemaDefinition>;
      uiSchema: UISchema;
      fieldSource: FieldSchemaBundle;
      uiSource: UISchema;
    });

let revision = 0;
const listeners = new Set<() => void>();
const definitions = new Map<string, BuiltinSchemaDefinition>();
const handlerSubscriptions = new Map<string, { handler: FileHandler; dispose: () => void }>();
let bootstrapPromise: Promise<void> | undefined;

export function invalidateProjectSchemas(): void {
  revision += 1;
  for (const listener of listeners) listener();
}

function subscribeProjectSchemas(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function schemaRevision(): number {
  return revision;
}

function ensureHandlerSubscription(path: string): void {
  const handler = FileHandlerManager.get(path);
  const current = handlerSubscriptions.get(path);
  if (current?.handler === handler) return;
  current?.dispose();
  let initial = true;
  const dispose = handler.subscribe(() => {
    if (initial) {
      initial = false;
      return;
    }
    invalidateProjectSchemas();
  });
  handlerSubscriptions.set(path, { handler, dispose });
}

export function defineBuiltinSchema(fieldSource: unknown, uiSource: unknown): BuiltinSchemaDefinition {
  const fieldBundle = parseFieldSchemaBundle(fieldSource);
  const fieldSchemas = createFieldSchemaRegistry(fieldBundle);
  const uiSchema = parseUISchema(uiSource, fieldSchemas);
  const definition = {
    fieldSource: fieldBundle,
    uiSource: uiSchema,
    fieldBundle,
    fieldSchemas,
    uiSchema,
  };
  if (definitions.has(uiSchema.schemaId)) throw new Error(`Duplicate built-in Table Schema ID: ${uiSchema.schemaId}`);
  definitions.set(uiSchema.schemaId, definition);
  return definition;
}

export function getBuiltinSchemaDefinitions(): readonly BuiltinSchemaDefinition[] {
  return [...definitions.values()];
}

function registeredSchemaPaths(): string[] {
  return getBuiltinSchemaDefinitions().flatMap((definition) => [
    schemaOverridePath(definition, 'field'),
    schemaOverridePath(definition, 'ui'),
  ]);
}

function loadRegisteredProjectSchemas(): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise;
  const paths = registeredSchemaPaths();
  for (const path of paths) ensureHandlerSubscription(path);
  bootstrapPromise = FileHandlerManager.loadAll(paths)
    .then(() => {
      invalidateProjectSchemas();
    })
    .finally(() => {
      bootstrapPromise = undefined;
    });
  return bootstrapPromise;
}

export function schemaOverridePath(definition: BuiltinSchemaDefinition, layer: SchemaLayer): string {
  const schemaId = layer === 'field' ? definition.fieldBundle.schemaId : definition.uiSchema.schemaId;
  return `.metaphysics/schemas/${layer}/${schemaId}.json`;
}

function parseJson(text: string, path: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${path} 不是合法的严格 JSON：${detail}`);
  }
}

function settled(content: Content<string>): boolean {
  return content.status !== 'idle' && content.status !== 'loading';
}

function fieldContentFor(definition: BuiltinSchemaDefinition, override?: Content<string>): Content<string> {
  return override ?? FileHandlerManager.get(schemaOverridePath(definition, 'field')).getContent();
}

function uiContentFor(definition: BuiltinSchemaDefinition, override?: Content<string>): Content<string> {
  return override ?? FileHandlerManager.get(schemaOverridePath(definition, 'ui')).getContent();
}

interface ContentOverrides {
  field?: Content<string>;
  ui?: Content<string>;
}

function resolveRegisteredProjectSchema(
  target: BuiltinSchemaDefinition,
  overrides = new Map<BuiltinSchemaDefinition, ContentOverrides>(),
): ProjectSchemaResolution {
  const all = getBuiltinSchemaDefinitions();
  const targetOverride = overrides.get(target);
  const targetFieldContent = fieldContentFor(target, targetOverride?.field);
  const targetUiContent = uiContentFor(target, targetOverride?.ui);
  const hasFieldOverride = targetFieldContent.status === 'loaded';
  const hasUiOverride = targetUiContent.status === 'loaded';
  if (
    !all.every((definition) => settled(fieldContentFor(definition, overrides.get(definition)?.field))) ||
    !settled(targetUiContent)
  ) {
    return { status: 'loading' };
  }

  const bundles: FieldSchemaBundle[] = [];
  const bundleDefinitions = new Map<string, BuiltinSchemaDefinition>();
  const bundleErrors = new Map<string, Error>();
  const resolvedBundles = new Map<string, FieldSchemaBundle>();
  for (const definition of all) {
    const path = schemaOverridePath(definition, 'field');
    const content = fieldContentFor(definition, overrides.get(definition)?.field);
    try {
      if (content.status === 'error') throw content.error;
      const bundle =
        content.status === 'loaded' ? parseFieldSchemaBundle(parseJson(content.value, path)) : definition.fieldBundle;
      if (bundle.schemaId !== definition.fieldBundle.schemaId) {
        throw new Error(`${path} 的 schemaId 应为 ${definition.fieldBundle.schemaId}，实际为 ${bundle.schemaId}`);
      }
      bundles.push(bundle);
      bundleDefinitions.set(bundle.schemaId, definition);
      resolvedBundles.set(bundle.schemaId, bundle);
    } catch (error) {
      bundleErrors.set(definition.fieldBundle.schemaId, error instanceof Error ? error : new Error(String(error)));
    }
  }

  const ownFieldError = bundleErrors.get(target.fieldBundle.schemaId);
  if (ownFieldError) return { status: 'error', layer: 'field', error: ownFieldError, hasFieldOverride, hasUiOverride };
  const registry = createGlobalFieldSchemaRegistry(bundles);
  const fieldOwners = new Map<string, BuiltinSchemaDefinition>();
  for (const bundle of bundles) {
    const owner = bundleDefinitions.get(bundle.schemaId);
    if (!owner) continue;
    for (const id of Object.keys(bundle.fields)) {
      if (!registry.ambiguous.has(id)) fieldOwners.set(id, owner);
    }
  }
  const fieldBundle = resolvedBundles.get(target.fieldBundle.schemaId) as FieldSchemaBundle;
  const uiPath = schemaOverridePath(target, 'ui');
  try {
    if (targetUiContent.status === 'error') throw targetUiContent.error;
    const uiSchema =
      targetUiContent.status === 'loaded'
        ? parseUISchema(parseJson(targetUiContent.value, uiPath), registry.schemas, registry.ambiguous)
        : parseUISchema(target.uiSource, registry.schemas, registry.ambiguous);
    if (uiSchema.schemaId !== target.uiSchema.schemaId) {
      throw new Error(`${uiPath} 的 schemaId 应为 ${target.uiSchema.schemaId}，实际为 ${uiSchema.schemaId}`);
    }
    return {
      status: 'ready',
      fieldBundle,
      fieldSchemas: registry.schemas,
      ambiguousFieldIds: registry.ambiguous,
      fieldOwners,
      uiSchema,
      fieldSource: fieldBundle,
      uiSource: uiSchema,
      hasFieldOverride,
      hasUiOverride,
    };
  } catch (error) {
    return {
      status: 'error',
      layer: 'ui',
      error: error instanceof Error ? error : new Error(String(error)),
      fieldSchemas: registry.schemas,
      ambiguousFieldIds: registry.ambiguous,
      hasFieldOverride,
      hasUiOverride,
    };
  }
}

/** Pure compatibility seam used by parser/override tests for one table slot. */
export function resolveProjectSchema(
  definition: BuiltinSchemaDefinition,
  fieldContent: Content<string>,
  uiContent: Content<string>,
): ProjectSchemaResolution {
  const overrides = new Map(
    getBuiltinSchemaDefinitions().map((current) => [
      current,
      current === definition
        ? { field: fieldContent, ui: uiContent }
        : { field: { status: 'not-found' } as const, ui: { status: 'not-found' } as const },
    ]),
  );
  return resolveRegisteredProjectSchema(definition, overrides);
}

export function useProjectSchema(definition: BuiltinSchemaDefinition): ProjectSchemaResolution {
  const snapshot = useSyncExternalStore(subscribeProjectSchemas, schemaRevision, schemaRevision);
  const [loadRevision, setLoadRevision] = useState(0);
  const all = useMemo(() => getBuiltinSchemaDefinitions(), []);
  useEffect(() => {
    const paths = all.flatMap((current) => [schemaOverridePath(current, 'field'), schemaOverridePath(current, 'ui')]);
    for (const path of paths) ensureHandlerSubscription(path);
    const pendingPaths = paths.filter((path) => {
      const status = FileHandlerManager.get(path).getContent().status;
      return status === 'idle' || status === 'loading';
    });
    if (pendingPaths.length > 0) {
      void FileHandlerManager.loadAll(pendingPaths).finally(() => {
        invalidateProjectSchemas();
        setLoadRevision((current) => current + 1);
      });
    }
  }, [all, snapshot]);
  return useMemo(() => {
    void snapshot;
    void loadRevision;
    return resolveRegisteredProjectSchema(definition);
  }, [definition, loadRevision, snapshot]);
}

/** Startup boundary: React retries the workbench after all known override reads settle. */
export function useProjectSchemaSuspense(
  definition: BuiltinSchemaDefinition,
): Exclude<ProjectSchemaResolution, { status: 'loading' }> {
  const resolution = resolveRegisteredProjectSchema(definition);
  if (resolution.status === 'loading') throw loadRegisteredProjectSchemas();
  return resolution;
}
