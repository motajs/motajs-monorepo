# Architecture Research

**Domain:** Engine-agnostic, extensible editor core (extracting `@motajs/editor-core` from an existing React editor)
**Researched:** 2026-09-20
**Confidence:** MEDIUM (repo-derived component/boundary claims are HIGH — read directly from source; external pattern claims are MEDIUM — cross-checked across independent sources; single-provider web claims are LOW)

> Scope note: this document answers *structural* questions for the `editor-core` extraction: component boundaries (core shell vs capability modules vs host adapter vs engine adapter), registration/DI, extension-point design, API-surface versioning, and how to decompose the monolith without leaking engine details. Feature and stack decisions are out of scope here (see `FEATURES.md` / `STACK.md`).

---

## 1. Verdict Up Front

**Use a hexagonal (ports-and-adapters) core with a per-instance runtime object, a single composition root, four package-internal capability modules behind capability ports, and an engine adapter that speaks only to ports core owns.**

Concretely:

1. **Core is not "the editor minus files" — it is a runtime.** Replace the current module-level singletons (`projectData`, `projectModel`, `operationHistory`, `FileHandlerManager`, `persistenceMonitor`, `editorConfigService`) with one per-instance `EditorRuntime` graph created by `createEditorRuntime(config)`. This is the single highest-leverage structural move; without it `editor-core` cannot host two engines, cannot be unit-tested in isolation, and cannot ever accept a plugin.
2. **Two registries, not one.** A public, extension-facing **capability registry** (keyed `kind:id`, read-only snapshot, ownership-tracked, diagnostics-not-throws) and private **service wiring** done once in the composition root. Conflating these is what turns an extension point into a service-locator leak.
3. **Layout stays fixed; content is slotted.** The shell is a fixed component tree exposing **named slots** whose *positions* are not customizable. Customization = registering into a slot or replacing a capability implementation — never re-arranging the shell.
4. **The engine adapter is a port, not an import.** `@motajs/editor` supplies resource descriptors, format handlers, model derivations, and capability hooks. Core never learns a file path, a `var <uuid> =` wrapper, or the word `tower`.
5. **Extensions are designed as descriptors now, loaded never.** Freeze the `EditorExtension` *shape* and the registries this milestone; ship a no-op loader.

Prior art agreement is strong: tldraw [extracted `@tldraw/editor-core` from `@tldraw/editor`](https://github.com/tldraw/tldraw/issues/7954) for exactly this reason and kept the React package re-exporting core for zero breaking changes; Lexical ships `lexical` (dependency-free engine) + `@lexical/react`; ProseMirror ships four required modules and treats everything else as replaceable. *MEDIUM confidence — three independent sources agree on the split shape.*

### 1.1 Reconciliation with sibling research docs

Two points of vocabulary and one point of policy differ from `STACK.md` / `PITFALLS.md`; reconciled here so the roadmap sees one answer.

| Point | `STACK.md` / `PITFALLS.md` | This document | Resolution |
|---|---|---|---|
| Container name | `EditorCore`, `createEditorCore(config)` | `EditorRuntime`, `createEditorRuntime()` | **Same object.** Adopt `EditorCore` / `createEditorCore(config)` in code (two docs already use it); read `EditorRuntime` in this document as that type. "Runtime" here is descriptive (a per-instance runtime graph), not a second concept. |
| Where the container is injected | React Context as composition root, split contexts, `useSyncExternalStore` | Composition root + narrow contexts (pattern 1, §3) | **Agreement.** No DI container. This document's only addition is the rule that capability modules and extensions receive a *narrow* context, not the container itself. |
| Duplicate-id / registration failure | "Duplicate-id policy is explicit and **throws**" | Collect diagnostics, no partial state | **Both, at different layers.** `registerCapability()` returns a `Result`/diagnostic and leaves no partial state (matches the in-repo `BlockRegistry.registerPack` precedent). `createEditorCore()` then aggregates all diagnostics and **fails startup loudly** if any required registration is unresolved. The registration API never throws; the composition root does. This preserves `STACK.md`'s "silent last-wins is the pitfall" intent while keeping runtime construction atomic. |

---

## 2. Standard Architecture

### 2.1 System Overview

```text
┌───────────────────────────────────────────────────────────────────────────────────┐
│  HOST                                                                             │
│  dev: packages/apps/editor/vite-plugin-mota-server.ts                             │
│  prod: packages/apps/service-worker/src/server/*                                  │
│  contract: Environment Protocol v1 (env JSON) + Fs HTTP + MessageChannel          │
└───────────────────────────────┬───────────────────────────────────────────────────┘
                                │ env JSON / form-POST fs / runtime handshake
                                ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│  COMPOSITION ROOT  (the ONLY module that knows host + engine + core concretely)    │
│  packages/apps/editor/src/main.tsx  →  createEditorRuntime({ host, engine, ... })  │
└───────────────┬───────────────────────────────────────────────────────────────────┘
                │ constructs
                ▼
╔═══════════════════════════════════════════════════════════════════════════════════╗
║  @motajs/editor-core            packages/libs/editor-core                          ║
║                                                                                    ║
║  ┌─ KERNEL (no UI, no engine, no host) ──────────────────────────────────────────┐ ║
║  │  EditorRuntime  · capability registry · service wiring · diagnostics bus      │ ║
║  │  ports: FsPort · HostPort · EngineAdapter · PreviewAdapter · CapabilityPorts  │ ║
║  └───────────────────────────────────────────────────────────────────────────────┘ ║
║  ┌─ RESOURCE LAYER ──────────────────────────────────────────────────────────────┐ ║
║  │  Content<T> · FileHandler · DataHandler · BinaryFileHandler                   │ ║
║  │  ResourceRegistry · FileHandlerManager · PersistExecutor · PersistenceMonitor │ ║
║  │  computedResource / aggregateResource / optional                              │ ║
║  └───────────────────────────────────────────────────────────────────────────────┘ ║
║  ┌─ EDIT LAYER ──────────────────────────────────────────────────────────────────┐ ║
║  │  CommandResult · EditorOperation · compositeOperation · operationHistory      │ ║
║  └───────────────────────────────────────────────────────────────────────────────┘ ║
║  ┌─ SHELL (fixed layout) ────────────────────────────────────────────────────────┐ ║
║  │  EditorShell · TopBar · PanelSlot · WorkspaceTabs · ModalHost                 │ ║
║  │  PersistenceNotification · ErrorBoundaries · shell state signals              │ ║
║  └───────────────────────────────────────────────────────────────────────────────┘ ║
║  ┌─ CAPABILITY MODULES (built-in, customizable) ─────────────────────────────────┐ ║
║  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐                  ║
║  │  │ code-editor│ │table-editor│ │ map-editor │ │asset-mgr   │                  ║
║  │  │ (Monaco)   │ │ (schema)   │ │ (Pixi)     │ │ (codec)    │                  ║
║  │  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └─────┬──────┘                  ║
║  │        └──────────────┴──────────────┴──────────────┘                          ║
║  │        each depends on Kernel + Resource + Edit only                           ║
║  └───────────────────────────────────────────────────────────────────────────────┘ ║
║  ┌─ SERVICES ────────────────────────────────────────────────────────────────────┐ ║
║  │  PreviewService (Runtime Protocol v4) · EditorConfigService · Notifications   │ ║
║  └───────────────────────────────────────────────────────────────────────────────┘ ║
║  ┌─ EXTENSION SURFACE (frozen shape, no loader this milestone) ──────────────────┐ ║
║  │  EditorExtension descriptor · registries: commands, panels, resources,        │ ║
║  │  fieldEditors, mapTools/overlays, toolbarActions, settings, keybindings        │ ║
║  └───────────────────────────────────────────────────────────────────────────────┘ ║
╚══════════════════════════════════════════════════════════════════╤════════════════╝
                                                                   │ implements ports
                                                                   ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│  @motajs/editor — ENGINE ADAPTER + default app   packages/apps/editor             │
│  motaAdapter (EngineAdapter impl) · format handlers (Json2x, tower/floor/…)       │
│  engine model derivations · engine commands · Blockly pack · Monaco language env  │
│  engine panels registered into core slots · engine preview boot hook              │
└───────────────────────────────────────────────────────────────────────────────────┘
```

Read the dependency arrow as **strictly one-directional**: `editor` → `editor-core` → shared libs. Core imports nothing from `@motajs/editor`, nothing from `src/environment`, nothing from host code, and never touches the filesystem itself.

### 2.2 Component Responsibilities

| Component | Responsibility | Typical Implementation | Lives in |
|-----------|----------------|------------------------|----------|
| **Composition root** | The only wiring site: build host port, engine adapter, capability set, runtime; mount React root | `createEditorRuntime({host, engine, capabilities})` in `main.tsx` | `editor` |
| **`EditorRuntime`** | Per-instance container for every service, registry, signal scope, and disposer | Factory function returning a plain object graph (no decorators, no container) | core |
| **Capability registry** | Public `kind:id` → implementation map; ownership, diagnostics, read-only snapshot, disposers | `registerCapability(kind, id, value, {owner})` → `Disposable`; mirrors existing `BlockRegistry.registerPack` | core |
| **Service wiring** | Private, typed references handed to capability modules by the runtime | Direct object properties on `EditorRuntime` | core |
| **Ports** | Interfaces core owns and the outside implements | `FsPort`, `HostPort`, `EngineAdapter`, `PreviewAdapter`, per-capability ports | core (types) |
| **Resource layer** | Turn files into subscribable/recoverable/persistable resources | `Content<T>` + handlers + `ResourceRegistry` + persist pipeline (moved verbatim from `src/fs`) | core |
| **Edit layer** | Single write path with undo/redo and multi-target rollback | `EditorOperation` + `operationHistory` (moved from `src/project/history`) | core |
| **Shell** | Fixed layout, panel slots, workspace tabs, modal host, global chrome | React components + shell state signals (from `Workbench/*`, `stores/*`) | core |
| **Capability module** | One editing domain: its UI, its commands, its port | Folder with `index.ts`, components, commands, hooks, port type | core |
| **Extension surface** | Descriptor type + registries that a future loader will feed | Types + `registerExtension(ext)` that validates and dispatches into registries | core |
| **Engine adapter** | Describe *this* engine: files, formats, semantics, labels, preview boot | One `defineEngine({...})` config + engine modules | `editor` |

### 2.3 Recommended Project Structure

```text
packages/libs/editor-core/
├── lib/
│   ├── kernel/
│   │   ├── core.ts                 # createEditorCore(config) → EditorCore (a.k.a. "the runtime")
│   │   ├── context.tsx             # EditorCoreProvider, useEditorCore(), narrow capability contexts
│   │   ├── registry.ts             # capability registry (kind:id, ownership, diagnostics)
│   │   ├── diagnostics.ts          # RegistrationDiagnostic, DiagnosticBus
│   │   ├── disposable.ts           # Disposable / DisposableStore (reverse-order teardown)
│   │   └── ports/
│   │       ├── host.ts             # HostPort (endpoints, clock, notify, telemetry)
│   │       ├── fs.ts               # FsPort (moved from services/fs, incl. FsPromiseApi)
│   │       └── engine.ts           # EngineAdapter (the engine-facing port)
│   ├── resources/                  # == today's src/fs + src/project/resources.ts
│   │   ├── types.ts                # Content<T>, ReadonlySignal
│   │   ├── interfaces.ts           # IContentView / IContentHandler / IDataHandler / RecoverableResource
│   │   ├── ContentUtils.ts
│   │   ├── FileHandler.ts
│   │   ├── DataHandler.ts
│   │   ├── BinaryFileHandler.ts
│   │   ├── JsonDataHandler.ts      # generic JSON only — Json2x moves to the adapter
│   │   ├── FileHandlerManager.ts   # per-runtime instance, not a module singleton
│   │   ├── ResourceRegistry.ts     # NEW: generic id -> resource registration
│   │   ├── PersistExecutor.ts
│   │   ├── PersistenceMonitor.ts
│   │   └── combinators.ts          # computedResource / aggregateResource / optional
│   ├── edit/
│   │   ├── operations.ts           # EditorOperation, compositeOperation, patchResourceOperation
│   │   ├── operationHistory.ts
│   │   ├── commandOperations.ts
│   │   └── types.ts                # CommandResult
│   ├── shell/
│   │   ├── EditorShell.tsx         # the fixed layout
│   │   ├── TopBar.tsx
│   │   ├── slots.tsx               # PanelSlot, WorkspaceSlot, ModalHost, ToolbarSlot
│   │   ├── PersistenceNotification.tsx
│   │   ├── ErrorBoundaries.tsx
│   │   └── state.ts                # shell signals (panel/workspace/theme/current target)
│   ├── capabilities/
│   │   ├── code-editor/            # Monaco host, tabs, completions, diagnostics surface
│   │   ├── table-editor/           # schema renderer, field editors, meta editor
│   │   ├── map-editor/             # Pixi canvas, layers, tools, overlays
│   │   └── asset-manager/          # directories, collections, codec port, preview
│   ├── services/
│   │   ├── preview/                # MessageChannel bridge, protocol v4, resource gateway
│   │   ├── config/                 # EditorConfigService (path injected, in-memory fallback)
│   │   └── notifications.ts
│   ├── extension/
│   │   ├── descriptor.ts           # EditorExtension type (frozen shape)
│   │   ├── register.ts             # validate + dispatch ; no loader
│   │   └── apiVersion.ts           # EDITOR_CORE_API_VERSION + capability tokens
│   └── index.ts                    # THE public API surface — nothing else is importable
```

### 2.4 Structure Rationale

- **`kernel/`:** Everything else depends on it; it depends on nothing. Keeping the runtime + ports here makes the "no engine, no host, no UI" rule mechanically checkable (one folder to lint).
- **`resources/` and `edit/`:** Verbatim moves of modules that are *already* engine-agnostic (`src/fs/*`, `src/project/history/*`, `src/project/resources.ts`). Presenting them as separate layers keeps the proven data-flow story (`ProjectData → ProjectModel → Commands → UI`) recognisable to the existing team while renaming the middle layers.
- **`shell/` separate from `capabilities/`:** Directly encodes "layout stays in core and is not customizable". Capability modules *fill* slots; they never own chrome.
- **`capabilities/*` as folders, not packages:** Four modules that must version and ship together with the shell do not benefit from separate publish cycles, and the milestone explicitly defers layout/plugin complexity. Separate folders give the same boundary discipline at a fraction of the release overhead. Revisit only if the four modules start evolving at different rates.
- **`extension/` present with no loader:** The descriptor shape is the contract third parties will code against; designing it now (and *exercising* it internally by registering the engine's own panels through it) is what makes "extension points designed now" real rather than aspirational.
- **`index.ts` as the only public surface:** A single barrel plus a committed API report is how the frozen surface becomes enforceable rather than a convention.

---

## 3. Architectural Patterns

### Pattern 1: Per-instance runtime replaces module singletons

**What:** One `EditorRuntime` object created at the composition root and passed through React context (or consumed as an explicit argument in non-React code). Every mutable collaborator lives on it.
**When to use:** Always, for anything that today is a module-level `export const x = new X()`.
**Trade-offs:** Requires touching every `import { projectData }` call site (dozens — see the leak inventory in §5.1). Buys: isolated tests, two editors in one page, an `editor-next` that shares the core, and eventual plugin scoping. Accept the churn; it is the price of the milestone's core value.

```ts
// kernel/runtime.ts
export interface EditorRuntime {
  readonly host: HostPort;
  readonly engine: EngineAdapter;
  readonly resources: ResourceRegistry;
  readonly history: OperationHistory;
  readonly registry: CapabilityRegistry;
  readonly diagnostics: DiagnosticBus;
  readonly persistence: PersistenceMonitor;
  readonly shell: ShellState;
  readonly preview: PreviewService;
  dispose(): void;               // reverse creation order
}

export function createEditorRuntime(config: EditorRuntimeConfig): EditorRuntime {
  const diagnostics = createDiagnosticBus();
  const host = config.host;
  const persistence = createPersistenceMonitor();
  const resources = createResourceRegistry({
    fs: config.fs ?? createHttpFs(host.endpoint("fs")),   // composed in the root
    persistence,
    diagnostics,
  });
  const runtime = { host, engine: config.engine, resources, /* … */ } as EditorRuntime;

  // Engine registrations happen exactly here — the adapter never gets a runtime reference.
  for (const registration of config.engine.resources) {
    resources.register(registration);                     // diagnostics, not throws
  }
  for (const contribution of config.engine.contributions ?? []) {
    registerExtension(runtime, contribution);             // internal dogfooding of the ext surface
  }
  return runtime;
}
```

**Anti-detail:** do *not* pass `EditorRuntime` itself into capability modules or extensions. Pass a narrow, purpose-built context (`{ resources, commands, notify }`). This mirrors the host-surface-minimalism rule that shows up in every serious plugin design reviewed: *"the host root `IServiceProvider` is never passed to the plugin."* *MEDIUM confidence — cross-checked across plugin-registry and plugin-SDK sources.*

### Pattern 2: Two registries — capability registry vs service wiring

**What:** Keep the public, extension-facing registration surface (`kind:id`, ownership, diagnostics, snapshot, disposers) strictly separate from the private service graph wired once at the composition root.
**When to use:** Any core that expects third parties to add behavior.
**Trade-offs:** Two concepts instead of one; in exchange, internal helpers can never accidentally become public API and plugins can never reach services they did not declare.

```ts
// core: public capability registry
export type CapabilityKind =
  | "command" | "panel" | "resource" | "table.fieldEditor" | "table.schema"
  | "map.tool" | "map.overlay" | "code.language" | "asset.kind"
  | "toolbar.action" | "settings.section" | "keybinding";

export function registerCapability<T>(
  runtime: EditorRuntime,
  kind: CapabilityKind,
  id: string,                     // namespaced, e.g. "mota.blockRegistry"
  value: T,
  options: { owner?: string; replaceable?: boolean } = {},
): Disposable;

export function getCapability<T>(runtime: EditorRuntime, kind: CapabilityKind, id: string): T | undefined;
export function getCapabilityOrThrow<T>(runtime: EditorRuntime, kind: CapabilityKind, id: string): T;
export function snapshotCapabilities(runtime: EditorRuntime): ReadonlyMap<string, ReadonlyMap<string, unknown>>;
```

Rules worth committing to, all supported by prior art:
- **Selection always names an ID.** No silent "first registered wins" default for a capability a consumer asked for by name (tldraw's `shapeUtils` arrays and loom's capability keys both behave this way).
- **Namespaced IDs** (`mota.`, `plugin.acme.`) so ownership and conflict messages are actionable.
- **Diagnostics, not throws, for registration problems**, with rollback of the failed registration — exactly the existing in-repo `BlockRegistry.registerPack` contract (`src/blockly/registry/index.ts:428-490`, returns `RegisterPackResult` and restores the previous pack on failure). This is a HIGH-confidence, first-party precedent; reuse the shape.
- **Everything returns a disposer**; teardown runs in reverse creation order.
- **Read-only snapshot** for UI/debug; the registry cannot be mutated through it.

### Pattern 3: The engine adapter is a declarative port

**What:** `@motajs/editor` exports a value that describes its files, formats, model derivations, and capability hooks; core consumes it. Core-visible types are generic (paths are `string`, formats are opaque ids, model outputs are core-defined catalog shapes).
**When to use:** This milestone, in full. Later, one adapter per engine.
**Trade-offs:** Adapter code is a translation layer you must maintain. Pays for itself immediately: it is the *only* place engine knowledge may exist, so "no leaks" becomes a reviewable rule instead of a hope.

```ts
// core: kernel/ports/engine.ts
export interface ResourceDescriptor {
  id: string;                                  // "mota.tower" — namespaced, stable
  path: string;                                // engine decides the layout
  format: DataFormatId;                        // core only knows the id + handler
  handler: IDataHandler<unknown>;              // engine constructs it
  preload?: "eager" | "lazy" | "on-demand";
  preloadDependsOn?: string[];                 // e.g. floors depend on the tower file
}

export interface EngineAdapter {
  readonly id: string;                         // "mota-js"
  readonly resources: readonly ResourceDescriptor[];
  readonly migrations?: readonly MigrationHook[];
  readonly model?: ModelHooks;                 // pulls, not pushes
  readonly capabilities?: CapabilityPorts;     // per-module hooks (see §3.4)
  readonly contributions?: readonly EditorExtension[];  // engine UI registered via the ext surface
  readonly labels?: LabelOverrides;            // engine vocabulary; core copy stays zh-CN
}

// engine side — package @motajs/editor
export const motaEngine = defineEngine({
  id: "mota-js",
  resources: [
    { id: "mota.tower", path: "project/data.js",  format: "mota.json2x", handler: new TowerDataHandler(...), preload: "eager" },
    { id: "mota.items", path: "project/items.js", format: "mota.json2x", handler: new ItemsDataHandler(...), preload: "eager" },
    { id: "mota.floor", path: "project/floors/{id}.js", format: "mota.floor", handler: floorHandlerFactory, preload: "on-demand", preloadDependsOn: ["mota.tower"] },
  ],
  model: { /* blockRegistry, tilesetCatalog, passability, floorOrganization, locModel, diagnostics */ },
  capabilities: { map: motaMapHooks, table: motaTableHooks, code: motaCodeHooks, assets: motaAssetHooks },
  contributions: motaPanels,     // TowerPanel, LocPanel, PrefabPanel, … registered, not hardcoded
});
```

Key discipline: **core defines the shapes it needs; the adapter conforms to them.** Never the reverse (that is how `MapsBlocksData`, `TowerData`, `idnum`, `autotile` end up in core).

### Pattern 4: Capability ports are the customization seam

**What:** Each of the four capability modules declares a port; the engine adapter implements it. The module owns UI + commands + interaction; the port supplies semantics.
**When to use:** All four modules, this milestone.
**Trade-offs:** More interfaces to define up front. But it is precisely what makes "四大块对定制者开放" implementable without a plugin loader.

| Capability | Core owns | Port supplies (`EngineAdapter.capabilities`) |
|---|---|---|
| **code-editor** | Monaco host + model scope, file-backed tabs, save/undo binding, diagnostics surface, completion registry | Which resources are code files; language config; completion/typing sources (today `projectLanguageEnvironment.ts`, `projectModel`); docs endpoint usage |
| **table-editor** | Schema-driven table renderer, field-editor registry, action-path editing, validation UI, meta editor | Schema bundles + meta-file mapping (today `tableModels.ts`, `tableMetaService`), domain field types (`PassabilityField`, `FloorImagesField`) |
| **map-editor** | Pixi canvas/layers, coordinate + grid utils, tool state machine, overlay host, recently-used panel | `BlockRegistry`, `SpriteRegistry`/tileset catalog, passability provider, floor list + organization, loc resolver, floor transform plan, default ground rendering |
| **asset-manager** | Directory/collection resources, append/insert/replace/remove ops, browser + preview UI, `RasterCodec` port | Asset roots + kinds, material specs, animation format handling, codec implementation |

Note the asymmetry that makes this work: *table-editor is the least engine-coupled* (its whole input is a schema), *map-editor is the most* (it needs five separate semantic hooks). Build in that order (§6).

### Pattern 5: Fixed shell with named slots

**What:** The shell is a component tree whose structure is compiled in. Slots (`PanelSlot`, `WorkspaceSlot`, `ToolbarSlot`, `ModalHost`, `SettingsSlot`) accept registered content. Slot *identity and position* are fixed; slot *content* is extensible.
**When to use:** Directly implements "core 内部持有固定布局与外壳，本期不支持布局自定义".
**Trade-offs:** A customizer cannot move the toolbar. That is the stated trade — accepted deliberately because layout customization has poor cost/benefit. Prior art: ProseMirror's core view similarly refuses to own menus and keybindings, pushing them to plugins, while still owning the editing surface.

```ts
// shell/slots.tsx
export function PanelSlot({ id }: { id: PanelId }) {
  const runtime = useEditorRuntime();
  const panels = useCapabilityList(runtime, "panel");   // reactive over registry
  const entry = panels.filter((p) => p.slot === id).sort(byOrder)[0];
  return entry ? <entry.component /> : null;
}
```

Internal registrations must use the *same* API extensions will use. If `TowerPanel` is registered with `registerCapability(runtime, "panel", "mota.tower", …)`, the extension surface is proven every build; if it is hardcoded into `Workbench/index.tsx`, the extension surface is speculative.

---

---

## 4. Data Flow

### 4.1 Read path (engine data → UI)

```text
Host Fs HTTP  ──►  FsPort  ──►  FileHandlerManager (1 instance per path)
                                    │  load()
                                    ▼
                               FileHandler          Content<string>
                                    │  parse()
                                    ▼
                              DataHandler<T>        Content<T>      ← engine-supplied format
                                    │  register()
                                    ▼
                       ResourceRegistry.runtime.get("mota.tower")   ← engine supplies the id
                                    │  combinator layer
                                    ▼
                    EngineAdapter.model.*  →  core catalog shapes
                    (blockRegistry / tilesetCatalog / passability / floorOrganization)
                                    │  capability port
                                    ▼
              capability module UI (table / map / code / assets)  →  shell slot
```

Everything above `DataHandler` is engine-agnostic. The only engine-specific inputs are the `ResourceDescriptor` (path + format + handler) and the `model` hooks.

### 4.2 Write path (UI → persistence) — unchanged in shape, changed in ownership

```text
UI interaction
    │
    ▼
capability command  (engine commands live in @motajs/editor; generic ones in core)
    │  build EditorOperation { meta, targets, apply() → { inverse } }
    ▼
runtime.history.execute(op)
    │  checkpoint each OperationTarget
    ├─ on failure → rollback automatically
    ▼
DataResource.raw/set/mutate/patch
    │
    ├──► memory signal updates immediately  →  React re-render (optimistic)
    └──► persistence.schedule(path, writeIntent)
              │  serialize (dedupe + per-path serialization)
              ▼
         PersistExecutor  ──►  FsPort.writeFile  ──►  Host Fs HTTP
              │
              └─ on failure: record failedIntent, surface via PersistenceMonitor
                 (no UI rollback — by design)
```

**Invariants to preserve exactly** (these are the behaviour-preservation contract for a "pure refactor" milestone):
1. Memory-first: a successful `set`/`patch` is *not* a save. `hasUnsavedChanges()` / `hasPersistErrors()` / `flush()` remain the boundary API.
2. Single write path: nothing outside `operationHistory.execute()` mutates a resource.
3. `not-found` vs `error` distinction survives custom `FsPort` implementations (`isFileNotFoundError` contract).
4. Persistence is per-path serialized: at most one executing intent plus one pending (later writes coalesce).

### 4.3 Registration flow (composition root)

```text
main.tsx
  ├─ parseEditorEnvironment()            [host → HostPort]
  ├─ import motaEngine                   [engine adapter]
  └─ createEditorRuntime({ host, engine, capabilities: coreCapabilities })
        ├─ create services (resources, history, persistence, preview, shell state)
        ├─ register engine ResourceDescriptors        → ResourceRegistry
        ├─ register engine model hooks                → capability registry (kind: "*.<name>")
        ├─ register capability-port implementations    → capability registry
        ├─ register engine contributions (panels, …)   → capability registry  ← dogfoods ext surface
        └─ freeze + validate (duplicate ids, missing required hooks, dependency cycles)
  └─ <EditorRuntimeProvider runtime={runtime}><EditorShell /></EditorRuntimeProvider>
```

Validation failures at this point must be **collected into one report**, not thrown one at a time — a partially-registered editor is worse than a refused one. (`registerPack` already does diagnostics-with-rollback; extend that to runtime construction.)

### 4.4 Preview flow (Runtime Protocol v4 — unchanged on the wire)

```text
TopBar / modal
    │ previewUI(request) / previewStatusBar(request) / languageSnapshot()
    ▼
core PreviewService
    ├─ iframe(src = host.endpoint("runtime") + "?instance=…")
    ├─ MessageChannel + RuntimeConnectMessage { version: 4, previewUrl }
    ├─ on "resource" request → RuntimeResourceGateway
    │      ├─ allowlist: project/ prefix (kept)
    │      ├─ resolve via ResourceRegistry / asset capability (NOT via agent-specific globals)
    │      └─ attach monotonic revision; subscribe → "resources-changed" (debounced)
    └─ surface lease: { size, attach(container), close() }
```

**Recommended boundary:** core owns the envelope (`protocol.ts`), the provider/context, the gateway, the surface leases, and the retry policy. The **engine boot hook** (today `runtime/iframeEntry.ts`'s overrides of `main.loadMod`, `loader.prototype.loadImage`, `importFonts`, …) becomes a `PreviewAdapter` port implemented in `@motajs/editor`. Core must not know what `loadMod` is; the adapter must not know how the channel is established.

---

## 5. Decomposing the Monolith Without Leaking Engine Details

### 5.1 The actual leak inventory (HIGH confidence — read from source)

The monolith's engine knowledge is concentrated, not diffuse. Measured from the source tree:

| Leak class | Where | Count / evidence | Disposition |
|---|---|---|---|
| **Engine file paths** | `src/project/data/projectData.ts:24-32` (`project/data.js`, `items.js`, `enemys.js`, `maps.js`, `icons.js`, `functions.js`, `plugins.js`, `events.js`), `:83-85` (`project/floors/${id}.js`), `src/services/editorConfig/editorConfigService.ts:18` (`_server/config.json`) | 10 hardcoded paths | → `ResourceDescriptor[]` in the adapter |
| **Engine format coupling** | `Json2xDataHandler` (the `var <uuid> = {json}` wrapper at `projectData.ts:32,201-206`) plus per-domain `*DataHandler` subclasses | 1 generic + ~10 domain handlers | generic JSON stays in core; `Json2x` + all domain handlers → adapter |
| **Hardcoded resource accessors** | `ProjectDataImpl` (`projectData.ts:91-330`) exposes `tower()/items()/enemys()/mapBlocks()/icons()/functions()/plugins()/events()/commonEvents()/floor(id)/tableMetaSource(key)` and a mota-specific `preloadAll()` | 11 accessors + preload graph | → `ResourceRegistry` + `preloadDependsOn` in descriptors |
| **Singleton reach-through from UI** | `import { projectData }` / `import { projectModel }` across `Workbench/*`, `MapEditor/*`, `blockly/*`, `components/*`, `projects/commands/*`, `project/model/*`, `runtime/*`, `hooks/*` | 90+ import sites (sampled; truncated at 100 matches) | → `useEditorRuntime()` / typed capability accessors, migrated per capability |
| **Engine semantics in "model" layer** | `project/model/*` (`blockRegistry`, `tilesetCatalog`, `passability`, `prefabModel`, `locModel`, `floorOrganization`, `tableModels`, `statusBarModel`, `blocklyModels`) | 13 modules | → adapter-provided **hooks** returning core-defined catalog shapes |
| **Engine vocabulary in shared code** | `mota`, `tower`, `loc`, `prefab`, `autotile`, `idnum`, `airwall`, `commonEvent` appearing in `showcase` paths, labels, and migration code (`project/migrations/airwallMigration.ts`) | pervasive in copy + types | labels → `LabelOverrides`; migrations → `MigrationHook`; **type names must not cross into core** |
| **Host coupling** | `src/services/fs/fs.ts` reads `editorEndpoint` from `@/environment` | 1 module | → `FsPort` created in the composition root from `HostPort.endpoint("fs")` |
| **Protocol constants** | `runtime/protocol.ts:4` (`RUNTIME_PROTOCOL_VERSION = 4`) vs `editor-artifact-plugin.ts:25` (`runtimeProtocolVersion: 3`) | drift already present | single exported constant consumed by both; fix during extraction |

**Reading:** the coupling is ~10 paths, ~11 accessors, ~13 model modules, and one transport import. That is a bounded, mechanically listable transformation — which is exactly why the strangler approach below is viable and a rewrite is not.

### 5.2 The leak-prevention mechanism (three layers)

1. **Ownership rule.** *Ports are declared by core and implemented by the adapter.* If core needs something engine-specific, the correct move is to widen a core-defined generic shape, never to import an engine type. Write this as an ADR.

2. **Negative-space package contract.** Give each package an explicit "may never import" list, enforced in CI. This is what successful extractions actually do:

```jsonc
// tooling/boundaries.json (checked by eslint import/no-restricted-paths or dependency-cruiser)
{
  "@motajs/editor-core": {
    forbidden: [
      "@motajs/editor", "**/apps/editor/**",
      "**/src/environment", "**/services/**", "**/runtime/iframeEntry*",
      "**/external/mota-js/**",
      "node:fs", "node:path", "electron", "next/*"
    ],
    requireZero: ["module-level singletons outside kernel/core.ts"]
  },
  "@motajs/editor": {
    forbidden: ["**/apps/service-worker/**", "**/vite-plugin-mota-server*"]
  }
}
```

3. **Frozen-surface artifact.** Commit an API report (§7) and fail CI when it changes without an accompanying version decision. tldraw and VS Code both ship exactly this (`api-report.api.md`, `vscode.d.ts`); it is the only reliable way to keep a "public surface" from silently growing.

### 5.3 Strangler sequence (how to move code without a big-bang)

```text
step 0  Create editor-core, copy (do not yet delete) the engine-agnostic files.
        editor-core compiles standalone with zero engine/host imports.

step 1  Introduce the runtime + registries in core, still unused by the app.

step 2  editor/src re-exports core's resource + edit layers:
          export * from "@motajs/editor-core/resources";
        Existing imports keep working; the app now runs core code.

step 3  Adapter registers resources via descriptors; delete ProjectDataImpl accessors
        ONE DOMAIN AT A TIME, keeping `projectData.tower()` as a thin deprecated shim
        that resolves `runtime.resources.get("mota.tower")`.

step 4  Migrate capability-by-capability (table → code → assets → map). For each:
          - move the UI module into core under capabilities/<name>/
          - replace `projectModel.x` reads with a port hook
          - rewire call sites to useEditorRuntime()
          - keep the old panel export as a deprecated proxy during the phase
        Full test suite + manual UAT at the end of each capability.

step 5  Replace Workbench with core's EditorShell; register engine panels through the
        extension surface. `Workbench/index.tsx` becomes a thin contribution list.

step 6  Delete shims. editor/src/ keeps only: main.tsx (composition root),
        environment.ts (host port construction), engine adapter, engine model,
        engine format handlers, engine preview boot hook, engine panels.

step 7  Freeze the extension surface + publish the API report + versioning policy.
```

The "deprecated proxy" step is not optional politeness — it is the mechanism that keeps the milestone's "行为完全不变" promise verifiable while 90+ call sites change. Prior art: Commerce Layer kept every old container as a thin delegating wrapper that logged a deprecation warning, letting consumers migrate component-by-component. *MEDIUM confidence — single strong source.*

---

---

## 6. Build Order (component dependency order → roadmap implications)

### 6.1 Dependency DAG

```text
                 ┌──────────────────────────────────────┐
                 │ A. kernel: runtime, ports, registry  │  ← no deps
                 └───────────────┬──────────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────────┐
        ▼                        ▼                            ▼
┌───────────────┐      ┌──────────────────┐        ┌──────────────────┐
│ B. resources  │      │ C. edit/history  │        │ D. shell + slots │
└───────┬───────┘      └────────┬─────────┘        └────────┬─────────┘
        │                       │                           │
        └───────────┬───────────┘                           │
                    ▼                                       │
        ┌───────────────────────────┐                       │
        │ E. capability ports       │◄──────────────────────┘
        │    (per-capability iface) │
        └─────────────┬─────────────┘
                      │
   ┌──────────────────┼───────────────────┬────────────────────┐
   ▼                  ▼                   ▼                    ▼
┌──────────┐   ┌────────────┐     ┌─────────────┐     ┌──────────────┐
│ F. table │   │ G. code    │     │ H. assets   │     │ I. map       │
│ (least   │   │ (Monaco +  │     │ (binary +   │     │ (most engine │
│ coupled) │   │  language) │     │  codec)     │     │  hooks)      │
└────┬─────┘   └─────┬──────┘     └──────┬──────┘     └──────┬───────┘
     └───────────────┴────────┬──────────┘                   │
                              ▼                              │
                    ┌──────────────────┐                     │
                    │ J. preview svc   │◄────────────────────┘
                    └────────┬─────────┘
                             ▼
                    ┌──────────────────┐
                    │ K. adapter       │
                    │    cutover       │
                    └────────┬─────────┘
                             ▼
                    ┌──────────────────┐
                    │ L. ext surface   │
                    │    freeze + API  │
                    └──────────────────┘
```

### 6.2 Why this order

- **A before everything:** the runtime instance and registries are the abstraction every later step depends on. Doing them last means rewriting every intermediate step.
- **B and C in parallel:** independent verbatim moves (`src/fs/*`, `src/project/history/*`); both already engine-agnostic.
- **D after A:** the shell needs runtime access but not resources. Building it early lets capability modules integrate against a real shell instead of a harness.
- **E before F–I:** capability ports must be defined *from the engine's real needs*, so extract them by reading the four `services/*` domains, not by guessing.
- **F (table) first among capabilities:** its entire input is a declarative schema (`docs/table-schema-design.md`) and its engine coupling is a mapping table. It forces the "schema + injected model" abstraction to be right before three harder modules depend on it.
- **G (code) second:** needs `ResourceRegistry` + a completion/language hook; validates the port against a second, differently-shaped domain (file-backed rather than schema-backed).
- **H (assets) third:** needs binary `FsPort` + `RasterCodec` + collection resources; validates the port for non-text data and for write-heavy operations.
- **I (map) last:** needs five semantic hooks (block registry, sprite/tileset catalog, passability, floor organization, loc resolver) plus Pixi rendering and a tool state machine. By this point the registry, port, and command patterns are proven; the risky module gets a settled foundation. **This ordering matters most** — map is where a wrong abstraction is most expensive.
- **J after F–I:** the preview gateway resolves resources through `ResourceRegistry` and the asset capability, so both must exist first.
- **K last:** the adapter is the union of everything it must supply; it can only be completed once all ports are final. K is also the first phase where `@motajs/editor`'s public behaviour can be regression-tested end-to-end.
- **L after K:** freeze the surface once the adapter stops moving.

**Alternative considered:** code-editor first (it looks simplest) — rejected because it validates the least interesting axis (file → text) and would let the team defer the schema-injection design that three other modules need. **Alternative considered:** map first (it's the flagship feature) — rejected because it would hardcode engine semantics into the capability port on the first try.

### 6.3 Suggested phase structure (for `SUMMARY.md` / ROADMAP)

| Phase | Focus | Exit criterion |
|---|---|---|
| 1 | Kernel: runtime, ports, registries, diagnostics | `createEditorRuntime` constructs a validated empty runtime; boundary lint green |
| 2 | Resource + edit layers moved; app runs core code via re-exports | Existing tests green; no behaviour change |
| 3 | Engine adapter skeleton + descriptors; `ProjectDataImpl` shimmed | All `projectData.*` accessors resolve through `ResourceRegistry` |
| 4 | Fixed shell + slots + shell state; `Workbench` delegated | Editor renders identically through `EditorShell` |
| 5 | Table capability + port (first vertical slice) | Table panels/commands engine-free; engine supplies schema + meta |
| 6 | Code capability + port | Monaco env, completions, docs hook injected |
| 7 | Asset capability + port | Binary fs + codec injected; collections engine-free |
| 8 | Map capability + port | Pixi canvas engine-free; five hooks supplied by adapter |
| 9 | Preview service + `PreviewAdapter` | Runtime Protocol v4 unchanged; engine boot hook moved out |
| 10 | Adapter cutover + shim deletion + full regression | Delete `projectData`/`projectModel` singletons; tests + manual UAT green |
| 11 | Extension-surface freeze + API report + versioning policy | Committed API report; deprecation policy documented; protocol drift fixed |

**Research flags:** Phase 8 (map) and Phase 9 (preview) are the two phases likely to need deeper phase-specific research — map because Pixi/tool-state extraction is the largest single move, preview because the engine boot hook is the least-documented surface in the repo. Phases 2–4 are standard patterns and unlikely to need additional research.

---

## 7. Extension Points and API-Surface Versioning

### 7.1 Extension descriptor (freeze the shape now, load nothing)

```ts
// extension/descriptor.ts
export interface EditorExtension {
  id: string;                       // "acme.material-tools"
  name: string;
  apiVersion: number;               // required: range-checked against EDITOR_CORE_API_VERSION
  requires?: readonly string[];     // capability/extension ids this depends on
  optional?: readonly string[];     // resolved after all extensions have registered
  activate(ctx: EditorExtensionContext): Disposable | void;
}

// The context is deliberately narrow — never the runtime, never the service graph.
export interface EditorExtensionContext {
  readonly apiVersion: number;
  readonly resources: Pick<ResourceRegistry, "register" | "get" | "snapshot">;
  readonly commands: Pick<CommandApi, "register" | "execute">;
  readonly capabilities: {
    register<T>(kind: CapabilityKind, id: string, value: T): Disposable;
    get<T>(kind: CapabilityKind, id: string): T | undefined;
  };
  readonly ui: { registerPanel(spec: PanelSpec): Disposable; registerToolbarAction(spec): Disposable; registerFieldEditor(spec): Disposable };
  readonly diagnostics: DiagnosticBus;
  readonly labels: LabelOverrides;
}
```

Design rules carried over from prior art (all cross-checked, MEDIUM):
- **Manifest-style descriptor + separate activation.** VS Code separates static `contributes` (declarative, parse-time) from `activate` (runtime); OpenClaw separates `registerCliMetadata` from `registerFull`. Mirroring this lets a future loader present contribution points *before* code runs.
- **Two-phase activation** (`activate` for all, *then* resolve `optional` deps) — avoids load-order fragility.
- **Return `Disposable`** from every registration; teardown in reverse order.
- **`apiVersion` is a required integer**, not optional. Absence makes compatibility unverifiable.

### 7.2 Public-surface versioning

**Frozen surface** (must be enumerated in one committed document):
1. All exports of `@motajs/editor-core` `index.ts` — enforced by a committed API report (`@microsoft/api-extractor`).
2. The four capability port type sets.
3. `EditorExtension` descriptor + `EditorExtensionContext`.
4. Capability id namespaces and `EDITOR_CORE_API_VERSION`.
5. The host-facing protocols: Environment Protocol v1, Runtime Protocol v4, Editor Update Protocol v2, Editor Artifact Manifest schema v2 — **all unchanged this milestone.**

**Policy to adopt:**
- **SemVer on the package**, with the public API declared (SemVer explicitly requires this; a version number is meaningless without a declared surface).
- **New behavior lands capability-gated first**, then may be promoted to baseline in a later major. This lets engines/extensions adopt on independent schedules — the pattern used by both Agent Host Protocol and AdCP.
- **Additive-only within a major:** new optional fields, new capability kinds, new ids. Older consumers MUST ignore unknown values.
- **Deprecation:** mark in a minor release, keep working with a console warning, remove only at the next major, ≥6 months of notice. (Reject "rename-with-alias-in-same-release" — it is the most common source of silent ecosystem breakage.)
- **Capability detection over version comparison** for extensions; version numbers only gate hard architectural boundaries.
- **Fix the existing drift now:** one exported `RUNTIME_PROTOCOL_VERSION` consumed by both `runtime/protocol.ts` and `editor-artifact-plugin.ts`. Today they disagree (4 vs 3) and it is already flagged in `docs/architecture-and-interfaces.md:382`.

### 7.3 Evolution / scale table

| Scale | Architecture adjustments |
|---|---|
| **1 engine (this milestone)** | Runtime + four capability modules + one adapter. Fixed shell. Extension surface present but only dogfooded internally. |
| **2–3 engines** | Nothing structural changes: add adapters. Capability ports get exercised by a second consumer and will need widening — expect additive `apiVersion` bumps. Consider splitting `capabilities/*` into packages once two engines evolve them at different rates. |
| **Third-party extensions** | Turn on the loader: descriptor → validate → activate. The registries, `apiVersion`, namespaced ids, and disposers already exist, so the loader is a contained addition rather than a redesign. This is the payoff for designing the surface now. |
| **Many extensions / untrusted code** | Add per-extension scoped capability contexts (pass only declared capabilities), activation budgets, and conflict diagnostics. Do **not** hand out `EditorRuntime`. |

### 7.4 Scaling priorities (what breaks first)

1. **First bottleneck: singleton leakage.** If any `export const x = new X()` survives in core, two engines in one page and per-test isolation both fail — and it fails late, after all four capabilities have been migrated. Mitigate with the boundary lint's `requireZero` rule from day one.
2. **Second bottleneck: capability-port churn.** Each new engine reveals a port shaped too narrowly for one engine. Mitigate by keeping ports generic in *shape* (catalog maps, id strings) and engine-specific only in *implementation*, and by versioning the port set with `apiVersion`.
3. **Third bottleneck: registration-time validation.** With many extensions, duplicate ids and dependency cycles become the dominant failure mode. Mitigate with upfront graph validation + a single aggregated report before any activation, mirroring the existing `registerPack` diagnostics-with-rollback behaviour.

---

---

## 8. Anti-Patterns

### Anti-Pattern 1: Core importing engine or host code

**What people do:** Reach for an engine type, a mota-js path constant, or `@/environment` inside core "just for now" because a port is not defined yet.
**Why it's wrong:** It collapses the entire milestone. The moment core imports `TowerData` or `project/data.js`, `editor-next` requires a fork, third-party customization becomes impossible, and the package boundary lint has to be disabled (after which everything leaks).
**Do this instead:** Widen a core-defined generic shape (`ResourceDescriptor`, catalog maps, `LabelOverrides`) and let the adapter conform. If you cannot express it generically yet, leave the capability port unimplemented and mark the TODO — do not import.

### Anti-Pattern 2: Keeping module-level singletons in core

**What people do:** `export const resourceRegistry = new ResourceRegistry()` (directly mirroring today's `export const projectData = new ProjectDataImpl()` at `projectData.ts:330`).
**Why it's wrong:** Singletons make the core untestable in isolation, make two editors in one page impossible, make teardown impossible, and make a future plugin's resources indistinguishable from the host's. The existing codebase already carries six such singletons (`projectData`, `projectModel`, `operationHistory`, `FileHandlerManager`, `persistenceMonitor`, `editorConfigService` per `.planning/codebase/ARCHITECTURE.md`), and `ResetForTests()` on `ProjectDataImpl` is the smell that proves the cost.
**Do this instead:** Construct everything in `createEditorRuntime()`. Where module scope is unavoidable for ergonomics (React hooks), export a **proxy accessor** that reads from the current runtime and throws a clear error if used outside a provider — the "proxy singleton" pattern used by successful core extractions.

### Anti-Pattern 3: UI importing the engine model directly

**What people do:** `import { projectModel } from "@/project/model/projectModel"` from a panel component — the single most common leak (90+ sites).
**Why it's wrong:** It hard-wires the panel to one engine, defeats the capability port, and makes the panel un-reusable for `editor-next`. It also bypasses the registry, so a customizer cannot substitute the model.
**Do this instead:** Consume the capability port via the runtime: `const { blockRegistry } = useMapHooks(runtime)`. If a panel needs a value no port exposes, that is a signal to widen the port — not to import.

### Anti-Pattern 4: Passing the whole runtime into extensions

**What people do:** `activate(runtime)` because it is convenient.
**Why it's wrong:** Every future internal refactor becomes a breaking API change; extensions can reach services they never declared; nothing is auditable.
**Do this instead:** Pass a narrow `EditorExtensionContext` listing exactly what is supported. A per-consumer scoped context is the primary structural lever against internals access.

### Anti-Pattern 5: One registry doing two jobs

**What people do:** Register internal helper services (persist executor, http fetch, logger) into the same registry as public capabilities.
**Why it's wrong:** Private helpers become accidental public API; capability snapshots expose internals; conflict/ownership diagnostics become meaningless.
**Do this instead:** Two mechanisms — public capability registry (kind:id, namespaced, snapshot-able) and private service wiring in the composition root. Different keys, different lifetimes.

### Anti-Pattern 6: Silent default selection

**What people do:** `getCapability("map.tool")` returns the first registered tool when the caller did not specify an id.
**Why it's wrong:** Behaviour silently depends on load order; a plugin can hijack a default by registering first; debugging is nearly impossible.
**Do this instead:** Require an explicit id for named lookups, and expose an explicit, documented `getDefault(kind)` where a default genuinely exists.

### Anti-Pattern 7: Throwing on the first registration error

**What people do:** `throw new Error("duplicate capability id")` during runtime construction.
**Why it's wrong:** The editor comes up half-registered, which is worse than not coming up. With multiple extensions the user sees one error at a time.
**Do this instead:** Collect diagnostics, validate the whole graph (duplicate ids, missing required deps, cycles), then either present one actionable report or run in a degraded-but-consistent mode. The in-repo `BlockRegistry.registerPack` already models this with `RegisterPackResult` + rollback — copy it.

### Anti-Pattern 8: Big-bang file moves

**What people do:** Move all of `src/` into `editor-core` in one commit and fix imports for a week.
**Why it's wrong:** The "行为完全不变" verification becomes impossible; there is no green baseline to bisect against; test failures cannot be attributed to a layer.
**Do this instead:** The strangler sequence in §5.3 — copy, re-export, shim, migrate one capability at a time, delete shims last. Prior art: the OTT-monorepo retrospective explicitly warns that extracting after the fact costs "lots of dependency untangling", and the fix is to move in small, always-green increments.

### Anti-Pattern 9: Duplicating protocol constants

**What people do:** Re-declare `runtimeProtocolVersion: 3` in the artifact plugin while the runtime says `4`.
**Why it's wrong:** It already happened here (`.planning/codebase/ARCHITECTURE.md` flags `editor-artifact-plugin.ts:25` vs `runtime/protocol.ts:4`), and hosts validating artifacts from the manifest can misjudge compatibility.
**Do this instead:** One exported constant per protocol, imported by every producer and consumer; add a test asserting the manifest value equals the runtime constant.

---

## 9. Integration Points

### 9.1 External boundaries

| Boundary | Integration pattern | Notes |
|---|---|---|
| **Host (dev server / service worker)** | `HostPort` built from `Environment Protocol v1` JSON; `FsPort` over HTTP form POST; runtime over `MessageChannel` | Protocol versions unchanged. Core must not know host type or project id — it only knows URLs (`editor/src/environment.ts`). |
| **Host Fs HTTP** | `FsPort` (`readFile`/`writeFile`/`writeMultiFiles`/`readdir`/`mkdir`/`moveFile`/`deleteFile`) | Path safety lives in the *host* (`fsApi.ts:12-25`, `vite-plugin-mota-server.ts:14-28`); core only concatenates relative paths. Custom `FsPort` must preserve the `not-found` error signal and must reject (not swallow) write failures. |
| **Runtime iframe** | `PreviewService` + `PreviewAdapter`; Runtime Protocol v4 handshake, resource gateway with monotonic revision, 300 ms debounced hot reload | iframe never requests `/project/**` directly (asserted by e2e). Engine boot hook moves to the adapter. |
| **Engine (mota-js)** | `EngineAdapter` value imported by the composition root only | Never imported by core. Engine itself still runs only inside the preview iframe. |
| **Monaco / Blockly / Pixi** | Third-party libs used *inside* capability modules | These are library dependencies, not engine dependencies — acceptable inside core. Engine-specific *configuration* of them (language env, block schemas) comes through ports. |
| **Shared workspace libs** | `@motajs/utils`, `@motajs/react-store`, `@motajs/react-hooks`, `@motajs/react-monaco-editor`, `@motajs/theme` | Fine for core. **Not** fine: `@motajs/file2x` / `@motajs/h5animate` if they encode mota-js file formats — verify; if format-specific, they belong to the adapter and core keeps only the generic `DataHandler` abstraction. |

### 9.2 Internal boundaries

| Boundary | Communication | Notes |
|---|---|---|
| composition root ↔ runtime | direct construction | The only place with knowledge of all concretes. |
| runtime ↔ capability modules | typed handles / narrow contexts | Never the runtime object itself for external consumers. |
| capability module ↔ engine adapter | capability port (interface in core, impl in adapter) | The central seam; four of them. |
| capability module ↔ capability module | **capability registry lookups + dispatched commands** | Avoid direct imports between capabilities; use `runtime.commands.execute()` or a registered capability id. Prevents a module from becoming a de-facto kernel. |
| shell ↔ capabilities | slots + registry | Slot positions fixed; content registered. |
| resources ↔ fs | `FsPort` | Already the highest-value existing extension point. |
| data ↔ model | port hooks (pull) | Hooks return core-defined shapes; they may be reactive (`ReadonlySignal`) but must not expose engine types. |
| edits ↔ resources | `operationHistory.execute()` only | Single write path; the strongest existing invariant — preserve it verbatim. |
| extensions ↔ core | `EditorExtensionContext` + registries | Designed now, loaded never. |

---

## 10. Open Questions / Decisions Needing Confirmation

1. **Is the Blockly/event editor one of the four capabilities, part of `code-editor`, or adapter-only?** PROJECT.md names four capabilities (代码/表格/地图/素材); events are not among them, yet `blockly/*` is one of the largest engine-coupled modules. Recommendation: split — keep the generic Blockly host/session + schema→block compiler framework in `code-editor` with an injected **schema pack** registered through the same registry API (the existing `BlockRegistry.registerPack`/`registerPackJson` shape at `blockly/registry/index.ts:428,516` is a ready-made precedent), and move `blockly/project/*`, domain schemas, event field bindings, and diagnostics to the adapter. **Needs confirmation** — it materially changes the `code-editor` port.
2. **Where does `runtime.html` / `iframeEntry.ts` live after the split?** The entry is a build artifact; the engine boot hook is engine code. Recommendation: core owns `protocol.ts` + provider + gateway + surfaces; the adapter owns the boot hook; the `runtime.html` input stays in `@motajs/editor` because it is part of the editor artifact and the artifact shape must not change this milestone.
3. **Does `Json2xDataHandler` move to the adapter?** It encodes the `var <uuid> = {json}` convention, which is a mota-js file-structure assumption. Recommendation: yes — move it; core keeps `JsonDataHandler` and the generic `DataHandler` contract. **Verify** whether `@motajs/file2x` is mota-specific or a general wrapper before deciding its home.
4. **`EditorConfigService` path (`_server/config.json`) is initialized at module load.** Confirm the core service takes the path as a port/parameter and keeps the in-memory fallback behaviour identical.
5. **Do we adopt `@microsoft/api-extractor` API reports now, or at phase 11?** Recommendation: introduce the report at phase 1 (even when tiny) so growth is visible from the start; enforce it in CI from phase 11.
6. **Which shared libs are format-specific?** Audit `@motajs/file2x` and `@motajs/h5animate` before fixing core's dependency list; the constraint is "不因拆分引入不必要的运行时依赖", so the safe default is to keep format-specific libs out of core.
7. **Does the fixed shell render at all before phase 4?** Recommendation: phases 1–3 ship no user-visible change (the app still uses `Workbench`); the shell lands in phase 4 with a side-by-side comparison before deletion.

---

## 11. Sources

### First-party (HIGH confidence — read directly from this repository)

- `.planning/PROJECT.md` — scope, constraints, out-of-scope, key decisions.
- `.planning/codebase/ARCHITECTURE.md` — layered data flow, singletons, host boundary, protocol drift warning.
- `packages/apps/editor/README.md` — canonical pipeline, artifact shape, host-agnostic statement.
- `packages/apps/editor/docs/architecture-and-interfaces.md` — three communication channels, `Content<T>`, handler layering, persistence semantics, extension-point catalogue (§7), risk notes (§9).
- `packages/apps/editor/src/project/data/projectData.ts` — `ProjectDataImpl`, hardcoded paths/accessors, preload graph.
- `packages/apps/editor/src/project/resources.ts` — `computedResource` / `aggregateResource` / `optional`.
- `packages/apps/editor/src/fs/interfaces.ts` — `IContentHandler` / `IDataHandler` / `RecoverableResource`.
- `packages/apps/editor/src/services/fs/fs.ts` — `Fs` / `FsPromiseApi` (the injectable transport).
- `packages/apps/editor/src/services/editorConfig/editorConfigService.ts` — module-load singleton + in-memory fallback.
- `packages/apps/editor/src/blockly/registry/index.ts` — `BlockRegistry.register` / `registerPack` / `registerPackJson` with diagnostics + rollback (the in-repo registry precedent).
- `packages/apps/editor/src/project/model/projectModel.ts` — engine-semantic derivation layer that must become port hooks.
- `packages/apps/editor/src/Workbench/index.tsx`, `src/App.tsx` — current shell + provider composition.
- Import-graph sample over `src/**` — 90+ `projectData`/`projectModel` reach-through sites.

### External (MEDIUM where cross-checked; LOW where single-source)

- Alistair Cockburn, [Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture) — ports/adapters, inside-outside symmetry, substitutable adapters. (MEDIUM: corroborated by Thoughtworks, AWS Prescriptive Guidance, and TypeScript guides.)
- [AWS Prescriptive Guidance — Hexagonal architecture pattern](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/hexagonal-architecture.html) — port/adapter roles; explicit caveat that adapter indirection only pays off with multiple inputs/outputs or changing backends. (MEDIUM)
- [VS Code — Source Code Organization](https://github.com/microsoft/vscode/wiki/source-code-organization) — layered core, `registerSingleton` + constructor injection, `contrib` rules (no inbound deps into contrib, one `.contribution.ts`, one public API file per contribution), per-environment entry files. (MEDIUM)
- [VS Code — Contribution Points](https://code.visualstudio.com/api/references/contribution-points) and [Extension Anatomy](https://code.visualstudio.com/api/get-started/extension-anatomy) — declarative manifest contributions vs runtime `activate`, `engines.vscode` minimum version, proposed-API gating. (MEDIUM)
- [tldraw — issue #7954 "Extract framework-agnostic editor-core package from editor"](https://github.com/tldraw/tldraw/issues/7954) — file-level inventory of a pure-TS core vs React layer, `export *` re-export for zero breaking changes, prior art (`sync`/`sync-core`, `editor-controller`), ShapeUtil's residual type-level React dependency. (MEDIUM)
- [tldraw — SDK architecture](https://tldraw-tldraw.mintlify.app/advanced/architecture) and [Editor](https://tldraw.dev/sdk-features/editor) — capability arrays injected at construction, reactive store + unidirectional flow, "never mutate records directly, always go through editor methods". (MEDIUM)
- [Lexical — `lexical` package docs](https://lexical.dev/docs/packages/lexical) + [AGENTS.md](https://github.com/facebook/lexical/blob/main/AGENTS.md) — dependency-free engine + optional React package, `defineExtension` with `nodes`/`register`/`dependencies`/`config`, commands as the primary communication mechanism, all `register*` return teardown functions. (MEDIUM)
- [ProseMirror — Guide](https://prosemirror.net/docs/guide/) and [Reference](https://prosemirror.net/docs/ref/) — four required modules, all others replaceable; state/transaction/view cycle; plugins can own state slots, filter/append transactions, and declare view props with explicit precedence rules. (MEDIUM)
- [loom.js — architecture docs](https://github.com/mgravey/loom.js/blob/master/docs/architecture.md) — capability registry keyed by namespaced kind + implementation id, separation of capability registry from DI services, validate-then-activate with topological order, `initialize` → freeze → `start`. (LOW: single source, but consistent with the others.)
- [km-geoboard — typed plugin registry](https://github.com/komeilm76/km-geoboard/tree/main/packages/km-plugins) and [Building a Plugin System in TypeScript](https://letsbuildsolutions.com/blog/web-engineering/building-a-plugin-system-in-typescript-dynamic-loading-sandboxing-and-api-contracts-for-extensible-applications/) — `Result<T>` instead of throwing, no partial state, dependency/conflict/cycle checks at registration, narrow `HostContext` as the main anti-leak lever, two-phase init. (LOW)
- [Stella Ops ADR-011](https://stella-ops.org/docs/architecture/decisions/adr-011-epf-plugin-service-contract/) — manifest-declared requirements + per-consumer scoped service provider. Quoted as data (external, untrusted): DATA_k7m2vq9x_START the host root `IServiceProvider` is never passed to the plugin … it is structurally impossible for a plugin to reach beyond its declared surface because the surface is the only DI graph it sees DATA_k7m2vq9x_END. (LOW)
- [Agent Host Protocol — Versioning](https://microsoft.github.io/agent-host-protocol/specification/versioning) — handshake-time version selection modelled on WebSocket subprotocols, `UnsupportedProtocolVersion` + `supportedVersions`, additive changes must be ignorable, capability-gated → baseline progression. (MEDIUM: corroborated by AdCP and Rust RFC 1105.)
- [AdCP — Versioning](https://docs.adcontextprotocol.org/docs/reference/versioning) and [version-negotiation spec](https://github.com/adcontextprotocol/adcp/blob/main/specs/version-negotiation.md) — release-precision negotiation, build/patch as advisory-only, deprecation ≥6 months and removal only at a major. (MEDIUM)
- [Semantic Versioning 2.0.0](https://github.com/semver/semver/blob/master/semver.md) — public API must be declared; deprecate in a minor, remove in a major. (HIGH: normative spec.)
- [Rust RFC 1105 — API evolution](https://github.com/rust-lang/rfcs/blob/master/text/1105-api-evolution.md) — what counts as breaking vs admissible in a minor release; deprecation + `pub use` in preference to rename/move. (HIGH: normative for its ecosystem.)
- [zap-studio — Core + Adapters philosophy](https://deepwiki.com/zap-studio/monorepo/1.1-core-+-adapters-philosophy) — framework-agnostic core with minimal/zero runtime deps, adapter packages for framework DX, explicit package `exports`. (LOW)
- [skills-hub — package-boundary hard rules](https://github.com/kjuhwa/skills-hub/blob/main/knowledge/arch/package-boundary-hard-rules.md) and [multica PR #539](https://github.com/multica-ai/multica/pull/539) — negative-space package contracts ("zero react-dom", "zero next/* imports"), single platform folder as the only escape hatch, `StorageAdapter`/`NavigationAdapter`, proxy singletons (`registerAuthStore()`), `setApiInstance()`. (MEDIUM: two independent implementations of the same rule.)
- [Commerce Layer — Refactoring the React library: core and hooks](https://commercelayer.io/blog/frontend-components-refactoring-core-and-hooks) — extract pure functions → hooks layer → components; keep the old container as a deprecation proxy so consumers migrate at their own pace. (LOW)
- [Architecting an OTT platform for 9 platforms in one monorepo](https://dharmicdev.in/blog/ott-monorepo-8-platforms) — packages never import apps, no platform APIs in `packages/`, and the retrospective warning to build the pure core *first*. (LOW)
- [Share Everything Except the Route Tree](https://dev.to/cengizdonmez/share-everything-except-the-route-tree-a-multi-customer-monorepo-with-tanstack-router-2o5d) — `setAppConfig()` boot-time injection so core never knows which consumer it runs for. (LOW)

---

*Architecture research for: engine-agnostic, extensible editor core (`@motajs/editor-core`)*
*Researched: 2026-09-20*

