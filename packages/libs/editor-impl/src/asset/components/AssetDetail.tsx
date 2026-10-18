import { Button } from 'antd';
import { ReactElement } from 'react';
import { AssetCategoryKind } from '../../react';
import { IAssetEntry } from '../types';
import { AssetPreview } from './AssetPreview';

export interface IAssetDetailProps {
  /** 当前选中的素材；未选中时为 undefined */
  readonly entry?: IAssetEntry;
  /** 当前分类的大分类，决定预览形态 */
  readonly kind: AssetCategoryKind;
  /** 用本地文件替换当前素材 */
  onReplace?(): void;
  /** 删除当前素材 */
  onDelete?(): void;
  /** 打开当前素材的配置表单 */
  onOpenConfig?(): void;
  /**
   * 读取某素材字节，供预览使用
   * @param path 素材字节文件路径
   * @returns 字节；文件不存在或读取失败时为 undefined
   */
  loadBytes(path: string): Promise<Uint8Array | undefined>;
}

/**
 * 素材详情 / 预览栏：未选中给引导文案，选中后给名称 / 路径 / 缺失提示 / 预览 / 操作行
 * @param props 详情 props
 * @returns 详情元素
 */
export function AssetDetail(props: IAssetDetailProps): ReactElement {
  const entry = props.entry;

  if (entry === undefined) {
    return (
      <div className="asset-detail" data-test-id="asset-detail">
        <div className="asset-detail-empty" data-test-id="asset-detail-empty">
          选择一个素材查看详情
        </div>
      </div>
    );
  }

  return (
    <div className="asset-detail" data-test-id="asset-detail">
      <div className="asset-detail-title">{entry.name}</div>
      <div className="asset-detail-path" title={entry.path}>
        {entry.path}
      </div>
      {entry.exists ? null : (
        <div className="asset-detail-hint" data-test-id="asset-detail-missing">
          文件已登记，但工程目录中不存在。
        </div>
      )}
      <div className="asset-detail-preview">
        <AssetPreview
          key={entry.path}
          kind={props.kind}
          loadBytes={(): Promise<Uint8Array | undefined> => props.loadBytes(entry.path)}
        />
      </div>
      <div className="asset-detail-actions">
        <Button size="small" autoInsertSpace={false} data-test-id="asset-detail-replace" onClick={props.onReplace}>
          替换
        </Button>
        <Button size="small" autoInsertSpace={false} data-test-id="asset-detail-delete" onClick={props.onDelete}>
          删除
        </Button>
        <Button size="small" autoInsertSpace={false} data-test-id="asset-detail-config" onClick={props.onOpenConfig}>
          配置
        </Button>
      </div>
    </div>
  );
}
