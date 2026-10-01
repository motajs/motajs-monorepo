import { match } from 'ts-pattern';
import { Content, ErrorContent, IdleContent, LoadedContent, LoadingContent, NotFoundContent } from './types';

/**
 * map：转换已加载的值（类似 Rust 的 map）；非 loaded 状态原样透传。
 *
 * @param content 待转换的内容。
 * @param fn 把 loaded 值映射为新值；抛错则转为 error 状态。
 *
 * @example
 * const length = ContentUtils.map(fileContent, content => content.length);
 */
function map<T, R>(content: Content<T>, fn: (value: T) => R): Content<R> {
  return match(content)
    .with({ status: 'loaded' }, (c) => {
      try {
        return { status: 'loaded' as const, value: fn(c.value) };
      } catch (err) {
        return { status: 'error' as const, error: err as Error };
      }
    })
    .otherwise((c) => c as Content<R>);
}

/**
 * andThen：链式转换，可能失败（类似 Rust 的 and_then）；非 loaded 状态原样透传。
 *
 * @param content 待转换的内容。
 * @param fn 把 loaded 值映射为新的内容；抛错则转为 error 状态。
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
function andThen<T, R>(content: Content<T>, fn: (value: T) => Content<R>): Content<R> {
  return match(content)
    .with({ status: 'loaded' }, (c) => {
      try {
        return fn(c.value);
      } catch (err) {
        return { status: 'error' as const, error: err as Error };
      }
    })
    .otherwise((c) => c as Content<R>);
}

/**
 * unwrapOr：取已加载的值，否则返回默认值（类似 Rust 的 unwrap_or）。
 *
 * @param content 待取值的内容。
 * @param defaultValue 非 loaded 时使用的默认值。
 *
 * @example
 * const content = ContentUtils.unwrapOr(fileContent, '');
 */
function unwrapOr<T>(content: Content<T>, defaultValue: T): T {
  return match(content)
    .with({ status: 'loaded' }, (c) => c.value)
    .otherwise(() => defaultValue);
}

/**
 * unwrapOrElse：取已加载的值，否则执行兜底函数（类似 Rust 的 unwrap_or_else）。
 *
 * @param content 待取值的内容。
 * @param fn 非 loaded 时调用，接收原内容并返回兜底值。
 *
 * @example
 * const content = ContentUtils.unwrapOrElse(fileContent, () => 'default');
 */
function unwrapOrElse<T>(content: Content<T>, fn: (content: Content<T>) => T): T {
  return match(content)
    .with({ status: 'loaded' }, (c) => c.value)
    .otherwise(() => fn(content));
}

// 类型守卫

/**
 * 是否为 idle 状态。
 *
 * @param content 待判定的内容。
 */
function isIdle<T>(content: Content<T>): content is IdleContent {
  return content.status === 'idle';
}

/**
 * 是否为 loading 状态。
 *
 * @param content 待判定的内容。
 */
function isLoading<T>(content: Content<T>): content is LoadingContent {
  return content.status === 'loading';
}

/**
 * 是否为 loaded 状态。
 *
 * @param content 待判定的内容。
 */
function isLoaded<T>(content: Content<T>): content is LoadedContent<T> {
  return content.status === 'loaded';
}

/**
 * 是否为 not-found 状态。
 *
 * @param content 待判定的内容。
 */
function isNotFound<T>(content: Content<T>): content is NotFoundContent {
  return content.status === 'not-found';
}

/**
 * 是否为 error 状态。
 *
 * @param content 待判定的内容。
 */
function isError<T>(content: Content<T>): content is ErrorContent {
  return content.status === 'error';
}

/**
 * 是否可用（已加载）。
 *
 * @param content 待判定的内容。
 */
function isAvailable<T>(content: Content<T>): content is LoadedContent<T> {
  return content.status === 'loaded';
}

/**
 * 是否处于错误状态（not-found 或 error）。
 *
 * @param content 待判定的内容。
 */
function hasError<T>(content: Content<T>): content is NotFoundContent | ErrorContent {
  return content.status === 'not-found' || content.status === 'error';
}

/**
 * unwrap：获取已加载的值，否则抛出带上下文的异常（类似 Rust 的 unwrap）。
 *
 * @param content 待取值的内容。
 * @param name 资源名称（用于错误消息）。
 *
 * @example
 * const data = ContentUtils.unwrap(content, "Tower data");
 * // 如果失败，抛出: "Tower data file not found" 或 "Failed to load Tower data: ..."
 */
function unwrap<T>(content: Content<T>, name: string): T {
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
}

// Phase 11 过渡别名，与其它 D-16 别名一并删除
export const ContentUtils = {
  map,
  andThen,
  unwrapOr,
  unwrapOrElse,
  isIdle,
  isLoading,
  isLoaded,
  isNotFound,
  isError,
  isAvailable,
  hasError,
  unwrap,
} as const;
