import * as Blockly from 'blockly';
import { javascriptGenerator, Order } from 'blockly/javascript';
import JSON5 from 'json5';

import type { BlockState, EventObject, ParseContext } from '../parser/types';
import { getCategoryColour } from '../schemas/categoryColours';
import { cloneJson, deleteAtPath, getAtPath, parseDataPath, setAtPath } from './path';
import type {
  BindingValueType,
  BlockCodec,
  BlockGenerator,
  BlocklyBlockPack,
  BlockParser,
  BlockSchema,
  FieldMappingConfig,
  RegisterOptions,
  RegisterPackOptions,
  RegisterPackResult,
  RegistryDiagnostic,
  ToolboxCategoryDefinition,
  DeclarativeBlockSchema,
} from './types';
import { createExpressionBlock, generateEventJson, isEmpty, parseEventList, setParseEventListFn } from './utils';
import { editorConfigService } from '@/services/editorConfig';
import { replaceExpressionForDisplay, replaceExpressionFromDisplay } from '../representation';
import { editorDocsEndpoint } from '@/environment';
import {
  PROJECT_EVENT_PASSTHROUGH_EXTENSION,
  readProjectEventRaw,
} from '../extensions/projectEventPassthrough';

const SAFE_EXTENSION_FIELDS = new Set([
  'field_input',
  'field_number',
  'field_colour',
  'field_label',
  'field_multilinetext',
  'field_checkbox',
  'field_dropdown',
  'input_value',
  'input_statement',
  'input_dummy',
]);
const RESERVED_CATEGORY_IDS = new Set([
  'entry', 'text', 'data', 'map', 'eventControl', 'effect', 'sound',
  'ui', 'native', 'value', 'templates', 'recent',
]);
const SAFE_INTERACTION_TYPES = new Set([
  'editText', 'selectPoint', 'selectMaterial', 'preview',
  'autocomplete', 'colourBinding', 'command',
]);
const SAFE_COMMANDS = new Set(['showKeyCodes']);
const SAFE_PREVIEW_ADAPTERS = new Set([
  'event', 'text', 'textDrawing', 'setText', 'waitRect', 'floorImage',
]);
const SAFE_COMPLETION_SOURCES = new Set([
  'auto', 'contextual', 'expression', 'id', 'enemy', 'item', 'floor', 'shop', 'commonEvent',
  'image', 'animate', 'bgm', 'sound', 'font', 'color', 'flag', 'status', 'core', 'textEscape',
]);
const WORKSPACE_STATE_EVENTS = new Set([
  'text', 'if', 'confirm', 'switch', 'choices', 'for', 'forEach',
  'while', 'dowhile', 'wait', 'previewUI',
  '_choice_item', '_switch_case', '_wait_keyboard', '_wait_mouse',
  '_wait_condition', '_wait_timeout',
  'setBlockOpacity', 'setBlockFilter', 'turnBlock', 'showFloorImg', 'hideFloorImg',
  'showBgFgMap', 'hideBgFgMap', 'setBgFgBlock', 'follow', 'unfollow', 'loadEquip',
  'unloadEquip', 'resetEnemyOnPoint', 'moveEnemyOnPoint', '_moveEnemyOnPointRelative',
  'setEquip', 'loadBgm', 'freeBgm', 'setBgmSpeed', 'showTextImage', 'rotateImage',
  'scaleImage', 'showGif', 'setFilter', 'fillText', 'drawTextContent', 'drawLine',
  'drawArrow', 'fillPolygon', 'strokePolygon', 'fillEllipse', 'strokeEllipse',
  'fillArc', 'strokeArc', 'drawImage',
]);
const MATERIAL_EVENT_KINDS: Record<string, import('./types').MaterialKind> = {
  animate: 'animate', playSound: 'sound', playBgm: 'bgm',
  showImage: 'image', showGif: 'image', setHeroIcon: 'hero',
};
const PREVIEW_EVENT_TYPES = new Set([
  'showImage', 'showGif', 'setCurtain', 'setWeather', 'choices', 'confirm', 'setText',
]);
const disabledBlocksBeingGenerated = new WeakSet<Blockly.Block>();

export function withDisabledBlocksEnabled<T>(workspace: Blockly.Workspace, generate: () => T): T {
  const disabled = workspace.getAllBlocks(false)
    .filter((block) => !block.isEnabled())
    .map((block) => ({ block, reasons: [...block.getDisabledReasons()] }));
  const eventsWereEnabled = Blockly.Events.isEnabled();
  if (eventsWereEnabled) Blockly.Events.disable();
  disabled.forEach(({ block, reasons }) => {
    disabledBlocksBeingGenerated.add(block);
    reasons.forEach((reason) => block.setDisabledReason(false, reason));
  });
  try {
    return generate();
  } finally {
    disabled.forEach(({ block, reasons }) => {
      reasons.forEach((reason) => block.setDisabledReason(true, reason));
      disabledBlocksBeingGenerated.delete(block);
    });
    if (eventsWereEnabled) Blockly.Events.enable();
  }
}

function matcherKey(schema: BlockSchema): string | null {
  return schema.event
    ? `${schema.event.match.path}:${JSON.stringify(schema.event.match.equals)}`
    : null;
}

function containsExecutable(value: unknown, seen = new Set<object>()): boolean {
  if (typeof value === 'function') return true;
  if (!value || typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  return Object.values(value as Record<string, unknown>).some((item) => containsExecutable(item, seen));
}

function normalizePackSchema(schema: BlockSchema | DeclarativeBlockSchema): BlockSchema {
  if ('eventType' in schema) return schema;
  const inferredEventType = schema.event.match.path === 'type'
    && typeof schema.event.match.equals === 'string'
    ? schema.event.match.equals
    : `extension:${schema.type}`;
  return {
    ...schema,
    eventType: inferredEventType,
    definition: { ...schema.definition, type: schema.type },
  };
}

function allDefinitionArgs(schema: BlockSchema): Array<{ type: string; name?: string }> {
  const definition = schema.definition as unknown as Record<string, unknown>;
  const args: Array<{ type: string; name?: string }> = [];
  for (const [key, value] of Object.entries(definition)) {
    if (/^args\d+$/.test(key) && Array.isArray(value)) {
      args.push(...(value as Array<{ type: string; name?: string }>));
    }
  }
  return args;
}

function inferBuiltinInteractions(schema: BlockSchema): BlockSchema {
  const interactions = [...(schema.interactions ?? [])];
  const args = allDefinitionArgs(schema);
  const names = new Set(args.map((arg) => arg.name));
  if (!interactions.some((item) => item.type === 'editText')) {
    const multiline = args.find((arg) => arg.type === 'field_multilinetext' && arg.name);
    if (multiline?.name) interactions.push({ type: 'editText', field: multiline.name, mode: 'multiline' });
  }
  if (schema.category === 'map' && !interactions.some((item) => item.type === 'selectPoint')) {
    const xField = names.has('X') ? 'X' : names.has('POS_X') ? 'POS_X' : undefined;
    const yField = names.has('Y') ? 'Y' : names.has('POS_Y') ? 'POS_Y' : undefined;
    if (xField && yField) interactions.push({
      type: 'selectPoint', xField, yField,
      floorField: names.has('FLOOR_ID') ? 'FLOOR_ID' : undefined,
      floorPolicy: names.has('FLOOR_ID') ? 'explicit' : 'current',
    });
  }
  const materialKind = MATERIAL_EVENT_KINDS[schema.eventType];
  if (materialKind && names.has('NAME') && !interactions.some((item) => item.type === 'selectMaterial')) {
    interactions.push({
      type: 'selectMaterial', field: 'NAME', materialKind,
      transform: materialKind === 'animate' ? 'strip-animate-extension' : undefined,
      aliasPolicy: 'preserve',
    });
  }
  if (PREVIEW_EVENT_TYPES.has(schema.eventType) && !interactions.some((item) => item.type === 'preview')) {
    interactions.push({ type: 'preview', adapter: 'event' });
  }
  const materialCompletion = interactions.find((item) => item.type === 'selectMaterial');
  if (materialCompletion?.type === 'selectMaterial'
    && !interactions.some((item) => item.type === 'autocomplete' && item.field === materialCompletion.field)) {
    const source = materialCompletion.materialKind === 'hero' || materialCompletion.materialKind === 'tileset'
      || materialCompletion.materialKind === 'autotile'
      ? 'image'
      : materialCompletion.materialKind;
    interactions.push({ type: 'autocomplete', field: materialCompletion.field, source });
  }
  args.forEach((arg, index) => {
    const previous = args[index - 1];
    if (arg.type === 'field_colour' && arg.name && previous?.type === 'field_input' && previous.name
      && !interactions.some((item) => item.type === 'colourBinding' && item.colourField === arg.name)) {
      interactions.push({ type: 'colourBinding', textField: previous.name, colourField: arg.name });
    }
  });
  for (const binding of schema.event?.bindings ?? []) {
    if (binding.kind !== 'field' || interactions.some((item) => item.type === 'autocomplete' && item.field === binding.input)) continue;
    const source = binding.input === 'FLOOR_ID' ? 'floor'
      : binding.input === 'ID' ? 'id'
      : binding.valueType === 'expression' ? 'expression'
      : null;
    if (source) interactions.push({ type: 'autocomplete', field: binding.input, source });
  }
  for (const arg of args) {
    if (arg.type !== 'field_input' || !arg.name
      || interactions.some((item) => item.type === 'autocomplete' && item.field === arg.name)) continue;
    const source = arg.name === 'FLOOR_ID' ? 'floor'
      : arg.name === 'ID' ? (schema.eventType === 'useItem' ? 'item'
        : schema.eventType === 'openShop' || schema.eventType === 'disableShop' ? 'shop'
        : schema.eventType === 'insert' ? 'commonEvent'
        : 'id')
      : null;
    if (source) interactions.push({ type: 'autocomplete', field: arg.name, source });
  }
  return interactions.length ? {
    ...schema,
    interactions,
    defaultInteraction: schema.defaultInteraction
      ?? (interactions.some((item) => item.type === 'preview') ? 'preview' : undefined),
  } : schema;
}

function applyInteractionFields(schema: BlockSchema, completeAllTextInputs: boolean): BlockSchema['definition'] {
  const completionByField = new Map(
    (schema.interactions ?? []).flatMap((interaction) => (
      interaction.type === 'autocomplete' ? [[interaction.field, interaction.source] as const] : []
    )),
  );
  const definition = { ...schema.definition } as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(definition)) {
    if (!/^args\d+$/.test(key) || !Array.isArray(value)) continue;
    definition[key] = value.map((raw: Record<string, unknown>) => {
      const source = typeof raw.name === 'string' ? completionByField.get(raw.name) : undefined;
      if (raw.type !== 'field_input') return raw;
      return source || completeAllTextInputs
        ? { ...raw, type: 'field_mota_autocomplete', completionSource: source ?? 'contextual' }
        : { ...raw, type: 'field_mota_text_input' };
    });
  }
  return definition as unknown as BlockSchema['definition'];
}

export function normalizeBuiltinStatementLayout(
  input: BlockSchema['definition'],
): BlockSchema['definition'] {
  const definition = input as unknown as Record<string, unknown>;
  const lines: Array<{ message: string; args?: Array<Record<string, unknown>> }> = [];
  let hasValueInput = false;
  let hasStatementInput = false;
  let index = 0;
  while (typeof definition[`message${index}`] === 'string') {
    const message = definition[`message${index}`] as string;
    const args = Array.isArray(definition[`args${index}`])
      ? definition[`args${index}`] as Array<Record<string, unknown>>
      : undefined;
    if (args?.some((arg) => arg.type === 'input_value')) hasValueInput = true;
    const statementArgs = args?.filter((arg) => arg.type === 'input_statement') ?? [];
    if (statementArgs.length) hasStatementInput = true;
    const hasSingleStatement = statementArgs.length === 1;
    const headerArgs: Array<Record<string, unknown>> = [];
    let title = message;
    if (hasSingleStatement) {
      args?.forEach((arg, argIndex) => {
        const placeholder = new RegExp(`%${argIndex + 1}(?!\\d)`, 'g');
        if (arg.type === 'input_statement' || arg.type === 'input_dummy') {
          title = title.replace(placeholder, '');
        } else {
          headerArgs.push(arg);
          title = title.replace(placeholder, `%${headerArgs.length}`);
        }
      });
      title = title.replace(/\s+/g, ' ').trim();
    }
    const isInventedLabel = /^(?:执行|则执行|响应分支|分支列表|选项列表)$/.test(title);
    if (hasSingleStatement) {
      if (title && !isInventedLabel) lines.push({
        message: title,
        args: headerArgs.length ? headerArgs : undefined,
      });
      lines.push({ message: '%1', args: statementArgs });
    } else lines.push({ message, args });
    index += 1;
  }
  const isStatementBlock = Object.prototype.hasOwnProperty.call(definition, 'previousStatement')
    || Object.prototype.hasOwnProperty.call(definition, 'nextStatement');
  const canMergeFieldRows = lines.length > 1
    && isStatementBlock
    && !hasStatementInput
    && !hasValueInput
    && definition.inputsInline !== false
    && lines.every((line) => (line.args ?? []).every((arg) => (
      typeof arg.type === 'string'
      && arg.type.startsWith('field_')
      && arg.type !== 'field_multilinetext'
    )));
  if (canMergeFieldRows) {
    let offset = 0;
    const args: Array<Record<string, unknown>> = [];
    const message = lines.map((line) => {
      const shifted = line.message.replace(/%(\d+)/g, (_match, rawIndex: string) => (
        `%${offset + Number(rawIndex)}`
      ));
      offset += line.args?.length ?? 0;
      args.push(...(line.args ?? []));
      return shifted;
    }).join(' ').replace(/\s+/g, ' ').trim();
    lines.splice(0, lines.length, { message, args: args.length ? args : undefined });
  }
  const layoutChanged = lines.length !== index
    || lines.some((line, lineIndex) => line.message !== definition[`message${lineIndex}`]);
  const needsInlineValues = (hasValueInput || canMergeFieldRows) && definition.inputsInline === undefined;
  if (!layoutChanged && !needsInlineValues) return input;

  const normalized = Object.fromEntries(
    Object.entries(definition).filter(([key]) => !/^(?:message|args)\d+$/.test(key)),
  );
  lines.forEach((line, lineIndex) => {
    normalized[`message${lineIndex}`] = line.message;
    if (line.args) normalized[`args${lineIndex}`] = line.args;
  });
  if (needsInlineValues) normalized.inputsInline = true;
  return normalized as unknown as BlockSchema['definition'];
}

function checkboxValue(value: unknown): boolean {
  return value === true || value === 'TRUE' || value === 'true' || value === 1;
}

function coerceFromField(value: unknown, type: BindingValueType = 'raw'): unknown {
  if (type === 'raw') return value;
  if (type === 'string') return value == null ? '' : String(value);
  if (type === 'boolean') return checkboxValue(value);
  if (type === 'number') {
    if (value === '' || value == null) return undefined;
    const number = Number(value);
    if (!Number.isFinite(number)) throw new Error(`Expected a number, got ${String(value)}`);
    return number;
  }
  if (type === 'expression') {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(trimmed)) return Number(trimmed);
    return value;
  }
  if (type === 'colour') {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string' || !value.trim()) return undefined;
    return value.split(',').map((item) => {
      const trimmed = item.trim();
      const number = Number(trimmed);
      return Number.isFinite(number) ? number : trimmed;
    });
  }
  if (type === 'json-or-string') {
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  if (typeof value !== 'string') return value;
  return JSON.parse(value);
}

function coerceToField(value: unknown, type: BindingValueType = 'raw'): unknown {
  if (type === 'json') return JSON.stringify(value);
  if (value == null) return '';
  if (type === 'boolean') return checkboxValue(value);
  if (type === 'colour') return Array.isArray(value) ? value.join(',') : String(value);
  if (type === 'json-or-string') return Array.isArray(value) ? JSON.stringify(value) : String(value);
  if (type === 'string' || type === 'number') return String(value);
  return value;
}

function parseGeneratedValue(code: string): unknown {
  const trimmed = code.trim().replace(/,$/, '');
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

function parseGeneratedStatements(code: string): unknown[] {
  const trimmed = code.trim().replace(/,$/, '');
  if (!trimmed) return [];
  return JSON5.parse(`[${trimmed}]`) as unknown[];
}

export function roundTripDeclarativeEvent(schema: BlockSchema, input: EventObject): EventObject {
  if (!schema.event) throw new Error(`Block ${schema.definition.type} has no declarative event mapping`);
  let event = schema.event.preserveUnbound
    ? cloneJson(input)
    : cloneJson(schema.event.template);
  for (const binding of schema.event.bindings) {
    const source = getAtPath(input, binding.path);
    let value = source === undefined ? cloneJson(binding.default) : source;
    if (binding.kind === 'field') {
      value = coerceFromField(coerceToField(value, binding.valueType), binding.valueType);
    }
    const shouldOmit = (binding.optional && (value === undefined || value === ''))
      || (binding.omitWhenDefault && Object.is(value, binding.default));
    if (shouldOmit) deleteAtPath(event, binding.path);
    else event = setAtPath(event, binding.path, value);
  }
  return event as EventObject;
}

export class BlockRegistry {
  private schemas = new Map<string, BlockSchema>();
  private blockTypes = new Map<string, BlockSchema>();
  private matcherSchemas = new Map<string, BlockSchema>();
  private codecs = new Map<string, BlockCodec>();
  private packSources = new Map<string, RegisterPackOptions['source']>();
  private categories = new Map<string, ToolboxCategoryDefinition>();
  private packs = new Map<string, {
    pack: BlocklyBlockPack & { blocks: BlockSchema[] };
    options: RegisterPackOptions;
  }>();
  private initialized = false;

  register(schema: BlockSchema, options: RegisterOptions = {}): void {
    const result = this.registerPack(
      { id: `legacy:${schema.definition.type}`, version: 1, blocks: [schema] },
      { source: 'builtin' },
      options.override,
    );
    for (const diagnostic of result.diagnostics) {
      console.warn(`BlockRegistry: ${diagnostic.message}`);
    }
  }

  registerAll(schemas: BlockSchema[], options: RegisterOptions = {}): void {
    for (const schema of schemas) this.register(schema, options);
  }

  registerPack(
    pack: BlocklyBlockPack,
    options: RegisterPackOptions,
    allowOverride = false,
  ): RegisterPackResult {
    const normalizedPack: BlocklyBlockPack & { blocks: BlockSchema[] } = {
      ...pack,
      blocks: pack.blocks.map((raw) => {
        const schema = normalizePackSchema(raw);
        if (options.source !== 'builtin') return schema;
        const inferred = inferBuiltinInteractions(schema);
        return WORKSPACE_STATE_EVENTS.has(inferred.eventType)
          ? { ...inferred, persistWorkspaceState: true }
          : inferred;
      }),
    };
    const diagnostics = this.validatePack(normalizedPack, options, allowOverride);
    if (diagnostics.some((item) => item.level === 'error')) {
      return { ok: false, diagnostics, registeredBlockTypes: [] };
    }

    const registeredBlockTypes: string[] = [];
    for (const schema of normalizedPack.blocks) {
      const previous = this.blockTypes.get(schema.definition.type);
      if (previous && allowOverride) {
        this.schemas.delete(previous.eventType);
        const previousMatcher = matcherKey(previous);
        if (previousMatcher) this.matcherSchemas.delete(previousMatcher);
      }
      this.schemas.set(schema.eventType, schema);
      this.blockTypes.set(schema.definition.type, schema);
      const key = matcherKey(schema);
      if (key) this.matcherSchemas.set(key, schema);
      this.packSources.set(schema.definition.type, options.source);
      registeredBlockTypes.push(schema.definition.type);
      if (this.initialized) this.registerToBlockly(schema);
    }
    for (const category of pack.categories ?? []) this.categories.set(category.id, category);
    this.packs.set(pack.id, { pack: normalizedPack, options });

    return { ok: true, diagnostics, registeredBlockTypes };
  }

  replacePack(
    pack: BlocklyBlockPack,
    options: RegisterPackOptions = { source: 'extension' },
  ): RegisterPackResult {
    const previous = this.packs.get(pack.id);
    if (previous && previous.options.source !== options.source) {
      return {
        ok: false,
        registeredBlockTypes: [],
        diagnostics: [{
          level: 'error',
          code: 'pack.source',
          message: `Pack ${pack.id} cannot replace a ${previous.options.source} pack`,
          packId: pack.id,
        }],
      };
    }
    if (previous) this.removePack(pack.id);
    const result = this.registerPack(pack, options);
    if (!result.ok && previous) this.registerPack(previous.pack, previous.options);
    return result;
  }

  removePack(packId: string): boolean {
    const registered = this.packs.get(packId);
    if (!registered) return false;
    for (const schema of registered.pack.blocks) {
      if (this.schemas.get(schema.eventType) === schema) this.schemas.delete(schema.eventType);
      if (this.blockTypes.get(schema.definition.type) === schema) this.blockTypes.delete(schema.definition.type);
      const key = matcherKey(schema);
      if (key && this.matcherSchemas.get(key) === schema) this.matcherSchemas.delete(key);
      this.packSources.delete(schema.definition.type);
      this.codecs.delete(schema.definition.type);
      if (this.initialized) {
        delete Blockly.Blocks[schema.definition.type];
        delete javascriptGenerator.forBlock[schema.definition.type];
      }
    }
    for (const category of registered.pack.categories ?? []) {
      if (this.categories.get(category.id) === category) this.categories.delete(category.id);
    }
    this.packs.delete(packId);
    return true;
  }

  registerPackJson(
    input: string | unknown,
    options: RegisterPackOptions = { source: 'extension' },
  ): RegisterPackResult {
    try {
      const value = typeof input === 'string' ? JSON.parse(input) : input;
      if (value === null || typeof value !== 'object' || !Array.isArray((value as BlocklyBlockPack).blocks)) {
        throw new Error('Block pack must be an object with a blocks array');
      }
      return this.registerPack(value as BlocklyBlockPack, options);
    } catch (cause) {
      return {
        ok: false,
        registeredBlockTypes: [],
        diagnostics: [{
          level: 'error',
          code: 'pack.parse',
          message: cause instanceof Error ? cause.message : String(cause),
        }],
      };
    }
  }

  registerCodec(blockType: string, codec: BlockCodec): void {
    if (!codec.reason.trim()) throw new Error(`Codec ${blockType} must explain why it is non-trivial`);
    if (!this.blockTypes.has(blockType)) throw new Error(`Cannot register codec for unknown block ${blockType}`);
    if (this.packSources.get(blockType) === 'extension') {
      throw new Error(`Extension block ${blockType} cannot register executable codecs`);
    }
    this.codecs.set(blockType, codec);
    if (this.initialized) this.registerToBlockly(this.blockTypes.get(blockType)!);
  }

  initialize(): void {
    if (this.initialized) return;
    for (const schema of this.blockTypes.values()) this.registerToBlockly(schema);
    this.initialized = true;
  }

  getParser(eventType: string): BlockParser | null {
    const schema = this.schemas.get(eventType);
    return schema ? this.getParserForSchema(schema) : null;
  }

  getParserForEvent(event: EventObject): BlockParser | null {
    for (const schema of this.matcherSchemas.values()) {
      if (Object.is(getAtPath(event, schema.event!.match.path), schema.event!.match.equals)) {
        return this.getParserForSchema(schema);
      }
    }
    return this.getParser(event.type);
  }

  getSchema(eventType: string): BlockSchema | undefined {
    return this.schemas.get(eventType);
  }

  getSchemaByBlockType(blockType: string): BlockSchema | undefined {
    return this.blockTypes.get(blockType);
  }

  getRegisteredEventTypes(): string[] {
    return Array.from(this.schemas.keys());
  }

  getRegisteredBlockTypes(): string[] {
    return Array.from(this.blockTypes.keys());
  }

  getRegisteredSchemas(): BlockSchema[] {
    return Array.from(this.blockTypes.values());
  }

  hasEventType(eventType: string): boolean {
    return this.schemas.has(eventType);
  }

  getRegisteredCategories(): NonNullable<BlocklyBlockPack['categories']> {
    return Array.from(this.categories.values());
  }

  private getParserForSchema(schema: BlockSchema): BlockParser | null {
    const codec = this.codecs.get(schema.definition.type);
    const parser = codec?.parser
      ?? schema.parser
      ?? (schema.event ? this.createDeclarativeParser(schema) : null)
      ?? (schema.fieldMapping ? this.createParserFromLegacyMapping(schema) : null);
    if (!parser || !schema.persistWorkspaceState) return parser;
    return (event, context) => ({
      ...parser(event, context),
      ...(event._collapsed === true ? { collapsed: true } : {}),
      ...(event._disabled === true ? { enabled: false } : {}),
    });
  }

  private validatePack(
    pack: BlocklyBlockPack & { blocks: BlockSchema[] },
    options: RegisterPackOptions,
    allowOverride: boolean,
  ): RegistryDiagnostic[] {
    const diagnostics: RegistryDiagnostic[] = [];
    const localTypes = new Set<string>();
    const localEvents = new Set<string>();
    const localMatchers = new Set<string>();
    const error = (code: string, message: string, schema?: BlockSchema, input?: string) => {
      diagnostics.push({
        level: 'error', code, message, packId: pack.id,
        blockType: schema?.definition?.type, input,
      });
    };

    if (!pack.id || !Number.isInteger(pack.version) || pack.version < 1) {
      error('pack.invalid', 'Pack id and positive integer version are required');
    }

    for (const schema of pack.blocks) {
      const type = schema?.definition?.type;
      if (!type) {
        error('block.type', 'Schema requires definition.type', schema);
        continue;
      }
      if (localTypes.has(type)) error('block.duplicate', `Duplicate block type ${type} in pack`, schema);
      localTypes.add(type);
      if (!schema.eventType) error('event.type', `Block ${type} requires eventType`, schema);
      if (localEvents.has(schema.eventType)) error('event.duplicate', `Duplicate eventType ${schema.eventType} in pack`, schema);
      localEvents.add(schema.eventType);

      const existing = this.blockTypes.get(type);
      if (existing && !allowOverride) error('block.exists', `Block type ${type} is already registered`, schema);
      if (options.source === 'extension' && existing) error('extension.override', `Extension cannot override ${type}`, schema);
      if (options.source === 'extension' && (schema.parser || schema.generator || schema.fieldMapping)) {
        error('extension.executable', `Extension ${type} must use declarative event bindings`, schema);
      }
      if (options.source === 'extension' && containsExecutable(schema)) {
        error('extension.executable', `Extension ${type} contains executable values`, schema);
      }
      if (options.source === 'extension' && !schema.event) {
        error('extension.mapping', `Extension ${type} requires an event mapping`, schema);
      }

      const args = allDefinitionArgs(schema);
      const argByName = new Map(args.filter((arg) => arg.name).map((arg) => [arg.name!, arg]));
      for (const arg of args) {
        if (options.source === 'extension' && !SAFE_EXTENSION_FIELDS.has(arg.type)) {
          error('input.unsafe', `Field type ${arg.type} is not available to extensions`, schema, arg.name);
        }
      }

      for (const interaction of schema.interactions ?? []) {
        if (!interaction || !SAFE_INTERACTION_TYPES.has(interaction.type)) {
          error('interaction.unsafe', `Unknown interaction ${String(interaction?.type)}`, schema);
          continue;
        }
        const requireField = (field: string | undefined) => {
          if (!field || !argByName.has(field)) {
            error('interaction.missing-field', `Interaction field ${String(field)} does not exist`, schema, field);
          }
        };
        if (interaction.type === 'editText' || interaction.type === 'selectMaterial'
          || interaction.type === 'autocomplete') requireField(interaction.field);
        if (interaction.type === 'selectPoint') {
          requireField(interaction.xField);
          requireField(interaction.yField);
          if (interaction.floorField) requireField(interaction.floorField);
        }
        if (interaction.type === 'colourBinding') {
          requireField(interaction.textField);
          requireField(interaction.colourField);
        }
        if (interaction.type === 'command' && !SAFE_COMMANDS.has(interaction.command)) {
          error('interaction.unsafe-command', `Command ${String(interaction.command)} is not public`, schema);
        }
        if (interaction.type === 'preview' && !SAFE_PREVIEW_ADAPTERS.has(interaction.adapter)) {
          error('interaction.unsafe-preview', `Preview adapter ${String(interaction.adapter)} is not public`, schema);
        }
        if (interaction.type === 'autocomplete' && !SAFE_COMPLETION_SOURCES.has(interaction.source)) {
          error('interaction.unsafe-completion', `Completion source ${String(interaction.source)} is not public`, schema);
        }
      }
      if (schema.defaultInteraction
        && !(schema.interactions ?? []).some((interaction) => interaction.type === schema.defaultInteraction)) {
        error('interaction.default', `Default interaction ${schema.defaultInteraction} is not declared`, schema);
      }

      if (schema.event) {
        try {
          parseDataPath(schema.event.match.path);
          for (const binding of schema.event.bindings) parseDataPath(binding.path);
        } catch (cause) {
          error('path.invalid', cause instanceof Error ? cause.message : String(cause), schema);
        }
        const key = matcherKey(schema)!;
        if (localMatchers.has(key) || (this.matcherSchemas.has(key) && !allowOverride)) {
          error('matcher.conflict', `Matcher ${key} is already registered`, schema);
        }
        localMatchers.add(key);
        const bindingInputs = new Set<string>();
        for (const binding of schema.event.bindings) {
          if (bindingInputs.has(binding.input)) error('binding.duplicate', `Input ${binding.input} is bound more than once`, schema, binding.input);
          bindingInputs.add(binding.input);
          const arg = argByName.get(binding.input);
          if (!arg) {
            error('binding.missing-input', `Input ${binding.input} does not exist in the block definition`, schema, binding.input);
          } else if (binding.kind === 'field' && arg.type.startsWith('input_')) {
            error('binding.kind', `${binding.input} is not a field`, schema, binding.input);
          } else if (binding.kind !== 'field' && arg.type !== `input_${binding.kind}`) {
            error('binding.kind', `${binding.input} is not an ${binding.kind} input`, schema, binding.input);
          }
        }
      }
    }

    const localCategories = new Set<string>();
    for (const category of pack.categories ?? []) {
      if (!category.id || localCategories.has(category.id)
        || (options.source === 'extension' && (this.categories.has(category.id) || RESERVED_CATEGORY_IDS.has(category.id)))) {
        diagnostics.push({ level: 'error', code: 'category.conflict', message: `Category ${category.id} is invalid or already registered`, packId: pack.id });
      }
      localCategories.add(category.id);
    }
    return diagnostics;
  }

  private registerToBlockly(schema: BlockSchema): void {
    const isBuiltin = this.packSources.get(schema.definition.type) === 'builtin';
    const withInteractions = applyInteractionFields(schema, isBuiltin);
    const withLayout = this.packSources.get(schema.definition.type) === 'builtin'
      ? normalizeBuiltinStatementLayout(withInteractions)
      : withInteractions;
    const definitionWithState = schema.event?.preserveUnbound
      ? {
          ...withLayout,
          mutator: PROJECT_EVENT_PASSTHROUGH_EXTENSION,
        }
      : withLayout;
    const definition = this.applyColourInheritance(definitionWithState, schema.category);
    const projectDocsPath = typeof definition.helpUrl === 'string' && definition.helpUrl.startsWith('/_docs/')
      ? definition.helpUrl.slice('/_docs/'.length)
      : undefined;
    const docsHelpUrl = projectDocsPath === undefined ? undefined : editorDocsEndpoint(projectDocsPath);
    const registeredDefinition = projectDocsPath === undefined
      ? definition
      : { ...definition, helpUrl: docsHelpUrl ?? '' };
    Blockly.common.defineBlocksWithJsonArray([registeredDefinition]);
    javascriptGenerator.forBlock[registeredDefinition.type] = this.getOrCreateGenerator(schema);
  }

  private applyColourInheritance(definition: BlockSchema['definition'], category?: string): BlockSchema['definition'] {
    if (typeof definition.colour === 'number') return definition;
    const colour = getCategoryColour(category);
    return colour === undefined ? definition : { ...definition, colour };
  }

  private getOrCreateGenerator(schema: BlockSchema): BlockGenerator {
    const codec = this.codecs.get(schema.definition.type);
    const generator = codec?.generator
      ?? schema.generator
      ?? (schema.event ? this.createDeclarativeGenerator(schema) : null)
      ?? (schema.fieldMapping ? this.createGeneratorFromLegacyMapping(schema) : null)
      ?? (() => '');
    if (!schema.persistWorkspaceState) return generator;
    return (block) => {
      const generated = generator(block);
      if (Array.isArray(generated)) return generated;
      const trimmed = generated.trim().replace(/,$/, '');
      if (!trimmed) return generated;
      try {
        const event = JSON5.parse(trimmed);
        if (!event || typeof event !== 'object' || Array.isArray(event)) return generated;
        if (block.isCollapsed()) event._collapsed = true;
        else delete event._collapsed;
        if (!block.isEnabled() || disabledBlocksBeingGenerated.has(block)) event._disabled = true;
        else delete event._disabled;
        return `${JSON.stringify(event)},\n`;
      } catch {
        return generated;
      }
    };
  }

  private createDeclarativeParser(schema: BlockSchema): BlockParser {
    return (event: EventObject, context: ParseContext): BlockState => {
      const fields: Record<string, unknown> = {};
      const inputs: NonNullable<BlockState['inputs']> = {};
      for (const binding of schema.event!.bindings) {
        const source = getAtPath(event, binding.path);
        let value = source === undefined ? cloneJson(binding.default) : source;
        if (typeof value === 'string' && !editorConfigService.get('disableBlocklyReplace', false)) {
          value = replaceExpressionForDisplay(value);
        }
        if (binding.kind === 'field') {
          fields[binding.input] = coerceToField(value, binding.valueType);
        } else if (binding.kind === 'statement') {
          const first = parseEventList(Array.isArray(value) ? value : [], context);
          if (first) inputs[binding.input] = { block: first };
        } else if (value !== undefined) {
          inputs[binding.input] = createExpressionBlock(
            typeof value === 'string' ? value : JSON.stringify(value),
          );
        }
      }
      const preserveState = schema.persistWorkspaceState;
      return {
        type: schema.definition.type,
        ...(preserveState && event._collapsed === true ? { collapsed: true } : {}),
        ...(preserveState && event._disabled === true ? { enabled: false } : {}),
        ...(Object.keys(fields).length ? { fields } : {}),
        ...(Object.keys(inputs).length ? { inputs } : {}),
        ...(schema.event!.preserveUnbound ? { extraState: { raw: cloneJson(event) } } : {}),
      };
    };
  }

  private createDeclarativeGenerator(schema: BlockSchema): BlockGenerator {
    return (block: Blockly.Block): string => {
      let event = schema.event!.preserveUnbound
        ? readProjectEventRaw(block) ?? cloneJson(schema.event!.template)
        : cloneJson(schema.event!.template);
      for (const binding of schema.event!.bindings) {
        let value: unknown;
        if (binding.kind === 'field') {
          value = coerceFromField(block.getFieldValue(binding.input), binding.valueType);
          if (typeof value === 'string' && !editorConfigService.get('disableBlocklyReplace', false)) {
            value = replaceExpressionFromDisplay(value);
          }
        } else if (binding.kind === 'statement') {
          value = parseGeneratedStatements(javascriptGenerator.statementToCode(block, binding.input));
        } else {
          value = parseGeneratedValue(javascriptGenerator.valueToCode(block, binding.input, Order.NONE));
        }
        const shouldOmit = (binding.optional && (value === undefined || value === ''))
          || (binding.omitWhenDefault && Object.is(value, binding.default));
        if (shouldOmit) deleteAtPath(event, binding.path);
        else event = setAtPath(event, binding.path, value);
      }
      if (schema.persistWorkspaceState && event && typeof event === 'object') {
        const record = event as Record<string, unknown>;
        if (block.isCollapsed()) record._collapsed = true;
        else delete record._collapsed;
        if (!block.isEnabled() || disabledBlocksBeingGenerated.has(block)) record._disabled = true;
        else delete record._disabled;
      }
      return JSON.stringify(event) + ',\n';
    };
  }

  private createParserFromLegacyMapping(schema: BlockSchema): BlockParser {
    return (event: EventObject): BlockState => {
      const fields: Record<string, unknown> = {};
      for (const [blockField, mapping] of Object.entries(schema.fieldMapping!)) {
        const config = this.normalizeLegacyMapping(mapping);
        let value: unknown = event[config.eventField] ?? config.default ?? '';
        if (config.parse) value = config.parse(value);
        fields[blockField] = value;
      }
      return { type: schema.definition.type, fields };
    };
  }

  private createGeneratorFromLegacyMapping(schema: BlockSchema): BlockGenerator {
    return (block: Blockly.Block): string => {
      const event: Record<string, unknown> = { type: schema.eventType };
      for (const [blockField, mapping] of Object.entries(schema.fieldMapping!)) {
        const config = this.normalizeLegacyMapping(mapping);
        let value = block.getFieldValue(blockField);
        if (config.generate) value = config.generate(value);
        if (config.omitEmpty !== false && isEmpty(value)) continue;
        event[config.eventField] = value;
      }
      return generateEventJson(event);
    };
  }

  private normalizeLegacyMapping(mapping: string | FieldMappingConfig): FieldMappingConfig {
    return typeof mapping === 'string' ? { eventField: mapping } : mapping;
  }
}

export const blockRegistry = new BlockRegistry();
export { setParseEventListFn };
export type {
  BindingValueType,
  BlockBinding,
  BlockCodec,
  BlockGenerator,
  BlocklyBlockPack,
  BlockParser,
  BlockSchema,
  DeclarativeBlockSchema,
  DeclarativeEventMapping,
  EventMatcher,
  FieldMapping,
  FieldMappingConfig,
  RegisterPackResult,
  RegistryDiagnostic,
  DeclarativeInteraction,
  MaterialKind,
  BlocklyPreviewAdapterId,
  BlocklyCompletionSourceId,
  TrustedBlocklyCommandId,
} from './types';
export { Order };
