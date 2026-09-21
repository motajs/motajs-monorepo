import { isEqual } from 'es-toolkit';
import { FileHandlerManager } from '@/fs/FileHandlerManager';
import {
  compositeOperation,
  deleteTextFileOperation,
  operationHistory,
  writeTextFileOperation,
  type EditorOperation,
} from '@/project/history';
import { fs } from '@/services/fs';
import {
  getBuiltinSchemaDefinitions,
  invalidateProjectSchemas,
  schemaOverridePath,
  type BuiltinSchemaDefinition,
  type SchemaLayer,
} from './projectSchema';
import { createGlobalFieldSchemaRegistry, parseFieldSchemaBundle, parseUISchema } from './schema';
import type { FieldSchemaBundle, UISchema } from './types';

export function canonicalizeJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeJson);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => [key, canonicalizeJson((value as Record<string, unknown>)[key])]),
  );
}

function withoutFork<T extends { forkedFrom?: unknown }>(value: T): Omit<T, 'forkedFrom'> {
  const result = { ...value };
  delete result.forkedFrom;
  return result;
}

export async function canonicalSchemaDigest(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(canonicalizeJson(value)));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `sha256:${hex}`;
}

function builtinSource(definition: BuiltinSchemaDefinition, layer: SchemaLayer): FieldSchemaBundle | UISchema {
  return layer === 'field' ? definition.fieldSource : definition.uiSource;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`不是合法的严格 JSON：${error instanceof Error ? error.message : String(error)}`);
  }
}

async function withFork(
  definition: BuiltinSchemaDefinition,
  layer: SchemaLayer,
  value: FieldSchemaBundle | UISchema,
): Promise<FieldSchemaBundle | UISchema> {
  const source = builtinSource(definition, layer);
  return {
    ...withoutFork(value),
    forkedFrom: value.forkedFrom ?? {
      revision: source.revision,
      digest: await canonicalSchemaDigest(withoutFork(source)),
    },
  } as FieldSchemaBundle | UISchema;
}

async function currentSource(definition: BuiltinSchemaDefinition, layer: SchemaLayer): Promise<unknown> {
  const path = schemaOverridePath(definition, layer);
  const handler = await FileHandlerManager.load(path);
  const content = handler.getContent();
  if (content.status === 'loaded') return parseJson(content.value);
  if (content.status === 'not-found') return builtinSource(definition, layer);
  if (content.status === 'error') throw content.error;
  throw new Error(`无法从 ${content.status} 状态读取 ${path}`);
}

function collectFieldReferences(value: unknown, path = 'nodes'): Array<{ fieldId: string; node: string }> {
  if (Array.isArray(value)) return value.flatMap((item, index) => collectFieldReferences(item, `${path}[${index}]`));
  if (!value || typeof value !== 'object') return [];
  const input = value as Record<string, unknown>;
  const own =
    input.kind === 'field' && typeof input.fieldSchema === 'string'
      ? [{ fieldId: input.fieldSchema, node: typeof input.id === 'string' ? input.id : path }]
      : [];
  return [
    ...own,
    ...Object.entries(input).flatMap(([key, child]) =>
      key === 'children' || key === 'nodes' ? collectFieldReferences(child, `${path}.${key}`) : [],
    ),
  ];
}

async function validateProspectiveSources(
  tableDefinition: BuiltinSchemaDefinition,
  fieldDefinition: BuiltinSchemaDefinition,
  fieldValue?: unknown,
  uiValue?: unknown,
): Promise<{ field?: FieldSchemaBundle; ui?: UISchema }> {
  const all = getBuiltinSchemaDefinitions();
  await FileHandlerManager.loadAll(
    all.flatMap((current) => [schemaOverridePath(current, 'field'), schemaOverridePath(current, 'ui')]),
  );
  const bundles: FieldSchemaBundle[] = [];
  let editedField: FieldSchemaBundle | undefined;
  let previousEditedField: FieldSchemaBundle | undefined;
  if (fieldValue != null) {
    try {
      previousEditedField = parseFieldSchemaBundle(await currentSource(fieldDefinition, 'field'));
    } catch {
      previousEditedField = fieldDefinition.fieldBundle;
    }
  }
  for (const current of all) {
    try {
      const source =
        current === fieldDefinition && fieldValue != null ? fieldValue : await currentSource(current, 'field');
      const bundle = parseFieldSchemaBundle(source);
      if (bundle.schemaId !== current.fieldBundle.schemaId)
        throw new Error(`schemaId 必须保持为 ${current.fieldBundle.schemaId}`);
      bundles.push(bundle);
      if (current === fieldDefinition) editedField = bundle;
    } catch (error) {
      if (current === fieldDefinition) throw error;
      // A broken unrelated bundle stays isolated; references to it remain unresolved below.
    }
  }
  const registry = createGlobalFieldSchemaRegistry(bundles);
  if (editedField && fieldValue != null) {
    const removed = new Set(
      Object.keys(previousEditedField?.fields ?? {}).filter(
        (id) => !Object.prototype.hasOwnProperty.call(editedField?.fields, id),
      ),
    );
    const blocked: string[] = [];
    for (const current of all) {
      let source: unknown;
      try {
        source = current === tableDefinition && uiValue != null ? uiValue : await currentSource(current, 'ui');
      } catch {
        continue;
      }
      for (const reference of collectFieldReferences(source)) {
        if (removed.has(reference.fieldId) || registry.ambiguous.has(reference.fieldId)) {
          blocked.push(`${current.uiSchema.schemaId}/${reference.node} → ${reference.fieldId}`);
        }
      }
    }
    if (blocked.length > 0) throw new Error(`Field Bundle 修改会破坏以下引用：\n${blocked.join('\n')}`);
  }
  let editedUi: UISchema | undefined;
  if (uiValue != null || fieldValue != null) {
    const source = uiValue ?? (await currentSource(tableDefinition, 'ui'));
    editedUi = parseUISchema(source, registry.schemas, registry.ambiguous);
    if (editedUi.schemaId !== tableDefinition.uiSchema.schemaId)
      throw new Error(`schemaId 必须保持为 ${tableDefinition.uiSchema.schemaId}`);
  }
  return { field: editedField, ui: editedUi };
}

export async function createSchemaOverrideDraft(
  definition: BuiltinSchemaDefinition,
  layer: SchemaLayer,
): Promise<string> {
  const source = builtinSource(definition, layer);
  return `${JSON.stringify(await withFork(definition, layer, source), null, 2)}\n`;
}

export async function loadSchemaOverrideDraft(
  definition: BuiltinSchemaDefinition,
  layer: SchemaLayer,
): Promise<string> {
  const path = schemaOverridePath(definition, layer);
  const handler = await FileHandlerManager.load(path);
  const content = handler.getContent();
  if (content.status === 'loaded') return content.value;
  if (content.status === 'not-found') return createSchemaOverrideDraft(definition, layer);
  if (content.status === 'error') throw content.error;
  throw new Error(`无法从 ${content.status} 状态编辑 ${path}`);
}

export async function loadRawSchemaOverride(definition: BuiltinSchemaDefinition, layer: SchemaLayer): Promise<string> {
  const path = schemaOverridePath(definition, layer);
  const handler = await FileHandlerManager.load(path);
  const content = handler.getContent();
  if (content.status === 'loaded') return content.value;
  if (content.status === 'not-found') throw new Error(`${path} 不存在`);
  if (content.status === 'error') throw content.error;
  throw new Error(`无法从 ${content.status} 状态读取 ${path}`);
}

export async function validateAndNormalizeSchemaOverride(
  definition: BuiltinSchemaDefinition,
  layer: SchemaLayer,
  text: string,
): Promise<string> {
  const value = parseJson(text);
  const parsed = layer === 'field' ? parseFieldSchemaBundle(value) : parseUISchema(value, definition.fieldSchemas);
  const expected = layer === 'field' ? definition.fieldBundle.schemaId : definition.uiSchema.schemaId;
  if (parsed.schemaId !== expected) throw new Error(`schemaId 必须保持为 ${expected}`);
  return `${JSON.stringify(await withFork(definition, layer, parsed), null, 2)}\n`;
}

function operationForSource(
  definition: BuiltinSchemaDefinition,
  layer: SchemaLayer,
  value: FieldSchemaBundle | UISchema,
  label: string,
): EditorOperation {
  const path = schemaOverridePath(definition, layer);
  const builtin = builtinSource(definition, layer);
  const meta = { label, stage: `schema.override.${layer}` };
  return isEqual(canonicalizeJson(withoutFork(value)), canonicalizeJson(withoutFork(builtin)))
    ? deleteTextFileOperation(path, meta, { invalidate: invalidateProjectSchemas })
    : writeTextFileOperation(path, `${JSON.stringify(value, null, 2)}\n`, meta, {
        invalidate: invalidateProjectSchemas,
      });
}

export async function saveSchemaSources(
  definition: BuiltinSchemaDefinition,
  changes: { field?: unknown; ui?: unknown },
  label = '自定义新版表格',
  fieldDefinition = definition,
): Promise<void> {
  if (changes.field == null && changes.ui == null) return;
  const parsed = await validateProspectiveSources(definition, fieldDefinition, changes.field, changes.ui);
  const operations: EditorOperation[] = [];
  if (changes.field != null && parsed.field) {
    await fs.promises.mkdir('.metaphysics/schemas/field');
    operations.push(
      operationForSource(
        fieldDefinition,
        'field',
        (await withFork(fieldDefinition, 'field', parsed.field)) as FieldSchemaBundle,
        label,
      ),
    );
  }
  if (changes.ui != null && parsed.ui) {
    await fs.promises.mkdir('.metaphysics/schemas/ui');
    operations.push(
      operationForSource(definition, 'ui', (await withFork(definition, 'ui', parsed.ui)) as UISchema, label),
    );
  }
  if (operations.length === 1) await operationHistory.execute(operations[0]);
  else await operationHistory.execute(compositeOperation(operations, { label, stage: 'schema.override.composite' }));
}

export async function saveSchemaOverride(
  definition: BuiltinSchemaDefinition,
  layer: SchemaLayer,
  text: string,
): Promise<void> {
  const value = parseJson(text);
  await saveSchemaSources(definition, { [layer]: value }, `自定义${layer === 'field' ? '字段定义' : '表格布局'}`);
}

export async function deleteSchemaOverride(definition: BuiltinSchemaDefinition, layer: SchemaLayer): Promise<void> {
  await operationHistory.execute(
    deleteTextFileOperation(
      schemaOverridePath(definition, layer),
      {
        label: `删除${layer === 'field' ? '字段定义' : '表格布局'} override`,
        stage: `schema.override.${layer}.delete`,
      },
      { invalidate: invalidateProjectSchemas },
    ),
  );
}

export async function resetSchemaLayer(definition: BuiltinSchemaDefinition, layer: SchemaLayer): Promise<void> {
  await deleteSchemaOverride(definition, layer);
}
