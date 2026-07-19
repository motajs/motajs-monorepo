import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as Blockly from 'blockly';
import { javascriptGenerator } from 'blockly/javascript';
import JSON5 from 'json5';
import path from 'node:path';

import { registerAllBlocks } from '@/blockly/blocks';
import {
  dataToWorkspaceStateWithEntry,
  hasDedicatedEntryType,
  type ParseContext,
} from '@/blockly/parser';
import { MOTA_JS_ROOT } from '../../mota-root';

beforeAll(() => registerAllBlocks());

const project: NonNullable<ParseContext['project']> = {
  bgms: ['bgm.mp3'], sounds: ['attack.mp3'], images: ['bg.jpg'], animates: ['zone'],
};

function load(
  entryType: string,
  value: unknown,
  context: NonNullable<ParseContext['project']> | null = project,
) {
  const workspace = new Blockly.Workspace();
  Blockly.serialization.workspaces.load(
    dataToWorkspaceStateWithEntry(value, entryType, context ?? undefined),
    workspace,
  );
  javascriptGenerator.init(workspace);
  const top = workspace.getTopBlocks(false)[0];
  return { workspace, top };
}

function roundTrip(
  entryType: string,
  value: unknown,
  context: NonNullable<ParseContext['project']> | null = project,
): unknown {
  const { workspace, top } = load(entryType, value, context);
  const generated = javascriptGenerator.blockToCode(top);
  const code = Array.isArray(generated) ? generated[0] : generated;
  const result = JSON5.parse(code);
  javascriptGenerator.finish('');
  workspace.dispose();
  return result;
}

describe('project configuration Blockly entries', () => {
  it('round-trips levelChoose with nested actions and optional colour', () => {
    const value = [
      { title: '简单', name: 'Easy', hard: 1, color: [64, 255, 85, 1], action: [{ type: 'comment', text: 'easy' }] },
      { title: '普通', name: 'Normal', hard: 2, action: [] },
    ];
    expect(roundTrip('levelChoose', value)).toEqual(value);
  });

  it('round-trips one- and two-ended floor partitions', () => {
    const value = [['MT0'], ['MT1', 'MT9']];
    expect(roundTrip('floorPartition', value)).toEqual(value);
  });

  it('round-trips equipment type, custom attributes and both event lists', () => {
    const value = {
      type: 'weapon', animate: 'sword', value: { atk: 10, speed: 'flag:speed' },
      percentage: { hpmax: 20 },
      equipEvent: [{ type: 'comment', text: 'equip' }],
      unequipEvent: [{ type: 'comment', text: 'unequip' }],
    };
    expect(roundTrip('equip', value)).toEqual(value);
    expect(roundTrip('equip', { type: 0, value: { atk: 10 }, percentage: {} }))
      .toEqual({ type: 0, value: { atk: 10 }, percentage: {} });
  });

  it('round-trips floor image crop fields and omitted optional fields', () => {
    const value = [
      { name: 'bg.jpg', canvas: 'bg', x: 1, y: 2, reverse: ':x', disable: true, sx: 3, sy: 4, w: 32, h: 48, frame: 2 },
      { name: 'fg.png', canvas: 'fg', x: 0, y: 0 },
    ];
    expect(roundTrip('floorImage', value)).toEqual(value);
  });

  it('round-trips all three legacy global shop shapes', () => {
    const value = [
      {
        id: 'shop1', text: '\t[贪婪之神,moneyShop]金币商店', textInList: '金币商店',
        mustEnable: false, disablePreview: true,
        choices: [{ text: '攻击+1', need: 'status:money>=20', icon: 'yellowKey', color: [255, 255, 255, 1], condition: 'flag:shop', action: [{ type: 'comment', text: 'buy' }] }],
      },
      {
        id: 'itemShop', item: true, textInList: '道具商店', use: 'experience', mustEnable: true,
        choices: [
          { id: 'yellowKey', number: 3, money: '10+flag:price', condition: 'flag:enable' },
          { id: 'blueKey', sell: '5' },
        ],
      },
      {
        id: 'recycleShop', textInList: '回收钥匙商店', mustEnable: false,
        commonEvent: '回收钥匙商店', args: [1, 'yellowKey'],
      },
    ];
    expect(roundTrip('shop', value)).toEqual(value);
  });

  it('round-trips sparse faceIds', () => {
    expect(roundTrip('faceIds', { down: 'npc0', up: 'npc3' }))
      .toEqual({ down: 'npc0', up: 'npc3' });
  });

  it('round-trips splitImages', () => {
    const value = [{ name: 'dragon.png', width: 384, height: 96, prefix: 'dragon_' }];
    expect(roundTrip('splitImages', value)).toEqual(value);
  });

  it('round-trips sparse mainStyle without adding default properties', () => {
    const value = {
      startBackground: 'project/images/bg.jpg', statusBarColor: [255, 255, 255, 1],
      borderColor: [0, 0, 0, 1], font: 'Verdana',
    };
    expect(roundTrip('mainStyle', value)).toEqual(value);
  });

  it('classifies and round-trips all nameMap child kinds', () => {
    const value = {
      '确定': 'confirm.mp3', battle: 'bgm.mp3', hit: 'attack.mp3',
      background: 'bg.jpg', zoneAlias: 'zone', other: 'file.bin',
    };
    const { workspace, top } = load('nameMap', value);
    const types: string[] = [];
    let item = top.getInputTargetBlock('ITEMS');
    while (item) {
      types.push(item.type);
      item = item.getNextBlock();
    }
    expect(types).toEqual([
      'mota_nameMapSystemSound', 'mota_nameMapBgm', 'mota_nameMapSound',
      'mota_nameMapImage', 'mota_nameMapAnimate', 'mota_nameMapUnknown',
    ]);
    const generated = javascriptGenerator.blockToCode(top);
    expect(JSON5.parse(Array.isArray(generated) ? generated[0] : generated)).toEqual(value);
    javascriptGenerator.finish('');
    workspace.dispose();
  });

  it('falls back to unknown nameMap blocks without project context', () => {
    const { workspace, top } = load('nameMap', { custom: 'bgm.mp3' }, null);
    expect(top.getInputTargetBlock('ITEMS')?.type).toBe('mota_nameMapUnknown');
    javascriptGenerator.finish('');
    workspace.dispose();
  });

  it('keeps unsupported entry data in a raw top-level block', () => {
    const value = { future: [1, 2, 3] };
    const { workspace, top } = load('futureEntry', value);
    expect(top.type).toBe('mota_rawEntry_m');
    expect(roundTrip('futureEntry', value)).toEqual(value);
    javascriptGenerator.finish('');
    workspace.dispose();
  });

  it('covers every tableMeta event entry with a dedicated mapping', () => {
    const files = [
      '_server/table/comment.js', '_server/table/data.comment.js',
      '_server/table/events.comment.js', '_server/table/functions.comment.js',
      '_server/table/plugins.comment.js',
    ];
    const entryTypes = new Set(files.flatMap((file) => (
      [...readFileSync(path.join(MOTA_JS_ROOT, file), 'utf8').matchAll(/"_event"\s*:\s*"([^"]+)"/g)]
        .map((match) => match[1])
    )));
    expect([...entryTypes].filter((entryType) => !hasDedicatedEntryType(entryType))).toEqual([]);
  });
});
