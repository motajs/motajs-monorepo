import { describe, it, expect, afterEach } from "vitest";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { extract } from "../extractor.js";
import {
  parseMainJs2X,
  parseDataJs2X,
  parseIconsJs2X,
  parseMainJs,
  parseDataJs,
  parseIconsJs,
} from "../parser.js";

describe("Parser", () => {
  const sampleZip = join(process.cwd(), "sample", "51.zip");
  let tempDirToClean: string | null = null;
  let rootDir: string | null = null;

  afterEach(async () => {
    if (tempDirToClean && existsSync(tempDirToClean)) {
      await rm(tempDirToClean, { recursive: true, force: true });
      tempDirToClean = null;
      rootDir = null;
    }
  });

  describe("parseMainJs2X", () => {
    it("should extract loadList from main.js content", () => {
      const content = `
        this.loadList=["core","loader","control","utils"];
        this.pureData=["data","icons"];
        this.materials=["ground","wall"];
      `;
      const result = parseMainJs2X(content);

      expect(result.loadList).toEqual(["core", "loader", "control", "utils"]);
      expect(result.pureData).toEqual(["data", "icons"]);
      expect(result.materials).toEqual(["ground", "wall"]);
    });

    it("should handle single quotes", () => {
      const content = `this.loadList=['core','loader'];`;
      const result = parseMainJs2X(content);

      expect(result.loadList).toEqual(["core", "loader"]);
    });

    it("should extract boolean configurations", () => {
      const content = `
        this.loadList=[];
        this.enableSplitChunks=true;
        this.skipResourcePackage=false;
      `;
      const result = parseMainJs2X(content);

      expect(result.enableSplitChunks).toBe(true);
      expect(result.skipResourcePackage).toBe(false);
    });

    it("should return default values for missing configurations", () => {
      const content = `this.loadList=[];`;
      const result = parseMainJs2X(content);

      expect(result.enableSplitChunks).toBe(false);
      expect(result.skipResourcePackage).toBe(false);
      expect(result.pureData).toEqual([]);
      expect(result.materials).toEqual([]);
    });

    it("should handle empty arrays", () => {
      const content = `this.loadList=[];`;
      const result = parseMainJs2X(content);

      expect(result.loadList).toEqual([]);
    });
  });

  describe("parseDataJs2X", () => {
    it("should extract game data from data.js content", () => {
      const content = `
        var data_a1e2fb4a_e986_4524_b0da_9b7ba7c0874d = {
          "main": {
            "floorIds": ["MT0", "MT1", "MT2"],
            "images": ["ground.png", "wall.png"],
            "tilesets": ["tileset1.png"],
            "animates": ["fire", "ice"],
            "sounds": ["attack.mp3"],
            "bgms": ["bgm1.mp3"],
            "name": "测试塔"
          }
        };
      `;
      const result = parseDataJs2X(content);

      expect(result.floorIds).toEqual(["MT0", "MT1", "MT2"]);
      expect(result.images).toContain("ground.png");
      expect(result.images).toContain("wall.png");
      expect(result.images).toContain("hero.png"); // 自动添加
      expect(result.tilesets).toEqual(["tileset1.png"]);
      expect(result.animates).toEqual(["fire", "ice"]);
      expect(result.sounds).toEqual(["attack.mp3"]);
      expect(result.bgms).toEqual(["bgm1.mp3"]);
      expect(result.name).toBe("测试塔");
    });

    it("should add hero.png if not present", () => {
      const content = `"images":["ground.png"]`;
      const result = parseDataJs2X(content);

      expect(result.images).toContain("hero.png");
    });

    it("should not duplicate hero.png if already present", () => {
      const content = `"images":["hero.png","ground.png"]`;
      const result = parseDataJs2X(content);

      const heroCount = result.images.filter((img) => img === "hero.png").length;
      expect(heroCount).toBe(1);
    });

    it("should handle alternative array format", () => {
      const content = `"floorIds":['MT0','MT1']`;
      const result = parseDataJs2X(content);

      expect(result.floorIds).toEqual(["MT0", "MT1"]);
    });
  });

  describe("parseIconsJs2X", () => {
    it("should extract autotile mappings from icons.js content", () => {
      const content = `
        var icons_a1e2fb4a = {
          "autotile": {
            "grass": 1,
            "water": 2,
            "lava": 3
          }
        };
      `;
      const result = parseIconsJs2X(content);

      expect(result.autotiles).toEqual(["grass", "water", "lava"]);
    });

    it("should handle single quotes", () => {
      const content = `'autotile':{'grass':1,'water':2}`;
      const result = parseIconsJs2X(content);

      expect(result.autotiles).toEqual(["grass", "water"]);
    });

    it("should return empty array when autotile not found", () => {
      const content = `var icons = {};`;
      const result = parseIconsJs2X(content);

      expect(result.autotiles).toEqual([]);
    });

    it("should handle empty autotile object", () => {
      const content = `"autotile":{}`;
      const result = parseIconsJs2X(content);

      expect(result.autotiles).toEqual([]);
    });
  });

  describe("Integration with real sample", () => {
    it("should parse main.js from sample ZIP", async () => {
      const result = await extract(sampleZip);
      tempDirToClean = result.tempDir;
      rootDir = result.rootDir;

      const mainConfig = await parseMainJs(join(rootDir, "main.js"));

      expect(mainConfig.loadList).toBeDefined();
      expect(Array.isArray(mainConfig.loadList)).toBe(true);
      expect(mainConfig.loadList.length).toBeGreaterThan(0);
    });

    it("should parse data.js from sample ZIP", async () => {
      const result = await extract(sampleZip);
      tempDirToClean = result.tempDir;
      rootDir = result.rootDir;

      const gameData = await parseDataJs(join(rootDir, "project", "data.js"));

      expect(gameData.floorIds).toBeDefined();
      expect(Array.isArray(gameData.floorIds)).toBe(true);
      expect(gameData.images).toContain("hero.png");
    });

    it("should parse icons.js from sample ZIP", async () => {
      const result = await extract(sampleZip);
      tempDirToClean = result.tempDir;
      rootDir = result.rootDir;

      const iconsData = await parseIconsJs(join(rootDir, "project", "icons.js"));

      expect(iconsData.autotiles).toBeDefined();
      expect(Array.isArray(iconsData.autotiles)).toBe(true);
    });
  });

  describe("Error handling", () => {
    it("should throw error for missing main.js", async () => {
      await expect(parseMainJs("/non/existent/main.js")).rejects.toThrow("配置文件缺失：main.js");
    });

    it("should throw error for missing data.js", async () => {
      await expect(parseDataJs("/non/existent/data.js")).rejects.toThrow("配置文件缺失：data.js");
    });

    it("should throw error for missing icons.js", async () => {
      await expect(parseIconsJs("/non/existent/icons.js")).rejects.toThrow("配置文件缺失：icons.js");
    });
  });
});
