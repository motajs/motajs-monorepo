import { IContentHandler } from '../resources/interfaces';

/**
 * 编辑层（默认实现）对外类型的集中出口（D-08）。
 *
 * 只放「默认实现」自己的契约：内容怎么持有由各实现自己决定（D-03），这里不引入任何
 * 统一内容抽象，也不依赖表格层。
 */

/**
 * IPatchableResource<T> - 可被 patch 的资源的最小契约。
 *
 * 让 patch 操作只需认识「路径 + 原始内容处理器 + 就地改写入口」三件事，不必接触任何
 * 引擎或编辑器类型。它取代旧的 `PatchableResource`（改名在 05.1-06 收口）。
 */
export interface IPatchableResource<T> {
  /** 资源身份（路径）。 */
  readonly path: string;
  /** 取底层文本内容处理器，用于读取与替换原始文本。 */
  raw(): IContentHandler<string>;
  /** 以 recipe 就地改写内容，返回改写完成的 Promise。 */
  mutate(recipe: (draft: T) => void): Promise<void>;
}
