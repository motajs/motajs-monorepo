import { readFile, stat } from 'node:fs/promises';
import { join, basename, extname } from 'node:path';
import { createZip, type FileEntry } from './utils/zip-utils';
import { compressImage } from './utils/image-utils';
import type { MainConfig, GameData, IconsData } from './types';
import { Logger } from './logger';

/** 默认分块阈值 2MB */
const DEFAULT_CHUNK_THRESHOLD = 2 * 1024 * 1024;

/** 大文件警告阈值 5MB */
const LARGE_FILE_WARNING_THRESHOLD = 5 * 1024 * 1024;

/**
 * 打包选项
 */
export interface PackOptions {
  /** 源目录 */
  sourceDir: string;
  /** 文件列表 */
  files: string[];
  /** 输出文件名（不含扩展名） */
  outputName: string;
  /** 扩展名，默认 '.h5data' */
  extension?: string;
  /** 文件名转换函数 */
  transform?: (filename: string) => string;
  /** 是否压缩图片 */
  compressImages?: boolean;
  /** 日志记录器 */
  logger?: Logger;
}

/**
 * 分块打包选项
 */
export interface PackWithChunksOptions extends PackOptions {
  /** 分块阈值（字节） */
  chunkThreshold?: number;
}

/**
 * 打包结果
 */
export interface PackResult {
  /** 输出文件路径列表 */
  outputFiles: string[];
  /** 总文件数 */
  totalFiles: number;
  /** 总大小（字节） */
  totalSize: number;
}

/**
 * 读取文件并创建 FileEntry
 * @param sourceDir 源目录
 * @param filename 文件名
 * @param transform 文件名转换函数
 * @returns FileEntry 或 null（文件不存在时）
 */
async function readFileEntry(
  sourceDir: string,
  filename: string,
  transform?: (filename: string) => string,
): Promise<{ entry: FileEntry; size: number } | null> {
  const filePath = join(sourceDir, filename);
  try {
    const content = await readFile(filePath);
    const name = transform ? transform(filename) : basename(filename);
    return {
      entry: { name, content },
      size: content.length,
    };
  } catch {
    // 文件不存在，跳过
    return null;
  }
}

/**
 * 打包单个资源类型到 .h5data/.zip
 * @param options 打包选项
 * @returns 打包结果
 */
export async function packResources(options: PackOptions): Promise<PackResult> {
  const {
    sourceDir,
    files,
    outputName,
    extension = '.h5data',
    transform,
    compressImages: shouldCompress = false,
    logger,
  } = options;

  const entries: FileEntry[] = [];
  let totalSize = 0;

  for (const file of files) {
    // 如果需要压缩图片，先尝试压缩
    if (shouldCompress) {
      const filePath = join(sourceDir, file);
      const ext = extname(file).toLowerCase();
      if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
        try {
          const compressed = await compressImage(filePath);
          if (compressed) {
            logger?.log(`压缩图片: ${file}`);
          }
        } catch {
          // 压缩失败，继续使用原文件
        }
      }
    }

    const result = await readFileEntry(sourceDir, file, transform);
    if (result) {
      entries.push(result.entry);
      totalSize += result.size;
    }
  }

  if (entries.length === 0) {
    return {
      outputFiles: [],
      totalFiles: 0,
      totalSize: 0,
    };
  }

  const outputPath = join(sourceDir, `${outputName}${extension}`);
  await createZip(entries, outputPath);

  return {
    outputFiles: [outputPath],
    totalFiles: entries.length,
    totalSize,
  };
}

/**
 * 分块打包超过阈值的资源
 * 当资源总大小超过阈值时，将资源分割为多个小文件
 * @param options 分块打包选项
 * @returns 打包结果（包含所有分块文件路径）
 */
export async function packWithChunks(options: PackWithChunksOptions): Promise<PackResult> {
  const {
    sourceDir,
    files,
    outputName,
    extension = '.h5data',
    transform,
    compressImages: shouldCompress = false,
    chunkThreshold = DEFAULT_CHUNK_THRESHOLD,
    logger,
  } = options;

  // 先读取所有文件并计算大小
  const fileEntries: Array<{ entry: FileEntry; size: number }> = [];
  let totalSize = 0;

  for (const file of files) {
    // 如果需要压缩图片，先尝试压缩
    if (shouldCompress) {
      const filePath = join(sourceDir, file);
      const ext = extname(file).toLowerCase();
      if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
        try {
          const compressed = await compressImage(filePath);
          if (compressed) {
            logger?.log(`压缩图片: ${file}`);
          }
        } catch {
          // 压缩失败，继续使用原文件
        }
      }
    }

    const result = await readFileEntry(sourceDir, file, transform);
    if (result) {
      fileEntries.push(result);
      totalSize += result.size;
    }
  }

  if (fileEntries.length === 0) {
    return {
      outputFiles: [],
      totalFiles: 0,
      totalSize: 0,
    };
  }

  // 如果总大小未超过阈值，直接打包为单个文件
  if (totalSize <= chunkThreshold) {
    const outputPath = join(sourceDir, `${outputName}${extension}`);
    await createZip(
      fileEntries.map((f) => f.entry),
      outputPath,
    );
    return {
      outputFiles: [outputPath],
      totalFiles: fileEntries.length,
      totalSize,
    };
  }

  // 分块打包
  const outputFiles: string[] = [];
  let chunkIndex = 0;
  let currentChunk: FileEntry[] = [];
  let currentChunkSize = 0;

  for (const { entry, size } of fileEntries) {
    // 如果当前块加上这个文件会超过阈值，先保存当前块
    if (currentChunk.length > 0 && currentChunkSize + size > chunkThreshold) {
      const chunkPath = join(sourceDir, `${outputName}-${chunkIndex}${extension}`);
      await createZip(currentChunk, chunkPath);
      outputFiles.push(chunkPath);
      chunkIndex++;
      currentChunk = [];
      currentChunkSize = 0;
    }

    currentChunk.push(entry);
    currentChunkSize += size;
  }

  // 保存最后一个块
  if (currentChunk.length > 0) {
    const chunkPath = join(sourceDir, `${outputName}-${chunkIndex}${extension}`);
    await createZip(currentChunk, chunkPath);
    outputFiles.push(chunkPath);
  }

  return {
    outputFiles,
    totalFiles: fileEntries.length,
    totalSize,
  };
}

/**
 * 资源类型配置
 */
interface ResourceTypeConfig {
  /** 资源类型名称 */
  type: string;
  /** 资源目录（相对于 project） */
  dir: string;
  /** 文件列表 */
  files: string[];
  /** 文件名转换函数 */
  transform?: (filename: string) => string;
}

/**
 * 检测是否使用 .zip 扩展名
 * 如果 libs.min.js 包含 "images.zip"，则使用 .zip
 * @param rootDir 游戏根目录
 * @returns 扩展名
 */
async function detectExtension(rootDir: string): Promise<string> {
  try {
    const libsMinPath = join(rootDir, 'libs', 'libs.min.js');
    const content = await readFile(libsMinPath, 'utf-8');
    if (content.includes('images.zip')) {
      return '.zip';
    }
  } catch {
    // 文件不存在，使用默认扩展名
  }
  return '.h5data';
}

/**
 * 检查单个资源文件是否过大
 * @param sourceDir 源目录
 * @param files 文件列表
 * @param logger 日志记录器
 */
async function checkLargeFiles(sourceDir: string, files: string[], logger?: Logger): Promise<void> {
  for (const file of files) {
    try {
      const filePath = join(sourceDir, file);
      const stats = await stat(filePath);
      if (stats.size > LARGE_FILE_WARNING_THRESHOLD) {
        logger?.warn(`资源文件过大：${file}（${formatSize(stats.size)}），建议启用分块压缩`);
      }
    } catch {
      // 文件不存在，跳过
    }
  }
}

/**
 * 格式化文件大小
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}

/**
 * 打包所有资源类型
 * @param rootDir 游戏根目录
 * @param mainConfig main.js 配置
 * @param gameData 游戏数据
 * @param iconsData 图标数据
 * @param options 压缩选项
 * @param logger 日志记录器
 * @returns 分块映射表（用于写入 main.js）
 */
export async function packAll(
  rootDir: string,
  mainConfig: MainConfig,
  gameData: GameData,
  iconsData: IconsData,
  options?: {
    enableSplitChunks?: boolean;
    chunkThreshold?: number;
    compressImages?: boolean;
    skipResourcePackage?: boolean;
  },
  logger?: Logger,
): Promise<Record<string, string[]>> {
  // 如果跳过资源打包，直接返回
  if (options?.skipResourcePackage || mainConfig.skipResourcePackage) {
    logger?.log('跳过资源打包（skipResourcePackage = true）');
    return {};
  }

  logger?.group('打包资源文件');

  const extension = await detectExtension(rootDir);
  const enableSplitChunks = options?.enableSplitChunks ?? mainConfig.enableSplitChunks;
  const chunkThreshold = options?.chunkThreshold ?? DEFAULT_CHUNK_THRESHOLD;
  const compressImages = options?.compressImages ?? true;

  const projectDir = join(rootDir, 'project');
  const splitChunkMap: Record<string, string[]> = {};

  // 定义资源类型配置
  const resourceTypes: ResourceTypeConfig[] = [
    {
      type: 'images',
      dir: 'images',
      files: gameData.images.map((name) => `${name}.png`),
    },
    {
      type: 'materials',
      dir: 'materials',
      files: mainConfig.materials.map((name) => `${name}.png`),
    },
    {
      type: 'tilesets',
      dir: 'tilesets',
      files: gameData.tilesets.map((name) => `${name}.png`),
    },
    {
      type: 'autotiles',
      dir: 'autotiles',
      files: iconsData.autotiles.map((name) => `${name}.png`),
    },
    {
      type: 'animates',
      dir: 'animates',
      files: gameData.animates.map((name) => `${name}.animate`),
    },
    {
      type: 'sounds',
      dir: 'sounds',
      files: gameData.sounds,
    },
    {
      type: 'bgms',
      dir: 'bgms',
      files: gameData.bgms,
    },
  ];

  for (const config of resourceTypes) {
    const sourceDir = join(projectDir, config.dir);

    // 检查大文件警告
    if (!enableSplitChunks) {
      await checkLargeFiles(sourceDir, config.files, logger);
    }

    logger?.log(`打包 ${config.type}...`);

    let result: PackResult;

    const packOptions: PackOptions = {
      sourceDir,
      files: config.files,
      outputName: config.type,
      extension,
      compressImages,
    };

    if (config.transform) {
      packOptions.transform = config.transform;
    }

    if (logger) {
      packOptions.logger = logger;
    }

    if (enableSplitChunks) {
      result = await packWithChunks({
        ...packOptions,
        chunkThreshold,
      });
    } else {
      result = await packResources(packOptions);
    }

    if (result.outputFiles.length > 0) {
      logger?.log(`  -> ${result.totalFiles} 个文件，${formatSize(result.totalSize)}`);

      // 如果有分块，记录到映射表
      if (result.outputFiles.length > 1) {
        splitChunkMap[config.type] = result.outputFiles.map((f) => basename(f));
      }
    }
  }

  logger?.groupEnd();
  logger?.success('所有资源文件已打包');

  return splitChunkMap;
}

/**
 * 将分块映射写入 main.js
 * @param rootDir 游戏根目录
 * @param splitChunkMap 分块映射表
 */
export async function writeSplitChunkMap(rootDir: string, splitChunkMap: Record<string, string[]>): Promise<void> {
  if (Object.keys(splitChunkMap).length === 0) {
    return;
  }

  const mainJsPath = join(rootDir, 'main.js');
  const content = await readFile(mainJsPath, 'utf-8');

  const mapJson = JSON.stringify(splitChunkMap);
  const appendContent = `\nmain.splitChunkMap = ${mapJson};\n`;

  await import('node:fs/promises').then((fs) => fs.writeFile(mainJsPath, content + appendContent, 'utf-8'));
}
