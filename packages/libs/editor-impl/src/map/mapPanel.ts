import { Store } from '@tanstack/store';
import { createElement, FC, ReactElement } from 'react';
import { IEditorPanel, IEditorPanelContext, IEditorPanelFactoryParam } from '@motajs/editor-core';
import { MAP_ABOVE_LAYER_DEFAULT_OPACITY, MAP_SAVED_MESSAGE } from './constants';
import { MapPanelView } from './components/MapPanelView';
import {
  applyCellChanges,
  collectNetCellChanges,
  IPaintWrite,
  isMapDocumentValid,
  isTileCatalogEmpty,
} from './model/document';
import {
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

  render(): FC {
    return this.component;
  }

  setMap(target: IMapPanelTarget): void {
    this.targetMapId = target.mapId;
    void this.openMap(target.mapId);
  }

  /**
   * 读取并打开一张地图；渲染模型留给视图现算
   * @param mapId 地图标识
   */
  async openMap(mapId: string): Promise<void> {
    this.publish({ status: MapPanelStatus.Loading, error: undefined, notice: undefined });

    try {
      const document = await this.capabilities.openMap(mapId);

      if (!isMapDocumentValid(document)) {
        this.publish({ status: MapPanelStatus.Error, error: '地图数据不完整，无法打开。' });
        return;
      }

      this.document = document;
      this.currentLayerId = document.layers[0].id;
      this.paletteSelection = selectFirstTile(document);
      this.publish({
        status: MapPanelStatus.Ready,
        document,
        currentLayerId: this.currentLayerId,
        paletteSelection: this.paletteSelection,
        unsaved: false,
        error: undefined,
        notice: undefined,
      });
    } catch (error) {
      this.publish({ status: MapPanelStatus.Error, error: toErrorMessage(error) });
    }
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
    this.publish({ document: next, unsaved: true, notice: undefined, error: undefined });
  }

  async save(): Promise<boolean> {
    const document = this.document;

    if (document === undefined) return false;
    if (!this.store.state.unsaved) return true;

    this.publish({ saving: true, error: undefined, notice: undefined });

    try {
      await this.capabilities.saveMapData({
        id: document.id,
        width: document.width,
        height: document.height,
        layers: document.layers,
      });
      this.publish({ saving: false, unsaved: false, notice: MAP_SAVED_MESSAGE, error: undefined });
      return true;
    } catch (error) {
      this.publish({ saving: false, error: toErrorMessage(error) });
      return false;
    }
  }

  async undo(): Promise<void> {}

  async redo(): Promise<void> {}

  async initialize(): Promise<void> {}

  async dispose(): Promise<void> {
    this.document = undefined;
    this.currentLayerId = undefined;
  }

  async onFocus(): Promise<void> {}

  async onBlur(): Promise<void> {}

  async onSwitchIn(): Promise<void> {}

  async onSwitchOut(): Promise<void> {}

  async onUpdateResource(): Promise<void> {}
}
