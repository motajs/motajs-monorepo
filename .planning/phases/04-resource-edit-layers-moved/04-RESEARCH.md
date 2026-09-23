# Phase 4: Resource + Edit Layers Moved - Research

**Researched:** 2026-09-23
**Domain:** In-repo verbatim module relocation + constructor-injection conversion (TypeScript 5.9 source-only shared library; ESLint flat-config + dependency-cruiser + Vitest 4 gates)
**Confidence:** HIGH for every repo-derived structural claim (each cites a `file:line` read this session, or an executed read-only probe); MEDIUM for the `ResourceRegistry` (RES-02) shape recommendation and the `es-toolkit` dependency-version decision (both are decision-shaped, not fact-shaped).

> **Scope note.** This phase *moves* production code out of `@motajs/editor` into `packages/libs/editor-core/lib/`, converts three module singletons to per-instance classes, and adds re-export shims. Nothing in RESEARCH.md reopens a locked CONTEXT decision; every recommendation is about **HOW** to implement D-01..D-14.
>
> **Probe evidence used (read-only, no repo file was created or modified).** Two probes were executed this session and their output is quoted inline where relevant:
> - `node_modules/eslint/bin/eslint.js --print-config packages/libs/editor-core/lib/kernel/registry.ts` — confirms the resolved core-scoped rules.
> - `node_modules/dependency-cruiser/bin/dependency-cruise.mjs --config <temp cfg outside the repo>` over `packages/libs/editor-core/lib` + the three remaining editor singletons — establishes what dependency-cruiser can and cannot see in `packages/apps/editor/src`.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**A. 迁移边界（哪些文件真的搬）**
- **D-01:** `fs/Json2xDataHandler.ts` 与 `fs/ScriptDataHandler.ts` **留在 `@motajs/editor`**。core 的 `lib/resources` 只收通用 `DataHandler` 基类与 `JsonDataHandler`；不引入 `@motajs/file2x` 依赖。这两个 handler 继续继承 core 的 `DataHandler`。 — **Reversibility:** costly — 若日后决定纳入 core，需给 core 增加 `@motajs/file2x` 依赖并重写 import 与 shim。
- **D-02:** `history/viewport.ts` 与 `history/materialOperations.ts` **留 editor**；`operations.ts` 里依赖视口的 `RestoreViewportOperation` / `NavigateFloorOperation` 也留 editor。理由：`viewport.ts` 依赖 `@/stores/*`/`@/MapEditor/*`/`@/components/SchemaTable/*` 且带模块级可变注册表（`registerEditorViewportProvider`）；`materialOperations.ts` 依赖 `@/project/assets` 与 `project/autotiles`/`project/materials/...` 引擎路径。 — **Reversibility:** costly。
- **D-03:** core 的编辑层提供**「可撤销系统」注册表**（per-instance）：系统接口形如 `UndoSystem { id, capture(), restore(snapshot) }`；每个 `EditorOperation`（或历史条目）记录它涉及哪些 system id；undo/redo 时 core 按逆序逐个回调各系统的 `restore`。editor 把 viewport / material / data-resource 实现成 system 注册进去。core 完全不认识视口/素材/引擎语义，只认识 id + 回调。这是对现有「`operationHistory` 直接调 `captureEditorViewport`/`restoreEditorViewport` 并记录 before/afterViewport」的替代实现（用户明确要求：基础规则记录「每个可撤销操作由哪个上层系统完成」，撤销时逐步回调上层系统的 `restore`）。 — **Reversibility:** costly — core 编辑层对外的核心接缝，Phase 12 冻结。
- **D-04:** 字段动作原语**进 core**：`Action`、`applyActionsWithInverse` 与基于窄接口 `PatchableResource<T>`（`path`/`raw()`/`mutate()`）重建的 `patchResourceOperation` 搬入 `lib/edit`；editor 的 `DataResource` 结构上满足 `PatchableResource`（只改类型签名，不改实现）。`commandOperations.ts`（`executePatchCommand`/`executeCompositeCommand`）**留 editor**（依赖 editor 的 `CommandResult`）。 — **Reversibility:** costly — 接口名与签名进入 core 公开面。
- **D-05:** core **只消费注入的 `FsPort`**，不持有任何 fs 实现、不提供默认值（符合 PORT-02）。被搬代码调用点由 `fs.promises.readFile` 改为 `fs.readFile`（扁平 API）；editor 侧直接把现有 `fs.promises`（`FsPromiseApi`）作为 `FsPort` 传入（结构兼容，多余的 `writeMultiFiles` 无妨）。外部可有多种实现：浏览器 FileSystemHandler、HTTP、Node（Electron 桌面端）。 — **Reversibility:** costly — 接口是 core 与宿主的边界契约。

**B. per-instance 化与 editor 连续可用**
- **D-06:** **三个单例全去单例**：`FileHandlerManager` / `PersistenceMonitor` / `OperationHistory` 在 core 只导出 class + 工厂，模块末尾不再 `new`。理由：D-10 门禁禁止 core 生产源码出现模块级可变绑定；且「两个实例互不干扰」的里程碑目标要求如此。
- **D-07:** `@motajs/editor` 侧保留一个**临时应用实例模块**（composition-root-lite）：`new` 一份实例并以旧名（`FileHandlerManager`/`persistenceMonitor`/`operationHistory`）导出，供现有约 40 处 import 与测试夹具使用。Phase 11 组合根接管后删除该模块。`FileHandler` 改为**构造注入** `PersistenceMonitor`（由 `FileHandlerManager` 在创建 `FileHandler` 时传递），消除 `fs/FileHandler.ts:8` 对 `persistenceMonitor` 单例的直接 import。 — **Reversibility:** costly — 临时模块与注入链是过渡结构，Phase 11 才收口。
- **D-08:** Phase 2 的 `requireZero` 门禁（`.dependencyCruiser.cjs:53-66`）**改指仍在 editor 的 3 个单例**（`projectData`/`projectModel`/`editorConfigService`，Phase 5/11 处理），并在规则注释记录「`FileHandlerManager`/`persistenceMonitor`/`operationHistory` 已在 Phase 4 去单例」。core「无模块级实例」由既有 D-10 门禁保证。理由：若不改，规则会因路径漂移（`lib/resources`/`lib/edit`）而静默失效。

**C. shim / subpath / 依赖形态**
- **D-09:** `lib/resources/*` 与 `lib/edit/*` 作为**包内目录**，公开面由根入口 `.`（`lib/index.ts`）汇总导出；**不新增对外 subpath**，对外保持 Phase 2 的 7 个（与 `EXT-05`/Phase 12 冻结面一致）。能力层与 shell 通过包内相对路径引用它们（符合 D-06 单向 DAG）。
- **D-10:** **逐文件 shim**：旧路径（`src/fs/types.ts`、`src/fs/FileHandler.ts`、`src/fs/FileHandlerManager.ts`、`src/fs/PersistenceMonitor.ts`、`src/project/resources.ts`、`src/project/history/operations.ts`、`src/project/history/operationHistory.ts` 等）各保留一个转发文件，`export * from` core 对应模块；涉及单例的三个 shim 同时从「临时应用实例模块」导出旧实例名。editor 内相对导入与 `@/...` 深层导入全部不改。追踪：shim 文件统一加 `// SHIM(phase4)` 标记，并在 `scripts/verify/` 新增 verifier 列出全部 shim，供 Phase 11 删除。 — **Reversibility:** costly — shim 是 Phase 11 删除清单的唯一来源。
- **D-11:** `OperationHistory` 的 Store **挂到实例**（替代 `operationHistory.ts:34` 的模块级 `historyStore`，以过 D-10 门禁）；`useOperationHistory`（React hook）进 **`./react`** 入口，`@tanstack/react-store` 依赖只出现在 `./react`；`@tanstack/store` 与 `OperationHistory` 在根 `.`。
- **D-12:** `BinaryFileHandler` 与 `JsonDataHandler` **按 RES-01 字面搬入** core。用户澄清：编辑器本质是可视化的（浏览器/Electron），core 无需做成 Node-only，浏览器 API 可接受；`FsPort` 的多种实现是为 Electron 换 Node 文件系统。`BinaryFileHandler` 的 Fs 注入同样改为 `FsPort`（无默认值）。
- 新增依赖（按仓内惯例走 `pnpm-workspace.yaml` catalog 固定版本）：`ts-pattern`（`ContentUtils`）、`@tanstack/store`（`OperationHistory`）、`@tanstack/react-store`（`./react` 的 `useOperationHistory`）；`waitUntil`（`@/utils/base/signal`）归入 core 的通用信号工具。

**D. 测试迁移与 core 覆盖率**
- **D-13:** **纯内存测试搬 core**（`errors`/`FileHandler`/`FileHandlerManager`/`PersistExecutor`/`PersistenceMonitor`/两个 `*.invariants`/`operationHistory` 的纯内存部分/`resources`），只改 import 路径、断言不动（D-10/D-12）；依赖 `@test/utils` 与 mota-js submodule 的测试（`persistNoRollback.invariants`、`operationHistory.test`、`operationHistory.invariants` 的 reactivity describe）**留 editor** 经 shim 跑。
- **D-14:** core **自建最小内存 FsPort 测试替身**（含写延迟/写错误/按路径写错误/写计数）；editor 保留现有 `MemoryFileSystem`（服务 `Fs`/`FsPromiseApi`）。两份各服务不同接口形状（core `FsPort` 扁平 vs editor 嵌套），互不耦合。

**待解决开放点（planner/researcher）**
- **RES-02 `ResourceRegistry`**：当前源码中**不存在**名为 `ResourceRegistry` 的东西；RES-02 要求「支持通用逻辑 id 注册」。本次讨论的四个 Area **未覆盖**这一条。planner/researcher 须先判定它落在 Phase 4 还是与 Phase 5 的 `ResourceDescriptor` 一并处理，并给出形状（倾向：`lib/resources` 里一个最小的「逻辑 id → `ResourceView`」注册表服务，引擎描述符 Phase 5 注入）。此点须在计划前解决，否则 RES-02 无法满足。

### the agent's Discretion
- 临时应用实例模块的文件名与导出名、core 内存 FsPort 测试替身名、`UndoSystem`/`PatchableResource` 等的最终命名 —— 须先入 `.planning/phases/04-resource-edit-layers-moved/INTERFACE-NAME.md` 并经用户确认（Project Rules）。
- shim 标记的具体文本与 verifier 的输出格式。
- `waitUntil` 的具体落点（core 内哪个文件）。
- `lib/resources` / `lib/edit` 内部的文件划分与 barrel 结构。
- catalog 版本的具体取值。

### Deferred Ideas (OUT OF SCOPE)
- **`Json2xDataHandler`/`ScriptDataHandler` 的归属** —— 留 editor（D-01）；PORT-05「core 仅保留 JsonDataHandler」因此天然满足。若后续要把它们纳入 core，需重新评估 `@motajs/file2x` 依赖。
- **视口抽象搬进 core** —— 本阶段留 editor（D-02/D-03）；Phase 10（地图能力）可能需要把 `EditorViewport` 抽象与 provider 注册表 per-instance 化后搬入 core。
- **删除 shim、临时应用实例模块与 6 个 singleton；组合根切换** —— Phase 11。
- **`ResourceDescriptor` / `defineEngine` / 逻辑 id 的引擎侧描述** —— Phase 5（RES-02 的 `ResourceRegistry` 落点见上方开放点）。
- **图片/二进制解码抽象（image codec port）** —— 本阶段按 RES-01 字面搬入 `BinaryFileHandler`；若 Phase 9（Asset 能力）需要非浏览器解码，再抽象成可注入 port。
- **全仓 lint/cruise 债务清理** —— Phase 1 `deferred-items.md` 已记录，非本阶段。
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RES-01 | `src/fs/*` 与 `src/project/resources.ts` 原样迁入 `lib/resources/*`（`Content<T>` 五态、`FileHandler`/`DataHandler`/`BinaryFileHandler`、combinators） | §Q1 (injection chain), §Q10 (move mechanics table), §Architecture Patterns 1/2; the moved file list and every import rewrite is enumerated |
| RES-02 | `ResourceRegistry` 支持通用逻辑 id 注册 | §Q7 — this is **new construction**, not a move; ARCHITECTURE.md:143/625 and SUMMARY.md:153 name it in Phase 4; concrete minimal shape recommended |
| RES-03 | `FileHandlerManager` 由模块 singleton 改为 per-instance service | §Q1 + §Q6; the singleton line `FileHandlerManager.ts:175` is removed and the editor re-exports an instance from the temp app-instance module |
| RES-04 | `src/project/history/*` 迁入 `lib/edit/*`（`EditorOperation`、`compositeOperation`、`operationHistory` 容量 100、多目标 checkpoint + rollback） | §Q2 (history split), §Q3 (`PatchableResource`), §Q10; capacity/checkpoint code moves verbatim, only the viewport seam is replaced |
| RES-05 | 保持「内存优先 ≠ 已保存」、单一写路径、`not-found` ≠ `error`、每路径串行（一个执行中 + 一个待定） | §Q1/§Q2 — the four invariants live in code that moves byte-for-byte (`PersistExecutor.pendingIntent`/`isExecuting`, `isFileNotFoundError`, `FileHandler.commit`, `PersistenceMonitor.schedule`); §Validation Architecture maps each to a moving characterization test |
| RES-06 | hook 返回 `ReadonlySignal<Content<T>>`（保持五态响应式），不得用快照或 effect 伪造响应式 | §Q1/§Q9 — `ResourceView.content`, `FileHandler.content`, `DataHandler.content`, `BinaryFileHandler.content` are all `ReadonlySignal<Content<T>>` and move verbatim; §Validation Architecture adds an explicit assertion |
</phase_requirements>

---

## Project Constraints (from AGENTS.md)

`AGENTS.md` exists at the repo root and its "Project Rules" block is user-mandated (NOT GSD-managed). The planner MUST treat these as binding, with the same authority as CONTEXT.md's locked decisions. Verbatim-extracted directives that constrain this phase:

| # | Directive | Effect on this phase |
|---|-----------|---------------------|
| AG-1 | **Per-plan briefing before execution (MANDATORY).** Before executing **any** plan — `/gsd-execute-phase`, `/gsd-executor`, `/gsd-quick`, or any `--auto`/chained pipeline — stop and report: plan id + goal; 大致内容和需要解决的问题; how completion will be verified. Then **wait for explicit user approval**. Brief per plan, in execution order; never batch; `--auto` is not approval. | Each Phase-4 plan (resources move, edit move, registry+wiring+gates) gets its own briefing and its own approval gate |
| AG-2 | **Per-plan completion report (MANDATORY).** At every plan boundary report two things in order: ① what the just-finished plan actually did (task outcomes, exact verify-command results, deviations, commit hashes) and ② the next plan itself (id/goal/tasks/problem/verification), then wait for approval. Never chain silently, never report only one. | The planning manifests must be sequential, not parallel |
| AG-3 | **Important naming requires prior confirmation (MANDATORY).** Every file name / interface name / method name / function name / type name / package name / exported symbol name must be reported in `.planning/phases/<phase>/INTERFACE-NAME.md`, **one section per Plan**, each entry stating **what the thing is for**, and confirmed by the user **before** it is written into code, plans, or config. Internal `let`/`const` temporaries inside function bodies are exempt. | Every new name catalogued in this RESEARCH.md (§Q7, §Q9, §Q10, Open Questions 2/3/4/5) plus every target file name must go into `04-INTERFACE-NAME.md` first |
| AG-4 | **Method references use `ClassName.methodName` (MANDATORY).** Describe class methods as `ClassName.methodName` (e.g. `OperationHistory.registerUndoSystem`) never bare. Free functions are bare; a method on a plain object literal is written `symbol.member`. | Applies to `OperationHistory.registerUndoSystem`, `OperationHistory.execute`, `FileHandlerManager.get/exists/clear`, `FileHandler.commit/load`, `ResourceRegistry.register/get/snapshot`, `EditorCore.registerCapability`, … in plans, tasks, and comments |
| AG-5 | **Questions are answer-only (MANDATORY).** A user question must be answered with **no** file edits, commits, branches, or config changes. Action only when the user explicitly gates it. | Do not "helpfully" start implementing while answering an open question |
| AG-6 | **Direction is the user's call (MANDATORY).** Never decide scope, architecture direction, package structure, or roadmap changes unilaterally; hear the user's direction first. | The `ResourceRegistry` (RES-02) open item must be *proposed*, not silently committed to |
| AG-7 | **Questions must be preceded by a detailed problem description (MANDATORY).** The user is not familiar with this project (largely AI-written); before any question, describe in plain language what the code/mechanism is, what it does today, why a decision is needed, and what each option means. | The `INTERFACE-NAME.md` entries and every clarifying question must carry the "what it is for" explanation, not just a name |
| AG-8 | **Network requests use the local proxy (MANDATORY).** Any network command — `git fetch/pull/push`, `pnpm add/install/update`, `npm`, `curl` — MUST go through `http://127.0.0.1:7890`. | The unavoidable `pnpm install` that writes the new catalog entries + `dependencies` edges must set `HTTP_PROXY`/`HTTPS_PROXY` first (Pitfall 7) |
| AG-9 | **GSD workflow enforcement.** Before using Edit/Write, start work through a GSD command (`/gsd-quick`, `/gsd-debug`, `/gsd-execute-phase`); no direct repo edits outside a GSD workflow unless the user explicitly bypasses it. | The shims/core files must land through the phase's plans, not ad-hoc edits |

Other AGENTS.md-derived constraints that research must not contradict (from the PROJECT/STACK/CONVENTIONS blocks):
- **Prettier is the formatter of record** with `singleQuote: true` and `printWidth: 120`; `pnpm lint` also fails on an unformatted file. Every moved/shim file must be Prettier-clean (`pnpm format`), and Markdown/`pnpm-workspace.yaml` are deliberately **outside** Prettier's scope.
- **`data-test-id`** is the e2e selector convention (Playwright `testIdAttribute`) — unchanged by this phase.
- **Named exports only**; no default exports except config files. Barrel `index.ts` per package.
- **`@motajs/h5animate` uses explicit `.js` import extensions; every other package uses extensionless relative imports** — core must follow the latter.
- **No `enum` in `packages/apps/editor`** (`erasableSyntaxOnly`) — and by program inheritance, none in core either (Pitfall 1).
- **`@motajs/theme` is not discoverable** because `packages/libs/theme/pacakge.json` is misspelled — irrelevant to this phase, recorded so nobody "fixes" it here.

---

## Summary

Phase 4 is the first phase that **moves production code** rather than adding it. Its risk is not algorithmic — it is mechanical breadth: **78 production files and 19 test files** import at least one of the moving/rewritten paths (see §Q1 evidence), and the phase must keep the Phase 1 characterization net green while three module singletons become constructible objects.

Five findings dominate planning (each is evidence-backed below):

1. **`ContentUtils` will trip the module-state gate on arrival.** `packages/apps/editor/src/fs/ContentUtils.ts:10` is a module-level object literal `export const ContentUtils = { … }`. The core-scoped `no-restricted-syntax` selector in `eslint.config.js:172-176` matches `ExportNamedDeclaration > VariableDeclaration[kind="const"] > VariableDeclarator > ObjectExpression` — proven present via an executed `--print-config` probe. A verbatim move turns `pnpm lint` red. **It must arrive as `Object.freeze({…})` (the gate's own sanctioned escape hatch).** This is the single clearest "verbatim is impossible" item in the phase.

2. **The module-state gate's ignore list covers only `lib/__tests__/**`.** `eslint.config.js:159` ignores exactly `lib/kernel/core.ts` and `lib/__tests__/**`. Moved tests land in `lib/resources/__tests__/**` and `lib/edit/__tests__/**`, which are **not** ignored — so D-22's "production source only" exemption silently stops applying to the new test trees. The ignore list must be widened (and `coreModuleState.js` extended to sample one of the new trees).

3. **The `requireZero` retarget is not expressible the way Phase 2 wrote it.** An executed dependency-cruiser probe over the three remaining editor singletons shows that **dependency-cruiser does not resolve the `@/` alias at all** (`@/project/data/projectData → (unresolved)`), so any rule matching *resolved filesystem paths* under `packages/apps/editor/src` is vacuous. A second probe proves the rule *does* fire when `to.path` matches the **raw import specifier** (`@/project/dat...`). The shapes in §Q6 are built on that measured behaviour.

4. **D-04's `applyActionsWithInverse` transitively drags two more editor modules into core.** `applyActionsWithInverse` (`src/utils/action.ts:117`) depends on `firstMissingFieldPath`/`adjustActionValue`-style helpers and on `parseFieldPath`/`buildFieldPath`/`getByFieldPath`/`setByFieldPath`/`deleteByFieldPath` (`src/utils/fieldPath.ts:21-177`). Core cannot import editor, so `fieldPath.ts` (and with it the whole `action.ts`) must move to `lib/edit/`, which pulls in `es-toolkit` (used as `es-toolkit` and `es-toolkit/compat`). **CONTEXT under-specifies this transitive closure** — see §Q4/§Assumptions.

5. **The `UndoSystem` seam must capture *all* registered systems on every `execute`.** The characterization test `src/project/history/__tests__/operationHistory.test.ts:55-71` asserts that a plain **data** patch restores the *viewport* on undo. Today `operationHistory.ts:117-123` captures the viewport unconditionally per `execute`, independent of the operation. A "per-operation system-id declaration" design (the literal reading of D-03) would only capture the viewport for viewport operations and would turn that test red. §Q2 resolves this.

**Primary recommendation:** implement the move as **one plan per layer** (`lib/resources` then `lib/edit`), each plan (a) copying the files with rewritten relative imports, (b) converting the singleton to a constructor-injected class **in the same commit as its shim**, so the tree is never in a state where an editor import dangles; then a third plan for `ResourceRegistry` + the editor-side temp app-instance module + shim verifier + gate edits. Register every new name in `INTERFACE-NAME.md` **before** any code lands (AGENTS.md Project Rules).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| `Content<T>` five-state value + `ReadonlySignal<Content<T>>` | core resource layer — `lib/resources/types.ts`, `interfaces.ts` | — | Pure data contract; no engine, no host, no React (RES-06) |
| Per-path file identity (`get` returns one handler per path) | core resource layer — `lib/resources/FileHandlerManager.ts` (per-instance) | editor temp app instance (constructs the one instance) | Today's `FileHandlerManager.handlers` map is per-*module*; it becomes per-*instance* while remaining one instance per running editor (RES-03) |
| Persistence scheduling / per-path serialization | core resource layer — `lib/resources/PersistenceMonitor.ts` + `PersistExecutor.ts` | — | The two-state queue (one executing + one pending) is a pure mechanism (RES-05) |
| File I/O transport | adapter — `@motajs/editor` `services/fs/fs.ts` implements `FsPort` | core consumes `FsPort` only | PORT-02/D-05: core holds no fs implementation and no default |
| Undo/redo orchestration, capacity, checkpoints | core edit layer — `lib/edit/operationHistory.ts` | — | Engine-neutral ordering + rollback (RES-04) |
| "Which upstream state must be restored on undo" | adapter — editor `viewport.ts` implements an `UndoSystem` | core knows only `{ id, capture, restore }` | D-03: core must not learn viewport/material semantics |
| Field-path / action primitives (`Action`, `applyActionsWithInverse`) | core edit layer — `lib/edit/action.ts`, `fieldPath.ts` | — | D-04; needs `es-toolkit` only |
| Narrow write surface (`PatchableResource<T>`) | core edit layer contract | editor `DataResource<T>` structurally satisfies it | D-04: adapter conforms, core does not learn `DataResource` |
| Logical-id resource registration | core resource layer — `lib/resources/ResourceRegistry.ts` (new) | engine descriptor (Phase 5) supplies ids | RES-02; engine descriptor intentionally deferred to Phase 5 |
| Per-file legacy path forwarding | adapter — `packages/apps/editor/src/**` shim files | core (target of the re-export) | D-10: the shim is the Phase-11 deletion inventory |
| Undo-system capture/restore for viewport & material | adapter — `viewport.ts` (viewport), `materialOperations.ts` (materials) | core calls back by id | D-02/D-03: both stay in editor |

---
## Standard Stack

### Core

**No new tool, no new framework, no new peer dependency.** The phase adds exactly **four runtime libraries** to `editor-core` — three named by D-11 and one that D-04's transitive closure forces (`es-toolkit`). Three of the four are already installed in the workspace at the exact versions below.

| Library | Version (installed, verified) | Purpose | Why Standard |
|---------|------------------------------|---------|--------------|
| `ts-pattern` | `5.9.0` — `[VERIFIED: node_modules/.pnpm/ts-pattern@5.9.0/node_modules/ts-pattern/package.json → 5.9.0]` | `ContentUtils`'s `match()` | Already a repo dependency; catalog entry exists `[VERIFIED: pnpm-workspace.yaml:55 \`  ts-pattern: ^5.9.0\`]` |
| `@tanstack/store` | `0.8.0` — `[VERIFIED: node_modules/.pnpm/@tanstack+store@0.8.0/node_modules/@tanstack/store/package.json → 0.8.0]` | per-instance `OperationHistory` store | Editor already uses it in 4 stores plus `operationHistory.ts:1`; D-11 locks it |
| `@tanstack/react-store` | `0.8.0` — `[VERIFIED: node_modules/.pnpm/@tanstack+react-store@0.8.0_.../node_modules/@tanstack/react-store/package.json → 0.8.0]` | `useOperationHistory` in `./react` | Editor already uses `useStore` in `stores/{prefabState,locState,editorState,appendPicState}.ts`; D-11 locks it |
| `es-toolkit` | `1.44.0` — `[VERIFIED: node_modules/.pnpm/es-toolkit@1.44.0/node_modules/es-toolkit/package.json → 1.44.0]` | `isEqual` (`action.ts:7`) and `get/set/unset` (`fieldPath.ts:8`, `es-toolkit/compat`) | **Forced by D-04's closure** — see §Q4; already a repo dependency and in the catalog `[VERIFIED: pnpm-workspace.yaml:31 \`  es-toolkit: ^1.43.0\`]` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `fast-check` | catalog `4.5.2`, installed `4.5.2` `[VERIFIED: node_modules/fast-check/package.json → 4.5.2]` | only if the three `src/utils/__tests__/*.property.test.ts` files are moved to core | **Recommendation: do NOT move them in Phase 4** (see §Q5) — they run unchanged through the shims and moving them would add a `fast-check` devDependency for coverage that already runs |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@tanstack/store` on the `OperationHistory` instance | A hand-written `{ subscribe, getState }` + React's built-in `useSyncExternalStore` | Removes the new dependency entirely, but contradicts **D-11** (locked) and rewrites the store mechanics the Phase-1 invariants were written against. Recorded, not chosen |
| `@tanstack/react-store` in `./react` | `useSyncExternalStore` directly | Same as above |
| Moving `action.ts` + `fieldPath.ts` to core | Duplicating the path helpers inside core | Rejected: ~190 lines of `get/set/unset` semantics duplicated in two trees is a genuine correctness hazard (the repo's own "don't hand-roll" rule) |
| `Object.freeze({…})` for `ContentUtils` | Convert `ContentUtils` to named exports (`export function map(…)`) | Would break ~30 editor call sites and force a namespace *shim* on top of a value shim. `Object.freeze` is the gate's documented remedy and preserves every call site |

**Installation:**

```bash
# pnpm ONLY, and ONLY through the mandated local proxy (AGENTS.md 网络请求走 http://127.0.0.1:7890)
set HTTP_PROXY=http://127.0.0.1:7890 && set HTTPS_PROXY=http://127.0.0.1:7890 && pnpm install
```

**Version verification.** No registry lookup is required for the four libraries because all four are already resolved in this repo's `pnpm-lock.yaml` at the versions named above (`[VERIFIED: pnpm-lock.yaml grep → es-toolkit@1.44.0, @tanstack/store@0.8.0, @tanstack/react-store@0.8.0]`). The plan must nevertheless treat `pnpm-lock.yaml` as a reviewed artifact: Phase 3's Pitfall 13 established that an incidental `pnpm install` re-resolves and rewrites the lockfile. Here a lockfile change **is** required (new `dependencies` edges appear), so it must be deliberate, minimal, and diff-reviewed — see §Q4 for the exact `es-toolkit` float hazard.

## Package Legitimacy Audit

> Phase 4 adds four packages, all of which are **already declared and installed in this workspace** (none is newly discovered). The seam was run anyway, per protocol:

```bash
gsd_run query package-legitimacy check --ecosystem npm @tanstack/store @tanstack/react-store es-toolkit ts-pattern
```

| Package | Registry | Age / latest publish | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|---------------------|-----------|-------------|---------|-------------|
| `@tanstack/store` | npm | latest published 2026-08-05 | 22.7M/wk | github.com/TanStack/store | `OK` | Approved |
| `@tanstack/react-store` | npm | latest published 2026-08-05 | 21.7M/wk | github.com/TanStack/store | `OK` | Approved |
| `ts-pattern` | npm | latest published 2025-10-26 | 4.5M/wk | github.com/gvergnaud/ts-pattern | `OK` | Approved |
| `es-toolkit` | npm | latest published 2026-08-28 | 36.5M/wk | github.com/toss/es-toolkit | `SUS` — reason `too-new` | **Flagged** — planner must add a `checkpoint:human-verify` before the dependency edit |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** `es-toolkit` [WARNING: flagged as suspicious — `too-new`.]

**The `es-toolkit` flag is a version-float hazard, not a trust hazard.** The package is already a repo-wide dependency at the pinned installed version `1.44.0`; the seam's `too-new` signal is about the *latest* publish (2026-08-28, i.e. 26 days before this research date). The catalog currently reads `es-toolkit: ^1.43.0` `[VERIFIED: pnpm-workspace.yaml:31]`, so a fresh catalog resolution could float **past** the version this repo has been developed and baselined against. Mitigation (and the checkpoint's question): **pin the catalog entry to `1.44.0`** (exact) — which also honours PROJECT.md's "catalog 固定依赖版本" constraint — *or* declare core's dependency as the exact `1.44.0` rather than `catalog:default`. Either way the plan must assert the resolved `es-toolkit` version after install and confirm it is still `1.44.0`.

No package here has a `postinstall` script (`[VERIFIED: seam signals → postinstall: null]` for all four).

## Architecture Patterns

### System Architecture Diagram

Data/control flow for the phase's two primary use cases — *read/edit a file* and *undo an edit* — after the move:

```text
                       @motajs/editor (adapter / composition-root-lite)
                       ┌───────────────────────────────────────────────────────────────┐
   services/fs/fs.ts   │  const fsPort: FsPort = fs.promises          (D-05, no cast)  │
   (HTTP form POST) ──►│  const persistenceMonitor = new PersistenceMonitor()           │
                       │  const FileHandlerManager = new FileHandlerManager({ fsPort,    │
                       │                                                    persistenceMonitor })│
                       │  const operationHistory = new OperationHistory()               │
                       │  operationHistory.registerUndoSystem(viewportUndoSystem)       │
                       └───────────────────────────┬───────────────────────────────────┘
                                                   │ injected ports / instances
                                                   ▼
      ┌──────────────────────────── package @motajs/editor-core ────────────────────────────┐
      │ lib/resources                                                                       │
      │   FileHandlerManager.get(path) ──► new FileHandler(path, { fs, persistenceMonitor }) │
      │        FileHandler.load() ──► fs.readFile(path,'utf-8') ──► Content<string>          │
      │        FileHandler.commit() ──► persistenceMonitor.schedule(path, writeIntent)       │
      │   PersistExecutor: [ executing ] + [ one pending ]  (per path, latest-wins)          │
      │   DataHandler<T> ──computed()──► Content<T>          (five-state, ReadonlySignal)    │
      │   ResourceRegistry  (logical id ──► ResourceView)     ← RES-02, populated in Phase 5 │
      │ lib/edit                                                                            │
      │   OperationHistory.execute(op)                                                       │
      │     1. capture every registered UndoSystem      (sync, at invocation time)           │
      │     2. captureTargets(op.targets)               (de-duped by key)                     │
      │     3. await op.apply()                                                              │
      │        └─ on throw: restoreTargets(reverse) ─► restoreEverySystem(reverse) ─► rethrow │
      │     4. if changed: capture every UndoSystem again ("after") ─► push entry (cap 100)   │
      │   OperationHistory.undo()                                                            │
      │     apply inverse ─► restoreEverySystem(entry.before)   [failure ─► restore rollback] │
      └─────────────────────────────────────────────────────────────────────────────────────┘
                                                   │ UndoSystem.restore(snapshot) by id
                                                   ▼
                       viewportUndoSystem: captureEditorViewport() / restoreEditorViewport()
                       (+ material UndoSystem later, still in @motajs/editor)
```

### Recommended Project Structure

```text
packages/libs/editor-core/lib/
├── index.ts                         # EXISTING root barrel — gains named re-exports of lib/resources + lib/edit
├── kernel/                          # UNCHANGED (Phase 3)
├── ports/                           # UNCHANGED (Phase 3) — FsPort is consumed, not modified
├── react/
│   ├── index.ts                     # EXISTING probe export + NEW useOperationHistory
│   └── CoreProbe.tsx                # UNCHANGED (Phase-2 scaffolding, removed in Phase 11)
├── resources/                       # NEW — the moved resource layer (D-09: internal dir, no subpath)
│   ├── types.ts                     # from src/fs/types.ts
│   ├── interfaces.ts                # from src/fs/interfaces.ts
│   ├── ContentUtils.ts              # from src/fs/ContentUtils.ts  ⚠ must arrive as Object.freeze({…})
│   ├── errors.ts                    # from src/fs/errors.ts
│   ├── waitUntil.ts                 # NEW home for @/utils/base/signal.ts (D-12 bullet 4)
│   ├── FileHandler.ts               # from src/fs/FileHandler.ts     (constructor injection)
│   ├── FileHandlerManager.ts        # from src/fs/FileHandlerManager.ts (per-instance class)
│   ├── DataHandler.ts               # from src/fs/DataHandler.ts
│   ├── JsonDataHandler.ts           # from src/fs/JsonDataHandler.ts
│   ├── BinaryFileHandler.ts         # from src/fs/BinaryFileHandler.ts (FsPort, no default)
│   ├── PersistExecutor.ts           # from src/fs/PersistExecutor.ts
│   ├── PersistenceMonitor.ts        # from src/fs/PersistenceMonitor.ts (class only)
│   ├── combinators.ts               # from src/project/resources.ts
│   ├── ResourceRegistry.ts          # NEW (RES-02)
│   └── __tests__/                   # the moved pure tests + the core FsPort double (D-14)
└── edit/                            # NEW — the moved edit layer (D-09: internal dir, no subpath)
    ├── operations.ts                # from src/project/history/operations.ts (minus viewport ops)
    ├── operationHistory.ts          # from src/project/history/operationHistory.ts (store on instance)
    ├── undoSystem.ts                # NEW — UndoSystem contract type
    ├── action.ts                    # from src/utils/action.ts        (D-04 closure)
    ├── fieldPath.ts                 # from src/utils/fieldPath.ts     (D-04 closure, forced)
    └── __tests__/                   # the moved pure history tests + the split invariants
```

> **Naming is a candidate list, not a decision** — every new file/type/member must be listed in `INTERFACE-NAME.md` (one section per plan) and confirmed by the user before landing (AGENTS.md Project Rules).

### Pattern 1: Constructor injection replaces the module singleton

**What:** the class keeps its exact implementation; only *where it gets its collaborators* changes. The module stops ending in `new`.
**When to use:** every one of the three de-singletonised classes.

```ts
// packages/libs/editor-core/lib/resources/FileHandler.ts  (candidate shape)
import type { FsPort } from '../ports/fs';
import type { PersistenceMonitor } from './PersistenceMonitor';

export interface FileHandlerDependencies {
  readonly fs: FsPort;
  readonly persistenceMonitor: PersistenceMonitor;
}

export class FileHandler implements IContentHandler<string> {
  private readonly fs: FsPort;                                   // field name kept as `fs`
  private readonly persistenceMonitor: PersistenceMonitor;
  constructor(path: string, deps: FileHandlerDependencies) {
    this.path = path;
    this.fs = deps.fs;
    this.persistenceMonitor = deps.persistenceMonitor;
  }
  private commit(value: string): void {
    this._content({ status: 'loaded', value });
    this.persistenceMonitor.schedule(this.path, {
      kind: 'write',
      execute: () => this.fs.writeFile(this.path, value, 'utf-8'),   // flat FsPort (D-05)
    });
  }
}
```

```ts
// packages/libs/editor-core/lib/resources/FileHandlerManager.ts  (candidate shape)
export class FileHandlerManager {
  private readonly handlers = new Map<string, FileHandler>();     // instance field, not module state
  private readonly loadingPromises = new Map<string, Promise<FileHandler>>();
  constructor(private readonly deps: FileHandlerDependencies) {}  // ⚠ see Pitfall 1: no parameter property
  get(path: string): FileHandler {
    let handler = this.handlers.get(path);
    if (!handler) {
      handler = new FileHandler(path, this.deps);
      this.handlers.set(path, handler);
    }
    return handler;
  }
  async exists(path: string): Promise<boolean> {
    /* … unchanged, except: */ await this.deps.fs.readFile(path, 'utf-8');
  }
}
// NO `export const FileHandlerManager = new FileHandlerManagerImpl();` — that line is deleted (D-06)
```

**Evidence the old shape was a singleton** (both lines are deleted by this pattern):
- `[VERIFIED: packages/apps/editor/src/fs/FileHandlerManager.ts:175]` → `export const FileHandlerManager = new FileHandlerManagerImpl();`
- `[VERIFIED: packages/apps/editor/src/fs/PersistenceMonitor.ts:145]` → `export const persistenceMonitor = new PersistenceMonitor();`
- `[VERIFIED: packages/apps/editor/src/project/history/operationHistory.ts:34-38]` →
  ```ts
  const historyStore = new Store<OperationHistoryState>({
    entries: [],
    current: 0,
    busy: false,
  });
  ```

### Pattern 2: The adapter owns exactly one instance; shims forward

**What:** `@motajs/editor` keeps a single "app instance" module that constructs the one instance each legacy name needs, and thin per-file shims forward to core.
**When to use:** all of `src/fs/*`, `src/project/resources.ts`, `src/project/history/{operations,operationHistory}.ts`, `src/utils/{action,fieldPath}.ts`, `src/utils/base/signal.ts`.

Why a **single** module is mandatory (not one instance per shim): `persistenceMonitor` must be the *same object* seen by (a) `FileHandlerManager`'s injected `FileHandler`s, (b) `PersistenceNotification.tsx` / `AppTopBar.tsx` / `draftGuard.ts`, (c) `DataResource.persistStatus()` `[VERIFIED: packages/apps/editor/src/project/data/DataResource.ts:124-131]`, and (d) tests. Two instances would silently break `persistenceMonitor.whenQuiescent(...)` in ~10 test files.

```ts
// packages/apps/editor/src/<app-instance module — name to confirm>  (candidate shape, deleted in Phase 11)
// SHIM(phase4)
import { FileHandlerManager, OperationHistory, PersistenceMonitor, type FsPort } from '@motajs/editor-core';
import { fs } from '@/services/fs';
import { captureEditorViewport, restoreEditorViewport, type EditorViewport } from '@/project/history/viewport';

/** FsPromiseApi is structurally a superset of FsPort — no cast (D-05). */
const fsPort: FsPort = fs.promises;

export const persistenceMonitor = new PersistenceMonitor();
export const FileHandlerManager = new FileHandlerManager({ fs: fsPort, persistenceMonitor });
export const operationHistory = new OperationHistory();

operationHistory.registerUndoSystem<EditorViewport | null>({
  id: 'viewport',
  capture: () => captureEditorViewport(),
  restore: (snapshot) => restoreEditorViewport(snapshot),
});
```

### Pattern 3: Delegated undo (D-03) — capture-all, restore-reverse

**What:** core stores, per history entry, one snapshot per **registered** `UndoSystem`, captured *before* and *after* the apply. `undo()` restores the `before` set, `redo()` the `after` set, both after applying the stored inverse; a failed apply restores the rollback set captured at call time.
**When to use:** always — this is the replacement for `beforeViewport`/`afterViewport`.

Two non-obvious requirements, both driven by existing tests:

1. **Capture is synchronous at `execute()` invocation.** Today `operationHistory.ts:117` does `const invokedViewport = captureEditorViewport();` *outside* the queue. Preserve that: a queued operation must restore the viewport the user had when they invoked it, not the one after other queued work ran.
2. **ALL registered systems are captured for EVERY operation.** `operationHistory.test.ts:55-71` performs a *data* patch and then asserts `currentViewport.floorId === 'sample0'` after `undo()`. A per-operation declaration of "which systems this op involves" — the literal D-03 reading — cannot produce that, because `patchResourceOperation` would declare no systems. Capture-all satisfies D-03's "历史条目记录它涉及哪些 system id" clause (the parenthetical `或历史条目`) and is the faithful replacement. An optional per-operation narrowing field can be added later without changing today's behaviour.

```ts
// packages/libs/editor-core/lib/edit/undoSystem.ts  (candidate)
export interface UndoSystem<Snapshot = unknown> {
  readonly id: string;
  /** Must be synchronous: the "before" snapshot is taken at execute() invocation time. */
  capture(): Snapshot;
  restore(snapshot: Snapshot): void | Promise<void>;
}
```

### Anti-Patterns to Avoid

- **Keeping the class's `Fs` (nested `fs.promises`) shape in core.** Core consumes flat `FsPort`; a straggler `this.fs.promises.readFile(...)` compiles only if the injected thing is an `Fs`, which would re-couple core to the editor's transport.
- **Re-introducing a module-level instance anywhere in `lib/**`** (even `const registry = new ResourceRegistry()` — see Pitfall 1 for why the gate may *not* catch it).
- **Making the three singleton shims `export * from '@motajs/editor-core'`.** `FileHandlerManager` would then be both the core *class* and the editor *instance* at the same specifier. Use explicit named re-exports (Pattern 4).
- **Letting the shims grow logic.** A shim that contains a `new`, a class, or a non-trivial function is no longer in the Phase-11 deletion inventory's clean category — the shim verifier should assert this mechanically (§Q6b).

### Pattern 4: Named (never `*`) re-exports in shims

`verbatimModuleSyntax: true` is on for the editor's program `[VERIFIED: packages/apps/editor/tsconfig.app.json \`"verbatimModuleSyntax": true\`]`, so every type-only re-export must be `export type { … }`. Named re-exports also keep the Phase-11 inventory auditable and avoid `FileHandlerManager`-class/instance collisions.

```ts
// packages/apps/editor/src/fs/ContentUtils.ts   (SHIM(phase4))
// SHIM(phase4)
export { ContentUtils } from '@motajs/editor-core';

// packages/apps/editor/src/fs/types.ts          (SHIM(phase4))
// SHIM(phase4)
export type { Content, FileContent } from '@motajs/editor-core';

// packages/apps/editor/src/fs/PersistenceMonitor.ts  (SHIM(phase4))
// SHIM(phase4)
export { PersistenceMonitor } from '@motajs/editor-core';
export { persistenceMonitor } from '@/<app-instance module>';

// packages/apps/editor/src/fs/FileHandlerManager.ts  (SHIM(phase4))
// SHIM(phase4)
export { FileHandlerManager } from '@/<app-instance module>';   // the INSTANCE wins the name (D-07)
```

---
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| A core-side in-memory FS for tests | A re-implementation of `@test/utils/MemoryFileSystem` including the callback `Fs` half | A **flat `FsPort` double** with the four fault-injection knobs D-14 names (`setWriteDelay` / `setWriteError` / `setWriteErrorForPath` / `getWriteCount`) | The editor's `MemoryFileSystem` serves `Fs`+`FsPromiseApi` (nested); core needs only the 7 flat ops. Two shapes, two doubles (D-14) |
| Resolving `@/` inside core | Teaching dependency-cruiser/vitest the alias for core | Extensionless **relative** imports inside `lib/` (Phase-2 D-06 + Phase-3 Pitfall 9) | `coreBoundaries.js:190-196` fails on any non-`@styled-system` unresolved specifier; `@/` inside core would go red |
| Detecting "is this an editor singleton shim" | A bespoke TS-AST walker | A marker comment + a marker-list verifier (`scripts/verify/`) | The repo's own verifier family (`coreModuleState.js`, `coreBoundaries.js`) already establishes marker + two-polarity as the pattern |
| A DI container for the three classes | A container/tokens/reflection injector | Explicit constructor arguments + one wiring module | ARCHITECTURE Pattern 1; the repo constructs everything explicitly (`main.tsx`, `projectData.ts`) |
| A new diagnostic pipeline for `ResourceRegistry` | Extending `DIAGNOSTIC_CODES` for resource-registration errors | Keep Phase 4's `ResourceRegistry` decoupled from `DiagnosticBus` (or reuse existing codes deliberately) | `coreApiSurface.test.ts:43-51` asserts `DIAGNOSTIC_CODES` is **exactly five** entries — a new code silently reds `pnpm test` |
| Rewriting `useOperationHistory` on `useSyncExternalStore` | A hand-rolled store to avoid the `@tanstack` deps | `@tanstack/store` + `@tanstack/react-store` (D-11) | Locked; also keeps the hook byte-identical in behaviour to today |

**Key insight:** Phase 4's hand-rolling risk is *not* algorithmic — it is **re-deriving what already exists in a slightly different shape**. The moved code is proven; the only genuinely new code is the `UndoSystem` seam, the `ResourceRegistry`, the wiring module, and the gate edits.

## Common Pitfalls

### Pitfall 1: `erasableSyntaxOnly` is on for core's files, via the editor's `tsc -b`

**What goes wrong:** a new core class is written with a constructor parameter property —
`constructor(private readonly deps: FileHandlerDependencies) {}` — and the editor's `pnpm typecheck` fails with `TS1294: This syntax is not allowed when 'erasableSyntaxOnly' is enabled`, even though the file lives in core.
**Why it happens:** the editor owns the program. `[VERIFIED: packages/apps/editor/tsconfig.app.json]` sets `"erasableSyntaxOnly": true`, `"verbatimModuleSyntax": true`, `"noUnusedLocals": true`, `"noUnusedParameters": true`, `"noFallthroughCasesInSwitch": true`, `"noUncheckedSideEffectImports": true`, and `include: ["src"]`; core is **not** a referenced project, so core's `.ts` sources are pulled into the editor's program through `@motajs/editor-core` imports. Editor `tsconfig.json` references only `./tsconfig.app.json` and `./tsconfig.node.json`.
**How to avoid:** declare fields explicitly and assign in the constructor body; never `enum`, never `namespace`, never parameter properties. Re-run `pnpm --filter @motajs/editor typecheck` — not only core's — after adding any core class.
**Warning signs:** core's own `pnpm --filter @motajs/editor-core typecheck` is green while `pnpm typecheck` (fan-out) is red.

### Pitfall 2: `ContentUtils`'s module-level object literal trips the core module-state gate

**What goes wrong:** `lib/resources/ContentUtils.ts` arrives verbatim as `export const ContentUtils = { map(…), … }` and `pnpm lint` fails with the core-scoped `no-restricted-syntax` rule.
**Why it happens:** the selector is `:matches(Program > VariableDeclaration, Program > ExportNamedDeclaration > VariableDeclaration)[kind="const"] > VariableDeclarator > :matches(NewExpression[callee.name=/^(Map|Set|WeakMap|WeakSet)$/], ArrayExpression, ObjectExpression)` `[VERIFIED: eslint.config.js:172-176]`, and it *did resolve* into the config for a core file — confirmed by an executed `node node_modules/eslint/bin/eslint.js --print-config packages/libs/editor-core/lib/kernel/registry.ts` this session. A bare `{ … }` object literal under an exported `const` is a direct child of the `VariableDeclarator`, so it matches.
**How to avoid:** `export const ContentUtils = Object.freeze({ … })` — the `ObjectExpression`'s parent becomes a `CallExpression`, so no match. The gate's own message names this remedy ("请改为 `Object.freeze(...)` / `as const`"). Verify no consumer assigns into `ContentUtils` (none found this session).
**Warning signs:** `coreModuleState: 真实树出现 1 条 error 级受限规则消息`.

### Pitfall 3: The gate's "no module-level instance" is narrower than it looks

**What goes wrong:** a reviewer assumes the gate forbids *any* module-level instance. It does not: `new Store(...)`, `new ResourceRegistry(...)`, or `createThing()` are **not** matched (only `Map|Set|WeakMap|WeakSet` and bare array/object literals are). A `export const registry = new ResourceRegistry()` in core would be green.
**Why it happens:** esquery matches node *kinds and shapes*, not "does this value contain mutable state" (Phase 3 Pitfall 1, re-confirmed here).
**How to avoid:** treat D-06 as a *convention* enforced by review + the shim/instance verifier (§Q6b), not by Block B alone; and keep the construct-then-export pattern out of `lib/**` by construction (the editor's app-instance module is the only `new` site).
**Warning signs:** a plan that claims "the gate guarantees no module-level instances in core".

### Pitfall 4: Block B does not ignore the new test directories

**What goes wrong:** core tests moved to `lib/resources/__tests__/**` and `lib/edit/__tests__/**` inherit the module-state selectors, so any module-level fixture table (e.g. `const reservedKeys = new Set([...])`) reds `pnpm lint` — contradicting D-22 ("tests are exempt").
**Why it happens:** `[VERIFIED: eslint.config.js:159]` →
```js
  ignores: ['packages/libs/editor-core/lib/kernel/core.ts', 'packages/libs/editor-core/lib/__tests__/**'],
```
Only `lib/__tests__/**` is exempt.
**How to avoid:** widen Block B's ignores to cover every core test tree (`packages/libs/editor-core/lib/**/__tests__/**` **and** `packages/libs/editor-core/lib/**/*.test.{ts,tsx}`), and extend `scripts/verify/coreModuleState.js`'s "exemption is real" probe (`firstTestFile()` currently scans only `lib/__tests__`) to sample one file from a new tree so the widened exemption is *proven*, not assumed. Block A (PORT-02) must keep covering test files — do not merge the two blocks (the flat-config array-rule overwrite hazard documented at `eslint.config.js:147-152`).
**Warning signs:** a moved test whose module-scope fixture table reds lint; a widened ignore that no verifier samples.

### Pitfall 5: A rule that matches *resolved* editor paths is vacuous

**What goes wrong:** `.dependencyCruiser.cjs:53-66` is retargeted to `packages/apps/editor/src/...projectData.ts` and appears to guard something. It guards nothing: dependency-cruiser running with this repo's config **does not resolve the `@/` alias**, so the edges it would need to match are `(unresolved)` and keep their raw specifier. Measured this session:
```text
projectModel deps: ["./blocklyModels","./passability","./statusBarModel","./tableModels",
  "./tilesetCatalog","@/blockly/diagnostics/asyncDiagnostics(unresolved)","@/fs/ContentUtils(unresolved)",
  "@/project/assets(unresolved)","@/project/data/projectData(unresolved)","@/project/resources(unresolved)"]
```
**Why it happens:** `.dependencyCruiser.cjs` deliberately sets no `options.tsConfig` (Phase 2 Pitfall 6: a blanket resolvability requirement reds on `@styled-system/*`), so `bundler`-style `@/` aliases are invisible.
**How to avoid:** match the **raw import specifier** in `to.path` (proven this session: `to: { path: '@/project/data/projectData' }` produced 2 violations where the resolved-path pattern produced 0), and be explicit in the rule comment that the editor half is dormant until the cruise target includes it. See §Q6a for the shape.
**Warning signs:** a retargeted rule whose `to.path` contains `^packages/apps/editor/src/`; a synthetic two-polarity fixture that "passes" because the rule is inert.

### Pitfall 6: `FileHandler`'s changed constructor silently invalidates 6 editor-side call sites + 23 in the moving test

**What goes wrong:** `new FileHandler(path, fsOrEncoding)` compiles in the editor's tests (they are outside `tsconfig.app.json`'s `include` and are only transpiled by Vite), so a stale call site fails at **runtime**, not at typecheck.
**Why it happens:** `[VERIFIED: packages/apps/editor/tsconfig.app.json]` `exclude: ["src/**/*.test.ts", "src/**/*.test.tsx", "src/**/__tests__/**", "test"]` — every test file is outside the typed program.
**How to avoid:** enumerate and update every site (§Q1/Q10). Note that two of them are already latent bugs: `test/utils/testHelpers.ts:24` passes a `FileEncoding` string where the second parameter is `Fs` (it has **no callers** — `createTestFileHandler` is dead code), and `test/utils/sampleProject.ts:68,74` plus four `__tests__` files inject handlers by poking `(handler as any).fs`.
**Warning signs:** a green `pnpm typecheck` followed by a red `unit` job.

### Pitfall 7: `es-toolkit` version float on the required `pnpm install`

**What goes wrong:** adding core's `es-toolkit` dependency through `catalog:default` (`^1.43.0`) lets a fresh install resolve past the version this repo is baselined against; the seam rates the latest publish `too-new`.
**Why it happens:** the catalog pins a caret range, and a lockfile regeneration is unavoidable this phase (new `dependencies` edges).
**How to avoid:** pin the catalog entry to the exact installed version (`es-toolkit: 1.44.0`) or declare core's dependency exactly; after `pnpm install`, assert the resolved version is unchanged and that the lockfile diff contains only the expected additions. Route the install through the mandated proxy.
**Warning signs:** `pnpm-lock.yaml` showing an `es-toolkit` version bump; an unexplained second `es-toolkit@1.4x` entry.

### Pitfall 8: `export *` on the singleton shims creates a class/instance name collision

**What goes wrong:** `src/fs/FileHandlerManager.ts` doing `export * from '@motajs/editor-core'` re-exports the core **class** `FileHandlerManager`, then `export { FileHandlerManager } from '<app-instance module>'` exports the **instance** with the same name. ESM gives the explicit export precedence, but the intent is unreadable and some tool configurations report a duplicate-export diagnostic.
**Why it happens:** D-10 phrases shims as `export * from core`.
**How to avoid:** use explicit named re-exports for every shim (Pattern 4). The `FileHandlerManager` shim exports the instance only — editor code has no need for the class.
**Warning signs:** a shim containing both `export *` and an explicit same-name export.

### Pitfall 9: `@test/*` imports in core turn the `lint` job red

**What goes wrong:** a moved test keeps `import { MemoryFileSystem } from '@test/utils/MemoryFileSystem'` and `pnpm lint` fails with `coreBoundaries: core 出现非 @styled-system 的未解析说明符`.
**Why it happens:** `[VERIFIED: scripts/verify/coreBoundaries.js:190-196]` fails on any unresolved non-`@styled-system` specifier; `@test/*` is declared **only** in the editor's test host — `[VERIFIED: packages/apps/editor/vitest.config.ts:17-22]` →
```ts
  resolve: {
    alias: {
      '@test': path.resolve(import.meta.dirname, 'test'),
```
and in `packages/apps/editor/tsconfig.app.json`'s `paths`; core's `vitest.config.ts` declares no such alias `[VERIFIED: packages/libs/editor-core/vitest.config.ts:15-23]`.
**How to avoid:** rewrite every moved test to core-local helpers (§Q5), which is exactly D-14's intent.
**Warning signs:** `@test/` surviving in any `packages/libs/editor-core/**` file.

### Pitfall 10: `DIAGNOSTIC_CODES` exactness breaks the moment a resource diagnostic is added

**What goes wrong:** `ResourceRegistry` (or a new failure path) emits a new machine code, and `pnpm test` reds on an unrelated-looking assertion.
**Why it happens:** `[VERIFIED: packages/libs/editor-core/lib/__tests__/coreApiSurface.test.ts:43-51]` asserts the table equals exactly five keys.
**How to avoid:** either keep the new registry free of `DiagnosticBus` coupling in Phase 4, or update that test in the same commit as the code addition (a two-line contract change, like Phase 3's `subpathStatus.json` Pitfall 8).
**Warning signs:** a new `code:` string literal anywhere in `lib/**` without a matching test edit.

### Pitfall 11: `subpathStatus.json` and `coreExports.js` are a two-file contract for `.`

**What goes wrong:** `lib/index.ts` grows the resources/edit surface, but `subpathStatus.json` still records `"." : { "content": "kernel-exports" }` while `scripts/verify/coreExports.js`'s `SUBPATH_CONTENT['.']` still asserts `'kernel-exports'`. The gate stays green while the record is false — Phase 3's Pitfall 8 recurring.
**Why it happens:** `[VERIFIED: .planning/phases/02-package-boundary-build-scaffolding/subpathStatus.json:6-10]` and `[VERIFIED: scripts/verify/coreExports.js:77-81]` are cross-checked only for *equality to a hard-coded constant*.
**How to avoid:** update both files in one commit with a truthful value (e.g. `"content": "kernel+resources+edit-exports"`) and say so in the plan. Do **not** add a subpath (D-09 / `EXPECTED_SUBPATHS`).
**Warning signs:** a plan that edits `lib/index.ts` and neither file.

### Pitfall 12: Adding `@tanstack/*` as a peer breaks `coreExports.js`

**What goes wrong:** declaring the two TanStack packages as `peerDependencies` (which looks natural — they are runtime peers of the React layer) fails the `typecheck` job.
**Why it happens:** `[VERIFIED: scripts/verify/coreExports.js:49-59, 213-225]` asserts `peerDependencies` is **exactly** the nine PKG-02 names and that `peerDependenciesMeta` is exactly `['@douyinfe/semi-ui']`.
**How to avoid:** `dependencies` only (Phase-2 D-02: "其余一律普通 `dependencies`").
**Warning signs:** `coreExports: peerDependencies 应为九个 … 实际是 [十一]`.

### Pitfall 13: `AGENTS.md` process rules (binding)

**What goes wrong:** names land in code before confirmation; plans execute without a briefing; class methods are described as bare names.
**How to avoid:**
  - **Per-plan briefing gate:** before executing *any* plan (including under `--auto`), report plan id + goal, what it will do and what problem it solves, and how completion is verified — then **wait for explicit approval**. Per plan, in execution order; never batch.
  - **Per-plan completion report:** report (① what the finished plan actually did — outcomes, exact verify-command results, deviations, commit hashes) **and** (② the next plan's id/goal/tasks/problem/verification), then wait for approval. Never chain silently.
  - **Naming confirmation before landing:** every important name (file / interface / method / function / type / package / exported symbol) must be reported in `.planning/phases/04-resource-edit-layers-moved/INTERFACE-NAME.md`, one section per plan, each entry stating what the thing is for, and confirmed by the user before it is written into code, plans, or config. Function-body locals are exempt.
  - **`ClassName.methodName`:** any class method mentioned in chat/plans/CONTEXT/INTERFACE-NAME/comments must be written as `ClassName.methodName` (e.g. `OperationHistory.registerUndoSystem`), never bare. Free functions stay bare.
  - **Questions must be preceded by a detailed problem description**; **questions are answer-only**; **direction is the user's call**.
  - **Network commands go through `http://127.0.0.1:7890`.**
**Warning signs:** a plan file containing unconfirmed exported names; a method referred to as `registerUndoSystem`.

---
## Question-by-Question Findings

### Q1 — Per-instance injection chain

**The exact import that must disappear.** `[VERIFIED: packages/apps/editor/src/fs/FileHandler.ts:8]` →
```ts
import { persistenceMonitor } from './PersistenceMonitor';
```
It is used at three sites inside `FileHandler`, all of which become `this.persistenceMonitor`:
- `[VERIFIED: packages/apps/editor/src/fs/FileHandler.ts:74-77]` `persistenceMonitor.schedule(path, { kind: 'write', execute: () => fs.promises.writeFile(path, value, 'utf-8') })`
- `[VERIFIED: packages/apps/editor/src/fs/FileHandler.ts:89]` `return persistenceMonitor.statusFor(this.path) === 'persisting';`
- `[VERIFIED: packages/apps/editor/src/fs/FileHandler.ts:98-107]` the delete intent (`kind: 'delete'`, swallowing `isFileNotFoundError`).

**The old default that must disappear.** `[VERIFIED: packages/apps/editor/src/fs/FileHandler.ts:18]` →
```ts
  constructor(path: string, fs: Fs = defaultFs) {
```
`defaultFs` comes from `[VERIFIED: packages/apps/editor/src/fs/FileHandler.ts:4]` `import { fs as defaultFs, type Fs } from '@/services/fs';`. Both the default and the nested `Fs` type are forbidden in core (D-05/PORT-02).

**Design (recommended).** A single `FileHandlerDependencies { fs: FsPort; persistenceMonitor: PersistenceMonitor }` type, used by **both** `FileHandler` and `FileHandlerManager` so the pair can never be passed in the wrong order. `FileHandlerManager` constructs handlers: `new FileHandler(path, this.deps)`. Field name `fs` is **kept** (holding an `FsPort`) to minimise test churn — the core tests only have to change the *value* they assign, not the field they poke.

- `FileHandlerManager.exists()` — `[VERIFIED: packages/apps/editor/src/fs/FileHandlerManager.ts:100-112]` reads `await fs.promises.readFile(path, 'utf-8')` from the module import; becomes `await this.deps.fs.readFile(path, 'utf-8')`. Its first branch (content-status short-circuit) is unchanged.
- `PersistenceMonitor` needs **no** injection (it is a dependency-free class); only its trailing `new` is removed.
- `PersistExecutor` needs **no** injection.
- `BinaryFileHandler` — `[VERIFIED: packages/apps/editor/src/fs/BinaryFileHandler.ts:21]` `constructor(path: string, fs?: Fs)` with `[VERIFIED: …:25]` `this.fs = fs || defaultFs;` → `constructor(path: string, fs: FsPort)` (no default, D-12). It has **zero production construction sites** this session (`new BinaryFileHandler(` appears nowhere outside its own file); only moved tests would exercise it.

**Why the editor needs one shared instance module (not one per shim).** The same `persistenceMonitor` object must be observed by four different access paths:
| Access path | Evidence |
|---|---|
| injected into every `FileHandler` created by the manager | §Pattern 1 |
| `DataResource.persistStatus()` | `[VERIFIED: packages/apps/editor/src/project/data/DataResource.ts:124-131]` `const status = persistenceMonitor.statusFor(this.path); … persistenceMonitor.errorFor(this.path)` |
| UI + draft guard | `src/components/PersistenceNotification.tsx:3`, `src/Workbench/AppTopBar.tsx:19`, `src/Workbench/LocPanel/index.tsx:29` |
| ~10 test files calling `whenQuiescent` / `failedFiles` / `resetForTests` | `rg` count in §Q10 evidence |

**How ~78 production importers keep working.** They import the *old paths*; every old path becomes a shim (Pattern 4). Nothing in `src/` changes except the new instance module, the new `viewportOperations` file, and the shims themselves.

**How the fixture `sampleProject.ts:50` keeps working.** `[VERIFIED: packages/apps/editor/test/utils/sampleProject.ts:49-51]` →
```ts
function injectHandler(filePath: string, handler: FileHandler): void {
  (FileHandlerManager as unknown as FileHandlerManagerInternals).handlers.set(filePath, handler);
}
```
`FileHandlerManager.handlers` is a TS `private` field, which is **erased at runtime** — the cast still reaches the same `Map` on the editor instance. Three adaptations are required in that fixture and three sibling tests:
1. construct core handlers with the new deps: `new FileHandler(filePath, { fs: fs, persistenceMonitor })` where `fs` is the flat port (`memoryFs` itself, not `memoryFs.createFsInterface()`), and `persistenceMonitor` is the editor instance imported from `@/fs/PersistenceMonitor`;
2. drop the `(handler as any).fs = memoryFs.createFsInterface()` pokes (the flat port now comes from the constructor);
3. the same edit pattern at `[VERIFIED: …src/services/tower/__tests__/towerService.test.ts:66]`, `[VERIFIED: …src/project/commands/__tests__/floorCommands.test.ts:60]`, `[VERIFIED: …src/services/tableMeta/__tests__/tableMetaService.test.ts:43]`.

**Evidence for the "~40 importers" estimate being low.** A scripted scan of `packages/apps/editor/src` this session found **78 production files** and **19 test files** importing at least one of `@/fs/*`, `@/fs`, `@/project/history`, `@/project/resources`, `@/utils/action`, `@/utils/fieldPath`, `@/utils/base/signal` (per-prefix import-site counts: `@/fs/` 128, `@/project/history` 14, `@/utils/action` 29, `@/utils/fieldPath` 13, `@/utils/base/signal` 10, `@/project/resources` 5, `@/fs` 8). The shim surface is therefore the phase's largest blast-radius control.

### Q2 — History split + the `UndoSystem` seam

**What moves vs what stays.** Based on a full read of `src/project/history/*` this session:

| Symbol | Today | Phase 4 |
|---|---|---|
| `OperationMeta`, `OperationTarget`, `AppliedOperation<T>`, `EditorOperation<T>` | `operations.ts:6-28` | move → `lib/edit/operations.ts` verbatim |
| `CompositeOperation` (class, module-private) + `compositeOperation` | `operations.ts:46-97, 134-139` | move verbatim |
| `ResourcePatchOperation` (class, module-private) | `operations.ts:99-124` | move, **rebuilt on `PatchableResource<T>`** |
| `patchResourceOperation` | `operations.ts:126-132` | move, signature `(resource: PatchableResource<T>, actions, meta)` |
| `operationPathTarget` | `operations.ts:141-148` | move verbatim |
| `dataResourceTarget` (module-private) | `operations.ts:30-44` | move, still module-private, narrowed to `PatchableResource<T>` |
| `RestoreViewportOperation`, `NavigateFloorOperation`, `navigateFloorOperation` | `operations.ts:150-204` | **stay** in editor (D-02) → new `src/project/history/viewportOperations.ts` |
| `viewport.ts` (all of it, incl. `let provider`) | `viewport.ts:38` | **stays** (D-02) |
| `commandOperations.ts` (`executePatchCommand`/`executeCompositeCommand`) | — | **stays** (D-04: depends on editor `CommandResult`) |
| `materialOperations.ts` | — | **stays** (D-02) |
| `textFileOperations.ts` | — | **stays**, unchanged (imports only `@/fs/FileHandlerManager` + `./operations`) |
| `operationHistory.ts` internals (`uniqueTargets`, `captureTargets`, `restoreTargets`, capacity 100, the pending/queue machinery) | `operationHistory.ts:40-185` | move verbatim; only the viewport coupling and the store's location change |

**The concrete `UndoSystem` replacement.** Today (all `[VERIFIED: packages/apps/editor/src/project/history/operationHistory.ts]`):

| Current line | Current behaviour | Replacement |
|---|---|---|
| `:34-38` | module-level `const historyStore = new Store<OperationHistoryState>({…})` | `private readonly store = new Store<OperationHistoryState>({…})` on the instance (D-11) |
| `:17-18` | `beforeViewport: EditorViewport \| null; afterViewport: EditorViewport \| null;` on `HistoryEntryInternal` | `systemsBefore / systemsAfter: readonly { id: string; snapshot: unknown }[]` |
| `:94` + `:105` | `applyWithCheckpoint(operation, rollbackViewport)` → `restoreEditorViewport(rollbackViewport)` | `applyWithCheckpoint(operation, rollbackSystems)` → `restoreSystems(reverse)` |
| `:117` | `const invokedViewport = captureEditorViewport();` (sync, at invocation) | `const invokedSystems = captureSystems();` (sync, at invocation) |
| `:119-123` | `beforeViewport = invokedViewport ?? captureEditorViewport();` … `afterViewport = captureEditorViewport();` | same shape over `captureSystems()` |
| `:149-151` | `applyWithCheckpoint(entry.operation, rollbackViewport, () => restoreEditorViewport(entry.beforeViewport))` | `…, () => restoreSystems(entry.systemsBefore)` |
| `:167-169` | redo restores `entry.afterViewport` | restores `entry.systemsAfter` |

`OperationHistory` gains a per-instance `registerUndoSystem(system: UndoSystem): () => void` (returns a disposer, mirroring `EditorCore.registerCapability`'s result shape — `[VERIFIED: packages/libs/editor-core/lib/kernel/core.ts:164-170]`). Registration order defines restore order; restores run in **reverse** registration order, after `restoreTargets` (matching today's `restoreTargets` → `restoreEditorViewport` sequence).

**The Phase-1 characterization test `operationHistory.invariants.test.ts` — exactly what it asserts** (all read this session; the first nine are pure-in-memory, the last block needs the submodule):

1. **capacity 100** — 101 commits, exactly 100 successful undos, the 101st a no-op, the evicted oldest commit's effect never undone (`value === 1`).
2. **inverse on undo, re-applied on redo** — `counterOperation(5)`; `5 → 0 → 5 → 0`.
3. **redo-tail truncation** — commit, undo, commit `+10`, redo → `10`.
4. **no-change commit records nothing** — an `apply()` returning `changed: false` produces no undoable entry.
5. **distinct targets captured once, de-duplicated by key** — captures `{a:1,b:1}`, restores `{b:1,a:1}` (reverse).
6. **restore order is the exact reverse of capture order** — asserted as the literal log `'capture:a|capture:b|capture:c|restore:c|restore:b|restore:a'`.
7. **failed apply leaves every target at its pre-apply value and records no entry.**
8. **successful commit captures the target once; a successful apply performs no restore; undo applies the stored inverse.**
9. **composite failure recovers completed children via their semantic inverses and tags the failing stage** — `rejects.toMatchObject({ commandStage: 'composite-child' })`.
10. *(separate `describe`, submodule-coupled, stays in editor)* **resource reactivity** — a history-routed `patchFloor` is observable on the resource in the same microtask chain and reverts on `undo()`; a direct `resource.set` is likewise memory-first.

**Verdict: the nine pure tests remain green** under the `UndoSystem` design as long as (a) target capture/de-dup/reverse-restore ordering is untouched (moves verbatim), and (b) capacity/entry semantics are untouched. They register **no** `UndoSystem`, so `systemsBefore/After` are `[]` and every restore is a no-op — the assertions never observe the new machinery. The tests' *setup* changes (a fresh `OperationHistory` instance per `beforeEach` instead of the module singleton) but no assertion changes. The one *assertion-adjacent* risk is test 6's literal log string: it is emitted by `OperationTarget.capture`/`restore`, which the design does not touch.

**The submodule-coupled `operationHistory.test.ts` (stays in editor) is the real constraint.** `[VERIFIED: packages/apps/editor/src/project/history/__tests__/operationHistory.test.ts:55-71]`:
```ts
    expect(await tableCommands.patchFloor('sample0', [['change', "['title']", 'History title']])).toEqual({ ok: true });
    …
    currentViewport = viewport('sample1');
    await operationHistory.undo();
    expect(projectData.floor('sample0').value().title).toBe(originalTitle);
    expect(currentViewport.floorId).toBe('sample0');
```
It asserts that a **data** operation's undo also restores the viewport → the capture-all requirement stated in Finding 5. `:73-90` and `:92-121` add: undo works while a write is pending; a failed apply restores the temporary checkpoint (targets) and a following `undo()` is a no-op.

### Q3 — `PatchableResource` compatibility

`DataResource<T>` is declared at `[VERIFIED: packages/apps/editor/src/project/data/DataResource.ts:17-29]`:
```ts
export interface DataResource<T> extends RecoverableResource<T>, LoadableResource<T> {
  readonly id: string;
  readonly path: string;

  snapshot(): Content<T>;
  value(): T;
  raw(): IContentHandler<string>;
  reload(): Promise<void>;
  set(next: T): Promise<void>;
  mutate(recipe: (draft: T) => void): Promise<void>;
  patch(actions: Action[]): Promise<void>;
  persistStatus(): PersistStatus;
}
```
The narrow contract core needs is exactly three members of that:
```ts
// packages/libs/editor-core/lib/edit/operations.ts  (candidate shape)
import type { Content } from '../resources/types';
import type { IContentHandler } from '../resources/interfaces';

export interface PatchableResource<T> {
  readonly path: string;
  raw(): IContentHandler<string>;
  mutate(recipe: (draft: T) => void): Promise<void>;
}
```
**Structural satisfaction: yes, with no change to `DataResource.ts`.** `IContentHandler<string>` `[VERIFIED: packages/apps/editor/src/fs/interfaces.ts:44-55]` provides `update(value: string): void` (plus two overloads) and `getContent(): Content<string>`; `mutate(recipe: (draft: T) => void): Promise<void>` matches exactly; `readonly path: string` matches.

**What `dataResourceTarget` needs** — `[VERIFIED: packages/apps/editor/src/project/history/operations.ts:30-44]`:
```ts
function dataResourceTarget<T>(resource: DataResource<T>): OperationTarget {
  const raw = resource.raw();
  return {
    key: `text:${resource.path}`,
    path: resource.path,
    capture: () => raw.getContent(),
    restore: async (checkpoint) => {
      const content = checkpoint as Content<string>;
      if (content.status !== 'loaded') {
        throw new Error(`Cannot restore ${resource.path} from ${content.status}`);
      }
      await Promise.resolve(raw.update(content.value));
    },
  };
}
```
It touches only `resource.path`, `resource.raw()`, `raw.getContent()`, `raw.update(...)`, plus the `Content<string>` type for the checkpoint cast. All three are in the narrow interface; the only edit is the parameter type (`DataResource<T>` → `PatchableResource<T>`) and replacing the `@/fs/types` import with `../resources/types`.

**What `patchResourceOperation` needs** — `[VERIFIED: …operations.ts:99-132]`: `resource.mutate((draft) => { inverseActions = applyActionsWithInverse(draft as Record<string, unknown>, this.actions as Action[]); })`. With `PatchableResource<T>.mutate(recipe: (draft: T) => void)` this is identical. Its return type stays `EditorOperation` and the inverse is another `ResourcePatchOperation` over the same resource.

**Downstream compile check (no edits needed):** `[VERIFIED: …src/project/history/commandOperations.ts:32]` calls `operationHistory.execute(patchResourceOperation(resource, actions, options))` with a `DataResource<T>`; structural assignment succeeds against `PatchableResource<T>`.

### Q4 — Dependencies & catalog

**Catalog state (read in full this session).** `pnpm-workspace.yaml`'s `catalog:` block contains `ts-pattern: ^5.9.0` and `es-toolkit: ^1.43.0`, and contains **no** `@tanstack/store` / `@tanstack/react-store` entry (the block was read end-to-end; corroborated by `packages/apps/editor/package.json:25-27` pinning all three directly at `5.90.20`/`0.8.0`/`0.8.0`, and by `pnpm-lock.yaml` resolving `@tanstack/store@0.8.0`, `@tanstack/react-store@0.8.0`, `es-toolkit@1.44.0`, `ts-pattern@5.9.0`).

`[VERIFIED: pnpm-workspace.yaml:55]` → `  ts-pattern: ^5.9.0`
`[VERIFIED: pnpm-workspace.yaml:31]` → `  es-toolkit: ^1.43.0`
`[VERIFIED: packages/apps/editor/package.json:25-27]` →
```json
    "@tanstack/react-query": "5.90.20",
    "@tanstack/react-store": "0.8.0",
    "@tanstack/store": "0.8.0",
```

**Where each dependency goes in `packages/libs/editor-core/package.json`:**

| Package | Section | Written as | Why |
|---|---|---|---|
| `ts-pattern` | `dependencies` | `catalog:default` | consumed by `lib/resources/ContentUtils.ts`; not one of PKG-02's nine peers |
| `@tanstack/store` | `dependencies` | `catalog:default` (new catalog entry, pinned `0.8.0`) | consumed by `lib/edit/operationHistory.ts` on root `.` |
| `@tanstack/react-store` | `dependencies` | `catalog:default` (new catalog entry, pinned `0.8.0`) | consumed only by `lib/react/index.ts` (D-11) — the dependency *may* live on the manifest, but the **import** must appear nowhere outside `./react` |
| `es-toolkit` | `dependencies` | `catalog:default` **or** exact `1.44.0` | consumed by `lib/edit/{action,fieldPath}.ts`; see the float hazard in Pitfall 7 |

**Not peers.** `[VERIFIED: scripts/verify/coreExports.js:49-59, 213-232]` asserts the peer set is exactly nine and all are `catalog:default`, and that `peerDependenciesMeta` is exactly `{ '@douyinfe/semi-ui': { optional: true } }`. Adding a tenth peer fails the `typecheck` job; `dependencies` are unasserted, so they are the correct home. Also note `scripts/verify/coreBoundaries.js:47-49, 291-299` forbids only `@motajs/editor`/`@motajs/service-worker` in the manifest's three dependency sections — adding these four is safe.

**Two new catalog entries are required** (`@tanstack/store: 0.8.0`, `@tanstack/react-store: 0.8.0`), because `catalog:default` only resolves when the catalog defines the name (`[VERIFIED: scripts/verify/coreExports.js:243-245]` asserts that for peers; the same resolution rule applies to any `catalog:` reference). This is exactly the Phase-2 D-19 "catalog gap" pattern.

**`waitUntil`'s home.** `[VERIFIED: packages/apps/editor/src/utils/base/signal.ts:1-34]` contains **only** `waitUntil`. It is used by six moving files (`FileHandler.ts:5`, `PersistExecutor.ts:10`, `DataHandler.ts:17`, `BinaryFileHandler.ts:10`, `project/resources.ts:6`, and the moving `resources.test.ts:7`) and by three files that **stay** (`project/assets/ImageAssetResource.ts:8`, `project/assets/AssetDirectoryResource.ts:7`, `project/assets/MaterialCollectionResource.ts:7`, `services/editorConfig/editorConfigService.ts:14`). Recommendation: put it at **`lib/resources/waitUntil.ts`** (keeps the new directory count at two per D-09, and it is a resource-layer timing primitive) and turn `src/utils/base/signal.ts` into a one-line shim `export { waitUntil } from '@motajs/editor-core';`. The alternative — a `lib/signals/` directory — is equally valid but adds a third new internal dir; record the choice in `INTERFACE-NAME.md`.

**`ContentUtils.ts` imports nothing else.** `[VERIFIED: packages/apps/editor/src/fs/ContentUtils.ts:7-8]` is exactly `import { match } from 'ts-pattern';` + `import type { Content } from './types';`. No other dependency is needed.

### Q5 — Test hosting

**Can core's `vitest.config.ts` run the moved tests?** Yes, with rewrites. `[VERIFIED: packages/libs/editor-core/vitest.config.ts:6-23]`: `include: ['lib/**/*.test.{ts,tsx}']` (covers the new `__tests__` trees), `environment: 'jsdom'` globally, `@vitejs/plugin-react` + react-compiler, `resolvePlugin`, and the `@styled-system` alias. It declares **no** `@test/*` alias — decisive for classification. Per-file `// @vitest-environment node` is available for pure tests (Phase-3 Pitfall 11 precedent).

**Classification (evidence = the file's actual imports, read this session):**

| File | Class | Evidence / required rewrite |
|---|---|---|
| `src/fs/__tests__/errors.test.ts` | **pure → core** | imports only `vitest` + `../errors`. Rewrite: `../errors` → `../errors` (same relative name in `lib/resources/__tests__/`). |
| `src/fs/__tests__/PersistenceMonitor.test.ts` | **pure → core**, needs local `wait` | imports `../PersistenceMonitor` + `@test/utils/testHelpers` (`wait`) + `alien-signals`. Rewrite: add a core-local `wait` (2 lines) or inline `setTimeout`; drop the `@test/*` import. Already constructs `new PersistenceMonitor()` per test → no instance change. |
| `src/fs/__tests__/PersistExecutor.test.ts` | **pure → core**, needs local `wait` | imports `../PersistExecutor` + `@test/utils/testHelpers` + `alien-signals`. Same rewrite. |
| `src/fs/__tests__/persistExecutor.invariants.test.ts` | **pure → core**, needs local `wait` | imports `../PersistExecutor` + `@test/utils/testHelpers`. Same rewrite. |
| `src/fs/__tests__/persistenceMonitor.invariants.test.ts` | **pure → core**, needs local `wait` | imports `../PersistenceMonitor` + `@test/utils/testHelpers`. Same rewrite. |
| `src/fs/__tests__/FileHandler.test.ts` | **`@test/utils`-coupled → core after replacing the double** | imports `../FileHandler`, `../ContentUtils`, `@test/utils/MemoryFileSystem`, `@test/utils/testHelpers`, `../PersistenceMonitor` (the module singleton). Rewrites: (a) `MemoryFileSystem` → the core flat `FsPort` double (D-14); (b) `persistenceMonitor` singleton → a per-test `new PersistenceMonitor()` passed through `FileHandlerDependencies`; (c) **all 23** `new FileHandler(path, memoryFs.createFsInterface())` → `new FileHandler(path, { fs: memoryFs, persistenceMonitor })`; (d) `(handler as any).fs = failingFs` keeps working because the field name is retained, but the value becomes a flat port. Assertions unchanged. |
| `src/fs/__tests__/FileHandlerManager.test.ts` | **`@test/utils`-coupled → core after replacing the double** | imports `../FileHandlerManager` (singleton), `@test/utils/*`, `../PersistenceMonitor`. Rewrites: construct `new FileHandlerManager({ fs: memoryFs, persistenceMonitor })` per test; the four `(handler as any).fs = memoryFs.createFsInterface()` pokes become constructor deps; `(FileHandlerManager as any).handlers` still resolves (private field, runtime-visible). Assertions unchanged. |
| `src/fs/__tests__/persistNoRollback.invariants.test.ts` | **submodule-coupled → STAYS in editor** | imports `@/fs/FileHandlerManager`, `@/fs/PersistenceMonitor`, `@/project/commands/tableCommands`, `@/project/data/projectData`, `@test/utils/sampleProject`. All via shims → zero changes. |
| `src/project/history/__tests__/operationHistory.test.ts` | **submodule-coupled → STAYS in editor** | imports `@/fs/*`, `@/project/*`, `../operationHistory`, `../operations`, `../viewport`, `@test/utils/sampleProject`. Zero changes (uses shims), and it is the test that *pins* the capture-all behaviour (§Q2). |
| `src/project/history/__tests__/operationHistory.invariants.test.ts` | **SPLIT** | `describe('operationHistory invariants')` (9 pure tests) → `lib/edit/__tests__/`, with `operationHistory` changed from the module singleton to a per-test `new OperationHistory()`; `describe('operationHistory resource reactivity')` (2 submodule tests) → stays in editor (new file, e.g. `operationHistory.reactivity.invariants.test.ts`) using the shim. |
| `src/project/__tests__/resources.test.ts` | **pure → core** | imports `@/fs/interfaces`, `@/fs/types`, `@/project/resources`, `@/utils/base/signal`. Rewrites: aliases → relative core paths (`../../resources/interfaces`, `../../resources/types`, `../combinators`, `../../resources/waitUntil`). Assertions unchanged. |
| `src/utils/__tests__/fieldPath.test.ts`, `fieldPath.property.test.ts`, `action.property.test.ts` | **pure, RECOMMEND keeping in editor** | They import only `@/utils/fieldPath` / `@/utils/action` (shims) + `vitest` + `fast-check`. Through the shims they already exercise core's implementation, and moving them would add `fast-check` to core's devDependencies for no extra coverage. Decision + rationale belong in `INTERFACE-NAME.md`/the plan. |

**Alias/import rewrites that are mandatory (not optional):**
- `@test/*` → core-local helpers, in **5** moving test files — otherwise `coreBoundaries.js` reds the `lint` job (Pitfall 9).
- `@/fs/*`, `@/project/resources`, `@/utils/base/signal` → relative paths inside the moved files.
- Every moved file must use extensionless relative imports (`../resources/types`, not `@/resources/types`) — Phase-2 D-06 / Phase-3 Pitfall 9.

---
### Q6 — Gate updates

#### (a) The `requireZero` retarget — exact shape

Current rule `[VERIFIED: .dependencyCruiser.cjs:53-66]`:
```js
    {
      name: 'core-singletons-only-imported-by-composition-root',
      comment:
        'D-16 requireZero：core 的 6 个模块级 singleton 只允许 composition root（lib/kernel/core.ts）导入。' +
        '当前 core 尚无 singleton，规则天然通过（空集，D-17），Phase 3 引入后自动生效。' + …,
      severity: 'error',
      from: { pathNot: '^packages/libs/editor-core/lib/kernel/core\\.ts$' },
      to: {
        path:
          '^packages/libs/editor-core/lib/(kernel|services)/' +
          '(projectData|projectModel|operationHistory|FileHandlerManager|persistenceMonitor|editorConfigService)[^/]*\\.ts$',
      },
    },
```

**Measured constraints on any retarget** (both from this session's probes):
- dependency-cruiser **cannot** resolve `@/` in editor files → a `to.path` of `^packages/apps/editor/src/…\.(ts)$` matches **nothing** (probe: 0 violations with the resolved-path rule over a tree where `@/project/data/projectData` demonstrably exists as an edge).
- dependency-cruiser **does** apply rules to unresolved dependencies and matches the raw specifier (probe: `to: { path: '@/project/data/projectData' }` → 2 violations, from `projectModel.ts` and `tableModels.ts`).
- `coreBoundaries.js` cruises **only** `packages/libs/editor-core/lib` `[VERIFIED: scripts/verify/coreBoundaries.js:37-39, 112-120]`; adding the three editor roots to the cruise command was probed successfully (62 modules, **0** violations including `no-circular`), so widening the target is technically safe.
- A `forbidden` rule whose `from.pathNot` names a file that does not exist would flag **all** ~80 current importers → red on day one. Therefore the editor half is necessarily **dormant-by-target** until Phase 11 removes the direct imports.

Recommended shape (one rule, both halves, honest comment):

```js
    {
      name: 'singletons-only-imported-by-composition-root',
      comment:
        'requireZero（D-16/D-08）：模块级 singleton 只允许 composition root 导入。' +
        'core 半边：Phase 4 已把 FileHandlerManager / persistenceMonitor / operationHistory 去单例化并移入 ' +
        'lib/resources、lib/edit —— core 内部不再有任何模块级实例（由 eslint module-state 门禁 + ' +
        'scripts/verify/editorShims.js 的「唯一 new 点」断言共同保证），故本规则的 core 半边不再是主要守卫。' +
        'editor 半边：仍在 editor 的 3 个 singleton（projectData / projectModel / editorConfigService，Phase 5/11 处理）' +
        '按**导入说明符**匹配 —— 本仓实测 dependency-cruiser 不解析 `@/` 别名，按解析后路径写的规则是空转的（Pitfall 5）。' +
        'coreBoundaries.js 目前只 cruise core，故 editor 半边处于「已就位、待生效」：Phase 11 组合根建立并把 ' +
        'editor 根加入 cruise 目标后自动生效；本阶段由 scripts/verify/editorShims.js 承担真正可失败的守卫。',
      severity: 'error',
      from: { pathNot: '^packages/apps/editor/src/(appInstances|composition)\\.ts$' },
      to: {
        path:
          '^(?:@/project/data/projectData|@/project/model/projectModel|@/services/editorConfig' +
          '|\\.{1,2}/.*(?:projectData|projectModel|editorConfigService))$',
      },
    },
```

Notes for the planner:
- The `from` path is the **future** composition root / the Phase-4 app-instance module; the two names above are placeholders to be replaced by whatever `INTERFACE-NAME.md` confirms.
- Keep the rule **inside the existing `.dependencyCruiser.cjs`**, run by the existing `coreBoundaries.js` in the existing `lint` job. Do not add a job.
- If the plan chooses to also widen `coreBoundaries.js`'s cruise target to the three editor roots now (probed safe for `no-circular`), then the editor half must be made green by an explicit allow-list of today's ~80 importers — which is a large, ugly artifact. **Recommendation: do not widen now**; rely on the verifier in (b) for the Phase-4-real constraint, and keep the depcruise half documented as dormant.
- The raw specifier forms that exist today (scripted scan) are: `@/project/data/projectData` (48), `@/project/model/projectModel` (32), `@/services/editorConfig` (6), plus relative forms `./projectModel` (4), `./model/projectModel` (2), `./data/projectData` (1), `./services/editorConfig` (1), `./editorConfigService` (1). The regex above covers both families.

#### (b) The shim verifier — exact shape

**File:** `scripts/verify/editorShims.js`. **Job:** `lint` (it is a source-structure check with no typecheck/test requirement, matching `coreBoundaries.js` and `coreModuleState.js`; `ci-workflow.js` asserts *presence* of job scripts, so an extra `- run:` step is safe `[VERIFIED: scripts/verify/ci-workflow.js:30-39, 193-252]`).

Shape (same family as `coreModuleState.js`: ESM, Chinese header, `failures[]`, `process.exit(1)`, "全部断言通过" success line):

```js
// 1. Collect markers
const MARKER = '// SHIM(phase4)';
// scan packages/apps/editor/src/**/*.{ts,tsx} for the marker → markedFiles[]
// 2. Non-vacuity
//    check(markedFiles.length >= EXPECTED_SHIMS.length)
//    for every entry of EXPECTED_SHIMS: check(fs.existsSync(entry))
//    check(markedFiles set === EXPECTED_SHIMS set)      // a new shim must be registered deliberately,
//                                                       // and a deleted shim is noticed (Phase-11 inventory)
// 3. Forward-only
//    for each marked file: check(/^export\s+(type\s+)?[{(].*\sfrom\s+'…'|^export \* from '…'/m.test(source))
//    for each marked file: check(!/\bnew\s+[A-Z]/.test(source))        // shims must not construct
//    for each marked file: check(!/\b(class|function)\s/.test(source)) // shims must not implement
// 4. The one-new-point invariant (the actually-enforcing half of (a))
//    for each of ['new FileHandlerManager(', 'new PersistenceMonitor(', 'new OperationHistory(']:
//      offenders = markdown-free scan of packages/apps/editor/src/** excluding the app-instance module
//      check(offenders.length === 0)
// 5. Two-polarity (mandatory, Phase-2 lesson)
//    (i)  real tree → all of the above pass
//    (ii) write a synthetic fixture with the marker but no re-export → must produce ≥1 failure
//    (iii) write a synthetic fixture that calls new PersistenceMonitor( outside the app-instance module → must fail
//    both fixtures deleted in finally, then asserted absent
```

**Why (4) matters:** it is the only mechanically-checkable statement of the real Phase-4 constraint ("the adapter owns exactly one instance"), and it compensates for the depcruise rule's dormant half. Its two-polarity fixture is also the answer to "how do we prove the gate can fail".

#### Gate/edit inventory for this phase (all inside the existing 4 jobs)

| Edit | File | Job | Evidence it is needed |
|---|---|---|---|
| Remove the 6-singleton core pattern from `requireZero`; retarget to editor specifiers | `.dependencyCruiser.cjs:53-66` | `lint` | `[VERIFIED: .dependencyCruiser.cjs:53-66]` + probes |
| Add `resources/edit must not import capabilities` rule | `.dependencyCruiser.cjs` | `lint` | new real gap: `lib/resources`/`lib/edit` are not covered by the existing `kernel-must-not-import-capabilities` rule whose `from` is `^…/lib/(index\.ts|kernel/.*)$` `[VERIFIED: .dependencyCruiser.cjs:22-28]` |
| Widen Block B ignores to all core test trees | `eslint.config.js:159` | `lint` | `[VERIFIED: eslint.config.js:159]` |
| Add `node scripts/verify/editorShims.js` step | `.github/workflows/ci.yml` (`lint` job) | `lint` | `[VERIFIED: .github/workflows/ci.yml lint job: \`- run: node scripts/verify/coreBoundaries.js\` + \`coreModuleState.js\`]` |
| Sample a new test tree in the exemption probe | `scripts/verify/coreModuleState.js:244-253` | `lint` | `firstTestFile()` scans only `lib/__tests__` |
| Update `SUBPATH_CONTENT['.']` + `subpathStatus.json['.'].content` together | `scripts/verify/coreExports.js:77-81`, `subpathStatus.json:6-10` | `typecheck` | `[VERIFIED: scripts/verify/coreExports.js:77-81]`, `[VERIFIED: subpathStatus.json:6-10]` |
| Update `DIAGNOSTIC_CODES` expectation **iff** a new code is added | `lib/__tests__/coreApiSurface.test.ts:43-51` | `unit` | `[VERIFIED: …coreApiSurface.test.ts:43-51]` |

**No new job, no renamed job, no `secrets`, no `environment`, no `paths` filter** — `ci-workflow.js` enforces all of that.

### Q7 — RES-02 `ResourceRegistry` (the phase's explicit open item)

**What RES-02 means.** The name does not exist in source (confirmed by a repo-wide search this session: `ResourceRegistry` occurs only in planning/research documents). The requirement text is `[VERIFIED: .planning/REQUIREMENTS.md:33]` → `RES-02`: `` `ResourceRegistry` 支持通用逻辑 id 注册``, paired in the roadmap with the per-instance requirement `[VERIFIED: .planning/ROADMAP.md:145]` → "`ResourceRegistry` supports generic logical-id registration and `FileHandlerManager` is a per-instance service (no module singleton)". The design intent is already written down in the milestone research:
- `[VERIFIED: .planning/research/ARCHITECTURE.md:143]` → `│   │   ├── ResourceRegistry.ts     # NEW: generic id -> resource registration`
- `[VERIFIED: .planning/research/ARCHITECTURE.md:625]` → `  readonly resources: Pick<ResourceRegistry, "register" | "get" | "snapshot">;`
- `[VERIFIED: .planning/research/SUMMARY.md:153]` → "…`lib/resources/ResourceRegistry.ts` (new: generic logical-id registration)…"
- `[VERIFIED: .planning/research/ARCHITECTURE.md:360]` → `ResourceRegistry.runtime.get("mota.tower")   ← engine supplies the id`

So RES-02 is **new construction in Phase 4**, distinct from Phase 5's engine-side `ResourceDescriptor` (which supplies `id` + `path` + `format` + `handler` + `preload`).

**Recommendation (concrete):**

1. **Phase 4 delivers the registry class and its tests; it does NOT rewire `projectData`.** This mirrors Phase 2's D-17 precedent ("write the clause and enable it; it is naturally green while the set is empty") and honours CONTEXT's "`defineEngine`/`ResourceDescriptor`（Phase 5）不在本阶段范围". Rewiring `projectData`'s 11 lazy accessors now would change resource-creation timing and risk RES-05.
2. **Shape (candidate — confirm in `INTERFACE-NAME.md`):**
   ```ts
   // packages/libs/editor-core/lib/resources/ResourceRegistry.ts  (candidate)
   export interface ResourceRegistryEntry {
     readonly id: string;
     readonly resource: ResourceView<unknown>;
   }
   export class ResourceRegistry {
     register<T>(id: string, resource: ResourceView<T>): () => void;   // returns a disposer; duplicate id rejected
     get<T>(id: string): ResourceView<T> | undefined;
     getOrThrow<T>(id: string): ResourceView<T>;
     has(id: string): boolean;
     ids(): readonly string[];
     snapshot(): readonly ResourceRegistryEntry[];
   }
   ```
   Values are `ResourceView<T>` (from `lib/resources/combinators.ts` — the type already exists at `[VERIFIED: packages/apps/editor/src/project/resources.ts:8-14]`), not raw `DataHandler`s, because the callers Phase 5 needs (preview gateway, project model) consume `ResourceView`/`LoadableResource`.
3. **Keep it out of the `DiagnosticBus`.** Coupling it would demand new `DIAGNOSTIC_CODES` entries and red `coreApiSurface.test.ts:43-51` (Pitfall 10). A duplicate-id rejection can be a plain thrown `Error` documented on `register`, or a small local result object — decide in `INTERFACE-NAME.md`.
4. **Do not model it as a capability kind.** ARCHITECTURE's draft kind union does list `"resource"` `[VERIFIED: .planning/research/ARCHITECTURE.md:242]`, but Phase 3's D-01 draws the line explicitly: private service wiring must stay separate from the public capability registry. Resources are part of the private service graph.

**Residual risk to record as an assumption:** a registry with no production consumer in Phase 4 is an API that Phase 5 may want to reshape. The mitigation is that Phase 5 is the very next phase, and the roadmap criterion is only "supports generic logical-id registration" — which unit tests can satisfy honestly. If the user prefers zero speculative surface, the alternative is to descope RES-02 from Phase 4 and re-map the requirement to Phase 5 in `REQUIREMENTS.md` — but that changes the traceability table and needs explicit user sign-off.

### Q8 — `FsPort` adaptation

**Structural compatibility: confirmed.** `[VERIFIED: packages/apps/editor/src/services/fs/fs.ts:23-32]` and `[VERIFIED: packages/libs/editor-core/lib/ports/fs.ts:20-51]`:

| `FsPromiseApi` member | `FsPort` member | Match |
|---|---|---|
| `readFile(filename: string, encoding: FileEncoding): Promise<string>` | `readFile(path: string, encoding: 'utf-8' \| 'base64'): Promise<string>` | ✓ (param names differ; `FileEncoding = 'utf-8' \| 'base64'` `[VERIFIED: fs.ts:14]`) |
| `readFileBinary(filename: string): Promise<ArrayBuffer>` | `readFileBinary(path: string): Promise<ArrayBuffer>` | ✓ |
| `writeFile(filename, data, encoding): Promise<void>` | `writeFile(path, data, encoding): Promise<void>` | ✓ |
| *(absent)* | *(absent)* | `FsPort.writeMultiFiles` deliberately omitted — **no production caller** |
| `readdir` / `mkdir` / `moveFile` / `deleteFile` | same four | ✓ |
| **extra** `writeMultiFiles(filenames: string[], dataList: string[]): Promise<void>` | — | harmless (a superset satisfies a narrower interface; `coreExports`-style excess-property checking does not apply to a non-literal value) |

**No cast is needed** for `const fsPort: FsPort = fs.promises;`. A cast would *hide* the contract check and is not recommended.

**Every call site that changes:**

| # | Site (today) | Today's call | After |
|---|---|---|---|
| 1 | `[VERIFIED: packages/apps/editor/src/fs/FileHandler.ts:76]` | `fs.promises.writeFile(path, value, 'utf-8')` | `fs.writeFile(path, value, 'utf-8')` |
| 2 | `[VERIFIED: packages/apps/editor/src/fs/FileHandler.ts:102]` | `fs.promises.deleteFile(path)` | `fs.deleteFile(path)` |
| 3 | `[VERIFIED: packages/apps/editor/src/fs/FileHandler.ts:120]` | `fs.promises.readFile(this.path, 'utf-8')` | `this.fs.readFile(this.path, 'utf-8')` |
| 4 | `[VERIFIED: packages/apps/editor/src/fs/BinaryFileHandler.ts:65]` | `this.fs.promises.readFileBinary(this.path)` | `this.fs.readFileBinary(this.path)` |
| 5 | `[VERIFIED: packages/apps/editor/src/fs/FileHandlerManager.ts:107]` (inside `FileHandlerManager.exists()`) | `await fs.promises.readFile(path, 'utf-8')` | `await this.deps.fs.readFile(path, 'utf-8')` |
| 6 | construction sites (see §Q1): 6 editor-side sites (`test/utils/sampleProject.ts:68,74`, `test/utils/testHelpers.ts:24`, `src/project/commands/__tests__/floorCommands.test.ts:58`, `src/services/tableMeta/__tests__/tableMetaService.test.ts:38`, `src/services/tower/__tests__/towerService.test.ts:61`) + **23** inside the moving `src/fs/__tests__/FileHandler.test.ts` + 1 production site (`src/fs/FileHandlerManager.ts:32`) | `new FileHandler(path, fs)` / `new BinaryFileHandler(path, fs?)` | `new FileHandler(path, { fs, persistenceMonitor })` / `new BinaryFileHandler(path, fs)` |

**Sites that do NOT change** (they stay in editor and keep using the nested transport): `project/assets/ImageAssetResource.ts:65,113,127`, `project/assets/AssetDirectoryResource.ts:50`, `project/assets/MaterialCollectionResource.ts:245`, `project/settings/mapLayerSettings.ts:174`, `components/SchemaTable/schemaOverrideCommands.ts:233,244`. Note `[VERIFIED: packages/apps/editor/src/services/fs/fs.ts:121,124]` uses `window`/`console` in the editor's transport — that file stays in the editor, so PORT-02 is untouched.

### Q9 — `useOperationHistory` + `./react`

**Move shape.** `[VERIFIED: packages/apps/editor/src/project/history/operationHistory.ts:189-204]` currently closes over the module-level `historyStore` and takes no arguments:
```ts
export function useOperationHistory(): { entries: OperationHistoryEntry[]; current: number; busy: boolean } {
  return useStore(historyStore, (state) => ({ … }));
}
```
With the store on the instance (D-11), the hook must receive the instance. Recommended split:

- **core `lib/react/index.ts`** (candidate): `export function useOperationHistory(history: OperationHistory) { return useStore(history.store, selector); }`. `OperationHistory` is exported from root `.`; `lib/react` importing `../edit/operationHistory` is a legal internal relative edge (`react-and-shell-must-not-import-capabilities` only forbids the four capability dirs `[VERIFIED: .dependencyCruiser.cjs:29-35]`).
- **editor zero-arg wrapper** (new editor file, re-exported by `src/project/history/index.ts`): `export function useOperationHistory() { return useCoreUseOperationHistory(operationHistory); }`, so the two existing call sites stay untouched: `[VERIFIED: packages/apps/editor/src/Workbench/AppTopBar.tsx:22]` and `[VERIFIED: packages/apps/editor/src/Workbench/components/PanelSlot.tsx:21]` both do `import { operationHistory, useOperationHistory } from '@/project/history';`.
- **Exposing the store.** `useStore` needs a `Store` object, so the instance must surface it. Recommend a public `readonly store: Store<OperationHistoryState>` on `OperationHistory` (with `OperationHistoryState`'s public projection kept as the existing `OperationHistoryEntry`) rather than a bespoke subscribe/getState pair — the narrower alternative would change the hook's internals and is not needed for D-11. Name/visibility to confirm in `INTERFACE-NAME.md`.
- **`@tanstack/react-store` appears only in `lib/react/index.ts`.** `@tanstack/store` appears only in `lib/edit/operationHistory.ts`. A future grep-based check could assert this (cheap, optional).
- **`./react`'s existing probe is untouched.** `[VERIFIED: packages/libs/editor-core/lib/react/index.ts:1]` → `export { CoreProbe } from './CoreProbe';`. Keep it (Phase 11 removes it) so `[VERIFIED: scripts/verify/coreBoundaries.js:42-45, 278-286]`'s `editor→core` edge assertion (`App.tsx` contains `@motajs/editor-core/react`) keeps holding `[VERIFIED: packages/apps/editor/src/App.tsx:12]`.

**React Compiler / `@tanstack/react-store` interaction.** The editor runs `babel-plugin-react-compiler` — `[VERIFIED: packages/apps/editor/vite.config.ts:23]` → `        plugins: [['babel-plugin-react-compiler']],` — and its test host repeats it `[VERIFIED: packages/apps/editor/vitest.config.ts:10]`; core's vitest config enables it too `[VERIFIED: packages/libs/editor-core/vitest.config.ts:8-12]`. Three notes:
1. `useStore` is a real hook built on React's `useSyncExternalStore`; the compiler treats it as a hook call site, so moving the hook across a package boundary changes nothing about its memoisation semantics.
2. The selector currently returns a **fresh object each call** (`operationHistory.ts:194-203`). That is pre-existing behaviour and must be preserved verbatim — do not "optimise" it into `useShallow` or a memo, because that would change re-render counts and is an unrequested behaviour change.
3. Do not wrap the call in `useMemo`/`useCallback` manually; the compiler already handles memoisation and manual memoisation has been the source of double-memoisation regressions (CONVENTIONS: "avoid manual memoization that assumes compiler is off").

### Q10 — Move mechanics

**Shared rewrite rules for every moved file:** (1) drop the `@/` prefix, use extensionless relative imports; (2) type-only imports must be `import type` (core's own tsconfig + the editor's program both enforce `verbatimModuleSyntax`/`isolatedModules`); (3) no `enum`, no parameter properties (Pitfall 1); (4) no module-level `let`/`var`, bare object/array/`Map`/`Set` literals (Block B) — `Object.freeze({…})` or `as const` where a table is unavoidable.

| Source file | Target | Import rewrites |
|---|---|---|
| `src/fs/types.ts` | `lib/resources/types.ts` | none (type-only) |
| `src/fs/interfaces.ts` | `lib/resources/interfaces.ts` | `./types` unchanged |
| `src/fs/errors.ts` | `lib/resources/errors.ts` | none |
| `src/fs/ContentUtils.ts` | `lib/resources/ContentUtils.ts` | `./types` unchanged; **wrap the export in `Object.freeze({…})`** (Pitfall 2) |
| `src/fs/PersistExecutor.ts` | `lib/resources/PersistExecutor.ts` | `@/utils/base/signal` → `./waitUntil`; `./interfaces` unchanged |
| `src/fs/PersistenceMonitor.ts` | `lib/resources/PersistenceMonitor.ts` | `./PersistExecutor`, `./interfaces` unchanged; **delete `export const persistenceMonitor = …`** |
| `src/fs/FileHandler.ts` | `lib/resources/FileHandler.ts` | drop `@/services/fs` (→ `FsPort` from `../ports/fs`); `@/utils/base/signal` → `./waitUntil`; drop `./PersistenceMonitor` value import (keep the type); `./types`, `./interfaces`, `./errors` unchanged |
| `src/fs/FileHandlerManager.ts` | `lib/resources/FileHandlerManager.ts` | drop `@/services/fs`; import `FileHandler`/`FileHandlerDependencies`; **delete the trailing `new`** |
| `src/fs/DataHandler.ts` | `lib/resources/DataHandler.ts` | `@/utils/base/signal` → `./waitUntil`; `./FileHandler`, `./types`, `./interfaces`, `./ContentUtils` unchanged |
| `src/fs/JsonDataHandler.ts` | `lib/resources/JsonDataHandler.ts` | `./DataHandler`, `./FileHandler` unchanged |
| `src/fs/BinaryFileHandler.ts` | `lib/resources/BinaryFileHandler.ts` | drop `@/services/fs`; `@/utils/base/signal` → `./waitUntil`; `./types`, `./interfaces`, `./errors` unchanged |
| `src/project/resources.ts` | `lib/resources/combinators.ts` | `@/fs/interfaces` → `./interfaces`; `@/fs/types` → `./types`; `@/fs/ContentUtils` → `./ContentUtils`; `@/utils/base/signal` → `./waitUntil` |
| `src/utils/base/signal.ts` | `lib/resources/waitUntil.ts` (recommended) | `alien-signals` only |
| *(new)* | `lib/resources/ResourceRegistry.ts` | `./combinators` (for `ResourceView`) |
| `src/project/history/operations.ts` | `lib/edit/operations.ts` | `@/fs/types` → `../resources/types`; `@/utils/action` → `./action`; `@/project/data/DataResource` → **removed** (replaced by the local `PatchableResource` contract); `./viewport` → **removed** (viewport ops stay in editor) |
| `src/project/history/operationHistory.ts` | `lib/edit/operationHistory.ts` | `./operations` unchanged; `./viewport` → **removed**; store moves onto the instance |
| *(new)* | `lib/edit/undoSystem.ts` | none |
| `src/utils/action.ts` | `lib/edit/action.ts` | `@/utils/fieldPath` → `./fieldPath` |
| `src/utils/fieldPath.ts` | `lib/edit/fieldPath.ts` | none (`es-toolkit/compat`) |

**Confirmed: `lib/resources` / `lib/edit` are internal dirs exported from the root `.` entry, with no new subpath** (CONTEXT D-09). `[VERIFIED: scripts/verify/coreExports.js:45-46, 77-81, 151-170]` asserts `exports` is exactly seven keys, every target exists on disk, and `subpathStatus.json` matches; adding `./resources` or `./edit` reds the `typecheck` job. `lib/index.ts`'s existing style is **named** re-exports with a documented rationale `[VERIFIED: packages/libs/editor-core/lib/index.ts:1-19]`, so extend it in that style.

**Editor-side file inventory (new/changed), all in `packages/apps/editor`):**

| Path | Kind | Purpose |
|---|---|---|
| `src/<app-instance module>` (name TBD) | new | constructs + exports `persistenceMonitor`, `FileHandlerManager`, `operationHistory`; registers the viewport `UndoSystem`; the **only** `new` site (D-07) |
| `src/project/history/viewportOperations.ts` | new | `RestoreViewportOperation`, `NavigateFloorOperation`, `navigateFloorOperation` relocated (D-02) |
| `src/project/history/useOperationHistory.ts` (or fold into `index.ts`) | new | zero-arg editor wrapper over core's hook |
| `src/project/history/index.ts` | changed | re-export core edit names + `navigateFloorOperation` + `operationHistory` (instance) + `useOperationHistory` |
| `src/fs/{types,interfaces,errors,ContentUtils,PersistExecutor,PersistenceMonitor,FileHandler,FileHandlerManager,DataHandler,JsonDataHandler,BinaryFileHandler}.ts` | changed → shims | marker + named re-exports |
| `src/fs/index.ts` | changed | barrel: core names + editor-only `Json2xDataHandler`/`ScriptDataHandler` + instance names |
| `src/project/resources.ts` | changed → shim | `computedResource`/`aggregateResource`/`optional` + types |
| `src/project/history/{operations,operationHistory}.ts` | changed → shims | core edit names + the instance |
| `src/utils/action.ts`, `src/utils/fieldPath.ts`, `src/utils/base/signal.ts` | changed → shims | D-04 closure + `waitUntil` |
| `src/fs/Json2xDataHandler.ts`, `src/fs/ScriptDataHandler.ts` | **unchanged** | D-01; they import `./DataHandler`/`./FileHandler`, which now resolve to shims |

**Zero-change survivors that depend on the moved code (all via shims):** `src/project/data/{projectData,DataResource}.ts`, `src/project/commands/*`, `src/project/model/*`, `src/project/assets/*`, `src/services/**/*DataHandler.ts`, `src/Workbench/**`, `src/MapEditor/index.tsx`, `src/hooks/**`, `src/blockly/project/projectBlocks.ts`, `src/components/**`.

---
## Code Examples

Verified shapes from in-repo sources and executed probes.

### The five invariants, quoted verbatim (they move byte-for-byte; RES-05)

```ts
// packages/apps/editor/src/fs/types.ts:8-13   →  lib/resources/types.ts
export type Content<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; value: T }
  | { status: 'not-found' }
  | { status: 'error'; error: Error };
```
`[VERIFIED: packages/apps/editor/src/fs/types.ts:8-13]`

```ts
// packages/apps/editor/src/fs/PersistExecutor.ts:13-16, 21-24, 36-43   →  lib/resources/PersistExecutor.ts
export type PersistenceIntent = {
  kind: 'write' | 'delete';
  execute: () => Promise<void>;
};
// …
export class PersistExecutor {
  private pendingIntent: PersistenceIntent | null = null;
  private failedIntent: PersistenceIntent | null = null;
  private isExecuting = false;
  // …
  schedule(intent: PersistenceIntent): void {
    this.pendingIntent = intent;
    if (this.isExecuting) {
      this._status({ status: 'executing', pending: 1 });
      return;
    }
    void this.processQueue();
  }
```
`[VERIFIED: packages/apps/editor/src/fs/PersistExecutor.ts:13-16, 21-24, 36-43]` — this is the "**one executing + one pending**" half of RES-05.

```ts
// packages/apps/editor/src/fs/errors.ts:10-20   →  lib/resources/errors.ts
export function isFileNotFoundError(error: Error): boolean {
  const { code } = error as ErrorWithCode;
  if (code) return code === 'file-not-found' || code === 'ENOENT';
  return (
    error.name === 'NotFoundError' ||
    /\bfile-not-found\b/i.test(error.message) ||
    /\bfile not found\b/i.test(error.message) ||
    /\bENOENT\b/i.test(error.message) ||
    /\bno such file\b/i.test(error.message)
  );
}
```
`[VERIFIED: packages/apps/editor/src/fs/errors.ts:10-20]` — this is the "**not-found ≠ error**" half.

```ts
// packages/apps/editor/src/fs/FileHandler.ts:69-78   →  lib/resources/FileHandler.ts
  private commit(value: string): void {
    this.mutationVersion += 1;
    this._content({ status: 'loaded', value });          // memory-first
    const path = this.path;
    const fs = this.fs;
    this.persistenceMonitor.schedule(path, {             // then, async, the single write path
      kind: 'write',
      execute: () => fs.writeFile(path, value, 'utf-8'),
    });
  }
```
`[VERIFIED: packages/apps/editor/src/fs/FileHandler.ts:69-78]` — this is the "**memory-first ≠ saved**" + "**single write path**" halves.

### The core FsPort double (D-14) — candidate test helper

```ts
// packages/libs/editor-core/lib/resources/__tests__/<fs double>.ts   (name TBD)
import type { FsPort } from '../../ports/fs';

export class MemoryFsPort implements FsPort {
  private files = new Map<string, string>();
  private writeDelay = 0;
  private writeCount = 0;
  private writeError: Error | null = null;
  private writeErrors = new Map<string, Error>();
  private delay(ms: number): Promise<unknown> { return ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve(); }
  async readFile(path: string): Promise<string> {
    const value = this.files.get(path);
    if (value === undefined) throw new Error(`File not found: ${path}`);
    return value;
  }
  async readFileBinary(path: string): Promise<ArrayBuffer> {
    const buffer = Buffer.from(await this.readFile(path), 'base64');
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  }
  async writeFile(path: string, data: string): Promise<void> {
    this.writeCount += 1;
    const perPath = this.writeErrors.get(path);
    if (perPath) throw perPath;
    if (this.writeError) throw this.writeError;
    await this.delay(this.writeDelay);
    this.files.set(path, data);
  }
  async deleteFile(path: string): Promise<void> {
    if (!this.files.has(path)) throw new Error(`File not found: ${path}`);
    this.files.delete(path);
  }
  async readdir(path: string): Promise<string[]> { return [...this.files.keys()].filter((f) => f.startsWith(path)); }
  async mkdir(): Promise<void> {}
  async moveFile(src: string, dest: string): Promise<void> {
    const value = this.files.get(src);
    if (value === undefined) throw new Error(`File not found: ${src}`);
    this.files.set(dest, value);
    this.files.delete(src);
  }
  // fault injection (parity with packages/apps/editor/test/utils/MemoryFileSystem.ts:19-56)
  setWriteDelay(ms: number): void { this.writeDelay = ms; }
  setWriteError(error: Error): void { this.writeError = error; }
  setWriteErrorForPath(path: string, error: Error): void { this.writeErrors.set(path, error); }
  getWriteCount(): number { return this.writeCount; }
  setFile(path: string, content: string): void { this.files.set(path, content); }
  getFile(path: string): string | undefined { return this.files.get(path); }
  hasFile(path: string): boolean { return this.files.has(path); }
}
```
Modelled on `[VERIFIED: packages/apps/editor/test/utils/MemoryFileSystem.ts:9-178]` but **flat** (7 ops, no `promises` namespace, no callback half), per D-14. `Buffer` is available because core's shared vitest config runs under Node/jsdom with Vite's node polyfills; if a pure-Node `// @vitest-environment node` docblock is used, `Buffer` is native.

### A moving characterization test's setup delta (assertions untouched)

```ts
// lib/resources/__tests__/FileHandler.test.ts  (moved from src/fs/__tests__/FileHandler.test.ts)
import { beforeEach, describe, expect, it } from 'vitest';
import { FileHandler } from '../FileHandler';
import { ContentUtils } from '../ContentUtils';
import { PersistenceMonitor } from '../PersistenceMonitor';
import { MemoryFsPort } from './<fs double>';
import { wait } from './<local wait>';

describe('FileHandler', () => {
  let memoryFs: MemoryFsPort;
  let persistenceMonitor: PersistenceMonitor;
  beforeEach(() => {
    persistenceMonitor = new PersistenceMonitor();   // instance, not the deleted module singleton
    memoryFs = new MemoryFsPort();
  });
  // every `new FileHandler('test.txt', memoryFs.createFsInterface())`
  //   becomes `new FileHandler('test.txt', { fs: memoryFs, persistenceMonitor })`
  // every assertion stays exactly as it is
});
```

### The `UndoSystem` seam applied to the viewport (editor side, stays)

```ts
// packages/apps/editor/src/project/history/viewport.ts — UNCHANGED (D-02)
let provider: EditorViewportProvider | null = null;                     // :38  (module-level, editor-only)
export function captureEditorViewport(): EditorViewport | null { return provider?.capture() ?? null; }
export async function restoreEditorViewport(viewport: EditorViewport | null): Promise<void> {
  if (viewport && provider) await provider.restore(viewport);
}
```
`[VERIFIED: packages/apps/editor/src/project/history/viewport.ts:38, 47-53]`

```ts
// packages/apps/editor/src/<app-instance module> — the registration that replaces :17-18 / :97-176
operationHistory.registerUndoSystem<EditorViewport | null>({
  id: 'viewport',
  capture: () => captureEditorViewport(),                       // sync, captured at execute() invocation
  restore: (snapshot) => restoreEditorViewport(snapshot),        // async restore, delegates to the provider
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| `export const FileHandlerManager = new FileHandlerManagerImpl()` | `class FileHandlerManager` + one instance in the adapter | Phase 4 (D-06/D-07) | Two editors per page become possible; tests get per-instance isolation |
| `FileHandler` reading the `persistenceMonitor` singleton | `FileHandlerDependencies` constructor injection | Phase 4 (D-07) | Removes the last value-import from `fs/FileHandler.ts:8`; makes the pair testable in isolation |
| `operationHistory` calling `captureEditorViewport`/`restoreEditorViewport` and storing `beforeViewport`/`afterViewport` | per-instance `UndoSystem` registry + entry-level before/after snapshots | Phase 4 (D-03) | Core stops knowing viewport/material semantics; later capabilities register their own systems |
| Module-level `historyStore` | store on the `OperationHistory` instance | Phase 4 (D-11) | Clears the core module-state gate; two histories stop sharing undo state |
| Editor-only `@/` imports inside what became core | extensionless relative imports | Phase 2 (D-06) / Phase 3 | `coreBoundaries.js` fails on unresolved specifiers; `@/` in core is a red flag |
| Six module singletons | three de-singletonised now (Phase 4), three remaining (Phase 5/11) | Phase 4 | `requireZero` retargeted; the "*one* `new` site" verifier becomes the interim guard |

**Deprecated/outdated in this phase's context:**
- `test/utils/testHelpers.ts`'s `createTestFileHandler` — dead code and already a latent type error (passes a `FileEncoding` where `Fs` is expected). Do not "fix" it into core; either delete it or leave it untouched.
- `Json2xDataHandler` / `ScriptDataHandler`: deliberately **not** core in this milestone (D-01 / PORT-05).
- `runtimeProtocolVersion: 3` vs `RUNTIME_PROTOCOL_VERSION = 4` drift: deliberately **not** touched (VERIFY-07 / Out of Scope).

## Assumptions Log

> Every claim below is tagged `[ASSUMED]` **inside RESEARCH.md**: it is a design decision or a version/scope judgement made from training knowledge and repo reading, **not** verified against an authoritative external source. Each is followed by its supporting repo evidence, so the planner and discuss-phase can see exactly what the assumption rests on and what breaks if the user chooses differently. None of these may be presented to the user as a verified fact; each is a confirmation checkpoint.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `[ASSUMED]` D-04's closure **forces** `src/utils/action.ts` + `src/utils/fieldPath.ts` into core, and therefore `es-toolkit` becomes a core dependency (evidence: `action.ts:117-135` calls `parseFieldPath`/`buildFieldPath`/`getByFieldPath`/`setByFieldPath`/`deleteByFieldPath`; core cannot import editor) | §Q4, §Q10 | If the user instead wants only `applyActionsWithInverse` copied and the helpers duplicated, the plan changes shape (and core stays dependency-free, at the cost of duplicated path semantics). CONTEXT's file list does not name these two files — this is the phase's main under-specification |
| A2 | `[ASSUMED]` `UndoSystem.capture()` must be **synchronous**, and **all** registered systems are captured for **every** `execute` (not per-operation-declared) (evidence: `operationHistory.ts:117` captures synchronously at invocation; `operationHistory.test.ts:55-71` requires a data op to capture the viewport) | §Q2 | A per-operation declaration would red `operationHistory.test.ts:55-71`; an async capture would break the "invoked-time snapshot" semantics |
| A3 | `[ASSUMED]` `ResourceRegistry` is delivered in Phase 4 as a class + unit tests, **unwired** to `projectData` (evidence: `projectData.ts:98-226` lazily creates resources; §Q7) | §Q7 | If the user wants Phase 4 to already route `projectData`'s accessors through it, the phase grows materially and risks RES-05 |
| A4 | `[ASSUMED]` `es-toolkit` should be pinned to `1.44.0` (catalog or exact) rather than left as the `^1.43.0` catalog range (evidence: catalog `^1.43.0`, installed/lockfile `1.44.0`, seam `SUS(too-new)`) | §Q4, §Pitfall 7 | A lockfile regeneration could float the version. Pinning it is the safe reading of PROJECT.md's catalog-version constraint |
| A5 | `[ASSUMED]` The three `src/utils/__tests__/*.property.test.ts` files **stay in the editor** (evidence: they import only shim paths + `vitest` + `fast-check`) | §Q5 | Moving them would add `fast-check` to core's devDependencies; the coverage is equivalent either way |
| A6 | `[ASSUMED]` `waitUntil` lands at `lib/resources/waitUntil.ts` (vs a new `lib/signals/` dir) (evidence: `utils/base/signal.ts:1-34` contains only `waitUntil`) | §Q4 | Either satisfies D-12's bullet; only the directory count/gate surface differs |
| A7 | `[ASSUMED]` The editor's single app-instance module doubles as the `UndoSystem` registration site | §Pattern 2, §Q2 | An alternative is to register in `src/project/history/index.ts`; both work, but the app-instance module is the only file already allowed to construct instances |
| A8 | `[ASSUMED]` `FileHandler`'s injected-port field stays named `fs` (holding an `FsPort`) (evidence: 4 editor test files poke `(handler as any).fs`) | §Q1 | Renaming it would force extra edits at `sampleProject.ts`, `towerService.test.ts:66`, `floorCommands.test.ts:60`, `tableMetaService.test.ts:43` |
| A9 | `[ASSUMED]` `OperationHistory` exposes the `Store` (or an equivalent) so `useOperationHistory` can accept the instance (evidence: `useStore` needs a `Store`; `operationHistory.ts:194`) | §Q9 | The narrower `subscribe`/`getState` alternative changes the hook's internals and is not required by D-11 |
| A10 | `[ASSUMED]` `ResourceRegistry` stays decoupled from `DiagnosticBus` in Phase 4 (evidence: `coreApiSurface.test.ts:43-51` asserts exactly five codes) | §Q7, §Pitfall 10 | Coupling would require new `DIAGNOSTIC_CODES` and an edit to `coreApiSurface.test.ts:43-51` |
| A11 | `[ASSUMED]` The depcruise editor half stays dormant-by-target (not activated by widening the cruise target in Phase 4) | §Q6a | Activating it needs an ~80-entry allow-list; the verifier in §Q6b is the recommended enforcing substitute |

**If this table were empty:** all claims would be verified or cited. It is not empty — items A1–A11 are the confirmation checkpoints for discuss-phase/planning.


## Open Questions

1. **Does the plan move `action.ts` + `fieldPath.ts` wholesale (recommended) or narrow the D-04 scope?**
   - What we know: `applyActionsWithInverse` `[VERIFIED: packages/apps/editor/src/utils/action.ts:117-135]` cannot function without `parseFieldPath`/`buildFieldPath`/`getByFieldPath`/`setByFieldPath`/`deleteByFieldPath` `[VERIFIED: packages/apps/editor/src/utils/fieldPath.ts:21-177]`, and core may not import editor.
   - What's unclear: whether the user considers these "字段动作原语" (D-04's words) or wants a narrower copy.
   - Recommendation: move both files to `lib/edit/`, shim both old paths (13 + 29 import sites respectively), and add `es-toolkit` to core. Record in `INTERFACE-NAME.md`.

2. **What is the app-instance module's file name and export list?** (Discretion per CONTEXT; must be confirmed before landing.)
   - What we know: it must be the single `new` site for the three instances, and export the three legacy names.
   - Recommendation: `packages/apps/editor/src/appInstances.ts` exporting `persistenceMonitor`, `FileHandlerManager`, `operationHistory`; the depcruise `from.pathNot` and the shim verifier's "one `new` site" rule both key off this path, so the name is a small contract.

3. **What is the exact `ResourceRegistry` shape, and does the user accept a Phase-4 delivery with no production consumer?**
   - What we know: RES-02 is required; CONTEXT flags it as unresolved; ARCHITECTURE names it in Phase 4.
   - Recommendation: the minimal class in §Q7 + unit tests; the alternative (re-map RES-02 to Phase 5) needs explicit sign-off and a `REQUIREMENTS.md` traceability edit.

4. **Does `useOperationHistory` stay zero-arg by an editor wrapper (recommended) or do the two call sites change to pass the instance?**
   - What we know: core cannot have a module-level store, so the core hook needs the instance; `[VERIFIED: AppTopBar.tsx:22, PanelSlot.tsx:21]` both import the zero-arg name.
   - Recommendation: core `useOperationHistory(history)` + an editor zero-arg wrapper, so `@motajs/editor` imports are untouched (D-10's spirit).

5. **Should the Phase-2/3 artifacts `subpathStatus.json` + `coreExports.js` both move to a new `.`-content value?**
   - What we know: `[VERIFIED: scripts/verify/coreExports.js:77-81]` hard-codes `'.': 'kernel-exports'`; `[VERIFIED: subpathStatus.json:6-10]` records the same.
   - Recommendation: yes — update both in one commit to a truthful value (Phase 3's Pitfall 8 lesson). Record the value in `INTERFACE-NAME.md`.

## Environment Availability

> Step 2.6 audit. The phase has one external dependency that matters: the package manager needing a network round-trip to record the new dependency edges.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | verifiers, Vitest, ESLint, `tsc` | ✓ | v24.21.0 `[VERIFIED: executed probe; ci.yml pins 24]` | — |
| pnpm | workspace fan-out + the required lockfile change | ✓ | 12.5.1 `[VERIFIED: executed probe; ci.yml pins 12.5.1]` | — |
| TypeScript | `tsc -b` (core + editor programs) | ✓ | 5.9.3 `[VERIFIED: node_modules/typescript]` | — |
| Vitest | core + editor unit tests | ✓ | 4.0.18 (editor/core) / catalog `^4.0.16` | — |
| ESLint (flat config) | Block A/B gates + `coreModuleState.js` | ✓ | 9.39.2 `[VERIFIED: --print-config probe ran]` | — |
| dependency-cruiser | boundary + `requireZero` rules | ✓ | 18.2.0 `[VERIFIED: node_modules/dependency-cruiser/package.json → 18.2.0; probes ran]` | — |
| `@tanstack/store` / `@tanstack/react-store` | new core deps | ✓ (already installed) | 0.8.0 / 0.8.0 | — |
| `ts-pattern` / `es-toolkit` | new core deps | ✓ (already installed) | 5.9.0 / 1.44.0 | — |
| Network (for `pnpm install`) | writing the two new catalog entries + four `dependencies` edges into `pnpm-lock.yaml` | must go through the proxy | — | `pnpm install --offline` if the four packages are already in the local pnpm store |
| `packages/apps/editor/styled-system/` | core's `tsc -b` + vitest `@styled-system` alias | ✓ (regenerated by `prepare: panda codegen`) | — | add an explicit `panda codegen` step if `prepare` ever stops running |
| `packages/external/mota-js` submodule | the tests that **stay** in the editor (`persistNoRollback.invariants`, `operationHistory.test`, the reactivity describe, `*Commands.test`) | required by the `unit` job `[VERIFIED: scripts/verify/ci-workflow.js:53 SUBMODULE_JOBS = ['unit','build']]` | — | none — the `unit` job already checks it out |

**Missing dependencies with no fallback:** none (the four libraries are already resolved locally; if the network is unavailable, `pnpm install --offline` should suffice).

**Missing dependencies with fallback:** none.

---

## Validation Architecture

> `workflow.nyquist_validation` is `true` `[VERIFIED: .planning/config.json:24]` → `    "nyquist_validation": true,`, so this section is required. All checks run inside the **existing four CI jobs** (no new job — `ci-workflow.js` asserts exactly four `[VERIFIED: scripts/verify/ci-workflow.js:30-31, 199-209]`).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 — two projects: `packages/libs/editor-core/vitest.config.ts` and `packages/apps/editor/vitest.config.ts` |
| Config files | core: `include: ['lib/**/*.test.{ts,tsx}']`, `environment: 'jsdom'` `[VERIFIED: packages/libs/editor-core/vitest.config.ts:20-23]`; editor: own `vitest.config.ts` (Phase 1 D-14 split) |
| Quick run command | `pnpm --filter @motajs/editor-core test` |
| Editor-impact command | `pnpm --filter @motajs/editor test` (the shim contract's real proof) |
| Type-check both programs | `pnpm --filter @motajs/editor-core typecheck && pnpm --filter @motajs/editor typecheck` |
| Phase gate command | `pnpm lint && pnpm typecheck && pnpm test && pnpm build` (the four CI jobs' local analogues) |
| Gate commands | `node scripts/verify/coreBoundaries.js`, `node scripts/verify/coreModuleState.js`, `node scripts/verify/editorShims.js` (new), `node scripts/verify/coreExports.js`, `node scripts/verify/ci-workflow.js` |
| Per-file env for pure tests | `// @vitest-environment node` docblock (Phase-3 precedent; the pure moved tests must be explicitly opted in or they run under jsdom) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RES-01 | `Content<T>` five-state, `FileHandler`/`DataHandler`/`BinaryFileHandler`, combinators live in `lib/resources/*` and behave identically | unit | `pnpm --filter @motajs/editor-core exec vitest run lib/resources/__tests__/FileHandler.test.ts lib/resources/__tests__/resources.test.ts` | ❌ Wave 0 (moved) |
| RES-01 | `BinaryFileHandler`/`JsonDataHandler` are exported from root `.` and constructible with an `FsPort` | unit + export-surface | `pnpm --filter @motajs/editor-core exec vitest run lib/__tests__/coreApiSurface.test.ts` (extended) | ⚠ extend existing |
| RES-02 | `ResourceRegistry` registers by logical id, rejects duplicates, returns a working disposer, snapshots entries; two instances are independent | unit | `pnpm --filter @motajs/editor-core exec vitest run lib/resources/__tests__/resourceRegistry.test.ts` | ❌ Wave 0 (new) |
| RES-03 | `FileHandlerManager` is per-instance: two managers do not share handlers; the editor's single instance still returns one handler per path | unit | `pnpm --filter @motajs/editor-core exec vitest run lib/resources/__tests__/FileHandlerManager.test.ts` **and** `pnpm --filter @motajs/editor exec vitest run src/fs/__tests__/FileHandlerManager.test.ts` (if the editor keeps a copy) | ❌ Wave 0 (moved) |
| RES-04 | `EditorOperation`/`compositeOperation`/`operationHistory` capacity 100, inverse ops, multi-target checkpoint + rollback | unit | `pnpm --filter @motajs/editor-core exec vitest run lib/edit/__tests__/operationHistory.invariants.test.ts` (`capability 100` and `tags the failing stage` cases) | ❌ Wave 0 (moved, split) |
| RES-04 | Same invariants, **end to end through the shims and the real fixture** | integration | `pnpm --filter @motajs/editor exec vitest run src/project/history/__tests__/operationHistory.test.ts` | ✅ exists (unchanged) |
| RES-05 | memory-first ≠ saved / single write path | unit + integration | core: `… vitest run lib/resources/__tests__/persistExecutor.invariants.test.ts`; editor: `… vitest run src/fs/__tests__/persistNoRollback.invariants.test.ts` | ✅ exists (one moving, one staying) |
| RES-05 | per-path serialization (one executing + one pending) | unit | `… vitest run lib/resources/__tests__/persistExecutor.invariants.test.ts` (`latest-wins` + `hasPending` cases) | ❌ Wave 0 (moved) |
| RES-05 | not-found ≠ error | unit | `… vitest run lib/resources/__tests__/errors.test.ts` + the `project-not-found` case inside `FileHandler.test.ts` | ❌ Wave 0 (moved) |
| RES-06 | `ReadonlySignal<Content<T>>` is a live signal, not a snapshot | unit | new assertion in `lib/resources/__tests__/*`: read `handler.content()` → mutate via `update()` → assert the *previously captured callable* now returns the new state; and assert no `content` value is produced by `effect`/snapshot faking | ❌ Wave 0 (new assertion — see below) |
| RES-06 | hook-driven reactivity survives across the package boundary | integration | `pnpm --filter @motajs/editor exec vitest run src/hooks/__tests__/*` + the `operationHistory` reactivity describe | ✅ exists |
| RES-01/RES-04 structural | core has no module-level mutable binding; `lib/resources`/`lib/edit` exist and are reachable from `.` | static gate + two-polarity | `pnpm lint` (Block B, widened ignores) + `node scripts/verify/coreModuleState.js` | ✅ exists (needs the ignore widening) |
| RES-03/adapter | exactly one `new FileHandlerManager(` / `new PersistenceMonitor(` / `new OperationHistory(` site in `packages/apps/editor/src` | static gate + two-polarity | `node scripts/verify/editorShims.js` in the `lint` job | ❌ Wave 0 (new) |
| Regression | every shim is forward-only and tracked; the list is exactly the expected set | static gate + two-polarity | `node scripts/verify/editorShims.js` | ❌ Wave 0 (new) |
| Regression | `@motajs/editor` behaviour unchanged; Phase 1 baseline holds | full suite | `pnpm typecheck && pnpm test && pnpm build` + `node scripts/verify/editorArtifactAssets.js` | ✅ exists |
| Regression | the four-job contract was not altered | static | `node scripts/verify/ci-workflow.js` | ✅ exists |
| Regression | `@/` never reappears inside core; relative edges all resolve inside core | static | `node scripts/verify/coreBoundaries.js` | ✅ exists |

### Sampling Rate

- **Per task commit:** `pnpm --filter @motajs/editor-core test` (or editor's, depending on which tree the task touched) — fast and local.
- **Per wave merge:** `pnpm lint && pnpm typecheck && pnpm test` (the three local analogues; `pnpm typecheck` must run the **editor's** program too, since Pitfall 1 lives there).
- **Phase gate:** all four CI jobs green before `/gsd-verify-work`, plus `node scripts/verify/ci-workflow.js` to confirm the job contract was not altered.

### Wave 0 Gaps

- [ ] `packages/libs/editor-core/lib/resources/__tests__/` — the moved pure tests (`errors`, `FileHandler`, `FileHandlerManager`, `PersistenceMonitor`, `PersistExecutor`, both `*.invariants`, `resources`) with deps-object construction and no `@test/*` imports.
- [ ] `packages/libs/editor-core/lib/resources/__tests__/<fs double>.ts` — the flat `FsPort` double with the four fault-injection knobs (D-14); plus a 2-line `wait` helper (or one shared `<test helpers>.ts`).
- [ ] `packages/libs/editor-core/lib/resources/__tests__/resourceRegistry.test.ts` — RES-02.
- [ ] `packages/libs/editor-core/lib/edit/__tests__/operationHistory.invariants.test.ts` — the 9 moved pure invariants, instance-based.
- [ ] A RES-06 signal-liveness assertion (can live inside the moved `FileHandler.test.ts` or a new file).
- [ ] `packages/apps/editor/src/project/history/__tests__/operationHistory.reactivity.invariants.test.ts` — the split-off reactivity describe.
- [ ] `scripts/verify/editorShims.js` — the two-polarity shim + one-`new`-site verifier (§Q6b), wired as an extra `- run:` step in the `lint` job.
- [ ] No framework install needed — Vitest/ESLint/dependency-cruiser/catalog deps are all present. `fast-check` is **not** needed if A5 holds.

**Carried-forward pre-existing flake (do not "fix" here):** `[VERIFIED: .planning/phases/01-baseline-verification-net/deferred-items.md:142-148]` the `@motajs/react-monaco-editor` teardown flake makes the `pnpm -r run test` fan-out nondeterministic ("roughly half the time"). If the fan-out reds only there with all its tests passing, retry once and say so.

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1`, `security_block_on: high` `[VERIFIED: .planning/config.json:47-49]`. Phase 4 is a pure browser-side relocation of an in-memory resource/edit layer with no auth, no sessions, no cryptography, no network I/O of its own — but it **is** the persistence-scheduling and path-handling layer, so V5 and V4-via-path-safety apply.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No authentication surface |
| V3 Session Management | no | No session state |
| V4 Access Control | no (but path safety is adjacent) | `FsPort` explicitly does **not** normalize or validate paths — path safety stays in the host (`service-worker/src/server/fsApi.ts`), as `[VERIFIED: packages/libs/editor-core/lib/ports/fs.ts:14-18]` documents. Do not add path sanitisation inside core |
| V5 Input Validation | **yes** | (a) `ResourceRegistry.register` must reject duplicate ids and validate the logical-id form; (b) store registry entries in a `Map`, never as bare object keys, so an id like `__proto__` cannot pollute a prototype; (c) `isFileNotFoundError` must keep distinguishing `file-not-found`/`ENOENT` from host errors such as `project-not-found` — the surrounding test `[VERIFIED: src/fs/__tests__/errors.test.ts:13-19]` asserts exactly that |
| V6 Cryptography | no | Nothing cryptographic; never hand-roll hashing/encoding |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prototype pollution via a resource logical id (`__proto__`, `constructor`) | Tampering | `Map`-backed registry keyed by the id string; `snapshot()` returns copied/frozen entries; never assign into a plain object |
| Path traversal via a resource path | Tampering | **Out of scope for core by design** — `FsPort` treats paths as opaque `[VERIFIED: ports/fs.ts:16-18]`; escaping prevention stays in the host |
| Silent data loss from a mis-classified persistence failure | Integrity | `isFileNotFoundError` is the single classifier; `FileHandler.delete` swallows only not-found `[VERIFIED: FileHandler.ts:100-107]`; `PersistExecutor` never rolls memory back `[VERIFIED: PersistExecutor.ts:1-7 doc comment]` |
| Gate bypass by disabling/weakening a core rule | Elevation of Privilege | `lint-severities.js` guards rule severities; the new `editorShims.js` carries a two-polarity proof so a vacuous rule cannot masquerade as green |
| Cross-instance state leakage (undo history shared between two editors) | Information Disclosure / Integrity | The `UndoSystem` registry and store are instance fields; the isolation assertion belongs in `resourceRegistry.test.ts` and (optionally) a two-`OperationHistory` test |
| Unbounded history growth | Denial of Service | Capacity 100 is preserved verbatim and asserted by the moved capacity test `[VERIFIED: operationHistory.invariants.test.ts:92-112]` |

## Sources

### Primary (HIGH confidence — read from source this session, or executed as a read-only probe)

**Moved/consumed source**
- `packages/apps/editor/src/fs/{types,interfaces,errors,ContentUtils,PersistExecutor,PersistenceMonitor,FileHandler,FileHandlerManager,DataHandler,JsonDataHandler,BinaryFileHandler,index}.ts` — every quoted line above
- `packages/apps/editor/src/fs/Json2xDataHandler.ts:12-14`, `ScriptDataHandler.ts:14-16` — the `@motajs/file2x` coupling that keeps them in the editor (D-01)
- `packages/apps/editor/src/project/resources.ts:8-14, 14-136` — `ResourceView`/`LoadableResource`/combinators
- `packages/apps/editor/src/project/history/{operations,operationHistory,viewport,materialOperations,commandOperations,textFileOperations,index}.ts` — the move/split boundary
- `packages/apps/editor/src/project/data/{DataResource,projectData}.ts` — `PatchableResource` structural satisfaction + the 11 `FileHandlerManager.get(...)` sites
- `packages/apps/editor/src/utils/{action,fieldPath}.ts`, `src/utils/base/signal.ts` — the D-04 closure and `waitUntil`
- `packages/apps/editor/src/services/fs/fs.ts:23-44, 199-300` — `FsPromiseApi`/`Fs` verbatim
- `packages/apps/editor/src/services/editorConfig/{editorConfigService,index}.ts`, `src/project/model/projectModel.ts` — the three remaining editor singletons and their exact class names
- `packages/apps/editor/test/utils/{MemoryFileSystem,sampleProject,testHelpers}.ts` — the fixture shapes the shims must keep working
- All 11 test files enumerated in §Q5 (read individually)

**Core**
- `packages/libs/editor-core/lib/{index,ports/fs,ports/index,kernel/core,kernel/registry}.ts` — the target surface and the registry precedent
- `packages/libs/editor-core/{package.json,tsconfig.json,vitest.config.ts}` — manifest/scripts/exports and the test host
- `packages/apps/editor/tsconfig.json` + `tsconfig.app.json`, `packages/libs/config/tsconfig.{app,lib}.base.json` — the `erasableSyntaxOnly`/`verbatimModuleSyntax` program boundary

**Gates & CI**
- `eslint.config.js:92-137, 157-183` (Blocks A/B, the ignore list, the selectors)
- `.dependencyCruiser.cjs:14-71` (all six rules)
- `scripts/verify/{coreModuleState,coreBoundaries,coreExports,ci-workflow}.js`
- `.github/workflows/ci.yml` (the four jobs and their steps)
- `.planning/phases/02-package-boundary-build-scaffolding/subpathStatus.json`

**Config**
- `pnpm-workspace.yaml` (catalog read in full), `pnpm-lock.yaml` (resolved versions), `package.json`, `.npmrc`
- `packages/apps/editor/package.json` (pins + scripts), `packages/apps/editor/vite.config.ts:23`, `packages/apps/editor/vitest.config.ts:17-22`
- `.planning/config.json:24, 47-49` (nyquist_validation + security settings)

**Planning corpus**
- `.planning/phases/04-resource-edit-layers-moved/04-CONTEXT.md`, `.planning/REQUIREMENTS.md:23-38`, `.planning/ROADMAP.md:137-165`, `.planning/STATE.md`
- `.planning/phases/03-kernel-runtime-ports-registry-diagnostics/{03-CONTEXT,03-RESEARCH,INTERFACE-NAME}.md`
- `.planning/phases/02-package-boundary-build-scaffolding/02-CONTEXT.md`, `.planning/phases/01-baseline-verification-net/{01-CONTEXT.md,deferred-items.md}`
- `.planning/research/{ARCHITECTURE.md:112,143,199,274-291,360,625,689, SUMMARY.md:75,153}`
- `AGENTS.md` §Project Rules

**Executed probes (this session)**
- `eslint --print-config packages/libs/editor-core/lib/kernel/registry.ts` → resolved Block B selectors + Block A globals (verbatim output quoted in §Pitfall 2)
- `dependency-cruise --config <temp> packages/libs/editor-core/lib packages/apps/editor/src/project/data/projectData.ts packages/apps/editor/src/project/model/projectModel.ts packages/apps/editor/src/services/editorConfig/editorConfigService.ts` → 62 modules, 67 deps, **0** violations (including `no-circular`)
- the same cruise with a probe rule `to: { path: '@/project/data/projectData' }` → **2** violations (rule fires on unresolved specifiers); with `to: { path: '^packages/apps/editor/src/project/data/projectData\\.ts$' }` → **0** violations (rule is vacuous on resolved paths)
- scripted scans: per-prefix import counts and the 78-production / 19-test file counts; the raw-specifier inventory for the three editor singletons
- version probes: `node_modules/.pnpm/{ts-pattern@5.9.0, @tanstack+store@0.8.0, @tanstack+react-store@0.8.0_…, es-toolkit@1.44.0, immer@11.1.3}`, root `fast-check@4.5.2`/`vitest@4.0.18`/`dependency-cruiser@18.2.0`, Node `v24.21.0`, pnpm `12.5.1`
- `gsd_run query package-legitimacy check --ecosystem npm @tanstack/store @tanstack/react-store es-toolkit ts-pattern` → `OK`, `OK`, `SUS(too-new)`, `OK`

### Secondary (MEDIUM confidence — behaviour inferred from a tool's documented model and confirmed by the probe)

- dependency-cruiser's treatment of **unresolved** dependencies for rule matching (confirmed by the two contrasting probes above; the underlying rule semantics are documented behaviour of dependency-cruiser 18.x)
- ESLint flat-config array-rule overwrite semantics (`eslint.config.js:147-152` documents the hazard; the `--print-config` probe confirms the resolved shape for a core file)

### Tertiary (LOW confidence — flagged for validation)

- None. Every claim above is either read from the repo, executed as a probe this session, or explicitly tagged in the Assumptions Log.

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — four libraries, all already installed; versions read from `node_modules` and the lockfile; the peer-set constraint is machine-asserted
- Architecture (injection chain, `UndoSystem`, `PatchableResource`): **HIGH** for the structural facts (every claim cites a `file:line`), **MEDIUM** for the recommended shapes (naming and container choices are decisions, not facts)
- Move mechanics (per-file rewrites, shim list): **HIGH** — derived from a complete read of the moving files and a scripted import census
- Gate edits: **HIGH** — two of the three crucial behaviours (the module-state match on an object literal, the depcruise vacuity on resolved editor paths) were measured by execution, not reasoned
- `ResourceRegistry` (RES-02): **MEDIUM** — the name appears only in research/roadmap text; the shape is a recommendation and the "deliver unwired" call is an assumption needing sign-off
- Test hosting: **HIGH** — every classification is based on the file's actual import list read this session
- Pitfalls: **HIGH** — each cites a file:line and, where a tool is involved, an executed probe

**Research date:** 2026-09-23
**Valid until:** ~2026-10-23 for the repo-derived facts (they change only if Phase 1/2/3 artifacts, the tool configs, or the moving source files change). The `es-toolkit` version decision, the `ResourceRegistry` shape, and the app-instance module name are decision-shaped, not time-shaped.





