import { IHookable, IHookBase } from '@/hook';

export interface IResourceIdentifier {
  /** 资源类型，由外部的枚举真正进行定义 */
  readonly type: number;
  /** 资源的标识符 */
  readonly id: string;
}

export interface IResource<T> {
  /** 资源标识符 */
  readonly identifier: IResourceIdentifier;

  /**
   * 请求资源内容
   */
  request(): Promise<T>;

  /**
   * 写入资源内容
   * @param data 要写入的资源内容
   */
  write(data: T): Promise<void>;
}

export interface IResourceInjection {
  /**
   * 请求指定资源的资源内容
   * @param id 资源标识符
   */
  requestResource<T>(id: IResourceIdentifier): Promise<T>;

  /**
   * 请求指定资源类型的资源标识符列表
   * @param type 资源类型
   */
  requestResourceList(type: number): Promise<readonly IResourceIdentifier[]>;

  /**
   * 向指定资源写入资源内容
   * @param id 资源标识符
   * @param content 要写入的资源内容
   */
  writeResource(id: IResourceIdentifier, content: unknown): Promise<void>;

  /**
   * 创建新的资源
   * @param id 资源标识符
   * @param content 资源的初始内容
   */
  createResource(id: IResourceIdentifier, content: unknown): Promise<void>;

  /**
   * 删除指定资源
   * @param id 资源标识符
   */
  deleteResource(id: IResourceIdentifier): Promise<void>;
}

export interface IResourceSystemHooks extends IHookBase {
  /**
   * 当资源更新时触发，需要重新手动申请指定资源以获取更新后的资源内容
   * @param id 资源标识符
   */
  onUpdateResource?(id: IResourceIdentifier): Promise<void>;

  /**
   * 当更新资源列表时触发，需要重新手动申请指定类型的资源列表以获取更新后的列表
   * @param type 资源类型
   */
  onUpdateResourceList?(type: number): Promise<void>;
}

export interface IResourceSystem extends IHookable<IResourceSystemHooks> {
  /**
   * 初始化并注入资源实现对象
   * @param injection 资源注入对象
   */
  initialize(injection: IResourceInjection): Promise<void>;

  /**
   * 更新指定资源，系统会重新请求资源以获取其更新后的内容
   * @param id 资源标识符
   */
  updateResource(id: IResourceIdentifier): Promise<void>;

  /**
   * 更新指定资源类型的资源列表，系统会重新请求资源列表以获取其更新后的内容
   * @param type 资源类型
   */
  updateResourceList(type: number): Promise<void>;
}
