# Phase 5: Engine Adapter Skeleton & Resource Descriptors — INTERFACE-NAME.md

> **Status: PENDING CONFIRMATION (materialized 2026-09-28, pre-execution).**
> Per `AGENTS.md` §Project Rules, every important name (file / interface / method / function / type /
> package / exported symbol) is reported here **with its purpose** and confirmed **before** it is written
> into code. Function-body locals are exempt.
>
> **This file is a pre-execution planning artifact.** It was authored during planning (revision), so the
> naming gate precedes execution. The names below are **provisional** until the user approves them at the
> per-plan briefing gate; the executor of 05-01 verifies this file (does not create it) and must not land
> any name that is not confirmed here.
>
> Sections: a **File-name convention** note and **one section per Plan** (05-01 … 05-04). Methods are
> written `ClassName.methodName`.

---

## File-name convention

File names use **lowerCamelCase**. Only React component files (`.tsx`) use PascalCase. This phase creates
no `.tsx`. Symbol names keep their declared casing (e.g. class `FileResource` lives in
`lib/resources/fileResource.ts`).

---

## Plan 05-01 — Core adapter contract (`defineEngine`)

| Name | Kind | What it is for |
|------|------|----------------|
| `packages/libs/editor-core/lib/ports/engine.ts` | file (modified) | The engine-agnostic adapter contract: the generic descriptor, the description input, the widened `EngineAdapter`, `defineEngine`, the version constant. |
| `packages/libs/editor-core/lib/resources/resourceRegistry.ts` | file (modified) | RES-02 registry; this phase additionally **exports** the shared logical-id predicate so `defineEngine` and the registry cannot drift (D-09). |
| `packages/libs/editor-core/lib/index.ts` | file (modified) | Root `.` barrel; gains the new named re-exports. |
| `packages/libs/editor-core/lib/__tests__/engineContract.test.ts` | file (new) | Contract + validation + preload-order tests for `defineEngine`. |
| `packages/libs/editor-core/lib/__tests__/coreApiSurface.test.ts` | file (modified) | Surface assertions extended for the new public names; the `DIAGNOSTIC_CODES` exact-five assertion stays byte-identical. |
| `ResourceDescriptor<T>` | interface | The generic, source-agnostic description of one resource: `id`, `create(deps)`, optional `preload`, optional `preloadDependsOn`. Never carries a path, format, handler instance, or parameter template (D-04). |
| `ResourceDependencies` | interface | The object handed to a descriptor's `create`; carries `fileHandlers` (the per-instance file layer) so a file-backed factory obtains the file layer **without core assuming content is a file** (D-04/D-05). |
| `PreloadStrategy` | type (union) | The allowed `preload` literals `'eager' \| 'lazy' \| 'on-demand'` and their default. Provisional pending user confirmation (A7). |
| `EngineDescription` | interface | The plain object an adapter author passes to `defineEngine`: `id`, optional `apiVersion`, `resources`. |
| `defineEngine` | function | Validates an `EngineDescription` (all problems at once) and returns a frozen `EngineAdapter`. The single construction seam for an adapter. |
| `EngineDefinitionError` | class | Carries **every** definition problem aggregated; it is the sole error `defineEngine` throws and is exported on the package's only importable surface. |
| `resolvePreloadOrder` | function | Pure, stable topological ordering of descriptor ids by `preloadDependsOn`; loads nothing, holds no state. |
| `isValidResourceId` | function | The **shared** logical-id predicate (defined + exported in `resourceRegistry.ts`, imported and re-exported by `engine.ts`). Used by both `defineEngine` and `ResourceRegistry.register` so the grammar cannot drift (D-09). |
| `ENGINE_ADAPTER_API_VERSION` | const | The adapter-contract version; `defineEngine` defaults `apiVersion` to it. The user may veto in favour of reusing `EDITOR_CORE_API_VERSION` (A3). |
| `EngineAdapter.resources` | interface member | The descriptors a validated adapter carries (the explicit `EngineAdapter` evolution, D-03). |
| `EngineAdapter.id` / `EngineAdapter.apiVersion` | interface members | The pre-existing minimal identity + contract-version members (retained unchanged). |

---

## Plan 05-02 — Game-identifier gate

| Name | Kind | What it is for |
|------|------|----------------|
| `scripts/verify/coreEngineNeutral.js` | file (new) | The two-polarity verifier that fails the build when any engine-identifier term appears in core production source (PORT-06). |
| `CORE_LIB` | module-local const | The scanned scope root (`packages/libs/editor-core/lib`). |
| `BANNED_TERMS` | module-local const | The full ban list `tower / floor / loc / autopass / autotile / idnum / airwall / commonEvent / prefab / mota`, matched **case-sensitively**. |
| `PROBE_FIXTURE_PATH` | module-local const | The transient two-polarity fixture written under core production source and deleted in `finally`. |
| `FLOOR_EXEMPT_PRECEDING_CHAR` | module-local const | The `.` preceding-character rule that keeps `Math.floor(...)` / `.floor(...)` clean (per-match, not a separate regex). |
| `collectSources` | module-local function | Recursive `.ts`/`.tsx` walker that excludes any `__tests__` path segment (D-12 scope). |
| `findViolations` | module-local function | Scans RAW source (comments included) for banned terms and returns `{ relPath, term, line }`. |
| `check` / `failures` / `main` | module-local function / array / function | The repo verifier-family skeleton (`failures[]` + `check()` + `main()` + `process.exit(1)` + 全部断言通过 line). |
| `.github/workflows/ci.yml` | file (modified) | Gains **one** `- run: node scripts/verify/coreEngineNeutral.js` step inside the existing `lint` job; the four-job contract is unchanged. |

---

## Plan 05-03 — File-backed resource class + fake engine B

| Name | Kind | What it is for |
|------|------|----------------|
| `packages/libs/editor-core/lib/resources/fileResource.ts` | file (new) | The **one** core class allowed to hold an opaque IO address; a thin façade over the file layer (D-06). |
| `FileResource<T>` | class | Binds an id + an opaque address + a handler factory; implements `LoadableResource<T>` and delegates to the injected `FileHandlerManager`. |
| `FileResource.constructor` | method | `(id, address, handlerFactory, deps)` — obtains the per-path `FileHandler` from `deps.fileHandlers`, builds the handler, subscribes content. |
| `FileResource.ensureLoaded` | method | Awaits `FileHandlerManager.load(address)` (manager owns the load lock). |
| `FileResource.reload` | method | Awaits `FileHandlerManager.reload(address)`. |
| `FileResource.waitForSettled` | method | Awaits the handler's settled state. |
| `FileResource.snapshot` | method | Returns the handler's current `Content<T>`. |
| `FileResource.value` | method | Returns `ContentUtils.unwrap(handler.getContent(), id)`. |
| `FileResource.subscribe` | method | Delegates to the handler's subscription. |
| `FileResource.id` / `FileResource.content` | class fields | The logical id and the readable content signal (the `ResourceView` surface). |
| `packages/libs/editor-core/lib/resources/__tests__/fileResource.test.ts` | file (new) | `MemoryFsPort`-driven tests for loaded / not-found / reload. |
| `packages/libs/editor-core/lib/__tests__/engineB.ts` | file (new) | The non-mota engine-B fixture (`EngineDescription`) proving the contract is not mota-shaped (PORT-08, D-11). |
| `engineBDescription` | const (exported from fixture) | The non-mota `EngineDescription` value with `engineB.*` ids and a preload graph. |
| `createEngineBDescription` | function (exported from fixture) | Builds an `EngineDescription` from an injected `ResourceDependencies` so tests can wire a `MemoryFsPort`-backed manager; no module-level mutable container. |
| `EngineBJsonDataHandler` | class (test-local) | The tiny `JsonDataHandler` subclass the fixture's file-backed descriptors construct via `create(deps)`. |
| `engineB.catalog`, `engineB.index`, `engineB.notes`, `engineB.chapter` | logical resource ids | The non-mota ids; `engineB.notes` is the **non-file** resource built with `computedResource`, proving the descriptor is source-agnostic. |
| `packages/libs/editor-core/lib/__tests__/engineB.test.ts` | file (new) | Drives `defineEngine` → validation → `ResourceRegistry` → get-by-id → preload order end to end. |

---

## Plan 05-04 — mota adapter descriptors

| Name | Kind | What it is for |
|------|------|----------------|
| `packages/apps/editor/src/adapter/motaResources.ts` | file (new) | The adapter-local constants module holding the **deliberately duplicated** path/var-name literals (D-01 forbids editing `projectData`; removed in Phase 11). |
| `MOTA_RESOURCE_ADDRESSES` | const (frozen object) | The adapter-side IO addresses. Keys: `tower`, `items`, `enemys`, `maps`, `icons`, `functions`, `plugins`, `events`, `editorConfig` (`_server/config.json`), `eventsVarName` (`events_c12a15a8_c380_4b28_8144_256cba95f760`). |
| `MOTA_EVENTS_VAR_NAME` | const | The events variable-name literal `events_c12a15a8_c380_4b28_8144_256cba95f760` (the exact value of `projectData.ts:28` `EVENTS_VAR_NAME`). |
| `motaFloorAddress` | function | Returns the concrete floor IO address from a `floorId` (parameterization resolved adapter-side, D-07). |
| `EventsData` | type (adapter-local) | Mirrors the events-data shape `{ commonEvent: CommonEventData; [key: string]: unknown }` used by `projectData`. |
| `packages/apps/editor/src/adapter/motaEngine.ts` | file (new) | Declares `motaEngine` and the nine fixed descriptors; dead code until Phase 11. |
| `motaEngine` | const (`EngineAdapter`) | The mota adapter produced by `defineEngine({ id: 'mota-js', resources: [...] })`. Engine id is `mota-js`. |
| `packages/apps/editor/src/adapter/motaFloor.ts` | file (new) | The parameterized floor descriptor factory. |
| `motaFloorDescriptor` | function | `(floorId: string) => ResourceDescriptor<FloorData>` returning a concrete descriptor; derives the id adapter-side and asserts it with `isValidResourceId`. |
| `MotaFloorIdError` | class (adapter-local) | Thrown by `motaFloorDescriptor` when the derived `mota.floor.<floorId>` id fails the shared logical-id predicate; message names the derived id and the grammar (do **not** widen the registry grammar). |
| `mota.tower`, `mota.items`, `mota.enemys`, `mota.maps`, `mota.icons`, `mota.functions`, `mota.plugins`, `mota.events`, `mota.editorConfig`, `mota.floor.<floorId>` | logical resource ids | The 10 mota resources expressed as descriptors (nine fixed + the parameterized floor family). |

---

*Materialized 2026-09-28 as a pre-execution planning artifact. Any further important name must be added here and confirmed before it lands in code.*
