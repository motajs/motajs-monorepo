/**
 * checkRange 属性测试
 *
 * 使用 fast-check 进行属性测试，验证 checkRange 验证逻辑的正确性
 *
 * **Feature: table-datastore-refactor, Property 1: Unified checkRange Validation**
 * **Feature: table-datastore-refactor, Property 2: Valid Values Are Saved**
 * **Validates: Requirements 3.1, 3.2, 3.3**
 */

import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { checkRange } from '../validation';
import type { FieldConfig } from '../../types';

/**
 * 生成有效的数值范围配置
 * 生成形如 'thiseval >= min && thiseval <= max' 的 _range 表达式
 */
const numericRangeConfigArb = fc.tuple(
  fc.integer({ min: -1000, max: 0 }),
  fc.integer({ min: 1, max: 1000 })
).map(([min, max]): FieldConfig => ({
  _range: `thiseval >= ${min} && thiseval <= ${max}`
}));

/**
 * 生成 _select 配置
 */
const selectConfigArb = fc.array(
  fc.oneof(fc.integer(), fc.string()),
  { minLength: 1, maxLength: 10 }
).map((values): FieldConfig => ({
  _select: { values }
}));

/**
 * 生成无验证规则的配置
 */
const noValidationConfigArb = fc.constant<FieldConfig>({});

describe('checkRange 属性测试', () => {
  describe('Property 1: Unified checkRange Validation', () => {
    it('对于任意 _range 配置，checkRange 返回 false 时值应被拒绝', () => {
      fc.assert(
        fc.property(
          numericRangeConfigArb,
          fc.integer(),
          (config, value) => {
            const result = checkRange(config, value);

            // 解析 _range 表达式中的边界值
            const rangeMatch = config._range?.match(/thiseval >= (-?\d+) && thiseval <= (-?\d+)/);
            if (!rangeMatch) return true; // 跳过无法解析的情况

            const min = parseInt(rangeMatch[1], 10);
            const max = parseInt(rangeMatch[2], 10);

            // 验证：checkRange 结果应与手动验证一致
            const expectedValid = value >= min && value <= max;
            expect(result).toBe(expectedValid);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('对于任意 _select 配置，只有在 values 中的值才应通过验证', () => {
      fc.assert(
        fc.property(
          selectConfigArb,
          fc.oneof(fc.integer(), fc.string()),
          (config, value) => {
            const result = checkRange(config, value);
            const expectedValid = config._select!.values.includes(value);

            expect(result).toBe(expectedValid);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('对于无验证规则的配置，任意值都应通过验证', () => {
      fc.assert(
        fc.property(
          noValidationConfigArb,
          fc.jsonValue(),
          (config, value) => {
            const result = checkRange(config, value);
            expect(result).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('checkRange 验证结果应一致（幂等性）', () => {
      fc.assert(
        fc.property(
          fc.oneof(numericRangeConfigArb, selectConfigArb, noValidationConfigArb),
          fc.jsonValue(),
          (config, value) => {
            // 多次调用 checkRange 应返回相同结果
            const result1 = checkRange(config, value);
            const result2 = checkRange(config, value);
            const result3 = checkRange(config, value);

            expect(result1).toBe(result2);
            expect(result2).toBe(result3);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('无效的 _range 表达式应返回 false', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }).filter(s => !s.includes('thiseval')),
          fc.jsonValue(),
          (invalidRange, value) => {
            const config: FieldConfig = { _range: `{{{${invalidRange}` };
            const result = checkRange(config, value);

            // 无效表达式应返回 false
            expect(result).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});


describe('checkRange 属性测试 - Property 2', () => {
  describe('Property 2: Valid Values Are Saved', () => {
    /**
     * 模拟 handleValueChange 的行为
     * 这是 TableRow 中的核心逻辑：只有通过 checkRange 验证的值才会被保存
     */
    const createValueChangeHandler = (
      config: FieldConfig,
      onValueChange: (value: unknown) => void
    ) => {
      return (newValue: unknown) => {
        if (!checkRange(config, newValue)) {
          return false; // 验证失败，不保存
        }
        onValueChange(newValue);
        return true; // 验证通过，已保存
      };
    };

    it('对于任意通过 _range 验证的值，应调用 onChange 回调', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.integer({ min: -1000, max: 0 }),
            fc.integer({ min: 1, max: 1000 })
          ),
          (bounds) => {
            const [min, max] = bounds;
            const config: FieldConfig = {
              _range: `thiseval >= ${min} && thiseval <= ${max}`
            };

            // 生成一个在范围内的有效值
            const validValue = Math.floor((min + max) / 2);

            let savedValue: unknown = undefined;
            const onValueChange = (value: unknown) => {
              savedValue = value;
            };

            const handleValueChange = createValueChangeHandler(config, onValueChange);
            const result = handleValueChange(validValue);

            // 验证：有效值应被保存
            expect(result).toBe(true);
            expect(savedValue).toBe(validValue);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('对于任意通过 _select 验证的值，应调用 onChange 回调', () => {
      fc.assert(
        fc.property(
          selectConfigArb,
          (config) => {
            // 从 _select.values 中随机选择一个有效值
            const validValue = config._select!.values[0];

            let savedValue: unknown = undefined;
            const onValueChange = (value: unknown) => {
              savedValue = value;
            };

            const handleValueChange = createValueChangeHandler(config, onValueChange);
            const result = handleValueChange(validValue);

            // 验证：有效值应被保存
            expect(result).toBe(true);
            expect(savedValue).toBe(validValue);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('对于无验证规则的配置，任意值都应被保存', () => {
      fc.assert(
        fc.property(
          noValidationConfigArb,
          fc.jsonValue(),
          (config, value) => {
            let savedValue: unknown = undefined;
            const onValueChange = (v: unknown) => {
              savedValue = v;
            };

            const handleValueChange = createValueChangeHandler(config, onValueChange);
            const result = handleValueChange(value);

            // 验证：无验证规则时，任意值都应被保存
            expect(result).toBe(true);
            expect(savedValue).toEqual(value);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('对于未通过验证的值，不应调用 onChange 回调', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.integer({ min: 0, max: 100 }),
            fc.integer({ min: 101, max: 200 })
          ),
          fc.integer({ min: 201, max: 1000 }),
          (bounds, invalidValue) => {
            const [min, max] = bounds;
            const config: FieldConfig = {
              _range: `thiseval >= ${min} && thiseval <= ${max}`
            };

            let onChangeCalled = false;
            const onValueChange = () => {
              onChangeCalled = true;
            };

            const handleValueChange = createValueChangeHandler(config, onValueChange);
            const result = handleValueChange(invalidValue);

            // 验证：无效值不应触发 onChange
            expect(result).toBe(false);
            expect(onChangeCalled).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('checkRange 结果与 onChange 调用应保持一致', () => {
      fc.assert(
        fc.property(
          fc.oneof(numericRangeConfigArb, selectConfigArb, noValidationConfigArb),
          fc.jsonValue(),
          (config, value) => {
            const checkResult = checkRange(config, value);

            let onChangeCalled = false;
            const onValueChange = () => {
              onChangeCalled = true;
            };

            const handleValueChange = createValueChangeHandler(config, onValueChange);
            handleValueChange(value);

            // 核心属性：checkRange 返回 true 时且仅当此时 onChange 被调用
            expect(onChangeCalled).toBe(checkResult);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
