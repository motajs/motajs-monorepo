import { describe, expect, it } from 'vitest';
import { collectReferencedPaths, collectRestEntries, fieldValueMatches } from '../runtime';
import type { FieldSchema, UISchema } from '../types';

describe('SchemaTable Rest', () => {
  it('recursively collects unconsumed paths, hides literal subtrees, and treats arrays atomically', () => {
    const schema: UISchema = {
      kind: 'table-schema',
      formatVersion: 1,
      schemaId: 'test',
      revision: 1,
      nodes: [
        {
          kind: 'group',
          id: 'group',
          label: 'Group',
          children: [
            { kind: 'field', id: 'known', fieldSchema: 'known', source: { ref: 'floor:known' } },
            {
              kind: 'field',
              id: 'used',
              fieldSchema: 'used',
              sources: {
                used: { ref: 'floor:nested.used' },
                second: { ref: 'floor:nested.second' },
              },
            },
          ],
        },
      ],
    };
    const entries = collectRestEntries(
      {
        known: 1,
        nested: { used: 2, second: 5, extra: 3, hidden: { value: 4 } },
        list: [{ nested: true }],
        map: { shouldNotLeak: true },
      },
      { root: 'floor', path: [] },
      collectReferencedPaths(schema),
      ['map', 'nested.hidden'],
    );
    expect(entries).toEqual([
      {
        path: ['nested'],
        value: { used: 2, second: 5, extra: 3, hidden: { value: 4 } },
        children: [{ path: ['nested', 'extra'], value: 3 }],
      },
      { path: ['list'], value: [{ nested: true }] },
    ]);
  });

  it('resolves shallow Group bindings while collecting consumed paths', () => {
    const schema: UISchema = {
      kind: 'table-schema',
      formatVersion: 1,
      schemaId: 'bind',
      revision: 1,
      nodes: [
        {
          kind: 'group',
          id: 'bound',
          label: 'Bound',
          bind: { current: { ref: 'floor:nested' } },
          children: [{ kind: 'field', id: 'used', fieldSchema: 'known', source: { ref: 'current:used' } }],
        },
      ],
    };
    expect(collectReferencedPaths(schema)).toEqual([{ root: 'floor', path: ['nested', 'used'] }]);
  });
});

describe('SchemaTable field shapes', () => {
  it.each([
    [{ kind: 'orderedStringList' }, ['武器', null]],
    [{ kind: 'equipmentSlots', slots: { ref: 'tower:slots' }, items: { ref: 'project:items' } }, ['sword', 1]],
    [{ kind: 'itemCountRecord', items: { ref: 'project:items' }, category: 'tools' }, { yellowKey: '1' }],
  ] as const)('rejects invalid nested values for %o', (editor, value) => {
    const schema = { title: 'Test', type: Array.isArray(value) ? 'array' : 'object', editor } as FieldSchema;
    expect(fieldValueMatches(schema, { present: true, value })).toBe(false);
  });
});
