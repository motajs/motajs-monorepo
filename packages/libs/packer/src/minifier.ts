import { readFile, writeFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { minify } from 'terser';
import type { MainConfig, GameData } from './types.js';
import { Logger } from './logger.js';

/**
 * 压缩结果
 */
export interface MinifyResult {
  /** libs.min.js 内容 */
  libsContent: string;
  /** project.min.js 内容 */
  projectContent: string;
  /** floors.min.js 内容 */
  floorsContent: string;
}

/**
 * 压缩单个 JS 文件
 * @param filePath JS 文件路径
 * @returns 压缩后的代码
 */
export async function minifyFile(filePath: string): Promise<string> {
  const content = await readFile(filePath, 'utf-8');

  const result = await minify(content, {
    compress: {
      dead_code: true,
      drop_debugger: true,
      conditionals: true,
      evaluate: true,
      booleans: true,
      loops: true,
      unused: true,
      hoist_funs: true,
      keep_fargs: false,
      hoist_vars: false,
      if_return: true,
      join_vars: true,
      side_effects: true,
    },
    mangle: true,
    output: {
      comments: false,
    },
  });

  if (result.code === undefined) {
    throw new Error(`JS 压缩失败：${basename(filePath)}`);
  }

  return result.code;
}

/**
 * 合并多个 JS 文件并压缩
 * @param filePaths JS 文件路径列表
 * @returns 压缩后的代码
 */
export async function minifyMultiple(filePaths: string[]): Promise<string> {
  if (filePaths.length === 0) {
    return '';
  }

  // 读取所有文件内容
  const contents = await Promise.all(
    filePaths.map(async (filePath) => {
      try {
        return await readFile(filePath, 'utf-8');
      } catch {
        // 文件不存在时跳过
        return '';
      }
    }),
  );

  // 合并内容，用分号分隔
  const combined = contents.filter((c) => c.length > 0).join(';\n');

  if (!combined) {
    return '';
  }

  const result = await minify(combined, {
    compress: {
      dead_code: true,
      drop_debugger: true,
      conditionals: true,
      evaluate: true,
      booleans: true,
      loops: true,
      unused: true,
      hoist_funs: true,
      keep_fargs: false,
      hoist_vars: false,
      if_return: true,
      join_vars: true,
      side_effects: true,
    },
    mangle: true,
    output: {
      comments: false,
    },
  });

  if (result.code === undefined) {
    throw new Error(`JS 压缩失败：合并文件时出错`);
  }

  return result.code;
}

/**
 * 压缩 libs 目录下的所有核心库文件
 * @param rootDir 游戏根目录
 * @param loadList 核心库加载列表
 * @returns 压缩后的代码
 */
export async function minifyLibs(rootDir: string, loadList: string[]): Promise<string> {
  const libsDir = join(rootDir, 'libs');
  const filePaths = loadList.map((name) => join(libsDir, `${name}.js`));
  return minifyMultiple(filePaths);
}

/**
 * 压缩 project 目录下的所有数据文件
 * @param rootDir 游戏根目录
 * @param pureData 纯数据文件列表
 * @returns 压缩后的代码
 */
export async function minifyProject(rootDir: string, pureData: string[]): Promise<string> {
  const projectDir = join(rootDir, 'project');
  const filePaths = pureData.map((name) => join(projectDir, `${name}.js`));
  return minifyMultiple(filePaths);
}

/**
 * 压缩 project/floors 目录下的所有地图文件
 * @param rootDir 游戏根目录
 * @param floorIds 地图 ID 列表
 * @returns 压缩后的代码
 */
export async function minifyFloors(rootDir: string, floorIds: string[]): Promise<string> {
  const floorsDir = join(rootDir, 'project', 'floors');
  const filePaths = floorIds.map((id) => join(floorsDir, `${id}.js`));
  return minifyMultiple(filePaths);
}

/**
 * 生成随机版本号用于缓存清除
 * @returns 随机版本号字符串
 */
function generateVersion(): string {
  return Math.random().toString(36).substring(2, 10);
}

/**
 * 追加 useCompress 和 version 到 main.js
 * @param rootDir 游戏根目录
 */
async function appendMainJsConfig(rootDir: string): Promise<void> {
  const mainJsPath = join(rootDir, 'main.js');
  const content = await readFile(mainJsPath, 'utf-8');

  const version = generateVersion();
  const appendContent = `\nmain.useCompress = true;\nmain.version = "${version}";\n`;

  await writeFile(mainJsPath, content + appendContent, 'utf-8');
}

/**
 * 执行所有压缩操作
 * @param rootDir 游戏根目录
 * @param mainConfig main.js 配置
 * @param gameData 游戏数据
 * @param logger 日志记录器
 * @returns 压缩结果
 */
export async function minifyAll(
  rootDir: string,
  mainConfig: MainConfig,
  gameData: GameData,
  logger?: Logger,
): Promise<MinifyResult> {
  logger?.group('压缩 JavaScript 文件');

  // 压缩 libs
  logger?.log('压缩 libs/*.js -> libs/libs.min.js');
  const libsContent = await minifyLibs(rootDir, mainConfig.loadList);
  if (libsContent) {
    const libsMinPath = join(rootDir, 'libs', 'libs.min.js');
    // 追加 localForage 初始化代码
    const libsWithInit = libsContent + ';\nlocalforage.config({name:"mota"});';
    await writeFile(libsMinPath, libsWithInit, 'utf-8');
  }

  // 压缩 project
  logger?.log('压缩 project/*.js -> project/project.min.js');
  const projectContent = await minifyProject(rootDir, mainConfig.pureData);
  if (projectContent) {
    const projectMinPath = join(rootDir, 'project', 'project.min.js');
    await writeFile(projectMinPath, projectContent, 'utf-8');
  }

  // 压缩 floors
  logger?.log('压缩 project/floors/*.js -> project/floors.min.js');
  const floorsContent = await minifyFloors(rootDir, gameData.floorIds);
  if (floorsContent) {
    const floorsMinPath = join(rootDir, 'project', 'floors.min.js');
    await writeFile(floorsMinPath, floorsContent, 'utf-8');
  }

  // 追加 useCompress 和 version 到 main.js
  logger?.log('更新 main.js 配置');
  await appendMainJsConfig(rootDir);

  logger?.groupEnd();
  logger?.success('所有核心文件已压缩');

  return {
    libsContent,
    projectContent,
    floorsContent,
  };
}
