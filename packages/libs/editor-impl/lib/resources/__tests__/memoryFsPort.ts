import { IFsPort } from '@motajs/editor-core';

/**
 * MemoryFsPort —— core 测试用的扁平 `IFsPort` 内存替身（D-14）。
 *
 * 与 editor 的 `@test/utils/MemoryFileSystem` **刻意不同**：只实现扁平的七个 `IFsPort` 操作，
 * 不带 `promises` 命名空间，也不带回调半边。核心资源层只消费扁平面，因此这里不复制 editor
 * 的嵌套形状。四个故障注入钩子（写延迟 / 全局写错误 / 按路径写错误 / 写计数）与 editor 版本
 * 对齐，被搬入 core 的 `FileHandler` 系列测试需要它们。
 *
 * 契约（见 `@motajs/editor-core` 的 `lib/ports/fs.ts`）：读取缺失路径必须以一个 `message` 命中 `isFileNotFoundError`
 * 的 `Error` 拒绝——这里用 `file-not-found: <path>`。
 */

export class MemoryFsPort implements IFsPort {
  private readonly files = new Map<string, string>();
  private writeDelay = 0;
  private writeCount = 0;
  private writeError: Error | null = null;
  private readonly writeErrors = new Map<string, Error>();

  // ==================== 故障注入钩子 ====================

  /** 设置写入延迟（毫秒），用于测试并发写入的串行化。 */
  setWriteDelay(ms: number): void {
    this.writeDelay = ms;
  }

  /** 读取累计写入次数。 */
  getWriteCount(): number {
    return this.writeCount;
  }

  /** 设置全局写入错误。 */
  setWriteError(error: Error): void {
    this.writeError = error;
  }

  /** 设置指定路径的写入错误（用于测试错误隔离）。 */
  setWriteErrorForPath(path: string, error: Error): void {
    this.writeErrors.set(path, error);
  }

  /** 清除全局写入错误。 */
  clearWriteError(): void {
    this.writeError = null;
  }

  /** 清除指定路径的写入错误。 */
  clearWriteErrorForPath(path: string): void {
    this.writeErrors.delete(path);
  }

  // ==================== IFsPort 实现（扁平七操作） ====================

  async readFile(path: string): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) {
      throw new Error(`file-not-found: ${path}`);
    }
    return content;
  }

  async readFileBinary(path: string): Promise<ArrayBuffer> {
    const content = await this.readFile(path);
    const bytes = new TextEncoder().encode(content);
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.writeCount += 1;

    const pathError = this.writeErrors.get(path);
    if (pathError) {
      throw pathError;
    }

    if (this.writeError) {
      throw this.writeError;
    }

    if (this.writeDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.writeDelay));
    }

    this.files.set(path, content);
  }

  async deleteFile(path: string): Promise<void> {
    if (!this.files.has(path)) {
      throw new Error(`file-not-found: ${path}`);
    }
    this.files.delete(path);
  }

  async readdir(path: string): Promise<string[]> {
    const result: string[] = [];
    for (const filePath of this.files.keys()) {
      if (filePath.startsWith(path)) {
        result.push(filePath);
      }
    }
    return result;
  }

  async mkdir(): Promise<void> {
    // 内存文件系统不需要创建目录
  }

  async moveFile(src: string, dest: string): Promise<void> {
    const content = this.files.get(src);
    if (content === undefined) {
      throw new Error(`file-not-found: ${src}`);
    }
    this.files.set(dest, content);
    this.files.delete(src);
  }

  // ==================== 测试辅助 ====================

  /** 设置文件内容（测试用）。 */
  setFile(path: string, content: string): void {
    this.files.set(path, content);
  }

  /** 获取文件内容（测试用）。 */
  getFile(path: string): string | undefined {
    return this.files.get(path);
  }

  /** 检查文件是否存在。 */
  hasFile(path: string): boolean {
    return this.files.has(path);
  }

  /** 清空所有文件。 */
  clear(): void {
    this.files.clear();
  }

  /** 获取文件数量。 */
  get size(): number {
    return this.files.size;
  }
}
