import { ReactElement } from 'react';
import { AssetCategoryKind } from '../../react';
import { AssetFontSample } from './AssetFontSample';
import { useAssetObjectUrl } from './useAssetObjectUrl';

export interface IAssetPreviewProps {
  /** 素材的大分类，决定预览形态 */
  readonly kind: AssetCategoryKind;
  /** 由面板推导好的字节 MIME 类型 */
  readonly mime: string;
  /** 由面板生成且不含路径的稳定 CSS 字体族名；非字体分类可省略 */
  readonly fontFamily?: string;
  /** 素材字节的版本号，变化时重新读取字节 */
  readonly byteVersion: number;
  /** 延迟读取素材字节的回调 */
  loadBytes: () => Promise<Uint8Array | undefined>;
}

/**
 * 素材预览：按大分类分流为位图 / 内联播放器 / 字体样例 / 动画占位
 *
 * 字节拿不到时显示占位提示而不是破图；MIME 由面板按真实扩展名推导（转码后可能是 WebP / WebM），
 * 组件不再自行解析路径；所有文本经 React 文本节点渲染。
 * @param props 预览 props
 * @returns 预览元素
 */
export function AssetPreview(props: IAssetPreviewProps): ReactElement {
  const kind = props.kind;
  const url = useAssetObjectUrl(props.loadBytes, props.mime, props.byteVersion);
  const missing: ReactElement = (
    <div className="asset-preview-missing" data-test-id="asset-preview-missing">
      预览不可用
    </div>
  );

  if (kind === AssetCategoryKind.Image) {
    if (url === undefined) return missing;

    return <img className="asset-preview-image" src={url} alt="素材预览" style={{ imageRendering: 'pixelated' }} />;
  }

  if (kind === AssetCategoryKind.Audio) {
    if (url === undefined) return missing;

    return <audio className="asset-preview-audio" controls src={url} />;
  }

  if (kind === AssetCategoryKind.Font) {
    return (
      <AssetFontSample
        fontFamily={props.fontFamily ?? ''}
        url={url}
        text="魔塔 Mota 0123456789"
        className="asset-preview-font"
      />
    );
  }

  return <div className="asset-preview-animation">动画预览</div>;
}
