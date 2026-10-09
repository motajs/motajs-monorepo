---
phase: 02-package-boundary-build-scaffolding
plan: 03
subsystem: infra
tags:
  [
    dependency-cruiser,
    package-boundary,
    forbidden-rules,
    no-cycles,
    requireZero,
    pandacss,
    cssgen,
    react-compiler,
    vite-transformRequest,
    verifier,
    ci-workflow,
    editor-core,
  ]

# Dependency graph
requires:
  - phase: 02-package-boundary-build-scaffolding
    plan: 01
    provides: the real private editor-core workspace package (lib/ layout, seven-subpath exports, the CoreProbe/./react barrel, core's own vitest project) and the editor's real value-level import of @motajs/editor-core
  - phase: 02-package-boundary-build-scaffolding
    plan: 02
    provides: the nine catalog-pinned peers, scripts/verify/coreExports.js and subpathStatus.json (one file node per subpath for the cruise), and the four-job CI contract preserved
provides:
  - "dependency-cruiser 18.2.0 pinned in the workspace catalog + a root devDependency, with NO allowBuilds entry and NO minimumReleaseAgeExclude entry (the pin installed without tripping the release-age guard)"
  - ".dependencyCruiser.cjs: six forbidden-only rules at severity error — core-must-not-import-consumers, kernel-must-not-import-capabilities, react-and-shell-must-not-import-capabilities, capabilities-must-not-import-each-other, no-circular, core-singletons-only-imported-by-composition-root"
  - "scripts/verify/coreBoundaries.js: real-tree cruise at 0 errors, every core-internal relative edge proven resolved (only @styled-system/* tolerated, with the reason printed), a synthetic cross-capability fixture reported by rule name with a non-zero exit, the PKG-03 TS2307 negative polarity from core's own tsc -p, and the editor-to-core edge direction"
  - "scripts/verify/corePandaClass.js: the real panda cssgen extraction asserted to contain the config-stable atomic class .display_block { display: block"
  - "scripts/verify/coreReactCompiler.js: a live Vite createServer + transformRequest over CoreProbe.tsx asserting both react/compiler-runtime and _c( in the output"
  - "packages/apps/editor/panda.config.ts widened include so one PandaCSS config owns both the editor and core source"
  - "three extra CI steps inside the existing lint and build jobs (one in lint, two in build), with the four-job contract still verifying"
affects: [03-kernel, 04-resources, 07-table, 08-code, 09-asset, 10-map, editor-build, ci]

# Actuals (#2632) — same estimateTokens scale as the plan's `estimate` (chars/4 over the realized diff)
actuals:
  tokens: 5811
  tasks: 3
  commits: 2
  plan_head_before: 2f46c00d3f3abb7813f71deae4ad71a842b461ee

# Tech tracking
tech-stack:
  added:
    - dependency-cruiser 18.2.0 (root devDependency, pinned through the workspace catalog)
  patterns:
    - "A boundary gate must be proven able to fire: a rule whose subject never resolves passes silently, so the verifier asserts both the real tree's 0 errors AND that a synthetic violation is reported by name"
    - "Every core-internal relative edge is asserted resolved to a path inside core, because one unresolved edge disables every to.path rule — the only tolerated unresolved specifier is the consumer-generated @styled-system/*, and the reason is printed"
    - "A package's manifest is located through Node's own search-path algorithm when the package's exports map does not expose ./package.json"
    - "dependency-cruiser's --output-type json does not change its exit code, so the non-zero-exit evidence comes from a second run with the default err reporter"
    - "Side-effect imports are not type-checked unless noUncheckedSideEffectImports is set, so a negative-polarity fixture must use a named import to produce TS2307"
    - "A build-pipeline gate asserts the tool's emitted output (extracted CSS, transform result), never the configuration text"

key-files:
  created:
    - .dependencyCruiser.cjs
    - scripts/verify/coreBoundaries.js
    - scripts/verify/corePandaClass.js
    - scripts/verify/coreReactCompiler.js
  modified:
    - pnpm-workspace.yaml
    - package.json
    - pnpm-lock.yaml
    - packages/apps/editor/panda.config.ts
    - .github/workflows/ci.yml
    - .planning/WINDOWS.md

key-decisions:
  - "dependency-cruiser is pinned at 18.2.0 and installed as a root devDependency; 18.2.0 was accepted by the workspace release-age guard, so NO minimumReleaseAgeExclude entry was added and the guard was not lowered"
  - "No allowBuilds entry was added for dependency-cruiser — it declares no install-time script (postinstall: null), so widening allowBuilds would be a supply-chain regression"
  - "The catalog entry sits after blockly and before dexie (the plan text named the slot before plan 02 inserted alien-signals/antd/blockly); catalog order is functionally inert"
  - "The rule set is forbidden-only at severity error, with no allowed/required rule, no options.tsConfig and no blanket not-to-unresolvable — the gate can only get stricter"
  - "The requireZero singleton rule ships now and is deliberately vacuous (D-17); it was registered in .planning/WINDOWS.md as ledger entry 3 so the ship gate can see it"
  - "coreBoundaries.js locates dependency-cruiser's manifest via require.resolve.paths('dependency-cruiser') because the package's exports map does not expose ./package.json (the plan's literal direct resolve throws ERR_PACKAGE_PATH_NOT_EXPORTED)"
  - "The synthetic-violation step runs depcruise twice: once with --output-type json for the rule name, once with the default err reporter for the non-zero exit code (json output alone always exits 0)"
  - "The PKG-03 polarity fixture uses a named import, not a side-effect import, because core's tsconfig base does not set noUncheckedSideEffectImports and side-effect imports of missing modules are therefore not errors"
  - "The compiler verifier exits explicitly with process.exit because closing the Vite server can keep the process alive"

patterns-established:
  - "Two-polarity boundary verifier: real tree green + synthetic violation caught by rule name and non-zero exit + every in-scope edge proven resolved, all in one script with a collects-all-failures contract"
  - "Consumer-pipeline verifiers assert the tool's emitted artifact: panda cssgen output for styles, a live Vite transformRequest result for the compiler"
  - "Probe-based pipeline gates: a single temporary core probe makes both the PandaCSS extraction and the React Compiler transform observable, and both gates target the same probe through the package's ./react subpath"

requirements-completed: [PKG-03, PKG-04, PKG-05, VERIFY-05]

# Coverage metadata (#1602) — one entry per shipped deliverable
coverage:
  - id: D1
    description: "dependency-cruiser 18.2.0 is a pinned root devDependency and a committed .dependencyCruiser.cjs expresses the boundary as six forbidden-only rules at severity error (core-to-consumer edges, the D-06 DAG in three parts, no-cycles, and the D-16 composition-root-only singleton rule)"
    requirement: "VERIFY-05"
    verification:
      - kind: other
        ref: "node scripts/verify/coreBoundaries.js -> exit 0 (config loaded by the real tool, six rules reported in summary.ruleSetUsed.forbidden)"
        status: pass
      - kind: other
        ref: "node -e \"require('./.dependencyCruiser.cjs')\" -> 6 rules, all severity error, no allowed/required, no options.tsConfig"
        status: pass
    human_judgment: false
  - id: D2
    description: "The boundary gate is provably alive: the real tree cruises at 0 errors, a synthetic cross-capability fixture is reported non-zero with the rule name capabilities-must-not-import-each-other, and every core-internal relative edge is shown resolved (only the bare @styled-system/* specifier tolerated, with the reason printed)"
    requirement: "VERIFY-05"
    verification:
      - kind: integration
        ref: "node scripts/verify/coreBoundaries.js -> '真实树 cruise 通过（error 违规 0 条 … 共 12 个模块、6 条依赖）' + 'core 包内相对边全部解析到 core 内部（9 个 core 模块、2 条相对边）' + synthetic fixture reported by name with default-reporter exit 1; exit 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "PKG-03 negative polarity: a deliberately wrong relative import planted inside core's lib/ makes core's own TypeScript program fail with TS2307, proving the program actually checks core's files"
    requirement: "PKG-03"
    verification:
      - kind: integration
        ref: "node scripts/verify/coreBoundaries.js step (d): pnpm --filter @motajs/editor-core exec tsc -p tsconfig.json -> 'lib/__polarityProbe__.ts(1,35): error TS2307: Cannot find module './definitely-missing-module' …', exit 1"
        status: pass
    human_judgment: false
  - id: D4
    description: "PandaCSS extraction covers core source and the extracted CSS contains the config-stable atomic class .display_block"
    requirement: "PKG-04"
    verification:
      - kind: integration
        ref: "node scripts/verify/corePandaClass.js -> '提取产物包含 .display_block { display: block（产物 17015 字节）' + 全部断言通过; exit 0"
        status: pass
    human_judgment: false
  - id: D5
    description: "A live Vite transform of the core probe produces both React Compiler markers (react/compiler-runtime and _c() with no configuration change"
    requirement: "PKG-05"
    verification:
      - kind: integration
        ref: "node scripts/verify/coreReactCompiler.js -> 'react/compiler-runtime 标记：存在' + '_c( memo-cache 调用：存在'; exit 0"
        status: pass
    human_judgment: false
  - id: D6
    description: "All three new gates run as extra steps inside the existing lint and build CI jobs, and the workflow still declares exactly four jobs"
    requirement: "VERIFY-05"
    verification:
      - kind: other
        ref: "node scripts/verify/ci-workflow.js -> '全部断言通过（4 个 job 与工具链固定值一致，无 secrets/environment/paths）'; exit 0"
        status: pass
    human_judgment: false

# Metrics
duration: 23min
completed: 2026-09-22
status: complete
---

# Phase 2 Plan 03: boundary gate and consumer-pipeline coverage Summary

**The boundary is now a gate that can be proven to fire — a pinned dependency-cruiser with six forbidden-only rules, a verifier that shows the real tree cruises at 0 errors while a synthetic cross-capability import is caught by name, core's own `tsc -p` rejecting a wrong import with `TS2307`, and the consumer pipeline provably covering core through the emitted CSS (`.display_block`) and a live Vite React Compiler transform.**

## Performance

- **Duration:** ~23 min
- **Started:** 2026-09-22T11:58:20Z
- **Completed:** 2026-09-22T12:21:07Z
- **Tasks:** 3 / 3 (Task 1 was a checkpoint, satisfied by orchestrator-obtained user approval — see "Checkpoint record")
- **Files modified:** 10 (4 created, 6 modified) — includes `pnpm-lock.yaml` and `.planning/WINDOWS.md`

## Accomplishments

- `dependency-cruiser@18.2.0` is pinned in the workspace catalog (after `blockly`, before `dexie`) and declared as a root devDependency. The pin installed cleanly — the release-age guard did **not** refuse it, so no `minimumReleaseAgeExclude` entry was added and the guard was not lowered. No `allowBuilds` entry was added.
- `.dependencyCruiser.cjs` expresses the boundary as six `forbidden`-only rules at `severity: 'error'`: core must not import the editor/host/engine; the D-06 DAG in three parts (`.` → no capability; `react`/`shell` → no capability; capabilities → not each other, via `$1` group matching); `no-circular`; and the D-16 composition-root-only singleton rule, which is deliberately vacuous today and starts biting in Phase 3.
- `scripts/verify/coreBoundaries.js` makes the gate provably alive rather than merely present: the real tree cruises at **0 errors** (12 modules, 6 dependencies), **every** core-internal relative edge is asserted to resolve to a path inside core (2 edges), the single tolerated unresolved specifier class (`@styled-system/*`, 2 edges) is printed with the reason it cannot resolve under a cruise, a synthetic `code` → `table` fixture is reported non-zero **by rule name**, core's own `tsc -p` is shown to fail a planted wrong import with `TS2307`, and the editor→core edge direction is asserted together with the absence of the reverse declaration.
- `scripts/verify/corePandaClass.js` runs the real `panda cssgen` and asserts the **extracted** stylesheet contains the config-stable atomic class `.display_block { display: block` — against the tool's output, never the config text and never a hashed class. The outfile is disposable and deleted by the script.
- `scripts/verify/coreReactCompiler.js` starts a live Vite server with the editor's own `react({ babel: { plugins: [[compilerPath]] } })` configuration and requires both `react/compiler-runtime` and `_c(` in the `transformRequest` result for `CoreProbe.tsx`. No editor build configuration was changed to make it pass.
- `packages/apps/editor/panda.config.ts` `include` now covers core source (`'../../libs/editor-core/lib/**/*.{ts,tsx}'`), so one PandaCSS config and one CSS artifact own both trees.
- All three gates run as **extra steps inside the existing four CI jobs** (one in `lint`, two in `build`, between the panda codegen step and `pnpm build`), and `scripts/verify/ci-workflow.js` still verifies the four-job contract.

## Checkpoint record

**Task 1 — `checkpoint:human-verify` (`gate="blocking-human"`) on the `dependency-cruiser` pin: satisfied by orchestrator-obtained user approval.**

The orchestrator put the package-legitimacy question to the user before dispatching this executor and obtained the explicit answer **"dependency-cruiser 18.2.0 approved"**, with the scope:

- pin `dependency-cruiser@18.2.0`; do **not** add an `allowBuilds` entry;
- **only if** `18.2.0` is actually refused by the workspace release-age guard, add a `minimumReleaseAgeExclude` entry for `dependency-cruiser@18.2.0` in the same style as the existing `monaco-editor@0.56.0` entry — never lower the guard and never switch to an unpinned/newer version;
- do not halt on Task 1.

**Outcome:** the executor proceeded to Task 2 without halting. `pnpm install` reported `+ dependency-cruiser 18.2.0` and the lockfile diff contains **zero deletions** (187 insertions across `package.json`, `pnpm-workspace.yaml` and `pnpm-lock.yaml`), i.e. no existing package was re-resolved. The release-age guard did **not** refuse `18.2.0`, so the conditional `minimumReleaseAgeExclude` fallback was **not** needed and was not used. `allowBuilds`, `overrides` and `minimumReleaseAgeExclude` are byte-identical to the pre-plan state.

## Task Commits

Each task was committed atomically:

1. **Task 1: Confirm the dependency-cruiser pin before installing it** — _no commit_ (`checkpoint:human-verify`, no file changes; satisfied by orchestrator-obtained approval, see above)
2. **Task 2: Install dependency-cruiser, write the boundary rule set, and prove the gate can fire** - `cd3c71b` (feat)
3. **Task 3: Prove the consumer pipeline covers core — PandaCSS extraction and React Compiler transform** - `fc25670` (feat)

**Plan metadata:** (this SUMMARY commit) (docs: complete plan)

_Note: no TDD tasks; each `type="auto"` task is a single commit. `plan_head_before` = `2f46c00d3f3abb7813f71deae4ad71a842b461ee`; `commits` measured = 2._

## Files Created/Modified

- `.dependencyCruiser.cjs` (new) - the six `forbidden` rules at `severity: 'error'`, `module.exports` style, `options.doNotFollow: { path: '^node_modules' }`; no `allowed`/`required` rule, no `options.tsConfig`, no blanket `not-to-unresolvable`
- `scripts/verify/coreBoundaries.js` (new) - the two-polarity boundary verifier plus the PKG-03 polarity proof and the edge-direction assertion; locates the dependency-cruiser CLI without a shell, collects every failure, prints one `coreBoundaries: …` line per failure and exits 1
- `scripts/verify/corePandaClass.js` (new) - runs the real `panda cssgen` from the editor directory into a disposable outfile and asserts the emitted CSS contains `.display_block { display: block`
- `scripts/verify/coreReactCompiler.js` (new) - a live Vite `createServer` (`configFile: false`, `root` at the repo root, `optimizeDeps.noDiscovery`, middleware mode) + `transformRequest` over the probe, asserting both compiler markers, with an explicit `process.exit`
- `pnpm-workspace.yaml` - catalog gains `dependency-cruiser: 18.2.0` (alphabetically after `blockly`, before `dexie`). `allowBuilds`, `overrides`, `minimumReleaseAgeExclude` and the plan-01 `typescript-eslint: 8.50.1` pin are untouched
- `package.json` - root `devDependencies` gains `"dependency-cruiser": "catalog:default"` (after `@vitejs/plugin-react`, before `eslint`)
- `pnpm-lock.yaml` - +185 lines, **0 deletions**: the catalog entry and the 23 transitive packages dependency-cruiser brings in. No existing resolved version changed
- `packages/apps/editor/panda.config.ts` - `include` widened to `['./src/**/*.{js,jsx,ts,tsx}', '../../libs/editor-core/lib/**/*.{ts,tsx}']`; `preflight`, `syntax`, `jsxFramework`, `exclude`, `theme` and `outdir` unchanged
- `.github/workflows/ci.yml` - three added `- run:` steps only: `coreBoundaries.js` in `lint` after `pnpm lint`; `corePandaClass.js` and `coreReactCompiler.js` in `build` between the panda codegen step and `pnpm build`. No job added, renamed or removed
- `.planning/WINDOWS.md` - ledger entry 3 registering the deliberately-vacuous singleton rule (D-17)

## Decisions Made

- **Pin `18.2.0`, add nothing else.** The install proved the release-age guard accepts it, so the conditional `minimumReleaseAgeExclude` fallback stayed unused; the guard was not lowered and no `allowBuilds` entry was added (the tool declares no install-time script).
- **`forbidden`-only, `severity: 'error'`, no tsconfig-aware cruise.** Core's intra-package imports are relative (D-06 amended), so the DAG rules are pure path rules; forcing `options.tsConfig` would push the consumer-generated `@styled-system/*` path into a must-resolve state.
- **The singleton rule ships now and is vacuous on purpose** (D-17). It is registered in the broken-windows ledger so the ship gate sees the deliberate placeholder rather than discovering it late.
- **The manifest is located through Node's search paths.** dependency-cruiser does not export `./package.json`; the verifier tries the direct resolve first (future-proof) and falls back to `require.resolve.paths('dependency-cruiser')` + existence check.
- **Two depcruise invocations for the synthetic step.** `--output-type json` gives the rule name; the default `err` reporter gives the exit code, because the JSON reporter always exits 0.
- **The polarity fixture uses a named import.** `noUncheckedSideEffectImports` is not set in `tsconfig.lib.base.json`, so a side-effect import of a missing module is not an error; a named import is checked and yields `TS2307`.
- **The PandaCSS assertion reads the extraction, not the config.** The class name is a function of `syntax`/`hash`, so asserting configuration text would reproduce the exact bug the gate exists to catch.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `dependency-cruiser/package.json` is not exported, so the plan's direct resolve throws**

- **Found during:** Task 2 (writing `coreBoundaries.js`)
- **Issue:** the plan says to resolve the CLI with `createRequire(...).resolve('dependency-cruiser/package.json')`. That call throws `ERR_PACKAGE_PATH_NOT_EXPORTED` (`Package subpath './package.json' is not defined by "exports"`), and `require.resolve('dependency-cruiser')` throws too (the exports map has an `import` condition but no `require`/`default`). The CLI could not be located as written.
- **Fix:** try the direct resolve first (so a future version that exports the manifest keeps working), then fall back to `createRequire(...).resolve.paths('dependency-cruiser')` — Node's own search-path list — plus an `existsSync` check for `<searchPath>/dependency-cruiser/package.json`, then join `bin.depcruise` from the manifest's `bin` field (`bin/dependency-cruise.mjs`).
- **Files modified:** `scripts/verify/coreBoundaries.js`
- **Verification:** `node scripts/verify/coreBoundaries.js` exits 0 and all five assertion groups report; the resolved CLI is `node_modules/dependency-cruiser/bin/dependency-cruise.mjs` (v18.2.0).
- **Committed in:** `cd3c71b` (Task 2 commit)

**2. [Rule 1 - Bug] `dependency-cruiser --output-type json` exits 0 even with error-severity violations**

- **Found during:** Task 2 (measuring the synthetic-violation polarity)
- **Issue:** the plan requires the synthetic fixture to produce a **non-zero exit** with the rule name present in the report. Measured: with `--output-type json` the report contains `summary.error = 1` and the violation naming `capabilities-must-not-import-each-other`, but the process **exits 0**; only the default `err` reporter exits 1. The single-invocation requirement cannot hold.
- **Fix:** the synthetic step now runs depcruise twice inside the same `try`/`finally`: once with `--output-type json` (asserting `summary.error > 0` **and** the rule name in `summary.violations[].rule.name`), and once with the default reporter (asserting a non-zero exit code). Both halves of the plan's requirement are asserted, from the tool's real behaviour.
- **Files modified:** `scripts/verify/coreBoundaries.js`
- **Verification:** measured violation `{ from: 'packages/libs/editor-core/lib/code/__boundariesProbe__.ts', to: 'packages/libs/editor-core/lib/table/index.ts', rule: { severity: 'error', name: 'capabilities-must-not-import-each-other' } }`, JSON cruise exit 0, default reporter exit 1; the fixture is removed in `finally` and its absence asserted.
- **Committed in:** `cd3c71b` (Task 2 commit)

**3. [Rule 1 - Bug] A side-effect import of a missing module produces no `TS2307` under core's tsconfig**

- **Found during:** Task 2 (measuring the PKG-03 polarity fixture)
- **Issue:** the plan's polarity fixture is described as "a relative import of a module that does not exist". Written as `import './definitely-missing-module';`, core's own `tsc -p tsconfig.json` exited **0** with no diagnostics — because `noUncheckedSideEffectImports` is not set in `packages/libs/config/tsconfig.lib.base.json` (it is set only in the editor app's tsconfig), so TypeScript does not check side-effect imports. The polarity proof was silently vacuous.
- **Fix:** the fixture now uses a **named** import (`import { definitelyMissing } from './definitely-missing-module';`), which TypeScript resolves at bind time and reports as `TS2307`. A deliberately-wrong type annotation was used as a control to confirm the program really was checking core's files (`TS2322` was reported).
- **Files modified:** `scripts/verify/coreBoundaries.js` (the fixture source constant; the fixture itself is never committed)
- **Verification:** `lib/__polarityProbe__.ts(1,35): error TS2307: Cannot find module './definitely-missing-module' or its corresponding type declarations.` with exit 1, and `pnpm --filter @motajs/editor-core typecheck` back at exit 0 once the fixture is removed.
- **Committed in:** `cd3c71b` (Task 2 commit)

**4. [Orchestrator correction] Catalog slot for `dependency-cruiser`**

- **Found during:** Task 2 (editing `pnpm-workspace.yaml`)
- **Issue:** the plan text says to place the entry "directly after `@vitejs/plugin-react` and before `dexie`", but plan 02 had already inserted `alien-signals`, `antd` and `blockly` between them, so that slot no longer exists.
- **Fix:** placed after `blockly` and before `dexie`, per the orchestrator's correction. Catalog order is functionally inert; the entry is present and correct.
- **Files modified:** `pnpm-workspace.yaml`
- **Verification:** `pnpm install --frozen-lockfile` → `Lockfile is up to date, resolution step is skipped`, exit 0.
- **Committed in:** `cd3c71b` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking) + 1 orchestrator correction
**Impact on plan:** All three auto-fixes were necessary for the plan's own acceptance criteria to be satisfiable — without #1 the verifier cannot locate the tool, and without #2/#3 the two polarity proofs would have been vacuously green (the exact failure class this plan exists to eliminate). No gate was weakened: no rule was relaxed, no severity lowered, no job added or renamed, no `allowBuilds`/`minimumReleaseAgeExclude` change, and no editor build configuration was touched to make a verifier pass. The only extra file touched beyond the plan's list is `.planning/WINDOWS.md` (ledger entry 3).

## Issues Encountered

- **Pre-existing, out-of-scope: the `@motajs/react-monaco-editor` teardown flake.** The root `pnpm test` fan-out failed on the first attempt with `Error: [vitest-worker]: Closing rpc while "fetch" was pending` for `@motajs/react-monaco-editor` (its 2 files / 6 tests all passed; vitest exited 1 on 2 unhandled errors originating from `monaco-editor`'s lazy language loading). This is **exactly** the flake already recorded in Phase 1's `deferred-items.md` §1 and §10 ("exits non-zero after an all-passing report, roughly half the time"; "`pnpm test` exit status is therefore nondeterministic until that flake is fixed"). Reproduced in isolation (1 of 3 runs green) and on the fan-out (4 of 5 runs red before a green one). It is **not** caused by this plan: nothing here touches `react-monaco-editor`, monaco or its vitest config, and the lockfile diff has **zero deletions** (no existing package re-resolved). Per the scope-boundary rule it was **not** fixed. The green fan-out was then captured for the record: **128 test files / 1260 tests passed, exit 0** (Phase 1 baseline was 1257; plan 01 added core's 3 smoke tests).
- **Cosmetic, Windows-only: Node's `DEP0190` deprecation warning.** `coreBoundaries.js` spawns `pnpm` with `shell: true` on Windows (the plan's literal `pnpm --filter @motajs/editor-core exec tsc -p tsconfig.json` invocation; `pnpm` is a `.cmd` shim that Node refuses to spawn without a shell). Node prints `[DEP0190] Passing args to a child process with shell option true …` to stderr on Windows only. It does not affect the exit code, and it does not occur on CI (Linux, where `shell` is `false`). No script change was needed.
- **Terminal mojibake on Chinese output** was again a PowerShell console-codepage artifact only; the scripts' bytes are correct.

## Known Stubs

| Placeholder | Intent | Owner |
|---|---|---|
| `core-singletons-only-imported-by-composition-root` in `.dependencyCruiser.cjs` | Deliberately vacuous in Phase 2 (D-17): core has no module-level singletons yet, so the rule passes on an empty set. It is a shipped deliverable, not unfinished work — the point is that the rule is linked and running from day one, so VERIFY-05 has machine evidence in Phase 2. | Starts biting in Phase 3, when `lib/kernel/core.ts` and the six singletons exist. Registered in `.planning/WINDOWS.md` as entry 3. |

No hardcoded-empty-value stub, placeholder text, or mock-data component was introduced by this plan. The two throwaway fixtures (`__boundariesProbe__.ts`, `__polarityProbe__.ts`) are created and removed by the verifier itself, are never committed, and their absence is asserted by the script.

## Threat Flags

None — no security-relevant surface beyond the plan's `<threat_model>` was introduced. Every change is confined to the registered surfaces: the new devDependency and its pin (T-03-01 / T-03-SC), the boundary rules and their two-polarity proof (T-03-02), the CI step set (T-03-03), the PandaCSS extraction assertion (T-03-04), the compiler transform assertion (T-03-05) and the never-committed fixtures (T-03-06).

## Verification evidence (verbatim)

Task 2 `<automated>` (`node scripts/verify/coreBoundaries.js && node scripts/verify/ci-workflow.js && pnpm exec prettier --check .dependencyCruiser.cjs scripts/verify/coreBoundaries.js && pnpm lint`):

```
coreBoundaries: 真实树 cruise 通过（error 违规 0 条，warn 0 条，共 12 个模块、6 条依赖）
coreBoundaries: core 包内相对边全部解析到 core 内部（9 个 core 模块、2 条相对边）
coreBoundaries: 容忍 2 条 @styled-system/* 未解析边 —— 它是 PandaCSS 由消费方生成的路径（packages/apps/editor/styled-system），不是真实包；因此不添加 blanket not-to-unresolvable 规则（Pitfall 6）
coreBoundaries: 全部断言通过（真实树 0 违规、合成违规被拦、PKG-03 负极性 TS2307、editor→core 边方向正确）
```
→ exit **0**; `ci-workflow: 全部断言通过（4 个 job 与工具链固定值一致，无 secrets/environment/paths）` exit **0**; `All matched files use Prettier code style!` exit **0**; `pnpm lint` → `108 problems (0 errors, 108 warnings)` exit **0**.

Task 2 acceptance criteria:

- `pnpm install --frozen-lockfile` → `Lockfile is up to date, resolution step is skipped` / `Done in 212ms using pnpm v12.5.1`, exit **0**
- Synthetic violation (fixture present): `summary.error = 1`; violation `capabilities-must-not-import-each-other: packages/libs/editor-core/lib/code/__boundariesProbe__.ts → packages/libs/editor-core/lib/table/index.ts`; JSON cruise exit **0**, default `err` reporter exit **1**; after removal `node scripts/verify/coreBoundaries.js` → exit **0**
- PKG-03 polarity (fixture present): `lib/__polarityProbe__.ts(1,35): error TS2307: Cannot find module './definitely-missing-module' or its corresponding type declarations.` → exit **1**; removed afterwards, path asserted absent
- Config: `["core-must-not-import-consumers","kernel-must-not-import-capabilities","react-and-shell-must-not-import-capabilities","capabilities-must-not-import-each-other","no-circular","core-singletons-only-imported-by-composition-root"]`, `all error: true`, `no allowed/required: true`, `no tsConfig: true`, `rules: 6`
- Catalog/manifest: `dependency-cruiser: 18.2.0` present between `blockly` and `dexie`; `package.json` has `"dependency-cruiser": "catalog:default"`; `allowBuilds` / `overrides` / `minimumReleaseAgeExclude` diffs empty
- `git status --porcelain` after the task: only the intended modified/added paths; neither fixture path exists

Task 3 `<automated>` (`node scripts/verify/corePandaClass.js && node scripts/verify/coreReactCompiler.js && node scripts/verify/ci-workflow.js && pnpm lint`):

```
corePandaClass: 提取产物包含 .display_block { display: block（产物 17015 字节）
corePandaClass: 全部断言通过（PandaCSS 提取覆盖 core 且产出 .display_block）
coreReactCompiler: react/compiler-runtime 标记：存在
coreReactCompiler: _c( memo-cache 调用：存在
coreReactCompiler: 全部断言通过（真实 Vite transformRequest 下 core TSX 被 React Compiler 转换）
ci-workflow: 全部断言通过（4 个 job 与工具链固定值一致，无 secrets/environment/paths）
```
→ all exit **0**; `pnpm lint` → `108 problems (0 errors, 108 warnings)` exit **0**.

Task 3 negative-polarity evidence (measured, nothing committed):

- PandaCSS **before** widening `include`: `panda cssgen` exited 0 but `has display_block: false` — the assertion can fail, so the green run is meaningful.
- PandaCSS **after** widening: emitted exactly `.display_block {\n    display: block;\n}` (matched by `\.display_block\s*\{\s*display:\s*block`).
- React Compiler markers on a hook-free module (`lib/index.ts`, the empty barrel) → `runtimeMarker=false, memoCache=false`; on the test module → `false, false`; on the probe → `true, true`.

Plan-level `<verification>`:

1. `node scripts/verify/coreBoundaries.js` → exit **0**
2. `node scripts/verify/corePandaClass.js` → exit **0**
3. `node scripts/verify/coreReactCompiler.js` → exit **0**
4. `node scripts/verify/ci-workflow.js` → exit **0**
5. `pnpm install --frozen-lockfile` → exit **0**
6. `pnpm lint` → `108 problems (0 errors, 108 warnings)` exit **0**; `pnpm format:check` → `All matched files use Prettier code style!` exit **0**; `pnpm typecheck` → exit **0**; `pnpm test` → **128 files / 1260 tests passed**, exit **0** (green on the 5th fan-out attempt; the first four hit the pre-existing `react-monaco-editor` flake — see Issues)
7. `git status --porcelain` → empty (clean); no fixture, no extraction outfile, no stray generated file
8. The Phase 1 verifiers are untouched and still green: `coreExports.js`, `prettier-setup.js`, `lint-severities.js` all exit **0**

## Next Phase Readiness

- **Phase 2 is complete: 3 of 3 plans have SUMMARYs.** The boundary is machine-enforced, core's own TypeScript program provably checks core's files, and the consumer's PandaCSS + React Compiler pipelines provably cover core source.
- Ready for **Phase 3 (kernel)**: `.dependencyCruiser.cjs` is already linked and running, so `lib/kernel/core.ts` and the six module-level singletons will be constrained by `core-singletons-only-imported-by-composition-root` from their first commit — no Phase 3 wiring needed. `coreBoundaries.js` re-runs in the `lint` job and will report the first real violation automatically.
- Carries forward from plans 01 and 02: (a) `.planning/baseline/editor-manifest.json` is stale relative to the tree; (b) the root ESLint config still assumes `typescript-eslint@8.50.1` (pinned in the catalog, preserved here); (c) the pre-existing `@motajs/react-monaco-editor` teardown flake (Phase 1 `deferred-items.md` §1/§10) keeps `pnpm test` nondeterministic until fixed.
- Deliberate placeholders a later phase must retire: the `CoreProbe` (WINDOWS entry 2) and the vacuous singleton rule (WINDOWS entry 3).

---

*Phase: 02-package-boundary-build-scaffolding*
*Completed: 2026-09-22*

## Self-Check: PASSED

- Created files exist on disk: `.dependencyCruiser.cjs`, `scripts/verify/coreBoundaries.js`, `scripts/verify/corePandaClass.js`, `scripts/verify/coreReactCompiler.js` — all present and committed.
- Commits exist: `cd3c71b` (Task 2) and `fc25670` (Task 3); `git rev-list --count 2f46c00d3f3abb7813f71deae4ad71a842b461ee..HEAD` = **2**.
- `plan_head_before`: `2f46c00d3f3abb7813f71deae4ad71a842b461ee`; `commits` measured = **2** (`actuals.commits`).
- No scratch residue: neither `packages/libs/editor-core/lib/code/__boundariesProbe__.ts` nor `packages/libs/editor-core/lib/__polarityProbe__.ts` exists; `packages/apps/editor/node_modules/.tmp/core-panda.css` is absent; `git status --porcelain` is empty.
- `packages/apps/editor/vite.config.ts`, `vitest.config.ts` and `postcss.config.cjs` are byte-identical to the plan head (no editor build configuration was changed to make a verifier pass).
