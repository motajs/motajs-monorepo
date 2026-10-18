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
