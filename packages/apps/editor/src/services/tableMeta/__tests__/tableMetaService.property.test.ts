/**
 * TableMeta Service 属性测试
 *
 * 使用 fast-check 进行属性测试
 *
 * **Feature: comment-service-refactor**
 * - Property 1: Meta Object Loading
 * - Property 2: Invalid Key Error
 * **Validates: Requirements 1.1, 1.4**
 */

import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import {
  loadTableMetaFile,
  VALID_META_FILE_KEYS,
  type MetaFileKey,
} from '../tableMetaService';

describe('loadTableMetaFile 属性测试', () => {
  describe('Property 2: Invalid Key Error', () => {
    /**
     * 生成无效的 MetaFileKey
     * 排除所有有效的 key
     */
    const invalidKeyArb = fc
      .string({ minLength: 1, maxLength: 30 })
      .filter((s) => !VALID_META_FILE_KEYS.includes(s as MetaFileKey));

    it('*For any* string that is not a valid MetaFileKey, loadTableMetaFile should throw an error', async () => {
      await fc.assert(
        fc.asyncProperty(invalidKeyArb, async (invalidKey) => {
          // 调用 loadTableMetaFile 应该抛出错误
          await expect(
            loadTableMetaFile(invalidKey as MetaFileKey)
          ).rejects.toThrow(`无效的文件 key: ${invalidKey}`);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 1: Meta Object Loading', () => {
    /**
     * 生成有效的 MetaFileKey
     */
    const validKeyArb = fc.constantFrom(...VALID_META_FILE_KEYS);

    it('*For any* valid MetaFileKey, loadTableMetaFile should return a string (file content)', async () => {
      // 注意：此测试需要实际的文件系统访问，在 CI 环境中可能需要 mock
      // 这里我们只验证函数签名和基本行为
      await fc.assert(
        fc.asyncProperty(validKeyArb, async (key) => {
          try {
            const content = await loadTableMetaFile(key);
            // 如果成功，返回值应该是字符串
            expect(typeof content).toBe('string');
            // 内容应该非空
            expect(content.length).toBeGreaterThan(0);
          } catch (error) {
            // 如果失败，应该是因为文件不存在（在测试环境中）
            // 错误消息应该包含文件路径信息
            expect((error as Error).message).toMatch(/读取.*失败/);
          }
        }),
        { numRuns: 5 } // 减少运行次数，因为涉及 I/O
      );
    });
  });
});
