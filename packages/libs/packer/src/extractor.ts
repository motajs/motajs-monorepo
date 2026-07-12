import { tmpdir } from "node:os";
import { join } from "node:path";
import { readdir, stat, access } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { extractZip } from "./utils/zip-utils";
import { ensureDir, removeDir } from "./utils/file-utils";

/**
 * 解压结果
 */
export interface ExtractResult {
  /** 临时目录路径 */
  tempDir: string;
  /** 游戏根目录路径（包含 main.js） */
  rootDir: string;
}

/**
 * 检查文件是否存在
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 递归查找包含 main.js 的目录
 * @param dir 起始目录
 * @param maxDepth 最大搜索深度
 * @returns 包含 main.js 的目录路径，未找到返回 null
 */
async function findMainJsDir(dir: string, maxDepth: number = 5): Promise<string | null> {
  if (maxDepth <= 0) return null;

  // 检查当前目录是否包含 main.js
  const mainJsPath = join(dir, "main.js");
  if (await fileExists(mainJsPath)) {
    return dir;
  }

  // 递归搜索子目录
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const subDir = join(dir, entry.name);
        const result = await findMainJsDir(subDir, maxDepth - 1);
        if (result) return result;
      }
    }
  } catch {
    // 目录读取失败，跳过
  }

  return null;
}

/**
 * 定位游戏根目录（包含 main.js 的目录）
 * @param extractedDir 解压后的目录
 * @returns 游戏根目录路径
 * @throws 如果找不到 main.js
 */
export async function findRootDir(extractedDir: string): Promise<string> {
  const rootDir = await findMainJsDir(extractedDir);

  if (!rootDir) {
    throw new Error("找不到游戏根目录（缺少 main.js）");
  }

  return rootDir;
}

/**
 * 解压 ZIP 文件到临时目录并定位游戏根目录
 * @param zipPath ZIP 文件路径
 * @returns 解压结果，包含临时目录和游戏根目录
 * @throws 如果 ZIP 文件不存在、无效或找不到游戏根目录
 */
export async function extract(zipPath: string): Promise<ExtractResult> {
  // 检查 ZIP 文件是否存在
  if (!(await fileExists(zipPath))) {
    throw new Error(`压缩文件不存在：${zipPath}`);
  }

  // 检查是否为文件
  try {
    const stats = await stat(zipPath);
    if (!stats.isFile()) {
      throw new Error(`不是有效的 ZIP 文件：${zipPath}`);
    }
  } catch (err) {
    if ((err as Error).message.includes("不是有效的")) {
      throw err;
    }
    throw new Error(`压缩文件不存在：${zipPath}`);
  }

  // 创建临时目录
  const tempDir = join(tmpdir(), `mota-builder-${randomUUID()}`);
  await ensureDir(tempDir);

  try {
    // 解压 ZIP 文件（extractZip 已处理 GBK 编码）
    await extractZip(zipPath, tempDir);

    // 定位游戏根目录
    const rootDir = await findRootDir(tempDir);

    return { tempDir, rootDir };
  } catch (err) {
    // 解压或查找失败时清理临时目录
    await removeDir(tempDir);

    // 重新抛出错误
    const message = (err as Error).message;
    if (message.includes("找不到游戏根目录") || message.includes("压缩文件")) {
      throw err;
    }

    // JSZip 错误通常表示文件损坏或无效
    if (message.includes("Invalid") || message.includes("Corrupted") || message.includes("not a valid")) {
      throw new Error(`ZIP 文件已损坏：${zipPath}`);
    }

    throw new Error(`不是有效的 ZIP 文件：${zipPath}`);
  }
}
