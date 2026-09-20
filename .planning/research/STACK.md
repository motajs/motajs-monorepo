# Stack Research

**Domain:** Engine-agnostic, extensible code/table/map/asset editor core (`@motajs/editor-core`)
**Researched:** 2026-09-20
**Confidence:** HIGH (headline recommendation) / MEDIUM-HIGH (specific tooling picks)

## Executive Answer

**This milestone should add zero new runtime dependencies.** The entire "extensible editor core" problem — extension points, plugin registration, dependency injection, host-agnostic packaging — is solved in the mature editors by *structure*, not by libraries:

- **tldraw** ships `@tldraw/editor` (engine-agnostic-ish core) + `@tldraw/store` + `@tldraw/state` + `@tldraw/tlschema` + `@tldraw/validate`, and gets extensibility from `ShapeUtil` subclasses + a `shapeUtils` array passed to the `<Tldraw>` component. Registration is an array literal. No plugin framework ([tldraw shapes docs](https://tldraw.dev/docs/shapes), [ShapeUtil ref](https://tldraw.dev/reference/editor/ShapeUtil)).
- **Lexical** explicitly split into a dependency-free `lexical` core engine + a framework-neutral Extension API (`defineExtension`, `buildEditorFromExtensions`) + a *separate* React binding (`@lexical/react`, `LexicalExtensionComposer`). Its docs state the core "doesn't directly concern itself with things that monolithic editors tend to do – such as UI components, toolbars or rich-text features. Instead the logic for those features can be included via a plugin interface" ([Lexical packages](https://lexicaljs.org/docs/packages/lexical), [Lexical Extensions](https://lexical.dev/docs/extensions/intro)).
- **ProseMirror** gets extensibility from `EditorState` + `Plugin`/`PluginSpec` — a plain data spec object with optional `props`/`state`/`view`/`filterTransaction`/`appendTransaction` fields ([prosemirror-state plugin.ts](https://github.com/ProseMirror/prosemirror-state/blob/master/src/plugin.ts)).

All three use plain TypeScript interfaces, `Map`-backed registries, and constructor/array registration. None pull in a DI container, a hook bus, or an event emitter. That is the stack: **plain TS + React Context + typed registries**, with the only *new* dependencies being dev-time quality gates (boundary linting, packaging validation, API-surface reports).

**Second finding: this is a "branch by abstraction" refactor, not a rewrite.** Fowler's in-process cousin of Strangler Fig is the right mental model: create the abstraction, move callers behind it, build the new implementation against it, switch incrementally, then delete the temporary abstraction ([Steve Kinney: Strangler Fig](https://stevekinney.com/courses/enterprise-ui/strangler-fig-introduction)). This means the stack work here is *enabling* work — nothing may force a version bump of the app's runtime.

**Third finding (important, actionable):** TypeScript's `latest` tag is now **7.0.2** (published 2026-07-08), and Vite `latest` is **8.3.0**, Vitest `latest` is **5.0.1**, ESLint `latest` is **10.11.0**. The repo is on TS 5.9.3 / Vite 7.3.1 / Vitest 4.0.18 / ESLint 9.39.2. Because `typescript-eslint@8.70.0` declares `peerDependencies.typescript: ">=4.8.4 <6.1.0"` and `@vitejs/plugin-react@6.1.1` declares `peerDependencies.vite: "^8.0.0"`, **upgrading the toolchain during a pure-refactor milestone would break lint and the React plugin**. Do not move them. See "Version Compatibility" below.

---

## Recommended Stack

### Core Technologies — pin, do not move

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| TypeScript | **5.9.3** (repo) | Language for all layers | `latest` is 7.0.2 (native/Go compiler line) with 6.0.0-beta as a bridge. `typescript-eslint@8.70.0` peer-caps at `<6.1.0`, so TS 7 is unsupported by the lint toolchain today. A pure-refactor milestone must not couple "extract a package" to "adopt a new compiler implementation". **Confidence: HIGH** (registry metadata + peer ranges verified 2026-09-20) |
| React / React DOM | **19.2.3** (repo; 19.3.0 available) | UI runtime for the core's shell + bindings | React 19 is where `useSyncExternalStore` is the sanctioned external-store bridge and `use()` reads context. 19.3.0 is a patch-line move with no feature need here; defer to the `editor-next`/plugin milestone. **Confidence: HIGH** |
| Vite | **7.3.1** (root `overrides`) | Bundles `@motajs/editor`; resolves editor-core source | Root `pnpm-workspace.yaml` `overrides.vite: 7.3.1` is load-bearing. `@vitejs/plugin-react@6.x` requires Vite 8; the repo's `5.1.2` pairs with Vite 7. Moving either is a coupled upgrade. **Confidence: HIGH** |
| pnpm | **11.10.0** + workspace `catalog:` | Dependency governance | The catalog is the version-pinning mechanism already in force. New deps MUST be declared in `pnpm-workspace.yaml` `catalog:` and referenced as `catalog:default` (repo convention), not pinned inline. **Confidence: HIGH** |
| alien-signals | **3.1.2** (repo; 3.2.1 available) | Reactivity primitive inside the model/memory layer | Verified: `alien-signals@3.2.1`'s `exports` map contains **no React entry point** — it is deliberately framework-agnostic. That is exactly the property editor-core needs: keep signals in the engine-agnostic layer, expose them to React through a thin binding. **Confidence: HIGH** (exports map read from registry) |
| PandaCSS | **1.8.1** (repo) | Styling for core-owned shell | Already the editor's styling system. Keep it; the risk to manage is PandaCSS's `syntax: template-literal` codegen scanning a package that lives outside the app directory. **Confidence: MEDIUM** — the exact `panda.config.ts` `include` globs for `packages/libs/editor-core/src/**` were not verified and need a spike. |

### Architectural stack shape (this is the real "stack decision")

Four layers with **hard, lint-enforced import rules**. This is the single most important recommendation in this document.

```
packages/apps/editor  (§3 adapter: mota-js semantics + host protocol)
        │  depends on ↓ only
packages/libs/editor-core  (§2 core: engine-agnostic shell + 4 blocks)
        │  depends on ↓ only
packages/libs/editor-core/{code,table,map,asset}  (§1 leaf subsystems)
        │
        └── @motajs/react-* , alien-signals, monaco-editor, pixi.js, antd, blockai … (no app imports, no fs, no engine)
```

| # | Layer | Contains | May import | MUST NOT import |
|---|-------|----------|-----------|-----------------|
| 1 | Block internals | `src/{code,table,map,asset}/**` | sibling block's public dir only | other block's internals, `src/shell/**` |
| 2 | Core shell + contracts | `src/core/**`, `src/react/**` | layer 1 public entries, `react`, `alien-signals` | `@motajs/editor`, any host, `node:fs`, `fs/promises`, engine types |
| 3 | Engine adapter | `packages/apps/editor/src/**` | everything | — |
| 4 | Host | `vite-plugin-mota-server.ts`, `service-worker/src/server/**` | — | `editor-core` internals |

**Why:** the project constraint is `editor-core` must not import host or engine code and must not read files. A documented table is not enough — unenforced boundaries rot during a refactor. Enforce with `dependency-cruiser` rules in CI (see Supporting Libraries). **Confidence: HIGH** on the need; the exact rule syntax is standard.

### Extension mechanism: hand-rolled typed registry + versioned descriptors

**Recommendation: implement a ~80-line typed registry in the core. Add no dependency for the registration mechanism itself.**

Pattern (synthesised from tldraw / Lexical / ProseMirror — all three do this, none with a library):

```ts
// editor-core/public/registry.ts  (illustrative shape, not final API)
export const EDITOR_CORE_API_VERSION = 1 as const;

export interface ExtensionPoint<TDescriptor> {
  readonly id: string;
  register(descriptor: TDescriptor): () => void; // returns disposer
  get(id: string): TDescriptor | undefined;
  all(): readonly TDescriptor[];
  subscribe(onChange: () => void): () => void;
}
```

Rules that the prior art supports:

1. **String-id + typed value, `Map`-backed.** tldraw keys shapes by `static override type`; Lexical registers node classes by `getType()`; VS Code keys contributions by `viewType`/`command`. A string id is the interoperable handle across the package boundary.
2. **Registration returns a disposer** (`() => void`). Lexical's `registerCommand`/`registerUpdateListener` and ProseMirror's `PluginView.destroy` both do this. It makes hot-reload and test isolation tractable.
3. **Duplicate-id policy is explicit and throws** — Lexical's `invariant` on unknown commands and tldraw's duplicate-type behaviour both fail loudly. Silent last-wins is the pitfall.
4. **Version-check at registration, not at build.** Each descriptor carries `apiVersion`; the registry rejects `apiVersion !== EDITOR_CORE_API_VERSION`. For a *range*-tolerant contract use semver: `semver@7.8.5` `satisfies()`. Evidence that version+caps negotiation is the right shape: the repo already uses numbered protocols (Environment v1, Runtime v4, Editor Update v2, Manifest schema v2), and the AHP protocol spec documents the standard "offer list → host picks → capability flags → graceful degradation" handshake ([AHP Versioning](https://docs.patterson.sh/specs/ahp/versioning)).
5. **Capability flags ship with the version.** AHP's "capabilities first, then required" two-stage promotion is the model: new behaviour lands behind a flag, then graduates into the next protocol version. Apply this to the hook interfaces one engine at a time.
6. **`configure()` static for customising built-ins.** tldraw's `ShapeUtil.configure(...)` lets a consumer tweak a built-in shape without subclassing it. This is a *direct* answer to the requirement "四大块对定制者开放" — it gives third parties an in-place customisation path that costs far less surface area than a full override system.
7. **Migrations are per-descriptor and sequenced.** tldraw attaches `static migrations` to each `ShapeUtil` (`MigrationSequence | TLPropsMigrations`). Relevant here only as a shape to copy if/when a customisation changes persisted data — the core itself must not own engine file formats.

**Why not a library for this:**

| Candidate | Version | Verdict |
|-----------|---------|---------|
| `hookable` (unjs) | 6.1.2 | *Defer.* Excellent for sequential/parallel async pipelines with bail-on-truthy semantics (it is how Nitro/Nuxt plugins hook). But it is a generic hook bus, not a typed extension registry, and it adds a runtime dep for behaviour the four blocks mostly don't need yet. Right tool **when plugin lifecycle lands**. |
| `tapable` | 2.3.3 | *No.* Webpack-internal heritage; untyped-ish, large surface, Hook/AsyncSeriesWaterfall naming aimed at compiler pipelines. No React ecosystem usage. |
| `mitt` / `nanoevents` | 3.0.1 / 10.0.0 | *No.* Bare pub/sub with no typing discipline and no registry semantics. Solving a problem we don't have. |
| `xstate` | 5.33.2 | *No.* A statechart runtime is a legitimate choice for the editor *workflow*, but it is not an extension-point mechanism and would be a very large addition to a pure refactor. |

**Confidence: HIGH** that no library is needed this milestone; **MEDIUM** on `hookable` being the eventual pick for plugin lifecycle (that decision belongs to the plugin milestone).

### Dependency injection: React Context as composition root. No DI container.

**Recommendation: one composition root, one provider, split contexts, `useSyncExternalStore` for the reactive parts.**

```tsx
// editor-core/public/react/EditorCoreProvider.tsx  (illustrative)
const EditorCoreContext = createContext<EditorCore | null>(null);   // stable, never re-created
const RegistryContext   = createContext<RegistryBag | null>(null);  // per-mount registries
const ProjectContext    = createContext<ProjectView | null>(null);  // host-injected data view

export function useEditorCore(): EditorCore { /* throws if missing provider */ }
export function useRegistrations<K extends keyof RegistryBag>(k: K) { /* useSyncExternalStore */ }
```

Why this is the correct DI in React 19:

- **The container IS the component tree.** React's own composition is dependency injection: the provider sets the binding, hooks are the injection points. A parallel container duplicates a mechanism the framework already provides, and it cannot participate in Suspense/transitions.
- **Context value identity is the one real hazard.** Verified pitfall: "each time a value inside the context changes, all components that consume it are re-rendered, even if the value they actually use remains the same" — and wrapping in `useMemo` does **not** fix a provider that re-renders ([Armand Dusart, contexts pitfalls](https://medium.com/@dusartarmand/mastering-reactjs-contexts-avoid-the-pitfalls-and-boost-your-performance-f0a25a48b3b9)). Mitigations, in order: (a) split into multiple contexts by change frequency, (b) keep the `EditorCore` object **created once per mount and never re-created** (the state lives *inside* it), (c) route high-frequency values through `useSyncExternalStore(store.subscribe, store.getSnapshot)` rather than through context.
- **`useSyncExternalStore` is mandatory for the signal bridge**, not an optimisation: it is what prevents tearing when a non-React store mutates mid-render ([React docs](https://react.dev/reference/react/useSyncExternalStore)). Corroborating evidence from a live React issue: swapping `useEffect`+`useState` subscription for `useSyncExternalStore` fixed a React 19.1/19.2 bug where an effect did not re-run after dependency changes ([facebook/react#34556](https://github.com/facebook/react/issues/34556)). **Confidence: MEDIUM-HIGH** on the mechanism, HIGH on the requirement to use it.
- **Known cost:** React's own guidance notes `useSyncExternalStore` "forces a bail out from concurrent features like transitions" ([React Labs, 2025-04-23](https://react.dev/blog/2025/04/23/react-labs-view-transitions-activity-and-more)). Accepted here: map/code/table/asset editing is memory-first and synchronous by design.

**Why not a DI container:**

| Candidate | Version | Why not |
|-----------|---------|---------|
| VS Code `IInstantiationService` pattern | (in-repo approach) | The *pattern* is worth stealing: service interface + `createDecorator` service identifier + constructor injection + `createChild` scoped services ([instantiation.ts](https://github.com/microsoft/vscode/blob/main/src/vs/platform/instantiation/common/instantiation.ts)). But it is built for **class constructor injection with decorators and explicit ownership/disposal** — a Node/Electron extension-host model. Editor-core is a browser React package with hook-based composition; importing this would mean either TypeScript legacy decorators or hand-written `$di$dependencies` static metadata, plus a disposal protocol we do not need. **Steal the token idea, not the runtime.** |
| JupyterLab token DI | (Lumino `Token`/`PluginRegistry`) | Same conclusion, with a useful signal: JupyterLab's plugins declare `requires: [...]` / `optional: [...]` token arrays and receive resolved values as `activate()` arguments ([extension_points](https://jupyterlab.readthedocs.io/en/latest/extension/extension_points.html), [extensionmanager-extension](https://github.com/jupyterlab/jupyterlab/blob/main/packages/extensionmanager-extension/src/index.ts)). If plugin loading arrives, this is the cheapest credible design. **Not this milestone** (explicitly out of scope). |
| `tsyringe` | 4.10.0 | Legacy `experimentalDecorators`. Incompatible ergonomics with modern TS + React function components. Archived-ish maintenance signals. **No.** |
| `inversify` | 8.2.3 | Most capable container, but the heaviest: decorators, reflection metadata, explicit container modules, and a documented React pain point (unstable container identity across renders). Over-engineered for a 4-block editor. **No.** |
| `awilix` | 13.0.5 | Proxy-based, no decorators — the best container ergonomics of the group. Still adds a runtime dep and an indirection layer for a dependency graph that is already expressed by the component tree. **No.** |
| `typed-inject` | 5.0.0 | Type-safe constructor injection without decorators. Closest to acceptable. Still unnecessary. **No.** |
| `brandi` / `iti` | 5.1.0 / 0.8.0 | Small, but low adoption and no React-19 evidence. **No.** |
| `effect` | 3.22.2 | `Effect`'s `Context`/`Layer` gives *genuinely excellent* DI with resource scoping and typed errors. But adopting Effect is an architecture decision for the whole codebase, not a packaging decision, and it would dominate this milestone's review. **Explicitly defer** — flag it in PITFALLS as a temptation. |

**Confidence: HIGH.** The negative claims here are about (a) decorator-based containers not fitting React function components — well-established; (b) container-based DI being unnecessary given the component tree — architectural judgement from evidence, not a doc claim.

### Contract validation (optional, adapter-owned)

**Recommendation: do NOT make a validation library a hard dependency of `editor-core`.**

Why: the heavyweight validation in tldraw is `@tldraw/validate`'s `T` validators, and its job is validating **every store record on every write** ([ShapeUtil props/migrations](https://tldraw.dev/reference/editor/ShapeUtil)). editor-core does not own persisted records — the engine adapter does. Here, validation only needs to run **at registration time**, where cost is irrelevant. A hand-written `assertDescriptor()` does that job for free.

If structured validation is wanted anyway (e.g. a capability manifest, or validating host-injected hook payloads at the boundary):

| Library | Version | Verdict |
|---------|---------|---------|
| `zod` | **4.6.5** | **Recommended if you add one.** v4 core is ~5.4 kB gzip and `zod/mini` is ~1.9 kB with full tree-shaking — but only when imported as `import * as z from "zod/mini"`; named imports measurably defeat the tree-shaking ([zod mini docs](https://zod.dev/packages/mini), [bundle-size matrix](https://github.com/paulbrimicombe/zod-bundle-sizes)). Zod's real differentiator is that its ecosystem already includes `toJSONSchema` and a documented "for library authors" integration path. Already in the repo catalog at `^4.2.1` (`h5animate`). **If used: import from `zod/mini` in editor-core; expose schemas, never force consumers to use zod.** |
| `valibot` | 1.5.0 | Smallest (~1.4 kB gzip) and best per-import tree-shaking, but a second validation idiom in a repo that already has zod. **No.** |
| `arktype` | 2.2.3 | Fastest and TS-syntax-native, ~10 kB. Speed is irrelevant at registration time. **No.** |
| `@sinclair/typebox` | 0.34.52 | Schema-as-data with JSON-Schema output. More useful if engine file formats needed a shared schema — which the core must not own. **No.** |
| `ajv` | 8.20.0 | JSON Schema validator, not a TypeScript-first authoring tool. **No.** |

**Confidence: HIGH** on the "not a hard dependency" recommendation; **MEDIUM-HIGH** on zod 4 + `zod/mini` being the right choice if one is added.

### Supporting Libraries — dev/quality gates only

Every item below is a **devDependency**. None ships in the editor artifact.

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `dependency-cruiser` | **18.3.1** | Enforce the layer table above as machine-checked rules | **Add now.** This is the only way to make "core must not import host or engine code" a fact rather than a comment. Supports `forbidden` rules by path + `not-to`/`to` patterns, runs as a CLI, no ESLint coupling. Actively maintained (modified 2026-09-14). |
| `eslint-plugin-boundaries` | **7.2.0** | Alternative/companion boundary linting inside ESLint | Optional. Merges into the existing `eslint.config.js` flat config. Peer `eslint >=6.0.0`. Choose **one** of this or `dependency-cruiser` for path rules; don't duplicate. `dependency-cruiser` is preferred because it also catches non-ESLint-visible imports (type-only, dynamic, `require`). |
| `publint` | **0.3.24** | Validates `package.json` `exports`/`types`/`files` resolve correctly | **Add before publishing** (i.e. the plugin milestone). Catches the classic "types point at a file that isn't in `files`" bug. |
| `@arethetypeswrong/cli` | **0.18.5** | Detects ESM/CJS masquerading and wrong `.d.ts` resolution modes | **Add with `publint`**, once editor-core is consumed by anything outside the workspace. |
| `tsdown` | **0.23.0** | Bundler for the publishable `dist` build | **Defer the build; adopt tsdown when it's needed.** It is the Rolldown-based successor to `tsup` (which is at 8.5.1, last published 2025-11-12 — i.e. in maintenance), and its own defaults do the right thing: `dts` auto-enables from a `types` field, `clean: true`, and built-in `exports: true`, `publint: true`, `attw: true` options ([tsdown migrate-from-tsup](https://tsdown.dev/guide/migrate-from-tsup), [SKILL reference](https://github.com/rolldown/tsdown/blob/main/skills/tsdown/SKILL.md)). **Requires Node ≥ 22.18.0 to run the build** — satisfied by CI (Node 24) and by this machine (v22.18.0). Note `splitting: false` is no longer supported; code splitting is always on. |
| `@microsoft/api-extractor` | **7.59.1** | Emit a reviewed `.api.md` public-API report and fail CI when the surface changes unintentionally | **Add when the public surface stabilises.** This is the industry answer to "API surface strategy": detect the exported surface, capture contracts in a diffable report, warn on missing/inconsistent visibility, and support `@alpha`/`@beta`/`@public` graduation ([api-extractor.com](https://api-extractor.com/)). The report lives in git so every surface change shows up in review. |
| `@changesets/cli` | **3.0.3** | Version + changelog the package | **Not yet.** There is no `.changeset/` directory in the repo and every lib sits at `1.0.0` unpublished. Introducing Changesets before editor-core has any external consumer is process overhead with no reader. Add it in the milestone that publishes. |
| `knip` | **6.37.0** | Finds unused files/exports/deps in a monorepo | Useful **during** the extraction: it catches code the four blocks left behind and dependencies the extracted package no longer needs. Run ad hoc, don't gate CI on it initially. |
| `react-error-boundary` | **6.1.5** | Isolate a crashing block from the shell | Peer `react ^18 || ^19`. A registry-driven shell that renders four independently-extensible blocks should not let one block's throw blank the editor. Small, well-maintained. |
| `vitest` (+ `expectTypeOf`) | **4.0.18** (repo) | Unit tests **and type-level contract tests** | **Already present.** The critical addition is not a dependency but a practice: for `ExtensionPoint<TDescriptor>`, `defineExtension()`, and hook interfaces, the *types are the contract*. Add `vitest --typecheck` so a weakening of a descriptor type fails CI. |
| `@testing-library/react` | 16.3.3 (repo 16.3.2) | Render the shell + a fake engine adapter | **Already present.** The decisive test is a "fake adapter" render test: mount the core with a stub hook implementation and assert all four blocks wire up. This is the type-safe analogue of hexagonal-architecture contract testing. |
| `fast-check` | **4.10.2** (repo 4.5.3) | Property tests for command inverse-ops and registry invariants | Already present. Registry property to test: register/dispose sequences always return the store to its prior observable state. |

### React 19 patterns to follow inside the core

| Pattern | Recommendation | Why |
|---------|----------------|-----|
| Signals → React | `useSyncExternalStore(subscribe, getSnapshot, getSnapshot)` inside a private hook; never read a signal directly in render | Prevents tearing under concurrent rendering; this is the documented bridge ([React docs](https://react.dev/reference/react/useSyncExternalStore)) |
| Provider reads | React 19 `use(Context)` in the consumer hooks | The repo is already React 19; `use()` is the current idiom and reads context inside conditionals/loops |
| Slots / polymorphic rendering | Plain **`render` props and compound components** (`<Block>{...}</Block>`), not a slot library | Avoids a runtime dep for a 4-block fixed layout. `@radix-ui/react-slot@1.3.3` exists and works with React 19, but its `asChild` clone-and-merge is designed for headless component libraries — overkill for a shell that must not support layout customisation this milestone |
| Error containment | One `react-error-boundary` per block region | Isolates third-party customisation failures |
| React Compiler | **Leave it on for editor-core.** Do not hand-write `useMemo`/`useCallback` in new core components | `babel-plugin-react-compiler@1.0.0` is already wired in `packages/apps/editor/vite.config.ts` via the `react()` babel plugins array. Consequence: core TSX is auto-memoised. Do not write tests that assert render counts, and avoid patterns the compiler bails on (mutating props/state during render, refs read during render) |
| Component style | Prefer `readonly` props, explicit `Props` interfaces, no default exports for components | Registry-driven rendering needs stable, greppable identifiers; default exports obscure the block→component mapping in stack traces |

**Confidence: MEDIUM-HIGH.** The `useSyncExternalStore` requirement is HIGH (documented). The "React Compiler will process core TSX consumed as workspace source" claim is **MEDIUM** and should be verified with a deliberate compile check during phase 1 — the repo's existing libs are consumed the same way (e.g. `@motajs/react-monaco-editor` exports `.tsx` via subpath `exports`), which is strong circumstantial evidence it works, but nothing in the repo explicitly asserts compiler coverage of `packages/libs/**`.

### Packaging strategy: workspace-source now, dist-ready later

**Recommendation: mirror the existing lib convention (source consumption) for this milestone, and make the switch to a built package a single, pre-planned change.**

The repo's established convention — verified in `packages/libs/{react-store,react-hooks,react-monaco-editor,utils}/package.json`:

```json
{ "main": "src", "type": "module", "exports": { ".": "./lib/index.ts" } }
```

`@motajs/react-monaco-editor` already goes further and uses **subpath `exports`**:

```json
"exports": {
  ".": "./lib/index.ts",
  "./DarkModeButton": "./lib/DarkModeButton/index.tsx",
  "./DarkModeEffect/*": "./lib/DarkModeEffect/*.tsx"
}
```

**Recommendation for `@motajs/editor-core/package.json`:**

```jsonc
{
  "name": "@motajs/editor-core",
  "version": "0.1.0",
  "private": true,                 // for now: not published this milestone
  "type": "module",
  "sideEffects": false,            // REQUIRED for good tree-shaking on subpath imports
  "exports": {
    ".":       "./lib/index.ts",
    "./code":  "./lib/code/index.ts",
    "./table": "./lib/table/index.ts",
    "./map":   "./lib/map/index.ts",
    "./asset": "./lib/asset/index.ts",
    "./react": "./lib/react/index.ts"
  },
  "peerDependencies": {
    "react": "catalog:default",
    "react-dom": "catalog:default"
  },
  "dependencies": {
    "alien-signals": "catalog:default",
    "es-toolkit": "catalog:default",
    "immer": "catalog:default",
    "ts-pattern": "catalog:default"
  }
}
```

Rationale for each decision:

1. **Subpath exports from day one, even while unpublished.** This is the cheapest possible hedge. It (a) forces the block boundaries to be real import boundaries, (b) lets `editor-next` import only `@motajs/editor-core/map` without dragging Monaco and Blockly into its bundle, (c) mirrors what tldraw does with a package-per-concern and what `@lexical/react` does with per-feature entry points. Adding subpaths later is a breaking change to review; adding them now is free. **Confidence: HIGH.**

2. **`"sideEffects": false`.** Without it, bundlers cannot drop unused subpath entry points. This is a one-line change with a large bundle payoff.

3. **`react`/`react-dom` as `peerDependencies`, never `dependencies`.** This is the single most dangerous packaging mistake available here. The pnpm resolution model makes the failure mode concrete: when pnpm installs a workspace package it symlinks it, and Node resolves `require("react")` **from the symlink target**, not from the consumer — which is why `pnpm install`-time build problems are a well-known class of bug, and why `dependenciesMeta.injected` exists to hard-link a copy ([Ish Chhabra, pnpm monorepo](https://www.ishchhabra.com/writing/pnpm-monorepo)). Two React copies ⇒ `useContext` returns the wrong context ⇒ hooks throw "invalid hook call". Declaring React as a peer dependency avoids it; so does never bundling it.

4. **No barrel file at the package root exporting everything.** A root barrel that re-exports all four blocks defeats both `sideEffects: false` and subpath resolution. `@motajs/editor-core/index.ts` should export the *contract types and the registry factory*, nothing that pulls in Monaco or PixiJS. **Confidence: HIGH.**

5. **Do not add a `dist` build this milestone.** Source consumption gives instant HMR, no build order dependency, no stale `dist`, and no declaration-map path leakage (an observed pnpm monorepo pain point: `Cmd+Click` opening `.d.ts` instead of source, fixable only with declaration maps whose absolute paths then differ per machine). The repo already works this way and `tsc -b && vite build` in the editor type-checks across the boundary. **Confidence: MEDIUM-HIGH** — the tradeoff is that editor-core cannot be consumed by a consumer outside the workspace yet, which is explicitly out of scope.

6. **The publish switch is pre-planned, not improvised.** When a third party or `editor-next` outside the workspace needs it, `pnpm`'s `publishConfig` field overrides `exports` at pack time — `publishConfig.exports` pointing at `dist`, plus a `tsdown` build — without touching workspace development ([manzt gist](https://gist.github.com/manzt/222c8e8f4ed35e74514eb756e4ba09bc), which also states the rule plainly: **never publish an "internal TypeScript package" to npm**; keep `.ts` for internal use, `.js`+`.d.ts` for the registry).

### Testing strategy

| Layer | Tool | What it proves |
|-------|------|----------------|
| Contract types | `vitest --typecheck` + `expectTypeOf` | A descriptor type did not weaken; `defineExtension()` inference still produces the right consumer types. **This is the highest-value test in the whole suite**, because the extension points *are* types. |
| Registries | `vitest` + `fast-check` | Duplicate-id throws; disposer restores prior state; registry snapshot identity is stable when nothing changed (protects `useSyncExternalStore` from infinite loops) |
| Shell + blocks | `@testing-library/react` + jsdom 26.1.0 (repo) | Mount the core with a **stub adapter** implementing the hook interface; assert all four blocks render. This is the "contract-tested port" pattern from hexagonal architecture. |
| Boundaries | `dependency-cruiser` in CI | `editor-core` never imports `@motajs/editor`, an app path, or `node:fs` |
| API surface | `api-extractor` (when stabilised) | The `.api.md` report changed ⇒ deliberate review |
| Behaviour-unchanged proof | Existing editor Vitest + Playwright suites | The milestone's actual acceptance criterion: no app test may need changing |

**Note on jsdom:** `jsdom@26.1.0` is what the repo has; `latest` is 30.1.0. Do not bump it during the refactor — jsdom majors routinely change canvas/layout behaviour and would confound "behaviour unchanged" verification. **Confidence: HIGH** on the reasoning.

---

## Installation

**This milestone: install nothing at runtime. Add only catalog entries.**

```bash
# Runtime deps for editor-core are ALL already in the repo / catalog:
#   alien-signals, immer, ts-pattern, es-toolkit, react, react-dom
#   (+ monaco-editor, pixi.js, blockly, antd for the four blocks — already editor deps)

# Dev/quality gates — add to pnpm-workspace.yaml `catalog:` FIRST (repo convention),
# then reference as "catalog:default" in package.json.
```

`pnpm-workspace.yaml` additions (proposed):

```yaml
catalog:
  dependency-cruiser: ^18.3.1
  # --- only when the corresponding milestone lands: ---
  # tsdown: ^0.23.0                 # when a dist build is needed
  # publint: ^0.3.24                 # when publishing
  # @arethetypeswrong/cli: ^0.18.5   # when publishing
  # @microsoft/api-extractor: ^7.59.1 # when the public surface stabilises
  # @changesets/cli: ^3.0.3          # when publishing
  # zod: ^4.6.5                      # only if structured contract validation is adopted
```

`packages/libs/editor-core/package.json` devDependencies:

```jsonc
"devDependencies": {
  "@motajs/config": "workspace:*",
  "@testing-library/react": "16.3.2",
  "@types/react": "catalog:default",
  "@types/react-dom": "catalog:default",
  "dependency-cruiser": "catalog:default",
  "jsdom": "26.1.0",
  "react": "catalog:default",
  "react-dom": "catalog:default",
  "vitest": "catalog:default"
}
```

Root CI addition (`.github/workflows/*`):

```bash
pnpm depcruise --config .dependency-cruiser.cjs packages/libs/editor-core
```

**Do not** run `pnpm add` with inline versions — it bypasses the catalog and creates version drift the repo has deliberately avoided.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Hand-rolled typed registry | `hookable@6.1.2` | When plugin **lifecycle** lands and you need async ordered hooks with bail-on-truthy. `hookable` is the unjs standard and fits a Nitro-style plugin pipeline. Not needed for four in-repo blocks. |
| Hand-rolled typed registry | `tapable@2.3.3` | Effectively never in a React/browser codebase. Webpack-internal heritage. |
| React Context + `useSyncExternalStore` | VS Code `InstantiationService` (tokens + decorators + `createChild`) | If editor-core becomes class/service-oriented with its own extension host and explicit disposal graph. That is an Electron/Node shape, not a browser React shape. |
| React Context + `useSyncExternalStore` | JupyterLab `Token` + `PluginRegistry` (`requires`/`optional`) | When plugins must be *resolved as a dependency graph* before activation. This is the design to copy **in the plugin milestone**, not now. |
| React Context + `useSyncExternalStore` | `effect@3.22.2` (`Context`/`Layer`) | If the whole monorepo adopts Effect for typed errors + resource scoping + DI in one system. Very strong, very invasive; a project-level decision. |
| `useSyncExternalStore` for signals | `@preact/signals-react@3.12.0` | Never here — it would add a second signal implementation and its React integration relies on internals/babel transforms. `alien-signals` stays the one primitive; write the ~15-line binding. |
| `useSyncExternalStore` for signals | `valtio@2.3.2` / `zustand@5.0.15` | If the project wanted a batteries-included store with built-in React bindings and devtools. It already has `@motajs/react-store` + `alien-signals`; adding a third store idiom would fragment the model layer. |
| Source-consumed package | Built `dist` + `publishConfig.exports` | When an out-of-workspace consumer (third-party plugin, `editor-next` in a separate repo) exists. Recipe is ready (tsdown `exports: true` + `publint` + `attw`). |
| `dependency-cruiser` | `eslint-plugin-boundaries@7.2.0` | If you want boundary errors inline in the editor and already treat ESLint as the single gate. Weaker: only sees ESLint-visible imports. |
| `tsdown` | `tsup@8.5.1` | Only if you must support Node < 22.18 for the *build* itself, or already have tsup config. `tsup` last published 2025-11-12 and is the predecessor tool. |
| `tsdown` | `unbuild@3.6.1` | If staying inside the UnJS world (Nuxt/Nitro) or you want a `stub` (no-build) dev mode. Not a fit here — this is a browser React package in a Vite workspace. |
| `tsdown` | `vite-plugin-dts@5.1.0` + Vite lib mode | If you want zero new bundler tooling and the package is only ever built by Vite. Viable fallback; weaker `exports`/`publint` integration. |
| `zod@4.6.5` via `zod/mini` | `valibot@1.5.0` | If bundle size at the *registration* boundary genuinely matters and you accept a second schema idiom. ~1.4 kB vs ~1.9 kB — not a real win here. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Any DI container** (`tsyringe`, `inversify`, `awilix`, `typed-inject`, `brandi`, `iti`) | Adds a runtime dep and an indirection layer to express a dependency graph the React component tree already expresses. Decorator-based ones (`tsyringe`, `inversify`) also force `experimentalDecorators`, which conflicts with modern TS + `isolatedModules` + React function components. | React Context as the composition root; `useSyncExternalStore` for reactive values; split contexts to control re-render scope |
| **A plugin *loader*** (dynamic import registry, activation events, manifest files) | Explicitly out of scope per PROJECT.md: "插件生态本期只留扩展点，不实现机制". Building it now creates a contract you must then keep before you have a consumer to validate it. | Define the *extension point* interfaces and registry, register the four blocks through them, and stop there. tldraw ships an entire extensible editor with `shapeUtils={[MyUtil]}` — no loader. |
| **`hookable`/`tapable` as the registration mechanism now** | A generic hook bus is not a typed extension registry; both add surface without solving the actual problem (which is descriptor typing + version checks). | Hand-rolled `ExtensionPoint<TDescriptor>` (~80 lines) + explicit `apiVersion` checks |
| **`@radix-ui/react-slot` (or shadcn-style `asChild`) as a runtime dep** | Its clone-and-merge-`asChild` API exists to make *headless component libraries* composable. The core has a fixed layout and four known blocks; this is an unnecessary runtime dep and an abstraction the layout must not expose. | `render` props / compound components / a `BlockRenderer` that reads the registry |
| **React (or React DOM) in `dependencies`** | Two React copies ⇒ wrong context object ⇒ "invalid hook call" at runtime. pnpm's symlink resolution makes this a live risk, not theoretical. | `peerDependencies` + never bundle React + single workspace `react` catalog entry |
| **A root barrel exporting all four blocks** | Defeats `sideEffects: false` and subpath `exports`; forces `editor-next` to bundle Monaco + Blockly + PixiJS to use the table editor. | Subpath entry points (`./code`, `./table`, `./map`, `./asset`, `./react`) and a root that exports contracts only |
| **Publishing TypeScript source to npm** | Consumers without the exact same tsconfig/bundler cannot compile it; `"main": "src"` packages break under `nodenext` resolution, JSDoc-only consumers, and non-bundler test runners. | Keep `.ts` `exports` for the workspace; use `publishConfig.exports` → `dist` for the registry (never publish "internal TS packages") |
| **`tsup` for new work** | Last published 2025-11-12; superseded by `tsdown` (Rolldown-based, ~3–5× faster, richer `exports`/`publint`/`attw` integration). Choosing it now means a migration later. | `tsdown@0.23.0` (when a build is actually needed) |
| **`splitting: false` assumptions / single-file output config** | `tsdown` does not support disabling code splitting — it is always on. A config copied from a `tsup` recipe will not work. | Accept splitting; use `deps.neverBundle` to externalise React and workspace peers |
| **Upgrading TypeScript to 7.x this milestone** | `typescript-eslint@8.70.0` peer-caps at `<6.1.0`; TS 7.0.2 (2026-07-08) is the native/Go compiler line. A compiler swap would make lint failures indistinguishable from refactor regressions. | Stay on `5.9.3`; schedule the TS 7 upgrade as its own milestone with `typescript-eslint` support confirmed |
| **Upgrading Vite to 8.x this milestone** | `@vitejs/plugin-react@6.1.1` requires `vite ^8`, so it is a *coupled* upgrade of Vite + plugin + (likely) Vitest + the root `overrides` entry. | Stay on Vite `7.3.1` / `@vitejs/plugin-react` `5.1.2` |
| **Upgrading ESLint to 10.x this milestone** | ESLint `latest` is now 10.11.0 while the repo is on 9.39.2 with a flat config, `@stylistic`, three React plugins and `typescript-eslint`. Flat-config plugin compatibility across a major ESLint boundary is exactly the kind of noise a "behaviour unchanged" milestone must not have. | Stay on ESLint `9.39.2` |
| **Upgrading Vitest to 5.x this milestone** | Vitest `latest` is 5.0.1; the repo is 4.0.18. Assertion/runner behaviour changes would confound "all existing tests green" as the acceptance criterion. (5.x does accept `vite ^7`, so the upgrade is *possible* — just not now.) | Stay on Vitest `4.0.18` |
| **Bumping `antd` 6.2.1 → 6.6.4, `blockly` 12.3.1 → 13.3.0, `pixi.js` 8.19.0 → 8.21.0, `monaco-editor` 0.56.0** | Blockly 12→13 is a major with API churn; antd and Pixi are live renderers inside the four blocks. Any of these changes the pixels or the API surface of a block you are simultaneously refactoring. | Freeze all four for the duration of the extraction; revisit after the four blocks are proven behaviour-identical |
| **`xstate` for editor workflow** | A statechart runtime is a legitimate architecture choice but not an extension-point mechanism, and it would dominate a packaging refactor's review. | Keep `ts-pattern` + `alien-signals` + commands/history as-is |
| **`immer` upgrades / switching away from `immer@11.1.3`** | Commands + undo/redo depend on its structural-sharing semantics; the inverse-operation history (capacity 100) is built on it. | Leave it; it is already the right tool for inverse-op history |
| **`madge`** | Last release `8.0.0`, thinner rule model than `dependency-cruiser`. | `dependency-cruiser@18.3.1` |
| **Enabling `isolatedDeclarations` now** | It would speed up future `.d.ts` generation (`tsdown` then uses `oxc-transform` instead of `tsc`) but requires explicit type annotations on every exported symbol — a large, mechanical, refactor-wide diff that competes with the actual extraction work. | Defer to the publishing milestone, where `dts` build time actually matters |

---

## Stack Patterns by Variant

**If the four blocks need to be replaceable wholesale (a consumer swaps the whole map editor):**
- Use **subpath entry points plus a registry keyed by block id**, and let the shell render `registry.get("map")`. tldraw's `shapeUtils={[...]}` array is the precedent: the component accepts the implementation list as a prop.
- Because this gives a coarser override than per-hook injection, and the PROJECT.md constraint says the four blocks are "对定制者开放" while layout is fixed, this is the natural first rung.

**If `/gsd-plan-phase` finds that engine-specific data flows through many call sites:**
- Introduce **one `EngineAdapter` interface** with narrow methods and pass it once through `EditorCoreProvider`. Lexical's `LexicalEditor` instance is passed to every plugin as the single context object; ProseMirror passes `EditorState`/`EditorView`. Both avoid ambient globals.
- Do **not** reach for a DI container to reduce prop plumbing — the provider already does that.

**If React Compiler causes an unexpected re-render or stale-closure bug in a core component:**
- Add the file to the compiler's opt-out (`"use no memo"` directive) **rather than** adding `useMemo`/`useCallback` everywhere. Mixing manual memo with the compiler is a documented source of confusion.
- Then verify the compiler is actually transforming `packages/libs/editor-core/**` by checking the built output; if it is not, the editor's `react()` plugin `include` filter needs widening. **This is a MEDIUM-confidence item that phase 1 should settle with a spike.**

**If PandaCSS fails to generate styles for classes authored inside `packages/libs/editor-core`:**
- Widen `packages/apps/editor/panda.config.ts` `include` to `../../libs/editor-core/src/**/*.{ts,tsx}` (and keep `outdir: styled-system`).
- Fallback if the codegen boundary cannot be crossed cleanly: keep core-owned chrome unstyled/inline and let the *app* own the styled wrappers. This is a real constraint worth de-risking early: `syntax: template-literal` mode means Panda scans source text, so a package outside the app's `include` silently produces no classes. **Confidence: MEDIUM** — the config's current `include` values were not read.

**If React's context churn hurts the map editor's frame budget:**
- Move the hot value (e.g. current tool / hovered tile) behind a dedicated `useSyncExternalStore` hook bound to a signal, and keep it *out* of any context.
- Accept that `useSyncExternalStore` opts out of transitions; memory-first editing wants synchronous reads anyway.

**If a third-party plugin author needs to consume `@motajs/editor-core` from outside this workspace:**
- That is the publish milestone. Concretely: add `tsdown.config.ts` (`entry: ['./lib/index.ts', './lib/code/index.ts', …]`, `dts: true`, `deps: { neverBundle: ['react', 'react-dom'] }`), set `exports: true` + `publint: true` + `attw: true`, move `exports` to `dist` via `publishConfig`, add `@changesets/cli`, and add `api-extractor` for the surface report.
- Do **not** flip to publishing while the four blocks are still being extracted — you would be versioning a moving surface.

---

## Version Compatibility

Everything below was verified against `registry.npmjs.org` on **2026-09-20**. "Repo" = currently declared in this monorepo.

| Package | Repo | `latest` (2026-09-20) | Notes |
|---------|------|----------------------|-------|
| `typescript` | 5.9.3 | **7.0.2** (2026-07-08); `beta` 6.0.0-beta | **Do not upgrade.** `typescript-eslint@8.70.0` peers `typescript: ">=4.8.4 <6.1.0"` — TS 7 is outside every released typescript-eslint peer range. Version compatibility here is the single hardest blocker in the upgrade path. |
| `react` / `react-dom` | 19.2.3 | **19.3.0** (2026-09-09) | Compatible; not needed. `react-dom@19.3.0` peers `react: ^19.3.0`, so **they must move together**. |
| `vite` | 7.3.1 (root override) | **8.3.0** (2026-09-10); `previous` 7.3.6 | The root `overrides.vite` is load-bearing. Vite 8 is a coordinated upgrade. |
| `@vitejs/plugin-react` | 5.1.2 | **6.1.1** | Peers `vite: "^8.0.0"` (plus `oxc-transform-react` / `@rolldown/plugin-babel`). **Vite 7 ⇒ stay on plugin-react 5.x.** |
| `vitest` | 4.0.18 (`catalog ^4.0.16`) | **5.0.1** (2026-09-15); `V4` = 4.1.11 | Vitest 5 peers `vite: "^6.4.0 \|\| ^7.0.0 \|\| ^8.0.0"`, so it *would* work on Vite 7. Still: don't move mid-refactor. |
| `eslint` | 9.39.2 | **10.11.0** (2026-09-18); `maintenance` 9.39.5 | ESLint 10 requires re-validating the flat config + `@stylistic` + 3 React plugins + `typescript-eslint`. Don't. |
| `typescript-eslint` | 8.53.1 (`catalog ^8.50.1`) | **8.70.0** | Safe minor bump on TS 5.9. Peer `eslint: "^8.57.0 \|\| ^9.0.0 \|\| ^10.0.0"`. |
| `monaco-editor` | 0.56.0 | **0.56.0** | Already current. Pinned exactly in catalog + `minimumReleaseAgeExclude`. |
| `blockly` | 12.3.1 | **13.3.0** | Major behind. **Freeze during the refactor** — the code block is one of the four being extracted. |
| `pixi.js` | 8.19.0 | **8.21.0** | Minor behind. Freeze during the refactor (map block). |
| `antd` | 6.2.1 | **6.6.4** | Minor behind. Freeze during the refactor (shared chrome). |
| `alien-signals` | 3.1.2 | **3.2.1** | No React export in either version (verified from the `exports` map). Safe minor; optional. |
| `jsdom` | 26.1.0 | **30.1.0** | **Do not bump.** Major DOM-behaviour drift would confound "behaviour unchanged". |
| `@testing-library/react` | 16.3.2 | **16.3.3** | Patch; safe. |
| `fast-check` | 4.5.3 (editor) / `4.5.2` (catalog) | **4.10.2** | Note the repo has **two different fast-check pins** (editor `4.5.3`, catalog `4.5.2`) — pre-existing drift, worth collapsing when convenient. |
| `tsdown` | — | **0.23.0** (2026-09-03) | Requires **Node ≥ 22.18.0** to run. CI is Node 24 ✓; local is v22.18.0 ✓. `peerDependencies.typescript` allows `^5 \|\| ^6 \|\| ^7`. |
| `tsup` | — | **8.5.1** (last published 2025-11-12) | Maintenance. Prefer `tsdown`. |
| `dependency-cruiser` | — | **18.3.1** (modified 2026-09-14) | Active. Node-only dev tool; no runtime exposure. |
| `@changesets/cli` | — | **3.0.3** (2026-09-14) | Active. Not needed until publishing. |
| `@microsoft/api-extractor` | — | **7.59.1** (2026-09-09) | Active. Not needed until the surface stabilises. |
| `zod` | `^4.2.1` (catalog, h5animate only) | **4.6.5** (2026-09-13) | Not an editor-core dep today. `zod/mini` needs `import * as z from "zod/mini"` for tree-shaking to work. |

**Node.js:** repo requires Node 24 for CI; `tsdown` needs ≥ 22.18.0 at build time; the local toolchain is Node v22.18.0. **Node 18/20 support should not be a goal** — Node 22 is the LTS floor for the 2026 toolchain.

---

## Roadmap Implications (for `SUMMARY.md`)

1. **Phase 1 must include a PandaCSS + React Compiler probe**, because both are silent-failure risks when a package moves outside the app's config scope: Panda produces *no classes* for un-included sources, and React Compiler silently *does not memoise* files outside its filter. Neither failure shows up as a compile error. Budget one spike, not one phase.
2. **The boundary rules should be written and wired into CI in the same phase that creates the package** — not later. Every subsequent phase commits code against a boundary that either existed or didn't.
3. **The extension-point interfaces are the deliverable with the longest life.** The four blocks moving is mechanical; the `ExtensionPoint<TDescriptor>` + `apiVersion` + capability-flag shape is what `editor-next` and third parties will live with. Give it the type tests (`vitest --typecheck`) and the api-extractor report.
4. **No toolchain upgrade phase.** TS 7 + Vite 8 + ESLint 10 + Vitest 5 + Blockly 13 are interlocked; treating them as one coordinated milestone *after* editor-core lands keeps "behaviour unchanged" verifiable.
5. **`editor-core` should be `private: true` this milestone.** Publishing forces a versioned contract on a surface that is still moving.

---

## Sources

| Source | What was verified | Confidence |
|--------|-------------------|------------|
| `registry.npmjs.org` (direct HTTP, 2026-09-20) | Every version number, `dist-tags`, publish dates, `peerDependencies` ranges quoted above; `alien-signals@3.2.1` `exports` map (no React entry) | **HIGH** — primary source, machine-read |
| Local repo: `pnpm-workspace.yaml`, `package.json` (root), `packages/apps/editor/{package.json,vite.config.ts}`, `packages/libs/config/tsconfig.lib.base.json`, `packages/libs/{react-store,react-hooks,react-monaco-editor,utils,config}/package.json` | Existing catalog/override discipline, source-consumption + subpath-`exports` convention, `babel-plugin-react-compiler` wiring, `.changeset` absence, `@/*` alias base | **HIGH** — primary source, read |
| [tldraw — Shapes](https://tldraw.dev/docs/shapes), [ShapeUtil ref](https://tldraw.dev/reference/editor/ShapeUtil), [`@tldraw/editor` index.ts](https://github.com/tldraw/tldraw/blob/main/packages/editor/src/index.ts) | `ShapeUtil` extension class; `static type`/`props`/`migrations`; `shapeUtils={[...]}` array registration; `ShapeUtil.configure()`; package-per-concern split | **HIGH** — official docs + source |
| [Lexical — Extensions](https://lexical.dev/docs/extensions/intro), [packages](https://lexicaljs.org/docs/packages/lexical), [Commands](https://lexical.dev/docs/concepts/commands), [Nodes](https://lexical.dev/docs/concepts/nodes), [Listeners](https://lexical.dev/docs/concepts/listeners), [creating-plugin](https://lexical.dev/docs/getting-started/creating-plugin) | Framework-agnostic core vs `@lexical/react`; `defineExtension`/`buildEditorFromExtensions`/`LexicalExtensionComposer`; `registerCommand(cmd, listener, priority)` returning a teardown; command interception by priority; node-type registration | **HIGH** — official docs |
| [ProseMirror `plugin.ts`](https://github.com/ProseMirror/prosemirror-state/blob/master/src/plugin.ts), [reference manual](https://prosemirror.net/docs/ref), [`prosemirror-view` index.ts](https://github.com/ProseMirror/prosemirror-view/blob/master/src/index.ts) | `PluginSpec` (`props`/`state`/`view`/`filterTransaction`/`appendTransaction`); `PluginView.update`/`destroy`; plugin ordering and prop resolution | **HIGH** — source + official reference |
| [VS Code — Source Code Organization](https://github.com/microsoft/vscode/wiki/Source-Code-Organization/1a0b37e98b7c941127d4482f7ab8f51f95b15eeb), [`instantiation.ts`](https://github.com/microsoft/vscode/blob/main/src/vs/platform/instantiation/common/instantiation.ts), [Contribution Points](https://code.visualstudio.com/api/references/contribution-points), [Extension Host](https://code.visualstudio.com/api/advanced-topics/extension-host) | Layer model (`base`/`platform`/`workbench`/`code`); `ServiceIdentifier` + `createDecorator` + constructor injection + `createChild`; contribution points as declarative registration | **HIGH** — official wiki + source |
| [JupyterLab — Common Extension Points](https://jupyterlab.readthedocs.io/en/latest/extension/extension_points.html), [extensionmanager-extension src](https://github.com/jupyterlab/jupyterlab/blob/main/packages/extensionmanager-extension/src/index.ts) | Token-based `requires`/`optional` DI, `autoStart`, `activate(app, ...services)`; `JupyterFrontEndPlugin` shape | **HIGH** — official docs + source |
| [AHP — Versioning](https://docs.patterson.sh/specs/ahp/versioning) | Client offers version list → host picks → capability flags checked → graceful degradation; capabilities-then-required promotion; `UnsupportedProtocolVersion` error | **MEDIUM-HIGH** — well-specified but a third-party protocol spec, not a standards body |
| [api-extractor.com](https://api-extractor.com/), [`@microsoft/api-extractor` npm](https://www.npmjs.com/package/@microsoft/api-extractor) | Public-API report (`.api.md`) tracked in git; accidental-break/missing-export/accidental-export detection; `@alpha`/`@beta`/`@public` graduation; `.d.ts` rollup | **HIGH** — official docs |
| [tsdown — Migrate from tsup](https://tsdown.dev/guide/migrate-from-tsup), [tsdown SKILL reference](https://github.com/rolldown/tsdown/blob/main/skills/tsdown/SKILL.md), [dts docs](https://tsdown.dev/options/dts), [tsdown.dev](https://tsdown.dev/) | Rolldown-based; tsup option mapping + renames; `exports: true`/`publint: true`/`attw: true`; `splitting: false` unsupported; Node ≥ 22.18.0 build requirement; `isolatedDeclarations` → oxc `dts` | **HIGH** — official docs |
| [zod — Mini](https://zod.dev/packages/mini), [zod bundle sizes (repo)](https://github.com/paulbrimicombe/zod-bundle-sizes), [zod issue #5206](https://github.com/colinhacks/zod/issues/5206) | `zod/mini` ~1.88–4 kB gzip vs ~5.36 kB standard; `import * as z` required for tree-shaking; named imports inflate the bundle | **HIGH** — official docs + reproducible third-party benchmark |
| [React — `useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore), [React Labs 2025-04-23](https://react.dev/blog/2025/04/23/react-labs-view-transitions-activity-and-more), [facebook/react#34556](https://github.com/facebook/react/issues/34556) | External-store bridge; tearing prevention; bails out of transitions; `useSyncExternalStore` fixing an effect-not-rerunning bug in React 19.1/19.2 | **HIGH** (docs) / **MEDIUM-HIGH** (issue thread — a single repro) |
| [React context pitfalls (Dusart)](https://medium.com/@dusartarmand/mastering-reactjs-contexts-avoid-the-pitfalls-and-boost-your-performance-f0a25a48b3b9) | Context re-renders all consumers on any value change; `useMemo` on the value does not help when the provider itself re-renders | **MEDIUM** — practitioner article, but consistent with React's documented model |
| [Steve Kinney — Strangler Fig](https://stevekinney.com/courses/enterprise-ui/strangler-fig-introduction), [Microsoft Architecture Center — Strangler Fig](https://github.com/MicrosoftDocs/architecture-center/blob/main/docs/patterns/strangler-fig.md) | Façade + incremental cutover; Branch by Abstraction for **in-process** extractions (create abstraction → move callers → build new impl → switch → delete); anti-corruption layer when old code must call new | **HIGH** — canonical pattern references |
| [manzt — minimal TS monorepo](https://gist.github.com/manzt/222c8e8f4ed35e74514eb756e4ba09bc), [Ish Chhabra — pnpm monorepo](https://www.ishchhabra.com/writing/pnpm-monorepo) | `publishConfig.exports` override at pack time; "never publish an internal TypeScript package"; pnpm symlink resolution and why peer deps for workspace packages are fragile; declaration-map path leakage | **MEDIUM-HIGH** — practitioner sources, consistent with pnpm's documented resolution |
| [Extension API / plugin architecture surveys](https://blog.wrujel.com/building-plugin-architecture-typescript-add58d), [Eclipse Docks — Create an extension](https://docks.eclipse.dev/docs/guide/create-an-extension.html) | Corroborating evidence for the registry + `loader: () => import(...)` + `dependencies: [...]` shape used by a real extensible platform | **MEDIUM** — secondary sources; used only for corroboration |
| Validation-library comparisons: [PkgPulse zod v4 vs valibot](https://www.pkgpulse.com/guides/valibot-vs-zod-v4-2026), [zod v4 release notes](https://zod.dev/v4) | v4 core ~5 kB gzip / 57% smaller than v3 / 14× faster string parsing; Valibot ~1.37 kB | **MEDIUM** — third-party benchmarks (PkgPulse) are semi-primary; the zod.dev numbers are primary |

### Gaps / not verified

- **PandaCSS `include` configuration for an out-of-app package** — not read from `packages/apps/editor/panda.config.ts`. Flagged as a phase-1 spike (MEDIUM confidence).
- **React Compiler coverage of `packages/libs/**`** — inferred from the existing lib convention (TSX-exporting libs consumed by the app are already working), not asserted by any repo config. Flagged as a phase-1 spike (MEDIUM confidence).
- **`dependency-cruiser` rule syntax** for the specific layer table — not validated against v18.3.1 docs. Standard usage; verify when writing the config.
- **Whether `title-case`-style `code`/`table`/`map`/`asset` subpaths match the intended block boundaries** — this is a design question, not a stack question; the *mechanism* (subpath exports) is what is recommended regardless of names.
- **No authoritative benchmark read for `alien-signals` vs `@preact/signals-react` under React 19** — the recommendation to keep `alien-signals` rests on it already being the project's primitive and being framework-agnostic, not on a measured comparison.

---

*Stack research for: engine-agnostic extensible editor core (`@motajs/editor-core`)*
*Researched: 2026-09-20*
*Method: code-seam research plan (`gsd_run query research-plan`) → 8 planned questions executed via WebSearch (Context7 unavailable in this runtime; `ctx7` CLI not installed) → all version claims re-verified directly against `registry.npmjs.org`*

