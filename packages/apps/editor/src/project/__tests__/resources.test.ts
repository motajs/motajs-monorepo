import { effect, signal } from 'alien-signals';
import { describe, expect, it } from 'vitest';

import type { ReadonlySignal } from '@/fs/interfaces';
import type { Content } from '@/fs/types';
import { aggregateResource, computedResource, optional, type LoadableResource } from '@/project/resources';
import { waitUntil } from '@/utils/base/signal';

class TestResource<T> implements LoadableResource<T> {
  readonly content: ReadonlySignal<Content<T>>;
  readonly id: string;
  ensureCalls = 0;
  initialLoads = 0;
  reloadCalls = 0;
  private readonly mutableContent: ReturnType<typeof signal<Content<T>>>;
  private readonly loadedValue: T;

  constructor(id: string, initial: Content<T>, loadedValue: T) {
    this.id = id;
    this.mutableContent = signal(initial);
    this.content = this.mutableContent as ReadonlySignal<Content<T>>;
    this.loadedValue = loadedValue;
  }

  snapshot(): Content<T> {
    return this.mutableContent();
  }

  value(): T {
    const content = this.mutableContent();
    if (content.status !== 'loaded') throw new Error(`${this.id} is ${content.status}`);
    return content.value;
  }

  subscribe(listener: (content: Content<T>) => void): () => void {
    return effect(() => listener(this.mutableContent()));
  }

  async ensureLoaded(): Promise<void> {
    this.ensureCalls += 1;
    const content = this.mutableContent();
    if (content.status === 'loading') {
      await this.waitForSettled();
      return;
    }
    if (content.status !== 'idle') return;
    this.initialLoads += 1;
    this.mutableContent({ status: 'loading' });
    await Promise.resolve();
    this.mutableContent({ status: 'loaded', value: this.loadedValue });
  }

  async reload(): Promise<void> {
    this.reloadCalls += 1;
    if (this.mutableContent().status === 'loading') {
      await this.waitForSettled();
      return;
    }
    this.mutableContent({ status: 'loading' });
    await Promise.resolve();
    this.mutableContent({ status: 'loaded', value: this.loadedValue });
  }

  async waitForSettled(): Promise<void> {
    await waitUntil(() => !['idle', 'loading'].includes(this.mutableContent().status));
  }
}

describe('computed resources', () => {
  it('optional converts only not-found into a loaded fallback', async () => {
    const source = new TestResource<Record<string, number>>('source', { status: 'not-found' }, { answer: 42 });
    const optionalSource = optional(source, {});

    expect(optionalSource.snapshot()).toEqual({ status: 'loaded', value: {} });
    await optionalSource.ensureLoaded();
    expect(source.reloadCalls).toBe(0);
    expect(optionalSource.snapshot()).toEqual({ status: 'loaded', value: {} });

    await optionalSource.reload();
    expect(source.reloadCalls).toBe(1);
    expect(optionalSource.value()).toEqual({ answer: 42 });
  });

  it('aggregate ensure loads only idle leaves without invalidating loaded siblings', async () => {
    const first = new TestResource('first', { status: 'loaded', value: 1 }, 1);
    const second = new TestResource('second', { status: 'loaded', value: 2 }, 2);
    const third = new TestResource('third', { status: 'loaded', value: 3 }, 3);
    const missing = new TestResource('missing', { status: 'idle' }, 4);
    const firstStatuses: string[] = [];
    const unsubscribe = first.subscribe((content) => firstStatuses.push(content.status));
    const aggregate = aggregateResource('sum', [first, second, third, missing] as const, (a, b, c, d) => a + b + c + d);

    expect(aggregate.snapshot().status).toBe('idle');
    await aggregate.ensureLoaded();

    expect(aggregate.value()).toBe(10);
    expect(missing.ensureCalls).toBe(1);
    expect([first.reloadCalls, second.reloadCalls, third.reloadCalls]).toEqual([0, 0, 0]);
    expect(firstStatuses).toEqual(['loaded']);
    unsubscribe();
  });

  it('aggregate reload explicitly reloads every dependency', async () => {
    const first = new TestResource('first', { status: 'loaded', value: 1 }, 10);
    const second = new TestResource('second', { status: 'loaded', value: 2 }, 20);
    const aggregate = aggregateResource('sum', [first, second] as const, (a, b) => a + b);

    await aggregate.reload();

    expect([first.reloadCalls, second.reloadCalls]).toEqual([1, 1]);
    expect(aggregate.value()).toBe(30);
  });

  it('coalesces concurrent initial loading at the leaf', async () => {
    const source = new TestResource('source', { status: 'idle' }, 7);
    const aggregate = aggregateResource('mapped', [source] as const, (value) => value * 2);

    await Promise.all([aggregate.ensureLoaded(), aggregate.ensureLoaded(), aggregate.ensureLoaded()]);

    expect(aggregate.value()).toBe(14);
    expect(source.reloadCalls).toBe(0);
    expect(source.ensureCalls).toBe(3);
    expect(source.initialLoads).toBe(1);
  });

  it('ensures dependencies discovered after a parent loads', async () => {
    const parent = new TestResource('parent', { status: 'idle' }, ['child']);
    const child = new TestResource('child', { status: 'idle' }, 5);
    const dependencies = () => (parent.snapshot().status === 'loaded' ? [parent, child] : [parent]);
    const dynamic = computedResource('dynamic', dependencies, () => {
      const parentContent = parent.content();
      if (parentContent.status !== 'loaded') return parentContent as Content<number>;
      return child.content();
    });

    await dynamic.ensureLoaded();

    expect(dynamic.value()).toBe(5);
    expect(parent.initialLoads).toBe(1);
    expect(child.initialLoads).toBe(1);
  });
});
