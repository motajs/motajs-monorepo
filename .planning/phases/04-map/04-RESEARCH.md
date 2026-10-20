# Phase 4: 地图编辑 (Map Editing) - Research

**Researched:** 2026-10-20
**Domain:** `@motajs/editor-impl/map` — 一个地图编辑面板（地图清单 / 打开 / 新建 / 图层切换与新增 / 图块调色板与多格笔刷 / 画布绘制与框选复制粘贴 / 只读通行度叠加 / 地图属性表单 / 手动保存与未保存拦截 / 视口与大地图），数据全部经宿主注入，渲染用 PixiJS，表单复用 `shared/schemaForm`。
**Confidence:** HIGH for 仓库内契约（本会话逐文件读取并引用行号）；MEDIUM for 新中立文档 / 能力注入形状、`editor-core` 关闭前拦截接缝、UI-SPEC 与 D-02 的图块目录状态口径（需 `INTERFACE-NAME.md` + 用户确认）；LOW for 没有任何证据支持的性能阈值与视觉细节（已逐条列入 Assumptions / Open Questions）。

> **本文件中的代码标识全部是「提案名」**，不是已锁定契约。项目规则要求：任何重要命名（文件名 / 接口名 / 方法名 / 字段名 / 导出符号 / CSS 类名 / `data-test-id`）必须先写入 `.planning/phases/04-map/INTERFACE-NAME.md` 并经用户确认，才可落进代码、计划或配置。见 §Naming Proposals。

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### A. 地图数据与宿主接口

- **D-01:** 地图数据以**「整份通用文档」**方式注入：宿主把自己的地图解析成一份**不认识引擎**的数据交给面板（宽度、命名图层、每层数字格子、图块目录、通行信息）；面板改完整份交回宿主，由宿主写回自己的文件格式。面板**不认识文件路径，也不认识引擎文件格式**，因此**不需要**注入 `.jsonc` 解析函数。 — **Reversibility:** costly —— 这是地图能力与宿主之间的主契约，改形状要同时改面板、开发宿主与未来引擎适配层。
- **D-02:** 中立文档**自足**：同时装「图层 + 图块目录 + 通行性显示数据」。面板拿到一份文档就能画图、能显示通行度，不需要再向多个通道取数据。 — **Reversibility:** costly —— 文档形状被面板渲染、绘制、撤销共同依赖。
- **D-03:** 地图的打开与保存 = **宿主提供地图清单 + 打开 / 保存回调**；面板不读文件，也不负责选文件路径。 — **Reversibility:** costly —— 与 D-01 同属主契约。
- **D-04:** 保存接口**按数据域拆分注入**：地图数据、地图属性、事件各是一块接口，**每块都传整份数据**（地图接口传整张地图，属性接口传整个属性表，事件接口传所有事件）；不同项目可以注入不同实现。面板只交自己改过的域，**未展示的数据（如点事件）由宿主保留**，不得因保存而丢失。 — **Reversibility:** one-way —— 这是面向所有宿主的注入契约，一旦发布再改需要迁移每个宿主实现。
- **D-05:** **新建地图**与**新增图层**都支持，但**由宿主执行**（宿主按自己的格式建文件 / 加层）；面板只发指令并接收更新后的文档。 — **Reversibility:** costly —— 扩展宿主适配器接口面。
- **D-06:** 地图尺寸上限由**宿主注入**；超限时面板拒绝新建 / 改尺寸并提示。 — **Reversibility:** reversible —— 只影响校验提示。

#### B. 图层与图块

- **D-07:** 图层由宿主提供，面板负责**切换**；新增图层经 D-05 的宿主回调。本阶段**不做**图层重命名、排序、删除、图层设置面板。 — **Reversibility:** reversible —— 后续补设置面板不需要改数据契约。
- **D-08:** 图块目录由**宿主算好每一项**：图块编号 + 图片路径 + 裁切矩形 + 名称 + 通行属性。面板只负责展示与选择，**不需要懂纹理切分规则**。 — **Reversibility:** costly —— 目录形状决定调色板渲染与通行度显示。
- **D-09:** 调色板支持**一次框选多格**图块；选中后鼠标移到地图上时，必须显示与所选区域**同尺寸的矩形预览**，而不是单格。 — **Reversibility:** costly —— 绘制与预览逻辑围绕多格笔刷构建。
- **D-10:** 素材区布局 = **分组可折叠 + 缩略图网格**（每个宿主给的分组一个标题，下面是网格）。 — **Reversibility:** reversible —— 纯视图布局。
- **D-11:** 「最近使用图块」= 素材区里的**单独分区**，跨会话持久化到**项目内约定文件**（不引入新的 core 接口，也不依赖浏览器本地存储）。 — **Reversibility:** costly —— 一旦有项目文件被写入，改位置需要迁移/清理。
- **D-12:** **擦除** = 调色板里放一个**「空」格子**，选中后绘制即清空对应格子；多格笔刷时清空整个矩形范围。 — **Reversibility:** reversible —— 与画笔共用同一条绘制路径。

#### C. 通行性与图块属性

- **D-13:** **本阶段不编辑通行性。** 新引擎的通行性**完全由图块自身属性决定**，地图上不能单独调整；面板只提供**只读的四方向通行度叠加层**，方便查看哪里走不通。 — **Reversibility:** one-way —— 这修改了 ROADMAP / MAP-01 的既定验收（原条目要求「编辑通行性并看到生效结果」），恢复编辑需重新定义数据与交互。
- **D-14:** **图块属性只读**：地图面板只用图块名称与通行属性做展示 / 计算，不提供修改入口。图块属性的编辑留给未来的图块 / 素材配置能力。 — **Reversibility:** reversible —— 后续在别处补编辑入口即可。

#### D. 地图属性

- **D-15:** 做**地图属性编辑表单**，字段由**宿主注入一份 JSON Schema** 描述（面板不写死引擎字段），复用 `editor-impl` 已有的 schema 表单引擎；属性整体作为「整个属性表」交给宿主保存（D-04）。 — **Reversibility:** costly —— 表单引擎与注入 schema 的约定会被宿主依赖。

#### E. 编辑交互

- **D-16:** 画笔模式 = **线 / 矩形 / 填充**三种。 — **Reversibility:** reversible。
- **D-17:** 撤销粒度 = **一笔一次**：从鼠标按下到松开算一次；线 / 矩形 / 填充各算一次。 — **Reversibility:** costly —— 撤销记录的组织方式围绕笔画构建。
- **D-18:** 保存 = **手动保存**，与表格 / 素材一致；切换或关闭面板前提示未保存改动。 — **Reversibility:** costly —— 保存模型影响所有编辑入口与测试。
- **D-19:** 右键契约**对齐旧编辑器**：右键**拖拽** = 框选一块区域；右键**单击** = 弹出菜单；**绘制中按右键** = 取消当前这一笔。 — **Reversibility:** costly —— 与画布手势、菜单、选区状态耦合。
- **D-20:** 框选用于**图块区域的复制 / 粘贴**：只复制**当前图层**；粘贴以**鼠标位置为左上角**，**超出地图范围的部分裁剪**；右键菜单与 **Ctrl+C / Ctrl+V** 都可触发（快捷键仅在焦点位于地图画布时生效）。 — **Reversibility:** costly —— 复制数据形状与粘贴定位规则会被用户依赖。
- **D-21:** **视口移动**与**大地图模式**纳入本阶段（常用辅助），行为参照旧编辑器。 — **Reversibility:** reversible。
- **D-22:** **点事件本阶段完全不做**（不显示、不绑定、不编辑），留给事件编辑器阶段；事件数据在保存时由宿主的独立事件接口原样保留（D-04）。 — **Reversibility:** costly —— 后续接事件需要对上这里的域拆分。

#### F. 范围修订

- **D-23:** 按用户指示，**取消 ROADMAP / MAP-01 中「编辑通行性」的要求**，改为「只读查看通行性」；这是对既定验收条目的正式修订，研究与规划不得再按「可编辑通行性」设计。 — **Reversibility:** one-way —— 恢复需要重新引入通行性编辑的数据与交互定义。
- **D-24:** 本阶段实际范围 = **最小集 + 常用辅助 + 区域复制粘贴 + 新建地图/新增图层 + 地图属性表单**。研发与规划不得再扩大（事件、图块属性、图层设置、复制粘贴事件均不在内）。 — **Reversibility:** reversible。

### the agent's Discretion

- 地图清单在面板里的**呈现形式**（空栏内联列表 / 工具栏下拉）与**切换方式**（同面板内切换 / 关闭重开），由规划阶段提出。
- **新建地图**时的表单字段（名称、初始尺寸、初始图层）与默认值，由规划阶段提出。
- **大地图模式**的具体交互与渲染细节，由规划阶段提出。
- 「最近使用图块」偏好文件的**约定路径、格式、条目上限**，由规划阶段提出并经 `INTERFACE-NAME.md` 确认。
- **图块图片字节的取得方式**（经 `editor-core` 资源层按路径读取，还是由宿主直接注入字节 / URL），由研究与规划阶段定；不得让面板直接触达真实文件系统。
- 所有**接口名 / 方法名 / 字段名 / 文件名 / 导出符号名**，由规划阶段提出并写入 `INTERFACE-NAME.md`，经用户确认后才可落盘。

### Deferred Ideas (OUT OF SCOPE)

- **编辑通行性** —— 用户指示本阶段不做；新引擎通行性由图块属性决定，后续若要做需重新定义数据与交互（D-13 / D-23）。
- **点事件的显示 / 绑定 / 编辑** —— 留给 Phase 6 事件编辑器；届时与按域注入的事件接口对接（D-22）。
- **图块属性编辑**（名称 / 通行方向 / 事件模板）—— 属图块 / 素材配置能力，不在本阶段（D-14）。
- **图层重命名 / 排序 / 删除 / 图层设置面板** —— 旧编辑器有，本阶段只切换与新增（D-07）。
- **事件叠加、右键事件菜单项、复制粘贴事件** —— 依赖事件能力，本阶段不做。
- **旧编辑器的楼层切换 / 后退、绑定楼梯 / 传送门 / 机关门** —— 属引擎专属交互，本阶段不做。
- **插件加载 / 注册机制** —— 后续里程碑。

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MAP-01 | 用户可编辑地图（层 / 块 / 通行性） | 本阶段按 D-13 / D-23 正式修订：**通行性只读**。交付物为 `@motajs/editor-impl/map` 默认地图面板：宿主注入地图清单 / 打开 / 保存（按域）/ 新建地图 / 新增图层 / 图块目录 / 尺寸上限 / 属性 Schema；面板提供图层切换、图块调色板（多格）、线 / 矩形 / 填充、擦除、框选复制粘贴、只读通行度叠加、地图属性表单、一笔一次撤销、手动保存、视口与大地图；并接入开发宿主。见 §Architecture Patterns、§Code Examples、§Validation Architecture。 |

> ROADMAP 第 3 条「用户可编辑通行性并看到生效结果」**已被 D-13 / D-23 正式修订为「只读查看通行度叠加层」**。研究、计划与实现均不得再设计通行性编辑入口。`[VERIFIED: .planning/phases/04-map/04-CONTEXT.md:59,78]`（原文：「**本阶段不编辑通行性。**」「**取消 ROADMAP / MAP-01 中「编辑通行性」的要求**」）
</phase_requirements>

## Project Constraints (from AGENTS.md)

- **先接口、后实现**：原文「**任何阶段的第一步都是接口定义。** 在接口被定义并经用户确认之前，不得开始写实现。」`[VERIFIED: AGENTS.md:545-552]`
- **重要命名先确认**：原文「Any **important naming** — file names, interface names, method names, function names, type names, package names, exported symbol names — MUST be reported to the user and confirmed **before** it is written into code, plans, or config.」报告写在 `.planning/phases/<phase>/INTERFACE-NAME.md`，每个 Plan 一节，每个名字说明用途。`[VERIFIED: AGENTS.md:500-504]`
- **方法引用写 `类名.方法名`**：原文「write it as **`ClassName.methodName`** (e.g. `EditorCore.registerCapability`), never as a bare method name.」自由函数才允许裸名。`[VERIFIED: AGENTS.md:506-512]`
- **计划执行门禁**：原文「计划执行前必须得到用户**字面为「可以执行」四个字**的指示。」执行前简报（plan id/goal、大致内容、问题、验证方式），执行后汇报「①执行情况 ②下一个计划」；覆盖 `--auto`。`[VERIFIED: AGENTS.md:467-498]`
- **代码风格（本项目覆盖 dev.md）**：原文「不使用 `import type`（用普通 import；类型再导出用 `export type`）」；「**枚举成员：大驼峰**（不用全大写、也不用字符串值）」；类必须先有 `interface` 再 `implements`；接口成员默认 `readonly`；无文件头注释；给所有方法 / 成员写 JSDoc；尽量不用 `?.`；不在函数内定义局部函数；一个文件通常只放一个类；LF 换行。`[VERIFIED: AGENTS.md:554-569]`
- **网络请求走本机代理**：原文「MUST go through the proxy **`http://127.0.0.1:7890`**」。本阶段不新增依赖，预期不触发。`[VERIFIED: AGENTS.md:528-533]`

---

## Summary

Phase 4 交付 `@motajs/editor-impl/map`：一个由宿主注入数据的「地图编辑器」面板。它不读地图文件、不认识引擎格式、不直接触达文件系统；宿主把地图解析成**自足的中立文档**（宽高、命名图层、每层数字格子、宿主算好的图块目录与通行方向），面板编辑后按**数据域**把整份地图 / 整份属性表交回宿主。面板内部提供图层切换、分组调色板、多格笔刷、线 / 矩形 / 填充、擦除、框选复制粘贴、只读通行度叠加、地图属性表单、一笔一次撤销、手动保存、视口与大地图。

仓库里的底座已经齐备，且本会话逐项确认：

- **面板契约**：`IEditorPanel` 已有 `initialize` / `dispose` / `render` / `onSwitchIn` / `onSwitchOut` / `getTitle?` / `undo` / `redo`；`IEditorPanelContext` 已提供按路径请求资源、创建 / 删除 / 移动资源、列目录与 `addUndoContext`。`[VERIFIED: packages/libs/editor-core/src/panel/types.ts:5-101]`
- **撤销契约**：`IUndoContext` 已带 `barrier?: boolean`；`IUndoSystem.undo(): Promise<boolean>` 命中屏障时返回 `false` 并触发 `onUndoBlocked`。`[VERIFIED: packages/libs/editor-core/src/undo/types.ts:3-10,53-63; packages/libs/editor-core/src/undo/undoSystem.ts:40-55]`
- **资源契约**：`IResource.requestBinary()` 已存在，面板可以按路径读图块字节而不触达真实文件系统。`[VERIFIED: packages/libs/editor-core/src/resource/types.ts:19-40]`
- **能力注入范式**：素材能力用 `createAssetPanelType(capabilities)` 把注入面包进工厂闭包，而不是自装配进 core。`[VERIFIED: packages/libs/editor-impl/src/asset/assetPanelType.ts:54-76]`
- **表单复用**：`shared/schemaForm` 已提供 `buildTableTree` / `setByFieldPath` / `validateValue` / `TableGrid`；`TableGrid` 目前**总是**渲染 `TableToolbar`，没有「表单模式」开关。`[VERIFIED: packages/libs/editor-impl/src/shared/schemaForm/components/TableGrid.tsx:50-95,557-578]`
- **PixiJS**：`pixi.js@8.19.0` 已是 `editor-impl` 的 peerDependency + devDependency（本会话解析到 8.19.0）。`[VERIFIED: packages/libs/editor-impl/package.json:24-34; packages/libs/editor-impl/node_modules/pixi.js/package.json]`
- **门禁**：`coreEngineNeutral` 禁止 `tower/floor/loc/autopass/autotile/idnum/airwall/commonEvent/prefab/mota` 出现在 `editor-core/src` 与 `editor-impl/src` 的**源码 + 注释**；`coreModuleState` 禁止 `fetch/document/navigator/localStorage/XMLHttpRequest` 与模块级可变状态；`.dependencyCruiser.cjs` 禁止能力之间互相 import。`[VERIFIED: scripts/verify/coreEngineNeutral.js:47-58; scripts/verify/coreModuleState.js:52-59; .dependencyCruiser.cjs:53-62]`

**Primary recommendation:** 用「**工厂注入 + 中立文档 + 分域手动保存 + diff 撤销 + 纯渲染模型 + Pixi 画布**」六件事落地；接口层先定 5 组类型（中立文档 / 图块目录 / 能力注入 / 面板视图状态 / 面板动作），实现层先做纯逻辑（几何 / BFS / 图案 / 通行度 / 渲染模型），再做面板数据层，最后做视图与 Pixi。**不要在 `map` 里 import `table` / `asset`**；表单复用只能走 `shared/schemaForm`。**图块目录保持在文档内（D-02）**，调色板的「加载 / 失败」按**图片字节**状态实现（见 Open Question 2）。**关闭标签前的未保存拦截需要给 `editor-core` 增加一个可选的关闭前钩子**（见 Open Question 1），这是本阶段唯一的跨包接口改动。

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 地图清单 / 打开 / 新建 / 新增图层 / 按域保存 | **宿主适配器（组合根）** | `editor-impl/map` 面板（只发指令、显示结果） | D-01 / D-03 / D-04 / D-05：面板不读文件、不认识路径与格式；宿主写回自己的文件。 |
| 中立地图文档（宽高 / 图层 / 格子 / 图块目录 / 通行方向） | `editor-impl/map` 模型层 | 宿主适配器（把引擎格式转成中立文档） | D-01 / D-02 / D-08：面板需要一份自足、可渲染、可撤销的文档。 |
| 绘制 / 擦除 / 填充 / 框选复制粘贴 | `editor-impl/map` 面板 + 纯模型 | `editor-core` 撤销系统 | D-16 / D-17 / D-19 / D-20：编辑意图与几何在面板，撤销在 core。 |
| 图块调色板与图片显示 | `editor-impl/map` 视图 | `editor-core` 资源层（按路径读字节） | D-08 / D-12：宿主给路径与裁切矩形，面板不碰真实文件系统。 |
| 只读通行度叠加 | `editor-impl/map` 模型（按宿主给的每图块方向布尔值计算） | Pixi 渲染 | D-13 / D-14：只显示、不修改、不置脏、不产生撤销。 |
| 地图属性表单 | `shared/schemaForm`（表单引擎） | `editor-impl/map` 抽屉 + 宿主（Schema 与值） | D-15：不复制表单控件；地图能力只做接线。 |
| 最近使用图块 | `editor-impl/map` 面板 | `editor-core` 资源层（项目内约定文件） | D-11：不新增 core 接口、不用 localStorage。 |
| 未保存拦截 / 关闭标签 | `editor-core` 外壳 | `editor-impl/map` 面板 | D-18：面板知道自己是否脏，外壳负责关闭时序。 |
| 引擎文件解析 / 写回 | **宿主适配器** | 开发宿主（演示用内存实现） | D-01 / D-22：`editor-core` / `editor-impl` 必须引擎无关。 |
| 撤销屏障提示「无法撤销」 | 组合根（宿主） | `editor-core` 撤销钩子 | 资产阶段已在开发宿主用 `core.undoSystem.addHook({ onUndoBlocked })` 实现。`[VERIFIED: packages/apps/editor-dev/src/demo/assetDemo.ts:636-645]` |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@motajs/editor-core` | workspace | 面板生命周期、撤销、资源层 | 唯一底层；`impl → core` 单向依赖。`[VERIFIED: packages/libs/editor-impl/package.json:40-42]` |
| `antd` | catalog `6.2.1` | 工具栏 / 弹窗 / 抽屉 / 分段 / 下拉 / 表格表单宿主 | 已是 `editor-impl` peerDependency；Phase 2 D-08 锁定 antd + 局部 CSS。`[VERIFIED: packages/libs/editor-impl/package.json:24-34; pnpm-workspace.yaml:38]` |
| `pixi.js` | catalog `8.19.0` | 地图格子、网格、框选、预览、通行度叠加 | 已是 `editor-impl` peerDependency + devDependency；本会话从 `editor-impl/node_modules` 解析到 8.19.0。`[VERIFIED: packages/libs/editor-impl/package.json:24-34; pnpm-workspace.yaml:65]` |
| `react` / `react-dom` | catalog `^19.2.3`（`editor-impl` dev 固定 19.3.0） | 面板与视图 | peerDependency。`[VERIFIED: packages/libs/editor-impl/package.json:24-34,51-67]` |
| `@tanstack/store` / `@tanstack/react-store` | catalog | 面板视图状态订阅 | `editor-impl` 直接依赖；资产面板同款 `Store<T>` + `useStore`。`[VERIFIED: packages/libs/editor-impl/package.json:40-50; packages/libs/editor-impl/src/asset/assetPanel.ts:2-4]` |
| `es-toolkit` | catalog | 纯工具（如 `clamp` / `get`） | 已是 `editor-impl` 依赖。`[VERIFIED: packages/libs/editor-impl/package.json:44]` |
| `json5` | catalog `2.2.3` | 最近使用偏好文件的宽松解析回退（经 `shared/jsonc`） | 已是 `editor-impl` 依赖；复用 `parseTableText`。`[VERIFIED: packages/libs/editor-impl/package.json:46; packages/libs/editor-impl/src/shared/jsonc/tableText.ts:55-61]` |
| `json-schema-typed` / `ajv` | catalog | 地图属性 Schema 类型 / 校验（经 `shared/schemaForm`） | 已是 `editor-impl` 依赖；不直接在新代码里重复编译校验器。`[VERIFIED: packages/libs/editor-impl/package.json:43-45]` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@testing-library/react` | `16.3.2` | 面板 / 视图 DOM 测试 | 所有 jsdom 组件测试。`[VERIFIED: packages/libs/editor-impl/package.json:54]` |
| `vitest` | catalog | 单元 / 集成测试 | `pnpm --filter @motajs/editor-impl test`。`[VERIFIED: packages/libs/editor-impl/vitest.config.ts]` |
| `jsdom` | `26.1.0` | 测试环境 | 已有；Pixi 不能在其中真正初始化（见 Pitfalls）。`[VERIFIED: packages/libs/editor-impl/package.json:61]` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 宿主注入 `imageUrl` / 图片字节 | 面板按路径经 `IEditorPanelContext` 读字节 | 注入 URL 让面板少一次异步，但把 URL 生命周期 / 宿主路径约定压给每个宿主，且 service worker 宿主生成 blob URL 更绕；**推荐按路径读字节**（`requestBinary`），与素材面板的 `loadBytes` 同款。 |
| 图块目录走独立 `loadTileCatalog()` 通道 | 图块目录放在中立文档里（D-02） | 独立通道能更贴合 UI-SPEC 的「图块目录加载 / 失败」，但直接违反 D-02。**推荐保留在文档内**，把调色板状态解释为图片字节加载状态（Open Question 2）。 |
| 新增一套「地图表单」组件 | 复用 `shared/schemaForm` 的 `TableGrid`（加表单模式开关） | 复制会分裂控件与校验；UI-SPEC F11 明确要求加开关而不是复制。 |
| 在 `map` 里 import `table` 的 `FakeFileSystem` | 在 `map/__tests__` 自持一份同形替身 | 门禁禁止能力互相 import；表格 / 素材已各自持有一份，地图按同样方式复制最小替身。 |
| 模块级 Pixi 纹理 / 应用池（旧编辑器做法） | 组件 / 类实例字段持有 | `coreModuleState` 禁止模块级 `new Map()` / 数组 / 对象；旧 `MapPixiRenderer` 的 `frameTextureCache` / `pixiApplicationPool` 不能照搬。`[VERIFIED: packages/apps/editor/src/MapEditor/rendering/MapPixiRenderer.tsx:44,90-106]` |
| 自己画 canvas 像素 | PixiJS | 已是 peerDependency；UI-SPEC 锁定。 |

**Installation:** 无。本阶段**不新增任何依赖**；`antd` / `pixi.js` / `react` / `@tanstack/*` / `json5` 均已声明。

**Version verification:** `node -e` 从 `packages/libs/editor-impl/node_modules` 解析到 `pixi.js 8.19.0`、`antd 6.2.1`；`pnpm-workspace.yaml` 的 catalog 分别固定在 `38: antd: 6.2.1`、`65: pixi.js: 8.19.0`。`[VERIFIED: packages/libs/editor-impl/node_modules/pixi.js/package.json; packages/libs/editor-impl/node_modules/antd/package.json; pnpm-workspace.yaml:38,65]`

### Verified constants (verbatim)

> 下面是本阶段会反复引用的离散值，逐字抄自源码；实现 / 计划如需复用，必须以这些值为准。

```js
// scripts/verify/coreEngineNeutral.js:47-58
const BANNED_TERMS = [
  'tower',
  'floor',
  'loc',
  'autopass',
  'autotile',
  'idnum',
  'airwall',
  'commonEvent',
  'prefab',
  'mota',
];
```

```js
// scripts/verify/coreModuleState.js:52
const BANNED_GLOBALS = ['fetch', 'document', 'navigator', 'localStorage', 'XMLHttpRequest'];
```

```js
// scripts/verify/implExports.js:45
const EXPECTED_SUBPATHS = ['.', './code', './table', './shared', './map', './asset', './shell', './react'];
```

```json
// packages/libs/editor-impl/package.json:10-19
"exports": {
  ".": "./src/index.ts",
  "./code": "./src/code/index.ts",
  "./table": "./src/table/index.ts",
  "./shared": "./src/shared/index.ts",
  "./map": "./src/map/index.ts",
  "./asset": "./src/asset/index.ts",
  "./shell": "./src/shell/index.ts",
  "./react": "./src/react/index.ts"
}
```

```yaml
# pnpm-workspace.yaml:38,65（catalog 缩进两空格）
  antd: 6.2.1
  pixi.js: 8.19.0
```

> `./map` 的目标 `./src/map/index.ts` **当前不存在**（本会话 `Get-ChildItem packages/libs/editor-impl/src` 只列出 `asset / react / shared / table / __tests__`）。本阶段必须创建它，否则 `@motajs/editor-impl/map` 的导入会解析失败。`[VERIFIED: packages/libs/editor-impl/package.json:10-19; packages/libs/editor-impl/src 目录列表]`

## Package Legitimacy Audit

> 本阶段**不安装任何外部包**，故不触发包合法性门禁。下表只记录本阶段实际使用、且已在仓库内声明的 peer / 依赖。

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `antd` | npm | 既有依赖（catalog 固定 6.2.1） | — | 未在本会话核验 | OK（已声明，无安装） | 直接使用 |
| `pixi.js` | npm | 既有依赖（catalog 固定 8.19.0） | — | 未在本会话核验 | OK（已声明，无安装） | 直接使用 |
| `@tanstack/store` / `@tanstack/react-store` | npm | 既有依赖 | — | 未在本会话核验 | OK（已声明，无安装） | 直接使用 |
| `json5` | npm | 既有依赖（catalog 2.2.3） | — | 未在本会话核验 | OK（已声明，无安装） | 经 `shared/jsonc` 使用 |

**Packages removed due to SLOP verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```text
                    ┌──────────────────────────────────────────────────────────┐
                    │ 宿主适配器（开发宿主 / 未来 @motajs/editor）              │
                    │ - 解析自己的地图格式 → 中立文档                           │
                    │ - 写回自己的地图格式（保留事件 / 属性 / 其它字段）        │
                    │ - 图块表 + 纹理清单 → 图块目录（编号/图片路径/裁切/名称/通行方向）│
                    └───────────────┬──────────────────────────────────────────┘
                                    │ 注入能力（listMaps / openMap / saveMapData /
                                    │ createMap / addLayer / readProperties / saveMapProperties /
                                    │ propertiesSchema / maxMapSize / recentTilesPath）
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ MapPanel（面板类：数据与状态接线）                                                │
│  - 当前地图的中立文档（宽高 + 命名图层 + 每层数字格子 + 图块目录）                 │
│  - 视图状态 Store（图层 / 画笔 / 选区 / 剪贴板 / 脏标记 / 保存状态 / 对话框）      │
│  - 撤销：一笔一次 IUndoContext<Cells|Property|Barrier>                             │
│  - 手动保存：按域快照 → saveMapData / saveMapProperties                            │
│  - 最近使用：经 IEditorPanelContext 读写项目内约定文件                              │
└───────────────┬───────────────────────────────┬──────────────────────────────────┘
                │ 纯模型（无 React / 无 Pixi）   │ React 视图
                ▼                               ▼
   ┌────────────────────────────┐   ┌──────────────────────────────────────────────┐
   │ document / geometry /      │   │ MapPanelView                                 │
   │ brush / fill / clipboard / │   │  ├ MapToolbar（antd）                        │
   │ passability / renderModel /│   │  ├ MapPalette（空 / 最近 / 分组折叠 + 多格选择）│
   │ recentTiles / dirty /      │   │  ├ MapCanvas（DOM 手势 + 标尺 + 状态条）      │
   │ validation                 │   │  │   └ MapSurface（Pixi：格子/网格/叠加层）  │
   └────────────────────────────┘   │  ├ MapContextMenu（role=menu）               │
                                    │  ├ MapPropertiesDrawer（shared TableGrid）    │
                                    │  └ dialogs（新建 / 新增图层 / 未保存 / 清除）  │
                                    └───────────────┬──────────────────────────────┘
                                                    │ 按路径读图块字节
                                                    ▼
                                    ┌──────────────────────────────────────────────┐
                                    │ editor-core 资源层（缓存 + 注入的 fs）        │
                                    │ IEditorPanelContext.requestResource(...)     │
                                    │   .requestBinary() → Blob URL / Pixi Texture │
                                    └──────────────────────────────────────────────┘

撤销 / 重做：外壳快捷键（window）→ UndoSystem → MapPanel.undo / MapPanel.redo
关闭标签：外壳 closeTab → MapPanel.onBeforeClose?（提案）→ 未保存对话框 → dispose
```

### Recommended Project Structure

```text
packages/libs/editor-impl/src/map/            # 提案；所有文件名待 INTERFACE-NAME 确认
├── index.ts                                  # ./map 子路径桶：types + 面板 + 组件 + 工厂
├── types.ts                                  # 中立文档 / 图块目录 / 能力 / 面板 / 视图状态 / 枚举
├── constants.ts                              # 默认尺寸 / 格子尺寸 / 最近使用上限 / 路径 / 文案
├── mapPanel.ts                               # MapPanel：数据层 + 状态 + 撤销 + 保存
├── mapPanelType.ts                           # createMapPanelType(capabilities)
├── map.css                                   # 单一样式表；类前缀 emap-
├── model/
│   ├── document.ts                            # 文档校验 / 尺寸 / 不可变格子写入
│   ├── geometry.ts                            # 坐标换算 / 正交路径 / 矩形 / 裁剪
│   ├── brush.ts                               # 多格图案解析 / 线 / 矩形 / 填充目标格
│   ├── fill.ts                                # 四邻域 BFS
│   ├── clipboard.ts                           # 复制 / 粘贴（左上角 + 越界裁剪）
│   ├── passability.ts                         # 只读四方向阻挡计算
│   ├── renderModel.ts                         # 纯渲染模型（可见格 / 层序 / 裁剪 / 叠加标记）
│   ├── recentTiles.ts                         # 最近使用列表更新 / 过滤 / 上限
│   ├── dirty.ts                               # 地图数据 / 属性域的结构化比较
│   └── validation.ts                          # 地图名 / 图层名 / 尺寸校验
├── components/
│   ├── MapPanelView.tsx                       # 状态 → 组件装配
│   ├── MapToolbar.tsx                         # 两行工具栏 + 窄面板「视图」下拉
│   ├── MapCanvas.tsx                          # 手势、快捷键、标尺、状态条、右键菜单协作
│   ├── MapSurface.tsx                         # Pixi 生命周期 + 场景绘制（唯一 Pixi 入口）
│   ├── MapPalette.tsx                         # 空格 / 最近 / 分组折叠 / 多格框选
│   ├── MapStatusBar.tsx                       # 坐标 / 选区 / 地图 / 图层 / 模式
│   ├── MapContextMenu.tsx                     # role=menu / 键盘导航 / 边缘夹取
│   ├── MapPropertiesDrawer.tsx                # antd Drawer + shared TableGrid（表单模式）
│   ├── MapEmptyState.tsx                      # 清单加载 / 失败 / 空 / 未打开
│   └── dialogs/                               # 新建地图 / 新增图层 / 未保存 / 清除最近
└── __tests__/
    ├── fixtures.ts                            # FakeFileSystem 同形替身 + createMapHarness
    ├── model.*.test.ts                        # 纯逻辑
    ├── mapPanel.test.tsx                      # 数据层 / 撤销 / 保存 / 拦截
    └── mapView.*.test.tsx                     # 视图（mock MapSurface）
```

`packages/apps/editor-dev/src/demo/mapDemo.ts`（提案）负责：内存地图文件、地图清单、宿主适配器（新引擎形状 ↔ 中立文档，保留事件 / 额外字段）、两个演示地图、两个图块分组（含一个缺图）、属性 Schema、注册面板类型。

### Pattern 1: 工厂闭包注入能力（不导入宿主、不自装配）

**What:** 地图能力像素材一样，用一个工厂把 `IMapEditorCapabilities` 闭包进面板类型；顶层（开发宿主 / 未来 `@motajs/editor`）调用 `createMapPanelType(capabilities)` 后把返回值注册进 `ShellSystem.registerPanelType`。

**When to use:** 只要能力需要宿主注入数据，就使用这个形态；不要导出 `install(core)` 之类的自装配函数。

**Evidence:** 素材面板的工厂注释与实现明确说「面板类在切入时才需要分类清单，而 core 创建面板时不传能力，故用工厂而非常量导出」。`[VERIFIED: packages/libs/editor-impl/src/asset/assetPanelType.ts:7-8,54-76]`

```ts
// 提案；名称待 INTERFACE-NAME 确认
export function createMapPanelType(capabilities: IMapEditorCapabilities): IEditorPanelType {
  return Object.freeze({
    id: MAP_PANEL_TYPE_ID,
    name: '地图编辑器',
    icon: createMapIcon(),
    create: (param: IEditorPanelFactoryParam): MapPanel => {
      const panel = new MapPanel(param, capabilities);
      const openParam = param.openParam; // 仅透传；收窄由面板做
      if (openParam !== undefined) {
        const target = openParam.target;
        if (isMapPanelTarget(target)) panel.setMap(target);
      }
      return panel;
    },
  });
}
```

**Why not put capabilities in React context:** 面板类在 `create` 时就需要能力来加载地图清单 / 打开地图；从 React Context 读会让「数据层」依赖组件树，违背 Phase 2 的「面板类不读 React Context」约定。

### Pattern 2: 中立文档 + 宿主适配器（两种引擎形状都能装下）

**What:** 面板只认识一份通用文档，宿主负责把引擎格式翻译成它，再把编辑结果翻译回去。

**Proposed neutral shape（提案，不是锁定契约）:**

```ts
// 提案；字段名待 INTERFACE-NAME 确认
export interface IMapDocument {
  readonly id: string;                 // 宿主不透明标识；面板不解释
  readonly name: string;               // 显示名
  readonly width: number;              // 列数
  readonly height: number;             // 行数（可显式给，也可由图层推导后由宿主填）
  readonly layers: readonly IMapLayer[];      // 顺序即绘制顺序
  readonly tileGroups: readonly IMapTileGroup[]; // 宿主算好的图块目录（D-08）
}

export interface IMapLayer {
  readonly id: string;                 // 稳定标识；宿主写回时用它映射回自己的字段 / 序号
  readonly name: string;               // 显示名
  readonly isEventLayer: boolean;      // 仅用于通行性显示（onlyEvents 语义）
  readonly cells: readonly (readonly number[])[]; // [y][x]；0 = 空
}

export interface IMapTileGroup {
  readonly id: string;
  readonly name: string;
  readonly imagePath: string;          // 相对项目根的资源路径；面板按路径读字节
  readonly columns: number;            // 图集列数（调色板网格与图案映射）
  readonly tiles: readonly IMapTileEntry[];
}

export interface IMapTileEntry {
  readonly number: number;             // 格子里的数字（> 0）
  readonly column: number;             // 图集内列（0 基）
  readonly row: number;                // 图集内行（0 基）
  readonly crop: IMapTileCrop;         // 源图像素裁切
  readonly name: string;
  readonly pass: IMapTilePass;         // 中立的方向布尔值，不是引擎位掩码
}

export interface IMapTileCrop {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface IMapTilePass {
  readonly out: IMapDirections;        // true = 可以离开
  readonly in: IMapDirections;         // true = 可以进入
  readonly onlyEventLayer: boolean;    // true = 只在事件层生效
}

export interface IMapDirections {
  readonly up: boolean;
  readonly right: boolean;
  readonly down: boolean;
  readonly left: boolean;
}
```

**Evidence that this shape covers both models:**

- 旧编辑器：`FloorData` 有 `width?` / `height?` / `map?: number[][]` / `bgmap?: number[][]` / `fgmap?: number[][]`，图层是**二维数字数组**，层名是属性名。`[VERIFIED: packages/apps/editor/src/types/game.ts:28-51]` 这正是 `IMapLayer.cells: number[][]` 的原生形状。
- 新引擎：`IMapRawData` 是 `floorId` / `width` / `map: Record<number, number[]>` / `layerAlias: Record<number, string>` / `events`，**没有 height**，每层是**扁平数组**，高度由 `len / width` 推导。`[VERIFIED: E:/github/template/packages-user/data-common/src/store/types.ts:260-271]` 宿主适配器把 `map[n]` 切成 `height` 行、用 `layerAlias[n]`（或「图层 {n}」）作 `name`、用 `n` 作 `id`，即可装进中立文档。
- 新引擎的 `ITilePassData` 是 `{ onlyEvents: boolean; outPass: number; inPass: number }`，`PassBit` 是 `Up=0b0001 / Right=0b0010 / Down=0b0100 / Left=0b1000`，注释明确 `outPass` 是「可以离开的方向」、`inPass` 是「可以进入的方向」。`[VERIFIED: E:/github/template/packages-user/data-common/src/store/types.ts:27-45]` 宿主把它翻译成 `IMapDirections` 的四个布尔值；**面板不接触位掩码**，因此不会把引擎语义带进 `editor-impl`。
- 新引擎的图块表 `ITileRawData` 有 `num` / `id` / `events` / `type` / `pass` / `eventPass`。`[VERIFIED: E:/github/template/packages-user/data-common/src/store/types.ts:47-63]` 宿主只需要用 `num` + 纹理清单（`type/source/map/width/height`）算成 `number` + `imagePath` + `crop` + `name` + `pass` 五项；`type` / `events` / `eventPass` 不进中立目录（本阶段不展示，也不编辑）。

**Verbatim shapes (source-of-truth quotes):**

```ts
// packages/apps/editor/src/types/game.ts:28-38（旧编辑器）
export interface FloorData {
  floorId: string;
  title?: string;
  name?: string;
  width?: number;
  height?: number;
  map?: number[][];
  bgmap?: number[][];
  fgmap?: number[][];
  images?: FloorImageData[];
  events?: Record<string, unknown>;
```

```ts
// E:/github/template/packages-user/data-common/src/store/types.ts:260-271（新引擎）
export interface IMapRawData {
    /** 楼层 id */
    readonly floorId: string;
    /** 地图宽度 */
    readonly width: number;
    /** 地图数组 */
    readonly map: Record<number, number[]>;
    /** 每个地图图层的字符串别名 */
    readonly layerAlias: Record<number, string>;
    /** 每个地图图层中，指定位置图块的事件数据，外层键为图层纵深，中层键为图块位置索引，内层键为事件优先级 */
    readonly events: Record<number, Record<number, Record<number, string>>>;
}
```

```ts
// E:/github/template/packages-user/data-common/src/store/types.ts:27-45（新引擎通行位）
export const enum PassBit {
    /** 上方向掩码 */
    Up = 0b0001,
    /** 右方向掩码 */
    Right = 0b0010,
    /** 下方向掩码 */
    Down = 0b0100,
    /** 左方向掩码 */
    Left = 0b1000
}

export interface ITilePassData {
    /** 是否仅当图块处在事件层时生效 */
    readonly onlyEvents: boolean;
    /** 可以离开的方向 */
    readonly outPass: number;
    /** 可以进入的方向 */
    readonly inPass: number;
}
```

```ts
// E:/github/template/packages-user/data-common/src/store/types.ts:47-63（新引擎图块）
export interface ITileRawData {
    /** 图块数字 */
    readonly num: number;
    /** 图块字符串 id */
    readonly id: string;
    /** 默认事件，键表示优先级，值表示事件 id */
    readonly events: Record<number, string>;
    /** 图块逻辑类型 */
    readonly type: TileType;
    /** 图块的通行性对象 */
    readonly pass: ITilePassData;
    /**
     * 事件可通行性，当为 `false` 时，玩家会通过撞击触发图块的触发器，
     * 当为 `true` 时，玩家会通过走上去触发图块的触发器。类似于旧样板的 `noPass`
     */
    readonly eventPass: boolean;
}
```

> 新引擎地图样本确实是单层、`width: 13`、`map: { "0": [ ... ] }`、`layerAlias: {}`、`events: {}`；`empty.jsonc` 的第 0 层有 169 个 0（13×13），**没有 height 字段**。`[VERIFIED: E:/github/template/src/content/maps/empty.jsonc:4-5,179-180; node -e 读取 empty.jsonc：keys [ 'floorId', 'width', 'map', 'layerAlias', 'events' ]，width 13，len 169，heightGuess 13]`
> 纹理清单条目是 `{"type":"grid","source":"terrains0.png","map":[17,...],"width":32,"height":32}`；地图清单是 `["empty","MT0","sample0","sample1","sample2"]`。`[CITED: E:/github/template/src/content/texture/.list.jsonc:5-10; E:/github/template/src/content/maps/.list.jsonc:3]`

**Why not include properties/events in the document:** D-01 明列文档内容是「宽度、命名图层、每层数字格子、图块目录、通行信息」，不含属性与事件；D-04 要求按域保存，且「面板只交自己改过的域」。属性走独立的读取 / 保存回调（Open Question 3），事件本阶段完全不读取、不修改，由宿主的 `saveMapData` 在写回时保留。

**多格图案的编号映射（关键差异）：** 旧编辑器假设图集编号连续，用 `startIdnum + (sourceY + dy) * columns + sourceX + dx` 算图案编号；`[VERIFIED: packages/apps/editor/src/project/commands/mapCommands.ts:133-137]` 新引擎 / 中立目录里每个图块自带 `number` + `column` + `row`，编号不一定连续（也可能有空洞），所以新实现必须按 `(column, row)` 查 `tileGroups[].tiles`，**不能照搬旧公式**。这也是为什么 `IMapTileEntry` 需要 `column` / `row`，而不只是 `number`。

**Why not flat `number[]` layers:** 面板的绘制、BFS、裁剪、复制粘贴都以 `[y][x]` 最直接；扁平数组由宿主在打开时切一次、保存时拼一次，成本远小于面板每次访问都做 `y * width + x`。旧编辑器本来就是二维数组，中立形状选二维也更接近“旧代码只作参考”的最小惊讶。

### Pattern 3: 按域保存 + 基线快照 + 分域脏标记

**What:** 面板维护两份“已保存基线”（地图数据、地图属性）。每次编辑只改内存；点「保存地图」时只提交有改动的域，每域传整份快照。保存成功后，把**发送出去的那份快照**设为新基线；如果保存期间又编辑了，当前状态与新基线不同 → 脏标记保留。

**Why:**
- D-04 要求按域拆分、每块传整份数据；宿主可以只实现自己支持的域。
- 手动保存（D-18）与表格 / 素材一致；切换 / 关闭前用基线做「保存 / 放弃 / 取消」。
- 用基线而不是布尔 `dirty`，撤销 / 重做后可以**重新计算**脏状态（UI-SPEC 明确要求）。

**Proposed capability shape（提案）:**

```ts
// 提案；名称待 INTERFACE-NAME 确认
export interface IMapEditorCapabilities {
  /** 列出项目地图；面板只拿 id + name */
  readonly listMaps: () => Promise<readonly IMapSummary[]>;
  /** 打开一张地图；宿主返回中立文档 */
  readonly openMap: (mapId: string) => Promise<IMapDocument>;
  /** 保存地图数据域（宽高 + 图层 + 每层格子）；宿主保留未展示字段 */
  readonly saveMapData: (mapId: string, data: IMapDataSection) => Promise<void>;
  /** 新建地图；宿主建文件并返回新文档（可选：宿主不支持新建时面板禁用入口） */
  readonly createMap?: (request: IMapCreateRequest) => Promise<IMapDocument>;
  /** 新增图层；宿主加层并返回更新后的文档（可选） */
  readonly addLayer?: (mapId: string, layerName: string) => Promise<IMapDocument>;
  /** 读取地图属性（整个属性表）；可选 */
  readonly readProperties?: (mapId: string) => Promise<Record<string, unknown>>;
  /** 保存地图属性（整个属性表）；可选 */
  readonly saveMapProperties?: (mapId: string, properties: Record<string, unknown>) => Promise<void>;
  /** 属性表单的 JSON Schema；缺省时「地图属性」入口禁用 */
  readonly propertiesSchema?: ITableSchemaNode;
  /** 地图尺寸上限；缺省表示不限制 */
  readonly maxMapSize?: IMapSizeLimit;
  /** 最近使用偏好文件路径；缺省用编辑器约定常量 */
  readonly recentTilesPath?: string;
}

export interface IMapSummary {
  readonly id: string;
  readonly name: string;
}

export interface IMapCreateRequest {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly initialLayerName: string;
}

export interface IMapDataSection {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly layers: readonly IMapLayer[];
}

export interface IMapSizeLimit {
  readonly maxWidth: number;
  readonly maxHeight: number;
}
```

**Events domain:** D-04 说「事件各是一块接口」。本阶段面板**不读取、不显示、不修改**事件，因此它**永远不会调用**事件保存接口；`saveMapData` 的宿主实现必须在写回时保留自己文件里的事件与其它字段。这是对 D-04「面板只交自己改过的域」的直接落实，但**需要用户确认**（Open Question 7）。如果用户要求现在就声明事件接口，再加一个本阶段不调用的可选成员即可，不要为了“凑齐三个域”而让面板伪造事件数据。

**Save snapshot rule:** 保存时先取快照（数据域 / 属性域分别取），再 `await` 宿主；成功时把**该快照**设为基线，而不是把 `this.document` 设为基线。否则保存期间的编辑会被误判为已保存。

### Pattern 4: 不可变格子编辑 + diff 撤销 + 边界屏障

**What:** 每一笔先在内存里算出「净变化」（`{x, y, before, after}` 去重，后写覆盖先写），提交时一次性写入不可变的新图层，并登记**一条** `IUndoContext`。撤销 / 重做按载荷把 `before` / `after` 写回；不复制整张地图。

**Undo payload（提案）:**

```ts
// 提案；名称待 INTERFACE-NAME 确认
export const enum MapUndoType {
  /** 格子变化：一笔 / 一次粘贴 / 一次清空 */
  Cells,
  /** 属性字段变化：一次提交 */
  Property,
  /** 宿主侧边界：新建地图 / 新增图层 / 切换地图 / 放弃改动 */
  Barrier,
}

export interface IMapCellsUndoData {
  readonly mapId: string;
  readonly layerId: string;
  readonly changes: readonly IMapCellChange[];
}

export interface IMapCellChange {
  readonly x: number;
  readonly y: number;
  readonly before: number;
  readonly after: number;
}
```

**Verified base contract:** `IUndoContext<T>` 有 `readonly type: number`、`readonly data: T`、`readonly barrier?: boolean`；撤销命中屏障时 `UndoSystem.undo()` 不弹栈、返回 `false` 并触发 `onUndoBlocked`。`[VERIFIED: packages/libs/editor-core/src/undo/types.ts:3-10; packages/libs/editor-core/src/undo/undoSystem.ts:40-55]`

**Barrier points (recommended):**
- 宿主新建地图成功 → 屏障（新文档，旧地图的撤销不能套到新文档上）。
- 宿主新增图层成功 → 屏障（UI-SPEC 明确要求）。
- 成功切换到另一张地图 → 屏障（否则旧地图的 diff 会被套到新地图上）。
- 未保存对话框选「放弃改动」→ 屏障（不能让撤销把已放弃的改动又贴回来）。
- 屏障只挡住撤销，不进入重做栈；`addUndoContext` 会清空重做栈。

**Why not one undo per cell:** D-17 锁定「一笔一次」；每格一条会让 100 格的一笔产生 100 条历史，且撤销体验与旧编辑器不一致。

**Why not full-document snapshots per stroke:** 大地图（例如 256×256 = 65,536 格）每笔复制整份会让每次落笔产生数 MB 的垃圾；diff 只与落笔覆盖的格子成正比。

**Immutable update rule:** `cells` 是 `readonly number[][]`。提交时复制被触及的**行**（不是整层、不是整图），再复制层数组。这样一横笔只复制一行 + 层数组，一竖笔复制多行但仍是 O(width × touchedRows)。

### Pattern 5: 纯渲染模型 + Pixi 表面 + DOM 控件

**What:** 把「这一帧要画什么」算成一个纯数据模型（`IMapRenderModel`），Pixi 组件只负责把这些数据变成 `Sprite` / `Graphics`。手势、工具栏、调色板、菜单、抽屉全部是 DOM + antd。

**Why:**
- jsdom 里 Pixi 无法真正初始化（无 WebGL；`document` 门禁也不允许我们手写 canvas 创建），纯模型可以在 vitest 里完整断言层序、裁剪、可见格、通行度标记、大地图缩放。
- UI-SPEC 明确要求「pixi.js 只负责把地图格子与叠加层画到 canvas 上；工具栏 / 调色板 / 弹窗 / 抽屉全部是普通 DOM + antd」。
- 旧编辑器的渲染器把纹理缓存 / Pixi 应用池放在模块级，`coreModuleState` 会拦；新实现把缓存放在组件 ref 或渲染器实例字段。

**Proposed render model（提案）:**

```ts
// 提案；字段名待 INTERFACE-NAME 确认
export interface IMapRenderModel {
  readonly width: number;              // 画布 CSS 像素
  readonly height: number;
  readonly cells: readonly IMapRenderCell[];   // 按绘制顺序排好
  readonly grid: readonly IMapGridLine[];      // 或交给 Graphics 一次画
  readonly passMarks: readonly IMapPassMark[];
  readonly selection?: IMapRect;
  readonly preview?: IMapPreview;
  readonly hover?: IMapCellPosition;
}

export interface IMapRenderCell {
  readonly key: string;
  readonly imagePath: string;
  readonly crop: IMapTileCrop;
  readonly dest: IMapRect;             // 目标像素矩形（大地图时缩小）
  readonly alpha: number;              // 非当前层 0.3（待确认，见 Open Question 4）
  readonly missing: boolean;           // 图片缺失 / 未知编号 → 占位
}
```

**Pixi lifecycle:** `new Application()` → `await app.init({ width, height, backgroundAlpha: 0, antialias: false, autoDensity: false, preference: 'webgl', autoStart: false })` → `app.stage.addChild(scene)` → 数据变化时重建 `scene` 子节点 → `app.render()`；卸载时 `app.destroy(...)`。旧编辑器的 `MapPixiRenderer` 已经是这个 API 形态（`app.init({...})` + `app.render()`）。`[VERIFIED: packages/apps/editor/src/MapEditor/rendering/MapPixiRenderer.tsx:892-913,978-987]`

**No module caches:** 旧渲染器的 `frameTextureCache` / `pixiApplicationPool` 是模块级 `new Map()` / 数组。`coreModuleState` 的选择器明确拦 `Program > VariableDeclaration[kind="const"] > VariableDeclarator > NewExpression[callee.name=/^(Map|Set|WeakMap|WeakSet)$/], ArrayExpression, ObjectExpression`；新实现不得照搬。`[VERIFIED: scripts/verify/coreModuleState.js:55-59; packages/apps/editor/src/MapEditor/rendering/MapPixiRenderer.tsx:44,90-91]`

**Big-map:** 进入时按 `min(canvasW / width, canvasH / height)` 算格边长并居中；格边长 < 16px 时通行度用红点而不是四箭头（UI-SPEC）。性能上建议：普通模式只构建可见格；大地图模式限制一次构建的精灵数（例如超过 N 格时只画当前层 + 标记，或先渲染到 `RenderTexture` 再缩放）。具体阈值列入 Open Question 12，`[ASSUMED]`。

### Pattern 6: 图块图片走资源层，不碰真实文件系统

**What:** 图块目录只给 `imagePath`（相对项目根的资源路径）。面板通过 `IEditorPanelContext.requestResource(path)` 拿到 `IResource`，再 `requestBinary()` 拿 `Uint8Array`；用 `Blob` + `URL.createObjectURL` 生成一个 `blob:` 地址，调色板用 CSS `background-image` 显示裁切，Pixi 用 `new Image()` + `Texture.from(image)` 建纹理。

**Evidence:**
- `IResource.requestBinary(): Promise<Uint8Array | undefined>` 已存在。`[VERIFIED: packages/libs/editor-core/src/resource/types.ts:19-40]`
- 素材面板已用同样的路径：`this.context.requestResource(path)` → `resource.requestBinary()`；失败返回 `undefined`。`[VERIFIED: packages/libs/editor-impl/src/asset/assetPanel.ts:301-311]`
- 素材的 blob URL hook 展示「按 key / mime / 版本重新拉取、卸载时 revoke」的完整生命周期。`[VERIFIED: packages/libs/editor-impl/src/asset/components/useAssetObjectUrl.ts:1-60]` 地图能力不能 import asset，建议在 `map/components` 自持一个同形小 hook（或经用户同意后把 hook 抽到 `shared/`）。
- 旧编辑器用 `new Image()` + `URL.createObjectURL(new Blob([...]))` + `Texture.from(image)`；`Image` / `URL` / `Blob` 都不在 `coreModuleState` 的禁用全局里（禁的是 `document` / `fetch` / `navigator` / `localStorage` / `XMLHttpRequest`）。`[VERIFIED: packages/apps/editor/src/MapEditor/rendering/MapPixiRenderer.tsx:53-68; scripts/verify/coreModuleState.js:52]`

**Path safety:** 面板只接受相对路径；在读取前拒绝以 `/` 开头或含 `..` 段的路径（防御性；注入的 fs 实现也会拒绝越界，但面板不应把宿主给的可疑路径直接递给资源层）。`[VERIFIED: packages/apps/editor-dev/src/backend/memoryBackend.ts:253-257]`（内存后端对 `..` 段的拒绝）

**Missing image:** 某个分组图片读不到时，该组图块仍按编号可选、可绘制，调色板显示占位 + 「该图块的图片不可用」，画布用占位格；不要把整张地图打成“加载失败”。

### Pattern 7: 最近使用图块 = 项目内约定文件（经资源层）

**What:** 每次落笔成功后，把该笔的**主图块**（多格笔刷左上角）移到列表首位；同一编号只留一条；上限 24；写入项目内约定文件。读取时过滤不存在的编号；文件缺失 / 损坏按空列表处理，不阻断绘制。

**Proposed path/format（提案，Open Question 6）:**
- 路径：`.editor/map-recent-tiles.json`（编辑器自有；不是地图文件，也不是 `.jsonc` 系统前缀文件）。
- 格式：`{ "tiles": [12, 34, 56] }`。
- 上限：24（UI-SPEC 建议值）。
- 读取：`context.requestResource(path).request()` → `parseTableText`（兼容有人手工加注释）→ 取 `tiles`；非数组 / 非整数 / 不在目录里的项丢弃。
- 写入：不存在就 `context.createResource(path, text)`，存在就 `resource.write(text)`；文本用 `serializeTableText({ tiles }, '')`（无系统前缀）。
- 失败：静默降级（最近使用不是关键路径），不上报成地图保存失败。

**Evidence:** `parseTableText` / `serializeTableText` 已抽到 `shared/jsonc`，且「无前缀时只写格式化 JSON 正文」。`[VERIFIED: packages/libs/editor-impl/src/shared/jsonc/tableText.ts:83-114]`

**Why not localStorage:** D-11 明确禁止；而且 service worker 宿主 / 多标签页下 localStorage 不是项目作用域。

### Pattern 8: 表单模式复用 `TableGrid`

**What:** 地图属性抽屉直接渲染 `shared/schemaForm` 的 `TableGrid`，但隐藏 `TableToolbar`（编辑模式 / 编辑 Schema / 在代码编辑器中打开 / 保存 / 关闭栏），只留字段行与值控件；保存统一走工具栏「保存地图」。

**Current gap:** `TableGrid` 的渲染函数**无条件**构造并传入 `TableToolbar`；`ITableGridProps` 没有隐藏工具栏 / 表单模式的开关。`[VERIFIED: packages/libs/editor-impl/src/shared/schemaForm/components/TableGrid.tsx:50-95,557-578]` `TableToolbar` 的 props 也没有“只读 / 精简”模式。`[VERIFIED: packages/libs/editor-impl/src/shared/schemaForm/components/TableToolbar.tsx:6-31]`

```ts
// packages/libs/editor-impl/src/shared/schemaForm/components/TableGrid.tsx:50-83（逐字）
export interface ITableGridProps {
  /** 当前数据加载状态 */
  readonly status: TablePanelStatus;
  /** 要渲染的行树 */
  readonly rows: readonly ITableRowNode[];
  /** 错误态下「重试」控件的回调 */
  readonly onRetry?: () => void;
  /** 一次字段提交的回调 */
  readonly onChange?: TableGridChangeHandler;
  /** 一次新增子项的回调 */
  readonly onAdd?: TableGridAddHandler;
  /** 一次删除子项的回调 */
  readonly onDelete?: TableGridDeleteHandler;
  /** 一次打开外部编辑器的回调 */
  readonly onOpenExternalEditor?: TableGridOpenHandler;
  /** 面板级成功提示，缺省时不显示 */
  readonly message?: string;
  /** 面板级错误提示，缺省时不显示 */
  readonly error?: string;
  /** 当前目标是否为 schema（启用 schema 专用呈现模式与提示条） */
  readonly schemaMode?: boolean;
  /** 可选的面板标题（资源名等） */
  readonly title?: string;
  /** 「编辑 Schema」回调，由能力接缝的表格面板打开器驱动 */
  readonly onOpenSchema?: TableGridOpenSchemaHandler;
  /** 「在代码编辑器中打开」回调，由能力接缝的代码编辑器打开器驱动 */
  readonly onOpenInCodeEditor?: TableGridOpenCodeHandler;
  /** 「关闭本栏表格」回调；缺省时工具栏不显示 ✕ */
  readonly onCloseColumn?: () => void;
  /** 本栏是否有未落盘的改动；透传给工具栏显示「未保存」标记并启用「保存」 */
  readonly unsaved?: boolean;
  /** 保存本栏未落盘改动的回调 */
  readonly onSave?: () => void;
}
```

> 注意：`onSave` / `unsaved` 是表格工具栏的保存入口；地图属性抽屉**不传 `onSave`**，避免出现第二个保存按钮。`formMode` 是新增的可选成员，现有调用点不受影响。

**Recommendation:** 给 `ITableGridProps` 增加一个**可选**布尔（提案 `formMode?: boolean`，默认 false）；`formMode` 为真时不渲染 `toolbar` 与 `SchemaBanner`，其余行渲染 / 校验 / 字段路径完全不变。这样：
- 不复制任何表单控件；
- 现有表格调用点零改动（可选成员）；
- 抽屉内不会出现第二个「保存」；
- `TableGrid` 的 `status` 可直接映射 `Loading` / `EmptySchema` / `Error` / `Ready`，`NoTarget` 不使用。

**Why not a separate `SchemaForm` component:** 会复制 `renderRows` / `renderHeader` / 输入控件 / 校验，违背 D-15 与 UI-SPEC F11；加一个开关是最小改动。

**Drawer layout:** `.etable` 是 `position: absolute; inset: 0`，所以抽屉正文必须是 `position: relative` 且有确定高度，`TableGrid` 才能填满。`[VERIFIED: packages/libs/editor-impl/src/shared/schemaForm/schemaForm.css:1-13]`

**Field scope / external editors:** UI-SPEC 只保证基础字段（string / number / integer / boolean / enum / array）的行内编辑；代码 / 事件 / 素材类字段依赖后续能力，宿主应避免注入。若 Schema 里仍带 `x-editor`，抽屉应把该字段按“缺少外部编辑器”处理（只读 / 不出现无效的「编辑」按钮），或在把 Schema 交给 `buildTableTree` 前剥离 `x-editor`。不要因为地图抽屉而给 `editor-impl/react` 增加新的外部编辑器能力。`[VERIFIED: .planning/phases/04-map/04-UI-SPEC.md:516]`

### Anti-Patterns to Avoid

- **在 `map` 里 import `table` / `asset` / `code`：** `.dependencyCruiser.cjs` 的 `capabilities-must-not-import-each-other` 会直接拦。共用件只能放 `shared/`。`[VERIFIED: .dependencyCruiser.cjs:53-62]`
- **把引擎格式 / 文件路径塞进面板：** D-01 / D-03 的主契约；`floor` / `loc` / `idnum` 等词还会被 `coreEngineNeutral` 拦。
- **模块级 Pixi 缓存 / 池：** `coreModuleState` 会拦；用组件 ref / 渲染器实例字段。
- **用 `document.createElement('canvas')`：** `document` 在 `editor-impl/src` 是 error 级禁用全局；用 JSX `<canvas>`（若需要 2D 覆盖层）或 Pixi 的 canvas。
- **每格一条撤销 / 每笔复制整张地图：** 违背 D-17，且大地图上不可接受。
- **把调色板图片 URL / 字节塞进面板 Store：** 视图内的 blob URL 生命周期属于视图；Store 只放业务状态，避免整面板因图片加载重渲染。
- **在 `map` 里用 `window.localStorage` / `fetch`：** 禁用全局；最近使用走资源层。
- **把 `TableGrid` 的完整工具栏塞进抽屉：** 会出现「保存 / 编辑 Schema / 在代码编辑器中打开」等与地图属性无关的动作；UI-SPEC 明确禁止。
- **用 `getTitle()` 动态显示地图名却不通知外壳：** 外壳只在自身快照变化时重算标签名；面板切图后标签名可能保持旧值（Open Question 8）。

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 读 / 写项目文件 | 面板直接 `fs` / `fetch` / `File` | `IEditorPanelContext.requestResource` / `createResource` + `IResource.requestBinary` | D-01 / D-03；core 是注入 fs 的唯一调用方；`coreModuleState` 禁 `fetch` / `document`。`[VERIFIED: packages/libs/editor-core/src/panel/types.ts:5-47; packages/libs/editor-core/src/resource/types.ts:19-40]` |
| 撤销 / 重做 / 屏障 | 面板自建历史栈 | `IEditorSystem`（`context.addUndoContext` + `undo/redo` + `barrier`） | 外壳已统一绑定快捷键；屏障语义已实现并测试。`[VERIFIED: packages/libs/editor-core/src/undo/types.ts:36-68; packages/libs/editor-core/src/undo/undoSystem.ts:28-67]` |
| 面板视图状态订阅 | 自建事件总线 / 隐式全局 | `@tanstack/store` 的 `Store<T>` + `useStore` | 资产面板同款；状态整体替换，订阅简单。`[VERIFIED: packages/libs/editor-impl/src/asset/assetPanel.ts:2-4,220-300]` |
| JSON Schema 表单 / 校验 / 字段路径 | 手写地图属性表单 | `shared/schemaForm` 的 `buildTableTree` / `setByFieldPath` / `validateValue` / `TableGrid`（加表单模式开关） | D-15；控件 / 校验 / 呈现规则已存在；不要复制。`[VERIFIED: packages/libs/editor-impl/src/shared/schemaForm/model/traversal.ts:189; .../fieldPath.ts:130; .../TableGrid.tsx:50-95]` |
| `.jsonc` 解析 / 写回 | 自己 `JSON.parse` + 手拼前缀 | `parseTableText` / `serializeTableText` | 系统前缀逐字还原、宽松回退、无前缀时纯 JSON；最近使用文件直接复用。`[VERIFIED: packages/libs/editor-impl/src/shared/jsonc/tableText.ts:83-114]` |
| 二进制 → 图片 | 自己解码 PNG / 手搓 canvas | `new Image()` + `Texture.from`（Pixi）/ `<img>` / CSS `background-image` | 旧编辑器已验证；浏览器负责解码；避免 `document`。`[VERIFIED: packages/apps/editor/src/MapEditor/rendering/MapPixiRenderer.tsx:53-68]` |
| 地图像素渲染 | 手写 canvas 2D 渲染器 | PixiJS `Application` / `Container` / `Sprite` / `Graphics` / `Texture` | UI-SPEC 锁定；已是 peerDependency；自动处理 WebGL 与裁剪。 |
| antd 弹窗 / 抽屉 / 分段 / 下拉 | 自写组件 | `antd` 6.2.1 的 `Modal` / `Drawer` / `Segmented` / `Dropdown` / `Select` / `Switch` / `Input` / `InputNumber` / `Spin` / `Alert` / `Empty` / `Tooltip` / `Space` / `message` | UI-SPEC 组件清单；无图标库，图形用内联 SVG。`[VERIFIED: .planning/phases/04-map/04-UI-SPEC.md:44-71]` |
| 面板类型注册 | 能力包自装配进 core | `createMapPanelType(capabilities)` 由顶层 `registerPanelType` | Phase 1.1 D-05；素材同款。`[VERIFIED: packages/libs/editor-impl/src/asset/assetPanelType.ts:54-76]` |
| 模块级常量容器 | `const X = []` / `const Y = {}` / `new Map()` | `Object.freeze({...})` / `as const` / 实例字段 | `coreModuleState` 拦模块级数组 / 对象 / Map；门禁 fixture 证明 `Object.freeze` 与 `as const` 是结构性豁免。`[VERIFIED: scripts/verify/coreModuleState.js:55-59,70-112]` |
| 「无法撤销」提示 | 地图面板自己弹 | 组合根 `core.undoSystem.addHook({ onUndoBlocked })` | 资产演示已在开发宿主这样接；core 没有 UI，面板不该重复接管全局撤销。`[VERIFIED: packages/apps/editor-dev/src/demo/assetDemo.ts:636-645]` |

**Key insight:** 本阶段真正“新”的只有**中立地图文档的形状**、**多格笔刷 / 图案平铺**、**Pixi 场景**与**关闭前拦截**；其余都是把表格 / 素材阶段已经验证过的接缝、撤销、手动保存、资源层与表单引擎重新接到地图上。

## Common Pitfalls

### Pitfall 1: 引擎词泄漏进 `editor-impl/src`（连注释也算）

**What goes wrong:** 变量名 `floorId` / `loc` / `idnum`、注释里的「楼层」「autotile」、CSS 类名里的 `floor` 都会让 `coreEngineNeutral` 变红。
**Why it happens:** 旧地图代码大量使用这些词；照抄命名最省事。
**How to avoid:** 中立词表：`map` / `layer` / `cell` / `position` / `tileNumber` / `tileGroup` / `tileCatalog` / `passability` / `direction`。注释也只用中立词。`Math.floor` 是成员访问豁免，但不要故意依赖它。`[VERIFIED: scripts/verify/coreEngineNeutral.js:20-24,47-58]`
**Warning signs:** `node scripts/verify/coreEngineNeutral.js` 报出任何 `editor-impl/src/map/**` 路径。

### Pitfall 2: 模块级可变状态 / 模块级常量容器

**What goes wrong:** 纹理缓存 `const frameTextureCache = new Map()`、Pixi 应用池 `const pool = []`、`const EMPTY_LAYER = []` 都会让 `coreModuleState` 的 module-state 选择器报警。
**Why it happens:** 旧渲染器就是模块级缓存；为了复用纹理很容易照搬。
**How to avoid:** 缓存放在 `MapSurface` 组件的 `useRef` 或渲染器实例字段；常量用 `Object.freeze(...)` / `as const`。`[VERIFIED: scripts/verify/coreModuleState.js:55-59]`
**Warning signs:** `node scripts/verify/coreModuleState.js` 的真实树断言非零；或 lint 里出现 `no-restricted-syntax`。

### Pitfall 3: 在 `editor-impl/src` 里用 `document` / `fetch` / `navigator` / `localStorage` / `XMLHttpRequest`

**What goes wrong:** 用 `document.createElement('canvas')` 做叠加层、用 `fetch` 读图、用 `localStorage` 存最近使用，全部是 error 级。
**Why it happens:** 浏览器里这些 API 很自然；旧编辑器大量使用。
**How to avoid:** 渲染用 Pixi / JSX `<canvas>`；读图用资源层；最近使用写项目文件；需要窗口信息用 `window`（允许）。`[VERIFIED: scripts/verify/coreModuleState.js:52; eslint.config.js:101-150]`
**Warning signs:** `coreModuleState` 的真实树断言报出 `map/**`。

### Pitfall 4: 在 jsdom 里挂载 Pixi

**What goes wrong:** 测试挂载 `MapSurface` 后 Pixi `app.init` 无法拿到 WebGL，测试超时 / 抛错；即使不抛，纹理 `Image` 也不会真的加载。
**Why it happens:** `editor-impl` 的 vitest 是 jsdom；旧编辑器的渲染测试只测纯函数，从不挂载 `MapPixiRenderer`。`[VERIFIED: packages/libs/editor-impl/vitest.config.ts:14-21; packages/apps/editor/src/MapEditor/rendering/__tests__/defaultGround.test.ts:1-31]`
**How to avoid:** 把渲染拆成纯 `renderModel` + 薄 `MapSurface`；单元测试只测 `renderModel`；视图测试用 `vi.mock('./MapSurface')` 或注入一个 stub；端到端留给开发宿主手动验收。
**Warning signs:** 测试里出现 WebGL / canvas 相关错误，或单个用例超时。

### Pitfall 5: `map` 直接 import `table` / `asset`（哪怕只是测试替身）

**What goes wrong:** `.dependencyCruiser.cjs` 的 `capabilities-must-not-import-each-other` 直接把地图能力判红。
**Why it happens:** 想复用 `FakeFileSystem`、`TableGrid`、`useAssetObjectUrl`。
**How to avoid:** `FakeFileSystem` 在 `map/__tests__/fixtures.ts` 自持一份（表格 / 素材已经各自持有一份，是既定做法）；表单走 `shared/schemaForm`；blob URL hook 在 `map/components` 自持一个同形小 hook（或经确认后抽到 `shared/`）。`[VERIFIED: .dependencyCruiser.cjs:53-62]`
**Warning signs:** `node scripts/verify/coreBoundaries.js` 报 `capabilities-must-not-import-each-other`。

### Pitfall 6: 每次落笔复制整张地图 / 每格一条撤销

**What goes wrong:** 大地图上每移动一次鼠标就复制几 MB，GC 抖动；撤销栈爆炸。
**Why it happens:** 为了让“预览 = 真实文档”而 `cloneDeep` 整份文档；或为了简单每格 `addUndoContext`。
**How to avoid:** 预览是**覆盖层**（目标格半透明 + 描边），不克隆文档；一笔算净变化 diff，只复制被触及的行；提交时只登记一条撤销。`[VERIFIED: .planning/phases/04-map/04-UI-SPEC.md:461-472]`
**Warning signs:** 拖动时掉帧；`addUndoContext` 调用次数与格子数成正比。

### Pitfall 7: 把 hover / 拖动预览放进面板 Store

**What goes wrong:** 每个 `pointermove` 都 `store.setState`，整个面板（工具栏 / 调色板 / 抽屉）重渲染。
**Why it happens:** 状态图省事全放一个 Store。
**How to avoid:** Store 只放业务状态（文档、图层、选区、剪贴板、脏标记、保存状态、对话框）；hover / 拖动预览 / 右键菜单位置放画布组件本地 state 或一个轻量独立 Store；需要状态条坐标时用 rAF 节流或独立的 pointer store。
**Warning signs:** React DevTools 里每次移动都重渲染整棵面板树。

### Pitfall 8: 保存期间继续编辑，成功后误清脏标记

**What goes wrong:** 点保存 → 取 `this.document` → 等宿主 → 把 `unsaved=false`；期间用户又画了一笔，结果这一笔被当成已保存。
**Why it happens:** 保存成功后直接清布尔标记。
**How to avoid:** 保存前取**快照**；成功后只把发送的快照设为基线；当前状态与基线不同则继续保持脏。见 Pattern 3。
**Warning signs:** 保存后画一笔再切图，未保存对话框不出现。

### Pitfall 9: 撤销 / 重做后脏标记不重算

**What goes wrong:** 画一笔（脏）→ 保存（干净）→ 再画一笔（脏）→ 撤销（应回到干净）→ 标记仍是脏；或反过来。
**Why it happens:** 用布尔 `dirty` 而不是基线比较。
**How to avoid:** `MapPanel.undo` / `MapPanel.redo` 应用后重新比较当前文档 / 属性与基线；UI-SPEC 明确要求。`[VERIFIED: .planning/phases/04-map/04-UI-SPEC.md:574]`
**Warning signs:** 撤销回已保存状态后「未保存」还在。

### Pitfall 10: 撤销跨地图 / 跨放弃边界套用

**What goes wrong:** 在 A 图登记了 diff，切到 B 图后按撤销，`MapPanel.undo` 收到 A 的 `mapId`，如果直接按 `layerId` 套到 B 图会改错图；如果在「放弃改动」后撤销，会把刚放弃的改动贴回来。
**Why it happens:** 撤销栈是全局的，面板实例切图后仍持有旧条目。
**How to avoid:** 在宿主新建 / 新增图层 / 切图 / 放弃改动成功时登记 `barrier: true`；`undo` / `redo` 先校验 `context.data.mapId === currentMapId`，不匹配直接返回。见 Pattern 4。
**Warning signs:** 切图后一次撤销让新图出现旧图的格子。

### Pitfall 11: 从非活动标签点 ✕ 时，未保存对话框根本不可见

**What goes wrong:** 面板组件只为**活动标签**渲染（`PanelHost` 只渲染 `activePanel`）；后台标签的 `onBeforeClose` 即使把对话框状态设上，也没有 DOM 能显示，Promise 永远不 resolve，关闭挂起。
**Why it happens:** 关闭钩子天然假设面板是可见的。
**How to avoid:** `ShellSystem.closeTab` 在调用 `onBeforeClose` 前**先激活目标标签**（或仅当实例实现了该钩子时激活），等用户处理完再关闭。见 Open Question 1。
**Warning signs:** 后台地图标签点 ✕ 没反应。

### Pitfall 12: 图块目录状态与「图片字节状态」混为一谈

**What goes wrong:** UI-SPEC 要求调色板有「图块目录加载 / 失败 / 空」，但 D-02 规定图块目录在中立文档里；如果为了实现独立状态而新增 `loadTileCatalog()` 通道，就违背 D-02。
**Why it happens:** 把「图块目录」和「图块图片」当成一件事。
**How to avoid:** 目录元数据随文档到达；调色板的加载 / 失败状态按**每个分组的图片字节**状态呈现；单张图缺失只影响该图块的占位，不阻断按编号绘制。见 Open Question 2。
**Warning signs:** 面板出现第二个数据通道；或图片失败时整张地图不可画。

### Pitfall 13: 图片加载失败把整张地图判成加载失败

**What goes wrong:** 一个纹理路径不存在，`openMap` 已经成功，但面板显示「地图加载失败」，用户看不到地图。
**Why it happens:** 把纹理加载和文档加载放进同一个 `try/catch` / 同一个状态。
**How to avoid:** 文档加载与图片加载分开；图片失败只标该分组 / 该图块，画布用占位格；地图仍可查看 / 框选 / 复制。UI-SPEC 明确「图片缺失但编号有效仍算可用」。`[VERIFIED: .planning/phases/04-map/04-UI-SPEC.md:421,463]`
**Warning signs:** 删掉一张纹理后整张地图打不开。

### Pitfall 14: 调色板多格选择跨组 / 图案空洞

**What goes wrong:** 从一个分组拖到另一个分组，选择框跨组，图案映射到不存在的图集坐标；或组内缺格导致图案里出现“空洞”。
**Why it happens:** 用屏幕坐标算格子，没有夹取到组边界；或宿主导出的组不是完整矩形。
**How to avoid:** 选择框夹取到当前组；图案按 `column/row` 查目录；宿主应保证分组是完整矩形。若组内缺格，提案把该图案格视为 `0`（空），并在 `INTERFACE-NAME` / Open Question 9 确认。
**Warning signs:** 粘贴后出现大量空格；选择框跨了两个组标题。

### Pitfall 15: `pointerCapture` / `ResizeObserver` / `URL.createObjectURL` 在 jsdom 缺失

**What goes wrong:** 手势测试在 `setPointerCapture` 处抛错；`ResizeObserver` 没回调导致宽度 0；`URL.createObjectURL` 未实现导致调色板崩。
**Why it happens:** jsdom 不实现这些浏览器 API。
**How to avoid:** `setPointerCapture` 用可选调用（`element.setPointerCapture?.(id)`，属于允许的副作用调用）；`ResizeObserver` 已有空桩 `[VERIFIED: packages/libs/editor-impl/src/__tests__/mapPolyfill.ts:35-60]`；测试里给 `URL.createObjectURL` / `revokeObjectURL` 打桩（资产测试同款）。`[VERIFIED: packages/apps/editor-dev/src/__tests__/devHostAsset.test.tsx:24-27]`
**Warning signs:** 测试只在某个浏览器 API 处红。

### Pitfall 16: 大地图模式一次画全图导致卡死

**What goes wrong:** 256×256 地图在 416px 画布里每格都建 `Sprite`，一帧几万个对象。
**Why it happens:** 照搬普通模式的“每格一个 Sprite”。
**How to avoid:** 普通模式只画可见格；大地图模式先算格边长，按 UI-SPEC 在 <16px 时用红点；必要时把整图渲染到 `RenderTexture` 再缩放，或只画当前层。阈值 `[ASSUMED]`，见 Open Question 12。
**Warning signs:** 切大地图后明显卡顿 / 内存飙升。

### Pitfall 17: 未保存对话框与「新增图层」互相踩踏

**What goes wrong:** 有未保存改动时点「新增图层」，宿主按磁盘状态加层并返回整份文档，内存里的未保存改动被返回的文档覆盖。
**Why it happens:** UI-SPEC 的未保存触发列表只列了切换地图、新建地图、关闭标签，没有列新增图层。
**How to avoid:** 把「新增图层」也纳入未保存拦截（保存并继续 / 放弃 / 取消），或在宿主加层前先把当前文档交给宿主。推荐前者，并列入 Open Question 3 让用户确认。见 Pattern 3。
**Warning signs:** 画了几笔 → 新增图层 → 之前的笔画消失。

### Pitfall 18: 把当前 `map` 的 `implExports` 当成本阶段门禁

**What goes wrong:** `node scripts/verify/implExports.js` 在 HEAD 上已经是红的：它读的 `subpathStatus.json` 在 `02-package-boundary-build-scaffolding` 路径下（已归档），且 `./code` / `./map` / `./shell` 的 exports 目标在磁盘上还不存在。`[VERIFIED: node scripts/verify/implExports.js; scripts/verify/implExports.js:44-45,73-80,162-174]`
**Why it happens:** 02 阶段的决策已把 `implExports` 记为“失效门禁、不作阶段门禁”。
**How to avoid:** 本阶段生效门禁用 `coreEngineNeutral` / `coreModuleState` / `coreImportType` / `coreBoundaries`；`implExports` 的既有红不要算到地图头上（新建 `src/map/index.ts` 会顺手修掉其中一条，但不要为了让整脚本变绿而改门禁期望）。`[VERIFIED: .planning/STATE.md:160]`
**Warning signs:** 阶段收尾时把 `implExports` 的历史红当成本阶段引入。

### Pitfall 19: `TableGrid` 的绝对定位在抽屉里塌陷

**What goes wrong:** 抽屉正文没有 `position: relative` / 高度，`.etable { position: absolute; inset: 0 }` 撑不开，表单显示空白或压住标题。
**Why it happens:** `.etable` 假设父容器是定位上下文。
**How to avoid:** 抽屉正文 `position: relative`、`height: 100%`、`min-height: 0`，并让 `TableGrid` 以 `inset: 0` 填充；UI-SPEC 已写明挂载形态。`[VERIFIED: packages/libs/editor-impl/src/shared/schemaForm/schemaForm.css:1-13; .planning/phases/04-map/04-UI-SPEC.md:517]`
**Warning signs:** 抽屉里只看到边框，没有字段行。

### Pitfall 20: 用 `getTitle()` 显示地图名，但标签名不刷新

**What goes wrong:** 面板内切换地图后，`getTitle()` 返回新名字，但外壳的 `TabRow` 只在自身快照变化时重算；切图不会通知外壳。
**Why it happens:** `ShellSystem` 不订阅面板 Store。
**How to avoid:** 要么让 `getTitle()` 返回稳定的「地图编辑器」（不实现动态标题），要么在 `INTERFACE-NAME` 阶段增加一个外壳通知 API（本阶段不建议扩大 core 接口）。见 Open Question 8。
**Warning signs:** 切图后标签仍显示旧地图名，直到切标签 / 开关面板。

---

## Code Examples

> 下列代码是**形状示意**，不是可直接落盘的实现；所有标识均为提案，待 `INTERFACE-NAME.md` 确认。只有标注 `// Source:` 的片段来自本会话读取的真实源码。

### 1. 中立文档的最小校验与不可变格子写入（提案）

```ts
// 提案；名称待 INTERFACE-NAME 确认
export function isMapDocumentValid(document: IMapDocument): boolean {
  if (document.width <= 0 || document.height <= 0) return false;
  if (document.layers.length === 0) return false;

  return document.layers.every(
    (layer) =>
      layer.cells.length === document.height &&
      layer.cells.every((row) => row.length === document.width && row.every((cell) => Number.isInteger(cell) && cell >= 0)),
  );
}

/**
 * 把一组格子变化应用到文档，返回新文档；不修改入参。
 * 只复制被触及的行与层数组，避免整图复制。
 */
export function applyCellChanges(document: IMapDocument, layerId: string, changes: readonly IMapCellChange[]): IMapDocument {
  const layerIndex = document.layers.findIndex((layer) => layer.id === layerId);
  if (layerIndex === -1) return document;

  const touchedRows = new Map<number, Map<number, number>>();
  for (const change of changes) {
    const row = touchedRows.get(change.y) ?? new Map<number, number>();
    row.set(change.x, change.after);
    touchedRows.set(change.y, row);
  }

  const previousLayer = document.layers[layerIndex];
  const cells = previousLayer.cells.map((row, y) => {
    const updates = touchedRows.get(y);
    if (updates === undefined) return row;

    const nextRow = [...row];
    for (const [x, value] of updates) nextRow[x] = value;
    return nextRow;
  });

  const layers = document.layers.map((layer, index) =>
    index === layerIndex ? { ...previousLayer, cells } : layer,
  );

  return { ...document, layers };
}
```

### 2. 一笔一次撤销（提案，基于已验证的 `IUndoContext`）

```ts
// Source of the context shape:
// packages/libs/editor-core/src/undo/types.ts:3-10
// export interface IUndoContext<T> { readonly type: number; readonly data: T; readonly barrier?: boolean; }

// 提案；名称待 INTERFACE-NAME 确认
public commitCells(layerId: string, changes: readonly IMapCellChange[]): void {
  const net = collectNetChanges(changes); // 去重，后写覆盖先写；before === after 的丢弃
  if (net.length === 0) return;

  this.document = applyCellChanges(this.document, layerId, net);
  this.context.addUndoContext(this, {
    type: MapUndoType.Cells,
    data: { mapId: this.currentMapId, layerId, changes: net },
  });
  this.updateRecentTilesFrom(net, layerId);
  this.refreshUnsaved();
}

public async undo(context: IUndoContext<unknown>): Promise<void> {
  if (context.type !== MapUndoType.Cells) return;
  if (!isMapCellsUndoData(context.data)) return;
  if (context.data.mapId !== this.currentMapId) return;

  const reverse = context.data.changes.map((change) => ({ ...change, after: change.before, before: change.after }));
  this.document = applyCellChanges(this.document, context.data.layerId, reverse);
  this.refreshUnsaved();
}
```

### 3. 最近使用偏好文件的读取 / 写入（提案，复用已验证的 codec）

```ts
// Source: packages/libs/editor-impl/src/shared/jsonc/tableText.ts:83-114
// parseTableText(text) -> { status, prefix, value? }
// serializeTableText(value, prefix) -> prefix + JSON.stringify(value, null, 2)

// 提案；名称待 INTERFACE-NAME 确认
public async loadRecentTiles(): Promise<void> {
  const path = this.recentTilesPath;
  const resource = await this.context.requestResource(path);
  if (resource === null) return;

  try {
    const text = await resource.request();
    if (typeof text !== 'string') return;

    const parsed = parseTableText(text);
    if (parsed.value === undefined) return; // 缺失 / 损坏 → 空列表，不阻断绘制

    this.recentTiles = normalizeRecentTiles(parsed.value, this.tileIndex, MAP_RECENT_TILES_LIMIT);
  } catch {
    // 最近使用不是关键路径：读失败静默降级
    return;
  }
}

public async writeRecentTiles(): Promise<void> {
  const text = serializeTableText({ tiles: this.recentTiles }, '');
  const resource = await this.context.requestResource(this.recentTilesPath);

  try {
    if (resource === null) await this.context.createResource(this.recentTilesPath, text);
    else await resource.write(text);
  } catch {
    // 静默降级：最近使用不是关键路径
    return;
  }
}
```

### 4. 抽屉里复用 `TableGrid`（提案）

```tsx
// Source of the current props:
// packages/libs/editor-impl/src/shared/schemaForm/components/TableGrid.tsx:50-95
// ITableGridProps 目前包含 status / rows / onRetry / onChange / onAdd / onDelete /
// onOpenExternalEditor / message / error / schemaMode / title / onOpenSchema /
// onOpenInCodeEditor / onCloseColumn / unsaved / onSave —— 没有 formMode / showToolbar。

// 提案；名称待 INTERFACE-NAME 确认
<TableGrid
  status={propertiesStatus}
  rows={propertyRows}
  onChange={onPropertyChange}
  onRetry={onRetryProperties}
  formMode
  error={propertyError}
/>
```

`formMode` 的实现建议只在 `TableGrid` 里跳过 `TableToolbar` 与 `SchemaBanner`，不要改 `renderRows` / `renderHeader` / 输入控件的任何行为；这样表格能力零回归。

### 5. 按路径读图块字节 → blob URL（提案，基于已验证的资源 API）

```ts
// Source: packages/libs/editor-core/src/resource/types.ts:19-40
// IResource.requestBinary(): Promise<Uint8Array | undefined>
// Source: packages/libs/editor-impl/src/asset/assetPanel.ts:301-311
// const resource = await this.context.requestResource(path);
// return await resource.requestBinary();

// 提案；名称待 INTERFACE-NAME 确认
public async loadImageBytes(path: string): Promise<Uint8Array | undefined> {
  if (!isSafeResourcePath(path)) return undefined;

  const resource = await this.context.requestResource(path);
  if (resource === null) return undefined;

  try {
    return await resource.requestBinary();
  } catch {
    return undefined;
  }
}

// 视图侧（提案）：一个分组一条 blob URL；卸载 / 换图时 revoke
const url = URL.createObjectURL(new Blob([bytes.slice()], { type: imageMimeType(path) }));
```

### 6. Pixi 表面骨架（提案，基于旧编辑器已验证的 v8 API）

```ts
// Source: packages/apps/editor/src/MapEditor/rendering/MapPixiRenderer.tsx:892-913
// await app.init({ width, height, backgroundAlpha: 0, antialias: false, autoDensity: false,
//                  preference: 'webgl', preserveDrawingBuffer: true, autoStart: false });
// app.canvas.style.imageRendering = 'pixelated';

// 提案；名称待 INTERFACE-NAME 确认
public async mount(host: HTMLDivElement): Promise<void> {
  this.app = new Application();
  await this.app.init({
    width: this.width,
    height: this.height,
    backgroundAlpha: 0,
    antialias: false,
    autoDensity: false,
    preference: 'webgl',
    autoStart: false,
  });
  this.app.canvas.style.imageRendering = 'pixelated';
  host.appendChild(this.app.canvas);
  this.scene = new Container();
  this.app.stage.addChild(this.scene);
  this.draw();
}

public draw(): void {
  if (this.app === undefined || this.scene === undefined) return;

  for (const child of this.scene.removeChildren()) child.destroy({ children: true });
  // 用纯 renderModel 的 cells / passMarks / selection / preview 建 Sprite / Graphics
  this.app.render();
}
```

**不要**把 `Texture` / `Application` 放进模块级缓存；用 `MapSurface` 的 ref 或一个实例化渲染器持有。

### 7. 关闭前拦截（提案，跨包接口改动）

```ts
// 提案；名称待 INTERFACE-NAME 确认
export interface IEditorPanel extends IUndoable {
  /**
   * 用户请求关闭承载此面板的标签时调用；返回 true 允许关闭，false 取消关闭。
   * 只在用户主动关闭标签时调用；dispose / 注销类型 / 替换面板不调用。
   */
  onBeforeClose?(): Promise<boolean>;
}
```

`ShellSystem.closeTab` 的建议时序（提案）：

```text
1. 找到 tab；如果它有实例且实例实现了 onBeforeClose：
   a. 先激活该 tab（保证面板可见，能显示未保存对话框）
   b. await instance.onBeforeClose()
   c. false → 直接返回，不关闭
2. 原有流程：leaveActiveInstance → closePanelInstance → 移除 tab → 切邻
```

`closePanelInstance` / `dispose` / `unregisterPanelType` 内部使用的关闭路径**不得**调用该钩子，否则注销类型 / 释放 core 会被用户对话框卡住。

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 旧编辑器把地图文件解析、渲染、命令、撤销、设置面板全耦合在 `packages/apps/editor/src/MapEditor/**` | `editor-impl/map` 只接收宿主注入的中立文档与图块目录，编辑结果按域交回宿主 | 本里程碑（Phase 1 / 2 / 2.1 / 3 的延续） | 面板不再知道引擎格式；新引擎 / 旧引擎 / 第三方各自写宿主适配器。 |
| 旧渲染器的模块级纹理缓存 / Pixi 应用池 | 组件 ref / 渲染器实例字段 | `coreModuleState` 门禁 | 避免模块级可变状态；多面板实例互不污染。 |
| 旧编辑器用 `localStorage` 存最近使用 / 折叠状态 | 最近使用写项目内约定文件；折叠状态只存面板本地 UI state | D-11 | 跨会话、项目作用域；不依赖浏览器存储。 |
| 旧编辑器用 `@ant-design/icons` / 大量图标 | `editor-impl` 不声明图标库，用内联 SVG | Phase 2 / 3 结论 | 不新增依赖；16px `currentColor`。 |
| 旧表单 / schema 编辑与表格耦合 | `shared/schemaForm`（Phase 3 抽出），地图属性直接复用 | Phase 3 D-28 / 03-06 / 03-07 | 地图不 import 表格；表单行为一致。 |
| Pixi v7 的 `new Application({...})` 同步 options | Pixi v8 的 `await app.init({...})` | Pixi 8（本仓库 8.19.0） | 初始化是异步的；`autoStart: false` + 手动 `app.render()` 适合按需重绘。 `[VERIFIED: packages/apps/editor/src/MapEditor/rendering/MapPixiRenderer.tsx:892-913]` |
| React 18 手动 memo 优化 | React 19 + React Compiler（编辑器 app 已启用） | 现有构建 | 保持渲染纯；Pixi 副作用放 effect / ref。 |

**Deprecated/outdated:**
- 旧 `MapEditorStore` 的 `currentFloorId` / `recentFloors` / `bindSpecialDoor` / 事件绑定状态：本阶段不实现；不要照搬。
- 旧 `mapCommands` 的 `changeFloor` / 楼梯 / 机关门副作用：本阶段不做（引擎专属交互）。
- 旧 `MaterialPanel` 的“按大图 + 折叠画布”布局：本阶段按 D-10 用宿主分组 + 32px 按钮网格；不照抄图片布局算法。
- 旧 `readMapInfo` / `CopiedMapInfo` 带事件：本阶段剪贴板只存数字。

## Assumptions Log

> 这些是本会话**没有**被权威来源证实、但为了给出可执行建议而采用的判断。它们必须由用户在 `INTERFACE-NAME.md` 或计划批准时确认；未确认前不得当成锁定契约。

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 中立文档用 `width` + `height` + `layers[].cells: number[][]`（二维、行主序），而不是扁平 `number[]`。 | Pattern 2 | 宿主适配器要多一次切分 / 拼接；若用户坚持扁平，面板所有访问点都要改。 |
| A2 | 图块目录保留在中立文档内（D-02），调色板的“加载 / 失败”按图片字节状态实现，而不是新增 `loadTileCatalog()` 通道。 | Pattern 2 / Pitfall 12 / OQ 2 | 若用户要求独立目录通道，D-02 需要正式修订；面板数据层与状态机要改。 |
| A3 | 图块通行性用四个方向布尔值（`out` / `in`）+ `onlyEventLayer`，不用引擎的 `outPass` / `inPass` 位掩码。 | Pattern 2 | 若宿主直接注入位掩码，面板会重新耦合引擎语义；门禁虽不拦，但违背 D-08 / D-13 精神。 |
| A4 | 图块图片字节经 `IEditorPanelContext` 按 `imagePath` 读取，宿主不直接注入 URL / 字节。 | Pattern 6 / OQ 10 | 若宿主只能给 URL，面板要改图片加载层，并处理 URL 生命周期。 |
| A5 | 最近使用文件路径 `.editor/map-recent-tiles.json`、格式 `{ "tiles": number[] }`、上限 24。 | Pattern 7 / OQ 6 | 改路径需要迁移 / 清理项目文件；改上限只影响常量。 |
| A6 | 非当前图层以 alpha 0.3 渲染（旧编辑器行为），当前层全不透明。 | Pattern 5 / OQ 5 | 若用户只想看当前层，渲染模型与状态都要改；若全层同 alpha，当前层不突出。 |
| A7 | 绘制预览是“目标格半透明 + 描边”的覆盖层，不在预览里渲染真实图块图案。 | Pitfall 6 / OQ 11 | 与旧编辑器“预览真实图块”的观感不同；若用户要求真实图案预览，渲染模型要加 tile 预览。 |
| A8 | 「新增图层」也触发未保存拦截（保存并继续 / 放弃 / 取消），尽管 UI-SPEC F8 的触发列表没列它。 | Pitfall 17 / OQ 4 | 不拦截会在宿主返回新文档时丢掉内存改动。 |
| A9 | `editor-core` 增加可选 `IEditorPanel.onBeforeClose?(): Promise<boolean>`，外壳在用户关闭标签时先激活标签再调用。 | OQ 1 / Pattern 7 | 若用户拒绝改 core，就无法满足 UI-SPEC 的“关闭标签前提示未保存”。 |
| A10 | 宿主给的分组是完整矩形（每个 column/row 都有图块）；组内缺格时图案格按 `0` 处理。 | Pitfall 14 / OQ 9 | 缺格可能被粘贴成空格；若宿主无法保证完整矩形，需要定义“跳过缺格”语义。 |
| A11 | 地图清单首次用空态内联列表，打开后用工具栏 `Select`；切换在同一面板内完成。 | Summary / OQ 13 | 若用户想“每张地图一个面板实例”，面板生命周期与未保存拦截会改。 |
| A12 | 地图面板不实现动态 `getTitle()`（或只返回稳定「地图编辑器」），避免外壳标签名不刷新。 | Pitfall 20 / OQ 8 | 若用户要求标签显示地图名，需要新增外壳通知 API 或接受延迟刷新。 |
| A13 | 大地图模式一次构建的精灵数需要阈值（具体值未验证）；超过阈值时用简化渲染。 | Pitfall 16 / OQ 12 | 阈值定错会卡顿或过早降级；需要开发宿主大地图实测。 |
| A14 | 本阶段不调用事件保存接口；`saveMapData` 的宿主实现负责保留事件与其它未展示字段。 | Pattern 3 / OQ 7 | 若宿主实现只写几何、不保留事件，保存会丢事件；必须在宿主适配器测试里断言保留。 |
| A15 | 地图属性走独立的 `readProperties` / `saveMapProperties`（不在中立文档里），以支撑抽屉独立的加载 / 失败状态。 | Pattern 3 / OQ 3 | 若属性放进文档，抽屉的“属性加载中 / 失败”状态会退化成“地图加载中 / 失败”。 |

## Open Questions (RESOLVED)

> **全部已定稿，不再有待定项。** 下面 13 条的最终口径写进 `.planning/phases/04-map/INTERFACE-NAME.md` §开放问题决议（OQ1…OQ12 + 两项规划裁定），实施计划按这些口径执行。每条标题后的 `(RESOLVED: …)` 指明该条落在哪个计划 / 哪条决议；下面的 `Recommendation` 保留作为当时的推理记录，不是待定建议。

### 1. 关闭标签前的未保存拦截需要 `editor-core` 新钩子（必须由用户确认）— RESOLVED: OQ1 / Plan 04-02 的 `checkpoint:decision` + Plan 04-15

- **What we know:** `IEditorPanel` 没有关闭前钩子；`ShellSystem.closeTab` 直接 `leaveActiveInstance` → `closePanelInstance` → `dispose`，无法取消。`[VERIFIED: packages/libs/editor-core/src/panel/types.ts:49-101; packages/libs/editor-core/src/shell/shellSystem.ts:590-623]` UI-SPEC 要求关闭标签时弹「有未保存的改动」。`[VERIFIED: .planning/phases/04-map/04-UI-SPEC.md:559-566]`
- **What's unclear:** 钩子名字 / 返回语义 / 后台标签是否先激活 / 钩子抛错时是否允许关闭 / `unregisterPanelType` 与 `dispose` 是否跳过。
- **Recommendation:** 增加可选 `IEditorPanel.onBeforeClose?(): Promise<boolean>`（`true` = 允许关闭，`false` = 取消）；只在用户主动关闭标签时调用；调用前若目标不是活动标签，先 `activateTab`；`closePanelInstance` / `dispose` / `unregisterPanelType` 走不询问的内部路径；钩子抛错时记录日志并**取消关闭**（数据安全优先），但面板实现内部必须自己 catch，避免真的抛。名字与语义写入 `INTERFACE-NAME.md` 确认。

### 2. 图块目录状态：D-02 与 UI-SPEC 的口径冲突 — RESOLVED: OQ2（目录在文档内；加载 / 失败指图片字节；全部失败仍可落笔）/ Plan 04-11

- **What we know:** D-02 明确「中立文档自足：图层 + 图块目录 + 通行性显示数据」；UI-SPEC 又要求调色板有独立的「图块目录加载 / 失败 / 空」状态。`[VERIFIED: .planning/phases/04-map/04-CONTEXT.md:42; .planning/phases/04-map/04-UI-SPEC.md:586]`
- **What's unclear:** 是“目录元数据随文档到达，加载 / 失败指图片字节”，还是“目录本身走独立通道”。
- **Recommendation:** 保留 D-02（目录在文档内），把调色板状态解释为**图片字节**状态：目录有分组但图片还在读 → 「正在加载图块…」；全部分组图片失败 → 「图块加载失败」+ 重试；目录零分组 → 「暂无可用的图块」。单张图失败只做占位，不阻断按编号绘制（UI-SPEC 也要求缺图仍可选可画）。**注意**：UI-SPEC 的状态表把「图块目录失败」写成“不能落笔”，而同一份规范又说“图片缺失但编号有效仍算可用”；两者只在“全部图片失败”时冲突。推荐“显示错误条 + 仍可落笔（占位）”，因为编号与目录都在；如果用户坚持“全部失败即禁用画笔”，把这条写入 `INTERFACE-NAME.md` 并实现一个明确的禁用条件。无论哪种，都不需要改 D-02。

### 3. 地图属性：独立读取 / 保存，还是放进中立文档？ — RESOLVED: OQ3（独立域）/ Plan 04-09

- **What we know:** D-01 列出的文档内容不含属性；D-04 要求属性作为独立域整表保存；UI-SPEC 又给了抽屉独立的「正在加载地图属性… / 地图属性加载失败」状态。`[VERIFIED: .planning/phases/04-map/04-CONTEXT.md:41,44; .planning/phases/04-map/04-UI-SPEC.md:523-528]`
- **What's unclear:** 属性值从哪里来。
- **Recommendation:** 独立 `IMapEditorCapabilities.readProperties(mapId): Promise<Record<string, unknown>>` + `IMapEditorCapabilities.saveMapProperties(mapId, properties): Promise<void>` + 静态注入 `IMapEditorCapabilities.propertiesSchema`。文档只装几何与图块目录；属性加载 / 失败状态天然成立；属性保存是独立域。确认字段名与“缺省 schema 时按钮禁用”的行为。

### 4. 「新增图层」是否触发未保存拦截？ — RESOLVED: OQ4（触发）/ Plan 04-08

- **What we know:** D-05 规定宿主执行加层并返回更新后的文档；UI-SPEC 的未保存触发列表只列了切换地图、新建地图、关闭标签。`[VERIFIED: .planning/phases/04-map/04-CONTEXT.md:45; .planning/phases/04-map/04-UI-SPEC.md:559-561]`
- **What's unclear:** 有未保存改动时加层，返回的文档会覆盖内存改动；要不要先保存 / 放弃 / 取消。
- **Recommendation:** 把「新增图层」加入触发列表（A8）。这是对 UI-SPEC F8 的**扩展**，需要用户确认；不确认的话，至少要在计划里明确“加层会丢弃未保存改动”的风险。

### 5. 图层合成：所有层都画（非当前层变淡）还是只画当前层？ — RESOLVED: OQ5（全画，非当前层 0.3）/ Plan 04-03

- **What we know:** 旧编辑器渲染所有层，非当前层 alpha 0.3（`layerAlpha`）；UI-SPEC 没有明说层合成规则，只说“图层切换”和“编辑即时反映”。`[VERIFIED: packages/apps/editor/src/MapEditor/rendering/MapPixiRenderer.tsx:435-438]`
- **What's unclear:** 用户期望“查看层”是隔离还是叠加。
- **Recommendation:** 默认沿用旧编辑器：所有层按宿主顺序绘制，非当前层 alpha 0.3；当前层全不透明。把这条写入 `INTERFACE-NAME.md` / 计划，避免实现时各写各的。

### 6. 最近使用偏好文件的路径 / 格式 / 上限 — RESOLVED: OQ6（`.editor/map-recent-tiles.json`、`{ tiles }`、上限 24、宿主可覆盖）/ Plan 04-08

- **What we know:** D-11 要求项目内约定文件、跨会话、不用 localStorage；UI-SPEC 建议上限 24，只存 1×1 图块，单独分区。`[VERIFIED: .planning/phases/04-map/04-CONTEXT.md:54; .planning/phases/04-map/04-UI-SPEC.md:416,432-435]`
- **What's unclear:** 具体路径 / 字段名 / 是否允许宿主覆盖 / 文件不存在时是否创建。
- **Recommendation:** `.editor/map-recent-tiles.json`，`{ "tiles": number[] }`，上限 24，缺失按空列表，首次落笔成功后创建；允许宿主用 `recentTilesPath?` 覆盖。路径 / 字段名写入 `INTERFACE-NAME.md` 确认。注意：写新文件会进入项目目录，用户需要知道这一点。

### 7. 事件域接口：本阶段声明但不调用，还是留给 Phase 6？ — RESOLVED: OQ7（本阶段不声明；宿主保存时保留）/ Plan 04-08 + 04-13

- **What we know:** D-04 说保存接口按地图数据 / 地图属性 / 事件三块拆分；D-22 说本阶段完全不碰事件，宿主保存时保留。`[VERIFIED: .planning/phases/04-map/04-CONTEXT.md:44,74]`
- **What's unclear:** 现在是否要声明一个没有任何调用点的 `saveEvents`。
- **Recommendation:** 本阶段**不声明**未使用的事件接口；`saveMapData` 的宿主实现负责保留事件。等 Phase 6 有了事件模型再声明 `saveEvents`。这是对 D-04 的“按域拆分”的阶段性解释，需要用户确认；如果用户要求现在就有三块接口，再加一个本阶段不调用的可选成员，但不要把 `unknown` 形状当成已定契约。

### 8. 标签标题是否显示地图名？ — RESOLVED: OQ8（不实现动态标题）/ Plan 04-04

- **What we know:** `IEditorPanel.getTitle?()` 已存在；外壳只在自身快照变化时解析标签名，不订阅面板 Store。`[VERIFIED: packages/libs/editor-core/src/panel/types.ts:53-57; packages/libs/editor-core/src/shell/shellSystem.ts:135-155]`
- **What's unclear:** 用户是否在意切图后标签名立即更新。
- **Recommendation:** 本阶段**不实现动态标题**，面板类型名用「地图编辑器」；如果用户要求标签显示地图名，再增加一个外壳通知 API（例如面板主动 `notifyTitleChanged`），但这会扩大 core 接口，不建议在本阶段做。

### 9. 组内缺格时多格图案怎么处理？ — RESOLVED: OQ9（图案缺格按 0）/ Plan 04-05

- **What we know:** 宿主按 `column` / `row` 给图块；多格选择是矩形。`[VERIFIED: .planning/phases/04-map/04-UI-SPEC.md:425-429]`
- **What's unclear:** 宿主是否保证分组是完整矩形；缺格是跳过还是写 0。
- **Recommendation:** 在能力契约里要求“分组是完整矩形”；若仍缺格，图案格按 `0`（空）处理，并在实现里用占位而不是崩溃。写入 Assumptions / INTERFACE-NAME。

### 10. 图块图片：路径 + 资源层，还是宿主注入 URL / 字节？ — RESOLVED: OQ10（路径 + 资源层，生成 blob URL）/ Plan 04-04 + 04-11

- **What we know:** CONTEXT 把这件事列为 Discretion；`IResource.requestBinary` 与素材面板的 `loadBytes` 已经证明路径方案可行。`[VERIFIED: .planning/phases/04-map/04-CONTEXT.md:87; packages/libs/editor-core/src/resource/types.ts:29-33]`
- **What's unclear:** 宿主的图片是否都在项目资源路径下（新引擎 `content/texture/...` 是；旧编辑器 `project/materials/...` 也是）。
- **Recommendation:** 路径 + 资源层（A4）。宿主只需要给相对项目根的 `imagePath`；面板负责读取 / blob URL / 纹理。若未来有宿主只能给 URL，再加一个可选 `resolveImageUrl?` 能力，不要本阶段就引入。

### 11. 绘制预览：覆盖层还是真实图块？ — RESOLVED: OQ11（覆盖层）/ Plan 04-12

- **What we know:** UI-SPEC 描述的是“目标格 35% 透明填充 + 1px 描边”；旧编辑器用 `createPaintPreviewFloor` 把真实图块画进预览。`[VERIFIED: .planning/phases/04-map/04-UI-SPEC.md:458; packages/apps/editor/src/MapEditor/utils/paintPreview.ts:56-79]`
- **What's unclear:** 用户是否要求“所见即所得”的图案预览。
- **Recommendation:** 按 UI-SPEC 的覆盖层实现（更便宜、不会因为预览克隆整图）；如果用户要求真实图案，再把 renderModel 加一层 `previewCells`，但仍不要修改文档。

### 12. 大地图性能阈值 — RESOLVED: OQ12（可见格 / 大地图整图 + 图元上限 12000 / 格边长 < 16px 转红点）/ Plan 04-03 + 04-12

- **What we know:** 普通模式旧编辑器只画可见格；大地图模式旧编辑器也逐格建 Sprite。`[VERIFIED: packages/apps/editor/src/MapEditor/rendering/MapPixiRenderer.tsx:398-433]`
- **What's unclear:** 宿主最大地图尺寸、可接受帧率、是否需要 `RenderTexture`。
- **Recommendation:** 先用“普通模式可见格 + 大地图模式全图但限制精灵数”的简单方案；在开发宿主放一张大于视口的地图（如 40×26）实测；若卡顿再引入 `RenderTexture` / 只画当前层。阈值作为实现常量，不写进对外契约。

### 13. 地图清单呈现与切换方式 — RESOLVED: 规划裁定第一条（空态内联清单 + 工具栏 Select，同面板切换）/ Plan 04-10

- **What we know:** UI-SPEC F1 默认“空态内联清单 + 工具栏 Select”；CONTEXT 把呈现形式列为 Discretion。`[VERIFIED: .planning/phases/04-map/04-UI-SPEC.md:795]`
- **What's unclear:** 用户是否想要“每张地图一个标签页”。
- **Recommendation:** 按 UI-SPEC 默认：首次空态内联清单；打开后工具栏 `Select`；同一面板内切换。这样“一个面板实例 = 当前一张地图”的状态最简单，也避免每张地图一个实例的未保存拦截复杂度。

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | 测试 / 构建 / 门禁 | ✓ | v24.21.0（本会话 `node -v`） | — |
| pnpm | workspace / 测试 | ✓ | 12.5.1（本会话 `pnpm -v`） | — |
| `pixi.js` | 画布渲染 | ✓ | 8.19.0（`editor-impl/node_modules` 解析） | 若 WebGL 初始化失败：画布区显示「地图加载失败」+ 重试，面板其余部分仍可用。 |
| `antd` | 工具栏 / 弹窗 / 抽屉 / 表单宿主 | ✓ | 6.2.1（`editor-impl/node_modules` 解析） | — |
| WebGL（浏览器） | Pixi 实际渲染 | 需手动验收 | — | 同上；开发宿主不能假设无 WebGL 也可用。 |
| Git submodule `packages/external/mota-js` | 旧编辑器构建 | 不需要（本阶段不构建旧编辑器） | — | — |
| Playwright | E2E | 不需要（`editor-dev` 无 Playwright 配置） | — | 开发宿主 jsdom 集成测试 + 浏览器手动验收。 |

**Missing dependencies with no fallback:** 无。
**Missing dependencies with fallback:** WebGL（手动验收环境）；若目标浏览器不支持 WebGL，地图像素渲染不可用，但面板应优雅显示错误。

> `editor-impl` 的 `pixi.js` / `antd` 都是从该包自己的 `node_modules` 解析到的（本会话确认）；`implExports` 的单副本断言在本阶段不是生效门禁（见 Pitfall 18）。

## Validation Architecture

> `workflow.nyquist_validation` 在 `.planning/config.json` 里为 `true`，本节必须保留。

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4（`editor-impl` dev `catalog:default`；`editor-core` / `editor-dev` 同款）+ jsdom 26.1.0 |
| Config file | `packages/libs/editor-impl/vitest.config.ts`（`environment: 'jsdom'`、`setupFiles: ['src/__tests__/mapPolyfill.ts']`、`css: true`）；`packages/apps/editor-dev/vitest.config.ts` |
| Quick run command | `pnpm --filter @motajs/editor-impl exec vitest run src/map/__tests__/<file>` |
| Full suite command | `pnpm --filter @motajs/editor-impl test` + `pnpm --filter @motajs/editor-core test` + `pnpm --filter @motajs/editor-dev test` |
| Typecheck | `pnpm --filter @motajs/editor-impl typecheck` + `pnpm --filter @motajs/editor-core typecheck` + `pnpm --filter @motajs/editor-dev typecheck` |
| Gates | `node scripts/verify/coreEngineNeutral.js`、`node scripts/verify/coreModuleState.js`、`node scripts/verify/coreImportType.js`、`node scripts/verify/coreBoundaries.js` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MAP-01-1 | 宿主注入地图清单 + 打开 → 面板显示图层 / 图块目录 / 只读通行度 | unit + integration | `pnpm --filter @motajs/editor-impl exec vitest run src/map/__tests__/mapPanel.test.tsx` | ❌ Wave 0 |
| MAP-01-2 | 线 / 矩形 / 填充 / 擦除 / 切层 / 多格笔刷 → 文档即时变化，越界裁剪，图案平铺正确 | unit | `... vitest run src/map/__tests__/model.brush.test.ts` | ❌ Wave 0 |
| MAP-01-3 | 通行度只读：方向叠加计算正确、开关不置脏、不产生撤销、无编辑入口 | unit | `... vitest run src/map/__tests__/model.passability.test.ts` | ❌ Wave 0 |
| MAP-01-4 | 一笔一次撤销 / 重做；屏障（新建 / 加层 / 切图 / 放弃）挡住撤销；返回 `false` | unit + integration | `... vitest run src/map/__tests__/mapPanel.test.tsx` + `pnpm --filter @motajs/editor-core test` | ❌ Wave 0 |
| MAP-01-5 | 新建地图 / 新增图层：宿主回调、校验、失败保留弹窗、成功后新层成为当前层 | integration | `... vitest run src/map/__tests__/mapDialogs.test.tsx` | ❌ Wave 0 |
| MAP-01-6 | 地图属性抽屉：Schema → 行树、字段提交一条撤销、整表保存、无 schema 禁用 | integration | `... vitest run src/map/__tests__/mapProperties.test.tsx` | ❌ Wave 0 |
| MAP-01-7 | 区域复制粘贴：只当前层、左上角锚点、越界裁剪、裁剪计数、一条撤销 | unit + integration | `... vitest run src/map/__tests__/model.clipboard.test.ts` | ❌ Wave 0 |
| MAP-01-8 | 手动保存：分域脏标记、保存快照、失败保留脏、切换 / 新建 / 关闭拦截、放弃回基线 | integration | `... vitest run src/map/__tests__/mapSave.test.tsx` | ❌ Wave 0 |
| MAP-01-9 | 开发宿主端到端：注册 → 打开 → 画 / 擦 / 切层 → 加层 → 属性 → 保存 → 关闭重开仍在 | integration（jsdom，mock Pixi） | `pnpm --filter @motajs/editor-dev test` | ❌ Wave 0 |
| MAP-01-10 | 关闭标签前拦截（core 新钩子）：允许 / 取消 / 非活动标签激活 / dispose 不询问 | unit | `pnpm --filter @motajs/editor-core exec vitest run src/shell/__tests__/shellClose.test.ts` | ❌ Wave 0 |
| MAP-01-11 | 手动验收：开发宿主浏览器里完成 UI-SPEC §开发宿主接入 的清单 | manual | `pnpm --filter @motajs/editor-dev dev`（127.0.0.1:1056） | — |

### Sampling Rate

- **Per task commit:** 受影响的单个 Vitest 文件 + 该包 `typecheck`。
- **Per wave merge:** `editor-impl` 全量测试 + `editor-core` 全量测试（若改 core）+ `editor-dev` 全量测试 + 四条生效门禁。
- **Phase gate:** 三个包全绿 + 四条生效门禁全绿 + 开发宿主手动验收清单完成，才可 `/gsd-verify-work`。

### Wave 0 Gaps

- [ ] `packages/libs/editor-impl/src/map/__tests__/fixtures.ts` — `FakeFileSystem` 同形替身（不能 import table/asset 的）+ `createMapHarness` + 中立文档 / 图块目录 / 属性 Schema 夹具。
- [ ] `packages/libs/editor-impl/src/map/__tests__/pixiMock.ts`（或 `vi.mock('./MapSurface')`）— 避免 jsdom 真正初始化 Pixi。
- [ ] `URL.createObjectURL` / `revokeObjectURL` 测试桩（地图测试自己的 setup 或每个文件顶部）。
- [ ] `PointerEvent` / `setPointerCapture` 守卫（生产代码用可选调用；测试可跳过）。
- [ ] `ResizeObserver` 空桩已存在（`src/__tests__/mapPolyfill.ts`），但地图若依赖它拿宽度，测试要给它一个可控宽度或默认宽布局。
- [ ] `editor-core` 的关闭前钩子测试文件（若 OQ 1 通过）。
- [ ] `editor-dev` 的地图演示数据 / 适配器 / 集成测试。
- [ ] 无新框架安装；现有 Vitest + RTL + jsdom 足够。

### Manual Acceptance（开发宿主）

按 UI-SPEC §开发宿主接入 的清单执行：

1. 打开地图（小图，能看全边界）。
2. 线 / 矩形 / 填充绘制；擦除；切换图层；新增图层。
3. 多格框选笔刷 → 画布上出现同尺寸矩形预览 → 落笔图案正确。
4. 右键框选 → 复制 → 粘贴（含越界裁剪）→ 清空选区。
5. 显示通行度 → 只读箭头 / 大地图红点 → 不产生撤销、不置脏。
6. 地图属性 → 改一个字符串 / 数字 → 撤销 / 重做 → 保存。
7. 保存 → 关闭面板 → 重开 → 改动仍在；事件 / 额外字段仍在（宿主适配器测试断言）。
8. 未保存 → 切图 / 新建 / 新增图层 / 关闭标签 → 三个按钮都按预期。
9. 空态：无地图、地图加载失败、图块目录失败、未保存确认。
10. 大地图：整图适配、无标尺、移动无效、绘制 / 框选仍可用。

## Security Domain

> `security_enforcement: true`，`security_asvs_level: 1`。

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | 面板不做认证；宿主负责。 |
| V3 Session Management | no | 无会话状态；最近使用是项目文件，不是会话。 |
| V4 Access Control | yes（边界） | 面板只拿宿主不透明 `mapId`；不拼地图文件路径；图块 `imagePath` 校验为相对路径、拒绝 `..` / 前导 `/`；最近使用路径是固定常量。真实路径安全由宿主 fs 实现负责。 |
| V5 Input Validation | yes | 新建地图名 / 图层名去空白 + 非空 + 不重名；宽高整数 + 宿主上限；文档加载校验宽高 / 图层 / 格子；属性表单复用 `validateValue`；图块目录条目编号 / 裁切 / 方向做防御性过滤；宿主错误按文本显示。 |
| V6 Cryptography | no | 不引入加密；不要手写任何加密 / 哈希。 |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via 地图名 / 图层名 / 图块名 / 宿主错误字符串 | Tampering / Information Disclosure | 全部经 React 文本节点渲染；**禁止** `dangerouslySetInnerHTML`；错误字符串按纯文本。 |
| 路径穿越 via 宿主给的图块 `imagePath` | Tampering | 面板拒绝绝对路径与含 `..` 段的路径；注入的 fs 也拒绝越界路径。`[VERIFIED: packages/apps/editor-dev/src/backend/memoryBackend.ts:253-257]` |
| 原型污染 via 属性字段路径 | Tampering | 复用 `setByFieldPath`；它已把 `__proto__` / `constructor` / `prototype` 列为不安全段。`[VERIFIED: packages/libs/editor-impl/src/shared/schemaForm/model/fieldPath.ts:5]` |
| 超大文档 / 超多图块导致 DoS | Denial of Service | 宿主注入尺寸上限；普通模式只画可见格；大地图模式限制精灵数；图块目录 / 分组数量做防御性上限（具体阈值 OQ 12）。 |
| 保存时丢失未展示数据（事件 / 额外字段） | Tampering / Data Loss | 宿主适配器必须保留；开发宿主集成测试断言事件 / 额外字段在保存后仍在。 |
| 关闭标签丢未保存改动 | Data Loss | `onBeforeClose` + 保存 / 放弃 / 取消；后台标签先激活。 |
| 通过 `localStorage` 泄漏项目数据 | Information Disclosure | 不用 localStorage；最近使用写项目内约定文件。 |
| 图片解码漏洞 | — | 使用浏览器 / Pixi 的解码，不手写 PNG 解析；图片路径受限于项目资源。 |

## Naming Proposals (pending `INTERFACE-NAME.md`)

> **全部是提案。** 项目规则要求先写入 `.planning/phases/04-map/INTERFACE-NAME.md`（每 Plan 一节、每个名字说明用途）并经用户确认，才可落进代码、计划或配置。下面分组只是方便审阅，不代表已锁定。

### A. `editor-core` 跨包改动

| 提案名 | 种类 | 用途 |
|--------|------|------|
| `IEditorPanel.onBeforeClose` | 可选方法（`Promise<boolean>`） | 用户关闭标签前询问面板是否允许关闭；`true` 允许、`false` 取消。 |
| `ShellSystem.closeTab`（行为扩展） | 方法实现 | 关闭前激活目标标签并调用钩子；内部关闭路径不询问。 |

### B. `@motajs/editor-impl/map` 入口与文件

| 提案名 | 种类 | 用途 |
|--------|------|------|
| `src/map/index.ts` | 桶文件 | `./map` 子路径入口；导出类型 + 面板 + 组件 + 工厂。 |
| `src/map/types.ts` | 文件 | 地图域类型集中地。 |
| `src/map/constants.ts` | 文件 | 默认尺寸 / 格子 / 最近使用 / 路径 / 文案。 |
| `src/map/mapPanel.ts` | 文件 | `MapPanel` 类。 |
| `src/map/mapPanelType.ts` | 文件 | `createMapPanelType`。 |
| `src/map/map.css` | 文件 | 单一样式表，类前缀 `emap-`。 |
| `src/map/model/**` | 目录 | 纯逻辑（document / geometry / brush / fill / clipboard / passability / renderModel / recentTiles / dirty / validation）。 |
| `src/map/components/**` | 目录 | 视图组件。 |
| `src/map/__tests__/fixtures.ts` | 文件 | 测试替身 + harness。 |

### C. 面板类型 / 工厂 / 面板接口

| 提案名 | 种类 | 用途 |
|--------|------|------|
| `MAP_PANEL_TYPE_ID = 'map'` | 常量 | 面板类型 id。 |
| `createMapPanelType(capabilities)` | 函数 | 把能力闭包进面板类型；顶层注册。 |
| `IMapPanel` | 接口 | 面板对外动作：`setMap` / `save`。 |
| `MapPanel` | 类 | `implements IEditorPanel, IMapPanel`。 |
| `IMapPanelTarget` | 接口 | `{ mapId: string }`。 |
| `IMapPanelParam` | 接口 | `{ target?: IMapPanelTarget }`。 |
| `MapPanel.setMap` | 方法 | 设置当前地图（打开参数 / 外部定位）。 |
| `MapPanel.save` | 方法 | 手动保存有改动的域。 |

### D. 能力注入

| 提案名 | 种类 | 用途 |
|--------|------|------|
| `IMapEditorCapabilities` | 接口 | 宿主注入面（清单 / 打开 / 保存 / 新建 / 加层 / 属性 / 上限 / 最近路径）。 |
| `IMapEditorCapabilities.listMaps` | 方法 | 列地图清单。 |
| `IMapEditorCapabilities.openMap` | 方法 | 打开地图 → 中立文档。 |
| `IMapEditorCapabilities.saveMapData` | 方法 | 保存地图数据域。 |
| `IMapEditorCapabilities.createMap` | 可选方法 | 宿主新建地图。 |
| `IMapEditorCapabilities.addLayer` | 可选方法 | 宿主新增图层。 |
| `IMapEditorCapabilities.readProperties` | 可选方法 | 读整份属性表。 |
| `IMapEditorCapabilities.saveMapProperties` | 可选方法 | 保存整份属性表。 |
| `IMapEditorCapabilities.propertiesSchema` | 可选字段 | 属性表单 JSON Schema。 |
| `IMapEditorCapabilities.maxMapSize` | 可选字段 | 地图尺寸上限。 |
| `IMapEditorCapabilities.recentTilesPath` | 可选字段 | 最近使用文件路径覆盖。 |
| `IMapSummary` / `IMapCreateRequest` / `IMapDataSection` / `IMapSizeLimit` | 接口 | 清单项 / 新建请求 / 保存载荷 / 上限。 |

### E. 中立文档 / 图块目录

| 提案名 | 种类 | 用途 |
|--------|------|------|
| `IMapDocument` | 接口 | 中立地图文档。 |
| `IMapLayer` | 接口 | 命名图层 + 二维数字格子 + `isEventLayer`。 |
| `IMapTileGroup` | 接口 | 图块分组（图片路径 / 列数 / 图块）。 |
| `IMapTileEntry` | 接口 | 图块编号 / 图集坐标 / 裁切 / 名称 / 通行。 |
| `IMapTileCrop` | 接口 | 源图像素裁切矩形。 |
| `IMapTilePass` | 接口 | `out` / `in` / `onlyEventLayer`。 |
| `IMapDirections` | 接口 | 四方向布尔值。 |

### F. 面板内部状态 / 动作

| 提案名 | 种类 | 用途 |
|--------|------|------|
| `IMapPanelViewState` | 接口 | 面板视图状态（状态 / 清单 / 文档 / 当前层 / 调色板 / 最近 / 画笔 / 开关 / 选区 / 剪贴板 / 脏 / 保存 / 对话框）。 |
| `MapPanelStatus` | `const enum` | 清单 / 地图加载状态。 |
| `MapBrushMode` | `const enum` | 线 / 矩形 / 填充。 |
| `MapUndoType` | `const enum` | Cells / Property / Barrier。 |
| `MapPaletteSelection` | 接口 | 空 / 多格图案 / 最近 1×1。 |
| `IMapClipboard` | 接口 | 当前层矩形数字块。 |
| `IMapRect` / `IMapCellPosition` / `IMapCellChange` | 接口 | 选区矩形 / 格子坐标 / 单格 diff。 |
| `MapPanel.commitCells` | 方法 | 提交一笔净变化 + 一条撤销。 |
| `MapPanel.copyRegion` / `MapPanel.pasteAt` / `MapPanel.clearRegion` | 方法 | 复制 / 粘贴 / 清空。 |
| `MapPanel.commitProperty` | 方法 | 提交一个属性字段。 |
| `MapPanel.openMap` / `MapPanel.createMap` / `MapPanel.addLayer` | 方法 | 切图 / 新建 / 加层。 |
| `MapPanel.save` / `MapPanel.requestDiscard` | 方法 | 保存 / 放弃。 |
| `MapPanel.loadRecentTiles` / `MapPanel.writeRecentTiles` / `MapPanel.clearRecentTiles` | 方法 | 最近使用。 |

### G. 纯模型函数

| 提案名 | 用途 |
|--------|------|
| `isMapDocumentValid` | 文档宽高 / 图层 / 格子校验。 |
| `applyCellChanges` | 不可变应用格子 diff（只复制触及行）。 |
| `walkOrthogonalPath` / `rectanglePositions` | 线 / 矩形几何。 |
| `resolveBrushPositions` | 线 / 矩形 / 多格笔刷目标格。 |
| `fillConnectedPositions` | 四邻域 BFS。 |
| `resolvePatternTile` | 按 anchor + 图案取图块编号。 |
| `copyMapRegion` / `pasteMapRegion` / `clearMapRegion` | 复制 / 粘贴 / 清空（含裁剪）。 |
| `computePassabilityMarks` | 只读四方向阻挡标记。 |
| `buildMapRenderModel` | 纯渲染模型。 |
| `updateRecentTiles` / `normalizeRecentTiles` | 最近使用更新 / 过滤 / 上限。 |
| `isMapDataDirty` / `isMapPropertiesDirty` | 基线比较。 |
| `validateNewMapName` / `validateLayerName` / `validateMapSize` | 新建 / 加层校验。 |

### H. 视图组件 / CSS / 测试标识

| 提案名 | 用途 |
|--------|------|
| `MapPanelView` | 状态 → 组件装配。 |
| `MapToolbar` | 两行工具栏 + 窄面板「视图」下拉。 |
| `MapCanvas` | 手势 / 快捷键 / 标尺 / 状态条 / 菜单协作。 |
| `MapSurface` | Pixi 生命周期 + 场景绘制。 |
| `MapPalette` | 空格 / 最近 / 分组折叠 / 多格选择。 |
| `MapStatusBar` | 坐标 / 选区 / 地图 / 图层 / 模式。 |
| `MapContextMenu` | 右键菜单。 |
| `MapPropertiesDrawer` | 属性抽屉 + shared TableGrid。 |
| `MapEmptyState` | 清单加载 / 失败 / 空 / 未打开。 |
| `MapNewDialog` / `MapLayerDialog` / `MapUnsavedDialog` / `MapRecentClearDialog` | 弹窗。 |
| CSS 前缀 `emap-` | 面板作用域样式。 |
| `data-test-id` 前缀 `map-` | 测试标识（见 UI-SPEC §测试标识）。 |

### I. 开发宿主

| 提案名 | 用途 |
|--------|------|
| `src/demo/mapDemo.ts` | 演示地图 / 图块目录 / 清单 / 属性 Schema / 注册。 |
| `src/backend/mapFiles.ts` | 宿主适配器（新引擎形状 ↔ 中立文档，保留事件 / 额外字段）。 |
| `registerMapDemo(core)` | 注册面板类型 + 尺寸上限 + 属性 Schema。 |

### J. 最近使用文件

| 提案名 | 值 / 用途 |
|--------|-----------|
| `MAP_RECENT_TILES_PATH` | `.editor/map-recent-tiles.json`（提案）。 |
| `MAP_RECENT_TILES_LIMIT` | `24`（提案）。 |
| `MAP_RECENT_TILES_KEY` | `'tiles'`（提案）。 |

### K. 表单模式开关

| 提案名 | 种类 | 用途 |
|--------|------|------|
| `ITableGridProps.formMode` | 可选布尔 | `true` 时隐藏表格工具栏 / Schema 横幅，只留字段行与值控件。备选：`showToolbar?: boolean`、`schemaFormOnly?: boolean`。 |

## Sources

### Primary (HIGH confidence)

- `packages/libs/editor-core/src/panel/types.ts` — `IEditorPanel` / `IEditorPanelContext` / 工厂 / 类型（本会话读取，行 5-130）。
- `packages/libs/editor-core/src/undo/types.ts` / `undoSystem.ts` — 撤销 / 重做 / 屏障 / `onUndoBlocked`（行 3-68 / 28-67）。
- `packages/libs/editor-core/src/resource/types.ts` — `IResource.requestBinary`、路径标识、资源系统（行 4-213）。
- `packages/libs/editor-core/src/shell/shellSystem.ts` — 标签关闭 / 面板生命周期 / 切换通知（行 590-623 / 646-658）。
- `packages/libs/editor-impl/src/asset/assetPanelType.ts` / `assetPanel.ts` / `components/useAssetObjectUrl.ts` — 能力工厂、手动保存、屏障、资源字节、blob URL（行 54-76 / 489-511 / 301-311 / 1-60）。
- `packages/libs/editor-impl/src/table/tablePanel.ts` — 手动保存 / 撤销 / 切栏（行 683-703 / 1628-1654）。
- `packages/libs/editor-impl/src/shared/schemaForm/components/TableGrid.tsx` / `TableToolbar.tsx` — 表单宿主 / 工具栏（行 50-95 / 557-578 / 6-31）。
- `packages/libs/editor-impl/src/shared/schemaForm/model/traversal.ts` / `fieldPath.ts` — `buildTableTree` / `setByFieldPath` / 原型污染防护（行 189 / 130 / 5）。
- `packages/libs/editor-impl/src/shared/jsonc/tableText.ts` — `.jsonc` 解析 / 写回（行 83-114）。
- `packages/libs/editor-impl/src/__tests__/mapPolyfill.ts` — jsdom 的 `Map` / `ResizeObserver` / `innerWidth` 桩（行 1-61）。
- `packages/apps/editor-dev/src/backend/memoryBackend.ts` / `demo/assetDemo.ts` — 内存后端 / 开发宿主能力注册 / 撤销屏障提示（行 75-258 / 636-645）。
- `packages/apps/editor/src/types/game.ts` / `MapEditor/**` — 旧地图数据 / 画笔几何 / BFS / 坐标 / 渲染 / 手势 / 状态（行 28-66；`brushGeometry.ts` 1-26；`fillBfs.ts` 35-80；`coordinate.ts` 10-115；`MapPixiRenderer.tsx` 44-106 / 398-433 / 892-987；`MapCanvas.tsx` 297-624）。
- `scripts/verify/coreEngineNeutral.js` / `coreModuleState.js` / `coreImportType.js` / `coreExports.js` / `implExports.js` — 门禁范围 / 术语表 / 禁用全局 / 模块状态 / `implExports` 现状（行 47-58 / 52-59 / 34 / 38-47 / 44-80）。
- `.dependencyCruiser.cjs` — 能力互斥 / 根 barrel / react & shell 边界（行 36-78）。
- `.planning/config.json` — `security_enforcement: true`、`nyquist_validation: true`。
- `AGENTS.md` — 先接口后实现 / 命名确认 / `类名.方法名` / 代码风格 / 计划执行门禁。
- `E:/github/template/packages-user/data-common/src/store/types.ts` — `PassBit` / `ITilePassData` / `ITileRawData` / `IMapRawData`（行 27-63 / 260-271）。
- `E:/github/template/src/content/maps/empty.jsonc` / `.list.jsonc` / `MT0.jsonc` — 新引擎地图样本（单层、13 宽、169 格、`map: { "0": [...] }`、`layerAlias: {}`、`events: {}`）。
- `E:/github/template/src/content/texture/.list.jsonc` — 纹理清单样本（`type: grid / source / map / width / height`）。
- `E:/github/template/src/content/tile.jsonc` — 图块表样本（`num` / `id` / `pass.outPass` / `pass.inPass`）。

### Secondary (MEDIUM confidence)

- `.planning/phases/04-map/04-CONTEXT.md` — 用户锁定决策 D-01…D-24、Discretion、Deferred。
- `.planning/phases/04-map/04-UI-SPEC.md` — 视觉 / 交互 / 文案 / 状态 / 测试标识 / 开发宿主验收清单。
- `.planning/ROADMAP.md` — Phase 4 目标与验收（第 3 条按 D-23 修订）。
- `.planning/REQUIREMENTS.md` — MAP-01。
- `.planning/STATE.md` — 前序阶段决策（手动保存 / 屏障 / 门禁现状 / `implExports` 失效记录）。
- `.planning/phases/03-asset/03-RESEARCH.md` — 同类阶段的研究口径与 Package Legitimacy 写法。

### Tertiary (LOW confidence)

- 无外部 Web 检索。所有浏览器 / Pixi / antd 行为判断来自仓库内既有代码或 API 类型；性能阈值 / 视觉细节标为 `[ASSUMED]`。

## Metadata

**Confidence breakdown:**
- **Standard stack:** HIGH — 版本从 `package.json` / catalog / 本会话 `node -e` 解析获得；无新依赖。
- **Architecture:** MEDIUM-HIGH — 面板 / 撤销 / 资源 / 表单 / 能力注入范式都有仓库内先例；中立文档形状与能力接口是新设计，需要 `INTERFACE-NAME` 确认。
- **Cross-package close hook:** MEDIUM — `IEditorPanel` / `ShellSystem` 的现状是 HIGH；新增钩子的名字 / 行为是提案，需用户确认。
- **Pitfalls:** HIGH — 来自门禁脚本原文、旧编辑器实现、jsdom 测试配置与真实运行过的 `implExports` 输出；性能阈值 / 视觉细节是 `[ASSUMED]`。
- **Testing:** HIGH — 测试框架 / 配置 / 既有 harness 模式已确认；地图测试本身是 Wave 0 新增。

**Research date:** 2026-10-20
**Valid until:** 30 天（仓库契约稳定）；若 `editor-core` 的面板 / 撤销 / 资源接口或 `shared/schemaForm` 在本阶段前变动，需要重新核对行号与形状。

