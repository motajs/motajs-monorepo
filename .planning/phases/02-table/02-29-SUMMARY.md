---
phase: 02-table
plan: 29
subsystem: ui
tags: [react, table, editor-impl, panel-sync, uat-gap-closure, p18, p20]
gap_closure: true
gap_ids: [G-02-UAT2]

# Dependency graph
requires:
  - phase: 02-table
    provides: "TablePanel 多栏状态 columns[] / refresh / applyData（02-04、02-17）；schemaMode.test.tsx 装配 helper 与 FakeResourceInjection（02-08、02-26）"
provides:
  - "同面板内改 schema 后，其它 schema 编辑栏立即同步（P18）"
  - "同面板内改 schema 后，主（数据）表一并同步（P20）"
  - "代码编辑器整份写回与撤销 / 重做同样触发同面板同步"
  - "同步严格限于本面板 this.columns，无跨面板广播（D-15 修订版 / D-31）"
affects: [02-table, verify-work]

# Actuals (#2632)
actuals:
  tokens: 3354
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "写盘后按被写资源 id 精确匹配引用它的其它栏并重读重算——只刷新同面板依赖栏，不做全量刷新、不做跨面板广播"
    - "即发即忘的 void this.refresh(j) 沿用既有请求序号丢弃过期结果；测试以 setTimeout(0) 冲刷微任务后再断言 DOM"

key-files:
  created:
    - packages/libs/editor-impl/src/table/__tests__/panelSync.uat.test.tsx
  modified:
    - packages/libs/editor-impl/src/table/tablePanel.ts

key-decisions:
  - "新增私有方法 TablePanel.refreshDependents(columnIndex, changedId)：遍历本面板 this.columns，只对 target.data.id 或 target.schema.id 命中 changedId 的其它栏调用 void this.refresh(j)"
  - "写盘入口全部接入：commitValue / deleteItem / addItem（数据视图再对 target.schema 调一次）/ openCurrentViewInCodeEditor / applyUndoRedo（写数据后 + 写 schema 后各一次）"
  - "不实现 IEditorPanelContext.updateResource 接缝；纯 TablePanel 内部行为，公开 API 不变，无新增依赖"

patterns-established:
  - "同面板依赖同步以资源 id 精确匹配；无关栏不被重读（用 readContent spy 断言）"

requirements-completed: [TABLE-01]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "同面板内改 schema 后，其它 schema 栏立即同步（P18）"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "src/table/__tests__/panelSync.uat.test.tsx#改 schema 后同面板的其它 schema 栏与主数据表立即同步"
        status: pass
    human_judgment: false
  - id: D2
    description: "同面板内改 schema 后，主（数据）表一并同步（P20）"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "src/table/__tests__/panelSync.uat.test.tsx#改 schema 后同面板的其它 schema 栏与主数据表立即同步"
        status: pass
    human_judgment: false
  - id: D3
    description: "只刷新引用被写资源的栏，引用其它表的栏不被重读（无跨面板广播，D-15 修订 / D-31）"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "src/table/__tests__/panelSync.uat.test.tsx#写盘不刷新引用其它表的栏"
        status: pass
    human_judgment: false
  - id: D4
    description: "代码编辑器整份写回 schema 也触发同面板同步"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "src/table/__tests__/panelSync.uat.test.tsx#代码编辑器写回 schema 后同面板其它栏立即同步"
        status: pass
    human_judgment: false
  - id: D5
    description: "撤销 / 重做也触发同面板同步（数据栏新增写 schema x-order 后撤销，schema 栏与数据栏同步回退）"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "src/table/__tests__/panelSync.uat.test.tsx#撤销新增后同面板 schema 栏与数据栏都同步回退"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-10-14
status: complete
---

# Phase 2 Plan 29: 同面板依赖栏即时同步（P18 / P20）Summary

**同一表格面板里写完任何资源后，立刻把「本面板内引用同一资源的其它栏」重读重算——改 schema 后同面板的另一 schema 栏与主数据表立即跟随，不再需要点一下 / 切走再切回；仍不做跨面板广播。**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-10-14T18:32Z
- **Completed:** 2026-10-14T18:46Z
- **Tasks:** 2
- **Files modified/created:** 2

## Accomplishments

- `TablePanel` 新增私有方法 `TablePanel.refreshDependents(columnIndex, changedId)`：遍历本面板 `this.columns`，对每一栏 j（j ≠ columnIndex）当 `target !== null` 且 `target.data.id === changedId.id` 或 `target.schema.id === changedId.id` 时调用 `void this.refresh(j)`。
- 所有写盘入口接入：`TablePanel.commitValue`、`TablePanel.deleteItem`、`TablePanel.addItem`（数据视图在 `persist` 后刷新数据资源、在 `persistSchema` 后再刷新 schema 资源）、`TablePanel.openCurrentViewInCodeEditor`（整份写回）、`TablePanel.applyUndoRedo`（写数据后 + 写 schema 后各一次）。
- 修复机制按资源 id 精确匹配：只刷新「引用了被写资源」的栏，不做无差别全量刷新（与后续 P23 性能优化不冲突）。
- 未改资源层、外壳、公开 API；未新增依赖；未实现 `IEditorPanelContext.updateResource` 接缝（D-31 已取消）。
- 新增 `panelSync.uat.test.tsx` 4 条 UAT 用例：同面板 schema 栏同步、主数据表同步、无关栏不被误刷新、代码编辑器写回同步、撤销同步。既有 140 条 editor-impl 用例全绿。

## Task Commits

Each task was committed atomically:

1. **Task 1: 写盘后刷新同面板依赖栏（P18 / P20，端到端）** - `26175c4` (feat)
2. **Task 2: 代码编辑器写回与撤销 / 重做也走同面板同步（P18 / P20）** - `4fa7f9c` (feat)

**Plan metadata:** 见本 SUMMARY 的最终文档提交

## Files Created/Modified

- `packages/libs/editor-impl/src/table/tablePanel.ts` - 新增 `TablePanel.refreshDependents`；在 5 处写盘路径后调用它。
- `packages/libs/editor-impl/src/table/__tests__/panelSync.uat.test.tsx`（新）- 同面板依赖栏即时同步的 4 条用例。

## Decisions Made

- 同步以「被写资源 id」为唯一判据（数据资源 `table.<名>` 或 schema 资源 `table#schema.<名>`），命中即重读重算；仅限 `this.columns` 内，绝不跨面板（D-15 修订版 / D-31）。
- 私有方法名 `TablePanel.refreshDependents(columnIndex, changedId)` 已按「重要命名先确认」门禁获用户确认（`INTERFACE-NAME.md` Plan 24–31），并按 `类名.方法名` 写法登记。
- 沿用既有 `refresh` 的请求序号（`requestTokens`）丢弃过期结果，避免连续写盘时乱序刷新（T-02-29-01）。

## Deviations from Plan

### Auto-fixed Issues

None.

### Style/test-alignment (not a behavioral deviation)

**1. [Test] 下拉选中值断言改用 antd v6 的 `.ant-select-content-value` 而非 `.ant-select-selection-item`**
- **Found during:** Task 1
- **Issue:** 计划只要求「断言该控件的值显示为 number」；测试首版按 antd 旧版 DOM 取 `.ant-select-selection-item`，在本仓 antd 6.2.1 下选择值实际渲染在 `.ant-select-content-value`，导致查不到而失败。
- **Fix:** 断言助手改查 `.ant-select-content-value` 的文本；行为零差异，仅对齐当前 antd 版本 DOM。
- **Files modified:** `packages/libs/editor-impl/src/table/__tests__/panelSync.uat.test.tsx`
- **Committed in:** `26175c4`

---

**Total deviations:** 0 auto-fixed；1 条纯测试 DOM 选择器对齐。
**Impact on plan:** 无行为差异，未改公开 API、未新增依赖、未改编辑器核心 / 资源层。

## Issues Encountered

- 写盘后的同面板刷新是「即发即忘」（`void this.refresh(j)`，按计划签名返回 `void`）；测试需在断言前把已排队的资源读取 / 重算微任务全部落定，故用 `await act(async () => { await new Promise(r => setTimeout(r, 0)); })` 冲刷。产品行为不受影响（刷新在一轮微任务内完成，等价「立即」）。
- 数据视图新增只向 schema 写 `x-order`、不新增 `properties` 子节点（既有设计），故「撤销同步」用例以 schema 栏的 `x-order` 行出现 / 消失（而非 `properties.mid`）作为 schema 栏是否同步的观测点。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- P18 / P20 已修复；`TablePanel.refreshDependents` 名称已按门禁确认后落实现。
- 供 `verify-work` 复核 P18 / P20（同面板三栏：数据 + 两个 schema，改任一 schema 栏另两栏立即跟随；换到别的面板不自动刷新，切入时才刷新）。

---
*Phase: 02-table*
*Completed: 2026-10-14*

## Self-Check: PASSED

- FOUND: packages/libs/editor-impl/src/table/tablePanel.ts
- FOUND: packages/libs/editor-impl/src/table/__tests__/panelSync.uat.test.tsx
- FOUND: .planning/phases/02-table/02-29-SUMMARY.md
- FOUND commit: 26175c4
- FOUND commit: 4fa7f9c
