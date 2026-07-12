import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import {
  extractUsedTileIds,
  getTilesetIdRange,
  filterTilesetIds,
  getTileRow,
  calculateUsedRows,
  optimizeTileset,
} from "../tilesetOptimizer.js";
import { getImageSize } from "../utils/image-utils.js";
import sharp from "sharp";

const TEST_DIR = join(process.cwd(), "tests", ".temp-tileset");

describe("TilesetOptimizer", () => {
  beforeAll(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterAll(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  describe("extractUsedTileIds", () => {
    it("should extract 5+ digit numbers from content", () => {
      const content = "var map = [10001, 10002, 20005, 123, 9999, 100000];";
      const result = extractUsedTileIds(content);

      expect(result.has(10001)).toBe(true);
      expect(result.has(10002)).toBe(true);
      expect(result.has(20005)).toBe(true);
      expect(result.has(100000)).toBe(true);
      // 4 位数字不应被提取
      expect(result.has(123)).toBe(false);
      expect(result.has(9999)).toBe(false);
    });

    it("should return empty set for content without 5+ digit numbers", () => {
      const content = "var x = 1; var y = 999; var z = 1234;";
      const result = extractUsedTileIds(content);

      expect(result.size).toBe(0);
    });

    it("should handle minified JS content", () => {
      const content = "var a={map:[10001,10002],events:{10003:\"test\"}};";
      const result = extractUsedTileIds(content);

      expect(result.has(10001)).toBe(true);
      expect(result.has(10002)).toBe(true);
      expect(result.has(10003)).toBe(true);
    });
  });

  describe("getTilesetIdRange", () => {
    it("should return correct range for tileset index 0", () => {
      const [start, end] = getTilesetIdRange(0);
      expect(start).toBe(10000);
      expect(end).toBe(20000);
    });

    it("should return correct range for tileset index 1", () => {
      const [start, end] = getTilesetIdRange(1);
      expect(start).toBe(20000);
      expect(end).toBe(30000);
    });
  });

  describe("filterTilesetIds", () => {
    it("should filter IDs belonging to specific tileset", () => {
      const allIds = new Set([10001, 10005, 20003, 30001]);

      const tileset0Ids = filterTilesetIds(allIds, 0);
      expect(tileset0Ids).toEqual([1, 5]);

      const tileset1Ids = filterTilesetIds(allIds, 1);
      expect(tileset1Ids).toEqual([3]);

      const tileset2Ids = filterTilesetIds(allIds, 2);
      expect(tileset2Ids).toEqual([1]);
    });

    it("should return empty array for tileset with no used IDs", () => {
      const allIds = new Set([10001, 10002]);
      const result = filterTilesetIds(allIds, 5);
      expect(result).toEqual([]);
    });
  });

  describe("getTileRow", () => {
    it("should calculate correct row for tile ID", () => {
      // 假设每行 8 个 tile
      expect(getTileRow(0, 8)).toBe(0);
      expect(getTileRow(7, 8)).toBe(0);
      expect(getTileRow(8, 8)).toBe(1);
      expect(getTileRow(15, 8)).toBe(1);
      expect(getTileRow(16, 8)).toBe(2);
    });
  });

  describe("calculateUsedRows", () => {
    it("should calculate used rows from tile IDs", () => {
      // 每行 8 个 tile
      const tileIds = [0, 1, 8, 16, 17];
      const result = calculateUsedRows(tileIds, 8, 10);

      expect(result).toEqual([0, 1, 2]);
    });

    it("should ignore rows beyond total rows", () => {
      const tileIds = [0, 80]; // 80 / 8 = 10, 超出总行数
      const result = calculateUsedRows(tileIds, 8, 5);

      expect(result).toEqual([0]);
    });
  });

  describe("optimizeTileset", () => {
    it("should replace tileset with transparent image when no tiles used", async () => {
      // 创建一个 64x64 的测试图片（2x2 tiles）
      const testPath = join(TEST_DIR, "unused-tileset.png");
      await sharp({
        create: {
          width: 64,
          height: 64,
          channels: 4,
          background: { r: 255, g: 0, b: 0, alpha: 255 },
        },
      })
        .png()
        .toFile(testPath);

      // 没有使用任何 tile
      const usedIds = new Set<number>();
      const optimized = await optimizeTileset(testPath, usedIds, 0);

      expect(optimized).toBe(true);

      // 验证图片被替换为 32x32 透明图
      const { width, height } = await getImageSize(testPath);
      expect(width).toBe(32);
      expect(height).toBe(32);
    });

    it("should crop tileset to keep only used rows", async () => {
      // 创建一个 64x128 的测试图片（2x4 tiles，每行 2 个）
      const testPath = join(TEST_DIR, "partial-tileset.png");
      await sharp({
        create: {
          width: 64,
          height: 128,
          channels: 4,
          background: { r: 0, g: 255, b: 0, alpha: 255 },
        },
      })
        .png()
        .toFile(testPath);

      // 只使用第一行的 tile（ID 0 和 1 对应 tileset 0 的 10000 和 10001）
      const usedIds = new Set([10000, 10001]);
      const optimized = await optimizeTileset(testPath, usedIds, 0);

      expect(optimized).toBe(true);

      // 验证图片高度被裁剪（只保留第一行）
      const { width, height } = await getImageSize(testPath);
      expect(width).toBe(64);
      expect(height).toBe(32); // 只保留一行
    });

    it("should not optimize when all rows are used", async () => {
      // 创建一个 64x64 的测试图片（2x2 tiles）
      const testPath = join(TEST_DIR, "full-tileset.png");
      await sharp({
        create: {
          width: 64,
          height: 64,
          channels: 4,
          background: { r: 0, g: 0, b: 255, alpha: 255 },
        },
      })
        .png()
        .toFile(testPath);

      // 使用所有 tile（每行 2 个，共 2 行 = 4 个 tile）
      const usedIds = new Set([10000, 10001, 10002, 10003]);
      const optimized = await optimizeTileset(testPath, usedIds, 0);

      expect(optimized).toBe(false);

      // 验证图片尺寸不变
      const { width, height } = await getImageSize(testPath);
      expect(width).toBe(64);
      expect(height).toBe(64);
    });
  });
});
