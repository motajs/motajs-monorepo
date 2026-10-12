# Phase 1: 编辑器外壳与通用 fs 接口 - Context

**Gathered:** 2026-10-09
**Status:** Ready for planning

<domain>
## Phase Boundary

本阶段交付两件事：

1. **编辑器外壳** —— `editor-core` 在不添加任何面板/功能时应长什么样，以及添加面板后（不看面板内容本身）外壳应长什么样。外壳形如**浏览器**：顶部两行（菜单行 + 标签行），下方内容区；支持**动态注册/注销面板类型**与**动态创建/关闭面板实例**（同一类型可开多个独立实例）。
2. **通用 fs 接口** —— `editor-core` 只**导出**一个 fs 接口类型，供外部统一实现；`editor-core` 与 `editor-impl` **都不实现、也不引用**它。

不含：任何具体编辑能力（表格/素材/地图/代码/事件编辑器，属 Phase 2–6）、插件加载机制、布局自定义。

</domain>

<decisions>
## Implementation Decisions

### A. 外壳形态

- **D-01:** 外壳顶部为**两行**：第一行菜单行（文件/编辑/…），第二行标签行；下方为内容区。
- **D-02:** 编辑器加载完成后**默认打开一个空白新标签页**；**允许存在多个**空白新标签页。
- **D-03:** 标签栏每个标签对应一个**面板实例**，各带一个 **×** 关闭；标签栏末尾紧跟一个 **+**（位于所有标签页之后、紧接最右标签的右侧，而非固定在标签栏最右端），点击打开一个新的空白新标签页。
- **D-04:** 空白新标签页内列出**当前已注册的面板类型**（显示 **名称 + 图标**）；点击某一项即用该类型的一个新实例**替换这个空白标签页**。
- **D-05:** 关闭标签（×）= **销毁该实例（`dispose`）并移除标签**；若被关闭的正是当前（前台）标签，则**自动切到相邻标签**（优先左邻，无左邻时选右邻）；若关闭的是非当前标签，则**当前标签保持不变**；若已无其它标签，则回到一个**空白新标签页**。
- **D-06:** 空壳（未注册任何面板类型时）外壳照常呈现：菜单行 + 标签行（含 `+` 与默认空白标签），空白页的列表为空。

### B. 面板注册模型（对现有接口的变更）

- **D-07:** 面板注册由「注册面板**对象**」改为「注册面板**类型**（工厂/构造器）」；同一类型可创建**多个独立实例**（例如两个表格面板编辑不同内容，互不冲突）。 — **Reversibility:** one-way — 这会改动 `panel/types.ts` 的公开契约（`registerPanel`/`EditorPanelCreator`/`IPanelSystem`），一旦有其他实现或调用方依赖旧签名，回退需要迁移它们。
- **D-08:** 面板类型携带元信息：**唯一 id**、**名称**、**图标**（分类分组后续有需求再加）。
- **D-09:** `core` 创建实例时向工厂传 **`(context, 实例 id)`**；**实例 id 由 core 生成、唯一**，用于区分同类型的多个实例。**本阶段不引入额外的「打开参数」**——「编辑不同内容」靠实例 id（以及后续能力层自行解决）。
- **D-10:** `core` 支持**动态注册/注销面板类型**，以及**动态创建/关闭面板实例**。
- **D-11:** 保留 `IEditorPanel` 作为**实例**接口（实例有唯一 id 与方法）。

### C. 顶部菜单

- **D-12:** 菜单行由外部以「**菜单项（标题 + 点击回调）**」注册；`core` 负责渲染这一行。

### D. 通用 fs 接口

- **D-13:** 通用 fs 接口**只是 `editor-core` 导出的一个接口类型**（无默认实现、无占位实现）；`editor-core` 与 `editor-impl` **都不实现也不引用**它，由外部实现并自行使用。方法覆盖：**读 / 写 / 列目录 / 建目录 / 移动 / 删除**。

### E. 归属与装配

- **D-14:** 外壳及其页面/标签管理属 **`editor-core`**；面板类型与菜单项由**外部（impl / 编辑器顶层）**注册；fs 实现由**宿主**提供。
- **D-15:** 编辑器由**外部装配**；加载完成后基本系统（面板类型、菜单项等）**应已注册完毕**。

### the agent's Discretion

- 具体接口命名、方法签名、内部结构（标签状态如何存放、渲染根如何组成）由 agent 在规划时提出；**命名按项目规则先经用户确认**。
- 空白新标签页列表的具体视觉（布局/样式）由 agent 决定，保持**朴素、简洁**（D-09，项目 Code style）。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 里程碑与需求
- `.planning/PROJECT.md` — 里程碑 v1.0（editor-core 空壳 + editor-impl 重做）目标
- `.planning/REQUIREMENTS.md` — 本阶段对应 **SHELL-01**、**CORE-01**
- `.planning/ROADMAP.md` §Phase 1 — 阶段目标与验收要点

### 现有外壳（画面参照）
- `packages/apps/editor/src/Workbench/index.tsx` — 现有工作台外壳组合
- `packages/apps/editor/src/Workbench/AppTopBar.tsx` — 现有顶栏

### 现有 editor-core（接口/实现基线）
- `packages/libs/editor-core/src/panel/types.ts` — `IPanelSystem` / `IEditorPanel` / `IEditorPanelContext` / `EditorPanelCreator`（**待改**）
- `packages/libs/editor-core/src/panel/panelSystem.ts` — 现有 `PanelSystem` 实现
- `packages/libs/editor-core/src/panel/panelContext.ts` — `PanelContext`
- `packages/libs/editor-core/src/core.ts`、`src/types.ts`、`src/index.ts` — 组合根与公开面

### 现有 fs 操作参照（用于对齐接口方法集）
- `packages/apps/editor/src/services/fs/fs.ts` — 编辑器侧的 FS 传输（read/write/list/mkdir/move/delete）
- `packages/apps/service-worker/src/server/fsApi.ts` — 宿主 FS API

### 规范
- `AGENTS.md` §Code style、§Project Rules（尤其：先接口后实现、重要命名先确认、计划执行前简报+「可以执行」）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PanelSystem` / `IEditorPanel` / `IEditorPanelContext`（`editor-core/src/panel/*`）：已有「注册/切换/生命周期/渲染根」骨架，可作为标签式外壳的改造基础。
- `EditorCore`（`src/core.ts`）：已有组合根、`initialize` 下发、`dispose` 逆序；外壳/页面管理的接线落在这里。
- `panelStore` + `useSyncExternalStore`（`panelSystem.ts`）：已有「变更 → 重渲染」机制，标签栏/内容区可复用。
- ResourceSystem / UndoSystem / Logger：既有系统，外壳不直接依赖（保持分层）。

### Established Patterns
- 一律相对导入、普通 `import`（禁 `import type`）；class 先有 `interface` 再 `implements`；每个方法/成员（含模块顶层 `const`/`let`/`function`）都要 jsDoc；单行 `//` 仅三种合法情形。
- `editor-core` 不得导入宿主或引擎代码；数据经注入/注册得到。

### Integration Points
- 新外壳渲染根：由 `editor-core` 提供（原 `panelSystem.render()` 位置）。
- 面板类型注册 + 菜单项注册：外部（`editor-impl` / 编辑器顶层）在装配时调用 `core` 的注册 API。
- 通用 fs 接口：作为 `editor-core` 导出类型；实现由宿主注入，`core`/`impl` 不引用。

</code_context>

<specifics>
## Specific Ideas

- 用户原话要点：「编辑器应该像浏览器一样列举每个面板」「core 必须支持动态注册新面板以及删除旧面板」「用户完全可以开两个表格编辑面板，编辑不同的内容，二者应该互不冲突」「面板注册是一次性的，或许需要考虑修改一下，改为面板构造器的注册」「上面一排面板，每个面板都有一个叉号，最右边是一个+号」「加载完毕后默认打开一个新标签页」「在新标签页内，显示当前已注册的面板，点击即可将当前新标签页替换为此面板」「最上面一排加上基础功能——文件、编辑、等等，这些功能也允许外部实现自己注册」「fs 接口……本身不会被 editor-core 和 editor-impl 实现和引用，只是为了让外部能够统一，不存在也不会对项目有什么影响」。

</specifics>

<deferred>
## Deferred Ideas

- **面板类型分类分组** —— 用户 2026-10-09：暂时「名称 + 图标」，后续有需求再加分类。
- **「打开参数」** —— 本阶段不做；「编辑不同内容」靠实例 id，后续能力层再定。
- **通用 fs 接口的实现 / 占位实现** —— 本阶段只定义接口。
- **插件加载 / 注册 / 生命周期机制** —— 后续里程碑。
- **布局自定义** —— 明确不做。

</deferred>

---

*Phase: 1-编辑器外壳与通用 fs 接口*
*Context gathered: 2026-10-09*
