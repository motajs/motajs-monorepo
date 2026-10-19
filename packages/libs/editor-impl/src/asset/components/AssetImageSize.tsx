import { ReactElement, useEffect, useRef, useState } from 'react';
import { IAssetImageDimensions, readImageDimensions } from '../model';

// 图片尺寸行：按素材路径读一次字节，用纯字节头解析宽高；读不到或解析失败时什么都不渲染，也不提示错误。

export interface IAssetImageSizeProps {
  /** 素材字节文件的资源路径 */
  readonly path: string;
  /**
   * 读取某素材字节
   * @param path 素材字节文件路径
   * @returns 字节；文件不存在或读取失败时为 undefined
   */
  loadBytes(path: string): Promise<Uint8Array | undefined>;
}

/**
 * 素材详情里的「宽 × 高」一行
 *
 * 只在解析出合法尺寸时渲染；切换素材时把上次结果清掉，避免旧尺寸残留。
 * @param props 尺寸行 props
 * @returns 尺寸文本元素；没有可用尺寸时为 null
 */
export function AssetImageSize(props: IAssetImageSizeProps): ReactElement | null {
  const state = useState<IAssetImageDimensions | undefined>(undefined);
  const dimensions = state[0];
  const setDimensions = state[1];
  const latestLoadBytes = useRef(props.loadBytes);

  latestLoadBytes.current = props.loadBytes;

  useEffect(() => {
    let cancelled = false;

    setDimensions(undefined);
    void latestLoadBytes
      .current(props.path)
      .then((bytes) => {
        if (cancelled || bytes === undefined) return;

        setDimensions(readImageDimensions(bytes));
      })
      .catch(() => undefined);

    return (): void => {
      cancelled = true;
    };
  }, [props.path, setDimensions]);

  if (dimensions === undefined) return null;

  return (
    <div className="asset-detail-size" data-test-id="asset-detail-size">
      {`${dimensions.width} × ${dimensions.height}`}
    </div>
  );
}
