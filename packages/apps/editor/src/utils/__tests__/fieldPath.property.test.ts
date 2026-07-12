/**
 * fieldPath 属性测试
 *
 * 使用 fast-check 进行属性测试，验证 setByFieldPath 和 deleteByFieldPath 的正确性
 *
 * **Feature: tower-data-refactor, Property 3: 嵌套路径支持**
 * **Validates: Requirements 5.4**
 */

import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import {
  buildFieldPath,
  deleteByFieldPath,
  getByFieldPath,
  setByFieldPath,
} from '@/utils/fieldPath';

/**
 * 生成有效的字段路径键（不包含单引号和 JavaScript 保留属性名）
 */
const reservedKeys = new Set([
  'toString',
  'valueOf',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toLocaleString',
  'constructor',
  '__proto__',
  '__defineGetter__',
  '__defineSetter__',
  '__lookupGetter__',
  '__lookupSetter__',
]);

const validKeyArb = fc
  .string({ minLength: 1, maxLength: 10 })
  .filter((s) => !s.includes("'") && !reservedKeys.has(s));

/**
 * 生成有效的键数组（1-5 层嵌套）
 */
const keysArb = fc.array(validKeyArb, { minLength: 1, maxLength: 5 });

/**
 * 生成任意 JSON 值
 */
const jsonValueArb = fc.jsonValue();

describe('fieldPath 属性测试', () => {
  describe('Property 3: 嵌套路径支持', () => {
    it('setByFieldPath 应能正确设置任意深度的嵌套路径', () => {
      fc.assert(
        fc.property(keysArb, jsonValueArb, (keys, value) => {
          const fieldPath = buildFieldPath(keys);
          const obj: Record<string, unknown> = {};

          setByFieldPath(obj, fieldPath, value);

          // 验证值被正确设置
          const result = getByFieldPath(obj, fieldPath);
          expect(result).toEqual(value);
        }),
        { numRuns: 100 }
      );
    });

    it('deleteByFieldPath 应能正确删除任意深度的嵌套路径', () => {
      fc.assert(
        fc.property(keysArb, jsonValueArb, (keys, value) => {
          const fieldPath = buildFieldPath(keys);
          const obj: Record<string, unknown> = {};

          // 先设置值
          setByFieldPath(obj, fieldPath, value);
          expect(getByFieldPath(obj, fieldPath)).toEqual(value);

          // 删除值
          const deleted = deleteByFieldPath(obj, fieldPath);
          expect(deleted).toBe(true);

          // 验证值已被删除
          const result = getByFieldPath(obj, fieldPath);
          expect(result).toBeUndefined();
        }),
        { numRuns: 100 }
      );
    });

    it('setByFieldPath 应自动创建中间对象', () => {
      fc.assert(
        fc.property(keysArb, jsonValueArb, (keys, value) => {
          const fieldPath = buildFieldPath(keys);
          const obj: Record<string, unknown> = {};

          // 在空对象上设置深层嵌套值
          setByFieldPath(obj, fieldPath, value);

          // 验证中间对象被创建
          let current: unknown = obj;
          for (let i = 0; i < keys.length - 1; i++) {
            current = (current as Record<string, unknown>)[keys[i]];
            expect(current).toBeDefined();
            expect(typeof current).toBe('object');
          }

          // 验证最终值正确
          expect(getByFieldPath(obj, fieldPath)).toEqual(value);
        }),
        { numRuns: 100 }
      );
    });

    it('set 后 get 应返回相同的值（往返一致性）', () => {
      fc.assert(
        fc.property(keysArb, jsonValueArb, (keys, value) => {
          const fieldPath = buildFieldPath(keys);
          const obj: Record<string, unknown> = {};

          setByFieldPath(obj, fieldPath, value);
          const retrieved = getByFieldPath(obj, fieldPath);

          expect(retrieved).toEqual(value);
        }),
        { numRuns: 100 }
      );
    });
  });
});
