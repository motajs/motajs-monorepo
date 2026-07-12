/**
 * traversal 单元测试
 *
 * 测试表格树构建工具函数
 */

import { describe, expect, it } from 'vitest';
import {
  buildTableTree,
  defaultCobj,
} from '../traversal';
import type { CommentObject, FieldArgs } from '../../types';

describe('traversal', () => {
  describe('defaultCobj', () => {
    it('应该有默认的 _type 为 textarea', () => {
      expect(defaultCobj._type).toBe('textarea');
    });

    it('应该有默认的 _data 为空字符串', () => {
      expect(defaultCobj._data).toBe('');
    });

    it('_leaf 函数应该对 null 返回 true', () => {
      const args: FieldArgs = {
        field: '',
        cfield: '',
        vobj: null,
        cobj: {},
      };
      expect((defaultCobj._leaf as (args: FieldArgs) => boolean)(args)).toBe(true);
    });

    it('_leaf 函数应该对字符串返回 true', () => {
      const args: FieldArgs = {
        field: '',
        cfield: '',
        vobj: 'test',
        cobj: {},
      };
      expect((defaultCobj._leaf as (args: FieldArgs) => boolean)(args)).toBe(true);
    });

    it('_leaf 函数应该对空对象返回 true', () => {
      const args: FieldArgs = {
        field: '',
        cfield: '',
        vobj: {},
        cobj: {},
      };
      expect((defaultCobj._leaf as (args: FieldArgs) => boolean)(args)).toBe(true);
    });

    it('_leaf 函数应该对非空对象返回 false', () => {
      const args: FieldArgs = {
        field: '',
        cfield: '',
        vobj: { a: 1 },
        cobj: {},
      };
      expect((defaultCobj._leaf as (args: FieldArgs) => boolean)(args)).toBe(false);
    });
  });

  describe('buildTableTree', () => {
    it('应该为简单叶节点数据构建树', () => {
      const data = { name: 'test', value: 123 };
      const commentObj: CommentObject = {
        _data: {
          name: { _leaf: true, _data: '名称' },
          value: { _leaf: true, _data: '数值' },
        },
      };

      const { rootNodes, gapFields } = buildTableTree(data, commentObj);

      expect(rootNodes).toHaveLength(2);
      expect(gapFields).toHaveLength(0);

      expect(rootNodes[0].field).toBe("['name']");
      expect(rootNodes[0].shortField).toBe('name');
      expect(rootNodes[0].isGap).toBe(false);
      expect(rootNodes[0].value).toBe('test');

      expect(rootNodes[1].field).toBe("['value']");
      expect(rootNodes[1].value).toBe(123);
    });

    it('应该为嵌套数据构建树', () => {
      const data = {
        main: {
          floorIds: ['MT0'],
          images: [],
        },
      };
      const commentObj: CommentObject = {
        _data: {
          main: {
            _type: 'object',
            _data: {
              floorIds: { _leaf: true, _data: '楼层ID列表' },
              images: { _leaf: true, _data: '图片列表' },
            },
          },
        },
      };

      const { rootNodes, gapFields } = buildTableTree(data, commentObj);

      expect(rootNodes).toHaveLength(1);
      expect(gapFields).toHaveLength(1);
      expect(gapFields[0]).toBe("['main']");

      const mainNode = rootNodes[0];
      expect(mainNode.isGap).toBe(true);
      expect(mainNode.field).toBe("['main']");
      expect(mainNode.children).toHaveLength(2);

      expect(mainNode.children![0].field).toBe("['main']['floorIds']");
      expect(mainNode.children![0].value).toEqual(['MT0']);
    });

    it('应该处理 _hide 配置', () => {
      const data = { visible: 1, hidden: 2 };
      const commentObj: CommentObject = {
        _data: {
          visible: { _leaf: true, _data: '可见' },
          hidden: { _leaf: true, _data: '隐藏', _hide: true },
        },
      };

      const { rootNodes } = buildTableTree(data, commentObj);

      expect(rootNodes).toHaveLength(1);
      expect(rootNodes[0].field).toBe("['visible']");
    });

    it('应该处理动态 _hide 函数', () => {
      const data = { show: 1, hide: 2 };
      const commentObj: CommentObject = {
        _data: {
          show: { _leaf: true, _data: '显示', _hide: () => false },
          hide: { _leaf: true, _data: '隐藏', _hide: () => true },
        },
      };

      const { rootNodes } = buildTableTree(data, commentObj);

      expect(rootNodes).toHaveLength(1);
      expect(rootNodes[0].field).toBe("['show']");
    });

    it('应该处理 _docs 短注释', () => {
      const data = { field: 'value' };
      const commentObj: CommentObject = {
        _data: {
          field: { _leaf: true, _data: '完整注释', _docs: '短注释' },
        },
      };

      const { rootNodes } = buildTableTree(data, commentObj);

      expect(rootNodes[0].comment).toBe('完整注释');
      expect(rootNodes[0].shortComment).toBe('短注释');
    });

    it('应该处理不同的 _type 配置', () => {
      const data = {
        text: 'hello',
        check: true,
        select: 'option1',
      };
      const commentObj: CommentObject = {
        _data: {
          text: { _leaf: true, _type: 'textarea', _data: '文本' },
          check: { _leaf: true, _type: 'checkbox', _data: '复选框' },
          select: {
            _leaf: true,
            _type: 'select',
            _select: { values: ['option1', 'option2'] },
            _data: '选择',
          },
        },
      };

      const { rootNodes } = buildTableTree(data, commentObj);

      expect(rootNodes[0].config._type).toBe('textarea');
      expect(rootNodes[1].config._type).toBe('checkbox');
      expect(rootNodes[2].config._type).toBe('select');
    });

    it('应该处理函数形式的 _data 配置', () => {
      const data = { item1: 'a', item2: 'b' };
      const commentObj: CommentObject = {
        _data: (key: string) => ({
          _leaf: true,
          _data: `动态注释: ${key}`,
        }),
      };

      const { rootNodes } = buildTableTree(data, commentObj);

      expect(rootNodes).toHaveLength(2);
      expect(rootNodes[0].comment).toBe('动态注释: item1');
      expect(rootNodes[1].comment).toBe('动态注释: item2');
    });

    it('应该按照 commentObj 的顺序排列字段', () => {
      const data = { c: 3, a: 1, b: 2 };
      const commentObj: CommentObject = {
        _data: {
          a: { _leaf: true, _data: 'A' },
          b: { _leaf: true, _data: 'B' },
          c: { _leaf: true, _data: 'C' },
        },
      };

      const { rootNodes } = buildTableTree(data, commentObj);

      expect(rootNodes[0].shortField).toBe('a');
      expect(rootNodes[1].shortField).toBe('b');
      expect(rootNodes[2].shortField).toBe('c');
    });

    it('应该处理 data 中有但 commentObj 中没有的字段', () => {
      const data = { defined: 1, extra: 2 };
      const commentObj: CommentObject = {
        _data: {
          defined: { _leaf: true, _data: '已定义' },
        },
      };

      const { rootNodes } = buildTableTree(data, commentObj);

      // 应该包含两个字段，extra 使用默认配置
      expect(rootNodes).toHaveLength(2);
      expect(rootNodes[0].shortField).toBe('defined');
      expect(rootNodes[1].shortField).toBe('extra');
    });

    it('应该处理空数据', () => {
      const data = {};
      const commentObj: CommentObject = {};

      const { rootNodes, gapFields } = buildTableTree(data, commentObj);

      expect(rootNodes).toHaveLength(0);
      expect(gapFields).toHaveLength(0);
    });

    it('应该使用 field 作为节点唯一标识', () => {
      const data = { a: 1, b: 2, c: 3 };
      const commentObj: CommentObject = {
        _data: {
          a: { _leaf: true },
          b: { _leaf: true },
          c: { _leaf: true },
        },
      };

      const { rootNodes } = buildTableTree(data, commentObj);

      const fields = rootNodes.map(n => n.field);
      const uniqueFields = new Set(fields);
      expect(uniqueFields.size).toBe(fields.length);
      expect(fields).toEqual(["['a']", "['b']", "['c']"]);
    });

    it('应该正确处理深层嵌套结构', () => {
      const data = {
        level1: {
          level2: {
            level3: 'deep value',
          },
        },
      };
      const commentObj: CommentObject = {
        _data: {
          level1: {
            _type: 'object',
            _data: {
              level2: {
                _type: 'object',
                _data: {
                  level3: { _leaf: true, _data: '深层值' },
                },
              },
            },
          },
        },
      };

      const { rootNodes, gapFields } = buildTableTree(data, commentObj);

      expect(gapFields).toHaveLength(2);
      expect(gapFields).toContain("['level1']");
      expect(gapFields).toContain("['level1']['level2']");

      const level3Node = rootNodes[0].children![0].children![0];
      expect(level3Node.field).toBe("['level1']['level2']['level3']");
      expect(level3Node.value).toBe('deep value');
    });
  });
});
