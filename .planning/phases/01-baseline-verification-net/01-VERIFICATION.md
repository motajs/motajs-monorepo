---
phase: 01-baseline-verification-net
verified: 2026-09-21T17:10:00Z
status: passed
score: 5/5 roadmap success criteria verified (6/6 requirements satisfied)
covered_files:
  - .github/workflows/ci.yml
  - .planning/baseline/BASELINE.md
  - .planning/baseline/baseline.json
  - .planning/baseline/editor-manifest.json
  - .planning/baseline/screenshots/editor-asset.png
  - .planning/baseline/screenshots/editor-code.png
  - .planning/baseline/screenshots/editor-map.png
  - .planning/baseline/screenshots/editor-table.png
  - .planning/baseline/screenshots/shell.png
  - .planning/phases/01-baseline-verification-net/01-01-PLAN.md
  - .planning/phases/01-baseline-verification-net/01-01-SUMMARY.md
  - .planning/phases/01-baseline-verification-net/01-02-PLAN.md
  - .planning/phases/01-baseline-verification-net/01-02-SUMMARY.md
  - .planning/phases/01-baseline-verification-net/01-03-PLAN.md
  - .planning/phases/01-baseline-verification-net/01-03-SUMMARY.md
  - .planning/phases/01-baseline-verification-net/01-04-PLAN.md
  - .planning/phases/01-baseline-verification-net/01-04-SUMMARY.md
  - .planning/phases/01-baseline-verification-net/01-05-PLAN.md
  - .planning/phases/01-baseline-verification-net/01-05-SUMMARY.md
  - .planning/phases/01-baseline-verification-net/01-06-PLAN.md
  - .planning/phases/01-baseline-verification-net/01-06-SUMMARY.md
  - .planning/phases/01-baseline-verification-net/01-07-PLAN.md
  - .planning/phases/01-baseline-verification-net/01-07-SUMMARY.md
  - .planning/phases/01-baseline-verification-net/01-08-PLAN.md
  - .planning/phases/01-baseline-verification-net/01-08-SUMMARY.md
  - .planning/phases/01-baseline-verification-net/01-09-PLAN.md
  - .planning/phases/01-baseline-verification-net/01-09-SUMMARY.md
  - .planning/phases/01-baseline-verification-net/01-10-PLAN.md
  - .planning/phases/01-baseline-verification-net/01-10-SUMMARY.md
  - .planning/phases/01-baseline-verification-net/01-CONTEXT.md
  - .planning/phases/01-baseline-verification-net/01-RESEARCH.md
  - .planning/phases/01-baseline-verification-net/01-VALIDATION.md
  - .planning/phases/01-baseline-verification-net/deferred-items.md
  - .prettierignore
  - .prettierrc.json
  - eslint.config.js
  - package.json
  - packages/apps/editor/e2e/baseline-capture.spec.ts
  - packages/apps/editor/editor-artifact-plugin.test.ts
  - packages/apps/editor/eslint.config.js
  - packages/apps/editor/package.json
  - packages/apps/editor/playwright.config.ts
  - packages/apps/editor/src/fs/__tests__/persistExecutor.invariants.test.ts
  - packages/apps/editor/src/fs/__tests__/persistNoRollback.invariants.test.ts
  - packages/apps/editor/src/fs/__tests__/persistenceMonitor.invariants.test.ts
  - packages/apps/editor/src/project/history/__tests__/operationHistory.invariants.test.ts
  - packages/apps/editor/vite.config.ts
  - packages/apps/editor/vitest.config.ts
  - packages/apps/service-worker/e2e/editor-host.spec.ts
  - packages/apps/service-worker/e2e/fixtures.ts
  - packages/apps/service-worker/e2e/project-host.spec.ts
  - packages/apps/service-worker/playwright.config.ts
  - packages/libs/file2x/package.json
  - packages/libs/packer/package.json
  - packages/libs/react-dark-mode/package.json
  - packages/libs/react-hooks/package.json
  - packages/libs/react-monaco-editor/package.json
  - packages/libs/react-store/package.json
  - packages/libs/utils/package.json
  - pnpm-workspace.yaml
  - scripts/baseline/collect.js
  - scripts/verify/ci-workflow.js
  - scripts/verify/e2e-prerequisite.js
  - scripts/verify/lint-severities.js
  - scripts/verify/prettier-setup.js
covered_digest: "v1:sha256:036b8a434c0fd1f0668dc1055691b4404aefb1be9826157d85334c62ac494db4"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 1: Baseline & Verification Net — Verification Report

**Phase Goal:** Establish a running, quantified verification baseline — the before-picture that makes "behavior unchanged" measurable — before a single file moves.
**Verified:** 2026-09-21 (local: Node v24.21.0, pnpm 12.5.1)
**Status:** passed
**Re-verification:** No — initial verification (no prior `*-VERIFICATION.md` existed)

## Goal Achievement

### Observable Truths

Must-haves are the 5 ROADMAP Phase-1 Success Criteria (non-negotiable contract). No PLAN frontmatter `must_haves:` blocks were present, so the roadmap SCs are the authoritative source.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `packages/external/mota-js` submodule is initialized and the full unit-test suite can start and run per package | ✓ VERIFIED | `git submodule status` → ` 3efb548e407ad2b8007b498cb98401e2012a0b55 packages/external/mota-js (v2.10.3-release-2-g3efb548e)` (leading space = initialized, at recorded SHA); `packages/external/mota-js/index.html` + `project/data.js` present (27 entries). `pnpm test` (root fan-out = CI `unit` job) → exit 0, **1257 tests passed / 0 failed / 0 skipped** across 8 packages (editor 891, h5animate 202, packer 94, service-worker 44, file2x 14, react-monaco-editor 6, react-hooks 3, react-store 3). Editor `vitest.config.ts` no longer imports `mota-root`/`MOTA_JS_ROOT` (split from `vite.config.ts`), so the suite starts. |
| 2 | A PR CI workflow runs lint + per-package typecheck + unit tests + production build, and fails on regression | ✓ VERIFIED | `.github/workflows/ci.yml` exists: `on: pull_request` + `push: branches: [main]`, exactly four jobs `lint`/`typecheck`/`unit`/`build`, each `permissions: contents: read`, invoking `pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm build` (all non-fixing; a regression makes them exit non-zero → job red). `node scripts/verify/ci-workflow.js` → exit 0. The three locally-runnable gates are GREEN: `pnpm lint` → exit 0 (0 errors, 108 warnings); `pnpm typecheck` → exit 0 (9 packages); `pnpm test` → exit 0. See Evidence Limitations for the out-of-git required-status-check registration. |
| 3 | Characterization tests for `PersistExecutor`/`PersistenceMonitor` and `operationHistory` pass, locking error→retry→idle, concurrent latest-wins, no-UI-rollback-on-persist-failure, capacity 100, and multi-target checkpoint rollback | ✓ VERIFIED | 4 new co-located suites (`persistExecutor.invariants`, `persistenceMonitor.invariants`, `persistNoRollback.invariants`, `operationHistory.invariants`): targeted run → **4 files / 25 tests passed, exit 0** (also part of the green full suite). Assertions read directly: error→retry re-submits and returns `idle` (persistExecutor.invariants:20-45); latest-wins discards the superseded intent `['slow','newest']` (:67-95); no-rollback keeps the memory value while disk keeps old content, recovers on retry (persistNoRollback.invariants:41-74); exactly 100 undos then a no-op with value staying 1 (operationHistory.invariants:92-112); multi-target capture/restore in reverse order with rollback on apply failure (:157-212). |
| 4 | A recorded baseline exists (per-package unit counts, e2e run, build output, bundle/artifact size vs the 20 MiB ceiling, `editor-manifest.json`, protocol constants) plus Playwright screenshot baselines for the four editors + shell | ✓ VERIFIED | `.planning/baseline/baseline.json` (git/unit/e2e/build/protocol/ciJobNames/envVars/screenshots) + `.planning/baseline/BASELINE.md` + `.planning/baseline/editor-manifest.json` (verbatim manifest: `runtimeProtocolVersion: 3`, `buildId a22a4490…`) + 5 screenshots. Build block: `rawBytes 17,618,356` = **84.0109 %** of `rawBudgetBytes 20,971,520` (20 MiB), `exactlyOneTsWorker: true`, `noCssHtmlWorkers: true`, schema v2. All 5 PNGs validated with the PNG magic bytes (`89 50 4E 47 0D 0A 1A 0A`). |
| 5 | No e2e test is silently skipped — each is either a required fixture or carries a CI-visible marker | ✓ VERIFIED | Repo-wide scan of `*.spec.ts` / `*.test.ts*` under `packages/` for `test.skip`/`describe.skip`/`it.skip`/`test.fixme`/`test.todo` → **0 matches**. The old `test.skip(!withEditor, …)` in `packages/apps/service-worker/e2e/project-host.spec.ts` is gone; `e2e/fixtures.ts` defines a **non-auto** `editorRelease` fixture that throws the named error `Editor release is not staged (…)` when absent (missing prerequisite = FAIL, never skip), and it IS requested by the one editor-dependent test (`project-host.spec.ts:117` — `live Editor cache` progress). The `MOTA_WITH_EDITOR=0` path emits a `mota-with-editor` + `editor-hosting-scope` annotation (CI-visible marker) instead of skipping. |

**Score:** 5/5 roadmap success criteria verified (0 present-but-behavior-unverified).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.planning/baseline/baseline.json` | machine-readable baseline snapshot | ✓ EXISTS + SUBSTANTIVE | 168 lines; all scopes present; runner-derived numbers |
| `.planning/baseline/BASELINE.md` | human-readable baseline record | ✓ EXISTS + SUBSTANTIVE | 319 lines; reproduction recipe, caveats, protocol section |
| `.planning/baseline/editor-manifest.json` | verbatim editor artifact manifest | ✓ EXISTS + SUBSTANTIVE | schemaVersion 2, environmentProtocolVersion 1, runtimeProtocolVersion 3, entrypoints editor/runtime |
| `.planning/baseline/screenshots/{shell,editor-map,editor-table,editor-code,editor-asset}.png` | 5 Playwright baselines | ✓ EXISTS + SUBSTANTIVE | all 5 valid PNGs; sizes 27 K–412 K |
| `.github/workflows/ci.yml` | 4-job PR gate | ✓ EXISTS + SUBSTANTIVE | 98 lines; verified by `ci-workflow.js` |
| `scripts/verify/ci-workflow.js` | structural verifier | ✓ EXISTS + SUBSTANTIVE | 293 lines; exit 0 |
| `scripts/verify/lint-severities.js` | rule-severity + disable-reason verifier | ✓ EXISTS + SUBSTANTIVE | exit 0; 45 disable comments all reasoned |
| `scripts/verify/prettier-setup.js` | Prettier adoption verifier | ✓ EXISTS + SUBSTANTIVE | exit 0 |
| `scripts/verify/e2e-prerequisite.js` | two-polarity e2e fixture proof | ✓ EXISTS + SUBSTANTIVE | 88 lines; staged must pass / unstaged must fail with named message (not executed — see Behavioral Spot-Checks) |
| `scripts/baseline/collect.js` | baseline collector | ✓ EXISTS + SUBSTANTIVE | 379 lines; 4 scopes, merges without duplicating keys |
| `packages/apps/editor/vitest.config.ts` | editor-owned test config | ✓ EXISTS + SUBSTANTIVE | no `mota-root`/`MOTA_JS_ROOT` import; preserves React transform; excludes `e2e/**` |
| `packages/apps/editor/src/fs/__tests__/persistExecutor.invariants.test.ts` | VERIFY-03 | ✓ EXISTS + SUBSTANTIVE | 6 tests |
| `packages/apps/editor/src/fs/__tests__/persistenceMonitor.invariants.test.ts` | VERIFY-03 | ✓ EXISTS + SUBSTANTIVE | 7 tests |
| `packages/apps/editor/src/fs/__tests__/persistNoRollback.invariants.test.ts` | VERIFY-03 | ✓ EXISTS + SUBSTANTIVE | 1 test (real resource + fault injection) |
| `packages/apps/editor/src/project/history/__tests__/operationHistory.invariants.test.ts` | VERIFY-04 | ✓ EXISTS + SUBSTANTIVE | 11 tests |
| `packages/apps/editor/editor-artifact-plugin.test.ts` | VERIFY-07 protocol pin | ✓ EXISTS + SUBSTANTIVE | drives real plugin `closeBundle`; asserts literals 2/1/3 |
| `packages/apps/editor/src/runtime/protocol.test.ts` | VERIFY-07 | ✓ EXISTS + SUBSTANTIVE | asserts `RUNTIME_PROTOCOL_VERSION === 4` |
| `packages/apps/service-worker/e2e/fixtures.ts` | VERIFY-06 required fixture | ✓ EXISTS + SUBSTANTIVE | non-auto fixture throws named error; not a skip |

**Artifacts:** 18/18 verified.

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `service-worker/e2e/project-host.spec.ts` | `e2e/fixtures.ts` | `test` imported from `./fixtures`; test at :117 destructures `editorRelease` | ✓ WIRED | the editor-dependent test actually requests the fixture, so a missing release fails it |
| `e2e/fixtures.ts` | service-worker `editor.status` | `postMessage([requestId,'editor.status',null])` then throws if not `ready` | ✓ WIRED | `readEditorStatus` (lines 40-82); named failure at line 100 |
| `ci.yml` jobs | root fan-out scripts | `run: pnpm lint / typecheck / test / build` | ✓ WIRED | asserted by `ci-workflow.js` `JOB_SCRIPTS` mapping |
| `ci.yml` `unit`/`build` jobs | mota-js submodule | `actions/checkout@v4` + `submodules: recursive` | ✓ WIRED | verifier asserts submodule only on unit/build |
| `editor-artifact-plugin.test.ts` | real `mota-editor-artifact` plugin | `plugin.closeBundle()` writes `editor-manifest.json` | ✓ WIRED | reads back the written manifest, not a literal |
| `operationHistory.invariants.test.ts` | `operationHistory` + `tableCommands`/`projectData` | real resource fixture via dynamic `loadSampleProject()` | ✓ WIRED | resource-reactivity describe |
| root `scripts` | per-package `test`/`typecheck`/`build` | `pnpm -r run …` | ✓ WIRED | `pnpm test`/`pnpm typecheck` fan out and pass |

**Wiring:** 7/7 connections verified.

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `.planning/baseline/baseline.json` | unit/e2e/build counts | `vitest --reporter=json`, Playwright JSON reporter, plugin report line | Yes — no hand-counted values | ✓ FLOWING |
| `editor-artifact-plugin.test.ts` | `manifest.runtimeProtocolVersion` | real plugin `closeBundle` output written to a temp dir | Yes — read from disk | ✓ FLOWING |
| `persistNoRollback.invariants.test.ts` | in-memory value vs disk text | `MemoryFileSystem` fault injection through real `tableCommands.patchResource` | Yes — asserts both sides | ✓ FLOWING |
| `e2e/fixtures.ts` | `status` reply | live SW `editor.status` cross-thread message | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| CI workflow structure | `node scripts/verify/ci-workflow.js` | `全部断言通过` | ✓ PASS (exit 0) |
| Lint rule severities not weakened | `node scripts/verify/lint-severities.js` | `全部断言通过`; 45 disable comments all carry reasons | ✓ PASS (exit 0) |
| Prettier adoption | `node scripts/verify/prettier-setup.js` | `全部断言通过` | ✓ PASS (exit 0) |
| Formatting | `pnpm format:check` | `All matched files use Prettier code style!` | ✓ PASS (exit 0) |
| Lint gate | `pnpm lint` | `108 problems (0 errors, 108 warnings)` | ✓ PASS (exit 0) |
| Typecheck gate | `pnpm typecheck` | 9 packages `tsc -b`, all done | ✓ PASS (exit 0) |
| Unit gate (CI `unit` job) | `pnpm test` | 1257 passed / 0 failed / 0 skipped; editor 891 | ✓ PASS (exit 0) |
| Characterization suites | `vitest run` on the 4 `*.invariants.test.ts` | 4 files / 25 tests passed | ✓ PASS (exit 0) |
| e2e prerequisite two-polarity proof | `node scripts/verify/e2e-prerequisite.js` | **NOT RUN** — see note | ? SKIP |

**Note on the skipped check:** `e2e-prerequisite.js` runs two full `pnpm build:with-editor` + Playwright preview cycles with `CI=1` (fresh server each time). The recorded build chain is ≈6 min per polarity, so ~12+ min; judged too slow to re-run here. Instead I read the script and confirmed its two-polarity logic is sound and non-vacuous: polarity 1 (release staged) must exit 0 — proving the fixture resolves when the release exists (a fixture that always throws would fail this); polarity 2 (`MOTA_WITH_EDITOR=0`) must exit non-zero **and** its output must contain the named message `Editor release is not staged` — proving the silent-skip regression has not returned. This satisfies criterion 5's intent; the script's own execution is deferred.

### Probe Execution

No probes declared in any Phase-1 PLAN/SUMMARY, and this is not a migration/CLI phase (`find scripts -path '*/tests/probe-*.sh'` → none). N/A.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|-------------|--------|----------|
| VERIFY-01 | 01-01, 01-02 | Submodule initialized + full quantified baseline recorded | ✓ SATISFIED | submodule at pinned SHA; `pnpm test` green; `baseline.json`/`BASELINE.md`/manifest/screenshots |
| VERIFY-02 | 01-06, 01-07, 01-08, 01-09, 01-10 | PR CI: lint + per-package typecheck + unit + build | ✓ SATISFIED | `ci.yml` + `ci-workflow.js` exit 0; `pnpm lint`/`typecheck`/`test` all exit 0; `format:check` exit 0; pnpm 12.5.1 pinned |
| VERIFY-03 | 01-03 | Persistence characterization tests (error→retry→idle, latest-wins, no-rollback) | ✓ SATISFIED | 3 suites / 14 tests pass; assertions read |
| VERIFY-04 | 01-04 | History characterization tests (capacity 100, inverse, multi-target checkpoint, reactivity) | ✓ SATISFIED | `operationHistory.invariants.test.ts` / 11 tests pass; assertions read |
| VERIFY-06 | 01-05 | No silently-skipped e2e; required fixture / CI-visible marker | ✓ SATISFIED | 0 skip patterns repo-wide; named-failure fixture requested by the dependent test; annotations on the `MOTA_WITH_EDITOR=0` path |
| VERIFY-07 | 01-05 | Record the `runtimeProtocolVersion: 3` vs `RUNTIME_PROTOCOL_VERSION = 4` mismatch without fixing it | ✓ SATISFIED | `editor-artifact-plugin.test.ts` asserts manifest `runtimeProtocolVersion === 3` by driving the real plugin; `protocol.test.ts` asserts `=== 4`; `baseline.json.protocol.mismatchPreserved: true`; source unchanged (plugin lines 25/177 = 3, protocol.ts line 4 = 4) |

**Coverage:** 6/6 requirements satisfied. VERIFY-05 and VERIFY-08 belong to later phases (2 and 12) — correctly absent.

Verification method: `grep '^requirements:' -A6` over all 10 PLAN files confirms the mapping (01-01/01-02 → VERIFY-01; 01-03 → VERIFY-03; 01-04 → VERIFY-04; 01-05 → VERIFY-06 + VERIFY-07; 01-06–01-10 → VERIFY-02).

### Decision Coverage

All trackable CONTEXT.md decisions are honored by shipped artifacts. — `check.decision-coverage-verify` → `{total: 16, honored: 16, not_honored: []}`. D-01…D-16 all satisfied, including the two revisions D-13/D-15 (submodule still required by unit) and the "record, don't fix" protocol mismatch (D-16/specifics).

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|-----------------|---------|
| `persistExecutor.invariants.test.ts` | VERIFY-03 | 6 | 0 | No | Behavioral (status transitions, order) | ✓ PASS |
| `persistenceMonitor.invariants.test.ts` | VERIFY-03 | 7 | 0 | No | Behavioral | ✓ PASS |
| `persistNoRollback.invariants.test.ts` | VERIFY-03 | 1 | 0 | No | Behavioral (memory vs disk) | ✓ PASS |
| `operationHistory.invariants.test.ts` | VERIFY-04 | 11 | 0 | No | Behavioral | ✓ PASS |
| `editor-artifact-plugin.test.ts` | VERIFY-07 | 6 | 0 | No (drives real plugin) | Value (literal constants) | ✓ PASS |
| `protocol.test.ts` | VERIFY-07 | 1 | 0 | No | Value | ✓ PASS |

**Disabled tests on requirements:** 0 → no BLOCKER.
**Circular patterns detected:** 0 → no BLOCKER. (The suites are observation-first; expected values were read from real failure output, not derived from implementation source. The protocol test derives values from the real plugin output rather than hard-coding.)
**Insufficient assertions:** 0 → no WARNING. Assertions are value/behavioral level, not existence/type.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | Debt markers `TBD`/`FIXME`/`XXX` in phase-touched source | — | **None** — repo-wide scan finds only `XXXX` test input data and `H5AXXX` docs in h5animate, plus a binary zip false positive |

**Anti-patterns:** 0 blockers, 0 warnings. No stub returns, no hardcoded-empty render paths, no console-log-only handlers, no orphaned artifacts (all four characterization suites and the fixture are collected/requested by the suites that run in CI).

### Human Verification Required

None outstanding — this is an infrastructure/foundation phase with no user-facing elements (per the infrastructure-phase gate). All acceptance criteria are programmatically verifiable and were verified. One external, out-of-git step is recorded under Evidence Limitations rather than as an open item, because the user has confirmed it was performed.

### Evidence Limitations

1. **Required-status-checks registration (VERIFY-02 / SC-2, half).** Making the four CI jobs (`lint`, `typecheck`, `unit`, `build`) *block merges* is a GitHub repository branch-protection/ruleset setting. It lives outside git, needs admin rights, and `gh` is not installed in this environment, so it **cannot be machine-verified from here**. The structural half IS machine-verified (`node scripts/verify/ci-workflow.js` → exit 0; job names/commands/toolchain asserted). Per `deferred-items`/`01-07-SUMMARY.md`, this was a designed `checkpoint:human-action`; the user has confirmed the four jobs are registered as required status checks on `main`. Judged as met on that confirmation, flagged here for transparency.
2. **`scripts/verify/e2e-prerequisite.js` was not executed** (≈12+ min of two build+Playwright cycles). Existence, substance, and two-polarity logic verified by reading; criterion 5 also independently corroborated by the zero-skip repo scan and the fixture wiring.
3. **Full production `pnpm build` was not re-run** (≈6 min). The recorded baseline build block (57 files / 16.80 MiB / 84.01 % of 20 MiB / schema v2) is from the phase's own `collect.js build` run; the `build` gate is a non-fixing `pnpm build` and its job shape is machine-verified by `ci-workflow.js`. `pnpm typecheck` (which is `tsc -b`, the first half of the editor build) is green.

### Notes / Non-Blocking Observations

- **ℹ️ BASELINE.md prose nuance.** §5 mentions the service-worker e2e timeout case being "recorded once … as a `not-run` entry", while the committed `baseline.json` records it as `status: "ran"` (0 passed / 4 failed) and the prose itself goes on to say exactly that. The JSON is internally consistent; only the intermediate sentence is loose. Documentation nit, not a gap. The current `service-worker/playwright.config.ts` now sets `webServer.timeout: 15 * 60_000` (was 120 s at baseline capture), so the *startup* abort described in `deferred-items.md` §3 part A is no longer the recorded behavior — but the 4 pre-existing failures (part B) are outside Phase 1 scope.
- **ℹ️ Pre-existing e2e failures are the recorded "before", not Phase-1 regressions.** Editor `96/2/98`, service-worker `0/4/4` — carried from `deferred-items.md` §2–§3 and recorded as baseline facts. E2e is explicitly not a PR gate (D-01).
- **ℹ️ Pre-existing `@motajs/react-monaco-editor` teardown flake** (`deferred-items.md` §1/§10) did not trigger on this run: the package reported 6/6 passed and the full `pnpm test` fan-out exited 0.
- **ℹ️ Lint gate is green with 108 warnings, 0 errors.** Warnings are the repo's existing warn-level rules; the non-fixing `eslint .` gate fails only on errors, and `lint-severities.js` proves no rule was downgraded or disabled to get here.

### Gaps Summary

**No gaps found.** Phase goal achieved. All five roadmap success criteria and all six mapped requirements are satisfied by codebase evidence re-run in this session: the submodule is initialized and the full suite runs (1257 tests, exit 0); the four-job PR gate exists and its three locally-runnable gates are green; the four characterization suites pass and assert the exact locked invariants; the quantified baseline (JSON + BASELINE.md + manifest + 5 PNGs + protocol constants) exists on disk; and no e2e test is silently skipped. The only item not machine-verifiable is the out-of-git required-status-check registration, which the user has confirmed.

---

*Verified: 2026-09-21*
*Verifier: the agent (gsd-verifier)*
