/**
 * 测试辅助函数
 */

import { FileHandler } from "@/fs/FileHandler";
import { FileHandlerManager } from "@/fs/FileHandlerManager";
import type { FileEncoding } from "@/services/fs";
import { MemoryFileSystem } from "./MemoryFileSystem";

/**
 * 创建测试用的 FileHandler
 */
export function createTestFileHandler(
  path: string,
  initialContent?: string,
  memoryFs?: MemoryFileSystem,
  encoding: FileEncoding = "base64",
): FileHandler {
  // 如果提供了初始内容，设置到内存文件系统
  if (initialContent !== undefined && memoryFs) {
    memoryFs.setFile(path, initialContent);
  }

  return new FileHandler(path, encoding);
}

/**
 * 等待一段时间
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 等待条件满足
 */
export async function waitFor(
  condition: () => boolean,
  timeout: number = 1000,
  interval: number = 10,
): Promise<void> {
  const startTime = Date.now();
  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error("waitFor timeout");
    }
    await wait(interval);
  }
}
