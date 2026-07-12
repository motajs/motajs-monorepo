import { mkdir, rm, cp, stat } from "node:fs/promises";
import { existsSync } from "node:fs";

/**
 * 确保目录存在，如果不存在则创建
 * @param dirPath 目录路径
 */
export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

/**
 * 复制目录及其内容
 * @param src 源目录
 * @param dest 目标目录
 */
export async function copyDir(src: string, dest: string): Promise<void> {
  await cp(src, dest, { recursive: true });
}

/**
 * 删除目录及其内容
 * @param dirPath 目录路径
 */
export async function removeDir(dirPath: string): Promise<void> {
  if (existsSync(dirPath)) {
    await rm(dirPath, { recursive: true, force: true });
  }
}

/**
 * 检查路径是否存在
 * @param path 路径
 * @returns 是否存在
 */
export function exists(path: string): boolean {
  return existsSync(path);
}

/**
 * 获取文件大小
 * @param filePath 文件路径
 * @returns 文件大小（字节）
 */
export async function getFileSize(filePath: string): Promise<number> {
  const stats = await stat(filePath);
  return stats.size;
}
