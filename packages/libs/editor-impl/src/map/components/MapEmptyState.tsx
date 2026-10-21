import { Button, Spin, Tooltip } from 'antd';
import { ReactElement } from 'react';
import { IMapSummary, MapPanelStatus } from '../types';

// 首次打开面板时的主体：清单加载 / 清单失败 / 无地图 / 有条目的内联列表四态。
// 本组件只接 props；打开哪张地图、怎么新建都由调用方决定。

export interface IMapEmptyStateProps {
  /** 清单当前状态 */
  readonly listStatus: MapPanelStatus;
  /** 宿主提供的地图清单 */
  readonly mapSummaries: readonly IMapSummary[];
  /** 清单读取失败的原因；没有失败时为 undefined */
  readonly error?: string;
  /** 宿主是否注入新建地图能力 */
  readonly canCreateMap: boolean;
  /**
   * 打开清单里的某张地图
   * @param mapId 目标地图标识
   */
  onSelectMap(mapId: string): void;
  /** 打开新建地图弹窗 */
  onOpenCreate(): void;
  /** 重新读取地图清单 */
  onRetry(): void;
}

interface IMapCreateButtonProps {
  /** 宿主是否注入新建地图能力 */
  readonly canCreateMap: boolean;
  /** 打开新建地图弹窗 */
  onOpenCreate(): void;
}

/**
 * 空态里的主按钮「新建地图」；宿主没有新建能力时禁用并给 tooltip
 * @param props 按钮 props
 * @returns 主按钮元素
 */
function MapCreateButton(props: IMapCreateButtonProps): ReactElement {
  return (
    <Tooltip title={props.canCreateMap ? undefined : '当前项目不支持新建地图。'}>
      <span className="emap-tooltip-wrap">
        <Button
          className="emap-empty-create"
          type="primary"
          size="middle"
          autoInsertSpace={false}
          disabled={!props.canCreateMap}
          title={props.canCreateMap ? undefined : '当前项目不支持新建地图。'}
          data-test-id="map-empty-create"
          onClick={props.onOpenCreate}
        >
          新建地图
        </Button>
      </span>
    </Tooltip>
  );
}

/**
 * 清单加载态：居中指示器 + 固定文案
 * @returns 加载态元素
 */
function renderLoading(): ReactElement {
  return (
    <div className="emap-empty" data-test-id="map-empty" data-state="loading">
      <Spin size="small" />
      <span className="emap-empty-body">正在读取地图清单…</span>
    </div>
  );
}

/**
 * 清单失败态：破坏性标题、说明与重试
 * @param error 宿主给出的失败原因
 * @param onRetry 重新读取清单
 * @returns 失败态元素
 */
function renderError(error: string | undefined, onRetry: () => void): ReactElement {
  return (
    <div className="emap-empty is-error" data-test-id="map-empty" data-state="error">
      <div className="emap-empty-title" title={error}>
        地图清单读取失败
      </div>
      <div className="emap-empty-body">请稍后重试。</div>
      <Button size="small" autoInsertSpace={false} data-test-id="map-empty-retry" onClick={onRetry}>
        重试
      </Button>
    </div>
  );
}

/**
 * 无地图态：固定文案与新建入口，不渲染空列表
 * @param props 空态 props
 * @returns 无地图态元素
 */
function renderNoMaps(props: IMapEmptyStateProps): ReactElement {
  return (
    <div className="emap-empty" data-test-id="map-empty" data-state="empty">
      <div className="emap-empty-title">项目中还没有地图</div>
      <div className="emap-empty-body">点击「新建地图」创建第一张地图。</div>
      <MapCreateButton canCreateMap={props.canCreateMap} onOpenCreate={props.onOpenCreate} />
    </div>
  );
}

/**
 * 有条目但尚未打开：内联可滚动清单，每行一个全宽地图名按钮
 * @param props 空态 props
 * @returns 未打开态元素
 */
function renderMapList(props: IMapEmptyStateProps): ReactElement {
  return (
    <div className="emap-empty" data-test-id="map-empty" data-state="list">
      <div className="emap-empty-title">尚未打开地图</div>
      <div className="emap-empty-body">从下方列表选择一张地图开始编辑，或新建一张地图。</div>
      <div className="emap-empty-list" data-test-id="map-empty-list">
        {props.mapSummaries.map((summary) => (
          <button
            key={summary.id}
            type="button"
            className="emap-empty-item"
            title={summary.name}
            data-test-id={`map-empty-item-${summary.id}`}
            onClick={(): void => props.onSelectMap(summary.id)}
          >
            {summary.name}
          </button>
        ))}
      </div>
      <MapCreateButton canCreateMap={props.canCreateMap} onOpenCreate={props.onOpenCreate} />
    </div>
  );
}

/**
 * 首次打开面板的主体：按清单状态渲染四态之一
 * @param props 空态 props
 * @returns 空态元素
 */
export function MapEmptyState(props: IMapEmptyStateProps): ReactElement {
  if (props.listStatus === MapPanelStatus.ListLoading) return renderLoading();
  if (props.listStatus === MapPanelStatus.ListError) return renderError(props.error, props.onRetry);
  if (props.mapSummaries.length === 0) return renderNoMaps(props);

  return renderMapList(props);
}
