---
phase: 01-baseline-verification-net
plan: 02
subsystem: testing
tags: [baseline, vitest, playwright, screenshots, editor-artifact, protocol-constants, reproducibility]

# Dependency graph
requires:
  - phase: 01-baseline-verification-net
    plan: 01
    provides: "repaired workspace node_modules, mota-js submodule at 3efb548e, regenerated styled-system"
provides:
  - "scripts/baseline/collect.js - scope-based baseline collector (unit|build|e2e|screenshots), runner-derived counts only"
  - ".planning/baseline/baseline.json - git/submodule identity, per-package unit counts, e2e counts, artifact budget, protocol constants"
  - ".planning/baseline/BASELINE.md - human-readable baseline with the reproduction recipe"
  - ".planning/baseline/editor-manifest.json - verbatim copy of the editor build manifest"
  - ".planning/baseline/screenshots/ - five committed PNG baselines (shell + four editor surfaces)"
  - "packages/apps/editor/e2e/baseline-capture.spec.ts - Playwright capture spec in its own selectable project"
affects: [01-03, 01-04, 01-05, 01-06, 01-07, phase-11-preview-cutover]

actuals:
  tokens: 14246
  tasks: 3
  commits: 3
  plan_head_before: 63a56ad14eb771133a45e44b21f0c94c36421c7f

tech-stack:
  added: []
  patterns:
    - "Runner-derived counting: vitest --reporter=json / Playwright --reporter=json, never a source-file census"
    - "Plugin-derived artifact metrics: the collector reads the build plugin's own report line plus the manifest it writes"
    - "Scope-merge collector: each invocation reads baseline.json, merges only its own block, writes stable key order + trailing newline"
    - "Capture spec resolves its output directory from import.meta.url, never from the process cwd"
    - "A Playwright project that is selectable but not part of a default run (default project pinned by test:e2e)"

key-files:
  created:
    - scripts/baseline/collect.js
    - .planning/baseline/baseline.json
    - .planning/baseline/BASELINE.md
    - .planning/baseline/editor-manifest.json
    - .planning/baseline/screenshots/{shell,editor-map,editor-table,editor-code,editor-asset}.png
    - packages/apps/editor/e2e/baseline-capture.spec.ts
    - .planning/phases/01-baseline-verification-net/deferred-items.md
  modified:
    - packages/apps/editor/playwright.config.ts
    - packages/apps/editor/package.json

key-decisions:
  - "Recorded git.commit as HEAD at the LAST collector run and stated the exact file-set drift between the first (unit) and last (screenshots) collection, instead of pretending one SHA covers all four scopes."
  - "collect.js tolerates a pre-existing @motajs/react-monaco-editor teardown flake (all tests pass, process exits 1) by preserving the observed exitCode per package rather than discarding a valid measurement - the alternative was a permanently flaky baseline command."
  - "Renamed the editor's default Playwright project to a stable `editor` and pinned it in test:e2e, because a bare `playwright test` runs EVERY registered project - so `testIgnore` alone could not stop a normal e2e run from rewriting the committed PNGs."
  - "editor-map.png pins floor sample1: shell.png and editor-map.png were byte-identical (the map is the default surface), so the map baseline needed a distinct, documented state."
  - "Pre-started the service-worker preview server for the e2e scope so its suite could actually run past the 120s webServer watchdog, then recorded the real 0/4 result with failing spec names instead of a not-run placeholder."
  - "Committed directly on `main`: git.branching_strategy is `none`, plan 01-01 committed to main with approval, and the execution prompt required atomic per-task commits in the main working tree."

patterns-established:
  - "Baseline numbers must be runner-derived or plugin-derived; a file census gives 123 files where the runner reports 1231 tests."
  - "Baseline commands must be re-runnable: merge-only-own-block + deterministic key order keeps the JSON diffable."
  - "Known-before numbers (flaky specs, non-zero exit codes, not-run reasons) are recorded as facts so later phases can distinguish pre-existing failures from regressions."

requirements-completed: [VERIFY-01, VERIFY-07]

coverage:
  - id: D1
    description: "Machine-readable `.planning/baseline/baseline.json` and human-readable `.planning/baseline/BASELINE.md` exist with per-package unit counts, e2e counts, the artifact budget and the reproduction recipe"
    requirement: VERIFY-01
    verification:
      - kind: integration
        ref: "node scripts/baseline/collect.js unit -> exit 0; 8 packages, 1231 tests, 0 failed, 0 skipped"
      - kind: integration
        ref: "node scripts/baseline/collect.js build -> exit 0; rawBytes 17618356 <= 20971520 (84.0109%)"
      - kind: integration
        ref: "node scripts/baseline/collect.js e2e -> exit 0; editor 96/2/98, service-worker 0/4/4 recorded"
    human_judgment: false
  - id: D2
    description: "`.planning/baseline/editor-manifest.json` is a byte-for-byte copy of the editor build output so later phases can diff it"
    requirement: VERIFY-01
    verification:
      - kind: integration
        ref: "sha256(packages/apps/editor/dist/editor-manifest.json) == sha256(.planning/baseline/editor-manifest.json) -> true"
    human_judgment: false
  - id: D3
    description: "Five distinct, non-empty PNG baselines (shell + map + table + code + asset) captured from the shared ProjectSandbox fixture"
    requirement: VERIFY-01
    verification:
      - kind: e2e
        ref: "pnpm --filter @motajs/editor exec playwright test --project baseline-capture -> 1 passed"
      - kind: other
        ref: "five 1440x900 PNGs, all non-empty and pairwise distinct; packages/apps/editor/.planning absent"
    human_judgment: true
    rationale: "D-08 mandates human comparison for these images, and 'no capture shows the runtime preview iframe' is a visual judgement automation cannot make."
  - id: D4
    description: "The pre-existing manifest 3 / runtime 4 protocol mismatch is recorded unchanged, never fixed in this milestone"
    requirement: VERIFY-07
    verification:
      - kind: integration
        ref: "baseline.json.protocol = {manifestRuntimeProtocolVersion: 3, runtimeProtocolVersion: 4, mismatchPreserved: true}; values parsed from the two source files"
    human_judgment: true
    rationale: "VALIDATION.md lists 'protocol mismatch recorded, not fixed' as manual-only: the automated check proves the numbers were read, but only a human can confirm neither was edited."
  - id: D5
    description: "`scripts/baseline/collect.js` reproduces the whole baseline from the repository root with Node only, and every scope is re-runnable without duplicating keys"
    requirement: VERIFY-01
    verification:
      - kind: integration
        ref: "node scripts/baseline/collect.js unit run twice -> identical key set, no duplicates, baseline.json parses"
      - kind: integration
        ref: "pnpm exec eslint scripts/baseline/collect.js -> clean under the root flat config"
    human_judgment: false

duration: 2h37m
completed: 2026-09-20
status: complete
---

# Phase 1: Baseline & Verification Net - Plan 01-02 Summary

**A quantified, re-runnable "before" picture: 1231 unit tests across 8 packages, 17,618,356 raw artifact bytes at 84.01% of the 20 MiB ceiling, the editor manifest committed verbatim, five distinct screenshot baselines, and the manifest-3 / runtime-4 protocol mismatch recorded untouched.**

## Performance

- **Duration:** 2h37m
- **Started:** 2026-09-20T16:13:00+08:00
- **Completed:** 2026-09-20T18:50:00+08:00
- **Tasks:** 3
- **Files modified:** 13 (5 new PNGs, 8 tracked text/JSON files)

## Accomplishments

- `scripts/baseline/collect.js` — one ESM script, four scopes (`unit`, `build`, `e2e`, `screenshots`), zero workspace imports, zero new dependencies. Every number is taken from the runner's own report (`vitest --reporter=json`, Playwright `--reporter=json`) or from the editor build plugin's own report line and manifest.
- Unit baseline: **1231 tests, 0 failed, 0 skipped** across the 8 packages that define a `test` script (`@motajs/editor` 865, `@motajs/service-worker` 44, `@motajs/h5animate` 202, `@motajs/packer` 94, `@motajs/file2x` 14, `@motajs/react-monaco-editor` 6, `@motajs/react-hooks` 3, `@motajs/react-store` 3).
- Build baseline: **57 files, raw 17,618,356 B (84.0109% of the 20 MiB ceiling)**, gzip 4,498,391 B, brotli 3,753,902 B, exactly one standard `ts.worker`, no css/html workers; `editor-manifest.json` copied byte-for-byte into `.planning/baseline/`.
- e2e baseline recorded honestly, including the pre-existing failures: editor 96 passed / 2 failed / 98 total, service-worker 0 passed / 4 failed / 4 total with the failing spec names.
- Five **distinct** screenshot baselines (verified pairwise-different by hash) captured through the same `ProjectSandbox` fixture the unit tests use, at a fixed 1440x900 viewport, with the runtime preview hidden.
- `BASELINE.md` carries the reproduction recipe, the four CI job names as the required-status-check contract, the four behaviour-relevant env var names, all four protocol constants with the "intentionally preserved, never fix" statement, and the typecheck blind spot.

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): build the baseline collector and record per-package unit counts** - `a2eba52` (feat)
2. **Task 2: record the production build, artifact budget, manifest and e2e results, and write BASELINE.md** - `1e118e1` (feat)
3. **Task 3: capture the five committed screenshot baselines** - `0ef06cb` (feat)

**Plan metadata:** this SUMMARY commit (docs: complete plan)

_Measured with the persisted ledger (`plan_head_before: 63a56ad14eb771133a45e44b21f0c94c36421c7f`): `git rev-list --count 63a56ad..HEAD` = **3** at SUMMARY-write time. The SUMMARY metadata commit is not part of that count._

## Files Created/Modified

- `scripts/baseline/collect.js` (new) — the collector. `unit` spawns each package's vitest with `--reporter=json --outputFile <tmp>`; `build` runs the editor build, captures the plugin's report line, copies the manifest and derives the worker facts; `e2e` runs both Playwright suites through the JSON reporter and records not-run reasons and failing spec names; `screenshots` records the five PNG sizes. Every scope also refreshes the git/submodule identity, the protocol constants and the CI/env-name contract.
- `.planning/baseline/baseline.json` (new) — the machine-readable snapshot. Top-level keys, in fixed order: `git`, `unit`, `e2e`, `build`, `protocol`, `ciJobNames`, `envVars`, `screenshots`.
- `.planning/baseline/BASELINE.md` (new) — the human-readable baseline and the reproduction recipe.
- `.planning/baseline/editor-manifest.json` (new) — verbatim editor build output (`buildId a22a4490...`, `schemaVersion 2`, 57 files).
- `.planning/baseline/screenshots/*.png` (new, 5) — `shell.png`, `editor-map.png`, `editor-table.png`, `editor-code.png`, `editor-asset.png`, all 1440x900 and byte-distinct.
- `packages/apps/editor/e2e/baseline-capture.spec.ts` (new) — the capture spec; `ProjectSandbox.create(page)`, fixed viewport, animations disabled, output directory from `import.meta.url`, absolute paths to `page.screenshot`, non-empty assertion after every write, no reference-image assertion.
- `packages/apps/editor/playwright.config.ts` (modified) — default project renamed to `editor` with `testIgnore` for the capture spec; new `baseline-capture` project with `testMatch`.
- `packages/apps/editor/package.json` (modified) — `test:e2e` is now `playwright test --project=editor`.
- `.planning/phases/01-baseline-verification-net/deferred-items.md` (new) — pre-existing defects discovered while capturing the baseline.

## Decisions Made

- **Runner-derived counts only.** A source-file census of this tree gives 123 unit test files where the runner reports 1231 tests; `BASELINE.md` states the caveat explicitly so nobody "corrects" the numbers to a file count later.
- **One SHA is not enough, and pretending otherwise is worse.** `baseline.json.git.commit` is HEAD at the last collection, and `BASELINE.md` names the exact file set that differs between the first and last collection (`collect.js`, `.planning/baseline/**`, the capture spec, `playwright.config.ts`) and why none of it can move a unit/build/e2e number.
- **Record, do not hide, the pre-existing failures.** The service-worker e2e failures, the editor e2e flakiness and the `@motajs/react-monaco-editor` non-zero exit are all in `baseline.json` and `BASELINE.md`, so later phases can tell a regression from the weather.
- **Distinguishable screenshots beat identical ones.** `editor-map.png` pins floor `sample1` because the map is the default surface and the shell capture was byte-identical to it otherwise.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `testIgnore` alone could not stop a normal e2e run from rewriting the PNGs**
- **Found during:** Task 3 (screenshot capture)
- **Issue:** The plan asked for a second project (`baseline-capture`) *and* for a default `test:e2e` run not to execute the capture spec. Playwright's bare `playwright test` runs **every** registered project, so a second always-registered project is executed regardless of the first project's `testIgnore` — verified with `playwright test --list` (99 tests = 98 + 1). An env/argv gate was tried first and failed in the worker process (`Project "baseline-capture" not found in the worker process`), because workers re-evaluate the config without the CLI `--project` argument.
- **Fix:** Renamed the default project to a stable `editor` (channel stays dynamic via `use.channel`), kept `testIgnore` on it as belt-and-braces, and pinned `test:e2e` to `playwright test --project=editor`. Verified: `playwright test --project=editor --list` = 98 tests, no `baseline-capture`; `playwright test --project baseline-capture --list` = 1 test.
- **Files modified:** `packages/apps/editor/playwright.config.ts`, `packages/apps/editor/package.json` (`package.json` was not in the plan's file list — this is the deviation)
- **Verification:** both `--list` checks above, plus a full `--project baseline-capture` run that passed
- **Committed in:** `0ef06cb` (Task 3 commit)

**2. [Rule 2 - Missing Critical] shell.png and editor-map.png were byte-identical**
- **Found during:** Task 3 (first capture run)
- **Issue:** The map editor is the default surface, so the `workbench` capture and the `map-pixi-renderer` capture produced the same 270,976-byte PNG (identical sha256). A five-image baseline with one redundant image is not a baseline.
- **Fix:** `editor-map.png` now selects floor `sample1` (and asserts the select value) so the two targets carry different information; all five PNGs verified pairwise distinct by hash.
- **Files modified:** `packages/apps/editor/e2e/baseline-capture.spec.ts`
- **Verification:** sha256 of all five PNGs compared; no duplicates
- **Committed in:** `0ef06cb` (Task 3 commit)

**3. [Rule 3 - Blocking] capture spec needed a longer timeout to cold-start the editor**
- **Found during:** Task 3 (first capture run)
- **Issue:** `page.goto("/")` exceeded Playwright's default 30s test timeout when the capture spec is the only spec in the run, because the Vite dev server has to transform the whole editor for the first request.
- **Fix:** `test.setTimeout(120_000)` inside the test (the same idiom `workspace-shell.spec.ts` already uses); capture completes in ~1.1m.
- **Files modified:** `packages/apps/editor/e2e/baseline-capture.spec.ts`
- **Verification:** `--project baseline-capture` passes
- **Committed in:** `0ef06cb` (Task 3 commit)

**4. [Rule 3 - Blocking] `@motajs/react-monaco-editor` intermittently exits non-zero after an all-passing report**
- **Found during:** Task 1 (`node scripts/baseline/collect.js unit`)
- **Issue:** The package's vitest run writes a complete JSON report (6/6 passed) and then, roughly half the time, exits 1 after printing `undefined` — reproducibly reporter-independent and reproduced with plain `vitest run`. The collector treated any non-zero exit as a failed measurement, so `collect.js unit` could not exit 0.
- **Fix:** The collector now fails only on a missing/incomplete report, `total === 0`, or `failed > 0`; a non-zero exit after a complete all-passing report is recorded as that package's `exitCode` and logged as a warning. Nothing is hidden — the anomaly is in `baseline.json` and `deferred-items.md`.
- **Files modified:** `scripts/baseline/collect.js`
- **Verification:** `collect.js unit` ran three times, exit 0 each time; the package block carries `exitCode`
- **Committed in:** `a2eba52` (Task 1 commit)

**5. [Rule 2 - Missing Critical] e2e failures were recorded without their names**
- **Found during:** Task 2 (e2e scope)
- **Issue:** A count of "2 failed" out of 98 is useless to a later phase that has to decide whether a failure is theirs.
- **Fix:** The `e2e` scope now walks the Playwright JSON report and records `failedTests` (`file > suite > title`) whenever `failed > 0` or `flaky > 0`.
- **Files modified:** `scripts/baseline/collect.js`
- **Verification:** `baseline.json.e2e` lists the failing editor specs and all four failing service-worker specs
- **Committed in:** `1e118e1` (Task 2 commit)

**6. [Rule 3 - Blocking / environment] the service-worker e2e suite could not start through its own configuration**
- **Found during:** Task 2 (e2e scope)
- **Issue:** Its `webServer.command` runs `pnpm build:with-editor` first, which measured ~6 minutes on this machine (editor build 3m53s + service-worker build 1m44s + staging), against `webServer.timeout: 120_000`. Playwright aborted with `Timed out waiting 120000ms from config.webServer`, so the first e2e collection recorded `not-run`. Chrome itself is available, so "no Chrome channel" was not the cause.
- **Fix:** Pre-started the same preview server the config would have launched (the config already sets `reuseExistingServer: true`), drove it from a throwaway Node script **outside the repository**, and re-ran the collector so both suites executed. The suite then failed all four specs before any editor interaction; that real result (0/4 with spec names) is what is recorded, not a placeholder.
- **Files modified:** none in the repo (the driver lives in the OS temp directory); `baseline.json` and `BASELINE.md` carry the outcome
- **Verification:** reproduced twice (the configured webServer timeout, then the four failures with a pre-started server) plus a standalone browser probe
- **Committed in:** `1e118e1` (Task 2 commit)

**7. [Rule 2 - Missing Critical] added `deferred-items.md`**
- **Found during:** Task 2
- **Issue:** The scope-boundary rule requires logging out-of-scope discoveries in the phase directory, and `BASELINE.md` references that file by name.
- **Fix:** Created `.planning/phases/01-baseline-verification-net/deferred-items.md` with the six pre-existing findings (unit flake, editor e2e flakiness, service-worker e2e startup + failures, local/CI toolchain gap, root `eslint .` OOM, one pre-existing lint error).
- **Files modified:** `.planning/phases/01-baseline-verification-net/deferred-items.md`
- **Verification:** file exists and is referenced from `BASELINE.md` §5/§9
- **Committed in:** `1e118e1` (Task 2 commit), extended in `0ef06cb`

---

**Total deviations:** 7 auto-fixed (4 blocking, 3 missing-critical) — one of which (deviation 1) also had to touch a file outside the plan's declared set.
**Impact on plan:** No scope creep and no dependency changes. Every deviation was required either for correctness of the artifact (deviations 1, 2, 5, 7), for the collector to run at all (deviations 3, 4, 6), or for the baseline to be measurable (deviation 6). The plan's own acceptance criteria were in tension for deviation 1; the resolution is documented rather than worked around silently.

## Issues Encountered

- **Service-worker e2e is red in this environment.** All four specs fail before any editor interaction, and its configured webServer cannot start inside 120s. Both facts are recorded; diagnosis is deferred (`deferred-items.md` #3).
- **Editor e2e is flaky.** Two consecutive full runs produced 3 then 2 failures out of 98; `blockly-text-field.spec.ts` and `workspace-shell.spec.ts` recurred. Recorded as pre-existing (`deferred-items.md` #2).
- **Root `pnpm exec eslint .` runs out of memory**, almost certainly because `packages/external/mota-js` is inside the lint roots and `eslint.config.js` does not ignore it. This will bite plan 01-03's `lint` job (`deferred-items.md` #5).
- **One pre-existing lint error** (`@stylistic/operator-linebreak`) in `packages/apps/editor/playwright.config.ts:5`, on a line this plan did not touch. Left as found (`deferred-items.md` #6).
- **No blockers for this plan.** Its own commands (`collect.js unit|build|e2e|screenshots`, the capture project) all exit 0.

## Protected-branch note

All three task commits landed directly on `main` (`a2eba52`, `1e118e1`, `0ef06cb`). That is deliberate and reported rather than worked around: `.planning/config.json` sets `git.branching_strategy: "none"`, plan 01-01 was reviewed and committed to `main` the same way, and the execution prompt required atomic per-task commits in the **main working tree** because the capture spec resolves paths up to the real repository root. No `git update-ref`, force-push, stash or history rewrite was used.

## User Setup Required

None — no external service configuration required. The Playwright chromium build (v1228) was downloaded into the shared browser cache via the local proxy; nothing was persisted into the repository config or `.gitmodules`.

## Next Phase Readiness

- The baseline is committed and re-runnable, so plans 01-03 through 01-07 can diff against it (`baseline.json` for machines, `BASELINE.md` for humans, the five PNGs for eyes).
- **Input for plan 01-03 (`ci.yml` + lint/typecheck gates):** the `lint` job as specified (`pnpm exec eslint .`) currently OOMs because the vendored submodule is linted; scope the lint roots or add an ignore first.
- **Input for any later e2e work:** the service-worker suite needs its `webServer.timeout` raised (or the build split out of `webServer.command`) before it can start at all.
- **Input for VERIFY-06 (`test:e2e` silent skip):** `MOTA_WITH_EDITOR=0` remains the escape hatch; the baseline explicitly refuses to run with it set.
- Not to be "fixed" in this milestone: manifest `runtimeProtocolVersion: 3` vs `RUNTIME_PROTOCOL_VERSION = 4`.

## Self-Check: PASSED

- Created files present: `.planning/baseline/baseline.json`, `.planning/baseline/BASELINE.md`, `.planning/baseline/editor-manifest.json`, all five `.planning/baseline/screenshots/*.png`, `scripts/baseline/collect.js`, `packages/apps/editor/e2e/baseline-capture.spec.ts`, `.planning/phases/01-baseline-verification-net/deferred-items.md` — all verified on disk.
- Commits present: `a2eba52`, `1e118e1`, `0ef06cb` — all in `git log`.
- `.planning/baseline/editor-manifest.json` is byte-identical to `packages/apps/editor/dist/editor-manifest.json` (sha256 match).
- `packages/apps/editor/.planning/` does not exist.
- STATE.md and ROADMAP.md were not modified (orchestrator-owned).

---

*Phase: 01-baseline-verification-net*
*Completed: 2026-09-20*
