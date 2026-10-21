import { ITableSchemaNode } from '../shared/schemaForm/types';

// 地图能力的类型集中地：中立文档 / 图块目录 / 宿主注入面 / 面板状态 / 撤销载荷 / 渲染模型。
// 本文件只有声明，没有任何逻辑；实现由后续计划补齐。

export const enum MapPanelStatus {
  /** 面板还没有打开过地图，也没有读过清单 */
  NotOpened,
  /** 正在读取宿主的地图清单 */
  ListLoading,
  /** 读取地图清单失败 */
  ListError,
  /** 宿主返回的清单为空 */
  NoMaps,
  /** 正在读取某张地图的整份文档 */
  Loading,
  /** 地图已就绪，可以编辑 */
  Ready,
  /** 地图读取失败 */
  Error,
}

export const enum MapBrushMode {
  /** 线：按住左键拖动，沿经过的格子落笔 */
  Line,
  /** 矩形：按住左键拖出矩形，松开时整块落笔 */
  Rect,
  /** 填充：左键单击，把与点击格同值的连通区域替换为图案 */
  Fill,
}

export const enum MapUndoType {
  /** 一笔格子改动的撤销记录 */
  Cells,
  /** 一个地图属性字段改动的撤销记录 */
  Property,
  /** 不可撤销的屏障：新建地图 / 新增图层 / 切换地图 / 放弃改动 */
  Barrier,
}

export const enum MapPaletteKind {
  /** 空选择，绘制即擦除 */
  Empty,
  /** 从图块目录里选中的图案 */
  Tiles,
  /** 从最近使用里选中的单格图块 */
  Recent,
}

export const enum MapDialogKind {
  /** 没有受控弹窗 */
  None,
  /** 新建地图弹窗 */
  New,
  /** 新增图层弹窗 */
  Layer,
  /** 未保存改动确认弹窗 */
  Unsaved,
}

export const enum MapUnsavedChoice {
  /** 保存并继续原操作 */
  SaveAndContinue,
  /** 放弃内存改动并继续原操作 */
  Discard,
  /** 取消原操作，保持现状 */
  Cancel,
}

export const enum MapGestureKind {
  /** 没有进行中的画布手势 */
  None,
  /** 左键落笔手势 */
  Paint,
  /** 右键框选手势 */
  Marquee,
}

export const enum MapImageStatus {
  /** 正在读取图片字节 */
  Loading,
  /** 图片可用，可以生成纹理或地址 */
  Ready,
  /** 图片读取失败，可重试 */
  Error,
}

export interface IMapDirections {
  /** 能否向上通行 */
  readonly up: boolean;
  /** 能否向右通行 */
  readonly right: boolean;
  /** 能否向下通行 */
  readonly down: boolean;
  /** 能否向左通行 */
  readonly left: boolean;
}

export interface IMapTileCrop {
  /** 裁切矩形左上角的横坐标（像素） */
  readonly x: number;
  /** 裁切矩形左上角的纵坐标（像素） */
  readonly y: number;
  /** 裁切宽度（像素） */
  readonly width: number;
  /** 裁切高度（像素） */
  readonly height: number;
}

export interface IMapTilePass {
  /** 从此图块可以离开的方向 */
  readonly out: IMapDirections;
  /** 可以进入此图块的方向 */
  readonly in: IMapDirections;
  /** 为 true 时，该图块只在事件图层参与通行度显示 */
  readonly onlyEventLayer: boolean;
}

export interface IMapTileEntry {
  /** 写进地图格子的图块编号；0 表示空格，不会出现在条目里 */
  readonly number: number;
  /** 图块在整张图集里的列号（多格图案按它查表，不依赖编号连续） */
  readonly column: number;
  /** 图块在整张图集里的行号 */
  readonly row: number;
  /** 从源图片上裁出的像素矩形 */
  readonly crop: IMapTileCrop;
  /** 展示给用户看的图块名 */
  readonly name: string;
  /** 图块的四方向通行属性 */
  readonly pass: IMapTilePass;
}

export interface IMapTileGroup {
  /** 分组标识，用于折叠状态与图片地址缓存 */
  readonly id: string;
  /** 分组名称，显示在调色板上方 */
  readonly name: string;
  /** 图集图片相对项目根的路径；面板经资源层读取，不直接触达文件系统 */
  readonly imagePath: string;
  /** 图集横向的图块列数，用于按列 / 行换算裁切来源 */
  readonly columns: number;
  /** 分组内的图块列表 */
  readonly tiles: readonly IMapTileEntry[];
}

export interface IMapLayer {
  /** 图层标识，撤销载荷与当前层选择都用它 */
  readonly id: string;
  /** 图层显示名 */
  readonly name: string;
  /** 宿主给定的绘制顺序，越小越靠下 */
  readonly zIndex: number;
  /** 是否为事件图层；只影响通行度叠加层的显示口径 */
  readonly isEventLayer: boolean;
  /** 二维数字格子，索引顺序为 `[y][x]` */
  readonly cells: readonly (readonly number[])[];
}

export interface IMapDocument {
  /** 地图标识，由宿主解释，面板原样带回 */
  readonly id: string;
  /** 地图显示名 */
  readonly name: string;
  /** 地图宽度（格子数） */
  readonly width: number;
  /** 地图高度（格子数） */
  readonly height: number;
  /** 命名图层，按数组顺序展示、按 zIndex 绘制 */
  readonly layers: readonly IMapLayer[];
  /** 宿主算好的图块目录，随文档一起到达 */
  readonly tileGroups: readonly IMapTileGroup[];
}

export interface IMapSize {
  /** 宽度（格子数） */
  readonly width: number;
  /** 高度（格子数） */
  readonly height: number;
}

export interface IMapSizeLimit {
  /** 允许的最大宽度（格子数） */
  readonly maxWidth: number;
  /** 允许的最大高度（格子数） */
  readonly maxHeight: number;
}

export interface IMapSummary {
  /** 地图标识，面板不解释它的含义 */
  readonly id: string;
  /** 地图显示名 */
  readonly name: string;
}

export interface IMapCreateRequest {
  /** 新地图的名称 */
  readonly name: string;
  /** 新地图的宽度（格子数） */
  readonly width: number;
  /** 新地图的高度（格子数） */
  readonly height: number;
  /** 第一层的图层名 */
  readonly layerName: string;
}

export interface IMapDataSection {
  /** 地图标识 */
  readonly id: string;
  /** 地图宽度（格子数） */
  readonly width: number;
  /** 地图高度（格子数） */
  readonly height: number;
  /** 整份图层几何 */
  readonly layers: readonly IMapLayer[];
}

export interface IMapEditorCapabilities {
  /**
   * 列出当前项目里的地图
   * @returns 地图清单，面板只拿标识与名称
   */
  listMaps(): Promise<readonly IMapSummary[]>;

  /**
   * 打开一张地图
   * @param mapId 地图标识
   * @returns 解析好的中立文档
   */
  openMap(mapId: string): Promise<IMapDocument>;

  /**
   * 保存地图数据域
   * @param data 整份地图几何；宿主负责保留未展示的事件与额外字段
   * @returns 写入完成的异步结果
   */
  saveMapData(data: IMapDataSection): Promise<void>;

  /**
   * 新建地图，由宿主按自己的格式建文件
   * @param request 名称、尺寸与初始图层名
   * @returns 新建好的中立文档
   */
  createMap?(request: IMapCreateRequest): Promise<IMapDocument>;

  /**
   * 新增图层，由宿主按自己的格式加层
   * @param mapId 要加层的地图标识
   * @returns 加层后的整份中立文档
   */
  addLayer?(mapId: string): Promise<IMapDocument>;

  /**
   * 读取整份地图属性表
   * @param mapId 地图标识
   * @returns 属性表的键值对
   */
  readProperties?(mapId: string): Promise<Record<string, unknown>>;

  /**
   * 保存整份地图属性表
   * @param mapId 地图标识
   * @param properties 整份属性表，不是逐字段补丁
   * @returns 写入完成的异步结果
   */
  saveMapProperties?(mapId: string, properties: Record<string, unknown>): Promise<void>;

  /** 地图属性表单的 JSON Schema；缺省时「地图属性」入口禁用 */
  readonly propertiesSchema?: ITableSchemaNode;

  /** 地图尺寸上限；缺省表示不限制 */
  readonly maxMapSize?: IMapSizeLimit;

  /** 覆盖最近使用文件的约定路径 */
  readonly recentTilesPath?: string;
}

export interface IMapPanelTarget {
  /** 要打开的地图标识 */
  readonly mapId: string;
}

export interface IMapPanelParam extends Record<string, unknown> {
  /** 打开面板时可带的初始目标 */
  readonly target?: IMapPanelTarget;
}

export interface IMapPanel {
  /**
   * 从外部设定此面板实例要打开的地图
   * @param target 要打开的地图标识
   */
  setMap(target: IMapPanelTarget): void;

  /**
   * 手动保存有改动的域
   * @returns 全部保存成功时为 true
   */
  save(): Promise<boolean>;
}

export interface IMapBrushPattern {
  /** 图案宽度（格子数） */
  readonly width: number;
  /** 图案高度（格子数） */
  readonly height: number;
  /** 行主序的图块编号，0 表示空 */
  readonly tiles: readonly number[];
}

export interface IMapPaletteSelection {
  /** 当前选择的种类：空 / 图块图案 / 最近使用 */
  readonly kind: MapPaletteKind;
  /** 当前图案；空选择时为宽高各 1、内容为 0 的图案 */
  readonly pattern: IMapBrushPattern;
  /** 主图块编号，用于最近使用记录；空选择时为 0 */
  readonly primaryTileNumber: number;
}

export interface IMapRect {
  /** 矩形左上角的横坐标（格子） */
  readonly x: number;
  /** 矩形左上角的纵坐标（格子） */
  readonly y: number;
  /** 矩形宽度（格子数） */
  readonly width: number;
  /** 矩形高度（格子数） */
  readonly height: number;
}

export interface IMapCellPosition {
  /** 格子横坐标 */
  readonly x: number;
  /** 格子纵坐标 */
  readonly y: number;
}

export interface IMapCellChange {
  /** 格子横坐标 */
  readonly x: number;
  /** 格子纵坐标 */
  readonly y: number;
  /** 改动前的图块编号 */
  readonly before: number;
  /** 改动后的图块编号 */
  readonly after: number;
}

export interface IMapClipboard {
  /** 剪贴块宽度（格子数） */
  readonly width: number;
  /** 剪贴块高度（格子数） */
  readonly height: number;
  /** 行主序的图块编号，0 表示空 */
  readonly tiles: readonly number[];
}

export interface IMapViewport {
  /** 视口左上角所在的格子横坐标 */
  readonly left: number;
  /** 视口左上角所在的格子纵坐标 */
  readonly top: number;
}

export interface IMapCellsUndoData {
  /** 这条撤销记录属于哪张地图 */
  readonly mapId: string;
  /** 这条撤销记录属于哪个图层 */
  readonly layerId: string;
  /** 一笔之内的净格子变化 */
  readonly changes: readonly IMapCellChange[];
}

export interface IMapPropertyUndoData {
  /** 这条撤销记录属于哪张地图 */
  readonly mapId: string;
  /** 被修改字段的路径 */
  readonly path: readonly (string | number)[];
  /** 修改前的值 */
  readonly before: unknown;
  /** 修改后的值 */
  readonly after: unknown;
}

export interface IMapRenderCell {
  /** 稳定的绘制 key，用于增量更新 */
  readonly key: string;
  /** 目标像素矩形的左上角横坐标 */
  readonly x: number;
  /** 目标像素矩形的左上角纵坐标 */
  readonly y: number;
  /** 目标像素矩形的宽度 */
  readonly width: number;
  /** 目标像素矩形的高度 */
  readonly height: number;
  /** 绘制不透明度，0..1 */
  readonly opacity: number;
  /** 编号在目录里查不到；没有图片时画占位格 */
  readonly missing: boolean;
  /** 图片相对项目根的路径；与 crop 同时缺省表示空格子 */
  readonly imagePath?: string;
  /** 图片上的像素裁切；与 imagePath 同时缺省表示空格子 */
  readonly crop?: IMapTileCrop;
}

export interface IMapRenderGridLine {
  /** 线条起点的像素横坐标 */
  readonly x: number;
  /** 线条起点的像素纵坐标 */
  readonly y: number;
  /** 线条长度（像素） */
  readonly length: number;
  /** 为 true 时是竖线，否则是横线 */
  readonly vertical: boolean;
}

export interface IMapPassMark {
  /** 标记所在格子的横坐标 */
  readonly x: number;
  /** 标记所在格子的纵坐标 */
  readonly y: number;
  /** 该格不可通行的方向 */
  readonly blocked: IMapDirections;
  /** 为 true 时降级为红点（大地图缩小时） */
  readonly dot: boolean;
}

export interface IMapPreview {
  /** 预览覆盖的格子矩形 */
  readonly rect: IMapRect;
  /** 图案宽度（格子数） */
  readonly patternWidth: number;
  /** 图案高度（格子数） */
  readonly patternHeight: number;
}

export interface IMapRenderModel {
  /** 画布宽度（像素） */
  readonly width: number;
  /** 画布高度（像素） */
  readonly height: number;
  /** 本帧要画的格子 */
  readonly cells: readonly IMapRenderCell[];
  /** 本帧要画的网格线 */
  readonly gridLines: readonly IMapRenderGridLine[];
  /** 本帧要画的通行度标记 */
  readonly passMarks: readonly IMapPassMark[];
  /** 当前框选矩形；没有选区时为 undefined */
  readonly selection?: IMapRect;
  /** 当前绘制预览；没有预览时为 undefined */
  readonly preview?: IMapPreview;
  /** 当前悬停的格子；指针不在画布上时为 undefined */
  readonly hover?: IMapCellPosition;
}

export interface IMapPanelViewState {
  /** 面板数据状态 */
  readonly status: MapPanelStatus;
  /** 宿主地图清单 */
  readonly summaries: readonly IMapSummary[];
  /** 读取清单失败时的原因；无错误时为 undefined */
  readonly listError?: string;
  /** 当前打开的中立文档；尚未打开时为 undefined */
  readonly document?: IMapDocument;
  /** 当前图层的标识；未打开地图时为 undefined */
  readonly currentLayerId?: string;
  /** 当前画笔模式 */
  readonly brushMode: MapBrushMode;
  /** 当前调色板选中 */
  readonly paletteSelection: IMapPaletteSelection;
  /** 最近使用的图块编号，按最近程度排序 */
  readonly recentTiles: readonly number[];
  /** 最近使用图块图片的读取状态 */
  readonly recentStatus: MapImageStatus;
  /** 当前打开的受控弹窗 */
  readonly dialog: MapDialogKind;
  /** 受控弹窗里的错误文案；无错误时为 undefined */
  readonly dialogError?: string;
  /** 图块图片重试计数，递增即重新读取字节 */
  readonly paletteVersion: number;
  /** 地图属性抽屉是否打开 */
  readonly propertiesOpen: boolean;
  /** 面板算好的通行度标记，渲染模型只消费 */
  readonly passMarks: readonly IMapPassMark[];
  /** 高于当前层的图层统一不透明度，0..1 */
  readonly aboveLayerOpacity: number;
  /** 是否显示只读通行度叠加层 */
  readonly passabilityVisible: boolean;
  /** 是否处于大地图模式 */
  readonly bigMap: boolean;
  /** 视口左上角所在的格子坐标 */
  readonly viewport: IMapViewport;
  /** 当前框选矩形；没有选区时为 undefined */
  readonly selection?: IMapRect;
  /** 面板内部剪贴板；从未复制过时为 undefined */
  readonly clipboard?: IMapClipboard;
  /** 当前绘制预览；没有预览时为 undefined */
  readonly preview?: IMapPreview;
  /** 当前悬停的格子；指针不在画布上时为 undefined */
  readonly hover?: IMapCellPosition;
  /** 是否存在尚未保存的改动 */
  readonly unsaved: boolean;
  /** 是否正在保存 */
  readonly saving: boolean;
  /** 保存成功后的提示行；没有提示时为 undefined */
  readonly notice?: string;
  /** 加载或保存失败时的错误文案；无错误时为 undefined */
  readonly error?: string;
}
