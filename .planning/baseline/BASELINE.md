# Phase 01 — Baseline Record (`01-baseline-verification-net`)

**Captured:** 2026-09-20
**Plan:** `01-02-PLAN.md` (requirements VERIFY-01, VERIFY-07)

The milestone's central claim is "behaviour unchanged". Nothing after Phase 1 can be measured
against that claim until a quantified, diffable "before" picture exists. This document is the
human-readable half of that picture; `.planning/baseline/baseline.json` is the machine-readable
half, and `.planning/baseline/editor-manifest.json` is a verbatim copy of the editor build's own
artifact manifest.

**Every number below is runner-derived or plugin-derived — none is hand-counted.** Unit counts come
from `vitest run --reporter=json`, e2e counts from Playwright's JSON reporter, and the artifact report
from the editor build plugin's own report line plus the manifest it writes
(`packages/apps/editor/editor-artifact-plugin.ts`).

Baseline capture ran **before** the `vitest.config.ts` split (plan 01-06), so these numbers come from
the unmodified `vite.config.ts` test block.

---

## 1. Tree identity and toolchain

| Fact | Value |
|------|-------|
| `git.commit` | `a2eba5237ab51dc5bff070da5fc571b61524e5b8` |
| `mota-js` submodule SHA | `3efb548e407ad2b8007b498cb98401e2012a0b55` (`packages/external/mota-js`, `v2.10.3-release-2-g3efb548e`) |
| Node | `v22.18.0` |
| pnpm | `10.15.0` |
| Editor artifact `buildId` | `a22a44900241893004f994356cbe8dddb6ded3302917e15c03e0f069ebf3aa6e` |

`git.commit` is HEAD at the time of the final collector run. All four scopes ran in sequence on this
one working tree; the only tracked files that changed between the `unit` collection and the
`build`/`e2e` collections are `scripts/baseline/collect.js` and `.planning/baseline/*`, which no unit
test or production module imports. No baseline number depends on those files.

Local toolchain differs from CI on purpose: local pnpm is `10.15.0` while
`.github/workflows/deploy-editor-h5test.yml` pins `11.10.0`, and local Node is `22` while CI uses
`24`. Both are recorded as facts, not changed here.

---

## 2. Reproduction recipe

```bash
# 1. dependencies — the workspace tree must resolve before anything else runs
pnpm install --frozen-lockfile

# 2. deterministic project fixture used by both the unit and e2e suites
#    (seven unit modules read real mota-js files at runtime — see RESEARCH Pitfall 1)
git submodule update --init packages/external/mota-js

# 3. Playwright browsers (not part of the pnpm store)
pnpm --filter @motajs/editor exec playwright install chromium

# 4. per-package unit counts -> baseline.json.unit
node scripts/baseline/collect.js unit

# 5. production build, artifact budget, committed editor manifest -> baseline.json.build
node scripts/baseline/collect.js build

# 6. e2e counts -> baseline.json.e2e  (never set MOTA_WITH_EDITOR=0 — see §5)
node scripts/baseline/collect.js e2e

# 7. screenshot baselines (repo-root output, see §7)
pnpm --filter @motajs/editor exec playwright test --project baseline-capture
node scripts/baseline/collect.js screenshots
```

Each `collect.js` invocation reads the existing `baseline.json`, merges **only** its own block, and
writes the file back with two-space indentation and a trailing newline, so the recipe can be re-run
without duplicating keys. Run the scopes in the order above on a clean tree.

---

## 3. Unit counts (runner-derived)

Produced by `node scripts/baseline/collect.js unit`, one `vitest run --reporter=json` per package.

| Package | Passed | Failed | Skipped | Total |
|---------|-------:|-------:|--------:|------:|
| `@motajs/editor` | 865 | 0 | 0 | 865 |
| `@motajs/service-worker` | 44 | 0 | 0 | 44 |
| `@motajs/file2x` | 14 | 0 | 0 | 14 |
| `@motajs/h5animate` | 202 | 0 | 0 | 202 |
| `@motajs/packer` | 94 | 0 | 0 | 94 |
| `@motajs/react-hooks` | 3 | 0 | 0 | 3 |
| `@motajs/react-monaco-editor` | 6 | 0 | 0 | 6 |
| `@motajs/react-store` | 3 | 0 | 0 | 3 |
| **Total** | **1231** | **0** | **0** | **1231** |

**Counts caveat (RESEARCH Pitfall 5).** These are counts the *runner* reported, not a count of test
files. A source-file census of the same tree yields 92 + 8 + 8 + 9 + 2 + 2 + 1 + 1 = 123 unit test
files, which is a different (and wrong) number for this purpose: table-driven and generated cases
collapse into one file, and file counts cannot distinguish passed from skipped. Always compare
against the JSON reporter, never against a file census.

`@motajs/utils`, `@motajs/react-dark-mode` and `@motajs/config` define no `test` script, so they are
not part of this table and are skipped by a `pnpm -r run test` fan-out.

Zero tests are skipped in every package. That is the "before" value that VERIFY-06's e2e
required-fixture work must not quietly change.

---

## 4. Editor artifact budget

Produced by `node scripts/baseline/collect.js build` from the plugin's own report line and the
manifest written at `packages/apps/editor/dist/editor-manifest.json` (copied byte-for-byte to
`.planning/baseline/editor-manifest.json`; both files hash identically).

| Metric | Value |
|--------|-------|
| `files` | 57 |
| `rawBytes` | 17,618,356 (16.80 MiB) |
| `rawBudgetBytes` | 20,971,520 (20 MiB) |
| **`rawPercentOfBudget`** | **84.0109 %** |
| `gzipBytes` | 4,498,391 |
| `brotliBytes` | 3,753,902 |
| `exactlyOneTsWorker` | `true` |
| `noCssHtmlWorkers` | `true` |
| Manifest `schemaVersion` | 2 |
| Manifest `entrypoints` | `index.html` (editor), `runtime.html` (runtime) |

The artifact sits at **84.0109 % of the 20 MiB raw ceiling** (`MAX_EDITOR_ARTIFACT_BYTES`,
`editor-artifact-plugin.ts`), leaving ~3.2 MiB of headroom. `validateEditorArtifact` also enforces
"exactly one standard `ts.worker`" and "no css/html workers"; both passed, and both are recorded as
boolean baseline facts because later phases touch the MPA entry graph.

---

## 5. e2e counts

Produced by `node scripts/baseline/collect.js e2e`, one Playwright JSON report per app. The e2e
suites are **not** part of the PR gate (D-01) — they are recorded so later phases can tell whether
they were already red.

| App | Passed | Failed | Skipped | Total |
|-----|-------:|-------:|--------:|------:|
| `@motajs/editor` | 96 | 2 | 0 | 98 |
| `@motajs/service-worker` | 0 | 4 | 0 | 4 |

Failing specs observed in `@motajs/editor` (flaky across runs — see below):

- `e2e/blockly-text-field.spec.ts` — "Blockly multiline text wraps and keeps its editor aligned"
- `e2e/workspace-shell.spec.ts` — "top bar workspaces, schema tower, drafts, scripts and theme stay coherent"

`@motajs/service-worker` — **all four specs failed** (`e2e/editor-host.spec.ts` ×2,
`e2e/project-host.spec.ts` ×2). Two separate, reproducible facts are involved:

1. **The suite cannot start through its own configuration on this machine.** Its `webServer.command`
   is `pnpm build:with-editor && pnpm preview …`, and the build chain takes ~6 minutes
   (editor build ≈3m53s + service-worker build ≈1m44s + staging), while `webServer.timeout` is
   `120_000`. Playwright therefore aborts with
   `Error: Timed out waiting 120000ms from config.webServer.` — recorded once in
   `baseline.json.e2e["@motajs/service-worker"]` as a `not-run` entry with that reason.
2. **When the preview server is pre-started** (the config already sets
   `reuseExistingServer: true`, so this is the same server it would have launched), the four specs
   execute and all four fail before any editor interaction. A standalone probe reproduced the
   symptom: the service-worker `project.register` round-trip succeeds, then navigating to
   `/service/<id>/project/` returns HTTP 200 but the page/browser closes before the project heading
   renders.

Because the suite genuinely *ran* in case 2, the committed record is `status: "ran"` with
`0 passed / 4 failed` plus the failing spec names — not a `not-run` placeholder. Chrome **is**
available locally (`channel: "chrome"`, system Chrome installed), so the absence of Chrome is not the
cause. Diagnosis of the failures is out of scope for plan 01-02 and is deferred to a later phase.

**Flakiness already present in the "before" picture** (do not treat these as regressions later):

- `@motajs/editor` e2e — two consecutive runs produced 3 then 2 failures, with overlapping but
  not identical spec sets.
- `@motajs/react-monaco-editor` unit suite — intermittently exits non-zero *after* writing a
  complete, all-passing JSON report (6/6 passed; reporter-independent and reproduced with plain
  `vitest run`). The collector records the counts and preserves the observed `exitCode` instead of
  discarding a valid measurement; see `.planning/phases/01-baseline-verification-net/deferred-items.md`.

`MOTA_WITH_EDITOR=0` is a silent-reduction escape hatch and must **never** be set for a baseline run:
`collect.js e2e` refuses to run when it detects `MOTA_WITH_EDITOR=0`.

---

## 6. CI contract and environment variables

### Required-status-check contract

`ci.yml`'s job names (plan 01-03) are the contract that repository settings must reference. The four
names, recorded here so settings can be configured without re-reading the workflow:

| Job name | Purpose |
|----------|---------|
| `lint` | `pnpm exec eslint .` (no `--fix` — a fixing gate can never fail) |
| `typecheck` | per-package `tsc -b` |
| `unit` | per-package `vitest run` (needs the submodule — seven modules read real mota-js files) |
| `build` | production build, artifact must stay under 20 MiB (needs the submodule + `styled-system`) |

Making these *block merges* is repository branch-protection/ruleset configuration, not workflow
content (D-04). It lives outside git and requires admin permission; no workflow file can enforce it.

### Behaviour-relevant environment variables

Four environment variables govern this phase's behaviour and belong to the reproduction recipe. Only
their **names** are recorded — never their values (T-02-02):

| Variable | Effect |
|----------|--------|
| `MOTA_JS_ROOT` | overrides the mota-js root used by unit fixtures, e2e sandbox, dev server `publicDir` and build |
| `MOTA_WITH_EDITOR` | when `0`, the service-worker e2e suite builds without a staged editor and silently skips the editor specs; must never be `0` in CI or in a baseline run |
| `MOTA_EDITOR_E2E_PORT` | overrides the editor e2e dev-server port (default `1055`) |
| `PLAYWRIGHT_USE_SYSTEM_CHROME` | when `1`, the editor e2e project uses the system Chrome channel |

CI sets none of these, and `ci.yml` must add no required secrets.

---

## 7. Screenshot baselines

`.planning/baseline/screenshots/` holds five PNGs captured from the same deterministic fixture the
unit tests use (`ProjectSandbox`, serving `MOTA_JS_ROOT/project`):

| File | Surface | Anchor test id |
|------|---------|----------------|
| `shell.png` | Workbench shell | `workbench` |
| `editor-map.png` | Map editor | `map-pixi-renderer` |
| `editor-table.png` | Schema table (tower) | `panel-tower` → `schema-table` |
| `editor-code.png` | Scripts workspace | `scripts-workspace` |
| `editor-asset.png` | Resources workspace | `resources-workspace` |

Capture is a Playwright project (`baseline-capture`, spec `packages/apps/editor/e2e/baseline-capture.spec.ts`)
with a fixed viewport, animations disabled, and a fixed output directory resolved from the spec's own
location up to the repository root — never from the process working directory. There are **no
`toHaveScreenshot` reference images**: D-08 mandates human comparison, and platform-keyed reference
names would be dead weight. The runtime preview iframe is explicitly hidden from every capture: it
executes project-authored code and its rendering is host-dependent (T-02-01).

Byte sizes for the five files are recorded in `baseline.json.screenshots`.

---

## 8. Protocol constants — intentionally preserved

| Constant | Declared in | Value |
|----------|-------------|-------|
| manifest `schemaVersion` | `packages/apps/editor/editor-artifact-plugin.ts` | `2` |
| manifest `environmentProtocolVersion` | `packages/apps/editor/editor-artifact-plugin.ts` | `1` |
| manifest `runtimeProtocolVersion` | `packages/apps/editor/editor-artifact-plugin.ts` | `3` |
| `RUNTIME_PROTOCOL_VERSION` | `packages/apps/editor/src/runtime/protocol.ts` | `4` |

> **The mismatch between the manifest's `runtimeProtocolVersion: 3` and the runtime's
> `RUNTIME_PROTOCOL_VERSION = 4` is pre-existing behaviour and is intentionally preserved. It is
> recorded here unchanged, with both values exactly as found. It must never be "fixed" in this
> milestone — changing either number is a behaviour change, which this milestone forbids. Later
> phases diff against these values; a change here is a signal, not a cleanup.**

---

## 9. Known gaps in this baseline

1. **Typecheck blind spot.** No tsconfig typechecks `packages/apps/editor/test` or
   `packages/apps/editor/src/**/__tests__/**`: `packages/apps/editor/tsconfig.app.json` excludes
   them, and `packages/apps/editor/tsconfig.node.json` includes only the config/plugin/root
   TypeScript files. The `typecheck` CI gate is therefore green while test/fixture code could contain
   type errors. Decision for this phase: record the gap rather than widen the gate (see RESEARCH
   Pitfall 3 / Open Question 3).
2. **e2e is not a PR gate** (D-01). The counts above are a record, not a gate — the editor e2e suite
   is already flaky and the service-worker suite does not start through its own configuration.
3. **No coverage threshold** is enforced anywhere; only `@motajs/packer` configures a coverage
   reporter at all.
4. **`@motajs/react-monaco-editor` teardown flake** can make an all-passing unit run exit non-zero
   (see §5). The baseline preserves the observed `exitCode` per package in `baseline.json` rather
   than hiding it.

---

*Phase: 01-baseline-verification-net — Plan 01-02*
*Machine-readable companion: `.planning/baseline/baseline.json`*
