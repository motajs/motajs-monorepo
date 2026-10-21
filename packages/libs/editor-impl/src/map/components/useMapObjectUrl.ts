import { useEffect, useRef, useState } from 'react';

// 把图块图片的字节变成可回收的 blob 地址：字节由调用方经资源层读取，本 hook 不做 I/O。
// 路径先经过守卫：绝对路径与含 `..` 段的路径直接拒绝，不请求资源层。

export interface IMapObjectUrlOptions {
  /** 图片相对项目根的路径 */
  readonly path: string;
  /** 图片的 MIME 类型 */
  readonly mime: string;
  /** 字节版本号；变化时重新读取字节 */
  readonly version: number;
  /**
   * 延迟读取图片字节
   * @param path 图片路径
   * @returns 字节；读取失败时为 undefined
   */
  loadBytes(path: string): Promise<Uint8Array | undefined>;
}

/**
 * 判断图片路径是否允许交给资源层：拒绝空路径、绝对路径与含 `..` 段的路径
 * @param path 图片相对项目根的路径
 * @returns 路径合法时为 true
 */
function isSafeImagePath(path: string): boolean {
  if (path.length === 0) return false;
  if (path.startsWith('/') || path.startsWith('\\')) return false;

  return !path.split(/[\\/]/).includes('..');
}

/**
 * 把一段延迟读取的字节变成可回收的 `blob:` 地址
 *
 * 路径、MIME 或字节版本变化时先回收旧地址再读取新字节；卸载时同样回收，避免泄漏。
 * 路径被守卫拒绝或读取失败时返回 undefined。
 * @param options 图片路径、MIME、字节版本与延迟读取回调
 * @returns 可用的 `blob:` 地址；拿不到字节时为 undefined
 */
export function useMapObjectUrl(options: IMapObjectUrlOptions): string | undefined {
  const state = useState<string | undefined>(undefined);
  const url = state[0];
  const setUrl = state[1];
  const latest = useRef(options.loadBytes);

  latest.current = options.loadBytes;

  useEffect(() => {
    let cancelled = false;
    let created: string | undefined;

    setUrl(undefined);

    if (!isSafeImagePath(options.path)) return undefined;

    void latest
      .current(options.path)
      .then((bytes) => {
        if (cancelled || bytes === undefined) return;

        const next = URL.createObjectURL(new Blob([bytes.slice()], { type: options.mime }));

        if (cancelled) {
          URL.revokeObjectURL(next);
          return;
        }

        created = next;
        setUrl(next);
      })
      .catch(() => undefined);

    return (): void => {
      cancelled = true;

      if (created !== undefined) URL.revokeObjectURL(created);
    };
  }, [options.path, options.mime, options.version, setUrl]);

  return url;
}
