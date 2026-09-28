/**
 * `EngineAdapter` —— 引擎适配器契约（引擎无关，D-03/D-04/D-05/D-14）。
 *
 * 本文件是**适配器契约的唯一落点**：通用资源描述符 `ResourceDescriptor<T>`、定义输入
 * `EngineDescription`、校验并构造适配器的 `defineEngine`、其唯一的聚合错误
 * `EngineDefinitionError`、契约版本常量 `ENGINE_ADAPTER_API_VERSION`，以及扩宽后的
 * `EngineAdapter`（显式加入 `resources`，Phase 3 D-14 预告的那一次接口演进）。
 *
 * 设计约束：
 * - **来源无关**（D-04）：通用描述符不含 `path` / `format` / handler 实例，也不含参数模板；
 *   内容构造只经 `create(deps)` 这一个惰性工厂缝（D-05）。文件 IO 地址只允许存在于
 *   `lib/resources/fileResource.ts` 的文件支撑类内部。
 * - **纯函数**（PORT-03）：`defineEngine` 同步、无副作用、不注册任何东西、不触碰诊断总线，
 *   也没有模块级可变绑定；重复或并发调用同一描述得到等价适配器。
 * - **语法不漂移**（D-09）：描述符 id 的判定复用 `ResourceRegistry` 的同一谓词
 *   `isValidResourceId`（本文件导入并再导出），因此定义期与登记期不可能各自演化。
 * - 本文件只 import 类型与 id 谓词，绝不 import 宿主 / 引擎 / 诊断总线（Pitfall 10 / PORT-02）。
 */
import type { ResourceView } from '../resources/combinators';
import type { FileHandlerManager } from '../resources/fileHandlerManager';
import { isValidResourceId } from '../resources/resourceRegistry';

// 与 `ResourceRegistry` 共用同一逻辑 id 判定（D-09）；再导出后定义方与登记方不可能漂移。
export { isValidResourceId };

/**
 * 适配器契约版本。与 `EDITOR_CORE_API_VERSION` 并行：core 公开 API 与适配器契约是两份、
 * 走两套时钟的契约，Phase 12 冻结扩展面时不应把二者混为一谈。
 */
export const ENGINE_ADAPTER_API_VERSION = '0.1.0';

/**
 * 描述符 `create(deps)` 收到的依赖（D-04/D-05）。
 *
 * 刻意最小：只有 per-instance 文件层，没有 path、registry、总线或引擎词汇。文件支撑的工厂
 * 用它取到文件层；**非文件**资源（如 `computedResource` 现场构造的内容）完全不碰它，这正是
 * 「core 不假定内容来自文件」的机制证明。
 */
export interface ResourceDependencies {
  /** per-instance 文件层；只有文件支撑的工厂会用到它。 */
  readonly fileHandlers: FileHandlerManager;
}

/** 允许的 `preload` 字面量集合。 */
export type PreloadStrategy = 'eager' | 'lazy' | 'on-demand';

/**
 * 通用资源描述符（PORT-04，D-04/D-05）。
 *
 * 每个资源只由逻辑 id + 一个惰性 `create(deps)` 工厂描述；`preload` / `preloadDependsOn`
 * 表达加载意图与依赖边。**刻意不含** `path`、`format`、handler 实例或参数模板。
 */
export interface ResourceDescriptor<T = unknown> {
  /** 逻辑 id；与 `ResourceRegistry` 共用同一语法（`isValidResourceId`）。 */
  readonly id: string;

  /** 唯一的构造缝：给定依赖返回资源视图（可异步）。参数化在适配器侧解析，core 永不见模板。 */
  readonly create: (deps: ResourceDependencies) => ResourceView<T> | Promise<ResourceView<T>>;

  /** 可选加载策略；缺省语义由消费方决定（本阶段不定义默认值）。 */
  readonly preload?: PreloadStrategy;

  /** 可选依赖边：本资源 preload 前应先就绪的逻辑 id 列表。 */
  readonly preloadDependsOn?: readonly string[];
}

/** 适配器作者传给 `defineEngine` 的普通对象。 */
export interface EngineDescription {
  readonly id: string;
  readonly apiVersion?: string;
  readonly resources: readonly ResourceDescriptor[];
}

/**
 * 引擎适配器的入口形状。
 *
 * Phase 3 只声明 `id` + `apiVersion`；Phase 5 显式演进为**必须携带 `resources`**——没有实现者
 * 存在，且「没有资源的适配器什么也没描述」。
 */
export interface EngineAdapter {
  /** 适配器的逻辑身份。 */
  readonly id: string;

  /** 适配器实现的契约版本（`defineEngine` 缺省填入 `ENGINE_ADAPTER_API_VERSION`）。 */
  readonly apiVersion: string;

  /** 该适配器承载的资源描述符（按声明顺序）。 */
  readonly resources: readonly ResourceDescriptor[];
}

/**
 * `defineEngine` 抛出的**唯一**错误，一次性携带全部定义问题（聚合而非首错即停）。
 *
 * 与 `EditorCoreStartupError` 同形：`super(message)` 记录摘要，冻结承载的问题列表，且**不**调用
 * `Error.captureStackTrace`（core 刻意不依赖 `@types/node`）。
 */
export class EngineDefinitionError extends Error {
  private readonly problems: readonly string[];

  constructor(problems: readonly string[]) {
    super(`Engine definition invalid: ${problems.join('; ')}`);
    this.name = 'EngineDefinitionError';
    // 复制并冻结：构造后再改动传入数组也无法改写本错误承载的问题（镜像 `EditorCoreStartupError`）。
    this.problems = Object.freeze([...problems]);
  }
}

/**
 * 校验一份 `EngineDescription` 并返回冻结的 `EngineAdapter`（PORT-03）。
 *
 * 所有问题一次性收集后抛出**一个** `EngineDefinitionError`；校验通过则返回冻结适配器。
 * 本函数不做任何注册、构造或总线交互——定义期与实例期严格分离。
 */
export function defineEngine(description: EngineDescription): EngineAdapter {
  const problems: string[] = [];

  if (description.id.length === 0) problems.push('引擎 id 不能为空');
  for (const descriptor of description.resources) {
    if (!isValidResourceId(descriptor.id)) problems.push(`资源描述符 id 不合法：${descriptor.id}`);
    if (typeof descriptor.create !== 'function') problems.push(`资源描述符 ${descriptor.id} 的 create 不是函数`);
  }

  if (problems.length > 0) throw new EngineDefinitionError(problems);

  return Object.freeze({
    id: description.id,
    apiVersion: description.apiVersion ?? ENGINE_ADAPTER_API_VERSION,
    resources: Object.freeze([...description.resources]),
  });
}
