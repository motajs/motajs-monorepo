# Phase 01: Baseline & Verification Net - Pattern Map

**Mapped:** 2026-09-20
**Files analyzed:** 21 (10 new, 11 modified)
**Analogs found:** 18 / 21

> This phase is verification infrastructure, not application code. The analogs below are
> CI/test/config files, not feature code. Every analog path in this document was confirmed
> git-tracked with `git ls-files -- <path>` (no `.gsd/capabilities/**` or other gitignored
> mirrors were used).

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/apps/editor/vitest.config.ts` (new) | config (test) | transform | `packages/apps/service-worker/vitest.config.ts` | exact |
| `packages/apps/editor/vite.config.ts` (modify: remove `test` block) | config (build) | transform | itself | exact |
| `.github/workflows/ci.yml` (new) | config (CI) | event-driven | `.github/workflows/deploy-editor-h5test.yml` | role-match |
| `package.json` root (modify: fan-out scripts) | config | batch | `packages/apps/service-worker/package.json` (script shape) | role-match |
| `packages/apps/editor/package.json` (modify: `typecheck`) | config | batch | `packages/apps/service-worker/package.json` (`typecheck: tsc -b`) | exact |
| 7 × `packages/libs/*/package.json` (modify: `typecheck`) | config | batch | `packages/apps/service-worker/package.json` | role-match |
| `packages/apps/editor/src/fs/__tests__/persistExecutor.invariants.test.ts` (new) | test | event-driven | `packages/apps/editor/src/fs/__tests__/PersistExecutor.test.ts` | exact |
| `packages/apps/editor/src/fs/__tests__/persistenceMonitor.invariants.test.ts` (new) | test | event-driven | `packages/apps/editor/src/fs/__tests__/PersistenceMonitor.test.ts` + `src/project/data/__tests__/persistStatus.integration.test.ts` | exact |
| `packages/apps/editor/src/project/history/__tests__/operationHistory.invariants.test.ts` (new) | test | CRUD + event-driven | `packages/apps/editor/src/project/history/__tests__/operationHistory.test.ts` | exact |
| `packages/apps/editor/editor-artifact-plugin.test.ts` (modify/extend) | test | file-I/O | itself + `src/runtime/protocol.test.ts` | exact |
| `packages/apps/service-worker/e2e/fixtures.ts` (new) | test fixture | event-driven | `packages/apps/editor/e2e/utils/projectSandbox.ts` (helper-module shape) | partial |
| `packages/apps/service-worker/e2e/project-host.spec.ts` (modify) | test (e2e) | request-response | itself | exact |
| `packages/apps/editor/e2e/baseline-capture.spec.ts` (new) | test (e2e) | file-I/O | `packages/apps/editor/e2e/editor-smoke.spec.ts` + `e2e/utils/projectSandbox.ts` | exact |
| `packages/apps/editor/playwright.config.ts` (modify, if capture project added) | config (test) | transform | itself | exact |
| `packages/apps/editor/tsconfig.test.json` (new, optional — Pitfall 3) | config | transform | `packages/apps/editor/tsconfig.app.json` + `tsconfig.node.json` | role-match |
| `packages/apps/editor/tsconfig.json` (modify, if test tsconfig added) | config | transform | itself | exact |
| `.planning/baseline/BASELINE.md` (new) | doc | — | `.planning/codebase/TESTING.md` (structure only) | partial |
| `.planning/baseline/baseline.json` (new) | data | file-I/O | `editor-artifact-plugin.ts` manifest shape | partial |
| `.planning/baseline/editor-manifest.json` (new, copied) | data | file-I/O | emitted by `editor-artifact-plugin.ts` | exact (copy) |
| `.planning/baseline/screenshots/*.png` (new ×5) | data | file-I/O | — | none |

---

## Pattern Assignments

### `packages/apps/editor/vitest.config.ts` (config/test, transform)

**Analog:** `packages/apps/service-worker/vitest.config.ts` (13 lines, whole file)

**Whole analog, verbatim** (`packages/apps/service-worker/vitest.config.ts:1-13`):
```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    restoreMocks: true,
  },
});
```

**What to change for the editor** (source of truth for the values is the current test block,
`packages/apps/editor/vite.config.ts:28-34,51-56`):

- Add the two editor-only aliases that `vite.config.ts:28-34` declares and
  `tsconfig.app.json:9-13` mirrors: `@test` → `test`, `@styled-system` → `styled-system`.
- Keep `environment: "jsdom"`, `globals: true`, `setupFiles: ["./test/setup.ts"]`,
  `exclude: [...configDefaults.exclude, "e2e/**"]` (`configDefaults` imported from `vitest/config`).
- **Do NOT set `include`.** The editor currently relies on Vitest's default include, which is
  what collects `test/blockly/*.test.ts` and `test/mapEditor/*.test.ts` (outside `src`).
  Adding `include: ["src/**/*.test.ts"]` would silently drop those files and change the
  baseline count (D-05/D-09 safety). The service-worker analog's `include` is node-specific.
- **Do NOT import `MOTA_JS_ROOT` or `./mota-root`** — that import is the load-time throw
  (`mota-root.ts:15-21,25`) this split removes (D-14).

Resulting shape:
```ts
import path from "path";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@test": path.resolve(import.meta.dirname, "test"),
      "@styled-system": path.resolve(import.meta.dirname, "styled-system"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    exclude: [...configDefaults.exclude, "e2e/**"],
    setupFiles: ["./test/setup.ts"],
  },
});
```

**Setup-file dependency** (`packages/apps/editor/test/setup.ts:1-14`): injects the
`#mota-editor-environment` JSON node that `@/environment` parses. Keep it — dropping it
breaks every test that touches endpoints.

**Precedent for other libs** (same idiom, less to add):
- `packages/libs/packer/vitest.config.ts:1-16` — `globals`, `environment: "node"`, explicit `include`, coverage, `testTimeout`.
- `packages/libs/h5animate/vitest.config.ts:1-9` — `globals`, `environment: "node"`, `include: ["lib/**/*.test.ts"]`.

---

### `packages/apps/editor/vite.config.ts` (config/build, transform) — MODIFY

**Analog:** itself. Delete only lines 51-56 (the `test` block) and leave the `configDefaults`
import decision explicit: line 3 is `import { configDefaults, defineConfig } from "vitest/config";`.
After removing the test block, `configDefaults` becomes unused; `defineConfig` must keep coming
from `vitest/config` (or switch to `vite`) — the existing file uses `vitest/config` for
`defineConfig`. Remove `configDefaults` from the import to satisfy `noUnusedLocals`
(`tsconfig.node.json:8`). `MOTA_JS_ROOT` stays — `publicDir` (`:35`) and `motaServerPlugin` (`:25`)
still need it for dev/build (D-15, `<specifics>`).

**Note:** `vite.config.ts` is inside `tsconfig.node.json`'s `include` (`tsconfig.node.json:14`),
so a stale import fails the new `typecheck` gate.

---

### `.github/workflows/ci.yml` (config/CI, event-driven) — NEW

**Analog:** `.github/workflows/deploy-editor-h5test.yml` (66 lines)

**Reusable preamble, verbatim** (`.github/workflows/deploy-editor-h5test.yml:14-35`):
```yaml
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: recursive

      - uses: pnpm/action-setup@v4
        with:
          version: 11.10.0

      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Verify service worker host
        run: |
          pnpm --filter @motajs/service-worker typecheck
          pnpm --filter @motajs/service-worker test
```

**Top-level shape to copy** (same file, `:1-15`): `name`, `on:`, `concurrency:`, `jobs:`,
`runs-on: ubuntu-latest`, `permissions: contents: read`.

**Required differences for `ci.yml` (D-03/D-15, RESEARCH §Pattern 2 + Security Domain):**
- `on: pull_request` **and** `push: branches: [main]` — never `workflow_dispatch`
  (it cannot satisfy a required check) and never `pull_request_target`.
- **No `environment:`** and **no `secrets`** — the `h5test` secrets stay exclusively in
  `deploy-editor-h5test.yml:13,44-46`.
- **No `paths:` filter** — a filtered required check can leave a PR permanently
  "Waiting for status to be reported".
- Job names are the contract referenced by repo settings: **`lint`, `typecheck`, `unit`, `build`** (A2).
- `submodules: recursive` is **required on `unit` and `build`** and must be **absent on
  `lint`/`typecheck`**. The `unit`-job submodule is the resolved D-13/D-15 conflict
  (RESEARCH Open Question 2 recommendation (a): 7 unit modules read real `mota-js` files —
  see Pitfall 1 list). Record the deviation from D-15's letter in `BASELINE.md`.
- `build` additionally needs `styled-system/` before `tsc -b`/`vite build`. Assumption A4 says
  `pnpm install` runs the editor's `prepare: panda codegen`; add an explicit
  `pnpm --filter @motajs/editor exec panda codegen` step as cheap insurance.
- `lint` must run `pnpm exec eslint .` — **no `--fix`** (root `lint` is `eslint --fix`,
  `package.json:8`, unusable as a gate).

Skeleton (adapt, do not invent new action versions — mirror the analog exactly):
```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 11.10.0 }
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec eslint .
  # typecheck: no submodules
  # unit:      submodules: recursive
  # build:     submodules: recursive + panda codegen
```

**Out-of-repo half (D-04):** required status checks are repository settings / REST API, not
workflow content. The plan needs a `checkpoint:human-verify` task ("a PR cannot merge while one
of the four checks is red"). `BASELINE.md` must name the four job names.

---

### Root `package.json` + per-package `package.json` (config, batch) — MODIFY

**Analog:** `packages/apps/service-worker/package.json:6-17` (the only package with `typecheck`)

**Current root scripts, verbatim** (`package.json:7-9`):
```json
  "scripts": {
    "lint": "eslint --fix"
  },
```

**Script-shape analog, verbatim** (`packages/apps/service-worker/package.json:14-16`):
```json
    "typecheck": "tsc -b",
    "test": "vitest run",
    "test:e2e": "playwright test"
```

**Editor gap** (`packages/apps/editor/package.json:6-14`): has `test`, `build`, `lint` — no `typecheck`.
**Lib test-script analog** (`packages/libs/file2x/package.json:7-9`,
`packages/libs/react-store/package.json:10-12`, `packages/libs/react-hooks/package.json:9-11`):
```json
  "scripts": {
    "test": "vitest run"
  }
```
**Libs with empty/absent scripts** (`packages/libs/utils/package.json:10` → `"scripts": {}`,
`packages/libs/react-dark-mode/package.json:12` → `"scripts": {}`) — these get no `test` script
today; `pnpm -r run test` skips them.

**Root fan-out to add** (`pnpm -r run <script>` skips packages lacking the script, so absent
scripts in `@motajs/config`/`@motajs/utils`/`@motajs/react-dark-mode` are harmless):
```json
  "scripts": {
    "lint": "eslint --fix",
    "lint:check": "eslint .",
    "test": "pnpm -r run test",
    "typecheck": "pnpm -r run typecheck",
    "build": "pnpm -r run build"
  }
```

**`typecheck` additions:** editor + `file2x`, `packer`, `react-dark-mode`, `react-hooks`,
`react-monaco-editor`, `react-store`, `utils`. Use `"typecheck": "tsc -b"` to match
`service-worker`. Each of these has a `tsconfig.json` (e.g. `packages/libs/utils/tsconfig.json:1-4`).
**Execution-time check:** the lib base (`packages/libs/config/tsconfig.lib.base.json:1-31`) has
`noEmit: true` and no `composite`. `service-worker` proves `tsc -b` works on a solution-style
`tsconfig.json` (`tsconfig.json:1-7` + two non-composite project files). If `tsc -b` rejects a
lib project, fall back to `tsc --noEmit -p tsconfig.json` — record which was used in `BASELINE.md`.

---

### `persistExecutor.invariants.test.ts` (test, event-driven) — NEW

**Analog:** `packages/apps/editor/src/fs/__tests__/PersistExecutor.test.ts` (395 lines, D-09 says leave untouched)

**Import + structure pattern** (`PersistExecutor.test.ts:1-15`):
```ts
/**
 * PersistExecutor 单元测试
 */

import { describe, it, expect } from "vitest";
import { PersistExecutor } from "../PersistExecutor";
import { wait } from "@test/utils/testHelpers";
import { effect } from "alien-signals";

describe("PersistExecutor", () => {
  ...
});
```
Note `@test/...` alias and `../PersistExecutor` relative import — the new file sits beside it in
`src/fs/__tests__/`, so the same relative path applies (D-10: only import paths change on migration).

**Intent/schedule pattern** (`PersistExecutor.test.ts:148-180`) — the API the invariants use:
```ts
const executor = new PersistExecutor();
const results: string[] = [];
executor.schedule({ kind: "write", execute: async () => {
  await wait(20);
  results.push("write");
} });
executor.schedule({ kind: "delete", execute: async () => {
  results.push("delete");
} });
await executor.whenQuiescent();
expect(results).toEqual(["write", "delete"]);
```

**Error/status observation pattern** (`PersistExecutor.test.ts:276-308`): subscribe with
`effect(() => { const status = executor.status(); ... })` and unsubscribe; assert final
`executor.status().status`.

**Public API surface to freeze** (`src/fs/PersistExecutor.ts`, read this session):
- status union `:18-21`; `schedule()` `:38-45`; `retry()` `:55-58`; failure-visible-only-when-nothing-pending `:76-80`; `flush()` rethrows `:98-102`; `whenQuiescent()` never rejects `:89-91`; `hasPending()` `:104-106`; the no-rollback module contract `:1-7`.

**Observation-first discipline (RESEARCH §Pattern 3):** for every new assertion, call the unit,
assert a deliberately wrong value, run, copy the real value out of the failure, then rename the
test. Do **not** derive expectations from reading `PersistExecutor.ts`. Then verify the suite can
fail (break the implementation once, watch one assertion go red).

**Invariants to freeze (D-11 only):** error→retry→idle; concurrent latest-wins; failure invisible
while a newer intent is pending; `flush()` rejects while `whenQuiescent()` does not. Do **not**
record full state-transition snapshots.

---

### `persistenceMonitor.invariants.test.ts` (test, event-driven) — NEW

**Primary analog:** `packages/apps/editor/src/fs/__tests__/PersistenceMonitor.test.ts` (290 lines)

**Structure + reset pattern** (`PersistenceMonitor.test.ts:5-15`):
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { PersistenceMonitor } from "../PersistenceMonitor";
import { wait } from "@test/utils/testHelpers";
import { effect } from "alien-signals";

describe("PersistenceMonitor", () => {
  let monitor: PersistenceMonitor;

  beforeEach(() => {
    monitor = new PersistenceMonitor();
  });
```
**Use `new PersistenceMonitor()`, not the `persistenceMonitor` singleton, wherever the invariant is
not singleton-specific** (RESEARCH §Pattern 3 note — the singleton is exactly what KERN-01 later
replaces; the suite must keep passing through that).

**Path normalization + retry pattern** (`PersistenceMonitor.test.ts:229-288`) — copy this shape
almost verbatim:
```ts
monitor.schedule("./project\\data.js", {
  kind: "write",
  execute: async () => {
    await wait(20);
    values.push("old resource");
  },
});
monitor.schedule("project/data.js", { kind: "write", execute: async () => { values.push("new resource"); } });
await monitor.flush(["project/data.js"]);
expect(values).toEqual(["old resource", "new resource"]);
```

**"Persist failure does not roll back resource state" — second analog:**
`packages/apps/editor/src/project/data/__tests__/persistStatus.integration.test.ts:72-101`.
Fault injection through `MemoryFileSystem`:
```ts
project.fs.setWriteError(new Error("tower persist failed"));
const result = await tableCommands.patchResource(tower, [
  ["change", "['firstData']['title']", "Failed Persist Title"],
]);
expect(result).toEqual({ ok: true });
expect(tower.value().firstData.title).toBe("Failed Persist Title"); // UI value kept
await persistenceMonitor.whenQuiescent([tower.path]);
expect(tower.persistStatus().status).toBe("error");
expect(project.readText(TOWER_PATH)).not.toContain("Failed Persist Title"); // disk not written
```
Fixtures: `loadSampleProject()` from `@test/utils/sampleProject` (`:40-42`) with
`afterEach` resetting `FileHandlerManager.clear()` / `projectData.resetForTests()` (`:44-49`).
**This one invariant needs the submodule** (`sampleProject.ts:27` walks `MOTA_JS_ROOT/project`).
Keep it in this file but be aware the file becomes submodule-dependent; the pure-monitor
invariants in the same file use `new PersistenceMonitor()` only and need no project fixture.

**Flush/aggregate pattern** — `src/fs/PersistenceMonitor.ts:80-94` throws
`new AggregateError(..., "工程文件写入失败")`; `whenQuiescent` `:96-102` is the non-rejecting
ordering primitive. Assert `await expect(monitor.flush([...])).rejects.toThrow("工程文件写入失败")`.

---

### `operationHistory.invariants.test.ts` (test, CRUD + event-driven) — NEW

**Analog:** `packages/apps/editor/src/project/history/__tests__/operationHistory.test.ts` (156 lines)

**Setup/teardown pattern, verbatim** (`operationHistory.test.ts:34-56`):
```ts
describe("OperationHistory", () => {
  let project: SampleProjectContext;
  let currentViewport: EditorViewport;
  let disposeViewport: () => void;

  beforeEach(async () => {
    operationHistory.clear();
    project = await loadSampleProject();
    currentViewport = viewport("sample0");
    disposeViewport = registerEditorViewportProvider({
      capture: () => structuredClone(currentViewport),
      restore: (next) => {
        currentViewport = structuredClone(next);
      },
    });
  });

  afterEach(() => {
    disposeViewport();
    operationHistory.clear();
    FileHandlerManager.clear();
    projectData.resetForTests();
  });
```
The `viewport()` helper (`:14-32`) is local to the spec — copy it.

**Pure-operation pattern to copy for capacity / inverse / redo-truncation**
(`operationHistory.test.ts:128-155`) — **this needs no project fixture and no submodule:**
```ts
const counterOperation = (delta: number): EditorOperation<unknown> => ({
  meta: { label: "counter", stage: "counter" },
  targets: [],
  apply: async () => {
    value += delta;
    return { value, inverse: counterOperation(-delta), changed: delta !== 0 };
  },
});
await expect(operationHistory.execute(compositeOperation(
  [counterOperation(1), failingOperation],
  { label: "composite", stage: "composite" },
))).rejects.toMatchObject({ commandStage: "composite-child" });
expect(value).toBe(0);
```

**Multi-target checkpoint pattern** (`operationHistory.test.ts:97-126`) — custom
`OperationTarget` with `key`/`path`/`capture`/`restore`, plus an operation whose `apply` mutates
then throws; assert the target is back at its pre-apply value and that a subsequent `undo()` is
still a no-op.

**Freezing capacity without reading internals:** `operationHistory` exposes no entries getter
(only the `useOperationHistory()` hook, `operationHistory.ts:201-216`). Observe capacity
behaviourally: after 101 `execute()` calls, 100 `undo()` calls succeed and the 101st is a no-op.
Source of truth for what is being frozen: `operationHistory.ts:79` (`capacity = 100`) and
`:143` (`if (entries.length > this.capacity) entries.shift();`).

**Redo truncation:** execute A, `undo()`, execute B, then `redo()` is a no-op
(source `:133` `entries.slice(0, state.current)`).

**Resource reactivity after `set`/`patch`/undo — needs `loadSampleProject()`**
(analog `operationHistory.test.ts:78-95`):
```ts
project.fs.setWriteDelay(80);
await tableCommands.patchFloor("sample0", [["change", "['title']", "Memory first title"]]);
expect(floorResource.value().title).toBe("Memory first title"); // observable within the microtask chain
expect(persistenceMonitor.hasUnsavedChanges()).toBe(true);
await operationHistory.undo();
expect(floorResource.value().title).toBe(originalTitle);
```
Isolate this one test (A6: assert observable value change, never scheduler internals).

**Design note for D-13/D-15:** keep every non-reactivity test free of `loadSampleProject()` so the
only submodule-coupled assertions are in clearly-labelled tests. That makes the eventual
fixture rewrite (Open Question 2 option (b)) a single-file change.

---

### VERIFY-07 manifest protocol assertion (test, file-I/O) — MODIFY `editor-artifact-plugin.test.ts`

**Analog:** `packages/apps/editor/editor-artifact-plugin.test.ts` (80 lines) +
`packages/apps/editor/src/runtime/protocol.test.ts:4-6` (the already-pinned `4` side)

**Existing pinned half, verbatim** (`src/runtime/protocol.test.ts:4-6`):
```ts
describe("runtime host protocol", () => {
  it("requires protocol v4 and carries the host preview URL", () => {
    expect(RUNTIME_PROTOCOL_VERSION).toBe(4);
```

**Temp-dir fixture helper to reuse** (`editor-artifact-plugin.test.ts:12-26`):
```ts
const roots: string[] = [];

async function artifact(files: Array<[string, string]>): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "editor-build-id-"));
  roots.push(root);
  for (const [name, content] of files) {
    await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await fs.writeFile(path.join(root, name), content);
  }
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});
```

**The value to pin, verbatim** (`editor-artifact-plugin.ts:22-30` and `:163-171`):
```ts
export interface EditorArtifactManifest {
  schemaVersion: 2;
  environmentProtocolVersion: 1;
  runtimeProtocolVersion: 3;
  ...
}
```
There is **no** existing assertion on the manifest side; `editor-artifact-plugin.test.ts` never
drives `closeBundle` (`:28-79` covers build-id/report helpers only).

**Recommended: observe the real output** by driving `closeBundle` on a fabricated valid artifact
(real observation, Feathers-style, not a tautology):
```ts
const root = await artifact([["index.html", "editor"], ["assets/ts.worker-abc.js", ""]]);
const plugin = editorArtifactPlugin("test").find(({ name }) => name === "mota-editor-artifact")!;
plugin.configResolved?.call(plugin, { build: { outDir: root } } as never);
await plugin.closeBundle?.call(plugin);
const manifest = JSON.parse(await fs.readFile(path.join(root, "editor-manifest.json"), "utf8"));
expect(manifest.runtimeProtocolVersion).toBe(3); // mismatch with RUNTIME_PROTOCOL_VERSION=4 is intentional
```
`closeBundle` (`editor-artifact-plugin.ts:154-173`) copies Blockly media/theme and calls
`validateEditorArtifact` (`:102-115`), which requires **exactly one** `ts.worker-*.js`
(`/^(?:ts|typescript)\.worker-.*\.js$/`) and **no** css/html workers — hence the fabricated
`assets/ts.worker-abc.js`.

**Fallback if driving the plugin is judged too heavy:** read the source literal
(`expect(await fs.readFile(new URL("./editor-artifact-plugin.ts", import.meta.url), "utf8")).toContain("runtimeProtocolVersion: 3")`).
Do **not** assert `3 !== 4` (Anti-Patterns: tautology). Assert each value against its own literal,
in its own test, with a comment that the mismatch is intentionally preserved.

---

### `packages/apps/service-worker/e2e/fixtures.ts` (test fixture, event-driven) — NEW

**Analog:** `packages/apps/editor/e2e/utils/projectSandbox.ts` is the repo's only
"e2e helper module" (a class factory `ProjectSandbox.create(page)` + `page.route`). There is
**no existing Playwright `test.extend` fixture** in the workspace — this is a partial match.

**The silent skip to replace, verbatim** (`project-host.spec.ts:3,101-102`):
```ts
const withEditor = process.env.MOTA_WITH_EDITOR !== "0";
...
test("shows live Editor cache progress on the project page", async ({ page }) => {
  test.skip(!withEditor, "requires a staged Editor release");
```

**Polarity context** (`packages/apps/service-worker/playwright.config.ts:3,19-24`): the config
computes the same predicate and chooses the webServer command
(`${withEditor ? "pnpm build:with-editor" : "pnpm build"}`), so the default is "editor staged";
the skip only fires under `MOTA_WITH_EDITOR=0`.

**Recommended shape** (RESEARCH §Pattern 4): an auto fixture that (a) asserts the release is
staged, (b) throws a descriptive error naming the exact remediation command, (c) turns
`MOTA_WITH_EDITOR=0` into an *announced* opt-out, never a silent pass:
```ts
import { test as base, expect } from "@playwright/test";

const editorRequested = process.env.MOTA_WITH_EDITOR !== "0";

export const test = base.extend<{ editorRelease: void }>({
  editorRelease: [async ({ page }, use, testInfo) => {
    if (!editorRequested) {
      testInfo.annotations.push({
        type: "editor-release-opt-out",
        description: "MOTA_WITH_EDITOR=0 — editor hosting is not covered by this run",
      });
      await use();
      return;
    }
    await page.goto("/");
    if (await page.getByTestId("open-editor").count() === 0) {
      throw new Error(
        "Editor release is not staged. Run " +
        "`pnpm --filter @motajs/service-worker build:with-editor` and retry.",
      );
    }
    await use();
  }, { auto: true }],
});

export { expect };
```
**CI must never set `MOTA_WITH_EDITOR=0`** (RESEARCH Runtime State Inventory) so required checks
always exercise the real path. `test.skip` at runtime counts as success for GitHub required
checks, which is precisely why the skip must go.

**Also fix the conditional-assertion block** (`project-host.spec.ts:55-59`): it currently asserts
*less* when the editor is absent (`if (withEditor) {...} else await expect(...).toHaveCount(0)`).
Route it through the same fixture/gate so the branch is explicit.

---

### `packages/apps/editor/e2e/baseline-capture.spec.ts` (test/e2e, file-I/O) — NEW

**Analog:** `packages/apps/editor/e2e/editor-smoke.spec.ts` (421 lines)

**Test-id anchors to use, verbatim from the analog:**
- shell: `workbench` (`:108`), `edit-mode-select` (`:128`), `floor-select` (`:129`)
- map: `map-pixi-renderer` (`:271`), `map-canvas-input` (`:335`), `floor-management-list` (`:254`)
- table: `panel-tower` + `schema-table` (`:195-196`)
- code: `scripts-workspace` (`:162`), `panel-map`/`functions` modes via `edit-mode-select` (`:212-224`)
- asset: `resources-workspace` (`:23`, mode `appendpic`)

**Panel-mode enumeration to reuse** (`editor-smoke.spec.ts:14-24`):
```ts
const panels = [
  { mode: "map", testId: "panel-map", title: "", contentTestId: "floor-management-list" },
  { mode: "tower", testId: "panel-tower", title: "全塔属性", contentTestId: "schema-table" },
  { mode: "functions", testId: "scripts-workspace", title: "函数" },
  ...
  { mode: "appendpic", testId: "resources-workspace", title: "资源管理" },
] as const;
```

**Deterministic fixture pattern** (`e2e/utils/projectSandbox.ts:102-109`): `ProjectSandbox.create(page)`
intercepts `**/*` and serves `MOTA_JS_ROOT/project` — the same input the unit fixtures use, so the
screenshot baseline and the test baseline describe the same project.
```ts
const sandbox = await ProjectSandbox.create(page);
await page.goto("/");
```
**Freeze volatility before capture:** fixed `page.setViewportSize(...)`, wait for the surface
selector to be visible, and hide the runtime preview iframe (it executes project-authored code —
RESEARCH §Security Domain: don't commit it). Capture one PNG per surface into
`.planning/baseline/screenshots/` via `page.screenshot({ path })`. No `toHaveScreenshot`
(D-08: human comparison only; platform-keyed reference names would be dead weight).

**Do not let this spec dirty the tree on every e2e run.** Recommended: add a second project in
`packages/apps/editor/playwright.config.ts` with `testMatch: /baseline-capture\.spec\.ts/` and
`testIgnore` that name in the default project (`playwright.config.ts:30-38`); run it on demand
with `playwright test --project baseline-capture`. Confirm the new `vitest.config.ts` keeps
`exclude: [...configDefaults.exclude, "e2e/**"]` so vitest never collects it.

---

### `.planning/baseline/` artifacts (doc + data, file-I/O) — NEW

**`editor-manifest.json`** — copy the build output verbatim (`editor-artifact-plugin.ts:163-172`
writes `<outDir>/editor-manifest.json`). Do not hand-edit; it is the frozen artifact manifest.
It is gitignored under `dist` (`packages/apps/editor/.gitignore:11`), which is why it must be
copied into the tracked `.planning/baseline/`.

**`BASELINE.md` + `baseline.json`** — no real analog; use `.planning/codebase/TESTING.md` only as a
document-structure reference (tables of facts + run commands). Required fields (D-05, Pitfall 4/5):

```json
{
  "git": { "commit": "<git rev-parse HEAD>", "submoduleSha": "<git submodule status>", "pnpm": "11.10.0", "node": "24" },
  "unit": { "<pkg>": { "passed": 0, "failed": 0, "skipped": 0, "total": 0 } },
  "e2e":  { "<pkg>": { "passed": 0, "failed": 0, "skipped": 0, "total": 0 } },
  "build": { "editor": { "files": 0, "rawBytes": 0, "gzipBytes": 0, "brotliBytes": 0, "rawBudgetBytes": 20971520, "rawPercentOfBudget": 0,
                          "exactlyOneTsWorker": true, "noCssHtmlWorkers": true } },
  "protocol": { "manifestRuntimeProtocolVersion": 3, "runtimeProtocolVersion": 4, "mismatchPreserved": true },
  "ciJobNames": ["lint", "typecheck", "unit", "build"],
  "envVars": ["MOTA_JS_ROOT", "MOTA_WITH_EDITOR", "MOTA_EDITOR_E2E_PORT", "PLAYWRIGHT_USE_SYSTEM_CHROME"]
}
```

**Source commands (don't recompute numbers by hand):**
- counts: `vitest run --reporter=json` / Playwright `--reporter=json`; record passed/failed/**skipped**/total separately (Pitfall 5 — file counts ≠ test counts).
- artifact report: capture the `console.info` line (`editor-artifact-plugin.ts:160-162`) or read `editor-manifest.json` + file sizes. Budget constant: `MAX_EDITOR_ARTIFACT_BYTES = 20 * 1024 * 1024` (`:47`); report shape `{ files, rawBytes, gzipBytes, brotliBytes }` (`:38-43`).
- worker facts: `validateEditorArtifact` (`:102-115`) already enforces "exactly one `ts.worker`" and "no css/html workers" — record pass/fail.
- protocol: manifest `3` (`editor-artifact-plugin.ts:25,166`) vs `RUNTIME_PROTOCOL_VERSION = 4` (`src/runtime/protocol.ts:4`).

**Capture order (RESEARCH primary recommendation):** baseline **before** the `vitest.config.ts`
split, on a repaired `node_modules` + initialized submodule + regenerated `styled-system`
(Pitfall 4). `.planning/` is **not** gitignored (verified with `git check-ignore`), so these
artifacts commit normally.

---

### `packages/apps/editor/tsconfig.test.json` (config, transform) — NEW (optional, Pitfall 3)

**Analog:** `packages/apps/editor/tsconfig.app.json:1-27` + `tsconfig.node.json:1-15`

**The gap, verbatim** (`tsconfig.app.json:20-26`):
```json
  "include": ["src"],
  "exclude": [
    "src/**/*.test.ts",
    "src/**/*.test.tsx",
    "src/**/__tests__/**",
    "test"
  ]
```
Nothing typechecks `test/` or `src/**/__tests__/**` today. If the phase wants the `typecheck` gate
to cover the new characterization suites, add a project extending `@motajs/config/tsconfig.app.base.json`
with `include: ["src/**/*.test.ts", "src/**/__tests__/**", "test"]`, the same `paths`
(`@/*`, `@test/*`, `@styled-system/*`), and `types: ["vite/client", "node"]`, then reference it from
`tsconfig.json:1-7` alongside the existing two projects. If out of scope, record the blind spot in
`BASELINE.md` (Open Question 3 recommendation).

---

## Shared Patterns

### Per-package vitest config (never a root aggregator)
**Source:** `packages/apps/service-worker/vitest.config.ts:1-13`, `packages/libs/packer/vitest.config.ts`, `packages/libs/h5animate/vitest.config.ts`, `packages/libs/react-monaco-editor/vitest.config.ts`
**Apply to:** the new `packages/apps/editor/vitest.config.ts` only.
The repo has no root vitest config and per-package is the convention (D-14). Do not introduce a
root `test.projects` aggregator (RESEARCH §Alternatives, `Don't Hand-Roll`).

### Singleton/global reset in `beforeEach`/`afterEach`
**Source:** `src/project/history/__tests__/operationHistory.test.ts:39-56`, `src/project/data/__tests__/persistStatus.integration.test.ts:44-49`, `test/utils/sampleProject.ts:55-58`
**Apply to:** all three characterization suites.
```ts
operationHistory.clear();
FileHandlerManager.clear();
projectData.resetForTests();
persistenceMonitor.resetForTests(); // or new PersistenceMonitor()
```
`PersistenceMonitor.resetForTests()` (`src/fs/PersistenceMonitor.ts:131-137`) exists; prefer a fresh
instance in `persistenceMonitor.invariants.test.ts`.

### Fault injection through `MemoryFileSystem`
**Source:** `packages/apps/editor/test/utils/MemoryFileSystem.ts:19-56,78-98` and its use in `persistStatus.integration.test.ts:29-35,75,159`
**Apply to:** persistence characterization tests.
Available levers: `setWriteDelay(ms)`, `setWriteError(err)`, `setWriteErrorForPath(path, err)`,
`clearWriteError()`, `clearWriteErrorForPath(path)`, `getWriteCount()`, `setFile`/`getFile`/`hasFile`,
`createFsInterface()`. This is the repo's canonical I/O double — never `vi.mock` the fs facade
(TESTING.md "What NOT to mock").

### `@test` alias + shared fixtures
**Source:** `packages/apps/editor/test/utils/testHelpers.ts:1-49` (`wait`, `waitFor`, `createTestFileHandler`), `packages/apps/editor/test/utils/sampleProject.ts:53-113` (`loadSampleProject`), `packages/apps/editor/test/arbitraries.ts`
**Apply to:** all editor characterization tests.
The alias must be declared in the new `vitest.config.ts` (`@test` → `test`) or `@test/utils/...`
imports fail.

### `pnpm -r run` fan-out
**Source:** `packages/apps/service-worker/package.json:9` (`build:with-editor` already chains `pnpm --filter ...`)
**Apply to:** root `test`/`typecheck`/`build`.
`-r run` skips packages lacking the script; a script that exists and fails must fail the job. Never
use `exec` (does not skip) for the fan-out.

### GitHub Actions preamble + least privilege
**Source:** `.github/workflows/deploy-editor-h5test.yml:14-30`
**Apply to:** every `ci.yml` job.
`permissions: contents: read`, `actions/checkout@v4`, `pnpm/action-setup@v4` (`version: 11.10.0`),
`actions/setup-node@v4` (`node-version: 24`, `cache: pnpm`), `pnpm install --frozen-lockfile`.
No secrets, no `environment:`, no `pull_request_target`, no path filters.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `.planning/baseline/screenshots/*.png` | data | file-I/O | No committed image baselines exist; D-08 forbids machine snapshots, so these are human-review artifacts (A3). |
| `.planning/baseline/baseline.json` (schema) | data | file-I/O | No prior machine-readable baseline. Schema is `the agent's Discretion` (D-05); fields listed above. |
| `packages/apps/service-worker/e2e/fixtures.ts` (`test.extend`) | test fixture | event-driven | No Playwright fixture module exists anywhere; only helper classes (`projectSandbox.ts`). Use the RESEARCH §Pattern 4 shape. |
| `.github/workflows/ci.yml` | config (CI) | event-driven | Only a `workflow_dispatch` deploy workflow exists; the `pull_request`/`push` + multi-job shape is new (mirror the preamble, invent the job matrix). |
| `.planning/baseline/BASELINE.md` | doc | — | No comparable baseline document; `.planning/codebase/TESTING.md` is a structural reference only. |

---

## Metadata

**Analog search scope:** `.github/workflows/`, `packages/apps/editor/`, `packages/apps/service-worker/`, `packages/libs/{packer,h5animate,utils,file2x,react-store,react-hooks,react-dark-mode}/`, `.planning/codebase/`, root `package.json`
**Files scanned (read this session):** 30
**Analogs selected (read in full):** 18
**Tracked-source verification:** `git ls-files` confirmed every analog path is tracked; `.planning/` confirmed not gitignored via `git check-ignore`
**Pattern extraction date:** 2026-09-20

**Known limits:** the local `node_modules` is broken and the `mota-js` submodule is uninitialized
(RESEARCH §Environment Availability), so no analog was *executed* — all patterns are read from
source. The `tsc -b`-on-libs question (see root `package.json` assignment) is the one pattern that
must be confirmed at execution time.
