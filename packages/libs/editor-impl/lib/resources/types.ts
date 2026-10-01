import { IFsPort } from '@motajs/editor-core';

export interface IdleContent {
  /** 空闲，尚未开始加载。 */
  readonly status: 'idle';
}

export interface LoadingContent {
  /** 加载中。 */
  readonly status: 'loading';
}

export interface LoadedContent<T> {
  /** 已加载，包含数据。 */
  readonly status: 'loaded';
  /** 已加载的数据。 */
  readonly value: T;
}

export interface NotFoundContent {
  /** 文件未找到。 */
  readonly status: 'not-found';
}

export interface ErrorContent {
  /** 出错，包含错误对象。 */
  readonly status: 'error';
  /** 错误对象。 */
  readonly error: Error;
}

/** 五态通用内容：idle / loading / loaded / not-found / error。 */
export type Content<T> = IdleContent | LoadingContent | LoadedContent<T> | NotFoundContent | ErrorContent;

/** 文件层内容类型（文本内容） */
export type FileContent = Content<string>;

export interface PersistenceIntent {
  /** 意图种类：写入或删除。 */
  readonly kind: 'write' | 'delete';

  /** 真正执行持久化的函数。 */
  readonly execute: () => Promise<void>;
}

export interface IdleExecutor {
  /** 空闲，无待执行工作。 */
  readonly status: 'idle';
}

export interface ExecutingExecutor {
  /** 执行中，包含待执行数。 */
  readonly status: 'executing';
  /** 待执行的任务数。 */
  readonly pending: number;
}

export interface ErrorExecutor {
  /** 终态失败，包含错误对象。 */
  readonly status: 'error';
  /** 错误对象。 */
  readonly error: Error;
  /** 失败后待执行数固定为 0。 */
  readonly pending: 0;
}

/** 单路径持久化控制器的执行状态：idle / executing / error。 */
export type ExecutorStatus = IdleExecutor | ExecutingExecutor | ErrorExecutor;

export interface PersistFailure {
  /** 失败的路径。 */
  readonly path: string;

  /** 失败原因。 */
  readonly error: Error;
}

/** ReadonlySignal<T> - 只读 signal（函数式），调用函数获取当前值 */
export type ReadonlySignal<T> = () => T;

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

export interface ITextContentView {
  /** 获取当前文本内容 */
  getContent(): Content<string>;
}

export interface IDataHandler<T> extends IContentHandler<T> {
  /** 获取底层文件内容（用于构造错误原因） */
  getFileHandler(): ITextContentView;
}

export interface IRecoverableResource<T = unknown> extends IContentHandler<T> {
  /** 获取底层原始文件资源；解析错误时用于打开原文修复 */
  raw?(): IContentHandler<string>;

  /** 返回自身恢复句柄，便于 resource.recoverable() 形式使用 */
  recoverable(): IRecoverableResource<T>;
}

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

export interface ILoadableResource<T> extends IResourceView<T> {
  /** 确保首次加载完成；已在加载时只等待，不重复读取。 */
  ensureLoaded(): Promise<void>;
  /** 重新加载（含依赖）后再次确保加载完成。 */
  reload(): Promise<void>;
  /** 等待状态稳定到 loaded / error / not-found 之一。 */
  waitForSettled(): Promise<void>;
}

export interface FileHandlerDependencies {
  /** 宿主文件读写能力。 */
  readonly fs: IFsPort;

  /** 项目级持久化监视器。 */
  readonly persistenceMonitor: IPersistenceMonitor;
}

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
  delete(path: string): Promise<void>;

  /** 移除处理器实例（不删除文件）。 */
  remove(path: string): void;

  /** 强制重新加载。 */
  reload(path: string): Promise<void>;

  /** 清空全部处理器（测试用）。 */
  clear(): void;

  /** 当前处理器数量（调试用）。 */
  size(): number;
}

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

export interface ResourceRegistryEntry {
  /** 资源身份（逻辑 id）。 */
  readonly id: string;

  /** 该逻辑 id 对应的资源视图。 */
  readonly resource: IResourceView<unknown>;
}

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
