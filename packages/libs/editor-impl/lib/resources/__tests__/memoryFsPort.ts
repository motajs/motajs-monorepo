import { IFsPort } from '@motajs/editor-core';

export class MemoryFsPort implements IFsPort {
  private readonly files = new Map<string, string>();
  private writeDelay = 0;
  private writeCount = 0;
  private writeError: Error | null = null;
  private readonly writeErrors = new Map<string, Error>();

  //#region 故障注入钩子

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

  //#endregion

  //#region IFsPort 实现（扁平七操作）

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

  //#endregion

  //#region 测试辅助

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

  //#endregion
}
