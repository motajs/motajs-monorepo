---
phase: 02-table
plan: 32
subsystem: ui
tags: [editor-impl, table, performance, react, memo, uat-gap-closure, p26]
gap_closure: true
gap_ids: [G-02-UAT3]

# Dependency graph
requires:
  - phase: 02-table
    provides: "02-30 的行树按输入引用缓存（buildTableTree / buildSchemaTree，输入引用未变即复用同一数组）；资源层 contentCache 的按 id 稳定引用（resourceSystem.readContent）；TablePanel 的 refresh / applyLoaded / applySchemaLoaded / publish / setTable 与多栏状态；TableGrid / TableColumn 渲染树"
provides:
  - "TablePanel.refresh 原地更新：该栏已就绪且已有行树时不再先切成加载态（避免整棵行树卸载重挂），仅首载 / 换表 / 失败重试才发加载态（P26）"
  - "TablePanel.setTable 换到另一张目标表时先清掉旧表行树，同目标重复设置不清"
  - "React.memo(TableGrid) + Ready 分支行元素列表 useMemo + TableColumn 各回调 useCallback：内容未变的刷新跳过整表重渲染（P26）"
affects: [02-table, verify-work]

# Actuals (#2632)
actuals:
  tokens: 3843
  tasks: 2
  commits: 2
  plan_head_before: 26bf33056fc97a4e2616070f3f7c9be5ff26e5ec

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "刷新原地更新：以「本栏是否已就绪且 rows.length > 0」判定是否发加载态，内容未变时保持 Ready 并复用同一行树数组，使 React 按稳定 key 复用 DOM 节点而非整树卸载重挂"
    - "整表记忆化：React.memo(TableGrid)（浅比较）+ 由视图根稳定 props 经 useCallback 固定的各栏回调 + Ready 分支行元素列表 useMemo（依赖 rows / mode / schemaMode / 回调）——内容未变时返回同一批行元素，React 直接跳过该子树（等效整表记忆化，且无需改 ITableRowProps / IGapRowProps）"
    - "换表清树与刷新解耦：setTable 在目标 data.id 变化（或此前无目标）时清树，refresh 自身不再无条件清树"

key-files:
  created:
    - packages/libs/editor-impl/src/table/__tests__/refreshIdentity.uat.test.tsx
  modified:
    - packages/libs/editor-impl/src/table/tablePanel.ts
    - packages/libs/editor-impl/src/table/components/TableGrid.tsx

key-decisions:
  - "判定「已有内容」用既有视图状态（status === Ready && rows.length > 0），不新增状态字段；首载 / 错误 / 空态仍按原语义发加载 / 错误 / 空态"
  - "换表清旧行树放在 setTable（而非 refresh）：只有换到另一张 data.id 的表才需要清，刷新本身不应清；同目标重复设置保持原地更新"
  - "错误路径保持原样（publish Error + 空行树），不做「失败时保留旧行树」的额外语义改动（禁令要求失败路径不变）"
  - "行元素列表在 TableGrid 内 useMemo（依赖 props.rows / mode / schemaMode / 各回调），schema 模式的成对合行（buildSchemaPresentation）随之只在依赖变化时计算"
  - "TableColumn 回调按计划用 useCallback 且以来源 props 字段为依赖（props.onRetry / props.columnIndex / …）：props 对象本身每次渲染都是新对象，不能作为依赖，否则记忆化失效"

patterns-established:
  - "内容未变的刷新不整树重挂：Ready 状态与行树引用一起保持稳定，React 按行 key 复用节点；配合整表记忆化进一步跳过重渲染"

requirements-completed: [TABLE-01]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "同一内容刷新后行 DOM 节点身份不变（刷新不再整树卸载重挂）"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "src/table/__tests__/refreshIdentity.uat.test.tsx#同一内容刷新后行 DOM 节点身份不变"
        status: pass
    human_judgment: false
  - id: D2
    description: "内容真的变了时行树仍正确更新为新值（不与同内容用例冲突）"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "src/table/__tests__/refreshIdentity.uat.test.tsx#内容变更后刷新仍更新为新值"
        status: pass
    human_judgment: false
  - id: D3
    description: "首载资源尚未返回时仍显示加载态（保持既有加载态语义）"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "src/table/__tests__/refreshIdentity.uat.test.tsx#首载资源未返回时仍显示加载态"
        status: pass
    human_judgment: false
  - id: D4
    description: "同一内容刷新后值单元格输入控件的 DOM 节点身份不变（记忆化命中，整表重渲染被跳过）"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "src/table/__tests__/refreshIdentity.uat.test.tsx#同一内容刷新后输入控件身份不变"
        status: pass
    human_judgment: false
  - id: D5
    description: "对某字段写盘后刷新，其余未变更字段的行 DOM 节点身份保持不变"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "src/table/__tests__/refreshIdentity.uat.test.tsx#未受影响的行刷新后不重挂"
        status: pass
    human_judgment: false
  - id: D6
    description: "开 3 个面板反复切换 / 频繁编辑不再明显卡顿；刷新瞬间不再闪成「正在加载」空态（非功能，人工确认）"
    requirement: TABLE-01
    verification:
      - kind: manual
        ref: "开 3 个面板（table.demo + 两个 table#schema.demo）反复切换；频繁编辑；看刷新瞬间是否闪空态、内容是否正确无陈旧"
        status: pending
    human_judgment: true

# Metrics
duration: 14min
completed: 2026-10-14
status: complete
---

# Phase 2 Plan 32: 刷新原地更新 + 表格记忆化（P26）Summary

**把「每次刷新都先把整张表卸掉（切成空态）再整棵重建」改成内容没变就地复用现有节点、内容变了才按 key 更新；再给表格加整表记忆化与稳定回调身份，使内容未变的刷新直接跳过整表重渲染。**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-10-14T12:51Z
- **Completed:** 2026-10-14T13:05Z
- **Tasks:** 2
- **Files created/modified:** 3

## Accomplishments

- **刷新改为原地更新（`TablePanel.refresh`）**：原来每次刷新开头都 `publish(Loading, [])`，`TableGrid` 在非 Ready 态只渲染状态块、不渲染任何行，于是约 100 行 DOM 每个刷新周期都被卸载再由 `applyLoaded` / `applySchemaLoaded` 重挂——正是剖析里的元素挂载开销。现在只有「本栏尚无就绪行树」（首载、失败重试）才发加载态；已有内容时**不切状态**，直接读资源并就地更新。首载 / 空 / 错误 / 未设目标四种状态语义与文案完全不变。
- **换表才清树（`TablePanel.setTable`）**：换到另一张目标表（或此前无目标）时先清掉旧表行树，避免新表加载期间继续显示旧表内容；同一目标重复设置不清，保持原地更新。
- **整表记忆化（`TableGrid`）**：`React.memo` 包裹表格组件（导出名仍为 `TableGrid`，`ITableGridProps` 形状不变，`createElement(TableGrid, props)` 的既有用法不受影响）；Ready 分支的行元素列表由 `useMemo` 记忆化，依赖为 `props.rows` / `mode` / `schemaMode` / 各回调——这些依赖引用未变时返回**同一批元素**，React 直接跳过该子树，`buildSchemaPresentation` 也随之只在依赖变化时计算。
- **稳定回调身份（`TableColumn`）**：各栏把绑定本栏序号的回调改用 `useCallback` 创建，依赖取来自视图根、本身稳定的 props 字段；这样某栏状态未实质变化时 `React.memo(TableGrid)` 的浅比较命中，整表重渲染被跳过。
- 未改任何对外导出类型 / 成员的形状；未新增依赖；未使用 `import type`；无连续 `as`；无函数内局部函数。

## Task Commits

Each task was committed atomically:

1. **Task 1: 刷新原地更新、不再整树重挂（P26，tracer）** - `08da4e9` (fix)
2. **Task 2: 网格 + 行元素列表记忆化、回调身份稳定（P26）** - `aa84b67` (perf)

**Plan metadata:** 见本 SUMMARY 的最终文档提交

## Files Created/Modified

- `packages/libs/editor-impl/src/table/tablePanel.ts` - `TablePanel.refresh` 原地更新（仅首载 / 失败重试发加载态）；`TablePanel.setTable` 换目标时清旧行树；`TableColumn` 各回调改用 `useCallback`；导入补 `useCallback`。
- `packages/libs/editor-impl/src/table/components/TableGrid.tsx` - `React.memo` 包裹表格；Ready 分支行元素列表 `useMemo`；导入补 `memo` / `useMemo`。
- `packages/libs/editor-impl/src/table/__tests__/refreshIdentity.uat.test.tsx`（新）- 5 条用例：同内容刷新行节点身份不变 / 同内容刷新输入控件身份不变 / 内容变更仍更新 / 未受影响行不重挂 / 首载仍显示加载态。

## Decisions Made

- **「已有内容」判定**用既有视图状态 `status === Ready && rows.length > 0`，不新增状态字段；四种固定状态的语义与文案一字不变。
- **清旧行树的时机放在 `setTable`**：只有换到另一张 `data.id` 的表才需要清，刷新本身不该清；判定用 `previous === null || previous.data.id !== target.data.id`。
- **错误路径保持原样**（`publish(Error, [])`），按禁令不改失败路径行为。
- **回调依赖取具体 props 字段**（`props.onRetry` / `props.columnIndex` / …）而非整个 `props`：`props` 对象每次渲染都是新引用，作为依赖会让 `useCallback` 每次都重建，记忆化失效。
- **行元素列表在 `TableGrid` 内记忆化**而非对每行做 `React.memo`：`TableRow` 收到每次都新建的 `gutter` 元素、`GapRow` 收到每次都新建的 `children` 数组，per-row `React.memo` 的浅比较必然失败；要在行元素列表这一层返回同一批元素，等效且无需改 `ITableRowProps` / `IGapRowProps`。

## Deviations from Plan

### Note (non-behavioral): 7 条新增 `react-hooks-better-stable/exhaustive-deps` 警告

- **Found during:** Task 2（`TableColumn` 改用 `useCallback` 时）
- **Issue:** 按计划以 `props.onRetry` / `props.columnIndex` 等具体字段为依赖，`react-hooks-better-stable/exhaustive-deps` 会对「回调体内引用 `props` 却未把 `props` 列入依赖」各给一条 warning。
- **说明:** 若把整个 `props` 列入依赖，则 `props` 每次渲染都是新引用 → 回调每次都重建 → `React.memo(TableGrid)` 永不命中，与本计划目标相悖；而仓库 `dev.md` 代码风格又明确禁止「把对象上的函数赋给临时变量/常量」（即禁止解构出回调）。两者冲突下按计划保留具体字段依赖。
- **结果:** 仅为 warning（`eslint` 退出码 0、0 error），与仓库既有的同类依赖提示一致，不阻断任何门禁或测试。
- **Files:** `packages/libs/editor-impl/src/table/tablePanel.ts`（仅警告）
- **Committed in:** `aa84b67`

---

**Total deviations:** 0 行为偏差；1 条按计划保留的 lint 警告说明（非行为、非阻断）。
**Impact on plan:** 无；P26 全部 must_haves 达成。

## Issues Encountered

- 无阻塞。既有用例（switchRefresh / tracer / edit / panelSync 等）在改动后全部仍绿：`refresh` 对首载仍发加载态（tracer 的「资源尚未返回时显示加载态」通过），`switchRefresh` 的外部写盘后切回仍重请求并更新，`edit.test.tsx` 直接 `createElement(TableGrid, props)` 的用法在 memo 包裹后照常可用。

## Verification

- `pnpm --filter @motajs/editor-impl test -- __tests__/refreshIdentity.uat.test.tsx` → 退出 0（5 passed）
- `pnpm --filter @motajs/editor-impl test` → 退出 0（20 files / 161 tests passed）
- `pnpm --filter @motajs/editor-impl typecheck` → 退出 0
- `pnpm --filter @motajs/editor-core test` → 退出 0（9 files / 70 tests passed）
- 四个门禁脚本（串行）均退出 0：`coreImportType.js`（94 文件，0 条 import type）/ `coreEngineNeutral.js`（62 生产文件，0 条引擎标识）/ `coreModuleState.js`（真实树 0 条 error 级受限规则；`memo(...)` 为 CallExpression，未触发模块级 const 容器规则）/ `coreFsSurface.js`（94 文件，`IEditorFileSystem` 仅声明文件）
- `prettier --check` 三个改动文件 → 全通过；`eslint` 三个改动文件 → 0 error（13 warning，其中 7 条为本计划按计划保留的依赖提示）

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- P26 代码侧完成；新增命名仅测试文件名 `refreshIdentity.uat.test.tsx`（已获用户确认）。
- 待 `verify-work` 对 P26 做最终人工确认（开 3 个面板切换 / 频繁编辑不再明显卡顿；刷新瞬间不再闪空态；内容变更后显示正确无陈旧）。

---

*Phase: 02-table*
*Completed: 2026-10-14*

## Self-Check: PASSED

- FOUND: `packages/libs/editor-impl/src/table/tablePanel.ts`
- FOUND: `packages/libs/editor-impl/src/table/components/TableGrid.tsx`
- FOUND: `packages/libs/editor-impl/src/table/__tests__/refreshIdentity.uat.test.tsx`
- FOUND: `.planning/phases/02-table/02-32-SUMMARY.md`
- FOUND commit: `08da4e9` (Task 1)
- FOUND commit: `aa84b67` (Task 2)
