/**
 * 交互选择块 Schema
 *
 * 包含 choices, confirm, input, win, lose, restart 等交互相关的事件块
 */

import type * as Blockly from 'blockly';
import { javascriptGenerator } from 'blockly/javascript';
import JSON5 from 'json5';

import type {
  BlockState,
  ConnectionState,
  EventData,
  EventObject,
  ParseContext,
} from '../parser/types';
import type { BlockSchema } from '../registry/types';
import { parseEventList } from '../registry/utils';
import { BlockColours } from './colours';

// ============================================
// choice_item 块（选项子块）
// ============================================

/**
 * 单个选择项块
 * 用于在 choices 块中表示一个选项
 * 包含选项文字和点击后执行的事件
 */
export const choiceItemSchema: BlockSchema = {
  eventType: '_choice_item', // 内部类型，不对应独立事件
  definition: {
    type: 'mota_choice_item_s',
    message0: '子选项 %1 图标 %2 颜色 %3 %4',
    args0: [
      { type: 'field_input', name: 'TEXT', text: '提示文字:红钥匙' },
      { type: 'field_input', name: 'ICON', text: '' },
      { type: 'field_input', name: 'COLOR', text: '' },
      { type: 'field_colour', name: 'COLOR_PICKER', colour: '#ffffff' },
    ],
    message1: '启用条件 %1 出现条件 %2',
    args1: [
      { type: 'field_input', name: 'NEED', text: '' },
      { type: 'field_input', name: 'CONDITION', text: '' },
    ],
    message2: '%1',
    args2: [
      {
        type: 'input_statement',
        name: 'ACTION',
      },
    ],
    previousStatement: 'choice_item',
    nextStatement: 'choice_item',
    inputsInline: true,
    colour: BlockColours.CONTEXT,
    tooltip: '一个选择项，包含文字和点击后执行的事件',
    helpUrl: '',
  },
  category: 'interaction',
  // 这是一个内部块，不需要独立的 parser/generator
  // 由 choices 块统一处理
  fieldMapping: {},
};

// ============================================
// choices 块（复杂块，使用嵌套子块）
// ============================================

/**
 * 选择项块
 * 对应事件: { type: "choices", text: "...", choices: [...] }
 *
 * 使用 choice_item 子块来可视化编辑每个选项
 */
export const choicesSchema: BlockSchema = {
  eventType: 'choices',
  definition: {
    type: 'mota_choices_s',
    message0: '选项：%1',
    args0: [{ type: 'field_multilinetext', name: 'TEXT', text: '' }],
    message1: '标题 %1 图标 %2 超时毫秒数 %3 宽度 %4',
    args1: [
      { type: 'field_input', name: 'TITLE', text: '' },
      { type: 'field_input', name: 'ICON', text: '' },
      { type: 'field_input', name: 'TIMEOUT', text: '' },
      { type: 'field_input', name: 'WIDTH', text: '' },
    ],
    message2: '%1',
    args2: [
      {
        type: 'input_statement',
        name: 'CHOICES',
        check: 'choice_item',
      },
    ],
    previousStatement: null,
    nextStatement: null,
    inputsInline: true,
    colour: 'auto', // 使用 category 默认颜色 (160)
    tooltip: '显示选择项，每个选项可以包含不同的执行事件',
    helpUrl: '',
  },
  category: 'interaction',
  parser: (event: EventObject, context: ParseContext): BlockState => {
    const text = (event.text as string) || '';
    const choices = (event.choices as Array<{
      text: string;
      icon?: string;
      color?: Array<number | string>;
      need?: string;
      condition?: string;
      action: EventData[];
    }>) || [];

    // 解析文本中的标题和图标
    let title = '';
    let icon = '';
    let content = text;

    const titleMatch = /\\t\[([^\]]*)\]/.exec(content);
    if (titleMatch) {
      const parts = titleMatch[1].split(',');
      title = parts[0] || '';
      icon = parts[1] || '';
      content = content.replace(titleMatch[0], '');
    }

    const result: BlockState = {
      type: 'mota_choices_s',
      fields: {
        TEXT: content,
        TITLE: title,
        ICON: icon,
        TIMEOUT: (event.timeout as number)?.toString() || '',
        WIDTH: event.width == null ? '' : String(event.width),
      },
    };

    // 解析选项列表为 choice_item 子块链
    if (choices.length > 0) {
      let firstChoiceBlock: BlockState | null = null;
      let prevChoiceBlock: BlockState | null = null;

      for (const choice of choices) {
        const choiceBlock: BlockState = {
          type: 'mota_choice_item_s',
          fields: {
            TEXT: choice.text || '',
            ICON: choice.icon || '',
            COLOR: Array.isArray(choice.color) ? choice.color.join(',') : '',
            NEED: choice.need || '',
            CONDITION: choice.condition || '',
          },
        };

        // 解析选项的 action 事件列表
        if (choice.action && choice.action.length > 0) {
          const actionBlock = parseEventList(choice.action, context);
          if (actionBlock) {
            choiceBlock.inputs = {
              ACTION: { block: actionBlock },
            };
          }
        }

        if (!firstChoiceBlock) {
          firstChoiceBlock = choiceBlock;
        }

        if (prevChoiceBlock) {
          prevChoiceBlock.next = { block: choiceBlock };
        }

        prevChoiceBlock = choiceBlock;
      }

      if (firstChoiceBlock) {
        result.inputs = {
          CHOICES: { block: firstChoiceBlock },
        };
      }
    }

    return result;
  },
  generator: (block: Blockly.Block): string => {
    const text = block.getFieldValue('TEXT');
    const title = block.getFieldValue('TITLE');
    const icon = block.getFieldValue('ICON');
    const timeout = block.getFieldValue('TIMEOUT');
    const width = block.getFieldValue('WIDTH');

    // 构建文本格式
    let fullText = '';
    if (title || icon) {
      fullText += '\\t[';
      if (icon) {
        fullText += title + ',' + icon;
      } else {
        fullText += title;
      }
      fullText += ']';
    }
    fullText += text;

    // 收集所有 choice_item 子块
    const choices: Array<Record<string, unknown> & { text: string; action: unknown[] }> = [];
    let choiceBlock = block.getInputTargetBlock('CHOICES');

    while (choiceBlock) {
      const choiceText = choiceBlock.getFieldValue('TEXT') || '';
      const choiceIcon = choiceBlock.getFieldValue('ICON') || '';
      const colorText = choiceBlock.getFieldValue('COLOR') || '';
      const need = choiceBlock.getFieldValue('NEED') || '';
      const condition = choiceBlock.getFieldValue('CONDITION') || '';
      const actionCode = javascriptGenerator.statementToCode(choiceBlock, 'ACTION');

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

      const color = String(colorText).split(',').map((part) => Number(part.trim()));
      choices.push({
        text: choiceText,
        ...(choiceIcon ? { icon: choiceIcon } : {}),
        ...(colorText && color.every(Number.isFinite) ? { color } : {}),
        ...(need ? { need } : {}),
        ...(condition ? { condition } : {}),
        action,
      });
      choiceBlock = choiceBlock.getNextBlock();
    }

    const event: Record<string, unknown> = { type: 'choices' };
    if (fullText) {
      event.text = fullText;
    }
    if (timeout) {
      event.timeout = parseInt(timeout) || 0;
    }
    if (width) event.width = /^-?\d+(?:\.\d+)?$/.test(width) ? Number(width) : width;
    event.choices = choices;

    return JSON.stringify(event) + ',\n';
  },
};

// ============================================
// confirm 块
// ============================================

/**
 * 确认框块
 * 对应事件: { type: "confirm", text: "...", yes: [...], no: [...] }
 */
export const confirmSchema: BlockSchema = {
  eventType: 'confirm',
  definition: {
    type: 'mota_confirm_s',
    message0: '显示确认框：%1 超时毫秒数 %2',
    args0: [
      { type: 'field_multilinetext', name: 'TEXT', text: '确认要xxx吗?' },
      { type: 'field_number', name: 'TIMEOUT', value: 0, min: 0, precision: 1 },
    ],
    message1: '确定的场合：（默认选中 %1）',
    args1: [{ type: 'field_checkbox', name: 'DEFAULT', checked: false }],
    message2: '%1',
    args2: [
      {
        type: 'input_statement',
        name: 'YES',
      },
    ],
    message3: '取消的场合：',
    message4: '%1',
    args4: [
      {
        type: 'input_statement',
        name: 'NO',
      },
    ],
    previousStatement: null,
    nextStatement: null,
    inputsInline: true,
    colour: 'auto', // 使用 category 默认颜色 (160)
    tooltip: '显示确认框，根据用户选择执行不同事件',
    helpUrl: '',
  },
  category: 'interaction',
  parser: (event: EventObject, context: ParseContext): BlockState => {
    const text = (event.text as string) || '';
    const yesEvents = (event.yes as EventData[]) || [];
    const noEvents = (event.no as EventData[]) || [];

    const inputs: Record<string, ConnectionState> = {};

    const yesBlock = parseEventList(yesEvents, context);
    if (yesBlock) {
      inputs.YES = { block: yesBlock };
    }

    const noBlock = parseEventList(noEvents, context);
    if (noBlock) {
      inputs.NO = { block: noBlock };
    }

    return {
      type: 'mota_confirm_s',
      fields: {
        TEXT: text,
        TIMEOUT: Number(event.timeout) || 0,
        DEFAULT: event.default === true,
      },
      inputs,
    };
  },
  generator: (block: Blockly.Block): string => {
    const text = block.getFieldValue('TEXT') || '';
    const timeout = Number(block.getFieldValue('TIMEOUT')) || 0;
    const defaultSelected = block.getFieldValue('DEFAULT') === 'TRUE';
    const yesCode = javascriptGenerator.statementToCode(block, 'YES');
    const noCode = javascriptGenerator.statementToCode(block, 'NO');

    const event = {
      type: 'confirm',
      ...(timeout ? { timeout } : {}),
      ...(defaultSelected ? { default: true } : {}),
      text,
      yes: '__YES__',
      no: '__NO__',
    };

    let code = JSON.stringify(event);
    code = code.replace('"__YES__"', '[' + yesCode + ']');
    code = code.replace('"__NO__"', '[' + noCode + ']');
    return code + ',\n';
  },
};

// ============================================
// input 块
// ============================================

/**
 * 用户输入块
 * 对应事件: { type: "input", text: "..." }
 */
export const inputSchema: BlockSchema = {
  eventType: 'input',
  definition: {
    type: 'mota_input_s',
    message0: '用户输入 提示 %1',
    args0: [{ type: 'field_input', name: 'TEXT', text: '请输入数值' }],
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (160)
    tooltip: '弹出输入框，结果存入 flag:input',
    helpUrl: '',
  },
  category: 'interaction',
  fieldMapping: {
    TEXT: 'text',
  },
};

// ============================================
// input2 块
// ============================================

/**
 * 用户输入块（自定义变量）
 * 对应事件: { type: "input2", text: "...", name: "flag:xxx" }
 */
export const input2Schema: BlockSchema = {
  eventType: 'input2',
  definition: {
    type: 'mota_input2_s',
    message0: '用户输入 提示 %1 存入 %2',
    args0: [
      { type: 'field_input', name: 'TEXT', text: '请输入' },
      { type: 'field_input', name: 'NAME', text: 'flag:input' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (160)
    tooltip: '弹出输入框，结果存入指定变量',
    helpUrl: '',
  },
  category: 'interaction',
  fieldMapping: {
    TEXT: 'text',
    NAME: 'name',
  },
};

// ============================================
// win 块
// ============================================

/**
 * 游戏胜利块
 * 对应事件: { type: "win", reason: "...", norank: true }
 */
export const winSchema: BlockSchema = {
  eventType: 'win',
  definition: {
    type: 'mota_win_s',
    message0: '游戏胜利 原因 %1 不计入榜单 %2',
    args0: [
      { type: 'field_input', name: 'REASON', text: '' },
      { type: 'field_checkbox', name: 'NO_RANK', checked: false },
    ],
    previousStatement: null,
    colour: BlockColours.GAME_FLOW,
    tooltip: '游戏胜利，显示结算画面',
    helpUrl: '',
  },
  category: 'interaction',
  fieldMapping: {
    REASON: 'reason',
    NO_RANK: {
      eventField: 'norank',
      parse: (v) => (v as boolean) || false,
      generate: (v) => (v === 'TRUE' || v === true ? true : undefined),
    },
  },
};

// ============================================
// lose 块
// ============================================

/**
 * 游戏失败块
 * 对应事件: { type: "lose", reason: "..." }
 */
export const loseSchema: BlockSchema = {
  eventType: 'lose',
  definition: {
    type: 'mota_lose_s',
    message0: '游戏失败 原因 %1',
    args0: [{ type: 'field_input', name: 'REASON', text: '' }],
    previousStatement: null,
    colour: BlockColours.GAME_FLOW,
    tooltip: '游戏失败，显示失败画面',
    helpUrl: '',
  },
  category: 'interaction',
  fieldMapping: {
    REASON: 'reason',
  },
};

// ============================================
// restart 块
// ============================================

/**
 * 重新开始块
 * 对应事件: { type: "restart" }
 */
export const restartSchema: BlockSchema = {
  eventType: 'restart',
  definition: {
    type: 'mota_restart_s',
    message0: '重新开始游戏',
    previousStatement: null,
    colour: BlockColours.GAME_FLOW,
    tooltip: '直接重新开始游戏',
    helpUrl: '',
  },
  category: 'interaction',
  fieldMapping: {},
};

// ============================================
// setText 块
// ============================================

/**
 * 设置文本属性块
 * 对应事件: { type: "setText", position: "...", ... }
 */
export const setTextSchema: BlockSchema = {
  eventType: 'setText',
  definition: {
    type: 'mota_setText_s',
    message0: '设置文本属性 位置 %1 偏移 [%2,%3]',
    args0: [
      {
        type: 'field_dropdown',
        name: 'POSITION',
        options: [
          ['默认', ''],
          ['上', 'up'],
          ['中', 'center'],
          ['下', 'down'],
        ],
      },
      { type: 'field_input', name: 'OFFSET_X', text: '' },
      { type: 'field_input', name: 'OFFSET_Y', text: '' },
    ],
    message1: '对齐 %1 标题色 %2 正文色 %3',
    args1: [
      {
        type: 'field_dropdown',
        name: 'ALIGN',
        options: [
          ['默认', ''],
          ['左', 'left'],
          ['中', 'center'],
          ['右', 'right'],
        ],
      },
      { type: 'field_input', name: 'TITLE_COLOR', text: '' },
      { type: 'field_input', name: 'TEXT_COLOR', text: '' },
    ],
    message2: '背景色 %1 边框色 %2 粗体 %3',
    args2: [
      { type: 'field_input', name: 'BACKGROUND', text: '' },
      { type: 'field_input', name: 'BORDER', text: '' },
      { type: 'field_checkbox', name: 'BOLD', checked: false },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (160)
    tooltip: '设置后续对话框的样式',
    helpUrl: '',
  },
  category: 'interaction',
  parser: (event: EventObject, _context: ParseContext): BlockState => {
    const offset = event.offset as [number, number] | undefined;
    return {
      type: 'mota_setText_s',
      fields: {
        POSITION: (event.position as string) || '',
        OFFSET_X: offset?.[0]?.toString() || '',
        OFFSET_Y: offset?.[1]?.toString() || '',
        ALIGN: (event.align as string) || '',
        TITLE_COLOR: (event.titlefont as string) || '',
        TEXT_COLOR: (event.textfont as string) || '',
        BACKGROUND: (event.background as string) || '',
        BORDER: (event.border as string) || '',
        BOLD: (event.bold as boolean) || false,
      },
    };
  },
  generator: (block: Blockly.Block): string => {
    const position = block.getFieldValue('POSITION');
    const offsetX = block.getFieldValue('OFFSET_X');
    const offsetY = block.getFieldValue('OFFSET_Y');
    const align = block.getFieldValue('ALIGN');
    const titleColor = block.getFieldValue('TITLE_COLOR');
    const textColor = block.getFieldValue('TEXT_COLOR');
    const background = block.getFieldValue('BACKGROUND');
    const border = block.getFieldValue('BORDER');
    const bold = block.getFieldValue('BOLD') === 'TRUE';

    const event: Record<string, unknown> = { type: 'setText' };

    if (position) event.position = position;
    if (offsetX || offsetY) {
      event.offset = [parseInt(offsetX) || 0, parseInt(offsetY) || 0];
    }
    if (align) event.align = align;
    if (titleColor) event.titlefont = titleColor;
    if (textColor) event.textfont = textColor;
    if (background) event.background = background;
    if (border) event.border = border;
    if (bold) event.bold = true;

    return JSON.stringify(event) + ',\n';
  },
};

// ============================================
// moveTextBox 块
// ============================================

/**
 * 移动文本框块
 * 对应事件: { type: "moveTextBox", loc: [x, y], time: ..., async: true }
 */
export const moveTextBoxSchema: BlockSchema = {
  eventType: 'moveTextBox',
  definition: {
    type: 'mota_moveTextBox_s',
    message0: '移动文本框到 [%1,%2] 时间 %3 异步 %4',
    args0: [
      { type: 'field_input', name: 'X', text: '' },
      { type: 'field_input', name: 'Y', text: '' },
      { type: 'field_input', name: 'TIME', text: '' },
      { type: 'field_checkbox', name: 'ASYNC', checked: false },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (160)
    tooltip: '平滑移动当前文本框',
    helpUrl: '',
  },
  category: 'interaction',
  parser: (event: EventObject, _context: ParseContext): BlockState => {
    const loc = event.loc as [number, number] | undefined;
    return {
      type: 'mota_moveTextBox_s',
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

    const event: Record<string, unknown> = { type: 'moveTextBox' };

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
// clearTextBox 块
// ============================================

/**
 * 清除文本框块
 * 对应事件: { type: "clearTextBox" }
 */
export const clearTextBoxSchema: BlockSchema = {
  eventType: 'clearTextBox',
  definition: {
    type: 'mota_clearTextBox_s',
    message0: '清除文本框',
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (160)
    tooltip: '清除当前显示的文本框',
    helpUrl: '',
  },
  category: 'interaction',
  fieldMapping: {},
};

// ============================================
// 导出所有交互选择 Schema
// ============================================

export const interactionSchemas: BlockSchema[] = [
  choiceItemSchema,
  choicesSchema,
  confirmSchema,
  inputSchema,
  input2Schema,
  winSchema,
  loseSchema,
  restartSchema,
  setTextSchema,
  moveTextBoxSchema,
  clearTextBoxSchema,
];
