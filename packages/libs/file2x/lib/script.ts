import {
  assertIdentifier,
  File2xSyntaxError,
  parseProgram,
  readVariableAssignment,
  significantStatements,
  type AstNode,
} from "./syntax";
import type { GameScript2x, ScriptData, ScriptDataObject } from "./types";

function propertyName(property: AstNode): string {
  if (property.computed === true) throw new File2xSyntaxError("Computed script keys are not supported");
  const key = property.key as AstNode | undefined;
  if (key?.type === "Identifier" && typeof key.name === "string") return key.name;
  if (key?.type === "Literal" && (typeof key.value === "string" || typeof key.value === "number")) {
    return String(key.value);
  }
  throw new File2xSyntaxError("Unsupported script property name");
}

function nameAnonymousFunction(source: string, key: string): string {
  return source.replace(
    /^(\s*(?:async\s+)?function(?:\s*\*)?)(\s*)(?=\()/,
    (_match, prefix: string, spacing: string) => `${prefix.trimEnd()} ${key}${spacing}`,
  );
}

function decodeScriptValue(source: string, node: AstNode, key: string): ScriptData {
  if (node.type === "ObjectExpression") return decodeScriptObject(source, node);
  if (node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression") {
    return nameAnonymousFunction(source.slice(node.start, node.end), key);
  }
  throw new File2xSyntaxError(`Unsupported script value for ${key}: ${node.type}`);
}

function decodeScriptObject(source: string, node: AstNode): ScriptDataObject {
  const properties = node.properties;
  if (!Array.isArray(properties)) throw new File2xSyntaxError("Invalid script object");
  return Object.fromEntries(properties.map((rawProperty) => {
    const property = rawProperty as AstNode;
    if (property.type !== "Property" || property.kind !== "init" || property.method === true || property.shorthand === true) {
      throw new File2xSyntaxError(`Unsupported script property: ${property.type}`);
    }
    const key = propertyName(property);
    const value = property.value as AstNode | undefined;
    if (!value) throw new File2xSyntaxError(`Missing script value for ${key}`);
    return [key, decodeScriptValue(source, value, key)];
  }));
}

function validateFunctionExpression(source: string, key: string): void {
  const program = parseProgram(`(${source})`);
  const statements = significantStatements(program);
  const expression = statements[0]?.expression as AstNode | undefined;
  if (statements.length !== 1 || expression == null || (
    expression.type !== "FunctionExpression" && expression.type !== "ArrowFunctionExpression"
  )) {
    throw new File2xSyntaxError(`Script leaf ${key} must be a function expression`);
  }
}

function anonymousFunction(source: string, key: string): string {
  validateFunctionExpression(source, key);
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return source.replace(
    new RegExp(`^(\\s*(?:async\\s+)?function\\s*\\*?)\\s+${escapedKey}(?=\\s*\\()`),
    "$1",
  );
}

function encodeScriptObject(data: ScriptDataObject, indent: string): string {
  const nextIndent = `${indent}\t`;
  const lines = Object.entries(data).map(([key, value]) => {
    const expression = typeof value === "string"
      ? anonymousFunction(value, key)
      : encodeScriptObject(value, nextIndent);
    return `${nextIndent}${JSON.stringify(key)}: ${expression}`;
  });
  return ["{", lines.join(",\n"), `${indent}}`].join("\n");
}

export function encodeGameScript2x(value: GameScript2x): string {
  assertIdentifier(value.uuid, "variable name");
  return `var ${value.uuid} =\n${encodeScriptObject(value.data, "")}`;
}

export function decodeGameScript2x(source: string): GameScript2x {
  const { uuid, value } = readVariableAssignment(source);
  if (value.type !== "ObjectExpression") throw new File2xSyntaxError("Script root must be an object");
  return { uuid, data: decodeScriptObject(source, value) };
}
