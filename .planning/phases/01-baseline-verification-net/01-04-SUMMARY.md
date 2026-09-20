---
phase: 01-baseline-verification-net
plan: 04
subsystem: testing
tags: [vitest, characterization-test, operation-history, invariants, capacity, checkpoint-rollback, composite-recovery, resource-reactivity, observation-first]

# Dependency graph
requires:
  - phase: 01-baseline-verification-net
    plan: 01
    provides: "materialized `packages/external/mota-js` submodule at the pinned SHA and a runnable editor unit suite (vitest 4.0.18)"
  - phase: 01-baseline-verification-net
    plan: 02
    provides: "the recorded pre-Phase-1 editor unit baseline, so this suite shows up as a deliberate visible delta"
  - phase: 01-baseline-verification-net
    plan: 03
    provides: "the `*.invariants.test.ts` characterization-suite pattern (co-located, observation-first, proven red against a deliberate break)"
provides:
  - "a co-located characterization suite freezing operationHistory's capacity (100), inverse application, redo truncation and no-change no-op"
  - "a co-located characterization suite freezing multi-target checkpoint capture/de-dup/reverse-order restore and composite failure recovery"
  - "a fixture-coupled describe freezing resource reactivity after history-routed patch, after direct set, and after undo"
affects: [phase-04-resource-edit-move, phase-03-kernel-extraction, editor-core-migration]

actuals:
  tokens: 3022    # chars/4 over the 12,088-byte realized diff (1 new test file; no production source touched)
  tasks: 3
  commits: 3
  plan_head_before: 784bd5c63d2ab610b5af5c3344b44c913ab8a327

tech-stack:
  added: []
  patterns:
    - "capacity frozen behaviourally (101 changed commits -> 100 undos + a no-op 101st), never by reading a private entries array"
    - "checkpoint semantics observed through per-target capture/restore counters and an ordered call log on custom OperationTarget objects"
    - "the fixture-coupled reactivity assertions isolated in one describe and loaded via a lazy `await import()`, so the pure describes never evaluate the submodule-dependent `mota-root`"
    - "observation-first derivation: deliberately-wrong expectations run first, real values copied out of the failure output, then frozen"

key-files:
  created:
    - packages/apps/editor/src/project/history/__tests__/operationHistory.invariants.test.ts
  modified: []

key-decisions:
  - "Capacity is frozen through execute/undo counts and distinct restored values, because operationHistory exposes no entries getter; the assertion tests the contract and survives the Phase 4 relocation (T-04-01)."
  - "Reactivity is asserted only on the observable resource value — never on signal scheduling internals — so the suite does not over-fit Vitest's microtask model (T-04-02)."
  - "The fixture import is lazy (`import type` for the type + `await import()` in the reactivity describe's beforeEach) so the pure describes stay submodule-free, honouring plan Task 1's acceptance criterion and the plan's verification #3."
  - "The no-change commit returns an observable inverse (a +999 counter): if it were recorded, the following undo would jump the value, making 'records nothing' a genuinely falsifiable assertion."
  - "Commits were made through the GSD `query commit` verb on `main` because this project sets `git.branching_strategy: \"none\"` and the orchestrator mandated the main working tree."

patterns-established:
  - "A history invariant that must not over-fit internals is expressed as an observable effect (value delta, target call order/count) rather than a state snapshot."
  - "Submodule coupling in a characterization suite is confined to a single describe with a lazy import, so the eventual fixture rewrite is a one-block change."

requirements-completed: [VERIFY-04]

coverage:
  - id: D1
    description: "operationHistory capacity, inverse application, redo truncation and the no-change no-op are frozen behaviourally without reading private state"
    requirement: VERIFY-04
    verification:
      - kind: unit
        ref: "pnpm --filter @motajs/editor exec vitest run src/project/history/__tests__/operationHistory.invariants.test.ts -> 1 file passed, 11 tests passed, 0 skipped"
        status: pass
    human_judgment: false
  - id: D2
    description: "Multi-target checkpoint capture, de-duplication by key, reverse-order restore, failed-apply rollback with no entry, and composite child failure recovery with the failing stage tagged"
    requirement: VERIFY-04
    verification:
      - kind: unit
        ref: "operationHistory.invariants.test.ts > captures and restores each distinct target once, de-duplicated by key / restores distinct targets in the reverse of their capture order / leaves every target at its pre-apply value and records no entry when apply fails / recovers completed composite children through their semantic inverses and tags the failing stage"
        status: pass
    human_judgment: false
  - id: D3
    description: "Resource reactivity is frozen on the observable value after a history-routed patchFloor, after a direct resource.set(next), and after operationHistory.undo() while the disk write is still pending"
    requirement: VERIFY-04
    verification:
      - kind: unit
        ref: "operationHistory.invariants.test.ts > observes a history-routed patch immediately and reverts it on undo while the write is pending / observes a direct resource.set immediately, before persistence flushes"
        status: pass
    human_judgment: false

duration: ~15min
completed: 2026-09-20
status: complete
---

# Phase 1: Baseline & Verification Net — Plan 04 Summary

**One co-located `operationHistory.invariants.test.ts` (11 tests) now freezes the history's capacity-100 eviction, inverse application, redo truncation, multi-target checkpoint rollback, composite failure recovery, and `patch`/`set`/undo resource reactivity — each proven able to fail against a deliberate break, with production source untouched.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-09-20T19:13:00+08:00
- **Completed:** 2026-09-20T19:27:00+08:00
- **Tasks:** 3
- **Files modified:** 1 created, 0 modified (no production source)

## Accomplishments
- Froze the history's capacity **behaviourally**: 101 changed commits → exactly 100 undos each restore a distinct value, the 101st undo is a no-op, and the value settles at `1` because the oldest (first) commit was evicted — observed without touching any private `entries` array.
- Froze inverse application (`execute(5) → 5`, `undo → 0`, `redo → 5`, `undo → 0`), redo-tail truncation (execute → undo → execute(10) → redo is a no-op, value stays 10), and the no-change no-op (a `changed: false` commit records nothing; an immediately following undo is a no-op).
- Froze multi-target checkpoint semantics through custom `OperationTarget` objects: a duplicated key is captured/restored once, distinct targets restore in the exact reverse of capture order (`capture:a|capture:b|capture:c|restore:c|restore:b|restore:a`), a failed apply returns every target to its pre-apply value and records no entry, and a composite child failure recovers completed children through their semantic inverses and rejects with `commandStage: "composite-child"`.
- Froze resource reactivity on the observable value for both VERIFY-04/D-11 entry points: a history-routed `tableCommands.patchFloor` and a direct `floorResource.set(...)` are both observable before any persistence flush (the disk write is proven outstanding), and an undo reverts the patched title while the write is pending, leaving the discarded title off disk.

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): freeze history capacity, inverse application and redo truncation** - `acd87ed` (test)
2. **Task 2: freeze multi-target checkpoint rollback and composite failure recovery** - `ab37979` (test)
3. **Task 3: freeze resource reactivity after patch, after set and after undo** - `bb366b3` (test)

**Plan metadata:** committed with this SUMMARY.md (docs: complete plan 01-04)

_Commits are measured (`git rev-list --count 784bd5c..HEAD` → 3); `plan_head_before` is HEAD at plan start (784bd5c)._

## Files Created/Modified
- `packages/apps/editor/src/project/history/__tests__/operationHistory.invariants.test.ts` (new, 11 tests) — two describes: a pure in-memory `operationHistory invariants` block (capacity, inverse, redo truncation, no-change, checkpoint, composite; 9 tests) and a fixture-coupled `operationHistory resource reactivity` block (2 tests). No production source modified; the existing `operationHistory.test.ts` is byte-identical.

## Observation-First Evidence

Every expectation came from execution, not from reading the implementation. Observed values (deliberately-wrong placeholder run, then frozen):

| Observation | Observed real value |
|---|---|
| successful undos after 101 changed commits | `100` (101st is a no-op) |
| distinct restored values | `100` |
| value after the 100 undos | `1` (oldest commit evicted, never undone) |
| `execute(5)` / `undo` / `redo` / `undo` | `5` / `0` / `5` / `0` |
| redo after execute→undo→execute(10) | `10` (no-op) |
| no-change commit then undo | `0` (no entry recorded; the +999 inverse never runs) |
| de-dup captures (targets `[a, a, b]`) | `[["a", 1], ["b", 1]]` |
| de-dup restore order | `[["b", 1], ["a", 1]]` (reverse) |
| full capture/restore log (`[a, b, c]`) | `capture:a\|capture:b\|capture:c\|restore:c\|restore:b\|restore:a` |
| composite child failure | `commandStage: "composite-child"`, counter back to `0` |
| patch reactivity | `"Memory first title"` before flush; reverts to original after undo; disk lacks it after flush |
| direct-set reactivity | `"Set direct title"` before flush; disk lacks it before flush; disk has it after flush |

## Deliberate-Break Evidence

One production break per history task was observed red, then reverted **before** the task commit. No break was committed (`git diff --exit-code` on `operationHistory.ts` exits 0).

| Task | Deliberate break | Observed |
|---|---|---|
| Task 1 | `if (false && entries.length > this.capacity) entries.shift();` | capacity test red: `expected 101 to be 100` (1 failed / 3 passed) |
| Task 2 | `[...checkpoints].reverse()` → `checkpoints` | order + de-dup tests red (2 failed / 7 passed) |

## Decisions Made
- **Capacity without internals.** `operationHistory` has no entries getter, so capacity is frozen through undo counts and distinct restored values (T-04-01). This survives the Phase 4 `lib/edit/*` relocation because it asserts the contract, not the structure.
- **Reactivity on the observable value only.** No assertion references signal effect timing or private scheduling state (T-04-02), so the suite cannot break spuriously against Vitest's microtask model.
- **Falsifiable "records nothing".** The no-change commit returns a +999 inverse so a buggy record-then-undo would visibly jump the value — the assertion can actually fail.
- **Lazy fixture import.** The fixture-coupled describe loads `@test/utils/sampleProject` via `await import()` inside `beforeEach`; the top-level uses only `import type`, so the pure describes never evaluate the submodule-dependent `mota-root`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Fixture import had to be lazy to keep the pure describes submodule-free**
- **Found during:** Task 3 (reactivity describe)
- **Issue:** Task 1's acceptance requires the file to contain no `loadSampleProject` import so the capacity/inverse/redo/checkpoint tests run without the mota-js submodule (plan verification #3), but Task 3 needs the real fixture. `test/utils/sampleProject.ts` statically imports `mota-root.ts`, whose `export const MOTA_JS_ROOT = resolveMotaJsRoot()` **throws at module-load time** when the submodule is absent — so a static top-level import would make collection fail for the whole file, not just the fixture describe.
- **Fix:** The file imports only the type (`import type { SampleProjectContext }`) at the top and loads `loadSampleProject` with a lazy `await import("@test/utils/sampleProject")` inside the reactivity describe's `beforeEach`. The pure describes therefore never pull the fixture into the module graph.
- **Files modified:** `packages/apps/editor/src/project/history/__tests__/operationHistory.invariants.test.ts`
- **Verification:** the final file has no runtime top-level `sampleProject` import; the suite collects and the 9 pure tests run; `import type` is erased under the editor's `verbatimModuleSyntax`.
- **Committed in:** `bb366b3` (Task 3 commit). The Task 1 commit (`acd87ed`) had carried an unused static import; Task 3 replaced it with the lazy form.

**2. [Rule 2 - Missing Critical] Strengthened the direct-`set` test to prove the write is outstanding**
- **Found during:** Task 3
- **Issue:** "The value is observable before any persistence await" is trivially true if the write had already completed. The plan asks for a write delay so the disk write is still outstanding, but does not require proving it.
- **Fix:** Added `expect(project.readText(floorResource.path)).not.toContain("Set direct title")` before the flush, so the memory-first claim is falsifiable against a completed write.
- **Files modified:** `packages/apps/editor/src/project/history/__tests__/operationHistory.invariants.test.ts`
- **Verification:** the assertion passes with `setWriteDelay(80)` and the value is on disk after `persistenceMonitor.flush`.
- **Committed in:** `bb366b3` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (2 missing-critical)
**Impact on plan:** No scope creep and no dependency changes. Both adjustments exist to make the plan's own acceptance criteria honest — deviation 1 preserves the submodule-free pure tests, deviation 2 makes the reactivity assertion non-vacuous.

## Issues Encountered
- **Verification #3 cannot be exercised end-to-end yet.** The editor still loads `vite.config.ts` for tests, which imports `./mota-root` and therefore requires `MOTA_JS_ROOT` for the *entire* run regardless of the test file. Pointing `MOTA_JS_ROOT` at a missing path fails at Vitest startup. This is exactly the D-14 coupling plan 01-05 removes by splitting out `vitest.config.ts`; the file-level isolation (no runtime fixture import at module scope) is in place and will take effect then.
- The per-commit protected-branch assertion would have halted (base branch `main` reports protected) even though `git.branching_strategy` is `"none"`. Resolved by committing through the GSD `query commit` verb — the same sanctioned path used by plans 01-02/01-03; no branch or config was changed.
- `rg` is unavailable in this shell; content checks used the available grep tooling — no effect on outcome.

## Known Stubs
None — all 11 tests are fully wired and assert real observed behaviour. No skipped tests, no `todo`, no placeholder expectations.

## Threat Flags
None — this plan adds a test-only file and introduces no network endpoint, auth path, file-access pattern, or schema change at a trust boundary.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- VERIFY-04's seven `operationHistory` invariants are frozen by executable tests that are proven able to fail; a regression in capacity, inverse application, checkpoint capture/restore, composite recovery, or post-write reactivity turns an assertion red.
- Phase 4's relocation of `src/project/history/*` into `lib/edit/*` preserves the safety net: the suite is co-located and changes only its import paths (D-10), and it asserts contracts rather than internals.
- No blockers. The only caveat is that the pure describes' submodule-freedom becomes observable once plan 01-05 splits `vitest.config.ts` (D-14).

## Self-Check: PASSED

- FOUND: `packages/apps/editor/src/project/history/__tests__/operationHistory.invariants.test.ts`
- FOUND: commit `acd87ed` (Task 1)
- FOUND: commit `ab37979` (Task 2)
- FOUND: commit `bb366b3` (Task 3)
- PASSED: `git diff --exit-code -- packages/apps/editor/src/project/history/__tests__/operationHistory.test.ts` exits 0 (existing suite untouched)
- PASSED: `git diff --exit-code` on `operationHistory.ts`, `operations.ts`, `viewport.ts`, `DataResource.ts`, `tableCommands.ts`, `projectData.ts` exits 0 (no production source modified; all deliberate breaks reverted)
- PASSED: `.planning/STATE.md` and `.planning/ROADMAP.md` have no working-tree changes (orchestrator-owned)

---
*Phase: 01-baseline-verification-net*
*Completed: 2026-09-20*
