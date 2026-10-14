---
phase: 02-table
plan: 20
subsystem: ui
tags: [react, antd, css, table, layout]

# Dependency graph
requires:
  - phase: 02-table
    provides: "多栏表格面板（02-17）、可编辑行与撤销（02-15/02-18）、schema 视图与打开器（02-16）"
provides:
  - "栏数按 window.innerWidth 计算、可视栏在容器内等分的多栏布局"
  - "视图经 onLayout 回报可视栏数给面板"
  - "「编辑 Schema」优先复用当前面板空栏，无空栏才经注入打开器新开"
  - "每栏默认宽度 500px"
affects: [02-21, 02-22, 02-23]

# Actuals (#2632) — pairs with the plan's `estimate` (tokens: 60000) to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 3090
  tasks: 3
  commits: 3
  plan_head_before: cde80d73cce2c519e85ea794c75d45c1eede116d

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "几何经纯函数 resolveColumnCount(windowWidth, columnWidth) 计算，视图不把几何耦合进模型"
    - "视图经只读回调 onLayout 把可视栏数回报给面板，模型据此在不越界范围内决策"

key-files:
  created: []
  modified:
    - packages/libs/editor-impl/src/table/tablePanel.ts
    - packages/libs/editor-impl/src/table/table.css
    - packages/libs/editor-impl/src/table/types.ts
    - packages/libs/editor-impl/src/table/__tests__/layout.uat.test.tsx
    - packages/libs/editor-impl/src/__tests__/mapPolyfill.ts

key-decisions:
  - "栏数由 window.innerWidth 决定（N = max(1, floor(innerWidth / 栏宽))），但可视栏在容器内等分（flex: 1 1 0），既满足末栏不偏宽又不产生横向滚动条（P5/P6 冲突的落点）"
  - "面板不自行读窗口；由视图经 onLayout 回报可视栏数，避免几何耦合进模型且便于测试"
  - "栏分隔线改为覆盖整列高度的 ::before 竖线（配 align-self: stretch + min-height: 100%），两侧表格高度不一致时不再断口（P9）"
  - "jsdom 缺省 innerWidth 归零（测试环境），等价于改造前未桩 clientWidth 时的单栏缺省"

patterns-established:
  - "P1-P13 布局修正批第 1 块：多栏机制与默认栏宽"

requirements-completed: [TABLE-01]

# Coverage metadata (#1602) — one entry per shipped deliverable.
coverage:
  - id: D1
    description: "多栏按 window.innerWidth 计算栏数并在容器内等分，窄窗不产生横向滚动条（P5/P6）"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/layout.uat.test.tsx#各栏等分且不再使用固定像素宽度"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/layout.uat.test.tsx#窄窗只铺 1 栏且不出现横向滚动条"
        status: pass
    human_judgment: false
  - id: D2
    description: "每栏默认宽度 500px（P2）"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/layout.uat.test.tsx#按窗口宽度铺出 floor(innerWidth / columnWidth) 栏"
        status: pass
    human_judgment: false
  - id: D3
    description: "「编辑 Schema」优先复用当前面板空栏，无空栏才经注入打开器新开（P1）"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/layout.uat.test.tsx#有空栏时「编辑 Schema」复用空栏而不新开面板"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/layout.uat.test.tsx#窄窗无空栏时「编辑 Schema」经打开器新开面板"
        status: pass
    human_judgment: false
  - id: D4
    description: "栏分隔线覆盖整列高度，两侧表格高度不一致时也不断口（P9）"
    requirement: TABLE-01
    verification: []
    human_judgment: true
    rationale: "分隔线为 CSS 视觉呈现，jsdom 不加载外部 CSS，自动化无法量测实际像素高度；需人工目视两栏高度不一致时竖线仍贯通。"

# Metrics
duration: ~13min
completed: 2026-10-14
status: complete
---

# Phase 2 Plan 20: 表格分栏机制与「编辑 Schema」入口修复 Summary

**多栏宽度改由窗口宽度计算、各栏等分且窄窗无横向滚动；栏分隔线覆盖整列；默认栏宽升到 500；「编辑 Schema」就近复用空栏**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-10-14T11:00:00Z
- **Completed:** 2026-10-14T11:13:29Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- 栏数公式改为 `N = max(1, floor(window.innerWidth / 栏宽))`；可视栏在容器内等分（`flex: 1 1 0`），末栏不再偏宽、窄窗不再冒出横向滚动条（P5/P6）。
- 栏分隔线改为覆盖整列高度的 `::before` 竖线，两侧表格高度不一致时不再断口（P9）。
- 默认栏宽由 400 提升到 500（P2），仅改常量值与类型 jsDoc，未改 `ITablePanelParam.columnWidth` 的形状。
- 「编辑 Schema」优先把 schema 放进当前面板的一个空栏，没有空栏时才经注入的打开器新开面板（P1）。

## Task Commits

Each task was committed atomically:

1. **Task 1: 按 window.innerWidth 分等宽栏 + 无横向滚动 + 整列高分隔线（P5/P6/P9）** - `0750227` (fix)
2. **Task 2: 默认栏宽 400 → 500（P2）** - `d8e5acc` (fix)
3. **Task 3: 「编辑 Schema」优先复用当前面板的空栏（P1）** - `5cb6152` (fix)

**Plan metadata:** (docs: complete plan) — 见本 SUMMARY 提交

## Files Created/Modified
- `packages/libs/editor-impl/src/table/tablePanel.ts` - 新增非导出 `resolveColumnCount`、`ITablePanelViewProps.onLayout`、`TablePanel.findEmptyColumnIndex`；视图改以 `window.innerWidth` 计算栏数并回报；`openSchemaPanel` 复用空栏；`DEFAULT_COLUMN_WIDTH` 500。
- `packages/libs/editor-impl/src/table/table.css` - `.etable-columns` 去横向滚动（`overflow: hidden`）、`.etable-column` 等分（`flex: 1 1 0`）与整列高分隔线。
- `packages/libs/editor-impl/src/table/types.ts` - `ITablePanelParam.columnWidth` jsDoc 缺省 400 → 500。
- `packages/libs/editor-impl/src/table/__tests__/layout.uat.test.tsx` - 改用 `window.innerWidth` 驱动；新增等分/无横向滚动/空栏复用用例。
- `packages/libs/editor-impl/src/__tests__/mapPolyfill.ts` - （偏差）测试环境缺省 `window.innerWidth` 归零。

## Decisions Made
- 栏数由 `window.innerWidth` 决定，但可视栏在**容器内**等分：若硬写 `innerWidth/N` 会撑破略窄的容器反而产生横向滚动，与 P6 冲突（见 plan 的 flagged assumption）。
- 面板不直接读窗口：可视栏数由视图经 `onLayout` 回报，模型只在 `0..visibleColumnCount-1` 内找空栏，越界即回退到打开器（T-02-20-02）。
- 分隔线用 `::before` 绝对定位画满整列高度，配 `align-self: stretch` + `min-height: 100%`。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 测试环境缺省窗口宽度归零**
- **Found during:** Task 1（按 window.innerWidth 分等宽栏）
- **Issue:** 改用 `window.innerWidth` 后，jsdom 缺省的 1024 会让面板在**所有**既有用例里铺出 2 栏（第二个空栏复用了同一批 `data-test-id`），导致 8 个测试文件、20 条用例失败（`Found multiple elements by [data-test-id="table-edit-schema"]` 等）。既有用例均以「单栏」为前提，而改造前它靠未桩的 `clientWidth`（0）得到 1 栏。
- **Fix:** 在共享测试装配文件 `src/__tests__/mapPolyfill.ts` 里把 jsdom 缺省 `window.innerWidth` 归零（`resolveColumnCount(0, w)` 保底 1 栏），等价于改造前的单栏缺省；`layout.uat.test.tsx` 内按需显式覆盖。
- **Files modified:** packages/libs/editor-impl/src/__tests__/mapPolyfill.ts
- **Verification:** `pnpm --filter @motajs/editor-impl test` 由 8 failed / 20 failed 恢复为 14 files / 108 tests 全通过。
- **Committed in:** `0750227`（Task 1 提交）

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** 唯一偏差是测试环境缺省值，未改任何产品行为，也未越出本计划范围。产品代码只改了 `files_modified` 列出的文件 + `types.ts`（Task 2 属计划内）。

## Issues Encountered
- 运行测试时 jsdom 输出既有噪声 `` `NaN` is an invalid value for the `height` css style property. ``（来自外壳/antd 在 0 尺寸下的计算），改动前即存在，与本计划无关，未处理。

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 分栏机制（P5/P6/P9）、默认栏宽（P2）、「编辑 Schema」复用空栏（P1）已就绪，可进入 02-21（层级视觉）等后续修正计划。
- 待人工确认（非功能）：新命名 `resolveColumnCount` / `ITablePanelViewProps.onLayout` / `TablePanel.findEmptyColumnIndex` 是否照此定案（已登记于 `INTERFACE-NAME.md`「Plan 20–23」）。

---
*Phase: 02-table*
*Completed: 2026-10-14*

## Self-Check: PASSED

- Commits found: `0750227`, `d8e5acc`, `5cb6152`
- Files found: `tablePanel.ts`, `table.css`, `types.ts`, `layout.uat.test.tsx`, `mapPolyfill.ts`
- Verification: editor-impl test 14 files / 108 passed; typecheck exit 0; editor-core test 9 files / 70 passed; coreImportType / coreEngineNeutral / coreModuleState / coreFsSurface 各 exit 0; Prettier clean

