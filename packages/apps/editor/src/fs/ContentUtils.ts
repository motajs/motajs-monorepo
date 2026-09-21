/**
 * ContentUtils - Content<T> 的通用辅助函数
 *
 * 提供函数式操作工具，简化 Content<T> 的使用
 */

import { match } from 'ts-pattern';
import type { Content } from './types';

export const ContentUtils = {
  /**
   * map: 转换成功值（类似 Rust 的 map）
   *
   * @example
   * const length = ContentUtils.map(fileContent, content => content.length);
   */
  map<T, R>(content: Content<T>, fn: (value: T) => R): Content<R> {
    return match(content)
      .with({ status: 'loaded' }, (c) => {
        try {
          return { status: 'loaded' as const, value: fn(c.value) };
        } catch (err) {
          return { status: 'error' as const, error: err as Error };
        }
      })
      .otherwise((c) => c as Content<R>);
  },

  /**
   * andThen: 链式转换，可能失败（类似 Rust 的 and_then）
   *
   * @example
   * const parsed = ContentUtils.andThen(fileContent, content => {
   *   try {
   *     return { status: 'loaded', value: JSON.parse(content) };
   *   } catch (err) {
   *     return { status: 'error', error: err as Error };
   *   }
   * });
   */
  andThen<T, R>(content: Content<T>, fn: (value: T) => Content<R>): Content<R> {
    return match(content)
      .with({ status: 'loaded' }, (c) => {
        try {
          return fn(c.value);
        } catch (err) {
          return { status: 'error' as const, error: err as Error };
        }
      })
      .otherwise((c) => c as Content<R>);
  },

  /**
   * unwrapOr: 获取值或默认值（类似 Rust 的 unwrap_or）
   *
   * @example
   * const content = ContentUtils.unwrapOr(fileContent, '');
   */
  unwrapOr<T>(content: Content<T>, defaultValue: T): T {
    return match(content)
      .with({ status: 'loaded' }, (c) => c.value)
      .otherwise(() => defaultValue);
  },

  /**
   * unwrapOrElse: 获取值或执行函数
   *
   * @example
   * const content = ContentUtils.unwrapOrElse(fileContent, () => 'default');
   */
  unwrapOrElse<T>(content: Content<T>, fn: (content: Content<T>) => T): T {
    return match(content)
      .with({ status: 'loaded' }, (c) => c.value)
      .otherwise(() => fn(content));
  },

  // 类型守卫

  isIdle<T>(content: Content<T>): content is { status: 'idle' } {
    return content.status === 'idle';
  },

  isLoading<T>(content: Content<T>): content is { status: 'loading' } {
    return content.status === 'loading';
  },

  isLoaded<T>(content: Content<T>): content is { status: 'loaded'; value: T } {
    return content.status === 'loaded';
  },

  isNotFound<T>(content: Content<T>): content is { status: 'not-found' } {
    return content.status === 'not-found';
  },

  isError<T>(content: Content<T>): content is { status: 'error'; error: Error } {
    return content.status === 'error';
  },

  /**
   * 是否可用（已加载）
   */
  isAvailable<T>(content: Content<T>): content is { status: 'loaded'; value: T } {
    return content.status === 'loaded';
  },

  /**
   * 是否处于错误状态
   */
  hasError<T>(content: Content<T>): content is { status: 'not-found' } | { status: 'error'; error: Error } {
    return content.status === 'not-found' || content.status === 'error';
  },

  /**
   * unwrap: 获取值或抛出异常（类似 Rust 的 unwrap）
   *
   * 如果 content 是 loaded 状态，返回值
   * 否则抛出带有上下文信息的异常
   *
   * @param content - Content 对象
   * @param name - 资源名称（用于错误消息）
   *
   * @example
   * const data = ContentUtils.unwrap(content, "Tower data");
   * // 如果失败，抛出: "Tower data file not found" 或 "Failed to load Tower data: ..."
   */
  unwrap<T>(content: Content<T>, name: string): T {
    return match(content)
      .with({ status: 'loaded' }, (c) => c.value)
      .with({ status: 'not-found' }, () => {
        throw new Error(`${name} file not found`);
      })
      .with({ status: 'error' }, (c) => {
        throw new Error(`Failed to load ${name}: ${c.error.message}`);
      })
      .otherwise(() => {
        throw new Error(`${name} not available (status: ${content.status})`);
      });
  },
};
