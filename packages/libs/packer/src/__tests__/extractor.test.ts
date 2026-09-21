import { describe, it, expect, afterEach } from 'vitest';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { extract, findRootDir } from '../extractor.js';

describe('Extractor', () => {
  const sampleZip = join(process.cwd(), 'sample', '51.zip');
  let tempDirToClean: string | null = null;

  afterEach(async () => {
    // 清理测试产生的临时目录
    if (tempDirToClean && existsSync(tempDirToClean)) {
      await rm(tempDirToClean, { recursive: true, force: true });
      tempDirToClean = null;
    }
  });

  describe('extract', () => {
    it('should extract a valid ZIP file and find root directory', async () => {
      const result = await extract(sampleZip);
      tempDirToClean = result.tempDir;

      expect(result.tempDir).toBeTruthy();
      expect(result.rootDir).toBeTruthy();
      expect(existsSync(result.tempDir)).toBe(true);
      expect(existsSync(result.rootDir)).toBe(true);
      expect(existsSync(join(result.rootDir, 'main.js'))).toBe(true);
    });

    it('should throw error for non-existent file', async () => {
      await expect(extract('/non/existent/file.zip')).rejects.toThrow('压缩文件不存在');
    });

    it('should throw error for invalid ZIP file', async () => {
      // 使用一个非 ZIP 文件测试
      const invalidPath = join(process.cwd(), 'package.json');
      await expect(extract(invalidPath)).rejects.toThrow(/不是有效的 ZIP 文件|ZIP 文件已损坏/);
    });
  });

  describe('findRootDir', () => {
    it('should find root directory containing main.js', async () => {
      // 先解压获取临时目录
      const result = await extract(sampleZip);
      tempDirToClean = result.tempDir;

      // 测试 findRootDir
      const rootDir = await findRootDir(result.tempDir);
      expect(rootDir).toBe(result.rootDir);
      expect(existsSync(join(rootDir, 'main.js'))).toBe(true);
    });

    it('should throw error when main.js not found', async () => {
      // 使用一个不包含 main.js 的目录（dist 目录通常不包含 main.js）
      const emptyDir = join(process.cwd(), 'dist');
      await expect(findRootDir(emptyDir)).rejects.toThrow('找不到游戏根目录');
    });
  });
});
