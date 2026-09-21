/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ObjectReferenceRoot } from '../reference';
import { SchemaTable as RuntimeSchemaTable, type SchemaTableProps } from '../SchemaTable';
import type { BlockResolution, FieldSchema, RawSlot, ReferenceRoot, UISchema, UINode, ValueSource } from '../types';

const modalMocks = vi.hoisted(() => ({ selectPoint: vi.fn() }));

vi.mock('@/Workbench/CodeEditor/CodeEditorContext', () => ({ useCodeEditor: () => ({ open: vi.fn() }) }));
vi.mock('@/Workbench/EventsEditor/EventEditorContext', () => ({ useEventEditor: () => ({ open: vi.fn() }) }));
vi.mock('@/Workbench/modals/SelectMaterial', () => ({ useSelectMaterialModalAction: () => vi.fn() }));
vi.mock('@/Workbench/modals/SelectPoint', () => ({ useSelectPointModalAction: () => modalMocks.selectPoint }));

afterEach(() => {
  cleanup();
  modalMocks.selectPoint.mockReset();
});

function field(id: string, title = id): FieldSchema {
  return { $id: id, type: 'string', title, editor: { kind: 'text' } };
}

let generatedNodeId = 0;
function normalizeNodes(nodes: UINode[]): UINode[] {
  return nodes.map((node) => {
    if (node.kind === 'group') return { ...node, children: normalizeNodes(node.children) };
    if (node.kind === 'field' && !node.id) return { ...node, id: `component-field-${generatedNodeId++}` };
    return node;
  });
}

function SchemaTable(props: SchemaTableProps) {
  const source = props.uiSchema as UISchema & { version?: number };
  const uiSchema = {
    ...source,
    kind: 'table-schema' as const,
    formatVersion: 1 as const,
    revision: source.revision ?? source.version ?? 1,
    nodes: normalizeNodes(source.nodes),
  };
  return <RuntimeSchemaTable {...props} uiSchema={uiSchema} />;
}

function source(id: string, resolution: BlockResolution<RawSlot<unknown>>): ValueSource<unknown> {
  return { id, snapshot: () => resolution, subscribe: () => () => undefined };
}

function byTestId(id: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(`[data-test-id="${id}"]`);
  if (!element) throw new Error(`Missing data-test-id ${id}`);
  return element;
}

describe('SchemaTable component', () => {
  it('keeps condition-hidden fields selectable in structure edit mode', () => {
    const onSelect = vi.fn();
    const schema = {
      schemaId: 'customization',
      version: 1,
      nodes: [
        {
          kind: 'field',
          id: 'hidden-field',
          fieldSchema: 'value',
          source: { ref: 'floor:value' },
          condition: { when: { literal: false }, otherwise: 'hidden' },
        },
      ],
    } as unknown as UISchema;
    render(
      <SchemaTable
        fieldSchemas={new Map([['value', field('value', 'Value')]])}
        uiSchema={schema}
        scope={{ roots: { floor: new ObjectReferenceRoot('floor', () => ({})) } }}
        customization={{ selectedNodeId: 'hidden-field', onSelect, onMove: vi.fn(), onDelete: vi.fn() }}
      />,
    );
    const row = byTestId('schema-hidden-field-hidden-field');
    expect(row.className).toContain('selected');
    fireEvent.click(row);
    expect(onSelect).toHaveBeenCalledWith('hidden-field');
  });

  it('keeps Group order and applies all four condition presentations', () => {
    const fields = new Map(['a', 'b', 'c', 'd', 'e'].map((id) => [id, field(id, id.toUpperCase())]));
    const data = { c: 'disabled', d: 'inactive', e: 'visible' };
    const schema: UISchema = {
      schemaId: 'conditions',
      version: 1,
      nodes: [
        {
          kind: 'group',
          id: 'group',
          label: 'Ordered group',
          children: [
            {
              kind: 'field',
              fieldSchema: 'a',
              source: { ref: 'floor:a' },
              condition: { when: { literal: false }, otherwise: 'hidden' },
            },
            {
              kind: 'field',
              fieldSchema: 'b',
              source: { ref: 'floor:b' },
              condition: { when: { literal: false }, otherwise: 'hidden-if-empty' },
            },
            {
              kind: 'field',
              fieldSchema: 'c',
              source: { ref: 'floor:c' },
              condition: { when: { literal: false }, otherwise: 'disabled' },
            },
            {
              kind: 'field',
              fieldSchema: 'd',
              source: { ref: 'floor:d' },
              condition: { when: { literal: false }, otherwise: 'inactive' },
            },
            {
              kind: 'field',
              fieldSchema: 'e',
              source: { ref: 'floor:e' },
              condition: { when: { literal: false }, otherwise: 'hidden-if-empty' },
            },
          ],
        },
      ],
    };
    render(
      <SchemaTable
        fieldSchemas={fields}
        uiSchema={schema}
        scope={{
          roots: {
            floor: new ObjectReferenceRoot(
              'floor',
              () => data,
              async () => undefined,
            ),
          },
        }}
      />,
    );
    expect(screen.queryByText('A')).toBeNull();
    expect(screen.queryByText('B')).toBeNull();
    const rows = byTestId('schema-group-group').querySelectorAll('tbody > tr');
    expect([...rows].map((row) => row.querySelector('strong')?.textContent)).toEqual(['C', 'D', 'E']);
    expect((within(byTestId('schema-field-c')).getByRole('textbox') as HTMLInputElement).disabled).toBe(true);
    expect(byTestId('schema-field-d').className).toContain('schemaTableInactive');
  });

  it('uses two columns, marks field help and renders structured copy as an icon button', () => {
    const fields = new Map<string, FieldSchema>([
      ['id', { $id: 'id', type: 'string', title: 'ID', editor: { kind: 'readonly' } }],
      ['name', field('name', 'Name')],
      [
        'point',
        {
          $id: 'point',
          type: ['array', 'null'],
          title: 'Point',
          normalizer: 'optionalPoint',
          editor: { kind: 'point', clearable: true },
        },
      ],
      [
        'payload',
        {
          $id: 'payload',
          type: 'object',
          title: 'Payload',
          description: 'Nested JSON payload',
          editor: { kind: 'json' },
        },
      ],
    ]);
    const data = { id: 'sample0', name: 'sample', point: null, payload: { nested: true } };
    const schema: UISchema = {
      schemaId: 'copy-actions',
      version: 1,
      nodes: [
        {
          kind: 'group',
          id: 'main',
          label: 'Main',
          children: [
            { kind: 'field', fieldSchema: 'id', source: { ref: 'floor:id' } },
            { kind: 'field', fieldSchema: 'name', source: { ref: 'floor:name' } },
            { kind: 'field', fieldSchema: 'point', source: { ref: 'floor:point' } },
            { kind: 'field', fieldSchema: 'payload', source: { ref: 'floor:payload' } },
          ],
        },
      ],
    };
    render(
      <SchemaTable
        fieldSchemas={fields}
        uiSchema={schema}
        scope={{
          roots: {
            floor: new ObjectReferenceRoot(
              'floor',
              () => data,
              async () => undefined,
            ),
          },
        }}
        fieldActions={new Map([['floor:id', <button>Rename</button>]])}
      />,
    );

    expect(screen.queryByText('字段与说明')).toBeNull();
    expect(within(byTestId('schema-input-id')).queryByRole('textbox')).toBeNull();
    expect(within(byTestId('schema-input-id')).getByText('sample0')).toBeTruthy();
    expect(within(byTestId('schema-field-id')).getByRole('button', { name: 'Rename' })).toBeTruthy();
    expect(byTestId('schema-field-id').querySelectorAll(':scope > td')).toHaveLength(2);
    expect(within(byTestId('schema-field-point')).getByText('未设定')).toBeTruthy();
    expect(within(byTestId('schema-field-point')).queryByRole('button', { name: '清空' })).toBeNull();
    expect(within(byTestId('schema-field-name')).getByText('Name').className).toContain('hasHelp');
    expect(screen.queryByRole('button', { name: '复制Name' })).toBeNull();
    const copy = screen.getByRole('button', { name: '复制Payload' });
    expect(copy.textContent).toBe('');
    expect(copy.querySelector('svg')).not.toBeNull();
    expect(within(byTestId('schema-field-payload')).queryByText('Nested JSON payload')).toBeNull();
    expect(screen.getByText('Payload').className).toContain('hasHelp');
  });

  it('edits enum choices and checkbox sets while keeping unknown selected values visible', async () => {
    const fields = new Map<string, FieldSchema>([
      [
        'trigger',
        {
          $id: 'trigger',
          type: ['string', 'null'],
          title: 'Trigger',
          normalizer: 'optionalJson',
          editor: {
            kind: 'select',
            options: [
              { value: null, label: 'Unset' },
              { value: 'openDoor', label: 'Open door' },
            ],
          },
        },
      ],
      [
        'directions',
        {
          $id: 'directions',
          type: 'array',
          title: 'Directions',
          normalizer: 'optionalStringList',
          editor: {
            kind: 'checkboxSet',
            options: [
              { value: 'up', label: 'Up' },
              { value: 'down', label: 'Down' },
            ],
          },
        },
      ],
    ]);
    const data = { trigger: null, directions: ['up', 'custom'] };
    const writes = vi.fn(async () => undefined);
    const schema: UISchema = {
      schemaId: 'choices',
      version: 1,
      nodes: [
        {
          kind: 'group',
          id: 'choices',
          label: 'Choices',
          children: [
            { kind: 'field', fieldSchema: 'trigger', source: { ref: 'prefab:trigger' } },
            { kind: 'field', fieldSchema: 'directions', source: { ref: 'prefab:directions' } },
          ],
        },
      ],
    };
    render(
      <SchemaTable
        fieldSchemas={fields}
        uiSchema={schema}
        scope={{ roots: { prefab: new ObjectReferenceRoot('prefab', () => data, writes) } }}
      />,
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: JSON.stringify('openDoor') } });
    await waitFor(() => expect(writes).toHaveBeenCalledWith(['trigger'], { present: true, value: 'openDoor' }));
    expect(screen.getByLabelText('未知：custom')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Down'));
    await waitFor(() =>
      expect(writes).toHaveBeenCalledWith(['directions'], { present: true, value: ['up', 'custom', 'down'] }),
    );
  });

  it('edits a combined passability field through one batched source update', async () => {
    const data: Record<string, unknown> = { cannotOut: ['up'] };
    const write = vi.fn(async () => undefined);
    const writeBatch = vi.fn(async () => undefined);
    const fields = new Map<string, FieldSchema>([
      [
        'passability',
        {
          $id: 'passability',
          type: 'object',
          title: 'Passability',
          normalizer: 'passability',
          editor: { kind: 'passability' },
        },
      ],
    ]);
    const schema: UISchema = {
      schemaId: 'passability',
      version: 1,
      nodes: [
        {
          kind: 'field',
          fieldSchema: 'passability',
          sources: {
            cannotOut: { ref: 'prefab:cannotOut' },
            cannotIn: { ref: 'prefab:cannotIn' },
          },
        },
      ],
    };
    render(
      <SchemaTable
        fieldSchemas={fields}
        uiSchema={schema}
        scope={{
          roots: {
            prefab: new ObjectReferenceRoot('prefab', () => data, write, writeBatch),
          },
        }}
      />,
    );
    expect(screen.getByRole('button', { name: '上边内侧（出）：禁止' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '上边外侧（入）：允许' }));
    await waitFor(() =>
      expect(writeBatch).toHaveBeenCalledWith([
        {
          path: ['cannotIn'],
          slot: { present: true, value: ['up'] },
        },
      ]),
    );
    expect(write).not.toHaveBeenCalled();
  });

  it('selects the initial floor and coordinates through the map point picker', async () => {
    const tower = {
      firstData: {
        floorId: 'sample0',
        hero: { loc: { x: 1, y: 2, direction: 'down' } },
      },
    };
    const write = vi.fn(async () => undefined);
    const writeBatch = vi.fn(async () => undefined);
    modalMocks.selectPoint.mockResolvedValue({ floorId: 'sample1', x: 3, y: 4 });
    const fields = new Map<string, FieldSchema>([
      [
        'position',
        {
          $id: 'position',
          type: 'object',
          title: 'Initial position',
          editor: { kind: 'initialPosition', floors: { ref: 'project:floorIds' } },
        },
      ],
    ]);
    const schema: UISchema = {
      schemaId: 'initial-position',
      version: 1,
      nodes: [
        {
          kind: 'field',
          fieldSchema: 'position',
          sources: {
            floorId: { ref: 'tower:firstData.floorId' },
            x: { ref: 'tower:firstData.hero.loc.x' },
            y: { ref: 'tower:firstData.hero.loc.y' },
            direction: { ref: 'tower:firstData.hero.loc.direction' },
          },
        },
      ],
    };
    render(
      <SchemaTable
        fieldSchemas={fields}
        uiSchema={schema}
        scope={{
          roots: {
            tower: new ObjectReferenceRoot('tower', () => tower, write, writeBatch),
            project: new ObjectReferenceRoot('project', () => ({ floorIds: ['sample0', 'sample1'] }), write),
          },
        }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /选点/ }));
    await waitFor(() =>
      expect(modalMocks.selectPoint).toHaveBeenCalledWith(
        expect.objectContaining({
          floorId: 'sample0',
          floorSelection: 'selectable',
          x: 1,
          y: 2,
          multiple: false,
        }),
      ),
    );
    await waitFor(() =>
      expect(writeBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          { path: ['firstData', 'floorId'], slot: { present: true, value: 'sample1' } },
          { path: ['firstData', 'hero', 'loc', 'x'], slot: { present: true, value: 3 } },
          { path: ['firstData', 'hero', 'loc', 'y'], slot: { present: true, value: 4 } },
        ]),
      ),
    );
  });

  it('shows loading, source errors and raw fallback block states', () => {
    const fields = new Map([
      ['loading', field('loading', 'Loading')],
      ['error', field('error', 'Error')],
      ['bad', field('bad', 'Bad')],
    ]);
    const roots: Record<string, ReferenceRoot> = {
      state: {
        resolve(path) {
          if (path[0] === 'loading') return source('loading', { status: 'loading' });
          if (path[0] === 'error') return source('error', { status: 'error', error: new Error('source failed') });
          return source('bad', { status: 'ready', value: { present: true, value: { invalid: true } } });
        },
      },
    };
    const schema: UISchema = {
      schemaId: 'states',
      version: 1,
      nodes: [
        {
          kind: 'group',
          id: 'states',
          label: 'States',
          children: [
            { kind: 'field', fieldSchema: 'loading', source: { ref: 'state:loading' } },
            { kind: 'field', fieldSchema: 'error', source: { ref: 'state:error' } },
            { kind: 'field', fieldSchema: 'bad', source: { ref: 'state:bad' } },
          ],
        },
      ],
    };
    render(<SchemaTable fieldSchemas={fields} uiSchema={schema} scope={{ roots }} />);
    expect(screen.getByLabelText('loading')).toBeTruthy();
    expect(screen.getByText('source failed')).toBeTruthy();
    expect(byTestId('schema-raw-fallback-Bad')).toBeTruthy();
  });

  it('synchronizes long JSON values without relying on a truncated remount key', () => {
    const fields = new Map<string, FieldSchema>([
      [
        'payload',
        {
          $id: 'payload',
          type: 'object',
          title: 'Payload',
          editor: { kind: 'json' },
        },
      ],
    ]);
    const schema: UISchema = {
      schemaId: 'long-json',
      version: 1,
      nodes: [{ kind: 'field', fieldSchema: 'payload', source: { ref: 'floor:payload' } }],
    };
    const first = { payload: { text: `${'a'.repeat(100)}1` } };
    const second = { payload: { text: `${'a'.repeat(100)}2` } };
    const view = render(
      <SchemaTable
        fieldSchemas={fields}
        uiSchema={schema}
        scope={{
          roots: {
            floor: new ObjectReferenceRoot(
              'floor',
              () => first,
              async () => undefined,
            ),
          },
        }}
      />,
    );
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toContain(`${'a'.repeat(100)}1`);
    view.rerender(
      <SchemaTable
        fieldSchemas={fields}
        uiSchema={schema}
        scope={{
          roots: {
            floor: new ObjectReferenceRoot(
              'floor',
              () => second,
              async () => undefined,
            ),
          },
        }}
      />,
    );
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toContain(`${'a'.repeat(100)}2`);
  });

  it('derives clear support from nullable field type', async () => {
    const data = { value: 5 };
    const writes = vi.fn(async () => undefined);
    const fields = new Map<string, FieldSchema>([
      [
        'value',
        {
          $id: 'value',
          type: ['number', 'null'],
          title: 'Value',
          editor: { kind: 'number' },
        },
      ],
    ]);
    const schema: UISchema = {
      schemaId: 'nullable',
      version: 1,
      nodes: [{ kind: 'field', fieldSchema: 'value', source: { ref: 'floor:value' } }],
    };
    render(
      <SchemaTable
        fieldSchemas={fields}
        uiSchema={schema}
        scope={{ roots: { floor: new ObjectReferenceRoot('floor', () => data, writes) } }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '清空' }));
    await waitFor(() => expect(writes).toHaveBeenCalledWith(['value'], { present: true, value: null }));
  });

  it('rerenders a condition when an asynchronous registry source becomes ready', async () => {
    let resolution: BlockResolution<RawSlot<unknown>> = { status: 'loading' };
    const listeners = new Set<() => void>();
    const registrySource: ValueSource<unknown> = {
      id: 'registry:enabled',
      snapshot: () => resolution,
      subscribe: (next) => {
        listeners.add(next);
        return () => listeners.delete(next);
      },
    };
    const roots: Record<string, ReferenceRoot> = {
      floor: new ObjectReferenceRoot('floor', () => ({ value: 'ready' })),
      registry: { resolve: () => registrySource },
    };
    const schema: UISchema = {
      schemaId: 'async-condition',
      version: 1,
      nodes: [
        {
          kind: 'field',
          fieldSchema: 'value',
          source: { ref: 'floor:value' },
          condition: { when: { ref: 'registry:enabled' }, otherwise: 'hidden' },
        },
      ],
    };
    render(
      <SchemaTable fieldSchemas={new Map([['value', field('value', 'Value')]])} uiSchema={schema} scope={{ roots }} />,
    );
    expect(screen.getByLabelText('loading')).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(listeners.size).toBeGreaterThan(0);
    resolution = { status: 'ready', value: { present: true, value: true } };
    act(() => [...listeners].forEach((listener) => listener()));
    await waitFor(() => expect(screen.getByRole('textbox')).toBeTruthy());
  });

  it('locates diagnostics on the referenced field and repairs mismatched raw JSON with direct set', async () => {
    const data: Record<string, unknown> = { title: { invalid: true } };
    const writes = vi.fn(async (path: readonly string[], slot: RawSlot<unknown>) => {
      if (slot.present) data[path[0]] = slot.value;
    });
    const schema: UISchema = {
      schemaId: 'fallback',
      version: 1,
      nodes: [
        {
          kind: 'group',
          id: 'main',
          label: 'Main',
          children: [{ kind: 'field', fieldSchema: 'title', source: { ref: 'floor:title' } }],
        },
      ],
    };
    render(
      <SchemaTable
        fieldSchemas={new Map([['title', field('title', 'Title')]])}
        uiSchema={schema}
        scope={{ roots: { floor: new ObjectReferenceRoot('floor', () => data, writes) } }}
        diagnostics={[
          {
            source: 'floor:title',
            code: 'title.invalid',
            severity: 'error',
            message: 'title diagnostic',
          },
        ]}
      />,
    );
    const fallback = byTestId('schema-raw-fallback-Title');
    expect(within(fallback).getByText('title diagnostic')).toBeTruthy();
    const textarea = within(fallback).getByRole('textbox');
    fireEvent.change(textarea, { target: { value: '"fixed"' } });
    fireEvent.blur(textarea);
    await waitFor(() => expect(writes).toHaveBeenCalledWith(['title'], { present: true, value: 'fixed' }));
  });

  it('repairs an invalid collection item without replacing the whole Field JSON', async () => {
    const data: Record<string, unknown> = { values: ['ok', 1] };
    const fields = new Map<string, FieldSchema>([
      [
        'values',
        {
          type: 'array',
          items: { type: 'string' },
          title: 'Values',
          editor: { kind: 'json' },
        },
      ],
    ]);
    const schema = {
      schemaId: 'collection-fallback',
      version: 1,
      nodes: [{ kind: 'field', fieldSchema: 'values', source: { ref: 'floor:values' } }],
    } as unknown as UISchema;
    render(
      <SchemaTable
        fieldSchemas={fields}
        uiSchema={schema}
        scope={{
          roots: {
            floor: new ObjectReferenceRoot(
              'floor',
              () => data,
              async (path, slot) => {
                if (slot.present) data[path[0]] = slot.value;
              },
            ),
          },
        }}
      />,
    );
    const fallback = byTestId('schema-raw-collection-fallback-Values');
    const textarea = within(fallback).getByRole('textbox');
    fireEvent.change(textarea, { target: { value: '"fixed"' } });
    fireEvent.blur(textarea);
    await waitFor(() => expect(data.values).toEqual(['ok', 'fixed']));
  });

  it('provides recursive Rest JSON update, delete and add operations', async () => {
    const data: Record<string, unknown> = { known: 'used', extra: 1, nested: { leaf: 'x' } };
    const writes = vi.fn(async (path: readonly string[], slot: RawSlot<unknown>) => {
      let target = data;
      for (const key of path.slice(0, -1)) target = target[key] as Record<string, unknown>;
      const key = path.at(-1);
      if (!key) return;
      if (slot.present) target[key] = slot.value;
      else delete target[key];
    });
    const schema: UISchema = {
      schemaId: 'rest',
      version: 1,
      nodes: [
        { kind: 'field', fieldSchema: 'known', source: { ref: 'floor:known' } },
        {
          kind: 'rest',
          id: 'rest',
          label: 'Other',
          path: { ref: 'floor:' },
        },
      ],
    };
    render(
      <SchemaTable
        fieldSchemas={new Map([['known', field('known', 'Known')]])}
        uiSchema={schema}
        scope={{ roots: { floor: new ObjectReferenceRoot('floor', () => data, writes) } }}
      />,
    );
    expect(writes).not.toHaveBeenCalled();

    const extraRow = byTestId('schema-rest-extra');
    fireEvent.change(within(extraRow).getByRole('textbox'), { target: { value: '2' } });
    fireEvent.blur(within(extraRow).getByRole('textbox'));
    await waitFor(() => expect(writes).toHaveBeenCalledWith(['extra'], { present: true, value: 2 }));
    fireEvent.click(within(extraRow).getByRole('button', { name: '删除' }));
    await waitFor(() => expect(writes).toHaveBeenCalledWith(['extra'], { present: false }));

    const names = screen.getAllByLabelText('字段名');
    const values = screen.getAllByLabelText('JSON 值');
    fireEvent.change(names.at(-1)!, { target: { value: 'created.with.dot' } });
    fireEvent.change(values.at(-1)!, { target: { value: '{"ok":true}' } });
    fireEvent.click(screen.getAllByRole('button', { name: '新增' }).at(-1)!);
    await waitFor(() =>
      expect(writes).toHaveBeenCalledWith(['created.with.dot'], { present: true, value: { ok: true } }),
    );
  });
});
