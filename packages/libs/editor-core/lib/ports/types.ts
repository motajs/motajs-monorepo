// ports 层对外类型的集中出口（引擎无关，D-07）
// 这里汇总四个面向实现者的契约：文件层 `IFsPort`、宿主端点 `IHostPort`、预览 `IPreviewAdapter`，
// 以及引擎适配器 `IEngineAdapter` 及其资源描述符类型。它们各自有不同的消费者、在不同阶段长大
// （D-14）。本文件只做类型声明，不含任何逻辑或值，因此不可能与 `engine.ts` 的校验逻辑成环
// 只 import 本文件夹内的声明，绝不 import `engine.ts` 或 `../index`（会形成环，`no-circular` 会拒绝）

// 文件层契约：core 依赖的最小文件 I/O 子集，七个操作直接沿用 @motajs/editor 现有 FsPromiseApi 成员名
// 两条实现契约：(1) 读取缺失的文件必须以 Error 拒绝（code 为 'file-not-found' / 'ENOENT'，或命中
// isFileNotFoundError 识别的形状）；(2) 路径是不透明字符串，core 不做归一化或校验——路径安全属于宿主
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

// 宿主端点解析契约：成员名是宿主现有的逻辑端点名，core 不 import 任何宿主类型
// 这里只表达「端点在哪里」；core 不解析 DOM、不读环境全局、不发起传输（PORT-02 由静态门禁保证）
export interface IHostPort {
  /** 必需端点的逻辑名 → URL。 */
  readonly endpoints: Readonly<Record<'fs' | 'runtime' | 'preview' | 'project', string>>;

  /** 可选的文档端点。 */
  readonly docs?: string;

  /** 可选的自更新端点。 */
  readonly update?: string;
}

// 预览适配器的最小占位：只留一个非空成员，使接口是真实契约而非空壳；
// 预览的启动钩子由 Phase 11 通过一次显式的接口演进扩充
export interface IPreviewAdapter {
  /** 适配器实现的契约版本。 */
  readonly apiVersion: string;
}

// 描述符 create(deps) 收到的依赖：刻意最小，只有 per-instance 文件层；非文件资源完全不碰它
export interface ResourceDependencies {
  /** per-instance 文件层槽位；core 只声明为 unknown，由默认实现层在构造处收窄。 */
  readonly fileHandlers: unknown;
}

// 资源的预加载策略：立即 / 惰性 / 按需（数字枚举，D-06）
export enum PreloadStrategy {
  // 立即加载
  Eager = 0,
  // 惰性加载
  Lazy = 1,
  // 按需加载
  OnDemand = 2,
}

// 通用资源描述符：每个资源只由逻辑 id + 一个惰性 create(deps) 工厂描述；
// 刻意不含 path、format、handler 实例或参数模板
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

// 适配器作者传给 defineEngine 的普通对象
export interface EngineDescription {
  readonly id: string;
  readonly apiVersion?: string;
  readonly resources: readonly ResourceDescriptor[];
}

// 引擎适配器的入口形状：Phase 3 只声明 id + apiVersion，Phase 5 显式演进为必须携带 resources
export interface IEngineAdapter {
  /** 适配器的逻辑身份。 */
  readonly id: string;

  /** 适配器实现的契约版本（defineEngine 缺省填入 ENGINE_ADAPTER_API_VERSION）。 */
  readonly apiVersion: string;

  /** 该适配器承载的资源描述符（按声明顺序）。 */
  readonly resources: readonly ResourceDescriptor[];
}
