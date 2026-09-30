// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { Content, IResourceView, ResourceRegistryEntry } from '../types';
import { ResourceRegistry } from '../resourceRegistry';

/**
 * `ResourceRegistry`（RES-02）单元测试。
 *
 * 覆盖：按逻辑 id 登记/读取、未知 id 的 `get`/`has`/`ids` 行为、`getOrThrow` 抛错、重复 id 被拒且原条目存活、
 * disposer 只删除自己那一条（含「过期 disposer」守卫）、快照冻结且改动它不影响注册表、两个实例互不干扰
 * （T-04-02），以及非法 id（空串 / 纯空白 / 含空白 / `__proto__` / `constructor` / `prototype`）被拒
 * 且 `Object.prototype` 未被污染（T-04-01）。
 *
 * fixture 纪律（D-22 的约定半边）：本文件不声明模块级 fixture 表；期望值直接写在用例内。
 */

/** 一个最小的 `IResourceView` 测试替身：`content` 是稳定的 loaded 快照。 */
function makeResource<T>(id: string, value: T): IResourceView<T> {
  const content: Content<T> = { status: 'loaded', value };
  return {
    id,
    content: () => content,
    snapshot: () => content,
    value: () => value,
    subscribe: () => () => {},
  };
}

describe('ResourceRegistry', () => {
  it('按逻辑 id 登记并读回同一个资源', () => {
    const registry = new ResourceRegistry();
    const resource = makeResource('mota.tower', 42);
    const disposer = registry.register('mota.tower', resource);

    expect(registry.has('mota.tower')).toBe(true);
    expect(registry.get<number>('mota.tower')).toBe(resource);
    expect(registry.ids()).toEqual(['mota.tower']);
    expect(typeof disposer).toBe('function');
  });

  it('未知 id：get 返回 undefined、has 为 false、ids 为空', () => {
    const registry = new ResourceRegistry();
    expect(registry.get('nope')).toBeUndefined();
    expect(registry.has('nope')).toBe(false);
    expect(registry.ids()).toEqual([]);
  });

  it('getOrThrow 对未知 id 抛出命名该 id 的错误', () => {
    const registry = new ResourceRegistry();
    expect(() => registry.getOrThrow('missing.id')).toThrowError(/missing\.id/);
  });

  it('重复 id 被拒，且原条目存活', () => {
    const registry = new ResourceRegistry();
    const first = makeResource('mota.tower', 1);
    const second = makeResource('mota.tower', 2);
    registry.register('mota.tower', first);

    expect(() => registry.register('mota.tower', second)).toThrowError(/mota\.tower/);
    expect(registry.get<number>('mota.tower')).toBe(first);
    expect(registry.ids()).toEqual(['mota.tower']);
  });

  it('disposer 只删除自己那一条，且不误删后来者（过期 disposer 守卫）', () => {
    const registry = new ResourceRegistry();
    const first = makeResource('a', 1);
    const second = makeResource('b', 2);
    const disposeFirst = registry.register('a', first);
    const disposeSecond = registry.register('b', second);

    disposeFirst();
    expect(registry.has('a')).toBe(false);
    expect(registry.get('b')).toBe(second);

    // 过期 disposer：在 id 'a' 上重新登记后，旧的 disposer 不得删除新条目。
    const replacement = makeResource('a', 3);
    registry.register('a', replacement);
    disposeFirst();
    expect(registry.get<number>('a')).toBe(replacement);

    disposeSecond();
    expect(registry.has('b')).toBe(false);
    expect(registry.ids()).toEqual(['a']);
  });

  it('snapshot 返回冻结数组，改动它不影响注册表', () => {
    const registry = new ResourceRegistry();
    registry.register('a', makeResource('a', 1));

    const snapshot = registry.snapshot();
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(snapshot).toHaveLength(1);
    expect(Object.isFrozen(snapshot[0])).toBe(true);
    expect(snapshot[0]).toMatchObject({ id: 'a' });

    expect(() => {
      (snapshot as ResourceRegistryEntry[]).push({ id: 'b', resource: makeResource('b', 2) });
    }).toThrow();
    expect(registry.ids()).toEqual(['a']);
  });

  it('两个实例互不干扰（T-04-02）', () => {
    const first = new ResourceRegistry();
    const second = new ResourceRegistry();
    const resource = makeResource('mota.tower', 1);
    first.register('mota.tower', resource);

    expect(first.has('mota.tower')).toBe(true);
    expect(second.has('mota.tower')).toBe(false);
    expect(second.ids()).toEqual([]);

    // 同一 id 可在第二个实例上独立登记，互不冲突。
    const other = makeResource('mota.tower', 2);
    second.register('mota.tower', other);
    expect(second.get<number>('mota.tower')).toBe(other);
    expect(first.get<number>('mota.tower')).toBe(resource);
  });

  it('非法 id 逐个被拒，注册表保持为空且 Object.prototype 未被污染（T-04-01）', () => {
    const registry = new ResourceRegistry();
    const invalidIds = ['', '  ', 'a b', '__proto__', 'constructor', 'prototype'];

    for (const id of invalidIds) {
      expect(() => registry.register(id, makeResource(id, 1))).toThrowError();
    }
    expect(() => registry.register('a/b', makeResource('a/b', 1))).toThrowError();
    expect(() => registry.register('a..b', makeResource('a..b', 1))).toThrowError();

    expect(registry.ids()).toEqual([]);
    expect(Object.getPrototypeOf({})).toBe(Object.prototype);
    expect(Object.prototype).not.toHaveProperty('polluted');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('接受单段与多段的点分命名空间 id', () => {
    const registry = new ResourceRegistry();
    registry.register('tower', makeResource('tower', 1));
    registry.register('mota.tower.items', makeResource('mota.tower.items', 2));
    expect(registry.ids()).toEqual(['tower', 'mota.tower.items']);
  });
});
