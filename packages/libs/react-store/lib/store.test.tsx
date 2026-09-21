// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import type { FC, ReactNode } from 'react';
import { describe, expect, test } from 'vitest';
import { mergeStores } from './merge';
import { createStore } from './store';

describe('react store', () => {
  test('provides values and rejects consumers outside the provider', () => {
    const ValueStore = createStore(() => 'ready');
    const wrapper: FC<{ children: ReactNode }> = ({ children }) => (
      <ValueStore.Provider>{children}</ValueStore.Provider>
    );

    expect(renderHook(() => ValueStore.useStore(), { wrapper }).result.current).toBe('ready');
    expect(() => renderHook(() => ValueStore.useStore())).toThrow(
      'Component must be wrapped with <Container.Provider>',
    );
  });

  test('passes arguments to parameterful stores', () => {
    const ValueStore = createStore((value: number) => value * 2);
    const wrapper: FC<{ children: ReactNode }> = ({ children }) => (
      <ValueStore.Provider argument={3}>{children}</ValueStore.Provider>
    );

    expect(renderHook(() => ValueStore.useStore(), { wrapper }).result.current).toBe(6);
  });

  test('mergeStores keeps dependency order', () => {
    const ParentStore = createStore(() => 'parent');
    const ChildStore = createStore(() => `${ParentStore.useStore()}:child`);
    const GlobalStore = mergeStores([ParentStore, ChildStore]);

    expect(renderHook(() => ChildStore.useStore(), { wrapper: GlobalStore }).result.current).toBe('parent:child');
  });
});
