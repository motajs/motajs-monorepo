---
phase: "01"
slug: "baseline-verification-net"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-20"
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x (unit/integration) + Playwright 1.61 (e2e) |
| **Config file** | Per-package vitest configs; Wave 0 adds `packages/apps/editor/vitest.config.ts` (split from `vite.config.ts`) |
| **Quick run command** | `pnpm --filter @motajs/editor test` |
| **Full suite command** | per-package fan-out from root (`pnpm test`) once root scripts land; until then `pnpm --filter <pkg> test` for each workspace package |
| **Estimated runtime** | Unknown until baseline recorded (VERIFY-01) — Wave 0 records it |

---

## Sampling Rate

- **After every task commit:** Run the quick run command for the touched package
- **After every plan wave:** Run the full suite for all workspace packages
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** To be set from the Wave 0 baseline measurement

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | W0 | VERIFY-01 | — | N/A | manual + script | `pnpm install --frozen-lockfile && git submodule update --init packages/external/mota-js` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | VERIFY-02 | — | N/A | ci | PR CI run shows `lint`/`typecheck`/`unit`/`build` jobs | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | VERIFY-03 | — | N/A | unit | `pnpm --filter @motajs/editor test -- PersistExecutor PersistenceMonitor` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | VERIFY-04 | — | N/A | unit | `pnpm --filter @motajs/editor test -- operationHistory` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | VERIFY-06 | — | N/A | e2e | `pnpm --filter @motajs/service-worker test:e2e` (no silent skip) | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | VERIFY-07 | — | N/A | unit | protocol-constant generated assertion test | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Task IDs are filled in once the planner writes PLAN.md. This map seeds one row per phase requirement so none is dropped.*

---

## Wave 0 Requirements

- [ ] **Environment repair (blocking prerequisite):** workspace junctions are all dangling in this checkout; `pnpm install --frozen-lockfile` currently aborts with `UNKNOWN: unknown error`. Reinstall from the intact store (`E:\.pnpm-store\v10`) before any measurement. Do **not** misdiagnose this as a submodule problem.
- [ ] `git submodule update --init packages/external/mota-js` — required by unit, build, and e2e
- [ ] `packages/apps/editor/vitest.config.ts` — split from `vite.config.ts` so test config no longer imports `MOTA_JS_ROOT`
- [ ] `.github/workflows/ci.yml` — new PR + push workflow (jobs: lint, typecheck, unit, build)
- [ ] Root `test`/`typecheck`/`build` fan-out scripts + editor `typecheck` script
- [ ] `.planning/baseline/` + `BASELINE.md` + snapshot JSON schema
- [ ] `.planning/baseline/screenshots/` — four editors + shell baseline screenshots
- [ ] Characterization test stubs (co-located `__tests__/`) for persistence and history invariants

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Required status checks block merges | VERIFY-02 | Branch protection / rulesets are repo settings requiring admin permission; no workflow file can enforce them | Configure the four `ci.yml` jobs as required status checks on the PR rule for `main` |
| Baseline screenshot visual comparison | VERIFY-01 | No automated image diff by decision (D-08) | Compare current UI against `.planning/baseline/screenshots/` for the four editors + shell |
| Protocol mismatch recorded, not fixed | VERIFY-07 | The mismatch is pre-existing behavior that must be preserved, not a defect to repair | Confirm the assertion records manifest `runtimeProtocolVersion: 3` and `RUNTIME_PROTOCOL_VERSION = 4` unchanged |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < recorded baseline
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
