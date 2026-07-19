/**
 * 未知事件块 Schema
 *
 * 用于显示无法识别的事件类型，以 JSON 格式展示原始数据
 * 确保任何事件数据都不会丢失
 */

import type * as Blockly from 'blockly';

import type { BlockState, EventObject, ParseContext } from '../parser/types';
import type { BlockSchema } from '../registry/types';

/**
 * 未知事件块
 *
 * 显示事件类型和完整的 JSON 数据
 */
export const unknownSchema: BlockSchema = {
  eventType: '_unknown', // 特殊内部类型
  definition: {
    type: 'mota_unknown',
    message0: '未知事件 [%1] %2 %3 %4',
    args0: [
      {
        type: 'field_input',
        name: 'EVENT_TYPE',
        text: 'unknown',
      },
      {
        type: 'field_multilinetext',
        name: 'JSON_DATA',
        text: '{}',
      },
      {
        type: 'field_label',
        name: 'DIAGNOSTIC',
        text: '',
      },
      {
        type: 'field_mota_action',
        text: '注册自定义块',
        action: 'registerUnknownEvent',
      },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 0,
    tooltip: '未识别的事件类型，以 JSON 格式显示',
    helpUrl: '',
  },
  category: 'other',
  parser: (event: EventObject, _context: ParseContext): BlockState => {
    return {
      type: 'mota_unknown',
      fields: {
        EVENT_TYPE: event.type || 'unknown',
        JSON_DATA: JSON.stringify(event, null, 2),
        DIAGNOSTIC: event.type === 'animateImage'
          ? '旧版兼容事件，无可确认执行语义，已按原始 JSON 保留'
          : '',
      },
    };
  },
  generator: (block: Blockly.Block): string => {
    const jsonData = block.getFieldValue('JSON_DATA');
    try {
      // 尝试解析并重新格式化，确保是有效 JSON
      const parsed = JSON.parse(jsonData);
      return JSON.stringify(parsed) + ',\n';
    } catch {
      // 如果解析失败，返回原始字符串
      return jsonData + ',\n';
    }
  },
};

export const unknownSchemas: BlockSchema[] = [unknownSchema];
