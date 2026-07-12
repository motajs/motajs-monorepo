/**
 * 地图尺寸验证属性测试
 *
 * 使用 fast-check 进行属性测试，验证地图尺寸验证的正确性
 *
 * **Feature: floor-panel-migration, Property 4: Dimension Validation**
 * **Validates: Requirements 7.1, 7.2, 7.3**
 */

import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import {
  validateMapDimensions,
  isValidMapDimensions,
  MAX_MAP_DIMENSION,
  type MapDimensions,
} from '@/utils/validation';

/**
 * 生成有效的地图尺寸参数
 */
const validDimensionsArb: fc.Arbitrary<MapDimensions> = fc.record({
  width: fc.integer({ min: 1, max: MAX_MAP_DIMENSION }),
  height: fc.integer({ min: 1, max: MAX_MAP_DIMENSION }),
  offsetX: fc.integer({ min: 0, max: 100 }),
  offsetY: fc.integer({ min: 0, max: 100 }),
});

/**
 * 生成宽度超限的参数
 */
const widthExceedsArb: fc.Arbitrary<MapDimensions> = fc.record({
  width: fc.integer({ min: MAX_MAP_DIMENSION + 1, max: 500 }),
  height: fc.integer({ min: 1, max: MAX_MAP_DIMENSION }),
  offsetX: fc.integer({ min: 0, max: 100 }),
  offsetY: fc.integer({ min: 0, max: 100 }),
});

/**
 * 生成高度超限的参数
 */
const heightExceedsArb: fc.Arbitrary<MapDimensions> = fc.record({
  width: fc.integer({ min: 1, max: MAX_MAP_DIMENSION }),
  height: fc.integer({ min: MAX_MAP_DIMENSION + 1, max: 500 }),
  offsetX: fc.integer({ min: 0, max: 100 }),
  offsetY: fc.integer({ min: 0, max: 100 }),
});

/**
 * 生成偏移量 X 为负数的参数
 */
const negativeOffsetXArb: fc.Arbitrary<MapDimensions> = fc.record({
  width: fc.integer({ min: 1, max: MAX_MAP_DIMENSION }),
  height: fc.integer({ min: 1, max: MAX_MAP_DIMENSION }),
  offsetX: fc.integer({ min: -100, max: -1 }),
  offsetY: fc.integer({ min: 0, max: 100 }),
});

/**
 * 生成偏移量 Y 为负数的参数
 */
const negativeOffsetYArb: fc.Arbitrary<MapDimensions> = fc.record({
  width: fc.integer({ min: 1, max: MAX_MAP_DIMENSION }),
  height: fc.integer({ min: 1, max: MAX_MAP_DIMENSION }),
  offsetX: fc.integer({ min: 0, max: 100 }),
  offsetY: fc.integer({ min: -100, max: -1 }),
});

describe('地图尺寸验证属性测试', () => {
  /**
   * **Feature: floor-panel-migration, Property 4: Dimension Validation**
   * **Validates: Requirements 7.1, 7.2, 7.3**
   *
   * *For any* input dimensions (width, height, offsetX, offsetY):
   * - IF width > 128 OR height > 128, THEN validation SHALL fail
   * - IF offsetX < 0 OR offsetY < 0, THEN validation SHALL fail
   * - IF validation fails, THEN an error message SHALL be displayed and no resize operation SHALL occur
   */
  describe('Property 4: Dimension Validation', () => {
    it('有效的尺寸参数应该通过验证', () => {
      fc.assert(
        fc.property(validDimensionsArb, (dimensions) => {
          const result = validateMapDimensions(dimensions);
          expect(result.valid).toBe(true);
          expect(result.error).toBeUndefined();
          expect(isValidMapDimensions(dimensions)).toBe(true);
        }),
        { numRuns: 100 },
      );
    });

    it('宽度超过 128 应该验证失败', () => {
      fc.assert(
        fc.property(widthExceedsArb, (dimensions) => {
          const result = validateMapDimensions(dimensions);
          expect(result.valid).toBe(false);
          expect(result.error).toContain('宽度');
          expect(isValidMapDimensions(dimensions)).toBe(false);
        }),
        { numRuns: 100 },
      );
    });

    it('高度超过 128 应该验证失败', () => {
      fc.assert(
        fc.property(heightExceedsArb, (dimensions) => {
          const result = validateMapDimensions(dimensions);
          expect(result.valid).toBe(false);
          expect(result.error).toContain('高度');
          expect(isValidMapDimensions(dimensions)).toBe(false);
        }),
        { numRuns: 100 },
      );
    });

    it('偏移量 X 为负数应该验证失败', () => {
      fc.assert(
        fc.property(negativeOffsetXArb, (dimensions) => {
          const result = validateMapDimensions(dimensions);
          expect(result.valid).toBe(false);
          expect(result.error).toContain('偏移量');
          expect(isValidMapDimensions(dimensions)).toBe(false);
        }),
        { numRuns: 100 },
      );
    });

    it('偏移量 Y 为负数应该验证失败', () => {
      fc.assert(
        fc.property(negativeOffsetYArb, (dimensions) => {
          const result = validateMapDimensions(dimensions);
          expect(result.valid).toBe(false);
          expect(result.error).toContain('偏移量');
          expect(isValidMapDimensions(dimensions)).toBe(false);
        }),
        { numRuns: 100 },
      );
    });

    it('边界值 128 应该是有效的', () => {
      const boundaryDimensions: MapDimensions = {
        width: MAX_MAP_DIMENSION,
        height: MAX_MAP_DIMENSION,
        offsetX: 0,
        offsetY: 0,
      };
      expect(isValidMapDimensions(boundaryDimensions)).toBe(true);
    });

    it('边界值 129 应该是无效的', () => {
      const invalidWidth: MapDimensions = {
        width: MAX_MAP_DIMENSION + 1,
        height: MAX_MAP_DIMENSION,
        offsetX: 0,
        offsetY: 0,
      };
      const invalidHeight: MapDimensions = {
        width: MAX_MAP_DIMENSION,
        height: MAX_MAP_DIMENSION + 1,
        offsetX: 0,
        offsetY: 0,
      };
      expect(isValidMapDimensions(invalidWidth)).toBe(false);
      expect(isValidMapDimensions(invalidHeight)).toBe(false);
    });

    it('验证结果应该与原始逻辑一致', () => {
      // 原始逻辑: !(width <= 128 && height <= 128 && x >= 0 && y >= 0)
      const originalValidation = (d: MapDimensions): boolean => {
        return d.width <= 128 && d.height <= 128 && d.offsetX >= 0 && d.offsetY >= 0;
      };

      fc.assert(
        fc.property(
          fc.record({
            width: fc.integer({ min: 1, max: 200 }),
            height: fc.integer({ min: 1, max: 200 }),
            offsetX: fc.integer({ min: -50, max: 50 }),
            offsetY: fc.integer({ min: -50, max: 50 }),
          }),
          (dimensions) => {
            const expected = originalValidation(dimensions);
            const actual = isValidMapDimensions(dimensions);
            expect(actual).toBe(expected);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
