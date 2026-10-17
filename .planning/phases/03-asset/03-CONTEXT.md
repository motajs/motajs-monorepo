# Phase 3: 素材管理 - Context

**Gathered:** 2026-10-15
**Status:** Ready for planning
**Note:** 本轮讨论依据**新版引擎的内容模型**（用户 2026-10-15 提供）重新界定了素材范围——详见 §F。部分细节（资源层接口修订、转码配置界面、新增素材交互）仍待用户后续补充。Phase 3 讨论稿中受 Phase 2.1 影响的前提（D-04 / D-05 / D-06 / D-11 及参考、结构、集成点说明）已全部回改；前提由「类型号 + 标识串、只定义 fs 不实现」改为「路径标识 + 索引 + core 驱动 fs」。
**Reorganized (2026-10-17):** Phase 2.1（资源层重构 + 表格文件管理，26/26 完成）落地后，本文件按其**实际交付**重新整理：并入其资源 API / 文件索引 / 内容缓存、**手动保存**模型、`.jsonc` 系统前缀逐字保留、空栏内联交互等约束（见 §H）；保存模型由 D-13 修订为「手动保存（与表格一致）」（用户 2026-10-17 确认）。

<domain>
## Phase Boundary

本阶段交付「素材管理」能力，作为 `@motajs/editor-impl/asset` 的默认实现：用户可在编辑器里打开**一个「素材管理器」面板**，按**大分类**（图片 / 音频 / 动画 / 字体）浏览、**新增（本地上传文件）/ 替换 / 删除 / 配置**素材；改动物化到 `editor-core` 资源层并异步持久化；画面与行为与现状一致（对齐现有 `@motajs/editor` 的素材能力）。另含**瘦身转码**：图片 → WebP、音频 → WebM/Opus。

不含：地图 / 代码 / 事件编辑器（Phase 4/5/6）、插件加载机制、地图编辑器的图块调色板本身（属地图能力）。

**方向修订（本轮）：** 素材不再「合并成一张图、按行拆成多个素材」；新引擎把素材**整合**为「大分类 + 每个素材单独配置」，并且 `editor-impl/asset` 必须保持**通用**（不是新引擎专属）——通过注入分类清单 + 双套 Schema 保留自定义空间。

</domain>

<decisions>
## Implementation Decisions

### A. 范围与面板结构

- **D-01:** 素材能力交付**一个「素材管理器」面板**，内部按**大分类**组织；不做现状那种细分，**每个素材单独配置**。 — **Reversibility:** costly — 面板拆分与对外导出面一旦被第三方依赖，重组需要迁移调用方与交互。
- **D-02:** 大分类为**图片（texture）/ 音频（audio）/ 动画（animation）/ 字体（font）**；以新版引擎内容模型为准（另有 `maps` 分类，属地图能力，**不算素材**）。
- **D-03:** 素材操作集合 = **浏览 / 新增（本地上传文件）/ 替换 / 删除 / 配置**。

### B. 数据来源（`editor-core` 资源层）

- **D-04:** 素材的**列表与字节都经 `editor-core` 资源层**获取与写入；**不**直接触达真实文件系统，一律经注入的 `IEditorFileSystem` 与资源系统（core 的资源系统是文件系统的唯一调用方）。 — **Reversibility:** costly — 数据访问一旦铺开，换抽象要改面板与所有写入点。
- **D-05:** **资源粒度按文件路径**：每个分类的 **`.list.jsonc` 列表文件是一个路径资源**（内容 = 该分类的条目数组）；每个**素材字节文件各自是一个路径资源**；面板把「列表文件 + 字节文件」二者结合。
- **D-06:** `IResourceIdentifier` = **纯文件路径**（相对项目根、以 `/` 分隔、不带前导斜线）；路径即标识，core 以它读写、建索引。

### C. 配置表单与 Schema（复用表格引擎）

- **D-07:** **每素材配置表单复用 Phase 2 的 JSON Schema 表格/表单引擎**（`ITableSchemaNode` 及其控件/校验/撤销）。
- **D-08:** `editor-impl/asset` **内置两套分类 Schema**：**legacy**（= 现有 `@motajs/editor` 的旧素材模型，`tower.main.images` / `icons.js` / `maps.js` 那套）与**新引擎**（按新内容模型）；**由装配方按引擎选择注入**。
- **D-09:** **Schema 解析顺序**——**引擎自带的分类 Schema 优先**（约定**固定文件名**，如每个分类目录下一个约定文件 `.schema.jsonc`）；读不到则**回退到内置 Schema**。
- **D-10:** **新增素材的默认值取自 `defaults`**（`defaults/*.jsonc`）；其中 `@required` 作为**字段必需性**参与校验，对象按「逐属性比较」语义合并。
- **D-11:** **注入 + 内置默认**：`editor-impl/asset` 内置「图片 / 音频 / 动画 / 字体」四种**预览**与通用框架作为默认；引擎在顶层**注入分类清单与「分类 → 目录 / 列表文件路径」的映射、配置表单描述**，可增删改——资源不再有类型号，按文件路径（含目录约定）组织。

### D. 素材选择器

- **D-12:** **`editor-impl/asset` 提供默认素材选择器**（自行按分类列素材、缩略图 / 播放预览、返回选中项），作为 asset 能力注入；表格、Blockly 等经接缝调用它。

### E. 编辑 / 撤销 / 持久化

- **D-13（Phase 2.1 修订）:** 素材编辑走 `editor-core` **统一撤销**路径；保存模型 = **手动保存**，与表格一致——列表与配置改动先记在内存，需**显式保存**才落盘（沿用 Phase 2.1 表格的手动保存模型，目的是**逐字保留 `.jsonc` 系统前缀注释块**、避免自动保存反复写盘）。
- **D-14:** **字节改动（新增 / 替换 / 删除）不可撤销**——记进历史但作为**屏障**：撤销碰到它就**停住**、返回 `false` 并提示「无法撤销」；**不**跳过它去撤销更早的配置改动。配置改动正常可撤销。
- **D-15:** 给 `editor-core` 的 **undo / redo 增加布尔返回值**：`false` = 无法执行，`true` = 成功。 — **Reversibility:** one-way — 这会改动撤销系统的对外契约，一旦有调用方依赖旧签名，回退需迁移它们。
- **D-16:** **「新增素材」= 本地上传一个文件**（经资源层写入新字节资源 + 往列表资源追加条目）。

### F. 素材整合（新版引擎方向）

- **D-17:** **不再合并成一张图**：图片直接放分类目录、注册后按配置读取。一张图有不同**读取方式**（`TextureReadType`：`Full` / `Grid` / `RowAnimate` / `ColumnAnimate` / `ScanAnimate`），可对应**一个或多个图块**（`TextureUsage`：`CommonImage` / `Tile` / `Tileset`，配合 `grid` / `tiles`）；**帧率不再按类型强制限制，最大 255 帧**。
- **D-18:** **BGM 与音效合并到「音频」分类**，靠配置区分（`ClientAudioType`：`BGM` / `Sound`）。

### G. 瘦身转码

- **D-19:** 面板提供两个转码动作：**图片 → WebP（可选 quality）**、**音频 → WebM 容器中的 Opus**，以降低存储与加载压力。
- **D-20:** 音频转码使用 **Mediabunny**（`mediabunny` 库：纯浏览器、TypeScript、零依赖、基于 WebCodecs、支持 WebM 输出 + Opus、可 tree-shake）。需新增 workspace 依赖并进 catalog。 — **Reversibility:** costly — 引入运行时依赖；更换转码链需改整条转码路径。
- **D-21:** **允许批量转换**；加一个**「覆盖旧文件」勾选框，默认勾选**。不勾 → 旧文件改名为 **`{file}-origin.{ext}`** 保留；勾 → 二次确认弹窗，**明确说明原文件会被替换、无法找回**。
- **D-22:** **转码参数允许用户配置**（WebP 的 quality、音频码率 / 采样率等基础项）。

### H. Phase 2.1 落地契约（本轮并入）

- **D-23:** **资源 API 以 Phase 2.1 落地为准**：`IResourceIdentifier` = 纯文件路径；`IResourceSystem` 提供 `requestResource` / `createResource` / `deleteResource` / `moveResource` / `listDirectory`，以及 `readContent` / `writeContent`；`editor-core` 只注入 **`IEditorFileSystem`**（含 `readBinary` / `writeBinary`），并维护**项目文件索引**（初始化全扫 + 增删移增量 + 忽略模式）与带 **8 MiB** 上限的 LRU **内容缓存**。**无「按类型列资源」**——**列某分类的素材 = `listDirectory(分类目录)` / 读索引**。 — **Reversibility:** costly — 这是 Phase 2.1 已发布并落地的资源契约。
- **D-24:** **保存模型 = 手动保存（与表格一致）**：列表与配置改动先记在内存，需**显式保存**才写盘；`.list.jsonc`（及分类 schema 文件）写回**逐字保留 `.jsonc` 系统前缀注释块**（`// --- SYSTEM PREFIX END --- //` 及其之前文本），复用表格的 `parseTableText` / `serializeTableText` 约定（文件名/前缀约定由规划阶段提出并经 `INTERFACE-NAME.md` 确认）。
- **D-25:** **素材字节改动（新增 / 替换 / 删除 / 转码）不可撤销**，作为撤销屏障（与 D-14 一致）；其**何时落盘**（随手动保存一并落盘，还是上传时即写）由规划阶段定，但「不可撤销 / 屏障」语义不变。
- **D-26:** 素材面板**空态借鉴 Phase 2.1 的空栏内联模式**（空分类时内联呈现「新增 / 选择」入口，而非仅一句空文案）；是否复用 `TablePicker` / `TableCreateForm` 的组件思路由规划阶段定。
- **D-27:** **schema 文件身份沿用 Phase 2.1 的文件名约定**（数据 `xxx.json` / `xxx.jsonc`，schema `xxx.schema.json` / `xxx.schema.jsonc`）；各分类「引擎自带 Schema」的约定文件名由规划阶段提出并经 `INTERFACE-NAME.md` 确认。

### the agent's Discretion

- 面板与底层组件的具体接口形状、方法名、字段名、预览实现细节、各分类 Schema 的具体字段表达（`x-editor` / `x-control` 等扩展键用法）、转码配置界面的呈现——由研究 / 规划阶段提出；**命名按项目规则先经用户确认（`INTERFACE-NAME.md`，每 Plan 一节）**。
- 目录约定文件名（如 `.schema.jsonc`）的确切命名、分类清单的注入形状，由规划阶段提出并确认。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 里程碑与需求
- `.planning/PROJECT.md` — 里程碑 v1.0（editor-core 空壳 + editor-impl 重做）
- `.planning/REQUIREMENTS.md` — 本阶段对应 **ASSET-01**
- `.planning/ROADMAP.md` §Phase 3（目标 + 4 条验收）与 §Cross-cutting Constraints（能力须接入 dev 宿主）

### 前序阶段产出
- `.planning/phases/01-shell/01-CONTEXT.md`、`INTERFACE-NAME.md` — 外壳契约与命名（`EditorCore` / `ShellSystem` / `IEditorPanelType`）
- `.planning/phases/01.1-dev-host/01.1-CONTEXT.md` — dev 宿主与「能力只导出面板类型对象、顶层装配」的约定（D-05）
- `.planning/phases/02-table/02-CONTEXT.md` — 表格决策（资源层、注入式打开器、切换刷新、JSON Schema 表格引擎、撤销）
- `.planning/phases/02.1-resource-layer/02.1-CONTEXT.md`、`INTERFACE-NAME.md`、`02.1-VERIFICATION.md` — **资源层重构（路径标识 / 文件索引 / 内容缓存 / fs 注入）+ 表格「打开 / 新建 / 删除」与手动保存**；本阶段资源契约、要复用的表格引擎与交互模式的直接来源

### 新版引擎内容模型（本阶段范围依据 —— 仓库外）
- `E:/github/template/packages-user/client-modules/src/common.ts` — `IClientTextureListConfig` / `TextureReadType` / `TextureUsage` / `IClientAudioListConfig` / `ClientAudioType` / `IClientContentConfig` / `IClientContentDefaultConfig`
- `E:/github/template/src/content/{texture,audio,animation,font}/.list.jsonc` — 各分类列表文件（文件头注释给出类型）
- `E:/github/template/src/content/defaults/*.jsonc` — 各分类默认条目（含 `@required`）

### 现有素材实现（画面 / 行为参照，重写进 `editor-impl/asset`，仅作参考不照抄）
- `packages/apps/editor/src/project/assets/` — `ProjectAssets` / `ImageAssetResource` / `MaterialCollectionResource` / `AssetDirectoryResource` / `AnimationAssetResource` / `CanvasRasterCodec` / `raster.ts` / `materialSpecs.ts` / `types.ts`
- `packages/apps/editor/src/Workbench/ResourcesWorkspace/` — 资源管理器（8 目录、注册、拆分图、图块顺序）
- `packages/apps/editor/src/Workbench/AppendPicPanel/` — 追加素材（导入图片 + 网格框选）
- `packages/apps/editor/src/Workbench/PrefabPanel/` — 图块属性（注册 / 改名 / 删除）
- `packages/apps/editor/src/Workbench/modals/SelectMaterial/` — 素材选择弹窗（含 `AnimationPreviewEditor` 声效编辑）
- `packages/apps/editor/src/components/SchemaTable/ImageAssetPickerModal.tsx`、`FloorImagesFieldEditor.tsx` — 图片选择 + 裁剪参照
- `packages/apps/editor/src/project/commands/materialCommands.ts`、`animationCommands.ts`、`packages/apps/editor/src/project/history/materialOperations.ts` — 素材命令与可逆操作参照

### 目标落点与底座
- `packages/libs/editor-impl/package.json` — 已预留 `./asset` 子路径与 peerDependencies（antd / pixi.js / semi-ui 等）
- `packages/libs/editor-impl/src/` — 默认实现落点（`./table`、`./react` 已存在）
- `packages/libs/editor-impl/src/react/` — 能力接缝（`ITableEditorCapabilities` / `IMultiSelectOpener` / `CapabilityProvider` / `MultiSelectModal`）
- `packages/libs/editor-core/src/resource/types.ts` — 资源层接口（`IResourceIdentifier`（= 纯文件路径）/ `ResourceContent`（`string | Uint8Array`）/ `IResourceSystem` / `IResourceSystemAccess` / `IFileIndex` / `IContentCache` / `CONTENT_CACHE_MAX_BYTES`）
- `packages/libs/editor-core/src/resource/resourceSystem.ts`、`fileIndex.ts`、`contentCache.ts` — 资源系统实现 / 项目文件索引 / LRU 内容缓存
- `packages/libs/editor-core/src/fs/types.ts` — `IEditorFileSystem`（注入的文件系统；`readFile` / `writeFile` / `readBinary` / `writeBinary` / `listDirectory` / `makeDirectory` / `moveFile` / `deleteFile`）+ `EditorEntryKind`
- `packages/libs/editor-impl/src/table/model/tableText.ts` — `.jsonc` 系统前缀解析 / 写回（`parseTableText` / `serializeTableText`），素材列表与配置表单可直接复用
- `packages/libs/editor-impl/src/table/components/`（`TablePicker` / `TableCreateForm` / `TableEmptyColumn`）与 `types.ts`（`ITablePanelTarget.dataPath` / `ITablePanel.save` / `TableEmptyMode`）— 表格的空栏内联与手动保存实现，作参照
- `packages/apps/editor-dev/src/backend/types.ts` — dev 宿主内存后端 `IMemoryBackend extends IEditorFileSystem`（含 `seed`），本阶段接入素材演示的参照
- `packages/libs/editor-core/src/undo/` — 撤销系统（D-15 需加返回值）
- `packages/libs/editor-core/src/shell/` — 外壳（`registerPanelType`、切换时 `onSwitchIn` / `onSwitchOut`）

### 外部依赖
- Mediabunny — https://mediabunny.dev/ 、https://github.com/Vanilagy/mediabunny （音频 → WebM/Opus 转码，D-20）

### 规范
- `AGENTS.md` §Code style、§Project Rules（先接口后实现 / 重要命名先确认 / 方法写 `类名.方法名` / 说人话）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Phase 2 表格/表单引擎**（`editor-impl/table`：`TableGrid` / `TableRow` / 五类行内控件 / `model/validation` / `schemaPresentation` / 撤销提交 / **`parseTableText` + `serializeTableText`（`.jsonc` 系统前缀）** / **手动保存（`ITablePanel.save`）** / **空栏内联（`TableEmptyColumn` / `TablePicker` / `TableCreateForm`）**）：直接复用为「每素材配置表单」（D-07），并借其 `.jsonc` 前缀与手动保存、空栏内联模式（D-24 / D-26）。
- **`editor-impl/react` 能力接缝**（`ITableEditorCapabilities` / `IMultiSelectOpener` / `CapabilityProvider` / `MultiSelectModal`）：素材选择器可作为一项 asset 能力注入（D-12）。
- **`editor-core` 资源层**（`IResourceSystem` / `IResourceIdentifier`（= 路径）/ `IResourceSystemAccess`）：素材列表与字节的底座（D-04/D-05）。
- **`editor-core` 撤销层**（`undo`）：统一撤销；D-15 需要加返回值。
- **Phase 1 外壳**（`ShellSystem.registerPanelType` / `IEditorPanelType` / `onSwitchIn` / `onSwitchOut`）：素材面板类型注册落点、切入时重取。
- **现状可搬运的通用件**：`CanvasRasterCodec` + `raster.ts`（canvas 编解码 / 纯像素运算）、`GridCanvas`（网格框选）、`useImageAssetUrl`、`ImagePreview` / `AudioPreview` / `ModalShell`、`appendPic/materialConfig`（网格尺寸 / 帧数）、`MapEditor/MaterialPanel/layout`（调色板布局）。

### Established Patterns
- 类先 `interface` 再 `implements`；`type` 别名写 jsDoc、类 / 接口不写；jsDoc 逐参；barrel `export *`；`editor-core` 引擎无关、不读文件、数据经注入。
- `editor-impl` 是默认实现、依赖 `editor-core`；能力包只导出面板类型对象，顶层装配注册（Phase 1.1 D-05 / Phase 2 D-01）。
- 面板在 `onSwitchIn` 里重新请求资源（Phase 2 D-15 修订 / D-31）。
- 外部能力经注入式接缝（`IXxxPanelParam extends Record<string, unknown>`、`ITableEditorCapabilities`）。
- 样式用 antd + 局部 CSS，不引入 PandaCSS（Phase 2 D-08）。
- **资源按文件路径读写**，`editor-core` **驱动注入的文件系统**并维护**项目文件索引 + LRU 内容缓存**（Phase 2.1）；无「按类型列资源」，列目录用 `listDirectory` / 读索引。
- **`.jsonc` 一律经 `parseTableText` / `serializeTableText` 解析与写回**，**逐字保留系统前缀注释块**（Phase 2.1）。
- **手动保存模型**：面板编辑先记内存、**显式保存**才落盘（Phase 2.1 表格确立，本阶段沿用）。
- `editor-core` 有其模块状态 / `document` 全局门禁（PORT-02）；canvas 编解码等浏览器专有逻辑放 `editor-impl`。

### Integration Points
- `@motajs/editor-impl` 的 `./asset` 子路径导出（`package.json` 已预留）：面板类型常量（如 `assetPanelType`）+ 底层组件 + 默认素材选择器 + 内置 Schema 集。
- 装配方（dev 宿主 / 未来 `@motajs/editor`）：注册面板类型、注入分类清单、分类 → 目录 / 列表文件路径的映射、配置 Schema、注入素材选择器能力、提供注入的文件系统实现（`IEditorFileSystem`）。
- 分类资源标识：`.list.jsonc` 列表文件与各素材字节文件各自是一个**文件路径资源**（路径即标识，如 `content/texture/.list.jsonc`、`content/texture/x.png`）；**列某分类的素材 = `listDirectory('content/texture')` / 读索引**；增删 = `createResource` / `deleteResource`；转码旧文件改名 = `moveFile` → `{file}-origin.{ext}`。

</code_context>

<specifics>
## Specific Ideas

- 用户原话要点：「新版引擎已经把素材进行了整合，只需要区分图片、音频、动画、字体等大分类即可，不再需要细分，每个素材单独进行配置」「应该保留一定的自定义空间，比如素材配置提供两套，一套是 legacy，一套是新引擎的……复用表格配置，理应就是写两套 Schema」「后面计划给这些 `.list.jsonc` 添加自己的 Schema 在引擎里面，优先尝试读取引擎包含的 Schema，如果没有再回退到内置的」「允许批量转换，并添加一个勾选框，表示是否覆盖旧文件，默认选择；如果不选，那么将旧文件命名为 `{file}-origin.{ext}`；如果选了……弹出一个弹窗明确说明这会导致原文件被替换，无法找回」「转码时应允许用户进行适当的配置，比如 webp 的 quality，音频的码率、采样率等基础配置」「目前的设计约束太强，导致面板根本无法获得路径，也难以实施新增素材等功能」（已加 `path`）。
- 新版内容模型（以类型为准，勿以未对齐的实际内容为准）：texture 项 `{ source, read, usage, grid?, tiles? }`；audio 项 `{ type: BGM|Sound, source }`；animation / font 为 `string[]`。

</specifics>

<deferred>
## Deferred Ideas

- **资源层接口修订已由 Phase 2.1 完成**：`IResourceIdentifier` = 纯文件路径；资源按路径读写、core 驱动注入的文件系统并维护项目索引（其资源 API / 手动保存 / `.jsonc` 前缀逐字保留 / 空栏内联约束已并入 **§H**）。
- **转码配置界面 / 新增素材输入体验等交互细节**：待后续继续讨论。
- **引擎为各 `.list.jsonc` 自带 Schema**：格式与存放细节后续定（本阶段先按「约定固定文件名 + 回退内置」实现）。
- **地图 / 代码 / 事件编辑器**：Phase 4/5/6。
- **插件加载 / 注册机制**：后续里程碑。
- **dev 宿主接入**：本阶段收尾工作之一（ROADMAP §Cross-cutting Constraints），具体演示数据由规划阶段定。

</deferred>

---

*Phase: 3-素材管理*
*Context gathered: 2026-10-15*
