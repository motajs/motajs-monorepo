import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { packResources, packWithChunks, packAll, writeSplitChunkMap } from "../resourcePacker.js";
import { listZipFiles } from "../utils/zip-utils.js";
import type { MainConfig, GameData, IconsData } from "../types.js";

describe("ResourcePacker", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `resourcePacker-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe("packResources", () => {
    it("should pack files into a single .h5data file", async () => {
      // Create test files
      await writeFile(join(testDir, "file1.txt"), "content1");
      await writeFile(join(testDir, "file2.txt"), "content2");

      const result = await packResources({
        sourceDir: testDir,
        files: ["file1.txt", "file2.txt"],
        outputName: "test",
      });

      expect(result.outputFiles).toHaveLength(1);
      expect(result.outputFiles[0]).toContain("test.h5data");
      expect(result.totalFiles).toBe(2);
      expect(result.totalSize).toBeGreaterThan(0);

      // Verify ZIP contents
      const zipFiles = await listZipFiles(result.outputFiles[0]);
      expect(zipFiles).toContain("file1.txt");
      expect(zipFiles).toContain("file2.txt");
    });

    it("should use .zip extension when specified", async () => {
      await writeFile(join(testDir, "file1.txt"), "content1");

      const result = await packResources({
        sourceDir: testDir,
        files: ["file1.txt"],
        outputName: "test",
        extension: ".zip",
      });

      expect(result.outputFiles[0]).toContain("test.zip");
    });

    it("should skip non-existent files", async () => {
      await writeFile(join(testDir, "file1.txt"), "content1");

      const result = await packResources({
        sourceDir: testDir,
        files: ["file1.txt", "nonexistent.txt"],
        outputName: "test",
      });

      expect(result.totalFiles).toBe(1);
    });

    it("should return empty result for empty file list", async () => {
      const result = await packResources({
        sourceDir: testDir,
        files: [],
        outputName: "test",
      });

      expect(result.outputFiles).toHaveLength(0);
      expect(result.totalFiles).toBe(0);
    });
  });

  describe("packWithChunks", () => {
    it("should pack into single file when under threshold", async () => {
      await writeFile(join(testDir, "file1.txt"), "small content");

      const result = await packWithChunks({
        sourceDir: testDir,
        files: ["file1.txt"],
        outputName: "test",
        chunkThreshold: 1024 * 1024, // 1MB
      });

      expect(result.outputFiles).toHaveLength(1);
      expect(result.outputFiles[0]).toContain("test.h5data");
    });

    it("should split into chunks when exceeding threshold", async () => {
      // Create files that exceed the threshold
      const largeContent = "x".repeat(1000);
      await writeFile(join(testDir, "file1.txt"), largeContent);
      await writeFile(join(testDir, "file2.txt"), largeContent);
      await writeFile(join(testDir, "file3.txt"), largeContent);

      const result = await packWithChunks({
        sourceDir: testDir,
        files: ["file1.txt", "file2.txt", "file3.txt"],
        outputName: "test",
        chunkThreshold: 1500, // Small threshold to force splitting
      });

      expect(result.outputFiles.length).toBeGreaterThan(1);
      expect(result.outputFiles[0]).toContain("test-0.h5data");
      expect(result.totalFiles).toBe(3);
    });

    it("should use correct naming for chunks", async () => {
      const content = "x".repeat(500);
      await writeFile(join(testDir, "file1.txt"), content);
      await writeFile(join(testDir, "file2.txt"), content);

      const result = await packWithChunks({
        sourceDir: testDir,
        files: ["file1.txt", "file2.txt"],
        outputName: "images",
        chunkThreshold: 400,
      });

      expect(result.outputFiles.some((f) => f.includes("images-0.h5data"))).toBe(true);
      expect(result.outputFiles.some((f) => f.includes("images-1.h5data"))).toBe(true);
    });
  });

  describe("packAll", () => {
    let projectDir: string;

    beforeEach(async () => {
      projectDir = join(testDir, "project");
      await mkdir(join(projectDir, "images"), { recursive: true });
      await mkdir(join(projectDir, "sounds"), { recursive: true });
      await mkdir(join(projectDir, "bgms"), { recursive: true });
      await mkdir(join(projectDir, "materials"), { recursive: true });
      await mkdir(join(projectDir, "tilesets"), { recursive: true });
      await mkdir(join(projectDir, "autotiles"), { recursive: true });
      await mkdir(join(projectDir, "animates"), { recursive: true });
      await mkdir(join(testDir, "libs"), { recursive: true });
    });

    it("should skip packing when skipResourcePackage is true", async () => {
      const mainConfig: MainConfig = {
        loadList: [],
        pureData: [],
        materials: [],
        enableSplitChunks: false,
        skipResourcePackage: true,
      };

      const gameData: GameData = {
        floorIds: [],
        images: ["test"],
        tilesets: [],
        animates: [],
        sounds: [],
        bgms: [],
        name: "Test",
      };

      const iconsData: IconsData = { autotiles: [] };

      const result = await packAll(testDir, mainConfig, gameData, iconsData);
      expect(result).toEqual({});
    });

    it("should pack images into images.h5data", async () => {
      // Create test image
      await writeFile(join(projectDir, "images", "test.png"), Buffer.from([0x89, 0x50, 0x4E, 0x47]));

      const mainConfig: MainConfig = {
        loadList: [],
        pureData: [],
        materials: [],
        enableSplitChunks: false,
        skipResourcePackage: false,
      };

      const gameData: GameData = {
        floorIds: [],
        images: ["test"],
        tilesets: [],
        animates: [],
        sounds: [],
        bgms: [],
        name: "Test",
      };

      const iconsData: IconsData = { autotiles: [] };

      await packAll(testDir, mainConfig, gameData, iconsData, { compressImages: false });

      // Check that images.h5data was created
      const imagesPath = join(projectDir, "images", "images.h5data");
      const zipFiles = await listZipFiles(imagesPath);
      expect(zipFiles).toContain("test.png");
    });
  });

  describe("writeSplitChunkMap", () => {
    it("should append splitChunkMap to main.js", async () => {
      await writeFile(join(testDir, "main.js"), "var main = {};");

      const splitChunkMap = {
        images: ["images-0.h5data", "images-1.h5data"],
      };

      await writeSplitChunkMap(testDir, splitChunkMap);

      const content = await readFile(join(testDir, "main.js"), "utf-8");
      expect(content).toContain("main.splitChunkMap");
      expect(content).toContain("images-0.h5data");
    });

    it("should not modify main.js when splitChunkMap is empty", async () => {
      const originalContent = "var main = {};";
      await writeFile(join(testDir, "main.js"), originalContent);

      await writeSplitChunkMap(testDir, {});

      const content = await readFile(join(testDir, "main.js"), "utf-8");
      expect(content).toBe(originalContent);
    });
  });
});
