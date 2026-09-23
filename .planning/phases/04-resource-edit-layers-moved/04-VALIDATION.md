---
phase: "4"
slug: "resource-edit-layers-moved"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-23"
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `04-RESEARCH.md` §Validation Architecture. Task IDs are filled by the planner.

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
| **Estimated runtime** | ~core suite seconds-scale; editor suite is the slower one (submodule fixture) |

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
| TBD (planner) | — | — | RES-01 | — | `Content<T>` five-state, `FileHandler`/`DataHandler`/`BinaryFileHandler`, combinators live in `lib/resources/*` and behave identically | unit | `pnpm --filter @motajs/editor-core exec vitest run lib/resources/__tests__/FileHandler.test.ts lib/resources/__tests__/resources.test.ts` | ❌ W0 (moved) | ⬜ pending |
| TBD (planner) | — | — | RES-01 | — | `BinaryFileHandler`/`JsonDataHandler` exported from root `.` and constructible with an `FsPort` | unit + export-surface | `pnpm --filter @motajs/editor-core exec vitest run lib/__tests__/coreApiSurface.test.ts` (extended) | ⚠ extend existing | ⬜ pending |
| TBD (planner) | — | — | RES-02 | T-4-01 (prototype pollution) | `ResourceRegistry` registers by logical id, rejects duplicates, returns a working disposer, snapshots entries; two instances independent; `Map`-backed | unit | `pnpm --filter @motajs/editor-core exec vitest run lib/resources/__tests__/resourceRegistry.test.ts` | ❌ W0 (new) | ⬜ pending |
| TBD (planner) | — | — | RES-03 | T-4-02 (cross-instance leakage) | `FileHandlerManager` is per-instance: two managers do not share handlers; the editor's single instance still returns one handler per path | unit | `pnpm --filter @motajs/editor-core exec vitest run lib/resources/__tests__/FileHandlerManager.test.ts` **and** `pnpm --filter @motajs/editor exec vitest run src/fs/__tests__/FileHandlerManager.test.ts` | ❌ W0 (moved) | ⬜ pending |
| TBD (planner) | — | — | RES-04 | — | `EditorOperation`/`compositeOperation`/`operationHistory` capacity 100, inverse ops, multi-target checkpoint + rollback | unit | `pnpm --filter @motajs/editor-core exec vitest run lib/edit/__tests__/operationHistory.invariants.test.ts` | ❌ W0 (moved, split) | ⬜ pending |
| TBD (planner) | — | — | RES-04 | — | Same invariants end to end through the shims and the real fixture | integration | `pnpm --filter @motajs/editor exec vitest run src/project/history/__tests__/operationHistory.test.ts` | ✅ exists (unchanged) | ⬜ pending |
| TBD (planner) | — | — | RES-05 | T-4-03 (silent data loss) | memory-first ≠ saved / single write path | unit + integration | core `… vitest run lib/resources/__tests__/persistExecutor.invariants.test.ts`; editor `… vitest run src/fs/__tests__/persistNoRollback.invariants.test.ts` | ✅ exists (one moving, one staying) | ⬜ pending |
| TBD (planner) | — | — | RES-05 | — | per-path serialization (one executing + one pending) | unit | `… vitest run lib/resources/__tests__/persistExecutor.invariants.test.ts` | ❌ W0 (moved) | ⬜ pending |
| TBD (planner) | — | — | RES-05 | T-4-03 | not-found ≠ error | unit | `… vitest run lib/resources/__tests__/errors.test.ts` + the `project-not-found` case in `FileHandler.test.ts` | ❌ W0 (moved) | ⬜ pending |
| TBD (planner) | — | — | RES-06 | — | `ReadonlySignal<Content<T>>` is a live signal, not a snapshot | unit | new assertion in `lib/resources/__tests__/*` (captured callable returns new state; no effect/snapshot faking) | ❌ W0 (new assertion) | ⬜ pending |
| TBD (planner) | — | — | RES-06 | — | hook-driven reactivity survives across the package boundary | integration | `pnpm --filter @motajs/editor exec vitest run src/hooks/__tests__/*` + the `operationHistory` reactivity describe | ✅ exists | ⬜ pending |
| TBD (planner) | — | — | RES-01/RES-04 | T-4-04 (gate bypass) | core has no module-level mutable binding; `lib/resources`/`lib/edit` reachable from `.` | static gate + two-polarity | `pnpm lint` (Block B, widened ignores) + `node scripts/verify/coreModuleState.js` | ✅ exists (needs ignore widening) | ⬜ pending |
| TBD (planner) | — | — | RES-03 | T-4-02 | exactly one `new FileHandlerManager(` / `new PersistenceMonitor(` / `new OperationHistory(` site in `packages/apps/editor/src` | static gate + two-polarity | `node scripts/verify/editorShims.js` in the `lint` job | ❌ W0 (new) | ⬜ pending |
| TBD (planner) | — | — | Regression | T-4-04 | every shim is forward-only and tracked; the list is exactly the expected set | static gate + two-polarity | `node scripts/verify/editorShims.js` | ❌ W0 (new) | ⬜ pending |
| TBD (planner) | — | — | Regression | — | `@motajs/editor` behaviour unchanged; Phase 1 baseline holds | full suite | `pnpm typecheck && pnpm test && pnpm build` + `node scripts/verify/editorArtifactAssets.js` | ✅ exists | ⬜ pending |
| TBD (planner) | — | — | Regression | — | the four-job contract was not altered | static | `node scripts/verify/ci-workflow.js` | ✅ exists | ⬜ pending |
| TBD (planner) | — | — | Regression | — | `@/` never reappears inside core; relative edges all resolve inside core | static | `node scripts/verify/coreBoundaries.js` | ✅ exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/libs/editor-core/lib/resources/__tests__/` — the moved pure tests (`errors`, `FileHandler`, `FileHandlerManager`, `PersistenceMonitor`, `PersistExecutor`, both `*.invariants`, `resources`) with deps-object construction and no `@test/*` imports
- [ ] `packages/libs/editor-core/lib/resources/__tests__/<fs double>.ts` — the flat `FsPort` double with the four fault-injection knobs (D-14); plus a 2-line `wait` helper (or one shared test-helpers file)
- [ ] `packages/libs/editor-core/lib/resources/__tests__/resourceRegistry.test.ts` — RES-02
- [ ] `packages/libs/editor-core/lib/edit/__tests__/operationHistory.invariants.test.ts` — the 9 moved pure invariants, instance-based
- [ ] A RES-06 signal-liveness assertion (can live inside the moved `FileHandler.test.ts` or a new file)
- [ ] `packages/apps/editor/src/project/history/__tests__/operationHistory.reactivity.invariants.test.ts` — the split-off reactivity describe
- [ ] `scripts/verify/editorShims.js` — the two-polarity shim + one-`new`-site verifier, wired as an extra `- run:` step in the `lint` job
- [ ] No framework install needed — Vitest/ESLint/dependency-cruiser/catalog deps are all present. `fast-check` is **not** needed if A5 holds.

**Carried-forward pre-existing flake (do not "fix" here):** the `@motajs/react-monaco-editor` teardown flake makes the `pnpm -r run test` fan-out nondeterministic (~half the time). If the fan-out reds only there with all its tests passing, retry once and say so.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `@motajs/editor` UI/behaviour visually unchanged (four editors + shell) | Regression | Phase 1 D-08 chose human comparison against the committed screenshot baseline, not automated diff | Compare against `.planning/baseline/screenshots/` per the Phase 1 baseline procedure |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < package-suite runtime
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
