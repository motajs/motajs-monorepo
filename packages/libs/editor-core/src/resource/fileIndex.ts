import { EditorEntryKind, IEditorFileSystem } from '../fs';
import { IFileEntry, IFileIndex } from './types';

// 项目文件索引：初始化时递归全扫项目建成内存目录树，仅存结构（路径 / 文件 / 目录），不预读文件内容。

interface IFileIndexNode {
  /** 节点末段名 */
  name: string;
  /** 节点完整路径 */
  path: string;
  /** 节点是文件还是目录 */
  kind: EditorEntryKind;
  /** 目录的子节点：子名 → 节点；文件恒为空 */
  readonly children: Map<string, IFileIndexNode>;
}

/**
 * 取路径的末段名
 * @param path 完整路径
 * @returns 末段名
 */
function baseName(path: string): string {
  const index = path.lastIndexOf('/');

  return index === -1 ? path : path.slice(index + 1);
}

/**
 * 取路径的父目录路径，顶层返回空串
 * @param path 完整路径
 * @returns 父目录路径
 */
function parentPath(path: string): string {
  const index = path.lastIndexOf('/');

  return index === -1 ? '' : path.slice(0, index);
}

/**
 * 把一个忽略模式编译为匹配整段条目名的正则，`*` 通配为任意字符
 * @param pattern 忽略模式
 * @returns 匹配整段条目名的正则
 */
function compileIgnorePattern(pattern: string): RegExp {
  const parts = pattern.split('*').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  return new RegExp(`^${parts.join('.*')}$`);
}

/**
 * 新建一个索引节点
 * @param name 节点末段名
 * @param path 节点完整路径
 * @param kind 节点是文件还是目录
 * @returns 新建的索引节点
 */
function createNode(name: string, path: string, kind: EditorEntryKind): IFileIndexNode {
  return { name, path, kind, children: new Map() };
}

export class FileIndex implements IFileIndex {
  /** 根目录节点，路径为空串 */
  private readonly root: IFileIndexNode = createNode('', '', EditorEntryKind.Directory);
  /** 完整路径到节点的索引，含根节点 */
  private readonly nodes: Map<string, IFileIndexNode> = new Map();

  constructor() {
    this.nodes.set('', this.root);
  }

  async initialize(fs: IEditorFileSystem, ignore: readonly string[]): Promise<void> {
    this.clear();

    const patterns = ignore.map(compileIgnorePattern);

    await this.buildDirectory(fs, this.root, patterns);
  }

  list(path: string): readonly IFileEntry[] {
    const node = this.nodes.get(path);

    if (!node) return [];

    const entries: IFileEntry[] = [];

    for (const child of node.children.values()) {
      entries.push({ path: child.path, name: child.name, kind: child.kind });
    }

    return entries;
  }

  has(path: string): boolean {
    return this.nodes.has(path);
  }

  insert(path: string, kind: EditorEntryKind): void {
    if (path === '' || this.nodes.has(path)) return;

    const parent = this.ensureDirectory(parentPath(path));
    const name = baseName(path);
    const node = createNode(name, path, kind);

    parent.children.set(name, node);
    this.nodes.set(path, node);
  }

  remove(path: string): void {
    if (path === '' || !this.nodes.has(path)) return;

    const node = this.nodes.get(path);
    const parent = this.nodes.get(parentPath(path));

    if (parent && node) parent.children.delete(node.name);

    if (node) this.removeSubtree(node);
  }

  move(source: string, destination: string): void {
    if (source === '' || destination === '' || source === destination) return;

    const node = this.nodes.get(source);

    if (!node) return;

    if (this.nodes.has(destination)) this.remove(destination);

    const parent = this.nodes.get(parentPath(source));

    if (parent) parent.children.delete(node.name);

    const destinationParent = this.ensureDirectory(parentPath(destination));

    this.relocate(node, destination, destinationParent);
  }

  clear(): void {
    this.root.children.clear();
    this.nodes.clear();
    this.nodes.set('', this.root);
  }

  /**
   * 递归读取一个目录的直接子条目并登记到索引
   * @param fs 宿主注入的文件系统实现
   * @param parent 当前目录节点
   * @param patterns 编译后的忽略模式
   */
  private async buildDirectory(
    fs: IEditorFileSystem,
    parent: IFileIndexNode,
    patterns: readonly RegExp[],
  ): Promise<void> {
    const entries = await fs.listDirectory(parent.path);

    for (const entry of entries) {
      if (this.isIgnored(entry.name, patterns)) continue;

      const path = parent.path === '' ? entry.name : `${parent.path}/${entry.name}`;
      const node = createNode(entry.name, path, entry.kind);

      parent.children.set(entry.name, node);
      this.nodes.set(path, node);

      if (entry.kind === EditorEntryKind.Directory) await this.buildDirectory(fs, node, patterns);
    }
  }

  /**
   * 依次补齐一个目录路径上的各级目录节点，已存在则直接返回
   * @param path 目录路径
   * @returns 该目录的节点
   */
  private ensureDirectory(path: string): IFileIndexNode {
    const existing = this.nodes.get(path);

    if (existing) return existing;

    const parent = this.ensureDirectory(parentPath(path));
    const name = baseName(path);
    const node = createNode(name, path, EditorEntryKind.Directory);

    parent.children.set(name, node);
    this.nodes.set(path, node);

    return node;
  }

  /**
   * 把一个节点连同其子树整体挂到新父目录下，并重写子树内所有路径
   * @param node 被搬迁的节点
   * @param path 节点的新路径
   * @param parent 节点的新父目录节点
   */
  private relocate(node: IFileIndexNode, path: string, parent: IFileIndexNode): void {
    this.nodes.delete(node.path);

    const name = baseName(path);

    node.name = name;
    node.path = path;
    parent.children.set(name, node);
    this.nodes.set(path, node);

    for (const child of node.children.values()) this.relocate(child, `${path}/${child.name}`, node);
  }

  /**
   * 从索引里递归摘除一个节点及其整棵子树
   * @param node 被摘除的节点
   */
  private removeSubtree(node: IFileIndexNode): void {
    for (const child of node.children.values()) this.removeSubtree(child);

    node.children.clear();
    this.nodes.delete(node.path);
  }

  /**
   * 判断一个条目名是否命中任一忽略模式
   * @param name 条目末段名
   * @param patterns 编译后的忽略模式
   * @returns 命中任一模式时为 true
   */
  private isIgnored(name: string, patterns: readonly RegExp[]): boolean {
    return patterns.some((pattern) => pattern.test(name));
  }
}
