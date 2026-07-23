/**
 * 地图处理块 Schema
 *
 * 包含 show, hide, setBlock, battle, openDoor, move, jump, changeFloor 等地图处理相关的事件块
 */

import type * as Blockly from 'blockly';

import type { PointValue } from '../fields';
import type { BlockState, EventObject, ParseContext } from '../parser/types';
import type { BlockSchema } from '../registry/types';
import { legacyMapSchemas } from './mapLegacy';
import { expressionValue } from './legacyHelpers';

// ============================================
// 辅助函数
// ============================================

/**
 * 解析位置数组
 * 支持 [x, y] 或 [[x1, y1], [x2, y2], ...] 格式
 */
function parseLocArray(
  loc: unknown,
): { single: boolean; x: string; y: string; locs: string } {
  if (!loc) {
    return { single: true, x: '', y: '', locs: '' };
  }

  if (Array.isArray(loc)) {
    // 检查是否是单点 [x, y]
    if (loc.length === 2 && typeof loc[0] === 'number') {
      return {
        single: true,
        x: String(loc[0]),
        y: String(loc[1]),
        locs: '',
      };
    }
    // 多点 [[x1, y1], [x2, y2], ...]
    return {
      single: false,
      x: '',
      y: '',
      locs: JSON.stringify(loc),
    };
  }

  return { single: true, x: '', y: '', locs: '' };
}

/**
 * 生成位置数组
 */
function generateLocArray(
  single: boolean,
  x: string,
  y: string,
  locs: string,
): unknown[] | undefined {
  if (single) {
    if (x || y) {
      return [expressionValue(x), expressionValue(y)];
    }
    return undefined;
  }

  try {
    return JSON.parse(locs);
  } catch {
    return undefined;
  }
}

// ============================================
// show 块
// ============================================

/**
 * 显示事件块
 * 对应事件: { type: "show", loc: [...], floorId: "...", time: ..., async: true }
 */
export const showSchema: BlockSchema = {
  eventType: 'show',
  definition: {
    type: 'mota_show_s',
    message0: '显示事件 位置 [%1,%2] 或多点 %3 楼层 %4 动画时间 %5 异步 %6',
    args0: [
      { type: 'field_input', name: 'X', text: '' },
      { type: 'field_input', name: 'Y', text: '' },
      { type: 'field_input', name: 'LOCS', text: '' },
      { type: 'field_input', name: 'FLOOR_ID', text: '' },
      { type: 'field_input', name: 'TIME', text: '' },
      { type: 'field_checkbox', name: 'ASYNC', checked: false },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (180)
    tooltip: '将一个禁用事件启用。位置为空表示当前事件',
    helpUrl: '',
  },
  category: 'map',
  parser: (event: EventObject, _context: ParseContext): BlockState => {
    const { single, x, y, locs } = parseLocArray(event.loc);
    return {
      type: 'mota_show_s',
      fields: {
        X: single ? x : '',
        Y: single ? y : '',
        LOCS: single ? '' : locs,
        FLOOR_ID: (event.floorId as string) || '',
        TIME: (event.time as number)?.toString() || '',
        ASYNC: (event.async as boolean) || false,
      },
    };
  },
  generator: (block: Blockly.Block): string => {
    const x = block.getFieldValue('X');
    const y = block.getFieldValue('Y');
    const locs = block.getFieldValue('LOCS');
    const floorId = block.getFieldValue('FLOOR_ID');
    const time = block.getFieldValue('TIME');
    const async = block.getFieldValue('ASYNC') === 'TRUE';

    const event: Record<string, unknown> = { type: 'show' };

    const single = !locs;
    const loc = generateLocArray(single, x, y, locs);
    if (loc) {
      event.loc = loc;
    }

    if (floorId) {
      event.floorId = floorId;
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
// hide 块
// ============================================

/**
 * 隐藏事件块
 * 对应事件: { type: "hide", loc: [...], floorId: "...", remove: true, time: ..., async: true }
 */
export const hideSchema: BlockSchema = {
  eventType: 'hide',
  definition: {
    type: 'mota_hide_s',
    message0: '隐藏事件 位置 [%1,%2] 或多点 %3 楼层 %4 删除 %5 动画时间 %6 异步 %7',
    args0: [
      { type: 'field_input', name: 'X', text: '' },
      { type: 'field_input', name: 'Y', text: '' },
      { type: 'field_input', name: 'LOCS', text: '' },
      { type: 'field_input', name: 'FLOOR_ID', text: '' },
      { type: 'field_checkbox', name: 'REMOVE', checked: false },
      { type: 'field_input', name: 'TIME', text: '' },
      { type: 'field_checkbox', name: 'ASYNC', checked: false },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (180)
    tooltip: '将一个事件禁用。位置为空表示当前事件',
    helpUrl: '',
  },
  category: 'map',
  parser: (event: EventObject, _context: ParseContext): BlockState => {
    const { single, x, y, locs } = parseLocArray(event.loc);
    return {
      type: 'mota_hide_s',
      fields: {
        X: single ? x : '',
        Y: single ? y : '',
        LOCS: single ? '' : locs,
        FLOOR_ID: (event.floorId as string) || '',
        REMOVE: (event.remove as boolean) || false,
        TIME: (event.time as number)?.toString() || '',
        ASYNC: (event.async as boolean) || false,
      },
    };
  },
  generator: (block: Blockly.Block): string => {
    const x = block.getFieldValue('X');
    const y = block.getFieldValue('Y');
    const locs = block.getFieldValue('LOCS');
    const floorId = block.getFieldValue('FLOOR_ID');
    const remove = block.getFieldValue('REMOVE') === 'TRUE';
    const time = block.getFieldValue('TIME');
    const async = block.getFieldValue('ASYNC') === 'TRUE';

    const event: Record<string, unknown> = { type: 'hide' };

    const single = !locs;
    const loc = generateLocArray(single, x, y, locs);
    if (loc) {
      event.loc = loc;
    }

    if (floorId) {
      event.floorId = floorId;
    }
    if (remove) {
      event.remove = true;
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
// setBlock 块
// ============================================

/**
 * 设置图块块
 * 对应事件: { type: "setBlock", number: "...", loc: [...], floorId: "..." }
 */
export const setBlockSchema: BlockSchema = {
  eventType: 'setBlock',
  definition: {
    type: 'mota_setBlock_s',
    message0: '设置图块 %1 位置 [%2,%3] 或多点 %4 楼层 %5 动画时间 %6 异步 %7',
    args0: [
      { type: 'field_input', name: 'NUMBER', text: '' },
      { type: 'field_input', name: 'X', text: '' },
      { type: 'field_input', name: 'Y', text: '' },
      { type: 'field_input', name: 'LOCS', text: '' },
      { type: 'field_input', name: 'FLOOR_ID', text: '' },
      { type: 'field_input', name: 'TIME', text: '' },
      { type: 'field_checkbox', name: 'ASYNC', checked: false },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (180)
    tooltip: '将某个点变成其他图块。number 可以是图块 ID 或数字',
    helpUrl: '',
  },
  category: 'map',
  parser: (event: EventObject, _context: ParseContext): BlockState => {
    const { single, x, y, locs } = parseLocArray(event.loc);
    return {
      type: 'mota_setBlock_s',
      fields: {
        NUMBER: String(event.number ?? ''),
        X: single ? x : '',
        Y: single ? y : '',
        LOCS: single ? '' : locs,
        FLOOR_ID: (event.floorId as string) || '',
        TIME: (event.time as number)?.toString() || '',
        ASYNC: (event.async as boolean) || false,
      },
    };
  },
  generator: (block: Blockly.Block): string => {
    const number = block.getFieldValue('NUMBER');
    const x = block.getFieldValue('X');
    const y = block.getFieldValue('Y');
    const locs = block.getFieldValue('LOCS');
    const floorId = block.getFieldValue('FLOOR_ID');
    const time = block.getFieldValue('TIME');
    const async = block.getFieldValue('ASYNC') === 'TRUE';

    const event: Record<string, unknown> = { type: 'setBlock', number };

    const single = !locs;
    const loc = generateLocArray(single, x, y, locs);
    if (loc) {
      event.loc = loc;
    }

    if (floorId) {
      event.floorId = floorId;
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
// battle 块
// ============================================

/**
 * 强制战斗块
 * 对应事件: { type: "battle", id: "..." } 或 { type: "battle", loc: [x, y] }
 */
export const battleSchema: BlockSchema = {
  eventType: 'battle',
  definition: {
    type: 'mota_battle_s',
    message0: '强制战斗 怪物ID %1 或位置 [%2,%3]',
    args0: [
      { type: 'field_input', name: 'ID', text: '' },
      { type: 'field_input', name: 'X', text: '' },
      { type: 'field_input', name: 'Y', text: '' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (180)
    tooltip: '强制与某个怪物战斗。可以指定怪物 ID 或位置',
    helpUrl: '',
  },
  category: 'map',
  parser: (event: EventObject, _context: ParseContext): BlockState => {
    const loc = event.loc as [number, number] | undefined;
    return {
      type: 'mota_battle_s',
      fields: {
        ID: (event.id as string) || '',
        X: loc?.[0]?.toString() || (event.x as number)?.toString() || '',
        Y: loc?.[1]?.toString() || (event.y as number)?.toString() || '',
      },
    };
  },
  generator: (block: Blockly.Block): string => {
    const id = block.getFieldValue('ID');
    const x = block.getFieldValue('X');
    const y = block.getFieldValue('Y');

    const event: Record<string, unknown> = { type: 'battle' };

    if (id) {
      event.id = id;
    } else if (x || y) {
      event.loc = [expressionValue(x), expressionValue(y)];
    }

    return JSON.stringify(event) + ',\n';
  },
};

// ============================================
// openDoor 块
// ============================================

/**
 * 开门块
 * 对应事件: { type: "openDoor", loc: [x, y], floorId: "...", needKey: true }
 */
export const openDoorSchema: BlockSchema = {
  eventType: 'openDoor',
  definition: {
    type: 'mota_openDoor_s',
    message0: '开门 位置 [%1,%2] 楼层 %3 需要钥匙 %4 异步 %5',
    args0: [
      { type: 'field_input', name: 'X', text: '' },
      { type: 'field_input', name: 'Y', text: '' },
      { type: 'field_input', name: 'FLOOR_ID', text: '' },
      { type: 'field_checkbox', name: 'NEED_KEY', checked: false },
      { type: 'field_checkbox', name: 'ASYNC', checked: false },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (180)
    tooltip: '无需钥匙打开一扇门或暗墙。位置为空表示当前位置',
    helpUrl: '',
  },
  category: 'map',
  parser: (event: EventObject, _context: ParseContext): BlockState => {
    const loc = event.loc as [number, number] | undefined;
    return {
      type: 'mota_openDoor_s',
      fields: {
        X: loc?.[0]?.toString() || '',
        Y: loc?.[1]?.toString() || '',
        FLOOR_ID: (event.floorId as string) || '',
        NEED_KEY: (event.needKey as boolean) || false,
        ASYNC: (event.async as boolean) || false,
      },
    };
  },
  generator: (block: Blockly.Block): string => {
    const x = block.getFieldValue('X');
    const y = block.getFieldValue('Y');
    const floorId = block.getFieldValue('FLOOR_ID');
    const needKey = block.getFieldValue('NEED_KEY') === 'TRUE';
    const async = block.getFieldValue('ASYNC') === 'TRUE';

    const event: Record<string, unknown> = { type: 'openDoor' };

    if (x || y) {
      event.loc = [expressionValue(x), expressionValue(y)];
    }
    if (floorId) {
      event.floorId = floorId;
    }
    if (needKey) {
      event.needKey = true;
    }
    if (async) {
      event.async = true;
    }

    return JSON.stringify(event) + ',\n';
  },
};

// ============================================
// closeDoor 块
// ============================================

/**
 * 关门块
 * 对应事件: { type: "closeDoor", id: "...", loc: [x, y], floorId: "..." }
 */
export const closeDoorSchema: BlockSchema = {
  eventType: 'closeDoor',
  definition: {
    type: 'mota_closeDoor_s',
    message0: '关门 门ID %1 位置 [%2,%3] 楼层 %4 异步 %5',
    args0: [
      { type: 'field_input', name: 'ID', text: 'yellowDoor' },
      { type: 'field_input', name: 'X', text: '' },
      { type: 'field_input', name: 'Y', text: '' },
      { type: 'field_input', name: 'FLOOR_ID', text: '' },
      { type: 'field_checkbox', name: 'ASYNC', checked: false },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (180)
    tooltip: '在某个位置生成一扇关上的门',
    helpUrl: '',
  },
  category: 'map',
  parser: (event: EventObject, _context: ParseContext): BlockState => {
    const loc = event.loc as [number, number] | undefined;
    return {
      type: 'mota_closeDoor_s',
      fields: {
        ID: (event.id as string) || 'yellowDoor',
        X: loc?.[0]?.toString() || '',
        Y: loc?.[1]?.toString() || '',
        FLOOR_ID: (event.floorId as string) || '',
        ASYNC: (event.async as boolean) || false,
      },
    };
  },
  generator: (block: Blockly.Block): string => {
    const id = block.getFieldValue('ID');
    const x = block.getFieldValue('X');
    const y = block.getFieldValue('Y');
    const floorId = block.getFieldValue('FLOOR_ID');
    const async = block.getFieldValue('ASYNC') === 'TRUE';

    const event: Record<string, unknown> = { type: 'closeDoor', id };

    if (x || y) {
      event.loc = [expressionValue(x), expressionValue(y)];
    }
    if (floorId) {
      event.floorId = floorId;
    }
    if (async) {
      event.async = true;
    }

    return JSON.stringify(event) + ',\n';
  },
};

// ============================================
// changeFloor 块
// ============================================

/**
 * 楼层切换块
 * 对应事件: { type: "changeFloor", floorId: "...", loc: [x, y], direction: "...", time: ... }
 *
 * 使用 field_point 合并 floorId、x、y 三个字段为一个结构化字段
 */
export const changeFloorSchema: BlockSchema = {
  eventType: 'changeFloor',
  definition: {
    type: 'mota_changeFloor_s',
    message0: '切换楼层 %1 目标楼层 %2 楼梯落点 %3 朝向 %4 动画时间 %5',
    args0: [
      {
        type: 'field_point',
        name: 'POSITION',
        includeFloor: true,
      },
      {
        type: 'field_input',
        name: 'FLOOR_ID',
        text: '',
      },
      {
        type: 'field_dropdown',
        name: 'STAIR',
        options: [['坐标', ''], ['上楼梯', 'upFloor'], ['下楼梯', 'downFloor'], ['保持原位置', ':now']],
      },
      {
        type: 'field_dropdown',
        name: 'DIRECTION',
        options: [
          ['保持', ''],
          ['上', 'up'],
          ['下', 'down'],
          ['左', 'left'],
          ['右', 'right'],
        ],
      },
      { type: 'field_input', name: 'TIME', text: '' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (180)
    tooltip: '切换到另一个楼层，点击坐标可打开地图选点器',
    helpUrl: '',
  },
  category: 'map',
  parser: (event: EventObject, _context: ParseContext): BlockState => {
    const loc = event.loc as [PointValue['x'], PointValue['y']] | undefined;
    const position: PointValue = {
      x: loc?.[0] ?? 0,
      y: loc?.[1] ?? 0,
      floorId: (event.floorId as string) || undefined,
    };

    return {
      type: 'mota_changeFloor_s',
      fields: {
        POSITION: event.stair ? null : position,
        FLOOR_ID: (event.floorId as string) || '',
        STAIR: (event.stair as string) || '',
        DIRECTION: (event.direction as string) || '',
        TIME: (event.time as number)?.toString() || '',
      },
    };
  },
  generator: (block: Blockly.Block): string => {
    const position = block.getFieldValue('POSITION') as PointValue | null;
    const floorId = block.getFieldValue('FLOOR_ID');
    const stair = block.getFieldValue('STAIR');
    const direction = block.getFieldValue('DIRECTION');
    const time = block.getFieldValue('TIME');

    const event: Record<string, unknown> = { type: 'changeFloor' };

    if (floorId || position?.floorId) event.floorId = floorId || position?.floorId;
    if (stair) event.stair = stair;
    else if (position) {
      event.loc = [position.x, position.y];
    }
    if (direction) {
      event.direction = direction;
    }
    if (time) {
      event.time = parseInt(time) || 0;
    }

    return JSON.stringify(event) + ',\n';
  },
};

// ============================================
// changePos 块
// ============================================

/**
 * 位置切换块
 * 对应事件: { type: "changePos", loc: [x, y], direction: "..." }
 */
export const changePosSchema: BlockSchema = {
  eventType: 'changePos',
  definition: {
    type: 'mota_changePos_s',
    message0: '切换位置 [%1,%2] 朝向 %3',
    args0: [
      { type: 'field_input', name: 'X', text: '' },
      { type: 'field_input', name: 'Y', text: '' },
      {
        type: 'field_dropdown',
        name: 'DIRECTION',
        options: [
          ['保持', ''],
          ['上', 'up'],
          ['下', 'down'],
          ['左', 'left'],
          ['右', 'right'],
        ],
      },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (180)
    tooltip: '在同一楼层内切换勇士位置',
    helpUrl: '',
  },
  category: 'map',
  parser: (event: EventObject, _context: ParseContext): BlockState => {
    const loc = event.loc as [number, number] | undefined;
    return {
      type: 'mota_changePos_s',
      fields: {
        X: loc?.[0]?.toString() || '',
        Y: loc?.[1]?.toString() || '',
        DIRECTION: (event.direction as string) || '',
      },
    };
  },
  generator: (block: Blockly.Block): string => {
    const x = block.getFieldValue('X');
    const y = block.getFieldValue('Y');
    const direction = block.getFieldValue('DIRECTION');

    const event: Record<string, unknown> = { type: 'changePos' };

    if (x || y) {
      event.loc = [expressionValue(x), expressionValue(y)];
    }
    if (direction) {
      event.direction = direction;
    }

    return JSON.stringify(event) + ',\n';
  },
};

// ============================================
// move 块
// ============================================

/**
 * 移动事件块
 * 对应事件: { type: "move", loc: [x, y], steps: [...], time: ..., async: true }
 */
export const moveSchema: BlockSchema = {
  eventType: 'move',
  definition: {
    type: 'mota_move_s',
    message0: '移动事件 位置 [%1,%2] 步骤 %3 移动速度 %4 保留移动 %5 异步 %6',
    args0: [
      { type: 'field_input', name: 'X', text: '' },
      { type: 'field_input', name: 'Y', text: '' },
      { type: 'field_input', name: 'STEPS', text: '["up","down"]' },
      { type: 'field_input', name: 'TIME', text: '' },
      { type: 'field_checkbox', name: 'KEEP', checked: false },
      { type: 'field_checkbox', name: 'ASYNC', checked: false },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (180)
    tooltip: '移动某个事件。steps 是方向数组',
    helpUrl: '',
  },
  category: 'map',
  parser: (event: EventObject, _context: ParseContext): BlockState => {
    const loc = event.loc as [number, number] | undefined;
    const steps = event.steps as string[] | undefined;
    return {
      type: 'mota_move_s',
      fields: {
        X: loc?.[0]?.toString() || '',
        Y: loc?.[1]?.toString() || '',
        STEPS: steps ? JSON.stringify(steps) : '',
        TIME: (event.time as number)?.toString() || '',
        KEEP: (event.keep as boolean) || false,
        ASYNC: (event.async as boolean) || false,
      },
    };
  },
  generator: (block: Blockly.Block): string => {
    const x = block.getFieldValue('X');
    const y = block.getFieldValue('Y');
    const stepsStr = block.getFieldValue('STEPS');
    const time = block.getFieldValue('TIME');
    const keep = block.getFieldValue('KEEP') === 'TRUE';
    const async = block.getFieldValue('ASYNC') === 'TRUE';

    const event: Record<string, unknown> = { type: 'move' };

    if (x || y) {
      event.loc = [expressionValue(x), expressionValue(y)];
    }
    try {
      event.steps = JSON.parse(stepsStr);
    } catch {
      event.steps = [];
    }
    if (time) {
      event.time = parseInt(time) || 0;
    }
    if (keep) {
      event.keep = true;
    }
    if (async) {
      event.async = true;
    }

    return JSON.stringify(event) + ',\n';
  },
};

// ============================================
// moveHero 块
// ============================================

/**
 * 移动勇士块
 * 对应事件: { type: "moveHero", steps: [...], time: ..., async: true }
 */
export const moveHeroSchema: BlockSchema = {
  eventType: 'moveHero',
  definition: {
    type: 'mota_moveHero_s',
    message0: '移动勇士 步骤 %1 移动速度 %2 异步 %3',
    args0: [
      { type: 'field_input', name: 'STEPS', text: '["up","down"]' },
      { type: 'field_input', name: 'TIME', text: '' },
      { type: 'field_checkbox', name: 'ASYNC', checked: false },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (180)
    tooltip: '让勇士按指定步骤移动',
    helpUrl: '',
  },
  category: 'map',
  parser: (event: EventObject, _context: ParseContext): BlockState => {
    const steps = event.steps as string[] | undefined;
    return {
      type: 'mota_moveHero_s',
      fields: {
        STEPS: steps ? JSON.stringify(steps) : '',
        TIME: (event.time as number)?.toString() || '',
        ASYNC: (event.async as boolean) || false,
      },
    };
  },
  generator: (block: Blockly.Block): string => {
    const stepsStr = block.getFieldValue('STEPS');
    const time = block.getFieldValue('TIME');
    const async = block.getFieldValue('ASYNC') === 'TRUE';

    const event: Record<string, unknown> = { type: 'moveHero' };

    try {
      event.steps = JSON.parse(stepsStr);
    } catch {
      event.steps = [];
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
// jump 块
// ============================================

/**
 * 跳跃事件块
 * 对应事件: { type: "jump", from: [x, y], to: [x, y], time: ..., async: true }
 */
export const jumpSchema: BlockSchema = {
  eventType: 'jump',
  definition: {
    type: 'mota_jump_s',
    message0: '跳跃事件 从 [%1,%2] 终点模式 %3 坐标 [%4,%5] 动画时间 %6 保留移动 %7 异步 %8',
    args0: [
      { type: 'field_input', name: 'FROM_X', text: '' },
      { type: 'field_input', name: 'FROM_Y', text: '' },
      { type: 'field_dropdown', name: 'TO_MODE', options: [['绝对位置', 'to'], ['坐标增量', 'dxy']] },
      { type: 'field_input', name: 'TO_X', text: '' },
      { type: 'field_input', name: 'TO_Y', text: '' },
      { type: 'field_input', name: 'TIME', text: '' },
      { type: 'field_checkbox', name: 'KEEP', checked: false },
      { type: 'field_checkbox', name: 'ASYNC', checked: false },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (180)
    tooltip: '让某个事件跳跃到另一个位置',
    helpUrl: '',
  },
  category: 'map',
  parser: (event: EventObject, _context: ParseContext): BlockState => {
    const from = event.from as [number, number] | undefined;
    const mode = Array.isArray(event.dxy) ? 'dxy' : 'to';
    const to = event[mode] as unknown[] | undefined;
    return {
      type: 'mota_jump_s',
      fields: {
        FROM_X: from?.[0]?.toString() || '',
        FROM_Y: from?.[1]?.toString() || '',
        TO_MODE: mode,
        TO_X: to?.[0]?.toString() || '',
        TO_Y: to?.[1]?.toString() || '',
        TIME: (event.time as number)?.toString() || '',
        KEEP: (event.keep as boolean) || false,
        ASYNC: (event.async as boolean) || false,
      },
    };
  },
  generator: (block: Blockly.Block): string => {
    const fromX = block.getFieldValue('FROM_X');
    const fromY = block.getFieldValue('FROM_Y');
    const toMode = block.getFieldValue('TO_MODE');
    const toX = block.getFieldValue('TO_X');
    const toY = block.getFieldValue('TO_Y');
    const time = block.getFieldValue('TIME');
    const keep = block.getFieldValue('KEEP') === 'TRUE';
    const async = block.getFieldValue('ASYNC') === 'TRUE';

    const event: Record<string, unknown> = { type: 'jump' };

    if (fromX || fromY) {
      event.from = [expressionValue(fromX), expressionValue(fromY)];
    }
    if (toX || toY) {
      event[toMode] = [expressionValue(toX), expressionValue(toY)];
    }
    if (time) {
      event.time = parseInt(time) || 0;
    }
    if (keep) {
      event.keep = true;
    }
    if (async) {
      event.async = true;
    }

    return JSON.stringify(event) + ',\n';
  },
};

// ============================================
// jumpHero 块
// ============================================

/**
 * 跳跃勇士块
 * 对应事件: { type: "jumpHero", loc: [x, y], time: ..., async: true }
 */
export const jumpHeroSchema: BlockSchema = {
  eventType: 'jumpHero',
  definition: {
    type: 'mota_jumpHero_s',
    message0: '跳跃勇士 %1 坐标 [%2,%3] 动画时间 %4 异步 %5',
    args0: [
      { type: 'field_dropdown', name: 'MODE', options: [['绝对位置', 'loc'], ['坐标增量', 'dxy']] },
      { type: 'field_input', name: 'X', text: '' },
      { type: 'field_input', name: 'Y', text: '' },
      { type: 'field_input', name: 'TIME', text: '' },
      { type: 'field_checkbox', name: 'ASYNC', checked: false },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (180)
    tooltip: '让勇士跳跃到某个位置',
    helpUrl: '',
  },
  category: 'map',
  parser: (event: EventObject, _context: ParseContext): BlockState => {
    const mode = Array.isArray(event.dxy) ? 'dxy' : 'loc';
    const loc = event[mode] as unknown[] | undefined;
    return {
      type: 'mota_jumpHero_s',
      fields: {
        MODE: mode,
        X: loc?.[0]?.toString() || '',
        Y: loc?.[1]?.toString() || '',
        TIME: (event.time as number)?.toString() || '',
        ASYNC: (event.async as boolean) || false,
      },
    };
  },
  generator: (block: Blockly.Block): string => {
    const mode = block.getFieldValue('MODE');
    const x = block.getFieldValue('X');
    const y = block.getFieldValue('Y');
    const time = block.getFieldValue('TIME');
    const async = block.getFieldValue('ASYNC') === 'TRUE';

    const event: Record<string, unknown> = { type: 'jumpHero' };

    if (x || y) {
      event[mode] = [expressionValue(x), expressionValue(y)];
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
// 导出所有地图处理 Schema
// ============================================

export const mapSchemas: BlockSchema[] = [
  showSchema,
  hideSchema,
  setBlockSchema,
  battleSchema,
  openDoorSchema,
  closeDoorSchema,
  changeFloorSchema,
  changePosSchema,
  moveSchema,
  moveHeroSchema,
  jumpSchema,
  jumpHeroSchema,
  ...legacyMapSchemas,
];
