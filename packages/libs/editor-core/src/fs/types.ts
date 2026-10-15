export const enum EditorEntryKind {
  /** 普通文件 */
  File,
  /** 目录 */
  Directory,
}

export interface IEditorDirectoryEntry {
  /** 条目名（末段），以 `/` 分隔、无前导斜线 */
  readonly name: string;
  /** 条目是文件还是目录 */
  readonly kind: EditorEntryKind;
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
}
