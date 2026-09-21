/**
 * MemoryFileSystem - 内存文件系统（测试用）
 *
 * 提供与真实文件系统相同的接口，但数据存储在内存中
 */

import type { FileEncoding, Fs, FsPromiseApi } from '@/services/fs';

export class MemoryFileSystem {
  private files = new Map<string, string>();
  private writeDelay = 0; // 模拟写入延迟（毫秒）
  private writeCount = 0; // 写入次数计数器
  private writeError: Error | null = null; // 模拟写入错误
  private writeErrors = new Map<string, Error>(); // 按路径模拟写入错误

  /**
   * 设置写入延迟（用于测试并发写入）
   */
  setWriteDelay(ms: number): void {
    this.writeDelay = ms;
  }

  /**
   * 获取写入次数
   */
  getWriteCount(): number {
    return this.writeCount;
  }

  /**
   * 设置写入错误（用于测试错误处理）
   */
  setWriteError(error: Error): void {
    this.writeError = error;
  }

  /**
   * 设置指定路径的写入错误（用于测试错误隔离）
   */
  setWriteErrorForPath(path: string, error: Error): void {
    this.writeErrors.set(path, error);
  }

  /**
   * 清除写入错误
   */
  clearWriteError(): void {
    this.writeError = null;
  }

  /**
   * 清除指定路径的写入错误
   */
  clearWriteErrorForPath(path: string): void {
    this.writeErrors.delete(path);
  }

  /**
   * 读取文件
   */
  async readFile(path: string, encoding: FileEncoding): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) {
      throw new Error(`File not found: ${path}`);
    }
    return content;
  }

  async readFileBinary(path: string): Promise<ArrayBuffer> {
    const content = await this.readFile(path, 'base64');
    const buffer = Buffer.from(content, 'base64');
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  }

  /**
   * 写入文件
   */
  async writeFile(path: string, content: string, encoding: FileEncoding): Promise<void> {
    // 增加写入计数
    this.writeCount++;

    const pathError = this.writeErrors.get(path);
    if (pathError) {
      throw pathError;
    }

    // 模拟写入错误
    if (this.writeError) {
      throw this.writeError;
    }

    // 模拟写入延迟
    if (this.writeDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.writeDelay));
    }

    this.files.set(path, content);
  }

  /**
   * 删除文件
   */
  async deleteFile(path: string): Promise<void> {
    if (!this.files.has(path)) {
      throw new Error(`File not found: ${path}`);
    }
    this.files.delete(path);
  }

  /**
   * 列出目录
   */
  async readdir(path: string): Promise<string[]> {
    const files: string[] = [];
    for (const filePath of this.files.keys()) {
      if (filePath.startsWith(path)) {
        files.push(filePath);
      }
    }
    return files;
  }

  /**
   * 创建目录（空操作）
   */
  async mkdir(path: string): Promise<void> {
    // 内存文件系统不需要创建目录
  }

  /**
   * 移动文件
   */
  async moveFile(src: string, dest: string): Promise<void> {
    const content = this.files.get(src);
    if (content === undefined) {
      throw new Error(`File not found: ${src}`);
    }
    this.files.set(dest, content);
    this.files.delete(src);
  }

  // ==================== 测试辅助方法 ====================

  /**
   * 设置文件内容（测试用）
   */
  setFile(path: string, content: string): void {
    this.files.set(path, content);
  }

  /**
   * 获取文件内容（测试用）
   */
  getFile(path: string): string | undefined {
    return this.files.get(path);
  }

  /**
   * 检查文件是否存在
   */
  hasFile(path: string): boolean {
    return this.files.has(path);
  }

  /**
   * 清空所有文件
   */
  clear(): void {
    this.files.clear();
  }

  /**
   * 获取文件数量
   */
  get size(): number {
    return this.files.size;
  }

  // ==================== 创建 fs 兼容接口 ====================

  /**
   * 创建与 fs 模块兼容的接口
   */
  createFsInterface(): Fs {
    const promises: FsPromiseApi = {
      readFile: this.readFile.bind(this),
      readFileBinary: this.readFileBinary.bind(this),
      writeFile: this.writeFile.bind(this),
      deleteFile: this.deleteFile.bind(this),
      readdir: this.readdir.bind(this),
      mkdir: this.mkdir.bind(this),
      moveFile: this.moveFile.bind(this),
      writeMultiFiles: async (filenames: string[], dataList: string[]) => {
        for (let i = 0; i < filenames.length; i++) {
          await this.writeFile(filenames[i], dataList[i], 'utf-8');
        }
      },
    };

    return {
      readFile: (filename, encoding, callback) => {
        this.readFile(filename, encoding)
          .then((data) => callback(null, data))
          .catch((err) => callback(err.message));
      },
      writeFile: (filename, data, encoding, callback) => {
        this.writeFile(filename, data, encoding)
          .then(() => callback(null))
          .catch((err) => callback(err.message));
      },
      deleteFile: (path, callback) => {
        this.deleteFile(path)
          .then(() => callback(null))
          .catch((err) => callback(err.message));
      },
      readdir: (path, callback) => {
        this.readdir(path)
          .then((files) => callback(null, files))
          .catch((err) => callback(err.message));
      },
      mkdir: (path, callback) => {
        this.mkdir(path)
          .then(() => callback(null))
          .catch((err) => callback(err.message));
      },
      moveFile: (src, dest, callback) => {
        this.moveFile(src, dest)
          .then(() => callback(null))
          .catch((err) => callback(err.message));
      },
      writeMultiFiles: (filenames, dataList, callback) => {
        promises
          .writeMultiFiles(filenames, dataList)
          .then(() => callback(null))
          .catch((err) => callback(err.message));
      },
      promises,
    };
  }
}
