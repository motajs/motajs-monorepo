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
    const loc = event.loc as [number, number] | undefined;
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
      event.loc = [parseInt(x) || 0, parseInt(y) || 0];
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
    message0: '插入公共事件 %1 参数 %2',
    args0: [
      { type: 'field_input', name: 'NAME', text: '' },
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
    return {
      type: 'mota_insert_s',
      fields: {
        NAME: (event.name as string) || '',
        ARGS: args ? args.join(',') : '',
      },
    };
  },
  generator: (block: Blockly.Block): string => {
    const name = block.getFieldValue('NAME');
    const argsStr = block.getFieldValue('ARGS');

    const event: Record<string, unknown> = { type: 'insert', name };

    if (argsStr) {
      // 解析参数，尝试转换数字
      const args = argsStr.split(',').map((s: string) => {
        const trimmed = s.trim();
        const num = Number(trimmed);
        return isNaN(num) ? trimmed : num;
      });
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
    message0: '执行代码 %1',
    args0: [
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
    message0: '设置视角 位置 [%1,%2] 动画时间 %3 异步 %4',
    args0: [
      { type: 'field_input', name: 'X', text: '' },
      { type: 'field_input', name: 'Y', text: '' },
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
    const loc = event.loc as [number, number] | undefined;
    return {
      type: 'mota_setViewport_s',
      fields: {
        X: loc?.[0]?.toString() || '',
        Y: loc?.[1]?.toString() || '',
        TIME: (event.time as number)?.toString() || '',
        ASYNC: (event.async as boolean) || false,
      },
    };
  },
  generator: (block: Blockly.Block): string => {
    const x = block.getFieldValue('X');
    const y = block.getFieldValue('Y');
    const time = block.getFieldValue('TIME');
    const async = block.getFieldValue('ASYNC') === 'TRUE';

    const event: Record<string, unknown> = { type: 'setViewport' };

    if (x || y) {
      event.loc = [parseInt(x) || 0, parseInt(y) || 0];
    }
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
    message0: '锁定视角跟随',
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (330)
    tooltip: '锁定视角，不再跟随勇士移动',
    helpUrl: '',
  },
  category: 'misc',
  fieldMapping: {},
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
    message0: '显示图片 编号 %1 文件名 %2',
    args0: [
      { type: 'field_input', name: 'CODE', text: '0' },
      { type: 'field_input', name: 'NAME', text: '' },
    ],
    message1: '位置 [%1,%2] 不透明度 %3',
    args1: [
      { type: 'field_input', name: 'X', text: '' },
      { type: 'field_input', name: 'Y', text: '' },
      { type: 'field_input', name: 'OPACITY', text: '1' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (330)
    tooltip: '显示一张图片',
    helpUrl: '',
  },
  category: 'misc',
  parser: (event: EventObject, _context: ParseContext): BlockState => {
    const loc = event.loc as [number, number] | undefined;
    return {
      type: 'mota_showImage_s',
      fields: {
        CODE: (event.code as number)?.toString() || '0',
        NAME: (event.name as string) || '',
        X: loc?.[0]?.toString() || '',
        Y: loc?.[1]?.toString() || '',
        OPACITY: (event.opacity as number)?.toString() || '1',
      },
    };
  },
  generator: (block: Blockly.Block): string => {
    const code = block.getFieldValue('CODE');
    const name = block.getFieldValue('NAME');
    const x = block.getFieldValue('X');
    const y = block.getFieldValue('Y');
    const opacity = block.getFieldValue('OPACITY');

    const event: Record<string, unknown> = {
      type: 'showImage',
      code: parseInt(code) || 0,
      name,
    };

    if (x || y) {
      event.loc = [parseInt(x) || 0, parseInt(y) || 0];
    }
    if (opacity && opacity !== '1') {
      event.opacity = parseFloat(opacity) || 1;
    }

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
    message1: '不透明度 %1 动画时间 %2 异步 %3',
    args1: [
      { type: 'field_input', name: 'OPACITY', text: '' },
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
    const time = block.getFieldValue('TIME');
    const async = block.getFieldValue('ASYNC') === 'TRUE';

    const event: Record<string, unknown> = {
      type: 'moveImage',
      code: parseInt(code) || 0,
    };

    if (x || y) {
      event.to = [parseInt(x) || 0, parseInt(y) || 0];
    }
    if (opacity) {
      event.opacity = parseFloat(opacity) || 1;
    }
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
    message0: '打开商店 %1',
    args0: [{ type: 'field_input', name: 'ID', text: '' }],
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (330)
    tooltip: '打开一个全局商店',
    helpUrl: '',
  },
  category: 'misc',
  fieldMapping: {
    ID: 'id',
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
    message0: '自动存档',
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (330)
    tooltip: '执行自动存档',
    helpUrl: '',
  },
  category: 'misc',
  fieldMapping: {},
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
    args0: [{ type: 'field_checkbox', name: 'FORBID', checked: true }],
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (330)
    tooltip: '禁止或允许存档',
    helpUrl: '',
  },
  category: 'misc',
  fieldMapping: {
    FORBID: {
      eventField: 'forbid',
      parse: (v) => v !== false,
      generate: (v) => v === 'TRUE' || v === true,
    },
  },
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
    message0: '隐藏状态栏',
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (330)
    tooltip: '隐藏状态栏',
    helpUrl: '',
  },
  category: 'misc',
  fieldMapping: {},
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
    message0: '设置勇士不透明度 %1 动画时间 %2 异步 %3',
    args0: [
      { type: 'field_input', name: 'OPACITY', text: '1' },
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
        TIME: (event.time as number)?.toString() || '',
        ASYNC: (event.async as boolean) || false,
      },
    };
  },
  generator: (block: Blockly.Block): string => {
    const opacity = block.getFieldValue('OPACITY');
    const time = block.getFieldValue('TIME');
    const async = block.getFieldValue('ASYNC') === 'TRUE';

    const event: Record<string, unknown> = {
      type: 'setHeroOpacity',
      opacity: parseFloat(opacity) || 1,
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
