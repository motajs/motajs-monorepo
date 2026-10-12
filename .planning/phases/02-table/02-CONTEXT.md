# Phase 2: 表格编辑 - Context

**Gathered:** 2026-10-11
**Status:** Ready for planning

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
- **D-06:** 表格面板提供 **「编辑 Schema」按钮**；点击后**新开一个**表格面板实例，目标为当前表的 schema（`table#schema.x`）。

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
- **D-15:** schema 更新后，表格布局**必须立刻同步**（硬性要求）：表格面板以响应式方式订阅 schema 资源，schema 变化即重算列布局并重渲染。

### G. 视觉结构与可复用（补充讨论）

- **D-16:** 视觉分隔——每个**可折叠区域（一个 object）上下用分割线**与相邻区域分隔；表格**每一行用细半透明分割线**分隔；**栏与栏之间加分割线**。
- **D-17:** 列宽不再用百分比三栏式；**每栏约 400px**（四栏：条目 / 注释 / 值 / 操作），栏间有分割线；面板窄于总宽时**横向滚动**。
- **D-18:** 表格编辑**组件本身可复用**——外部既能**内嵌**使用，也能**单独以弹窗呼出**。

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

</specifics>

<deferred>
## Deferred Ideas

- 地图 / 代码 / 事件编辑器 —— 后续 Phase 4/5/6。
- 插件加载 / 注册机制 —— 后续里程碑。
- 「打开参数」通用化到外壳 —— 本阶段以「面板额外方法设置目标表」解决，未通用化（Phase 1 已推迟）。

</deferred>

---

*Phase: 2-表格编辑*
*Context gathered: 2026-10-11*
