// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { useCurrentFn, useNode } from './common';

describe('core hooks', () => {
  test('useCurrentFn keeps its identity and calls the latest callback', () => {
    const { result, rerender } = renderHook(({ value }) => useCurrentFn(() => value), { initialProps: { value: 1 } });
    const callback = result.current;

    expect(callback()).toBe(1);
    rerender({ value: 2 });
    expect(result.current).toBe(callback);
    expect(callback()).toBe(2);
  });

  test('useNode exposes a stable callback ref with cleanup', () => {
    const { result, rerender } = renderHook(() => useNode<HTMLDivElement>());
    const mount = result.current[1];
    const node = document.createElement('div');
    let cleanup: void | (() => void);

    act(() => {
      cleanup = mount(node);
    });
    expect(result.current[0]).toBe(node);
    rerender();
    expect(result.current[1]).toBe(mount);

    act(() => {
      cleanup?.();
    });
    expect(result.current[0]).toBeNull();
  });
});
