/**
 * 工具箱动态分类回调
 *
 * 实现入口方块和最近使用事件的动态筛选
 * 使用 Blockly v10+ 推荐的 JSON 格式（FlyoutItemInfoArray）
 */

import type * as Blockly from 'blockly';
import type { utils } from 'blockly';
import { allSchemas } from '../schemas';
import { blockRegistry } from '../registry';
import { editorConfigService } from '@/services/editorConfig';

/**
 * Flyout 块配置类型
 */
type FlyoutBlockInfo = utils.toolbox.BlockInfo;
type FlyoutItemInfoArray = utils.toolbox.FlyoutItemInfoArray;

/**
 * 最近使用的块类型列表
 */
const DEFAULT_RECENT_BLOCKS = [
  'mota_text_s',
  'mota_comment_s',
  'mota_show_s',
  'mota_hide_s',
  'mota_setValue_s',
  'mota_if_s',
  'mota_while_s',
  'mota_battle_s',
  'mota_openDoor_s',
  'mota_choices_s',
  'mota_setText_s',
  'mota_exit_s',
  'mota_sleep_s',
  'mota_setBlock_s',
  'mota_insert_s',
];
let recentBlocks: string[] | null = null;
let searchQuery = '';

function ensureRecentBlocks(): string[] {
  if (!recentBlocks) {
    recentBlocks = editorConfigService.get<string[]>('blocklyRecentBlocks', DEFAULT_RECENT_BLOCKS);
  }
  return recentBlocks;
}

export function setBlockSearchQuery(query: string): void {
  searchQuery = query.trim().toLocaleLowerCase();
}

export function getSearchBlockTypes(query = searchQuery): string[] {
  const normalized = query.trim().toLocaleLowerCase();
  const schemas = blockRegistry.getRegisteredSchemas().length ? blockRegistry.getRegisteredSchemas() : allSchemas;
  if (!normalized) return getRecentBlocks();
  return schemas
    .filter((schema) => {
      const definition = schema.definition;
      const text = [definition.type, definition.message0, definition.tooltip]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase();
      return text.includes(normalized);
    })
    .map((schema) => schema.definition.type);
}

/**
 * 记录块的使用
 */
export function addRecentBlock(type: string): void {
  recentBlocks = [type, ...ensureRecentBlocks().filter((t) => t !== type)].slice(0, 15);
  editorConfigService.set('blocklyRecentBlocks', recentBlocks);
}

/**
 * 获取最近使用的块
 */
export function getRecentBlocks(): string[] {
  return ensureRecentBlocks();
}

/**
 * 清空最近使用的块
 */
export function clearRecentBlocks(): void {
  recentBlocks = [];
  editorConfigService.set('blocklyRecentBlocks', []);
}

/**
 * 入口方块分类回调
 *
 * 根据当前编辑类型动态筛选入口块
 *
 * @param entryType - 当前编辑的入口类型（如 'event', 'autoEvent', 'common' 等）
 * @returns 返回一个回调函数，该函数返回块配置的 JSON 数组
 */
export function createEntranceCategoryCallback(
  entryType?: string,
): (workspace: Blockly.Workspace) => FlyoutItemInfoArray {
  return (_workspace: Blockly.Workspace): FlyoutItemInfoArray => {
    // 确定有效的入口类型
    const validEntryTypes: string[] = [];
    if (entryType) {
      // 如果是公共入口类型，使用 'common'
      const commonEntries = [
        'beforeBattle',
        'afterBattle',
        'afterOpenDoor',
        'firstArrive',
        'eachArrive',
        'commonEvent',
        'item',
      ];
      if (commonEntries.includes(entryType)) {
        validEntryTypes.push('common');
      } else {
        validEntryTypes.push(entryType);
      }
    }

    // 筛选入口块
    const entrySchemas = allSchemas.filter((schema) => schema.category === 'entry' && !schema.isValue);

    const blocks: FlyoutItemInfoArray = [];

    for (const schema of entrySchemas) {
      const blockType = schema.definition.type;

      // 检查是否是有效的入口类型
      if (validEntryTypes.length > 0) {
        // 从 blockType 提取入口类型（如 'mota_event_m' -> 'event'）
        const schemaEntryType = blockType.replace('mota_', '').replace('_m', '');
        if (
          !validEntryTypes.includes(schemaEntryType) &&
          !(validEntryTypes.includes('common') && schemaEntryType === 'common')
        ) {
          continue;
        }
      }

      // 使用 JSON 格式定义块
      blocks.push({
        kind: 'block',
        type: blockType,
        gap: 5,
      } satisfies FlyoutBlockInfo);
    }

    return blocks;
  };
}

/**
 * 最近使用分类回调
 *
 * @param _workspace - Blockly workspace（未使用，但回调签名需要）
 * @returns 块配置的 JSON 数组
 */
export function createSearchBlockCategoryCallback(_workspace: Blockly.Workspace): FlyoutItemInfoArray {
  const recent = getRecentBlocks();
  const blocks: FlyoutItemInfoArray = [];

  const schemas = blockRegistry.getRegisteredSchemas().length ? blockRegistry.getRegisteredSchemas() : allSchemas;
  const candidates = searchQuery ? getSearchBlockTypes() : recent;

  for (const blockType of candidates) {
    // 验证块类型是否存在
    const schema = schemas.find((s) => s.definition.type === blockType);
    if (!schema || schema.isValue) {
      continue;
    }

    blocks.push({
      kind: 'block',
      type: blockType,
      gap: 5,
    } satisfies FlyoutBlockInfo);
  }

  return blocks;
}

/**
 * 注册工具箱分类回调
 *
 * @param workspace - Blockly workspace
 * @param entryType - 当前编辑的入口类型
 */
export function registerToolboxCallbacks(workspace: Blockly.WorkspaceSvg, entryType?: string): void {
  // 注册入口方块回调
  workspace.registerToolboxCategoryCallback('entranceCategory', createEntranceCategoryCallback(entryType));

  // 注册最近使用回调
  workspace.registerToolboxCategoryCallback('searchBlockCategory', createSearchBlockCategoryCallback);
}
