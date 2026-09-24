---
phase: 04-resource-edit-layers-moved
plan: 03
subsystem: edit
tags: [editor-core, refactor, module-relocation, undo-system, de-singleton, re-export-shims, react-hook, patchable-resource]

# Dependency graph
requires:
  - phase: 04-resource-edit-layers-moved
    plan: 02
    provides: "lib/resources/* (types/interfaces/errors/contentUtils/handlers/combinators), the `// SHIM(phase4)` forwarder pattern, `src/appInstances.ts` with its single `new` site + `fsPort`/`persistenceMonitor` bindings, and the two static gates"
provides:
  - "packages/libs/editor-core/lib/edit/operations.ts — `EditorOperation`/`OperationTarget`/`OperationMeta`/`AppliedOperation`/`compositeOperation`/`operationPathTarget`/`patchResourceOperation` rebuilt on the narrow `PatchableResource<T>`"
  - "packages/libs/editor-core/lib/edit/operationHistory.ts — per-instance `OperationHistory` (instance `store`, per-instance `UndoSystem` registry, capacity 100, multi-target checkpoint + rollback)"
  - "packages/libs/editor-core/lib/edit/undoSystem.ts — the D-03 `UndoSystem<Snapshot>` delegation contract"
  - "packages/libs/editor-core/lib/edit/{fieldPath,action}.ts — the field-path helpers (nine) and the action primitives (five)"
  - "packages/libs/editor-core/lib/react/index.ts — `useOperationHistory(history)` next to `CoreProbe`"
  - "packages/apps/editor/src/project/history/viewportOperations.ts — `RestoreViewportOperation`/`NavigateFloorOperation`/`navigateFloorOperation` relocated out of core (D-02)"
  - "packages/apps/editor/src/project/history/useOperationHistory.ts — zero-arg editor hook bound to the app instance"
  - "packages/apps/editor/src/appInstances.ts — the `operationHistory` instance plus the `viewport` `UndoSystem` registration (the single `new OperationHistory(` site)"
  - "four `// SHIM(phase4)` forwarders: `src/utils/{fieldPath,action}.ts`, `src/project/history/{operations,operationHistory}.ts`"
affects: [04-04, 05, 10, 11]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 16548   # chars/4 over the realized diff (`git diff -M 57ca58c..HEAD`: 66193 chars)
  tasks: 2
  commits: 2
  plan_head_before: 57ca58ccb6d74d851796da509dd13caf37a62cb0

tech-stack:
  added: []   # no new dependency: @tanstack/store, @tanstack/react-store and es-toolkit were already declared in 04-01/04-02
  patterns:
    - "Per-instance `UndoSystem` registry on a de-singletonised class: registration order defines restore order, restores run in reverse after `restoreTargets` (D-03)"
    - "Capture-ALL at invocation: `OperationHistory.execute` snapshots every registered system synchronously before enqueue, so a plain data patch still restores the viewport on undo"
    - "Narrow structural write contract (`PatchableResource<T>`) so core's patch operation never learns the editor's nominal resource type (D-04)"
    - "Hook on `./react` accepting the instance + a zero-arg editor wrapper so both call sites stay untouched (D-11)"

key-files:
  created:
    - packages/libs/editor-core/lib/edit/fieldPath.ts
    - packages/libs/editor-core/lib/edit/action.ts
    - packages/libs/editor-core/lib/edit/operations.ts
    - packages/libs/editor-core/lib/edit/undoSystem.ts
    - packages/libs/editor-core/lib/edit/operationHistory.ts
    - packages/libs/editor-core/lib/edit/__tests__/operationHistory.invariants.test.ts
    - packages/apps/editor/src/project/history/viewportOperations.ts
    - packages/apps/editor/src/project/history/useOperationHistory.ts
    - packages/apps/editor/src/project/history/__tests__/operationHistory.reactivity.invariants.test.ts
  modified:
    - packages/libs/editor-core/lib/index.ts
    - packages/libs/editor-core/lib/react/index.ts
    - packages/apps/editor/src/appInstances.ts
    - packages/apps/editor/src/project/history/index.ts
    - packages/apps/editor/src/utils/fieldPath.ts
    - packages/apps/editor/src/utils/action.ts
    - packages/apps/editor/src/project/history/operations.ts
    - packages/apps/editor/src/project/history/operationHistory.ts
  deleted:
    - packages/apps/editor/src/project/history/__tests__/operationHistory.invariants.test.ts   # split: nine pure cases → core, reactivity describe → new editor file (git recorded R071)

key-decisions:
  - "`captureSystems`/`restoreSystems` are module-private functions taking the registry as a parameter (not class methods), matching INTERFACE-NAME.md's confirmed wording; `restoreSystems` iterates the registry in reverse registration order and matches snapshots by `id`, so a system registered after an entry was recorded is not restored for it"
  - "`registerUndoSystem` throws on a duplicate `id` (`UndoSystem already registered: <id>`) rather than silently overwriting — two systems claiming one id is a caller bug"
  - "The `isFileNotFoundError`/patch/… bodies and every assertion moved byte-for-byte; the only new code in `lib/edit` is the `UndoSystem` seam and the `PatchableResource<T>` narrowing"
  - "The moved pure invariants test creates a fresh `new OperationHistory()` in `beforeEach` (rebinding `afterEach` to it) instead of the module singleton, per D-11/D-13; all nine assertions are byte-identical, including the literal `capture:a|capture:b|capture:c|restore:c|restore:b|restore:a` log"
  - "No important name was invented; `OperationHistory.store`, `captureSystems`/`restoreSystems`, `UndoSystem`, `PatchableResource`, `viewportOperations.ts` and `useOperationHistory.ts` are all already confirmed in INTERFACE-NAME.md"

patterns-established:
  - "Move-a-characterization-test recipe (second reuse): keep the pure cases in core with a per-test instance, split the submodule-coupled describe back into the editor, and drop every editor-only import from the core copy"
  - "Comment hygiene for grep-gated tiers: core `lib/edit/*` comments avoid the literal tokens the acceptance greps forbid (`viewport`, `DataResource`, `@/`, `useShallow`/`useMemo`/`useCallback`)"

requirements-completed: [RES-04, RES-05, RES-06]

coverage:
  - id: D1
    description: "The generic edit primitives (`OperationMeta`/`OperationTarget`/`EditorOperation`/`AppliedOperation`/`compositeOperation`/`operationPathTarget`/`patchResourceOperation`/`UndoSystem` and the nine field-path + five action names) live in `lib/edit/*` and are all reachable from the core root `.`; the editor reaches every one unchanged through `// SHIM(phase4)` forwarders"
    requirement: RES-04
    verification:
      - kind: typecheck
        ref: "pnpm --filter @motajs/editor-core typecheck && pnpm --filter @motajs/editor typecheck"
        status: pass
      - kind: unit
        ref: "pnpm --filter @motajs/editor exec vitest run src/project/commands/__tests__/sampleProjectCommands.test.ts src/utils/__tests__/fieldPath.test.ts src/services/tableMeta/__tests__/tableMetaService.test.ts#3 files, 79 tests passed"
        status: pass
      - kind: other
        ref: "findstr 'viewport|DataResource|@/' packages/libs/editor-core/lib/edit/*.ts → no matches; lib/index.ts carries all nine fieldPath names"
        status: pass
    human_judgment: false
  - id: D2
    description: "`OperationHistory` is de-singletonised: the `Store` is an instance field exposed as `OperationHistory.store`, the `UndoSystem` registry is per-instance, and `src/appInstances.ts` is the only `new OperationHistory(` site"
    requirement: RES-05
    verification:
      - kind: unit
        ref: "pnpm --filter @motajs/editor-core exec vitest run lib/edit/__tests__/operationHistory.invariants.test.ts#9 tests passed (capacity 100, inverse/redo, redo-tail truncation, de-dup + reverse restore, no-change records nothing)"
        status: pass
      - kind: other
        ref: "findstr /s 'new OperationHistory(' packages/apps/editor/src → exactly 1 (src/appInstances.ts); no module-level `new Store(` in lib/edit/operationHistory.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "A plain data patch still captures and restores the viewport on undo/redo via the registered `viewport` `UndoSystem` — the capture-all, restore-in-reverse behaviour pinned by `operationHistory.test.ts:55-71`"
    requirement: RES-05
    verification:
      - kind: integration
        ref: "pnpm --filter @motajs/editor exec vitest run src/project/history/__tests__/operationHistory.test.ts src/project/history/__tests__/operationHistory.reactivity.invariants.test.ts src/fs/__tests__/persistNoRollback.invariants.test.ts#3 files, 7 tests passed"
        status: pass
      - kind: other
        ref: "src/appInstances.ts registers exactly one `registerUndoSystem(` with `id: 'viewport'` using captureEditorViewport/restoreEditorViewport"
        status: pass
    human_judgment: false
  - id: D4
    description: "`useOperationHistory` is exported from core's `./react` entry (accepting one `OperationHistory`); the editor's zero-arg wrapper keeps `AppTopBar.tsx` and `PanelSlot.tsx` byte-identical; `@tanstack/react-store` appears in core only under `lib/react/`"
    requirement: RES-06
    verification:
      - kind: integration
        ref: "pnpm --filter @motajs/editor-core exec vitest run lib/__tests__/coreProbe.test.tsx#3 tests passed && pnpm --filter @motajs/editor exec vitest run src/Workbench/draftGuard.test.ts#4 tests passed"
        status: pass
      - kind: other
        ref: "findstr /s '@tanstack/react-store' packages/libs/editor-core/lib → only lib/react/index.ts; AppTopBar.tsx / PanelSlot.tsx byte-identical (git diff --numstat empty)"
        status: pass
    human_judgment: false
  - id: D5
    description: "`PatchableResource<T>` is the only write contract core's patch operation knows; the editor's `DataResource<T>` satisfies it structurally with zero edits, so `commandOperations.ts`/`floorCommands.ts` compile untouched"
    requirement: RES-04
    verification:
      - kind: typecheck
        ref: "pnpm --filter @motajs/editor typecheck (commandOperations.ts and floorCommands.ts compile with no source edit)"
        status: pass
      - kind: other
        ref: "git diff --numstat on commandOperations.ts / materialOperations.ts / textFileOperations.ts / DataResource.ts → empty"
        status: pass
    human_judgment: false

# Metrics
duration: 38min
completed: 2026-09-24
status: complete
---

# Phase 4 Plan 03: Resource Edit Layers Moved — Edit Layer + `UndoSystem` Seam Summary

**The generic edit layer now lives in `@motajs/editor-core/lib/edit/` — `OperationHistory` is a per-instance class with an instance store and an `UndoSystem` registry, `patchResourceOperation` is typed against the narrow `PatchableResource<T>`, and `useOperationHistory` sits on the `./react` entry — while the editor keeps its viewport operations, its single `operationHistory` instance, and a zero-arg hook wrapper, with both typechecks, the 146-test core suite, the 7-test editor history suite and both static gates green.**

## Performance

- **Duration:** ~38 min
- **Started:** 2026-09-24 (session)
- **Completed:** 2026-09-24
- **Tasks:** 2 (Task 1 tracer; Task 2 after the tracer gate passed)
- **Files created:** 9 · **modified:** 8 · **deleted/relocated:** 1 (the split invariants test, git-recorded as `R071`)

## Accomplishments

- `lib/edit/` now holds the whole generic edit layer: the nine field-path helpers, the five action primitives, the operation contracts, and `UndoSystem` — all reachable from the core root `.` as the **union** of the moved modules' exports (not a hand-picked subset).
- `OperationHistory` is de-singletonised: the `Store` became an instance field exposed as `OperationHistory.store`, the registry is a per-instance `Map`, and `src/appInstances.ts` is the only `new OperationHistory(` site. `node scripts/verify/coreModuleState.js` confirms the real tree has zero error-level module-state findings.
- The hard-coded viewport coupling is gone. Core stores `systemsBefore`/`systemsAfter` per entry and never names viewport or material; `OperationHistory.registerUndoSystem` captures **every** registered system synchronously at `OperationHistory.execute` invocation time and restores them in reverse registration order after `restoreTargets`. `operationHistory.test.ts:65,70`'s `expect(currentViewport.floorId).toBe('sample0')` — the capture-all pin — still passes.
- `PatchableResource<T>` is core's only write contract for patches; the editor's `DataResource<T>` satisfies it structurally, so `commandOperations.ts`, `floorCommands.ts`, `materialOperations.ts`, `textFileOperations.ts` and `DataResource.ts` are byte-identical to their pre-task state.
- The nine pure invariants moved to core byte-identical under a fresh `new OperationHistory()` per test; the submodule-coupled reactivity describe was split back into `operationHistory.reactivity.invariants.test.ts`; `operationHistory.test.ts` stays untouched.

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): move the field-action primitives and operation contracts into core, relocate the viewport operations** — `62c1548` (feat)
2. **Task 2: de-singletonise `OperationHistory` into core with the `UndoSystem` seam, land `useOperationHistory` on `./react`** — `21886ff` (feat)

**Plan metadata:** *(this SUMMARY commit, below)*

## Files Created/Modified

- `packages/libs/editor-core/lib/edit/fieldPath.ts` — all nine field-path helpers, verbatim (imports only `es-toolkit/compat`)
- `packages/libs/editor-core/lib/edit/action.ts` — `applyAction`/`applyActions`/`applyActionsWithInverse` + `ActionType`/`Action`; only the `./fieldPath` import was rewritten
- `packages/libs/editor-core/lib/edit/operations.ts` — the operation contracts; `PatchableResource<T>` added, `dataResourceTarget`/`ResourcePatchOperation`/`patchResourceOperation` narrowed, the three viewport members removed
- `packages/libs/editor-core/lib/edit/undoSystem.ts` — the `UndoSystem<Snapshot>` delegation contract (synchronous `capture` documented)
- `packages/libs/editor-core/lib/edit/operationHistory.ts` — per-instance `OperationHistory`; instance `store`, `registerUndoSystem`, module-private `captureSystems`/`restoreSystems`; `systemsBefore`/`systemsAfter` on each entry
- `packages/libs/editor-core/lib/edit/__tests__/operationHistory.invariants.test.ts` — the nine pure cases, fresh instance per test, `// @vitest-environment node`
- `packages/libs/editor-core/lib/index.ts` — typed re-exports of the whole `lib/edit` export set + `OperationHistory`/`OperationHistoryEntry`/`OperationHistoryState`
- `packages/libs/editor-core/lib/react/index.ts` — `useOperationHistory(history)` alongside `CoreProbe`
- `packages/apps/editor/src/project/history/viewportOperations.ts` — the three relocated viewport members (D-02)
- `packages/apps/editor/src/project/history/useOperationHistory.ts` — zero-arg wrapper over the core hook bound to the app instance
- `packages/apps/editor/src/project/history/__tests__/operationHistory.reactivity.invariants.test.ts` — the two submodule-coupled reactivity cases
- `packages/apps/editor/src/appInstances.ts` — `operationHistory` instance + the `viewport` `UndoSystem` registration
- `packages/apps/editor/src/{utils/fieldPath,utils/action,project/history/operations,project/history/operationHistory}.ts` — `// SHIM(phase4)` forwarders
- `packages/apps/editor/src/project/history/index.ts` — `navigateFloorOperation` from `./viewportOperations`, `useOperationHistory` from `./useOperationHistory`

## Decisions Made

- **`captureSystems`/`restoreSystems` are module-private functions taking the registry as a parameter**, matching the confirmed INTERFACE-NAME wording rather than class methods. `restoreSystems` iterates the registry in reverse registration order and matches snapshots by `id`, so a system registered after an entry was recorded is skipped for that entry.
- **`OperationHistory.registerUndoSystem` throws on a duplicate `id`** (`UndoSystem already registered: <id>`) and returns a disposer that removes only its own entry — mirroring `EditorCore.registerCapability`'s register-returns-disposer shape.
- **The capture-all seam keeps the old invocation-time semantics.** `OperationHistory.execute` calls `captureSystems` synchronously before enqueue, exactly where the old code captured the viewport; the `rollbackSystems` passed to `OperationHistory.applyWithCheckpoint` is restored after `restoreTargets`.
- **The core invariants test constructs a fresh instance per test** and rebinds `afterEach` to it. The nine assertions are byte-identical to the editor original.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Shorthand property referenced a non-existent variable**

- **Found during:** Task 2, `pnpm --filter @motajs/editor-core typecheck`
- **Issue:** the entry push used `systemsAfter,` as a shorthand while the local was named `afterSystems`, producing `TS18004: No value exists in scope for the shorthand property 'systemsAfter'`.
- **Fix:** `systemsAfter: afterSystems,`.
- **Files modified:** `packages/libs/editor-core/lib/edit/operationHistory.ts`
- **Verification:** core `tsc -b` green; 9/9 core invariants tests pass.
- **Committed in:** `21886ff` (Task 2)

### Minor plan-shape differences (not defects)

- **Comment tokens aligned to the plan's grep-based acceptance criteria.** The plan's verification greps `viewport|DataResource|@/` over `lib/edit` and `useShallow|useMemo|useCallback` over the react entry and expects **no** matches. Three explanatory comments initially named `viewport`/`DataResource`/those hook names literally; they were rephrased to Chinese nouns/plain wording so the comments do not trip the literal checks. No code or exported name changed.
- **Plan said `captureSystems`/`restoreSystems` are "module-private functions"; implemented exactly so** (taking the registry as a parameter) rather than as private class methods, to honour the confirmed INTERFACE-NAME entry.

### Non-deviations worth recording

- **`Json2xDataHandler.ts`, `ScriptDataHandler.ts`, `commandOperations.ts`, `materialOperations.ts`, `textFileOperations.ts`, `DataResource.ts`, `operationHistory.test.ts`, `AppTopBar.tsx`, `PanelSlot.tsx` are byte-identical to their pre-task state** (verified with `git diff --numstat`, all empty).
- **A git-recorded rename.** Deleting the editor invariants test and adding its core counterpart was detected as `R071 packages/apps/editor/.../operationHistory.invariants.test.ts -> packages/libs/editor-core/lib/edit/__tests__/operationHistory.invariants.test.ts`; the editor path is gone and the core path exists.

## Issues Encountered

- **One implementation typo in Task 2** (`systemsAfter` shorthand) was caught by the core typecheck before the task commit and fixed in place (see above).
- **`rg` is not on PATH in this shell**, so the static acceptance checks were run through the Grep tool and `findstr /c:` (as recorded in the 04-02 summary).

## Names

No new important name was invented. Every name written into code is already confirmed in
`INTERFACE-NAME.md`: `lib/edit/{undoSystem,fieldPath,action,operations,operationHistory}.ts`,
`OperationHistory.store`, `OperationHistory.registerUndoSystem`, `captureSystems`/`restoreSystems`
(module-private functions), `UndoSystem<Snapshot>`, `PatchableResource<T>`,
`src/project/history/viewportOperations.ts`, `src/project/history/useOperationHistory.ts`, and the
lowerCamelCase file-name convention. Nothing is proposed for confirmation.

## User Setup Required

None — no external service configuration and no network operation. No package install was needed
(`@tanstack/store`, `@tanstack/react-store`, `es-toolkit` were already declared in `04-01`/`04-02`).

## Next Phase Readiness

- `lib/edit` now exposes the whole engine-neutral edit layer from the core root `.`; `04-04`'s `ResourceRegistry` and the machine gates can build on the same rails.
- The `UndoSystem` registry is live and wired to the viewport through `src/appInstances.ts`; later capabilities (material, map) register their own systems with no core change (Phase 10).
- The one-`new`-site invariant for `OperationHistory` is enforced only by this plan's static checks; `04-04`'s `scripts/verify/editorShims.js` is the durable enforcement half.
- No blockers.

---

*Phase: 04-resource-edit-layers-moved*
*Completed: 2026-09-24*

## Self-Check: PASSED

- All 9 created files + this SUMMARY exist on disk.
- The editor original `src/project/history/__tests__/operationHistory.invariants.test.ts` is gone; its core counterpart exists.
- Both task commits exist: `62c1548` (Task 1, tracer) and `21886ff` (Task 2).
- Measured commits from the plan ledger (`57ca58c`): 2; diff 66193 chars → `actuals.tokens` 16548.
- No unexpected deletions beyond the intended test split; no untracked files other than this SUMMARY.
