import { computed, effect } from 'alien-signals';

import type { ReadonlySignal } from '@/fs/interfaces';
import type { Content } from '@/fs/types';
import { ContentUtils } from '@/fs/ContentUtils';
import { waitUntil } from '@/utils/base/signal';

export interface ResourceView<T> {
  readonly id: string;
  readonly content: ReadonlySignal<Content<T>>;
  snapshot(): Content<T>;
  value(): T;
  subscribe(listener: (content: Content<T>) => void): () => void;
}

export interface LoadableResource<T> extends ResourceView<T> {
  ensureLoaded(): Promise<void>;
  reload(): Promise<void>;
  waitForSettled(): Promise<void>;
}

type DependencySource = readonly LoadableResource<unknown>[] | (() => readonly LoadableResource<unknown>[]);

type ResourceValue<Resource> = Resource extends ResourceView<infer Value> ? Value : never;
type ResourceValues<Dependencies extends readonly ResourceView<unknown>[]> = {
  -readonly [Index in keyof Dependencies]: ResourceValue<Dependencies[Index]>;
};

export class ComputedResource<T> implements LoadableResource<T> {
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

  private dependencies(): readonly LoadableResource<unknown>[] {
    return typeof this.dependencySource === 'function' ? this.dependencySource() : this.dependencySource;
  }

  private reloadDependencies(): readonly LoadableResource<unknown>[] {
    return typeof this.reloadDependencySource === 'function'
      ? this.reloadDependencySource()
      : this.reloadDependencySource;
  }
}

function aggregateContents<const Dependencies extends readonly ResourceView<unknown>[], Result>(
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
): LoadableResource<T> {
  return new ComputedResource(id, dependencies, computeContent, reloadDependencies);
}

export function aggregateResource<const Dependencies extends readonly LoadableResource<unknown>[], Result>(
  id: string,
  dependencies: Dependencies,
  combine: (...values: ResourceValues<Dependencies>) => Result,
): LoadableResource<Result> {
  return new ComputedResource(id, dependencies, () => aggregateContents(dependencies, combine));
}

export function optional<T>(source: LoadableResource<T>, fallback: T): LoadableResource<T> {
  return new ComputedResource(`optional:${source.id}`, [source], () => {
    const content = source.content();
    return content.status === 'not-found' ? { status: 'loaded', value: fallback } : content;
  });
}
