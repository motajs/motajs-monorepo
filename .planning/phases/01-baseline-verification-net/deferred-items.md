# Deferred items discovered during plan 01-02

Out-of-scope discoveries made while capturing the baseline. None is caused by plan 01-02's changes
(which touched only `scripts/baseline/collect.js`, `.planning/baseline/**`,
`packages/apps/editor/e2e/baseline-capture.spec.ts` and `packages/apps/editor/playwright.config.ts`),
so per the scope-boundary rule they are recorded here rather than fixed inline.

## 1. `@motajs/react-monaco-editor` unit suite exits non-zero after an all-passing report

**Observed:** `pnpm --filter @motajs/react-monaco-editor exec vitest run` writes a complete JSON report
with 6/6 passed and then, roughly half the time, exits `1` after printing `undefined` on stdout.
Reporter-independent: the same happens with the default reporter. The `--outputFile` path is
irrelevant (plain `vitest run` reproduces it).

**Impact:** the baseline preserves the observed `exitCode` per package in `baseline.json.unit`; a CI
`unit` gate on this package would be intermittently red.

**Not fixed here:** a pre-existing Vitest/jsdom teardown behaviour in this package, unrelated to the
baseline work. Needs its own investigation (likely a late async continuation after the run finishes).

## 2. `@motajs/editor` e2e flakiness

**Observed:** two consecutive full runs of `pnpm --filter @motajs/editor exec playwright test`
produced 3 then 2 failures out of 98, with overlapping but not identical failing specs. Recurring
names: `e2e/blockly-text-field.spec.ts` ("Blockly multiline text wraps and keeps its editor aligned")
and `e2e/workspace-shell.spec.ts` ("top bar workspaces, schema tower, drafts, scripts and theme stay
coherent").

**Impact:** the baseline records `96 passed / 2 failed / 98 total` plus the failing spec names; later
phases must treat these as pre-existing, not regressions.

## 3. `@motajs/service-worker` e2e cannot start through its own configuration; all four specs fail

**Observed, part A — webServer timeout.** The configured `webServer.command` is
`pnpm build:with-editor && pnpm preview …`. That build chain measured ≈6 minutes on this machine
(editor build ≈3m53s + service-worker build ≈1m44s + `stage:editor`), while
`packages/apps/service-worker/playwright.config.ts` sets `webServer.timeout: 120_000`. Playwright
aborts with `Error: Timed out waiting 120000ms from config.webServer.`

**Observed, part B — failures once it does start.** With the preview server pre-started (the config
already sets `reuseExistingServer: true`, so it is the same server Playwright would launch), all four
specs run and all four fail before any editor interaction. A standalone probe reproduced it: the
`project.register` service-worker message round-trip returns an id, then navigating to
`/service/<id>/project/` returns HTTP 200 but the page/browser closes before the project heading
renders.

**Not the cause:** the Chrome channel — system Chrome is installed and the suite runs under it.

**Not fixed here:** the service-worker app is not in this plan's scope. Suggested follow-up: raise
`webServer.timeout` (or split the build out of the `webServer.command`), then diagnose the
project-page failure in its own phase.

## 4. Local ↔ CI toolchain gap

Local pnpm is `10.15.0` and Node is `22`, while CI pins pnpm `11.10.0` and Node `24`. Both were
recorded as facts in `BASELINE.md`; changing the local major versions is a scope change.

## 5. `pnpm exec eslint .` from the repo root runs out of memory

**Observed:** `pnpm exec eslint .` (the shape plan 01-03 specifies for the `lint` CI job) terminates
with `FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory`.

**Likely cause:** the root flat config's only `ignores` entries are `dist` and `node_modules`. ESLint
does not read `.gitignore`, so the vendored `packages/external/mota-js` submodule (a full upstream
repository with `_docs`, `libs`, `project`, …) is linted too.

**Impact:** plan 01-03's `lint` job will fail on the first run unless the config ignores the
submodule (and any other generated trees) or the CLI scopes the lint roots. The editor package is
unaffected when linted through its own `eslint.config.js` (`pnpm --filter @motajs/editor exec eslint .`
is clean).

**Not fixed here:** `eslint.config.js` is not part of plan 01-02's deliverables, and the lint gate is
plan 01-03's.

## 6. Pre-existing lint error in `packages/apps/editor/playwright.config.ts` under the root config

**Observed:** `pnpm exec eslint packages/apps/editor/playwright.config.ts` reports
`5:74 error '||' should be placed at the beginning of the line @stylistic/operator-linebreak` for the
`const useSystemChrome = … || …` line.

**Status:** the line is untouched by plan 01-02 (`git diff` shows only the `projects` block changed),
and this is the only error in the file — so it predates the baseline work. It is recorded rather than
reformatted to keep the change set minimal. Whoever lands the `lint` gate (plan 01-03) should decide
whether to apply the stylistic fix.

---

# Deferred items discovered during plan 01-06

Plan 01-06 wires up the non-fixing root `lint` gate (`eslint .`, no `--fix`). Running it surfaced a
large set of **pre-existing** rule violations that were never gated before — the old root `lint`
script was `eslint --fix`, and a root `eslint .` OOM'd (§5). None is caused by plan 01-06's changes;
per the scope-boundary rule they are recorded here rather than fixed inline, and the gate was
deliberately **not** weakened to hide them.

## 7. The editor's own config is not clean — 43 errors

**Observed:** `pnpm --filter @motajs/editor lint` (i.e. `eslint .` through
`packages/apps/editor/eslint.config.js`) exits `1` with **43 errors / 111 warnings**. This contradicts
§5's parenthetical claim that the editor is clean through its own config; that claim was written at
plan 01-02 and does not hold for the current tree.

Dominant error rules (all pre-existing, produced by the editor's own rule set):

| Rule | Approx. count | Representative files |
|------|------:|----------------------|
| `@typescript-eslint/no-explicit-any` | 20+ | `e2e/core-panel-write.spec.ts`, `src/runtime/iframeEntry.ts`, `src/project/model/tableModels.ts`, `src/services/tower/__tests__/towerService.test.ts` |
| `react-hooks/set-state-in-effect` | 8 | `src/Workbench/modals/StatusBarPreview/*`, `src/hooks/useImageAssetUrl.ts`, `src/MapEditor/rendering/MapPixiRenderer.tsx` |
| `react-refresh/only-export-components` | 7 | `src/Workbench/EventsEditor/*Context.tsx`, `src/components/Table/index.tsx` |
| `prefer-const` | 2 | `src/Workbench/AppendPicPanel/index.tsx`, `src/utils/canvas/detectWhiteBackground.ts` |
| `no-useless-escape`, `react-hooks/use-memo`, `react-hooks/immutability` | 1 each | `src/blockly/registry/path.ts`, `src/hooks/useFs.ts`, `src/runtime/RuntimeProvider.tsx` |

**Impact:** a root `eslint .` (the CI `lint` job shape) cannot be green while these exist. The gate is
not weakened: no rule is relaxed and no editor source is ignored.

**Not fixed here:** fixing 43 pre-existing violations across editor sources is outside plan 01-06's
scope (the plan owns only `package.json`, `eslint.config.js` and
`packages/apps/editor/eslint.config.js`) and would touch many unrelated files.

## 8. Pre-existing lint violations under the shared root config in other packages

**Observed:** with the submodule ignored, root `eslint .` additionally reports (all pre-existing):

- `@motajs/service-worker`: `@stylistic/quotes` at `src/server/editorRelease.test.ts:16`,
  `no-control-regex` at `src/server/fsApi.ts:13`
- `@motajs/h5animate`: `@stylistic/no-multiple-empty-lines` at `lib/__tests__/roundtrip.test.ts:267`

Repo-wide total for the resolved config: **172 problems (46 errors, 126 warnings)**.

## 9. Widening the editor `files` glob also lints generated `styled-system/**`

**Observed:** the editor `files` glob was widened to `**/*.{js,cjs,mjs,ts,tsx}` (per plan 01-06, so the
editor's own `eslint.config.js` and `postcss.config.cjs` are matched instead of being reported as
having no configuration). That also makes ESLint lint the PandaCSS-generated `styled-system/` tree,
adding 2 errors (`css/cx.mjs` `no-unused-expressions`, `helpers.mjs` `no-cond-assign`) and many
unused-disable-directive warnings on generated `.d.ts` files.

**Not fixed here:** the plan explicitly said to leave `globalIgnores(["dist"])` as-is. If the lint
gate is later required to be green, `styled-system` (generated output) is the obvious extra global
ignore.

## 10. `pnpm test` fan-out is intermittently red on the `@motajs/react-monaco-editor` flake

**Observed:** `pnpm -r run test` failed once with
`Error: [vitest-worker]: Closing rpc while "fetch" was pending` for `@motajs/react-monaco-editor`
(all its tests passed) — the same pre-existing teardown flake as §1. An immediate retry of the full
fan-out exited `0`, as did an isolated `pnpm --filter @motajs/react-monaco-editor test`. `pnpm test`
exit status is therefore nondeterministic until that flake is fixed.

