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

