import { ReactElement, useEffect, useRef, useState } from 'react';
import { AssetCategoryKind } from '../../react';
import { IAssetImageDimensions, formatAssetFileSize, readImageDimensions } from '../model';

// 详情栏的文件信息：按素材路径读一次字节，用同一份字节同时得出「文件大小」与「图片尺寸」，
// 避免为两个数字各读一遍文件；字节缺失或读取失败时两行都不渲染，也不提示错误。

interface IAssetFileInfoState {
  /** 字节长度，用于格式化文件大小 */
  readonly byteLength: number;
  /** 从图片字节头解析出的宽高；非图片分类或解析失败时为 undefined */
  readonly dimensions?: IAssetImageDimensions;
}

export interface IAssetFileInfoProps {
  /** 当前分类的大分类，只有图片分类才解析尺寸 */
  readonly kind: AssetCategoryKind;
  /** 素材字节文件的资源路径 */
  readonly path: string;
  /** 素材字节的版本号，变化时重新读取字节 */
  readonly byteVersion: number;
  /**
   * 读取某素材字节
   * @param path 素材字节文件路径
   * @returns 字节；文件不存在或读取失败时为 undefined
   */
  loadBytes(path: string): Promise<Uint8Array | undefined>;
}

/**
 * 素材详情里的文件信息：文件大小一行，图片再加「宽 × 高」一行
 *
 * 一次 `loadBytes` 同时产出文件大小与图片尺寸；切换素材、切换分类或字节版本变化时清掉上次结果，
 * 避免旧数字残留。字节缺失 / 读取失败 / 尚未读到时两行都不渲染。
 * @param props 文件信息 props
 * @returns 文件信息元素；没有可用字节时为 null
 */
export function AssetFileInfo(props: IAssetFileInfoProps): ReactElement | null {
  const state = useState<IAssetFileInfoState | undefined>(undefined);
  const info = state[0];
  const setInfo = state[1];
  const latestLoadBytes = useRef(props.loadBytes);
  const kind = props.kind;

  latestLoadBytes.current = props.loadBytes;

  useEffect(() => {
    let cancelled = false;

    setInfo(undefined);
    void latestLoadBytes
      .current(props.path)
      .then((bytes) => {
        if (cancelled || bytes === undefined) return;

        setInfo({
          byteLength: bytes.byteLength,
          dimensions: kind === AssetCategoryKind.Image ? readImageDimensions(bytes) : undefined,
        });
      })
      .catch(() => undefined);

    return (): void => {
      cancelled = true;
    };
  }, [props.path, props.byteVersion, kind, setInfo]);

  if (info === undefined) return null;

  return (
    <>
      <div className="asset-detail-bytes" data-test-id="asset-detail-bytes">
        {formatAssetFileSize(info.byteLength)}
      </div>
      {info.dimensions === undefined ? null : (
        <div className="asset-detail-size" data-test-id="asset-detail-size">
          {`${info.dimensions.width} × ${info.dimensions.height}`}
        </div>
      )}
    </>
  );
}
