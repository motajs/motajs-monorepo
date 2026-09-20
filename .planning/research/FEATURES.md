# Feature Research

**Domain:** Engine-agnostic extensible editor core (IDE / level-editor / data-workbench hybrid) with a future plugin ecosystem
**Project:** `@motajs/editor-core` extraction from `@motajs/editor`
**Researched:** 2026-09-20
**Confidence:** MEDIUM — primary claims are grounded in official documentation (VS Code, Monaco, Tiptap/ProseMirror, Lexical, Figma, Godot) and in a direct read of the existing `@motajs/editor` source; the plugin-ecosystem recommendations rest partly on community engineering write-ups (LOW, flagged inline).

---

## How To Read This Document

This is a **subsequent-milestone** feature landscape. The milestone is explicitly a *pure refactor*: extract an engine-agnostic core that already contains four editing capabilities and a fixed layout, expose registration hooks for engine-specific data, and leave extension points for a future plugin system — **without** changing `@motajs/editor`'s external behavior or implementing plugin loading.

So "table stakes" here does **not** mean "build new user-facing features." It means **"the core cannot ship without these seams being present and correctly shaped"**, because every later capability and every third-party customization will attach to them. The unit of value is the *extension point*, not the feature.

Confidence is tagged per row:
- **[D]** = grounded in official docs / primary source (VS Code, Monaco, Tiptap, Lexical, Figma, Godot, engine docs)
- **[C]** = grounded in the existing `@motajs/editor` codebase (read directly)
- **[L]** = community/practitioner claim, LOW confidence, verify before committing

---

## Feature Landscape

### Table Stakes — Core Shell & Infrastructure

Users (and adopters/plugin authors) assume these exist. Missing one means the core is not a core.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Fixed workbench shell** (top bar + workspace surfaces + panel slots) | The milestone mandates a fixed internal layout; every editor surface needs a host region to mount into | MEDIUM | Existing `Workbench/index.tsx` + `PanelSlot` + `WorkspaceSurface` ([C]). Keep fixed; do **not** build a docking system (see anti-features). Godot's `EditorPlugin.add_dock()` shows dock points are the extensibility surface, not user-resizable layout ([D]). |
| **Workspace / panel activation model** | Users navigate between the four capabilities; only active panels mount (perf + runtime isolation) | LOW | Existing `PanelStore` (`activeWorkspace: "map" \| "resources" \| "tower" \| "common-events" \| "scripts"`) with a legacy-compat projection ([C]). Generalize the IDs into a registry rather than a hardcoded union. |
| **Command registry + dispatch** | One action definition must drive menu, keybinding, toolbar, and programmatic invocation — otherwise every surface grows its own dispatch | MEDIUM | Every mature editor centralizes this: VS Code contribution points auto-emit `onCommand:` activation ([D]); JupyterLab routes *all* user actions through one command system feeding menu/shortcuts/palette ([D]); Tiptap aggregates extension commands with override-by-name, plus `chain()` and `can()` dry-run ([D]). This is the single most important core primitive. |
| **Undo/redo history** (inverse operations, capacity bound) | Editing without undo is unusable; it must be shared across all four capabilities | HIGH | Existing `project/history` uses inverse operations with capacity 100 ([C]). Confirm the core-level contract: command = `do`/`inverse`, coalescing for continuous gestures (paint/drag), and a `transaction` wrapper for multi-command edits. CKEditor batches operations and supports selective revert ([D]). |
| **Reactive resource layer** (`Content<T>` + signals, memory-first, eventually-consistent persistence) | Async data must flow to React without bespoke per-feature loading code | HIGH | Existing `project/resources.ts` (`ComputedResource`, `aggregateResource`, `optional`) + `fs` `FileHandler`/`FileHandlerManager` with per-path singleton + load lock ([C]). Core must keep the *abstraction* but drop all path/format knowledge. |
| **Persistence orchestration & dirty tracking** (delegate actual IO) | Users must never silently lose work; the host owns IO | HIGH | Existing `PersistenceMonitor` / `PersistExecutor` / `PersistenceNotification` + draft guard ([C]). Core extracts the *scheduler/status* contract; the adapter supplies write/read. |
| **Registration hooks / engine-adapter boundary** (core never reads files) | The explicit core requirement: engine data is injected, not discovered | HIGH | **The keystone feature of this milestone.** Model on extension-point registries: Godot `EditorPlugin` + `add_dock()`/`_enter_tree()`/`_exit_tree()` lifecycle ([D]); Tiptap `ExtensionManager` resolving/validating/sorting contributions ([D]); plugin registries that validate each extension implements its declared extension point and order by explicit priority ([L]). |
| **Recovery boundaries per panel** (loading / not-found / parse-error / IO-error) | Partial failures must not take down the shell | MEDIUM | Existing `ContentBoundary` with `LoadingRecovery`/`NotFoundRecovery`/`ParseErrorRecovery`/`IOErrorRecovery` + `PanelErrorBoundary` + `PanelSlot`'s "missing resource, can restore via undo" affordance ([C]). Keep and generalize. |
| **Notifications / error surfacing** | Async persistence and migrations need user-visible outcomes | LOW | Existing `utils/notify` ([C]). |
| **Keyboard shortcut registry** | Desktop-editor expectations (map sub-panels currently use Z/X/C/V) | LOW/MEDIUM | Existing per-panel shortcut hints ([C]); Monaco has its own keybinding system for the code surface ([D]). Must reconcile core shortcuts vs. editor-internal keybindings to avoid conflicts. |
| **Theme / dark-mode / design-system integration** | Hosts and users expect consistent chrome | LOW/MEDIUM | Existing antd + Semi UI + PandaCSS + CSS modules ([C], PROJECT). Reuse; do not invent a token system. |
| **Selection model shared across surfaces** | Map selection, table row selection, asset selection must be able to inform each other and the properties panel | MEDIUM | Godot/Unity-style editors keep a central selection/context object (`EditorContext`/`EditorUiState`) passed to all panels ([D]). Existing editor has `EditorStore`/`MapEditorStore` ([C]) — unify into a core selection service. |
| **Headless-first, host-agnostic packaging** | Core must be mountable by editor, future `editor-next`, and third parties | MEDIUM | Core is host-agnostic already at the app level (env JSON + HTTP fs + MessageChannel) ([C], PROJECT). Enforce with a dependency-direction lint: core must not import host/engine. |

### Table Stakes — The Four Built-in Editing Capabilities

These ship in core per the milestone decision. Each must be **generic** (no mota-js assumptions) while preserving the existing implementation's behavior.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Code editing surface** | Authors write scripts; code is a first-class artifact | MEDIUM | Existing: Monaco via `react-monaco-editor`, `CodeEditor`, `ScriptsWorkspace`, `monacoPreload`, lazy loading ([C]). Core should own: model/document registry keyed by an engine-supplied ID, language-provided (adapter supplies language + diagnostics), dirty/save lifecycle, and an editor-action/keybinding contribution seam. Monaco's extension surface for reference: `registerCommand`, `addKeybindingRule(s)`, `addAction` with `precondition`/`contextMenuGroupId`, `registerEditorOpener`, language registration, view zones/decorations/overlays ([D]). Do **not** fork Monaco. |
| **Schema-driven table / data-config editing** | The dominant authoring activity is editing structured config | HIGH | Existing: `components/SchemaTable` + `components/Table` (`builtinSchemas`, `schema.ts`, `normalizers`, `expression`, `CollectionControl`, field editors `PassabilityFieldEditor`, `FloorImagesFieldEditor`, `BgmListFieldEditor`, `AutoEventListFieldEditor`, `ImageAssetPickerModal`, `externalEditor`) ([C]). Generalize to a **field-editor registry** with named lookup + fallback + layered override precedence (RJSF Registry is the canonical model: field-level `ui:field` → `ui:widget` → form-level maps → theme → core default) ([D]). Keep per-column `type`, `readOnly`, cross-field constraints, and cell vs. edit-cell separation ([L]). The schema itself must be supplied by the adapter. |
| **Map editing surface** | Core product value for a tile/level game | HIGH | Existing: `MapEditor` with `MapCanvas`, `ToolBar`, layer settings, `MaterialPanel`, `RecentlyUsedPanel`, `ContextMenu`, `EventOverlay`, `RowColMarks`, PixiJS rendering, `useFloorNavigation`, `MapEditorStore` ([C]). Core must abstract: grid coordinate model, layer model, paint/erase/fill/select tools, tile catalog injection, passability overlay, and an event/marker overlay hook. Reference level-editor feature set from Unity/Godot tools: block library/palette, multi-cell footprints, range select, rotate, copy/paste, per-level undo/redo, context menu, zoom/pan, "no space" feedback, runtime generator seam ([D] Unity grid editor, Godot Cyclops uses commands + tool classes + docks) ([D]). |
| **Asset management** | Maps and tables reference images/animation/material; authors must browse and pick | MEDIUM/HIGH | Existing: `ResourcesWorkspace`, `AppendPicPanel`, `services/icons`, `useImageAssetUrl`, `MaterialCatalog`, `ProjectImageCatalog` ([C]). Core must own: an asset *catalog* interface (adapter supplies entries), grid/list views, type filter, search, thumbnails with fallback, drag-to-assign, and reference lookup. Canonical feature set from engine asset browsers: type filters, name/path/GUID search, thumbnail or type icon fallback, folder tree + breadcrumbs, tags, reference queries (`ref` / `ref-all`), import/export with dependencies, context menu, grid/list toggle ([D] PlayCanvas, ezEngine, Blender, Entangle). |

### Differentiators — Where This Core Competes

Not required for a plugin system to exist, but these are what make `editor-core` worth adopting instead of forking the editor.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **A single, versioned engine-adapter contract** | The core value from PROJECT.md: new engines add features without touching core; plugin authors target one stable surface | HIGH | Model: a narrow `HostContext`/`EditorExtensionContext` exposing only what adapters need, never the whole app object ([L]). Publish extension *points* (interfaces) and let contributions register implementations, validated at registration ([L], Firefly pattern). Prefer named hooks/phases over positional insertion. **Write down what each hook guarantees** — a phase name is a promise ([L]). |
| **Static declaration + imperative binding (VS Code split)** | Lets a future plugin manifest be declarative (for discovery/permissions) while implementation binds at activation | MEDIUM/HIGH | VS Code: JSON `contributes` + runtime `registerCommand`/`registerView` bound by matching ID, plus activation events for lazy load ([D]). Adopt the *shape* now (contribution descriptors are plain data; implementations register separately) so a loader can be added later without reshaping the API. |
| **Four capabilities composed from one primitive set** | Commands + history + resources + selection shared across code/table/map/asset means a plugin can extend all four uniformly | HIGH | This is the main architectural differentiator vs. bolting four independent mini-editors together. Existing editor already shares command/history/resource layers ([C]) — make that sharing explicit and public. |
| **Field-editor / widget registry with layered precedence** | Lets engine adapters and (later) plugins add cell types without editing core | MEDIUM/HIGH | RJSF's registry precedence table is the model to copy ([D]); OpenG2P's named-widget lookup with fallback and no core modification is the plugin-facing shape ([D]). Directly generalizes existing `builtinSchemas` + field editors ([C]). |
| **Tool/plugin hooks inside the map editor** | Level editors live or die on custom tools (Godot's `Tool` classes, Cyclops' command-based tools) | HIGH | Expose: tool activation/deactivation, `_draw_tool`-equivalent overlay rendering, input interception with explicit "do not consume unneeded events", and command commit points ([D]). |
| **Persistence protocol abstraction** | Core works with file-based hosts, in-memory hosts, and tests without a real FS | HIGH | The existing `vite-plugin-mota-server` vs Service Worker host split already proves two hosts ([C]). Keep the core's only dependency a host-provided read/write/notify interface. |
| **Draft guard / unsaved-change protection** | Prevents data loss during navigation and unload | MEDIUM | Existing `Workbench/draftGuard.ts` + beforeunload handler ([C]). Generalize into core (per-document dirty registry) so new editors inherit it. |
| **First-class diagnostics/reference model** | Reference lookups and diagnostics are what make large config sets navigable | MEDIUM | Existing `floorDiagnostics`, `locDiagnostics`, `towerDiagnostics`, `floorCoordinateReferences` ([C]). Canonical asset-browser analog is `ref:` / `ref-all:` queries ([D]). This is a strong differentiator if exposed as a core service plugins can contribute findings to. |
| **Explicit re-entrancy/save-status surface** | Users trust the editor when they can see what is saved and what is pending | MEDIUM | Existing `PersistenceNotification` + `statusBarModel` ([C]). Expose as a core contribution point so adapters/plugins can add save indicators. |
| **Capability declaration + type-only extension seam** | Lets a future plugin system gate API access by declared capability (Figma `capabilities`, allowlisted `networkAccess`) | MEDIUM | Figma gates `textreview`/`codegen`/`inspect` behind manifest `capabilities` ([D]). Even without a loader, define the capability enum now so the surface does not need breaking changes later. |
| **Two-phase init contract for future plugins** (all `setup()`, then all `ready()`) | Avoids order-dependent breakage when plugin A emits during setup before B subscribed | MEDIUM | Recommended explicitly for plugin hosts; load order becomes a documented guarantee instead of an accident ([L]). Cheap to bake into the registration lifecycle now. |

### Anti-Features — Deliberately Do NOT Build

These are plausible requests that would break the milestone's focus, the "pure refactor / behavior unchanged" constraint, or the core's engine-agnostic boundary.

| Anti-Feature | Why Requested (Surface Appeal) | Why Problematic | Alternative |
|--------------|-------------------------------|-----------------|-------------|
| **Plugin loading / registration / lifecycle mechanism** | The stated end goal is a plugin ecosystem | Explicitly out of scope this milestone; building the loader before the extension points are proven locks in a premature contract | Leave **extension points + contribution descriptor shapes only**; add the loader in a later milestone against a frozen seam |
| **Layout customization / docking / drag-reorder** | Users ask for it in every editor; it looks like flexibility | Explicitly rejected in PROJECT.md (high cost, low benefit); docking also expands every panel's state surface | Fixed shell + named mount points; revisit only if first-party demand is proven |
| **Core reads files or assumes engine file structure** | Simpler implementation; core could just parse the game project | Violates the core constraint and is the #1 way to re-couple to mota-js | All data injected through registered hooks; adapter owns paths/format |
| **Writing a code editor / rich-text engine from scratch** | Full control; no heavy dependencies | Enormous, solved problem; Monaco is already integrated and versioned as its API surface ([D]) | Keep Monaco; define a thin core document/command seam over it |
| **Generic IDE features: terminal, debugger, LSP host, multi-root workspaces** | "Become VS Code" | No consumer for them in a game data/level workbench; massive surface, zero differentiation | Defer/ignore; the code surface only needs syntax + save/dirty |
| **Real-time collaboration / CRDT** | Modern editors have it | Adds conflict-resolution and presence complexity; none of the four capabilities need it now; Lexical/ProseMirror-style double-buffered state models assume it and would distort the core | Design history as inverse commands with per-document scopes; layer collaboration later only if required |
| **Sandboxed / VM / worker-isolated plugins** | Security for untrusted third-party code | Premature. Figma needed a Realms/Duktape sandbox + iframe split precisely because it runs *arbitrary* third-party code on the main thread ([D]); the current milestone has no loader and only first-party adapters | In-process modules with narrow context now; choose isolation level when the threat model exists ([L]) |
| **Marketplace / gallery / plugin discovery** | Ecosystem growth | Requires a loader, signing, trust tiers, version solving — all downstream of a stable API | Do nothing until the extension points survive real use |
| **Version/compat solving for extension APIs now** | Avoid future breakage | There is exactly one consumer (the adapter); a semver gate with no second consumer is speculative | Declare an `apiVersion` constant on the context; enforce later |
| **Arbitrary user-defined workspaces/tabs (unbounded view registration)** | "Let plugins add panels anywhere" | VS Code constrains UI to declared contribution points precisely to keep the DOM stable ([D]); unbounded registration makes the fixed shell meaningless | A small, named set of contribution points (workspace surface, side panel, toolbar action, command, cell editor, map tool, asset action) |
| **Core-owned data migration of engine formats** | Convenient to normalize on load | Migration is inherently engine/format-specific and violates the boundary | Keep migrations adapter-side (existing `project/migrations` stays in `editor`) ([C]) |
| **Runtime script execution / hot reload / preview engine** | Preview is a nice editor feature | Preview belongs to the host/runtime protocol, already separate (`runtime/`, Runtime Protocol v4) ([C], PROJECT) | Keep the core's preview seam declarative; host executes |
| **A new theme/token system** | Consistency | The project already commits to antd + Semi UI + PandaCSS + CSS modules ([C], PROJECT) | Reuse; contribute no second styling paradigm |
| **Emitting live editor state to plugins synchronously on every keystroke** | "Plugins need full awareness" | Creates cost and coupling; Lexical's command/listener priority model shows the cost of an unbounded listener surface ([D]) | Event-bus/command-dispatch only; plugins subscribe to named events, and core stays unaware of them ([L]) |

---

## Feature Dependencies

```
[Registration hooks / adapter contract]
    └──requires──> [Command registry]
    └──requires──> [Reactive resource layer]
    └──requires──> [Persistence protocol abstraction]
                        └──requires──> [Host-provided IO interface]

[Fixed workbench shell]
    └──requires──> [Workspace/panel activation model]
    └──requires──> [Contribution/extension points]

[Undo/redo history]
    └──requires──> [Command registry]

[Code editing surface]   ──requires──> [Document/editor registry] + [Command registry]
[Table editing surface]  ──requires──> [Field-editor registry] + [Command registry] + [Asset catalog]
[Map editing surface]    ──requires──> [Tool/overlay hooks] + [Asset catalog] + [Command registry]
[Asset management]       ──requires──> [Asset catalog interface + reference service]

[Shared selection model] ──enhances──> [Map] , [Table] , [Asset]
[Field-editor registry]  ──enhances──> [Table editing surface]
[Tool/overlay hooks]     ──enhances──> [Map editing surface]
[Save/dirty status surface] ──enhances──> all four surfaces
[Diagnostics/reference model] ──enhances──> [Asset management] , [Table]
[Capability declaration] ──enhances──> [Registration hooks]   (constrains future plugin API)

[Layout customization]   ──conflicts──> [Fixed workbench shell]
[Plugin loader]          ──conflicts──> [Pure-refactor "behavior unchanged" constraint]  (deferred)
[Core file reading]      ──conflicts──> [Registration hooks / engine-agnostic boundary]
```

### Dependency Notes

- **Registration hooks require command + resource + persistence abstractions:** the hooks are the *injection* surface; without a command registry and a host-provided persistence interface there is nothing meaningful for an adapter to register into.
- **Undo/redo requires the command registry:** history is a stack of commands with inverses. If commands are not the single mutation path, history is per-feature and cannot cover cross-surface edits.
- **Table editing requires the asset catalog:** existing field editors already open an image picker (`ImageAssetPickerModal`, `FloorImagesFieldEditor`) ([C]); the catalog must exist before the table surface is fully generic.
- **Map editing requires tool/overlay hooks:** the existing map already has toolbar tools, overlays, and a material panel ([C]); these become registered contributions rather than hardcoded children.
- **Field-editor registry enhances (not gates) the table surface:** the table can ship with built-ins first; the registry is what makes it extensible.
- **Layout customization conflicts with the fixed shell** — this is the explicit trade-off in PROJECT.md. Do not partially open it.
- **A plugin loader conflicts with the pure-refactor constraint** — the descriptor *shapes* can be designed now, but no loading code ships this milestone.

---

## MVP Definition

"Launch" here = the `editor-core` extraction milestone.

### Launch With (v1 — this milestone)

- [ ] **Fixed workbench shell + workspace/panel activation** — the milestone's stated fixed layout
- [ ] **Command registry + dispatch** — every surface and every future plugin needs one mutation path
- [ ] **Undo/redo history over commands** — behavior-preserving extraction of existing history
- [ ] **Reactive resource layer + persistence protocol abstraction** — memory-first, host-supplied IO
- [ ] **Registration hooks / engine-adapter contract** — the keystone; four capabilities receive data only through these
- [ ] **All four editing surfaces extracted and generic** (code, table, map, asset) — the milestone's explicit scope
- [ ] **Field-editor registry** for the table surface — needed to keep mota-js schemas out of core
- [ ] **Asset catalog interface + thumbnails + picker** — required by both map and table
- [ ] **Recovery boundaries + notifications + draft guard** — behavior-preserving extraction
- [ ] **Shared selection model** — prevents four divergent selection implementations
- [ ] **Contribution descriptor shapes + capability enum** — extension points only, no loader

### Add After Validation (v1.x)

- [ ] **Plugin loader / activation lifecycle** — the next milestone, once the seam has survived the `editor` + future `editor-next` adapters
- [ ] **Two-phase init (`setup()` then `ready()`)** — only meaningful once multiple plugins load together
- [ ] **Extension-point version/capability enforcement** — when there is a second consumer
- [ ] **Additional capability packs** (e.g. event/Blockly editor) — attach to the same hooks ([C] existing `blockly/`)

### Future Consideration (v2+)

- [ ] **Layout customization / docking** — only if first-party demand outweighs cost
- [ ] **Sandboxed/worker plugin isolation** — only with an untrusted-code threat model
- [ ] **Plugin marketplace/gallery + trust tiers** — downstream of a stable API and loader
- [ ] **Collaboration/CRDT** — only if a real multi-user requirement appears
- [ ] **Third-party editor surfaces beyond the four** — validates whether "extensible core" truly holds

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Registration hooks / adapter contract | HIGH | HIGH | P1 |
| Command registry + dispatch | HIGH | MEDIUM | P1 |
| Undo/redo over commands | HIGH | HIGH | P1 |
| Reactive resources + persistence abstraction | HIGH | HIGH | P1 |
| Fixed shell + panel activation | HIGH | LOW/MEDIUM | P1 |
| Map editing surface (generic) | HIGH | HIGH | P1 |
| Table editing surface + field-editor registry | HIGH | HIGH | P1 |
| Asset management + catalog interface | HIGH | MEDIUM/HIGH | P1 |
| Code editing surface (Monaco seam) | MEDIUM/HIGH | MEDIUM | P1 |
| Recovery boundaries + draft guard + notifications | MEDIUM/HIGH | MEDIUM | P1 |
| Shared selection model | MEDIUM/HIGH | MEDIUM | P2 |
| Contribution descriptor shapes + capability enum | MEDIUM (future) | LOW/MEDIUM | P2 |
| Diagnostics/reference service | MEDIUM | MEDIUM | P2 |
| Tool/overlay hooks in map | MEDIUM | HIGH | P2 |
| Save/dirty status contribution point | MEDIUM | LOW | P2 |
| Keyboard shortcut registry unification | MEDIUM | LOW/MEDIUM | P2 |
| Two-phase init contract | LOW now | LOW | P3 |
| Plugin loader | HIGH later | HIGH | P3 (next milestone) |
| Layout customization / docking | LOW/MEDIUM | HIGH | P3 (likely never) |
| Sandboxed plugin isolation | LOW now | VERY HIGH | P3 (contingent) |
| Marketplace | LOW now | VERY HIGH | P3 (contingent) |

**Priority key:** P1 = required for the extraction milestone; P2 = should have, add when possible; P3 = future consideration.

---

## Competitor / Reference Feature Analysis

| Feature / Concern | VS Code | Tiptap / ProseMirror · Lexical | Figma | Godot / Unity / Engine editors | Our Approach |
|---|---|---|---|---|---|
| **Extension declaration** | Static `contributes` in `package.json` + runtime `register*` API bound by ID ([D]) | `extensions: [...]` array of Extension/Node/Mark instances; Lexical `defineExtension`/`configExtension` ([D]) | `manifest.json` (id, api, editorType, capabilities, networkAccess) ([D]) | `plugin.cfg` + `EditorPlugin` subclass; Unity editor windows ([D]) | Static contribution descriptors + imperative registration at a documented activation point; no loader this milestone |
| **Ordering / composition** | Activation events + contribution points | Priority ordering (default 100); later same-named commands override; `.extend()`/`.configure()` ([D]) | Capabilities gate API surface ([D]) | Explicit plugin enable/disable; sub-plugins hidden from list ([D]) | Explicit `priority` per contribution, override-by-id, `extend`-without-fork |
| **UI extension surface** | Commands, menus, views/containers, custom editors, webviews; no DOM access, Extension Host process ([D]) | Node/Mark views, decorations, keyboard shortcuts, toolbars composed by app ([D]) | `showUI()` iframe + message passing; main-thread sandbox has no browser APIs ([D]) | Docks, toolbar buttons, custom node types, tool classes, inspector slots ([D]) | Fixed shell with named contribution points: workspace surface, side panel, toolbar action, cell editor, map tool, asset action |
| **Lifecycle** | `activate()` / `deactivate()`; `context.subscriptions` disposables ([D]) | `onBeforeCreate`→`onCreate`→`onUpdate`/`onTransaction`→`onDestroy` ([D]) | `figma.on('run')`; plugin runs only on explicit user action ([D]) | `_enter_tree()` / `_exit_tree()` ([D]) | Explicit register/activate/dispose with Disposable return values; adapter lifecycle owned by core |
| **Commands / actions** | Central contribution point; auto activation event ([D]) | `addCommands` aggregated; `chain()`/`can()` dry-run ([D]) | Plugin `menu` submenu + `figma.command` ([D]) | Toolbar buttons → tool classes → commands with `do_it`/`undo_it` ([D]) | One command registry; commands carry inverse for history; `can`-style precondition checks |
| **History / undo** | Workbench-level undo/redo | Editor-state transactions | Node-level (Figma core) | Commands are the only thing touching nodes; `add_to_undo_manager` ([D]) | Inverse-command history in core; coalescing for drag/paint gestures; core never touches engine nodes directly |
| **Data/schema editing** | Settings/JSON with schema validation | Node attributes + JSON/YAML/Markdown serialization ([D]) | Plugin-defined UI over scene | Unity `ScriptableObject` + custom editor windows; Godot `Resource` + property index ([D]) | Schema-driven table with field-editor registry (RJSF-style precedence) ([D]) + adapter-supplied schemas |
| **Asset browsing** | Explorer + custom views | n/a | Assets/libraries | PlayCanvas/ezEngine/Blender: type filter, name/path/GUID search, tags, `ref`/`ref-all`, import/export with deps, grid/list ([D]) | Catalog interface + grid/list + type filter + search + thumbnails + reference queries; core owns none of the storage |
| **Isolation model** | Extension Host process, no DOM ([D]) | In-process extensions | Realms/Duktape sandbox for scene access + iframe for browser APIs ([D]) | In-process GDScript plugins ([D]) | In-process, narrow context; isolation deferred until a threat model exists |

---

## Gaps & Open Questions

- **No direct competitor named "motajs".** The domain has no obvious existing OSS editor core to benchmark against; the closest analogs are tile/level editors (Godot plugins) and data workbenches. Treat the comparison table as analogical, not apples-to-apples. (Confidence: LOW)
- **Whether the field-editor registry should be core or fully adapter-provided.** Research supports a registry *mechanism* in core with *types* supplied by the adapter; the line between "built-in primitive field types" and "engine-supplied types" is a design decision for the roadmap/planning phase.
- **How much of Monaco's own command/keybinding system should be surfaced through the core command registry.** Monaco has an independent command/keybinding/context-key system ([D]); reconciling two command systems is a known source of shortcut conflicts and needs a concrete decision.
- **Contribution descriptor serializability.** If future plugins declare contributions statically (VS Code-style), that descriptor must be plain, serializable data. The *shape* should be constrained now, but no source confirms this is required for mota-js's intended plugin model. (Unknown)
- **Shape of the map tool hook.** Godot's tool model (`_activate`/`_deactivate`/`_draw_tool`/`_gui_input`, "don't consume unneeded events") is a strong reference ([D]) but adapting it to the existing PixiJS/`MapEditorStore` structure ([C]) is unproven.
- **Whether selection should be one model or four cooperating models.** A single shared selection is cleaner but may fight the existing per-surface stores (`EditorStore`, `MapEditorStore`, `PanelStore`) ([C]).

---

## Sources

**Primary / official (HIGH–MEDIUM confidence)**
- VS Code — Extension Manifest, Contribution Points, Activation Events, Extension Anatomy, Extension Capabilities Overview, Extension Host/process model: https://code.visualstudio.com/api/references/extension-manifest, https://code.visualstudio.com/api/references/contribution-points, https://code.visualstudio.com/api/references/activation-events, https://code.visualstudio.com/api/extension-capabilities/overview
- Monaco Editor — API (`registerCommand`, `addKeybindingRule(s)`, `addAction`/`IActionDescriptor`, `registerEditorOpener`, `IStandaloneCodeEditor` events, language registration): https://microsoft.github.io/monaco-editor/typedoc/
- Tiptap — Extension API, Extensions core concepts, Extension System (priority, ExtensionManager, schema/commands/plugins/node views, lifecycle hooks): https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/extension, https://tiptap.dev/docs/editor/core-concepts/extensions
- Lexical — Extensions intro, Editor State, Nodes, Commands (priority ordering), `LexicalEditor.ts` listener/command registration: https://lexical.dev/docs/extensions/intro, https://lexical.dev/docs/concepts/editor-state, https://lexical.dev/docs/concepts/nodes, https://lexical.dev/docs/concepts/commands
- Figma — Plugin Manifest, How Plugins Run (sandbox model), Creating a User Interface, Plugin API reference, "How we built the Figma plugin system": https://developers.figma.com/docs/plugins/manifest/, https://developers.figma.com/docs/plugins/how-plugins-run/, https://www.figma.com/blog/how-we-built-the-figma-plugin-system/
- Godot — Making plugins (`plugin.cfg`, `EditorPlugin`, docks, sub-plugins, `_enter_tree`/`_exit_tree`): https://docs.godotengine.org/en/stable/tutorials/plugins/editor/making_plugins.html
- Cyclops Level Builder (Godot) — command/tool/dock architecture design doc: https://github.com/blackears/cyclopsLevelBuilder/blob/master/doc/design.md
- Unity Grid Level Editor — block library/palette, multi-cell footprints, range select, rotate, copy/paste, per-level undo/redo, context menu, zoom/pan, runtime generator seam: https://github.com/SinlessDevil/UnityGridLevelEditor
- RJSF — Registry pattern (fields/widgets/templates/utilities, layered override precedence): https://deepwiki.com/rjsf-team/react-jsonschema-form/2.3-registry-pattern
- OpenG2P Registry widget library — widget registry, Sections→Panels→Widgets, validation, conditional logic, editable tables: https://github.com/OpenG2P/openg2p-registry-gen2-ui-widgets
- JupyterLab — centralized command system + command palette: https://jupyterlab.readthedocs.io/en/4.0.x/user/commands.html
- CKEditor 5 — Undo/Redo batching and selective revert: https://ckeditor.com/docs/ckeditor5/latest/features/undo-redo.html
- PlayCanvas — Assets Panel (filters, regex search, tags, references, copy/paste with dependencies): https://developer.playcanvas.com/user-manual/editor/assets/asset-panel/
- ezEngine — Asset Browser (search keywords, `ref`/`ref-all`, type filter, transform, export with dependencies): https://ezengine.net/pages/docs/assets/asset-browser.html
- Blender — Asset Browser (catalogs, tags, previews, import methods): https://docs.blender.org/manual/en/4.4/editors/asset_browser.html
- Entangle UI — AssetBrowser (grid/list, folder tree, breadcrumbs, virtualization, search/filter/sort, drag intent, thumbnail precedence): https://www.entangle-ui.dev/components/editor/asset-browser/

**Secondary / community (LOW confidence — flagged inline)**
- Microkernel/plugin architecture guide (extension points, registry, lifecycle, hook isolation, isolation-model comparison table): https://topictrick.com/blog/microkernel-architecture-plugin-system
- "How to design a plugin system for your project" (named phases, structural identity across package boundaries, load-time validation): https://jescalada.com/blog/2026-08-24-how-to-design-plugin-system-your-project/
- "Building a Plugin System in TypeScript" (narrow `HostContext`, load-time schema validation, lifecycle state machine, two-phase init, timeouts, capability detection): https://letsbuildsolutions.com/blog/web-engineering/building-a-plugin-system-in-typescript-dynamic-loading-sandboxing-and-api-contracts-for-extensible-applications/
- "Building Plugins That Last" (SOLID/ISP/DIP, event bus vs. direct calls, additive versioning): https://jefersondepaula.com/plugin-architecture-best-practices/
- xNet plugin docs (manifest + `activate(ctx)` + Disposable subscriptions + contribution registration + trust tiers): https://xnet.fyi/docs/guides/plugins/
- fireflyframework-plugins (extension points, priority-ordered registry, dependency topological sort): https://github.com/fireflyframework/fireflyframework-plugins
- reaktiform (column defs, per-row `readOnly`, cross-field constraints, computed columns, undo/redo): https://github.com/suryabaskaran15/reaktiform
- cern-sis/react-formule (schema→ColDef inference, custom cell editors/suggesters): https://github.com/cern-sis/react-formule

**Internal (HIGH confidence — read directly)**
- `E:/github/motajs-monorepo/.planning/PROJECT.md`
- `packages/apps/editor/src/Workbench/index.tsx`, `Workbench/components/PanelSlot.tsx`
- `packages/apps/editor/src/stores/PanelStore.ts`
- `packages/apps/editor/src/project/resources.ts`, `project/index.ts`
- `packages/apps/editor/src/fs/FileHandlerManager.ts`
- `packages/apps/editor/src/services/{tower,floor,enemy,item,functions,mapBlock,prefab,tableMeta,plugins,commonEvent,editorConfig,fs,icons}/index.ts`
- `packages/apps/editor/src/components/{SchemaTable,Table,GridCanvas,ContentBoundary}/`, `packages/apps/editor/src/MapEditor/`, `packages/apps/editor/src/Workbench/{CodeEditor,ScriptsWorkspace,ResourcesWorkspace}/`

---

*Feature research for: engine-agnostic extensible editor core*
*Researched: 2026-09-20*
