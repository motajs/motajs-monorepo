import { IHookable, IHookBase } from '../hook';
import { EditorEntryKind, EditorFileChangeKind, IEditorFileSystem } from '../fs';

/** 资源的唯一标识，即相对项目根、以 `/` 分隔、无前导斜线的文件路径；资源相等即路径相等 */
export type IResourceIdentifier = string;

/** 资源内容的两种形态：原文（text）字符串或原始字节（binary）；core 不解析任何文件格式 */
export type ResourceContent = string | Uint8Array;

export interface IFileEntry {
  /** 条目的完整路径，相对项目根、以 `/` 分隔、无前导斜线 */
  readonly path: string;
  /** 条目的末段名 */
  readonly name: string;
  /** 条目是文件还是目录 */
  readonly kind: EditorEntryKind;
}

export interface IResource {
  /** 资源标识（纯路径） */
  readonly identifier: IResourceIdentifier;

  /**
   * 请求资源内容
   * @returns 资源的原文或原始字节；资源不存在时为 undefined
   */
  request(): Promise<ResourceContent | undefined>;

  /**
   * 请求资源原始字节
   * @returns 资源的原始字节；资源不存在时为 undefined
   */
  requestBinary(): Promise<Uint8Array | undefined>;

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

  /**
   * 把指定路径的待写内容立刻写进磁盘
   *
   * 幂等：这条路径没有待写时直接成功，调用方不必先查 `IResourceSystem.hasAnyPendingContent`。
   * 面板的保存按钮与冲突弹窗的「保存编辑器的」用它把本栏的待写内容写到磁盘。
   * @param identifier 资源标识（纯路径）
   */
  flushContent(identifier: IResourceIdentifier): Promise<void>;

  /**
   * 丢弃指定路径还没落盘的待写内容
   *
   * 用于「不保存关闭」与冲突弹窗的「保存外部修改」，避免 5 秒后又被写回磁盘；
   * 丢弃同时会让资源层忘掉该路径的缓存内容。
   * @param identifier 资源标识（纯路径）
   */
  discardPendingContent(identifier: IResourceIdentifier): void;

  /**
   * 订阅「当前全部待写路径」的变化
   *
   * 订阅时立刻用当前值回调一次（之后每次待写集合变化再回调），面板据此维护每栏的未保存标记。
   * @param listener 待写路径变化的回调
   * @returns 退订函数
   */
  watchPendingChange(listener: PendingChangeListener): () => void;
}

export interface IResourceStore {
  /**
   * 读取指定资源的内容
   * @param identifier 资源标识（纯路径）
   * @returns 资源的原文或原始字节；资源不存在时为 undefined
   */
  readContent(identifier: IResourceIdentifier): Promise<ResourceContent | undefined>;

  /**
   * 读取指定路径文件的原始字节
   * @param identifier 资源标识（纯路径）
   * @returns 文件的原始字节；资源不存在时为 undefined
   */
  readBinary(identifier: IResourceIdentifier): Promise<Uint8Array | undefined>;

  /**
   * 写入指定资源的内容
   * @param identifier 资源标识（纯路径）
   * @param data 要写入的资源内容
   */
  writeContent(identifier: IResourceIdentifier, data: ResourceContent): Promise<void>;
}

export interface IFileIndex {
  /**
   * 递归全扫项目建索引
   * @param fs 宿主注入的文件系统实现
   * @param ignore 建索引时跳过的目录 / 文件模式列表，可含通配
   */
  initialize(fs: IEditorFileSystem, ignore: readonly string[]): Promise<void>;

  /**
   * 列出某目录下的直接子条目
   * @param path 目录路径，相对项目根、以 `/` 分隔、无前导斜线
   * @returns 该目录下的直接子条目列表
   */
  list(path: string): readonly IFileEntry[];

  /**
   * 判断索引中是否存在指定路径
   * @param path 条目路径
   * @returns 存在时为 true
   */
  has(path: string): boolean;

  /**
   * 向索引插入一个条目
   * @param path 条目路径
   * @param kind 条目是文件还是目录
   */
  insert(path: string, kind: EditorEntryKind): void;

  /**
   * 从索引移除指定路径
   * @param path 条目路径
   */
  remove(path: string): void;

  /**
   * 在索引中把源路径移动到目标路径
   * @param source 源路径
   * @param destination 目标路径
   */
  move(source: string, destination: string): void;

  /**
   * 清空索引
   */
  clear(): void;
}

export interface IContentCache {
  /**
   * 读取指定路径的缓存内容
   * @param path 资源路径
   * @returns 命中时为原文或原始字节；未命中时为 undefined
   */
  get(path: string): ResourceContent | undefined;

  /**
   * 写入指定路径的缓存内容
   * @param path 资源路径
   * @param content 要缓存的内容
   */
  set(path: string, content: ResourceContent): void;

  /**
   * 使指定路径的缓存失效
   * @param path 资源路径
   */
  invalidate(path: string): void;

  /**
   * 清空缓存
   */
  clear(): void;
}

/** 把一条路径的待写内容真正写进磁盘的动作；由资源层提供，缓冲自身不碰文件系统 */
export type WriteBufferWriter = (path: string, content: ResourceContent) => Promise<void>;

/** 「当前全部待写路径」变化的回调；订阅时资源层会先回调一次当前待写路径列表 */
export type PendingChangeListener = (paths: readonly string[]) => void;

export interface IWriteBufferEntry {
  /**
   * 最近一次排入的待写内容；成功写盘、丢弃或整条替换后随之更新或消失。
   * 条目是只读的：缓冲每次修改都整条替换条目，避免二进制内容靠引用比较漏判
   */
  readonly content: ResourceContent;
  /**
   * 自增版本号，每次 `WriteBuffer.schedule` 排入新内容时递增。
   * 版本号是数字比较，能可靠判出「写盘期间又写了一次」；`Uint8Array` 的 `!==` 是引用比较，不能依赖
   */
  readonly version: number;
  /** 5 秒防抖定时器句柄；已被写盘取消、或该条目被标成「外部已改」时为空 */
  timer: ReturnType<typeof setTimeout> | null;
  /**
   * 该路径正在进行的写盘；没有在途写盘时为空。
   * 整条替换条目时必须原样保留本字段，否则同一路径会另起一次写盘、`dispose` 也看不到前一个
   */
  inFlight: Promise<void> | null;
  /** 上一次写盘失败的原文，供调用方与日志使用；写盘成功后清空；整条替换条目时必须原样保留本字段 */
  error: string | undefined;
  /**
   * 这条待写是否已被外部写入挡住：为真时读取回落到磁盘、该条目不再自动落盘。
   *
   * 它是条目自己的字段，不是缓冲另开的一张「外部已改路径集合」——排入新内容时整条替换自然回到假，
   * 成功写盘与丢弃也清零，因此一次外部冲突不会让该路径永久读不到待写。
   * 为真时没有定时器：这条路径只能由用户在两动作弹窗上显式 flush 或丢弃来结算
   */
  readonly externallyChanged: boolean;
}

export interface IWriteBuffer {
  /**
   * 现在一共有多少条待写
   * @returns 待写条目数量
   */
  size(): number;

  /**
   * 把一条路径的最新内容排进待写表，并重排它的 5 秒写盘
   *
   * 该路径已有待写时整条替换条目（「外部已改」标记随之回到假），但原样保留在途写盘与上次失败原因；
   * 缓冲不设上限、不做淘汰，只在成功写盘或丢弃时删除条目。
   * @param path 资源标识（纯路径）
   * @param content 要写入的资源内容
   */
  schedule(path: string, content: ResourceContent): void;

  /**
   * 把某一条路径的待写内容立刻写进磁盘，可以 await
   *
   * 幂等：这条路径没有待写时直接成功，调用方不必先查 `has`。同一路径同时只允许一个在途写盘，
   * 并发调用复用同一次写盘。写盘失败时保留待写，再把错误抛给调用方。
   * @param path 资源标识（纯路径）
   */
  flush(path: string): Promise<void>;

  /**
   * 把所有待写内容逐条尝试写进磁盘
   *
   * 某一条失败不阻止其它路径写盘；全部尝试完再把第一条失败抛给调用方，由调用方自己 catch 并记日志。
   * 已被外部变化标记（`externallyChanged`）的条目不写盘、也不抛错，它们仍留在待写里；
   * 单路径 `flush` 仍可写这类条目，因为「保存编辑器的」会先 `schedule` 清掉标记再 flush。
   */
  flushAll(): Promise<void>;

  /**
   * 这条路径现在还有没有内容没写盘
   * @param path 资源标识（纯路径）
   * @returns 存在待写时为 true
   */
  has(path: string): boolean;

  /**
   * 现在还有哪些路径没写盘
   * @returns 待写路径列表；返回新数组，不外泄内部引用
   */
  paths(): readonly string[];

  /**
   * 取该路径当前可读的待写内容，不触发写盘
   *
   * 这是 `ResourceSystem.readContent` / `ResourceSystem.readBinary` 判断要不要命中缓冲的唯一入口，
   * 别在读取方另写一份判定。没有待写、或该条目的 `externallyChanged` 为真时返回 undefined（读取方应回落到磁盘）；
   * 其余情况返回条目内容。判据只在这个条目的字段上：排入新内容会整条替换条目（标记自然清假），
   * 所以一次外部冲突之后该路径仍能重新成为可读的待写。
   * @param path 资源标识（纯路径）
   * @returns 当前可读的待写内容；没有待写或已被外部挡住时为 undefined
   */
  readPending(path: string): ResourceContent | undefined;

  /**
   * 丢弃某条路径的待写内容（连同它的定时器）
   *
   * 由「不保存关闭」「保存外部修改」与删除 / 移动资源使用；丢弃同时由资源层失效该路径的内容缓存。
   * @param path 资源标识（纯路径）
   */
  discard(path: string): void;

  /**
   * 外部变化到达时给这条待写给「外部已改」标记
   *
   * 没有待写时什么都不做。磁盘内容与本缓冲最近一次自己写出去的内容相同 → 视为自己写盘的回声：
   * 未被标记的条目只重排一次 5 秒定时器（先清后装）；已被标记的条目直接返回，不清标记、也不重排定时器，
   * 因此被标记的路径没有「定时器到点自动落盘」这条路。
   * 其余情况（内容不同或外部删除）→ 把条目 `externallyChanged` 置真、清掉它的 5 秒定时器且不再重排，
   * 条目保留、读取回落到磁盘；这条路径从此不会自动落盘，只能由用户在冲突弹窗上显式 flush 或丢弃来结算。
   * 整条替换该条目时必须原样保留 `inFlight` 与 `error`；在途写盘允许完成，若标记是在这次写盘期间才变真，
   * 结算时标记优先（不删条目、不重排定时器）。标记的清除只发生在 `schedule`、成功写盘与丢弃三处。
   * @param path 资源标识（纯路径）
   * @param diskContent 磁盘上现在的内容；读不到磁盘（外部删除）时传 undefined
   */
  noteExternalWrite(path: string, diskContent: ResourceContent | undefined): void;

  /**
   * 清空整张待写表，不写盘（只用于释放）
   */
  clear(): void;

  /**
   * 释放缓冲：清掉所有定时器与内部表，避免测试与热重载留下悬挂定时器
   */
  dispose(): void;
}

export interface IResourceSystemHooks extends IHookBase {
  /**
   * 当资源更新时触发，需要重新手动申请指定资源以获取更新后的资源内容
   * @param identifier 资源标识（纯路径）
   */
  onUpdateResource?(identifier: IResourceIdentifier): Promise<void>;

  /**
   * 当宿主报告某个路径发生变化时触发；面板按需自行读取需要的内容，资源层**不预读**内容
   *
   * 资源层会在投递前更新文件索引与内容缓存，因此删除事件不会因读取失败而中断通知。
   * @param identifier 资源标识（纯路径）
   * @param kind 变化种类
   */
  onResourceChange?(identifier: IResourceIdentifier, kind: EditorFileChangeKind): Promise<void>;

  /**
   * 当「是否有待写」这件事发生变化时触发
   *
   * 只表达「有待写」这件事变了，不携带任何路径，供外壳刷新右上角提示。
   */
  onPendingChange?(): Promise<void>;
}

export interface IResourceSystemOptions {
  /** 建索引时跳过的目录 / 文件模式列表，可含通配；匹配即跳过，如 `node_modules`、`.git` */
  readonly ignore?: readonly string[];
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

  /**
   * 把所有待写内容逐条尝试写进磁盘
   *
   * 切标签、关标签、释放与页面离开都用它；某一条失败不阻止其它路径写盘，
   * 全部尝试完再把第一条失败抛给调用方，由调用方自己 catch 并记日志。
   * 已被外部变化标记的条目被跳过：它们不写盘、仍留在待写里，只有单路径 `flushContent` 才写得出去
   * （那是「保存编辑器的」这条显式出口）。
   */
  flushAllContent(): Promise<void>;

  /**
   * 当前是否还有任意内容在等待写盘
   *
   * 右上角提示与 `beforeunload` 只看这一个布尔，不读取任何路径。
   * @returns 存在待写时为 true
   */
  hasAnyPendingContent(): boolean;

  /**
   * 列出当前全部待写路径
   *
   * 仅供内部与外壳使用，不把任何路径渲染到界面。
   * @returns 待写路径列表；返回新数组
   */
  listPendingPaths(): readonly string[];
}

export interface IResourceSystemAccess extends IResourceSystem, IResourceAccess, IResourceStore {}

/** 内容缓存池的总字节上限默认值；超过即按 LRU 淘汰 */
export const CONTENT_CACHE_MAX_BYTES = 8 * 1024 * 1024;
