import { TablePanelStatus } from '../shared/schemaForm/components/TableGrid';
import { ITableRowNode, ITableSchemaNode } from '../shared/schemaForm/types';

// 地图能力的类型集中地：中立文档 / 图块目录 / 宿主注入面 / 面板状态 / 撤销载荷 / 渲染模型。
// 本文件只有声明，没有任何逻辑；实现由后续计划补齐。
// 图块图片地址有两张各自键空间的表：IMapImageSources 以图片路径为键（画布用），
// IMapTileGroupUrls 以 `IMapTileGroup.id` 为键（素材区 / 底栏 / 收藏栏用），两者禁止互相查表（D-01 / D-20）。

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

export const enum MapTileCategory {
  /** 地形类素材；引擎里单独分出的动态地形也归到这里 */
  Terrain,
  /** 敌人与机关类素材 */
  Enemy,
  /** 人物与 NPC 类素材 */
  Npc,
  /** 物品与道具类素材 */
  Item,
  /** 自动拼接类素材，按连接关系拼出四个象限 */
  Autotile,
  /** 整张 Tileset 素材；只作为整块图案使用，不参与收藏 */
  Tileset,
}

export const enum MapTextureReadType {
  /** 整张图就是一张素材，不分格 */
  Full,
  /** 按格切图，格子尺寸取素材组的 `cellWidth` / `cellHeight` */
  Grid,
  /** 横向排列的动画帧，从左往右循环 */
  RowAnimate,
  /** 纵向排列的动画帧，从上往下循环 */
  ColumnAnimate,
  /** 逐行扫描的动画帧，读到行尾折到下一行 */
  ScanAnimate,
}

export const enum MapAutotileType {
  /** 2×3 的自动拼接素材 */
  Small2x3,
  /** 3×4 的自动拼接素材 */
  Big3x4,
}

export const enum MapFrameAxis {
  /** 静态图块，没有帧推进方向 */
  None,
  /** 帧沿横向推进 */
  X,
  /** 帧沿纵向推进 */
  Y,
  /** 帧按行列逐格推进，读到行尾折到下一行 */
  Scan,
}

export const enum MapBottomTab {
  /** 最近使用 */
  Recent,
  /** 最常使用 */
  Frequent,
  /** 9 格收藏 */
  Favorites,
}

export const enum MapDirection {
  /** 上 */
  Up,
  /** 右 */
  Right,
  /** 下 */
  Down,
  /** 左 */
  Left,
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

export interface IMapAutotileQuarters {
  /** 铺到目标格左上角的源图矩形 */
  readonly lt: IMapTileCrop;
  /** 铺到目标格右上角的源图矩形 */
  readonly rt: IMapTileCrop;
  /** 铺到目标格右下角的源图矩形 */
  readonly rb: IMapTileCrop;
  /** 铺到目标格左下角的源图矩形 */
  readonly lb: IMapTileCrop;
}

export interface IMapAutotileRule {
  /** 自动拼接素材的形状 */
  readonly type: MapAutotileType;
  /** 与哪些图块编号单方面连接；由宿主解析引擎文件后给出 */
  readonly connections: readonly number[];
}

export interface IMapTilesetMeta {
  /** Tileset 自身单格的宽（源图像素，为正整数） */
  readonly cellWidth: number;
  /** Tileset 自身单格的高（源图像素，为正整数） */
  readonly cellHeight: number;
  /** 整图横向的格子数 */
  readonly columns: number;
  /** 整图纵向的格子数 */
  readonly rows: number;
}

export interface IMapFrameInfo {
  /** 帧推进方向；静态图块为 `MapFrameAxis.None` */
  readonly axis: MapFrameAxis;
  /** 相邻两帧之间在源图上的像素步长 */
  readonly stride: number;
  /** 帧数，1..`MAP_FRAME_LIMIT` */
  readonly count: number;
  /** 第 0 帧在源图上的矩形 */
  readonly base: IMapTileCrop;
}

export interface IMapTileEntry {
  /** 写进地图格子的图块编号；0 表示空格，不会出现在条目里 */
  readonly number: number;
  /** 图块在整张图集里的列号（多格图案按它查表，不依赖编号连续） */
  readonly column: number;
  /** 图块在整张图集里的行号 */
  readonly row: number;
  /** 展示给用户看的图块名 */
  readonly name: string;
  /** 图块的四方向通行属性 */
  readonly pass: IMapTilePass;
  /** 固定显示第几帧；缺省 -1 表示跟随动画时钟，`>= 0` 时固定该帧 */
  readonly defaultFrame?: number;
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
  /**
   * 来源图片真实的图块行数（= 图片高 ÷ 素材格高），由宿主填入
   *
   * 它不是「目录里出现过的最大行号 + 1」——目录可能只收录图片的一部分行（演示里按分类分桶就会这样）。
   * 算整张图集高度时优先用它，缺省才退回按目录行号推算；否则「图片有两行、这一组只收了第 0 行」
   * 的素材会被压成一行，相邻行的图块就会一起画进同一个格子里（U-25）。
   */
  readonly rows?: number;
  /** 分组内的图块列表 */
  readonly tiles: readonly IMapTileEntry[];
  /** 这个素材组属于六类中的哪一类 */
  readonly category: MapTileCategory;
  /** 这个素材组的读取方式 */
  readonly read: MapTextureReadType;
  /** 素材单格的源像素宽（不是地图格子） */
  readonly cellWidth: number;
  /** 素材单格的源像素高（不是地图格子） */
  readonly cellHeight: number;
  /** 每个图块的帧数，1..`MAP_FRAME_LIMIT` */
  readonly frames: number;
  /** 自动拼接规则；普通素材没有这个字段 */
  readonly autotile?: IMapAutotileRule;
  /** Tileset 元数据；只有 `MapTileCategory.Tileset` 的组才有 */
  readonly tileset?: IMapTilesetMeta;
}

/**
 * 按图片相对路径读取字节；由面板闭包提供，组件与面板共用这一份声明
 * @param path 图片相对项目根的路径
 * @returns 图片字节；读取失败时为 undefined
 */
export type MapImageBytesLoader = (path: string) => Promise<Uint8Array | undefined>;

export interface IMapTileGroupUrls {
  /** 分组标识（`IMapTileGroup.id`）→ 该组图片的 `blob:` 地址；键是 `group.id`，不是图片路径 */
  readonly urls: Readonly<Record<string, string | undefined>>;

  /** 分组标识（`IMapTileGroup.id`）→ 该组图片的读取状态；键是 `group.id`，不是图片路径 */
  readonly status: Readonly<Record<string, MapImageStatus>>;
}

export interface IMapImageSources {
  /** 图片相对项目根的路径（`cell.imagePath` / `group.imagePath`）→ `blob:` 地址；键是图片路径，不是 `group.id` */
  readonly urls: Readonly<Record<string, string | undefined>>;

  /** 图片相对项目根的路径 → 该图片的读取状态；键是图片路径，不是 `group.id` */
  readonly status: Readonly<Record<string, MapImageStatus>>;
}

export interface IMapImageSourceStore {
  /** 每次真正更新地址表后递增的版本号；普通成员，不是 getter */
  readonly version: number;

  /**
   * 按当前文档重建两张地址表；同一路径内容未变时复用旧地址
   * @param imagePaths 本帧需要的图片路径集合
   * @param groups 当前文档的图块分组集合
   * @param loadBytes 按图片相对路径读字节的回调
   * @returns 重建完成后的异步结果
   */
  refresh(
    imagePaths: readonly string[],
    groups: readonly IMapTileGroup[],
    loadBytes: MapImageBytesLoader,
  ): Promise<void>;

  /**
   * 取图片路径键的快照，给地图画布用
   * @returns 以图片相对路径为键的地址与状态表
   */
  getSources(): IMapImageSources;

  /**
   * 取 `group.id` 键的快照，给素材区 / 底栏 / 收藏栏用
   * @returns 以分组标识为键的地址与状态表
   */
  getGroupUrls(): IMapTileGroupUrls;

  /**
   * 回收全部 `blob:` 地址；面板释放时调用
   */
  dispose(): void;
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
  /** 这张地图自己的格子宽（像素，为正整数） */
  readonly cellWidth: number;
  /** 这张地图自己的格子高（像素，为正整数） */
  readonly cellHeight: number;
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

  /** 地图区横向格数的初始默认值；可见格数由面板上的宽 / 高控件决定，宿主注入不再驱动地图区尺寸 */
  readonly viewportColumns?: number;

  /** 地图区纵向格数的初始默认值；可见格数由面板上的宽 / 高控件决定，宿主注入不再驱动地图区尺寸 */
  readonly viewportRows?: number;

  /** 宿主覆盖动画帧速（毫秒 / 帧）；缺省 `MAP_FRAME_SPEED_DEFAULT` */
  readonly frameSpeed?: number;

  /**
   * 把完整路径解析成地图标识；由宿主注入，`editor-impl` 不内置任何目录约定（D-31 / D-32）
   *
   * 必须同步返回：调用方（面板类型的 `IEditorPanelType.canOpen`）不能等异步清单。
   * 调用约定：先判 `capabilities.resolveMapPath === undefined`，命中「未注入」分支就按不认领处理
   * （`canOpen` 返回 false、`createOpenParam` 返回 `{ target: null }`）；在该早退之后直接调用
   * `capabilities.resolveMapPath(path)`，此时类型已窄化掉 undefined。不要先把函数赋给局部变量或常量，
   * 也不要写成 `capabilities.resolveMapPath?.(path)` 再用断言抹平 undefined。
   * @param path 完整路径：相对项目根、以 `/` 分隔、无前导斜线
   * @returns 地图标识；该路径不是本宿主的地图文件时为 null
   */
  resolveMapPath?(path: string): string | null;
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

export interface IMapCellMetrics {
  /** 一格在画布上的宽（像素，已含缩放） */
  readonly cellWidth: number;
  /** 一格在画布上的高（像素，已含缩放） */
  readonly cellHeight: number;
  /** 第一格左上角的横向原点（像素） */
  readonly left: number;
  /** 第一格左上角的纵向原点（像素） */
  readonly top: number;
}

export interface IMapCanvasBounds {
  /** 画布容器左上角的横向位置（像素） */
  readonly left: number;
  /** 画布容器左上角的纵向位置（像素） */
  readonly top: number;
}

export interface IMapLayout {
  /** 可见框的横向格数 */
  readonly viewportColumns: number;
  /** 可见框的纵向格数 */
  readonly viewportRows: number;
  /** 整体渲染缩放：画布与命中测试共用这个倍率 */
  readonly renderScale: number;
  /** 一格的像素宽（已含缩放） */
  readonly cellWidth: number;
  /** 一格的像素高（已含缩放） */
  readonly cellHeight: number;
  /** 画布像素宽 */
  readonly canvasWidth: number;
  /** 画布像素高 */
  readonly canvasHeight: number;
  /** 右侧素材栏的像素宽 */
  readonly paletteWidth: number;
  /** 左列地图区的像素宽 = 画布宽 + `MAP_RULER_SIZE`；左右分栏宽度之和即可用宽度（D-43） */
  readonly mapPaneWidth: number;
}

export interface IMapLayoutOptions {
  /** 缩放倍率，夹取到 `MAP_ZOOM_MIN`..`MAP_ZOOM_MAX`；同时是画布的整体渲染倍率与画布尺寸的乘数 */
  readonly zoom: number;
  /** 宿主覆盖的视口横向格数；缺省 `MAP_VIEWPORT_DEFAULT_COLUMNS` */
  readonly viewportColumns?: number;
  /** 宿主覆盖的视口纵向格数；缺省 `MAP_VIEWPORT_DEFAULT_ROWS` */
  readonly viewportRows?: number;
  /** 右栏在缩放 1 时的基准宽度；缺省 `MAP_PALETTE_BASE_WIDTH` */
  readonly paletteBaseWidth?: number;
  /** 视图量到的可用宽度（像素）；缺省或 ≤ 0 时素材区回退到 `MAP_PALETTE_BASE_WIDTH` */
  readonly availableWidth?: number;
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
  /** 自动拼接格要画四个象限矩形；普通格没有这个字段 */
  readonly autotileQuarters?: IMapAutotileQuarters;
  /** 动画帧的推进方向；静态格没有这个字段 */
  readonly frameAxis?: MapFrameAxis;
  /** 相邻两帧在源图上的像素步长 */
  readonly frameStride?: number;
  /** 动画总帧数，1..`MAP_FRAME_LIMIT` */
  readonly frameCount?: number;
  /** 帧序列每行的格数，供逐行扫描的帧轴使用 */
  readonly frameColumns?: number;
  /** 固定显示第几帧；缺省 -1 表示跟随动画时钟 */
  readonly defaultFrame?: number;
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

export interface IMapThumbnail {
  /** 缩略图在画布上的像素宽 */
  readonly width: number;
  /** 缩略图在画布上的像素高 */
  readonly height: number;
  /** 整张地图缩到缩略图里的缩放倍率 */
  readonly scale: number;
  /** 缩略图相对画布左上角的横向偏移（像素） */
  readonly offsetX: number;
  /** 缩略图相对画布左上角的纵向偏移（像素） */
  readonly offsetY: number;
  /** 缩略纹理的像素宽（不超过 `MAP_THUMBNAIL_MAX_SIZE`） */
  readonly textureWidth: number;
  /** 缩略纹理的像素高（不超过 `MAP_THUMBNAIL_MAX_SIZE`） */
  readonly textureHeight: number;
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
  /** 整体渲染缩放：画布把整个场景等比放大这个倍率；屏幕格像素 = 本帧的 `cellWidth` / `cellHeight` × 它 */
  readonly renderScale: number;
  /**
   * 本帧的显示格基准宽（= `MAP_DISPLAY_CELL_SIZE`，不含缩放）；
   * 地图文档自己声明的格尺寸只用于素材切分与数据本身
   */
  readonly cellWidth: number;
  /**
   * 本帧的显示格基准高（= `MAP_DISPLAY_CELL_SIZE`，不含缩放）；
   * 地图文档自己声明的格尺寸只用于素材切分与数据本身
   */
  readonly cellHeight: number;
  /** 本帧视口左上角，叠加层与整条路径据此换算到画布坐标 */
  readonly viewport: IMapViewport;
  /** 线模式下整条路径的所有格子；没有路径时为 undefined */
  readonly previewCells?: readonly IMapCellPosition[];
  /** 大地图模式的缩略描述；非大地图模式为 undefined */
  readonly thumbnail?: IMapThumbnail;
  /** 当前框选矩形；没有选区时为 undefined */
  readonly selection?: IMapRect;
  /** 当前绘制预览；没有预览时为 undefined */
  readonly preview?: IMapPreview;
  /** 当前悬停的格子；指针不在画布上时为 undefined */
  readonly hover?: IMapCellPosition;
}

export interface IMapPendingConflict {
  /** 外部改动的地图文件路径，用于与当前地图匹配 */
  readonly path: string;

  /** 读到的外部原文 */
  readonly text: string;
}

export interface IMapCloseDialogState {
  /** 关闭弹窗是否打开 */
  readonly open: boolean;

  /** 是否正在保存 */
  readonly saving?: boolean;

  /** 保存失败的原因 */
  readonly error?: string;
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
  /** 面板算好的图片路径键地址表，给地图画布用；尚未读过时为 undefined */
  readonly tileImageSources?: IMapImageSources;
  /** 面板算好的 `group.id` 键地址表，给素材区 / 底栏 / 收藏栏用；尚未读过时为 undefined */
  readonly tileGroupUrls?: IMapTileGroupUrls;
  /** 地址表的发布代次；每次重读图块图片都递增，驱动画布重建纹理 */
  readonly tileImageSourcesVersion?: number;
  /** 地图属性抽屉是否打开 */
  readonly propertiesOpen: boolean;
  /** 属性域的加载状态；`TablePanelStatus.NoTarget` 表示尚未读取 */
  readonly propertiesStatus: TablePanelStatus;
  /** 属性表单的行树；尚未读取、读取失败或没有字段时为空数组 */
  readonly propertyRows: readonly ITableRowNode[];
  /** 属性域读取失败的原因；没有失败时为 undefined */
  readonly propertiesError?: string;
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
  /** 当前缩放（`MAP_ZOOM_MIN`..`MAP_ZOOM_MAX`） */
  readonly zoom: number;
  /** 底部当前页签 */
  readonly bottomTab: MapBottomTab;
  /** 右侧当前分类；它同时是当前素材视图的唯一真源 */
  readonly activeCategory: MapTileCategory;
  /** 素材区是否显示帧数角标 */
  readonly showFrameCount: boolean;
  /** 9 格收藏的有序编号列表，空位为 0 */
  readonly favorites: readonly number[];
  /** 「最常使用」的展示顺序（已排好序的编号，不是次数表） */
  readonly frequentTiles: readonly number[];
  /** 地图区横向格数（宽）；面板控件可改，初值来自宿主注入 */
  readonly viewportColumns: number;
  /** 地图区纵向格数（高）；面板控件可改，初值来自宿主注入 */
  readonly viewportRows: number;
}

export interface IMapTilePreferences {
  /** 最近使用的图块编号，按最近程度排序，不带次数 */
  readonly recent: readonly number[];
  /** 9 格收藏的有序编号列表，空位为 0 */
  readonly favorites: readonly number[];
  /** 编号 → 使用次数；「最常使用」的顺序由它现算 */
  readonly frequent: ReadonlyMap<number, number>;
}

export interface IMapZoomSliderProps {
  /** 当前缩放值 */
  readonly value: number;
  /** 是否禁用；没有缩放回调时为 true */
  readonly disabled: boolean;
  /**
   * 用户松手后把新值交给调用方
   * @param value 夹取到 `MAP_ZOOM_MIN`..`MAP_ZOOM_MAX` 的新缩放值
   */
  onChangeComplete(value: number): void;
}

export interface IMapMaterialPanelProps {
  /** 当前文档的图块目录 */
  readonly groups: readonly IMapTileGroup[];
  /** 素材组标识 → 图片的 `blob:` 地址；还没读到时为 undefined */
  readonly groupUrls: Readonly<Record<string, string | undefined>>;
  /** 素材组标识 → 该组图片的读取状态 */
  readonly groupStatus: Readonly<Record<string, MapImageStatus | undefined>>;
  /** 最近使用图块图片的读取状态 */
  readonly imageStatus: MapImageStatus;
  /** 当前分类 */
  readonly activeCategory: MapTileCategory;
  /** 当前调色板选中 */
  readonly selection: IMapPaletteSelection;
  /** 是否显示帧数角标 */
  readonly showFrameCount: boolean;
  /**
   * 提交一次调色板选择
   * @param selection 新的选中
   */
  onSelectPattern(selection: IMapPaletteSelection): void;
  /** 请求重新读取图块图片 */
  onRetryImages(): void;
  /**
   * 选择素材分类
   * @param category 目标分类
   */
  onSelectCategory(category: MapTileCategory): void;
  /**
   * 开关帧数角标
   * @param value 为 true 时显示
   */
  onToggleFrameCount(value: boolean): void;
  /**
   * 把「右键某个普通图块」上报给面板收藏；Tileset 不触发
   * @param number 要收藏的图块编号
   */
  onFavoriteTile?(number: number): void;
}

export interface IMapCategoryNavProps {
  /** 当前分类；它同时是当前素材视图的唯一真源 */
  readonly activeCategory: MapTileCategory;
  /**
   * 选择素材分类
   * @param category 目标分类
   */
  onSelectCategory(category: MapTileCategory): void;
}

export interface IMapTilesetPickerProps {
  /** 当前 Tileset 素材组 */
  readonly group: IMapTileGroup;
  /** 该组图片的 `blob:` 地址；还没读到时为 undefined */
  readonly groupUrl?: string;
  /** 该组图片的读取状态 */
  readonly status: MapImageStatus;
  /** 当前调色板选中 */
  readonly selection: IMapPaletteSelection;
  /**
   * 提交一次调色板选择
   * @param selection 新的选中
   */
  onSelectPattern(selection: IMapPaletteSelection): void;
  /** 请求重新读取图块图片 */
  onRetryImages(): void;
}

export interface IMapBottomTabsProps {
  /** 当前页签 */
  readonly tab: MapBottomTab;
  /** 最近使用的图块编号，按最近程度排序 */
  readonly recentTiles: readonly number[];
  /** 「最常使用」的展示顺序 */
  readonly frequentTiles: readonly number[];
  /** 9 格收藏的有序编号列表，空位为 0 */
  readonly favorites: readonly number[];
  /** 当前文档的图块目录；缺了它只能显示编号、画不出图块 */
  readonly groups?: readonly IMapTileGroup[];
  /** 素材组标识 → 图片的 `blob:` 地址；还没读到时为 undefined */
  readonly groupUrls: Readonly<Record<string, string | undefined>>;
  /** 图块图片的读取状态 */
  readonly imageStatus: MapImageStatus;
  /** 当前调色板选中 */
  readonly selection: IMapPaletteSelection;
  /**
   * 切换底部页签
   * @param tab 目标页签
   */
  onSelectTab(tab: MapBottomTab): void;
  /**
   * 提交一次调色板选择
   * @param selection 新的选中
   */
  onSelectPattern(selection: IMapPaletteSelection): void;
}

export interface IMapFavoriteBarProps {
  /** 9 格收藏的有序编号列表，空位为 0 */
  readonly favorites: readonly number[];
  /** 当前调色板选中 */
  readonly selection: IMapPaletteSelection;
  /** 当前文档的图块目录；缺了它收藏格画不出图块 */
  readonly groups?: readonly IMapTileGroup[];
  /** 素材组标识 → 图片的 `blob:` 地址；还没读到时为 undefined */
  readonly groupUrls: Readonly<Record<string, string | undefined>>;
  /**
   * 选中擦除或某个收藏位
   * @param index 0 表示擦除，1..9 对应第 1..9 个收藏格
   */
  onSelectSlot(index: number): void;
  /**
   * 把收藏从一格挪到另一格
   * @param from 起始槽位索引（0..8）
   * @param to 目标槽位索引（0..8）
   */
  onReorder(from: number, to: number): void;
  /** 排序是否禁用；为 true 时拖拽不可用 */
  readonly reorderDisabled: boolean;
}
