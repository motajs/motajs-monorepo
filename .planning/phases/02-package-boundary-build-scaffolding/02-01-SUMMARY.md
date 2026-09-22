---
phase: 02-package-boundary-build-scaffolding
plan: 01
subsystem: infra
tags: [pnpm-workspace, editor-core, package-boundary, vite, typescript, vitest, pandacss, react-compiler, resolvePlugin]

# Dependency graph
requires:
  - phase: 01-baseline-verification-net
    provides: a repaired pnpm workspace, the materialized mota-js submodule (3efb548e), the four-job CI contract, and the recorded baseline (editor 96 files / 891 tests; lint 0 errors / 108 warnings; artifact 57 files / 17,618,356 raw bytes)
provides:
  - "packages/libs/editor-core as a real private workspace package: lib/ layout, seven-subpath exports, typecheck + test scripts, no build"
  - "the temporary CoreProbe + ./react barrel that makes the core build pipeline observable (PandaCSS extraction + React Compiler)"
  - "core's own Vitest project and the mandatory smoke test (keeps the root pnpm test fan-out green)"
  - "the editor's importer-relative resolver: resolvePlugin registered last in BOTH vite.config.ts and vitest.config.ts, hard '@' alias removed"
  - "the editor's real value-level import of @motajs/editor-core"
affects: [02-02, 02-03, 03-kernel, 04-resources, 07-table, 08-code, 09-asset, 10-map, editor-build]

# Actuals (#2632) — same estimateTokens scale as the plan's `estimate` (chars/4 over the realized diff)
actuals:
  tokens: 2824
  tasks: 3
  commits: 3
  plan_head_before: d250496eddee1abc02b1f2f661a2e5d6fa8c6d57

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A lib resolves a consumer-owned generated tree through a tsconfig path + a Vitest alias (@styled-system/* -> ../../apps/editor/styled-system/*) instead of owning a second PandaCSS config"
    - "Importer-relative '@/' resolution (resolvePlugin) replaces the hard resolve.alias['@'], because vite:alias is evaluated before enforce:'pre' plugins and vite:resolve and would hijack a linked package's '@/'"
    - "An exports target is declared only once the file it points at exists on disk (D-01), so no exports entry ever points at a missing file"
    - "A lib with a test script must ship at least one test file, because vitest run exits non-zero on zero test files and reddens the root fan-out"

key-files:
  created:
    - packages/libs/editor-core/package.json
    - packages/libs/editor-core/tsconfig.json
    - packages/libs/editor-core/vitest.config.ts
    - packages/libs/editor-core/lib/index.ts
    - packages/libs/editor-core/lib/code/index.ts
    - packages/libs/editor-core/lib/table/index.ts
    - packages/libs/editor-core/lib/map/index.ts
    - packages/libs/editor-core/lib/asset/index.ts
    - packages/libs/editor-core/lib/shell/index.ts
    - packages/libs/editor-core/lib/react/index.ts
    - packages/libs/editor-core/lib/react/CoreProbe.tsx
    - packages/libs/editor-core/lib/__tests__/coreProbe.test.tsx
  modified:
    - packages/apps/editor/package.json
    - packages/apps/editor/vite.config.ts
    - packages/apps/editor/vitest.config.ts
    - packages/apps/editor/src/App.tsx
    - pnpm-lock.yaml
    - pnpm-workspace.yaml

key-decisions:
  - "Core's intra-package imports are relative (D-06 amended); '@/' is never used inside packages/libs/editor-core/lib/**"
  - "Core has no panda.config.ts; it resolves the editor-owned generated styled-system tree via a tsconfig path and a Vitest alias (D-09)"
  - "The probe types its props inline at the parameter, so no unconfirmed named type enters the package surface (N-01..N-12 stay the whole confirmed set)"
  - "The editor's hard '@' resolve.alias was removed from BOTH configs in this plan, not just vite.config.ts, so dev and CI cannot disagree (Pitfall 2)"
  - "Catalog typescript-eslint pinned to the exact 8.50.1 to keep the repo-wide lint gate green (see Deviations)"

patterns-established:
  - "Lib-with-tests package shape: lib/ layout + typecheck/test scripts + its own vitest.config.ts registering resolvePlugin"
  - "Consumer-edge proof: the editor imports the probe through the package's ./react subpath so the exports map, not a file path, is what gets exercised"

requirements-completed: [PKG-01, PKG-03]

# Coverage metadata (#1602) — one entry per shipped deliverable
coverage:
  - id: D1
    description: "packages/libs/editor-core exists as a real private workspace package using lib/, with private:true, type:module, sideEffects:false and all seven subpath targets present on disk"
    requirement: "PKG-01"
    verification:
      - kind: other
        ref: "node <task3 assertion> -> 'core exports surface complete: 7 subpaths' (exit 0); pnpm --filter @motajs/editor-core typecheck -> exit 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "One core TSX file is resolved end to end by four real resolvers: core's tsc -b, the editor's tsc -b, the editor's Vite build, and the editor's Vitest run"
    requirement: "PKG-03"
    verification:
      - kind: integration
        ref: "pnpm --filter @motajs/editor-core typecheck -> exit 0; pnpm --filter @motajs/editor build -> 'Editor artifact: 56 files, raw 16.53 MiB' exit 0; pnpm --filter @motajs/editor test -> 96 files / 891 tests passed exit 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "Neither editor config carries a hard resolve.alias['@'] any more; both register resolvePlugin and keep only @test / @styled-system"
    requirement: "PKG-03"
    verification:
      - kind: other
        ref: "alias-set assertion on both configs -> '@styled-system,@test' for each; pnpm --filter @motajs/editor test -> 891 passed"
        status: pass
    human_judgment: false
  - id: D4
    description: "PKG-03 negative polarity: a deliberately wrong core intra-package import fails loudly with TS2307 instead of resolving silently to an editor file"
    requirement: "PKG-03"
    verification:
      - kind: other
        ref: "scratch fixture lib/react/__polarity_check.ts -> core tsc -b reported TS2307 for both '@/definitely-missing-module' and './definitely-missing-module' (exit 1); fixture removed before commit"
        status: pass
    human_judgment: true
    rationale: "The fixture is intentionally not committed (the plan requires scratch fixtures be removed), so the observation is recorded evidence rather than a re-runnable test in the committed tree; the durable, machine-checked re-proof lands in plan 02-03's coreBoundaries.js"
  - id: D5
    description: "Core's own Vitest project plus the mandatory smoke test: CoreProbe comes from core's own file, the relative intra-package import resolves, and the derived PandaCSS class is display_block"
    requirement: "PKG-01"
    verification:
      - kind: unit
        ref: "pnpm --filter @motajs/editor-core test -> 1 file / 3 tests passed (0 failed, 0 skipped)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The lockfile reflects the new workspace package and the manifest and lockfile agree"
    requirement: "PKG-03"
    verification:
      - kind: other
        ref: "pnpm install --frozen-lockfile -> 'Lockfile is up to date, resolution step is skipped' exit 0"
        status: pass
    human_judgment: false

# Metrics
duration: 60min
completed: 2026-09-22
status: complete
---

# Phase 2 Plan 01: editor-core skeleton, probe and cross-package resolution Summary

**A real `@motajs/editor-core` workspace package whose probe TSX is resolved, styled and built by the editor end to end — core's `tsc -b`, the editor's `tsc -b`, the editor's Vite build and the editor's Vitest run all green in one slice, with the hard `@` alias gone from both editor configs.**

## Performance

- **Duration:** ~60 min
- **Started:** 2026-09-22T10:20:00Z (approx.)
- **Completed:** 2026-09-22T11:20:48Z
- **Tasks:** 3 / 3
- **Files modified:** 18 (12 created, 6 modified) — includes `pnpm-lock.yaml`

## Accomplishments

- `packages/libs/editor-core` exists as a real `private` / `type: module` / `sideEffects: false` workspace package using `lib/` (never `src/`), with the full seven-entry `exports` map and every target present on disk.
- The editor declares `@motajs/editor-core: workspace:*` and imports `CoreProbe` through the package's `./react` subpath into a `display: none` wrapper beside `gameInject`, so the exports map (not a file path) is what the build actually exercises.
- The hard `resolve.alias['@']` was removed from **both** `vite.config.ts` and `vitest.config.ts` and replaced with the importer-relative `resolvePlugin`, so a linked package's `@/` can no longer be hijacked by `vite:alias`.
- Core ships its own Vitest project (`resolvePlugin` + React Compiler babel plugin + jsdom + the `@styled-system` alias) and the mandatory smoke test, so `pnpm --filter @motajs/editor-core test` runs instead of reddening the root fan-out.
- The derived PandaCSS class is confirmed to be `display_block` — both from the runtime `css` (the smoke test) and from a real `panda cssgen` extraction, so plan 02-03's PKG-04 gate has a verified target.
- PKG-03's negative polarity was observed: a planted wrong core intra-package import fails with `TS2307` (both `@/…` and `./…` forms) under core's own `tsc -b`.

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): End-to-end core probe — one core TSX resolved, styled and built by the editor** - `97e9aa7` (feat)
2. **Task 2: Core's own Vitest project, the smoke test, and the editor's mirrored test resolver** - `827c6ea` (test)
3. **Task 3: Complete the seven-subpath export surface with real empty barrels** - `6209725` (feat)

**Plan metadata:** (this SUMMARY commit) (docs: complete plan)

_Note: no TDD tasks; each task is a single commit._

## Files Created/Modified

- `packages/libs/editor-core/package.json` - manifest: `private`, `type: module`, `sideEffects: false`, seven-subpath `exports`, exactly `typecheck` + `test` scripts (no `build`), devDependencies only (no peers — plan 02 owns the PKG-02 peer block)
- `packages/libs/editor-core/tsconfig.json` - extends `@motajs/config/tsconfig.lib.base.json`; re-declares `@/*` and adds `@styled-system/*` → `../../apps/editor/styled-system/*`
- `packages/libs/editor-core/vitest.config.ts` - core's own Vitest project (`resolvePlugin`, react + react-compiler, jsdom, `@styled-system` alias)
- `packages/libs/editor-core/lib/index.ts` + `lib/{code,table,map,asset,shell}/index.ts` - six inert `export {}` barrels (one per non-probe subpath)
- `packages/libs/editor-core/lib/react/index.ts` - the `./react` barrel; re-exports `CoreProbe` only
- `packages/libs/editor-core/lib/react/CoreProbe.tsx` - the temporary probe: a named export whose props are typed inline, calling `useState` and carrying a template-literal PandaCSS `css` call
- `packages/libs/editor-core/lib/__tests__/coreProbe.test.tsx` - the mandatory smoke test (3 assertions)
- `packages/apps/editor/package.json` - adds `@motajs/editor-core: workspace:*`
- `packages/apps/editor/vite.config.ts` - `resolvePlugin` registered last; `'@'` alias removed; `PluginOption` narrowing for the cross-instance plugin type
- `packages/apps/editor/vitest.config.ts` - the same resolver change mirrored
- `packages/apps/editor/src/App.tsx` - value import of `@motajs/editor-core/react` rendered in a hidden wrapper
- `pnpm-lock.yaml` - regenerated for the new workspace package
- `pnpm-workspace.yaml` - catalog `typescript-eslint` pinned to `8.50.1` (see Deviations)

## Decisions Made

- **Relative intra-package imports in core** (D-06 amended): `@/` is never used inside `packages/libs/editor-core/lib/**`, because TypeScript `paths` is program-global and the editor's program would otherwise capture core's `@/`.
- **Core owns no PandaCSS config** (D-09): the `@styled-system/*` path and Vitest alias point at the editor's generated tree; the smoke test proves the tree resolves.
- **No named props type** on the probe: props are typed inline at the parameter so the confirmed name set stays exactly N-01..N-12.
- **Both editor configs changed in this plan** (Pitfall 2), not just `vite.config.ts`.
- **`vitest.config.ts` gets no `PluginOption` narrowing**: it is not part of any editor tsconfig program, so the cross-instance Vite `Plugin` type never has to satisfy `PluginOption` there.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Editor `tsc -b` rejected `resolvePlugin` because `@motajs/config` resolves a different Vite instance**
- **Found during:** Task 1 (editor production build)
- **Issue:** `resolvePlugin.d.ts` imports `Plugin` from `vite`, but `@motajs/config` has no `node_modules`, so its `vite` resolves from the workspace root (peer suffix `@types/node@25.0.3`) while the editor's node program resolves `vite` with `@types/node@24.10.9`. `plugins: [..., resolvePlugin]` therefore failed with `TS2769` ("two different types with this name exist, but they are unrelated"). `packages/apps/service-worker/vite.config.ts` is *not* a counter-example: no service-worker tsconfig includes its `vite.config.ts`, so it is never typechecked.
- **Fix:** import `type { PluginOption } from 'vite'` and narrow at the single use site (`resolvePlugin as PluginOption`), with a comment explaining that it is the same plugin object at runtime.
- **Files modified:** `packages/apps/editor/vite.config.ts`
- **Verification:** `pnpm --filter @motajs/editor exec tsc -b` → exit 0; `pnpm --filter @motajs/editor build` → exit 0.
- **Committed in:** `97e9aa7` (Task 1 commit)

**2. [Rule 3 - Blocking] The required `pnpm install` re-resolved root `typescript-eslint` 8.50.1 → 8.53.1 and broke the repo-wide lint gate**
- **Found during:** Task 1 (after `pnpm install` regenerated the lockfile)
- **Issue:** the catalog entry was `typescript-eslint: ^8.50.1`, and the lockfile rewrite bumped root's copy to 8.53.1. With 8.53.1, `@typescript-eslint/parser` registers the editor config's `basePath` as a second `tsconfigRootDir` candidate, so `getInferredTSConfigRootDir()` throws and `pnpm lint` failed with **654 parse errors** (`No tsconfigRootDir was set, and multiple candidate TSConfigRootDirs are present`) on pre-existing files such as `packages/libs/react-hooks/lib/index.ts` and `scripts/verify/prettier-setup.js` — i.e. it was not caused by any new file.
- **Fix:** pin the catalog entry to the exact `typescript-eslint: 8.50.1`, restoring the pre-change resolution (the editor's own direct `8.53.1` pin is untouched). The exact pin also matches the project's "catalog 固定依赖版本" constraint.
- **Files modified:** `pnpm-workspace.yaml` (plus the regenerated `pnpm-lock.yaml`)
- **Verification:** `pnpm lint` → `108 problems (0 errors, 108 warnings)`, exit 0 (identical to the Phase 1 baseline).
- **Committed in:** `97e9aa7` (Task 1 commit)
- **Out of scope, left for a later phase:** making the root ESLint config robust under `typescript-eslint@8.53.1` (e.g. an explicit `tsconfigRootDir`, or unifying root and editor on one version) — that is a repo-wide tooling change, not Phase 2 scaffolding.

**3. [Rule 1 - Bug] Prettier normalized both probe `css` templates from single-line to multi-line**
- **Found during:** Task 1/2 (prettier check on the new files)
- **Issue:** Prettier is the formatting authority (`prettier/prettier: error`), and it rewrote `` css`display: block;` `` to a multi-line tagged template in both `CoreProbe.tsx` and the smoke test.
- **Fix:** accepted Prettier's form (no `prettier-ignore`), then verified the class name is unchanged: the smoke test still asserts `display_block` (passes), and a real `panda cssgen` extraction of the reformatted probe emitted exactly `.display_block { display: block; }`.
- **Files modified:** `packages/libs/editor-core/lib/react/CoreProbe.tsx`, `packages/libs/editor-core/lib/__tests__/coreProbe.test.tsx`
- **Verification:** `pnpm exec prettier --check` clean; `pnpm --filter @motajs/editor-core test` → 3 passed; `panda cssgen` → `.display_block { display: block; }`.
- **Committed in:** `97e9aa7` and `827c6ea` (Task 1 and Task 2 commits)

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 bug)
**Impact on plan:** All three were necessary — without #1 and #2 the plan's own verify commands cannot pass, and without #3 the formatting gate fails. No scope creep: no editor production code changed, and no gate was weakened. The only out-of-plan file touched is `pnpm-workspace.yaml` (one catalog pin).

## Issues Encountered

- **The stale `.planning/baseline/editor-manifest.json`** (recorded 2026-09-20, commit `1e118e1`) no longer describes the current build: the editor artifact is now **56 files / 17,331,015 raw bytes** vs the baseline's 57 files / 17,618,356. This is **not** caused by this plan — 446 editor files (theme CSS, `index.html`, `runtime.html`, all `src/**`) changed after the baseline was captured (the Phase 1 Prettier reformat plus the config split). The probe's own contribution is the ~4 KB growth of `assets/editor-*.js` (3,542,680 → 3,546,766, i.e. +4,086 bytes). Both budget checks still hold: raw 16.53 MiB is 82.64 % of the 20 MiB budget and there is exactly one `ts.worker` (`assets/ts.worker-DzfQDkHh.js`), which the artifact plugin asserts by throwing otherwise. Per Pitfall 13 this was investigated rather than re-baselined; re-baselining is left to whichever plan owns the artifact budget.
- **The lockfile rewrite is large** (~920 lines) for a small logical change: pnpm 12.5.1's full resolution also re-suffixed many `supports-color` peer keys and moved root `vitest` 4.0.16 → 4.0.18. Both are within their catalog ranges, `pnpm install --frozen-lockfile` accepts the result, and `pnpm lint` / `pnpm test` / `pnpm build` are all green afterwards. Flagged so reviewers are not surprised by the diff size.

## Known Stubs

The SUMMARY stub contract (hardcoded empty values flowing to UI rendering / placeholder text / components with mock data) matches **nothing** in this plan. Two intentional placeholders exist and are documented rather than defect-registered:

| Placeholder | Intent | Owner |
|---|---|---|
| `lib/index.ts` + `lib/{code,table,map,asset,shell}/index.ts` (six `export {}` barrels) | The package's declared export surface must be real files on disk (D-01) and must give dependency-cruiser a file node per subpath. They are the phase's deliverable, not unfinished work. | Filled in phases 7–10 (table→code→asset→map) and phase 3 (kernel); plan 02-02's `subpathStatus.json` is their machine-checked register. |
| `lib/react/CoreProbe.tsx` | Temporary scaffolding that makes the PandaCSS + React Compiler gates observable. | Replaced or deleted by the real React layer from Phase 4 onward. Registered in `.planning/WINDOWS.md` as entry 2 so the ship gate sees it. |

## Threat Flags

None — no new security-relevant surface was introduced beyond the plan's `<threat_model>`. The changes are confined to the manifest/exports surface (T-01-01), resolver order (T-01-02), the core→host edge direction (T-01-03), silent misresolution (T-01-04), the lockfile (T-01-05) and supply chain (T-01-SC), all of which the plan already registers. The one extra file touched (`pnpm-workspace.yaml`, catalog pin) is a supply-chain-adjacent change already inside T-01-SC's disposition.

## Verification evidence (verbatim)

Plan-level `<verification>`:

1. `pnpm --filter @motajs/editor-core typecheck` → exit **0**
2. `pnpm --filter @motajs/editor-core test` → `Test Files 1 passed (1)` / `Tests 3 passed (3)`, exit **0**
3. `pnpm --filter @motajs/editor build` → `Editor artifact: 56 files, raw 16.53 MiB, gzip 4.16 MiB, brotli 3.46 MiB`, exit **0**; manifest check → `ts.worker count: 1`, `raw 17331015 < 20971520: true`
4. `pnpm --filter @motajs/editor test` → `Test Files 96 passed (96)` / `Tests 891 passed (891)`, exit **0** (Phase 1 baseline = 96 / 891)
5. `pnpm install --frozen-lockfile` → `Lockfile is up to date, resolution step is skipped`, exit **0**
6. `pnpm lint` → `108 problems (0 errors, 108 warnings)`, exit **0**; `pnpm format:check` → `All matched files use Prettier code style!`, exit **0**
7. Barrel check → `lib/index.ts` and the five capability barrels each contain only `export {};`; `lib/react/index.ts` is the only non-empty barrel

Task-level:

- Task 1 `<automated>`: `pnpm install --frozen-lockfile && pnpm --filter @motajs/editor-core typecheck && pnpm --filter @motajs/editor build` → all exit **0** (tracer feedback gate re-run end-to-end: green, no checkpoint synthesized)
- Task 2 `<automated>`: `pnpm --filter @motajs/editor-core test && pnpm --filter @motajs/editor test` → exit **0** / **0**
- Task 3 `<automated>`: `pnpm --filter @motajs/editor-core typecheck && node <exports assertion>` → exit **0**; assertion printed `core exports surface complete: 7 subpaths`
- PKG-03 negative polarity (planted scratch fixture, removed before commit):
  `lib/react/__polarity_check.ts(2,30): error TS2307: Cannot find module '@/definitely-missing-module' or its corresponding type declarations.`
  `lib/react/__polarity_check.ts(3,33): error TS2307: Cannot find module './definitely-missing-module' or its corresponding type declarations.`
  → `tsc -b` exit **1**; after removing the fixture `pnpm --filter @motajs/editor-core typecheck` → exit **0**
- PKG-04 target de-risk (temporary `panda.config.ts` include widened, then reverted): `panda cssgen` → `display_block present: True`, rule `.display_block { display: block; }`

## Next Phase Readiness

- Ready for **plan 02-02** (catalog gaps, nine peers with Semi optional, and the machine-checked core manifest): the package, its seven subpaths and its devDependency triple already exist, so plan 02 only adds the peer block, the five catalog entries and `scripts/verify/coreExports.js` + `subpathStatus.json`.
- Ready for **plan 02-03** (boundary gate and consumer-pipeline coverage): the probe is reachable through `./react`, `resolvePlugin` is registered in both editor configs, and the `.display_block` extraction target is verified.
- Two carries forward: (a) the editor artifact baseline in `.planning/baseline/editor-manifest.json` is stale relative to the tree and should be refreshed by whoever owns the artifact budget; (b) the root ESLint config still assumes `typescript-eslint@8.50.1` — bumping it later needs an explicit `tsconfigRootDir`.

---

*Phase: 02-package-boundary-build-scaffolding*
*Completed: 2026-09-22*

## Self-Check: PASSED

- Created files exist on disk: `packages/libs/editor-core/{package.json,tsconfig.json,vitest.config.ts}`, `lib/index.ts`, `lib/{code,table,map,asset,shell}/index.ts`, `lib/react/{index.ts,CoreProbe.tsx}`, `lib/__tests__/coreProbe.test.tsx` — all present.
- Commits exist: `97e9aa7`, `827c6ea`, `6209725` (verified via `git log --oneline d250496..HEAD` → 3 commits).
- `plan_head_before`: `d250496eddee1abc02b1f2f661a2e5d6fa8c6d57`; `commits` measured = 3.
- No scratch fixture or temp config remains: `lib/react/__polarity_check.ts` absent, `packages/apps/editor/panda.probe.config.ts` absent, `packages/apps/editor/panda.config.ts` byte-identical to HEAD.
