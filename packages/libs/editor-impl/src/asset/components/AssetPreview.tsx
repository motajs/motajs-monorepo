import { ReactElement } from 'react';
import { AssetCategoryKind } from '../../react';
import { useAssetObjectUrl } from './useAssetObjectUrl';

export interface IAssetPreviewProps {
  /** 素材的大分类，决定预览形态 */
  readonly kind: AssetCategoryKind;
  /** 延迟读取素材字节的回调 */
  loadBytes: () => Promise<Uint8Array | undefined>;
}

/**
 * 取某分类预览字节对应的 MIME 类型
 * @param kind 素材大分类
 * @returns 该分类预览使用的 MIME 类型
 */
function previewMime(kind: AssetCategoryKind): string {
  if (kind === AssetCategoryKind.Image) return 'image/png';
  if (kind === AssetCategoryKind.Audio) return 'audio/mpeg';

  return 'application/octet-stream';
}

/**
 * 素材预览：按大分类分流为位图 / 内联播放器 / 字体样例 / 动画占位
 *
 * 字节拿不到时显示占位提示而不是破图；所有文本经 React 文本节点渲染。
 * @param props 预览 props
 * @returns 预览元素
 */
export function AssetPreview(props: IAssetPreviewProps): ReactElement {
  const kind = props.kind;
  const mime = previewMime(kind);
  const url = useAssetObjectUrl(props.loadBytes, mime);
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
    return <div className="asset-preview-font">魔塔 Mota 0123456789</div>;
  }

  return <div className="asset-preview-animation">动画预览</div>;
}
