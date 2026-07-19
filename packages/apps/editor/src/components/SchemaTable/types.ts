export type JsonSchemaType = "null" | "boolean" | "number" | "integer" | "string" | "array" | "object";

export interface JsonShape {
  type?: JsonSchemaType | JsonSchemaType[];
  enum?: unknown[];
  properties?: Record<string, JsonShape>;
  required?: string[];
  items?: JsonShape;
}

export type DataReference = { ref: string };

export type Expression =
  | { literal: unknown }
  | DataReference
  | {
      operator:
        | "eq" | "ne"
        | "gt" | "gte" | "lt" | "lte"
        | "and" | "or" | "not"
        | "in" | "includes" | "exists" | "empty";
      args: Expression[];
    }
  | { call: string; args?: Expression[] };

export type ConditionFallback = "hidden" | "hidden-if-empty" | "disabled" | "inactive";

export interface Condition {
  when: Expression;
  otherwise: ConditionFallback;
}

export interface SuggestionOption {
  value: string;
  label?: string;
}

export interface ChoiceOption {
  value: string | number | boolean | null;
  label?: string;
}

export type CombineInputDescriptor =
  | {
      key: string;
      label?: string;
      editor: { kind: "suggestion"; suggestions: SuggestionOption[] };
    }
  | {
      key: string;
      label?: string;
      editor: { kind: "number"; min?: number; max?: number; step?: number; integer?: boolean };
    };

export type EditorDescriptor =
  | { kind: "readonly" }
  | { kind: "text" }
  | { kind: "number" }
  | { kind: "checkbox" }
  | {
      kind: "select";
      options?: ChoiceOption[];
      reference?: DataReference;
    }
  | { kind: "stringList"; placeholder?: string }
  | { kind: "orderedStringList"; placeholder?: string; createLabel?: string }
  | {
      kind: "checkboxSet";
      options?: Array<{ value: string | number; label?: string }>;
      reference?: DataReference;
    }
  | { kind: "passability"; block?: DataReference }
  | { kind: "dimensions" }
  | {
      kind: "initialPosition";
      floors: DataReference;
      directions?: ChoiceOption[];
    }
  | {
      kind: "equipmentSlots";
      slots: DataReference;
      items: DataReference;
    }
  | {
      kind: "itemCountRecord";
      items: DataReference;
      category: "constants" | "tools" | "equips";
    }
  | { kind: "json" }
  | {
      kind: "event";
      entryType: string;
      floorId?: DataReference;
      position?: DataReference;
    }
  | {
      kind: "autoEventList";
      floorId?: DataReference;
      position?: DataReference;
    }
  | { kind: "code"; lint?: boolean; template?: string }
  | { kind: "point"; floorId?: DataReference }
  | { kind: "color" }
  | { kind: "block" }
  | { kind: "combine"; inputs: CombineInputDescriptor[] }
  | {
      kind: "bgmList";
      reference: DataReference;
      directory: string;
    }
  | {
      kind: "floorImages";
      floorId: DataReference;
    }
  | {
      kind: "material";
      reference: DataReference;
      directory: string;
      selection: "single" | "multiple";
    };

export interface FieldSchema extends JsonShape {
  title: string;
  description?: string;
  diagnostics?: Record<string, string>;
  editor: EditorDescriptor;
  normalizer?: string;
}

export interface FieldSchemaBundle {
  kind: "field-bundle";
  formatVersion: 1;
  schemaId: string;
  revision: number;
  forkedFrom?: SchemaFork;
  fields: Record<string, FieldSchema>;
}

export interface SchemaFork {
  revision: number;
  digest: string;
}

export interface FieldNode {
  kind: "field";
  id: string;
  fieldSchema: string;
  source?: DataReference;
  sources?: Record<string, DataReference>;
  condition?: Condition;
}

export interface GroupNode {
  kind: "group";
  id: string;
  label: string;
  bind?: Record<string, DataReference>;
  condition?: Condition;
  children: UINode[];
}

export interface RestNode {
  kind: "rest";
  id: string;
  label: string;
  path: DataReference;
  hide?: string[];
  condition?: Condition;
}

export type UINode = FieldNode | GroupNode | RestNode;

export interface UISchema {
  kind: "table-schema";
  formatVersion: 1;
  schemaId: string;
  revision: number;
  forkedFrom?: SchemaFork;
  nodes: UINode[];
}

export type RawSlot<T> =
  | { present: true; value: T }
  | { present: false };

export type BlockResolution<T> =
  | { status: "loading" }
  | { status: "error"; error: Error }
  | { status: "type-mismatch"; rawValue: unknown; error: Error }
  | { status: "ready"; value: T };

export interface Diagnostic {
  source: string;
  path?: string;
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
}

export interface ValueSource<T> {
  readonly id: string;
  snapshot(): BlockResolution<RawSlot<T>>;
  subscribe(listener: () => void): () => void;
  reload?(): Promise<void>;
}

export interface WritableValueSource<T> extends ValueSource<T> {
  set(value: T): Promise<void>;
  unset(): Promise<void>;
}

export interface ReferenceRoot {
  resolve(path: readonly string[]): ValueSource<unknown>;
  writeMany?(updates: readonly ReferenceUpdate[]): Promise<void>;
}

export interface ReferenceUpdate {
  path: readonly string[];
  slot: RawSlot<unknown>;
}

export type ExpressionCall = (...args: unknown[]) => unknown;

export interface SchemaScope {
  roots: Record<string, ReferenceRoot>;
  calls?: Record<string, ExpressionCall>;
}

export interface Normalizer<Raw, Edit> {
  toEdit(raw: RawSlot<Raw>): Edit;
  toRaw(edit: Edit, previous: RawSlot<Raw>): RawSlot<Raw>;
}

export type NormalizerRegistry = Record<string, Normalizer<unknown, unknown>>;
