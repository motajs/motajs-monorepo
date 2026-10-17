# Roadmap: motajs-monorepo

## Overview

Milestone v1.0 把编辑器按「`editor-core` 只给接口、`editor-impl` 写默认实现」的简单结构重做一遍。先用一个固定外壳（固定布局 + 命名插槽）把编辑器画面立起来，同时定下 `editor-core` 唯一的通用 fs 接口（只定义、不实现，实现由外部注入）；随后在 `editor-impl` 里按顺序补齐默认实现：表格 → 素材 → 地图 → 代码 → 事件编辑器。每一阶段都以「用户能看见并操作该能力，且画面/行为与现状一致」为验收。整体刻意保持轻量，只按用户指定的顺序切分，不增设额外的架构/流程阶段。

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

> 说明：本里程碑重新从 Phase 1 开始编号；上一里程碑的所有阶段已归档至 `.planning/milestones/archived-20261009-phases/`，不再延续其编号。

- [x] **Phase 1: 编辑器外壳** - 浏览器式标签外壳（顶部菜单行 + 标签行、动态面板类型/实例、空白新标签页）+ `editor-core` 通用 fs 接口（只定义） (completed 2026-10-12)
- [x] **Phase 2: 表格编辑** - 用户可编辑 schema 驱动的表格数据
- [ ] **Phase 3: 素材管理** - 用户可管理素材（图片 / 动画 / 材质）
- [ ] **Phase 4: 地图编辑** - 用户可编辑地图（层 / 块 / 通行性）
- [ ] **Phase 5: 代码编辑** - 用户可编辑代码（Monaco）
- [ ] **Phase 6: 事件编辑器** - 用户可编辑事件脚本（Blockly）

## Cross-cutting Constraints

- **开发宿主须持续接入**：Phase 1.1 交付的「编辑器开发宿主」（DEVHOST-01）为开发专用、可扩展。此后每个 `editor-impl` 能力阶段（Phase 2–6）完成后，**必须**把该阶段的能力接入该宿主，使其可在浏览器里被打开与手动验收；该接入属各阶段的收尾工作之一，不得遗漏。
- **装配方向**：能力包**只导出面板类型对象**（`IEditorPanelType` 常量）及其底层组件；**由顶层（宿主 / 装配方）** import 并调用 `core.shellSystem.registerPanelType(...)` 完成注册。**能力包不自行装配到 core**（不导出 `install(core)` 之类自装配函数）。

## Phase Details

### Phase 1: 编辑器外壳

**Goal**: 交付类似浏览器的编辑器外壳——顶部两行（菜单行 + 标签行）+ 内容区；支持**动态注册/注销面板类型**、**动态创建/关闭面板实例**（同类型可开多个独立实例）；加载后默认可开空白新标签页。并由 `editor-core` 定义引擎无关的**通用 fs 接口**（只定义、不实现，由外部注入真正的实现）。
**Depends on**: Nothing (first phase)
**Requirements**: SHELL-01, CORE-01
**Success Criteria** (what must be TRUE):

  1. 编辑器加载后可见外壳：顶部菜单行 + 标签行（含 `+` 与一个默认空白新标签页）。
  2. 空白新标签页列出已注册的面板类型（名称 + 图标），点击即在该标签页打开该类型的一个新实例。
  3. 同一类型可开多个独立实例（如两个表格面板）互不冲突；关闭标签会销毁实例并自动切换。
  4. 外部可注册/注销面板类型、注册菜单项；关闭/注销不残留实例。
  5. `editor-core` 导出通用 fs 接口（读 / 写 / 列目录 / 建目录 / 移动 / 删除），仓库中不存在其默认实现，且 core/impl 不引用。

**Plans:** 4/4 plans complete
Plans:
**Wave 1**

- [x] 01-01-PLAN.md — 接口定义（面板类型 / 外壳 / 菜单 / 标签 / 通用 fs，仅类型，无实现）

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — `ShellSystem` 实现 + `EditorCore` 迁移（端到端 tracer；含 D-07 单向契约确认 checkpoint）

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-03-PLAN.md — 外壳纯 CSS 样式 + 两处配套工程改动（`sideEffects` / `global.d.ts`）+ UI-SPEC 状态覆盖

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 01-04-PLAN.md — 通用 fs 面门禁 `coreFsSurface.js`（真实树 + 两极性 + 包根导入探针）

**UI hint**: yes

### Phase 01.1: 编辑器开发宿主 (INSERTED)

**Goal**: 提供一个**最小的、开发专用**的顶层整合（dev host），把 `editor-core` 的外壳（及后续 `editor-impl` 能力）真正跑起来，用于人工 / 目视验收与手动测试；**不随产品发布**。
**Depends on**: Phase 1
**Requirements**: DEVHOST-01
**Success Criteria** (what must be TRUE):

  1. 有一个可本地启动的 dev 入口，浏览器打开即渲染 `editor-core` 外壳（菜单行 + 标签行 + 内容区 + 默认空白标签页）。
  2. 至少注册一个面板类型，可开实例、可操作、可关闭。
  3. 提供一个最小数据后端（内存 fs 或本地 dev fs），使依赖数据的面板能读到内容。
  4. 该宿主为开发专用：不进入产品产物、不引入线上运行时依赖。

**维护约定**: 本宿主是**持续演进**的——此后每个 `editor-impl` 能力阶段（Phase 2–6）完成后，**必须**把该阶段的能力接入本宿主，便于测试与目视验收（见下方 Cross-cutting Constraints）。

**Plans:** 3/3 plans complete
Plans:

**Wave 1 — 接口 / 契约（仅类型，无实现）**

- [x] 01.1-01-PLAN.md — dev 包骨架 + 内存后端接口（D-02）；记录 D-05 接入约定（能力导出面板类型、顶层注册）

**Wave 2 — 端到端实现（tracer 领衔）**

- [x] 01.1-02-PLAN.md — tracer：宿主启动 → 外壳渲染 → 顶层注册演示面板 → 读内存数据 + 冒烟测试

### Phase 2: 表格编辑

**Goal**: 用户可编辑 schema 驱动的表格数据；默认实现落在 `editor-impl`。
**Depends on**: Phase 1
**Requirements**: TABLE-01
**Success Criteria** (what must be TRUE):

  1. 用户可打开表格视图并查看 schema 驱动的项目数据。
  2. 用户可新增 / 修改 / 删除表格行，改动即时反映。
  3. 表格编辑经统一命令 / 撤销路径，可撤销、可重做。
  4. 表格数据经统一层（`editor-core` 资源层）读写，行为与现状一致（与锁定决策 D-03 一致：经资源层而非通用 fs 接口，见 02-02）。

**Plans:** 33/33 plans executed
Plans:

- [x] 02-34-PLAN.md

- [x] 02-32-PLAN.md
- [x] 02-33-PLAN.md

- [x] 02-24-PLAN.md
- [x] 02-25-PLAN.md
- [x] 02-26-PLAN.md
- [x] 02-27-PLAN.md
- [x] 02-28-PLAN.md
- [x] 02-29-PLAN.md
- [x] 02-30-PLAN.md
- [x] 02-31-PLAN.md

- [x] 02-20-PLAN.md
- [x] 02-21-PLAN.md
- [x] 02-22-PLAN.md
- [x] 02-23-PLAN.md

- [x] 02-15-PLAN.md
- [x] 02-16-PLAN.md
- [x] 02-17-PLAN.md
- [x] 02-18-PLAN.md
- [x] 02-19-PLAN.md

- [x] 02-14-PLAN.md

- [x] 02-11-PLAN.md
- [x] 02-12-PLAN.md
- [x] 02-13-PLAN.md

**Wave 1 — 接口定义（仅类型，无实现）**

- [x] 02-02-PLAN.md — `editor-impl/table` 类型（标准 JSON Schema 数据模型 / 资源标识约定 / `ITablePanel` / schema 呈现规则；无函数体）
- [x] 02-03-PLAN.md — `editor-impl/react` 接缝类型（外部编辑器 / 通用弹窗 / 打开器 / 剪贴板；无 `IValueEvaluator`）

> 注：原 02-01（`editor-core` 的 `updateResource` 接缝类型）已删除——D-15 改为「切入时刷新」（外壳切换标签时调用 `onSwitchIn` / `onSwitchOut`），见 02-05。

**Wave 2 — 接缝实现 + tracer**

- [x] 02-04-PLAN.md — tracer：工程脚手 + 端到端只读表格面板（注册 → 打开 → 设目标 → 读资源 → 渲染）
- [x] 02-05-PLAN.md — `editor-core`：切换标签时调用 `onSwitchIn` / `onSwitchOut`（D-15 修订版「切入时刷新」）

**Wave 3**

- [x] 02-06-PLAN.md — 校验模型 + 五种行内输入控件

**Wave 4**

- [x] 02-07-PLAN.md — 编辑模式 / 增删 / 统一撤销（一次编辑 = 一次可逆操作）

**Wave 5**

- [x] 02-08-PLAN.md — D-15 响应式 + D-06「编辑 Schema」按钮 + schema 专用呈现模式

**Wave 6**

- [x] 02-09-PLAN.md — 外部编辑器分发 + 通用多选 / 坐标弹窗

**Wave 7**

- [x] 02-10-PLAN.md — 集成验证 / 门禁 / 验收签核

**UI hint**: yes

### Phase 02.1: 资源层重构与表格文件管理 (INSERTED)

**Goal**: 把编辑器资源层重构为「以文件路径为唯一标识、`editor-core` 真正接入注入的文件系统、并维护项目文件索引 + 内容缓存池」的形态，并在此基础上给表格能力补上「打开表格（预设表 + 目录树）/ 新建表格 / 删除表格」三个用户入口；同时收口被推翻的旧契约（`CORE-01`、两条门禁、表格命名、Phase 3 讨论稿前提）。
**Depends on:** Phase 2
**Requirements**: CORE-01 (revised), TABLE-01 (extended)
**Success Criteria** (what must be TRUE):

  1. 资源以纯文件路径为唯一标识；core 初始化只注入文件系统实现并驱动它（读 / 写 / 二进制 / 列目录 / 建目录 / 移动 / 删除）。
  2. 资源系统维护项目文件索引（初始化递归全扫 + 增删移增量 + 外部忽略模式）与带字节上限的 LRU 内容缓存池。
  3. 用户可打开「表格列表」（预设表 + 目录树，只列 json / jsonc 且排除 schema 文件）、新建表格（数据 + schema 一对）、删除表格（二次确认、不可撤销）。
  4. 既有表格编辑行为（编辑 / 撤销 / 多栏 / 切入刷新）不回归；`CORE-01`、`coreFsSurface`、`coreBoundaries`(e) 与 Phase 3 讨论稿前提全部收口。
  5. 本阶段能力接入开发宿主，可在浏览器里手动验收「打开 / 新建 / 删除」。

**Plans:** 25/26 plans executed（另追加 6 个缺口收口计划 02.1-13/14/15/16/17 闭环 UAT 缺口 `G-02.1-1`、02.1-18 闭环 UAT 缺口 `G-02.1-2`；再追加 6 个缺口收口计划 02.1-19/20/21/22/23/24 处理 UAT 缺口 `G-02.1-3`；再追加 1 个缺口收口计划 02.1-25 处理 UAT 缺口 `G-02.1-4`；再追加 1 个缺口收口计划 02.1-26 处理 UAT 缺口 `G-02.1-5`）

Plans:
**Wave 1 — 接口（仅类型，无实现）**

- [x] 02.1-01-PLAN.md — `editor-core` 资源层接口重写（路径标识 / 文件系统 / 索引 / 缓存 / 注入）
- [x] 02.1-02-PLAN.md — `editor-impl` 表格与接缝接口重写（单一数据路径 / 预设表接缝）

**Wave 2 — 核心 tracer（依赖 Wave 1）**

- [x] 02.1-03-PLAN.md — 端到端 tracer：注入文件系统 → 按路径读写（含共享 `FakeFileSystem`）

**Wave 3 — 索引 / 缓存 + 门禁（依赖 Wave 2）**

- [x] 02.1-04-PLAN.md — 文件索引 `FileIndex` + 内容缓存池 `ContentCache` + 资源系统接线
- [x] 02.1-05-PLAN.md — 门禁反转：`coreFsSurface` 与 `coreBoundaries`(e)

**Wave 4 — 表格实质迁移（依赖 Wave 3）**

- [x] 02.1-06-PLAN.md — 表格迁移到路径约定（路径约定函数 / 文本解析 / 目标与读写）

**Wave 5 — 表格测试装配迁移·上半（依赖 Wave 4）**

- [x] 02.1-07-PLAN.md — 建立共享测试替身，迁移 10 个既有表格测试到 fs 注入

**Wave 6 — 表格测试装配迁移·下半（依赖 Wave 5）**

- [x] 02.1-08-PLAN.md — 迁移剩余 11 个既有表格测试，收口 editor-impl 全绿

**Wave 7 — 表格新入口（依赖 Wave 6）**

- [x] 02.1-09-PLAN.md — 表格「打开列表 / 新建 / 删除」界面与能力

**Wave 8 — 开发宿主接入（依赖 Wave 7）**

- [x] 02.1-10-PLAN.md — 开发宿主接入（内存文件系统 + 端到端）

**Wave 9 — 集成验证（依赖 Wave 8；整阶段签核需 dev 宿主已迁移）**

- [x] 02.1-11-PLAN.md — 打开 / 新建 / 删除端到端集成验证 + 阶段门禁签核

**Wave 10 — 收口（依赖 Wave 9）**

- [x] 02.1-12-PLAN.md — 旧契约收口（REQUIREMENTS `CORE-01` / Phase 3 讨论稿含 UI-SPEC）

**Wave 11 — 缺口收口 `G-02.1-1`（UAT 测试 1：空栏内联打开 / 新建 / 删除）**

- [x] 02.1-13-PLAN.md — 空栏内联控件接口（仅类型：`TableEmptyMode` + 空栏视图字段 + 三个组件 props）
- [x] 02.1-14-PLAN.md — 实现两个可复用组件（`TablePicker` 浏览器 + `TableCreateForm` 新建表单）+ 桶登记
- [x] 02.1-15-PLAN.md — 表格面板空栏内联承载（实现 `TableEmptyColumn` + 移除独立列表面板 + 多表标题）
- [x] 02.1-17-PLAN.md — 迁移 editor-impl 表格测试到空栏内联流程（恢复 editor-impl 全绿）
- [x] 02.1-16-PLAN.md — 开发宿主收口（去掉「打开表格」工具栏入口与列表面板注册 + 迁移端到端）

**Wave 12 — 缺口收口 `G-02.1-2`（UAT 测试 2/3：`.jsonc` 前缀往返与删除注释确认）**

- [x] 02.1-18-PLAN.md — 开发宿主 `.jsonc` 样本（合规 + 非合规）+ 预设接入 + `parseTableText` / `serializeTableText` 自动化测试

**Wave 13 — 缺口收口 `G-02.1-3`（UAT 测试 1：表格面板改手动保存 + 交互观感修正）**

- [x] 02.1-19-PLAN.md — 缺口收口接口（仅类型：`ITablePanel.save` + 未保存视图位 + 工具栏保存 / 新建选目录契约）
- [x] 02.1-20-PLAN.md — 表格面板改手动保存 + 注释剥离只提示一次 + 打开列表实时同步（实现 + 专项测试）
- [x] 02.1-21-PLAN.md — 迁移既有表格测试到手动保存（恢复 editor-impl 全绿）
- [x] 02.1-22-PLAN.md — 空栏三按钮竖排加大 + 新建可选目标目录（实现 + 测试迁移）
- [x] 02.1-23-PLAN.md — 工具栏低频动作收进下拉 + 外壳标签名限宽 200px（实现 + 测试迁移）
- [x] 02.1-24-PLAN.md — 开发宿主 e2e 迁移 + 三包全绿 + 五门禁签核 + UAT 收口登记

**Wave 14 — 缺口收口 `G-02.1-4`（UAT 测试 2：开发宿主补代码编辑器打开器）**

- [x] 02.1-25-PLAN.md — 开发宿主代码编辑器打开器（`DevCodeEditorProvider` 注入 `codeEditor`）+ 端到端 + 三包 / 五门禁签核 + UAT 收口

**Wave 15 — 缺口收口 `G-02.1-5`（UAT 测试 1：新建表格确认入口上移）**

- [ ] 02.1-26-PLAN.md — `TableCreateForm` 确认入口移到新建视图顶部（实现 + 组件级 / 面板内可失败断言）+ 三包 / 五门禁签核 + UAT 收口

**UI hint**: yes

### Phase 3: 素材管理

**Goal**: 用户可管理素材（图片 / 动画 / 材质）。
**Depends on**: Phase 1
**Requirements**: ASSET-01
**Success Criteria** (what must be TRUE):

  1. 用户可浏览项目素材（图片 / 动画 / 材质）。
  2. 用户可新增 / 替换 / 删除素材并即时生效。
  3. 素材改动写入后重新加载仍然存在（经统一持久化路径）。
  4. 素材相关画面与行为与现状一致。

**Plans**: TBD
**UI hint**: yes

### Phase 4: 地图编辑

**Goal**: 用户可编辑地图（层 / 块 / 通行性）。
**Depends on**: Phase 1
**Requirements**: MAP-01
**Success Criteria** (what must be TRUE):

  1. 用户可打开地图并查看层 / 块 / 通行性。
  2. 用户可绘制 / 擦除块并切换层，编辑即时反映。
  3. 用户可编辑通行性并看到生效结果。
  4. 地图编辑经统一命令 / 撤销路径，可撤销、可重做。

**Plans**: TBD
**UI hint**: yes

### Phase 5: 代码编辑

**Goal**: 用户可编辑代码（Monaco）。
**Depends on**: Phase 1
**Requirements**: CODE-01
**Success Criteria** (what must be TRUE):

  1. 用户可打开 Monaco 代码编辑器并编辑项目代码。
  2. 保存后代码生效，且行为与现状一致。
  3. 用户可在该能力内打开 / 切换对应代码文件。

**Plans**: TBD
**UI hint**: yes

### Phase 6: 事件编辑器

**Goal**: 用户可编辑事件脚本（Blockly）。
**Depends on**: Phase 1, Phase 5
**Requirements**: EVENT-01
**Success Criteria** (what must be TRUE):

  1. 用户可打开 Blockly 事件编辑器。
  2. 用户可用积木搭建 / 修改事件脚本。
  3. 事件脚本保存后生效，并与代码视图保持一致。

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 1.1 → 2 → 2.1 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. 编辑器外壳与通用 fs 接口 | 4/4 | Complete    | 2026-10-12 |
| 1.1. 编辑器开发宿主 (INSERTED) | 3/3 | Complete    | 2026-10-12 |
| 2. 表格编辑 | 33/33 | Complete | 2026-10-15 |
| 2.1. 资源层重构与表格文件管理 (INSERTED) | 25/26 | In Progress|  |
| 3. 素材管理 | 0/TBD | Not started | - |
| 4. 地图编辑 | 0/TBD | Not started | - |
| 5. 代码编辑 | 0/TBD | Not started | - |
| 6. 事件编辑器 | 0/TBD | Not started | - |
