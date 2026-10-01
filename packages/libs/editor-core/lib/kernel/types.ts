import { Store } from '@tanstack/store';

export interface OperationMeta {
  /** 给人看的操作标签，历史面板据此显示这一步做了什么。 */
  readonly label: string;
  /** 失败定位用的阶段名，出错时据此判断是哪一步没成。 */
  readonly stage: string;
  /** 操作自报它这次改动了哪些路径；不报就退化为空数组。 */
  readonly paths?: readonly string[];
}

export interface AppliedOperation<T> {
  /** 操作成功后的返回值。 */
  readonly value: T;
  /** 能把这次改动撤回来的逆操作。 */
  readonly inverse: IEditorOperation<unknown>;
  /** 是否真的改动了东西；没改动就不入历史。 */
  readonly changed: boolean;
}

export interface IEditorOperation<T = void> {
  /** 这次操作的元数据。 */
  readonly meta: OperationMeta;

  /**
   * 执行这次编辑；成功时把「怎么撤回来」作为逆操作一并交出。
   *
   * @returns 操作返回值、能把它撤回来的逆操作，以及是否真的改动了东西。
   */
  apply(): Promise<AppliedOperation<T>>;
}

export interface IUndoManager {
  /** 对外状态容器，供界面订阅历史条目、当前指针与忙碌状态。 */
  readonly store: Store<OperationHistoryState>;

  /**
   * 执行一个操作；成功且确有改动就记一条历史。
   *
   * @param operation 要执行的可撤销操作。
   * @returns 操作成功后的返回值。
   */
  execute<T>(operation: IEditorOperation<T>): Promise<T>;

  /**
   * 撤销最近一条：对当前条目存的逆操作调 apply()。
   */
  undo(): Promise<void>;

  /**
   * 重做刚撤销的一条：再对原操作调 apply()。
   */
  redo(): Promise<void>;

  /**
   * 清空全部历史，不入队、不触发任何回调。
   */
  clear(): void;
}

export interface OperationHistoryEntry {
  /** 历史条目的自增编号。 */
  readonly id: number;
  /** 给人看的操作标签。 */
  readonly label: string;
  /** 操作发生的时刻（毫秒时间戳）。 */
  readonly timestamp: number;
  /** 这一步动过的路径，来自操作的元数据。 */
  readonly paths: string[];
}

export interface OperationHistoryState {
  /** 按时间先后排列的历史记录。 */
  readonly entries: readonly OperationHistoryEntry[];
  /** 当前指针：已生效的条目数。 */
  readonly current: number;
  /** 是否有操作正在排队执行。 */
  readonly busy: boolean;
}

/** 旧名过渡别名：编辑器靠它继续编译，Phase 11 删除（D-18）。 */
export type EditorOperation<T = void> = IEditorOperation<T>;

export interface CapabilityRegistrar {
  /**
   * 登记一个能力。
   *
   * @param kind 能力种类名。
   * @param id 该种类内的实例 id。
   * @param value 能力值。
   * @param options 可选的归属者与是否可替换。
   * @returns 登记结果：能撤销本次登记的 disposer 与本次产生的诊断。
   */
  register(kind: string, id: string, value: unknown, options?: RegisterCapabilityOptions): RegisterCapabilityResult;

  /**
   * 登记一个拆除钩子，销毁时逆序调用。
   *
   * @param teardown 释放本次登记项的钩子。
   */
  addTeardown(teardown: () => void): void;
}

export interface EditorCoreConfig {
  /** 构造期的安装回调，只拿到窄接口 CapabilityRegistrar，拿不到实例本身。 */
  readonly install?: (registrar: CapabilityRegistrar) => void;
  /** 构造末尾必须已登记的 kind:id 清单；缺一即抛错。 */
  readonly requiredCapabilities?: readonly string[];
}

export interface EditorCore {
  /** 诊断总线：构造期间与之后产生的诊断都留在它上面。 */
  readonly diagnostics: DiagnosticBus;

  /**
   * 登记一个能力。
   *
   * @param kind 能力种类名，须符合 `KIND_PATTERN`。
   * @param id 该种类内的实例 id。
   * @param value 能力值。
   * @param options 可选的归属者与是否可替换。
   * @returns 登记结果：能撤销本次登记的 disposer 与本次产生的诊断。
   */
  registerCapability(
    kind: string,
    id: string,
    value: unknown,
    options?: RegisterCapabilityOptions,
  ): RegisterCapabilityResult;

  /**
   * 读取一个能力；未登记返回 `undefined`。
   *
   * @param kind 能力种类名。
   * @param id 该种类内的实例 id。
   */
  getCapability<T = unknown>(kind: string, id: string): T | undefined;

  /**
   * 读取一个能力；未登记抛出命名该 `kind:id` 的错误。
   *
   * @param kind 能力种类名。
   * @param id 该种类内的实例 id。
   */
  getCapabilityOrThrow<T = unknown>(kind: string, id: string): T;

  /**
   * 返回冻结的能力快照：扁平数组，每项含 kind/id/value/owner。
   */
  snapshotCapabilities(): readonly CapabilityRef[];

  /**
   * 逆序释放全部登记项；幂等，重入为 no-op（D-09/D-21）。
   */
  dispose(): void;
}

export interface CapabilityRef {
  /** 能力种类名。 */
  readonly kind: string;
  /** 该种类内的实例 id。 */
  readonly id: string;
  /** 能力值。 */
  readonly value: unknown;
  /** 登记时可选声明的归属者。 */
  readonly owner?: string;
}

export interface RegisterCapabilityOptions {
  /** 登记归属者，便于按来源排查。 */
  readonly owner?: string;
  /** 是否允许同 kind:id 的后续登记覆盖本条；缺省不可覆盖。 */
  readonly replaceable?: boolean;
}

export interface RegisterCapabilityResult {
  /** 能撤销本次登记的 disposer；重复登记被拒时为空操作。 */
  readonly disposer: () => void;
  /** 本次登记产生的诊断；成功时为空数组。 */
  readonly diagnostics: readonly Diagnostic[];
}

export const enum DiagnosticSeverity {
  /** 阻断性错误 */
  Error = 0,
  /** 需关注但不阻断 */
  Warning = 1,
  /** 一般信息 */
  Info = 2,
}

export interface Diagnostic {
  /** 诊断级别，供测试与 CI 按级别断言。 */
  readonly severity: DiagnosticSeverity;
  /** 稳定机器码，取值见 DIAGNOSTIC_CODES。 */
  readonly code: string;
  /** 中文人读说明。 */
  readonly message: string;
  /** 诊断涉及的归属者。 */
  readonly owner?: string;
  /** 诊断指向的具体目标，如 kind:id。 */
  readonly target?: string;
  /** 触发诊断的原始抛出物。 */
  readonly cause?: unknown;
}

export interface DiagnosticBus {
  /**
   * 追加一条诊断并同步派发给全部订阅者。
   *
   * @param diagnostic 要记录并派发的诊断。
   */
  push(diagnostic: Diagnostic): void;

  /**
   * 按顺序返回全部历史的不可变副本。
   */
  snapshot(): readonly Diagnostic[];

  /**
   * 订阅订阅之后的诊断。
   *
   * @param listener 收到每条新诊断时同步调用。
   * @returns 取消订阅函数。
   */
  subscribe(listener: (diagnostic: Diagnostic) => void): () => void;
}
