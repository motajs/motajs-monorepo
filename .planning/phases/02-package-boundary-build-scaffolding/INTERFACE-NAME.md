# Phase 2 — Interface & Naming Confirmation

> AGENTS.md Project Rules: any **important naming** (file / interface / method / function / type / package / exported symbol) MUST be reported here and confirmed by the user **before** it is written into code, plans, or config.
> One section per Plan. Plans are not generated yet (plan-phase is running), so this first section lists **every** new name the phase introduces; after confirmation the planner will split it into per-plan sections without changing any name.

**Status:** ⏳ awaiting user confirmation (2026-09-21)
**Scope:** names introduced by Phase 2 only. Names already locked earlier are marked *(locked)* and are not up for re-decision.

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

*(populated by gsd-planner after confirmation; no new names expected beyond Section 0)*

## Section 2 — Plan 02

*(populated by gsd-planner after confirmation)*

## Section 3 — Plan 03

*(populated by gsd-planner after confirmation)*
