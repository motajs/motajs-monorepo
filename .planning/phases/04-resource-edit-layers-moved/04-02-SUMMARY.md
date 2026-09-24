---
phase: 04-resource-edit-layers-moved
plan: 02
subsystem: resources
tags: [editor-core, refactor, module-relocation, dependency-injection, de-singleton, re-export-shims, fs-port, combinators]

# Dependency graph
requires:
  - phase: 04-resource-edit-layers-moved
    plan: 01
    provides: "lib/resources leaf modules (types/interfaces/errors/waitUntil/contentUtils), the persistence chain as classes (PersistExecutor/PersistenceMonitor), `FsPort`, `src/appInstances.ts` with the `fsPort`/`persistenceMonitor` bindings, the `// SHIM(phase4)` re-export pattern, and the two static gates (coreBoundaries.js / coreModuleState.js)"
provides:
  - "packages/libs/editor-core/lib/resources/fileHandler.ts — `FileHandler` + `FileHandlerDependencies` (constructor-injected `FsPort` + `PersistenceMonitor`, no default, flat calls only)"
  - "packages/libs/editor-core/lib/resources/fileHandlerManager.ts — per-instance `FileHandlerManager` class (no trailing `new`, no `FileHandlerManagerImpl`)"
  - "packages/libs/editor-core/lib/resources/{dataHandler,jsonDataHandler,binaryFileHandler}.ts — the data/binary handler layer, `BinaryFileHandler` taking an injected `FsPort`"
  - "packages/libs/editor-core/lib/resources/combinators.ts — `ResourceView`/`LoadableResource`/`ComputedResource`/`computedResource`/`aggregateResource`/`optional` (the module 04-04's `ResourceRegistry` will import)"
  - "packages/libs/editor-core/lib/resources/__tests__/memoryFsPort.ts — the flat seven-operation `FsPort` test double (D-14) with the four fault-injection knobs"
  - "packages/libs/editor-core/lib/resources/__tests__/contentSignalLiveness.test.ts — the RES-06 liveness proof for both `FileHandler` and `DataHandler`/`JsonDataHandler`"
  - "packages/apps/editor/src/appInstances.ts — the single `new FileHandlerManagerClass(...)` site (the only manager instance in the editor)"
  - "seven editor forward-only `// SHIM(phase4)` files keeping every legacy editor import path resolving unchanged"
affects: [04-03, 04-04, 05, 11]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 21688   # chars/4 over the realized diff (`git diff -M <ledger>..HEAD`: 86751 chars)
  tasks: 3
  commits: 3
  plan_head_before: 2ebffb5db8482885c3b7594b1b0a1b246309b441

tech-stack:
  added: []   # no new dependency: this plan consumed the injection seam, not a package
  patterns:
    - "Constructor-injected collaborators object (`FileHandlerDependencies`) shared by `FileHandler` and `FileHandlerManager` so the two arguments can never be transposed (D-07)"
    - "De-singletonised class in core + one instance constructed in a composition-root-lite module; the editor shim forwards the INSTANCE under the legacy name (D-06/D-07)"
    - "Module-local import alias (`FileHandlerManagerClass`) to let the exported instance keep the legacy editor name without TS2440"
    - "Flat `FsPort` reached through the retained `fs` field name so `(handler as any).fs = <port>` fixture pokes keep working with only a value change (D-05)"
    - "RES-06 proven by capturing the `content` callable BEFORE a mutation, then re-invoking the SAME callable after it"

key-files:
  created:
    - packages/libs/editor-core/lib/resources/fileHandler.ts
    - packages/libs/editor-core/lib/resources/fileHandlerManager.ts
    - packages/libs/editor-core/lib/resources/dataHandler.ts
    - packages/libs/editor-core/lib/resources/jsonDataHandler.ts
    - packages/libs/editor-core/lib/resources/binaryFileHandler.ts
    - packages/libs/editor-core/lib/resources/combinators.ts
    - packages/libs/editor-core/lib/resources/__tests__/memoryFsPort.ts
    - packages/libs/editor-core/lib/resources/__tests__/contentSignalLiveness.test.ts
    - packages/libs/editor-core/lib/resources/__tests__/fileHandler.test.ts
    - packages/libs/editor-core/lib/resources/__tests__/fileHandlerManager.test.ts
    - packages/libs/editor-core/lib/resources/__tests__/resources.test.ts
  modified:
    - packages/libs/editor-core/lib/index.ts
    - packages/apps/editor/src/fs/FileHandler.ts
    - packages/apps/editor/src/fs/FileHandlerManager.ts
    - packages/apps/editor/src/fs/DataHandler.ts
    - packages/apps/editor/src/fs/JsonDataHandler.ts
    - packages/apps/editor/src/fs/BinaryFileHandler.ts
    - packages/apps/editor/src/project/resources.ts
    - packages/apps/editor/src/appInstances.ts
    - packages/apps/editor/test/utils/sampleProject.ts
    - packages/apps/editor/src/services/tower/__tests__/towerService.test.ts
    - packages/apps/editor/src/project/commands/__tests__/floorCommands.test.ts
    - packages/apps/editor/src/services/tableMeta/__tests__/tableMetaService.test.ts
  deleted:
    - packages/apps/editor/src/fs/__tests__/FileHandler.test.ts
    - packages/apps/editor/src/fs/__tests__/FileHandlerManager.test.ts
    - packages/apps/editor/src/project/__tests__/resources.test.ts

key-decisions:
  - "`FileHandler` declares `private readonly persistenceMonitor: PersistenceMonitor` and assigns all three fields in the constructor BODY — the deps-object form needs the field, and a parameter property would trip `erasableSyntaxOnly: true` (inherited from the editor's program) with TS1294"
  - "`MemoryFsPort.readFile`/`writeFile`/`mkdir` declare FEWER parameters than `FsPort` requires — TypeScript arity compatibility keeps `implements FsPort` satisfied while avoiding three new `@typescript-eslint/no-unused-vars` warnings that `_`-prefixing does not suppress"
  - "The moved `fileHandlerManager.test.ts` imports the core class as `FileHandlerManagerClass` and holds a per-test `let FileHandlerManager` instance, so all 30+ `FileHandlerManager.get(...)` / `FileHandlerManager.clear()` call sites stay byte-identical"
  - "The moved `resources.test.ts` uses direct sibling-relative imports (`../interfaces`, `../types`, `../combinators`, `../waitUntil`) rather than the plan's `../../resources/*` round-trip — identical resolved targets, consistent with the sibling moved `fileHandler.test.ts`"
  - "`src/appInstances.ts` uses the confirmed module-local alias `FileHandlerManagerClass` for the core class so the exported instance keeps the legacy name `FileHandlerManager` (a same-scope import + export-const of one name is TS2440)"
  - "No important name was invented; every name used is already in INTERFACE-NAME.md (MemoryFsPort, memoryFsPort.ts, contentSignalLiveness.test.ts, FileHandlerManagerClass, and the lowerCamelCase file convention)"

patterns-established:
  - "Deps-object injection: `FileHandlerDependencies { readonly fs: FsPort; readonly persistenceMonitor: PersistenceMonitor }` is the single object shared by the handler and its manager"
  - "Moved-test adaptation recipe: swap `@test/*` for core-local helpers, replace the module singleton with a per-test `new PersistenceMonitor()`, and keep every `expect(...)` byte-identical"
  - "Liveness assertion recipe: capture the derived callable before the mutation and assert the SAME callable reflects the new value after it"

requirements-completed: [RES-01, RES-03, RES-05, RES-06]

coverage:
  - id: D1
    description: "`FileHandler` has exactly one constructor form `(path, deps)`; no default `Fs`, no second positional parameter, no `fs.promises.*` call under `lib/resources/`; the `fs` field name is retained"
    requirement: RES-03
    verification:
      - kind: typecheck
        ref: "pnpm --filter @motajs/editor-core typecheck && pnpm --filter @motajs/editor typecheck"
        status: pass
      - kind: unit
        ref: "pnpm --filter @motajs/editor-core exec vitest run lib/resources/__tests__/fileHandler.test.ts#23 tests"
        status: pass
      - kind: other
        ref: "rg -n 'fs\\.promises|defaultFs' packages/libs/editor-core/lib → no matches"
        status: pass
    human_judgment: false
  - id: D2
    description: "`FileHandlerManager` is a per-instance class with per-instance handler maps; the module exports no trailing instance and no `FileHandlerManagerImpl`; the editor holds exactly one manager, built in `src/appInstances.ts`"
    requirement: RES-03
    verification:
      - kind: unit
        ref: "pnpm --filter @motajs/editor-core exec vitest run lib/resources/__tests__/fileHandlerManager.test.ts#20 tests"
        status: pass
      - kind: other
        ref: "rg -c 'new FileHandlerManagerClass\\(' packages/apps/editor → exactly 1 (src/appInstances.ts); rg -n 'new FileHandlerManager\\(' packages/apps/editor → no matches; rg -n 'FileHandlerManagerImpl|export const FileHandlerManager' packages/libs/editor-core/lib → no matches"
        status: pass
    human_judgment: false
  - id: D3
    description: "`FileHandlerManager` drives handlers with the same shared deps it was constructed with, and the four adapted editor fixtures keep passing through the shim"
    requirement: RES-05
    verification:
      - kind: integration
        ref: "pnpm --filter @motajs/editor exec vitest run test/utils/sampleProject.ts src/services/tower/__tests__/towerService.test.ts src/project/commands/__tests__/floorCommands.test.ts src/services/tableMeta/__tests__/tableMetaService.test.ts#34 tests (sampleProject.ts itself declares no tests; its fixture is exercised by the other three and by sampleProjectCommands)"
        status: pass
      - kind: integration
        ref: "pnpm --filter @motajs/editor exec vitest run src/fs/__tests__/persistNoRollback.invariants.test.ts src/project/data/__tests__/persistStatus.integration.test.ts src/project/commands/__tests__/sampleProjectCommands.test.ts src/services/tower/__tests__/towerService.test.ts src/project/commands/__tests__/floorCommands.test.ts src/services/tableMeta/__tests__/tableMetaService.test.ts#85 tests"
        status: pass
    human_judgment: false
  - id: D4
    description: "`DataHandler`/`JsonDataHandler`/`BinaryFileHandler` and the three combinators are exported from the core root `.`; the editor reaches every one unchanged through a shim, and `Json2xDataHandler`/`ScriptDataHandler` still inherit core's `DataHandler`"
    requirement: RES-01
    verification:
      - kind: typecheck
        ref: "pnpm --filter @motajs/editor-core typecheck && pnpm --filter @motajs/editor typecheck"
        status: pass
      - kind: unit
        ref: "pnpm --filter @motajs/editor-core exec vitest run lib/resources/__tests__/resources.test.ts#5 tests"
        status: pass
      - kind: integration
        ref: "pnpm --filter @motajs/editor exec vitest run src/project/__tests__/resources.test.ts src/project/commands/__tests__/sampleProjectCommands.test.ts#50 tests"
        status: pass
      - kind: other
        ref: "node scripts/verify/coreBoundaries.js (exit 0) + node scripts/verify/coreModuleState.js (exit 0)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every resource still exposes `ReadonlySignal<Content<T>>` derived by `signal`/`computed` — proven by re-invoking a callable captured before the mutation"
    requirement: RES-06
    verification:
      - kind: unit
        ref: "pnpm --filter @motajs/editor-core exec vitest run lib/resources/__tests__/contentSignalLiveness.test.ts#4 tests"
        status: pass
    human_judgment: false

# Metrics
duration: 25min
completed: 2026-09-24
status: complete
---

# Phase 4 Plan 02: Resource Edit Layers Moved — Injection Seam + Data/Combinator Move Summary

**The resource layer's injection seam moved into core: `FileHandler` is constructor-injected through a `FileHandlerDependencies` object, `FileHandlerManager` is a per-instance class with exactly one instance built in `src/appInstances.ts`, and `DataHandler`/`JsonDataHandler`/`BinaryFileHandler` plus the resource combinators were relocated and re-exported from the core root `.` — with both programs' typechecks, the full 137-test core suite, the full 794-test editor suite, and both static gates green.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3 (Task 1 tracer; Tasks 2–3 executed after the tracer gate passed)
- **Files created:** 11 · **modified:** 12 · **deleted:** 3 (all three deletes are the moved originals)
- **Commits:** 3

## Accomplishments

- `FileHandler` no longer reads a module singleton or a nested `Fs`: its only constructor form is `(path, deps: FileHandlerDependencies)`, it persists through the flat `this.fs.writeFile` / `this.fs.deleteFile` / `this.fs.readFile`, and it schedules through `this.persistenceMonitor`. `rg 'fs\.promises|defaultFs'` over `packages/libs/editor-core/lib` is empty.
- `FileHandlerManager` is de-singletonised: `FileHandlerManagerImpl` and the trailing `export const FileHandlerManager = new …` line are gone, and `get` now passes `this.deps` straight into `new FileHandler(path, this.deps)` so the pair can never have its arguments transposed. The editor constructs exactly one instance, in `src/appInstances.ts`, under the module-local alias `FileHandlerManagerClass`.
- The 23 `new FileHandler(` sites in the moved suite are all in the `{ fs, persistenceMonitor }` deps-object form and every assertion moved byte-identical; the manager suite keeps all its call sites unchanged by holding a per-test `let FileHandlerManager` instance.
- `DataHandler` (with its `computed`-derived `content` and all three `update` overloads) and `JsonDataHandler` moved verbatim; `BinaryFileHandler` took the injected `FsPort` with no default and no fallback, keeping its browser `Blob`/`URL`/`Image` decode per D-12.
- `lib/resources/combinators.ts` is now the single home of `ResourceView<T>`/`LoadableResource<T>` — the module 04-04's `ResourceRegistry` will import — and the editor's five `@/project/resources` call sites compile unchanged.
- RES-06 is now proven rather than asserted: `contentSignalLiveness.test.ts` captures the derived callable before a mutation and re-invokes the *same* callable afterwards, for both the file layer and the data layer.

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): injected `FileHandler`/`FileHandlerManager` chain works end-to-end in one commit** — `371a504` (feat)
2. **Task 2: move the data/binary handler layer and forward it through shims** — `f007c75` (feat)
3. **Task 3: move the resource combinators into `lib/resources/combinators.ts`** — `4724758` (feat)

**Plan metadata:** *(this SUMMARY commit, below)*

## Files Created/Modified

- `packages/libs/editor-core/lib/resources/fileHandler.ts` — `FileHandler` (3 `update` overloads, `waitForLoaded`/`waitForSettled`/`isLoaded`, the `isFileNotFoundError` branch) + the new `FileHandlerDependencies` interface; the `fs` field name retained, now typed `FsPort`
- `packages/libs/editor-core/lib/resources/fileHandlerManager.ts` — per-instance `FileHandlerManager` class (`get`/`load`/`loadAll`/`has`/`exists`/`isLoaded`/`delete`/`remove`/`reload`/`clear`/`size`)
- `packages/libs/editor-core/lib/resources/{dataHandler,jsonDataHandler,binaryFileHandler}.ts` — the data/binary layer
- `packages/libs/editor-core/lib/resources/combinators.ts` — `ResourceView`/`LoadableResource`/`ComputedResource`/`computedResource`/`aggregateResource`/`optional` + the module-private `aggregateContents`/`DependencySource`/`ResourceValue`/`ResourceValues`
- `packages/libs/editor-core/lib/resources/__tests__/memoryFsPort.ts` — `MemoryFsPort` (seven flat ops + `setWriteDelay`/`setWriteError`/`setWriteErrorForPath`/`getWriteCount`/`setFile`/`getFile`/`hasFile`/`clear`/`size`)
- `packages/libs/editor-core/lib/resources/__tests__/contentSignalLiveness.test.ts` — 4 RES-06 liveness cases (3 file-layer, 1 data-layer)
- `packages/libs/editor-core/lib/resources/__tests__/{fileHandler,fileHandlerManager,resources}.test.ts` — moved suites, assertions untouched
- `packages/libs/editor-core/lib/index.ts` — named re-exports of the 3 classes, the `FileHandlerDependencies` type, and the 6 `combinators.ts` names (values vs `export type`)
- `packages/apps/editor/src/fs/{FileHandler,FileHandlerManager,DataHandler,JsonDataHandler,BinaryFileHandler}.ts` + `src/project/resources.ts` — forward-only `// SHIM(phase4)` re-exports (the manager shim forwards the INSTANCE from `@/appInstances`)
- `packages/apps/editor/src/appInstances.ts` — added the single `export const FileHandlerManager = new FileHandlerManagerClass({ fs: fsPort, persistenceMonitor })`
- `packages/apps/editor/test/utils/sampleProject.ts` + `towerService.test.ts` + `floorCommands.test.ts` + `tableMetaService.test.ts` — deps-object constructor, flat `fs` object passed directly, `persistenceMonitor` imported from `@/fs/PersistenceMonitor`

## Decisions Made

- **`FileHandler` gained an explicit `private readonly persistenceMonitor: PersistenceMonitor` field.** The deps-object form needs somewhere to keep the monitor, and the plan's Task-1 action (e)–(h) only implied it. Assigned in the constructor body, never a parameter property — the editor's program (`erasableSyntaxOnly: true`) typechecks core's sources too, so a parameter property would fail with TS1294.
- **`MemoryFsPort` methods declare fewer parameters than `FsPort`.** `readFile(path)`, `writeFile(path, content)`, `mkdir()` satisfy `implements FsPort` by TypeScript arity compatibility and avoid three new `no-unused-vars` warnings (the rule has no `argsIgnorePattern`, so `_`-prefixing does not help).
- **The moved manager suite holds a per-test `let FileHandlerManager`.** The core class is imported aliased as `FileHandlerManagerClass`, so all 30+ `FileHandlerManager.…` call sites stay byte-identical while the object under test is a fresh instance.
- **The shims are explicit named re-exports, never `export *`.** Both `src/fs/index.ts`'s `export *` of its two shims resolve `FileHandlerDependencies` to the same core declaration, so no TS2308 ambiguity arises (verified by a green editor `tsc -b`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `MemoryFsPort` arity vs. new lint warnings**

- **Found during:** Task 1, `eslint` on the new core files
- **Issue:** implementing the seven `FsPort` operations with their exact signatures produced three `@typescript-eslint/no-unused-vars` warnings (`_encoding`, `_encoding`, `_path`) because the repo's rule carries no `argsIgnorePattern`. The plan's acceptance criterion only requires the seven operations to exist, but intentionally adding warnings to a tree that must stay at "0 errors" is avoidable noise.
- **Fix:** dropped the unused trailing parameters (`readFile(path)`, `writeFile(path, content)`, `mkdir()`), which `implements FsPort` accepts by arity compatibility; `readFileBinary` now calls `this.readFile(path)`.
- **Files modified:** `packages/libs/editor-core/lib/resources/__tests__/memoryFsPort.ts`
- **Verification:** `pnpm --filter @motajs/editor-core typecheck` green; `eslint` on the file reports 0 problems.
- **Committed in:** `371a504` (Task 1)

**2. [Rule 2 - Correctness] Dropped the unused `wait` import from the moved manager suite**

- **Found during:** Task 1, while rewriting the moved test's imports
- **Issue:** the original `FileHandlerManager.test.ts` imported `wait` from `@test/utils/testHelpers` but never called it (0 occurrences in the pre-move file). The plan says to rewrite "the two `@test/*` imports", and core may not alias `@test/*`; carrying the import across as `./testHelpers` would be a new unused-import warning.
- **Fix:** dropped the `wait` import; `testHelpers.ts` (the core-local `wait`) remains for the moved `fileHandler.test.ts`, which does use it.
- **Files modified:** `packages/libs/editor-core/lib/resources/__tests__/fileHandlerManager.test.ts`
- **Verification:** 20/20 moved manager tests pass; `eslint` on core reports no new warnings from this file.
- **Committed in:** `371a504` (Task 1)

### Minor plan-shape differences (not defects)

- **`resources.test.ts` import style.** The plan spelled the moved test's imports as `../../resources/interfaces` / `../../resources/types` / `../combinators` (a round-trip through `lib/`). The file uses the direct siblings `../interfaces` / `../types` / `../combinators` / `../waitUntil` — the same resolved targets, consistent with the sibling moved `fileHandler.test.ts`. No acceptance criterion references the spelling.
- **`test/utils/sampleProject.ts` declares no tests.** Task 1's second `<verify>` lists it alongside three real suites; vitest reports "3 passed (3 files)" because a helper module has no test cases. Its fixture is exercised end-to-end by `sampleProjectCommands.test.ts` (45 tests) and `persistNoRollback.invariants.test.ts`, both run green in this plan.

### Non-deviations worth recording

- **The pre-existing `(handler, i)` unused-parameter warning moved with the test.** `fileHandlerManager.test.ts:153` carries the same unused `i` the editor original had; D-13 forbids touching moved assertions, and the warning is inherited, not introduced.
- **`Json2xDataHandler.ts`, `ScriptDataHandler.ts` and `src/fs/index.ts` are byte-identical to their pre-task state** (verified with `git diff --numstat`, empty). The two handlers keep inheriting core's `DataHandler` through the `./DataHandler` shim.

## Issues Encountered

- **`pnpm --filter @motajs/editor exec vitest run … test/utils/sampleProject.ts` silently skips the helper.** Expected — it is not a test file. Confirmed the fixture instead through `sampleProjectCommands.test.ts` + `persistNoRollback.invariants.test.ts`.
- **`rg` is not on PATH in this shell.** Static checks were run through the Grep tool and `findstr /c:` (space-separated `findstr` patterns are an OR and would have mis-counted).

## Names

No new important name was invented. Every name written into code is already confirmed in
`INTERFACE-NAME.md`: `MemoryFsPort`, `lib/resources/__tests__/memoryFsPort.ts`,
`lib/resources/__tests__/contentSignalLiveness.test.ts`, `FileHandlerManagerClass`,
`FileHandlerDependencies`, `FileHandlerManager`, and the lowerCamelCase file names
(`fileHandler.ts`, `fileHandlerManager.ts`, `dataHandler.ts`, `jsonDataHandler.ts`,
`binaryFileHandler.ts`, `combinators.ts`). Nothing is proposed for confirmation.

## User Setup Required

None — no external service configuration and no network operation. No package install was needed (`04-01` had already materialised every dependency).

## Next Phase Readiness

- `lib/resources` now exposes the whole engine-neutral resource layer from the root `.`; 04-03 can move `lib/edit/*` on the same rails (the shim pattern, the per-instance class + composition-root-lite instance, and the "assertions untouched" test-move recipe are all proven twice over).
- `lib/resources/combinators.ts` is the single source of `ResourceView<T>` / `LoadableResource<T>` that 04-04's `ResourceRegistry` will import.
- The one-`new`-site invariant for `FileHandlerManager` is currently guarded only by this plan's static check; 04-04's `scripts/verify/editorShims.js` is the durable enforcement half.
- `src/appInstances.ts` is the ready mounting point for 04-03's `operationHistory` instance and its viewport `UndoSystem` registration.
- No blockers.

---

*Phase: 04-resource-edit-layers-moved*
*Completed: 2026-09-24*

## Self-Check: PASSED

- All 11 created files + this SUMMARY exist on disk.
- All 3 moved originals (`src/fs/__tests__/FileHandler.test.ts`, `src/fs/__tests__/FileHandlerManager.test.ts`, `src/project/__tests__/resources.test.ts`) are gone from the editor.
- All 3 task commits exist: `371a504` (Task 1, tracer), `f007c75` (Task 2), `4724758` (Task 3).
- Measured commits from the plan ledger (`2ebffb5`): 3; diff 86751 chars → `actuals.tokens` 21688.
- No unexpected deletions beyond the three intended ones; no untracked files other than this SUMMARY.
