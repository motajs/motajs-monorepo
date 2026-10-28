import '../map.css';
import { useStore } from '@tanstack/react-store';
import { Store } from '@tanstack/store';
import { Button, Spin } from 'antd';
import { KeyboardEvent, PointerEvent, ReactElement, useEffect, useRef, useState } from 'react';
import { PanelCloseChoice } from '@motajs/editor-core';
import {
  MAP_PALETTE_BASE_WIDTH,
  MAP_SHOW_FRAME_COUNT_DEFAULT,
  MAP_VIEWPORT_DEFAULT_COLUMNS,
  MAP_VIEWPORT_DEFAULT_ROWS,
  MAP_ZOOM_DEFAULT,
} from '../constants';
import { IPaintWrite, isTileCatalogEmpty } from '../model/document';
import { resolveFavoriteSlotIndex } from '../model/favoriteSlot';
import { resolveMapLayout } from '../model/layout';
import { buildMapRenderModel } from '../model/renderModel';
import {
  IMapCellPosition,
  IMapCreateRequest,
  IMapDocument,
  IMapLayer,
  IMapLayout,
  IMapPaletteSelection,
  IMapPanelViewState,
  IMapRect,
  IMapSizeLimit,
  IMapTileGroupUrls,
  MapBottomTab,
  MapBrushMode,
  MapDialogKind,
  MapImageStatus,
  MapPanelStatus,
  MapTileCategory,
} from '../types';
import { MapCanvas } from './MapCanvas';
import { MapBottomTabs } from './MapBottomTabs';
import { MapFavoriteBar } from './MapFavoriteBar';
import { MapLayerDialog, MapNewDialog } from './dialogs';
import { MapEmptyState } from './MapEmptyState';
import { MapMaterialPanel } from './MapMaterialPanel';
import { MapPropertiesDrawer } from './MapPropertiesDrawer';
import { MapToolbar } from './MapToolbar';
import { useMapElementWidth } from './useMapElementWidth';
import { ExternalChangeDialog, PanelCloseDialog } from '../../shared/panelDialogs';

// 地图面板的装配层：工具栏 / 主体 / 保存提示行 / 弹窗 / 属性抽屉都在这里按视图状态装配。
// 本视图只接 props，不 import 面板类；渲染模型在这里每次渲染时现算，再交给 MapSurface 消费。
// 面板根可聚焦：点面板空白处会把焦点落到根上，数字键因此在整个面板内有效（U-26）。
// 图块地址由面板统一创建与回收，本视图只原样下发面板发布的两张地址表（D-01 / D-40）。

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
  /** 外部变化冲突里选择「放弃我的改动并刷新」 */
  onConflictDiscard?(): void;
  /** 外部变化冲突里选择「保留我的改动，下次保存覆盖」 */
  onConflictKeep?(): void;
  /**
   * 关闭弹窗上用户点了哪一个选择
   * @param choice 保存并关闭 / 不保存关闭 / 取消关闭
   */
  onCloseChoice?(choice: PanelCloseChoice): void;
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
   * 提交一个属性字段
   * @param path 字段路径段数组
   * @param value 新值
   */
  onPropertyChange?(path: readonly (string | number)[], value: unknown): void;
  /** 属性加载失败后的重试 */
  onPropertiesRetry?(): void;
  /**
   * 画布滚动后把视口位置交给面板
   * @param left 视口左上角所在的格子横坐标
   * @param top 视口左上角所在的格子纵坐标
   */
  onSetViewport?(left: number, top: number): void;
  /**
   * 把新的「地图区宽 / 高（格数）」交给面板数据层；缺省时视图只改本地 store
   * @param columns 地图区横向格数
   * @param rows 地图区纵向格数
   */
  onSetViewportSize?(columns: number, rows: number): void;
  /**
   * 缩放滑块松手后把新值交给面板
   * @param value 夹取到 `MAP_ZOOM_MIN`..`MAP_ZOOM_MAX` 的新缩放值
   */
  onSetZoom?(value: number): void;
  /** 宿主注入的动画帧速（毫秒 / 帧）；缺省 `MAP_FRAME_SPEED_DEFAULT` */
  readonly cellFrameSpeed?: number;
  /**
   * 切换底部页签
   * @param tab 目标页签
   */
  onSetBottomTab?(tab: MapBottomTab): void;
  /**
   * 选择右侧素材分类
   * @param category 目标分类
   */
  onSelectCategory?(category: MapTileCategory): void;
  /**
   * 开关素材区的帧数角标
   * @param value 为 true 时显示
   */
  onToggleFrameCount?(value: boolean): void;
  /**
   * 把「右键某个普通图块」交给面板收藏
   * @param number 要收藏的图块编号
   */
  onFavoriteTile?(number: number): void;
  /**
   * 选中擦除或某个收藏位（数字键 `1..9` / `0` 与收藏格点击）
   * @param index 0 表示擦除，1..9 对应第 1..9 个收藏格
   */
  onSelectFavoriteSlot?(index: number): void;
  /**
   * 把收藏从一格挪到另一格
   * @param from 起始槽位索引（0..8）
   * @param to 目标槽位索引（0..8）
   */
  onReorderFavorites?(from: number, to: number): void;
}

interface IMapPanelBodyProps {
  /** 面板视图 props */
  readonly props: IMapPanelViewProps;
  /** 当前视图状态 */
  readonly view: IMapPanelViewState;
  /** 是否为窄布局 */
  readonly narrow: boolean;
  /** 面板顶层算好的布局；未打开地图时为 undefined */
  readonly layout?: IMapLayout;
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

/** 面板还没发布地址表时用的空分组表；两张表都为空，等价于「一张图都还没读到」 */
const EMPTY_GROUP_URLS: IMapTileGroupUrls = Object.freeze({
  urls: Object.freeze<Record<string, string | undefined>>({}),
  status: Object.freeze<Record<string, MapImageStatus>>({}),
});

/**
 * 判断键盘事件的目标是不是输入类控件：这些控件里的数字是打字，不是选槽位
 * @param target 键盘事件的目标
 * @returns 目标可编辑时为 true
 */
function isTypingTarget(target: EventTarget | null): boolean {
  if (target instanceof HTMLInputElement) return true;
  if (target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLSelectElement) return true;

  return target instanceof HTMLElement && target.isContentEditable;
}

/**
 * 判断指针落点自己会不会接受焦点：会接受的话，面板根就不该把焦点抢过来
 *
 * 它回答的是「这个落点本来就有自己的键盘行为吗」，与 `isTypingTarget` 回答的「现在是不是在打字」不是同一件事，
 * 所以两者不合并：按钮、画布、滑块手柄都会自己接受焦点，但只有输入类控件才会吃掉数字键。
 * @param target 指针事件的目标
 * @returns 落点会自己接受焦点时为 true
 */
function ownsKeyboardFocus(target: EventTarget | null): boolean {
  if (target instanceof HTMLInputElement) return true;
  if (target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLElement && target.isContentEditable) return true;

  if (target instanceof Element) {
    // `[tabindex]:not([tabindex="-1"])` 跳过面板根自己（它的 `tabIndex={-1}` 只是为了让根可被程序化聚焦）
    return (
      target.closest('input, textarea, select, button, a[href], [tabindex]:not([tabindex="-1"]), [contenteditable]') !==
      null
    );
  }

  return false;
}

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
 * 按当前视图状态算一次布局；还没有打开地图时返回 undefined
 *
 * 布局数字只来自 `resolveMapLayout`，视图不自己算右栏宽度与画布像素。
 * @param view 当前视图状态
 * @param availableWidth 面板量到的可用宽度（像素）；量不到时为 0
 * @returns 布局；未打开地图时为 undefined
 */
function resolveViewLayout(view: IMapPanelViewState, availableWidth: number): IMapLayout | undefined {
  if (view.document === undefined) return undefined;

  return resolveMapLayout({
    zoom: view.zoom ?? MAP_ZOOM_DEFAULT,
    viewportColumns: view.viewportColumns ?? MAP_VIEWPORT_DEFAULT_COLUMNS,
    viewportRows: view.viewportRows ?? MAP_VIEWPORT_DEFAULT_ROWS,
    availableWidth,
  });
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
 * 渲染就绪态的地图区；渲染模型在这里现算，画布只把本地叠加状态补进模型交给 Pixi 表面
 *
 * 画布尺寸与格像素都来自面板顶层算好的布局，渲染模型吃同一个 `zoom`；两边得到同一个屏幕格像素。
 * @param input 主体渲染输入
 * @returns 就绪态主体元素
 */
function renderReadyBody(input: IMapPanelBodyProps): ReactElement {
  const view = input.view;
  const document = view.document;
  const layout = input.layout;

  if (document === undefined || layout === undefined) return renderLoadingBody();

  const zoom = view.zoom ?? MAP_ZOOM_DEFAULT;
  const model = buildMapRenderModel(document, {
    width: layout.canvasWidth,
    height: layout.canvasHeight,
    currentLayerId: view.currentLayerId ?? '',
    aboveLayerOpacity: view.aboveLayerOpacity,
    viewport: view.viewport,
    bigMap: view.bigMap,
    zoom,
    passMarks: view.passMarks,
  });
  const layerName = resolveCurrentLayerName(document, view.currentLayerId);
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
        aboveLayerOpacity={view.aboveLayerOpacity}
        cellFrameSpeed={input.props.cellFrameSpeed}
        imageVersion={view.tileImageSourcesVersion ?? 0}
        imageSources={view.tileImageSources}
        onCommitCells={input.props.onCommitCells ?? noop}
        onCopyRegion={input.props.onCopyRegion ?? noop}
        onPasteAt={input.props.onPasteAt ?? noop}
        onClearRegion={input.props.onClearRegion ?? noop}
        onSetViewport={input.props.onSetViewport ?? noop}
        onToggleBigMap={toggleBigMap}
      />
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
  const panelRef = useRef<HTMLDivElement>(null);
  const view = useStore(props.store);
  const narrow = useNarrowLayout();
  const availableWidth = useMapElementWidth(panelRef);
  const document = view.document;
  const showEditRow =
    view.status === MapPanelStatus.Loading ||
    view.status === MapPanelStatus.Ready ||
    view.status === MapPanelStatus.Error;
  const currentMapId = document?.id;
  const layers = document?.layers ?? [];
  const layerNames = layers.map((layer, index) => resolveLayerName(layer, index));
  const tileGroups = document?.tileGroups;
  const groupImages = view.tileGroupUrls ?? EMPTY_GROUP_URLS;
  const layout = resolveViewLayout(view, availableWidth);
  const sideWidth = layout === undefined ? MAP_PALETTE_BASE_WIDTH : layout.paletteWidth;

  /**
   * 面板级数字键：`1` 选擦除、`2..9` / `0` 选收藏位；带修饰键的组合与输入控件内的按键一律放行
   * @param event 键盘事件
   */
  const handlePanelKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (isTypingTarget(event.target)) return;

    const index = resolveFavoriteSlotIndex(event.key);

    if (index === undefined) return;

    event.preventDefault();
    props.onSelectFavoriteSlot?.(index);
  };

  /**
   * 面板内指针按下：只把「落点不会自己接受焦点」的点击收到面板根上，其余一律放行
   * @param event 指针按下事件
   */
  const handlePanelPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    const panel = panelRef.current;

    if (panel === null) return;
    // 输入框 / 按钮 / 画布 / 滑块手柄本来就会自己拿到焦点，抢过来会破坏它们自己的键盘行为
    if (ownsKeyboardFocus(event.target)) return;

    const active = panel.ownerDocument.activeElement;

    // 焦点已经落在面板里（例如滑块手柄上），不要搬回根节点
    if (active !== null && panel.contains(active)) return;

    // 地图区内部有滚动容器；聚焦不能把滚动位置带回去
    panel.focus({ preventScroll: true });
  };

  return (
    <div
      ref={panelRef}
      className={narrow ? 'emap-panel is-narrow' : 'emap-panel'}
      data-test-id="map-panel"
      data-status={statusToken(view.status)}
      tabIndex={-1}
      onKeyDown={handlePanelKeyDown}
      onPointerDown={handlePanelPointerDown}
    >
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
        zoom={view.zoom ?? MAP_ZOOM_DEFAULT}
        onSetZoom={props.onSetZoom}
        viewportColumns={view.viewportColumns}
        viewportRows={view.viewportRows}
        onSetViewportSize={(columns, rows): void => {
          if (props.onSetViewportSize !== undefined) {
            props.onSetViewportSize(columns, rows);
            return;
          }

          props.store.setState({ ...props.store.state, viewportColumns: columns, viewportRows: rows });
        }}
        cellWidth={document?.cellWidth}
        cellHeight={document?.cellHeight}
      />
      <div className="emap-columns" data-test-id="map-columns">
        <div className="emap-main" data-test-id="map-main">
          <MapPanelBody props={props} view={view} narrow={narrow} layout={layout} />
          <div className="emap-bottom" data-test-id="map-bottom">
            <MapFavoriteBar
              favorites={view.favorites ?? []}
              selection={view.paletteSelection}
              groups={tileGroups}
              groupUrls={groupImages.urls}
              onSelectSlot={(index): void => props.onSelectFavoriteSlot?.(index)}
              onReorder={(from, to): void => props.onReorderFavorites?.(from, to)}
              reorderDisabled={false}
            />
            <MapBottomTabs
              tab={view.bottomTab ?? MapBottomTab.Recent}
              recentTiles={view.recentTiles}
              frequentTiles={view.frequentTiles ?? []}
              favorites={view.favorites ?? []}
              groups={tileGroups}
              groupUrls={groupImages.urls}
              imageStatus={view.recentStatus}
              selection={view.paletteSelection}
              onSelectTab={(tab): void => props.onSetBottomTab?.(tab)}
              onSelectPattern={props.onSelectPattern ?? noop}
            />
          </div>
          {renderNotice({ view, onRetry: props.onSave })}
        </div>
        <div className="emap-side" data-test-id="map-sidebar" style={narrow ? undefined : { width: sideWidth }}>
          <div className="emap-side-slot">
            <MapMaterialPanel
              groups={document?.tileGroups ?? []}
              groupUrls={groupImages.urls}
              groupStatus={groupImages.status}
              imageStatus={view.recentStatus}
              activeCategory={view.activeCategory ?? MapTileCategory.Terrain}
              selection={view.paletteSelection}
              showFrameCount={view.showFrameCount ?? MAP_SHOW_FRAME_COUNT_DEFAULT}
              onSelectPattern={props.onSelectPattern ?? noop}
              onRetryImages={props.onRetryImages ?? noop}
              onSelectCategory={props.onSelectCategory ?? noop}
              onToggleFrameCount={props.onToggleFrameCount ?? noop}
              onFavoriteTile={props.onFavoriteTile}
            />
          </div>
        </div>
      </div>
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
      {view.pendingConflict === undefined ? null : (
        <ExternalChangeDialog open onDiscard={props.onConflictDiscard ?? noop} onKeep={props.onConflictKeep ?? noop} />
      )}
      {view.closeDialog?.open === true ? (
        <PanelCloseDialog
          open
          saving={view.closeDialog.saving}
          error={view.closeDialog.error}
          onChoose={props.onCloseChoice ?? noop}
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
