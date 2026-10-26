import { Button, Dropdown, InputNumber, Segmented, Select, Slider, Switch, Tooltip } from 'antd';
import { ReactElement, useEffect, useState } from 'react';
import {
  MAP_CELL_SIZE_LABEL,
  MAP_VIEWPORT_DEFAULT_COLUMNS,
  MAP_VIEWPORT_DEFAULT_ROWS,
  MAP_VIEWPORT_MAX_COUNT,
  MAP_VIEWPORT_MIN_COUNT,
  MAP_ZOOM_DEFAULT,
} from '../constants';
import { IMapLayer, IMapSummary, MapBrushMode, MapPanelStatus } from '../types';
import { MapZoomSlider } from './MapZoomSlider';

// 地图面板的两行工具栏：第一行是地图身份与保存，第二行是编辑工具。
// 本组件只接 props，不推导业务状态：哪些按钮可用全由调用方给出的状态与能力标记决定。

export interface IMapToolbarProps {
  /** 面板数据状态 */
  readonly status: MapPanelStatus;
  /** 宿主提供的地图清单 */
  readonly mapSummaries: readonly IMapSummary[];
  /** 当前打开的地图标识；未打开时为 undefined */
  readonly currentMapId?: string;
  /** 宿主是否注入新建地图能力 */
  readonly canCreateMap: boolean;
  /** 宿主是否注入地图属性能力；为 false 时属性入口禁用 */
  readonly canOpenProperties: boolean;
  /** 是否存在尚未保存的改动 */
  readonly unsaved: boolean;
  /** 是否正在保存 */
  readonly saving: boolean;
  /**
   * 选择另一张地图
   * @param mapId 目标地图标识
   */
  onSelectMap(mapId: string): void;
  /** 打开新建地图弹窗 */
  onOpenCreate(): void;
  /** 打开地图属性抽屉 */
  onOpenProperties(): void;
  /** 手动保存当前地图 */
  onSave(): void;
  /** 重新读取当前地图或地图清单 */
  onRetry(): void;
  /** 是否渲染第二行编辑工具；首次打开地图时为 false */
  readonly showEditRow: boolean;
  /** 当前地图的命名图层 */
  readonly layers: readonly IMapLayer[];
  /** 当前图层标识 */
  readonly currentLayerId?: string;
  /** 宿主是否注入新增图层能力 */
  readonly canAddLayer: boolean;
  /** 当前画笔模式 */
  readonly brushMode: MapBrushMode;
  /** 是否显示只读通行度叠加层 */
  readonly passabilityVisible: boolean;
  /** 是否处于大地图模式 */
  readonly bigMap: boolean;
  /**
   * 切换当前图层
   * @param layerId 目标图层标识
   */
  onSelectLayer(layerId: string): void;
  /** 打开新增图层弹窗 */
  onOpenAddLayer(): void;
  /** 高于当前层的图层统一不透明度，0..1 */
  readonly aboveLayerOpacity: number;
  /**
   * 调整高于当前层的图层不透明度
   * @param value 新的不透明度，0..1
   */
  onAboveLayerOpacityChange(value: number): void;
  /**
   * 切换画笔模式
   * @param mode 目标画笔模式
   */
  onSelectBrushMode(mode: MapBrushMode): void;
  /**
   * 开关只读通行度叠加层
   * @param value 为 true 时显示
   */
  onTogglePassability(value: boolean): void;
  /**
   * 开关大地图模式
   * @param value 为 true 时进入大地图
   */
  onToggleBigMap(value: boolean): void;
  /** 缩放滑块的当前值；缺省 `MAP_ZOOM_DEFAULT` */
  readonly zoom?: number;
  /**
   * 缩放滑块松手后把新值交给面板
   * @param value 夹取到 `MAP_ZOOM_MIN`..`MAP_ZOOM_MAX` 的新缩放值
   */
  onSetZoom?(value: number): void;
  /** 「视图」组地图区宽的当前值（格数） */
  readonly viewportColumns?: number;
  /** 「视图」组地图区高的当前值（格数） */
  readonly viewportRows?: number;
  /**
   * 用户改完地图区宽 / 高后上报新值；缺省时两个数字框只读
   * @param columns 新的地图区横向格数
   * @param rows 新的地图区纵向格数
   */
  onSetViewportSize?(columns: number, rows: number): void;
  /** 当前地图文档声明的格子宽（像素）；只给顶栏只读标签用，不是显示格基准、不含缩放 */
  readonly cellWidth?: number;
  /** 当前地图文档声明的格子高（像素）；只给顶栏只读标签用，不是显示格基准、不含缩放 */
  readonly cellHeight?: number;
}

interface IMapViewControlsProps {
  /** 当前是否允许编辑 */
  readonly disabled: boolean;
  /** 是否显示只读通行度叠加层 */
  readonly passabilityVisible: boolean;
  /** 是否处于大地图模式 */
  readonly bigMap: boolean;
  /** 缩放滑块的当前值 */
  readonly zoom: number;
  /** 「视图」组地图区宽的当前值（格数）；缺省 `MAP_VIEWPORT_DEFAULT_COLUMNS` */
  readonly viewportColumns?: number;
  /** 「视图」组地图区高的当前值（格数）；缺省 `MAP_VIEWPORT_DEFAULT_ROWS` */
  readonly viewportRows?: number;
  /**
   * 用户改完地图区宽 / 高后上报新值；缺省时两个数字框只读
   * @param columns 新的地图区横向格数
   * @param rows 新的地图区纵向格数
   */
  onSetViewportSize?(columns: number, rows: number): void;
  /**
   * 开关只读通行度叠加层
   * @param value 为 true 时显示
   */
  onTogglePassability(value: boolean): void;
  /**
   * 开关大地图模式
   * @param value 为 true 时进入大地图
   */
  onToggleBigMap(value: boolean): void;
  /**
   * 缩放滑块松手后把新值交给面板
   * @param value 夹取到 `MAP_ZOOM_MIN`..`MAP_ZOOM_MAX` 的新缩放值
   */
  onSetZoom?(value: number): void;
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
 * 把图层列表翻译成分段控件的选项；每项的名字单行省略并带 title
 * @param layers 当前地图的命名图层
 * @returns 分段控件选项
 */
function resolveLayerOptions(layers: readonly IMapLayer[]): { value: string; label: ReactElement }[] {
  return layers.map((layer, index) => {
    const name = resolveLayerName(layer, index);

    return {
      value: layer.id,
      label: (
        <span className="emap-layer-option" title={name}>
          {name}
        </span>
      ),
    };
  });
}

/**
 * 构造画笔模式的分段选项
 * @returns 线 / 矩形 / 填充三个选项
 */
function resolveBrushOptions(): { value: MapBrushMode; label: string }[] {
  return [
    { value: MapBrushMode.Line, label: '线' },
    { value: MapBrushMode.Rect, label: '矩形' },
    { value: MapBrushMode.Fill, label: '填充' },
  ];
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
 * 把数字框报出的原始值归一成可提交的整数
 * @param value 数字框报出的值；清空时为 null
 * @returns 取整后的格数；空值或非数时返回 undefined 表示不提交
 */
function toViewportCount(value: number | null): number | undefined {
  if (value === null || !Number.isFinite(value)) return undefined;

  return Math.round(value);
}

/**
 * 把格数夹到面板允许的范围
 * @param value 已取整的格数
 * @returns 夹到 `MAP_VIEWPORT_MIN_COUNT`..`MAP_VIEWPORT_MAX_COUNT` 的格数
 */
function clampViewportCount(value: number): number {
  return Math.min(MAP_VIEWPORT_MAX_COUNT, Math.max(MAP_VIEWPORT_MIN_COUNT, value));
}

/**
 * 视图类低频控件：显示通行度 / 大地图 / 缩放 / 地图区宽高；宽屏直接显示，窄屏收进「视图」下拉
 * @param props 控件 props
 * @returns 控件组
 */
function MapViewControls(props: IMapViewControlsProps): ReactElement {
  const viewportColumns = props.viewportColumns ?? MAP_VIEWPORT_DEFAULT_COLUMNS;
  const viewportRows = props.viewportRows ?? MAP_VIEWPORT_DEFAULT_ROWS;
  const viewportDisabled = props.onSetViewportSize === undefined;
  const [columnsDraft, setColumnsDraft] = useState<number | null>(viewportColumns);
  const [rowsDraft, setRowsDraft] = useState<number | null>(viewportRows);

  // 面板夹取后回传的 props 才是权威值：props 一变就把草稿同步回来（D-46）
  useEffect((): void => {
    setColumnsDraft(viewportColumns);
  }, [viewportColumns]);

  useEffect((): void => {
    setRowsDraft(viewportRows);
  }, [viewportRows]);

  /**
   * 提交宽输入框的草稿：非法 / 空值时回退到 props 当前值，合法时夹取后与高的当前值配对上报
   */
  const commitColumns = (): void => {
    const columns = toViewportCount(columnsDraft);

    if (columns === undefined) {
      setColumnsDraft(viewportColumns);
      return;
    }

    const next = clampViewportCount(columns);

    setColumnsDraft(next);
    props.onSetViewportSize?.(next, viewportRows);
  };

  /**
   * 提交高输入框的草稿：非法 / 空值时回退到 props 当前值，合法时夹取后与宽的当前值配对上报
   */
  const commitRows = (): void => {
    const rows = toViewportCount(rowsDraft);

    if (rows === undefined) {
      setRowsDraft(viewportRows);
      return;
    }

    const next = clampViewportCount(rows);

    setRowsDraft(next);
    props.onSetViewportSize?.(viewportColumns, next);
  };

  return (
    <>
      <label className="emap-toolbar-group" data-test-id="map-passability">
        <Switch
          size="small"
          checked={props.passabilityVisible}
          disabled={props.disabled}
          onChange={props.onTogglePassability}
        />
        <span className="emap-toolbar-label">显示通行度</span>
      </label>
      <Button
        className={props.bigMap ? 'emap-bigmap is-active' : 'emap-bigmap'}
        size="small"
        autoInsertSpace={false}
        disabled={props.disabled}
        aria-pressed={props.bigMap}
        data-test-id="map-bigmap"
        onClick={(): void => props.onToggleBigMap(!props.bigMap)}
      >
        大地图
      </Button>
      <MapZoomSlider
        value={props.zoom}
        disabled={props.onSetZoom === undefined}
        onChangeComplete={(value): void => props.onSetZoom?.(value)}
      />
      <span className="emap-viewport-size" data-test-id="map-viewport-size">
        <span className="emap-viewport-size-label">宽</span>
        <InputNumber
          size="small"
          min={MAP_VIEWPORT_MIN_COUNT}
          max={MAP_VIEWPORT_MAX_COUNT}
          step={1}
          precision={0}
          controls={false}
          disabled={viewportDisabled}
          value={columnsDraft}
          data-test-id="map-viewport-columns"
          onChange={(value): void => setColumnsDraft(value)}
          onBlur={commitColumns}
          onPressEnter={commitColumns}
        />
        <span className="emap-viewport-size-label">高</span>
        <InputNumber
          size="small"
          min={MAP_VIEWPORT_MIN_COUNT}
          max={MAP_VIEWPORT_MAX_COUNT}
          step={1}
          precision={0}
          controls={false}
          disabled={viewportDisabled}
          value={rowsDraft}
          data-test-id="map-viewport-rows"
          onChange={(value): void => setRowsDraft(value)}
          onBlur={commitRows}
          onPressEnter={commitRows}
        />
      </span>
    </>
  );
}

/**
 * 两行工具栏：第一行地图身份与保存，第二行编辑工具
 * @param props 工具栏 props
 * @returns 工具栏元素
 */
export function MapToolbar(props: IMapToolbarProps): ReactElement {
  const narrow = useNarrowLayout();
  const editing = props.status === MapPanelStatus.Ready;
  const listBusy = props.status === MapPanelStatus.ListLoading;
  const selectDisabled = props.mapSummaries.length === 0 || listBusy;
  const canClickCreate =
    props.canCreateMap &&
    (editing || props.status === MapPanelStatus.NotOpened || props.status === MapPanelStatus.NoMaps);
  const showRetry =
    props.status === MapPanelStatus.Loading ||
    props.status === MapPanelStatus.Error ||
    props.status === MapPanelStatus.ListError ||
    props.status === MapPanelStatus.ListLoading;
  const canUseProperties = props.canOpenProperties && editing;
  const canSave = editing && props.unsaved && !props.saving;
  const layerDisabled = !editing || props.layers.length === 0;
  const canAddLayer = props.canAddLayer && editing;
  const currentLayer = props.layers.find((layer) => layer.id === props.currentLayerId);
  const currentZIndex = currentLayer?.zIndex ?? 0;
  const hasLayerAbove = props.layers.some((layer) => layer.zIndex > currentZIndex);
  const opacityDisabled = !editing || currentLayer === undefined || !hasLayerAbove;
  const currentName = props.mapSummaries.find((summary) => summary.id === props.currentMapId)?.name ?? '';

  return (
    <div className="emap-toolbar" data-test-id="map-toolbar">
      <div className="emap-toolbar-row">
        <span className="emap-toolbar-label">地图</span>
        <span className="emap-toolbar-map-select" data-test-id="map-select" data-disabled={String(selectDisabled)}>
          <Select
            size="small"
            style={{ width: '100%' }}
            showSearch={{ optionFilterProp: 'label' }}
            disabled={selectDisabled}
            value={props.currentMapId}
            placeholder="暂无地图"
            options={props.mapSummaries.map((summary) => ({ value: summary.id, label: summary.name }))}
            labelRender={(): ReactElement => (
              <span className="emap-toolbar-map-name" title={currentName}>
                {currentName}
              </span>
            )}
            onChange={(value): void => props.onSelectMap(value)}
          />
        </span>
        {props.cellWidth !== undefined && props.cellHeight !== undefined ? (
          <span className="emap-cell-size" data-test-id="map-cell-size">
            {`${MAP_CELL_SIZE_LABEL}：${props.cellWidth}px * ${props.cellHeight}px`}
          </span>
        ) : null}
        <Tooltip title={props.canCreateMap ? undefined : '当前项目不支持新建地图。'}>
          <span className="emap-tooltip-wrap">
            <Button
              size="small"
              autoInsertSpace={false}
              disabled={!canClickCreate}
              title={props.canCreateMap ? undefined : '当前项目不支持新建地图。'}
              data-test-id="map-new"
              onClick={props.onOpenCreate}
            >
              新建地图
            </Button>
          </span>
        </Tooltip>
        <span className="emap-toolbar-spacer" />
        {props.unsaved ? (
          <span className="emap-toolbar-unsaved" data-test-id="map-unsaved">
            未保存
          </span>
        ) : null}
        <Tooltip title={props.canOpenProperties ? undefined : '当前项目未提供地图属性配置。'}>
          <span className="emap-tooltip-wrap">
            <Button
              size="small"
              autoInsertSpace={false}
              disabled={!canUseProperties}
              title={props.canOpenProperties ? undefined : '当前项目未提供地图属性配置。'}
              data-test-id="map-properties"
              onClick={props.onOpenProperties}
            >
              地图属性
            </Button>
          </span>
        </Tooltip>
        <Button
          type="primary"
          size="small"
          autoInsertSpace={false}
          disabled={!canSave}
          title="保存地图"
          aria-label="保存地图"
          data-test-id="map-save"
          onClick={props.onSave}
        >
          保存地图
        </Button>
        {showRetry ? (
          <Button size="small" autoInsertSpace={false} data-test-id="map-toolbar-retry" onClick={props.onRetry}>
            重试
          </Button>
        ) : null}
      </div>
      {props.showEditRow ? (
        <div className="emap-toolbar-edit-row emap-toolbar-row">
          <div className="emap-toolbar-layers" data-test-id="map-layer-mode" data-disabled={String(layerDisabled)}>
            {props.layers.length === 0 ? (
              <span className="emap-toolbar-layers-empty">该地图没有图层</span>
            ) : (
              <Segmented<string>
                size="small"
                disabled={layerDisabled}
                value={props.currentLayerId}
                options={resolveLayerOptions(props.layers)}
                onChange={(value): void => props.onSelectLayer(value)}
              />
            )}
          </div>
          <Tooltip title={props.canAddLayer ? undefined : '当前项目不支持新增图层。'}>
            <span className="emap-tooltip-wrap">
              <Button
                size="small"
                autoInsertSpace={false}
                disabled={!canAddLayer}
                title={props.canAddLayer ? undefined : '当前项目不支持新增图层。'}
                data-test-id="map-layer-add"
                onClick={props.onOpenAddLayer}
              >
                新增图层
              </Button>
            </span>
          </Tooltip>
          <span className="emap-opacity" data-test-id="map-layer-opacity">
            <span className="emap-opacity-label">高于当前层的不透明度</span>
            <Slider
              className="emap-opacity-slider"
              min={0}
              max={1}
              step={0.05}
              disabled={opacityDisabled}
              value={props.aboveLayerOpacity}
              onChange={props.onAboveLayerOpacityChange}
            />
          </span>
          <div className="emap-toolbar-group" data-test-id="map-brush-mode" data-disabled={String(!editing)}>
            <Segmented<MapBrushMode>
              size="small"
              disabled={!editing}
              value={props.brushMode}
              options={resolveBrushOptions()}
              onChange={props.onSelectBrushMode}
            />
          </div>
          {narrow ? (
            <Dropdown
              trigger={['click']}
              popupRender={(): ReactElement => (
                <div className="emap-view-menu-panel">
                  <MapViewControls
                    disabled={!editing}
                    passabilityVisible={props.passabilityVisible}
                    bigMap={props.bigMap}
                    zoom={props.zoom ?? MAP_ZOOM_DEFAULT}
                    viewportColumns={props.viewportColumns}
                    viewportRows={props.viewportRows}
                    onSetViewportSize={props.onSetViewportSize}
                    onTogglePassability={props.onTogglePassability}
                    onToggleBigMap={props.onToggleBigMap}
                    onSetZoom={props.onSetZoom}
                  />
                </div>
              )}
            >
              <Button size="small" autoInsertSpace={false} data-test-id="map-view-menu">
                视图
              </Button>
            </Dropdown>
          ) : (
            <MapViewControls
              disabled={!editing}
              passabilityVisible={props.passabilityVisible}
              bigMap={props.bigMap}
              zoom={props.zoom ?? MAP_ZOOM_DEFAULT}
              viewportColumns={props.viewportColumns}
              viewportRows={props.viewportRows}
              onSetViewportSize={props.onSetViewportSize}
              onTogglePassability={props.onTogglePassability}
              onToggleBigMap={props.onToggleBigMap}
              onSetZoom={props.onSetZoom}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
