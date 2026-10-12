---
phase: 02-table
plan: 05
subsystem: editor-core
tags: [shell, tabs, panel-hooks, onSwitchIn, onSwitchOut, d-15, vitest, jsdom, editor-core]

# Dependency graph
requires:
  - phase: 01-shell
    provides: "editor-core 外壳的标签状态机（ShellSystem.activateTab / openPanelInTab / openBlankTab / closeTab）与面板钩子契约（IEditorPanel.onSwitchIn / onSwitchOut）"
provides:
  - "活动面板变化时外壳对离开者调用 onSwitchOut()、对进入者调用 onSwitchIn()（D-15 修订版 / D-31）"
  - "面板可据此在被切入时重新请求数据 / schema 资源，无需跨面板实时广播"
affects: [02-08, 02-10]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# tokens = chars/4 over the realized diff (git diff ${plan_head_before}..HEAD)
actuals:
  tokens: 3100
  tasks: 1
  commits: 1
  plan_head_before: 1dbba232c76b1ec355a4340dd66f27a394b50ad0

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "外壳用一个实例字段 lastActiveInstanceId 记录最近一次已投递切入通知的面板实例；凡改变活动面板的操作（activateTab / openPanelInTab / openBlankTab / closeTab 切邻）都调用同一私有方法 syncActiveInstance 对齐状态"
    - "切换钩子 fire-and-forget（void）且被 try/catch 隔离，单个面板抛错只记 shell.callbackFailed、不中断标签状态机（T-02-08）"
    - "目标面板仍在初始化时不投递切入，待 initializeInstance 置 Ready 后再次对齐；与既有未初始化实例排队方式一致"

key-files:
  created:
    - "packages/libs/editor-core/src/shell/__tests__/shellSwitch.test.ts"
  modified:
    - "packages/libs/editor-core/src/shell/shellSystem.ts"

key-decisions:
  - "以实例字段 lastActiveInstanceId 判定活动面板是否真正变化：避免对同一面板重复投递切入、避免不必要的切出"
  - "closeTab / openPanelInTab 会销毁旧面板时，先调用 onSwitchOut() 再 dispose()，使被销毁的面板仍能收到「切出」（Task 1 的显式要求）"
  - "关闭非活动标签不产生活动面板变化，故不触发任何切换钩子（用测试钉住）"
  - "复用既有日志 id shell.callbackFailed 记录钩子抛错，不新增消息也不改契约（IEditorPanelContext.updateResource 不引入）"

patterns-established:
  - "活动面板同步：所有改变活动标签的路径汇聚到一个私有同步方法，钩子投递与标签状态机解耦"
  - "回调隔离：面板提供的钩子一律 try/catch + logger.error，单个面板失败不外溢"

requirements-completed: [TABLE-01]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "外壳在活动面板变化时对离开的面板调用 onSwitchOut、对进入的面板调用 onSwitchIn（含关闭活动标签切邻、关闭非活动标签不触发）"
    requirement: "TABLE-01"
    verification:
      - kind: unit
        ref: "packages/libs/editor-core/src/shell/__tests__/shellSwitch.test.ts#切换活动标签时通知离开与进入的面板"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-core/src/shell/__tests__/shellSwitch.test.ts#关闭活动标签时切出被销毁面板并切入相邻面板"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-core/src/shell/__tests__/shellSwitch.test.ts#关闭非活动标签不触发切换钩子"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-core/src/shell/__tests__/shellSwitch.test.ts#切入钩子抛错时外壳仍完成切换"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-10-12
status: complete
---

# Phase 2 Plan 05: 外壳在切换标签时调用 onSwitchIn / onSwitchOut Summary

**外壳在活动面板变化时通知离开 / 进入的面板：切入的面板因此可以重新请求数据与 schema，实现「切入时刷新」，取代原先设想但已取消的跨面板实时广播**

## Performance

- **Duration:** 12 min
- **Started:** 2026-10-12T15:22:29Z
- **Completed:** 2026-10-12T15:34:00Z
- **Tasks:** 1
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- `ShellSystem` 现在在活动面板变化时调用 `IEditorPanel.onSwitchOut()`（离开）与 `IEditorPanel.onSwitchIn()`（进入）；触发点覆盖 `activateTab`、`openPanelInTab`、`openBlankTab`，以及 `closeTab` 关闭活动标签后切到相邻标签。
- 关闭标签时对将被销毁的活动面板**先** `onSwitchOut()`、**再** `dispose()`；关闭非活动标签不触发任何切换钩子。
- 切换钩子失败被隔离：单个面板在 `onSwitchIn` 抛错不影响标签状态机，只经既有 `logger` 记 `shell.callbackFailed`（缓解 T-02-08）。
- 未引入 `IEditorPanelContext.updateResource` 广播接缝，也未引入模块级可变状态；既有方法返回值与默认路径不变，editor-core 既有 54 个测试保持全绿。

## Task Commits

Each task was committed atomically:

1. **Task 1: 在活动面板变化时调用 onSwitchIn / onSwitchOut** - `ea25385` (feat)

**Plan metadata:** (docs commit — see final commit)

## Files Created/Modified

- `packages/libs/editor-core/src/shell/shellSystem.ts` - 新增实例字段 `lastActiveInstanceId`；在四条改变活动面板的路径上调用 `syncActiveInstance`；新增私有方法 `activeInstanceId` / `leaveActiveInstance` / `syncActiveInstance` / `invokeSwitchIn` / `invokeSwitchOut`。
- `packages/libs/editor-core/src/shell/__tests__/shellSwitch.test.ts` - 记录切换钩子调用的假面板 + 4 个用例（切入 / 切出、关闭活动标签切邻、关闭非活动标签不触发、切入抛错隔离）。

## Decisions Made

- 用实例字段 `lastActiveInstanceId` 判定「活动面板是否真正变化」，避免对同一面板重复投递切入或多余切出。
- `closeTab` / `openPanelInTab` 在销毁旧面板前，若该面板正活动则先切出再销毁，保证被销毁的面板也能收到切出通知。
- 关闭非活动标签不算活动面板变化，因此不触发钩子。
- 复用既有日志 id `shell.callbackFailed`，不新增消息、不改面板契约。

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. 既有 `shellSystem.test.ts`（26 个用例）与其余 editor-core 测试在新行为下全部保持通过，证明「对不关心这两个钩子的既有调用者行为不变」。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 表格面板（02-04 已实现 `TablePanel.onSwitchIn` 重取数据与 schema）现在可由外壳在切入时自动触发；02-08 的「切入时刷新」可在 schema 呈现模式下顺此链路重算。
- 既有 `updateResource` 广播接缝不再需要（D-31 已取消）。
- 无阻塞项。

---

**Verification evidence**

- `pnpm --filter @motajs/editor-core typecheck` → exit 0
- `pnpm --filter @motajs/editor-core test` → exit 0（6 个测试文件、58 个用例全绿；其中新 `shellSwitch.test.ts` 4 个用例、既有 `shellSystem.test.ts` 26 个用例）
- `node scripts/verify/coreImportType.js` → exit 0
- `node scripts/verify/coreEngineNeutral.js` → exit 0
- `node scripts/verify/coreModuleState.js` → exit 0（真实树 lint 0 条 error 级受限规则）
- `node scripts/verify/coreFsSurface.js` → exit 0
- 四个门禁脚本按要求**串行**运行。

## Self-Check: PASSED

---
*Phase: 02-table*
*Completed: 2026-10-12*
