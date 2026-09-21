import * as Blockly from 'blockly';
import { javascriptGenerator } from 'blockly/javascript';
import { beforeAll, describe, expect, it } from 'vitest';

import { registerAllBlocks } from '@/blockly/blocks';
import { BlockRegistry } from '@/blockly/registry';

beforeAll(() => registerAllBlocks());

function createPack(id = 'test:declarative') {
  return {
    id,
    version: 1,
    blocks: [
      {
        type: `${id}:notice`,
        definition: {
          type: `${id}:notice`,
          message0: '通知 %1 重试 %2',
          args0: [
            { type: 'field_input' as const, name: 'TEXT', text: '' },
            { type: 'field_checkbox' as const, name: 'RETRY', checked: false },
          ],
          previousStatement: null,
          nextStatement: null,
          inputsInline: true,
          colour: 70,
        },
        event: {
          match: { path: 'type', equals: `${id}:notice` },
          template: { type: `${id}:notice` },
          bindings: [
            { input: 'TEXT', kind: 'field' as const, path: 'payload.text', valueType: 'string' as const },
            {
              input: 'RETRY',
              kind: 'field' as const,
              path: 'payload.retry',
              valueType: 'boolean' as const,
              default: false,
              omitWhenDefault: true,
            },
          ],
        },
      },
    ],
  };
}

describe('declarative block packs', () => {
  it('registers a JSON-only block and parses nested field paths', () => {
    const registry = new BlockRegistry();
    const pack = createPack();
    const result = registry.registerPackJson(JSON.stringify(pack));

    expect(result).toMatchObject({ ok: true, registeredBlockTypes: ['test:declarative:notice'] });
    const parser = registry.getParserForEvent({
      type: 'test:declarative:notice',
      payload: { text: 'hello', retry: true },
    });
    expect(
      parser?.(
        {
          type: 'test:declarative:notice',
          payload: { text: 'hello', retry: true },
        },
        { entryType: 'event' },
      ),
    ).toEqual({
      type: 'test:declarative:notice',
      fields: { TEXT: 'hello', RETRY: true },
    });
  });

  it('generates event JSON without a custom codec', () => {
    const registry = new BlockRegistry();
    const pack = createPack('test:generate');
    expect(registry.registerPackJson(pack).ok).toBe(true);
    registry.initialize();

    const workspace = new Blockly.Workspace();
    javascriptGenerator.init(workspace);
    const block = workspace.newBlock('test:generate:notice');
    block.setFieldValue('saved', 'TEXT');
    block.setFieldValue('TRUE', 'RETRY');
    const generated = javascriptGenerator.blockToCode(block);
    const code = Array.isArray(generated) ? generated[0] : generated;

    expect(JSON.parse(code.replace(/,\s*$/, ''))).toEqual({
      type: 'test:generate:notice',
      payload: { text: 'saved', retry: true },
    });
    javascriptGenerator.finish('');
    workspace.dispose();
  });

  it('keeps failed extension packs atomic', () => {
    const registry = new BlockRegistry();
    const pack = createPack('test:atomic');
    pack.blocks.push({ ...pack.blocks[0] });
    const result = registry.registerPackJson(pack);

    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((item) => item.code === 'block.duplicate')).toBe(true);
    expect(registry.getRegisteredBlockTypes()).toEqual([]);
  });

  it('rejects executable behavior, unsafe paths, and builtin overrides', () => {
    const registry = new BlockRegistry();
    const first = createPack('test:safe');
    expect(registry.registerPackJson(first).ok).toBe(true);

    const override = createPack('test:override');
    override.blocks[0].type = 'test:safe:notice';
    override.blocks[0].definition.type = 'test:safe:notice';
    override.blocks[0].event.bindings[0].path = '__proto__.polluted';
    const result = registry.registerPackJson(override);

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((item) => item.code)).toEqual(
      expect.arrayContaining(['extension.override', 'path.invalid']),
    );
  });

  it('accepts public declarative interactions and rejects unknown commands or fields', () => {
    const validRegistry = new BlockRegistry();
    const valid = createPack('test:interaction');
    Object.assign(valid.blocks[0], {
      interactions: [
        { type: 'editText', field: 'TEXT', mode: 'multiline' },
        { type: 'autocomplete', field: 'TEXT', source: 'expression' },
      ],
      defaultInteraction: 'editText',
    });
    expect(validRegistry.registerPackJson(JSON.stringify(valid)).ok).toBe(true);

    const invalidRegistry = new BlockRegistry();
    const invalid = createPack('test:unsafe-interaction');
    Object.assign(invalid.blocks[0], {
      interactions: [
        { type: 'command', command: 'runProjectCode', trigger: 'doubleClick' },
        { type: 'editText', field: 'MISSING', mode: 'javascript' },
      ],
    });
    const result = invalidRegistry.registerPackJson(JSON.stringify(invalid));
    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((item) => item.code)).toEqual(
      expect.arrayContaining(['interaction.unsafe-command', 'interaction.missing-field']),
    );
  });
});
