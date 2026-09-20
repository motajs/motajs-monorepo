# Project Research Summary

**Project:** motajs-monorepo — extracting `@motajs/editor-core` from `@motajs/editor`
**Milestone:** `extract @motajs/editor-core from @motajs/editor` (pure refactor, behavior parity)
**Domain:** Engine-agnostic, extensible editor core (IDE / level-editor / data-workbench hybrid) in a React 19 + Vite 7 pnpm monorepo
**Researched:** 2026-09-20
**Confidence:** MEDIUM-HIGH overall (repo-derived claims HIGH; external pattern claims MEDIUM; plugin-ecosystem claims LOW by design, deferred)

---

## Executive Summary

This milestone is **not a feature milestone — it is a packaging and boundary milestone.** The product is a fixed-layout, engine-agnostic editor core (`@motajs/editor-core`) containing four built-in editing capabilities (code / table / map / asset), where all engine-specific data (file paths, formats, semantics, model derivations) is injected through a registered hook contract. The research is unambiguous that the correct shape is a **hexagonal (ports-and-adapters) core with a per-instance runtime object, a single composition root, a public capability registry, and a mota-js adapter that implements ports core owns**. Three independent prior-art systems confirm the split — tldraw extracted `@tldraw/editor-core` from `@tldraw/editor` and had the React package re-export it for zero breakage; Lexical ships a dependency-free engine plus a framework-neutral extension API plus a separate React binding; ProseMirror ships four required modules and treats everything else as replaceable. All three get extensibility from **plain TypeScript interfaces, `Map`-backed registries, and array/constructor registration — no DI container, no hook bus, no event-emitter library.** The headline stack recommendation follows directly: **add zero new runtime dependencies this milestone.**

The single largest divergence between the four research files is **how the core is named and how registration failures are handled**, and it is resolved here into one answer (see "Cross-Dimension Divergences Resolved"). The type is `EditorCore` with a `createEditorCore(config)` factory (ARCHITECTURE.md's `EditorRuntime` is the same object — a descriptive synonym, not a second concept); registration APIs return diagnostics and roll back partial state (mirroring the in-repo `BlockRegistry.registerPack` contract), while `createEditorCore()` itself aggregates all diagnostics and fails startup loudly rather than coming up half-registered. The second divergence is **directory convention**: `packages/libs/*` MUST use `lib/`, not `src/` — `packages/libs/config/resolvePlugin.js` and `tsconfig.lib.base.json` hard-code it, and one STACK.md example that says `src/**` is wrong. The third is **capability build order**: table → code → asset → map, with the *asset catalog port* defined up front so the table's image pickers are never hardcoded (this reconciles FEATURES.md's "table requires the asset catalog" with ARCHITECTURE.md's "assets are third").

The dominant risk is **verification, not architecture.** The repo currently has no PR CI, no editor `typecheck` script, e2e that never runs in CI and is conditionally skipped, and unit tests that cannot even start without the `packages/external/mota-js` submodule initialized (the Vite config throws at load). A refactor of this size can therefore be declared "tested" while the only end-to-end write-path test never executed. Research is unanimous that **phase 1 must build the verification net before a single file moves**: initialize the submodule, record a quantified baseline (unit suites, e2e, production build, bundle sizes, `editor-manifest.json`, visual screenshots), add PR CI running lint + per-package typecheck + unit tests + build, and write characterization tests for the two contracts most likely to break silently — `PersistExecutor`/`PersistenceMonitor` semantics and `operationHistory` inverse-operation semantics. Secondary risks are silent-failure classes that produce no compile error: **PandaCSS emitting no styles for a package outside the app's `include` glob**, and **React Compiler silently not memoising files outside its filter**. Both need an explicit probe in the boundary phase, not a hope.

Finally, the milestone's value is in its **seams**, not its features. The four blocks moving is mechanical; the `registerCapability` primitive, the `EditorExtension` descriptor shape, the four capability ports, and the `apiVersion` constant are what `editor-next` and third parties will live with. Research is equally forceful about the mirror risk: designing a general plugin API for an imagined ecosystem with one engine and no loader produces speculative interfaces that calcify. The rule that resolves this is concrete — **no extension point ships without a second concrete implementation (the fake "engine B" adapter fixture) exercising it end to end**, and no hook ships with zero current callers.

---

## Key Findings

### Recommended Stack

**Add no runtime dependencies. Add catalog dev/quality gates only.** The extension mechanism is a ~80-line hand-rolled typed registry; DI is React Context plus `useSyncExternalStore`; contract validation at registration is a hand-written `assertDescriptor()`. This is not a compromise — it is what tldraw, Lexical, and ProseMirror all actually do.

**Core technologies (pin, do not move):**
- **TypeScript 5.9.3** — `typescript-eslint@8.70.0` peer-caps at `<6.1.0`; npm `latest` is 7.0.2 (native/Go compiler line). Upgrading mid-refactor makes lint failures indistinguishable from refactor regressions.
- **React / React DOM 19.2.3** — `useSyncExternalStore` is the sanctioned external-store bridge and is **mandatory** for the signal bridge (prevents tearing when a non-React store mutates mid-render); `use()` reads context. 19.3.0 exists but is not needed.
- **Vite 7.3.1** — the root `pnpm-workspace.yaml` `overrides.vite` is load-bearing; `@vitejs/plugin-react@6.x` requires Vite 8, so Vite 8 is a coupled upgrade.
- **pnpm 11.10.0 + workspace `catalog:`** — required own convention for every new dep; `catalog:default` references, never inline pins.
- **alien-signals 3.1.2** — deliberately framework-agnostic (verified: no React entry in its `exports` map in either 3.1.2 or 3.2.1). Keep signals in the engine-agnostic layer and bridge to React through a ~15-line hook.
- **PandaCSS 1.8.1** — already the editor's styling system; the risk is codegen scanning a package outside the app directory, not the choice of system.
- **`dependency-cruiser` 18.3.1 (devDependency, the one thing to add now)** — the only way to make "core must not import host or engine code" a machine-checked fact instead of a comment. Preferred over `eslint-plugin-boundaries` because it also sees type-only, dynamic, and `require` imports.
- **`@microsoft/api-extractor` 7.59.1** — seed the API report in the boundary phase so the public surface's growth is visible from the first commit; enforce in CI at the freeze phase.
- **Defer, do not add now:** `hookable` (plugin lifecycle), `tsdown` + `publint` + `@arethetypeswrong/cli` (publishing), `@changesets/cli`, `zod` (only via `zod/mini` if structured manifest validation ever lands).

**Forbidden:** any DI container (`tsyringe`, `inversify`, `awilix`, `typed-inject`, `brandi`, `iti`, `effect`); `tapable`; `mitt`/`nanoevents`; `xstate`; `@radix-ui/react-slot`; `react`/`react-dom` in `dependencies` (two React copies ⇒ wrong context object ⇒ "invalid hook call"); a root barrel exporting all four blocks; `defaultFs` or any file access inside core; publishing internal TypeScript source to npm.

### Expected Features (Feature / Extension-Point Priorities)

This is a subsequent-milestone feature landscape. "Table stakes" here does **not** mean new user-facing features — it means **the seams must exist and be correctly shaped**, because every later capability and third-party customization attaches to them.

**Must have (P1 — the extraction cannot ship without these):**
- **Registration hooks / engine-adapter contract** — the keystone. Core never reads files; all engine data arrives through ports.
- **Command registry + dispatch** — the single most important core primitive; one action definition drives menu, keybinding, toolbar, and programmatic invocation.
- **Undo/redo history over commands** — inverse operations, capacity 100, coalescing for drag/paint gestures; extracted behavior-preserving.
- **Reactive resource layer + persistence protocol abstraction** — memory-first `Content<T>` + signals, host-supplied IO; core keeps the abstraction and drops all path/format knowledge.
- **Fixed workbench shell + workspace/panel activation model** — fixed layout, named slots, registry-driven panel IDs (generalize the hardcoded union).
- **All four editing surfaces extracted and generic** (code, table, map, asset).
- **Field-editor registry for the table surface** — the mechanism in core, the types supplied by the adapter; RJSF-style layered precedence.
- **Asset catalog interface** — required by both map and table.
- **Recovery boundaries + notifications + draft guard** — behavior-preserving extraction of `ContentBoundary`, `PanelErrorBoundary`, and `draftGuard`.
- **Shared selection model** — prevents four divergent selection implementations.

**Should have (P2 — add when possible, still this milestone's seam design):**
- **Contribution descriptor shapes + capability enum** — extension points only, no loader.
- **Diagnostics/reference service**, **map tool/overlay hooks**, **save/dirty status contribution point**, **keyboard shortcut registry unification**, **two-phase init contract** (`setup()`-then-`ready()`, cheap to bake into the lifecycle now).

**Defer (v2+ / explicitly out of scope):**
- Plugin loader / activation lifecycle, extension-point version enforcement against a second consumer, additional capability packs, layout customization/docking, sandboxed/worker plugin isolation, marketplace/gallery, collaboration/CRDT.

**Anti-features to refuse on sight:** plugin loading mechanism, layout customization, core reading files or assuming engine file formats, writing a code editor from scratch, generic IDE features (terminal/debugger/LSP/multi-root), real-time collaboration, sandboxed plugin isolation, marketplace, version/compat solving for extension APIs now, arbitrary user-defined workspaces/tabs, core-owned engine-format migration, runtime script execution/hot-reload, a new theme/token system, synchronous per-keystroke state emission to plugins.

### Architecture Approach

A **hexagonal core with a per-instance runtime, two registries, and four capability ports.** The highest-leverage structural move — and the one the whole milestone depends on — is replacing today's module-level singletons (`projectData`, `projectModel`, `operationHistory`, `FileHandlerManager`, `persistenceMonitor`, `editorConfigService`) with **one per-instance `EditorCore` graph created by `createEditorCore(config)`.** Without it the core cannot host two engines, cannot be unit-tested in isolation, cannot be torn down, and can never accept a plugin. The dependency arrow is strictly one-directional: `@motajs/editor` → `@motajs/editor-core` → shared libs. Core imports nothing from `@motajs/editor`, nothing from `src/environment`, nothing from host code, and never touches the filesystem itself.

Read the engine leakage inventory as evidence that this is a **bounded mechanical transformation, not a rewrite**: ~10 hardcoded paths (`project/data.js`, `project/items.js`, `project/floors/${id}.js`, …), ~11 hardcoded accessors on `ProjectDataImpl`, ~13 engine-semantic "model" modules, 90+ `projectData`/`projectModel` reach-through import sites, and one host-transport import. That is why the strangler sequence works and a big-bang move does not.

**Major components:**
1. **Kernel** (`lib/kernel/`) — `createEditorCore(config)` per-instance container, capability registry (`kind:id`, ownership, diagnostics, read-only snapshot, disposers), `Disposable`/`DisposableStore` with reverse-order teardown, diagnostics bus, and the port declarations (`FsPort`, `HostPort`, `EngineAdapter`, `PreviewAdapter`, capability ports). Depends on nothing.
2. **Resource layer** (`lib/resources/`) — verbatim move of `src/fs/*` + `src/project/resources.ts`: `Content<T>`, `FileHandler`/`DataHandler`/`BinaryFileHandler`/`JsonDataHandler` (generic JSON only), `ResourceRegistry`, `FileHandlerManager` (per-instance!), `PersistExecutor`, `PersistenceMonitor`, `computedResource`/`aggregateResource`/`optional`.
3. **Edit layer** (`lib/edit/`) — verbatim move of `src/project/history/*`: `EditorOperation`, `compositeOperation`, `operationHistory` (capacity 100, multi-target checkpoint + rollback), `CommandResult`. Single write path: nothing outside `operationHistory.execute()` mutates a resource.
4. **Shell** (`lib/shell/`) — the fixed layout: `EditorShell`, `TopBar`, `PanelSlot`/`WorkspaceSlot`/`ToolbarSlot`/`ModalHost`, `PersistenceNotification`, error boundaries, shell state signals. Slot *positions* are compiled in; slot *content* is extensible.
5. **Capability modules** (`lib/capabilities/{code-editor,table-editor,map-editor,asset-manager}/`) — one editing domain each: its UI, its commands, its port. Folders, not packages (four modules that must version together do not benefit from separate publish cycles).
6. **Services** (`lib/services/`) — `PreviewService` (Runtime Protocol v4 envelope + gateway + surface leases), `EditorConfigService` (path injected, in-memory fallback preserved), notifications.
7. **Extension surface** (`lib/extension/`) — `EditorExtension` descriptor (shape frozen, loader absent), `registerExtension()`, `EDITOR_CORE_API_VERSION`, capability tokens. Present and **dogfooded internally**: the four block panels register through the same API extensions will use.
8. **Engine adapter** (`packages/apps/editor/src/`) — `motaEngine = defineEngine({...})`: resource descriptors, format handlers (`Json2x` + domain handlers move here), model hooks, capability ports, contributions (panels registered, not hardcoded), preview boot hook.

**Key patterns to follow:**
- **Per-instance runtime replaces module singletons.** Anything that is today `export const x = new X()` becomes a property on the object built by `createEditorCore()`. Where module scope is ergonomically unavoidable (React hooks), export a **proxy accessor** that reads the current runtime and throws a clear error outside a provider.
- **Two registries, not one.** A public extension-facing **capability registry** (`kind:id`, snapshot-able, ownership-tracked) strictly separate from private **service wiring** done once in the composition root. Conflating them turns an extension point into a service-locator leak and makes internal helpers accidental public API.
- **The engine adapter is a declarative port, not an import.** Core defines the shapes it needs; the adapter conforms — never the reverse. Core never learns a file path, a `var <uuid> =` wrapper, or the word `tower`.
- **Capability ports are the customization seam.** Each module owns UI + commands + interaction; the port supplies semantics. Asymmetry to exploit: table-editor is the least engine-coupled (its whole input is a schema); map-editor is the most (five semantic hooks).
- **Extensions are designed as descriptors now, loaded never.** Freeze the `EditorExtension` shape and the registries this milestone; ship a no-op loader.
- **Registration returns diagnostics, never throws.** Collect into one aggregated report before any activation; a partially-registered editor is worse than a refused one. Roll back failed registrations — this mirrors the existing in-repo `BlockRegistry.registerPack` contract exactly.
- **Narrow contexts only.** Never pass `EditorCore` itself to a capability module or extension — pass exactly what is declared.

### Critical Pitfalls

Top 5 by cost-if-missed (all 16 are in `PITFALLS.md`; these five are the ones that can waste the milestone or silently invalidate it):

1. **"All tests pass" is not behavior parity — the verification net does not currently run.** No PR CI, no editor `typecheck` script, e2e never runs in CI and is conditionally skipped, and unit tests cannot start without the `packages/external/mota-js` submodule. **Avoid:** establish and *quantify* the baseline before touching code (submodule init, unit suites per package, e2e, production build, bundle sizes, `editor-manifest.json`, visual screenshots), add PR CI running lint + per-package typecheck + unit + build, and treat any count going down as a blocker, not a detail.

2. **The `@/` alias resolves differently in `tsc` than in Vite.** Vite resolves `@/x` relative to the importer's *package* (`resolvePlugin.js`, hard-coded `lib` for `packages/libs/*`); TypeScript resolves it against a *single tsconfig program*. A green `tsc` with a broken app (or vice versa) is the predictable outcome across the new package boundary. **Avoid:** use `lib/` (never `src/` under `packages/libs/*`), prefer relative imports inside core or add a dedicated core tsconfig with explicit `paths`, and run **both** `tsc -b` and a Vite build in CI forever.

3. **mota-js file-structure assumptions leak into core as "defaults."** Ten literal paths, the `var <uuid> = {json}` wrapper, `.animate`/`.comment.js`/tileset layouts, and game vocabulary (`tower`, `floor`, `loc`, `autopass`, `autotile`, `idnum`, `airwall`, `commonEvent`) currently saturate the shared layer. With only mota-js as a consumer the leak is invisible. **Avoid:** core accepts descriptors (logical id, opaque path key, format id, handler) and never builds `project/...` strings or inspects extensions; migrate every literal to the adapter; add a mechanical lint/grep gate failing on game identifiers in core source; and drive a fake non-mota "engine B" adapter fixture end to end.

4. **Core keeps its own file access (a default `Fs`, environment parsing, direct fetch).** `FileHandler` defaults to the `defaultFs` singleton and host config is read from the DOM. **Avoid:** core has **no default `Fs`** — the composition root injects it; `createEditorCore(config)` mirrors `initializeEditorEnvironment()`; boundary lint forbids `@/services/fs`, `@/environment`, and anything touching `window`/`document`/`fetch`; a core test must never need a jsdom HTTP mock.

5. **Duplicate runtime identity across the package boundary (React, signals, stores, Immer, Monaco, Pixi, Blockly).** If core declares any of these as regular dependencies, pnpm can resolve a second copy: "invalid hook call," signals created in core not tracked by editor effects (UI silently stops updating), Immer draft-class mismatch, doubled bundle weight against the 20 MiB ceiling. **Avoid:** declare singleton/runtime packages as `peerDependencies` with `catalog:default`, never bundle React, add a CI `pnpm why`/dedupe assertion that exactly one copy exists, and add a smoke test that mounts a core component inside the editor asserting a single React instance and live signal propagation.

Also high-cost: **PandaCSS styles silently dropping out of the build** (a package outside `panda.config.ts` `include` emits *no classes*, and unit tests cannot catch it — assert the generated CSS contains a known core class and keep a P1 visual baseline); **React Compiler silently not covering `packages/libs/**`** (silent non-memoisation, no compile error — verify with a deliberate compile check); **dual copies and permanent re-export shims** (one move per commit, update all importers, no files whose body is only `export * from "@motajs/editor-core"`, tracked shim list with an in-milestone deletion deadline); **circular dependencies hidden behind type-only imports** (editor → core only, enforced by `dependency-cruiser` with a no-cycles rule); **persistence/undo semantics drifting** (characterization tests in P1, then freeze: latest-wins with one executing + one pending intent per path, no UI rollback on persist failure, multi-target checkpoint rollback, capacity 100); **the hook contract mismatching the reactivity model** (hook returns `ReadonlySignal<Content<T>>` with the five-state union, or the `ContentBoundary` suspension/`not-found` semantics break and the adapter fakes reactivity with effects and timers); **protocol/build drift** (snapshot Environment v1, Runtime v4, manifest v2, MPA entries, no `<base>`, 20 MiB ceiling — and **preserve** the pre-existing `runtimeProtocolVersion: 3` vs `RUNTIME_PROTOCOL_VERSION = 4` mismatch rather than "fixing" it, because that is a behavior change); and **a single core barrel** collapsing code-splitting and dragging Monaco/Blockly/Pixi into both MPA entries.

### Cross-Dimension Divergences Resolved

The four files disagree in six places. One recommendation each:

| # | Divergence | Resolution |
|---|---|---|
| 1 | **Container name:** STACK/PITFALLS say `EditorCore` / `createEditorCore(config)`; ARCHITECTURE says `EditorRuntime` / `createEditorRuntime()` | **`EditorCore` / `createEditorCore(config)`.** ARCHITECTURE already concedes these are the same object and that "runtime" is descriptive, not a second concept. Use one name in code; keep "runtime graph" only as prose. |
| 2 | **Registration failure:** STACK says duplicate ids **throw**; ARCHITECTURE says diagnostics with **no partial state** | **Both, at two layers.** `registerCapability()`/`registerExtension()` never throw: they return a diagnostic result and roll back the failed registration (the in-repo `BlockRegistry.registerPack` contract). `createEditorCore()` then aggregates all diagnostics and **fails startup loudly** if any required registration is unresolved. Registration is diagnosable; construction is atomic. |
| 3 | **Package directory:** STACK's PandaCSS example references `packages/libs/editor-core/src/**`; PITFALLS says `packages/libs/*` MUST use `lib/` | **`lib/` is authoritative.** `resolvePlugin.js` and `tsconfig.lib.base.json` hard-code it for `packages/libs/*`. The PandaCSS include glob to widen is `../../libs/editor-core/lib/**/*.{ts,tsx}`. The `src/**` in STACK.md is an error; do not create `packages/libs/editor-core/src/`. |
| 4 | **Subpath names:** STACK proposes `./code /table /map /asset /react`; PITFALLS proposes `/code /table /map /material /shell` | **One set:** `.` (contracts + registry only, pulling in no block), `./code`, `./table`, `./map`, `./asset` (素材 = asset-manager, matching PROJECT and ARCHITECTURE), `./shell`, `./react` (provider + hooks). Add all of them at package creation — adding subpaths later is a breaking change; adding them now is free. |
| 5 | **Capability build order:** ARCHITECTURE says table → code → assets → map; FEATURES says the table surface *requires* the asset catalog | **Define the asset-**catalog port** in the capability-ports phase, implement the full asset manager third.** The table can ship with built-ins and a minimal injected catalog port first (FEATURES: the registry "enhances, not gates" the table); map is the consumer that truly needs the full catalog. Final order stands: **table → code → asset → map.** |
| 6 | **Extension mechanism shape:** STACK proposes `ExtensionPoint<TDescriptor>` with `register(descriptor)`; ARCHITECTURE proposes `registerCapability(kind, id, value, opts)` + `EditorExtension`/`EditorExtensionContext` | **ARCHITECTURE's shape, with STACK's rules.** `registerCapability(kind, id, value, {owner, replaceable}) → Disposable` is the primitive; `EditorExtension` is the descriptor-facing wrapper a future loader will feed; `apiVersion` is a **required** integer on every descriptor; ids are namespaced (`mota.`, `plugin.acme.`); every registration returns a disposer; selection always names an explicit id (no silent first-wins default). |

Two divergences worth calling out because the research files **agree** and the agreement is load-bearing: (a) **no DI container, no hook-bus library** — React Context is the composition root and `useSyncExternalStore` is the signal bridge; `hookable` is deferred to the plugin milestone; (b) **no validation library** as a hard dependency — a hand-written `assertDescriptor()` covers registration-time validation, with `zod/mini` a documented option only if structured manifest validation ever arrives (import as `import * as z from "zod/mini"` or tree-shaking fails).

---

## Implications for Roadmap

Based on combined research, the suggested phase structure below. It merges PITFALLS.md's five-phase skeleton (Baseline → Boundary → Kernel+Hooks → Editors+Shell → Parity) with ARCHITECTURE.md's finer-grained kernel/resource/edit/adapter decomposition, and folds STACK.md's silent-failure probes into the boundary phase. Every phase after Phase 2 must end green on the Phase 1 baseline.

### Phase 1: Baseline & Verification Net
**Rationale:** PITFALLS.md is explicit that without this, every later phase is unverifiable — and it must happen *before* any code moves, because the safety net cannot be retrofitted around a moving refactor. "Tests green" is cheap to claim and expensive to actually establish here.
**Delivers:** Submodule (`packages/external/mota-js`) initialized; PR CI running lint + per-package typecheck + unit tests + production build; root `typecheck`/`test` fan-out scripts; recorded quantified baseline (per-package unit suites, e2e, build output, bundle/artifact sizes against the 20 MiB ceiling, emitted `editor-manifest.json`, protocol constants); Playwright screenshot baselines for the four editors + shell; **characterization tests** for `PersistExecutor`/`PersistenceMonitor` (error→retry→idle, concurrent latest-wins, no UI rollback on persist failure) and `operationHistory` (capacity 100, inverse ops, multi-target checkpoint rollback, resource reactivity after `set`/`patch`); silent e2e skips converted to required fixtures or CI-visible markers; generated protocol assertions (manifest `runtimeProtocolVersion` vs runtime constant).
**Addresses:** none of the features directly — this phase makes their "unchanged" claim measurable.
**Avoids:** Pitfall 2 (no verification net) — the milestone's highest-cost pitfall; also the detection half of Pitfalls 12 (persistence/undo drift) and 15 (protocol/build drift).
**Research flag:** standard patterns, no research-phase needed.

### Phase 2: Package Boundary & Build Scaffolding
**Rationale:** The boundary must exist — and be enforced — before the first file moves into it. Every subsequent phase commits code against a boundary that either existed or did not. This is also where STACK.md's two silent-failure probes belong, because both fail without a compile error: PandaCSS emits no classes for out-of-`include` sources, and React Compiler silently skips files outside its filter.
**Delivers:** `packages/libs/editor-core/` with `lib/` structure, `private: true`, `type: module`, `sideEffects: false`, full subpath `exports` (`.`, `./code`, `./table`, `./map`, `./asset`, `./shell`, `./react`); `package.json` with React/React DOM and every singleton (`antd`, Semi, alien-signals, immer, monaco-editor, pixi.js, blockly) as `peerDependencies` + `catalog:default`; catalog entries added first, per repo convention; `dependency-cruiser` rules wired into CI (forbidden edges, `requireZero` for module singletons outside `kernel/core.ts`, no cycles); core tsconfig + `@/` resolution strategy decided and **proven identical under `tsc -b` and Vite**; **PandaCSS include probe** (widen `panda.config.ts` `include` to `../../libs/editor-core/lib/**/*.{ts,tsx}` and assert generated CSS contains a known core class); **React Compiler coverage probe** (verify core TSX is transformed; widen the `react()` plugin filter if not); `api-extractor` report seeded so surface growth is visible from the first commit.
**Addresses:** Headless-first, host-agnostic packaging (FEATURES table stakes).
**Avoids:** Pitfall 1 (alias/tsconfig divergence), Pitfall 7 (styles dropped), Pitfall 8 (duplicate runtime identity), Pitfall 9 (cycles), Pitfall 16 (barrel/bundle blowup — subpaths prevent it from ever forming).
**Uses:** `dependency-cruiser@18.3.1`, `api-extractor@7.59.1`, `peerDependencies` + catalog, `sideEffects: false`, subpath exports.
**Research flag:** standard patterns, but the two probes are MEDIUM-confidence open items — budget a spike, not a research phase.

### Phase 3: Kernel — Runtime, Ports, Registry, Diagnostics
**Rationale:** The per-instance runtime and registries are the abstraction every later step depends on. Doing them last means rewriting every intermediate step. This phase ships **no user-visible change** — the app still uses the old modules.
**Delivers:** `createEditorCore(config) → EditorCore`; the `EditorCore` interface with `dispose()` (reverse creation order); `Disposable`/`DisposableStore`; `registerCapability(kind, id, value, {owner, replaceable})` returning a diagnostic result + rollback, with `getCapability`/`getCapabilityOrThrow`/`snapshotCapabilities`; `DiagnosticBus`; the port declarations (`HostPort`, `FsPort`, `EngineAdapter`, `PreviewAdapter`, and per-capability port interfaces); `EDITOR_CORE_API_VERSION`; aggregated validation (duplicate ids, missing required hooks, dependency cycles) producing **one report** before activation; a two-core isolation test.
**Addresses:** Registration hooks / engine-adapter contract (keystone); contribution descriptor shapes + capability enum.
**Avoids:** Pitfall 5 (hook ordering race — factory config, no import-time construction), Pitfall 11 (singletons without instance scope), Pitfall 6 (speculative generality — no hook without a current caller), Anti-Pattern 2/4/5/7.
**Implements:** the kernel/ kernel folder and the two-registry split.

### Phase 4: Resource + Edit Layers Moved
**Rationale:** Both layers are already engine-agnostic and are verbatim moves, so they are the safest content to relocate and they prove the boundary and the build work. The existing tests must stay green **unchanged** — that is the whole point.
**Delivers:** `src/fs/*` → `lib/resources/*`; `src/project/resources.ts` → `lib/resources/combinators.ts`; `lib/resources/ResourceRegistry.ts` (new: generic logical-id registration); `src/project/history/*` → `lib/edit/*`; `editor/src` re-exports core's layers during the transition so existing imports keep working; `FileHandlerManager` converted from a module singleton to a per-instance service; no default `Fs` anywhere.
**Addresses:** Reactive resource layer + persistence protocol abstraction; undo/redo history over commands.
**Avoids:** Pitfall 4 (core file access), Pitfall 12 (persistence/undo semantics — Phase 1 characterization tests must pass unchanged), Pitfall 10 (shims are introduced deliberately and tracked, not accidental).
**Uses:** `alien-signals`, `immer`, existing test suites.
**Implements:** resource layer + edit layer; preserves the invariants "memory-first is not a save," "single write path," "`not-found` ≠ `error`," "per-path serialized (one executing + one pending)."

### Phase 5: Engine Adapter Skeleton & Resource Descriptors
**Rationale:** The adapter is the union of everything core must be told; starting it now means the port shapes are tested against the real engine's needs while the four capabilities are still unbuilt, so ports can still change cheaply.
**Delivers:** `motaEngine = defineEngine({id, resources, migrations, model, capabilities, contributions, labels})`; all 10 hardcoded paths become `ResourceDescriptor`s (logical id, opaque path, format id, handler, `preload`, `preloadDependsOn`); `Json2x` + all domain `*DataHandler` subclasses move to the adapter; core keeps generic `JsonDataHandler` only; `ProjectDataImpl`'s 11 accessors become thin **deprecated shims** resolving through `ResourceRegistry`, deleted one domain at a time; `LabelOverrides` carries game vocabulary out of core; `MigrationHook` carries engine-format migrations out; the **fake "engine B" adapter fixture** is created and drives the hook contract end to end with non-mota resources.
**Addresses:** Registration hooks / engine-adapter contract (the injection surface for real data).
**Avoids:** Pitfall 3 (mota path assumptions in core), Pitfall 14 (false agnosticism), Pitfall 6 (every extension point now has a second concrete implementation before it is frozen).
**Implements:** `EngineAdapter` port + `defineEngine()`; the "core defines the shapes, adapter conforms" discipline.

### Phase 6: Fixed Shell + Slots
**Rationale:** The shell needs runtime access but not resources or capabilities, so it can land early and let capability modules integrate against a real shell instead of a harness. Layout must stay visually identical, and this is the first user-visible change — so the risk is layout drift, not logic.
**Delivers:** `lib/shell/{EditorShell,TopBar,slots,PersistenceNotification,ErrorBoundaries,state}.tsx` moved from `Workbench/*` + `stores/*`; `PanelSlot`/`WorkspaceSlot`/`ToolbarSlot`/`ModalHost`/`SettingsSlot` with fixed positions and registry-driven content; the hardcoded panel-ID union generalized into the registry; `Workbench/index.tsx` becomes a thin contribution list delegating to core's shell; draft guard generalized into a core per-document dirty registry; one `react-error-boundary` per block region.
**Addresses:** Fixed workbench shell; workspace/panel activation model; recovery boundaries + draft guard + notifications; save/dirty status contribution point.
**Avoids:** UX Pitfall (layout drift) — verified against Phase 1 screenshots; Pitfall 16 (keep shell out of the runtime entry).
**Implements:** shell layer + Pattern 5 (fixed shell with named slots); internal registrations use the *same* API extensions will use (dogfooding).

### Phase 7: Table Capability + Port (First Vertical Slice)
**Rationale:** Table is the least engine-coupled capability — its entire input is a declarative schema and its engine coupling is a mapping table — so it forces the "schema + injected model" abstraction to be right *before* three harder modules depend on it. ARCHITECTURE.md names it the first vertical slice; FEATURES.md's dependency graph agrees it gates the field-editor registry.
**Delivers:** `lib/capabilities/table-editor/` (schema-driven renderer, action-path editing, validation UI, meta editor, cell/edit-cell separation); `table.fieldEditor` + `table.schema` capability kinds with **layered override precedence** (core default → theme → form-level → `ui:field`/`ui:widget`); the minimal **asset-catalog port** wired so `ImageAssetPickerModal`/`FloorImagesFieldEditor` need no direct engine access; engine schemas + meta-file mapping + domain field types (`PassabilityField`, `FloorImagesField`) supplied by the adapter.
**Addresses:** Schema-driven table/data-config editing; field-editor registry; shared selection model (unified with the other surfaces as they land).
**Avoids:** Pitfall 3/14 (engine schemas never enter core), Pitfall 13 (hook returns live `Content<T>` signals, not snapshots).
**Implements:** capability port pattern, proven on the simplest domain first.

### Phase 8: Code Capability + Port
**Rationale:** Second because it validates the port against a *differently shaped* domain (file-backed rather than schema-backed) while the pattern is fresh. PITFALLS.md also warns to keep the Blockly codec in the adapter until the hook contract is stable.
**Delivers:** `lib/capabilities/code-editor/` — Monaco host + model/document registry keyed by engine-supplied id, file-backed tabs, save/undo binding, dirty lifecycle, diagnostics surface, completion registry, editor-action/keybinding contribution seam; `code.language` capability kind; language config + completion/typing sources + docs endpoint injected by the adapter; **Blockly decision implemented** per the resolution reached in planning (recommended: generic Blockly host/session + schema→block compiler framework in `code-editor` with an injected schema pack registered through the same registry API, mirroring the existing `BlockRegistry.registerPack`/`registerPackJson` shape; `blockly/project/*`, domain schemas, event field bindings, and diagnostics move to the adapter).
**Addresses:** Code editing surface; keyboard shortcut registry unification (reconcile core shortcuts vs Monaco's own keybinding/context-key system explicitly).
**Avoids:** Anti-feature "write a code editor from scratch" (keep Monaco); Pitfall 3 (do not fork Monaco; engine configuration arrives through ports).
**Implements:** code capability port; validates the port on a second domain shape.

### Phase 9: Asset Capability + Port
**Rationale:** Third because it needs a binary `FsPort` + codec and is write-heavy, validating the port for non-text data. It must land before map because map consumes the catalog and reference service.
**Delivers:** `lib/capabilities/asset-manager/` — directory/collection resources, append/insert/replace/remove operations, browser grid/list + type filter + search + thumbnails with fallback + drag-to-assign + reference lookup, preview UI, `RasterCodec` port; `asset.kind` capability kind; asset roots/kinds, material specs, animation format handling, codec implementation injected by the adapter.
**Addresses:** Asset management; diagnostics/reference service (reference queries as a core service plugins can contribute findings to).
**Avoids:** Pitfall 3 (binary formats and asset roots stay adapter-side), Pitfall 4 (core never reads files), Pitfall 16 (keep heavy codecs behind dynamic import).
**Implements:** asset capability port; validates the port for non-text and write-heavy operations.

### Phase 10: Map Capability + Port
**Rationale:** Last among capabilities by deliberate design. Map needs **five** semantic hooks (block registry, sprite/tileset catalog, passability provider, floor list/organization, loc resolver) plus Pixi rendering and a tool state machine. By this point the registry, port, command, and shell patterns are all proven, so the riskiest module builds on a settled foundation. ARCHITECTURE.md flags this as the ordering that matters most — map is where a wrong abstraction is most expensive.
**Delivers:** `lib/capabilities/map-editor/` — Pixi canvas/layers, coordinate + grid utils, tool state machine, overlay host, recently-used panel, context menu, row/col marks, floor navigation; `map.tool` + `map.overlay` capability kinds with Godot-style `activate`/`deactivate`/overlay-draw/input-interception (explicitly not consuming unneeded events) and a command commit point; the five hooks supplied by the adapter; tileset/passability/floor-transform semantics never in core.
**Addresses:** Map editing surface (generic); tool/overlay hooks; shared selection model completed.
**Avoids:** Pitfall 3/14 (the single largest leak surface), Pitfall 13 (reactive hooks; overlays update live), Pitfall 16 (Pixi stays behind the map subpath, never in the runtime entry).
**Research flag:** needs deeper research during planning — the largest single move in the milestone.
**Implements:** map capability port; completes all four built-ins.

### Phase 11: Preview Service + Adapter Cutover + Shim Deletion
**Rationale:** Preview resolves resources through `ResourceRegistry` and the asset capability, so both must exist first. The adapter is the union of everything it supplies, so it can only be completed once all four ports are final. This is also the first phase where `@motajs/editor` can be regression-tested end to end.
**Delivers:** `lib/services/preview/` — `protocol.ts` envelope (Runtime Protocol **v4 unchanged on the wire**), provider/context, `RuntimeResourceGateway` (with the `project/` allowlist preserved), monotonic revisions, 300 ms debounced `resources-changed`, surface leases, retry policy; the engine boot hook (`iframeEntry.ts` overrides of `main.loadMod`, `loader.prototype.loadImage`, `importFonts`, …) moves to a `PreviewAdapter` implemented in the adapter; **adapter cutover** — delete `projectData`/`projectModel`/`operationHistory`/`FileHandlerManager`/`persistenceMonitor`/`editorConfigService` singletons and all tracked re-export shims; `runtime.html` input stays in `@motajs/editor` (artifact shape must not change); full regression suite + manual UAT per the Phase 1 written script.
**Addresses:** Persistence protocol abstraction finalized; all four surfaces now engine-free; "No shims" checklist item.
**Avoids:** Pitfall 10 (shims deleted on deadline), Pitfall 15 (protocol/manifest diff against baseline; **preserve** the pre-existing 3-vs-4 mismatch), Pitfall 16 (verify `runtime.html` chunk graph is free of core shell/React/antd), security mistakes (do not relocate the iframe sandbox posture into core; do not export an eval primitive from core).
**Research flag:** needs deeper research during planning — the engine boot hook is the least-documented surface in the repo.

### Phase 12: Extension Surface Freeze, Parity Verification & Protocol Freeze
**Rationale:** Freeze the surface only once the adapter stops moving; versioning a moving surface is how ecosystems break. This phase is the milestone's acceptance gate.
**Delivers:** Frozen `EditorExtension` descriptor + `EditorExtensionContext` (narrow context — never the `EditorCore` object) with **required** `apiVersion`, `requires`/`optional`, `activate()` returning `Disposable`, and a two-phase activate-then-resolve lifecycle; committed `api-extractor` `.api.md` report enforced in CI; versioning + deprecation policy documented (additive-only within a major, capability-gated then promoted, deprecate in minor / remove at next major with ≥6 months notice); `extensionPointId@v1` + an ADR per extension point; the "Looks Done But Isn't" checklist executed end to end (two-core isolation, fake engine-B adapter, dedupe assertion, bundle budget vs baseline, no re-export-only files, no cycles, e2e actually ran, visual parity, generated CSS contains core classes); protocol constants consolidated to one exported value consumed by both producers (**or explicitly documented as intentionally preserved** if the mismatch is left as-is per Pitfall 15).
**Addresses:** Contribution descriptor shapes + capability enum finalized; two-phase init contract.
**Avoids:** Pitfall 6 (freeze only what has two implementations), Pitfall 15 (final protocol/manifest diff), Anti-Pattern 3 (no UI importing engine model), Anti-Pattern 8 (no big-bang).

### Phase Ordering Rationale

- **Verification before motion.** Phase 1 precedes everything because "行为完全不变" has no meaning without a quantified before-picture, and the safety net cannot be installed around a moving target. This is the one ordering constraint the research files state identically.
- **Boundary before content.** Phase 2 creates the package, the resolution strategy, the lint gate, and the style/compiler probes. Every later phase commits against that boundary; retrofitting it means re-verifying resolution for every file already moved.
- **Kernel before everything downstream.** The per-instance runtime and registries are the abstraction the resource layer, edit layer, shell, and all four capabilities consume. Building them late means rewriting every intermediate step — the single biggest schedule risk in the plan.
- **Verbatim moves before adaptations.** Phases 4 moves already-engine-agnostic code so the boundary and build get exercised with content whose "unchanged" claim is cheap to verify. Adaptation starts only after that.
- **Adapter before capabilities.** The adapter skeleton (Phase 5) surfaces the real port requirements while ports are still cheap to change; it also creates the fake engine-B fixture that keeps every later port honest.
- **Capabilities ordered by engine-coupling, least first.** Table (schema-only) → code (file-backed) → asset (binary + write-heavy) → map (five semantic hooks + Pixi + tool state machine). Each phase validates the port pattern on a new axis before the riskiest module consumes it, and map gets a settled foundation instead of defining the abstraction on the first try.
- **Preview after capabilities; cutover after preview.** The preview gateway resolves through `ResourceRegistry` and the asset capability, so those must exist; the adapter can only be completed once every port is final; and shims can only be deleted once the adapter fully replaces them. Parity verification and the surface freeze come last because the surface must stop moving before it can be versioned.
- **Grouping reflects the architecture's layer boundaries** (kernel / resources+edit / shell / capabilities / services / extension+adapter), which is also what makes each phase independently revertible — a property the "one move per commit, always green" discipline depends on.

### Research Flags

**Phases likely needing deeper research during planning (`/gsd-plan-phase --research-phase <N>`):**
- **Phase 10 (Map capability):** the largest and most engine-coupled single move — five semantic hooks, PixiJS rendering internals, a tool state machine, and overlay/input-interception semantics. Adapting Godot's tool model to the existing `MapEditorStore` structure is explicitly unproven in research.
- **Phase 11 (Preview service + cutover):** the engine boot hook (`iframeEntry.ts` overrides of `loadMod`/`loadImage`/`importFonts`) is the least-documented surface in the repo, and the Runtime Protocol v4 wire contract must not move.
- **Phase 8 (Code capability):** if the Blockly split decision is not settled before planning — reconciling Monaco's independent command/keybinding/context-key system with the core command registry is a known source of shortcut conflicts and needs a concrete decision.
- **Phase 7 (Table capability):** partially — the line between "built-in primitive field types" and "engine-supplied types," and whether the field-editor registry is core-mechanism or fully adapter-provided, is the one feature-design question research leaves open.

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Baseline & verification net):** conventional CI/test-baseline work.
- **Phase 2 (Boundary & scaffolding):** standard monorepo package creation — except the two probes, which are spikes, not research.
- **Phase 3 (Kernel):** well-documented registry/ports/disposable patterns with three first-party precedents.
- **Phase 4 (Resource + edit layers):** verbatim moves of already-agnostic code.
- **Phase 5 (Adapter skeleton):** mechanical descriptor extraction once the port shapes from Phase 3 exist.
- **Phase 6 (Shell + slots):** fixed-slot rendering is routine React.
- **Phase 9 (Asset capability):** catalog/browser patterns are well-documented (PlayCanvas/ezEngine/Blender/Entangle analogs).
- **Phase 12 (Freeze & parity):** checklist execution against the Phase 1 baseline.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | **HIGH** (headline) / MEDIUM-HIGH (tooling picks) | Every version number, `dist-tags`, publish date, and `peerDependencies` range was verified directly against `registry.npmjs.org` on 2026-09-20, and the repo's catalog/override/source-consumption conventions were read from source. MEDIUM items: PandaCSS `include` behaviour for an out-of-app package, React Compiler coverage of `packages/libs/**`, and `dependency-cruiser` rule syntax — all explicitly flagged as spikes, not settled. |
| Features | **MEDIUM** | Table-stakes and anti-feature claims are grounded in official docs (VS Code, Monaco, Tiptap/ProseMirror, Lexical, Figma, Godot) and a direct read of the existing editor source (HIGH on both). Plugin-ecosystem recommendations rest partly on community engineering write-ups and are LOW by design — and are deliberately deferred out of this milestone. The field-editor registry split and the map-tool hook shape are open design questions. |
| Architecture | **MEDIUM** | Repo-derived component/boundary claims are HIGH (read directly: singletons, the ~10 paths / ~11 accessors / ~13 model modules / 90+ reach-through sites, `BlockRegistry.registerPack`, protocol drift). External pattern claims are MEDIUM (cross-checked across three independent systems). The `EditorRuntime` → `EditorCore` rename is a resolved vocabulary conflict, not uncertainty. |
| Pitfalls | **MEDIUM** | Repository-specific findings are HIGH (verified against `resolvePlugin.js`, both tsconfig bases, `projectData.ts`, `RuntimeResourceGateway.ts`, `iframeEntry.ts`, the artifact plugin, and the CI workflows). General extraction/plugin/refactoring claims are LOW (web search, unverified) but consistent with the in-repo evidence and with each other. |
| **Overall** | **MEDIUM-HIGH** | The repo-derived core (what to move, in what order, what not to couple) is HIGH confidence. The external-pattern and tooling edges carry the MEDIUM/LOW flags above and are the items scheduled as spikes or research flags rather than assumed. |

### Gaps to Address

- **PandaCSS `include` for an out-of-app package** — `panda.config.ts` was not read. Handle with a Phase 2 probe: widen `include` to `../../libs/editor-core/lib/**/*.{ts,tsx}`, assert generated CSS contains a known core class, and if the codegen boundary cannot be crossed cleanly, fall back to core-owned chrome being unstyled/inline with the app owning styled wrappers.
- **React Compiler coverage of `packages/libs/**`** — inferred from the existing TSX-exporting lib convention, asserted by no config. Handle with a Phase 2 deliberate compile check; if core files are not transformed, widen the `react()` plugin filter. Do not hand-write `useMemo`/`useCallback` in new core components as a workaround — use `"use no memo"` for the specific file if needed.
- **Blockly/event editor placement** — one of the four capabilities, part of `code-editor`, or adapter-only? Research recommends: generic Blockly host + schema→block compiler framework in `code-editor` with an injected schema pack registered through the same registry API (the existing `BlockRegistry.registerPack`/`registerPackJson` shape is a ready-made precedent); `blockly/project/*`, domain schemas, event field bindings, and diagnostics move to the adapter. **Needs confirmation before Phase 8 — it materially changes the `code-editor` port.**
- **Format-specific shared libs** — decide whether `@motajs/file2x` and `@motajs/h5animate` are mota-specific or general wrappers before fixing core's dependency list. Safe default: keep format-specific libs out of core (the constraint is "不因拆分引入不必要的运行时依赖").
- **`Json2xDataHandler` home** — recommendation is that it moves to the adapter (it encodes `var <uuid> = {json}`); verify the same for `@motajs/file2x` before confirming.
- **Selection model: one or four?** — a single shared selection is cleaner but may fight the existing per-surface stores (`EditorStore`, `MapEditorStore`, `PanelStore`). Decide during Phase 6/7 and let the Phase 7 table slice be the first consumer.
- **`EditorConfigService` module-load initialization** — confirm the core service takes the `_server/config.json` path as a port/parameter and preserves the in-memory fallback behavior identically.
- **`api-extractor` timing** — seed the report in Phase 2, enforce in CI from Phase 12 (recommended), rather than waiting until the surface is "stable enough."
- **The pre-existing `runtimeProtocolVersion: 3` vs `RUNTIME_PROTOCOL_VERSION = 4` mismatch** — research says preserve it (fixing it is a behavior change); any decision to fix it must be an explicit, separately-approved scope change, not a "while we're here" edit.
- **No authoritative benchmark for alien-signals vs `@preact/signals-react` under React 19** — the recommendation rests on alien-signals already being the project's primitive and being deliberately framework-agnostic (verified from its `exports` map), not on a measured comparison. Not worth a spike; revisit only if a perf problem appears.
- **No direct benchmark competitor ("motajs" has no obvious OSS analog)** — the FEATURES.md comparison table is analogical (tile/level editors + data workbenches), not apples-to-apples. Treat it as directional guidance for seam design, not as a feature-parity mandate.

### Research Flags Summary (for the roadmapper)

- **Needs `/gsd-plan-phase --research-phase`:** Phase 8 (Blockly split), Phase 10 (map), Phase 11 (preview/cutover).
- **May need a short phase-specific research pass:** Phase 7 (field-editor core-vs-adapter line).
- **Standard patterns, skip research:** Phases 1–6, 9, 12.

---

## Sources

Aggregated from the four research files; each file carries its own full source list with per-claim confidence tags.

### Primary / repository (HIGH confidence — read directly)
- `.planning/PROJECT.md` — scope, constraints, out-of-scope boundaries, key decisions, protocol versions.
- `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/CONCERNS.md` — layered data flow, the six module singletons, host boundary, protocol drift warning.
- `packages/libs/config/resolvePlugin.js`, `tsconfig.lib.base.json`, `tsconfig.app.base.json` — the `@/` alias divergence and the hard-coded `lib/` convention for `packages/libs/*`.
- `packages/libs/{react-store,react-hooks,react-monaco-editor,utils,config}/package.json` — source-consumption, subpath-exports, and peer-dependency conventions.
- `packages/apps/editor/src/` — `project/data/projectData.ts` (hardcoded paths, accessors, preload graph), `project/resources.ts`, `project/history/*`, `fs/*`, `services/fs/fs.ts`, `services/editorConfig/editorConfigService.ts`, `blockly/registry/index.ts` (`registerPack` diagnostics+rollback), `project/model/*`, `Workbench/index.tsx`, `stores/*`, `runtime/{protocol.ts,RuntimeResourceGateway.ts,iframeEntry.ts,protocol.test.ts}`, `environment.ts`.
- `packages/apps/editor/{package.json,vite.config.ts,tsconfig.app.json,panda.config.ts,editor-artifact-plugin.ts,docs/architecture-and-interfaces.md}`.
- `pnpm-workspace.yaml`, root `package.json`, `.github/workflows/*` — catalog/override discipline, React Compiler wiring, absence of PR CI and `.changeset/`, manual-only deploy.
- `registry.npmjs.org` (direct HTTP, 2026-09-20) — every version, `dist-tags`, publish date, and `peerDependencies` range quoted in STACK.md.

### Secondary (MEDIUM confidence — official docs and cross-checked sources)
- tldraw — [issue #7954 "Extract framework-agnostic editor-core"](https://github.com/tldraw/tldraw/issues/7954), [Shapes](https://tldraw.dev/docs/shapes), [ShapeUtil reference](https://tldraw.dev/reference/editor/ShapeUtil), [SDK architecture](https://tldraw-tldraw.mintlify.app/advanced/architecture) — the closest structural precedent; `shapeUtils={[...]}` array registration; package-per-concern split.
- Lexical — [packages](https://lexicaljs.org/docs/packages/lexical), [Extensions](https://lexical.dev/docs/extensions/intro), [Commands](https://lexical.dev/docs/concepts/commands), [AGENTS.md](https://github.com/facebook/lexical/blob/main/AGENTS.md) — dependency-free engine + framework-neutral extension API + separate React binding; all `register*` return teardown functions.
- ProseMirror — [Guide](https://prosemirror.net/docs/guide/), [Reference](https://prosemirror.net/docs/ref/), [`plugin.ts`](https://github.com/ProseMirror/prosemirror-state/blob/master/src/plugin.ts) — four required modules; `PluginSpec` with optional `props`/`state`/`view`/`filterTransaction`/`appendTransaction`.
- VS Code — [Source Code Organization](https://github.com/microsoft/vscode/wiki/source-code-organization), [Contribution Points](https://code.visualstudio.com/api/references/contribution-points), [Extension Anatomy](https://code.visualstudio.com/api/get-started/extension-anatomy), [Extension Host](https://code.visualstudio.com/api/advanced-topics/extension-host), [`instantiation.ts`](https://github.com/microsoft/vscode/blob/main/src/vs/platform/instantiation/common/instantiation.ts) — declarative `contributes` vs runtime `activate`; service-identifier DI to steal the *idea* from, not the runtime.
- JupyterLab — [extension points](https://jupyterlab.readthedocs.io/en/latest/extension/extension_points.html), [commands](https://jupyterlab.readthedocs.io/en/4.0.x/user/commands.html), [extensionmanager-extension](https://github.com/jupyterlab/jupyterlab/blob/main/packages/extensionmanager-extension/src/index.ts) — token-based `requires`/`optional` DI and a centralized command system.
- Figma — [Plugin Manifest](https://developers.figma.com/docs/plugins/manifest/), [How plugins run](https://developers.figma.com/docs/plugins/how-plugins-run/), ["How we built the Figma plugin system"](https://www.figma.com/blog/how-we-built-the-figma-plugin-system/) — capabilities gating, sandbox reasoning (deferred).
- Godot — [Making plugins](https://docs.godotengine.org/en/stable/tutorials/plugins/editor/making_plugins.html); Cyclops Level Builder — [design doc](https://github.com/blackears/cyclopsLevelBuilder/blob/master/doc/design.md); Unity Grid Level Editor — [repo](https://github.com/SinlessDevil/UnityGridLevelEditor) — editor-plugin lifecycle, docks, command/tool classes, multi-cell footprints.
- Tiptap — [Extension API](https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/extension), [Extension system](https://tiptap.dev/docs/editor/core-concepts/extensions) — `ExtensionManager` resolve/validate/sort, priority ordering, override-by-name, `chain()`/`can()`.
- Monaco — [typedoc](https://microsoft.github.io/monaco-editor/typedoc/) — `registerCommand`, `addKeybindingRule(s)`, `addAction`/`IActionDescriptor`, `registerEditorOpener`, language registration.
- RJSF — [registry pattern](https://deepwiki.com/rjsf-team/react-jsonschema-form/2.3-registry-pattern) — layered field/widget override precedence (the model for the field-editor registry).
- PlayCanvas [Assets Panel](https://developer.playcanvas.com/user-manual/editor/assets/asset-panel/), ezEngine [Asset Browser](https://ezengine.net/pages/docs/assets/asset-browser.html), Blender [Asset Browser](https://docs.blender.org/manual/en/4.4/editors/asset_browser.html), Entangle UI [AssetBrowser](https://www.entangle-ui.dev/components/editor/asset-browser/) — canonical asset-browser feature set (`ref`/`ref-all`, filters, thumbnails, virtualization).
- CKEditor 5 — [Undo/Redo](https://ckeditor.com/docs/ckeditor5/latest/features/undo-redo.html) — batched operations, selective revert.
- React — [`useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore), [React Labs 2025-04-23](https://react.dev/blog/2025/04/23/react-labs-view-transitions-activity-and-more), [facebook/react#34556](https://github.com/facebook/react/issues/34556) — mandatory signal bridge; tearing prevention; transition bail-out.
- Alistair Cockburn — [Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture); AWS — [hexagonal pattern](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/hexagonal-architecture.html) — ports/adapters, adapter-indirection caveat.
- Semantic Versioning 2.0.0 — [spec](https://github.com/semver/semver/blob/master/semver.md); Rust RFC 1105 — [API evolution](https://github.com/rust-lang/rfcs/blob/master/text/1105-api-evolution.md); Agent Host Protocol — [Versioning](https://docs.patterson.sh/specs/ahp/versioning); AdCP — [Versioning](https://docs.adcontextprotocol.org/docs/reference/versioning) — declared public surface, capability-gated → baseline, deprecate-then-remove policy.
- `@microsoft/api-extractor` — [api-extractor.com](https://api-extractor.com/) — the `.api.md` report pattern; `tsdown` — [migrate from tsup](https://tsdown.dev/guide/migrate-from-tsup), [dts](https://tsdown.dev/options/dts) — deferred build tooling; `zod/mini` — [docs](https://zod.dev/packages/mini), [bundle-size repo](https://github.com/paulbrimicombe/zod-bundle-sizes) — optional validation, deferred.
- Fowler / Microsoft Architecture Center — Strangler Fig and "branch by abstraction" for in-process extraction — the strangler sequence's mental model.

### Tertiary (LOW confidence — single source or community write-up, flagged inline in the source files)
- Microkernel/plugin-architecture guides and "how to design a plugin system" posts (extension points, lifecycle, two-phase init, narrow `HostContext`, validate-then-activate) — used only as corroboration, and their recommendations are deliberately deferred to the plugin milestone.
- `loom.js` architecture, `km-geoboard` typed plugin registry, Commerce Layer's deprecation-proxy refactoring write-up, the OTT-monorepo retrospective, and `skills-hub` package-boundary hard rules — corroborating the two-registry split, proxy singletons, negative-space package contracts, and the small-bytes-at-a-time migration discipline.
- React Context performance articles — context re-renders all consumers and `useMemo` does not fix a re-rendering provider; mitigations (split contexts, create-once object, `useSyncExternalStore`) are the recommended ones.
- STS ops / ADR-011 scoped-service-provider quote, reproduced in ARCHITECTURE.md as external data: the host root service provider is never passed to the plugin. Treated as untrusted external evidence, corroborating the narrow-context rule.

---

*Research synthesized: 2026-09-20*
*Inputs: STACK.md (467 lines), FEATURES.md (276), ARCHITECTURE.md (823), PITFALLS.md (538), PROJECT.md (99)*
*Cross-dimension divergences resolved: 6 (naming, registration failure policy, package directory, subpath names, capability build order, extension-mechanism shape)*
*Ready for roadmap: yes — suggested 12 phases, 3 flagged for phase-specific research*
