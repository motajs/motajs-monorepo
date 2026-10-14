---
phase: 02-table
plan: 21
subsystem: ui
tags: [react, antd, css, table, hierarchy, indent]

# Dependency graph
requires:
  - phase: 02-table
    provides: "多栏表格面板（02-17/02-20）、可折叠分组行与缩进（02-18）、可编辑行与撤销（02-15/02-18）"
provides:
  - "层级缩进只作用于最左「条目」列，其余三列在所有层级保持同宽对齐"
  - "条目列按层级渲染树形引导竖线（每层 1 条 1px 竖线）"
  - "表格外框加粗为 2px"
  - "嵌套展开行按 data-level 逐级加深背景，子行保持透明"
  - "缩进步长由 12px 缩到 9px（约 3/4）"
  - "单元格内容垂直居中，纯文本经 .etable-cell-text 容器保留省略号截断"
affects: [02-22, 02-23]

# Actuals (#2632) — pairs with the plan's `estimate` (tokens: 60000) to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 6900
  tasks: 3
  commits: 3
  plan_head_before: 8d058696a4e5a311a44d281a10d76a505c91a1e3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "行树层级在渲染递归（renderRows / renderRowNode / renderSchemaRows）里以 level 参数层层传递，不写入数据模型（ITableRowNode 无深度字段）"
    - "层级样式用 data-level 整数值驱动 CSS（[data-level='1'] 等），不写内联背景色，避免与主题耦合"
    - "flex 单元格内纯文本统一包入 .etable-cell-text 以保留省略号截断"

key-files:
  created:
    - packages/libs/editor-impl/src/table/__tests__/indent.uat.test.tsx
  modified:
    - packages/libs/editor-impl/src/table/components/TableGrid.tsx
    - packages/libs/editor-impl/src/table/components/TableRow.tsx
    - packages/libs/editor-impl/src/table/components/GapRow.tsx
    - packages/libs/editor-impl/src/table/table.css

key-decisions:
  - "层级来源：给既有的 renderRows / renderRowNode / renderSchemaRows 增加 level 参数（顶层 0），不新增 ITableRowNode 字段，避免数据模型类型变更"
  - "缩进机制：条目列按 level 渲染 level 个 .etable-tree-guide 占位（每个宽 9px），既提供左缩进又作为树形引导竖线的载体；取消 .etable-group-children 的左内边距与左边框，整行不再收窄"
  - "缩进步长在组件侧由私有常量 TREE_INDENT_STEP（9px）提供、并同步 CSS 变量 --etable-indent（9px），保证 jsdom 下可读且 CSS 自描述"
  - "纯文本截断：因 .etable-cell 改为 flex 后匿名文本项失去省略号，改为统一包 .etable-cell-text（min-width:0 + overflow/ellipsis）容器"

patterns-established:
  - "P1-P13 布局修正批第 2 块：层级缩进与嵌套视觉 + 单元格垂直居中"

requirements-completed: [TABLE-01]

# Coverage metadata (#1602) — one entry per shipped deliverable.
coverage:
  - id: D1
    description: "层级缩进只作用于「条目」列，其余三列在所有层级保持同宽对齐（P3）"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/indent.uat.test.tsx#子层级只在条目列带层级，其余三列不带"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/indent.uat.test.tsx#子行仍保留条目 / 注释 / 值 / 操作四列"
        status: pass
    human_judgment: false
  - id: D2
    description: "条目列按层级渲染树形引导竖线，层级越深竖线越多（P4 竖线）"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/indent.uat.test.tsx#深层条目列的引导竖线多于顶层"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/indent.uat.test.tsx#引导竖线只占条目列"
        status: pass
    human_judgment: false
  - id: D3
    description: "嵌套展开行按层级逐级加深底色、子行保持透明；缩进步长缩到约 3/4（P8）"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/indent.uat.test.tsx#展开行按层级标注 data-level"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/indent.uat.test.tsx#子行不带层级底色属性"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/indent.uat.test.tsx#缩进步长约为 9px"
        status: pass
    human_judgment: true
    rationale: "自动化只验证 data-level 标注与 9px 步长；逐级加深的实际背景不透明度为 CSS 视觉呈现，jsdom 不加载外部 CSS，需人工目视确认内外层底色深浅有别。"
  - id: D4
    description: "表格外框加粗为 2px、单元格内容垂直居中（P4 外框 / P11）"
    requirement: TABLE-01
    verification: []
    human_judgment: true
    rationale: "外框粗细与垂直居中均为 CSS 视觉呈现，jsdom 不做布局与样式计算，自动化退化为结构断言；需人工目视外框变粗、单元格内容上下居中。"

# Metrics
duration: ~17min
completed: 2026-10-14
status: complete
---

# Phase 2 Plan 21: 表格层级视觉与对齐修复 Summary

**层级缩进只作用于「条目」列并加树形引导竖线、外框加粗、展开行逐级加深底色、缩进步长缩到 9px、单元格内容垂直居中**

## Performance

- **Duration:** ~17 min
- **Started:** 2026-10-14T03:23:57Z
- **Completed:** 2026-10-14T03:41:09Z
- **Tasks:** 3
- **Files modified:** 5 (4 modified + 1 created)

## Accomplishments
- 取消 `.etable-group-children` 上的左内边距与左边框——整行不再被收窄右移；层级缩进改由「条目」列内的树形引导占位提供，其余三列（注释 / 值 / 操作）在所有层级保持同宽、纵向对齐（P3）
- 「条目」列按层级渲染 `level` 个 `.etable-tree-guide` 竖线（每层 1 条 1px 竖线），层级关系一眼可读（P4 竖线）
- 表格外框加粗为 2px（P4 外框）；`.etable-cell` 改为 flex 并将内容垂直居中，纯文本经 `.etable-cell-text` 保留省略号（P11）
- 嵌套展开行（仅 `.etable-row-group`，不含子行）按 `data-level` 逐级加深背景，子行保持透明；缩进步长由 12px 缩到 9px（约 3/4）（P8）
- 层级仅在渲染递归里传递，`ITableRowNode` 未新增字段（`git diff` 确认 `types.ts` 无改动）

## Task Commits

Each task was committed atomically:

1. **Task 1: 层级缩进只作用于「条目」列（P3，端到端）** - `02a286e` (fix)
2. **Task 2: 树形引导竖线 + 外边框加粗 + 单元格垂直居中（P4/P11）** - `d464df2` (fix)
3. **Task 3: 嵌套展开行逐级加深底色 + 缩进宽度 ~3/4（P8）** - `ba34de3` (fix)

**Plan metadata:** `(docs commit)` (docs: complete 02-21 plan)

## Files Created/Modified
- `packages/libs/editor-impl/src/table/components/TableGrid.tsx` - `renderRowNode` / `renderRows` / `renderSchemaRows` / `renderPairedRow` 增加 `level` 参数并逐层下传；表头与成对行文本包 `.etable-cell-text`
- `packages/libs/editor-impl/src/table/components/TableRow.tsx` - `ITableRowProps.level`；条目列 `data-level` + 每层一个 `.etable-tree-guide`；注释列文本包 `.etable-cell-text`
- `packages/libs/editor-impl/src/table/components/GapRow.tsx` - `IGapRowProps.level`；分组行 `data-level`；条目列 `data-level` + 引导占位；注释列文本包 `.etable-cell-text`
- `packages/libs/editor-impl/src/table/table.css` - 移除 `.etable-group-children` 收窄；`.etable` 加 2px 外框与 `--etable-indent: 9px`；`.etable-cell` flex 居中；新增 `.etable-tree-guide` / `.etable-cell-text`；`.etable-row-group[data-level]` 逐级底色
- `packages/libs/editor-impl/src/table/__tests__/indent.uat.test.tsx`（新） - 条目列独占缩进、四列保留、引导竖线随层级增加、展开行 data-level、子行透明、9px 步长等 8 个用例

## Decisions Made
- 层级以渲染期 `level` 参数传递（顶层 0），不给 `ITableRowNode` 加深度字段——避免数据模型类型变更。
- 缩进机制＝条目列内 `level` 个等宽占位（`.etable-tree-guide`），同时承担「左缩进」与「树形引导竖线」两职责；不再靠调整整行容器的内边距收窄行。
- 逐级底色改用 `data-level` 整数值驱动 CSS（不写内联背景色），避免与主题耦合。
- 缩进步长在组件侧私有常量 `TREE_INDENT_STEP`（9px）与 CSS 变量 `--etable-indent`（9px）两处同步，前者保证 jsdom 可读、后者用于 CSS 自描述。
- `.etable-cell` 改 flex 后，纯文本统一包 `.etable-cell-text` 容器以保留省略号截断（避免 flex 使匿名文本项失去 `text-overflow`）。

## Deviations from Plan

### Ordering deviation (documented, not auto-fixed)

**1. 树形引导占位在 Task 1 即引入，Task 2 补其线样式**
- **Found during:** Task 1
- **Issue:** 计划把「缩进」（Task 1）与「引导竖线占位」（Task 2）拆开实现；但缩进与竖线本质是同一载体（等宽占位），若 Task 1 用 `paddingLeft` 而 Task 2 再叠占位会产生双重缩进。
- **Fix:** Task 1 即以 `.etable-tree-guide` 占位实现「只缩进条目列」并暴露 `data-level`；Task 2 只补其 1px 竖线样式、外框加粗与垂直居中。交付物与 must_haves 完全一致，仅实现顺序不同。
- **Files modified:** TableGrid.tsx / TableRow.tsx / GapRow.tsx / table.css / indent.uat.test.tsx
- **Verification:** 三个任务各自 `test` + `typecheck` 通过；最终 116 个编辑器实现用例全绿。
- **Committed in:** 02a286e / d464df2

### Naming note

**2. 新增 CSS 钩子 `.etable-cell-text`**
- **Found during:** Task 2
- **Issue:** `.etable-cell` 改 flex 后，纯文本单元格的省略号截断失效，计划要求「包一层截断容器」，但未登记该容器的类名。
- **Fix:** 新增内部 CSS 钩子 `.etable-cell-text`（非对外命名）。相对于计划预先登记的 `.etable-tree-guide` / `data-level` / `--etable-indent`，此为额外 CSS 类钩子，特此登记备查。
- **Files modified:** table.css / TableGrid.tsx / TableRow.tsx / GapRow.tsx
- **Verification:** Prettier 通过；116 用例全绿。

---

**Total deviations:** 1 顺序偏差（结构等价、不改交付物）+ 1 命名登记（新增内部 CSS 类）。
**Impact on plan:** 无范围蔓延；均属计划内职责的落地方式微调。

## Issues Encountered
- 中途用 PowerShell `Get-Content/Set-Content` 批量替换 `TableGrid.tsx` 时误改了 UTF-8 编码并破坏了一行代码；已 `git checkout` 复原到 Task 1 提交后改用编辑工具重做，未影响任何已提交内容。

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- P3 / P4 / P8 / P11 的层级视觉与对齐已落地，`indent.uat.test.tsx` 覆盖结构行为；外框加粗、垂直居中、逐级深浅为 CSS 视觉，待人工在真实宿主目视复核。
- 可进入 02-22（添加按钮 + 文本域）、02-23（dev 宿主演示数据与撤销/重做入口）等后续修正计划。

---
*Phase: 02-table*
*Completed: 2026-10-14*

## Self-Check: PASSED
