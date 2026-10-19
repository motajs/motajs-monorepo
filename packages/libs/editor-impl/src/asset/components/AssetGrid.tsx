import { ReactElement } from 'react';
import { AssetCategoryKind } from '../../react';
import { IAssetEntry } from '../types';
import { AssetCardPreview } from './AssetCardPreview';

export interface IAssetGridProps {
  /** 当前分类下的素材条目，按列表顺序渲染 */
  readonly entries: readonly IAssetEntry[];
  /** 当前分类的大分类，决定卡片预览形态 */
  readonly kind: AssetCategoryKind;
  /** 当前选中的素材名；未选中时为 undefined */
  readonly selectedName?: string;
  /**
   * 选中某个素材
   * @param name 目标素材名
   */
  onSelect(name: string): void;
  /**
   * 读取某素材字节，供卡片预览使用
   * @param path 素材字节文件路径
   * @returns 字节；文件不存在或读取失败时为 undefined
   */
  loadBytes(path: string): Promise<Uint8Array | undefined>;
}

/**
 * 取一张卡片应带的类名：基础类 + 选中 / 缺失标记
 * @param entry 该卡片对应的素材条目
 * @param selectedName 当前选中的素材名
 * @returns 卡片类名
 */
function cardClassName(entry: IAssetEntry, selectedName?: string): string {
  const names = ['asset-card'];

  if (entry.name === selectedName) names.push('is-selected');
  if (!entry.exists) names.push('is-missing');

  return names.join(' ');
}

/**
 * 素材卡片网格：自适应列的卡片列表，选中带 `is-selected`、字节缺失带 `is-missing`
 *
 * 卡片是真实可聚焦的 `<button>`，支持 Enter / Space 选中；名称单行省略并把全名放进 `title`。
 * @param props 网格 props
 * @returns 网格元素
 */
export function AssetGrid(props: IAssetGridProps): ReactElement {
  return (
    <div className="asset-grid" data-test-id="asset-grid">
      {props.entries.map((entry) => (
        <button
          key={entry.name}
          type="button"
          className={cardClassName(entry, props.selectedName)}
          title={entry.name}
          data-test-id={`asset-card-${entry.name}`}
          data-exists={String(entry.exists)}
          onClick={(): void => props.onSelect(entry.name)}
        >
          <span className="asset-card-thumb">
            <AssetCardPreview kind={props.kind} path={entry.path} exists={entry.exists} loadBytes={props.loadBytes} />
          </span>
          <span className="asset-card-name">{entry.name}</span>
          {entry.exists ? null : (
            <span className="asset-card-missing" data-test-id={`asset-card-missing-${entry.name}`}>
              缺失
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
