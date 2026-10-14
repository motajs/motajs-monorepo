---
phase: 02-table
plan: 24
subsystem: ui
tags: [react, typescript, editor-impl, table, interface-only]

# Dependency graph
requires:
  - phase: 02-table
    provides: 既有导出的 `ITableGridProps` / `ITableToolbarProps`（`@motajs/editor-impl/table` 组件对外面）与 `TableGrid` 构造工具栏的现有接线
provides:
  - "`ITableGridProps.onCloseColumn?: () => void`（可选）——底层表格向上层表达「关闭本栏表格」的接缝"
  - "`ITableToolbarProps.onCloseColumn?: () => void`（可选）——工具栏 ✕ 的点击回调"
  - "`ITableToolbarProps.closeButtonEnabled?: boolean`（可选）——工具栏 ✕ 是否可点"
  - "P15（每栏关闭按钮）的组件侧契约类型"
affects: [02-31]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 338
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns: ["接口计划与实现计划分离：先单独落类型声明（可选成员，向后兼容），实现在后续计划接线"]

key-files:
  created: []
  modified:
    - packages/libs/editor-impl/src/table/components/TableGrid.tsx
    - packages/libs/editor-impl/src/table/components/TableToolbar.tsx

key-decisions:
  - "三个成员一律设为可选：接口计划先落地时不会让 02-31 之前的既有构造点缺参而 typecheck 失败，实现计划再补透传"
  - "命名对齐既有成员：`onCloseColumn?(): void` 对齐 `onRetry?(): void`；`closeButtonEnabled?: boolean` 对齐既有 `codeButtonEnabled` / `schemaButtonEnabled`"
  - "仅改 `interface` 声明，零渲染 / 零事件处理 / 零运行时代码改动"

patterns-established:
  - "P15 关闭契约的类型身份：`ITableGridProps.onCloseColumn`（上报意图）↔ `ITableToolbarProps.onCloseColumn`（工具栏接线）；`ITableToolbarProps.closeButtonEnabled` ↔ 该栏是否已打开表"

requirements-completed: [TABLE-01]

# Coverage metadata (#1602) — one entry per shipped deliverable. Drives DETERMINISTIC UAT routing in verify-work.
coverage:
  - id: D1
    description: "`ITableGridProps` 新增可选成员 `onCloseColumn?: () => void`（类型声明，无行为）"
    requirement: TABLE-01
    verification:
      - kind: other
        ref: "pnpm --filter @motajs/editor-impl typecheck"
        status: pass
      - kind: unit
        ref: "pnpm --filter @motajs/editor-impl test"
        status: pass
    human_judgment: false
  - id: D2
    description: "`ITableToolbarProps` 新增可选成员 `onCloseColumn?: () => void` 与 `closeButtonEnabled?: boolean`（类型声明，无行为）"
    requirement: TABLE-01
    verification:
      - kind: other
        ref: "pnpm --filter @motajs/editor-impl typecheck"
        status: pass
      - kind: unit
        ref: "pnpm --filter @motajs/editor-impl test"
        status: pass
    human_judgment: false

# Metrics
duration: 3min
completed: 2026-10-14
status: complete
---

# Phase 2 Plan 24: 每栏关闭按钮（P15）的组件侧契约（仅类型） Summary

**为「每栏表格的关闭按钮」定下类型契约：底层表格与工具栏各加可选回调，工具栏另加「✕ 是否可点」——只加类型，不渲染、不改行为**

## Performance

- **Duration:** 3 min
- **Started:** 2026-10-14T08:19:09Z
- **Completed:** 2026-10-14T08:22:26Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `ITableGridProps` 增可选成员 `onCloseColumn?: () => void`：底层表格把「关闭本栏表格」的意图上报给使用方（P15 需要它才能渲染 ✕ 并接线）。
- `ITableToolbarProps` 增可选成员 `onCloseColumn?: () => void` 与 `closeButtonEnabled?: boolean`：工具栏据此渲染「在代码编辑器中打开」右侧的 ✕，并在该栏未打开任何表时禁用。
- 本计划只增类型声明，未渲染任何新元素、未改任何运行时行为；成员一律可选，既有构造点无需改动，`typecheck` 仍为 0。

## Task Commits

Each task was committed atomically:

1. **Task 1: `ITableGridProps` 增可选 `onCloseColumn`（P15，仅类型）** - `92a4a20` (feat)
2. **Task 2: `ITableToolbarProps` 增可选 `onCloseColumn` / `closeButtonEnabled`（P15，仅类型）** - `5750282` (feat)

**Plan metadata:** `234e7f3` (docs: complete plan)

## Files Created/Modified
- `packages/libs/editor-impl/src/table/components/TableGrid.tsx` - `ITableGridProps` 增可选 `onCloseColumn`（2 行新增）
- `packages/libs/editor-impl/src/table/components/TableToolbar.tsx` - `ITableToolbarProps` 增可选 `onCloseColumn` / `closeButtonEnabled`（4 行新增）

## Decisions Made
- 三个成员一律设为可选：接口计划先落地时不会让 02-31 之前的既有构造点（`TableGrid` 内的 `createElement(TableToolbar, {...})`）缺参而 typecheck 失败；实现计划 02-31 再补透传。
- 命名对齐既有成员：`onCloseColumn?(): void` 对齐 `onRetry?(): void`（同为无参回调）；`closeButtonEnabled?: boolean` 对齐既有 `codeButtonEnabled` / `schemaButtonEnabled`。
- 仅改 `interface` 声明，零渲染 / 零事件处理 / 零运行时代码改动；接口成员沿用项目默认 `readonly`，各带单行 jsDoc。

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. 测试输出中 jsdom 的 `Not implemented: window.getComputedStyle` 与 `NaN is invalid value for height` 均为既有噪声（既有用例长期存在），不影响退出码。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- P15 的组件侧契约（类型）已定义；接口与实现分离——具体渲染与接线见实现计划 02-31（把 `ITableGridProps.onCloseColumn` 透传给 `ITableToolbarProps.onCloseColumn`，并由「该栏是否已打开表」驱动 `closeButtonEnabled`）。
- 无运行时行为改动；既有行为与测试未被破坏；未新增依赖。

---
*Phase: 02-table*
*Completed: 2026-10-14*

## Self-Check: PASSED

- Verified files exist: `TableGrid.tsx`, `TableToolbar.tsx`, `02-24-SUMMARY.md`
- Verified commits exist: `92a4a20`, `5750282`
