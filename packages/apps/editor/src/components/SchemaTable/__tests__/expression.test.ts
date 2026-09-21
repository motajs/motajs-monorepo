import { describe, expect, it } from 'vitest';
import { evaluateExpression } from '../expression';
import { ObjectReferenceRoot } from '../reference';
import type { Expression, SchemaScope } from '../types';

const scope: SchemaScope = {
  roots: { floor: new ObjectReferenceRoot('floor', () => ({ value: 3, list: [1, 3], text: 'abc', empty: [] })) },
  calls: { sum: (...args) => args.reduce<number>((total, value) => total + Number(value), 0) },
};

function result(expression: Expression): unknown {
  const evaluated = evaluateExpression(expression, scope);
  if (evaluated.status !== 'ready') throw evaluated.status === 'loading' ? new Error('loading') : evaluated.error;
  return evaluated.value;
}

const literal = (value: unknown): Expression => ({ literal: value });

describe('SchemaTable expressions', () => {
  it.each<[string, Expression, unknown]>([
    ['eq', { operator: 'eq', args: [literal({ a: 1 }), literal({ a: 1 })] }, true],
    ['ne', { operator: 'ne', args: [literal(1), literal(2)] }, true],
    ['gt', { operator: 'gt', args: [literal(2), literal(1)] }, true],
    ['gte', { operator: 'gte', args: [literal(2), literal(2)] }, true],
    ['lt', { operator: 'lt', args: [literal(1), literal(2)] }, true],
    ['lte', { operator: 'lte', args: [literal(2), literal(2)] }, true],
    ['and', { operator: 'and', args: [literal(true), literal(true)] }, true],
    ['or', { operator: 'or', args: [literal(false), literal(true)] }, true],
    ['not', { operator: 'not', args: [literal(false)] }, true],
    ['in', { operator: 'in', args: [literal(3), { ref: 'floor:list' }] }, true],
    ['includes', { operator: 'includes', args: [{ ref: 'floor:text' }, literal('b')] }, true],
    ['exists', { operator: 'exists', args: [{ ref: 'floor:value' }] }, true],
    ['empty', { operator: 'empty', args: [{ ref: 'floor:empty' }] }, true],
  ])('evaluates %s with its fixed signature', (_name, expression, expected) => {
    expect(result(expression)).toEqual(expected);
  });

  it('evaluates named calls', () => {
    expect(result({ call: 'sum', args: [literal(2), literal(4)] })).toBe(6);
  });

  it('returns a type-mismatch diagnostic instead of coercing values', () => {
    const evaluated = evaluateExpression({ operator: 'gt', args: [literal('2'), literal(1)] }, scope);
    expect(evaluated.status).toBe('type-mismatch');
    if (evaluated.status === 'type-mismatch') expect(evaluated.error.message).toContain('finite numbers');
  });
});
