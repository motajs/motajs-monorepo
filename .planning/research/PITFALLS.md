# Pitfalls Research

**Domain:** Extracting an engine-agnostic editor core (`@motajs/editor-core`) out of a monolithic React editor, designing extension points, and refactoring for behavior parity.
**Project:** motajs-monorepo — pure refactor; external behavior unchanged (UI, Environment Protocol v1, Runtime Protocol v4, Editor Artifact Manifest v2).
**Researched:** 2026-09-20
**Confidence:** MEDIUM overall. Repository-specific findings are HIGH (verified by reading the cited files). General extraction / plugin-API / refactoring claims are LOW (web search, unverified).

**Provisional phase labels used below** (the roadmap does not exist yet — these are research proposals, not final phase names):

- **P1 Baseline** — freeze behavior and build the safety net (submodule, CI, baseline test/e2e/build artifacts, snapshots)
- **P2 Boundary** — create the workspace package, tsconfig/alias/dependency rules, error and type-contract placement
- **P3 Kernel + Hooks** — extract engine-agnostic primitives (`fs`, `Content`, history, resources) and define the engine hook contract
- **P4 Editors + Shell** — move the four editors (code/table/map/material) and the fixed shell into core; `editor` becomes the mota-js adapter
- **P5 Parity + Cleanup** — differential parity verification, delete shims, protocol/manifest freeze

---

## Critical Pitfalls

### Pitfall 1: The `@/` alias resolves differently in `tsc` than in Vite — core silently imports the editor's tree

**What goes wrong:**
The repo has two `@/` mechanisms that disagree across a package boundary:

- Vite uses `packages/libs/config/resolvePlugin.js`, which resolves `@/x` **relative to the importer's package**: a file under `packages/libs/<pkg>/` maps `@/x` to `packages/libs/<pkg>/lib/x`; a file under `packages/apps/<pkg>/` maps to `/src/x`. The plugin hard-codes the directory as `lib` for `type === "libs"`.
- TypeScript uses `paths` from a **single tsconfig program**. `tsconfig.app.base.json` maps `@/*` to `${configDir}/src/*`; `tsconfig.lib.base.json` maps `@/*` to `${configDir}/lib/*`.

Existing libs export TS source directly (`exports: { ".": "./lib/index.ts" }`) and `editor` consumes them. So when `editor` runs `tsc -b`, core's `@/...` imports resolve against the **editor's** mapping (`packages/apps/editor/src/*`), while Vite resolves the same import to core's own tree. A green `tsc` with a broken app (or vice versa) is the predictable outcome.

**Why it happens:**
The alias convention assumes one package per program. Nobody notices because today every file lives in one package.

**How to avoid:**
- Decide the directory convention before moving a file: `packages/libs/*` uses `lib/` (forced by `resolvePlugin.js` and `tsconfig.lib.base.json`). Do **not** create `packages/libs/editor-core/src/`.
- Prefer **relative imports inside core** (no `@/` self-imports), or add a dedicated core `tsconfig` with explicit `paths`, and prove `tsc -b` and Vite resolve identically.
- Add CI that runs both `tsc -b` (a new `typecheck` script) **and** a Vite build; never rely on one alone.

**Warning signs:**
- `tsc -b` passes but `pnpm dev` fails to resolve a module, or shows stale editor code.
- A core file imports something that does not exist in core yet still compiles.
- Tests import a symbol from core but receive the editor's implementation.

**Phase to address:** P2 (boundary scaffolding), re-verified in P4.

---

### Pitfall 2: "All tests pass" is not behavior parity — the verification net does not currently run

**What goes wrong:**
The milestone's success criterion is "existing tests green + manual acceptance." But the repo has no PR CI (only a manual `workflow_dispatch` deploy), no `typecheck` script for the editor, e2e never runs in CI, and host e2e is conditionally skipped (`test.skip(!withEditor, ...)` in `packages/apps/service-worker/e2e/project-host.spec.ts`). Unit tests cannot even start without the `packages/external/mota-js` submodule, because `vite.config.ts` imports `MOTA_JS_ROOT` from `mota-root.ts`, which throws at config load. A refactor of this size can therefore be "verified" while the only end-to-end write-path test never ran.

**Why it happens:**
"Tests green" is cheap to claim and expensive to actually establish when the harness is partially broken and environment-dependent.

**How to avoid (P1, before touching code):**
- Initialize the submodule and record a **baseline run**: full unit suites per package, e2e suites, a production build, artifact sizes, and the emitted `editor-manifest.json`.
- Add a PR CI workflow running lint + per-package typecheck + unit tests + build; add root `typecheck`/`test` fan-out scripts.
- Convert silent e2e skips into required fixtures or CI-visible markers so "skipped" is never reported as "passed".
- Treat baseline numbers as the parity target; a count going down must be explained, not ignored.

**Warning signs:**
- "CI will come later" or "I ran the tests locally" without a recorded baseline.
- e2e output contains skips nobody reads.
- The test command fails at config load and someone sets `MOTA_JS_ROOT` to make it pass without understanding why.

**Phase to address:** P1 — without it every later phase is unverifiable.

---

### Pitfall 3: mota-js file-structure assumptions leak into core as "defaults"

**What goes wrong:**
The current semantic layer is saturated with literal mota-js paths and formats:
- `packages/apps/editor/src/project/data/projectData.ts`: `project/data.js`, `project/items.js`, `project/enemys.js`, `project/maps.js`, `project/icons.js`, `project/functions.js`, `project/plugins.js`, `project/events.js`, `project/floors/{id}.js`, and the magic var name `events_c12a15a8_c380_4b28_8144_256cba95f760`.
- `packages/apps/editor/src/runtime/RuntimeResourceGateway.ts`: maps the literal `project/data.js` to `projectData.tower()`, etc., and gates all resources with `path.startsWith("project/")`.
- `packages/apps/editor/src/project/history/materialOperations.ts`: `project/autotiles`, `project/materials/{collection.images}.png`.
- `packages/apps/editor/src/MapEditor/rendering/spriteResolver.ts` and `floorImages.ts`: `project/tilesets/...`, `project/images/...`.
- `packages/apps/editor/src/runtime/iframeEntry.ts`: `project/animates/*.animate`, `project/fonts/*.ttf`, `project/bgms/*`, `project/sounds/*`.

If even a few survive as core defaults (convenient today because there is only one engine), the new engine inherits mota-js's file layout and the extraction fails its core value.

**Why it happens:**
Moving code is mechanical; removing assumptions requires rethinking the contract, and with only mota-js as a consumer the leak is invisible.

**How to avoid:**
- Core accepts engine descriptors (logical resource id, format codec, text/binary, opaque path key) and never builds `project/...` strings or inspects file extensions.
- The engine adapter (`@motajs/editor`) owns every literal path and every mota-specific format (`Json2x`, `.animate`, `.comment.js`, tileset layout).
- Add a mechanical guard: a lint/dependency check that fails if core source contains `project/`, `mota`, `tower`, `floor`, `loc`, `enemy`, `autotile`, or `events_` identifiers or literals.

**Warning signs:**
- Core public API names mention game concepts (`tower()`, `floor(id)`).
- A "default" path value appears in core.
- The hook interface cannot be implemented without mota-js knowledge.

**Phase to address:** P3 (kernel + hooks), re-audited in P4.

---

### Pitfall 4: Core keeps its own file access (default `Fs`, environment parsing, direct fetch)

**What goes wrong:**
`FileHandler` and friends default to the `defaultFs` singleton from `src/services/fs/fs.ts`, and host config is read from the DOM in `src/environment.ts`. If core pre-moves any code that imports those, core reads files and assumes host shape, violating the hard constraint "core 不假设引擎文件结构、不擅自读取任何文件" — and making core untestable without HTTP stubs or a DOM.

**Why it happens:**
Default parameters (`fs: Fs = defaultFs`) make it work with zero wiring, so the coupling is invisible. Extraction forces the default to move.

**How to avoid:**
- Core must have **no default `Fs`**; the editor composition root injects it (this is already a documented extension point — keep it).
- Core exposes a `createEditorCore(config)` factory (mirroring `initializeEditorEnvironment()`); only the editor reads the environment and locates the host.
- Boundary rule: core may not import `@/services/fs`, `@/environment`, or anything referencing `window`/`document`/`fetch`/host URLs.

**Warning signs:**
- A core test needs a jsdom HTTP mock or a DOM.
- Core imports a module that touches `window`/`document` at import time.
- A hook is optional "because core has a default path anyway".

**Phase to address:** P2/P3.

---

### Pitfall 5: Hook registration races module initialization (import-time singletons win)

**What goes wrong:**
The editor is built on module-level singletons created at import time: `projectData`, `projectModel`, `operationHistory`, `FileHandlerManager`, `persistenceMonitor`, `editorConfigService`, plus stores. If core eagerly builds resources/registries when its module is evaluated, and the engine adapter registers hooks in a module evaluated later, core reads hooks before they exist and silently falls back to empty/default behavior. ES module evaluation order and Vite HMR re-evaluation make this non-deterministic, and the failure often appears only in the production build because dev HMR re-runs registration.

**Why it happens:**
Today there is no injection, so there is no ordering problem; the first injection design typically keeps a global registry filled by side-effect imports.

**How to avoid:**
- Do **not** use a global mutable hook registry filled by side effects. Pass the engine hook bundle into `createEditorCore(config)`, invoked from the editor boot path (`main.tsx` / `App.tsx`) after environment parsing.
- Keep all resource/model construction lazy (first access); never construct at module top level.
- If registration is unavoidable, make it idempotent with explicit teardown and support multiple isolated cores.
- Add a test that constructs core with a hook bundle and asserts no data access happens before configuration.

**Warning signs:**
- "Hook not registered" errors only in `build` output.
- Tests pass because `test/setup.ts` registers hooks first.
- HMR produces duplicated hooks/registries.

**Phase to address:** P3.

---

### Pitfall 6: Designing plugin/extension points for an imagined ecosystem (speculative generality)

**What goes wrong:**
The milestone defers plugin loading but asks for extension points. The tempting move is to design a general plugin API — lifecycle, capabilities, contribution points — for future third parties. With one real engine and no plugin loader, this produces abstractions that (a) the near-term `editor-next` cannot implement, (b) encode one engine's needs, and (c) calcify before a second implementation validates them. The inverse mistake is also common: hooks so narrow that `editor` must bypass core, recreating the monolith inside the adapter.

**Why it happens:**
"Leave extension points" reads as "design for extensibility", and extensibility is easiest to add before understanding the second consumer.

**How to avoid:**
- Design against **known consumers only**: the four built-in editors (code/table/map/material), the fixed shell, and the mota-js adapter. Add no hook with no current caller.
- For each extension point, require a **second concrete implementation** (the fake "engine B" adapter in tests) before freezing it. If it cannot be implemented twice, it is too specific or too general.
- Keep the surface small, typed, and versioned (`extensionPointId@v1`), with an ADR per point.
- Prefer descriptor/data injection over behavioral plugin hooks where data suffices.

**Warning signs:**
- Options/parameters with no current caller ("in case of").
- An interface only mota-js can implement.
- The adapter bypasses core for real features.
- `any`/`unknown`-heavy hook contracts.

**Phase to address:** P3 (design), P4 (validate with the adapter), P5 (freeze/version).

---

### Pitfall 7: Core becomes a UI/style dumping ground — and styles silently drop out of the build

**What goes wrong:**
Core is a *shared UI* library (the four editors + fixed shell). Moving components means moving styling across packages. The editor uses `antd` + `@douyinfe/semi-ui` + PandaCSS (`styled-system/`, alias `@styled-system`, `panda codegen` in `prepare`) + CSS modules (`localsConvention: camelCase`). A library package that does not participate in the editor's Panda extraction config emits **no generated styles** for its components, and CSS-module class references may not survive. Components render functionally but unstyled, and unit tests will not catch it. Separately, if core bundles its own `antd`/Semi, you get duplicate theme contexts and mismatched component instances.

**Why it happens:**
Build-time style extraction is invisible until you inspect the emitted CSS; "the component imported fine" masks the missing styles.

**How to avoid:**
- Decide PandaCSS ownership explicitly: either core runs its own codegen and ships CSS, or the editor's `panda.config` includes core sources and the editor emits the CSS. Assert generated CSS contains a known core class.
- Keep `antd`, Semi, React, and the Panda runtime as **peer dependencies** so there is exactly one copy and one `ConfigProvider` tree at the editor root.
- Add Playwright screenshot/visual baselines in P1 and compare after P4.

**Warning signs:**
- A component is unstyled in the app but passes unit tests.
- Emitted CSS size drops unexpectedly.
- Two `ConfigProvider`/theme contexts or duplicate library copies appear in the bundle.

**Phase to address:** P1 (visual baseline) + P4 (move components), verified P5.

---

### Pitfall 8: Duplicate runtime identity across the package boundary (React, signals, stores, Immer, Monaco)

**What goes wrong:**
If `@motajs/editor-core` declares `react`, `alien-signals`, `@tanstack/store`, `immer`, `monaco-editor`, `pixi.js`, or `blockly` as regular dependencies, pnpm may resolve a second copy. Symptoms are subtle and severe: "Invalid hook call"/two React instances; signals created in core not tracked by editor effects (UI silently stops updating); Immer draft class mismatch; two Monaco/Blockly instances (identity checks fail); doubled bundle weight against the 20 MiB artifact ceiling.

**Why it happens:**
Moving code copies `package.json` dependencies. Existing workspace libs already use TS-source exports plus peer deps, but `editor` has these as direct deps and the shortcut is to mirror them.

**How to avoid:**
- Catalog-pin and declare **peerDependencies** for all singleton/runtime packages (React, antd, Semi, alien-signals, store libs, Pixi, Monaco, Blockly), following the existing lib convention (`peerDependencies` + `catalog:default`).
- Add a CI assertion (`pnpm why` / dedupe check) that exactly one copy of each singleton exists.
- Add a smoke test that mounts a core component inside the editor and asserts a single React instance and live signal propagation.

**Warning signs:**
- "Invalid hook call" or inconsistent state between core and editor.
- UI stops re-rendering after a core update.
- Artifact/bundle size jumps without new features.
- Duplicate package entries in the lockfile.

**Phase to address:** P2 (package skeleton) + P4, guarded in CI.

---

### Pitfall 9: Circular dependencies between core and editor (easy, because everything is currently one package)

**What goes wrong:**
With the whole editor in one package, imports are unconstrained. On extraction it is trivial to create a cycle: core's shell imports something from the editor (a command/type/store), while the editor imports core. Cycles cause `tsc -b` build-order failures, runtime "cannot access X before initialization" (TDZ) errors, and an unextractable boundary. Cycles often hide behind type-only imports, which still couple the program.

**Why it happens:**
The dependency direction is not yet enforced, and the cheapest way to keep old imports working is to point them back at the old location.

**How to avoid:**
- Enforce one rule: **editor to core, never core to editor.** Core owns contracts; the editor implements them.
- Add `dependency-cruiser` (or `madge`) to CI with a no-cycles rule and an explicit forbidden-edge list.
- Put shapes used by both sides in core (contracts) or a dedicated types module, never in the higher-level package.
- Move a shared type by relocating it to the **lower** layer, not by importing upward.

**Warning signs:**
- `madge --circular` returns non-zero.
- TDZ errors after bundling.
- Core files import `@motajs/editor` or any app path.
- A "temporary" shared types file in the editor is imported by core.

**Phase to address:** P2 (set the rule), enforced every phase, verified P5.

---

### Pitfall 10: Dual copies and permanent re-export shims

**What goes wrong:**
The safest-looking migration is "copy the file to core, leave a re-export in the editor so old imports keep working." This creates two sources of truth, confuses HMR and coverage, doubles tests, and the shim outlives the milestone. At the end the repo has both `editor/src/...` and `editor-core/lib/...` implementations and nobody is sure which is live.

**Why it happens:**
Re-exports make each step look green without updating importers.

**How to avoid:**
- One move per commit: relocate the module and update **all** importers in the same change; use a codemod for `@/x` to `@motajs/editor-core/...`.
- Do not commit files whose body is only `export * from "@motajs/editor-core"`. Track any unavoidable shim in a written list with an in-milestone deletion deadline.
- Delete old trees promptly; "we'll clean up later" is how the monolith survives.

**Warning signs:**
- The same symbol is defined in two packages.
- Files in `editor/src` contain only re-exports.
- Tests are duplicated across both packages.
- Two implementations diverge during the refactor.

**Phase to address:** P4 (migrate) + P5 (delete shims).

---

### Pitfall 11: Singletons move to core but lose instance scoping and test isolation

**What goes wrong:**
The editor's global singletons (`projectData`, `projectModel`, `operationHistory`, `FileHandlerManager`, `persistenceMonitor`, stores) assume exactly one editor per page. If extraction preserves them as module globals, two cores (unit tests, an embedded editor, future `editor-next`, a preview) share state: cross-test contamination, history leaking between documents, persistence monitor mixing paths, and impossible-to-run parallel editors.

**Why it happens:**
Singletons are invisible to a mechanical move; they are "just how it works".

**How to avoid:**
- Make core's state a **container created per editor root** by `createEditorCore(config)` and injected via React context (or an explicit handle), not imported directly by components.
- Add a test that constructs **two independent cores** and asserts isolated history/persistence/data.

**Warning signs:**
- Tests need `vi.resetModules()` or ordering hacks.
- Components import `projectData`/`operationHistory` directly from module scope.
- A second editor instance corrupts the first's state.

**Phase to address:** P3/P4.

---

### Pitfall 12: Persistence and undo/redo semantics subtly change during extraction

**What goes wrong:**
Current behavior is delicate and easy to break while relocating:
- `PersistExecutor` allows one executing plus one pending intent per path (latest-wins), serialized, and **never rolls editor state back** on failure; `PersistenceMonitor` status transitions drive `persistingSet`/`failedMap`.
- `operationHistory` applies inverse operations with multi-target checkpoints and capacity 100, rolling back when apply fails.

Moving these across a boundary, or having hooks return copies/snapshots instead of live `Content<T>` signals, can alter write coalescing, ordering, retry eligibility, reactive propagation, and rollback. Because writes are async and eventually consistent, regressions surface as flaky "unsaved/error" indicators rather than hard failures.

**Why it happens:**
The behavior lives in the interaction between scheduling, signals, and error paths, not in a single signature; a "1:1 move" can still change closure identity and signal wiring.

**How to avoid:**
- In P1, write **characterization tests** for the current contracts before moving anything: error to retry to idle, concurrent schedule latest-wins, no-rollback-on-persist-failure, multi-target checkpoint rollback, and resource reactivity after `set`/`patch`.
- Freeze those contracts for this milestone; do not "improve" them.
- Preserve `ReadonlySignal<Content<T>>` as the hook return type so reactivity is unchanged.

**Warning signs:**
- Flaky persistence status in tests or UI.
- Duplicate or reordered writes to the same path.
- Lost `failedIntent`/retry after a failed write.
- UI not updating after a core `set`.

**Phase to address:** P1 (characterize) + P2/P3 (preserve), verified P5.

---

### Pitfall 13: The hook contract mismatches core's reactivity/async model

**What goes wrong:**
Engine data today flows as `ReadonlySignal<Content<T>>` with a five-state union (`idle | loading | loaded | not-found | error`) plus `ContentBoundary` suspension. A hook that returns plain snapshots breaks live updates; a synchronous hook cannot perform the async reads the engine needs; a promise-only hook loses suspension/loading semantics and the `not-found` distinction. The adapter then fakes reactivity with `useEffect` plus polling, and behavior diverges in timing and error handling.

**Why it happens:**
The simplest hook signature is `() => T` or `() => Promise<T>`, which discards the existing resource model.

**How to avoid:**
- Specify the hook contract in terms of core's existing types (`Content<T>`, `ReadonlySignal`, `DataResource` semantics) or an explicitly designed equivalent.
- Decide once, up front: sync vs async, signal vs snapshot, and how `not-found` vs `error` is produced (engine errors must remain classifiable like `isFileNotFoundError`).
- Keep loading states observable so the shell's `ContentBoundary` behavior is preserved.

**Warning signs:**
- Panels stop re-rendering after engine data changes.
- Loading skeletons disappear or appear differently.
- `ContentBoundary` no longer suspends.
- The adapter wraps hooks in effects/timers to fake live data.

**Phase to address:** P3, validated P4.

---

### Pitfall 14: "Engine-agnostic" validated against exactly one engine (false agnosticism)

**What goes wrong:**
With only mota-js present, core can look clean while encoding mota semantics in data shapes and algorithms: one-way arrow entry/exit semantics, status-bar reserved icon IDs (`packages/apps/editor/src/project/model/statusBarModel.ts` explicitly documents "IDs reserved by mota-js' built-in status bar icon sheet"), `var <uuid> = {json}` encoding, the `.animate` format, tileset layout, `events.commonEvent` structure, and Blockly schema shapes. The second engine later discovers it must reimplement or fight core.

**Why it happens:**
Grep-based boundary checks catch literal paths but miss *semantic* coupling in types and algorithms.

**How to avoid:**
- Build a small **second engine adapter fixture** in tests (a fake project with non-mota resources) and drive the hook contract end to end. If implementing it requires mota knowledge, the contract is wrong.
- Keep game-semantic derivations (passability, status bar, block registry, floor organization, blockly models) in the adapter where they can differ per engine, or expose them as engine-provided descriptors.
- Review core's public type names for game vocabulary.

**Warning signs:**
- The fake adapter cannot implement a hook without copying mota logic.
- Core types contain fields only mota-js produces.
- Core test fixtures are copies of mota files.

**Phase to address:** P3 (design + fixture), P4 (validate).

---

### Pitfall 15: Public protocol artifacts and build shape drift during the refactor

**What goes wrong:**
"External behavior unchanged" includes non-UI contracts that are easy to disturb:
- Environment Protocol v1 (exactly one `#mota-editor-environment` node, endpoint set, URL resolution).
- Runtime Protocol v4 handshake/messages.
- Editor Artifact Manifest schema v2, the MPA with exactly two entries (`index.html`, `runtime.html`), no `<base>` in the artifact, and the 20 MiB raw artifact ceiling.
- A pre-existing mismatch: `packages/apps/editor/editor-artifact-plugin.ts` declares `runtimeProtocolVersion: 3` while `src/runtime/protocol.ts` defines `RUNTIME_PROTOCOL_VERSION = 4` (asserted by `src/runtime/protocol.test.ts`).

Adding a package changes chunking and the manifest file list; an eager core import can pull editor UI into `runtime.html`; and a well-meaning developer may "fix" the 3/4 mismatch, changing what hosts read. Both are behavior changes.

**Why it happens:**
These contracts live in build config and separate modules, so component tests do not see them.

**How to avoid:**
- In P1, snapshot `editor-manifest.json`, protocol constants, entry inputs, and bundle sizes. Diff them after every phase.
- Mark the 3/4 mismatch as a **known pre-existing inconsistency**; preserve it unless separately approved (fixing it is out of scope for a pure refactor).
- Keep `runtime.html`'s dependency graph free of React/antd/core-shell UI; verify the runtime entry's chunks.

**Warning signs:**
- Manifest file list or protocol fields change.
- Artifact exceeds the 20 MiB ceiling or the MPA entries change.
- The `runtime.html` chunk grows or references editor UI.
- Someone edits a protocol constant "while we're here".

**Phase to address:** P1 (freeze/snapshot) + P5 (verify).

---

### Pitfall 16: A single core barrel export collapses code-splitting and duplicates weight into both entries

**What goes wrong:**
The editor is an MPA with two entries and an artifact near its size budget. A core `index.ts` that re-exports the shell plus Monaco, Blockly, Pixi, and antd/component trees forces every consumer to eagerly evaluate the union, defeats tree-shaking of heavy panels, and can drag editor-only UI into the runtime/preview entry. The result is a larger artifact and lost feature-level code splitting (already flagged as a bottleneck).

**Why it happens:**
Barrels are convenient, and extraction naturally wants one package entry.

**How to avoid:**
- Use **subpath exports** (`@motajs/editor-core/code`, `/table`, `/map`, `/material`, `/shell`) and avoid a top-level barrel that pulls everything in.
- Keep heavy panels behind dynamic `import()` as the editor does today; verify lazy chunks survive the move.
- Add a bundle-size budget check to CI and compare against the P1 baseline.

**Warning signs:**
- Artifact/asset sizes jump after extraction.
- Both MPA entries share one giant chunk.
- Heavy editors load on first paint.

**Phase to address:** P4, measured from P1 baseline, enforced in P5.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Re-export shim in `editor/src` pointing at core | Each migration step stays green | Two sources of truth; shim outlives milestone; HMR/coverage confusion | Never, except a tracked shim with an in-milestone deletion deadline |
| Keep `defaultFs` (or any file/env access) inside core | Zero wiring; core "just works" | Core reads files/hosts; violates core value; untestable without stubs | Never |
| Copy mota path/format constants into core as defaults | Less adapter code now | New engine inherits mota-js layout | Never |
| Design a general plugin API without a loader | "Future-proof" appearance | Speculative interfaces calcify; no second consumer to validate | Only for points with a second concrete implementation |
| Tolerate silent e2e skips | Suite appears green | The only write-path regression coverage never executes | Never in this milestone |
| Leave the editor's `tsc -b` and Vite configs untouched while adding core | Fewer config edits | The same source type-checks differently in two systems (Pitfall 1) | Never |
| Defer CI to "after the refactor" | Faster start | Refactor proceeds with no objective parity signal | Never |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| pnpm workspace package layout | Creating `packages/libs/editor-core/src` because the editor used `src` | Use `lib/`; `resolvePlugin.js` and `tsconfig.lib.base.json` hard-code it for `packages/libs/*` |
| `@/` alias across packages | Assuming `@/` is package-local everywhere | It is importer-relative at Vite build time but global in the tsc program; use relative imports in core or dedicated `paths` |
| TS project/build consumption | Assuming `tsc -b` and Vite agree | Run both in CI; verify resolution parity explicitly |
| Peer/duplicate singletons | Mirroring editor's deps into core's `dependencies` | Use `peerDependencies` + `catalog:` and assert a single copy |
| Environment Protocol v1 | Letting core read `#mota-editor-environment` | Only the editor parses the environment and passes config into core |
| Runtime Protocol v4 | Importing editor UI into `runtime.html` via core | Keep runtime entry dependencies lean; verify chunks |
| Artifact manifest v2 | Changing the manifest file list/protocol fields during extraction | Snapshot the manifest and diff it per phase; preserve the pre-existing 3/4 mismatch |
| Blockly codec | Moving schema/codec into core before the hook contract is stable | Keep codec in the adapter; core only hosts the editor surface |
| PandaCSS | Assuming imported components carry their styles | Choose emission ownership and assert generated CSS contains core classes |
| Playwright/e2e | Running e2e without the submodule or with conditional skips | Init the submodule; make skips explicit and CI-visible |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Core barrel re-exports everything | One giant shared chunk; both MPA entries parse Monaco/Blockly/Pixi | Subpath exports; lazy panels; bundle budget in CI | Immediately, at the first build after extraction |
| Duplicate heavyweight deps (Monaco, Blockly, Pixi, antd, Semi) | Lockfile duplicates; artifact size jump | `peerDependencies`; `pnpm why`/dedupe assertion | Any build; worsens against the 20 MiB ceiling |
| Core eagerly constructs resources/models at import | Slow startup; work done even when a panel never opens | Lazy first-access construction inside `createEditorCore` | Startup; amplified on low-end devices |
| Duplicate signal/store runtimes | UI updates lost; effects never fire; hard-to-profile re-renders | Single-instance signals/store via peer deps; smoke test | As soon as core's signals are consumed by editor effects |
| Styles duplicated across packages | Two theme contexts; CSS payload growth | One PandaCSS owner; peer antd/Semi | Build/asset-size regression |
| Runtime entry polluted by core shell | `runtime.html` loads editor UI; preview slowed | Keep runtime dependency graph independent; verify chunks | Preview startup |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Moving `new Function`/`eval` project-expression evaluators into core and generalizing them | Project-authored JS gains a wider, reusable eval surface | Keep evaluation in a single documented adapter module; core must not export an eval primitive |
| Core constructs or parses host URLs/paths | Core becomes a trust-boundary participant; path normalization may be bypassed | Core deals only in opaque logical keys; the editor owns URL/path construction; host keeps validation |
| Core "helpfully" reads missing files | Violates "core must not read files"; may bypass host permission checks | No default `Fs`; required injection; boundary lint |
| Losing the runtime iframe sandbox posture in a move | `allow-scripts allow-same-origin` and unvalidated `event.origin`/`event.source` are pre-existing weaknesses | Do not relocate `iframeEntry.ts` into core; treat runtime as engine adapter; do not "simplify" sandbox attributes |
| Leaking project content through the hook boundary | Hooks could return host handles/URLs to core and then to other engines | Hook contract carries data/values, not host capabilities |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Layout drift from moving the shell | Panels/toolbars resize or reorder; violates "UI 完全不变" | Freeze layout in P1 with screenshots; fixed layout is explicitly in scope as a non-goal for customization |
| Loading/empty/error states change | Users see flicker, missing skeletons, or wrong "not found" messages | Preserve `Content<T>` states and `ContentBoundary` semantics through the hook contract |
| Undo/redo behavior changes | Users lose or duplicate edits; trust in the editor drops | Characterization tests for capacity, inverse ops, multi-target rollback |
| Persistence feedback changes | Save indicator says saved when it failed (or vice versa) | Preserve `PersistExecutor`/`PersistenceMonitor` contracts and test error to retry to idle |
| Chinese copy or docs links break | UI text/help links regress | Keep copy in application/adapter layer or fixture-test it; docs endpoints stay in the editor |
| Error messages change | Users see English/stack text or misattributed connectivity errors | Preserve existing message shapes; normalize thrown strings to `Error` without changing user-facing text |

## "Looks Done But Isn't" Checklist

- [ ] **Package boundary:** Core lives at `packages/libs/editor-core` with `lib/`, resolves under both `tsc -b` and Vite — verify by building both, not by reading imports.
- [ ] **No engine coupling:** No `project/`, mota game vocabulary, or file extensions in core source — verify with a mechanical grep/lint gate, not review.
- [ ] **No file/host access:** No `defaultFs`, no environment/DOM reads, no `fetch` in core — verify core tests run without jsdom HTTP or host stubs.
- [ ] **Hook ordering:** Core constructed via factory after adapter config — verify no hook access before configuration and no import-time resource construction.
- [ ] **Instance scoping:** Two independently constructed cores do not share history/persistence/data — verify with a two-core test.
- [ ] **Reactivity:** Engine data changes still update panels — verify signals propagate across the boundary, not just initial render.
- [ ] **Persistence contract:** error to retry to idle; latest-wins writes; no rollback on persist failure — verify characterization tests still pass unchanged.
- [ ] **Undo/redo contract:** Capacity 100, inverse operations, multi-target rollback — verify characterization tests still pass unchanged.
- [ ] **Protocol freeze:** Environment v1, Runtime v4, artifact manifest v2 (including the pre-existing `runtimeProtocolVersion: 3`), MPA entries and no `<base>` — verify via manifest/config diff against P1.
- [ ] **Visual parity:** Screenshots match P1 baselines for the four editors and shell — verify, do not eyeball.
- [ ] **Styles present:** Emitted CSS contains core classes; one theme/`ConfigProvider` tree — verify in the built artifact.
- [ ] **Single singleton runtimes:** One React, one alien-signals/store, one Monaco — verify with a dedupe/`pnpm why` assertion.
- [ ] **Bundle budget:** Artifact under the 20 MiB ceiling and no new eager chunks — verify against P1 sizes.
- [ ] **No shims:** No editor files that only re-export core; no symbol defined in both packages — verify by grep.
- [ ] **Acyclicity:** No core to editor imports; dependency graph acyclic — verify with `madge`/`dependency-cruiser`.
- [ ] **Second engine:** A fake non-mota adapter exercises the hook contract end to end — verify it needs no mota knowledge.
- [ ] **e2e actually ran:** Not skipped, not conditionally disabled — verify CI logs show executed specs and the submodule was checked out.
- [ ] **Manual UAT has a written script:** Key flows enumerated in advance, not improvised after the refactor.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Alias/tsconfig divergence (Pitfall 1) | MEDIUM | Stop the move; pick one resolution strategy (relative imports or dedicated `paths`); re-run `tsc -b` + Vite; re-migrate affected modules |
| Parity regression found late without baseline (Pitfall 2) | HIGH | Initialize submodule, run e2e manually, bisect by phase; add CI retroactively; characterize affected contracts |
| Engine assumptions embedded in core (Pitfall 3/14) | HIGH if the API is frozen, MEDIUM before P4 | Introduce descriptors and a fake engine adapter; migrate literals to the adapter; version the extension points |
| Hook ordering bug only in prod (Pitfall 5) | MEDIUM | Replace global registry with factory config; make construction lazy; add build-mode test |
| Missing styles after move (Pitfall 7) | LOW to MEDIUM | Re-point PandaCSS extraction at core sources or add core codegen; re-verify screenshots |
| Duplicate runtime copies (Pitfall 8) | MEDIUM | Move to `peerDependencies`; dedupe lockfile; add singleton smoke test; rebaseline bundle |
| Circular dependency (Pitfall 9) | MEDIUM | Move shared types down; invert the dependency via a contract; add the no-cycles gate |
| Shims/dual copies (Pitfall 10) | LOW if tracked early, HIGH if divergent | Delete duplicate tree; update importers; delete shim list entries; re-run parity suite |
| Protocol/build drift (Pitfall 15) | MEDIUM | Diff manifest/config against P1; restore protocol constants; split the offending entry graph |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1 Alias/tsconfig divergence | P2 | `tsc -b` and Vite build both pass; module resolves to core |
| 2 No verification net | P1 | Baseline recorded; PR CI runs lint/typecheck/test/build; e2e executes |
| 3 mota path assumptions in core | P3 (audit P4) | Lint/grep gate on core source is green |
| 4 Core file/host access | P2/P3 | Core tests run without host stubs; boundary lint green |
| 5 Hook ordering race | P3 | Factory-based construction test; no import-time resource creation |
| 6 Speculative plugin API | P3/P5 | Every extension point has two concrete implementations and an ADR |
| 7 Styles dropped / UI dumping ground | P1/P4 | Screenshot baselines match; generated CSS contains core classes |
| 8 Duplicate runtime identity | P2/P4 | Single-copy assertion and React/signals smoke test pass |
| 9 Circular dependencies | P2 (enforced throughout) | `madge`/`dependency-cruiser` reports zero cycles and no forbidden edges |
| 10 Shims/dual copies | P4/P5 | Grep shows no re-export-only files and no duplicate symbols |
| 11 Singletons without instance scope | P3/P4 | Two-core isolation test passes |
| 12 Persistence/undo semantics changed | P1 (characterize), P2/P3 preserve | Characterization tests pass unchanged |
| 13 Hook reactivity/async mismatch | P3/P4 | Panels update live; `ContentBoundary` states preserved |
| 14 False agnosticism | P3/P4 | Fake engine-B adapter drives the hooks end to end |
| 15 Protocol/build drift | P1/P5 | Manifest, protocol constants, entries, and sizes match baseline |
| 16 Barrel export / bundle blowup | P4/P5 | Bundle budget holds; entries remain independent |

## Sources

Repository (HIGH confidence — read directly):
- `.planning/PROJECT.md`, `.planning/codebase/CONCERNS.md`, `.planning/codebase/ARCHITECTURE.md`
- `packages/libs/config/resolvePlugin.js`, `packages/libs/config/tsconfig.lib.base.json`, `packages/libs/config/tsconfig.app.base.json`
- `packages/apps/editor/tsconfig.app.json`, `packages/apps/editor/vite.config.ts`, `packages/apps/editor/package.json`
- `packages/apps/editor/src/environment.ts`, `src/fs/errors.ts`, `src/fs/PersistExecutor.ts` (via CONCERNS), `src/project/data/projectData.ts`
- `packages/apps/editor/src/runtime/RuntimeResourceGateway.ts`, `src/runtime/iframeEntry.ts`, `src/runtime/protocol.test.ts`
- `packages/apps/editor/docs/architecture-and-interfaces.md`, `editor-artifact-plugin.ts`
- `packages/libs/react-store/package.json` (existing lib peer-dependency convention)

External (LOW confidence — web search, unverified):
- Shared-kernel extraction failure modes and dependency inversion — thearchitectsnotebook.substack.com (Ep #124), gaevoy.com, dev.to, martinfowler.com/articles/dipInTheWild.html, learn.microsoft.com
- Plugin/extension-point failure modes and versioning — quality.arc42.org (Plugin Architecture), sambyte.net, grafana.com versioning extensions
- Behavior-preserving refactoring and strangler fig — martinfowler.com (StranglerFigApplication), microsoft/resilient-coding-patterns, ACM "On preserving the behavior in software refactoring" (AlOmar 2021)

---

*Pitfalls research for: extracting an engine-agnostic editor core with unchanged external behavior*
*Researched: 2026-09-20*
