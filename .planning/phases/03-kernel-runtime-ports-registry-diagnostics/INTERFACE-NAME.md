# Phase 3 — Interface & Naming Confirmation

> AGENTS.md Project Rules: any **important naming** (file / interface / method / function / type / package / exported symbol) MUST be reported here and confirmed by the user **before** it is written into code, plans, or config.
> One section per Plan. Plans are not generated yet (plan-phase is running), so this first section lists **every** new name the phase introduces; after confirmation the planner will split it into per-plan sections without changing any name.
> Method references use `ClassName.methodName` (AGENTS.md).

**Status:** ⏳ awaiting user confirmation (2026-09-22)
**Scope:** names introduced by Phase 3 only. Names locked earlier are marked *(locked)*.

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

*(populated by gsd-planner after confirmation)*

## Section 2 — Plan 02

*(populated by gsd-planner after confirmation)*

## Section 3 — Plan 03

*(populated by gsd-planner after confirmation)*
