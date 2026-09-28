# Phase 5: Engine Adapter Skeleton & Resource Descriptors - Context

**Gathered:** 2026-09-28
**Status:** Ready for planning

<domain>
## Phase Boundary

把「引擎路径 / 格式 / 词汇 / 迁移」这类引擎知识从 core 隔离出去，建立一个**引擎无关的适配器契约**，并用一个非 mota 的 fake「engine B」证明该契约不是 mota 专属。

用户在本阶段讨论中**重新确立了根本方向**，因此边界相比原始 ROADMAP 措辞被显著收窄并修正：

1. **纯增量**：本阶段只在 core 新增「通用资源描述符 + `defineEngine` + 扩展后的 `EngineAdapter` + 一个带 path 的文件支撑资源类」；`@motajs/editor` 的 `projectData` **一行不改**，编辑器行为链路完全不动；接线（把 `projectData` / 组合根切到新契约）留到 **Phase 11**。
2. **core 不假定内容来源**（用户原话：「你就不能假定内容来自文件」）：通用 `ResourceDescriptor` **不含 `path`**。core 至多内置**一个带 path 的「文件支撑资源类」**（path/IO 只存在于该类内部，可选使用）。参数化（如楼层路径 `project/floors/{id}.js`）完全由上层/适配器解析成具体内容后再交给 core，core 永不见模板/参数。
3. **mota 适配器**落在 `packages/apps/editor/src/adapter/`（新建专用目录），产出 `motaEngine = defineEngine({...})`，描述那 10 条资源。本阶段它是**暂时没有消费者的代码**（Phase 11 才被组合根 import）。
4. **`LabelOverrides` / `MigrationHook` 本阶段不定义**（下修/顺延）：core 现在没有 UI、没有加载/迁移执行点，现在定义只会是空接口（违反 Phase 3 D-14「不猜、不写空接口」）。`PORT-06` 由「游戏标识符门禁」在 core 生产源码上落地；`PORT-07` 由「迁移留在适配器」满足。
5. **fake engine B** 作 core 测试夹具，端到端驱动 `defineEngine` → 契约校验 → `ResourceRegistry` → 按逻辑 id 取用 → preload 顺序。
6. **游戏标识符门禁**：`scripts/verify/` 独立 verifier，作用域 core 生产源码（排除 `__tests__`），接入现有 CI job。

**不在本阶段范围**：四大能力、外壳、preview（Phase 6–11）；`projectData` 重写与组合根切换（Phase 11）；插件加载器（本期不做）；任何对外功能 / UI / 宿主协议变更；`LabelOverrides` / `MigrationHook` 的落地。

**⚠ 与已锁定文档的分歧（本阶段不改文档，待用户确认后修订）**：本阶段决策与 `ROADMAP.md §Phase 5` 及 `REQUIREMENTS.md` 的 `PORT-04`（含「opaque path key」）、`PORT-06`、`PORT-07` 原文冲突。ROADMAP.md / REQUIREMENTS.md **本阶段不修改**；修订留待用户决定（见 D-14 与 `<deferred>`）。

</domain>

<decisions>
## Implementation Decisions

### A. 阶段边界与适配器落点
- **D-01:** **纯增量**——本阶段只定义 core 侧契约 + 适配器描述符 + fake engine B + 门禁；`projectData` 一行不改，编辑器数据加载链路完全不动。理由：延续 Phase 4 的「未接线」节奏，把接线/切换留给 Phase 11 组合根；回归面最小。 — **Reversibility:** costly — 若中途改为顺带接线，会改动编辑器数据加载链路与 Phase 4 已交付的资源层契约，并影响 Phase 11 的切换计划。
- **D-02:** mota 适配器（`defineEngine` 的落点）放 **`packages/apps/editor/src/adapter/`**（新建专用目录），集中存放 mota 引擎描述符与后续的 model/capability 钩子；与 PROJECT.md「编辑器自身承担 mota-js 引擎适配」一致，Phase 11 直接从此处 import。

### B. core 侧契约（通用描述符 / `defineEngine` / `EngineAdapter`）
- **D-03:** **`defineEngine` 在 core**；`EngineAdapter` 接口随之**显式演进**（加入它承载的资源描述等成员）。符合研究稿「core 定义形状、适配器遵从」，也便于 core 侧集中校验。 — **Reversibility:** costly — 给已发布的 `EngineAdapter` 加成员对实现者是破坏性变更（Phase 3 D-14 已预警），Phase 12 冻结后更难收回。
- **D-04:** **通用 `ResourceDescriptor` 不含 `path`**（也不含 `format` / `handler` 实例）。用户原则：一旦含 path，就等于 core 假定了「内容来自文件」。形状定为 `{ id, create(deps) => ResourceView<T> | Promise<ResourceView<T>>, preload?, preloadDependsOn? }`。 — **Reversibility:** costly — 这是 core 对外公开形状，Phase 12 冻结后改动影响所有适配器。
- **D-05:** 描述符里的 handler 通过 **`create` 工厂函数**表达（保留惰性构造语义，与现有 `projectData` 惰性 `new` 一致），而非预构造实例。
- **D-06:** core **内置一个带 path 的「文件支撑资源类」**（置于 `lib/resources/`，绑定 id + 不透明 IO 地址 + handler，内部用 `FileHandlerManager` + 注入的 `FsPort`）；path/IO 只存在于该类内部，不污染通用 `ResourceDescriptor`。适配器在 `create` 里使用它构造 mota 的资源。**最终类名须经 `INTERFACE-NAME.md` 确认。** — **Reversibility:** costly — 类名/构造签名是适配器直接依赖的面。
- **D-07:** 参数化路径（楼层）**由上层/适配器解析**成具体内容后再交给 core；core 永远看不到模板、参数或路径拼接。

### C. 标签与迁移（下修/顺延）
- **D-08:** core 本阶段**不定义** `LabelOverrides` 与 `MigrationHook`。理由：core 当前无 UI、无加载/迁移执行点，定义即为无消费者的空接口。
- **D-09:** `PORT-06`（游戏词汇移出 core）**由游戏标识符门禁落地**（见 D-12/D-13）；`LabelOverrides` 等 **Phase 6+ 有 UI 消费者时**再按真实需求定义。
- **D-10:** `PORT-07`（引擎格式迁移移出 core）**由「迁移留在适配器」满足**：现有 `airwallMigration.ts` 本就在 editor 侧，本阶段不动、不迁入 core。

### D. 证明与门禁
- **D-11:** **fake engine B = core 测试夹具**（`lib/__tests__/` 下），与 core 测试同跑；用非 mota 的逻辑 id / 描述符 / 工厂 / preload 图端到端跑通契约，证明「core 契约不是 mota 专属」。
- **D-12:** 游戏标识符门禁用 **`scripts/verify/` 独立 verifier**（沿用仓内范式：两极性证明 + `failures[]` + `process.exit(1)`），作用域 **core 生产源码 `lib/**`，排除 `__tests__`**，接入**现有四个 CI job**（不新增/改名 job）。
- **D-13:** 标识符**全清单 + 上下文匹配**：`tower / floor / loc / autopass / autotile / idnum / airwall / commonEvent / prefab / mota`；`floor` 精确排除 `Math.floor`、`.floor()` 等方法调用，两极性用例必须包含「`Math.floor` 不误报」。

### E. 文档影响（待用户确认，本阶段不改文档）
- **D-14:** 本阶段决策要求修订 `ROADMAP.md`/`REQUIREMENTS.md`：`PORT-04` 去掉「opaque path key」措辞（path 降为文件支撑实现内部的 IO 地址）；`PORT-06`/`PORT-07` 下修为「门禁保证 + 迁移留适配器」，`LabelOverrides`/`MigrationHook` 顺延。**ROADMAP.md / REQUIREMENTS.md 本阶段不修改**。

### the agent's Discretion
以下均须先写入 `.planning/phases/05-engine-adapter-skeleton-resource-descriptors/INTERFACE-NAME.md`（每 Plan 一节，说明用途）并经用户确认（Project Rules）：
- `ResourceDescriptor` 各字段最终命名、`create` 的参数 `deps` 的具体形状。
- core 内置「文件支撑资源类」的类名与构造签名（见 D-06）。
- fake engine B 的文件名与导出符号名、其非 mota 资源集合的具体构成。
- verifier 文件名、排除规则实现细节与输出格式。
- `preload` 的取值集合（如 `eager` / `lazy` / `on-demand`）与默认值。
- 若新增依赖，其在 `pnpm-workspace.yaml` catalog 中的版本取值。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 项目与阶段上下文
- `.planning/PROJECT.md` — 纯重构/对外行为不变约束；core 引擎无关、不读文件、数据经注册钩子注入；Direction（editor-type 后续）
- `.planning/REQUIREMENTS.md` — `PORT-03`..`PORT-08`（本阶段覆盖，其中 PORT-04/06/07 需按下修后的方向理解）；`PORT-01`/`PORT-02`（Phase 3 已完成，本阶段消费）
- `.planning/ROADMAP.md` §Phase 5 — 原始目标与 5 条成功标准；§Phase 6/11 用于理解外壳、组合根与接线的后续消费者
- `.planning/STATE.md` — 单一分支规则（`editor/core-extract`）、既有决策与 Phase 5 开放项
- `AGENTS.md` §Project Rules — 每次 plan 执行前必须简报并等待批准；重要命名须先经 `INTERFACE-NAME.md`；描述类方法用 `类名.方法名`；提问前必须先详细描述问题；网络请求走 `http://127.0.0.1:7890` 代理

### 研究稿（本阶段契约的直接来源）
- `.planning/research/ARCHITECTURE.md` §Pattern 3（`EngineAdapter`/`ResourceDescriptor` 示意，:274-305）、§4.3 注册流（:403-419）、§5.1 泄漏清单（10 条硬编码路径与词汇，:443-456）
- `.planning/research/SUMMARY.md` §Phase 5（:159-164）— 适配器交付物与研究理由
- `.planning/research/PITFALLS.md` — Pitfall 3/14（引擎假设泄漏进 core）、Pitfall 6（扩展点必须有第二个具体实现才可冻结）

### 前序阶段决策（约束本阶段）
- `.planning/phases/03-kernel-runtime-ports-registry-diagnostics/03-CONTEXT.md` — D-14（接口最小化、显式演进）、D-15（PORT-02 ESLint 作用域门禁范式）、D-16（目录划分）、D-22（门禁排除测试）
- `.planning/phases/04-resource-edit-layers-moved/04-CONTEXT.md` — D-01（`Json2x`/`Script` 留 editor）、D-06（core 无模块级实例）、D-09（不新增对外 subpath）、D-10（shim 追踪）、D-14（core 内存 `FsPort` 测试替身）
- `.planning/phases/02-package-boundary-build-scaffolding/02-CONTEXT.md` — D-06（单向 DAG、跨 subpath 相对导入）、D-13/D-14（门禁塞进现有 4 job）、D-16/D-17（`requireZero` 与空集启用）、D-19（catalog 缺口）
- `.planning/phases/01-baseline-verification-net/01-CONTEXT.md` — 特性化测试纪律（co-located、只改 import、变红即回归）

### 受影响的现有文件
- `packages/libs/editor-core/lib/ports/engine.ts` — 现有 `EngineAdapter` 最小形状（`id` + `apiVersion`），本阶段显式演进
- `packages/libs/editor-core/lib/resources/resourceRegistry.ts` — RES-02 注册表（逻辑 id → `ResourceView`），engine B 与适配器描述的注册目标
- `packages/libs/editor-core/lib/resources/{fileHandler,fileHandlerManager,dataHandler,jsonDataHandler,binaryFileHandler,combinators}.ts` — 「文件支撑资源类」可复用的组件
- `packages/libs/editor-core/lib/kernel/{core,registry,diagnostics}.ts` — 组合根、能力注册表、诊断总线（适配器后续接入点）
- `packages/apps/editor/src/project/data/projectData.ts` — 10 条路径 + 11 个访问器（**对照来源，本阶段不改**）
- `packages/apps/editor/src/services/editorConfig/editorConfigService.ts:18` — 第 10 条路径（`_server/config.json`）
- `packages/apps/editor/src/fs/Json2xDataHandler.ts` — 引擎格式处理器，属适配器
- `packages/apps/editor/src/project/migrations/airwallMigration.ts` — 唯一迁移，留适配器（D-10）
- `packages/apps/editor/src/services/*/*DataHandler.ts` — 领域 handler（Tower/Items/Enemys/MapsBlocks/Icons/Functions/Plugins/Floor/TableMeta），属适配器
- `scripts/verify/*.js`、`scripts/verify/ci-workflow.js`、`.github/workflows/ci.yml` — verifier 范式与四 job 契约（新门禁只能塞进现有 job）
- `.dependencyCruiser.cjs` — 边界规则（core 不得 import 宿主/引擎）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/libs/editor-core/lib/resources/resourceRegistry.ts`：`ResourceRegistry.register(id, ResourceView<T>)` 已经支持「任意来源、无 path」的资源注册——正是 D-04/D-07 所指的通用身份口；engine B 直接用它。
- `packages/libs/editor-core/lib/resources/fileHandlerManager.ts` + `fileHandler.ts` + `persistExecutor.ts` + `persistenceMonitor.ts`：文件支撑资源类（D-06）所需的 per-path 缓存、加载锁、per-path 串行持久化组件都已就位。
- `packages/libs/editor-core/lib/resources/dataHandler.ts` / `jsonDataHandler.ts` / `binaryFileHandler.ts` / `combinators.ts`：`create` 工厂可组合的 handler 与响应式组合子。
- `packages/libs/editor-core/lib/ports/engine.ts`：现有 `EngineAdapter` 只有 `id` + `apiVersion`——本阶段在其上做一次显式接口演进。
- `scripts/verify/*.js`（Phase 1/2/3/4）：ESM + 中文头注 + `failures[]` + `process.exit(1)` + 两极性证明的 verifier 范式——游戏标识符门禁沿用。
- `packages/libs/editor-core/lib/resources/__tests__/memoryFsPort.ts`：core 侧扁平 `FsPort` 测试替身——engine B 的文件支撑资源可直接复用。

### Established Patterns
- **共享库以源码 TS 直出**（`exports` 指向 `lib/index.ts`，无 build）；`tsc -b` 只做类型检查。
- **core 相对导入**（不用 `@/`，Phase 2 D-06）；`lib/` 内跨目录用相对路径。
- **门禁必须能失败**（Phase 2 教训）：新 verifier 须两极性——真实树过 + 合成违规必须失败。
- **四 job CI 契约是硬约束**：`lint`/`typecheck`/`unit`/`build`，新检查只能加步骤。
- **命名集中于 `INTERFACE-NAME.md`**（每 Plan 一节），落盘前须经用户确认。
- **不写无消费者的接口**（Phase 3 D-14）：新公开面必须有真实消费者或第二个具体实现（engine B）。

### Integration Points
- `packages/libs/editor-core/lib/ports/engine.ts`（`EngineAdapter` 演进 + `defineEngine` 落点）
- `packages/libs/editor-core/lib/resources/*`（通用描述符 + 内置文件支撑资源类）
- `packages/libs/editor-core/lib/index.ts`（公开面汇总出口）
- `packages/libs/editor-core/lib/__tests__/`（fake engine B 夹具 + 契约测试）
- `packages/apps/editor/src/adapter/`（新建：`motaEngine` 描述符 + 领域 handler 归属）
- `scripts/verify/`（新增游戏标识符 verifier）
- 以后（非本阶段）的接入点：Phase 6+ `LabelOverrides`、Phase 9 素材能力、Phase 10 地图能力、Phase 11 组合根切换与删除 shim/singleton

</code_context>

<specifics>
## Specific Ideas

- **core 只负责内容编辑，内容来源完全无关**（用户明确）：core 只做 json 编辑 / 代码编辑 / 地图编辑等；它改的是什么、内容从哪来，与 core 无关。
- **不假定内容来自文件**（用户明确）：「传入的内容都不一定真的是文件中的内容，甚至有可能是现场创建的」——所以通用 `ResourceDescriptor` 不能有 `path`；至多 core 内置一个带 path 的文件支撑资源类。
- **路径键的职责拆解**（讨论结论）：字符串键同时承担「身份/去重」与「IO 地址 + 持久化分组」两件事；前者是通用的（应为逻辑 id），后者只对文件支撑资源成立（是内部的 opaque IO 地址）。
- **airwall 的显示分离应一般化**（用户明确）：游戏内显示与编辑器显示使用不同贴图应是**通用能力**，不是特例——通用位置已存在（`BlockInfo.editorDisplay`），属 Phase 10。
- **素材区 = 多图合并**（用户明确，延后项）：不是「enemy 一张大图、npc 一张大图」，而是可以有一堆图、同一张图可同时含 enemy/item/npc，这些图共同组成素材区——属 Phase 9 素材能力。
- **纯增量、对外行为零变化**：Phase 1 基线与 Phase 2/3/4 门禁必须持续为绿；`@motajs/editor` 不改功能/UI/宿主协议。
- **engine B 是冻结前的诚实性检查**：扩展点在没有第二个非 mota 实现跑通前不冻结（PITFALLS Pitfall 6）。

</specifics>

<deferred>
## Deferred Ideas

- **`LabelOverrides` 的定义与消费** —— core 本阶段不定义（D-08）；等 Phase 6+ 外壳/UI 迁入、出现真实文案需求时再定。
- **`MigrationHook` 的定义与执行点** —— core 本阶段不定义；迁移（`airwallMigration.ts`）留适配器（D-10）。若将来 core 真的承担加载编排，再评估是否需要 core 侧迁移时机接口。
- **airwall「编辑器/游戏显示分离」一般化** —— 作为通用能力（可能落在 `BlockInfo.editorDisplay` / 图块模型）在 Phase 10（地图能力）处理。
- **素材区多图合并** —— 「一堆图、单图可含多种素材、共同组成素材区」在 Phase 9（素材能力 `ASSET-*`）处理。
- **真正接线：改写 `projectData`、组合根切换、删除 shim 与 6 个 singleton** —— Phase 11。
- **文档修订** —— `ROADMAP.md` `PORT-04` 措辞、`PORT-06`/`PORT-07` 下修（D-14），待用户确认后由 transition/文档流程处理；本阶段不改。
- **插件加载器** —— 本期不做（PROJECT.md Out of Scope）。

None of the above is a new capability for this phase; all are explicitly out of scope or belong to later phases.

</deferred>

---

*Phase: 5-Engine Adapter Skeleton & Resource Descriptors*
*Context gathered: 2026-09-28*
