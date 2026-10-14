---
phase: 02-table
plan: 31
subsystem: ui
tags: [editor-impl, table, uat-gap-closure, p15, close-column]
gap_closure: true
gap_ids: [G-02-UAT2]

# Dependency graph
requires:
  - phase: 02-table
    provides: "02-24 声明的接口（ITableGridProps.onCloseColumn / ITableToolbarProps.onCloseColumn / closeButtonEnabled）；TablePanel 的多栏状态、columnAt / createColumn / nextToken / publish、findEmptyColumnIndex / openSchemaPanel（P1 空栏复用）"
provides:
  - "每栏工具栏「在代码编辑器中打开」右侧的 ✕ 关闭本栏表格按钮（禁用态随本栏是否有目标）"
  - "TablePanel.closeColumn(columnIndex)：清空某栏目标 / 数据 / schema 并回到未设目标态，只作用于本栏"
  - "关闭出来的空栏可被「编辑 Schema」经 findEmptyColumnIndex 复用（P1 既有行为）"
affects: [02-table, verify-work]

# Actuals (#2632)
actuals:
  tokens: 3511
  tasks: 2
  commits: 2
  plan_head_before: ab5c9f003d6bcaa0fbe2f69e562172a7f416c289

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "可用性由父组件推导：TableGrid 以 props.onCloseColumn !== undefined && props.status !== NoTarget 计算 closeButtonEnabled，再透传给工具栏（无新增 CSS，复用既有 antd Button size=small）"
    - "关栏即清空本栏状态：TablePanel.closeColumn 置 target/data/schema 为 null、递增本栏 nextToken 丢弃在途结果、publish(NoTarget) 复位 store，不触碰其它栏"

key-files:
  created:
    - packages/libs/editor-impl/src/table/__tests__/closeColumn.uat.test.tsx
  modified:
    - packages/libs/editor-impl/src/table/components/TableToolbar.tsx
    - packages/libs/editor-impl/src/table/components/TableGrid.tsx
    - packages/libs/editor-impl/src/table/tablePanel.ts

key-decisions:
  - "✕ 仅当 onCloseColumn 传入了才渲染；禁用态由 closeButtonEnabled 决定（缺省视作不可点），无目标栏（NoTarget）禁用"
  - "可用性来源用既有 props.status（TablePanelStatus.NoTarget 表示未打开表），不引入新状态"
  - "closeColumn 递增本栏 nextToken 以丢弃在途读取结果，避免关闭后旧结果写回本栏（T-02-31-01）"
  - "关闭只清空 columnAt(columnIndex) 一栏，findEmptyColumnIndex 随后即可将其当作空栏供 P1 复用"

patterns-established:
  - "面板级「关闭本栏」语义：只复位单栏视图状态，不删除任何磁盘资源、不动其它栏"

requirements-completed: [TABLE-01]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "✕ 渲染在「在代码编辑器中打开」右侧"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "src/table/__tests__/closeColumn.uat.test.tsx#✕ 位于「在代码编辑器中打开」右侧"
        status: pass
    human_judgment: false
  - id: D2
    description: "有目标栏的 ✕ 可点，点后本栏回到「尚未设置目标表」空态"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "src/table/__tests__/closeColumn.uat.test.tsx#有目标栏的 ✕ 可点，点后本栏回到未设目标态"
        status: pass
    human_judgment: false
  - id: D3
    description: "未打开表的空栏 ✕ 禁用；有目标栏可点"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "src/table/__tests__/closeColumn.uat.test.tsx#空栏的 ✕ 禁用，有目标栏的 ✕ 可点"
        status: pass
    human_judgment: false
  - id: D4
    description: "关闭只影响本栏，其它栏内容不变"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "src/table/__tests__/closeColumn.uat.test.tsx#关闭只影响本栏，其它栏保持不变"
        status: pass
    human_judgment: false
  - id: D5
    description: "关闭出来的空栏被「编辑 Schema」复用而非经打开器新开面板"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "src/table/__tests__/closeColumn.uat.test.tsx#关闭出来的空栏被「编辑 Schema」复用而非新开面板"
        status: pass
    human_judgment: false
  - id: D6
    description: "多栏视觉：每栏工具栏「在代码编辑器中打开」右侧有 ✕；无表栏 ✕ 灰掉（非功能，人工确认）"
    requirement: TABLE-01
    verification:
      - kind: manual
        ref: "多栏时每栏 ✕ 位置 / 灰度；点 ✕ 只关该栏；关闭后又能用「编辑 Schema」占回空栏"
        status: pending
    human_judgment: true

# Metrics
duration: 12min
completed: 2026-10-14
status: complete
---

# Phase 2 Plan 31: 每栏关闭（✕）按钮（P15）Summary

**给每一栏的工具栏在「在代码编辑器中打开」右侧加一个 ✕，用来就地关掉该栏的表格；本栏没打开表时 ✕ 是灰的、点不动；关掉只影响这一栏，空出来的栏还能被「编辑 Schema」重新占回去。**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-10-14T19:10Z
- **Completed:** 2026-10-14T19:22Z
- **Tasks:** 2
- **Files created/modified:** 4

## Accomplishments

- **工具栏 ✕（`TableToolbar`）**：在「在代码编辑器中打开」之后追加一个 antd `Button size="small" autoInsertSpace={false}`，文案 `✕`、`aria-label="关闭本栏表格"`、`data-test-id="table-close-column"`；仅当传入 `onCloseColumn` 时渲染，`disabled={!closeButtonEnabled}`。
- **可用性推导与透传（`TableGrid`）**：把 `props.onCloseColumn` 透传给工具栏，并以 `closeButtonEnabled = props.onCloseColumn !== undefined && props.status !== TablePanelStatus.NoTarget` 计算可点性；就绪态与状态态共用同一工具栏，故各态下 ✕ 均在。
- **关栏语义（`TablePanel.closeColumn`）**：取 `columnAt(columnIndex)`，把 `target` / `data` / `schema` 置空，递增本栏请求序号（丢弃在途结果），再 `publish(columnIndex, NoTarget, [])` 复位为「尚未设置目标表」；只作用于本栏。
- **接线**：`ITablePanelViewProps` / `ITableColumnProps` 各新增 `onCloseColumn: (columnIndex: number) => void`；`TableColumn` 把回调绑定到本栏序号后作为 `TableGrid.onCloseColumn` 传入；构造函数装配视图 props 时传 `onCloseColumn: (columnIndex) => this.closeColumn(columnIndex)`。
- **空栏复用（P15）**：`closeColumn` 后本栏 `target` 归空，`findEmptyColumnIndex` 即可把它当作空栏；`openSchemaPanel` 直接占用该空栏、不调用打开器新开面板（P1 既有行为，无需改动）。
- 未改外壳 / 资源层；未新增依赖；未使用 `import type`；未新增对外导出名（仅登记过的非导出名与测试断点）。

## Task Commits

Each task was committed atomically:

1. **Task 1: 每栏 ✕ 关闭该栏表格，未打开表时不可点（P15，tracer）** - `442577a` (feat)
2. **Task 2: 关闭后空栏可被「编辑 Schema」重新利用（P15）** - `5d4ead0` (test)

**Plan metadata:** 见本 SUMMARY 的最终文档提交

## Files Created/Modified

- `packages/libs/editor-impl/src/table/components/TableToolbar.tsx` - 「在代码编辑器中打开」右侧的 ✕ 按钮（禁用态随 `closeButtonEnabled`）。
- `packages/libs/editor-impl/src/table/components/TableGrid.tsx` - 透传 `onCloseColumn` 并推导 `closeButtonEnabled`。
- `packages/libs/editor-impl/src/table/tablePanel.ts` - `TablePanel.closeColumn` + 视图 / 单栏 props 与装配接线。
- `packages/libs/editor-impl/src/table/__tests__/closeColumn.uat.test.tsx`（新）- 5 条用例：✕ 位置 / 有表可点并回空态 / 无表禁用 / 只关本栏 / 关闭后空栏可复用。

## Decisions Made

- ✕ 的禁用态取「本栏是否已有目标」：`TableGrid` 复用既有 `props.status`（`NoTarget` 即未打开表）计算，不新增状态字段。
- `closeColumn` 递增本栏 `nextToken`：关闭后若之前的刷新微任务仍在途，其结果因序号过期而被丢弃，不会写回已关闭的栏（T-02-31-01）。
- 关闭严格限定 `columnAt(columnIndex)`：不改其它栏的目标 / 状态，不触碰任何磁盘资源（T-02-31-02）。

## Deviations from Plan

### Test-alignment (not a behavioral deviation)

**1. [Test] Task 2 的「空栏复用」用例采用「两栏都有表 → 关第 1 栏」的更强设定**
- **Found during:** Task 2
- **Issue:** 计划文字描述为「点第 1 栏（空栏）以外的某栏 ✕」；若第 1 栏本就无目标，则 `findEmptyColumnIndex` 无论如何都能找到空栏，「关闭 → 复用」的因果会被弱化。
- **Fix:** 改为「第 0、1 栏都设了目标（无空栏）→ 关第 1 栏 → `openSchemaPanel` 复用第 1 栏」，直接证明「关闭出来的空栏」被复用且未调用打开器。行为目标与 must_haves 完全一致，仅测试设定更严格。
- **Files modified:** `packages/libs/editor-impl/src/table/__tests__/closeColumn.uat.test.tsx`
- **Committed in:** `5d4ead0`

---

**Total deviations:** 1 条纯测试设定强化（非行为偏差）。**Impact on plan:** 无；P15 全部 must_haves 达成。

## Issues Encountered

- 无。`TableToolbar` 是 JSX 组件、`TableGrid` 用 `createElement`，两处分别按各自既有风格接线，无冲突。
- 既有的 6 条 ESLint 警告（`tablePanel.ts` 未使用的 `TableGrid*Handler` 导入、`react-hooks-better-stable` 依赖提示、`TableGrid.tsx` 的 `react-refresh` 提示）均为改动前既有，未由本计划引入。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- P15 代码侧完成；新增非导出名 `ITablePanelViewProps.onCloseColumn` / `TablePanel.closeColumn` / `data-test-id="table-close-column"` 已在执行前获用户确认（`INTERFACE-NAME.md` Plan 24–31）。
- 待 `verify-work` 对 P15 做最终人工确认（多栏 ✕ 位置 / 灰度；点 ✕ 只关该栏；关闭后可用「编辑 Schema」占回空栏）。

---

*Phase: 02-table*
*Completed: 2026-10-14*

## Self-Check: PASSED

- FOUND: `packages/libs/editor-impl/src/table/components/TableToolbar.tsx`
- FOUND: `packages/libs/editor-impl/src/table/components/TableGrid.tsx`
- FOUND: `packages/libs/editor-impl/src/table/tablePanel.ts`
- FOUND: `packages/libs/editor-impl/src/table/__tests__/closeColumn.uat.test.tsx`
- FOUND: `.planning/phases/02-table/02-31-SUMMARY.md`
- FOUND commit: `442577a` (Task 1)
- FOUND commit: `5d4ead0` (Task 2)
