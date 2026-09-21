/**
 * Blockly 工具箱配置
 *
 * 定义工具箱的分类结构和块的组织方式
 */

import type * as Blockly from 'blockly';
import { CategoryColours } from '../schemas/categoryColours';
import { allSchemas } from '../schemas';
import { blockRegistry } from '../registry';

/**
 * 工具箱分类配置
 */
export interface ToolboxCategory {
  /** 分类名称 */
  name: string;
  /** 分类颜色（用于工具箱显示） */
  colour: number;
  /** 自定义回调名（用于动态分类） */
  custom?: string;
  /** 静态块列表（块类型 ID） */
  blocks?: string[];
  /** Schema category 名称（用于自动分组） */
  category?: string;
}

/**
 * 工具箱分类定义
 *
 * 基于原始配置和新的 schema 分类
 */
export const toolboxCategories: ToolboxCategory[] = [
  {
    name: '入口方块',
    colour: CategoryColours.entry,
    custom: 'entranceCategory',
    category: 'entry',
  },
  {
    name: '显示文字',
    colour: CategoryColours.text,
    category: 'text',
  },
  {
    name: '数据相关',
    colour: CategoryColours.data,
    category: 'data',
  },
  {
    name: '地图处理',
    colour: CategoryColours.map,
    category: 'map',
  },
  {
    name: '事件控制',
    colour: CategoryColours.control,
    category: 'eventControl',
  },
  {
    name: '特效表现',
    colour: CategoryColours.effect,
    category: 'effect',
  },
  {
    name: '音像处理',
    colour: CategoryColours.sound,
    category: 'sound',
  },
  {
    name: 'UI绘制',
    colour: CategoryColours.ui,
    category: 'ui',
  },
  {
    name: '原生脚本',
    colour: CategoryColours.unknown,
    category: 'native',
  },
  {
    name: '值块',
    colour: CategoryColours.value,
    category: 'value',
  },
  {
    name: '最近使用事件',
    colour: 0,
    custom: 'searchBlockCategory',
  },
];

const legacyCategoryOrder: Partial<Record<string, string[]>> = {
  data: [
    'setValue',
    'setEnemy',
    'setEnemyOnPoint',
    'resetEnemyOnPoint',
    'moveEnemyOnPoint',
    '_moveEnemyOnPointRelative',
    'setEquip',
    'setFloor',
    'setGlobalAttribute',
    'setGlobalValue',
    'setGlobalFlag',
    'setNameMap',
    'input',
    'input2',
    'update',
    'moveAction',
    'changeFloor',
    'changePos',
    'battle',
    'useItem',
    'loadEquip',
    'unloadEquip',
    'openShop',
    'disableShop',
    'setHeroIcon',
    'follow',
    'unfollow',
  ],
  map: [
    'battle',
    'openDoor',
    'closeDoor',
    'show',
    'hide',
    'setBlock',
    'setBlockOpacity',
    'setBlockFilter',
    'turnBlock',
    'moveHero',
    'move',
    'jumpHero',
    'jump',
    'showBgFgMap',
    'hideBgFgMap',
    'setBgFgBlock',
    'showFloorImg',
    'hideFloorImg',
  ],
  sound: [
    'showImage',
    'hideImage',
    'showTextImage',
    'moveImage',
    'rotateImage',
    'scaleImage',
    'showGif',
    'playBgm',
    'pauseBgm',
    'resumeBgm',
    'loadBgm',
    'freeBgm',
    'playSound',
    'stopSound',
    'setVolume',
    'setBgmSpeed',
  ],
  ui: [
    'previewUI',
    'clearMap',
    'setAttribute',
    'setFilter',
    'fillText',
    'fillBoldText',
    'drawTextContent',
    'fillRect',
    'strokeRect',
    'drawLine',
    'drawArrow',
    'fillPolygon',
    'strokePolygon',
    'fillEllipse',
    'strokeEllipse',
    'fillArc',
    'strokeArc',
    'drawImage',
    'drawIcon',
    'drawBackground',
    'drawSelector',
  ],
};

function sortByLegacyOrder(schemas: typeof allSchemas, category: string): typeof allSchemas {
  const order = legacyCategoryOrder[category];
  if (!order) return schemas;
  const index = new Map(order.map((eventType, position) => [eventType, position]));
  return schemas
    .map((schema, position) => ({ schema, position }))
    .sort((left, right) => {
      const leftOrder = index.get(left.schema.eventType) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = index.get(right.schema.eventType) ?? Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder || left.position - right.position;
    })
    .map(({ schema }) => schema);
}

/**
 * 根据 category 获取对应的工具箱分类
 */
export function getToolboxCategoryBySchemaCategory(schemaCategory?: string): ToolboxCategory | undefined {
  if (!schemaCategory) {
    return undefined;
  }
  return toolboxCategories.find((cat) => cat.category === schemaCategory);
}

/**
 * 根据 schema category 自动生成块列表
 */
export function getBlocksByCategory(category: string): string[] {
  const schemas = sortByLegacyOrder(
    blockRegistry.getRegisteredSchemas().length ? blockRegistry.getRegisteredSchemas() : allSchemas,
    category,
  );
  if (category === 'eventControl') {
    return schemas
      .filter((schema) => ['control', 'interaction'].includes(schema.category ?? '') && !schema.isValue)
      .map((schema) => schema.definition.type);
  }
  if (category === 'sound') {
    const soundEvents = new Set([
      'playSound',
      'stopSound',
      'playBgm',
      'pauseBgm',
      'resumeBgm',
      'setVolume',
      'loadBgm',
      'freeBgm',
      'setBgmSpeed',
      'showImage',
      'hideImage',
      'showTextImage',
      'moveImage',
      'rotateImage',
      'scaleImage',
      'showGif',
    ]);
    return schemas.filter((schema) => soundEvents.has(schema.eventType)).map((schema) => schema.definition.type);
  }
  if (category === 'effect') {
    const soundBlocks = new Set(getBlocksByCategory('sound'));
    return schemas
      .filter((schema) => schema.category === 'effect' && !soundBlocks.has(schema.definition.type))
      .map((schema) => schema.definition.type);
  }
  if (category === 'native') {
    return schemas
      .filter((schema) => ['function', '_unknown'].includes(schema.eventType))
      .map((schema) => schema.definition.type);
  }
  if (category === 'value') {
    return schemas.filter((schema) => schema.isValue).map((schema) => schema.definition.type);
  }
  return schemas
    .filter((schema) => (schema.toolbox?.category ?? schema.category) === category && !schema.isValue)
    .map((schema) => schema.definition.type);
}

/**
 * 生成工具箱配置
 *
 * @param entryType - 当前编辑的入口类型（用于动态筛选入口块）
 * @returns Blockly 工具箱配置
 */
export function generateToolboxConfig(_entryType?: string): Blockly.utils.toolbox.ToolboxDefinition {
  const contents: Blockly.utils.toolbox.ToolboxItemInfo[] = [];

  for (const category of toolboxCategories) {
    // 跳过动态分类（由回调处理）
    if (category.custom) {
      contents.push({
        kind: 'category',
        name: category.name,
        colour: String(category.colour),
        custom: category.custom,
      });
      continue;
    }

    // 静态分类：根据 category 自动生成块列表
    if (category.category) {
      const blocks = getBlocksByCategory(category.category);
      if (blocks.length > 0) {
        contents.push({
          kind: 'category',
          name: category.name,
          colour: String(category.colour),
          contents: blocks.map((type) => ({
            kind: 'block',
            type,
          })),
        });
      }
    }
  }

  const registeredCategories = blockRegistry
    .getRegisteredCategories()
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
  for (const category of registeredCategories) {
    const blocks = getBlocksByCategory(category.id);
    contents.push({
      kind: 'category',
      name: category.name,
      colour: String(category.colour),
      contents: blocks.map((type) => ({ kind: 'block', type })),
    });
  }

  return {
    kind: 'categoryToolbox',
    contents,
  };
}
