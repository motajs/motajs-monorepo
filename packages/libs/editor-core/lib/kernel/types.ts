import { Store } from '@tanstack/store';
import { DiagnosticBus } from './diagnostics';
import { CapabilityRef, RegisterCapabilityOptions, RegisterCapabilityResult } from './registry';

/**
 * 底层（editor-core）对外类型的唯一集中出口。
 *
 * 本文件汇总「可撤销操作」「撤销管理器」两个契约：操作自带逆操作，管理器只记录先后、不保存快照；
 * 并从此处自持内核三接口（CapabilityRegistrar / EditorCoreConfig / EditorCore），使 `lib/kernel/core.ts`
 * 只留组合逻辑（D-08）。
 */

/**
 * 一次操作的元数据：给人看的标签、失败定位用的阶段，以及操作自报的影响路径。
 */
export interface OperationMeta {
  /** 给人看的操作标签，历史面板据此显示这一步做了什么。 */
  label: string;
  /** 失败定位用的阶段名，出错时据此判断是哪一步没成。 */
  stage: string;
  /** 操作自报它这次改动了哪些路径；不报就退化为空数组。 */
  paths?: readonly string[];
}

/**
 * 一次「应用」的结果：操作返回值、能把它撤回来的逆操作，以及是否真的改了东西。
 */
export interface AppliedOperation<T> {
  /** 操作成功后的返回值。 */
  value: T;
  /** 能把这次改动撤回来的逆操作。 */
  inverse: IEditorOperation<unknown>;
  /** 是否真的改动了东西；没改动就不入历史。 */
  changed: boolean;
}

/**
 * 一次可撤销的编辑：只暴露元数据与执行入口，成功时自己把逆操作交出来。
 */
export interface IEditorOperation<T = void> {
  /** 这次操作的元数据。 */
  readonly meta: OperationMeta;
  /** 执行这次编辑；成功时把「怎么撤回来」作为逆操作一并交出。 */
  apply(): Promise<AppliedOperation<T>>;
}

/**
 * 撤销操作栈管理器：只记录操作的先后，撤销时调该操作的逆、重做时再调原操作；不保存快照。
 */
export interface IUndoManager {
  /** 对外状态容器，供界面订阅历史条目、当前指针与忙碌状态。 */
  readonly store: Store<OperationHistoryState>;
  /** 执行一个操作；成功且确有改动就记一条历史。 */
  execute<T>(operation: IEditorOperation<T>): Promise<T>;
  /** 撤销最近一条：对当前条目存的逆操作调 apply()。 */
  undo(): Promise<void>;
  /** 重做刚撤销的一条：再对原操作调 apply()。 */
  redo(): Promise<void>;
  /** 清空全部历史，不入队、不触发任何回调。 */
  clear(): void;
}

/**
 * 对外的「一条历史记录」：这一步是什么、什么时候做的、动了哪些路径。
 */
export interface OperationHistoryEntry {
  /** 历史条目的自增编号。 */
  id: number;
  /** 给人看的操作标签。 */
  label: string;
  /** 操作发生的时刻（毫秒时间戳）。 */
  timestamp: number;
  /** 这一步动过的路径，来自操作的元数据。 */
  paths: string[];
}

/**
 * 管理器的对外状态：历史记录、当前指针与是否忙碌。
 */
export interface OperationHistoryState {
  /** 按时间先后排列的历史记录。 */
  entries: readonly OperationHistoryEntry[];
  /** 当前指针：已生效的条目数。 */
  current: number;
  /** 是否有操作正在排队执行。 */
  busy: boolean;
}

/**
 * 旧名过渡别名：编辑器靠它继续编译，Phase 11 删除（D-18）。
 */
export type EditorOperation<T = void> = IEditorOperation<T>;

/**
 * 交给 `config.install` 的**窄接口**（D-18）。
 *
 * 它绝不等于 `EditorCore` 实例：只允许在构造期间注册能力、登记拆除钩子。
 */
export interface CapabilityRegistrar {
  register(kind: string, id: string, value: unknown, options?: RegisterCapabilityOptions): RegisterCapabilityResult;
  addTeardown(teardown: () => void): void;
}

/** `createEditorCore` 的配置（N-02）。不提供任何暴露实例的通路（D-12）。 */
export interface EditorCoreConfig {
  readonly install?: (registrar: CapabilityRegistrar) => void;
  readonly requiredCapabilities?: readonly string[];
}

/** per-instance 内核的最小公开面（D-12）。 */
export interface EditorCore {
  registerCapability(
    kind: string,
    id: string,
    value: unknown,
    options?: RegisterCapabilityOptions,
  ): RegisterCapabilityResult;
  getCapability<T = unknown>(kind: string, id: string): T | undefined;
  getCapabilityOrThrow<T = unknown>(kind: string, id: string): T;
  snapshotCapabilities(): readonly CapabilityRef[];
  readonly diagnostics: DiagnosticBus;
  dispose(): void;
}
