import { useEffect, useRef, useState } from 'react';

/**
 * 把一段延迟读取的字节变成可回收的 `blob:` 地址
 *
 * 调用方通过给预览组件设置 `key`（如素材路径）来触发换源；本 hook 依赖 `mime` 与字节版本重新拉取。
 * 字节版本变化（同一路径的字节被覆盖）会先回收旧的 `blob:` 地址再读取新字节，依赖变化或卸载时同样回收，避免泄漏。
 * @param loadBytes 延迟读取字节的回调
 * @param mime 字节对应的 MIME 类型
 * @param byteVersion 素材字节的版本号；变化时重新读取字节，缺省按 0 处理
 * @returns 可用的 `blob:` 地址；拿不到字节时为 undefined
 */
export function useAssetObjectUrl(
  loadBytes: () => Promise<Uint8Array | undefined>,
  mime: string,
  byteVersion: number = 0,
): string | undefined {
  const state = useState<string | undefined>(undefined);
  const url = state[0];
  const setUrl = state[1];
  const latest = useRef(loadBytes);

  latest.current = loadBytes;

  useEffect(() => {
    let cancelled = false;
    let created: string | undefined;

    setUrl(undefined);

    void latest
      .current()
      .then((bytes) => {
        if (cancelled || bytes === undefined) return;

        const next = URL.createObjectURL(new Blob([bytes.slice()], { type: mime }));

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
  }, [mime, byteVersion, setUrl]);

  return url;
}
