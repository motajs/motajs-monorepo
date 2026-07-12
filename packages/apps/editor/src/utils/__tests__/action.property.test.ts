/**
 * applyAction 属性测试
 *
 * 使用 fast-check 进行属性测试，验证 applyAction 的正确性
 *
 * **Feature: tower-data-refactor, Property 1: change/add 操作设置值**
 * **Feature: tower-data-refactor, Property 2: delete 操作删除字段**
 * **Validates: Requirements 5.2, 5.3, 2.3**
 */

import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import {
  applyAction,
  applyActions,
  applyActionsWithInverse,
  type Action,
} from '@/utils/action';
import { buildFieldPath, getByFieldPath } from '@/utils/fieldPath';

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
  '__inverseTemporary',
]);

const validKeyArb = fc
  .string({ minLength: 1, maxLength: 10 })
  .filter((s) => !s.includes("'") && !reservedKeys.has(s));

/**
 * 生成有效的键数组（1-5 层嵌套）
 */
const keysArb = fc.array(validKeyArb, { minLength: 1, maxLength: 5 });

/**
 * 生成任意 JSON 值（非 undefined）
 */
const jsonValueArb = fc.jsonValue();

describe('applyAction 属性测试', () => {
  describe('Property 1: change/add 操作设置值', () => {
    it('change 操作应正确设置指定路径的值', () => {
      fc.assert(
        fc.property(keysArb, jsonValueArb, (keys, value) => {
          const fieldPath = buildFieldPath(keys);
          const obj: Record<string, unknown> = {};

          const action: Action = ['change', fieldPath, value];
          applyAction(obj, action);

          // 验证值被正确设置
          const result = getByFieldPath(obj, fieldPath);
          expect(result).toEqual(value);
        }),
        { numRuns: 100 }
      );
    });

    it('add 操作应正确添加指定路径的值', () => {
      fc.assert(
        fc.property(keysArb, jsonValueArb, (keys, value) => {
          const fieldPath = buildFieldPath(keys);
          const obj: Record<string, unknown> = {};

          const action: Action = ['add', fieldPath, value];
          applyAction(obj, action);

          // 验证值被正确添加
          const result = getByFieldPath(obj, fieldPath);
          expect(result).toEqual(value);
        }),
        { numRuns: 100 }
      );
    });

    it('change 操作应能覆盖已存在的值', () => {
      fc.assert(
        fc.property(keysArb, jsonValueArb, jsonValueArb, (keys, oldValue, newValue) => {
          const fieldPath = buildFieldPath(keys);
          const obj: Record<string, unknown> = {};

          // 先设置旧值
          applyAction(obj, ['add', fieldPath, oldValue]);
          expect(getByFieldPath(obj, fieldPath)).toEqual(oldValue);

          // 用新值覆盖
          applyAction(obj, ['change', fieldPath, newValue]);
          expect(getByFieldPath(obj, fieldPath)).toEqual(newValue);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 2: delete 操作删除字段', () => {
    it('delete 操作应删除指定路径的字段', () => {
      fc.assert(
        fc.property(keysArb, jsonValueArb, (keys, value) => {
          const fieldPath = buildFieldPath(keys);
          const obj: Record<string, unknown> = {};

          // 先添加值
          applyAction(obj, ['add', fieldPath, value]);
          expect(getByFieldPath(obj, fieldPath)).toEqual(value);

          // 删除值
          applyAction(obj, ['delete', fieldPath, undefined]);

          // 验证值已被删除
          const result = getByFieldPath(obj, fieldPath);
          expect(result).toBeUndefined();
        }),
        { numRuns: 100 }
      );
    });

    it('值为 undefined 时应删除字段（无论操作类型）', () => {
      fc.assert(
        fc.property(keysArb, jsonValueArb, (keys, value) => {
          const fieldPath = buildFieldPath(keys);
          const obj: Record<string, unknown> = {};

          // 先添加值
          applyAction(obj, ['add', fieldPath, value]);
          expect(getByFieldPath(obj, fieldPath)).toEqual(value);

          // 使用 change 操作但值为 undefined，应删除字段
          applyAction(obj, ['change', fieldPath, undefined]);

          // 验证值已被删除
          const result = getByFieldPath(obj, fieldPath);
          expect(result).toBeUndefined();
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('applyActions 批量操作', () => {
    it('应按顺序应用多个操作', () => {
      fc.assert(
        fc.property(keysArb, jsonValueArb, jsonValueArb, (keys, value1, value2) => {
          const fieldPath = buildFieldPath(keys);
          const obj: Record<string, unknown> = {};

          const actions: Action[] = [
            ['add', fieldPath, value1],
            ['change', fieldPath, value2],
          ];

          applyActions(obj, actions);

          // 最终值应为 value2
          expect(getByFieldPath(obj, fieldPath)).toEqual(value2);
        }),
        { numRuns: 100 }
      );
    });

    it('生成的 inverse 应恢复批量操作前的数据', () => {
      fc.assert(
        fc.property(keysArb, jsonValueArb, jsonValueArb, (keys, oldValue, newValue) => {
          const fieldPath = buildFieldPath(keys);
          const obj: Record<string, unknown> = {};
          applyAction(obj, ['add', fieldPath, oldValue]);

          const inverse = applyActionsWithInverse(obj, [
            ['change', fieldPath, newValue],
            ['add', "['__inverseTemporary']", { value: 1 }],
          ]);
          applyActions(obj, inverse);

          expect(getByFieldPath(obj, fieldPath)).toEqual(oldValue);
          expect(Object.prototype.hasOwnProperty.call(obj, '__inverseTemporary')).toBe(false);
        }),
        { numRuns: 100 },
      );
    });

    it('撤销深层新增时应移除操作创建的空父对象', () => {
      const obj: Record<string, unknown> = {};
      const inverse = applyActionsWithInverse(obj, [
        ['add', "['autoEvent']['4,4']['2']", { condition: 'true' }],
        ['add', "['autoEvent']['4,4']['3']", { condition: 'false' }],
      ]);

      applyActions(obj, inverse);
      expect(obj).toEqual({});
    });

    it('inverse 应保留 JSON 对象自身的 __proto__ 字段', () => {
      const original = JSON.parse('{"__proto__":null}') as Record<string, unknown>;
      const obj: Record<string, unknown> = { value: original };
      const inverse = applyActionsWithInverse(obj, [
        ['change', "['value']", { changed: true }],
      ]);

      applyActions(obj, inverse);
      expect(obj.value).toEqual(original);
      expect(Object.prototype.hasOwnProperty.call(obj.value, '__proto__')).toBe(true);
    });
  });
});
