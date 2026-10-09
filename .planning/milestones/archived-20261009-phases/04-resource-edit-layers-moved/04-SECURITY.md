---
phase: "4"
slug: "resource-edit-layers-moved"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-24"
---

# Phase 4 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Register authored at plan time across `04-01..04-04-PLAN.md` `<threat_model>` blocks. ASVS level 1, block-on `high`.
> `threats_open: 0` and `register_authored_at_plan_time: true` and `asvs_level == 1` → the L1 short-circuit applies (no auditor run required).

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| npm registry → workspace | The phase's only external input: four package resolutions plus two new catalog entries written into `pnpm-lock.yaml` | Package metadata / lockfile edges |
| editor consumer → core resource layer | Untrusted-at-the-edges call sites (`@/fs/*` importers) cross into core through forward-only shims; a shim that drops or renames a name is a silent contract break | Public symbol names (type-level) |
| host file system → core | `FsPort` is the only file-I/O contract; core treats paths as opaque and performs no path normalisation | Opaque path strings |
| two editor instances → shared core services | The de-singletonised `PersistenceMonitor` / `FileHandlerManager` / `OperationHistory` / `ResourceRegistry` must be per-instance | In-memory resource/edit state |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| 04-01/T-04-SC | Tampering | `pnpm install` of `es-toolkit` (+ `@tanstack/store`, `@tanstack/react-store`, `ts-pattern`) | high | mitigate | Legitimacy audit (`04-RESEARCH.md` §Package Legitimacy Audit: three `OK`, `es-toolkit` `SUS(too-new)`); blocking `checkpoint:human-verify` approved in-session; `es-toolkit` pinned to the exact installed `1.44.0`; lockfile diff reviewed; no `postinstall` | closed |
| 04-01/T-04-01 | Tampering / Information Disclosure | `packages/apps/editor/test/utils/testHelpers.ts` dead code | low | accept | Pre-existing, uncalled `createTestFileHandler`; no task imports it; the plan forbids importing it from a moved test | closed (accepted) |
| 04-01/T-04-02 | Integrity | `PersistenceMonitor` instance identity across the shim boundary | high | mitigate | One `new` site (`src/appInstances.ts`); the `src/fs/PersistenceMonitor.ts` shim re-exports the instance; `editorShims.js` asserts exactly 3 construction sites; `persistStatus.integration.test.ts` + `persistNoRollback.invariants.test.ts` are the two-polarity proof | closed |
| 04-01/T-04-03 | Integrity (silent data loss) | `isFileNotFoundError` classification in `lib/resources/errors.ts` | medium | mitigate | Classifier moves byte-for-byte; moved `errors.test.ts` keeps the `project-not-found` case; editor `FileHandler.test.ts` "工程访问错误不应误报为当前文件不存在" stays green through the shim | closed |
| 04-01/T-04-04 | Elevation of Privilege | Gate bypass via rule weakening (Block B `ignores` widened too far) | high | mitigate | Widening limited to `lib/**/__tests__/**` + `lib/**/*.test.{ts,tsx}`; Block A deliberately NOT merged into Block B; `coreModuleState.js` extended to prove the widened exemption resolves; its two-polarity fixtures untouched | closed |
| 04-01/T-04-05 | Denial of Service | Unbounded memory growth in the persistence queue | low | accept | `PersistExecutor` keeps exactly one executing + one pending intent, unchanged; covered by the moved `persistExecutor.invariants.test.ts` | closed (accepted) |
| 04-02/T-04-02 | Integrity / Information Disclosure | `FileHandlerManager` instance identity and its `handlers` map | high | mitigate | Per-instance maps (never module state); `src/appInstances.ts` is the only construction site (`new FileHandlerManagerClass(`, class imported under a module-local alias); `fileHandlerManager.test.ts` asserts one-handler-per-path inside an instance; `editorShims.js` asserts the single site | closed |
| 04-02/T-04-03 | Integrity (silent data loss) | `FileHandler.commit` / `FileHandler.delete` ordering through `this.persistenceMonitor` | high | mitigate | `FileHandler.commit` keeps `this._content({status:'loaded',value})` immediately before `PersistenceMonitor.schedule`; delete path keeps swallowing only `isFileNotFoundError`; covered by the moved core suites + `persistNoRollback.invariants.test.ts` | closed |
| 04-02/T-04-06 | Tampering | Path traversal through the injected port | low | accept | Deliberately out of core's scope: `FsPort` treats paths as opaque (`ports/fs.ts` documents this) and escaping prevention stays in the host | closed (accepted) |
| 04-02/T-04-07 | Denial of Service | Unbounded `FileHandler` growth in the per-instance `handlers` map | low | accept | Pre-existing behaviour, unchanged; `FileHandlerManager.clear()`/`remove()` remain available and are exercised by the editor's tests | closed (accepted) |
| 04-02/T-04-08 | Repudiation / Integrity | Stale two-argument `new FileHandler(` surviving outside the typed program | high | mitigate | One atomic commit; all 23 in-test sites + the four editor fixture sites enumerated in `<files>` and asserted by an acceptance criterion; a surviving site is named as a concrete `fails_when` runtime signature | closed |
| 04-03/T-04-09 | Integrity | `OperationHistory.execute` capture timing (`captureSystems` must run synchronously at invocation) | high | mitigate | The seam's `capture(): Snapshot` is typed synchronous; `OperationHistory.execute` captures before `enqueue`; the `UndoSystem` doc comment states the requirement; `operationHistory.test.ts` asserts the viewport restored to the invoked floor | closed |
| 04-03/T-04-10 | Integrity | `OperationHistory.undo()` / `OperationHistory.redo()` restore ordering (targets first, then systems in reverse registration order) | high | mitigate | Restore order asserted by the moved pure invariants test (literal capture/restore log) and preserved verbatim in `OperationHistory.applyWithCheckpoint` / `OperationHistory.undo` / `OperationHistory.redo` | closed |
| 04-03/T-04-02 | Information Disclosure / Integrity | Cross-instance state leakage via the store or the `UndoSystem` map | high | mitigate | Both are instance fields; exactly one `new OperationHistory(` site; the core invariants test constructs a fresh instance per test (itself a two-instance isolation check) | closed |
| 04-03/T-04-11 | Elevation of Privilege | Gate bypass — a module-level store or registry re-introduced in core | high | mitigate | Module-state lint block + `coreModuleState.js` on the real tree; retargeted `requireZero` rule and the `editorShims.js` single-`new`-site verifier | closed |
| 04-03/T-04-05 | Denial of Service | Unbounded history growth | medium | mitigate | `capacity = 100` and `entries.shift()` eviction move verbatim; asserted by the moved "keeps at most 100 entries" case | closed |
| 04-03/T-04-12 | Integrity | `PatchableResource<T>` accepting an object that is not a real resource | low | accept | Structural and narrow; the caller is the editor's own command layer passing a `DataResource<T>`; avoids dragging editor types into core | closed (accepted) |
| 04-04/T-04-01 | Tampering (prototype pollution) | `ResourceRegistry.register` id handling | high | mitigate | `Map`-backed storage (never object-key assignment); explicit id-form rejection incl. `__proto__`/`constructor`/`prototype`; `ResourceRegistry.snapshot()` returns frozen entries; a unit test asserts `Object.prototype` is unpolluted after a rejected registration | closed |
| 04-04/T-04-04 | Elevation of Privilege (gate bypass) | `.dependencyCruiser.cjs` + `scripts/verify/editorShims.js` | high | mitigate | Both gates inside the pre-existing `lint` job; `editorShims.js` carries a two-polarity proof with `finally` cleanup and an absence assertion; `lint-severities.js` guards rule severities; `ci-workflow.js` guards the four-job shape | closed |
| 04-04/T-04-02 | Integrity / Information Disclosure | Two editors sharing resource state | high | mitigate | `ResourceRegistry` is per-instance with an isolation unit test; the `editorShims.js` single-`new`-site assertion is the cross-cutting control for all three de-singletonised instances | closed |
| 04-04/T-04-13 | Repudiation | A `// SHIM(phase4)` file deleted or renamed before Phase 11 without the list noticing | medium | mitigate | The verifier asserts set EQUALITY against a hard-coded expected list, so any drift fails the `lint` job | closed |
| 04-04/T-04-14 | Tampering | A new subpath exported accidentally, widening core's public surface | medium | mitigate | `coreExports.js` asserts the exports map is exactly seven names and each target exists on disk; the plan forbids adding `./resources` or `./edit` | closed |
| 04-04/T-04-15 | Information Disclosure | The retargeted dependency-cruiser rule appearing to guard something it cannot see | medium | accept | Measured: dependency-cruiser does not resolve `@/`, so the editor half is dormant until Phase 11. Accepted with the rule comment stating it explicitly and `editorShims.js` carrying the real enforcement | closed (accepted) |

*Status: closed · open · open — below `high` threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above `workflow.security_block_on` (`high`) count toward `threats_open`*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-04-01 | 04-01/T-04-01 | Uncalled dead test helper carries a stale 2-arg `new FileHandler(`; no task imports it and Vite only transforms imported modules | user (plan-approved) | 2026-09-24 |
| AR-04-02 | 04-01/T-04-05 | Persistence queue is bounded to one executing + one pending by design; unchanged | user (plan-approved) | 2026-09-24 |
| AR-04-03 | 04-02/T-04-06 | Path traversal is out of core's scope by design; `FsPort` treats paths as opaque and the host enforces escaping | user (plan-approved) | 2026-09-24 |
| AR-04-04 | 04-02/T-04-07 | Pre-existing unbounded per-instance handler map; `clear()`/`remove()` exist | user (plan-approved) | 2026-09-24 |
| AR-04-05 | 04-03/T-04-12 | `PatchableResource<T>` is an intentionally structural contract; the caller is the editor's own command layer | user (plan-approved) | 2026-09-24 |
| AR-04-06 | 04-04/T-04-15 | The dependency-cruiser editor half is dormant-by-target (the tool cannot resolve `@/`); the honest comment plus `editorShims.js` is the working enforcement | user (plan-approved) | 2026-09-24 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-24 | 23 | 23 | 0 | orchestrator (L1 short-circuit: `threats_open: 0`, register authored at plan time, ASVS L1) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-24
