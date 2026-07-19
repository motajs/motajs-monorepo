/**
 * 特效声音块 Schema
 *
 * 包含 animate, playSound, playBgm, setCurtain, setWeather 等特效声音相关的事件块
 */

import type * as Blockly from 'blockly';

import type { BlockState, EventObject, ParseContext } from '../parser/types';
import type { BlockSchema } from '../registry/types';
import { BlockColours } from './colours';
import { legacyEffectSchemas } from './effectLegacy';
import { checkbox, expression, expressionValue } from './legacyHelpers';

// ============================================
// animate 块
// ============================================

/**
 * 播放动画块
 * 对应事件: { type: "animate", name: "...", loc: [x, y], async: true }
 */
export const animateSchema: BlockSchema = {
  eventType: 'animate',
  definition: {
    type: 'mota_animate_s',
    message0: '播放动画 %1 位置模式 %2 [%3,%4] 相对窗口 %5 异步 %6',
    args0: [
      { type: 'field_input', name: 'NAME', text: '' },
      { type: 'field_dropdown', name: 'LOC_MODE', options: [['坐标', 'loc'], ['跟随勇士', 'hero']] },
      { type: 'field_input', name: 'X', text: '' },
      { type: 'field_input', name: 'Y', text: '' },
      { type: 'field_checkbox', name: 'ALIGN_WINDOW', checked: false },
      { type: 'field_checkbox', name: 'ASYNC', checked: false },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (20)
    tooltip: '播放一个动画。位置为空表示全屏动画',
    helpUrl: '',
  },
  category: 'effect',
  parser: (event: EventObject, _context: ParseContext): BlockState => {
    const loc = Array.isArray(event.loc) ? event.loc : undefined;
    return {
      type: 'mota_animate_s',
      fields: {
        NAME: (event.name as string) || '',
        LOC_MODE: event.loc === 'hero' ? 'hero' : 'loc',
        X: loc?.[0]?.toString() || '',
        Y: loc?.[1]?.toString() || '',
        ALIGN_WINDOW: event.alignWindow === true,
        ASYNC: (event.async as boolean) || false,
      },
    };
  },
  generator: (block: Blockly.Block): string => {
    const name = block.getFieldValue('NAME');
    const locMode = block.getFieldValue('LOC_MODE');
    const x = block.getFieldValue('X');
    const y = block.getFieldValue('Y');
    const async = block.getFieldValue('ASYNC') === 'TRUE';

    const event: Record<string, unknown> = { type: 'animate', name };

    if (locMode === 'hero') event.loc = 'hero';
    else if (x || y) event.loc = [expressionValue(x), expressionValue(y)];
    if (checkbox(block, 'ALIGN_WINDOW')) event.alignWindow = true;
    if (async) {
      event.async = true;
    }

    return JSON.stringify(event) + ',\n';
  },
  interactions: [
    {
      type: 'selectMaterial',
      field: 'NAME',
      materialKind: 'animate',
      transform: 'strip-animate-extension',
    },
    { type: 'autocomplete', field: 'NAME', source: 'animate' },
  ],
  defaultInteraction: 'selectMaterial',
};

// ============================================
// stopAnimate 块
// ============================================

/**
 * 停止动画块
 * 对应事件: { type: "stopAnimate" }
 */
export const stopAnimateSchema: BlockSchema = {
  eventType: 'stopAnimate',
  definition: {
    type: 'mota_stopAnimate_s',
    message0: '停止所有动画 执行动画回调 %1',
    args0: [{ type: 'field_checkbox', name: 'DO_CALLBACK', checked: false }],
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (20)
    tooltip: '停止当前正在播放的所有动画',
    helpUrl: '',
  },
  category: 'effect',
  event: {
    match: { path: 'type', equals: 'stopAnimate' },
    template: { type: 'stopAnimate' },
    bindings: [
      { input: 'DO_CALLBACK', kind: 'field', path: 'doCallback', valueType: 'boolean', default: false, omitWhenDefault: true },
    ],
  },
};

// ============================================
// playSound 块
// ============================================

/**
 * 播放音效块
 * 对应事件: { type: "playSound", name: "...", pitch: 100, stop: true }
 */
export const playSoundSchema: BlockSchema = {
  eventType: 'playSound',
  definition: {
    type: 'mota_playSound_s',
    message0: '播放音效 %1 音调 %2 停止之前的 %3 同步等待 %4',
    args0: [
      { type: 'field_input', name: 'NAME', text: '' },
      { type: 'field_input', name: 'PITCH', text: '' },
      { type: 'field_checkbox', name: 'STOP', checked: false },
      { type: 'field_checkbox', name: 'SYNC', checked: false },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: BlockColours.SOUND,
    tooltip: '播放一个音效',
    helpUrl: '',
  },
  category: 'effect',
  parser: (event: EventObject, _context: ParseContext): BlockState => {
    return {
      type: 'mota_playSound_s',
      fields: {
        NAME: (event.name as string) || '',
        PITCH: (event.pitch as number)?.toString() || '',
        STOP: (event.stop as boolean) || false,
        SYNC: event.sync === true,
      },
    };
  },
  generator: (block: Blockly.Block): string => {
    const name = block.getFieldValue('NAME');
    const pitch = block.getFieldValue('PITCH');
    const stop = block.getFieldValue('STOP') === 'TRUE';

    const event: Record<string, unknown> = { type: 'playSound', name };

    if (pitch) {
      event.pitch = parseInt(pitch) || 100;
    }
    if (stop) {
      event.stop = true;
    }
    if (checkbox(block, 'SYNC')) event.sync = true;

    return JSON.stringify(event) + ',\n';
  },
};

// ============================================
// stopSound 块
// ============================================

/**
 * 停止音效块
 * 对应事件: { type: "stopSound" }
 */
export const stopSoundSchema: BlockSchema = {
  eventType: 'stopSound',
  definition: {
    type: 'mota_stopSound_s',
    message0: '停止所有音效',
    previousStatement: null,
    nextStatement: null,
    colour: BlockColours.SOUND,
    tooltip: '停止所有正在播放的音效',
    helpUrl: '',
  },
  category: 'effect',
  event: {
    match: { path: 'type', equals: 'stopSound' },
    template: { type: 'stopSound' },
    bindings: [],
  },
};

// ============================================
// playBgm 块
// ============================================

/**
 * 播放背景音乐块
 * 对应事件: { type: "playBgm", name: "...", keep: true }
 */
export const playBgmSchema: BlockSchema = {
  eventType: 'playBgm',
  definition: {
    type: 'mota_playBgm_s',
    message0: '播放背景音乐 %1 开始秒数 %2 保持不变 %3',
    args0: [
      { type: 'field_input', name: 'NAME', text: '' },
      { type: 'field_input', name: 'START_TIME', text: '0' },
      { type: 'field_checkbox', name: 'KEEP', checked: false },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: BlockColours.SOUND,
    tooltip: '播放背景音乐。keep=true 表示切换楼层后保持',
    helpUrl: '',
  },
  category: 'effect',
  event: {
    match: { path: 'type', equals: 'playBgm' },
    template: { type: 'playBgm' },
    bindings: [
      { input: 'NAME', kind: 'field', path: 'name', valueType: 'string' },
      { input: 'START_TIME', kind: 'field', path: 'startTime', valueType: 'number', default: 0, omitWhenDefault: true },
      { input: 'KEEP', kind: 'field', path: 'keep', valueType: 'boolean', default: false, omitWhenDefault: true },
    ],
  },
};

// ============================================
// pauseBgm 块
// ============================================

/**
 * 暂停背景音乐块
 * 对应事件: { type: "pauseBgm" }
 */
export const pauseBgmSchema: BlockSchema = {
  eventType: 'pauseBgm',
  definition: {
    type: 'mota_pauseBgm_s',
    message0: '暂停背景音乐',
    previousStatement: null,
    nextStatement: null,
    colour: BlockColours.SOUND,
    tooltip: '暂停当前背景音乐',
    helpUrl: '',
  },
  category: 'effect',
  fieldMapping: {},
};

// ============================================
// resumeBgm 块
// ============================================

/**
 * 恢复背景音乐块
 * 对应事件: { type: "resumeBgm" }
 */
export const resumeBgmSchema: BlockSchema = {
  eventType: 'resumeBgm',
  definition: {
    type: 'mota_resumeBgm_s',
    message0: '恢复背景音乐 从暂停处继续 %1',
    args0: [{ type: 'field_checkbox', name: 'RESUME', checked: false }],
    previousStatement: null,
    nextStatement: null,
    colour: BlockColours.SOUND,
    tooltip: '恢复暂停的背景音乐',
    helpUrl: '',
  },
  category: 'effect',
  fieldMapping: {
    RESUME: { eventField: 'resume', parse: (v) => v === true, generate: (v) => v === 'TRUE' || v === true ? true : undefined },
  },
};

// ============================================
// setVolume 块
// ============================================

/**
 * 设置音量块
 * 对应事件: { type: "setVolume", value: 100 }
 */
export const setVolumeSchema: BlockSchema = {
  eventType: 'setVolume',
  definition: {
    type: 'mota_setVolume_s',
    message0: '设置音量 %1 渐变时间 %2 异步 %3',
    args0: [
      { type: 'field_input', name: 'VALUE', text: '100' },
      { type: 'field_input', name: 'TIME', text: '0' },
      { type: 'field_checkbox', name: 'ASYNC', checked: false },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: BlockColours.SOUND,
    tooltip: '设置背景音乐音量（0-100）',
    helpUrl: '',
  },
  category: 'effect',
  fieldMapping: {
    VALUE: {
      eventField: 'value',
      parse: (v) => (v as number)?.toString() || '100',
      generate: (v) => parseInt(v as string) || 100,
    },
    TIME: { eventField: 'time', parse: (v) => expression(v), generate: (v) => expressionValue(v as string) },
    ASYNC: { eventField: 'async', parse: (v) => v === true, generate: (v) => v === 'TRUE' || v === true ? true : undefined },
  },
};

// ============================================
// setCurtain 块
// ============================================

/**
 * 设置画面色调块
 * 对应事件: { type: "setCurtain", color: [r, g, b, a], time: ..., async: true }
 */
export const setCurtainSchema: BlockSchema = {
  eventType: 'setCurtain',
  definition: {
    type: 'mota_setCurtain_s',
    message0: '设置画面色调 恢复原色 %1 [%2,%3,%4,%5] 移动方式 %6 渐变时间 %7 异步 %8 保持 %9',
    args0: [
      { type: 'field_checkbox', name: 'RESTORE', checked: false },
      { type: 'field_input', name: 'R', text: '0' },
      { type: 'field_input', name: 'G', text: '0' },
      { type: 'field_input', name: 'B', text: '0' },
      { type: 'field_input', name: 'A', text: '0' },
      { type: 'field_input', name: 'MOVE_MODE', text: '' },
      { type: 'field_input', name: 'TIME', text: '' },
      { type: 'field_checkbox', name: 'ASYNC', checked: false },
      { type: 'field_checkbox', name: 'KEEP', checked: false },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: BlockColours.SOUND,
    tooltip: '设置画面色调。RGBA 值范围 0-255（A 为 0 表示清除）',
    helpUrl: '',
  },
  category: 'effect',
  parser: (event: EventObject, _context: ParseContext): BlockState => {
    const color = event.color as [number, number, number, number] | undefined;
    return {
      type: 'mota_setCurtain_s',
      fields: {
        RESTORE: !Array.isArray(color),
        R: color?.[0]?.toString() || '0',
        G: color?.[1]?.toString() || '0',
        B: color?.[2]?.toString() || '0',
        A: color?.[3]?.toString() || '0',
        MOVE_MODE: (event.moveMode as string) || '',
        TIME: (event.time as number)?.toString() || '',
        ASYNC: (event.async as boolean) || false,
        KEEP: (event.keep as boolean) || false,
      },
    };
  },
  generator: (block: Blockly.Block): string => {
    const r = block.getFieldValue('R');
    const g = block.getFieldValue('G');
    const b = block.getFieldValue('B');
    const a = block.getFieldValue('A');
    const moveMode = block.getFieldValue('MOVE_MODE');
    const time = block.getFieldValue('TIME');
    const async = block.getFieldValue('ASYNC') === 'TRUE';
    const keep = block.getFieldValue('KEEP') === 'TRUE';

    const event: Record<string, unknown> = { type: 'setCurtain' };
    if (!checkbox(block, 'RESTORE')) event.color = [Number(r), Number(g), Number(b), Number(a)];
    if (moveMode) event.moveMode = moveMode;

    if (time) {
      event.time = parseInt(time) || 0;
    }
    if (async) {
      event.async = true;
    }
    if (keep) {
      event.keep = true;
    }

    return JSON.stringify(event) + ',\n';
  },
};

// ============================================
// screenFlash 块
// ============================================

/**
 * 屏幕闪烁块
 * 对应事件: { type: "screenFlash", color: [r, g, b, a], time: ..., times: ..., async: true }
 */
export const screenFlashSchema: BlockSchema = {
  eventType: 'screenFlash',
  definition: {
    type: 'mota_screenFlash_s',
    message0: '屏幕闪烁 颜色 [%1,%2,%3,%4] 移动方式 %5 单次时间 %6 次数 %7 异步 %8',
    args0: [
      { type: 'field_input', name: 'R', text: '255' },
      { type: 'field_input', name: 'G', text: '255' },
      { type: 'field_input', name: 'B', text: '255' },
      { type: 'field_input', name: 'A', text: '1' },
      { type: 'field_input', name: 'MOVE_MODE', text: '' },
      { type: 'field_input', name: 'TIME', text: '100' },
      { type: 'field_input', name: 'TIMES', text: '3' },
      { type: 'field_checkbox', name: 'ASYNC', checked: false },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: BlockColours.SOUND,
    tooltip: '屏幕闪烁效果',
    helpUrl: '',
  },
  category: 'effect',
  parser: (event: EventObject, _context: ParseContext): BlockState => {
    const color = event.color as [number, number, number, number] | undefined;
    return {
      type: 'mota_screenFlash_s',
      fields: {
        R: color?.[0]?.toString() || '255',
        G: color?.[1]?.toString() || '255',
        B: color?.[2]?.toString() || '255',
        A: color?.[3]?.toString() || '1',
        MOVE_MODE: (event.moveMode as string) || '',
        TIME: (event.time as number)?.toString() || '100',
        TIMES: (event.times as number)?.toString() || '3',
        ASYNC: (event.async as boolean) || false,
      },
    };
  },
  generator: (block: Blockly.Block): string => {
    const r = block.getFieldValue('R');
    const g = block.getFieldValue('G');
    const b = block.getFieldValue('B');
    const a = block.getFieldValue('A');
    const moveMode = block.getFieldValue('MOVE_MODE');
    const time = block.getFieldValue('TIME');
    const times = block.getFieldValue('TIMES');
    const async = block.getFieldValue('ASYNC') === 'TRUE';

    const event: Record<string, unknown> = {
      type: 'screenFlash',
      color: [parseInt(r) || 255, parseInt(g) || 255, parseInt(b) || 255, parseFloat(a) || 1],
    };
    if (moveMode) event.moveMode = moveMode;

    if (time) {
      event.time = parseInt(time) || 100;
    }
    if (times) {
      event.times = parseInt(times) || 3;
    }
    if (async) {
      event.async = true;
    }

    return JSON.stringify(event) + ',\n';
  },
};

// ============================================
// setWeather 块
// ============================================

/**
 * 设置天气块
 * 对应事件: { type: "setWeather", name: "...", level: 5 }
 */
export const setWeatherSchema: BlockSchema = {
  eventType: 'setWeather',
  definition: {
    type: 'mota_setWeather_s',
    message0: '设置天气 %1 强度 %2 保持 %3',
    args0: [
      {
        type: 'field_dropdown',
        name: 'NAME',
        options: [
          ['无', ''],
          ['雨', 'rain'],
          ['雪', 'snow'],
          ['雾', 'fog'],
          ['云', 'cloud'],
          ['晴', 'sun'],
        ],
      },
      { type: 'field_input', name: 'LEVEL', text: '5' },
      { type: 'field_checkbox', name: 'KEEP', checked: false },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: BlockColours.SOUND,
    tooltip: '设置天气效果',
    helpUrl: '',
  },
  category: 'effect',
  parser: (event: EventObject): BlockState => ({
    type: 'mota_setWeather_s',
    fields: {
      NAME: String(event.name ?? ''),
      LEVEL: event.level == null ? '5' : String(event.level),
      KEEP: event.keep === true,
    },
  }),
  generator: (block: Blockly.Block): string => {
    const name = block.getFieldValue('NAME');
    if (!name) return '{"type":"setWeather"},\n';
    const event: Record<string, unknown> = {
      type: 'setWeather',
      name,
      level: Number(block.getFieldValue('LEVEL')),
    };
    if (checkbox(block, 'KEEP')) event.keep = true;
    return JSON.stringify(event) + ',\n';
  },
};

// ============================================
// vibrate 块
// ============================================

/**
 * 画面震动块
 * 对应事件: { type: "vibrate", time: ..., async: true }
 */
export const vibrateSchema: BlockSchema = {
  eventType: 'vibrate',
  definition: {
    type: 'mota_vibrate_s',
    message0: '画面震动 方向 %1 时间 %2 速度 %3 振幅 %4 异步 %5',
    args0: [
      { type: 'field_dropdown', name: 'DIRECTION', options: [['水平', 'horizontal'], ['垂直', 'vertical'], ['随机', 'random']] },
      { type: 'field_input', name: 'TIME', text: '' },
      { type: 'field_input', name: 'SPEED', text: '10' },
      { type: 'field_input', name: 'POWER', text: '10' },
      { type: 'field_checkbox', name: 'ASYNC', checked: false },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (20)
    tooltip: '画面震动效果',
    helpUrl: '',
  },
  category: 'effect',
  fieldMapping: {
    DIRECTION: 'direction',
    TIME: {
      eventField: 'time',
      parse: (v) => (v as number)?.toString() || '',
      generate: (v) => {
        const time = parseInt(v as string);
        return isNaN(time) ? undefined : time;
      },
    },
    SPEED: { eventField: 'speed', parse: (v) => expression(v), generate: (v) => expressionValue(v as string) },
    POWER: { eventField: 'power', parse: (v) => expression(v), generate: (v) => expressionValue(v as string) },
    ASYNC: {
      eventField: 'async',
      parse: (v) => (v as boolean) || false,
      generate: (v) => (v === 'TRUE' || v === true ? true : undefined),
    },
  },
};

// ============================================
// wait 块
// ============================================

/**
 * 等待用户操作块
 * 对应事件: { type: "wait", timeout: ... }
 */
export const waitSchema: BlockSchema = {
  eventType: 'wait',
  definition: {
    type: 'mota_wait_s',
    message0: '等待用户操作并获得按键或点击信息 仅检测子块 %1 超时毫秒数 %2',
    args0: [
      { type: 'field_checkbox', name: 'FORCE_CHILD', checked: true },
      { type: 'field_input', name: 'TIMEOUT', text: '0' },
    ],
    message1: '%1',
    args1: [{ type: 'input_statement', name: 'CASES' }],
    previousStatement: null,
    nextStatement: null,
    inputsInline: true,
    colour: BlockColours.SOUND,
    tooltip: '等待用户按键或点击',
    helpUrl: '',
  },
  category: 'sound',
  event: {
    match: { path: 'type', equals: 'wait' },
    template: { type: 'wait' },
    bindings: [
      { input: 'FORCE_CHILD', kind: 'field', path: 'forceChild', valueType: 'boolean', default: false, omitWhenDefault: true },
      { input: 'TIMEOUT', kind: 'field', path: 'timeout', valueType: 'number', optional: true },
      { input: 'CASES', kind: 'statement', path: 'data', optional: true },
    ],
  },
};

const waitCaseColour = 250;

export const waitKeyboardCaseSchema: BlockSchema = {
  eventType: '_wait_keyboard',
  definition: {
    type: 'mota_wait_keyboard_s',
    message0: '按键的场合 键值 %1 不进行剩余判定 %2',
    args0: [
      { type: 'field_input', name: 'KEYCODE', text: '' },
      { type: 'field_checkbox', name: 'BREAK', checked: false },
    ],
    message1: '%1',
    args1: [{ type: 'input_statement', name: 'ACTION' }],
    previousStatement: null, nextStatement: null, inputsInline: true, colour: waitCaseColour,
    tooltip: '等待键盘输入', helpUrl: '/_docs/#/instruction',
  },
  event: {
    match: { path: 'case', equals: 'keyboard' },
    template: { case: 'keyboard' },
    bindings: [
      { input: 'KEYCODE', kind: 'field', path: 'keycode', valueType: 'string' },
      { input: 'BREAK', kind: 'field', path: 'break', valueType: 'boolean', default: false, omitWhenDefault: true },
      { input: 'ACTION', kind: 'statement', path: 'action', default: [] },
    ],
  },
  interactions: [{ type: 'command', command: 'showKeyCodes', trigger: 'contextMenu' }],
};

export const waitMouseCaseSchema: BlockSchema = {
  eventType: '_wait_mouse',
  definition: {
    type: 'mota_wait_mouse_s',
    message0: '点击的场合 像素x范围 %1 ~ %2；y范围 %3 ~ %4 不进行剩余判定 %5',
    args0: [
      { type: 'field_input', name: 'PX0', text: '0' }, { type: 'field_input', name: 'PX1', text: '32' },
      { type: 'field_input', name: 'PY0', text: '0' }, { type: 'field_input', name: 'PY1', text: '32' },
      { type: 'field_checkbox', name: 'BREAK', checked: false },
    ],
    message1: '%1',
    args1: [{ type: 'input_statement', name: 'ACTION' }],
    previousStatement: null, nextStatement: null, inputsInline: true, colour: waitCaseColour,
    tooltip: '等待鼠标或触摸输入', helpUrl: '/_docs/#/instruction',
  },
  event: {
    match: { path: 'case', equals: 'mouse' },
    template: { case: 'mouse', px: [0, 32], py: [0, 32] },
    bindings: [
      { input: 'PX0', kind: 'field', path: 'px[0]', valueType: 'expression' },
      { input: 'PX1', kind: 'field', path: 'px[1]', valueType: 'expression' },
      { input: 'PY0', kind: 'field', path: 'py[0]', valueType: 'expression' },
      { input: 'PY1', kind: 'field', path: 'py[1]', valueType: 'expression' },
      { input: 'BREAK', kind: 'field', path: 'break', valueType: 'boolean', default: false, omitWhenDefault: true },
      { input: 'ACTION', kind: 'statement', path: 'action', default: [] },
    ],
  },
  interactions: [{ type: 'preview', adapter: 'waitRect' }],
  defaultInteraction: 'preview',
};

export const waitConditionCaseSchema: BlockSchema = {
  eventType: '_wait_condition',
  definition: {
    type: 'mota_wait_condition_s',
    message0: '自定义条件的场合 %1 不进行剩余判定 %2',
    args0: [
      { type: 'field_input', name: 'CONDITION', text: 'true' },
      { type: 'field_checkbox', name: 'BREAK', checked: false },
    ],
    message1: '%1', args1: [{ type: 'input_statement', name: 'ACTION' }],
    previousStatement: null, nextStatement: null, inputsInline: true, colour: waitCaseColour,
    tooltip: '等待自定义条件', helpUrl: '/_docs/#/instruction',
  },
  event: {
    match: { path: 'case', equals: 'condition' }, template: { case: 'condition' },
    bindings: [
      { input: 'CONDITION', kind: 'field', path: 'condition', valueType: 'string' },
      { input: 'BREAK', kind: 'field', path: 'break', valueType: 'boolean', default: false, omitWhenDefault: true },
      { input: 'ACTION', kind: 'statement', path: 'action', default: [] },
    ],
  },
};

export const waitTimeoutCaseSchema: BlockSchema = {
  eventType: '_wait_timeout',
  definition: {
    type: 'mota_wait_timeout_s',
    message0: '超时的场合 不进行剩余判定 %1',
    args0: [{ type: 'field_checkbox', name: 'BREAK', checked: false }],
    message1: '%1', args1: [{ type: 'input_statement', name: 'ACTION' }],
    previousStatement: null, nextStatement: null, inputsInline: true, colour: waitCaseColour,
    tooltip: '等待超时', helpUrl: '/_docs/#/instruction',
  },
  event: {
    match: { path: 'case', equals: 'timeout' }, template: { case: 'timeout' },
    bindings: [
      { input: 'BREAK', kind: 'field', path: 'break', valueType: 'boolean', default: false, omitWhenDefault: true },
      { input: 'ACTION', kind: 'statement', path: 'action', default: [] },
    ],
  },
};

// ============================================
// waitAsync 块
// ============================================

/**
 * 等待异步事件块
 * 对应事件: { type: "waitAsync" }
 */
export const waitAsyncSchema: BlockSchema = {
  eventType: 'waitAsync',
  definition: {
    type: 'mota_waitAsync_s',
    message0: '等待所有异步事件执行完毕 排除动画 %1 包含音效 %2',
    args0: [
      { type: 'field_checkbox', name: 'EXCLUDE_ANIMATES', checked: false },
      { type: 'field_checkbox', name: 'INCLUDE_SOUNDS', checked: false },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (20)
    tooltip: '等待所有异步动画、移动等执行完毕',
    helpUrl: '',
  },
  category: 'effect',
  fieldMapping: {
    EXCLUDE_ANIMATES: { eventField: 'excludeAnimates', parse: (v) => v === true, generate: (v) => v === 'TRUE' || v === true ? true : undefined },
    INCLUDE_SOUNDS: { eventField: 'includeSounds', parse: (v) => v === true, generate: (v) => v === 'TRUE' || v === true ? true : undefined },
  },
};

// ============================================
// stopAsync 块
// ============================================

/**
 * 停止异步事件块
 * 对应事件: { type: "stopAsync" }
 */
export const stopAsyncSchema: BlockSchema = {
  eventType: 'stopAsync',
  definition: {
    type: 'mota_stopAsync_s',
    message0: '立刻停止所有异步事件',
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (20)
    tooltip: '立刻停止所有异步动画、移动等',
    helpUrl: '',
  },
  category: 'effect',
  fieldMapping: {},
};

// ============================================
// 导出所有特效声音 Schema
// ============================================

export const effectSchemas: BlockSchema[] = [
  animateSchema,
  stopAnimateSchema,
  playSoundSchema,
  stopSoundSchema,
  playBgmSchema,
  pauseBgmSchema,
  resumeBgmSchema,
  setVolumeSchema,
  setCurtainSchema,
  screenFlashSchema,
  setWeatherSchema,
  vibrateSchema,
  waitSchema,
  waitKeyboardCaseSchema,
  waitMouseCaseSchema,
  waitConditionCaseSchema,
  waitTimeoutCaseSchema,
  waitAsyncSchema,
  stopAsyncSchema,
  ...legacyEffectSchemas,
];
