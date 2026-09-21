import {
  assertIdentifier,
  File2xSyntaxError,
  parseProgram,
  readVariableAssignment,
  significantStatements,
  type AstNode,
} from './syntax';
import type { GameScript2x, ScriptData, ScriptDataObject } from './types';

function propertyName(property: AstNode): string {
  if (property.computed === true) throw new File2xSyntaxError('Computed script keys are not supported');
  const key = property.key as AstNode | undefined;
  if (key?.type === 'Identifier' && typeof key.name === 'string') return key.name;
  if (key?.type === 'Literal' && (typeof key.value === 'string' || typeof key.value === 'number')) {
    return String(key.value);
  }
  throw new File2xSyntaxError('Unsupported script property name');
}

function nameAnonymousFunction(source: string, key: string): string {
  return source.replace(
    /^(\s*(?:async\s+)?function(?:\s*\*)?)(\s*)(?=\()/,
    (_match, prefix: string, spacing: string) => `${prefix.trimEnd()} ${key}${spacing}`,
  );
}

interface SourceRange {
  start: number;
  end: number;
}

function isAstNode(value: unknown): value is AstNode {
  return (
    value != null &&
    typeof value === 'object' &&
    typeof (value as AstNode).type === 'string' &&
    typeof (value as AstNode).start === 'number' &&
    typeof (value as AstNode).end === 'number'
  );
}

/** Multiline string whitespace is runtime data, not source formatting. */
function multilineStringRanges(source: string, root: AstNode, offset = 0): SourceRange[] {
  const ranges: SourceRange[] = [];
  const visit = (node: AstNode): void => {
    if (
      (node.type === 'TemplateElement' || (node.type === 'Literal' && typeof node.value === 'string')) &&
      source.slice(node.start, node.end).includes('\n')
    ) {
      ranges.push({ start: node.start - offset, end: node.end - offset });
    }

    for (const value of Object.values(node)) {
      if (isAstNode(value)) visit(value);
      else if (Array.isArray(value)) {
        for (const item of value) if (isAstNode(item)) visit(item);
      }
    }
  };
  visit(root);
  return ranges;
}

function isProtectedLineStart(offset: number, ranges: SourceRange[]): boolean {
  return ranges.some((range) => range.start <= offset && offset < range.end);
}

function commonWhitespacePrefix(left: string, right: string): string {
  let length = 0;
  while (length < left.length && length < right.length && left[length] === right[length]) length += 1;
  return left.slice(0, length);
}

function transformContinuationLines(
  source: string,
  protectedRanges: SourceRange[],
  transform: (line: string) => string,
): string {
  const lines = source.split('\n');
  let offset = lines[0]?.length ?? 0;
  for (let index = 1; index < lines.length; index += 1) {
    offset += 1;
    const line = lines[index];
    if (!isProtectedLineStart(offset, protectedRanges)) lines[index] = transform(line);
    offset += line.length;
  }
  return lines.join('\n');
}

function normalizeFunctionIndent(source: string, node: AstNode): string {
  const protectedRanges = multilineStringRanges(source, node, node.start);
  const functionSource = source.slice(node.start, node.end);
  const lines = functionSource.split('\n');
  let commonPrefix: string | undefined;
  let offset = lines[0]?.length ?? 0;

  for (let index = 1; index < lines.length; index += 1) {
    offset += 1;
    const line = lines[index];
    if (!isProtectedLineStart(offset, protectedRanges) && line.trim().length > 0) {
      const prefix = line.match(/^[\t ]*/)?.[0] ?? '';
      commonPrefix = commonPrefix === undefined ? prefix : commonWhitespacePrefix(commonPrefix, prefix);
    }
    offset += line.length;
  }

  return transformContinuationLines(functionSource, protectedRanges, (line) => {
    if (line.trim().length === 0) return '';
    return commonPrefix && line.startsWith(commonPrefix) ? line.slice(commonPrefix.length) : line;
  });
}

function decodeScriptValue(source: string, node: AstNode, key: string): ScriptData {
  if (node.type === 'ObjectExpression') return decodeScriptObject(source, node);
  if (node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
    return nameAnonymousFunction(normalizeFunctionIndent(source, node), key);
  }
  throw new File2xSyntaxError(`Unsupported script value for ${key}: ${node.type}`);
}

function decodeScriptObject(source: string, node: AstNode): ScriptDataObject {
  const properties = node.properties;
  if (!Array.isArray(properties)) throw new File2xSyntaxError('Invalid script object');
  return Object.fromEntries(
    properties.map((rawProperty) => {
      const property = rawProperty as AstNode;
      if (
        property.type !== 'Property' ||
        property.kind !== 'init' ||
        property.method === true ||
        property.shorthand === true
      ) {
        throw new File2xSyntaxError(`Unsupported script property: ${property.type}`);
      }
      const key = propertyName(property);
      const value = property.value as AstNode | undefined;
      if (!value) throw new File2xSyntaxError(`Missing script value for ${key}`);
      return [key, decodeScriptValue(source, value, key)];
    }),
  );
}

function parseFunctionExpression(source: string, key: string): { node: AstNode; wrapper: string } {
  const wrapper = `(${source})`;
  const program = parseProgram(wrapper);
  const statements = significantStatements(program);
  const expression = statements[0]?.expression as AstNode | undefined;
  if (
    statements.length !== 1 ||
    expression == null ||
    (expression.type !== 'FunctionExpression' && expression.type !== 'ArrowFunctionExpression')
  ) {
    throw new File2xSyntaxError(`Script leaf ${key} must be a function expression`);
  }
  return { node: expression, wrapper };
}

function anonymousFunction(source: string, key: string): string {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const anonymous = source.replace(
    new RegExp(`^(\\s*(?:async\\s+)?function\\s*\\*?)\\s+${escapedKey}(?=\\s*\\()`),
    '$1',
  );
  return anonymous;
}

function indentFunction(source: string, indent: string, key: string): string {
  const { node, wrapper } = parseFunctionExpression(source, key);
  const protectedRanges = multilineStringRanges(wrapper, node, 1);
  return transformContinuationLines(source, protectedRanges, (line) =>
    line.trim().length === 0 ? line : `${indent}${line}`,
  );
}

function encodeScriptObject(data: ScriptDataObject, indent: string): string {
  const nextIndent = `${indent}\t`;
  const lines = Object.entries(data).map(([key, value]) => {
    const expression =
      typeof value === 'string'
        ? indentFunction(anonymousFunction(value, key), nextIndent, key)
        : encodeScriptObject(value, nextIndent);
    return `${nextIndent}${JSON.stringify(key)}: ${expression}`;
  });
  return ['{', lines.join(',\n'), `${indent}}`].join('\n');
}

export function encodeGameScript2x(value: GameScript2x): string {
  assertIdentifier(value.uuid, 'variable name');
  return `var ${value.uuid} =\n${encodeScriptObject(value.data, '')}`;
}

export function decodeGameScript2x(source: string): GameScript2x {
  const { uuid, value } = readVariableAssignment(source);
  if (value.type !== 'ObjectExpression') throw new File2xSyntaxError('Script root must be an object');
  return { uuid, data: decodeScriptObject(source, value) };
}
