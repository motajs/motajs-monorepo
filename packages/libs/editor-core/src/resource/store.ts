import { IResourceIdentifier } from './types';

export interface IResourceStore {
  /**
   * 读取指定资源的内容
   * @param id 资源标识符
   */
  readContent<T>(id: IResourceIdentifier): Promise<T>;

  /**
   * 写入指定资源的内容
   * @param id 资源标识符
   * @param data 要写入的资源内容
   */
  writeContent<T>(id: IResourceIdentifier, data: T): Promise<void>;
}
