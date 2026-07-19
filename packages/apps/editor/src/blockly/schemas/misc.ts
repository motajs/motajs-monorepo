/**
 * 其他事件块 Schema
 *
 * 包含 trigger, insert, function, viewport, showImage, useItem 等其他事件块
 */

import type * as Blockly from 'blockly';
import { javascriptGenerator, Order } from 'blockly/javascript';
import JSON5 from 'json5';

import type {
  BlockState,
  ConnectionState,
  EventData,
  EventObject,
  ParseContext,
} from '../parser/types';
import type { BlockSchema } from '../registry/types';
import { createExpressionBlock, parseEventList } from '../registry/utils';
import { checkbox, expression, expressionValue } from './legacyHelpers';

// ============================================
// trigger 块
// ============================================

/**
 * 触发事件块
 * 对应事件: { type: "trigger", loc: [x, y] }
 */
export const triggerSchema: BlockSchema = {
  eventType: 'trigger',
  definition: {
    type: 'mota_trigger_s',
    message0: '触发事件 位置 [%1,%2]',
    args0: [
      { type: 'field_input', name: 'X', text: '' },
      { type: 'field_input', name: 'Y', text: '' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (330)
    tooltip: '触发某个位置的事件。位置为空表示当前位置',
    helpUrl: '',
  },
  category: 'misc',
  parser: (event: EventObject, _context: ParseContext): BlockState => {
    const loc = event.loc as unknown[] | undefined;
    return {
      type: 'mota_trigger_s',
      fields: {
        X: loc?.[0]?.toString() || '',
        Y: loc?.[1]?.toString() || '',
      },
    };
  },
  generator: (block: Blockly.Block): string => {
    const x = block.getFieldValue('X');
    const y = block.getFieldValue('Y');

    const event: Record<string, unknown> = { type: 'trigger' };

    if (x || y) {
      event.loc = [expressionValue(x), expressionValue(y)];
    }

    return JSON.stringify(event) + ',\n';
  },
};

// ============================================
// insert 块
// ============================================

/**
 * 插入公共事件块
 * 对应事件: { type: "insert", name: "...", args: [...] }
 */
export const insertSchema: BlockSchema = {
  eventType: 'insert',
  definition: {
    type: 'mota_insert_s',
    message0: '插入 %1 公共事件 %2 位置 [%3,%4] 类型 %5 楼层 %6',
    args0: [
      { type: 'field_dropdown', name: 'MODE', options: [['公共事件', 'common'], ['坐标事件', 'point']] },
      { type: 'field_input', name: 'NAME', text: '' },
      { type: 'field_input', name: 'X', text: '' },
      { type: 'field_input', name: 'Y', text: '' },
      { type: 'field_input', name: 'WHICH', text: '' },
      { type: 'field_input', name: 'FLOOR_ID', text: '' },
    ],
    message1: '参数列表 JSON %1',
    args1: [
      { type: 'field_input', name: 'ARGS', text: '' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (330)
    tooltip: '插入一个公共事件。参数为逗号分隔的值',
    helpUrl: '',
  },
  category: 'misc',
  parser: (event: EventObject, _context: ParseContext): BlockState => {
    const args = event.args as unknown[] | undefined;
    const loc = event.loc as unknown[] | undefined;
    return {
      type: 'mota_insert_s',
      fields: {
        MODE: event.name == null ? 'point' : 'common',
        NAME: (event.name as string) || '',
        X: expression(loc?.[0]),
        Y: expression(loc?.[1]),
        WHICH: (event.which as string) || '',
        FLOOR_ID: (event.floorId as string) || '',
        ARGS: args ? JSON.stringify(args) : '',
      },
    };
  },
  generator: (block: Blockly.Block): string => {
    const mode = block.getFieldValue('MODE');
    const name = block.getFieldValue('NAME');
    const x = block.getFieldValue('X');
    const y = block.getFieldValue('Y');
    const which = block.getFieldValue('WHICH');
    const floorId = block.getFieldValue('FLOOR_ID');
    const argsStr = block.getFieldValue('ARGS');

    const event: Record<string, unknown> = { type: 'insert' };
    if (mode === 'common') event.name = name;
    else {
      if (x !== '' && y !== '') event.loc = [expressionValue(x), expressionValue(y)];
      if (which) event.which = which;
      if (floorId) event.floorId = floorId;
    }

    if (argsStr) {
      const args = JSON5.parse(argsStr);
      if (!Array.isArray(args)) throw new Error('参数列表必须是数组');
      event.args = args;
    }

    return JSON.stringify(event) + ',\n';
  },
};

// ============================================
// function 块
// ============================================

/**
 * 执行函数块
 * 对应事件: { type: "function", function: "..." }
 */
export const functionSchema: BlockSchema = {
  eventType: 'function',
  definition: {
    type: 'mota_function_s',
    message0: '执行代码 异步 %1 %2',
    args0: [
      { type: 'field_checkbox', name: 'ASYNC', checked: false },
      {
        type: 'field_multilinetext',
        name: 'CODE',
        text: '',
      },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (330)
    tooltip: '执行一段 JavaScript 代码',
    helpUrl: '',
  },
  category: 'misc',
  fieldMapping: {
    CODE: 'function',
    ASYNC: { eventField: 'async', parse: (v) => v === true, generate: (v) => v === 'TRUE' || v === true ? true : undefined },
  },
};

// ============================================
// setViewport 块
// ============================================

/**
 * 设置视角块
 * 对应事件: { type: "setViewport", loc: [x, y], time: ..., async: true }
 */
export const setViewportSchema: BlockSchema = {
  eventType: 'setViewport',
  definition: {
    type: 'mota_setViewport_s',
    message0: '设置视角 %1 坐标 [%2,%3] 移动方式 %4 动画时间 %5 异步 %6',
    args0: [
      { type: 'field_dropdown', name: 'MODE', options: [['绝对位置', 'loc'], ['坐标增量', 'dxy']] },
      { type: 'field_input', name: 'X', text: '' },
      { type: 'field_input', name: 'Y', text: '' },
      { type: 'field_input', name: 'MOVE_MODE', text: '' },
      { type: 'field_input', name: 'TIME', text: '' },
      { type: 'field_checkbox', name: 'ASYNC', checked: false },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (330)
    tooltip: '设置大地图视角位置',
    helpUrl: '',
  },
  category: 'misc',
  parser: (event: EventObject, _context: ParseContext): BlockState => {
    const mode = Array.isArray(event.dxy) ? 'dxy' : 'loc';
    const loc = (event[mode] as unknown[] | undefined);
    return {
      type: 'mota_setViewport_s',
      fields: {
        MODE: mode,
        X: loc?.[0]?.toString() || '',
        Y: loc?.[1]?.toString() || '',
        MOVE_MODE: (event.moveMode as string) || '',
        TIME: (event.time as number)?.toString() || '',
        ASYNC: (event.async as boolean) || false,
      },
    };
  },
  generator: (block: Blockly.Block): string => {
    const mode = block.getFieldValue('MODE');
    const x = block.getFieldValue('X');
    const y = block.getFieldValue('Y');
    const moveMode = block.getFieldValue('MOVE_MODE');
    const time = block.getFieldValue('TIME');
    const async = block.getFieldValue('ASYNC') === 'TRUE';

    const event: Record<string, unknown> = { type: 'setViewport' };

    if (x || y) {
      event[mode] = [expressionValue(x), expressionValue(y)];
    }
    if (moveMode) event.moveMode = moveMode;
    if (time) {
      event.time = parseInt(time) || 0;
    }
    if (async) {
      event.async = true;
    }

    return JSON.stringify(event) + ',\n';
  },
};

// ============================================
// lockViewport 块
// ============================================

/**
 * 锁定视角块
 * 对应事件: { type: "lockViewport" }
 */
export const lockViewportSchema: BlockSchema = {
  eventType: 'lockViewport',
  definition: {
    type: 'mota_lockViewport_s',
    message0: '锁定视角跟随 %1',
    args0: [{ type: 'field_checkbox', name: 'LOCK', checked: false }],
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (330)
    tooltip: '锁定视角，不再跟随勇士移动',
    helpUrl: '',
  },
  category: 'misc',
  fieldMapping: {
    LOCK: { eventField: 'lock', parse: (v) => v === true, generate: (v) => v === 'TRUE' || v === true ? true : undefined },
  },
};

// ============================================
// showImage 块
// ============================================

/**
 * 显示图片块
 * 对应事件: { type: "showImage", name: "...", loc: [x, y], ... }
 */
export const showImageSchema: BlockSchema = {
  eventType: 'showImage',
  definition: {
    type: 'mota_showImage_s',
    message0: '显示图片 编号 %1 文件名 %2 翻转 %3',
    args0: [
      { type: 'field_input', name: 'CODE', text: '0' },
      { type: 'field_input', name: 'IMAGE', text: '' },
      { type: 'field_input', name: 'REVERSE', text: '' },
    ],
    message1: '裁剪 [%1,%2,%3,%4] 绘制 [%5,%6,%7,%8]',
    args1: [
      { type: 'field_input', name: 'SX', text: '' },
      { type: 'field_input', name: 'SY', text: '' },
      { type: 'field_input', name: 'SW', text: '' },
      { type: 'field_input', name: 'SH', text: '' },
      { type: 'field_input', name: 'X', text: '' },
      { type: 'field_input', name: 'Y', text: '' },
      { type: 'field_input', name: 'W', text: '' },
      { type: 'field_input', name: 'H', text: '' },
    ],
    message2: '不透明度 %1 时间 %2 异步 %3',
    args2: [
      { type: 'field_input', name: 'OPACITY', text: '1' },
      { type: 'field_input', name: 'TIME', text: '0' },
      { type: 'field_checkbox', name: 'ASYNC', checked: false },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (330)
    tooltip: '显示一张图片',
    helpUrl: '',
  },
  category: 'misc',
  parser: (event: EventObject, _context: ParseContext): BlockState => {
    const loc = event.loc as unknown[] | undefined;
    return {
      type: 'mota_showImage_s',
      fields: {
        CODE: (event.code as number)?.toString() || '0',
        IMAGE: (event.image as string) || '',
        REVERSE: (event.reverse as string) || '',
        SX: expression((event.sloc as unknown[] | undefined)?.[0]),
        SY: expression((event.sloc as unknown[] | undefined)?.[1]),
        SW: expression((event.sloc as unknown[] | undefined)?.[2]),
        SH: expression((event.sloc as unknown[] | undefined)?.[3]),
        X: loc?.[0]?.toString() || '',
        Y: loc?.[1]?.toString() || '',
        W: expression(loc?.[2]),
        H: expression(loc?.[3]),
        OPACITY: (event.opacity as number)?.toString() || '1',
        TIME: expression(event.time),
        ASYNC: event.async === true,
      },
    };
  },
  generator: (block: Blockly.Block): string => {
    const code = block.getFieldValue('CODE');
    const image = block.getFieldValue('IMAGE');
    const reverse = block.getFieldValue('REVERSE');
    const sx = block.getFieldValue('SX');
    const sy = block.getFieldValue('SY');
    const sw = block.getFieldValue('SW');
    const sh = block.getFieldValue('SH');
    const x = block.getFieldValue('X');
    const y = block.getFieldValue('Y');
    const w = block.getFieldValue('W');
    const h = block.getFieldValue('H');
    const opacity = block.getFieldValue('OPACITY');
    const time = block.getFieldValue('TIME');

    const event: Record<string, unknown> = {
      type: 'showImage',
      code: parseInt(code) || 0,
      image,
    };

    if (reverse) event.reverse = reverse;
    if (sx !== '' || sy !== '' || sw !== '' || sh !== '') event.sloc = [sx, sy, sw, sh].map(expressionValue);
    if (x !== '' || y !== '' || w !== '' || h !== '') event.loc = [x, y, ...(w !== '' || h !== '' ? [w, h] : [])].map(expressionValue);
    event.opacity = Number(opacity);
    event.time = Number(time);
    if (checkbox(block, 'ASYNC')) event.async = true;

    return JSON.stringify(event) + ',\n';
  },
};

// ============================================
// hideImage 块
// ============================================

/**
 * 隐藏图片块
 * 对应事件: { type: "hideImage", code: 0, time: ..., async: true }
 */
export const hideImageSchema: BlockSchema = {
  eventType: 'hideImage',
  definition: {
    type: 'mota_hideImage_s',
    message0: '隐藏图片 编号 %1 动画时间 %2 异步 %3',
    args0: [
      { type: 'field_input', name: 'CODE', text: '0' },
      { type: 'field_input', name: 'TIME', text: '' },
      { type: 'field_checkbox', name: 'ASYNC', checked: false },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (330)
    tooltip: '隐藏一张图片',
    helpUrl: '',
  },
  category: 'misc',
  parser: (event: EventObject, _context: ParseContext): BlockState => {
    return {
      type: 'mota_hideImage_s',
      fields: {
        CODE: (event.code as number)?.toString() || '0',
        TIME: (event.time as number)?.toString() || '',
        ASYNC: (event.async as boolean) || false,
      },
    };
  },
  generator: (block: Blockly.Block): string => {
    const code = block.getFieldValue('CODE');
    const time = block.getFieldValue('TIME');
    const async = block.getFieldValue('ASYNC') === 'TRUE';

    const event: Record<string, unknown> = {
      type: 'hideImage',
      code: parseInt(code) || 0,
    };

    if (time) {
      event.time = parseInt(time) || 0;
    }
    if (async) {
      event.async = true;
    }

    return JSON.stringify(event) + ',\n';
  },
};

// ============================================
// moveImage 块
// ============================================

/**
 * 移动图片块
 * 对应事件: { type: "moveImage", code: 0, to: [x, y], opacity: 1, time: ..., async: true }
 */
export const moveImageSchema: BlockSchema = {
  eventType: 'moveImage',
  definition: {
    type: 'mota_moveImage_s',
    message0: '移动图片 编号 %1 到 [%2,%3]',
    args0: [
      { type: 'field_input', name: 'CODE', text: '0' },
      { type: 'field_input', name: 'X', text: '' },
      { type: 'field_input', name: 'Y', text: '' },
    ],
    message1: '不透明度 %1 移动方式 %2 动画时间 %3 异步 %4',
    args1: [
      { type: 'field_input', name: 'OPACITY', text: '' },
      { type: 'field_input', name: 'MOVE_MODE', text: '' },
      { type: 'field_input', name: 'TIME', text: '' },
      { type: 'field_checkbox', name: 'ASYNC', checked: false },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (330)
    tooltip: '移动一张图片',
    helpUrl: '',
  },
  category: 'misc',
  parser: (event: EventObject, _context: ParseContext): BlockState => {
    const to = event.to as [number, number] | undefined;
    return {
      type: 'mota_moveImage_s',
      fields: {
        CODE: (event.code as number)?.toString() || '0',
        X: to?.[0]?.toString() || '',
        Y: to?.[1]?.toString() || '',
        OPACITY: (event.opacity as number)?.toString() || '',
        MOVE_MODE: (event.moveMode as string) || '',
        TIME: (event.time as number)?.toString() || '',
        ASYNC: (event.async as boolean) || false,
      },
    };
  },
  generator: (block: Blockly.Block): string => {
    const code = block.getFieldValue('CODE');
    const x = block.getFieldValue('X');
    const y = block.getFieldValue('Y');
    const opacity = block.getFieldValue('OPACITY');
    const moveMode = block.getFieldValue('MOVE_MODE');
    const time = block.getFieldValue('TIME');
    const async = block.getFieldValue('ASYNC') === 'TRUE';

    const event: Record<string, unknown> = {
      type: 'moveImage',
      code: parseInt(code) || 0,
    };

    if (x || y) {
      event.to = [expressionValue(x), expressionValue(y)];
    }
    if (opacity) {
      event.opacity = Number(opacity);
    }
    if (moveMode) event.moveMode = moveMode;
    if (time) {
      event.time = parseInt(time) || 0;
    }
    if (async) {
      event.async = true;
    }

    return JSON.stringify(event) + ',\n';
  },
};

// ============================================
// useItem 块
// ============================================

/**
 * 使用道具块
 * 对应事件: { type: "useItem", id: "..." }
 */
export const useItemSchema: BlockSchema = {
  eventType: 'useItem',
  definition: {
    type: 'mota_useItem_s',
    message0: '使用道具 %1',
    args0: [{ type: 'field_input', name: 'ID', text: '' }],
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (330)
    tooltip: '强制使用某个道具',
    helpUrl: '',
  },
  category: 'misc',
  fieldMapping: {
    ID: 'id',
  },
};

// ============================================
// openShop 块
// ============================================

/**
 * 打开商店块
 * 对应事件: { type: "openShop", id: "..." }
 */
export const openShopSchema: BlockSchema = {
  eventType: 'openShop',
  definition: {
    type: 'mota_openShop_s',
    message0: '启用商店 %1 同时打开 %2',
    args0: [
      { type: 'field_input', name: 'ID', text: '' },
      { type: 'field_checkbox', name: 'OPEN', checked: false },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (330)
    tooltip: '打开一个全局商店',
    helpUrl: '',
  },
  category: 'misc',
  fieldMapping: {
    ID: 'id',
    OPEN: { eventField: 'open', parse: (v) => v === true, generate: (v) => v === 'TRUE' || v === true ? true : undefined },
  },
};

// ============================================
// disableShop 块
// ============================================

/**
 * 禁用商店块
 * 对应事件: { type: "disableShop", id: "..." }
 */
export const disableShopSchema: BlockSchema = {
  eventType: 'disableShop',
  definition: {
    type: 'mota_disableShop_s',
    message0: '禁用商店 %1',
    args0: [{ type: 'field_input', name: 'ID', text: '' }],
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (330)
    tooltip: '永久禁用一个全局商店（直到重新打开）',
    helpUrl: '',
  },
  category: 'misc',
  fieldMapping: {
    ID: 'id',
  },
};

// ============================================
// callBook 块
// ============================================

/**
 * 调用怪物手册块
 * 对应事件: { type: "callBook" }
 */
export const callBookSchema: BlockSchema = {
  eventType: 'callBook',
  definition: {
    type: 'mota_callBook_s',
    message0: '打开怪物手册',
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (330)
    tooltip: '打开怪物手册',
    helpUrl: '',
  },
  category: 'misc',
  fieldMapping: {},
};

// ============================================
// callSave 块
// ============================================

/**
 * 调用存档界面块
 * 对应事件: { type: "callSave" }
 */
export const callSaveSchema: BlockSchema = {
  eventType: 'callSave',
  definition: {
    type: 'mota_callSave_s',
    message0: '打开存档界面',
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (330)
    tooltip: '打开存档界面',
    helpUrl: '',
  },
  category: 'misc',
  fieldMapping: {},
};

// ============================================
// callLoad 块
// ============================================

/**
 * 调用读档界面块
 * 对应事件: { type: "callLoad" }
 */
export const callLoadSchema: BlockSchema = {
  eventType: 'callLoad',
  definition: {
    type: 'mota_callLoad_s',
    message0: '打开读档界面',
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (330)
    tooltip: '打开读档界面',
    helpUrl: '',
  },
  category: 'misc',
  fieldMapping: {},
};

// ============================================
// autoSave 块
// ============================================

/**
 * 自动存档块
 * 对应事件: { type: "autoSave" }
 */
export const autoSaveSchema: BlockSchema = {
  eventType: 'autoSave',
  definition: {
    type: 'mota_autoSave_s',
    message0: '自动存档 移除上一存档 %1',
    args0: [{ type: 'field_checkbox', name: 'REMOVE_LAST', checked: false }],
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (330)
    tooltip: '执行自动存档',
    helpUrl: '',
  },
  category: 'misc',
  fieldMapping: {
    REMOVE_LAST: { eventField: 'removeLast', parse: (v) => v === true, generate: (v) => v === 'TRUE' || v === true ? true : undefined },
  },
};

// ============================================
// forbidSave 块
// ============================================

/**
 * 禁止存档块
 * 对应事件: { type: "forbidSave", forbid: true }
 */
export const forbidSaveSchema: BlockSchema = {
  eventType: 'forbidSave',
  definition: {
    type: 'mota_forbidSave_s',
    message0: '禁止存档 %1',
    args0: [{ type: 'field_checkbox', name: 'FORBID', checked: false }],
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (330)
    tooltip: '禁止或允许存档',
    helpUrl: '',
  },
  category: 'misc',
  parser: (event: EventObject): BlockState => ({
    type: 'mota_forbidSave_s',
    fields: { FORBID: event.forbid === true },
  }),
  generator: (block: Blockly.Block): string => JSON.stringify({
    type: 'forbidSave',
    forbid: checkbox(block, 'FORBID'),
  }) + ',\n',
};

// ============================================
// showStatusBar / hideStatusBar 块
// ============================================

/**
 * 显示状态栏块
 * 对应事件: { type: "showStatusBar" }
 */
export const showStatusBarSchema: BlockSchema = {
  eventType: 'showStatusBar',
  definition: {
    type: 'mota_showStatusBar_s',
    message0: '显示状态栏',
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (330)
    tooltip: '显示状态栏',
    helpUrl: '',
  },
  category: 'misc',
  fieldMapping: {},
};

/**
 * 隐藏状态栏块
 * 对应事件: { type: "hideStatusBar" }
 */
export const hideStatusBarSchema: BlockSchema = {
  eventType: 'hideStatusBar',
  definition: {
    type: 'mota_hideStatusBar_s',
    message0: '隐藏状态栏 同时隐藏工具栏 %1',
    args0: [{ type: 'field_checkbox', name: 'TOOLBOX', checked: false }],
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (330)
    tooltip: '隐藏状态栏',
    helpUrl: '',
  },
  category: 'misc',
  fieldMapping: {
    TOOLBOX: { eventField: 'toolbox', parse: (v) => v === true, generate: (v) => v === 'TRUE' || v === true ? true : undefined },
  },
};

// ============================================
// setHeroOpacity 块
// ============================================

/**
 * 设置勇士不透明度块
 * 对应事件: { type: "setHeroOpacity", opacity: 1, time: ..., async: true }
 */
export const setHeroOpacitySchema: BlockSchema = {
  eventType: 'setHeroOpacity',
  definition: {
    type: 'mota_setHeroOpacity_s',
    message0: '设置勇士不透明度 %1 移动方式 %2 动画时间 %3 异步 %4',
    args0: [
      { type: 'field_input', name: 'OPACITY', text: '1' },
      { type: 'field_input', name: 'MOVE_MODE', text: '' },
      { type: 'field_input', name: 'TIME', text: '' },
      { type: 'field_checkbox', name: 'ASYNC', checked: false },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (330)
    tooltip: '设置勇士的不透明度（0-1）',
    helpUrl: '',
  },
  category: 'misc',
  parser: (event: EventObject, _context: ParseContext): BlockState => {
    return {
      type: 'mota_setHeroOpacity_s',
      fields: {
        OPACITY: (event.opacity as number)?.toString() || '1',
        MOVE_MODE: (event.moveMode as string) || '',
        TIME: (event.time as number)?.toString() || '',
        ASYNC: (event.async as boolean) || false,
      },
    };
  },
  generator: (block: Blockly.Block): string => {
    const opacity = block.getFieldValue('OPACITY');
    const moveMode = block.getFieldValue('MOVE_MODE');
    const time = block.getFieldValue('TIME');
    const async = block.getFieldValue('ASYNC') === 'TRUE';

    const event: Record<string, unknown> = {
      type: 'setHeroOpacity',
      opacity: parseFloat(opacity) || 1,
    };

    if (moveMode) event.moveMode = moveMode;
    if (time) {
      event.time = parseInt(time) || 0;
    }
    if (async) {
      event.async = true;
    }

    return JSON.stringify(event) + ',\n';
  },
};

// ============================================
// switch_case 块（分支子块）
// ============================================

/**
 * 单个 switch 分支块
 * 用于在 switch 块中表示一个 case 分支
 * 包含匹配值和执行的事件
 */
export const switchCaseSchema: BlockSchema = {
  eventType: '_switch_case', // 内部类型，不对应独立事件
  definition: {
    type: 'mota_switch_case_s',
    message0: '如果是 %1 的场合 不跳出 %2',
    args0: [
      { type: 'field_input', name: 'CASE', text: '1' },
      { type: 'field_checkbox', name: 'NO_BREAK', checked: false },
    ],
    message1: '%1',
    args1: [
      {
        type: 'input_statement',
        name: 'ACTION',
      },
    ],
    previousStatement: 'switch_case',
    nextStatement: 'switch_case',
    inputsInline: true,
    colour: 'auto', // 使用 category 默认颜色 (330)
    tooltip: '一个 switch 分支，包含匹配值和执行的事件。使用 "default" 作为默认分支',
    helpUrl: '',
  },
  category: 'misc',
  // 这是一个内部块，不需要独立的 parser/generator
  // 由 switch 块统一处理
  fieldMapping: {},
};

// ============================================
// switch 块（复杂块，使用嵌套子块）
// ============================================

/**
 * switch 分支块
 * 对应事件: { type: "switch", condition: "...", caseList: [...] }
 *
 * 使用 switch_case 子块来可视化编辑每个分支
 */
export const switchSchema: BlockSchema = {
  eventType: 'switch',
  definition: {
    type: 'mota_switch_s',
    message0: '多重分歧 条件判定：%1',
    args0: [
      {
        type: 'input_value',
        name: 'CONDITION',
        check: ['Boolean', 'String'],
      },
    ],
    message1: '%1',
    args1: [
      {
        type: 'input_statement',
        name: 'CASES',
        check: 'switch_case',
      },
    ],
    previousStatement: null,
    nextStatement: null,
    inputsInline: true,
    colour: 'auto', // 使用 category 默认颜色 (330)
    tooltip: 'switch 多分支选择，每个分支可以包含不同的执行事件',
    helpUrl: '',
  },
  category: 'misc',
  parser: (event: EventObject, context: ParseContext): BlockState => {
    const condition = (event.condition as string) || '';
    const caseList = (event.caseList as Array<{ case: string; nobreak?: boolean; action: EventData[] }>) || [];

    const result: BlockState = {
      type: 'mota_switch_s',
      inputs: {
        CONDITION: createExpressionBlock(condition),
      },
    };

    // 解析分支列表为 switch_case 子块链
    if (caseList.length > 0) {
      let firstCaseBlock: BlockState | null = null;
      let prevCaseBlock: BlockState | null = null;

      for (const caseItem of caseList) {
        const caseBlock: BlockState = {
          type: 'mota_switch_case_s',
          fields: {
            CASE: caseItem.case || '',
            NO_BREAK: caseItem.nobreak || false,
          },
        };

        // 解析分支的 action 事件列表
        if (caseItem.action && caseItem.action.length > 0) {
          const actionBlock = parseEventList(caseItem.action, context);
          if (actionBlock) {
            caseBlock.inputs = {
              ACTION: { block: actionBlock },
            };
          }
        }

        if (!firstCaseBlock) {
          firstCaseBlock = caseBlock;
        }

        if (prevCaseBlock) {
          prevCaseBlock.next = { block: caseBlock };
        }

        prevCaseBlock = caseBlock;
      }

      if (firstCaseBlock) {
        result.inputs = {
          ...result.inputs,
          CASES: { block: firstCaseBlock },
        };
      }
    }

    return result;
  },
  generator: (block: Blockly.Block): string => {
    const conditionCode =
      javascriptGenerator.valueToCode(block, 'CONDITION', Order.NONE) || '""';

    let condition = conditionCode;
    if (condition.startsWith('"') && condition.endsWith('"')) {
      condition = condition.slice(1, -1);
    }

    // 收集所有 switch_case 子块
    const caseList: Array<{ case: string; nobreak?: boolean; action: unknown[] }> = [];
    let caseBlock = block.getInputTargetBlock('CASES');

    while (caseBlock) {
      const caseValue = caseBlock.getFieldValue('CASE') || '';
      const noBreak = caseBlock.getFieldValue('NO_BREAK') === 'TRUE';
      const actionCode = javascriptGenerator.statementToCode(caseBlock, 'ACTION');

      // 解析 action 代码为数组
      let action: unknown[] = [];
      if (actionCode) {
        try {
          // actionCode 是类似 "{ ... },\n{ ... },\n" 的格式
          // 需要包装成数组后解析
          action = JSON5.parse('[' + actionCode + ']');
        } catch {
          action = [];
        }
      }

      caseList.push({ case: caseValue, ...(noBreak ? { nobreak: true } : {}), action });
      caseBlock = caseBlock.getNextBlock();
    }

    const event: Record<string, unknown> = {
      type: 'switch',
      condition,
      caseList,
    };

    return JSON.stringify(event) + ',\n';
  },
};

// ============================================
// forEach 块
// ============================================

/**
 * forEach 循环块
 * 对应事件: { type: "forEach", name: "...", list: [...], data: [...] }
 */
export const forEachSchema: BlockSchema = {
  eventType: 'forEach',
  definition: {
    type: 'mota_forEach_s',
    message0: '循环遍历：以 %1 逐项读取列表 %2',
    args0: [
      {
        type: 'input_value',
        name: 'VAR',
        check: ['String'],
      },
      { type: 'field_input', name: 'LIST', text: '[]' },
    ],
    message1: '%1',
    args1: [
      {
        type: 'input_statement',
        name: 'DO',
      },
    ],
    previousStatement: null,
    nextStatement: null,
    inputsInline: true,
    colour: 'auto', // 使用 category 默认颜色 (330)
    tooltip: '遍历列表中的每个元素',
    helpUrl: '',
  },
  category: 'misc',
  parser: (event: EventObject, context: ParseContext): BlockState => {
    const name = (event.name as string) || 'temp:A';
    const list = event.list;
    const data = (event.data as EventData[]) || [];

    const inputs: Record<string, ConnectionState> = {
      VAR: createExpressionBlock(name),
    };

    const dataBlock = parseEventList(data, context);
    if (dataBlock) {
      inputs.DO = { block: dataBlock };
    }

    return {
      type: 'mota_forEach_s',
      fields: {
        LIST: JSON.stringify(list || []),
      },
      inputs,
    };
  },
  generator: (block: Blockly.Block): string => {
    const varName =
      javascriptGenerator.valueToCode(block, 'VAR', Order.NONE) || '"temp:A"';
    const listStr = block.getFieldValue('LIST');
    const doCode = javascriptGenerator.statementToCode(block, 'DO');

    let varStr = varName;
    if (varStr.startsWith('"') && varStr.endsWith('"')) {
      varStr = varStr.slice(1, -1);
    }

    let list = [];
    try {
      list = JSON.parse(listStr);
    } catch {
      list = [];
    }

    const event = {
      type: 'forEach',
      name: varStr,
      list,
      data: '__DATA__',
    };

    let code = JSON.stringify(event);
    code = code.replace('"__DATA__"', '[' + doCode + ']');
    return code + ',\n';
  },
};

// ============================================
// 导出所有其他事件 Schema
// ============================================

export const miscSchemas: BlockSchema[] = [
  triggerSchema,
  insertSchema,
  functionSchema,
  setViewportSchema,
  lockViewportSchema,
  showImageSchema,
  hideImageSchema,
  moveImageSchema,
  useItemSchema,
  openShopSchema,
  disableShopSchema,
  callBookSchema,
  callSaveSchema,
  callLoadSchema,
  autoSaveSchema,
  forbidSaveSchema,
  showStatusBarSchema,
  hideStatusBarSchema,
  setHeroOpacitySchema,
  switchCaseSchema,
  switchSchema,
  forEachSchema,
];
