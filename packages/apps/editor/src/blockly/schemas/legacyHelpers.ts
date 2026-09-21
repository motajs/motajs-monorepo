import type * as Blockly from 'blockly';

import type { BlockBinding, BlockSchema } from '../registry';
import type { BlockState, EventObject } from '../parser/types';

export const statementDefinition = {
  previousStatement: null,
  nextStatement: null,
  inputsInline: true,
  helpUrl: '/_docs/#/instruction',
} as const;

export function field(input: string, path: string, options: Partial<BlockBinding> = {}): BlockBinding {
  return { input, path, kind: 'field', optional: true, ...options };
}

export function value(input: string, path: string, options: Partial<BlockBinding> = {}): BlockBinding {
  return { input, path, kind: 'value', optional: true, ...options };
}

export function declarativeSchema(
  eventType: string,
  category: string,
  definition: BlockSchema['definition'],
  bindings: BlockBinding[],
  extra: Partial<BlockSchema> = {},
): BlockSchema {
  return {
    eventType,
    definition: { ...statementDefinition, ...definition },
    category,
    event: { match: { path: 'type', equals: eventType }, template: { type: eventType }, bindings },
    ...extra,
  };
}

export function expression(value: unknown): string {
  return value == null ? '' : String(value);
}

export function expressionValue(value: string): string | number {
  const trimmed = value.trim();
  if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(trimmed)) return Number(trimmed);
  return value;
}

export function optionalExpression(event: Record<string, unknown>, key: string, value: string): void {
  if (value !== '') event[key] = expressionValue(value);
}

export function parseMultiLoc(loc: unknown): { x: string; y: string } {
  if (!Array.isArray(loc)) return { x: '', y: '' };
  const points = Array.isArray(loc[0]) ? (loc as unknown[][]) : [loc];
  return {
    x: points.map((point) => expression(point[0])).join(','),
    y: points.map((point) => expression(point[1])).join(','),
  };
}

function coordinate(value: string): string | number {
  return expressionValue(value.trim());
}

export function generateMultiLoc(x: string, y: string): unknown {
  if (!x.trim() && !y.trim()) return undefined;
  const xs = x.split(',');
  const ys = y.split(',');
  if (xs.length !== ys.length) throw new Error('x 和 y 的坐标数量必须一致');
  const points = xs.map((item, index) => [coordinate(item), coordinate(ys[index] ?? '')]);
  return points.length === 1 ? points[0] : points;
}

export function locationState(type: string, event: EventObject, fields: Record<string, unknown> = {}): BlockState {
  const loc = parseMultiLoc(event.loc);
  return { type, fields: { X: loc.x, Y: loc.y, ...fields } };
}

export function checkbox(block: Blockly.Block, name: string): boolean {
  return block.getFieldValue(name) === 'TRUE';
}

export function generated(event: Record<string, unknown>): string {
  return `${JSON.stringify(event)},\n`;
}
