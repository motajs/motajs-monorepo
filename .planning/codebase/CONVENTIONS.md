# Coding Conventions

**Analysis Date:** 2026-09-20

## Overview

This is a pnpm workspace monorepo (`pnpm-workspace.yaml`) split into three package groups:

- `packages/libs/*` — reusable libraries (`@motajs/utils`, `@motajs/packer`, `@motajs/h5animate`, `@motajs/react-hooks`, `@motajs/react-store`, `@motajs/file2x`, `@motajs/react-monaco-editor`, `@motajs/react-dark-mode`, `@motajs/config`, `@motajs/theme`)
- `packages/apps/*` — applications (`@motajs/editor`, `@motajs/service-worker`)
- `packages/external/*` — vendored upstream code (`mota-js`, a git submodule)

TypeScript everywhere. `"type": "module"` in every `package.json`. No `.js` source output except `@motajs/packer` (compiled with `tsc`).

There are **two ESLint configurations**, and which one applies depends on the file's package:

| Scope | Config file | Quote / style enforcement |
|-------|-------------|---------------------------|
| Root + `packages/libs/*` | `eslint.config.js` | **Prettier is the formatting authority** through `prettier/prettier: error`; `eslint-config-prettier/flat` is composed LAST in `extends`, so no stylistic rule can fight Prettier. `@stylistic` customize keeps only the layout preferences it still owns (2-space indent, 1tbs braces, arrow parens). |
| `packages/apps/editor` | `packages/apps/editor/eslint.config.js` | The same Prettier enforcement (`prettier/prettier: error`, `eslint-config-prettier/flat` last); plus `prefer-arrow-callback`, `object-shorthand`, `arrow-body-style: as-needed`. |

**Exactly one quote style: single quotes.** `@stylistic/quotes` is no longer an active rule in either configuration — `eslint-config-prettier/flat` turns it off and `.prettierrc.json` (`singleQuote: true`) is the single authority. Prettier still emits a double-quoted string where that needs fewer escapes (a string containing an apostrophe); that is its documented behaviour and is precisely why no rule may re-introduce a second style.

`packages/apps/editor/dprint.jsonc` is **dormant** — nothing invokes it — and its `quoteStyle` has been aligned to `preferSingle` only so it cannot contradict Prettier if it is ever run. `@motajs/packer` also has an `eslint src --ext .ts` script, and the root config's `files: ["**/*.{js,ts,tsx}"]` therefore applies to it.

`@motajs/config` (`packages/libs/config/`) holds the shared tsconfig bases consumed by every package.

## Naming Patterns

**Files:**
- Classes and React components use **PascalCase**: `packages/apps/editor/src/fs/FileHandler.ts`, `packages/apps/editor/src/components/SchemaTable/CollectionControl.tsx`, `packages/apps/editor/src/MapEditor/MapEditorStore.ts`, `packages/libs/packer/src/logger.ts` (`Logger` class).
- Stores use the `XxxStore.ts` suffix: `packages/apps/editor/src/components/Table/stores/DataStore.ts`, `packages/apps/editor/src/components/Table/stores/FoldStore.ts`, `packages/apps/editor/src/stores/PanelStore.ts`.
- Services use the `xxxService.ts` / `XxxDataHandler.ts` pairing: `packages/apps/editor/src/services/enemy/enemyService.ts`, `packages/apps/editor/src/services/enemy/EnemysDataHandler.ts`.
- Plain modules, utilities, and hooks use **camelCase**: `packages/apps/editor/src/utils/fieldPath.ts`, `packages/libs/utils/lib/common.ts`, `packages/apps/editor/src/hooks/useData.ts`.
- Hooks files/functions are `useXxx`: `packages/apps/editor/src/hooks/useTableMeta.ts`, `packages/libs/react-hooks/lib/core/common.ts` (`useCurrentFn`, `useNode`).
- Directory barrels are always `index.ts`: `packages/libs/utils/lib/index.ts`, `packages/apps/editor/src/project/commands/index.ts`, `packages/apps/editor/src/components/Table/stores/index.ts`.
- CSS files are kebab-case and co-located: `packages/apps/editor/src/components/SchemaTable/schema-table.css`, `packages/apps/editor/src/Workbench/FloorPanel/floor-panel.css`.

**Functions:**
- camelCase, verb-first: `parseFieldPath`, `applyActionsWithInverse`, `setByFieldPath`, `createTestFileHandler`.
- Factory functions are `createXxx`: `packages/libs/packer/src/errors.ts` (`createZipNotFoundError`), `packages/apps/editor/src/project/commands/types.ts` (`commandOk`, `commandError`).
- Predicates are `isXxx` / `hasXxx`: `packages/libs/utils/lib/type.ts` (`isNonNullable`), `packages/apps/editor/src/components/Table/utils/validation.ts` (`checkRange`).

**Variables / Constants:**
- Module-level constants use `UPPER_SNAKE_CASE`: `packages/apps/editor/src/project/commands/mapMatrix.ts`, `packages/apps/editor/test/arbitraries.ts` (`JS_RESERVED_WORDS`, `UNSAFE_OBJECT_KEYS`), `packages/apps/editor/e2e/utils/projectSandbox.ts` (`PROJECT_ROOT`, `FILE_ENDPOINTS`).
- Local variables camelCase, `snake_case` for raw game-data fields (from `mota-js`): `floorId`, `mapId`, `enemy-items`.

**Types:**
- Type aliases and interfaces use **PascalCase**. Handler contracts use an `I` prefix: `packages/apps/editor/src/fs/interfaces.ts` (`IContentView<T>`, `IContentHandler<T>`, `IDataHandler<T>`). Ordinary data shapes do not: `EditorNotification` in `packages/apps/editor/src/utils/notify.ts`, `Fs`/`FsPromiseApi` in `packages/apps/editor/src/services/fs/fs.ts`, `FieldConfig` in `packages/apps/editor/src/components/Table/types.ts`.
- Generic parameters are single uppercase letters (`T`, `R`, `C`, `A`, `M`): `packages/libs/utils/lib/exception.ts`, `packages/libs/utils/lib/common.ts`.
- Discriminated unions model results: `packages/apps/editor/src/project/commands/types.ts` defines
  `export type CommandResult = { ok: true } | { ok: false; stage: string; error: Error };`
- `satisfies` is preferred over casting when validating object literals against a union (e.g. `satisfies RuntimeMessage` throughout `packages/apps/editor/src/runtime/`).

**Enums:**
- Enums are UPPER_SNAKE members on a PascalCase enum, used only where `erasableSyntaxOnly` is not enabled: `H5AnimateErrorCode` in `packages/libs/h5animate/lib/errors.ts`, `ErrorCode` in `packages/libs/packer/src/errors.ts`.
- **Do not add `enum` to `packages/apps/editor`** — `packages/apps/editor/tsconfig.app.json` sets `"erasableSyntaxOnly": true`. Use `as const` object maps or union types instead.

## Code Style

**Formatting:**
- **Prettier is the formatter of record.** `.prettierrc.json` at the repository root is the one configuration: `singleQuote: true`, `semi: true`, 2-space indent, `trailingComma: "all"`, `printWidth: 120`, `arrowParens: "always"`, `quoteProps: "as-needed"`, `endOfLine: "lf"`.
- Run it with `pnpm format` (`prettier --write .`), gate it with `pnpm format:check` (`prettier --check .`). ESLint enforces the same thing through `prettier/prettier: error`, so `pnpm lint` also fails on an unformatted file.
- **There is one quote style: single quotes.** The historical `@stylistic/quotes: double` rule is no longer active, and the editor's own previous mix (some files single, some double) was resolved by the reformat — do not match a neighbouring file's quote style, Prettier decides.
- Prettier covers js/jsx/mjs/cjs/ts/tsx plus json/jsonc/css/less. **Markdown and YAML are deliberately outside its scope** (they are listed in `.prettierignore`): the repository's Markdown is largely Chinese prose and `AGENTS.md` is regenerated by GSD, while `pnpm-workspace.yaml` and the GitHub workflows are hand-maintained configuration. `node_modules`, `**/dist`, `**/styled-system` (PandaCSS generated output), `coverage`, `playwright-report`, `test-results`, `pnpm-lock.yaml`, `packages/external` (vendored submodule), `.planning` (versioned planning evidence) and the legacy `packages/libs/packer/prev` are excluded too.
- `.gitattributes` pins text files to LF (`* text=auto eol=lf`). With `core.autocrlf=true` on Windows this is what makes `prettier --check` behave identically on Windows and Linux; the git index was already entirely LF, so the policy changed no committed bytes.
- `packages/apps/editor/dprint.jsonc` is dormant — nothing invokes it. Its `quoteStyle` is aligned to `preferSingle` so that it cannot contradict Prettier if someone ever runs it.
- Explicit `.js` import extensions in `@motajs/h5animate` (`packages/libs/h5animate/lib/validation.ts` imports `'./errors.js'`). All other packages use extensionless relative imports.

**Linting:**
- Root `eslint.config.js` rules of note: `@typescript-eslint/no-unused-vars: warn`, `no-explicit-any: warn`, `ban-ts-comment: warn`, `no-empty-object-type: warn`, `no-constant-condition` with `checkLoops: "none"`.
- React hooks are enforced: `react-hooks/rules-of-hooks: error`; `react-refresh/only-export-components: warn` (allowConstantExport); `react-hooks-better-stable/exhaustive-deps: warn` with custom `stableHooks` (`useStatic`, `useRefFrom`, `useCurrentFn`, `useForceUpdate`, `useStorageItem`).
- Editor overrides in `packages/apps/editor/eslint.config.js`: `prefer-arrow-callback: warn`, `object-shorthand: warn`, `arrow-body-style: ["warn", "as-needed"]`.
- File-level opt-out is used sparingly, e.g. `/* eslint-disable @typescript-eslint/no-explicit-any */` at the top of `packages/apps/editor/src/fs/__tests__/FileHandlerManager.test.ts`.

**TypeScript:**
- `strict: true` in all bases (`packages/libs/config/tsconfig.lib.base.json`, `tsconfig.app.base.json`, `tsconfig.vite.json`).
- `moduleResolution: "bundler"`, `allowImportingTsExtensions: true`, `isolatedModules`, `moduleDetection: "force"`, `noEmit`, `target: ESNext`.
- Editor app adds `verbatimModuleSyntax: true` → **always** use `import type { X }` for type-only imports.
- Editor app adds `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `noUncheckedSideEffectImports`.
- Test files are excluded from the editor's source tsconfig (`packages/apps/editor/tsconfig.app.json` excludes `src/**/*.test.ts(x)`, `src/**/__tests__/**`, `test`).

## Import Organization

**Order (observed consistently):**
1. Node builtins (`node:path`, `node:fs/promises`): `packages/apps/editor/vite.config.ts`, `packages/apps/editor/e2e/utils/projectSandbox.ts`
2. External packages (`react`, `es-toolkit`, `vitest`, `@testing-library/react`, `fast-check`)
3. Workspace packages (`@motajs/*`, `workspace:*`) — e.g. `packages/apps/service-worker/src/...`
4. Internal path aliases (`@/...`) and relative imports last

```ts
import { isEqual } from 'es-toolkit';
import { deleteByFieldPath, buildFieldPath } from '@/utils/fieldPath';
```
(`packages/apps/editor/src/utils/action.ts`)

**Path Aliases:**
- `@/*` → `src/*` (apps) or `lib/*` (libs), declared in `packages/libs/config/tsconfig.app.base.json` / `tsconfig.lib.base.json` and the package's own tsconfig.
- `@test/*` → `test/*` (`packages/apps/editor/tsconfig.app.json`, `packages/apps/editor/vite.config.ts`)
- `@styled-system/*` → `styled-system/*` (Panda CSS output, editor only)
- Vite resolves the same aliases in `packages/apps/editor/vite.config.ts` and `packages/apps/service-worker/vitest.config.ts` (`"@"`).

## Error Handling

**Result objects for command/operation boundaries:**
- Commands return a discriminated `CommandResult` (`packages/apps/editor/src/project/commands/types.ts`) built by `commandOk()` / `commandError(stage, error)`.
- `notifyCommandResult(result, successMessage)` in `packages/apps/editor/src/utils/notify.ts` turns results into user notifications and a boolean.

**Custom error classes with codes:**
- `H5AnimateError` carries `code`, `position`, `expectedType`, `actualType`, `missingFields`, `fieldPath` and has `getFullDescription()` / `toJSON()` — `packages/libs/h5animate/lib/errors.ts`.
- `MotaBuilderError` carries `code` + `details` and calls `Error.captureStackTrace` — `packages/libs/packer/src/errors.ts`.
- Errors are constructed through named factories (`createInvalidSignatureError`, `createZipNotFoundError`), not `new Error(...)` scattered inline.

**Validation throws typed errors; assertions narrow types:**
```ts
export function validateSoundMeta(sound: unknown, path: string): asserts sound is SoundMeta
```
(`packages/libs/h5animate/lib/validation.ts`)

**Safe failure helper:** `tryDo(fn, onError?)` returns `undefined` or the `onError` result instead of throwing — `packages/libs/utils/lib/exception.ts`.

**Unknown-error normalization** is the repeated idiom:
```ts
const message = error instanceof Error ? error.message : String(error);
```
(`packages/apps/editor/src/utils/notify.ts`, `packages/apps/editor/src/runtime/RuntimeProvider.tsx`, `packages/apps/editor/e2e/utils/projectSandbox.ts`)

## Logging

**Framework:** `console` plus abstractions; no logging library.

**Patterns:**
- Editor uses a notification bus (`subscribeNotifications`, `notifySuccess`, `notifyError`, `notifyInfo`) that falls back to `console.error`/`console.info` when no listener — `packages/apps/editor/src/utils/notify.ts`. Prefer `notifyError(error)` over raw `console.error` in app code.
- `@motajs/packer` has a `Logger` class with an injectable `LogOutput` (`packages/libs/packer/src/logger.ts`) using `group`/`groupEnd` indentation; construct with a custom sink for tests rather than spying on `console`.
- `@motajs/service-worker` writes via `console.warn` in failure paths (spied on in tests, e.g. `packages/apps/service-worker/src/server/editorRelease.test.ts`).

## Comments

**When to Comment:**
- File-level block comment explaining module purpose, written in **Chinese**, on nearly every non-trivial module:
  ```ts
  /**
   * Field Path Utilities
   *
   * 字段路径解析和操作工具函数。
   * 字段路径格式: "['key1']['key2']"
   */
  ```
  (`packages/apps/editor/src/utils/fieldPath.ts`)
- Section dividers use `// ==================== 类型定义 ====================` (`packages/apps/editor/src/services/fs/fs.ts`, `packages/apps/editor/src/fs/__tests__/FileHandlerManager.test.ts`).
- Inline comments explain non-obvious data formats (binary offsets, whitespace semantics): `packages/libs/h5animate/lib/__tests__/binary.test.ts`.

**JSDoc/TSDoc:**
- Exported functions get JSDoc with `@param` and `@example`: `applyAction`/`applyActionsWithInverse` in `packages/apps/editor/src/utils/action.ts`, `parseFieldPath` in `packages/apps/editor/src/utils/fieldPath.ts`.
- Property-level JSDoc is used on interface fields: `packages/apps/editor/src/fs/interfaces.ts`.
- Property tests carry a property tag in the header:
  ```ts
  /**
   * **Feature: tower-data-refactor, Property 3: 嵌套路径支持**
   * **Validates: Requirements 5.4**
   */
  ```
  (`packages/apps/editor/src/utils/__tests__/fieldPath.property.test.ts`)

## Function Design

**Size:** Small, single-purpose helpers are the norm (`packages/libs/utils/lib/common.ts` is 6 lines); larger modules are decomposed by concern into sibling files (`packages/apps/editor/src/project/commands/*.ts`). Files over ~400 lines are usually cohesive domain modules (`packages/libs/h5animate/lib/errors.ts`, 395 lines).

**Parameters:** Options objects with inline defaults are used for configurable functions:
```ts
export function jsIdentifierArb(options: JsIdentifierOptions = {}): fc.Arbitrary<string> {
  const { minLength = 1, maxLength = 20 } = options;
```
(`packages/apps/editor/test/arbitraries.ts`)

**Return Values:**
- Exported functions declare explicit return types (`: void`, `: string[]`, `Promise<void>`).
- Pure helpers return values/fresh objects rather than mutating where practical; mutation helpers are explicit in name — `setByFieldPath`, `deleteByFieldPath`, `applyAction` mutate their `target` argument.

**Async:** `async/await` throughout. Concurrency uses `Promise.all` (`packages/apps/editor/src/fs/__tests__/FileHandlerManager.test.ts`); callback APIs are wrapped into `promises` namespaces rather than mixed (`packages/apps/editor/src/services/fs/fs.ts`).

## Module Design

**Exports:**
- Named exports only; no default exports for utilities (default exports appear only on config files like `vite.config.ts`).
- Type-only re-exports use `export type { X }` / `export type * from './types'` (`packages/apps/editor/src/project/commands/index.ts`, `packages/libs/file2x/lib/index.ts`).
- Barrel `index.ts` files re-export the public surface per package: `packages/libs/utils/lib/index.ts`, `packages/libs/packer/src/index.ts`.

**Barrel Files:**
- Libs expose entry points through `package.json` (`"exports": { ".": "./lib/index.ts" }` in `packages/libs/utils/package.json`, `packages/libs/react-hooks/package.json`).
- Editor barrels selectively re-export and rename types (`export { tableCommands }` and `export { floorCommands, type BatchCreateFloorOptions, ... }` in `packages/apps/editor/src/project/commands/index.ts`).

**State / stores:**
- Editor state is centralized in stores under `packages/apps/editor/src/stores/` and feature-local `stores/` folders; zustand-style `XxxStore` objects (`packages/apps/editor/src/stores/EditorStore.ts`).
- React context providers live next to their feature: `packages/apps/editor/src/Workbench/EventsEditor/EventEditorContext.tsx`, `packages/apps/editor/src/runtime/RuntimeContext.tsx`.

## React Conventions

- Function components with explicit return types are common; props are inline interfaces or imported types.
- Hooks follow the Rules of Hooks strictly (`react-hooks/rules-of-hooks: error`) and rely on `eslint-plugin-react-hooks-better-stable` to treat the project's custom hooks as stable.
- React Compiler is enabled in the editor build via `babel-plugin-react-compiler` (`packages/apps/editor/vite.config.ts`) — avoid manual memoization that assumes compiler is off, and keep render logic pure.
- Error boundaries: `packages/apps/editor/src/components/AppErrorBoundary.tsx`, `packages/apps/editor/src/MapEditor/MapEditorErrorBoundary.tsx`, `packages/apps/editor/src/Workbench/components/PanelErrorBoundary.tsx`.
- Test selectors use `data-test-id` (Playwright `testIdAttribute` in `packages/apps/editor/playwright.config.ts`), retrieved with `getByTestId`.

---

*Convention analysis: 2026-09-20*
