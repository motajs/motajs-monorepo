---
phase: 03-asset
plan: 01
subsystem: editor-core
tags: [undo, resource, panel, contract, interface-only, barrier, binary-read]

# Dependency graph
requires:
  - phase: 02.1-resource-layer
    provides: path-identifier resource API, project file index, LRU content cache, injected IEditorFileSystem
provides:
  - "IUndoContext.barrier (optional readonly marker)"
  - "IUndoSystemHooks + IUndoSystemHooks.onUndoBlocked"
  - "IUndoSystem extends IHookable<IUndoSystemHooks>; undo/redo return Promise<boolean>"
  - "IResource.requestBinary / IResourceStore.readBinary"
  - "IEditorPanelContext.moveResource"
affects: [03-asset, 03-04]

# Actuals (#2632) — chars/4 over the realized diff, not a harness token count.
actuals:
  tokens: 1762
  tasks: 2
  commits: 2
  plan_head_before: 572912c33ddb01ee812fc25a3fd11a49c7de0856

tech-stack:
  added: []
  patterns:
    - "Declare-contract-now / implement-behavior-later split: types extended with minimal pass-throughs, barrier semantics deferred to 03-04"

key-files:
  created: []
  modified:
    - packages/libs/editor-core/src/undo/types.ts
    - packages/libs/editor-core/src/undo/undoSystem.ts
    - packages/libs/editor-core/src/undo/__tests__/undoSystem.test.ts
    - packages/libs/editor-core/src/resource/types.ts
    - packages/libs/editor-core/src/resource/resource.ts
    - packages/libs/editor-core/src/panel/types.ts
    - packages/libs/editor-core/src/panel/panelContext.ts

key-decisions:
  - "Barrier is declared only: IUndoContext.barrier exists but UndoSystem does NOT read it or dispatch onUndoBlocked — that behavior is 03-04"
  - "undo()/redo() return boolean via a stack-empty check only (false when no entry); no other behavior change"
  - "IUndoSystem reuses the existing core hook mechanism (extends IHookable<IUndoSystemHooks>) rather than inventing a new notify path"
  - "readBinary/moveResource are contract-only additions; ResourceSystem already implemented readBinary with the exact signature, so no implementation change was needed there"

patterns-established:
  - "UndoSystem: class extends Hookable<Hooks> implements Interface with protected createController(hook) => new HookController(this, hook), mirroring ResourceSystem"

requirements-completed: [ASSET-01]

coverage:
  - id: D1
    description: "editor-core undo contract reports success/failure and exposes a barrier marker + onUndoBlocked hook"
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
    description: "editor-core resource/panel contracts gain raw-byte read (requestBinary/readBinary) and file move (moveResource)"
    requirement: "ASSET-01"
    verification:
      - kind: automated_ui
        ref: "pnpm --filter @motajs/editor-core typecheck"
        status: pass
      - kind: unit
        ref: "pnpm --filter @motajs/editor-core test"
        status: pass
    human_judgment: false

duration: ~10min
completed: 2026-10-17
status: complete
---

# Phase 3 Plan 01: editor-core 素材契约（撤销屏障 / 布尔返回 / 二进制读取 / 面板移动） Summary

**editor-core 的撤销、资源、面板三处契约先行落定：撤销可报成败、可挂屏障标记与通知钩子，资源能按二进制读、面板能改名移动文件——只改契约声明与维持编译所需的直通，屏障判定留给 03-04。**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-10-17T20:48:00Z
- **Completed:** 2026-10-17T20:57:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- 撤销契约：`IUndoContext` 增加可选 `barrier` 标记；新增 `IUndoSystemHooks`（含 `onUndoBlocked`）；`IUndoSystem extends IHookable<IUndoSystemHooks>`；`undo()` / `redo()` 返回类型改为 `Promise<boolean>`。
- `UndoSystem` 改为 `extends Hookable<IUndoSystemHooks> implements IUndoSystem` 并实现 `createController`；`undo`/`redo` 仅以「栈空返回 `false`，否则照旧执行并返回 `true`」满足新返回类型，**未**读取 `barrier`、**未**派发 `onUndoBlocked`（属 03-04）。
- 资源契约：`IResourceStore.readBinary` 与 `IResource.requestBinary`（读原始字节）；`Resource.requestBinary` 一行转发到 `store.readBinary`。`ResourceSystem.readBinary` 已存在同签名实现，无需改动。
- 面板契约：`IEditorPanelContext.moveResource`；`PanelContext.moveResource` 一行转发到 `resourceAccess.moveResource`。
- 既有 undo 空操作断言随返回类型更新（`toBeUndefined` → `toBe(false)`），core 整包测试与 typecheck 全绿。

## Task Commits

Each task was committed atomically:

1. **Task 1: 撤销契约——屏障标记、布尔返回、通知钩子** - `2f8f531` (feat)
2. **Task 2: 资源与面板契约——原始字节读取、文件移动** - `d7fbedd` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `packages/libs/editor-core/src/undo/types.ts` - 增加 `barrier`、`IUndoSystemHooks`、`IUndoSystem` 继承 `IHookable`、`undo`/`redo` 返回 `Promise<boolean>`
- `packages/libs/editor-core/src/undo/undoSystem.ts` - `UndoSystem extends Hookable<IUndoSystemHooks>`；`undo`/`redo` 返回布尔
- `packages/libs/editor-core/src/undo/__tests__/undoSystem.test.ts` - 两处空栈断言改为 `toBe(false)`
- `packages/libs/editor-core/src/resource/types.ts` - `IResource.requestBinary`、`IResourceStore.readBinary`
- `packages/libs/editor-core/src/resource/resource.ts` - `Resource.requestBinary` 转发
- `packages/libs/editor-core/src/panel/types.ts` - `IEditorPanelContext.moveResource`
- `packages/libs/editor-core/src/panel/panelContext.ts` - `PanelContext.moveResource` 转发

## Decisions Made

- 屏障只声明、不实现：`barrier` 与 `onUndoBlocked` 是 03-04 的行为实现，本计划只提供契约。
- `IUndoSystem` 复用 core 既有 `IHookable` 机制，避免新造通知通路。
- `ResourceSystem` 无需改动——`readBinary` 实现早已在位，本计划仅把它补进 `IResourceStore` 契约。

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

(备注：`.git/gsd-plan-head-before-03-01` 中遗留了上一次运行的陈旧基线，已重置为本次执行前的 HEAD `572912c`，以保证 commit 计数准确。)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- core 三处契约就绪，03-04（撤销屏障行为实现）与 03-02/03-03（`shared` 落位、asset 域类型）可据此展开。
- 未实现的部分（屏障判定、`onUndoBlocked` 派发）在本计划范围之外，按计划归属 03-04。

---
*Phase: 03-asset*
*Completed: 2026-10-17*

## Self-Check: PASSED

- FOUND: packages/libs/editor-core/src/undo/types.ts
- FOUND: packages/libs/editor-core/src/undo/undoSystem.ts
- FOUND: packages/libs/editor-core/src/undo/__tests__/undoSystem.test.ts
- FOUND: packages/libs/editor-core/src/resource/types.ts
- FOUND: packages/libs/editor-core/src/resource/resource.ts
- FOUND: packages/libs/editor-core/src/panel/types.ts
- FOUND: packages/libs/editor-core/src/panel/panelContext.ts
- FOUND: commit 2f8f531 (Task 1)
- FOUND: commit d7fbedd (Task 2)
- PASS: `pnpm --filter @motajs/editor-core typecheck` (exit 0)
- PASS: `pnpm --filter @motajs/editor-core test -- undo/__tests__/undoSystem.test.ts` (10/10)
- PASS: `pnpm --filter @motajs/editor-core test` (88/88)
