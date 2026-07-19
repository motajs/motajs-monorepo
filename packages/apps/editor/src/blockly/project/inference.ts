import { isEqual } from 'es-toolkit';
import type { BlocklyCompletionCatalog } from '@/project/model/projectModel';
import type {
  BindingValueType,
  BlocklyCompletionSourceId,
  BlocklyPreviewAdapterId,
  DeclarativeBlockSchema,
  DeclarativeInteraction,
  MaterialKind,
} from '../registry/types';
import { roundTripDeclarativeEvent } from '../registry';
import { setAtPath } from '../registry/path';
import type { ProjectEventSample } from './eventIndex';
import { PROJECT_BLOCK_CATEGORY_ID } from './projectBlocks';

export type CustomBlockControl =
  | 'text'
  | 'number'
  | 'checkbox'
  | 'dropdown'
  | 'multiline'
  | 'json'
  | 'colour'
  | 'value'
  | 'statement';

export interface CustomBlockFieldDraft {
  id: string;
  label: string;
  path: string;
  control: CustomBlockControl;
  optional: boolean;
  omitWhenDefault: boolean;
  defaultValue?: unknown;
  dropdownOptions?: Array<[string, string]>;
  completionSource?: BlocklyCompletionSourceId;
  materialKind?: MaterialKind;
  min?: number;
  max?: number;
  precision?: number;
}

export interface CustomBlockDraft {
  blockType: string;
  eventType: string;
  title: string;
  colour: number;
  tooltip: string;
  fields: CustomBlockFieldDraft[];
  previewAdapter?: BlocklyPreviewAdapterId;
  pointInteraction?: {
    xField: string;
    yField: string;
    floorField?: string;
    multiple?: boolean;
  };
}

const RESERVED_FIELDS = new Set(['type', '_collapsed', '_disabled']);
const REGISTRY_SOURCES: BlocklyCompletionSourceId[] = [
  'image', 'animate', 'bgm', 'sound', 'font', 'id', 'enemy', 'item',
  'floor', 'shop', 'commonEvent',
];
const MATERIAL_SOURCE: Partial<Record<BlocklyCompletionSourceId, MaterialKind>> = {
  image: 'image',
  animate: 'animate',
  bgm: 'bgm',
  sound: 'sound',
};

function hash(input: string): string {
  let value = 2166136261;
  for (let index = 0; index < input.length; index++) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return (value >>> 0).toString(36);
}

export function blockTypeForEvent(type: string): string {
  const safe = type.replace(/[^A-Za-z0-9_]/g, '_').replace(/^([^A-Za-z_])/, '_$1').slice(0, 40) || 'event';
  return `project_event_${safe}_${hash(type)}`;
}

export function createBlankCustomBlockDraft(): CustomBlockDraft {
  return {
    blockType: '',
    eventType: '',
    title: '新自定义事件块',
    colour: 230,
    tooltip: '',
    fields: [],
  };
}

function pathForKey(key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : `[${JSON.stringify(key)}]`;
}

function uniqueCompletionSource(
  values: string[],
  catalog?: BlocklyCompletionCatalog,
): BlocklyCompletionSourceId | undefined {
  if (!catalog || values.length === 0 || values.some((value) => value.length === 0)) return undefined;
  const matches = REGISTRY_SOURCES.filter((source) => {
    const known = new Set((catalog.bySource[source] ?? []).map((item) => item.value));
    return values.every((value) => known.has(value));
  });
  return matches.length === 1 ? matches[0] : undefined;
}

function inferControl(values: unknown[]): CustomBlockControl {
  const present = values.filter((value) => value !== undefined);
  if (!present.length || present.some((value) => value === null)) return 'json';
  if (present.every((value) => typeof value === 'boolean')) return 'checkbox';
  if (present.every((value) => typeof value === 'number' && Number.isFinite(value))) return 'number';
  if (present.every((value) => typeof value === 'string')) {
    return present.some((value) => (value as string).includes('\n')) ? 'multiline' : 'text';
  }
  return 'json';
}

export function inferCustomBlockDraft(
  type: string,
  samples: readonly ProjectEventSample[],
  catalog?: BlocklyCompletionCatalog,
): CustomBlockDraft {
  if (!type.trim()) throw new Error('事件 type 不能为空');
  if (!samples.length) throw new Error(`没有找到 ${type} 的事件样本`);
  const orderedKeys: string[] = [];
  const known = new Set<string>();
  for (const sample of samples) {
    for (const key of Object.keys(sample.event)) {
      if (RESERVED_FIELDS.has(key) || known.has(key)) continue;
      known.add(key);
      orderedKeys.push(key);
    }
  }
  const fields = orderedKeys.map((key, index): CustomBlockFieldDraft => {
    const values = samples.map((sample) => sample.event[key]);
    const control = inferControl(values);
    const present = values.filter((value) => value !== undefined);
    const defaultValue = values[0] !== undefined ? values[0] : present[0];
    const strings = present.every((value) => typeof value === 'string') ? present as string[] : [];
    const completionSource = control === 'text' ? uniqueCompletionSource(strings, catalog) : undefined;
    return {
      id: `FIELD_${index + 1}`,
      label: key,
      path: pathForKey(key),
      control,
      optional: present.length !== samples.length,
      omitWhenDefault: false,
      ...(defaultValue !== undefined ? { defaultValue: structuredClone(defaultValue) } : {}),
      ...(completionSource ? { completionSource } : {}),
      ...(completionSource && MATERIAL_SOURCE[completionSource]
        ? { materialKind: MATERIAL_SOURCE[completionSource] }
        : {}),
    };
  });
  return {
    blockType: blockTypeForEvent(type),
    eventType: type,
    title: type,
    colour: 230,
    tooltip: `工程自定义事件：${type}`,
    fields,
  };
}

function argForField(field: CustomBlockFieldDraft): Record<string, unknown> {
  if (field.control === 'number') return {
    type: 'field_number', name: field.id,
    value: typeof field.defaultValue === 'number' ? field.defaultValue : 0,
    ...(field.min === undefined ? {} : { min: field.min }),
    ...(field.max === undefined ? {} : { max: field.max }),
    ...(field.precision === undefined ? {} : { precision: field.precision }),
  };
  if (field.control === 'checkbox') return {
    type: 'field_checkbox', name: field.id, checked: field.defaultValue === true,
  };
  if (field.control === 'dropdown') return {
    type: 'field_dropdown', name: field.id,
    options: field.dropdownOptions?.length ? field.dropdownOptions : [['', '']],
  };
  if (field.control === 'multiline' || field.control === 'json') return {
    type: 'field_multilinetext', name: field.id,
    text: field.control === 'json'
      ? JSON.stringify(field.defaultValue ?? null, null, 2)
      : String(field.defaultValue ?? ''),
  };
  if (field.control === 'colour') return {
    type: 'field_colour', name: field.id, colour: String(field.defaultValue ?? '#ffffff'),
  };
  if (field.control === 'value') return { type: 'input_value', name: field.id };
  if (field.control === 'statement') return { type: 'input_statement', name: field.id };
  return { type: 'field_input', name: field.id, text: String(field.defaultValue ?? '') };
}

function bindingValueType(control: CustomBlockControl): BindingValueType {
  if (control === 'number') return 'number';
  if (control === 'checkbox') return 'boolean';
  if (control === 'json') return 'json';
  if (control === 'colour') return 'colour';
  if (control === 'value') return 'expression';
  return 'string';
}

export function compileCustomBlockDraft(draft: CustomBlockDraft): DeclarativeBlockSchema {
  const eventType = draft.eventType.trim();
  const blockType = draft.blockType.trim() || blockTypeForEvent(eventType);
  if (!eventType) throw new Error('事件 type 不能为空');
  if (!draft.title.trim()) throw new Error('块标题不能为空');
  const definition: Record<string, unknown> = {
    type: blockType,
    message0: draft.title.trim(),
    colour: draft.colour,
    tooltip: draft.tooltip,
    helpUrl: '',
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
  };
  const template: Record<string, unknown> = { type: eventType };
  const bindings = draft.fields.map((field, index) => {
    if (!field.label.trim()) throw new Error(`字段 ${index + 1} 缺少显示名称`);
    if (!field.path.trim()) throw new Error(`字段 ${field.label} 缺少 path`);
    definition[`message${index + 1}`] = `${field.label} %1`;
    definition[`args${index + 1}`] = [argForField(field)];
    if (field.defaultValue !== undefined) setAtPath(template, field.path, structuredClone(field.defaultValue));
    return {
      input: field.id,
      kind: field.control === 'statement' ? 'statement' as const
        : field.control === 'value' ? 'value' as const
        : 'field' as const,
      path: field.path,
      optional: field.optional,
      default: field.defaultValue,
      omitWhenDefault: field.omitWhenDefault,
      valueType: bindingValueType(field.control),
    };
  });
  const interactions: DeclarativeInteraction[] = [];
  draft.fields.forEach((field) => {
    if (field.control === 'multiline' || field.control === 'json') {
      interactions.push({ type: 'editText', field: field.id, mode: 'multiline' });
    }
    if (field.materialKind) {
      interactions.push({
        type: 'selectMaterial', field: field.id, materialKind: field.materialKind,
        aliasPolicy: 'preserve',
      });
    }
    if (field.completionSource) {
      interactions.push({ type: 'autocomplete', field: field.id, source: field.completionSource });
    }
  });
  if (draft.previewAdapter) interactions.push({ type: 'preview', adapter: draft.previewAdapter });
  if (draft.pointInteraction) interactions.push({
    type: 'selectPoint',
    xField: draft.pointInteraction.xField,
    yField: draft.pointInteraction.yField,
    floorField: draft.pointInteraction.floorField,
    floorPolicy: draft.pointInteraction.floorField ? 'explicit' : 'current',
    multiple: draft.pointInteraction.multiple,
  });
  return {
    type: blockType,
    definition: definition as unknown as DeclarativeBlockSchema['definition'],
    event: {
      match: { path: 'type', equals: eventType },
      template,
      bindings,
      preserveUnbound: true,
    },
    toolbox: { category: PROJECT_BLOCK_CATEGORY_ID },
    interactions,
    defaultInteraction: draft.previewAdapter ? 'preview' : undefined,
    persistWorkspaceState: true,
    category: PROJECT_BLOCK_CATEGORY_ID,
  };
}

function controlFromArg(arg: Record<string, unknown>, valueType?: BindingValueType): CustomBlockControl {
  if (arg.type === 'field_number') return 'number';
  if (arg.type === 'field_checkbox') return 'checkbox';
  if (arg.type === 'field_dropdown') return 'dropdown';
  if (arg.type === 'field_colour') return 'colour';
  if (arg.type === 'input_value') return 'value';
  if (arg.type === 'input_statement') return 'statement';
  if (arg.type === 'field_multilinetext') return valueType === 'json' ? 'json' : 'multiline';
  return 'text';
}

export function draftFromCustomBlock(schema: DeclarativeBlockSchema): CustomBlockDraft {
  const definition = schema.definition as unknown as Record<string, unknown>;
  const args = new Map<string, { arg: Record<string, unknown>; label: string }>();
  for (let line = 0; typeof definition[`message${line}`] === 'string'; line++) {
    const lineArgs = definition[`args${line}`];
    if (!Array.isArray(lineArgs)) continue;
    lineArgs.forEach((arg) => {
      if (arg && typeof arg === 'object' && typeof arg.name === 'string') {
        args.set(arg.name, {
          arg,
          label: String(definition[`message${line}`]).replace(/%\d+/g, '').trim(),
        });
      }
    });
  }
  const fields = schema.event.bindings.map((binding, index): CustomBlockFieldDraft => {
    const info = args.get(binding.input) ?? { arg: { type: 'field_input' }, label: binding.path };
    const completion = schema.interactions?.find((item) => item.type === 'autocomplete' && item.field === binding.input);
    const material = schema.interactions?.find((item) => item.type === 'selectMaterial' && item.field === binding.input);
    return {
      id: binding.input || `FIELD_${index + 1}`,
      label: info.label,
      path: binding.path,
      control: controlFromArg(info.arg, binding.valueType),
      optional: binding.optional ?? false,
      omitWhenDefault: binding.omitWhenDefault ?? false,
      ...(binding.default === undefined ? {} : { defaultValue: structuredClone(binding.default) }),
      ...(Array.isArray(info.arg.options) ? { dropdownOptions: info.arg.options as Array<[string, string]> } : {}),
      ...(typeof info.arg.min === 'number' ? { min: info.arg.min } : {}),
      ...(typeof info.arg.max === 'number' ? { max: info.arg.max } : {}),
      ...(typeof info.arg.precision === 'number' ? { precision: info.arg.precision } : {}),
      ...(completion?.type === 'autocomplete' ? { completionSource: completion.source } : {}),
      ...(material?.type === 'selectMaterial' ? { materialKind: material.materialKind } : {}),
    };
  });
  const preview = schema.interactions?.find((item) => item.type === 'preview');
  const point = schema.interactions?.find((item) => item.type === 'selectPoint');
  return {
    blockType: schema.type,
    eventType: String(schema.event.match.equals),
    title: String(definition.message0 ?? schema.type),
    colour: typeof definition.colour === 'number' ? definition.colour : 230,
    tooltip: typeof definition.tooltip === 'string' ? definition.tooltip : '',
    fields,
    ...(preview?.type === 'preview' ? { previewAdapter: preview.adapter } : {}),
    ...(point?.type === 'selectPoint' ? {
      pointInteraction: {
        xField: point.xField,
        yField: point.yField,
        floorField: point.floorField,
        multiple: point.multiple,
      },
    } : {}),
  };
}

export interface RoundTripDifference {
  sample: ProjectEventSample;
  output: Record<string, unknown>;
}

export function validateCustomBlockRoundTrips(
  schema: DeclarativeBlockSchema,
  samples: readonly ProjectEventSample[],
): RoundTripDifference[] {
  return samples.flatMap((sample) => {
    const output = roundTripDeclarativeEvent(
      { ...schema, eventType: String(schema.event.match.equals), definition: { ...schema.definition, type: schema.type } },
      sample.event as { type: string; [key: string]: unknown },
    );
    return isEqual(output, sample.event) ? [] : [{ sample, output }];
  });
}
