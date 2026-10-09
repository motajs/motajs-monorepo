---
phase: 04-resource-edit-layers-moved
verified: 2026-09-24T11:27:55Z
status: passed
score: 15/15 must-haves verified
covered_files:
  - .dependencyCruiser.cjs
  - .github/workflows/ci.yml
  - .planning/REQUIREMENTS.md
  - .planning/ROADMAP.md
  - .planning/phases/04-resource-edit-layers-moved/04-01-PLAN.md
  - .planning/phases/04-resource-edit-layers-moved/04-01-SUMMARY.md
  - .planning/phases/04-resource-edit-layers-moved/04-02-PLAN.md
  - .planning/phases/04-resource-edit-layers-moved/04-02-SUMMARY.md
  - .planning/phases/04-resource-edit-layers-moved/04-03-PLAN.md
  - .planning/phases/04-resource-edit-layers-moved/04-03-SUMMARY.md
  - .planning/phases/04-resource-edit-layers-moved/04-04-PLAN.md
  - .planning/phases/04-resource-edit-layers-moved/04-04-SUMMARY.md
  - .planning/phases/04-resource-edit-layers-moved/04-CONTEXT.md
  - .planning/phases/04-resource-edit-layers-moved/04-SECURITY.md
  - .planning/phases/04-resource-edit-layers-moved/04-UAT.md
  - .planning/phases/04-resource-edit-layers-moved/04-VALIDATION.md
  - .planning/phases/04-resource-edit-layers-moved/INTERFACE-NAME.md
  - packages/apps/editor/src/appInstances.ts
  - packages/apps/editor/src/fs/BinaryFileHandler.ts
  - packages/apps/editor/src/fs/ContentUtils.ts
  - packages/apps/editor/src/fs/DataHandler.ts
  - packages/apps/editor/src/fs/FileHandler.ts
  - packages/apps/editor/src/fs/FileHandlerManager.ts
  - packages/apps/editor/src/fs/JsonDataHandler.ts
  - packages/apps/editor/src/fs/PersistExecutor.ts
  - packages/apps/editor/src/fs/PersistenceMonitor.ts
  - packages/apps/editor/src/fs/errors.ts
  - packages/apps/editor/src/fs/interfaces.ts
  - packages/apps/editor/src/fs/types.ts
  - packages/apps/editor/src/project/history/index.ts
  - packages/apps/editor/src/project/history/operationHistory.ts
  - packages/apps/editor/src/project/history/operations.ts
  - packages/apps/editor/src/project/history/useOperationHistory.ts
  - packages/apps/editor/src/project/history/viewportOperations.ts
  - packages/apps/editor/src/project/resources.ts
  - packages/apps/editor/src/utils/action.ts
  - packages/apps/editor/src/utils/base/signal.ts
  - packages/apps/editor/src/utils/fieldPath.ts
  - packages/libs/editor-core/lib/__tests__/coreApiSurface.test.ts
  - packages/libs/editor-core/lib/edit/action.ts
  - packages/libs/editor-core/lib/edit/fieldPath.ts
  - packages/libs/editor-core/lib/edit/operationHistory.ts
  - packages/libs/editor-core/lib/edit/operations.ts
  - packages/libs/editor-core/lib/edit/undoSystem.ts
  - packages/libs/editor-core/lib/index.ts
  - packages/libs/editor-core/lib/react/index.ts
  - packages/libs/editor-core/lib/resources/binaryFileHandler.ts
  - packages/libs/editor-core/lib/resources/combinators.ts
  - packages/libs/editor-core/lib/resources/contentUtils.ts
  - packages/libs/editor-core/lib/resources/dataHandler.ts
  - packages/libs/editor-core/lib/resources/errors.ts
  - packages/libs/editor-core/lib/resources/fileHandler.ts
  - packages/libs/editor-core/lib/resources/fileHandlerManager.ts
  - packages/libs/editor-core/lib/resources/interfaces.ts
  - packages/libs/editor-core/lib/resources/jsonDataHandler.ts
  - packages/libs/editor-core/lib/resources/persistExecutor.ts
  - packages/libs/editor-core/lib/resources/persistenceMonitor.ts
  - packages/libs/editor-core/lib/resources/resourceRegistry.ts
  - packages/libs/editor-core/lib/resources/types.ts
  - packages/libs/editor-core/lib/resources/waitUntil.ts
  - packages/libs/editor-core/package.json
  - pnpm-workspace.yaml
  - scripts/verify/coreExports.js
  - scripts/verify/coreModuleState.js
  - scripts/verify/editorShims.js
covered_digest: "v1:sha256:e13f48def0694f0f3a53de2b064785b0e2776c200f5649b12512a8501f1e78b0"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 15/15
  gaps_closed:
    - "Manual `@motajs/editor` UI/behaviour parity against `.planning/baseline/screenshots/` — now recorded `pass` as 04-UAT.md test 2 (19/19 UAT passed)"
  gaps_remaining: []
  regressions: []
---

# Phase 4: Resource + Edit Layers Moved — Verification Report

**Phase Goal:** Move the already-engine-agnostic resource and edit layers into core verbatim, with existing tests green and every behavioral invariant intact.
**Verified:** 2026-09-24T11:27:55Z
**Status:** passed
**Re-verification:** Yes — after gap/UAT closure (prior `status: human_needed`, no code gaps; the sole human item is now recorded passed in `04-UAT.md`, and the fingerprint was refreshed over the current summaries).

**Fingerprint refresh (2026-09-24T11:27:55Z):** The digest was recomputed after two doc-only commits landed since the previous refresh (`50b8a98`): `98dff11` updated `04-VALIDATION.md` (the nyquist `validate-phase` step: `status: draft` → `validated`, `nyquist_compliant: true`, sign-off checked, a `Validation Audit 2026-09-24` section appended) and `b94e07a` added `04-SECURITY.md` (the `secure-phase` threat register: `status: verified`, `threats_open: 0`). `git status --short` shows no source/config/CI/gate file changed (only the unrelated `packages/external/mota-js` submodule pointer); both deltas are `.planning/` documents. The bounded evidence set was re-run on the unchanged tree and stayed green (core suite 18 files / 158 tests exit 0; editor suite 89 files / 785 tests exit 0; `editorShims.js` / `coreBoundaries.js` / `coreModuleState.js` / `coreExports.js` / `ci-workflow.js` all exit 0; 18 `// SHIM(phase4)` markers; exactly 3 construction sites in `appInstances.ts`; no `TBD`/`FIXME`/`XXX`/`HACK`/`PLACEHOLDER` in any phase-modified file). `status: passed` and all 15/15 must-haves are unchanged. The covered set was extended by exactly one genuinely-new phase artifact — `04-SECURITY.md` — which is the same verification-contract class as the already-covered `04-UAT.md` / `04-VALIDATION.md`; the timestamp and `covered_digest` were then recomputed over the resulting 65-file list.

## Goal Achievement

### Observable Truths

| #   | Truth   | Status     | Evidence       |
| --- | ------- | ---------- | -------------- |
| 1   | SC1a — `src/fs/*` and `src/project/resources.ts` are relocated to `lib/resources/*`, and every legacy editor path still resolves via a `// SHIM(phase4)` re-export. | ✓ VERIFIED | `packages/libs/editor-core/lib/resources/` holds 14 source modules + 10 test files + 2 helpers; all 18 `// SHIM(phase4)` markers present; `node scripts/verify/editorShims.js` exit 0 (inventory exactly `EXPECTED_SHIMS`). |
| 2   | SC1b — the generic edit mechanisms of `src/project/history/*` are relocated to `lib/edit/*`; editor-only viewport/material/command ops stay (D-02/D-04). | ✓ VERIFIED | `lib/edit/` holds `fieldPath.ts`, `action.ts`, `operations.ts`, `operationHistory.ts`, `undoSystem.ts` + `operationHistory.invariants.test.ts`; editor keeps `viewportOperations.ts`/`materialOperations.ts`/`commandOperations.ts`/`textFileOperations.ts` per locked decisions. |
| 3   | SC1c — existing test suites pass unchanged. | ✓ VERIFIED | `pnpm --filter @motajs/editor-core test` → 18 files / 158 tests passed (exit 0); `pnpm --filter @motajs/editor test` → 89 files / 785 tests passed (exit 0). |
| 4   | SC2a — `ResourceRegistry` supports generic logical-id registration. | ✓ VERIFIED | `lib/resources/resourceRegistry.ts`: `Map`-backed, `register/get/getOrThrow/has/ids/snapshot`, duplicate-id rejection, reserved-name + id-form validation, frozen snapshot, disposer with stale guard; `resourceRegistry.test.ts` 9 tests pass. |
| 5   | SC2b — `FileHandlerManager` is a per-instance service (no module singleton). | ✓ VERIFIED | Core exports the class only (`resourceRegistry`/manager wiring has no trailing `new`); `editorShims.js` proves construction sites are exactly 3, all in `src/appInstances.ts`; `findstr` over core `lib/` for `fs.promises`/`defaultFs` → 0 matches. |
| 6   | SC3a — invariant: memory-first ≠ saved. | ✓ VERIFIED | `fileHandler.ts` `commit` sets memory state then schedules persistence; `persistNoRollback.invariants` + `operationHistory.test.ts` pass (memory history before persistence, undo while write pending). |
| 7   | SC3b — invariant: single write path. | ✓ VERIFIED | All persisted writes go through `this.fs.writeFile` / `this.fs.deleteFile` (flat `FsPort`); `findstr 'fs.promises\|defaultFs' packages/libs/editor-core/lib` → empty; `coreBoundaries.js` exit 0. |
| 8   | SC3c — invariant: `not-found` ≠ `error`. | ✓ VERIFIED | `lib/resources/errors.ts` `isFileNotFoundError` classifies only real file-missing; moved `errors.test.ts` (7 tests) passes. |
| 9   | SC3d — invariant: per-path serialization (one executing + one pending). | ✓ VERIFIED | `persistExecutor.invariants.test.ts` 6 tests pass incl. "keeps only the newest pending intent (latest-wins)"; `persistExecutor.test.ts` 18 tests pass. |
| 10  | SC4 — hook/resource results are `ReadonlySignal<Content<T>>` (five-state reactive), never snapshots or effect-faked. | ✓ VERIFIED | `ReadonlySignal<Content<T>>` declared in `interfaces.ts`, `combinators.ts`, `dataHandler.ts`, `fileHandler.ts`, `binaryFileHandler.ts`; `contentSignalLiveness.test.ts` (4 tests) captures the callable **before** mutation and re-invokes the **same** callable after → passes. |
| 11  | SC5 — `@motajs/editor` imports keep working via tracked re-export shims. | ✓ VERIFIED | 18 markers == `EXPECTED_SHIMS`; 17 forwarders forward-only; editor typecheck + 785-test suite green; `editorShims.js` exit 0. |
| 12  | Core root `.` re-exports the complete moved export set; extended `coreApiSurface.test.ts`; `DIAGNOSTIC_CODES` stays exactly five. | ✓ VERIFIED | `lib/index.ts` named re-exports of all moved names (incl. `ResourceRegistry`/`ResourceRegistryEntry`); `coreApiSurface.test.ts` 8 tests pass — 10 classes, 21 values (incl. `ContentUtils`), 22 type names, with the untouched exact-five `DIAGNOSTIC_CODES` assertion. |
| 13  | `OperationHistory` per-instance (instance store + `UndoSystem` registry); capture-all + reverse restore preserves viewport undo. | ✓ VERIFIED | `operationHistory.ts` instance `store`/registry; core `operationHistory.invariants.test.ts` 9 tests pass (capacity 100, inverse/redo, de-dup + reverse restore); editor `operationHistory.test.ts` 3 tests pass incl. the `currentViewport.floorId === 'sample0'` capture-all pin; `appInstances.ts` registers the `viewport` system. |
| 14  | The five machine gates all pass. | ✓ VERIFIED | `editorShims.js`, `coreBoundaries.js`, `coreModuleState.js`, `coreExports.js`, `ci-workflow.js` each exit 0 this run. |
| 15  | Core boundaries hold: `lib/resources`/`lib/edit` import no capabilities/editor code, and `@tanstack/react-store` is confined to `./react`. | ✓ VERIFIED | `coreBoundaries.js` 65 modules / 109 deps / 0 violations; `findstr '@tanstack/react-store' core lib/**` → only `lib/react/index.ts`. |

**Score:** 15/15 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected    | Status | Details |
| -------- | ----------- | ------ | ------- |
| `packages/libs/editor-core/lib/resources/*` | moved resource layer | ✓ VERIFIED | 14 source modules exist, substantive, exported from root `.`; tests moved with them. |
| `packages/libs/editor-core/lib/edit/*` | moved edit layer (5 modules) | ✓ VERIFIED | `fieldPath`/`action`/`operations`/`operationHistory`/`undoSystem` present + substantive. |
| `packages/libs/editor-core/lib/resources/resourceRegistry.ts` | RES-02 registry | ✓ VERIFIED | 90 lines, `Map`-backed class + `ResourceRegistryEntry`; unwired to `projectData` as decided. |
| `packages/apps/editor/src/appInstances.ts` | sole construction site | ✓ VERIFIED | constructs `persistenceMonitor`/`FileHandlerManager`(via `FileHandlerManagerClass` alias)/`operationHistory`; registers viewport `UndoSystem`. |
| 17 editor `// SHIM(phase4)` forwarders | legacy import contract | ✓ VERIFIED | Forward-only named re-exports, no `new`/`class`/`function`. |
| `scripts/verify/editorShims.js` | two-polarity gate | ✓ VERIFIED | Set-equality inventory + forward-only + exact-3 sites + two-polarity proof; wired into the existing `lint` job. |

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
| Core behavioral set (RES-05/06 invariants + RES-02 + root surface) | `pnpm --filter @motajs/editor-core exec vitest run lib/resources/__tests__/{persistExecutor.invariants,persistenceMonitor.invariants,contentSignalLiveness,resourceRegistry,errors}.test.ts lib/edit/__tests__/operationHistory.invariants.test.ts lib/__tests__/coreApiSurface.test.ts` | 7 files / 50 tests passed | ✓ PASS |
| Editor behavioral set (capture-all + no-rollback) | `pnpm --filter @motajs/editor exec vitest run src/project/history/__tests__/operationHistory{,.reactivity.invariants}.test.ts src/fs/__tests__/persistNoRollback.invariants.test.ts` | 3 files / 7 tests passed | ✓ PASS |
| Shim inventory + single-`new`-site | `node scripts/verify/editorShims.js` | exit 0 (18 markers, 17 forward-only, exactly 3 construction sites) | ✓ PASS |
| Boundary / singleton / export / CI gates | `node scripts/verify/{coreBoundaries,coreModuleState,coreExports,ci-workflow}.js` | all exit 0 | ✓ PASS |
| Root fan-out | `pnpm test` | Red **only** on the known `@motajs/react-monaco-editor` teardown flake (`Closing rpc while "fetch" was pending`; its 2 files / 6 tests all pass). The fan-out abort also surfaces a spurious packer `Failed`; `pnpm --filter @motajs/packer test` run directly is green (9 files / 94 tests). | ✓ PASS (known pre-existing Phase-1 flake + fan-out abort artifact, not a phase gap) |

### Probe Execution

N/A — no `scripts/*/tests/probe-*.sh` probes exist for this phase (glob returned none); the phase declares none.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| RES-01 | 04-01/02/03/04 | `src/fs/*` + `src/project/resources.ts` → `lib/resources/*` | ✓ SATISFIED | 14 modules + tests moved; root `.` exports the union; shims forward. |
| RES-02 | 04-04 | `ResourceRegistry` generic logical-id registration | ✓ SATISFIED | Class + 9 unit tests; `Map`-backed; unwired as decided. |
| RES-03 | 04-01/02/04 | `FileHandlerManager` per-instance | ✓ SATISFIED | Class only in core; sole `new` site in `appInstances.ts` (gate-enforced). |
| RES-04 | 04-03 | `src/project/history/*` → `lib/edit/*` | ✓ SATISFIED | Generic mechanisms moved; capacity 100 / inverse / multi-target checkpoint preserved (9 invariants pass). |
| RES-05 | 04-01/02/03/04 | Invariants preserved | ✓ SATISFIED | memory-first, single write path, not-found ≠ error, per-path serialization all behaviorally tested. |
| RES-06 | 04-01/02/03 | `ReadonlySignal<Content<T>>` | ✓ SATISFIED | Declared across the layer; liveness test passes. |

No orphaned requirements: `grep "Phase 4"`-mapped IDs (RES-01..RES-06) all appear in the plans' `requirements` fields.

### Decision Coverage

All trackable CONTEXT.md decisions are honored by shipped artifacts (14/14, 0 not honored per the prior run; no decision-affecting code changed since).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | No `TBD`/`FIXME`/`XXX`/`HACK`/`PLACEHOLDER` in any phase-modified core/editor/script file (fresh `findstr` → none) | — | None |
| `.planning/WINDOWS.md` | 21 | Ledger entry id 4 (`kind: unrun-verify`, phase 04) still reads `status: open` while `04-UAT.md` test 2 now records the manual parity check `pass` | ℹ️ Info | Bookkeeping only — the orchestrator should mark the ledger entry resolved (`gsd-tools windows fixed 4`); it does not contradict the phase goal and does not affect `status`. |

No stub artifacts: the moved modules are substantive (e.g. `resourceRegistry.ts` 90 lines) and are exercised by passing tests. The pre-existing `CoreProbe.tsx` stub is a Phase-2 WINDOWS entry and was **not** modified by this phase.

### Human Verification Required

None outstanding. The prior report's single human item — `@motajs/editor` UI/behaviour parity against `.planning/baseline/screenshots/` (workbench shell + four editors, floor edit persists across reload, undo/redo restores the viewport, no spurious persistence failure) — is now recorded **pass** as test 2 of `04-UAT.md` (19/19 UAT passed). Per the decision tree, an empty human-verification set with no failing truths/gaps yields `passed`.

### Gaps Summary

No code gaps. All 15 observable truths are VERIFIED with passing behavioral tests where the truth is behavior-dependent; all five machine gates exit 0; both package test suites are green (core 158, editor 785); the root fan-out red is exclusively the documented pre-existing `@motajs/react-monaco-editor` teardown flake (its own tests pass) plus the fan-out abort artifact on packer (green in isolation). The previous outstanding human item is closed by the completed UAT, so this report advances from `human_needed` to **`passed`**.

This run is a fingerprint refresh only: the last refresh (`50b8a98`) was itself triggered by two SUMMARY metadata corrections; since then the only deltas are the doc-only `98dff11` (`04-VALIDATION.md` validated) and `b94e07a` (added `04-SECURITY.md`), neither touching source. The covered set therefore grew by exactly one entry (`04-SECURITY.md`) and the digest above was recomputed over the current 65-file set, which includes every live `04-*-PLAN.md`/`04-*-SUMMARY.md`.

---

_Verified: 2026-09-24T11:27:55Z_
_Verifier: the agent (gsd-verifier)_
