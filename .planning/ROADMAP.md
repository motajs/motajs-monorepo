# Roadmap: motajs-monorepo

## Overview

Milestone v1.0 把编辑器按「`editor-core` 只给接口、`editor-impl` 写默认实现」的简单结构重做一遍。先用一个固定外壳（固定布局 + 命名插槽）把编辑器画面立起来，同时定下 `editor-core` 唯一的通用 fs 接口（只定义、不实现，实现由外部注入）；随后在 `editor-impl` 里按顺序补齐默认实现：表格 → 素材 → 地图 → 代码 → 事件编辑器。每一阶段都以「用户能看见并操作该能力，且画面/行为与现状一致」为验收。整体刻意保持轻量，只按用户指定的顺序切分，不增设额外的架构/流程阶段。

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

> 说明：本里程碑重新从 Phase 1 开始编号；上一里程碑的所有阶段已归档至 `.planning/milestones/archived-20261009-phases/`，不再延续其编号。

- [ ] **Phase 1: 编辑器外壳** - 浏览器式标签外壳（顶部菜单行 + 标签行、动态面板类型/实例、空白新标签页）+ `editor-core` 通用 fs 接口（只定义）
- [ ] **Phase 2: 表格编辑** - 用户可编辑 schema 驱动的表格数据
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

**Plans:** 4/4 plans executed
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

**Plans:** 10 plans
Plans:

**Wave 1 — 接口定义（仅类型，无实现）**

- [ ] 02-01-PLAN.md — `editor-core` 接缝类型（D-15 通知；D-06 默认走注入式打开器、「打开参数」通用化仅为可选；含确认 checkpoint）
- [ ] 02-02-PLAN.md — `editor-impl/table` 类型（数据模型 / 资源标识约定 / `ITablePanel` / schema 呈现规则；无函数体）
- [ ] 02-03-PLAN.md — `editor-impl/react` 接缝类型（外部编辑器 / 通用弹窗 / 打开器 / 求值器契约 `IValueEvaluator`）

**Wave 2 — 接缝实现 + tracer**

- [ ] 02-04-PLAN.md — tracer：工程脚手 + 端到端只读表格面板（注册 → 打开 → 设目标 → 读资源 → 渲染）
- [ ] 02-05-PLAN.md — `editor-core` D-15 广播实现（D-06 打开参数透传为可选 opt-in，默认不执行）

**Wave 3**

- [ ] 02-06-PLAN.md — 校验模型 + 五种行内输入控件

**Wave 4**

- [ ] 02-07-PLAN.md — 编辑模式 / 增删 / 统一撤销（一次编辑 = 一次可逆操作）

**Wave 5**

- [ ] 02-08-PLAN.md — D-15 响应式 + D-06「编辑 Schema」按钮 + schema 专用呈现模式

**Wave 6**

- [ ] 02-09-PLAN.md — 外部编辑器分发 + 通用多选 / 坐标弹窗

**Wave 7**

- [ ] 02-10-PLAN.md — 集成验证 / 门禁 / 验收签核

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
Phases execute in numeric order: 1 → 1.1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. 编辑器外壳与通用 fs 接口 | 4/4 | In Progress|  |
| 1.1. 编辑器开发宿主 (INSERTED) | 3/3 | Complete    | 2026-10-12 |
| 2. 表格编辑 | 0/TBD | Not started | - |
| 3. 素材管理 | 0/TBD | Not started | - |
| 4. 地图编辑 | 0/TBD | Not started | - |
| 5. 代码编辑 | 0/TBD | Not started | - |
| 6. 事件编辑器 | 0/TBD | Not started | - |
