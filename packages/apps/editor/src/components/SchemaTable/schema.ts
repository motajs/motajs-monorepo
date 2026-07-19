import type {
  ChoiceOption,
  CombineInputDescriptor,
  Condition,
  DataReference,
  EditorDescriptor,
  Expression,
  FieldSchema,
  FieldSchemaBundle,
  JsonSchemaType,
  JsonShape,
  SchemaFork,
  UISchema,
  UINode,
} from "./types";

const JSON_TYPES = new Set<JsonSchemaType>([
  "null", "boolean", "number", "integer", "string", "array", "object",
]);
const OPERATORS = new Set([
  "eq", "ne", "gt", "gte", "lt", "lte", "and", "or", "not", "in", "includes", "exists", "empty",
]);
const CONDITION_FALLBACKS = new Set(["hidden", "hidden-if-empty", "disabled", "inactive"]);
const REFERENCE_ROOT = /^[A-Za-z_$][A-Za-z0-9_$-]*$/;
const REFERENCE_SEGMENT = /^[^./:[\]]+$/;

function object(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
  return value as Record<string, unknown>;
}

function strictObject(value: unknown, name: string, keys: readonly string[]): Record<string, unknown> {
  const input = object(value, name);
  const allowed = new Set(keys);
  const unknown = Object.keys(input).filter((key) => !allowed.has(key));
  if (unknown.length > 0) throw new Error(`${name} has unknown propert${unknown.length === 1 ? "y" : "ies"}: ${unknown.join(", ")}`);
  return input;
}

function string(value: unknown, name: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${name} must be a non-empty string`);
  return value;
}

function positiveInteger(value: unknown, name: string): number {
  if (!Number.isInteger(value) || Number(value) <= 0) throw new Error(`${name} must be a positive integer`);
  return Number(value);
}

function optionalFiniteNumber(value: unknown, name: string): number | undefined {
  if (value == null) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${name} must be a finite number`);
  return value;
}

function fork(value: unknown, name: string): SchemaFork | undefined {
  if (value == null) return undefined;
  const input = strictObject(value, name, ["revision", "digest"]);
  const digest = string(input.digest, `${name}.digest`);
  if (!/^sha256:[a-f0-9]{64}$/.test(digest)) throw new Error(`${name}.digest must be a canonical sha256 digest`);
  return { revision: positiveInteger(input.revision, `${name}.revision`), digest };
}

function validateReferenceText(ref: string, name: string): void {
  const separator = ref.indexOf(":");
  if (separator <= 0 || ref.indexOf(":", separator + 1) !== -1) throw new Error(`${name} must use root:path syntax`);
  const root = ref.slice(0, separator);
  const suffix = ref.slice(separator + 1);
  if (!REFERENCE_ROOT.test(root)) throw new Error(`${name} has an invalid root`);
  if (suffix.includes("/") || suffix.includes("[") || suffix.includes("]")) {
    throw new Error(`${name} uses unsupported v1 reference syntax; use dotted root:path`);
  }
  if (suffix.length > 0 && suffix.split(".").some((segment) => !REFERENCE_SEGMENT.test(segment))) {
    throw new Error(`${name} has an invalid dotted path`);
  }
}

function reference(value: unknown, name: string): DataReference {
  const input = strictObject(value, name, ["ref"]);
  const ref = string(input.ref, `${name}.ref`);
  validateReferenceText(ref, `${name}.ref`);
  return { ref };
}

function jsonTypes(value: unknown, name: string): JsonShape["type"] {
  if (value == null) return undefined;
  const values = Array.isArray(value) ? value : [value];
  if (values.length === 0 || values.some((item) => typeof item !== "string" || !JSON_TYPES.has(item as JsonSchemaType))) {
    throw new Error(`${name} is invalid`);
  }
  if (new Set(values).size !== values.length) throw new Error(`${name} values must be unique`);
  return values.length === 1 ? values[0] as JsonSchemaType : values as JsonSchemaType[];
}

function shape(value: unknown, name: string): JsonShape {
  const input = strictObject(value, name, ["type", "enum", "properties", "required", "items"]);
  const type = jsonTypes(input.type, `${name}.type`);
  if (input.enum != null && !Array.isArray(input.enum)) throw new Error(`${name}.enum must be an array`);
  let properties: Record<string, JsonShape> | undefined;
  if (input.properties != null) {
    const values = object(input.properties, `${name}.properties`);
    properties = Object.fromEntries(Object.entries(values).map(([key, child]) => [
      string(key, `${name}.properties key`),
      shape(child, `${name}.properties.${key}`),
    ]));
  }
  let required: string[] | undefined;
  if (input.required != null) {
    if (!Array.isArray(input.required) || input.required.some((item) => typeof item !== "string" || item.length === 0)) {
      throw new Error(`${name}.required must be a non-empty string array`);
    }
    required = input.required as string[];
    if (new Set(required).size !== required.length) throw new Error(`${name}.required values must be unique`);
    if (!properties) throw new Error(`${name}.required requires properties`);
    const missing = required.find((key) => !Object.prototype.hasOwnProperty.call(properties, key));
    if (missing) throw new Error(`${name}.required references unknown property ${missing}`);
  }
  const items = input.items == null ? undefined : shape(input.items, `${name}.items`);
  const types = type == null ? [] : Array.isArray(type) ? type : [type];
  if (properties && !types.includes("object")) throw new Error(`${name}.properties requires object type`);
  if (items && !types.includes("array")) throw new Error(`${name}.items requires array type`);
  return {
    type,
    enum: input.enum as unknown[] | undefined,
    properties,
    required,
    items,
  };
}

function choiceOptions(value: unknown, name: string, allowBooleanAndNull: boolean): ChoiceOption[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${name} must be a non-empty array`);
  const options = value.map((item, index) => {
    const option = strictObject(item, `${name}[${index}]`, ["value", "label"]);
    const optionValue = option.value;
    const valid = typeof optionValue === "string" || typeof optionValue === "number"
      || (allowBooleanAndNull && (typeof optionValue === "boolean" || optionValue === null));
    if (!valid || (typeof optionValue === "number" && !Number.isFinite(optionValue))) {
      throw new Error(`${name}[${index}].value is invalid`);
    }
    return { value: optionValue as ChoiceOption["value"], label: typeof option.label === "string" ? option.label : undefined };
  });
  if (new Set(options.map((option) => JSON.stringify(option.value))).size !== options.length) {
    throw new Error(`${name} values must be unique`);
  }
  return options;
}

function combineInput(value: unknown, name: string): CombineInputDescriptor {
  const input = strictObject(value, name, ["key", "label", "editor"]);
  const key = string(input.key, `${name}.key`);
  const label = typeof input.label === "string" ? input.label : undefined;
  const child = object(input.editor, `${name}.editor`);
  const kind = string(child.kind, `${name}.editor.kind`);
  if (kind === "suggestion") {
    const strict = strictObject(child, `${name}.editor`, ["kind", "suggestions"]);
    if (!Array.isArray(strict.suggestions)) throw new Error(`${name}.editor.suggestions must be an array`);
    const suggestions = strict.suggestions.map((item, index) => {
      const option = strictObject(item, `${name}.editor.suggestions[${index}]`, ["value", "label"]);
      return { value: string(option.value, `${name}.editor.suggestions[${index}].value`), label: typeof option.label === "string" ? option.label : undefined };
    });
    return { key, label, editor: { kind, suggestions } };
  }
  if (kind === "number") {
    const strict = strictObject(child, `${name}.editor`, ["kind", "min", "max", "step", "integer"]);
    if (strict.integer != null && typeof strict.integer !== "boolean") throw new Error(`${name}.editor.integer must be boolean`);
    const min = optionalFiniteNumber(strict.min, `${name}.editor.min`);
    const max = optionalFiniteNumber(strict.max, `${name}.editor.max`);
    const step = optionalFiniteNumber(strict.step, `${name}.editor.step`);
    if (min != null && max != null && min > max) throw new Error(`${name}.editor.min must not exceed max`);
    if (step != null && step <= 0) throw new Error(`${name}.editor.step must be positive`);
    return { key, label, editor: { kind, min, max, step, integer: strict.integer === true } };
  }
  throw new Error(`Unsupported combine input editor kind: ${kind}`);
}

function expression(value: unknown, name: string): Expression {
  const input = object(value, name);
  if (Object.prototype.hasOwnProperty.call(input, "literal")) {
    strictObject(input, name, ["literal"]);
    return { literal: input.literal };
  }
  if (Object.prototype.hasOwnProperty.call(input, "ref")) return reference(input, name);
  if (Object.prototype.hasOwnProperty.call(input, "operator")) {
    const strict = strictObject(input, name, ["operator", "args"]);
    const operator = string(strict.operator, `${name}.operator`);
    if (!OPERATORS.has(operator)) throw new Error(`${name}.operator is unsupported`);
    if (!Array.isArray(strict.args)) throw new Error(`${name}.args must be an array`);
    return { operator: operator as Extract<Expression, { operator: string }>["operator"], args: strict.args.map((item, index) => expression(item, `${name}.args[${index}]`)) };
  }
  if (Object.prototype.hasOwnProperty.call(input, "call")) {
    const strict = strictObject(input, name, ["call", "args"]);
    if (strict.args != null && !Array.isArray(strict.args)) throw new Error(`${name}.args must be an array`);
    return { call: string(strict.call, `${name}.call`), args: (strict.args as unknown[] | undefined)?.map((item, index) => expression(item, `${name}.args[${index}]`)) };
  }
  throw new Error(`${name} must be a literal, reference, operator, or call expression`);
}

function editor(value: unknown, name: string): EditorDescriptor {
  const input = object(value, name);
  const kind = string(input.kind, `${name}.kind`);
  const exact = (keys: string[]) => strictObject(input, name, ["kind", ...keys]);
  switch (kind) {
    case "readonly": case "text": case "number": case "checkbox": case "block": case "dimensions": case "json": case "color":
      exact([]);
      return { kind };
    case "stringList": {
      const current = exact(["placeholder"]);
      return { kind, placeholder: typeof current.placeholder === "string" ? current.placeholder : undefined };
    }
    case "orderedStringList": {
      const current = exact(["placeholder", "createLabel"]);
      return { kind, placeholder: typeof current.placeholder === "string" ? current.placeholder : undefined, createLabel: typeof current.createLabel === "string" ? current.createLabel : undefined };
    }
    case "initialPosition": {
      const current = exact(["floors", "directions"]);
      return { kind, floors: reference(current.floors, `${name}.floors`), directions: current.directions == null ? undefined : choiceOptions(current.directions, `${name}.directions`, false) };
    }
    case "equipmentSlots": {
      const current = exact(["slots", "items"]);
      return { kind, slots: reference(current.slots, `${name}.slots`), items: reference(current.items, `${name}.items`) };
    }
    case "itemCountRecord": {
      const current = exact(["items", "category"]);
      const category = string(current.category, `${name}.category`);
      if (!(["constants", "tools", "equips"] as string[]).includes(category)) throw new Error(`${name}.category is unsupported`);
      return { kind, items: reference(current.items, `${name}.items`), category: category as "constants" | "tools" | "equips" };
    }
    case "passability": {
      const current = exact(["block"]);
      return { kind, block: current.block == null ? undefined : reference(current.block, `${name}.block`) };
    }
    case "select": {
      const current = exact(["options", "reference"]);
      if ((current.options == null) === (current.reference == null)) throw new Error(`${name} must define exactly one of options or reference`);
      return { kind, options: current.options == null ? undefined : choiceOptions(current.options, `${name}.options`, true), reference: current.reference == null ? undefined : reference(current.reference, `${name}.reference`) };
    }
    case "checkboxSet": {
      const current = exact(["options", "reference"]);
      if ((current.options == null) === (current.reference == null)) throw new Error(`${name} must define exactly one of options or reference`);
      return current.options != null
        ? { kind, options: choiceOptions(current.options, `${name}.options`, false) as NonNullable<Extract<EditorDescriptor, { kind: "checkboxSet" }>["options"]> }
        : { kind, reference: reference(current.reference, `${name}.reference`) };
    }
    case "event": {
      const current = exact(["entryType", "floorId", "position"]);
      return { kind, entryType: string(current.entryType, `${name}.entryType`), floorId: current.floorId == null ? undefined : reference(current.floorId, `${name}.floorId`), position: current.position == null ? undefined : reference(current.position, `${name}.position`) };
    }
    case "autoEventList": {
      const current = exact(["floorId", "position"]);
      return { kind, floorId: current.floorId == null ? undefined : reference(current.floorId, `${name}.floorId`), position: current.position == null ? undefined : reference(current.position, `${name}.position`) };
    }
    case "code": {
      const current = exact(["lint", "template"]);
      if (current.lint != null && typeof current.lint !== "boolean") throw new Error(`${name}.lint must be boolean`);
      return { kind, lint: current.lint === true, template: typeof current.template === "string" ? current.template : undefined };
    }
    case "point": {
      const current = exact(["floorId"]);
      return { kind, floorId: current.floorId == null ? undefined : reference(current.floorId, `${name}.floorId`) };
    }
    case "combine": {
      const current = exact(["inputs"]);
      if (!Array.isArray(current.inputs) || current.inputs.length === 0) throw new Error(`${name}.inputs must be a non-empty array`);
      const inputs = current.inputs.map((item, index) => combineInput(item, `${name}.inputs[${index}]`));
      if (new Set(inputs.map((item) => item.key)).size !== inputs.length) throw new Error(`${name}.inputs keys must be unique`);
      return { kind, inputs };
    }
    case "bgmList": {
      const current = exact(["reference", "directory"]);
      return { kind, reference: reference(current.reference, `${name}.reference`), directory: string(current.directory, `${name}.directory`) };
    }
    case "floorImages": {
      const current = exact(["floorId"]);
      return { kind, floorId: reference(current.floorId, `${name}.floorId`) };
    }
    case "material": {
      const current = exact(["reference", "directory", "selection"]);
      if (current.selection !== "single" && current.selection !== "multiple") throw new Error(`${name}.selection must be single or multiple`);
      return { kind, reference: reference(current.reference, `${name}.reference`), directory: string(current.directory, `${name}.directory`), selection: current.selection };
    }
    default:
      throw new Error(`Unsupported editor kind: ${kind}`);
  }
}

function field(value: unknown, name: string): FieldSchema {
  const input = strictObject(value, name, ["type", "enum", "properties", "required", "items", "title", "description", "diagnostics", "editor", "normalizer"]);
  const staticShape = shape(Object.fromEntries(["type", "enum", "properties", "required", "items"]
    .filter((key) => Object.prototype.hasOwnProperty.call(input, key)).map((key) => [key, input[key]])), name);
  let diagnostics: Record<string, string> | undefined;
  if (input.diagnostics != null) {
    const values = object(input.diagnostics, `${name}.diagnostics`);
    diagnostics = Object.fromEntries(Object.entries(values).map(([code, description]) => [
      string(code, `${name}.diagnostics code`),
      string(description, `${name}.diagnostics.${code}`),
    ]));
  }
  return {
    ...staticShape,
    title: string(input.title, `${name}.title`),
    description: typeof input.description === "string" ? input.description : undefined,
    diagnostics,
    editor: editor(input.editor, `${name}.editor`),
    normalizer: input.normalizer == null ? undefined : string(input.normalizer, `${name}.normalizer`),
  };
}

function condition(value: unknown, name: string): Condition | undefined {
  if (value == null) return undefined;
  const input = strictObject(value, name, ["when", "otherwise"]);
  const otherwise = string(input.otherwise, `${name}.otherwise`);
  if (!CONDITION_FALLBACKS.has(otherwise)) throw new Error(`${name}.otherwise is invalid`);
  return { when: expression(input.when, `${name}.when`), otherwise: otherwise as Condition["otherwise"] };
}

function node(value: unknown, name: string): UINode {
  const input = object(value, name);
  const kind = string(input.kind, `${name}.kind`);
  if (kind === "field") {
    const current = strictObject(input, name, ["kind", "id", "fieldSchema", "source", "sources", "condition"]);
    const hasSource = current.source != null;
    const hasSources = current.sources != null;
    if (hasSource === hasSources) throw new Error(`${name} must define exactly one of source or sources`);
    let sources: Record<string, DataReference> | undefined;
    if (hasSources) {
      const sourceObject = object(current.sources, `${name}.sources`);
      const entries = Object.entries(sourceObject);
      if (entries.length === 0) throw new Error(`${name}.sources must not be empty`);
      sources = Object.fromEntries(entries.map(([key, item]) => [string(key, `${name}.sources key`), reference(item, `${name}.sources.${key}`)]));
    }
    return { kind, id: string(current.id, `${name}.id`), fieldSchema: string(current.fieldSchema, `${name}.fieldSchema`), source: hasSource ? reference(current.source, `${name}.source`) : undefined, sources, condition: condition(current.condition, `${name}.condition`) };
  }
  if (kind === "group") {
    const current = strictObject(input, name, ["kind", "id", "label", "bind", "condition", "children"]);
    if (!Array.isArray(current.children)) throw new Error(`${name}.children must be an array`);
    let bind: Record<string, DataReference> | undefined;
    if (current.bind != null) {
      const values = object(current.bind, `${name}.bind`);
      bind = Object.fromEntries(Object.entries(values).map(([key, item]) => [
        string(key, `${name}.bind key`), reference(item, `${name}.bind.${key}`),
      ]));
    }
    return { kind, id: string(current.id, `${name}.id`), label: string(current.label, `${name}.label`), bind, condition: condition(current.condition, `${name}.condition`), children: current.children.map((child, index) => node(child, `${name}.children[${index}]`)) };
  }
  if (kind === "rest") {
    const current = strictObject(input, name, ["kind", "id", "label", "path", "hide", "condition"]);
    if (current.hide != null && (!Array.isArray(current.hide) || current.hide.some((item) => (
      typeof item !== "string" || item.length === 0 || item.includes("/") || item.includes("*")
      || item.split(".").some((segment) => segment.length === 0)
    )))) throw new Error(`${name}.hide must contain literal dotted subtree paths`);
    return { kind, id: string(current.id, `${name}.id`), label: string(current.label, `${name}.label`), path: reference(current.path, `${name}.path`), hide: current.hide as string[] | undefined, condition: condition(current.condition, `${name}.condition`) };
  }
  throw new Error(`Unsupported UI node kind: ${kind}`);
}

export function parseFieldSchemaBundle(value: unknown): FieldSchemaBundle {
  const candidate = object(value, "FieldSchemaBundle");
  if (Array.isArray(candidate.fields)) {
    throw new Error("不支持的 Schema 格式：验证版 fields array 已被 Field v1 record 取代");
  }
  const input = strictObject(candidate, "FieldSchemaBundle", ["kind", "formatVersion", "schemaId", "revision", "forkedFrom", "fields"]);
  if (input.kind !== "field-bundle" || input.formatVersion !== 1) {
    throw new Error("不支持的 Schema 格式：Field Bundle 必须声明 kind=field-bundle 与 formatVersion=1");
  }
  const values = object(input.fields, "FieldSchemaBundle.fields");
  const fields = Object.fromEntries(Object.entries(values).map(([id, definition]) => [
    string(id, "FieldSchemaBundle.fields key"),
    field(definition, `fields.${id}`),
  ]));
  return {
    kind: "field-bundle",
    formatVersion: 1,
    schemaId: string(input.schemaId, "FieldSchemaBundle.schemaId"),
    revision: positiveInteger(input.revision, "FieldSchemaBundle.revision"),
    forkedFrom: fork(input.forkedFrom, "FieldSchemaBundle.forkedFrom"),
    fields,
  };
}

export function parseUISchema(
  value: unknown,
  fieldSchemas: ReadonlyMap<string, FieldSchema>,
  ambiguousFieldIds: ReadonlySet<string> = new Set(),
): UISchema {
  const input = strictObject(value, "UISchema", ["kind", "formatVersion", "schemaId", "revision", "forkedFrom", "nodes"]);
  if (input.kind !== "table-schema" || input.formatVersion !== 1) {
    throw new Error("不支持的 Schema 格式：Table Schema 必须声明 kind=table-schema 与 formatVersion=1");
  }
  if (!Array.isArray(input.nodes)) throw new Error("UISchema.nodes must be an array");
  const nodes = input.nodes.map((item, index) => node(item, `nodes[${index}]`));
  const ids = new Set<string>();
  const visit = (items: UINode[]): void => items.forEach((item) => {
    if (ids.has(item.id)) throw new Error(`Duplicate UI node ID: ${item.id}`);
    ids.add(item.id);
    if (item.kind === "field") {
      if (ambiguousFieldIds.has(item.fieldSchema)) throw new Error(`Ambiguous Field Schema ID: ${item.fieldSchema}`);
      if (!fieldSchemas.has(item.fieldSchema)) throw new Error(`Unknown Field Schema ID: ${item.fieldSchema}`);
    }
    if (item.kind === "group") visit(item.children);
  });
  visit(nodes);
  return {
    kind: "table-schema",
    formatVersion: 1,
    schemaId: string(input.schemaId, "UISchema.schemaId"),
    revision: positiveInteger(input.revision, "UISchema.revision"),
    forkedFrom: fork(input.forkedFrom, "UISchema.forkedFrom"),
    nodes,
  };
}

export function createFieldSchemaRegistry(bundle: FieldSchemaBundle): ReadonlyMap<string, FieldSchema> {
  return new Map(Object.entries(bundle.fields));
}

export interface GlobalFieldSchemaRegistry {
  schemas: ReadonlyMap<string, FieldSchema>;
  ambiguous: ReadonlySet<string>;
}

export function createGlobalFieldSchemaRegistry(bundles: readonly FieldSchemaBundle[]): GlobalFieldSchemaRegistry {
  const schemas = new Map<string, FieldSchema>();
  const ambiguous = new Set<string>();
  for (const bundle of bundles) {
    for (const [id, definition] of Object.entries(bundle.fields)) {
      if (schemas.has(id) || ambiguous.has(id)) {
        schemas.delete(id);
        ambiguous.add(id);
      } else {
        schemas.set(id, definition);
      }
    }
  }
  return { schemas, ambiguous };
}
