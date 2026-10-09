---
phase: 04-resource-edit-layers-moved
plan: 04
subsystem: infra
tags: [editor-core, resource-registry, dependency-cruiser, verifier, two-polarity, shim-inventory, subpath-contract, ci-workflow]

# Dependency graph
requires:
  - phase: 04-resource-edit-layers-moved
    plan: 01
    provides: "the `// SHIM(phase4)` shim pattern, `src/appInstances.ts` (the single `new PersistenceMonitor(` site), and the verifier family (coreBoundaries.js / coreModuleState.js)"
  - phase: 04-resource-edit-layers-moved
    plan: 02
    provides: "lib/resources/combinators.ts (`ResourceView<T>` — the type the registry stores) and the single `new FileHandlerManagerClass(` site"
  - phase: 04-resource-edit-layers-moved
    plan: 03
    provides: "lib/edit/*, the single `new OperationHistory(` site, and the `UndoSystem` seam registration in appInstances.ts"
  - phase: 03-kernel-runtime-ports-registry-diagnostics
    provides: "lib/kernel/core.ts (register-returns-a-disposer + frozen-snapshot shape to mirror) and DIAGNOSTIC_CODES (the exact-five table the registry must not couple to)"
provides:
  - "packages/libs/editor-core/lib/resources/resourceRegistry.ts — RES-02 `ResourceRegistry` class + `ResourceRegistryEntry`, Map-backed, form-validating, disposer-returning, frozen snapshot, delivered UNWIRED"
  - "packages/libs/editor-core/lib/resources/__tests__/resourceRegistry.test.ts — 9 unit tests incl. two-instance isolation and Object.prototype non-pollution"
  - "scripts/verify/editorShims.js — the two-polarity shim inventory + exact-3-new-site verifier, wired as one extra step in the existing lint job"
  - ".dependencyCruiser.cjs — retargeted `singletons-only-imported-by-composition-root` (raw editor specifiers) + new `resources-edit-must-not-import-capabilities`"
  - "the truthful `kernel+resources+edit-exports` subpath record (coreExports.js + subpathStatus.json) and the extended root `.` export-surface assertions"
affects: [05, 11, 12]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 8503   # chars/4 over the realized diff (`git diff -M <ledger>..HEAD`: 34013 chars)
  tasks: 3
  commits: 3
  plan_head_before: 13bdc2e6c3a866c2f8732a7388a98c9af839e972

tech-stack:
  added: []   # no new dependency: RES-02 is new construction over the existing ResourceView<T>
  patterns:
    - "Map-backed logical-id registry that throws plain Errors (decoupled from DiagnosticBus) so the exact-five DIAGNOSTIC_CODES table stays untouched (Pitfall 10)"
    - "Comment-stripping collection/checker split so a two-polarity proof invokes the same functions against a synthetic fixture without re-running the whole script"
    - "Verifier exactness both ways: set EQUALITY on the shim inventory (drift detected) and an exact construction-site COUNT (a zero-hit vacuous run cannot pass)"

key-files:
  created:
    - packages/libs/editor-core/lib/resources/resourceRegistry.ts
    - packages/libs/editor-core/lib/resources/__tests__/resourceRegistry.test.ts
    - scripts/verify/editorShims.js
  modified:
    - packages/libs/editor-core/lib/index.ts
    - packages/libs/editor-core/lib/__tests__/coreApiSurface.test.ts
    - .dependencyCruiser.cjs
    - .github/workflows/ci.yml
    - scripts/verify/coreExports.js
    - .planning/phases/02-package-boundary-build-scaffolding/subpathStatus.json

key-decisions:
  - "`ResourceRegistry.snapshot()` freezes the array AND each entry; `ResourceRegistry.ids()` returns a fresh (unfrozen) array — mirrors the plan's split wording"
  - "Id validation rejects `''`, any whitespace, `a/b`, `a..b`, and the exact reserved names `__proto__`/`constructor`/`prototype` before storage; a dotted namespace form (`mota.tower`) is accepted"
  - "The construction-site scan strips comments before matching, so the JSDoc mention of `new PersistenceMonitor(` in `src/appInstances.ts:5` is not counted — the exact-3 assertion is about construction sites, not documentation"
  - "The retargeted dependency-cruiser rule matches RAW editor import specifiers (`@/project/data/projectData` etc.) and its comment records that the editor half is deliberately dormant-by-target until Phase 11; `editorShims.js` carries the Phase-4-real guard"
  - "No important name was invented; every name written into code is already confirmed in INTERFACE-NAME.md (`ResourceRegistry`, `ResourceRegistry.register/get/getOrThrow/has/ids/snapshot`, `editorShims.js`, `EXPECTED_SHIMS`, `APP_INSTANCE_MODULE`, `singletons-only-imported-by-composition-root`, `resources-edit-must-not-import-capabilities`, `kernel+resources+edit-exports`)"

patterns-established:
  - "Comment-stripping state machine (block + line comments, string/template aware) shared by the inventory forward-only check and the construction-site scan"
  - "Two-polarity verifier that re-invokes pure collector/checker functions against self-deleting fixtures and asserts the process still exits 0 on the real tree"

requirements-completed: [RES-02, RES-01, RES-03, RES-04, RES-05, RES-06]

# Coverage metadata (#1602) — one entry per shipped deliverable.
coverage:
  - id: D1
    description: "`ResourceRegistry` supports generic logical-id registration, rejects duplicate and malformed ids with plain Errors, returns a working disposer (with a stale-disposer guard) and a frozen snapshot, and keeps two instances independent — all Map-backed and delivered unwired from `projectData` (RES-02/T-04-01/T-04-02)"
    requirement: RES-02
    verification:
      - kind: unit
        ref: "pnpm --filter @motajs/editor-core exec vitest run lib/resources/__tests__/resourceRegistry.test.ts#9 tests"
        status: pass
      - kind: other
        ref: "node scripts/verify/coreModuleState.js (exit 0; real tree 56 files, 0 error-level restricted messages) + pnpm lint (exit 0, 0 errors)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The 'exactly one `new` site per de-singletonised class' invariant and the tracked-shim inventory are machine-enforced inside the existing `lint` job: `editorShims.js` proves both polarities, and the retargeted + new dependency-cruiser rules keep `lib/resources`/`lib/edit` inside the DAG (RES-03/D-08/D-10/T-04-04/T-04-13)"
    requirement: RES-03
    verification:
      - kind: other
        ref: "node scripts/verify/editorShims.js (exit 0; 18 markers == EXPECTED_SHIMS, 17 shims forward-only, exactly 3 construction sites all in src/appInstances.ts, both fixtures failed as required and were removed)"
        status: pass
      - kind: other
        ref: "node scripts/verify/coreBoundaries.js (exit 0; 65 modules / 109 deps / 0 violations) && node scripts/verify/ci-workflow.js (exit 0; 4-job contract intact)"
        status: pass
      - kind: other
        ref: "node scripts/verify/lint-severities.js (exit 0; 45 eslint-disable comments all carry reasons)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The root `.` subpath record is truthful (`kernel+resources+edit-exports` in both `coreExports.js` and `subpathStatus.json`, no new subpath) and the complete Phase-4 root export surface is machine-asserted from `lib/index.ts` while `DIAGNOSTIC_CODES` stays exactly five (RES-01/Pitfall 10/11)"
    requirement: RES-01
    verification:
      - kind: other
        ref: "pnpm --filter @motajs/editor-core typecheck && node scripts/verify/coreExports.js (exit 0; 7 subpaths, 9 peers, 8 singletons)"
        status: pass
      - kind: unit
        ref: "pnpm --filter @motajs/editor-core exec vitest run lib/__tests__/coreApiSurface.test.ts#8 tests (incl. the untouched exact-five assertion)"
        status: pass
    human_judgment: false
  - id: D4
    description: "`@motajs/editor` UI/behaviour is visually unchanged (workbench shell, floor edit + reload persistence, viewport undo/redo, no spurious persistence failure) against `.planning/baseline/screenshots/`"
    requirement: RES-05
    verification: []
    human_judgment: true
    rationale: "The only manual-only verification in 04-VALIDATION.md; it needs a running dev server and a human visual comparison. The executor cannot perform it, and no automated diff substitutes for it. Recorded in .planning/WINDOWS.md as an open `unrun-verify` entry."

# Metrics
duration: 25min
completed: 2026-09-24
status: complete
---

# Phase 4 Plan 04: Resource Edit Layers Moved — `ResourceRegistry` + Machine Gates + Phase Record Summary

**RES-02's `ResourceRegistry` arrived as a Map-backed, form-validating, disposer-returning class delivered unwired, while the phase's two falsifiable claims — "exactly one `new` site per de-singletonised class" and "the tracked shim inventory is exactly these eighteen files" — became a two-polarity `editorShims.js` gate inside the existing `lint` job, and the root `.` subpath record was corrected to `kernel+resources+edit-exports` in the same commit as its machine assertion.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-24T07:53Z (approx.)
- **Completed:** 2026-09-24T08:20Z (approx.)
- **Tasks:** 3
- **Files changed:** 9 (3 created, 6 modified) — 712 insertions, 10 deletions

## Accomplishments

- `ResourceRegistry` is the one piece of genuinely new construction in Phase 4 and it is **unwired**: `projectData` is untouched, so RES-05's resource-creation timing is unchanged. It mirrors `createEditorCore`'s shape (register returns a disposer that only deletes its own entry; `snapshot()` returns a frozen array of frozen entries) and is deliberately decoupled from `DiagnosticBus`, so the exact-five `DIAGNOSTIC_CODES` assertion in `coreApiSurface.test.ts` never reds. Prototype-pollution safety is a `Map` plus an explicit reserved-name/id-form rejection (`__proto__`, `constructor`, `prototype`, empty, whitespace, `/`, `a..b`), proven by a test that asserts `Object.prototype` was not polluted.
- `scripts/verify/editorShims.js` is a real gate, not a rubber stamp: it asserts **set equality** between the eighteen `// SHIM(phase4)` files on disk and a hard-coded `EXPECTED_SHIMS` list (a new shim must be registered deliberately; a deleted shim is noticed — this is Phase 11's deletion inventory), it asserts each of the seventeen forwarders is **forward-only** (has a re-export, has no `new`/`class`/`function`), it asserts the construction-site count is **exactly three** and every hit is inside `src/appInstances.ts`, and it proves both polarities with self-deleting fixtures whose absence is asserted afterwards.
- The retargeted `singletons-only-imported-by-composition-root` rule now matches **raw import specifiers** (`@/project/data/projectData`, `@/project/model/projectModel`, `@/services/editorConfig` plus relative forms) because dependency-cruiser does not resolve the `@/` alias in this repo; its Chinese comment states honestly that the editor half is dormant-by-target until Phase 11 and that `editorShims.js` carries the Phase-4-real enforcement. A new `resources-edit-must-not-import-capabilities` rule closes the DAG gap the existing `kernel-...` rule left for the two new directories.
- The four-job CI contract is provably unaltered (`ci-workflow.js` exit 0) and the new step lives inside the existing `lint` job next to `coreBoundaries.js` / `coreModuleState.js`.
- The two-file subpath contract (`coreExports.js` + `subpathStatus.json`) now truthfully records `kernel+resources+edit-exports`, and `coreApiSurface.test.ts` asserts the complete root `.` surface: 10 classes, 21 values (incl. the `ContentUtils` object), and 22 type-only names — while its five original assertions, including the exact-five diagnostic table, remain byte-identical.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build `ResourceRegistry` (RES-02) and its unit tests, unwired** — `d2510d6` (feat)
2. **Task 2: Install the two machine gates: the retargeted singleton rule and the shim verifier** — `6878dfb` (feat)
3. **Task 3: Close the phase record: truthful subpath content, extended export surface, full-suite gate** — `78f860c` (docs)

**Plan metadata:** *(this SUMMARY commit, below)*

## Files Created/Modified

- `packages/libs/editor-core/lib/resources/resourceRegistry.ts` — `ResourceRegistry` + `ResourceRegistryEntry`; `ResourceRegistry.register/get/getOrThrow/has/ids/snapshot`; Map-backed instance storage; `assertValidLogicalId`; no `DiagnosticBus` import
- `packages/libs/editor-core/lib/resources/__tests__/resourceRegistry.test.ts` — 9 tests (read-back, unknown-id behaviours, `getOrThrow` throw, duplicate rejection + survivor, stale-disposer guard, frozen snapshot, two-instance isolation, id-form rejections + `Object.prototype` non-pollution, accepted single/multi-segment names)
- `packages/libs/editor-core/lib/index.ts` — two added named re-exports (`ResourceRegistry`, type `ResourceRegistryEntry`)
- `scripts/verify/editorShims.js` — the five assertion groups (inventory set-equality, forward-only, exact-3 construction sites, two-polarity, cleanup + absence) with a comment-stripping state machine
- `.dependencyCruiser.cjs` — rule renamed/retargeted to `singletons-only-imported-by-composition-root` with a raw-specifier `to.path`; new `resources-edit-must-not-import-capabilities`; all seven rules `severity: 'error'`
- `.github/workflows/ci.yml` — one added `- run: node scripts/verify/editorShims.js` step in the `lint` job
- `scripts/verify/coreExports.js` — `SUBPATH_CONTENT['.']` → `kernel+resources+edit-exports` (+ its doc comment)
- `.planning/phases/02-package-boundary-build-scaffolding/subpathStatus.json` — `subpaths['.'].content` → the same value, note corrected
- `packages/libs/editor-core/lib/__tests__/coreApiSurface.test.ts` — 3 tests added; the original five assertions untouched

## Decisions Made

- **The construction-site scan strips comments before matching.** A raw textual scan of `src/appInstances.ts` yields four matches because a JSDoc line mentions `new PersistenceMonitor(`; only three are actual construction sites. Counting documentation as a construction site would be wrong, so the verifier removes block and line comments (string/template-aware) before counting. The exact-3 assertion is thus about code, and the raw `findstr` result (4 lines) is expected.
- **`ResourceRegistry.ids()` returns a fresh, unfrozen array while `ResourceRegistry.snapshot()` freezes.** The plan words them differently ("returns a fresh array" vs "FROZEN array of frozen entry objects"); implemented literally.
- **The retargeted rule's `from.pathNot` names only `src/appInstances.ts`** (per the plan), not the research's placeholder `(appInstances|composition)` pair.

## Deviations from Plan

### Minor plan-shape differences (not defects)

- **Comment-stripping made the exact-3 assertion truthful.** The plan's step 4 says the scan's "total hit count is exactly three". Taken naively over raw text it is four (one JSDoc mention). The verifier strips comments first, so the assertion holds for construction sites — the plan's and research §Q6b's intent ("markdown-free scan").
- **`docs` commit type for Task 3.** Task 3 changes `.planning/…/subpathStatus.json`, the verifier constant, and the export-surface test — it is a record/assertion change with no production behaviour, so it is typed `docs` rather than `feat`/`test`.

### Non-deviations worth recording

- **`pnpm test` reds only on the known `@motajs/react-monaco-editor` teardown flake.** Its 2 files / 6 tests all pass; Vitest reports 2 unhandled teardown rejections (`Closing rpc while "fetch" was pending`) raised from `monaco-editor`'s `javascript.js`. Retried once as the plan instructs — the retry red the same way. Because `pnpm -r run test` aborts the fan-out on that failure, the editor app and packer suites were re-run directly and are green: `@motajs/editor` 89 files / 785 tests, `@motajs/packer` 9 files / 94 tests. Every other package with a `test` script was green in the fan-out (`editor-core` 18/158, `service-worker` 8/44, `react-hooks` 2/3, `react-store` 1/3, `file2x` 1 file, `h5animate` 8 files). `@motajs/utils` has no `test` script (hence `pnpm -r` scope "12 of 13").
- **`packages/apps/editor/src/fs/index.ts` and `src/project/history/index.ts` are barrel files, not `// SHIM(phase4)` shims,** so they are correctly outside `EXPECTED_SHIMS` (the marker set is exactly the eighteen files, verified).

## Issues Encountered

- **`@motajs/react-monaco-editor` fan-out flake** — documented above; retried once, then all aborted suites run directly.
- **`cmd` parse-time `%errorlevel%` expansion** produced misleading exit codes in an early combined run; the verifier results in this SUMMARY come from `cmd /v:on` delayed-expansion runs and from the tools' own success lines.

## Names

No new important name was invented. Every name written into code is already confirmed in
`INTERFACE-NAME.md`: `ResourceRegistry`, `ResourceRegistry.register`/`get`/`getOrThrow`/`has`/`ids`/`snapshot`,
`ResourceRegistryEntry`, `lib/resources/resourceRegistry.ts`, `scripts/verify/editorShims.js`,
`EXPECTED_SHIMS`, `APP_INSTANCE_MODULE`, `singletons-only-imported-by-composition-root`,
`resources-edit-must-not-import-capabilities`, `kernel+resources+edit-exports`, and the
lowerCamelCase file-name convention. Nothing is proposed for confirmation.

## User Setup Required

None — no external service configuration and no network operation. No package install was needed.

## Manual Verification Outstanding

The plan's `<human-check>` (and 04-VALIDATION.md's only Manual-Only verification) — run `pnpm --filter
@motajs/editor dev`, load a sample project, and confirm (1) workbench parity with
`.planning/baseline/screenshots/`, (2) floor load + edit persists across reload, (3) undo/redo restores
the previous floor/map position, (4) no spurious persistence failure — was **not run by the executor**.
It is recorded as open entry id 4 in `.planning/WINDOWS.md` (`kind: unrun-verify`) and should be
performed by the human verifier / `/gsd-verify-work`. All machine-asserted acceptance criteria pass.

## Next Phase Readiness

- Phase 4 is machine-complete: all six verifiers exit 0 (`editorShims.js`, `coreBoundaries.js`,
  `coreModuleState.js`, `coreExports.js`, `ci-workflow.js`, `lint-severities.js`), `pnpm lint` /
  `pnpm typecheck` green, all test suites green apart from the known unrelated teardown flake, and the
  editor build + artifact check green (57 files, raw 16.81 MiB, within the 20 MiB budget).
- `ResourceRegistry` is exported from the core root `.` and unit-proven, ready for Phase 5 to shape
  against real engine descriptors; because it is unwired, Phase 5 can change its surface without an
  editor-side migration.
- Phase 11 has its exact deletion inventory (`EXPECTED_SHIMS`) and a gate that fails if it drifts.
- The only outstanding item is D4 (the manual UI parity check), tracked in `WINDOWS.md`.

---

*Phase: 04-resource-edit-layers-moved*
*Completed: 2026-09-24*

## Self-Check: PASSED

- All 3 created files exist on disk (`resourceRegistry.ts`, `resourceRegistry.test.ts`, `editorShims.js`).
- All 3 task commits exist: `d2510d6` (Task 1), `6878dfb` (Task 2), `78f860c` (Task 3).
- Measured commits from the plan ledger (`13bdc2e`): 3; diff 34013 chars → `actuals.tokens` 8503.
- `node scripts/verify/editorShims.js` and every other phase verifier exit 0 on the real tree.
- No untracked files besides this SUMMARY and the `.planning/WINDOWS.md` ledger entry; no unexpected deletions.
