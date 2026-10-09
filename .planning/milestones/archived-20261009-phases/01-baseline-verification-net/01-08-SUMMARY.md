---
phase: 01-baseline-verification-net
plan: 08
subsystem: tooling
tags: [prettier, eslint, eslint-config-prettier, eslint-plugin-prettier, formatting, single-quotes, pnpm-catalog, gitattributes, verify-02]

# Dependency graph
requires:
  - phase: 01-baseline-verification-net (01-01)
    provides: repaired pnpm install so `pnpm exec eslint` / `pnpm exec prettier` resolve from the root
  - phase: 01-baseline-verification-net (01-06)
    provides: the non-fixing root `eslint .` gate, the `basePath`-scoped editor config mount, and the 46-error baseline this plan has to shrink
provides:
  - ".prettierrc.json — the single Prettier config file (singleQuote true, printWidth 120, endOfLine lf)"
  - ".prettierignore — excludes .planning, packages/external, styled-system, node_modules, dist, lockfile, build/test output, Markdown and YAML"
  - ".gitattributes — `* text=auto eol=lf` so prettier --check behaves identically on Windows and Linux"
  - "three catalog-pinned devDependencies (prettier, eslint-config-prettier, eslint-plugin-prettier) + root format / format:check scripts"
  - "scripts/verify/prettier-setup.js — asserts the config, the ignore rules, the scripts, the lockfile declarations and the resolved ESLint rule severities"
  - "root eslint.config.js and packages/apps/editor/eslint.config.js rewired to Prettier; **/styled-system/ no longer linted"
  - "the reformatted repository tree (626 files, formatting-only)"
  - "CONVENTIONS.md + regenerated AGENTS.md describing Prettier as the single formatting authority"
affects: [01-07 (ci.yml lint job), 01-09 (residual lint debt inventory), editor-core extraction phases]

# Actuals (#2632)
# Basis: chars/4 over `git diff ecbc598..HEAD` = 4,715,848 chars / 4. A repo-wide reformat
# legitimately produces a diff two orders of magnitude larger than the reasoning effort
# the 55,000-token estimate was sizing; recorded as measured, not rounded toward it.
actuals:
  tokens: 1178962
  tasks: 4
  commits: 4
  plan_head_before: ecbc59842c26258a134072f01f4db1651c0443fd

# Tech tracking
tech-stack:
  added:
    - prettier 3.9.8 (devDependency, catalog-pinned)
    - eslint-config-prettier 10.1.8 (devDependency, catalog-pinned)
    - eslint-plugin-prettier 5.5.6 (devDependency, catalog-pinned)
  patterns:
    - "One formatting authority: Prettier owns layout, ESLint only reports the difference (`prettier/prettier: error`)"
    - "`eslint-config-prettier/flat` composed LAST in a flat `extends` array so the later entry wins"
    - "Generated output (PandaCSS `styled-system`) is ignored, never edited"
    - "`.gitattributes` LF policy makes a line-ending-sensitive gate platform-independent"

key-files:
  created:
    - .prettierrc.json
    - .prettierignore
    - .gitattributes
    - scripts/verify/prettier-setup.js
  modified:
    - package.json
    - pnpm-workspace.yaml
    - pnpm-lock.yaml
    - eslint.config.js
    - packages/apps/editor/eslint.config.js
    - packages/apps/editor/dprint.jsonc
    - packages/apps/editor/src/hooks/useImageAssetUrl.ts
    - .planning/codebase/CONVENTIONS.md
    - AGENTS.md
    - "626 tracked source/config files touched by the reformat (see the reformat commit)"

key-decisions:
  - "Single quotes are the ONE quote style (`singleQuote: true`); Prettier may still emit double quotes where that avoids an escape, and no `@stylistic/quotes` rule may fight it."
  - "`eslint-config-prettier/flat` is the LAST entry of the shared `extends` array — in a flat config the later entry wins, so this is what actually disables the conflicting @stylistic rules."
  - "The `@stylistic` `quotes` option was CHANGED to `single` rather than deleted, so a stylistic rule that eslint-config-prettier does not cover would still agree with Prettier."
  - "`prettier/prettier: error` was registered in the editor's own config as well as the root shared block, because `pnpm --filter @motajs/editor lint` resolves only that file and would otherwise enforce nothing."
  - "Markdown and YAML are excluded from Prettier: the repo's Markdown is Chinese prose and AGENTS.md is regenerated; the YAML is hand-maintained configuration with no formatting defects."
  - "`pnpm-lock.yaml` must stay purely additive — the install was pinned to pnpm 11.10.0 with `resolutionMode=time-based` anchored to the lockfile's original mtime so no pre-existing dependency version moved."
  - "Deleting a stylistic rule would have been the fallback fix; it was not needed — zero `@stylistic/*` errors remain, so no rule was deleted."

patterns-established:
  - "Prettier-last ESLint composition: `eslint-config-prettier/flat` terminal in `extends` + `prettier/prettier: error`"
  - "Config-resolution assertions in a repo-owned verifier (parse `--print-config` JSON, never match config source text)"
  - "Time-anchored lockfile resolution when adding packages to a repo whose ranges are caret-floating"

requirements-completed: []   # VERIFY-02 is declared by 01-07, 01-08 and 01-09; the shared-ID gate keeps it open until the last declaring plan has a SUMMARY. `requirements ready-ids` reported 0/1 ready at close-out.

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Prettier is installed from the workspace catalog with exactly one config file and a `.prettierignore` that provably excludes .planning, packages/external, styled-system, node_modules, dist, the lockfile and build/test output"
    requirement: "VERIFY-02"
    verification:
      - kind: automated_ui
        ref: "`node scripts/verify/prettier-setup.js` -> exit 0 (config options, getFileInfo ignore checks for all six targets, format/format:check scripts, three lockfile declarations)"
        status: pass
      - kind: integration
        ref: "`pnpm format:check` -> 'All matched files use Prettier code style!', exit 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "Formatting is enforced through ESLint with Prettier as the last word, identically for a root-config file and an editor-config file"
    requirement: "VERIFY-02"
    verification:
      - kind: automated_ui
        ref: "`eslint --print-config scripts/baseline/collect.js` -> prettier/prettier [2], @stylistic/quotes [0,'single']; `eslint --print-config packages/apps/editor/src/hooks/useImageAssetUrl.ts` -> prettier/prettier [2], @stylistic/quotes [0]"
        status: pass
      - kind: integration
        ref: "`node scripts/verify/prettier-setup.js` asserts both resolved configs plus that react-hooks/react-refresh/no-explicit-any survive in the shared rule set"
        status: pass
    human_judgment: false
  - id: D3
    description: "The 4 formatting/generated-output errors from the 46-error baseline are gone: no `@stylistic/*` error and nothing under `styled-system` is linted"
    requirement: "VERIFY-02"
    verification:
      - kind: integration
        ref: "`eslint . -f json` -> 42 errors / 108 warnings; zero ruleIds starting `@stylistic/`; zero files under styled-system"
        status: pass
      - kind: integration
        ref: "`eslint packages/apps/editor/styled-system/helpers.mjs` and `.../css/cx.mjs` -> exit 0, 'File ignored because of a matching ignore pattern'"
        status: pass
    human_judgment: false
  - id: D4
    description: "The reformat is provably formatting-only: typecheck, the editor unit suite and the production build all stay green and the artifact stays inside the 20 MiB budget"
    requirement: "VERIFY-02"
    verification:
      - kind: integration
        ref: "`pnpm typecheck` -> exit 0 (9 packages + service-worker)"
        status: pass
      - kind: unit
        ref: "`pnpm --filter @motajs/editor test` -> 96 files / 891 tests passed (baseline 865), exit 0"
        status: pass
      - kind: integration
        ref: "`pnpm build` -> exit 0; editor artifact 57 files / 17,616,558 bytes / 16.8005 MiB (baseline 17,618,356 bytes / 16.80 MiB; budget 20 MiB)"
        status: pass
      - kind: other
        ref: "TypeScript-API AST + comment-multiset comparison of HEAD vs working tree over all 626 changed files: 610 identical, 12 character-normalised-identical (CSS/LESS/HTML), 4 hand-inspected and confirmed formatting-only"
        status: pass
    human_judgment: false
  - id: D5
    description: "Vendored and planning trees keep their bytes: `.planning/**` and `packages/external/**` are never rewritten by Prettier, and the deploy workflow is untouched"
    requirement: "VERIFY-02"
    verification:
      - kind: integration
        ref: "`git status --short` after the reformat -> no path under .planning/ or packages/external/ modified; `git diff --exit-code -- .github/workflows/deploy-editor-h5test.yml` -> exit 0"
        status: pass
    human_judgment: false
  - id: D6
    description: "The documented convention matches the code and the generated agent instructions agree with the codebase document"
    requirement: "VERIFY-02"
    verification:
      - kind: integration
        ref: "`gsd-tools generate-claude-md --output AGENTS.md` -> action 'updated'; the user-mandated Project Rules block survives; the conventions block carries the Prettier/single-quote text"
        status: pass
      - kind: automated_ui
        ref: "grep: CONVENTIONS.md no longer states a double-quote convention, names Prettier as formatter of record, states one quote style, and records the Markdown/YAML exclusion and the .gitattributes LF policy"
        status: pass
    human_judgment: false

# Metrics
duration: 2h 24m
completed: 2026-09-21
status: complete
---

# Phase 01 Plan 08: Prettier as the single formatting authority (single quotes) Summary

**Prettier 3.9.8 adopted as the repository's one formatter, wired into ESLint via `eslint-plugin-prettier` with `eslint-config-prettier/flat` composed last, and applied to 626 files — removing the two `@stylistic/*` errors and the two PandaCSS-generated-output errors from the lint baseline without touching a single production semantic.**

## Performance

- **Duration:** 2h 24m
- **Started:** 2026-09-21T04:51:58Z
- **Completed:** 2026-09-21T07:16:54Z
- **Tasks:** 4
- **Files modified:** 635 tracked files across the plan (626 of them by the reformat commit alone)

## Accomplishments

- **One formatting authority.** `prettier` 3.9.8, `eslint-config-prettier` 10.1.8 and `eslint-plugin-prettier` 5.5.6 are catalog-pinned devDependencies with root `format` / `format:check` scripts. `.prettierrc.json` is the only Prettier config file in the repository; `pnpm format:check` exits 0 on the formatted tree.
- **Quotes unified on single quotes, with exactly one owner.** The `@stylistic` `quotes` option is now `single`, and `eslint-config-prettier/flat` (composed LAST in `extends`) turns `@stylistic/quotes` off in the resolved config for both an editor file (`[0]`) and a non-editor file (`[0,"single",…]`). No rule permits a second style.
- **Formatting is enforced by the lint gate.** `prettier/prettier` is at error severity in the resolved config of both an editor file and a non-editor file, and the shared rule set (`@typescript-eslint/no-explicit-any`, `react-hooks/rules-of-hooks`, the `react-hooks`/`react-refresh` plugins) survived intact.
- **Generated output is ignored, not edited.** `**/styled-system/` was added to the root `ignores` and to the editor's `globalIgnores`; `eslint packages/apps/editor/styled-system/helpers.mjs` and `.../css/cx.mjs` both exit 0 reporting the path as ignored.
- **The reformat is mechanically provable.** 626 files changed; a TypeScript-API AST + comment-multiset comparison against HEAD (ignoring exactly the transformations Prettier is allowed to make) proves 610 files syntactically identical, 12 more character-normalised-identical, and the remaining 4 were inspected by hand and are Prettier's documented CSS number/hex normalisations. `pnpm typecheck`, the editor unit suite and `pnpm build` all stay green.
- **The lint baseline shrank by exactly the predicted amount.** 46 errors → 42 errors, 126 warnings → 108 warnings; zero `@stylistic/*` errors and zero `styled-system` findings remain.

## Verification Evidence

| Check | Command | Result |
|-------|---------|--------|
| Setup verifier | `node scripts/verify/prettier-setup.js` | **pass** — exit 0, all assertions green |
| Format gate | `pnpm format:check` | **pass** — exit 0, "All matched files use Prettier code style!" |
| Resolved config — non-editor | `eslint --print-config scripts/baseline/collect.js` | **pass** — `prettier/prettier = [2]`, `@stylistic/quotes = [0,"single",{…}]`, `no-explicit-any` + `react-hooks`/`react-refresh`/`prettier` plugins present |
| Resolved config — editor | `eslint --print-config packages/apps/editor/src/hooks/useImageAssetUrl.ts` | **pass** — `prettier/prettier = [2]`, `@stylistic/quotes = [0]` |
| Generated output ignored | `eslint packages/apps/editor/styled-system/helpers.mjs` / `.../css/cx.mjs` | **pass** — exit 0, "File ignored because of a matching ignore pattern" |
| Typecheck | `pnpm typecheck` | **pass** — exit 0, 9 packages |
| Editor unit suite | `pnpm --filter @motajs/editor test` | **pass** — 96 files / **891 tests** (baseline 865), exit 0 |
| Build + artifact budget | `pnpm build` | **pass** — editor artifact **57 files / 17,616,558 bytes / 16.8005 MiB** = 84.0023 % of the 20 MiB ceiling (baseline 57 files / 17,618,356 bytes / 84.0109 %; Δ = −1,798 bytes) |
| Artifact invariants | manifest inspection | **pass** — `exactlyOneTsWorker` (`ts.worker-DzfQDkHh.js`), `noCssHtmlWorkers`, `schemaVersion` 2 |
| Lint inventory | `eslint . -f json` | **42 errors / 108 warnings** — zero `@stylistic/*`, zero `styled-system` |
| Planning/vendored trees | `git status --short` after `prettier --write .` | **pass** — no `.planning/**` or `packages/external/**` path modified |
| Deploy workflow | `git diff --exit-code -- .github/workflows/deploy-editor-h5test.yml` | **pass** — exit 0 |
| Lockfile surgical | `git diff -- pnpm-lock.yaml` | **pass** — 86 insertions, 0 deletions; only the three packages + their four unique transitive deps (`@pkgr/core`, `fast-diff`, `prettier-linter-helpers`, `synckit`); no pre-existing version moved |

## How the "formatting-only" claim was checked

The reformat touched 626 tracked files (+39,962 / −36,252 lines). `git diff --stat` was inspected, and because a human skim of 39k lines is not evidence, a temporary Node script (run from outside the repo, deleted afterwards) compared every changed file's HEAD blob with its working-tree content:

1. **AST signature (610 files).** Both revisions are parsed with the TypeScript compiler API (`ts.createSourceFile`, `ScriptTarget.Latest`, the right `ScriptKind` per extension) and reduced to a signature of node kinds plus the semantic value of identifiers, string literals, numeric literals (compared by `Number(...)`), bigint/regex literals and template spans. Deliberately ignored, because Prettier is *allowed* to change them: `ParenthesizedExpression` / `ParenthesizedType`, `JsxText` whitespace from JSX reflow, the prettier-inserted `{" "}` that preserves a significant JSX space, property names written `"accept"` vs `accept` (`quoteProps: "as-needed"`), and numeric spellings. Comment text is compared as a whitespace-normalised multiset. Any semantic edit would have changed this signature.
2. **Character normalisation (12 files).** For CSS/LESS/HTML, whitespace, quote characters, `; , ( )` and CSS leading zeros are stripped from both revisions.
3. **Hand inspection (4 files).** Three CSS files (`editor_color_dark.css`, `editor_color_light.css`, `block-picker.css`) are Prettier's documented CSS normalisations — adding the leading zero in `rgba(…,.78)` → `rgba(…,0.78)`, collapsing `0.0` → `0`, and lower-casing `#F5F5F5` → `#f5f5f5`. The fourth, `vite-plugin-mota-server.ts`, has an **identical AST**; its comment-multiset flag is an artefact of the raw scanner mis-reading regex literals as `//` comments (the differing "comment" text is a whole code region that differs only by arrow parens, trailing commas and wrapping).

The behavioural safety net backs the structural claim: `pnpm typecheck`, `pnpm --filter @motajs/editor test` (891 tests) and `pnpm build` were all re-run after the reformat.

## Residual lint errors — plan 01-09's work list

`pnpm lint` (= `eslint .`) exits 1 with **42 errors / 108 warnings**. Every one is pre-existing debt; none was weakened or silenced here. By rule:

**Errors (42)**

| Rule | Count |
|------|------:|
| `@typescript-eslint/no-explicit-any` | 21 |
| `react-refresh/only-export-components` | 8 |
| `react-hooks/set-state-in-effect` | 7 |
| `prefer-const` | 2 |
| `no-useless-escape` | 1 |
| `react-hooks/use-memo` | 1 |
| `react-hooks/immutability` | 1 |
| `no-control-regex` | 1 |

**Warnings (108)**

| Rule | Count |
|------|------:|
| `@typescript-eslint/no-unused-vars` | 50 |
| `arrow-body-style` | 34 |
| `react-hooks/exhaustive-deps` | 8 |
| `react-hooks-better-stable/exhaustive-deps` | 7 |
| *unused `eslint-disable` directives* (ruleId `null`) | 6 |
| `@typescript-eslint/no-explicit-any` | 3 |

**Stylistic rules deleted: none.** The plan allowed deleting a stylistic rule that `eslint-config-prettier` left uncovered; the resolved config shows `@stylistic/quotes` already off and the lint run reports zero `@stylistic/*` errors, so no rule had to be deleted. No non-formatting rule was deleted, downgraded or ignored.

## Package legitimacy evidence (re-asserted before install, 2026-09-21)

| Package | Version resolved | License | `repository.url` | Weekly downloads |
|---------|------------------|---------|------------------|------------------|
| `prettier` | 3.9.8 | MIT | `git+https://github.com/prettier/prettier.git` | 96,896,437 |
| `eslint-config-prettier` | 10.1.8 | MIT | `git+https://github.com/prettier/eslint-config-prettier.git` | 46,067,674 |
| `eslint-plugin-prettier` | 5.5.6 | MIT | `git+https://github.com/prettier/eslint-plugin-prettier.git` | 30,554,212 |

`eslint-plugin-prettier`'s peer range (`eslint-config-prettier >=10.1.0`, `prettier >=3.0.0`, `eslint >=8.0.0`) is satisfied. No package is `[ASSUMED]`/`[SUS]`/`[SLOP]`, so no legitimacy checkpoint was required. Deferred to the orchestrator: `01-RESEARCH.md` §"Package Legitimacy Audit" still says this phase installs no external packages and now needs these three rows (this plan does not edit RESEARCH.md).

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Prettier from the catalog, land the config and ignore rules, and trace one file end-to-end** - `8673145` (chore)
2. **Task 2: Compose eslint-config-prettier last, enforce formatting through eslint-plugin-prettier, and stop linting generated output** - `82d3128` (chore)
3. **Task 3: Format the whole repository and prove the change set is formatting-only** - `cf32da4` (style)
4. **Task 4: Sync the documented conventions with the new single-quote reality** - `f575078` (docs)

**Plan metadata:** this SUMMARY commit (docs: complete plan)

_Plan head before execution: `ecbc59842c26258a134072f01f4db1651c0443fd`; commits measured with `git rev-list --count ecbc598..HEAD` = **4**._

## Files Created/Modified

- `.prettierrc.json` - the one Prettier config: `singleQuote: true`, `jsxSingleQuote: false`, `semi: true`, 2-space, `trailingComma: "all"`, `printWidth: 120`, `arrowParens: "always"`, `bracketSpacing: true`, `quoteProps: "as-needed"`, `endOfLine: "lf"`
- `.prettierignore` - excludes `node_modules`, `**/dist`, `**/styled-system`, `coverage`, `playwright-report`, `test-results`, `packages/external`, `.planning`, `pnpm-lock.yaml`, `packages/libs/packer/prev`, `*.md`, `*.yml`, `*.yaml`
- `.gitattributes` - `* text=auto eol=lf`
- `scripts/verify/prettier-setup.js` - zero-dependency Node verifier: resolves the Prettier config, checks six `getFileInfo` ignore targets, checks the two root scripts, checks the three lockfile declarations, and asserts the **parsed** ESLint rule severities (never the config source text)
- `package.json` - three `catalog:default` devDependencies plus `format: prettier --write .` and `format:check: prettier --check .`
- `pnpm-workspace.yaml` - catalog entries `prettier: ^3.9.8`, `eslint-config-prettier: ^10.1.8`, `eslint-plugin-prettier: ^5.5.6`
- `pnpm-lock.yaml` - 86 added lines, 0 removed: the three packages + `@pkgr/core@0.3.6`, `fast-diff@1.3.0`, `prettier-linter-helpers@1.0.1`, `synckit@0.11.13`
- `eslint.config.js` - imports `eslint-config-prettier/flat` + `eslint-plugin-prettier`; `**/styled-system/` added to the top-level ignores; `quotes: "single"`; `eslintConfigPrettier` last in `extends`; `prettier` plugin registered; `prettier/prettier: "error"`
- `packages/apps/editor/eslint.config.js` - `globalIgnores(['dist', '**/styled-system/**'])`; `eslintConfigPrettier` last in `extends`; `prettier` plugin + `prettier/prettier: 'error'` (existing rule severities and `files` globs untouched)
- `packages/apps/editor/dprint.jsonc` - typescript `quoteStyle: "preferSingle"` with a comment explaining the file is dormant
- `packages/apps/editor/src/hooks/useImageAssetUrl.ts` - the traced file: reformatted by Prettier and re-checked (no double-quoted string literal remains)
- 626 tracked files - the reformat (quote style, trailing commas, wrapping, arrow parens, Prettier's CSS normalisations)
- `.planning/codebase/CONVENTIONS.md` - the two-config table now names Prettier as the formatting authority; the double-quote expectation and the "observed inconsistency" paragraph are replaced; Markdown/YAML exclusion and the `.gitattributes` LF policy are recorded
- `AGENTS.md` - regenerated from the project sources via `gsd-tools generate-claude-md --output AGENTS.md`

## Decisions Made

- **One quote style, owned by Prettier.** `singleQuote: true` and no competing `@stylistic/quotes`. Prettier's documented behaviour of emitting double quotes where that needs fewer escapes (an apostrophe inside the string) is accepted and stated in the docs, which is exactly why a second rules-based authority is forbidden.
- **`eslint-config-prettier/flat` goes LAST.** In a flat config the later entry wins; composing it before the stylistic preset would have left every `@stylistic` rule fighting Prettier. Proven by the resolved-config assertion (`@stylistic/quotes` → off), not by reading the file.
- **The `quotes` option was changed, not deleted.** Kept as `single` so that if `eslint-config-prettier`'s coverage of the `@stylistic` namespace is ever incomplete, the survivor agrees with Prettier instead of contradicting it.
- **The editor config enforces Prettier too.** `pnpm --filter @motajs/editor lint` never sees the root config, so `prettier/prettier` would have been enforced for root files only. Both runs must resolve the same rule set.
- **Markdown and YAML excluded from Prettier.** Reformatting the repo's largely-Chinese Markdown would be a low-value, easily-regressed diff (`AGENTS.md` is machine-regenerated), and the YAML is hand-maintained configuration with no formatting defects.
- **Install pinned to the CI pnpm (11.10.0) with time-anchored resolution.** See Deviations.
- **No stylistic rule was deleted.** The plan's escape hatch existed but was unnecessary.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed with the CI-pinned pnpm 11.10.0 and `resolutionMode=time-based` instead of the local pnpm 10.15.0**

- **Found during:** Task 1 (install Prettier from the catalog)
- **Issue:** Two blockers compounded. (a) Local `pnpm` is 10.15.0 but `node_modules` was built against the pnpm **11** store (`node_modules/.modules.yaml` → `storeDir: E:\.pnpm-store\v11`), so a plain `pnpm install` offered to purge and reinstall all 12 workspace projects from scratch. (b) `npx pnpm@11.10.0 install --no-frozen-lockfile` re-resolved with default `resolutionMode: highest` and bumped ~30 unrelated dependency versions (`@types/react` 19.2.7→19.3.0, `memfs` 4.51.1→4.78.1, `terser` 5.44.1→5.51.2, `dexie` 4.2.1→4.4.6, `@stylistic/eslint-plugin` 5.6.1→5.10.0, …), violating the acceptance criterion that no pre-existing dependency version may move. `--config.resolutionMode=lowest-direct` did not help.
- **Fix:** Reverted `pnpm-lock.yaml`, set its mtime back to its original value, and ran `npx pnpm@11.10.0 install --no-frozen-lockfile --config.resolutionMode=time-based` — pnpm then resolved to the newest versions published before the lockfile's timestamp, reproducing the original resolutions exactly and *downgrading* the previously-bumped packages back. `pnpm install --frozen-lockfile` afterwards exits 0 with the lockfile unchanged.
- **Files modified:** `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `package.json`
- **Verification:** `git diff -- pnpm-lock.yaml` = 86 insertions / 0 deletions, containing only the three new packages and their four unique transitive dependencies; `pnpm install --frozen-lockfile` exit 0.
- **Committed in:** `8673145` (Task 1 commit)

**2. [Rule 3 - Blocking] Removed the `time:` metadata block and one registry-metadata line so the lockfile diff stayed purely additive**

- **Found during:** Task 1
- **Issue:** `resolutionMode=time-based` made pnpm append a ~85-line top-level `time:` map (publication timestamps of every resolved package) to `pnpm-lock.yaml`, and the re-resolve also refreshed `glob@7.2.3`'s `deprecated:` message. Neither moves a version, but both are churn outside the three packages the criterion allows.
- **Fix:** Truncated the `time:` block and restored the previous `deprecated:` string. Verified the trim is safe by re-running `pnpm install --frozen-lockfile` (exit 0, lockfile not rewritten).
- **Files modified:** `pnpm-lock.yaml`
- **Verification:** `git diff --exit-code`-style inspection shows 0 deleted lines; frozen install re-validated.
- **Committed in:** `8673145` (Task 1 commit)

**3. [Rule 3 - Blocking] The editor's own ESLint config had to register `prettier/prettier` as well**

- **Found during:** Task 2 (wire formatting through ESLint)
- **Issue:** Plan-internal inconsistency. Task 2's `<action>` says the editor config gets only the new generated-output ignore, but the same task's `<verify>` command asserts that `eslint --print-config packages/apps/editor/src/hooks/useImageAssetUrl.ts` reports `prettier/prettier` at error, its `<acceptance_criteria>` repeats that, and its `<done>` states "both the root and the editor package runs resolve to the same Prettier-based rule set". The root config mounts the editor config with `basePath` and its shared block ignores `packages/apps/editor/**`, so an editor file resolves **only** the editor config — the rule could not reach it any other way.
- **Fix:** Added `eslint-plugin-prettier` + `prettier/prettier: 'error'` + a terminal `eslint-config-prettier/flat` to `packages/apps/editor/eslint.config.js`, alongside the ignore the plan asked for. Every pre-existing rule severity and the `files` globs are unchanged; the diff is additive only.
- **Files modified:** `packages/apps/editor/eslint.config.js`
- **Verification:** The task's own verify command passes; `git diff -- packages/apps/editor/eslint.config.js` shows no modified existing severity and no changed `files` glob.
- **Committed in:** `82d3128` (Task 2 commit)

### Process notes (not deviations from the plan's intent)

- **Commits landed on `main`.** `.planning/config.json` sets `git.branching_strategy: "none"`, the orchestrator explicitly directed this plan to run in the main working tree (no worktree isolation), and plans 01-01…01-06 all committed on `main`. The executor's default protected-branch guard would otherwise have halted the plan; the project has opted out of per-phase branches, so `main` is the intended branch. No `--no-verify` was used and no git config was changed.
- **Frozen-lockfile installs were run without `CI=true`.** With `CI=true` pnpm takes the frozen path regardless of the resolution-mode setting, which made the time-anchored re-resolve silently report "Already up to date". Flag recorded so 01-07's CI wiring is not surprised by the local/CI difference.

---

**Total deviations:** 3 auto-fixed (3 blocking).
**Impact on plan:** All three were necessary. (1) and (2) are what make the lockfile acceptance criterion true rather than nominally true; (3) resolves a contradiction inside the plan in favour of the task's own explicit verify command. No dependency, rule or scope was added beyond the plan's stated deliverables.

## Issues Encountered

- **`git status` reported 92 files as modified whose content is byte-identical to HEAD.** These are stale-stat entries left by `prettier --write` rewriting line endings; `git hash-object` and blob comparison confirm the content is unchanged, and `git add` clears them. Consequence for the SUMMARY's numbers: `git status --short` showed 718 entries while the authoritative content change set (`git diff --stat`, used for every count here) is **626 files**. The same mechanism means a raw byte comparison must never be used as the change-set evidence on Windows.
- **The raw TypeScript scanner mis-reads regex literals as `//` comments**, which produced false "comment changed" flags on files containing regexes (e.g. `vite-plugin-mota-server.ts`). The AST comparison is the authoritative signal for those files; the comment multiset is a secondary check.
- **`gsd-tools query generate-claude-md` without `--output` writes `.claude/CLAUDE.md`** (per `claude_md_path`), not `AGENTS.md`. The stray `.claude/CLAUDE.md` it created was removed and never committed; the plan's `--output AGENTS.md` invocation was used instead.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Plan 01-07 (ci.yml)** can now wire a `lint` job to `pnpm lint`: the four formatting/generated-output errors are gone and the gate no longer fails for formatting reasons. It will still be red on the 42 pre-existing errors above until 01-09 lands — the same blocker 01-06 recorded, now precisely sized.
- **Plan 01-09** has its inventory: the error table above (42 errors by rule) plus the 108 warnings. `pnpm lint` is deterministic and readable via `eslint . -f json`.
- **Editor-core extraction phases** inherit a formatted tree, so later diffs are semantic-only and any whitespace noise in a future diff is a real signal.
- **VERIFY-02 is not yet complete** — it is declared by 01-07, 01-08 and 01-09, and the shared-ID gate keeps it open until the last declaring plan has a SUMMARY.
- **Deferred to the orchestrator:** `01-RESEARCH.md` §"Package Legitimacy Audit" still claims this phase installs no external packages; it needs the three rows recorded in this SUMMARY.

---

*Phase: 01-baseline-verification-net*
*Completed: 2026-09-21*

## Self-Check: PASSED

- `.prettierrc.json` — FOUND
- `.prettierignore` — FOUND
- `.gitattributes` — FOUND
- `scripts/verify/prettier-setup.js` — FOUND
- `.planning/phases/01-baseline-verification-net/01-08-SUMMARY.md` — FOUND
- Commits `8673145`, `82d3128`, `cf32da4`, `f575078` — FOUND (4 commits since plan head `ecbc598`)
- `pnpm format:check` after all edits — exit 0
