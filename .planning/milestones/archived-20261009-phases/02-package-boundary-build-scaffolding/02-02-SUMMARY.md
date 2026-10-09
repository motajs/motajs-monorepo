---
phase: 02-package-boundary-build-scaffolding
plan: 02
subsystem: infra
tags: [pnpm-workspace, catalog, peerDependencies, editor-core, package-boundary, realpath, node-resolution, ci-workflow, verifier]

# Dependency graph
requires:
  - phase: 02-package-boundary-build-scaffolding
    plan: 01
    provides: the real private editor-core workspace package (lib/ layout, seven-subpath exports, typecheck+test scripts, no build), the CoreProbe/./react barrel, and the editor's real import of the package
provides:
  - "five new pnpm-workspace catalog entries (alien-signals 3.1.2, antd 6.2.1, blockly 12.3.1, immer 11.1.3, pixi.js 8.19.0) so catalog:default can resolve for every PKG-02 peer"
  - "editor-core's nine-entry peerDependencies (all catalog:default) + peerDependenciesMeta marking @douyinfe/semi-ui optional + the mirrored devDependencies that make every peer resolvable from core itself"
  - "scripts/verify/coreExports.js: PKG-01 structural assertions + PKG-02 peer/catalog assertions + the D-15 realpath single-copy proof"
  - ".planning/phases/02-package-boundary-build-scaffolding/subpathStatus.json: the per-subpath content manifest coreExports cross-checks against the exports map"
  - "one node scripts/verify/coreExports.js step inside the existing CI typecheck job (four-job contract unchanged)"
affects: [02-03, 03-kernel, 04-resources, 07-table, 08-code, 09-asset, 10-map, editor-build, ci]

# Actuals (#2632) — same estimateTokens scale as the plan's `estimate` (chars/4 over the realized diff)
actuals:
  tokens: 4583
  tasks: 2
  commits: 2
  plan_head_before: 4b22f1310f7d5cb61363f898b44132bea36eb04f

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "catalog:default is only resolvable for a package the catalog defines, so the catalog entry is added BEFORE the peer declaration that references it (D-19), and coreExports.js asserts every declared peer is defined in the catalog block"
    - "A peer must also be a devDependency (the 'peer + devDependency triple') or the package cannot resolve it from itself — which is exactly what the realpath verifier needs"
    - "Exactly-one-copy is proven by createRequire(<consumerDir>/package.json).resolve(name) + fs.realpathSync from each REAL consumer dir, compared as a Set — never by pnpm why text, which only reflects the lockfile"
    - "A declared-but-unconsumed peer is encoded as peerDependenciesMeta.optional and asserted against its real consumer (service-worker), with the reason printed — never skipped and never forced symmetric by adding a dependency to the editor"
    - "Some claims are only checkable against the real tool's output: the verifier cross-checks the exports map against a written-down manifest, so the two descriptions of the surface cannot drift"

key-files:
  created:
    - scripts/verify/coreExports.js
    - .planning/phases/02-package-boundary-build-scaffolding/subpathStatus.json
  modified:
    - pnpm-workspace.yaml
    - packages/libs/editor-core/package.json
    - pnpm-lock.yaml
    - .github/workflows/ci.yml

key-decisions:
  - "The five catalog entries are pinned to the exact versions the editor already installs (no caret), so no new package enters the graph and nothing re-resolves (T-02-SC)"
  - "peerDependenciesMeta carries exactly one key — @douyinfe/semi-ui optional: true — because no editor or core code path resolves it (D-18)"
  - "pnpm install was run un-frozen once to record the new edges, then pnpm install --frozen-lockfile had to pass; the lockfile diff is 36 added lines (5 catalog entries + the nine core dev edges), with no re-resolution of any existing package"
  - "coreExports.js treats a MODULE_NOT_FOUND as a named failure carrying the package and the consumer directory — never a silent skip (T-02-04)"
  - "The CI change is one extra - run: step inside the existing typecheck job; no job added, renamed, or removed (D-13/T-02-05)"

patterns-established:
  - "Package-boundary verifier: structural (manifests + on-disk targets) + declarative (peers vs catalog) + resolution (realpath per consumer) in one script with a collects-all-failures contract"
  - "Two-polarity evidence for a verifier: the green run plus a temporarily mutated tree proving each named failure branch actually fires"

requirements-completed: [PKG-01, PKG-02]

# Coverage metadata (#1602) — one entry per shipped deliverable
coverage:
  - id: D1
    description: "The workspace catalog defines alien-signals 3.1.2, antd 6.2.1, blockly 12.3.1, immer 11.1.3 and pixi.js 8.19.0, and editor-core declares exactly the nine PKG-02 peers as catalog:default with @douyinfe/semi-ui marked optional"
    requirement: "PKG-02"
    verification:
      - kind: other
        ref: "node -e '<task1 peer/catalog assertion>' -> 'peer surface declared and catalogued: 9 peers' exit 0"
        status: pass
      - kind: other
        ref: "pnpm install --frozen-lockfile -> 'Lockfile is up to date, resolution step is skipped' exit 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "PKG-01 structure is machine-checked: private/type/sideEffects hold, exports has exactly the seven subpaths, every exports target exists on disk as a file, scripts is exactly typecheck+test with no build, and subpathStatus.json lists all seven and marks only ./react as carrying the probe"
    requirement: "PKG-01"
    verification:
      - kind: other
        ref: "node scripts/verify/coreExports.js -> '全部断言通过（7 subpaths、9 peers、8 singletons 单副本）' exit 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-15 single-copy proof: each of the eight shared singletons (react, react-dom, antd, alien-signals, immer, monaco-editor, pixi.js, blockly) resolves to exactly one realpath from both packages/apps/editor and packages/libs/editor-core; @douyinfe/semi-ui is asserted against packages/apps/service-worker only with the reason printed (D-18)"
    requirement: "PKG-02"
    verification:
      - kind: other
        ref: "node scripts/verify/coreExports.js -> exit 0; all eight singletons reported distinct=1 and semi resolved from service-worker"
        status: pass
    human_judgment: false
  - id: D4
    description: "The new gate runs inside the existing CI typecheck job and the four-job contract still verifies (lint/typecheck/unit/build, each calling its root fan-out script, no added or renamed job)"
    requirement: "PKG-02"
    verification:
      - kind: other
        ref: "node scripts/verify/ci-workflow.js -> '全部断言通过（4 个 job 与工具链固定值一致…）' exit 0"
        status: pass
    human_judgment: false

# Metrics
duration: 8min
completed: 2026-09-22
status: complete
---

# Phase 2 Plan 02: catalog gaps, nine optional-aware peers, and the machine-checked core manifest Summary

**`catalog:default` now resolves for all nine PKG-02 peers, and three otherwise-silent claims — subpath targets exist on disk, peers are defined in the catalog, and each shared singleton resolves to exactly one realpath from both consumer dirs — are executable assertions running in the existing CI typecheck job.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-09-22T11:33:28+08:00
- **Completed:** 2026-09-22T11:41:44+08:00
- **Tasks:** 2 / 2
- **Files modified:** 6 (2 created, 4 modified) — includes `pnpm-lock.yaml`

## Accomplishments

- Five catalog entries (`alien-signals` 3.1.2, `antd` 6.2.1, `blockly` 12.3.1, `immer` 11.1.3, `pixi.js` 8.19.0) were pinned to the versions the editor already installs, so `catalog:default` resolves for every PKG-02 peer without introducing a new package into the graph.
- `packages/libs/editor-core/package.json` declares exactly the nine PKG-02 peers as `catalog:default`, marks `@douyinfe/semi-ui` `optional: true` (the only `peerDependenciesMeta` key), and mirrors all nine into `devDependencies` so each peer resolves from core itself.
- `scripts/verify/coreExports.js` makes three classes of silent failure loud: (a) PKG-01 structure — the seven `exports` targets exist on disk and match `subpathStatus.json`; (b) PKG-02 declaration — nine catalog-pinned peers and Semi optional; (c) D-15 — one distinct realpath per shared singleton from both consumer directories.
- `.planning/phases/02-package-boundary-build-scaffolding/subpathStatus.json` records, per subpath, its `exports` target and whether it is an empty barrel or carries the probe — the two descriptions of the surface are cross-checked, so they cannot drift.
- The `typecheck` CI job gained exactly one `- run:` step and `scripts/verify/ci-workflow.js` still verifies the four-job contract (no job added, renamed, or removed).
- The negative polarities were observed, not assumed: a missing `exports` target, a `catalog:default` peer with no catalog entry, a duplicated realpath, and a `MODULE_NOT_FOUND` each produced a named `coreExports:` failure and exit 1 (mutations reverted; see Verification evidence).

## Task Commits

Each task was committed atomically:

1. **Task 1: Fill the catalog gaps and declare the nine peers with Semi optional** - `7ffd105` (feat)
2. **Task 2: Write the exports, peer and single-copy verifier, its subpath manifest, and wire it into the typecheck job** - `eee131c` (feat)

**Plan metadata:** (this SUMMARY commit) (docs: complete plan)

_Note: no TDD tasks; each task is a single commit._

## Files Created/Modified

- `pnpm-workspace.yaml` - catalog gains `alien-signals: 3.1.2`, `antd: 6.2.1`, `blockly: 12.3.1`, `immer: 11.1.3`, `pixi.js: 8.19.0` (alphabetical). `allowBuilds`, `overrides` and `minimumReleaseAgeExclude` untouched; the plan-01 `typescript-eslint: 8.50.1` pin is preserved.
- `packages/libs/editor-core/package.json` - nine-entry `peerDependencies` (all `catalog:default`), one-entry `peerDependenciesMeta` (Semi optional), and the nine-name `devDependencies` mirror; `private`/`type`/`sideEffects`/`exports`/`scripts` unchanged.
- `pnpm-lock.yaml` - +36 lines: the five `catalogs:` entries and the nine `packages/libs/editor-core` dev edges. No existing resolved version changed.
- `scripts/verify/coreExports.js` - the new boundary verifier (collects every failure, one `coreExports: …` line per failure, exit 1 on any, `全部断言通过` on success). No network, imports no workspace package.
- `.planning/phases/02-package-boundary-build-scaffolding/subpathStatus.json` - `schemaVersion` + `phase` + `note`, and the seven-key `subpaths` object (`target`/`content`/`carriesProbe`).
- `.github/workflows/ci.yml` - one added `- run: node scripts/verify/coreExports.js` step in the `typecheck` job, after `- run: pnpm typecheck`.

## Decisions Made

- **Semi is asserted where it is actually consumed.** D-18's honest encoding (`optional: true`) plus a `service-worker`-only realpath check, with the reason printed on every run — no `@douyinfe/semi-ui` was added to the editor to force a symmetric check.
- **The realpath proof uses both real consumers.** `packages/apps/editor` and `packages/libs/editor-core`, resolved through `createRequire(<dir>/package.json)` and compared as a `Set`; `pnpm why` was deliberately not used because it reports lockfile intent, not what Node loads.
- **The catalog entries are added before the peers that reference them**, and the verifier re-asserts the catalog contains every declared peer — so a `catalog:default` that cannot resolve is a build-time failure, not a latent one.
- **The manifest schema is minimal** (agent discretion per the plan): `schemaVersion`, `phase`, `note`, `subpaths[sp] = { target, content, carriesProbe }`.
- **Un-frozen install once, then frozen.** `pnpm install` was run to record the new edges, then `pnpm install --frozen-lockfile` verified manifest/lockfile agreement — as the plan requires.

## Deviations from Plan

**None.** The plan executed exactly as written. The lockfile rewrite was the intended peer/dev-edge recording (36 added lines, no re-resolution), and no extra file or symbol name was introduced beyond N-06 (`scripts/verify/coreExports.js`) and N-11 (`subpathStatus.json`).

## Issues Encountered

- Verifying the verifier's failure branches required temporarily mutating tracked files (a bogus `exports` target, a renamed catalog key) and temporarily pointing `EDITOR_DIR` at a scratch consumer holding a stub `react`. Every mutation was reverted (`git checkout` for the two tracked files, re-edit for the script, scratch dir deleted) and the green run was re-confirmed; `git diff` against plan head shows no residue.
- Terminal mojibake on Chinese output was a PowerShell console-codepage artifact only; setting `[Console]::OutputEncoding` to UTF-8 showed the script's bytes are correct. No script change was needed.

## User Setup Required

None - no external service configuration required.

## Verification evidence (verbatim)

Task 1 `<automated>` (`pnpm install --frozen-lockfile && pnpm --filter @motajs/editor-core typecheck && node -e "<peer/catalog assertion>"`):

1. `pnpm install --frozen-lockfile` → `Lockfile is up to date, resolution step is skipped` / `Done in 291ms using pnpm v12.5.1`, exit **0**
2. `pnpm --filter @motajs/editor-core typecheck` → `$ tsc -b`, exit **0**
3. peer/catalog assertion → `peer surface declared and catalogued: 9 peers`, exit **0**

Task 2 `<automated>` (`node scripts/verify/coreExports.js && node scripts/verify/ci-workflow.js && pnpm exec prettier --check scripts/verify/coreExports.js`):

1. `node scripts/verify/coreExports.js` → exit **0**; printed `coreExports: @douyinfe/semi-ui 只从 packages/apps/service-worker 断言…解析到 node_modules/.pnpm/@douyinfe+semi-ui@2.90.0_…/lib/cjs/index.js` and `coreExports: 全部断言通过（7 subpaths、9 peers、8 singletons 单副本）`
2. `node scripts/verify/ci-workflow.js` → `ci-workflow: 全部断言通过（4 个 job 与工具链固定值一致，无 secrets/environment/paths）`, exit **0**
3. `pnpm exec prettier --check scripts/verify/coreExports.js` → `All matched files use Prettier code style!`, exit **0**

Plan-level `<verification>`:

4. `pnpm --filter @motajs/editor-core typecheck` → exit **0**; `pnpm --filter @motajs/editor-core test` → `Test Files 1 passed (1)` / `Tests 3 passed (3)`, exit **0**
5. `pnpm lint` → `108 problems (0 errors, 108 warnings)`, exit **0** (identical to the Phase 1 baseline); `pnpm format:check` → `All matched files use Prettier code style!`, exit **0**
6. `.github/workflows/ci.yml` `git diff` → exactly `+      - run: node scripts/verify/coreExports.js` after `- run: pnpm typecheck` in `typecheck`; no job line changed

Single-copy raw evidence (both consumers → one realpath, `distinct=1` for all eight):

| Singleton | editor realpath | core realpath | distinct |
|---|---|---|---|
| react | `.pnpm/react@19.2.3/node_modules/react/index.js` | same | 1 |
| react-dom | `.pnpm/react-dom@19.2.3_react@19.2.3/…/index.js` | same | 1 |
| antd | `.pnpm/antd@6.2.1_date-fns@2.30.0__71495e93…/lib/index.js` | same | 1 |
| alien-signals | `.pnpm/alien-signals@3.1.2/…/cjs/index.cjs` | same | 1 |
| immer | `.pnpm/immer@11.1.3/…/dist/cjs/index.js` | same | 1 |
| monaco-editor | `.pnpm/monaco-editor@0.56.0/…/min/vs/index.js` | same | 1 |
| pixi.js | `.pnpm/pixi.js@8.19.0/…/lib/index.js` | same | 1 |
| blockly | `.pnpm/blockly@12.3.1_supports-color@7.2.0/…/index.js` | same | 1 |

Negative-polarity evidence (temporary mutations, all reverted):

- Missing exports target → `coreExports: exports["./react"] 指向的目标在磁盘上不存在：./lib/react/__missing_probe.ts`, plus the manifest-drift line → exit **1**
- Peer with no catalog entry → `coreExports: peer immer 声明为 catalog:default，但 catalog 里没有它的条目` → exit **1**
- Two realpaths → `coreExports: 单例 react 从两个消费方解析出 2 个 realpath（应恰好 1 个）：…` → exit **1**
- `MODULE_NOT_FOUND` → `coreExports: 单例 react-dom 无法从 packages/apps/editor 解析（MODULE_NOT_FOUND: Cannot find module 'react-dom' …）` → exit **1** (named, not swallowed)
- After reverting every mutation: `node scripts/verify/coreExports.js` → `全部断言通过（7 subpaths、9 peers、8 singletons 单副本）`, exit **0**

## Next Phase Readiness

- Ready for **plan 02-03** (boundary gate and consumer-pipeline coverage): the core manifest, the seven subpath files and `scripts/verify/coreExports.js` all exist, and `.planning/.../subpathStatus.json` already gives dependency-cruiser a file node per subpath to reason about.
- Carries forward from plan 01: (a) `.planning/baseline/editor-manifest.json` is stale relative to the tree; (b) the root ESLint config still assumes `typescript-eslint@8.50.1` (pinned in the catalog by plan 01 and preserved here).

---

*Phase: 02-package-boundary-build-scaffolding*
*Completed: 2026-09-22*

## Self-Check: PASSED

- Created files exist on disk: `scripts/verify/coreExports.js` (346-line commit) and `.planning/phases/02-package-boundary-build-scaffolding/subpathStatus.json` — both present and committed.
- Commits exist: `7ffd105` (Task 1) and `eee131c` (Task 2); `git rev-list --count 4b22f13..HEAD` = **2**.
- `plan_head_before`: `4b22f1310f7d5cb61363f898b44132bea36eb04f`; `commits` measured = **2** (`actuals.commits`).
- No temporary verification residue: `git diff` for `packages/libs/editor-core/package.json` and `pnpm-workspace.yaml` is empty, `EDITOR_DIR` in `coreExports.js` is back to `packages/apps/editor`, and the scratch consumer dir is deleted (`Test-Path` = False).
- No untracked files remain (`git status --short` empty after the Task 2 commit).
