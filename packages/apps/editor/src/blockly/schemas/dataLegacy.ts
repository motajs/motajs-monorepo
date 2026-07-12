import type * as Blockly from 'blockly';

import type { BlockSchema } from '../registry';
import type { EventObject } from '../parser/types';
import {
  checkbox, declarativeSchema, expression, expressionValue, field, generateMultiLoc,
  generated, locationState, statementDefinition, value,
} from './legacyHelpers';

const operators: Array<[string, string]> = [['=', '='], ['+=', '+='], ['-=', '-='], ['*=', '*='], ['/=', '/=']];

export const followSchema = declarativeSchema('follow', 'data', {
  type: 'mota_follow_s', message0: '跟随勇士 行走图 %1',
  args0: [{ type: 'field_input', name: 'NAME', text: '' }], colour: 'auto',
}, [field('NAME', 'name', { valueType: 'string' })], {
  interactions: [{ type: 'selectMaterial', field: 'NAME', materialKind: 'image', aliasPolicy: 'preserve' }],
});

export const unfollowSchema = declarativeSchema('unfollow', 'data', {
  type: 'mota_unfollow_s', message0: '取消跟随 行走图 %1',
  args0: [{ type: 'field_input', name: 'NAME', text: '' }], colour: 'auto',
}, [field('NAME', 'name', { valueType: 'string' })], {
  interactions: [{ type: 'selectMaterial', field: 'NAME', materialKind: 'image', aliasPolicy: 'preserve' }],
});

export const loadEquipSchema = declarativeSchema('loadEquip', 'data', {
  type: 'mota_loadEquip_s', message0: '装上装备 %1',
  args0: [{ type: 'field_input', name: 'ID', text: 'sword1' }], colour: 'auto',
}, [field('ID', 'id', { valueType: 'string', optional: false })], {
  interactions: [{ type: 'autocomplete', field: 'ID', source: 'item' }],
});

export const unloadEquipSchema = declarativeSchema('unloadEquip', 'data', {
  type: 'mota_unloadEquip_s', message0: '卸下第 %1 格装备',
  args0: [{ type: 'field_number', name: 'POS', value: 0, min: 0, precision: 1 }], colour: 'auto',
}, [field('POS', 'pos', { valueType: 'number', optional: false })]);

export const setEquipSchema = declarativeSchema('setEquip', 'data', {
  type: 'mota_setEquip_s', message0: '设置装备属性 装备 ID %1 %2 属性 %3 %4 %5',
  args0: [
    { type: 'field_input', name: 'ID', text: 'sword1' },
    { type: 'field_dropdown', name: 'VALUE_TYPE', options: [['数值', 'value'], ['百分比', 'percentage']] },
    { type: 'field_input', name: 'NAME', text: 'atk' },
    { type: 'field_dropdown', name: 'OPERATOR', options: operators },
    { type: 'input_value', name: 'VALUE', check: ['Boolean', 'String'] },
  ], colour: 'auto',
}, [
  field('ID', 'id', { valueType: 'string', optional: false }),
  field('VALUE_TYPE', 'valueType', { default: 'value', omitWhenDefault: true }),
  field('NAME', 'name', { valueType: 'string', optional: false }),
  field('OPERATOR', 'operator', { default: '=', omitWhenDefault: true }),
  value('VALUE', 'value', { optional: false }),
], {
  interactions: [
    { type: 'autocomplete', field: 'ID', source: 'item' },
    { type: 'autocomplete', field: 'NAME', source: 'expression' },
  ],
});

export const resetEnemyOnPointSchema: BlockSchema = {
  eventType: 'resetEnemyOnPoint', category: 'data',
  definition: {
    ...statementDefinition, type: 'mota_resetEnemyOnPoint_s', colour: 'auto',
    message0: '重置某点怪物属性 x %1 y %2 楼层 %3 不刷新显伤 %4',
    args0: [
      { type: 'field_input', name: 'X', text: '' }, { type: 'field_input', name: 'Y', text: '' },
      { type: 'field_input', name: 'FLOOR_ID', text: '' },
      { type: 'field_checkbox', name: 'NO_REFRESH', checked: false },
    ],
  },
  parser: (event) => locationState('mota_resetEnemyOnPoint_s', event, {
    FLOOR_ID: expression(event.floorId), NO_REFRESH: event.norefresh === true,
  }),
  generator: (block) => {
    const event: Record<string, unknown> = { type: 'resetEnemyOnPoint' };
    const loc = generateMultiLoc(block.getFieldValue('X'), block.getFieldValue('Y'));
    if (loc !== undefined) event.loc = loc;
    const floorId = block.getFieldValue('FLOOR_ID');
    if (floorId) event.floorId = floorId;
    if (checkbox(block, 'NO_REFRESH')) event.norefresh = true;
    return generated(event);
  },
  interactions: [{ type: 'selectPoint', xField: 'X', yField: 'Y', floorField: 'FLOOR_ID', floorPolicy: 'explicit' }],
};

function pair(value: unknown): [string, string] {
  return Array.isArray(value) ? [expression(value[0]), expression(value[1])] : ['', ''];
}
function writePair(event: Record<string, unknown>, key: string, x: string, y: string): void {
  if (x !== '' || y !== '') event[key] = [expressionValue(x), expressionValue(y)];
}
const moveDefinition = (type: string, relative: boolean): BlockSchema['definition'] => ({
  ...statementDefinition, type, colour: 'auto',
  message0: `移动某点怪物属性 起点 x %1 y %2 ${relative ? '增量 dx' : '终点 x'} %3 ${relative ? 'dy' : 'y'} %4 楼层 %5 不刷新显伤 %6`,
  args0: [
    { type: 'field_input', name: 'FROM_X', text: '' }, { type: 'field_input', name: 'FROM_Y', text: '' },
    { type: 'field_input', name: 'TARGET_X', text: '' }, { type: 'field_input', name: 'TARGET_Y', text: '' },
    { type: 'field_input', name: 'FLOOR_ID', text: '' },
    { type: 'field_checkbox', name: 'NO_REFRESH', checked: false },
  ],
});
function moveGenerator(relative: boolean) {
  return (block: Blockly.Block): string => {
    const event: Record<string, unknown> = { type: 'moveEnemyOnPoint' };
    writePair(event, 'from', block.getFieldValue('FROM_X'), block.getFieldValue('FROM_Y'));
    writePair(event, relative ? 'dxy' : 'to', block.getFieldValue('TARGET_X'), block.getFieldValue('TARGET_Y'));
    const floorId = block.getFieldValue('FLOOR_ID');
    if (floorId) event.floorId = floorId;
    if (checkbox(block, 'NO_REFRESH')) event.norefresh = true;
    return generated(event);
  };
}

export const moveEnemyOnPointSchema: BlockSchema = {
  eventType: 'moveEnemyOnPoint', category: 'data', definition: moveDefinition('mota_moveEnemyOnPoint_s', false),
  parser: (event: EventObject) => {
    const relative = Array.isArray(event.dxy);
    const from = pair(event.from); const target = pair(relative ? event.dxy : event.to);
    return { type: relative ? 'mota_moveEnemyOnPoint_1_s' : 'mota_moveEnemyOnPoint_s', fields: {
      FROM_X: from[0], FROM_Y: from[1], TARGET_X: target[0], TARGET_Y: target[1],
      FLOOR_ID: expression(event.floorId), NO_REFRESH: event.norefresh === true,
    } };
  },
  generator: moveGenerator(false),
  interactions: [{ type: 'autocomplete', field: 'FLOOR_ID', source: 'floor' }],
};

export const moveEnemyOnPointRelativeSchema: BlockSchema = {
  eventType: '_moveEnemyOnPointRelative', category: 'data', definition: moveDefinition('mota_moveEnemyOnPoint_1_s', true),
  parser: () => ({ type: 'mota_moveEnemyOnPoint_1_s' }), generator: moveGenerator(true),
  interactions: [{ type: 'autocomplete', field: 'FLOOR_ID', source: 'floor' }],
};

export const legacyDataSchemas: BlockSchema[] = [
  followSchema, unfollowSchema, loadEquipSchema, unloadEquipSchema, setEquipSchema,
  resetEnemyOnPointSchema, moveEnemyOnPointSchema, moveEnemyOnPointRelativeSchema,
];
