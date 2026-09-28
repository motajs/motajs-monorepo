# Phase 5: Engine Adapter Skeleton & Resource Descriptors - Research

**Researched:** 2026-09-28
**Domain:** TypeScript workspace refactor — engine-agnostic `@motajs/editor-core` resource/adapter contract; mota-js adapter + fake engine-B fixture; mechanical game-identifier gate
**Confidence:** HIGH for the contract shapes and gate mechanics (all read first-hand from repo source this session); MEDIUM for the parameterized-floor representation and `apiVersion` strategy (genuine design choices, flagged as open questions)

## Summary

Phase 5 is **purely additive**: core gains a generic resource-descriptor contract (`ResourceDescriptor` + `defineEngine`), the `EngineAdapter` interface is explicitly widened with `resources`, and core gains one optional file-backed resource class whose only purpose is to let an adapter build a file-based `ResourceView` without leaking a path into the generic contract. `packages/apps/editor/src/project/data/projectData.ts` is **not touched** (D-01); the new mota adapter under `packages/apps/editor/src/adapter/` has no production consumer until Phase 11. All existing tests must stay green.

Two things make this phase simultaneously easy and risky. Easy: every reusable component already exists and was read this session — `ResourceRegistry` already accepts any `ResourceView<T>` with no path, `FileHandlerManager` is per-instance, `DataHandler`/`JsonDataHandler` are in core, and `EditorAdapter` has exactly the `id`/`apiVersion` minimal shape we extend. Risky: the generic `ResourceDescriptor` must **not** contain `path` (or `format`/handler instances), so the parameterized floor path (`project/floors/{id}.js`) cannot be a static array entry and must be resolved by the adapter (D-07). This is the single design decision that needs a confirmed answer before planning the adapter file.

The phase is proven, not asserted, by two mechanical artifacts: a **fake non-mota engine-B fixture** in `lib/__tests__/` that drives `defineEngine → validation → ResourceRegistry → get-by-id → preload order`, and a **two-polarity verifier** in `scripts/verify/` that fails if any game identifier (`tower/floor/loc/autopass/autotile/idnum/airwall/commonEvent/prefab/mota`) appears in core production source and that proves it can fail by writing a synthetic fixture (including the `Math.floor` non-violation case).

**Primary recommendation:** Extend `lib/ports/engine.ts` with `ResourceDescriptor<T>` (`{ id, create(deps), preload?, preloadDependsOn? }`), `EngineDescription`, and a throwing `defineEngine(...)` that validates ids/uniqueness/dependency-acyclicity as an *aggregated* report; put the file-backed `FileResource<T>` class in `lib/resources/`; build engine B as a fixture with at least one non-file resource; add `scripts/verify/coreEngineNeutral.js` wired into the existing `lint` job.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Generic `ResourceDescriptor` / `defineEngine` / validation | `editor-core` (`lib/ports/engine.ts`) | — | The shape core needs is core's to define (research Pattern 3): "core defines the shapes, the adapter conforms". |
| File-backed `ResourceView` construction (opaque IO address + handler) | `editor-core` (`lib/resources/`) | adapter supplies address + handler factory | Path/IO must exist only inside this one class (D-06); the adapter still decides *what* address and *which* handler. |
| Concrete mota resource set (10 paths, `Json2xDataHandler`, domain handlers, var names) | `@motajs/editor` adapter (`src/adapter/`) | — | All engine knowledge lives in exactly one place, so "no leaks" becomes reviewable (ARCHITECTURE Pattern 3). |
| Logical-id registry | `editor-core` (`ResourceRegistry`, Phase 4) | — | Already built and unwired by design; Phase 5 is its first real consumer (STATE.md concern). |
| Game-identifier enforcement | repo tooling (`scripts/verify/`) + CI | — | Mechanical gate over core production source (D-12/D-13); core itself must not carry the vocabulary. |
| Contract honesty proof | `editor-core` test fixture (`lib/__tests__/`) | — | A second non-mota implementation before the extension point freezes (PITFALLS Pitfall 6/14). |

## User Constraints (from CONTEXT.md)

> Copied verbatim from `.planning/phases/05-engine-adapter-skeleton-resource-descriptors/05-CONTEXT.md`. These SUPERSEDE the ROADMAP's original PORT wording (D-14: ROADMAP/REQUIREMENTS are not edited this phase).

### Locked Decisions (D-01..D-14)

- **D-01:** **纯增量**——本阶段只定义 core 侧契约 + 适配器描述符 + fake engine B + 门禁；`projectData` 一行不改，编辑器数据加载链路完全不动。理由：延续 Phase 4 的「未接线」节奏，把接线/切换留给 Phase 11 组合根；回归面最小。 — **Reversibility:** costly — 若中途改为顺带接线，会改动编辑器数据加载链路与 Phase 4 已交付的资源层契约，并影响 Phase 11 的切换计划。
- **D-02:** mota 适配器（`defineEngine` 的落点）放 **`packages/apps/editor/src/adapter/`**（新建专用目录），集中存放 mota 引擎描述符与后续的 model/capability 钩子；与 PROJECT.md「编辑器自身承担 mota-js 引擎适配」一致，Phase 11 直接从此处 import。
- **D-03:** **`defineEngine` 在 core**；`EngineAdapter` 接口随之**显式演进**（加入它承载的资源描述等成员）。符合研究稿「core 定义形状、适配器遵从」，也便于 core 侧集中校验。 — **Reversibility:** costly — 给已发布的 `EngineAdapter` 加成员对实现者是破坏性变更（Phase 3 D-14 已预警），Phase 12 冻结后更难收回。
- **D-04:** **通用 `ResourceDescriptor` 不含 `path`**（也不含 `format` / `handler` 实例）。用户原则：一旦含 path，就等于 core 假定了「内容来自文件」。形状定为 `{ id, create(deps) => ResourceView<T> | Promise<ResourceView<T>>, preload?, preloadDependsOn? }`。 — **Reversibility:** costly — 这是 core 对外公开形状，Phase 12 冻结后改动影响所有适配器。
- **D-05:** 描述符里的 handler 通过 **`create` 工厂函数**表达（保留惰性构造语义，与现有 `projectData` 惰性 `new` 一致），而非预构造实例。
- **D-06:** core **内置一个带 path 的「文件支撑资源类」**（置于 `lib/resources/`，绑定 id + 不透明 IO 地址 + handler，内部用 `FileHandlerManager` + 注入的 `FsPort`）；path/IO 只存在于该类内部，不污染通用 `ResourceDescriptor`。适配器在 `create` 里使用它构造 mota 的资源。**最终类名须经 `INTERFACE-NAME.md` 确认。** — **Reversibility:** costly — 类名/构造签名是适配器直接依赖的面。
- **D-07:** 参数化路径（楼层）**由上层/适配器解析**成具体内容后再交给 core；core 永远看不到模板、参数或路径拼接。
- **D-08:** core 本阶段**不定义** `LabelOverrides` 与 `MigrationHook`。理由：core 当前无 UI、无加载/迁移执行点，定义即为无消费者的空接口。
- **D-09:** `PORT-06`（游戏词汇移出 core）**由游戏标识符门禁落地**（见 D-12/D-13）；`LabelOverrides` 等 **Phase 6+ 有 UI 消费者时**再按真实需求定义。
- **D-10:** `PORT-07`（引擎格式迁移移出 core）**由「迁移留在适配器」满足**：现有 `airwallMigration.ts` 本就在 editor 侧，本阶段不动、不迁入 core。
- **D-11:** **fake engine B = core 测试夹具**（`lib/__tests__/` 下），与 core 测试同跑；用非 mota 的逻辑 id / 描述符 / 工厂 / preload 图端到端跑通契约，证明「core 契约不是 mota 专属」。
- **D-12:** 游戏标识符门禁用 **`scripts/verify/` 独立 verifier**（沿用仓内范式：两极性证明 + `failures[]` + `process.exit(1)`），作用域 **core 生产源码 `lib/**`，排除 `__tests__`**，接入**现有四个 CI job**（不新增/改名 job）。
- **D-13:** 标识符**全清单 + 上下文匹配**：`tower / floor / loc / autopass / autotile / idnum / airwall / commonEvent / prefab / mota`；`floor` 精确排除 `Math.floor`、`.floor()` 等方法调用，两极性用例必须包含「`Math.floor` 不误报」。
- **D-14:** 本阶段决策要求修订 `ROADMAP.md`/`REQUIREMENTS.md`：`PORT-04` 去掉「opaque path key」措辞（path 降为文件支撑实现内部的 IO 地址）；`PORT-06`/`PORT-07` 下修为「门禁保证 + 迁移留适配器」，`LabelOverrides`/`MigrationHook` 顺延。**ROADMAP.md / REQUIREMENTS.md 本阶段不修改**。

### the agent's Discretion

以下均须先写入 `.planning/phases/05-engine-adapter-skeleton-resource-descriptors/INTERFACE-NAME.md`（每 Plan 一节，说明用途）并经用户确认（Project Rules）：

- `ResourceDescriptor` 各字段最终命名、`create` 的参数 `deps` 的具体形状。
- core 内置「文件支撑资源类」的类名与构造签名（见 D-06）。
- fake engine B 的文件名与导出符号名、其非 mota 资源集合的具体构成。
- verifier 文件名、排除规则实现细节与输出格式。
- `preload` 的取值集合（如 `eager` / `lazy` / `on-demand`）与默认值。
- 若新增依赖，其在 `pnpm-workspace.yaml` catalog 中的版本取值。

### Deferred Ideas (OUT OF SCOPE)

- **`LabelOverrides` 的定义与消费** —— core 本阶段不定义（D-08）；等 Phase 6+ 外壳/UI 迁入、出现真实文案需求时再定。
- **`MigrationHook` 的定义与执行点** —— core 本阶段不定义；迁移（`airwallMigration.ts`）留适配器（D-10）。
- **airwall「编辑器/游戏显示分离」一般化** —— Phase 10（地图能力）。
- **素材区多图合并** —— Phase 9（素材能力 `ASSET-*`）。
- **真正接线：改写 `projectData`、组合根切换、删除 shim 与 6 个 singleton** —— Phase 11。
- **文档修订** —— `ROADMAP.md` `PORT-04` 措辞、`PORT-06`/`PORT-07` 下修（D-14），待用户确认后由 transition/文档流程处理；本阶段不改。
- **插件加载器** —— 本期不做（PROJECT.md Out of Scope）。

None of the above is a new capability for this phase; all are explicitly out of scope or belong to later phases.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PORT-03 | `defineEngine({...})` generates the engine description; core only knows logical ids, never builds `project/...` paths or inspects extensions. | §Pattern 1 + §Code Examples ("defineEngine + validation"); core imports no path/extension logic (verified: zero production matches for `project/`, game words — §Gate). |
| PORT-04 | The 10 hardcoded paths become `ResourceDescriptor`s (narrowed by D-04: no opaque path key in the *generic* descriptor; the address lives inside the file-backed class). | §Adapter mapping (10 paths → descriptors) + §Open Question 1 (floor parameterization). |
| PORT-05 | `Json2xDataHandler` + domain `*DataHandler` live in the adapter; core keeps only generic `JsonDataHandler`. | Already satisfied structurally by Phase 4 (D-01 kept Json2x/Script in editor). Phase 5 places them under `src/adapter/` ownership; no core change needed beyond the file-backed class. |
| PORT-06 | Game vocabulary out of core. | §Game-identifier gate (D-12/D-13) + verified clean core production source. |
| PORT-07 | Engine-format migrations out of core. | `airwallMigration.ts` is already editor-side (`src/project/migrations/`); D-10 = leave it. No core change. |
| PORT-08 | Fake non-mota "engine B" drives the hook contract end to end. | §Pattern 3 (engine-B fixture design + assertions). |
## Standard Stack

**No new external dependency is expected this phase.** Everything needed already exists in-tree (verified this session). The rule of least surprise for a pure refactor is: if a task proposes adding a package, treat it as a red flag and re-check whether an existing core/workspace facility covers it.

### Core (already present, reused verbatim)

| Library / module | Version | Purpose in Phase 5 | Why this, not a new one |
|------------------|---------|--------------------|--------------------------|
| `@motajs/editor-core` `lib/resources/*` | workspace | `ResourceView`/`LoadableResource`/`combinators`/`FileHandler`/`FileHandlerManager`/`DataHandler`/`JsonDataHandler`/`ResourceRegistry` | Phase 4 already delivered all of it. Phase 5 adds **one** class + types, not a subsystem. |
| `alien-signals` | catalog (`3.1.2`) | `Content` five-state reactive signals; `computed`/`effect` used by the file-backed class via its handler | Already a core `peerDependency` (`package.json:23`); no new declaration needed. |
| `vitest` | catalog (`^4.0.16`) | engine-B contract tests + fixture | Already core's `test` script (`package.json:19`: `"test": "vitest run"`). |
| existing `scripts/verify/*.js` pattern | n/a (plain ESM) | template for the game-identifier gate | Repo convention: no test framework, `node` + `fs` + two-polarity fixtures (`coreModuleState.js`, `editorShims.js`). |

### Supporting (already present, adapter-side)

| Library / module | Version | Purpose | When to Use |
|------------------|---------|---------|-------------|
| `@motajs/file2x` | catalog | `Json2xDataHandler` decode/encode | Only inside the mota adapter's `create` factories, never core (Phase 4 D-01). |
| domain `*DataHandler` (`src/services/*`) | workspace | Tower/Items/Enemys/MapsBlocks/Icons/Functions/Plugins/Floor/TableMeta formats | Adapter only. |
| `FileHandlerManager` shim `src/fs/FileHandlerManager.ts` | workspace | legacy per-instance manager used by adapter factories | Adapter imports the shim today; Phase 11 rewires to the composition root. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| A generic `ResourceDescriptor` with `create(deps)` | A `ResourceDescriptor` with `path`/`format`/`handler` fields (ARCHITECTURE.md:274-281 original sketch) | **Rejected by D-04.** A `path` field means core assumes content comes from a file; the user explicitly refused this. The ARCHITECTURE sketch is superseded for the descriptor's internals. |
| `defineEngine` throwing one error per problem | Returning a `{ adapter, diagnostics }` result | Registration problems are diagnostic-first (research Pattern 2), but `defineEngine` is a *pure definition validator* with no `DiagnosticBus` in scope — `ResourceRegistry.register` already throws plain `Error` for the same class of problem (`resourceRegistry.ts:33-37,51`). Recommend an aggregated throwing error (mirrors `EditorCoreStartupError`), NOT a bus. |
| A core preload *runner* | A pure ordering helper + validation only | A runner has no production consumer until Phase 11 (Pitfall 6). A pure `preloadDependsOn` order function is enough for engine B and is the minimum that makes `preloadDependsOn` meaningful. See Open Question 2. |

**Installation:** none. Do not run `pnpm add`. If a catalog entry is ever needed, follow the repo rule: pin the **exact installed version** in `pnpm-workspace.yaml` `catalog:` (Phase 4 `04-01` precedent).

**Version verification:** not applicable — no package is added. Existing versions were confirmed from `packages/libs/editor-core/package.json` and `.planning/codebase/STACK.md`, not re-queried against the registry (no registry is touched).

## Package Legitimacy Audit

**No external packages are installed in this phase.** The Package Legitimacy Gate is therefore **not triggered** (this phase neither adds nor upgrades dependencies; it is a pure source refactor using existing catalog entries).

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| *(none)* | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*If a task during execution proposes a new dependency, stop and route it through `INTERFACE-NAME.md` + the Package Legitimacy Gate before proceeding — it is outside this phase's expected surface.*

## Architecture Patterns

### System Architecture Diagram

```text
   ADAPTER SIDE (packages/apps/editor)                 CORE SIDE (packages/libs/editor-core)
   ───────────────────────────────────                 ─────────────────────────────────────

   mota resources                                     EngineDescription { id, apiVersion, resources }
   (10 paths, handlers)  ──────────────┐
                                        │  defineEngine(description)
   fake engine B (test-only,           ├──────────────►  VALIDATE: ids valid+unique,
   NON-mota ids, ≥1 non-file resource) ┘                   create is a function,
                                                           preloadDependsOn ids exist,
                                                           dependency graph acyclic
                                                                   │
                                                    throws EngineDefinitionError (ALL problems)
                                                    or returns frozen EngineAdapter
                                                                   │
                                        ┌──────────────────────────┘
                                        ▼
                        for each descriptor:  await descriptor.create(deps)
                                        │
              ┌─────────────────────────┴─────────────────────────┐
              ▼                                                    ▼
   FileResource<T>  (core, lib/resources)              computedResource / custom view
   ┌─────────────────────────────────────┐             (engine B non-file resource —
   │ id (public)                          │              proves descriptor ≠ file)
   │ private address + handler factory    │
   │   deps.fileHandlers.get(address)     │
   │   → FileHandler → IDataHandler<T>    │
   │ content = handler.content (signal)   │
   └──────────────┬──────────────────────┘
                  │ FileHandler
                  ▼
        FileHandlerManager  ──► injected FsPort  ──► host (HTTP / memfs)
        (per-instance; core holds no Fs impl)

                        register into ResourceRegistry (RES-02)
                                        │
                                        ▼
                        registry.get<T>('engineB.xxx') → ResourceView<T>
                                        │
                                        ▼
                        preload order resolved from preloadDependsOn
                        (dependency id before dependent id)

   NOTE: no arrow ever crosses from core back into the adapter; core never sees a path,
         a file extension, a template, or an engine word.
```

### Recommended Project Structure

```text
packages/libs/editor-core/lib/
├── ports/
│   └── engine.ts            # EXTENDED: EngineAdapter + ResourceDescriptor<T> + EngineDescription
│                            #           + defineEngine() + EngineDefinitionError (name TBD)
├── resources/
│   ├── fileResource.ts      # NEW: the one file-backed class (path lives only here — D-06)
│   ├── resourceRegistry.ts  # existing (Phase 4) — target of registration
│   ├── combinators.ts       # existing — ResourceView / LoadableResource / computedResource
│   ├── dataHandler.ts       # existing — abstract base for adapter handlers
│   ├── jsonDataHandler.ts   # existing — the ONLY generic handler core keeps
│   └── fileHandler{,Manager}.ts  # existing — per-instance file layer
├── __tests__/
│   ├── engineB.ts           # NEW fixture: non-mota engine description (test-only)
│   ├── engineContract.test.ts  # NEW: end-to-end contract tests
│   └── coreApiSurface.test.ts  # EXTENDED: assert the new exports exist
└── index.ts                 # EXTENDED: export the new public names

packages/apps/editor/src/adapter/   # NEW directory (D-02), no production consumer until Phase 11
├── motaEngine.ts            # motaEngine = defineEngine({ id:'mota-js', resources:[...] })
└── motaFloor.ts             # parameterized floor descriptor factory (name TBD — D-07)

scripts/verify/
└── coreEngineNeutral.js     # NEW two-polarity game-identifier gate (name TBD — D-12/D-13)
```

### Pattern 1: `defineEngine` is a pure, aggregated validator that returns a frozen description

**What:** `defineEngine(description)` performs all structural validation synchronously, collects **all** problems, and either returns a frozen `EngineAdapter` or throws one error carrying every problem. It does **not** register anything, construct anything, or touch a bus.
**When to use:** every engine adapter definition, including the mota adapter and engine B.
**Why this shape:** it mirrors two existing first-party precedents — `ResourceRegistry.register` (throws a plain `Error` for invalid/duplicate ids, `resourceRegistry.ts:33-37,51`) and `EditorCoreStartupError` (collect-all-then-throw-once, `kernel/core.ts:227-230`). A `DiagnosticBus` is deliberately out of scope because `defineEngine` runs at module-definition time, before any core instance exists (`resourceRegistry.ts` header explicitly avoids bus coupling to keep `DIAGNOSTIC_CODES` at exactly five).

**Validation rules (all must be implemented):**
1. `id` is a non-empty string; if the descriptor also carries a logical id it must match `Registry`'s grammar (see §Code Examples).
2. descriptor `id`s are **unique** within `resources`.
3. `create` is a function (`typeof === 'function'`).
4. every `preloadDependsOn` entry references an id that exists in the same `resources` array.
5. the `preloadDependsOn` graph is **acyclic** (DFS with an on-stack set; report every edge that closes a cycle, not just the first).
6. `preload`, when present, is one of the allowed literals.
7. `apiVersion`, when present, is a non-empty string (see Pattern 2).

### Pattern 2: `EngineAdapter` evolves additively; `apiVersion` stays explicit

**What:** the existing minimal interface gains `resources` (required); `defineEngine` fills `apiVersion` from a core constant when the description omits it.
**When to use:** this is the one explicit interface evolution Phase 3 D-14 pre-announced.
**Constraint from Phase 3 D-14:** adding a member to a published interface is breaking for implementers. There are **zero production implementers** today (only the type-level assertion `expectTypeOf<EngineAdapter>().toBeObject()` in `coreApiSurface.test.ts:126`), so the break is theoretical. Making `resources` **required** is the honest choice: an adapter with no resources describes nothing.

**Versioning recommendation (needs INTERFACE-NAME confirmation):**
- Add `ENGINE_ADAPTER_API_VERSION` in core (parallel to `EDITOR_CORE_API_VERSION = '0.1.0'`, `kernel/core.ts:25`) and have `defineEngine` default `apiVersion` to it. Rationale: the engine-adapter contract and the core public API are two different contracts on two different clocks; Phase 12 freezes the extension surface, and a single shared constant would conflate "core API changed" with "adapter contract changed".
- `EngineAdapter.apiVersion` keeps its existing meaning (the contract the adapter implements), so an adapter written against an older shape can still declare that.
- **Risk if wrong:** adding a second version constant before freeze edges toward speculative surface (Pitfall 6). Acceptable because the field already exists and only the *default source* is new; flag in INTERFACE-NAME so the user can veto in favour of reusing `EDITOR_CORE_API_VERSION`.

### Pattern 3: the engine-B fixture proves the contract is not mota-shaped

**What:** a test-only non-mota engine description that (a) uses non-mota logical ids, (b) includes at least one **non-file** resource (content created on the spot), and (c) has a multi-level `preloadDependsOn` graph.
**When to use:** `lib/__tests__/engineContract.test.ts`, run with every core test.
**Why:** PITFALLS Pitfall 14 requires a second engine before the hook freezes; the warning sign is exactly "the fake adapter cannot implement a hook without copying mota logic". Including a non-file resource is what mechanically proves D-04 ("you cannot assume content comes from a file").

**Concrete engine-B shape (names to confirm):**
- ids: `engineB.catalog` (file-backed via `FileResource` + `MemoryFsPort`), `engineB.index` (file-backed), `engineB.notes` (**non-file**, e.g. `computedResource('engineB.notes', [catalog], () => ...)`), `engineB.chapter` (`preloadDependsOn: ['engineB.index']`).
- handler for the file-backed ones: a tiny `JsonDataHandler<...>` subclass defined inside the fixture (NOT `Json2xDataHandler`, to prove core's generic handler is sufficient).
- preload graph: `index` → `chapter`; `catalog` → (eager); `notes` derived from `catalog`.

**End-to-end assertions the test must make:**
1. `defineEngine(engineB).id === 'engineB'` and `resources` is frozen with ids in the declared order.
2. Each `descriptor.create(deps)` produces a `ResourceView<T>`; `registry.register(id, view)` then `registry.get(id)` returns the same view; `registry.ids()` matches the declared ids.
3. Calling `content()`/`ensureLoaded()` on the file-backed view reads through `MemoryFsPort` and the handler yields `loaded`; a missing path yields `not-found` (preserves RES-05 semantics).
4. The **non-file** view loads without any `FsPort` interaction (assert the spy/`MemoryFsPort` was not read).
5. Preload order (helper or manual) lists every dependency before its dependents; a cycle and a dangling `preloadDependsOn` each make `defineEngine` throw, and the thrown error reports **all** problems at once (give it ≥2 problems and assert both are present).
6. Duplicate ids are rejected; a non-function `create` is rejected.
7. The fixture source contains none of the banned words (self-check; also a nice regression against accidental copy-paste of mota ids into the fixture).

### Anti-Patterns to Avoid

- **Putting `path`, `format`, `handler`, or a filename template into the generic `ResourceDescriptor`.** Violates D-04 and re-introduces Pitfall 3. The address belongs inside `FileResource`; the handler belongs inside the adapter's `create` closure.
- **Making `defineEngine` register into a `ResourceRegistry`.** Registration requires per-instance deps; `defineEngine` runs before any instance exists. Keep definition (pure) separate from registration (Phase 11).
- **Building a core preload runner with no production caller.** Pitfall 6. Provide only the pure order/validation that engine B can exercise (Open Question 2).
- **Touching `projectData.ts` to "wire it up".** D-01 forbids it; wiring is Phase 11.
- **A file-backed class that inspects extensions or concatenates paths.** Core must treat the IO address as an opaque string (`ports/fs.ts:16-18` explicitly states core does no path normalisation and owns no path-traversal surface).
- **Using `@/` inside core.** Core source uses relative imports only (`lib/` internal, Phase 2 D-06); `@/` resolves to `lib/*` via `resolvePlugin.js` but the convention is relative.
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Logical-id → resource storage | A new map/registry in the adapter | `ResourceRegistry` (`lib/resources/resourceRegistry.ts`) | Already per-instance, prototype-pollution-safe, id-grammar-validating, `dispose`-friendly. RES-02 shipped unwired **specifically for Phase 5 to consume** (STATE.md). |
| File instance caching / load locking / per-path serialized persistence | A second file layer | `FileHandlerManager` + `FileHandler` + `PersistenceMonitor` (Phase 4) | Per-path cache + in-flight load lock + one-executing-one-pending persistence already exist and are tested. The file-backed class is a thin façade over them. |
| Reactive derived content | Manual subscription bookkeeping | `computed` / `computedResource` / `aggregateResource` (`combinators.ts`) | Returns `LoadableResource<T>` that is structurally a `ResourceView<T>`; preserves RES-06 liveness. |
| JSON parsing for non-mota engines | A bespoke decoder | `JsonDataHandler<T>` (`lib/resources/jsonDataHandler.ts`) | It is the generic handler core keeps (PORT-05). Engine B uses it; core adds no format. |
| Two-polarity gate scaffolding | A novel test harness | `scripts/verify/coreModuleState.js` / `editorShims.js` | Write a synthetic fixture in `finally`-deleted temp file, assert the violation is caught, then assert the file is gone. Copy the `check()`/`failures[]`/`process.exit(1)` skeleton. |
| Contract-version defaults | Ad-hoc version strings at call sites | A core constant + `defineEngine` default (Pattern 2) | Matches `EDITOR_CORE_API_VERSION` / `RUNTIME_PROTOCOL_VERSION` convention. |

**Key insight:** this phase adds a contract, not machinery. Every runtime facility it needs was delivered by Phases 2–4; the new code is types + one thin class + validation + a test fixture + a verifier.

## Common Pitfalls

### Pitfall A: The floor template smuggled back into the generic descriptor (D-04/D-07)
**What goes wrong:** the adapter makes `mota.floor` a static descriptor again by giving `create` the ability to receive a parameter (e.g. `create(deps, id)` or a `parameterized: true` flag). Core then knows parameters/templates exist.
**Why it happens:** the ARCHITECTURE sketch (`ARCHITECTURE.md:299`) literally shows `path: "project/floors/{id}.js"` in a descriptor; copying it is the path of least resistance.
**How to avoid:** keep `create(deps)` with a **fixed** signature and no id parameter. Parameterization is resolved *outside* core: the adapter exports a factory that, given a `floorId`, returns a **concrete** `ResourceDescriptor`. See Open Question 1.
**Warning signs:** `{id}` or `{...}` appears in any core source; a descriptor field beyond `{id, create, preload, preloadDependsOn}` appears.

### Pitfall B: The game-identifier gate has a false positive on `Math.floor`
**What goes wrong:** a naive `\bfloor\b` regex flags `Math.floor(...)` and `.floor(...)`, turning a legitimate numeric helper into a build failure. The user also removed an existing false positive at design time (a previous grep had no such exclusion).
**Why it happens:** word-boundary matching cannot distinguish a game concept from a `Number` method.
**How to avoid:** a match is a violation unless the character immediately preceding `floor` is `.` (member access). That single rule covers both `Math.floor` and `.floor()`; a standalone `floor(...)` free function would still be flagged (correct — core should not have one). The two-polarity fixture **must** include a `Math.floor(...)` line that asserts zero messages. (D-13.)
**Warning signs:** the gate fires on `lib/edit/*` or any numeric helper; the fixture lacks the `Math.floor` clean-case.

### Pitfall C: `loc` matches substrings/false friends
**What goes wrong:** a loose matcher flags `localStorage`, `location`, `block`, `alloc`, `clock`, or camelCase handles like `locState`.
**Why it happens:** `loc` is a short substring.
**How to avoid:** `\bloc\b` with JS word boundaries does **not** match `local`, `location`, or `locState` (the following char is a word char). Keep the word-boundary form; do not use `includes('loc')`.
**Warning signs:** the verifier reports hits in files that clearly contain no game concept; the fixture uses only the bare word and never a false friend (add one false friend to the clean-case set to prove it: e.g. `localStorage` in the fixture must stay clean — though note core already bans `localStorage` under PORT-02, so use `location` or a `locState`-like identifier instead).

### Pitfall D: Comments vs. code in the gate scope
**What goes wrong:** the gate either misses a leak hidden in a comment, or it flags an innocuous Chinese comment. Core production comments currently contain **zero** game words (verified — §Gate), so including comments is safe today.
**Why it happens:** "production source" is ambiguous.
**How to avoid:** decide explicitly and document in the verifier header. Recommendation: scan the **raw source text including comments** (strongest, simplest, matches "no game identifier remains in core source" literally), and record that core comments must remain engine-neutral. Do **not** reuse `editorShims.js`'s `stripComments()` here — that would weaken the gate. (If the user prefers code-only, reuse the existing `stripComments()` helper; that is the alternative, and it must then be stated in `INTERFACE-NAME.md`.)
**Warning signs:** a leak passes because it was in a `//` comment; or a false red because a comment referenced the adapter by name.

### Pitfall E: Extending `EngineAdapter` breaks something silently
**What goes wrong:** a required new member (`resources`) breaks a type-only assertion or a future adapter; or `defineEngine`'s return type widens to `any`.
**Why it happens:** interface evolution is a breaking change by definition (Phase 3 D-14).
**How to avoid:** make `resources` required (no implementers exist), keep `defineEngine`'s return exactly `EngineAdapter`, and extend `coreApiSurface.test.ts` to compile-assert the new members. Run the full `pnpm typecheck` (not just core's) before finishing.
**Warning signs:** `expectTypeOf` assertions fail; editor typecheck fails because a shim re-export changed shape.

### Pitfall F: `subpathStatus.json` / `coreExports.js` drift when `.` gains exports
**What goes wrong:** `lib/index.ts` gains new exports but the `.` `content` label in the manifest/verifier pair is not kept in sync, red-ing the `typecheck` job (`coreExports.js` runs there).
**Why it happens:** the label is a hand-maintained contract (`coreExports.js:78-82`; `subpathStatus.json`).
**How to avoid:** decide whether the new exports fit the existing label (`kernel+resources+edit-exports`) or warrant a new one (e.g. `kernel+resources+edit+adapter-exports`); change `coreExports.js` and `subpathStatus.json` **in the same commit** (the verifier header calls this out as a Pitfall-8 contract).
**Warning signs:** `node scripts/verify/coreExports.js` fails after adding exports; the two files disagree.

### Pitfall G: The adapter creates a dependency cycle
**What goes wrong:** `src/adapter/*` imports `projectData`, or `projectData` imports the adapter, or the adapter imports the temporary `src/appInstances.ts` singleton directly.
**Why it happens:** the adapter needs `FileHandlerManager`; the naive import is `@/fs/FileHandlerManager` (the shim that re-exports the app-instance singleton). That is acceptable (the shim is the Phase-4 bridge and Phase 11 replaces it), but importing `projectData` is not.
**How to avoid:** adapter imports only the **contract** from `@motajs/editor-core`, the **handler classes** from `@/services/*` + `@/fs/Json2xDataHandler`, and the manager shim. It must not import `@/project/data/projectData`. `projectData` must not import `@/adapter`. Dependency-cruiser (`core-must-not-import-consumers`, `no-circular`) plus the editor typecheck catch most of it.
**Warning signs:** a cycle reported by `pnpm lint`/dependency-cruiser; adapter importing `projectData`.

## Code Examples

All shapes below are grounded in source read this session. Values that must be confirmed by the user are marked via `INTERFACE-NAME.md`.

### The existing interface being extended

`[VERIFIED: packages/libs/editor-core/lib/ports/engine.ts:9-14]` — the exact current shape (Phase 5 adds `resources`):
```ts
export interface EngineAdapter {
  /** 适配器的逻辑身份，供 Phase 5 以它作为引擎描述的键（`EngineAdapter.id`）。 */
  readonly id: string;

  /** 适配器实现的契约版本（`EngineAdapter.apiVersion`）。 */
  readonly apiVersion: string;
}
```

### The generic `ResourceDescriptor` + `defineEngine` (proposed shape — names to confirm)

```ts
import type { ResourceView } from '../resources/combinators';

/** What a create factory receives. Minimal by design — no path, no registry, no bus. */
export interface ResourceDependencies {                 // name TBD (INTERFACE-NAME)
  /** The per-instance file layer; only file-backed factories use it. */
  readonly fileHandlers: FileHandlerManager;            // name/type TBD
}

export type PreloadStrategy = 'eager' | 'lazy' | 'on-demand';   // value set + default TBD (D-13-ish discretion)

export interface ResourceDescriptor<T = unknown> {
  readonly id: string;
  readonly create: (deps: ResourceDependencies) => ResourceView<T> | Promise<ResourceView<T>>;
  readonly preload?: PreloadStrategy;
  readonly preloadDependsOn?: readonly string[];
}

export interface EngineDescription {
  readonly id: string;
  readonly apiVersion?: string;                         // defaulted by defineEngine (Pattern 2)
  readonly resources: readonly ResourceDescriptor[];    // ResourceDescriptor<unknown>[]; variance is safe
}

/** Validates everything, throws EngineDefinitionError carrying ALL problems, else returns a frozen adapter. */
export function defineEngine(description: EngineDescription): EngineAdapter;
```

**Variance note (verified reasoning):** `ResourceDescriptor<TowerData>` is assignable to `ResourceDescriptor<unknown>` because `ResourceView<T>` is covariant in `T` (it only *produces* `T`: `value(): T`, `content: ReadonlySignal<Content<T>>` where `ReadonlySignal<T> = () => T`). `[VERIFIED: packages/libs/editor-core/lib/resources/interfaces.ts:12]`:
```ts
export type ReadonlySignal<T> = () => T;
```
and `[VERIFIED: packages/libs/editor-core/lib/resources/combinators.ts:8-20]`:
```ts
export interface ResourceView<T> {
  readonly id: string;
  readonly content: ReadonlySignal<Content<T>>;
  snapshot(): Content<T>;
  value(): T;
  subscribe(listener: (content: Content<T>) => void): () => void;
}

export interface LoadableResource<T> extends ResourceView<T> {
  ensureLoaded(): Promise<void>;
  reload(): Promise<void>;
  waitForSettled(): Promise<void>;
}
```

### The id grammar `defineEngine` must reuse (not reinvent)

`[VERIFIED: packages/libs/editor-core/lib/resources/resourceRegistry.ts:26,29]`:
```ts
const LOGICAL_ID_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*(\.[A-Za-z_$][A-Za-z0-9_$]*)*$/;
```
```ts
const RESERVED_IDS = Object.freeze(['__proto__', 'constructor', 'prototype']);
```
`defineEngine` should validate its descriptor ids against the **same** grammar (either by exporting a shared predicate from `resourceRegistry.ts` or by duplicating the two constants with a comment linking them). Do not let the two drift: a descriptor whose id `ResourceRegistry.register` later rejects is a definition-time bug that would otherwise surface only at registration.

### The file-backed class (proposed — name/signature to confirm, D-06)

```ts
import type { FsPort } from '../ports/fs';
import type { FileHandler } from './fileHandler';
import type { FileHandlerManager } from './fileHandlerManager';
import type { IDataHandler } from './interfaces';
import type { LoadableResource } from './combinators';
import type { Content } from './types';
import type { ReadonlySignal } from './interfaces';

/**
 * A ResourceView whose content comes from an opaque IO address.
 * `address` and the FileHandler are PRIVATE — path/IO exist only inside this class (D-06).
 * Engine-agnostic: it inspects no extension and concatenates no path.
 */
export class FileResource<T> implements LoadableResource<T> {   // name TBD
  readonly id: string;
  readonly content: ReadonlySignal<Content<T>>;
  private readonly manager: FileHandlerManager;
  private readonly address: string;
  private readonly handler: IDataHandler<T>;

  constructor(
    id: string,
    address: string,
    handlerFactory: (file: FileHandler) => IDataHandler<T>,
    deps: ResourceDependencies,
  ) {
    this.id = id;
    this.address = address;
    this.manager = deps.fileHandlers;
    const file = deps.fileHandlers.get(address);   // per-path cache; creates on first use
    this.handler = handlerFactory(file);
    this.content = this.handler.content;
  }

  snapshot(): Content<T> { return this.handler.getContent(); }
  value(): T { return ContentUtils.unwrap(this.handler.getContent(), this.id); }
  subscribe(listener: (c: Content<T>) => void): () => void { return this.handler.subscribe(listener); }

  async ensureLoaded(): Promise<void> {
    await this.manager.load(this.address);   // load lock + refetch semantics live in the manager
  }
  async reload(): Promise<void> { await this.manager.reload(this.address); }
  async waitForSettled(): Promise<void> { await this.handler.waitForSettled(); }
}
```

Grounded in the existing delegates — `FileHandlerManager.get`/`.load`/`.reload` `[VERIFIED: packages/libs/editor-core/lib/resources/fileHandlerManager.ts:37-46,57-87,162-165]`:
```ts
  get(path: string): FileHandler {
    let handler = this.handlers.get(path);

    if (!handler) {
      handler = new FileHandler(path, this.deps);
      this.handlers.set(path, handler);
    }

    return handler;
  }
```
The manager's dependencies already carry the injected `FsPort` — `[VERIFIED: packages/libs/editor-core/lib/resources/fileHandler.ts:17-20]`:
```ts
export interface FileHandlerDependencies {
  readonly fs: FsPort;
  readonly persistenceMonitor: PersistenceMonitor;
}
```
The handler base takes the `FileHandler` — `[VERIFIED: packages/libs/editor-core/lib/resources/dataHandler.ts:30]`:
```ts
  constructor(fileHandler: FileHandler, resourceName: string) {
```
and core's only generic handler — `[VERIFIED: packages/libs/editor-core/lib/resources/jsonDataHandler.ts:19-40]` (extends `DataHandler`, `parse` = `JSON.parse`, `stringify` = `JSON.stringify`).

> **Call-chain (answers research Q2):** `descriptor.create(deps)` → `new FileResource(id, address, handlerFactory, deps)` → `deps.fileHandlers.get(address)` → `new FileHandler(address, {fs, persistenceMonitor})` → `handlerFactory(file)` returns a `DataHandler<T>` subclass → `this.content = handler.content` (an `alien-signals` `computed`) → returned object is a `LoadableResource<T>` → `ResourceRegistry.register(id, view)` stores it → `registry.get<T>(id)` returns it. Derived/model resources compose via `computedResource`/`aggregateResource` on top, but the 10 base descriptors do not need them; engine B's non-file resource uses `computedResource` to prove the descriptor is source-agnostic.

### The 10 hardcoded paths Phase 5 must express (reference, NOT to be edited)

`[VERIFIED: packages/apps/editor/src/project/data/projectData.ts:20-28]`:
```ts
const TOWER_DATA_PATH = 'project/data.js';
const ITEMS_DATA_PATH = 'project/items.js';
const ENEMYS_DATA_PATH = 'project/enemys.js';
const MAPS_BLOCKS_DATA_PATH = 'project/maps.js';
const ICONS_DATA_PATH = 'project/icons.js';
const FUNCTIONS_DATA_PATH = 'project/functions.js';
const PLUGINS_DATA_PATH = 'project/plugins.js';
const EVENTS_DATA_PATH = 'project/events.js';
const EVENTS_VAR_NAME = 'events_c12a15a8_c380_4b28_8144_256cba95f760';
```
`[VERIFIED: packages/apps/editor/src/project/data/projectData.ts:76-78]`:
```ts
function floorPath(floorId: string): string {
  return `project/floors/${floorId}.js`;
}
```
`[VERIFIED: packages/apps/editor/src/services/editorConfig/editorConfigService.ts:18]`:
```ts
const CONFIG_PATH = '_server/config.json';
```
(Count: 8 constants + floor template + config = **10**, matching D-14/CONTEXT. Note the adapter will also need the 5 `META_FILE_CONFIG` table-meta paths and the `commonEvents` derived resource — see Open Question 3.)

### mota adapter sketch (no consumer this phase)

```ts
// packages/apps/editor/src/adapter/motaEngine.ts   (name TBD)
import { defineEngine } from '@motajs/editor-core';
import { Json2xDataHandler } from '@/fs/Json2xDataHandler';
import { TowerDataHandler } from '@/services/tower/TowerDataHandler';
// …other domain handlers…
import { EVENTS_VAR_NAME } from './motaConstants';   // moved out of projectData? NO — see note

export const motaEngine = defineEngine({
  id: 'mota-js',
  resources: [
    { id: 'mota.tower',    preload: 'eager', create: (deps) =>
        new FileResource('mota.tower', 'project/data.js', (f) => new TowerDataHandler(f), deps) },
    // …items / enemys / maps / icons / functions / plugins / events…
    // …the 10th: editor config (address '_server/config.json', JsonDataHandler<EditorConfig>)…
  ],
});
```
**Important constraint (D-01):** the adapter must **duplicate** the address/var-name literals it needs (or import them from a new adapter-local constants module); it must **not** edit `projectData.ts` to export them. Duplication here is deliberate and is removed in Phase 11 when `projectData` is rewritten to consume the adapter. Flag this duplication explicitly in the plan so it is not mistaken for a leak.
## Adapter mapping: the 10 paths → descriptors (research Q7)

This table is the reference for the adapter plan. `Handler` names are the existing editor classes; the adapter's `create` closure constructs them lazily (D-05).

| # | Logical id (proposed) | IO address (adapter-private) | Handler factory | preload | preloadDependsOn |
|---|------------------------|------------------------------|-----------------|---------|------------------|
| 1 | `mota.tower` | `project/data.js` | `(f) => new TowerDataHandler(f)` | eager | — |
| 2 | `mota.items` | `project/items.js` | `(f) => new ItemsDataHandler(f)` | eager | — |
| 3 | `mota.enemys` | `project/enemys.js` | `(f) => new EnemysDataHandler(f)` | eager | — |
| 4 | `mota.maps` | `project/maps.js` | `(f) => new MapsBlocksDataHandler(f)` | eager | — |
| 5 | `mota.icons` | `project/icons.js` | `(f) => new IconsDataHandler(f)` | eager | — |
| 6 | `mota.functions` | `project/functions.js` | `(f) => new FunctionsDataHandler(f)` | eager | — |
| 7 | `mota.plugins` | `project/plugins.js` | `(f) => new PluginsDataHandler(f)` | eager | — |
| 8 | `mota.events` | `project/events.js` | `(f) => new Json2xDataHandler<EventsData>(f, EVENTS_VAR_NAME, 'Events Data')` | eager | — |
| 9 | floor family | `project/floors/${floorId}.js` | `(f) => new FloorDataHandler(f, floorId)` | on-demand | `['mota.tower']` |
| 10 | `mota.editorConfig` | `_server/config.json` | `(f) => new JsonDataHandler<EditorConfig>(f, 'Editor Config')` | lazy | — |

Notes:
- Rows 1–8 map 1:1 to the existing `HandlerDataResource` constructions in `projectData.ts:98-198`; row 10 maps the `editorConfigService` path (`editorConfigService.ts:18`). Row 9 is the parameterized case → Open Question 1.
- The adapter's `create` closures must use the **shim** imports (`@/fs/FileHandlerManager` is not needed at all if `deps` supplies the manager). The adapter should depend on `ResourceDependencies.fileHandlers` rather than importing the manager singleton directly — this is what keeps it Phase-11-ready.
- The current preload *behavior* also batches at concurrency 6 and defers floors until `tower` resolves (`projectData.ts:232-297`). That behavior is **not** reproduced this phase (no consumer, no wiring); the descriptor's `preloadDependsOn` is the declarative encoding of "floors depend on tower".

## Game-identifier gate (research Q6)

**Deliverable:** `scripts/verify/<name>.js` (recommend `coreEngineNeutral.js`; confirm via INTERFACE-NAME), wired into the existing **lint** job beside `coreBoundaries.js` / `coreModuleState.js` / `editorShims.js`.

**Existing wiring (must not add/rename jobs)** `[VERIFIED: .github/workflows/ci.yml:31-37]`:
```yaml
      - run: pnpm lint

      - run: node scripts/verify/coreBoundaries.js

      - run: node scripts/verify/coreModuleState.js

      - run: node scripts/verify/editorShims.js
```
Add one more `- run:` line. `scripts/verify/ci-workflow.js` asserts only the four job ids + root scripts (`JOB_SCRIPTS`, `JOB_IDS`), so it needs **no** change.

**Structure to copy** (from `coreModuleState.js` / `editorShims.js`): ESM `#!/usr/bin/env node`, Chinese header comment, `failures[]`, `check(condition, message)`, `relative(path)`, a `collectSources(dir)` walker, `main()`, and `process.exit(1)` on failure.

**Algorithm:**
1. Walk `packages/libs/editor-core/lib` recursively; keep `*.ts`/`*.tsx`; **exclude any path containing a `__tests__` segment** (covers `lib/__tests__/` and `lib/**/__tests__/`). This is the D-12 scope.
2. For each file, scan the raw source (see Pitfall D) for each word in the full list with `\b` boundaries.
3. Special-case `floor`: a hit is a violation **unless** the immediately preceding character is `.` (covers `Math.floor`, `.floor()`). Implement as a per-match check, not a different regex, so the two-polarity fixture can prove the exclusion.
4. Assert the scan covered **> 0** files (zero-file scans must fail, per `editorShims.js` `check(sources.length > 0, …)`).
5. **Two-polarity:** write a transient fixture into core production source (e.g. `lib/__engineNeutralProbe__.ts`) containing each banned word once **plus** a `Math.floor(...)` line and a `location`/false-friend line; drop it in `finally`, assert it is deleted; then assert the checker flags every banned word and flags **none** of the clean cases.

**Verified starting state:** core production source (`lib/**`, excluding `__tests__`) currently contains **zero** matches for any of the ten words and zero matches for `project/`, `.animate`, `_server/`, `data.js` (searched this session). The only current matches are in `lib/**/__tests__/**` (e.g. `resourceRegistry.test.ts:33-140` legitimately uses `mota.tower`/`tower`), which the scope excludes. This means the gate should be **green on arrival** — if it is red, a real leak exists and must be fixed as part of the phase.

**Do not** weaken the gate to make a leak pass; the whole point (D-09/PORT-06) is that the vocabulary is *gone* from core, and the core comments/fixtures may mention the adapter only through the new contract's neutral vocabulary.

## Playback: files touched/created + verify commands (research Q8)

### Created

| Path | Purpose |
|------|---------|
| `packages/libs/editor-core/lib/resources/fileResource.ts` (name TBD) | The one file-backed class (D-06). |
| `packages/libs/editor-core/lib/__tests__/engineB.ts` (name TBD) | Non-mota fixture (D-11). |
| `packages/libs/editor-core/lib/__tests__/engineContract.test.ts` (name TBD) | End-to-end contract tests (D-11). |
| `packages/apps/editor/src/adapter/motaEngine.ts` + floor factory (names TBD) | mota adapter (D-02); dead code this phase. |
| `scripts/verify/coreEngineNeutral.js` (name TBD) | Game-identifier gate (D-12/D-13). |
| `.planning/phases/05-…/INTERFACE-NAME.md` | **Must exist and be confirmed BEFORE code** (Project Rule). |

### Modified

| Path | Change | Caveat |
|------|--------|--------|
| `packages/libs/editor-core/lib/ports/engine.ts` | Add `ResourceDescriptor`, `EngineDescription`, `defineEngine`, error type; widen `EngineAdapter` with `resources`. | Explicit interface evolution (D-03). |
| `packages/libs/editor-core/lib/index.ts` | Named re-exports of the new public names. | Leaf module — no back-imports (would be `no-circular`). |
| `packages/libs/editor-core/lib/__tests__/coreApiSurface.test.ts` | Assert the new exports (value + type-level). | Mirrors Phase 3/4 pattern (`coreApiSurface.test.ts`). |
| `.github/workflows/ci.yml` | One `- run:` line in the **lint** job. | Do not add/rename jobs. |
| `scripts/verify/coreExports.js` + `.planning/phases/02-…/subpathStatus.json` | Only if the `.` `content` label is changed. | Keep the two in sync in one commit (Pitfall F). |

### Explicitly NOT modified

- `packages/apps/editor/src/project/data/projectData.ts` (D-01 — "一行不改").
- `packages/apps/editor/src/services/editorConfig/editorConfigService.ts`.
- `ROADMAP.md` / `REQUIREMENTS.md` (D-14).
- `airwallMigration.ts` (D-10).
- `pnpm-workspace.yaml` (no new dependency expected).
- Any of the six editor singletons or their shims (Phase 11).

### Verify commands likely relevant

```bash
# targeted (fast loop)
pnpm --filter @motajs/editor-core test            # vitest run (engine-B + all core tests)
pnpm --filter @motajs/editor-core typecheck       # tsc -b
pnpm --filter @motajs/editor typecheck            # adapter dir must compile (verbatimModuleSyntax, erasableSyntaxOnly)
pnpm lint                                          # eslint . (includes editor + core)
node scripts/verify/coreEngineNeutral.js          # new gate (two-polarity)
node scripts/verify/coreModuleState.js            # must stay green
node scripts/verify/coreBoundaries.js             # must stay green
node scripts/verify/editorShims.js                # must stay green
node scripts/verify/coreExports.js                # must stay green (typecheck job)

# full gate (matches the four CI jobs)
pnpm typecheck
pnpm test
pnpm lint
pnpm format:check
pnpm build                                        # build job; editor artifact must be byte-shape-unchanged in behavior
```

**Outward-behavior parity:** no editor runtime file is touched, so the Phase-1 screenshots and artifact metrics should not move. Still diff `editor-manifest.json` / bundle size after `pnpm build` as a sanity check (Pitfall 15), because `lib/index.ts` grew and the adapter adds a (currently unimported) module — a dead module must not be pulled into any entry.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Module singletons (`projectData`, `FileHandlerManager`, …) | per-instance classes + injected `FsPort` | Phase 4 | The file-backed class takes the manager via `deps`; no singleton in core. |
| Descriptor with `path`/`format`/`handler` (ARCHITECTURE `:274-281`) | Descriptor `{id, create, preload?, preloadDependsOn?}`; source-agnostic | Phase 5 D-04/D-05 | Core cannot assume content is a file; parameterization is the adapter's job. |
| Game vocabulary/format assumed by core | Gate-enforced absence | Phase 5 D-12/D-13 | `PORT-06` is satisfied mechanically, not by review. |

**Deprecated/outdated:** the ARCHITECTURE `ResourceDescriptor` sketch with `path`/`format`/`handler` is superseded by D-04 for this phase; treat it as a *sketch*, not a spec.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The generic descriptor's `create` should take exactly `deps: { fileHandlers: FileHandlerManager }` (name to confirm). | Code Examples / Pattern 1 | If later resource shapes need more deps (diagnostics, host, asset ports), the signature is a breaking change post-freeze. Mitigated by making `ResourceDependencies` an object (additive fields later). |
| A2 | `resources` on `EngineAdapter` should be **required**, not optional. | Pattern 2 | If the user wants purely additive safety, make it optional; engine B/mota still provide it. Required is more honest but is a "breaking" evolution. |
| A3 | A dedicated `ENGINE_ADAPTER_API_VERSION` constant is worth adding now. | Pattern 2 | Speculative surface (Pitfall 6); fallback is to default `apiVersion` from `EDITOR_CORE_API_VERSION`. |
| A4 | A pure preload-order helper should be added to core (vs. validation-only). | Open Question 2 | If the user rejects any test-only core helper, engine B's preload-order assertion must be done manually in the test. |
| A5 | The gate scans raw source **including comments**, and `floor`'s exclusion is "preceded by `.`". | Pitfall D / Gate | If code-only is preferred, use `stripComments()`. If a different `floor` exclusion is intended, the fixture must be adjusted. |
| A6 | The adapter may duplicate path/var-name literals rather than exporting them from `projectData.ts`. | Adapter mapping note | D-01 forbids editing `projectData`; duplication is the only additive path. If the user prefers a shared adapter-local constants module, that is an internal detail. |
| A7 | `preload` value set `'eager' | 'lazy' | 'on-demand'` and a default. | Standard Stack / Discretion | Value set/default is explicitly the agent's discretion → must be confirmed in INTERFACE-NAME. |

**If any row is left `[ASSUMED]`-shaped in a plan:** the discuss/plan step must confirm it before locking. The high-impact ones are A1, A2, A4 (public shape) and A7 (literal set).

## Open Questions (RESOLVED)

> All four questions below are resolved; each is tagged with its resolution and the plan that implements it.
> No unresolved open question remains (the plans' "Assumptions & Flags" sections reference these resolutions).

1. **How is the parameterized floor resource represented? (highest priority)** — RESOLVED: adapter-side factory `motaFloorDescriptor(floorId)` (05-04 Tasks 1–2); `motaEngine.resources` holds only the nine fixed descriptors.
   - What we know: D-04 forbids `path`/templates in the generic descriptor; D-07 says the adapter resolves parameters into concrete content before core. The current code keys floors by `floor:${floorId}` (`projectData.ts:114`) and builds `project/floors/${floorId}.js` (`:76-78`).
   - What's unclear: whether `motaEngine.resources` should contain (a) a single "floor family" entry in some non-generic adapter-side structure, (b) a factory `motaFloorDescriptor(floorId): ResourceDescriptor<FloorData>` exported from the adapter (static array holds only the fixed 9), or (c) something else.
   - Recommendation: **(b)** — the adapter exports a parameterized factory producing concrete descriptors; `motaEngine.resources` holds the fixed descriptors and documents the floor family in a comment. This is the only shape that keeps core template-free while making "the adapter resolves parameters" concrete. **Also flag the id-grammar risk:** a real `floorId` may not satisfy `LOGICAL_ID_PATTERN` (e.g. contains non-word chars); decide whether the parameterized factory sanitizes/encodes the id or whether the registry's grammar must widen (do not widen it silently).
2. **Does core need a preload ordering helper?** — RESOLVED: core adds the pure `resolvePreloadOrder` (05-01 Task 3), exercised end-to-end by engine B (05-03 Task 2); its real Phase-11 consumer is the composition root.
   - What we know: `preloadDependsOn` is part of the locked descriptor shape (D-04); engine B must drive "preload 顺序" end-to-end.
   - What's unclear: whether a free function is acceptable given Pitfall 6 (no consumer besides tests until Phase 11).
   - Recommendation: add one pure function (e.g. `resolveResourcePreloadOrder(resources): readonly string[]`) — it is the minimal thing that makes `preloadDependsOn` meaningful, it is pure/testable, and Phase 11's composition root is its real future consumer. If rejected, validation-only is the fallback (engine B orders manually).
3. **Do the 5 `META_FILE_CONFIG` paths and the `commonEvents` derived resource count as descriptors this phase?** — RESOLVED: honor the locked count of 10; the table-meta paths and `commonEvents` are documented adapter follow-ups owned by Phase 7 / Phase 11 (05-04 Task 2).
   - What we know: CONTEXT fixes the count at **10** (projectData's 9 + editorConfig). The table-meta paths live in `src/services/tableMeta/tableMetaService.ts:47-73` and `commonEvents` is a `MappedDataResource` (`projectData.ts:200-212`).
   - What's unclear: whether they should be expressed as descriptors now (they are engine paths too) or deferred to the table capability (Phase 7) / Phase 11 cutover.
   - Recommendation: honor the locked count (10) for the *mota resources* deliverable; describe the table-meta/common-event resources as **documented adapter follow-ups** owned by Phase 7/11, not extra descriptors this phase. Record this so the gate/plan does not imply they were forgotten.
4. **Should `defineEngine` also validate that `preloadDependsOn` only references resources whose `preload` is eager?** — RESOLVED: not validated this phase (no consumer/requirement, Pitfall 6); validation stays to the Pattern 1 rules (05-01 Task 3).
   - What we know: nothing in the current behavior requires it; floors depend on tower, and tower is eager.
   - Recommendation: **no** this phase (no consumer/requirement) — Pitfall 6. Keep validation to the rules in Pattern 1.

## Environment Availability

This is a pure source refactor within an already-provisioned workspace; it needs only the repo toolchain. (Verified indirectly: CI runs these exact commands on Node 24 / pnpm 12.5.1.)

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | running verifiers + vitest | Expected ✓ | 24 (CI; `engines` requires >=18 for packer) | — |
| pnpm | workspace install/scripts | Expected ✓ | >=12.5.1 (`package.json` `engines.pnpm`) | — |
| TypeScript | `tsc -b` typecheck | ✓ (catalog) | 5.9.3 | — |
| ESLint | `pnpm lint` | ✓ (catalog) | 9.39.2 | — |
| Vitest | core unit tests | ✓ (catalog) | ^4.0.16 | — |
| mota-js submodule | NOT required by this phase | n/a | — | core tests are pure-memory; editor typecheck does not import the submodule source |

**Missing dependencies with no fallback:** none identified.
**Missing dependencies with fallback:** none identified. (No network access is required; per AGENTS.md, any network command, if ever needed, must use proxy `http://127.0.0.1:7890`.)

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json:24`, so this section is included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4 (catalog `^4.0.16`; editor pins 4.0.18) |
| Config file | `packages/libs/editor-core/vitest.config.ts` (resolvePlugin + react-compiler + jsdom + `@styled-system` alias) |
| Quick run command | `pnpm --filter @motajs/editor-core test` |
| Full suite command | `pnpm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| PORT-03 | `defineEngine` returns a validated adapter; core source never constructs `project/…` or inspects extensions | unit | `pnpm --filter @motajs/editor-core test -- engineContract` | ❌ Wave 0 |
| PORT-04 | 10 paths expressed as descriptors (address only inside the file-backed class) | unit (engine B) + review | `pnpm --filter @motajs/editor-core test -- engineContract` | ❌ Wave 0 |
| PORT-05 | core keeps only `JsonDataHandler`; adapter owns `Json2x`/domain handlers | static (existing) + typecheck | `pnpm --filter @motajs/editor typecheck` | ✅ (Phase 4 state; assert no regression) |
| PORT-06 | no game identifier in core production source | static gate (two-polarity) | `node scripts/verify/coreEngineNeutral.js` | ❌ Wave 0 |
| PORT-07 | `airwallMigration` stays adapter-side; nothing migrated into core | static (file location) + review | no core test needed | ✅ (already true) |
| PORT-08 | fake engine B drives hook contract end to end | unit | `pnpm --filter @motajs/editor-core test -- engineContract` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @motajs/editor-core test` + `node scripts/verify/coreEngineNeutral.js`
- **Per wave merge:** `pnpm test` + the four existing verifiers + `node scripts/verify/coreEngineNeutral.js`
- **Phase gate:** `pnpm typecheck && pnpm test && pnpm lint && pnpm format:check` green, plus `pnpm build` unchanged in behavior, before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `packages/libs/editor-core/lib/__tests__/engineContract.test.ts` — covers PORT-03/04/08
- [ ] `packages/libs/editor-core/lib/__tests__/engineB.ts` — the fixture (or inline in the test)
- [ ] `scripts/verify/coreEngineNeutral.js` — covers PORT-06 (has its own two-polarity self-proof)
- [ ] Extend `packages/libs/editor-core/lib/__tests__/coreApiSurface.test.ts` — assert the new exports
- [ ] No framework install needed (Vitest present).

## Security Domain

`security_enforcement: true`, `security_asvs_level: 1` (`.planning/config.json:47-48`). This phase adds no network, no auth, no crypto, and no user-controlled input path; the relevant ASVS surface is **input validation of the descriptor definition** and **not widening any boundary**.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — (pure refactor; no identity) |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | `defineEngine` validates id grammar (reusing `LOGICAL_ID_PATTERN` + `RESERVED_IDS` from `resourceRegistry.ts:26,29`), uniqueness, `create` type, dependency existence/acyclicity; `ResourceRegistry.register` already rejects prototype-polluting ids (`__proto__`/`constructor`/`prototype`). |
| V6 Cryptography | no | — (never hand-roll; nothing cryptographic here) |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prototype pollution via a crafted logical id | Tampering | `ResourceRegistry` uses a `Map` key + reserved-name rejection (`resourceRegistry.ts:29-37`); `defineEngine` must not introduce a plain-object id map. |
| Path traversal from a descriptor-supplied address | Tampering | Core treats the address as opaque and does no normalisation (`ports/fs.ts:16-18`); path safety is the host's job (`fsApi.ts`). The file-backed class must not decode/join paths. |
| Boundary erosion (core gaining a file/DOM/network capability) | Elevation of privilege | PORT-02 gate (`coreModuleState.js`) stays green; the new class consumes only `FsPort`, never `fetch`/DOM. |
| Vocabulary leak enabling engine lock-in | (design risk, not STRIDE) | The game-identifier gate makes it mechanical. |

## Sources

### Primary (HIGH confidence — read this session)
- `packages/libs/editor-core/lib/ports/engine.ts` — current `EngineAdapter` shape (extended).
- `packages/libs/editor-core/lib/resources/resourceRegistry.ts` — `register`/`get`/`getOrThrow`/`snapshot`, `LOGICAL_ID_PATTERN`, `RESERVED_IDS`.
- `packages/libs/editor-core/lib/resources/combinators.ts` — `ResourceView`, `LoadableResource`, `computedResource`, `aggregateResource`.
- `packages/libs/editor-core/lib/resources/{fileHandler,fileHandlerManager,dataHandler,jsonDataHandler}.ts` — the file-backed class's building blocks.
- `packages/libs/editor-core/lib/resources/__tests__/memoryFsPort.ts` — the `FsPort` test double reused by engine B.
- `packages/libs/editor-core/lib/kernel/core.ts` — `EDITOR_CORE_API_VERSION`, aggregated throwing precedent.
- `packages/libs/editor-core/lib/index.ts` — the public barrel to extend.
- `packages/apps/editor/src/project/data/projectData.ts` + `services/editorConfig/editorConfigService.ts` + `services/*/*DataHandler.ts` + `fs/Json2xDataHandler.ts` — the 10 paths and handlers.
- `scripts/verify/{coreModuleState,editorShims,coreExports,ci-workflow}.js` + `.github/workflows/ci.yml` — gate patterns and wiring.
- `.planning/phases/05-…/05-CONTEXT.md`, `03-CONTEXT.md`, `04-CONTEXT.md` — locked decisions.

### Secondary (MEDIUM confidence — planning research docs)
- `.planning/research/ARCHITECTURE.md` §Pattern 3 (`:266-322`), §4.3 registration flow (`:403-419`), §5.1 leak list (`:443-456`).
- `.planning/research/SUMMARY.md` §Phase 5 (`:159-164`).
- `.planning/research/PITFALLS.md` Pitfall 3 (`:70-96`), Pitfall 6 (`:144-164`), Pitfall 14 (`:331-349`), Pitfall 15 (`:353-378`).
- `.planning/STATE.md` — branch rule (`editor/core-extract`), RES-02 unwired note.

### Tertiary (LOW confidence)
- None used. No web search was performed; all claims are first-hand repo reads or in-repo planning docs.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependency; every reused module read directly.
- Architecture (contract shape, file-backed class, registration call-chain): HIGH — grounded in `[VERIFIED: …]` source reads with verbatim quotes.
- Gate/environment/wiring: HIGH — patterns and CI file read directly.
- Floor parameterization + `apiVersion` strategy + preload helper: MEDIUM — genuine design choices presented with recommendations; flagged as Open Questions A1/A3/A4 and OQ1/OQ2.
- Pitfalls: HIGH — each is anchored to an existing repo gate/pattern or a named prior pitfall.

**Research date:** 2026-09-28
**Valid until:** ~2026-10-28 (stable — internal refactor; no external API surface moving). Re-validate only if the contract shape or CI job structure changes.
