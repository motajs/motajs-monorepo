import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as Blockly from 'blockly';
import { javascriptGenerator } from 'blockly/javascript';
import JSON5 from 'json5';
import { blockRegistry, roundTripDeclarativeEvent } from '@/blockly/registry';
import { registerAllBlocks } from '@/blockly/blocks';
import { eventsToWorkspaceState } from '@/blockly/parser';
import {
  PROJECT_BLOCK_PACK_ID,
  collectProjectEventSamples,
  collectEventSamplesInValue,
  compileCustomBlockDraft,
  createBlankCustomBlockDraft,
  createEmptyProjectBlockPack,
  inferCustomBlockDraft,
  parseProjectBlockPack,
  removeProjectBlockPack,
  replaceProjectBlockPack,
  validateCustomBlockRoundTrips,
  type ProjectEventSample,
} from '@/blockly/project';
import type { BlocklyCompletionCatalog } from '@/project/model/blocklyModels';
import { projectData } from '@/project/data/projectData';
import type { DataResource } from '@/project/data/DataResource';

beforeAll(() => registerAllBlocks());
afterEach(() => {
  blockRegistry.removePack(PROJECT_BLOCK_PACK_ID);
  vi.restoreAllMocks();
});

function sample(event: Record<string, unknown>, path = '$'): ProjectEventSample {
  return { source: 'test', path, event };
}

describe('project custom event pack', () => {
  it('accepts the v1 shape and rejects legacy or misspelled properties', () => {
    const valid = createEmptyProjectBlockPack();
    expect(parseProjectBlockPack(valid)).toEqual(valid);
    expect(() => parseProjectBlockPack({ ...valid, formatVersion: 0 })).toThrow('formatVersion');
    expect(() => parseProjectBlockPack({ ...valid, blokcs: [] })).toThrow('未知属性');
    expect(() => parseProjectBlockPack({ ...valid, blocks: {} })).toThrow('必须是数组');
  });

  it('rejects duplicate custom event types and builtin matchers', () => {
    const first = compileCustomBlockDraft({
      ...createBlankCustomBlockDraft(),
      eventType: 'projectThing',
      title: '工程事件',
    });
    const duplicate = {
      ...first,
      type: `${first.type}_2`,
      definition: { ...first.definition, type: `${first.type}_2` },
    };
    expect(() =>
      parseProjectBlockPack({
        ...createEmptyProjectBlockPack(),
        blocks: [first, duplicate],
      }),
    ).toThrow('自定义事件 type 重复');

    const builtin = compileCustomBlockDraft({
      ...createBlankCustomBlockDraft(),
      eventType: 'comment',
      title: '不能覆盖注释',
    });
    const result = blockRegistry.replacePack(
      {
        ...createEmptyProjectBlockPack(),
        blocks: [builtin],
      },
      { source: 'extension' },
    );
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((item) => item.code === 'matcher.conflict')).toBe(true);
  });

  it('replaces and releases the project-owned registry atomically', () => {
    const first = compileCustomBlockDraft({
      ...createBlankCustomBlockDraft(),
      eventType: 'projectFirst',
      title: 'First',
    });
    const second = compileCustomBlockDraft({
      ...createBlankCustomBlockDraft(),
      eventType: 'projectSecond',
      title: 'Second',
    });
    replaceProjectBlockPack({ ...createEmptyProjectBlockPack(), blocks: [first] });
    expect(blockRegistry.hasEventType('projectFirst')).toBe(true);
    replaceProjectBlockPack({ ...createEmptyProjectBlockPack(), blocks: [second] });
    expect(blockRegistry.hasEventType('projectFirst')).toBe(false);
    expect(blockRegistry.hasEventType('projectSecond')).toBe(true);
    removeProjectBlockPack();
    expect(blockRegistry.hasEventType('projectSecond')).toBe(false);
  });
});

describe('custom event inference', () => {
  const catalog: BlocklyCompletionCatalog = {
    all: [],
    diagnostics: [],
    bySource: {
      image: [{ value: 'hero.png', kind: 'image' }],
      sound: [{ value: 'hero.png', kind: 'sound' }],
      item: [{ value: 'yellowKey', kind: 'item' }],
    },
  };

  it('uses clicked-sample key order, unions fields and marks missing values optional', () => {
    const draft = inferCustomBlockDraft(
      'dialogue',
      [
        sample({ type: 'dialogue', enabled: true, title: 'first', count: 2 }),
        sample({ type: 'dialogue', title: 'second', body: 'line 1\nline 2' }, '$[1]'),
      ],
      catalog,
    );
    expect(draft.fields.map((field) => field.path)).toEqual(['enabled', 'title', 'count', 'body']);
    expect(draft.fields.map((field) => field.control)).toEqual(['checkbox', 'text', 'number', 'multiline']);
    expect(draft.fields.find((field) => field.path === 'enabled')?.optional).toBe(true);
    expect(draft.fields.find((field) => field.path === 'title')?.optional).toBe(false);
  });

  it('infers completion only when every string uniquely matches one source', () => {
    const unique = inferCustomBlockDraft('custom', [sample({ type: 'custom', arbitrary: 'yellowKey' })], catalog);
    expect(unique.fields[0].completionSource).toBe('item');

    const ambiguous = inferCustomBlockDraft('custom', [sample({ type: 'custom', arbitrary: 'hero.png' })], catalog);
    expect(ambiguous.fields[0].completionSource).toBeUndefined();
  });

  it('does not use field names as semantic hints', () => {
    const controls = ['sound', 'title', 'x'].map(
      (key) => inferCustomBlockDraft('custom', [sample({ type: 'custom', [key]: 'free text' })], catalog).fields[0],
    );
    expect(controls.map(({ control, completionSource }) => ({ control, completionSource }))).toEqual(
      Array(3).fill({ control: 'text', completionSource: undefined }),
    );
  });

  it('falls back to JSON for null, containers and mixed JSON types', () => {
    for (const value of [null, { x: 1 }, [1, 2]]) {
      expect(inferCustomBlockDraft('custom', [sample({ type: 'custom', value })]).fields[0].control).toBe('json');
    }
    expect(
      inferCustomBlockDraft('custom', [sample({ type: 'custom', value: 1 }), sample({ type: 'custom', value: '1' })])
        .fields[0].control,
    ).toBe('json');
  });
});

describe('custom event lossless mapping', () => {
  it('preserves unbound and later-added fields, nested objects, dot keys and null', () => {
    const draft = inferCustomBlockDraft('dialogue', [
      sample({
        type: 'dialogue',
        title: '妖精',
        nullable: null,
        'literal.key': 'kept',
        portraits: [{ side: 'left', image: 'fairy.png' }],
      }),
    ]);
    // Deliberately map only two fields. Everything else must remain in the raw snapshot.
    draft.fields = draft.fields.filter((field) => field.path === 'title' || field.path.includes('literal.key'));
    const schema = compileCustomBlockDraft(draft);
    const input = {
      type: 'dialogue',
      title: '妖精',
      nullable: null,
      'literal.key': 'kept',
      portraits: [{ side: 'left', image: 'fairy.png' }],
      addedLater: { exact: true },
      _collapsed: true,
      _disabled: true,
    };
    expect(roundTripDeclarativeEvent({ ...schema, eventType: 'dialogue' }, input)).toEqual(input);
    expect(validateCustomBlockRoundTrips(schema, [sample(input)])).toEqual([]);
  });

  it('keeps the per-block raw snapshot when a real Blockly field is edited', () => {
    const input = {
      type: 'dialogue',
      title: 'before',
      nested: { value: [1, null, { exact: true }] },
      'literal.key': 'untouched',
      addedByPlugin: 42,
    };
    const draft = inferCustomBlockDraft('dialogue', [sample(input)]);
    draft.fields = draft.fields.filter((field) => field.path === 'title');
    const schema = compileCustomBlockDraft(draft);
    const result = blockRegistry.replacePack(
      {
        ...createEmptyProjectBlockPack(),
        blocks: [schema],
      },
      { source: 'extension' },
    );
    expect(result.ok).toBe(true);

    const workspace = new Blockly.Workspace();
    Blockly.serialization.workspaces.load(eventsToWorkspaceState([input]), workspace);
    const block = workspace.getTopBlocks(false)[0];
    block.setFieldValue('after', draft.fields[0].id);
    javascriptGenerator.init(workspace);
    const generated = javascriptGenerator.blockToCode(block);
    const code = Array.isArray(generated) ? generated[0] : generated;
    const output = JSON5.parse(`[${code.trim().replace(/,$/, '')}]`)[0];
    javascriptGenerator.finish('');
    workspace.dispose();

    expect(output).toEqual({ ...input, title: 'after' });
  });
});

describe('project event index traversal', () => {
  it('finds nested event objects and reports stable source paths', () => {
    const value = {
      action: [
        { type: 'custom', value: 1 },
        { type: 'if', true: [{ type: 'custom', value: 2 }] },
      ],
      record: { 'dot.key': { type: 'custom', value: 3 } },
    };
    const result = collectEventSamplesInValue(value, 'custom', 'floor:sample0');
    expect(result.map((entry) => `${entry.source}:${entry.path}`)).toEqual([
      'floor:sample0:$.action[0]',
      'floor:sample0:$.action[1].true[0]',
      'floor:sample0:$.record["dot.key"]',
    ]);
  });

  it('uses ensureLoaded without reloading already loaded resources and isolates failures', async () => {
    const resources: Array<{ ensureLoaded: ReturnType<typeof vi.fn>; reload: ReturnType<typeof vi.fn> }> = [];
    const fake = (path: string, value?: unknown, failure?: Error): DataResource<unknown> => {
      const ensureLoaded = vi.fn(async () => {
        if (failure) throw failure;
      });
      const reload = vi.fn(async () => {
        throw new Error('reload must not be called');
      });
      resources.push({ ensureLoaded, reload });
      return {
        path,
        ensureLoaded,
        reload,
        snapshot: () => (failure ? { status: 'error', error: failure } : { status: 'loaded', value }),
      } as unknown as DataResource<unknown>;
    };
    vi.spyOn(projectData, 'tower').mockReturnValue(
      fake('tower', {
        main: { floorIds: ['F1'] },
        firstData: { action: [{ type: 'indexOnly', from: 'tower' }] },
      }) as ReturnType<typeof projectData.tower>,
    );
    vi.spyOn(projectData, 'items').mockReturnValue(
      fake('items', {
        item: { useItemEvent: [{ type: 'indexOnly', from: 'item' }] },
      }) as ReturnType<typeof projectData.items>,
    );
    vi.spyOn(projectData, 'enemys').mockReturnValue(
      fake('enemys', {}, new Error('enemy read failed')) as ReturnType<typeof projectData.enemys>,
    );
    vi.spyOn(projectData, 'mapBlocks').mockReturnValue(fake('maps', {}) as ReturnType<typeof projectData.mapBlocks>);
    vi.spyOn(projectData, 'commonEvents').mockReturnValue(
      fake('events', {
        custom: [{ type: 'indexOnly', from: 'common' }],
      }) as ReturnType<typeof projectData.commonEvents>,
    );
    vi.spyOn(projectData, 'floor').mockReturnValue(
      fake('floor', {
        events: { '1,1': [{ type: 'indexOnly', from: 'floor' }] },
      }) as ReturnType<typeof projectData.floor>,
    );

    const result = await collectProjectEventSamples('indexOnly');
    expect(result.samples.map((entry) => entry.event.from)).toEqual(['tower', 'item', 'common', 'floor']);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].source).toBe('enemys');
    resources.forEach(({ ensureLoaded, reload }) => {
      expect(ensureLoaded).toHaveBeenCalledOnce();
      expect(reload).not.toHaveBeenCalled();
    });
  });
});
