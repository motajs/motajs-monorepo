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
| Tileset 按什么尺寸分格 | 按 **Tileset 自身的** `cellWidth / cellHeight`（来自目录的 `IMapTilesetMeta`）；地图的格子尺寸只决定画到地图上时的缩放。 |
| Tileset 每格编号从哪来 | **宿主把每个格子枚举进目录**（`{ number, column, row }`）；编辑器不引入引擎的编号公式。 |
| `.editor` 目录谁创建 | **保持现状**：由宿主 / 资源层负责，写失败静默降级。**不给 `IEditorPanelContext` 增加 `makeDirectory`。** |

### 2. 过渡期类型策略（P-01，规划器提案：全部声明在 Plan 01，收紧在 Plan 15）

> **P-01 不是 CONTEXT.md 的锁定决策。** `04.1-CONTEXT.md` 只锁定 D-01…D-29；这条过渡策略是规划阶段提出的执行口径，需要在下面的「需要用户确认的清单」里一并确认。

本阶段要改的是**已有的数据契约**，而 Phase 4 的代码与测试已经在用它。为了满足「先接口、后实现」同时保证每个计划结束时整包仍然可编译，策略是：

- **Plan 01 一次性声明本阶段全部新增成员**：新枚举 / 新接口 / 新字段 / 组件 props / 视图状态字段一律先声明为**可选**，`IMapTileEntry.crop` 暂时保留。所谓「全部」包括：`types.ts` 里的数据接口与**七个跨计划接口**（`IMapLayoutOptions`、`IMapZoomSliderProps`、`IMapMaterialPanelProps`、`IMapCategoryNavProps`、`IMapTilesetPickerProps`、`IMapBottomTabsProps`、`IMapFavoriteBarProps`）；`model/renderModel.ts` 里的 `IMapRenderView.zoom` 与 `ITileImage.srcWidth/srcHeight`；三个既有组件 props 的新成员；宿主侧的 `ITileCatalogSource`（`apps/editor-dev/src/backend/types.ts`）。
- **Plan 02–14 只赋值与消费**，任何实现计划都**不得**新增接口成员；消费者按「字段缺省时的默认值」工作（缺省格尺寸为 `MAP_CELL_SIZE`，缺省读取方式为 `Grid`，缺省帧数为 1，缺省帧速为 300，缺省视口 13×13）。
- **Plan 15 是独立的接口终态计划**：删除 `IMapTileEntry.crop`，把 `IMapDocument.cellWidth/cellHeight`、`IMapTileGroup.category/read/cellWidth/cellHeight/frames`、`IMapRenderModel.cellWidth/cellHeight/viewport`、`IMapPanelViewState` 的 9 个新字段改为必填，并只做「按编译错误机械对齐生产者」。

**因此：Plan 02 / 04 / 06 / 07 / 08 / 11 / 12 / 13 / 14 都不再拥有任何接口声明职责。** 若某个实现计划发现还缺字段，必须回到 Plan 01 补声明（并在本文件登记），而不是就地新增。

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
| `IMapTilePreferences` | interface | `.editor` 偏好：`recent`（最近）/ `frequent`（次数表）/ `favorites`（9 格收藏） |
| `IMapAutotileQuarters` | interface | 自动拼接一格要画的四个半格矩形：`lt` / `rt` / `rb` / `lb` |
| `IMapLayout` | interface | 布局结果：视口格数 / 缩放后的格像素 / 画布像素尺寸 / 右栏宽度 |
| `IMapLayoutOptions` | interface（Plan 01 声明，Plan 04 只 import） | 布局输入：缩放、宿主覆盖的视口格数、右栏基准宽度；放在 `types.ts` 而不是 `model/layout.ts`，符合「对外接口归该层 types.ts」 |
| `IMapZoomSliderProps` | interface（Plan 01 声明，Plan 11 只 import） | 缩放滑块 props：当前值、是否禁用、松手后的发布回调 |
| `IMapMaterialPanelProps` | interface（Plan 01 声明，Plan 12 创建组件、Plan 13 接右键收藏） | 右侧素材区 props：目录、图片地址与状态、当前分类、选中、帧数开关、各回调；**含可选 `onFavoriteTile`** |
| `IMapCategoryNavProps` | interface（Plan 01 声明，Plan 12 只 import） | 竖排分类导航 props：当前分类、Tileset 是否展开、选择分类 / 切换 Tileset 的回调 |
| `IMapTilesetPickerProps` | interface（Plan 01 声明，Plan 12 只 import） | Tileset 选择器 props：Tileset 组、图片地址与状态、选中、选择图案 / 重试图片 |
| `IMapBottomTabsProps` | interface（Plan 01 声明，Plan 13 只 import） | 底部三页 props：当前页签、三份编号、图片地址与状态、选中、切页 / 选图案 |
| `IMapFavoriteBarProps` | interface（Plan 01 声明，Plan 13 只 import） | 收藏栏 props：9 格收藏、当前选中、图片地址、选中 / 排序回调与排序禁用位 |
| `IMapRenderView.zoom` | 字段（可选；Plan 01 在 `model/renderModel.ts` 声明，Plan 07 消费） | 缩放倍率；渲染模型据此把文档格尺寸换成像素 |
| `ITileImage.srcWidth` / `.srcHeight` | 字段（可选；Plan 01 在 `model/renderModel.ts` 声明，Plan 02 只赋值） | 图块素材的单格源像素尺寸，contain 与帧矩形都要用 |
| `ITileCatalogSource` | interface（Plan 01 在 `apps/editor-dev/src/backend/types.ts` 声明，Plan 06 只 import） | 宿主目录解析输入：纹理清单文本、图块表文本、图片尺寸表、自动拼接连接表、Tileset 编号起点 |
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
| `IMapRenderModel.cellWidth` / `.cellHeight` | 字段（可选，Plan 15 收紧） | 本帧的格像素度量（唯一度量来源） |
| `IMapRenderModel.viewport` | 字段（可选，Plan 15 收紧） | 本帧视口左上角；叠加层 / 框选 / 预览 / 整条路径用「文档坐标 − viewport」换算到画布坐标 |
| `IMapRenderModel.previewCells` | 字段（可选） | 线模式下整条路径的所有格子（D-14） |
| `IMapRenderModel.thumbnail` | 字段（可选） | 大地图缩略描述（D-11） |
| `IMapPanelViewState.zoom` | 字段（可选，Plan 15 收紧） | 当前缩放（0.5..2）；Plan 08 初始化、Plan 11 消费 |
| `IMapPanelViewState.bottomTab` | 字段（可选，Plan 15 收紧） | 底部当前页签；Plan 08 初始化、Plan 13 消费 |
| `IMapPanelViewState.activeCategory` | 字段（可选，Plan 15 收紧） | 右侧当前分类；Plan 08 初始化、Plan 12 消费 |
| `IMapPanelViewState.tilesetOpen` | 字段（可选，Plan 15 收紧） | 是否切到 Tileset 单独视图 |
| `IMapPanelViewState.showFrameCount` | 字段（可选，Plan 15 收紧） | 素材区是否显示帧数角标 |
| `IMapPanelViewState.favorites` | 字段（可选，Plan 15 收紧） | 9 格收藏（`0` 为空位） |
| `IMapPanelViewState.frequentTiles` | 字段（可选，Plan 15 收紧） | 「最常使用」的展示顺序（已排好序的编号） |
| `IMapPanelViewState.viewportColumns` / `.viewportRows` | 字段（可选，Plan 15 收紧） | 宿主注入的视口格数落进视图状态；缺省 13×13（D-16） |
| `IMapSurfaceProps.document` / `.currentLayerId` / `.aboveLayerOpacity` | 字段（可选） | 大地图缩略纹理的**内容来源与重建输入**：模型在大地图模式只给缩略描述，逐格内容由画布从这三个值自己铺 |
| `IMapSurfaceProps.cellFrameSpeed` | 字段（可选） | 动画帧速（毫秒 / 帧）；缺省 300（D-08） |
| `IMapCanvasProps.aboveLayerOpacity` | 字段（可选） | 转发给 `MapSurface`，供缩略重建判据使用 |
| `IMapCanvasProps.cellFrameSpeed` | 字段（可选） | 转发给 `MapSurface` 的动画帧速 |
| `IMapCanvasProps.viewportColumns` / `.viewportRows` | 字段（可选） | 画布可见框格数；缺省取常量 |
| `IMapCanvasProps.onSetViewport` | 方法成员（可选） | 画布把滚动位置回报给面板（`left, top`） |
| `IMapPanelViewProps.onSetViewport` | 方法成员（可选） | 视图层把画布回报转发给面板 |
| `IMapPanelViewProps.onSetZoom` | 方法成员（可选） | 视图层把缩放值转发给面板 |
| `IMapPanelViewProps.cellFrameSpeed` | 字段（可选） | 宿主注入的帧速，视图层原样下传 |
| `MAP_VIEWPORT_DEFAULT_COLUMNS` / `MAP_VIEWPORT_DEFAULT_ROWS` | 常量 `13` | 默认地图视口格数（允许宿主配置成长方形） |
| `MAP_ZOOM_MIN` / `MAP_ZOOM_MAX` / `MAP_ZOOM_DEFAULT` / `MAP_ZOOM_STEP` | 常量 | `0.5` / `2` / `1` / `0.05` |
| `MAP_PALETTE_BASE_WIDTH` / `MAP_PALETTE_MIN_WIDTH` / `MAP_PALETTE_MAX_WIDTH` | 常量 | 右栏基准宽度 / 最小可用宽度 / 最大宽度 |
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
| `src/map/model/autotile.ts` | 文件 | 8 方向连接 + 3×4 / 2×3 四分之一块矩形 |
| `computeAutotileConnection` | 自由函数 | 由同层格子值与宿主注入的连接集合算出 8 位连接数（地图外视为已连接，逐字复刻引擎掩码） |
| `resolveAutotileQuarters` | 自由函数 | 由自动拼接类型与连接数算出 `lt` / `rt` / `rb` / `lb` 四个半格矩形 |
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

**要做什么：** 让开发宿主真的从引擎文件生成图块目录，并把那张「整片红」的 1×1 演示图换成五张有区分度的真实图集（含六类素材、动画、两种自动元件、Tileset），再补一张 256×256 演示地图。

| 名称 | 种类 | 用途 |
|------|------|------|
| `packages/apps/editor-dev/src/backend/tileCatalog.ts` | 文件 | 宿主适配器：读纹理清单 + 图块表，生成中立图块目录 |
| `buildTileCatalog` | 自由函数 | 由纹理清单文本、图块表文本、图片尺寸查询与连接规则生成 `readonly IMapTileGroup[]` |
| `ITileCatalogSource` | interface（Plan 01 在 `apps/editor-dev/src/backend/types.ts` 声明，本计划只 import） | 解析输入：两份文本 + 读图片尺寸的函数 + 自动拼接连接表 |
| `encodeDemoTileAtlas` / `encodeDemoAnimateAtlas` / `encodeDemoAutotileBigAtlas` / `encodeDemoAutotileSmallAtlas` / `encodeDemoTilesetAtlas` | 自由函数（演示） | 在 `mapDemo.ts` 内编码五张真实 PNG：128×64 地形、128×32 动画（4 帧）、192×128 与 128×96 自动元件（各 2 帧）、128×64 Tileset（算法与 `assetDemo.ts` 同形，**不修改** `assetDemo.ts`） |
| `DEMO_TEXTURE_LIST_TEXT` / `DEMO_TILE_TABLE_TEXT` | 常量 | 演示用的引擎格式文本（`.list.jsonc` / `tile.jsonc` 形状），供 `buildTileCatalog` 解析 |
| `buildDemoTileCatalog` | 自由函数（演示） | 把演示图集尺寸 + 两份文本 + 连接规则交给 `buildTileCatalog`，返回六类目录 |
| `packages/apps/editor-dev/src/backend/__tests__/tileCatalog.test.ts` | 文件 | 分类映射、读取方式、帧数、自动拼接连接、Tileset 逐格编号、畸形数据 |
| `packages/apps/editor-dev/src/__tests__/mapDemo.test.ts` | 文件 | G-04-1 收口：五张图集尺寸、所有裁切在图内、六类齐全、动画 4 帧、Tileset 8 格、256×256 地图存在 |

---

## Plan 07 — 渲染模型收口

**要做什么：** 让「一帧要画什么」这件事把所有新能力都算进去：格尺寸、动画帧、自动拼接四块、整条路径预览、大地图缩略。

| 名称 | 种类 | 用途 |
|------|------|------|
| `IMapRenderView.zoom` | 字段（Plan 01 已声明，本计划只读） | 缩放倍率；渲染模型据此把文档格尺寸换成像素 |
| `IMapRenderModel.previewCells` | 字段（Plan 01 已声明；本计划输出空数组，Plan 09 的画布在本地覆盖成整条路径） | 整条路径要预览的格子；生产者在 Plan 09，不在视图参数里 |
| `IMapRenderModel.viewport` | 字段 | 透传视口左上角；画布据此把叠加层从文档坐标换算到画布坐标 |
| `IMapRenderModel.thumbnail` | 字段 | 大地图模式下替代逐格 `cells` 的缩略描述 |
| `IMapRenderCell.frameColumns` | 字段 | `ScanAnimate` 用：一行有多少格，帧号才能换算行列 |
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
| `MapPanel.selectFavoriteSlot` | 方法 | 选中收藏格；`1` 键固定为擦除 |
| `MapPanel.reorderFavorites` | 方法 | 收藏排序落盘 |

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
| `buildStrokeWrites` | 已有函数（复用） | 由手势路径算出这一笔的写入；预览取它的去重格子集合 |

---

## Plan 10 — Pixi 渲染（G-04-2）

**要做什么：** 画布按模型里的度量画，不再到处写死 32；动画只在动画格上换帧；自动拼接用 4 个半格拼；大地图只画一张缩略纹理；通行度改成四个不同颜色的箭头；线模式把整条路径画出来。

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
| `IMapPanelViewProps.cellFrameSpeed` | 字段（Plan 01 声明） | 宿主帧速，视图原样下传给画布 |
| `.emap-main` | CSS 类 | 左列：工具栏 + 地图 + 底部三页 |
| `.emap-side` | CSS 类 | 右列：素材区 |
| `.emap-zoom` | CSS 类 | 缩放滑块容器 |
| `map-main` / `map-sidebar` / `map-zoom` | `data-test-id` | 左列 / 右列 / 缩放滑块 |
| `MapViewportButtons` | **删除** | 工具栏四向按钮组件（D-13） |

---

## Plan 12 — 右侧素材区（D-05 / D-18 / D-21 / D-22）

**要做什么：** 右侧按六类展示素材：普通五类竖排、Tileset 单独开关；普通素材逐格显示第一帧、方角框、可选帧数角标；Tileset 整图分格、可框选多格。

| 名称 | 种类 | 用途 |
|------|------|------|
| `src/map/components/MapMaterialPanel.tsx` | 文件 | 右侧素材区容器：按当前分类渲染素材网格、缺图占位、重试入口 |
| `IMapMaterialPanelProps` | interface（Plan 01 已声明，本计划只 import 并创建组件） | 素材区 props：目录、图片地址 / 状态、当前分类、选中、帧数开关、回调 |
| `src/map/components/MapCategoryNav.tsx` | 文件 | 竖排五类导航（Terrains / Enemy / Npc / Item / Autotile）+ Tileset 单独开关 |
| `IMapCategoryNavProps` | interface（Plan 01 已声明，本计划只 import） | 导航 props：当前分类、Tileset 是否展开、回调 |
| `src/map/components/MapTilesetPicker.tsx` | 文件 | Tileset 整图 + 分割线 + 单格 / 框选多格 → 图案 |
| `IMapTilesetPickerProps` | interface（Plan 01 已声明，本计划只 import） | Tileset 选择器 props：Tileset 组、图片地址 / 状态、选中、回调 |
| `.emap-category-nav` / `.emap-category-item` | CSS 类 | 竖排分类 |
| `.emap-tileset` / `.emap-tileset-grid` | CSS 类 | Tileset 整图与分格层 |
| `.emap-tile-frames` | CSS 类 | 帧数角标 |
| `map-category-{terrain\|enemy\|npc\|item\|autotile}` | `data-test-id` | 五个分类按钮 |
| `map-tileset-toggle` / `map-tileset-grid` | `data-test-id` | Tileset 开关 / 整图分格 |
| `map-material-grid` | `data-test-id` | 普通素材网格 |
| `map-tile-{number}` | `data-test-id` | 单个普通图块格子（右键收藏与点选的落点） |
| `map-tile-frames-{number}` | `data-test-id` | 单格帧数角标 |
| `MapPalette.tsx` / `mapView.palette.test.tsx` | **删除** | 旧的 240px 三段式调色板与其测试，被本计划取代 |

---

## Plan 13 — 底部三页与收藏（D-19 / D-20）

**要做什么：** 地图下方做「最近使用 / 最常使用 / 收藏」三页；收藏固定 1=擦除 + 9 格，右键收藏，可拖拽排序，跨会话记住。

| 名称 | 种类 | 用途 |
|------|------|------|
| `src/map/components/MapBottomTabs.tsx` | 文件 | 底部三页容器：页签切换 + 当前页的编号网格 |
| `IMapBottomTabsProps` | interface（Plan 01 已声明，本计划只 import） | 三页 props：当前页签、三份编号、图片地址 / 状态、选中、回调 |
| `src/map/components/MapFavoriteBar.tsx` | 文件 | 1 个擦除格 + 9 个收藏格；拖拽 / 上下按钮排序 |
| `IMapFavoriteBarProps` | interface（Plan 01 已声明，本计划只 import） | 收藏栏 props：收藏数组、当前选中、切图、排序、选中回调 |
| `MapPanel.addFavorite` | 方法 | 右键把普通图块放进第一个空收藏位；已收藏则忽略；满了替换第 9 位 |
| `IMapMaterialPanelProps.onFavoriteTile` | 方法成员（`IMapMaterialPanelProps` 由 Plan 01 在 `types.ts` 声明，本计划只接线） | 素材区把「右键某个图块」这件事上报给面板 |
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

---

## 需要用户确认的清单（按重要性排序）

1. **中立图块目录的最终形状**（`IMapTileGroup` 的 `category/read/cellWidth/cellHeight/frames/autotile/tileset`，`IMapTileEntry` 删除 `crop`）—— **one-way**：这是宿主与编辑器的数据契约，改形状要迁移每个宿主实现。
2. **`.editor/map-tiles.json` 的路径与字段**（`recent` / `frequent` / `favorites`，`favorites` 固定 9 格、`1` 键为擦除）—— **costly**：文件一旦写入用户项目，改路径 / 字段要迁移。
3. **接口归属与收紧节奏**（策略编号 **P-01**，规划器提案、不在 CONTEXT.md 的 D-01…D-29 里）—— **reversible**：全部新成员只在 Plan 01 声明（可选），实现计划只消费，Plan 15 单列收紧；决定计划顺序，不影响运行时行为。
4. **布局常量**（13×13 默认视口、50–200% 缩放、右栏基准 / 最小 / 最大宽度）—— **costly**：会被面板、画布、素材区共同消费。
5. **全部新增命名**（文件 / 类型 / 方法 / 常量 / CSS 类 / `data-test-id`）—— **reversible**：改名只需同步本文件与计划。
