import { computed, effect } from 'alien-signals';
import { Content, ILoadableResource, IResourceView, LoadedContent, ReadonlySignal } from './types';
import { ContentUtils } from './contentUtils';
import { waitUntil } from './waitUntil';

/** 依赖来源：静态数组，或每次读取时重算的惰性求值函数。 */
type DependencySource = readonly ILoadableResource<unknown>[] | (() => readonly ILoadableResource<unknown>[]);

/** 从一个资源视图类型里取出它的值类型；不是视图时退化为 never。 */
type ResourceValue<Resource> = Resource extends IResourceView<infer Value> ? Value : never;
/** 把依赖元组映射成对应的值元组，供 combine 回调按位取值。 */
type ResourceValues<Dependencies extends readonly IResourceView<unknown>[]> = {
  -readonly [Index in keyof Dependencies]: ResourceValue<Dependencies[Index]>;
};

export class ComputedResource<T> implements ILoadableResource<T> {
  /** 派生内容信号。 */
  readonly content: ReadonlySignal<Content<T>>;

  /** 资源身份（逻辑 id）。 */
  readonly id: string;

  /** 首次加载时要确保就绪的依赖来源（静态数组或惰性求值函数）。 */
  private readonly dependencySource: DependencySource;

  /** 重新加载时要一并重载的依赖来源。 */
  private readonly reloadDependencySource: DependencySource;

  constructor(
    id: string,
    dependencySource: DependencySource,
    computeContent: () => Content<T>,
    reloadDependencySource: DependencySource = dependencySource,
  ) {
    this.id = id;
    this.dependencySource = dependencySource;
    this.reloadDependencySource = reloadDependencySource;
    this.content = computed(computeContent);
  }

  snapshot(): Content<T> {
    return this.content();
  }

  value(): T {
    return ContentUtils.unwrap(this.content(), this.id);
  }

  async ensureLoaded(): Promise<void> {
    for (;;) {
      const before = this.dependencies();
      await Promise.all(before.map((dependency) => dependency.ensureLoaded()));
      const after = this.dependencies();
      const added = after.some((dependency) => !before.includes(dependency));
      if (!added) return;
    }
  }

  async reload(): Promise<void> {
    await Promise.all(this.reloadDependencies().map((dependency) => dependency.reload()));
    await this.ensureLoaded();
  }

  async waitForSettled(): Promise<void> {
    await waitUntil(() => !['idle', 'loading'].includes(this.content().status));
  }

  subscribe(listener: (content: Content<T>) => void): () => void {
    return effect(() => listener(this.content()));
  }

  /**
   * 读取当前的首次加载依赖来源。
   */
  private dependencies(): readonly ILoadableResource<unknown>[] {
    return typeof this.dependencySource === 'function' ? this.dependencySource() : this.dependencySource;
  }

  /**
   * 读取重载时要一并重载的依赖来源。
   */
  private reloadDependencies(): readonly ILoadableResource<unknown>[] {
    return typeof this.reloadDependencySource === 'function'
      ? this.reloadDependencySource()
      : this.reloadDependencySource;
  }
}

/**
 * 把多个依赖的五态合并成一个：任一 error 即 error，其次 not-found、loading、idle，全部 loaded 才调用 combine。
 *
 * @param dependencies 依赖资源数组。
 * @param combine 全部 loaded 时把各依赖的值合成结果。
 */
function aggregateContents<const Dependencies extends readonly IResourceView<unknown>[], Result>(
  dependencies: Dependencies,
  combine: (...values: ResourceValues<Dependencies>) => Result,
): Content<Result> {
  const contents = dependencies.map((dependency) => dependency.content());
  const error = contents.find((content) => content.status === 'error');
  if (error?.status === 'error') return { status: 'error', error: error.error };
  if (contents.some((content) => content.status === 'not-found')) return { status: 'not-found' };
  if (contents.some((content) => content.status === 'loading')) return { status: 'loading' };
  if (contents.some((content) => content.status === 'idle')) return { status: 'idle' };

  const values = contents.map((content) => (content as LoadedContent<unknown>).value);
  try {
    return {
      status: 'loaded',
      value: combine(...(values as ResourceValues<Dependencies>)),
    };
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * 构造一个由依赖派生内容的资源。
 *
 * @param id 资源身份（逻辑 id）。
 * @param dependencies 首次加载时要确保就绪的依赖来源。
 * @param computeContent 计算派生内容的函数。
 * @param reloadDependencies 重新加载时要一并重载的依赖来源，缺省与 dependencies 相同。
 */
export function computedResource<T>(
  id: string,
  dependencies: DependencySource,
  computeContent: () => Content<T>,
  reloadDependencies: DependencySource = dependencies,
): ILoadableResource<T> {
  return new ComputedResource(id, dependencies, computeContent, reloadDependencies);
}

/**
 * 构造一个把多个依赖的值聚合为一个结果的资源。
 *
 * @param id 资源身份（逻辑 id）。
 * @param dependencies 依赖资源数组。
 * @param combine 全部 loaded 时把各依赖的值合成结果。
 */
export function aggregateResource<const Dependencies extends readonly ILoadableResource<unknown>[], Result>(
  id: string,
  dependencies: Dependencies,
  combine: (...values: ResourceValues<Dependencies>) => Result,
): ILoadableResource<Result> {
  return new ComputedResource(id, dependencies, () => aggregateContents(dependencies, combine));
}

/**
 * 把一个 not-found 的依赖降级为 loaded 的兜底值，其余状态原样透传。
 *
 * @param source 源依赖资源。
 * @param fallback not-found 时使用的兜底值。
 */
export function optional<T>(source: ILoadableResource<T>, fallback: T): ILoadableResource<T> {
  return new ComputedResource(`optional:${source.id}`, [source], () => {
    const content = source.content();
    return content.status === 'not-found' ? { status: 'loaded', value: fallback } : content;
  });
}
