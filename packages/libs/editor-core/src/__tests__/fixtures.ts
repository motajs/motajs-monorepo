import { EditorCore } from '../core';
import { EditorEntryKind, IEditorDirectoryEntry, IEditorFileSystem } from '../fs';

// 共享测试替身：内存文件系统与装配工厂。供 editor-core / editor-impl / editor-dev 复用，收敛迁移期的改动面。

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

export class FakeFileSystem implements IEditorFileSystem {
  /** 路径到文件内容的映射：文本为 string，二进制为 Uint8Array */
  private readonly content: Map<string, string | Uint8Array> = new Map();
  /** 显式创建的目录路径集合（空目录不在内容映射中体现） */
  private readonly directories: Set<string> = new Set();
  /** 读取 / 写入时应抛错的路径集合 */
  readonly failing: Set<string> = new Set();
  /** 读取 / 写入时应永久挂起的路径集合 */
  readonly hanging: Set<string> = new Set();

  /**
   * 预置一个文件路径的初始内容，并保证其各级父目录可被列出
   * @param path 文件路径
   * @param content 文件初始内容
   */
  seed(path: string, content: string | Uint8Array): void {
    this.assertInBounds(path);
    this.content.set(path, content);
    this.registerParents(path);
  }

  async readFile(path: string): Promise<string> {
    const value = await this.read(path);

    if (typeof value !== 'string') throw new Error(`fake fs: not a text file: ${path}`);

    return value;
  }

  async writeFile(path: string, data: string): Promise<void> {
    await this.write(path, data);
  }

  async readBinary(path: string): Promise<Uint8Array> {
    const value = await this.read(path);

    if (!(value instanceof Uint8Array)) throw new Error(`fake fs: not a binary file: ${path}`);

    return value;
  }

  async writeBinary(path: string, data: Uint8Array): Promise<void> {
    await this.write(path, data);
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
    const value = this.content.get(source);

    if (value === undefined) throw new Error(`fake fs: file not found: ${source}`);

    this.content.delete(source);
    this.content.set(destination, value);
    this.registerParents(destination);
  }

  async deleteFile(path: string): Promise<void> {
    this.assertInBounds(path);
    this.content.delete(path);
  }

  /**
   * 读取指定路径的内容，处理失败 / 挂起开关与越界校验
   * @param path 文件路径
   * @returns 文件内容
   */
  private async read(path: string): Promise<string | Uint8Array> {
    this.assertInBounds(path);

    if (this.hanging.has(path)) return new Promise<string | Uint8Array>(() => {});
    if (this.failing.has(path)) throw new Error(`fake fs: read failed: ${path}`);

    const value = this.content.get(path);

    if (value === undefined) throw new Error(`fake fs: file not found: ${path}`);

    return value;
  }

  /**
   * 写入指定路径的内容，处理失败 / 挂起开关与越界校验
   * @param path 文件路径
   * @param data 要写入的内容
   */
  private async write(path: string, data: string | Uint8Array): Promise<void> {
    this.assertInBounds(path);

    if (this.hanging.has(path)) return new Promise<void>(() => {});
    if (this.failing.has(path)) throw new Error(`fake fs: write failed: ${path}`);

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

    if (segments.includes('..')) throw new Error(`fake fs: path escapes project root: ${path}`);
  }
}

/**
 * 按注入的文件系统装配一个已初始化的编辑器核心
 * @param fs 宿主文件系统实现
 * @param ignore 建索引时跳过的目录 / 文件模式列表
 * @returns 已初始化的编辑器核心
 */
export async function createCoreHarness(fs: FakeFileSystem, ignore?: readonly string[]): Promise<EditorCore> {
  const core = new EditorCore();

  await core.initialize({ fs, ignore, maxUndoStep: 100 });
  return core;
}
