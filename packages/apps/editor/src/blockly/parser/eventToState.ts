/**
 * 事件 JSON 到 Blockly State 转换器
 *
 * 将 MotaAction 事件数据解析为 Blockly v12 JSON State
 * 使用 BlockRegistry 进行解析，支持扩展
 */

import { blockRegistry, setParseEventListFn } from '../registry';
import { unknownSchema } from '../schemas/unknown';

import type { BlockState, EventData, EventObject, ParseContext, WorkspaceState } from './types';

// ============================================
// 主要解析函数
// ============================================

/**
 * 解析事件列表，返回链式 BlockState
 *
 * @param events - 事件数组
 * @param context - 解析上下文
 * @returns 第一个块的状态，后续块通过 next 链接
 */
export function parseEventList(events: EventData[], context: ParseContext = { entryType: 'event' }): BlockState | null {
  if (!events || events.length === 0) {
    return null;
  }

  // 从后往前处理，构建链表
  let nextBlock: BlockState | null = null;

  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    const block = parseEvent(event, context);

    if (nextBlock) {
      block.next = { block: nextBlock };
    }

    nextBlock = block;
  }

  return nextBlock;
}

// 注册 parseEventList 到 utils（避免循环依赖）
setParseEventListFn(parseEventList);

/**
 * 解析单个事件
 *
 * @param event - 事件数据（字符串或对象）
 * @param context - 解析上下文
 * @returns BlockState
 */
export function parseEvent(event: EventData, context: ParseContext = { entryType: 'event' }): BlockState {
  // 字符串是简单文本
  if (typeof event === 'string') {
    return parseTextString(event, context);
  }

  if (event.type === 'text') {
    return parseTextEvent(event, context);
  }

  // 特殊处理：if 事件根据是否有 false 分支选择不同的块
  if (event.type === 'if') {
    return parseIfEvent(event, context);
  }

  // 从注册表获取解析器
  const parser = blockRegistry.getParserForEvent(event);
  if (parser) {
    return parser(event, context);
  }

  // 未知类型，使用 unknown 块
  return parseUnknownEvent(event, context);
}

// ============================================
// 特殊解析函数
// ============================================

/**
 * 解析纯字符串文本
 *
 * 检查是否包含标题/图标格式，选择合适的块类型
 */
function parseTextString(text: string, context: ParseContext): BlockState {
  return parseTextEvent({ type: 'text', text }, context);
}

function parseTextEvent(event: EventObject, context: ParseContext): BlockState {
  const text = String(event.text ?? '');
  // 与旧 ActionParser 一致：只有存在高级显示参数时才展开完整选项块。
  const hasTextMetadata =
    text.includes('\t[') || text.includes('\\t[') || text.includes('\b[') || text.includes('\\b[');
  const hasTextDrawing = text.includes('\f[') || text.includes('\\f[');
  const hasAdvancedOptions = hasTextMetadata || event.pos != null || Boolean(event.code) || hasTextDrawing;

  if (hasAdvancedOptions) {
    const parser = blockRegistry.getParser('text');
    if (parser) return parser(event, context);
  }

  return {
    type: 'mota_text_0_s',
    fields: {
      TEXT: text,
    },
    ...(event._collapsed === true ? { collapsed: true } : {}),
    ...(event._disabled === true ? { enabled: false } : {}),
  };
}

/**
 * 解析 if 事件
 *
 * 根据是否有 false 分支选择不同的块类型
 */
function parseIfEvent(event: EventObject, context: ParseContext): BlockState {
  const falseEvents = (event.false as EventData[]) || [];
  const hasFalse = falseEvents.length > 0;

  if (hasFalse) {
    // 有 else 分支，使用 if_s
    const parser = blockRegistry.getParser('if');
    if (parser) {
      return parser(event, context);
    }
  } else {
    // 无 else 分支，使用 if_1_s
    const parser = blockRegistry.getParser('if_no_else');
    if (parser) {
      return parser(event, context);
    }
  }

  // 兜底
  return parseUnknownEvent(event, context);
}

/**
 * 解析未知类型事件
 * 将整个事件以 JSON 格式显示
 */
function parseUnknownEvent(event: EventObject, context: ParseContext): BlockState {
  if (unknownSchema.parser) {
    return unknownSchema.parser(event, context);
  }

  return {
    type: 'mota_unknown',
    fields: {
      EVENT_TYPE: event.type || 'unknown',
      JSON_DATA: JSON.stringify(event, null, 2),
    },
  };
}

// ============================================
// Workspace State 生成
// ============================================

/**
 * 将事件列表转换为完整的 Workspace State
 *
 * @param events - 事件数组
 * @param context - 解析上下文
 * @returns WorkspaceState，可直接用于 Blockly.serialization.workspaces.load
 */
export function eventsToWorkspaceState(
  events: EventData[],
  context: ParseContext = { entryType: 'event' },
): WorkspaceState {
  const firstBlock = parseEventList(events, context);

  if (!firstBlock) {
    return {
      blocks: {
        languageVersion: 0,
        blocks: [],
      },
    };
  }

  // 设置第一个块的位置
  firstBlock.x = 50;
  firstBlock.y = 50;

  return {
    blocks: {
      languageVersion: 0,
      blocks: [firstBlock],
    },
  };
}

// ============================================
// 入口类型映射
// ============================================

/**
 * 入口类型到块类型的映射
 */
const ENTRY_TYPE_MAP: Record<string, string> = {
  event: 'mota_event_m',
  autoEvent: 'mota_autoEvent_m',
  shop: 'mota_shop_m',
  level: 'mota_level_m',
  changeFloor: 'mota_changeFloor_m',
  common: 'mota_common_m',
  commonEvent: 'mota_commonEvent_m',
  item: 'mota_item_m',
  beforeBattle: 'mota_beforeBattle_m',
  afterBattle: 'mota_afterBattle_m',
  afterGetItem: 'mota_afterGetItem_m',
  afterOpenDoor: 'mota_afterOpenDoor_m',
  doorInfo: 'mota_doorInfo_m',
  firstArrive: 'mota_firstArrive_m',
  eachArrive: 'mota_eachArrive_m',
  levelChoose: 'mota_levelChoose_m',
  floorPartition: 'mota_floorPartition_m',
  equip: 'mota_equip_m',
  floorImage: 'mota_floorImage_m',
  faceIds: 'mota_faceIds_m',
  splitImages: 'mota_splitImages_m',
  mainStyle: 'mota_mainStyle_m',
  nameMap: 'mota_nameMap_m',
};

/**
 * 简单入口类型列表（只包含 action 语句列表）
 */
const SIMPLE_ENTRY_TYPES = [
  'common',
  'commonEvent',
  'item',
  'beforeBattle',
  'afterBattle',
  'afterOpenDoor',
  'firstArrive',
  'eachArrive',
];

/**
 * 获取入口块类型
 */
export function getEntryBlockType(entryType: string): string {
  return ENTRY_TYPE_MAP[entryType] || 'mota_rawEntry_m';
}

export function hasDedicatedEntryType(entryType: string): boolean {
  return entryType in ENTRY_TYPE_MAP;
}

/**
 * 将事件数据转换为带入口块的 Workspace State
 *
 * @param data - 原始 JSON 数据
 * @param entryType - 入口类型
 * @returns WorkspaceState
 */
export function dataToWorkspaceStateWithEntry(
  data: unknown,
  entryType: string,
  project?: ParseContext['project'],
): WorkspaceState {
  const context: ParseContext = { entryType, project };
  const blockType = getEntryBlockType(entryType);

  // 获取入口块对应的解析器
  const parser = blockRegistry.getParser(`entry:${entryType}`);

  let entryBlock: BlockState;

  if (parser) {
    // 使用注册的解析器
    entryBlock = parser(data as EventObject, context);
  } else if (SIMPLE_ENTRY_TYPES.includes(entryType)) {
    // 简单入口类型：数据是事件数组
    let events: EventData[] = [];
    if (Array.isArray(data)) {
      events = data;
    } else if (data && typeof data === 'object' && 'data' in data) {
      events = (data as { data: EventData[] }).data || [];
    }

    const actionBlock = parseEventList(events, context);

    entryBlock = {
      type: blockType,
      inputs: actionBlock ? { ACTION: { block: actionBlock } } : {},
    };
  } else if (!hasDedicatedEntryType(entryType)) {
    entryBlock = {
      type: 'mota_rawEntry_m',
      fields: {
        ENTRY_TYPE: entryType,
        JSON_DATA: JSON.stringify(data, null, 2),
      },
    };
  } else {
    // 默认处理：尝试解析为事件数组
    let events: EventData[] = [];
    if (Array.isArray(data)) {
      events = data;
    } else if (data && typeof data === 'object') {
      if ('data' in data) {
        events = (data as { data: EventData[] }).data || [];
      } else {
        // 单个对象作为整个入口数据（如 changeFloor）
        const entryParser = blockRegistry.getParser(`entry:${entryType}`);
        if (entryParser) {
          entryBlock = entryParser(data as EventObject, context);
        } else {
          // 使用 common 作为默认
          const actionBlock = parseEventList(events, context);
          entryBlock = {
            type: 'mota_common_m',
            inputs: actionBlock ? { ACTION: { block: actionBlock } } : {},
          };
        }
        entryBlock!.x = 50;
        entryBlock!.y = 50;

        return {
          blocks: {
            languageVersion: 0,
            blocks: [entryBlock!],
          },
        };
      }
    }

    const actionBlock = parseEventList(events, context);
    entryBlock = {
      type: blockType,
      inputs: actionBlock ? { ACTION: { block: actionBlock } } : {},
    };
  }

  // 设置位置
  entryBlock.x = 50;
  entryBlock.y = 50;

  return {
    blocks: {
      languageVersion: 0,
      blocks: [entryBlock],
    },
  };
}
