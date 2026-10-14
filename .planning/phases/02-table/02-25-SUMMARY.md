---
phase: 02-table
plan: 25
subsystem: ui
tags: [react, typescript, editor-impl, table, css, layout]

# Dependency graph
requires:
  - phase: 02-table
    provides: 既有多栏布局（`.etable-columns` / `.etable-column` / `.etable` / `.etable-body`）与 `TableToolbar` 的现有渲染结构
  - phase: 02-table
    provides: 02-24 为 `ITableToolbarProps` 增的可选 `onCloseColumn` / `closeButtonEnabled`（本计划未触及）
provides:
  - "每栏内容区独立滚动：只有 `.etable-body` 是滚动容器，顶部工具栏与提示行固定（P14）"
  - "「操作」列宽为 1.5fr（当前的 1.5 倍）（P25）"
  - "未打开表的栏顶部控件右对齐（`.etable-toolbar-spacer` 弹性占位）（P17）"
affects: [02-26, 02-31]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 2047
  tasks: 3
  commits: 3
  plan_head_before: 71fc5d0aa390c079b17e7e1a7c1e692457e96104

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "受限高度链：`.etable-column { height:100%; overflow:hidden }` + `.etable { position:absolute; inset:0 }` 让 `.etable-body` 成为唯一滚动容器"
    - "jsdom 不解析外部 CSS：布局断言改从 CSS 文本核对（Vitest `?inline` 导入 + `test.css: true`）"

key-files:
  created: []
  modified:
    - packages/libs/editor-impl/src/table/table.css
    - packages/libs/editor-impl/src/table/components/TableToolbar.tsx
    - packages/libs/editor-impl/src/table/__tests__/layout.uat.test.tsx
    - packages/libs/editor-impl/src/global.d.ts
    - packages/libs/editor-impl/vitest.config.ts

key-decisions:
  - "P14 用「受限高度」而非改 DOM：给 `.etable-column` 确定高度并让 `.etable` 填充，使 `.etable-body` 必然成为唯一滚动容器，工具栏 / 提示行留在其外"
  - "P17 占位仅在 `title === undefined`（空栏）时渲染；有表栏继续由 title 撑开，布局不变——避免影响既有标题 / 分隔线用例"
  - "补集：为在 jsdom 中断言 CSS（jsdom 不应用外部 CSS 且 Vitest 默认把 CSS 置空），开启 editor-impl 的 `test.css` 并用 `?inline` 读取样式文本（未新增依赖）"

patterns-established:
  - "布局改动的可测性：样式规则文本断言（`?inline`）+ 结构断言（元素归属、弹性占位）组合，绕开 jsdom 无 CSS 级联的限制"

requirements-completed: [TABLE-01]

# Coverage metadata (#1602) — one entry per shipped deliverable. Drives DETERMINISTIC UAT routing in verify-work.
coverage:
  - id: D1
    description: "每栏内容区独立滚动、工具栏与提示行固定（P14）"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "pnpm --filter @motajs/editor-impl test -- __tests__/layout.uat.test.tsx"
        status: pass
      - kind: other
        ref: "pnpm --filter @motajs/editor-impl typecheck"
        status: pass
    human_judgment: false
  - id: D2
    description: "「操作」列宽为 1.5 倍（P25）"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "pnpm --filter @motajs/editor-impl test -- __tests__/layout.uat.test.tsx"
        status: pass
      - kind: other
        ref: "pnpm --filter @motajs/editor-impl typecheck"
        status: pass
    human_judgment: false
  - id: D3
    description: "未打开表的栏顶部控件右对齐（P17）"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "pnpm --filter @motajs/editor-impl test -- __tests__/layout.uat.test.tsx"
        status: pass
      - kind: other
        ref: "pnpm --filter @motajs/editor-impl typecheck"
        status: pass
    human_judgment: false

# Metrics
duration: 15min
completed: 2026-10-14
status: complete
---

# Phase 2 Plan 25: 每栏独立滚动 / 空栏右对齐 / 操作列 1.5×（P14/P17/P25） Summary

**让每个表格栏各自独立滚动、顶部控件与提示行固定不动；未打开表的栏把顶部按钮推到右边；「操作」列加宽到原来的 1.5 倍——只改布局与样式，没动数据、校验、撤销和分栏逻辑**

## Performance

- **Duration:** 15 min
- **Started:** 2026-10-14T16:24:00+08:00
- **Completed:** 2026-10-14T16:38:57+08:00
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- **P14**：把每栏的高度链约束住（`.etable-column` 给确定高度并不外溢；`.etable` 绝对定位填满该栏），于是只有内容区 `.etable-body` 会滚动，顶部的「编辑模式控件 + 按钮」工具栏和提示行在滚动时保持固定；整块面板不再一起滚。
- **P25**：表格网格（表头与数据行共用）的 `grid-template-columns` 末列由 `1fr` 改为 `1.5fr`，「操作」列因此变宽为原来的 1.5 倍（其余列 `24px 2fr 2fr 4fr` 不变）。
- **P17**：工具栏在**没有标题**（即该栏未打开任何表）时渲染一个弹性占位 `.etable-toolbar-spacer`，把右侧按钮推到右端；有表时仍由既有标题撑开，布局不变。
- 新增 7 条布局用例（P14 三条、P25 一条、P17 两条，另 P14 复用既有装配），全部落地在 `layout.uat.test.tsx`。

## Task Commits

Each task was committed atomically:

1. **Task 1: 每栏内容区独立滚动、工具栏与提示行固定（P14）** - `42ad759` (feat)
2. **Task 2: 「操作」列宽改为 1.5 倍（P25）** - `09ca967` (feat)
3. **Task 3: 未打开表的栏把顶部控件右对齐（P17）** - `a70dd22` (feat)

**Plan metadata:** (本次摘要提交)

## Files Created/Modified
- `packages/libs/editor-impl/src/table/table.css` - `.etable` 定位填充、`.etable-column` 受限高度 + `overflow:hidden`、操作列 `1.5fr`、新增 `.etable-toolbar-spacer`
- `packages/libs/editor-impl/src/table/components/TableToolbar.tsx` - 无标题时渲染弹性占位，把控件推向右端
- `packages/libs/editor-impl/src/table/__tests__/layout.uat.test.tsx` - 新增 P14 / P25 / P17 用例并接入 CSS 文本核对
- `packages/libs/editor-impl/src/global.d.ts` - 增 `declare module '*.css?inline'`（供测试读取样式文本）
- `packages/libs/editor-impl/vitest.config.ts` - `test.css: true`（让 `?inline` 能取到 CSS 文本）

## Decisions Made
- **P14 不改 DOM 结构**：`TableGrid` 的就绪态结构（toolbar / banner / notice / header / `.etable-body`）保持原样，只靠 CSS 约束高度，使 `.etable-body` 必然成为唯一滚动容器。这样 `TableGrid` 零改动、回归面最小。
- **P17 占位只在空栏出现**：`title === undefined` 才渲染 `.etable-toolbar-spacer`；有表栏继续由 `title` 的 `flex:1` 把按钮推右。既有「工具栏表名位于按钮左侧且带竖分隔线」用例保持绿色。
- **P25 只改比例**：`grid-template-columns` 末列 `1fr → 1.5fr`，不新增固定像素宽，保持等分 / 自适应特性。
- **测试可读 CSS 的补充手段**：jsdom 不应用外部 CSS、且 Vitest 默认把 CSS 文件内容置为空字符串，故在 editor-impl 打开 `test.css` 并用 Vite 的 `?inline` 查询读取 `table.css` 原文，从而对「谁在滚动」与「操作列比例」做确定性断言。未引入任何新依赖。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 增加 `?inline` 模块声明与开启 Vitest `test.css`**
- **Found during:** Task 1
- **Issue:** 计划的 P14 / P25 用例要求核对 CSS（滚动归属、操作列比例），但 jsdom 不应用外部 CSS；且 Vitest 默认（`css: false`）会把任何 `.css` 导入（含 `?raw` / `?inline`）置为空字符串，`?raw` 与 `?inline` 均返回 `''`，测试无法读取样式。
- **Fix:** 在 `packages/libs/editor-impl/src/global.d.ts` 增 `declare module '*.css?inline'`；在 `packages/libs/editor-impl/vitest.config.ts` 设 `test.css: true`，使 Vite CSS 插件处理 `?inline` 查询并把样式文本作为默认导出返回。未改动任何依赖。
- **Files modified:** `packages/libs/editor-impl/src/global.d.ts`、`packages/libs/editor-impl/vitest.config.ts`
- **Commit:** `42ad759`

## Issues Encountered
- jsdom 输出既有噪声 `Not implemented: window.getComputedStyle` 与 `` `NaN` is an invalid value for the `height` css style property ``（来自 antd 组件），为既有测试环境噪声，不影响退出码。全量套件仍全绿（126 → 129 用例）。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- P14 / P17 / P25 的布局改动已落地且被用例覆盖；本计划与 02-24 同改 `TableToolbar.tsx`，两者兼容。
- 未改 `resolveColumnCount` / `TablePanelStatus` / 分栏数据结构；未新增对外命名（`.etable-toolbar-spacer` 为非对外 CSS 类名）。
- 手动验收（非功能）仍待用户在多栏实机确认视觉效果：多栏各自滚动、工具栏 / 提示行固定、操作列明显变宽、空栏控件右对齐。

---

*Phase: 02-table*
*Completed: 2026-10-14*

## Self-Check: PASSED

- Verified files exist: `table.css`, `TableToolbar.tsx`, `layout.uat.test.tsx`, `global.d.ts`, `vitest.config.ts`, `02-25-SUMMARY.md`
- Verified commits exist: `42ad759`, `09ca967`, `a70dd22`
