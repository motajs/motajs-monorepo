import { IContentHandler } from '../resources/types';

export interface IPatchableResource<T> {
  /** 资源身份（路径）。 */
  readonly path: string;

  /**
   * 取底层文本内容处理器，用于读取与替换原始文本。
   *
   * @returns 底层文本内容处理器。
   */
  raw(): IContentHandler<string>;

  /**
   * 以 recipe 就地改写内容，返回改写完成的 Promise。
   *
   * @param recipe 就地改写草稿的配方。
   * @returns 改写完成的 Promise。
   */
  mutate(recipe: (draft: T) => void): Promise<void>;
}
