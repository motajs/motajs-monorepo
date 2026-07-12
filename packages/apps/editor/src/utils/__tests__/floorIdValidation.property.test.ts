/**
 * FloorId 验证属性测试
 *
 * 使用 fast-check 进行属性测试，验证 floorId 格式验证的正确性
 *
 * **Feature: floor-panel-migration, Property 3: FloorId Validation**
 * **Validates: Requirements 6.1, 6.2, 6.3**
 */

import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { isValidFloorId } from '@/utils/string';
import { jsIdentifierArb } from '@test/arbitraries';

/** 有效的后续字符：字母、数字、下划线 */
const validRestChars = [
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
  'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '_',
] as const;

/** 有效的首字符：字母、下划线 */
const validFirstChars = [
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
  'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '_',
] as const;

/**
 * 生成以数字开头的字符串（无效的 floorId）
 */
const digitStartStringArb = fc
  .tuple(
    fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
    fc.array(fc.constantFrom(...validRestChars), { minLength: 0, maxLength: 10 }),
  )
  .map(([first, rest]) => first + rest.join(''));

/**
 * 生成包含非法字符的字符串（无效的 floorId）
 */
const invalidCharStringArb = fc
  .tuple(
    // 有效的开头
    fc.constantFrom(...validFirstChars),
    // 非法字符
    fc.constantFrom('-', '.', ' ', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '+', '='),
    // 后续字符
    fc.array(fc.constantFrom(...validRestChars), { minLength: 0, maxLength: 5 }),
  )
  .map(([first, invalid, rest]) => first + invalid + rest.join(''));

/**
 * 生成有效的 floorId（符合 /^[a-zA-Z_][a-zA-Z0-9_]*$/ 格式）
 */
const validFloorIdArb = fc
  .tuple(
    // 首字符：字母或下划线
    fc.constantFrom(...validFirstChars),
    // 后续字符：字母、数字或下划线
    fc.array(fc.constantFrom(...validRestChars), { minLength: 0, maxLength: 15 }),
  )
  .map(([first, rest]) => first + rest.join(''));

describe('FloorId 验证属性测试', () => {
  /**
   * **Feature: floor-panel-migration, Property 3: FloorId Validation**
   * **Validates: Requirements 6.1, 6.2, 6.3**
   *
   * *For any* input string as new floorId:
   * - IF the string does NOT match `/^[a-zA-Z_][a-zA-Z0-9_]*$/`, THEN validation SHALL fail
   * - IF the string already exists in `main.floorIds`, THEN validation SHALL fail
   * - IF validation fails, THEN an error message SHALL be displayed and no save operation SHALL occur
   */
  describe('Property 3: FloorId Validation', () => {
    it('有效的 floorId 应该通过验证', () => {
      fc.assert(
        fc.property(validFloorIdArb, (floorId) => {
          expect(isValidFloorId(floorId)).toBe(true);
        }),
        { numRuns: 100 },
      );
    });

    it('以数字开头的字符串应该验证失败', () => {
      fc.assert(
        fc.property(digitStartStringArb, (floorId) => {
          expect(isValidFloorId(floorId)).toBe(false);
        }),
        { numRuns: 100 },
      );
    });

    it('包含非法字符的字符串应该验证失败', () => {
      fc.assert(
        fc.property(invalidCharStringArb, (floorId) => {
          expect(isValidFloorId(floorId)).toBe(false);
        }),
        { numRuns: 100 },
      );
    });

    it('空字符串应该验证失败', () => {
      expect(isValidFloorId('')).toBe(false);
    });

    it('jsIdentifierArb 生成的标识符应该是有效的 floorId', () => {
      // jsIdentifierArb 生成的是小写字母和下划线开头的标识符
      // 这些都应该是有效的 floorId
      fc.assert(
        fc.property(jsIdentifierArb({ minLength: 1, maxLength: 15 }), (floorId) => {
          expect(isValidFloorId(floorId)).toBe(true);
        }),
        { numRuns: 100 },
      );
    });

    it('验证结果应该与正则表达式匹配一致', () => {
      const pattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

      fc.assert(
        fc.property(fc.string({ minLength: 0, maxLength: 20 }), (str) => {
          const expected = pattern.test(str);
          const actual = isValidFloorId(str);
          expect(actual).toBe(expected);
        }),
        { numRuns: 100 },
      );
    });
  });
});
