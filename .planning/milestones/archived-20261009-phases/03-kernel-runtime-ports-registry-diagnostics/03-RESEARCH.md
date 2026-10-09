# Phase 3: Kernel — Runtime, Ports, Registry, Diagnostics - Research

**Researched:** 2026-09-22
**Domain:** In-repo engine-agnostic kernel construction (TypeScript 5.9 shared library + ESLint 9 / dependency-cruiser / Vitest 4 gates)
**Confidence:** HIGH for repo-derived structural claims (read from source and, for the ESLint mechanisms, executed as probes this session); MEDIUM for the two external-tool behaviour claims and the port-shape recommendations.

> **Scope note.** Phase 3 adds *new* files under `packages/libs/editor-core/lib/` and touches two shared tool configs. It moves no production code and does not modify `@motajs/editor` (D-13). Every claim below is either read from the repo this session, executed as a probe, or explicitly tagged `[ASSUMED]`.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**A. 注册表 API 形态**
- **D-01:** capability registry 是 **`EditorCore` 实例上的成员**，以**实例方法**调用：`EditorCore.registerCapability(kind, id, value, { owner, replaceable })`、`EditorCore.getCapability`、`EditorCore.getCapabilityOrThrow`、`EditorCore.snapshotCapabilities`。注册表**不是全局**、也**不是自由函数**；调用方只经过实例这一个入口。私有 service wiring（持久化/资源/历史等）由组合根持有、**不对外暴露**，与公开注册表严格分离。 — **Reversibility:** costly — 这是 Phase 12 要冻结的扩展面，一旦公开即难以收回或改形。
- **D-02:** `EditorCore.registerCapability` 返回 **`{ disposer, diagnostics }`**。成功时 `disposer` 精确撤销本次注册；失败时**无副作用**——若原本是替换已有项，则**还原旧值**（这就是 `requireZero`/KERN 语境里「rollback」的确切含义）——失败的 `disposer` 为 no-op，`diagnostics` 说明原因。 — **Reversibility:** costly — 返回契约是扩展面的一部分。
- **D-03:** `replaceable` **默认 `false`**（想被覆盖必须显式声明）；同名 `kind:id` 再次注册**一律拒绝并产生诊断**；`owner` **仅用于诊断归属**（说清「被谁占用」），**不参与权限判断**。需要分层覆盖时（如将来表格字段编辑器的 core 默认 → 主题 → 表单级），由被覆盖方自行声明 `replaceable: true`。
- **D-04:** `kind` 是**带命名空间的开放字符串**（如 `command`、`code.language`、`acme.anything`）；**core 对种类集合无知**，只为自己拥有的种类**导出字符串常量**供内部调用点使用；注册时做**运行时格式校验**（必须形如 `段.段`）。第三方可自建种类，core 不提前耦合尚未存在的能力。 — **Reversibility:** costly — 源码中会出现大规模 `import { … } from '…/ports/index.js'`、`…/ports/<name>.js`，以及 `…/kernel/<name>.js` 的引用；改动波及 core 全部文件与所有测试 import。

**B. 诊断与启动失败契约**
- **D-05:** `Diagnostic` 形状 = `{ severity: 'error' | 'warning' | 'info', code: string, message: string, owner?: string, target?: string, cause?: unknown }`。`code` 是**稳定机器码**（供测试/CI 精确断言）；`message` 是中文人读说明；`cause` 保留原始 `Error`/堆栈。**不**加 `timestamp`/`details`（需要时再扩）。 — **Reversibility:** costly — `code` 是外部可见契约，改名等于破坏性变更。
- **D-06:** `DiagnosticBus` 语义：**同步派发** + **保留追加式历史**（`snapshot()` 读全部已发生、`subscribe()` 收后续——这使得 `createEditorCore` 构造期间产生的诊断在构造返回后仍可读到）+ **订阅者抛错被隔离**（转为一条内部诊断/日志，不影响其它订阅者，也不让生产方失败）。 — **Reversibility:** costly — 与 D-04 同类：会写入 core 每个子系统的 import 与测试。
- **D-07:** 「必需注册」由两份清单共同声明：**组合根显式清单**（适配器随 config 提供自己的必需项）**+ core 内置必需清单**（core 自身机制性的前置）；判定粒度是**具体 `kind:id`**；构造末尾统一核对，缺失项记 `error` 诊断。
- **D-08:** 「启动即失败」= 构造末尾若必需清单未解析 → **逆序 dispose 已创建的部分** → **抛出专用启动错误**（携带全部诊断）→ **不交出任何半成品**（构造原子）。**只有「必需项缺失」阻断启动**；其它 `error` 级诊断（例如一次被拒的重复注册）**不阻断**，但一并携带在报告里。 — **Reversibility:** costly — 调用方与测试都会依赖「抛错而非返回」这一契约。

**C. 生命周期、隔离与版本常量**
- **D-09:** `EditorCore.dispose(): void` **同步**；**逆序拆除**；某项抛错**不中断**剩余拆除（收集后报告）；**幂等**（重复调用无副作用）。需要异步清理的部件在 `dispose` 时只做「取消订阅 / 标记停止」，不等待完成。 — **Reversibility:** costly — Phase 12 冻结后把同步改异步是破坏性变更。
- **D-10:** 「两个实例互不干扰」的验证 = **行为隔离测试**（A 注册的能力 B 看不到；A/B 诊断历史互不可见；dispose A 后 B 仍正常；A 的 disposer 不影响 B）**+ 结构性门禁**（断言 `packages/libs/editor-core/lib/**` 内**无模块级可变绑定**，组合根除外），门禁接入现有 4 个 CI job（不新增 job）。
- **D-11:** `EDITOR_CORE_API_VERSION = "0.1.0"`（semver 字符串；未冻结期按 semver 惯例视为不稳定）。**Phase 12 冻结接口面时升到 `"1.0.0"`** 并开始执行 `EXT-03` 的弃用策略。作为**导出的常量**，不作为 `EditorCore` 实例成员。
- **D-12:** `EditorCore` 实例**最小暴露面**：注册表四件套（D-01）+ `.diagnostics`（诊断总线对象，供 `snapshot()`/`subscribe()`）+ `.dispose()`。**不暴露** `host`/`engine`（由组合根持有，需要时以窄接口注入给具体模块）——遵循「绝不把实例本体交给扩展」（`EXT-01`）与「不要把运行时在能力模块间传递」。

**D. 与现有 singleton 的关系、ports 深度、PORT-02 门禁**
- **D-13:** **只增不删**。Phase 3 仅在 core 内新增 `lib/kernel/*` 与 `lib/ports/*` 及其测试；**`@motajs/editor` 一行不改**（Phase 2 已为它加了 `@motajs/editor-core` 依赖与探针导入），应用继续跑现有 6 个 singleton。迁移在 Phase 4/5，切换与删除在 Phase 11。
- **D-14:** 四个 port 接口**都存在并导出**（满足 PORT-01），但**按已知消费者最小定义**：`FsPort`/`HostPort` 依 Phase 4 资源层的真实需求写得较实；`EngineAdapter` 只定义入口形状（Phase 5 扩充）；`PreviewAdapter` 只留最小占位（Phase 11 扩充）。**不猜、不写空接口**。 — **Reversibility:** costly — 给已发布的接口**加成员**对实现者是破坏性变更（Phase 5/11 扩充时要走一次显式的接口演进）。
- **D-15:** PORT-02 用**工具分工**保证：**ESLint 作用域规则**禁全局标识符（`no-restricted-globals`: `fetch`/`window`/`document`/`navigator`/`localStorage`/`XMLHttpRequest`；必要时 `no-restricted-properties` 禁 `process.env`/`import.meta.env`），作用域限定 `packages/libs/editor-core/**`；**dependency-cruiser** 继续管模块边界（core 不得 import 宿主/引擎）。复用已有的 `scripts/verify/lint-severities.js` 完整性检查（保证规则严重级别不被偷偷下调）。**注意**：适配器**可以**用 `fetch`（它负责 HTTP 传输），禁令只针对 core。
- **D-16:** 目录划分：**`lib/kernel/` 放内核机制**（`core.ts` / `registry.ts` / `diagnostics.ts` / `errors.ts`），**`lib/ports/` 单放四个 port 接口**；`lib/index.ts` 汇总导出公开面。理由：ports 是「面向实现者的契约」，与「内核机制」概念不同，且 Phase 5+ 会显著长大。 — **Reversibility:** costly — 目录/文件迁移会牵动 core 内几乎所有 import 与测试路径。

### the agent's Discretion
- 诊断 `code` 的具体命名规则与常量表（但需在 `INTERFACE-NAME.md` 中列明并经确认）。
- `snapshotCapabilities()` 返回的具体容器形态（`Map` 嵌套 vs 普通对象）——须在 `INTERFACE-NAME.md` 里给出并确认。
- `EditorCoreConfig` 的确切字段集（在 D-07/D-13/D-14 的约束下）。
- 隔离测试与结构门禁的具体断言粒度。
- ESLint 规则的具体选项形状与文件放置方式（放进根配置的 override，还是新建一个 core 专属配置片段）。

### Deferred Ideas (OUT OF SCOPE)
- **能力热替换/卸载的真实场景（扩展加载器）** — 本期不实现插件加载；D-02 的 `disposer` 与 D-01 的注册表形状为其预留接口。
- **诊断的 `source`/`timestamp`/`details` 字段、诊断面板/上报** — 需要时再扩契约；本阶段只交付最小形状。
- **`EDITOR_CORE_API_VERSION` 冻结与弃用策略落地** — Phase 12：升到 `1.0.0` 并按 `EXT-03` 执行。
- **port 接口的完整化** — `EngineAdapter` 的完整契约（Phase 5）、`PreviewAdapter` 的启动钩子（Phase 11）、各 capability port（Phase 7–10）。
- **`@microsoft/api-extractor` 报告** — 研究稿建议早期引入、Phase 11 起在 CI 强制；本阶段不做。
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| KERN-01 | `createEditorCore(config)` 返回 per-instance `EditorCore`，取代 6 个模块级 singleton | §Registry/§Composition root patterns; §Code Examples `createEditorCore`; the singleton files are **not** touched (D-13) — this phase only makes the per-instance container exist |
| KERN-02 | `EditorCore` 提供 `dispose()`，按创建逆序释放 | §Pattern 3 (teardown stack), §Pitfall 3 (observable ordering requires a teardown channel), §Validation Architecture (dispose-order unit test) |
| KERN-03 | 公开 capability registry（`registerCapability` 返回诊断 + rollback、`getCapability`、`getCapabilityOrThrow`、`snapshotCapabilities`），与私有 service wiring 分离 | §Registry shape (BlockRegistry precedent, verbatim), §Code Examples registry, §Open Question 3 (snapshot container) |
| KERN-04 | `createEditorCore()` 聚合所有注册诊断，必需注册未解析则启动即失败 | §Pattern 4 (atomic construction), §Code Examples startup error, §Open Question 5 (how the root satisfies required registrations) |
| KERN-05 | `EDITOR_CORE_API_VERSION` 常量 + `DiagnosticBus` | §DiagnosticBus design, §Open Question 2 (where the version const lives), §Validation Architecture (export-surface verifier) |
| KERN-06 | 两个 `EditorCore` 实例可并存互不干扰（隔离测试） | §Structural gate (empirically proven ESLint selectors), §Validation Architecture (isolation + gate two-polarity) |
| PORT-01 | core 声明 `EngineAdapter`、`FsPort`、`HostPort`、`PreviewAdapter` 及各 capability port 接口 | §Port shapes (grounded in real Phase-4 calls); **capability ports are deferred to Phases 7–10** — see §Open Question 1 |
| PORT-02 | core 无 default `Fs`、不解析 DOM/环境、不直接 fetch；由 composition root 注入 | §ESLint scoped override (exact flat-config block), §Pitfall 4 (`tsc` cannot enforce it — DOM lib is in `tsconfig.lib.base.json`), §Validation Architecture |
</phase_requirements>

## Summary

Phase 3 is a **greenfield addition inside an already-scaffolded package**. `packages/libs/editor-core/` exists with a `lib/` layout, seven subpath exports, its own `vitest.config.ts`, and a smoke test. Phase 3 adds `lib/kernel/{core,registry,diagnostics,errors}.ts`, `lib/ports/{engine,fs,host,preview}.ts` (+ barrel), re-exports them from `lib/index.ts`, adds kernel unit tests, and adds two enforcement layers (a core-scoped ESLint override and a structural module-state gate). Nothing moves out of `@motajs/editor` (D-13), and the six singletons are untouched (Phase 11).

Three findings dominate planning risk:

1. **The registry has a strong first-party precedent, but the diagnostics bus does not.** `BlockRegistry.registerPack` (`packages/apps/editor/src/blockly/registry/index.ts:544-601`) already returns `{ ok, diagnostics, registeredBlockTypes }` and restores the previous pack on failure — exactly the "diagnostics + rollback" shape D-02 asks for. But the only pub/sub in the repo, `subscribeNotifications` (`packages/apps/editor/src/utils/notify.ts:10-21`), is a **module-level `Set` singleton** — i.e. precisely the anti-pattern the Phase-3 structural gate must forbid. The bus must be written fresh and per-instance; reusing `notify.ts` would violate D-10 on day one.

2. **The "no module-level mutable bindings" gate is fully expressible in ESLint, and I proved it by execution.** `no-restricted-syntax` with `Program > VariableDeclaration[kind=/^(let|var)$/]` (plus the `ExportNamedDeclaration` variant) catches module-scope `let`/`var` and **not** function-scope ones; `Object.freeze({…})` and `{…} as const` are **structurally exempt** because the `>` child combinator does not match them — no `:not()` or parent traversal is needed. `no-restricted-globals` catches all six PORT-02 globals; `no-restricted-properties` catches `process.env` but **cannot** catch `import.meta.env` (confirmed: the probe reported `process.env` and stayed silent on `import.meta.env`). `import.meta.env` needs a `no-restricted-syntax` selector instead.

3. **`tsc` cannot enforce PORT-02, so the ESLint gate is the only static enforcement.** `tsconfig.lib.base.json` sets `"lib": ["ESNext", "DOM", "DOM.Iterable"]`, so `window`/`document`/`fetch` all typecheck inside core. This makes the scoped ESLint override load-bearing, and makes its two-polarity proof mandatory rather than optional.

**Primary recommendation:** implement the kernel as four small pure modules with **no module-level mutable state at all** (so the gate's composition-root exception is only forward-looking for Phases 4/11), put the registry's compute-then-commit logic in `registry.ts`, keep all four gates inside the existing four CI jobs, and prove every new gate with a synthetic violating fixture that must turn it red (Phase 2's `coreBoundaries.js` pattern).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Capability registry (`kind:id` → value) | core kernel — `lib/kernel/registry.ts` | — | Per-instance state; must never be a module-level map (D-01/D-10) |
| Diagnostics bus (history + subscribe) | core kernel — `lib/kernel/diagnostics.ts` | — | Per-instance history; construction-time diagnostics must survive into `snapshot()` (D-06) |
| Lifecycle / reverse-order teardown | core composition root — `lib/kernel/core.ts` | — | The root owns the teardown stack; `dispose()` is sync and idempotent (D-09) |
| Port contracts (`FsPort`/`HostPort`/`EngineAdapter`/`PreviewAdapter`) | core contracts — `lib/ports/*` | adapter (`@motajs/editor`, Phases 5/11) implements them | Core declares shapes, adapter conforms — never the reverse (ARCHITECTURE Pattern 3) |
| Startup validation & atomic failure | core composition root | composition root supplies the required list (config) | D-07/D-08: only missing-required blocks; the throw carries all diagnostics |
| API version constant | core barrel (`lib/index.ts` re-export) | — | D-11: an exported const, **not** an instance member |
| PORT-02 enforcement (no `fetch`/DOM/env) | build/CI — core-scoped ESLint override | core source | `tsc` cannot do it (DOM lib is enabled); static gate only |
| "No module-level mutable binding" gate | build/CI — core-scoped ESLint `no-restricted-syntax` + two-polarity verifier | — | Structural; composition root `lib/kernel/core.ts` excepted (D-10) |
| Module-edge boundary | build/CI — `.dependencyCruiser.cjs` via `scripts/verify/coreBoundaries.js` | — | Edges only; cannot express module-state (see §Pitfall 1) |
| Public surface export | core barrel — `lib/index.ts` | export-surface verifier | The only importable surface (ARCHITECTURE §2.4) |

## Standard Stack

### Core

**No new runtime or dev dependencies are introduced by this phase.** Everything required already exists in the workspace.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.9.3 | Kernel source + `tsc -b` typecheck | Repo-wide, catalog-pinned `[VERIFIED: executed probe — node_modules/typescript/package.json → 5.9.3]` |
| Vitest | 4.0.18 | Kernel unit tests | Core's `test` script is already `vitest run` `[VERIFIED: packages/libs/editor-core/package.json:17-20; executed probe → 4.0.18]` |
| ESLint | 9.39.2 (flat config) | PORT-02 + module-state gate | Root flat config already lints core `[VERIFIED: eslint.config.js:31-32; executed probe → 9.39.2]` |
| typescript-eslint | 8.50.1 | TS parser for the `no-restricted-syntax` selectors | Catalog pin `[VERIFIED: pnpm-workspace.yaml:72]` |
| dependency-cruiser | 18.2.0 | Module-edge boundary (unchanged) | Catalog pin `[VERIFIED: pnpm-workspace.yaml:37; executed probe → 18.2.0]` |
| Node.js | 24.21.0 local / 24 CI | Runtime for verifiers + tests | `[VERIFIED: executed probe — v24.21.0; .github/workflows/ci.yml:26]` |
| pnpm | 12.5.1 | Workspace toolchain | `[VERIFIED: executed probe — 12.5.1; pnpm-workspace.yaml; ci.yml:22]` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | — | — | The kernel is dependency-free by design |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ESLint `no-restricted-syntax` for the module-state gate | A custom `scripts/verify/coreNoModuleState.js` walking the TS AST | ESLint already expresses every case I probed, and runs in the existing `lint` job for free. A custom walker is only worth it if the gate must also catch `export const x = factory()` (see §Pitfall 1) |
| ESLint `no-restricted-syntax` for the module-state gate | dependency-cruiser | **Cannot work.** dependency-cruiser reasons over module *edges*; "a module-level mutable binding" is not an edge. Recorded so the planner does not try |
| New per-package `packages/libs/editor-core/eslint.config.js` | A core-scoped block inside the root `eslint.config.js` | The root config already lints core; a scoped block is the smaller change and keeps `lint-severities.js`'s "root config" sample meaningful. A package config is the editor's precedent but would re-declare the whole plugin set |

**Installation:**

```bash
# Nothing to install — no new dependencies. Only `pnpm install` if the lockfile is regenerated.
```

**Version verification:** no package is added, so no registry lookup is required. Local toolchain confirmed by execution: `node v24.21.0`, `pnpm 12.5.1`, `typescript 5.9.3`, `vitest 4.0.18`, `eslint 9.39.2`, `dependency-cruiser 18.2.0`.

## Package Legitimacy Audit

**This phase installs no external packages.** No `package.json` dependency is added or changed; `packages/libs/editor-core/package.json` keeps exactly its nine peers and its `devDependencies` as Phase 2 left them — and `scripts/verify/coreExports.js:196-229` **asserts** that peer set is exactly nine, so adding one would fail the `typecheck` job anyway.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| *(none — no packages installed this phase)* | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

Data/control flow for the phase's primary use case — *construct a core, register, validate, use, dispose*:

```text
composition root (test today; @motajs/editor in Phase 11)
        │
        │  createEditorCore(config)
        ▼
┌─────────────────────────────────────────────────────────────────────┐
│ lib/kernel/core.ts  —  EditorCore construction (atomic)             │
│                                                                     │
│  1. create DiagnosticBus            ──► lib/kernel/diagnostics.ts   │
│  2. create capability registry      ──► lib/kernel/registry.ts      │
│  3. create teardown stack (reverse-order)                           │
│  4. apply config.install(registrar)  ──► registerCapability(...)*   │
│        │                                     │                      │
│        │                                     ├─ ok  → value stored  │
│        │                                     │        revoke pushed │
│        │                                     │        onto stack    │
│        │                                     └─ fail→ NO side effect│
│        │                                              + diagnostic  │
│  5. resolve required list (config ∪ built-in)                       │
│        │                                                            │
│        ├─ all resolved ─────────────► return EditorCore instance    │
│        └─ any missing  ──► append error diagnostics                 │
│                            → dispose() in reverse order             │
│                            → throw EditorCoreStartupError           │
│                              (carries ALL diagnostics)              │
└─────────────────────────────────────────────────────────────────────┘
        │  EditorCore (instance)
        ▼
   registerCapability / getCapability / getCapabilityOrThrow / snapshotCapabilities
   .diagnostics.snapshot() / .diagnostics.subscribe()
   .dispose()   → reverse-order teardown, per-item try/catch, idempotent
        │
        ▼
   ports: lib/ports/{engine,fs,host,preview}.ts   (declarations only — no implementation)
```

### Recommended Project Structure

```text
packages/libs/editor-core/lib/
├── index.ts                 # public barrel: re-export kernel + ports surface  (EXISTING, currently `export {}`)
├── kernel/
│   ├── core.ts              # createEditorCore / EditorCore / EditorCoreConfig / EDITOR_CORE_API_VERSION
│   ├── registry.ts          # capability registry + CapabilityRef + kind-format validation
│   ├── diagnostics.ts       # Diagnostic + DiagnosticBus (+ factory)
│   └── errors.ts            # EditorCoreStartupError
├── ports/
│   ├── engine.ts            # EngineAdapter (entry shape only)
│   ├── fs.ts                # FsPort
│   ├── host.ts              # HostPort
│   ├── preview.ts           # PreviewAdapter (minimal)
│   └── index.ts             # barrel
├── react/                   # UNCHANGED (Phase 2 probe)
├── asset|code|map|shell|table/index.ts   # UNCHANGED empty barrels
└── __tests__/               # coreProbe.test.tsx (EXISTING) + new kernel tests
```

> **Naming is a candidate list, not a decision** — see §Open Question 6 and the `INTERFACE-NAME.md` requirement in `AGENTS.md`.

### Pattern 1: Diagnostics-with-rollback registration (first-party precedent, verbatim)

**What:** `registerCapability` returns a result object carrying diagnostics instead of throwing; a failed registration leaves no side effect.
**When to use:** Every capability registration. Never throw from `registerCapability` (ARCHITECTURE Anti-Pattern 7).

The in-repo precedent is `BlockRegistry.registerPack`. Its **result shape** is built as literal object returns `[VERIFIED: packages/apps/editor/src/blockly/registry/index.ts:555-557, 578]`:

```ts
// packages/apps/editor/src/blockly/registry/index.ts:554-557
    const diagnostics = this.validatePack(normalizedPack, options, allowOverride);
    if (diagnostics.some((item) => item.level === 'error')) {
      return { ok: false, diagnostics, registeredBlockTypes: [] };
    }
// ...
// :578
    return { ok: true, diagnostics, registeredBlockTypes };
```

Its **diagnostic shape** is `{ level, code, message, … }` produced by a local `error()` helper `[VERIFIED: packages/apps/editor/src/blockly/registry/index.ts:732-741]`:

```ts
// packages/apps/editor/src/blockly/registry/index.ts:732-741
    const error = (code: string, message: string, schema?: BlockSchema, input?: string) => {
      diagnostics.push({
        level: 'error',
        code,
        message,
        packId: pack.id,
        blockType: schema?.definition?.type,
        input,
      });
    };
```

Its **restore-previous-on-failure** is done by remove-then-re-register `[VERIFIED: packages/apps/editor/src/blockly/registry/index.ts:581-601]`:

```ts
// packages/apps/editor/src/blockly/registry/index.ts:597-600
    if (previous) this.removePack(pack.id);
    const result = this.registerPack(pack, options);
    if (!result.ok && previous) this.registerPack(previous.pack, previous.options);
    return result;
```

**Recommendation for the kernel: do *not* copy the remove-then-restore mechanics.** `BlockRegistry` needs them because a pack touches five maps at once; the kernel registry touches exactly one. Use **compute-then-commit**: validate the kind format, validate the duplicate/replaceable rules, and only then perform a single `map.set(...)`. A failure then has no side effect *by construction*, which is a strictly stronger guarantee than D-02's observable requirement ("previous value intact after a failed replacement"). Copy the *contract* (result object + stable `code`), not the *repair*.

**Disposer identity:** push the revoke closure onto the core teardown stack at the same moment as the `map.set`, and return that same closure as `disposer`. Make it idempotent (delete-if-still-mine) so calling it directly and then calling `dispose()` cannot double-fire anything observable.

### Pattern 2: A per-instance append-only diagnostic bus

**What:** synchronous dispatch to a listener set + append-only history readable by `snapshot()`.
**When to use:** every diagnostic producer in core.

The only existing pub/sub is `subscribeNotifications` `[VERIFIED: packages/apps/editor/src/utils/notify.ts:10-21]`:

```ts
// packages/apps/editor/src/utils/notify.ts:10-21
const listeners = new Set<(notification: EditorNotification) => void>();

export function subscribeNotifications(listener: (notification: EditorNotification) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(notification: EditorNotification): void {
  if (listeners.size > 0) listeners.forEach((listener) => listener(notification));
  else if (notification.level === 'error') console.error(notification.message);
  else console.info(notification.message);
}
```

**This must not be reused or generalized into core.** `const listeners = new Set(...)` at module scope is exactly the binding D-10's structural gate forbids; adopting it would make the gate red on the day it lands. Write a fresh, per-instance bus.

Required semantics, and the one trap:

- `snapshot(): readonly Diagnostic[]` returns all diagnostics that have happened (so construction-time diagnostics remain readable after `createEditorCore` returns).
- `subscribe(listener): () => void` receives **only subsequent** diagnostics. D-06's parenthetical says history is what makes construction-time diagnostics readable, so **replay is not part of the locked contract** — do not add a replay option; it would grow the frozen surface for no requirement.
- **Subscriber-error isolation without recursion.** The bus is the thing that reports errors, so `catch { bus.push(internalDiagnostic) }` re-enters `push` and can re-invoke the same throwing listener. Two safe designs, in order of preference:
  1. **Append-without-dispatch:** on a listener throw, append the internal diagnostic (`severity: 'warning'`, a stable `code` such as `diagnostic.subscriber-error`, `cause` = the thrown value) directly to the history array, and **do not** dispatch it to listeners. No recursion is possible, and the failure is still observable via `snapshot()`.
  2. **Re-entrancy depth guard:** a per-dispatch depth counter; internal diagnostics dispatch only when depth is 0. More moving parts for no extra capability.
  Choose (1); document it, because "where did the subscriber error go?" is the kind of question the tests should pin.

- Iterate a **copy** of the listener set (or use `Set.forEach` semantics consciously) so a listener that subscribes/unsubscribes during dispatch cannot corrupt the iteration.

### Pattern 3: Atomic construction with a reverse-order teardown stack

**What:** creation-order array of teardown callbacks; `dispose()` drains it reversed, isolating throws, idempotently.
**When to use:** `createEditorCore`'s failure path and `EditorCore.dispose`.

- One `teardowns: Array<() => void>` plus a `disposed` boolean. `dispose()` returns immediately if `disposed`, sets `disposed = true` first (so a re-entrant call is a no-op), then drains with `for (let i = teardowns.length - 1; i >= 0; i -= 1)` inside a `try/catch` per item, collecting failures.
- **D-09 says the collected teardown failures are "collected + reported" but does not say through which channel.** `dispose(): void` cannot return them, and it must not throw (a throwing teardown must not abort the rest). Recommendation: push them into the same `DiagnosticBus` as `severity: 'error'` diagnostics **and** `console.warn`/`console.error` (mirroring `PersistExecutor`'s `console.error('PersistExecutor: task failed', normalized)` `[VERIFIED: packages/apps/editor/src/fs/PersistExecutor.ts:72]`). `snapshot()` then makes them assertable in tests. This is an explicit open question for the planner — see §Open Question 4.
- **Testability:** a registry-entry revoke closure only deletes a map key, which is hard to observe as an *ordering*. To make KERN-02 assertable, `createEditorCore`'s config must give the composition root a way to push arbitrary teardowns (Phase 4+ needs this anyway for `FileHandlerManager`, `PersistenceMonitor`, subscriptions). See §Open Question 5.

### Pattern 4: Compute-then-commit registry with a single map

```ts
// Candidate shape (names are candidates — see §Open Question 6)
interface RegistryEntry {
  readonly kind: string;
  readonly id: string;
  readonly value: unknown;
  readonly owner?: string;
  readonly replaceable: boolean;
}
// one Map<string, RegistryEntry> keyed by `${kind}:${id}`
```

Lookup must always name an id (ARCHITECTURE Anti-Pattern 6: no silent first-wins default). `getCapabilityOrThrow` is the only throwing lookup; its message should name both the missing key and, when known, the owning label — e.g. a stable, test-assertable phrasing. **Candidate (needs confirmation):** `` `Capability not registered: ${kind}:${id}` ``. Repo error style is English technical text (`Runtime resource denied: ${path}` `[VERIFIED: packages/apps/editor/src/runtime/RuntimeResourceGateway.ts:87]`; `Cannot register codec for unknown block ${blockType}` `[VERIFIED: packages/apps/editor/src/blockly/registry/index.ts:652]`), while D-05 requires the `Diagnostic.message` to be Chinese. Keeping the *thrown* message English and the *diagnostic* message Chinese matches both.

### Pattern 5: Core-scoped ESLint override in the root flat config

**What:** a `files`-scoped block appended after the shared block, so its rules win for core only.
**When to use:** PORT-02 globals + the module-state selectors.

The root config's shared block already matches core `[VERIFIED: eslint.config.js:31-32]`:

```js
// eslint.config.js:31-32
    files: ['**/*.{js,ts,tsx}'],
    ignores: ['packages/apps/editor/**'],
```

A scoped block appended **after** it (later blocks win in flat config) is the minimal change:

```js
// Candidate — appended after the shared block in eslint.config.js
{
  files: ['packages/libs/editor-core/**/*.{ts,tsx}'],
  rules: {
    'no-restricted-globals': [
      'error',
      { name: 'fetch', message: 'editor-core must not fetch; inject a port' },
      { name: 'window', message: 'editor-core must not touch the DOM' },
      { name: 'document', message: 'editor-core must not touch the DOM' },
      { name: 'navigator', message: 'editor-core must not read navigator' },
      { name: 'localStorage', message: 'editor-core must not touch storage' },
      { name: 'XMLHttpRequest', message: 'editor-core must not use XHR' },
    ],
    'no-restricted-properties': [
      'error',
      { object: 'process', property: 'env', message: 'editor-core must not read process.env' },
    ],
    'no-restricted-syntax': [
      'error',
      // module-scope let/var, exported and not
      { selector: 'Program > VariableDeclaration[kind=/^(let|var)$/]', message: '…' },
      { selector: 'Program > ExportNamedDeclaration > VariableDeclaration[kind=/^(let|var)$/]', message: '…' },
      // module-scope mutable containers (Object.freeze / `as const` are structurally exempt)
      { selector: ':matches(Program > VariableDeclaration, Program > ExportNamedDeclaration > VariableDeclaration)[kind="const"] > VariableDeclarator > :matches(NewExpression[callee.name=/^(Map|Set|WeakMap|WeakSet)$/], ArrayExpression, ObjectExpression)', message: '…' },
      // import.meta.env (no-restricted-properties cannot match a MetaProperty)
      { selector: 'MemberExpression[object.type="MetaProperty"][property.name="env"]', message: '…' },
    ],
  },
}
```

**Composition-root exception (D-10):** the module-state selectors must not apply to `lib/kernel/core.ts`. Express it with a second block that re-declares the same rules with `off` for that one file (or add `ignores: ['packages/libs/editor-core/lib/kernel/core.ts']` to the module-state block and put the PORT-02 rules in a separate block that keeps applying to `core.ts`). Do **not** use one block with one `ignores`, or `core.ts` would also lose the PORT-02 ban.

### Anti-Patterns to Avoid

- **Module-level mutable state in core:** `export const registry = new Registry()`, `const listeners = new Set()`, `let cached`. ARCHITECTURE Anti-Pattern 2; the concrete cost is proven in-repo by `export const blockRegistry = new BlockRegistry();` `[VERIFIED: packages/apps/editor/src/blockly/registry/index.ts:1037]` and `const environment = new ProjectLanguageEnvironment();` `[VERIFIED: packages/apps/editor/src/Workbench/CodeEditor/projectLanguageEnvironment.ts:220]`.
- **Throwing on the first registration error:** ARCHITECTURE Anti-Pattern 7. Collect, then either return the instance (D-08: only missing-required blocks) or throw one startup error carrying everything.
- **One registry doing two jobs:** ARCHITECTURE Anti-Pattern 5. The private service wiring is **not** a capability; in Phase 3 there is no private service at all yet, which makes the separation trivial to keep.
- **Passing the `EditorCore` instance into config callbacks:** D-12 / ARCHITECTURE Anti-Pattern 4. Give `config.install` a narrow registrar, not the instance.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DI container / decorators | A container, token system, or reflection-based injector | Plain factory `createEditorCore(config)` + explicit construction order | ARCHITECTURE Pattern 1; the repo already constructs everything explicitly (`projectData.ts`, `main.tsx`) |
| Module-state detection | A bespoke TS-AST walker | ESLint `no-restricted-syntax` (proven below) | Runs in the existing `lint` job, already parses TS, and every case I probed is expressible |
| Edge boundary checking | A custom import-graph script | `.dependencyCruiser.cjs` via `coreBoundaries.js` | Already installed, already two-polarity proven, already in CI |
| Result/diagnostic plumbing | A new `Result<T,E>` library or `neverthrow` | A local discriminated result object + `Diagnostic[]` | The repo's own convention is discriminated unions built by named factories (`commandOk`/`commandError`, `RegisterPackResult`) |
| Reverse-order teardown | An `AsyncDisposableStack` / `using` polyfill | A plain array drained in reverse | `target: ESNext` does not guarantee the runtime supports `using` in the built app; D-09 is synchronous anyway |
| Per-file test environment | A second Vitest project | A per-file `// @vitest-environment node` docblock | The config already has one project; a docblock is the documented Vitest per-file override |

**Key insight:** this phase's "hand-rolling" risk is not algorithmic — it is *reusing the wrong in-repo precedent*. `notify.ts` (global `Set`) and `blockRegistry` (module-level singleton) are both anti-patterns for core even though they are perfectly good in `@motajs/editor`. Copy the **contract shapes**, never the **storage**.

## Common Pitfalls

### Pitfall 1: The structural gate's blind spot — `export const x = factory()`

**What goes wrong:** the selectors catch `let`/`var` and `new Map()/Set()/[]/{}` literals, but **not** `export const registry = createRegistry()`. A future contributor reintroduces module-level state via a factory call and the gate stays green.
**Why it happens:** esquery can match node *kinds* and *shapes*, not "does this value contain mutable state". I confirmed this by probe: `export const mutableMap = new Map()` is caught, but a call-returned object would not be.
**How to avoid:** state the gate's scope explicitly in the verifier's header comment ("catches module-scope `let`/`var` and literal/collection `const` bindings; a factory-call binding is out of scope"), and keep the gate's **two-polarity proof** honest by using a `let` fixture (which the gate *does* catch) — never a fixture that only "looks" caught. If a stronger guarantee is later needed, add a custom AST verifier as a *second* gate rather than weakening the first.
**Warning signs:** a verifier whose synthetic violation is a factory call; a comment claiming the gate catches "all module state".

### Pitfall 2: Reusing `notify.ts` for the DiagnosticBus

**What goes wrong:** the bus is implemented by generalizing `subscribeNotifications`, inheriting `const listeners = new Set(...)` at module scope.
**Why it happens:** it is the only pub/sub in the repo and looks like a gift.
**How to avoid:** build the bus per-instance; the gate from D-10 will otherwise fail the moment it lands. `notify.ts` is a *shape* reference (unsubscribe-returning `subscribe`), not a *code* reference.
**Warning signs:** `lib/kernel/diagnostics.ts` containing a top-level `const … = new Set()`.

### Pitfall 3: DiagnosticBus subscriber errors recursing

**What goes wrong:** `catch (e) { this.push({ severity: 'warning', cause: e, … }) }` re-enters `push`, which re-invokes the throwing listener, which throws again — unbounded recursion or a silently swallowed second failure.
**Why it happens:** the error reporter is the erroring component.
**How to avoid:** on a listener throw, append the internal diagnostic to history **without dispatching it** (Pattern 2, option 1).
**Warning signs:** a `push` inside a `catch` inside the dispatch loop with no depth guard; a test that hangs.

### Pitfall 4: `tsc` cannot enforce PORT-02, and `no-restricted-properties` cannot see `import.meta.env`

**What goes wrong:** the plan treats `pnpm typecheck` as evidence for PORT-02, or configures only `no-restricted-properties` for both env forms.
**Why it happens:** DOM types are enabled for libs, and `import.meta.env` is a `MetaProperty`, not an `Identifier`.
**How to avoid:** `[VERIFIED: packages/libs/config/tsconfig.lib.base.json:5]` sets `"lib": ["ESNext", "DOM", "DOM.Iterable"]`, so `window`/`document`/`fetch` typecheck fine inside core — the ESLint gate is the only static enforcement. And `[VERIFIED: executed ESLint 9.39.2 probe]` `no-restricted-properties` reported `'process.env' is restricted from being used` while emitting **no** report for `import.meta.env` on the next line; use a `no-restricted-syntax` selector for it.
**Warning signs:** a PORT-02 evidence row citing only `pnpm typecheck`; a probe fixture containing `import.meta.env` that passes.

### Pitfall 5: Breaking `lint-severities.js`

**What goes wrong:** the plan assumes adding core-scoped rules will trip the severity guard.
**Why it happens:** the script's name suggests it guards everything.
**How to avoid:** read the actual assertions `[VERIFIED: scripts/verify/lint-severities.js:26-44]` — the severity assertions sample exactly two files, `packages/apps/editor/src/hooks/useImageAssetUrl.ts` (editor config) and `packages/apps/service-worker/src/server/fsApi.ts` (root config), and assert an 8-rule table. **Neither sample is a core file**, so adding core-scoped rules cannot change those results. The *second* assertion scans **every git-tracked** `.js/.jsx/.mjs/.cjs/.ts/.tsx` file for `eslint-disable*` comments and requires a non-empty reason after ` -- ` `[VERIFIED: scripts/verify/lint-severities.js:46-55, 142-163]`. So: do not add an unexplained `eslint-disable` in any new core file. Prefer not disabling at all.
**Warning signs:** a new `// eslint-disable-next-line` in `lib/kernel/*` without ` -- reason`.

### Pitfall 6: Breaking the four-job CI contract

**What goes wrong:** a new gate is added as a fifth job, or `submodules: recursive` is added to `lint`/`typecheck`.
**Why it happens:** new gates feel like new jobs.
**How to avoid:** `ci-workflow.js:31` fixes `JOB_IDS = ['lint','typecheck','unit','build']`, `:53` fixes `SUBMODULE_JOBS = ['unit','build']`, and the verifier asserts presence only — so **extra `- run: node scripts/verify/…` steps are safe**. Put the new module-state verifier in `lint` (next to `coreBoundaries.js`) and re-run `node scripts/verify/ci-workflow.js` after editing.
**Warning signs:** job count ≠ 4; `pnpm lint` replaced rather than accompanied.

### Pitfall 7: Breaking `coreExports.js` by adding a subpath or a script

**What goes wrong:** the plan adds an `./kernel` or `./ports` subpath export, or a `build` script, to core.
**Why it happens:** `lib/kernel/*` and `lib/ports/*` look like subpaths.
**How to avoid:** `[VERIFIED: scripts/verify/coreExports.js:42-67]` asserts the exports map is **exactly** `['.','./code','./table','./map','./asset','./shell','./react']`, the scripts are **exactly** `{typecheck:'tsc -b', test:'vitest run'}`, and there is **no** `build`. Kernel and ports are exported through `.` (`lib/index.ts`) — internal directories, not subpaths. `[VERIFIED: packages/libs/editor-core/package.json:8-20]` is the current map.
**Warning signs:** `exports` gaining a key; a `build` script; `coreExports.js` red in the `typecheck` job.

### Pitfall 8: `subpathStatus.json` says `.` is an empty barrel — and it will stop being true

**What goes wrong:** after Phase 3, `lib/index.ts` re-exports the kernel surface, but `[VERIFIED: .planning/phases/02-package-boundary-build-scaffolding/subpathStatus.json:6-10]` still records `.` as `"content": "empty-barrel"`, and `coreExports.js:181-190` asserts exactly that value for `.`.
**Why it happens:** the status file is a Phase-2 planning artifact that the verifier hard-codes expectations against.
**How to avoid:** decide deliberately, in the plan, between (a) leaving the Phase-2 snapshot untouched (the verifier stays green; the file is then a historical record, not a live assertion), or (b) updating the `.` entry and the verifier's expectation together (e.g. `content: 'kernel-barrel'`) so the record stays truthful. Option (b) is the honest one and is a two-line change, but it edits a Phase-2 artifact and must be called out in the plan and in `INTERFACE-NAME.md`-adjacent review notes. **Recommend (b).**
**Warning signs:** a plan that silently leaves a now-false record in place; or an unannounced edit to a Phase-2 artifact.

### Pitfall 9: dependency-cruiser `couldNotResolve` on the new relative edges

**What goes wrong:** a new kernel/ports file imports something that does not resolve, and the path rules silently stop matching.
**Why it happens:** Phase 2 proved that an unresolved edge makes every `to.path` rule vacuous `[VERIFIED: scripts/verify/coreBoundaries.js:164-207]`.
**How to avoid:** `coreBoundaries.js` already asserts that every core-internal relative edge resolves **inside** `packages/libs/editor-core/lib` and that no non-`@styled-system` specifier is unresolved. Two consequences for Phase 3:
  - Use **extensionless relative imports** (the repo convention; `lib/react/index.ts` already does `export { CoreProbe } from './CoreProbe';` `[VERIFIED: packages/libs/editor-core/lib/react/index.ts:1]`). Do not use `@/` inside core — Phase 2's D-06 removed it, and `coreBoundaries.js` does not tolerate an unresolved `@/…`.
  - `lib/index.ts` re-exporting `./kernel/core` and `./ports/index` adds no unresolved edge and no cycle (`index.ts` is a leaf). But **do not** let a kernel file import `../index` — that *would* be a cycle and would trip `no-circular`.
**Warning signs:** `coreBoundaries: core 包内相对边未解析` in the `lint` job.

### Pitfall 10: The `requireZero` rule's `from` pattern and the new kernel files

**What goes wrong:** the plan assumes `core-singletons-only-imported-by-composition-root` needs changing, or that new kernel files escape it.
**Why it happens:** its `to.path` names six singletons that do not exist in core yet.
**How to avoid:** `[VERIFIED: .dependencyCruiser.cjs:54-66]` — the rule's `from` is `pathNot: '^packages/libs/editor-core/lib/kernel/core\.ts$'` and its `to.path` is `^packages/libs/editor-core/lib/(kernel|services)/(projectData|projectModel|operationHistory|FileHandlerManager|persistenceMonitor|editorConfigService)[^/]*\.ts$`. Phase 3 introduces **no** singleton, so the rule stays empty and green (exactly as Phase 2's D-17 predicted). Note the *other* rule, `kernel-must-not-import-capabilities`, has `from: { path: '^packages/libs/editor-core/lib/(index\\.ts|kernel/.*)$' }` `[VERIFIED: .dependencyCruiser.cjs:22-28]` — so **all new `lib/kernel/*` files are already covered** by the "kernel must not import capabilities" rule, for free. `lib/ports/*` is not covered by that rule (it is not under `kernel/`), which is correct: ports are contracts and may be imported from anywhere in core.
**Warning signs:** editing `.dependencyCruiser.cjs` when nothing needed changing; a kernel file importing `../table`.

### Pitfall 11: Vitest's global `jsdom` + the react plugin

**What goes wrong:** kernel tests run under jsdom (slower, and `window`/`document` exist — which could mask a PORT-02 mistake at runtime), and someone assumes the react/react-compiler plugin breaks plain `.ts` tests.
**Why it happens:** `[VERIFIED: packages/libs/editor-core/vitest.config.ts:20-23]` sets `environment: 'jsdom'` globally with `include: ['lib/**/*.test.{ts,tsx}']`.
**How to avoid:** use a per-file docblock `// @vitest-environment node` at the top of each kernel test file (the documented Vitest per-file override). Leave the config untouched so the existing probe test keeps jsdom. The react plugin transforms `.ts` files harmlessly (it is a Babel/JSX pipeline; the existing config already runs it over `lib/**`), and `resolvePlugin` + the `@styled-system` alias are inert for kernel tests. **However, PORT-02 is a static gate — do not rely on the jsdom/node environment to catch it.**
**Warning signs:** kernel tests silently passing a `window` reference; per-test config hacks.

### Pitfall 12: Zero-test-file / fan-out hazards (carried forward)

**What goes wrong:** `pnpm -r run test` goes red, or a pre-existing flake is misread as a Phase-3 regression.
**Why it happens:** `[VERIFIED: .planning/phases/02-package-boundary-build-scaffolding/02-RESEARCH.md:493-498]` Vitest 4 exits non-zero with no test files; and `[VERIFIED: .planning/phases/01-baseline-verification-net/deferred-items.md:142-148]` the `@motajs/react-monaco-editor` teardown flake makes the fan-out nondeterministic ("roughly half the time").
**How to avoid:** keep at least the existing probe test plus the new kernel tests (never zero); if the fan-out is red only on `@motajs/react-monaco-editor` with all its tests passing, retry once and say so — it is pre-existing, out of scope, and must not be "fixed" here.
**Warning signs:** a red `unit` job with a green per-package run; a plan that proposes touching `react-monaco-editor`.

### Pitfall 13: The lockfile / `pnpm install` re-resolution hazard

**What goes wrong:** Phase 3 needs no dependency change, but an incidental `pnpm install` (without `--frozen-lockfile`) re-resolves and rewrites `pnpm-lock.yaml`, dragging unrelated packages forward and reddening the frozen CI install or the single-copy assertion.
**Why it happens:** `[VERIFIED: .planning/phases/02-package-boundary-build-scaffolding/02-RESEARCH.md:424]` records that the lockfile must be regenerated deliberately (not by accident), and the repo carries a `minimumReleaseAgeExclude` release-age guard `[VERIFIED: pnpm-workspace.yaml:82-83]`.
**How to avoid:** do not run a bare `pnpm install`; if a lockfile change ever appears in `git diff`, treat it as a defect for this phase and revert it. `coreExports.js`'s realpath assertions (`[VERIFIED: scripts/verify/coreExports.js:244-264]`) are the tripwire.
**Warning signs:** `pnpm-lock.yaml` in the phase diff.

### Pitfall 14: `AGENTS.md` process rules (binding)

**What goes wrong:** names land in code before confirmation; plans execute without a briefing; class methods are described as bare names.
**How to avoid:**
  - **Per-plan briefing gate:** before executing *any* plan (including under `--auto`), report plan id + goal, what it will do and what problem it solves, and how completion is verified — then **wait for explicit approval**. Per plan, in execution order; never batch.
  - **Per-plan completion report:** report (① what the finished plan actually did — outcomes, exact verify-command results, deviations, commit hashes) **and** (② the next plan's id/goal/tasks/problem/verification), then wait for approval. Never chain silently.
  - **Naming confirmation before landing:** every important name (file, interface, method, function, type, package, exported symbol) must be reported in `.planning/phases/03-…/INTERFACE-NAME.md`, **one section per plan**, each entry stating what the thing is for, and confirmed by the user before it is written into code, plans, or config. Internal function-body locals are exempt.
  - **`ClassName.methodName`:** any class method mentioned in chat/plans/CONTEXT/INTERFACE-NAME/comments must be written as `ClassName.methodName` (e.g. `EditorCore.registerCapability`), never bare. Free functions stay bare; a method on a plain object literal is written `symbol.member`.
  - **Questions are answer-only; direction is the user's call.**
**Warning signs:** a plan file containing unconfirmed exported names; a method referred to as `registerCapability`.

### Pitfall 15: Framing the design around an engine

**What goes wrong:** examples, constants, or kind names use `mota`/`tower`/`floor`/`loc`/`idnum` as the design basis.
**Why it happens:** the repo's own source is full of that vocabulary.
**How to avoid:** the user mandated engine-neutral framing — use `acme.thing`-style examples and engine-neutral ids. Core must not learn any engine's vocabulary (ARCHITECTURE §5.1). The Phase-5 gate that greps for game identifiers is out of scope here, but the *examples and test fixtures written in Phase 3* must already be neutral.
**Warning signs:** a kernel test fixture registering `mota.tower`.

## Runtime State Inventory

> Phase 3 is a **greenfield-addition** phase: it moves no production code and renames no existing string. Per the section's trigger rule it is omitted. The one runtime-adjacent item — the previously dormant `requireZero` dependency-cruiser rule beginning to apply once core owns singletons — does **not** trigger in Phase 3 (no singleton is introduced), and is covered in §Pitfall 10.

## Code Examples

Verified patterns from in-repo sources and executed probes.

### Module-state gate selectors (proven by execution)

```js
// Executed with the repo's own ESLint 9.39.2 + typescript-eslint parser on a probe file.
// Caught (error):
//   4:1   mutableLet     -> Program > VariableDeclaration[kind="let"]
//   5:1   mutableVar     -> Program > VariableDeclaration[kind="var"]
//   6:8   exportedLet    -> Program > ExportNamedDeclaration > VariableDeclaration[kind="let"]
//  36:13  fetch          -> no-restricted-globals
//  37:13  window         -> no-restricted-globals
//  38:13  document       -> no-restricted-globals
//  39:13  navigator      -> no-restricted-globals
//  40:13  localStorage   -> no-restricted-globals
//  41:17  XMLHttpRequest -> no-restricted-globals
//  42:13  process.env    -> no-restricted-properties { object: 'process', property: 'env' }
//  16:13  import.meta.env -> MemberExpression[object.type="MetaProperty"][property.name="env"]
// NOT caught (must stay green):
//   function-scope `let local` / `var localVar`
//   export const FROZEN = Object.freeze({ a: 1 })
//   export const FROZEN_MAP = Object.freeze(new Map())
//   export const AS_CONST_OBJ = { a: 1 } as const
//   export const AS_CONST_ARR = [1, 2, 3] as const
//   export const KIND = 'command'            // primitive
//   export function f(){} / export class C{} / export interface I{} / export type T = ...
```

```js
// The combined selector that covers exported AND non-exported module-level const containers,
// while structurally exempting Object.freeze(...) and `as const`:
':matches(Program > VariableDeclaration, Program > ExportNamedDeclaration > VariableDeclaration)' +
  '[kind="const"] > VariableDeclarator > ' +
  ':matches(NewExpression[callee.name=/^(Map|Set|WeakMap|WeakSet)$/], ArrayExpression, ObjectExpression)'
```

**Why the exemption works:** the `>` child combinator only matches a *direct* child. In `Object.freeze({ a: 1 })` the `ObjectExpression` is a child of a `CallExpression`; in `{ a: 1 } as const` it is a child of a `TSAsExpression`. Neither is a direct child of the `VariableDeclarator`, so neither matches. No parent traversal (which esquery does not support) is needed.

### Registry: compute-then-commit skeleton

```ts
// Candidate — names are candidates pending INTERFACE-NAME.md confirmation.
// Contract shape follows RegisterPackResult (packages/apps/editor/src/blockly/registry/index.ts:544-601).

const KIND_PATTERN = /^[A-Za-z][\w-]*(\.[A-Za-z][\w-]*)*$/;   // candidate; see §Open Question 1

interface RegisterCapabilityOptions {
  readonly owner?: string;
  readonly replaceable?: boolean;   // D-03: defaults to false
}

interface RegisterCapabilityResult {
  readonly disposer: () => void;                       // no-op on failure (D-02)
  readonly diagnostics: readonly Diagnostic[];         // empty on success
}

// EditorCore.registerCapability(kind, id, value, options) → RegisterCapabilityResult
// 1. if (!KIND_PATTERN.test(kind)) return { disposer: noop, diagnostics: [error 'capability.kind-invalid'] }
// 2. existing = map.get(key)
//    if (existing && !existing.replaceable) return { disposer: noop, diagnostics: [error 'capability.duplicate' (owner = existing.owner)] }
// 3. commit: map.set(key, entry); teardowns.push(revoke)   // single mutation, so no repair path is needed
// 4. return { disposer: revoke, diagnostics: [] }
```

### Atomic construction + startup error

```ts
// Candidate shape
class EditorCoreStartupError extends Error {
  readonly diagnostics: readonly Diagnostic[];   // D-08: carries ALL diagnostics, not just the missing ones
  constructor(diagnostics: readonly Diagnostic[]) { /* message summarises the missing required refs */ }
}

function createEditorCore(config: EditorCoreConfig): EditorCore {
  const diagnostics = createDiagnosticBus();
  const teardowns: Array<() => void> = [];
  let disposed = false;
  // …build registry, apply config.install(registrar)…
  const missing = resolveRequired(config.required ?? [], builtinRequired, registry);
  if (missing.length > 0) {
    for (const ref of missing) diagnostics.push({ severity: 'error', code: 'capability.required-missing', target: ref, … });
    disposeInReverse(teardowns, diagnostics);        // D-08: reverse-order dispose of what was created
    throw new EditorCoreStartupError(diagnostics.snapshot());
  }
  return { /* registry quartet + .diagnostics + .dispose */ };
}
```

### Port grounding — the real Phase-4 call sites

```ts
// FsPort must cover exactly what the resource layer calls. Grep of packages/apps/editor/src:
//   FileHandler.ts:76            fs.promises.writeFile(path, value, 'utf-8')
//   FileHandler.ts:102           fs.promises.deleteFile(path)
//   FileHandler.ts:120           fs.promises.readFile(this.path, 'utf-8')
//   BinaryFileHandler.ts:65      fs.promises.readFileBinary(this.path)
//   ImageAssetResource.ts:65     fs.promises.readFileBinary(this.path)
//   ImageAssetResource.ts:113    fs.promises.writeFile(path, encoded, 'base64')
//   ImageAssetResource.ts:127    fs.promises.deleteFile(path)
//   AssetDirectoryResource.ts:50 fs.promises.readdir(this.path)
//   MaterialCollectionResource.ts:245 this.dependencies.fs.promises.readdir('project/autotiles')
//   mapLayerSettings.ts:174      fs.promises.mkdir('.metaphysics')
//   schemaOverrideCommands.ts:233,244  fs.promises.mkdir(...)
//   FileHandlerManager.ts:107    fs.promises.readFile(path, 'utf-8')
// Declared but with NO production caller in editor/src: writeMultiFiles (only fs.ts + fs.test.ts).
```

`[VERIFIED: packages/apps/editor/src/services/fs/fs.ts:23-32]` is the current Promise API — the minimal honest `FsPort`:

```ts
// packages/apps/editor/src/services/fs/fs.ts:23-32 (verbatim)
export interface FsPromiseApi {
  readFile(filename: string, encoding: FileEncoding): Promise<string>;
  readFileBinary(filename: string): Promise<ArrayBuffer>;
  writeFile(filename: string, data: string, encoding: FileEncoding): Promise<void>;
  writeMultiFiles(filenames: string[], dataList: string[]): Promise<void>;
  readdir(path: string): Promise<string[]>;
  mkdir(path: string): Promise<void>;
  moveFile(src: string, dest: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
}
```

`[VERIFIED: packages/apps/editor/src/fs/errors.ts:10-20]` is the not-found contract `FsPort` must preserve:

```ts
// packages/apps/editor/src/fs/errors.ts:10-20 (verbatim)
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

`HostPort`'s Phase-4 need is endpoint resolution `[VERIFIED: packages/apps/editor/src/environment.ts:12-19]`:

```ts
// packages/apps/editor/src/environment.ts:12-19 (verbatim)
  endpoints: {
    fs: string;
    runtime: string;
    preview: string;
    docs?: string;
    project: string;
    update?: string;
  };
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Module-level `export const x = new X()` service singletons | Per-instance object graph from a factory | This milestone (Phase 3 introduces it; Phase 11 completes the cutover) | Two cores coexist; per-test isolation; eventual plugin scoping |
| `throw` on the first registration conflict | Collect diagnostics, then one aggregated report / one startup error | Phase 3 | ARCHITECTURE Anti-Pattern 7; already modelled in-repo by `registerPack` |
| Global event bus (`notify.ts`) | Per-instance bus with append-only history | Phase 3 | Construction-time diagnostics remain readable; no cross-instance leakage |

**Deprecated/outdated in this phase's context:**
- `runtimeProtocolVersion: 3` vs `RUNTIME_PROTOCOL_VERSION = 4` drift — deliberately **not** fixed (REQUIREMENTS VERIFY-07 / Out of Scope). Phase 3 must not touch it.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `kind` format validation should accept **one or more** dot-separated segments (so `command` and `code.language` are both valid) | §Open Question 1 | D-04 says "必须形如 `段.段`" but lists `command` (single segment) as an example — a literal two-segment rule would reject a locked example. If the user wants a strict two-segment minimum, the core kind for commands must be renamed |
| A2 | Segment charset must permit camelCase (`table.fieldEditor` appears in ARCHITECTURE's kind union) | §Open Question 1 | A lowercase-only regex would reject a planned kind name |
| A3 | Capability ports (table/code/asset/map) are **out of scope** for Phase 3 despite ROADMAP criterion 4's wording | §Open Question 1 | If the validator reads ROADMAP criterion 4 literally, PORT-01 is only partially satisfied in Phase 3 — needs an explicit, recorded divergence |
| A4 | `dispose()` reports collected teardown failures via the DiagnosticBus (+ console), not via a return value or a throw | §Pattern 3, §Open Question 4 | D-09 says "collected + reported" without naming the channel; a different channel changes the observable contract |
| A5 | `createEditorCore`'s config gives the composition root a narrow registrar with both `register(...)` and a teardown hook — not the `EditorCore` instance | §Open Question 5 | If the user prefers a declarative `capabilities: [...]` array only, KERN-02's ordering test needs a different observable |
| A6 | The Vitest react plugin and global `jsdom` do not interfere with plain `.ts` kernel tests | §Pitfall 11 | If they do, the fix is a per-file environment docblock and/or `include` narrowing — cheap, but should be verified on the first test file |
| A7 | `EDITOR_CORE_API_VERSION` lives in `lib/kernel/core.ts` (D-16 enumerates only four kernel files) | §Open Question 2 | A dedicated `version.ts` may be preferred; both satisfy D-11 |
| A8 | No capability-kind constants should be exported in Phase 3 (core owns no kind yet) | §Open Question 6 | D-04 permits exporting constants for owned kinds; defining `KIND_COMMAND` etc. now would freeze names for capabilities that arrive in Phases 7–10 |

## Open Questions (RESOLVED)

> All six questions below were resolved during phase planning and are consumed by plans 03-01..03-04. Each carries an inline `RESOLVED` marker naming the decision that settled it; no open planning question remains.

1. **`kind` format: the locked decision is internally inconsistent, and capability ports are out of scope.** — **RESOLVED (D-17):** adopt one-or-more dot-separated segments with the camelCase-tolerant charset `^[A-Za-z][\w-]*(\.[A-Za-z][\w-]*)*$`, and record PORT-01 as partially satisfied in Phase 3 (capability ports land in Phases 7–10). Both points are carried in the plans' assumptions and in INTERFACE-NAME.md.
   - What we know: D-04 says runtime validation must require the shape `段.段` (segment-dot-segment) **and** lists `command` — a single segment — as a valid example. ARCHITECTURE's draft kind union also contains bare `command`/`keybinding` and camelCase `table.fieldEditor`. Separately, ROADMAP criterion 4 lists "capability ports" among the exports, while D-14 (four ports only), Deferred Ideas, and the REQUIREMENTS PORT-01 text ("及各 capability port 接口") put capability ports in Phases 7–10.
   - What's unclear: whether "段.段" is a literal two-segment minimum, and whether the plan must record a PORT-01 partial-satisfaction divergence.
   - Recommendation: adopt **one-or-more** segments with a camelCase-tolerant charset (e.g. `^[A-Za-z][\w-]*(\.[A-Za-z][\w-]*)*$`) and state in the plan that capability ports land in Phases 7–10, with Phase 3 satisfying the four named ports. Both points belong in `INTERFACE-NAME.md` / the plan's assumptions so the user can overrule.

2. **Where does `EDITOR_CORE_API_VERSION` live?** — **RESOLVED (D-20):** defined in `lib/kernel/core.ts` (no fifth kernel file) and re-exported from `lib/index.ts`; `version.ts` is recorded as the alternative in INTERFACE-NAME.md.
   - What we know: D-11 requires an exported const, not an instance member; D-16 enumerates four kernel files without a `version.ts`.
   - What's unclear: whether adding a fifth kernel file is acceptable.
   - Recommendation: define it in `lib/kernel/core.ts` and re-export from `lib/index.ts`. List `version.ts` as the alternative in `INTERFACE-NAME.md`.

3. **`snapshotCapabilities()` container shape.** — **RESOLVED (D-19):** a flat, frozen array of entries (`readonly { kind, id, value, owner }[]`), pinned by the registry and API-surface tests.
   - What we know: CONTEXT leaves this to the agent; D-01 fixes the method name. The repo uses `ReadonlyMap` in ARCHITECTURE's sketch but plain objects/`Record` in most real code.
   - What's unclear: `ReadonlyMap<string, ReadonlyMap<string, unknown>>` (nested) vs `Record<kind, Record<id, unknown>>` vs a flat `readonly CapabilityRef[]`.
   - Recommendation: a flat, frozen **array of entries** (`readonly { kind, id, value, owner }[]`) is the most ergonomic for UI/debug consumers and avoids the nested-`ReadonlyMap` typing noise; a nested `ReadonlyMap` is the closest to ARCHITECTURE's sketch. Decide in `INTERFACE-NAME.md` and pin with a test.

4. **Which channel reports teardown failures collected by `EditorCore.dispose()`?** — **RESOLVED (D-21):** the `DiagnosticBus` (`severity: 'error'` + the dedicated `lifecycle.teardown-failed` code) plus a `console` line, both asserted by `coreLifecycle.test.ts`.
   - What we know: D-09 requires "collected + reported" with a sync `void` return and no aborting.
   - Recommendation: DiagnosticBus + console, as in A4. Confirm because it becomes observable contract.

5. **How does the composition root satisfy required registrations during construction?** — **RESOLVED (D-18):** `config` carries an `install(registrar)` callback whose `registrar` is a narrow interface (`CapabilityRegistrar.register` + `CapabilityRegistrar.addTeardown`), never the `EditorCore` instance; this is what makes the reverse-order release observable in tests.
   - What we know: D-07 puts the required list in config; D-08 fails construction if unresolved; D-12 forbids exposing `host`/`engine` on the instance.
   - What's unclear: whether config carries a declarative `capabilities: readonly CapabilityRegistration[]` array, a `install(registrar)` callback, or both.
   - Recommendation: `install(registrar)` where `registrar` is a **narrow** interface (`register(...)` + a teardown hook), never the `EditorCore` instance — this satisfies D-12's spirit, keeps D-01's "instance is the only entry point" for post-construction callers, and is the only shape that makes KERN-02's ordering observable in tests.

6. **Which names are proposed, and is `subpathStatus.json` updated?** — **RESOLVED (INTERFACE-NAME.md N-01..N-26):** the full name set is confirmed and used verbatim by plans 03-01..03-04, and `.` in `subpathStatus.json` is updated to `kernel-exports` together with `scripts/verify/coreExports.js`.
   - Candidate names (**all confirmed via `INTERFACE-NAME.md`, N-01..N-26**):
     - `lib/kernel/core.ts` — `createEditorCore`, `EditorCore`, `EditorCoreConfig`, `EDITOR_CORE_API_VERSION`
     - `lib/kernel/registry.ts` — capability registry implementation, `CapabilityRef`, `RegisterCapabilityOptions`, `RegisterCapabilityResult`, kind-format validator
     - `lib/kernel/diagnostics.ts` — `Diagnostic`, `DiagnosticBus`, `createDiagnosticBus`
     - `lib/kernel/errors.ts` — `EditorCoreStartupError`
     - `lib/ports/{engine,fs,host,preview}.ts` + `lib/ports/index.ts` — `EngineAdapter`, `FsPort`, `HostPort`, `PreviewAdapter`
     - Diagnostic `code` constants — a single `as const` table (e.g. `capability.duplicate`, `capability.kind-invalid`, `capability.required-missing`, `diagnostic.subscriber-error`, `lifecycle.teardown-failed`), prefix `capability.`/`diagnostic.`/`lifecycle.`
     - Kind constants — **none in Phase 3** (see A8)
   - Also decide whether `.` in `subpathStatus.json` is updated (Pitfall 8).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | verifiers, Vitest, ESLint | ✓ | v24.21.0 (CI pins 24) | — |
| pnpm | workspace fan-out | ✓ | 12.5.1 (matches CI pin) | — |
| TypeScript | `tsc -b` typecheck | ✓ | 5.9.3 | — |
| Vitest | kernel unit tests | ✓ | 4.0.18 | — |
| ESLint (flat config) | PORT-02 + module-state gate | ✓ | 9.39.2 | — |
| typescript-eslint | TS parser for selectors | ✓ | 8.50.1 (catalog) | — |
| dependency-cruiser | module-edge boundary | ✓ | 18.2.0 | — |
| `packages/apps/editor/styled-system/` | core's `tsc -b` + vitest alias | ✓ (generated) | regenerated by editor's `prepare: panda codegen` on `pnpm install` | add an explicit `panda codegen` step to `typecheck`/`unit` if `prepare` ever stops running |

**Missing dependencies with no fallback:** none — this phase installs nothing and needs no network.

**Missing dependencies with fallback:** none.

## Validation Architecture

> `workflow.nyquist_validation` is `true` `[VERIFIED: .planning/config.json:24]`, so this section is required. All checks run inside the **existing four CI jobs** (no new job — `ci-workflow.js` asserts exactly four).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 (`packages/libs/editor-core/vitest.config.ts`, one project) |
| Config file | `packages/libs/editor-core/vitest.config.ts` — `include: ['lib/**/*.test.{ts,tsx}']`, `environment: 'jsdom'` |
| Quick run command | `pnpm --filter @motajs/editor-core test` |
| Full suite command | `pnpm test` (root fan-out, `pnpm -r run test`) |
| Per-file env for kernel tests | `// @vitest-environment node` docblock at the top of each kernel test file |
| Gate commands | `pnpm lint` (incl. `node scripts/verify/coreBoundaries.js` + the new module-state verifier), `pnpm typecheck` (incl. `node scripts/verify/coreExports.js`), `pnpm test`, `pnpm build` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| KERN-01 | `createEditorCore(config)` returns a per-instance `EditorCore`; two instances coexist | unit | `pnpm --filter @motajs/editor-core exec vitest run lib/__tests__/coreIsolation.test.ts` | ❌ Wave 0 |
| KERN-02 | `dispose()` releases in reverse creation order; idempotent; a throwing teardown does not abort the rest | unit | `… vitest run lib/__tests__/coreLifecycle.test.ts` | ❌ Wave 0 |
| KERN-03 | `registerCapability` returns `{disposer, diagnostics}`; duplicate rejected without side effect; failed replacement restores the previous value; `getCapability`/`getCapabilityOrThrow`/`snapshotCapabilities` behave | unit | `… vitest run lib/__tests__/capabilityRegistry.test.ts` | ❌ Wave 0 |
| KERN-04 | construction aggregates diagnostics; missing required → reverse-order dispose + `EditorCoreStartupError` carrying all diagnostics; non-blocking `error` diagnostics do not block | unit | `… vitest run lib/__tests__/coreStartup.test.ts` | ❌ Wave 0 |
| KERN-05 | `EDITOR_CORE_API_VERSION` and `DiagnosticBus` are exported; bus history/subscribe/subscriber-error-isolation semantics | unit + export-surface | `… vitest run lib/__tests__/diagnostics.test.ts` **and** `node scripts/verify/coreExports.js` (extended) or a new `coreApiSurface.js` in the `typecheck` job | ❌ Wave 0 |
| KERN-06 | isolation: A's capabilities invisible to B; A/B diagnostic histories disjoint; disposing A leaves B working; A's disposer does not affect B | unit | `… vitest run lib/__tests__/coreIsolation.test.ts` | ❌ Wave 0 |
| KERN-06 (structural) | no module-level mutable bindings in `lib/**` (composition root excepted) | static gate + two-polarity | `pnpm lint` (scoped selectors) + `node scripts/verify/coreModuleState.js` (real tree green **and** synthetic `let` fixture red) in the `lint` job | ❌ Wave 0 |
| PORT-01 | the four port interfaces exist and are exported | export-surface + typecheck | `node scripts/verify/coreExports.js`-style surface assertion (or `coreApiSurface.js`) + `pnpm typecheck` | ❌ Wave 0 |
| PORT-02 | core source has no `fetch`/`window`/`document`/`navigator`/`localStorage`/`XMLHttpRequest`/`process.env`/`import.meta.env` | static gate + two-polarity | `pnpm lint` (scoped override) + a synthetic fixture containing each banned identifier that **must** produce errors, in the `lint` job | ❌ Wave 0 |
| PORT-02 (edges) | core does not import host/engine; kernel does not import capabilities; no cycles | static gate (existing) | `node scripts/verify/coreBoundaries.js` in the `lint` job | ✅ exists |
| Regression | `@motajs/editor` unchanged; Phase 1/2 baseline stays green | full suite | `pnpm typecheck && pnpm test && pnpm build` + `node scripts/verify/coreBoundaries.js` + `node scripts/verify/editorArtifactAssets.js` | ✅ exists |

### Sampling Rate

- **Per task commit:** `pnpm --filter @motajs/editor-core test` (fast, isolated to the new tests).
- **Per wave merge:** `pnpm lint && pnpm typecheck && pnpm test` (the three local analogues of the CI jobs).
- **Phase gate:** all four CI jobs green before `/gsd-verify-work`; plus `node scripts/verify/ci-workflow.js` to confirm the job contract was not altered.

### Wave 0 Gaps

- [ ] `packages/libs/editor-core/lib/__tests__/capabilityRegistry.test.ts` — covers KERN-03
- [ ] `packages/libs/editor-core/lib/__tests__/diagnostics.test.ts` — covers KERN-05
- [ ] `packages/libs/editor-core/lib/__tests__/coreStartup.test.ts` — covers KERN-04
- [ ] `packages/libs/editor-core/lib/__tests__/coreLifecycle.test.ts` — covers KERN-02
- [ ] `packages/libs/editor-core/lib/__tests__/coreIsolation.test.ts` — covers KERN-01/KERN-06
- [ ] `packages/libs/editor-core/lib/__tests__/coreApiSurface.test.ts` (or a `scripts/verify/coreApiSurface.js`) — covers KERN-05/PORT-01 export assertions
- [ ] `scripts/verify/coreModuleState.js` — the module-state gate's two-polarity proof (synthetic `let` fixture → non-zero; real tree → zero), wired as an extra `- run:` step in the `lint` job
- [ ] PORT-02 two-polarity proof — either folded into `coreModuleState.js` or a sibling verifier that lints a synthetic fixture containing each banned identifier and asserts each rule fires
- [ ] No framework install needed — Vitest/ESLint/dependency-cruiser already present

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1`, `security_block_on: high` `[VERIFIED: .planning/config.json:47-49]`. Phase 3 is a browser-side kernel library with no auth, sessions, or cryptography — but it *is* the input-validation and memory-lifetime boundary for third-party registrations, so V5 applies concretely.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No authentication surface in this phase |
| V3 Session Management | no | No session state in this phase |
| V4 Access Control | no | `owner` is a diagnostic label only and must **not** be treated as an authorization input (D-03) — this is an explicit "do not build access control here" rule |
| V5 Input Validation | **yes** | Validate `kind` (format regex) and `id` at registration; reject with a diagnostic rather than trusting the caller. Store entries in a `Map`, **never** as bare object keys, so `__proto__`/`constructor` ids cannot pollute a prototype |
| V6 Cryptography | no | Nothing cryptographic; do not hand-roll any hashing/signing |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prototype pollution via a capability `kind`/`id` (e.g. `__proto__`) | Tampering | Use `Map` keyed by a composed string; never assign into a plain object; `snapshotCapabilities()` returns frozen/copied entries |
| Unbounded listener growth on the DiagnosticBus (a leak per subscribe without unsubscribe) | Denial of Service | `subscribe()` returns an unsubscribe function (mirroring `subscribeNotifications` `[VERIFIED: packages/apps/editor/src/utils/notify.ts:12-15]`); push the unsubscribe onto the teardown stack so `dispose()` drains it |
| Unbounded diagnostic history retention | Denial of Service | D-05/D-06 deliberately keep history append-only with no cap; **record this as a known accepted risk for Phase 3** (diagnostics are construction-time and low-volume) and revisit if a long-lived session starts producing them |
| Retaining arbitrary objects via `Diagnostic.cause` | Information Disclosure | `cause` is `unknown` and retained by reference; document that producers should pass `Error` instances, and never serialize `cause` in this phase (no telemetry exists) |
| Sensitive data in `Diagnostic.message` | Information Disclosure | Messages are developer-facing Chinese text; never include file contents or credentials (there is no such producer in Phase 3) |
| Gate bypass by disabling the core ESLint override | Elevation of Privilege | `lint-severities.js` guards rule severities; the module-state/PORT-02 verifiers must carry a two-polarity proof so a vacuous rule cannot masquerade as green |
| Path traversal | Tampering | **Out of scope here** — path safety lives in the host (`fsApi.ts`), and core only concatenates relative paths (ARCHITECTURE §9.1). `FsPort` must not attempt to normalize or validate paths |

## Sources

### Primary (HIGH confidence — read from source or executed this session)
- `packages/apps/editor/src/blockly/registry/index.ts:428-601, 732-741, 1037` — the `RegisterPackResult` / diagnostics-with-rollback precedent (verbatim quotes above)
- `packages/apps/editor/src/utils/notify.ts:10-21` — the global-listener pub/sub (shape reference only; anti-pattern for core)
- `packages/apps/editor/src/services/fs/fs.ts:23-32, 199-298` — `FsPromiseApi` / `Fs` verbatim
- `packages/apps/editor/src/fs/errors.ts:10-20` — `isFileNotFoundError` verbatim
- `packages/apps/editor/src/fs/types.ts:8-13` — `Content<T>` five-state union verbatim
- `packages/apps/editor/src/fs/FileHandler.ts`, `PersistExecutor.ts:72`, `RuntimeResourceGateway.ts:52-56, 87`, `projectLanguageEnvironment.ts:213-220` — teardown/dispose precedents
- `packages/apps/editor/src/environment.ts:12-19` — host endpoint names verbatim
- `packages/libs/editor-core/{package.json,tsconfig.json,vitest.config.ts,lib/index.ts,lib/react/index.ts,lib/*/index.ts}` — Phase-2 skeleton, verbatim
- `packages/libs/config/tsconfig.lib.base.json:1-30` — `lib: [ESNext, DOM, DOM.Iterable]`, no `erasableSyntaxOnly`
- `eslint.config.js:31-32, 70` — root block scope + `no-empty-object-type: warn`
- `scripts/verify/{coreBoundaries.js,lint-severities.js,coreExports.js,ci-workflow.js}` — the gate contracts, verbatim
- `.dependencyCruiser.cjs:16-66` — the rule set, verbatim
- `.github/workflows/ci.yml:12-108` — the four jobs
- `.planning/phases/02-package-boundary-build-scaffolding/{subpathStatus.json,02-RESEARCH.md}` — the `.` barrel status + carried-forward pitfalls
- `.planning/phases/01-baseline-verification-net/deferred-items.md:1-148` — the pre-existing flake/debt inventory
- `.planning/config.json:24, 47-49` — nyquist_validation + security settings
- **Executed probes (this session):** ESLint 9.39.2 + typescript-eslint parser over synthetic fixtures (module-state selectors, `no-restricted-globals`, `no-restricted-properties` vs `import.meta.env`); `node --version`; `pnpm --version`; `node_modules/{typescript,vitest,eslint,dependency-cruiser}/package.json` versions

### Secondary (MEDIUM confidence — external tool documentation / cross-checked)
- Vitest per-file `@vitest-environment` docblock override — documented Vitest behaviour; to be confirmed on the first kernel test file (A6)
- ESLint `no-restricted-properties` semantics for `MetaProperty` objects — inferred from the rule's `Identifier`-object matching and **confirmed by the executed probe** (silent on `import.meta.env`)

### Tertiary (LOW confidence — flagged for validation)
- None. Every claim above is either read from the repo or executed this session.

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — no packages added; every tool version confirmed by execution; the peer set is machine-asserted by `coreExports.js`
- Architecture (registry/bus/lifecycle shapes): **HIGH** — the registry contract is quoted verbatim from a first-party precedent, and the gate mechanics were proven by running ESLint
- Port shapes: **MEDIUM** — `FsPort`/`HostPort` are grounded in grepped real call sites, but the *shape* (names, granularity) is a design choice; `EngineAdapter`/`PreviewAdapter` are deliberately minimal and will change in Phases 5/11
- Pitfalls: **HIGH** — every pitfall cites a file:line in this repo or an executed probe; the process pitfalls cite `AGENTS.md`
- Validation Architecture: **HIGH** for the commands (all exist and are wired), **MEDIUM** for the new verifier files (to be created)

**Research date:** 2026-09-22
**Valid until:** ~2026-10-22 for the repo-derived facts (they change only if Phases 1/2 artifacts or the tool configs change). The `kind`-format and `EditorCoreConfig` open questions are decision-shaped, not time-shaped.
