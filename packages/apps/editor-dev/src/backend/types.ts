import { IEditorFileSystem } from '@motajs/editor-core';

export interface IMemoryBackend extends IEditorFileSystem {
  /** 最大撤回步数；供开发宿主把它一并注入撤销系统 */
  readonly maxUndoStep: number;

  /**
   * 预置一个文件路径的初始内容，并保证其各级父目录可被列出
   * @param path 文件路径：相对项目根、以 `/` 分隔、无前导斜线
   * @param content 文件初始内容：文本或原始字节
   */
  seed(path: string, content: string | Uint8Array): void;
}
