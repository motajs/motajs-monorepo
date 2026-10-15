import { EditorEntryKind, IEditorDirectoryEntry } from '@motajs/editor-core';
import { IMemoryBackend } from './types';

// 开发宿主的内存文件系统：按路径存内容（文本或原始字节），供宿主以 fs 注入方式驱动编辑器核心。
// 仅用于本地开发验证、不随产品发布；越界（含 `..` 段）路径由本实现拒绝，契约与测试替身 FakeFileSystem 一致。
// `maxUndoStep` 一并暴露，令开发宿主可用同一个对象既作文件系统、又作撤销注入。

/**
 * 归一化目录路径：去掉首尾斜线，根目录归为空串
 * @param path 原始目录路径
 * @returns 归一化后的目录路径
 */
function normalizeDirectory(path: string): string {
  return path.replace(/^\/+/, '').replace(/\/+$/, '');
}

/**
 * 取路径的最后一段名
 * @param path 完整路径
 * @returns 末段名
 */
function baseName(path: string): string {
  const index = path.lastIndexOf('/');

  return index === -1 ? path : path.slice(index + 1);
}

/**
 * 取路径的父目录路径，根目录下返回空串
 * @param path 完整路径
 * @returns 父目录路径
 */
function parentDirectory(path: string): string {
  const index = path.lastIndexOf('/');

  return index === -1 ? '' : path.slice(0, index);
}

/**
 * 判断 child 是否位于 directory 之下（不要求直接子级）
 * @param directory 目录路径
 * @param child 候选路径
 * @returns child 更靠下时为 true
 */
function isUnder(directory: string, child: string): boolean {
  return directory === '' ? child.includes('/') : child.startsWith(`${directory}/`);
}

/**
 * 取 child 相对 directory 的首段名
 * @param directory 目录路径
 * @param child 位于其下的路径
 * @returns 首段名
 */
function firstSegmentUnder(directory: string, child: string): string {
  const remainder = directory === '' ? child : child.slice(directory.length + 1);
  const index = remainder.indexOf('/');

  return index === -1 ? remainder : remainder.slice(0, index);
}

/**
 * 计算 path 相对 base 的后缀：等于 base 时为 `''`，位于 base 之下时为 `/后缀`，否则为 null
 * @param base 基准路径
 * @param path 候选路径
 * @returns 相对后缀；不在 base 之下时为 null
 */
function relativeTo(base: string, path: string): string | null {
  if (path === base) return '';
  if (path.startsWith(`${base}/`)) return path.slice(base.length);

  return null;
}

export class MemoryBackend implements IMemoryBackend {
  readonly maxUndoStep: number = 100;

  /** 路径到文件内容的映射：文本为 string，二进制为 Uint8Array */
  private readonly content: Map<string, string | Uint8Array> = new Map();

  /** 显式创建的目录路径集合（空目录不在内容映射中体现） */
  private readonly directories: Set<string> = new Set();

  seed(path: string, content: string | Uint8Array): void {
    this.assertInBounds(path);
    this.content.set(path, content);
    this.registerParents(path);
  }

  async readFile(path: string): Promise<string> {
    const value = await this.read(path);

    if (typeof value !== 'string') throw new Error(`memory backend: not a text file: ${path}`);

    return value;
  }

  async writeFile(path: string, data: string): Promise<void> {
    this.write(path, data);
  }

  async readBinary(path: string): Promise<Uint8Array> {
    const value = await this.read(path);

    if (!(value instanceof Uint8Array)) throw new Error(`memory backend: not a binary file: ${path}`);

    return value;
  }

  async writeBinary(path: string, data: Uint8Array): Promise<void> {
    this.write(path, data);
  }

  async listDirectory(path: string): Promise<readonly IEditorDirectoryEntry[]> {
    this.assertInBounds(path);
    const directory = normalizeDirectory(path);
    const kinds: Map<string, EditorEntryKind> = new Map();

    for (const filePath of this.content.keys()) {
      this.collectEntry(directory, filePath, EditorEntryKind.File, kinds);
    }

    for (const dirPath of this.directories) {
      this.collectEntry(directory, dirPath, EditorEntryKind.Directory, kinds);
    }

    const entries: IEditorDirectoryEntry[] = [];

    for (const [name, kind] of kinds) entries.push({ name, kind });

    return entries;
  }

  async makeDirectory(path: string): Promise<void> {
    this.assertInBounds(path);
    const directory = normalizeDirectory(path);

    if (directory === '') return;

    this.directories.add(directory);
    this.registerParents(directory);
  }

  async moveFile(source: string, destination: string): Promise<void> {
    this.assertInBounds(source);
    this.assertInBounds(destination);
    const files: Array<readonly [string, string, string | Uint8Array]> = [];

    for (const [path, value] of this.content) {
      const suffix = relativeTo(source, path);

      if (suffix !== null) files.push([path, `${destination}${suffix}`, value]);
    }

    if (files.length === 0) throw new Error(`memory backend: file not found: ${source}`);

    const directories: Array<readonly [string, string]> = [];

    for (const directory of this.directories) {
      const suffix = relativeTo(source, directory);

      if (suffix !== null) directories.push([directory, `${destination}${suffix}`]);
    }

    for (const [path] of files) this.content.delete(path);

    for (const directory of directories) this.directories.delete(directory);

    for (const [, nextPath, value] of files) {
      this.content.set(nextPath, value);
      this.registerParents(nextPath);
    }

    for (const [, nextDirectory] of directories) {
      this.directories.add(nextDirectory);
      this.registerParents(nextDirectory);
    }
  }

  async deleteFile(path: string): Promise<void> {
    this.assertInBounds(path);
    this.content.delete(path);
  }

  /**
   * 读取指定路径的内容，并做越界校验
   * @param path 文件路径
   * @returns 文件内容
   */
  private async read(path: string): Promise<string | Uint8Array> {
    this.assertInBounds(path);

    const value = this.content.get(path);

    if (value === undefined) throw new Error(`memory backend: file not found: ${path}`);

    return value;
  }

  /**
   * 写入指定路径的内容，并做越界校验
   * @param path 文件路径
   * @param data 要写入的内容
   */
  private write(path: string, data: string | Uint8Array): void {
    this.assertInBounds(path);
    this.content.set(path, data);
    this.registerParents(path);
  }

  /**
   * 把一条候选路径按「直接子条目」或「直接子目录」归入结果表
   * @param directory 归一化后的目录路径
   * @param candidate 候选文件 / 目录路径
   * @param selfKind 候选自身是文件还是目录（用于直接子条目）
   * @param kinds 结果表
   */
  private collectEntry(
    directory: string,
    candidate: string,
    selfKind: EditorEntryKind,
    kinds: Map<string, EditorEntryKind>,
  ): void {
    if (parentDirectory(candidate) === directory) {
      kinds.set(baseName(candidate), selfKind);
      return;
    }

    if (isUnder(directory, candidate)) {
      kinds.set(firstSegmentUnder(directory, candidate), EditorEntryKind.Directory);
    }
  }

  /**
   * 登记一个路径的各级父目录，保证父目录可被列出
   * @param path 文件或目录路径
   */
  private registerParents(path: string): void {
    let parent = parentDirectory(path);

    while (parent !== '') {
      if (this.directories.has(parent)) return;

      this.directories.add(parent);
      parent = parentDirectory(parent);
    }
  }

  /**
   * 校验路径未越出项目根；越界（含 `..` 段）由本实现负责拒绝
   * @param path 待校验路径
   */
  private assertInBounds(path: string): void {
    const segments = normalizeDirectory(path).split('/');

    if (segments.includes('..')) throw new Error(`memory backend: path escapes project root: ${path}`);
  }
}
