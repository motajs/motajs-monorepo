import { useStore } from '@tanstack/react-store';
import { Store } from '@tanstack/store';
import { ReactElement, useState } from 'react';
import { MAP_CELL_SIZE } from '../constants';
import { buildMapRenderModel } from '../model/renderModel';
import { IMapCellPosition, IMapDocument, IMapPanelViewState, IMapViewport, MapPanelStatus } from '../types';
import { MapSurface } from './MapSurface';

// 地图面板的视图：按面板发布的状态渲染加载 / 错误 / 就绪三种界面。
// 本视图只接 props，不 import MapPanel；渲染模型在这里每次渲染时现算，再交给 MapSurface 消费。

export interface IMapPanelViewProps {
  /** 面板视图状态的订阅源 */
  readonly store: Store<IMapPanelViewState>;
  /**
   * 在某个格子上落下一笔
   * @param position 目标格子坐标
   */
  onPaintCell(position: IMapCellPosition): void;
  /** 把内存改动保存回宿主 */
  onSave(): void;
  /** 重新打开当前地图 */
  onRetry(): void;
  /**
   * 读取图块图片的字节
   * @param path 图片相对项目根的路径
   * @returns 字节；读取失败时为 undefined
   */
  loadBytes?(path: string): Promise<Uint8Array | undefined>;
}

/**
 * 把面板状态翻译成外壳可读的短标记
 * @param status 面板数据状态
 * @returns 短标记
 */
function statusToken(status: MapPanelStatus): string {
  if (status === MapPanelStatus.Ready) return 'ready';
  if (status === MapPanelStatus.Error || status === MapPanelStatus.ListError) return 'error';
  if (status === MapPanelStatus.Loading || status === MapPanelStatus.ListLoading) return 'loading';

  return 'not-opened';
}

/**
 * 把指针位置换算成地图格子坐标；落在地图外时返回 undefined
 * @param clientX 指针在视口中的横坐标
 * @param clientY 指针在视口中的纵坐标
 * @param rect 画布容器的定位矩形
 * @param document 当前地图文档
 * @param viewport 视口左上角所在的格子坐标
 * @returns 格子坐标；越界时为 undefined
 */
function resolvePointerCell(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  document: IMapDocument,
  viewport: IMapViewport,
): IMapCellPosition | undefined {
  const x = Math.floor((clientX - rect.left) / MAP_CELL_SIZE) + viewport.left;
  const y = Math.floor((clientY - rect.top) / MAP_CELL_SIZE) + viewport.top;

  if (x < 0 || y < 0 || x >= document.width || y >= document.height) return undefined;

  return { x, y };
}

export function MapPanelView(props: IMapPanelViewProps): ReactElement {
  const view = useStore(props.store);
  const surfaceErrorState = useState(false);
  const surfaceError = surfaceErrorState[0];
  const setSurfaceError = surfaceErrorState[1];

  if (view.status === MapPanelStatus.Error || view.status === MapPanelStatus.ListError) {
    return (
      <div className="emap-panel" data-test-id="map-panel" data-status="error">
        <div className="emap-error" data-test-id="map-error">
          <div className="emap-error-title">地图加载失败</div>
          <div className="emap-error-detail">请检查这张地图的数据是否存在，或稍后重试。</div>
          <button type="button" data-test-id="map-retry" onClick={props.onRetry}>
            重试
          </button>
        </div>
      </div>
    );
  }

  if (view.status !== MapPanelStatus.Ready || view.document === undefined) {
    return (
      <div className="emap-panel" data-test-id="map-panel" data-status={statusToken(view.status)}>
        <div className="emap-loading" data-test-id="map-loading">
          正在加载地图…
        </div>
      </div>
    );
  }

  const document = view.document;
  const width = document.width * MAP_CELL_SIZE;
  const height = document.height * MAP_CELL_SIZE;
  const model = buildMapRenderModel(document, {
    width,
    height,
    currentLayerId: view.currentLayerId ?? '',
    aboveLayerOpacity: view.aboveLayerOpacity,
    viewport: view.viewport,
    bigMap: view.bigMap,
    passMarks: view.passMarks,
    selection: view.selection,
    preview: view.preview,
    hover: view.hover,
  });
  const notice = view.notice !== undefined ? view.notice : view.error !== undefined ? `保存失败：${view.error}` : '';

  return (
    <div className="emap-panel" data-test-id="map-panel" data-status="ready">
      <div className="emap-toolbar">
        <button type="button" data-test-id="map-save" disabled={!view.unsaved || view.saving} onClick={props.onSave}>
          保存地图
        </button>
        {view.unsaved ? (
          <span className="emap-unsaved" data-test-id="map-unsaved">
            未保存
          </span>
        ) : null}
        <span className="emap-notice" data-test-id="map-notice">
          {notice}
        </span>
      </div>
      {surfaceError ? (
        <div className="emap-canvas-error" data-test-id="map-canvas-error">
          画布初始化失败，请检查浏览器是否支持 WebGL。
        </div>
      ) : (
        <div
          className="emap-canvas"
          data-test-id="map-canvas"
          tabIndex={0}
          aria-label="地图画布，左键绘制"
          style={{ position: 'relative', width, height, lineHeight: 0 }}
          onPointerDown={(event): void => {
            if (event.button !== 0) return;

            event.currentTarget.setPointerCapture?.(event.pointerId);

            const position = resolvePointerCell(
              event.clientX,
              event.clientY,
              event.currentTarget.getBoundingClientRect(),
              document,
              view.viewport,
            );

            if (position !== undefined) props.onPaintCell(position);
          }}
        >
          <MapSurface
            model={model}
            loadBytes={props.loadBytes}
            imageVersion={view.paletteVersion}
            onError={(): void => setSurfaceError(true)}
          />
        </div>
      )}
    </div>
  );
}
