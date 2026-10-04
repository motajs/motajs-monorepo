import { IResource, IResourceIdentifier } from './types';

export interface IResourceAccess {
  /**
   * 请求指定资源
   * @param id 资源标识符
   */
  requestResource<T>(id: IResourceIdentifier): Promise<IResource<T> | null>;

  /**
   * 获取指定资源类型的资源列表
   * @param type 资源类型
   */
  requestResourceList(type: number): Promise<readonly IResourceIdentifier[]>;

  /**
   * 创建新的资源
   * @param id 资源标识符
   * @param content 资源的初始内容
   */
  createResource<T>(id: IResourceIdentifier, content: T): Promise<IResource<T>>;

  /**
   * 删除指定资源
   * @param id 资源标识符
   */
  deleteResource(id: IResourceIdentifier): Promise<void>;
}
