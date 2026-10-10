export interface IEditorFileSystem {
  /**
   * 读取指定路径的文本文件
   * @param path 文件路径
   * @returns 文件文本内容
   */
  readFile(path: string): Promise<string>;

  /**
   * 写入指定路径的文本文件
   * @param path 文件路径
   * @param data 要写入的文本内容
   */
  writeFile(path: string, data: string): Promise<void>;

  /**
   * 列出指定目录下的条目名称
   * @param path 目录路径
   * @returns 目录下的条目名称列表
   */
  listDirectory(path: string): Promise<readonly string[]>;

  /**
   * 创建指定目录
   * @param path 目录路径
   */
  makeDirectory(path: string): Promise<void>;

  /**
   * 移动文件
   * @param source 源路径
   * @param destination 目标路径
   */
  moveFile(source: string, destination: string): Promise<void>;

  /**
   * 删除指定路径的文件
   * @param path 文件路径
   */
  deleteFile(path: string): Promise<void>;
}
