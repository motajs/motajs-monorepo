import { Store } from '@tanstack/store';
import { createElement, FC, ReactElement } from 'react';
import { IEditorPanel, IEditorPanelContext, IEditorPanelFactoryParam, IUndoContext } from '@motajs/editor-core';
import { MAP_ABOVE_LAYER_DEFAULT_OPACITY, MAP_SAVED_MESSAGE } from './constants';
import { MapPanelView } from './components/MapPanelView';
import { isMapDataDirty, isMapPropertiesDirty } from './model/dirty';
import {
  applyCellChanges,
  collectNetCellChanges,
  IPaintWrite,
  isMapDocumentValid,
  isTileCatalogEmpty,
} from './model/document';
import {
  IMapCellChange,
  IMapCellsUndoData,
  IMapDocument,
  IMapEditorCapabilities,
  IMapPaletteSelection,
  IMapPanel,
  IMapPanelTarget,
  IMapPanelViewState,
  MapBrushMode,
  MapDialogKind,
  MapImageStatus,
  MapPaletteKind,
  MapPanelStatus,
  MapUndoType,
} from './types';

// 地图面板的数据层：打开宿主给的地图、把落笔留在内存、点保存才把整份数据域交回宿主。
// 渲染模型不在这里计算（由视图每次渲染现算），本类只保存文档与视图状态，界面由同目录的 MapPanelView 渲染。

/**
 * 造一个「空选择」的调色板选中：绘制时写入 0，即擦除
 * @returns 空选择
 */
function createEmptyPaletteSelection(): IMapPaletteSelection {
  return { kind: MapPaletteKind.Empty, pattern: { width: 1, height: 1, tiles: [0] }, primaryTileNumber: 0 };
}

/**
 * 从文档的图块目录里选第一个分组的第一个图块；目录里没有图块时回退为空选择
 * @param document 中立文档
 * @returns 默认的调色板选中
 */
function selectFirstTile(document: IMapDocument): IMapPaletteSelection {
  for (const group of document.tileGroups) {
    const tile = group.tiles[0];

    if (tile !== undefined) {
      return {
        kind: MapPaletteKind.Tiles,
        pattern: { width: 1, height: 1, tiles: [tile.number] },
        primaryTileNumber: tile.number,
      };
    }
  }

  return createEmptyPaletteSelection();
}

/**
 * 把宿主抛出的未知错误折叠成可显示的纯文本
 * @param error 宿主抛出的错误
 * @returns 错误文案
 */
function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const enum MapBarrierAction {
  /** 切换到另一张地图 */
  Switch,
}

interface IMapBarrierData {
  /** 这次屏障对应的动作 */
  readonly action: MapBarrierAction;
  /** 屏障落地时当前打开的地图标识 */
  readonly mapId: string;
}

/**
 * 判断单个格子变化是否可撤销：横纵坐标、改动前后值都必须是数字
 * @param value 待判断的变化项
 * @returns 形状符合格子变化时为 true
 */
function isMapCellChange(value: unknown): value is IMapCellChange {
  if (typeof value !== 'object' || value === null) return false;
  if (!('x' in value) || typeof value.x !== 'number') return false;
  if (!('y' in value) || typeof value.y !== 'number') return false;
  if (!('before' in value) || typeof value.before !== 'number') return false;
  if (!('after' in value) || typeof value.after !== 'number') return false;

  return true;
}

/**
 * 判断撤销载荷是否为格子改动：地图标识、图层标识为字符串，变化项逐项符合格子变化
 * @param value 撤销记录携带的载荷
 * @returns 形状符合格子改动时为 true
 */
function isMapCellsUndoData(value: unknown): value is IMapCellsUndoData {
  if (typeof value !== 'object' || value === null) return false;
  if (!('mapId' in value) || typeof value.mapId !== 'string') return false;
  if (!('layerId' in value) || typeof value.layerId !== 'string') return false;
  if (!('changes' in value) || !Array.isArray(value.changes)) return false;

  return value.changes.every((change: unknown) => isMapCellChange(change));
}

export class MapPanel implements IEditorPanel, IMapPanel {
  /** 面板实例标识符，取自 core 生成的实例 id */
  readonly id: string;

  /** 面板侧上下文，提供资源层读取与撤销能力 */
  private readonly context: IEditorPanelContext;

  /** 装配方注入的地图能力 */
  private readonly capabilities: IMapEditorCapabilities;

  /** 面板视图状态的订阅源 */
  private readonly store: Store<IMapPanelViewState>;

  /** 缓存的渲染根组件 */
  private readonly component: FC;

  /** 当前打开的中立文档；尚未打开时为 undefined */
  private document?: IMapDocument;

  /** 当前图层的标识；未打开地图时为 undefined */
  private currentLayerId?: string;

  /** 当前调色板选中 */
  private paletteSelection: IMapPaletteSelection;

  /** 最近一次从打开参数瞄准的地图标识，供重试使用 */
  private targetMapId?: string;

  /** 当前地图属性表；属性域在 04-09 接入前始终为空 */
  private properties: Record<string, unknown> = {};

  /** 最近一次已保存或刚打开时的文档快照；没有打开地图时为 undefined */
  private dataBaseline?: IMapDocument;

  /** 最近一次已保存或刚打开时的属性表快照；没有打开地图时为 undefined */
  private propertiesBaseline?: Record<string, unknown>;

  /** 打开 / 刷新请求的序号，用来丢弃晚到的在途结果 */
  private loadToken: number = 0;

  /** 清单请求的序号，用来丢弃晚到的在途结果 */
  private listToken: number = 0;

  constructor(param: IEditorPanelFactoryParam, capabilities: IMapEditorCapabilities) {
    this.id = param.instanceId;
    this.context = param.context;
    this.capabilities = capabilities;
    this.paletteSelection = createEmptyPaletteSelection();
    this.store = new Store<IMapPanelViewState>({
      status: MapPanelStatus.NotOpened,
      summaries: [],
      brushMode: MapBrushMode.Line,
      paletteSelection: this.paletteSelection,
      recentTiles: [],
      recentStatus: MapImageStatus.Loading,
      dialog: MapDialogKind.None,
      paletteVersion: 0,
      propertiesOpen: false,
      passMarks: [],
      aboveLayerOpacity: MAP_ABOVE_LAYER_DEFAULT_OPACITY,
      passabilityVisible: false,
      bigMap: false,
      viewport: { left: 0, top: 0 },
      unsaved: false,
      saving: false,
    });
    this.component = (): ReactElement =>
      createElement(MapPanelView, {
        store: this.store,
        loadBytes: async (path: string): Promise<Uint8Array | undefined> => {
          const resource = await this.context.requestResource(path);

          if (resource === null) return undefined;

          try {
            return await resource.requestBinary();
          } catch {
            return undefined;
          }
        },
        onPaintCell: (position): void => {
          const layerId = this.currentLayerId;

          if (layerId === undefined) return;

          const value = this.paletteSelection.pattern.tiles[0];

          this.commitCells(layerId, [{ x: position.x, y: position.y, value }]);
        },
        onSave: (): void => {
          void this.save();
        },
        onRetry: (): void => {
          if (this.targetMapId !== undefined) void this.openMap(this.targetMapId);
        },
      });
  }

  /**
   * 把一组视图状态改动合并进当前状态并通知订阅者
   * @param changes 要覆盖的字段
   */
  private publish(changes: Partial<IMapPanelViewState>): void {
    this.store.setState({ ...this.store.state, ...changes });
  }

  /**
   * 清单读完后面板该停在哪个状态：已有文档就回「就绪」，否则回「未打开」
   * @returns 面板状态
   */
  private restingStatus(): MapPanelStatus {
    return this.document === undefined ? MapPanelStatus.NotOpened : MapPanelStatus.Ready;
  }

  /**
   * 按当前内容与基线比较，算出是否还有未保存改动
   * @returns 数据域或属性域任一与基线不同时为 true
   */
  private computeUnsaved(): boolean {
    const document = this.document;

    if (document !== undefined && isMapDataDirty(document, this.dataBaseline)) return true;

    return isMapPropertiesDirty(this.properties, this.propertiesBaseline);
  }

  /**
   * 把一条格子撤销记录应用回当前文档；载荷的地图标识不等于当前地图时直接返回，绝不串图
   * @param context 撤销记录
   * @param reverse 为 true 时回退（撤销），为 false 时重放（重做）
   */
  private applyCellUndo(context: IUndoContext<unknown>, reverse: boolean): void {
    if (context.type !== MapUndoType.Cells) return;

    const data = context.data;

    if (!isMapCellsUndoData(data)) return;

    const document = this.document;

    if (document === undefined || data.mapId !== document.id) return;

    const changes = data.changes.map((change) =>
      reverse
        ? { x: change.x, y: change.y, before: change.after, after: change.before }
        : { x: change.x, y: change.y, before: change.before, after: change.after },
    );
    const next = applyCellChanges(document, data.layerId, changes);

    if (next === document) return;

    this.document = next;
    this.refreshUnsaved();
    this.publish({ document: next, notice: undefined, error: undefined });
  }

  /**
   * 按宿主返回重读当前地图；失败时保留内存文档，不把用户改动换成错误页
   * @param mapId 当前地图标识
   */
  private async refreshOpenedMap(mapId: string): Promise<void> {
    const token = ++this.loadToken;

    try {
      const document = await this.capabilities.openMap(mapId);

      if (token !== this.loadToken) return;
      if (!isMapDocumentValid(document)) return;

      this.document = document;
      this.currentLayerId = document.layers[0]?.id;
      this.captureBaseline();
      this.publish({
        status: MapPanelStatus.Ready,
        document,
        currentLayerId: this.currentLayerId,
        unsaved: false,
        error: undefined,
      });
    } catch {
      return;
    }
  }

  render(): FC {
    return this.component;
  }

  setMap(target: IMapPanelTarget): void {
    this.targetMapId = target.mapId;
    void this.openMap(target.mapId);
  }

  /**
   * 读取宿主的地图清单；失败只影响清单，不丢已经打开的地图
   */
  async loadSummaries(): Promise<void> {
    const token = ++this.listToken;

    this.publish({ status: MapPanelStatus.ListLoading, listError: undefined, error: undefined });

    try {
      const summaries = await this.capabilities.listMaps();

      if (token !== this.listToken) return;

      this.publish({
        status: summaries.length === 0 ? MapPanelStatus.NoMaps : this.restingStatus(),
        summaries,
        listError: undefined,
      });
    } catch (error) {
      if (token !== this.listToken) return;

      this.publish({ status: MapPanelStatus.ListError, listError: toErrorMessage(error) });
    }
  }

  /**
   * 读取并打开一张地图；渲染模型留给视图现算
   *
   * 每次调用都递增请求序号，晚到的旧结果直接丢弃；切换地图成功后在撤销栈上留一条屏障，
   * 避免上一张图的撤销记录作用到新图上。
   * @param mapId 地图标识
   */
  async openMap(mapId: string): Promise<void> {
    const token = ++this.loadToken;
    const previousMapId = this.document?.id;

    this.targetMapId = mapId;

    if (mapId === previousMapId) return;

    this.document = undefined;
    this.currentLayerId = undefined;
    this.dataBaseline = undefined;
    this.properties = {};
    this.propertiesBaseline = undefined;
    this.publish({
      status: MapPanelStatus.Loading,
      document: undefined,
      currentLayerId: undefined,
      selection: undefined,
      preview: undefined,
      hover: undefined,
      unsaved: false,
      error: undefined,
      notice: undefined,
    });

    try {
      const document = await this.capabilities.openMap(mapId);

      if (token !== this.loadToken) return;

      if (!isMapDocumentValid(document)) {
        this.publish({ status: MapPanelStatus.Error, error: '地图数据不完整，无法打开。' });
        return;
      }

      this.document = document;
      this.currentLayerId = document.layers[0]?.id;
      this.paletteSelection = selectFirstTile(document);
      this.captureBaseline();
      this.publish({
        status: MapPanelStatus.Ready,
        document,
        currentLayerId: this.currentLayerId,
        paletteSelection: this.paletteSelection,
        viewport: { left: 0, top: 0 },
        selection: undefined,
        preview: undefined,
        hover: undefined,
        unsaved: false,
        error: undefined,
        notice: undefined,
      });

      if (previousMapId !== undefined && previousMapId !== mapId) {
        this.registerBarrier({ action: MapBarrierAction.Switch, mapId });
      }
    } catch (error) {
      if (token !== this.loadToken) return;

      this.publish({ status: MapPanelStatus.Error, error: toErrorMessage(error) });
    }
  }

  /**
   * 把当前文档与属性表记成「已保存基线」；刚打开或刚刷新成功时调用
   *
   * 没有这一步，`isMapDataDirty` 会把「没有基线」当成有改动，用户什么都没做就被判成未保存。
   */
  captureBaseline(): void {
    const document = this.document;

    this.dataBaseline = document === undefined ? undefined : { ...document };
    this.propertiesBaseline = { ...this.properties };
  }

  /**
   * 按基线重新计算「未保存」并发布；撤销 / 重做 / 保存后都要重算，不能只清标志
   */
  refreshUnsaved(): void {
    this.publish({ unsaved: this.computeUnsaved() });
  }

  /**
   * 是否存在尚未保存的改动；每次都按基线现算，避免布尔标志与内容脱节
   * @returns 有改动时为 true
   */
  isDirty(): boolean {
    this.refreshUnsaved();
    return this.store.state.unsaved;
  }

  /**
   * 在撤销栈上登记一条不可撤销的屏障；撤销碰到即停，由装配方提示「无法撤销」
   * @param data 屏障对应的动作与地图标识
   */
  registerBarrier(data: IMapBarrierData): void {
    this.context.addUndoContext(this, { type: MapUndoType.Barrier, data, barrier: true });
  }

  /**
   * 把一笔写入合并成净变化后落到当前文档，并登记一条撤销记录
   *
   * 图块目录里一个图块都没有时直接返回：不落笔、不置脏、不登记撤销。
   * @param layerId 目标图层标识
   * @param writes 这一笔依次落下的写入
   */
  commitCells(layerId: string, writes: readonly IPaintWrite[]): void {
    const document = this.document;

    if (document === undefined) return;
    if (isTileCatalogEmpty(document)) return;

    const layer = document.layers.find((item) => item.id === layerId);

    if (layer === undefined) return;

    const changes = collectNetCellChanges(layer.cells, writes);

    if (changes.length === 0) return;

    const next = applyCellChanges(document, layerId, changes);

    this.document = next;
    this.context.addUndoContext(this, {
      type: MapUndoType.Cells,
      data: { mapId: next.id, layerId, changes },
    });
    this.publish({
      document: next,
      unsaved: this.computeUnsaved(),
      notice: undefined,
      error: undefined,
    });
  }

  /**
   * 手动保存有改动的域：先取快照再等宿主，成功后把「发出去的快照」设为基线
   *
   * 保存期间允许继续编辑；保存完成后按基线重算，所以期间的新改动仍然算脏。
   * @returns 全部保存成功时为 true；没有文档、正在保存或宿主报错时为 false
   */
  async save(): Promise<boolean> {
    if (this.store.state.saving) return false;

    const document = this.document;

    if (document === undefined) return false;

    const dataDirty = isMapDataDirty(document, this.dataBaseline);

    if (!dataDirty) {
      this.refreshUnsaved();
      return true;
    }

    const snapshot: IMapDocument = { ...document };

    this.publish({ saving: true, error: undefined, notice: undefined });

    try {
      await this.capabilities.saveMapData({
        id: snapshot.id,
        width: snapshot.width,
        height: snapshot.height,
        layers: snapshot.layers,
      });
      this.dataBaseline = snapshot;
      this.refreshUnsaved();
      this.publish({ notice: MAP_SAVED_MESSAGE, error: undefined });
      return true;
    } catch (error) {
      this.refreshUnsaved();
      this.publish({ error: toErrorMessage(error) });
      return false;
    } finally {
      this.publish({ saving: false });
    }
  }

  async undo(context: IUndoContext<unknown>): Promise<void> {
    this.applyCellUndo(context, true);
  }

  async redo(context: IUndoContext<unknown>): Promise<void> {
    this.applyCellUndo(context, false);
  }

  async initialize(): Promise<void> {}

  async dispose(): Promise<void> {
    this.document = undefined;
    this.currentLayerId = undefined;
    this.dataBaseline = undefined;
    this.properties = {};
    this.propertiesBaseline = undefined;
  }

  async onFocus(): Promise<void> {}

  async onBlur(): Promise<void> {}

  /**
   * 切入面板时重读清单；有未保存改动时不重读当前地图，避免覆盖内存改动
   */
  async onSwitchIn(): Promise<void> {
    await this.loadSummaries();

    const document = this.document;

    if (document === undefined) return;
    if (this.isDirty()) return;

    await this.refreshOpenedMap(document.id);
  }

  async onSwitchOut(): Promise<void> {}

  async onUpdateResource(): Promise<void> {}
}
