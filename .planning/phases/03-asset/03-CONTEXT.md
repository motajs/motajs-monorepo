# Phase 3: 素材管理 - Context

**Gathered:** 2026-10-15
**Status:** Ready for planning
**Note:** 本轮讨论依据**新版引擎的内容模型**（用户 2026-10-15 提供）重新界定了素材范围——详见 §F。部分细节（资源层接口修订、转码配置界面、新增素材交互）仍待用户后续补充。

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

- **D-04:** 素材的**列表与字节都经 `editor-core` 资源层**获取与写入；**不**使用 Phase 1 的通用 fs 接口（`IEditorFileSystem`，CORE-01 明确禁止 core/impl 引用）。 — **Reversibility:** costly — 数据访问一旦铺开，换抽象要改面板与所有写入点。
- **D-05:** **资源粒度**：每个分类的 **`.list.jsonc` 列表文件 = 一个资源**（内容 = 该分类的条目数组）；每个**素材字节文件各自是一个资源**；面板把「列表资源 + 字节资源」二者结合。
- **D-06:** `IResourceIdentifier` 新增 **`path`** 成员；该 path **在 core 中不消费、只在 impl 中消费**，用于判定与写入。（资源层接口的进一步修订**由用户自行进行**；`path` 当前为未提交改动。）

### C. 配置表单与 Schema（复用表格引擎）

- **D-07:** **每素材配置表单复用 Phase 2 的 JSON Schema 表格/表单引擎**（`ITableSchemaNode` 及其控件/校验/撤销）。
- **D-08:** `editor-impl/asset` **内置两套分类 Schema**：**legacy**（= 现有 `@motajs/editor` 的旧素材模型，`tower.main.images` / `icons.js` / `maps.js` 那套）与**新引擎**（按新内容模型）；**由装配方按引擎选择注入**。
- **D-09:** **Schema 解析顺序**——**引擎自带的分类 Schema 优先**（约定**固定文件名**，如每个分类目录下一个约定文件 `.schema.jsonc`）；读不到则**回退到内置 Schema**。
- **D-10:** **新增素材的默认值取自 `defaults`**（`defaults/*.jsonc`）；其中 `@required` 作为**字段必需性**参与校验，对象按「逐属性比较」语义合并。
- **D-11:** **注入 + 内置默认**：`editor-impl/asset` 内置「图片 / 音频 / 动画 / 字体」四种**预览**与通用框架作为默认；引擎在顶层**注入分类清单、资源类型号（`IResourceIdentifier.type`，由外部枚举定义）、配置表单描述**，可增删改。

### D. 素材选择器

- **D-12:** **`editor-impl/asset` 提供默认素材选择器**（自行按分类列素材、缩略图 / 播放预览、返回选中项），作为 asset 能力注入；表格、Blockly 等经接缝调用它。

### E. 编辑 / 撤销 / 持久化

- **D-13:** 素材编辑走 `editor-core` **统一撤销**路径，写盘经资源层**异步持久化**（内存优先、最终一致）。
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
- `packages/libs/editor-core/src/resource/types.ts` — 资源层接口（`IResourceIdentifier`（含新增 `path`）/ `IResourceInjection` / `IResourceSystem`）
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
- **Phase 2 表格/表单引擎**（`editor-impl/table`：`TableGrid` / `TableRow` / 五类行内控件 / `model/validation` / `schemaPresentation` / 撤销提交）：直接复用为「每素材配置表单」（D-07）。
- **`editor-impl/react` 能力接缝**（`ITableEditorCapabilities` / `IMultiSelectOpener` / `CapabilityProvider` / `MultiSelectModal`）：素材选择器可作为一项 asset 能力注入（D-12）。
- **`editor-core` 资源层**（`IResourceSystem` / `IResourceIdentifier` / `IResourceInjection`）：素材列表与字节的底座（D-04/D-05）。
- **`editor-core` 撤销层**（`undo`）：统一撤销；D-15 需要加返回值。
- **Phase 1 外壳**（`ShellSystem.registerPanelType` / `IEditorPanelType` / `onSwitchIn` / `onSwitchOut`）：素材面板类型注册落点、切入时重取。
- **现状可搬运的通用件**：`CanvasRasterCodec` + `raster.ts`（canvas 编解码 / 纯像素运算）、`GridCanvas`（网格框选）、`useImageAssetUrl`、`ImagePreview` / `AudioPreview` / `ModalShell`、`appendPic/materialConfig`（网格尺寸 / 帧数）、`MapEditor/MaterialPanel/layout`（调色板布局）。

### Established Patterns
- 类先 `interface` 再 `implements`；`type` 别名写 jsDoc、类 / 接口不写；jsDoc 逐参；barrel `export *`；`editor-core` 引擎无关、不读文件、数据经注入。
- `editor-impl` 是默认实现、依赖 `editor-core`；能力包只导出面板类型对象，顶层装配注册（Phase 1.1 D-05 / Phase 2 D-01）。
- 面板在 `onSwitchIn` 里重新请求资源（Phase 2 D-15 修订 / D-31）。
- 外部能力经注入式接缝（`IXxxPanelParam extends Record<string, unknown>`、`ITableEditorCapabilities`）。
- 样式用 antd + 局部 CSS，不引入 PandaCSS（Phase 2 D-08）。
- `editor-core` 有其模块状态 / `document` 全局门禁（PORT-02）；canvas 编解码等浏览器专有逻辑放 `editor-impl`。

### Integration Points
- `@motajs/editor-impl` 的 `./asset` 子路径导出（`package.json` 已预留）：面板类型常量（如 `assetPanelType`）+ 底层组件 + 默认素材选择器 + 内置 Schema 集。
- 装配方（dev 宿主 / 未来 `@motajs/editor`）：注册面板类型、注入分类清单 / 资源类型号 / 配置 Schema、注入素材选择器能力、提供资源层实现。
- 分类资源标识：`.list.jsonc`（列表资源，type = 分类）+ 各素材字节资源（path 经 `IResourceIdentifier.path`）。

</code_context>

<specifics>
## Specific Ideas

- 用户原话要点：「新版引擎已经把素材进行了整合，只需要区分图片、音频、动画、字体等大分类即可，不再需要细分，每个素材单独进行配置」「应该保留一定的自定义空间，比如素材配置提供两套，一套是 legacy，一套是新引擎的……复用表格配置，理应就是写两套 Schema」「后面计划给这些 `.list.jsonc` 添加自己的 Schema 在引擎里面，优先尝试读取引擎包含的 Schema，如果没有再回退到内置的」「允许批量转换，并添加一个勾选框，表示是否覆盖旧文件，默认选择；如果不选，那么将旧文件命名为 `{file}-origin.{ext}`；如果选了……弹出一个弹窗明确说明这会导致原文件被替换，无法找回」「转码时应允许用户进行适当的配置，比如 webp 的 quality，音频的码率、采样率等基础配置」「目前的设计约束太强，导致面板根本无法获得路径，也难以实施新增素材等功能」（已加 `path`）。
- 新版内容模型（以类型为准，勿以未对齐的实际内容为准）：texture 项 `{ source, read, usage, grid?, tiles? }`；audio 项 `{ type: BGM|Sound, source }`；animation / font 为 `string[]`。

</specifics>

<deferred>
## Deferred Ideas

- **资源层接口修订**（支持新增素材、`path` 获取等）：**用户自行进行**；`IResourceIdentifier.path` 已加入（core 不消费、impl 用于判定与写入），当前为未提交改动。
- **转码配置界面 / 新增素材输入体验等交互细节**：待后续继续讨论。
- **引擎为各 `.list.jsonc` 自带 Schema**：格式与存放细节后续定（本阶段先按「约定固定文件名 + 回退内置」实现）。
- **地图 / 代码 / 事件编辑器**：Phase 4/5/6。
- **插件加载 / 注册机制**：后续里程碑。
- **dev 宿主接入**：本阶段收尾工作之一（ROADMAP §Cross-cutting Constraints），具体演示数据由规划阶段定。

</deferred>

---

*Phase: 3-素材管理*
*Context gathered: 2026-10-15*
