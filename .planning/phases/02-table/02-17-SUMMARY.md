---
phase: 02-table
plan: 17
subsystem: ui
tags: [table, editor-core, editor-impl, react, antd, resize-observer, tab-title, multi-column]

# Dependency graph
requires:
  - phase: 02-table
    provides: 02-14（IEditorPanel.getTitle?、ITablePanel.setTable(target, columnIndex?)、ITablePanelParam.columnWidth?）
  - phase: 02-table
    provides: 02-15（TableGrid/TableRow/table.css 修复、NumberInput）
provides:
  - 外壳标签按实例标题（resolveTabName 读 IEditorPanel.getTitle?.()）
  - TablePanel.getTitle() 返回「表格 <id>」
  - 工具栏表名移到按钮左侧 + 竖分隔线
  - 表格面板多栏布局（每栏一张约 columnWidth 宽的表；缺省仅第 0 栏有目标）
  - 撤销载荷带栏号（撤销/重做作用回原栏）
  - 栏内四列 2:2:4:1、行高约 1.3×、值输入改用 antd Input.TextArea
affects: [02-18, 02-19, verify-work, editor-dev]

actuals:
  tokens: 13674
  tasks: 3
  commits: 3
  plan_head_before: 183d30d80824459d6152e97a82c6d3e657e2bee1

tech-stack:
  added: []
  patterns:
    - "多栏状态模型：TablePanel 持有 ITablePanelColumn[]，每栏独立 store 与请求序号"
    - "渲染期惰性补建栏：TablePanelView 量宽后经 getStore(i) 读取（缺失则创建空栏）"

key-files:
  created:
    - packages/libs/editor-core/src/shell/__tests__/shellTitle.test.ts
    - packages/libs/editor-impl/src/table/__tests__/layout.uat.test.tsx
  modified:
    - packages/libs/editor-core/src/shell/shellSystem.ts
    - packages/libs/editor-impl/src/table/tablePanel.ts
    - packages/libs/editor-impl/src/table/components/TableToolbar.tsx
    - packages/libs/editor-impl/src/table/components/inputs/TextareaInput.tsx
    - packages/libs/editor-impl/src/table/table.css
    - packages/libs/editor-impl/src/__tests__/mapPolyfill.ts

key-decisions:
  - "resolveTabName 增第三参 getPanel；ShellRoot/TabRow 经 props 接收实例解析器（构造函数绑定，勿引入模块级可变绑定）"
  - "commitValue/addItem/deleteItem/openSchemaPanel/openCurrentViewInCodeEditor 以 columnIndex 作末位可选参（缺省 0），保持既有单栏调用不变"
  - "多栏请求序号放在私有数组 requestTokens（不做进 ITablePanelColumn，保持其四个成员与计划一致）"
  - "栏包装（.etable-column + 竖分隔线）放在 TablePanelView；TableGrid 对外 props 不变"

patterns-established:
  - "多栏演进结构：栏 = 一组状态 + 一张表，便于将来加拖拽/缩放（本次不实现）"

requirements-completed: [TABLE-01]

# Coverage metadata
coverage:
  - id: D1
    description: "标签按实例显示「表格 <id>」：resolveTabName 读 IEditorPanel.getTitle?.()，缺席回退类型名"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-core/src/shell/__tests__/shellTitle.test.ts"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/layout.uat.test.tsx#面板 getTitle 按实例返回「表格 table.demo」"
        status: pass
    human_judgment: false
  - id: D2
    description: "工具栏表名位于「编辑 Schema / 在代码编辑器中打开」按钮左侧，二者之间有竖分隔线"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/layout.uat.test.tsx#工具栏表名位于按钮左侧且带竖分隔线"
        status: pass
    human_judgment: false
  - id: D3
    description: "面板按 max(1, round(availableWidth / columnWidth)) 铺 N 栏，每栏一张表；缺省仅第 0 栏有目标，其余空态"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/layout.uat.test.tsx#按可用宽度铺出 round(width / columnWidth) 栏"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/layout.uat.test.tsx#缺省只有第 0 栏有目标，其余栏为空态"
        status: pass
    human_judgment: false
  - id: D4
    description: "栏内值输入统一为 antd 组件（TextareaInput 改用 Input.TextArea 而非裸 textarea）"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/layout.uat.test.tsx#值文本域使用 antd Input.TextArea"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/inputs.test.tsx"
        status: pass
    human_judgment: false
  - id: D5
    description: "栏内视觉：整表约 columnWidth 宽、四列 2:2:4:1、行高约当前 1.25–1.5×（与旧表格对齐）"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/layout.uat.test.tsx#表头四列类名保持 name / comment / value / action"
        status: pass
    human_judgment: true
    rationale: "2:2:4:1 与行高是纯 CSS 视觉效果，jsdom 不应用外部样式表、无法断言计算样式；需在真实浏览器目测比例与行高。"
  - id: D6
    description: "撤销/重做对正确栏生效（撤销载荷带栏号，栏号越界忽略，不误写其它栏）"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/undo.test.ts"
        status: pass
    human_judgment: true
    rationale: "既有撤销用例仅覆盖单栏（第 0 栏）；多栏撤销（载荷带栏号）无直接用例，需人工确认多栏下撤销落回原栏。"

duration: 1h 27m
completed: 2026-10-13
status: complete
---

# Phase 2 Plan 17: 标签/工具栏标题与表格多栏布局 Summary

**外壳标签按实例显示「表格 <name>」、工具栏表名左移带竖分隔线；表格面板铺成多栏（每栏一张约 400px 宽的表），栏内四列 2:2:4:1、行高加大、值输入全用 antd。**

## Performance

- **Duration:** 1h 27m
- **Started:** 2026-10-13T21:00:10Z
- **Completed:** 2026-10-13T22:27:47Z
- **Tasks:** 3
- **Files modified:** 8（2 新建，6 修改）

## Accomplishments
- 外壳标签读面板实例的 `IEditorPanel.getTitle?.()`，缺席回退面板类型名；`TablePanel.getTitle()` 返回「表格 table.demo」，标签不再只显示静态「表格面板」（L1）。
- 工具栏表名移到「编辑 Schema / 在代码编辑器中打开」按钮左侧，之间加竖分隔线，保留单行省略号 + `title` 行为（L1）。
- 表格面板由「单目标」改造为「多栏」：按容器可用宽度铺 `max(1, round(availableWidth / columnWidth))` 栏，每栏一张独立订阅的表格；`columnWidth` 取自 `ITablePanelParam.columnWidth`（缺省 400）（L4）。
- 每栏目标经 `ITablePanel.setTable(target, columnIndex)` 设定，缺省只有第 0 栏有目标、其余显示「尚未设置目标表」空态；撤销载荷带栏号，撤销/重做作用回原栏，越界忽略。
- 栏内四列由「4×400px」改为 `2fr 2fr 4fr 1fr`（整表 = 栏宽），行高由约 24px 提升到约 31px（≈1.3×）；`TextareaInput` 改用 antd `Input.TextArea`（`size=small`、`autoSize 1..6 行`），不再使用裸 `textarea`（L4 细节）。

## Task Commits

Each task was committed atomically:

1. **Task 1: 按实例标签标题 + 表名移到按钮左侧（L1）** - `ba262aa` (feat)
2. **Task 2: 多栏布局——每栏一张约 columnWidth 宽的表（L4 结构）** - `2b43830` (feat)
3. **Task 3: 栏内尺寸（2:2:4:1 / 行高）与输入全用 antd（L4 细节）** - `c250289` (feat)

**Plan metadata:** (本 SUMMARY 的提交)

## Files Created/Modified
- `packages/libs/editor-core/src/shell/shellSystem.ts` - `resolveTabName(tab, panelTypes, getPanel)` 读 `getTitle?.()`；`IShellRootProps`/`ITabRowProps` 增 `getPanel`；构造函数绑定实例解析器
- `packages/libs/editor-core/src/shell/__tests__/shellTitle.test.ts` - 新；有/无 `getTitle` 的标签标题用例
- `packages/libs/editor-impl/src/table/tablePanel.ts` - 新增非导出 `ITablePanelColumn`；多栏状态 + `getTitle()` + 每栏请求序号；各编辑/撤销方法带栏号
- `packages/libs/editor-impl/src/table/components/TableToolbar.tsx` - 表名左移 + 竖分隔线
- `packages/libs/editor-impl/src/table/components/inputs/TextareaInput.tsx` - 改用 antd `Input.TextArea`
- `packages/libs/editor-impl/src/table/table.css` - `.etable-columns`/`.etable-column`、四列 2:2:4:1、行高加大、antd 文本域样式
- `packages/libs/editor-impl/src/table/__tests__/layout.uat.test.tsx` - 新；标题/工具栏/多栏/antd 文本域用例
- `packages/libs/editor-impl/src/__tests__/mapPolyfill.ts` - 补 jsdom `ResizeObserver` 空桩（antd 文本域 autoSize 需要）

## Decisions Made
- `resolveTabName` 增第三参 `getPanel`；实例解析器经 props 传入，符合「editor-core 不引入模块级可变绑定」。
- 编辑方法把 `columnIndex` 放在末位（可选、缺省 0），保持既有单栏调用（`commitValue/addItem/deleteItem`）与既有测试不变。
- 多栏请求序号放在私有 `requestTokens` 数组，使 `ITablePanelColumn` 保持计划所列的四个成员。
- 栏包装与竖分隔线落在 `TablePanelView`（多栏归属处），`TableGrid` 对外 props 语义不变。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 为 jsdom 补 ResizeObserver 空桩**
- **Found during:** Task 3（输入改用 antd 文本域）
- **Issue:** `TextareaInput` 改用 antd `Input.TextArea`（`autoSize`）后，多个既有测试文件（tracer/openParam/schemaMode/integration/externalEditor/switchRefresh 等）因 jsdom 未实现 `ResizeObserver` 抛 `ReferenceError: ResizeObserver is not defined`，全套测试红。
- **Fix:** 在既有的 jsdom polyfill 文件 `src/__tests__/mapPolyfill.ts`（已是 `setupFiles`）追加 `ResizeObserver` 空桩。
- **Files modified:** `packages/libs/editor-impl/src/__tests__/mapPolyfill.ts`
- **Verification:** `pnpm --filter @motajs/editor-impl test` 退出 0（13 文件 / 96 用例通过）。
- **Committed in:** `c250289`（Task 3 commit）

### 计划已列但未修改的文件

- `packages/libs/editor-impl/src/table/components/TableGrid.tsx`（Task 2 的 `files` 列出）：本计划把「每栏一张表 + 栏间竖分隔线」的包装放在渲染根 `TablePanelView`（多栏归属处），`TableGrid` 对外 props 语义保持不变，故未改动该文件。

---

**Total deviations:** 1 auto-fixed (1 blocking) + 1 计划文件未改动（无功能影响）。
**Impact on plan:** ResizeObserver 空桩是 antd 文本域在 jsdom 下运行的必备测试基础，无生产代码影响；未改 `TableGrid.tsx` 不影响任何成功判据。

## Issues Encountered
- jsdom 不应用外部样式表，`2:2:4:1` 与行高无法用计算样式断言——按计划允许的降级路径，以「四列类名 name/comment/value/action」断言列结构，并在 coverage D5 标注需人工目测比例与行高。
- antd `Input.TextArea` 在 jsdom 下对 autoSize 计算会输出 `` `NaN` is an invalid value for the `height` `` 警告（`scrollHeight` 为 0 所致），非失败、仅 stderr 噪声。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- L1 / L4 修复已落地：按实例标签标题、工具栏表名左移带分隔线、多栏布局、栏内 2:2:4:1 / 行高 / antd 输入。
- 多栏结构「栏 = 一组状态 + 一张表」，已为将来加拖拽/缩放留好结构（本次不实现拖拽）。
- 遗留：多栏撤销与 2:2:4:1 视觉比例仅有单元/结构级证据，建议 `/gsd-verify-work` 时人工确认。

---
*Phase: 02-table*
*Completed: 2026-10-13*

## Self-Check: PASSED

- 8 个创建/修改文件均存在。
- 3 个任务提交均存在：`ba262aa`、`2b43830`、`c250289`。

