# Testing Patterns

**Analysis Date:** 2026-09-20

## Test Framework

**Runner:**
- Vitest 4.x (`vitest: ^4.0.16` in `pnpm-workspace.yaml`; apps pin `4.0.18` in `packages/apps/editor/package.json`)
- Configs are per-package (there is no root vitest config):
  - `packages/apps/editor/vite.config.ts` — `test` block alongside the Vite config
  - `packages/apps/service-worker/vitest.config.ts`
  - `packages/libs/packer/vitest.config.ts`
  - `packages/libs/react-monaco-editor/vitest.config.ts`
  - `packages/libs/h5animate/vitest.config.ts`
  - `packages/libs/react-hooks`, `packages/libs/react-store`, `packages/libs/file2x` run on Vitest defaults and select the DOM via a `// @vitest-environment jsdom` docblock

**Assertion Library:**
- Vitest built-ins (`expect`, `expect.fail`)
- `@testing-library/react` 16.3.2 for component/hook tests
- `fast-check` 4.5.x for property-based tests

**E2E:**
- `@playwright/test` 1.61.1 — `packages/apps/editor/playwright.config.ts`, `packages/apps/service-worker/playwright.config.ts`

**Run Commands:**
```bash
pnpm --filter @motajs/editor test          # vitest run
pnpm --filter @motajs/editor test:e2e      # playwright test
pnpm --filter @motajs/service-worker test  # vitest run
pnpm --filter @motajs/service-worker typecheck
pnpm --filter @motajs/packer test          # vitest run
pnpm --filter @motajs/packer test:watch    # vitest (watch)
pnpm --filter @motajs/h5animate test       # vitest --run
pnpm --filter @motajs/react-hooks test     # vitest run
pnpm --filter @motajs/react-store test     # vitest run
```
The root `package.json` has no test script; tests are run per package. CI (`.github/workflows/deploy-editor-h5test.yml`) runs `pnpm --filter @motajs/service-worker typecheck` and `pnpm --filter @motajs/service-worker test` before building.

## Test Configuration Details

**Editor (`packages/apps/editor/vite.config.ts`):**
- `environment: "jsdom"`, `globals: true`
- `exclude: [...configDefaults.exclude, "e2e/**"]` — unit and e2e are strictly separated
- `setupFiles: ["./test/setup.ts"]`
- Aliases `@` → `src`, `@test` → `test`, `@styled-system` → `styled-system`

**Service worker (`packages/apps/service-worker/vitest.config.ts`):**
- `environment: "node"`, `include: ["src/**/*.test.ts"]`, `restoreMocks: true`, alias `@` → `src`

**Packer (`packages/libs/packer/vitest.config.ts`):**
- `environment: "node"`, `include: ["**/**/__tests__/**/*.test.ts"]`
- `testTimeout: 30000` for integration tests
- Coverage configured (see below)

**h5animate (`packages/libs/h5animate/vitest.config.ts`):**
- `environment: "node"`, `include: ["lib/**/*.test.ts"]`

**react-monaco-editor (`packages/libs/react-monaco-editor/vitest.config.ts`):**
- `environment: "jsdom"`, `setupFiles: ["./vitest.setup.ts"]`
- A custom Vite plugin stubs `*.worker?worker` imports to `export default class WorkerStub {}`

**Default-config packages:** DOM is declared per test file, e.g. `// @vitest-environment jsdom` at the top of `packages/libs/react-hooks/lib/core/common.test.tsx` and `packages/libs/react-store/lib/store.test.tsx`.

## Test File Organization

**Location — two coexisting patterns:**
1. **`__tests__/` directories next to source** (dominant in the editor and libs):
   - `packages/apps/editor/src/project/commands/__tests__/floorCommands.test.ts`
   - `packages/apps/editor/src/components/SchemaTable/__tests__/SchemaTable.test.tsx`
   - `packages/libs/packer/src/__tests__/extractor.test.ts`
   - `packages/libs/h5animate/lib/__tests__/binary.test.ts`
2. **Co-located `*.test.ts(x)` beside the module**:
   - `packages/apps/editor/src/environment.test.ts`
   - `packages/apps/editor/src/Workbench/draftGuard.test.ts`
   - `packages/apps/service-worker/src/server/router.test.ts`

**Cross-feature / integration tests** live in `packages/apps/editor/test/`:
- `test/blockly/*.test.ts`, `test/mapEditor/*.test.ts`
- Shared utilities: `packages/apps/editor/test/utils/MemoryFileSystem.ts`, `test/utils/testHelpers.ts`, `test/utils/sampleProject.ts`, `test/arbitraries.ts`

**E2E** lives outside `src` in `e2e/` and is excluded from the Vitest run:
- `packages/apps/editor/e2e/editor-smoke.spec.ts`, `packages/apps/editor/e2e/workspace-shell.spec.ts`
- Helpers: `packages/apps/editor/e2e/utils/projectSandbox.ts`, `packages/apps/editor/e2e/utils/tableEditing.ts`
- `packages/apps/service-worker/e2e/*.spec.ts`

**Naming:**
- `*.test.ts` / `*.test.tsx` for unit and integration tests
- `*.property.test.ts` for fast-check property tests (e.g. `packages/apps/editor/src/utils/__tests__/fieldPath.property.test.ts`, `checkRange.property.test.ts`)
- `*.integration.test.ts` for integration-flavored tests (e.g. `packages/apps/editor/src/project/data/__tests__/persistStatus.integration.test.ts`)
- `*.spec.ts` for Playwright e2e

## Test Structure

**Suite Organization (unit):**
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { FileHandlerManager } from "../FileHandlerManager";
import { MemoryFileSystem } from "@test/utils/MemoryFileSystem";

describe("FileHandlerManager", () => {
  let memoryFs: MemoryFileSystem;

  beforeEach(() => {
    memoryFs = new MemoryFileSystem();
    persistenceMonitor.resetForTests();
    FileHandlerManager.clear();
  });

  afterEach(() => {
    FileHandlerManager.clear();
  });

  describe("单例模式", () => {
    it("同一路径应该返回同一实例", () => {
      const handler1 = FileHandlerManager.get("test.txt");
      expect(handler1).toBe(handler2);
    });
  });
});
```
(`packages/apps/editor/src/fs/__tests__/FileHandlerManager.test.ts`)

**Suite Organization (React component):**
```tsx
/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(cleanup);

describe("CollectionControl", () => {
  it("delegates item rendering, create, move, remove and selection", () => {
    const select = vi.fn();
    render(<CollectionControl items={["a", "b"]} onSelect={select} ... />);
    fireEvent.click(screen.getByText("a"));
    expect(select).toHaveBeenCalledWith(0);
  });
});
```
(`packages/apps/editor/src/components/SchemaTable/__tests__/CollectionControl.test.tsx`)

**Suite Organization (hooks):**
```tsx
// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";

const { result, rerender } = renderHook(({ value }) => useCurrentFn(() => value), {
  initialProps: { value: 1 },
});
```
(`packages/libs/react-hooks/lib/core/common.test.tsx`, `packages/libs/react-store/lib/store.test.tsx`)

**Patterns:**
- `describe` nesting mirrors module → function under test.
- Test names are frequently written in Chinese (`"应该正确解析标准字段路径"`) in editor and h5animate; service-worker and libs use English.
- `it` is used in the editor; `test` is common in libs and both are mixed in h5animate.
- `beforeEach`/`afterEach` reset global/singleton state (`FileHandlerManager.clear()`, `persistenceMonitor.resetForTests()`); React suites call `afterEach(cleanup)`.
- Assertions use `@testing-library/react` semantic queries (`getByTestId`, `getByRole`, `getByText`) over CSS selectors.

## Mocking

**Framework:** Vitest (`vi`), `restoreMocks: true` in `packages/apps/service-worker/vitest.config.ts`.

**Module mocks with `vi.hoisted` (service-worker pattern):**
```ts
const mocks = vi.hoisted(() => ({
  handleFsRequest: vi.fn(),
  serveProjectPreview: vi.fn(),
}));

vi.mock("./fsApi", () => ({ handleFsRequest: mocks.handleFsRequest }));
vi.mock("./preview", () => ({ serveProjectPreview: mocks.serveProjectPreview }));

import { routeRequest } from "./router";
```
(`packages/apps/service-worker/src/server/router.test.ts`, also `editorHost.test.ts`)

**Partial mocks preserve real behavior:**
```ts
vi.mock("antd", async (importOriginal) => { ... });
vi.mock("../schemaOverrideCommands", async (importOriginal) => ({ ... }));
```
(`packages/apps/editor/src/components/__tests__/PersistenceNotification.test.tsx`, `packages/apps/editor/src/components/SchemaTable/__tests__/SchemaCustomizationEditor.test.tsx`)

**Global stubs:**
```ts
vi.stubGlobal("fetch", fetchMock);
vi.stubGlobal("caches", { open: vi.fn(...) });
vi.stubGlobal("clients", { matchAll: vi.fn(...) });
vi.stubGlobal("ResizeObserver", class { ... });
```
(`packages/apps/service-worker/src/server/editorRelease.test.ts`, `packages/apps/editor/src/services/fs/__tests__/fs.test.ts`)

**Spy-on-real-interface:** integration tests wire the in-memory filesystem into the real `browserFs.promises` API:
```ts
vi.spyOn(browserFs.promises, "readFile").mockImplementation(project.fs.readFile.bind(project.fs));
vi.spyOn(browserFs.promises, "writeFile").mockImplementation(project.fs.writeFile.bind(project.fs));
```
(`packages/apps/editor/src/project/commands/__tests__/sampleProjectCommands.test.ts`, `packages/apps/editor/src/runtime/__tests__/RuntimeResourceGateway.test.ts`, `packages/apps/editor/src/project/model/__tests__/projectModel.test.ts`)

**Console spying** when asserting warnings:
```ts
vi.spyOn(console, "warn").mockImplementation(() => undefined);
```
(`packages/apps/editor/src/Workbench/CodeEditor/__tests__/projectLanguageEnvironment.test.ts`)

**What to mock:**
- Network and platform APIs (`fetch`, `caches`, `clients`, `window`), browser APIs missing in jsdom (`ResizeObserver`, `matchMedia`, CSS.escape), and cross-feature module boundaries (`@/Workbench/modals/*`, `@/Workbench/CodeEditor/CodeEditorContext`).
- Concrete I/O is replaced with in-memory fakes rather than mocked per-call.

**What NOT to mock:**
- Pure logic and validation (test `checkRange`, field paths, codecs directly).
- The filesystem facade — prefer `MemoryFileSystem` / `ProjectSandbox` over `vi.mock` of `fs`.
- Property tests exercise real implementations, not stand-ins.

## Fixtures and Factories

**Test data helpers:** `packages/apps/editor/test/utils/sampleProject.ts` builds a full project fixture; `packages/apps/editor/test/utils/testHelpers.ts` exports `createTestFileHandler`, `wait`, `waitFor`.

**In-memory filesystem double:**
```ts
const memoryFs = new MemoryFileSystem();
memoryFs.setFile("test.txt", "content");
const handler = FileHandlerManager.get("test.txt");
(handler as any).fs = memoryFs.createFsInterface();
```
`packages/apps/editor/test/utils/MemoryFileSystem.ts` (240 lines) implements `Fs`/`FsPromiseApi` plus fault injection: `setWriteDelay`, `setWriteError`, `setWriteErrorForPath`, `getWriteCount`, `hasFile`.

**Property-based arbitraries:** `packages/apps/editor/test/arbitraries.ts` exports `jsIdentifierArb(options)` and `safeJsonValueArb()` (a `fc.letrec` recursive generator excluding `__proto__`/`constructor`/`prototype`). Tests also define local arbitraries inline (e.g. `numericRangeConfigArb`, `selectConfigArb` in `checkRange.property.test.ts`).

**E2E sandbox:** `ProjectSandbox` in `packages/apps/editor/e2e/utils/projectSandbox.ts` intercepts all requests (`page.route("**/*")`), serves project files from disk, implements the `/readFile`, `/writeFile`, `/listFile`, `/deleteFile`, etc. endpoints, and exposes `waitForWrite`, `writeCount`, `setWriteDelay`, `setWriteFailure` for deterministic persistence assertions.

**Location:** `packages/apps/editor/test/` (unit fixtures) and `packages/apps/editor/e2e/utils/` (e2e fixtures).

## Coverage

**Requirements:** No global coverage threshold is enforced. Only `@motajs/packer` configures coverage:

```ts
coverage: {
  provider: "v8",
  reporter: ["text", "json", "html"],
  include: ["src/**/*.ts"],
  exclude: ["src/index.ts"],
}
```
(`packages/libs/packer/vitest.config.ts`)

**View Coverage:**
```bash
pnpm --filter @motajs/packer exec vitest run --coverage
```

## Test Types

**Unit Tests:** Pure functions, stores, and validation — `packages/apps/editor/src/utils/__tests__/fieldPath.test.ts`, `packages/apps/editor/src/components/Table/stores/__tests__/FoldStore.test.ts`, `packages/libs/packer/src/__tests__/parser.test.ts`.

**Component Tests:** `@testing-library/react` in jsdom — `packages/apps/editor/src/components/SchemaTable/__tests__/SchemaTable.test.tsx`, `packages/apps/editor/src/components/Table/components/inputs/__tests__/CheckboxInput.test.tsx`, `packages/apps/editor/src/components/__tests__/PersistenceNotification.test.tsx`.

**Integration Tests:** Real modules wired to in-memory fakes — `packages/apps/editor/src/project/commands/__tests__/sampleProjectCommands.test.ts`, `packages/apps/editor/src/fs/__tests__/FileHandlerManager.test.ts`, `packages/apps/editor/src/project/data/__tests__/persistStatus.integration.test.ts`, and all of `packages/apps/service-worker/src/server/*.test.ts`.

**Property-Based Tests (`fast-check`):** `fc.assert(fc.property(...), { numRuns: 100 })` with generators inline or from `test/arbitraries.ts`. Examples: `packages/apps/editor/src/utils/__tests__/fieldPath.property.test.ts`, `packages/apps/editor/src/components/Table/utils/__tests__/checkRange.property.test.ts`, `packages/apps/editor/src/services/tableMeta/__tests__/tableMetaService.property.test.ts`, `packages/apps/editor/src/utils/__tests__/serialize.property.test.ts`. Conventions: document the property ID in the header comment, use round-trip/idempotency invariants, and filter out unsafe inputs rather than mocking.

**E2E Tests (Playwright):** `packages/apps/editor/playwright.config.ts` — `testDir: "./e2e"`, `fullyParallel: false`, `workers: 1`, `testIdAttribute: "data-test-id"`, `baseURL` from `MOTA_EDITOR_E2E_PORT` (default 1055), `webServer` boots `pnpm exec vite`, `trace/screenshot/video` on failure, uses system Chrome on non-CI macOS when `PLAYWRIGHT_USE_SYSTEM_CHROME=1`. Specs drive the real editor through the `ProjectSandbox` route interceptor and assert no `pageerror` events and no fatal fallback text.

## Common Patterns

**Async testing:**
- `await expect(...).resolves.not.toThrow()` for async error paths (`packages/apps/editor/src/fs/__tests__/FileHandlerManager.test.ts`).
- `waitFor(condition, timeout)` / `wait(ms)` helpers from `packages/apps/editor/test/utils/testHelpers.ts`.
- Playwright uses `await expect.poll(() => ...)` and explicit release promises to test loading states deterministically (`packages/apps/editor/e2e/editor-smoke.spec.ts`).

**Error testing:**
```ts
expect(() => parser.readUInt32LE()).toThrow(H5AnimateError);
```
and asserting metadata on the thrown error:
```ts
try {
  parser.readUInt32LE();
  expect.fail("应该抛出错误");
} catch (error) {
  expect(error).toBeInstanceOf(H5AnimateError);
  expect((error as H5AnimateError).code).toBe(H5AnimateErrorCode.CORRUPTED_HEADER);
}
```
(`packages/libs/h5animate/lib/__tests__/binary.test.ts`)

**Barrier tests:** For CSS/DOM specifics jsdom lacks, `packages/libs/react-monaco-editor/vitest.setup.ts` polyfills `matchMedia`, `CSS.escape`, and `queryCommandSupported`; `packages/apps/editor/test/setup.ts` injects a `<script id="mota-editor-environment">` JSON block so `@/environment` parses endpoints.

---

*Testing analysis: 2026-09-20*
