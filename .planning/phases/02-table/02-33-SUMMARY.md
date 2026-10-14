---
phase: 02-table
plan: 33
subsystem: ui
tags: [editor-impl, table, css, uat-gap-closure, p27, p28]
gap_closure: true
gap_ids: [G-02-UAT3]

# Dependency graph
requires:
  - phase: 02-table
    provides: "02-19 折叠行整行点击折叠（`GapRow` 整行 `onClick`，箭头按钮 stopPropagation）——本计划 P27 只是补上对应的手型光标"
  - phase: 02-table
    provides: "02-28（提交 34ff5f5 / 014f42c）把值文本域改成按行数 `rows` + 可拖拽 `resize: vertical`——本计划 P28 将其逐条精确回退"
provides:
  - "折叠（分组）行**整行**显示手型光标：`.etable-row-group { cursor: pointer }`（P27），整行可点即折叠与既有交互一致"
  - "值文本域恢复 antd `Input.TextArea` 的 `autoSize={{ minRows: 1, maxRows: 6 }}`（最小 1 行、随内容增高、最多 6 行、超出内部滚动）（P28）"
  - "`.etable-input-textarea` 恢复 `max-height: 160px`、去掉 `resize: vertical`（P28）；`resolveTextareaRows` 已删除"
affects: [verify-work]

# Actuals (#2632)
actuals:
  tokens: 1355
  tasks: 2
  commits: 2
  plan_head_before: 8e80d76e21d7e4fe54ab551811b70e838b4d9ae9

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CSS 规则文本断言：jsdom 不应用外部 CSS，布局 / 光标规则改为对 `table.css?inline` 原文做正则断言（沿用既有 P14 / P25 / P17 风格）"
    - "回退以 `git show <commit>^` 取 02-28 改动前的原文为基准，逐文件还原，保证是精确回退而非近似"

key-files:
  created: []
  modified:
    - packages/libs/editor-impl/src/table/table.css
    - packages/libs/editor-impl/src/table/components/inputs/TextareaInput.tsx
    - packages/libs/editor-impl/src/table/__tests__/layout.uat.test.tsx

key-decisions:
  - "P27 只加一条 CSS 规则（`.etable-row-group { cursor: pointer }`），不动折叠逻辑与箭头 `.etable-group-toggle` 的既有样式——整行点击折叠已由 02-19 实现，此次仅让「可点」可见"
  - "P28 以 02-28 改动前的原文为基准逐条还原（`TextareaInput.tsx` 去 `resolveTextareaRows` 并恢复 `autoSize`、`table.css` 去 `resize: vertical` 并恢复 `max-height: 160px`、测试移除 02-28 新增的两个 describe 与不再使用的 `fireEvent` 导入）"
  - "回退后 `rows` / 拖拽相关的 4 条用例不再成立，直接删除，不改成等价断言——保持测试与 autoSize 实现一致"
  - "插件 / props 形状不变：`ITextareaInputProps` 未改；失焦提交、非法 JSON 恢复为最后一次合法值的语义未改"

patterns-established:
  - "「观感回归 → 精确回退」：以被回退提交的父提交原文为基准逐文件还原，再用 `git diff` 核对无额外改动"

requirements-completed: [TABLE-01]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "折叠（分组）行整行显示手型光标"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "src/table/__tests__/layout.uat.test.tsx#折叠行整行显示手型光标"
        status: pass
    human_judgment: false
  - id: D2
    description: "值文本域回到 antd autoSize（最多 6 行），样式表恢复 max-height: 160px 且不再有 resize: vertical"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "src/table/__tests__/layout.uat.test.tsx#值文本域使用 antd Input.TextArea"
        status: pass
    human_judgment: false
  - id: D3
    description: "手动核对（非功能）：折叠行整行鼠标为手型；值文本域随内容增高、最多 6 行、超出内部滚动，且不再有拖拽手柄"
    requirement: TABLE-01
    verification:
      - kind: manual
        ref: "在编辑器中把鼠标移到折叠行整行看是否手型；把多行字符串值填入值文本域看高度与滚动、确认无拖拽手柄"
        status: pending
    human_judgment: true

# Metrics
duration: 6min
completed: 2026-10-14
status: complete
---

# Phase 2 Plan 33: 折叠行整行手型光标 + 值文本域回退 autoSize（P27 / P28）Summary

**两处小修：折叠（分组）行现在整行都显示「可以点」的手型光标；值文本域退回 antd 自带的「随内容增高、最多 6 行、超出内部滚动」效果，撤销 02-28 改成「按行数设高 + 可拖拽」的那次改动。**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-10-14T13:12Z
- **Completed:** 2026-10-14T13:17Z
- **Tasks:** 2
- **Files created/modified:** 3 (0 created, 3 modified)

## Accomplishments

- **P27 折叠行整行手型光标**：在 `.etable-row-group` 加了 `cursor: pointer;`。此前只有折叠箭头 `.etable-group-toggle` 是手型，整行虽已可点（`GapRow` 整行 `onClick`，02-19）却看不出可点；现在整行鼠标都是手型，与既有交互一致。
- **P28 值文本域精确回退**：`TextareaInput.tsx` 删掉 02-28 新增的 `resolveTextareaRows` 及其 jsDoc，`<Input.TextArea>` 从 `rows={resolveTextareaRows(text)}` 还原为 `autoSize={{ minRows: 1, maxRows: 6 }}`；`table.css` 的 `.etable-input-textarea` 去掉 `resize: vertical`、恢复 `max-height: 160px`；测试文件移除 02-28 新增的两个 `describe`（按行数 3 例 + 可拖拽 1 例）与不再使用的 `fireEvent` 导入。回退前后以 `git show 34ff5f5^ / 014f42c^` 的原文为基准逐条核对，`git diff` 确认无额外改动。
- 未改 `ITextareaInputProps`（无新 props）；未改「失焦提交、非法 JSON 恢复为最后一次合法值」的语义；仍为 antd `Input.TextArea`；未新增依赖；未使用 `import type`。

## Task Commits

Each task was committed atomically:

1. **Task 1: 折叠行整行手型光标（P27）**（tracer）- `aef7e5d` (fix)
2. **Task 2: 值文本域回退到 antd autoSize（P28，撤销 02-28）** - `6b195ae` (fix)

**Plan metadata:** 见本 SUMMARY 的最终文档提交

## Files Created/Modified

- `packages/libs/editor-impl/src/table/table.css` - `.etable-row-group` 加 `cursor: pointer`（P27）；`.etable-input-textarea` 由 `resize: vertical` 还原为 `max-height: 160px`（P28）。
- `packages/libs/editor-impl/src/table/components/inputs/TextareaInput.tsx` - 删除 `resolveTextareaRows` 及 jsDoc；渲染由 `rows={...}` 还原为 `autoSize={{ minRows: 1, maxRows: 6 }}`。
- `packages/libs/editor-impl/src/table/__tests__/layout.uat.test.tsx` - 新增「折叠行整行手型光标（P27）」1 例；移除 02-28 的「值文本域高度按内容行数（P24）」3 例与「文本域可拖拽调整大小（P24）」1 例，并移除 `fireEvent` 导入。

## Decisions Made

- **P27 只加一条 CSS，不动折叠逻辑**——整行点击折叠已由 02-19 的 `GapRow` 整行 `onClick` 实现，箭头 `stopPropagation` 也只切换一次；本次只让「可点」这一事实可见。
- **P28 为精确回退**——以 02-28 两个提交的父提交原文为基准逐文件还原，`git diff` 核对无越界改动。
- **直接删除 4 条 02-28 用例**——回退后 `rows` / `resize` 的行为不再存在，硬保留会失败；改为删除，使测试与 autoSize 实现一致；既有「值文本域使用 antd Input.TextArea」用例仍绿。
- **`TABLE_CSS` 常量保留**——仍被 P14 / P25 / P17 的规则断言使用，未删除。

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- 无阻塞。回退测试从 22 例降为 18 例（删 4 加 1）；其余既有用例（tracer / switchRefresh / edit / panelSync 等）全绿。

## Verification

- `pnpm --filter @motajs/editor-impl test -- __tests__/layout.uat.test.tsx` → 退出 0（18 passed）
- `pnpm --filter @motajs/editor-impl test` → 退出 0（20 files / 158 tests passed）
- `pnpm --filter @motajs/editor-impl typecheck` → 退出 0
- `pnpm --filter @motajs/editor-core test` → 退出 0（9 files / 70 tests passed）
- 四个门禁脚本（串行）均退出 0：
  - `node scripts/verify/coreImportType.js` → 94 文件、0 条 import type
  - `node scripts/verify/coreEngineNeutral.js` → 62 文件、0 条引擎标识违规
  - `node scripts/verify/coreModuleState.js` → 0 条 error 级受限规则
  - `node scripts/verify/coreFsSurface.js` → `IEditorFileSystem` 仅在声明文件
- `npx prettier --check` 三个改动文件 → 全通过；`npx eslint` 三个改动文件 → 0 error（table.css 的 "File ignored" 属预期，ESLint 不处理 CSS）
- `git diff` 确认 P28 是 02-28 的精确回退（三处逐条还原），未改 `ITextareaInputProps`。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- P27 / P28 代码侧完成，无新增命名、无新增测试文件。
- 需求用户侧 `verify-work` 做最终人工确认（非功能）：折叠行整行鼠标为手型；值文本域随内容增高、最多 6 行、超出内部滚动、且无拖拽手柄。

---

*Phase: 02-table*
*Completed: 2026-10-14*

## Self-Check: PASSED

- FOUND: `packages/libs/editor-impl/src/table/table.css`
- FOUND: `packages/libs/editor-impl/src/table/components/inputs/TextareaInput.tsx`
- FOUND: `packages/libs/editor-impl/src/table/__tests__/layout.uat.test.tsx`
- FOUND: `.planning/phases/02-table/02-33-SUMMARY.md`
- FOUND commit: `aef7e5d` (Task 1)
- FOUND commit: `6b195ae` (Task 2)
