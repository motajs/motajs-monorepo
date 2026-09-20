<!-- GSD:project-start source:PROJECT.md -->

## Project

**motajs-monorepo**

`motajs-monorepo` 是 mota-js（魔塔）游戏引擎的编辑器与宿主工具集合：一个 pnpm workspace，包含 `@motajs/editor`（React 19 的可视化编辑器）、`@motajs/service-worker`（生产宿主与项目编排）以及一组共享库。本期目标是把编辑器最底层、引擎无关的能力下沉为 `@motajs/editor-core`，让编辑器变成 core 的一个默认实现，从而同时服务现有引擎、未来新引擎和第三方定制/插件生态。

**Core Value:** **把编辑器内核与引擎细节彻底解耦**——通过一层引擎无关的 `editor-core` 接口，让新旧引擎共用同一套编辑能力，并让第三方可以高自由度地定制编辑器，而不必反复维护多个版本。

### Constraints

- **Tech stack**: TypeScript 5.9 / React 19 / Vite 7 / pnpm workspace catalog 固定依赖版本 — 不因拆分引入不必要的运行时依赖
- **Compatibility**: `@motajs/editor` 对外功能、UI、宿主协议必须保持现状 — 本期为纯重构，回归风险最小化
- **Architecture**: `editor-core` 不得导入宿主或引擎代码；不得擅自读取文件；引擎相关数据一律经注册钩子注入
- **Workspace**: `editor-core` 位于 `packages/libs/editor-core`，作为共享库被 `editor` 依赖；`@/` 别名与 tsconfig 基础沿用 `@motajs/config`
- **Verification**: 判定「行为完全不变」的依据是现有测试全绿 + 关键流程手动验收

<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- TypeScript 5.9.3 - all workspace packages (`packages/apps/editor/package.json`, `packages/apps/service-worker/package.json`, all `packages/libs/*/package.json`)
- TSX / React JSX - React 19 UI in `packages/apps/editor/src/**` and `packages/apps/service-worker/src/view/**`
- JavaScript (ESM, `.js` / `.mjs` / `.cjs`) - build tooling and Vite plugins (`packages/apps/editor/vite-plugin-mota-server.ts` is TS, but `packages/libs/config/resolvePlugin.js`, `packages/apps/service-worker/scripts/stage-editor.mjs`, `packages/apps/service-worker/scripts/verify-deployment.mjs`, `packages/apps/editor/postcss.config.cjs`)
- Less - service-worker styling (`packages/apps/service-worker/src/view/*.module.less`, `packages/libs/theme/theme.less`)
- CSS - editor theme assets (`packages/apps/editor/assets/theme/editor_color_light.css`)
- Bash - deployment script (`packages/apps/service-worker/scripts/deploy-h5test.sh`)
- Python - legacy packer helper only (`packages/libs/packer/prev/forceRemoteBgm.py`)

## Runtime

- Node.js 24 - CI runtime (`.github/workflows/deploy-editor-h5test.yml`), and Node >=18 required by `packages/libs/packer/package.json` (`engines.node`)
- Browser runtime - both apps are browser-targeted SPAs; service-worker app runs inside a Service Worker global scope (`packages/apps/service-worker/src/server/index.ts`)
- pnpm 11.10.0 (pinned in `.github/workflows/deploy-editor-h5test.yml`); no `packageManager` field in root `package.json`
- Workspace catalogs — dependency versions centralized in `pnpm-workspace.yaml` (`catalog:` references across all manifests)
- Lockfile: present (`pnpm-lock.yaml`)
- `.npmrc`: `ignore-workspace-root-check = true`

## Frameworks

- React 19.2.3 + React DOM 19.2.3 - both apps (catalog `react`/`react-dom`)
- Vite 7.3.1 - build/dev for both apps; root override forces `vite: 7.3.1` (`pnpm-workspace.yaml`)
- PandaCSS 1.8.1 - editor styling system (`packages/apps/editor/panda.config.ts`, `packages/apps/editor/postcss.config.cjs`; `syntax: template-literal`, `outdir: styled-system`)
- Ant Design 6.2.1 + `@ant-design/icons` 6.1.0 - editor component library (`packages/apps/editor/package.json`)
- Semi UI (`@douyinfe/semi-ui` ^2.90.0, icons, illustrations) - service-worker UI (`packages/apps/service-worker/package.json`)
- Blockly 12.3.1 + `@blockly/field-colour`, `@blockly/field-multilineinput` - visual coding in editor (`packages/apps/editor/src/blockly/`)
- Monaco Editor 0.56.0 (catalog) - code editing; wrapped and aliased through `packages/libs/react-monaco-editor`
- PixiJS 8.19.0 - map rendering in editor (`packages/apps/editor/src/MapEditor/`)
- TanStack React Query 5.90.20 + TanStack Store 0.8.0 - editor server/state (`packages/apps/editor/src/queryClient.ts`)
- `react-query` ^3.39.3 (legacy) - service-worker (`packages/apps/service-worker/src/view/App.tsx`, resolved via catalog)
- immer 11.1.3, alien-signals 3.1.2, ts-pattern 5.9.0 - state and control-flow primitives (editor)
- Vitest 4.0.18 (editor) / catalog ^4.0.16 - unit tests in both apps and libs
- Playwright 1.61.1 (`@playwright/test`) - E2E; configs at `packages/apps/editor/playwright.config.ts` and `packages/apps/service-worker/playwright.config.ts`
- @testing-library/react 16.3.2 - component tests in `packages/libs/react-hooks`, `packages/libs/react-store`, editor
- fast-check 4.5.3 / 4.5.2 (catalog) - property-based tests
- jsdom 26.1.0 - DOM environment for lib tests
- ESLint 9.39.2 (flat config) + `typescript-eslint` 8.53.1 + `@stylistic/eslint-plugin` + `eslint-plugin-react-hooks` + `eslint-plugin-react-refresh` + `eslint-plugin-react-hooks-better-stable` (`eslint.config.js`, `packages/apps/editor/eslint.config.js`)
- dprint 0.50.2 - editor formatting, plugins fetched from the network (`packages/apps/editor/dprint.jsonc`)
- `babel-plugin-react-compiler` 1.0.0 - React Compiler via `@vitejs/plugin-react` babel config (`packages/apps/editor/vite.config.ts`)
- `vite-plugin-node-polyfills` - Node globals shims in both app builds
- `vite-plugin-svgr` - SVG-as-component (service-worker)
- `vite-bundle-analyzer` - static analysis report on service-worker build
- `typescript-plugin-css-modules` - typed CSS modules (base tsconfig)

## Key Dependencies

- `@zip.js/zip.js` 2.8.15 - ZIP handling in editor
- `acorn` 8.17.0 + `acorn-walk` 8.3.5 - JS parsing (`packages/libs/file2x`, editor deps)
- `json5` 2.2.3 - mota-js data parsing (`packages/libs/file2x`)
- `dexie` ^4.2.1 - IndexedDB ORM for project registry (`packages/apps/service-worker/src/server/project.ts`)
- `memfs` ^4.51.1 - `FsaNodeFs` bridges File System Access API handles into Node-style FS (`packages/apps/service-worker/src/server/project.ts`)
- `mime` ^4.1.0 - content-type resolution for preview serving (`packages/apps/service-worker/src/server/preview.ts`)
- `universal-router` ^10.0.1 - view routing in service-worker (`packages/apps/service-worker/src/view/routes.ts`)
- `sharp` ^0.34.5 - native image processing (WebP, sprites, tilesets) in `packages/libs/h5animate/lib/webp.ts` and `packages/libs/packer/src/utils/image-utils.ts`
- `terser` ^5.44.1 - JS minification (`packages/libs/packer/src/minifier.ts`)
- `jszip` ^3.10.1 - ZIP archive packing (`packages/libs/packer/src/utils/zip-utils.ts`)
- `iconv-lite` ^0.7.1 - GBK decoding for legacy mota-js assets (`packages/libs/packer/src/utils/zip-utils.ts`)
- `zod` ^4.2.1 - validation in `packages/libs/h5animate`
- `lodash-es` ^4.17.22 - shared utilities (`packages/libs/react-store`, `react-hooks`, `react-monaco-editor`, `react-dark-mode`, service-worker)
- `localforage` 1.10.0 - in-editor runtime third-party asset (bundled into game preview load path)
- `lz-string` 1.5.0 - compression for editor persistence/runtime
- `es-toolkit` (1.44.0 editor / ^1.43.0 catalog) - utility belt in editor, packer, service-worker
- `js-beautify` 1.15.4, `json5`, `awesomplete` 1.1.7, `color-convert` 3.1.3, `lucide-react` 1.24.0 - editor UX
- `@motajs/config` - shared tsconfig bases and `resolvePlugin` (`packages/libs/config/`)
- Workspace libs: `@motajs/utils`, `@motajs/file2x`, `@motajs/packer`, `@motajs/h5animate`, `@motajs/react-store`, `@motajs/react-hooks`, `@motajs/react-monaco-editor`, `@motajs/react-dark-mode`
- `monaco-textmate` ^3.0.1, `monaco-editor-textmate` ^4.0.0, `onigasm` ^2.2.5 - TextMate grammar highlighting (`packages/libs/react-monaco-editor/package.json`)

## Configuration

- Editor host configuration is injected via a JSON script node (`<script id="mota-editor-environment">`) and parsed at runtime — not env vars (`packages/apps/editor/index.html`, `packages/apps/editor/src/environment.ts`)
- Build/dev env vars consumed:
- No `.env` file detected at repo root; secrets are supplied by GitHub Actions environment `h5test`
- Editor: `tsc -b && vite build`; MPA with two entrypoints — `index.html` (editor) and `runtime.html` (runtime bridge) (`packages/apps/editor/vite.config.ts`); `publicDir` = mota-js root; dev server on `127.0.0.1:1055`
- Editor artifact: SHA-256 manifest emitted by `packages/apps/editor/editor-artifact-plugin.ts` (`editor-manifest.json`, schemaVersion 2, 20 MiB raw budget, exactly one Monaco `ts.worker`, no css/html workers)
- Service worker: `vite build` emits `index.html` and `service-worker.js` (`packages/apps/service-worker/vite.config.ts`); custom dev middleware serves the built worker; `build:with-editor` chains editor build + `stage:editor`
- TypeScript project references/roots: `packages/libs/config/tsconfig.app.base.json`, `packages/libs/config/tsconfig.lib.base.json`, `packages/libs/config/tsconfig.vite.json`; per-package `tsconfig.json`/`tsconfig.app.json`/`tsconfig.server.json`/`tsconfig.node.json`
- Path aliases: `@/*` → `src/*` (apps) or `lib/*` (libs); `@test/*`, `@styled-system/*` in editor; workspace-wide `@/` resolution is implemented by `packages/libs/config/resolvePlugin.js`
- Lint/format configs: `eslint.config.js` (root), `packages/apps/editor/eslint.config.js`, `packages/apps/editor/dprint.jsonc`
- `packages/libs/theme/pacakge.json` is misspelled, so `@motajs/theme` is NOT a discoverable workspace package even though it is under `packages/libs/*`
- `packages/libs/packer/prev/package.json` is a legacy Babel-based leftover, not wired into scripts
- `packages/external/mota-js` is a git submodule (`.gitmodules` → `git@github.com:ckcz123/mota-js.git`) and is empty/uninitialized in this checkout; the editor build requires `git submodule update --init packages/external/mota-js`

## Platform Requirements

- Node.js 24 recommended (CI), pnpm 11.x
- Git submodule initialized: `packages/external/mota-js`
- Native/build-tool approvals in `pnpm-workspace.yaml` (`allowBuilds`): `@parcel/watcher`, `dprint`, `esbuild`, `less`, `sharp`
- Dev ports: editor `127.0.0.1:1055`; service-worker preview `127.0.0.1:4178`
- Playwright browsers required for E2E (`playwright install chromium`; Chrome channel preferred on non-CI macOS)
- Static hosting of the service-worker app + editor release artifacts under a scope URL; deployed to `https://mota.press/server/` on an SSH-accessible Linux host (`/var/www/doc/server`)
- Browser must support Service Workers, Cache Storage, IndexedDB, and the File System Access API (`@types/wicg-file-system-access`)

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## Overview

- `packages/libs/*` — reusable libraries (`@motajs/utils`, `@motajs/packer`, `@motajs/h5animate`, `@motajs/react-hooks`, `@motajs/react-store`, `@motajs/file2x`, `@motajs/react-monaco-editor`, `@motajs/react-dark-mode`, `@motajs/config`, `@motajs/theme`)
- `packages/apps/*` — applications (`@motajs/editor`, `@motajs/service-worker`)
- `packages/external/*` — vendored upstream code (`mota-js`, a git submodule)

| Scope | Config file | Quote / style enforcement |
|-------|-------------|---------------------------|
| Root + `packages/libs/*` | `eslint.config.js` | `@stylistic` customize: 2-space indent, **double quotes**, semicolons, 1tbs braces, arrow parens |
| `packages/apps/editor` | `packages/apps/editor/eslint.config.js` | No stylistic plugin; only `prefer-arrow-callback`, `object-shorthand`, `arrow-body-style: as-needed` |

## Naming Patterns

- Classes and React components use **PascalCase**: `packages/apps/editor/src/fs/FileHandler.ts`, `packages/apps/editor/src/components/SchemaTable/CollectionControl.tsx`, `packages/apps/editor/src/MapEditor/MapEditorStore.ts`, `packages/libs/packer/src/logger.ts` (`Logger` class).
- Stores use the `XxxStore.ts` suffix: `packages/apps/editor/src/components/Table/stores/DataStore.ts`, `packages/apps/editor/src/components/Table/stores/FoldStore.ts`, `packages/apps/editor/src/stores/PanelStore.ts`.
- Services use the `xxxService.ts` / `XxxDataHandler.ts` pairing: `packages/apps/editor/src/services/enemy/enemyService.ts`, `packages/apps/editor/src/services/enemy/EnemysDataHandler.ts`.
- Plain modules, utilities, and hooks use **camelCase**: `packages/apps/editor/src/utils/fieldPath.ts`, `packages/libs/utils/lib/common.ts`, `packages/apps/editor/src/hooks/useData.ts`.
- Hooks files/functions are `useXxx`: `packages/apps/editor/src/hooks/useTableMeta.ts`, `packages/libs/react-hooks/lib/core/common.ts` (`useCurrentFn`, `useNode`).
- Directory barrels are always `index.ts`: `packages/libs/utils/lib/index.ts`, `packages/apps/editor/src/project/commands/index.ts`, `packages/apps/editor/src/components/Table/stores/index.ts`.
- CSS files are kebab-case and co-located: `packages/apps/editor/src/components/SchemaTable/schema-table.css`, `packages/apps/editor/src/Workbench/FloorPanel/floor-panel.css`.
- camelCase, verb-first: `parseFieldPath`, `applyActionsWithInverse`, `setByFieldPath`, `createTestFileHandler`.
- Factory functions are `createXxx`: `packages/libs/packer/src/errors.ts` (`createZipNotFoundError`), `packages/apps/editor/src/project/commands/types.ts` (`commandOk`, `commandError`).
- Predicates are `isXxx` / `hasXxx`: `packages/libs/utils/lib/type.ts` (`isNonNullable`), `packages/apps/editor/src/components/Table/utils/validation.ts` (`checkRange`).
- Module-level constants use `UPPER_SNAKE_CASE`: `packages/apps/editor/src/project/commands/mapMatrix.ts`, `packages/apps/editor/test/arbitraries.ts` (`JS_RESERVED_WORDS`, `UNSAFE_OBJECT_KEYS`), `packages/apps/editor/e2e/utils/projectSandbox.ts` (`PROJECT_ROOT`, `FILE_ENDPOINTS`).
- Local variables camelCase, `snake_case` for raw game-data fields (from `mota-js`): `floorId`, `mapId`, `enemy-items`.
- Type aliases and interfaces use **PascalCase**. Handler contracts use an `I` prefix: `packages/apps/editor/src/fs/interfaces.ts` (`IContentView<T>`, `IContentHandler<T>`, `IDataHandler<T>`). Ordinary data shapes do not: `EditorNotification` in `packages/apps/editor/src/utils/notify.ts`, `Fs`/`FsPromiseApi` in `packages/apps/editor/src/services/fs/fs.ts`, `FieldConfig` in `packages/apps/editor/src/components/Table/types.ts`.
- Generic parameters are single uppercase letters (`T`, `R`, `C`, `A`, `M`): `packages/libs/utils/lib/exception.ts`, `packages/libs/utils/lib/common.ts`.
- Discriminated unions model results: `packages/apps/editor/src/project/commands/types.ts` defines
- `satisfies` is preferred over casting when validating object literals against a union (e.g. `satisfies RuntimeMessage` throughout `packages/apps/editor/src/runtime/`).
- Enums are UPPER_SNAKE members on a PascalCase enum, used only where `erasableSyntaxOnly` is not enabled: `H5AnimateErrorCode` in `packages/libs/h5animate/lib/errors.ts`, `ErrorCode` in `packages/libs/packer/src/errors.ts`.
- **Do not add `enum` to `packages/apps/editor`** — `packages/apps/editor/tsconfig.app.json` sets `"erasableSyntaxOnly": true`. Use `as const` object maps or union types instead.

## Code Style

- Root ESLint `@stylistic` config (`eslint.config.js`) enforces: 2-space indent, double quotes, semicolons, trailing commas (multiline), `braceStyle: "1tbs"`, arrow parens always, `multiline-ternary: always-multiline` (JSX ignored), `jsx-one-expression-per-line` with `allow: single-line`.
- `packages/apps/editor/dprint.jsonc` runs dprint with default options for `typescript`/`json` (excludes `**/node_modules`, `public/**`, `**/*-lock.json`).
- Observed inconsistency: files under `packages/apps/editor/src/utils/fieldPath.ts` and `packages/apps/editor/src/utils/action.ts` use **single quotes**, while the rest of the editor and all libs use **double quotes**. Match the surrounding file when editing; do not reformat unrelated files.
- Explicit `.js` import extensions in `@motajs/h5animate` (`packages/libs/h5animate/lib/validation.ts` imports `"./errors.js"`). All other packages use extensionless relative imports.
- Root `eslint.config.js` rules of note: `@typescript-eslint/no-unused-vars: warn`, `no-explicit-any: warn`, `ban-ts-comment: warn`, `no-empty-object-type: warn`, `no-constant-condition` with `checkLoops: "none"`.
- React hooks are enforced: `react-hooks/rules-of-hooks: error`; `react-refresh/only-export-components: warn` (allowConstantExport); `react-hooks-better-stable/exhaustive-deps: warn` with custom `stableHooks` (`useStatic`, `useRefFrom`, `useCurrentFn`, `useForceUpdate`, `useStorageItem`).
- Editor overrides in `packages/apps/editor/eslint.config.js`: `prefer-arrow-callback: warn`, `object-shorthand: warn`, `arrow-body-style: ["warn", "as-needed"]`.
- File-level opt-out is used sparingly, e.g. `/* eslint-disable @typescript-eslint/no-explicit-any */` at the top of `packages/apps/editor/src/fs/__tests__/FileHandlerManager.test.ts`.
- `strict: true` in all bases (`packages/libs/config/tsconfig.lib.base.json`, `tsconfig.app.base.json`, `tsconfig.vite.json`).
- `moduleResolution: "bundler"`, `allowImportingTsExtensions: true`, `isolatedModules`, `moduleDetection: "force"`, `noEmit`, `target: ESNext`.
- Editor app adds `verbatimModuleSyntax: true` → **always** use `import type { X }` for type-only imports.
- Editor app adds `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `noUncheckedSideEffectImports`.
- Test files are excluded from the editor's source tsconfig (`packages/apps/editor/tsconfig.app.json` excludes `src/**/*.test.ts(x)`, `src/**/__tests__/**`, `test`).

## Import Organization

- `@/*` → `src/*` (apps) or `lib/*` (libs), declared in `packages/libs/config/tsconfig.app.base.json` / `tsconfig.lib.base.json` and the package's own tsconfig.
- `@test/*` → `test/*` (`packages/apps/editor/tsconfig.app.json`, `packages/apps/editor/vite.config.ts`)
- `@styled-system/*` → `styled-system/*` (Panda CSS output, editor only)
- Vite resolves the same aliases in `packages/apps/editor/vite.config.ts` and `packages/apps/service-worker/vitest.config.ts` (`"@"`).

## Error Handling

- Commands return a discriminated `CommandResult` (`packages/apps/editor/src/project/commands/types.ts`) built by `commandOk()` / `commandError(stage, error)`.
- `notifyCommandResult(result, successMessage)` in `packages/apps/editor/src/utils/notify.ts` turns results into user notifications and a boolean.
- `H5AnimateError` carries `code`, `position`, `expectedType`, `actualType`, `missingFields`, `fieldPath` and has `getFullDescription()` / `toJSON()` — `packages/libs/h5animate/lib/errors.ts`.
- `MotaBuilderError` carries `code` + `details` and calls `Error.captureStackTrace` — `packages/libs/packer/src/errors.ts`.
- Errors are constructed through named factories (`createInvalidSignatureError`, `createZipNotFoundError`), not `new Error(...)` scattered inline.

## Logging

- Editor uses a notification bus (`subscribeNotifications`, `notifySuccess`, `notifyError`, `notifyInfo`) that falls back to `console.error`/`console.info` when no listener — `packages/apps/editor/src/utils/notify.ts`. Prefer `notifyError(error)` over raw `console.error` in app code.
- `@motajs/packer` has a `Logger` class with an injectable `LogOutput` (`packages/libs/packer/src/logger.ts`) using `group`/`groupEnd` indentation; construct with a custom sink for tests rather than spying on `console`.
- `@motajs/service-worker` writes via `console.warn` in failure paths (spied on in tests, e.g. `packages/apps/service-worker/src/server/editorRelease.test.ts`).

## Comments

- File-level block comment explaining module purpose, written in **Chinese**, on nearly every non-trivial module:
- Section dividers use `// ==================== 类型定义 ====================` (`packages/apps/editor/src/services/fs/fs.ts`, `packages/apps/editor/src/fs/__tests__/FileHandlerManager.test.ts`).
- Inline comments explain non-obvious data formats (binary offsets, whitespace semantics): `packages/libs/h5animate/lib/__tests__/binary.test.ts`.
- Exported functions get JSDoc with `@param` and `@example`: `applyAction`/`applyActionsWithInverse` in `packages/apps/editor/src/utils/action.ts`, `parseFieldPath` in `packages/apps/editor/src/utils/fieldPath.ts`.
- Property-level JSDoc is used on interface fields: `packages/apps/editor/src/fs/interfaces.ts`.
- Property tests carry a property tag in the header:

## Function Design

- Exported functions declare explicit return types (`: void`, `: string[]`, `Promise<void>`).
- Pure helpers return values/fresh objects rather than mutating where practical; mutation helpers are explicit in name — `setByFieldPath`, `deleteByFieldPath`, `applyAction` mutate their `target` argument.

## Module Design

- Named exports only; no default exports for utilities (default exports appear only on config files like `vite.config.ts`).
- Type-only re-exports use `export type { X }` / `export type * from "./types"` (`packages/apps/editor/src/project/commands/index.ts`, `packages/libs/file2x/lib/index.ts`).
- Barrel `index.ts` files re-export the public surface per package: `packages/libs/utils/lib/index.ts`, `packages/libs/packer/src/index.ts`.
- Libs expose entry points through `package.json` (`"exports": { ".": "./lib/index.ts" }` in `packages/libs/utils/package.json`, `packages/libs/react-hooks/package.json`).
- Editor barrels selectively re-export and rename types (`export { tableCommands }` and `export { floorCommands, type BatchCreateFloorOptions, ... }` in `packages/apps/editor/src/project/commands/index.ts`).
- Editor state is centralized in stores under `packages/apps/editor/src/stores/` and feature-local `stores/` folders; zustand-style `XxxStore` objects (`packages/apps/editor/src/stores/EditorStore.ts`).
- React context providers live next to their feature: `packages/apps/editor/src/Workbench/EventsEditor/EventEditorContext.tsx`, `packages/apps/editor/src/runtime/RuntimeContext.tsx`.

## React Conventions

- Function components with explicit return types are common; props are inline interfaces or imported types.
- Hooks follow the Rules of Hooks strictly (`react-hooks/rules-of-hooks: error`) and rely on `eslint-plugin-react-hooks-better-stable` to treat the project's custom hooks as stable.
- React Compiler is enabled in the editor build via `babel-plugin-react-compiler` (`packages/apps/editor/vite.config.ts`) — avoid manual memoization that assumes compiler is off, and keep render logic pure.
- Error boundaries: `packages/apps/editor/src/components/AppErrorBoundary.tsx`, `packages/apps/editor/src/MapEditor/MapEditorErrorBoundary.tsx`, `packages/apps/editor/src/Workbench/components/PanelErrorBoundary.tsx`.
- Test selectors use `data-test-id` (Playwright `testIdAttribute` in `packages/apps/editor/playwright.config.ts`), retrieved with `getByTestId`.

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## System Overview

```text

```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Editor bootstrap | Parse host environment config, mount React root, render startup-error fallback | `packages/apps/editor/src/main.tsx` |
| Environment protocol | Validate/parse `#mota-editor-environment` JSON and resolve endpoint URLs | `packages/apps/editor/src/environment.ts` |
| App composition | Wire providers (antd, Runtime, CodeEditor, EventEditor, Modals, ErrorBoundary) | `packages/apps/editor/src/App.tsx` |
| Workbench shell | Compose top bar, map panels, workspaces, event/code editors | `packages/apps/editor/src/Workbench/index.tsx` |
| FS resource layer | `Content<T>` state, file/data handlers, async persistence | `packages/apps/editor/src/fs/*` |
| Default FS transport | HTTP form POST client for read/write/list/mkdir/move/delete | `packages/apps/editor/src/services/fs/fs.ts` |
| Project data registry | Register tower/items/enemys/maps/icons/functions/plugins/events/floors | `packages/apps/editor/src/project/data/projectData.ts` |
| DataResource abstraction | Wrap handlers as `raw`/`set`/`mutate`/`patch` resources | `packages/apps/editor/src/project/data/DataResource.ts` |
| Derived resource combinators | `computedResource`, `aggregateResource`, `optional` | `packages/apps/editor/src/project/resources.ts` |
| Project model | Derive read-only semantics (block registry, tileset catalog, passability, diagnostics) | `packages/apps/editor/src/project/model/*` |
| Commands | Express all edit intents and return `CommandResult` | `packages/apps/editor/src/project/commands/*` |
| Operation history | Undo/redo with checkpoints, inverse operations, capacity 100 | `packages/apps/editor/src/project/history/*` |
| Map editor | Pixi-based floor/loc/layer painting UI | `packages/apps/editor/src/MapEditor/index.tsx` |
| Blockly editor | Declarative schema + bidirectional codec for event scripts | `packages/apps/editor/src/blockly/*` |
| Runtime capability | iframe bridge, handshake, resource gateway, UI/status-bar preview | `packages/apps/editor/src/runtime/*` |
| Artifact plugin | Emit `editor-manifest.json` schema v2 with SHA-256 per file | `packages/apps/editor/editor-artifact-plugin.ts` |
| Dev host server | Local FS API, `/game.html`, batch floors/animates, hot reload, replay | `packages/apps/editor/vite-plugin-mota-server.ts` |
| SW request router | Route `service/:id/*`, `tower/:id/*`, `static/editor/*` | `packages/apps/service-worker/src/server/router.ts` |
| SW message server | `project.register/forget/list/get/activate`, `editor.status` | `packages/apps/service-worker/src/server/index.ts` |
| SW FS API | Path-safe read/write/list/mkdir/move/delete over project FS | `packages/apps/service-worker/src/server/fsApi.ts` |
| SW preview server | Serve project resources with MIME/range, transpile TS | `packages/apps/service-worker/src/server/preview.ts` |
| Editor release manager | Cache releases, verify manifest/SHA-256, update check/activate | `packages/apps/service-worker/src/server/editorRelease.ts` |
| Editor shell injection | Inject endpoint JSON + `<base>` into editor artifact HTML | `packages/apps/service-worker/src/server/editorHost.ts` |
| Project registry | Dexie-backed project records + FSA handles -> memfs `FsaNodeFs` | `packages/apps/service-worker/src/server/project.ts` |
| SW management view | React SPA to register/list/activate projects | `packages/apps/service-worker/src/view/*` |
| Shared utilities | async/common/geometry/exception helpers + `advance/message` RPC | `packages/libs/utils/lib/*` |
| x-data codec | Decode/encode `var <uuid> = {json}` mota-js data files | `packages/libs/file2x/lib/*` |
| Store library | React store with `mergeStores` composition | `packages/libs/react-store/lib/*` |
| Monaco wrapper | Monaco editor component, model scope, language library scope | `packages/libs/react-monaco-editor/lib/*` |
| React hooks | browser/core/utils hooks incl. service-worker registration hooks | `packages/libs/react-hooks/lib/*` |
| h5animate codec | Decode/encode h5animate binary format, legacy conversion | `packages/libs/h5animate/lib/*` |
| Packer CLI | Compress/optimize mota-js projects (Node, sharp/terser/jszip) | `packages/libs/packer/src/*` |
| Shared TS config | Base `tsconfig` files + `@/` resolve plugin | `packages/libs/config/*` |

## Pattern Overview

```text

```

- **Host-agnostic editor:** the editor only knows endpoint URLs; it never references host types or project IDs (`packages/apps/editor/src/environment.ts`).
- **Memory-first reactive resources:** all project content is exposed as `ReadonlySignal<Content<T>>`; disk writes are asynchronous and fire-and-forget (`packages/apps/editor/src/fs/FileHandler.ts`, `packages/apps/editor/src/fs/PersistExecutor.ts`).
- **Declarative derivation:** model values are derived with `computedResource`/`aggregateResource` from raw data, so writes to raw data automatically propagate (`packages/apps/editor/src/project/resources.ts:122-155`).
- **Command + history discipline:** edits flow through `EditorOperation` and `operationHistory.execute()` to gain undo/redo and inverse operations (`packages/apps/editor/src/project/history/operations.ts`, `packages/apps/editor/src/project/history/operationHistory.ts`).
- **Optional runtime:** a broken runtime iframe degrades to a fallback UI but never blocks the core workbench (`packages/apps/editor/src/runtime/RuntimeProvider.tsx`).
- **Workspace path aliasing:** every package resolves `@/` to its own source dir via `packages/libs/config/resolvePlugin.js` + `packages/libs/config/tsconfig.*.base.json`.
- **Catalog-pinned dependencies:** all shared dependency versions live in the `catalog:` block of `pnpm-workspace.yaml`.

## Layers

- Purpose: Resolve host config and mount the app before any project access.
- Location: `packages/apps/editor/src/main.tsx`, `packages/apps/editor/src/App.tsx`, `packages/apps/editor/src/environment.ts`
- Contains: environment parsing/validation, provider composition, theme CSS switching.
- Depends on: React 19, `@tanstack/react-query`, `antd`, editor stores.
- Used by: browser via `packages/apps/editor/index.html`.
- Purpose: Turn files into subscribable, recoverable, persistable resources.
- Location: `packages/apps/editor/src/fs/*`, `packages/apps/editor/src/services/fs/*`
- Contains: `Content<T>` state, `FileHandler`, `DataHandler`, `BinaryFileHandler`, `FileHandlerManager`, `PersistExecutor`, `PersistenceMonitor`, `Fs` transport.
- Depends on: `alien-signals`, `@motajs/file2x`.
- Used by: project data/assets and model layers.
- Purpose: Register specific mota-js project files as semantic resources.
- Location: `packages/apps/editor/src/project/data/*`, `packages/apps/editor/src/project/assets/*`
- Contains: `ProjectDataImpl` (`projectData.ts`), `DataResource`, image/animation/material asset resources, `RasterCodec`.
- Depends on: FS layer, per-domain handlers under `packages/apps/editor/src/services/*`.
- Used by: model and command layers.
- Purpose: Derive read-only editor semantics and diagnostics from raw data.
- Location: `packages/apps/editor/src/project/model/*`
- Contains: `projectModel.ts`, `blockRegistry`, `tilesetCatalog`, `passability`, `prefabModel`, `locModel`, `floorOrganization`, `*Diagnostics`, `statusBarModel`, `blocklyModels`.
- Depends on: resource combinators and project data.
- Used by: commands and UI.
- Purpose: Single write path for all edits plus undo/redo.
- Location: `packages/apps/editor/src/project/commands/*`, `packages/apps/editor/src/project/history/*`
- Contains: `mapCommands`, `floorCommands`, `tableCommands`, `locCommands`, `prefabCommands`, `materialCommands`, `animationCommands`, `operationHistory`, `compositeOperation`, `patchResourceOperation`.
- Depends on: resources, helpers (`src/utils/action.ts`).
- Used by: UI panels and map editor.
- Purpose: Render and bind user interaction, never touching file handlers directly.
- Location: `packages/apps/editor/src/Workbench/*`, `packages/apps/editor/src/MapEditor/*`, `packages/apps/editor/src/components/*`, `packages/apps/editor/src/blockly/*`, `packages/apps/editor/src/hooks/*`
- Contains: panels, workspaces, modals, schema-driven tables, Blockly editor, Monaco code editor, suspense hooks.
- Depends on: stores, commands, model.
- Used by: end users.
- Purpose: Execute the real mota-js engine in an isolated iframe and expose preview/language snapshot.
- Location: `packages/apps/editor/src/runtime/*`
- Contains: `RuntimeProvider.tsx`, `RuntimeContext.tsx`, `iframeEntry.ts`, `RuntimeResourceGateway.ts`, `protocol.ts`, `RuntimeSurface.tsx`.
- Depends on: `MessageChannel`, project resources.
- Used by: UI preview surfaces.
- Purpose: Provide project files, preview entry, docs, and editor releases to the editor.
- Location: `packages/apps/editor/vite-plugin-mota-server.ts` (dev), `packages/apps/service-worker/src/server/*` (prod), `packages/apps/service-worker/src/view/*` (management UI).
- Contains: FS API server, preview/static server, release staging/cache, project registry, message IDL.
- Depends on: Node fs (dev), `memfs` + File System Access API + `dexie` (prod).
- Purpose: Cross-app primitives consumed via workspace protocol.
- Location: `packages/libs/*`
- Contains: utils, file2x, react-store, react-hooks, react-monaco-editor, react-dark-mode, h5animate, packer, config, theme.

## Data Flow

### Primary Request Path — Editor Startup

### Primary Request Path — Read/Write a Project File

### Edit + Undo/Redo Flow

### Runtime Preview Flow

- Global app state via `@motajs/react-store` `mergeStores([EditorStore, PanelStore])` (`packages/apps/editor/src/stores/index.ts:5-8`).
- Domain state stores: `MapEditorStore` (`packages/apps/editor/src/MapEditor/MapEditorStore.ts`), plus standalone signals `prefabState`, `locState`, `editorState`, `appendPicState`.
- Server-ish async state via `@tanstack/react-query` (`packages/apps/editor/src/queryClient.ts`) in the editor and `react-query` v3 in the SW management view.
- Reactive content signals via `alien-signals` (`packages/apps/editor/src/fs/types.ts`).

## Key Abstractions

- Purpose: Uniform five-state tagged union for any async resource (`idle | loading | loaded | not-found | error`).
- Examples: `packages/apps/editor/src/fs/types.ts`, consumed by `ContentBoundary` and `useModelResourceSuspense`.
- Pattern: Tagged union + utility combinators in `ContentUtils`.
- Purpose: Highest-value extension point; swap disk for IndexedDB/Zip/cloud/Service Worker.
- Examples: `packages/apps/editor/src/services/fs/fs.ts`, injected into `FileHandler`, `BinaryFileHandler`, `ProjectAssets`.
- Pattern: Adapter interface with callback and promise styles.
- Purpose: Parse/stringify a specific on-disk data format into semantic types.
- Examples: `JsonDataHandler`, `Json2xDataHandler`, `TowerDataHandler`, `FloorDataHandler`.
- Pattern: Template method; subclass supplies `parse`/`stringify`.
- Purpose: Semantic project-data resource with `raw`, `set`, `mutate` (Immer), `patch` (action list), `persistStatus`.
- Examples: `HandlerDataResource`, `MappedDataResource` (e.g. `events.commonEvent` with prefix `['commonEvent']`).
- Pattern: Decorator/wrapper over handlers.
- Purpose: Read-only derived semantics shared by panels and completions.
- Examples: `packages/apps/editor/src/project/model/projectModel.ts`, `blocklyModels.ts`, `tilesetCatalog.ts`.
- Pattern: Lazy resource factory returning memoized derived resources.
- Purpose: Atomic, invertible edits with multi-target checkpoints.
- Examples: `packages/apps/editor/src/project/history/operations.ts:21-165`, `commandOperations.ts`.
- Pattern: Command pattern with `inverse` and composite helpers.
- Environment Protocol v1 (`packages/apps/editor/src/environment.ts`).
- Runtime Protocol v4 (`packages/apps/editor/src/runtime/protocol.ts:4`).
- Editor Update Protocol v2 (`packages/apps/service-worker/src/view/editorUpdate.ts`, `packages/apps/service-worker/src/idl/index.ts:75-90`).
- Editor Artifact Manifest schema v2 (`packages/apps/editor/editor-artifact-plugin.ts:22-30`).

## Entry Points

- Location: `packages/apps/editor/index.html` -> `packages/apps/editor/src/main.tsx`
- Triggers: Browser navigation to the editor artifact (served by host).
- Responsibilities: Parse environment, mount `App`, render providers and `Workbench`.
- Location: `packages/apps/editor/runtime.html` -> `packages/apps/editor/src/runtime/iframeEntry.ts`
- Triggers: iframe load from `RuntimeProvider`.
- Responsibilities: Handshake with parent, load engine from `previewUrl`, serve resources, run UI/status-bar preview.
- Location: `packages/apps/service-worker/src/server/index.ts` (built to `service-worker.js`)
- Triggers: SW `install`, `activate`, `message`, `fetch` events.
- Responsibilities: Route requests, serve FS API/preview/editor shell/release assets, host project registry messages.
- Location: `packages/apps/service-worker/index.html` -> `packages/apps/service-worker/src/view/main.tsx`
- Triggers: Browser navigation to the app root.
- Responsibilities: Register/list/activate projects; registration via `useServiceWorker` (`packages/libs/react-hooks/lib/browser/serviceWorker.ts`).
- Location: `packages/apps/editor/vite-plugin-mota-server.ts` (registered in `packages/apps/editor/vite.config.ts:25`)
- Triggers: `pnpm --filter @motajs/editor dev`.
- Responsibilities: Serve project files, `/game.html`, docs, batch floors/animates, hot reload, replay endpoints.

## Architectural Constraints

- **Threading:** Browser single-threaded event loop. `@motajs/packer` is a separate Node CLI (uses `sharp`, `terser`, `jszip`). Service worker handles fetches off the UI thread.
- **Global state:** Module-level singletons include `projectData` (`packages/apps/editor/src/project/data/projectData.ts:330`), `projectModel`, `operationHistory`, `FileHandlerManager`, `persistenceMonitor`, `editorConfigService`, and the SW's `db`/`activeProjectMap` (`packages/apps/service-worker/src/server/project.ts:15-31`).
- **Host boundary:** The editor must not import host code; communication is exclusively via environment JSON, HTTP fs endpoints, and `MessageChannel`.
- **Artifact shape:** The editor build is an MPA with exactly two inputs (`editor`, `runtime`) and must not contain a `<base>` element; hosts inject `<base>` (`packages/apps/editor/vite.config.ts:43-48`, `packages/apps/service-worker/src/server/editorHost.ts:56`).
- **Environment node:** Exactly one `#mota-editor-environment` node must exist; the SW host renders the shell by rewriting it (`packages/apps/editor/src/environment.ts:43-46`, `packages/apps/service-worker/src/server/editorHost.ts:9,54-55`).
- **Path safety:** The editor only concatenates relative paths; escaping prevention lives in the host (`packages/apps/service-worker/src/server/fsApi.ts:12-25`).
- **Aliasing:** `@/` resolves to `lib/` for libs and `src/` for apps; the mapping is implemented in `packages/libs/config/resolvePlugin.js` and mirrors tsconfig `paths`.
- **Dependency versions:** Pinned in the `catalog:` block of `pnpm-workspace.yaml`; Vite is overridden to `7.3.1`.

## Anti-Patterns

### Importing host or engine code into the editor

### Writing project data outside the command/history path

### Protocol version drift between manifest and runtime

### Assuming durable persistence after edit

## Error Handling

- Startup environment errors replace the app with a message node (`packages/apps/editor/src/main.tsx:24-26`).
- `Content<T>` maps missing files to `not-found` versus `error` via `isFileNotFoundError` (`packages/apps/editor/src/fs/errors.ts:10-18`).
- `ContentBoundary` suspends/render-fallbacks per content subtree (`packages/apps/editor/src/components/ContentBoundary/index.tsx`).
- `AppErrorBoundary`, `PanelErrorBoundary`, `MapEditorErrorBoundary` isolate UI crashes per region.
- Runtime fatal: one automatic retry, then `error` state with manual retry (`packages/apps/editor/src/runtime/RuntimeProvider.tsx:106-117,256-259`).
- Persistence: failures recorded as `failedIntent`, retry via `retryFailed`; no rollback (`packages/apps/editor/src/fs/PersistExecutor.ts`).
- Host HTTP errors: SW uses typed `HttpError`/`errorResponse`/`ResponseUtils` (`packages/apps/service-worker/src/server/utils.ts`); dev server uses `error:` prefix (`packages/apps/editor/vite-plugin-mota-server.ts:226,259`).
- Editor release resolution failures redirect to the project page with `reason`/`detail` query params (`packages/apps/service-worker/src/server/editorHost.ts:130-135`).

## Cross-Cutting Concerns

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->

<!-- ===== Project Rules (user-mandated; NOT GSD-managed — safe from generate-claude-md) ===== -->

## Project Rules

### Per-plan briefing before execution (MANDATORY)

Before executing **any** plan — via `/gsd-execute-phase`, `/gsd-executor`, `/gsd-quick`, or an `--auto` / chained pipeline — the orchestrator MUST stop and report to the user first:

1. **Plan id + goal** — which plan, and its objective in one line.
2. **大致内容和需要解决的问题** — the main tasks/files it will change, and what problem it solves (plus any open question, risk, or decision the plan expects).
3. **Verification** — how completion will be checked.

Then **wait for explicit user approval** before running that plan. Brief **per plan, in execution order** — do not batch briefings, and do not treat `--auto` as approval for plan execution.

Scope: this rule governs **plan execution** only. Discussion, planning, and research artifacts may still be produced automatically.

