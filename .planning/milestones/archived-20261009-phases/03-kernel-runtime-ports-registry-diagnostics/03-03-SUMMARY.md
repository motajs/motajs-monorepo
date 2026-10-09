---
phase: 03-kernel-runtime-ports-registry-diagnostics
plan: 03
subsystem: infra
tags: [editor-core, ports, public-surface, barrel, manifest-verifier-coupling, engine-agnostic, vitest, vitest-node-env]

# Dependency graph
requires:
  - phase: 03-kernel-runtime-ports-registry-diagnostics
    provides: 03-01/03-02's kernel surface (createEditorCore, EditorCore, EDITOR_CORE_API_VERSION, createDiagnosticBus, DIAGNOSTIC_CODES, EditorCoreStartupError, the registry/diagnostic contract types) — this plan re-exports it through the root barrel
  - phase: 02-package-boundary-build-scaffolding
    provides: the seven-subpath exports map, the core vitest project, and the subpathStatus.json ⇄ coreExports.js manifest/verifier pair this plan updates in one commit
provides:
  - "lib/ports/fs.ts — FsPort: the seven file-I/O members the Phase-4 resource layer calls (readFile, readFileBinary, writeFile, deleteFile, readdir, mkdir, moveFile), with writeMultiFiles deliberately omitted and the file-not-found/ENOENT rejection contract + opaque-path rule documented"
  - "lib/ports/host.ts — HostPort: the host's logical endpoint record (fs/runtime/preview/project) plus optional docs/update, importing nothing and carrying no host vocabulary"
  - "lib/ports/engine.ts — EngineAdapter: the deliberately thin entry shape (id + apiVersion) that Phase 5 expands"
  - "lib/ports/preview.ts — PreviewAdapter: the minimal non-empty placeholder (apiVersion) that Phase 11 expands"
  - "lib/ports/index.ts — a pure type-only barrel re-exporting the four port contracts by name"
  - "lib/index.ts — the public aggregate: named re-exports of the kernel values/types and the four port types, and no capability subpath"
  - "lib/__tests__/coreApiSurface.test.ts — runtime assertions on the exported surface plus compile-time expectTypeOf assertions that the four port types resolve from ../index (node env docblock)"
  - "subpathStatus.json ⇄ coreExports.js — the '.' content vocabulary moved to kernel-exports and the verifier's per-subpath SUBPATH_CONTENT table, updated in the same commit"
affects: [03-04 (module-state + PORT-02 gates scan these files), 04-resources, 05-engine-adapter, 11-cutover, 12-interface-freeze]

# Actuals (#2632) — same estimateTokens scale as the plan's `estimate` (chars/4 over the realized diff)
actuals:
  tokens: 3179
  tasks: 2
  commits: 2
  plan_head_before: 2b936c433ad2db49d72926e711ea32d4f0b5d658

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Port contracts are declared by core and implemented by the adapter, never the reverse: every port file is import-free (or imports only its sibling port barrel) and carries no host/engine vocabulary"
    - "Minimal-per-known-consumer port depth (D-14): FsPort inherits the seven names verbatim from the app's FsPromiseApi, omitting writeMultiFiles because it has no production caller; EngineAdapter/PreviewAdapter ship one-member entry shapes with a header comment naming the later phase that expands them — non-empty, never an empty shell"
    - "A port documents its rejection contract instead of implementing it: FsPort's header fixes the file-not-found/ENOENT shapes and the opaque-path rule, while the predicate stays in the host (isFileNotFoundError) — no path normalisation enters core (T-03-13)"
    - "Named re-exports at the root barrel (never `export *`): every name on the package's only importable surface is a frozen contract, so making surface growth visible-and-reviewable is the mitigation (T-03-06)"
    - "Manifest and verifier move together: a per-subpath SUBPATH_CONTENT table replaces the Phase-2 binary, and the expectation is written down in the verifier rather than read back from the manifest — an exact three-way mapping, not a self-referential check (Pitfall 8)"
    - "Type-only exports are asserted by tsc, not by a runtime import: expectTypeOf on the four port types makes a dropped export a TS2305 failure, which is the only honest way to prove a pure type exists"

key-files:
  created:
    - packages/libs/editor-core/lib/ports/fs.ts
    - packages/libs/editor-core/lib/ports/host.ts
    - packages/libs/editor-core/lib/ports/engine.ts
    - packages/libs/editor-core/lib/ports/preview.ts
    - packages/libs/editor-core/lib/ports/index.ts
    - packages/libs/editor-core/lib/__tests__/coreApiSurface.test.ts
  modified:
    - packages/libs/editor-core/lib/index.ts
    - .planning/phases/02-package-boundary-build-scaffolding/subpathStatus.json
    - scripts/verify/coreExports.js

key-decisions:
  - "FsPort inherits its seven member names verbatim from FsPromiseApi so the Phase-4 move is a rename-free substitution; writeMultiFiles is deliberately absent (no production caller, D-14)"
  - "The file-not-found/ENOENT contract is documented on FsPort (and its reading members) rather than implemented in core — the predicate stays in the host, and core performs no path normalisation or validation"
  - "EngineAdapter carries only id + apiVersion and PreviewAdapter only apiVersion: both are deliberately thin, non-empty contracts whose header comments name Phase 5 / Phase 11 as the expanding phase (T-03-09)"
  - "The root barrel uses named re-exports for every kernel value/type and the four port types, and re-exports no capability subpath — the seven-key exports map is untouched"
  - "subpathStatus.json and scripts/verify/coreExports.js changed in the same commit; the verifier keeps an exact per-subpath expectation table ('.' -> kernel-exports, './react' -> probe, the remaining five -> empty-barrel) rather than reading the expected value from the manifest"
  - "PORT-01 is only partially satisfied in Phase 3: the four named ports ship now, the capability ports (table/code/asset/map) land in Phases 7-10 — recorded rather than silently dropped (D-14, D-17)"

patterns-established:
  - "A green gate is not a live gate (Phase-2 lesson carried forward): the compile-time port assertion was proven able to fail by temporarily dropping PreviewAdapter from the barrel — tsc reported TS2305 and the test file's expectTypeOf line reported TS2349"
  - "Contract barrels are pure type re-exports (`export type { … }`) under isolatedModules, matching the repo's existing type-only re-export convention"
  - "Test-file fixture discipline even though D-22 exempts lib/__tests__/** from the machine gate: coreApiSurface.test.ts declares no module-scope fixture table, keeping every expectation inside a test body"

requirements-completed: [PORT-01, KERN-05]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "The four port interfaces — EngineAdapter, FsPort, HostPort, PreviewAdapter — exist as exported types under lib/ports/ and are reachable through the package's public barrel (PORT-01)"
    requirement: "PORT-01"
    verification:
      - kind: unit
        ref: "packages/libs/editor-core/lib/__tests__/coreApiSurface.test.ts#四个 port 类型从公开面解析（编译期断言）"
        status: pass
      - kind: other
        ref: "pnpm --filter @motajs/editor-core typecheck -> exit 0; negative polarity: dropping PreviewAdapter from lib/index.ts makes tsc report TS2305 + TS2349"
        status: pass
    human_judgment: false
  - id: D2
    description: "FsPort carries exactly the seven operations the resource layer calls (readFile, readFileBinary, writeFile, deleteFile, readdir, mkdir, moveFile), no writeMultiFiles, and documents the file-not-found/ENOENT rejection contract plus the opaque-path rule"
    requirement: "PORT-01"
    verification:
      - kind: other
        ref: "pnpm --filter @motajs/editor-core typecheck -> exit 0; grep of lib/ports/fs.ts shows exactly the seven members and no writeMultiFiles member, and the header states the file-not-found/ENOENT contract and that core does not normalise or validate paths"
        status: pass
    human_judgment: false
  - id: D3
    description: "HostPort mirrors the host's logical endpoint surface (endpoints record + optional docs/update) without importing host vocabulary; EngineAdapter is the entry shape (id + apiVersion); PreviewAdapter is the minimal non-empty placeholder (apiVersion); none is an empty interface"
    requirement: "PORT-01"
    verification:
      - kind: other
        ref: "pnpm --filter @motajs/editor-core typecheck -> exit 0; grep of lib/ports/{host,engine,preview}.ts shows the members and the Phase 5 / Phase 11 header comments; no import statement in any port file"
        status: pass
    human_judgment: false
  - id: D4
    description: "The root barrel is the honest public surface: it re-exports the kernel values (createEditorCore, createDiagnosticBus, DIAGNOSTIC_CODES, EDITOR_CORE_API_VERSION, EditorCoreStartupError), the kernel types, and the four port types, and re-exports no capability subpath; subpathStatus.json records kernel-exports for '.' and the verifier agrees while still asserting exactly seven subpaths and no build script"
    requirement: "KERN-05"
    verification:
      - kind: unit
        ref: "packages/libs/editor-core/lib/__tests__/coreApiSurface.test.ts (5 tests)"
        status: pass
      - kind: other
        ref: "node scripts/verify/coreExports.js -> exit 0, prints 全部断言通过（7 subpaths、9 peers、8 singletons 单副本）"
        status: pass
      - kind: other
        ref: "node scripts/verify/coreBoundaries.js -> exit 0 (real tree 0 violations, no cycle from the barrel)"
        status: pass
    human_judgment: false
  - id: D5
    description: "PORT-01's capability-port portion is explicitly recorded as landing in Phases 7-10 rather than silently dropped (the plan's flagged assumption + D-14/D-17)"
    requirement: "PORT-01"
    verification: []
    human_judgment: true
    rationale: "This is a scope/roadmap judgment — whether the deferred capability ports are adequately recorded for the Phase-12 freeze review cannot be asserted by a test; the verifier/roadmap owner must confirm the partial-satisfaction record is acceptable."

# Metrics
duration: 14min
completed: 2026-09-23
status: complete
---

# Phase 3 Plan 03: Declared ports and an honest public surface Summary

**The four engine-neutral port contracts (FsPort with its seven real file-I/O members, HostPort's endpoint shape, and the deliberately thin EngineAdapter/PreviewAdapter entry shapes) ship behind a public aggregate barrel whose new `kernel-exports` record and the verifier that cross-checks it moved together in one commit.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-09-23T05:16:20Z
- **Completed:** 2026-09-23T05:30:42Z
- **Tasks:** 2 / 2
- **Files modified:** 9 (6 created, 3 modified)

## Accomplishments

- **The four named ports exist and are non-empty.** `FsPort` is grounded in the resource layer's real call sites — it inherits the seven `FsPromiseApi` member names verbatim (`readFile`, `readFileBinary`, `writeFile`, `deleteFile`, `readdir`, `mkdir`, `moveFile`) so the Phase-4 move is a rename-free substitution, and it deliberately omits `writeMultiFiles` (declared in the app, no production caller). `HostPort` mirrors the host's logical endpoint surface (`endpoints` record + optional `docs`/`update`) without importing any host type. `EngineAdapter` (`id`, `apiVersion`) and `PreviewAdapter` (`apiVersion`) are thin but real contracts whose header comments name Phase 5 / Phase 11 as the expanding phase.
- **The not-found contract is documented, not implemented in core.** `FsPort`'s header fixes the `file-not-found`/`ENOENT` rejection shapes (matching `isFileNotFoundError`) and states that implementations receive opaque paths while core performs no normalisation or validation — path safety stays in the host, so Phase 3 introduces no traversal surface (T-03-13).
- **`lib/index.ts` is now a real public aggregate.** Named re-exports (never `export *`) of `createEditorCore`, `EDITOR_CORE_API_VERSION`, `createDiagnosticBus`, `DIAGNOSTIC_CODES`, `EditorCoreStartupError`, the kernel types (`EditorCore`, `EditorCoreConfig`, `CapabilityRegistrar`, `CapabilityRef`, `RegisterCapabilityOptions`, `RegisterCapabilityResult`, `Diagnostic`, `DiagnosticSeverity`, `DiagnosticBus`, `DiagnosticCode`) and the four port types — and **no** capability subpath. The seven-key exports map and the no-`build` script rule are untouched.
- **The Phase-2 record and its verifier moved together.** `subpathStatus.json`'s `.` entry now reads `kernel-exports` and `coreExports.js`'s `carriesProbe ? 'probe' : 'empty-barrel'` binary became a per-subpath `SUBPATH_CONTENT` table (`. → kernel-exports`, `./react → probe`, the remaining five → `empty-barrel`). The expectation is written down in the verifier, not read back from the manifest — so the `typecheck` job stays green without weakening the gate.
- **The type-only port export is provably checked.** `coreApiSurface.test.ts` runs under `// @vitest-environment node`, asserts the exported constants/factories/class/methods at runtime, and carries `expectTypeOf` compile-time assertions on the four port types. Dropping `PreviewAdapter` from the barrel was verified to make `tsc` fail with `TS2305` — the assertion is live, not decorative.

## Task Commits

Each task was committed atomically:

1. **Task 1: Declare the four ports and their barrel** - `fc3ac68` (feat)
2. **Task 2: Aggregate the public surface and update the Phase-2 record together** - `e25e02f` (feat)

**Plan metadata:** (this SUMMARY commit) (docs: complete plan)

_Note: no TDD tasks; each task is a single commit. `plan_head_before` = `2b936c433ad2db49d72926e711ea32d4f0b5d658`; `commits` measured = 2._

## Files Created/Modified

- `packages/libs/editor-core/lib/ports/fs.ts` - `FsPort`: seven file-I/O members inherited verbatim from `FsPromiseApi` (no `writeMultiFiles`); documents the `file-not-found`/`ENOENT` rejection contract and the opaque-path rule
- `packages/libs/editor-core/lib/ports/host.ts` - `HostPort`: `endpoints` record (`fs`/`runtime`/`preview`/`project`) plus optional `docs`/`update`; imports nothing
- `packages/libs/editor-core/lib/ports/engine.ts` - `EngineAdapter`: entry shape only (`id`, `apiVersion`); header names Phase 5
- `packages/libs/editor-core/lib/ports/preview.ts` - `PreviewAdapter`: minimal non-empty placeholder (`apiVersion`); header names Phase 11
- `packages/libs/editor-core/lib/ports/index.ts` - pure type-only barrel re-exporting the four contracts by name
- `packages/libs/editor-core/lib/index.ts` - the public aggregate: named kernel + port re-exports, no capability subpath
- `packages/libs/editor-core/lib/__tests__/coreApiSurface.test.ts` - runtime export-surface assertions + compile-time port-type assertions (`// @vitest-environment node`)
- `.planning/phases/02-package-boundary-build-scaffolding/subpathStatus.json` - `.` entry `content` → `kernel-exports`, note extended
- `scripts/verify/coreExports.js` - per-subpath `SUBPATH_CONTENT` table replacing the `.`-is-empty-barrel binary; header records the vocabulary change and the manifest/verifier coupling

## Decisions Made

- **`FsPort` inherits its seven names verbatim and omits `writeMultiFiles`.** D-14 forbids guessing at members the known consumer does not exercise, and `writeMultiFiles` has no production caller.
- **The rejection contract is documentation, not implementation.** The predicate stays in the host (`isFileNotFoundError`); core passes paths through opaquely, so no path-traversal surface is added.
- **The two thin adapters are non-empty on purpose.** One-member entry shapes with a header comment naming the expanding phase satisfy "不写空接口" while keeping the published contract honest about its depth.
- **Named re-exports at the root, capability subpaths excluded.** The root barrel is the package's only importable surface; named exports keep growth reviewable and the D-06 single-direction DAG intact.
- **The verifier's expectation is hard-coded, not manifest-derived.** A per-subpath table keeps the assertion exact (three-way mapping) instead of degrading into a self-referential check.

## Deviations from Plan

None - plan executed exactly as written.

### Extra evidence (not a deviation)

The plan's acceptance criterion "the compile-time assertions make `pnpm --filter @motajs/editor-core typecheck` fail if any of the four port types stops being exported from `../index`" was proven by negative polarity: temporarily dropping `PreviewAdapter` from `lib/index.ts` made `tsc -b` fail with `TS2305: Module '"../index"' has no exported member 'PreviewAdapter'` (plus `TS2349` on the `expectTypeOf` line). The export was restored immediately and `typecheck` re-ran green.

---

**Total deviations:** 0 auto-fixed
**Impact on plan:** None. No gate was weakened, no confirmed name changed, and no file under `packages/apps/**` was touched (D-13 add-only).

## Issues Encountered

- None. All task `<automated>` commands and all five plan-level verification items passed on the first attempt.
- `rg` (ripgrep) is not on PATH in this environment (a known Phase-3 research note); content checks used the Grep tool instead. Not a defect.
- The root `pnpm test` fan-out was not exercised — the plan-level verification is scoped to the core package plus the two verifiers, so the pre-existing `@motajs/react-monaco-editor` teardown flake was not a factor.

## User Setup Required

None - no external service configuration required.

## Verification evidence (verbatim)

Task 1 `<automated>` (`pnpm --filter @motajs/editor-core typecheck`):

```
$ tsc -b
```
→ exit **0**.

Task 2 `<automated>` (`pnpm --filter @motajs/editor-core typecheck && pnpm --filter @motajs/editor-core exec vitest run lib/__tests__/coreApiSurface.test.ts && node scripts/verify/coreExports.js`):

```
$ tsc -b
 ✓ lib/__tests__/coreApiSurface.test.ts (5 tests) 3ms
 Test Files  1 passed (1)
      Tests  5 passed (5)
coreExports: 全部断言通过（7 subpaths、9 peers、8 singletons 单副本）
```
→ exit **0**.

Plan-level `<verification>`:

1. `pnpm --filter @motajs/editor-core typecheck` → exit **0**
2. `pnpm --filter @motajs/editor-core test` → **7 files / 34 tests passed**, exit **0** (Plans 01-02's six + this plan's `coreApiSurface.test.ts` + the Phase-2 probe)
3. `node scripts/verify/coreExports.js` → exit **0** (`全部断言通过（7 subpaths、9 peers、8 singletons 单副本）`); `node scripts/verify/coreBoundaries.js` → exit **0**:
   ```
   coreBoundaries: 真实树 cruise 通过（error 违规 0 条，warn 0 条，共 27 个模块、27 条依赖）
   coreBoundaries: core 包内相对边全部解析到 core 内部（24 个 core 模块、17 条相对边）
   coreBoundaries: 全部断言通过（真实树 0 违规、合成违规被拦、PKG-03 负极性 TS2307、editor→core 边方向正确）
   ```
4. `pnpm exec prettier --check scripts/verify/coreExports.js packages/libs/editor-core/lib/index.ts packages/libs/editor-core/lib/__tests__/coreApiSurface.test.ts .planning/phases/02-package-boundary-build-scaffolding/subpathStatus.json` → `All matched files use Prettier code style!`, exit **0**; `pnpm lint` → `108 problems (0 errors, 108 warnings)`, exit **0**
5. `git status --porcelain` → empty; `git status --porcelain -- packages/apps` → empty (D-13 add-only respected); `git diff --diff-filter=D --name-only HEAD~1 HEAD` → empty (no accidental deletions)

## Known Stubs

| Placeholder | Intent | Owner |
|---|---|---|
| `EngineAdapter` in `lib/ports/engine.ts` (only `id` + `apiVersion`) | A deliberately thin **entry shape**, not unfinished work — its header comment states Phase 5 grows it through an explicit interface evolution (D-14/T-03-09). It is a shipped deliverable whose shape is fixed now so adapters can be identified and version-checked. | Phase 5. |
| `PreviewAdapter` in `lib/ports/preview.ts` (only `apiVersion`) | A deliberately minimal **non-empty placeholder** — its header comment states Phase 11 adds the boot hook. Non-empty by design so the interface is a real contract rather than an empty shell. | Phase 11. |

No hardcoded-empty-value stub, placeholder text, or mock-data component was introduced. Every fixture/expectation in the new test is an engine-neutral literal or a kernel constant.

## Threat Flags

None — no security-relevant surface beyond the plan's `<threat_model>` was introduced. T-03-06 is mitigated by named-only re-exports plus `coreExports.js` still asserting the exports map is exactly seven keys with no `build` script and `coreApiSurface.test.ts` pinning the exported names; T-03-07 by the manifest value and the verifier expectation changing in the same commit and the verifier being re-run as part of the task's own `<automated>` command; T-03-09 by both placeholder ports being non-empty with header comments naming their expanding phase; T-03-13 by `FsPort` documenting opaque-path pass-through (no normalisation/validation in core); T-03-SC by installing nothing (`package.json` untouched, the nine-peer set unchanged).

## Next Phase Readiness

- Ready for **Plan 03-04** (the two static gates — module-state and PORT-02): it adds `scripts/verify/coreModuleState.js`, the core-scoped ESLint blocks, and a `ci.yml` step. The new files this plan added are covered: `lib/ports/*` are import-free contracts and `lib/index.ts` is a leaf barrel, so `coreBoundaries.js` is green with no rule change; the new test file is exempt from the module-state gate under D-22.
- The package's public surface is now complete for Phase 3: kernel + four ports reachable through `.`, the manifest honest, and the verifier in agreement.
- `PORT-01` remains **partially** satisfied by design — the four named ports ship here; the capability ports (table/code/asset/map) land in Phases 7-10 and the Phase-12 freeze review closes the record (D-14/D-17).

---
*Phase: 03-kernel-runtime-ports-registry-diagnostics*
*Completed: 2026-09-23*

## Self-Check: PASSED

- All 6 created files exist on disk: `lib/ports/{fs,host,engine,preview,index}.ts` and `lib/__tests__/coreApiSurface.test.ts`.
- All 3 modified files are tracked and changed: `lib/index.ts`, `subpathStatus.json`, `scripts/verify/coreExports.js`.
- Both task commits exist: `fc3ac68` (Task 1), `e25e02f` (Task 2).
- `commits` measured from the on-disk ledger `2b936c433ad2db49d72926e711ea32d4f0b5d658..HEAD` = **2**, matching `actuals.commits`.
- No file under `packages/apps/**` was modified; `git status --porcelain -- packages/apps` is empty.
