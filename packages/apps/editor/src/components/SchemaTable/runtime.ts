import { isEqual } from "es-toolkit";
import { parseReference } from "./reference";
import type { DataReference, FieldSchema, JsonSchemaType, JsonShape, RawSlot, UISchema, UINode } from "./types";

function matchesSingleType(type: JsonSchemaType, value: unknown): boolean {
  switch (type) {
    case "null": return value === null;
    case "boolean": return typeof value === "boolean";
    case "number": return typeof value === "number" && Number.isFinite(value);
    case "integer": return typeof value === "number" && Number.isInteger(value);
    case "string": return typeof value === "string";
    case "array": return Array.isArray(value);
    case "object": return !!value && typeof value === "object" && !Array.isArray(value);
  }
}

export interface FieldShapeIssue {
  path: Array<string | number>;
  message: string;
  value: unknown;
}

function validateShape(shape: JsonShape, value: unknown, path: Array<string | number>, issues: FieldShapeIssue[]): void {
  const types = shape.type == null ? [] : Array.isArray(shape.type) ? shape.type : [shape.type];
  if (types.length > 0 && !types.some((type) => matchesSingleType(type, value))) {
    issues.push({ path, value, message: `Expected ${types.join(" | ")}` });
    return;
  }
  if (shape.enum != null && !shape.enum.some((item) => isEqual(item, value))) {
    issues.push({ path, value, message: `Expected enum ${JSON.stringify(shape.enum)}` });
    return;
  }
  if (value == null) return;
  if (shape.properties && matchesSingleType("object", value)) {
    const record = value as Record<string, unknown>;
    for (const key of shape.required ?? []) {
      if (!Object.prototype.hasOwnProperty.call(record, key)) {
        issues.push({ path: [...path, key], value: undefined, message: "Required property is missing" });
      }
    }
    for (const [key, child] of Object.entries(shape.properties)) {
      if (Object.prototype.hasOwnProperty.call(record, key)) validateShape(child, record[key], [...path, key], issues);
    }
  }
  if (shape.items && Array.isArray(value)) {
    value.forEach((item, index) => validateShape(shape.items as JsonShape, item, [...path, index], issues));
  }
}

export function fieldShapeIssues(schema: FieldSchema, slot: RawSlot<unknown>): FieldShapeIssue[] {
  if (!slot.present) return [];
  const issues: FieldShapeIssue[] = [];
  validateShape(schema, slot.value, [], issues);
  if (issues.length > 0) return issues;
  if ((schema.editor.kind === "stringList" || schema.editor.kind === "orderedStringList") && Array.isArray(slot.value)) {
    slot.value.forEach((item, index) => {
      if (typeof item !== "string") issues.push({ path: [index], value: item, message: "Expected string" });
    });
  }
  if (schema.editor.kind === "equipmentSlots" && Array.isArray(slot.value)) {
    slot.value.forEach((item, index) => {
      if (item != null && typeof item !== "string") issues.push({ path: [index], value: item, message: "Expected string | null" });
    });
  }
  if (schema.editor.kind === "itemCountRecord" && slot.value && typeof slot.value === "object" && !Array.isArray(slot.value)) {
    for (const [key, count] of Object.entries(slot.value as Record<string, unknown>)) {
      if (typeof count !== "number" || !Number.isFinite(count)) issues.push({ path: [key], value: count, message: "Expected finite number" });
    }
  }
  return issues;
}

export function fieldValueMatches(schema: FieldSchema, slot: RawSlot<unknown>): boolean {
  return fieldShapeIssues(schema, slot).length === 0;
}

export function fieldExpectedDescription(schema: FieldSchema): string {
  const types = schema.type == null ? "any JSON value" : Array.isArray(schema.type) ? schema.type.join(" | ") : schema.type;
  return schema.enum == null ? types : `${types}; enum ${JSON.stringify(schema.enum)}`;
}

export interface ReferencedPath {
  root: string;
  path: string[];
}

export type ReferenceBindings = ReadonlyMap<string, ReferencedPath>;

export function resolveBoundReference(reference: DataReference, bindings: ReferenceBindings = new Map()): ReferencedPath {
  const parsed = parseReference(reference);
  const base = bindings.get(parsed.root);
  return base ? { root: base.root, path: [...base.path, ...parsed.path] } : parsed;
}

export function extendReferenceBindings(
  parent: ReferenceBindings,
  bind: Readonly<Record<string, DataReference>> | undefined,
): ReferenceBindings {
  if (!bind || Object.keys(bind).length === 0) return parent;
  const next = new Map(parent);
  for (const [name, reference] of Object.entries(bind)) next.set(name, resolveBoundReference(reference, parent));
  return next;
}

export function formatReferencedPath(reference: ReferencedPath): string {
  return `${reference.root}:${reference.path.join(".")}`;
}

export function collectReferencedPaths(schema: UISchema): ReferencedPath[] {
  const result: ReferencedPath[] = [];
  const visit = (nodes: UINode[], bindings: ReferenceBindings): void => nodes.forEach((node) => {
    if (node.kind === "field") {
      if (node.source) result.push(resolveBoundReference(node.source, bindings));
      if (node.sources) result.push(...Object.values(node.sources).map((reference) => resolveBoundReference(reference, bindings)));
    }
    if (node.kind === "group") visit(node.children, extendReferenceBindings(bindings, node.bind));
  });
  visit(schema.nodes, new Map());
  return result;
}

function startsWithPath(path: readonly string[], prefix: readonly string[]): boolean {
  return prefix.length <= path.length && prefix.every((item, index) => path[index] === item);
}

function plainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export interface RestEntry {
  path: string[];
  value: unknown;
  children?: RestEntry[];
}

export function collectRestEntries(
  value: Record<string, unknown>,
  restRoot: ReferencedPath,
  references: ReferencedPath[],
  hide: readonly string[],
): RestEntry[] {
  const consumed = references
    .filter((item) => item.root === restRoot.root && startsWithPath(item.path, restRoot.path))
    .map((item) => item.path.slice(restRoot.path.length));
  const hidden = hide.map((item) => item.split(".").filter(Boolean));

  const visit = (object: Record<string, unknown>, prefix: string[]): RestEntry[] => Object.entries(object).flatMap(([key, child]) => {
    const path = [...prefix, key];
    if (hidden.some((item) => startsWithPath(path, item))) return [];
    if (consumed.some((item) => item.length === path.length && startsWithPath(path, item))) return [];
    if (plainObject(child)) {
      const descendants = visit(child, path);
      const hasConsumedDescendant = consumed.some((item) => item.length > path.length && startsWithPath(item, path));
      if (descendants.length > 0) return [{ path, value: child, children: descendants }];
      if (hasConsumedDescendant) return [];
      return [{ path, value: child }];
    }
    return [{ path, value: child }];
  });

  return visit(value, []);
}

export function appendReference(baseRef: string, relativePath: readonly string[]): string {
  if (relativePath.length === 0) return baseRef;
  const separator = baseRef.indexOf(":");
  const root = baseRef.slice(0, separator + 1);
  const suffix = baseRef.slice(separator + 1);
  const basePath = suffix ? suffix.split(".") : [];
  const path = [...basePath, ...relativePath];
  if (path.some((segment) => /[./:[\]]/.test(segment))) {
    throw new Error("Cannot serialize a path segment as a dotted v1 reference");
  }
  return `${root}${path.join(".")}`;
}
