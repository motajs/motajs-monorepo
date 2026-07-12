/**
 * fieldPath 单元测试
 *
 * 测试字段路径解析和操作工具函数
 */

import { describe, expect, it } from 'vitest';
import {
  parseFieldPath,
  getShortField,
  buildFieldPath,
  getParentField,
  fieldToDataAttr,
} from '@/utils/fieldPath';

describe('fieldPath', () => {
  describe('parseFieldPath', () => {
    it('应该正确解析标准字段路径', () => {
      expect(parseFieldPath("['main']['floorIds']")).toEqual(['main', 'floorIds']);
    });

    it('应该正确解析单层路径', () => {
      expect(parseFieldPath("['single']")).toEqual(['single']);
    });

    it('应该正确解析多层嵌套路径', () => {
      expect(parseFieldPath("['a']['b']['c']['d']")).toEqual(['a', 'b', 'c', 'd']);
    });

    it('应该处理空字符串', () => {
      expect(parseFieldPath('')).toEqual([]);
    });

    it('应该处理 null/undefined', () => {
      expect(parseFieldPath(null as unknown as string)).toEqual([]);
      expect(parseFieldPath(undefined as unknown as string)).toEqual([]);
    });

    it('应该处理包含数字的键', () => {
      expect(parseFieldPath("['item1']['value2']")).toEqual(['item1', 'value2']);
    });

    it('应该处理包含下划线的键', () => {
      expect(parseFieldPath("['_data']['_type']")).toEqual(['_data', '_type']);
    });
  });

  describe('getShortField', () => {
    it('应该获取最后一个字段名', () => {
      expect(getShortField("['main']['floorIds']")).toBe('floorIds');
    });

    it('应该处理单层路径', () => {
      expect(getShortField("['single']")).toBe('single');
    });

    it('应该处理多层嵌套路径', () => {
      expect(getShortField("['a']['b']['c']['d']")).toBe('d');
    });

    it('应该处理空字符串', () => {
      expect(getShortField('')).toBe('');
    });

    it('应该处理 null/undefined', () => {
      expect(getShortField(null as unknown as string)).toBe('');
      expect(getShortField(undefined as unknown as string)).toBe('');
    });
  });

  describe('buildFieldPath', () => {
    it('应该从数组构建字段路径', () => {
      expect(buildFieldPath(['main', 'floorIds'])).toBe("['main']['floorIds']");
    });

    it('应该处理单个键', () => {
      expect(buildFieldPath(['single'])).toBe("['single']");
    });

    it('应该处理空数组', () => {
      expect(buildFieldPath([])).toBe('');
    });

    it('应该处理 null/undefined', () => {
      expect(buildFieldPath(null as unknown as string[])).toBe('');
      expect(buildFieldPath(undefined as unknown as string[])).toBe('');
    });
  });

  describe('getParentField', () => {
    it('应该获取父级路径', () => {
      expect(getParentField("['main']['floorIds']")).toBe("['main']");
    });

    it('应该处理多层嵌套', () => {
      expect(getParentField("['a']['b']['c']")).toBe("['a']['b']");
    });

    it('应该处理单层路径返回空', () => {
      expect(getParentField("['single']")).toBe('');
    });

    it('应该处理空字符串', () => {
      expect(getParentField('')).toBe('');
    });
  });

  describe('fieldToDataAttr', () => {
    it('应该转换为连字符格式', () => {
      expect(fieldToDataAttr("['main']['floorIds']")).toBe('main-floorIds');
    });

    it('应该处理单层路径', () => {
      expect(fieldToDataAttr("['single']")).toBe('single');
    });

    it('应该处理多层嵌套', () => {
      expect(fieldToDataAttr("['a']['b']['c']")).toBe('a-b-c');
    });

    it('应该处理空字符串', () => {
      expect(fieldToDataAttr('')).toBe('');
    });
  });

  describe('parseFieldPath 和 buildFieldPath 往返一致性', () => {
    it('解析后再构建应该得到原始路径', () => {
      const original = "['main']['floorIds']";
      const parsed = parseFieldPath(original);
      const rebuilt = buildFieldPath(parsed);
      expect(rebuilt).toBe(original);
    });

    it('多层嵌套往返一致', () => {
      const original = "['a']['b']['c']['d']";
      const parsed = parseFieldPath(original);
      const rebuilt = buildFieldPath(parsed);
      expect(rebuilt).toBe(original);
    });
  });
});
