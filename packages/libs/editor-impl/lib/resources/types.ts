import { IFsPort } from '@motajs/editor-core';

/**
 * Content<T> - 统一的状态类型
 *
 * 受 Rust 的 Result<T, E> 和 Option<T> 启发，使用 Tagged Union 表示数据的所有可能状态
 */

/** 通用的 Content 类型 - 适用于所有层 */
export type Content<T> =
  | { status: 'idle' } // 空闲，未开始加载
  | { status: 'loading' } // 加载中
  | { status: 'loaded'; value: T } // 已加载，包含数据
  | { status: 'not-found' } // 文件未找到
  | { status: 'error'; error: Error }; // 错误（权限、IO、解析等）

/** 文件层内容类型（文本内容） */
export type FileContent = Content<string>;

/**
 * PersistenceIntent - 一次持久化意图
 *
 * 编辑代码提交不可变的期望状态：要么写、要么删，并带上真正执行的函数。
 */
export interface PersistenceIntent {
  /** 意图种类：写入或删除。 */
  readonly kind: 'write' | 'delete';

  /** 真正执行持久化的函数。 */
  readonly execute: () => Promise<void>;
}

/**
 * ExecutorStatus - 单个持久化控制器的执行状态
 *
 * idle 空闲；executing 执行中并给出待执行数量；error 终态失败并带上错误。
 */
export type ExecutorStatus =
  { status: 'idle' } | { status: 'executing'; pending: number } | { status: 'error'; error: Error; pending: 0 };

/**
 * PersistFailure - 一条路径的持久化失败记录
 */
export interface PersistFailure {
  /** 失败的路径。 */
  readonly path: string;

  /** 失败原因。 */
  readonly error: Error;
}

/**
 * ReadonlySignal<T> - 只读 signal（函数式）
 *
 * 调用函数获取当前值
 */
export type ReadonlySignal<T> = () => T;

/**
 * IContentView<T> - 只读内容视图
 *
 * 定义只读内容访问接口，支持多层嵌套
 */
export interface IContentView<T> {
  /** 主要接口：只读 signal（推荐使用） */
  readonly content: ReadonlySignal<Content<T>>;

  /** 兼容方法：获取当前内容 */
  getContent(): Content<T>;

  /** 兼容方法：订阅内容变化 */
  subscribe(listener: (content: Content<T>) => void): () => void;

  /** 重新加载 */
  refetch(): Promise<void>;

  /** 确保完成首次加载；已在加载时仅等待，不重新读取 */
  ensureLoaded(): Promise<void>;

  /** 获取路径（用于调试） */
  getPath(): string;
}

/**
 * IContentHandler<T> - 可写内容处理器
 *
 * 扩展 IContentView，添加写入能力
 */
export interface IContentHandler<T> extends IContentView<T> {
  /** 统一的 update API（支持三种模式） */
  update(value: T): void;
  update(transform: (current: T) => T): void;
  update(transform: (current: T) => Promise<T>): Promise<void>;

  /** 等待内容加载完成（包括解析成功） */
  waitForLoaded(): Promise<void>;

  /** 等待状态 settled（loaded/error/not-found，非 loading/idle） */
  waitForSettled(): Promise<void>;
}

/**
 * IDataHandler<T> - 数据层处理器（DataHandler）
 *
 * 扩展 IContentHandler，补充数据层专有能力
 */
export interface IDataHandler<T> extends IContentHandler<T> {
  /** 获取底层文件内容（用于构造错误原因） */
  getFileHandler(): { getContent(): Content<string> };
}

/**
 * IRecoverableResource - 可被 ContentBoundary 恢复的数据源
 *
 * 这是 DataHandler/FileHandler 之外的公共恢复协议。上层资源可以隐藏具体
 * handler 实现，但仍保留 retry、raw 文件修复和状态展示能力。
 */
export interface IRecoverableResource<T = unknown> extends IContentHandler<T> {
  /** 获取底层原始文件资源；解析错误时用于打开原文修复 */
  raw?(): IContentHandler<string>;

  /** 返回自身恢复句柄，便于 resource.recoverable() 形式使用 */
  recoverable(): IRecoverableResource<T>;
}

/**
 * IResourceView<T> - 可读资源视图
 *
 * 默认实现层对一个「只读资源」的统一视图：拿到身份、订阅内容变化、取快照与当前值。
 * 内容由各实现自己持有，本接口只描述怎么读，不关心内容从哪来。
 */
export interface IResourceView<T> {
  /** 资源身份（逻辑 id）。 */
  readonly id: string;
  /** 只读的响应式内容信号。 */
  readonly content: ReadonlySignal<Content<T>>;
  /** 同步取当前内容快照。 */
  snapshot(): Content<T>;
  /** 取当前已加载的值（未加载时抛错）。 */
  value(): T;
  /** 订阅内容变化，返回取消订阅函数。 */
  subscribe(listener: (content: Content<T>) => void): () => void;
}

/**
 * ILoadableResource<T> - 可加载资源
 *
 * 在只读视图之外补充「确保首次加载 / 重新加载 / 等待稳定」三个加载动作。
 */
export interface ILoadableResource<T> extends IResourceView<T> {
  /** 确保首次加载完成；已在加载时只等待，不重复读取。 */
  ensureLoaded(): Promise<void>;
  /** 重新加载（含依赖）后再次确保加载完成。 */
  reload(): Promise<void>;
  /** 等待状态稳定到 loaded / error / not-found 之一。 */
  waitForSettled(): Promise<void>;
}

/**
 * FileHandlerDependencies - 文件处理器的注入协作者
 *
 * 文件层与文件管理器共享同一份依赖，因此两者不可能把参数写反（D-07）。
 */
export interface FileHandlerDependencies {
  /** 宿主文件读写能力。 */
  readonly fs: IFsPort;

  /** 项目级持久化监视器。 */
  readonly persistenceMonitor: IPersistenceMonitor;
}

/**
 * IFileHandlerManager - 文件处理器管理器的契约
 *
 * 按路径加载、重载、清理与查询文件处理器；同一个路径始终只对应一个处理器实例。
 */
export interface IFileHandlerManager {
  /** 同步获取或创建一个处理器（未加载状态）。 */
  get(path: string): IContentHandler<string>;

  /** 异步加载路径对应的处理器（带加载锁）。 */
  load(path: string): Promise<IContentHandler<string>>;

  /** 批量加载多个路径。 */
  loadAll(paths: string[]): Promise<IContentHandler<string>[]>;

  /** 该路径是否已创建处理器实例。 */
  has(path: string): boolean;

  /** 文件是否真实存在于文件系统。 */
  exists(path: string): Promise<boolean>;

  /** 该路径的处理器是否已加载数据。 */
  isLoaded(path: string): boolean;

  /** 删除文件与处理器。 */
  delete(path: string, force?: boolean): Promise<void>;

  /** 移除处理器实例（不删除文件）。 */
  remove(path: string): void;

  /** 强制重新加载。 */
  reload(path: string): Promise<void>;

  /** 清空全部处理器（测试用）。 */
  clear(): void;

  /** 当前处理器数量（调试用）。 */
  readonly size: number;
}

/**
 * IPersistExecutor - 单路径持久化控制器的契约
 *
 * 排程某个路径的持久化意图、查询执行状态，并在显式边界处等待静默。
 */
export interface IPersistExecutor {
  /** 当前执行状态（只读信号）。 */
  readonly status: ReadonlySignal<ExecutorStatus>;

  /** 提交一个不可变的期望状态意图。 */
  schedule(intent: PersistenceIntent): void;

  /** 旧式测试适配入口：把遗留操作包装成一个写入意图。 */
  exec(): void;

  /** 重试上一次失败的意图。 */
  retry(): void;

  /** 等待执行队列静默。 */
  whenQuiescent(): Promise<void>;

  /** 在显式边界等待静默（旧名，改用 PersistenceMonitor.flush）。 */
  waitForIdle(): Promise<void>;

  /** 等待静默，若最终状态为错误则抛出。 */
  flush(): Promise<void>;

  /** 是否有执行中或待执行的工作。 */
  hasPending(): boolean;
}

/**
 * IPersistenceMonitor - 项目级持久化管理器的契约
 *
 * 汇总各路径的持久化状态，提供 flush、失败记录与统一重试。
 */
export interface IPersistenceMonitor {
  /** 正在持久化的路径列表（只读信号）。 */
  readonly persistingFiles: ReadonlySignal<string[]>;

  /** 持久化失败的路径列表（只读信号）。 */
  readonly failedFiles: ReadonlySignal<PersistFailure[]>;

  /** 是否正在重试（只读信号）。 */
  readonly retrying: ReadonlySignal<boolean>;

  /** 旧式测试适配入口：为一个路径创建受监控的执行器。 */
  createExecutor(path: string, operation: () => Promise<void>): IPersistExecutor;

  /** 为某个路径排程一个持久化意图。 */
  schedule(path: string, intent: PersistenceIntent): void;

  /** 重试全部失败路径，返回仍未恢复的失败。 */
  retryFailed(): Promise<PersistFailure[]>;

  /** 等待指定路径（缺省为全部）静默，有失败则抛出聚合错误。 */
  flush(paths?: readonly string[]): Promise<void>;

  /** 等待指定路径（缺省为全部）静默；刻意不因失败而 reject。 */
  whenQuiescent(paths?: readonly string[]): Promise<void>;

  /** 查询某路径的持久化状态。 */
  statusFor(path: string): 'idle' | 'persisting' | 'error';

  /** 查询某路径的失败原因。 */
  errorFor(path: string): Error | undefined;

  /** 是否有尚未落盘的改动。 */
  hasUnsavedChanges(): boolean;

  /** 是否存在持久化失败。 */
  hasPersistErrors(): boolean;

  /** 正在持久化的路径数量。 */
  getPersistingCount(): number;

  /** 持久化失败的路径数量。 */
  getFailedCount(): number;

  /** 清空全部状态（测试用）。 */
  resetForTests(): void;
}

/**
 * ResourceRegistryEntry - 注册表快照里的一条只读条目
 */
export interface ResourceRegistryEntry {
  /** 资源身份（逻辑 id）。 */
  readonly id: string;

  /** 该逻辑 id 对应的资源视图。 */
  readonly resource: IResourceView<unknown>;
}

/**
 * IResourceRegistry - 逻辑 id 资源注册表的契约
 *
 * 以逻辑 id 登记、取用与查询资源；条目只在本次登记的 disposer 被调用时移除。
 */
export interface IResourceRegistry {
  /** 以逻辑 id 登记一个资源；返回只删除本次登记的 disposer。 */
  register<T>(id: string, resource: IResourceView<T>): () => void;

  /** 按逻辑 id 取用资源；未登记返回 `undefined`。 */
  get<T>(id: string): IResourceView<T> | undefined;

  /** 按逻辑 id 取用资源；未登记抛出命名该 id 的错误。 */
  getOrThrow<T>(id: string): IResourceView<T>;

  /** 该逻辑 id 是否已登记。 */
  has(id: string): boolean;

  /** 已登记的逻辑 id 列表（返回新数组）。 */
  ids(): readonly string[];

  /** 冻结的条目快照（数组与每个条目都冻结）。 */
  snapshot(): readonly ResourceRegistryEntry[];
}
