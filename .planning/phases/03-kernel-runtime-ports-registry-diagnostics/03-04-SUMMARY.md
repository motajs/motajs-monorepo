---
phase: 03-kernel-runtime-ports-registry-diagnostics
plan: 04
subsystem: infra
tags: [editor-core, eslint-flat-config, no-restricted-globals, no-restricted-syntax, module-state-gate, port-02, two-polarity-verifier, ci-four-job-contract]

# Dependency graph
requires:
  - phase: 03-kernel-runtime-ports-registry-diagnostics
    provides: 03-01/03-02/03-03's kernel + ports tree under packages/libs/editor-core/lib/** — the tree these two gates police, and the clean baseline that makes "zero new violations" an assertable fact
  - phase: 02-package-boundary-build-scaffolding
    provides: the verifier idiom (Chinese header, failures[], check(), process.exit(1), 全部断言通过), the two-polarity synthetic-fixture technique from coreBoundaries.js, and the four-job CI contract that ci-workflow.js asserts
provides:
  - "eslint.config.js Block A — the core-scoped PORT-02 gate: no-restricted-globals bans fetch/window/document/navigator/localStorage/XMLHttpRequest, no-restricted-properties bans process.env, no-restricted-syntax bans import.meta.env; files-scoped to packages/libs/editor-core/** with NO ignores, so lib/__tests__/** and lib/kernel/core.ts stay covered"
  - "eslint.config.js Block B — the core-scoped module-state gate: four no-restricted-syntax selectors (module-scope let/var, exported module-scope let/var, module-scope const containers, and the import.meta.env selector) with ignores exactly [lib/kernel/core.ts, lib/__tests__/**]"
  - "scripts/verify/coreModuleState.js — the two-polarity verifier: real tree must be error-clean, a synthetic module-scope let/export let/const-container fixture must go red while Object.freeze/ as const stay green, a synthetic PORT-02 fixture must go red line-by-line on every banned construct, and --print-config proves the composition-root/test-dir exemption keeps PORT-02 intact"
  - ".github/workflows/ci.yml — one extra `- run: node scripts/verify/coreModuleState.js` step inside the existing lint job, beside coreBoundaries.js; no new job, no renamed job"
affects: [04-resources (the first real module-state temptation inside core), 05-engine-adapter, 11-cutover (core.ts may legitimately gain module-scope state), 12-interface-freeze]

# Actuals (#2632) — same estimateTokens scale as the plan's `estimate` (chars/4 over the realized diff)
actuals:
  tokens: 5136
  tasks: 2
  commits: 2
  plan_head_before: 82fd87a0d9b23cd325160530dc1300b94c01825c

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two flat-config blocks, never one: flat config REPLACES an array-valued rule's options across matching blocks instead of merging them, so the import.meta.env selector is declared in both blocks and Block B carries the full module-state set. A Chinese comment above each block states the duplication is load-bearing, so a later editor cannot 'tidy' it away"
    - "Deliberate scope asymmetry: the PORT-02 block carries no ignores (a banned global in a test is a real problem, and the composition root must stay covered), while only the module-state block is narrowed by ignores — because one block with one ignores would silently exempt core.ts from PORT-02 as well"
    - "Two-polarity with severity discipline: the real-tree assertion counts only severity === 2 messages, and every synthetic-fixture assertion requires error severity by name. A downgrade of a core rule to 'warn' therefore still produces messages but cannot pass CI — the failure mode where a gate looks alive while `pnpm lint` exits 0"
    - "Prove the exemption structurally, not only by absence: core.ts being lint-clean today does not prove it is exempt (it has no module-scope mutable binding anyway), so the verifier also reads the resolved --print-config for core.ts and for a test file and asserts the module-state selectors are absent while all three PORT-02 rule groups are present at error severity"
    - "Synthetic fixtures live inside try/finally with the deletion asserted afterwards, and are never committed — mirroring coreBoundaries.js's two-polarity technique rather than inventing a new one"
    - "Gate wiring stays inside the existing four CI jobs: an extra `- run:` step in the lint job, re-verified by ci-workflow.js, because JOB_IDS is a required-status-check contract"

key-files:
  created:
    - scripts/verify/coreModuleState.js
  modified:
    - eslint.config.js
    - .github/workflows/ci.yml

key-decisions:
  - "The import.meta.env selector is duplicated in Block A and Block B, and Block B repeats the full module-state selector set, because flat config replaces rather than merges an array-valued rule across matching blocks — the duplication is the mechanism, not an oversight"
  - "Block A (PORT-02) has no ignores: lib/__tests__/** must keep the ban (a banned global in a test is a real problem) and lib/kernel/core.ts must keep it too, since the composition-root exception belongs to the module-state gate alone"
  - "Block B ignores exactly two paths — lib/kernel/core.ts (D-10, the composition root owns the teardown stack and the disposed flag) and lib/__tests__/** (the D-22 refinement: tests legitimately hold module-scope fixture tables, and the gate's purpose is production module state)"
  - "coreModuleState.js counts only severity === 2 for the real tree and demands error severity on both fixtures, so a later downgrade of the new rules to 'warn' cannot make the gate pass while `pnpm lint` still exits 0"
  - "The verifier additionally proves the exemption through --print-config, because the plan's lint-only recording of core.ts would pass even if the ignore list were deleted; the structural assertion is what makes 'exempt from module-state but still covered by PORT-02' a real claim"
  - "The module-state selector set is deliberately left with its documented blind spot (export const x = factory() is not caught by any esquery selector) rather than being papered over — the verifier's header states the gate's scope, and the fixture uses a let, which the gate genuinely catches (RESEARCH Pitfall 1)"
  - "The build+artifact half of the plan's phase regression was executed here rather than deferred: the mota-js submodule is initialized in this checkout, so the editor artifact could be re-measured against the Phase 2 baseline"

patterns-established:
  - "A gate's exemption must be asserted structurally (resolved config), not inferred from the absence of violations — absence is also what a deleted ignore list looks like"
  - "Fixture line numbers are resolved by unique-substring lookup over the fixture's own line array, never hard-coded, so adding a comment line cannot silently mis-aim an assertion"
  - "Synthetic fixtures that must not overlap another gate are written inside a function body, so the PORT-02 probe does not accidentally exercise the module-state selectors"

requirements-completed: [KERN-06, PORT-02]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "PORT-02 is a live core-scoped gate: fetch/window/document/navigator/localStorage/XMLHttpRequest (no-restricted-globals), process.env (no-restricted-properties) and import.meta.env (no-restricted-syntax) are all errors anywhere under packages/libs/editor-core/**, and the ban is core-only so the adapter may still fetch"
    requirement: "PORT-02"
    verification:
      - kind: other
        ref: "node scripts/verify/coreModuleState.js -> exit 0; the synthetic PORT-02 fixture is caught line-by-line for all six globals, for process.env via no-restricted-properties and for import.meta.env via no-restricted-syntax, each at severity 2"
        status: pass
      - kind: other
        ref: "pnpm lint -> exit 0 at 108 problems (0 errors, 108 warnings), unchanged from baseline"
        status: pass
      - kind: other
        ref: "eslint --print-config packages/libs/editor-core/lib/kernel/diagnostics.ts -> no-restricted-globals severity 2 with 6 entries, no-restricted-properties severity 2, no-restricted-syntax severity 2 carrying the env selector"
        status: pass
    human_judgment: false
  - id: D2
    description: "The module-state gate is live over lib/** production source with the composition root excepted: module-scope let/var (bare and exported) and module-scope const containers are errors, while Object.freeze({...}) and {...} as const stay structurally exempt"
    requirement: "KERN-06"
    verification:
      - kind: other
        ref: "node scripts/verify/coreModuleState.js -> exit 0; the synthetic fixture's module-scope let (line 4), export let (line 5) and new Map() container (line 6) are each caught by no-restricted-syntax at severity 2, while the Object.freeze and as-const lines produce zero restricted-rule messages"
        status: pass
      - kind: other
        ref: "negative polarity: temporarily downgrading Block B's no-restricted-syntax to 'warn' made coreModuleState.js exit 1 with the module-state and import.meta.env assertions failing; eslint.config.js was then restored byte-identically (git status clean)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The two selector sets cannot mask each other: lib/kernel/core.ts and lib/__tests__/** resolve without the module-state selectors but with all three PORT-02 rule groups intact, while every other core production file resolves all four module-state selectors plus the env selector"
    requirement: "KERN-06"
    verification:
      - kind: other
        ref: "node scripts/verify/coreModuleState.js -> the --print-config section asserts, for both core.ts and a discovered lib/__tests__/*.test.ts, that the module-state selectors are absent, the env selector is present, and no-restricted-globals (6 entries) / no-restricted-properties are present at severity 2"
        status: pass
    human_judgment: false
  - id: D4
    description: "Both gates run inside the existing four CI jobs, with no new job and no renamed job, and the four-job contract still verifies"
    requirement: "PORT-02"
    verification:
      - kind: other
        ref: "node scripts/verify/ci-workflow.js -> exit 0 (全部断言通过（4 个 job 与工具链固定值一致，无 secrets/environment/paths）); the ci.yml diff is exactly one added `- run: node scripts/verify/coreModuleState.js` line inside the lint job"
        status: pass
      - kind: other
        ref: "node scripts/verify/coreBoundaries.js -> exit 0 with .dependencyCruiser.cjs unmodified"
        status: pass
    human_judgment: false
  - id: D5
    description: "The module-state gate's scope is documented rather than overstated: a module-scope const bound to a factory call (export const x = factory()) is out of scope for any esquery selector, and the verifier's header says so"
    requirement: "KERN-06"
    verification: []
    human_judgment: true
    rationale: "This is a scope/judgment call about whether the documented blind spot is acceptable for the Phase-12 freeze review; no test can assert that a limitation is adequately recorded. The verifier's header states it explicitly and the fixture deliberately uses a construct the gate does catch."

# Metrics
duration: 75min
completed: 2026-09-23
status: complete
---

# Phase 3 Plan 04: The two static gates — PORT-02 and module state Summary

**PORT-02 and the module-state rule are now machine-enforced for `editor-core` only, in two deliberately separate flat-config blocks whose exemptions are proven structurally — and `coreModuleState.js` shows each gate can actually go red, with the real core tree clean, a synthetic module-scope `let`/`export let`/`new Map()` caught at error severity while `Object.freeze`/`as const` stay green, and all eight banned constructs caught line-by-line.**

## Performance

- **Duration:** ~75 min (from the plan base commit `82fd87a` at 2026-09-23T05:32:08Z to SUMMARY write; the figure includes the full phase-gate regression run)
- **Started:** 2026-09-23T05:32:08Z (approximate — the plan base commit; no start timestamp was captured at dispatch)
- **Completed:** 2026-09-23T06:47:29Z
- **Tasks:** 2 / 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- **PORT-02 is a live, core-scoped gate.** Block A bans `fetch`, `window`, `document`, `navigator`, `localStorage`, `XMLHttpRequest` (`no-restricted-globals`), `process.env` (`no-restricted-properties`) and `import.meta.env` (`no-restricted-syntax`) as `error` anywhere under `packages/libs/editor-core/**`. The `import.meta.env` selector is not redundant: `no-restricted-properties` cannot match a `MetaProperty`, a miss proven by the research's executed probe. Because the block is scoped to core, the adapter may still use `fetch` (D-15).
- **The module-state gate is live over production source with exactly one production exception.** Block B carries four `no-restricted-syntax` selectors and `ignores: ['packages/libs/editor-core/lib/kernel/core.ts', 'packages/libs/editor-core/lib/__tests__/**']` — the composition root (D-10) plus the D-22 refinement. `Object.freeze({...})` and `{...} as const` are structurally exempt through the `>` child combinator, and the verifier asserts that exemption rather than assuming it.
- **The two gates cannot mask each other.** Block A has no `ignores`; Block B has two. One block with one `ignores` would have silently dropped the PORT-02 ban for `core.ts` — the failure the plan's `key_links` calls out. A Chinese comment above each block explains that the `import.meta.env` duplication is load-bearing, because flat config *replaces* an array-valued rule across matching blocks instead of merging it.
- **The verifier proves both gates can fail, and does so with severity discipline.** `scripts/verify/coreModuleState.js` lints the real `lib/**` tree and counts only `severity === 2` messages, then writes two synthetic fixtures — one with a module-scope `let`, an `export let` and a module-scope `new Map()`, one with one use of each of the eight banned constructs — and requires each to be caught by name *at error severity*. Every module-state message observed must be error severity, so a later downgrade to `'warn'` cannot pass while `pnpm lint` still exits 0. Both fixtures are written and deleted inside `try`/`finally`, and their absence is asserted afterwards.
- **The exemption is proven structurally, not by absence.** `core.ts` is lint-clean today only because it holds no module-scope mutable binding — so a lint-only check would keep passing even if the `ignores` entry were deleted. The verifier therefore also reads the resolved `--print-config` for `core.ts` and for a discovered `lib/__tests__/*.test.ts` and asserts the module-state selectors are absent while `no-restricted-globals` (6 entries), `no-restricted-properties` and the env selector remain at error severity.
- **Both gates run inside the existing four CI jobs.** Exactly one `- run: node scripts/verify/coreModuleState.js` step was added to the `lint` job beside `coreBoundaries.js`; `ci-workflow.js` and `coreBoundaries.js` both stay green, and `.dependencyCruiser.cjs` is untouched.
- **The real core tree needed no suppression.** Zero new lint problems: `pnpm lint` is still `108 problems (0 errors, 108 warnings)`, no `eslint-disable` comment was added anywhere, and no existing rule or `ignores` entry was relaxed.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the core-scoped ESLint override — PORT-02 bans and the module-state selectors in separate blocks** - `01a093b` (feat)
2. **Task 2: Prove both gates can fail — the two-polarity verifier and its CI step** - `6f9a2a0` (test)

**Plan metadata:** (this SUMMARY commit) (docs: complete plan)

_Note: no TDD tasks; each task is a single commit. `plan_head_before` = `82fd87a0d9b23cd325160530dc1300b94c01825c`; `commits` measured = 2._

## Files Created/Modified

- `eslint.config.js` - two appended core-scoped flat-config blocks: `corePort02Config` (6 `no-restricted-globals`, one `no-restricted-properties`, one `no-restricted-syntax`, no `ignores`) and `coreModuleStateConfig` (4 `no-restricted-syntax` selectors, `ignores` = `lib/kernel/core.ts` + `lib/__tests__/**`), each with a Chinese comment stating why the duplication must not be merged
- `scripts/verify/coreModuleState.js` - the two-polarity verifier: real-tree error-clean check, module-state fixture (red on `let`/`export let`/`new Map()`, green on `Object.freeze`/`as const`), PORT-02 fixture (line-by-line red on all eight constructs), `core.ts` lint-clean check, and `--print-config` structural exemption proof; both fixtures created and deleted in `try`/`finally` with an existence assertion
- `.github/workflows/ci.yml` - one added step in the existing `lint` job, immediately after `node scripts/verify/coreBoundaries.js`

## Decisions Made

- **Two blocks, and the `import.meta.env` selector in both.** Flat config does not merge an array-valued rule across matching blocks — the later block's options replace the earlier one's. Declaring the env selector only in Block A would have dropped it for every core file except `core.ts`, because those files match Block B too.
- **Scope asymmetry is intentional.** Block A carries no `ignores` (tests and the composition root keep the PORT-02 ban); only Block B is narrowed.
- **Severity is part of the assertion, not an afterthought.** Both the real-tree count and both fixtures key on `severity === 2`, because a downgraded rule still emits messages while `pnpm lint` exits 0.
- **The exemption is asserted structurally via `--print-config`.** A lint-only recording of `core.ts` would pass even with the ignore list deleted.
- **The gate's blind spot is documented, not papered over.** `export const x = factory()` is outside what any esquery selector can catch (RESEARCH Pitfall 1); the verifier's header states the gate's scope and the fixture uses a construct the gate genuinely catches.
- **The plan's phase regression was executed here.** The mota-js submodule is initialized in this checkout, so `pnpm build` + `editorArtifactAssets.js` could be run rather than deferred — the artifact still matches the Phase 2 baseline exactly (57 files, raw 16.80 MiB).

## Deviations from Plan

None auto-fixed — no Rule 1/2/3/4 deviation occurred. One deliberate **additive** assertion beyond the plan's literal wording is recorded here for transparency:

**1. [Addition, not an auto-fix] `--print-config` structural assertion added to `coreModuleState.js`**

- **Found during:** Task 2 (the two-polarity verifier)
- **Why:** The plan's action says the script records the composition-root exemption "by asserting `core.ts` emits no restricted-rule message at all on the current tree". That assertion is satisfied vacuously today: `core.ts` contains no module-scope mutable binding (its `KIND_PATTERN` is a regex literal and `BUILTIN_REQUIRED_CAPABILITIES` is `Object.freeze([])`), so it would stay clean even if the `ignores` entry were deleted. The plan's own requirement — "assert that `packages/libs/editor-core/lib/kernel/core.ts` is exempt from the module-state selectors **while still covered by PORT-02**" — needs the resolved configuration to be inspected.
- **What was added:** a section that reads `eslint --print-config` for `core.ts` and for a discovered `lib/__tests__/*.test.ts`, asserting the module-state selectors are absent, the env selector is present, and `no-restricted-globals` (exactly 6 entries) / `no-restricted-properties` are present at severity 2. The plan-specified lint assertion on `core.ts` is kept as well.
- **Files modified:** `scripts/verify/coreModuleState.js` (same file as the task, same commit)
- **Verification:** the assertion passes on the current tree, and the negative-polarity run (Block B downgraded to `warn`) showed the verifier failing as designed; `eslint.config.js` was restored byte-identically (`git status --short` empty afterwards).
- **Committed in:** `6f9a2a0` (Task 2 commit)

---

**Total deviations:** 0 auto-fixed; 1 additive assertion documented above
**Impact on plan:** No gate was weakened, no selector removed, no severity downgraded, no `ignores` entry added beyond the two named in the plan, and no file under `packages/apps/**` was touched (D-13 add-only).

## Issues Encountered

- **Pre-existing `@motajs/react-monaco-editor` teardown flake reddened the root `pnpm test` fan-out.** Two runs both failed with `Vitest caught 2 unhandled errors` — `Error: [vitest-worker]: Closing rpc while "fetch" was pending`, originating from `lib/modelScope.test.ts` while loading `monaco-editor/esm/vs/languages/definitions/javascript/javascript.js`. All 6 tests pass and the package reports `2 passed (2)` / `6 passed (6)` / `2 errors`. Run in isolation the package is **clean**, so the flake is load-dependent (it only reproduces under the recursive fan-out's parallel workers) — exactly the pre-existing, out-of-scope item recorded in Phase 1's `deferred-items.md`. Not fixed here.
- **`packages/libs/packer` showed `Failed` in the fan-out but is not a real failure.** pnpm's `ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL` killed the still-running packer integration test mid-flight (its log ends after `======> 所有资源文件已打包` with no test summary). Run in isolation: **9 files / 94 tests passed**, clean. Collateral from the fail-fast above.
- **No new lint findings.** The expectation held: the kernel was written to comply, so `pnpm lint` is unchanged at 108 problems (0 errors, 108 warnings) and no core file had to be suppressed.
- **Shell was cmd.exe, not bash.** The GSD ledger/sentinel snippets were adapted to Windows syntax; the ledger file `.git/gsd-plan-head-before-03-04` was written with `echo`/`if not exist` and the commit count measured from it.

## User Setup Required

None - no external service configuration required.

## Verification evidence (verbatim)

Task 1 `<automated>` (`pnpm exec prettier --check eslint.config.js && pnpm lint && node scripts/verify/lint-severities.js`):

```
Checking formatting...
All matched files use Prettier code style!
✖ 108 problems (0 errors, 108 warnings)
  0 errors and 40 warnings potentially fixable with the `--fix` option.
lint-severities: 扫描到 45 条 eslint-disable 注释，全部携带理由
lint-severities: 全部断言通过
```
→ exit **0** (baseline before Task 1 was also `108 problems (0 errors, 108 warnings)`).

Task 1 `--print-config` scoping evidence:

```
--- packages/libs/editor-core/lib/kernel/diagnostics.ts
  no-restricted-syntax: 2
  selectors: Program > VariableDeclaration[kind=/^(let|var)$/] | Program > ExportNamedDeclaration > VariableDeclaration[kind=/^(let|var)$/] | :matches(...)[kind="const"] > VariableDeclarator > :matches(NewExpression[callee.name=/^(Map|Set|WeakMap|WeakSet)$/], ArrayExpression, ObjectExpression) | MemberExpression[object.type="MetaProperty"][property.name="env"]
  globals: 2 count= 6
  properties: 2
--- packages/libs/editor-core/lib/kernel/core.ts
  no-restricted-syntax: 2
  selectors: MemberExpression[object.type="MetaProperty"][property.name="env"]
  globals: 2 count= 6
  properties: 2
--- packages/libs/editor-core/lib/__tests__/coreIsolation.test.ts
  no-restricted-syntax: 2
  selectors: MemberExpression[object.type="MetaProperty"][property.name="env"]
  globals: 2 count= 6
  properties: 2
```

Task 2 `<automated>` (`node scripts/verify/coreModuleState.js && node scripts/verify/ci-workflow.js && node scripts/verify/coreBoundaries.js && pnpm exec prettier --check scripts/verify/coreModuleState.js eslint.config.js && pnpm lint`):

```
coreModuleState: 真实树 lint 通过（24 个文件，受限规则 error 级 0 条，受限规则任意级别 0 条）
coreModuleState: 组合根 packages/libs/editor-core/lib/kernel/core.ts 在真实树上 0 条受限规则消息
coreModuleState: 模块状态门禁可失败（模块级 let / export let / const 容器各被 error 级拦下；Object.freeze 与 as const 结构性豁免）
coreModuleState: PORT-02 门禁可失败（六条被禁全局逐行命中，process.env 与 import.meta.env 各被 error 级拦下）
coreModuleState: packages/libs/editor-core/lib/kernel/core.ts 与 packages/libs/editor-core/lib/__tests__/capabilityRegistry.test.ts 的解析后配置只保留 PORT-02 规则，module-state 选择器被正确豁免
coreModuleState: 全部断言通过（真实树 0 条 error 级受限规则、模块级 let/export let/const 容器各被拦下、Object.freeze 与 as const 结构性豁免、六条被禁全局逐行命中、process.env 与 import.meta.env 各被拦下、core.ts 与 lib/__tests__/** 的 module-state 豁免与 PORT-02 覆盖面均成立）
ci-workflow: 全部断言通过（4 个 job 与工具链固定值一致，无 secrets/environment/paths）
coreBoundaries: 真实树 cruise 通过（error 违规 0 条，warn 0 条，共 27 个模块、27 条依赖）
coreBoundaries: core 包内相对边全部解析到 core 内部（24 个 core 模块、17 条相对边）
coreBoundaries: 全部断言通过（真实树 0 违规、合成违规被拦、PKG-03 负极性 TS2307、editor→core 边方向正确）
Checking formatting...
All matched files use Prettier code style!
✖ 108 problems (0 errors, 108 warnings)
```
→ exit **0**. (The `DEP0190` deprecation warning printed by `coreBoundaries.js` comes from its own `shell: true` spawn — pre-existing, not introduced here.)

Task 2 negative polarity (Block B's `no-restricted-syntax` temporarily downgraded to `'warn'`, then restored):

```
restored: true
verifier exit: 1
coreModuleState: 模块状态 fixture 未产生 error 级 no-restricted-syntax 消息：no-restricted-syntax@4:sev1 | no-restricted-syntax@5:sev1 | no-restricted-syntax@6:sev1
coreModuleState: 模块状态 fixture 上有 3 条非 error 级受限规则消息（严重度被下调）：...
coreModuleState: 模块级 let 绑定（第 4 行）未被 no-restricted-syntax 以 error 级命中：...
coreModuleState: PORT-02 fixture 上有 1 条非 error 级受限规则消息（严重度被下调）：no-restricted-syntax@12:sev1
coreModuleState: import.meta.env（第 12 行）未被 no-restricted-syntax 以 error 级命中：...
```
→ verifier exit **1**; `eslint.config.js` restored byte-identically and `git status --short` afterwards listed only the untracked new script.

Both fixtures cleaned up: `__moduleStateProbe__.ts` and `__port02Probe__.ts` are absent after every run (`git status --short` lists neither).

Plan-level `<verification>`:

1. `node scripts/verify/coreModuleState.js` → exit **0**, printing the `全部断言通过` line
2. `node scripts/verify/ci-workflow.js` → exit **0** — still exactly four jobs, each still calling its root fan-out script
3. `node scripts/verify/coreBoundaries.js` → exit **0**, `.dependencyCruiser.cjs` unmodified
4. `pnpm lint` → `108 problems (0 errors, 108 warnings)` exit **0**; `pnpm exec prettier --check scripts/verify/coreModuleState.js eslint.config.js` → `All matched files use Prettier code style!` exit **0**
5. Whole-phase regression (executed here because the mota-js submodule is initialized):
   - `pnpm --filter @motajs/editor exec panda codegen` → then `pnpm build` → exit **0**; editor build reported `Editor artifact: 57 files, raw 16.80 MiB, gzip 4.29 MiB, brotli 3.58 MiB` — **exactly the Phase 2 baseline**, and the service-worker build succeeded (`✓ built in 1m 36s`)
   - `node scripts/verify/editorArtifactAssets.js` → `全部断言通过（5 个产物样式表无 url(@/、3 个 Vite bundle 中的 2 个 url() 目标均可解析、FiraCode 字体已产出）` exit **0**
   - `pnpm typecheck` → exit **0**, no diagnostics
   - `pnpm test` → fan-out reddened twice on the pre-existing `@motajs/react-monaco-editor` teardown flake (see Issues); every package's own summary is green — `file2x 1/14`, `h5animate 8/202`, `editor-core 7/34`, `react-hooks 2/3`, `react-store 1/3`, `service-worker 8/44`, `react-monaco-editor 2/6 (2 unhandled errors)`, `packer 9/94` (verified in isolation, clean)
   - `git status --porcelain` → empty; `git status --porcelain -- packages/apps` → empty (D-13 add-only respected)

## Known Stubs

None — no hardcoded empty value, placeholder text, unwired data source, skipped test, or `TODO`/`FIXME` was introduced by this plan. `scripts/verify/coreModuleState.js` and `eslint.config.js` contain no stub marker (scanned for `TODO`/`FIXME`/`placeholder`/`coming soon`/`not available`).

**Documented gate scope (not a stub — a stated limitation):** the module-state selectors match node *kinds* and *shapes*, so `export const registry = createRegistry()` (a factory-call binding) is **not** caught. This is stated in `coreModuleState.js`'s header and in `03-RESEARCH.md` Pitfall 1, and the synthetic fixture deliberately uses a module-scope `let` — a construct the gate genuinely catches — rather than a fixture that only "looks" caught. If a stronger guarantee is needed later, the research's recommendation is a second, custom AST verifier rather than weakening this one.

## Threat Flags

None — no security-relevant surface beyond the plan's `<threat_model>` was introduced. T-03-06 (a gate bypassed by removing a selector, downgrading a severity, adding an ignore, or editing the verifier to pass vacuously) is mitigated by the severity-keyed two-polarity proof plus the `--print-config` exemption assertion plus `lint-severities.js` still requiring a reason on every `eslint-disable`; T-03-07 by exactly one added `- run:` step inside the existing `lint` job with `ci-workflow.js` re-run green and no `submodules: recursive` added; T-03-12 by both fixtures being removed in `finally` with the removal asserted; T-03-SC by installing nothing (no `package.json` change).

## Next Phase Readiness

- Phase 3's four plans are complete. Both new gates are provably live, wired into the existing four CI jobs, and the whole-phase regression is green — including the editor artifact still measuring **57 files / raw 16.80 MiB**, identical to the Phase 2 baseline.
- Ready for `/gsd-verify-work` on Phase 3. The two manual-only items from `03-VALIDATION.md` remain for the human: the editor behaving identically at runtime (no app code changed, so only a run-and-look check is meaningful), and a read of `lib/kernel/**` + `lib/ports/**` to confirm the design stayed engine-agnostic.
- Phase 4 (resources) is the first phase that will tempt module-scope state into core; the gate now catches `let`/`var`/`Map`/`Set`/array/object literals at module scope, and `lib/kernel/core.ts` remains the single sanctioned exception.
- Pre-existing, out of scope: the `@motajs/react-monaco-editor` teardown flake (load-dependent, all tests pass) still makes the root `pnpm test` fan-out nondeterministic under parallel workers.

---
*Phase: 03-kernel-runtime-ports-registry-diagnostics*
*Completed: 2026-09-23*

## Self-Check: PASSED

- Created file exists on disk: `scripts/verify/coreModuleState.js`.
- Both modified files are tracked and changed: `eslint.config.js`, `.github/workflows/ci.yml`.
- Both task commits exist: `01a093b` (Task 1), `6f9a2a0` (Task 2).
- `commits` measured from the on-disk ledger `82fd87a0d9b23cd325160530dc1300b94c01825c..HEAD` = **2**, matching `actuals.commits`.
- Both synthetic fixtures are absent after every verifier run; neither is tracked.
- No file under `packages/apps/**` was modified; `git status --porcelain -- packages/apps` is empty.
