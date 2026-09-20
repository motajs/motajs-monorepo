<!-- refreshed: 2026-09-20 -->
# Architecture

**Analysis Date:** 2026-09-20

## System Overview

`motajs-monorepo` is a pnpm workspace containing two shipped frontend applications, a set of reusable libraries, and a git submodule holding the mota-js game engine/sample project. The workspace is declared in `pnpm-workspace.yaml` with three globs: `packages/libs/*`, `packages/apps/*`, `packages/external/*`.

The defining architectural property is that `@motajs/editor` is a **host-agnostic static artifact**. It contains no engine and no project files; a host (the Vite dev server or `@motajs/service-worker`) supplies project data through injected endpoint URLs. The editor is the primary application; the service worker is the production host and orchestrator.

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                         HOST LAYER                                        │
│   Dev: `packages/apps/editor/vite-plugin-mota-server.ts`                  │
│   Prod: `packages/apps/service-worker/src/server/*` (service-worker.js)   │
│   + `packages/apps/service-worker/src/view/*` (project management SPA)    │
└───────────────┬──────────────────────────────────┬───────────────────────┘
                │ injects #mota-editor-environment │ intercepts fetch / messages
                ▼                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    @motajs/editor (React 19 + Vite MPA)                   │
│                                                                           │
│  UI       `src/Workbench/*` `src/MapEditor/*` `src/components/*`          │
│           `src/blockly/*`                                                │
│  State    `src/stores/*`  (PanelStore, EditorStore, MapEditorStore)       │
│  Commands `src/project/commands/*` -> `src/project/history/*`            │
│  Model    `src/project/model/*`  (ProjectModel, diagnostics)             │
│  Data     `src/project/data/*`   `src/project/assets/*`                  │
│  FS       `src/fs/*`  +  `src/services/fs/*` (defaultFs)                 │
│  Runtime  `src/runtime/*` (iframe bridge, MessageChannel)                │
│  Boot     `src/main.tsx` -> `src/App.tsx` -> `src/environment.ts`        │
└───────────────┬──────────────────────────────────┬───────────────────────┘
                │ HTTP POST form                  │ MessageChannel
                ▼                                  ▼
┌──────────────────────────────┐   ┌───────────────────────────────────────┐
│  Project files on disk       │   │  runtime.html iframe                   │
│  `packages/external/mota-js` │   │  `src/runtime/iframeEntry.ts`          │
│  (dev) / FSA handle (prod)   │   │  + engine from `preview` endpoint      │
└──────────────────────────────┘   └───────────────────────────────────────┘
                       ▲
                       │ consumed by
┌──────────────────────────────────────────────────────────────────────────┐
│  ContentHashGraph / shared libs                                            │
│  `@motajs/utils` `@motajs/file2x` `@motajs/react-store`                    │
│  `@motajs/react-hooks` `@motajs/react-monaco-editor` `@motajs/h5animate`   │
│  `@motajs/react-dark-mode` `@motajs/packer` `@motajs/config` `@motajs/theme`│
└──────────────────────────────────────────────────────────────────────────┘
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

**Overall:** Layered unidirectional data flow on the client, with a host-adapter boundary. The canonical pipeline (stated in `packages/apps/editor/README.md:9` and `packages/apps/editor/docs/architecture-and-interfaces.md:25`) is:

```text
ProjectData / ProjectAssets -> ProjectModel -> Commands -> PanelModel / UI
```

Around that core sit two independent protocol boundaries: the host environment injection (endpoint URLs) and the runtime iframe bridge.

**Key Characteristics:**
- **Host-agnostic editor:** the editor only knows endpoint URLs; it never references host types or project IDs (`packages/apps/editor/src/environment.ts`).
- **Memory-first reactive resources:** all project content is exposed as `ReadonlySignal<Content<T>>`; disk writes are asynchronous and fire-and-forget (`packages/apps/editor/src/fs/FileHandler.ts`, `packages/apps/editor/src/fs/PersistExecutor.ts`).
- **Declarative derivation:** model values are derived with `computedResource`/`aggregateResource` from raw data, so writes to raw data automatically propagate (`packages/apps/editor/src/project/resources.ts:122-155`).
- **Command + history discipline:** edits flow through `EditorOperation` and `operationHistory.execute()` to gain undo/redo and inverse operations (`packages/apps/editor/src/project/history/operations.ts`, `packages/apps/editor/src/project/history/operationHistory.ts`).
- **Optional runtime:** a broken runtime iframe degrades to a fallback UI but never blocks the core workbench (`packages/apps/editor/src/runtime/RuntimeProvider.tsx`).
- **Workspace path aliasing:** every package resolves `@/` to its own source dir via `packages/libs/config/resolvePlugin.js` + `packages/libs/config/tsconfig.*.base.json`.
- **Catalog-pinned dependencies:** all shared dependency versions live in the `catalog:` block of `pnpm-workspace.yaml`.

## Layers

**Bootstrap / Configuration Layer:**
- Purpose: Resolve host config and mount the app before any project access.
- Location: `packages/apps/editor/src/main.tsx`, `packages/apps/editor/src/App.tsx`, `packages/apps/editor/src/environment.ts`
- Contains: environment parsing/validation, provider composition, theme CSS switching.
- Depends on: React 19, `@tanstack/react-query`, `antd`, editor stores.
- Used by: browser via `packages/apps/editor/index.html`.

**FS / Resource Layer:**
- Purpose: Turn files into subscribable, recoverable, persistable resources.
- Location: `packages/apps/editor/src/fs/*`, `packages/apps/editor/src/services/fs/*`
- Contains: `Content<T>` state, `FileHandler`, `DataHandler`, `BinaryFileHandler`, `FileHandlerManager`, `PersistExecutor`, `PersistenceMonitor`, `Fs` transport.
- Depends on: `alien-signals`, `@motajs/file2x`.
- Used by: project data/assets and model layers.

**Project Data / Assets Layer:**
- Purpose: Register specific mota-js project files as semantic resources.
- Location: `packages/apps/editor/src/project/data/*`, `packages/apps/editor/src/project/assets/*`
- Contains: `ProjectDataImpl` (`projectData.ts`), `DataResource`, image/animation/material asset resources, `RasterCodec`.
- Depends on: FS layer, per-domain handlers under `packages/apps/editor/src/services/*`.
- Used by: model and command layers.

**Model Layer:**
- Purpose: Derive read-only editor semantics and diagnostics from raw data.
- Location: `packages/apps/editor/src/project/model/*`
- Contains: `projectModel.ts`, `blockRegistry`, `tilesetCatalog`, `passability`, `prefabModel`, `locModel`, `floorOrganization`, `*Diagnostics`, `statusBarModel`, `blocklyModels`.
- Depends on: resource combinators and project data.
- Used by: commands and UI.

**Commands / History Layer:**
- Purpose: Single write path for all edits plus undo/redo.
- Location: `packages/apps/editor/src/project/commands/*`, `packages/apps/editor/src/project/history/*`
- Contains: `mapCommands`, `floorCommands`, `tableCommands`, `locCommands`, `prefabCommands`, `materialCommands`, `animationCommands`, `operationHistory`, `compositeOperation`, `patchResourceOperation`.
- Depends on: resources, helpers (`src/utils/action.ts`).
- Used by: UI panels and map editor.

**UI Layer:**
- Purpose: Render and bind user interaction, never touching file handlers directly.
- Location: `packages/apps/editor/src/Workbench/*`, `packages/apps/editor/src/MapEditor/*`, `packages/apps/editor/src/components/*`, `packages/apps/editor/src/blockly/*`, `packages/apps/editor/src/hooks/*`
- Contains: panels, workspaces, modals, schema-driven tables, Blockly editor, Monaco code editor, suspense hooks.
- Depends on: stores, commands, model.
- Used by: end users.

**Runtime Capability Layer:**
- Purpose: Execute the real mota-js engine in an isolated iframe and expose preview/language snapshot.
- Location: `packages/apps/editor/src/runtime/*`
- Contains: `RuntimeProvider.tsx`, `RuntimeContext.tsx`, `iframeEntry.ts`, `RuntimeResourceGateway.ts`, `protocol.ts`, `RuntimeSurface.tsx`.
- Depends on: `MessageChannel`, project resources.
- Used by: UI preview surfaces.

**Host Layer:**
- Purpose: Provide project files, preview entry, docs, and editor releases to the editor.
- Location: `packages/apps/editor/vite-plugin-mota-server.ts` (dev), `packages/apps/service-worker/src/server/*` (prod), `packages/apps/service-worker/src/view/*` (management UI).
- Contains: FS API server, preview/static server, release staging/cache, project registry, message IDL.
- Depends on: Node fs (dev), `memfs` + File System Access API + `dexie` (prod).

**Shared Libraries Layer:**
- Purpose: Cross-app primitives consumed via workspace protocol.
- Location: `packages/libs/*`
- Contains: utils, file2x, react-store, react-hooks, react-monaco-editor, react-dark-mode, h5animate, packer, config, theme.

## Data Flow

### Primary Request Path — Editor Startup

1. Host serves `index.html` carrying `script#mota-editor-environment` with endpoint URLs (`packages/apps/editor/index.html:11-22`).
2. `main.tsx` creates the React root and calls `initializeEditorEnvironment()` (`packages/apps/editor/src/main.tsx:11-14`).
3. `parseEditorEnvironment` validates exactly one config node, protocol version `1`, and required endpoints `fs`/`runtime`/`preview`/`project` (`packages/apps/editor/src/environment.ts:42-93`).
4. On failure, a startup-error element is rendered instead of the app (`packages/apps/editor/src/main.tsx:24-26`).
5. `App` mounts providers and triggers `editorConfigService.load()` (`packages/apps/editor/src/App.tsx:18-20`).
6. `Workbench` mounts preloaders; `projectData.preloadAll()` loads core files with concurrency 6 and runs legacy airwall migration (`packages/apps/editor/src/Workbench/index.tsx:87-103`, `packages/apps/editor/src/project/data/projectData.ts:50,66-81`).

### Primary Request Path — Read/Write a Project File

1. UI/command asks a `DataResource` for its value; `HandlerDataResource` reads the underlying `IDataHandler` (`packages/apps/editor/src/project/data/DataResource.ts`).
2. `DataHandler` computes parsed content from the tracked `FileHandler` — parse errors do not corrupt file state (`packages/apps/editor/src/fs/DataHandler.ts:36-47`).
3. `FileHandlerManager` guarantees one handler instance per path and serializes loads (`packages/apps/editor/src/fs/FileHandlerManager.ts:48-88`).
4. `FileHandler.commit/load` delegates to the injected `Fs`; the default implementation POSTs `application/x-www-form-urlencoded` to `${fs}/<endpoint>` (`packages/apps/editor/src/services/fs/fs.ts:73-132`).
5. The dev host handles `/readFile`, `/writeFile`, `/writeMultiFiles`, `/listFile`, `/makeDir`, `/moveFile`, `/deleteFile` with path-escape protection (`packages/apps/editor/vite-plugin-mota-server.ts:14-28,214-463`). The production host handles the same operations in `packages/apps/service-worker/src/server/fsApi.ts`.
6. Writes update memory signals immediately and schedule a serialized persistence intent; failures are retained for retry and surfaced by `PersistenceMonitor` (`packages/apps/editor/src/fs/FileHandler.ts:69-78`, `packages/apps/editor/src/fs/PersistExecutor.ts:60-86`).

### Edit + Undo/Redo Flow

1. A UI action calls a command (e.g. `mapCommands.clearArea`) (`packages/apps/editor/src/project/commands/mapCommands.ts`).
2. The command builds an `EditorOperation` with `meta`, `targets`, and `apply()` returning an `AppliedOperation` with an `inverse`.
3. `operationHistory.execute()` captures checkpoints for each target, runs `apply`, and rolls back on failure (`packages/apps/editor/src/project/history/operationHistory.ts:100-188`).
4. `undo()`/`redo()` apply the stored inverse operations; history capacity is 100.
5. Resource `patch`/`set`/`mutate` propagate to underlying data, which triggers `persistStatus` updates in the UI.

### Runtime Preview Flow

1. `RuntimeProvider` loads the `runtime` endpoint into an iframe with a cache-busting query (`packages/apps/editor/src/runtime/RuntimeProvider.tsx:80-84`).
2. On load it creates a `MessageChannel` and posts `RuntimeConnectMessage` with `version: 4` and the `previewUrl` (`packages/apps/editor/src/runtime/RuntimeProvider.tsx:84-153`).
3. `iframeEntry.ts` fetches `previewUrl`, injects the engine, hooks engine loaders to the resource channel, and replies `ready` with matching version (`packages/apps/editor/src/runtime/iframeEntry.ts`).
4. Editor messages (`render-ui`, `render-status-bar`, `language-snapshot`, `close-preview`, `resources-changed`, `resource-response`) drive preview and reflection (`packages/apps/editor/src/runtime/protocol.ts:84-99`).
5. Iframe resource requests route through `RuntimeResourceGateway`, restricted to `project/` paths, with monotonic `revision` and 300 ms debounced hot-reload notifications (`packages/apps/editor/src/runtime/RuntimeResourceGateway.ts`).

**State Management:**
- Global app state via `@motajs/react-store` `mergeStores([EditorStore, PanelStore])` (`packages/apps/editor/src/stores/index.ts:5-8`).
- Domain state stores: `MapEditorStore` (`packages/apps/editor/src/MapEditor/MapEditorStore.ts`), plus standalone signals `prefabState`, `locState`, `editorState`, `appendPicState`.
- Server-ish async state via `@tanstack/react-query` (`packages/apps/editor/src/queryClient.ts`) in the editor and `react-query` v3 in the SW management view.
- Reactive content signals via `alien-signals` (`packages/apps/editor/src/fs/types.ts`).

## Key Abstractions

**`Content<T>`:**
- Purpose: Uniform five-state tagged union for any async resource (`idle | loading | loaded | not-found | error`).
- Examples: `packages/apps/editor/src/fs/types.ts`, consumed by `ContentBoundary` and `useModelResourceSuspense`.
- Pattern: Tagged union + utility combinators in `ContentUtils`.

**`Fs` (injectable transport):**
- Purpose: Highest-value extension point; swap disk for IndexedDB/Zip/cloud/Service Worker.
- Examples: `packages/apps/editor/src/services/fs/fs.ts`, injected into `FileHandler`, `BinaryFileHandler`, `ProjectAssets`.
- Pattern: Adapter interface with callback and promise styles.

**`IDataHandler<T>` / `DataHandler<T>`:**
- Purpose: Parse/stringify a specific on-disk data format into semantic types.
- Examples: `JsonDataHandler`, `Json2xDataHandler`, `TowerDataHandler`, `FloorDataHandler`.
- Pattern: Template method; subclass supplies `parse`/`stringify`.

**`DataResource<T>`:**
- Purpose: Semantic project-data resource with `raw`, `set`, `mutate` (Immer), `patch` (action list), `persistStatus`.
- Examples: `HandlerDataResource`, `MappedDataResource` (e.g. `events.commonEvent` with prefix `['commonEvent']`).
- Pattern: Decorator/wrapper over handlers.

**`ProjectModel` + `ModelResource<T>`:**
- Purpose: Read-only derived semantics shared by panels and completions.
- Examples: `packages/apps/editor/src/project/model/projectModel.ts`, `blocklyModels.ts`, `tilesetCatalog.ts`.
- Pattern: Lazy resource factory returning memoized derived resources.

**`EditorOperation<T>` + `operationHistory`:**
- Purpose: Atomic, invertible edits with multi-target checkpoints.
- Examples: `packages/apps/editor/src/project/history/operations.ts:21-165`, `commandOperations.ts`.
- Pattern: Command pattern with `inverse` and composite helpers.

**Protocol contracts:**
- Environment Protocol v1 (`packages/apps/editor/src/environment.ts`).
- Runtime Protocol v4 (`packages/apps/editor/src/runtime/protocol.ts:4`).
- Editor Update Protocol v2 (`packages/apps/service-worker/src/view/editorUpdate.ts`, `packages/apps/service-worker/src/idl/index.ts:75-90`).
- Editor Artifact Manifest schema v2 (`packages/apps/editor/editor-artifact-plugin.ts:22-30`).

## Entry Points

**Editor SPA:**
- Location: `packages/apps/editor/index.html` -> `packages/apps/editor/src/main.tsx`
- Triggers: Browser navigation to the editor artifact (served by host).
- Responsibilities: Parse environment, mount `App`, render providers and `Workbench`.

**Runtime Bridge:**
- Location: `packages/apps/editor/runtime.html` -> `packages/apps/editor/src/runtime/iframeEntry.ts`
- Triggers: iframe load from `RuntimeProvider`.
- Responsibilities: Handshake with parent, load engine from `previewUrl`, serve resources, run UI/status-bar preview.

**Service Worker Server:**
- Location: `packages/apps/service-worker/src/server/index.ts` (built to `service-worker.js`)
- Triggers: SW `install`, `activate`, `message`, `fetch` events.
- Responsibilities: Route requests, serve FS API/preview/editor shell/release assets, host project registry messages.

**Service Worker Management View:**
- Location: `packages/apps/service-worker/index.html` -> `packages/apps/service-worker/src/view/main.tsx`
- Triggers: Browser navigation to the app root.
- Responsibilities: Register/list/activate projects; registration via `useServiceWorker` (`packages/libs/react-hooks/lib/browser/serviceWorker.ts`).

**Dev Host Plugin:**
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

**What happens:** Reaching for `packages/external/mota-js` engine internals or host modules directly from editor UI modules.
**Why it's wrong:** The editor is deployed as a standalone artifact; such imports break the host boundary and the build. The documented rule is that UI must not depend on file handlers or `core/main/editor` (`packages/apps/editor/README.md:16`).
**Do this instead:** Go through `Fs`/`DataResource`/`RuntimePreviewCapability` (`packages/apps/editor/src/fs`, `packages/apps/editor/src/project/data`, `packages/apps/editor/src/runtime/RuntimeContext.tsx`).

### Writing project data outside the command/history path

**What happens:** Mutating a data resource or raw handler directly from a component.
**Why it's wrong:** Bypasses inverse operations, multi-file checkpoints, and rollback consistency.
**Do this instead:** Implement an `EditorOperation` and call `operationHistory.execute()` (`packages/apps/editor/src/project/history/operations.ts:21-31`, `operationHistory.ts:100-188`).

### Protocol version drift between manifest and runtime

**What happens:** `packages/apps/editor/editor-artifact-plugin.ts:25` declares `runtimeProtocolVersion: 3` while `packages/apps/editor/src/runtime/protocol.ts:4` defines `RUNTIME_PROTOCOL_VERSION = 4`.
**Why it's wrong:** Hosts validating artifacts from the manifest can misjudge runtime compatibility (noted in `packages/apps/editor/docs/architecture-and-interfaces.md:382`).
**Do this instead:** Keep the manifest constant and the runtime protocol constant in sync when either changes.

### Assuming durable persistence after edit

**What happens:** Treating a successful in-memory `set`/`patch` as "saved".
**Why it's wrong:** Persistence is memory-first and eventually consistent; writes can fail without rolling back the UI (`packages/apps/editor/src/fs/PersistExecutor.ts:60-86`).
**Do this instead:** Consult `persistenceMonitor.hasUnsavedChanges()/hasPersistErrors()` and `flush()` before unload/update (`packages/apps/editor/src/fs/PersistenceMonitor.ts`).

## Error Handling

**Strategy:** Layered boundaries that degrade locally instead of failing the whole application.

**Patterns:**
- Startup environment errors replace the app with a message node (`packages/apps/editor/src/main.tsx:24-26`).
- `Content<T>` maps missing files to `not-found` versus `error` via `isFileNotFoundError` (`packages/apps/editor/src/fs/errors.ts:10-18`).
- `ContentBoundary` suspends/render-fallbacks per content subtree (`packages/apps/editor/src/components/ContentBoundary/index.tsx`).
- `AppErrorBoundary`, `PanelErrorBoundary`, `MapEditorErrorBoundary` isolate UI crashes per region.
- Runtime fatal: one automatic retry, then `error` state with manual retry (`packages/apps/editor/src/runtime/RuntimeProvider.tsx:106-117,256-259`).
- Persistence: failures recorded as `failedIntent`, retry via `retryFailed`; no rollback (`packages/apps/editor/src/fs/PersistExecutor.ts`).
- Host HTTP errors: SW uses typed `HttpError`/`errorResponse`/`ResponseUtils` (`packages/apps/service-worker/src/server/utils.ts`); dev server uses `error:` prefix (`packages/apps/editor/vite-plugin-mota-server.ts:226,259`).
- Editor release resolution failures redirect to the project page with `reason`/`detail` query params (`packages/apps/service-worker/src/server/editorHost.ts:130-135`).

## Cross-Cutting Concerns

**Logging:** `console.warn`/`console.error`/`console.debug` with contextual prefixes (e.g. `"Failed to preload ..."` at `packages/apps/editor/src/Workbench/index.tsx:92`). No dedicated logging framework.
**Validation:** Environment JSON strictly validated in `environment.ts`; schema-tables validate project data; SW path normalization in `fsApi.ts`; artifact manifest SHA-256 verification in `editorRelease.ts`; packer input/output via `packages/libs/packer/src/types.ts` + `errors.ts`.
**Authentication:** None in-app. The production SW uses the File System Access API permission model (`queryPermission({ mode: "readwrite" })`, `packages/apps/service-worker/src/server/project.ts:52-58`) and stores handles in Dexie.
**Styling:** `antd` + `@douyinfe/semi-ui` component themes, PandaCSS-generated `styled-system/` for the editor, CSS modules (`localsConvention: camelCase`), and theme CSS files under `packages/apps/editor/assets/theme/`.
**Internationalization:** UI copy is Simplified Chinese; Monaco localization at `packages/libs/react-monaco-editor/lib/localization/zh-cn.ts`.

---

*Architecture analysis: 2026-09-20*
