<!-- refreshed: 2026-09-20 -->
# Codebase Concerns

**Analysis Date:** 2026-09-20

## Tech Debt

**Dual table systems (legacy + modern schema):**
- Issue: Two complete table implementations coexist and are both imported by the same panels. `packages/apps/editor/src/components/Table/` is the legacy comment-driven renderer; `packages/apps/editor/src/components/SchemaTable/` is the modern schema-driven renderer. Panels such as `packages/apps/editor/src/Workbench/FloorPanel/index.tsx`, `packages/apps/editor/src/Workbench/TowerPanel/index.tsx`, and `packages/apps/editor/src/Workbench/LocPanel/index.tsx` import from both. `packages/apps/editor/src/components/SchemaTable/SchemaTable.tsx` even imports inputs from the legacy tree (`@/components/Table/components/inputs`).
- Files: `packages/apps/editor/src/components/Table/`, `packages/apps/editor/src/components/SchemaTable/`, `packages/apps/editor/src/Workbench/TowerPanel/index.tsx`, `packages/apps/editor/src/Workbench/FloorPanel/index.tsx`, `packages/apps/editor/src/Workbench/LocPanel/index.tsx`
- Impact: Every table bug/feature must be reasoned about twice; shared inputs couple the two trees so the legacy system cannot be deleted cleanly. The editor README (`packages/apps/editor/README.md`) states the modern schema is a separate protocol that deliberately does not add an override layer over legacy schema, so both will remain.
- Fix approach: Migrate remaining panels (`PluginPanel`, `FunctionsPanel`, `CommonEventPanel`, `LocPanel/LocTable.tsx`) to `SchemaTable`, then remove `components/Table` or reduce it to shared inputs only.

**Monolithic files that are hard to change safely:**
- Issue: Several critical files are hundreds to ~1800 lines in single units, mixing rendering, state, orchestration, and side effects.
- Files:
  - `packages/apps/editor/src/components/SchemaTable/SchemaTable.tsx` (1799 lines)
  - `packages/apps/editor/e2e/core-panel-write.spec.ts` (1742 lines / ~100 KB, single spec file)
  - `packages/apps/editor/src/MapEditor/rendering/MapPixiRenderer.tsx` (1007 lines)
  - `packages/apps/editor/src/blockly/registry/index.ts` (862 lines) and `packages/apps/editor/src/blockly/schemas/entry.ts` (~39 KB)
  - `packages/apps/editor/src/Workbench/ScriptsWorkspace/index.tsx` (737 lines)
  - `packages/apps/editor/src/runtime/iframeEntry.ts` (700 lines)
  - `packages/apps/service-worker/src/server/editorRelease.ts` (663 lines)
- Impact: High review cost and merge-conflict surface; a single failure in these files (e.g. `MapPixiRenderer`) takes down a core panel.
- Fix approach: Extract view/state/handler segments into sibling modules; split `core-panel-write.spec.ts` by panel (it already groups by `test.describe`, so the split is mechanical).

**Dead / orphaned packages and legacy build tooling:**
- Issue: `packages/libs/theme/` contains a misspelled manifest `pacakge.json` (not `package.json`), so pnpm workspace never sees `@motajs/theme`. It is referenced nowhere in the codebase (grep for `@motajs/theme` yields only the misspelled manifest itself). `packages/libs/packer/prev/` retains an abandoned Babel/Python pipeline (`babel.config.js`, `forceRemoteBgm.py`, `jscompress.py`, `self-update.py`, `tileset_compressor.py`, `setup.sh`) superseded by `packages/libs/packer/src/`.
- Files: `packages/libs/theme/pacakge.json`, `packages/libs/theme/theme.less`, `packages/libs/packer/prev/`, `packages/libs/packer/babel.config.js`
- Impact: Misleads contributors; the typo means any future `import "@motajs/theme"` silently fails to resolve. Stale Python tooling references an old workflow no longer present.
- Fix approach: Rename to `package.json` if the theme is still wanted, otherwise delete `packages/libs/theme/` and `packages/libs/packer/prev/`.

**Orphaned libraries with heavy native dependencies:**
- Issue: `@motajs/h5animate` (`packages/libs/h5animate/`) and `@motajs/packer` (`packages/libs/packer/`) are consumed by no app or library in the workspace (grep for `@motajs/h5animate` / `@motajs/packer` returns only their own docs). Both depend on the native `sharp` binary (`packages/libs/h5animate/lib/webp.ts`, `packages/libs/packer/package.json`).
- Impact: `pnpm install` compiles/installs native binaries and `allowBuilds` entries (`sharp`) for packages nothing in the repo uses; unclear whether they are externally published or abandoned.
- Fix approach: Document intended external consumers, or move them out of the workspace. Verify `sharp` is required before keeping it in `pnpm-workspace.yaml` `allowBuilds`.

**Type-safety escape hatches and unsafe evaluation:**
- Issue: The runtime bridge is effectively untyped and executes project-authored JavaScript.
  - `packages/apps/editor/src/runtime/iframeEntry.ts` line 10: `const runtime: any = window;` (plus four more `const core: any` locals).
  - `packages/apps/editor/src/project/tableMeta/TableMetaEvaluator.ts` uses `new Function(...)` on project-provided `*.comment.js` source (lines 77, 94, 121).
  - `packages/apps/editor/src/components/Table/externalEditor.ts` line 99: `eval(\`(${value || 'null'})\`)` to parse legacy expressions.
  - `packages/apps/editor/src/blockly/hooks/useBlocklyWorkspace.ts` line 172: `// @ts-expect-error 类型推导有问题`.
- Impact: TypeScript cannot guard the most failure-prone and highest-privilege code. Any schema mistake is a runtime failure only.
- Fix approach: Add narrow interfaces for the mota-js engine surface in `iframeEntry.ts`; keep `new Function`/`eval` isolated behind a single, documented evaluation module with unit tests around failure paths.

**Lint discipline is advisory, and configs diverge:**
- Issue: Root config (`eslint.config.js`) downgrades `@typescript-eslint/no-explicit-any`, `no-unused-vars`, `ban-ts-comment`, and `no-empty-object-type` to warnings. The editor has a separate config (`packages/apps/editor/eslint.config.js`) with a different rule set and no `@stylistic` formatting rules, so the same file lints differently depending on cwd. `packages/apps/service-worker` has no local config and falls back to root.
- Files: `eslint.config.js`, `packages/apps/editor/eslint.config.js`
- Impact: No enforced quality gate; `any`/`@ts-expect-error` can accumulate. Formatting inconsistency between packages.
- Fix approach: Make `no-explicit-any`/`ban-ts-comment` errors (or at least `error` in editor app code), and share a single base config from `@motajs/config`.

**Root workspace tooling is minimal:**
- Issue: Root `package.json` exposes only `"lint": "eslint --fix"` — no `test`, `build`, or `typecheck` aggregate. There is no `packageManager` field and no `engines` despite CI pinning `pnpm 11.10.0` and Node 24 (`.github/workflows/deploy-editor-h5test.yml`).
- Files: `package.json`, `.github/workflows/deploy-editor-h5test.yml`
- Impact: Contributors must know per-package scripts; drift between local pnpm and CI is possible.
- Fix approach: Add `packageManager`, `engines`, and root `test`/`typecheck`/`build` fan-out scripts.

**Stale documentation vs. current architecture:**
- Issue: `.kiro/steering/architecture.md` documents only `service-worker`, lists `theme/` as an active library, and never mentions the `packages/apps/editor` application that is the bulk of the repo (~2.4 MB of TS/TSX). Root `README.md` is effectively a stub (development guide with an empty numbered list). `packages/apps/editor/README.md` still describes "Tern 定义" (`editorBlockly`-era naming remains in `packages/apps/editor/src/Workbench/CodeEditor/ternDeclaration.ts`) after the Monaco migration noted in git history.
- Files: `.kiro/steering/architecture.md`, `README.md`, `packages/apps/editor/README.md`, `packages/apps/editor/src/Workbench/CodeEditor/ternDeclaration.ts`
- Impact: New contributors get an incomplete map; onboarding relies on tribal knowledge.
- Fix approach: Update steering docs to include the editor app and its dual-table architecture; rename or wrap the Tern-named module now that Monaco is the code engine.

**Manifest metadata drift:**
- Issue: The generated editor manifest declares `runtimeProtocolVersion: 3` (`packages/apps/editor/editor-artifact-plugin.ts` lines 25 and 166), but the actual constant is `RUNTIME_PROTOCOL_VERSION = 4` (`packages/apps/editor/src/runtime/protocol.ts` line 4) and `packages/apps/editor/src/runtime/protocol.test.ts` asserts `4`. The service worker stores the manifest value verbatim (`packages/apps/service-worker/src/server/editorRelease.ts` lines 123–157) without cross-checking it.
- Files: `packages/apps/editor/editor-artifact-plugin.ts`, `packages/apps/editor/src/runtime/protocol.ts`, `packages/apps/service-worker/src/server/editorRelease.ts`
- Impact: The advertised runtime protocol version is wrong. Any future host-side compatibility gate keyed on this field will make incorrect decisions.
- Fix approach: Derive `runtimeProtocolVersion` from the source constant (single source of truth) and validate it during staging in `packages/apps/service-worker/scripts/stage-editor.mjs`.

## Known Bugs

**`fs.postData` swallows the underlying error and branches identically:**
- Symptoms: All transport failures are reduced to `console.log(err.message)` with no stack, no level, and no distinction between environments. The `if/else` branches are byte-for-byte identical, so the `window.main` check is dead code.
- Files: `packages/apps/editor/src/services/fs/fs.ts` lines 124–131
- Trigger: Any failed file API request (offline server, permission denied, 500).
- Workaround: Callers wrap errors with a generic "请检查启动服务是否处于正常运行状态" message (`httpRequest`, lines 102–105), which can misattribute server errors as connectivity problems.
- Fix approach: Collapse the branch and rethrow/preserve the original `Error`; surface a typed error to `PersistenceMonitor`.

**Unbounded readiness polling when opening Blockly editor:**
- Symptoms: `loadWhenReady` retries every 50 ms forever until the workspace becomes ready. If the panel closes or the workspace never mounts while `currentContext`/`generation` remain valid, the timer loops indefinitely.
- Files: `packages/apps/editor/src/blockly/api/editorBlockly.ts` lines 134–148
- Trigger: Event editor opened before the Blockly workspace finishes mounting, or a provider that never registers a workspace ref.
- Workaround: None observed.
- Fix approach: Add a retry budget with a timeout rejection and clear the timer on context cancellation.

**Status-bar/UI preview mutates global engine state:**
- Symptoms: `renderStatusBar` in the runtime iframe overwrites `core.status.hero` fields, `core.flags.statusCanvas`, `core.domStyle.isVertical`, and swaps `core.dom.statusCanvasCtx`; only the canvas ctx is restored. It relies on `structuredClone(core.status.hero)` and `(0, eval)(\`(${payload.code})()\`)`.
- Files: `packages/apps/editor/src/runtime/iframeEntry.ts` lines 580–617
- Trigger: Opening the status-bar preview after prior runtime previews.
- Workaround: The clone at line 592 is intended to prevent mutation, but any non-cloneable value on `hero` (functions, proxies, DOM refs) would throw `DataCloneError` outside a try/catch, and the rest of the engine state is left mutated.
- Fix approach: Snapshot/restore all touched engine state in a `try/finally`, and wrap the clone with a fallback.

**Semicolon-delimited multi-file write protocol:**
- Symptoms: `writeMultiFiles` joins filenames and values with `;` on both client and server (`packages/apps/editor/src/services/fs/fs.ts` lines 250–255; `packages/apps/service-worker/src/server/fsApi.ts` lines 57–71). It is safe only because base64 and the validated path charset exclude `;`.
- Files: `packages/apps/editor/src/services/fs/fs.ts`, `packages/apps/service-worker/src/server/fsApi.ts`
- Trigger: Any future encoding that can emit `;`, or a caller bypassing the path validator.
- Workaround: Server rejects paths containing `;` (`fsApi.ts` line 64), which is why this has not broken.
- Fix approach: Send a JSON array for multi-file payloads instead of delimiter-joined strings.

**Conditional e2e coverage hides regressions:**
- Symptoms: `packages/apps/service-worker/e2e/project-host.spec.ts` line 102 calls `test.skip(!withEditor, ...)`, so a large class of host behavior silently skips when no editor release is staged.
- Files: `packages/apps/service-worker/e2e/project-host.spec.ts`
- Trigger: Running e2e without `build:with-editor`.
- Workaround: None.
- Fix approach: Emit a CI-visible marker/required fixture so skipped coverage is reported rather than passed.

## Security Considerations

**Project-authored code executes in the editor origin with file-system privileges:**
- Risk: Table metadata and legacy field values are JavaScript expressions evaluated with `new Function` (`packages/apps/editor/src/project/tableMeta/TableMetaEvaluator.ts` lines 77, 94, 121) and `eval` (`packages/apps/editor/src/components/Table/externalEditor.ts` line 99). These run in the editor page context, which holds File System Access directory handles capable of arbitrary read/write of the opened project.
- Files: `packages/apps/editor/src/project/tableMeta/TableMetaEvaluator.ts`, `packages/apps/editor/src/components/Table/externalEditor.ts`, `packages/apps/editor/src/components/Table/utils/traversal.ts`
- Current mitigation: Evaluation is wrapped in try/catch and returns diagnostics; nothing sandboxes the code itself.
- Recommendations: Evaluate project expressions inside a dedicated sandbox (worker or separate realm) with no handle access; treat table/comments files as untrusted input.

**Runtime iframe uses `allow-scripts allow-same-origin` while loading project engine code:**
- Risk: `packages/apps/editor/src/runtime/RuntimeProvider.tsx` line 272 sets `sandbox="allow-scripts allow-same-origin"`. The iframe fetches the project's game index and dynamically loads project scripts (`iframeEntry.ts` lines 619–643) and evals status-bar code (line 613). With same-origin enabled, code in that iframe is same-origin with the editor shell and can reach the parent document/`window`, defeating the sandbox boundary. The connect message is posted with target origin `"*"` (line 152), and the runtime's `message` listener (`iframeEntry.ts` lines 676–681) does not validate `event.origin` or `event.source`.
- Files: `packages/apps/editor/src/runtime/RuntimeProvider.tsx`, `packages/apps/editor/src/runtime/iframeEntry.ts`
- Current mitigation: The host connects via a one-time `MessagePort` (`{ once: true }`), which limits post-connect surface but not same-origin DOM/window access.
- Recommendations: Remove `allow-same-origin` and serve runtime assets from a distinct origin (or a blob/opaque origin), validate `event.origin`/`event.source` before adopting the port, and pass an explicit `targetOrigin`.

**No Content-Security-Policy anywhere:**
- Risk: Neither `packages/apps/editor/index.html` nor `packages/apps/service-worker/index.html` sets a CSP, and the service worker serves user project files (`packages/apps/service-worker/src/server/preview.ts`) and transpiled TS (`packages/apps/service-worker/src/server/transpiler.ts`). `externalEditor.ts`/`TableMetaEvaluator` require `unsafe-eval`, so a strict CSP would need a plan.
- Files: `packages/apps/editor/index.html`, `packages/apps/service-worker/index.html`, `packages/apps/service-worker/src/server/preview.ts`
- Current mitigation: None.
- Recommendations: Add a baseline CSP (`default-src 'self'`, `object-src 'none'`) plus explicit allowances for the engine and Monaco; document why `unsafe-eval` is currently unavoidable.

**Path traversal handling is present but concentrated in one function:**
- Risk: All project file access funnels through `normalizeProjectPath` (`packages/apps/service-worker/src/server/fsApi.ts` lines 12–25), which rejects control chars, backslashes, absolute paths, and `..` segments; `packages/apps/service-worker/src/server/router.ts` `decodeRoutePath` decodes each segment before `preview.ts` re-validates. This is sound, but correctness depends on every new route calling it.
- Files: `packages/apps/service-worker/src/server/fsApi.ts`, `packages/apps/service-worker/src/server/preview.ts`, `packages/apps/service-worker/src/server/router.ts`
- Current mitigation: Central validator plus a strict staging path check in `packages/apps/service-worker/scripts/stage-editor.mjs` (`safePath`).
- Recommendations: Add tests for encoded `..`/`%2e%2e` and mixed separators (some coverage exists in `packages/apps/service-worker/src/server/fsApi.test.ts`), and keep the validator the only path entry point.

**Host config is the only trust boundary for FS/runtime endpoints:**
- Risk: Endpoints and project/release identity arrive from the injected `script#mota-editor-environment` JSON (`packages/apps/editor/src/environment.ts`). The editor will happily talk to whatever `fs`/`preview` URLs the host supplies.
- Files: `packages/apps/editor/src/environment.ts`, `packages/apps/editor/test/setup.ts`
- Current mitigation: Protocol version is validated (`EDITOR_ENVIRONMENT_PROTOCOL_VERSION = 1`).
- Recommendations: Validate endpoint URLs are same-origin (or an explicit allowlist) before use.

## Performance Bottlenecks

**Very large single editor bundle:**
- Problem: The editor app pulls `monaco-editor`, `blockly`, `pixi.js`, `antd`, `@douyinfa/semi-ui`, `lucide-react`, `@tanstack/react-query`, `acorn`, `localforage`, `js-beautify`, and more in one build (`packages/apps/editor/package.json`). The build enforces a 20 MiB raw artifact ceiling (`packages/apps/editor/editor-artifact-plugin.ts` line 47) and gzip/brotli-report every file, which signals the bundle sits near the budget.
- Files: `packages/apps/editor/package.json`, `packages/apps/editor/editor-artifact-plugin.ts`, `packages/apps/editor/vite.config.ts`
- Cause: MPA with two entries (`index.html`, `runtime.html`) but no documented route/feature-level code splitting beyond the Monaco worker pruning in `validateEditorArtifact`.
- Improvement path: Lazy-load heavy panels (Blockly, Pixi map, Monaco) behind dynamic imports; the manifest/SHA-256 machinery already supports independent asset verification.

**Pixi map renderer is a 1000-line hotspot:**
- Problem: `packages/apps/editor/src/MapEditor/rendering/MapPixiRenderer.tsx` owns rendering, sprite resolution, and floor image composition in one module, driven by `MapEditorStore`.
- Files: `packages/apps/editor/src/MapEditor/rendering/MapPixiRenderer.tsx`, `packages/apps/editor/src/MapEditor/MapCanvas.tsx`, `packages/apps/editor/src/MapEditor/MapEditorStore.ts`
- Cause: Large maps/tilesets redraw through this module; no evidence of virtualization or dirty-rect optimization in tests.
- Improvement path: Add profiling for large floors, extract sprite composition into testable pure functions (there is partial coverage in `packages/apps/editor/src/MapEditor/rendering/__tests__/`).

**Unbounded multi-file writes in one request:**
- Problem: `writeMultiFiles` serializes every path/value pair into a single URL-encoded POST body (`packages/apps/editor/src/services/fs/fs.ts` lines 250–255; `packages/apps/service-worker/src/server/fsApi.ts` lines 57–71).
- Files: `packages/apps/editor/src/services/fs/fs.ts`, `packages/apps/service-worker/src/server/fsApi.ts`
- Cause: No chunking; a large batch (e.g. asset imports) creates one big body.
- Improvement path: Batch/chunk writes and report progress; the persistence layer already coalesces intents per path.

## Fragile Areas

**Runtime bridge monkey-patches engine internals:**
- Files: `packages/apps/editor/src/runtime/iframeEntry.ts` (lines 644–670 replace `runtime.main.loadMod`; lines 275–279 wrap prototype `_loadMusic_sync`; lines 588–614 mutate `core.dom`, `core.status`, `core.flags`), `packages/apps/editor/src/runtime/RuntimeResourceGateway.ts`
- Why fragile: It depends on undocumented mota-js internals fetched from the `packages/external/mota-js` submodule. Any upstream engine change breaks preview silently (the file is `any`-typed, so the compiler cannot warn). The module has no unit tests (only `protocol.test.ts` and `RuntimeResourceGateway.test.ts` exist).
- Safe modification: Change only with the pinned submodule revision in hand; add runtime integration tests against the fixture project.
- Test coverage: `packages/apps/editor/src/runtime/__tests__/` covers protocol/gateway only; `initialize`/render hooks are untested.

**External submodule is required but absent, and imported at config load:**
- Files: `packages/apps/editor/mota-root.ts` (throws if required paths are missing), `.gitmodules`, `packages/apps/editor/vite.config.ts` (imports `MOTA_JS_ROOT`), `packages/apps/editor/playwright.config.ts`
- Why fragile: `resolveMotaJsRoot()` throws during Vite/Vitest config evaluation if `packages/external/mota-js` is not initialized. The directory is currently empty (submodule not checked out), so `pnpm --filter @motajs/editor test` and `dev`/`build` fail at startup. CI checks out submodules recursively, but local and any non-recursive checkout does not.
- Safe modification: Always run `git submodule update --init packages/external/mota-js` first, or set `MOTA_JS_ROOT`.
- Test coverage: No test guards config-load behavior without the submodule.

**Persistence model trades recovery for simplicity:**
- Files: `packages/apps/editor/src/fs/PersistExecutor.ts`, `packages/apps/editor/src/fs/PersistenceMonitor.ts`, `packages/apps/editor/src/Workbench/draftGuard.ts`
- Why fragile: `PersistExecutor` retains exactly one executing + one pending intent (latest-wins) and explicitly never rolls editor state back on failure ("persistence failures never roll editor state back"). Recovery depends on `PersistenceMonitor.retryFailed()` and the unload warning in `draftGuard.ts`, which is a global mutable `Set` plus a one-shot suppression flag (`packages/apps/editor/src/Workbench/draftGuard.ts` lines 3–27).
- Safe modification: Any change to scheduling must preserve the invariant that `status` transitions drive `persistingSet`/`failedMap`; add tests around error→retry→idle.
- Test coverage: `packages/apps/editor/src/fs/__tests__/PersistExecutor.test.ts` and `PersistenceMonitor.test.ts` exist; integration is covered by `packages/apps/editor/src/project/data/__tests__/persistStatus.integration.test.ts`.

**Legacy callback FS API throws strings:**
- Files: `packages/apps/editor/src/services/fs/fs.ts` (lines 208, 224, 246, 259, 277, 286, 295 `throw "Type Error in ..."`), `packages/apps/editor/src/fs/` handlers
- Why fragile: Throwing non-`Error` values bypasses stack traces and `instanceof Error` recovery paths; `promisify` only receives server error strings, so failures surface as `new Error(err)` with no cause.
- Safe modification: Normalize to `Error` objects before changing call sites; check `packages/apps/editor/src/fs/errors.ts`.
- Test coverage: `packages/apps/editor/src/services/fs/__tests__/fs.test.ts` asserts error strings, locking in the current shape.

**Blockly declarative codec round-trip:**
- Files: `packages/apps/editor/src/blockly/` (~497 KB, 57 files), `packages/apps/editor/src/blockly/registry/index.ts`, `packages/apps/editor/src/blockly/schemas/`, `packages/apps/editor/test/blockly/`
- Why fragile: Schema↔code generation must round-trip legacy project files; `confirm()` refuses to save when `hasUnparsedSource` is true (`packages/apps/editor/src/blockly/api/editorBlockly.ts` lines 158–161), so unparsed source becomes a blocking state. Recent git history (`fix(editor): stabilize Blockly text editing`, `fix(editor): preserve changeFloor coordinate expressions`) shows this area is actively brittle.
- Safe modification: Add a codec case to `packages/apps/editor/test/blockly/uiRoundTrip.test.ts` before changing a schema.
- Test coverage: Good at unit level (`packages/apps/editor/test/blockly/` has 12 specs), weaker at UI level.

**Service worker cache invalidation depends on build-time env:**
- Files: `packages/apps/service-worker/src/server/cache.ts` (CACHE_VERSION from `import.meta.env.PACKAGE_VERSION` + `VITE_DEPLOY_REVISION`, falling back to `"dev"`), `packages/apps/service-worker/src/server/editorRelease.ts`
- Why fragile: Missing/blank deploy revision collapses the cache name to `...:dev`, so successive deployments share a cache key; stale assets can persist until `cleanupCaches` runs.
- Safe modification: Ensure `VITE_DEPLOY_REVISION` is set in every build (`packages/apps/service-worker/scripts/deploy-h5test.sh`), and add a test for the fallback.
- Test coverage: `packages/apps/service-worker/src/server/editorRelease.test.ts` covers release state; cache version fallback is untested.

## Scaling Limits

**Editor release staging and cache size:**
- Current capacity: Artifact capped at 20 MiB raw (`packages/apps/editor/editor-artifact-plugin.ts` line 47); every file is SHA-256 hashed and gzip/brotli measured on every build.
- Limit: The whole release is downloaded/staged by the service worker (`packages/apps/service-worker/src/server/editorRelease.ts`, `releaseAssetCoordinator.ts`) and stored in Cache Storage; multiple retained releases multiply browser storage use.
- Scaling path: Retain only current + candidate releases, add eviction based on `cleanupCaches` in `packages/apps/service-worker/src/server/cache.ts`, and reduce bundle via code splitting.

**Browser-storage-backed project registry:**
- Current capacity: Project IDs are random in `[1055, 9922]` (`packages/apps/service-worker/src/server/project.ts` lines 12–13) with collision re-roll; metadata is in Dexie (`project` table).
- Limit: `applyProjectID()` loops until it finds a free ID; near the 8868-project ceiling this becomes increasingly slow, and all handles live in one IndexedDB store.
- Scaling path: Use a monotonic counter or UUIDs; move handle persistence to a dedicated store with explicit migration.

**In-memory project FS mapping:**
- Current capacity: `activeProjectMap`/`activationPromises` are plain module-level `Map`s (`packages/apps/service-worker/src/server/project.ts` lines 30–31).
- Limit: No eviction — every opened project stays mapped for the worker lifetime.
- Scaling path: Add an LRU eviction policy and explicit `forgetProject` calls (the API exists).

## Dependencies at Risk

**Two React Query generations in one monorepo:**
- Risk: `packages/apps/service-worker` uses legacy `react-query` v3 (`packages/apps/service-worker/package.json` line 35; imports in `packages/apps/service-worker/src/view/App.tsx` and `MainView.tsx`), while `packages/apps/editor` uses `@tanstack/react-query` v5 (`packages/apps/editor/package.json` line 23; `packages/apps/editor/src/queryClient.ts`). Both are installed and bundled.
- Impact: Duplicate dependency weight, divergent APIs/caching semantics, and v3 is effectively unmaintained.
- Migration plan: Move `service-worker` to `@tanstack/react-query` v5 and remove the `react-query` catalog entry from `pnpm-workspace.yaml`.

**`onigasm` / `monaco-textmate` in the Monaco wrapper:**
- Risk: `packages/libs/react-monaco-editor/package.json` depends on `onigasm` (WASM regex engine, unmaintained) and `monaco-textmate`. The editor app does not declare them directly, so they ride along with the library.
- Impact: Extra WASM payload and supply-chain surface for syntax highlighting that Monaco can do natively.
- Migration plan: Use Monaco's built-in tokenizer for the mota-js language and drop textmate/onigasm.

**`awesomplete` and `localforage` (legacy, low-maintenance):**
- Risk: `awesomplete@1.1.7` and `localforage@1.10.0` are pinned in `packages/apps/editor/package.json`; both are dormant projects.
- Impact: Security patches are unlikely; `localforage` overlaps with the service-worker's Dexie/cache storage.
- Migration plan: Replace autocomplete with Monaco suggestions; consolidate storage on Dexie/Cache Storage used by the host.

**`sharp` native builds in workspace libs:**
- Risk: `pkgs/libs/h5animate` and `pkgs/libs/packer` depend on `sharp`, which is listed in `allowBuilds` (`pnpm-workspace.yaml` lines 6–11). Native binaries are platform-specific and slow/fragile to install.
- Impact: Install/CI reproducibility issues, especially on Windows/ARM.
- Migration plan: Confirm these libs are still targets; if they are runtime-only for a Node tool, isolate them in a separate workspace and document installation requirements.

**Exact pins and release-age exclusions:**
- Risk: `monaco-editor` is pinned to an exact catalog version (`0.56.0`) with a `minimumReleaseAgeExclude` entry (`pnpm-workspace.yaml` lines 48, 73–74); `vite` is force-overridden to `7.3.1` while the catalog says `^7.3.0`.
- Impact: Security updates require manual catalog edits; the override can mask incompatible plugin peer ranges.
- Migration plan: Add a scheduled dependency-update workflow and document why the pins exist.

## Missing Critical Features

**No pull-request CI pipeline:**
- Problem: The only workflow is manual (`on: workflow_dispatch`) and deploys to h5test (`.github/workflows/deploy-editor-h5test.yml`). There is no lint, typecheck, unit-test, or e2e gate on pull requests or pushes.
- Blocks: Safe refactors of the dual table systems, Blockly codec, and runtime bridge; regressions are only caught locally.
- Recommendation: Add a `pull_request` workflow running root lint, per-package `typecheck`, `test` for editor + service-worker + libs, and a build.

**Editor app has no `typecheck` script despite `tsc -b` being coupled to build:**
- Problem: `packages/apps/editor/package.json` exposes `build: "tsc -b && vite build"` but no standalone `typecheck`, unlike `packages/apps/service-worker`. Type errors are only surfaced during a full build.
- Blocks: Fast type-only validation in CI.
- Recommendation: Add `"typecheck": "tsc -b"` and run it in CI.

**No coverage thresholds or reporting:**
- Problem: Only `packages/libs/packer/vitest.config.ts` configures coverage; editor, service-worker, and other libs have no coverage config, and no CI collects coverage.
- Blocks: Objective visibility into untested areas such as the runtime bridge, stores, and Workbench panels.
- Recommendation: Enable v8 coverage with a low starting threshold and ratchet upward.

**No LICENSE file despite BSD-3-Clause declarations:**
- Problem: Every package declares `"license": "BSD-3-Clause"` but the repository root has no `LICENSE`.
- Blocks: Clean redistribution/compliance.
- Recommendation: Add the BSD-3-Clause text at the root.

**No observability / error reporting:**
- Problem: Errors are only `console.error`/`console.warn` (`packages/apps/editor/src/components/AppErrorBoundary.tsx`, `packages/apps/editor/src/fs/PersistExecutor.ts`, `packages/apps/service-worker/src/server/editorRelease.ts`).
- Blocks: Diagnosing field failures (persistence errors, runtime crashes) remotely.
- Recommendation: Add a pluggable error reporter hook in the environment contract, off by default.

## Test Coverage Gaps

**Runtime bridge (`iframeEntry.ts`) untested:**
- What's not tested: `initialize`, engine monkey-patching, `renderUI`, `renderStatusBar`, resource hooks.
- Files: `packages/apps/editor/src/runtime/iframeEntry.ts`
- Risk: Upstream mota-js drift silently breaks preview; no regression signal.
- Priority: High

**Map editor store and canvas untested at integration level:**
- What's not tested: `packages/apps/editor/src/MapEditor/MapEditorStore.ts`, `MapCanvas.tsx`, `MapEditor/index.tsx`, `MapEditor/ToolBar.tsx`.
- Files: `packages/apps/editor/src/MapEditor/`
- Risk: Drawing/selection regressions in the primary editing surface; only `test/mapEditor/mapEditorStore.test.ts` and utils/rendering tests exist.
- Priority: High

**Workbench panels and stores largely untested:**
- What's not tested: most of `packages/apps/editor/src/Workbench/` (only `CodeEditor` has 2 tests, plus `projectTitle.test.ts`, `draftGuard.test.ts`, `editorUpdate.test.ts`, `monacoPreload.test.ts`) and `packages/apps/editor/src/stores/` (no tests).
- Files: `packages/apps/editor/src/Workbench/`, `packages/apps/editor/src/stores/`
- Risk: Panel-level regressions are only caught by e2e, which CI does not run.
- Priority: Medium

**Library packages with zero tests:**
- What's not tested: `packages/libs/utils/` (0 test files, yet a dependency of several packages), `packages/libs/react-dark-mode/` (0), `packages/libs/file2x/` (1), `packages/libs/react-store/` (1).
- Files: `packages/libs/utils/`, `packages/libs/react-dark-mode/`, `packages/libs/file2x/`, `packages/libs/react-store/`
- Risk: Shared utilities can regress across multiple consumers without detection.
- Priority: Medium

**E2E suite is not executed in CI and is submodule-dependent:**
- What's not tested in CI: `packages/apps/editor/e2e/` (9 spec files) and `packages/apps/service-worker/e2e/` (2 specs). They require a checked-out `packages/external/mota-js` submodule and a staged editor release.
- Files: `packages/apps/editor/e2e/core-panel-write.spec.ts`, `packages/apps/editor/playwright.config.ts`, `packages/apps/service-worker/e2e/`
- Risk: The only end-to-end write-path verification never runs automatically; the single 1742-line spec is unlikely to be maintained locally.
- Priority: High

**Editor tests depend on the external submodule at config load:**
- What's not tested: unit tests cannot run without `packages/external/mota-js`, because `packages/apps/editor/vite.config.ts` imports `MOTA_JS_ROOT` from `packages/apps/editor/mota-root.ts`, which throws.
- Files: `packages/apps/editor/mota-root.ts`, `packages/apps/editor/vite.config.ts`
- Risk: Contributors and any lite CI checkout cannot run the unit suite at all.
- Priority: High

---

*Concerns audit: 2026-09-20*
