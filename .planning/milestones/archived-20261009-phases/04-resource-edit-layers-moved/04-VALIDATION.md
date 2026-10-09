---
phase: "4"
slug: "resource-edit-layers-moved"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-09-23"
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Per-task rows below are filled from the four `04-*-PLAN.md` files (post file-name-convention sweep).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 — two projects: `packages/libs/editor-core/vitest.config.ts` and `packages/apps/editor/vitest.config.ts` |
| **Config file** | core: `include: ['lib/**/*.test.{ts,tsx}']`, `environment: 'jsdom'`; editor: its own `vitest.config.ts` (Phase 1 D-14 split) |
| **Quick run command** | `pnpm --filter @motajs/editor-core test` |
| **Editor-impact command** | `pnpm --filter @motajs/editor test` (the shim contract's real proof) |
| **Type-check both programs** | `pnpm --filter @motajs/editor-core typecheck && pnpm --filter @motajs/editor typecheck` |
| **Full suite command** | `pnpm lint && pnpm typecheck && pnpm test && pnpm build` (the four CI jobs' local analogues) |
| **Gate commands** | `node scripts/verify/coreBoundaries.js`, `node scripts/verify/coreModuleState.js`, `node scripts/verify/editorShims.js` (new), `node scripts/verify/coreExports.js`, `node scripts/verify/ci-workflow.js` |
| **Estimated runtime** | core suite is seconds-scale; the editor suite is the slower one (submodule fixture) |

Per-file env for pure tests: `// @vitest-environment node` docblock (Phase-3 precedent) — the pure moved tests must be explicitly opted in or they run under jsdom.

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @motajs/editor-core test` (or the editor's, depending on which tree the task touched)
- **After every plan wave:** Run `pnpm lint && pnpm typecheck && pnpm test` (`pnpm typecheck` must run the **editor's** program too — Pitfall 1 lives there)
- **Before `/gsd-verify-work`:** Full suite (all four CI jobs) must be green, plus `node scripts/verify/ci-workflow.js` to confirm the job contract was not altered
- **Max feedback latency:** keep per-task runs to the touched package's suite

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 04-01 | 1 | — | — | four core dependencies pinned (`es-toolkit: 1.44.0`), recorded | human checkpoint | *(checkpoint:human-verify — no automated command)* | — | ⬜ pending |
| 04-01-02 | 04-01 | 1 | RES-01 | — | one resource leaf moved end-to-end; core program green | unit | `pnpm --filter @motajs/editor-core typecheck && pnpm --filter @motajs/editor-core exec vitest run lib/resources/__tests__/errors.test.ts` | ❌ W0 | ⬜ pending |
| 04-01-02 | 04-01 | 1 | RES-01 | — | editor shim resolves; the `@/utils/base/signal` shim still resolves `waitUntil` | unit | `pnpm --filter @motajs/editor typecheck && pnpm --filter @motajs/editor exec vitest run src/utils/__tests__/signal.test.ts src/fs/__tests__/FileHandler.test.ts src/project/__tests__/resources.test.ts` | ✅ exists | ⬜ pending |
| 04-01-02 | 04-01 | 1 | RES-01 | T-4-04 | no module-level state; boundaries clean | static | `pnpm lint && node scripts/verify/coreBoundaries.js && node scripts/verify/coreModuleState.js` | ✅ exists | ⬜ pending |
| 04-01-03 | 04-01 | 1 | RES-05 | T-4-03 | persistence chain de-singletonised; per-path serialization | unit | `pnpm --filter @motajs/editor-core typecheck && pnpm --filter @motajs/editor-core exec vitest run lib/resources/__tests__/persistExecutor.test.ts lib/resources/__tests__/persistExecutor.invariants.test.ts lib/resources/__tests__/persistenceMonitor.test.ts lib/resources/__tests__/persistenceMonitor.invariants.test.ts` | ❌ W0 (moved) | ⬜ pending |
| 04-01-03 | 04-01 | 1 | RES-05 | T-4-03 | memory-first ≠ saved; one shared instance (no two `PersistenceMonitor`s) | integration | `pnpm --filter @motajs/editor typecheck && pnpm --filter @motajs/editor exec vitest run src/fs/__tests__/FileHandler.test.ts src/fs/__tests__/persistNoRollback.invariants.test.ts src/project/data/__tests__/persistStatus.integration.test.ts` | ✅ exists | ⬜ pending |
| 04-01-03 | 04-01 | 1 | RES-03 | T-4-04 | no trailing `new PersistenceMonitor()` in core | static | `node scripts/verify/coreModuleState.js` | ✅ exists | ⬜ pending |
| 04-02-01 | 04-02 | 2 | RES-03 | T-4-02 | injected `FileHandler`/`FileHandlerManager`; RES-06 signal liveness | unit | `pnpm --filter @motajs/editor-core typecheck && pnpm --filter @motajs/editor-core exec vitest run lib/resources/__tests__/fileHandler.test.ts lib/resources/__tests__/fileHandlerManager.test.ts lib/resources/__tests__/contentSignalLiveness.test.ts` | ❌ W0 (moved + new) | ⬜ pending |
| 04-02-01 | 04-02 | 2 | RES-03 | T-4-02 | one shared instance; the runtime-only stale call sites are fixed | integration | `pnpm --filter @motajs/editor typecheck && pnpm --filter @motajs/editor exec vitest run test/utils/sampleProject.ts src/services/tower/__tests__/towerService.test.ts src/project/commands/__tests__/floorCommands.test.ts src/services/tableMeta/__tests__/tableMetaService.test.ts` | ✅ exists | ⬜ pending |
| 04-02-02 | 04-02 | 2 | RES-01 | — | data/binary handlers moved; relative edges resolve inside core | unit + static | `pnpm --filter @motajs/editor-core typecheck && pnpm --filter @motajs/editor typecheck && node scripts/verify/coreBoundaries.js` | ❌ W0 (moved) | ⬜ pending |
| 04-02-02 | 04-02 | 2 | RES-01 | — | `DataHandler` subclasses still inherit through the shim | unit | `pnpm --filter @motajs/editor exec vitest run src/project/__tests__/resources.test.ts src/project/commands/__tests__/sampleProjectCommands.test.ts` | ✅ exists | ⬜ pending |
| 04-02-03 | 04-02 | 2 | RES-01/RES-06 | — | combinators moved; `ComputedResource` re-exported as a value | unit | `pnpm --filter @motajs/editor-core typecheck && pnpm --filter @motajs/editor-core exec vitest run lib/resources/__tests__/resources.test.ts` | ❌ W0 (moved) | ⬜ pending |
| 04-02-03 | 04-02 | 2 | RES-01 | T-4-04 | the shim dropped no combinator or type | static | `pnpm --filter @motajs/editor typecheck && node scripts/verify/coreModuleState.js` | ✅ exists | ⬜ pending |
| 04-03-01 | 04-03 | 3 | RES-04 | — | field-action primitives + operation contracts live in core | typecheck | `pnpm --filter @motajs/editor-core typecheck && pnpm --filter @motajs/editor typecheck` | ❌ W0 (moved) | ⬜ pending |
| 04-03-01 | 04-03 | 3 | RES-04 | — | `patchResourceOperation` still accepts the editor's `DataResource` | unit | `pnpm --filter @motajs/editor exec vitest run src/project/commands/__tests__/sampleProjectCommands.test.ts src/utils/__tests__/fieldPath.test.ts src/services/tableMeta/__tests__/tableMetaService.test.ts` | ✅ exists | ⬜ pending |
| 04-03-01 | 04-03 | 3 | RES-04 | T-4-04 | no `@/` or `./viewport` left in `lib/edit/` | static | `node scripts/verify/coreBoundaries.js && node scripts/verify/coreModuleState.js` | ✅ exists | ⬜ pending |
| 04-03-02 | 04-03 | 3 | RES-04 | — | capacity 100, inverse ops, multi-target checkpoint + rollback; capture-all `UndoSystem` | unit | `pnpm --filter @motajs/editor-core typecheck && pnpm --filter @motajs/editor-core exec vitest run lib/edit/__tests__/operationHistory.invariants.test.ts` | ❌ W0 (moved, split) | ⬜ pending |
| 04-03-02 | 04-03 | 3 | RES-04/RES-05 | — | a data operation's undo also restores the viewport (capture-all pinned) | integration | `pnpm --filter @motajs/editor typecheck && pnpm --filter @motajs/editor exec vitest run src/project/history/__tests__/operationHistory.test.ts src/project/history/__tests__/operationHistory.reactivity.invariants.test.ts src/fs/__tests__/persistNoRollback.invariants.test.ts` | ✅ exists + new split | ⬜ pending |
| 04-03-02 | 04-03 | 3 | RES-06 | — | `useOperationHistory` on `./react`; editor zero-arg wrapper keeps the call sites | unit | `pnpm --filter @motajs/editor-core exec vitest run lib/__tests__/coreProbe.test.tsx && pnpm --filter @motajs/editor exec vitest run src/Workbench/draftGuard.test.ts` | ✅ exists | ⬜ pending |
| 04-04-01 | 04-04 | 4 | RES-02 | T-4-01 | `ResourceRegistry` logical-id registration, duplicate rejection, working disposer, frozen snapshot, two-instance isolation; `Map`-backed | unit | `pnpm --filter @motajs/editor-core typecheck && pnpm --filter @motajs/editor-core exec vitest run lib/resources/__tests__/resourceRegistry.test.ts lib/__tests__/coreApiSurface.test.ts` | ❌ W0 (new) | ⬜ pending |
| 04-04-01 | 04-04 | 4 | RES-02 | T-4-04 | no module-level `Map`/object literal/`let` in the new file | static | `node scripts/verify/coreModuleState.js && pnpm lint` | ✅ exists | ⬜ pending |
| 04-04-02 | 04-04 | 4 | RES-03 | T-4-02 | every shim is forward-only and tracked; exactly one `new` site | static (two-polarity) | `node scripts/verify/editorShims.js` | ❌ W0 (new) | ⬜ pending |
| 04-04-02 | 04-04 | 4 | Regression | — | depcruise rules green; the four-job contract intact | static | `node scripts/verify/coreBoundaries.js && node scripts/verify/ci-workflow.js` | ✅ exists | ⬜ pending |
| 04-04-02 | 04-04 | 4 | Regression | T-4-04 | no rule severity downgraded; no unreasoned `eslint-disable` | static | `pnpm lint && node scripts/verify/lint-severities.js` | ✅ exists | ⬜ pending |
| 04-04-03 | 04-04 | 4 | RES-01 | — | truthful subpath record; extended root `.` surface | static | `pnpm --filter @motajs/editor-core typecheck && node scripts/verify/coreExports.js` | ✅ exists | ⬜ pending |
| 04-04-03 | 04-04 | 4 | RES-01..RES-06 | — | the root `.` exports every moved name (the union) | unit | `pnpm --filter @motajs/editor-core exec vitest run lib/__tests__/coreApiSurface.test.ts` | ✅ exists | ⬜ pending |
| 04-04-03 | 04-04 | 4 | Regression | — | `@motajs/editor` behaviour unchanged; Phase 1 baseline holds | full suite | `pnpm lint && pnpm typecheck && pnpm test` | ✅ exists | ⬜ pending |
| 04-04-03 | 04-04 | 4 | Regression | — | editor artifact shape/budget unchanged | build | `pnpm --filter @motajs/editor exec panda codegen && pnpm build && node scripts/verify/editorArtifactAssets.js` | ✅ exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/libs/editor-core/lib/resources/__tests__/` — the moved pure tests (`errors`, `fileHandler`, `fileHandlerManager`, `persistenceMonitor`, `persistExecutor`, both `*.invariants`, `resources`) with deps-object construction and no `@test/*` imports
- [ ] `packages/libs/editor-core/lib/resources/__tests__/memoryFsPort.ts` — the flat `FsPort` double with the four fault-injection knobs (D-14); plus a 2-line `wait` helper in `testHelpers.ts`
- [ ] `packages/libs/editor-core/lib/resources/__tests__/resourceRegistry.test.ts` — RES-02
- [ ] `packages/libs/editor-core/lib/edit/__tests__/operationHistory.invariants.test.ts` — the 9 moved pure invariants, instance-based
- [ ] `packages/libs/editor-core/lib/resources/__tests__/contentSignalLiveness.test.ts` — the RES-06 signal-liveness assertion
- [ ] `packages/apps/editor/src/project/history/__tests__/operationHistory.reactivity.invariants.test.ts` — the split-off reactivity describe
- [ ] `scripts/verify/editorShims.js` — the two-polarity shim + one-`new`-site verifier, wired as an extra `- run:` step in the `lint` job
- [ ] No framework install needed — Vitest/ESLint/dependency-cruiser/catalog deps are all present. `fast-check` is **not** needed (the three `*.property.test.ts` files stay in the editor).

**Carried-forward pre-existing flake (do not "fix" here):** the `@motajs/react-monaco-editor` teardown flake makes the `pnpm -r run test` fan-out nondeterministic (~half the time). If the fan-out reds only there with all its tests passing, retry once and say so.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Four-dependency decision (pin `es-toolkit` to `1.44.0`; add the two `@tanstack/*` catalog entries) | RES-01 | A package-manager version decision with a `SUS → too-new` rating; `04-01` Task 1 is a `checkpoint:human-verify` gate | Approve the pinned versions before the manifest edit; route any `pnpm install` through the proxy |
| `@motajs/editor` UI/behaviour visually unchanged (four editors + shell) | Regression | Phase 1 D-08 chose human comparison against the committed screenshot baseline, not automated diff | Compare against `.planning/baseline/screenshots/` per the Phase 1 baseline procedure |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < package-suite runtime
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-09-24

---

## Validation Audit 2026-09-24

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

State A (VALIDATION.md existed). Every task in `04-01..04-04` carries an `<automated>` verify; RES-01..RES-06 are all covered by passing automated tests (`uat.classify-coverage` reports every deliverable `auto_passed`; the refreshed `04-VERIFICATION.md` is `passed`, 15/15 must-haves). No `MISSING` or `PARTIAL` requirement remained, so no auditor run was needed and no test files were generated.
