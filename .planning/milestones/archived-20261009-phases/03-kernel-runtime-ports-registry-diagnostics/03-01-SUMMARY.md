---
phase: 03-kernel-runtime-ports-registry-diagnostics
plan: 01
subsystem: infra
tags: [editor-core, kernel, capability-registry, diagnostics, per-instance, engine-agnostic, vitest, vitest-node-env]

# Dependency graph
requires:
  - phase: 02-package-boundary-build-scaffolding
    provides: the real private @motajs/editor-core package (lib/ layout, seven subpaths, core's own vitest project, the `@styled-system` alias) and the dependency-cruiser boundary rules already linked and running
provides:
  - "lib/kernel/diagnostics.ts — Diagnostic, DiagnosticSeverity, DiagnosticBus, createDiagnosticBus, DIAGNOSTIC_CODES, DiagnosticCode; a per-instance closure bus with append-only history, subsequent-only subscribe, and append-without-dispatch subscriber-error isolation"
  - "lib/kernel/registry.ts — CapabilityRef, RegisterCapabilityOptions, RegisterCapabilityResult (the registry's contract types; storage lives in the composition root)"
  - "lib/kernel/errors.ts — EditorCoreStartupError (declared here; first thrown by Plan 03-02)"
  - "lib/kernel/core.ts — createEditorCore, EditorCore, EditorCoreConfig, CapabilityRegistrar (with CapabilityRegistrar.register / CapabilityRegistrar.addTeardown), EDITOR_CORE_API_VERSION = '0.1.0'; a per-instance object graph with a compute-then-commit registry, delete-if-still-mine disposers, a frozen flat snapshot, and a reverse-order teardown drain"
  - "lib/__tests__/coreIsolation.test.ts, capabilityRegistry.test.ts, diagnostics.test.ts — the tracer + isolation + registry + bus proofs, all under `// @vitest-environment node` with engine-neutral `acme.*` fixtures"
affects: [03-02 (atomic startup + lifecycle extend core.ts/errors.ts), 03-03 (public barrel re-exports this surface), 03-04 (module-state + PORT-02 gates scan these files), 04-resources, 05-engine-adapter, 11-cutover]

# Actuals (#2632) — same estimateTokens scale as the plan's `estimate` (chars/4 over the realized diff)
actuals:
  tokens: 7007
  tasks: 3
  commits: 3
  plan_head_before: 0c2085118ec188017e1f9ee52df6494982de2ed3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-instance kernel state: every mutable container (registry Map, teardown stack, disposed flag, bus history + listener set) lives inside a `create*` closure, never at module scope — so two instances cannot share state and the module-state gate stays green"
    - "Compute-then-commit registration: validate kind format, then the duplicate/replaceable rules, and only then a single `map.set(...)` + one pushed revoke — a rejected registration has no side effect by construction, which is strictly stronger than 'restore the previous value'"
    - "Delete-if-still-mine disposer: the revoke closure deletes a key only while the stored entry is still the one that registration created, so a stale disposer is inert after a replaceable replacement and calling it then `dispose()` cannot double-fire"
    - "Append-without-dispatch subscriber isolation: a throwing listener appends one `diagnostic.subscriber-error` warning straight to the history array and is never re-dispatched, so recursion is structurally impossible and the other listeners still receive the original diagnostic"
    - "Engine-neutral evidence: every fixture/kind/id in the kernel tests is `acme.*`; no engine vocabulary or file-structure assumption enters core"
    - "Kernel tests opt out of the package's global jsdom with a per-file `// @vitest-environment node` docblock instead of changing vitest.config.ts (the Phase-2 React probe keeps jsdom)"

key-files:
  created:
    - packages/libs/editor-core/lib/kernel/diagnostics.ts
    - packages/libs/editor-core/lib/kernel/registry.ts
    - packages/libs/editor-core/lib/kernel/errors.ts
    - packages/libs/editor-core/lib/kernel/core.ts
    - packages/libs/editor-core/lib/__tests__/coreIsolation.test.ts
    - packages/libs/editor-core/lib/__tests__/capabilityRegistry.test.ts
    - packages/libs/editor-core/lib/__tests__/diagnostics.test.ts
  modified: []

key-decisions:
  - "The registry's storage and kind validation live in the `createEditorCore` closure, not in a second exported factory: D-01 makes the instance the registry's only entry point and the confirmed export set is exactly N-01..N-26, so `registry.ts` contributes contract types only (the N-03 divergence recorded in INTERFACE-NAME.md)"
  - "`EditorCoreStartupError` imports the `DIAGNOSTIC_CODES` value (not just the `Diagnostic` type) so its message derives the missing refs from the single stable code table rather than duplicating the 'capability.required-missing' literal"
  - "`BUILTIN_REQUIRED_CAPABILITIES` is NOT declared in this plan even though Plan 01's artifacts table names it: an unused module-private const trips `@typescript-eslint/no-unused-vars` and would move lint from 108 to 109 warnings; Plan 03-02's Task 1 action explicitly adds it and its acceptance criteria cover it (documented deviation)"
  - "Task 2 needed no change to core.ts: the tracer in Task 1 already implemented the full compute-then-commit contract (kind validation, duplicate/replaceable, inert disposers, drain), so Task 2's deliverable is the exhaustive contract test"
  - "Snapshot entries are `{ kind, id, value, owner }` objects inside a frozen array (only the array is frozen, per the plan's `Object.freeze(entries.map(...))` shape); `owner` is carried through as `undefined` when absent"

patterns-established:
  - "A green gate is not a live gate (Phase-2 lesson carried forward): the tracer drives the real public path end-to-end rather than asserting internals, so any broken layer fails at the first commit"
  - "Diagnostics-over-throw for registration/validation: `registerCapability` returns `{ disposer, diagnostics }` and never throws; `throw` is reserved for 'construction cannot complete' (the class exists here; Plan 02 arms it)"
  - "Test-file fixture discipline even though D-22 exempts `lib/__tests__/**` from the machine gate: module-scope tables are `as const` so the intent is explicit"

requirements-completed: [KERN-01, KERN-02, KERN-03, KERN-05, KERN-06]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "`createEditorCore(config)` returns a real per-instance `EditorCore` that runs the `install` callback, reads values back, exposes a flat frozen snapshot, and disposes in reverse creation order (KERN-01/KERN-02)"
    requirement: "KERN-01"
    verification:
      - kind: unit
        ref: "packages/libs/editor-core/lib/__tests__/coreIsolation.test.ts#create → install → 读回 → snapshot → 逆序 dispose"
        status: pass
      - kind: other
        ref: "pnpm --filter @motajs/editor-core typecheck -> exit 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "Two instances coexist without interference: A's registrations invisible to B, A/B diagnostic histories disjoint, disposing A leaves B working (KERN-06 behavioural half)"
    requirement: "KERN-06"
    verification:
      - kind: unit
        ref: "packages/libs/editor-core/lib/__tests__/coreIsolation.test.ts#两个实例互不干扰"
        status: pass
    human_judgment: false
  - id: D3
    description: "Registry contract: kind format validation, duplicate rejection with no side effect naming the existing owner, replaceable replacement with an inert stale disposer, failed registration leaving the previous value readable, frozen flat snapshot, and `__proto__`/`constructor` prototype-pollution safety (KERN-03)"
    requirement: "KERN-03"
    verification:
      - kind: unit
        ref: "packages/libs/editor-core/lib/__tests__/capabilityRegistry.test.ts (8 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Diagnostic bus contract: ordered frozen snapshot copy, subsequent-only `DiagnosticBus.subscribe`, unsubscribe, subscriber-error isolation with exactly one non-dispatched `diagnostic.subscriber-error` warning, the five stable codes, and append-only unbounded history (KERN-05)"
    requirement: "KERN-05"
    verification:
      - kind: unit
        ref: "packages/libs/editor-core/lib/__tests__/diagnostics.test.ts (5 tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "`EDITOR_CORE_API_VERSION` is exported as the literal `'0.1.0'` from `lib/kernel/core.ts` (the public barrel re-export is Plan 03-03)"
    requirement: "KERN-05"
    verification:
      - kind: other
        ref: "pnpm --filter @motajs/editor-core typecheck -> exit 0; grep of lib/kernel/core.ts shows `export const EDITOR_CORE_API_VERSION = '0.1.0'`"
        status: pass
    human_judgment: false
  - id: D6
    description: "`EditorCoreStartupError` is declared carrying `readonly diagnostics: readonly Diagnostic[]` with `name = 'EditorCoreStartupError'` — but it is not yet constructed or thrown in this plan"
    verification:
      - kind: other
        ref: "pnpm --filter @motajs/editor-core typecheck -> exit 0 (class compiles; `@types/node`-free, no `Error.captureStackTrace`)"
        status: pass
    human_judgment: true
    rationale: "This plan only declares the class; the runtime `name` and `diagnostics` behaviour is first exercised by `coreStartup.test.ts` in Plan 03-02, which is the correct place to assert it. No automated check in this plan observes the constructed error."

# Metrics
duration: 10min
completed: 2026-09-23
status: complete
---

# Phase 3 Plan 01: Kernel tracer, capability registry, and diagnostic bus Summary

**Engine-neutral per-instance kernel: `createEditorCore` with a compute-then-commit capability registry, a per-instance append-only diagnostic bus, and reverse-order teardown — proven end-to-end and isolated across two instances.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-09-23T04:40:47Z
- **Completed:** 2026-09-23T04:51:14Z
- **Tasks:** 3 / 3
- **Files modified:** 7 (7 created, 0 modified)

## Accomplishments

- `createEditorCore(config)` now returns a real per-instance `EditorCore` whose entire mutable state (registry `Map`, teardown stack, `disposed` flag, bus history + listener set) lives in closures — two instances created in one process are provably disjoint, and `@motajs/editor` is untouched (D-13 add-only).
- The capability registry is compute-then-commit: kind format is validated with the D-17 pattern, duplicates are rejected with a `capability.duplicate` diagnostic naming the existing `owner` and **no** side effect, `replaceable: true` is the only way to replace, and stale disposers are inert (delete-if-still-mine).
- `DiagnosticBus` is per-instance and hostile to a broken subscriber: a throwing listener appends exactly one `diagnostic.subscriber-error` warning **without re-dispatching it**, so recursion is structurally impossible while the other listeners still receive the original diagnostic.
- `EditorCoreStartupError` is declared with `readonly diagnostics` and no `Error.captureStackTrace` call (which would fail core's `@types/node`-free `typecheck`); Plan 03-02 arms it.
- Three kernel test files run under `// @vitest-environment node` with engine-neutral `acme.*` fixtures; the tracer drives the real public path (create → install → read back → snapshot → dispose) instead of asserting internals.

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): End-to-end core kernel — create, install one capability, read it back, snapshot it, release it in reverse order** - `fe845c4` (feat)
2. **Task 2: Harden the registry contract — kind format, duplicate rejection with no side effect, replaceable replacement, frozen snapshot** - `8bab29a` (test)
3. **Task 3: Harden the diagnostic bus — append-only history, subsequent-only subscribe, subscriber-error isolation without recursion** - `09f423b` (test)

**Plan metadata:** (this SUMMARY commit) (docs: complete plan)

_Note: no TDD tasks; each task is a single commit. `plan_head_before` = `0c2085118ec188017e1f9ee52df6494982de2ed3`; `commits` measured = 3._

## Files Created/Modified

- `packages/libs/editor-core/lib/kernel/diagnostics.ts` - `Diagnostic`/`DiagnosticSeverity`/`DiagnosticBus`/`createDiagnosticBus`/`DIAGNOSTIC_CODES`/`DiagnosticCode`; per-instance closure bus, frozen history copy, append-without-dispatch subscriber isolation
- `packages/libs/editor-core/lib/kernel/registry.ts` - `CapabilityRef`/`RegisterCapabilityOptions`/`RegisterCapabilityResult`; contract types only (storage lives in the composition root)
- `packages/libs/editor-core/lib/kernel/errors.ts` - `EditorCoreStartupError` with `readonly diagnostics`, message derived from the missing `kind:id` targets; no `Error.captureStackTrace`
- `packages/libs/editor-core/lib/kernel/core.ts` - `createEditorCore`/`EditorCore`/`EditorCoreConfig`/`CapabilityRegistrar`/`EDITOR_CORE_API_VERSION`; module-private `KIND_PATTERN` + `RegistryEntry`; compute-then-commit registry; frozen flat snapshot; reverse-order drain with `lifecycle.teardown-failed` reporting (bus + `editor-core:` console line)
- `packages/libs/editor-core/lib/__tests__/coreIsolation.test.ts` - tracer end-to-end + two-instance isolation (2 tests)
- `packages/libs/editor-core/lib/__tests__/capabilityRegistry.test.ts` - full registry contract incl. `__proto__`/`constructor` safety (8 tests)
- `packages/libs/editor-core/lib/__tests__/diagnostics.test.ts` - bus history/subscribe/isolation/codes/unbounded (5 tests)

## Decisions Made

- **Registry storage stays in the composition root.** D-01 makes the instance the registry's only entry point and the confirmed export set is exactly N-01..N-26, so `registry.ts` carries the contract types and the closure carries the `Map` + kind validation (the N-03 divergence recorded in `INTERFACE-NAME.md`).
- **`EditorCoreStartupError` imports the `DIAGNOSTIC_CODES` value.** Its message derives the missing refs from the single stable code table rather than duplicating the `capability.required-missing` literal.
- **Only the snapshot array is frozen**, matching the plan's `Object.freeze(entries.map(...))` shape; entries are plain `{ kind, id, value, owner }` objects.
- **Kernel tests use a per-file node docblock** instead of touching `vitest.config.ts`, so the Phase-2 React probe keeps jsdom.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `BUILTIN_REQUIRED_CAPABILITIES` deferred to Plan 03-02 to preserve the lint baseline**

- **Found during:** Task 1 (writing `lib/kernel/core.ts`)
- **Issue:** Plan 01's artifacts table and INTERFACE-NAME Section 1 name the module-private `BUILTIN_REQUIRED_CAPABILITIES` as declared in this plan, but Task 1's success path never reads it. Declaring it unused makes `@typescript-eslint/no-unused-vars` emit a warning, moving `pnpm lint` from the Phase-1 baseline of **108 warnings** to 109.
- **Fix:** the constant is not declared here. Plan 03-02's Task 1 action explicitly says "Add a module-private built-in required list … `const BUILTIN_REQUIRED_CAPABILITIES: readonly string[] = Object.freeze([])`" and its acceptance criteria require it, so it will exist and be used by the end of the phase — with no dead binding and no lint regression at any commit. A comment in `core.ts` records the deferral.
- **Files modified:** `packages/libs/editor-core/lib/kernel/core.ts`
- **Verification:** `pnpm lint` → `108 problems (0 errors, 108 warnings)`, exit 0 (baseline preserved).
- **Committed in:** `fe845c4` (Task 1 commit)

**2. [Rule 1 - Lint] `Object.prototype.hasOwnProperty` rejected by `no-prototype-builtins`**

- **Found during:** Task 2 (writing the prototype-pollution case in `capabilityRegistry.test.ts`)
- **Issue:** the direct `Object.prototype.hasOwnProperty('polluted')` call is a `no-prototype-builtins` **error** under the root ESLint config.
- **Fix:** use `Object.hasOwn(Object.prototype, 'polluted')` — same assertion, no rule violation.
- **Files modified:** `packages/libs/editor-core/lib/__tests__/capabilityRegistry.test.ts`
- **Verification:** `pnpm exec eslint` on the file → 0 problems.
- **Committed in:** `8bab29a` (Task 2 commit)

### Plan-level observation (not a defect)

**Task 2 required no change to `core.ts`.** Task 2's `<files>` lists `core.ts`, but Task 1's tracer `<action>` already specified and implemented the full compute-then-commit contract (kind validation, duplicate/replaceable rules, delete-if-still-mine disposers, and the drain). Task 2 therefore committed only its contract test; the plan's two tasks overlap on the registry implementation rather than the second extending it. No behaviour was skipped.

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 lint) + 1 plan-level observation
**Impact on plan:** Both auto-fixes were necessary to satisfy the plan's own plan-level verification (`pnpm lint` at the 108-warning baseline, 0 errors). Neither weakens a gate, changes a confirmed name, nor touches `packages/apps/**`.

## Issues Encountered

- **Root fan-out flake did not occur.** The pre-existing `@motajs/react-monaco-editor` teardown flake (Phase 1 `deferred-items.md` §1/§10) was expected to possibly redden `pnpm test`; the fan-out was green on the **first** attempt (every package `Done`; editor 97 files / 893 tests passed). No retry was needed and nothing was "fixed".
- **Windows console mojibake** on Chinese output is a codepage artifact only; file bytes are correct.

## User Setup Required

None - no external service configuration required.

## Verification evidence (verbatim)

Task 1 `<automated>` (`pnpm --filter @motajs/editor-core typecheck && pnpm --filter @motajs/editor-core exec vitest run lib/__tests__/coreIsolation.test.ts`):

```
$ tsc -b
 ✓ lib/__tests__/coreIsolation.test.ts (2 tests) 4ms
 Test Files  1 passed (1)
      Tests  2 passed (2)
```
→ exit **0**.

Task 2 `<automated>` (`pnpm --filter @motajs/editor-core exec vitest run lib/__tests__/capabilityRegistry.test.ts`):

```
 ✓ lib/__tests__/capabilityRegistry.test.ts (8 tests) 7ms
 Test Files  1 passed (1)
      Tests  8 passed (8)
```
→ exit **0**.

Task 3 `<automated>` (`pnpm --filter @motajs/editor-core exec vitest run lib/__tests__/diagnostics.test.ts`):

```
 ✓ lib/__tests__/diagnostics.test.ts (5 tests) 4ms
 Test Files  1 passed (1)
      Tests  5 passed (5)
```
→ exit **0**.

Plan-level `<verification>`:

1. `pnpm --filter @motajs/editor-core typecheck` → exit **0**
2. `pnpm --filter @motajs/editor-core test` → **4 files / 18 tests passed**, exit **0**
3. `node scripts/verify/coreBoundaries.js` → exit **0**:
   ```
   coreBoundaries: 真实树 cruise 通过（error 违规 0 条，warn 0 条，共 19 个模块、14 条依赖）
   coreBoundaries: core 包内相对边全部解析到 core 内部（16 个 core 模块、7 条相对边）
   coreBoundaries: 全部断言通过（真实树 0 违规、合成违规被拦、PKG-03 负极性 TS2307、editor→core 边方向正确）
   ```
4. `pnpm lint` → `108 problems (0 errors, 108 warnings)` exit **0**; `pnpm format:check` → `All matched files use Prettier code style!` exit **0**
5. `git status --porcelain` → empty; `git status --porcelain -- packages/apps` → empty (D-13 add-only respected)
6. `pnpm test` (root fan-out) → all packages `Done`, exit **0** (editor 97 files / 893 tests passed)

## Known Stubs

| Placeholder | Intent | Owner |
|---|---|---|
| `EditorCoreStartupError` in `lib/kernel/errors.ts` | Declared but never constructed in this plan; Plan 03-02 is the first real construction site (it arms the throw on an unresolved required registration). It is a shipped deliverable, not unfinished work — its shape is fixed now so Plan 03-02 and every future adapter can depend on it. | Plan 03-02 (`coreStartup.test.ts` asserts it). |
| Required-registration resolution + `BUILTIN_REQUIRED_CAPABILITIES` | D-07/D-08's required set and atomic failure path are Plan 03-02's job; this plan deliberately ships the success path plus the drain that Plan 03-02 reuses. | Plan 03-02. |

No hardcoded-empty-value stub, placeholder text, or mock-data component was introduced. Every kernel fixture is an engine-neutral `acme.*` value.

## Threat Flags

None — no security-relevant surface beyond the plan's `<threat_model>` was introduced. T-03-01 is mitigated by the `Map` keying + kind validation + frozen snapshot (asserted by the `__proto__`/`constructor` case); T-03-02 by the unsubscribe-returning `DiagnosticBus.subscribe` (drained via the teardown stack); T-03-03 by `replaceable` defaulting to false and `owner` being diagnostic-only; T-03-11 by append-without-dispatch; T-03-SC by installing nothing (`package.json` untouched).

## Next Phase Readiness

- Ready for **Plan 03-02** (atomic construction + lifecycle): it extends `lib/kernel/core.ts` (required resolution between `install` and the return; the failure path reuses the existing drain) and `lib/kernel/errors.ts`, and adds `coreStartup.test.ts` / `coreLifecycle.test.ts`. The drain, the `disposed`-first discipline, and the `lifecycle.teardown-failed` reporting channel are already in place.
- The kernel modules are not yet re-exported from `lib/index.ts` — that is Plan 03-03, which keeps `scripts/verify/coreExports.js` and `subpathStatus.json` consistent in the same commit.
- `.dependencyCruiser.cjs` already covers all `lib/kernel/*` files (`kernel-must-not-import-capabilities`) and the new modules added only core-internal relative edges — `coreBoundaries.js` is green with no rule change.

---
*Phase: 03-kernel-runtime-ports-registry-diagnostics*
*Completed: 2026-09-23*

## Self-Check: PASSED

- All 7 created files exist on disk: `lib/kernel/{diagnostics,registry,errors,core}.ts` and `lib/__tests__/{coreIsolation,capabilityRegistry,diagnostics}.test.ts`.
- All 3 task commits exist: `fe845c4` (Task 1), `8bab29a` (Task 2), `09f423b` (Task 3).
- `commits` measured from the on-disk ledger `0c2085118ec188017e1f9ee52df6494982de2ed3..HEAD` = **3**, matching `actuals.commits`.
- No file under `packages/apps/**` was modified; `git status --porcelain -- packages/apps` is empty.
