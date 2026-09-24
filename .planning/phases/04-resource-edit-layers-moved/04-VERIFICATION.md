---
phase: 04-resource-edit-layers-moved
verified: 2026-09-24T16:35:00Z
status: human_needed
score: 15/15 must-haves verified
covered_files:
  - .planning/phases/04-resource-edit-layers-moved/04-01-PLAN.md
  - .planning/phases/04-resource-edit-layers-moved/04-01-SUMMARY.md
  - .planning/phases/04-resource-edit-layers-moved/04-02-PLAN.md
  - .planning/phases/04-resource-edit-layers-moved/04-02-SUMMARY.md
  - .planning/phases/04-resource-edit-layers-moved/04-03-PLAN.md
  - .planning/phases/04-resource-edit-layers-moved/04-03-SUMMARY.md
  - .planning/phases/04-resource-edit-layers-moved/04-04-PLAN.md
  - .planning/phases/04-resource-edit-layers-moved/04-04-SUMMARY.md
  - .planning/phases/04-resource-edit-layers-moved/INTERFACE-NAME.md
  - .planning/phases/04-resource-edit-layers-moved/04-VALIDATION.md
  - .planning/phases/04-resource-edit-layers-moved/04-CONTEXT.md
  - .planning/REQUIREMENTS.md
  - .planning/ROADMAP.md
  - packages/libs/editor-core/lib/index.ts
  - packages/libs/editor-core/lib/react/index.ts
  - packages/libs/editor-core/lib/resources/types.ts
  - packages/libs/editor-core/lib/resources/interfaces.ts
  - packages/libs/editor-core/lib/resources/errors.ts
  - packages/libs/editor-core/lib/resources/waitUntil.ts
  - packages/libs/editor-core/lib/resources/contentUtils.ts
  - packages/libs/editor-core/lib/resources/persistExecutor.ts
  - packages/libs/editor-core/lib/resources/persistenceMonitor.ts
  - packages/libs/editor-core/lib/resources/fileHandler.ts
  - packages/libs/editor-core/lib/resources/fileHandlerManager.ts
  - packages/libs/editor-core/lib/resources/dataHandler.ts
  - packages/libs/editor-core/lib/resources/jsonDataHandler.ts
  - packages/libs/editor-core/lib/resources/binaryFileHandler.ts
  - packages/libs/editor-core/lib/resources/combinators.ts
  - packages/libs/editor-core/lib/resources/resourceRegistry.ts
  - packages/libs/editor-core/lib/edit/fieldPath.ts
  - packages/libs/editor-core/lib/edit/action.ts
  - packages/libs/editor-core/lib/edit/operations.ts
  - packages/libs/editor-core/lib/edit/operationHistory.ts
  - packages/libs/editor-core/lib/edit/undoSystem.ts
  - packages/apps/editor/src/appInstances.ts
  - packages/apps/editor/src/fs/types.ts
  - packages/apps/editor/src/fs/interfaces.ts
  - packages/apps/editor/src/fs/errors.ts
  - packages/apps/editor/src/fs/ContentUtils.ts
  - packages/apps/editor/src/fs/FileHandler.ts
  - packages/apps/editor/src/fs/FileHandlerManager.ts
  - packages/apps/editor/src/fs/DataHandler.ts
  - packages/apps/editor/src/fs/JsonDataHandler.ts
  - packages/apps/editor/src/fs/BinaryFileHandler.ts
  - packages/apps/editor/src/fs/PersistExecutor.ts
  - packages/apps/editor/src/fs/PersistenceMonitor.ts
  - packages/apps/editor/src/project/resources.ts
  - packages/apps/editor/src/project/history/operations.ts
  - packages/apps/editor/src/project/history/operationHistory.ts
  - packages/apps/editor/src/project/history/viewportOperations.ts
  - packages/apps/editor/src/project/history/useOperationHistory.ts
  - packages/apps/editor/src/project/history/index.ts
  - packages/apps/editor/src/utils/action.ts
  - packages/apps/editor/src/utils/fieldPath.ts
  - packages/apps/editor/src/utils/base/signal.ts
  - scripts/verify/editorShims.js
  - scripts/verify/coreExports.js
  - scripts/verify/coreModuleState.js
  - .dependencyCruiser.cjs
  - .github/workflows/ci.yml
  - packages/libs/editor-core/package.json
  - pnpm-workspace.yaml
covered_digest: "v1:sha256:d643c5be6ebfbf7e16f3a9e857b0ebfc8ec1265e7c89588232451db21388fbd6"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Run `pnpm --filter @motajs/editor dev`, load a sample project, and compare the workbench shell + the four editors (map/table/event/code) against `.planning/baseline/screenshots/`; then edit a floor and reload to confirm it persisted; then undo/redo and confirm the previous floor/map position is restored; confirm no spurious persistence-failure notification appears."
    expected: "Workbench and four editors are visually identical to the Phase 1 baseline; the floor edit survives a reload; undo/redo restores the prior floor/map viewport; no spurious persistence error is shown."
    why_human: "Visual parity against committed screenshot baselines and end-to-end dev-server behaviour cannot be proven by grep/unit tests. Phase 1 D-08 chose human comparison over automated image diff. Recorded as open `unrun-verify` id 4 in `.planning/WINDOWS.md`; the 04-04 executor did not run it."
---

# Phase 4: Resource + Edit Layers Moved — Verification Report

**Phase Goal:** Move the already-engine-agnostic resource and edit layers into core verbatim, with existing tests green and every behavioral invariant intact.
**Verified:** 2026-09-24T16:35:00Z
**Status:** human_needed
**Re-verification:** No — initial verification (no prior `04-VERIFICATION.md` existed)

## Goal Achievement

### Observable Truths

| #   | Truth   | Status     | Evidence       |
| --- | ------- | ---------- | -------------- |
| 1   | SC1a — `src/fs/*` and `src/project/resources.ts` are relocated to `lib/resources/*`, and every legacy editor path still resolves via a `// SHIM(phase4)` re-export. | ✓ VERIFIED | `packages/libs/editor-core/lib/resources/` holds 13 source modules + 12 test files; all 18 `// SHIM(phase4)` markers present; `node scripts/verify/editorShims.js` exit 0. |
| 2   | SC1b — the generic edit mechanisms of `src/project/history/*` are relocated to `lib/edit/*`; editor-only viewport/material/command ops stay (D-02/D-04). | ✓ VERIFIED | `lib/edit/` holds `fieldPath.ts`, `action.ts`, `operations.ts`, `operationHistory.ts`, `undoSystem.ts`; editor keeps `viewport.ts`/`viewportOperations.ts`/`materialOperations.ts`/`commandOperations.ts`/`textFileOperations.ts` per locked decisions. |
| 3   | SC1c — existing test suites pass unchanged. | ✓ VERIFIED | `pnpm --filter @motajs/editor-core test` → 18 files / 158 tests passed; `pnpm --filter @motajs/editor test` → 89 files / 785 tests passed. |
| 4   | SC2a — `ResourceRegistry` supports generic logical-id registration. | ✓ VERIFIED | `lib/resources/resourceRegistry.ts`: `Map`-backed, `register/get/getOrThrow/has/ids/snapshot`, duplicate-id rejection, reserved-name + id-form validation, frozen snapshot, disposer; `resourceRegistry.test.ts` 9 tests pass. |
| 5   | SC2b — `FileHandlerManager` is a per-instance service (no module singleton). | ✓ VERIFIED | Core exports the class only (no trailing `new`); `editorShims.js` proves construction sites are exactly 3, all in `src/appInstances.ts`; grep of core `lib/` for `export const X = new ` → 0 matches. |
| 6   | SC3a — invariant: memory-first ≠ saved. | ✓ VERIFIED | `fileHandler.ts:82-91` (`commit` sets memory state then schedules persistence); `operationHistory.test.ts:73-89` passes (memory history before persistence, undo while write pending). |
| 7   | SC3b — invariant: single write path. | ✓ VERIFIED | All persisted writes go through `this.fs.writeFile` / `this.fs.deleteFile` (flat `FsPort`); `rg 'fs\.promises\|defaultFs' packages/libs/editor-core/lib` empty; `coreBoundaries.js` exit 0. |
| 8   | SC3c — invariant: `not-found` ≠ `error`. | ✓ VERIFIED | `lib/resources/errors.ts` `isFileNotFoundError` classifies only real file-missing; moved `errors.test.ts` (7 tests, incl. `project-not-found` ≠ file-not-found) passes. |
| 9   | SC3d — invariant: per-path serialization (one executing + one pending). | ✓ VERIFIED | `persistExecutor.invariants.test.ts` 6 tests pass incl. "keeps only the newest pending intent (latest-wins)"; `persistExecutor.test.ts` 18 tests pass. |
| 10  | SC4 — hook/resource results are `ReadonlySignal<Content<T>>` (five-state reactive), never snapshots or effect-faked. | ✓ VERIFIED | `ReadonlySignal<Content<T>>` declared in `interfaces.ts`, `combinators.ts`, `dataHandler.ts`, `fileHandler.ts`, `binaryFileHandler.ts`; `contentSignalLiveness.test.ts` (4 tests) captures the callable **before** mutation and re-invokes the **same** callable after → passes. |
| 11  | SC5 — `@motajs/editor` imports keep working via tracked re-export shims. | ✓ VERIFIED | 18 markers == `EXPECTED_SHIMS`; 17 forwarders forward-only; editor typecheck + 785-test suite green; `editorShims.js` exit 0. |
| 12  | Core root `.` re-exports the complete moved export set; extended `coreApiSurface.test.ts`; `DIAGNOSTIC_CODES` stays exactly five. | ✓ VERIFIED | `lib/index.ts` named re-exports of all moved names; `coreApiSurface.test.ts` 8 tests pass incl. the untouched exact-five assertion. |
| 13  | `OperationHistory` per-instance (instance store + `UndoSystem` registry); capture-all + reverse restore preserves viewport undo. | ✓ VERIFIED | `operationHistory.ts` instance `store`/registry; `appInstances.ts:58` registers the `viewport` system; `operationHistory.test.ts:62-70` passes (`currentViewport.floorId === 'sample0'` capture-all pin). |
| 14  | The five machine gates all pass. | ✓ VERIFIED | `editorShims.js`, `coreBoundaries.js`, `coreModuleState.js`, `coreExports.js`, `ci-workflow.js` each exit 0 (also `lint-severities.js` exit 0). |
| 15  | Core boundaries hold: `lib/resources`/`lib/edit` import no capabilities/editor code, and `@tanstack/react-store` is confined to `./react`. | ✓ VERIFIED | `coreBoundaries.js` 65 modules / 109 deps / 0 violations; grep for `@tanstack/react-store` in core `lib/` → only `lib/react/index.ts`. |

**Score:** 15/15 truths verified (0 present-behavior-unverified)

### Required Artifacts

| Artifact | Expected    | Status | Details |
| -------- | ----------- | ------ | ------- |
| `packages/libs/editor-core/lib/resources/*` | moved resource layer (13 modules) | ✓ VERIFIED | All exist, substantive, exported from root `.`; tests moved with them. |
| `packages/libs/editor-core/lib/edit/*` | moved edit layer (5 modules) | ✓ VERIFIED | `fieldPath`/`action`/`operations`/`operationHistory`/`undoSystem` present + substantive. |
| `packages/libs/editor-core/lib/resources/resourceRegistry.ts` | RES-02 registry | ✓ VERIFIED | 90 lines, `Map`-backed class + `ResourceRegistryEntry`; unwired to `projectData` as decided. |
| `packages/apps/editor/src/appInstances.ts` | sole construction site | ✓ VERIFIED | 62 lines; constructs `persistenceMonitor`/`FileHandlerManager`(via `FileHandlerManagerClass` alias)/`operationHistory`; registers viewport `UndoSystem`. |
| 17 editor `// SHIM(phase4)` forwarders | legacy import contract | ✓ VERIFIED | Forward-only named re-exports, no `new`/`class`/`function`. |
| `scripts/verify/editorShims.js` | two-polarity gate | ✓ VERIFIED | Set-equality inventory + forward-only + exact-3 sites + two-polarity proof. |

### Key Link Verification

| From | To  | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `src/fs/PersistenceMonitor.ts` (shim) | `@motajs/editor-core` class + `@/appInstances` instance | two distinct named re-exports | ✓ WIRED | Not collapsed into one `export *`. |
| `src/fs/FileHandlerManager.ts` (shim) | `@/appInstances` instance | `export { FileHandlerManager } from '@/appInstances'` | ✓ WIRED | Instance, not class. |
| `appInstances.ts` | `@/project/history/viewport` | `registerUndoSystem` capture/restore | ✓ WIRED | Reverse-restore verified behaviorally. |
| `lib/resources/resourceRegistry.ts` | `./combinators` | `import type { ResourceView }` | ✓ WIRED | No import of `../index`. |
| `lib/index.ts` | `./resources/*`, `./edit/*` | named re-exports | ✓ WIRED | No `export *`; root barrel is a leaf. |
| `editorShims.js` | `.github/workflows/ci.yml` `lint` job | one added `- run:` step | ✓ WIRED | Four-job contract intact (`ci-workflow.js` exit 0). |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `fileHandler.ts` `content` | `signal<Content<string>>` | `load()`/`commit()` from injected `FsPort` | Yes | ✓ FLOWING |
| `combinators.ts` `ComputedResource.content` | `computed(computeContent)` | dependency resources | Yes | ✓ FLOWING |
| `resourceRegistry.ts` `entries` | instance `Map` | `register(id, resource)` | Yes | ✓ FLOWING (unwired by decision) |
| `operationHistory.ts` `store` | instance `Store<OperationHistoryState>` | `execute`/`undo`/`redo` | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Core suite (incl. invariants + liveness) | `pnpm --filter @motajs/editor-core test` | 18 files / 158 tests passed | ✓ PASS |
| Editor suite (shim contract) | `pnpm --filter @motajs/editor test` | 89 files / 785 tests passed | ✓ PASS |
| Shim inventory + single-`new`-site | `node scripts/verify/editorShims.js` | exit 0 | ✓ PASS |
| Boundary / singleton / export / CI gates | `node scripts/verify/{coreBoundaries,coreModuleState,coreExports,ci-workflow}.js` | all exit 0 | ✓ PASS |
| Root fan-out | `pnpm test` | Red **only** on the known `@motajs/react-monaco-editor` teardown flake (`Closing rpc while "fetch" was pending`; its 2 files/6 tests all pass) | ✓ PASS (known pre-existing Phase-1 flake, not a phase gap) |

### Probe Execution

N/A — no `scripts/*/tests/probe-*.sh` probes exist for this phase (glob returned none); the phase declares none.

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|-----------------|---------|
| `lib/resources/__tests__/errors.test.ts` | RES-05 | 7 | 0 | No | Value | ✓ |
| `lib/resources/__tests__/persistExecutor.invariants.test.ts` | RES-05 | 6 | 0 | No | Behavioral | ✓ |
| `lib/resources/__tests__/persistenceMonitor.invariants.test.ts` | RES-05 | 7 | 0 | No | Behavioral | ✓ |
| `lib/resources/__tests__/contentSignalLiveness.test.ts` | RES-06 | 4 | 0 | No | Behavioral (re-invoke captured callable) | ✓ |
| `lib/resources/__tests__/resourceRegistry.test.ts` | RES-02 | 9 | 0 | No | Value + isolation | ✓ |
| `lib/edit/__tests__/operationHistory.invariants.test.ts` | RES-04/RES-05 | 9 | 0 | No | Behavioral | ✓ |
| `src/project/history/__tests__/operationHistory.test.ts` (editor) | RES-05 | 3 | 0 | No | Behavioral (capture-all viewport pin) | ✓ |

**Disabled tests on requirements:** 0. **Circular patterns detected:** 0 (no test generates its own expected values from the SUT). **Insufficient assertions:** 0.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| RES-01 | 04-01/02/03/04 | `src/fs/*` + `src/project/resources.ts` → `lib/resources/*` | ✓ SATISFIED | 13 modules + tests moved; root `.` exports the union; shims forward. |
| RES-02 | 04-04 | `ResourceRegistry` generic logical-id registration | ✓ SATISFIED | Class + 9 unit tests; `Map`-backed; unwired as decided. |
| RES-03 | 04-01/02/04 | `FileHandlerManager` per-instance | ✓ SATISFIED | Class only in core; sole `new` site in `appInstances.ts` (gate-enforced). |
| RES-04 | 04-03 | `src/project/history/*` → `lib/edit/*` | ✓ SATISFIED | Generic mechanisms moved; capacity 100 / inverse / multi-target checkpoint preserved (9 invariants pass). |
| RES-05 | 04-01/02/03/04 | Invariants preserved | ✓ SATISFIED | memory-first, single write path, not-found ≠ error, per-path serialization all behaviorally tested. |
| RES-06 | 04-01/02/03 | `ReadonlySignal<Content<T>>` | ✓ SATISFIED | Declared across the layer; liveness test passes. |

No orphaned requirements: `grep "Phase 4"`-mapped IDs (RES-01..RES-06) all appear in the plans' `requirements` fields.

### Decision Coverage

All trackable CONTEXT.md decisions are honored by shipped artifacts. (`query check.decision-coverage-verify`: 14/14 honored, 0 not honored, non-blocking.)

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | No `TBD`/`FIXME`/`XXX`/`HACK`/`PLACEHOLDER` in any phase-modified core/editor/script file | — | None |

No stub artifacts: the moved modules are substantive (e.g. `fileHandler.ts` 145 lines, `resourceRegistry.ts` 90 lines) and are exercised by passing tests. The pre-existing `CoreProbe.tsx` stub is a Phase-2 WINDOWS entry and was **not** modified by this phase.

### Human Verification Required

#### 1. `@motajs/editor` UI/behaviour parity (four editors + shell)

**Test:** Run `pnpm --filter @motajs/editor dev`, load a sample project, and compare the workbench shell + four editors against `.planning/baseline/screenshots/`; edit a floor and reload; undo/redo; watch for spurious persistence-failure notifications.
**Expected:** Visually identical to the Phase 1 baseline; floor edit survives reload; undo/redo restores the prior floor/map viewport; no spurious persistence error.
**Why human:** Visual parity and dev-server end-to-end behaviour cannot be proven programmatically (Phase 1 D-08 chose human comparison over automated image diff). The 04-04 executor did not run it; it is recorded as open `unrun-verify` id 4 in `.planning/WINDOWS.md`.

### Gaps Summary

No code gaps. All 15 observable truths are VERIFIED with passing behavioral tests where the truth is behavior-dependent; all five machine gates exit 0; both package test suites are green; the root fan-out red is exclusively the documented pre-existing `@motajs/react-monaco-editor` teardown flake (its own tests pass). The single outstanding item is the **manual UI/behaviour parity check**, which the phase's own validation contract (`04-VALIDATION.md` Manual-Only) requires and which was not executed — hence `status: human_needed`, not `passed`.

---

_Verified: 2026-09-24T16:35:00Z_
_Verifier: the agent (gsd-verifier)_
