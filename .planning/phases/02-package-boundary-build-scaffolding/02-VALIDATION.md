---
phase: "2"
slug: "package-boundary-build-scaffolding"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-21"
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4 (installed 4.0.18) for core's smoke test; Playwright 1.61.1 exists but is **not** used this phase (no UI moves; e2e is not a PR gate per Phase 1 D-01) |
| **Config file** | `packages/libs/editor-core/vitest.config.ts` (new — D-12); harness configs already present: `packages/apps/editor/vitest.config.ts`, `packages/apps/service-worker/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @motajs/editor-core test` |
| **Full suite command** | `pnpm -r run test` (root fan-out = CI `unit` job) |
| **Estimated runtime** | core smoke suite ~2–5 s; full fan-out ~90 s (Phase 1 measurement: 1257 tests across 8 packages) |

**Verifier convention (Phase 1 D-01..D-16, established by `scripts/verify/*.js`):** plain ESM Node scripts, dependency-free where possible, Chinese file header, collect a `failures[]` array, print one line per failure, `process.exit(1)` on any failure, print `…: 全部断言通过` on success. New per-requirement verifiers follow this shape so they compose with the existing four-job CI gate (D-13: no new job).

---

## Sampling Rate

- **After every task commit:** the task's own narrow command — e.g. `pnpm --filter @motajs/editor-core typecheck`, `node scripts/verify/core-exports.js`, or the single relevant verifier.
- **After every plan wave:** `pnpm lint && pnpm typecheck && pnpm test` (the three fast gates); plus `node scripts/verify/ci-workflow.js` after any `.github/workflows/ci.yml` edit.
- **Before `/gsd-verify-work`:** all four CI jobs green (`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`) **plus** `node scripts/verify/ci-workflow.js`, `node scripts/verify/core-exports.js`, `node scripts/verify/core-panda-class.js`, `node scripts/verify/core-react-compiler.js`, `node scripts/verify/core-boundaries.js`, `pnpm format:check`, and a clean `git status --porcelain`.
- **Max feedback latency:** 90 seconds (full root fan-out); ≤10 s for any single verifier.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 1 | PKG-01 | T-02-01 | Package manifest cannot be resolved to an untracked/gitignored path; all 7 `exports` targets exist on disk | structural verifier | `node scripts/verify/core-exports.js` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | PKG-02 | T-02-01 | Every singleton resolved to exactly one realpath; no duplicate installed copy masks a boundary break | structural verifier | `node scripts/verify/core-exports.js` (second assertion) | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | PKG-03 | T-02-03 | A wrong `@/` import must fail loudly (no silent cross-package misresolution) | unit + build | `pnpm typecheck` (core program) **and** `pnpm build` (editor program) **and** core smoke test on the probe symbol | ❌ W0 + existing gates | ⬜ pending |
| TBD | TBD | 1 | PKG-04 | — | PandaCSS extraction cannot silently miss core source (which would ship unstyled components) | extraction verifier | `node scripts/verify/core-panda-class.js` (`panda cssgen`, asserts `.display_block { display: block }`) | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | PKG-05 | — | React Compiler coverage cannot silently regress to untransformed TSX | transform verifier | `node scripts/verify/core-react-compiler.js` (live Vite `transformRequest`; asserts `react/compiler-runtime` and `_c(`) | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | VERIFY-05 | T-02-03 | A boundary gate that never fires must be caught — synthetic violation must be reported, and `couldNotResolve` cannot mask the DAG rules | two-polarity gate verifier | `node scripts/verify/core-boundaries.js` (real tree → exit 0; synthetic violating fixture → non-zero, then clean up) | ❌ W0 | ⬜ pending |

*Plan/task IDs are assigned by gsd-planner; this map is keyed by requirement and is filled in as plans land.*
*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/libs/editor-core/package.json`, `tsconfig.json`, `vitest.config.ts`, the 7 stub barrels + the `lib/react/` probe (the package itself)
- [ ] `packages/libs/editor-core/lib/__tests__/<probe>.test.ts` — the mandatory smoke test (D-12; without it `pnpm -r run test` goes red — Pitfall 10: `vitest run` exits non-zero on "no test files")
- [ ] `scripts/verify/core-exports.js` — PKG-01 + PKG-02 + D-15 realpath dedupe
- [ ] `scripts/verify/core-panda-class.js` — PKG-04
- [ ] `scripts/verify/core-react-compiler.js` — PKG-05
- [ ] `scripts/verify/core-boundaries.js` + dependency-cruiser config — VERIFY-05, with the two-polarity proof
- [ ] `.planning/phases/02-package-boundary-build-scaffolding/INTERFACE-NAME.md` — `AGENTS.md` Project Rules require confirmed names **before** implementation (probe file/symbols, script file names, config file name, subpath-status manifest)
- [ ] Framework install: none — Vitest/Vite/PandaCSS/React Compiler are already present; only `dependency-cruiser` needs adding (pin `18.2.0` per the release-age finding), and host unit/build config edits (editor `vite.config.ts` / `vitest.config.ts` `@` alias → `resolvePlugin`)

*Existing harness is green and unchanged: `pnpm lint` = 0 errors / 108 warnings (exit 0), `pnpm typecheck` = 9 packages (exit 0), `pnpm test` = 1257 passed / 0 failed / 0 skipped (exit 0) — per `01-VERIFICATION.md:156-158`.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `requireZero` rule is *attached and running* in Phase 2 even though core has no singletons yet (empty set passes), so it auto-activates in Phase 3 | VERIFY-05 (D-17) | The rule's subject does not exist yet; a machine check can only prove the rule is configured, not that it will bite later | Inspect the dependency-cruiser config for the singleton rule; confirm `core-boundaries.js` cruises with the rule present and reports zero violations; re-confirm in Phase 3 once `lib/kernel/core.ts` + the 6 singletons exist |

*All other phase behaviors have automated verification. The PKG-03 blocking contradiction (research Q1) may add one manual/structural item once the user decides.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
