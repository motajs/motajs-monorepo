/**
 * 数据操作块 Schema
 *
 * 包含 setValue, setEnemy, setFloor 等数据操作相关的事件块
 */

import type * as Blockly from 'blockly';

import type { BlockState, EventObject, ParseContext } from '../parser/types';
import type { BlockSchema } from '../registry/types';
import { legacyDataSchemas } from './dataLegacy';

// ============================================
// setValue 块
// ============================================

/**
 * 设置数值块
 * 对应事件: { type: "setValue", name: "...", operator: "...", value: "..." }
 */
export const setValueSchema: BlockSchema = {
  eventType: 'setValue',
  definition: {
    type: 'mota_setValue_s',
    message0: '数值操作 %1 %2 %3 不刷新状态栏 %4',
    args0: [
      { type: 'field_input', name: 'NAME', text: 'status:hp' },
      {
        type: 'field_dropdown',
        name: 'OPERATOR',
        options: [
          ['=', '='],
          ['+=', '+='],
          ['-=', '-='],
          ['*=', '*='],
          ['/=', '/='],
          ['//=', '//='],
          ['**=', '**='],
          ['%=', '%='],
          ['min=', 'min='],
          ['max=', 'max='],
        ],
      },
      { type: 'field_input', name: 'VALUE', text: '100' },
      { type: 'field_checkbox', name: 'NO_REFRESH', checked: false },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (130)
    tooltip:
      '设置数值。name 支持 status:hp, item:yellowKey, flag:xxx 等格式',
    helpUrl: '',
  },
  category: 'data',
  parser: (event: EventObject, _context: ParseContext): BlockState => {
    return {
      type: 'mota_setValue_s',
      fields: {
        NAME: (event.name as string) || '',
        OPERATOR: (event.operator as string) || '=',
        VALUE: String(event.value ?? ''),
        NO_REFRESH: (event.norefresh as boolean) || false,
      },
    };
  },
  generator: (block: Blockly.Block): string => {
    const name = block.getFieldValue('NAME');
    const operator = block.getFieldValue('OPERATOR');
    const value = block.getFieldValue('VALUE');
    const noRefresh = block.getFieldValue('NO_REFRESH') === 'TRUE';

    const event: Record<string, unknown> = {
      type: 'setValue',
      name,
    };

    // operator 只有非 '=' 时才添加
    if (operator && operator !== '=') {
      event.operator = operator;
    }

    event.value = value;

    if (noRefresh) {
      event.norefresh = true;
    }

    return JSON.stringify(event) + ',\n';
  },
};

// ============================================
// setEnemy 块
// ============================================

/**
 * 设置怪物属性块
 * 对应事件: { type: "setEnemy", id: "...", name: "...", value: "..." }
 */
export const setEnemySchema: BlockSchema = {
  eventType: 'setEnemy',
  definition: {
    type: 'mota_setEnemy_s',
    message0: '设置怪物 %1 属性 %2 %3 %4 不刷新 %5',
    args0: [
      { type: 'field_input', name: 'ID', text: 'greenSlime' },
      {
        type: 'field_dropdown',
        name: 'PROP',
        options: [
          ['生命', 'hp'],
          ['攻击', 'atk'],
          ['防御', 'def'],
          ['金币', 'money'],
          ['经验', 'experience'],
          ['特殊', 'special'],
          ['伤害', 'damage'],
          ['临界', 'critical'],
          ['减伤', 'defDamage'],
          ['名称', 'name'],
        ],
      },
      {
        type: 'field_dropdown',
        name: 'OPERATOR',
        options: [
          ['=', '='],
          ['+=', '+='],
          ['-=', '-='],
          ['*=', '*='],
          ['/=', '/='],
        ],
      },
      { type: 'field_input', name: 'VALUE', text: '0' },
      { type: 'field_checkbox', name: 'NO_REFRESH', checked: false },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (130)
    tooltip: '设置怪物的属性',
    helpUrl: '',
  },
  category: 'data',
  parser: (event: EventObject, _context: ParseContext): BlockState => {
    return {
      type: 'mota_setEnemy_s',
      fields: {
        ID: (event.id as string) || '',
        PROP: (event.name as string) || 'hp',
        OPERATOR: (event.operator as string) || '=',
        VALUE: String(event.value ?? ''),
        NO_REFRESH: (event.norefresh as boolean) || false,
      },
    };
  },
  generator: (block: Blockly.Block): string => {
    const id = block.getFieldValue('ID');
    const prop = block.getFieldValue('PROP');
    const operator = block.getFieldValue('OPERATOR');
    const value = block.getFieldValue('VALUE');
    const noRefresh = block.getFieldValue('NO_REFRESH') === 'TRUE';

    const event: Record<string, unknown> = {
      type: 'setEnemy',
      id,
      name: prop,
    };

    if (operator && operator !== '=') {
      event.operator = operator;
    }

    event.value = value;

    if (noRefresh) {
      event.norefresh = true;
    }

    return JSON.stringify(event) + ',\n';
  },
};

// ============================================
// setEnemyOnPoint 块
// ============================================

/**
 * 设置某点怪物属性块
 * 对应事件: { type: "setEnemyOnPoint", loc: [...], name: "...", value: "..." }
 */
export const setEnemyOnPointSchema: BlockSchema = {
  eventType: 'setEnemyOnPoint',
  definition: {
    type: 'mota_setEnemyOnPoint_s',
    message0: '设置点 [%1,%2] 怪物属性 %3 %4 %5 楼层 %6 不刷新 %7',
    args0: [
      { type: 'field_input', name: 'X', text: '0' },
      { type: 'field_input', name: 'Y', text: '0' },
      {
        type: 'field_dropdown',
        name: 'PROP',
        options: [
          ['生命', 'hp'],
          ['攻击', 'atk'],
          ['防御', 'def'],
          ['金币', 'money'],
          ['经验', 'experience'],
          ['特殊', 'special'],
        ],
      },
      {
        type: 'field_dropdown',
        name: 'OPERATOR',
        options: [
          ['=', '='],
          ['+=', '+='],
          ['-=', '-='],
          ['*=', '*='],
          ['/=', '/='],
        ],
      },
      { type: 'field_input', name: 'VALUE', text: '0' },
      { type: 'field_input', name: 'FLOOR_ID', text: '' },
      { type: 'field_checkbox', name: 'NO_REFRESH', checked: false },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (130)
    tooltip: '设置某个位置上怪物的属性',
    helpUrl: '',
  },
  category: 'data',
  parser: (event: EventObject, _context: ParseContext): BlockState => {
    const loc = event.loc as [number, number] | undefined;
    return {
      type: 'mota_setEnemyOnPoint_s',
      fields: {
        X: loc?.[0]?.toString() || '0',
        Y: loc?.[1]?.toString() || '0',
        PROP: (event.name as string) || 'hp',
        OPERATOR: (event.operator as string) || '=',
        VALUE: String(event.value ?? ''),
        FLOOR_ID: (event.floorId as string) || '',
        NO_REFRESH: (event.norefresh as boolean) || false,
      },
    };
  },
  generator: (block: Blockly.Block): string => {
    const x = block.getFieldValue('X');
    const y = block.getFieldValue('Y');
    const prop = block.getFieldValue('PROP');
    const operator = block.getFieldValue('OPERATOR');
    const value = block.getFieldValue('VALUE');
    const floorId = block.getFieldValue('FLOOR_ID');
    const noRefresh = block.getFieldValue('NO_REFRESH') === 'TRUE';

    const event: Record<string, unknown> = {
      type: 'setEnemyOnPoint',
      loc: [parseInt(x) || 0, parseInt(y) || 0],
      name: prop,
    };

    if (operator && operator !== '=') {
      event.operator = operator;
    }

    event.value = value;

    if (floorId) {
      event.floorId = floorId;
    }

    if (noRefresh) {
      event.norefresh = true;
    }

    return JSON.stringify(event) + ',\n';
  },
};

// ============================================
// setFloor 块
// ============================================

/**
 * 设置楼层属性块
 * 对应事件: { type: "setFloor", name: "...", floorId: "...", value: ... }
 */
export const setFloorSchema: BlockSchema = {
  eventType: 'setFloor',
  definition: {
    type: 'mota_setFloor_s',
    message0: '设置楼层 %1 属性 %2 值 %3',
    args0: [
      { type: 'field_input', name: 'FLOOR_ID', text: '' },
      {
        type: 'field_dropdown',
        name: 'PROP',
        options: [
          ['标题', 'title'],
          ['能否飞到', 'canFlyTo'],
          ['能否使用飞行器', 'canFlyFrom'],
          ['能否使用楼传', 'canUseQuickShop'],
          ['能否瞬移', 'cannotMove'],
          ['能否查看地图', 'cannotViewMap'],
          ['是否地下', 'underGround'],
          ['自动事件', 'autoEvent'],
          ['默认地面', 'defaultGround'],
          ['地图比例', 'ratio'],
          ['天气', 'weather'],
          ['色调', 'color'],
          ['背景音乐', 'bgm'],
        ],
      },
      { type: 'field_input', name: 'VALUE', text: '' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (130)
    tooltip: '设置楼层属性。楼层为空表示当前楼层',
    helpUrl: '',
  },
  category: 'data',
  parser: (event: EventObject, _context: ParseContext): BlockState => {
    let value = event.value;
    // 如果是对象或数组，转为 JSON 字符串
    if (typeof value === 'object') {
      value = JSON.stringify(value);
    }
    return {
      type: 'mota_setFloor_s',
      fields: {
        FLOOR_ID: (event.floorId as string) || '',
        PROP: (event.name as string) || 'title',
        VALUE: String(value ?? ''),
      },
    };
  },
  generator: (block: Blockly.Block): string => {
    const floorId = block.getFieldValue('FLOOR_ID');
    const prop = block.getFieldValue('PROP');
    let value: unknown = block.getFieldValue('VALUE');

    // 尝试解析 JSON
    try {
      value = JSON.parse(value as string);
    } catch {
      // 保持字符串
    }

    const event: Record<string, unknown> = {
      type: 'setFloor',
      name: prop,
      value,
    };

    if (floorId) {
      event.floorId = floorId;
    }

    return JSON.stringify(event) + ',\n';
  },
};

// ============================================
// setGlobalAttribute 块
// ============================================

/**
 * 设置全局属性块
 * 对应事件: { type: "setGlobalAttribute", name: "...", value: ... }
 */
export const setGlobalAttributeSchema: BlockSchema = {
  eventType: 'setGlobalAttribute',
  definition: {
    type: 'mota_setGlobalAttribute_s',
    message0: '设置全局属性 %1 值 %2',
    args0: [
      {
        type: 'field_dropdown',
        name: 'PROP',
        options: [
          ['文字颜色', 'font'],
          ['主界面标题', 'name'],
          ['状态栏显示', 'statusLeftBackground'],
          ['工具栏显示', 'statusTopBackground'],
          ['边框颜色', 'borderColor'],
          ['状态栏色', 'statusBarColor'],
          ['快捷键栏', 'hardLabelColor'],
          ['楼层切换风格', 'floorChangingStyle'],
          ['楼传边框', 'flyBorder'],
        ],
      },
      { type: 'field_input', name: 'VALUE', text: '' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (130)
    tooltip: '设置全局属性',
    helpUrl: '',
  },
  category: 'data',
  fieldMapping: {
    PROP: 'name',
    VALUE: {
      eventField: 'value',
      parse: (v) => (typeof v === 'object' ? JSON.stringify(v) : String(v ?? '')),
      generate: (v) => {
        try {
          return JSON.parse(v as string);
        } catch {
          return v;
        }
      },
    },
  },
};

// ============================================
// setGlobalValue 块
// ============================================

/**
 * 设置全局数值块
 * 对应事件: { type: "setGlobalValue", name: "...", value: "..." }
 */
export const setGlobalValueSchema: BlockSchema = {
  eventType: 'setGlobalValue',
  definition: {
    type: 'mota_setGlobalValue_s',
    message0: '设置全局数值 %1 值 %2',
    args0: [
      { type: 'field_input', name: 'NAME', text: '' },
      { type: 'field_input', name: 'VALUE', text: '' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (130)
    tooltip: '设置全局存储的数值（不会随着读档而改变）',
    helpUrl: '',
  },
  category: 'data',
  fieldMapping: {
    NAME: 'name',
    VALUE: 'value',
  },
};

// ============================================
// setGlobalFlag 块
// ============================================

/**
 * 设置系统开关块
 * 对应事件: { type: "setGlobalFlag", name: "...", value: true/false }
 */
export const setGlobalFlagSchema: BlockSchema = {
  eventType: 'setGlobalFlag',
  definition: {
    type: 'mota_setGlobalFlag_s',
    message0: '设置系统开关 %1 %2',
    args0: [
      {
        type: 'field_dropdown',
        name: 'NAME',
        options: [
          ['血量不满无法开门', 'enableHpLessDoorRestrict'],
          ['技能的启用', 'enableSkill'],
          ['负伤增加', 'enableNegativeDamage'],
          ['大地图边界', 'enableGentleClick'],
          ['显示临界', 'displayCritical'],
          ['显示额外伤害', 'displayExtraDamage'],
          ['怪物手册按伤害排序', 'enableEnemyPoint'],
          ['启用分区', 'enableZone'],
          ['可穿透楼梯', 'portalWithoutTrigger'],
          ['可穿透怪物', 'canGoDeadZone'],
          ['勇士穿透模式', 'betweenAttackMax'],
        ],
      },
      { type: 'field_checkbox', name: 'VALUE', checked: true },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (130)
    tooltip: '设置系统开关',
    helpUrl: '',
  },
  category: 'data',
  fieldMapping: {
    NAME: 'name',
    VALUE: {
      eventField: 'value',
      parse: (v) => (v as boolean) || false,
      generate: (v) => v === 'TRUE' || v === true,
    },
  },
};

// ============================================
// setNameMap 块
// ============================================

/**
 * 设置命名映射块
 * 对应事件: { type: "setNameMap", name: "...", value: "..." }
 */
export const setNameMapSchema: BlockSchema = {
  eventType: 'setNameMap',
  definition: {
    type: 'mota_setNameMap_s',
    message0: '设置命名映射 %1 值 %2',
    args0: [
      { type: 'field_input', name: 'NAME', text: '' },
      { type: 'field_input', name: 'VALUE', text: '' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (130)
    tooltip: '设置一个命名映射，用于更新全塔属性的 levelUp 等',
    helpUrl: '',
  },
  category: 'data',
  fieldMapping: {
    NAME: 'name',
    VALUE: 'value',
  },
};

// ============================================
// update 块
// ============================================

/**
 * 刷新状态栏块
 * 对应事件: { type: "update" }
 */
export const updateSchema: BlockSchema = {
  eventType: 'update',
  definition: {
    type: 'mota_update_s',
    message0: '刷新状态栏和地图显示 不检查自动事件 %1',
    args0: [{ type: 'field_checkbox', name: 'DO_NOT_CHECK_AUTO_EVENTS', checked: false }],
    previousStatement: null,
    nextStatement: null,
    colour: 'auto', // 使用 category 默认颜色 (130)
    tooltip: '立刻刷新状态栏和地图显示',
    helpUrl: '',
  },
  category: 'data',
  fieldMapping: {
    DO_NOT_CHECK_AUTO_EVENTS: {
      eventField: 'doNotCheckAutoEvents',
      parse: (v) => v === true,
      generate: (v) => v === 'TRUE' || v === true ? true : undefined,
    },
  },
};

// ============================================
// 导出所有数据操作 Schema
// ============================================

export const dataSchemas: BlockSchema[] = [
  setValueSchema,
  setEnemySchema,
  setEnemyOnPointSchema,
  setFloorSchema,
  setGlobalAttributeSchema,
  setGlobalValueSchema,
  setGlobalFlagSchema,
  setNameMapSchema,
  updateSchema,
  ...legacyDataSchemas,
];
