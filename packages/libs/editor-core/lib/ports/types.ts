export interface IFsPort {
  /** 以文本或 base64 读取一个文件；文件缺失时按上述契约拒绝。 */
  readFile(path: string, encoding: 'utf-8' | 'base64'): Promise<string>;

  /** 以二进制读取一个文件；文件缺失时按上述契约拒绝。 */
  readFileBinary(path: string): Promise<ArrayBuffer>;

  /** 写入一个文件。 */
  writeFile(path: string, data: string, encoding: 'utf-8' | 'base64'): Promise<void>;

  /** 删除一个文件。 */
  deleteFile(path: string): Promise<void>;

  /** 列出目录内容。 */
  readdir(path: string): Promise<string[]>;

  /** 创建目录。 */
  mkdir(path: string): Promise<void>;

  /** 移动/重命名。 */
  moveFile(src: string, dest: string): Promise<void>;
}

export interface IHostPort {
  /** 必需端点的逻辑名 → URL。 */
  readonly endpoints: Readonly<Record<'fs' | 'runtime' | 'preview' | 'project', string>>;

  /** 可选的文档端点。 */
  readonly docs?: string;

  /** 可选的自更新端点。 */
  readonly update?: string;
}

export interface IPreviewAdapter {
  /** 适配器实现的契约版本。 */
  readonly apiVersion: string;
}

export interface ResourceDependencies {
  /** per-instance 文件层槽位；core 只声明为 unknown，由默认实现层在构造处收窄。 */
  readonly fileHandlers: unknown;
}

export enum PreloadStrategy {
  // 立即加载
  Eager = 0,
  // 惰性加载
  Lazy = 1,
  // 按需加载
  OnDemand = 2,
}

export interface ResourceDescriptor<TView = unknown> {
  /** 逻辑 id；与 ResourceRegistry 共用同一语法（isValidResourceId）。 */
  readonly id: string;

  /** 唯一的构造缝：给定依赖返回视图（可异步）；TView 是视图类型、由消费方指定。 */
  readonly create: (deps: ResourceDependencies) => TView | Promise<TView>;

  /** 可选加载策略；缺省语义由消费方决定（本阶段不定义默认值）。 */
  readonly preload?: PreloadStrategy;

  /** 可选依赖边：本资源 preload 前应先就绪的逻辑 id 列表。 */
  readonly preloadDependsOn?: readonly string[];
}

export interface EngineDescription {
  /** 引擎的逻辑 id。 */
  readonly id: string;
  /** 适配器实现的契约版本；缺省由 defineEngine 填入 ENGINE_ADAPTER_API_VERSION。 */
  readonly apiVersion?: string;
  /** 该引擎承载的资源描述符。 */
  readonly resources: readonly ResourceDescriptor[];
}

export interface IEngineAdapter {
  /** 适配器的逻辑身份。 */
  readonly id: string;

  /** 适配器实现的契约版本（defineEngine 缺省填入 ENGINE_ADAPTER_API_VERSION）。 */
  readonly apiVersion: string;

  /** 该适配器承载的资源描述符（按声明顺序）。 */
  readonly resources: readonly ResourceDescriptor[];
}
