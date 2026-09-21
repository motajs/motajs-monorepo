import { beforeAll, describe, expect, it } from 'vitest';
import { blockRegistry } from '@/blockly/registry';
import { registerAllSchemas } from '@/blockly/schemas';
import { getSearchBlockTypes } from '@/blockly/toolbox/callbacks';

beforeAll(() => {
  registerAllSchemas();
});

describe('legacy Blockly line layout parity', () => {
  it('finds registered blocks by their visible label', () => {
    expect(getSearchBlockTypes('显示事件')).toContain('mota_show_s');
  });

  it.each([
    'mota_show_s',
    'mota_hide_s',
    'mota_setBlock_s',
    'mota_openDoor_s',
    'mota_closeDoor_s',
    'mota_move_s',
    'mota_moveHero_s',
    'mota_jump_s',
    'mota_jumpHero_s',
    'mota_setValue_s',
    'mota_setEnemy_s',
    'mota_setEnemyOnPoint_s',
    'mota_animate_s',
    'mota_playSound_s',
    'mota_setCurtain_s',
    'mota_screenFlash_s',
    'mota_setViewport_s',
  ])('keeps %s on one legacy grammar line', (blockType) => {
    const definition = blockRegistry.getSchemaByBlockType(blockType)?.definition;
    expect(definition, blockType).toBeDefined();
    expect(definition?.message1, blockType).toBeUndefined();
  });

  it.each([
    'mota_text_1_s',
    'mota_if_s',
    'mota_choices_s',
    'mota_confirm_s',
    'mota_previewUI_s',
    'mota_showImage_s',
    'mota_drawImage_s',
  ])('retains explicit structural rows for %s', (blockType) => {
    const definition = blockRegistry.getSchemaByBlockType(blockType)?.definition;
    expect(definition, blockType).toBeDefined();
    expect(definition?.message1, blockType).toBeDefined();
  });
});
