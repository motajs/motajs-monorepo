import type { BlockSchema } from '../registry';
import {
  checkbox, declarativeSchema, expression, expressionValue, field, generated,
  optionalExpression, statementDefinition,
} from './legacyHelpers';

const moveModes: Array<[string, string]> = [
  ['匀速', ''], ['加速', 'easeIn'], ['减速', 'easeOut'], ['快慢快', 'easeInOut'],
  ['随机', 'random'],
];

export const loadBgmSchema = declarativeSchema('loadBgm', 'effect', {
  type: 'mota_loadBgm_s', message0: '预加载背景音乐 %1',
  args0: [{ type: 'field_input', name: 'NAME', text: 'bgm.mp3' }], colour: 20,
}, [field('NAME', 'name', { valueType: 'string', optional: false })], {
  interactions: [
    { type: 'selectMaterial', field: 'NAME', materialKind: 'bgm', aliasPolicy: 'preserve' },
    { type: 'autocomplete', field: 'NAME', source: 'bgm' },
  ],
});

export const freeBgmSchema = declarativeSchema('freeBgm', 'effect', {
  type: 'mota_freeBgm_s', message0: '释放背景音乐缓存 %1',
  args0: [{ type: 'field_input', name: 'NAME', text: 'bgm.mp3' }], colour: 20,
}, [field('NAME', 'name', { valueType: 'string', optional: false })], {
  interactions: [
    { type: 'selectMaterial', field: 'NAME', materialKind: 'bgm', aliasPolicy: 'preserve' },
    { type: 'autocomplete', field: 'NAME', source: 'bgm' },
  ],
});

export const setBgmSpeedSchema = declarativeSchema('setBgmSpeed', 'effect', {
  type: 'mota_setBgmSpeed_s', message0: '设置背景音乐播放速度 %1 同时改变音调 %2',
  args0: [
    { type: 'field_number', name: 'VALUE', value: 100, min: 30, max: 300, precision: 1 },
    { type: 'field_checkbox', name: 'PITCH', checked: true },
  ], colour: 20,
}, [
  field('VALUE', 'value', { valueType: 'number', optional: false }),
  field('PITCH', 'pitch', { valueType: 'boolean', default: false, omitWhenDefault: true }),
]);

function pair(value: unknown): [string, string] {
  return Array.isArray(value) ? [expression(value[0]), expression(value[1])] : ['', ''];
}
function writePair(event: Record<string, unknown>, key: string, x: string, y: string): void {
  if (x !== '' || y !== '') event[key] = [expressionValue(x), expressionValue(y)];
}

export const showTextImageSchema: BlockSchema = {
  eventType: 'showTextImage', category: 'effect',
  definition: {
    ...statementDefinition, type: 'mota_showTextImage_s', colour: 20, inputsInline: false,
    message0: '显示图片化文本 %1',
    args0: [{ type: 'field_multilinetext', name: 'TEXT', text: '' }],
    message1: '编号 %1 起点像素 x %2 y %3 行高 %4 翻转 %5 不透明度 %6 时间 %7 不等待 %8',
    args1: [
      { type: 'field_number', name: 'CODE', value: 1, min: 0, precision: 1 },
      { type: 'field_input', name: 'X', text: '' }, { type: 'field_input', name: 'Y', text: '' },
      { type: 'field_number', name: 'LINE_HEIGHT', value: 1.4, min: 0 },
      { type: 'field_dropdown', name: 'REVERSE', options: [['不翻转', 'null'], ['上下翻转', 'y'], ['左右翻转', 'x'], ['中心翻转', 'o']] },
      { type: 'field_input', name: 'OPACITY', text: '' }, { type: 'field_input', name: 'TIME', text: '' },
      { type: 'field_checkbox', name: 'ASYNC', checked: false },
    ],
  },
  parser: (event) => {
    const loc = pair(event.loc);
    return { type: 'mota_showTextImage_s', fields: {
      TEXT: expression(event.text), CODE: event.code ?? 1, X: loc[0], Y: loc[1],
      LINE_HEIGHT: event.lineHeight ?? 1.4, REVERSE: event.reverse ?? 'null',
      OPACITY: expression(event.opacity), TIME: expression(event.time), ASYNC: event.async === true,
    } };
  },
  generator: (block) => {
    const event: Record<string, unknown> = {
      type: 'showTextImage', text: block.getFieldValue('TEXT'), code: Number(block.getFieldValue('CODE')),
    };
    writePair(event, 'loc', block.getFieldValue('X'), block.getFieldValue('Y'));
    const lineHeight = Number(block.getFieldValue('LINE_HEIGHT')); if (lineHeight !== 1.4) event.lineHeight = lineHeight;
    const reverse = block.getFieldValue('REVERSE'); if (reverse !== 'null') event.reverse = reverse;
    optionalExpression(event, 'opacity', block.getFieldValue('OPACITY'));
    optionalExpression(event, 'time', block.getFieldValue('TIME'));
    if (checkbox(block, 'ASYNC')) event.async = true;
    return generated(event);
  },
  interactions: [{ type: 'editText', field: 'TEXT', mode: 'multiline' }, { type: 'preview', adapter: 'event' }],
  defaultInteraction: 'preview',
};

function transformImageSchema(eventType: 'rotateImage' | 'scaleImage'): BlockSchema {
  const rotate = eventType === 'rotateImage';
  return {
    eventType, category: 'effect',
    definition: {
      ...statementDefinition, type: `mota_${eventType}_s`, colour: 20,
      message0: `${rotate ? '图片旋转' : '图片放缩'} 编号 %1 中心点 x %2 y %3 移动方式 %4 ${rotate ? '角度' : '比例'} %5 时间 %6 不等待 %7`,
      args0: [
        { type: 'field_number', name: 'CODE', value: 1, min: 0, precision: 1 },
        { type: 'field_input', name: 'X', text: '' }, { type: 'field_input', name: 'Y', text: '' },
        { type: 'field_dropdown', name: 'MOVE_MODE', options: moveModes },
        { type: 'field_number', name: 'AMOUNT', value: rotate ? 90 : 0.8 },
        { type: 'field_number', name: 'TIME', value: rotate ? 500 : 0, min: 0 },
        { type: 'field_checkbox', name: 'ASYNC', checked: false },
      ],
    },
    parser: (event) => {
      const center = pair(event.center);
      return { type: `mota_${eventType}_s`, fields: {
        CODE: event.code ?? 1, X: center[0], Y: center[1], MOVE_MODE: event.moveMode ?? '',
        AMOUNT: event[rotate ? 'angle' : 'scale'] ?? (rotate ? 90 : 0.8),
        TIME: event.time ?? (rotate ? 500 : 0), ASYNC: event.async === true,
      } };
    },
    generator: (block) => {
      const event: Record<string, unknown> = {
        type: eventType, code: Number(block.getFieldValue('CODE')),
        [rotate ? 'angle' : 'scale']: Number(block.getFieldValue('AMOUNT')),
        time: Number(block.getFieldValue('TIME')),
      };
      writePair(event, 'center', block.getFieldValue('X'), block.getFieldValue('Y'));
      const mode = block.getFieldValue('MOVE_MODE'); if (mode) event.moveMode = mode;
      if (checkbox(block, 'ASYNC')) event.async = true;
      return generated(event);
    },
  };
}
export const rotateImageSchema = transformImageSchema('rotateImage');
export const scaleImageSchema = transformImageSchema('scaleImage');

export const showGifSchema: BlockSchema = {
  eventType: 'showGif', category: 'effect',
  definition: {
    ...statementDefinition, type: 'mota_showGif_s', colour: 20,
    message0: '显示或清除 GIF %1 起点像素 x %2 y %3',
    args0: [
      { type: 'field_input', name: 'NAME', text: '' },
      { type: 'field_input', name: 'X', text: '' }, { type: 'field_input', name: 'Y', text: '' },
    ],
  },
  parser: (event) => { const loc = pair(event.loc); return { type: 'mota_showGif_s', fields: {
    NAME: expression(event.name), X: loc[0], Y: loc[1],
  } }; },
  generator: (block) => {
    const event: Record<string, unknown> = { type: 'showGif' };
    const name = block.getFieldValue('NAME'); if (name) event.name = name;
    writePair(event, 'loc', block.getFieldValue('X'), block.getFieldValue('Y'));
    return generated(event);
  },
  interactions: [{ type: 'selectMaterial', field: 'NAME', materialKind: 'image', aliasPolicy: 'preserve' }, { type: 'preview', adapter: 'event' }],
  defaultInteraction: 'preview',
};

export const legacyEffectSchemas: BlockSchema[] = [
  loadBgmSchema, freeBgmSchema, setBgmSpeedSchema, showTextImageSchema,
  rotateImageSchema, scaleImageSchema, showGifSchema,
];
