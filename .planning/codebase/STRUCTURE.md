# Codebase Structure

**Analysis Date:** 2026-09-20

## Directory Layout

```text
motajs-monorepo/
├── .github/
│   └── workflows/                 # CI: manual editor deploy to h5test
├── packages/
│   ├── apps/                      # Deployable applications
│   │   ├── editor/                # @motajs/editor — React 19 + Vite editor SPA
│   │   └── service-worker/        # @motajs/service-worker — prod host + project manager
│   ├── external/
│   │   └── mota-js/               # git submodule: mota-js engine + sample project
│   └── libs/                      # Reusable workspace libraries
│       ├── config/                # @motajs/config — shared tsconfig + resolve plugin
│       ├── file2x/                # @motajs/file2x — `var <uuid> = {json}` codec
│       ├── h5animate/             # @motajs/h5animate — animation binary codec
│       ├── packer/                # @motajs/packer — Node project packer/optimizer
│       ├── react-dark-mode/       # @motajs/react-dark-mode — dark mode store + effects
│       ├── react-hooks/           # @motajs/react-hooks — browser/core/utils hooks
│       ├── react-monaco-editor/   # @motajs/react-monaco-editor — Monaco wrapper
│       ├── react-store/           # @motajs/react-store — store + mergeStores
│       ├── theme/                 # @motajs/theme — shared LESS theme variables
│       └── utils/                 # @motajs/utils — async/geometry/exception/message
├── eslint.config.js               # Root flat ESLint config (all packages)
├── package.json                   # Root private package; only `lint` script
├── pnpm-lock.yaml                 # pnpm lockfile
├── pnpm-workspace.yaml            # Workspace globs + dependency catalog
└── README.md                      # Minimal dev guide scaffold
```

## Directory Purposes

**`packages/apps/`** (`pnpm-workspace.yaml:2`):
- Purpose: Deployable browser applications.
- Contains: `editor` (the product) and `service-worker` (the production host).
- Key files: `packages/apps/editor/package.json`, `packages/apps/service-worker/package.json`.

**`packages/apps/editor/` — `@motajs/editor`:**
- Purpose: Host-agnostic mota-js project editor; ships as a static MPA artifact.
- Contains: React source, Pixi/Blockly/Monaco integration, artifact tooling, dev host, tests.
- Key files: `packages/apps/editor/index.html`, `packages/apps/editor/runtime.html`, `packages/apps/editor/vite.config.ts`, `packages/apps/editor/editor-artifact-plugin.ts`, `packages/apps/editor/vite-plugin-mota-server.ts`, `packages/apps/editor/mota-root.ts`.

**`packages/apps/editor/src/` subdirectories:**
| Directory | Purpose |
| --- | --- |
| `src/assets/` | Editor-local static assets |
| `src/blockly/` | Blockly V12 editor: blocks, schemas, registry, parser, codec, diagnostics |
| `src/components/` | Reusable UI: `ContentBoundary`, `SchemaTable`, `Table`, `GridCanvas` |
| `src/css/` | Global editor styles (`index.css`, `editor.css`) |
| `src/fs/` | FS resource layer: content state, handlers, persistence |
| `src/hooks/` | App-level hooks incl. suspense helpers |
| `src/MapEditor/` | Pixi-based map editing UI, rendering, material panel |
| `src/project/` | Data, assets, model, commands, history, migrations, settings, tableMeta |
| `src/runtime/` | iframe runtime bridge and protocol |
| `src/services/` | Per-domain handlers + default FS transport + editor config |
| `src/stores/` | Global/domain React stores |
| `src/types/` | Shared editor types |
| `src/utils/` | Generic helpers (action, canvas, coordinate, dom, notify) |
| `src/Workbench/` | Shell, panels, workspaces, modals, code/event editors |

**`packages/apps/service-worker/` — `@motajs/service-worker`:**
- Purpose: Serve editor artifacts and project files in production via a Service Worker plus a React management view.
- Contains: request routing, FS API, preview server, editor release/cache manager, project registry, message IDL.
- Key files: `packages/apps/service-worker/src/server/index.ts`, `packages/apps/service-worker/src/server/router.ts`, `packages/apps/service-worker/src/view/main.tsx`, `packages/apps/service-worker/vite.config.ts`.

**`packages/apps/service-worker/src/` subdirectories:**
| Directory | Purpose |
| --- | --- |
| `src/idl/` | Typed message contracts (`MessageType` definitions) |
| `src/server/` | Service worker runtime: routing, fsApi, preview, editorHost, editorRelease, project, cache, transpiler |
| `src/view/` | React SPA for project registration/management and editor update status |

**`packages/libs/`** (`pnpm-workspace.yaml:1`):
- Purpose: Reusable libraries consumed via `workspace:*`.
- Contains: config, file2x, h5animate, packer, react-dark-mode, react-hooks, react-monaco-editor, react-store, theme, utils.
- Key files: `packages/libs/config/resolvePlugin.js`, `packages/libs/utils/lib/index.ts`, `packages/libs/file2x/lib/index.ts`, `packages/libs/h5animate/lib/index.ts`, `packages/libs/packer/src/index.ts`.

**`packages/external/mota-js/`:**
- Purpose: Upstream mota-js engine and sample project, pinned as a git submodule (`.gitmodules`).
- Contains: game engine, `project/*.js` sample data, `_server/` compatibility schema.
- Key files: expected `index.html`, `main.js`, `project/data.js`, `_server/table/data.comment.js` (validated by `packages/apps/editor/mota-root.ts:11-23`).

## Key File Locations

**Entry Points:**
- `packages/apps/editor/index.html`: Editor HTML shell containing `#mota-editor-environment`; loads `src/main.tsx`.
- `packages/apps/editor/runtime.html`: Runtime iframe HTML; loads `src/runtime/iframeEntry.ts`.
- `packages/apps/editor/src/main.tsx`: Editor React root + environment init.
- `packages/apps/editor/src/App.tsx`: Provider composition root.
- `packages/apps/editor/src/Workbench/index.tsx`: Workbench shell composition.
- `packages/apps/service-worker/src/server/index.ts`: Service worker event entry (built to `service-worker.js`).
- `packages/apps/service-worker/index.html` -> `packages/apps/service-worker/src/view/main.tsx`: Management SPA.

**Configuration:**
- `pnpm-workspace.yaml`: Workspace globs, dependency catalog, Vite override.
- `packages/apps/editor/vite.config.ts`: Editor build (MPA inputs, aliases, test config).
- `packages/apps/service-worker/vite.config.ts`: SW build + management view; SW dev middleware.
- `packages/apps/editor/panda.config.ts`: PandaCSS output to `styled-system/`.
- `packages/libs/config/tsconfig.lib.base.json`, `packages/libs/config/tsconfig.app.base.json`: Shared TS bases.
- `packages/libs/config/resolvePlugin.js`: `@/` alias resolution for Vite.
- `packages/apps/editor/tsconfig.app.json`: Editor path aliases `@/*`, `@test/*`, `@styled-system/*`.
- `eslint.config.js`: Root flat ESLint config for all packages.

**Core Logic:**
- `packages/apps/editor/src/environment.ts`: Host environment protocol.
- `packages/apps/editor/src/services/fs/fs.ts`: Default `Fs` HTTP transport.
- `packages/apps/editor/src/fs/FileHandler.ts`, `DataHandler.ts`, `FileHandlerManager.ts`: Resource handlers.
- `packages/apps/editor/src/fs/PersistExecutor.ts`, `PersistenceMonitor.ts`: Async persistence.
- `packages/apps/editor/src/project/data/projectData.ts`: Project data registry and preload.
- `packages/apps/editor/src/project/data/DataResource.ts`: `DataResource` implementations.
- `packages/apps/editor/src/project/resources.ts`: Derived resource combinators.
- `packages/apps/editor/src/project/model/projectModel.ts`: Derived model entry.
- `packages/apps/editor/src/project/history/operationHistory.ts`: Undo/redo engine.
- `packages/apps/editor/src/runtime/RuntimeProvider.tsx`, `iframeEntry.ts`: Runtime bridge.
- `packages/apps/service-worker/src/server/router.ts`: Request routing table.
- `packages/apps/service-worker/src/server/fsApi.ts`: Path-normalized file API.
- `packages/apps/service-worker/src/server/editorHost.ts`: Environment injection into artifact.
- `packages/apps/service-worker/src/server/editorRelease.ts`: Release cache + update check.

**Testing:**
- `packages/apps/editor/test/setup.ts`: Vitest setup (referenced by `vite.config.ts:55`).
- `packages/apps/editor/playwright.config.ts`, `packages/apps/editor/e2e/`: Editor e2e tests.
- `packages/apps/service-worker/playwright.config.ts`, `packages/apps/service-worker/e2e/`: SW hots tests.
- `packages/libs/*/vitest.config.ts`: Per-library test configs.
- Co-located unit tests: `src/**/__tests__/*.test.ts(x)` and `src/**/*.test.ts(x)`.
- `packages/apps/editor/test/blockly/`, `test/mapEditor/`, `test/utils/`: Shared editor test fixtures/helpers.

## Naming Conventions

**Files:**
- PascalCase for modules exporting a class/component/default: `packages/apps/editor/src/fs/FileHandler.ts`, `packages/apps/editor/src/stores/PanelStore.ts`, `packages/apps/editor/src/components/ContentBoundary/index.tsx`.
- camelCase for modules exporting instances/functions: `packages/apps/editor/src/project/data/projectData.ts`, `packages/apps/editor/src/project/history/operationHistory.ts`, `packages/apps/editor/src/services/fs/fs.ts`.
- Domain handler suffix `*DataHandler.ts`: `TowerDataHandler.ts`, `FloorDataHandler.ts`, `FunctionsDataHandler.ts`.
- Tests: `*.test.ts`/`*.test.tsx`; e2e `*.spec.ts`.
- Libraries expose a `lib/index.ts` barrel; `packer` uses `src/` because it builds to `dist/`.

**Directories:**
- PascalCase for feature/component groups: `Workbench/`, `MapEditor/`, `ContentBoundary/`, `SchemaTable/`, `Table/`.
- lowercase for layer/role groups: `fs/`, `stores/`, `services/`, `utils/`, `runtime/`, `project/`, `hooks/`, `types/`.
- Feature subdir shape: a folder with `index.ts`/`index.tsx` as the public entry, with private modules alongside (e.g. `MapEditor/MaterialPanel/`, `Workbench/modals/`).
- Test directories use `__tests__/` under the code they test.

**Symbols:**
- Interfaces prefixed `I` only in older handler contracts (`IContentHandler`, `IDataHandler`); newer code uses plain names (`Fs`, `DataResource`, `EditorOperation`).
- Factories/instances are camelCase singletons: `projectData`, `projectModel`, `operationHistory`, `FileHandlerManager`, `persistenceMonitor`, `editorConfigService`.
- Store objects are PascalCase with a `.useStore()` hook and `.Provider`: `PanelStore.useStore()`, `MapEditorStore.Provider`, `GlobalStore`.
- Message types are PascalCase `*Message` with kebab/dotted `type` strings: `RegisterProjectMessage("project.register")` (`packages/apps/service-worker/src/idl/index.ts`).

## Where to Add New Code

**New Editor Feature / Workspace:**
- Primary code: `packages/apps/editor/src/Workbench/<FeatureName>/index.tsx`
- Register the workspace id in `packages/apps/editor/src/stores/PanelStore.ts` and mount it via `WorkspaceSurface` in `packages/apps/editor/src/Workbench/index.tsx`.
- Tests: `packages/apps/editor/src/Workbench/<FeatureName>/__tests__/`.

**New Project Data File Format:**
- Handler: extend `DataHandler<T>` under `packages/apps/editor/src/fs/<Name>DataHandler.ts`.
- Registration: add a `HandlerDataResource` in `packages/apps/editor/src/project/data/projectData.ts`; expose sub-fields with `MappedDataResource` (`packages/apps/editor/src/project/data/DataResource.ts:143`).

**New Domain Service / Handler:**
- Implementation: `packages/apps/editor/src/services/<domain>/` with an `index.ts` barrel and a `*DataHandler.ts`.
- Types: exported from the same `index.ts` (mirror `packages/apps/editor/src/services/tower/index.ts`).

**New Edit Action:**
- Command: `packages/apps/editor/src/project/commands/<domain>Commands.ts`.
- Operation: implement via `packages/apps/editor/src/project/history/operations.ts` helpers and execute through `operationHistory.execute()`.

**New Read-only Model / Diagnostic:**
- Model: `packages/apps/editor/src/project/model/<name>.ts`.
- Register the derived resource in `packages/apps/editor/src/project/model/projectModel.ts`.
- Combinators: `computedResource`/`aggregateResource`/`optional` from `packages/apps/editor/src/project/resources.ts`.

**New UI Primitive / Boundary:**
- Shared components: `packages/apps/editor/src/components/<Name>/index.tsx` with tests in `__tests__/`.
- Styling tokens come from `styled-system/` generated by PandaCSS (`packages/apps/editor/panda.config.ts`).

**New Shared Library:**
- Create `packages/libs/<name>/` with `package.json` (`type: module`, `exports` pointing at `lib/index.ts`), `lib/index.ts` barrel, and a `tsconfig.json` extending `@motajs/config/tsconfig.lib.base.json`.
- Register workspace dependency via `workspace:*`; add shared versions to the `catalog:` block in `pnpm-workspace.yaml`.

**New Host Route (Service Worker):**
- Routing: add a branch in `packages/apps/service-worker/src/server/router.ts`.
- Handler: new module in `packages/apps/service-worker/src/server/` returning `Response` via `ResponseUtils` (`packages/apps/service-worker/src/server/utils.ts`).

**New Host Message:**
- Contract: add a `MessageType` in `packages/apps/service-worker/src/idl/index.ts`.
- Handler: register with `defineRoute` in `packages/apps/service-worker/src/server/index.ts`.
- Client: call through `MessageClient` from `packages/libs/utils/lib/advance/message/index.ts`.

**Utilities:**
- Editor helpers: `packages/apps/editor/src/utils/<topic>/`.
- Cross-app helpers: `packages/libs/utils/lib/`.

**Tests:**
- Unit: co-locate as `<file>.test.ts(x)` or under `__tests__/`.
- Editor e2e: `packages/apps/editor/e2e/*.spec.ts` (config `packages/apps/editor/playwright.config.ts`).
- SW e2e: `packages/apps/service-worker/e2e/*.spec.ts`.
- Library unit: `packages/libs/<name>/lib/**/*.test.ts` with the package's `vitest.config.ts`.

**Build Scripts:**
- SW deployment helpers: `packages/apps/service-worker/scripts/` (`stage-editor.mjs`, `verify-deployment.mjs`).
- CI workflow: `.github/workflows/deploy-editor-h5test.yml`.

## Special Directories

**`packages/apps/editor/styled-system/`:**
- Purpose: PandaCSS-generated style system (`css/`, `jsx/`, `tokens/`, `types/`).
- Generated: Yes (via `pnpm --filter @motajs/editor prepare` -> `panda codegen`).
- Committed: Yes (consumed through the `@styled-system/*` alias).

**`packages/apps/editor/dist/`:**
- Purpose: Editor build output (`editor-manifest.json`, `index.html`, `runtime.html`, `assets/`).
- Generated: Yes.
- Committed: No.

**`packages/apps/service-worker/dist/`:**
- Purpose: SW build output including `service-worker.js` and staged editor releases under `static/editor/`.
- Generated: Yes (via `scripts/stage-editor.mjs`).
- Committed: No.

**`packages/libs/packer/prev/`:**
- Purpose: Previous packer version kept for reference/migration.
- Generated: No.
- Committed: Yes.

**`packages/external/mota-js/`:**
- Purpose: External engine/sample project submodule; needed only for dev/test (`MOTA_JS_ROOT`).
- Generated: No.
- Committed: As a gitlink only (not checked out in the working tree here).

**`packages/libs/theme/`:**
- Purpose: Shared theme stylesheet (`theme.less`) consumed by the SW management view.
- Note: manifest filename is misspelled `pacakge.json` at `packages/libs/theme/pacakge.json`.

---

*Structure analysis: 2026-09-20*
