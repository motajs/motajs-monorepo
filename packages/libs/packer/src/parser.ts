import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { MainConfig, GameData, IconsData } from "./types.js";

/**
 * 使用正则表达式从字符串中提取数组内容
 * 支持多种格式：this.loadList=[...], this.loadList = [...], "floorIds": [...]
 * @param content 源字符串
 * @param patterns 正则表达式模式数组
 * @returns 数组元素列表
 */
function extractArrayWithRegex(content: string, patterns: RegExp[]): string[] {
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      const arrayContent = match[1];
      if (!arrayContent.trim()) continue;

      return arrayContent
        .replace(/["']/g, "")
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }
  }
  return [];
}

/**
 * 从字符串中提取布尔值配置
 * 支持多种格式：this.enableSplitChunks=true, this.enableSplitChunks = true
 * @param content 源字符串
 * @param patterns 正则表达式模式数组
 * @param defaultValue 默认值
 * @returns 布尔值
 */
function extractBooleanWithRegex(content: string, patterns: RegExp[], defaultValue: boolean = false): boolean {
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      const valueStr = match[1].trim().toLowerCase();
      if (valueStr === "true") return true;
      if (valueStr === "false") return false;
    }
  }
  return defaultValue;
}

/**
 * 解析 main.js 文件（2.x 版本）
 * 提取 loadList, pureData, materials, enableSplitChunks, skipResourcePackage
 * @param content main.js 文件内容
 * @returns MainConfig 配置对象
 */
export function parseMainJs2X(content: string): MainConfig {
  // 提取 loadList - 核心库加载列表
  // 支持格式：this.loadList=[...] 或 this.loadList = [...]
  const loadList = extractArrayWithRegex(content, [
    /this\.loadList\s*=\s*\[([^\]]*)\]/,
  ]);

  // 提取 pureData - 纯数据文件列表
  const pureData = extractArrayWithRegex(content, [
    /this\.pureData\s*=\s*\[([^\]]*)\]/,
  ]);

  // 提取 materials - 材质列表
  const materials = extractArrayWithRegex(content, [
    /this\.materials\s*=\s*\[([^\]]*)\]/,
  ]);

  // 提取 enableSplitChunks - 是否启用分块压缩
  const enableSplitChunks = extractBooleanWithRegex(content, [
    /this\.enableSplitChunks\s*=\s*(true|false)/i,
  ], false);

  // 提取 skipResourcePackage - 是否跳过资源打包
  const skipResourcePackage = extractBooleanWithRegex(content, [
    /this\.skipResourcePackage\s*=\s*(true|false)/i,
  ], false);

  return {
    loadList,
    pureData,
    materials,
    enableSplitChunks,
    skipResourcePackage,
  };
}

/**
 * 解析 data.js 文件（2.x 版本）
 * 提取 floorIds, images, tilesets, animates, sounds, bgms, name
 * @param content data.js 文件内容
 * @returns GameData 游戏数据对象
 */
export function parseDataJs2X(content: string): GameData {
  // 提取 floorIds - 地图 ID 列表
  // 支持格式：floorIds:[...], "floorIds": [...], 'floorIds': [...]
  const floorIds = extractArrayWithRegex(content, [
    /["']?floorIds["']?\s*:\s*\[([^\]]*)\]/,
  ]);

  // 提取 images - 图片列表
  const images = extractArrayWithRegex(content, [
    /["']?images["']?\s*:\s*\[([^\]]*)\]/,
  ]);
  // 确保 hero.png 在列表中
  if (!images.includes("hero.png")) {
    images.push("hero.png");
  }

  // 提取 tilesets - tileset 文件列表
  const tilesets = extractArrayWithRegex(content, [
    /["']?tilesets["']?\s*:\s*\[([^\]]*)\]/,
  ]);

  // 提取 animates - 动画列表
  const animates = extractArrayWithRegex(content, [
    /["']?animates["']?\s*:\s*\[([^\]]*)\]/,
  ]);

  // 提取 sounds - 音效列表
  const sounds = extractArrayWithRegex(content, [
    /["']?sounds["']?\s*:\s*\[([^\]]*)\]/,
  ]);

  // 提取 bgms - BGM 列表
  const bgms = extractArrayWithRegex(content, [
    /["']?bgms["']?\s*:\s*\[([^\]]*)\]/,
  ]);

  // 提取 name - 游戏名称
  let name = "";
  const nameMatch = content.match(/["']name["']\s*:\s*["']([^"']+)["']/);
  if (nameMatch) {
    name = nameMatch[1];
  }

  return {
    floorIds,
    images,
    tilesets,
    animates,
    sounds,
    bgms,
    name,
  };
}

/**
 * 解析 icons.js 文件（2.x 版本）
 * 提取 autotile 映射
 * @param content icons.js 文件内容
 * @returns IconsData 图标数据对象
 */
export function parseIconsJs2X(content: string): IconsData {
  // 查找 autotile 对象
  // 支持格式：autotile:{...}, "autotile": {...}
  const autotileMatch = content.match(/["']?autotile["']?\s*:\s*\{([^}]*)\}/);

  if (!autotileMatch || !autotileMatch[1]) {
    return { autotiles: [] };
  }

  const autotileContent = autotileMatch[1];
  if (!autotileContent.trim()) {
    return { autotiles: [] };
  }

  // 解析 autotile 映射，格式如 "key": value 或 key:value
  // 我们只需要提取 key（文件名前缀）
  const autotiles = autotileContent
    .replace(/["']/g, "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => {
      // 提取冒号前的部分作为文件名
      const colonIndex = s.indexOf(":");
      return colonIndex > 0 ? s.slice(0, colonIndex).trim() : s.trim();
    })
    .filter((s) => s.length > 0);

  return { autotiles };
}

/**
 * 检测游戏版本
 * @param rootDir 游戏根目录
 * @returns 版本字符串 '2.x' 或 '3.x'
 */
export async function detectVersion(rootDir: string): Promise<"2.x" | "3.x"> {
  // 目前只支持 2.x 版本，未来可以通过检查特定文件或配置来判断版本
  try {
    const mainJsPath = join(rootDir, "main.js");
    await readFile(mainJsPath, "utf-8");

    // 检查是否有 3.x 版本的特征（预留）
    // 未来可以通过检查文件内容来判断版本

    return "2.x";
  } catch {
    return "2.x";
  }
}

/**
 * 解析 main.js 文件
 * @param filePath main.js 文件路径
 * @returns MainConfig 配置对象
 */
export async function parseMainJs(filePath: string): Promise<MainConfig> {
  try {
    const content = await readFile(filePath, "utf-8");
    return parseMainJs2X(content);
  } catch {
    throw new Error(`配置文件缺失：main.js`);
  }
}

/**
 * 解析 data.js 文件
 * @param filePath data.js 文件路径
 * @returns GameData 游戏数据对象
 */
export async function parseDataJs(filePath: string): Promise<GameData> {
  try {
    const content = await readFile(filePath, "utf-8");
    return parseDataJs2X(content);
  } catch {
    throw new Error(`配置文件缺失：data.js`);
  }
}

/**
 * 解析 icons.js 文件
 * @param filePath icons.js 文件路径
 * @returns IconsData 图标数据对象
 */
export async function parseIconsJs(filePath: string): Promise<IconsData> {
  try {
    const content = await readFile(filePath, "utf-8");
    return parseIconsJs2X(content);
  } catch {
    throw new Error(`配置文件缺失：icons.js`);
  }
}
