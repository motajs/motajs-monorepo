---
phase: "3"
slug: "kernel-runtime-ports-registry-diagnostics"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-22"
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 — one project, `packages/libs/editor-core/vitest.config.ts` |
| **Config file** | `packages/libs/editor-core/vitest.config.ts` (`include: ['lib/**/*.test.{ts,tsx}']`, `environment: 'jsdom'`) |
| **Quick run command** | `pnpm --filter @motajs/editor-core test` |
| **Full suite command** | `pnpm test` (root fan-out, `pnpm -r run test`) |
| **Kernel-test env** | `// @vitest-environment node` docblock per kernel test file (the config defaults to jsdom for the React probe) |
| **Estimated runtime** | core suite ≈ seconds; full fan-out ≈ 90 s (Phase 2 measurement: 1260 tests) |

**Static gates (all inside the existing four CI jobs — `ci-workflow.js` asserts exactly four):**
- `pnpm lint` — includes `node scripts/verify/coreBoundaries.js` and the new module-state verifier
- `pnpm typecheck` — includes `node scripts/verify/coreExports.js`
- `pnpm test` — the core suite + the whole workspace
- `pnpm build` — the editor artifact must be unchanged (Phase 2 baseline: 57 files / 16.80 MiB)

**Verifier convention (Phase 1/2):** plain ESM Node scripts, Chinese header, `failures[]` + one line per failure, `process.exit(1)`, `…: 全部断言通过` on success, and **two-polarity** (a synthetic violation must be provably caught — Phase 2's core lesson: a green gate is not a live gate).

---

## Sampling Rate

- **After every task commit:** `pnpm --filter @motajs/editor-core test` (fast, isolated to the new tests).
- **After every plan wave:** `pnpm lint && pnpm typecheck && pnpm test` (the three local analogues of the CI jobs).
- **Before `/gsd-verify-work`:** all four CI jobs green, plus `node scripts/verify/ci-workflow.js` to confirm the job contract was not altered, and `git status --porcelain` clean.
- **Max feedback latency:** ~90 s (full fan-out); ≤10 s for any single verifier.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 1 | KERN-01 | — | Two instances coexist; no shared mutable state | unit | `pnpm --filter @motajs/editor-core exec vitest run lib/__tests__/coreIsolation.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | KERN-02 | T-03-04 | Reverse-order release; idempotent; a throwing teardown does not abort the rest | unit | `… vitest run lib/__tests__/coreLifecycle.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | KERN-03 | T-03-03 | Duplicate id rejected with **no side effect**; failed replacement restores the previous value | unit | `… vitest run lib/__tests__/capabilityRegistry.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | KERN-04 | T-03-05 | Construction is atomic: missing required → reverse-order dispose + startup error carrying **all** diagnostics | unit | `… vitest run lib/__tests__/coreStartup.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | KERN-05 | — | `EDITOR_CORE_API_VERSION` + `DiagnosticBus` exported; history/subscribe/subscriber-isolation semantics | unit + export-surface | `… vitest run lib/__tests__/diagnostics.test.ts` **and** the export-surface verifier | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | KERN-06 | T-03-04 | A's capabilities invisible to B; A/B histories disjoint; disposing A leaves B working | unit | `… vitest run lib/__tests__/coreIsolation.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 2 | KERN-06 (structural) | T-03-06 | No module-level mutable binding in `lib/**` (composition root excepted) — and the gate **can** fail | static gate + two-polarity | `node scripts/verify/coreModuleState.js` (real tree green **and** synthetic `let` fixture red) in the `lint` job | ❌ W0 | ⬜ pending |
| TBD | TBD | 2 | PORT-01 | — | The four port interfaces exist and are exported | export-surface + typecheck | export-surface verifier + `pnpm typecheck` | ❌ W0 | ⬜ pending |
| TBD | TBD | 2 | PORT-02 | T-03-06 | Core source contains no `fetch`/`window`/`document`/`navigator`/`localStorage`/`XMLHttpRequest`/`process.env`/`import.meta.env` — and each rule **can** fire | static gate + two-polarity | `pnpm lint` (scoped override) + a synthetic fixture containing each banned identifier that **must** error, in the `lint` job | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | PORT-02 (edges) | T-03-03 | Core does not import host/engine; kernel does not import capabilities; no cycles | static gate (existing) | `node scripts/verify/coreBoundaries.js` | ✅ exists | ⬜ pending |
| TBD | TBD | 3 | Regression | T-03-07 | `@motajs/editor` unchanged; Phase 1/2 baseline stays green; artifact still 57 files / 16.80 MiB | full suite | `pnpm typecheck && pnpm test && pnpm build` + `coreBoundaries.js` + `editorArtifactAssets.js` | ✅ exists | ⬜ pending |

*Plan/task IDs are assigned by gsd-planner; this map is keyed by requirement and is filled in as plans land.*
*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/libs/editor-core/lib/__tests__/capabilityRegistry.test.ts` — KERN-03
- [ ] `packages/libs/editor-core/lib/__tests__/diagnostics.test.ts` — KERN-05
- [ ] `packages/libs/editor-core/lib/__tests__/coreStartup.test.ts` — KERN-04
- [ ] `packages/libs/editor-core/lib/__tests__/coreLifecycle.test.ts` — KERN-02
- [ ] `packages/libs/editor-core/lib/__tests__/coreIsolation.test.ts` — KERN-01 / KERN-06
- [ ] `packages/libs/editor-core/lib/__tests__/coreApiSurface.test.ts` **or** `scripts/verify/coreApiSurface.js` — KERN-05 / PORT-01 export assertions
- [ ] `scripts/verify/coreModuleState.js` — the module-state gate's two-polarity proof (synthetic `let` fixture → non-zero; real tree → zero), wired as an extra `- run:` step in the `lint` job
- [ ] PORT-02 two-polarity proof — either folded into `coreModuleState.js` or a sibling verifier that lints a synthetic fixture containing each banned identifier and asserts each rule fires
- [ ] `.planning/phases/03-kernel-runtime-ports-registry-diagnostics/INTERFACE-NAME.md` — `AGENTS.md` requires names confirmed **before** they land
- [ ] No framework install needed — Vitest / ESLint / dependency-cruiser / typescript-eslint are already present; this phase installs nothing and needs no network

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `@motajs/editor` behaves identically after the kernel lands (no UI/functional change) | PROJECT constraint (D-13 add-only) | The phase changes no app code, so the only meaningful check is that the app still runs as before — not expressible as a new automated assertion | Run the editor dev server / open a project; confirm no new console errors and no visual difference vs the Phase 1 screenshot baseline (manual comparison, per Phase 1 D-08) |
| The kernel is genuinely engine-agnostic (no engine vocabulary or file-structure assumptions leaked in) | PROJECT core value | A grep gate can catch known tokens but cannot judge design intent | Read `lib/kernel/**` and `lib/ports/**`; confirm only logical ids and injected contracts appear — no engine-specific paths, formats, or vocabulary |

*All other phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
