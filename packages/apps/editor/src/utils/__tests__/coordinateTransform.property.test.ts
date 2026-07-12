/**
 * 坐标转换属性测试
 *
 * 使用 fast-check 进行属性测试，验证坐标转换的正确性
 *
 * **Feature: floor-panel-migration, Property 5: Coordinate Transformation**
 * **Validates: Requirements 7.4, 7.5, 7.6**
 */

import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import {
  transformCoordField,
  transformCoordPoint,
  isCoordInBounds,
  parseCoordString,
  formatCoordString,
  type CoordFieldData,
} from '@/utils/coordinate/transform';

/**
 * 生成有效的坐标（在指定范围内）
 */
const coordArb = (maxX: number, maxY: number) =>
  fc.tuple(
    fc.integer({ min: 0, max: maxX - 1 }),
    fc.integer({ min: 0, max: maxY - 1 }),
  );

/**
 * 生成坐标字段数据
 */
const coordFieldDataArb = (maxX: number, maxY: number): fc.Arbitrary<CoordFieldData> =>
  fc.array(
    fc.tuple(
      coordArb(maxX, maxY),
      fc.record({ type: fc.string({ minLength: 1, maxLength: 10 }) }),
    ),
    { minLength: 0, maxLength: 10 },
  ).map((entries) => {
    const result: CoordFieldData = {};
    for (const [[x, y], value] of entries) {
      result[`${x},${y}`] = value;
    }
    return result;
  });

/**
 * 生成地图尺寸参数
 */
const dimensionsArb = fc.record({
  oldWidth: fc.integer({ min: 5, max: 50 }),
  oldHeight: fc.integer({ min: 5, max: 50 }),
  newWidth: fc.integer({ min: 5, max: 50 }),
  newHeight: fc.integer({ min: 5, max: 50 }),
  offsetX: fc.integer({ min: -10, max: 10 }),
  offsetY: fc.integer({ min: -10, max: 10 }),
});

describe('坐标转换属性测试', () => {
  /**
   * **Feature: floor-panel-migration, Property 5: Coordinate Transformation**
   * **Validates: Requirements 7.4, 7.5, 7.6**
   *
   * *For any* floor resize operation with offset (x, y) and new dimensions (newWidth, newHeight):
   * - *For any* coordinate-based field:
   *   - *For any* original coordinate `(ox, oy)` with value `v`:
   *     - The new coordinate SHALL be `(ox + x, oy + y)`
   *     - IF new coordinate is within bounds `[0, newWidth) × [0, newHeight)`, THEN the value SHALL be preserved
   *     - IF new coordinate is out of bounds, THEN the entry SHALL be removed
   * - *For any* upFloor/downFloor coordinate `[ox, oy]`:
   *   - The new coordinate SHALL be `[ox + x, oy + y]`
   */
  describe('Property 5: Coordinate Transformation', () => {
    it('坐标转换应该正确应用偏移量', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }),
          fc.integer({ min: 0, max: 100 }),
          fc.integer({ min: -50, max: 50 }),
          fc.integer({ min: -50, max: 50 }),
          (ox, oy, offsetX, offsetY) => {
            const result = transformCoordPoint([ox, oy], offsetX, offsetY);
            expect(result[0]).toBe(ox + offsetX);
            expect(result[1]).toBe(oy + offsetY);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('边界内的坐标应该被保留', () => {
      fc.assert(
        fc.property(dimensionsArb, (dims) => {
          const { oldWidth, oldHeight, newWidth, newHeight, offsetX, offsetY } = dims;

          // 生成在旧地图范围内的坐标数据
          const data = fc.sample(coordFieldDataArb(oldWidth, oldHeight), 1)[0];

          const result = transformCoordField(data, offsetX, offsetY, newWidth, newHeight);

          // 验证所有保留的坐标都在新边界内
          for (const coordStr in result) {
            const [nx, ny] = coordStr.split(',').map(Number);
            expect(isCoordInBounds(nx, ny, newWidth, newHeight)).toBe(true);
          }
        }),
        { numRuns: 100 },
      );
    });

    it('边界外的坐标应该被移除', () => {
      fc.assert(
        fc.property(dimensionsArb, (dims) => {
          const { oldWidth, oldHeight, newWidth, newHeight, offsetX, offsetY } = dims;

          // 生成在旧地图范围内的坐标数据
          const data = fc.sample(coordFieldDataArb(oldWidth, oldHeight), 1)[0];

          const result = transformCoordField(data, offsetX, offsetY, newWidth, newHeight);

          // 验证原始数据中的每个坐标
          for (const coordStr in data) {
            const [ox, oy] = coordStr.split(',').map(Number);
            const nx = ox + offsetX;
            const ny = oy + offsetY;
            const newCoordStr = `${nx},${ny}`;

            if (isCoordInBounds(nx, ny, newWidth, newHeight)) {
              // 边界内的坐标应该被保留
              expect(result[newCoordStr]).toEqual(data[coordStr]);
            } else {
              // 边界外的坐标应该被移除
              expect(result[newCoordStr]).toBeUndefined();
            }
          }
        }),
        { numRuns: 100 },
      );
    });

    it('转换后的值应该与原始值相等', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 5, max: 20 }),
          fc.integer({ min: 5, max: 20 }),
          fc.integer({ min: 0, max: 5 }),
          fc.integer({ min: 0, max: 5 }),
          (newWidth, newHeight, offsetX, offsetY) => {
            // 创建一些测试数据
            const data: CoordFieldData = {
              '0,0': { type: 'event', id: 1 },
              '1,1': { type: 'npc', name: 'test' },
              '2,2': { type: 'item', count: 5 },
            };

            const result = transformCoordField(data, offsetX, offsetY, newWidth, newHeight);

            // 验证保留的值与原始值相等
            for (const origCoord in data) {
              const [ox, oy] = origCoord.split(',').map(Number);
              const nx = ox + offsetX;
              const ny = oy + offsetY;
              const newCoord = `${nx},${ny}`;

              if (isCoordInBounds(nx, ny, newWidth, newHeight)) {
                expect(result[newCoord]).toEqual(data[origCoord]);
              }
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('upFloor/downFloor 坐标应该正确转换', () => {
      fc.assert(
        fc.property(
          fc.tuple(fc.integer({ min: 0, max: 100 }), fc.integer({ min: 0, max: 100 })),
          fc.integer({ min: -50, max: 50 }),
          fc.integer({ min: -50, max: 50 }),
          (coord, offsetX, offsetY) => {
            const result = transformCoordPoint(coord as [number, number], offsetX, offsetY);
            expect(result[0]).toBe(coord[0] + offsetX);
            expect(result[1]).toBe(coord[1] + offsetY);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('坐标字符串解析和格式化应该是往返一致的', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1000 }),
          fc.integer({ min: 0, max: 1000 }),
          (x, y) => {
            const str = formatCoordString(x, y);
            const parsed = parseCoordString(str);
            expect(parsed).toEqual([x, y]);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('空数据应该返回空结果', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: -50, max: 50 }),
          fc.integer({ min: -50, max: 50 }),
          (newWidth, newHeight, offsetX, offsetY) => {
            const result = transformCoordField({}, offsetX, offsetY, newWidth, newHeight);
            expect(Object.keys(result).length).toBe(0);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('转换后的坐标数量应该小于等于原始数量', () => {
      fc.assert(
        fc.property(dimensionsArb, (dims) => {
          const { oldWidth, oldHeight, newWidth, newHeight, offsetX, offsetY } = dims;

          // 生成在旧地图范围内的坐标数据
          const data = fc.sample(coordFieldDataArb(oldWidth, oldHeight), 1)[0];

          const result = transformCoordField(data, offsetX, offsetY, newWidth, newHeight);

          // 转换后的坐标数量应该小于等于原始数量（因为可能有坐标被过滤掉）
          expect(Object.keys(result).length).toBeLessThanOrEqual(Object.keys(data).length);
        }),
        { numRuns: 100 },
      );
    });
  });
});
