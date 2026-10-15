import { IHookable, IHookBase } from '../hook';
import { EditorEntryKind, IEditorFileSystem } from '../fs';

/** 资源的唯一标识，即相对项目根、以 `/` 分隔、无前导斜线的文件路径；资源相等即路径相等 */
export type IResourceIdentifier = string;

/** 资源内容的两种形态：原文（text）字符串或原始字节（binary）；core 不解析任何文件格式 */
export type ResourceContent = string | Uint8Array;

export interface IResource {
  /** 资源标识（纯路径） */
  readonly identifier: IResourceIdentifier;

  /**
   * 请求资源内容
   * @returns 资源的原文或原始字节；资源不存在时为 undefined
   */
  request(): Promise<ResourceContent | undefined>;

  /**
   * 写入资源内容
   * @param data 要写入的资源内容
   */
  write(data: ResourceContent): Promise<void>;
}

export interface IResourceAccess {
  /**
   * 请求指定资源
   * @param identifier 资源标识（纯路径）
   * @returns 资源句柄；资源不存在时为 null
   */
  requestResource(identifier: IResourceIdentifier): Promise<IResource | null>;

  /**
   * 创建新的资源
   * @param identifier 资源标识（纯路径）
   * @param content 资源的初始内容
   * @returns 新建的资源句柄；创建失败时为 null
   */
  createResource(identifier: IResourceIdentifier, content: ResourceContent): Promise<IResource | null>;

  /**
   * 删除指定资源
   * @param identifier 资源标识（纯路径）
   */
  deleteResource(identifier: IResourceIdentifier): Promise<void>;

  /**
   * 移动资源
   * @param source 源路径
   * @param destination 目标路径
   */
  moveResource(source: IResourceIdentifier, destination: IResourceIdentifier): Promise<void>;

  /**
   * 列出指定目录下的直接子条目
   * @param path 目录路径
   * @returns 目录下的直接子条目列表，供打开列表 / 目录树读取
   */
  listDirectory(path: string): Promise<readonly IFileEntry[]>;
}

export interface IResourceStore {
  /**
   * 读取指定资源的内容
   * @param identifier 资源标识（纯路径）
   * @returns 资源的原文或原始字节；资源不存在时为 undefined
   */
  readContent(identifier: IResourceIdentifier): Promise<ResourceContent | undefined>;

  /**
   * 写入指定资源的内容
   * @param identifier 资源标识（纯路径）
   * @param data 要写入的资源内容
   */
  writeContent(identifier: IResourceIdentifier, data: ResourceContent): Promise<void>;
}

export interface IResourceSystemHooks extends IHookBase {
  /**
   * 当资源更新时触发，需要重新手动申请指定资源以获取更新后的资源内容
   * @param identifier 资源标识（纯路径）
   */
  onUpdateResource?(identifier: IResourceIdentifier): Promise<void>;
}

export interface IResourceSystem extends IHookable<IResourceSystemHooks> {
  /**
   * 初始化并接入宿主注入的文件系统实现，递归全扫建索引
   * @param fs 宿主注入的文件系统实现
   * @param options 资源系统初始化选项，如索引忽略模式
   */
  initialize(fs: IEditorFileSystem, options?: IResourceSystemOptions): Promise<void>;

  /**
   * 更新指定资源，系统会重新请求资源以获取其更新后的内容
   * @param identifier 资源标识（纯路径）
   */
  updateResource(identifier: IResourceIdentifier): Promise<void>;

  /**
   * 释放此资源系统
   */
  dispose(): Promise<void>;
}

export interface IResourceSystemAccess extends IResourceSystem, IResourceAccess, IResourceStore {}
