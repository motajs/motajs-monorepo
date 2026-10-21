import { Store } from '@tanstack/store';
import { createElement, FC, ReactElement } from 'react';
import { IEditorPanel, IEditorPanelContext, IEditorPanelFactoryParam, IUndoContext } from '@motajs/editor-core';
import {
  MAP_ABOVE_LAYER_DEFAULT_OPACITY,
  MAP_RECENT_TILES_KEY,
  MAP_RECENT_TILES_LIMIT,
  MAP_RECENT_TILES_PATH,
  MAP_SAVED_MESSAGE,
} from './constants';
import { parseTableText, serializeTableText } from '../shared/jsonc/tableText';
import { MapPanelView } from './components/MapPanelView';
import { isMapDataDirty, isMapPropertiesDirty } from './model/dirty';
import {
  applyCellChanges,
  collectNetCellChanges,
  IPaintWrite,
  isMapDocumentValid,
  isTileCatalogEmpty,
} from './model/document';
import { normalizeRecentTiles, updateRecentTiles } from './model/recentTiles';
import { validateLayerName, validateMapName, validateMapSize } from './model/validation';
import {
  IMapCellChange,
  IMapCellsUndoData,
  IMapCreateRequest,
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
  MapUnsavedChoice,
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
  /** 由宿主新建了一张地图 */
  Create,
  /** 由宿主新增了一个图层 */
  AddLayer,
  /** 放弃了内存改动，恢复到最近基线 */
  Discard,
}

/**
 * 判断路径能否交给资源层：拒绝空路径、绝对路径与含 `..` 段的路径（与图块图片同一套规则）
 * @param path 项目内相对路径
 * @returns 路径合法时为 true
 */
function isSafeProjectPath(path: string): boolean {
  if (path.length === 0) return false;
  if (path.startsWith('/') || path.startsWith('\\')) return false;

  return !path.split(/[\\/]/).includes('..');
}

/**
 * 深拷贝一份中立文档：只复制会被继续编辑的图层几何，图块目录原样沿用
 * @param document 待拷贝的文档
 * @returns 图层与格子都不共享引用的新文档
 */
function cloneMapDocument(document: IMapDocument): IMapDocument {
  const layers = document.layers.map((layer) => ({ ...layer, cells: layer.cells.map((row) => [...row]) }));

  return { ...document, layers };
}

/**
 * 判断一个值是否为非空、非数组的普通对象
 * @param value 待判断的值
 * @returns 是普通对象时为 true
 */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 递归复制任意属性值，避免放弃改动后继续编辑时改到基线里的嵌套对象
 * @param value 待复制的值
 * @returns 与入参结构相同、不共享引用对象的新值
 */
function cloneUnknown(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item: unknown) => cloneUnknown(item));
  if (!isPlainRecord(value)) return value;

  const result: Record<string, unknown> = {};

  for (const key of Object.keys(value)) result[key] = cloneUnknown(value[key]);

  return result;
}

/**
 * 把用户填写的图层名写到宿主返回文档的最后一个图层上
 *
 * 宿主能力只接收地图标识，不接收图层名；新图层按约定追加到末尾，因此在这里补上名字，
 * 让它随之后的整份保存一起写回，而不是只停留在弹窗里。
 * @param document 宿主返回的整份文档
 * @param layerName 用户输入并已校验的图层名
 * @returns 新图层已改名的文档；没有图层时原样返回
 */
function nameLastLayer(document: IMapDocument, layerName: string): IMapDocument {
  const index = document.layers.length - 1;

  if (index < 0) return document;

  const layers = document.layers.map((layer, current) => (current === index ? { ...layer, name: layerName } : layer));

  return { ...document, layers };
}

/** 未保存确认的结算函数：把「继续 / 取消」交回等待方 */
type UnsavedDecisionResolver = (value: boolean) => void;

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

/**
 * 递归复制一份属性表，避免放弃改动后继续编辑时改到基线里的嵌套对象
 * @param properties 待复制的属性表
 * @returns 不共享引用对象的新属性表
 */
function cloneProperties(properties: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const key of Object.keys(properties)) result[key] = cloneUnknown(properties[key]);

  return result;
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

  /** 是否正在等宿主创建地图 / 新增图层；此时不允许关闭弹窗 */
  private creating: boolean = false;

  /** 未保存确认弹窗的结算函数；没有待决询问时为 undefined */
  private pendingUnsavedResolve?: UnsavedDecisionResolver;

  /** 未保存确认弹窗等待中的结果；没有待决询问时为 undefined */
  private pendingUnsavedPromise?: Promise<boolean>;

  /** 最近使用读取的序号，用来丢弃晚到的结果，避免刚画的一笔被早先的读取覆盖 */
  private recentToken: number = 0;

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
      void this.loadRecentTiles();
    } catch {
      return;
    }
  }

  /**
   * 结算一次未保存询问：先清掉待决状态再回答，重复点击不会二次结算
   * @param value 为 true 表示继续原操作
   */
  private settleUnsavedDecision(value: boolean): void {
    const resolve = this.pendingUnsavedResolve;

    this.pendingUnsavedResolve = undefined;
    this.pendingUnsavedPromise = undefined;

    if (resolve !== undefined) resolve(value);
  }

  /**
   * 取最近使用文件的项目内路径；宿主可覆盖，非法路径直接视为不可用
   * @returns 可交给资源层的路径；路径非法时为 undefined
   */
  private resolveRecentTilesPath(): string | undefined {
    const path = this.capabilities.recentTilesPath ?? MAP_RECENT_TILES_PATH;

    return isSafeProjectPath(path) ? path : undefined;
  }

  /**
   * 收集当前文档图块目录里的全部编号，供最近使用的归一化过滤
   * @returns 目录里存在的编号集合
   */
  private collectTileNumbers(): ReadonlySet<number> {
    const numbers: Set<number> = new Set();
    const document = this.document;

    if (document === undefined) return numbers;

    for (const group of document.tileGroups) {
      for (const tile of group.tiles) numbers.add(tile.number);
    }

    return numbers;
  }

  /**
   * 把最近使用文件原文解析成编号列表；无法解析或形状不对时退化为空列表
   * @param text 文件原文
   * @param knownNumbers 图块目录里存在的编号集合
   * @returns 归一化后的最近使用列表
   */
  private parseRecentTiles(text: string, knownNumbers: ReadonlySet<number>): readonly number[] {
    const parsed = parseTableText(text);

    if (!isPlainRecord(parsed.value)) return [];

    return normalizeRecentTiles(parsed.value[MAP_RECENT_TILES_KEY], knownNumbers, MAP_RECENT_TILES_LIMIT);
  }

  /**
   * 按读取序号发布最近使用列表；序号已被更晚的读写取代时直接丢弃
   * @param token 本次读取的序号
   * @param tiles 读出的列表
   */
  private publishRecentTiles(token: number, tiles: readonly number[]): void {
    if (token !== this.recentToken) return;

    this.publish({ recentTiles: tiles });
  }

  /**
   * 打开一个受控弹窗，并清掉上一次留下的错误
   * @param kind 要打开的弹窗
   */
  openDialog(kind: MapDialogKind): void {
    this.publish({ dialog: kind, dialogError: undefined });
  }

  /**
   * 关闭受控弹窗；提交中不允许关闭，避免把正在创建 / 保存的操作丢在半路
   */
  closeDialog(): void {
    if (this.creating || this.store.state.saving) return;

    this.publish({ dialog: MapDialogKind.None, dialogError: undefined });
  }

  /**
   * 有未保存改动时先问一句；没有改动时直接放行
   * @returns 为 true 表示可以继续原操作
   */
  requestUnsavedDecision(): Promise<boolean> {
    if (!this.isDirty()) return Promise.resolve(true);

    const pending = this.pendingUnsavedPromise;

    if (pending !== undefined) return pending;

    const promise = new Promise<boolean>((resolve) => {
      this.pendingUnsavedResolve = resolve;
    });

    this.pendingUnsavedPromise = promise;
    this.openDialog(MapDialogKind.Unsaved);

    return promise;
  }

  /**
   * 未保存弹窗三个按钮的唯一承接方法：视图只把用户按了哪个交上来
   * @param choice 用户选择的动作
   */
  async resolveUnsavedDecision(choice: MapUnsavedChoice): Promise<void> {
    if (this.pendingUnsavedResolve === undefined) return;

    if (choice === MapUnsavedChoice.Cancel) {
      this.closeDialog();
      this.settleUnsavedDecision(false);
      return;
    }

    if (choice === MapUnsavedChoice.Discard) {
      await this.requestDiscard();
      this.closeDialog();
      this.settleUnsavedDecision(true);
      return;
    }

    const saved = await this.save();

    if (!saved) return;

    this.closeDialog();
    this.settleUnsavedDecision(true);
  }

  /**
   * 放弃内存改动：用最近基线覆盖文档与属性，并登记一条屏障
   *
   * 覆盖的是深拷贝，之后继续编辑不会改到基线本身；没有基线时退回空状态。
   */
  async requestDiscard(): Promise<void> {
    const baseline = this.dataBaseline;
    const propertiesBaseline = this.propertiesBaseline;

    this.document = baseline === undefined ? undefined : cloneMapDocument(baseline);
    this.properties = propertiesBaseline === undefined ? {} : cloneProperties(propertiesBaseline);
    this.publish({
      document: this.document,
      currentLayerId: this.currentLayerId,
      selection: undefined,
      preview: undefined,
      hover: undefined,
    });
    this.refreshUnsaved();
    this.registerBarrier({ action: MapBarrierAction.Discard, mapId: this.document?.id ?? '' });
  }

  /**
   * 外壳在关闭标签前询问：有未保存改动时等用户决定，出错按取消关闭处理
   * @returns 允许关闭时为 true
   */
  async onBeforeClose(): Promise<boolean> {
    try {
      return await this.requestUnsavedDecision();
    } catch {
      return false;
    }
  }

  /**
   * 调宿主新建地图；成功后打开新文档、把当前层设为初始图层并登记屏障
   * @param request 名称、尺寸与初始图层名
   */
  async createMap(request: IMapCreateRequest): Promise<void> {
    if (this.capabilities.createMap === undefined) {
      this.publish({ dialogError: '当前项目不支持新建地图。' });
      return;
    }

    const name = request.name.trim();
    const layerName = request.layerName.trim();
    const nameError = validateMapName(
      name,
      this.store.state.summaries.map((summary) => summary.name),
    );

    if (nameError !== null) {
      this.publish({ dialogError: nameError });
      return;
    }

    const sizeError = validateMapSize({ width: request.width, height: request.height }, this.capabilities.maxMapSize);

    if (sizeError !== null) {
      this.publish({ dialogError: sizeError });
      return;
    }

    const layerError = validateLayerName(layerName, []);

    if (layerError !== null) {
      this.publish({ dialogError: layerError });
      return;
    }

    if (!(await this.requestUnsavedDecision())) return;

    this.creating = true;
    const token = ++this.loadToken;

    this.publish({ dialogError: undefined, error: undefined, notice: undefined });

    try {
      const document = await this.capabilities.createMap!({
        name,
        width: request.width,
        height: request.height,
        layerName,
      });

      if (token !== this.loadToken) return;

      if (!isMapDocumentValid(document)) {
        this.publish({ dialogError: '地图数据不完整，无法打开。' });
        return;
      }

      this.document = document;
      this.currentLayerId = document.layers[0]?.id;
      this.paletteSelection = selectFirstTile(document);
      this.properties = {};
      this.propertiesBaseline = undefined;
      this.targetMapId = document.id;
      this.captureBaseline();
      this.registerBarrier({ action: MapBarrierAction.Create, mapId: document.id });
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
        dialog: MapDialogKind.None,
        dialogError: undefined,
        notice: `已创建地图「${name}」`,
        error: undefined,
      });
      void this.loadRecentTiles();
      await this.loadSummaries();
    } catch (error) {
      if (token === this.loadToken) this.publish({ dialogError: toErrorMessage(error) });
    } finally {
      this.creating = false;
    }
  }

  /**
   * 调宿主新增图层；成功后把新层设为当前层、补上用户填写的名字并登记屏障
   * @param layerName 用户填写的图层名
   */
  async addLayer(layerName: string): Promise<void> {
    if (this.capabilities.addLayer === undefined) {
      this.publish({ dialogError: '当前项目不支持新增图层。' });
      return;
    }

    const document = this.document;

    if (document === undefined) return;

    const name = layerName.trim();
    const nameError = validateLayerName(
      name,
      document.layers.map((layer) => layer.name),
    );

    if (nameError !== null) {
      this.publish({ dialogError: nameError });
      return;
    }

    if (!(await this.requestUnsavedDecision())) return;

    this.creating = true;
    const token = ++this.loadToken;

    this.publish({ dialogError: undefined, error: undefined, notice: undefined });

    try {
      const next = await this.capabilities.addLayer!(document.id);

      if (token !== this.loadToken) return;

      if (!isMapDocumentValid(next)) {
        this.publish({ dialogError: '地图数据不完整，无法打开。' });
        return;
      }

      const named = nameLastLayer(next, name);
      const lastLayer = named.layers[named.layers.length - 1];

      this.document = named;
      this.currentLayerId = lastLayer?.id;
      this.captureBaseline();
      this.registerBarrier({ action: MapBarrierAction.AddLayer, mapId: named.id });
      this.publish({
        status: MapPanelStatus.Ready,
        document: named,
        currentLayerId: this.currentLayerId,
        unsaved: false,
        dialog: MapDialogKind.None,
        dialogError: undefined,
        notice: `已新增图层「${name}」`,
        error: undefined,
      });
    } catch (error) {
      if (token === this.loadToken) this.publish({ dialogError: toErrorMessage(error) });
    } finally {
      this.creating = false;
    }
  }

  /**
   * 从项目内约定文件读出最近使用图块；文件缺失或损坏都按空列表处理
   */
  async loadRecentTiles(): Promise<void> {
    const token = ++this.recentToken;
    const path = this.resolveRecentTilesPath();

    if (path === undefined) {
      this.publishRecentTiles(token, []);
      return;
    }

    try {
      const resource = await this.context.requestResource(path);

      if (resource === null) {
        this.publishRecentTiles(token, []);
        return;
      }

      const content = await resource.request();

      if (typeof content !== 'string') {
        this.publishRecentTiles(token, []);
        return;
      }

      this.publishRecentTiles(token, this.parseRecentTiles(content, this.collectTileNumbers()));
    } catch {
      this.publishRecentTiles(token, []);
    }
  }

  /**
   * 把当前最近使用列表写回项目内约定文件；失败静默降级，不影响绘制
   */
  async writeRecentTiles(): Promise<void> {
    const path = this.resolveRecentTilesPath();

    if (path === undefined) return;

    const text = serializeTableText({ [MAP_RECENT_TILES_KEY]: this.store.state.recentTiles }, '');

    try {
      const resource = await this.context.requestResource(path);

      if (resource !== null) {
        await resource.write(text);
        return;
      }

      await this.context.createResource(path, text);
    } catch {
      return;
    }
  }

  /**
   * 清空最近使用记录并写回文件；该动作不可撤销
   */
  async clearRecentTiles(): Promise<void> {
    this.recentToken += 1;
    this.publish({ recentTiles: [] });
    await this.writeRecentTiles();
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
   * 有未保存改动时先问一句；取消则保持当前地图不动。每次继续都递增请求序号，晚到的旧结果直接丢弃；
   * 切换地图成功后在撤销栈上留一条屏障，避免上一张图的撤销记录作用到新图上。
   * @param mapId 地图标识
   */
  async openMap(mapId: string): Promise<void> {
    const previousMapId = this.document?.id;

    if (mapId === previousMapId) return;

    if (this.isDirty()) {
      const decision = await this.requestUnsavedDecision();

      if (!decision) return;
    }

    const token = ++this.loadToken;

    this.targetMapId = mapId;

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
      void this.loadRecentTiles();

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
    const selection = this.paletteSelection;
    const recordsRecent = selection.kind !== MapPaletteKind.Empty && selection.primaryTileNumber > 0;
    const recentTiles = recordsRecent
      ? updateRecentTiles(this.store.state.recentTiles, selection.primaryTileNumber, MAP_RECENT_TILES_LIMIT)
      : this.store.state.recentTiles;

    if (recordsRecent) this.recentToken += 1;

    this.document = next;
    this.context.addUndoContext(this, {
      type: MapUndoType.Cells,
      data: { mapId: next.id, layerId, changes },
    });
    this.publish({
      document: next,
      recentTiles,
      unsaved: this.computeUnsaved(),
      notice: undefined,
      error: undefined,
    });

    if (recordsRecent) void this.writeRecentTiles();
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
    this.settleUnsavedDecision(false);
    this.creating = false;
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
