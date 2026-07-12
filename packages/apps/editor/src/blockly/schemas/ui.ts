import type { BlockBinding, BlockSchema } from '../registry';
import { legacyUiSchemas } from './uiLegacy';

const UI_COLOUR = 359;
const DATA_COLOUR = 130;

function field(input: string, path: string, options: Partial<BlockBinding> = {}): BlockBinding {
  return { input, path, kind: 'field', optional: true, ...options };
}

function uiSchema(
  eventType: string,
  type: string,
  message0: string,
  args0: BlockSchema['definition']['args0'],
  bindings: BlockBinding[],
  options: Partial<BlockSchema['definition']> = {},
): BlockSchema {
  return {
    eventType,
    definition: {
      type,
      message0,
      args0,
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: UI_COLOUR,
      tooltip: `${eventType}：UI 绘制事件`,
      helpUrl: '/_docs/#/instruction',
      ...options,
    },
    category: 'ui',
    event: {
      match: { path: 'type', equals: eventType },
      template: { type: eventType },
      bindings,
    },
    interactions: [{ type: 'preview', adapter: 'event' }],
    defaultInteraction: 'preview',
  };
}

export const previewUISchema: BlockSchema = uiSchema(
  'previewUI',
  'mota_previewUI_s',
  'ui绘制并预览（双击此项可进行预览）',
  [],
  [{ input: 'ACTION', path: 'action', kind: 'statement', default: [] }],
  {
    message1: '%1',
    args1: [{ type: 'input_statement', name: 'ACTION' }],
    inputsInline: false,
  },
);

export const clearMapSchema = uiSchema(
  'clearMap',
  'mota_clearMap_s',
  '清除画布 起点像素 x %1 y %2 宽 %3 高 %4',
  [
    { type: 'field_input', name: 'X', text: '' },
    { type: 'field_input', name: 'Y', text: '' },
    { type: 'field_input', name: 'WIDTH', text: '' },
    { type: 'field_input', name: 'HEIGHT', text: '' },
  ],
  [
    field('X', 'x', { valueType: 'expression' }),
    field('Y', 'y', { valueType: 'expression' }),
    field('WIDTH', 'width', { valueType: 'expression' }),
    field('HEIGHT', 'height', { valueType: 'expression' }),
  ],
);

export const setAttributeSchema = uiSchema(
  'setAttribute',
  'mota_setAttribute_s',
  '设置画布属性 字体 %1 填充样式 %2 %3 边框样式 %4 %5 线宽度 %6 不透明度 %7 对齐 %8 基准线 %9 z值 %10',
  [
    { type: 'field_input', name: 'FONT', text: '' },
    { type: 'field_input', name: 'FILL_STYLE', text: '' },
    { type: 'field_colour', name: 'FILL_COLOUR', colour: '#ffffff' },
    { type: 'field_input', name: 'STROKE_STYLE', text: '' },
    { type: 'field_colour', name: 'STROKE_COLOUR', colour: '#ffffff' },
    { type: 'field_input', name: 'LINE_WIDTH', text: '' },
    { type: 'field_input', name: 'ALPHA', text: '' },
    { type: 'field_dropdown', name: 'ALIGN', options: [['不改变', 'null'], ['左对齐', 'left'], ['左右居中', 'center'], ['右对齐', 'right']] },
    { type: 'field_dropdown', name: 'BASELINE', options: [['不改变', 'null'], ['顶部', 'top'], ['悬挂', 'hanging'], ['居中', 'middle'], ['标准值', 'alphabetic'], ['ideographic', 'ideographic'], ['底部', 'bottom']] },
    { type: 'field_input', name: 'Z', text: '' },
  ],
  [
    field('FONT', 'font', { valueType: 'string' }),
    field('FILL_STYLE', 'fillStyle', { valueType: 'colour' }),
    field('STROKE_STYLE', 'strokeStyle', { valueType: 'colour' }),
    field('LINE_WIDTH', 'lineWidth', { valueType: 'number' }),
    field('ALPHA', 'alpha', { valueType: 'number' }),
    field('ALIGN', 'align', { default: 'null', omitWhenDefault: true }),
    field('BASELINE', 'baseline', { default: 'null', omitWhenDefault: true }),
    field('Z', 'z', { valueType: 'number' }),
  ],
);

export const fillBoldTextSchema = uiSchema(
  'fillBoldText',
  'mota_fillBoldText_s',
  '绘制描边文本 x %1 y %2 样式 %3 %4 描边颜色 %5 %6 字体 %7 %8',
  [
    { type: 'field_input', name: 'X', text: '0' },
    { type: 'field_input', name: 'Y', text: '0' },
    { type: 'field_input', name: 'STYLE', text: '' },
    { type: 'field_colour', name: 'STYLE_COLOUR', colour: '#ffffff' },
    { type: 'field_input', name: 'STROKE_STYLE', text: '' },
    { type: 'field_colour', name: 'STROKE_COLOUR', colour: '#000000' },
    { type: 'field_input', name: 'FONT', text: '' },
    { type: 'field_input', name: 'TEXT', text: '绘制一行描边文本' },
  ],
  [
    field('X', 'x', { valueType: 'expression' }), field('Y', 'y', { valueType: 'expression' }),
    field('STYLE', 'style', { valueType: 'colour' }), field('STROKE_STYLE', 'strokeStyle', { valueType: 'colour' }),
    field('FONT', 'font', { valueType: 'string' }), field('TEXT', 'text', { valueType: 'string', optional: false }),
  ],
);

function rectSchema(eventType: 'fillRect' | 'strokeRect'): BlockSchema {
  const stroke = eventType === 'strokeRect';
  const args: NonNullable<BlockSchema['definition']['args0']> = [
    { type: 'field_input', name: 'X', text: '0' }, { type: 'field_input', name: 'Y', text: '0' },
    { type: 'field_input', name: 'WIDTH', text: 'flag:x' }, { type: 'field_input', name: 'HEIGHT', text: '300' },
    { type: 'field_input', name: 'RADIUS', text: '' }, { type: 'field_input', name: 'ANGLE', text: '' },
    { type: 'field_input', name: 'STYLE', text: '' }, { type: 'field_colour', name: 'STYLE_COLOUR', colour: '#ffffff' },
  ];
  if (stroke) args.push({ type: 'field_input', name: 'LINE_WIDTH', text: '' });
  return uiSchema(
    eventType,
    `mota_${eventType}_s`,
    `${stroke ? '绘制矩形边框' : '绘制矩形'} 起点像素 x %1 y %2 宽 %3 高 %4 圆角半径 %5 旋转度数 %6 颜色 %7 %8${stroke ? ' 线宽 %9' : ''}`,
    args,
    [
      field('X', 'x', { valueType: 'expression', optional: false }), field('Y', 'y', { valueType: 'expression', optional: false }),
      field('WIDTH', 'width', { valueType: 'expression', optional: false }), field('HEIGHT', 'height', { valueType: 'expression', optional: false }),
      field('RADIUS', 'radius', { valueType: 'expression' }), field('ANGLE', 'angle', { valueType: 'expression' }),
      field('STYLE', 'style', { valueType: 'colour' }),
      ...(stroke ? [field('LINE_WIDTH', 'lineWidth', { valueType: 'number' })] : []),
    ],
  );
}

export const fillRectSchema = rectSchema('fillRect');
export const strokeRectSchema = rectSchema('strokeRect');

export const drawIconSchema = uiSchema(
  'drawIcon',
  'mota_drawIcon_s',
  '绘制图标 ID %1 帧 %2 起点像素 x %3 y %4 宽 %5 高 %6',
  [
    { type: 'field_input', name: 'ID', text: 'yellowKey' }, { type: 'field_number', name: 'FRAME', value: 0, min: 0, precision: 1 },
    { type: 'field_input', name: 'X', text: '0' }, { type: 'field_input', name: 'Y', text: '0' },
    { type: 'field_input', name: 'WIDTH', text: '' }, { type: 'field_input', name: 'HEIGHT', text: '' },
  ],
  [
    field('ID', 'id', { valueType: 'string', optional: false }), field('FRAME', 'frame', { valueType: 'number', default: 0, omitWhenDefault: true }),
    field('X', 'x', { valueType: 'expression', optional: false }), field('Y', 'y', { valueType: 'expression', optional: false }),
    field('WIDTH', 'width', { valueType: 'expression' }), field('HEIGHT', 'height', { valueType: 'expression' }),
  ],
);

export const drawBackgroundSchema = uiSchema(
  'drawBackground',
  'mota_drawBackground_s',
  '绘制背景图 %1 %2 起点像素 x %3 y %4 宽 %5 高 %6',
  [
    { type: 'field_input', name: 'BACKGROUND', text: 'winskin.png' }, { type: 'field_colour', name: 'BACKGROUND_COLOUR', colour: '#ffffff' },
    { type: 'field_input', name: 'X', text: '0' }, { type: 'field_input', name: 'Y', text: '0' },
    { type: 'field_input', name: 'WIDTH', text: '100' }, { type: 'field_input', name: 'HEIGHT', text: '100' },
  ],
  [
    field('BACKGROUND', 'background', { valueType: 'json-or-string', optional: false }),
    field('X', 'x', { valueType: 'expression', optional: false }), field('Y', 'y', { valueType: 'expression', optional: false }),
    field('WIDTH', 'width', { valueType: 'expression', optional: false }), field('HEIGHT', 'height', { valueType: 'expression', optional: false }),
  ],
);

export const drawSelectorSchema = uiSchema(
  'drawSelector',
  'mota_drawSelector_s',
  '绘制或清除闪烁光标 图片 %1 编号 %2 起点像素 x %3 y %4 宽 %5 高 %6',
  [
    { type: 'field_input', name: 'IMAGE', text: '' }, { type: 'field_number', name: 'CODE', value: 1, min: 0, precision: 1 },
    { type: 'field_input', name: 'X', text: '' }, { type: 'field_input', name: 'Y', text: '' },
    { type: 'field_input', name: 'WIDTH', text: '' }, { type: 'field_input', name: 'HEIGHT', text: '' },
  ],
  [
    field('IMAGE', 'image', { valueType: 'string' }), field('CODE', 'code', { valueType: 'number', optional: false }),
    field('X', 'x', { valueType: 'expression' }), field('Y', 'y', { valueType: 'expression' }),
    field('WIDTH', 'width', { valueType: 'expression' }), field('HEIGHT', 'height', { valueType: 'expression' }),
  ],
);

export const moveActionSchema: BlockSchema = {
  eventType: 'moveAction',
  definition: { type: 'mota_moveAction_s', message0: '勇士前进一格或撞击', inputsInline: true, previousStatement: null, nextStatement: null, colour: DATA_COLOUR, tooltip: 'moveAction：前进一格或撞击', helpUrl: '/_docs/#/instruction' },
  category: 'data',
  event: { match: { path: 'type', equals: 'moveAction' }, template: { type: 'moveAction' }, bindings: [] },
};

export const setHeroIconSchema: BlockSchema = {
  eventType: 'setHeroIcon',
  definition: {
    type: 'mota_setHeroIcon_s', message0: '更改角色行走图 %1 不重绘 %2',
    args0: [{ type: 'field_input', name: 'NAME', text: 'hero.png' }, { type: 'field_checkbox', name: 'NO_DRAW', checked: false }],
    inputsInline: true, previousStatement: null, nextStatement: null, colour: DATA_COLOUR,
    tooltip: 'setHeroIcon：更改角色行走图', helpUrl: '/_docs/#/instruction',
  },
  category: 'data',
  event: {
    match: { path: 'type', equals: 'setHeroIcon' }, template: { type: 'setHeroIcon' },
    bindings: [field('NAME', 'name', { valueType: 'string' }), field('NO_DRAW', 'noDraw', { valueType: 'boolean', default: false, omitWhenDefault: true })],
  },
  interactions: [{
    type: 'selectMaterial',
    field: 'NAME',
    materialKind: 'hero',
    aliasPolicy: 'preserve',
  }],
  defaultInteraction: 'selectMaterial',
};

export const uiSchemas: BlockSchema[] = [
  previewUISchema, clearMapSchema, setAttributeSchema, fillBoldTextSchema,
  fillRectSchema, strokeRectSchema, drawIconSchema, drawBackgroundSchema,
  drawSelectorSchema, moveActionSchema, setHeroIconSchema,
  ...legacyUiSchemas,
];
