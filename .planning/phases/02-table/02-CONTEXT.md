# Phase 2: 表格编辑 - Context

**Gathered:** 2026-10-11
**Status:** ⚠ 方向已修订并完成讨论（2026-10-12）——schema 改用标准 JSON Schema；需按讨论结论重规划
**Revision (2026-10-12):** schema 格式从「旧字段配置 / 注释对象」改为「标准 JSON Schema（完全替代）」；D-06 定为注入式打开器；新增面板参数接口约定 `IXxxPanelParam extends Record<string, unknown>`。JSON Schema 方向已完成一轮讨论，结论见 §H D-19…D-29。

<domain>
## Phase Boundary

本阶段交付「表格编辑」能力，作为 `@motajs/editor-impl` 的默认实现：用户可在编辑器里打开一个表格面板，查看并增 / 删 / 改 **schema 驱动的项目数据**；schema 本身也是一种可被可视化编辑的表格。

不含：地图 / 代码 / 事件编辑器（后续 Phase 4/5/6）、插件加载机制。

</domain>

<decisions>
## Implementation Decisions

### A. 表格如何挂进编辑器

- **D-01:** `@motajs/editor-impl/table` 对外导出**两样**：① 一个可直接经 `ShellSystem.registerPanelType` 注册进外壳的「面板类型」（含元信息 + 工厂）；② 底层的 React 表格组件（供第三方定制）。 — **Reversibility:** costly — 对外导出面一旦有第三方依赖，增删 `./table` 子路径导出需迁移调用方。
- **D-02:** 表格面板实例**内部持有「目标表」状态**；编辑器**不存在全局「当前表格」概念**；外部通过表格面板**额外暴露的方法**（示例名 `ITablePanel.setTable(...)`）设置目标表。该额外方法位于 Phase 1 的 `IEditorPanel` 之外。 — 该额外方法是新增公开接口，命名/形状待 `INTERFACE-NAME.md` 确认。

### B. 数据与 schema 来源

- **D-03:** 表格数据与 schema **都经 `editor-core` 的资源层（`resource`）获取**（core 不读文件；由外部注入文件后端）。**不**使用 Phase 1 定义的通用 fs 接口（`IEditorFileSystem`）——`CORE-01` 明确禁止 core/impl 引用它。
- **D-04:** 资源标识约定：常规表 = `table.xxx`；其 schema = `table#schema.xxx`。
- **D-05:** schema **本身也是一张可可视化编辑的表格**；但 schema 表**不再有 schema**（不出现 `table#schema#schema`）。
- **D-06:** 表格面板提供 **「编辑 Schema」按钮**；点击后**新开一个**表格面板实例，目标为当前表的 schema（`table#schema.x`）。 **机制（2026-10-12 确认）:** 用「注入式打开器」实现——由顶层（组合根）实现打开器并注入给表格面板，打开后再调用面板的 `ITablePanel.setTable(target)` 设定目标；**不改** `IShellSystem` 签名。面板打开参数一律以 `interface IXxxPanelParam extends Record<string, unknown>` 定义（表格为 `ITablePanelParam`），由打开器承载。

### C. 一致粒度与样式

- **D-07:** 表格功能**完整对齐现有 `@motajs/editor` 表格**：行内编辑、行 / 列增删、折叠、各类输入控件（文本 / 数字 / 颜色 / 下拉 / 复选框等）、外部编辑器等。
- **D-08:** 样式用 **antd 组件 + 局部 CSS**（antd 已是 `editor-impl` 的 peerDependency）；**不**引入 PandaCSS。

### D. 命令 / 撤销 / 持久化

- **D-09:** 表格编辑**走 `editor-core` 的统一撤销系统**（每次编辑为一次可逆操作，可撤销 / 重做）；写盘经资源层**异步持久化**（内存优先、最终一致）。

### E. Schema 的呈现

- **D-10:** schema 的编辑**复用同一表格引擎**，只增加一个 **「schema 专用呈现模式」**：检测到当前目标为 schema 时，切换字段布局（例：常规表里 `min` / `max` 各占一行两个 number input；schema 里 `min` / `max` 渲染成**一行左右两个小 number input**）。schema 的呈现规则**不由 schema 描述**（内建 / 可注入规则），与 D-05 一致。

### F. 外部编辑器与 schema 同步（补充讨论）

- **D-11:** 代码字段（`textarea`）与事件字段（`event`）的编辑，**单独呼出一个面板**（Phase 1 外壳里的标签页 / 面板实例），**不是弹窗**；编辑完成后**切出该面板即自动关闭**。
- **D-12:** 其余外部编辑（素材选择、坐标选择、多选框编辑）用**弹窗**。
- **D-13:** 这些弹窗做成**通用、可复用组件**（其他功能也会用到），不私有在表格内部。
- **D-14:** **素材选择本质上是一种多选**，与「多选框编辑」**合并**为同一个通用**多选弹窗**——`checkboxSet` / `popCheckboxSet` 与 `material` 共用（素材以缩略图多选呈现）。
- **D-15（2026-10-12 修订）:** 表格**不需要跨面板实时刷新**——后台面板用户看不见，**在被切入时重新请求数据 / schema 资源并重算布局**即可。机制：**外壳在切换标签时调用 `onSwitchIn` / `onSwitchOut`**（`IEditorPanel` 已有这两个钩子，但当前 `ShellSystem` 未调用它们），表格面板在 `onSwitchIn` 里重新请求资源。原「以响应式方式订阅 schema、变化即广播重渲染」的方案**放弃**（不需要 `IEditorPanelContext.updateResource` 接缝）。

### G. 视觉结构与可复用（补充讨论）

- **D-16:** 视觉分隔——每个**可折叠区域（一个 object）上下用分割线**与相邻区域分隔；表格**每一行用细半透明分割线**分隔；**栏与栏之间加分割线**。
- **D-17:** 列宽不再用百分比三栏式；**每栏约 400px**（四栏：条目 / 注释 / 值 / 操作），栏间有分割线；面板窄于总宽时**横向滚动**。
- **D-18:** 表格编辑**组件本身可复用**——外部既能**内嵌**使用，也能**单独以弹窗呼出**。

### H. schema 格式与打开方式（2026-10-12 方向修订）

- **D-19:** 表格 schema **一律使用标准 JSON Schema**，**完全替代**旧 `@motajs/editor` 表格的「字段配置 / 注释对象」（`CommentObject` / `FieldConfig` 及其 `_type` / `_range` / `_select` / `_checkboxSet` / `_docs` / `_data` / `_hide` / `_string` / `_event` / `_directory` / `_transform` / `_onconfirm` / `_lint` / `_template` / `_preview` / `indent` 等键）。旧键**不再使用**。 — **Reversibility:** costly —— 数据模型、校验、呈现、外部编辑器触发全部围绕此格式重建。
- **D-20（讨论已定）:** `editor-impl/table` **只认标准 JSON Schema**；引擎自己的格式 → JSON Schema 的转换由**引擎适配层**负责（将来的引擎 / `@motajs/editor`）。**本阶段不交付**旧格式转换器（与 `PROJECT.md`「适配留在 `editor` 侧」一致）。
- **D-21:** 采用 **JSON Schema Draft 2020-12**。
- **D-22:** 校验用 **ajv**（标准校验库，新增运行时依赖）；**废弃** 旧的 `_range` 表达式求值器 `IValueEvaluator` 及相关注入项。
- **D-23:** 外部编辑器（代码 / 事件 / 素材 / 坐标 / 多选）统一用 **`x-` 扩展键**（拟名 `x-editor`）标记触发；**行内控件**尽量从标准推导（`type` / `enum` / `items`），无法推导的（颜色等）用拟名 `x-control` 兜底。
- **D-24:** schema 表以 **`properties` 为行、递归展开**（嵌套 object 折叠为 gap 行），行内编辑常用关键字。
- **D-25:** 保留 **`minimum` / `maximum`（及 exclusive 对）合成一行**的成对呈现。
- **D-26:** 本阶段理解范围 = **基础 + 常见**（`type` / `properties` / `required` / `enum` / `minimum` / `maximum` / `pattern` / `items` / 嵌套 object）；**不含** `$ref` / `oneOf` / `anyOf` / `allOf` / `$defs`（留后续）。
- **D-27:** 与旧表格 **整体对齐、可微调**——界面 / 交互保持旧观感，允许为适配 JSON Schema 做必要调整。
- **D-28:** `table#schema.<name>` **直接存一份标准 JSON Schema 文档**，由资源提供方保证其合法。
- **D-29:** schema **缺失 / 非法时分级处理、不崩溃**：缺失 → 「尚未定义任何字段」；解析失败 / 非法 JSON Schema → 明确错误态且面板保持打开；数据字段在 schema 中无对应项 → 默认文本框兜底。
- **D-30（新增，2026-10-12）:** 工具栏提供一个 **「在代码编辑器中打开」按钮，随当前视图打开对应文件**——数据表视图 → 数据文件（`table.<名>`），schema 视图 → schema 文件（`table#schema.<名>`）；在代码编辑器里**可编辑并写回**（改完把整份 JSON 整份替换该资源，经统一撤销路径记一次可逆操作）。复用已有的**代码编辑器打开器**能力（D-11）。
- **D-31（修订，2026-10-12）:** 取消原 D-15 的跨面板广播接缝（`IEditorPanelContext.updateResource`）。改为 **D-15 修订版**：外壳在切换标签时调用 `onSwitchIn` / `onSwitchOut`；面板在 `onSwitchIn` 里重新请求资源。**影响**：02-01 不再是「加 `updateResource` 类型」（需删除或改造）；02-05 改为实现外壳的 `onSwitchIn` / `onSwitchOut` 调用；02-08 的刷新改为「切入时刷新」。

> **本修订作废以下既有计划内容（需重规划）:**
> - `02-02`（数据模型：`CommentObject` / `FieldConfig` / `_type` 映射 / `_select` / `_checkboxSet` / `TableNode`）。
> - `02-04`（树构建的旧排序语义与 `_leaf` 叶子/gap 判定）。
> - `02-06`（`_range` / `_select` 校验 + 按字段种类的五种控件映射）。
> - `02-08`（旧 schema 专用呈现规则，如 min/max 成对行）。
> - `02-09`（按旧字段种类分发外部编辑器）。
> - `02-01` 检查点里「schema = 旧 `CommentObject`」的记录，改为「标准 JSON Schema」。
> - `02-03`（能力接缝）与 `02-07`（编辑 / 撤销）随所选触发约定少量调整。
> - `02-05`：因 D-06 定为注入式打开器，其「外壳透传打开参数」的 Task 2 **不再执行**（仅保留 D-15 广播实现）。

### the agent's Discretion

- 表格面板与底层组件的具体接口形状、方法名、字段名、schema 专用呈现的具体规则集、资源标识 `xxx` 的语义（表名如何取）等，由研究与规划阶段提出；**命名按项目规则先经用户确认（`INTERFACE-NAME.md`）**。
- 结构上「一个组件带模式切换」（D-10 倾向）还是拆成「数据表 / schema 表」两套组件，由规划阶段定。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 里程碑与需求
- `.planning/PROJECT.md` — 里程碑 v1.0（editor-core 空壳 + editor-impl 重做）
- `.planning/REQUIREMENTS.md` — 本阶段对应 **TABLE-01**
- `.planning/ROADMAP.md` §Phase 2 — 阶段目标与验收要点

### 前序阶段产出（Phase 1）
- `.planning/phases/01-shell/01-CONTEXT.md` — 外壳决策（面板类型注册、多实例模型、D-09 实例 id）
- `.planning/phases/01-shell/INTERFACE-NAME.md` — 已确认的接口命名（`IEditorPanelType` / `EditorPanelFactory` / `IShellSystem` / `IEditorPanelFactoryParam`）

### 现有表格（画面 / 行为参照）
- `packages/apps/editor/src/components/Table/` — 现有表格组件族（`index.tsx`、`components/*`、`components/inputs/*`、`stores/DataStore.ts`、`utils/*`）
- `packages/apps/editor/src/components/SchemaTable/` — 现有 schema 表格

### 目标落点与底座
- `packages/libs/editor-impl/package.json` — 已预留 `./table` 等子路径与 antd 等 peerDependencies
- `packages/libs/editor-impl/src/` — 默认实现落点（现为空壳）
- `packages/libs/editor-core/src/resource/`、`packages/libs/editor-core/src/undo/` — 资源层与撤销层

### 规范
- `AGENTS.md` §Code style、§Project Rules（先接口后实现 / 重要命名先确认 / 方法写 `类名.方法名`）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- 现有 `@motajs/editor` 表格组件族（`components/Table/**`、`SchemaTable`）：作为**行为 / 画面参照**，重写进 `editor-impl/table`（旧代码仅作参考，不照抄）。
- `editor-core` 资源层（`resource`：`Content<T>`、`FileHandler`/`DataHandler`、`PersistExecutor`、组合子等）——表格数据与持久化的底座。
- `editor-core` 撤销层（`undo`）——统一撤销路径。
- Phase 1 外壳（`ShellSystem.registerPanelType`、`IEditorPanelType`、`IEditorPanelFactoryParam`）——表格面板类型注册落点。

### Established Patterns
- 类：先 `interface` 再 `implements`；`type` 别名写 jsDoc、类/接口不写；jsDoc 逐参；禁 `import type`；barrel `export *`。
- `editor-core` 引擎无关、不读文件、数据经注入；`editor-impl` 是其默认实现，依赖 `editor-core`。

### Integration Points
- `@motajs/editor-impl` 的 `./table` 子路径导出（现已在 `package.json` 预留）。
- 装配方把表格面板类型注册进 Phase 1 的外壳。
- 资源标识 `table.xxx` / `table#schema.xxx`。

</code_context>

<specifics>
## Specific Ideas

- 用户原话要点：「都使用资源层获取。常规表格使用 `table.xxx`，schema 使用 `table#schema.xxx`」「schema 也属于一种表格，它允许被可视化编辑，对于这种表格，应当不出现 `table#schema#schema`」「应提供一个编辑 Schema 的按钮，点击后进入当前正在编辑的表格的 schema 的编辑」「如果检测到是 Schema，那么启用另一套 json 解析方式…… `min` `max` 分一行左右两个小的 number input」。

> ⚠ **2026-10-12 修订：** 上述原话里关于 schema **格式**的部分（`min`/`max` 成对、「另一套 json 解析方式」等，均指旧的字段配置/注释对象格式）已被 **§H D-19** 取代——schema 改用**标准 JSON Schema**。资源层获取、`table.<name>` / `table#schema.<name>` 约定、「schema 无 schema」等结构性要点仍然有效。

</specifics>

<deferred>
## Deferred Ideas

- 地图 / 代码 / 事件编辑器 —— 后续 Phase 4/5/6。
- 插件加载 / 注册机制 —— 后续里程碑。
- 「打开参数」通用化到外壳 —— **已定（2026-10-12）**：不做外壳通用化；改由「注入式打开器 + 面板 `ITablePanel.setTable` / `IXxxPanelParam`」解决，`IShellSystem` 签名不变。

</deferred>

---

*Phase: 2-表格编辑*
*Context gathered: 2026-10-11*
