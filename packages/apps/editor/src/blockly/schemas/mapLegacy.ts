import type * as Blockly from 'blockly';

import type { BlockSchema } from '../registry';
import type { EventObject } from '../parser/types';
import {
  checkbox,
  expression,
  expressionValue,
  generateMultiLoc,
  generated,
  locationState,
  optionalExpression,
  statementDefinition,
} from './legacyHelpers';

type LocationKind =
  | 'setBlockOpacity'
  | 'setBlockFilter'
  | 'turnBlock'
  | 'showFloorImg'
  | 'hideFloorImg'
  | 'showBgFgMap'
  | 'hideBgFgMap'
  | 'setBgFgBlock';

const directionOptions: Array<[string, string]> = [
  ['不改变', ''],
  ['上', 'up'],
  ['下', 'down'],
  ['左', 'left'],
  ['右', 'right'],
  ['左转', ':left'],
  ['右转', ':right'],
  ['后转', ':back'],
];

function locationSchema(
  eventType: LocationKind,
  message0: string,
  args0: NonNullable<BlockSchema['definition']['args0']>,
  parseFields: (event: EventObject) => Record<string, unknown>,
  writeFields: (block: Blockly.Block, event: Record<string, unknown>) => void,
): BlockSchema {
  return {
    eventType,
    category: 'map',
    definition: {
      ...statementDefinition,
      type: `mota_${eventType}_s`,
      message0,
      args0: [
        { type: 'field_input', name: 'X', text: '' },
        { type: 'field_input', name: 'Y', text: '' },
        { type: 'field_input', name: 'FLOOR_ID', text: '' },
        ...args0,
      ],
      colour: 'auto',
      tooltip: `${eventType}：地图位置事件`,
    },
    parser: (event) =>
      locationState(`mota_${eventType}_s`, event, {
        FLOOR_ID: expression(event.floorId),
        ...parseFields(event),
      }),
    generator: (block) => {
      const event: Record<string, unknown> = { type: eventType };
      const loc = generateMultiLoc(block.getFieldValue('X'), block.getFieldValue('Y'));
      if (loc !== undefined) event.loc = loc;
      const floorId = block.getFieldValue('FLOOR_ID');
      if (floorId) event.floorId = floorId;
      writeFields(block, event);
      return generated(event);
    },
  };
}

export const setBlockOpacitySchema = locationSchema(
  'setBlockOpacity',
  '设置图块不透明度 x %1 y %2 楼层 %3 不透明度 %4 动画时间 %5 不等待 %6',
  [
    { type: 'field_number', name: 'OPACITY', value: 1, min: 0, max: 1 },
    { type: 'field_input', name: 'TIME', text: '' },
    { type: 'field_checkbox', name: 'ASYNC', checked: false },
  ],
  (event) => ({ OPACITY: event.opacity ?? 1, TIME: expression(event.time), ASYNC: event.async === true }),
  (block, event) => {
    event.opacity = Number(block.getFieldValue('OPACITY'));
    optionalExpression(event, 'time', block.getFieldValue('TIME'));
    if (checkbox(block, 'ASYNC')) event.async = true;
  },
);

export const setBlockFilterSchema = locationSchema(
  'setBlockFilter',
  '设置图块特效 x %1 y %2 楼层 %3 虚化 %4 色相 %5 灰度 %6 反色 %7 阴影 %8',
  [
    { type: 'field_number', name: 'BLUR', value: 0, min: 0 },
    { type: 'field_number', name: 'HUE', value: 0, min: 0, max: 359, precision: 1 },
    { type: 'field_number', name: 'GRAYSCALE', value: 0, min: 0, max: 1 },
    { type: 'field_checkbox', name: 'INVERT', checked: false },
    { type: 'field_number', name: 'SHADOW', value: 0, min: 0 },
  ],
  (event) => ({
    BLUR: event.blur ?? 0,
    HUE: event.hue ?? 0,
    GRAYSCALE: event.grayscale ?? 0,
    INVERT: event.invert === true,
    SHADOW: event.shadow ?? 0,
  }),
  (block, event) => {
    event.blur = Number(block.getFieldValue('BLUR'));
    event.hue = Number(block.getFieldValue('HUE'));
    event.grayscale = Number(block.getFieldValue('GRAYSCALE'));
    event.invert = checkbox(block, 'INVERT');
    event.shadow = Number(block.getFieldValue('SHADOW'));
  },
);

export const turnBlockSchema = locationSchema(
  'turnBlock',
  '事件转向 x %1 y %2 楼层 %3 方向 %4',
  [{ type: 'field_dropdown', name: 'DIRECTION', options: directionOptions }],
  (event) => ({ DIRECTION: event.direction ?? '' }),
  (block, event) => {
    const value = block.getFieldValue('DIRECTION');
    if (value) event.direction = value;
  },
);

const floorImage = (eventType: 'showFloorImg' | 'hideFloorImg', label: string) =>
  locationSchema(
    eventType,
    `${label} x %1 y %2 楼层 %3`,
    [],
    () => ({}),
    () => {},
  );
export const showFloorImgSchema = floorImage('showFloorImg', '显示楼层贴图');
export const hideFloorImgSchema = floorImage('hideFloorImg', '隐藏楼层贴图');

const bgFg = (eventType: 'showBgFgMap' | 'hideBgFgMap', label: string) =>
  locationSchema(
    eventType,
    `${label} x %1 y %2 楼层 %3 图层 %4`,
    [
      {
        type: 'field_dropdown',
        name: 'NAME',
        options: [
          ['背景层', 'bg'],
          ['前景层', 'fg'],
        ],
      },
    ],
    (event) => ({ NAME: event.name ?? 'bg' }),
    (block, event) => {
      event.name = block.getFieldValue('NAME');
    },
  );
export const showBgFgMapSchema = bgFg('showBgFgMap', '显示图层块');
export const hideBgFgMapSchema = bgFg('hideBgFgMap', '隐藏图层块');

export const setBgFgBlockSchema = locationSchema(
  'setBgFgBlock',
  '设置图层块 x %1 y %2 楼层 %3 图层 %4 图块 %5',
  [
    {
      type: 'field_dropdown',
      name: 'NAME',
      options: [
        ['背景层', 'bg'],
        ['前景层', 'fg'],
      ],
    },
    { type: 'field_input', name: 'NUMBER', text: '0' },
  ],
  (event) => ({ NAME: event.name ?? 'bg', NUMBER: expression(event.number) }),
  (block, event) => {
    event.name = block.getFieldValue('NAME');
    event.number = expressionValue(block.getFieldValue('NUMBER'));
  },
);

export const legacyMapSchemas: BlockSchema[] = [
  setBlockOpacitySchema,
  setBlockFilterSchema,
  turnBlockSchema,
  showFloorImgSchema,
  hideFloorImgSchema,
  showBgFgMapSchema,
  hideBgFgMapSchema,
  setBgFgBlockSchema,
];
