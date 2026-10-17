---
phase: 03-asset
plan: 04
subsystem: editor-core
tags: [undo, barrier, hooks, behavior, tests]

# Dependency graph
requires:
  - phase: 03-asset
    plan: 01
    provides: "IUndoContext.barrier marker, IUndoSystemHooks.onUndoBlocked, boolean undo/redo returns, Hookable controller factory"
provides:
  - "UndoSystem.undo barrier branch: stop, return false, dispatch onUndoBlocked, never pop or push"
  - "Six failing-first cases pinning barrier semantics in editor-core"
affects: [03-asset]

# Actuals (#2632) — chars/4 over the realized diff, not a harness token count.
actuals:
  tokens: 834
  tasks: 2
  commits: 2
  plan_head_before: 1319d06794c17c0e5e1df7bcb9cbdc3088bac75a

tech-stack:
  added: []
  patterns:
    - "Barrier is read from the undo context itself (IUndoContext.barrier), so every capability gets the same guard without per-capability code"

key-files:
  created: []
  modified:
    - packages/libs/editor-core/src/undo/undoSystem.ts
    - packages/libs/editor-core/src/undo/__tests__/undoSystem.test.ts

key-decisions:
  - "The barrier branch returns before touching either stack, so a blocked undo leaves history exactly as it was and can be retried"
  - "onUndoBlocked is dispatched through Hookable.forEachHook, reusing the same notify path as ResourceSystem instead of a new channel"
  - "No UI copy in core: the branch carries no message; the 「无法撤销」 wording stays in the asset constants"
  - "redo() needed no barrier check because a barrier is never pushed onto the redo stack"

patterns-established:
  - "UndoSystem.undo treats a barrier as an early return, mirroring the stack-empty guard above it"

requirements-completed: [ASSET-01]

coverage:
  - id: D1
    description: "Undo stops at a barrier entry, reports false, notifies subscribers, and keeps history intact"
    requirement: "ASSET-01"
    verification:
      - kind: unit
        ref: "packages/libs/editor-core/src/undo/__tests__/undoSystem.test.ts"
        status: pass
      - kind: automated_ui
        ref: "pnpm --filter @motajs/editor-core typecheck"
        status: pass
    human_judgment: false
  - id: D2
    description: "Barrier semantics are pinned by six cases: blocked twice, entries above still undo, hook fires once, no-subscriber safety, redo stays false"
    requirement: "ASSET-01"
    verification:
      - kind: unit
        ref: "pnpm --filter @motajs/editor-core test (94/94)"
        status: pass
      - kind: automated_ui
        ref: "node scripts/verify/coreModuleState.js / node scripts/verify/coreEngineNeutral.js"
        status: pass
    human_judgment: false

duration: ~5min
completed: 2026-10-17
status: complete
---

# Phase 3 Plan 04: editor-core 撤销屏障行为 Summary

**谁都不能跳过素材那道“不可撤销”的墙：撤销一碰到它，就停住、回报「没撤成」、通知界面，而墙本身留在原处不动。**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-10-17T22:16:04Z
- **Completed:** 2026-10-17T22:19:30Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `UndoSystem.undo` 在取栈顶条目后先看 `entry.context.barrier === true`：命中就不调用记录的 `undo`、不 `pop`、不碰重做栈，改为 `this.forEachHook((hook) => hook.onUndoBlocked?.())` 并返回 `false`；未命中照旧（调用 → `pop` → 入重做栈 → 返回 `true`）。
- `UndoSystem.redo` 无需判定：屏障从不被弹出，自然不会出现在重做栈里，现有的「栈空返回 `false`，否则执行并返回 `true`」已经正确。
- 新增 `describe('UndoSystem 撤销屏障', ...)`，6 条用例分别钉住：栈顶屏障返回 `false` 且不调用记录、连撤两次仍被挡住、屏障之上的记录可撤销且撤到屏障即停、`onUndoBlocked` 恰好触发一次、无订阅者时不抛错、命中屏障后 `redo()` 返回 `false`。
- 文案不进 core：`undoSystem.ts` 不含任何中文字面量，提示语仍归 `asset` 的 `UNDO_BLOCKED_MESSAGE`。

## Task Commits

Each task was committed atomically:

1. **Task 1: 屏障判定与通知触发** - `17074ac` (feat)
2. **Task 2: 屏障与钩子的可失败用例** - `6d721d1` (test)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `packages/libs/editor-core/src/undo/undoSystem.ts` - `undo()` 增加屏障提前返回分支与 `onUndoBlocked` 派发（+5 行）
- `packages/libs/editor-core/src/undo/__tests__/undoSystem.test.ts` - 新增 `UndoSystem 撤销屏障` describe，6 条用例（+88 行）

## Decisions Made

- 屏障分支在触碰两栈之前返回，因此被挡住的撤销不会改变历史，可原样重试。
- 复用 `Hookable.forEachHook` 派发通知，与 `ResourceSystem` 的写法一致，不新造通路。
- `redo()` 不加屏障判断——屏障不进重做栈，加了也是死代码。

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `.git/gsd-plan-head-before-03-04` 里遗留了上一次运行（2026-09-23）的陈旧基线 `82fd87a`，已重置为本次执行前的 HEAD `1319d06`，以保证 commit 计数与 `/gsd-verify-work` 的同尺校验准确（与 03-01 同类问题）。

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- core 的屏障语义闭环：后续 `asset` 能力只要在字节改动处压入带 `barrier: true` 的上下文，撤销就会被无条件挡住。
- 界面侧仍需自行订阅 `onUndoBlocked` 并展示 `UNDO_BLOCKED_MESSAGE`（属后续能力层计划）。

---

*Phase: 03-asset*
*Completed: 2026-10-17*

## Self-Check: PASSED

- FOUND: packages/libs/editor-core/src/undo/undoSystem.ts
- FOUND: packages/libs/editor-core/src/undo/__tests__/undoSystem.test.ts
- FOUND: commit 17074ac (Task 1)
- FOUND: commit 6d721d1 (Task 2)
- PASS: `pnpm --filter @motajs/editor-core test -- undo/__tests__/undoSystem.test.ts` (16/16)
- PASS: `pnpm --filter @motajs/editor-core test` (94/94)
- PASS: `pnpm --filter @motajs/editor-core typecheck` (exit 0)
- PASS: `node scripts/verify/coreModuleState.js` (exit 0)
- PASS: `node scripts/verify/coreEngineNeutral.js` (exit 0)
- PASS: no 「无法撤销」 string under `packages/libs/editor-core/src` (grep clean)
