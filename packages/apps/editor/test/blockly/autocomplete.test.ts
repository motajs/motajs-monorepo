import * as Blockly from 'blockly';
import { beforeAll, describe, expect, it } from 'vitest';

import { registerAllBlocks } from '@/blockly/blocks';
import { resolveBlocklyCompletions } from '@/blockly/fields/FieldAutocomplete';
import type { BlocklyCompletionCatalog } from '@/project/model/projectModel';

beforeAll(() => registerAllBlocks());

const catalog: BlocklyCompletionCatalog = {
  all: [
    { value: 'yellowKey', kind: 'item' },
    { value: 'redKey', kind: 'item' },
    { value: 'sample0', kind: 'floor' },
  ],
  bySource: {
    item: [{ value: 'yellowKey', kind: 'item' }, { value: 'redKey', kind: 'item' }],
    floor: [{ value: 'sample0', kind: 'floor' }],
    status: [{ value: 'hp', kind: 'status' }, { value: 'atk', kind: 'status' }],
    core: [{ value: 'getBlockInfo', kind: 'core' }, { value: 'status', kind: 'core' }],
    textEscape: [{ value: '\\i[]', kind: 'escape' }],
  },
  diagnostics: [],
};

describe('Blockly autocomplete', () => {
  it('uses contextual suffix completion inside expressions', () => {
    expect(resolveBlocklyCompletions(catalog, 'auto', 'status:h', 8).suggestions).toEqual([
      { label: 'hp', value: 'hp' },
    ]);
    expect(resolveBlocklyCompletions(catalog, 'floor', 'sam', 3).suggestions).toEqual([
      { label: 'sample0', value: 'sample0' },
    ]);
    expect(resolveBlocklyCompletions(catalog, 'auto', 'core.get', 8).suggestions).toEqual([
      { label: 'getBlockInfo', value: 'getBlockInfo' },
    ]);
  });

  it('keeps plain text quiet and completes ids inside interpolated expressions', () => {
    expect(resolveBlocklyCompletions(catalog, 'contextual', '普通选项文本', 6).suggestions).toEqual([]);
    const result = resolveBlocklyCompletions(catalog, 'contextual', '获得${item:yellowKey}一个', 9);
    expect(result.suggestions.map((item) => item.value)).toEqual(['redKey', 'yellowKey']);
    expect(result.replaceStart).toBe(9);
    expect(result.replaceEnd).toBe(18);
  });

  it('upgrades every builtin text input to the shared autocomplete field', () => {
    const workspace = new Blockly.Workspace();
    const block = workspace.newBlock('mota_useItem_s');
    const field = block.getField('ID') as Blockly.FieldTextInput & { getCompletionSource?(): string };
    expect(field.getCompletionSource?.()).toBe('item');
    workspace.dispose();
  });

  it('marks choice text as contextual and its icon as a block id', () => {
    const workspace = new Blockly.Workspace();
    const block = workspace.newBlock('mota_choice_item_s');
    const text = block.getField('TEXT') as Blockly.FieldTextInput & { getCompletionSource?(): string };
    const icon = block.getField('ICON') as Blockly.FieldTextInput & { getCompletionSource?(): string };
    expect(text.getCompletionSource?.()).toBe('contextual');
    expect(icon.getCompletionSource?.()).toBe('id');
    workspace.dispose();
  });
});
