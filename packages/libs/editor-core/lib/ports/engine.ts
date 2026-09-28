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
 *   内容构造只经 `create(deps)` 这一个惰性工厂缝（D-05）。文件 IO 地址只允许存在于默认实现包里
 *   的文件支撑类 `fileResource.ts` 内部。
 * - **去实现化**（D-01/D-03）：本文件不认识「资源视图」的具体形状——`ResourceDescriptor<TView>`
 *   的 `TView` 是**视图类型**、由消费方指定，core 只把它原样交出；`ResourceDependencies.fileHandlers`
 *   是 core 自持的 `unknown` 缺口，形状由默认实现层收窄。
 * - **纯函数**（PORT-03）：`defineEngine` 同步、无副作用、不注册任何东西、不触碰诊断总线，
 *   也没有模块级可变绑定；重复或并发调用同一描述得到等价适配器。
 * - **语法不漂移**（D-09）：逻辑 id 谓词 `isValidResourceId` 由本文件自持并导出，
 *   `ResourceRegistry`（默认实现层）反向 import，因此定义期与登记期不可能各自演化。
 * - 本文件只 import 类型与自持的 id 谓词，绝不 import 宿主 / 引擎 / 诊断总线（Pitfall 10 / PORT-02）。
 */
/**
 * 逻辑 id 形式：一段或多段以点分隔，每段以字母/`_`/`$` 开头，不含空白与斜杠。
 *
 * 谓词由底层自持：`editor-impl` 的 `ResourceRegistry` 反向跨包 import 它，因此「描述符 id 语法」
 * 与「登记 id 语法」不可能各自漂移（D-09）。
 */
const LOGICAL_ID_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*(\.[A-Za-z_$][A-Za-z0-9_$]*)*$/;

/**
 * 保留名：即使形式上合法也拒绝，避免任何对象键语义的误用（V5）。
 *
 * 它与谓词、`LOGICAL_ID_PATTERN` 一起从 `editor-impl` 的 `ResourceRegistry` 收进底层并导出，
 * 使登记方与定义方共用**同一份**原型污染防线（T-05.1-09）；`editor-impl` 反向 import 它。
 */
export const RESERVED_IDS: readonly string[] = Object.freeze(['__proto__', 'constructor', 'prototype']);

/**
 * 逻辑 id 的**唯一共享判定**（布尔形式）：空、含空白、保留名、不符 `LOGICAL_ID_PATTERN` 之一即返回 `false`。
 *
 * 这是**纯函数**：不抛错、无状态、可安全并发调用。
 */
export function isValidResourceId(id: string): boolean {
  if (id.length === 0) return false;
  if (/\s/.test(id)) return false;
  if (RESERVED_IDS.includes(id)) return false;
  return LOGICAL_ID_PATTERN.test(id);
}

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
  /**
   * per-instance 文件层槽位；只有文件支撑的工厂会用到它。
   *
   * core 只声明这个缺口为 `unknown`——它不假定文件层的具体形状（D-02/D-03）；默认实现层
   * 在构造处把它收窄回自己的文件层类型。
   */
  readonly fileHandlers: unknown;
}

/** 允许的 `preload` 字面量集合。 */
export type PreloadStrategy = 'eager' | 'lazy' | 'on-demand';

/**
 * 通用资源描述符（PORT-04，D-04/D-05）。
 *
 * 每个资源只由逻辑 id + 一个惰性 `create(deps)` 工厂描述；`preload` / `preloadDependsOn`
 * 表达加载意图与依赖边。**刻意不含** `path`、`format`、handler 实例或参数模板。
 */
export interface ResourceDescriptor<TView = unknown> {
  /** 逻辑 id；与 `ResourceRegistry` 共用同一语法（`isValidResourceId`）。 */
  readonly id: string;

  /**
   * 唯一的构造缝：给定依赖返回**视图**（可异步）。`TView` 是视图类型、由消费方指定，
   * core 不假定其形状（D-03）；参数化在适配器侧解析，core 永不见模板。
   */
  readonly create: (deps: ResourceDependencies) => TView | Promise<TView>;

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
 *
 * 承载列表经标准的 `Error.cause` 传递（冻结副本），因此不引入任何未在 `INTERFACE-NAME.md` 中
 * 登记的新成员名，也满足 `noUnusedLocals`（无未被读取的私有字段）。
 */
export class EngineDefinitionError extends Error {
  constructor(problems: readonly string[]) {
    super(`Engine definition invalid: ${problems.join('; ')}`, { cause: Object.freeze([...problems]) });
    this.name = 'EngineDefinitionError';
  }
}

/**
 * 校验一份 `EngineDescription` 并返回冻结的 `EngineAdapter`（PORT-03）。
 *
 * 七条规则一次性收集后抛出**一个** `EngineDefinitionError`（聚合，而非首错即停）：
 * 1. 引擎 `id` 非空；描述符 `id` 命中共享语法（`isValidResourceId`）；
 * 2. 描述符 `id` 在 `resources` 内唯一；
 * 3. `create` 是函数；
 * 4. 每个 `preloadDependsOn` 目标都指向同组内存在的 id；
 * 5. `preloadDependsOn` 图无环（DFS + on-stack 集，报告**每一条**闭环边）；
 * 6. `preload` 若给出必须是 `PreloadStrategy` 字面量之一；
 * 7. `apiVersion` 若给出必须是非空字符串。
 *
 * 本函数不做任何注册、构造或总线交互——定义期与实例期严格分离，且无模块级可变状态。
 */
export function defineEngine(description: EngineDescription): EngineAdapter {
  const problems: string[] = [];

  if (description.id.length === 0) problems.push('引擎 id 不能为空');

  const seen = new Set<string>();
  for (const descriptor of description.resources) {
    if (!isValidResourceId(descriptor.id)) problems.push(`资源描述符 id 不合法：${descriptor.id}`);
    if (seen.has(descriptor.id)) problems.push(`资源描述符 id 重复：${descriptor.id}`);
    seen.add(descriptor.id);
    if (typeof descriptor.create !== 'function') problems.push(`资源描述符 ${descriptor.id} 的 create 不是函数`);

    const preload = descriptor.preload;
    if (preload !== undefined && preload !== 'eager' && preload !== 'lazy' && preload !== 'on-demand') {
      problems.push(`资源描述符 ${descriptor.id} 的 preload 非法：${String(preload)}`);
    }
  }

  if (description.apiVersion !== undefined && description.apiVersion.length === 0) {
    problems.push('apiVersion 不能为空字符串');
  }

  for (const descriptor of description.resources) {
    for (const target of descriptor.preloadDependsOn ?? []) {
      if (!seen.has(target)) {
        problems.push(`资源描述符 ${descriptor.id} 的 preloadDependsOn 引用了不存在的 id：${target}`);
      }
    }
  }

  // 环检测（T-05-04）：DFS 用 on-stack 集标记灰点，每条指向灰点的边都关闭一个环，全部报告。
  const byId = new Map<string, ResourceDescriptor>();
  for (const descriptor of description.resources) byId.set(descriptor.id, descriptor);
  const settled = new Set<string>();
  const onStack = new Set<string>();
  const visit = (id: string): void => {
    if (settled.has(id)) return;
    onStack.add(id);
    for (const target of byId.get(id)?.preloadDependsOn ?? []) {
      if (onStack.has(target)) problems.push(`资源依赖环：${id} → ${target}`);
      else if (byId.has(target)) visit(target);
    }
    onStack.delete(id);
    settled.add(id);
  };
  for (const descriptor of description.resources) visit(descriptor.id);

  if (problems.length > 0) throw new EngineDefinitionError(problems);

  return Object.freeze({
    id: description.id,
    apiVersion: description.apiVersion ?? ENGINE_ADAPTER_API_VERSION,
    resources: Object.freeze([...description.resources]),
  });
}

/**
 * 依 `preloadDependsOn` 求出的**纯、稳定**拓扑序（PORT-03）。
 *
 * 依赖总排在依赖者之前；互不依赖的资源保持声明顺序（确定性 tie-breaking：每次取声明序中最早
 * 可放置者）。不加载任何东西、不持有状态、不抛错——`defineEngine` 已在定义期拒绝环；若仍有余项
 * （程序化误用），按声明顺序补齐以保持全序且确定。
 */
export function resolvePreloadOrder(resources: readonly ResourceDescriptor[]): readonly string[] {
  const declared: string[] = resources.map((descriptor) => descriptor.id);
  const known = new Set<string>(declared);
  const byId = new Map<string, ResourceDescriptor>();
  for (const descriptor of resources) byId.set(descriptor.id, descriptor);

  const placed = new Set<string>();
  const order: string[] = [];
  const remaining = [...declared];

  while (remaining.length > 0) {
    const readyIndex = remaining.findIndex((id) =>
      (byId.get(id)?.preloadDependsOn ?? [])
        .filter((target) => known.has(target))
        .every((target) => placed.has(target)),
    );
    const index = readyIndex === -1 ? 0 : readyIndex;
    const [id] = remaining.splice(index, 1);
    order.push(id);
    placed.add(id);
  }

  return Object.freeze(order);
}
