import { Button, Spin } from 'antd';
import { ReactElement } from 'react';
import { AssetCategoryKind, IAssetCategory } from '../../react';
import { resolveTranscodedPath } from '../model';
import { ASSET_WEBM_EXTENSION, ASSET_WEBP_EXTENSION, IAssetTranscodeOptions } from '../transcode/types';
import { AssetPanelMode, AssetPanelStatus, IAssetEntry, IAssetPanelViewState, IAssetUpload } from '../types';
import { AssetConfigView } from './AssetConfigView';
import { AssetDetail } from './AssetDetail';
import { AssetGrid } from './AssetGrid';
import { AssetToolbar } from './AssetToolbar';
import { CategoryNav } from './CategoryNav';
import { TranscodeModal } from './TranscodeModal';

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
  /** 取消并关闭瘦身转码弹窗 */
  onCancelTranscode?(): void;
  /**
   * 开始批量转码
   * @param names 选中的素材名
   * @param options 转码参数
   */
  onStartTranscode?(names: readonly string[], options: IAssetTranscodeOptions): void;
  /**
   * 上传一个本地文件为当前分类新增素材
   * @param upload 上传的原始文件名与字节
   */
  onAddAsset?(upload: IAssetUpload): void;
  /**
   * 用本地文件替换当前选中素材
   * @param upload 上传的原始文件名与字节
   */
  onReplace?(upload: IAssetUpload): void;
  /**
   * 上传的文件被拒绝时向用户提示原因
   * @param reason 拒绝对用户显示的原因
   */
  onReject?(reason: string): void;
  /**
   * 删除当前选中素材
   * @param name 目标素材名
   */
  onDelete?(name: string): void;
  /** 打开当前选中素材的配置表单 */
  onOpenConfig?(): void;
  /**
   * 配置模式下改一个字段
   * @param path 配置字段路径
   * @param value 目标值
   */
  onChange?(path: string, value: unknown): void;
  /** 关闭配置表单、退回素材列表 */
  onBack?(): void;
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

/**
 * 取某分类转码后的目标扩展名
 * @param kind 分类的大分类
 * @returns 图片为 `.webp`，其余为 `.webm`
 */
function transcodeExtension(kind: AssetCategoryKind): string {
  return kind === AssetCategoryKind.Image ? ASSET_WEBP_EXTENSION : ASSET_WEBM_EXTENSION;
}

/**
 * 取出真正可转码的素材条目：源文件已是目标扩展名的条目转码是空操作（只会原地重编码），排除掉
 * @param category 当前分类
 * @param entries 当前分类的条目
 * @returns 可提交转码的素材条目
 */
function transcodeCandidates(category: IAssetCategory, entries: readonly IAssetEntry[]): readonly IAssetEntry[] {
  const extension = transcodeExtension(category.kind);

  return entries.filter((entry) => resolveTranscodedPath(entry.path, extension) !== entry.path);
}

/** 未接入选择回调时的缺省实现：不做任何事 */
function noopSelectAsset(): void {}

/** 未接入配置字段提交回调时的缺省实现：不做任何事 */
function noopConfigChange(): void {}

/** 未接入保存回调时的缺省实现：不做任何事 */
function noopConfigSave(): void {}

/** 未接入返回回调时的缺省实现：不做任何事 */
function noopConfigBack(): void {}

/** 未接入转码取消回调时的缺省实现：不做任何事 */
function noopTranscodeCancel(): void {}

/** 未接入转码开始回调时的缺省实现：不做任何事 */
function noopTranscodeStart(): void {}

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
        kind={category.kind}
        selectedName={view.selectedName}
        onSelect={props.onSelectAsset ?? noopSelectAsset}
        loadBytes={props.loadBytes}
      />
      <AssetDetail
        entry={selected}
        kind={category.kind}
        onReplace={props.onReplace}
        onReject={props.onReject}
        onDelete={(): void => {
          if (selected !== undefined) props.onDelete?.(selected.name);
        }}
        onOpenConfig={props.onOpenConfig}
        loadBytes={props.loadBytes}
      />
    </div>
  );
}

/**
 * 取「当前环境不支持该分类转码」的提示文案
 * @param category 当前分类
 * @returns 面向用户的提示文案
 */
function transcodeUnsupportedMessage(category: IAssetCategory): string {
  return category.kind === AssetCategoryKind.Image ? '当前环境不支持图片转码' : '当前环境不支持音频转码';
}

/**
 * 素材面板视图：工具栏 + 三栏主体，并按数据状态分发加载 / 空 / 错误 / 就绪呈现
 * @param props 面板视图 props
 * @returns 面板视图元素
 */
export function AssetPanelView(props: IAssetPanelViewProps): ReactElement {
  const state = props.view;
  const category = currentCategory(state);
  const busy = state.status === AssetPanelStatus.Loading || state.status === AssetPanelStatus.NoCategory;
  const transcodeSupported =
    category !== undefined && (category.kind === AssetCategoryKind.Image || category.kind === AssetCategoryKind.Audio);
  const transcodeEnabled = state.status === AssetPanelStatus.Ready && transcodeSupported && state.transcodeCapable;
  const transcodeNotice =
    category !== undefined && transcodeSupported && state.status === AssetPanelStatus.Ready && !state.transcodeCapable
      ? transcodeUnsupportedMessage(category)
      : undefined;

  return (
    <div className="asset-panel" data-test-id="asset-panel" data-status={statusToken(state.status)}>
      <AssetToolbar
        title={category === undefined ? '' : category.label}
        unsaved={state.unsaved}
        disabled={busy}
        transcodeEnabled={transcodeEnabled}
        onSave={props.onSave}
        onTranscode={props.onTranscode}
        onAddAsset={props.onAddAsset}
        onReject={props.onReject}
      />
      {transcodeNotice === undefined ? null : (
        <div className="asset-notice" data-test-id="asset-transcode-notice">
          {transcodeNotice}
        </div>
      )}
      <div className="asset-body">
        <CategoryNav categories={state.categories} currentId={state.categoryId} onSelect={props.onSelectCategory} />
        {state.mode === AssetPanelMode.Configure ? (
          <AssetConfigView
            title={state.configName ?? ''}
            rows={state.rows}
            errors={state.configErrors}
            unsaved={state.unsaved}
            onChange={props.onChange ?? noopConfigChange}
            onSave={props.onSave ?? noopConfigSave}
            onBack={props.onBack ?? noopConfigBack}
          />
        ) : (
          renderContent(props, category)
        )}
      </div>
      {state.transcodeOpen && category !== undefined ? (
        <TranscodeModal
          open
          kind={category.kind}
          entries={transcodeCandidates(category, state.entries)}
          loadBytes={props.loadBytes}
          busy={state.transcoding}
          onCancel={props.onCancelTranscode ?? noopTranscodeCancel}
          onStart={props.onStartTranscode ?? noopTranscodeStart}
        />
      ) : null}
    </div>
  );
}
