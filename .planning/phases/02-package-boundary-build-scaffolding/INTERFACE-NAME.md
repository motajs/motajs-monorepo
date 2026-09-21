# Phase 2 — Interface & Naming Confirmation

> AGENTS.md Project Rules: any **important naming** (file / interface / method / function / type / package / exported symbol) MUST be reported here and confirmed by the user **before** it is written into code, plans, or config.
> One section per Plan. Plans are not generated yet (plan-phase is running), so this first section lists **every** new name the phase introduces; after confirmation the planner will split it into per-plan sections without changing any name.

**Status:** ✅ names N-01..N-12 confirmed by the user (2026-09-21); per-plan section assignments populated by gsd-planner
**Scope:** names introduced by Phase 2 only. Names already locked earlier are marked *(locked)* and are not up for re-decision.

**Two open items carried into plan review (not renames — they need your call at plan approval):**

1. **`scripts/verify/` naming mix** (see the "Conflict flagged" section below). The planner proceeded with **option (a): accept the mix** — Phase 1's four kebab-case verifiers stay untouched and Phase 2 adds four camelCase ones. No Phase-1 gate is modified. Say so at plan approval if you prefer option (b).
2. **The editor-side consumer of `@motajs/editor-core`** (N-12's other half) introduces **no new name**: Plan 01 puts the value import inside the existing `packages/apps/editor/src/App.tsx`, rendered into a new `display: none` wrapper next to the existing `gameInject` node — deliberately *not* inside `gameInject`, because the mota-js runtime overwrites that node with `innerHTML`. Nothing is renamed; no new file is created for it.

---

## Section 0 — All Phase 2 names (provisional, pre-plan)

### Already locked (listed for completeness — no decision needed)

| Name | Kind | Purpose |
|------|------|---------|
| `@motajs/editor-core` | package name *(locked, PROJECT.md)* | the engine-agnostic core package |
| `packages/libs/editor-core/` | directory *(locked)* | package location; uses `lib/`, never `src/` |
| `.` `./code` `./table` `./map` `./asset` `./shell` `./react` | subpath exports *(locked, PKG-01/EXT-05)* | public entry points of the package |
| `lib/index.ts` + `lib/{code,table,map,asset,shell,react}/index.ts` | barrel files *(derived from locked subpaths)* | one empty barrel per subpath |
| `createEditorCore` / `EditorCore` / `lib/kernel/core.ts` | *(locked by ROADMAP; Phase 3)* | not created this phase |

### Proposed new names — need confirmation

| # | Proposed name | Kind | Purpose / why this name |
|---|---|---|---|
| N-01 | `packages/libs/editor-core/package.json` | manifest | package manifest: `private`, `type: module`, `sideEffects: false`, peerDeps, exports map. Conventional filename. |
| N-02 | `packages/libs/editor-core/tsconfig.json` | config | extends `@motajs/config/tsconfig.lib.base.json`; adds the `@styled-system/*` path. Conventional filename (mirrors `packages/libs/react-hooks/tsconfig.json`). |
| N-03 | `packages/libs/editor-core/vitest.config.ts` | config | core's own Vitest config (resolvePlugin + react+compiler + jsdom + `@styled-system` alias). Conventional filename (mirrors `packages/apps/service-worker/vitest.config.ts`). |
| N-04 | `lib/react/CoreProbe.tsx` — **file + exported symbol `CoreProbe`** | file + component | **the temporary PandaCSS/React-Compiler probe** (D-03). **PascalCase is technically forced**: JSX treats a lowercase tag as an HTML element, so `<CoreProbe />` requires an uppercase symbol. It probes the *core build pipeline*, not a feature; `react/` because it must be TSX + use a hook so React Compiler has something to transform (D-21). Deleted/replaced in Phase 4+. *(If you want the filename lowercase too, say so — the symbol must stay `CoreProbe`.)* |
| N-05 | `lib/__tests__/coreProbe.test.tsx` | test file | the mandatory smoke test (D-12/D-21): asserts the probe exports `CoreProbe`, a relative intra-package import resolves, and `@styled-system` resolves. camelCase filename per your rule; co-located `__tests__/` per repo convention. |
| N-06 | `scripts/verify/coreExports.js` | verifier script | PKG-01 (7 exports targets exist on disk, `private`/`type`/`sideEffects`) + PKG-02 (peer declarations) + D-15 (realpath single-copy). `core` prefix groups all Phase-2 verifiers; camelCase per your rule. |
| N-07 | `scripts/verify/corePandaClass.js` | verifier script | PKG-04: runs PandaCSS extraction and asserts the generated CSS contains `.display_block { display: block }`. |
| N-08 | `scripts/verify/coreReactCompiler.js` | verifier script | PKG-05: runs a live Vite `transformRequest` on `CoreProbe.tsx` and asserts the output contains `react/compiler-runtime` and `_c(`. |
| N-09 | `scripts/verify/coreBoundaries.js` | verifier script | VERIFY-05: two-polarity dependency-cruiser gate (real tree → exit 0; synthetic violating fixture → non-zero; asserts `couldNotResolve` is not masking the DAG rules). |
| N-10 | `.dependencyCruiser.cjs` | config (root) | dependency-cruiser rule set (forbidden edges, the D-06 DAG, `no-cycles`, the D-16 `requireZero` singleton rule). **Renamed from the tool's conventional `.dependency-cruiser.cjs` per your no-hyphen rule**; the wrapper passes it explicitly via `--config`. |
| N-11 | `.planning/phases/02-package-boundary-build-scaffolding/subpathStatus.json` | data file | the D-01 "各 subpath 内容状态" manifest: records, per subpath, whether it is an empty barrel or carries the probe — machine-checkable by `coreExports.js`. camelCase per your rule. |
| N-12 | `lib/react/index.ts` re-export of `CoreProbe` | export | so the probe is reachable from the `./react` subpath and therefore actually transformed by the editor build (PKG-05 needs a real entry path). |

### Conflict flagged (needs your call)

**`scripts/verify/` naming now diverges from Phase 1.** Phase 1's four verifiers are kebab-case (`ci-workflow.js`, `prettier-setup.js`, `lint-severities.js`, `e2e-prerequisite.js`). Your rule makes Phase 2's four camelCase (`coreExports.js`, …). Both work (`ci.yml` invokes them by exact path), but the directory becomes mixed-convention.
→ Your options: (a) accept the mix (recommended — no churn to shipped Phase-1 gates), or (b) also rename Phase 1's four scripts to camelCase as part of this phase (touches `ci.yml` + `ci-workflow.js`'s own assertions — a Phase-1 gate change).

### Deliberately NOT named here (agent discretion, per 02-CONTEXT.md)

- The negative-polarity fixture used by `core-boundaries.js` (a throwaway violating file created and removed by the script — it never lands in the tracked tree, so it is not a durable public name).
- The `subpath-status.json` schema keys.
- `dependency-cruiser` rule `name` strings.

### Naming rule applied

`camelCase` for every new file name (your rule, 2026-09-21), **except**: (1) React component symbol `CoreProbe` — PascalCase is forced by JSX; (2) conventional config filenames (`package.json`, `tsconfig.json`, `vitest.config.ts`) which are ecosystem-fixed; (3) `lib/` (never `src/`) for a lib package. `@/` is **not** used inside core any more (D-06 amended to relative imports).

---

## Section 1 — Plan 01

**Plan:** `02-01-PLAN.md` — *editor-core skeleton, probe, and cross-package resolution* (wave 1; requirements PKG-01, PKG-03; tracer-first).
**Names this plan introduces:** N-01, N-02, N-03, N-04, N-05, N-12. No name from Section 0 is renamed or added to.

| # | Name | Kind | What it is for |
|---|------|------|----------------|
| N-01 | `packages/libs/editor-core/package.json` | manifest | Declares the new package: `private: true`, `type: module`, `sideEffects: false`, the `exports` map, and exactly two scripts (`typecheck`, `test` — no `build`, D-08). Task 1 creates it with only `"./react"` declared; Task 3 completes the map as the remaining targets' files land, so no `exports` entry ever points at a file that does not exist (D-01). |
| N-02 | `packages/libs/editor-core/tsconfig.json` | config | Four-key tsconfig extending `@motajs/config/tsconfig.lib.base.json`. It re-declares `@/*` (a child `paths` replaces the base's) and adds `@styled-system/*` → `../../apps/editor/styled-system/*`, which is how core resolves the editor-owned generated styling tree without owning a PandaCSS config (D-09). |
| N-03 | `packages/libs/editor-core/vitest.config.ts` | config | Core's own Vitest project: `resolvePlugin` (importer-relative `@/`), `react()` with the React Compiler babel plugin (matching production), `jsdom`, and the `@styled-system` alias. Without it there is no way to run a core test at all, and its smoke test is also the plan's resolver evidence (D-12). |
| N-04 | `lib/react/CoreProbe.tsx` — file + exported symbol `CoreProbe` | file + component | The temporary probe that makes the two build-pipeline gates observable: it carries a template-literal `css` call (PandaCSS extraction, PKG-04) and calls a hook (React Compiler emits nothing without one, PKG-05/D-21). Named `react/` because it must be TSX; PascalCase is forced by JSX's lowercase-is-an-HTML-element rule. Deleted or replaced by the real React layer from Phase 4 onward — it is not, and must not become, a public API. |
| N-05 | `lib/__tests__/coreProbe.test.tsx` | test file | The mandatory smoke test. Its reason for existing is mechanical: `vitest run` exits non-zero on zero test files, so declaring `test` without a test file reddens the root `pnpm test` fan-out. It asserts the probe's symbol came from core's own file, that a relative intra-package import resolves, and that the derived PandaCSS class is `display_block`. |
| N-12 | `lib/react/index.ts` re-export of `CoreProbe` | export | Makes the probe reachable from the `./react` subpath so it has a real entry path into the editor's build graph. Without it the editor could only reach the probe by file path, which would not exercise the package `exports` map it is supposed to prove. |
| — | `lib/index.ts` + `lib/{code,table,map,asset,shell}/index.ts` | barrels *(derived from the locked subpath list)* | Six `export {}` barrels, one per non-probe subpath. They exist because an `exports` target must be a real file on disk, and because dependency-cruiser's DAG rules need a file node per subpath. The root `lib/index.ts` must not re-export the capability subpaths. |

**Deliberately absent from Plan 01:** no `src/` directory, no `panda.config.ts` under core, no `build` script, no `peerDependencies` (Plan 02 owns the PKG-02 peer block).

## Section 2 — Plan 02

**Plan:** `02-02-PLAN.md` — *catalog gaps, nine peers with Semi optional, and the machine-checked core manifest* (wave 2; depends on 01-01; requirements PKG-01, PKG-02).
**Names this plan introduces:** N-06, N-11.

| # | Name | Kind | What it is for |
|---|------|------|----------------|
| N-06 | `scripts/verify/coreExports.js` | verifier script | Makes three claims executable instead of asserted in prose: (a) PKG-01 structure — the seven `exports` targets exist on disk, `private`/`type`/`sideEffects` hold, `scripts` is exactly `typecheck` + `test`; (b) PKG-02 declaration — the nine peers are exactly the PKG-02 names and each is defined in the workspace catalog; (c) the D-15 single-copy proof — each shared singleton resolves to exactly one realpath from both consumer directories, with `@douyinfe/semi-ui` asserted from `packages/apps/service-worker` and the reason printed (D-18). Called from the existing CI `typecheck` job. |
| N-11 | `.planning/phases/02-package-boundary-build-scaffolding/subpathStatus.json` | data file | The D-01 "which subpath holds what" manifest: per subpath, its `exports` target and whether it is an empty barrel or carries the probe. `coreExports.js` cross-checks it against the real `exports` map so the written description and the filesystem cannot drift. |
| — | `pnpm-workspace.yaml` catalog entries `alien-signals`, `antd`, `blockly`, `immer`, `pixi.js` | catalog entries *(existing package names, no new naming)* | The five entries the PKG-02 peer list needs before `catalog:default` can be written at all (D-19). Pinned to the versions the editor already installs directly. |
| — | `packages/libs/editor-core` `peerDependencies` (9) + `peerDependenciesMeta` + mirrored `devDependencies` | dependency declarations | The shared-instance surface. `peerDependenciesMeta` carries exactly one key — `@douyinfe/semi-ui` marked optional — because no editor or core code path resolves it (D-18). |

**Deliberately absent from Plan 02:** no `dependency-cruiser` catalog entry and no root devDependency (Plan 03 owns that install, behind the blocking checkpoint).

## Section 3 — Plan 03

**Plan:** `02-03-PLAN.md` — *boundary gate and consumer-pipeline coverage* (wave 3; depends on 01-01, 02-02; requirements PKG-03, PKG-04, PKG-05, VERIFY-05; contains one blocking human checkpoint).
**Names this plan introduces:** N-07, N-08, N-09, N-10.

| # | Name | Kind | What it is for |
|---|------|------|----------------|
| N-10 | `.dependencyCruiser.cjs` | config (root) | The boundary rule set, in the tool's conventional name minus the hyphen (N-10 as confirmed). Six `forbidden` rules at `severity: 'error'`: core must not import the editor/host/engine; the D-06 DAG in three parts (`.` → no capability; `react`/`shell` → no capability; capabilities → not each other); `no-cycles`; and the D-16 composition-root-only singleton rule. Only `forbidden` rules — no `allowed` loosening — so the gate can only get stricter. The wrapper passes it explicitly via `--config`. |
| N-09 | `scripts/verify/coreBoundaries.js` | verifier script | Proves the gate is alive, not merely present: the real tree cruises at 0 errors; no core-internal relative edge is left unresolved (so the path rules can actually fire — Pitfall 6); a synthetic cross-capability fixture is reported non-zero with the rule name named; PKG-03's negative polarity is observed by requiring core's own `tsc -p` to fail with `TS2307` on a planted wrong import; and the editor-to-core edge direction is asserted together with the absence of the reverse declaration. Both fixtures are created and removed by the script and never committed. Called from the existing CI `lint` job. |
| N-07 | `scripts/verify/corePandaClass.js` | verifier script | Runs the real `panda cssgen` extraction and asserts the emitted stylesheet contains the config-stable atomic class `.display_block { display: block`. It asserts the tool's output, never the config text and never a hashed class, because the class name is a function of `syntax`/`hash` settings (D-10 as corrected). Called from the existing CI `build` job. |
| N-08 | `scripts/verify/coreReactCompiler.js` | verifier script | Runs a live Vite `transformRequest` over `CoreProbe.tsx` using the editor's own plugin configuration and asserts both compiler markers (`react/compiler-runtime` and `_c(`). It runs the real plugin rather than re-implementing its include/exclude filter, and exits explicitly on completion because closing the Vite server can keep the process alive. Called from the existing CI `build` job. |
| — | the six rule `name` strings inside N-10 | config keys | Explicitly **agent discretion** per Section 0 above; recorded here for completeness, not as a naming request. |
| — | `pnpm-workspace.yaml` catalog entry `dependency-cruiser: 18.2.0` + root `devDependency` | catalog entry / dependency declaration | The tool. Pinned at `18.2.0` rather than the one-day-old `18.4.0` (D-20), installed only after the blocking human checkpoint in Task 1 confirms its provenance. |
| — | `packages/apps/editor/panda.config.ts` widened `include` | config change | Adds `'../../libs/editor-core/lib/**/*.{ts,tsx}'` so the one editor-owned PandaCSS config covers core source too. No second config, no touched `postcss.config.cjs` (D-09). |
| — | `.github/workflows/ci.yml` — one new step in `lint`, two in `build` | CI steps | D-13: no new job, no renamed job, so the four required status checks and `scripts/verify/ci-workflow.js` both stay valid. |
