---
phase: 02-table
plan: 16
subsystem: editor-dev
tags: [react, capability-injection, table-panel, iTablePanelOpener, dev-host, uat-fix]

# Dependency graph
requires:
  - phase: 02-table
    provides: "02-13 交付的 dev 宿主表格接入（tableDemo、openTableDemoPanel、MemoryBackend 装配）；02-14 的 setTable(target, columnIndex?) 类型；02-11/02-12 的外壳打开参数路径（openPanelInTab 第三参 + tablePanelType.create 收窄 target）"
provides:
  - "dev 宿主实现并注入 ITablePanelOpener（createTablePanelOpener），使表格工具栏「编辑 Schema」按钮由禁用变为可用"
  - "「编辑 Schema」点击后按 D-06 新开一个表格面板，目标为 table#schema.<name>，一打开即 schema 视图"
  - "端到端测试钉住「按钮可用 + 打开 schema 面板」两条路径"
affects: [02-17, 02-18, 02-19, verify-work, UAT]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 840
  tasks: 2
  commits: 2
  plan_head_before: 29209d399b138d03d20a8da57c4edf458d2d2619

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "dev 组合根把 ITablePanelOpener 实现为 createTablePanelOpener(core)：开空白标签 + 带 param 开表格面板类型，经 CapabilityProvider.capabilities.tablePanel 注入"
    - "打开器只透传 param，不自行收窄 target；收窄由 tablePanelType.create 的 isTablePanelTarget 承担（与 openTableDemoPanel 同一路径）"

key-files:
  created: []
  modified:
    - packages/apps/editor-dev/src/demo/tableDemo.ts
    - packages/apps/editor-dev/src/main.tsx
    - packages/apps/editor-dev/src/__tests__/devHostTable.test.tsx

key-decisions:
  - "打开器实现为主.tsx/main.tsx 同一路径的通用化：createTablePanelOpener(core) 收下 param 而非固定 demo 目标；保留既有 openTableDemoPanel（固定 demo 目标的便捷入口）不动"
  - "打开器不读 / 不收窄 param.target——tablePanelType.create 已在构造时收窄并 setTable（02-12），打开器只负责开标签与开面板，无实例捕获、无新 API"
  - "dev-only 边界保持：editor-dev 仍 private: true，无任何产品包引用它；未新增依赖"

patterns-established:
  - "能力注入端到端验收：测试用与 main.tsx 相同的 CapabilityProvider 接线（注入 createTablePanelOpener）包裹外壳渲染根，再断言按钮可用与新面板 schema 视图"

requirements-completed: [TABLE-01]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "dev 宿主实现 ITablePanelOpener 并经 capabilities.tablePanel 注入，「编辑 Schema」按钮由禁用变为可用"
    requirement: TABLE-01
    verification:
      - kind: e2e
        ref: "packages/apps/editor-dev/src/__tests__/devHostTable.test.tsx#注入表格打开器后「编辑 Schema」按钮可用"
        status: pass
    human_judgment: false
  - id: D2
    description: "点击「编辑 Schema」按 D-06 新开一个表格面板，目标为 table#schema.demo，一打开即渲染 schema 视图（提示条）"
    requirement: TABLE-01
    verification:
      - kind: e2e
        ref: "packages/apps/editor-dev/src/__tests__/devHostTable.test.tsx#点击「编辑 Schema」新开 schema 视图面板"
        status: pass
    human_judgment: false
  - id: D3
    description: "新增命名 createTablePanelOpener 照此定案（重要命名先确认门禁）"
    requirement: TABLE-01
    verification:
      - kind: other
        ref: "用户于 2026-10-13 以「可以执行」批准，并确认新名称为 createTablePanelOpener"
        status: pass
    human_judgment: false

# Metrics
duration: 10min
completed: 2026-10-13
status: complete
---

# Phase 2 Plan 16: dev 宿主注入表格面板打开器（B6）Summary

**开发宿主实现并注入表格面板打开器 createTablePanelOpener，使工具栏「编辑 Schema」按钮可用，点击后按 D-06 新开一个指向 table#schema.<名> 的 schema 视图面板**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-10-13T11:04:02Z
- **Completed:** 2026-10-13T11:13:34Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- dev 宿主新增 `createTablePanelOpener(core)`：开空白标签 → 带打开参数打开表格面板类型，满足 `ITablePanelOpener`。
- `main.tsx` 经 `CapabilityProvider.capabilities.tablePanel` 注入打开器，`TableGrid` 的 `schemaButtonEnabled` 判据满足，按钮由禁用变为可用。
- 端到端测试断言「按钮存在且未禁用」与「点击后新开标签、一打开即渲染 schema 提示条（目标 table#schema.demo）」。
- 打开器复用既有打开参数路径与 `tablePanelType`，无实例捕获、无「按 instanceId 取回实例」新 API，未改 `IShellSystem`。

## Task Commits

Each task was committed atomically:

1. **Task 1: dev 宿主实现并注入表格面板打开器（B6，端到端）** - `8ac45bf` (feat)
2. **Task 2: 「编辑 Schema」可用并打开 schema 面板的端到端测试** - `4b067bc` (test)

**Plan metadata:** (this docs commit)

## Files Created/Modified
- `packages/apps/editor-dev/src/demo/tableDemo.ts` - 新增并导出 `createTablePanelOpener(core): ITablePanelOpener`；保留 `openTableDemoPanel` 不变。
- `packages/apps/editor-dev/src/main.tsx` - 从 `./demo/tableDemo` 追加引入打开器，渲染根注入 `capabilities: { tablePanel: createTablePanelOpener(core) }`。
- `packages/apps/editor-dev/src/__tests__/devHostTable.test.tsx` - 新增「按钮可用」「点击打开 schema 面板」两个用例；新增 `renderWithTableOpener` 与 `numberValue` helper；修正过期数字字段断言。

## Decisions Made
- 打开器是既有 `openTableDemoPanel` 的通用化（收下 `param` 而非固定 demo 目标）；保留 `openTableDemoPanel` 不动，避免改动其既有行为。
- 打开器只走「开空白标签 + 带 param 开表格面板类型」；不自行收窄 / 读取 `param.target`——收窄由 `tablePanelType.create` 的 `isTablePanelTarget` 完成，`param` 畸形时落回 `NoTarget`（无 `as` 断言）。
- 新增命名 `createTablePanelOpener` 按用户确认定案，已登记 `INTERFACE-NAME.md`「Plan 15–19」。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 修正 02-15 数字字段改渲染 InputNumber 后遗留的过期断言**
- **Found during:** Task 2（「编辑 Schema」端到端测试）
- **Issue:** `devHostTable.test.tsx` 既有用例「经打开参数打开 demo 表格并渲染 schema 驱动行」用 `inputValue`（只读 `textarea`）断言数字字段 `level` / `position-x` / `position-y`。02-15 已把数字字段改渲染 antd `InputNumber`（`<input>`），该断言读取到 `undefined`。经在 HEAD（未含本次改动）上单独运行确认：该用例在本次改动前即为红，属 02-15 遗留、非本计划引入。
- **Fix:** 新增 `numberValue(container, field)` helper 读取单元格内 `<input>` 的值，数字字段断言改用之；字符串字段 `title` 仍用 `inputValue`。
- **Files modified:** `packages/apps/editor-dev/src/__tests__/devHostTable.test.tsx`
- **Verification:** `pnpm --filter @motajs/editor-dev test` 退出 0（7 个用例全绿）。
- **Committed in:** `4b067bc`（Task 2 commit）

---

**Total deviations:** 1 auto-fixed (Rule 1)
**Impact on plan:** 该修复是本计划「dev 宿主 test 全绿」验收的前置条件，且落在本计划 `files_modified` 声明的文件内；属过期断言修正，无行为 / 范围扩张。

## Issues Encountered
- 初次运行 `pnpm --filter @motajs/editor-dev test` 时一个既有用例失败；经在 HEAD（stash 禁止，改用单文件备份 / `git checkout HEAD -- <file>` / 还原）上单独运行确认其为 02-15 遗留的过期断言，随后按上表 Rule 1 修正。

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- B6 已修复：dev 宿主「编辑 Schema」端到端可用，为 02-17 / 02-18 / 02-19 的布局、标题与交互修复提供可观察入口。
- editor-dev 保持 dev-only（`private: true`、无产品包引用），未新增依赖，typecheck / test / 四条验证脚本 / Prettier 全绿。

---
*Phase: 02-table*
*Completed: 2026-10-13*

## Self-Check: PASSED

- FOUND: packages/apps/editor-dev/src/demo/tableDemo.ts
- FOUND: packages/apps/editor-dev/src/main.tsx
- FOUND: packages/apps/editor-dev/src/__tests__/devHostTable.test.tsx
- FOUND: .planning/phases/02-table/02-16-SUMMARY.md
- FOUND commit: 8ac45bf
- FOUND commit: 4b067bc
