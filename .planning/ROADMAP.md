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

**Plans:** 3/4 plans executed
Plans:
**Wave 1**

- [x] 01-01-PLAN.md — 接口定义（面板类型 / 外壳 / 菜单 / 标签 / 通用 fs，仅类型，无实现）

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — `ShellSystem` 实现 + `EditorCore` 迁移（端到端 tracer；含 D-07 单向契约确认 checkpoint）

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-03-PLAN.md — 外壳纯 CSS 样式 + 两处配套工程改动（`sideEffects` / `global.d.ts`）+ UI-SPEC 状态覆盖

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 01-04-PLAN.md — 通用 fs 面门禁 `coreFsSurface.js`（真实树 + 两极性 + 包根导入探针）

**UI hint**: yes

### Phase 2: 表格编辑

**Goal**: 用户可编辑 schema 驱动的表格数据；默认实现落在 `editor-impl`。
**Depends on**: Phase 1
**Requirements**: TABLE-01
**Success Criteria** (what must be TRUE):

  1. 用户可打开表格视图并查看 schema 驱动的项目数据。
  2. 用户可新增 / 修改 / 删除表格行，改动即时反映。
  3. 表格编辑经统一命令 / 撤销路径，可撤销、可重做。
  4. 表格数据经 Phase 1 的通用 fs 接口读写，行为与现状一致。

**Plans**: TBD
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
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. 编辑器外壳与通用 fs 接口 | 3/4 | In Progress|  |
| 2. 表格编辑 | 0/TBD | Not started | - |
| 3. 素材管理 | 0/TBD | Not started | - |
| 4. 地图编辑 | 0/TBD | Not started | - |
| 5. 代码编辑 | 0/TBD | Not started | - |
| 6. 事件编辑器 | 0/TBD | Not started | - |
