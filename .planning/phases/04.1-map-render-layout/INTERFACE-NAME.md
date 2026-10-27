# Phase 4.1 — 接口与命名确认 / 地图渲染与布局重做

**Status:** **待用户确认** —— 本文所有名称、字段与口径均为**提案**。用户确认前，只允许落「纯类型声明」「常量声明」与「本文件」，不得写实现（项目规则：重要命名先确认）。
**Scope:** 本阶段新建 / 改动的全部对外名称（文件名、接口名、类型名、方法名、字段名、常量名、CSS 类名、`data-test-id`）与所有开放问题的执行口径。前序阶段已锁定的名称（`IMapDocument` / `IMapLayer` / `MapPanel` 等）不重复登记，只登记它们的**新增**成员。
**约定:** 类上的方法一律写成 `类名.方法名`（如 `MapPanel.setZoom`）；自由函数写裸名。每个名字先说明「它是干什么的」，再给名字。

> 读法：每个 Plan 一节。先一句话说明「这个计划要做什么」，再列出它引入 / 改动的名字及**用途**。
> 若某个名字不合适，直接在对话里指出；改名后再进入执行。

---

## 全局口径（先读这一节）

### 1. 用户已锁定的三条设计答案

| 问题 | 锁定口径 |
|------|----------|
| Tileset 按什么尺寸分格 | 按 **Tileset 自身的** `cellWidth / cellHeight`（来自目录的 `IMapTilesetMeta`）；地图的格子尺寸只决定素材切分的源矩形与文档数据，**不决定显示格与地图区尺寸**（D-39：显示格以 32 为基准）。 |
| Tileset 每格编号从哪来 | **宿主把每个格子枚举进目录**（`{ number, column, row }`）；编辑器不引入引擎的编号公式。编号仍由宿主枚举进目录（编辑器不引入引擎公式）；宿主按引擎的 `tilesetReserve` + `tilesetUnit` 生成连续编号段（D-51）。 |
| `.editor` 目录谁创建 | **保持现状**：由宿主 / 资源层负责，写失败静默降级。**不给 `IEditorPanelContext` 增加 `makeDirectory`。** |

### 2. 过渡期类型策略（P-01，规划器提案：全部声明在 Plan 01，收紧在 Plan 15）

> **P-01 不是 CONTEXT.md 的锁定决策。** `04.1-CONTEXT.md` 只锁定 D-01…D-29；这条过渡策略是规划阶段提出的执行口径，需要在下面的「需要用户确认的清单」里一并确认。

本阶段要改的是**已有的数据契约**，而 Phase 4 的代码与测试已经在用它。为了满足「先接口、后实现」同时保证每个计划结束时整包仍然可编译，策略是：

- **Plan 01 一次性声明本阶段全部新增成员**：新枚举 / 新接口 / 新字段 / 组件 props / 视图状态字段一律先声明为**可选**，`IMapTileEntry.crop` 暂时保留。所谓「全部」包括：`types.ts` 里的数据接口与**七个跨计划接口**（`IMapLayoutOptions`、`IMapZoomSliderProps`、`IMapMaterialPanelProps`（含 `tilesetOpen`）、`IMapCategoryNavProps`、`IMapTilesetPickerProps`、`IMapBottomTabsProps`（含 `groups`）、`IMapFavoriteBarProps`（含 `groups`））；`model/renderModel.ts` 里的 `IMapRenderView.zoom` 与 `ITileImage.srcWidth/srcHeight`；**四个**既有组件 props 的新成员（含工具栏的 `IMapToolbarProps.zoom` / `.onSetZoom`）；宿主侧的 `ITileCatalogSource` 与 `IMapDemoOverrides`（`apps/editor-dev/src/backend/types.ts`）。
- **Plan 02–13 只赋值与消费**，任何实现计划都**不得**新增接口成员；消费者按「字段缺省时的默认值」工作（缺省格尺寸为 `MAP_CELL_SIZE`，缺省读取方式为 `Grid`，缺省帧数为 1，缺省帧速为 300，缺省视口 13×13）。
- **Plan 15 是独立的接口终态计划**：删除 `IMapTileEntry.crop`，把 `IMapDocument.cellWidth/cellHeight`、`IMapTileGroup.category/read/cellWidth/cellHeight/frames`、`IMapRenderModel.cellWidth/cellHeight/viewport`、`IMapPanelViewState` 的 9 个新字段改为必填，并只做「按编译错误机械对齐生产者」。

**因此：Plan 02 / 04 / 06 / 07 / 08 / 11 / 12 / 13 都不再拥有任何接口声明职责。** 若某个实现计划发现还缺字段，必须回到 Plan 01 补声明（并在本文件登记），而不是就地新增。

这条策略是**可逆的**（只影响类型宽松度），但它决定了「接口声明只出现在 Plan 01、收紧只出现在 Plan 15」。

### 3. 类型放宽不代表语义放宽

宿主契约（D-01 / D-02 / D-04）仍然要求每份目录 / 文档**都**给出这些字段；Plan 06 的宿主适配器与 Plan 15 的终态收紧会把这条落死。默认值只为兼容 Phase 4 的旧宿主与旧测试。

### 4. 数据契约与引擎无关

`editor-impl` 可以使用魔塔领域词（`autotile` 等，D-27 / D-28）；`editor-core` 不新增任何类型。`map` 不得 import `asset` / `table` / `code` 能力。

---

## Plan 01 — 接口与命名（纯声明）

**要做什么：** 把本阶段要用到的数据形状、常量与命名一次性说清楚；不写任何逻辑。

| 名称 | 种类 | 用途 |
|------|------|------|
| `src/map/types.ts` | 文件（已存在，追加） | 地图能力的类型集中地；本计划只追加声明 |
| `src/map/constants.ts` | 文件（已存在，追加） | 面板级裸常量 |
| `MapTileCategory` | `const enum` | 图块分类：`Terrain` / `Enemy` / `Npc` / `Item` / `Autotile` / `Tileset`（D-05；引擎的 `Animate` 并入 `Terrain`） |
| `MapTextureReadType` | `const enum` | 素材读取方式：`Full` / `Grid` / `RowAnimate` / `ColumnAnimate` / `ScanAnimate`（D-02） |
| `MapAutotileType` | `const enum` | 自动拼接素材形状：`Small2x3`（2×3）/ `Big3x4`（3×4） |
| `MapFrameAxis` | `const enum` | 动画帧推进方向：`None` / `X` / `Y` / `Scan`；告诉视图帧号该往哪个方向取矩形 |
| `MapDirection` | `const enum` | 通行度的四个方向：`Up` / `Right` / `Down` / `Left`；四色箭头按它取色，避免字符串字面量 |
| `MapBottomTab` | `const enum` | 底部三页：`Recent` / `Frequent` / `Favorites` |
| `IMapAutotileRule` | interface | 一个自动拼接素材的规则：形状 + 它单方面连接的图块编号（D-06，宿主注入） |
| `IMapTilesetMeta` | interface | Tileset 自身的单格尺寸与行列数（整图分格用） |
| `IMapFrameInfo` | interface | 一个图块的帧轴 / 帧步长 / 帧数 / 第 0 帧矩形；视图据此现算当前帧裁切 |
| `IMapCellMetrics` | interface | 一格的像素度量：格宽 / 格高 / 左上原点（命中测试与叠加层共用，替代原来单一的 `size`） |
| `IMapCanvasBounds` | interface | 画布容器的左上角 `left` / `top`；指针换算用，替代内联对象类型 |
| `IMapThumbnail` | interface | 大地图缩略纹理的描述：纹理尺寸 / 缩放 / 偏移；重建时机由视图判定，不放进这个纯描述 |
| `IMapTilePreferences` | interface | `.editor` 偏好：`recent`（有序编号列表 `readonly number[]`）/ `favorites`（9 格收藏，同样是有序编号列表 `readonly number[]`）/ `frequent`（唯一的次数表 `ReadonlyMap<number, number>`）；与 `IMapPanelViewState.recentTiles` 同型，可直接赋值 |
| `IMapAutotileQuarters` | interface | 自动拼接一格要画的四个象限矩形（每块取源图单格的一半，分别铺到目标格的左上 / 右上 / 右下 / 左下）：`lt` / `rt` / `rb` / `lb` |
| `IMapLayout` | interface | 布局结果：视口格数 / 缩放后的格像素 / 画布像素尺寸 / 右栏宽度 |
| `IMapLayoutOptions` | interface（Plan 01 声明，Plan 04 只 import） | 布局输入：缩放、宿主覆盖的视口格数、右栏基准宽度；放在 `types.ts` 而不是 `model/layout.ts`，符合「对外接口归该层 types.ts」 |
| `IMapZoomSliderProps` | interface（Plan 01 声明，Plan 11 只 import） | 缩放滑块 props：当前值、是否禁用、松手后的发布回调 |
| `IMapMaterialPanelProps` | interface（Plan 01 声明，Plan 12 创建组件、Plan 13 接右键收藏） | 右侧素材区 props：目录、图片地址与状态、当前分类、`tilesetOpen`（是否切到 Tileset 单独视图）、选中、`showFrameCount` / `onToggleFrameCount`（「显示帧数」勾选框）、`onSelectPattern`、各回调；**含可选 `onFavoriteTile`** |
| `IMapMaterialPanelProps.tilesetOpen` | 字段（可选；Plan 01 声明，Plan 12 只读） | 素材区是否显示 Tileset 单独视图（由 `view.tilesetOpen` 传入）；缺省 false |
| `IMapMaterialPanelProps.onFavoriteTile` | 方法成员（可选；Plan 01 声明，Plan 13 只接线） | 素材区把「右键某个普通图块」上报给面板收藏；Tileset 不触发，因为 D-19 只允许收藏普通图块 |
| `IMapCategoryNavProps` | interface（Plan 01 声明，Plan 12 只 import） | 竖排分类导航 props：当前分类、Tileset 是否展开、选择分类 / 切换 Tileset 的回调 |
| `IMapTilesetPickerProps` | interface（Plan 01 声明，Plan 12 只 import） | Tileset 选择器 props：Tileset 组、图片地址与状态、选中、选择图案 / 重试图片 |
| `IMapBottomTabsProps` | interface（Plan 01 声明，Plan 13 只 import） | 底部三页 props：当前页签、三份编号、**`groups`（编号 → 素材组的查表来源）**、图片地址与状态、选中、切页 / 选图案 |
| `IMapBottomTabsProps.groups` | 字段（可选；Plan 01 声明，Plan 13 只读） | 当前文档的图块目录；底部三页据此把编号还原成图片路径与 `(column, row, cellWidth, cellHeight)`，否则只能显示数字 |
| `IMapFavoriteBarProps` | interface（Plan 01 声明，Plan 13 只 import） | 收藏栏 props：9 格收藏、当前选中、**`groups`（编号 → 素材组的查表来源）**、图片地址、选中 / 排序回调与排序禁用位 |
| `IMapFavoriteBarProps.groups` | 字段（可选；Plan 01 声明，Plan 13 只读） | 当前文档的图块目录；收藏格据此把编号还原成图片矩形 |
| `IMapRenderView.zoom` | 字段（可选；Plan 01 在 `model/renderModel.ts` 声明，Plan 02 起消费） | 缩放倍率；渲染模型据此把文档格尺寸换成像素（`buildMapRenderModel` 是唯一乘它的地方），视图同时把同一个值交给 `resolveMapLayout`，两边不得各取一套 |
| `ITileImage.srcWidth` / `.srcHeight` | 字段（可选；Plan 01 在 `model/renderModel.ts` 声明，Plan 02 只赋值） | 图块素材的单格源像素尺寸，contain 与帧矩形都要用 |
| `ITileCatalogSource` | interface（Plan 01 在 `apps/editor-dev/src/backend/types.ts` 声明，Plan 06 只 import） | 宿主目录解析输入：纹理清单文本、图块表文本、图片尺寸表、自动拼接连接表、Tileset 编号起点 |
| `IMapDemoOverrides` | interface（Plan 01 在 `apps/editor-dev/src/backend/types.ts` 声明，Plan 06 只 import） | 开发宿主注册演示地图时覆盖的能力字段：`viewportColumns?` / `viewportRows?` / `frameSpeed?`；用命名接口替代内联对象类型 |
| `IMapFileRecord.cellWidth` / `.cellHeight` | 字段（可选；Plan 01 在 `apps/editor-dev/src/backend/mapFiles.ts` 的接口块声明，Plan 06 只赋值） | 每张地图文件自己的格子尺寸（缺省 32）；`toMapDocument` 把它带进 `IMapDocument`，`applyMapDataSection` 不覆盖 |
| `IMapDocument.cellWidth` / `.cellHeight` | 字段（可选，Plan 15 收紧） | 每张地图自己的格子尺寸（D-04）；缺省按 `MAP_CELL_SIZE` |
| `IMapTileGroup.category` | 字段（可选） | 这个素材组属于六类中的哪一类 |
| `IMapTileGroup.read` | 字段（可选） | 这个素材组的读取方式 |
| `IMapTileGroup.cellWidth` / `.cellHeight` | 字段（可选） | 素材单格的源像素尺寸（不是地图格子） |
| `IMapTileGroup.frames` | 字段（可选） | 每个图块的帧数（1..255） |
| `IMapTileGroup.autotile` | 字段（可选） | 自动拼接规则；普通素材没有 |
| `IMapTileGroup.tileset` | 字段（可选） | Tileset 元数据；只有 Tileset 有 |
| `IMapTileEntry.defaultFrame` | 字段（可选） | 这个图块固定显示第几帧；`>= 0` 时优先于动画时钟，缺省 -1（跟随全局帧号） |
| `IMapEditorCapabilities.viewportColumns` / `.viewportRows` | 字段（可选） | 宿主覆盖地图视口格数；缺省 13×13（D-16） |
| `IMapEditorCapabilities.frameSpeed` | 字段（可选） | 宿主覆盖动画帧速（毫秒）；缺省 300（D-08） |
| `IMapRenderCell.autotileQuarters` | 字段（可选） | 自动拼接格的四块矩形；普通格没有 |
| `IMapRenderCell.frameAxis` / `.frameStride` / `.frameCount` / `.frameColumns` / `.defaultFrame` | 字段（可选） | 动画格需要的帧信息；静态格没有 |
| `IMapRenderModel.cellWidth` / `.cellHeight` | 字段（可选，Plan 15 收紧） | 本帧的格像素度量（唯一度量来源）；**值 = 文档格尺寸 × 缩放**，`buildMapRenderModel` 只在这里乘一次 `view.zoom` |
| `IMapRenderModel.viewport` | 字段（可选，Plan 15 收紧） | 本帧视口左上角；叠加层 / 框选 / 预览 / 整条路径用「文档坐标 − viewport」换算到画布坐标 |
| `IMapRenderModel.previewCells` | 字段（可选） | 线模式下整条路径的所有格子（D-14） |
| `IMapRenderModel.thumbnail` | 字段（可选） | 大地图缩略描述（D-11） |
| `IMapPanelViewState.zoom` | 字段（可选，Plan 15 收紧） | 当前缩放（0.5..2）；Plan 08 初始化、Plan 11 消费 |
| `IMapPanelViewState.bottomTab` | 字段（可选，Plan 15 收紧） | 底部当前页签；Plan 08 初始化、Plan 13 消费 |
| `IMapPanelViewState.activeCategory` | 字段（可选，Plan 15 收紧） | 右侧当前分类；Plan 08 初始化、Plan 12 消费 |
| `IMapPanelViewState.tilesetOpen` | 字段（可选，Plan 15 收紧） | 是否切到 Tileset 单独视图 |
| `IMapPanelViewState.showFrameCount` | 字段（可选，Plan 15 收紧） | 素材区是否显示帧数角标 |
| `IMapPanelViewState.favorites` | 字段（可选，Plan 15 收紧） | 9 格收藏的有序编号列表（`readonly number[]`，`0` 为空位） |
| `IMapPanelViewState.frequentTiles` | 字段（可选，Plan 15 收紧） | 「最常使用」的展示顺序（已排好序的编号，`readonly number[]`，不是次数表） |
| `IMapPanelViewState.viewportColumns` / `.viewportRows` | 字段（可选，Plan 15 收紧） | 宿主注入的视口格数落进视图状态；缺省 13×13（D-16） |
| `IMapSurfaceProps.document` / `.currentLayerId` / `.aboveLayerOpacity` | 字段（可选） | 大地图缩略纹理的**内容来源与重建输入**：模型在大地图模式只给缩略描述，逐格内容由画布从这三个值自己铺 |
| `IMapSurfaceProps.cellFrameSpeed` | 字段（可选） | 动画帧速（毫秒 / 帧）；缺省 300（D-08） |
| `IMapCanvasProps.aboveLayerOpacity` | 字段（可选） | 转发给 `MapSurface`，供缩略重建判据使用 |
| `IMapCanvasProps.cellFrameSpeed` | 字段（可选） | 转发给 `MapSurface` 的动画帧速 |
| `IMapCanvasProps.viewportColumns` / `.viewportRows` | 字段（可选） | 画布可见框格数；缺省取常量 |
| `IMapCanvasProps.onSetViewport` | 方法成员（可选） | 画布把滚动位置回报给面板（`left, top`） |
| `IMapCanvasProps.onSelectFavoriteSlot` | 方法成员（可选） | 画布容器里的数字键 `1..9` / `0` 通知面板选中擦除或某个收藏位（Plan 13 只实现调用） |
| `IMapPanelViewProps.onSetViewport` | 方法成员（可选） | 视图层把画布回报转发给面板（`left, top`） |
| `IMapPanelViewProps.onSetZoom` | 方法成员（可选） | 缩放滑块松手后把值转发给面板 |
| `IMapPanelViewProps.cellFrameSpeed` | 字段（可选） | 宿主注入的帧速，视图层原样下传 |
| `IMapPanelViewProps.onSetBottomTab` | 方法成员（可选） | 底部三页切换时把目标页签交给面板 |
| `IMapPanelViewProps.onSelectCategory` | 方法成员（可选） | 右侧六类导航点了某一类时交给面板 |
| `IMapPanelViewProps.onToggleTileset` | 方法成员（可选） | Tileset 单独开关打开 / 关闭时交给面板 |
| `IMapPanelViewProps.onToggleFrameCount` | 方法成员（可选） | 「显示帧数」勾选框的新值交给面板 |
| `IMapPanelViewProps.onFavoriteTile` | 方法成员（可选） | 右键普通图块时把编号交给面板收藏 |
| `IMapPanelViewProps.onSelectFavoriteSlot` | 方法成员（可选） | 数字键 `1..9` / `0` 与收藏格点击时把槽位索引交给面板 |
| `IMapPanelViewProps.onReorderFavorites` | 方法成员（可选） | 收藏拖拽 / 上下按钮把「从哪到哪」交给面板排序 |
| `IMapToolbarProps.zoom` | 字段（可选） | 工具栏缩放滑块的当前值；缺省 `MAP_ZOOM_DEFAULT` |
| `IMapToolbarProps.onSetZoom` | 方法成员（可选） | 工具栏缩放滑块松手后的发布回调 |
| `MAP_VIEWPORT_DEFAULT_COLUMNS` / `MAP_VIEWPORT_DEFAULT_ROWS` | 常量 `13` | 默认地图视口格数（允许宿主配置成长方形） |
| `MAP_ZOOM_MIN` / `MAP_ZOOM_MAX` / `MAP_ZOOM_DEFAULT` / `MAP_ZOOM_STEP` | 常量 | `0.5` / `2` / `1` / `0.05` |
| `MAP_PALETTE_BASE_WIDTH` / `MAP_PALETTE_MIN_WIDTH` | 常量 | 右栏基准宽度（量不到可用宽度时的回退值）/ 最小可用宽度；素材区**没有最大宽度** |
| `MAP_PALETTE_MAX_WIDTH` | 常量（**过渡**） | 旧布局代码的过渡常量；Plan 19 删除，素材区不设上限 |
| `MAP_FRAME_SPEED_DEFAULT` | 常量 `300` | 动画默认帧速（毫秒 / 帧） |
| `MAP_FRAME_LIMIT` | 常量 `255` | 单个图块的最大帧数（D-08） |
| `MAP_THUMBNAIL_MAX_SIZE` | 常量 `512` | 缩略纹理的边长上限（降采样用） |
| `MAP_TILE_PREFS_PATH` | 常量 `'.editor/map-tiles.json'` | 统一偏好文件（D-20） |
| `MAP_TILE_PREFS_RECENT_KEY` / `MAP_TILE_PREFS_FREQUENT_KEY` / `MAP_TILE_PREFS_FAVORITES_KEY` | 常量 | 文件字段名 `recent` / `frequent` / `favorites` |
| `MAP_FAVORITE_SLOT_COUNT` | 常量 `9` | 收藏格数（`1` 键固定为擦除，不占数组位） |
| `MAP_FREQUENT_LIMIT` | 常量 `200` | 「最常使用」写盘时保留的条目上限 |
| `MAP_PASS_COLOR_UP` / `MAP_PASS_COLOR_RIGHT` / `MAP_PASS_COLOR_DOWN` / `MAP_PASS_COLOR_LEFT` | 常量（数值） | 四色通行度箭头；四个值必须互不相同（D-12） |

---

## Plan 02 — Tracer：每图格子尺寸与 contain 端到端

**要做什么：** 先打通一条最短的完整路径：地图文档说自己格子多大 → 渲染模型算出每格该画多大（大素材按比例缩进格内、小素材保持原尺寸、都居中）→ 画布照着画。这是本阶段第一条端到端可验证的链路。

| 名称 | 种类 | 用途 |
|------|------|------|
| `src/map/model/cellMetrics.ts` | 文件 | 纯几何：contain、居中、指针坐标 → 格子坐标 |
| `resolveTileDest` | 自由函数 | 给定格子位置与格子尺寸、素材自身尺寸，算出素材在格内的目标矩形（`scale = min(1, cellW/srcW, cellH/srcH)`，再居中） |
| `resolvePointerCell` | 自由函数 | 把指针的客户端坐标换算成格子坐标（按格宽 / 格高与缩放除，再叠加视口偏移） |
| `resolveCellMetrics` | 自由函数 | 由格像素尺寸与左上原点组装 `IMapCellMetrics`，作为命中与叠加层的唯一度量来源 |
| `IMapRenderModel.cellWidth` / `.cellHeight` | 字段（Plan 01 已声明为可选；本计划只赋值） | 渲染模型自带格像素度量；消费者用 `?? MAP_CELL_SIZE`，Plan 15 收紧为必填 |
| `src/map/__tests__/model.cellMetrics.test.ts` | 文件 | contain / 保持原尺寸 / 居中 / 指针换算的单元测试 |
| `src/map/__tests__/mapView.cellMetrics.test.tsx` | 文件 | 端到端：文档格尺寸 → 渲染模型 → 视图收到的模型（`MapSurface` 用桩） |
| `createSizedTileGroup` | 测试夹具函数 | 造一个带 `cellWidth/cellHeight/read/frames/category` 的素材组，供后续所有模型测试复用 |

---

## Plan 03 — 帧与自动拼接模型

**要做什么：** 把「素材怎么切、动画怎么走」和「自动拼接怎么拼」算清楚，两者都是纯函数、不碰图片。

| 名称 | 种类 | 用途 |
|------|------|------|
| `src/map/model/tileFrame.ts` | 文件 | 读取方式 → 帧矩形 / 帧轴 / 帧步长 / 帧数 |
| `resolveFrameInfo` | 自由函数 | 由素材组规则与图块行列算出该图块的帧信息（第 0 帧矩形、帧数、帧轴、步长） |
| `resolveFrameRect` | 自由函数 | 由帧信息与当前帧号算出该帧的源图裁切矩形 |
| `resolveCellFrame` | 自由函数 | 由全局帧号与格子的 `defaultFrame` / 帧数算出这个格子该显示第几帧 |
| `resolveFrameTickAt` | 自由函数 | 由累计毫秒与帧速算出全局帧号 `floor(elapsed / speed)`；默认 300ms 与宿主覆盖（150ms）都在它的单元测试里钉住 |
| `src/map/model/autotile.ts` | 文件 | 8 方向连接 + 3×4 / 2×3 四分之一块矩形 |
| `computeAutotileConnection` | 自由函数 | 由同层格子值与宿主注入的连接集合算出 8 位连接数（地图外视为已连接，逐字复刻引擎掩码） |
| `resolveAutotileQuarters` | 自由函数 | 由自动拼接类型与连接数算出 `lt` / `rt` / `rb` / `lb` 四个象限矩形（每块取源图单格的一半） |
| `src/map/__tests__/model.tileFrame.test.ts` | 文件 | 五种读取方式 × 帧数 / 帧矩形 / 帧轴 / 255 上限 / `defaultFrame` 优先 |
| `src/map/__tests__/model.autotile.test.ts` | 文件 | 连接位、边缘掩码、两种形状、四块矩形、动画帧 |

---

## Plan 04 — 缩略与布局模型

**要做什么：** 算清「大地图缩略纹理该多大、放哪」和「13×13 视口、50–200% 缩放、右栏该多宽」。

| 名称 | 种类 | 用途 |
|------|------|------|
| `src/map/model/thumbnail.ts` | 文件 | 大地图缩略描述 |
| `buildThumbnail` | 自由函数 | 由文档尺寸、画布尺寸与缩略上限算出纹理尺寸 / 缩放 / 居中偏移；**不输出逐格格子** |
| `src/map/model/layout.ts` | 文件 | 视口 / 缩放 / 栏宽的纯计算 |
| `IMapLayoutOptions` | interface（Plan 01 已声明，本计划只 import） | 布局输入：缩放、宿主覆盖的视口格数、右栏基准宽度 |
| `resolveMapLayout` | 自由函数 | 由文档与选项算出 `IMapLayout`（`paletteWidth = clamp(base / zoom, min, max)`） |
| `src/map/__tests__/model.thumbnail.test.ts` | 文件 | 256×256 不产生逐格格子、与视口 / 选区无关、超过纹理上限时的降采样 |
| `src/map/__tests__/model.layout.test.ts` | 文件 | 13×13、长方形、缩放夹取、栏宽夹取、不依赖 `window.innerWidth` |

---

## Plan 05 — 图块偏好模型

**要做什么：** 把 `.editor` 里那份「最近 / 最常 / 收藏」整理干净：坏数据不留、旧文件能迁、收藏只有 9 格。

| 名称 | 种类 | 用途 |
|------|------|------|
| `src/map/model/tilePreferences.ts` | 文件 | 偏好归一化、排序、旧文件迁移、写回形状 |
| `normalizeTilePreferences` | 自由函数 | 把任意输入整理成合法的 `IMapTilePreferences`：去重、截断、只留目录里存在的编号、收藏排除 Tileset、固定 9 格 |
| `migrateRecentTiles` | 自由函数 | 把旧 `.editor/map-recent-tiles.json` 的 `{ tiles }` 只读迁移成 `recent`（不删旧文件） |
| `rankFrequentTiles` | 自由函数 | 按次数降序、同次数按编号升序，给出「最常使用」展示顺序 |
| `reorderFavorite` | 自由函数 | 收藏拖拽排序：把一个位置的编号移到另一个位置，返回新的 9 格数组 |
| `serializeTilePreferences` | 自由函数 | 把偏好转成写盘用的普通对象（数字键转字符串，只输出数字键） |
| `src/map/__tests__/model.tilePreferences.test.ts` | 文件 | 归一化、排序、迁移、原型污染（`__proto__` / `constructor`）、收藏边界 |

---

## Plan 06 — 宿主图块目录与演示图集（G-04-1）

**要做什么：** 让开发宿主真的从引擎文件生成图块目录，并把那张「整片红」的 1×1 演示图换成七张有区分度的真实图集（含六类素材、动画、两种自动元件、Tileset、大素材、小素材），再补一张 256×256 演示地图。

| 名称 | 种类 | 用途 |
|------|------|------|
| `packages/apps/editor-dev/src/backend/tileCatalog.ts` | 文件 | 宿主适配器：读纹理清单 + 图块表，生成中立图块目录 |
| `buildTileCatalog` | 自由函数 | 由纹理清单文本、图块表文本、图片尺寸查询与连接规则生成 `readonly IMapTileGroup[]` |
| `ITileCatalogSource` | interface（Plan 01 在 `apps/editor-dev/src/backend/types.ts` 声明，本计划只 import） | 解析输入：两份文本 + 读图片尺寸的函数 + 自动拼接连接表 |
| `encodeDemoTileAtlas` / `encodeDemoAnimateAtlas` / `encodeDemoAutotileBigAtlas` / `encodeDemoAutotileSmallAtlas` / `encodeDemoTilesetAtlas` / `encodeDemoLargeTileAtlas` / `encodeDemoSmallTileAtlas` | 自由函数（演示，共七个） | 在 `mapDemo.ts` 内编码七张真实 PNG：128×64 地形（4×2、32 格）、128×32 动画（4 帧）、192×128 与 128×96 自动元件（各 2 帧）、128×64 Tileset（4×2）、**192×64 大素材（2×1、每格 96×64；在 48×48 格里缩成 48×32、上下各留 8px，保证 contain 的留空可观察）**、**64×32 小素材（4×2、每格 16×16）**（算法与 `assetDemo.ts` 同形，**不修改** `assetDemo.ts`） |
| `DEMO_TEXTURE_LIST_TEXT` / `DEMO_TILE_TABLE_TEXT` | 常量 | 演示用的引擎格式文本（`.list.jsonc` / `tile.jsonc` 形状），供 `buildTileCatalog` 解析 |
| `buildDemoTileCatalog` | 自由函数（演示） | 把七张演示图集尺寸 + 两份文本 + 连接规则交给 `buildTileCatalog`，返回六类目录 |
| `registerMapDemo` | 既有函数（第三参数新增） | 注册演示宿主；第三个可选参数使用 `IMapDemoOverrides`（视口格数 / 动画帧速），不写内联对象类型 |
| `IMapDemoOverrides` | interface（Plan 01 在 `apps/editor-dev/src/backend/types.ts` 声明，本计划只 import） | `registerMapDemo` 的覆盖参数形状：`viewportColumns?` / `viewportRows?` / `frameSpeed?` |
| `IMapFileRecord.cellWidth` / `.cellHeight` | 字段（可选；Plan 01 已在 `apps/editor-dev/src/backend/mapFiles.ts` 的接口块声明，本计划只赋值与校验） | 每张地图文件自己的格子尺寸（缺省 32）；本计划给演示记录填值、`toMapDocument` 带进 `IMapDocument`，非法值回退 32，**不重复声明** |
| `IMapCapabilityOptions.recentTilesPath` | 字段 **删除**（Plan 06 在 `apps/editor-dev/src/backend/mapFiles.ts` 删除） | 开发宿主不再能覆盖偏好文件路径；路径唯一由 `MAP_TILE_PREFS_PATH` 决定，否则新格式会被写进旧文件名，迁移时又被当成空数据 |
| `packages/apps/editor-dev/src/backend/__tests__/tileCatalog.test.ts` | 文件 | 分类映射、读取方式、帧数、自动拼接连接、Tileset 逐格编号、畸形数据 |
| `packages/apps/editor-dev/src/__tests__/mapDemo.test.ts` | 文件 | G-04-1 收口：**七张**图集尺寸（128×64 / 128×32 / 192×128 / 128×96 / 128×64 / 192×64 / 64×32）、所有裁切在图内、六类齐全、动画 4 帧、Tileset 8 格且 `read` 为 `Grid`、大素材每格 96×64、小素材每格 16×16、256×256 地图存在 |

---

## Plan 07 — 渲染模型收口

**要做什么：** 让「一帧要画什么」这件事把所有新能力都算进去：格尺寸、动画帧、自动拼接四块、整条路径预览、大地图缩略。

| 名称 | 种类 | 用途 |
|------|------|------|
| `IMapRenderView.zoom` | 字段（Plan 01 已声明；Plan 02 在 `buildMapRenderModel` 里乘一次，本计划只沿用其结果） | 缩放倍率；格度量已由 `buildMapRenderModel` 换算成像素，本计划不得再乘一次 |
| `IMapRenderModel.previewCells` | 字段（Plan 01 已声明；本计划输出空数组，Plan 09 的画布在本地覆盖成整条路径） | 整条路径要预览的格子；生产者在 Plan 09，不在视图参数里 |
| `IMapRenderModel.viewport` | 字段（Plan 01 已声明为可选；本计划只赋值） | 透传视口左上角；画布据此把叠加层从文档坐标换算到画布坐标 |
| `IMapRenderModel.thumbnail` | 字段（Plan 01 已声明为可选；本计划只赋值） | 大地图模式下替代逐格 `cells` 的缩略描述 |
| `IMapRenderCell.frameColumns` | 字段（Plan 01 已声明为可选；本计划只赋值） | `ScanAnimate` 用：一行有多少格，帧号才能换算行列 |
| `src/map/__tests__/model.renderModel.test.ts` | 文件（改造） | 格尺寸 / 动画 / 自动拼接 / 缩略 / 整条路径的断言 |

---

## Plan 08 — 面板数据层（偏好落盘与视图动作）

**要做什么：** 面板记住用户的缩放、页签、分类、收藏，并把它们写进一个 `.editor` 文件；所有视图动作只改视图状态，不置脏、不进撤销。

> **本计划不声明任何接口成员。** 视图状态的 9 个新字段已在 §Plan 01 声明为可选；本计划只给它们初始值并读写。

| 名称 | 种类 | 用途 |
|------|------|------|
| `MapPanel.loadTilePreferences` | 方法 | 读 `.editor/map-tiles.json`；缺失时只读迁移旧文件；**成功发布 `recentStatus: Ready`、失败发布 `Error`**，不再永远停在 `Loading` |
| `MapPanel.saveTilePreferences` | 方法 | 写回偏好文件（失败静默降级） |
| `MapPanel.recordTileUse` | 方法 | 落笔成功后同时更新最近与最常，并落盘；Tileset 编号直接忽略 |
| `MapPanel.collectRecentNumbers` | 方法 | 目录编号去掉 Tileset 分类组，供「最近 / 最常」归一化与 `MapPanel.recordTileUse` 过滤 |
| `MapPanel.collectFavoriteNumbers` | 方法 | 目录编号去掉 Tileset 分类组，供收藏归一化与 `MapPanel.addFavorite` 过滤 |
| `MapPanel.setZoom` | 方法 | 记录缩放并发布（不置脏、不进撤销） |
| `MapPanel.setBottomTab` | 方法 | 切换底部页签 |
| `MapPanel.selectCategory` | 方法 | 切换右侧竖排分类 |
| `MapPanel.toggleTileset` | 方法 | 进入 / 退出 Tileset 单独视图 |
| `MapPanel.toggleFrameCount` | 方法 | 开关帧数角标 |
| `MapPanel.selectFavoriteSlot` | 方法 | 选中收藏格；参数是 **0..9**：`0` = 擦除（数字键 `1`），`1..9` = 第 1..9 个收藏位（数字键 `2..9` 对应 `1..8`、`0` 对应 `9`） |
| `MapPanel.reorderFavorites` | 方法 | 收藏排序落盘 |
| `mapPanel.ts` 的 `createElement(MapPanelView, …)` 绑定 | 文件内改动（不是新接口成员） | 本计划一次性绑 **7 个**视图回调：`MapPanel.setZoom` / `MapPanel.setBottomTab` / `MapPanel.selectCategory` / `MapPanel.toggleTileset` / `MapPanel.toggleFrameCount` / `MapPanel.selectFavoriteSlot` / `MapPanel.reorderFavorites`；这是这批「面板方法 → 视图 props」的唯一绑定点。**另外两条绑定不在本计划**：Plan 09 在同一处追加 `onSetViewport`（滚动回报）、Plan 13 追加 `onFavoriteTile`（右键收藏），它们同样只在 `mapPanel.ts` 绑定；Plan 11 / 12 / 13 其余部分只往子组件透传 |

---

## Plan 09 — 画布视口与交互（D-13 / D-14）

**要做什么：** 画布只画 13×13 的一屏，用滚动条看全图；删掉四向按钮与方向键；线模式拖到哪就预览整条路径。

| 名称 | 种类 | 用途 |
|------|------|------|
| `MapPanel.setViewport` | 方法 | 接收画布回报的滚动位置，夹取到「文档尺寸 − 视口格数」 |
| `IMapCanvasProps.onSetViewport` | 方法成员（Plan 01 声明） | 画布把滚动位置回报给面板；本计划只实现调用 |
| `IMapPanelViewProps.onSetViewport` | 方法成员（Plan 01 声明） | 视图层把回报转发给面板；本计划只接线 |
| `.emap-canvas-viewport` | CSS 类 | 可见框：`viewportColumns × viewportRows` 格，`overflow: auto` |
| `.emap-canvas-spacer` | CSS 类 | 透明占位：整图尺寸，只用来撑滚动条 |
| `map-canvas-viewport` | `data-test-id` | 视口容器 |
| `MapPanel.moveViewport` | **删除** | 旧的四向 / 方向键移动入口，D-13 要求删除 |
| `IMapToolbarProps.onMoveViewport` | 成员 **删除** | 工具栏四向按钮的唯一消费入口；与 `MapViewportButtons` 同批删除，否则 props 删了而组件还要求它，typecheck 会断 |
| `IMapCanvasProps.onMoveViewport` | 成员 **删除** | 画布原本用它驱动四向按钮 / 方向键的视口移动；视口改由滚动条回报后不再需要 |
| `IMapPanelViewProps.onMoveViewport` | 成员 **删除** | 视图层不再转发旧的视口移动入口；与上面三条同批删除 |
| `MapViewportButtons` | **删除（本计划）** | 工具栏四向按钮组件（D-13）；Plan 11 只挂缩放滑块，不再回头删它 |
| `packages/libs/editor-impl/src/map/__tests__/mapView.toolbar.test.tsx` | 文件（改造） | 删除四向按钮用例；Plan 11 在这里补滑块用例 |
| `buildStrokeWrites` | 已有函数（复用） | 由手势路径算出这一笔的写入；预览取它的去重格子集合 |

---

## Plan 10 — Pixi 渲染（G-04-2）

**要做什么：** 画布按模型里的度量画，不再到处写死 32；动画只在动画格上换帧；自动拼接用 4 块拼（源图单格取一半、铺到目标格的四个象限）；大地图只画一张缩略纹理；通行度改成四个不同颜色的箭头；线模式把整条路径画出来。

| 名称 | 种类 | 用途 |
|------|------|------|
| `resolvePassArrowColor` | 自由函数（`model/passability.ts`） | 按 `MapDirection` 取四色之一；四个值互不相同（G-04-2 可测） |
| `resolvePreviewCellRects` | 自由函数（`model/cellMetrics.ts`） | 把 `previewCells` 从文档坐标换算成画布像素矩形（减去 `model.viewport`、乘格尺寸） |
| `IMapSurfaceProps.cellFrameSpeed` / `IMapCanvasProps.cellFrameSpeed` | 可选字段（Plan 01 声明） | 动画帧速（毫秒 / 帧），由能力注入；缺省 300 |
| `IMapSurfaceProps.document` / `.currentLayerId` / `.aboveLayerOpacity` | 可选字段（Plan 01 声明） | 大地图缩略纹理的内容来源与重建判据 |
| `MAP_PASS_COLOR_*` | 常量（Plan 01 已声明） | 上 / 右 / 下 / 左四色 |
| `src/map/__tests__/model.passability.test.ts` | 文件（改造） | 追加「四个色值互不相同」与方向映射断言 |
| `src/map/__tests__/model.cellMetrics.test.ts` | 文件（改造） | 追加整条路径矩形换算断言 |

---

## Plan 11 — 左右布局与缩放滑块（D-16 / D-17）

**要做什么：** 把面板改成「左边地图、右边素材」，并在工具栏加一个 50%–200% 的缩放滑块；滑块松手才生效。

| 名称 | 种类 | 用途 |
|------|------|------|
| `src/map/components/MapZoomSlider.tsx` | 文件 | 50–200% 缩放滑块（本地 state 驱动拇指，`onChangeComplete` 才发布） |
| `IMapZoomSliderProps` | interface（Plan 01 已声明，本计划只 import） | 滑块的 props：当前值、禁用、发布回调 |
| `IMapPanelViewProps.onSetZoom` | 方法成员（Plan 01 声明） | 视图把缩放值交给面板；本计划只接线 |
| `IMapToolbarProps.zoom` / `IMapToolbarProps.onSetZoom` | 字段 / 方法成员（Plan 01 声明） | 工具栏承载缩放滑块：当前值与松手后的发布回调；`MapPanelView` 从 `view.zoom` 与 `props.onSetZoom` 传入 |
| `IMapPanelViewProps.cellFrameSpeed` | 字段（Plan 01 声明） | 宿主帧速，视图原样下传给画布 |
| `.emap-main` | CSS 类 | 左列：工具栏 + 地图 + 底部三页 |
| `.emap-side` | CSS 类 | 右列：素材区 |
| `.emap-zoom` | CSS 类 | 缩放滑块容器 |
| `map-main` / `map-sidebar` / `map-zoom` | `data-test-id` | 左列 / 右列 / 缩放滑块 |
| `MapViewportButtons` | **已由 Plan 09 删除** | 工具栏四向按钮组件（D-13）；本计划只确认它不存在 |

---

## Plan 12 — 右侧素材区（D-05 / D-18 / D-21 / D-22）

**要做什么：** 右侧按六类展示素材：普通五类竖排、Tileset 单独开关；普通素材逐格显示第一帧、方角框、顶部「显示帧数」勾选框控制角标；Tileset 整图分格、可框选多格。

| 名称 | 种类 | 用途 |
|------|------|------|
| `src/map/components/MapMaterialPanel.tsx` | 文件 | 右侧素材区容器：按当前分类渲染素材网格、缺图占位、重试入口 |
| `IMapMaterialPanelProps` | interface（Plan 01 已声明，本计划只 import 并创建组件） | 素材区 props：目录、图片地址 / 状态、当前分类、`tilesetOpen`、选中、`showFrameCount` / `onToggleFrameCount`（「显示帧数」勾选框）、回调 |
| `src/map/components/MapCategoryNav.tsx` | 文件 | 竖排五类导航（Terrains / Enemy / Npc / Item / Autotile）+ Tileset 单独开关 |
| `IMapCategoryNavProps` | interface（Plan 01 已声明，本计划只 import） | 导航 props：当前分类、Tileset 是否展开、回调 |
| `src/map/components/MapTilesetPicker.tsx` | 文件 | Tileset 整图 + 分割线 + 单格 / 框选多格 → 图案 |
| `IMapTilesetPickerProps` | interface（Plan 01 已声明，本计划只 import） | Tileset 选择器 props：Tileset 组、图片地址 / 状态、选中、回调 |
| `.emap-category-nav` / `.emap-category-item` | CSS 类 | 竖排分类 |
| `.emap-tileset` / `.emap-tileset-grid` | CSS 类 | Tileset 整图与分格层 |
| `.emap-tile-frames` | CSS 类 | 帧数角标 |
| `.emap-frame-count` | CSS 类 | 「显示帧数」勾选框一行 |
| `IMapMaterialPanelProps.onToggleFrameCount` | 方法成员（`IMapMaterialPanelProps` 由 Plan 01 声明，本计划只消费） | 勾选框把新的开关值上报给面板 |
| `IMapPanelViewProps.onSelectCategory` / `.onToggleTileset` / `.onToggleFrameCount` | 方法成员（Plan 01 声明） | 视图把分类 / Tileset 开关 / 帧数开关透传给素材区与导航；绑定在 `mapPanel.ts`（Plan 08） |
| `map-category-{terrain\|enemy\|npc\|item\|autotile}` | `data-test-id` | 五个分类按钮 |
| `map-tileset-toggle` / `map-tileset-grid` | `data-test-id` | Tileset 开关 / 整图分格 |
| `map-material-grid` | `data-test-id` | 普通素材网格 |
| `map-frame-count` | `data-test-id` | 「显示帧数」勾选框（D-18 的控件本体） |
| `map-tile-{number}` | `data-test-id` | 单个普通图块格子（右键收藏与点选的落点） |
| `map-tile-frames-{number}` | `data-test-id` | 单格帧数角标 |
| `MapPalette.tsx` / `mapView.palette.test.tsx` | **删除** | 旧的 240px 三段式调色板与其测试，被本计划取代 |

---

## Plan 13 — 底部三页与收藏（D-19 / D-20）

**要做什么：** 地图下方做「最近使用 / 最常使用 / 收藏」三页；收藏固定 1=擦除 + 9 格，右键收藏，可拖拽排序，跨会话记住。

| 名称 | 种类 | 用途 |
|------|------|------|
| `src/map/components/MapBottomTabs.tsx` | 文件 | 底部三页容器：页签切换 + 当前页的编号网格 |
| `IMapBottomTabsProps` | interface（Plan 01 已声明，本计划只 import） | 三页 props：当前页签、三份编号、`groups`（编号 → 素材组）、图片地址 / 状态、选中、回调 |
| `src/map/components/MapFavoriteBar.tsx` | 文件 | 1 个擦除格 + 9 个收藏格；拖拽 / 上下按钮排序 |
| `IMapFavoriteBarProps` | interface（Plan 01 已声明，本计划只 import） | 收藏栏 props：收藏数组、当前选中、`groups`（编号 → 素材组）、切图、排序、选中回调（擦除格调 `onSelectSlot(0)`，第 i 个收藏格调 `onSelectSlot(i + 1)`） |
| `MapPanel.addFavorite` | 方法 | 右键把普通图块放进第一个空收藏位；已收藏则忽略；满了替换第 9 位 |
| `IMapCanvasProps.onSelectFavoriteSlot` | 方法成员（Plan 01 声明） | 画布容器里的数字键回调，参数是 0..9（`0` = 擦除，`1..9` = 收藏位）；本计划只实现调用与 `MapPanelView` 的接线 |
| `packages/libs/editor-impl/src/map/components/MapCanvas.tsx` | 文件（改造） | 在既有键盘处理里加 `1..9` / `0` 的映射；不挂 `window` |
| `IMapMaterialPanelProps.onFavoriteTile` | 方法成员（`IMapMaterialPanelProps` 由 Plan 01 在 `types.ts` 声明，本计划只接线） | 素材区把「右键某个图块」这件事上报给面板 |
| `IMapPanelViewProps.onSetBottomTab` / `.onSelectFavoriteSlot` / `.onReorderFavorites` / `.onFavoriteTile` | 方法成员（Plan 01 声明） | 视图把三页切换 / 收藏格选中 / 排序 / 右键收藏透传给底部三页与收藏栏；`onFavoriteTile` 的绑定（`MapPanel.addFavorite`）在本计划的 `mapPanel.ts` |
| `.emap-bottom` / `.emap-bottom-tab` | CSS 类 | 底部区域与页签 |
| `.emap-favorite` / `.emap-favorite-slot` | CSS 类 | 收藏栏与单格 |
| `map-bottom-tab-recent` / `-frequent` / `-favorites` | `data-test-id` | 三个页签 |
| `map-bottom-tile-{number}` | `data-test-id` | 底部当前页里的单个图块格 |
| `map-favorite-erase` / `map-favorite-{0..8}` | `data-test-id` | 擦除格与 9 个收藏格 |
| `map-favorite-up-{index}` / `map-favorite-down-{index}` | `data-test-id` | 收藏格的上移 / 下移按钮（拖拽的可访问替代） |

---

## Plan 14 — 收口门禁：G-04-3 / 桶导出 / 四条门禁

**要做什么：** 修掉属性抽屉「塌成灰线」；补齐桶导出；跑四条结构门禁。**不碰 `types.ts`。**

| 名称 | 种类 | 用途 |
|------|------|------|
| `.emap-properties` | CSS 类（修复） | 抽屉外层：补 `display:flex; height:100%; min-height:0`，让复用的绝对定位表单有高度 |
| `MapPropertiesDrawer` 的 `maskClosable={false}` | 属性 | 禁用点外部关闭，保留 Esc 与 ✕（D-15） |
| `map/model/index.ts` / `map/components/index.ts` | 桶文件（更新） | 导出本阶段全部新模块 |
| `mapProperties.test.tsx` | 文件（改造） | CSS 高度断言 + `maskClosable` 断言 |

## Plan 15 — 接口终态收紧（纯接口计划）

**要做什么：** 只做「Plan 01 已声明成员」的收紧与机械对齐：删除 `crop`、把新字段改为必填；不新增任何接口成员。

| 名称 | 种类 | 用途 |
|------|------|------|
| `IMapTileEntry.crop` | **删除** | 裁切改由素材规则现算（D-02 终态） |
| `IMapEditorCapabilities.recentTilesPath` | **删除** | 宿主能力不再暴露偏好文件路径；Plan 06 已停止产出、Plan 08 已停止读取，本计划删掉最后残留字段（路径只有 `MAP_TILE_PREFS_PATH`） |
| `IMapDocument.cellWidth` / `.cellHeight` | 字段（收紧为必填） | 每张地图必须声明格子尺寸 |
| `IMapTileGroup.category` / `.read` / `.cellWidth` / `.cellHeight` / `.frames` | 字段（收紧为必填） | 素材组必须声明规则 |
| `IMapRenderModel.cellWidth` / `.cellHeight` / `.viewport` | 字段（收紧为必填） | 渲染模型必须自带度量与视口 |
| `IMapPanelViewState.zoom` / `.bottomTab` / `.activeCategory` / `.tilesetOpen` / `.showFrameCount` / `.favorites` / `.frequentTiles` / `.viewportColumns` / `.viewportRows` | 字段（收紧为必填） | 视图状态必须完整初始化 |
| `fixtures.ts` / `mapView.toolbar.test.tsx` / `mapDemo.ts` / `tileCatalog.ts` / `mapFiles.test.ts` | 文件（机械对齐） | 按编译错误补齐字段，不允许 `as` 绕过 |

## Plan 16 — 全量门禁 + 九条手动验收

**要做什么：** 跑 `pnpm lint` / `pnpm format:check` / 全量测试 / typecheck / 四条门禁，再在开发宿主里逐条手动验收。

| 名称 | 种类 | 用途 |
|------|------|------|
| `04.1-16-SUMMARY.md` | 文件 | 每条门禁的命令 / 退出码 / 摘要行，以及九条判据的通过与否 + 证据 |
| 九条 Success Criteria | 验收清单 | ROADMAP §Phase 04.1 的 1–9 条，逐条记录结论 |

---

## Plan 17 — 接口与命名（UAT 修复轮，纯声明）

**要做什么：** 把「显示网格以 32×32 为基准」「地图区宽 / 高是面板参数」「缩放 = 整体渲染倍率」「顶栏显示当前地图声明的图格尺寸」这四件事需要的字段、常量与回调先声明出来；不写任何逻辑，最后停下来请用户确认命名。

| 名称 | 种类 | 用途 |
|------|------|------|
| `MAP_DISPLAY_CELL_SIZE` | **新增**常量（`constants.ts`，值 32） | 显示网格的基准格边长：画布像素 = 格数 × 32 × 缩放。它和地图文档自己声明的 `cellWidth/cellHeight` 是两件事（D-39） |
| `IMapRenderModel.cellWidth` / `.cellHeight` | 语义修订（不新增成员） | 改为**显示格基准尺寸**（= `MAP_DISPLAY_CELL_SIZE`，不含缩放）；屏幕格像素 = 它 × `renderScale`。文档声明的格尺寸只用于素材切分与数据本身（D-39） |
| `IMapRenderModel.renderScale` | **新增**可选字段（`types.ts`，Plan 19 收紧为必填） | 整体渲染缩放：画布把整个场景乘这个倍率，内容不会被压扁、也不会跟着缩水（D-30 / D-39） |
| `IMapLayout.renderScale` | **新增**可选字段（`types.ts`，Plan 19 收紧为必填） | 布局算出的整体渲染缩放，与渲染模型同源 |
| `IMapLayout.mapPaneWidth` | **新增**可选字段（`types.ts`，Plan 19 收紧为必填） | 左列（地图区）的像素宽；右列宽仍叫 `paletteWidth`，两列之和即可用宽度（D-41） |
| `IMapLayoutOptions.availableWidth` | **新增**可选字段（`types.ts`） | 视图量到的可用宽度（面板根元素，像素）；缺省或 ≤ 0 时素材区回退到 `MAP_PALETTE_BASE_WIDTH`（D-41） |
| `MAP_PALETTE_BASE_WIDTH` / `MAP_PALETTE_MIN_WIDTH` | 常量**改值**（240 / 160 → 320 / 240） | 素材区基准更大、最小更宽；**素材区没有最大宽度**（D-41 修订 / U-06 的「素材区要大一些」） |
| `MAP_PALETTE_MAX_WIDTH` | 常量**过渡**（`360` → `520`） | 只为让既有 `model/layout.ts` 的 `Math.min(...)` 继续编译；Plan 19 删除它并取消上限（D-41 修订） |
| `MAP_VIEWPORT_MIN_COUNT` / `MAP_VIEWPORT_MAX_COUNT` | **新增**常量（1 / 64） | 面板上「地图区宽 / 高」两个数字框的取值范围（D-40） |
| `IMapPanelViewState.viewportColumns` / `.viewportRows` | 语义修订（JSDoc，签名不变） | 从「宿主注入的视口格数」改为「地图区宽 / 高（格数），面板控件可改，初值来自宿主注入」（D-40） |
| `IMapEditorCapabilities.viewportColumns` / `.viewportRows` | 语义修订（JSDoc，签名不变；该接口在代码里就叫 `IMapEditorCapabilities`，与 §Plan 01 一致） | 只作**初始默认值**，不再是可见格数的驱动器（D-40） |
| `IMapPanelViewProps.onSetViewportSize` | **新增**可选方法（`MapPanelView.tsx` 的导出接口） | 面板 UI 把新的地图区宽 / 高交给面板数据层；签名 `(columns: number, rows: number) => void` |
| `IMapToolbarProps.viewportColumns` / `.viewportRows` / `.onSetViewportSize` | **新增**可选成员（`MapToolbar.tsx` 的导出接口） | 工具栏「视图」组里的两个数字框：显示当前值并上报新值（D-40） |
| `IMapToolbarProps.cellWidth` / `.cellHeight` | **新增**可选成员（`MapToolbar.tsx` 的导出接口） | 当前**地图文档**声明的格子宽 / 高（像素，不是 32 基准、也不含缩放），顶栏只读标签用；两者缺一就不显示标签（D-42） |
| `MAP_CELL_SIZE_LABEL` | **新增**常量（`constants.ts`，值 `'图格尺寸'`） | 顶栏只读标签的前缀。完整显示格式固定为 `图格尺寸：{cellWidth}px * {cellHeight}px`：全角冒号，`*` 两侧各一个空格（D-42） |
| `resolveMapLayout` | 自由函数签名**变更**（由 Plan 19 执行） | 不再接地图文档：改为 `resolveMapLayout(options)`，文档格尺寸与画布尺寸彻底脱钩（D-39）；本计划只登记 |
| `MAP_PANE_SHARE_MIN` / `MAP_PANE_SHARE_MAX` | **不新增** | 缩放不再按比例分栏；D-41 取代 D-31 的分栏口径，不引入这两个常量 |
| `?mapViewport=wide` | **删除**（由 Plan 20 执行） | 宿主注入只作初始默认值，不再有按 URL 改视口的路径（D-40） |
| `IMapCanvasProps.viewportColumns` / `.viewportRows` | **删除**（由 Plan 19 执行） | 画布尺寸改由渲染模型给出，不再自己按格数算；本计划只在报告里登记 |
| `MapDialogKind.Unsaved` / `MapUnsavedChoice` / `IMapUnsavedDialogProps` / `IMapPanelViewProps.onUnsavedDecision` | **删除**（由 Plan 23 执行） | 自动保存后不再有「未保存」弹窗（D-37）；本计划只登记，避免 Plan 17 一改就编译红 |
| Plan 17 正文节（本文件） | 文件 | 新命名与语义的唯一确认点；用户确认前不得写实现 |

---

## Plan 18 — editor-core 自动保存契约与切换时序

**要做什么：** 把「切走就落盘」变成 core 的硬契约：外壳在切换 / 关闭 / 替换面板前**按顺序** await 面板的落盘钩子，并且不许任何面板再用 `onBeforeClose` 问「要不要保存」。

| 名称 | 种类 | 用途 |
|------|------|------|
| `IEditorPanel.onSwitchOut` | 语义**收紧**（JSDoc 重写，签名不变） | 唯一的落盘点：切走前必须把未保存改动写完；外壳会在切换 / 关闭 / 替换 / 注销前 await 它；**不得**弹确认框（D-37） |
| `IEditorPanel.onBeforeClose` | 语义**收紧**（JSDoc 重写，签名不变） | 只允许用于「必须拦截」的破坏性场景；不得再用于询问未保存改动（D-37） |
| `ShellSystem` 的私有切换链（实现细节，不新增接口成员） | 实现约定 | 把「先 switchOut、再 switchIn」串成一条链，保证保存先于下一个面板的切入 |
| `src/shell/__tests__/shellAutosave.test.ts` | 新文件 | 断言：切换前 await 落盘、关闭标签前 await 落盘、标签被替换前 await 落盘、落盘抛错只记日志且不卡住切换 |

---

## Plan 19 — 缩放语义：整体倍率 + 32 基准画布

**要做什么：** 让缩放只作用于「整张画布的等比放大」；画布尺寸改为 32 基准 × 格数 × 缩放，与地图声明的格子尺寸脱钩；命中、滚动、大地图统一到同一个倍率。

| 名称 | 种类 | 用途 |
|------|------|------|
| `resolveMapLayout(options)` | 自由函数（改造，`model/layout.ts`） | 去掉文档入参；吃「缩放 + 视口格数 + 可用宽度」，产出 `renderScale`、格像素（32 × 缩放）、画布像素、`mapPaneWidth`、`paletteWidth`；素材区 = 可用宽度 − 画布宽，**只有最小 240、没有上限**（D-39 / D-41 修订） |
| `buildMapRenderModel` | 自由函数（改造，`model/renderModel.ts`） | 格像素 = `MAP_DISPLAY_CELL_SIZE`（不含缩放）；可见格数用「格像素 × `renderScale`」算；三条返回路径都带 `renderScale`（大地图恒为 1） |
| `buildCanvasCellMetrics` | 自由函数（改造，`MapCanvas.tsx`） | 命中测试用的**屏幕**格像素 = `MAP_DISPLAY_CELL_SIZE × renderScale`（D-39） |
| `useMapElementWidth` | hook（新文件 `components/useMapElementWidth.ts`） | 量面板根元素的可用宽度（`ResizeObserver` + `getBoundingClientRect`）；量不到返回 0，素材区回退到基准宽度（D-41）。只量宽度：画布高度已经由「格数 × 32 × 缩放」决定 |
| `MAP_PALETTE_MAX_WIDTH` | 常量（**删除**） | Plan 17 的过渡常量；本计划删除，素材区从此没有上限（D-41 修订） |
| `MAP_CANVAS_GUTTER_X` | **不新增** | 右栏拿剩余宽度（可用宽度 − 画布宽），不另扣标尺宽度；标尺的 20px 内边距仍由 `MapCanvas` 自己的 `RULER_SIZE` 负责 |
| `IMapRenderModel.renderScale` / `IMapLayout.renderScale` / `IMapLayout.mapPaneWidth` | 由可选**收紧为必填** | 收敛到「渲染模型与布局必须自带倍率」 |
| `IMapCanvasProps.viewportColumns` / `.viewportRows` | 删除 | 画布尺寸改由模型给出 |
| `IMapPanelView` 顶层的布局计算 | 实现约定（不新增名字） | 用 `map-panel` 根元素的实测宽度算一次 `resolveMapLayout`，把结果同时给 `emap-side` 宽度与画布；不再在 `renderReadyBody` 里各自再算一次 |

---

## Plan 20 — 版面重排 + 地图区宽高控件（D-31 / D-32 / D-40）

**要做什么：** 顶栏通栏、左列地图区、右列素材区通高、分类横排自动换行；再把「地图区宽 / 高」两个数字框放进工具栏「视图」组，并在顶栏加一个只读的「图格尺寸」标签；最后删掉 `?mapViewport=wide`。

| 名称 | 种类 | 用途 |
|------|------|------|
| `.emap-columns` | CSS 类（新） | 顶栏下方的一行容器：左列 `emap-main` + 右列 `emap-side` |
| `.emap-panel` | CSS 类（改） | 从「横向两列」改为「纵向：顶栏 + 一行两列」 |
| `.emap-main` / `.emap-side` / `.emap-body` / `.emap-canvas-area` / `.emap-canvas-scroll` | CSS 类（改） | 左列占满剩余高度、右列通高；`.emap-side` 宽度取 `layout.paletteWidth`（剩余宽度，只有最小 240、没有上限）；去掉会把画布顶住的固定高度与多余留白（画布尺寸固定，多出来的空间留在地图区一侧） |
| `.emap-category-nav` / `.emap-category-item` | CSS 类（改） | 分类导航横排、`space-between`、自动换行（D-32） |
| `.emap-category-row` | CSS 类（可选，新） | 横排时把「五个普通分类」与「Tileset 开关」分成两组；只有在确实需要分组换行时才新增，不新增就不要出现在代码里 |
| `map-columns` | `data-test-id`（新） | 顶栏下的两列容器；测试据此断言「顶栏在列容器之外」 |
| `MapPanel.setViewportSize` | 方法（新，`mapPanel.ts`） | 把新的地图区宽 / 高夹取到 `MAP_VIEWPORT_MIN_COUNT`…`MAP_VIEWPORT_MAX_COUNT` 后写进视图状态，并把当前视口重新夹回合法范围（D-40） |
| `map-viewport-size` / `map-viewport-columns` / `map-viewport-rows` | `data-test-id`（新） | 两个数字框的容器与各自输入框；测试据此断言默认 13×13 与改值生效 |
| `.emap-cell-size` | CSS 类（新） | 顶栏里那个只读的图格尺寸标签：与 `.emap-toolbar-label` 同色同字号、`flex: 0 0 auto`、`white-space: nowrap` |
| `map-cell-size` | `data-test-id`（新） | 顶栏图格尺寸标签本体；测试据此断言 `图格尺寸：32px * 32px`、`图格尺寸：48px * 48px`，以及换图后文案跟着变（D-42） |
| `map-sidebar` 宽度断言 | 测试约定（改） | 素材区拿剩余宽度：可用 1200 → 784、2000 → 1584（无上限），600 → 240（只有最小生效）；不再有 520 上限期望（D-41 修订） |
| `?mapViewport=wide` | 删除（`editor-dev/src/main.tsx`） | 视口宽高改由面板控件决定，宿主注入只作初始默认值（D-40） |

---

## Plan 21 — 渲染清晰度与演示数据（D-34 / D-35 / D-36）

**要做什么：** 大地图不再发糊（最近邻 + 按显示分辨率生成缩略纹理），演示数据换成真实四帧自动元件并补上真实通行属性。

| 名称 | 种类 | 用途 |
|------|------|------|
| `buildThumbnail` | 自由函数（改造，`model/thumbnail.ts`） | 缩略纹理尺寸改为「按显示像素 1:1，超过上限才缩」；不再无脑按格子数降采样（D-35） |
| `MAP_THUMBNAIL_MAX_TEXTURE` | 常量（沿用 `MAP_THUMBNAIL_MAX_SIZE`，不新增） | 纹理边长上限 |
| `decodeDataUrlBytes` | 自由函数（新，`editor-dev/src/demo/pngBytes.ts`） | 把 `?inline` 导入的 data URL 解成字节，供演示宿主 seed 真实 PNG（D-34） |
| `DEMO_AUTOTILE_BIG_PNG_URL` | 常量（新） | `autotile1.png` 的 `?inline` 数据地址 |
| `readDemoAutotileBigBytes` | 自由函数（新，`editor-dev/src/demo/mapDemo.ts`） | 把上面那份数据地址解成真实 PNG 字节；seed 与「读图片尺寸」共用这一处，保证两处维度一致 |
| `src/demo/assets/autotile1.png` | 文件（新，二进制） | 真实四帧自动元件素材（384×128） |
| `DEMO_TILE_TABLE` 的 `pass` 字段 | 数据（改） | 演示图块的四方向通行属性（D-36） |

---

## Plan 22 — 快捷栏重做（D-33）

**要做什么：** 收藏格显示「按哪个数字键选它」，图块加描边；最近 / 最常只显示缩略图；收藏只保留拖拽排序。

| 名称 | 种类 | 用途 |
|------|------|------|
| `MAP_FAVORITE_SLOT_KEYS` | 常量（新，`components/MapFavoriteBar.tsx` 内） | 九个收藏位对应的数字键文案：`2`…`9`、`0`；擦除格固定 `1` |
| `.is-favorite` | CSS 类（新） | 收藏格图块的描边，保证键位数字压在深色图块上也看得清 |
| `map-favorite-key-{index}` | `data-test-id`（新） | 收藏格上的槽位键文本（断言「显示的是键位，不是图块编号」） |
| `map-favorite-up-{index}` / `map-favorite-down-{index}` | `data-test-id`（**删除**） | 上下移动按钮；D-33 只保留拖拽 |
| `MapBottomTabs` 里的编号文本 | **删除** | 最近 / 最常不再显示图块编号（D-33） |

---

## Plan 23 — 地图面板自动保存（D-37）

**要做什么：** 地图面板切走、关标签、换图都自动落盘，删掉整套「未保存」弹窗。

| 名称 | 种类 | 用途 |
|------|------|------|
| `MapPanel.onSwitchOut` | 方法（实现，签名不变） | 切走时 `await this.save()`（D-37） |
| `MapPanel.onBeforeClose` | 方法（改造） | 先保存；保存失败返回 `false`（标签保留、提示行显示错误），成功返回 `true`；不再弹窗 |
| `MapPanel.openMap` / `.createMap` / `.addLayer` / `.setMap` | 方法（改造） | 换图前先保存，失败则中止换图（D-37） |
| `MapPanel.requestUnsavedDecision` / `.resolveUnsavedDecision` / `.requestDiscard` | 方法（**删除**） | 自动保存后不再需要「询问 / 放弃」这套机制 |
| `MapUnsavedDialog` / `IMapUnsavedDialogProps` | 组件 / 接口（**删除**，含 `dialogs/index.ts` 的导出） | 弹窗本体（D-37） |
| `MapDialogKind.Unsaved` / `MapUnsavedChoice` | `const enum` 成员（**删除**） | 弹窗的状态与选择枚举 |
| `IMapPanelViewProps.onUnsavedDecision` | 方法成员（**删除**） | 视图不再需要转交「用户按了哪个按钮」 |

---

## Plan 24 — 阶段收口（D-38）

**要做什么：** 重跑机器门禁，再按修订后的九条人工清单在开发宿主里逐条验收；本计划是阶段完成与否的唯一判据。

| 名称 | 种类 | 用途 |
|------|------|------|
| `04.1-24-SUMMARY.md` | 文件（新） | 每条门禁的命令 / 退出码 / 摘要行 + 九条人工判据的结论与证据 |
| 第 1 条人工判据补充 | 验收约定（改） | 窗口拉宽（或缩放调小）时素材区跟着变宽、**没有上限**（明显超过 520），而地图始终是 13×13 × 32 × 缩放（D-41 修订） |
| `04.1-16-PLAN.md` | 保持未完成 | 机器门禁证据保留；人工验收判据由本计划取代（D-38） |

---

## Plan 25 — 接口与命名（UAT 第四轮，纯声明）

**要做什么：** 把第四轮要用的新名字一次定下来：一个共用的标尺厚度常量、地图区宽度含标尺的口径、宿主目录输入里的 Tileset 编号段参数；只改声明，不写实现。

| 名称 | 种类 | 用途 |
|------|------|------|
| `MAP_RULER_SIZE` | **新增**常量（`constants.ts`，值 `20`） | 行列标尺的厚度（像素）。地图区宽度 = 画布宽 + 它；画布画标尺、布局算地图区宽度必须共用同一个值，不再各写一个 20（D-43，U-11 的根因就是宽度没算标尺） |
| `IMapLayout.mapPaneWidth` | 语义修订（JSDoc，不新增成员、签名不变） | 从「地图区像素宽」改为「= 画布宽 + `MAP_RULER_SIZE`」；左右分栏宽度之和即可用宽度（D-43） |
| `ITileCatalogSource.tilesetReserve` | **新增**可选字段（`apps/editor-dev/src/backend/types.ts`） | Tileset 编号段的起点，对应引擎同名配置；缺省 `100000`（D-51） |
| `ITileCatalogSource.tilesetUnit` | **新增**可选字段（同上文件） | 每个编号段的容量，对应引擎同名配置；缺省 `10000`（D-51） |
| `ITileCatalogSource.tilesetBase` | 语义修订 → **标注已废弃**（由 Plan 29 删除） | 旧口径是「每张图从固定基号逐格枚举」，表达不了多张图占用连续编号段，由 `tilesetReserve` + `tilesetUnit` 取代；本计划保留它只为让 `mapDemo.ts` 仍可编译 |

---

## Plan 26 — 地图区结构与比例

**要做什么：** 让地图区变成「标尺 + 画布」一个整体、只有画布内部滚动，把滑块改叫「地图区比例」，并删掉所有最小尺寸兜底。

| 名称 | 种类 | 用途 |
|------|------|------|
| `.emap-map-region` | CSS 类（新） | 地图区外框：位置上下文 + `overflow: hidden`；尺寸 = 标尺 + 画布，它自己不滚（D-43 / U-14） |
| `.emap-ruler-corner` | CSS 类（新） | 左上角 20×20 的交叉点，填上横竖两条标尺交会处的缺口 |
| `map-region` | `data-test-id`（新） | 地图区外框本体；测试据此断言外框尺寸含标尺、且外框不产生滚动条 |
| `MAP_PALETTE_MIN_WIDTH` | 常量 **删除**（本计划执行） | 任何区域都没有最小 / 最大尺寸：素材区宽度 = 可用宽度 − 地图区宽度，可以为 0；挤不下由用户调比例（D-44） |
| `.emap-canvas-scroll` | CSS 类 **删除**（本计划执行） | 旧的外层滚动容器；全局只保留画布内部一个滚动容器（D-43 / U-14） |
| `MapZoomSlider` 的界面文案 | 语义修订（不新增名字） | 「缩放」→「地图区比例」；它是地图区尺寸的唯一驱动。契约不动：字段仍叫 `zoom`、常量仍叫 `MAP_ZOOM_*`、组件仍叫 `MapZoomSlider`（D-45） |

---

## Plan 27 — 素材分类导航（六类同一排）

**要做什么：** Tileset 从「特殊开关」变成普通分类，六项同一排等宽铺满；顺带删掉 `tilesetOpen` 一族状态与回调。

| 名称 | 种类 | 用途 |
|------|------|------|
| `map-category-tileset` | `data-test-id`（新） | Tileset 作为普通分类按钮的落点，与其余五类同一排（D-47） |
| `.emap-category-tileset` | CSS 类 **删除** | Tileset 不再有特殊按钮样式 |
| `map-tileset-toggle` | `data-test-id` **删除** | 旧的独立开关；入口改由 `map-category-tileset` 承担 |
| `IMapCategoryNavProps.tilesetOpen` / `.onToggleTileset` | 成员 **删除** | 导航不再拥有「Tileset 是否展开」这一份状态；`activeCategory` 是当前素材视图的唯一真源（D-47） |
| `IMapMaterialPanelProps.tilesetOpen` / `.onToggleTileset` | 成员 **删除** | 素材区直接按 `activeCategory` 判断是否画 Tileset 视图；`activeCategory` 是当前素材视图的唯一真源（D-47） |
| `IMapPanelViewProps.onToggleTileset` | 方法成员 **删除** | 视图层不再转发开关事件；`activeCategory` 是当前素材视图的唯一真源（D-47） |
| `IMapPanelViewState.tilesetOpen` | 字段 **删除** | 视图状态里不再存「Tileset 是否展开」；`activeCategory` 是当前素材视图的唯一真源（D-47） |
| `MapPanel.toggleTileset` | 方法 **删除** | 面板不再有「进入 / 退出 Tileset 单独视图」的动作；切分类统一走 `MapPanel.selectCategory`（D-47） |

---

## Plan 28 — 收藏拖拽反馈

**要做什么：** 收藏格拖拽时给出看得见的反馈：拖起源降透明度、悬停目标加描边。

| 名称 | 种类 | 用途 |
|------|------|------|
| `.is-dragging` | CSS 类（新） | 拖动源的格子降低不透明度（`0.4`），让用户看清正在搬哪一格（D-48） |
| `.is-drag-over` | CSS 类（新） | 当前悬停的目标格加一圈强调色描边，指示松手后会落在哪（D-48） |

---

## Plan 29 — 演示数据与宿主目录正确性

**要做什么：** 修演示数据的两个数据错误（自动元件连接表、只有一张 Tileset），并把宿主目录的 Tileset 编号改成引擎规则生成，再补一条与引擎对拍的黄金测试。

| 名称 | 种类 | 用途 |
|------|------|------|
| `DEMO_TILESET_2_IMAGE_PATH` | 常量（新，`mapDemo.ts`） | 第二张演示 Tileset 的图片路径（96×96、2×2、每格 48×48，与第一张的 32×32 不同） |
| `encodeDemoTileset2Atlas` | 自由函数（新，`mapDemo.ts`） | 现场编码第二张 Tileset 的 PNG 字节，供演示宿主 seed |
| `DEMO_TILESET_RESERVE` / `DEMO_TILESET_UNIT` | 模块常量（`mapDemo.ts`，`100000` / `10000`） | 演示用的引擎默认编号段参数；第二张图的编号因此从 `110000` 起，证明「多张图占连续编号段」（D-51） |
| `DEFAULT_TILESET_RESERVE` / `DEFAULT_TILESET_UNIT` | 模块常量（`tileCatalog.ts`，`100000` / `10000`） | 宿主没给值时的引擎默认；第 k 张图的起始编号 = `reserve` + 前面各图段数之和 × `unit`，每张图占 `ceil(该图格数 / unit)` 段（按图片格数算，不按图块表条目数算，D-51） |
| `model.autotileGolden.test.ts` | 文件（新） | 与引擎对拍的黄金测试：`0…255` 全部连接值逐一对四块象限矩形，3×4 与 2×3 两种形状都比（D-50） |
| `portMapAutotile` / `portSliceRect` | 该测试内私有函数 | 逐字搬运的引擎 `mapAutotile` / `getSliceRect`；算法本身不改，只用来证明一致 |
| `DEMO_TILE_TABLE` 的连接集合 | 数据修订（不新增名字） | 自动元件改为**只与同类连接**（连接集合为空即「同值连接」），修掉 U-16 的「只连地形 1 / 2」；演示区扩成带一个空洞的 4×3 块，让内角可见（D-49） |

---

## Plan 30 — Tileset 多图视图

**要做什么：** 素材区的 Tileset 视图从「只画第一张图」改成「按目录顺序把每张图左右并排各画一块」，块上有图名、块间一条竖线；一行超宽时由素材区主体横向滚动。

| 名称 | 种类 | 用途 |
|------|------|------|
| `map-tileset-item` | `data-test-id`（新） | 一张 Tileset 图（= 一个块）；测试据此断言「块数 = 目录里的 Tileset 组数」 |
| `.emap-tileset-row` | CSS 类（新） | 横向排布的容器：`display: flex`、`flex-direction: row`、`align-items: flex-start`、`width: max-content`、`min-width: 100%`，且不设 `flex-wrap`——块只排一行，超宽交给素材区主体横向滚动（D-52） |
| `.emap-tileset-block` | CSS 类（新） | 一块（图名 + 一张图）：`flex: 0 0 auto` 不压缩不均分，`display: flex` + `flex-direction: column`（D-52） |
| `.emap-tileset-block + .emap-tileset-block` | CSS 规则（新） | 块与块之间的**竖线**：`border-left: 1px solid var(--editor-border, #d0d7de)`；沿用既有边框颜色变量，不新增颜色体系（D-52） |
| `.emap-material-body` | CSS 类（语义变更） | `overflow-y: auto` → `overflow: auto`：Tileset 一行超出宽度时横向滚动（需要时纵向也滚）（D-52） |
| `.emap-tileset` / `.emap-tileset-scroll` | CSS 类（语义变更） | 从「一张图占满整块 + 自己滚动」改为「内容高度、不出自己的滚动条」；滚动全部交给 `.emap-material-body`（D-52） |
| `IMapTilesetPickerProps` | **不变**（明确登记） | 素材区为每张图各渲染一个选择器，props 形状不变；选择 / 框选 / 多格预览仍按「单张图内」的列 / 行换算（D-52） |

---

## Plan 31 — 最终验证

**要做什么：** 重跑全部机器门禁，再按修订后的清单在开发宿主里逐条验收 U-01…U-24；本计划是阶段能否收口的唯一判据。

| 名称 | 种类 | 用途 |
|------|------|------|
| `04.1-31-SUMMARY.md` | 文件（新） | 每条门禁的命令 / 退出码 / 摘要行 + U-01…U-24 逐条结论与证据（D-53） |

---

## Plan 32 — 图块渲染（图集尺寸 + 一个源格等比贴图）

**要做什么：** 底部三页 / 收藏栏按素材组的真实图集尺寸贴第 0 帧，素材区一个按钮只显示一个源格并按源格宽高比等比缩放；三处共用同一个纯函数。

| 名称 | 种类 | 用途 |
|------|------|------|
| `resolveGroupAtlasRect` | 自由函数（新，`model/tileAtlas.ts`） | 求**整张图集**在源图上的像素矩形（`x` / `y` 恒为 0）。七种布局：Tileset 用自身列 / 行；自动元件 = 整块列数 × 帧数 宽、整块行数 高（高度不含帧数，因为帧只沿横向推进）；横向动画 = 帧数 宽；纵向动画 = 帧数 高；扫描动画 = `ceil(帧数 / 列数)` 行；`Full` = 整图一格的尺寸；普通 `Grid` = 目录列数 × 目录最大行号 + 1。返回既有 `IMapTileCrop`，不新增接口（U-18） |
| `resolveTileBackgroundStyle` | 自由函数（新，`components/tileBackgroundStyle.ts`） | 由「图片地址 + 素材组 + 第 0 帧矩形 + 按钮边长」算出背景样式：整张图集按**一个**倍数缩放（`min(按钮宽 / 源格宽, 按钮高 / 源格高)`，宽高同比），再把这一格居中并负偏移到位。素材区、底部三页、收藏栏三处共用，组件不再自己算图集宽 / 高（U-18 / U-20 / U-21） |
| `MAP_MATERIAL_CELL_SIZE` | 常量（新，`constants.ts`，`32`） | 素材格 / 收藏格的显示边长（像素）。必须与 `map.css` 里 `.emap-material-cell`、`.emap-favorite-slot` 的 `32px` 同源，改它就要同步改 CSS（U-20 / U-21） |
| `model/index.ts` | 桶导出（追加） | 追加 `export * from './tileAtlas';`，与既有「一个模块一行」的顺序一致 |
| `resolveAssetSize` / `atlasWidthOf` / `atlasHeightOf` | 自由函数（**删除**，`MapBottomTabs` / `MapFavoriteBar` 各一对） | 这两个文件原各自私有的三份小函数全部删掉，改调 `resolveTileBackgroundStyle`；保留两份就是 U-18 的复发条件 |
| `backgroundOffset` | 自由函数（**删除**，三个组件各一份） | 偏移改由 `resolveTileBackgroundStyle` 统一给出（含正 / 负 / 0 与两位小数），不再各写一份只处理负值的实现 |

---

## Plan 33 — 交互、通行度叠加层与标尺

**要做什么：** 数字键从画布上移到面板根；通行度箭头变细并保证四向不重叠；不透明度滑块与标签留出间距；标尺纵轴标签顶对齐并按格子边界画刻度线。

| 名称 | 种类 | 用途 |
|------|------|------|
| `resolveFavoriteSlotIndex` | 自由函数（新，`model/favoriteSlot.ts`） | 数字键 → 收藏槽位索引：`1` → 0（擦除）、`2`..`9` → 1..8、`0` → 9（`MAP_FAVORITE_SLOT_COUNT`）、其它 → `undefined`。与 `MapPanel.selectFavoriteSlot` 的槽位口径一致；面板根与单测共用（U-19） |
| `resolvePassArrowLength` | 自由函数（新增，`model/passability.ts`） | 一支通行度箭头从格中心伸出的长度（像素）：`max(2, min(格宽, 格高) / 2 - 1)`，32×32 → 15。从 `MapSurface` 下沉成纯函数，供测试断言（U-23） |
| `resolvePassArrowHeadLength` | 自由函数（新增，`model/passability.ts`） | 箭头头部沿方向占的长度（像素）：`min(MAP_PASS_ARROW_HEAD_LENGTH, 长度 / 2)`，保证很短的小格子里头部仍小于整个箭头（U-23） |
| `MAP_PASS_ARROW_HEAD_LENGTH` | 常量（新，`constants.ts`，`6`） | 箭头头部长度（像素）。取值依据是「32×32 格里四支箭头互不重叠」，不得随意调大（U-23） |
| `MAP_PASS_ARROW_HEAD_HALF_WIDTH` | 常量（新，`constants.ts`，`2.5`） | 箭头头部的一半宽度（像素），整头宽 5px，落在 4–6px 区间（U-23） |
| `.emap-ruler-line` | CSS 类（新，`map.css`） | 标尺上对齐格子边界的刻度线：上标尺从底边起 1px 宽、6px 高；左标尺从右边起 1px 高、6px 宽。只占靠近画布那一侧，不与数字抢位置（U-24） |
| `.emap-opacity-slider` | CSS 类（语义变更） | `margin: 0` → `margin: 0 0 0 10px` 并加 `flex: 0 0 auto`：滑块手柄在最左端会向左溢出约 5px，10px 左间距保证不压住标签；宽度与可操作性不变（U-22） |
| `.emap-ruler-left .emap-ruler-tick` | CSS 规则（语义变更） | 去掉「上移半个行高」的位移，改为顶对齐：左上角纵轴的 `0` 完整落在标尺内，不再被横向标尺切掉一半（U-24） |
| `IMapCanvasProps.onSelectFavoriteSlot` | 成员 **删除** | 槽位数字键改由面板根统一处理；画布只保留 Ctrl+C / Ctrl+V、Escape、F 四种画布专属键（U-19） |

---

## Plan 34 — 接口与命名（U-25，纯声明）

**要做什么：** 给图块目录契约补一个可选字段，让宿主告诉编辑器「这张图片真实有几行图块」；只加声明与文档，不写任何逻辑，最后停下来请用户确认字段名与口径。

| 名称 | 种类 | 用途 |
|------|------|------|
| `IMapTileGroup.rows` | 字段（可选，本计划声明，Plan 35 只赋值） | 来源图片真实的图块行数（= 图片高 ÷ 素材格高），由宿主填入；算整张图集高度时优先用它，缺省才退回「目录最大行号 + 1」。**必须**写明它不是「目录里出现过的最大行号 + 1」，也不是 Tileset 的 `IMapTilesetMeta.rows`（U-25 / D-54） |

---

## Plan 35 — 图集真实行数（U-25）

**要做什么：** 让宿主把「图片真实几行」填进目录，并让「算整张图集多高」改用它，从而修好底部快捷栏 / 收藏栏 / 素材区把相邻图块也画进来、还被纵向压扁的问题；只改实现，不改任何接口形状。

| 名称 | 种类 | 用途 |
|------|------|------|
| `buildTileCatalog` | 自由函数（改造，`editor-dev/src/backend/tileCatalog.ts`） | 给每个素材组填 `rows = max(1, floor(图片高 ÷ cellHeight))`，不管是普通网格、动画、自动元件还是 Tileset |
| `resolveGroupAtlasRect` | 自由函数（改造，`model/tileAtlas.ts`） | 普通 Grid 与横向动画的高度改用 `group.rows`，缺省才退回旧口径；Tileset / 自动元件 / 纵向动画 / 扫描动画 / Full 不变 |
| `model.tileAtlas.test.ts` / `tileCatalog.test.ts` / `mapDemo.test.ts` / `mapView.layout.test.tsx` / `mapView.material.test.tsx` | 测试文件（改造） | 钉住「`tiles-terrain` 只有第 0 行图块时图集仍是 128×64」「底部页 / 收藏栏 / 素材区一格只显示一个 32×32 源格」「其它布局不受影响」 |

---

## Plan 36 — 面板键盘与帧数默认（U-26 / U-27）

**要做什么：** 让数字键 `1` / `2`..`9` / `0` 在整个地图面板内都生效——面板根变成可聚焦，点面板空白处把焦点落到根上；点输入框 / 按钮 / 画布 / 滑块手柄时不抢焦点。同时把素材区「显示帧数」的默认状态改成打开。**不新增任何接口字段。**

| 名称 | 种类 | 用途 |
|------|------|------|
| `ownsKeyboardFocus` | 自由函数（新，`components/MapPanelView.tsx`） | 判断一个事件落点**自己会不会拿焦点**：输入框 / 文本域 / 下拉 / contenteditable，或 `closest` 到 `input, textarea, select, button, a[href], [tabindex], [contenteditable]` 的祖先。为 `true` 时面板根不抢焦点。与既有的 `isTypingTarget`（回答「在打字吗」）**并存不合并**——前者判焦点归属，后者判要不要拦截按键（U-26） |
| `handlePanelPointerDown` | 组件内局部函数（新，`MapPanelView.tsx`） | 面板根的 `pointerdown`：控件自有焦点 → 不动；焦点已在面板内 → 不动（保护滑块手柄与按钮）；否则把焦点落到面板根（`preventScroll`）。这是「点空白处之后数字键才生效」的开关（U-26） |
| 面板根 `tabIndex={-1}` | 属性（新，`MapPanelView.tsx` 的 `data-test-id="map-panel"` 元素） | 让面板根可以被**程序化聚焦**但不进 Tab 顺序；配合上面的 `pointerdown` 使用。不加可见聚焦样式（程序化聚焦不触发 `:focus-visible`）（U-26） |
| `MAP_SHOW_FRAME_COUNT_DEFAULT` | 常量（新，`constants.ts`，`true`） | 素材区「显示帧数」角标的默认状态。面板初始视图状态、视图层缺省回退与测试三处都读它，是默认值的唯一来源（U-27） |

---

## Plan 37 — 大地图缩略逐格渲染（U-28 / U-29）

**要做什么：** 大地图的缩略纹理不再「每格贴一张整格裁切」，而是吃「与普通模式同一套逐格数据」：自动元件拆四块、大 / 小素材按 `contain` 摆放、只用第 0 帧。**不新增接口类型**——缩略格子复用既有的 `IMapRenderCell` / `IMapAutotileQuarters`。

| 名称 | 种类 | 用途 |
|------|------|------|
| `buildThumbnailCells` | 自由函数（新，`model/renderModel.ts`） | 把整份文档按缩略纹理的像素尺寸算成「要铺的格子」：`buildThumbnailCells(document, textureWidth, textureHeight, currentLayerId, aboveLayerOpacity)` → `readonly IMapRenderCell[]`。每格像素 = 纹理边长 ÷ 格数；逐层（zIndex 升序）复用 `createRenderCell`，因此自动元件四块、`contain` 目标矩形、帧信息与普通模式**逐个相等**；跳过空格与目录外编号；非法尺寸返回空数组。返回既有类型，**不新增接口**（U-28 / U-29 / D-57） |
| `MAP_BIG_MAP_AUTOTILE_CELL` | 常量（新，`constants.ts`，`4`） | 大地图缩略里一格的像素边长**小于**它时，自动元件不再拆四块（四块各不足 2px，辨不出，而图元数会翻四倍）。只限制四块展开，`contain` 不受影响。命名与既有 `MAP_BIG_MAP_DOT_CELL` 同族（U-28 / D-57） |
| `paintThumbnailCells` | 私有函数（新，`components/MapSurface.tsx`） | 把 `buildThumbnailCells` 的结果铺进离屏容器：每格取图片纹理 → `resolveCellFrameCrops`（自动元件 4 块 / 其余 1 块，帧号固定为第 0 帧或条目固定帧）→ `createCellSprites`（复用普通模式的象限拆分）（U-28） |
| `resolveCropTextures` | 私有函数（新，`components/MapSurface.tsx`） | 取一组裁切纹理，按「图片路径 + `crop` 的 x / y / width / height」缓存并共享：同一图块、同一连接的许多格子只建一张纹理；新建的纹理推进 `created`，在缩略构建末尾统一销毁（U-28 的性能口径） |
| `collectThumbnailTiles` / `resolveThumbnailTileTexture` / `paintThumbnailLayers` | 私有函数（**删除**，`components/MapSurface.tsx`） | 旧的「每格一张整格裁切」缩略路径，正是 U-28 的根因；保留任何一份都会让大地图重新绕过逐格管线 |

---

## Plan 38 — 小地图缩略铺满、通行度蒙版与面板聚焦框（U-30 / U-31 / U-32）

**要做什么：** 让大地图缩略允许把小于格子的图块放大到铺满（普通模式仍然只缩不放）；给通行度叠加层先铺一层 0.7 纯黑蒙版再画更大的四色箭头；压掉面板根自己的浏览器默认聚焦框。**不新增任何接口字段。**

| 名称 | 种类 | 用途 |
|------|------|------|
| `resolveTileDest` 的 `allowUpscale` | 自由函数**末尾可选参数**（`boolean`，默认 `false`；本计划新增，不是接口字段） | 为 `true` 时允许把小于格子的素材放大到贴满格；只给 `buildThumbnailCells`（大地图缩略）用。普通模式必须保持 `false`，32×32 源图块放进 52×52 格子仍居中留 10px（U-30） |
| `createRenderCell` 的 `allowUpscale` | 模块私有函数**末尾可选参数**（`boolean`，默认 `false`） | 把上面这个开关从缩略路径透传给 `resolveTileDest`；`buildWindowModel` 不传、`buildThumbnailCells` 传 `true`。私有参数，不进入任何接口（U-30） |
| `MAP_PASS_OVERLAY_COLOR` | 常量（新，`constants.ts`，`0x000000`） | 通行度叠加层的纯黑蒙版颜色；先铺蒙版再画箭头（U-31） |
| `MAP_PASS_OVERLAY_ALPHA` | 常量（新，`constants.ts`，`0.7`） | 纯黑蒙版的不透明度，约 0.7（U-31） |
| `resolvePassOverlayRect` | 自由函数（新，`model/passability.ts`） | 返回蒙版要铺的整块矩形 `{ x: 0, y: 0, width: canvasWidth, height: canvasHeight }`；宽高非有限正数时返回全 0。覆盖范围是**整个地图视口**（正常模式 = 画布宽高，大地图 = 整个画布），不是只覆盖有标记的格子（U-31 / OQ18） |
| `MAP_PASS_ARROW_HEAD_LENGTH` | 常量**改值**（`6` → `8`） | 通行度箭头头部沿方向占的长度；比原来大约 2px，仍保证 32×32 格内四支箭头互不重叠（U-31） |
| `MAP_PASS_ARROW_HEAD_HALF_WIDTH` | 常量**改值**（`2.5` → `3.5`） | 箭头头部的一半宽度；整头宽从 5px 改成 7px，比原来大约 2px（U-31） |
| `.emap-panel:focus` / `.emap-panel:focus-visible` | CSS 规则（新，`map.css`） | 面板根只用于接住数字键焦点（`tabIndex=-1`），不是可操作控件，所以不画浏览器默认聚焦框；只作用于面板根自身，输入框 / 按钮 / 画布 / 菜单项的 `:focus-visible` 一律不动（U-32） |
| `declare module '*?raw'` | 类型声明（新，`src/global.d.ts`） | 让测试能以字符串读取 `MapSurface.tsx` 源码，静态断言「蒙版命令先于标记循环」；只给测试用，不是运行时 API（U-31） |

> **命名确认说明：** 以上名称均为提案，用户确认后方可写进代码；若改名，只同步本表与 `04.1-38-PLAN.md`。本计划**不新增接口字段**：`allowUpscale` 是函数签名变化，`*?raw` 是测试声明。

---

## Plan 39 — 工具栏换行与地图区比例控件宽度（U-35）

**要做什么：** 给顶栏第二行的「地图区比例」控件定住最小宽度、让滑块轨道不再被压窄；第二行放不下时整行换行、顶栏变高，而不是继续压缩比例控件。**不新增任何接口字段、props、常量或 `data-test-id`，只加一个 CSS 类名。**

| 名称 | 种类 | 用途 |
|------|------|------|
| `.emap-toolbar-edit-row` | CSS 类（新，`map.css`；只挂在 `MapToolbar` 的第二行） | 让「编辑工具」这一行在放不下时换行、并允许顶栏长高：`flex-wrap: wrap` + `height: auto` + `min-height: 32px` + `overflow: visible`。它必须写在 `.emap-toolbar-row` 之后，靠源顺序覆盖基类的 `flex: 0 0 32px` / `height: 32px` / `overflow: hidden`；第一行不挂这个类，所以顶栏第一行仍然单行（U-35） |
| `.emap-zoom` | CSS 类（语义变更，`map.css`） | 由「固定 `width: 160px`」改成「`min-width: 208px`」：208 = 标签「地图区比例」约 60px + 两个 4px 间隙 + 滑块 96px + 百分比最小 38px（202px）再加余量。这是「比例控件不被别的控件压窄」的唯一落点（U-35） |
| `.emap-zoom-slider` | CSS 类（语义变更，`map.css`） | 由「只有 `width: 96px`」改成「`flex: 0 0 96px` + `width: 96px`」：它作为 flex 子项默认允许收缩，正是轨道被压到约 54px 的直接原因（U-35） |
| `.emap-zoom-label` / `.emap-zoom-value` | CSS 类（语义变更，`map.css`） | 各加 `flex: 0 0 auto`：标签与百分比不参与收缩，宽度只让滑块轨道决定（U-35） |
| `.emap-toolbar` | CSS 类（语义变更，`map.css`） | 由「固定 `flex: 0 0 64px` + `height: 64px`」改成「`flex: 0 0 auto` + `height: auto` + `min-height: 64px`」：两行各 32px 时仍是 64px，第二行换行后自然长高（U-35） |
| `MapToolbar` 第二行的 `className` | 属性值（`MapToolbar.tsx`，`emap-toolbar-row` + `emap-toolbar-edit-row`） | 把换行规则挂到唯一需要换行的那一行；其余 JSX、props、`data-test-id` 一律不动（U-35） |

> **命名确认说明：** 以上名称均为提案，用户确认后方可写进代码；若改名，只同步本表与 `04.1-39-PLAN.md`。本计划**只有一个新名字** `.emap-toolbar-edit-row`（CSS 类），其余都是既有类名的语义修订；**不新增接口字段、props、TS 常量或 `data-test-id`**，`MapZoomSlider.tsx` 与 `constants.ts` 不在改动范围内。

---

## 开放问题口径

> 与 Phase 4 不同，本阶段进入规划时仍有未定项。三条「用户确认」已在 §全局口径 锁定；下表是其余各项的执行口径。

| # | 状态 | 口径 |
|---|------|------|
| OQ1 `.list.jsonc` 的 `type` 字符串与接口字段不一致 | **已定（研究结论）** | 宿主按**样例**读：`"type": "grid" \| "rowAnimate" \| "autotile" \| "tileset"`；`editor-impl` 不需要知道这件事。 |
| OQ2 Tileset 分格尺寸 | **已定（用户）** | 用 Tileset 自身的 `cellWidth / cellHeight`。 |
| OQ3 Tileset 每格编号来源 | **已定（用户）** | 宿主把每个格子枚举进目录（`{ number, column, row }`）。 |
| OQ4 「最近 / 最常」是几页 | **已定（研究结论）** | 三个页签就是 D-20 说的「切换按钮」。 |
| OQ5 视口 13×13 是否持久化 | **已定（研究结论）** | 只由能力注入（`viewportColumns?` / `viewportRows?`），不写盘。 |
| OQ6 `ColumnAnimate` / `ScanAnimate` 是否实现 | **已定（研究结论）** | 纯函数按枚举注释实现并被测试；演示数据只覆盖 `grid` / `rowAnimate` / `autotile` / `tileset`。 |
| OQ7 真实宿主能否自动建 `.editor` 目录 | **已定（用户）** | 保持现状，不新增 `makeDirectory`；写失败静默降级。 |
| OQ8 缩略图重建触发点 | **已定（研究结论）** | 文档引用 + 当前层 + 上层不透明度；视口 / 缩放 / 悬停 / 框选 / 通行度开关不重建。 |
| OQ9 缩放是否影响素材区图标 | **已定（研究结论）** | 不影响；图标固定 32px，只改右栏宽度。 |
| OQ10 收藏拖拽 vs 上下按钮 | **已定（研究结论）** | 先做指针拖拽；jsdom 下不可靠时保留「上移 / 下移」按钮（D-19 允许）。 |
| OQ11 收藏排序是否保留上下按钮 | **已定（用户，UAT 修订）** | 不保留：只做拖拽，删除上下按钮（D-33 覆盖 OQ10 的后半句）。 |
| OQ12 缩放升高时左右两栏往哪边让 | **已定（用户，第二轮：方向 A；第三轮修订：素材区无上限）** | 缩放升高 → 地图区变宽、内容同比变大；素材区拿剩余宽度（基准 320 / 最小 240，**没有最大宽度**）（D-41 修订）。不再有「左列占比」这种按比例分栏的算法。 |
| OQ13 仓库外的 `autotile1.png` 怎么进 CI | **已定（研究结论）** | 复制一份到 `packages/apps/editor-dev/src/demo/assets/autotile1.png` 并以 `?inline` 导入（仓库已有同样做法的先例：`assetDemo.ts` 的字体）；不引用仓库外路径。 |
| OQ14 宿主注入的 `viewportColumns/viewportRows`（含 `?mapViewport=wide`）还有没有用 | **已定（用户，第二轮）** | 只作**初始默认值**；可见格数由面板上的「地图区宽 / 高」决定，且不再有任何查询参数路径——`?mapViewport=wide` 整条删除（D-40）。 |
| OQ15 地图区尺寸以什么为基准 | **已定（用户，第二轮）** | 以 **32×32** 为基准：画布 = 格数 × 32 × 缩放，与地图声明的 `cellWidth/cellHeight` 无关；声明格尺寸仍用于素材切分、`contain` 的源尺寸与文档数据（D-39）。 |
| OQ16 `activeCategory` 与 Tileset 视图的关系 | **已定（用户，第四轮）** | `activeCategory === Tileset` 即 Tileset 视图；`tilesetOpen` 一族（视图状态字段、面板方法 `MapPanel.toggleTileset`、三处 props、`map-tileset-toggle` 测试标识）全部删除（D-47）。 |
| OQ17 图集高度以什么为准 | **已定（用户，第六轮）** | 来源图片的真实行数：宿主按「图片高 ÷ 素材格高」填 `IMapTileGroup.rows`，缺省才退回「目录最大行号 + 1」（D-54）。 |
| OQ18 通行度蒙版盖住哪里 | **已定（用户，第八轮）** | 盖**整个地图视口**：正常模式 = 整个画布，大地图 = 整个画布；不是只盖有标记的格子。理由是「先蒙版、再显示箭头」且整块压暗不会出现斑驳的补丁感；蒙版纯黑、不透明度约 0.7，画在箭头下面（U-31）。 |

---

## 需要用户确认的清单（按重要性排序）

1. **中立图块目录的最终形状**（`IMapTileGroup` 的 `category/read/cellWidth/cellHeight/frames/autotile/tileset`，`IMapTileEntry` 删除 `crop`）—— **one-way**：这是宿主与编辑器的数据契约，改形状要迁移每个宿主实现。
2. **`.editor/map-tiles.json` 的路径与字段**（`recent` / `frequent` / `favorites`，`favorites` 固定 9 格、`1` 键为擦除）—— **costly**：文件一旦写入用户项目，改路径 / 字段要迁移。
3. **接口归属与收紧节奏**（策略编号 **P-01**，规划器提案、不在 CONTEXT.md 的 D-01…D-29 里）—— **reversible**：全部新成员只在 Plan 01 声明（可选），实现计划只消费，Plan 15 单列收紧；决定计划顺序，不影响运行时行为。
4. **布局常量**（地图区宽高默认 13×13、范围 1–64，50–200% 缩放，显示格基准 32，右栏基准 320 / 最小 240，**没有最大宽度**）—— **costly**：会被面板、画布、素材区共同消费（D-39 / D-40 / D-41）。
5. **全部新增命名**（文件 / 类型 / 方法 / 常量 / CSS 类 / `data-test-id`）—— **reversible**：改名只需同步本文件与计划。
6. **顶栏图格尺寸标签的文案与格式**（`图格尺寸：{cellWidth}px * {cellHeight}px`，数字取自文档声明的 `cellWidth` / `cellHeight`；全角冒号，`*` 两侧各一个空格）—— **reversible**：纯显示文案（D-42）。
7. **第四轮新增的名字与两处收敛**（标尺厚度常量 `MAP_RULER_SIZE`、地图区宽度含标尺的口径、宿主目录的 Tileset 编号段参数 `tilesetReserve` / `tilesetUnit`，以及删除 `tilesetOpen` 一族）—— **costly**：宿主目录契约与视图状态同时收敛（D-43 / D-47 / D-51）。
8. **第五轮新增的三个类名**（`.emap-tileset-row` 横向排布容器、`.emap-tileset-block` 单块、`.emap-tileset-block + .emap-tileset-block` 的竖线规则）—— **reversible**：只在 `map.css` 与 `MapMaterialPanel.tsx` 内部使用，改名只影响本文件的登记与一个计划的文案（D-52 修订）。
9. **第六轮新增的七个名字与三处收缩**（`resolveGroupAtlasRect`、`resolveTileBackgroundStyle`、`MAP_MATERIAL_CELL_SIZE`、`resolveFavoriteSlotIndex`、`resolvePassArrowLength`、`resolvePassArrowHeadLength`、`.emap-ruler-line`；常量 `MAP_PASS_ARROW_HEAD_LENGTH` / `MAP_PASS_ARROW_HEAD_HALF_WIDTH`；以及删除 `IMapCanvasProps.onSelectFavoriteSlot`、三个组件里的图集尺寸 / 偏移私有函数）—— **reversible**：全部是 `editor-impl` 内部的纯函数、常量与 CSS 类，改名只影响本文件与 `04.1-32` / `04.1-33` 的文案；删除的画布回调不改变任何对外 props（U-19 / U-23 / U-24）。
10. **`IMapTileGroup.rows` 这个可选字段名与「图集高度取自来源图片真实行数」的口径** —— **costly**：这是宿主目录契约的新增字段，所有宿主实现都要填；改名要同步宿主与测试。
11. **第七轮新增的四个名字与三处删除**（`ownsKeyboardFocus`、`handlePanelPointerDown`、`buildThumbnailCells`、`paintThumbnailCells` / `resolveCropTextures`；常量 `MAP_SHOW_FRAME_COUNT_DEFAULT` / `MAP_BIG_MAP_AUTOTILE_CELL`；删除 `collectThumbnailTiles` / `resolveThumbnailTileTexture` / `paintThumbnailLayers`；面板根加 `tabIndex={-1}`）—— **reversible**：全部是 `editor-impl` 内部的纯函数、私有函数、常量与一个 DOM 属性，改名只影响本文件与 `04.1-36` / `04.1-37` 的文案；**不新增任何接口字段**（缩略格子复用既有 `IMapRenderCell`，因此不需要单独的接口声明计划）。
12. **U-28 的帧与上限口径**（大地图缩略只用第 0 帧；每格小于 4px 时不拆四块但 `contain` 仍生效；「因四块展开而增加」的图元数上界 65,536，「每格一个图元」的既有口径不变）—— **reversible**：只影响大地图的绘制输入，不动数据模型、不动 `buildThumbnail` 的尺寸 / 偏移 / 重建判据。
13. **第八轮新增的名字与三条口径**（`resolveTileDest` 的可选参数 `allowUpscale`、`MAP_PASS_OVERLAY_COLOR` / `MAP_PASS_OVERLAY_ALPHA`、`resolvePassOverlayRect`、箭头头部常量改值 8 / 3.5、`.emap-panel:focus` / `:focus-visible` 无轮廓、测试用 `*?raw` 声明；蒙版覆盖整个视口）—— **reversible**：全部是 `editor-impl` 内部的函数参数、常量与 CSS 规则，改名只影响本文件与 `04.1-38` 的文案；**不新增任何接口字段**（U-30 / U-31 / U-32）。
14. **第九轮新增的一个类名与四处宽度口径**（`.emap-toolbar-edit-row`；`.emap-zoom` 最小宽度 208px、`.emap-zoom-slider` 不收缩、`.emap-zoom-label` / `.emap-zoom-value` 不收缩、`.emap-toolbar` 可增高）—— **reversible**：只在 `map.css` 与 `MapToolbar.tsx` 内部使用，改名只影响本文件与 `04.1-39` 的文案；**不新增接口字段、props、TS 常量或 `data-test-id`**，`MapZoomSlider.tsx` 与 `constants.ts` 不动（U-35）。
