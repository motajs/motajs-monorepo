---
phase: 01-baseline-verification-net
plan: 07
subsystem: infra
tags: [ci, github-actions, pull-request-gate, required-checks, pnpm, submodules, verify-02]

# Dependency graph
requires:
  - phase: 01-baseline-verification-net (01-10)
    provides: the pinned toolchain — deploy-editor-h5test.yml pins pnpm 12.5.1 and root package.json declares engines.pnpm ">=12.5.1"
  - phase: 01-baseline-verification-net (01-09)
    provides: a green `pnpm lint` (eslint . , no --fix) — the lint job can be a required check
  - phase: 01-baseline-verification-net (01-06)
    provides: the root fan-out scripts lint / typecheck / test / build the four jobs call
provides:
  - ".github/workflows/ci.yml — four-job pull-request gate (lint, typecheck, unit, build) on pull_request + push to main"
  - "scripts/verify/ci-workflow.js — text-based structural verifier for that workflow"
  - "the recorded job-id contract the repository settings must reference: lint, typecheck, unit, build"
affects: [01-07 Task 2 (repository required-check configuration), editor-core extraction phases]

# Actuals (#2632) — pairs with the plan's estimate (45000 tokens).
actuals:
  tokens: 3028
  tasks: 1
  commits: 1
  plan_head_before: 780208439ebe2077c8186c87963abb77666454be

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pull-request CI kept in its own workflow (ci.yml), independent of the manual deploy workflow"
    - "Job ids are the contract repository settings reference; a verifier asserts them so a rename cannot silently un-gate merges"
    - "Structural CI assertions by indentation-sliced text blocks, with no YAML dependency added"

key-files:
  created:
    - .github/workflows/ci.yml
    - scripts/verify/ci-workflow.js
  modified: []

key-decisions:
  - "Toolchain pin is pnpm 12.5.1, not the 11.10.0 written in the plan prose: the acceptance criterion and key requirements say to mirror deploy-editor-h5test.yml exactly, and plan 01-10 moved that file (and engines.pnpm) to 12.5.1."
  - "`submodules: recursive` on unit and build only; lint and typecheck deliberately check out no submodule."
  - "The build job runs an explicit `pnpm --filter @motajs/editor exec panda codegen` before the build, as insurance in case the editor's `prepare` script does not run during CI install."
  - "No secret, no environment, no paths filter, no workflow_dispatch and no pull_request_target — a required check must never be permanently unsatisfiable or fork-reachable."
  - "The verifier reads the workflow as text and slices it by indentation rather than adding a YAML parser dependency (this plan adds no package)."
  - "Task 2 (registering the four job ids as required status checks) is repository configuration requiring admin rights; it is a designed human checkpoint and was NOT attempted."

patterns-established:
  - "Pull-request gate independent of deploy: ci.yml carries no secret and no environment, so the deploy workflow's secrets stay exclusively in its own file"
  - "Contract verifier for CI job ids: the workflow's structure is asserted by a runnable script whose failure message names the violated rule"

requirements-completed: [VERIFY-02]   # Resolved 2026-09-21: Task 1 delivered the workflow + verifier (machine-verified), Task 2's repository setting was completed by the user.

coverage:
  - id: D1
    description: "A pull-request-triggered workflow exists with exactly the four jobs lint, typecheck, unit and build, each invoking its corresponding root fan-out script, each read-only, with submodules only on unit/build and an explicit panda codegen before the build"
    requirement: "VERIFY-02"
    verification:
      - kind: integration
        ref: "`node scripts/verify/ci-workflow.js` -> exit 0 (all structural assertions pass)"
        status: pass
      - kind: integration
        ref: "negative mutation: removing `submodules: recursive` from the unit job -> exit 1 with `job unit 缺少 submodules: recursive —— 它运行时需要真实 mota-js 文件`; restoring -> exit 0"
        status: pass
      - kind: unit
        ref: "`pnpm exec eslint scripts/verify/ci-workflow.js` -> exit 0; `pnpm format:check` -> exit 0 ('All matched files use Prettier code style!')"
        status: pass
    human_judgment: false
  - id: D2
    description: "The four job ids (lint, typecheck, unit, build) are configured as required status checks on the main-branch protection, so a red check blocks a merge"
    requirement: "VERIFY-02"
    verification: []
    human_judgment: true
    rationale: "Repository branch-protection/ruleset configuration lives outside git and requires admin permission; no workflow file or agent can assert it. Task 2 is a gate=\"blocking-human\" checkpoint and is still pending — the plan is halted here by design."
  - id: D3
    description: "The existing deploy workflow and its secrets are untouched, and the new workflow adds no third-party action beyond the ones the repo already uses"
    requirement: "VERIFY-02"
    verification:
      - kind: integration
        ref: "`git diff --exit-code -- .github/workflows/deploy-editor-h5test.yml` -> exit 0; action/pin parity confirmed (checkout@v4, pnpm/action-setup@v4 + 12.5.1, setup-node@v4 + node 24 + cache pnpm, pnpm install --frozen-lockfile)"
        status: pass
      - kind: integration
        ref: "`git diff --exit-code -- pnpm-lock.yaml` -> exit 0 (no dependency added or changed)"
        status: pass
    human_judgment: false

duration: 27min
completed: 2026-09-21
status: complete
# Resolution (2026-09-21): the human checkpoint (Task 2) was completed by the user — the four
# job ids (lint, typecheck, unit, build) are registered as required status checks on `main`.
# Evidence limitation: `gh` is not installed in this environment, so the GitHub repository
# setting cannot be machine-verified from here; the structural half IS machine-verified by
# `scripts/verify/ci-workflow.js` (exit 0) and the registration is confirmed by the user.
---

# Phase 01 Plan 07: Baseline & Verification Net Summary

**A four-job pull-request CI gate (lint, typecheck, unit, build) mirroring the deploy workflow's pinned toolchain — structurally verified and committed — with the merge-blocking half deliberately left to the repository-settings human checkpoint.**

## ⏸ Halted at the required-status-checks checkpoint (Task 2)

Task 1 is complete and committed. Task 2 is a `checkpoint:human-action` with `gate="blocking-human"`:
registering the four job ids as required status checks is a GitHub repository setting that needs admin
permission and cannot be performed from a file. Per the plan, it was **not** attempted — no API call,
no settings change. `status: halted` reflects that designed stop, not a failure.

**What the human must do (Task 2):**

1. Merge (or otherwise get) this workflow onto the default branch first, so the check names are offered
   in the picker. **The names are the job ids — `lint`, `typecheck`, `unit`, `build` — not the workflow name `CI`.**
2. In the repository settings, add a branch ruleset (or branch protection rule) targeting `main` that
   requires exactly those four status checks. Pin each check to this repository's own GitHub Actions if
   the platform offers a source-app selector.
3. Add **no** path filter and **no** bypass that lets a red check merge.
4. Verify on a real throwaway PR: introduce one deliberate failure (a lint error or a failing unit test),
   confirm the merge button is blocked while that check is red, then revert the failure and confirm the
   merge control becomes available.
5. Confirm the check list shows all four jobs from this workflow, and that the deploy workflow's
   environment and secrets are unchanged.

Resume signal: `required checks configured`.

## Performance

- **Duration:** ~27 min
- **Started:** 2026-09-21T08:10:00Z
- **Completed:** 2026-09-21T08:37:00Z
- **Tasks:** 1 of 2 completed (Task 2 halted by design)
- **Files modified:** 2 created, 0 modified

## Accomplishments

- `.github/workflows/ci.yml` exists: triggers on `pull_request` and `push: branches: [main]` only, with a
  top-level `concurrency` group keyed on `github.workflow`-`github.ref` and `cancel-in-progress: true`.
- Exactly four jobs `lint`, `typecheck`, `unit`, `build`, each `runs-on: ubuntu-latest` with
  `permissions: contents: read`, each running its matching root fan-out script (`pnpm lint`, `pnpm typecheck`,
  `pnpm test`, `pnpm build`).
- The toolchain is byte-for-byte the deploy workflow's: `actions/checkout@v4`, `pnpm/action-setup@v4` with
  `version: 12.5.1`, `actions/setup-node@v4` with `node-version: 24` and `cache: pnpm`, then
  `pnpm install --frozen-lockfile`. No new third-party action.
- `submodules: recursive` appears on exactly `unit` and `build`; `lint` and `typecheck` check out no
  submodule. `build` runs `pnpm --filter @motajs/editor exec panda codegen` before the build.
- `scripts/verify/ci-workflow.js` asserts all of the above plus the absence of `secrets`, `environment`,
  `paths:`/`paths-ignore:`, `workflow_dispatch` and `pull_request_target`, exiting non-zero with a message
  that names the specific violated rule.

## Verification Evidence

| Check | Command | Result |
|-------|---------|--------|
| Workflow structure | `node scripts/verify/ci-workflow.js` | **pass** — exit 0 |
| Verifier can fail | remove `submodules: recursive` from `unit`, rerun | **pass** — exit 1, `job unit 缺少 submodules: recursive —— 它运行时需要真实 mota-js 文件`; restored → exit 0 |
| Formatting authority | `pnpm format`; `pnpm format:check` | **pass** — exit 0, "All matched files use Prettier code style!" |
| Lint of the new script | `pnpm exec eslint scripts/verify/ci-workflow.js` | **pass** — exit 0 |
| Deploy workflow untouched | `git diff --exit-code -- .github/workflows/deploy-editor-h5test.yml` | **pass** — exit 0 |
| Lockfile untouched | `git diff --exit-code -- pnpm-lock.yaml` | **pass** — exit 0 |
| Toolchain parity | action/pin lines of `ci.yml` vs `deploy-editor-h5test.yml` | **pass** — identical set for all four jobs |

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the four-job pull-request CI workflow** - `50b8e0d` (feat)
2. **Task 2: Register the four CI jobs as required status checks on main** - NOT COMMITTED (human checkpoint, no file change)

**Plan metadata:** this SUMMARY commit (docs: complete plan)

## Files Created/Modified

- `.github/workflows/ci.yml` — the new PR gate: two triggers (`pull_request`, `push` to `main`), a
  `concurrency` block with `cancel-in-progress: true`, and the four jobs with their toolchain preamble,
  permissions, submodule placement and script mappings.
- `scripts/verify/ci-workflow.js` — ESM Node script (no dependencies, no network) that reads the workflow
  as text and asserts triggers, job set and root-script mapping, submodule placement, read-only
  permissions, toolchain pins, build-time panda codegen ordering, concurrency shape, and the absence of
  every forbidden construct.

## Decisions Made

- **pnpm 12.5.1, not the plan prose's 11.10.0.** The plan's `<action>` paragraph still says "version
  11.10.0" (written before plan 01-10), but the same plan's acceptance criterion and this execution's key
  requirements both say to mirror `deploy-editor-h5test.yml` **exactly**, and 01-10 moved that file to
  `12.5.1` with `engines.pnpm: ">=12.5.1"`. Mirroring the file is the authoritative instruction, so
  `12.5.1` was used and verified against the deploy workflow's pin.
- **Submodule placement follows D-13/D-15's research revision:** `unit` gets the submodule because seven
  editor unit modules read real mota-js files at runtime; `build` gets it because the editor's `publicDir`
  points at the mota-js root; `lint`/`typecheck` need neither.
- **Explicit panda codegen in `build`** as cheap insurance against the editor `prepare` script not running
  during a CI install — the job depends on `styled-system/` existing before `tsc -b` and `vite build`.
- **No YAML parser dependency:** the verifier slices the file by indentation, mirroring the repo's existing
  `scripts/verify/*.js` style (plain Node, Chinese file header, `failures[]` + `process.exit(1)`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan prose pin (11.10.0) contradicted its own acceptance criterion (mirror the deploy file)**

- **Found during:** Task 1 (writing `ci.yml`)
- **Issue:** The `<action>` paragraph says `pnpm/action-setup@v4` with `version: 11.10.0`, but
  `deploy-editor-h5test.yml` now pins `12.5.1` (plan 01-10) and the acceptance criterion requires the
  same toolchain pins as that file. Taking the prose literally would have shipped a second, divergent
  pnpm major into CI.
- **Fix:** Used `version: 12.5.1`, matching `deploy-editor-h5test.yml:23` and root
  `engines.pnpm: ">=12.5.1"`.
- **Files modified:** `.github/workflows/ci.yml`
- **Verification:** pin-parity sweep over both workflows shows the identical toolchain lines; the plan's
  own `grep "11.10.0"` spirit is satisfied (no stale pin anywhere).
- **Committed in:** `50b8e0d` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — plan prose vs. authoritative acceptance criterion)
**Impact on plan:** No scope creep; the resolution follows the plan's own written acceptance criterion and
keeps CI aligned with the single declared pnpm version.

## Issues Encountered

- **`ci.yml` is outside Prettier's scope by repository policy.** `.prettierignore` deliberately excludes
  `*.yml`/`*.yaml` (they are hand-maintained configuration). So `pnpm format` / `pnpm format:check` cover
  the new `scripts/verify/ci-workflow.js` (which it reformatted once, cleanly) but never inspect
  `ci.yml`. The workflow is written in the same 2-space style as the deploy workflow; the Prettier-clean
  requirement was met for the file Prettier actually governs.
- **The commit protocol's protected-branch guard.** `HEAD` is on `main` and
  `gsd-tools query git.base-branch --is-protected main` returns `true`. This plan ran in the main working
  tree by explicit orchestrator instruction (`isolation`: no worktree) with
  `git.branching_strategy: "none"`, exactly as plans 01-01…01-10 did — every prior commit in this phase is
  on `main`. The commit was made on `main` accordingly; no branch was created and no protected ref was
  rewritten. Recorded here so the guard trip is visible rather than silent.

## User Setup Required

**Task 2 requires manual repository configuration** (admin permission, outside git). See the
"⏸ Halted at the required-status-checks checkpoint" section above for the exact steps and the
throwaway-PR verification procedure.

## Known Stubs

None — no stub, placeholder, hardcoded-empty value, skipped test or unrun `<verify>` was introduced by
this plan.

## Threat Flags

None — no new security-relevant surface was introduced beyond the plan's `<threat_model>`. The workflow
carries no secret and no environment binding, every job is `contents: read`, and no `allowBuilds` entry
was widened.

## Next Phase Readiness

- **Blocked until Task 2 is performed:** the four job names are not yet required status checks, so a red
  check does not block merging into `main` yet. The workflow content is complete and verified; only the
  out-of-git repository setting remains.
- **How to resume:** perform the Task 2 steps, then re-summarize this plan as `status: complete` with
  `requirements-completed: [VERIFY-02]`.
- The deploy workflow and its `h5test` secrets are untouched and remain independent of this gate.

---

*Phase: 01-baseline-verification-net*
*Completed: 2026-09-21 (halted at Task 2)*

## Self-Check: PASSED
- `.github/workflows/ci.yml` — FOUND
- `scripts/verify/ci-workflow.js` — FOUND
- Commit `50b8e0d` — FOUND
- `.github/workflows/deploy-editor-h5test.yml` — unchanged (git diff exit 0)
