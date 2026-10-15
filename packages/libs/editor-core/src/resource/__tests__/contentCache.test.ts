import { describe, expect, test } from 'vitest';
import { ContentCache } from '../contentCache';

describe('ContentCache 读写', () => {
  // 未写入时未命中
  test('未命中返回 undefined', () => {
    const cache = new ContentCache(64);

    expect(cache.get('missing')).toBeUndefined();
  });

  // set 后 get 得到同一引用
  test('set 后 get 返回同一引用', () => {
    const cache = new ContentCache(64);
    const payload = new Uint8Array([1, 2, 3]);

    cache.set('bin', payload);

    expect(cache.get('bin')).toBe(payload);
  });
});

describe('ContentCache 字节上限与 LRU', () => {
  // 超过总上限时先入的最先被淘汰
  test('超过字节上限时按 LRU 淘汰最旧条目', () => {
    const cache = new ContentCache(10);

    cache.set('a', 'aaaa');
    cache.set('b', 'bbbb');
    cache.set('c', 'cccc');

    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe('bbbb');
    expect(cache.get('c')).toBe('cccc');
  });

  // get 刷新使用序，最近被访问的条目不会被优先淘汰
  test('get 刷新使用序后淘汰最久未用者', () => {
    const cache = new ContentCache(10);

    cache.set('a', 'aaaa');
    cache.set('b', 'bbbb');
    cache.get('a');
    cache.set('c', 'cccc');

    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe('aaaa');
    expect(cache.get('c')).toBe('cccc');
  });

  // 单条内容超过总上限时不入缓存
  test('单条超过上限时不入缓存', () => {
    const cache = new ContentCache(4);

    cache.set('big', '12345');

    expect(cache.get('big')).toBeUndefined();
  });
});

describe('ContentCache 失效与清空', () => {
  // invalidate 移除单条并减字节，使后续可容纳新条目
  test('invalidate 释放字节使新条目可容纳', () => {
    const cache = new ContentCache(10);

    cache.set('a', 'aaaa');
    cache.set('b', 'bbbb');
    cache.invalidate('a');
    cache.set('c', 'cccccc');

    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('c')).toBe('cccccc');
  });

  // clear 清空全部条目
  test('clear 清空全部条目', () => {
    const cache = new ContentCache(10);

    cache.set('a', 'aaaa');
    cache.clear();

    expect(cache.get('a')).toBeUndefined();
  });
});
