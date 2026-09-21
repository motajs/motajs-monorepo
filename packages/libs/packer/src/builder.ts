import { join } from 'node:path';
import type { BuildOptions, BuildResult, BuildContext, CompressOptions } from './types';
import { Logger, formatTimestamp } from './logger';
import { extract } from './extractor';
import { parseMainJs, parseDataJs, parseIconsJs } from './parser';
import { minifyAll } from './minifier';
import { optimizeFromGameData } from './tilesetOptimizer';
import { packAll, writeSplitChunkMap } from './resourcePacker';
import { copyDir, removeDir, ensureDir } from './utils/file-utils';

// 重新导出 BuildContext 类型供外部使用
export type { BuildContext } from './types';

/**
 * 创建构建上下文
 * @param zipPath ZIP 文件路径
 * @param options 压缩选项
 * @param logger 日志记录器
 * @returns 构建上下文
 */
async function createBuildContext(zipPath: string, options: CompressOptions, logger: Logger): Promise<BuildContext> {
  logger.group('初始化构建环境');

  // 解压 ZIP 文件
  logger.log('解压输入文件...');
  const { tempDir, rootDir } = await extract(zipPath);
  logger.log(`临时目录: ${tempDir}`);
  logger.log(`游戏根目录: ${rootDir}`);

  // 解析配置文件
  logger.log('解析配置文件...');
  const mainJsPath = join(rootDir, 'main.js');
  const dataJsPath = join(rootDir, 'project', 'data.js');
  const iconsJsPath = join(rootDir, 'project', 'icons.js');

  const mainConfig = await parseMainJs(mainJsPath);
  logger.log(`  loadList: ${mainConfig.loadList.length} 个库文件`);
  logger.log(`  pureData: ${mainConfig.pureData.length} 个数据文件`);

  const gameData = await parseDataJs(dataJsPath);
  logger.log(`  floorIds: ${gameData.floorIds.length} 个地图`);
  logger.log(`  images: ${gameData.images.length} 个图片`);
  logger.log(`  tilesets: ${gameData.tilesets.length} 个 tileset`);

  const iconsData = await parseIconsJs(iconsJsPath);
  logger.log(`  autotiles: ${iconsData.autotiles.length} 个 autotile`);

  logger.groupEnd();
  logger.success('构建环境初始化完成');

  return {
    tempDir,
    rootDir,
    mainConfig,
    gameData,
    iconsData,
    logger,
    options,
  };
}

/**
 * 执行构建流程
 * @param ctx 构建上下文
 * @param outputDir 输出目录
 */
async function executeBuild(ctx: BuildContext, outputDir: string): Promise<void> {
  const { rootDir, mainConfig, gameData, iconsData, logger, options } = ctx;

  // 1. 压缩 JavaScript 文件
  if (options.minify !== false) {
    const minifyResult = await minifyAll(rootDir, mainConfig, gameData, logger);

    // 2. 优化 Tileset（需要 floors.min.js）
    if (minifyResult.floorsContent) {
      await optimizeFromGameData(rootDir, gameData, logger);
    }
  }

  // 3. 打包资源文件
  const packOptions: {
    enableSplitChunks?: boolean;
    chunkThreshold?: number;
    compressImages?: boolean;
    skipResourcePackage?: boolean;
  } = {
    enableSplitChunks: options.splitChunks ?? mainConfig.enableSplitChunks,
    skipResourcePackage: mainConfig.skipResourcePackage,
  };

  if (options.chunkThreshold !== undefined) {
    packOptions.chunkThreshold = options.chunkThreshold;
  }
  if (options.compressImages !== undefined) {
    packOptions.compressImages = options.compressImages;
  }

  const splitChunkMap = await packAll(rootDir, mainConfig, gameData, iconsData, packOptions, logger);

  // 4. 写入分块映射（如果有）
  if (Object.keys(splitChunkMap).length > 0) {
    await writeSplitChunkMap(rootDir, splitChunkMap);
    logger.log(`已写入 splitChunkMap 配置`);
  }

  // 5. 复制到输出目录
  logger.group('输出构建结果');
  logger.log(`复制文件到: ${outputDir}`);
  await ensureDir(outputDir);
  await copyDir(rootDir, outputDir);
  logger.groupEnd();
  logger.success('构建完成');
}

/**
 * 清理临时文件
 * @param tempDir 临时目录
 * @param logger 日志记录器
 */
async function cleanup(tempDir: string, logger?: Logger): Promise<void> {
  try {
    await removeDir(tempDir);
    logger?.log('已清理临时文件');
  } catch (error) {
    logger?.warn(`清理临时文件失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 构建魔塔游戏
 * @param options 构建选项
 * @returns 构建结果
 */
export async function build(options: BuildOptions): Promise<BuildResult> {
  const { input, output, options: compressOptions = {}, logger: logCallback } = options;

  // 创建 Logger 实例
  const logger = new Logger(logCallback);

  // 记录开始时间
  const startTime = Date.now();
  logger.log(`${formatTimestamp()} 开始构建`);
  logger.log(`输入: ${input}`);
  logger.log(`输出: ${output}`);

  let ctx: BuildContext | null = null;

  try {
    // 创建构建上下文
    ctx = await createBuildContext(input, compressOptions, logger);

    // 执行构建
    await executeBuild(ctx, output);

    // 计算耗时
    const duration = Date.now() - startTime;
    logger.log(`${formatTimestamp()} 构建耗时: ${(duration / 1000).toFixed(2)}s`);

    return {
      success: true,
      outputDir: output,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`构建失败: ${errorMessage}`);

    return {
      success: false,
      outputDir: output,
      error: errorMessage,
    };
  } finally {
    // 清理临时文件
    if (ctx?.tempDir) {
      await cleanup(ctx.tempDir, logger);
    }
  }
}
