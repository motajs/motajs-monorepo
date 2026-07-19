import type * as Blockly from 'blockly';

import type {
  BlockDefinition,
  BlockState,
  EventObject,
  ParseContext,
} from '../parser/types';

export type BindingKind = 'field' | 'value' | 'statement';
export type BindingValueType =
  | 'raw'
  | 'string'
  | 'number'
  | 'boolean'
  | 'json'
  | 'expression'
  | 'colour'
  | 'json-or-string';

export interface EventMatcher {
  path: string;
  equals: unknown;
}

export interface BlockBinding {
  input: string;
  kind: BindingKind;
  path: string;
  optional?: boolean;
  default?: unknown;
  omitWhenDefault?: boolean;
  valueType?: BindingValueType;
}

export interface DeclarativeEventMapping {
  match: EventMatcher;
  template: unknown;
  bindings: BlockBinding[];
  /** Preserve fields that are not represented by bindings on each block instance. */
  preserveUnbound?: boolean;
}

export type MaterialKind =
  | 'image'
  | 'animate'
  | 'bgm'
  | 'sound'
  | 'tileset'
  | 'autotile'
  | 'hero';

export type BlocklyPreviewAdapterId =
  | 'event'
  | 'text'
  | 'textDrawing'
  | 'setText'
  | 'waitRect'
  | 'floorImage';

export type BlocklyCompletionSourceId =
  | 'auto'
  | 'contextual'
  | 'expression'
  | 'id'
  | 'enemy'
  | 'item'
  | 'floor'
  | 'shop'
  | 'commonEvent'
  | 'image'
  | 'animate'
  | 'bgm'
  | 'sound'
  | 'font'
  | 'color'
  | 'flag'
  | 'status'
  | 'core'
  | 'textEscape';

export type TrustedBlocklyCommandId = 'showKeyCodes';

export type DeclarativeInteraction =
  | {
      type: 'editText';
      field: string;
      mode: 'multiline' | 'escaped-newline' | 'javascript';
      lint?: boolean;
    }
  | {
      type: 'selectPoint';
      xField: string;
      yField: string;
      floorField?: string;
      floorPolicy?: 'current' | 'explicit' | 'relative';
      multiple?: boolean;
    }
  | {
      type: 'selectMaterial';
      field: string;
      materialKind: MaterialKind;
      multiple?: boolean;
      transform?: 'strip-animate-extension';
      aliasPolicy?: 'preserve' | 'prefer-alias' | 'physical-name';
    }
  | {
      type: 'preview';
      adapter: BlocklyPreviewAdapterId;
    }
  | {
      type: 'autocomplete';
      field: string;
      source: BlocklyCompletionSourceId;
    }
  | {
      type: 'colourBinding';
      textField: string;
      colourField: string;
    }
  | {
      type: 'command';
      command: TrustedBlocklyCommandId;
      trigger: 'doubleClick' | 'contextMenu';
    };

export interface SchemaToolboxDefinition {
  category: string;
  order?: number;
  defaults?: Record<string, unknown>;
}

export interface DeclarativeBlockSchema {
  type: string;
  definition: BlockDefinition;
  event: DeclarativeEventMapping;
  toolbox?: SchemaToolboxDefinition;
  interactions?: DeclarativeInteraction[];
  defaultInteraction?: DeclarativeInteraction['type'];
  persistWorkspaceState?: boolean;
  category?: string;
  isValue?: boolean;
}

/** @deprecated New schemas should use event.bindings. */
export interface FieldMappingConfig {
  eventField: string;
  parse?: (value: unknown) => unknown;
  generate?: (value: unknown) => unknown;
  default?: unknown;
  omitEmpty?: boolean;
}

/** @deprecated New schemas should use event.bindings. */
export type FieldMapping = Record<string, string | FieldMappingConfig>;

export type BlockParser = (event: EventObject, context: ParseContext) => BlockState;
export type BlockGenerator = (block: Blockly.Block) => string | [string, number];

export interface BlockCodec {
  reason: string;
  parser: BlockParser;
  generator: BlockGenerator;
}

/**
 * Built-in schemas may temporarily retain legacy behavior functions while they
 * are moved to declarative mappings or separately registered codecs.
 */
export interface BlockSchema {
  eventType: string;
  definition: BlockDefinition;
  event?: DeclarativeEventMapping;
  toolbox?: SchemaToolboxDefinition;
  interactions?: DeclarativeInteraction[];
  defaultInteraction?: DeclarativeInteraction['type'];
  persistWorkspaceState?: boolean;
  fieldMapping?: FieldMapping;
  parser?: BlockParser;
  generator?: BlockGenerator;
  category?: string;
  isValue?: boolean;
}

export interface ToolboxCategoryDefinition {
  id: string;
  name: string;
  colour: number;
  order?: number;
}

export interface BlocklyBlockPack {
  id: string;
  version: number;
  blocks: Array<BlockSchema | DeclarativeBlockSchema>;
  categories?: ToolboxCategoryDefinition[];
}

export function isDeclarativeBlockSchema(
  schema: BlockSchema | DeclarativeBlockSchema,
): schema is DeclarativeBlockSchema {
  return 'type' in schema && !('eventType' in schema);
}

export type BlockPackSource = 'builtin' | 'extension';

export interface RegistryDiagnostic {
  level: 'error' | 'warning';
  code: string;
  message: string;
  packId?: string;
  blockType?: string;
  input?: string;
}

export interface RegisterPackOptions {
  source: BlockPackSource;
}

export interface RegisterPackResult {
  ok: boolean;
  diagnostics: RegistryDiagnostic[];
  registeredBlockTypes: string[];
}

/** @deprecated Prefer registerPack for new callers. */
export interface RegisterOptions {
  override?: boolean;
}
