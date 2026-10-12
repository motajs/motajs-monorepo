# Phase 2: 表格编辑 - Research

**Researched:** 2026-10-12
**Domain:** 仓库内重构 / 新能力实现——把现有 `@motajs/editor` 的「schema 驱动表格」（`components/Table/**`）重做为引擎无关的 `@motajs/editor-impl/table`，挂在 Phase 1 的 `editor-core` 外壳上，数据与 schema 走 `editor-core` 的资源层、编辑走统一撤销层
**Confidence:** HIGH（结论几乎全部来自本会话对仓库源码的逐文件阅读与实测运行；本阶段为纯仓库内工作、不引入新包）

## Summary

本阶段要做的是一件外观与行为与现有编辑器表格一致、但代码全新的事：在 `@motajs/editor-impl` 里从零写出「schema 驱动的表格」面板与组件。这里说的「schema」不是 JSON Schema，而是现有 `components/Table` 用来驱动渲染的那份**注释对象**（`CommentObject`/`FieldConfig`，字段带 `_type`/`_leaf`/`_range`/`_select` 等）；表格数据是 `data`，schema 是描述这些字段怎么显示与校验的配置。现有编辑器里这套东西跑得很好，**本阶段的任务是把它按新架构重写一遍，画面与行为保持现状**（用户原话：「旧代码仅做参考，不代表新的代码也要这么写」）。

本会话最关键的几条事实，会直接决定计划能怎么排：

1. **仓库现在是「半拆」状态，只有 `editor-core` 与（空的）`editor-impl` 是绿的。** `@motajs/editor` 应用仍在 import 旧里程碑的 `@motajs/editor-impl` API（`FileHandler`、`/react` 等），这些在 2026-10-03 的 `refactor: editor-core 接口推翻重做` 提交里已被清空——所以全仓 `pnpm test`/`pnpm typecheck` 是红的。**本阶段验收基线只能是 `editor-impl` 自身（`typecheck` + `test`）+ `editor-core` 不退绿 + 仍生效的门禁**，不能理解为「全仓绿」。这与 Phase 1 当时的处境完全相同。
2. **`editor-impl` 的包骨架已就位、但 `src/table/` 还不存在。** `package.json` 已经声明了 7 个 subpath 导出，其中 `"./table": "./src/table/index.ts"` 指向一个**当前不存在的文件**；`tsc -b` 现在能过（只有 `src/index.ts`），`vitest run` 现在**红**（「No test files found」）。Phase 2 建出 `src/table/` 既补齐了这个悬空导出，也会让 `coreBoundaries.js` 的「能力互斥」断言重新生效（见下）。
3. **`editor-core` 的资源层比 CONTEXT.md 描述的要简单、也更「拉」而不是「推」。** CONTEXT 引用的 `Content<T>`/`FileHandler`/`PersistExecutor` 是**旧里程碑**的 editor-impl 资源层（已随提交清空）；本里程碑的 `editor-core/src/resource/**` 只有 `IResource<T>`（`request()`/`write()`）、`IResourceAccess`/`IResourceStore` 与 `ResourceSystem`（列表/内容缓存 + 钩子）。它**不是响应式的**：`write` 只写缓存、**不触发任何钩子**（源码与测试都写死了这一点）。因此 D-15「schema 改动立刻重渲染」需要一个**新的通知接缝**，而 `IEditorPanelContext` 当前**没有**任何「通知资源变更」的方法——这是本阶段最大的一个待定设计点。
4. **D-06「新开一个面板实例编辑 schema」在 Phase 1 的契约下没有现成通路。** `IEditorPanelType.create` 只收到 `{ context, instanceId }`，没有任何「打开参数」；`IShellSystem.openPanelInTab(tabId, typeId)` 无法把「一个已经建好、并设好目标表」的实例放进标签。所以「面板额外方法 `setTable`」还需要一个**谁来调用它、以及在哪里调用**的机制——同样必须在本阶段定义。
5. **`editor-core`/`editor-impl` 受四条仍生效的静态门禁约束**，新代码必须全部满足：禁 `import type`；禁模块级可变状态/容器；禁 `fetch/document/navigator/localStorage/XMLHttpRequest`/`process.env`/`import.meta.env`；禁引擎术语（`tower`/`floor`/`loc`/`mota`/`commonEvent`… **注释也算**）。此外 `coreFsSurface.js` 禁止 core/impl 引用 `IEditorFileSystem`。

**Primary recommendation:** 先排「接口定义」计划（面板契约扩展点、表格/ schema 的数据模型、外部编辑器与通用弹窗的注入接缝、资源标识与类型号），经 `INTERFACE-NAME.md` 逐 Plan 确认命名后再排实现计划；实现按「数据模型与树构建 → 只读渲染 → 行内输入与校验 → 增删/折叠/编辑模式 → 撤销接线与持久化 → 外部编辑器与通用弹窗 → schema 呈现模式 → 内核不变式门禁」切分，每一步都以 `pnpm --filter @motajs/editor-impl test` + `typecheck` + 三条 core 门禁作为采样点。

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 表格面板类型注册与实例托管 | `editor-core`（`ShellSystem`） | `editor-impl/table`（提供面板类型与工厂） | Phase 1 决定：外壳/标签/实例属 core；能力属 impl |
| 表格渲染与交互（网格/行/列/输入控件/折叠/编辑模式） | `editor-impl/table`（React 组件） | — | D-01/D-07/D-08；纯 UI 属 impl |
| 表格数据与 schema 的读写 | `editor-core` 资源层（经 `IEditorPanelContext.requestResource`） | 宿主注入的资源后端 | D-03/D-04；core/impl 都不读文件 |
| schema 变更 → 布局重算（D-15） | `editor-impl/table`（订阅者） | 需要一个「资源变更通知」接缝（**当前缺失**） | 资源层是「拉」模式；见 Open Question 1 |
| 编辑的撤销/重做 | `editor-core` `UndoSystem`（经 `IEditorPanelContext.addUndoContext` + `IEditorPanel.undo/redo`） | — | D-09；面板自身实现 `IUndoable` |
| 落盘持久化 | 宿主资源后端（`IResourceInjection.writeResource`） | `editor-core` `ResourceSystem` 内存缓存 | 资源层「内存优先、异步写」；D-09 |
| 代码 / 事件外部编辑器（D-11：独立面板） | Phase 5 / Phase 6 能力 | Phase 2 定义**注入接缝**并优雅降级 | 这两个能力尚未实现；见 Open Question 3 |
| 通用多选 / 坐标弹窗（D-12/D-13/D-14） | `editor-impl` 的**共享 React 模块**（非能力目录） | 组合根提供 Provider | 能力之间不得互相 import；见 Open Question 4 |
| 素材列表 / 剪贴板等宿主能力 | 宿主注入（port / 回调） | — | PORT-02 禁 `navigator`/`document`；见 Pitfall 3 |

## User Constraints (from CONTEXT.md)

> 以下为 CONTEXT.md 的锁定决策/自由区/推迟项**逐字**复制，planner 必须遵守。

### Locked Decisions

**A. 表格如何挂进编辑器**
- **D-01:** `@motajs/editor-impl/table` 对外导出**两样**：① 一个可直接经 `ShellSystem.registerPanelType` 注册进外壳的「面板类型」（含元信息 + 工厂）；② 底层的 React 表格组件（供第三方定制）。
- **D-02:** 表格面板实例**内部持有「目标表」状态**；编辑器**不存在全局「当前表格」概念**；外部通过表格面板**额外暴露的方法**（示例名 `ITablePanel.setTable(...)`）设置目标表。该额外方法位于 Phase 1 的 `IEditorPanel` 之外。

**B. 数据与 schema 来源**
- **D-03:** 表格数据与 schema **都经 `editor-core` 的资源层（`resource`）获取**（core 不读文件；由外部注入文件后端）。**不**使用 Phase 1 定义的通用 fs 接口（`IEditorFileSystem`）——`CORE-01` 明确禁止 core/impl 引用它。
- **D-04:** 资源标识约定：常规表 = `table.xxx`；其 schema = `table#schema.xxx`。
- **D-05:** schema **本身也是一张可可视化编辑的表格**；但 schema 表**不再有 schema**（不出现 `table#schema#schema`）。
- **D-06:** 表格面板提供 **「编辑 Schema」按钮**；点击后**新开一个**表格面板实例，目标为当前表的 schema（`table#schema.x`）。

**C. 一致粒度与样式**
- **D-07:** 表格功能**完整对齐现有 `@motajs/editor` 表格**：行内编辑、行 / 列增删、折叠、各类输入控件（文本 / 数字 / 颜色 / 下拉 / 复选框等）、外部编辑器等。
- **D-08:** 样式用 **antd 组件 + 局部 CSS**（antd 已是 `editor-impl` 的 peerDependency）；**不**引入 PandaCSS。

**D. 命令 / 撤销 / 持久化**
- **D-09:** 表格编辑**走 `editor-core` 的统一撤销系统**（每次编辑为一次可逆操作，可撤销 / 重做）；写盘经资源层**异步持久化**（内存优先、最终一致）。

**E. Schema 的呈现**
- **D-10:** schema 的编辑**复用同一表格引擎**，只增加一个 **「schema 专用呈现模式」**：检测到当前目标为 schema 时，切换字段布局（例：常规表里 `min` / `max` 各占一行两个 number input；schema 里 `min` / `max` 渲染成**一行左右两个小 number input**）。schema 的呈现规则**不由 schema 描述**（内建 / 可注入规则），与 D-05 一致。

**F. 外部编辑器与 schema 同步（补充讨论）**
- **D-11:** 代码字段（`textarea`）与事件字段（`event`）的编辑，**单独呼出一个面板**（Phase 1 外壳里的标签页 / 面板实例），**不是弹窗**；编辑完成后**切出该面板即自动关闭**。
- **D-12:** 其余外部编辑（素材选择、坐标选择、多选框编辑）用**弹窗**。
- **D-13:** 这些弹窗做成**通用、可复用组件**（其他功能也会用到），不私有在表格内部。
- **D-14:** **素材选择本质上是一种多选**，与「多选框编辑」**合并**为同一个通用**多选弹窗**——`checkboxSet` / `popCheckboxSet` 与 `material` 共用（素材以缩略图多选呈现）。
- **D-15:** schema 更新后，表格布局**必须立刻同步**（硬性要求）：表格面板以响应式方式订阅 schema 资源，schema 变化即重算列布局并重渲染。

**G. 视觉结构与可复用（补充讨论）**
- **D-16:** 视觉分隔——每个**可折叠区域（一个 object）上下用分割线**与相邻区域分隔；表格**每一行用细半透明分割线**分隔；**栏与栏之间加分割线**。
- **D-17:** 列宽不再用百分比三栏式；**每栏约 400px**（四栏：条目 / 注释 / 值 / 操作），栏间有分割线；面板窄于总宽时**横向滚动**。
- **D-18:** 表格编辑**组件本身可复用**——外部既能**内嵌**使用，也能**单独以弹窗呼出**。

### the agent's Discretion

- 表格面板与底层组件的具体接口形状、方法名、字段名、schema 专用呈现的具体规则集、资源标识 `xxx` 的语义（表名如何取）等，由研究与规划阶段提出；**命名按项目规则先经用户确认（`INTERFACE-NAME.md`）**。
- 结构上「一个组件带模式切换」（D-10 倾向）还是拆成「数据表 / schema 表」两套组件，由规划阶段定。

### Deferred Ideas (OUT OF SCOPE)

- 地图 / 代码 / 事件编辑器 —— 后续 Phase 4/5/6。
- 插件加载 / 注册机制 —— 后续里程碑。
- 「打开参数」通用化到外壳 —— 本阶段以「面板额外方法设置目标表」解决，未通用化（Phase 1 已推迟）。

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TABLE-01 | 用户可编辑 schema 驱动的表格数据 | 数据/schema 经 `editor-core` 资源层（`IResource`/`IEditorPanelContext`）读写；撤销经 `UndoSystem` + `IEditorPanel.addUndoContext`/`undo`/`redo`；面板类型经 `ShellSystem.registerPanelType` 挂进外壳；行为/画面对齐 `packages/apps/editor/src/components/Table/**`（parity 参照，非照抄模板）。对应 ROADMAP 成功标准 ①②③④（其中 ④ 与 CONTEXT D-03 冲突，见 Open Question 6）。 |

> **注意（成功标准 ④ 与锁定决策冲突）：** ROADMAP `Phase 2` 成功标准 ④ 写「表格数据经 Phase 1 的通用 fs 接口读写，行为与现状一致」；而 CONTEXT D-03（2026-10-11，晚于 ROADMAP）明确写「**不**使用 Phase 1 定义的通用 fs 接口（`IEditorFileSystem`）」。**以 CONTEXT 为准**（用户决策优先、且 `coreFsSurface.js` 门禁会拦下任何引用）。planner 应把 ④ 读作「数据读写经统一层（资源层）+ 行为与现状一致」。

## Standard Stack

本阶段**不新增任何依赖**。表格所需的一切都在 `editor-impl` 已声明的依赖面内。

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react` / `react-dom` | `catalog:default`（^19.2.3） | 表格组件/面板实现 | 已是 `editor-impl` 的 peer + devDependency |
| `antd` | 6.2.1（`catalog:default`） | 输入控件、按钮、Segmented、Spin、Empty、Alert、Space、InputNumber、Select、Checkbox、ColorPicker、Modal 等 | D-08 锁定；已是 peer + devDependency；UI-SPEC 的组件清单即基于它 [VERIFIED: packages/libs/editor-impl/node_modules/antd/package.json → 6.2.1] |
| `@motajs/editor-core` | `workspace:*` | 资源层、撤销层、面板/外壳契约 | D-03；`editor-impl` 的 dependency（单向 impl → core） |
| `@tanstack/react-store` / `@tanstack/store` | `catalog:default`（0.8.0） | 面板内部状态/订阅（若要「变更 → 重渲染」） | 已是 `editor-impl` 的 dependency；`editor-core` 的 `ShellSystem` 即用 `@tanstack/store` + `useSyncExternalStore` |
| `ts-pattern` / `es-toolkit` | `catalog:default` | 控制流 / 工具函数 | 已是 `editor-impl` 的 dependency |

### Supporting（现有、内部复用，非新增）
| Library | Location | Purpose | When to Use |
|---------|----------|---------|-------------|
| vitest 4.0.18 | `packages/libs/editor-impl/vitest.config.ts` | 单元/组件测试（jsdom） | 所有新测试；**注意当前无 `setupFiles`，见 Pitfall 7** |
| @testing-library/react | `editor-impl` devDependency（经 catalog） | jsdom 下渲染/交互断言 | 组件测试 |
| jsdom 26.1.0 | `editor-impl` devDependency | DOM 环境 | 测试环境 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| antd 组件 + 局部 CSS（D-08） | PandaCSS / Tailwind / 自造控件 | 违反 D-08 与里程碑「不引入不必要运行时依赖」约束；且 `editor-impl` 没有 PandaCSS 管线 |
| `@motajs/react-store` 的 `createStore`（旧表格用的 `DataStore`/`FoldStore`） | React `useState`/`useMemo` 或 `@tanstack/react-store` | 旧写法依赖 `@motajs/react-store`，而它**不是** `editor-impl` 的依赖；新代码应改用已声明的 `@tanstack/react-store` 或直接 React 状态（见 Open Question 5） |

**Installation:**
```bash
# 无。本阶段不执行任何安装。
```

**Version verification:** 无需——未引入新包。`antd@6.2.1` 已在本会话从 `packages/libs/editor-impl/node_modules/antd/package.json` 实测确认 [VERIFIED: workspace install output]。

## Package Legitimacy Audit

**本阶段不安装任何外部包**。`@motajs/editor-impl` 的依赖面（peer + devDependency）已经全部在 lockfile 中；本阶段只新增包内源码文件。因此 Package Legitimacy Gate 不适用，审计表为空。

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| *(无新增)* | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 表格数据/ schema 由 `@motajs/editor` 的 `projectData`/`projectModel`/`Fs` 直供（`useTableMetaSuspense`、`useTowerDataSuspense`） | 数据 = 资源 `table.<name>`，schema = 资源 `table#schema.<name>`，都经 `editor-core` 资源层 | 本阶段（D-03/D-04） | 表格变引擎无关；引擎适配留在 `@motajs/editor`/宿主 |
| 编辑走 `tableCommands`/`floorCommands` + `operationHistory`（旧里程碑的捕获式撤销） | 编辑走 `editor-core` 的 `UndoSystem`：面板实现 `IUndoable`，每次编辑 `context.addUndoContext(panel, ctx)` | 本阶段（D-09） | 撤销 API 形状完全不同（`IUndoContext{type:number,data}`），需重写接线 |
| 折叠状态用 `@motajs/react-store` 的 `createStore`（`FoldStore`） | 面板本地 React 状态或 `@tanstack/react-store` | 本阶段 | `@motajs/react-store` 非 `editor-impl` 依赖 |
| 旧表格样式 = `editor_color_*.css` 的 `.etable`（百分比列宽 24/19/32/25） | 新表格 = 局部 CSS + `--editor-*` 变量 + `--etable-*` 兼容色；固定约 400px 四栏（D-17） | 本阶段 | 画面需人工验收（横向滚动、分割线无法在 jsdom 断言） |

**Deprecated/outdated:**
- `scripts/verify/coreExports.js` 与 `scripts/verify/implExports.js` 引用已归档里程碑的 `.planning/phases/02-package-boundary-build-scaffolding/subpathStatus.json`（本会话确认该文件**不存在**），且断言 `sideEffects === false`——这与 Phase 1 已把 `editor-core` 改成 `["./src/**/*.css"]`、以及 Phase 2 UI-SPEC 要求把 `editor-impl` 同样改掉，直接冲突。二者**当前为红**，不作为本阶段门禁（见 Open Question 7）。
- `scripts/verify/coreBoundaries.js` 当前为红：其「能力互斥」合成 fixture 写入 `editor-impl/src/code/__boundariesProbe__.ts` 并 `import '../table/index'`，因 `editor-impl/src/table` 不存在而**无法解析**，按 `to.path` 匹配的规则静默失效（本会话实测 exit 1）。**Phase 2 建出 `src/table/` 后该断言有机会重新生效**（见 Validation Architecture）。

## Architecture Patterns

### System Architecture Diagram

```
外部装配方（编辑器顶层 / 宿主 / mota-js 适配器）
   │  registerPanelType(表格面板类型)    提供资源后端（table.* / table#schema.*）
   ▼
┌───────────────────────────────────────────────────────────────────────┐
│ EditorCore（组合根, editor-core/src/core.ts）                          │
│  ├─ UndoSystem      撤销栈（IUndoable 列表 + maxUndoStep）             │
│  ├─ ResourceSystem  列表/内容缓存 + 钩子广播（onUpdateResource…）       │
│  └─ ShellSystem     面板类型表 / 实例表 / 标签状态机 / 菜单 / 渲染根     │
│        └─ 每个实例挂 ShellPanelHooks（把 onUpdateResource 转发给面板）  │
└───────────────────────────────────────────────────────────────────────┘
   │ render(): FC
   ▼
<ShellRoot> ── <MenuRow> / <TabRow>(+ 标签) / <ContentArea>
                                   └─ <PanelHost> → 活动实例.render()
                                        │
                                        ▼
                            表格面板实例（editor-impl/table）
                              ├─ 目标表状态（D-02，无全局当前表）
                              ├─ 经 context.requestResource(table.<n> / table#schema.<n>) 拉数据
                              ├─ 经 context.addUndoContext(this, ctx) 记一次可逆编辑
                              ├─ render() → 可复用表格组件（D-18）
                              └─ 表格组件：schema 树 → 网格（条目|注释|值|操作）
                                   ├─ 值单元格：按 _type 选 antd 控件（行内编辑）
                                   ├─ 操作列：注释 / 编辑 / 多选框编辑 / 复制
                                   └─ 外部编辑器（D-11 面板 / D-12 弹窗）经注入接缝召唤

数据流（一次编辑）：用户改值 → 校验(_range) → 面板构造 IUndoable 上下文 →
  context.addUndoContext(panel, ctx) → UndoSystem 入栈 → 资源 write（内存优先）→ 宿主后端异步落盘
数据流（schema 变化 → D-15）：另一实例写 schema → （需要一个通知接缝）→ 本实例重算列布局并重渲染
```

### Recommended Project Structure（提案，须经 INTERFACE-NAME 确认）

```
packages/libs/editor-impl/
├── package.json                 # 已有 7 subpath；本阶段补 ./src/table/
├── tsconfig.json                # 已有（@/* → src/*）
├── vitest.config.ts             # 已有；本阶段需补 setupFiles（见 Pitfall 7）
└── src/
    ├── index.ts                 # 已有（export {}）；D-06 说根 barrel 汇总 resources/edit/table
    ├── global.d.ts              # 【新增】declare module '*.css';（若 import 局部 CSS，仿 editor-core）
    ├── table/                   # 【本阶段主战场，能力目录】
    │   ├── index.ts             # 桶：导出面板类型 + 表格组件 + 类型
    │   ├── types.ts             # 数据模型（CommentObject/FieldConfig/TableNode/TableAction/EditMode）
    │   ├── tablePanel.ts        # 面板实例（implements IEditorPanel + ITablePanel）
    │   ├── tablePanelType.ts    # 面板类型元信息 + 工厂（registerPanelType 的输入）
    │   ├── components/…         # 网格 / 表头 / 行 / gap 行 / 编辑模式 / 操作按钮 / 输入控件
    │   ├── model/…              # 树构建、schema 呈现规则、校验
    │   └── table.css            # 局部 CSS（kebab-case，就近）
    └── shared/ 或 react/        # 【新增】通用多选弹窗 / 坐标弹窗（D-13/D-14，非能力目录）
```

> 目录名、文件名、接口名均为**提案**。按 AGENTS.md「重要命名先确认」，落代码前必须先写 `INTERFACE-NAME.md`（每 Plan 一节、说明每个名字是干什么的）并经用户确认。

### Pattern 1: 面板实现 `IEditorPanel` + 额外方法（D-01/D-02）

**What:** 面板工厂 `(param: IEditorPanelFactoryParam) => IEditorPanel` 同步返回一个实例；实例实现 `initialize/dispose/render/onFocus/onBlur/onSwitchIn/onSwitchOut/onUpdateResource/onUpdateResourceList` + `undo/redo`。面板内部持有「目标表」；对外再暴露一个额外的 `setTable(...)`（不在 `IEditorPanel` 上）。

**契约来源（逐字）** [VERIFIED: packages/libs/editor-core/src/panel/types.ts:94-118]：
```typescript
/** 面板实例工厂的入参对象：打包面板上下文与 core 生成的实例 id */
export interface IEditorPanelFactoryParam {
  /** 面板侧上下文，提供资源读写与撤销能力 */
  readonly context: IEditorPanelContext;
  /** core 生成的唯一实例 id，用于区分同类型的多个实例 */
  readonly instanceId: string;
}
/** 面板实例工厂：接收入参对象并同步返回一个面板实例（无 Promise） */
export type EditorPanelFactory = (param: IEditorPanelFactoryParam) => IEditorPanel;
export interface IEditorPanelType {
  readonly id: string;
  readonly name: string;
  readonly icon: ReactNode;
  readonly create: EditorPanelFactory;
}
```

### Pattern 2: 资源读写（D-03/D-04）——「拉」模式

**What:** `context.requestResource<T>(id)` 返回 `IResource<T> | null`（`null` = 资源不在列表里），再 `resource.request()` 取值 / `resource.write(data)` 写值。

**契约来源（逐字）** [VERIFIED: packages/libs/editor-core/src/resource/types.ts:3-24]：
```typescript
export interface IResourceIdentifier {
  /** 资源类型，由外部的枚举真正进行定义 */
  readonly type: number;
  /** 资源的标识符 */
  readonly id: string;
}
export interface IResource<T> {
  /** 资源标识符 */
  readonly identifier: IResourceIdentifier;
  /** 请求资源内容 */
  request(): Promise<T | undefined>;
  /** 写入资源内容 */
  write(data: T): Promise<void>;
}
```

**关键行为（必须知道，决定 D-15 怎么写）** [VERIFIED: packages/libs/editor-core/src/resource/resourceSystem.ts:78-127 + `resource/__tests__/resourceSystem.test.ts:124-149`]：
- `Resource.write(data)` → `injection.writeResource` + **只更新内存缓存，不触发任何钩子**（测试名即「Resource.write 写入后端并同步缓存，不触发钩子」）。
- `ResourceSystem.updateResource(id)` → 作废该 id 的内容缓存 + 向所有钩子广播 `onUpdateResource(id)`；钩子由 `ShellPanelHooks` 转发给 `IEditorPanel.onUpdateResource(id, data)`（重新 request 后拿到新值）。

### Pattern 3: 编辑 → 撤销（D-09）

**What:** 面板自身是 `IUndoable`；每次编辑把「如何撤销/重做」装进 `IUndoContext`，交给 `context.addUndoContext(this, ctx)`。

**契约来源（逐字）** [VERIFIED: packages/libs/editor-core/src/undo/types.ts:1-20]：
```typescript
export interface IUndoContext<T> {
  /** 撤回操作类型 */
  readonly type: number;
  /** 撤回操作包含的数据 */
  readonly data: T;
}
export interface IUndoable {
  /** 执行撤回操作 */
  undo<T>(context: IUndoContext<T>): Promise<void>;
  /** 执行重做操作 */
  redo<T>(context: IUndoContext<T>): Promise<void>;
}
```

`IEditorPanel extends IUndoable` [VERIFIED: panel/types.ts:39-92]，`IEditorPanelContext.addUndoContext(panel, context)` 直接转发给 `UndoSystem.addUndoContext` [VERIFIED: panel/panelContext.ts:32-34]。`UndoSystem`：`maxUndoStep <= 0` 禁撤销；入栈超过上限丢最旧；新入栈清空 redo 栈 [VERIFIED: undo/undoSystem.ts:19-55]。

### Anti-Patterns to Avoid
- **在 core/impl 里 import 宿主/引擎**：`.dependencyCruiser.cjs` 的 `core-must-not-import-consumers` 会拦。表格用到的引擎语义（如 `_range` 表达式求值）必须经注入，不能直接把 `@motajs/editor` 的 `TableMetaEvaluator` 拖进来。
- **一个「全局当前表格」**：D-02 明确禁止。目标表只在面板实例内部。
- **把能力目录互相 import**：`src/table` 不得 import `src/code`/`src/map`/`src/asset`（`capabilities-must-not-import-each-other`）。因此外部编辑器/通用弹窗的「接口定义」不能住在 `src/code` 里。
- **模块级可变状态/容器**：`coreModuleState.js` 会红；状态放类实例字段或 React 状态。
- **`write` 后指望对方自动刷新**：`write` 不广播（见 Pattern 2）；D-15 需要一个显式通知动作。

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 面板注册/实例/标签生命周期 | 自造 tab/实例管理 | `editor-core` 的 `ShellSystem`（`registerPanelType`/`openPanelInTab`/`closeTab`…） | Phase 1 已交付并测试；自造必然与其状态机冲突 |
| 撤销/重做栈 | 自造历史数组 | `editor-core` 的 `UndoSystem` + `IUndoable`/`IUndoContext` | D-09；core 已处理上限/redo 清空/`maxUndoStep<=0` |
| 资源列表/内容缓存 | 自造缓存与去重 | `ResourceSystem`（列表缓存、内容缓存、钩子隔离） | 已在 core 并测试（`resourceSystem.test.ts`） |
| schema 树构建与字段顺序 | 自造遍历/排序 | 参照（重写，非照抄）旧 `utils/traversal.ts` 的 `buildTableTree` 语义：注释键优先、`_leaf` 判叶、缺键补 `null` | 行为 parity（D-07）；边界情况多 |
| 输入控件 | 自造 color/select/checkbox | antd 的 `ColorPicker`/`Select`/`Checkbox`/`InputNumber`/`Input`（D-08，旧表格已用） | UI-SPEC 组件清单即这些；antd 已是 peer |
| 效果/校验表达式求值 | 在 impl 里 `new Function`/`eval` | **注入**一个求值器（引擎侧提供），impl 只调用 | 引擎术语与代码执行属引擎；core/impl 必须引擎无关（见 Pitfall 5） |

**Key insight:** 表格的「轮子」一半在 core（面板/资源/撤销），一半在旧表格（树构建/输入映射/校验语义）。本阶段真正的风险不是缺能力，而是**接口接缝没定死**（D-15 通知、D-06 打开新实例、外部编辑器注入）——这些必须在第一批计划里定义清楚。

## Common Pitfalls

### Pitfall 1: 「实时 schema → 布局」在当前资源层没有现成通路（D-15）
**What goes wrong:** 写 schema 的实例调用 `resource.write()` 后，读 schema 的实例**收不到任何通知**——`write` 只写缓存、不广播（`resourceSystem.ts:78-88`）；而广播要 `ResourceSystem.updateResource(id)`，`IEditorPanelContext` 却不暴露它（只有 5 个方法：`requestResource`/`requestResourceList`/`createResource`/`deleteResource`/`addUndoContext`）。
**Why it happens:** 资源层是「拉 + 显式失效」模型，不是信号模型；面板上下文只给「读/建/删/撤销」，没给「通知」。
**How to avoid:** 见 Open Question 1 的三个选项（给面板上下文加一个「通知资源变更」方法 / 让 impl 侧资源后端在写后回调 / 用共享订阅表）。**必须由规划阶段（并经命名确认）定死一个，否则 D-15 无法验收。**
**Warning signs:** 两个表格面板，一个编辑 schema，另一个不刷新。

### Pitfall 2: 开新面板并设置其目标表，Phase 1 契约没有落点（D-06/D-02）
**What goes wrong:** 「编辑 Schema」要「新开一个面板实例并让它编辑 `table#schema.x`」，但：
- `IEditorPanelFactoryParam` 只有 `{ context, instanceId }`，没有「打开参数」（Phase 1 明确推迟）；
- `IShellSystem.openPanelInTab(tabId, typeId): Promise<boolean>` 只返回布尔（不是实例），且内部**自己** `createInstance`，无法放入「预先建好并 setTable 过的实例」；
- `createPanelInstance(typeId): Promise<IEditorPanel | null>` 能拿到实例，但没有「把这个实例放进某标签」的 API。

**How to avoid:** 见 Open Question 2。常见解法：给 `IEditorPanelType.create`/工厂参数补一个可选的「打开参数」（= 把 Phase 1 推迟的「打开参数」按最小形状解冻），或给面板上下文/工厂参数注入一个「打开表格面板并设目标」的回调（组合根实现）。
**Warning signs:** 计划里写「点击按钮 → `openPanelInTab('table')`」却没有说明新实例的目标表从哪来（会落在「目标未设置」空态）。

### Pitfall 3: PORT-02 禁止 `navigator`/`document`/`localStorage`（旧表格踩过）
**What goes wrong:** 旧表格的「复制」用 `navigator.clipboard.writeText(...)`（`TableRow.tsx:205-220`）；旧空态/加载用了别的 DOM 能力。`eslint.config.js` 的 Block A 对 `packages/libs/{editor-core,editor-impl}/**` 以 **error** 级禁止 `fetch`/`document`/`navigator`/`localStorage`/`XMLHttpRequest` 与 `process.env`/`import.meta.env`（`window` 已被豁免）[VERIFIED: eslint.config.js:100-141]。
**How to avoid:** 剪贴板等宿主能力经注入（由组合根/宿主实现，例如注入一个 `copyText` 回调或 port）；`window` 可用于读视口/焦点，但不要用 `document`。
**Warning signs:** `pnpm lint`/`coreModuleState.js` 在 table 源码上红。

### Pitfall 4: 禁 `import type` 覆盖 `editor-impl` 的**全部**源码（含测试）
**What goes wrong:** 旧表格大量使用 `import type`（`Table.tsx`、`TableRow.tsx`、`DataStore.ts`…）。`coreImportType.js` 扫描 `packages/libs/{editor-core,editor-impl}/src` 下**全部** `.ts/.tsx`（含 `__tests__` 与 `*.test.*`），行首 `import type` 即违规 [VERIFIED: coreImportType.js:29-34,101-109]。
**How to avoid:** 新代码一律普通 `import`；类型再导出用 `export type`；测试同理。本会话实测该门禁当前绿（33 文件 0 命中），新文件不得打破。
**Warning signs:** `node scripts/verify/coreImportType.js` 报出 table 文件的行号。

### Pitfall 5: 引擎术语门禁（注释也算）与「引擎无关」边界
**What goes wrong:** `coreEngineNeutral.js` 扫描 core+impl 生产源码**原始文本（注释也算）**，禁词（大小写敏感、`\b` 词边界）：`tower`、`floor`、`loc`、`autopass`、`autotile`、`idnum`、`airwall`、`commonEvent`、`prefab`、`mota`（`Math.floor` 的成员访问豁免）[VERIFIED: coreEngineNeutral.js:42-67]。把旧表格的领域示例照抄进注释（如「全塔属性」「楼层」的英文）会立刻违规；`mota` 还禁掉了在任何注释里写「mota-js」。此外，旧表格的 `_range`/`_template`/`_transform`/`_onconfirm` 是 JS 表达式字符串，靠 `TableMetaEvaluator` 的 `new Function` 求值——那是**引擎侧**代码，不能进 impl。
**How to avoid:** 表格代码/注释用中性词；表达式/回调求值经注入；`table.<name>`/`table#schema.<name>` 里的 `xxx` 只是不透明 id 串。
**Warning signs:** `node scripts/verify/coreEngineNeutral.js` 打印 `file:line: term`。

### Pitfall 6: 资源标识 `type` 是数字，不是字符串（D-04 的 `table.<name>` 只能放进 `id`）
**What goes wrong:** D-04 说资源标识是 `table.<name>`/`table#schema.<name>`，但 `IResourceIdentifier` 是 `{ type: number; id: string }`，且注释写明 `type`「由外部的枚举真正进行定义」。若把整个 `table.<name>` 当 `type` 或自造字符串 type，`requestResource` 的列表匹配（`item.type===id.type && item.id===id.id`）会失败。
**How to avoid:** 规划阶段定一个资源类型号（谁定义、取值多少）并把 `table.<name>` 放进 `id`；命名经 INTERFACE-NAME 确认。见 Open Question 8。
**Warning signs:** `requestResource` 恒返回 `null`（因为 type 不匹配列表）。

### Pitfall 7: `editor-impl` 的 vitest 缺 `setupFiles`（`Map.getOrInsertComputed` 垫片）
**What goes wrong:** `editor-core` 的 `vitest.config.ts` 有 `setupFiles: ['src/__tests__/mapPolyfill.ts']`（为 `Map.prototype.getOrInsertComputed` 垫片，`ResourceSystem.readContent` 会用到）；`editor-impl` 的配置**没有** `setupFiles`。Phase 2 的测试若走 `ResourceSystem` 读内容，可能因缺垫片失败（Node v24.21.0 实测）。
**How to avoid:** 给 `editor-impl/vitest.config.ts` 加 `setupFiles`（可复用/复制该垫片），或确保测试不触发缺失 API。见 Open Question 9。
**Warning signs:** 测试报 `this.contentCache.getOrInsertComputed is not a function`。

### Pitfall 8: JSX 测试首次跑动时，`vitest.config.ts` 的 babel 插件依赖是「隐藏」的
**What goes wrong:** `editor-impl/vitest.config.ts` import 了 `@vitejs/plugin-react` 并启用 `babel-plugin-react-compiler`，但这两个都**不在** `editor-impl` 的 `devDependencies` 里，也不在其本地 `node_modules`。当前无测试文件，配置虽能加载，但一旦有 `.tsx` 测试被编译，解析这两个包就成真问题。
**Why it happens:** 它们靠 pnpm 的隐藏 hoist（`node_modules/.pnpm/node_modules/babel-plugin-react-compiler` 存在；本会话确认 `@vitejs/plugin-react` 在根 `node_modules`）解析；`editor-core` 的相同配置实测能跑（51 测试绿），因此多半也能用——但这是**待证**而非已知。
**How to avoid:** 执行时先跑一个最小 `.tsx` 测试确认；若解析失败，把 `@vitejs/plugin-react` / `babel-plugin-react-compiler` 加进 `editor-impl` 的 devDependencies（不新增运行时依赖，仅补声明）。
**Warning signs:** vitest 启动即报「Cannot find package '@vitejs/plugin-react'」。

### Pitfall 9: 旧表格是「行为/视觉参照」，不是模板
**What goes wrong:** 旧 `Table` 用 `import type`、`@motajs/react-store`、`eval`、`navigator.clipboard`、`.etable` 百分比布局、`data-cobj` 属性塞 JSON——这些都是新架构下**不合规或不需要**的。照抄会连违规一起抄进来。
**How to avoid:** 只抄「用户可见行为」（树构建语义、输入映射、校验、编辑模式/双击语义、文案），实现全部按本阶段规则重写。
**Warning signs:** 计划里出现「复制 `components/Table/stores/DataStore.ts`」。

## Code Examples

> 均来自本会话逐文件阅读的**现有**源码。旧代码仅作行为参照；新代码按项目规则重写。

### 数据模型（现有表格的 schema 与行）[VERIFIED: packages/apps/editor/src/components/Table/types.ts]
```typescript
// types.ts:9-20 —— 由 _type 决定值单元格的控件（外部编辑器映射也基于它）
export type FieldType =
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'checkboxSet'
  | 'popCheckboxSet'
  | 'event'
  | 'material'
  | 'color'
  | 'point'
  | 'disable';

// types.ts:120 —— 编辑模式（工具栏 Segmented）
export type EditMode = 'change' | 'add' | 'delete';

// types.ts:126 —— 一次变更的统一载荷
export type TableAction = [ActionType, string, unknown];

// types.ts:49-97 —— 每个字段的 schema 配置（节选）
export interface FieldConfig {
  _leaf?: boolean | ((args: FieldArgs) => boolean);
  _type?: FieldType;
  _data?: string;        // 完整注释
  _docs?: string;        // 短注释（工具提示）
  _hide?: boolean | ((args: FieldArgs) => boolean);
  _range?: string;       // 校验表达式（变量名 thiseval）
  _string?: boolean | ((args: FieldArgs) => boolean);
  _select?: SelectConfig;
  _checkboxSet?: CheckboxSetConfig | (() => CheckboxSetConfig);
  _event?: string;
  _directory?: string;
  _transform?: string;
  _onconfirm?: string;
  _lint?: boolean;
  _template?: string;
  _preview?: boolean;
  indent?: number;
}

// types.ts:87-97 —— schema 的根：可嵌套的注释对象（D-04 里 table#schema.<name> 的内容）
export interface CommentObject {
  _type?: 'object';
  _data?: Record<string, FieldConfig | CommentObject> | ((key: string) => FieldConfig);
  _action?: (args: FieldArgs) => void;
}
```

### 树构建语义（parity 参照，重写于新架构）[VERIFIED: packages/apps/editor/src/components/Table/utils/traversal.ts:143-257]
- 键顺序：**先注释配置里的键**（决定顺序），再叠加数据里的键；注释有键而数据没有 → 把数据补齐为 `null`。
- 叶子判定：`_leaf` 默认——值为 `null`/`undefined`、字符串、或空对象/数组 → 叶子；否则 gap（可折叠子区）。
- `_hide` 为真 → 跳过该字段；`_action` 可改写值。
- 动态配置：`_leaf`/`_hide`/`_string` 等可为函数，经求值器解析（旧实现用 `resolveTableMetaFunction`）。
- 每个叶节点产出 `TableNode { field, shortField, isGap:false, value, config, comment, shortComment? }`；gap 节点带 `children`。

### 值单元格控件映射（parity）[VERIFIED: packages/apps/editor/src/components/Table/components/TableRow.tsx:19-58,128-138]
```typescript
// select → SelectInput；checkbox → CheckboxInput；checkboxSet → CheckboxSet；
// color → ColorInput；disable → TextareaInput(disabled, readonly)；其余(含 textarea/event/material/point/popCheckboxSet) → TextareaInput
// 提交前统一走校验：
if (!checkRange(config, newValue)) {
  notifyError(field + ' : 输入的值不合要求,请鼠标放置在注释上查看说明');
  return; // 拒绝提交
}
```

### 校验（`_range` / `_select`）[VERIFIED: packages/apps/editor/src/components/Table/utils/validation.ts:32-45]
```typescript
export function checkRange(cobj: FieldConfig, value: unknown): boolean {
  if (cobj._range) return evaluateTableMetaExpression(cobj._range, value, getTableMetaContext(cobj)).value ?? false;
  if (cobj._select) return cobj._select.values.includes(value);
  return true;
}
// 删除许可 = checkRange(config, null)（null 不允许 → 拒绝删除）
```
> 注意：`evaluateTableMetaExpression` 是本仓 `@motajs/editor` 里的**引擎侧** `new Function` 实现（`project/tableMeta/TableMetaEvaluator.ts:68-91`）。新 impl 不能直接引用它——必须经注入的求值接缝（见 Open Question 6）。

### 编辑模式与双击语义（parity）[VERIFIED: TableRow.tsx:178-235]
- 两次点击间隔 <500ms 视为双击（兼容触屏）。
- `change` → 打开外部编辑器；`add` → `prompt('请输入新项的名称')` + `validateId` + 在父路径加子项；`delete` → `checkRange(config, null)` 通过后 `confirm('确定要删除吗？')` 再删。
- 每次操作后旧代码给成功提示「添加成功，刷新后生效。」/「删除成功，刷新后生效。」（新架构里可能因即时响应而不再需要「刷新后生效」，见 Open Question 10）。

### 操作列按钮（parity）[VERIFIED: ActionButtons.tsx:12-15]
```typescript
const shouldShowEditButton = (type?: FieldType): boolean => {
  if (!type) return true;
  return type !== 'select' && type !== 'checkbox' && type !== 'checkboxSet' && type !== 'color' && type !== 'disable';
};
// popCheckboxSet → 按钮文案「多选框编辑」；disable → 额外显示「复制」；有短注释 → 显示「注释」
```

### 旧表格样式（视觉参照，非模板）[VERIFIED: packages/apps/editor/src/css/editor.css:1200-1316 + `assets/theme/editor_color_light.css:180-220`]
- `.etable table { border-collapse: collapse; }`；旧列宽 **24% / 19% / 32% / 25%**；值列 `position:relative` + 绝对定位的 `.etableInputDiv` 铺满单元格。
- hover 高亮色（cyan/green）与 编辑/折叠 按钮色在 `editor_color_light.css`（`--etable-*` 兼容色即源自此）。
- UI-SPEC 用固定约 400px 四栏替换百分比，并保留 `--etable-*` 兼容色（D-16/D-17）。

### 通用弹窗与外部编辑器的旧调用面（D-11..D-14 的接缝参照）
- 代码编辑器：`CodeEditorContext.open(request)`（`CodeEditorContext.tsx:3-17`），实际 UI 是 `Workbench/CodeEditor/index.tsx` 里一个显隐面板（`#left7`，`hidden-panel`）——**不是外壳标签**。D-11 要改成「独立面板 + 切走即关」。
- 事件编辑器：`EventEditorContext.open(request)`（`EventEditorContext.tsx:3-22`）。
- 弹窗：`useCheckboxSetModal` 返回 `[open(options): Promise<Result|null>, holder]`（`useCheckboxSetModal.tsx:17-51`）；素材/坐标同构；所有 holder 挂在 `ModalsProvider`。D-14 要求把「素材多选」与「多选框编辑」合成一个通用多选弹窗。
- 外部编辑器分发：`openExternalEditor(field, type, config, getValue, setValue, capabilities)`（`externalEditor.ts:34-213`）——capabilities 即上面这些上下文/弹窗钩子。新架构需定义等价注入接缝。

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 本阶段验收基线 = `editor-impl` 自身（`typecheck` + `test`）+ `editor-core` 不退绿 + 仍生效门禁；**不是**全仓 `pnpm test`/`typecheck` 绿（全仓当前红，`@motajs/editor` 半拆遗留） | Summary / Pitfall / Validation | 若用户期望全仓绿，范围会爆炸（需先修 `@motajs/editor` 的旧 shim），严重阻塞 |
| A2 | 本阶段的「schema」= 旧 `components/Table` 的 `CommentObject`/`FieldConfig` 注释对象（资源 `table#schema.<name>`），**不是** `components/SchemaTable` 那套 JSON Schema（`FieldSchema`/`UISchema`） | Summary / Open Q 6 | 若用户指的是 JSON-Schema 表格，则数据模型、`_type` 映射、UI-SPEC 的「四栏 + 编辑模式 + 折叠」全部要重解，工作量与计划结构大变 |
| A3 | D-10 的 `min`/`max` 例子中的 `min`/`max` 字段，来自 JSON-Schema `CombineInputDescriptor` 的 `number` editor（`{min,max,step,integer}`），而非 `FieldConfig`（后者无 min/max）；本阶段把它当作「schema 专用呈现模式」的内建规则集的一部分来定义 | Open Q 6 | 若 schema 呈现规则集理解错，schema 编辑的布局会与用户预期不符 |
| A4 | 资源标识 `type` 号由 impl/装配侧定义（`type` 是数字，`table.<name>` 放在 `id`） | Pitfall 6 / Open Q 8 | 若 type 号归属/取值定错，`requestResource` 恒 `null`，表格打不开 |
| A5 | 三条 core 门禁（importType/moduleState/engineNeutral）+ `coreFsSurface.js` 继续约束新代码 | Pitfall 3/4/5 | 若门禁被放宽，代码约束变化 |
| A6 | `coreExports.js`/`implExports.js`/`coreBoundaries.js` **当前红**，不作为本阶段门禁；但用户可能要求顺带修 | State of the Art / Open Q 7 | 若要求顺带修，范围增加（含 archived `subpathStatus.json` 的处置） |
| A7 | 代码/事件外部编辑器在 Phase 2 期间**尚不存在**，只能定义接缝并优雅降级（D-11 的「独立面板」行为此阶段无法端到端验收） | Open Q 3 | 若要求 Phase 2 就端到端跑通代码/事件编辑，则需把 Phase 5/6 提前，范围爆炸 |

**如果本表非空：** 上述 A1–A7 需在规划/讨论阶段与用户确认，尤其 **A1（验收基线）** 与 **A2（schema 指的是哪一套）** 会决定计划数量、数据模型与测试范围。

## Open Questions

1. **D-15 的「schema 变更 → 立刻重渲染」用哪条通知接缝？**（**最高优先级**）
   - What we know: `Resource.write` 不广播（`resourceSystem.ts:78-88` + 测试）；广播要 `ResourceSystem.updateResource(id)`；`IEditorPanelContext` 只有 5 个方法、**没有**通知方法；`ShellPanelHooks` 已把 `onUpdateResource` 转发给 `IEditorPanel.onUpdateResource`（`shellSystem.ts:643-668`）。
   - What's unclear: 触发点放哪。
   - Options: (a) 给 `IEditorPanelContext` 加一个「通知资源变更」（如 `updateResource(id)`）——改动 `editor-core` 契约，但最小、最通用；(b) 让 impl 侧资源**后端**在写后回调 `resourceSystem.updateResource`——不改 core，但要求后端可触达 core 的 resource system；(c) 面板共享一张按资源 id 的订阅表（impl 模块内），写后本地通知——不改 core，但跨实例靠 impl 内部机制。
   - Recommendation: 先按 (a) 出**接口提案**（因为它是「core 提供能力、impl 消费」的自然形状），在 `INTERFACE-NAME.md` 里与用户确认；若用户希望本阶段不动 core，则退到 (b)。

2. **D-06「新开面板实例并设置目标表」怎么落地？**（**次高优先级**）
   - What we know: 工厂参数无「打开参数」；`openPanelInTab` 返回布尔且自建实例；`createPanelInstance` 返回实例但无「放进标签」的 API；`IEditorPanel` 已有 `onSwitchIn(param?)`（说明「切到时带参」的形状是内建的）。
   - Options: (a) 按最小形状解冻「打开参数」——给 `openPanelInTab`/`createPanelInstance` 加可选参数并透传到 `EditorPanelFactory`；(b) 给面板注入一个「打开表格面板并设目标」的回调（组合根实现，面板不碰 shell）；(c) 组合根在注册面板类型时用闭包持有「待设目标」，工厂读取并 `setTable`。
   - Recommendation: 倾向 (a)（一处契约扩展、对后续能力通用），但**必须**在 `INTERFACE-NAME.md` 里确认命名与形状；若用户坚持「本阶段不通用化打开参数」，则用 (b)。

3. **代码/事件外部编辑器的注入接缝定义在哪、什么形状？**
   - What we know: 旧实现是 React 上下文 capability（`open(request)` / Promise 弹窗钩子）。Phase 5/6 尚未实现；D-11 要求「独立面板 + 切走即关」。
   - Recommendation: 在 `editor-impl` 的一个**非能力目录**（如 `src/shared/` 或 `src/react/`）定义 capability 接口（代码 opener、事件 opener、多选弹窗 opener、坐标弹窗 opener）；表格通过面板工厂参数/闭包或 React Context 取得；缺省时优雅降级（禁用「编辑」并给出提示，而非崩溃）。本阶段用 fake/占位实现写测试。

4. **通用多选弹窗（D-13/D-14）落在哪个模块？**
   - What we know: 能力目录之间不得互相 import；`react`/`shell` 也不得 import 能力目录（`.dependencyCruiser.cjs:46-62`）。所以它既不能在 `src/table/`，也不能在 `src/code/`，且 `src/react/` 不能 import `src/table/`。
   - Recommendation: 放进一个共享模块（`src/shared/` 或 `src/react/`），表格 import 它（能力 → 共享是允许的）。

5. **表格组件与面板内部状态用什么？**
   - What we know: 旧表格用 `@motajs/react-store` 的 `createStore`（非 `editor-impl` 依赖）；`editor-impl` 有 `@tanstack/react-store` + `@tanstack/store`。
   - Recommendation: 优先纯 React 状态（`useState`/`useMemo`/`useCallback`）实现折叠/编辑模式；需要跨组件共享时用 `@tanstack/react-store`。避免引入 `@motajs/react-store`。

6. **A2/A3：本阶段的「schema」到底是哪一套？**
   - What we know: UI-SPEC（用户 2026-10-11 批准）描述的四栏（条目/注释/值/操作）、编辑模式（编辑/添加/删除）、折叠 gap 行、`_type` 控件映射、外部编辑器按钮，与旧 `components/Table`（`commentObj` 驱动）**逐项吻合**；而 `components/SchemaTable` 是另一套 JSON Schema 驱动的两栏表，二者的 `min`/`max` 概念只在前者没有、后者才有。
   - Recommendation: 以「旧 `components/Table` + `CommentObject`」为准（A2），并把 D-10 的 `min`/`max` 当作「schema 专用呈现规则集」的一部分（内建规则）在 `INTERFACE-NAME.md`/计划里**显式列出并确认**（UI-SPEC 已把它列为待确认 F2）。**这是本阶段第一个该向用户确认的点。**

7. **三条 stale 门禁（coreExports / implExports / coreBoundaries）要不要顺带处理？**
   - What we know: `coreExports.js`/`implExports.js` 依赖已归档、已不存在的 `subpathStatus.json`（实测 `Test-Path` False），且断言 `sideEffects === false`（与 Phase 1 的 core 改动 + Phase 2 UI-SPEC 要求的 impl 改动冲突）；`coreBoundaries.js` 因 `src/table` 不存在而红。
   - Recommendation: 本阶段不把它们纳入验收门禁；但**顺带确认**：Phase 2 建出 `src/table/` 后 `coreBoundaries.js` 的「能力互斥」断言会否自然变绿（值得在验证时跑一次记录结果）。是否修/退役另两条，作为独立范围决策请用户确认（同 Phase 1 Open Q1 的处置方式）。

8. **资源类型号（`IResourceIdentifier.type`）由谁定义、取什么值？**
   - What we know: 注释写明「由外部的枚举真正进行定义」；`resource` 目录内**没有**任何现成枚举。
   - Recommendation: 由 `editor-impl`（或装配侧）定义一个数字枚举（table 数据 vs table schema 是否同 type、还是两个 type），命名经 `INTERFACE-NAME.md` 确认。

9. **`editor-impl/vitest.config.ts` 是否补 `setupFiles`（Map 垫片）？**
   - Recommendation: 若测试会碰 `ResourceSystem` 的读路径，补上；可与 Pitfall 8 的依赖声明一起在一个「工程脚手架」小计划里处理。

10. **旧文案「…刷新后生效」在新架构下是否保留？**
    - What we know: 旧表格是内存镜像 + 异步落盘，故文案写「刷新后生效」；新架构同为零等待内存优先，但「刷新」指重载工程。UI-SPEC 把它逐字保留为 parity 文案。
    - Recommendation: 保持 UI-SPEC 逐字文案（parity 优先），除非用户要求改。

## Runtime State Inventory

> 本阶段是**新能力实现**（在空壳 `editor-impl` 里新增 `src/table/`），不是重命名/迁移阶段，因此本节的五个「运行时状态」类别按规则省略。仅记录一处与构建有关的产物：

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None** —— 表格数据/schema 都经注入的资源后端持久化，本阶段不新增任何数据库/集合/键。 | 无 |
| Live service config | **None** —— 无外部服务配置。 | 无 |
| OS-registered state | **None** —— 无任务计划/服务注册。 | 无 |
| Secrets/env vars | **None** —— core/impl 禁 `process.env`/`import.meta.env`。 | 无 |
| Build artifacts | `packages/libs/editor-impl/tsconfig.tsbuildinfo`（`tsc -b` 增量产物）；新增源文件后陈旧，重建即可。 | 增量编译自动重建，无需手工迁移 |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | 构建/测试 | ✓ | v24.21.0（本会话实测 `node --version`） | — |
| pnpm | workspace 脚本 | ✓ | 12.5.1（CI 固定，`.github/workflows/ci.yml`） | — |
| React / React DOM | 表格组件 | ✓ | `editor-impl` devDep（catalog ^19.2.3） | — |
| antd | 全部表格控件（D-08） | ✓ | 6.2.1（本会话实测 `editor-impl/node_modules/antd/package.json`） | — |
| vitest | 单测 | ✓ | 4.0.18（`editor-impl` devDep） | — |
| jsdom | 测试环境 | ✓ | 26.1.0（`editor-impl` devDep） | — |
| @testing-library/react | 组件测试 | ✓ | catalog（经 `editor-impl` devDeps） | — |
| ESLint（含 core 门禁块） | 门禁 | ✓ | 9.39.2 | — |
| `@vitejs/plugin-react` | `editor-impl/vitest.config.ts` 加载 | ✓（根 node_modules，非本地声明） | catalog | 若解析失败，补进 `editor-impl` devDeps（见 Pitfall 8） |
| `babel-plugin-react-compiler` | vitest babel 插件 | ✓（pnpm 隐藏 hoist） | 1.0.0 | 同上，补 devDeps |
| dependency-cruiser | `coreBoundaries.js` | ✓ | catalog（该门禁当前红，见 Open Q7） | — |

**Missing dependencies with no fallback:** 无。
**Missing dependencies with fallback:** `@vitejs/plugin-react` / `babel-plugin-react-compiler` 未在 `editor-impl` 声明（靠 hoist 解析）；若首个 `.tsx` 测试无法编译，按 fallback 补声明。

## Validation Architecture

> `.planning/config.json` 的 `workflow.nyquist_validation: true` → 本节启用。

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 + @testing-library/react + jsdom 26.1.0 |
| Config file | `packages/libs/editor-impl/vitest.config.ts`（本阶段可能要补 `setupFiles`，见 Pitfall 7） |
| Quick run command | `pnpm --filter @motajs/editor-impl test`（当前红：「No test files found」→ 加测试后转绿） |
| Full suite command | `pnpm --filter @motajs/editor-impl test && pnpm --filter @motajs/editor-impl typecheck` |
| Regression (core) | `pnpm --filter @motajs/editor-core test && pnpm --filter @motajs/editor-core typecheck`（本会话实测 51 测试绿、typecheck 退出 0） |
| Active gates | `node scripts/verify/coreImportType.js`、`node scripts/verify/coreEngineNeutral.js`、`node scripts/verify/coreModuleState.js`、`node scripts/verify/coreFsSurface.js`（本会话实测均退出 0） |
| Stale gates（非本阶段门禁） | `coreExports.js`、`implExports.js`、`coreBoundaries.js`（均红，见 Open Q7；Phase 2 建 `src/table/` 后 `coreBoundaries` 有机会转绿） |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TABLE-01 | 面板类型注册进 `ShellSystem` 后，空白标签列出并可打开，实例 `render()` 出表格 | component/unit | `pnpm --filter @motajs/editor-impl test -- -t "表格面板"` | ❌ Wave 0 |
| TABLE-01 | 设置目标表 → 经资源层取到 `table.<name>` 数据，按 `table#schema.<name>` 渲染出 gap/叶行与四栏 | component | 同上 | ❌ Wave 0 |
| TABLE-01 | 行内改值：按 `_type` 选控件、校验 `_range`、失败拒绝并提示 | component | 同上 | ❌ Wave 0 |
| TABLE-01 | 添加/删除（编辑模式下双击 / 名称校验 / null 许可）即时反映 | component | 同上 | ❌ Wave 0 |
| TABLE-01 | 一次编辑 = 一次可逆操作：`undo`/`redo` 经 `UndoSystem` 生效 | unit | 同上 | ❌ Wave 0 |
| TABLE-01 | D-15：schema 变化后列布局重算并重渲染（依赖 Open Q1 定下的接缝） | component | 同上 | ❌ Wave 0 |
| TABLE-01 | D-05：schema 目标不再有 schema（不显示「编辑 Schema」） | component | 同上 | ❌ Wave 0 |
| TABLE-01 | D-06：点「编辑 Schema」新开面板并指向 `table#schema.x`（依赖 Open Q2） | component | 同上 | ❌ Wave 0 |
| TABLE-01 | 加载/空/错误态文案（UI-SPEC 逐字） | component | 同上 | ❌ Wave 0 |
| TABLE-01 | 布局/横向滚动/分割线/悬停高亮 | **manual-only** | 无（jsdom 不做布局；见下） | ❌ 人工验收 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @motajs/editor-impl test`
- **Per wave merge:** `pnpm --filter @motajs/editor-impl test && pnpm --filter @motajs/editor-impl typecheck` + 三条 core 门禁 + `coreFsSurface.js`；并跑一次 `pnpm --filter @motajs/editor-core test` 确认 core 未退绿
- **Phase gate:** `editor-impl` test/typecheck 全绿 + core 不退绿 + 门禁全绿 + 关键流程人工验收（含「画面与现状一致」）
- **Max feedback latency:** ~60s

### Manual-Only Verifications
| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 固定约 400px 四栏、列间/行间/区域间分割线、窄面板横向滚动、悬停高亮 | TABLE-01（D-16/D-17） | jsdom 不应用 CSS 布局，无法断言位置/滚动/视觉 | 在真实宿主里挂外壳 + 表格面板，缩窄面板观察横向滚动，逐项核对 UI-SPEC 的颜色/字号/分割线 |
| 「画面与现状一致」（与旧 `components/Table` 对照） | TABLE-01（D-07） | 视觉 parity 需目视 | 并排打开旧/新表格面板，逐字段核对控件、折叠、编辑模式、操作列与文案 |

### Wave 0 Gaps
- [ ] `packages/libs/editor-impl/src/table/**` 首个测试文件（面板 + 组件），使 `vitest run` 从「No test files」转绿
- [ ] 测试夹具：`FakeResourceInjection`（内存后端，可预置 `table.*` / `table#schema.*`）+ `FakeShell`/资源+撤销装配（可参照 `editor-core/src/shell/__tests__/shellSystem.test.ts:17-120` 的夹具骨架）
- [ ] `editor-impl/vitest.config.ts` 的 `setupFiles`（Map 垫片，若测试触达 `ResourceSystem` 读路径）
- [ ] `editor-impl/src/global.d.ts`（`declare module '*.css';`，若要 import 局部 CSS；仿 `editor-core/src/global.d.ts`）
- [ ] 若 `sideEffects` 随 CSS 改动：`editor-impl/package.json` + 一处工程记录（与 stale `implExports.js` 的冲突需备注，见 Open Q7）

> 部分基础设施已存在：`editor-core` 证明 jsdom + RTL + vitest 在该 monorepo 可用（51 测试绿）；`ResourceSystem`/`ShellSystem`/`UndoSystem` 均有内存夹具可参照。

## Security Domain

> `.planning/config.json`：`security_enforcement: true`、`security_asvs_level: 1`、`security_block_on: high` → 本节启用。

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | 无认证面 |
| V3 Session Management | no | 无会话 |
| V4 Access Control | no | 无权限面 |
| V5 Input Validation | yes | 字段名校验（`validateId`：仅 `[a-zA-Z0-9_]`、拒绝重复）；值校验（`_range`/`_select`，经注入求值器）；资源 id 由装配侧给出、不做路径拼接 |
| V6 Cryptography | no | 无加密 |

### Known Threat Patterns for schema 驱动表格 + editor-impl
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 通过单元格文本/注释注入标记（XSS） | Tampering | React 默认转义；**禁** `dangerouslySetInnerHTML`（UI-SPEC 明确；旧 `htmlEscape` 行为由 React 默认转义达成） |
| 表格里的「代码/表达式」求值（`_range`/`_template`/`_transform`/`_onconfirm`，旧实现用 `new Function`/`eval`） | Elevation / Tampering | 求值器**不进 core/impl**，由引擎侧注入；impl 只把字符串交给注入的求值器。`externalEditor.ts` 里对代码的 `eval` 属引擎侧，不应搬进 impl |
| 宿主 fs 路径穿越 | Tampering | 不在 core/impl 范围——路径安全由宿主实现（core 只定义接口/资源 id 交给后端） |
| 变更未撤销导致数据错乱 | Tampering | 每次编辑必经 `context.addUndoContext`；失焦/失败路径不得产生半态 |
| 原型污染（新增项名 `__proto__` 等） | Tampering | `validateId` 白名单字符集天然排除；不得绕过校验直接写对象键 |
| 依赖新增面 | Tampering | 本阶段**不新增包**；无需供应链门禁 |

## Sources

### Primary (HIGH confidence) — 本会话直接阅读/实测的仓库源码
- `packages/libs/editor-core/src/resource/{types,resource,resourceSystem}.ts`、`resource/__tests__/resourceSystem.test.ts`
- `packages/libs/editor-core/src/undo/{types,undoSystem}.ts`、`panel/{types,panelContext}.ts`、`shell/{types,shellSystem}.ts`、`shell/__tests__/shellSystem.test.ts`、`fs/types.ts`、`types.ts`、`core.ts`、`index.ts`、`log/messages.ts`、`global.d.ts`
- `packages/libs/editor-core/vitest.config.ts`、`package.json`、`tsconfig.json`
- `packages/libs/editor-impl/{package.json,tsconfig.json,vitest.config.ts,src/index.ts}`
- `packages/apps/editor/src/components/Table/**`（`index.tsx`、`types.ts`、`components/{Table,TableHeader,TableBody,TableRow,GapRow,EditModeSegmented,ActionButtons}.tsx`、`components/inputs/*`、`stores/{DataStore,FoldStore}.ts`、`hooks/*`、`utils/{traversal,validation}.ts`、`externalEditor.ts`）
- `packages/apps/editor/src/components/SchemaTable/**`（概览：`SchemaTable.tsx`、`types.ts`、`index.ts`、`schema.ts` 的 combine/min/max、`schema-table.css`）
- `packages/apps/editor/src/Workbench/{TowerPanel,FloorPanel,LocPanel/*,CodeEditor/*,EventsEditor/EventEditorContext.tsx,modals/**}`、`hooks/{useTableMeta,useTableMetaSuspense}.ts`、`project/tableMeta/TableMetaEvaluator.ts`、`css/editor.css`、`assets/theme/editor_color_light.css`
- 门禁与配置：`eslint.config.js`、`.dependencyCruiser.cjs`、`scripts/verify/{coreImportType,coreEngineNeutral,coreModuleState,coreBoundaries,coreFsSurface,coreExports,implExports}.js`、`.planning/config.json`、`.github/workflows/ci.yml`
- 实测命令输出（本会话）：`pnpm --filter @motajs/editor-impl typecheck`（exit 0）、`pnpm --filter @motajs/editor-impl test`（exit 1，No test files）、`pnpm --filter @motajs/editor-core test`（5 文件/51 测试绿）、`node scripts/verify/coreImportType.js`（exit 0）、`coreEngineNeutral.js`（exit 0）、`coreModuleState.js`（exit 0）、`coreFsSurface.js`（exit 0）、`coreBoundaries.js`（exit 1，能力互斥 fixture 未被命中）、`node --version`（v24.21.0）
- `.planning/phases/01-shell/*`（CONTEXT、INTERFACE-NAME、RESEARCH、PATTERNS、VALIDATION、VERIFICATION）作为前序契约与验收基线依据

### Secondary (MEDIUM confidence)
- `.planning/{PROJECT,REQUIREMENTS,ROADMAP}.md`、`packages/apps/editor/AGENTS.md` 即仓库根 `AGENTS.md`（用户产出/项目规则）

### Tertiary (LOW confidence)
- 无。本阶段**未使用**任何外部网络检索：`.planning/config.json` 的搜索 provider 全为 `false`（`exa/brave/firecrawl/tavily/ref/perplexity/jina`），且本阶段领域是仓库内重构、锁定决策已足够。**外部库（antd 6.2.1 / React 19）的行为说明未做 Context7/official-docs 取证**；如需某控件的确切属性，应在实现时读 `node_modules` 内类型或官方文档。

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH —— 无新依赖；antd 6.2.1 实测存在；React/vitest/jsdom 均由既有配置实测可用。
- Architecture: HIGH —— 面板/资源/撤销/外壳契约逐行读过并引用了逐字片段；接缝缺口（D-15/D-06）也由完整接口与实测门禁定位。
- Pitfalls: HIGH —— 四条门禁本会话实测运行并确认绿/红；`write` 不广播由源码与测试双证。
- 旧表格 parity 语义: HIGH —— `components/Table/**` 逐文件阅读；`components/SchemaTable` 仅概览。
- 目标「schema」身份: MEDIUM —— UI-SPEC 强指旧 `CommentObject`，但 D-10 的 `min`/`max` 只在 JSON-Schema 侧存在，需用户确认（A2/A3、Open Q6）。

**Research date:** 2026-10-12
**Valid until:** 约 30 天（仓库内重构，稳定）；若旧里程碑 stale 门禁被修复、`editor-impl` 目录结构变化、或用户澄清「schema」身份，需复核。

## RESEARCH COMPLETE

**Phase:** 2 - 表格编辑
**Confidence:** HIGH（目标 schema 身份为 MEDIUM，已列入 Assumptions/Open Questions）

### Key Findings
- 本阶段是「按新架构重写旧 `components/Table`」：数据 `table.<name>`、schema `table#schema.<name>`，都经 `editor-core` 资源层（D-03/D-04）；**不是** JSON-Schema 的 `components/SchemaTable`（需用户确认，A2/Open Q6）。
- `editor-core` 资源层是「拉 + 显式失效」而非响应式：`write` 不广播、`IEditorPanelContext` 无通知方法 → **D-15 需要新增一条通知接缝**（Open Q1，最高优先级）。
- Phase 1 契约下「开新面板并设置目标表」（D-06/D-02）**没有现成落点**（无打开参数、`openPanelInTab` 无法放入预建实例）→ 需定一个最小扩展（Open Q2）。
- `editor-impl` 受四条仍生效门禁约束（禁 `import type`、禁模块级状态、禁 `navigator`/`document`/`fetch`、禁引擎术语含注释）；`coreFsSurface.js` 禁引用 `IEditorFileSystem`。全仓测试当前红，**验收基线只能按 `editor-impl` + `editor-core` 理解**（A1）。
- 旧表格属「行为/视觉 parity 参照」，不是模板；其 `eval`/`navigator.clipboard`/`import type`/`@motajs/react-store`/`new Function` 求值都不能照搬（Pitfall 9/3/4/5）。

### Open Questions（需用户在规划前/`INTERFACE-NAME.md` 确认）
1. D-15 通知接缝的落点；2. D-06 打开新面板并设目标的机制；3. 代码/事件外部编辑器注入接缝与降级；4. 通用多选弹窗的模块位置；5. 组件内部状态方案；6. 「schema」身份与 schema 呈现规则集（F2）；7. stale 门禁是否顺带处理；8. 资源类型号；9. vitest `setupFiles`；10. 「刷新后生效」文案是否保留。

### File Created
`.planning/phases/02-table/02-RESEARCH.md`

### Ready for Planning
研究完成。planner 可据此产出 PLAN.md；**建议第一批计划为接口定义与接缝设计**（Open Q1–Q4/Q8），经 `INTERFACE-NAME.md` 确认后再排实现。
