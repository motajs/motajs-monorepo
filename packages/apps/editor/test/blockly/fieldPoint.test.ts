/**
 * FieldPoint 单元测试
 *
 * 测试 FieldPoint 字段的值处理和验证逻辑
 */

import { describe, it, expect, beforeAll } from 'vitest';

import { registerAllBlocks } from '@/blockly/blocks';
import { parseEvent } from '@/blockly/parser/eventToState';
import type { EventObject, ParseContext } from '@/blockly/parser/types';
import type { PointValue } from '@/blockly/fields';

// 测试上下文
const testContext: ParseContext = { entryType: 'event' };

// 初始化注册表（包括自定义字段）
beforeAll(() => {
  registerAllBlocks();
});

describe('FieldPoint', () => {
  describe('changeFloor 事件解析', () => {
    it('应该解析完整的 changeFloor 事件', () => {
      const event: EventObject = {
        type: 'changeFloor',
        floorId: 'MT1',
        loc: [5, 6],
        direction: 'up',
        time: 500,
      };
      const state = parseEvent(event, testContext);

      expect(state.type).toBe('mota_changeFloor_s');
      const position = state.fields?.POSITION as PointValue;
      expect(position).toEqual({ x: 5, y: 6, floorId: 'MT1' });
      expect(state.fields?.DIRECTION).toBe('up');
      expect(state.fields?.TIME).toBe('500');
    });

    it('应该解析不带楼层的 changeFloor 事件', () => {
      const event: EventObject = {
        type: 'changeFloor',
        loc: [3, 4],
      };
      const state = parseEvent(event, testContext);

      expect(state.type).toBe('mota_changeFloor_s');
      const position = state.fields?.POSITION as PointValue;
      expect(position).toEqual({ x: 3, y: 4, floorId: undefined });
    });

    it('应该解析不带坐标的 changeFloor 事件', () => {
      const event: EventObject = {
        type: 'changeFloor',
        floorId: 'MT2',
      };
      const state = parseEvent(event, testContext);

      expect(state.type).toBe('mota_changeFloor_s');
      const position = state.fields?.POSITION as PointValue;
      expect(position).toEqual({ x: 0, y: 0, floorId: 'MT2' });
    });

    it('应该解析空的 changeFloor 事件', () => {
      const event: EventObject = {
        type: 'changeFloor',
      };
      const state = parseEvent(event, testContext);

      expect(state.type).toBe('mota_changeFloor_s');
      const position = state.fields?.POSITION as PointValue;
      expect(position).toEqual({ x: 0, y: 0, floorId: undefined });
    });
  });

  describe('PointValue 结构', () => {
    it('应该包含 x, y 必需字段', () => {
      const event: EventObject = {
        type: 'changeFloor',
        loc: [10, 20],
      };
      const state = parseEvent(event, testContext);
      const position = state.fields?.POSITION as PointValue;

      expect(position.x).toBe(10);
      expect(position.y).toBe(20);
    });

    it('floorId 应该是可选的', () => {
      const event: EventObject = {
        type: 'changeFloor',
        loc: [1, 2],
      };
      const state = parseEvent(event, testContext);
      const position = state.fields?.POSITION as PointValue;

      expect(position.floorId).toBeUndefined();
    });

    it('floorId 应该正确保存', () => {
      const event: EventObject = {
        type: 'changeFloor',
        floorId: 'TestFloor',
        loc: [0, 0],
      };
      const state = parseEvent(event, testContext);
      const position = state.fields?.POSITION as PointValue;

      expect(position.floorId).toBe('TestFloor');
    });
  });
});
