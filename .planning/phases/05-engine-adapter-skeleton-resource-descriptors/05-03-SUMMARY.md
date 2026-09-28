---
phase: 05-engine-adapter-skeleton-resource-descriptors
plan: 03
subsystem: editor-core
tags: [editor-core, file-resource, opaque-address, engine-adapter, port-04, port-08, computed-resource, json-data-handler, registry, preload-order]

# Dependency graph
requires:
  - phase: 05-engine-adapter-skeleton-resource-descriptors
    provides: "05-01's adapter contract (`ResourceDescriptor` / `ResourceDependencies` / `defineEngine` / `EngineDefinitionError` / `resolvePreloadOrder`) and its `INTERFACE-NAME.md` §Plan 05-03 (CONFIRMED names)"
  - phase: 05-engine-adapter-skeleton-resource-descriptors
    provides: "05-02's `scripts/verify/coreEngineNeutral.js` gate — this plan's Task 2 verify runs it, so the fake non-mota engine must stay non-engine-vocabulary"
  - phase: 04-resource-edit-layers-moved
    provides: "the injected file layer (`FileHandler`, `FileHandlerManager`, `DataHandler`, `JsonDataHandler`, `PersistenceMonitor`) and the `MemoryFsPort` test double"
provides:
  - "`FileResource<T>` — core's ONE file-backed resource class, binding a logical id + an opaque IO address + a handler factory to an injected `FileHandlerManager` (D-06)"
  - "`lib/__tests__/engineB.ts` — a fake non-mota `EngineDescription` with `engineB.*` ids, three file-backed descriptors and one non-file (`computedResource`) descriptor"
  - "`lib/__tests__/engineB.test.ts` — end-to-end define→validate→register→get→preload-order proof plus a zero-`FsPort`-read assertion for the non-file view and a fixture-source engine-vocabulary guard"
  - "`FileResource` exported from the root `.` barrel; `coreApiSurface.test.ts` asserts it while `DIAGNOSTIC_CODES` stays exactly five"
affects: [05-04, 11]

# Actuals — chars/4 over the realized diff (base abbb8f2..HEAD)
actuals:
  tokens: 5635
  tasks: 2
  commits: 2        # measured: git rev-list --count abbb8f2..HEAD at SUMMARY write (2 atomic task commits)
plan_head_before: abbb8f2e9e8d6fa5dad512db65d85c48c31055bf

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-address-holder discipline: exactly one core class may hold an opaque IO address; it inspects no extension and joins/decodes no path, and gets the file layer via `deps.fileHandlers` (never a module singleton)"
    - "Thin façade over an existing layered facility: `FileResource` re-implements no cache, no load lock and no persistence — `FileHandlerManager` owns those, so the tested guarantees are not duplicated (T-05-10)"
    - "Source-agnostic descriptor proof: a descriptor's `create(deps)` may return a file-backed `FileResource` OR a `computedResource`; the fake engine's non-file resource makes 'content is not assumed to be a file' a machine check (T-05-09)"
    - "Fixture self-guard: the fixture reads its own raw source and scans it for banned engine terms, so a copy-paste of engine ids into the fixture reds rather than silently weakening the PORT-08 proof"

key-files:
  created:
    - packages/libs/editor-core/lib/resources/fileResource.ts
    - packages/libs/editor-core/lib/resources/__tests__/fileResource.test.ts
    - packages/libs/editor-core/lib/__tests__/engineB.ts
    - packages/libs/editor-core/lib/__tests__/engineB.test.ts
  modified:
    - packages/libs/editor-core/lib/index.ts
    - packages/libs/editor-core/lib/__tests__/coreApiSurface.test.ts

key-decisions:
  - "`FileResource.constructor(id, address, handlerFactory, deps)` obtains the per-path `FileHandler` via `deps.fileHandlers.get(address)` and builds the handler from a factory — the address never leaves the class, so the generic descriptor stays path-free (D-04/D-06)"
  - "`FileResource.ensureLoaded`/`.reload` delegate to `FileHandlerManager.load`/`.reload` so the manager's load lock and refetch semantics remain the single implementation; the class holds no cache (T-05-10)"
  - "Engine B uses core's generic `JsonDataHandler<T>` (via the test-local `EngineBJsonDataHandler` subclass) — NOT the editor's `Json2xDataHandler` — proving the generic handler is sufficient and no engine format enters core (PORT-05 boundary)"
  - "`engineB.notes` is built with `computedResource('engineB.notes', [catalog], …)` and carries no address, so loading it produces zero additional `FsPort` reads once its dependency is loaded (T-05-09)"
  - "The engine-B preload graph is genuinely multi-level (`catalog` → `index` → `chapter`, plus `catalog` → `notes`) so `resolvePreloadOrder` is validated against real topological depth, not a single edge"
  - "The `.` subpath content label stays `kernel+resources+edit-exports`; the `FileResource` value export fits the existing label, so `coreExports.js` and `subpathStatus.json` are byte-identical to their pre-task state"
  - "The fixture-source vocabulary guard uses `node:fs` with a documented `@ts-expect-error` because core does not depend on `@types/node` (runtime resolves it under vitest's node environment)"

patterns-established:
  - "Opaque-address file resource: `id` + private `address` + private handler, all IO delegated to the injected manager (D-06); core introduces no path-normalisation surface"
  - "Fake-second-engine contract proof: a test-only non-mota `EngineDescription` drives the entire adapter lifecycle with non-mota ids and at least one non-file resource (D-11/PITFALLS Pitfall 6/14)"

requirements-completed: [PORT-04, PORT-08]

# Coverage metadata — one entry per shipped deliverable.
coverage:
  - id: D1
    description: "`FileResource<T>` — core's only class holding an opaque IO address; implements `LoadableResource<T>`, delegates load/reload to the injected `FileHandlerManager`, inspects no extension and joins no path (D-06)"
    requirement: PORT-04
    verification:
      - kind: unit
        ref: "packages/libs/editor-core/lib/resources/__tests__/fileResource.test.ts (3 tests: loaded via MemoryFsPort, not-found on a missing address, reload reflects changed content with stable id)"
        status: pass
      - kind: other
        ref: "node scripts/verify/coreModuleState.js (0 error-level restricted rules) && node scripts/verify/coreBoundaries.js (0 cruise violations) && node scripts/verify/coreExports.js (7 subpaths, 9 peers, 8 singletons 单副本)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Fake non-mota engine B (`lib/__tests__/engineB.ts`) drives `defineEngine` → validation → `ResourceRegistry` → get-by-id → `resolvePreloadOrder`, with `engineB.*` ids only and a non-file `engineB.notes` resource; its tests prove loaded/not-found states and zero `FsPort` reads for the non-file view"
    requirement: PORT-08
    verification:
      - kind: unit
        ref: "packages/libs/editor-core/lib/__tests__/engineB.test.ts (9 tests: frozen adapter + declared order, register/get identity + ids(), file-backed loaded/not-found, non-file zero-read, aggregated multi-problem error, duplicate/non-function create rejected, multi-level preload order, fixture-source vocabulary guard)"
        status: pass
      - kind: other
        ref: "node scripts/verify/coreEngineNeutral.js (real tree 37 files / 0 engine-term violations; fixture two-polarity proof green)"
        status: pass
      - kind: other
        ref: "pnpm --filter @motajs/editor-core test (21 files, 183 tests, exit 0)"
        status: pass
    human_judgment: false
  - id: D3
    description: "`FileResource` re-exported from the root `.` barrel (value only, no new type) and asserted in `coreApiSurface.test.ts` while the `DIAGNOSTIC_CODES` exact-five assertion stays byte-identical"
    requirement: PORT-04
    verification:
      - kind: unit
        ref: "packages/libs/editor-core/lib/__tests__/coreApiSurface.test.ts (10 tests, incl. FileResource in the classes list and the unchanged DIAGNOSTIC_CODES five-code assertion)"
        status: pass
      - kind: other
        ref: "node scripts/verify/coreExports.js (`.` content label `kernel+resources+edit-exports` unchanged; subpathStatus.json untouched)"
        status: pass
    human_judgment: false

# Metrics
duration: 16min
completed: 2026-09-28
status: complete
---

# Phase 5 Plan 03: File-backed resource class + fake engine B Summary

**`FileResource<T>` — core's single opaque-address file-backed `LoadableResource` delegating to the injected `FileHandlerManager` — plus a fake non-mota "engine B" that drives `defineEngine` → validation → `ResourceRegistry` → get-by-id → preload order and proves the descriptor is source-agnostic via a non-file `computedResource`.**

## Performance

- **Duration:** ~16 min
- **Started:** 2026-09-28T05:06:23Z
- **Completed:** 2026-09-28T05:22:17Z
- **Tasks:** 2 (2 committed atomically)
- **Files modified:** 6 (4 created, 2 modified)

## Accomplishments

- `lib/resources/fileResource.ts` declares `export class FileResource<T> implements LoadableResource<T>` with `readonly id`/`readonly content` and PRIVATE `address`/`manager`/`handler`. It calls `deps.fileHandlers.get(address)` to obtain the per-path `FileHandler`, builds the handler through the injected factory, and delegates `ensureLoaded`/`reload` to `FileHandlerManager.load`/`.reload` and `waitForSettled` to the handler. It contains **no** extension check and **no** path concatenation — the IO address is sealed inside the one class core allows to own it (D-06, T-05-02).
- `lib/resources/__tests__/fileResource.test.ts` (3 tests, `// @vitest-environment node`) proves the three `<behavior>` cases against `MemoryFsPort`: a present file yields `{ status: 'loaded', value: { answer: 42 } }`, an absent address yields `{ status: 'not-found' }` (RES-05 preserved), and `reload()` reflects changed content while `id` stays stable.
- `lib/__tests__/engineB.ts` exports `engineBDescription` and `createEngineBDescription(deps)` — a non-mota `EngineDescription` (`engineB.catalog`/`.index`/`.notes`/`.chapter`) whose `engineB.notes` is a non-file `computedResource` over `catalog`, and whose file-backed descriptors construct core's generic `JsonDataHandler` subclass `EngineBJsonDataHandler`. Order: `catalog` (eager) → `index` (dep: catalog) → `notes` (lazy, dep: catalog, non-file) → `chapter` (dep: index).
- `lib/__tests__/engineB.test.ts` (9 tests) drives the whole chain: frozen adapter with declared order, `register`→`get` identity + `registry.ids()`; file-backed `loaded`/`not-found` through `MemoryFsPort`; a zero-`FsPort`-read assertion for `engineB.notes` (wrapping `readFile` and asserting no additional reads once `catalog` is loaded); a cyclic + dangling `preloadDependsOn` description that throws a single `EngineDefinitionError` carrying all three problems; duplicate-id and non-function-`create` rejection; `resolvePreloadOrder` returning `catalog, index, notes, chapter`; and a self-check that the fixture's raw source contains none of the ten banned engine terms.
- `lib/index.ts` re-exports `FileResource` as a value in the existing resources block; `coreApiSurface.test.ts` adds `FileResource` to its classes list. The `DIAGNOSTIC_CODES` exact-five assertion is byte-identical, and `coreExports.js`/`subpathStatus.json` are untouched.

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer, TDD): End-to-end file-backed resource — `FileResource` reads through the injected `FsPort`** - `a4f7be8` (feat)
2. **Task 2 (TDD): Fake non-mota engine B drives the contract end to end** - `d272636` (test)

**Plan metadata:** (final docs commit; see STATE/ROADMAP update)

_Note: Task 1 had an observed RED (`Cannot find module '../fileResource'`) before the GREEN implementation. Task 2's RED surfaced as the typecheck gap on the new test (missing `node:*` types, `ResourceView`-vs-`LoadableResource` narrowing) before the GREEN typing resolution._

## Verification Evidence

| Command | Result |
|---------|--------|
| `pnpm --filter @motajs/editor-core typecheck` | exit 0 |
| `pnpm --filter @motajs/editor-core exec vitest run lib/resources/__tests__/fileResource.test.ts` | exit 0 — 3/3 pass |
| `pnpm --filter @motajs/editor-core exec vitest run lib/__tests__/engineB.test.ts lib/__tests__/coreApiSurface.test.ts` | exit 0 — 9 + 10 pass |
| `pnpm --filter @motajs/editor-core test` | exit 0 — 21 files, **183 tests** pass |
| `node scripts/verify/coreEngineNeutral.js` | exit 0 — real tree 37 production files / 0 violations; two-polarity fixture hits all 10 terms, 5 clean cases 0 false positives, deleted in `finally` |
| `node scripts/verify/coreModuleState.js` | exit 0 — 0 error-level restricted-rule messages |
| `node scripts/verify/coreExports.js` | exit 0 — 7 subpaths, 9 peers, 8 singletons 单副本 |
| `node scripts/verify/coreBoundaries.js` | exit 0 — 0 cruise violations (error + warn) over 72 modules; editor→core edge direction correct |
| `pnpm typecheck` (all packages) | exit 0 |
| `pnpm lint` | exit 0 — 0 errors, 107 pre-existing warnings (none from this plan's files) |

## Files Created/Modified

- `packages/libs/editor-core/lib/resources/fileResource.ts` (created) — `FileResource<T>`: the one core class allowed to hold an opaque IO address; a thin façade over `FileHandlerManager`/`DataHandler`.
- `packages/libs/editor-core/lib/resources/__tests__/fileResource.test.ts` (created) — `MemoryFsPort`-driven loaded / not-found / reload tests.
- `packages/libs/editor-core/lib/__tests__/engineB.ts` (created) — non-mota `engineBDescription`, `createEngineBDescription(deps)`, the test-local `EngineBJsonDataHandler`, and the file-backed / non-file descriptor factories.
- `packages/libs/editor-core/lib/__tests__/engineB.test.ts` (created) — the end-to-end engine-B proof and fixture-source vocabulary guard.
- `packages/libs/editor-core/lib/index.ts` (modified) — added `export { FileResource } from './resources/fileResource';`.
- `packages/libs/editor-core/lib/__tests__/coreApiSurface.test.ts` (modified) — imported `FileResource` and added it to the classes list; all other assertions untouched.

## Decisions Made

- **`FileResource` is a pure delegate.** It re-implements no caching, load-locking or persistence; `FileHandlerManager.load`/`.reload` and the handler's own `waitForSettled` stay the single implementation, so the already-tested guarantees are not duplicated (T-05-10).
- **The address is opaque and private.** `FileResource` passes it straight to `FileHandlerManager.get`/`load`/`reload`; it never inspects an extension or joins/decodes a path — core owns no path-normalisation surface (T-05-02).
- **Engine B uses the generic `JsonDataHandler`,** not the editor's `Json2xDataHandler`, keeping the engine format out of core (PORT-05 boundary).
- **The non-file resource is the source-agnostic proof.** `engineB.notes` has no address; the zero-read assertion makes "content is not assumed to be a file" machine-checkable (T-05-09).
- **Multi-level preload graph** (`catalog`→`index`→`chapter`, `catalog`→`notes`) exercises `resolvePreloadOrder` at real depth.
- **No label change needed.** Adding the `FileResource` value export fits the existing `.` content label `kernel+resources+edit-exports`, so `coreExports.js`/`subpathStatus.json` were deliberately left byte-identical (Pitfall F avoided).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Read the fixture source despite core lacking `@types/node`**
- **Found during:** Task 2 (fixture-source vocabulary self-check)
- **Issue:** The plan asks the test to assert the fixture *source* contains no banned engine terms. Core's `package.json` declares no `@types/node`, and its tsconfig auto-includes no Node types, so `import { readFileSync } from 'node:fs'` failed `tsc` with `TS2307`. The Vite `?raw` alternative was also rejected: a wildcard `declare module '*?raw'` inside a module file triggers `TS2664`.
- **Fix:** Kept the `node:fs`/`node:url` read and suppressed only the missing-type diagnostics with a described `// @ts-expect-error` (runtime resolves the builtins under vitest's node environment). This preserves the exact source-text scan the plan required without adding a new `.d.ts` file or a new important name.
- **Files modified:** `packages/libs/editor-core/lib/__tests__/engineB.test.ts`
- **Verification:** `pnpm --filter @motajs/editor-core typecheck` exit 0; `engineB.test.ts` fixture-source guard passes; `eslint` exit 0 (the `@ts-expect-error` carries a description, satisfying `ban-ts-comment`).
- **Committed in:** `d272636` (Task 2 commit)

**2. [Rule 3 - Blocking] Narrowed the descriptor `create` result to `LoadableResource` in the test**
- **Found during:** Task 2 (typing the end-to-end assertions)
- **Issue:** `ResourceDescriptor.create(deps)` is typed to return `ResourceView<T>` (the narrower `LoadableResource` is an implementation detail), so calling `ensureLoaded`/`reload` on the created view failed `tsc` with `TS2339`.
- **Fix:** Added a `createLoadable(id, deps)` helper that awaits `create` and narrows to `LoadableResource<unknown>` (both `FileResource` and `computedResource` satisfy it); Test 2's shape assertion now checks the `ResourceView` surface instead.
- **Files modified:** `packages/libs/editor-core/lib/__tests__/engineB.test.ts`
- **Verification:** `tsc -b` exit 0; engineB suite green.
- **Committed in:** `d272636` (Task 2 commit)

**3. [Rule 2 - Missing Critical] Exercised the plan-mandated `createEngineBDescription` export**
- **Found during:** Task 2 (reviewing the fixture surface)
- **Issue:** `createEngineBDescription(deps)` is a name the plan/`INTERFACE-NAME.md` require exported, but none of the five `<behavior>` groups would have called it, leaving an untested (dead) export.
- **Fix:** Added one focused test asserting the pre-bound description keeps the declared id order and that its descriptor `create` reads through the captured manager even when handed a different (empty) dependency.
- **Files modified:** `packages/libs/editor-core/lib/__tests__/engineB.test.ts`
- **Verification:** engineB suite 9/9 pass.
- **Committed in:** `d272636` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 missing critical)
**Impact on plan:** All three are local to the new test/fixture and necessary for correctness or for honoring a mandated name. No scope creep; no production source, contract, label or manifest was altered.

## Issues Encountered

- The only real friction was TypeScript environment gaps (no Node types in core; `ResourceView` vs `LoadableResource`), both resolved locally in the test file and documented above. No behavioral surprises: `FileResource` behaved as the RESEARCH call-chain predicted on the first GREEN run.

## User Setup Required

None - no external service configuration required. No package was installed (`[T-05-SC]` — the fixture uses only `alien-signals` and existing core modules).

## Next Phase Readiness

- Core now owns exactly one file-backed resource class with the opaque address sealed inside it; the generic `ResourceDescriptor` stays path-free, which is what 05-04's mota adapter needs to build file-backed descriptors without a `path` on the descriptor.
- PORT-08's non-mota proof is in place: a second engine drives the full contract (define → validate → register → get → preload order) with non-mota ids and a non-file resource, so the extension point can be frozen with confidence (PITFALLS Pitfall 6/14).
- Open Question 1 (floor parameterization) remains deferred to 05-04's adapter factory, per the plan; the id-grammar risk for real floor ids is likewise carried to 05-04.
- All core gates are green: `coreEngineNeutral` / `coreModuleState` / `coreExports` / `coreBoundaries`, full `pnpm typecheck`, and `pnpm lint` (0 errors).

---
*Phase: 05-engine-adapter-skeleton-resource-descriptors*
*Completed: 2026-09-28*

## Self-Check: PASSED

- Promised artifacts exist: `lib/resources/fileResource.ts`, `lib/resources/__tests__/fileResource.test.ts`, `lib/__tests__/engineB.ts`, `lib/__tests__/engineB.test.ts`, `lib/index.ts` (FileResource export), `lib/__tests__/coreApiSurface.test.ts` (extended).
- Task commits exist: `a4f7be8`, `d272636` (measured 2 via `git rev-list --count abbb8f2..HEAD`).
- `scripts/verify/coreExports.js` and `.planning/phases/02-package-boundary-build-scaffolding/subpathStatus.json` are absent from the plan diff (byte-identical to pre-task state).
- `packages/apps/editor/src/project/data/projectData.ts` is absent from the plan diff (D-01 honored).
