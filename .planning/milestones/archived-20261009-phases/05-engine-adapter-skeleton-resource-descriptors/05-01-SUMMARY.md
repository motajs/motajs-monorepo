---
phase: 05-engine-adapter-skeleton-resource-descriptors
plan: 01
subsystem: api
tags: [editor-core, engine-adapter, resource-descriptor, defineEngine, validation, tdd, port-03, port-04]

# Dependency graph
requires:
  - phase: 03-kernel-runtime-ports-registry-diagnostics
    provides: minimal `EngineAdapter` (id + apiVersion), DIAGNOSTIC_CODES (exactly five), aggregated-error precedent (`EditorCoreStartupError`)
  - phase: 04-resource-edit-layers-moved
    provides: `ResourceRegistry` (RES-02) with its logical-id grammar, `ResourceView`/`LoadableResource`, `computedResource`, `FileHandlerManager`, MEMORY-FsPort test double
provides:
  - "Generic, source-agnostic `ResourceDescriptor<T>` (id, create(deps), preload?, preloadDependsOn?) with no path/format/handler member"
  - "`defineEngine(description)` — pure, side-effect-free, aggregated (all-problems-at-once) validation returning a frozen `EngineAdapter`"
  - "`EngineDefinitionError` — the sole aggregated error, carrying the frozen problem list via `Error.cause`"
  - "`resolvePreloadOrder(resources)` — pure, stable, deterministic topological ordering of descriptor ids"
  - "`isValidResourceId` shared predicate exported from `resourceRegistry.ts` and re-exported from `ports/engine.ts`, so `defineEngine` and `ResourceRegistry` share ONE grammar (D-09)"
  - "`ENGINE_ADAPTER_API_VERSION` and the root-`.` barrel exports for all new names"
affects: [05-02, 05-03, 05-04, 11]

# Actuals — chars/4 over the realized diff (base 47b72b1..HEAD)
actuals:
  tokens: 3670
  tasks: 3
  commits: 5        # measured: git rev-list --count 47b72b1..HEAD at SUMMARY write (5 atomic task commits)
plan_head_before: 47b72b166b5943ff2b676e2b3bd94b276fe36246

tech-stack:
  added: []
  patterns:
    - "Pure definition-time validator: collect ALL problems, throw ONE aggregated error (`EngineDefinitionError`), mirroring `EditorCoreStartupError`"
    - "Single shared grammar home: one exported `isValidResourceId` predicate used by both definition (`defineEngine`) and registration (`ResourceRegistry.register`)"
    - "Aggregate payload carried through standard `Error.cause` to avoid landing an unlisted public member name (naming gate) and to satisfy `noUnusedLocals`"
    - "Deterministic, stable topological order via earliest-declared-placeable selection (no module-level mutable state)"

key-files:
  created:
    - packages/libs/editor-core/lib/__tests__/engineContract.test.ts
  modified:
    - packages/libs/editor-core/lib/ports/engine.ts
    - packages/libs/editor-core/lib/resources/resourceRegistry.ts
    - packages/libs/editor-core/lib/index.ts
    - packages/libs/editor-core/lib/__tests__/coreApiSurface.test.ts

key-decisions:
  - "ENGINE_ADAPTER_API_VERSION = '0.1.0', separate from EDITOR_CORE_API_VERSION (adapter contract and core API run on different clocks)"
  - "EngineAdapter.resources is REQUIRED (no production implementer exists; an adapter with no resources describes nothing)"
  - "Engine id is validated as non-empty only (NOT against the logical-id grammar), because 05-04 declares the mota engine id as `mota-js`, which the registry grammar (no hyphens) would reject"
  - "EngineDefinitionError carries its frozen problem list through `Error.cause` — no new public member name is invented beyond the confirmed INTERFACE-NAME surface"
  - "The frozen problem list is NOT exposed as a public field: INTERFACE-NAME.md does not enumerate an `EngineDefinitionError` member name, and an unread private field fails the editor build's `noUnusedLocals`"

patterns-established:
  - "Definition-time validation is pure: no registration, no bus, no module-level mutable binding; repeated/concurrent calls share no state"
  - "Two grammar consumers, one predicate: `assertValidLogicalId` delegates to `isValidResourceId` while preserving its exact throw messages"

requirements-completed: [PORT-03, PORT-04]

# Coverage metadata — one entry per shipped deliverable.
coverage:
  - id: D1
    description: "Generic source-agnostic adapter contract: `ResourceDescriptor<T>`, `ResourceDependencies`, `PreloadStrategy`, `EngineDescription`, widened `EngineAdapter` (resources required), and `ENGINE_ADAPTER_API_VERSION`"
    requirement: PORT-04
    verification:
      - kind: unit
        ref: "packages/libs/editor-core/lib/__tests__/coreApiSurface.test.ts#Phase 5 适配器契约的类型名都从根 `.` 解析（编译期断言）"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-core/lib/__tests__/engineContract.test.ts#把一份描述构造成冻结的适配器，资源按声明顺序排列"
        status: pass
      - kind: other
        ref: "pnpm --filter @motajs/editor-core typecheck && pnpm typecheck"
        status: pass
    human_judgment: false
  - id: D2
    description: "`defineEngine` aggregated validation (seven rules) throwing one `EngineDefinitionError` that carries every problem at once; no coupling to the diagnostic bus"
    requirement: PORT-03
    verification:
      - kind: unit
        ref: "packages/libs/editor-core/lib/__tests__/engineContract.test.ts#两处问题（重复 id + 非函数 create）只抛一次且同时携带"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-core/lib/__tests__/engineContract.test.ts#依赖环抛出并点名闭环涉及的每一个 id"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-core/lib/__tests__/engineContract.test.ts#悬空的 preloadDependsOn 抛出并点名该目标 id"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-core/lib/__tests__/coreApiSurface.test.ts#DIAGNOSTIC_CODES 恰好是五个稳定机器码"
        status: pass
    human_judgment: false
  - id: D3
    description: "`resolvePreloadOrder(resources)` — pure, stable, deterministic topological order (dependencies before dependents)"
    requirement: PORT-03
    verification:
      - kind: unit
        ref: "packages/libs/editor-core/lib/__tests__/engineContract.test.ts#把依赖排在依赖者之前，且跨调用稳定"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-core/lib/__tests__/engineContract.test.ts#多级依赖按拓扑序排列（catalog → index → chapter）"
        status: pass
    human_judgment: false
  - id: D4
    description: "Shared `isValidResourceId` predicate keeps `defineEngine` and `ResourceRegistry` on one logical-id grammar (D-09); `assertValidLogicalId` delegates without changing its messages"
    requirement: PORT-04
    verification:
      - kind: unit
        ref: "packages/libs/editor-core/lib/resources/__tests__/resourceRegistry.test.ts#非法 id 逐个被拒，注册表保持为空且 Object.prototype 未被污染（T-04-01）"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-core/lib/__tests__/engineContract.test.ts#非法描述符 id 抛出 EngineDefinitionError 并点名该 id"
        status: pass
    human_judgment: false
  - id: D5
    description: "Root `.` barrel re-exports the five new values (`defineEngine`, `isValidResourceId`, `resolvePreloadOrder`, `ENGINE_ADAPTER_API_VERSION`, `EngineDefinitionError`) and four new types; `scripts/verify/coreExports.js` + `subpathStatus.json` untouched"
    verification:
      - kind: unit
        ref: "packages/libs/editor-core/lib/__tests__/coreApiSurface.test.ts#Phase 5 适配器契约的值都从根 `.` 导出（值面）"
        status: pass
      - kind: other
        ref: "node scripts/verify/coreExports.js"
        status: pass
    human_judgment: false
  - id: D6
    description: "Pre-execution naming gate: `INTERFACE-NAME.md` (four Plan sections, every important name + purpose, status CONFIRMED) and reasoned `COVERAGE.md` (no external API integration) verified before any source edit"
    verification:
      - kind: automated_ui
        ref: "node -e naming-gate cross-check over INTERFACE-NAME.md + COVERAGE.md (Task 1 automated verify)"
        status: pass
    human_judgment: false

duration: 17min
completed: 2026-09-28
status: complete
---

# Phase 5 Plan 01: Core adapter contract (`defineEngine`) Summary

**A pure, source-agnostic engine-adapter contract in `@motajs/editor-core`: generic `ResourceDescriptor<T>`, an aggregated seven-rule `defineEngine` returning a frozen `EngineAdapter`, a shared `isValidResourceId` grammar predicate, and a stable `resolvePreloadOrder` helper — all machine-asserted from the root `.` barrel with `DIAGNOSTIC_CODES` still exactly five.**

## Performance

- **Duration:** ~17 min
- **Started:** 2026-09-28T10:34:41Z
- **Completed:** 2026-09-28T10:51:58Z
- **Tasks:** 3
- **Files modified:** 5 (4 modified, 1 created)

## Accomplishments

- `defineEngine(description)` validates a whole `EngineDescription` at once — engine id non-empty, descriptor ids via the shared grammar, id uniqueness, `create` is a function, dangling `preloadDependsOn`, acyclic dependency graph, legal `preload` literal, non-empty `apiVersion` — and throws ONE `EngineDefinitionError` carrying every problem; it registers nothing, touches no bus, and has no module-level mutable binding.
- `ResourceDescriptor<T>` carries exactly `id`, `create(deps)`, `preload?`, `preloadDependsOn?` — no `path`, no `format`, no handler instance — so core never assumes content originates from a file (D-04/D-05).
- `EngineAdapter` explicitly evolves to require `resources` (D-03), and `resolvePreloadOrder` returns a pure, stable, deterministic topological order.
- The logical-id grammar lives in one place: `isValidResourceId` is defined in `resourceRegistry.ts`, re-exported by `ports/engine.ts`, and both `defineEngine` and `ResourceRegistry.register` use it (D-09) — the two gates cannot drift.
- The root `.` barrel re-exports the five new values and four new types; `DIAGNOSTIC_CODES` remains exactly five; `coreModuleState`, `coreExports`, `lint`, and `format` (for touched files) stay green.

## Task Commits

Each task was committed atomically. The two `tdd="true"` tasks produced RED → GREEN pairs:

1. **Task 1: Verify the pre-authored naming gate and COVERAGE.md** - (no commit; verification-only, zero file changes — planning artifacts were already committed in `47b72b1`)
2. **Task 2 (tracer, TDD): End-to-end `defineEngine` on one descriptor** - `0ebf9ab` (test, RED) → `7ca98cc` (feat, GREEN)
3. **Task 3 (TDD): Aggregated validation + `resolvePreloadOrder` + full contract tests** - `8c9f3ae` (test, RED) → `a3a755a` (feat, GREEN) → `bd23c22` (fix, `noUnusedLocals`/`Error.cause`)

**Plan metadata:** `75fb12f` (docs(05-01): complete core adapter contract plan)

_Note: TDD tasks produce multiple commits (test → feat → [refactor/fix])._

## Files Created/Modified

- `packages/libs/editor-core/lib/ports/engine.ts` (modified) — the adapter contract: `ResourceDescriptor`, `ResourceDependencies`, `PreloadStrategy`, `EngineDescription`, widened `EngineAdapter`, `defineEngine`, `EngineDefinitionError`, `resolvePreloadOrder`, `ENGINE_ADAPTER_API_VERSION`, and the re-exported `isValidResourceId`.
- `packages/libs/editor-core/lib/resources/resourceRegistry.ts` (modified) — exported `isValidResourceId`; `assertValidLogicalId` now delegates to it, keeping its throw messages byte-unchanged.
- `packages/libs/editor-core/lib/index.ts` (modified) — six new named re-exports from `./ports/engine` (five values + the widened types), all named (no `export *`).
- `packages/libs/editor-core/lib/__tests__/engineContract.test.ts` (created) — descriptor→adapter→`create(deps)`→`ResourceRegistry` round-trip; aggregated two-problem rejection; dangling dep; cycle; invalid `preload`; empty `apiVersion`; `resolvePreloadOrder` ordering/stability.
- `packages/libs/editor-core/lib/__tests__/coreApiSurface.test.ts` (modified) — runtime value assertions for the five new values and compile-time `expectTypeOf` assertions for the four new types; the `DIAGNOSTIC_CODES` exact-five assertion is byte-identical.

## Decisions Made

- **`ENGINE_ADAPTER_API_VERSION = '0.1.0'`** kept separate from `EDITOR_CORE_API_VERSION` (Pattern 2): the adapter contract and the core public API are two contracts on two clocks; Phase 12 freezes the extension surface.
- **`EngineAdapter.resources` is required**, not optional: there are no production implementers and an adapter with no resources describes nothing.
- **Engine id is validated only as non-empty**, not against the logical-id grammar — see Deviation 1.
- **The frozen problem list is carried via standard `Error.cause`** rather than a new public member — see Deviation 2.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Engine id cannot be validated with `isValidResourceId` (Task 2 prose vs. Phase coherence)**
- **Found during:** Task 2 (GREEN implementation), cross-checked against `05-04-PLAN.md`.
- **Issue:** Task 2's `<action>` said "the engine `id` … pass `isValidResourceId`", but 05-04 declares `defineEngine({ id: 'mota-js', … })` and INTERFACE-NAME.md (CONFIRMED) fixes the mota engine id as `mota-js`. `isValidResourceId` uses `LOGICAL_ID_PATTERN`, which forbids hyphens, so a literal Task 2 reading would make the mota engine un-definable and break plan 05-04.
- **Fix:** Engine id validated as non-empty only; descriptor ids validated with `isValidResourceId`. This matches Task 3 rule (1), RESEARCH §Pattern 1 rule (1), and the `must_haves.truths` wording ("validates every descriptor id …").
- **Files modified:** `packages/libs/editor-core/lib/ports/engine.ts`
- **Verification:** `engineContract.test.ts` (engineB + mota-style id accepted); full `pnpm typecheck` green.
- **Committed in:** `7ca98cc` (Task 2 GREEN).

**2. [Rule 1 - Bug] Unread private `problems` field failed the editor build (`noUnusedLocals`)**
- **Found during:** plan-level `pnpm typecheck` (full workspace) after Task 3.
- **Issue:** `EngineDefinitionError` stored the frozen list in a `private readonly problems` field that was never read. Core's own `tsc -b` passed (no `noUnusedLocals`), but the editor project compiles core source with `noUnusedLocals: true` and printed `error TS6133: 'problems' is declared but its value is never read` — which is also 05-04's own `pnpm --filter @motajs/editor typecheck` gate.
- **Fix:** Carry the frozen list through the standard `Error.cause` (`super(message, { cause: Object.freeze([...problems]) })`), removing the field. This preserves the "carries the frozen list" requirement while adding no member name that is not in INTERFACE-NAME.md (naming gate) and satisfying `noUnusedLocals`.
- **Files modified:** `packages/libs/editor-core/lib/ports/engine.ts`
- **Verification:** full `pnpm typecheck` green; `engineContract.test.ts` still asserts `.message` carries all problems; `coreModuleState` and `lint` green.
- **Committed in:** `bd23c22`.

**3. [Rule 3 - Blocking] Prettier formatting errors in touched files red-lit `pnpm lint`**
- **Found during:** Task 3's second `<verify>` (`node scripts/verify/coreModuleState.js && pnpm lint`).
- **Issue:** Three `prettier/prettier` errors (two line-wrap decisions in the new test/engine code, one in the type-export block of `lib/index.ts`) made `pnpm lint` exit 1.
- **Fix:** Ran Prettier on the touched files; re-ran `pnpm lint` to 0 errors.
- **Files modified:** `lib/index.ts`, `lib/ports/engine.ts`, `lib/__tests__/engineContract.test.ts`, `lib/__tests__/coreApiSurface.test.ts`
- **Verification:** `pnpm lint` exit 0 (only pre-existing warnings remain).
- **Committed in:** included in `a3a755a` (Task 3 GREEN) and confirmed by the `bd23c22` re-run.

---

**Total deviations:** 3 auto-fixed (2 Rule 1 bugs, 1 Rule 3 blocking)
**Impact on plan:** All three were necessary for correctness/coherence; none added scope. Deviation 1 prevents a cross-plan contradiction that would have broken 05-04; deviation 2 keeps the contract gate-compatible with the editor build.

## Issues Encountered

- The naming gate (`INTERFACE-NAME.md`, user-confirmed) enumerates no `EngineDefinitionError` member name, and the plan requires the error to carry the frozen problem list. Resolved by carrying it via the standard `Error.cause` — data preserved, no unlisted name landed. If the user later wants an explicit public accessor, it must be added to `INTERFACE-NAME.md` and confirmed first.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The adapter contract every engine must conform to now exists and is machine-asserted from the package's only importable surface. Plans 05-02, 05-03, and 05-04 build directly on it.
- 05-03's engine-B fixture and 05-04's mota adapter (`id: 'mota-js'`) are both unblocked by the non-empty engine-id decision.
- No new runtime dependency was added; `DIAGNOSTIC_CODES` is still exactly five; `coreModuleState` / `coreExports` / `lint` are green; full workspace `pnpm typecheck` and the full core test suite (171 tests) are green.
- One note for later: `.gsd/dispatch-isolation-sentinel.json` (untracked GSD runtime artifact) makes repo-wide `pnpm format:check` red; it is not part of this repo's tracked sources and is out of this plan's scope.

---
*Phase: 05-engine-adapter-skeleton-resource-descriptors*
*Completed: 2026-09-28*

## Self-Check: PASSED

- All promised artifacts exist: `ports/engine.ts`, `resources/resourceRegistry.ts`, `lib/index.ts`, `lib/__tests__/engineContract.test.ts`, `lib/__tests__/coreApiSurface.test.ts`, `05-01-SUMMARY.md`, `INTERFACE-NAME.md`, `COVERAGE.md`.
- All task commits exist: `0ebf9ab`, `7ca98cc`, `8c9f3ae`, `a3a755a`, `bd23c22`.
