import type * as Blockly from 'blockly';

import type { BlockBinding, BlockSchema } from '../registry';
import {
  declarativeSchema, expression, expressionValue, field, generated, optionalExpression, statementDefinition,
} from './legacyHelpers';

function uiSchema(
  eventType: string,
  message0: string,
  args0: NonNullable<BlockSchema['definition']['args0']>,
  bindings: BlockBinding[],
  extra: Partial<BlockSchema> = {},
): BlockSchema {
  return declarativeSchema(eventType, 'ui', {
    type: `mota_${eventType}_s`, message0, args0, colour: 359,
  }, bindings, {
    interactions: [{ type: 'preview', adapter: 'event' }], defaultInteraction: 'preview', ...extra,
  });
}

const expr = (input: string, path: string, required = false) => field(input, path, {
  valueType: 'expression', optional: !required,
});
const colour = (input: string, path: string) => field(input, path, { valueType: 'colour' });

export const setFilterSchema = uiSchema('setFilter',
  '设置画布特效 虚化 %1 色相 %2 灰度 %3 反色 %4 阴影 %5', [
    { type: 'field_number', name: 'BLUR', value: 0, min: 0 },
    { type: 'field_number', name: 'HUE', value: 0, min: 0, max: 359, precision: 1 },
    { type: 'field_number', name: 'GRAYSCALE', value: 0, min: 0, max: 1 },
    { type: 'field_checkbox', name: 'INVERT', checked: false },
    { type: 'field_number', name: 'SHADOW', value: 0, min: 0 },
  ], [
    field('BLUR', 'blur', { valueType: 'number', optional: false }),
    field('HUE', 'hue', { valueType: 'number', optional: false }),
    field('GRAYSCALE', 'grayscale', { valueType: 'number', optional: false }),
    field('INVERT', 'invert', { valueType: 'boolean', optional: false }),
    field('SHADOW', 'shadow', { valueType: 'number', optional: false }),
  ]);

export const fillTextSchema = uiSchema('fillText',
  '绘制文本 x %1 y %2 样式 %3 %4 字体 %5 最大宽度 %6 文本 %7', [
    { type: 'field_input', name: 'X', text: '0' }, { type: 'field_input', name: 'Y', text: '0' },
    { type: 'field_input', name: 'STYLE', text: '' }, { type: 'field_colour', name: 'STYLE_COLOUR', colour: '#ffffff' },
    { type: 'field_input', name: 'FONT', text: '' }, { type: 'field_input', name: 'MAX_WIDTH', text: '' },
    { type: 'field_input', name: 'TEXT', text: '绘制一行文本' },
  ], [expr('X', 'x', true), expr('Y', 'y', true), colour('STYLE', 'style'),
    field('FONT', 'font', { valueType: 'string' }), expr('MAX_WIDTH', 'maxWidth'),
    field('TEXT', 'text', { valueType: 'string', optional: false })]);

export const drawTextContentSchema = uiSchema('drawTextContent',
  '绘制多行文本 %1 起点像素 x %2 y %3 最大宽度 %4 颜色 %5 %6 对齐 %7 字体大小 %8 行距 %9 粗体 %10', [
    { type: 'field_multilinetext', name: 'TEXT', text: '' },
    { type: 'field_input', name: 'LEFT', text: '0' }, { type: 'field_input', name: 'TOP', text: '0' },
    { type: 'field_input', name: 'MAX_WIDTH', text: '' },
    { type: 'field_input', name: 'COLOR', text: '' }, { type: 'field_colour', name: 'COLOR_PICKER', colour: '#ffffff' },
    { type: 'field_dropdown', name: 'ALIGN', options: [['不设置', 'null'], ['左对齐', 'left'], ['居中', 'center'], ['右对齐', 'right']] },
    { type: 'field_input', name: 'FONT_SIZE', text: '' }, { type: 'field_input', name: 'LINE_HEIGHT', text: '' },
    { type: 'field_checkbox', name: 'BOLD', checked: false },
  ], [
    field('TEXT', 'text', { valueType: 'string', optional: false }), expr('LEFT', 'left', true), expr('TOP', 'top', true),
    expr('MAX_WIDTH', 'maxWidth'), colour('COLOR', 'color'),
    field('ALIGN', 'align', { default: 'null', omitWhenDefault: true }), expr('FONT_SIZE', 'fontSize'),
    expr('LINE_HEIGHT', 'lineHeight'), field('BOLD', 'bold', { valueType: 'boolean', default: false, omitWhenDefault: true }),
  ], { interactions: [
    { type: 'editText', field: 'TEXT', mode: 'multiline' }, { type: 'preview', adapter: 'event' },
    { type: 'colourBinding', textField: 'COLOR', colourField: 'COLOR_PICKER' },
  ], defaultInteraction: 'preview' });

function lineSchema(eventType: 'drawLine' | 'drawArrow'): BlockSchema {
  return uiSchema(eventType,
    `${eventType === 'drawLine' ? '绘制线段' : '绘制箭头'} 起点 x %1 y %2 终点 x %3 y %4 颜色 %5 %6 线宽 %7`, [
      { type: 'field_input', name: 'X1', text: '0' }, { type: 'field_input', name: 'Y1', text: '0' },
      { type: 'field_input', name: 'X2', text: '0' }, { type: 'field_input', name: 'Y2', text: '0' },
      { type: 'field_input', name: 'STYLE', text: '' }, { type: 'field_colour', name: 'STYLE_COLOUR', colour: '#ffffff' },
      { type: 'field_input', name: 'LINE_WIDTH', text: '' },
    ], [expr('X1', 'x1', true), expr('Y1', 'y1', true), expr('X2', 'x2', true), expr('Y2', 'y2', true),
      colour('STYLE', 'style'), expr('LINE_WIDTH', 'lineWidth')]);
}
export const drawLineSchema = lineSchema('drawLine');
export const drawArrowSchema = lineSchema('drawArrow');

function polygonState(type: string, event: Record<string, unknown>, stroke: boolean) {
  const nodes = Array.isArray(event.nodes) ? event.nodes as unknown[][] : [];
  return { type, fields: {
    XS: nodes.map((node) => expression(node[0])).join(','),
    YS: nodes.map((node) => expression(node[1])).join(','),
    STYLE: Array.isArray(event.style) ? event.style.join(',') : expression(event.style),
    ...(stroke ? { LINE_WIDTH: expression(event.lineWidth) } : {}),
  } };
}
function polygonGenerator(eventType: 'fillPolygon' | 'strokePolygon') {
  return (block: Blockly.Block): string => {
    const xs = String(block.getFieldValue('XS')).split(','); const ys = String(block.getFieldValue('YS')).split(',');
    if (xs.length !== ys.length || (xs.length === 1 && !xs[0] && !ys[0])) throw new Error('多边形 x 和 y 顶点数量必须一致且不能为空');
    const event: Record<string, unknown> = { type: eventType, nodes: xs.map((x, index) => [expressionValue(x), expressionValue(ys[index])]) };
    const style = block.getFieldValue('STYLE'); if (style) event.style = style.split(',').map(expressionValue);
    if (eventType === 'strokePolygon') optionalExpression(event, 'lineWidth', block.getFieldValue('LINE_WIDTH'));
    return generated(event);
  };
}
function polygonSchema(eventType: 'fillPolygon' | 'strokePolygon'): BlockSchema {
  const stroke = eventType === 'strokePolygon';
  return {
    eventType, category: 'ui', definition: {
      ...statementDefinition, type: `mota_${eventType}_s`, colour: 359,
      message0: `${stroke ? '绘制多边形边框' : '绘制多边形'} 顶点 x %1 y %2 颜色 %3 %4${stroke ? ' 线宽 %5' : ''}`,
      args0: [
        { type: 'field_input', name: 'XS', text: '0,0,100' }, { type: 'field_input', name: 'YS', text: '0,100,0' },
        { type: 'field_input', name: 'STYLE', text: '' }, { type: 'field_colour', name: 'STYLE_COLOUR', colour: '#ffffff' },
        ...(stroke ? [{ type: 'field_input' as const, name: 'LINE_WIDTH', text: '' }] : []),
      ],
    },
    parser: (event) => polygonState(`mota_${eventType}_s`, event, stroke), generator: polygonGenerator(eventType),
    interactions: [{ type: 'preview', adapter: 'event' }, { type: 'colourBinding', textField: 'STYLE', colourField: 'STYLE_COLOUR' }],
    defaultInteraction: 'preview',
  };
}
export const fillPolygonSchema = polygonSchema('fillPolygon');
export const strokePolygonSchema = polygonSchema('strokePolygon');

function shapeSchema(eventType: 'fillEllipse' | 'strokeEllipse' | 'fillArc' | 'strokeArc'): BlockSchema {
  const arc = eventType.endsWith('Arc'); const stroke = eventType.startsWith('stroke');
  const labels = arc ? ['半径', '起点角度', '终点角度'] : ['长半径', '短半径', '旋转角度'];
  const paths = arc ? ['r', 'start', 'end'] : ['a', 'b', 'angle'];
  return uiSchema(eventType,
    `${stroke ? '绘制边框' : '绘制'}${arc ? '弧形' : '椭圆'} 中心 x %1 y %2 ${labels[0]} %3 ${labels[1]} %4 ${labels[2]} %5 颜色 %6 %7${stroke ? ' 线宽 %8' : ''}`, [
      { type: 'field_input', name: 'X', text: '0' }, { type: 'field_input', name: 'Y', text: '0' },
      { type: 'field_input', name: 'P1', text: '100' }, { type: 'field_input', name: 'P2', text: arc ? '0' : '100' },
      { type: 'field_input', name: 'P3', text: arc ? '90' : '' },
      { type: 'field_input', name: 'STYLE', text: '' }, { type: 'field_colour', name: 'STYLE_COLOUR', colour: '#ffffff' },
      ...(stroke ? [{ type: 'field_input' as const, name: 'LINE_WIDTH', text: '' }] : []),
    ], [expr('X', 'x', true), expr('Y', 'y', true), expr('P1', paths[0], true), expr('P2', paths[1], true),
      expr('P3', paths[2], arc), colour('STYLE', 'style'), ...(stroke ? [expr('LINE_WIDTH', 'lineWidth')] : [])]);
}
export const fillEllipseSchema = shapeSchema('fillEllipse');
export const strokeEllipseSchema = shapeSchema('strokeEllipse');
export const fillArcSchema = shapeSchema('fillArc');
export const strokeArcSchema = shapeSchema('strokeArc');

export const drawImageSchema: BlockSchema = {
  eventType: 'drawImage', category: 'ui', definition: {
    ...statementDefinition, type: 'mota_drawImage_s', colour: 359, inputsInline: false,
    message0: '绘制图片 %1 翻转 %2', args0: [
      { type: 'field_input', name: 'IMAGE', text: 'bg.jpg' },
      { type: 'field_dropdown', name: 'REVERSE', options: [['不翻转', 'null'], ['上下翻转', 'y'], ['左右翻转', 'x'], ['中心翻转', 'o']] },
    ],
    message1: '图片区域 x %1 y %2 宽 %3 高 %4', args1: [
      { type: 'field_input', name: 'X', text: '0' }, { type: 'field_input', name: 'Y', text: '0' },
      { type: 'field_input', name: 'W', text: '' }, { type: 'field_input', name: 'H', text: '' },
    ],
    message2: '裁剪区域 x %1 y %2 宽 %3 高 %4 旋转 %5', args2: [
      { type: 'field_input', name: 'X1', text: '' }, { type: 'field_input', name: 'Y1', text: '' },
      { type: 'field_input', name: 'W1', text: '' }, { type: 'field_input', name: 'H1', text: '' },
      { type: 'field_input', name: 'ANGLE', text: '' },
    ],
  },
  parser: (event) => ({ type: 'mota_drawImage_s', fields: {
    IMAGE: expression(event.image), REVERSE: event.reverse ?? 'null',
    X: expression(event.x), Y: expression(event.y), W: expression(event.w), H: expression(event.h),
    X1: expression(event.x1), Y1: expression(event.y1), W1: expression(event.w1), H1: expression(event.h1),
    ANGLE: expression(event.angle),
  } }),
  generator: (block) => {
    const event: Record<string, unknown> = { type: 'drawImage', image: block.getFieldValue('IMAGE') };
    const reverse = block.getFieldValue('REVERSE'); if (reverse !== 'null') event.reverse = reverse;
    for (const [fieldName, key] of [['X', 'x'], ['Y', 'y'], ['W', 'w'], ['H', 'h'], ['X1', 'x1'], ['Y1', 'y1'], ['W1', 'w1'], ['H1', 'h1'], ['ANGLE', 'angle']] as const) {
      optionalExpression(event, key, block.getFieldValue(fieldName));
    }
    const crop = ['x1', 'y1', 'w1', 'h1'];
    const present = crop.filter((key) => key in event);
    if (present.length > 0 && present.length < crop.length) throw new Error('裁剪图片必须同时填写 x、y、宽和高');
    return generated(event);
  },
  interactions: [
    { type: 'selectMaterial', field: 'IMAGE', materialKind: 'image', aliasPolicy: 'preserve' },
    { type: 'autocomplete', field: 'IMAGE', source: 'image' }, { type: 'preview', adapter: 'event' },
  ], defaultInteraction: 'preview',
};

export const legacyUiSchemas: BlockSchema[] = [
  setFilterSchema, fillTextSchema, drawTextContentSchema, drawLineSchema, drawArrowSchema,
  fillPolygonSchema, strokePolygonSchema, fillEllipseSchema, strokeEllipseSchema,
  fillArcSchema, strokeArcSchema, drawImageSchema,
];
