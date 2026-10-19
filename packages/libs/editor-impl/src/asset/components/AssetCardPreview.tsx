import { ReactElement } from 'react';
import { AssetCategoryKind } from '../../react';
import { resolveAssetMime } from '../model';
import { AssetFontSample } from './AssetFontSample';
import { useAssetObjectUrl } from './useAssetObjectUrl';

export interface IAssetCardPreviewProps {
  /** 当前分类的大分类，决定卡片预览形态 */
  readonly kind: AssetCategoryKind;
  /** 素材字节文件的资源路径 */
  readonly path: string;
  /** 该素材的字节文件是否存在 */
  readonly exists: boolean;
  /**
   * 读取某素材字节
   * @param path 素材字节文件路径
   * @returns 字节；文件不存在或读取失败时为 undefined
   */
  loadBytes(path: string): Promise<Uint8Array | undefined>;
}

/** 卡片内图片预览的 props */
interface IAssetCardBytesProps {
  /** 素材字节文件的资源路径 */
  readonly path: string;
  /**
   * 读取某素材字节
   * @param path 素材字节文件路径
   * @returns 字节；文件不存在或读取失败时为 undefined
   */
  loadBytes(path: string): Promise<Uint8Array | undefined>;
}

/** 卡片内波形图标的每根竖条高度（像素，对应 `viewBox` 的 32 高）；冻结以免成为可变的模块级容器 */
const WAVEFORM_BAR_HEIGHTS: readonly number[] = Object.freeze([8, 16, 24, 12, 28, 20, 10, 22, 14]);

/** 波形图标里每根竖条的宽度 */
const WAVEFORM_BAR_WIDTH = 2;

/** 波形图标里每根竖条的横向间距 */
const WAVEFORM_BAR_GAP = 4;

/** 波形图标的高度基准 */
const WAVEFORM_HEIGHT = 32;

/** 波形图标的左内边距 */
const WAVEFORM_PADDING = 2;

/**
 * 渲染固定波形图标
 *
 * 音频卡片不读字节、也不建 `blob:` 地址：波形是装饰性图标，用一个稳定的形状表明「这是一个音频」。
 * @returns 波形图标元素
 */
function AssetCardWaveform(): ReactElement {
  return (
    <svg
      className="asset-card-preview-icon"
      viewBox={`0 0 ${WAVEFORM_BAR_HEIGHTS.length * WAVEFORM_BAR_GAP + WAVEFORM_PADDING * 2} ${WAVEFORM_HEIGHT}`}
      aria-hidden="true"
      data-test-id="asset-card-preview-audio"
    >
      {WAVEFORM_BAR_HEIGHTS.map((height, index) => (
        <rect
          key={index}
          x={index * WAVEFORM_BAR_GAP + WAVEFORM_PADDING}
          y={(WAVEFORM_HEIGHT - height) / 2}
          width={WAVEFORM_BAR_WIDTH}
          height={height}
          rx={WAVEFORM_BAR_WIDTH / 2}
        />
      ))}
    </svg>
  );
}

/**
 * 卡片内的图片预览：字节可用时渲染位图，拿不到字节时不占位
 * @param props 预览 props
 * @returns 位图元素；字节不可用时为 null
 */
function AssetCardImage(props: IAssetCardBytesProps): ReactElement | null {
  const mime = resolveAssetMime(props.path, AssetCategoryKind.Image);
  const url = useAssetObjectUrl((): Promise<Uint8Array | undefined> => props.loadBytes(props.path), mime);

  if (url === undefined) return null;

  return <img data-test-id="asset-card-preview-image" alt="" loading="lazy" src={url} />;
}

/**
 * 卡片内的字体样例：用素材字体写「ABC」
 * @param props 预览 props
 * @returns 字体样例元素
 */
function AssetCardFont(props: IAssetCardBytesProps): ReactElement {
  const mime = resolveAssetMime(props.path, AssetCategoryKind.Font);
  const url = useAssetObjectUrl((): Promise<Uint8Array | undefined> => props.loadBytes(props.path), mime);

  return <AssetFontSample path={props.path} url={url} text="ABC" />;
}

/**
 * 素材卡片缩略图：按大分类分流为位图 / 波形图标 / 动画占位 / 字体样例
 *
 * 缺失由卡片右上角的徽标呈现，因此缩略图内只留一个空占位、不重复写字。只有图片与字体读字节；
 * 音频与动画不碰资源层，避免为一屏卡片批量读取无用的字节。
 * @param props 卡片预览 props
 * @returns 缩略图内容元素
 */
export function AssetCardPreview(props: IAssetCardPreviewProps): ReactElement | null {
  if (!props.exists) return <span className="asset-card-preview-missing" />;

  if (props.kind === AssetCategoryKind.Image) {
    return <AssetCardImage path={props.path} loadBytes={props.loadBytes} />;
  }

  if (props.kind === AssetCategoryKind.Audio) return <AssetCardWaveform />;

  if (props.kind === AssetCategoryKind.Font) {
    return (
      <span className="asset-card-preview-font" data-test-id="asset-card-preview-font">
        <AssetCardFont path={props.path} loadBytes={props.loadBytes} />
      </span>
    );
  }

  return (
    <span className="asset-card-preview-animation" data-test-id="asset-card-preview-animation">
      动画
    </span>
  );
}
