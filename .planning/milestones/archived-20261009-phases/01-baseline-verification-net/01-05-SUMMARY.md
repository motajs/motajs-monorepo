---
phase: 01-baseline-verification-net
plan: 05
subsystem: testing
tags: [playwright, e2e, fixture, service-worker, editor-release, protocol-constants, verification]

# Dependency graph
requires:
  - phase: 01-baseline-verification-net
    plan: 01
    provides: "repaired workspace node_modules, mota-js submodule at 3efb548e, Playwright browsers"
  - phase: 01-baseline-verification-net
    plan: 02
    provides: "the quantified baseline; the known service-worker e2e startup/failure findings"
provides:
  - "packages/apps/service-worker/e2e/fixtures.ts — required, named `editorRelease` Playwright fixture reading the SW `editor.status` reply"
  - "scripts/verify/e2e-prerequisite.js — two-polarity verifier (staged passes, unstaged fails with the named message)"
  - "packages/apps/editor/editor-artifact-plugin.test.ts — manifest protocol constants pinned by driving the real plugin"
  - "packages/apps/service-worker/playwright.config.ts — deterministic server reuse, build-adequate webServer timeout, bundled-chromium default"
affects: [01-06, 01-07, phase-11-preview-cutover, any later e2e work on the service worker]

actuals:
  tokens: 2638
  tasks: 3
  commits: 4
  plan_head_before: 89dc949276b6712f58e155e9365108a76f7bc653

tech-stack:
  added: []
  patterns:
    - "Required Playwright fixture (test.extend, auto:false) replaces a runtime test.skip; a missing prerequisite throws a named remediation error instead of passing"
    - "Prerequisite detection reads the service worker's global editor.status reply from the app root — the same value that gates the open-editor affordance — never a project-page-only test id"
    - "Two-polarity verifier: prove the staged run passes FIRST (so an unconditional throw cannot pass), then prove the unstaged run fails with the exact named message"
    - "CI=1 + reuseExistingServer:!CI forces a fresh build/server on both polarities so neither run can observe the other's release"
    - "Drive the real artifact plugin's configResolved/closeBundle on a fabricated validator-satisfying artifact rather than asserting a source literal"
    - "Mirror the editor Playwright config's browser-channel selection (bundled chromium by default; system Chrome only on request or non-CI macOS)"

key-files:
  created:
    - packages/apps/service-worker/e2e/fixtures.ts
    - scripts/verify/e2e-prerequisite.js
  modified:
    - packages/apps/service-worker/e2e/project-host.spec.ts
    - packages/apps/service-worker/playwright.config.ts
    - packages/apps/editor/editor-artifact-plugin.test.ts

key-decisions:
  - "The fixture reads the service worker's `editor.status` (global SW status, reachable from `/`) rather than probing `open-editor`, which only ProjectView renders on `service/:id/project/`; probing `open-editor` on `/` would throw even when a release is staged."
  - "The fixture enforces a bounded in-page wait so an unresponsive service worker fails it instead of hanging, and never treats `MOTA_WITH_EDITOR=0` as a pass path."
  - "The verifier asserts the staged polarity first (exit 0 required) so a fixture that throws unconditionally cannot satisfy the unstaged assertion by accident."
  - "Defaulted the service-worker e2e project to Playwright's bundled chromium: system Chrome 153 disconnects the browser on `/service/:id/project/` (probe: PAGE_CLOSE / BROWSER_DISCONNECTED) against Playwright 1.61, so the editor-dependent test could never pass under the previous hardcoded `channel: \"chrome\"`."
  - "Raised the service-worker webServer timeout from 120s to 15m: the default build:with-editor chain measures ~6.5 min here, so the configured server could never start (deferred-items.md #3). This changes no assertion, only allows the build to finish."
  - "Asserted the manifest `runtimeProtocolVersion` (3) and the runtime `RUNTIME_PROTOCOL_VERSION` (4) each against its own literal; never a relation between them, and neither value is changed."

patterns-established:
  - "A silently-skipped required check is a falsified gate: replace `test.skip(prereq, …)` with a required fixture that fails loudly and names the exact remediation command."
  - "A verifier for a conditional fixture must prove both polarities, staged first, or it cannot distinguish a conditional fixture from an unconditional one."
  - "Generated protocol assertions must observe real output, not restate a source literal; intentional drift is pinned with a comment, never 'fixed'."

requirements-completed: [VERIFY-06, VERIFY-07]

coverage:
  - id: D1
    description: "The editor-dependent service-worker e2e test requests a required `editorRelease` fixture instead of calling test.skip; the fixture resolves against a staged release and throws `Editor release is not staged` naming `build:with-editor` when absent"
    requirement: VERIFY-06
    verification:
      - kind: e2e
        ref: "node scripts/verify/e2e-prerequisite.js -> staged run: 1 passed (6.5m); unstaged run (MOTA_WITH_EDITOR=0): 1 failed with `Editor release is not staged (unavailable / not-installed: Editor channel returned HTTP 404)`"
        status: pass
      - kind: integration
        ref: "greps: no `test.skip(` in project-host.spec.ts or fixtures.ts; fixture reads `editor.status` and throws the named remediation"
        status: pass
    human_judgment: false
  - id: D2
    description: "scripts/verify/e2e-prerequisite.js deterministically proves both polarities of the fixture with fresh servers on each run"
    requirement: VERIFY-06
    verification:
      - kind: integration
        ref: "node scripts/verify/e2e-prerequisite.js -> exit 0; staged polarity exit 0, unstaged polarity non-zero containing the named message"
        status: pass
      - kind: other
        ref: "pnpm exec eslint scripts/verify/e2e-prerequisite.js -> clean"
        status: pass
    human_judgment: false
  - id: D3
    description: "The editor artifact manifest's protocol constants are pinned by a test that drives the real plugin and writes editor-manifest.json; neither manifest 3 nor runtime 4 is changed"
    requirement: VERIFY-07
    verification:
      - kind: unit
        ref: "editor-artifact-plugin.test.ts#writes a manifest whose protocol constants are pinned to their current literals -> pass (schemaVersion 2, environmentProtocolVersion 1, runtimeProtocolVersion 3, entrypoints literal)"
        status: pass
      - kind: integration
        ref: "git diff --exit-code -- packages/apps/editor/src/runtime/protocol.ts packages/apps/editor/src/runtime/protocol.test.ts -> exit 0"
        status: pass
    human_judgment: false

duration: 51min
completed: 2026-09-20
status: complete
---

# Phase 1 Plan 05: Baseline & Verification Net — Required E2E Fixture & Manifest Protocol Pin

**The last silent e2e skip became a required `editorRelease` fixture that reads the service worker's `editor.status` and fails loudly with a named remediation command when the release is unstaged; a two-polarity verifier proves the staged run passes (6.5m, 1 passed) and the unstaged run fails with `Editor release is not staged`; and the manifest's `runtimeProtocolVersion: 3` is now pinned by driving the real artifact plugin while `RUNTIME_PROTOCOL_VERSION = 4` stays untouched.**

## Performance

- **Duration:** 51 min
- **Started:** 2026-09-20T19:15:00+08:00
- **Completed:** 2026-09-20T20:06:00+08:00
- **Tasks:** 3
- **Files modified:** 5 (2 created, 3 modified)
- **Commits:** 4 (measured: `git rev-list --count 89dc949..HEAD` = 4)

## Accomplishments

- `packages/apps/service-worker/e2e/fixtures.ts` — a **named** (`auto: false`) `editorRelease` fixture built on `@playwright/test`'s `test.extend`. It navigates to `/`, awaits `navigator.serviceWorker.ready` (with a `controllerchange` wait when uncontrolled), posts `[requestId, "editor.status", null]` to the controller, and waits for the matching reply under a bounded 30s timer. It reads the exact global SW value ProjectView's `useQuery(["editor-host"], …GetEditorHostStatusMessage…)` reads, so it resolves iff the `open-editor` affordance can appear. When the reply is missing or not `"ready"`, it throws `Editor release is not staged (…)` naming `pnpm --filter @motajs/service-worker build:with-editor`. It records the run's `MOTA_WITH_EDITOR` value as a `testInfo.annotations` entry, and it **never** calls `test.skip`.
- `packages/apps/service-worker/e2e/project-host.spec.ts` — imports `test`/`expect` from the fixture module, requests `editorRelease` in `shows live Editor cache progress on the project page` (and asserts the 64-hex `buildId`), deletes the `test.skip(!withEditor, …)` line, and turns the first test's `MOTA_WITH_EDITOR=0` branch into an explicit, annotated "editor hosting out of scope" decision instead of a silently weaker `toHaveCount(0)` assertion.
- `scripts/verify/e2e-prerequisite.js` — a pure-Node ESM verifier that runs the editor-dependent test twice with `CI=1`. Staged first (no `MOTA_WITH_EDITOR` override): must exit 0. Unstaged second (`MOTA_WITH_EDITOR=0`): must exit non-zero **and** its output must contain `Editor release is not staged`. It exits non-zero if the unstaged run passes (silent-skip regression) or fails for an unrecognised reason, printing the child's combined output.
- `packages/apps/editor/editor-artifact-plugin.test.ts` — a new test that fabricates a validator-satisfying artifact (`index.html` + exactly one `assets/ts.worker-abc.js`), drives the real `mota-editor-artifact` plugin's `configResolved` + `closeBundle`, and asserts the written `editor-manifest.json`: `schemaVersion 2`, `environmentProtocolVersion 1`, `runtimeProtocolVersion 3`, and `entrypoints` literally. Each value is asserted against its own literal, with a comment recording that the 3-vs-4 drift is intentionally preserved.
- `packages/apps/service-worker/playwright.config.ts` — `reuseExistingServer: !process.env.CI` (mirrors the editor config), a 15-minute webServer timeout (the `build:with-editor` chain needs ~6.5 min), and bundled-chromium-by-default channel selection.

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace the silent skip with a required editorRelease fixture** — `74b0fa3` (test)
2. **Task 1 blocker fix: default the SW e2e project to bundled chromium** — `351c5c3` (fix)
3. **Task 2: Add a deterministic verifier that proves both fixture polarities** — `08d3ca2` (test)
4. **Task 3: Pin the manifest protocol constants by driving the real artifact plugin** — `6565059` (test)

**Plan metadata:** this SUMMARY commit (docs: complete plan)

_Measured with the persisted ledger (`plan_head_before: 89dc949276b6712f58e155e9365108a76f7bc653`): `git rev-list --count 89dc949..HEAD` = **4** at SUMMARY-write time. The SUMMARY metadata commit is not part of that count._

## Verification (exact results)

| # | Command | Result |
|---|---------|--------|
| 1 | `node scripts/verify/e2e-prerequisite.js` | **exit 0**. Staged polarity: `Running 1 test` → `1 passed (6.5m)` → `[e2e-prerequisite] staged polarity passed (exit 0)`. Unstaged polarity (`MOTA_WITH_EDITOR=0`, `CI=1`): `1 failed` with `Error: Editor release is not staged (unavailable / not-installed: Editor channel returned HTTP 404). Run \`pnpm --filter @motajs/service-worker build:with-editor\` and retry.` → `[e2e-prerequisite] OK`. |
| 2 | Task 1 fixture contract grep | `fixture contract present`, exit 0 (no `test.skip(`; `editorRelease` requested; `editor.status` read; named message + `build:with-editor` present) |
| 3 | `pnpm --filter @motajs/service-worker exec tsc -b` | exit 0 |
| 4 | `pnpm --filter @motajs/editor exec vitest run editor-artifact-plugin.test.ts src/runtime/protocol.test.ts` | exit 0 — `2 passed` files, **7 passed** tests (was 6; +1 new manifest test) |
| 5 | `git diff --exit-code -- packages/apps/editor/src/runtime/protocol.ts packages/apps/editor/src/runtime/protocol.test.ts` | exit 0 (both untouched) |
| 6 | `pnpm exec eslint` on all five changed files + the verifier | clean |

## Files Created/Modified

- `packages/apps/service-worker/e2e/fixtures.ts` (new) — required `editorRelease` fixture; reads the SW `editor.status` reply from `/` with a bounded wait; throws the named remediation error; re-exports `test`/`expect`.
- `packages/apps/service-worker/e2e/project-host.spec.ts` (modified) — uses the fixture, requests `editorRelease`, drops `test.skip`, annotates the `MOTA_WITH_EDITOR=0` branch.
- `packages/apps/service-worker/playwright.config.ts` (modified) — `reuseExistingServer: !process.env.CI`, 15m webServer timeout, bundled-chromium default (with `PLAYWRIGHT_USE_SYSTEM_CHROME=1` override).
- `scripts/verify/e2e-prerequisite.js` (new) — staged-first, unstaged-second two-polarity verifier.
- `packages/apps/editor/editor-artifact-plugin.test.ts` (modified) — drives the real plugin to pin the manifest protocol constants.

## Decisions Made

- **Detect staging from `editor.status`, not `open-editor`.** `open-editor` is rendered only by ProjectView on `service/:id/project/`, gated on `editorStatus.data?.status === "ready"`; on `/` it is absent whether or not a release is staged. The global `editor.status` reply is reachable from `/` and is exactly the value that gates the affordance.
- **Staged polarity first in the verifier.** A fixture that throws unconditionally would trivially satisfy an "unstaged must fail" assertion; proving the staged run passes first makes the check meaningful.
- **Drive the real plugin.** The manifest is observed from the file `closeBundle` actually writes (on a fabricated, validator-satisfying artifact), not read from a source literal — so the assertion would catch a regression in the emitted manifest.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Service-worker e2e project hardcoded system Chrome, which disconnects on the project route**
- **Found during:** Task 2 (running the staged polarity)
- **Issue:** The SW e2e project used `channel: "chrome"`. On this machine the system Chrome is **153.0.8010.48**, incompatible with Playwright 1.61: a direct probe of `/service/:id/project/` reproduced `PAGE_CLOSE` + `BROWSER_DISCONNECTED` (the browser exits before the page renders). The same probe on Playwright's bundled chromium rendered the project page perfectly (`open-editor` present, `controller: true`). With system Chrome, the editor-dependent test could never pass even with a staged release — so the plan's staged-polarity acceptance criterion was unreachable.
- **Fix:** Mirrored the editor config's channel selection: `channel: useSystemChrome ? "chrome" : undefined`, where `useSystemChrome = process.env.PLAYWRIGHT_USE_SYSTEM_CHROME === "1" || (!process.env.CI && process.platform === "darwin")`. Written in the operator-linebreak style the root lint config requires (the editor's version trips `@stylistic/operator-linebreak`).
- **Files modified:** `packages/apps/service-worker/playwright.config.ts`
- **Verification:** staged run `1 passed (3.8s)` on a pre-started server, and `1 passed (6.5m)` through the verifier's fresh build
- **Committed in:** `351c5c3` (dedicated Task 1 blocker-fix commit)

**2. [Rule 3 - Blocking] webServer timeout (120s) is shorter than the configured build (~6.5 min)**
- **Found during:** Task 1 (config review) / Task 2
- **Issue:** `webServer.command` under the default branch is `pnpm build:with-editor && pnpm preview …`, which measures ~6.5 min (editor build + SW build + staging), against `webServer.timeout: 120_000`. Playwright aborts with `Timed out waiting 120000ms from config.webServer` (the finding already recorded in `deferred-items.md` #3), so no fresh-server run could ever start.
- **Fix:** Raised `timeout` to `15 * 60_000`. No assertion or command changed; this only allows the build to complete. Reuse semantics were left as the plan specified (`!process.env.CI`).
- **Files modified:** `packages/apps/service-worker/playwright.config.ts`
- **Verification:** staged polarity via the verifier (`CI=1`, fresh build) completes and passes
- **Committed in:** `74b0fa3` (Task 1 commit)

**3. [Rule 1 - Lint] The fixture's `use` callback tripped `react-hooks/rules-of-hooks`**
- **Found during:** Task 1 (root eslint)
- **Issue:** Playwright's fixture callback's second parameter is conventionally named `use`; the root flat config runs `react-hooks/rules-of-hooks` on every file and flagged the call as a React Hook.
- **Fix:** Renamed the parameter to `provide` (positional, so behaviour is unchanged) with a comment.
- **Files modified:** `packages/apps/service-worker/e2e/fixtures.ts`
- **Verification:** `pnpm exec eslint` on the file is clean
- **Committed in:** `74b0fa3` (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 lint) — deviation 1 additionally required a second commit outside the strict task boundary.
**Impact on plan:** No scope creep and no new dependencies. Deviations 1 and 2 were both required for the plan's own acceptance criteria to be reachable on this machine (a running browser and a started server). The manifest `3`/runtime `4` values were left exactly as found.

## Issues Encountered

- **Pre-existing service-worker e2e browser incompatibility.** Recorded in `deferred-items.md` #3 without the root cause; this plan identified it (system Chrome 153 vs Playwright 1.61) and made the suite runnable here. A later phase may still want to diagnose why system Chrome disconnects on the SW-served project route.
- **The unstaged child's `pnpm` wrapper prints a spurious trailing `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL Command "playwright" not found` after a non-zero Playwright run.** The test output itself carries the real, named failure, and the verifier matches on that; the wrapper message is not treated as the failure signal.
- **No blockers for this plan.** Its own commands (`scripts/verify/e2e-prerequisite.js`, both vitest files, `tsc -b`, eslint) all exit 0.

## Protected-branch note

All four commits landed directly on `main` (`74b0fa3`, `351c5c3`, `08d3ca2`, `6565059`). That is deliberate and reported rather than worked around: `.planning/config.json` sets `git.branching_strategy: "none"`, plans 01-01/01-02/01-04 committed to `main` the same way, and the execution prompt required atomic per-task commits in the **main working tree** (the verifier drives a real build + preview server and the fixtures resolve paths under the repository). No `git update-ref`, force-push, stash or history rewrite was used.

## User Setup Required

None — no external service configuration required. Playwright's bundled chromium was already installed; no new dependency was added.

## Next Phase Readiness

- VERIFY-06 is satisfied: no e2e test in this plan decides at runtime to skip itself, and the required fixture both passes when a release is staged and fails with a named remediation when it is not.
- VERIFY-07's manifest-side pin now exists alongside the pre-existing `src/runtime/protocol.test.ts` pin; both `3` and `4` are recorded unchanged and must not be reconciled.
- `scripts/verify/e2e-prerequisite.js` is the re-runnable proof for later phases that touch the editor release / SW hosting path.
- **Input for later e2e work:** the SW suite now needs Playwright's bundled chromium (or a Playwright-compatible system Chrome) and a ≥7-minute `webServer` window; `reuseExistingServer` is disabled under `CI=1` by design.

## Self-Check: PASSED

- Created files present: `packages/apps/service-worker/e2e/fixtures.ts`, `scripts/verify/e2e-prerequisite.js` — verified on disk.
- Modified files present and committed: `packages/apps/service-worker/e2e/project-host.spec.ts`, `packages/apps/service-worker/playwright.config.ts`, `packages/apps/editor/editor-artifact-plugin.test.ts`.
- Commits present: `74b0fa3`, `351c5c3`, `08d3ca2`, `6565059` — all in `git log`.
- `packages/apps/editor/src/runtime/protocol.ts` and `protocol.test.ts` untouched (`git diff --exit-code` = 0).
- STATE.md and ROADMAP.md were not modified (orchestrator-owned).

---

*Phase: 01-baseline-verification-net*
*Completed: 2026-09-20*
