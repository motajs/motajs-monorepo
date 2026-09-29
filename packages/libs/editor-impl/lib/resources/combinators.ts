import { computed, effect } from 'alien-signals';

import { ILoadableResource, IResourceView, ReadonlySignal } from './interfaces';
import type { Content } from './types';
import { ContentUtils } from './contentUtils';
import { waitUntil } from './waitUntil';

type DependencySource = readonly ILoadableResource<unknown>[] | (() => readonly ILoadableResource<unknown>[]);

type ResourceValue<Resource> = Resource extends IResourceView<infer Value> ? Value : never;
type ResourceValues<Dependencies extends readonly IResourceView<unknown>[]> = {
  -readonly [Index in keyof Dependencies]: ResourceValue<Dependencies[Index]>;
};

export class ComputedResource<T> implements ILoadableResource<T> {
  readonly content: ReadonlySignal<Content<T>>;
  readonly id: string;
  private readonly dependencySource: DependencySource;
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

  private dependencies(): readonly ILoadableResource<unknown>[] {
    return typeof this.dependencySource === 'function' ? this.dependencySource() : this.dependencySource;
  }

  private reloadDependencies(): readonly ILoadableResource<unknown>[] {
    return typeof this.reloadDependencySource === 'function'
      ? this.reloadDependencySource()
      : this.reloadDependencySource;
  }
}

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

  const values = contents.map((content) => (content as { status: 'loaded'; value: unknown }).value);
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

export function computedResource<T>(
  id: string,
  dependencies: DependencySource,
  computeContent: () => Content<T>,
  reloadDependencies: DependencySource = dependencies,
): ILoadableResource<T> {
  return new ComputedResource(id, dependencies, computeContent, reloadDependencies);
}

export function aggregateResource<const Dependencies extends readonly ILoadableResource<unknown>[], Result>(
  id: string,
  dependencies: Dependencies,
  combine: (...values: ResourceValues<Dependencies>) => Result,
): ILoadableResource<Result> {
  return new ComputedResource(id, dependencies, () => aggregateContents(dependencies, combine));
}

export function optional<T>(source: ILoadableResource<T>, fallback: T): ILoadableResource<T> {
  return new ComputedResource(`optional:${source.id}`, [source], () => {
    const content = source.content();
    return content.status === 'not-found' ? { status: 'loaded', value: fallback } : content;
  });
}
