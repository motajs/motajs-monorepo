---
phase: 02-table
plan: 26
subsystem: ui
tags: [react, css, table, editor-impl, uat-gap-closure]

# Dependency graph
requires:
  - phase: 02-table
    provides: "GapRow 折叠分组行（02-07）与其层级底色（02-21）；interaction.uat.test.tsx 装配 helper（02-19）"
provides:
  - "折叠行整行点击切换折叠（P19）"
  - "折叠箭头按钮只切换一次（P19）"
  - "折叠行上下边框加粗（P16）"
affects: [02-table, verify-work]

# Actuals (#2632)
actuals:
  tokens: 1514
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "整行点击 + 子控件 stopPropagation，避免父子各切换一次而净效果不变"
    - "jsdom 读不到外部 CSS 时以 ?inline 样式表原文断言规则文本"

key-files:
  created: []
  modified:
    - packages/libs/editor-impl/src/table/components/GapRow.tsx
    - packages/libs/editor-impl/src/table/table.css
    - packages/libs/editor-impl/src/table/__tests__/interaction.uat.test.tsx

key-decisions:
  - "折叠行整行 onClick 切换折叠，箭头按钮先 stopPropagation 再切换，保证点箭头只切换一次"
  - "gutter 增删按钮本已 stopPropagation，不改动；子行在兄弟容器 .etable-group-children 内，点子行不冒泡到父行"
  - "折叠行上下边框显式用 2px solid rgba(0,0,0,0.15)（比 .etable-cell 的 1px 更明显），不改 02-21 的层级底色"

patterns-established:
  - "整行点击 + 子控件 stopPropagation：整行可点但按钮自身只触发一次"

requirements-completed: [TABLE-01]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "折叠行点击行内任意处（非 gutter 按钮）切换折叠，箭头只切换一次，点子行不折叠父行（P19）"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "src/table/__tests__/interaction.uat.test.tsx#点折叠行任意处切换折叠"
        status: pass
      - kind: unit
        ref: "src/table/__tests__/interaction.uat.test.tsx#点折叠箭头只切换一次"
        status: pass
      - kind: unit
        ref: "src/table/__tests__/interaction.uat.test.tsx#点子行不折叠父行"
        status: pass
    human_judgment: false
  - id: D2
    description: "折叠行上下边框加粗（2px，比普通单元格 1px 更明显）（P16）"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "src/table/__tests__/interaction.uat.test.tsx#折叠行上下边框加粗"
        status: pass
    human_judgment: false

# Metrics
duration: ~10min
completed: 2026-10-14
status: complete
---

# Phase 02 Plan 26: 折叠行整行点击折叠 + 上下边框加粗 Summary

**折叠行点行内任意处即折叠 / 展开（箭头只切换一次、gutter 不误触发），并把折叠行上下边框从 1px 加粗到 2px**

## Performance

- **Duration:** ~10min
- **Started:** 2026-10-14T16:52Z
- **Completed:** 2026-10-14T16:57Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- 折叠（分组）行现在点行内任意处都能折叠 / 展开，不再只有那枚小箭头可点（P19）
- 箭头按钮加 `stopPropagation`，点箭头只切换一次（不与整行点击叠加成「切换两次」）；gutter 增删按钮仍不触发折叠
- 点子行不折叠父行：子行渲染在兄弟容器 `.etable-group-children` 内，点击不冒泡到父行
- 折叠行上下边框加粗到 2px（`.etable-row-group` 的 `border-top` / `border-bottom`），层级边界一眼可辨（P16）

## Task Commits

Each task was committed atomically:

1. **Task 1: 折叠行点击行内任意处都切换、箭头只切换一次（P19）** - `b817aae` (feat)
2. **Task 2: 折叠行上下边框加粗（P16）** - `03a8fab` (feat)

**Plan metadata:** (docs commit recorded after this summary)

## Files Created/Modified
- `packages/libs/editor-impl/src/table/components/GapRow.tsx` - 行 div 增 `onClick` 切换折叠；箭头按钮 `onClick` 先 `event.stopPropagation()` 再 `setExpanded(!expanded)`；更新组件 jsDoc
- `packages/libs/editor-impl/src/table/table.css` - `.etable-row-group` 增 `border-top` / `border-bottom: 2px solid rgba(0,0,0,0.15)`
- `packages/libs/editor-impl/src/table/__tests__/interaction.uat.test.tsx` - 新增 P19 三条用例（整行点击 / 箭头单次切换 / 点子行）与 P16 边框用例，并以 `?inline` 读样式表原文

## Decisions Made
- 整行点击与箭头按钮都用 `setExpanded(!expanded)`；靠箭头 `stopPropagation` 保证单次切换（与计划一致）
- gutter 增删按钮已 `stopPropagation`，未改动；子行容器为兄弟节点，天然不误折叠
- 边框选 `2px solid rgba(0,0,0,0.15)`，比 `.etable-cell` 的 1px 明显，且不动 02-21 的层级底色

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- jsdom 不应用外部 CSS，故 P16 用计划允许的退化断言：以 `../table.css?inline`（`global.d.ts` 已声明）读样式表原文，正则核对 `.etable-row-group` 规则含 `border-top`/`border-bottom: 2px`（与既有 `layout.uat.test.tsx` 同法）。

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- P16 / P19 修复完成，`editor-impl` 133 测试、`editor-core` 70 测试、两条 typecheck、四条门禁脚本全绿。
- 未改行树 / 字段路径 / 分栏；未新增对外命名；未新增依赖。
- 待 `verify-work` 对 P16 / P19 做最终人工确认。

---
*Phase: 02-table*
*Completed: 2026-10-14*

## Self-Check: PASSED

- FOUND: `.planning/phases/02-table/02-26-SUMMARY.md`
- FOUND: commit `b817aae` (Task 1)
- FOUND: commit `03a8fab` (Task 2)
