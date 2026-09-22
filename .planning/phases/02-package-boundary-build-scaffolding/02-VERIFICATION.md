---
phase: 02-package-boundary-build-scaffolding
verified: 2026-09-22T14:35:00Z
status: passed
score: 7/7 must-haves verified
covered_files:
  - .dependencyCruiser.cjs
  - .github/workflows/ci.yml
  - .planning/REQUIREMENTS.md
  - .planning/ROADMAP.md
  - .planning/WINDOWS.md
  - .planning/phases/02-package-boundary-build-scaffolding/02-01-PLAN.md
  - .planning/phases/02-package-boundary-build-scaffolding/02-01-SUMMARY.md
  - .planning/phases/02-package-boundary-build-scaffolding/02-02-PLAN.md
  - .planning/phases/02-package-boundary-build-scaffolding/02-02-SUMMARY.md
  - .planning/phases/02-package-boundary-build-scaffolding/02-03-PLAN.md
  - .planning/phases/02-package-boundary-build-scaffolding/02-03-SUMMARY.md
  - .planning/phases/02-package-boundary-build-scaffolding/02-CONTEXT.md
  - .planning/phases/02-package-boundary-build-scaffolding/02-PATTERNS.md
  - .planning/phases/02-package-boundary-build-scaffolding/02-RESEARCH.md
  - .planning/phases/02-package-boundary-build-scaffolding/02-VALIDATION.md
  - .planning/phases/02-package-boundary-build-scaffolding/INTERFACE-NAME.md
  - .planning/phases/02-package-boundary-build-scaffolding/gapClosureSummary.md
  - .planning/phases/02-package-boundary-build-scaffolding/subpathStatus.json
  - package.json
  - packages/apps/editor/package.json
  - packages/apps/editor/panda.config.ts
  - packages/apps/editor/src/App.tsx
  - packages/apps/editor/src/__tests__/editorCoreResolution.test.tsx
  - packages/apps/editor/src/assets/FiraCode.ttf
  - packages/apps/editor/src/css/editor.css
  - packages/apps/editor/vite.config.ts
  - packages/apps/editor/vitest.config.ts
  - packages/libs/editor-core/lib/__tests__/coreProbe.test.tsx
  - packages/libs/editor-core/lib/asset/index.ts
  - packages/libs/editor-core/lib/code/index.ts
  - packages/libs/editor-core/lib/index.ts
  - packages/libs/editor-core/lib/map/index.ts
  - packages/libs/editor-core/lib/react/CoreProbe.tsx
  - packages/libs/editor-core/lib/react/index.ts
  - packages/libs/editor-core/lib/shell/index.ts
  - packages/libs/editor-core/lib/table/index.ts
  - packages/libs/editor-core/package.json
  - packages/libs/editor-core/tsconfig.json
  - packages/libs/editor-core/vitest.config.ts
  - pnpm-lock.yaml
  - pnpm-workspace.yaml
  - scripts/verify/coreBoundaries.js
  - scripts/verify/coreExports.js
  - scripts/verify/corePandaClass.js
  - scripts/verify/coreReactCompiler.js
  - scripts/verify/editorArtifactAssets.js
covered_digest: "v1:sha256:ff649e53ab1432c3e8a62f1e9ff31c944607eed6dfb260f53d83a01373da8389"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 5/7
  gaps_closed:
    - "BLOCKER — the PKG-03 resolver migration silently dropped the shipped FiraCode font (truth 7). Fixed by commit ee01e59 (relative CSS url) and made machine-loud by c99cb36/af9ae16 (scripts/verify/editorArtifactAssets.js). Independently reproduced: fresh build emits 57 files / 16.80 MiB with assets/FiraCode-CzoQJ4O7.ttf (289,624 B, sha256 5992ab96… == source == baseline); the new gate fails on both scratch mutations and passes restored."
    - "WARNING — the editor's Vitest axis of truth 3 was present but unexercised (truth 6). Fixed by commit 41eb5ad (packages/apps/editor/src/__tests__/editorCoreResolution.test.tsx). Independently reproduced: the test is collected (verbose reporter lists 2 named tests), passes (1 file / 2 tests), and fails (exit 1) when the module is aliased to a missing path."
  gaps_remaining: []
  regressions: []
---

# Phase 2: Package Boundary & Build Scaffolding Verification Report

**Phase Goal:** Create `packages/libs/editor-core` and make the boundary, module resolution, styling, and compiler coverage machine-enforced rather than assumed.
**Verified:** 2026-09-22 (local: Node v24.21.0, pnpm 12.5.1; branch `editor/boundary`)
**Status:** passed
**Re-verification:** Yes — after gap closure (previous run `gaps_found`, 5/7, 1 BLOCKER + 1 WARNING)

## Goal Achievement

### Observable Truths

The 5 ROADMAP Phase-2 Success Criteria are the authoritative contract; PLAN frontmatter `must_haves` are merged on top (they may add, never subtract). Truth 6 is a PLAN-02-01 must-have (the editor-Vitest axis of its truth 3); truth 7 is derived from the goal plus the PROJECT constraint "`@motajs/editor` 对外功能、UI、宿主协议必须保持现状".

| #   | Truth   | Status     | Evidence       |
| --- | ------- | ---------- | -------------- |
| 1 | `packages/libs/editor-core` exists using `lib/` (not `src/`), with `private: true`, `type: module`, `sideEffects: false`, and all seven subpath `exports` targets present on disk | ✓ VERIFIED | `package.json`: `private=true`, `type=module`, `sideEffects=false`, 7 `exports` keys, `scripts` exactly `{typecheck, test}` (no `build`); every target exists on disk; no `src/` dir; no core `panda.config.ts`. `node scripts/verify/coreExports.js` → exit 0, `全部断言通过（7 subpaths、9 peers、8 singletons 单副本）`. |
| 2 | React/ReactDOM and the singleton libs are `peerDependencies` + `catalog:default`, and exactly one copy resolves | ✓ VERIFIED | 9 peers all `catalog:default`; `peerDependenciesMeta` = Semi optional only; 5 catalog entries present (`alien-signals 3.1.2`, `antd 6.2.1`, `blockly 12.3.1`, `immer 11.1.3`, `pixi.js 8.19.0`); `coreExports.js` realpath proof → `distinct=1` for all 8 shared singletons, Semi asserted from `service-worker` only (D-18). |
| 3 | `tsc -b` and a Vite build resolve core's intra-package imports consistently (amended D-06 sense), with the negative polarity proved | ✓ VERIFIED | Zero `@/` imports under `packages/libs/editor-core/lib/**`; core `tsc -b` + editor `tsc -b` + editor Vite build all green (`pnpm typecheck` / `pnpm build` exit 0); `coreBoundaries.js` plants a wrong relative import → core's own `tsc -p` fails with `TS2307` (exit 1), reproduced independently. |
| 4 | PandaCSS extracts a known core class and React Compiler transforms core TSX (both against the tool's real output) | ✓ VERIFIED | `corePandaClass.js` → exit 0, `.display_block { display: block` in the real `panda cssgen` output (17,015 B); `coreReactCompiler.js` → exit 0, both `react/compiler-runtime` and `_c(` present in a live Vite `transformRequest` of `CoreProbe.tsx`. |
| 5 | `dependency-cruiser` rules run in CI and fail on violation (two-polarity proven) | ✓ VERIFIED | `.dependencyCruiser.cjs` = 6 `forbidden`-only rules, all `severity: 'error'`; real tree cruises at 0 errors; `coreBoundaries.js` exit 0 with synthetic violations caught by name; the gates sit inside the existing 4 jobs; `ci-workflow.js` exit 0. |
| 6 | A core TSX file is resolved by the editor's **Vitest** pipeline (PLAN-02-01 truth 3's fourth axis) | ✓ VERIFIED | Committed `packages/apps/editor/src/__tests__/editorCoreResolution.test.tsx` imports `CoreProbe` from `@motajs/editor-core/react` through the editor's own Vitest pipeline and asserts module identity with the core source file. Re-run: `Test Files 1 passed (1)` / `Tests 2 passed (2)` (verbose reporter names both tests — collected, not skipped). Scratch mutation aliasing the module to a missing path → `Test Files 1 failed (1)`, exit 1; reverted → green. |
| 7 | The resolver migration introduces no regression to the editor's existing resolution / output (PROJECT "UI unchanged") | ✓ VERIFIED | `editor.css:1320` now `src: url('../assets/FiraCode.ttf')` (relative; no hard `@` alias restored). Fresh `pnpm --filter @motajs/editor build` → `Editor artifact: 57 files, raw 16.80 MiB` (baseline: 57 files / 16.80 MiB); `dist/assets/FiraCode-CzoQJ4O7.ttf` = 289,624 B, sha256 `5992ab96…` == source == `.planning/baseline/editor-manifest.json` entry; emitted CSS `@font-face{font-family:code;src:url(./FiraCode-CzoQJ4O7.ttf)}`; `url(@/` count in emitted CSS = 0. |

**Score:** 7/7 truths verified (0 present-behavior-unverified, 0 failed).

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ----------- | ------ | ------- |
| `packages/libs/editor-core/package.json` | PKG-01 manifest | ✓ VERIFIED | 7 `exports`, private/type/sideEffects, exactly `typecheck`+`test`, 9 catalog peers, Semi optional |
| `packages/libs/editor-core/tsconfig.json` | extends lib base + `@styled-system/*` path | ✓ VERIFIED | `include: ${configDir}/lib` |
| `packages/libs/editor-core/vitest.config.ts` | core's own Vitest project | ✓ VERIFIED | `resolvePlugin` + react-compiler + jsdom + `@styled-system` alias |
| `lib/index.ts` + `lib/{code,table,map,asset,shell}/index.ts` | six inert barrels | ✓ VERIFIED | each contains only `export {};` |
| `lib/react/index.ts` | `./react` barrel | ✓ VERIFIED | `export { CoreProbe } from './CoreProbe';` |
| `lib/react/CoreProbe.tsx` | temporary probe | ✓ VERIFIED (scaffold) | named `CoreProbe`, inline props, `useState` + template-literal `css`; WINDOWS entry 2 |
| `lib/__tests__/coreProbe.test.tsx` | smoke test | ✓ VERIFIED | 3 tests, all pass |
| `scripts/verify/coreExports.js` | PKG-01/02 + realpath dedupe | ✓ VERIFIED | exit 0 |
| `scripts/verify/coreBoundaries.js` | two-polarity cruise + TS2307 + edge direction | ✓ VERIFIED | exit 0 |
| `scripts/verify/corePandaClass.js` | PKG-04 extraction | ✓ VERIFIED | exit 0; outfile deleted |
| `scripts/verify/coreReactCompiler.js` | PKG-05 transform | ✓ VERIFIED | exit 0 |
| `scripts/verify/editorArtifactAssets.js` (G-01, new) | artifact-completeness gate | ✓ VERIFIED | 184 lines; exit 0 on fresh build; two-polarity proven (below) |
| `.dependencyCruiser.cjs` | VERIFY-05 rule set | ✓ VERIFIED | 6 rules, all error, forbid-only |
| `.planning/.../subpathStatus.json` | per-subpath content manifest | ✓ VERIFIED | 7 subpaths; only `./react` carries the probe |
| `packages/apps/editor/panda.config.ts` | widened `include` | ✓ VERIFIED | `'../../libs/editor-core/lib/**/*.{ts,tsx}'`; `syntax`/`exclude`/`outdir` unchanged |
| `packages/apps/editor/vite.config.ts` | `resolvePlugin`, no hard `@` | ✓ VERIFIED | alias set is only `@test`+`@styled-system`; `resolvePlugin` registered last |
| `packages/apps/editor/src/App.tsx` | real core consumer edge | ✓ VERIFIED | imports `@motajs/editor-core/react`; rendered in `display:none` wrapper beside `gameInject` |
| `packages/apps/editor/src/__tests__/editorCoreResolution.test.tsx` (G-02, new) | editor-Vitest resolver guard | ✓ VERIFIED | 33 lines; collected + passing; fails on resolver mutation |
| `packages/apps/editor/src/css/editor.css` | resolvable FiraCode url | ✓ VERIFIED | line 1320 relative `url('../assets/FiraCode.ttf')` |
| `.github/workflows/ci.yml` | 4 new steps inside the existing 4 jobs | ✓ VERIFIED | `coreBoundaries` in `lint`; `coreExports` in `typecheck`; `corePandaClass`+`coreReactCompiler` in `build`; `editorArtifactAssets` in `build` after `pnpm build` |

**Artifacts:** 20/20 present and substantive.

### Key Link Verification

| From | To  | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `packages/apps/editor/src/App.tsx` | `@motajs/editor-core/react` | value import + render | ✓ WIRED | `coreBoundaries.js` asserts the edge; the editor build bundles it |
| `packages/apps/editor/src/__tests__/editorCoreResolution.test.tsx` | `@motajs/editor-core/react` | package import via editor Vitest | ✓ WIRED | collected + passing; mutation to a missing path fails the suite |
| `lib/react/index.ts` | `CoreProbe` | re-export | ✓ WIRED | editor reaches the probe via the `./react` subpath, not a file path |
| `packages/apps/editor/panda.config.ts` | `packages/libs/editor-core/lib/**` | `include` glob | ✓ WIRED | `panda cssgen` emits `.display_block` from core source |
| `packages/apps/editor/vite.config.ts` | `resolvePlugin` | plugin registered last | ✓ WIRED | editor `tsc -b` + `pnpm build` pass |
| `packages/libs/editor-core/vitest.config.ts` | `resolvePlugin` | plugin | ✓ WIRED | core smoke test resolves relative + `@styled-system` |
| `scripts/verify/coreBoundaries.js` | `.dependencyCruiser.cjs` | `--config` spawn | ✓ WIRED | real tree 0 errors; synthetic violation named + non-zero |
| `scripts/verify/coreExports.js` | `catalog:` block | YAML parse | ✓ WIRED | every peer asserted present in catalog |
| `.github/workflows/ci.yml` | the five verifier scripts | `- run:` steps | ✓ WIRED | `ci-workflow.js` confirms 4 jobs + one root script each; the new artifact step runs after `pnpm build` |
| `packages/apps/editor/src/css/editor.css` | `../assets/FiraCode.ttf` | CSS `url()` | ✓ WIRED | emitted as `./FiraCode-CzoQJ4O7.ttf`; file present in `dist/`; gate (a)/(b)/(c) all pass |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `scripts/verify/corePandaClass.js` | extracted CSS | real `panda cssgen` subprocess output read from disk | Yes | ✓ FLOWING |
| `scripts/verify/coreReactCompiler.js` | transform `code` | live Vite `transformRequest` of the real probe | Yes | ✓ FLOWING |
| `scripts/verify/coreBoundaries.js` | depcruise JSON report | real CLI `spawnSync` | Yes | ✓ FLOWING |
| `scripts/verify/coreExports.js` | resolved realpaths | Node resolver + `fs.realpathSync` | Yes | ✓ FLOWING |
| `scripts/verify/editorArtifactAssets.js` | emitted CSS text + `dist/` filesystem | real `dist/` written by `pnpm build` | Yes | ✓ FLOWING |
| editor artifact `dist/assets/editor-*.css` | `@font-face` src | editor.css relative `url('../assets/FiraCode.ttf')` | Yes — resolves to the emitted font | ✓ FLOWING (was DISCONNECTED before the fix) |

### Behavioral Spot-Checks

All commands re-run independently in this session from the repo root (Windows, PowerShell).

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| PKG-01/02 structure + single-copy | `node scripts/verify/coreExports.js` | `全部断言通过（7 subpaths、9 peers、8 singletons 单副本）` | ✓ PASS (exit 0) |
| Boundary gate two-polarity + TS2307 | `node scripts/verify/coreBoundaries.js` | real tree 0 errors / 2 relative edges resolved / synthetic caught by name / `TS2307` observed | ✓ PASS (exit 0) |
| PKG-04 extraction | `node scripts/verify/corePandaClass.js` | `.display_block { display: block（产物 17015 字节）` | ✓ PASS (exit 0) |
| PKG-05 compiler transform | `node scripts/verify/coreReactCompiler.js` | both `react/compiler-runtime` and `_c(` present | ✓ PASS (exit 0) |
| Artifact asset completeness (G-01) | `node scripts/verify/editorArtifactAssets.js` | `全部断言通过（5 个产物样式表无 url(@/、3 个 Vite bundle 中的 2 个 url() 目标均可解析、FiraCode 字体已产出）` | ✓ PASS (exit 0) |
| Four-job CI contract | `node scripts/verify/ci-workflow.js` | `全部断言通过（4 个 job 与工具链固定值一致，无 secrets/environment/paths）` | ✓ PASS (exit 0) |
| Prettier setup gate | `node scripts/verify/prettier-setup.js` | `全部断言通过` | ✓ PASS (exit 0) |
| Lint-disable reasons gate | `node scripts/verify/lint-severities.js` | `扫描到 45 条 eslint-disable 注释，全部携带理由` | ✓ PASS (exit 0) |
| Lint | `pnpm lint` | `108 problems (0 errors, 108 warnings)` (Phase-1 baseline) | ✓ PASS (exit 0) |
| Format | `pnpm format:check` | `All matched files use Prettier code style!` | ✓ PASS (exit 0) |
| Typecheck | `pnpm typecheck` | editor-core + editor + service-worker + all libs `Done` | ✓ PASS (exit 0) |
| Unit fan-out | `pnpm test` | editor `97 files / 893 tests passed`; editor-core `1 file / 3 tests passed`; flake did not trigger | ✓ PASS (exit 0) |
| Core smoke test (explicit) | `pnpm --filter @motajs/editor-core test` | `Test Files 1 passed (1)` / `Tests 3 passed (3)` | ✓ PASS (exit 0) |
| Production build | `pnpm --filter @motajs/editor build` | `Editor artifact: 57 files, raw 16.80 MiB, gzip 4.29 MiB, brotli 3.58 MiB` | ✓ PASS (exit 0) |
| Lockfile agreement | `pnpm install --frozen-lockfile` | `Lockfile is up to date, resolution step is skipped` | ✓ PASS (exit 0) |
| Editor Vitest → core resolution (G-02) | `pnpm --filter @motajs/editor exec vitest run src/__tests__/editorCoreResolution.test.tsx --reporter=verbose` | both tests named and `Test Files 1 passed (1)` / `Tests 2 passed (2)` (collected, not skipped) | ✓ PASS (exit 0) |
| G-02 regression catch | alias `@motajs/editor-core/react` → missing path in `editor/vitest.config.ts`, run, revert | `Test Files 1 failed (1)` / `Tests no tests`, exit 1; reverted → green, `git diff` empty | ✓ PASS (gate is live) |
| G-01 two-polarity — alias reintroduced | scratch-mutate emitted CSS `./FiraCode…` → `@/assets/FiraCode.ttf`, run, revert | exit 1 with both `含未解析的 url(@/` and `引用的 … 未解析到产物里的文件`; restored → exit 0 | ✓ PASS (gate is live) |
| G-01 two-polarity — font hidden | rename `dist/assets/FiraCode-CzoQJ4O7.ttf` → `.bak`, run, revert | exit 1 with `引用的 ./FiraCode… 未解析…` and `dist 下没有任何 FiraCode*.ttf`; restored → exit 0 | ✓ PASS (gate is live) |
| Baseline manifest reconciliation | fresh `dist/editor-manifest.json` vs `.planning/baseline/editor-manifest.json` | both schemaVersion 2, 57 files; `assets/FiraCode-CzoQJ4O7.ttf` common with identical sha256; remaining deltas are 21 hash-renamed bundles + 4 Prettier-touched static files | ✓ PASS |

### Probe Execution

No probe scripts are declared by the phase and none exist (`scripts/*/tests/probe-*.sh` → none). The phase's "probes" are the throwaway fixtures embedded in `coreBoundaries.js` and the two scratch mutations performed here; both were executed, independently reproduced, and reverted. `git status --porcelain` is clean after every run.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| PKG-01 | 02-01, 02-02 | `packages/libs/editor-core` with `lib/`, `private`, `type: module`, `sideEffects: false`, full subpath exports | ✓ SATISFIED | manifest + 7 on-disk targets; `coreExports.js` exit 0 |
| PKG-02 | 02-02 | React/ReactDOM + singleton libs as `peerDependencies` + `catalog:default`, one copy resolves | ✓ SATISFIED | 9 catalog-pinned peers; Semi optional (D-18); 8/8 `distinct=1` |
| PKG-03 | 02-01, 02-03 | core tsconfig / `@/` resolution consistent under `tsc -b` and Vite (verified) | ✓ SATISFIED (amended D-06 sense) | relative intra-package imports; no `@/` under lib; `TS2307` polarity; editor Vitest axis now committed |
| PKG-04 | 02-03 | PandaCSS `include` covers `../../libs/editor-core/lib/**` and the generated CSS contains a known core class | ✓ SATISFIED | `panda cssgen` extraction asserts `.display_block` |
| PKG-05 | 02-03 | React Compiler transforms `packages/libs/editor-core/**` | ✓ SATISFIED | live Vite transform asserts both markers |
| VERIFY-05 | 02-03 | `dependency-cruiser` rules in CI (forbidden edges, singleton `requireZero`, no-cycles) | ✓ SATISFIED | 6 forbidden rules; D-16 rule authored and vacuous (D-17); gates in 4 CI jobs |

**Coverage:** 6/6 requirements satisfied. No ORPHANED requirements (REQUIREMENTS.md maps exactly PKG-01..05 + VERIFY-05 to Phase 2). Every requirement ID appears as a flagged spec-less assumption in the PLANs (8 assumption rows covering all six IDs; none authored as a resolved truth).

### Spec-less fallback integrity

- All six requirement IDs (PKG-01..05, VERIFY-05) appear as explicit `[flagged — … spec-less probe row unclassified/unresolved]` assumptions across the three PLANs (8 rows: PKG-01 ×2, PKG-03 ×2, PKG-02, PKG-04, PKG-05, VERIFY-05). No silent drops; none rewritten as a resolved truth; PKG-03's requirement text was not rewritten (amendment recorded in CONTEXT D-06/D-07 + plan assumptions).
- Every PLAN `must_haves.prohibitions` item is descriptor-less (`statement:` only — no `status`, `verification`, or fabricated `check_*` scalar). Confirmed across all three plans.
- `INTERFACE-NAME.md` covers exactly N-01..N-12; Section 4 introduces exactly the confirmed gap-closure names G-01/G-02. The only exported symbol introduced is `CoreProbe` (props typed inline — no unconfirmed named type); the five verifier scripts export nothing. No unconfirmed name landed.

### G-01 gate scope decision (adjudicated)

The new `editorArtifactAssets.js` gate makes check (b) (every non-`data:` `url()` target resolves to a real file) cover only the **direct Vite CSS bundles** under `dist/assets/`, while checks (a) (`url(@/` signature) and (c) (`FiraCode*.ttf` present) recurse. The reason: a strict recursive url() check surfaces the **pre-existing, unrelated** dangling reference in `dist/assets/theme/editor_color_dark.css:462` (`../blockly/media/sprites_white.png`; blockly 12 no longer ships that sprite — independently confirmed: the file is referenced and absent from `dist/`). The theme stylesheets are `fs.cp`-copied verbatim by `editor-artifact-plugin.ts` and fetched at runtime via `new URL('assets/theme/…', baseURI)`, so they never pass through Vite's CSS `url()` resolver and cannot exhibit the "alias/relative path no longer resolved" class this gate exists to catch.

**Verdict: defensible boundary, not a weakening.** The only class the BLOCKER belonged to — an asset reference that Vite should have resolved but didn't — is fully covered, and the alias signature is still checked recursively (so a `url(@/` accidentally introduced into a copied theme file would still fail). Residual limitation, documented in the script header: a dangling reference newly introduced into a verbatim-copied theme CSS would not be caught by (b). That is out of the alias-removal defect class and is not a Phase-2 regression. One documentation nit: the script header points at a phase-local `deferred-items.md` that was not created (the deviation is recorded in `gapClosureSummary.md` §Deviations #1 instead) — see Anti-Patterns.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `packages/libs/editor-core/lib/react/CoreProbe.tsx` | — | intentional Phase-2 scaffold, WINDOWS entry 2 | ℹ️ Info | documented, owned by Phase 4+ |
| `.dependencyCruiser.cjs` | 54 | `core-singletons-only-imported-by-composition-root` deliberately vacuous (D-17), WINDOWS entry 3 | ℹ️ Info | ships now, bites in Phase 3 |
| `scripts/verify/editorArtifactAssets.js` | 21 | header cites `.planning/phases/02-package-boundary-build-scaffolding/deferred-items.md`, which does not exist (the theme-reference deviation is recorded in `gapClosureSummary.md` instead) | ℹ️ Info | stale doc pointer only; no functional effect |
| `pnpm-workspace.yaml` | 72 | `typescript-eslint` pinned `^8.50.1` → `8.50.1` (commit `97e9aa7`), i.e. the caret no longer floats to 8.53.1 | ℹ️ Info | not a gate weakening: the same rule set runs; 8.53.1's parser broke `pnpm lint` outright with tsconfigRootDir errors. The previous report's "stays 8.53.1" parenthetical was imprecise. |
| — | — | `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` in phase-touched files | — | none found |

### Advisory (New Scope, Unevidenced)

None — no new-scope unevidenced finding required advisory treatment. The two Info items above are documentation-only and are not blockers.

### Human Verification Required

None outstanding. The `dependency-cruiser` package-legitimacy checkpoint (plan 02-03 Task 1) was a designed `checkpoint:human-verify`, satisfied by explicit user approval ("dependency-cruiser 18.2.0 approved"), recorded in the SUMMARY; the resulting pin is machine-verified here. The only UI surface touched by this phase (the `CoreProbe` render) sits inside a `display:none` wrapper, and the CSS change keeps the same font asset — visual parity is a Phase 6/12 concern, not a Phase-2 success criterion.

### Gaps Summary

None. Both prior gaps are closed and independently reproduced:

1. **BLOCKER closed (truth 7).** `editor.css:1320` now uses the relative `url('../assets/FiraCode.ttf')`; the fresh build emits 57 files / 16.80 MiB with `assets/FiraCode-CzoQJ4O7.ttf` (289,624 B, sha256 `5992ab96…` identical to the source file and to the recorded baseline entry). No emitted stylesheet contains `url(@/`. The new `editorArtifactAssets.js` gate is live: it fails on both scratch mutations and passes once restored, and it runs inside the existing `build` job after `pnpm build`.
2. **WARNING closed (truth 6).** The editor's Vitest resolver axis is now exercised by a committed test that is collected (verbose reporter names both cases), passes (1 file / 2 tests), and fails (exit 1) when the module is aliased to a missing path.

The five ROADMAP Success Criteria and all six mapped requirements are satisfied. The full local gate set (`lint`, `format:check`, `typecheck`, `test`, `build`, `install --frozen-lockfile`) is green; `ci-workflow.js` confirms exactly four jobs with no secrets/environment/paths and no new or renamed job; no gate was weakened; no debt markers exist in phase-touched files; `git status --porcelain` shows only this untracked report before commit.

---

_Verified: 2026-09-22_
_Verifier: the agent (gsd-verifier)_
