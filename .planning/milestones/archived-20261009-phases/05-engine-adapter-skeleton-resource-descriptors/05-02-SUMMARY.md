---
phase: 05-engine-adapter-skeleton-resource-descriptors
plan: 02
subsystem: testing
tags: [editor-core, engine-neutrality, port-06, verifier, two-polarity, ci, lint-job]

# Dependency graph
requires:
  - phase: 05-engine-adapter-skeleton-resource-descriptors
    provides: "05-01's `INTERFACE-NAME.md` (CONFIRMED names for this plan) and the clean core production tree including `lib/ports/engine.ts`"
  - phase: 04-resource-edit-layers-moved
    provides: "the moved core tree (`packages/libs/editor-core/lib/**`) that this gate scans, and the verifier-family conventions (`coreModuleState.js` / `editorShims.js`)"
provides:
  - "`scripts/verify/coreEngineNeutral.js` — the two-polarity game-identifier gate (PORT-06 vocab half + PORT-07 vocab half via `airwall`/`mota`)"
  - "One `- run: node scripts/verify/coreEngineNeutral.js` step in the pre-existing `lint` job; the four-job CI contract is provably unaltered"
  - "A machine-checkable definition of 'no engine identifier remains in core production source' (raw source, comments included)"
affects: [05-03, 05-04, 06, 11]

# Actuals — chars/4 over the realized diff (base bde4caf..HEAD)
actuals:
  tokens: 3119
  tasks: 2
  commits: 2        # measured: git rev-list --count bde4caf..HEAD at SUMMARY write (2 atomic task commits)
plan_head_before: bde4caf88d72d024a461579a9eef8d2f69aaef05

tech-stack:
  added: []
  patterns:
    - "Two-polarity verifier: a gate must be shown to fail on a synthetic violation AND to stay clean on false-friend/clean cases, not merely to pass on the real tree"
    - "Raw-source scan (comments included) for a vocabulary gate — deliberately NOT `editorShims.js`'s `stripComments()`"
    - "Per-match exemption (`floor` when the immediately preceding char is `.`) rather than an alternate regex, so the exemption itself is provable by the fixture"
    - "Non-vacuity floor on a scan (a conservative lower bound on scanned files) so a silently narrowed scope reds"

key-files:
  created:
    - scripts/verify/coreEngineNeutral.js
  modified:
    - .github/workflows/ci.yml

key-decisions:
  - "`floor` member-access exemption is a per-match preceding-character check (`FLOOR_EXEMPT_PRECEDING_CHAR = '.'`), never a different regex — that is what lets the fixture prove `Math.floor(...)` is a true non-violation while a standalone `floor(...)` would still red (D-13)"
  - "The gate scans RAW source including comments (Pitfall D): a leak in a `//` comment is as forbidden as one in code; the header records this as a deliberate design choice, not a silent default"
  - "Matching is case-sensitive on the lowercase term list (no uppercase folding), so capitalized JSDoc prose such as `Tower data` in `lib/resources/contentUtils.ts` stays legitimately clean"
  - "Scope is `packages/libs/editor-core/lib/**/*.{ts,tsx}` excluding any path with a `__tests__` segment (D-12/D-22) — core tests legitimately use `mota.tower`/`tower`; core production source must not"
  - "`MIN_EXPECTED_SOURCES = 30` is a conservative non-vacuity floor (tighter than `> 0`, safe as core grows) that reds if the scanned scope is silently narrowed"
  - "Wired as exactly ONE step inside the pre-existing `lint` job; no job was added or renamed, so the four-job contract and `scripts/verify/ci-workflow.js` stay green"
  - "No package installed: the verifier is plain Node ESM importing only `node:fs`/`node:path`/`node:process`"

patterns-established:
  - "Engine-neutrality is a machine check, not a review promise: the ban list is written in the verifier (not derived), the scope/exclusion rules are explicit, and the gate carries its own fail-proof"
  - "Fixture/ban-list drift guard: `PROBE_FIXTURE_EXPECTATIONS` must equal `BANNED_TERMS` or the two-polarity check reds, so adding a term without a fixture case cannot silently weaken the proof"

requirements-completed: [PORT-06]

# Coverage metadata — one entry per shipped deliverable.
coverage:
  - id: D1
    description: "`scripts/verify/coreEngineNeutral.js` — a two-polarity verifier that fails when any of the ten engine-identifier terms (`tower/floor/loc/autopass/autotile/idnum/airwall/commonEvent/prefab/mota`) appears in core production source (raw source, comments included; case-sensitive; `floor` member-access exempt; `__tests__` excluded)"
    requirement: PORT-06
    verification:
      - kind: other
        ref: "node scripts/verify/coreEngineNeutral.js (real tree: 36 files scanned ≥ floor 30, 0 violations; fixture: all 10 terms flagged, 5 clean cases 0 false positives, deleted in finally)"
        status: pass
      - kind: other
        ref: "node scripts/verify/coreModuleState.js && node scripts/verify/coreBoundaries.js && node scripts/verify/editorShims.js (unaffected, exit 0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "`.github/workflows/ci.yml` gains exactly one `- run: node scripts/verify/coreEngineNeutral.js` step in the existing `lint` job; the four-job contract (`lint`/`typecheck`/`unit`/`build`) is provably unaltered"
    requirement: PORT-06
    verification:
      - kind: other
        ref: "node scripts/verify/ci-workflow.js (exit 0) + inline four-job/step-wired check (exit 0)"
        status: pass
      - kind: other
        ref: "git diff .github/workflows/ci.yml (exactly one added step; other three jobs byte-identical)"
        status: pass
    human_judgment: false

# Metrics
duration: 6min
completed: 2026-09-28
status: complete
---

# Phase 5 Plan 02: Game-identifier gate Summary

**A two-polarity game-identifier gate (`scripts/verify/coreEngineNeutral.js`) that fails the build on any engine term in core production source — case-sensitive, comment-inclusive, `Math.floor`-exempt — wired as a single step into the existing `lint` CI job without touching the four-job contract.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-09-28T12:23:58Z
- **Completed:** 2026-09-28T12:30:03Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- `scripts/verify/coreEngineNeutral.js` scans the raw source (comments included) of `packages/libs/editor-core/lib/**/*.{ts,tsx}` — excluding any path with a `__tests__` segment — for the ten banned terms and reds on any hit. It is green on arrival: **36 files scanned, 0 violations**.
- The gate proves it can *fail*: a synthetic fixture written into core production source (and deleted in `finally`, asserted absent) is flagged on **all 10 terms**, including one in a line comment and one in a block comment; `Math.floor(...)`, `location`, `locState`, and capitalized `Tower`/`Floor` prose stay clean (**0 false positives**).
- Matching is case-sensitive over a lowercase list (capitalized JSDoc prose such as `Tower data` is legitimately clean), `floor` is exempted only by a per-match preceding-`.` check, and `\b` boundaries keep `loc` off its false friends.
- `.github/workflows/ci.yml` gains exactly one step in the pre-existing `lint` job; `ci-workflow.js` and an inline job-count check both confirm the four-job contract is unaltered.
- No core production source was edited to make the gate pass — its greenness reflects the tree.

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): End-to-end gate — green on the real core tree, red on a synthetic violation** - `3d1cbd6` (feat)
2. **Task 2: Harden the gate's edge cases and prove the real core tree is clean** - `e54c191` (feat)

**Plan metadata:** (final docs commit; see STATE/ROADMAP/REQUIREMENTS update)

## Verification Evidence

| Command | Result |
|---------|--------|
| `node scripts/verify/coreEngineNeutral.js` | exit 0 — real tree 36 files / 0 violations; fixture 10/10 flagged, 5 clean cases 0 false positives, deleted in `finally` |
| `node scripts/verify/coreModuleState.js` | exit 0 — 57 linted files, 0 error-level restricted-rule messages |
| `node scripts/verify/coreBoundaries.js` | exit 0 — 0 cruise violations, PKG-03 TS2307, edge direction correct |
| `node scripts/verify/editorShims.js` | exit 0 — 18 marked files exact, unique-new-site exactly 3 |
| `node scripts/verify/ci-workflow.js` | exit 0 — 4 jobs, no secrets/environment/paths |
| inline four-job + step-wired check | `ok` — exactly 4 jobs and `coreEngineNeutral.js` present |
| `pnpm lint` | exit 0 — 0 errors, 107 pre-existing warnings (none from the new file) |

## Files Created/Modified

- `scripts/verify/coreEngineNeutral.js` (created) — the two-polarity game-identifier gate: `collectSources` (recursive `.ts`/`.tsx` walker excluding `__tests__` segments, sorted by relative path), `findViolations` (raw-source scan, case-sensitive, `floor` member-access exempt, sorted `relPath → line → term`), a real-tree check with a `MIN_EXPECTED_SOURCES = 30` non-vacuity floor, a two-polarity fixture check (per-term line assertions, a ban-list/fixture drift guard, five clean cases), and a `main()` with `failures`/`check` and `process.exit(1)`.
- `.github/workflows/ci.yml` (modified) — one added `- run: node scripts/verify/coreEngineNeutral.js` step in the `lint` job, beside the existing `coreBoundaries.js`/`coreModuleState.js`/`editorShims.js` steps.

## Decisions Made

- **`floor` exemption is a per-match preceding-character check**, not an alternate regex — so the fixture can prove `Math.floor(...)` is a true non-violation while a standalone `floor(...)` would still red.
- **The gate scans raw source including comments** (Pitfall D), recorded in the header as a deliberate, stronger-than-`stripComments()` choice.
- **Case-sensitive lowercase scan** (no uppercase folding), keeping capitalized JSDoc prose clean.
- **`__tests__` exclusion** (D-12/D-22): core tests legitimately name mota resources; core production source must not.
- **`MIN_EXPECTED_SOURCES = 30`** as a conservative non-vacuity floor.
- **Exactly one added `lint`-job step**; the four-job contract is untouched.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- None. The real core tree was green on arrival, exactly as RESEARCH §"Game-identifier gate" predicted; no core production file needed editing.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- PORT-06's vocabulary half is now a machine check: any engine identifier entering `packages/libs/editor-core/lib` production source (comment or code) fails CI's `lint` job.
- The gate already carries the PORT-07 vocabulary half (`airwall`/`mota`), so 05-03/05-04 core-side additions are covered from the start.
- 05-04's mota adapter lives under `packages/apps/editor/src/adapter/**`, which is **outside** this gate's `editor-core` scope — the adapter legitimately holds engine vocabulary; core must not.
- No new dependency; `coreModuleState` / `coreBoundaries` / `editorShims` / `ci-workflow` and `pnpm lint` are all green.

---
*Phase: 05-engine-adapter-skeleton-resource-descriptors*
*Completed: 2026-09-28*

## Self-Check: PASSED

- Promised artifacts exist: `scripts/verify/coreEngineNeutral.js`, `.github/workflows/ci.yml` (one added step), `05-02-SUMMARY.md`.
- Task commits exist: `3d1cbd6`, `e54c191`.
- The transient fixture `packages/libs/editor-core/lib/__engineNeutralProbe__.ts` is absent after every run.
