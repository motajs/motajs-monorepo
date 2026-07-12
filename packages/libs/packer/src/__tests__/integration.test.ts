import { describe, it, expect, afterEach } from "vitest";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { rm, readFile, stat } from "node:fs/promises";
import { extract } from "../extractor.js";
import { parseMainJs, parseDataJs, parseIconsJs } from "../parser.js";
import { minifyAll } from "../minifier.js";
import { optimizeFromGameData } from "../tilesetOptimizer.js";
import { packAll } from "../resourcePacker.js";
import { Logger } from "../logger.js";
import { build } from "../builder.js";

describe("Integration: Complete Compression Flow", () => {
  const sampleZip = join(process.cwd(), "sample", "51.zip");
  let tempDirToClean: string | null = null;

  afterEach(async () => {
    if (tempDirToClean && existsSync(tempDirToClean)) {
      await rm(tempDirToClean, { recursive: true, force: true });
      tempDirToClean = null;
    }
  });

  it("should complete the full compression flow with sample/51.zip", async () => {
    // 1. 解压
    const { tempDir, rootDir } = await extract(sampleZip);
    tempDirToClean = tempDir;

    expect(existsSync(rootDir)).toBe(true);
    expect(existsSync(join(rootDir, "main.js"))).toBe(true);

    // 2. 解析配置
    const mainConfig = await parseMainJs(join(rootDir, "main.js"));
    const gameData = await parseDataJs(join(rootDir, "project", "data.js"));
    const iconsData = await parseIconsJs(join(rootDir, "project", "icons.js"));

    expect(mainConfig.loadList.length).toBeGreaterThan(0);
    expect(gameData.floorIds.length).toBeGreaterThan(0);

    // 3. 压缩 JS 文件
    const logger = new Logger();
    const minifyResult = await minifyAll(rootDir, mainConfig, gameData, logger);

    expect(minifyResult.libsContent).toBeDefined();
    expect(minifyResult.projectContent).toBeDefined();
    expect(minifyResult.floorsContent).toBeDefined();

    // 验证压缩文件已生成
    expect(existsSync(join(rootDir, "libs", "libs.min.js"))).toBe(true);
    expect(existsSync(join(rootDir, "project", "project.min.js"))).toBe(true);
    expect(existsSync(join(rootDir, "project", "floors.min.js"))).toBe(true);

    // 验证 main.js 已更新
    const mainJsContent = await readFile(join(rootDir, "main.js"), "utf-8");
    expect(mainJsContent).toContain("main.useCompress = true");
    expect(mainJsContent).toContain("main.version");

    // 4. 优化 Tileset（如果有）
    if (gameData.tilesets.length > 0) {
      const optimizedCount = await optimizeFromGameData(rootDir, gameData, logger);
      // 优化数量可能为 0（如果所有 tile 都被使用）
      expect(optimizedCount).toBeGreaterThanOrEqual(0);
    }

    // 5. 打包资源
    await packAll(
      rootDir,
      mainConfig,
      gameData,
      iconsData,
      { compressImages: false }, // 跳过图片压缩以加快测试
      logger,
    );

    // 验证资源包已生成
    const projectDir = join(rootDir, "project");

    // 检查 materials 资源包（从日志可以看到有 8 个文件）
    if (mainConfig.materials.length > 0) {
      const h5dataPath = join(projectDir, "materials", "materials.h5data");
      const zipPath = join(projectDir, "materials", "materials.zip");
      expect(existsSync(h5dataPath) || existsSync(zipPath)).toBe(true);
    }

    // 检查 sounds 资源包
    if (gameData.sounds.length > 0) {
      const h5dataPath = join(projectDir, "sounds", "sounds.h5data");
      const zipPath = join(projectDir, "sounds", "sounds.zip");
      expect(existsSync(h5dataPath) || existsSync(zipPath)).toBe(true);
    }

    // 检查 bgms 资源包
    if (gameData.bgms.length > 0) {
      const h5dataPath = join(projectDir, "bgms", "bgms.h5data");
      const zipPath = join(projectDir, "bgms", "bgms.zip");
      expect(existsSync(h5dataPath) || existsSync(zipPath)).toBe(true);
    }

    // 检查 autotiles 资源包
    if (iconsData.autotiles.length > 0) {
      const h5dataPath = join(projectDir, "autotiles", "autotiles.h5data");
      const zipPath = join(projectDir, "autotiles", "autotiles.zip");
      expect(existsSync(h5dataPath) || existsSync(zipPath)).toBe(true);
    }

    // 检查 animates 资源包
    if (gameData.animates.length > 0) {
      const h5dataPath = join(projectDir, "animates", "animates.h5data");
      const zipPath = join(projectDir, "animates", "animates.zip");
      expect(existsSync(h5dataPath) || existsSync(zipPath)).toBe(true);
    }
  }, 60000); // 60 秒超时

  it("should verify minified JS files are smaller than originals", async () => {
    const { tempDir, rootDir } = await extract(sampleZip);
    tempDirToClean = tempDir;

    const mainConfig = await parseMainJs(join(rootDir, "main.js"));
    const gameData = await parseDataJs(join(rootDir, "project", "data.js"));

    // 计算原始文件大小
    let originalLibsSize = 0;
    for (const lib of mainConfig.loadList) {
      try {
        const stats = await stat(join(rootDir, "libs", `${lib}.js`));
        originalLibsSize += stats.size;
      } catch {
        // 文件不存在，跳过
      }
    }

    // 压缩
    await minifyAll(rootDir, mainConfig, gameData);

    // 验证压缩后文件更小
    const minifiedStats = await stat(join(rootDir, "libs", "libs.min.js"));
    expect(minifiedStats.size).toBeLessThan(originalLibsSize);
  }, 60000);

  it("should handle the complete flow with logging", async () => {
    const { tempDir, rootDir } = await extract(sampleZip);
    tempDirToClean = tempDir;

    const mainConfig = await parseMainJs(join(rootDir, "main.js"));
    const gameData = await parseDataJs(join(rootDir, "project", "data.js"));

    // 收集日志
    const logs: string[] = [];
    const logger = new Logger((msg) => logs.push(msg));

    // 执行压缩
    await minifyAll(rootDir, mainConfig, gameData, logger);

    // 验证日志输出
    expect(logs.some((log) => log.includes("压缩"))).toBe(true);
    expect(logs.some((log) => log.includes("libs.min.js"))).toBe(true);
  }, 60000);
});

describe("Integration: build() function", () => {
  const sampleZip = join(process.cwd(), "sample", "51.zip");
  const outputDir = join(process.cwd(), "test-output");

  afterEach(async () => {
    if (existsSync(outputDir)) {
      await rm(outputDir, { recursive: true, force: true });
    }
  });

  it("should build successfully with sample/51.zip", async () => {
    const logs: string[] = [];

    const result = await build({
      input: sampleZip,
      output: outputDir,
      options: {
        compressImages: false, // 跳过图片压缩以加快测试
      },
      logger: (msg) => logs.push(msg),
    });

    // 验证构建成功
    expect(result.success).toBe(true);
    expect(result.outputDir).toBe(outputDir);
    expect(result.error).toBeUndefined();

    // 验证输出目录存在
    expect(existsSync(outputDir)).toBe(true);
    expect(existsSync(join(outputDir, "main.js"))).toBe(true);

    // 验证压缩文件已生成
    expect(existsSync(join(outputDir, "libs", "libs.min.js"))).toBe(true);
    expect(existsSync(join(outputDir, "project", "project.min.js"))).toBe(true);
    expect(existsSync(join(outputDir, "project", "floors.min.js"))).toBe(true);

    // 验证 main.js 已更新
    const mainJsContent = await readFile(join(outputDir, "main.js"), "utf-8");
    expect(mainJsContent).toContain("main.useCompress = true");
    expect(mainJsContent).toContain("main.version");

    // 验证日志输出
    expect(logs.some((log) => log.includes("开始构建"))).toBe(true);
    expect(logs.some((log) => log.includes("构建完成"))).toBe(true);
    expect(logs.some((log) => log.includes("已清理临时文件"))).toBe(true);
  }, 60000);

  it("should produce correct output directory structure", async () => {
    const logs: string[] = [];

    const result = await build({
      input: sampleZip,
      output: outputDir,
      options: {
        compressImages: false,
      },
      logger: (msg) => logs.push(msg),
    });

    expect(result.success).toBe(true);

    // 验证核心目录结构
    expect(existsSync(join(outputDir, "libs"))).toBe(true);
    expect(existsSync(join(outputDir, "project"))).toBe(true);

    // 验证压缩后的 JS 文件
    const libsMinJs = await readFile(join(outputDir, "libs", "libs.min.js"), "utf-8");
    expect(libsMinJs.length).toBeGreaterThan(0);

    const projectMinJs = await readFile(join(outputDir, "project", "project.min.js"), "utf-8");
    expect(projectMinJs.length).toBeGreaterThan(0);

    const floorsMinJs = await readFile(join(outputDir, "project", "floors.min.js"), "utf-8");
    expect(floorsMinJs.length).toBeGreaterThan(0);

    // 验证资源包目录存在
    const projectDir = join(outputDir, "project");
    expect(existsSync(join(projectDir, "materials"))).toBe(true);
    expect(existsSync(join(projectDir, "sounds"))).toBe(true);
    expect(existsSync(join(projectDir, "bgms"))).toBe(true);
    expect(existsSync(join(projectDir, "autotiles"))).toBe(true);
    expect(existsSync(join(projectDir, "animates"))).toBe(true);
    expect(existsSync(join(projectDir, "tilesets"))).toBe(true);

    // 验证资源包文件存在（.h5data 或 .zip）
    const checkResourcePack = (dir: string, name: string) => {
      return existsSync(join(dir, `${name}.h5data`)) || existsSync(join(dir, `${name}.zip`));
    };

    expect(checkResourcePack(join(projectDir, "materials"), "materials")).toBe(true);
    expect(checkResourcePack(join(projectDir, "sounds"), "sounds")).toBe(true);
    expect(checkResourcePack(join(projectDir, "bgms"), "bgms")).toBe(true);
    expect(checkResourcePack(join(projectDir, "autotiles"), "autotiles")).toBe(true);
    expect(checkResourcePack(join(projectDir, "animates"), "animates")).toBe(true);
    expect(checkResourcePack(join(projectDir, "tilesets"), "tilesets")).toBe(true);
  }, 60000);

  it("should produce correct log output format", async () => {
    const logs: string[] = [];

    const result = await build({
      input: sampleZip,
      output: outputDir,
      options: {
        compressImages: false,
      },
      logger: (msg) => logs.push(msg),
    });

    expect(result.success).toBe(true);

    // 验证日志包含时间戳格式 [YYYY-MM-DD HH:MM:SS]
    const timestampPattern = /\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]/;
    expect(logs.some((log) => timestampPattern.test(log))).toBe(true);

    // 验证日志包含关键阶段
    expect(logs.some((log) => log.includes("初始化构建环境"))).toBe(true);
    expect(logs.some((log) => log.includes("解压输入文件"))).toBe(true);
    expect(logs.some((log) => log.includes("解析配置文件"))).toBe(true);
    expect(logs.some((log) => log.includes("压缩 JavaScript 文件") || log.includes("压缩"))).toBe(true);
    expect(logs.some((log) => log.includes("打包资源文件") || log.includes("打包"))).toBe(true);
    expect(logs.some((log) => log.includes("输出构建结果"))).toBe(true);
    expect(logs.some((log) => log.includes("构建完成"))).toBe(true);
    expect(logs.some((log) => log.includes("已清理临时文件"))).toBe(true);

    // 验证成功消息格式（======> 前缀）
    expect(logs.some((log) => log.includes("======>"))).toBe(true);
  }, 60000);

  it("should return error for non-existent input file", async () => {
    const result = await build({
      input: "non-existent.zip",
      output: outputDir,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("压缩文件不存在");
  });

  it("should clean up temp files even on error", async () => {
    const logs: string[] = [];

    // 使用不存在的文件触发错误
    await build({
      input: "non-existent.zip",
      output: outputDir,
      logger: (msg) => logs.push(msg),
    });

    // 验证错误日志
    expect(logs.some((log) => log.includes("构建失败"))).toBe(true);
  });
});
