import type * as Blockly from 'blockly';
import { javascriptGenerator } from 'blockly/javascript';
import JSON5 from 'json5';

import type { BlockState, EventData, ParseContext } from '../parser/types';
import type { BlockSchema, MaterialKind } from '../registry/types';
import { parseEventList } from '../registry/utils';

type RecordValue = Record<string, unknown>;

const SYSTEM_SOUND_OPTIONS: [string, string][] = [
  '确定',
  '取消',
  '操作失败',
  '光标移动',
  '打开界面',
  '读档',
  '存档',
  '获得道具',
  '回血',
  '宝石',
  '炸弹',
  '飞行器',
  '开关门',
  '上下楼',
  '跳跃',
  '破墙镐',
  '破冰镐',
  '阻激夹域',
  '穿脱装备',
  '商店',
].map((value) => [value, value]);
const SYSTEM_SOUND_KEYS = new Set(SYSTEM_SOUND_OPTIONS.map(([, value]) => value));
const EQUIP_OPTIONS: [string, string][] = [
  ['生命', 'hp'],
  ['生命上限', 'hpmax'],
  ['攻击', 'atk'],
  ['防御', 'def'],
  ['护盾', 'mdef'],
  ['魔力', 'mana'],
  ['魔力上限', 'manamax'],
];
const EQUIP_KEYS = new Set(EQUIP_OPTIONS.map(([, value]) => value));
const DOOR_KEY_OPTIONS: [string, string][] = [
  ['黄钥匙', 'yellowKey'],
  ['蓝钥匙', 'blueKey'],
  ['红钥匙', 'redKey'],
  ['绿钥匙', 'greenKey'],
  ['铁门钥匙', 'steelKey'],
];
const KNOWN_DOOR_KEYS = new Set(DOOR_KEY_OPTIONS.map(([, value]) => value));

function record(value: unknown): RecordValue {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as RecordValue) : {};
}

function chain(blocks: BlockState[]): BlockState | undefined {
  blocks.forEach((block, index) => {
    if (blocks[index + 1]) block.next = { block: blocks[index + 1] };
  });
  return blocks[0];
}

function statementInput(block?: BlockState): { block?: BlockState } {
  return block ? { block } : {};
}

function scalar(value: unknown): string | number {
  if (typeof value === 'number') return value;
  const text = String(value ?? '');
  return /^[+-]?\d+(?:\.\d+)?$/.test(text.trim()) ? Number(text) : text;
}

function parseColour(value: unknown): string {
  return Array.isArray(value) ? value.join(',') : '';
}

function colourValue(value: unknown): number[] | undefined {
  const parts = String(value ?? '')
    .split(',')
    .map((item) => Number(item.trim()));
  return parts.length >= 3 && parts.every(Number.isFinite) ? parts : undefined;
}

function itemSchema(options: {
  type: string;
  eventType: string;
  connection: string;
  message0: string;
  args0: NonNullable<BlockSchema['definition']['args0']>;
  message1?: string;
  args1?: NonNullable<BlockSchema['definition']['args0']>;
  generator: (block: Blockly.Block) => string;
  interactions?: BlockSchema['interactions'];
}): BlockSchema {
  return {
    eventType: options.eventType,
    definition: {
      type: options.type,
      message0: options.message0,
      args0: options.args0,
      ...(options.message1 ? { message1: options.message1, args1: options.args1 } : {}),
      previousStatement: options.connection,
      nextStatement: options.connection,
      colour: 'auto',
      tooltip: '',
      helpUrl: '/_docs/#/instruction',
    },
    category: 'entry',
    generator: options.generator,
    interactions: options.interactions,
    defaultInteraction: options.interactions?.[0]?.type,
  };
}

export const rawEntrySchema: BlockSchema = {
  eventType: 'entry:_raw',
  definition: {
    type: 'mota_rawEntry_m',
    message0: '未识别入口 %1',
    args0: [{ type: 'field_input', name: 'ENTRY_TYPE', text: 'unknown' }],
    message1: '%1',
    args1: [{ type: 'field_multilinetext', name: 'JSON_DATA', text: '{}' }],
    colour: 'auto',
    tooltip: '未识别的入口类型，原始 JSON 将被无损保留',
    helpUrl: '',
  },
  category: 'entry',
  generator: (block) => String(block.getFieldValue('JSON_DATA') ?? 'null'),
};

function doorKeySchema(known: boolean): BlockSchema {
  return itemSchema({
    type: known ? 'mota_doorKeyKnown' : 'mota_doorKeyUnknown',
    eventType: known ? '_doorKeyKnown' : '_doorKeyUnknown',
    connection: 'doorKey',
    message0: '%1 : %2 需要但不消耗 %3',
    args0: [
      known
        ? { type: 'field_dropdown', name: 'KEY', options: DOOR_KEY_OPTIONS }
        : { type: 'field_input', name: 'KEY', text: 'orangeKey' },
      { type: 'field_number', name: 'AMOUNT', value: 1, min: 0, precision: 1 },
      { type: 'field_checkbox', name: 'NO_CONSUME', checked: false },
    ],
    generator: (block) => {
      const key = String(block.getFieldValue('KEY') ?? '');
      const amount = Number(block.getFieldValue('AMOUNT')) || 0;
      const suffix = block.getFieldValue('NO_CONSUME') === 'TRUE' ? ':o' : '';
      return `${JSON.stringify(key + suffix)}: ${amount},\n`;
    },
  });
}

export const doorKeyKnownSchema = doorKeySchema(true);
export const doorKeyUnknownSchema = doorKeySchema(false);

function buildDoorKeyBlocks(keys: RecordValue): BlockState | undefined {
  return chain(
    Object.entries(keys)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([rawKey, rawAmount]) => {
        const noConsume = rawKey.endsWith(':o');
        const key = noConsume ? rawKey.slice(0, -2) : rawKey;
        return {
          type: KNOWN_DOOR_KEYS.has(key) ? 'mota_doorKeyKnown' : 'mota_doorKeyUnknown',
          fields: { KEY: key, AMOUNT: Number(rawAmount) || 0, NO_CONSUME: noConsume },
        };
      }),
  );
}

/** 门信息由动态钥匙列表和开门后事件组成，需要专用双向 codec。 */
export const doorInfoEntrySchema: BlockSchema = {
  eventType: 'entry:doorInfo',
  definition: {
    type: 'mota_doorInfo_m',
    message0: '门信息 开关门时间 %1 开门音效 %2 关门音效 %3',
    args0: [
      { type: 'field_number', name: 'TIME', value: 160, min: 0, precision: 1 },
      { type: 'field_input', name: 'OPEN_SOUND', text: 'door.mp3' },
      { type: 'field_input', name: 'CLOSE_SOUND', text: 'door.mp3' },
    ],
    message1: '需要钥匙 %1',
    args1: [{ type: 'input_statement', name: 'KEYS', check: 'doorKey' }],
    message2: '如需撞到开门还需要把图块触发器改成 openDoor',
    message3: '开门后事件 %1',
    args3: [{ type: 'input_statement', name: 'AFTER_OPEN_DOOR' }],
    colour: 'auto',
    tooltip: '开门信息',
    helpUrl: '/_docs/#/instruction',
  },
  category: 'entry',
  parser: (value: unknown, context) => {
    const info = record(value);
    return {
      type: 'mota_doorInfo_m',
      fields: {
        TIME: Number(info.time) || 160,
        OPEN_SOUND: typeof info.openSound === 'string' ? info.openSound : '',
        CLOSE_SOUND: typeof info.closeSound === 'string' ? info.closeSound : '',
      },
      inputs: {
        KEYS: statementInput(buildDoorKeyBlocks(record(info.keys))),
        AFTER_OPEN_DOOR: statementInput(
          parseEventList(Array.isArray(info.afterOpenDoor) ? (info.afterOpenDoor as EventData[]) : [], context) ??
            undefined,
        ),
      },
    };
  },
  generator: (block) => {
    const time = Number(block.getFieldValue('TIME')) || 160;
    const openSound = String(block.getFieldValue('OPEN_SOUND') ?? '');
    const closeSound = String(block.getFieldValue('CLOSE_SOUND') ?? '');
    const keys = javascriptGenerator.statementToCode(block, 'KEYS').trim().replace(/,\s*$/, '');
    const afterOpenDoor = javascriptGenerator.statementToCode(block, 'AFTER_OPEN_DOOR');
    const fields = [
      `"time": ${time}`,
      ...(openSound ? [`"openSound": ${JSON.stringify(openSound)}`] : []),
      ...(closeSound ? [`"closeSound": ${JSON.stringify(closeSound)}`] : []),
      `"keys": {${keys ? `\n${keys}\n` : ''}}`,
      ...(afterOpenDoor.trim() ? [`"afterOpenDoor": [\n${afterOpenDoor}]`] : []),
    ];
    return `{${fields.join(',\n')}}\n`;
  },
};

export const levelChooseItemSchema = itemSchema({
  type: 'mota_levelChooseItem',
  eventType: '_levelChooseItem',
  connection: 'levelChooseItem',
  message0: '难度分歧项 名称 %1 简写 %2 变量:hard值 %3 颜色 %4 %5',
  args0: [
    { type: 'field_input', name: 'TITLE', text: '简单' },
    { type: 'field_input', name: 'NAME', text: 'Easy' },
    { type: 'field_number', name: 'HARD', value: 1, min: 0, precision: 1 },
    { type: 'field_input', name: 'COLOR', text: '' },
    { type: 'field_colour', name: 'COLOR_PICKER', colour: '#ffffff' },
  ],
  message1: '执行 %1',
  args1: [{ type: 'input_statement', name: 'ACTION' }],
  interactions: [{ type: 'colourBinding', textField: 'COLOR', colourField: 'COLOR_PICKER' }],
  generator: (block) => {
    const color = colourValue(block.getFieldValue('COLOR'));
    const action = javascriptGenerator.statementToCode(block, 'ACTION');
    return `${JSON.stringify({
      title: String(block.getFieldValue('TITLE') ?? ''),
      name: String(block.getFieldValue('NAME') ?? ''),
      hard: Number(block.getFieldValue('HARD')) || 0,
      ...(color ? { color } : {}),
      action: JSON5.parse(`[${action}]`),
    })},\n`;
  },
});

export const levelChooseEntrySchema: BlockSchema = {
  eventType: 'entry:levelChoose',
  definition: {
    type: 'mota_levelChoose_m',
    message0: '难度分歧 %1',
    args0: [{ type: 'input_statement', name: 'ITEMS', check: 'levelChooseItem' }],
    colour: 'auto',
    tooltip: '难度分歧',
    helpUrl: '/_docs/#/instruction',
  },
  category: 'entry',
  parser: (value: unknown, context) => ({
    type: 'mota_levelChoose_m',
    inputs: {
      ITEMS: statementInput(
        chain(
          (Array.isArray(value) ? value : []).map((raw): BlockState => {
            const item = record(raw);
            return {
              type: 'mota_levelChooseItem',
              fields: {
                TITLE: item.title ?? '',
                NAME: item.name ?? '',
                HARD: item.hard ?? 0,
                COLOR: parseColour(item.color),
              },
              inputs: {
                ACTION: statementInput(
                  parseEventList(Array.isArray(item.action) ? (item.action as EventData[]) : [], context) ?? undefined,
                ),
              },
            };
          }),
        ),
      ),
    },
  }),
  generator: (block) => `[\n${javascriptGenerator.statementToCode(block, 'ITEMS')}]\n`,
};

export const floorPartitionItemSchema = itemSchema({
  type: 'mota_floorPartitionItem',
  eventType: '_floorPartitionItem',
  connection: 'floorPartitionItem',
  message0: '分区项 起始楼层ID %1 终止楼层ID（不填代表到最后一层） %2',
  args0: [
    { type: 'field_input', name: 'START', text: 'MTx' },
    { type: 'field_input', name: 'END', text: '' },
  ],
  generator: (block) =>
    `${JSON.stringify([
      String(block.getFieldValue('START') ?? ''),
      ...(String(block.getFieldValue('END') ?? '') ? [String(block.getFieldValue('END'))] : []),
    ])},\n`,
});

export const floorPartitionEntrySchema: BlockSchema = {
  eventType: 'entry:floorPartition',
  definition: {
    type: 'mota_floorPartition_m',
    message0: '高层塔分区管理 %1',
    args0: [{ type: 'input_statement', name: 'ITEMS', check: 'floorPartitionItem' }],
    colour: 'auto',
    tooltip: '高层塔分区管理',
    helpUrl: '/_docs/#/instruction',
  },
  category: 'entry',
  parser: (value: unknown) => ({
    type: 'mota_floorPartition_m',
    inputs: {
      ITEMS: statementInput(
        chain(
          (Array.isArray(value) ? value : []).map((item) => ({
            type: 'mota_floorPartitionItem',
            fields: {
              START: Array.isArray(item) ? (item[0] ?? '') : '',
              END: Array.isArray(item) ? (item[1] ?? '') : '',
            },
          })),
        ),
      ),
    },
  }),
  generator: (block) => `[\n${javascriptGenerator.statementToCode(block, 'ITEMS')}]\n`,
};

function equipItemSchema(known: boolean): BlockSchema {
  return itemSchema({
    type: known ? 'mota_equipKnown' : 'mota_equipUnknown',
    eventType: known ? '_equipKnown' : '_equipUnknown',
    connection: 'equipItem',
    message0: '%1 : %2',
    args0: [
      known
        ? { type: 'field_dropdown', name: 'KEY', options: EQUIP_OPTIONS }
        : { type: 'field_input', name: 'KEY', text: 'speed' },
      { type: 'field_input', name: 'VALUE', text: '10' },
    ],
    generator: (block) =>
      `${JSON.stringify(String(block.getFieldValue('KEY') ?? ''))}: ${JSON.stringify(scalar(block.getFieldValue('VALUE')))},\n`,
  });
}

export const equipKnownSchema = equipItemSchema(true);
export const equipUnknownSchema = equipItemSchema(false);

function equipBlocks(value: unknown): BlockState | undefined {
  return chain(
    Object.entries(record(value))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => ({
        type: EQUIP_KEYS.has(key) ? 'mota_equipKnown' : 'mota_equipUnknown',
        fields: { KEY: key, VALUE: String(item) },
      })),
  );
}

export const equipEntrySchema: BlockSchema = {
  eventType: 'entry:equip',
  definition: {
    type: 'mota_equip_m',
    message0: '装备 类型 %1 装备动画（第一个装备格有效） %2',
    args0: [
      { type: 'field_input', name: 'TYPE', text: '0' },
      { type: 'field_input', name: 'ANIMATE', text: '' },
    ],
    message1: '数值提升项 %1',
    args1: [{ type: 'input_statement', name: 'VALUE', check: 'equipItem' }],
    message2: '百分比提升项 %1',
    args2: [{ type: 'input_statement', name: 'PERCENTAGE', check: 'equipItem' }],
    message3: '穿上时事件 %1',
    args3: [{ type: 'input_statement', name: 'EQUIP_EVENT' }],
    message4: '脱下时事件 %1',
    args4: [{ type: 'input_statement', name: 'UNEQUIP_EVENT' }],
    message5: '此道具cls须为equips并设置canUseItemEffect',
    colour: 'auto',
    tooltip: '装备',
    helpUrl: '/_docs/#/instruction',
  },
  category: 'entry',
  interactions: [
    { type: 'selectMaterial', field: 'ANIMATE', materialKind: 'animate', transform: 'strip-animate-extension' },
  ],
  parser: (value: unknown, context) => {
    const item = record(value);
    return {
      type: 'mota_equip_m',
      fields: { TYPE: String(item.type ?? 0), ANIMATE: item.animate ?? '' },
      inputs: {
        VALUE: statementInput(equipBlocks(item.value)),
        PERCENTAGE: statementInput(equipBlocks(item.percentage)),
        EQUIP_EVENT: statementInput(
          parseEventList(Array.isArray(item.equipEvent) ? (item.equipEvent as EventData[]) : [], context) ?? undefined,
        ),
        UNEQUIP_EVENT: statementInput(
          parseEventList(Array.isArray(item.unequipEvent) ? (item.unequipEvent as EventData[]) : [], context) ??
            undefined,
        ),
      },
    };
  },
  generator: (block) => {
    const parseMap = (name: string) => JSON5.parse(`{${javascriptGenerator.statementToCode(block, name)}}`);
    const equipEvent = javascriptGenerator.statementToCode(block, 'EQUIP_EVENT');
    const unequipEvent = javascriptGenerator.statementToCode(block, 'UNEQUIP_EVENT');
    return JSON.stringify({
      type: scalar(block.getFieldValue('TYPE')),
      ...(String(block.getFieldValue('ANIMATE') ?? '') ? { animate: String(block.getFieldValue('ANIMATE')) } : {}),
      value: parseMap('VALUE'),
      percentage: parseMap('PERCENTAGE'),
      ...(equipEvent.trim() ? { equipEvent: JSON5.parse(`[${equipEvent}]`) } : {}),
      ...(unequipEvent.trim() ? { unequipEvent: JSON5.parse(`[${unequipEvent}]`) } : {}),
    });
  },
};

export const floorImageItemSchema = itemSchema({
  type: 'mota_floorImageItem',
  eventType: '_floorImageItem',
  connection: 'floorImageItem',
  message0: '图片名 %1 翻转 %2 图层 %3 绘制坐标 x %4 y %5 初始禁用 %6',
  args0: [
    { type: 'field_input', name: 'NAME', text: 'bg.jpg' },
    {
      type: 'field_dropdown',
      name: 'REVERSE',
      options: [
        ['不翻转', ''],
        ['水平', ':x'],
        ['垂直', ':y'],
        ['中心', ':o'],
      ],
    },
    {
      type: 'field_dropdown',
      name: 'CANVAS',
      options: [
        ['背景层', 'bg'],
        ['前景层', 'fg'],
      ],
    },
    { type: 'field_number', name: 'X', value: 0 },
    { type: 'field_number', name: 'Y', value: 0 },
    { type: 'field_checkbox', name: 'DISABLE', checked: false },
  ],
  message1: '裁剪起点坐标 x %1 y %2 宽 %3 高 %4 帧数 %5',
  args1: ['SX', 'SY', 'W', 'H', 'FRAME'].map((name) => ({ type: 'field_input', name, text: '' })),
  interactions: [
    { type: 'preview', adapter: 'floorImage' },
    { type: 'selectMaterial', field: 'NAME', materialKind: 'image', aliasPolicy: 'preserve' },
  ],
  generator: (block) => {
    const optionalNumber = (name: string) => {
      const value = String(block.getFieldValue(name) ?? '');
      return value === '' ? undefined : Number(value);
    };
    return `${JSON.stringify({
      name: String(block.getFieldValue('NAME') ?? ''),
      ...(String(block.getFieldValue('REVERSE') ?? '') ? { reverse: String(block.getFieldValue('REVERSE')) } : {}),
      canvas: String(block.getFieldValue('CANVAS') ?? 'bg'),
      x: Number(block.getFieldValue('X')) || 0,
      y: Number(block.getFieldValue('Y')) || 0,
      ...(block.getFieldValue('DISABLE') === 'TRUE' ? { disable: true } : {}),
      ...Object.fromEntries(
        ['SX', 'SY', 'W', 'H', 'FRAME'].flatMap((name) => {
          const value = optionalNumber(name);
          return value === undefined ? [] : [[name.toLowerCase(), value]];
        }),
      ),
    })},\n`;
  },
});

export const floorImageEntrySchema: BlockSchema = {
  eventType: 'entry:floorImage',
  definition: {
    type: 'mota_floorImage_m',
    message0: '楼层贴图 %1',
    args0: [{ type: 'input_statement', name: 'ITEMS', check: 'floorImageItem' }],
    colour: 'auto',
    tooltip: '楼层贴图',
    helpUrl: '/_docs/#/instruction',
  },
  category: 'entry',
  parser: (value: unknown) => ({
    type: 'mota_floorImage_m',
    inputs: {
      ITEMS: statementInput(
        chain(
          (Array.isArray(value) ? value : []).map((raw) => {
            const item = record(raw);
            return {
              type: 'mota_floorImageItem',
              fields: {
                NAME: item.name ?? '',
                REVERSE: item.reverse ?? '',
                CANVAS: item.canvas ?? 'bg',
                X: item.x ?? 0,
                Y: item.y ?? 0,
                DISABLE: item.disable === true,
                SX: item.sx ?? '',
                SY: item.sy ?? '',
                W: item.w ?? '',
                H: item.h ?? '',
                FRAME: item.frame ?? '',
              },
            };
          }),
        ),
      ),
    },
  }),
  generator: (block) => `[\n${javascriptGenerator.statementToCode(block, 'ITEMS')}]\n`,
};

export const faceIdsEntrySchema: BlockSchema = {
  eventType: 'entry:faceIds',
  definition: {
    type: 'mota_faceIds_m',
    message0: '行走图朝向',
    message1: '向下ID %1 向左ID %2 向右ID %3 向上ID %4',
    args1: ['DOWN', 'LEFT', 'RIGHT', 'UP'].map((name) => ({ type: 'field_input', name, text: '' })),
    colour: 'auto',
    tooltip: '行走图朝向',
    helpUrl: '/_docs/#/instruction',
  },
  category: 'entry',
  parser: (value: unknown) => {
    const item = record(value);
    return {
      type: 'mota_faceIds_m',
      fields: { DOWN: item.down ?? '', LEFT: item.left ?? '', RIGHT: item.right ?? '', UP: item.up ?? '' },
    };
  },
  generator: (block) =>
    JSON.stringify(
      Object.fromEntries(
        [
          ['down', block.getFieldValue('DOWN')],
          ['left', block.getFieldValue('LEFT')],
          ['right', block.getFieldValue('RIGHT')],
          ['up', block.getFieldValue('UP')],
        ].filter(([, value]) => String(value ?? '') !== ''),
      ),
    ),
};

export const splitImageItemSchema = itemSchema({
  type: 'mota_splitImageItem',
  eventType: '_splitImageItem',
  connection: 'splitImageItem',
  message0: '图片切分项 图片名 %1 每个小图宽度 %2 高度 %3 生成小图的前缀 %4',
  args0: [
    { type: 'field_input', name: 'NAME', text: 'hero.png' },
    { type: 'field_number', name: 'WIDTH', value: 32, min: 1, precision: 1 },
    { type: 'field_number', name: 'HEIGHT', value: 32, min: 1, precision: 1 },
    { type: 'field_input', name: 'PREFIX', text: 'hero_' },
  ],
  interactions: [{ type: 'selectMaterial', field: 'NAME', materialKind: 'image', aliasPolicy: 'preserve' }],
  generator: (block) =>
    `${JSON.stringify({
      name: String(block.getFieldValue('NAME') ?? ''),
      width: Number(block.getFieldValue('WIDTH')) || 0,
      height: Number(block.getFieldValue('HEIGHT')) || 0,
      prefix: String(block.getFieldValue('PREFIX') ?? ''),
    })},\n`,
});

export const splitImagesEntrySchema: BlockSchema = {
  eventType: 'entry:splitImages',
  definition: {
    type: 'mota_splitImages_m',
    message0: '图片切分（你可以将一张png格式的大图切分为若干小图） %1',
    args0: [{ type: 'input_statement', name: 'ITEMS', check: 'splitImageItem' }],
    colour: 'auto',
    tooltip: '图片裁剪',
    helpUrl: '/_docs/#/instruction',
  },
  category: 'entry',
  parser: (value: unknown) => ({
    type: 'mota_splitImages_m',
    inputs: {
      ITEMS: statementInput(
        chain(
          (Array.isArray(value) ? value : []).map((raw) => {
            const item = record(raw);
            return {
              type: 'mota_splitImageItem',
              fields: {
                NAME: item.name ?? '',
                WIDTH: item.width ?? 32,
                HEIGHT: item.height ?? 32,
                PREFIX: item.prefix ?? '',
              },
            };
          }),
        ),
      ),
    },
  }),
  generator: (block) => `[\n${javascriptGenerator.statementToCode(block, 'ITEMS')}]\n`,
};

const STYLE_FIELDS: Array<[string, string]> = [
  ['START_BACKGROUND', 'startBackground'],
  ['START_VERTICAL_BACKGROUND', 'startVerticalBackground'],
  ['START_LOGO_STYLE', 'startLogoStyle'],
  ['START_BUTTONS_STYLE', 'startButtonsStyle'],
  ['STATUS_LEFT_BACKGROUND', 'statusLeftBackground'],
  ['STATUS_TOP_BACKGROUND', 'statusTopBackground'],
  ['TOOLS_BACKGROUND', 'toolsBackground'],
  ['FLOOR_CHANGING_STYLE', 'floorChangingStyle'],
  ['FONT', 'font'],
];
const STYLE_COLOURS: Array<[string, string]> = [
  ['STATUS_BAR_COLOR', 'statusBarColor'],
  ['BORDER_COLOR', 'borderColor'],
  ['SELECT_COLOR', 'selectColor'],
];

export const mainStyleEntrySchema: BlockSchema = {
  eventType: 'entry:mainStyle',
  definition: {
    type: 'mota_mainStyle_m',
    message0: '主要样式设置',
    message1: '标题界面背景图 %1',
    args1: [{ type: 'field_input', name: 'START_BACKGROUND', text: '' }],
    message2: '竖屏标题界面背景图 %1',
    args2: [{ type: 'field_input', name: 'START_VERTICAL_BACKGROUND', text: '' }],
    message3: '标题样式；可写 display: none 隐藏标题 %1',
    args3: [{ type: 'field_input', name: 'START_LOGO_STYLE', text: '' }],
    message4: '标题按钮样式 %1',
    args4: [{ type: 'field_input', name: 'START_BUTTONS_STYLE', text: '' }],
    message5: '横屏状态栏背景 %1',
    args5: [{ type: 'field_input', name: 'STATUS_LEFT_BACKGROUND', text: '' }],
    message6: '竖屏状态栏背景 %1',
    args6: [{ type: 'field_input', name: 'STATUS_TOP_BACKGROUND', text: '' }],
    message7: '竖屏工具栏背景 %1',
    args7: [{ type: 'field_input', name: 'TOOLS_BACKGROUND', text: '' }],
    message8: '楼层切换样式 %1',
    args8: [{ type: 'field_input', name: 'FLOOR_CHANGING_STYLE', text: '' }],
    message9: '全局字体 %1',
    args9: [{ type: 'field_input', name: 'FONT', text: '' }],
    message10: '状态栏颜色 %1 %2 边框颜色 %3 %4 选中框颜色 %5 %6',
    args10: STYLE_COLOURS.flatMap(([field]) => [
      { type: 'field_input', name: field, text: '' },
      { type: 'field_colour', name: `${field}_PICKER`, colour: '#ffffff' },
    ]),
    colour: 'auto',
    tooltip: '主要样式设置',
    helpUrl: '/_docs/#/instruction',
  },
  category: 'entry',
  interactions: STYLE_COLOURS.map(([field]) => ({
    type: 'colourBinding' as const,
    textField: field,
    colourField: `${field}_PICKER`,
  })),
  parser: (value: unknown) => {
    const item = record(value);
    return {
      type: 'mota_mainStyle_m',
      fields: Object.fromEntries([
        ...STYLE_FIELDS.map(([field, key]) => [field, item[key] ?? '']),
        ...STYLE_COLOURS.map(([field, key]) => [field, parseColour(item[key])]),
      ]),
    };
  },
  generator: (block) =>
    JSON.stringify(
      Object.fromEntries([
        ...STYLE_FIELDS.flatMap(([field, key]) => {
          const value = String(block.getFieldValue(field) ?? '');
          return value === '' ? [] : [[key, value]];
        }),
        ...STYLE_COLOURS.flatMap(([field, key]) => {
          const value = colourValue(block.getFieldValue(field));
          return value ? [[key, value]] : [];
        }),
      ]),
    ),
};

type NameMapKind = 'systemSound' | 'sound' | 'bgm' | 'image' | 'animate' | 'unknown';
const NAME_MAP_TYPES: Record<NameMapKind, string> = {
  systemSound: 'mota_nameMapSystemSound',
  sound: 'mota_nameMapSound',
  bgm: 'mota_nameMapBgm',
  image: 'mota_nameMapImage',
  animate: 'mota_nameMapAnimate',
  unknown: 'mota_nameMapUnknown',
};

function nameMapKind(key: string, value: string, context: ParseContext): NameMapKind {
  if (SYSTEM_SOUND_KEYS.has(key)) return 'systemSound';
  if (context.project?.bgms.includes(value)) return 'bgm';
  if (context.project?.sounds.includes(value)) return 'sound';
  if (context.project?.images.includes(value)) return 'image';
  if (context.project?.animates.includes(value)) return 'animate';
  return 'unknown';
}

function nameMapItemSchema(kind: NameMapKind, label: string, materialKind?: MaterialKind): BlockSchema {
  const system = kind === 'systemSound';
  return itemSchema({
    type: NAME_MAP_TYPES[kind],
    eventType: `_nameMap:${kind}`,
    connection: 'nameMapItem',
    message0: `${label} 名称 %1 映射到文件 %2`,
    args0: [
      system
        ? { type: 'field_dropdown', name: 'KEY', options: SYSTEM_SOUND_OPTIONS }
        : { type: 'field_input', name: 'KEY', text: '文件名' },
      { type: 'field_input', name: 'VALUE', text: '' },
    ],
    interactions: materialKind
      ? [
          {
            type: 'selectMaterial',
            field: 'VALUE',
            materialKind,
            ...(kind === 'animate' ? { transform: 'strip-animate-extension' as const } : {}),
            aliasPolicy: 'physical-name',
          },
        ]
      : undefined,
    generator: (block) =>
      `${JSON.stringify(String(block.getFieldValue('KEY') ?? ''))}: ${JSON.stringify(String(block.getFieldValue('VALUE') ?? ''))},\n`,
  });
}

export const nameMapSystemSoundSchema = nameMapItemSchema('systemSound', '映射系统音效', 'sound');
export const nameMapSoundSchema = nameMapItemSchema('sound', '映射音效', 'sound');
export const nameMapBgmSchema = nameMapItemSchema('bgm', '映射背景音乐', 'bgm');
export const nameMapImageSchema = nameMapItemSchema('image', '映射图片', 'image');
export const nameMapAnimateSchema = nameMapItemSchema('animate', '映射动画', 'animate');
export const nameMapUnknownSchema = nameMapItemSchema('unknown', '未知映射');

export const nameMapEntrySchema: BlockSchema = {
  eventType: 'entry:nameMap',
  definition: {
    type: 'mota_nameMap_m',
    message0: '文件别名设置（可以游戏中使用此别名代替原始文件名） %1',
    args0: [{ type: 'input_statement', name: 'ITEMS', check: 'nameMapItem' }],
    colour: 'auto',
    tooltip: '文件别名设置',
    helpUrl: '/_docs/#/instruction',
  },
  category: 'entry',
  parser: (value: unknown, context) => ({
    type: 'mota_nameMap_m',
    inputs: {
      ITEMS: statementInput(
        chain(
          Object.entries(record(value)).map(([key, rawValue]) => {
            const item = String(rawValue ?? '');
            return { type: NAME_MAP_TYPES[nameMapKind(key, item, context)], fields: { KEY: key, VALUE: item } };
          }),
        ),
      ),
    },
  }),
  generator: (block) => `{${javascriptGenerator.statementToCode(block, 'ITEMS')}}`,
};

export const projectEntrySchemas: BlockSchema[] = [
  rawEntrySchema,
  doorInfoEntrySchema,
  doorKeyKnownSchema,
  doorKeyUnknownSchema,
  levelChooseEntrySchema,
  levelChooseItemSchema,
  floorPartitionEntrySchema,
  floorPartitionItemSchema,
  equipEntrySchema,
  equipKnownSchema,
  equipUnknownSchema,
  floorImageEntrySchema,
  floorImageItemSchema,
  faceIdsEntrySchema,
  splitImagesEntrySchema,
  splitImageItemSchema,
  mainStyleEntrySchema,
  nameMapEntrySchema,
  nameMapSystemSoundSchema,
  nameMapSoundSchema,
  nameMapBgmSchema,
  nameMapImageSchema,
  nameMapAnimateSchema,
  nameMapUnknownSchema,
];
