import { FileHandlerManager } from '@/fs/FileHandlerManager';
import { deleteTextFileOperation, operationHistory, writeTextFileOperation } from '@/project/history';
import { fs } from '@/services/fs';
import { blockRegistry } from '../registry';
import type { BlocklyBlockPack, DeclarativeBlockSchema, RegisterPackResult } from '../registry/types';

export const PROJECT_BLOCK_PACK_PATH = '.metaphysics/schemas/blockly/project-events.json';
export const PROJECT_BLOCK_PACK_ID = 'project.custom-events';
export const PROJECT_BLOCK_CATEGORY_ID = 'projectCustomEvents';

export interface ProjectBlockPack extends BlocklyBlockPack {
  kind: 'blockly-block-pack';
  formatVersion: 1;
  id: typeof PROJECT_BLOCK_PACK_ID;
  version: 1;
  blocks: DeclarativeBlockSchema[];
}

export type ProjectBlockPackState =
  | { status: 'idle'; pack: ProjectBlockPack }
  | { status: 'loading'; pack: ProjectBlockPack }
  | { status: 'ready'; pack: ProjectBlockPack; overridden: boolean }
  | { status: 'error'; pack: ProjectBlockPack; error: Error; raw?: string };

const PACK_KEYS = new Set(['kind', 'formatVersion', 'id', 'version', 'blocks', 'categories']);
const BLOCK_KEYS = new Set([
  'type',
  'definition',
  'event',
  'toolbox',
  'interactions',
  'defaultInteraction',
  'persistWorkspaceState',
  'category',
  'isValue',
]);
const EVENT_KEYS = new Set(['match', 'template', 'bindings', 'preserveUnbound']);
const MATCH_KEYS = new Set(['path', 'equals']);
const BINDING_KEYS = new Set(['input', 'kind', 'path', 'optional', 'default', 'omitWhenDefault', 'valueType']);
const CATEGORY_KEYS = new Set(['id', 'name', 'colour', 'order']);
const DEFINITION_KEYS = new Set([
  'type',
  'colour',
  'tooltip',
  'helpUrl',
  'previousStatement',
  'nextStatement',
  'inputsInline',
]);
const TOOLBOX_KEYS = new Set(['category', 'order', 'defaults']);
const ARG_KEYS: Record<string, Set<string>> = {
  field_input: new Set(['type', 'name', 'text', 'spellcheck']),
  field_number: new Set(['type', 'name', 'value', 'min', 'max', 'precision']),
  field_checkbox: new Set(['type', 'name', 'checked']),
  field_dropdown: new Set(['type', 'name', 'options']),
  field_multilinetext: new Set(['type', 'name', 'text']),
  field_colour: new Set(['type', 'name', 'colour']),
  field_label: new Set(['type', 'name', 'text', 'class']),
  input_value: new Set(['type', 'name', 'check', 'align']),
  input_statement: new Set(['type', 'name', 'check', 'align']),
  input_dummy: new Set(['type', 'align']),
};
const INTERACTION_KEYS: Record<string, Set<string>> = {
  editText: new Set(['type', 'field', 'mode', 'lint']),
  selectPoint: new Set(['type', 'xField', 'yField', 'floorField', 'floorPolicy', 'multiple']),
  selectMaterial: new Set(['type', 'field', 'materialKind', 'multiple', 'transform', 'aliasPolicy']),
  preview: new Set(['type', 'adapter']),
  autocomplete: new Set(['type', 'field', 'source']),
  colourBinding: new Set(['type', 'textField', 'colourField']),
  command: new Set(['type', 'command', 'trigger']),
};

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${path} 必须是 object`);
  }
  return value as Record<string, unknown>;
}

function rejectUnknownKeys(value: Record<string, unknown>, allowed: Set<string>, path: string): void {
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length) throw new Error(`${path} 包含未知属性：${unknown.join('、')}`);
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (cause) {
    throw new Error(`不是合法的严格 JSON：${cause instanceof Error ? cause.message : String(cause)}`);
  }
}

function validateDefinition(definition: Record<string, unknown>, path: string): void {
  const lines = new Set<number>();
  for (const key of Object.keys(definition)) {
    if (!DEFINITION_KEYS.has(key) && !/^(?:message|args)\d+$/.test(key)) {
      throw new Error(`${path} 包含未知属性：${key}`);
    }
    const match = /^(?:message|args)(\d+)$/.exec(key);
    if (match) lines.add(Number(match[1]));
  }
  const orderedLines = [...lines].sort((a, b) => a - b);
  orderedLines.forEach((line, index) => {
    if (line !== index) throw new Error(`${path} 的 message/args 行号必须从 0 连续排列`);
    const message = definition[`message${line}`];
    const args = definition[`args${line}`];
    if (typeof message !== 'string') throw new Error(`${path}.message${line} 必须是字符串`);
    if (args === undefined) return;
    if (!Array.isArray(args)) throw new Error(`${path}.args${line} 必须是数组`);
    args.forEach((rawArg, index) => {
      const argPath = `${path}.args${line}[${index}]`;
      const arg = record(rawArg, argPath);
      const type = typeof arg.type === 'string' ? arg.type : '';
      const allowed = ARG_KEYS[type];
      if (!allowed) throw new Error(`${argPath}.type 不受工程自定义块支持：${type || '(empty)'}`);
      rejectUnknownKeys(arg, allowed, argPath);
      if (type !== 'input_dummy' && (typeof arg.name !== 'string' || !arg.name)) {
        throw new Error(`${argPath}.name 必须是非空字符串`);
      }
      if (type === 'field_dropdown' && !Array.isArray(arg.options)) {
        throw new Error(`${argPath}.options 必须是数组`);
      }
      if (
        type === 'field_dropdown' &&
        (arg.options as unknown[]).some(
          (option) => !Array.isArray(option) || option.length !== 2 || option.some((part) => typeof part !== 'string'),
        )
      )
        throw new Error(`${argPath}.options 必须是字符串二元组数组`);
      if (type === 'field_number') {
        for (const key of ['value', 'min', 'max', 'precision']) {
          if (arg[key] !== undefined && (typeof arg[key] !== 'number' || !Number.isFinite(arg[key]))) {
            throw new Error(`${argPath}.${key} 必须是有限 number`);
          }
        }
      }
    });
  });
}

function validateInteractions(value: unknown, path: string): void {
  if (value === undefined) return;
  if (!Array.isArray(value)) throw new Error(`${path} 必须是数组`);
  value.forEach((raw, index) => {
    const itemPath = `${path}[${index}]`;
    const item = record(raw, itemPath);
    const type = typeof item.type === 'string' ? item.type : '';
    const allowed = INTERACTION_KEYS[type];
    if (!allowed) throw new Error(`${itemPath}.type 不受支持：${type || '(empty)'}`);
    rejectUnknownKeys(item, allowed, itemPath);
  });
}

export function createEmptyProjectBlockPack(): ProjectBlockPack {
  return {
    kind: 'blockly-block-pack',
    formatVersion: 1,
    id: PROJECT_BLOCK_PACK_ID,
    version: 1,
    categories: [
      {
        id: PROJECT_BLOCK_CATEGORY_ID,
        name: '自定义事件',
        colour: 230,
        order: 900,
      },
    ],
    blocks: [],
  };
}

function validateBlock(raw: unknown, index: number): DeclarativeBlockSchema {
  const path = `blocks[${index}]`;
  const block = record(raw, path);
  rejectUnknownKeys(block, BLOCK_KEYS, path);
  if (typeof block.type !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(block.type)) {
    throw new Error(`${path}.type 必须是合法且稳定的 Blockly type`);
  }
  const definition = record(block.definition, `${path}.definition`);
  validateDefinition(definition, `${path}.definition`);
  if (definition.type !== block.type) throw new Error(`${path}.definition.type 必须等于 ${block.type}`);
  if (typeof definition.message0 !== 'string' || !definition.message0.trim()) {
    throw new Error(`${path}.definition.message0 必须是非空字符串`);
  }
  if (typeof definition.colour !== 'number' && typeof definition.colour !== 'string') {
    throw new Error(`${path}.definition.colour 必须是 number 或 string`);
  }
  if ('extensions' in definition) throw new Error(`${path}.definition.extensions 不向工程 Schema 开放`);

  if (block.category !== PROJECT_BLOCK_CATEGORY_ID) {
    throw new Error(`${path}.category 必须是 ${PROJECT_BLOCK_CATEGORY_ID}`);
  }
  const toolbox = record(block.toolbox, `${path}.toolbox`);
  rejectUnknownKeys(toolbox, TOOLBOX_KEYS, `${path}.toolbox`);
  if (toolbox.category !== PROJECT_BLOCK_CATEGORY_ID) {
    throw new Error(`${path}.toolbox.category 必须是 ${PROJECT_BLOCK_CATEGORY_ID}`);
  }
  validateInteractions(block.interactions, `${path}.interactions`);

  const event = record(block.event, `${path}.event`);
  rejectUnknownKeys(event, EVENT_KEYS, `${path}.event`);
  const match = record(event.match, `${path}.event.match`);
  rejectUnknownKeys(match, MATCH_KEYS, `${path}.event.match`);
  if (match.path !== 'type' || typeof match.equals !== 'string' || !match.equals.trim()) {
    throw new Error(`${path}.event.match 必须按非空 type 等值匹配`);
  }
  const template = record(event.template, `${path}.event.template`);
  if (template.type !== match.equals) throw new Error(`${path}.event.template.type 必须等于匹配 type`);
  if (event.preserveUnbound !== true) throw new Error(`${path}.event.preserveUnbound 必须为 true`);
  if (!Array.isArray(event.bindings)) throw new Error(`${path}.event.bindings 必须是数组`);
  event.bindings.forEach((item, bindingIndex) => {
    const binding = record(item, `${path}.event.bindings[${bindingIndex}]`);
    rejectUnknownKeys(binding, BINDING_KEYS, `${path}.event.bindings[${bindingIndex}]`);
    if (typeof binding.input !== 'string' || !binding.input) {
      throw new Error(`${path}.event.bindings[${bindingIndex}].input 必须是非空字符串`);
    }
    if (!['field', 'value', 'statement'].includes(String(binding.kind))) {
      throw new Error(`${path}.event.bindings[${bindingIndex}].kind 不受支持`);
    }
    if (typeof binding.path !== 'string' || !binding.path) {
      throw new Error(`${path}.event.bindings[${bindingIndex}].path 必须是非空字符串`);
    }
    if (binding.optional !== undefined && typeof binding.optional !== 'boolean') {
      throw new Error(`${path}.event.bindings[${bindingIndex}].optional 必须是 boolean`);
    }
    if (binding.omitWhenDefault !== undefined && typeof binding.omitWhenDefault !== 'boolean') {
      throw new Error(`${path}.event.bindings[${bindingIndex}].omitWhenDefault 必须是 boolean`);
    }
  });
  return block as unknown as DeclarativeBlockSchema;
}

export function parseProjectBlockPack(value: unknown): ProjectBlockPack {
  const pack = record(value, 'pack');
  rejectUnknownKeys(pack, PACK_KEYS, 'pack');
  if (pack.kind !== 'blockly-block-pack') throw new Error('pack.kind 必须是 blockly-block-pack');
  if (pack.formatVersion !== 1) throw new Error('pack.formatVersion 必须是 1');
  if (pack.id !== PROJECT_BLOCK_PACK_ID) throw new Error(`pack.id 必须是 ${PROJECT_BLOCK_PACK_ID}`);
  if (pack.version !== 1) throw new Error('pack.version 必须是 1');
  if (!Array.isArray(pack.blocks)) throw new Error('pack.blocks 必须是数组');
  if (!Array.isArray(pack.categories)) throw new Error('pack.categories 必须是数组');
  if (pack.categories.length !== 1) throw new Error('pack.categories 必须只包含固定的自定义事件分类');
  pack.categories.forEach((item, index) => {
    const category = record(item, `categories[${index}]`);
    rejectUnknownKeys(category, CATEGORY_KEYS, `categories[${index}]`);
    if (
      category.id !== PROJECT_BLOCK_CATEGORY_ID ||
      category.name !== '自定义事件' ||
      category.colour !== 230 ||
      category.order !== 900
    ) {
      throw new Error('pack.categories 必须是固定的自定义事件分类');
    }
  });
  const blocks = pack.blocks.map(validateBlock);
  const blockTypes = new Set<string>();
  const eventTypes = new Set<string>();
  for (const [index, block] of blocks.entries()) {
    if (blockTypes.has(block.type)) throw new Error(`blocks[${index}].type 重复：${block.type}`);
    const eventType = String(block.event.match.equals);
    if (eventTypes.has(eventType)) throw new Error(`自定义事件 type 重复：${eventType}`);
    blockTypes.add(block.type);
    eventTypes.add(eventType);
  }
  return { ...pack, blocks } as unknown as ProjectBlockPack;
}

function resultError(result: RegisterPackResult): Error {
  return new Error(result.diagnostics.map((item) => item.message).join('\n'));
}

let state: ProjectBlockPackState = { status: 'idle', pack: createEmptyProjectBlockPack() };
let loading: Promise<ProjectBlockPackState> | null = null;
const listeners = new Set<(next: ProjectBlockPackState) => void>();

function publish(next: ProjectBlockPackState): ProjectBlockPackState {
  state = next;
  listeners.forEach((listener) => listener(next));
  return next;
}

function applyPack(pack: ProjectBlockPack, overridden: boolean): ProjectBlockPackState {
  if (pack.blocks.length === 0) blockRegistry.removePack(PROJECT_BLOCK_PACK_ID);
  else {
    const result = blockRegistry.replacePack(pack, { source: 'extension' });
    if (!result.ok) throw resultError(result);
  }
  return publish({ status: 'ready', pack, overridden });
}

/** Atomically replaces the active project's in-memory block definitions. */
export function replaceProjectBlockPack(value: unknown): ProjectBlockPackState {
  return applyPack(parseProjectBlockPack(value), true);
}

/** Releases all definitions owned by the current project without touching disk. */
export function removeProjectBlockPack(): ProjectBlockPackState {
  blockRegistry.removePack(PROJECT_BLOCK_PACK_ID);
  return publish({ status: 'idle', pack: createEmptyProjectBlockPack() });
}

function applyHandlerContent(): ProjectBlockPackState {
  const content = FileHandlerManager.get(PROJECT_BLOCK_PACK_PATH).getContent();
  if (content.status === 'loaded') {
    try {
      return applyPack(parseProjectBlockPack(parseJson(content.value)), true);
    } catch (cause) {
      blockRegistry.removePack(PROJECT_BLOCK_PACK_ID);
      return publish({
        status: 'error',
        pack: createEmptyProjectBlockPack(),
        error: cause instanceof Error ? cause : new Error(String(cause)),
        raw: content.value,
      });
    }
  }
  if (content.status === 'not-found') return applyPack(createEmptyProjectBlockPack(), false);
  if (content.status === 'error') {
    blockRegistry.removePack(PROJECT_BLOCK_PACK_ID);
    return publish({ status: 'error', pack: createEmptyProjectBlockPack(), error: content.error });
  }
  return publish({ status: content.status, pack: state.pack });
}

export function projectBlockPackState(): ProjectBlockPackState {
  return state;
}

export function subscribeProjectBlockPack(listener: (next: ProjectBlockPackState) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function invalidateProjectBlockPack(): void {
  applyHandlerContent();
}

export async function loadProjectBlockPack(): Promise<ProjectBlockPackState> {
  if (loading) return loading;
  if (state.status === 'ready' || state.status === 'error') return state;
  publish({ status: 'loading', pack: state.pack });
  loading = FileHandlerManager.load(PROJECT_BLOCK_PACK_PATH)
    .then(() => applyHandlerContent())
    .finally(() => {
      loading = null;
    });
  return loading;
}

export async function saveProjectBlockPack(value: unknown): Promise<void> {
  const pack = parseProjectBlockPack(value);
  const result = pack.blocks.length
    ? blockRegistry.replacePack(pack, { source: 'extension' })
    : { ok: (blockRegistry.removePack(PROJECT_BLOCK_PACK_ID), true), diagnostics: [], registeredBlockTypes: [] };
  if (!result.ok) throw resultError(result);
  await fs.promises.mkdir('.metaphysics/schemas/blockly');
  const options = { invalidate: invalidateProjectBlockPack };
  try {
    await operationHistory.execute(
      pack.blocks.length
        ? writeTextFileOperation(
            PROJECT_BLOCK_PACK_PATH,
            `${JSON.stringify(pack, null, 2)}\n`,
            { label: '保存自定义事件块', stage: 'blockly.project-pack.save' },
            options,
          )
        : deleteTextFileOperation(
            PROJECT_BLOCK_PACK_PATH,
            { label: '清空自定义事件块', stage: 'blockly.project-pack.delete' },
            options,
          ),
    );
  } catch (cause) {
    applyHandlerContent();
    throw cause;
  }
}

export async function deleteProjectBlockPack(): Promise<void> {
  await saveProjectBlockPack(createEmptyProjectBlockPack());
}

export function resetProjectBlockPackForTests(): void {
  removeProjectBlockPack();
  loading = null;
  listeners.clear();
}
