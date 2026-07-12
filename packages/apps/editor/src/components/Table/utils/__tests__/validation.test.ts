/**
 * validation 单元测试
 *
 * 测试值验证和 ID 验证工具函数
 */

import { describe, expect, it } from 'vitest';
import {
  checkRange,
  validateId,
  allowsNull,
  parseJsonValue,
} from '../validation';
import type { FieldConfig } from '../../types';

describe('validation', () => {
  describe('checkRange', () => {
    it('应该通过 _range 表达式验证有效值', () => {
      const cobj: FieldConfig = { _range: 'thiseval > 0' };
      expect(checkRange(cobj, 5)).toBe(true);
      expect(checkRange(cobj, 1)).toBe(true);
    });

    it('应该拒绝不满足 _range 表达式的值', () => {
      const cobj: FieldConfig = { _range: 'thiseval > 0' };
      expect(checkRange(cobj, 0)).toBe(false);
      expect(checkRange(cobj, -1)).toBe(false);
    });

    it('应该处理复杂的 _range 表达式', () => {
      const cobj: FieldConfig = { _range: 'thiseval >= 0 && thiseval <= 100' };
      expect(checkRange(cobj, 50)).toBe(true);
      expect(checkRange(cobj, 0)).toBe(true);
      expect(checkRange(cobj, 100)).toBe(true);
      expect(checkRange(cobj, -1)).toBe(false);
      expect(checkRange(cobj, 101)).toBe(false);
    });

    it('应该处理允许 null 的 _range 表达式', () => {
      const cobj: FieldConfig = { _range: 'thiseval == null || thiseval > 0' };
      expect(checkRange(cobj, null)).toBe(true);
      expect(checkRange(cobj, 5)).toBe(true);
      expect(checkRange(cobj, 0)).toBe(false);
    });

    it('应该通过 _select 验证有效选项', () => {
      const cobj: FieldConfig = { _select: { values: [1, 2, 3, 'a', 'b'] } };
      expect(checkRange(cobj, 1)).toBe(true);
      expect(checkRange(cobj, 'a')).toBe(true);
    });

    it('应该拒绝不在 _select 中的值', () => {
      const cobj: FieldConfig = { _select: { values: [1, 2, 3] } };
      expect(checkRange(cobj, 4)).toBe(false);
      expect(checkRange(cobj, 'a')).toBe(false);
    });

    it('没有验证规则时应该返回 true', () => {
      const cobj: FieldConfig = {};
      expect(checkRange(cobj, 'anything')).toBe(true);
      expect(checkRange(cobj, null)).toBe(true);
      expect(checkRange(cobj, 123)).toBe(true);
    });

    it('应该处理无效的 _range 表达式', () => {
      const cobj: FieldConfig = { _range: 'invalid syntax {{{{' };
      expect(checkRange(cobj, 5)).toBe(false);
    });

    it('应该处理整数验证', () => {
      const cobj: FieldConfig = { _range: 'thiseval == ~~thiseval' };
      expect(checkRange(cobj, 5)).toBe(true);
      expect(checkRange(cobj, 5.5)).toBe(false);
    });
  });

  describe('validateId', () => {
    it('应该验证有效的 ID', () => {
      const result = validateId('newItem', ['item1', 'item2'], false);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('应该拒绝空 ID', () => {
      expect(validateId('', [], false).valid).toBe(false);
      expect(validateId(null, [], false).valid).toBe(false);
      expect(validateId(undefined, [], false).valid).toBe(false);
    });

    it('应该拒绝包含非法字符的 ID', () => {
      const result = validateId('invalid-id', [], false);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('不符合规范');
    });

    it('应该拒绝包含空格的 ID', () => {
      const result = validateId('invalid id', [], false);
      expect(result.valid).toBe(false);
    });

    it('应该拒绝重复的 ID', () => {
      const result = validateId('item1', ['item1', 'item2'], false);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('已存在');
    });

    it('supportText 模式应该允许中文 ID', () => {
      const result = validateId('中文ID', [], true);
      expect(result.valid).toBe(true);
    });

    it('supportText 模式应该允许特殊字符', () => {
      const result = validateId('test-id', [], true);
      expect(result.valid).toBe(true);
    });

    it('非 supportText 模式应该只允许字母数字下划线', () => {
      expect(validateId('validId123', [], false).valid).toBe(true);
      expect(validateId('valid_id', [], false).valid).toBe(true);
      expect(validateId('ValidID', [], false).valid).toBe(true);
    });
  });

  describe('allowsNull', () => {
    it('应该检测允许 null 的配置', () => {
      const cobj: FieldConfig = { _range: 'thiseval == null || thiseval > 0' };
      expect(allowsNull(cobj)).toBe(true);
    });

    it('应该检测不允许 null 的配置', () => {
      const cobj: FieldConfig = { _range: 'thiseval > 0' };
      expect(allowsNull(cobj)).toBe(false);
    });

    it('没有验证规则时应该允许 null', () => {
      const cobj: FieldConfig = {};
      expect(allowsNull(cobj)).toBe(true);
    });
  });

  describe('parseJsonValue', () => {
    it('应该正确解析有效 JSON', () => {
      expect(parseJsonValue('123')).toEqual({ success: true, value: 123 });
      expect(parseJsonValue('"hello"')).toEqual({ success: true, value: 'hello' });
      expect(parseJsonValue('true')).toEqual({ success: true, value: true });
      expect(parseJsonValue('null')).toEqual({ success: true, value: null });
    });

    it('应该正确解析对象和数组', () => {
      expect(parseJsonValue('{"a": 1}')).toEqual({ success: true, value: { a: 1 } });
      expect(parseJsonValue('[1, 2, 3]')).toEqual({ success: true, value: [1, 2, 3] });
    });

    it('应该处理空字符串为 null', () => {
      expect(parseJsonValue('')).toEqual({ success: true, value: null });
      expect(parseJsonValue('   ')).toEqual({ success: true, value: null });
    });

    it('应该返回无效 JSON 的错误', () => {
      const result = parseJsonValue('invalid json');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('应该处理带空格的 JSON', () => {
      expect(parseJsonValue('  123  ')).toEqual({ success: true, value: 123 });
    });
  });
});
