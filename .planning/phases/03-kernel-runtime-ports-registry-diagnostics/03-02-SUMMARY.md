---
phase: 03-kernel-runtime-ports-registry-diagnostics
plan: 02
subsystem: infra
tags: [editor-core, kernel, atomic-construction, lifecycle, teardown, diagnostics, engine-agnostic, vitest, vitest-node-env]

# Dependency graph
requires:
  - phase: 03-kernel-runtime-ports-registry-diagnostics
    provides: 03-01's per-instance kernel (lib/kernel/{core,registry,diagnostics,errors}.ts) — the compute-then-commit registry, the per-instance append-only DiagnosticBus, the reverse-order teardown stack + disposed flag, and the declared-but-unarmed EditorCoreStartupError
provides:
  - "createEditorCore required-registration resolution: config.requiredCapabilities unioned with a frozen core built-in list, de-duplicated, checked at the end of construction (D-07)"
  - "Atomic failure path: an unresolved required kind:id emits one capability.required-missing error diagnostic, the partial graph is drained in reverse via the shared helper, then EditorCoreStartupError is thrown carrying ALL diagnostics — no half-built instance is returned (D-08)"
  - "EditorCoreStartupError armed: readonly diagnostics holds a frozen copy of the full array; message summarises the missing refs with the Chinese enumeration comma"
  - "one module-private drainTeardowns(teardowns, diagnostics) helper — the single 'reverse order + per-item try/catch + report' implementation shared by EditorCore.dispose() and the startup-failure path"
  - "lifecycle.teardown-failed reporting through two channels: the DiagnosticBus (severity error, assertable) and a console line prefixed editor-core: (visible on site) (D-21)"
  - "lib/__tests__/coreStartup.test.ts, lib/__tests__/coreLifecycle.test.ts — the atomic-construction and lifecycle proofs, both under // @vitest-environment node with engine-neutral acme.* fixtures"
affects: [03-03 (public barrel re-exports this surface), 03-04 (module-state + PORT-02 gates scan these files), 04-resources, 05-engine-adapter, 11-cutover, 12-interface-freeze]

# Actuals (#2632) — same estimateTokens scale as the plan's `estimate` (chars/4 over the realized diff)
actuals:
  tokens: 3606
  tasks: 2
  commits: 2
  plan_head_before: b26f6c6fcecf9183d4988733575fbcbe58e09b46

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Atomic construction: the required set is resolved only after install returns, and the failure path releases first and throws last — so a failed construction can never leak a registry, a bus, or an adapter-installed subscription (T-03-05)"
    - "One drain, two callers: the reverse-order/throw-isolating drain is a module-private helper taking (teardowns, diagnostics), so EditorCore.dispose() and the startup-failure path cannot drift into two subtly different implementations"
    - "Disposed-flag-first idempotency: EditorCore.dispose() sets the flag before draining, so a re-entrant call from inside a teardown is a no-op and a second call cannot re-run or re-report (T-03-04)"
    - "Two-channel failure reporting: every collected teardown failure is appended to the same per-instance bus (assertable in tests) and printed with an editor-core: prefix (visible on site) — D-21's repudiation guard (T-03-07)"
    - "Only missing-required blocks startup: an error diagnostic produced by install (e.g. a rejected duplicate registration) is carried on a successfully constructed instance and readable from diagnostics.snapshot()"

key-files:
  created:
    - packages/libs/editor-core/lib/__tests__/coreStartup.test.ts
    - packages/libs/editor-core/lib/__tests__/coreLifecycle.test.ts
  modified:
    - packages/libs/editor-core/lib/kernel/core.ts
    - packages/libs/editor-core/lib/kernel/errors.ts

key-decisions:
  - "The required set is a Set<string> over `[...(config.requiredCapabilities ?? []), ...BUILTIN_REQUIRED_CAPABILITIES]`, and presence is checked with `entries.has(ref)` against the registry Map keyed by `${kind}:${id}` — so the required granularity is exactly the concrete ref D-07 names, with no ref parsing"
  - "`EditorCoreStartupError` copies and freezes the array it is handed (`Object.freeze([...diagnostics])`), so a later mutation of the bus history cannot change the error's payload; the plan explicitly allows frozen-or-copied"
  - "`BUILTIN_REQUIRED_CAPABILITIES` is declared here (deferred from 03-01 to preserve the 108-warning lint baseline) as `Object.freeze([])`, module-private and unexported — a frozen constant, not mutable state"
  - "The drain helper keeps the pre-existing D-21 reporting (bus diagnostic + editor-core: console line) so factoring it out of EditorCore.dispose() preserved behaviour rather than splitting it"
  - "Task 2 needed no change to core.ts: Task 1's shared drain helper plus the disposed-flag-first dispose already implement the full D-09/D-21 contract, so Task 2's deliverable is the exhaustive lifecycle test (mirrors 03-01's Task 2 observation)"

patterns-established:
  - "A green gate is not a live gate (Phase-2 lesson carried forward): the startup and lifecycle tests drive the real public path (`createEditorCore` / `EditorCore.dispose`) and observe the ordering array, the thrown error, and the bus snapshot — never internals"
  - "Diagnostics-over-throw stays intact: throw is used only for the single 'construction cannot complete' case; every registration/validation problem returns a diagnostic instead (D-02/D-08)"
  - "Test-file fixture discipline even though D-22 exempts lib/__tests__/** from the machine gate: this plan declares no module-scope fixture table, and the console spy is wrapped in try/finally so it cannot leak into another file"

requirements-completed: [KERN-04, KERN-02]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Required-registration resolution: config.requiredCapabilities unioned with the frozen core built-in list, de-duplicated, checked at the end of construction; a satisfied required ref constructs normally (KERN-04 / D-07)"
    requirement: "KERN-04"
    verification:
      - kind: unit
        ref: "packages/libs/editor-core/lib/__tests__/coreStartup.test.ts#必需注册已满足时构造成功并暴露该能力"
        status: pass
      - kind: other
        ref: "pnpm --filter @motajs/editor-core typecheck -> exit 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "Atomic failure: an unresolved required ref emits capability.required-missing, releases the partial graph in reverse, then throws EditorCoreStartupError carrying ALL diagnostics (duplicate + required-missing) — no instance is returned (KERN-04 / D-08, T-03-05)"
    requirement: "KERN-04"
    verification:
      - kind: unit
        ref: "packages/libs/editor-core/lib/__tests__/coreStartup.test.ts#必需注册未解析时抛出 EditorCoreStartupError 且不返回实例"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-core/lib/__tests__/coreStartup.test.ts#启动错误的 diagnostics 携带 capability.required-missing 与精确 target"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-core/lib/__tests__/coreStartup.test.ts#启动错误携带全部诊断（被拒的重复注册 + 必需缺失）"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-core/lib/__tests__/coreStartup.test.ts#启动失败路径逆序释放已创建的部分"
        status: pass
    human_judgment: false
  - id: D3
    description: "Non-blocking error diagnostics: a rejected duplicate registration during install does not abort construction and is readable from diagnostics.snapshot() (KERN-04 / D-08)"
    requirement: "KERN-04"
    verification:
      - kind: unit
        ref: "packages/libs/editor-core/lib/__tests__/coreStartup.test.ts#非阻断的 error 诊断不阻断构造，且可从 snapshot 读到"
        status: pass
    human_judgment: false
  - id: D4
    description: "EditorCore.dispose() is synchronous, void, reverse-ordered, and idempotent; capabilities registered during and after construction are unreachable afterwards and snapshotCapabilities() is empty (KERN-02 / D-09)"
    requirement: "KERN-02"
    verification:
      - kind: unit
        ref: "packages/libs/editor-core/lib/__tests__/coreLifecycle.test.ts#三个拆除钩子按创建逆序释放"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-core/lib/__tests__/coreLifecycle.test.ts#dispose 幂等：二次调用不改变释放顺序、不新增诊断"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-core/lib/__tests__/coreLifecycle.test.ts#构造期间注册的能力在 dispose 后不可达，snapshotCapabilities 为空"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-core/lib/__tests__/coreLifecycle.test.ts#构造之后注册的能力同样被 dispose 释放"
        status: pass
    human_judgment: false
  - id: D5
    description: "A throwing teardown is isolated: the other teardowns still run, exactly one lifecycle.teardown-failed error diagnostic carries the thrown value, and exactly one editor-core: console line is emitted (KERN-02 / D-21, T-03-04/T-03-07)"
    requirement: "KERN-02"
    verification:
      - kind: unit
        ref: "packages/libs/editor-core/lib/__tests__/coreLifecycle.test.ts#抛出的拆除钩子被隔离：其余钩子照常运行，只追加一条 lifecycle.teardown-failed 诊断并打印一行 console"
        status: pass
    human_judgment: false
  - id: D6
    description: "BUILTIN_REQUIRED_CAPABILITIES is Object.freeze([]) and not exported, and exactly one module-private drain helper is shared by the failure path and EditorCore.dispose()"
    verification:
      - kind: other
        ref: "grep of lib/kernel/core.ts -> `const BUILTIN_REQUIRED_CAPABILITIES: readonly string[] = Object.freeze([])` (not exported); `drainTeardowns` appears once as a definition and twice as call sites"
        status: pass
    human_judgment: false

# Metrics
duration: 6min
completed: 2026-09-23
status: complete
---

# Phase 3 Plan 02: Atomic construction and an honest teardown Summary

**Required registrations are resolved at the end of construction and a missing one releases the partial graph in reverse before throwing one `EditorCoreStartupError` carrying every diagnostic — while `EditorCore.dispose()` stays synchronous, void, idempotent, and loses at most the failing teardown, reporting it through both the bus and the console.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-09-23T05:00:00Z
- **Completed:** 2026-09-23T05:06:25Z
- **Tasks:** 2 / 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- **Construction is atomic.** After `config.install?.(registrar)` returns, `createEditorCore` resolves the required set as `config.requiredCapabilities ∪ BUILTIN_REQUIRED_CAPABILITIES` (de-duplicated), checks each `kind:id` against the registry `Map`, and on any miss emits one `capability.required-missing` error diagnostic, drains the teardown stack in reverse, then throws `EditorCoreStartupError` built from `DiagnosticBus.snapshot()`. Nothing is returned on that path — a rejected startup cannot leak a registry, a bus, or an adapter-installed subscription.
- **Only a missing required registration blocks startup.** A rejected duplicate registration produced during `install` is carried on a successfully constructed instance and stays readable from `editor.diagnostics.snapshot()`.
- **`EditorCoreStartupError` is now armed.** Its `diagnostics` is a frozen copy of the full array (so later bus mutations cannot change it), `this.name` is `'EditorCoreStartupError'`, and the message lists the missing refs joined with `、`.
- **One drain, two callers.** The reverse-order, throw-isolating drain was factored into a single module-private `drainTeardowns(teardowns, diagnostics)` used by both `EditorCore.dispose()` and the startup-failure path — the failure path is not a second, subtly different copy.
- **Teardown is honest.** `EditorCore.dispose()` sets `disposed` first (re-entrant call is a no-op; a second call re-runs nothing), drains strictly in reverse creation order, and a throwing teardown neither aborts the remaining teardowns nor escapes as a throw. Each failure is reported twice over: one `lifecycle.teardown-failed` `error` diagnostic on the same bus, plus one `editor-core:` console line (D-21).
- **Deferred constant landed.** `BUILTIN_REQUIRED_CAPABILITIES = Object.freeze([])` is declared module-private in `core.ts` (as 03-01 deferred it), making D-07's union mechanism real rather than aspirational, with no lint regression.

## Task Commits

Each task was committed atomically:

1. **Task 1: Resolve the required registrations and make construction atomic** - `3371127` (feat)
2. **Task 2: Finish the lifecycle — idempotent dispose, isolated throwing teardown, bus + console reporting** - `f39f582` (test)

**Plan metadata:** (this SUMMARY commit) (docs: complete plan)

_Note: no TDD tasks. `plan_head_before` = `b26f6c6fcecf9183d4988733575fbcbe58e09b46`; `commits` measured = 2._

## Files Created/Modified

- `packages/libs/editor-core/lib/kernel/core.ts` - added `BUILTIN_REQUIRED_CAPABILITIES` (frozen, module-private); factored the module-private `drainTeardowns` helper out of `EditorCore.dispose()`; added the end-of-construction required resolution and the atomic failure path (`capability.required-missing` → reverse drain → `throw EditorCoreStartupError`)
- `packages/libs/editor-core/lib/kernel/errors.ts` - `EditorCoreStartupError` now copies/freezes the full diagnostics array and joins the missing refs with the Chinese enumeration comma
- `packages/libs/editor-core/lib/__tests__/coreStartup.test.ts` - 6 tests: satisfied-required success, missing-required throw + no instance, exact `capability.required-missing` target, failure-path reverse drain, all-diagnostics carried, non-blocking duplicate diagnostic
- `packages/libs/editor-core/lib/__tests__/coreLifecycle.test.ts` - 5 tests: reverse-order release, idempotency, isolated throwing teardown (diagnostic + `editor-core:` console spy), capabilities unreachable after dispose (during and after construction)

## Decisions Made

- **Required-set resolution is a `Set<string>` checked with `entries.has(ref)`.** The registry `Map` is keyed by `${kind}:${id}`, so the required ref is matched at exactly the granularity D-07 names — no ref parsing, and duplicates collapse for free.
- **The thrown error owns a frozen copy of the diagnostics.** The plan allowed "frozen or copied"; doing both guarantees a later bus mutation cannot rewrite what the error carries.
- **`BUILTIN_REQUIRED_CAPABILITIES` is a frozen constant, not mutable state.** It is module-private and unexported; core owns no capability kind yet (A8), and the constant exists so the union mechanism is real.
- **The drain helper retained D-21's two-channel reporting when factored.** This is why Task 2 required no `core.ts` change: the lifecycle contract was already whole after Task 1.

## Deviations from Plan

None - plan executed exactly as written.

### Plan-level observation (not a defect)

**Task 2 required no change to `core.ts`.** Task 2's `<files>` lists `core.ts`, but Task 1's action already required the single shared drain helper (with the existing D-21 bus + console reporting) and the disposed-flag-first `EditorCore.dispose()`, so the D-09/D-21 contract was fully implemented at Task 1's commit. Task 2 therefore committed only its exhaustive lifecycle test. No behaviour was skipped; this mirrors 03-01's Task 2 observation, where the second task's deliverable was likewise the contract test rather than a further implementation change.

---

**Total deviations:** 0 auto-fixed (1 plan-level observation)
**Impact on plan:** None. No gate was weakened, no confirmed name changed, no export name added, and no file under `packages/apps/**` was touched (D-13 add-only).

## Issues Encountered

- **Root fan-out not exercised by this plan.** The plan-level verification is scoped to the core package (`typecheck`, `test`, `coreBoundaries.js`, `lint`, `format:check`); the pre-existing `@motajs/react-monaco-editor` teardown flake was therefore not a factor. `pnpm --filter @motajs/editor-core test` is green (6 files / 29 tests) on the first attempt.
- **Windows console mojibake** on Chinese output is a codepage artifact only; file bytes are correct.

## User Setup Required

None - no external service configuration required.

## Verification evidence (verbatim)

Task 1 `<automated>` (`pnpm --filter @motajs/editor-core typecheck && pnpm --filter @motajs/editor-core exec vitest run lib/__tests__/coreStartup.test.ts`):

```
$ tsc -b
 ✓ lib/__tests__/coreStartup.test.ts (6 tests) 4ms
 Test Files  1 passed (1)
      Tests  6 passed (6)
```
→ exit **0**.

Task 2 `<automated>` (`pnpm --filter @motajs/editor-core exec vitest run lib/__tests__/coreLifecycle.test.ts`):

```
 ✓ lib/__tests__/coreLifecycle.test.ts (5 tests) 5ms
 Test Files  1 passed (1)
      Tests  5 passed (5)
```
→ exit **0**.

Plan-level `<verification>`:

1. `pnpm --filter @motajs/editor-core typecheck` → exit **0**
2. `pnpm --filter @motajs/editor-core test` → **6 files / 29 tests passed**, exit **0** (Plan 01's three + this plan's two + the Phase-2 probe)
3. `node scripts/verify/coreBoundaries.js` → exit **0**:
   ```
   coreBoundaries: 真实树 cruise 通过（error 违规 0 条，warn 0 条，共 21 个模块、22 条依赖）
   coreBoundaries: core 包内相对边全部解析到 core 内部（18 个 core 模块、13 条相对边）
   coreBoundaries: 全部断言通过（真实树 0 违规、合成违规被拦、PKG-03 负极性 TS2307、editor→core 边方向正确）
   ```
4. `pnpm lint` → `108 problems (0 errors, 108 warnings)` exit **0**; `pnpm format:check` → `All matched files use Prettier code style!` exit **0**
5. `git status --porcelain` → empty; `git status --porcelain -- packages/apps` → empty (D-13 add-only respected); no new export name in `lib/kernel/core.ts` or `lib/kernel/errors.ts`

## Known Stubs

None — this plan introduces no stub, placeholder, or hardcoded-empty value that flows to a consumer. The one deferred-from-03-01 item (`BUILTIN_REQUIRED_CAPABILITIES`) is now declared, used, and asserted.

## Threat Flags

None — no security-relevant surface beyond the plan's `<threat_model>` was introduced. T-03-05 (non-atomic construction) is mitigated by the end-of-construction check plus reverse-drain-then-throw; T-03-04 (a throwing teardown stranding resources) by the per-item `try`/`catch` drain and the disposed-flag-first guard; T-03-07 (a swallowed failure) by the two-channel reporting; T-03-SC by installing nothing (`package.json` untouched).

## Next Phase Readiness

- Ready for **Plan 03-03** (declared ports + honest public surface): it adds `lib/ports/{engine,fs,host,preview}.ts` + a barrel, extends `lib/index.ts` to re-export the kernel and ports, and updates `subpathStatus.json` + `scripts/verify/coreExports.js` together (N-26).
- The kernel modules are still not re-exported from `lib/index.ts` — that is 03-03, which keeps `coreExports.js` and `subpathStatus.json` consistent in the same commit.
- The module-state + PORT-02 gates (03-04) will scan these files: `lib/kernel/core.ts` is the one exempt production file, and the new test files are exempt under D-22.

---
*Phase: 03-kernel-runtime-ports-registry-diagnostics*
*Completed: 2026-09-23*

## Self-Check: PASSED

- Both created files exist on disk: `lib/__tests__/coreStartup.test.ts`, `lib/__tests__/coreLifecycle.test.ts`.
- Both task commits exist: `3371127` (Task 1), `f39f582` (Task 2).
- `commits` measured from the on-disk ledger `b26f6c6fcecf9183d4988733575fbcbe58e09b46..HEAD` = **2**, matching `actuals.commits`.
- No file under `packages/apps/**` was modified; `git status --porcelain -- packages/apps` is empty.
