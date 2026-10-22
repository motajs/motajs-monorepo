import '../map.css';
import { useStore } from '@tanstack/react-store';
import { Store } from '@tanstack/store';
import { Button, Spin } from 'antd';
import { ReactElement, useEffect, useState } from 'react';
import { MAP_CELL_SIZE } from '../constants';
import { IPaintWrite, isTileCatalogEmpty } from '../model/document';
import { buildMapRenderModel } from '../model/renderModel';
import {
  IMapCellPosition,
  IMapCreateRequest,
  IMapDocument,
  IMapLayer,
  IMapPaletteSelection,
  IMapPanelViewState,
  IMapRect,
  IMapSizeLimit,
  IMapTileGroup,
  IMapViewport,
  MapBrushMode,
  MapDialogKind,
  MapImageStatus,
  MapPanelStatus,
  MapUnsavedChoice,
} from '../types';
import { MapCanvas } from './MapCanvas';
import { MapLayerDialog, MapNewDialog, MapUnsavedDialog } from './dialogs';
import { MapEmptyState } from './MapEmptyState';
import { MapPalette } from './MapPalette';
import { MapPropertiesDrawer } from './MapPropertiesDrawer';
import { MapToolbar } from './MapToolbar';
import { IMapTileGroupUrls, useMapTileGroupUrls } from './useMapObjectUrl';

// 地图面板的装配层：工具栏 / 主体 / 保存提示行 / 弹窗 / 属性抽屉都在这里按视图状态装配。
// 本视图只接 props，不 import 面板类；渲染模型在这里每次渲染时现算，再交给 MapSurface 消费。

export interface IMapPanelViewProps {
  /** 面板视图状态的订阅源 */
  readonly store: Store<IMapPanelViewState>;
  /**
   * 在某个格子上落下一笔（单格入口；画布的手势提交走 `onCommitCells`）
   * @param position 目标格子坐标
   */
  onPaintCell?(position: IMapCellPosition): void;
  /**
   * 提交一笔画布写入
   * @param writes 这一笔依次落下的写入
   */
  onCommitCells?(writes: readonly IPaintWrite[]): void;
  /**
   * 复制一块区域
   * @param rect 要复制的矩形
   */
  onCopyRegion?(rect: IMapRect): void;
  /**
   * 以指针格为左上角粘贴
   * @param position 粘贴位置的左上角格子
   */
  onPasteAt?(position: IMapCellPosition): void;
  /**
   * 清空一块选区
   * @param rect 要清空的矩形
   */
  onClearRegion?(rect: IMapRect): void;
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
  /**
   * 读取图块图片的字节，供调色板分组图使用
   * @param path 图片相对项目根的路径
   * @returns 字节；读取失败时为 undefined
   */
  loadTileBytes?(path: string): Promise<Uint8Array | undefined>;
  /**
   * 提交一次调色板选择
   * @param selection 新的选中
   */
  onSelectPattern?(selection: IMapPaletteSelection): void;
  /** 请求重新读取图块图片；只改图片版本，不改文档 */
  onRetryImages?(): void;
  /** 确认清除最近使用记录 */
  onClearRecent?(): void;
  /** 宿主是否注入新建地图能力；缺省视为没有 */
  readonly canCreateMap?: boolean;
  /** 宿主是否注入新增图层能力；缺省视为没有 */
  readonly canAddLayer?: boolean;
  /** 宿主是否注入地图属性能力；缺省视为没有 */
  readonly canOpenProperties?: boolean;
  /** 新建地图弹窗的尺寸上限；缺省表示不限制 */
  readonly maxMapSize?: IMapSizeLimit;
  /**
   * 打开清单里的某张地图
   * @param mapId 目标地图标识
   */
  onSelectMap?(mapId: string): void;
  /**
   * 打开受控弹窗
   * @param kind 要打开的弹窗
   */
  onOpenDialog?(kind: MapDialogKind): void;
  /** 关闭受控弹窗 */
  onCloseDialog?(): void;
  /** 打开地图属性抽屉 */
  onOpenProperties?(): void;
  /** 关闭地图属性抽屉 */
  onCloseProperties?(): void;
  /**
   * 切换当前图层
   * @param layerId 目标图层标识
   */
  onSelectLayer?(layerId: string): void;
  /**
   * 切换画笔模式
   * @param mode 目标画笔模式
   */
  onSelectBrushMode?(mode: MapBrushMode): void;
  /**
   * 开关只读通行度叠加层
   * @param value 为 true 时显示
   */
  onTogglePassability?(value: boolean): void;
  /**
   * 开关大地图模式
   * @param value 为 true 时进入大地图
   */
  onToggleBigMap?(value: boolean): void;
  /**
   * 移动视口
   * @param dx 水平方向移动的格子数
   * @param dy 垂直方向移动的格子数
   * @param byScreen 为 true 时按一屏移动
   */
  onMoveViewport?(dx: number, dy: number, byScreen: boolean): void;
  /**
   * 调整高于当前层的图层不透明度
   * @param value 新的不透明度，0..1
   */
  onAboveLayerOpacityChange?(value: number): void;
  /**
   * 提交新建地图请求
   * @param request 名称、尺寸与初始图层名
   * @returns 创建完成的异步结果
   */
  onCreateMap?(request: IMapCreateRequest): Promise<void>;
  /**
   * 提交新增图层请求
   * @param layerName 用户填写的图层名
   * @returns 加层完成的异步结果
   */
  onAddLayer?(layerName: string): Promise<void>;
  /**
   * 把未保存弹窗里的选择交给面板
   * @param choice 用户按下的按钮
   */
  onUnsavedDecision?(choice: MapUnsavedChoice): void;
  /**
   * 提交一个属性字段
   * @param path 字段路径段数组
   * @param value 新值
   */
  onPropertyChange?(path: readonly (string | number)[], value: unknown): void;
  /** 属性加载失败后的重试 */
  onPropertiesRetry?(): void;
}

interface IMapPanelBodyProps {
  /** 面板视图 props */
  readonly props: IMapPanelViewProps;
  /** 当前视图状态 */
  readonly view: IMapPanelViewState;
  /** 是否为窄布局 */
  readonly narrow: boolean;
  /** 分组图片地址与读取状态 */
  readonly groupImages: IMapTileGroupUrls;
}

interface IMapNoticeProps {
  /** 当前视图状态 */
  readonly view: IMapPanelViewState;
  /** 保存失败后的重试 */
  onRetry(): void;
}

/**
 * 不做任何事的缺省回调，供可选 props 缺省时使用
 */
function noop(): void {}

/**
 * 取图层显示名：宿主没给名字时回退为「图层 {N}」
 * @param layer 图层
 * @param index 图层在文档里的顺序下标
 * @returns 可显示的图层名
 */
function resolveLayerName(layer: IMapLayer, index: number): string {
  return layer.name.length === 0 ? `图层 ${index + 1}` : layer.name;
}

/**
 * 取当前图层的显示名；当前层不存在时回退到第一个图层
 * @param document 当前地图文档
 * @param currentLayerId 当前图层标识
 * @returns 状态条里显示的图层名
 */
function resolveCurrentLayerName(document: IMapDocument, currentLayerId: string | undefined): string {
  const index = document.layers.findIndex((layer) => layer.id === currentLayerId);

  if (index < 0) return document.layers.length === 0 ? '' : resolveLayerName(document.layers[0], 0);

  return resolveLayerName(document.layers[index], index);
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
 * 把各分组的图片状态归纳成一个整体状态：全部失败才算失败，还有分组在读取就算读取中
 * @param groups 当前文档的图块分组
 * @param status 分组标识 → 图片读取状态
 * @returns 调色板要显示的整体图片状态
 */
function resolvePaletteImageStatus(
  groups: readonly IMapTileGroup[],
  status: Readonly<Record<string, MapImageStatus>>,
): MapImageStatus {
  if (groups.length === 0) return MapImageStatus.Ready;

  let hasLoading = false;
  let allError = true;

  for (const group of groups) {
    const current = status[group.id] ?? MapImageStatus.Loading;

    if (current === MapImageStatus.Loading) hasLoading = true;
    if (current !== MapImageStatus.Error) allError = false;
  }

  if (allError) return MapImageStatus.Error;
  if (hasLoading) return MapImageStatus.Loading;

  return MapImageStatus.Ready;
}

/**
 * 订阅窗口宽度是否小于 900px；卸载时移除监听
 * @returns 当前是否为窄布局
 */
function useNarrowLayout(): boolean {
  const [narrow, setNarrow] = useState(() => window.innerWidth < 900);

  useEffect((): (() => void) => {
    const update = (): void => setNarrow(window.innerWidth < 900);

    window.addEventListener('resize', update);

    return (): void => window.removeEventListener('resize', update);
  }, []);

  return narrow;
}

/**
 * 没有外部回调时把视口状态直接写回订阅源，保证视口按钮在视图层仍然可用
 * @param view 当前视图状态
 * @param dx 水平方向移动的格子数
 * @param dy 垂直方向移动的格子数
 * @param byScreen 为 true 时按一屏移动
 * @returns 新的视口左上角
 */
function resolveMovedViewport(view: IMapPanelViewState, dx: number, dy: number, byScreen: boolean): IMapViewport {
  const document = view.document;
  const screenStep = Math.max(1, Math.floor(window.innerWidth / MAP_CELL_SIZE));
  const stepX = byScreen ? screenStep : 1;
  const stepY = byScreen ? screenStep : 1;
  const maxLeft = document === undefined ? 0 : Math.max(0, document.width - 1);
  const maxTop = document === undefined ? 0 : Math.max(0, document.height - 1);
  const left = Math.min(maxLeft, Math.max(0, view.viewport.left + dx * stepX));
  const top = Math.min(maxTop, Math.max(0, view.viewport.top + dy * stepY));

  return { left, top };
}

/**
 * 渲染地图加载中的画布区
 * @returns 加载态元素
 */
function renderLoadingBody(): ReactElement {
  return (
    <div className="emap-canvas-state" data-test-id="map-loading">
      <Spin size="small" />
      <span className="emap-state-body">正在加载地图…</span>
    </div>
  );
}

/**
 * 渲染地图加载失败的画布区
 * @param error 宿主给出的失败原因
 * @param onRetry 重新打开当前地图
 * @returns 失败态元素
 */
function renderErrorBody(error: string | undefined, onRetry: () => void): ReactElement {
  return (
    <div className="emap-canvas-state is-error" data-test-id="map-error">
      <div className="emap-state-title" title={error}>
        地图加载失败
      </div>
      <div className="emap-state-body">请检查这张地图的数据是否存在，或稍后重试。</div>
      <Button size="small" autoInsertSpace={false} data-test-id="map-retry" onClick={onRetry}>
        重试
      </Button>
    </div>
  );
}

/**
 * 渲染就绪态的画布区与图块调色板；渲染模型在这里现算，画布只把本地叠加状态补进模型交给 Pixi 表面
 * @param input 主体渲染输入
 * @returns 就绪态主体元素
 */
function renderReadyBody(input: IMapPanelBodyProps): ReactElement {
  const view = input.view;
  const document = view.document;

  if (document === undefined) return renderLoadingBody();

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
  });
  const layerName = resolveCurrentLayerName(document, view.currentLayerId);
  const moveViewport = (dx: number, dy: number, byScreen: boolean): void => {
    if (input.props.onMoveViewport !== undefined) {
      input.props.onMoveViewport(dx, dy, byScreen);
      return;
    }

    input.props.store.setState({
      ...input.props.store.state,
      viewport: resolveMovedViewport(input.props.store.state, dx, dy, byScreen),
    });
  };
  const toggleBigMap = (value: boolean): void => {
    if (input.props.onToggleBigMap !== undefined) {
      input.props.onToggleBigMap(value);
      return;
    }

    input.props.store.setState({ ...input.props.store.state, bigMap: value });
  };

  return (
    <div className="emap-body">
      <MapCanvas
        document={document}
        model={model}
        currentLayerId={view.currentLayerId ?? ''}
        viewport={view.viewport}
        bigMap={view.bigMap}
        brushMode={view.brushMode}
        pattern={view.paletteSelection.pattern}
        clipboard={view.clipboard}
        canPaint={!isTileCatalogEmpty(document)}
        layerName={layerName}
        narrow={input.narrow}
        imageVersion={view.paletteVersion}
        loadBytes={input.props.loadBytes}
        onCommitCells={input.props.onCommitCells ?? noop}
        onCopyRegion={input.props.onCopyRegion ?? noop}
        onPasteAt={input.props.onPasteAt ?? noop}
        onClearRegion={input.props.onClearRegion ?? noop}
        onMoveViewport={moveViewport}
        onToggleBigMap={toggleBigMap}
      />
      <div className="emap-palette-slot">
        <MapPalette
          groups={document.tileGroups}
          groupUrls={input.groupImages.urls}
          groupStatus={input.groupImages.status}
          imageStatus={resolvePaletteImageStatus(document.tileGroups, input.groupImages.status)}
          selection={view.paletteSelection}
          recentTiles={view.recentTiles}
          recentStatus={view.recentStatus}
          onSelectPattern={input.props.onSelectPattern ?? noop}
          onRetryImages={input.props.onRetryImages ?? noop}
          onClearRecent={input.props.onClearRecent ?? noop}
        />
      </div>
    </div>
  );
}

/**
 * 按状态渲染主体：未打开 / 清单状态交给空态，加载 / 失败 / 就绪交给画布区
 * @param input 主体渲染输入
 * @returns 主体元素
 */
function renderPanelBody(input: IMapPanelBodyProps): ReactElement {
  const view = input.view;

  if (
    view.status === MapPanelStatus.NotOpened ||
    view.status === MapPanelStatus.NoMaps ||
    view.status === MapPanelStatus.ListLoading ||
    view.status === MapPanelStatus.ListError
  ) {
    return (
      <MapEmptyState
        listStatus={view.status}
        mapSummaries={view.summaries}
        error={view.listError}
        canCreateMap={input.props.canCreateMap ?? false}
        onSelectMap={(mapId): void => input.props.onSelectMap?.(mapId)}
        onOpenCreate={(): void => input.props.onOpenDialog?.(MapDialogKind.New)}
        onRetry={input.props.onRetry}
      />
    );
  }

  if (view.status === MapPanelStatus.Error) return renderErrorBody(view.error, input.props.onRetry);
  if (view.status !== MapPanelStatus.Ready) return renderLoadingBody();

  return renderReadyBody(input);
}

/**
 * 渲染底部保存提示行：保存中 / 已保存 / 破坏性失败 + 重试
 * @param props 提示行 props
 * @returns 提示行元素
 */
function renderNotice(props: IMapNoticeProps): ReactElement {
  const view = props.view;
  const failed = view.error !== undefined && !view.saving;
  const text = view.saving ? '正在保存…' : failed ? `保存失败：${view.error}` : (view.notice ?? '');

  return (
    <div className={failed ? 'emap-notice is-error' : 'emap-notice'} data-test-id="map-notice">
      <span className="emap-notice-text" title={text}>
        {text}
      </span>
      {failed ? (
        <Button size="small" autoInsertSpace={false} data-test-id="map-notice-retry" onClick={props.onRetry}>
          重试
        </Button>
      ) : null}
    </div>
  );
}

/**
 * 地图面板视图：唯一的「状态 → 组件」装配点
 * @param props 面板视图 props
 * @returns 面板元素
 */
export function MapPanelView(props: IMapPanelViewProps): ReactElement {
  const view = useStore(props.store);
  const narrow = useNarrowLayout();
  const document = view.document;
  const showEditRow =
    view.status === MapPanelStatus.Loading ||
    view.status === MapPanelStatus.Ready ||
    view.status === MapPanelStatus.Error;
  const currentMapId = document?.id;
  const layers = document?.layers ?? [];
  const layerNames = layers.map((layer, index) => resolveLayerName(layer, index));
  const tileGroups = document?.tileGroups;
  const groupImages = useMapTileGroupUrls(tileGroups, props.loadTileBytes, view.paletteVersion);

  return (
    <div className="emap-panel" data-test-id="map-panel" data-status={statusToken(view.status)}>
      <MapToolbar
        status={view.status}
        mapSummaries={view.summaries}
        currentMapId={currentMapId}
        canCreateMap={props.canCreateMap ?? false}
        canOpenProperties={props.canOpenProperties ?? false}
        unsaved={view.unsaved}
        saving={view.saving}
        onSelectMap={(mapId): void => props.onSelectMap?.(mapId)}
        onOpenCreate={(): void => props.onOpenDialog?.(MapDialogKind.New)}
        onOpenProperties={(): void => props.onOpenProperties?.()}
        onSave={props.onSave}
        onRetry={props.onRetry}
        showEditRow={showEditRow}
        layers={layers}
        currentLayerId={view.currentLayerId}
        canAddLayer={props.canAddLayer ?? false}
        brushMode={view.brushMode}
        passabilityVisible={view.passabilityVisible}
        bigMap={view.bigMap}
        onSelectLayer={(layerId): void => {
          if (props.onSelectLayer !== undefined) {
            props.onSelectLayer(layerId);
            return;
          }

          props.store.setState({ ...props.store.state, currentLayerId: layerId });
        }}
        onOpenAddLayer={(): void => props.onOpenDialog?.(MapDialogKind.Layer)}
        aboveLayerOpacity={view.aboveLayerOpacity}
        onAboveLayerOpacityChange={(value): void => {
          if (props.onAboveLayerOpacityChange !== undefined) {
            props.onAboveLayerOpacityChange(value);
            return;
          }

          props.store.setState({ ...props.store.state, aboveLayerOpacity: value });
        }}
        onSelectBrushMode={(mode): void => {
          if (props.onSelectBrushMode !== undefined) {
            props.onSelectBrushMode(mode);
            return;
          }

          props.store.setState({ ...props.store.state, brushMode: mode });
        }}
        onTogglePassability={(value): void => {
          if (props.onTogglePassability !== undefined) {
            props.onTogglePassability(value);
            return;
          }

          props.store.setState({ ...props.store.state, passabilityVisible: value });
        }}
        onToggleBigMap={(value): void => {
          if (props.onToggleBigMap !== undefined) {
            props.onToggleBigMap(value);
            return;
          }

          props.store.setState({ ...props.store.state, bigMap: value });
        }}
        onMoveViewport={(dx, dy, byScreen): void => {
          if (props.onMoveViewport !== undefined) {
            props.onMoveViewport(dx, dy, byScreen);
            return;
          }

          props.store.setState({
            ...props.store.state,
            viewport: resolveMovedViewport(props.store.state, dx, dy, byScreen),
          });
        }}
      />
      <MapPanelBody props={props} view={view} narrow={narrow} groupImages={groupImages} />
      {renderNotice({ view, onRetry: props.onSave })}
      {view.dialog === MapDialogKind.New ? (
        <MapNewDialog
          open
          maxSize={props.maxMapSize}
          existingNames={view.summaries.map((summary) => summary.name)}
          error={view.dialogError}
          onSubmit={async (request): Promise<void> => {
            await props.onCreateMap?.(request);
          }}
          onCancel={(): void => props.onCloseDialog?.()}
        />
      ) : null}
      {view.dialog === MapDialogKind.Layer ? (
        <MapLayerDialog
          open
          layerCount={layers.length}
          existingNames={layerNames}
          error={view.dialogError}
          onSubmit={async (layerName): Promise<void> => {
            await props.onAddLayer?.(layerName);
          }}
          onCancel={(): void => props.onCloseDialog?.()}
        />
      ) : null}
      {view.dialog === MapDialogKind.Unsaved ? (
        <MapUnsavedDialog
          open
          saving={view.saving}
          saveError={view.error}
          onUnsavedDecision={(choice): void => props.onUnsavedDecision?.(choice)}
        />
      ) : null}
      <MapPropertiesDrawer
        open={view.propertiesOpen}
        status={view.propertiesStatus}
        rows={view.propertyRows}
        error={view.propertiesError}
        onChange={props.onPropertyChange ?? noop}
        onRetry={props.onPropertiesRetry ?? noop}
        onClose={props.onCloseProperties ?? noop}
      />
    </div>
  );
}

/**
 * 主体适配层：只把 props 与状态转交给对应的渲染函数
 * @param props 主体渲染输入
 * @returns 主体元素
 */
function MapPanelBody(props: IMapPanelBodyProps): ReactElement {
  return renderPanelBody(props);
}
