---
phase: 04-resource-edit-layers-moved
plan: 01
subsystem: infra
tags: [editor-core, refactor, module-relocation, re-export-shims, de-singleton, persistence, dependency-cruiser, eslint-flat-config]

# Dependency graph
requires:
  - phase: 03-kernel-runtime-ports-registry-diagnostics
    provides: "@motajs/editor-core package skeleton, lib/index.ts named-export barrel, FsPort, the D-10 module-state ESLint gate and its two-polarity verifier"
  - phase: 02-package-boundary-build-scaffolding
    provides: "core package boundary, subpath set, dependency-cruiser rules and coreBoundaries.js"
provides:
  - "packages/libs/editor-core/lib/resources/{types,interfaces,errors,waitUntil,contentUtils}.ts — the five resource leaf modules, exported from the core root `.`"
  - "packages/libs/editor-core/lib/resources/{persistExecutor,persistenceMonitor}.ts — the persistence chain as classes with no module-level instance (D-06)"
  - "packages/apps/editor/src/appInstances.ts — composition-root-lite and the single `new PersistenceMonitor(` site, plus the exported `fsPort: FsPort` binding (D-07)"
  - "seven editor forward-only `// SHIM(phase4)` files keeping every legacy editor import path resolving unchanged"
  - "core dependencies ts-pattern / @tanstack/store / @tanstack/react-store / es-toolkit with two new catalog entries and es-toolkit pinned to 1.44.0"
  - "a widened core module-state ESLint ignore (all core test trees) and its proven exemption probe"
  - "a dependency-cruiser resolver config that resolves exports-only packages"
affects: [04-02, 04-03, 04-04, 05, 11]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 13847   # chars/4 over the realized diff (`git diff <ledger>..HEAD`, rename-aware: 55387 chars)
  tasks: 3
  commits: 2
  plan_head_before: eba74610f71814df8eac44c677e3ab2ff49a3fe1

tech-stack:
  added: [ts-pattern (core dependency), '@tanstack/store (core dependency + catalog)', '@tanstack/react-store (core dependency + catalog)', es-toolkit (core dependency; catalog re-pinned to 1.44.0)]
  patterns:
    - "Per-file forward-only re-export shim carrying `// SHIM(phase4)` (D-10)"
    - "De-singletonised class in core + one instance constructed in a composition-root-lite module (D-06/D-07)"
    - "Core root barrel as the union of every moved module's named exports (never `export *`)"
    - "Object.freeze({...}) to keep a module-level lookup table past the core module-state gate"

key-files:
  created:
    - packages/libs/editor-core/lib/resources/types.ts
    - packages/libs/editor-core/lib/resources/interfaces.ts
    - packages/libs/editor-core/lib/resources/errors.ts
    - packages/libs/editor-core/lib/resources/waitUntil.ts
    - packages/libs/editor-core/lib/resources/contentUtils.ts
    - packages/libs/editor-core/lib/resources/persistExecutor.ts
    - packages/libs/editor-core/lib/resources/persistenceMonitor.ts
    - packages/libs/editor-core/lib/resources/__tests__/testHelpers.ts
    - packages/libs/editor-core/lib/resources/__tests__/errors.test.ts
    - packages/libs/editor-core/lib/resources/__tests__/persistExecutor.test.ts
    - packages/libs/editor-core/lib/resources/__tests__/persistExecutor.invariants.test.ts
    - packages/libs/editor-core/lib/resources/__tests__/persistenceMonitor.test.ts
    - packages/libs/editor-core/lib/resources/__tests__/persistenceMonitor.invariants.test.ts
    - packages/apps/editor/src/appInstances.ts
  modified:
    - packages/libs/editor-core/lib/index.ts
    - packages/libs/editor-core/package.json
    - pnpm-workspace.yaml
    - pnpm-lock.yaml
    - eslint.config.js
    - scripts/verify/coreModuleState.js
    - .dependencyCruiser.cjs
    - packages/apps/editor/src/fs/types.ts
    - packages/apps/editor/src/fs/interfaces.ts
    - packages/apps/editor/src/fs/errors.ts
    - packages/apps/editor/src/fs/ContentUtils.ts
    - packages/apps/editor/src/fs/PersistExecutor.ts
    - packages/apps/editor/src/fs/PersistenceMonitor.ts
    - packages/apps/editor/src/utils/base/signal.ts

key-decisions:
  - "es-toolkit catalog entry pinned to the exact installed 1.44.0 (removes the `^1.43.0` float hazard) — approved by the user before the manifest edit"
  - "The four new core libraries are `dependencies`, never peers (coreExports.js asserts the peer set is exactly nine)"
  - "ContentUtils arrives as `Object.freeze({...})` — the module-state gate's own sanctioned remedy; a verbatim move would red `pnpm lint`"
  - "dependency-cruiser gets `exportsFields: ['exports']` + `conditionNames` so exports-only packages resolve (its own init-config template values)"
  - "The moved persistExecutor.test.ts's closure-captured status is read through an array so TypeScript can narrow it (core's tsconfig typechecks tests; the editor's does not)"

patterns-established:
  - "Shim pattern: `// SHIM(phase4)` + explicit named re-exports only; never `export *`, never `new`/`class`/`function`"
  - "Single-instance pattern: core exports the class, `src/appInstances.ts` is the only `new` site, the shim forwards the instance under the legacy name"
  - "Test-tree gate widening: the ignore glob and the verifier's exemption probe move together so the exemption is proven, not assumed"

requirements-completed: [RES-01, RES-05, RES-06]

coverage:
  - id: D1
    description: "Five resource leaf modules (Content/FileContent, ReadonlySignal/IContentView/IContentHandler/IDataHandler/RecoverableResource, isFileNotFoundError, waitUntil, ContentUtils) live in lib/resources/* and are exported from the core root `.` and every legacy editor path"
    requirement: RES-01
    verification:
      - kind: unit
        ref: "pnpm --filter @motajs/editor-core exec vitest run lib/resources/__tests__/errors.test.ts#7 tests"
        status: pass
      - kind: unit
        ref: "pnpm --filter @motajs/editor typecheck && pnpm --filter @motajs/editor exec vitest run src/utils/__tests__/signal.test.ts src/fs/__tests__/FileHandler.test.ts src/project/__tests__/resources.test.ts#34 tests"
        status: pass
    human_judgment: false
  - id: D2
    description: "PersistExecutor and PersistenceMonitor live in core as classes with no module-level instance; the four pure persistence tests pass inside core with assertions untouched"
    requirement: RES-05
    verification:
      - kind: unit
        ref: "pnpm --filter @motajs/editor-core exec vitest run lib/resources/__tests__/{persistExecutor,persistExecutor.invariants,persistenceMonitor,persistenceMonitor.invariants}.test.ts#44 tests"
        status: pass
    human_judgment: false
  - id: D3
    description: "Exactly one PersistenceMonitor instance per editor: src/appInstances.ts is the only `new PersistenceMonitor(` site and the shim forwards the same object to FileHandler, DataResource.persistStatus, UI/draft guard and tests"
    requirement: RES-06
    verification:
      - kind: integration
        ref: "pnpm --filter @motajs/editor exec vitest run src/fs/__tests__/persistNoRollback.invariants.test.ts src/project/data/__tests__/persistStatus.integration.test.ts#6 tests"
        status: pass
      - kind: other
        ref: "grep -r 'new PersistenceMonitor(' packages/apps/editor/src → only src/appInstances.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "The core module-state gate covers every core test tree and its exemption is proven by sampling a non-lib/__tests__ test file"
    verification:
      - kind: other
        ref: "node scripts/verify/coreModuleState.js (exit 0; samples lib/resources/__tests__/errors.test.ts)"
        status: pass
      - kind: other
        ref: "node scripts/verify/coreBoundaries.js (exit 0)"
        status: pass
      - kind: other
        ref: "pnpm lint (exit 0; 0 errors, 108 pre-existing warnings)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The four-dependency decision (ts-pattern, @tanstack/store, @tanstack/react-store, es-toolkit) and the exact es-toolkit: 1.44.0 pin were approved by the user before the manifest edit"
    requirement: RES-01
    verification: []
    human_judgment: true
    rationale: "A package-manager trust/version decision with a SUS(too-new) rating; Task 1 is a blocking-human checkpoint. The user approved all four items in-session from the briefing rather than from a fetched registry page, so the approval is recorded but the registry-fetch sub-step was not performed."

# Metrics
duration: 30min
completed: 2026-09-24
status: complete
---

# Phase 4 Plan 01: Resource + Edit Layers Moved — Tracer Summary

**Five resource leaf modules and the persistence chain (`PersistExecutor`/`PersistenceMonitor`) moved into `@motajs/editor-core`, de-singletonised, and kept reachable from every legacy editor import path through seven `// SHIM(phase4)` forward-only re-exports — with both programs' typechecks, both test suites and all three static gates green.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-09-24T05:24:04Z
- **Completed:** 2026-09-24T05:53:37Z
- **Tasks:** 3 (Task 1 checkpoint pre-approved; Tasks 2–3 executed)
- **Files modified:** 28 (13 created, 15 modified/renamed)

## Accomplishments

- The whole relocation architecture is proven end-to-end on the lowest-risk files: package manifest → `lib/resources/*` → root barrel → editor shim → editor consumer → both `tsc -b` programs green.
- `ContentUtils` arrived as `Object.freeze({...})` so the D-10 module-state gate stays green; the gate's ignore list now covers every core test tree and `coreModuleState.js` *proves* the widened exemption by sampling `lib/resources/__tests__/errors.test.ts`.
- `PersistenceMonitor` is de-singletonised (class only) and `src/appInstances.ts` is the single `new` site — the editor's `persistNoRollback.invariants` and `persistStatus.integration` suites stay green through the shim, which is the observable two-polarity proof that one shared instance survives the move.
- The four moved persistence tests run inside core with byte-identical assertion counts (29/18/32/24) and no `@test/*` import.
- The two new catalog entries and the four `dependencies` edges were written through the mandated proxy; `es-toolkit` resolves to exactly `1.44.0`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Checkpoint — confirm the four core dependencies and the es-toolkit pin** - *(no commit — `checkpoint:human-verify`, pre-approved in-session)*
2. **Task 2 (tracer): one resource leaf end-to-end** - `331918c` (feat)
3. **Task 3: de-singleton the persistence chain + `src/appInstances.ts`** - `d9ca7da` (feat)

**Plan metadata:** *(this SUMMARY commit, below)*

## Files Created/Modified

- `packages/libs/editor-core/lib/resources/{types,interfaces,errors,waitUntil}.ts` - verbatim moves of the editor leaf modules
- `packages/libs/editor-core/lib/resources/contentUtils.ts` - moved, exported object wrapped in `Object.freeze`
- `packages/libs/editor-core/lib/resources/persistExecutor.ts` - `PersistExecutor` + `PersistenceIntent` + `ExecutorStatus`; only import rewrite is `./waitUntil`
- `packages/libs/editor-core/lib/resources/persistenceMonitor.ts` - `PersistenceMonitor` + `PersistFailure`; trailing module-level `new` deleted
- `packages/libs/editor-core/lib/resources/__tests__/{errors,persistExecutor,persistExecutor.invariants,persistenceMonitor,persistenceMonitor.invariants}.test.ts` - moved tests, assertions untouched, `// @vitest-environment node` docblock added
- `packages/libs/editor-core/lib/resources/__tests__/testHelpers.ts` - core-local `wait(ms)` (no `@test/*`)
- `packages/libs/editor-core/lib/index.ts` - named re-exports of all ten leaf names + all five persistence names
- `packages/libs/editor-core/package.json` - new `dependencies` block
- `pnpm-workspace.yaml` / `pnpm-lock.yaml` - two `@tanstack/*` catalog entries; `es-toolkit` re-pinned to `1.44.0`
- `packages/apps/editor/src/fs/{types,interfaces,errors,ContentUtils,PersistExecutor,PersistenceMonitor}.ts` + `src/utils/base/signal.ts` - forward-only `// SHIM(phase4)` re-exports
- `packages/apps/editor/src/appInstances.ts` - `fsPort: FsPort = fs.promises` (no cast) + `persistenceMonitor = new PersistenceMonitor()`
- `eslint.config.js` - Block B `ignores` widened to all core test trees (three entries)
- `scripts/verify/coreModuleState.js` - exemption probe extended to sample a non-`lib/__tests__` test tree
- `.dependencyCruiser.cjs` - `enhancedResolveOptions` enabling `exports` resolution

## Decisions Made

- **`es-toolkit` pinned to `1.44.0`** (exact) rather than left as `^1.43.0`, per PROJECT.md's "catalog 固定依赖版本" constraint and the `SUS(too-new)` version-float hazard.
- **The four libraries go in `dependencies`, never `peerDependencies`** — `coreExports.js` asserts the peer set is exactly the nine PKG-02 names.
- **`ContentUtils` is frozen, not converted to named exports** — ~30 editor call sites use the namespace, and `Object.freeze` is the gate's documented remedy.
- **dependency-cruiser resolver enabled for `exports`** — see Deviation 1.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `coreBoundaries.js` could not resolve `alien-signals`**

- **Found during:** Task 2 (tracer), static-gate verify
- **Issue:** `coreBoundaries.js` printed the forbidden `core 出现非 @styled-system 的未解析说明符：lib/resources/waitUntil.ts → alien-signals`. dependency-cruiser's `DEFAULT_RESOLVE_OPTIONS` sets `exportsFields: []` (for enhanced-resolve 4 compatibility), so any `exports`-only package (no `main`/`module`/`default` condition) is unresolvable. `waitUntil.ts` imports `effect` from `alien-signals@3.1.2`, which is exactly that shape. The plan did not anticipate this (its research only considered `@styled-system/*`).
- **Fix:** added `enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'require', 'node', 'default', 'types'] }` to `.dependencyCruiser.cjs` — verbatim the values dependency-cruiser's own `init-config` template (`src/cli/init-config/config-template.mjs:300-304`) recommends. No rule was weakened; the gate resolves *more*, not less.
- **Files modified:** `.dependencyCruiser.cjs`
- **Verification:** `node scripts/verify/coreBoundaries.js` exit 0 (`全部断言通过`), including the synthetic-violation and PKG-03 polarity checks; `pnpm lint` still 0 errors.
- **Committed in:** `331918c` (Task 2 commit)

**2. [Rule 1 - Bug] Latent type error in the moved `persistExecutor.test.ts`**

- **Found during:** Task 3, core typecheck
- **Issue:** `if (errorStatus!.status === 'error') { expect(errorStatus!.error.message)… }` does not narrow: TypeScript does not narrow a reference through a `!` non-null assertion, and it flow-types the closure-assigned `let errorStatus` as `null`. The editor never caught this because `tsconfig.app.json` **excludes** test files; core's `tsconfig.json` **includes** `lib`, so core's `tsc -b` typechecks the moved tests and failed with TS2339.
- **Fix:** capture the observed statuses into `const errorStatuses: ExecutorStatus[] = []` inside the `effect`, then `const errorStatus = errorStatuses.at(-1) ?? null;` and narrow a plain identifier (`if (errorStatus && errorStatus.status === 'error')`). The assertion text `expect(errorStatus.error.message).toBe('Test error')` is preserved and the file's `expect(` count is unchanged (29 → 29).
- **Files modified:** `packages/libs/editor-core/lib/resources/__tests__/persistExecutor.test.ts`
- **Verification:** `pnpm --filter @motajs/editor-core typecheck` green; the suite's 18 tests pass.
- **Committed in:** `d9ca7da` (Task 3 commit)

**3. [Task 1, per approval terms] Registry-fetch sub-step not performed**

- **Found during:** Task 1 (checkpoint)
- **Issue:** the checkpoint's `<how-to-verify>` asks the executor to fetch and paste each package's npm landing page before the human makes the trust call. The user instead approved all four items (the four `dependencies`, the two `@tanstack/*` catalog entries, the exact `es-toolkit: 1.44.0` re-pin, and the proxy-routed install) from the in-session briefing.
- **Fix:** recorded the approval and proceeded; the registry landing pages were **not** fetched/pasted.
- **Files modified:** none
- **Verification:** installed versions read from `pnpm-lock.yaml` (`es-toolkit@1.44.0`, `@tanstack/store@0.8.0`, `@tanstack/react-store@0.8.0`, `ts-pattern@5.9.0`).
- **Committed in:** n/a (checkpoint)

### Non-deviations worth recording

- **`packages/libs/editor-core/vitest.config.ts` was listed in the plan but needed no change.** Its `include: ['lib/**/*.test.{ts,tsx}']` already covers `lib/resources/__tests__/**`, and the per-file `// @vitest-environment node` docblock handles the environment. Left untouched.
- **Two incidental pre-existing lockfile repoints.** `pnpm install` re-pointed `@typescript-eslint/*` snapshots from `ignore@7.0.5`→`7.0.6` and `semver@7.7.3`→`7.8.5`. Both target versions already existed in the lockfile (used elsewhere), so this is a re-resolution, not a version float; `es-toolkit` stayed exactly `1.44.0` (one version, `rg es-toolkit@ pnpm-lock.yaml`).

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug) + 1 approval-terms note
**Impact on plan:** All auto-fixes were necessary for the gates to be green; neither weakened a gate nor changed editor behaviour. No scope creep.

## Issues Encountered

- **Self-inflicted JSDoc terminator bug.** My first edit to `eslint.config.js` (and `scripts/verify/coreModuleState.js`) put the glob `lib/**/__tests__/**` inside a block comment — the `*/` in `**/` closed the comment early, so Node failed to parse the config (`Unexpected token '.'`) and `pnpm lint` died. Fixed by rephrasing the comments to avoid any `*/` sequence. Not a plan deviation; caught and fixed before the Task 2 commit.
- **`findstr` with space-separated patterns is an OR**, which briefly produced a misleading "many `new PersistenceMonitor(` sites" dump. Re-checked with literal `/c:` patterns: the only site is `src/appInstances.ts`.

## User Setup Required

None - no external service configuration required. The one network operation (`pnpm install`) was run through the mandated proxy `http://127.0.0.1:7890`.

## Next Phase Readiness

- The relocation mechanics (manifest → core dir → root barrel → editor shim → editor consumer → both programs green) are proven; 04-02 can move `FileHandler`/`FileHandlerManager`/`DataHandler`/`JsonDataHandler`/`BinaryFileHandler` and the combinators on the same rails.
- `src/appInstances.ts` already carries the exported `fsPort: FsPort` binding that 04-02's `FileHandlerManager` construction will read.
- The `editorShims.js` "one `new` site" verifier (04-04) is the remaining enforcement half of the de-singleton work; until then the single instance is guarded by the two editor integration suites.
- No blockers.

---

*Phase: 04-resource-edit-layers-moved*
*Completed: 2026-09-24*

## Self-Check: PASSED

- All 13 created files + the SUMMARY file exist on disk.
- Both task commits exist: `331918c` (Task 2, tracer), `d9ca7da` (Task 3).
- Measured commits from the plan ledger (`eba7461`): 2.
- Working tree clean (no untracked files); no unexpected deletions.
