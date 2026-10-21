# Phase 4 — 接口与命名确认 / 地图编辑

**Status:** **待用户确认** —— 本文所有名称与开放问题决议均为**提案**。用户确认前，只允许落「纯类型声明」与「本文件」，不得写实现（项目规则：重要命名先确认）。
**Scope:** 本阶段新增 / 改动的全部对外名称（文件名、接口名、方法名、字段名、导出符号、CSS 类名、`data-test-id`）与 12 个开放问题的最终口径。前序阶段已锁定的名称不重复登记。
**约定:** 类上的方法一律写成 `类名.方法名`（如 `MapPanel.save`）；自由函数写裸名。每个名字都先说明「它是干什么的」，再给名字。

> 读法：每个 Plan 一节。先一句话说明「这个计划要做什么」，再列出它引入 / 改动的名字及**用途**。
> 若某个名字不合适，直接在对话里指出；改名后再进入执行。

> **渲染模型归属（全阶段唯一口径）：** `buildMapRenderModel` **只由视图层 `MapPanelView` 调用**——每次渲染用「当前视图状态 + `passMarks`」现算一份 `IMapRenderModel`。`MapPanel` 只保存文档与视图状态，**不计算、也不缓存**渲染模型；`MapCanvas` / `MapSurface` 只消费传进来的模型。04-04 起就按这条写；04-12 把画布换成 `MapCanvas` 时只换消费方，不改变归属。

> **「空目录不能落笔」的唯一判据：** `isTileCatalogEmpty(document)`（`model/document.ts`，04-03）。为真时 `MapPanel.commitCells` 直接返回（不写文档、不登记撤销、不置脏），`MapPanelView` 把 `canPaint = !isTileCatalogEmpty(view.document)` 传给 `MapCanvas`（画布不进入落笔手势）。**只看目录结构、不看图片字节**：图片读取失败仍可落笔（画占位格，OQ2）。

---

## Plan 04-01 — 命名报告 + 地图域类型（纯声明）

**要做什么：** 先把「地图」这一层的数据形状、宿主注入面、面板状态与动作全部写成类型；不写任何逻辑。

| 名称 | 种类 | 用途 |
|------|------|------|
| `src/map/types.ts` | 文件 | 地图能力的类型集中地：中立文档 / 图块目录 / 宿主能力 / 面板状态 / 撤销载荷 / 渲染模型 |
| `src/map/constants.ts` | 文件 | 面板级裸常量（格子边长、默认尺寸、最近使用路径与上限、文案） |
| `src/map/index.ts` | 桶文件 | `@motajs/editor-impl/map` 子路径入口；本计划只导出类型与常量 |
| `IMapDocument` | interface | 宿主解析好的**整份中立地图文档**：标识、显示名、宽高、图层、图块目录。面板只认这份东西，不认识文件格式与路径 |
| `IMapLayer` | interface | 一个命名图层：标识、显示名、`zIndex`（宿主给定顺序，越小越靠下）、是否事件层（只影响通行度显示）、`[y][x]` 数字格子 |
| `IMapTileGroup` | interface | 宿主算好的一个图块分组：标识、名称、图片相对路径、图集列数、图块列表 |
| `IMapTileEntry` | interface | 一个图块：格子里的编号、图集内列 / 行（多格图案按它查表，不靠编号连续）、像素裁切、名称、通行属性 |
| `IMapTileCrop` | interface | 源图片上的像素裁切矩形（`x` / `y` / `width` / `height`） |
| `IMapTilePass` | interface | 一个图块的通行属性，字段固定为 `out`（可离开方向）/ `in`（可进入方向）/ `onlyEventLayer`（是否只在事件层生效）；两个方向字段都是 `IMapDirections` |
| `IMapDirections` | interface | 四个方向的布尔值（`up` / `right` / `down` / `left`）；**不是**引擎位掩码 |
| `IMapSize` | interface | 宽高（格子数） |
| `IMapSizeLimit` | interface | 宿主注入的地图尺寸上限（`maxWidth` / `maxHeight`） |
| `IMapSummary` | interface | 地图清单里的一条（`id` + `name`），面板不解释 `id` |
| `IMapCreateRequest` | interface | 新建地图请求（名称 / 宽 / 高 / 初始图层名），由宿主执行创建 |
| `IMapDataSection` | interface | 保存地图数据域时交给宿主的整份数据（标识 / 宽 / 高 / 图层） |
| `IMapEditorCapabilities` | interface | 宿主注入面：列清单、打开、保存数据域、新建、加层、读 / 存属性、属性 Schema、尺寸上限、最近使用路径 |
| `IMapEditorCapabilities.listMaps` | 方法 | 列地图清单（面板只拿 `id` + `name`） |
| `IMapEditorCapabilities.openMap` | 方法 | 打开一张地图 → 中立文档 |
| `IMapEditorCapabilities.saveMapData` | 方法 | 保存地图数据域（整张地图的几何）；宿主负责保留未展示的事件与额外字段 |
| `IMapEditorCapabilities.createMap` | 可选方法 | 宿主新建地图并返回新文档；缺省时「新建地图」入口禁用 |
| `IMapEditorCapabilities.addLayer` | 可选方法 | 宿主新增图层并返回更新后的文档；缺省时「新增图层」入口禁用 |
| `IMapEditorCapabilities.readProperties` | 可选方法 | 读整份地图属性表 |
| `IMapEditorCapabilities.saveMapProperties` | 可选方法 | 保存整份地图属性表（不是逐字段补丁） |
| `IMapEditorCapabilities.propertiesSchema` | 可选字段 | 地图属性表单的 JSON Schema；缺省时「地图属性」入口禁用 |
| `IMapEditorCapabilities.maxMapSize` | 可选字段 | 地图尺寸上限；缺省表示不限制 |
| `IMapEditorCapabilities.recentTilesPath` | 可选字段 | 覆盖最近使用文件的约定路径 |
| `IMapPanelTarget` | interface | 打开面板时可带的目标：只含 `mapId` |
| `IMapPanelParam` | interface | 面板工厂参数的扩展位：`target?: IMapPanelTarget` |
| `IMapPanel` | interface | 面板对外动作面：`setMap` / `save` |
| `MapPanelStatus` | `const enum` | 面板状态：未打开 / 清单加载 / 清单失败 / 无地图 / 地图加载 / 就绪 / 失败 |
| `MapBrushMode` | `const enum` | 画笔模式：线 / 矩形 / 填充 |
| `MapUndoType` | `const enum` | 撤销记录种类：格子 / 属性 / 屏障 |
| `MapPaletteKind` | `const enum` | 调色板选中种类：空（擦除）/ 图块 / 最近使用 |
| `MapDialogKind` | `const enum` | 面板当前打开的受控弹窗：无 / 新建地图 / 新增图层 / 未保存确认（`None` / `New` / `Layer` / `Unsaved`）；最近使用清空确认由调色板自己持有，不进面板状态 |
| `MapUnsavedChoice` | `const enum` | 未保存弹窗上用户按了哪个按钮：`SaveAndContinue`（保存并继续）/ `Discard`（放弃改动）/ `Cancel`（取消）。它是「用户的选择」，不是「面板的结论」——面板据此决定是否继续原操作 |
| `MapGestureKind` | `const enum` | 画布当前手势：`None` / `Paint`（左键落笔）/ `Marquee`（右键框选）。用枚举而不是字符串（项目规则：状态名不用字符串字面量） |
| `MapImageStatus` | `const enum` | 一组图块图片的读取状态：`Loading` / `Ready` / `Error`；调色板按它切换「正在加载图块…」/ 网格 / 「图块加载失败」+ 重试 |
| `IMapBrushPattern` | interface | 笔刷图案：宽高 + 行主序编号（0 表示空），多格选择与「空」共用这个形状 |
| `IMapPaletteSelection` | interface | 当前调色板选中：种类 + 图案 + 主图块编号（用于最近使用） |
| `IMapRect` | interface | 格子矩形（`x` / `y` / `width` / `height`） |
| `IMapCellPosition` | interface | 格子坐标（`x` / `y`） |
| `IMapCellChange` | interface | 单格变化（`x` / `y` / `before` / `after`），撤销与保存的最小单位 |
| `IMapClipboard` | interface | 面板内部剪贴板：只存当前图层的数字块（宽 / 高 / 行主序编号） |
| `IMapViewport` | interface | 视口左上角所在的格子坐标（`left` / `top`） |
| `IMapCellsUndoData` | interface | 格子撤销载荷：地图标识 + 图层标识 + 净变化列表 |
| `IMapPropertyUndoData` | interface | 属性撤销载荷：地图标识 + 字段路径 + 旧值 + 新值 |
| `IMapRenderModel` | interface | 一帧要画什么（纯数据）：画布尺寸、格子、网格线、通行度标记、框选、预览、悬停 |
| `IMapRenderCell` | interface | 一个要画的格子：稳定 key、目标像素矩形、透明度、是否缺图，以及**可选**的图片路径与裁切（`imagePath?` / `crop?` 同时缺省 = 空格子，画棋盘格底；`missing = true` 且无图 = 目录里查不到的编号） |
| `IMapRenderGridLine` | interface | 一条网格线（`x` / `y` / `length` / `vertical`） |
| `IMapPassMark` | interface | 一个格子上的通行度标记：坐标、不可通行方向、是否降级为红点 |
| `IMapPreview` | interface | 绘制预览：覆盖的格子矩形 + 图案尺寸 |
| `IMapPanelViewState` | interface | 面板视图状态（清单 / 文档 / 当前层 / 调色板 / 最近 / 画笔 / 开关 / 选区 / 剪贴板 / 脏 / 保存 / 对话框）；必须含 `paletteSelection`、`recentTiles`、`recentStatus`、`dialog`（`MapDialogKind`）、`dialogError`、`paletteVersion`（图块图片重试计数，递增即重新取字节）、`propertiesOpen`（地图属性抽屉是否打开）、`passMarks`（面板算好的通行度标记，供渲染模型消费）、`aboveLayerOpacity`（高于当前层的图层统一不透明度，0..1）。**这些字段一律由本计划一次声明**，后续计划只读写、不再改 `types.ts` |
| `MAP_PANEL_TYPE_ID` | 常量 `'map'` | 面板类型标识；装配方引用它而不各写字符串 |
| `MAP_CELL_SIZE` | 常量 `32` | 一格 32px（像素画基准，不缩放） |
| `MAP_DEFAULT_WIDTH` / `MAP_DEFAULT_HEIGHT` | 常量 `32` | 新建地图的默认宽 / 高 |
| `MAP_DEFAULT_LAYER_NAME` | 常量 `'图层 1'` | 新建地图的默认初始图层名 |
| `MAP_RECENT_TILES_PATH` | 常量 `'.editor/map-recent-tiles.json'` | 最近使用图块的项目内约定文件路径（OQ6） |
| `MAP_RECENT_TILES_KEY` | 常量 `'tiles'` | 该文件的字段名 |
| `MAP_RECENT_TILES_LIMIT` | 常量 `24` | 最近使用条目上限 |
| `MAP_BIG_MAP_DOT_CELL` | 常量 `16` | 大地图模式下格边长小于该值时，通行度改用红点 |
| `MAP_BIG_MAP_MAX_SPRITES` | 常量 `12000` | 大地图模式一次最多构建的图元数（性能阈值，实现常量，不进对外契约） |
| `MAP_ABOVE_LAYER_DEFAULT_OPACITY` | 常量 `0.3` | 高于当前图层的图层统一不透明度的默认值（滑块初值） |
| `MAP_SAVED_MESSAGE` | 常量 `'已保存'` | 保存成功后提示行文案 |
| `MAP_UNDO_BLOCKED_MESSAGE` | 常量 `'无法撤销'` | 撤销命中屏障时的提示文案（地图能力自持一份，不 import 其它能力） |

> 说明：`IMapEditorCapabilities` 落在 `src/map/types.ts`，不放 `src/react/`。理由：开发宿主直接从 `@motajs/editor-impl/map` 取类型；地图能力没有像素材那样被别的能力（表格）反向引用，因此不需要进中立接缝层。

---

## Plan 04-02 — 跨包接口声明：关闭前钩子 + 表单模式

**要做什么：** 只往两个既有接口上加**可选**成员：面板能被问「现在能关吗」，表格表单能被要求「只显示字段行」。本计划不写行为。

| 名称 | 种类 | 用途 |
|------|------|------|
| `IEditorPanel.onBeforeClose` | 可选方法 `(): Promise<boolean>` | 用户主动关闭承载此面板的标签时询问面板；`true` = 允许关闭，`false` = 取消。**one-way 决策**，见下方 Plan 04-02 决议 |
| `ITableGridProps.formMode` | 可选成员 `boolean` | `true` 时只渲染字段行与值控件，不渲染表格工具栏与 Schema 横幅；供地图属性抽屉复用同一套表单（D-15 / UI-SPEC F11） |
| `ShellSystem.closeTab` | 方法（行为扩展，实现在 Plan 04-15） | 关闭前先激活目标标签、再调用 `onBeforeClose`；内部释放路径（`dispose` / `unregisterPanelType` / `closePanelInstance`）不询问 |

> 备选名（若用户不同意）：`formMode` → `showToolbar?: boolean`；`onBeforeClose` → `beforeClose?`。改名只影响本表与三个实现计划。

---

## Plan 04-15 — 内核行为：关闭标签前先问一句（接口确认之后）

**要做什么：** 只实现 Plan 04-02 已声明的关闭前钩子在外壳里的调用时序：用户点 ✕ 时先激活目标标签、再问 `IEditorPanel.onBeforeClose`，回答「不能关」就什么都不做；释放路径永不询问（注销类型改走非询问的 `ShellSystem.discardTab`）。本计划**不改任何接口签名**，只补行为与一条 core 测试。

> 为什么单独一个计划：项目规则「先接口、后实现」不允许同一个计划里既声明接口又写它的实现。接口与 `checkpoint:decision` 留在 04-02，行为在这里落地。

| 名称 | 种类 | 用途 |
|------|------|------|
| `ShellSystem.closeTab` 的询问时序 | 实现（`shellSystem.ts` 内） | 命中实现钩子的标签：先 `activateTab` → `await onBeforeClose()`；`false` 立即返回不释放；钩子抛错记日志并按「取消关闭」处理；询问通过后交给 `ShellSystem.discardTab` 收尾 |
| `ShellSystem.discardTab` | 私有方法（`shellSystem.ts` 内） | 非询问的关闭路径：释放实例、移除标签、空表时开空白标签、按邻位规则切换活动标签（`wasActive` 在它自己开头重算）。`ShellSystem.closeTab` 只在询问通过后调它，`ShellSystem.unregisterPanelType` 直接用它关掉该类型的标签——注销与释放永远碰不到 `IEditorPanel.onBeforeClose` |
| `shell.beforeCloseFailed` | 日志键（`logger` 调用参数） | 钩子抛错时记录一条日志；不新增日志基建，只沿用既有键风格 |
| `src/shell/__tests__/shellClose.test.ts` | 文件 | 覆盖允许 / 取消 / 后台标签先激活 / 后台标签同意后活动标签落位 / 抛错取消 / 未实现钩子直关 / 注销类型不询问 / 释放路径不询问 |

---

## Plan 04-03 — 纯模型：文档与渲染模型

**要做什么：** 把「地图文档怎么校验 / 怎么不可变写入 / 一帧画什么」写成不依赖 React、不依赖 Pixi 的纯函数，并用测试钉住。

| 名称 | 种类 | 用途 |
|------|------|------|
| `src/map/model/document.ts` | 文件 | 中立文档的校验与不可变写入 |
| `isMapDocumentValid` | 函数 | 宽高为正、至少一层、每层 `[y][x]` 行列数与宽高一致、每格为非负整数 |
| `applyCellChanges` | 函数 | 把一组格子变化应用到文档，返回新文档；只复制被触及的行与层数组，不整图复制 |
| `collectNetCellChanges` | 函数 | 把一笔里重复落到的格子合并成净变化（后写覆盖先写，`before === after` 的丢弃） |
| `isTileCatalogEmpty` | 函数 | 判断文档的图块目录里**是否一个图块都没有**（无分组、或所有分组都空）；它不看图片字节，「不能落笔」的守卫、调色板空态与画布的 `canPaint` 都以它为唯一判据 |
| `src/map/model/renderModel.ts` | 文件 | 纯渲染模型：把文档 + 视图状态算成一帧要画的数据 |
| `IMapRenderView` | interface | 渲染模型的输入：画布尺寸、当前层、视口、是否大地图、框选、预览、悬停、通行度标记（由通行度模型算好后传入） |
| `buildMapRenderModel` | 函数 | 输出可见格、层序与透明度、网格线、框选、预览、悬停、通行度标记（大地图缩小时改红点）。**唯一调用方是 `MapPanelView`**，面板不调用、不缓存 |
| `src/map/model/index.ts` | 桶文件 | 模型层统一出口（逐计划追加 `export *`） |
| `src/map/index.ts`（04-03 追加 `./model`） | 桶文件（增量） | 模型层落地后立刻追加 `export * from './model';`，让 `@motajs/editor-impl/map` 在本波即可解析模型导出；不能等到 04-14 收口，否则 04-13 与 04-14 形成循环依赖 |
| `src/map/__tests__/fixtures.ts` | 文件 | 地图测试自持的文件系统替身（能力互不依赖门禁，不能 import 表格 / 素材的）、`createMapHarness`、文档与图块目录夹具 |
| `FakeFileSystem` | 类 | 内存文件系统替身：`seed` / `failing` / `hanging` 三个开关表达「正常 / 读失败 / 挂起」 |
| `createMapHarness` | 函数 | 组装 `EditorCore` + 替身并初始化，返回可直接开面板的核心 |

---

## Plan 04-04 — Tracer：打开 → 渲染 → 画一格 → 保存

**要做什么：** 用一条最短路径把「宿主给地图 → 面板显示 → 鼠标画一格 → 交回宿主」整条链路打通并落一条测试；后续计划都在这条链路两侧加厚。

| 名称 | 种类 | 用途 |
|------|------|------|
| `src/map/mapPanel.ts` | 文件 | `MapPanel` 类：数据与状态接线（本计划只有打开 / 画一格 / 保存） |
| `MapPanel` | 类（`implements IEditorPanel, IMapPanel`） | 面板本体；视图通过 props 调它 |
| `MapPanel.setMap` | 方法 | 设定当前地图（打开参数 / 外部定位）并加载 |
| `MapPanel.openMap` | 方法 | 调宿主 `openMap` 拿中立文档，成功后切到就绪、当前层取第一层 |
| `MapPanel.commitCells` | 方法 | 提交一笔格子净变化：不可变写入 + 一条撤销记录 + 重算脏状态。**先判 `isTileCatalogEmpty`**：目录里一个图块都没有时直接返回（不写文档、不置脏、不登记撤销） |
| `MapPanel.save` | 方法 `(): Promise<boolean>` | 手动保存有改动的域（本计划只有地图数据域）；`true` = 全部成功。返回值供「保存并继续」判断是否继续原操作 |
| `src/map/mapPanelType.ts` | 文件 | 把宿主能力闭包进面板类型的工厂 |
| `createMapPanelType` | 函数 | `createMapPanelType(capabilities)` → 冻结的面板类型对象；顶层负责注册，能力包不自行装配 |
| `src/map/components/MapPanelView.tsx` | 文件 | 面板视图根：状态 → 组件装配（本计划只有画布 + 保存入口） |
| `MapPanelView` | 组件 | 只接 props（视图状态 + 回调），不 import 面板类 |
| `src/map/components/MapSurface.tsx` | 文件 | 唯一 Pixi 入口：应用生命周期 + 按渲染模型重建场景 |
| `MapSurface` | 组件 | 挂载 / 卸载 Pixi 应用，缓存放组件 ref，**不做模块级缓存** |
| `src/map/components/useMapObjectUrl.ts` | 文件 | 按资源路径取图片字节并生成 blob URL 的同形小 hook（不能 import 素材的同名 hook） |
| `src/map/components/index.ts` | 桶文件 | 组件层统一出口：04-04 首次创建并导出 `MapPanelView` / `MapSurface`；04-10 追加 `MapToolbar` / `MapEmptyState` / `MapStatusBar`，04-11 追加 `MapPalette`。hook 按文件路径引用，不进组件桶 |
| `src/map/index.ts`（04-04 追加 `./components` / `./mapPanel` / `./mapPanelType`） | 桶文件（增量） | 让 `@motajs/editor-impl/map` 在 04-04 结束即可导入 `createMapPanelType` 与 `MapSurface`（wave 12 的开发宿主接入不必等 04-14）；`./components` 必须排在 `./mapPanel` 之前，避免「面板 → 组件 → 面板」的桶循环 |
| `useMapObjectUrl` | hook | 按「路径 + 版本」重新拉字节、卸载时 revoke |
| `__tests__/mapTracer.test.tsx` | 文件 | 端到端 tracer：宿主注入地图 → 面板渲染 → 画一格 → 保存回宿主 |
| `__tests__/mapPanel.test.tsx` / `mapSave.test.tsx` / `mapDialogs.test.tsx` / `mapProperties.test.tsx` | 文件 | 面板数据层测试（打开 / 保存 / 弹窗 / 属性） |
| `__tests__/mapView.toolbar.test.tsx` / `mapView.emptyState.test.tsx` / `mapView.palette.test.tsx` / `mapView.canvas.test.tsx` / `mapView.contextMenu.test.tsx` | 文件 | 视图测试（Pixi 表面用 `vi.mock` 替换，不真正初始化 WebGL） |
| `__tests__/model.*.test.ts` | 文件 | 纯模型测试：`document` / `renderModel` / `geometry` / `brush` / `fill` / `clipboard` / `passability` / `recentTiles` / `dirty` / `validation` |

---

## Plan 04-05 — 纯模型：笔刷几何 / 填充 / 剪贴板

**要做什么：** 把「鼠标从 A 拖到 B 经过哪些格」「矩形覆盖哪些格」「连通区域是哪些格」「复制一块 / 粘贴到某处要写哪些格」写成纯函数。

| 名称 | 种类 | 用途 |
|------|------|------|
| `src/map/model/geometry.ts` | 文件 | 格子几何：正交补点、矩形展开、矩形规范化与裁剪 |
| `walkOrthogonalPath` | 函数 | 从起点到终点逐格走一条不留断点的正交路径（斜拖时补格） |
| `rectanglePositions` | 函数 | 把两个对角格展开为矩形内全部格子（含边界） |
| `normalizeRect` | 函数 | 把任意两个角点整理成「左上角 + 宽高」 |
| `clampRectToMap` | 函数 | 把矩形裁剪到地图范围内，并给出被裁掉的格数 |
| `src/map/model/brush.ts` | 文件 | 笔刷：图案平铺与写列表生成 |
| `IPaintWrite` | interface | 一次要写的格子（`x` / `y` / `value`），提交前才与文档比对出 `before` |
| `tileNumberAt` | 函数 | 按笔刷锚点做图案平铺，算出某个格子该写什么编号（0 = 空） |
| `buildStrokeWrites` | 函数 | 线：路径上每个格子盖一次笔刷 |
| `buildRectWrites` | 函数 | 矩形：在拖出的矩形内平铺图案 |
| `buildFillWrites` | 函数 | 填充：把连通区域替换为图案 |
| `src/map/model/fill.ts` | 文件 | 四邻域连通填充 |
| `fillConnectedPositions` | 函数 | 从起点出发，返回与起点同值且四邻域连通的全部格子 |
| `src/map/model/clipboard.ts` | 文件 | 区域复制 / 粘贴（左上角锚点 + 越界裁剪 + 裁剪计数） |
| `copyMapRegion` | 函数 | 从当前图层截一块，返回内部剪贴板结构 |
| `buildPasteWrites` | 函数 | 以某格为左上角生成写列表，并报告被裁剪的格数 |
| `buildClearWrites` | 函数 | 把一块矩形内的格子写成 0（清空选区 / 擦除） |

---

## Plan 04-06 — 纯模型：只读通行度 / 最近使用 / 脏比较 / 校验

**要做什么：** 把「哪些方向走不通」「最近用过哪些图块」「内存和上次保存差在哪」「名字和尺寸合不合法」写成纯函数。

| 名称 | 种类 | 用途 |
|------|------|------|
| `src/map/model/passability.ts` | 文件 | 只读通行度：按图块目录的四方向布尔值算每格「不能走」的方向 |
| `computePassabilityMarks` | 函数 | 对每个非空格子算出不可通行方向；只在事件层生效的图块仅事件层参与；空格不画 |
| `src/map/model/recentTiles.ts` | 文件 | 最近使用：过滤、去重、置顶、截断 |
| `normalizeRecentTiles` | 函数 | 丢掉非整数 / 目录里不存在的编号、去重、按上限截断 |
| `updateRecentTiles` | 函数 | 把本次笔画的主图块移到首位（同一编号只留一条） |
| `src/map/model/dirty.ts` | 文件 | 脏状态 = 「当前内存」与「最近一次已保存快照」的比较 |
| `isMapDataDirty` | 函数 | 文档几何是否与基线不同（宽高 / 图层 / 格子） |
| `isMapPropertiesDirty` | 函数 | 属性表是否与基线不同 |
| `src/map/model/validation.ts` | 文件 | 输入校验：地图名 / 图层名 / 尺寸 |
| `validateMapName` | 函数 | 去空白后非空、不与现有地图重名；返回首个错误文案或 `null` |
| `validateLayerName` | 函数 | 去空白后非空、不与现有图层重名 |
| `validateMapSize` | 函数 | 宽高为 1..上限之间的整数；超限返回错误文案（不静默夹取） |

---

## Plan 04-07 — 面板数据层：打开 / 切换 / 保存 / 撤销

**要做什么：** 让面板能列地图、切地图、按域手动保存、一笔一次撤销，并且切图 / 放弃后撤销不会串到别的图上。

| 名称 | 种类 | 用途 |
|------|------|------|
| `MapPanel.loadSummaries` | 方法 | 读宿主地图清单，落「加载 / 失败 / 无地图」三态 |
| `MapPanel.onSwitchIn` | 方法 | 切入时重读清单；当前地图有未保存改动时不重读当前文档 |
| `MapPanel.registerBarrier` | 方法 | 登记一条不可撤销的屏障（新建 / 加层 / 切图 / 放弃） |
| `MapPanel.captureBaseline` | 方法 | 把当前文档与属性表记成「已保存基线」；打开地图成功、新建地图成功、新增图层成功后都必须调用，否则刚打开的地图会被判成「未保存」 |
| `MapPanel.refreshUnsaved` | 方法 | 用基线与当前状态重算脏标记（撤销 / 重做后也调用） |
| `MapPanel.isDirty` | 方法 | 先按基线重算、再回答「现在有没有未保存改动」；四个询问入口（切图 / 新建 / 加层 / 关闭标签）都以它为准 |
| `MapPanel.undo` / `MapPanel.redo` | 方法 | 只认自己的撤销类型；载荷里的地图标识与当前地图不一致时直接返回 |
| `MapPanel.commitProperty` | 方法 | 提交一个属性字段：一条属性撤销记录 + 置脏（本计划先落方法骨架，Plan 04-09 接线） |
| `MapPanel.dispose` | 方法 | 卸载时释放视图 / 资源，不弹对话框 |

---

## Plan 04-08 — 面板数据层：新建地图 / 新增图层 / 未保存 / 最近使用

**要做什么：** 把四个「会丢改动」的入口接上宿主回调与未保存确认，并把最近使用图块落到项目文件。

| 名称 | 种类 | 用途 |
|------|------|------|
| `MapPanel.openDialog` / `MapPanel.closeDialog` | 方法 | 打开 / 关闭受控弹窗，唯一写 `MapDialogKind` 的入口；关闭会清 `dialogError`，提交中不允许关闭 |
| `MapPanel.createMap` | 方法（宿主无 `createMap` 时不执行任何动作并给提示） | 调宿主 `createMap`；成功后打开新文档（当前层 = 初始图层、视口回左上角）并登记屏障 |
| `MapPanel.addLayer` | 方法（宿主无 `addLayer` 时同上） | 调宿主 `addLayer`；成功后新层成为当前层并登记屏障 |
| `MapPanel.requestUnsavedDecision` | 方法 `(): Promise<boolean>` | 有未保存改动时打开未保存弹窗并等用户决定；`true` = 继续原操作，`false` = 取消。供切图 / 新建 / 加层 / 关闭标签共用 |
| `MapPanel.resolveUnsavedDecision` | 方法 `(choice: MapUnsavedChoice): Promise<void>` | 未保存弹窗三个按钮的**唯一承接方法**：`Cancel` 结束并回答 `false`；`Discard` 回到基线后回答 `true`；`SaveAndContinue` 先 `MapPanel.save()`，成功回答 `true`、失败弹窗不关且不回答。视图只调它，不自己决定 |
| `MapUnsavedDialog` 的 `onUnsavedDecision` | prop `(choice: MapUnsavedChoice) => void` | 三个按钮把「用户按了哪个」交给面板的 `MapPanel.resolveUnsavedDecision`；按钮本身不持有任何逻辑 |
| `MapPanel.requestDiscard` | 方法 | 放弃内存改动、回到最近基线，并登记屏障 |
| `MapPanel.onBeforeClose` | 方法 `(): Promise<boolean>`（实现 `IEditorPanel.onBeforeClose`） | 关闭标签时被外壳询问：内部调 `MapPanel.requestUnsavedDecision`，`false` = 别关；自己 `try/catch`，出错按「取消关闭」处理 |
| `MapPanel.loadRecentTiles` | 方法 | 读项目内约定文件并规范化；文件缺失 / 损坏按空列表处理 |
| `MapPanel.writeRecentTiles` | 方法 | 落笔成功后写回最近使用（不存在则创建）；失败静默降级 |
| `MapPanel.clearRecentTiles` | 方法 | 清空最近使用记录并写回 |
| `src/map/components/dialogs/MapNewDialog.tsx` | 文件 | 新建地图弹窗（名称 / 宽 / 高 / 初始图层名） |
| `MapNewDialog` | 组件 | 受控弹窗：字段错误行内显示、创建中禁用、失败不关闭 |
| `src/map/components/dialogs/MapLayerDialog.tsx` | 文件 | 新增图层弹窗（名称） |
| `MapLayerDialog` | 组件 | 受控弹窗：预填「图层 {N}」、打开即聚焦全选 |
| `src/map/components/dialogs/MapUnsavedDialog.tsx` | 文件 | 未保存确认弹窗（三个动作） |
| `MapUnsavedDialog` | 组件 | 保存中禁用、失败保留并显示原因、默认焦点在「取消」 |
| `src/map/components/dialogs/index.ts` | 桶文件 | 弹窗统一出口 |

---

## Plan 04-09 — 地图属性域 + 表单模式实现 + 属性抽屉

**要做什么：** 让表格表单能「只显示字段行」，并把地图属性做成一个独立域：读整表、改字段一条撤销、保存整表。

| 名称 | 种类 | 用途 |
|------|------|------|
| `TableGrid` 的 `formMode` | 实现（`TableGrid.tsx` 内） | 为真时 `toolbar` / `SchemaBanner` 为 `null`；行渲染 / 校验 / 字段路径一行不改 |
| `src/map/components/MapPropertiesDrawer.tsx` | 文件 | 右侧 480px 抽屉：标题「地图属性」，正文挂 `TableGrid`（表单模式） |
| `MapPropertiesDrawer` | 组件 | 状态映射（加载 / 失败 / 空 Schema / 就绪）、关闭不丢改动、只传字段行不传保存入口；`open` 来自 `IMapPanelViewState.propertiesOpen`，关闭回调交给面板 |
| `MapPropertiesDrawer` 的 `open` | prop `boolean` | 抽屉是否打开；只读 `IMapPanelViewState.propertiesOpen`，组件自己不存开关 |
| `MapPropertiesDrawer` 的 `status` | prop `TablePanelStatus` | 由面板 `propertiesStatus`（`Idle` / `Loading` / `Error` / `EmptySchema` / `Ready`）映射而来；`Idle` 时不打开抽屉 |
| `MapPropertiesDrawer` 的 `rows` | prop `readonly ITableRowNode[]` | 属性行树：由 `buildTableTree(propertiesSchema, properties)` 生成，字段提交 / 撤销后重建 |
| `MapPropertiesDrawer` 的 `error` | prop `string?` | 加载失败时显示的纯文本原因；`Idle` / `Ready` 时不传 |
| `MapPropertiesDrawer` 的 `onChange` | prop `(path, value) => void` | 字段提交：`path: readonly (string \| number)[]`、`value: unknown`；接到 `MapPanel.commitProperty` |
| `MapPropertiesDrawer` 的 `onRetry` | prop `() => void` | 加载失败后的「重试」；接到 `MapPanel.loadProperties` |
| `MapPropertiesDrawer` 的 `onClose` | prop `() => void` | 点抽屉关闭；接到 `MapPanel.closeProperties`（不保存、不丢内存改动） |
| `MapPanel.openProperties` | 方法 | 「地图属性」按钮的承接方法：置 `propertiesOpen = true`，并在**第一次**打开（状态仍为 `Idle`）时调 `MapPanel.loadProperties`；已读过就只开抽屉、不重读（保住内存改动） |
| `MapPanel.closeProperties` | 方法 | 关闭属性抽屉（只把 `propertiesOpen` 置假）；不丢内存改动、不触发保存 |
| `MapPanel.loadProperties` | 方法 | 读整份属性表 + 宿主注入的 Schema，构建行树 |
| `MapPanel.refreshPropertyRows` | 方法 | 用当前属性表重建行树（字段提交后） |
| `MapPanel.saveProperties` | 方法 | 把整份属性表交给宿主（保存域的第二个分支） |
| `MapPanel.undo` / `MapPanel.redo` 的 `Property` 分支 | 实现 | 属性字段撤销 / 重做，并按基线重算脏状态 |

---

## Plan 04-10 — 视图：工具栏 / 空态 / 状态条 / 保存提示条

**要做什么：** 把面板的第一层界面做出来：两行工具栏、首次打开时的内联地图清单、画布下方状态条、保存提示条。

| 名称 | 种类 | 用途 |
|------|------|------|
| `src/map/map.css` | 文件 | 面板唯一样式表：类前缀 `emap-`，消费 `--editor-*`（带 fallback）与 `--emap-*` |
| `src/map/components/MapToolbar.tsx` | 文件 | 两行工具栏：地图切换 / 新建地图 / 未保存标记 / 地图属性 / 保存地图；图层段 / 新增图层 / 画笔段 / 通行度 / 大地图 / 四向移动 / 窄面板「视图」下拉 |
| `MapToolbar` | 组件 | 纯 DOM + antd；<900px 时把低频动作收进「视图」下拉 |
| `MapToolbar` 的 `showEditRow` | prop `boolean` | 为 `false`（地图还没打开过）时整个第 2 行不渲染；由 `MapPanelView` 从面板状态推导 |
| `MapToolbar` 的 `status` / `unsaved` / `saving` | props | 面板状态、是否有未保存改动、是否正在保存；决定保存按钮与编辑控件的禁用，工具栏自己不推导 |
| `MapToolbar` 的 `mapSummaries` / `currentMapId` | props | 地图清单与当前地图；第 1 行 `Select` 的选项与选中值来源 |
| `MapToolbar` 的 `layers` / `currentLayerId` | props | 文档图层与当前层；第 2 行图层 `Segmented` 的选项与选中值来源 |
| `MapToolbar` 的 `canCreateMap` / `canAddLayer` / `canOpenProperties` | props | 宿主是否注入了对应能力；为 `false` 时对应按钮禁用并给 tooltip（绝不点成空操作） |
| `MapToolbar` 的 `brushMode` / `passabilityVisible` / `bigMap` | props | 线 / 矩形 / 填充、是否显示通行度、是否大地图；全部是受控值 |
| `MapToolbar` 的 `aboveLayerOpacity` / `onAboveLayerOpacityChange` | props `number` / 回调 | 高于当前层的图层统一不透明度（0..1，滑块）；当前层已是最上层时滑块禁用 |
| `MapPanel.setAboveLayerOpacity` | 方法 | 记录滑块值并刷新渲染；不置脏、不进撤销 |
| `MapToolbar` 的 `onSelectMap` / `onOpenCreate` / `onOpenAddLayer` | props | 切地图 / 打开新建弹窗 / 打开新增图层弹窗；后两个只调 `MapPanel.openDialog` |
| `MapToolbar` 的 `onOpenProperties` / `onSave` / `onRetry` | props | 打开地图属性 / 手动保存 / 重试（保存失败或清单失败共用）；`onOpenProperties` 只调面板的 `MapPanel.openProperties` |
| `MapToolbar` 的 `onSelectLayer` / `onSelectBrushMode` | props | 切当前层 / 切画笔模式；切层交给 `MapPanel.selectLayer` |
| `MapToolbar` 的 `onTogglePassability` / `onToggleBigMap` / `onMoveViewport` | props | 通行度开关 / 大地图开关 / 四向移动（`dx`、`dy`、`byScreen` 三参）；分别接到面板同名方法，只改视图状态 |
| `MapEmptyState` 的 `listStatus` / `mapSummaries` / `error` | props | 清单的四态（加载 / 失败 / 空 / 有条目）、清单条目、失败原因 |
| `MapEmptyState` 的 `canCreateMap` | prop `boolean` | 为 `false`（宿主没注入 `createMap`）时两个「新建地图」按钮都禁用并给 tooltip |
| `MapEmptyState` 的 `onSelectMap` / `onOpenCreate` / `onRetry` | props | 打开某张地图 / 打开新建弹窗 / 重试读清单 |
| `src/map/components/MapEmptyState.tsx` | 文件 | 首次打开的四态：清单加载 / 清单失败 / 无地图 / 未打开 + 内联清单 |
| `MapEmptyState` | 组件 | 有地图未打开时渲染可滚动的地图名按钮列表 + 固定「新建地图」主按钮 |
| `src/map/components/MapStatusBar.tsx` | 文件 | 画布下方 24px 状态条：坐标 / 选区 / 地图 / 图层 / 模式 |
| `MapStatusBar` | 组件 | 纯展示；窄宽度按优先级从右向左隐藏次要段。04-10 先由 `MapPanelView` 渲染（坐标 / 选区来自 props），04-12 把这份渲染搬进 `MapCanvas`，改由画布本地的指针 / 框选状态喂前两段 |
| `MapStatusBar` 的 `cursor` / `selection` | props `IMapCellPosition?` / `IMapRect?` | 当前指针格与框选矩形；04-10 由 `MapPanelView` 传，04-12 起由 `MapCanvas` 的本地状态传（都不进面板 Store） |
| `MapStatusBar` 的 `mapSize` / `layerName` / `bigMap` | props | 地图尺寸、当前图层名、是否大地图；决定「地图 / 图层 / 模式」三段 |
| `MapStatusBar` 的 `narrow` | prop `boolean` | 窄宽度时为真，按优先级从右向左隐藏次要段；测试直接传（`ResizeObserver` 在 jsdom 是空桩） |
| `MapPanelView` 的保存提示条 | 实现 | 默认空；「已保存」或破坏性「保存失败：{原因}」+「重试」 |
| `src/map/components/index.ts` | 桶文件 | 组件统一出口 |
| CSS 类前缀 `emap-` | 约定 | 面板作用域样式（`emap-panel` / `emap-toolbar` / `emap-status-bar` 等） |
| `.emap-properties-body` | CSS 类 | 地图属性抽屉的正文容器：`position: relative; height: 100%; min-height: 0`，给复用的 `.etable`（`position: absolute; inset: 0`）一个定位上下文与确定高度（Pitfall 19） |
| `data-test-id` 前缀 `map-` | 约定 | 测试标识：`map-panel` / `map-toolbar` / `map-select` / `map-new` / `map-save` / `map-unsaved` / `map-properties` / `map-properties-drawer` / `map-layer-mode` / `map-layer-add` / `map-brush-mode` / `map-passability` / `map-bigmap` / `map-canvas` / `map-status` / `map-empty` / `map-error` / `map-retry` / `map-notice` |

---

## Plan 04-11 — 视图：图块调色板组件（多格框选 / 最近使用 / 缺图）

**要做什么：** 左侧 240px 调色板**组件本身**：固定擦除格、最近使用分区、分组折叠网格、同组内多格框选与尺寸提示、缺图占位与提示。本计划只做组件（纯 props 进、回调出），**不把它挂进面板**——挂载与接线在 04-16。

| 名称 | 种类 | 用途 |
|------|------|------|
| `src/map/components/MapPalette.tsx` | 文件 | 调色板：擦除格 / 最近使用 / 分组折叠 / 网格 / 多格框选 |
| `MapPalette` | 组件 | 每个图块是真实 `<button>`；缺图时棋盘格 + 角标「!」并保留可选可画 |
| `MapPalette` 的 `onSelectPattern` | prop `(selection: IMapPaletteSelection) => void` | 用户选中图块 / 框选完成 / 选中「空」时把结果交出去；组件自己不存选中 |
| `MapPalette` 的 `onRetryImages` | prop `(): void` | 「图块加载失败」时点「重试」的回调（挂载后接到 `MapPanel.reloadTileImages`，见 04-16） |
| `MapPalette` 的 `onClearRecent` | prop `(): void` | 「清除记录」确认后的回调（挂载后接到 `MapPanel.clearRecentTiles`，见 04-08 / 04-16） |
| `MapPalette` 的 `groupUrls` / `groupStatus` | props | 分组标识 → blob URL、分组标识 → `MapImageStatus`；由挂载方（04-16 的视图 hook）提供，组件自己不读文件、不读字节 |
| `src/map/components/dialogs/MapRecentClearDialog.tsx` | 文件 | 「清除最近使用的图块？」确认弹窗 |
| `MapRecentClearDialog` | 组件 | 破坏性按钮「清除记录」+「取消」 |
| `data-test-id`（调色板） | 约定 | `map-palette` / `map-tile-{编号}` / `map-palette-group-{序号}` / `map-recent-{编号}` / `map-palette-empty` / `map-palette-retry` / `map-recent-clear-dialog`（清除最近使用确认弹窗） |

---

## Plan 04-16 — 视图：把调色板挂进面板（分组图片 URL / 最近使用 / 选择接线）

**要做什么：** 把 04-11 做好的调色板真正挂进 `MapPanelView`（替换 04-10 的占位容器），由面板注入分组图片 blob URL、最近使用列表与选择回调；点图块写回面板状态，画布与调色板读同一份选中。

> 为什么单独一个计划：04-11 已有 3 个任务 6 个文件，再塞「挂载 + 视图 hook + 面板两个方法 + 6 条经面板视图的用例」会超出单个计划的舒适区间（任务数与文件数）。组件与接线分属两个计划，也正好对应「先做组件、再接进面板」的推进顺序。

| 名称 | 种类 | 用途 |
|------|------|------|
| `MapPanelView` 的调色板 props | props | `tileGroups`（来自文档目录）、`loadTileBytes`（面板注入的取字节）、`paletteSelection`、`paletteVersion`、`recentTiles`、`recentStatus`、`onSelectPattern`、`onRetryImages`、`onClearRecent` |
| `MapPanel.selectPalette` | 方法 | 设定当前选中（空 / 图块 / 最近使用），必要时把画笔尺寸重置为 1×1；调色板的每次选择都经它写进视图状态 |
| `MapPanel.reloadTileImages` | 方法 | 「图块加载失败」时的重试入口：`paletteVersion + 1`、重新发布视图状态；不读图片、不改文档、不置脏 |
| `useMapTileGroupUrls` | hook（`useMapObjectUrl.ts` 内） | 一次为一组图片路径取字节、生成 blob URL，返回「分组 → URL」与「分组 → `MapImageStatus`」；卸载 / 版本变化时 revoke。用单次 `useEffect` 而不是在循环里调 hook（Hooks 规则） |
| `MapPanelView` 的 `map-palette-slot` | 占位（本计划删除） | 04-10 在视图里留的占位容器；04-16 用真 `MapPalette` 替换它，测试断言它不再存在 |

---

## Plan 04-12 — 视图：画布手势 / 右键菜单 / Pixi 表面

**要做什么：** 让画布真的能画：线 / 矩形 / 填充 / 擦除、右键框选 / 右键菜单 / 绘制中取消、复制粘贴快捷键、视口移动与大地图，以及 Pixi 表面的网格 / 框选 / 预览 / 通行度叠加。

| 名称 | 种类 | 用途 |
|------|------|------|
| `src/map/components/MapCanvas.tsx` | 文件 | 画布容器：指针手势、快捷键、行列标尺、状态条协作（不在 window 上挂监听） |
| `MapCanvas` | 组件 | 可聚焦容器；左键画、右键框选 / 菜单 / 取消笔画；Ctrl+C / Ctrl+V 仅画布聚焦时生效 |
| `MapCanvas` 的 `canPaint` | prop `boolean` | 由 `MapPanelView` 用 `!isTileCatalogEmpty(view.document)` 传入；为 `false` 时画布不进入落笔手势（右键框选 / 菜单 / 快捷键仍可用）。与 `MapPanel.commitCells` 的守卫是同一判据的两道防线 |
| `src/map/components/MapContextMenu.tsx` | 文件 | 右键菜单：复制选区 / 粘贴到此处 / 清空选区 / 取消选区 |
| `MapContextMenu` | 组件 | `role="menu"` / `role="menuitem"`，打开聚焦第一项，方向键 / Enter / Escape，边缘夹取 |
| `MapSurface` 的叠加层 | 实现 | 网格线、悬停轮廓、绘制预览、框选矩形、通行度箭头 / 红点 |
| `MapPanel.copyRegion` / `MapPanel.pasteAt` / `MapPanel.clearRegion` | 方法 | 复制 / 粘贴 / 清空；各记一条撤销（复制不记） |
| `MapPanel.moveViewport` | 方法 | 视口移动 1 格 / 1 屏；大地图下同样可用（滚轮上下、Shift+滚轮左右移动视角） |
| `MapPanel.selectLayer` | 方法 | 切换当前图层：取消进行中的笔画、清选区与预览；保留剪贴板与调色板选择，不置脏、不记撤销 |
| `MapPanel.setPassabilityVisible` / `MapPanel.setBigMap` | 方法 | 只读通行度开关 / 大地图开关；都不置脏、不进撤销 |
| `MapCanvas` 内部的 `MapStatusBar` | 实现 | 状态条的坐标 / 选区两段改由画布本地的指针 / 框选状态喂；其余段（地图 / 图层 / 模式）仍由 props 传入。`MapPanelView` 不再直接渲染状态条 |
| `MapGestureKind` 在画布里的用法 | 实现 | `gesture.kind` 取 `MapGestureKind.None` / `Paint` / `Marquee`（枚举值，不用字符串字面量） |
| `data-test-id`（菜单 / 画布） | 约定 | `map-context-menu` / `map-context-copy` / `map-context-paste` / `map-context-clear` / `map-context-cancel` / `map-ruler` |

---

## Plan 04-13 — 开发宿主接入

**要做什么：** 在开发宿主里注册地图面板、注入内存实现与演示数据，让浏览器里能真正打开、画、保存。

| 名称 | 种类 | 用途 |
|------|------|------|
| `src/backend/mapFiles.ts` | 文件（`editor-dev`） | 宿主适配器：把演示用的地图形状翻成中立文档，保存时把几何写回并**保留事件与额外字段** |
| `IMapFileRecord` | interface | 演示宿主里一份地图文件的内存形状（宽 / 扁平图层 / 图层别名 / 属性表 / 事件 / 额外字段）；属性表与几何在同一个文件里，保存几何时必须原样保留 |
| `toMapDocument` | 函数 | 演示形状 → 中立文档（扁平层切成 `[y][x]`；缺名层回退「图层 {N}」） |
| `applyMapDataSection` | 函数 | 中立文档的数据域 → 写回演示形状（保留事件与额外字段） |
| `applyMapPropertiesSection` | 函数 | 中立文档的属性域 → 只替换演示形状里的属性表；几何 / 事件 / 额外字段原样保留（两个保存域互不覆盖） |
| `createMapCapabilities` | 函数 | 把内存后端包装成 `IMapEditorCapabilities`；第二个参数是 `IMapCapabilityOptions` |
| `IMapCapabilityOptions` | interface（`editor-dev`） | `createMapCapabilities` 的选项：`tileGroups: readonly IMapTileGroup[]`（**必填**，`openMap` / `createMap` / `addLayer` 返回的文档都带这份目录）、`propertiesSchema?`、`maxMapSize?`、`recentTilesPath?`。漏掉 `tileGroups` 会让打开后的地图没有图块目录、调色板一片空 |
| `src/demo/mapDemo.ts` | 文件（`editor-dev`） | 演示数据：2 张地图、2 个图块分组（含 1 个缺图图块）、属性 Schema（string + number）、注册与 seed |
| `seedMapDemo` | 函数 | `seedMapDemo(backend)`：把演示地图文件、清单文件、图块图片字节写进内存后端（故意不写那张缺图），必须在 `core.initialize` 之前调用 |
| `registerMapDemo` | 函数 | `registerMapDemo(core, backend)`：注册面板类型 + 订阅撤销屏障提示（seed 由 `seedMapDemo` 单独负责） |
| `MAP_DEMO_MAPS` / `MAP_DEMO_TILES` / `MAP_DEMO_PROPERTY_SCHEMA` | 常量 | 演示数据（两张地图、两个分组、两个字段） |
| `src/__tests__/devHostMap.test.tsx` | 文件 | 开发宿主端到端：注册 → 打开 → 画 / 擦 / 切层 → 加层 → 属性 → 保存 → 关闭重开仍在；事件与额外字段保留 |

---

## Plan 04-14 — 导出收口 / 门禁 / 手动验收

**要做什么：** 把地图能力对外的出口收成一份，跑齐三个包与四条生效门禁，并给出浏览器手动验收清单。

| 名称 | 种类 | 用途 |
|------|------|------|
| `src/map/index.ts`（终态） | 桶文件 | `types → constants → model → components → mapPanel → mapPanelType` 的 `export *` 顺序；不从根 `src/index.ts` 再导出 |
| `@motajs/editor-impl/map` | 包子路径（已预留） | 地图能力的唯一入口；本计划确认它能被开发宿主与未来产品宿主消费 |
| `04-14-SUMMARY.md` 的「手动验收表」 | 记录格式 | 列固定为 `步骤` / `内容` / `结论` / `归属计划`；`结论` 只取 `通过` 或 `偏差`，`偏差` 行必须写形如 `04-12` 的归属计划，`通过` 行写 `—`。这张表由 `node -e` 结构检查读取，是阶段人工闸门的可核查记录 |

---

## 开放问题决议（12 项，均在本文定稿）

> 研究文件 §Open Questions 提出 12 个待定问题。下面逐条给出**本阶段的执行口径**。它们不是新决策，而是把 CONTEXT 的 D-01…D-24 落到可执行的一侧。

| # | 问题 | 本阶段口径 | 理由 / 影响 |
|---|------|-----------|-------------|
| OQ1 | 关闭标签前的未保存拦截需要 core 新钩子 | 加可选 `IEditorPanel.onBeforeClose?(): Promise<boolean>`；`true` 允许关闭、`false` 取消；只在**用户主动关闭标签**时调用；调用前若目标不是活动标签，先 `activateTab`（否则对话框没有 DOM 可挂）；`dispose` / `unregisterPanelType` / 内部释放路径**不询问**；钩子抛错时记日志并按「取消关闭」处理（数据安全优先），面板实现自己 catch | 这是本阶段唯一的跨包接口改动，**one-way**：一旦发布，所有宿主都按这个语义实现。Plan 04-02 有一个 `checkpoint:decision` 专门确认它 |
| OQ2 | 图块目录状态：D-02 与 UI-SPEC 的口径冲突 | **保留 D-02**：目录随文档到达。调色板的「加载 / 失败」指**图片字节**状态；全部分组图片失败 → 显示「图块加载失败」+ 重试，但**仍可落笔**（编号有效，画布用占位格）；目录零分组 → 「暂无可用的图块」并禁用落笔 | 不新增第二条数据通道；单张图失败只影响该图块，不把整张地图判成加载失败（Pitfall 13） |
| OQ3 | 地图属性放文档里还是独立域 | 独立域：`readProperties` / `saveMapProperties` + 静态 `propertiesSchema`。文档只装几何与图块目录 | 抽屉需要独立的「加载 / 失败」状态；属性保存是 D-04 明确的一个独立域 |
| OQ4 | 「新增图层」是否触发未保存拦截 | **触发**（与切图 / 新建 / 关闭标签一致）。这是对 UI-SPEC F8 触发列表的扩展 | 宿主加层会返回整份新文档，内存里未保存的笔画会被覆盖（Pitfall 17）。不拦截 = 静默丢数据 |
| OQ5 | 图层合成：全画还是只画当前层 | 按宿主给定顺序（zIndex）逐层绘制：**zIndex 低于当前选中层的正常绘制（不透明度 1）**；**高于当前选中层的用一个滑块统一调整不透明度**，默认 0.3；当前层始终 1.0。新增 `aboveLayerOpacity` / `MapPanel.setAboveLayerOpacity` / `MAP_ABOVE_LAYER_DEFAULT_OPACITY`。 | 用户 2026-10-21 指定：下层保持可读，上层可调透明以看清当前层；单一滑块避免每层一个控件 |
| OQ6 | 最近使用文件的路径 / 格式 / 上限 | `.editor/map-recent-tiles.json`，`{ "tiles": number[] }`，上限 24，只存 1×1 主图块；缺失 / 损坏按空列表；首次落笔成功后才创建；宿主可用 `recentTilesPath` 覆盖；失败静默降级 | 写新文件会进入项目目录，用户需知晓（见本文末确认项） |
| OQ7 | 事件域接口：现在声明还是留给 Phase 6 | **本阶段不声明**事件保存接口（没有调用点的接口就是未定契约）。`saveMapData` 的宿主实现负责在写回时保留事件与额外字段 | D-04 的「按域拆分」在事件域上由 Phase 6 补齐；本阶段用开发宿主集成测试断言「保存后事件仍在」来守住数据不丢 |
| OQ8 | 标签标题是否显示地图名 | 不实现动态标题：面板类型名「地图编辑器」；不实现 `getTitle` | 外壳只在自身快照变化时重算标签名，切图后标签名会停在旧值（Pitfall 20）；要修就得扩 core 接口，本阶段不做 |
| OQ9 | 组内缺格时多格图案怎么处理 | 能力契约要求「分组是完整矩形」；若仍缺格，图案格按 0（空）写入，用占位而不是崩溃 | 与 A10 一致；不让一次选择产生大量意外空格而无声 |
| OQ10 | 图块图片：路径 + 资源层，还是宿主给 URL / 字节 | 路径 + 资源层：宿主只给相对项目根的 `imagePath`，面板经 `IEditorPanelContext.requestResource(...).requestBinary()` 取字节，再生成 blob URL / 纹理 | 与素材面板同款；面板不触达真实文件系统。未来若出现只能给 URL 的宿主，再加可选 `resolveImageUrl?` |
| OQ11 | 绘制预览：覆盖层还是真实图块 | 覆盖层：目标格 35% 透明填充 + 1px 描边，不克隆文档、不在预览里画真实图块 | 更便宜；克隆整图会在拖动时产生几 MB 垃圾（Pitfall 6） |
| OQ12 | 大地图性能阈值 | 普通模式只构建**可见格**；大地图模式整图适配一屏，格边长 < 16px 时通行度改红点，一次构建的图元数上限 12000；超过时只画当前层。**大地图下允许移动视角：滚轮上下移动、Shift+滚轮左右移动**（复用 `MapPanel.moveViewport`），退出后回到进入前视口。 | 阈值是实现常量、不进对外契约；用户 2026-10-21 明确要求大地图仍可用滚轮移动；开发宿主放一张大于视口的地图实测 |

**另有两项由规划阶段自行裁定（CONTEXT 的 Discretion）：**

- **地图清单呈现**：首次打开用空态内联清单；打开后用工具栏 `Select`（可搜索）切换，同一面板实例内完成（OQ13 / A11）。
- **新建地图默认值**：名称空、宽 32、高 32、初始图层名「图层 1」（UI-SPEC F3）。

---

## 范围修订记录（必须随计划一起读）

1. **通行性改为只读**（CONTEXT D-13 / D-23）。ROADMAP Phase 4 第 3 条与 REQUIREMENTS `MAP-01` 原文含「编辑通行性」，本阶段按用户指示正式修订为**只读查看通行度叠加层**。本文件与全部计划**不得**出现通行性编辑入口。
   - **已完成（2026-10-21）：** 按用户指示，`.planning/ROADMAP.md` Phase 4 第 3 条与 `.planning/REQUIREMENTS.md` 的 `MAP-01` 已补上修订说明（通行性只读，见 04-CONTEXT D-13/D-23）。
2. **范围扩大**（同类修订的补入项）：新建地图（D-05）、新增图层（D-05 / D-07）、地图属性表单（D-15）、区域复制粘贴（D-20）、最近使用图块（D-11）都在本阶段内。
3. **仍然不做**（D-24）：点事件的显示 / 绑定 / 编辑、图块属性编辑、图层重命名 / 排序 / 删除 / 设置面板、事件叠加与右键事件项、插件机制。

---

## 执行协作规则（2026-10-21）

阶段三的新增计划会与本阶段并行执行。为了不互相覆盖：

1. **只提交自己负责的文件**；其他文件一律不动，也不代为整理。
2. **修改前先检查工作树**：对每个要改的文件跑 `git status --porcelain -- <path>`；只要输出非空（已有未提交改动），**立即阻断执行**并向用户报告，不得覆盖、不得 stash、不得代提交。
3. 这条规则高于「继续执行」的默认行为；阻断后等用户明确指示再继续。

---

## 需要用户确认的清单（按重要性排序）

1. **（one-way）关闭前钩子语义**：`IEditorPanel.onBeforeClose?(): Promise<boolean>`；`true` 允许关闭、`false` 取消；关闭前先激活目标标签；内部释放路径永不询问。确认后 Plan 04-02 才会落这个成员。
2. **（costly）命名与文件布局**：`src/map/**` 的目录与文件名、`IMapDocument` / `IMapEditorCapabilities` / `IMapCapabilityOptions` 等接口名、`MapPanel` 类与 `MapPanel.*` 方法名、`isTileCatalogEmpty`、视图 props（`MapToolbar` / `MapEmptyState` / `MapStatusBar` / `MapPropertiesDrawer` / `MapCanvas.canPaint`）、`emap-` 类前缀与 `map-` 测试标识。
3. **（costly）中立文档形状**：`width` + `height` + `layers[].cells: number[][]`（二维行主序），图块目录在文档内（A1 / A2 / D-02）。
4. **（costly）最近使用文件**：会在项目里新建 `.editor/map-recent-tiles.json`；路径 / 字段名 / 上限 24。
5. **（costly）保存只交几何 + 属性两个域**：事件与额外字段由宿主保留，本阶段不声明事件接口（OQ7）。
6. **（reversible）通行度只读口径**：只画「不可通行」方向；`onlyEventLayer` 图块只在事件层参与。
7. **（reversible）UI 口径**：图层按 zIndex 绘制，低于当前层正常、高于当前层用滑块统一调不透明度（默认 0.3；`aboveLayerOpacity` / `MapPanel.setAboveLayerOpacity` / `MAP_ABOVE_LAYER_DEFAULT_OPACITY`）；绘制预览为覆盖层；大地图整图适配，滚轮上下 / Shift+滚轮左右移动视角；新增图层也弹未保存确认。
8. **（流程硬规则）工作树冲突阻断**：任何要修改的文件若在 git 工作树已有未提交改动，立即停止执行并报告，不得覆盖或代提交；只提交本计划负责的文件。阶段三的新增计划会并行执行，其他文件一律不动。

> 若以上任一项需要修改，请直接指出条目编号（例如「OQ4 改成不拦截」），本文件与对应计划会先改再执行。
