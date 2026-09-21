/**
 * 入口块 Schema
 *
 * 包含所有入口类型块（_m 后缀），这些是工作区的顶级块
 */

import type * as Blockly from 'blockly';
import { javascriptGenerator } from 'blockly/javascript';
import JSON5 from 'json5';

import type { BlockState, ConnectionState, EventData, ParseContext } from '../parser/types';
import type { BlockSchema } from '../registry/types';
import { parseEventList } from '../registry/utils';
import { BlockColours } from './colours';
import { CHANGE_FLOOR_VISIBILITY_EXTENSION } from '../extensions';
import {
  B_0_LIST_OPTIONS,
  DIRECTION_EX_LIST_OPTIONS,
  FLOOR_LIST_OPTIONS,
  IGNORE_CHANGE_FLOOR_LIST_OPTIONS,
  STAIR_LIST_OPTIONS,
} from './dropdowns';

// ============================================
// 简单入口块工厂函数
// ============================================

/**
 * 创建简单入口块 Schema
 *
 * 简单入口块只包含一个 action 语句列表，输出为数组格式 [...]
 */
function createSimpleEntrySchema(config: {
  type: string;
  label: string;
  tooltip: string;
  eventType: string;
}): BlockSchema {
  const blockType = `mota_${config.type}`;

  return {
    eventType: config.eventType,
    definition: {
      type: blockType,
      message0: `${config.label} %1 %2`,
      args0: [
        { type: 'input_dummy' },
        {
          type: 'input_statement',
          name: 'ACTION',
        },
      ],
      colour: 'auto', // 使用 category 默认颜色 (250)
      tooltip: config.tooltip,
      helpUrl: '/_docs/#/instruction',
    },
    category: 'entry',
    parser: (event: unknown, context: ParseContext): BlockState => {
      // 入口块解析：event 可能是数组或对象
      let events: EventData[] = [];

      if (Array.isArray(event)) {
        events = event;
      } else if (event && typeof event === 'object' && 'data' in event) {
        events = (event as { data: EventData[] }).data || [];
      }

      const inputs: Record<string, { block?: BlockState }> = {};
      const actionBlock = parseEventList(events, context);
      if (actionBlock) {
        inputs.ACTION = { block: actionBlock };
      }

      return {
        type: blockType,
        inputs,
      };
    },
    generator: (block: Blockly.Block): string => {
      const action = javascriptGenerator.statementToCode(block, 'ACTION');
      return `[\n${action}]\n`;
    },
  };
}

// ============================================
// 简单入口块定义
// ============================================

/**
 * common_m - 编辑事件（通用入口）
 */
export const commonEntrySchema = createSimpleEntrySchema({
  type: 'common_m',
  label: '编辑事件',
  tooltip: '编辑事件',
  eventType: 'entry:common',
});

/**
 * beforeBattle_m - 战斗开始前
 */
export const beforeBattleEntrySchema = createSimpleEntrySchema({
  type: 'beforeBattle_m',
  label: '战斗开始前',
  tooltip: '战斗开始前',
  eventType: 'entry:beforeBattle',
});

/**
 * afterBattle_m - 战斗结束后
 */
export const afterBattleEntrySchema = createSimpleEntrySchema({
  type: 'afterBattle_m',
  label: '战斗结束后',
  tooltip: '系统引发的战后',
  eventType: 'entry:afterBattle',
});

/**
 * afterOpenDoor_m - 打开门后
 */
export const afterOpenDoorEntrySchema = createSimpleEntrySchema({
  type: 'afterOpenDoor_m',
  label: '打开门后',
  tooltip: '系统引发的自定义事件',
  eventType: 'entry:afterOpenDoor',
});

/**
 * firstArrive_m - 首次到达楼层
 */
export const firstArriveEntrySchema = createSimpleEntrySchema({
  type: 'firstArrive_m',
  label: '首次到达楼层',
  tooltip: '首次到达楼层',
  eventType: 'entry:firstArrive',
});

/**
 * eachArrive_m - 每次到达楼层
 */
export const eachArriveEntrySchema = createSimpleEntrySchema({
  type: 'eachArrive_m',
  label: '每次到达楼层',
  tooltip: '每次到达楼层',
  eventType: 'entry:eachArrive',
});

/**
 * commonEvent_m - 公共事件
 */
export const commonEventEntrySchema = createSimpleEntrySchema({
  type: 'commonEvent_m',
  label: '公共事件',
  tooltip: '公共事件',
  eventType: 'entry:commonEvent',
});

/**
 * item_m - 使用道具事件
 */
export const itemEntrySchema = createSimpleEntrySchema({
  type: 'item_m',
  label: '使用道具事件',
  tooltip: '使用道具事件',
  eventType: 'entry:item',
});

// ============================================
// 复杂入口块
// ============================================

/**
 * event_m - 地图事件
 *
 * 最复杂的入口块，包含多个配置字段
 * 当所有字段为默认值时，输出简化为纯数组
 */
export const eventEntrySchema: BlockSchema = {
  eventType: 'entry:event',
  definition: {
    type: 'mota_event_m',
    message0: '事件 %1 覆盖触发器 %2 启用 %3 通行状态 %4 显伤 %5 不透明度 %6',
    args0: [
      { type: 'input_dummy' },
      { type: 'field_checkbox', name: 'TRIGGER', checked: false },
      { type: 'field_checkbox', name: 'ENABLE', checked: true },
      { type: 'field_dropdown', name: 'NO_PASS', options: B_0_LIST_OPTIONS },
      { type: 'field_checkbox', name: 'DISPLAY_DAMAGE', checked: true },
      { type: 'field_number', name: 'OPACITY', value: 1, min: 0, max: 1, precision: 0.01 },
    ],
    message1: '该点特效 虚化 %1 色相 %2 灰度 %3 反色 %4 阴影 %5',
    args1: [
      { type: 'field_number', name: 'BLUR', value: 0, min: 0 },
      { type: 'field_number', name: 'HUE', value: 0, min: 0, max: 359 },
      { type: 'field_number', name: 'GRAYSCALE', value: 0, min: 0, max: 1, precision: 0.01 },
      { type: 'field_checkbox', name: 'INVERT', checked: false },
      { type: 'field_number', name: 'SHADOW', value: 0, min: 0 },
    ],
    message2: '%1 %2',
    args2: [{ type: 'input_dummy' }, { type: 'input_statement', name: 'ACTION' }],
    colour: 'auto', // 使用 category 默认颜色 (250)
    tooltip: '编辑魔塔的事件',
    helpUrl: '/_docs/#/instruction',
  },
  category: 'entry',
  parser: (event: unknown, context: ParseContext): BlockState => {
    // 入口块解析
    let events: EventData[] = [];
    let trigger = false;
    let enable = true;
    let noPass: string | boolean | null = null;
    let displayDamage = true;
    let opacity = 1;
    let blur = 0;
    let hue = 0;
    let grayscale = 0;
    let invert = false;
    let shadow = 0;

    if (Array.isArray(event)) {
      // 简化格式：纯数组
      events = event;
    } else if (event && typeof event === 'object') {
      const obj = event as Record<string, unknown>;
      trigger = obj.trigger === 'action';
      enable = obj.enable !== false;
      noPass = (obj.noPass as string | boolean | null) ?? null;
      displayDamage = obj.displayDamage !== false;
      opacity = (obj.opacity as number) ?? 1;
      if (obj.filter && typeof obj.filter === 'object') {
        const filter = obj.filter as Record<string, unknown>;
        blur = (filter.blur as number) ?? 0;
        hue = (filter.hue as number) ?? 0;
        grayscale = (filter.grayscale as number) ?? 0;
        invert = (filter.invert as boolean) ?? false;
        shadow = (filter.shadow as number) ?? 0;
      }
      events = (obj.data as EventData[]) || [];
    }

    const inputs: Record<string, ConnectionState> = {};
    const actionBlock = parseEventList(events, context);
    if (actionBlock) {
      inputs.ACTION = { block: actionBlock };
    }

    // noPass 值转换
    let noPassValue = 'null';
    if (noPass === true || noPass === 'true') noPassValue = 'true';
    else if (noPass === false || noPass === 'false') noPassValue = 'false';

    return {
      type: 'mota_event_m',
      fields: {
        TRIGGER: trigger,
        ENABLE: enable,
        NO_PASS: noPassValue,
        DISPLAY_DAMAGE: displayDamage,
        OPACITY: opacity,
        BLUR: blur,
        HUE: hue,
        GRAYSCALE: grayscale,
        INVERT: invert,
        SHADOW: shadow,
      },
      inputs,
    };
  },
  generator: (block: Blockly.Block): string => {
    const trigger = block.getFieldValue('TRIGGER') === 'TRUE';
    const enable = block.getFieldValue('ENABLE') === 'TRUE';
    const noPassStr = block.getFieldValue('NO_PASS');
    const displayDamage = block.getFieldValue('DISPLAY_DAMAGE') === 'TRUE';
    const opacity = parseFloat(block.getFieldValue('OPACITY')) || 1;
    const blur = parseFloat(block.getFieldValue('BLUR')) || 0;
    const hue = parseInt(block.getFieldValue('HUE'), 10) || 0;
    const grayscale = parseFloat(block.getFieldValue('GRAYSCALE')) || 0;
    const invert = block.getFieldValue('INVERT') === 'TRUE';
    const shadow = parseFloat(block.getFieldValue('SHADOW')) || 0;

    const action = javascriptGenerator.statementToCode(block, 'ACTION');

    // noPass 值转换
    let noPass: boolean | null = null;
    if (noPassStr === 'true') noPass = true;
    else if (noPassStr === 'false') noPass = false;

    // 检查是否所有值都是默认值，如果是则简化输出
    const isDefault =
      !trigger &&
      enable &&
      noPass === null &&
      displayDamage &&
      opacity === 1 &&
      blur === 0 &&
      hue === 0 &&
      grayscale === 0 &&
      !invert &&
      shadow === 0;

    if (isDefault) {
      // 简化输出：纯数组
      return `[\n${action}]\n`;
    }

    // 完整输出
    const code: Record<string, unknown> = {
      trigger: trigger ? 'action' : null,
      enable,
      noPass,
      displayDamage,
      opacity,
      filter: {
        blur,
        hue,
        grayscale,
        invert,
        shadow,
      },
      data: '__DATA__',
    };

    let result = JSON.stringify(code, null, 2);
    result = result.replace('"__DATA__"', `[\n${action}]`);
    return result + '\n';
  },
};

/**
 * autoEvent_m - 自动事件
 */
export const autoEventEntrySchema: BlockSchema = {
  eventType: 'entry:autoEvent',
  definition: {
    type: 'mota_autoEvent_m',
    message0: '自动事件： 触发条件 %1 优先级 %2',
    args0: [
      { type: 'field_multilinetext', name: 'CONDITION', text: 'flag:__door__===2' },
      { type: 'field_number', name: 'PRIORITY', value: 0 },
    ],
    message1: '仅在本层检测 %1 事件流中延迟执行 %2 允许多次执行 %3',
    args1: [
      { type: 'field_checkbox', name: 'CURRENT_FLOOR', checked: true },
      { type: 'field_checkbox', name: 'DELAY_EXECUTE', checked: false },
      { type: 'field_checkbox', name: 'MULTI_EXECUTE', checked: false },
    ],
    message2: '%1 %2',
    args2: [{ type: 'input_dummy' }, { type: 'input_statement', name: 'ACTION' }],
    colour: 'auto', // 使用 category 默认颜色 (250)
    tooltip: '自动事件',
    helpUrl: '/_docs/#/instruction',
  },
  category: 'entry',
  parser: (event: unknown, context: ParseContext): BlockState => {
    let condition = 'flag:__door__===2';
    let priority = 0;
    let currentFloor = true;
    let delayExecute = false;
    let multiExecute = false;
    let events: EventData[] = [];

    if (event && typeof event === 'object') {
      const obj = event as Record<string, unknown>;
      condition = (obj.condition as string) || condition;
      priority = (obj.priority as number) ?? 0;
      currentFloor = obj.currentFloor !== false;
      delayExecute = (obj.delayExecute as boolean) ?? false;
      multiExecute = (obj.multiExecute as boolean) ?? false;
      events = (obj.data as EventData[]) || [];
    }

    const inputs: Record<string, ConnectionState> = {};
    const actionBlock = parseEventList(events, context);
    if (actionBlock) {
      inputs.ACTION = { block: actionBlock };
    }

    return {
      type: 'mota_autoEvent_m',
      fields: {
        CONDITION: condition,
        PRIORITY: priority,
        CURRENT_FLOOR: currentFloor,
        DELAY_EXECUTE: delayExecute,
        MULTI_EXECUTE: multiExecute,
      },
      inputs,
    };
  },
  generator: (block: Blockly.Block): string => {
    const condition = block.getFieldValue('CONDITION') || '';
    const priority = parseInt(block.getFieldValue('PRIORITY'), 10) || 0;
    const currentFloor = block.getFieldValue('CURRENT_FLOOR') === 'TRUE';
    const delayExecute = block.getFieldValue('DELAY_EXECUTE') === 'TRUE';
    const multiExecute = block.getFieldValue('MULTI_EXECUTE') === 'TRUE';

    const action = javascriptGenerator.statementToCode(block, 'ACTION');

    // 转义条件字符串
    const escapedCondition = condition.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

    const code = {
      condition: '__CONDITION__',
      currentFloor,
      priority,
      delayExecute,
      multiExecute,
      data: '__DATA__',
    };

    let result = JSON.stringify(code, null, 2);
    result = result.replace('"__CONDITION__"', `"${escapedCondition}"`);
    result = result.replace('"__DATA__"', `[\n${action}]`);
    return result + '\n';
  },
};

/**
 * changeFloor_m - 楼梯/传送门
 */
export const changeFloorEntrySchema: BlockSchema = {
  eventType: 'entry:changeFloor',
  definition: {
    type: 'mota_changeFloor_m',
    message0: '楼梯, 传送门 %1 %2 %3 %4',
    args0: [
      { type: 'input_dummy' },
      { type: 'field_dropdown', name: 'FLOOR_LIST', options: FLOOR_LIST_OPTIONS },
      { type: 'field_input', name: 'FLOOR_ID', text: 'MT0' },
      { type: 'field_dropdown', name: 'STAIR', options: STAIR_LIST_OPTIONS },
    ],
    // 坐标行：使用 field_label 使标签可被隐藏
    message1: '%1 %2 %3 %4 朝向 %5 动画时间 %6 穿透性 %7',
    args1: [
      { type: 'field_label', name: 'LABEL_X', text: 'x' },
      { type: 'field_input', name: 'POS_X', text: '' },
      { type: 'field_label', name: 'LABEL_Y', text: ', y' },
      { type: 'field_input', name: 'POS_Y', text: '' },
      { type: 'field_dropdown', name: 'DIRECTION', options: DIRECTION_EX_LIST_OPTIONS },
      { type: 'field_input', name: 'TIME', text: '' },
      { type: 'field_dropdown', name: 'IGNORE_CHANGE_FLOOR', options: IGNORE_CHANGE_FLOOR_LIST_OPTIONS },
    ],
    colour: 'auto', // 使用 category 默认颜色 (250)
    tooltip:
      '楼梯, 传送门, 如果目标楼层有多个楼梯, 写upFloor或downFloor可能会导致到达的楼梯不确定, 这时候请使用loc方式来指定具体的点位置',
    helpUrl: '/_docs/#/instruction',
    extensions: [CHANGE_FLOOR_VISIBILITY_EXTENSION],
  },
  category: 'entry',
  parser: (event: unknown, _context: ParseContext): BlockState => {
    let floorList = 'floorId';
    let floorId = 'MT0';
    let stair = 'loc';
    let posX = '';
    let posY = '';
    let direction = 'null';
    let time = '';
    let ignoreChangeFloor = 'null';

    if (event && typeof event === 'object') {
      const obj = event as Record<string, unknown>;
      const eventFloorId = obj.floorId as string;

      // 处理楼层选择
      if (eventFloorId === ':before' || eventFloorId === ':next' || eventFloorId === ':now') {
        floorList = eventFloorId;
        floorId = 'MT0';
      } else {
        floorList = 'floorId';
        floorId = eventFloorId || 'MT0';
      }

      // 处理楼梯类型
      if (obj.stair) {
        stair = obj.stair as string;
      } else if (obj.loc && Array.isArray(obj.loc)) {
        stair = 'loc';
        const loc = obj.loc as [number | string, number | string];
        posX = String(loc[0] ?? '');
        posY = String(loc[1] ?? '');
      }

      direction = (obj.direction as string) || 'null';
      time = obj.time !== undefined ? String(obj.time) : '';
      if (obj.ignoreChangeFloor !== undefined) {
        ignoreChangeFloor = String(obj.ignoreChangeFloor);
      }
    }

    return {
      type: 'mota_changeFloor_m',
      fields: {
        FLOOR_LIST: floorList,
        FLOOR_ID: floorId,
        STAIR: stair,
        POS_X: posX,
        POS_Y: posY,
        DIRECTION: direction,
        TIME: time,
        IGNORE_CHANGE_FLOOR: ignoreChangeFloor,
      },
    };
  },
  generator: (block: Blockly.Block): string => {
    const floorList = block.getFieldValue('FLOOR_LIST');
    const floorId = block.getFieldValue('FLOOR_ID');
    const stair = block.getFieldValue('STAIR');
    const posX = block.getFieldValue('POS_X');
    const posY = block.getFieldValue('POS_Y');
    const direction = block.getFieldValue('DIRECTION');
    const time = block.getFieldValue('TIME');
    const ignoreChangeFloor = block.getFieldValue('IGNORE_CHANGE_FLOOR');

    // 确定目标楼层 ID
    const toFloorId = floorList !== 'floorId' ? floorList : floorId;

    // 构建输出
    const parts: string[] = [`"floorId": "${toFloorId}"`];

    // 处理位置/楼梯
    if (stair === ':now') {
      // 保持不变，不添加 loc 或 stair
    } else if (stair === 'loc') {
      if (posX && posY) {
        parts.push(`"loc": [${posX}, ${posY}]`);
      }
    } else {
      parts.push(`"stair": "${stair}"`);
    }

    // 方向
    if (direction && direction !== 'null') {
      parts.push(`"direction": "${direction}"`);
    }

    // 动画时间
    if (time) {
      parts.push(`"time": ${time}`);
    }

    // 穿透性
    if (ignoreChangeFloor && ignoreChangeFloor !== 'null') {
      parts.push(`"ignoreChangeFloor": ${ignoreChangeFloor}`);
    }

    return `{${parts.join(', ')}}\n`;
  },
};

/**
 * afterGetItem_m - 获取道具后
 */
export const afterGetItemEntrySchema: BlockSchema = {
  eventType: 'entry:afterGetItem',
  definition: {
    type: 'mota_afterGetItem_m',
    message0: '获取道具后 轻按时不触发 %1 %2 %3',
    args0: [
      { type: 'field_checkbox', name: 'DISABLE_ON_GENTLE_CLICK', checked: false },
      { type: 'input_dummy' },
      { type: 'input_statement', name: 'ACTION' },
    ],
    colour: 'auto', // 使用 category 默认颜色 (250)
    tooltip: '系统引发的道具后事件',
    helpUrl: '/_docs/#/instruction',
  },
  category: 'entry',
  parser: (event: unknown, context: ParseContext): BlockState => {
    let disableOnGentleClick = false;
    let events: EventData[] = [];

    if (Array.isArray(event)) {
      events = event;
    } else if (event && typeof event === 'object') {
      const obj = event as Record<string, unknown>;
      disableOnGentleClick = (obj.disableOnGentleClick as boolean) ?? false;
      events = (obj.data as EventData[]) || [];
    }

    const inputs: Record<string, ConnectionState> = {};
    const actionBlock = parseEventList(events, context);
    if (actionBlock) {
      inputs.ACTION = { block: actionBlock };
    }

    return {
      type: 'mota_afterGetItem_m',
      fields: {
        DISABLE_ON_GENTLE_CLICK: disableOnGentleClick,
      },
      inputs,
    };
  },
  generator: (block: Blockly.Block): string => {
    const disableOnGentleClick = block.getFieldValue('DISABLE_ON_GENTLE_CLICK') === 'TRUE';
    const action = javascriptGenerator.statementToCode(block, 'ACTION');

    if (disableOnGentleClick) {
      return `{"disableOnGentleClick": true, "data": [\n${action}]}\n`;
    } else {
      return `[\n${action}]\n`;
    }
  },
};

// ============================================
// 等级提升入口及上下文块
// ============================================

/**
 * level_m - 等级提升入口
 */
export const levelEntrySchema: BlockSchema = {
  eventType: 'entry:level',
  definition: {
    type: 'mota_level_m',
    message0: '等级提升 %1 %2',
    args0: [{ type: 'input_dummy' }, { type: 'input_statement', name: 'LEVEL_CASES', check: 'levelCase' }],
    colour: 'auto', // 使用 category 默认颜色 (250)
    tooltip: '升级事件',
    helpUrl: '/_docs/#/instruction',
  },
  category: 'entry',
  parser: (event: unknown, context: ParseContext): BlockState => {
    // level_m 接收一个等级配置数组
    let levelCases: unknown[] = [];
    if (Array.isArray(event)) {
      levelCases = event;
    }

    const inputs: Record<string, ConnectionState> = {};

    // 解析 levelCase 列表
    if (levelCases.length > 0) {
      let firstBlock: BlockState | null = null;
      let prevBlock: BlockState | null = null;

      for (const levelCase of levelCases) {
        if (levelCase && typeof levelCase === 'object') {
          const obj = levelCase as Record<string, unknown>;
          const need = (obj.need as string) || '';
          const title = (obj.title as string) || '';
          const clear = (obj.clear as boolean) ?? false;
          const actionEvents = (obj.action as EventData[]) || [];

          const blockState: BlockState = {
            type: 'mota_levelCase',
            fields: {
              NEED: need,
              TITLE: title,
              CLEAR: clear,
            },
            inputs: {},
          };

          // 解析 action
          const actionBlock = parseEventList(actionEvents, context);
          if (actionBlock) {
            blockState.inputs!.ACTION = { block: actionBlock };
          }

          if (!firstBlock) {
            firstBlock = blockState;
          }
          if (prevBlock) {
            prevBlock.next = { block: blockState };
          }
          prevBlock = blockState;
        }
      }

      if (firstBlock) {
        inputs.LEVEL_CASES = { block: firstBlock };
      }
    }

    return {
      type: 'mota_level_m',
      inputs,
    };
  },
  generator: (block: Blockly.Block): string => {
    const levelCases = javascriptGenerator.statementToCode(block, 'LEVEL_CASES');
    return `[\n${levelCases}]\n`;
  },
};

/**
 * levelCase - 等级项上下文块
 */
export const levelCaseSchema: BlockSchema = {
  eventType: '_levelCase', // 内部类型，不对应顶层事件
  definition: {
    type: 'mota_levelCase',
    message0: '需求 %1 称号 %2 是否扣除经验 %3 %4 %5',
    args0: [
      { type: 'field_input', name: 'NEED', text: '' },
      { type: 'field_input', name: 'TITLE', text: '' },
      { type: 'field_checkbox', name: 'CLEAR', checked: false },
      { type: 'input_dummy' },
      { type: 'input_statement', name: 'ACTION' },
    ],
    previousStatement: 'levelCase',
    nextStatement: 'levelCase',
    colour: 'auto', // 使用 category 默认颜色 (250)
    tooltip: '升级设定',
    helpUrl: '/_docs/#/instruction',
  },
  category: 'entry',
  generator: (block: Blockly.Block): string => {
    const need = block.getFieldValue('NEED') || '';
    const title = block.getFieldValue('TITLE') || '';
    const clear = block.getFieldValue('CLEAR') === 'TRUE';
    const action = javascriptGenerator.statementToCode(block, 'ACTION');

    // 转义字符串
    const escapedNeed = need.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const escapedTitle = title.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

    const clearStr = clear ? ', "clear": true' : '';
    return `{"need": "${escapedNeed}", "title": "${escapedTitle}"${clearStr}, "action": [\n${action}]},\n`;
  },
};

// ============================================
// 全局商店入口及上下文块
// ============================================

/**
 * shop_m - 全局商店列表入口
 */
export const shopEntrySchema: BlockSchema = {
  eventType: 'entry:shop',
  definition: {
    type: 'mota_shop_m',
    message0: '全局商店列表 %1 %2',
    args0: [{ type: 'input_dummy' }, { type: 'input_statement', name: 'SHOP_LIST', check: 'shopsub' }],
    colour: 'auto', // 使用 category 默认颜色 (250)
    tooltip: '全局商店列表',
    helpUrl: '/_docs/#/instruction',
  },
  category: 'entry',
  parser: (event: unknown, context: ParseContext): BlockState => {
    // shop_m 接收一个商店配置数组
    let shops: unknown[] = [];
    if (Array.isArray(event)) {
      shops = event;
    }

    const inputs: Record<string, ConnectionState> = {};

    // 解析商店列表
    if (shops.length > 0) {
      let firstBlock: BlockState | null = null;
      let prevBlock: BlockState | null = null;

      for (const shop of shops) {
        if (shop && typeof shop === 'object') {
          const obj = shop as Record<string, unknown>;
          const shopBlock = parseShopSub(obj, context);

          if (!firstBlock) {
            firstBlock = shopBlock;
          }
          if (prevBlock) {
            prevBlock.next = { block: shopBlock };
          }
          prevBlock = shopBlock;
        }
      }

      if (firstBlock) {
        inputs.SHOP_LIST = { block: firstBlock };
      }
    }

    return {
      type: 'mota_shop_m',
      inputs,
    };
  },
  generator: (block: Blockly.Block): string => {
    const shopList = javascriptGenerator.statementToCode(block, 'SHOP_LIST');
    return `[${shopList}]\n`;
  },
};

/**
 * 解析商店文本，提取标题和图像
 * 格式: \t[标题,图像]文字内容
 */
function parseShopText(text: string): { title: string; icon: string; content: string } {
  let title = '';
  let icon = '';
  let content = text;

  const match = /(?:\\t|\t)\[([^\]]*)\]/.exec(content);
  if (match) {
    const parts = match[1].split(',');
    title = parts[0] || '';
    icon = parts[1] || '';
    content = content.replace(match[0], '');
  }

  return { title, icon, content };
}

/**
 * 解析单个商店配置
 */
function parseShopSub(shop: Record<string, unknown>, context: ParseContext): BlockState {
  if (shop.item === true) return parseItemShop(shop);
  if (typeof shop.commonEvent === 'string') return parseCommonEventShop(shop);

  const id = (shop.id as string) || 'shop1';
  const textRaw = (shop.text as string) || '';
  const textInList = (shop.textInList as string) || '';
  const mustEnable = (shop.mustEnable as boolean) ?? false;
  const disablePreview = (shop.disablePreview as boolean) ?? false;
  const choices = (shop.choices as unknown[]) || [];

  const { title, icon, content } = parseShopText(textRaw);

  // 解析商店选项
  const choicesInputs: Record<string, ConnectionState> = {};
  if (choices.length > 0) {
    let firstChoice: BlockState | null = null;
    let prevChoice: BlockState | null = null;

    for (const choice of choices) {
      if (choice && typeof choice === 'object') {
        const choiceBlock = parseShopChoice(choice as Record<string, unknown>, context);

        if (!firstChoice) {
          firstChoice = choiceBlock;
        }
        if (prevChoice) {
          prevChoice.next = { block: choiceBlock };
        }
        prevChoice = choiceBlock;
      }
    }

    if (firstChoice) {
      choicesInputs.CHOICES = { block: firstChoice };
    }
  }

  return {
    type: 'mota_shopsub',
    fields: {
      ID: id,
      TITLE: title,
      ICON: icon,
      TEXT: content,
      TEXT_IN_LIST: textInList,
      MUST_ENABLE: mustEnable,
      DISABLE_PREVIEW: disablePreview,
    },
    inputs: choicesInputs,
  };
}

function parseItemShop(shop: Record<string, unknown>): BlockState {
  const choices = Array.isArray(shop.choices) ? shop.choices : [];
  let first: BlockState | null = null;
  let previous: BlockState | null = null;
  for (const raw of choices) {
    if (!raw || typeof raw !== 'object') continue;
    const choice = raw as Record<string, unknown>;
    const state: BlockState = {
      type: 'mota_shopItemChoice',
      fields: {
        ID: String(choice.id ?? ''),
        NUMBER: choice.number == null ? '' : String(choice.number),
        MONEY: String(choice.money ?? ''),
        SELL: String(choice.sell ?? ''),
        CONDITION: String(choice.condition ?? ''),
      },
    };
    if (!first) first = state;
    if (previous) previous.next = { block: state };
    previous = state;
  }
  return {
    type: 'mota_shopitem',
    fields: {
      ID: String(shop.id ?? 'itemShop'),
      TEXT_IN_LIST: String(shop.textInList ?? ''),
      USE: String(shop.use ?? 'money'),
      MUST_ENABLE: shop.mustEnable === true,
    },
    inputs: first ? { CHOICES: { block: first } } : {},
  };
}

function parseCommonEventShop(shop: Record<string, unknown>): BlockState {
  return {
    type: 'mota_shopcommonevent',
    fields: {
      ID: String(shop.id ?? 'shop1'),
      TEXT_IN_LIST: String(shop.textInList ?? ''),
      MUST_ENABLE: shop.mustEnable === true,
      COMMON_EVENT: String(shop.commonEvent ?? ''),
      ARGS: Array.isArray(shop.args) ? JSON.stringify(shop.args) : '',
    },
  };
}

/**
 * 解析商店选项
 */
function parseShopChoice(choice: Record<string, unknown>, context: ParseContext): BlockState {
  const text = (choice.text as string) || '';
  const need = (choice.need as string) || '';
  const icon = (choice.icon as string) || '';
  const color = choice.color as number[] | undefined;
  const condition = (choice.condition as string) || '';
  const actionEvents = (choice.action as EventData[]) || [];

  const colorStr = color ? color.join(',') : '';

  const inputs: Record<string, ConnectionState> = {};
  const actionBlock = parseEventList(actionEvents, context);
  if (actionBlock) {
    inputs.ACTION = { block: actionBlock };
  }

  return {
    type: 'mota_shopChoices',
    fields: {
      TEXT: text,
      NEED: need,
      ICON: icon,
      COLOR: colorStr,
      CONDITION: condition,
    },
    inputs,
  };
}

/**
 * shopsub - 商店项上下文块
 */
export const shopSubSchema: BlockSchema = {
  eventType: '_shopsub', // 内部类型
  definition: {
    type: 'mota_shopsub',
    message0: '商店 id %1 标题 %2 图像 %3',
    args0: [
      { type: 'field_input', name: 'ID', text: 'shop1' },
      { type: 'field_input', name: 'TITLE', text: '贪婪之神' },
      { type: 'field_input', name: 'ICON', text: 'moneyShop' },
    ],
    message1: '文字 %1',
    args1: [{ type: 'field_multilinetext', name: 'TEXT', text: '勇敢的武士啊, 给我${20+2*flag:shop1}金币就可以：' }],
    message2: '快捷名称 %1 未开启不显示 %2 不可预览 %3',
    args2: [
      { type: 'field_input', name: 'TEXT_IN_LIST', text: '金币商店' },
      { type: 'field_checkbox', name: 'MUST_ENABLE', checked: false },
      { type: 'field_checkbox', name: 'DISABLE_PREVIEW', checked: false },
    ],
    message3: '%1 %2',
    args3: [{ type: 'input_dummy' }, { type: 'input_statement', name: 'CHOICES', check: 'shopChoices' }],
    previousStatement: 'shopsub',
    nextStatement: 'shopsub',
    colour: BlockColours.SHOP,
    tooltip: '全局商店',
    helpUrl: '/_docs/#/instruction',
  },
  category: 'entry',
  generator: (block: Blockly.Block): string => {
    const id = block.getFieldValue('ID') || '';
    const title = block.getFieldValue('TITLE') || '';
    const icon = block.getFieldValue('ICON') || '';
    const textContent = block.getFieldValue('TEXT') || '';
    const textInList = block.getFieldValue('TEXT_IN_LIST') || '';
    const mustEnable = block.getFieldValue('MUST_ENABLE') === 'TRUE';
    const disablePreview = block.getFieldValue('DISABLE_PREVIEW') === 'TRUE';
    const choices = javascriptGenerator.statementToCode(block, 'CHOICES');

    // 构建 text 字段：\t[标题,图像]文字内容
    let textField = '';
    if (title || icon) {
      textField = '\\t[';
      if (icon) {
        textField += title + ',' + icon;
      } else {
        textField += title;
      }
      textField += ']';
    }
    textField += textContent.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

    const escapedId = id.replace(/"/g, '\\"');
    const escapedTextInList = textInList.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

    return `{
"id": "${escapedId}",
"text": "${textField}",
"textInList": "${escapedTextInList}",
"mustEnable": ${mustEnable},
"disablePreview": ${disablePreview},
"choices":[
${choices}]},
`;
  },
};

/**
 * shopChoices - 商店选项上下文块
 */
export const shopChoicesSchema: BlockSchema = {
  eventType: '_shopChoices', // 内部类型
  definition: {
    type: 'mota_shopChoices',
    message0: '商店选项 %1 使用条件 %2',
    args0: [
      { type: 'field_input', name: 'TEXT', text: '攻击+1' },
      { type: 'field_input', name: 'NEED', text: 'status:money>=20+2*flag:shop1' },
    ],
    message1: '图标 %1 颜色 %2 出现条件 %3',
    args1: [
      { type: 'field_input', name: 'ICON', text: '' },
      { type: 'field_input', name: 'COLOR', text: '' },
      { type: 'field_input', name: 'CONDITION', text: '' },
    ],
    message2: '%1 %2',
    args2: [{ type: 'input_dummy' }, { type: 'input_statement', name: 'ACTION' }],
    previousStatement: 'shopChoices',
    nextStatement: 'shopChoices',
    colour: BlockColours.SHOP,
    tooltip: '商店选项',
    helpUrl: '/_docs/#/instruction',
  },
  category: 'entry',
  generator: (block: Blockly.Block): string => {
    const text = block.getFieldValue('TEXT') || '';
    const need = block.getFieldValue('NEED') || '';
    const icon = block.getFieldValue('ICON') || '';
    const color = block.getFieldValue('COLOR') || '';
    const condition = block.getFieldValue('CONDITION') || '';
    const action = javascriptGenerator.statementToCode(block, 'ACTION');

    const escapedText = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const escapedNeed = need.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

    let extras = '';
    if (icon) {
      extras += `, "icon": "${icon.replace(/"/g, '\\"')}"`;
    }
    if (color) {
      extras += `, "color": [${color}]`;
    }
    if (condition) {
      extras += `, "condition": "${condition.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    }

    return `{"text": "${escapedText}", "need": "${escapedNeed}"${extras}, "action": [\n${action}]},\n`;
  },
};

export const shopItemSchema: BlockSchema = {
  eventType: '_shopitem',
  definition: {
    type: 'mota_shopitem',
    message0: '道具商店 id %1 快捷名称 %2 使用 %3 未开启不显示 %4',
    args0: [
      { type: 'field_input', name: 'ID', text: 'itemShop' },
      { type: 'field_input', name: 'TEXT_IN_LIST', text: '道具商店' },
      {
        type: 'field_dropdown',
        name: 'USE',
        options: [
          ['金币', 'money'],
          ['经验', 'experience'],
        ],
      },
      { type: 'field_checkbox', name: 'MUST_ENABLE', checked: false },
    ],
    message1: '%1',
    args1: [{ type: 'input_statement', name: 'CHOICES', check: 'shopItemChoice' }],
    previousStatement: 'shopsub',
    nextStatement: 'shopsub',
    colour: BlockColours.SHOP,
    tooltip: '道具商店',
    helpUrl: '/_docs/#/instruction',
  },
  category: 'entry',
  generator: (block: Blockly.Block): string => {
    const choicesCode = javascriptGenerator.statementToCode(block, 'CHOICES');
    const choices = choicesCode ? JSON5.parse(`[${choicesCode}]`) : [];
    return (
      JSON.stringify({
        id: block.getFieldValue('ID') || '',
        item: true,
        textInList: block.getFieldValue('TEXT_IN_LIST') || '',
        use: block.getFieldValue('USE') || 'money',
        mustEnable: block.getFieldValue('MUST_ENABLE') === 'TRUE',
        choices,
      }) + ',\n'
    );
  },
};

export const shopItemChoiceSchema: BlockSchema = {
  eventType: '_shopItemChoice',
  definition: {
    type: 'mota_shopItemChoice',
    message0: '道具名 %1 存量 %2 买入价格 %3 卖出价格 %4 出现条件 %5',
    args0: [
      { type: 'field_input', name: 'ID', text: 'yellowKey' },
      { type: 'field_input', name: 'NUMBER', text: '' },
      { type: 'field_input', name: 'MONEY', text: '' },
      { type: 'field_input', name: 'SELL', text: '' },
      { type: 'field_input', name: 'CONDITION', text: '' },
    ],
    previousStatement: 'shopItemChoice',
    nextStatement: 'shopItemChoice',
    colour: BlockColours.SHOP,
    tooltip: '道具商店选项',
    helpUrl: '/_docs/#/instruction',
  },
  category: 'entry',
  generator: (block: Blockly.Block): string => {
    const result: Record<string, unknown> = { id: block.getFieldValue('ID') || '' };
    const number = block.getFieldValue('NUMBER');
    const money = block.getFieldValue('MONEY');
    const sell = block.getFieldValue('SELL');
    const condition = block.getFieldValue('CONDITION');
    if (number !== '') result.number = /^-?\d+(?:\.\d+)?$/.test(number) ? Number(number) : number;
    if (money) result.money = money;
    if (sell) result.sell = sell;
    if (condition) result.condition = condition;
    return JSON.stringify(result) + ',\n';
  },
};

export const shopCommonEventSchema: BlockSchema = {
  eventType: '_shopcommonevent',
  definition: {
    type: 'mota_shopcommonevent',
    message0: '公共事件商店 id %1 快捷名称 %2 未开启不显示 %3',
    args0: [
      { type: 'field_input', name: 'ID', text: 'shop1' },
      { type: 'field_input', name: 'TEXT_IN_LIST', text: '' },
      { type: 'field_checkbox', name: 'MUST_ENABLE', checked: false },
    ],
    message1: '执行公共事件 %1 参数列表 JSON %2',
    args1: [
      { type: 'field_input', name: 'COMMON_EVENT', text: '' },
      { type: 'field_input', name: 'ARGS', text: '' },
    ],
    previousStatement: 'shopsub',
    nextStatement: 'shopsub',
    colour: BlockColours.SHOP,
    tooltip: '执行公共事件的全局商店',
    helpUrl: '/_docs/#/instruction',
  },
  category: 'entry',
  generator: (block: Blockly.Block): string => {
    const result: Record<string, unknown> = {
      id: block.getFieldValue('ID') || '',
      textInList: block.getFieldValue('TEXT_IN_LIST') || '',
      mustEnable: block.getFieldValue('MUST_ENABLE') === 'TRUE',
      commonEvent: block.getFieldValue('COMMON_EVENT') || '',
    };
    const args = block.getFieldValue('ARGS');
    if (args) {
      const parsed = JSON5.parse(args);
      if (!Array.isArray(parsed)) throw new Error('参数列表必须是数组');
      result.args = parsed;
    }
    return JSON.stringify(result) + ',\n';
  },
};

// ============================================
// 导出所有入口 Schema
// ============================================

export const entrySchemas: BlockSchema[] = [
  // 简单入口
  commonEntrySchema,
  beforeBattleEntrySchema,
  afterBattleEntrySchema,
  afterOpenDoorEntrySchema,
  firstArriveEntrySchema,
  eachArriveEntrySchema,
  commonEventEntrySchema,
  itemEntrySchema,
  // 复杂入口
  eventEntrySchema,
  autoEventEntrySchema,
  changeFloorEntrySchema,
  afterGetItemEntrySchema,
  // 等级提升
  levelEntrySchema,
  levelCaseSchema,
  // 全局商店
  shopEntrySchema,
  shopSubSchema,
  shopChoicesSchema,
  shopItemSchema,
  shopItemChoiceSchema,
  shopCommonEventSchema,
];
