# Phase 4: 地图编辑 - Context

**Gathered:** 2026-10-20
**Status:** Ready for planning
**Note:** 本阶段讨论对 ROADMAP 的验收条目做了一处**用户指示的修订**：取消「编辑通行性」，通行性改为只读显示（见 D-13 / D-23）。同时按用户要求补入了「新建地图 / 新增图层 / 地图属性表单 / 区域复制粘贴」四项范围（见 D-05 / D-08 / D-20 / D-24）。

<domain>
## Phase Boundary

本阶段交付「地图编辑」能力，作为 `@motajs/editor-impl/map` 的默认实现：用户可以在编辑器里打开一张地图，查看它的图层与图块，用画笔绘制 / 擦除，切换图层，框选一块区域复制粘贴，新建地图与新增图层，编辑地图属性，查看只读的通行性叠加层，并可撤销 / 重做、手动保存。完成后接入开发宿主，可在浏览器里手动验收。

**本阶段做：**

- 打开地图（宿主提供地图清单 + 解析成中立文档）。
- 图层切换、新增图层。
- 左侧图块素材区（分组折叠 + 网格、多格框选、矩形预览、最近使用分区、空图块擦除）。
- 绘制（线 / 矩形 / 填充）、擦除、区域复制粘贴。
- 只读通行性叠加层。
- 地图属性表单（字段由宿主注入）。
- 新建地图。
- 统一撤销 / 重做（一笔一次）、手动保存。
- 视口移动、大地图模式。
- 开发宿主接入。

**本阶段不做：**

- 编辑通行性（用户指示：新引擎通行性完全由图块属性决定，地图上不能单独调）。
- 点事件的显示 / 绑定 / 编辑（留给事件编辑器阶段）。
- 图块属性编辑（只读展示）。
- 图层重命名 / 排序 / 删除 / 图层设置面板。
- 事件叠加、右键事件菜单项、复制粘贴事件。
- 代码编辑 / 事件编辑器 / 插件机制。

</domain>

<decisions>
## Implementation Decisions

### A. 地图数据与宿主接口

- **D-01:** 地图数据以**「整份通用文档」**方式注入：宿主把自己的地图解析成一份**不认识引擎**的数据交给面板（宽度、命名图层、每层数字格子、图块目录、通行信息）；面板改完整份交回宿主，由宿主写回自己的文件格式。面板**不认识文件路径，也不认识引擎文件格式**，因此**不需要**注入 `.jsonc` 解析函数。 — **Reversibility:** costly —— 这是地图能力与宿主之间的主契约，改形状要同时改面板、开发宿主与未来引擎适配层。
- **D-02:** 中立文档**自足**：同时装「图层 + 图块目录 + 通行性显示数据」。面板拿到一份文档就能画图、能显示通行度，不需要再向多个通道取数据。 — **Reversibility:** costly —— 文档形状被面板渲染、绘制、撤销共同依赖。
- **D-03:** 地图的打开与保存 = **宿主提供地图清单 + 打开 / 保存回调**；面板不读文件，也不负责选文件路径。 — **Reversibility:** costly —— 与 D-01 同属主契约。
- **D-04:** 保存接口**按数据域拆分注入**：地图数据、地图属性、事件各是一块接口，**每块都传整份数据**（地图接口传整张地图，属性接口传整个属性表，事件接口传所有事件）；不同项目可以注入不同实现。面板只交自己改过的域，**未展示的数据（如点事件）由宿主保留**，不得因保存而丢失。 — **Reversibility:** one-way —— 这是面向所有宿主的注入契约，一旦发布再改需要迁移每个宿主实现。
- **D-05:** **新建地图**与**新增图层**都支持，但**由宿主执行**（宿主按自己的格式建文件 / 加层）；面板只发指令并接收更新后的文档。 — **Reversibility:** costly —— 扩展宿主适配器接口面。
- **D-06:** 地图尺寸上限由**宿主注入**；超限时面板拒绝新建 / 改尺寸并提示。 — **Reversibility:** reversible —— 只影响校验提示。

### B. 图层与图块

- **D-07:** 图层由宿主提供，面板负责**切换**；新增图层经 D-05 的宿主回调。本阶段**不做**图层重命名、排序、删除、图层设置面板。 — **Reversibility:** reversible —— 后续补设置面板不需要改数据契约。
- **D-08:** 图块目录由**宿主算好每一项**：图块编号 + 图片路径 + 裁切矩形 + 名称 + 通行属性。面板只负责展示与选择，**不需要懂纹理切分规则**。 — **Reversibility:** costly —— 目录形状决定调色板渲染与通行度显示。
- **D-09:** 调色板支持**一次框选多格**图块；选中后鼠标移到地图上时，必须显示与所选区域**同尺寸的矩形预览**，而不是单格。 — **Reversibility:** costly —— 绘制与预览逻辑围绕多格笔刷构建。
- **D-10:** 素材区布局 = **分组可折叠 + 缩略图网格**（每个宿主给的分组一个标题，下面是网格）。 — **Reversibility:** reversible —— 纯视图布局。
- **D-11:** 「最近使用图块」= 素材区里的**单独分区**，跨会话持久化到**项目内约定文件**（不引入新的 core 接口，也不依赖浏览器本地存储）。 — **Reversibility:** costly —— 一旦有项目文件被写入，改位置需要迁移/清理。
- **D-12:** **擦除** = 调色板里放一个**「空」格子**，选中后绘制即清空对应格子；多格笔刷时清空整个矩形范围。 — **Reversibility:** reversible —— 与画笔共用同一条绘制路径。

### C. 通行性与图块属性

- **D-13:** **本阶段不编辑通行性。** 新引擎的通行性**完全由图块自身属性决定**，地图上不能单独调整；面板只提供**只读的四方向通行度叠加层**，方便查看哪里走不通。 — **Reversibility:** one-way —— 这修改了 ROADMAP / MAP-01 的既定验收（原条目要求「编辑通行性并看到生效结果」），恢复编辑需重新定义数据与交互。
- **D-14:** **图块属性只读**：地图面板只用图块名称与通行属性做展示 / 计算，不提供修改入口。图块属性的编辑留给未来的图块 / 素材配置能力。 — **Reversibility:** reversible —— 后续在别处补编辑入口即可。

### D. 地图属性

- **D-15:** 做**地图属性编辑表单**，字段由**宿主注入一份 JSON Schema** 描述（面板不写死引擎字段），复用 `editor-impl` 已有的 schema 表单引擎；属性整体作为「整个属性表」交给宿主保存（D-04）。 — **Reversibility:** costly —— 表单引擎与注入 schema 的约定会被宿主依赖。

### E. 编辑交互

- **D-16:** 画笔模式 = **线 / 矩形 / 填充**三种。 — **Reversibility:** reversible。
- **D-17:** 撤销粒度 = **一笔一次**：从鼠标按下到松开算一次；线 / 矩形 / 填充各算一次。 — **Reversibility:** costly —— 撤销记录的组织方式围绕笔画构建。
- **D-18:** 保存 = **手动保存**，与表格 / 素材一致；切换或关闭面板前提示未保存改动。 — **Reversibility:** costly —— 保存模型影响所有编辑入口与测试。
- **D-19:** 右键契约**对齐旧编辑器**：右键**拖拽** = 框选一块区域；右键**单击** = 弹出菜单；**绘制中按右键** = 取消当前这一笔。 — **Reversibility:** costly —— 与画布手势、菜单、选区状态耦合。
- **D-20:** 框选用于**图块区域的复制 / 粘贴**：只复制**当前图层**；粘贴以**鼠标位置为左上角**，**超出地图范围的部分裁剪**；右键菜单与 **Ctrl+C / Ctrl+V** 都可触发（快捷键仅在焦点位于地图画布时生效）。 — **Reversibility:** costly —— 复制数据形状与粘贴定位规则会被用户依赖。
- **D-21:** **视口移动**与**大地图模式**纳入本阶段（常用辅助），行为参照旧编辑器。 — **Reversibility:** reversible。
- **D-22:** **点事件本阶段完全不做**（不显示、不绑定、不编辑），留给事件编辑器阶段；事件数据在保存时由宿主的独立事件接口原样保留（D-04）。 — **Reversibility:** costly —— 后续接事件需要对上这里的域拆分。

### F. 范围修订

- **D-23:** 按用户指示，**取消 ROADMAP / MAP-01 中「编辑通行性」的要求**，改为「只读查看通行性」；这是对既定验收条目的正式修订，研究与规划不得再按「可编辑通行性」设计。 — **Reversibility:** one-way —— 恢复需要重新引入通行性编辑的数据与交互定义。
- **D-24:** 本阶段实际范围 = **最小集 + 常用辅助 + 区域复制粘贴 + 新建地图/新增图层 + 地图属性表单**。研发与规划不得再扩大（事件、图块属性、图层设置、复制粘贴事件均不在内）。 — **Reversibility:** reversible。

### the agent's Discretion

- 地图清单在面板里的**呈现形式**（空栏内联列表 / 工具栏下拉）与**切换方式**（同面板内切换 / 关闭重开），由规划阶段提出。
- **新建地图**时的表单字段（名称、初始尺寸、初始图层）与默认值，由规划阶段提出。
- **大地图模式**的具体交互与渲染细节，由规划阶段提出。
- 「最近使用图块」偏好文件的**约定路径、格式、条目上限**，由规划阶段提出并经 `INTERFACE-NAME.md` 确认。
- **图块图片字节的取得方式**（经 `editor-core` 资源层按路径读取，还是由宿主直接注入字节 / URL），由研究与规划阶段定；不得让面板直接触达真实文件系统。
- 所有**接口名 / 方法名 / 字段名 / 文件名 / 导出符号名**，由规划阶段提出并写入 `INTERFACE-NAME.md`，经用户确认后才可落盘。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 里程碑与需求
- `.planning/PROJECT.md` — 里程碑 v1.0（editor-core 空壳 + editor-impl 重做）；「引擎无关、数据经钩子注入」的硬约束
- `.planning/REQUIREMENTS.md` — 本阶段对应 **MAP-01**（其「通行性可编辑」部分按 D-13 / D-23 修订）
- `.planning/ROADMAP.md` §Phase 4（目标 + 4 条验收，其中第 3 条按 D-23 修订）与 §Cross-cutting Constraints（能力须接入开发宿主、能力包只导出面板类型对象）

### 前序阶段产出（本阶段必须沿用的契约）
- `.planning/phases/01-shell/01-CONTEXT.md`、`.planning/phases/01-shell/INTERFACE-NAME.md` — 外壳（`EditorCore` / `ShellSystem` / `IEditorPanelType` / 面板实例与切换）
- `.planning/phases/01.1-dev-host/01.1-CONTEXT.md` — 开发宿主与「能力只导出面板类型对象、顶层装配」约定（D-05）
- `.planning/phases/02-table/02-CONTEXT.md` — 表格决策（JSON Schema 表单引擎、统一撤销、切换刷新）
- `.planning/phases/02.1-resource-layer/02.1-CONTEXT.md`、`INTERFACE-NAME.md` — **路径标识 + 文件索引 + 内容缓存 + core 驱动注入 fs**；手动保存；`.jsonc` 前缀逐字保留；空栏内联交互
- `.planning/phases/03-asset/03-CONTEXT.md` — 素材能力；`shared/schemaForm` / `shared/jsonc` 的抽取；撤销屏障；能力互不依赖

### 新版引擎内容模型（本阶段数据形状依据 —— 仓库外）
- `E:/github/template/packages-user/data-common/src/store/types.ts` — `IMapRawData`（`floorId` / `width` / `map: Record<number, number[]>` / `layerAlias` / `events`）
- `E:/github/template/packages-user/client-modules/src/common.ts` — 纹理配置（`TextureReadType` / `TextureUsage` / `grid` / `tiles`）与音频等内容类型
- `E:/github/template/src/content/maps/.list.jsonc` — 地图清单文件（`string[]`，不含 `.jsonc` 后缀）
- `E:/github/template/src/content/maps/empty.jsonc`、`MT0.jsonc`、`sample0.jsonc` — 地图文件样例
- `E:/github/template/src/content/texture/.list.jsonc` — 纹理 / 图集清单（`type` / `source` / `map` 编号列表 / `width` / `height`）
- `E:/github/template/src/content/tile.jsonc` — 图块表（`num` / `id` / `type` / `eventPass` / `pass.outPass` / `pass.inPass`）

### 现有地图实现（画面 / 行为参照，重写进 `editor-impl/map`，仅作参考不照抄）
- `packages/apps/editor/src/MapEditor/index.tsx` — 主面板装配、快捷键、工具栏 / 素材区 / 画布协作
- `packages/apps/editor/src/MapEditor/MapCanvas.tsx` — 鼠标手势（左键绘制、右键框选、右键菜单、取消笔画）、选区与画布绘制
- `packages/apps/editor/src/MapEditor/MapEditorStore.ts` — 交互状态（图层、画笔、视口、大地图、选区、复制数据、最近楼层）
- `packages/apps/editor/src/MapEditor/ToolBar.tsx` — 图层切换、画笔模式、通行度开关、视口 / 大地图、楼层选择
- `packages/apps/editor/src/MapEditor/ContextMenu.tsx` — 右键菜单项与行为（其中事件相关项本阶段不做）
- `packages/apps/editor/src/MapEditor/RecentlyUsedPanel.tsx` — 最近 / 最常使用图块、置顶、清除
- `packages/apps/editor/src/MapEditor/MaterialPanel/` — 素材面板、分组折叠、多格选择、布局
- `packages/apps/editor/src/MapEditor/rendering/` — Pixi 渲染、楼层图片、图块解析
- `packages/apps/editor/src/MapEditor/utils/` — 坐标、画笔几何、BFS 填充、绘制预览、绘制辅助
- `packages/apps/editor/src/project/model/passability.ts` — 旧通行性推导（四方向、cannotIn/Out、cannotMove）
- `packages/apps/editor/src/project/model/tilesetCatalog.ts` — 图集目录与编号区间
- `packages/apps/editor/src/project/commands/mapCommands.ts`、`materialCommands.ts` — 旧地图命令与可逆操作参照
- `packages/apps/editor/src/project/settings/mapLayerSettings.ts` — 旧图层设置（本阶段只作参照，不实现设置面板）

### 目标落点与底座
- `packages/libs/editor-impl/package.json` — 已预留 `./map` 子路径与 pixi.js / antd 等 peerDependencies
- `packages/libs/editor-impl/src/`（当前无 `map/`）— 默认实现落点（`table/`、`asset/`、`shared/` 已存在）
- `packages/libs/editor-impl/src/shared/schemaForm/` — 表单引擎（控件 / 校验 / 呈现），用于地图属性表单（D-15）
- `packages/libs/editor-impl/src/shared/jsonc/tableText.ts` — `.jsonc` 系统前缀解析 / 写回，用于项目内偏好文件（D-11）
- `packages/libs/editor-impl/src/asset/`、`table/` — 面板结构、空态、手动保存、能力注入的既有范式
- `packages/libs/editor-core/src/resource/` — 路径资源、文件索引、内容缓存（偏好文件与图片字节的底座）
- `packages/libs/editor-core/src/undo/types.ts` — `IUndoSystem`（`addUndoContext` / `undo(): Promise<boolean>` / `redo(): Promise<boolean>` / 屏障）
- `packages/libs/editor-core/src/fs/types.ts` — `IEditorFileSystem`（core 唯一调用方，面板不得直接用）
- `packages/libs/editor-core/src/shell/` — `registerPanelType`、`onSwitchIn` / `onSwitchOut`
- `packages/libs/editor-core/src/panel/types.ts` — `IEditorPanel` / `IEditorPanelContext`
- `packages/apps/editor-dev/src/backend/types.ts`、`memoryBackend.ts` — 开发宿主内存后端，本阶段地图演示的注入点
- `packages/apps/editor-dev/src/main.tsx`、`demo/` — 开发宿主装配与演示数据

### 门禁与规范
- `scripts/verify/coreEngineNeutral.js` — 禁止引擎专有词字面量（`tower` / `floor` / `loc` / `autotile` / `idnum` / `airwall` / `mota` 等，含注释）出现在 `editor-core` 与 `editor-impl/src`
- `scripts/verify/coreModuleState.js` — 模块级可变状态 / `document` / `fetch` / `navigator` / `localStorage` 门禁（`window` 允许）
- `scripts/verify/coreImportType.js`、`coreExports.js`、`implExports.js`、`coreBoundaries.js` — 接口与边界门禁
- `.dependencyCruiser.cjs` — `capabilities-must-not-import-each-other`（`map` 不得 import `table` / `asset` / `code`）
- `AGENTS.md` §Code style、§Project Rules（先接口后实现 / 重要命名先确认 / 方法写 `类名.方法名` / 说人话）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`editor-impl/src/shared/schemaForm`**（Phase 3 抽出）：schema 驱动的表单 / 校验 / 控件，可直接用于「地图属性表单」（D-15），避免地图能力依赖 `table` 能力。
- **`editor-impl/src/shared/jsonc/tableText.ts`**：`.jsonc` 系统前缀解析 / 写回，可用于项目内偏好文件（D-11）。
- **`editor-core` 资源层**（`resourceSystem` / `fileIndex` / `contentCache`）：路径资源的读写底座；偏好文件与（可能的）图块图片字节都经它，面板不直接触达文件系统。
- **`editor-core` 撤销层**（`IUndoSystem.addUndoContext` / `undo()` / `redo()`）：一笔一次撤销（D-17）；撤销返回布尔值，可直接提示「无法撤销」。
- **Phase 1 外壳**（`registerPanelType` / `IEditorPanelType` / `onSwitchIn` / `onSwitchOut`）：地图面板类型注册与切入刷新。
- **`editor-impl/asset` 的面板范式**：空栏内联、手动保存、能力 Provider、分组导航，可作地图面板的结构参照。
- **开发宿主**（`editor-dev` 内存后端 + `demo/`）：本阶段必须接入并在浏览器里可打开、可画、可保存。

### Established Patterns
- **能力只导出面板类型对象**，由顶层（开发宿主 / 未来 `@motajs/editor`）注册；能力包不自行装配（Phase 1.1 D-05 / Phase 2 D-01）。
- **能力之间不得互相 import**（`.dependencyCruiser.cjs`）；共用件只放 `shared/`（Phase 3 D-28）。
- **`editor-core` / `editor-impl` 引擎无关**：不得出现引擎专有词、不得读文件、不得持有模块级可变状态；数据一律经注入（`coreEngineNeutral` / `coreModuleState` 门禁）。
- **手动保存模型**：编辑先改内存、显式保存才写盘；切换 / 关闭前处理未保存（Phase 2.1 / 3 已确立）。
- **统一撤销路径**：每次可逆编辑记一条 `IUndoContext`；不可逆操作用屏障（Phase 3）。
- **面板切入时重新取数据**（`onSwitchIn`），不依赖跨面板广播（Phase 2 D-15 修订）。
- **样式用 antd + 局部 CSS**，不引入 PandaCSS（Phase 2 D-08）。
- **空态内联**：没有内容时直接在面板里给出可操作入口（Phase 2.1 / Phase 3）。
- **平台门禁**：图片编解码须用 `OffscreenCanvas` / `createImageBitmap`，不得 `document.createElement('canvas')`；渲染可用 PixiJS（`pixi.js` 已是 peerDependency）。

### Integration Points
- `@motajs/editor-impl` 的 `./map` 子路径：导出地图面板类型对象、底层地图组件、必要的类型。
- **宿主注入点**：地图清单 + 打开回调 + 按域拆分的保存接口（地图数据 / 地图属性 / 事件）、图块目录、尺寸上限、地图属性 Schema；不同项目可注入不同实现（D-04）。
- 开发宿主：注册地图面板类型、注入内存后端与演示地图 / 图块目录，完成端到端手动验收。
- 未来 `@motajs/editor`：实现自己的宿主适配器，把 mota-js / 新引擎的文件解析成中立文档并写回。

</code_context>

<specifics>
## Specific Ideas

- 用户原话要点：
  - 「整份通用文档」；面板不认识文件格式与路径。
  - 「地图接口传入整张地图，地图属性传入整个地图属性表，事件传入所有事件，类似这样分」——保存接口按域拆分，不同项目注入不同实现。
  - 「先不做编辑通行性，目前的新引擎的通行性全部由图块本身的属性确定，无法单独调整地图的通行性」；但仍要「只显示不可改」。
  - 「要做支持多格。在选中多格后，鼠标移动到地图上，应该显示一个矩形范围，而不是只有一个图块。」
  - 「选中一个区域之后可以复制这一个区域的图块，之后可以粘贴，粘贴规则为鼠标放置在的位置为左上角，超出地图的部分裁剪。」
  - 「调色板放一个『空』格子」作为擦除方式。
  - 「最近使用图块」单独分区并持久化。
- 新版引擎地图数据形状：`{ floorId, width, map: Record<layerIndex, number[]>, layerAlias: Record<layerIndex, string>, events: Record<layerIndex, Record<positionIndex, Record<priority, eventId>>> }`；**没有显式 height**（由图层数组推导）。
- 图块表形状：`{ num, id, events, type, eventPass, pass: { onlyEvents, outPass, inPass } }`；通行性由 `outPass` / `inPass` 等属性决定。

</specifics>

<deferred>
## Deferred Ideas

- **编辑通行性** —— 用户指示本阶段不做；新引擎通行性由图块属性决定，后续若要做需重新定义数据与交互（D-13 / D-23）。
- **点事件的显示 / 绑定 / 编辑** —— 留给 Phase 6 事件编辑器；届时与按域注入的事件接口对接（D-22）。
- **图块属性编辑**（名称 / 通行方向 / 事件模板）—— 属图块 / 素材配置能力，不在本阶段（D-14）。
- **图层重命名 / 排序 / 删除 / 图层设置面板** —— 旧编辑器有，本阶段只切换与新增（D-07）。
- **事件叠加、右键事件菜单项、复制粘贴事件** —— 依赖事件能力，本阶段不做。
- **旧编辑器的楼层切换 / 后退、绑定楼梯 / 传送门 / 机关门** —— 属引擎专属交互，本阶段不做。
- **插件加载 / 注册机制** —— 后续里程碑。

</deferred>

---

*Phase: 4-地图编辑*
*Context gathered: 2026-10-20*
