import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { minifyFile, minifyMultiple, minifyAll } from '../minifier.js';
import type { MainConfig, GameData } from '../types.js';

const TEST_DIR = join(process.cwd(), 'tests', '.temp-minifier');

describe('Minifier', () => {
  beforeAll(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterAll(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('minifyFile', () => {
    it('should minify a single JS file', async () => {
      const testFile = join(TEST_DIR, 'test.js');
      const code = `
        function hello(name) {
          console.log("Hello, " + name);
        }
        hello("World");
      `;
      await writeFile(testFile, code, 'utf-8');

      const result = await minifyFile(testFile);

      expect(result).toBeDefined();
      expect(result.length).toBeLessThan(code.length);
      expect(result).toContain('console.log');
    });

    it('should throw error for non-existent file', async () => {
      await expect(minifyFile(join(TEST_DIR, 'nonexistent.js'))).rejects.toThrow();
    });
  });

  describe('minifyMultiple', () => {
    it('should combine and minify multiple JS files', async () => {
      const file1 = join(TEST_DIR, 'file1.js');
      const file2 = join(TEST_DIR, 'file2.js');

      await writeFile(file1, 'var a = 1;', 'utf-8');
      await writeFile(file2, 'var b = 2;', 'utf-8');

      const result = await minifyMultiple([file1, file2]);

      expect(result).toBeDefined();
      expect(result).toContain('1');
      expect(result).toContain('2');
    });

    it('should return empty string for empty file list', async () => {
      const result = await minifyMultiple([]);
      expect(result).toBe('');
    });

    it('should skip non-existent files', async () => {
      const existingFile = join(TEST_DIR, 'existing.js');
      await writeFile(existingFile, 'var x = 42;', 'utf-8');

      const result = await minifyMultiple([existingFile, join(TEST_DIR, 'nonexistent.js')]);

      expect(result).toBeDefined();
      expect(result).toContain('42');
    });
  });

  describe('minifyAll', () => {
    it('should minify all JS files and update main.js', async () => {
      // 创建测试目录结构
      const rootDir = join(TEST_DIR, 'game');
      await mkdir(join(rootDir, 'libs'), { recursive: true });
      await mkdir(join(rootDir, 'project', 'floors'), { recursive: true });

      // 创建测试文件
      await writeFile(join(rootDir, 'main.js'), 'var main = {};', 'utf-8');
      await writeFile(join(rootDir, 'libs', 'core.js'), 'var core = {};', 'utf-8');
      await writeFile(join(rootDir, 'project', 'data.js'), 'var data = {};', 'utf-8');
      await writeFile(join(rootDir, 'project', 'floors', 'MT0.js'), 'var MT0 = {};', 'utf-8');

      const mainConfig: MainConfig = {
        loadList: ['core'],
        pureData: ['data'],
        materials: [],
        enableSplitChunks: false,
        skipResourcePackage: false,
      };

      const gameData: GameData = {
        floorIds: ['MT0'],
        images: [],
        tilesets: [],
        animates: [],
        sounds: [],
        bgms: [],
        name: 'Test Game',
      };

      const result = await minifyAll(rootDir, mainConfig, gameData);

      expect(result.libsContent).toBeDefined();
      expect(result.projectContent).toBeDefined();
      expect(result.floorsContent).toBeDefined();

      // 验证 main.js 被更新
      const { readFile } = await import('node:fs/promises');
      const mainJsContent = await readFile(join(rootDir, 'main.js'), 'utf-8');
      expect(mainJsContent).toContain('main.useCompress = true');
      expect(mainJsContent).toContain('main.version');
    });
  });
});
