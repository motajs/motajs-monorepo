---
gsd_state_version: "1.0"
current_phase: "05.2"
current_phase_name: editor-core-impl
current_plan: 9
status: executing
stopped_at: Completed 05.2-12-PLAN.md
last_updated: "2026-10-01T11:25:30.572Z"
last_activity: 2026-09-28
last_activity_desc: Phase 05.1 plan 01 complete (editor-core undo contract types)
state_head: 198a9971d89402f214cef8861be4e6f5688818c5
progress:
  total_phases: 14
  completed_phases: 0
  total_plans: 48
  completed_plans: 45
  percent: 0
---

Total Phases: 6

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-24)

**Core value:** Decouple the editor kernel from engine details through an engine-agnostic `editor-core` so old and new engines share one editing layer and third parties can customise freely.
**Current focus:** Phase 05.1 — editor-core 接口与实现整改（插入阶段）

## Current Position

Phase: 05.2 (editor-core-impl) — READY TO EXECUTE
Current Plan: 9
Total Plans in Phase: 9
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
| Phase 05.2 P01 | 13 | 3 tasks | 16 files |
| Phase 05.2 P02 | 15min | 3 tasks | 17 files |
| Phase 05.2 P03 | 30 | 3 tasks | 37 files |
| Phase 05.2 P04 | 45min | 3 tasks | 18 files |
| Phase 05.2 P05 | 35min | 3 tasks | 16 files |
| Phase 05.2 P06 | 19 | 3 tasks | 27 files |
| Phase 05.2 P07 | 18 | 3 tasks | 17 files |
| Phase 05.2 P08 | 6min | 3 tasks | 10 files |
| Phase 05.2 P09 | 15 | 2 tasks | 2 files |
| Phase 05.2 P10 | 16min | 3 tasks | 3 files |
| Phase 05.2 P11 | 10 | 3 tasks | 4 files |
| Phase 05.2 P12 | 15 | 3 tasks | 16 files |

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
- [Phase 05.2]: 05.2-01: 底层类型集中到 kernel/types.ts + 新建 ports/types.ts；DiagnosticCode 按计划留在 diagnostics.ts（与机器码值表同源，迁走会 types↔value 成环），是明文例外
- [Phase 05.2]: 05.2-01: DiagnosticSeverity 由字符串联合改为数字枚举 Error=0/Warning=1/Info=2；动手前 grep 证明无 severity 真值判断，0 为假值不影响行为
- [Phase 05.2]: 05.2-01: 编辑器唯一改动为 tsconfig.app.json 的 erasableSyntaxOnly true->false（D-18）；OperationMeta.paths 一并补 readonly 以满足 D-10
- [Phase 05.2]: 05.2-02: 资源层类型合并到 resources/types.ts 并删除 interfaces.ts（D-07）；types.ts 只 import 底层 IFsPort，不 import 实现文件
- [Phase 05.2]: 05.2-02: Task 1 一次性迁移全部生产 import（删除 interfaces.ts 与加载根 barrel 的公开面测试使然），Task 2 转测试侧 import + readonly 复核 + 全量门禁
- [Phase 05.2]: 05.2-02: PersistenceIntent.{kind,execute}、PersistFailure.{path,error} 补 readonly；Content.status 等四处状态名保留字符串联合例外
- [Phase 05.2]: 05.2-02: interface 头顶 jsDoc 改单行 //、type 别名保留一行 jsDoc（D-02）；// 注释按 AGENTS.md 不带句尾句号
- [Phase 05.2]: 05.2-03: ActionType 与 PreloadStrategy 均改数字枚举（Change=0/Add=1/Delete=2、Eager=0/Lazy=1/OnDemand=2），成员名沿用 INTERFACE-NAME.md Plan 03 已确认名
- [Phase 05.2]: 05.2-03: 公开面值/类型分离——ActionType/PreloadStrategy 从 export type 组移到 export { X } 值导出，Action 仍 export type
- [Phase 05.2]: 05.2-03: 编辑器机械跟随以 pnpm --filter @motajs/editor typecheck 的 TS2322 为准逐点替换；UI EditMode/菜单 key/prefabCommands 独立 kind 联合未动
- [Phase 05.2]: 05.2-03: utils/action.ts shim 的 ActionType 由类型转发改为值转发（export { ActionType }），Action 仍类型转发，仍是只转发 shim
- [Phase 05.2]: 05.2-04: 有状态工厂改类（EditorCoreKernel/DiagnosticBusImpl），窄接口回调在构造内 bind(this) 以免函数内定义函数；纯函数 defineEngine/resolvePreloadOrder/isValidResourceId/visitDependency 保留模块级裸函数
- [Phase 05.2]: 05.2-04: ContentUtils 由 Object.freeze 方法对象改静态方法类，ContentUtils.map 等调用点（impl 与经 shim 的编辑器）一字不改；defineEngine 内嵌 visit 挪为模块级 visitDependency
- [Phase 05.2]: 05.2-04: D-17 落地——FileHandlerManager.size() 改方法、FileHandler.delete() 去 _force、FileHandlerManager.delete() 去死参数 force；删除容错 try/catch + isFileNotFoundError 原样保留
- [Phase 05.2]: 05.2-05: 文件/模块说明改写成 import 之后的连续 // 块（内容保真）；类头/接口头 /** */ 依 05.2-01/02 既定做法改为 //（满足「类/接口无 jsDoc」）；implements 的方法（UndoManager.execute/undo/redo/clear）不重复加 jsDoc（dev.md 第 75 条）
- [Phase 05.2]: 05.2-05: 导出函数 isValidResourceId/defineEngine/resolvePreloadOrder 补 @param/@returns；UndoManager.store 补显式类型 Store<OperationHistoryState> 与成员空行；空值约定与成员顺序（成员先于方法）复核无越界改动
- [Phase 05.2]: 05.2-05: [Rule 3] Task 1 顺带 prettier 修正 diagnostics.test.ts:32 既有 lint 阻断（属本计划文件），使 pnpm lint 由 1 error 转 0 error
- [Phase 05.2]: 05.2-06: 资源层文件/模块说明改写为 import 之后的 // 块；类/接口去 jsDoc、type 保留 jsDoc；与 05.2-05 的 editor-core 形态一致
- [Phase 05.2]: 05.2-06: FileHandlerManager 公共方法按计划 Task 1 显式要求补换行风格 jsDoc + @param；FileHandler 的 implements 方法不重复注释（dev.md 第 75 条）
- [Phase 05.2]: 05.2-06: 资源层 111 个 it/test 逐条补 // 说明，英文标题说明翻译为中文；FileHandler.delete 的 try/catch 与两处 eslint-disable 保留，零逻辑改动（143 tests 不变）
- [Phase 05.2]: 测试 fixture 辅助函数与模块说明一律用单行 //（沿用 05.2-05 测试半边形态），类/接口说明也用 //，名字与实现不变
- [Phase 05.2]: CoreProbe.tsx 内联 props 抽成具名 interface CoreProbeProps（用户已确认）且不导出；css 模板调用与 useState 逐字未改
- [Phase 05.2]: react/index.ts 的 export { CoreProbe } 本计划不动，桶文件 export * 属 05.2-08
- [Phase 05.2]: 桶文件表格段分两步：Task 1 暂留逐名再导出，Task 2 才换 export * from './table'，避免任务边界处包根丢掉表格名
- [Phase 05.2]: D-16 旧名别名以显式 export type { X as Y } / export { X as Y } 保留，是桶文件不逐个列导出名的唯一例外
- [Phase 05.2]: implExports.js 的 ./table 期望值与 subpathStatus.json 的 ./table content 同提交改为 table-exports（D-15）
- [Phase 05.2]: 05.2-09: 把未入库的 GSD 运行时目录 .gsd/ 加入 .prettierignore（Rule 3 最小修复，与已排除的 .planning/ 同类），不改源码、不降级门禁，使 pnpm format:check 全绿
- [Phase 05.2]: 05.2-09: 编辑器越界判据以 diff 内容为准——29 文件全部是 ActionType/PreloadStrategy 枚举机械跟随 + utils/action.ts 值转发 shim + tsconfig.app.json erasableSyntaxOnly（D-18），零回退，编辑器 typecheck 仍绿
- [Phase 05.2]: 05.2-09: 残留「首行非 import」非 0 的 37 处逐条归入既有 D-10 例外（工具指令 / 无 import 纯声明文件 / barrel），不新增改动
- [Phase 05.2]: 05.2-10: 两个 types.ts 删文件头/接口自身注释、方法多行 jsDoc+@param、方法间空行、成员单行 jsDoc；只改注释与空行
- [Phase 05.2]: 05.2-10: DiagnosticSeverity/PreloadStrategy 改 export const enum，取值钉死 0/1/2；枚举本身无注释、成员单行 jsDoc
- [Phase 05.2]: 05.2-10: [Rule 3] const enum 使 coreApiSurface.test.ts:163 的 typeof PreloadStrategy 触发 TS2475，改为成员取值断言（计划 <files> 外的必要编译跟随）
- [Phase 05.2]: 05.2-10: [Rule 2] EditorCore.diagnostics 成员上移到方法前，满足 D-04 成员先于方法；形状不变
- [Phase 05.2]: 05.2-11: Content.status/ExecutorStatus.status 保留字符串字面量（编辑器大量字符串比较，D-10 例外）；Content<T>/ExecutorStatus 只做内联对象→具名 interface 的机械拆分
- [Phase 05.2]: 05.2-11: 接口方法多行 jsDoc 逐参数 @param，返回值按需 @returns（对齐 editor-core ports/types.ts）；成员单行 jsDoc；接口内相邻方法间空行
- [Phase 05.2]: 05.2-11: ActionType 改 export const enum 取值钉死 0/1/2；[Rule 3] const enum 令 implApiSurface.test.ts:132 的 typeof ActionType 触发 TS2475，改为成员取值断言（计划文件外的必要编译跟随）
- [Phase 05.2]: 05.2-12: 只删/搬注释与改分区标记，标识符/类型/逻辑/导出面一字未动；模块级常量与裸函数 jsDoc 按计划保留
- [Phase 05.2]: 05.2-12: [Rule 3] //#region 触发 @stylistic/spaced-comment，eslint.config.js 增加 #region/#endregion markers 白名单（severity 仍 error）

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

Last session: 2026-10-01T11:25:15.507Z
Stopped at: Completed 05.2-12-PLAN.md
Resume file: None
