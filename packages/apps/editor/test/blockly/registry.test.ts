/**
 * BlockRegistry 集成测试
 *
 * 验证所有块的解析-生成双向转换
 */

import { describe, it, expect, beforeAll } from 'vitest';

import { blockRegistry } from '@/blockly/registry';
import { registerAllSchemas, allSchemas } from '@/blockly/schemas';
import { parseEvent, parseEventList } from '@/blockly/parser/eventToState';
import type { EventObject, ParseContext } from '@/blockly/parser/types';

// 测试上下文
const testContext: ParseContext = { entryType: 'event' };

// 初始化注册表
beforeAll(() => {
  registerAllSchemas();
});

describe('BlockRegistry', () => {
  describe('基础功能', () => {
    it('应该注册所有内置块', () => {
      // 检查 allSchemas 中有足够多的块定义
      expect(allSchemas.length).toBeGreaterThan(50);
    });

    it('应该能通过 eventType 获取解析器', () => {
      const parser = blockRegistry.getParser('comment');
      expect(parser).not.toBeNull();
    });

    it('应该对未注册的类型返回 null', () => {
      const parser = blockRegistry.getParser('nonexistent_type');
      expect(parser).toBeNull();
    });
  });

  describe('文本类块解析', () => {
    it('应该解析 comment 事件', () => {
      const event: EventObject = { type: 'comment', text: '这是注释' };
      const state = parseEvent(event, testContext);

      expect(state.type).toBe('mota_comment_s');
      expect(state.fields?.TEXT).toBe('这是注释');
    });

    it('应该解析 tip 事件', () => {
      const event: EventObject = { type: 'tip', text: '提示信息', icon: 'info' };
      const state = parseEvent(event, testContext);

      expect(state.type).toBe('mota_tip_s');
      expect(state.fields?.TEXT).toBe('提示信息');
      expect(state.fields?.ICON).toBe('info');
    });

    it('应该解析简单文本字符串', () => {
      const state = parseEvent('简单文本', testContext);

      expect(state.type).toBe('mota_text_0_s');
      expect(state.fields?.TEXT).toBe('简单文本');
    });

    it('应该解析带标题的文本', () => {
      const event: EventObject = { type: 'text', text: '\\t[老人,man]你好！' };
      const state = parseEvent(event, testContext);

      expect(state.type).toBe('mota_text_1_s');
      expect(state.fields?.TITLE).toBe('老人');
      expect(state.fields?.ICON).toBe('man');
      expect(state.fields?.TEXT).toBe('你好！');
    });
  });

  describe('控制流块解析', () => {
    it('应该解析 if 事件（有 false 分支）', () => {
      const event: EventObject = {
        type: 'if',
        condition: 'flag:test > 0',
        true: [{ type: 'comment', text: 'true 分支' }],
        false: [{ type: 'comment', text: 'false 分支' }],
      };
      const state = parseEvent(event, testContext);

      expect(state.type).toBe('mota_if_s');
      expect(state.inputs?.CONDITION).toBeDefined();
      expect(state.inputs?.DO_TRUE).toBeDefined();
      expect(state.inputs?.DO_FALSE).toBeDefined();
    });

    it('应该解析 if 事件（无 false 分支）', () => {
      const event: EventObject = {
        type: 'if',
        condition: 'flag:test > 0',
        true: [{ type: 'comment', text: 'true 分支' }],
      };
      const state = parseEvent(event, testContext);

      expect(state.type).toBe('mota_if_1_s');
      expect(state.inputs?.CONDITION).toBeDefined();
      expect(state.inputs?.DO_TRUE).toBeDefined();
      expect(state.inputs?.DO_FALSE).toBeUndefined();
    });

    it('应该解析 while 事件', () => {
      const event: EventObject = {
        type: 'while',
        condition: 'flag:count < 10',
        data: [{ type: 'comment', text: '循环体' }],
      };
      const state = parseEvent(event, testContext);

      expect(state.type).toBe('mota_while_s');
      expect(state.inputs?.CONDITION).toBeDefined();
      expect(state.inputs?.DO).toBeDefined();
    });

    it('应该解析 for 事件', () => {
      const event: EventObject = {
        type: 'for',
        name: 'temp:i',
        from: 0,
        to: 10,
        step: 1,
        data: [{ type: 'comment', text: '循环体' }],
      };
      const state = parseEvent(event, testContext);

      expect(state.type).toBe('mota_for_s');
      expect(state.fields?.FROM).toBe('0');
      expect(state.fields?.TO).toBe('10');
      expect(state.fields?.STEP).toBe('1');
    });

    it('应该解析 break 事件', () => {
      const event: EventObject = { type: 'break', n: 2 };
      const state = parseEvent(event, testContext);

      expect(state.type).toBe('mota_break_s');
      expect(state.fields?.N).toBe('2');
    });

    it('应该解析 sleep 事件', () => {
      const event: EventObject = { type: 'sleep', time: 1000, noSkip: true };
      const state = parseEvent(event, testContext);

      expect(state.type).toBe('mota_sleep_s');
      expect(state.fields?.TIME).toBe('1000');
      expect(state.fields?.NO_SKIP).toBe(true);
    });
  });

  describe('数据操作块解析', () => {
    it('应该解析 setValue 事件', () => {
      const event: EventObject = {
        type: 'setValue',
        name: 'status:hp',
        operator: '+=',
        value: '100',
      };
      const state = parseEvent(event, testContext);

      expect(state.type).toBe('mota_setValue_s');
      expect(state.fields?.NAME).toBe('status:hp');
      expect(state.fields?.OPERATOR).toBe('+=');
      expect(state.fields?.VALUE).toBe('100');
    });

    it('应该解析 setEnemy 事件', () => {
      const event: EventObject = {
        type: 'setEnemy',
        id: 'greenSlime',
        name: 'hp',
        value: '100',
      };
      const state = parseEvent(event, testContext);

      expect(state.type).toBe('mota_setEnemy_s');
      expect(state.fields?.ID).toBe('greenSlime');
      expect(state.fields?.PROP).toBe('hp');
    });
  });

  describe('地图处理块解析', () => {
    it('应该解析 show 事件', () => {
      const event: EventObject = { type: 'show', loc: [5, 6], time: 500 };
      const state = parseEvent(event, testContext);

      expect(state.type).toBe('mota_show_s');
      expect(state.fields?.X).toBe('5');
      expect(state.fields?.Y).toBe('6');
      expect(state.fields?.TIME).toBe('500');
    });

    it('应该解析 hide 事件', () => {
      const event: EventObject = { type: 'hide', loc: [3, 4], remove: true };
      const state = parseEvent(event, testContext);

      expect(state.type).toBe('mota_hide_s');
      expect(state.fields?.X).toBe('3');
      expect(state.fields?.Y).toBe('4');
      expect(state.fields?.REMOVE).toBe(true);
    });

    it('应该解析 setBlock 事件', () => {
      const event: EventObject = {
        type: 'setBlock',
        number: 'yellowDoor',
        loc: [[1, 2], [3, 4]],
      };
      const state = parseEvent(event, testContext);

      expect(state.type).toBe('mota_setBlock_s');
      expect(state.fields?.NUMBER).toBe('yellowDoor');
      expect(state.fields?.LOCS).toBe('[[1,2],[3,4]]');
    });

    it('应该解析 changeFloor 事件', () => {
      const event: EventObject = {
        type: 'changeFloor',
        floorId: 'MT1',
        loc: [5, 6],
        direction: 'up',
      };
      const state = parseEvent(event, testContext);

      expect(state.type).toBe('mota_changeFloor_s');
      // 现在使用结构化的 POSITION 字段（PointValue）
      expect(state.fields?.POSITION).toEqual({ x: 5, y: 6, floorId: 'MT1' });
      expect(state.fields?.DIRECTION).toBe('up');
    });
  });

  describe('交互选择块解析', () => {
    it('应该解析 win 事件', () => {
      const event: EventObject = { type: 'win', reason: '通关' };
      const state = parseEvent(event, testContext);

      expect(state.type).toBe('mota_win_s');
      expect(state.fields?.REASON).toBe('通关');
    });

    it('应该解析 lose 事件', () => {
      const event: EventObject = { type: 'lose', reason: '失败' };
      const state = parseEvent(event, testContext);

      expect(state.type).toBe('mota_lose_s');
      expect(state.fields?.REASON).toBe('失败');
    });

    it('应该解析 input 事件', () => {
      const event: EventObject = { type: 'input', text: '请输入数值' };
      const state = parseEvent(event, testContext);

      expect(state.type).toBe('mota_input_s');
      expect(state.fields?.TEXT).toBe('请输入数值');
    });
  });

  describe('特效声音块解析', () => {
    it('应该解析 animate 事件', () => {
      const event: EventObject = { type: 'animate', name: 'attack', loc: [5, 6] };
      const state = parseEvent(event, testContext);

      expect(state.type).toBe('mota_animate_s');
      expect(state.fields?.NAME).toBe('attack');
      expect(state.fields?.X).toBe('5');
    });

    it('应该解析 playSound 事件', () => {
      const event: EventObject = { type: 'playSound', name: 'attack.mp3' };
      const state = parseEvent(event, testContext);

      expect(state.type).toBe('mota_playSound_s');
      expect(state.fields?.NAME).toBe('attack.mp3');
    });

    it('应该解析 setCurtain 事件', () => {
      const event: EventObject = {
        type: 'setCurtain',
        color: [0, 0, 0, 0.5],
        time: 1000,
      };
      const state = parseEvent(event, testContext);

      expect(state.type).toBe('mota_setCurtain_s');
      expect(state.fields?.R).toBe('0');
      expect(state.fields?.A).toBe('0.5');
    });
  });

  describe('其他事件块解析', () => {
    it('应该将真实工程使用的 UI 事件解析为结构化块', () => {
      const event: EventObject = {
        type: 'previewUI',
        action: [
          { type: 'fillRect', x: 0, y: 0, width: 'flag:x', height: 300 },
          { type: 'fillBoldText', x: 20, y: 30, text: '开始游戏' },
        ],
      };
      const state = parseEvent(event, testContext);

      expect(state.type).toBe('mota_previewUI_s');
      expect(state.inputs?.ACTION?.block?.type).toBe('mota_fillRect_s');
      expect(state.inputs?.ACTION?.block?.next?.block?.type).toBe('mota_fillBoldText_s');
    });

    it('应该解析素材和 UI 辅助事件而不是 unknown', () => {
      expect(parseEvent({ type: 'drawIcon', id: 'yellowKey', x: 0, y: 32 }, testContext).type)
        .toBe('mota_drawIcon_s');
      expect(parseEvent({ type: 'drawSelector', code: 1 }, testContext).type)
        .toBe('mota_drawSelector_s');
      expect(parseEvent({ type: 'moveAction' }, testContext).type)
        .toBe('mota_moveAction_s');
      expect(parseEvent({ type: 'setHeroIcon', name: 'hero.png' }, testContext).type)
        .toBe('mota_setHeroIcon_s');
    });

    it('应该解析 trigger 事件', () => {
      const event: EventObject = { type: 'trigger', loc: [3, 4] };
      const state = parseEvent(event, testContext);

      expect(state.type).toBe('mota_trigger_s');
      expect(state.fields?.X).toBe('3');
      expect(state.fields?.Y).toBe('4');
    });

    it('应该解析 insert 事件', () => {
      const event: EventObject = { type: 'insert', name: '加点事件', args: [1, 2] };
      const state = parseEvent(event, testContext);

      expect(state.type).toBe('mota_insert_s');
      expect(state.fields?.NAME).toBe('加点事件');
      expect(state.fields?.ARGS).toBe('[1,2]');
    });

    it('应该解析 function 事件', () => {
      const event: EventObject = { type: 'function', function: 'console.log(1)' };
      const state = parseEvent(event, testContext);

      expect(state.type).toBe('mota_function_s');
      expect(state.fields?.CODE).toBe('console.log(1)');
    });
  });

  describe('未知事件处理', () => {
    it('应该将未知事件转为 unknown 块', () => {
      const event: EventObject = { type: 'customEvent', data: 123 };
      const state = parseEvent(event, testContext);

      expect(state.type).toBe('mota_unknown');
      expect(state.fields?.EVENT_TYPE).toBe('customEvent');
      expect(state.fields?.JSON_DATA).toContain('customEvent');
    });
  });
});

describe('事件列表解析', () => {
  it('应该正确解析嵌套的事件列表', () => {
    const events = [
      { type: 'comment', text: '第一条' },
      {
        type: 'if',
        condition: 'true',
        true: [
          { type: 'comment', text: '嵌套注释' },
        ],
      },
      { type: 'comment', text: '最后一条' },
    ];

    const state = parseEventList(events, testContext);

    expect(state).not.toBeNull();
    expect(state!.type).toBe('mota_comment_s');
    expect(state!.next?.block?.type).toBe('mota_if_1_s');
    expect(state!.next?.block?.next?.block?.type).toBe('mota_comment_s');
  });
});
