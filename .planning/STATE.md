---
gsd_state_version: "1.0"
current_phase: "05.1"
current_phase_name: editor-core
current_plan: 8
status: executing
stopped_at: Completed 05.1-07-PLAN.md
last_updated: "2026-09-29T10:42:00.191Z"
last_activity: 2026-09-28
last_activity_desc: Phase 05.1 plan 01 complete (editor-core undo contract types)
state_head: 9b677602a20023daaabc721da52cc5763e09d3a5
progress:
  total_phases: 14
  completed_phases: 0
  total_plans: 33
  completed_plans: 33
  percent: 0
---

Total Phases: 6

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-24)

**Core value:** Decouple the editor kernel from engine details through an engine-agnostic `editor-core` so old and new engines share one editing layer and third parties can customise freely.
**Current focus:** Phase 05.1 — editor-core 接口与实现整改（插入阶段）

## Current Position

Phase: 05.1 (editor-core) — IN PROGRESS
Current Plan: 8
Total Plans in Phase: 8
Status: Executing (plan 01 complete; plan 02 pending briefing/approval)
Last activity: 2026-09-28 — 05.1-01 撤销契约类型落地（`lib/kernel/types.ts`）

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 21
- Average duration: - min
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 10 | - | - |
| 2 | 3 | - | - |
| 3 | 4 | - | - |
| 4 | 4 | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: N/A

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 4 P01 | 30 | 3 tasks | 28 files |
| Phase 04 P02 | 25min | 3 tasks | 23 files |
| Phase 4 P3 | 38min | 2 tasks | 17 files |
| Phase 04 P04 | 25 | 3 tasks | 9 files |
| Phase 05 P01 | 17 | 3 tasks | 5 files |
| Phase 05 P02 | 6 | 2 tasks | 2 files |
| Phase 5 P03 | 16min | 2 tasks | 6 files |
| Phase 5 P04 | 10 | 2 tasks | 3 files |
| Phase 05.1 P01 | 6min | 2 tasks | 1 files |
| Phase 05.1 P02 | 6min | 2 tasks | 3 files |
| Phase 05.1 P03 | 30min | 3 tasks | 63 files |
| Phase 05.1 P04 | 9 | 3 tasks | 11 files |
| Phase 05.1 P08 | 22 | 3 tasks | 32 files |
| Phase 05.1 P05 | 11 | 3 tasks | 5 files |
| Phase 05.1 P06 | 16 | 3 tasks | 23 files |
| Phase 05.1 P07 | 129 | 3 tasks | 49 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: 12-phase structure adopted — verification net first, then boundary, kernel, verbatim resource/edit moves, adapter skeleton, shell, capabilities least-coupled-first (table→code→asset→map), preview/cutover, then extension freeze + parity gate.
- [Roadmap]: `editor-core` package uses `lib/` (never `src/`) per `resolvePlugin.js` and `tsconfig.lib.base.json`; subpath exports (`.`, `./code`, `./table`, `./map`, `./asset`, `./shell`, `./react`) created up front.
- [Roadmap]: Per-instance `EditorCore` via `createEditorCore(config)` replaces the six module singletons; registration returns diagnostics+rollback, construction fails loudly on unresolved required registration.
- [Process, 2026-09-22, **supersedes the 2026-09-21 per-phase rule**]: **One branch for the whole milestone — `editor/core-extract`.** This is not a large project; per-phase branches added overhead without benefit. `git.branching_strategy` stays `none`, so GSD never auto-creates or auto-switches branches (and no `milestone` template is set — a literal one would also trip the W015 config-validation warning and would silently fork from `origin/main`, making "is the previous phase merged?" an implicit precondition). Phase 2 keeps its existing `editor/boundary` branch unchanged and is merged to `main` manually. From **Phase 3 onward**, all phases 3–12 land on `editor/core-extract`, created once from a `main` that already contains the merged Phase 2 work. Precondition before starting Phase 3: confirm the Phase 2 PR has landed on `main`.

- [Phase 3 complete, 2026-09-23]: The engine-agnostic kernel landed add-only (no `@motajs/editor` change, D-13). `packages/libs/editor-core/lib/kernel/` (core.ts / registry.ts / diagnostics.ts / errors.ts) + `lib/ports/` (EngineAdapter / FsPort / HostPort / PreviewAdapter) + 6 kernel tests (core suite 7 files / 34 tests). Two new machine gates enforce D-15/PORT-02 (no `fetch`/`window`/`document`/`navigator`/`localStorage`/`XMLHttpRequest`/`process.env`/`import.meta.env`) and D-10+D-22 (no module-level mutable binding in core production source), both two-polarity and wired into the existing four CI jobs. Decisions D-17..D-22 are recorded in `.planning/phases/03-kernel-runtime-ports-registry-diagnostics/03-CONTEXT.md`; confirmed names in that phase's `INTERFACE-NAME.md`. Two deliberate partial satisfactions: "replace the six singletons" → Phase 11, and PORT-01 capability ports → Phases 7–10.
- [Phase 4]: 04-01: es-toolkit catalog entry pinned to the exact installed 1.44.0 (removes the ^1.43.0 version-float hazard); user-approved before the manifest edit.
- [Phase 4]: 04-01: ContentUtils moved into core as Object.freeze({...}) — the module-state gate's own sanctioned remedy; a verbatim move would red pnpm lint.
- [Phase 4]: 04-01: dependency-cruiser .dependencyCruiser.cjs gained enhancedResolveOptions {exportsFields:['exports'], conditionNames:[...]} so exports-only packages (alien-signals) resolve; the values are dependency-cruiser's own init-config template defaults. No rule weakened.
- [Phase 4]: FileHandler takes a single FileHandlerDependencies object (fs: FsPort + persistenceMonitor) assigned in the constructor body — no parameter property (erasableSyntaxOnly would raise TS1294) and the field name fs is retained so fixture pokes keep working
- [Phase 4]: FileHandlerManager is a per-instance class with no module-level instance; src/appInstances.ts is the only construction site, importing the core class as the module-local alias FileHandlerManagerClass so the exported instance keeps the legacy name FileHandlerManager
- [Phase 4]: Core owns DataHandler, JsonDataHandler, BinaryFileHandler and the resource combinators, exported from the root '.' barrel; Json2xDataHandler/ScriptDataHandler deliberately stay in the editor and inherit DataHandler through the shim
- [Phase 4]: MemoryFsPort is a flat, seven-operation FsPort test double with fewer declared parameters than FsPort (arity compatibility) to avoid new no-unused-vars warnings; it deliberately does not reproduce MemoryFileSystem's nested promises/callback shape (D-14)
- [Phase 4]: RES-06 liveness is proven by capturing the derived content callable before a mutation and re-invoking the SAME callable afterwards, for both the file layer and the DataHandler/JsonDataHandler data layer
- [Phase 4]: The UndoSystem seam captures EVERY registered system synchronously at OperationHistory.execute invocation time (capture-all), so a plain data patch still restores the viewport on undo; registration order defines reverse restore order (D-03)
- [Phase 4]: OperationHistory is de-singletonised: the Store is an instance field exposed as OperationHistory.store and the UndoSystem registry is per-instance; src/appInstances.ts is the only new OperationHistory( site (D-06/D-07/D-11)
- [Phase 4]: patchResourceOperation is typed against the narrow PatchableResource<T> (path/raw/mutate); the editor DataResource<T> satisfies it structurally with zero edits (D-04)
- [Phase 4]: ResourceRegistry (RES-02) is Map-backed, form-validating and DiagnosticBus-decoupled; it ships unwired to projectData so Phase 5 shapes it against real engine descriptors.
- [Phase 4]: editorShims.js verifies comment-stripped construction sites (exactly 3, all in src/appInstances.ts) and shim-inventory set equality; a JSDoc mention of a constructor is documentation, not a site.
- [Phase 4]: The retargeted dependency-cruiser rule matches raw editor import specifiers because dependency-cruiser does not resolve the @/ alias; its editor half is dormant-by-target until Phase 11 and editorShims.js carries the real guard.
- [Phase 5]: 05-01: ENGINE_ADAPTER_API_VERSION = '0.1.0' kept separate from EDITOR_CORE_API_VERSION (adapter contract vs core API run on different clocks).
- [Phase 5]: 05-01: EngineAdapter.resources is required (no production implementer; an adapter with no resources describes nothing).
- [Phase 5]: 05-01: Engine id validated non-empty only (not the logical-id grammar) so 05-04's mota-js engine id is definable.
- [Phase 5]: 05-01: EngineDefinitionError carries its frozen problem list via Error.cause (no unlisted member name; satisfies noUnusedLocals).
- [Phase 5]: 05-01: isValidResourceId is the single shared logical-id predicate used by both defineEngine and ResourceRegistry.register (D-09).
- [Phase 5]: Game-identifier gate (coreEngineNeutral.js) scans RAW core source including comments, case-sensitively, with a per-match 'floor' member-access exemption (preceding char '.') — a leak in a comment reds the gate
- [Phase 5]: The gate is wired as exactly one step in the existing lint job; the four-job CI contract (lint/typecheck/unit/build) is provably unaltered
- [Phase 5]: 05-03: FileResource is core's ONLY class holding an opaque IO address; it inspects no extension and joins/decodes no path, and gets the file layer via deps.fileHandlers (never a module singleton) (D-06).
- [Phase 5]: 05-03: FileResource delegates load/reload to FileHandlerManager so the existing load-lock/refetch guarantees are not duplicated; it holds no cache (T-05-10).
- [Phase 5]: 05-03: engine B proves the descriptor is source-agnostic — engineB.notes is a non-file computedResource whose load performs zero FsPort reads; file-backed descriptors use core's generic JsonDataHandler (PORT-08/PORT-05 boundary).
- [Phase 5]: 05-03: the '.' subpath content label stays kernel+resources+edit-exports (FileResource value export fits it), so coreExports.js/subpathStatus.json are deliberately untouched.
- [Phase 5]: 05-04: The ten mota paths are nine fixed descriptors on motaEngine (defineEngine({ id: 'mota-js', ... })) plus the parameterized motaFloorDescriptor(floorId) factory; the floor family is deliberately not a static entry of motaEngine.resources (D-04/D-07)
- [Phase 5]: 05-04: motaResources.ts DELIBERATELY duplicates the project-data path/var-name literals because D-01 forbids editing projectData; banner-documented in the module header and removed in Phase 11 (Research A6)
- [Phase 5]: 05-04: mota.events uses the editor-owned Json2xDataHandler with var name events_c12a15a8_c380_4b28_8144_256cba95f760; mota.editorConfig is the only lazy descriptor and uses core's generic JsonDataHandler (PORT-05 boundary)
- [Phase 5]: 05-04: motaFloorDescriptor asserts the derived mota.floor.<floorId> id with the shared isValidResourceId and throws MotaFloorIdError on a grammar violation — the registry grammar is never widened (Open Question 1 deferred to Phase 11)
- [Phase 5]: 05-04: the adapter is dead code — no entry point imports src/adapter/, projectData.ts is byte-identical, and the editor artifact is unchanged (D-01)
- [Phase 05.1]: 05.1-01: 候选 A — 操作自带逆（IEditorOperation.apply 返回 AppliedOperation.inverse），管理器只记录先后、不实现每个操作的 undo/redo；与既有 applied.inverse 同构，行为等价最易证明。
- [Phase 05.1]: 05.1-01: 新撤销契约彻底无快照 —— 不出现 capture/restore/snapshot/targets/OperationTarget/UndoSystem/Content/IResourceView（D-03/D-05）；OperationMeta.paths 成为历史条目路径的唯一来源。
- [Phase 05.1]: 05.1-01: D-18 旧名别名以同文件 export type EditorOperation<T=void> = IEditorOperation<T> 声明（避免 no-circular 自环）；本计划刻意不接公开面，lib/index.ts 零改动。
- [Phase 05.1]: 05.1-02: IResourceView<T>/ILoadableResource<T> 成员集逐字取自 combinators.ts 旧 ResourceView/LoadableResource，仅作同名新声明（不同模块、互不冲突）
- [Phase 05.1]: 05.1-02: IPatchableResource<T> 只声明 path/raw/mutate 三成员；Action/ActionType 挪落点到 lib/table/types.ts，旧声明暂留 edit/action.ts，由 05.1-05/06 收口
- [Phase 05.1]: 05.1-02: 接口定义计划刻意不接公开面——lib/index.ts 零改动，新增名此刻不经根 barrel 导出；纯声明、零实现、零搬迁
- [Phase 05.1]: RESERVED_IDS 随 isValidResourceId 迁入 editor-core/lib/ports/engine.ts 并导出，impl 的 resourceRegistry 反向 import，防线单一来源
- [Phase 05.1]: editor-core-must-not-import-editor-impl 的 to.path 同时匹配解析路径与裸说明符 @motajs/editor-impl，兼容 pnpm 严格 node_modules 的 couldNotResolve
- [Phase 05.1]: coreBoundaries.js 随 Task 2 提交（Task 2 验证命令依赖它），门禁文件的任务归属据此重排
- [Phase 05.1]: 05.1-04: UndoManager 只调操作 apply() 并把返回 inverse 记进历史；内部条目 ManagedEntry 仅在管理器内收窄，对外 Store 只暴露 OperationHistoryEntry
- [Phase 05.1]: 05.1-04: 组合失败按已成功子操作逆序 inverse 回退并标 commandStage，在 operations.ts 逐字保留（D-13）
- [Phase 05.1]: 05.1-04: [Rule 3] 删快照文件导致 impl barrel/hook/公开面测试悬空，Task 1 内做最小编译跟随，Task 2 补 core 值导出与别名
- [Phase 05.1]: 05.1-08: 编辑器按符号所属包改指 import——底层（defineEngine/isValidResourceId/端口/UndoManager）留 @motajs/editor-core，实现（资源/编辑/表格/react）改指 @motajs/editor-impl；OperationHistory 值别名仅 core 导出，appInstances 按符号拆两条 import。
- [Phase 05.1]: 05.1-08: D-19 落地——撤销数据改动不再连带恢复地图视口；operationHistory.test.ts 主用例改写为记录新行为，旧快照失败回滚用例改为「失败不入历史 + undo 空操作」。
- [Phase 05.1]: 05.1-08: [Rule 3] D-11 让两个源码直出库禁 import type，编辑器并入其源码会报 TS1484，故编辑器 tsconfig 关闭 verbatimModuleSyntax（偏差待用户复核）；另补 5 处 AppliedOperation<void> 泛型实参与 pnpm-lock 的 workspace link。
- [Phase 05.1]: 05.1-05: 字段路径与动作整对迁入 editor-impl/lib/table（互相 import 不能拆）；函数体逐字保留，cloneActionValue 不换 structuredClone
- [Phase 05.1]: 05.1-05: Action/ActionType 唯一声明落点仍是 lib/table/types.ts；action.ts 只作消费者，根 barrel 类型再导出改指 ./table/types
- [Phase 05.1]: 05.1-05: lib/edit/operations.ts 只留 CompositeOperation/compositeOperation，彻底去掉对 lib/table 的依赖（edit↔table 不再互相依赖）
- [Phase 05.1]: 05.1-05: [Rule 3] Action 类型改从 ./types 引入——Task 1 已按计划删除 action.ts 的自声明，./action 不再导出 Action，计划 key_link/验收的「从 ./action 取 Action」与 Task 1 指令互斥
- [Phase 05.1]: 05.1-05: 能力层搬迁手法——git mv 整对耦合文件 + 只改相对 import/再导出源，公开名集合逐字不变；./table 仍是空 barrel（export {}）
- [Phase 05.1]: 05.1-06: 端口与资源视图接口加 I 前缀（D-07）；旧名一律 export type { INew as Old } 纯别名（D-18），禁止普通 export 再导出类型（isolatedModules TS1205）
- [Phase 05.1]: 05.1-06: 被触碰的接口 import 写成普通 import（朝 D-11 收敛）；其余历史 import type 留给 05.1-07 统一清除
- [Phase 05.1]: 05.1-06: editor-core 端口层只改接口名，engine.ts 描述符缝不动（05.1-03 已去实现化）
- [Phase 05.1]: 05.1-06: 本计划不触碰 packages/apps/editor/**；编辑器靠两包根 barrel 的旧名别名继续编译，改动集中留给 05.1-08
- [Phase 05.1]: 05.1-07: IFileHandlerManager 的处理器返回类型用 IContentHandler<string> 而非 FileHandler，避免 interfaces.ts ↔ fileHandler.ts 环形依赖（no-circular 门禁）
- [Phase 05.1]: 05.1-07: FileHandlerDependencies 迁入 interfaces.ts 时把 persistenceMonitor 收窄为 IPersistenceMonitor；PersistenceIntent/ExecutorStatus/PersistFailure 入 types.ts、ResourceRegistryEntry 入 interfaces.ts
- [Phase 05.1]: 05.1-07: D-10 例外——无 import 的纯声明/barrel 文件保留顶部模块说明，vitest/@tsconfig/@ts-expect-error/eslint-disable 工具指令保留顶部（功能必需）
- [Phase 05.1]: 05.1-07: coreImportType 非空转下界 55（含测试 66 文件，只扫生产约 43 会红）；pnpm lint 遗留 1 条 @motajs/editor 的 prettier error（禁区，已登记 deferred/WINDOWS）

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 8 (Code) needs the Blockly split confirmed before planning; Phase 10 (Map) and Phase 11 (Preview/cutover) are flagged for phase-specific research.
- Phase 7 (Table) has an open design question: built-in primitive field types vs engine-supplied, and whether the field-editor registry is core-mechanism or fully adapter-provided.
- Phase 5 (Adapter) must resolve RES-02's unwired `ResourceRegistry` shape against real engine descriptors — the registry shipped in Phase 4 with no production consumer by design.

### Roadmap Evolution

- Phase 05.1 inserted after Phase 5: editor-core 接口与实现整改：先定义接口（阶段内第一批计划），再实现 (URGENT)
- Phase 05.2 inserted after Phase 5: editor-core/impl 代码风格整改：注释风格、类型进 types.ts、数字枚举、接口 readonly、桶文件 export *、空值约定、裸函数改类 (URGENT)

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-09-29T07:38:01.582Z
Stopped at: Completed 05.1-07-PLAN.md
Resume file: None
