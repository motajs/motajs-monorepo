---
phase: "5"
slug: "engine-adapter-skeleton-resource-descriptors"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-28"
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded by plan-phase; per-task rows are finalized by the planner once PLAN.md files exist.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x (per-package projects) |
| **Config file** | `packages/libs/editor-core/vitest.config.ts`, `packages/apps/editor/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @motajs/editor-core exec vitest run` |
| **Full suite command** | `pnpm test` |
| **Lint/gate command** | `pnpm lint` and `node scripts/verify/coreBoundaries.js` / `node scripts/verify/coreModuleState.js` |
| **Estimated runtime** | ~60–120 seconds |

---

## Sampling Rate

- **After every task commit:** Run the task's `<automated>` verify command (mostly `pnpm --filter @motajs/editor-core exec vitest run <file>` + `pnpm --filter @motajs/editor-core typecheck`)
- **After every plan wave:** Run `pnpm test` and `pnpm lint`
- **Before `/gsd-verify-work`:** Full suite + lint + all `scripts/verify/*.js` must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

> Requirement-level seed; the planner replaces/augments this with per-task rows after PLAN.md exists.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 5-01-01 | 01 | 1 | PORT-03 | — | N/A | unit | `pnpm --filter @motajs/editor-core exec vitest run lib/__tests__/<engine-contract>.test.ts` | ❌ W0 | ⬜ pending |
| 5-01-02 | 01 | 1 | PORT-04 | — | N/A | unit | `pnpm --filter @motajs/editor-core exec vitest run lib/resources/__tests__/<descriptor>.test.ts` | ❌ W0 | ⬜ pending |
| 5-02-01 | 02 | 2 | PORT-05 | — | N/A | integration | `pnpm --filter @motajs/editor typecheck` | ❌ W0 | ⬜ pending |
| 5-02-02 | 02 | 2 | PORT-06 | — | N/A | gate (two-polarity) | `node scripts/verify/<game-identifiers>.js` | ❌ W0 | ⬜ pending |
| 5-03-01 | 03 | 3 | PORT-07 | — | N/A | integration | `pnpm --filter @motajs/editor typecheck` | ❌ W0 | ⬜ pending |
| 5-03-02 | 03 | 3 | PORT-08 | — | N/A | unit (fixture) | `pnpm --filter @motajs/editor-core exec vitest run lib/__tests__/<fake-engine-b>.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/libs/editor-core/lib/__tests__/` — harness for the generic contract + fake engine B fixture
- [ ] `scripts/verify/<game-identifiers>.js` — two-polarity verifier (real tree green + synthetic violation red), plus a fixture proving `Math.floor` is clean
- [ ] `packages/apps/editor/src/adapter/` — new directory (mota adapter descriptors)
- [ ] CI wiring: new verifier runs inside the existing `lint` (or `unit`) job — no new job

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `@motajs/editor` behavior unchanged | all | Parity is end-to-end (UI), not unit-testable here | Run existing full suite + the Phase 1 baseline checks remain green; no manual app walk required this phase (additive, projectData untouched) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
