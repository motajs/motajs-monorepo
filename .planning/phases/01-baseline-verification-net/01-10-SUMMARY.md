---
phase: 01-baseline-verification-net
plan: 10
subsystem: infra
tags: [pnpm, toolchain, ci, engines, lockfile]

# Dependency graph
requires:
  - phase: 01-baseline-verification-net
    provides: "01-06's root fan-out scripts and lint gate, 01-09's green lint gate"
provides:
  - "One declared pnpm version: CI workflow pins 12.5.1 and root `package.json` declares `engines.pnpm: \">=12.5.1\"`"
  - "A frozen install that passes under pnpm 12.5.1 with the lockfile unchanged"
affects: [01-07, editor-build, all contributors]

actuals:
  tokens: 12000
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Declare the pnpm version via `engines.pnpm` rather than `packageManager` when the lockfile must stay clean — pnpm 12 records the managed pnpm binary into `pnpm-lock.yaml` whenever `packageManager` is set."

key-files:
  created: []
  modified:
    - "package.json — adds `engines.pnpm: \">=12.5.1\"`"
    - ".github/workflows/deploy-editor-h5test.yml — pnpm/action-setup version 11.10.0 → 12.5.1"
    - ".planning/codebase/STACK.md — records pnpm 12.5.1 and the engines-based declaration"
    - "AGENTS.md — regenerated"

key-decisions:
  - "Use `engines.pnpm: \">=12.5.1\"`, not `packageManager: \"pnpm@12.5.1\"`: declaring `packageManager` under pnpm 12 forces the lockfile to record `pnpm@12.5.1` plus 14 `@pnpm/exe.*` platform packages (161 lines, a second YAML document), and `manage-package-manager-versions=false` does not suppress it. `engines.pnpm` declares the same intent with zero lockfile churn."
  - "Do not add `engine-strict`: it would turn the declaration into a hard failure for anyone on an older pnpm, which is a policy decision this phase does not need to make."

patterns-established:
  - "Toolchain-version alignment: change the CI pin and the in-repo declaration together, then re-prove `--frozen-lockfile` under the new major."

requirements-completed: [VERIFY-02]

coverage:
  - id: D1
    description: "One pnpm version is declared in the repo (CI pin + `engines.pnpm`) and the frozen install, build and typecheck pass under pnpm 12.5.1 with an unchanged lockfile"
    requirement: VERIFY-02
    verification:
      - kind: integration
        ref: "`pnpm install --frozen-lockfile` → exit 0; `git diff --exit-code -- pnpm-lock.yaml` → exit 0 (lockfile byte-identical)"
        status: pass
      - kind: integration
        ref: "`pnpm --filter @motajs/editor build` → exit 0, 57 files / raw 16.80 MiB (≤ 20 MiB)"
        status: pass
      - kind: integration
        ref: "`pnpm typecheck` → exit 0 across all workspace packages; `pnpm format:check` → exit 0"
        status: pass
      - kind: automated_ui
        ref: "`git grep -n \"11.10.0\" -- . ':!packages/external' ':!.planning'` → no match"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-09-21
status: complete
---

# Phase 01 Plan 10: Baseline & Verification Net Summary

**The repo now declares one pnpm version — CI pins `12.5.1` and root `package.json` carries `engines.pnpm: ">=12.5.1"` — with the frozen install, editor build and workspace typecheck all green and `pnpm-lock.yaml` byte-identical.**

## Performance

- **Duration:** ~45 min (including the `packageManager` dead end and the re-decision)
- **Completed:** 2026-09-21
- **Tasks:** 2
- **Files modified:** 2 tracked source/config + 2 docs

## Accomplishments
- `.github/workflows/deploy-editor-h5test.yml` now pins `pnpm/action-setup@v4` to `12.5.1` (was `11.10.0`); that one line is the only change to the file.
- Root `package.json` declares `engines.pnpm: ">=12.5.1"`, giving the repository an in-tree toolchain declaration where it previously had none.
- `pnpm install --frozen-lockfile` passes under pnpm 12.5.1 with `pnpm-lock.yaml` byte-identical (`lockfileVersion: '9.0'`).
- Editor production build and workspace typecheck re-proven under the new major; `pnpm format:check` stays green.
- `STACK.md` updated and `AGENTS.md` regenerated; the user-mandated Project Rules block survived regeneration.

## Task Commits

1. **Task 1: Pin pnpm 12.5.1 in the manifest and the deploy workflow** — `2cb478e` (chore)
2. **Task 2: Prove the build and typecheck under pnpm 12.5.1** — no file changes (verification only)
3. **Docs sync** — `439d8ed` (docs)

**Plan metadata:** committed with this SUMMARY.md (docs: complete plan 01-10)

## Files Created/Modified
- `package.json` — adds `engines.pnpm: ">=12.5.1"` (no `packageManager`, no dependency change)
- `.github/workflows/deploy-editor-h5test.yml` — pnpm version pin `11.10.0` → `12.5.1`
- `.planning/codebase/STACK.md` — records pnpm 12.5.1 and why `engines` is used instead of `packageManager`
- `AGENTS.md` — regenerated

## Decisions Made
- **`engines.pnpm` over `packageManager`** (see key-decisions). The deciding factor: `packageManager` under pnpm 12 costs 161 lockfile lines and makes CI fetch the pnpm binary a second time as a dependency, for no benefit over `engines` given CI already installs pnpm via `action-setup`.
- **No `engine-strict`** — a hard failure on older pnpm is a separate policy choice, not needed to satisfy this plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The plan's `packageManager` mechanism was unsatisfiable; switched to `engines.pnpm` by user decision**
- **Found during:** Task 1 (pin the toolchain)
- **Issue:** The plan said to add `"packageManager": "pnpm@12.5.1"` AND keep `pnpm-lock.yaml` byte-identical. Under pnpm 12 those are mutually exclusive: with `packageManager` declared, `pnpm install --frozen-lockfile` fails with `ERR_PNPM_FROZEN_LOCKFILE_WITH_OUTDATED_LOCKFILE` ("Cannot update packageManagerDependencies with frozen-lockfile"), and a non-frozen install writes 161 lines into the lockfile — `pnpm@12.5.1` plus 14 `@pnpm/exe.*` platform packages, as a second YAML document. Adding `manage-package-manager-versions = false` to `.npmrc` did **not** suppress it (retested; same error).
- **Fix:** Escalated the trade-off to the user, who chose `engines.pnpm: ">=12.5.1"`. Reverted `.npmrc` to its original single line; replaced the `packageManager` field with the `engines` block.
- **Files modified:** `package.json`, `.github/workflows/deploy-editor-h5test.yml`
- **Verification:** `pnpm install --frozen-lockfile` exit 0 with `git diff --exit-code -- pnpm-lock.yaml` exit 0.
- **Committed in:** `2cb478e` (Task 1 commit)

**2. [Rule 2 - Missing Critical] Stale `11.10.0` reference in generated docs**
- **Found during:** Task 2 (stale-pin sweep)
- **Issue:** `git grep "11.10.0"` still matched `AGENTS.md` (generated from `.planning/codebase/STACK.md`, which recorded the old pin and the "no `packageManager` field" fact).
- **Fix:** Updated `STACK.md` and regenerated `AGENTS.md`; verified the Project Rules block survived.
- **Files modified:** `.planning/codebase/STACK.md`, `AGENTS.md`
- **Verification:** `git grep -n "11.10.0" -- . ':!packages/external' ':!.planning'` returns no match.
- **Committed in:** `439d8ed` (docs commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** The mechanism changed (`engines` instead of `packageManager`) but the goal — one declared pnpm version, aligned with CI, without touching dependencies — was met with a smaller lockfile footprint than the plan intended.

## Issues Encountered
- The `packageManager` lockfile side-effect (Deviation 1) was the only real obstacle; it was resolved by the user's `engines.pnpm` decision.

## Known Facts Recorded (unchanged by this plan)
- pnpm 12 performs an additional default step pnpm 11 did not: `Verifying lockfile against supply-chain policies` (all 1209 entries passed locally). This is a stricter default, not a weaker one.
- Local Node is **v22.18.0** while CI uses **Node 24**. This plan did not change either; the gap remains recorded in `STACK.md`.
- pnpm 12 uses store version `v11` (`E:\.pnpm-store\v11`), separate from the pnpm 10/11 store.

## User Setup Required
None.

## Next Phase Readiness
- **Plan 01-07 is now unblocked** (`depends_on: [01-10]`): it creates `.github/workflows/ci.yml` mirroring this workflow's toolchain pinning, so it will pin pnpm `12.5.1` consistently.
- No blockers.

---
*Phase: 01-baseline-verification-net*
*Completed: 2026-09-21*
