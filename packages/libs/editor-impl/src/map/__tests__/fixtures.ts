import { EditorCore, EditorEntryKind, IEditorDirectoryEntry, IEditorFileSystem } from '@motajs/editor-core';
import { IMapDirections, IMapDocument, IMapLayer, IMapTileEntry, IMapTileGroup } from '../types';

// 地图测试共享的测试替身与样例构造器。
// FakeFileSystem 与表格 / 素材侧的同类替身同形（按路径存内容、文本 / 二进制、越界抛错），但按「能力互不依赖」
// 门禁要求自持一份，不跨能力借用；createMapHarness 按注入的文件系统装配一个已初始化的 EditorCore。

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
 * @param fs 内存文件系统替身
 * @param maxUndoStep 最大撤回步数，缺省 100；0 表示禁用撤销
 * @returns 已初始化的编辑器核心；面板类型由各测试自己注册，这里不注册任何类型
 */
export async function createMapHarness(fs: FakeFileSystem, maxUndoStep: number = 100): Promise<EditorCore> {
  const core = new EditorCore();

  await core.initialize({ fs, maxUndoStep });
  return core;
}

/**
 * 造一份四方向都可通行的通行属性
 * @returns 四方向都为 true 的通行属性
 */
function createOpenDirections(): IMapDirections {
  return { up: true, right: true, down: true, left: true };
}

/**
 * 造一份四方向都不可通行的通行属性
 * @returns 四方向都为 false 的通行属性
 */
function createBlockedDirections(): IMapDirections {
  return { up: false, right: false, down: false, left: false };
}

/**
 * 造一个图块条目；裁切矩形按「列 / 行 × 32 像素」推导，方便测试直接断言
 * @param number 图块编号
 * @param column 图集列号
 * @param row 图集行号
 * @param blocked 为 true 时该图块四方向都不可通行
 * @returns 图块条目
 */
function createTileEntry(number: number, column: number, row: number, blocked: boolean = false): IMapTileEntry {
  const directions = blocked ? createBlockedDirections() : createOpenDirections();

  return {
    number,
    column,
    row,
    crop: { x: column * 32, y: row * 32, width: 32, height: 32 },
    name: `图块 ${number}`,
    pass: { out: directions, in: createOpenDirections(), onlyEventLayer: false },
  };
}

/**
 * 造一个 2 列 × 2 行的完整矩形图块分组：四个图块，其中编号 4 的图块四方向全阻
 * @param overrides 覆盖分组字段（如 id / imagePath）
 * @returns 合法的图块分组
 */
export function createTileGroup(overrides: Partial<IMapTileGroup> = {}): IMapTileGroup {
  const tiles: readonly IMapTileEntry[] = [
    createTileEntry(1, 0, 0),
    createTileEntry(2, 1, 0),
    createTileEntry(3, 0, 1),
    createTileEntry(4, 1, 1, true),
  ];

  return { id: 'group-tiles', name: '图块分组', imagePath: 'content/map/tiles.png', columns: 2, tiles, ...overrides };
}

/**
 * 造一张 4 × 3、两层、带 5 个图块（编号 1..5，分两组）的合法地图文档
 * @param overrides 覆盖文档字段（如 width / height / layers）
 * @returns 合法的中立地图文档
 */
export function createMapDocument(overrides: Partial<IMapDocument> = {}): IMapDocument {
  const baseLayer: IMapLayer = {
    id: 'layer-base',
    name: '基础层',
    zIndex: 0,
    isEventLayer: false,
    cells: [
      [1, 2, 0, 3],
      [0, 4, 5, 0],
      [1, 1, 0, 0],
    ],
  };
  const upperLayer: IMapLayer = {
    id: 'layer-upper',
    name: '上层',
    zIndex: 1,
    isEventLayer: false,
    cells: [
      [0, 0, 0, 0],
      [0, 3, 0, 0],
      [0, 0, 0, 0],
    ],
  };
  const firstGroup: IMapTileGroup = {
    id: 'group-a',
    name: '分组 A',
    imagePath: 'content/map/tiles-a.png',
    columns: 2,
    tiles: [createTileEntry(1, 0, 0), createTileEntry(2, 1, 0)],
  };
  const secondGroup: IMapTileGroup = {
    id: 'group-b',
    name: '分组 B',
    imagePath: 'content/map/tiles-b.png',
    columns: 2,
    tiles: [createTileEntry(3, 0, 0), createTileEntry(4, 1, 0), createTileEntry(5, 0, 1)],
  };

  return {
    id: 'map-sample',
    name: '样例地图',
    width: 4,
    height: 3,
    layers: [baseLayer, upperLayer],
    tileGroups: [firstGroup, secondGroup],
    ...overrides,
  };
}

/**
 * 造一张指定尺寸、单层、每格都是图块 1 的大地图，用于视口与大地图用例
 * @param width 地图宽度（格子数）
 * @param height 地图高度（格子数）
 * @returns 指定尺寸的大地图文档
 */
export function createWideMapDocument(width: number, height: number): IMapDocument {
  const cells: number[][] = [];

  for (let y = 0; y < height; y += 1) {
    const row: number[] = [];

    for (let x = 0; x < width; x += 1) row.push(1);

    cells.push(row);
  }

  return {
    id: 'map-wide',
    name: '大地图',
    width,
    height,
    layers: [{ id: 'layer-wide', name: '整图', zIndex: 0, isEventLayer: false, cells }],
    tileGroups: [createTileGroup()],
  };
}
