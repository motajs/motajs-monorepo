# Phase 4: Resource + Edit Layers Moved - Context

**Gathered:** 2026-09-23
**Status:** Ready for planning

<domain>
## Phase Boundary

把编辑器最底层、已引擎无关的两层原样下沉进 `@motajs/editor-core`，保持现有测试全绿、四条行为不变量与五态响应式信号不变：

1. 资源层：`packages/apps/editor/src/fs/*` 与 `packages/apps/editor/src/project/resources.ts` → `packages/libs/editor-core/lib/resources/*`。
2. 编辑层：`packages/apps/editor/src/project/history/*` 的**通用机制** → `packages/libs/editor-core/lib/edit/*`。
3. `FileHandlerManager` / `PersistenceMonitor` / `OperationHistory` 由模块级单例改为 per-instance class（core 无模块实例）。
4. `@motajs/editor` 现有 import 经「逐文件 re-export shim」继续工作；`@motajs/editor` 对外行为零变化。
5. 门禁：`requireZero` 规则改指仍在 editor 的 3 个单例；core「无模块级可变绑定」由既有 D-10 门禁保证；shim 由 verifier 追踪。

**不在本阶段范围**：四大能力、外壳、preview（Phase 6–11）；`defineEngine`/`ResourceDescriptor`（Phase 5）；删除 shim 与 6 个 singleton、组合根切换（Phase 11）；插件加载器（本期不做）；任何对外功能/UI/宿主协议变更。

</domain>

<decisions>
## Implementation Decisions

### A. 迁移边界（哪些文件真的搬）
- **D-01:** `fs/Json2xDataHandler.ts` 与 `fs/ScriptDataHandler.ts` **留在 `@motajs/editor`**。core 的 `lib/resources` 只收通用 `DataHandler` 基类与 `JsonDataHandler`；不引入 `@motajs/file2x` 依赖。这两个 handler 继续继承 core 的 `DataHandler`。 — **Reversibility:** costly — 若日后决定纳入 core，需给 core 增加 `@motajs/file2x` 依赖并重写 import 与 shim。
- **D-02:** `history/viewport.ts` 与 `history/materialOperations.ts` **留 editor**；`operations.ts` 里依赖视口的 `RestoreViewportOperation` / `NavigateFloorOperation` 也留 editor。理由：`viewport.ts` 依赖 `@/stores/*`/`@/MapEditor/*`/`@/components/SchemaTable/*` 且带模块级可变注册表（`registerEditorViewportProvider`）；`materialOperations.ts` 依赖 `@/project/assets` 与 `project/autotiles`/`project/materials/...` 引擎路径。 — **Reversibility:** costly。
- **D-03:** core 的编辑层提供**「可撤销系统」注册表**（per-instance）：系统接口形如 `UndoSystem { id, capture(), restore(snapshot) }`；每个 `EditorOperation`（或历史条目）记录它涉及哪些 system id；undo/redo 时 core 按逆序逐个回调各系统的 `restore`。editor 把 viewport / material / data-resource 实现成 system 注册进去。core 完全不认识视口/素材/引擎语义，只认识 id + 回调。这是对现有「`operationHistory` 直接调 `captureEditorViewport`/`restoreEditorViewport` 并记录 before/afterViewport」的替代实现（用户明确要求：基础规则记录「每个可撤销操作由哪个上层系统完成」，撤销时逐步回调上层系统的 `restore`）。 — **Reversibility:** costly — core 编辑层对外的核心接缝，Phase 12 冻结。
- **D-04:** 字段动作原语**进 core**：`Action`、`applyActionsWithInverse` 与基于窄接口 `PatchableResource<T>`（`path`/`raw()`/`mutate()`）重建的 `patchResourceOperation` 搬入 `lib/edit`；editor 的 `DataResource` 结构上满足 `PatchableResource`（只改类型签名，不改实现）。`commandOperations.ts`（`executePatchCommand`/`executeCompositeCommand`）**留 editor**（依赖 editor 的 `CommandResult`）。 — **Reversibility:** costly — 接口名与签名进入 core 公开面。
- **D-05:** core **只消费注入的 `FsPort`**，不持有任何 fs 实现、不提供默认值（符合 PORT-02）。被搬代码调用点由 `fs.promises.readFile` 改为 `fs.readFile`（扁平 API）；editor 侧直接把现有 `fs.promises`（`FsPromiseApi`）作为 `FsPort` 传入（结构兼容，多余的 `writeMultiFiles` 无妨）。外部可有多种实现：浏览器 FileSystemHandler、HTTP、Node（Electron 桌面端）。 — **Reversibility:** costly — 接口是 core 与宿主的边界契约。

### B. per-instance 化与 editor 连续可用
- **D-06:** **三个单例全去单例**：`FileHandlerManager` / `PersistenceMonitor` / `OperationHistory` 在 core 只导出 class + 工厂，模块末尾不再 `new`。理由：D-10 门禁禁止 core 生产源码出现模块级可变绑定；且「两个实例互不干扰」的里程碑目标要求如此。
- **D-07:** `@motajs/editor` 侧保留一个**临时应用实例模块**（composition-root-lite）：`new` 一份实例并以旧名（`FileHandlerManager`/`persistenceMonitor`/`operationHistory`）导出，供现有约 40 处 import 与测试夹具使用。Phase 11 组合根接管后删除该模块。`FileHandler` 改为**构造注入** `PersistenceMonitor`（由 `FileHandlerManager` 在创建 `FileHandler` 时传递），消除 `fs/FileHandler.ts:8` 对 `persistenceMonitor` 单例的直接 import。 — **Reversibility:** costly — 临时模块与注入链是过渡结构，Phase 11 才收口。
- **D-08:** Phase 2 的 `requireZero` 门禁（`.dependencyCruiser.cjs:53-66`）**改指仍在 editor 的 3 个单例**（`projectData`/`projectModel`/`editorConfigService`，Phase 5/11 处理），并在规则注释记录「`FileHandlerManager`/`persistenceMonitor`/`operationHistory` 已在 Phase 4 去单例」。core「无模块级实例」由既有 D-10 门禁保证。理由：若不改，规则会因路径漂移（`lib/resources`/`lib/edit`）而静默失效。

### C. shim / subpath / 依赖形态
- **D-09:** `lib/resources/*` 与 `lib/edit/*` 作为**包内目录**，公开面由根入口 `.`（`lib/index.ts`）汇总导出；**不新增对外 subpath**，对外保持 Phase 2 的 7 个（与 `EXT-05`/Phase 12 冻结面一致）。能力层与 shell 通过包内相对路径引用它们（符合 D-06 单向 DAG）。
- **D-10:** **逐文件 shim**：旧路径（`src/fs/types.ts`、`src/fs/FileHandler.ts`、`src/fs/FileHandlerManager.ts`、`src/fs/PersistenceMonitor.ts`、`src/project/resources.ts`、`src/project/history/operations.ts`、`src/project/history/operationHistory.ts` 等）各保留一个转发文件，`export * from` core 对应模块；涉及单例的三个 shim 同时从「临时应用实例模块」导出旧实例名。editor 内相对导入与 `@/...` 深层导入全部不改。追踪：shim 文件统一加 `// SHIM(phase4)` 标记，并在 `scripts/verify/` 新增 verifier 列出全部 shim，供 Phase 11 删除。 — **Reversibility:** costly — shim 是 Phase 11 删除清单的唯一来源。
- **D-11:** `OperationHistory` 的 Store **挂到实例**（替代 `operationHistory.ts:34` 的模块级 `historyStore`，以过 D-10 门禁）；`useOperationHistory`（React hook）进 **`./react`** 入口，`@tanstack/react-store` 依赖只出现在 `./react`；`@tanstack/store` 与 `OperationHistory` 在根 `.`。
- **D-12:** `BinaryFileHandler` 与 `JsonDataHandler` **按 RES-01 字面搬入** core。用户澄清：编辑器本质是可视化的（浏览器/Electron），core 无需做成 Node-only，浏览器 API 可接受；`FsPort` 的多种实现是为 Electron 换 Node 文件系统。`BinaryFileHandler` 的 Fs 注入同样改为 `FsPort`（无默认值）。
- 新增依赖（按仓内惯例走 `pnpm-workspace.yaml` catalog 固定版本）：`ts-pattern`（`ContentUtils`）、`@tanstack/store`（`OperationHistory`）、`@tanstack/react-store`（`./react` 的 `useOperationHistory`）；`waitUntil`（`@/utils/base/signal`）归入 core 的通用信号工具。

### D. 测试迁移与 core 覆盖率
- **D-13:** **纯内存测试搬 core**（`errors`/`FileHandler`/`FileHandlerManager`/`PersistExecutor`/`PersistenceMonitor`/两个 `*.invariants`/`operationHistory` 的纯内存部分/`resources`），只改 import 路径、断言不动（D-10/D-12）；依赖 `@test/utils` 与 mota-js submodule 的测试（`persistNoRollback.invariants`、`operationHistory.test`、`operationHistory.invariants` 的 reactivity describe）**留 editor** 经 shim 跑。
- **D-14:** core **自建最小内存 FsPort 测试替身**（含写延迟/写错误/按路径写错误/写计数）；editor 保留现有 `MemoryFileSystem`（服务 `Fs`/`FsPromiseApi`）。两份各服务不同接口形状（core `FsPort` 扁平 vs editor 嵌套），互不耦合。

### 待解决开放点（planner/researcher）
- **RES-02 `ResourceRegistry`**：当前源码中**不存在**名为 `ResourceRegistry` 的东西；RES-02 要求「支持通用逻辑 id 注册」。本次讨论的四个 Area **未覆盖**这一条。planner/researcher 须先判定它落在 Phase 4 还是与 Phase 5 的 `ResourceDescriptor` 一并处理，并给出形状（倾向：`lib/resources` 里一个最小的「逻辑 id → `ResourceView`」注册表服务，引擎描述符 Phase 5 注入）。此点须在计划前解决，否则 RES-02 无法满足。

### the agent's Discretion
- 临时应用实例模块的文件名与导出名、core 内存 FsPort 测试替身名、`UndoSystem`/`PatchableResource` 等的最终命名 —— 须先入 `.planning/phases/04-resource-edit-layers-moved/INTERFACE-NAME.md` 并经用户确认（Project Rules）。
- shim 标记的具体文本与 verifier 的输出格式。
- `waitUntil` 的具体落点（core 内哪个文件）。
- `lib/resources` / `lib/edit` 内部的文件划分与 barrel 结构。
- catalog 版本的具体取值。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 项目与阶段上下文
- `.planning/PROJECT.md` — 纯重构/对外行为不变约束；core 引擎无关、不读文件、数据经钩子注入；方向更新（editor-type 后续）
- `.planning/REQUIREMENTS.md` — RES-01..RES-06（本阶段覆盖，含 RES-02 开放点）；PORT-01/PORT-02（Phase 3 已完成，本阶段消费 `FsPort`）；PORT-05（core 仅保留 `JsonDataHandler`）
- `.planning/ROADMAP.md` §Phase 4 — 目标与 5 条成功标准；§Phase 5/11 用于理解适配器与组合根的后续消费者
- `.planning/STATE.md` — 单一分支规则（`editor/core-extract`）、既有决策
- `AGENTS.md` §Project Rules — 每次 plan 执行前必须简报并等待批准；重要命名须先经 `INTERFACE-NAME.md`；描述类方法用 `类名.方法名`；**提问前必须先详细描述问题**；**网络请求走 `http://127.0.0.1:7890` 代理**

### 前序阶段决策（约束本阶段）
- `.planning/phases/03-kernel-runtime-ports-registry-diagnostics/03-CONTEXT.md` — D-13（只增不删、迁移在 Phase 4/5）、D-14（`FsPort` 按 Phase 4 真实需求定义）、D-10（core 无模块级可变绑定门禁）、D-16（目录划分）
- `.planning/phases/02-package-boundary-build-scaffolding/02-CONTEXT.md` — D-06（单向 DAG、跨 subpath 相对导入）、D-09（PandaCSS 单点 include）、D-13/D-14（门禁塞进现有 4 job）、D-16/D-17（`requireZero` 语义与空集启用）、D-19（catalog 缺口）
- `.planning/phases/01-baseline-verification-net/01-CONTEXT.md` — D-09..D-12（特性化测试 co-located、随模块迁移只改 import、变红即回归）
- `.planning/phases/03-kernel-runtime-ports-registry-diagnostics/INTERFACE-NAME.md` — Phase 3 已确认命名（新命名须沿用其风格并新建 Phase 4 同名文件）

### 受影响的现有文件
- `packages/apps/editor/src/fs/*`（14 源文件 + 8 测试）—— 资源层搬迁源
- `packages/apps/editor/src/project/resources.ts`（`computedResource`/`aggregateResource`/`optional`）—— 搬迁源
- `packages/apps/editor/src/project/history/*`（7 源文件 + 2 测试）—— 编辑层搬迁源
- `packages/libs/editor-core/package.json` / `tsconfig.json` / `vitest.config.ts` / `lib/index.ts` —— 目标包；本阶段新增 `lib/resources/*`、`lib/edit/*` 并从根 `.` 汇总导出；新增 catalog 依赖
- `packages/libs/editor-core/lib/ports/fs.ts` —— `FsPort` 契约（被搬代码消费）
- `packages/libs/editor-core/lib/kernel/core.ts` —— 组合根（`requireZero` 的允许来源）
- `.dependencyCruiser.cjs:53-66` —— `requireZero` 规则（本阶段改指剩余 3 个单例）
- `scripts/verify/coreBoundaries.js`、`lint-severities.js` —— 门禁范式（新 shim verifier 沿用同风格）
- `packages/apps/editor/src/services/fs/fs.ts:23-44` —— `FsPromiseApi`/`Fs` 定义（`fs.promises` 即 `FsPort` 的形状来源）
- `packages/apps/editor/test/utils/MemoryFileSystem.ts`、`sampleProject.ts`、`testHelpers.ts` —— editor 测试夹具（`sampleProject.ts:50` 伸入 `FileHandlerManager.handlers`）
- `packages/apps/editor/src/project/data/DataResource.ts:17-29` —— `DataResource`（须结构满足 `PatchableResource`）
- `packages/apps/editor/src/utils/action.ts:11-14,117` —— `Action` / `applyActionsWithInverse`
- `.github/workflows/ci.yml` + `scripts/verify/ci-workflow.js` —— 四 job 契约（新门禁只能塞进现有 job）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/libs/editor-core/lib/ports/fs.ts` 的 `FsPort`：7 个扁平操作，与 `fs.promises`（`FsPromiseApi` 去掉 `writeMultiFiles`）结构兼容——被搬代码直接消费。
- `packages/libs/editor-core/`（Phase 2/3 已建）：`lib/` 布局、7 subpath、`vitest.config.ts`（resolvePlugin + react-compiler + jsdom + `@styled-system`）、kernel/ports——本阶段直接在其中加 `lib/resources/*`、`lib/edit/*`。
- `scripts/verify/*.js`（Phase 1/2）：ESM + 中文头注 + `failures[]` + `process.exit(1)` + 两极性证明的 verifier 范式——shim verifier 与 `requireZero` 改动沿用。
- `packages/apps/editor/test/utils/MemoryFileSystem.ts`：故障注入（`setWriteDelay`/`setWriteError`/`setWriteErrorForPath`/`getWriteCount`）——core 内存 FsPort 替身的参照。
- `packages/apps/editor/src/project/history/operations.ts` 的 `OperationTarget`（capture/restore）——`UndoSystem` 与委托式 restore 的现有先例。

### Established Patterns
- **共享库以源码 TS 直出**（`exports` 指向 `lib/index.ts`，无 build）；`tsc -b` 只做类型检查。
- **core 相对导入**（不用 `@/`，D-06）；`lib/` 内跨目录用相对路径。
- **门禁必须能失败**（Phase 2 教训）：新 shim verifier 与 `requireZero` 改动须两极性。
- **四 job CI 契约是硬约束**：`lint`/`typecheck`/`unit`/`build`，新检查只能加步骤。
- **命名集中于 `.planning/phases/<phase>/INTERFACE-NAME.md`**（每 Plan 一节），落盘前须经用户确认。
- **特性化测试只改 import、断言不动；变红即回归**（D-10/D-12）。

### Integration Points
- `packages/libs/editor-core/lib/index.ts`（根 `.` 公开面汇总出口）
- `packages/libs/editor-core/lib/resources/*`、`lib/edit/*`（本阶段新建）
- `packages/libs/editor-core/lib/react/index.ts`（`useOperationHistory` 落点）
- `packages/apps/editor/src/fs/*`、`src/project/resources.ts`、`src/project/history/*`（shim + 临时应用实例模块）
- `.dependencyCruiser.cjs`（`requireZero` 改指）
- `scripts/verify/`（新增 shim verifier）
- `packages/libs/editor-core/package.json` + `pnpm-workspace.yaml`（新增 catalog 依赖）
- 以后（非本阶段）的接入点：Phase 5 `defineEngine`/`ResourceDescriptor`、Phase 11 组合根切换与删除 shim/singleton

</code_context>

<specifics>
## Specific Ideas

- **core 不持有 fs 实现**（用户明确）：只消费注入的 `FsPort`；外部可有浏览器 FileSystemHandler / HTTP / Node（Electron）多种实现。
- **编辑器是可视化的**（用户明确）：core 无需做成 Node-only，浏览器 API 可接受；`BinaryFileHandler` 产 `HTMLImageElement` 无妨。
- **委托式撤销**（用户明确）：基础规则记录「每个可撤销操作由哪个上层系统完成」，撤销时逐步回调上层系统的 `restore`——不要让 core 认识视口/素材/引擎。
- **「原样搬」要务实**：字面逐字节搬迁不可能（`@/` 别名、跨层依赖、引擎耦合文件）；边界以「core 引擎无关 + 测试全绿 + 对外行为不变」为准。
- **对外行为零变化**：Phase 1/2/3 的基线与门禁必须持续为绿；`@motajs/editor` 不改功能/UI/宿主协议。
- **shim 必须可追踪**：统一标记 + verifier 输出，是 Phase 11 删除清单的唯一来源。
- **`requireZero` 不能静默失效**：改指剩余 3 个单例并注释记录，避免「绿但没在守」。

</specifics>

<deferred>
## Deferred Ideas

- **`Json2xDataHandler`/`ScriptDataHandler` 的归属** —— 留 editor（D-01）；PORT-05「core 仅保留 JsonDataHandler」因此天然满足。若后续要把它们纳入 core，需重新评估 `@motajs/file2x` 依赖。
- **视口抽象搬进 core** —— 本阶段留 editor（D-02/D-03）；Phase 10（地图能力）可能需要把 `EditorViewport` 抽象与 provider 注册表 per-instance 化后搬入 core。
- **删除 shim、临时应用实例模块与 6 个 singleton；组合根切换** —— Phase 11。
- **`ResourceDescriptor` / `defineEngine` / 逻辑 id 的引擎侧描述** —— Phase 5（RES-02 的 `ResourceRegistry` 落点见上方开放点）。
- **图片/二进制解码抽象（image codec port）** —— 本阶段按 RES-01 字面搬入 `BinaryFileHandler`；若 Phase 9（Asset 能力）需要非浏览器解码，再抽象成可注入 port。
- **全仓 lint/cruise 债务清理** —— Phase 1 `deferred-items.md` 已记录，非本阶段。

None of the above is a new capability for this phase; all are explicitly out of scope or belong to later phases.

</deferred>

---

*Phase: 4-Resource + Edit Layers Moved*
*Context gathered: 2026-09-23*
