export const enum EditorEntryKind {
  /** 普通文件 */
  File,
  /** 目录 */
  Directory,
}

export const enum EditorFileChangeKind {
  /** 新增文件 */
  Add,
  /** 文件内容变化 */
  Change,
  /** 删除文件 */
  Delete,
}

export interface IEditorDirectoryEntry {
  /** 条目名（末段），以 `/` 分隔、无前导斜线 */
  readonly name: string;
  /** 条目是文件还是目录 */
  readonly kind: EditorEntryKind;
}

export interface IEditorFileChange {
  /** 变化文件的路径：相对项目根、以 `/` 分隔、无前导斜线、不含 `..` 段 */
  readonly path: string;
  /** 变化种类 */
  readonly kind: EditorFileChangeKind;
}

export interface IEditorFileSystem {
  /**
   * 读取指定路径的文本文件
   * @param path 文件路径：相对项目根、以 `/` 分隔、无前导斜线；越界（`..`）由本实现负责拒绝，core 只拼接
   * @returns 文件的文本内容
   */
  readFile(path: string): Promise<string>;

  /**
   * 写入指定路径的文本文件
   * @param path 文件路径：相对项目根、以 `/` 分隔、无前导斜线
   * @param data 要写入的文本内容
   */
  writeFile(path: string, data: string): Promise<void>;

  /**
   * 读取指定路径文件的原始字节
   * @param path 文件路径：相对项目根、以 `/` 分隔、无前导斜线
   * @returns 文件的原始字节
   */
  readBinary(path: string): Promise<Uint8Array>;

  /**
   * 写入指定路径文件的原始字节
   * @param path 文件路径：相对项目根、以 `/` 分隔、无前导斜线
   * @param data 要写入的原始字节
   */
  writeBinary(path: string, data: Uint8Array): Promise<void>;

  /**
   * 列出指定目录下的直接子条目
   * @param path 目录路径：相对项目根、以 `/` 分隔、无前导斜线
   * @returns 目录下的直接子条目列表，每个条目带名字与文件 / 目录类型
   */
  listDirectory(path: string): Promise<readonly IEditorDirectoryEntry[]>;

  /**
   * 创建指定目录
   * @param path 目录路径：相对项目根、以 `/` 分隔、无前导斜线
   */
  makeDirectory(path: string): Promise<void>;

  /**
   * 移动文件
   * @param source 源路径：相对项目根、以 `/` 分隔、无前导斜线
   * @param destination 目标路径：相对项目根、以 `/` 分隔、无前导斜线
   */
  moveFile(source: string, destination: string): Promise<void>;

  /**
   * 删除指定路径的文件
   * @param path 文件路径：相对项目根、以 `/` 分隔、无前导斜线
   */
  deleteFile(path: string): Promise<void>;

  /**
   * 订阅宿主文件变化流；宿主不提供时省略此成员，core 退化为只在切入时重读
   *
   * 每条事件对应一个文件，不保证顺序；路径必须是规范化相对路径（无前导 `/`、不含 `..` 段）。
   * 变化流需覆盖宿主观测到的全部变化，包括编辑器自己的写入。
   * @param listener 变化回调
   * @returns 退订函数
   */
  watch?(listener: (change: IEditorFileChange) => void): () => void;
}
