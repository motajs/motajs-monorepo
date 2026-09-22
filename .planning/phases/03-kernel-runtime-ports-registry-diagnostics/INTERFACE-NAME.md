# Phase 3 — Interface & Naming Confirmation

> AGENTS.md Project Rules: any **important naming** (file / interface / method / function / type / package / exported symbol) MUST be reported here and confirmed by the user **before** it is written into code, plans, or config.
> One section per Plan. Section 0 lists **every** new name the phase introduces; Sections 1–4 split that set per plan and add the non-exported (module-private) members each plan creates, without renaming anything.
> Method references use `ClassName.methodName` (AGENTS.md).

**Status:** ✅ confirmed (2026-09-22) — N-01..N-26 used verbatim by plans 03-01..03-04
**Scope:** names introduced by Phase 3 only. Names locked earlier are marked *(locked)*.
**Plans:** 03-01 (kernel tracer + registry + bus), 03-02 (atomic startup + lifecycle), 03-03 (ports + public surface), 03-04 (module-state + PORT-02 gates).

> **Plan 03-03 outcome not yet reflected in Section 0's table:** Section 0 claims to be closed and does not name port *members*. Plan 03-03 therefore introduces them; every one is either **inherited verbatim from existing repo source** or **convention-following**, and they are listed explicitly in Section 3 so the user can veto them before execution. No other plan introduces a name outside N-01..N-26 with the exception of module-private (non-exported) members, which Section 0 already declares out of scope.

---

## Section 0 — All Phase 3 names (provisional, pre-plan)

### Already locked (no decision needed)

| Name | Kind | Purpose |
|------|------|---------|
| `createEditorCore` | factory function *(locked, ROADMAP/KERN-01)* | builds a per-instance core from a config |
| `EditorCore` | type *(locked)* | the per-instance object graph |
| `registerCapability` / `getCapability` / `getCapabilityOrThrow` / `snapshotCapabilities` | instance methods *(locked, KERN-03)* | the public capability registry on the instance |
| `EDITOR_CORE_API_VERSION` | exported const *(locked, KERN-05)* | the public-API version string |
| `DiagnosticBus` | type *(locked, KERN-05)* | the diagnostic event hub |
| `EngineAdapter` / `FsPort` / `HostPort` / `PreviewAdapter` | port interfaces *(locked, PORT-01)* | the injected contracts core depends on |
| `lib/kernel/core.ts` | file path *(locked, Phase-2 `requireZero` rule)* | the composition root |
| `lib/kernel/` + `lib/ports/` | directories *(locked, D-16)* | mechanism vs contracts |

### Proposed new names — need confirmation

| # | Proposed name | Kind | Purpose / why this name |
|---|---|---|---|
| N-01 | `packages/libs/editor-core/lib/kernel/core.ts` | file | Composition root: `createEditorCore`, the `EditorCore` type, `EditorCoreConfig`, and `EDITOR_CORE_API_VERSION` (D-20). Path locked by the Phase-2 rule; the file is new. |
| N-02 | `EditorCoreConfig` | type | The object passed to `createEditorCore`: the required-registration list (D-07), the optional `install` callback (D-18), and nothing that exposes the instance (D-12). |
| N-03 | `packages/libs/editor-core/lib/kernel/registry.ts` | file | The capability registry implementation + its supporting types. |
| N-04 | `CapabilityRef` | type | One registry entry as returned by `EditorCore.snapshotCapabilities()`: `{ kind, id, value, owner }` (D-19). "Ref" because it is a read-only reference, not a handle. |
| N-05 | `RegisterCapabilityOptions` | type | The 4th argument of `EditorCore.registerCapability`: `{ owner?, replaceable? }` (D-03). |
| N-06 | `RegisterCapabilityResult` | type | The return of `EditorCore.registerCapability`: `{ disposer, diagnostics }` (D-02). Mirrors the in-repo `RegisterPackResult` precedent's naming shape. |
| N-07 | `CapabilityRegistrar` | type | The **narrow** interface handed to the `install` callback (D-18): exposes `CapabilityRegistrar.register` plus a teardown-registration member — never the `EditorCore` instance. Name chosen so the type cannot be confused with `EditorCore` or the registry itself. |
| N-08 | `CapabilityRegistrar.register` + `CapabilityRegistrar.addTeardown` | methods | The registrar's two members: register one capability during construction; register a teardown hook so KERN-02's reverse-order release is observable. *(If you prefer different member names, say so — this is the one place the research left the members unnamed.)* |
| N-09 | `packages/libs/editor-core/lib/kernel/diagnostics.ts` | file | `Diagnostic`, its severity type, `DiagnosticBus`, the bus factory, and the diagnostic-code table. |
| N-10 | `Diagnostic` | type | `{ severity, code, message, owner?, target?, cause? }` (D-05). |
| N-11 | `DiagnosticSeverity` | type | The three-level union `'error' \| 'warning' \| 'info'` (D-05/B1). Named separately so the union is referenceable without restating it. |
| N-12 | `createDiagnosticBus` | factory function | Builds a **per-instance** bus (D-06). A factory (not a class) so the implementation can stay a closure and the module holds no mutable state — which the new structural gate would otherwise flag. |
| N-13 | `DIAGNOSTIC_CODES` | const table (`as const`) | The single stable machine-code table (D-05): `capability.duplicate`, `capability.kind-invalid`, `capability.required-missing`, `diagnostic.subscriber-error`, `lifecycle.teardown-failed`. A table (not loose strings) so tests and CI can assert exact codes. |
| N-14 | `DiagnosticCode` | type | The union derived from `DIAGNOSTIC_CODES` — lets consumers switch exhaustively over codes. |
| N-15 | `packages/libs/editor-core/lib/kernel/errors.ts` | file | The startup-failure error type. |
| N-16 | `EditorCoreStartupError` | class | Thrown by `createEditorCore` when a required registration is unresolved, carrying **all** diagnostics (D-08). A dedicated class so callers/tests can tell "startup failed" apart from a code bug. |
| N-17 | `packages/libs/editor-core/lib/ports/index.ts` + `lib/ports/{engine,fs,host,preview}.ts` | files | One file per port interface + a barrel. Four files (not one) because each port has a different consumer and will grow in a different phase (D-14/D-16). |
| N-18 | `packages/libs/editor-core/lib/index.ts` (extended) | file *(exists)* | Aggregates the public surface: re-exports the kernel and the four ports. |
| N-19 | `scripts/verify/coreModuleState.js` | verifier script | The structural gate's two-polarity proof: real `lib/**` tree green, a synthetic module-scope `let` fixture red (D-10). `core` prefix matches the Phase-2 verifier family. |
| N-20 | `packages/libs/editor-core/lib/__tests__/capabilityRegistry.test.ts` | test file | KERN-03: registry contract (register/get/getOrThrow/snapshot, duplicate rejected without side effect, failed replacement restores the previous value). |
| N-21 | `packages/libs/editor-core/lib/__tests__/diagnostics.test.ts` | test file | KERN-05: bus history, late-subscriber replay, subscriber-error isolation. |
| N-22 | `packages/libs/editor-core/lib/__tests__/coreStartup.test.ts` | test file | KERN-04: aggregation, missing-required → dispose + startup error, non-blocking error diagnostics. |
| N-23 | `packages/libs/editor-core/lib/__tests__/coreLifecycle.test.ts` | test file | KERN-02: reverse-order release, idempotency, a throwing teardown does not abort the rest. |
| N-24 | `packages/libs/editor-core/lib/__tests__/coreIsolation.test.ts` | test file | KERN-01/KERN-06: two instances coexist; registries/histories disjoint; disposing one leaves the other working. |
| N-25 | `packages/libs/editor-core/lib/__tests__/coreApiSurface.test.ts` | test file | KERN-05/PORT-01: the exported surface (version constant, four ports, registry methods) is actually exported. *(Alternative: a `scripts/verify/coreApiSurface.js` verifier — the planner will pick one; tell me if you prefer the verifier form.)* |
| N-26 | `subpathStatus.json` → `.` entry's `content` value | data value | Phase 2's manifest marks `.` as `"empty-barrel"`. After Phase 3 it re-exports the kernel, so the value must change (proposed: `"kernel-exports"`). `coreExports.js` cross-checks this manifest, so the value is a small contract. |

### Deliberately NOT named here

- **Kind constants** — Phase 3 registers nothing, so core owns no `kind` values yet; D-04's "core exports constants for the kinds it owns" produces an **empty set** this phase. Kind constants arrive with the shell/capability phases. (Research A8.)
- **Diagnostic `code` values beyond the five above** — new codes are added as new failure modes appear; only the five this phase can emit are fixed now.
- Internal local variables, private helper functions inside a module, and test-internal fixtures.

### Naming rule applied

`camelCase` file names; `PascalCase` types/classes; `SCREAMING_SNAKE_CASE` for the code table; `lib/kernel/` = mechanism, `lib/ports/` = contracts (D-16); `lib/` never `src/`; no `@/` inside core (Phase-2 D-06 amended).

---

## Section 1 — Plan 01

**Plan:** `03-01-PLAN.md` — Kernel tracer: live per-instance `EditorCore`, hardened registry, hardened diagnostic bus.
**Files created:** `lib/kernel/diagnostics.ts`, `lib/kernel/registry.ts`, `lib/kernel/errors.ts`, `lib/kernel/core.ts`, `lib/__tests__/coreIsolation.test.ts`, `lib/__tests__/capabilityRegistry.test.ts`, `lib/__tests__/diagnostics.test.ts`.
**Wave:** 1 · **Depends on:** nothing.

### Exported names this plan introduces (from N-01..N-26)

| # | Name | Where | Purpose (why this name) | Confidence note |
|---|------|-------|-------------------------|-----------------|
| N-01 | `lib/kernel/core.ts` | file | Composition root: `createEditorCore`, `EditorCore`, `EditorCoreConfig`, `CapabilityRegistrar`, `EDITOR_CORE_API_VERSION`. Path locked by the Phase-2 `requireZero` rule. | confirmed |
| N-02 | `EditorCoreConfig` | type | The object handed to `createEditorCore`: an optional `install` callback (D-18) and an optional `requiredCapabilities` list (D-07). Exposes no instance. | confirmed |
| N-03 | `lib/kernel/registry.ts` | file | Holds the registry's **contract types**. The registry's storage and kind validation live inside the `createEditorCore` closure, because D-01 makes the instance the registry's only entry point and the confirmed export set is exactly N-01..N-26 (no second registry factory name exists). | confirmed (see note below) |
| N-04 | `CapabilityRef` | type | One read-only snapshot entry: `{ kind, id, value, owner? }` (D-19). | confirmed |
| N-05 | `RegisterCapabilityOptions` | type | The 4th argument of `EditorCore.registerCapability`: `{ owner?, replaceable? }` (D-03). | confirmed |
| N-06 | `RegisterCapabilityResult` | type | The return of `EditorCore.registerCapability`: `{ disposer, diagnostics }` (D-02), mirroring the in-repo `RegisterPackResult` naming shape. | confirmed |
| N-07 | `CapabilityRegistrar` | type | The **narrow** interface handed to the `install` callback (D-18). Never the `EditorCore` instance. | confirmed |
| N-08 | `CapabilityRegistrar.register`, `CapabilityRegistrar.addTeardown` | methods | Register one capability during construction; register a teardown hook so reverse-order release is observable (KERN-02). | confirmed |
| N-09 | `lib/kernel/diagnostics.ts` | file | `Diagnostic`, `DiagnosticSeverity`, `DiagnosticBus`, `createDiagnosticBus`, `DIAGNOSTIC_CODES`, `DiagnosticCode`. | confirmed |
| N-10 | `Diagnostic` | type | `{ severity, code, message, owner?, target?, cause? }` (D-05 — deliberately no `timestamp`, no `details`). | confirmed |
| N-11 | `DiagnosticSeverity` | type | `'error' \| 'warning' \| 'info'` (D-05). | confirmed |
| N-12 | `createDiagnosticBus` | factory function | Builds a **per-instance** bus in a closure so the module holds no mutable state (D-06). | confirmed |
| N-13 | `DIAGNOSTIC_CODES` | `as const` table | The stable machine-code table (D-05): `capability.duplicate`, `capability.kind-invalid`, `capability.required-missing`, `diagnostic.subscriber-error`, `lifecycle.teardown-failed`. | confirmed |
| N-14 | `DiagnosticCode` | type | The union derived from `DIAGNOSTIC_CODES`. | confirmed |
| N-15 | `lib/kernel/errors.ts` | file | The startup-failure error type. | confirmed |
| N-16 | `EditorCoreStartupError` | class | Carries **all** diagnostics when construction cannot complete (D-08). Declared here; first really thrown in Plan 02. | confirmed |
| N-20 | `lib/__tests__/capabilityRegistry.test.ts` | test file | Registry contract (KERN-03). | confirmed |
| N-21 | `lib/__tests__/diagnostics.test.ts` | test file | Bus contract (KERN-05). | confirmed |
| N-24 | `lib/__tests__/coreIsolation.test.ts` | test file | Tracer path + two-instance isolation (KERN-01 / KERN-06). | confirmed |

### Names this plan introduces that Section 0 does **not** list

All of them are **module-private** (not exported), which Section 0's "Deliberately NOT named here" already exempts. Listed for transparency:

| Name | Kind | Purpose |
|---|---|---|
| `KIND_PATTERN` | module-private `const` regexp literal in `core.ts` | The D-17 kind-format rule `^[A-Za-z][\w-]*(\.[A-Za-z][\w-]*)*$` — one-or-more dot-separated segments, camelCase/hyphen tolerant. Private so core exports no kind grammar. |
| `RegistryEntry` | module-private interface in `core.ts` | The stored row behind a `kind:id` key: `kind`, `id`, `value`, `owner`, `replaceable`. Private because `CapabilityRef` is the only public view (D-19). |
| `BUILTIN_REQUIRED_CAPABILITIES` | module-private `const` in `core.ts` (declared here, used in Plan 02) | Core's own required-registration list; `Object.freeze([])` in Phase 3 because core owns no kind yet (A8). |
| drain helper (one module-private function in `core.ts`) | function | The single reverse-order, throw-isolating teardown drain shared by `dispose()` and the startup-failure path. Private so there is exactly one implementation. |
| `DiagnosticBus.push` | method on the confirmed `DiagnosticBus` type | The producer entry point; the name comes from the research's candidate shape (`bus.push(...)`), and D-06 locks only `snapshot()` / `subscribe()`. |
| `DiagnosticBus.snapshot`, `DiagnosticBus.subscribe` | methods | Locked by D-06. |
| `EditorCoreConfig.install`, `EditorCoreConfig.requiredCapabilities` | fields on the confirmed `EditorCoreConfig` type | `install` is D-18's construction hook; `requiredCapabilities` is D-07's explicit list (entries are `kind:id` strings). |
| `getCapability` / `getCapabilityOrThrow` generic parameter | signature detail | Both take an optional `<T = unknown>` so a consumer can read a typed capability without a cast; the default keeps the research's `unknown` shape. |

### Note on N-03 (recorded divergence, no rename)

N-03's purpose column says "the capability registry implementation + its supporting types". This plan puts the **types** in `registry.ts` and the **storage + kind validation** inside the `createEditorCore` closure in `core.ts`. Reason: D-01 makes the `EditorCore` instance the registry's only entry point, and a second exported factory for the registry (e.g. `createCapabilityRegistry`) would be an exported symbol outside the confirmed N-01..N-26 set. The four-file `lib/kernel/` split of D-16 is unchanged and `registry.ts` remains the registry's contract module.

---

## Section 2 — Plan 02

**Plan:** `03-02-PLAN.md` — Atomic construction and an honest teardown.
**Files created:** `lib/__tests__/coreStartup.test.ts`, `lib/__tests__/coreLifecycle.test.ts`.
**Files modified:** `lib/kernel/core.ts`, `lib/kernel/errors.ts`.
**Wave:** 2 · **Depends on:** `03-01`.

| # | Name | Kind | Purpose (why this name) |
|---|------|------|-------------------------|
| N-16 | `EditorCoreStartupError` | class (now actually constructed and thrown) | The only thing `createEditorCore` throws; carries `readonly diagnostics` = the full `DiagnosticBus.snapshot()` (D-08). |
| N-22 | `lib/__tests__/coreStartup.test.ts` | test file | Aggregation, reverse-order dispose on failure, startup error carrying all diagnostics, non-blocking error diagnostics (KERN-04). |
| N-23 | `lib/__tests__/coreLifecycle.test.ts` | test file | Reverse-order release, idempotency, a throwing teardown that does not abort the rest, the reporting channel (KERN-02 / D-21). |

### Non-exported names this plan uses or adds

| Name | Kind | Purpose |
|---|---|---|
| `BUILTIN_REQUIRED_CAPABILITIES` | module-private `const` in `core.ts` (declared in Plan 01) | The core-owned half of D-07's required set; empty in Phase 3. |
| drain helper (module-private) | function | Now shared by `dispose()` and the startup-failure path — one implementation of "reverse order, isolate throws". |
| `editor-core:` console prefix | string literal | The D-21 console channel for collected teardown failures, mirroring `PersistExecutor`'s `'PersistExecutor: task failed'` prefix. Not an identifier; recorded so nobody "tidies" it into a different prefix. |
| `capability.required-missing` / `lifecycle.teardown-failed` | values of the confirmed `DIAGNOSTIC_CODES` table | The two codes this plan emits. |

No export name is added or renamed by this plan.

---

## Section 3 — Plan 03

**Plan:** `03-03-PLAN.md` — Declared ports and an honest public surface.
**Files created:** `lib/ports/engine.ts`, `lib/ports/fs.ts`, `lib/ports/host.ts`, `lib/ports/preview.ts`, `lib/ports/index.ts`, `lib/__tests__/coreApiSurface.test.ts`.
**Files modified:** `lib/index.ts`, `.planning/phases/02-package-boundary-build-scaffolding/subpathStatus.json`, `scripts/verify/coreExports.js`.
**Wave:** 2 · **Depends on:** `03-01`.

| # | Name | Kind | Purpose (why this name) |
|---|------|------|-------------------------|
| N-17 | `lib/ports/index.ts` + `lib/ports/{engine,fs,host,preview}.ts` | files | One file per port plus a barrel — each port has a different consumer and grows in a different phase (D-14/D-16). |
| N-18 | `lib/index.ts` (extended) | file | The public aggregate: kernel names plus the four port names, and no capability subpath. |
| N-25 | `lib/__tests__/coreApiSurface.test.ts` | test file | Runtime assertions on the exported constants/factories plus compile-time assertions that the four port types resolve from `../index` (KERN-05 / PORT-01). Chosen over a `scripts/verify/coreApiSurface.js` verifier because only `tsc` can assert a type-only export exists. |
| N-26 | `subpathStatus.json` → `.` entry's `content` | data value | `"kernel-exports"`. Becomes a small contract because `scripts/verify/coreExports.js` cross-checks it (Pitfall 8); both files change in the same commit. |

### Port member names this plan introduces (not covered by Section 0)

Every one is either inherited verbatim from existing repo source or follows the repo's existing naming convention, so no new *vocabulary* is invented:

| Name | Owner | Source of the name |
|---|---|---|
| `FsPort.readFile`, `FsPort.readFileBinary`, `FsPort.writeFile`, `FsPort.deleteFile`, `FsPort.readdir`, `FsPort.mkdir`, `FsPort.moveFile` | `FsPort` (`lib/ports/fs.ts`) | **Inherited verbatim** from the existing `FsPromiseApi` (`packages/apps/editor/src/services/fs/fs.ts:23-32`). `FsPort.writeMultiFiles` is deliberately **not** carried over — no production caller (D-14). |
| `HostPort.endpoints`, `HostPort.docs`, `HostPort.update` | `HostPort` (`lib/ports/host.ts`) | **Inherited verbatim** from `EditorEnvironment.endpoints` + the optional `docs`/`update` endpoint names (`packages/apps/editor/src/environment.ts:12-19`). |
| `EngineAdapter.id`, `EngineAdapter.apiVersion` | `EngineAdapter` (`lib/ports/engine.ts`) | Convention-following: `apiVersion` mirrors the versioned-contract convention of `RUNTIME_PROTOCOL_VERSION`; `id` is the logical adapter identity Phase 5 needs to key an engine description. Entry shape only (D-14). |
| `PreviewAdapter.apiVersion` | `PreviewAdapter` (`lib/ports/preview.ts`) | Convention-following; the smallest non-empty placeholder. Phase 11 adds the boot hook. |

> **Veto window:** these four member-name groups are the only names in the phase that Section 0 did not enumerate. They are listed here before execution so they can be rejected or renamed (the files are new, so a rename costs nothing yet).

---

## Section 4 — Plan 04

**Plan:** `03-04-PLAN.md` — The two static gates: PORT-02 and module state.
**Files created:** `scripts/verify/coreModuleState.js`.
**Files modified:** `eslint.config.js`, `.github/workflows/ci.yml`.
**Wave:** 3 · **Depends on:** `03-01`, `03-02`, `03-03`.

| # | Name | Kind | Purpose (why this name) |
|---|------|------|-------------------------|
| N-19 | `scripts/verify/coreModuleState.js` | verifier script | The structural gate's two-polarity proof (module state **and** PORT-02): real `lib/**` tree green, a synthetic module-scope `let` fixture red, a synthetic fixture containing every banned identifier red. `core` prefix matches the Phase-2 verifier family. |

### Non-exported names this plan adds

| Name | Kind | Purpose |
|---|---|---|
| `packages/libs/editor-core/lib/__moduleStateProbe__.ts` | transient synthetic fixture | Holds a module-scope `let` (and an exported one) so the module-state selectors are proven able to fire. Created and deleted by `coreModuleState.js`; never committed. |
| `packages/libs/editor-core/lib/__port02Probe__.ts` | transient synthetic fixture | Holds exactly one use of each banned construct. Created and deleted by `coreModuleState.js`; never committed. |
| `RESTRICTED_RULES` | module-private `const` Set in the verifier | The three rule ids the real-tree assertion counts: `no-restricted-syntax`, `no-restricted-globals`, `no-restricted-properties`. Private to the script. |
| the two flat-config blocks in `eslint.config.js` | config objects | Not identifiers: the first carries the PORT-02 rules (no `ignores`), the second carries the module-state selectors with `ignores: ['packages/libs/editor-core/lib/kernel/core.ts']`. The split is deliberate and must not be merged (see the plan's task action). |
| the exact `no-restricted-syntax` selector strings | config values | The four module-state selectors and the `import.meta.env` selector; their exact text is fixed by the plan's task action because the selector text *is* the contract. |

No export name is added or renamed by this plan.

