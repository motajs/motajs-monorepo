import { Button, Spin } from 'antd';
import { ReactElement } from 'react';
import { AssetCategoryKind, IAssetCategory } from '../../react';
import { AssetPanelStatus, IAssetPanelViewState } from '../types';
import { AssetDetail } from './AssetDetail';
import { AssetGrid } from './AssetGrid';
import { AssetToolbar } from './AssetToolbar';
import { CategoryNav } from './CategoryNav';

export interface IAssetPanelViewProps {
  /** 面板视图状态，由数据层订阅后传入 */
  readonly view: IAssetPanelViewState;
  /**
   * 切换当前分类
   * @param categoryId 目标分类标识
   */
  onSelectCategory(categoryId: string): void;
  /**
   * 选中某个素材
   * @param name 目标素材名
   */
  onSelectAsset?(name: string): void;
  /** 把未落盘的列表与配置改动写回 */
  onSave?(): void;
  /** 打开瘦身转码入口 */
  onTranscode?(): void;
  /** 上传一个本地文件为当前分类新增素材 */
  onAddAsset?(): void;
  /** 用本地文件替换当前选中素材 */
  onReplace?(): void;
  /** 删除当前选中素材 */
  onDelete?(): void;
  /** 打开当前选中素材的配置表单 */
  onOpenConfig?(): void;
  /** 重新读取当前分类 */
  onRetry?(): void;
  /**
   * 读取某素材字节，供预览使用
   * @param path 素材字节文件路径
   * @returns 字节；文件不存在或读取失败时为 undefined
   */
  loadBytes(path: string): Promise<Uint8Array | undefined>;
}

/**
 * 取面板数据状态对应的稳定标记串，供根节点暴露与测试观察
 * @param status 面板数据状态
 * @returns 状态的稳定标记串
 */
function statusToken(status: AssetPanelStatus): string {
  if (status === AssetPanelStatus.NoCategory) return 'no-category';
  if (status === AssetPanelStatus.Loading) return 'loading';
  if (status === AssetPanelStatus.Ready) return 'ready';
  if (status === AssetPanelStatus.Empty) return 'empty';

  return 'error';
}

/**
 * 在当前分类清单里按标识取分类
 * @param view 面板视图状态
 * @returns 命中的分类；清单为空或标识不匹配时为 undefined
 */
function currentCategory(view: IAssetPanelViewState): IAssetCategory | undefined {
  const categoryId = view.categoryId;

  if (categoryId === undefined) return undefined;

  return view.categories.find((category) => category.id === categoryId);
}

/** 未接入选择回调时的缺省实现：不做任何事 */
function noopSelectAsset(): void {}

/**
 * 渲染面板主区：加载 / 错误 / 空都给出固定呈现，就绪时渲染网格与详情
 * @param props 面板视图 props
 * @param category 当前分类；未命中时为 undefined
 * @returns 主区元素
 */
function renderContent(props: IAssetPanelViewProps, category: IAssetCategory | undefined): ReactElement {
  const view = props.view;

  if (view.status === AssetPanelStatus.Loading) {
    return (
      <div className="asset-content">
        <div className="asset-state" data-test-id="asset-state-loading">
          <Spin size="small" />
          <span className="asset-state-body">正在加载素材…</span>
        </div>
      </div>
    );
  }

  if (view.status === AssetPanelStatus.Error) {
    return (
      <div className="asset-content">
        <div className="asset-state asset-state-error" data-test-id="asset-state-error">
          <div className="asset-state-title">素材加载失败</div>
          <div className="asset-state-body">请检查该分类的资源是否存在，或稍后重试。</div>
          <Button size="small" autoInsertSpace={false} data-test-id="asset-state-retry" onClick={props.onRetry}>
            重试
          </Button>
        </div>
      </div>
    );
  }

  if (view.status !== AssetPanelStatus.Ready || category === undefined) {
    return (
      <div className="asset-content">
        <div className="asset-state" data-test-id="asset-state-empty">
          <div className="asset-state-title">暂无素材</div>
          <div className="asset-state-body">该分类下还没有素材，点击「新增素材」上传一个本地文件。</div>
        </div>
      </div>
    );
  }

  const selected = view.entries.find((entry) => entry.name === view.selectedName);

  return (
    <div className="asset-content">
      <AssetGrid
        entries={view.entries}
        selectedName={view.selectedName}
        onSelect={props.onSelectAsset ?? noopSelectAsset}
      />
      <AssetDetail
        entry={selected}
        kind={category.kind}
        onReplace={props.onReplace}
        onDelete={props.onDelete}
        onOpenConfig={props.onOpenConfig}
        loadBytes={props.loadBytes}
      />
    </div>
  );
}

/**
 * 素材面板视图：工具栏 + 三栏主体，并按数据状态分发加载 / 空 / 错误 / 就绪呈现
 * @param props 面板视图 props
 * @returns 面板视图元素
 */
export function AssetPanelView(props: IAssetPanelViewProps): ReactElement {
  const view = props.view;
  const category = currentCategory(view);
  const busy = view.status === AssetPanelStatus.Loading || view.status === AssetPanelStatus.NoCategory;
  const transcodeEnabled =
    view.status === AssetPanelStatus.Ready &&
    category !== undefined &&
    (category.kind === AssetCategoryKind.Image || category.kind === AssetCategoryKind.Audio);

  return (
    <div className="asset-panel" data-test-id="asset-panel" data-status={statusToken(view.status)}>
      <AssetToolbar
        title={category === undefined ? '' : category.label}
        unsaved={view.unsaved}
        disabled={busy}
        transcodeEnabled={transcodeEnabled}
        onSave={props.onSave}
        onTranscode={props.onTranscode}
        onAddAsset={props.onAddAsset}
      />
      <div className="asset-body">
        <CategoryNav categories={view.categories} currentId={view.categoryId} onSelect={props.onSelectCategory} />
        {renderContent(props, category)}
      </div>
    </div>
  );
}
