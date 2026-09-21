import { isEqual } from 'es-toolkit';
import { resolveReference } from './reference';
import type { BlockResolution, Expression, RawSlot, SchemaScope } from './types';

function mismatch(operator: string, expected: string, actual: unknown, path: string): BlockResolution<never> {
  return {
    status: 'type-mismatch',
    rawValue: actual,
    error: new Error(`${path}: ${operator} expected ${expected}, received ${describe(actual)}`),
  };
}

function describe(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function ready(value: unknown): BlockResolution<unknown> {
  return { status: 'ready', value };
}

function unwrap(slot: RawSlot<unknown>): unknown {
  return slot.present ? slot.value : undefined;
}

function evaluateArgs(args: Expression[], scope: SchemaScope, path: string): BlockResolution<unknown[]> {
  const values: unknown[] = [];
  for (const [index, arg] of args.entries()) {
    const result = evaluateExpression(arg, scope, `${path}.args[${index}]`);
    if (result.status !== 'ready') return result;
    values.push(result.value);
  }
  return { status: 'ready', value: values };
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function plainEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string' || Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

export function evaluateExpression(
  expression: Expression,
  scope: SchemaScope,
  path = '$expression',
): BlockResolution<unknown> {
  if ('literal' in expression) return ready(expression.literal);
  if ('ref' in expression) {
    const snapshot = resolveReference(scope, expression).snapshot();
    return snapshot.status === 'ready' ? ready(unwrap(snapshot.value)) : snapshot;
  }
  if ('call' in expression) {
    const callable = scope.calls?.[expression.call];
    if (!callable) return { status: 'error', error: new Error(`${path}: unknown call ${expression.call}`) };
    const args = evaluateArgs(expression.args ?? [], scope, path);
    if (args.status !== 'ready') return args;
    try {
      return ready(callable(...args.value));
    } catch (error) {
      return { status: 'error', error: error instanceof Error ? error : new Error(String(error)) };
    }
  }

  const { operator, args } = expression;
  if (operator === 'exists') {
    if (args.length !== 1 || !('ref' in (args[0] ?? {}))) return mismatch(operator, 'one ref', args, path);
    const result = resolveReference(scope, args[0] as { ref: string }).snapshot();
    if (result.status !== 'ready') return result;
    return ready(result.value.present);
  }

  if ((operator === 'and' || operator === 'or') && args.length > 0) {
    for (const [index, arg] of args.entries()) {
      const result = evaluateExpression(arg, scope, `${path}.args[${index}]`);
      if (result.status !== 'ready') return result;
      if (typeof result.value !== 'boolean') return mismatch(operator, 'boolean arguments', result.value, path);
      if (operator === 'and' && !result.value) return ready(false);
      if (operator === 'or' && result.value) return ready(true);
    }
    return ready(operator === 'and');
  }

  const evaluated = evaluateArgs(args, scope, path);
  if (evaluated.status !== 'ready') return evaluated;
  const values = evaluated.value;
  switch (operator) {
    case 'eq':
    case 'ne':
      if (values.length !== 2) return mismatch(operator, 'two arguments', values, path);
      return ready(operator === 'eq' ? isEqual(values[0], values[1]) : !isEqual(values[0], values[1]));
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      if (values.length !== 2 || !finiteNumber(values[0]) || !finiteNumber(values[1])) {
        return mismatch(operator, 'two finite numbers', values, path);
      }
      if (operator === 'gt') return ready(values[0] > values[1]);
      if (operator === 'gte') return ready(values[0] >= values[1]);
      if (operator === 'lt') return ready(values[0] < values[1]);
      return ready(values[0] <= values[1]);
    }
    case 'and':
    case 'or':
      return mismatch(operator, 'one or more boolean arguments', values, path);
    case 'not':
      if (values.length !== 1 || typeof values[0] !== 'boolean') return mismatch(operator, 'one boolean', values, path);
      return ready(!values[0]);
    case 'in':
      if (values.length !== 2 || !Array.isArray(values[1]))
        return mismatch(operator, 'a value and an array', values, path);
      return ready(values[1].some((item) => isEqual(item, values[0])));
    case 'includes':
      if (values.length !== 2) return mismatch(operator, 'a container and a value', values, path);
      if (Array.isArray(values[0])) return ready(values[0].some((item) => isEqual(item, values[1])));
      if (typeof values[0] === 'string' && typeof values[1] === 'string') return ready(values[0].includes(values[1]));
      return mismatch(operator, 'an array/value or string/string pair', values, path);
    case 'empty':
      if (values.length !== 1) return mismatch(operator, 'one argument', values, path);
      return ready(plainEmpty(values[0]));
    default:
      return { status: 'error', error: new Error(`${path}: unsupported operator ${String(operator)}`) };
  }
}
