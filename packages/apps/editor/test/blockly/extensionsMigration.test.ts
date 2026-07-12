import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as Blockly from 'blockly';
import {
  blocklyInteractionRegistry,
  buildBlocklyPreview,
  getEffectiveInteractions,
  parseTextDrawingPreview,
  createBlocklyInteractionController,
} from '@/blockly/interactions';
import { diagnoseBlocklyEvents } from '@/blockly/diagnostics/asyncDiagnostics';
import {
  BlocklyEditorSession,
  BlocklySessionStore,
} from '@/blockly/session/BlocklyEditorSession';
import {
  buildBlocklyCompletionCatalog,
  buildFlagUsageIndex,
} from '@/project/model/blocklyModels';
import {
  replaceExpressionForDisplay,
  replaceExpressionFromDisplay,
} from '@/blockly/representation';
import type { BlocklyInteractionCapabilities } from '@/Workbench/EventsEditor/BlocklyCapabilitiesContext';
import {
  blockRegistry,
  normalizeBuiltinStatementLayout,
  type BlockSchema,
  withDisabledBlocksEnabled,
} from '@/blockly/registry';
import { javascriptGenerator } from 'blockly/javascript';
import { registerAllBlocks } from '@/blockly/blocks';
import { allSchemas } from '@/blockly/schemas';

beforeAll(() => registerAllBlocks());

function fakeBlock(initial: Record<string, unknown>): Blockly.Block {
  const fields = { ...initial };
  return {
    id: 'block-1',
    type: 'test_s',
    getFieldValue: (name: string) => fields[name],
    setFieldValue: (value: unknown, name: string) => { fields[name] = value; },
  } as unknown as Blockly.Block;
}

function capabilities(overrides: Partial<BlocklyInteractionCapabilities> = {}): BlocklyInteractionCapabilities {
  return {
    editText: vi.fn(async () => null),
    selectPoint: vi.fn(async () => null),
    selectMaterial: vi.fn(async () => null),
    preview: vi.fn(async () => undefined),
    searchFlags: vi.fn(async () => undefined),
    confirm: vi.fn(async () => true),
    report: vi.fn(),
    ...overrides,
  };
}

describe('Blockly extension interactions', () => {
  it('places statement labels on their own row and keeps the C-shaped input narrow', () => {
    const definition = normalizeBuiltinStatementLayout({
      type: 'layout_test',
      message0: 'ui绘制并预览（双击此项可进行预览） %1',
      args0: [{ type: 'input_statement', name: 'ACTION' }],
      colour: 1,
    });
    expect(definition).toMatchObject({
      message0: 'ui绘制并预览（双击此项可进行预览）',
      message1: '%1',
      args1: [{ type: 'input_statement', name: 'ACTION' }],
    });
    const loop = normalizeBuiltinStatementLayout({
      type: 'loop_test',
      message0: '当 %1 时循环',
      args0: [{ type: 'input_value', name: 'CONDITION' }],
      message1: '执行 %1',
      args1: [{ type: 'input_statement', name: 'ACTION' }],
      colour: 1,
    });
    expect(loop).toMatchObject({
      message0: '当 %1 时循环',
      message1: '%1',
      args1: [{ type: 'input_statement', name: 'ACTION' }],
      inputsInline: true,
    });
    const entry = normalizeBuiltinStatementLayout({
      type: 'entry_test',
      message0: '获取道具后 轻按时不触发 %1 %2 %3',
      args0: [
        { type: 'field_checkbox', name: 'DISABLE' },
        { type: 'input_dummy' },
        { type: 'input_statement', name: 'ACTION' },
      ],
      colour: 1,
    });
    expect(entry).toMatchObject({
      message0: '获取道具后 轻按时不触发 %1',
      args0: [{ type: 'field_checkbox', name: 'DISABLE' }],
      message1: '%1',
      args1: [{ type: 'input_statement', name: 'ACTION' }],
    });
  });

  it('normalizes every builtin statement slot to an unlabeled row', () => {
    for (const schema of allSchemas) {
      const definition = normalizeBuiltinStatementLayout(schema.definition) as unknown as Record<string, unknown>;
      for (let index = 0; typeof definition[`message${index}`] === 'string'; index += 1) {
        const args = definition[`args${index}`];
        if (!Array.isArray(args) || !args.some((arg) => arg.type === 'input_statement')) continue;
        expect(definition[`message${index}`], schema.definition.type).toBe('%1');
        expect(args, schema.definition.type).toHaveLength(1);
      }
    }
  });

  it('keeps field-only action blocks on one row', () => {
    const setValue = normalizeBuiltinStatementLayout({
      type: 'mota_setValue_s',
      message0: '数值操作 %1 %2 %3',
      args0: [
        { type: 'field_input', name: 'NAME' },
        { type: 'field_dropdown', name: 'OPERATOR', options: [['=', '=']] },
        { type: 'field_input', name: 'VALUE' },
      ],
      message1: '不刷新状态栏 %1',
      args1: [{ type: 'field_checkbox', name: 'NO_REFRESH' }],
      previousStatement: null,
      nextStatement: null,
      colour: 1,
    }) as unknown as Record<string, unknown>;
    expect(setValue.message0).toBe('数值操作 %1 %2 %3 不刷新状态栏 %4');
    expect(setValue.args0).toHaveLength(4);
    expect(setValue.message1).toBeUndefined();
    expect(setValue.inputsInline).toBe(true);

    for (const schema of allSchemas) {
      const definition = normalizeBuiltinStatementLayout(schema.definition) as unknown as Record<string, unknown>;
      const isAction = Object.prototype.hasOwnProperty.call(definition, 'previousStatement')
        || Object.prototype.hasOwnProperty.call(definition, 'nextStatement');
      if (!isAction || definition.inputsInline === false) continue;
      const rows: unknown[][] = [];
      let structural = false;
      for (let index = 0; typeof definition[`message${index}`] === 'string'; index += 1) {
        const args = Array.isArray(definition[`args${index}`]) ? definition[`args${index}`] as unknown[] : [];
        rows.push(args);
        structural ||= args.some((raw) => {
          const type = (raw as { type?: string }).type;
          return type === 'input_statement' || type === 'input_value' || type === 'field_multilinetext';
        });
      }
      if (!structural) expect(rows, schema.definition.type).toHaveLength(1);
    }
  });

  it('round-trips escaped newline text through the modern code editor capability', async () => {
    const block = fakeBlock({ TEXT: 'first\\nsecond' });
    const editText = vi.fn(async (request) => {
      expect(request.value).toBe('first\nsecond');
      return 'changed\nvalue';
    });
    const result = await blocklyInteractionRegistry.execute(block, {
      type: 'editText', field: 'TEXT', mode: 'escaped-newline',
    }, capabilities({ editText }));
    expect(result.ok).toBe(true);
    expect(block.getFieldValue('TEXT')).toBe('changed\\nvalue');
  });

  it('cancelling a point interaction leaves all fields unchanged', async () => {
    const block = fakeBlock({ X: '1', Y: '2', FLOOR_ID: 'sample0' });
    await blocklyInteractionRegistry.execute(block, {
      type: 'selectPoint', xField: 'X', yField: 'Y', floorField: 'FLOOR_ID', floorPolicy: 'explicit',
    }, capabilities());
    expect(block.getFieldValue('X')).toBe('1');
    expect(block.getFieldValue('Y')).toBe('2');
    expect(block.getFieldValue('FLOOR_ID')).toBe('sample0');
  });

  it('infers safe interactions only for builtin multiline and map fields', () => {
    const schema = {
      eventType: 'show', category: 'map',
      definition: {
        type: 'mota_show_s', message0: '%1 %2',
        args0: [
          { type: 'field_input', name: 'X', text: '' },
          { type: 'field_input', name: 'Y', text: '' },
        ], colour: 1,
      },
    } as BlockSchema;
    expect(getEffectiveInteractions(schema)).toEqual([
      { type: 'selectPoint', xField: 'X', yField: 'Y', floorField: undefined, floorPolicy: 'current' },
    ]);
  });

  it('dispatches a real Blockly double click to the declared default interaction', async () => {
    const workspace = new Blockly.Workspace();
    javascriptGenerator.init(workspace);
    const block = workspace.newBlock('mota_text_0_s');
    block.setFieldValue('preview me', 'TEXT');
    const preview = vi.fn(async () => undefined);
    const controller = createBlocklyInteractionController(
      workspace as unknown as Blockly.WorkspaceSvg,
      capabilities({ preview }),
    );
    workspace.fireChangeListener(new Blockly.Events.Click(block));
    workspace.fireChangeListener(new Blockly.Events.Click(block));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(preview).toHaveBeenCalledOnce();
    controller.dispose();
    javascriptGenerator.finish('');
    workspace.dispose();
  });

  it('previews only the selected block when it has a following statement', async () => {
    const workspace = new Blockly.Workspace();
    javascriptGenerator.init(workspace);
    const previewBlock = workspace.newBlock('mota_previewUI_s');
    const followingBlock = workspace.newBlock('mota_comment_s');
    followingBlock.setFieldValue('must not be part of the preview event', 'TEXT');
    previewBlock.nextConnection?.connect(followingBlock.previousConnection!);
    const preview = vi.fn(async () => undefined);

    const result = await blocklyInteractionRegistry.execute(
      previewBlock,
      { type: 'preview', adapter: 'event' },
      capabilities({ preview }),
    );

    expect(result).toEqual({ ok: true });
    expect(preview).toHaveBeenCalledOnce();
    expect(preview.mock.calls[0][0].staticPreview).toEqual([]);
    javascriptGenerator.finish('');
    workspace.dispose();
  });

  it('preserves supported collapsed and disabled event metadata', () => {
    const parser = blockRegistry.getParserForEvent({
      type: 'text', text: 'hello', _collapsed: true, _disabled: true,
    });
    expect(parser?.({ type: 'text', text: 'hello', _collapsed: true, _disabled: true }, { entryType: 'common' }))
      .toMatchObject({ collapsed: true, enabled: false });

    const workspace = new Blockly.Workspace();
    javascriptGenerator.init(workspace);
    const block = workspace.newBlock('mota_text_1_s');
    block.setFieldValue('hello', 'TEXT');
    block.setCollapsed(true);
    block.setDisabledReason(true, 'manual');
    const generated = withDisabledBlocksEnabled(workspace, () => javascriptGenerator.blockToCode(block));
    const value = JSON.parse((Array.isArray(generated) ? generated[0] : generated).replace(/,\s*$/, ''));
    expect(value).toMatchObject({ _collapsed: true, _disabled: true });
    javascriptGenerator.finish('');
    workspace.dispose();
  });
});

describe('Blockly preview and diagnostics', () => {
  it('converts text drawing escapes without executing project code', () => {
    expect(parseTextDrawingPreview('x\\f[hero.png,1,2,32,32]y')).toEqual([
      { type: 'drawImage', image: 'hero.png', x: 1, y: 2, w: 32, h: 32 },
    ]);
    expect(buildBlocklyPreview({ type: 'previewUI', action: [{ type: 'fillRect', x: 1 }] }, 'event').staticPreview)
      .toEqual([{ type: 'fillRect', x: 1 }]);
  });

  it('matches legacy async join semantics through nested branches', () => {
    expect(diagnoseBlocklyEvents([{ type: 'playSound', async: true }])).toHaveLength(1);
    expect(diagnoseBlocklyEvents([
      { type: 'playSound', async: true }, { type: 'waitAsync' },
    ])).toHaveLength(0);
    expect(diagnoseBlocklyEvents([{ type: 'if', true: [{ type: 'move', async: true }], false: [] }])).toHaveLength(1);
    expect(diagnoseBlocklyEvents([{ type: 'text', async: true }])).toHaveLength(0);
  });
});

describe('Blockly editor session', () => {
  it('does not let workspace changes overwrite unparsed source', () => {
    const session = new BlocklyEditorSession('floor:sample0:8,7', 'afterGetItem', '[]');
    session.editSource('[{"type":"text"}]');
    expect(session.workspaceChanged('[{"type":"comment"}]')).toBe(false);
    expect(session.snapshot().sourceText).toBe('[{"type":"text"}]');
    session.parseSucceeded(session.snapshot().sourceText);
    expect(session.workspaceChanged('[{"type":"text","text":"ok"}]')).toBe(true);
  });

  it('restores viewport by event context', () => {
    const store = new BlocklySessionStore();
    const first = new BlocklyEditorSession('event-a', 'common', '[]');
    first.setViewport({ x: -20, y: 30, scale: 1.2 }, 'b1');
    store.save(first);
    const reopened = new BlocklyEditorSession('event-a', 'common', '[]');
    store.restore(reopened);
    expect(reopened.snapshot().viewport).toEqual({ x: -20, y: 30, scale: 1.2 });
    expect(reopened.snapshot().selectedBlockId).toBe('b1');
  });
});

describe('Blockly static project models', () => {
  it('builds completion groups from project data', () => {
    const catalog = buildBlocklyCompletionCatalog({
      tower: { main: { floorIds: ['sample0'], bgms: ['bgm.mp3'] }, firstData: { shops: [{ id: 'shop1' }] } },
      items: { yellowKey: { name: '黄钥匙', idnum: 21 } },
      enemys: { greenSlime: { name: '绿头怪', idnum: 201 } },
      mapBlocks: { 21: { id: 'yellowKey' } }, commonEvents: { test: [] }, floorIds: ['sample0'],
    });
    expect(catalog.bySource.item.some((item) => item.value === 'yellowKey')).toBe(true);
    expect(catalog.bySource.floor[0]?.value).toBe('sample0');
    expect(catalog.bySource.shop[0]?.value).toBe('shop1');
  });

  it('indexes structured flag references without executing strings', () => {
    const index = buildFlagUsageIndex({
      tower: { firstData: { startText: ['变量：started'] } },
      items: {}, enemys: {}, mapBlocks: {}, commonEvents: { test: [{ type: 'if', condition: 'flag:started' }] },
      floors: { sample0: { events: { '8,7': [{ type: 'setValue', name: 'flag:door' }] } } },
    });
    expect(index.flags).toEqual(['door', 'started']);
    expect(index.usages.started).toHaveLength(2);
  });

  it('keeps Chinese representation conversion reversible', () => {
    const raw = 'status:hp+flag:door+item:yellowKey';
    expect(replaceExpressionFromDisplay(replaceExpressionForDisplay(raw))).toBe(raw);
  });
});
