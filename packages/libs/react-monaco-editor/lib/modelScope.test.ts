// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { MonacoModelScope } from './modelScope';

describe('MonacoModelScope', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reuses a stable model and synchronizes its latest value', () => {
    const scope = new MonacoModelScope();
    const first = scope.get({ id: 'function:a', value: 'first', language: 'javascript' });
    const second = scope.get({ id: 'function:a', value: 'second', language: 'javascript' });

    expect(second).toBe(first);
    expect(second.getValue()).toBe('second');
    scope.dispose();
    expect(first.isDisposed()).toBe(true);
  });

  it('delays disposal so a tab retained in the same turn keeps its model', () => {
    vi.useFakeTimers();
    const scope = new MonacoModelScope();
    const model = scope.get({ id: 'function:a', value: 'source', language: 'javascript' });

    scope.retain(new Set());
    scope.retain(new Set(['function:a']));
    vi.runAllTimers();
    expect(model.isDisposed()).toBe(false);

    scope.retain(new Set());
    vi.runAllTimers();
    expect(model.isDisposed()).toBe(true);
  });
});
