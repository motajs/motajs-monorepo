# Deferred Items — Phase 03 (asset)

Out-of-scope discoveries surfaced while executing plans. Not fixed here — logged per the executor SCOPE BOUNDARY rule.

## From 03-05 (`.jsonc` codec → `shared/jsonc`)

### Pre-existing gate failures in `scripts/verify/implExports.js` and `scripts/verify/coreExports.js`

- **Found during:** 03-05 overall verification (extra boundary-gate sweep beyond the plan's three commands).
- **`implExports.js` (exit 1):** `exports["./map"]` and `exports["./shell"]` declare paths that do not exist on disk (`src/map/index.ts`, `src/shell/index.ts`). Both entries already existed in `packages/libs/editor-impl/package.json` at the ledger base `dda0441`, and neither `src/map` nor `src/shell` exists yet — later plans create them.
- **`coreExports.js` (exit 1):** same missing `./shell` subpath, plus unrelated pre-existing findings (react / react-dom resolved to two realpaths, `sideEffects` is `["./src/**/*.css"]` rather than `false`, and `.planning/phases/02-package-boundary-build-scaffolding/subpathStatus.json` is absent).
- **Why deferred:** none of these touch the files this plan changed; the newly added `./shared` subpath is not implicated in either report. Fixing them is outside 03-05's scope.
- **Verification that it is not caused by this plan:** `git show dda0441:packages/libs/editor-impl/package.json` shows `./map`/`./shell` already present; `Test-Path src/map` and `Test-Path src/shell` are both false.

## From 03-10 (asset panel data layer)

### `pnpm --filter @motajs/editor-impl test` full-suite timeout on `src/table/__tests__/schemaMode.test.tsx`

- **Found during:** 03-10 overall verification (full editor-impl suite run).
- **Symptom:** on the first full-suite run, `表格 schema 模式与工具栏 > schema 目标下不显示「编辑 Schema」按钮并渲染提示条` timed out at the 5000 ms default under parallel contention (other heavy table suites ran concurrently). The second full-suite run passed 32 files / 253 tests with no failure; the file also passes in isolation (12/12).
- **Why deferred:** the timed-out file is a table test, untouched by this plan; the failure is load-dependent, not deterministic. Same class as the flake already recorded against the editor app's `ternDeclaration.test.ts`.
- **Verification that it is not caused by this plan:** the asset tests themselves pass in isolation and in-suite; a fresh full run is green.

## From 03-17 (dev-host wiring + gate sweep)

The 03-17 close-out gate sweep ran the three root commands for the first time in this phase. All three are red, and all three are outside 03-17's file scope (none of the failing files is touched by 03-17).

### Root `pnpm test` red in `@motajs/react-hooks` only

- **Found during:** 03-17 Task 3 sweep (`pnpm -r --no-bail run test`).
- **Symptom:** `lib/core/common.test.tsx` and `lib/browser/serviceWorker.test.tsx` fail at import with `Incompatible React versions: react 19.2.3 / react-dom 19.3.0`; the other five tests in the package never start. Every other test package passes (file2x 14, h5animate 202, editor-core 94, packer 94, editor-impl 296, editor-dev 24).
- **Root cause:** the committed `pnpm-lock.yaml` pins `packages/libs/react-hooks` to `react: 19.2.3` and `react-dom: 19.3.0(react@19.2.3)` — a lockfile-level mismatch (the catalog declares `react`/`react-dom` as `^19.2.3`, both satisfiable by 19.3.0).
- **Why deferred:** fixing it needs a dependency / lockfile change (catalog pin or re-resolution), which is out of 03-17's scope and requires an explicit dependency decision.
- **Verification that it is not caused by this plan:** `git show f49f7b5:pnpm-lock.yaml` (the base commit) already contains the same `react: 19.2.3` / `react-dom: 19.3.0(react@19.2.3)` pair for the `react-hooks` importer; 03-17 touches neither `react-hooks` nor the lockfile.

### Root `pnpm typecheck` red in the legacy `@motajs/editor` app only

- **Found during:** 03-17 Task 3 sweep (`pnpm typecheck`).
- **Symptom:** `packages/apps/editor` reports many `TS18046 / TS2322 / TS7006` errors (e.g. `'content' is of type 'unknown'`) plus three `TS6133` unused-import errors it re-surfaces from `libs/editor-impl/src/table/tablePanel.ts`. `@motajs/editor-core`, `@motajs/editor-impl` and `@motajs/editor-dev` all typecheck with exit 0.
- **Root cause:** the legacy `@motajs/editor` app does not compile since the 02.1 resource-layer refactor — recorded as known in `.planning/phases/01.1-dev-host/01.1-RESEARCH.md` ("现有 editor 无法编译（旧里程碑遗留）").
- **Why deferred:** repairing the legacy app is far outside 03-17's scope and is a migration-phase task.
- **Verification that it is not caused by this plan:** the failing files predate this plan (`ResourcesWorkspace/index.tsx` last changed in 05.2-03; 03-17 changes only `editor-dev` and `.planning`).

### Root `pnpm lint` red with 8 prettier errors from earlier plans — **RESOLVED (2026-10-18, user chose option A)**

**Resolution:** the 4 files were reformatted with `pnpm exec prettier --write` (commit `ffbf259`); `pnpm lint` now reports **0 errors** (161 warnings only, all pre-existing non-error). Only this item was fixed; the two above (react-hooks lockfile mismatch, legacy `@motajs/editor` typecheck) remain known/deferred by the user's decision.



- **Found during:** 03-17 Task 3 sweep (`pnpm lint`).
- **Symptom:** 8 errors (`prettier/prettier`) at `packages/libs/editor-core/src/resource/__tests__/fileIndex.test.ts` (4), `packages/libs/editor-impl/src/table/__tests__/refreshIdentity.uat.test.tsx` (1), `packages/libs/editor-impl/src/table/tablePanel.ts` (1) and `scripts/verify/coreFsSurface.js` (2).
- **Why deferred:** all eight files come from earlier plans in this effort; 03-17 adds no lint error (its own new files pass `eslint` and `prettier --check`).
- **Verification that it is not caused by this plan:** `pnpm exec eslint packages/apps/editor-dev/src/demo/assetDemo.ts packages/apps/editor-dev/src/main.tsx packages/apps/editor-dev/src/__tests__/devHostAsset.test.tsx` exits 0 and `prettier --write` leaves all three unchanged.
