---
status: testing
phase: 05-engine-adapter-skeleton-resource-descriptors
source: [05-01-SUMMARY.md, 05-02-SUMMARY.md, 05-03-SUMMARY.md, 05-04-SUMMARY.md]
started: 2026-09-28T00:00:00Z
updated: 2026-09-28T00:00:00Z
---

## Current Test

number: 16
name: Confirm auto-covered deliverables
expected: |
  All 15 deliverables below are deterministically covered by passing tests / verify
  commands (no user-observable UI to exercise — Phase 5 is an additive, internal
  refactor with `projectData.ts` byte-identical and zero editor behavior change).
  Confirm the auto-pass set is accurate.
awaiting: user response

## Tests

### 1. Generic source-agnostic adapter contract
expected: `ResourceDescriptor<T>`, `ResourceDependencies`, `PreloadStrategy`, `EngineDescription`, widened `EngineAdapter` (resources required), `ENGINE_ADAPTER_API_VERSION` resolve from root `.`; core builds no `project/...` path.
result: pass
source: automated
coverage_id: D1
requirement: PORT-04

### 2. `defineEngine` aggregated validation
expected: seven validation rules; one `EngineDefinitionError` carrying every problem at once; no coupling to the diagnostic bus (`DIAGNOSTIC_CODES` stays five).
result: pass
source: automated
coverage_id: D2
requirement: PORT-03

### 3. `resolvePreloadOrder` purity
expected: pure, stable, deterministic topological order (dependencies before dependents).
result: pass
source: automated
coverage_id: D3
requirement: PORT-03

### 4. Shared `isValidResourceId` predicate
expected: `defineEngine` and `ResourceRegistry` share one logical-id grammar; `assertValidLogicalId` delegates with unchanged messages.
result: pass
source: automated
coverage_id: D4
requirement: PORT-04

### 5. Root `.` barrel re-exports
expected: five new values + four new types exported; `coreExports.js` + `subpathStatus.json` untouched.
result: pass
source: automated
coverage_id: D5

### 6. Pre-execution naming gate
expected: `INTERFACE-NAME.md` (four Plan sections, every name + purpose, CONFIRMED) and reasoned `COVERAGE.md` verified before any source edit.
result: pass
source: automated
coverage_id: D6

### 7. `scripts/verify/coreEngineNeutral.js` two-polarity gate
expected: fails on any of the ten engine-identifier terms in core production source (raw source, case-sensitive, `floor` member-access exempt, `__tests__` excluded); real tree green (36 files / 0 violations), synthetic fixture red, `Math.floor` clean.
result: pass
source: automated
coverage_id: D1
requirement: PORT-06

### 8. CI wiring of the gate
expected: exactly one added step in the existing `lint` job; four-job contract unaltered.
result: pass
source: automated
coverage_id: D2
requirement: PORT-06

### 9. `FileResource<T>`
expected: core's only class holding an opaque IO address; implements `LoadableResource<T>`; delegates load/reload to injected `FileHandlerManager`; inspects no extension, joins no path.
result: pass
source: automated
coverage_id: D1
requirement: PORT-04

### 10. Fake non-mota engine B
expected: `defineEngine` → validation → `ResourceRegistry` → get-by-id → `resolvePreloadOrder` end to end with `engineB.*` ids and a non-file `engineB.notes` resource (zero `FsPort` reads).
result: pass
source: automated
coverage_id: D2
requirement: PORT-08

### 11. `FileResource` root barrel export
expected: re-exported as a value only; `coreApiSurface.test.ts` asserts it; `DIAGNOSTIC_CODES` exact-five unchanged.
result: pass
source: automated
coverage_id: D3
requirement: PORT-04

### 12. `motaResources.ts` constants
expected: adapter-local literals (`MOTA_RESOURCE_ADDRESSES`, `MOTA_EVENTS_VAR_NAME`), `motaFloorAddress(floorId)`, `EventsData`; no `projectData` import.
result: pass
source: automated
coverage_id: D1
requirement: PORT-04

### 13. `motaEngine.ts` descriptors
expected: `defineEngine({ id: 'mota-js', resources: [...] })` with nine fixed descriptors, each `create(deps)` building `FileResource` with the matching domain handler.
result: pass
source: automated
coverage_id: D2
requirement: PORT-03

### 14. `motaFloor.ts` parameterized factory
expected: `motaFloorDescriptor(floorId)` derives `mota.floor.<floorId>` adapter-side, asserts with `isValidResourceId`, throws `MotaFloorIdError` on violation (no grammar widening); `preload: 'on-demand'` + `preloadDependsOn: ['mota.tower']`.
result: pass
source: automated
coverage_id: D3
requirement: PORT-04

### 15. Adapter ownership + additive posture
expected: `Json2x`/domain handlers adapter-owned (PORT-05); `airwallMigration.ts` stays editor-side with no core reference (PORT-07/D-10); no entry point imports the adapter; `projectData.ts` byte-identical.
result: pass
source: automated
coverage_id: D4
requirement: PORT-05

### 16. Confirm auto-covered deliverables
expected: user confirms all 15 auto-passed deliverables are accurately covered.
result: [pending]

## Summary

total: 16
passed: 15
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps

[none yet]
