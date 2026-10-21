import { useEffect, useRef, useState } from 'react';
import { IMapTileGroup, MapImageStatus } from '../types';

// 把图块图片的字节变成可回收的 blob 地址：字节由调用方经资源层读取，本 hook 不做 I/O。
// 路径先经过守卫：绝对路径与含 `..` 段的路径直接拒绝，不请求资源层。

/** 读取图片字节的回调 */
type MapImageBytesLoader = (path: string) => Promise<Uint8Array | undefined>;

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

export interface IMapTileGroupUrls {
  /** 分组标识 → 该组图片的 blob 地址 */
  readonly urls: Readonly<Record<string, string | undefined>>;
  /** 分组标识 → 该组图片的读取状态 */
  readonly status: Readonly<Record<string, MapImageStatus>>;
}

/**
 * 按扩展名推断图片的 MIME 类型
 * @param path 图片相对项目根的路径
 * @returns 可交给 Blob 的 MIME 类型；未知扩展名按 PNG 处理
 */
function resolveImageMime(path: string): string {
  const lower = path.toLowerCase();

  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';

  return 'image/png';
}

/**
 * 读取单个图片路径并生成 blob 地址；路径被拒绝或字节读不到时返回 undefined
 * @param path 图片相对项目根的路径
 * @param loadBytes 延迟读取字节的回调
 * @returns 可用的 `blob:` 地址；拿不到字节时为 undefined
 */
async function readGroupUrl(path: string, loadBytes: MapImageBytesLoader): Promise<string | undefined> {
  if (!isSafeImagePath(path)) return undefined;

  let bytes: Uint8Array | undefined;

  try {
    bytes = await loadBytes(path);
  } catch {
    return undefined;
  }

  if (bytes === undefined) return undefined;

  return URL.createObjectURL(new Blob([bytes.slice()], { type: resolveImageMime(path) }));
}

/**
 * 批量把每个图块分组的图片变成可回收的 blob 地址
 *
 * 同一图片路径只读取一次，结果分给共享该路径的所有分组；`version` 变化时先回收旧地址再重取，
 * 卸载时同样回收。整个批量过程只用一个 `useEffect`，不在循环里调用 hook。
 * @param groups 当前文档的图块分组；未打开地图时为 undefined
 * @param loadBytes 面板注入的取字节回调
 * @param version 重试计数；变化时重新读取字节
 * @returns 分组标识到图片地址、图片状态的映射
 */
export function useMapTileGroupUrls(
  groups: readonly IMapTileGroup[] | undefined,
  loadBytes: MapImageBytesLoader | undefined,
  version: number,
): IMapTileGroupUrls {
  const state = useState<IMapTileGroupUrls>(() => ({ urls: {}, status: {} }));
  const snapshot = state[0];
  const setSnapshot = state[1];
  const latest = useRef(loadBytes);

  latest.current = loadBytes;

  useEffect(() => {
    let cancelled = false;
    const created: string[] = [];

    if (groups === undefined || groups.length === 0 || latest.current === undefined) {
      setSnapshot({ urls: {}, status: {} });
      return (): void => {};
    }

    const idsByPath: Map<string, string[]> = new Map();

    for (const group of groups) {
      const ids = idsByPath.get(group.imagePath);

      if (ids === undefined) idsByPath.set(group.imagePath, [group.id]);
      else ids.push(group.id);
    }

    const pending: Record<string, MapImageStatus> = {};

    for (const group of groups) pending[group.id] = MapImageStatus.Loading;

    setSnapshot({ urls: {}, status: pending });

    for (const [path, groupIds] of idsByPath) {
      void readGroupUrl(path, latest.current).then((url) => {
        if (cancelled) {
          if (url !== undefined) URL.revokeObjectURL(url);

          return;
        }

        if (url !== undefined) created.push(url);

        setSnapshot((current) => {
          const urls = { ...current.urls };
          const status = { ...current.status };

          for (const id of groupIds) {
            if (url === undefined) {
              status[id] = MapImageStatus.Error;
              continue;
            }

            urls[id] = url;
            status[id] = MapImageStatus.Ready;
          }

          return { urls, status };
        });
      });
    }

    return (): void => {
      cancelled = true;

      for (const url of created) URL.revokeObjectURL(url);
    };
  }, [groups, version, setSnapshot]);

  return snapshot;
}
