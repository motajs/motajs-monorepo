---
phase: 01-baseline-verification-net
plan: 06
subsystem: testing
tags: [vitest, eslint, typescript, pnpm, ci-gate, basePath, verify-02]

# Dependency graph
requires:
  - phase: 01-baseline-verification-net (01-01)
    provides: repaired pnpm install so `pnpm exec eslint` resolves from the root
  - phase: 01-baseline-verification-net (01-02)
    provides: the recorded baseline (.planning/baseline/baseline.json, editor unit total 865) and the root `eslint .` OOM finding
provides:
  - "packages/apps/editor/vitest.config.ts — editor-owned test config that never imports the mota-js root resolver and keeps the default include"
  - "per-package `typecheck` scripts (editor + 7 libs) and the `pnpm -r run typecheck` fan-out"
  - "root fan-out scripts: lint (non-fixing), lint:fix, test, typecheck, build"
  - "a resolved root eslint config that mounts the editor's own config with basePath and ignores the vendored submodule"
affects: [01-07 (ci.yml wiring), editor-core extraction phases]

# Actuals (#2632)
actuals:
  tokens: 2174
  tasks: 3
  commits: 3
  plan_head_before: f8e01345a3631b46fe0fef21aa121d3e65f7f7c5

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-package vitest config split from vite.config.ts (the service-worker model)"
    - "Root flat ESLint config mounts a nested package config via `basePath`"
    - "`pnpm -r run <script>` fan-out (skips packages that lack the script)"

key-files:
  created:
    - packages/apps/editor/vitest.config.ts
  modified:
    - packages/apps/editor/vite.config.ts
    - package.json
    - eslint.config.js
    - packages/apps/editor/eslint.config.js
    - packages/apps/editor/package.json
    - packages/libs/file2x/package.json
    - packages/libs/packer/package.json
    - packages/libs/react-dark-mode/package.json
    - packages/libs/react-hooks/package.json
    - packages/libs/react-monaco-editor/package.json
    - packages/libs/react-store/package.json
    - packages/libs/utils/package.json
    - .planning/baseline/BASELINE.md
    - .planning/phases/01-baseline-verification-net/deferred-items.md

key-decisions:
  - "The editor vitest config keeps the React transform (react + React Compiler) that vite.config.ts previously supplied; without it 60 .tsx tests fail with `React is not defined`."
  - "All packages use `\"typecheck\": \"tsc -b\"`; none needed the `tsc --noEmit -p tsconfig.json` fallback."
  - "The root lint gate is `eslint .` with no `--fix`; the fixer moved to `lint:fix`."
  - "Editor rules reach editor files by importing packages/apps/editor/eslint.config.js and re-applying each block with `basePath` — the editor config stays the single source of truth."
  - "The gate was NOT weakened to hide pre-existing violations: no rule relaxed, no editor source ignored, no feature flag enabled."

patterns-established:
  - "basePath-scoped config mounting: a single root run applies a nested package's own rules"
  - "Per-package test config decoupled from build-time environment resolution"

requirements-completed: []   # VERIFY-02 partially delivered: the script surface is in place, but `pnpm lint` is red on pre-existing debt — see the Blocker section.

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Editor unit tests run from an editor-owned vitest.config.ts that never imports the mota-js root resolver, while still collecting the out-of-src test/blockly and test/mapEditor suites"
    requirement: "VERIFY-02"
    verification:
      - kind: unit
        ref: "packages/apps/editor/vitest.config.ts#no MOTA_JS_ROOT, no include; `pnpm --filter @motajs/editor test` -> 96 files / 891 tests, 12 blockly + 2 mapEditor"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every workspace package with a tsconfig and source tree exposes a typecheck script and `pnpm -r run typecheck` exits 0"
    requirement: "VERIFY-02"
    verification:
      - kind: integration
        ref: "`pnpm typecheck` (= pnpm -r run typecheck) -> 9 packages run, exit 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "Root fan-out scripts exist, the lint script is exactly `eslint .` (no --fix), and the lint gate is green"
    requirement: "VERIFY-02"
    verification:
      - kind: integration
        ref: "`pnpm lint` (= eslint .) -> exit 1, 172 problems (46 errors, 126 warnings) — all pre-existing"
        status: fail
      - kind: unit
        ref: "`eslint --print-config packages/apps/editor/src/utils/action.ts` shows prefer-arrow-callback and no @stylistic/quotes; `--print-config scripts/baseline/collect.js` shows @stylistic/quotes [2,\"double\"]; `eslint packages/external/mota-js/main.js` reports ignored, exit 0"
        status: pass
    human_judgment: true
    rationale: "`pnpm lint` cannot exit 0 without either fixing 46 pre-existing violations across unrelated files (out of plan scope) or weakening the gate (forbidden by the plan). A human must decide which."

duration: 34min
completed: 2026-09-20
status: halted
---

# Phase 01 Plan 06: Baseline & Verification Net Summary

**Editor-owned `vitest.config.ts` (no mota-js root import, full collection preserved), per-package `typecheck` scripts, and root fan-out scripts with a non-fixing `eslint .` gate that mounts the editor's own config — but the gate is red on 46 pre-existing lint errors.**

## ⚠️ Blocker — the lint gate is not green, and was deliberately not weakened

`pnpm lint` (= `eslint .`, no `--fix`) exits `1` with **172 problems (46 errors, 126 warnings)**. The
config-resolution mechanism this plan delivers works exactly as specified — the editor's own rules
reach editor files and the vendored submodule is ignored — but the repo already contained a large
body of ungated violations:

- **43 errors under the editor's own config** (`pnpm --filter @motajs/editor lint` is itself red):
  mostly `@typescript-eslint/no-explicit-any`, `react-hooks/set-state-in-effect`,
  `react-refresh/only-export-components`, `prefer-const`. This contradicts `BASELINE.md` §9.5's claim
  that the editor is clean through its own config — that claim was written at plan 01-02 and does not
  hold for the current tree.
- **3 more under the shared root config**: two in `@motajs/service-worker` (`@stylistic/quotes`,
  `no-control-regex`) and one in `@motajs/h5animate` (`@stylistic/no-multiple-empty-lines`).

Per the plan's instruction ("do NOT weaken the gate to make it pass — report the exact violations
instead") and the scope-boundary rule, none was fixed inline: the gate is intact, no rule was relaxed,
no editor source was ignored, and `v10_config_lookup_from_file` was not enabled. The exact violations
are recorded in `.planning/phases/01-baseline-verification-net/deferred-items.md` §7–§9.

**Decision required:** fix the pre-existing debt in a follow-up task, or re-scope the lint gate.

## Performance

- **Duration:** 34 min
- **Started:** 2026-09-20T12:22:01Z
- **Completed:** 2026-09-20T12:56:04Z
- **Tasks:** 3
- **Files modified:** 14 in the task commits (plus `deferred-items.md` and this SUMMARY)

## Accomplishments
- The editor owns `packages/apps/editor/vitest.config.ts`, which never imports `./mota-root` / `MOTA_JS_ROOT` and declares **no** `include` — so `test/blockly` (12 files) and `test/mapEditor` (2 files) are still collected. `vite.config.ts` now serves dev/build only.
- Every workspace package with a `tsconfig.json` and a source tree exposes `typecheck`, and `pnpm -r run typecheck` is green across 9 packages.
- Root fan-out scripts `lint` / `lint:fix` / `test` / `typecheck` / `build` exist; `lint` is a non-fixing gate, `lint:fix` keeps the fixer.
- The resolved root ESLint config mounts the editor's own config with `basePath: "packages/apps/editor"`, excludes editor sources from the shared root rule set, and ignores `packages/external/` so a local run (submodule present) and the CI lint job (no submodule) lint the same file set.

## Verification Evidence

| Check | Command | Result |
|-------|---------|--------|
| Editor unit collection | `pnpm --filter @motajs/editor test` | **pass** — 96 files / **891 tests** (baseline recorded 865; plan 01-04 added characterization suites, so 891 ≥ 865) |
| Out-of-src collection | JSON report from `vitest run` | **pass** — 12 `test/blockly/*` + 2 `test/mapEditor/*`, incl. `uiRoundTrip.test.ts` and `materialLayout.test.ts` |
| Editor typecheck | `pnpm --filter @motajs/editor exec tsc -b` | **pass** (exit 0) |
| Workspace typecheck | `pnpm typecheck` | **pass** — 9 packages, exit 0 |
| Workspace unit | `pnpm test` | **pass on retry** — editor 891, service-worker 44, file2x 14, h5animate 202, packer 94, react-hooks 3, react-monaco-editor 6, react-store 3 |
| Workspace build | `pnpm build` | **pass** — editor artifact 57 files / 16.80 MiB (matches baseline) |
| Editor scoping | `eslint --print-config packages/apps/editor/src/utils/action.ts` | **pass** — `prefer-arrow-callback` present, `@stylistic/quotes` absent |
| Root rule retained | `eslint --print-config scripts/baseline/collect.js` | **pass** — `@stylistic/quotes: [2,"double"]` |
| Submodule ignored | `eslint packages/external/mota-js/main.js` | **pass** — "File ignored because of a matching ignore pattern", exit 0 |
| Lint gate | `pnpm lint` | **FAIL** — exit 1, 46 errors (all pre-existing) |
| Lockfile | `git diff --exit-code -- pnpm-lock.yaml` | **pass** — unchanged |
| Workflow untouched | `git diff --exit-code -- .github/workflows/deploy-editor-h5test.yml` | **pass** |

## Task Commits

Each task was committed atomically:

1. **Task 1: Split the editor vitest config out of vite.config.ts** - `747c4cf` (feat)
2. **Task 2: Add a per-package typecheck script across the workspace** - `57541f0` (feat)
3. **Task 3: Add root fan-out scripts with a non-fixing lint gate** - `4fd1eae` (feat)

**Plan metadata:** this SUMMARY commit (docs: complete plan)

## Files Created/Modified
- `packages/apps/editor/vitest.config.ts` - editor-owned test config: aliases `@`/`@test`/`@styled-system`, jsdom + globals + setupFiles + `exclude: [...configDefaults.exclude, "e2e/**"]`, no `include`, no mota-js root import
- `packages/apps/editor/vite.config.ts` - removed the `test` block and the now-unused `configDefaults` import; still imports `MOTA_JS_ROOT` for `publicDir` and `motaServerPlugin`
- `package.json` (root) - `lint: eslint .`, `lint:fix: eslint --fix`, `test`/`typecheck`/`build` via `pnpm -r run`
- `eslint.config.js` (root) - global ignores `["**/dist/", "packages/external/"]`; shared block ignores `packages/apps/editor/**`; editor config mounted with `basePath`
- `packages/apps/editor/eslint.config.js` - `files` widened to `**/*.{js,cjs,mjs,ts,tsx}`; added a `**/*.{cjs,mjs}` block with `globals.node`
- 8 × `package.json` - one added `"typecheck": "tsc -b"` script each (editor + file2x, packer, react-dark-mode, react-hooks, react-monaco-editor, react-store, utils)
- `.planning/baseline/BASELINE.md` - §6 records the `typecheck` script form for every package
- `.planning/phases/01-baseline-verification-net/deferred-items.md` - §7–§10 record the pre-existing lint debt and the react-monaco-editor flake

## Decisions Made
- **React transform retained in the editor vitest config.** The service-worker vitest config is the shape model, but the editor's `.tsx` suite needs JSX + React Compiler, which previously came from `vite.config.ts`. Without it, 60 `.tsx` tests fail with `React is not defined`; the config therefore carries the identical `react({ babel: { plugins: [["babel-plugin-react-compiler"]] } })` plugin (see Deviations).
- **`tsc -b` everywhere.** Every lib project built cleanly under build mode, so no `tsc --noEmit -p tsconfig.json` fallback was needed. `@motajs/h5animate` has no `tsconfig.json` and is correctly skipped; `@motajs/config` is configuration-only.
- **Non-fixing gate.** `lint` is `eslint .`; the fixer is preserved as `lint:fix`. A fixing gate can never fail on formatting and silently rewrites the checkout (threat T-06-01).
- **Single source of truth for editor rules.** The root config imports the editor config and re-applies each block with `basePath` instead of duplicating rules by hand, so `pnpm --filter @motajs/editor lint` and the root run agree.
- **Gate not weakened.** No rule relaxed, no editor source ignored, no experimental flag.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Restored the React transform in `packages/apps/editor/vitest.config.ts`**
- **Found during:** Task 1 (split the editor vitest config)
- **Issue:** The plan's resulting-shape block (modelled on `service-worker/vitest.config.ts`) had no Vite plugins. Dropping `@vitejs/plugin-react` made 60 `.tsx` tests fail with `ReferenceError: React is not defined`, because the editor's JSX is compiled through that plugin (and its React Compiler babel pass).
- **Fix:** Added the identical `react({ babel: { plugins: [["babel-plugin-react-compiler"]] } })` plugin the old `vite.config.ts` test path used, preserving the transform exactly rather than approximating it.
- **Files modified:** `packages/apps/editor/vitest.config.ts`
- **Verification:** editor suite 96 files / 891 tests, 0 failures.
- **Committed in:** `747c4cf` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The auto-fix preserves pre-split test behaviour (which the plan's overarching goal requires); it adds no dependency and no rule. No scope creep.

## Issues Encountered
- **`pnpm lint` red (blocker, above).** Not resolved — reported per plan instructions.
- **`pnpm --filter @motajs/editor test -- --reporter=json …` does not forward args.** pnpm passes the literal `--` to vitest, so `--reporter=json` never applies. Used `pnpm --filter @motajs/editor exec vitest run --reporter=json --outputFile=…` for the JSON evidence instead.
- **`@motajs/editor` `ternDeclaration.test.ts` is a 5s-edge flake.** In the passing JSON run it took 4783 ms (baseline 4819 ms) and passed; under load two plain runs timed it out at 5000 ms, then it passed. Pre-existing margin, unrelated to the split.
- **`pnpm test` intermittently red on the known `@motajs/react-monaco-editor` teardown flake** (`Closing rpc while "fetch" was pending`, all tests passing). A retry of the full fan-out exited 0. Recorded in `deferred-items.md` §10.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The editor's unit suite no longer depends on config-load evaluation of the mota-js root, while still collecting the full existing suite (891 tests).
- Root `test`, `typecheck` and `build` fan-outs are green; `lint` is the gate this plan wires up but cannot make green without resolving pre-existing debt.
- **Blocking 01-07:** wiring CI's `lint` job to `pnpm lint` would publish a permanently-red required check. Resolve the 46 pre-existing lint errors (or re-scope the gate) before connecting the workflow.

---
*Phase: 01-baseline-verification-net*
*Completed: 2026-09-20*

## Self-Check: PASSED
- `packages/apps/editor/vitest.config.ts` — FOUND
- `.planning/phases/01-baseline-verification-net/01-06-SUMMARY.md` — FOUND
- Commits `747c4cf`, `57541f0`, `4fd1eae` — FOUND
