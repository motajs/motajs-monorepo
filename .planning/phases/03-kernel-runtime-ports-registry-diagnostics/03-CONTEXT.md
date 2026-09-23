# Phase 3: Kernel — Runtime, Ports, Registry, Diagnostics - Context

**Gathered:** 2026-09-22
**Status:** Ready for planning

<domain>
## Phase Boundary

交付一个**引擎无关、per-instance 的内核**：`createEditorCore(config)` 工厂、`EditorCore` 实例（公开 capability registry + 诊断总线 + 生命周期）、声明的 port 接口、聚合启动诊断，以及「两个实例互不干扰」。

具体包含：
1. `packages/libs/editor-core/lib/kernel/`：组合根 `core.ts`（`createEditorCore` / `EditorCore` / 配置类型 / 启动错误）、`registry.ts`（capability registry + 种类常量）、`diagnostics.ts`（`Diagnostic` + `DiagnosticBus`）、`errors.ts`（启动错误）。
2. `packages/libs/editor-core/lib/ports/`：四个 port 接口（`EngineAdapter`、`FsPort`、`HostPort`、`PreviewAdapter`）。
3. `lib/index.ts` 汇总导出公开面；`EDITOR_CORE_API_VERSION = "0.1.0"`。
4. 测试：两个实例的隔离行为测试；必需项缺失时的启动失败测试；`dispose()` 逆序/幂等测试。
5. 门禁：PORT-02（core 禁 `fetch`/DOM/环境全局）用 ESLint 作用域规则；模块边界继续由 dependency-cruiser 管；core 内「无模块级可变绑定」的结构性门禁。

**不在本阶段范围**：移动 `fs/*`、`project/resources.ts`、`project/history/*`、四大能力、外壳、preview（Phase 4–11）；删除 6 个 singleton 或任何 re-export shim（Phase 11）；切换 `@motajs/editor` 到新内核（Phase 11）；插件加载器（本期不做）；诊断上报/面板（需要时再扩）。

</domain>

<decisions>
## Implementation Decisions

### A. 注册表 API 形态
- **D-01:** capability registry 是 **`EditorCore` 实例上的成员**，以**实例方法**调用：`EditorCore.registerCapability(kind, id, value, { owner, replaceable })`、`EditorCore.getCapability`、`EditorCore.getCapabilityOrThrow`、`EditorCore.snapshotCapabilities`。注册表**不是全局**、也**不是自由函数**；调用方只经过实例这一个入口。私有 service wiring（持久化/资源/历史等）由组合根持有、**不对外暴露**，与公开注册表严格分离。 — **Reversibility:** costly — 这是 Phase 12 要冻结的扩展面，一旦公开即难以收回或改形。
- **D-02:** `EditorCore.registerCapability` 返回 **`{ disposer, diagnostics }`**。成功时 `disposer` 精确撤销本次注册；失败时**无副作用**——若原本是替换已有项，则**还原旧值**（这就是 `requireZero`/KERN 语境里「rollback」的确切含义）——失败的 `disposer` 为 no-op，`diagnostics` 说明原因。 — **Reversibility:** costly — 返回契约是扩展面的一部分。
- **D-03:** `replaceable` **默认 `false`**（想被覆盖必须显式声明）；同名 `kind:id` 再次注册**一律拒绝并产生诊断**；`owner` **仅用于诊断归属**（说清「被谁占用」），**不参与权限判断**。需要分层覆盖时（如将来表格字段编辑器的 core 默认 → 主题 → 表单级），由被覆盖方自行声明 `replaceable: true`。
- **D-04:** `kind` 是**带命名空间的开放字符串**（如 `command`、`code.language`、`acme.anything`）；**core 对种类集合无知**，只为自己拥有的种类**导出字符串常量**供内部调用点使用；注册时做**运行时格式校验**（必须形如 `段.段`）。第三方可自建种类，core 不提前耦合尚未存在的能力。 — **Reversibility:** costly — 源码中会出现大规模 `import { … } from '…/ports/index.js'`、`…/ports/<name>.js`，以及 `…/kernel/<name>.js` 的引用；改动波及 core 全部文件与所有测试 import。

### B. 诊断与启动失败契约
- **D-05:** `Diagnostic` 形状 = `{ severity: 'error' | 'warning' | 'info', code: string, message: string, owner?: string, target?: string, cause?: unknown }`。`code` 是**稳定机器码**（供测试/CI 精确断言）；`message` 是中文人读说明；`cause` 保留原始 `Error`/堆栈。**不**加 `timestamp`/`details`（需要时再扩）。 — **Reversibility:** costly — `code` 是外部可见契约，改名等于破坏性变更。
- **D-06:** `DiagnosticBus` 语义：**同步派发** + **保留追加式历史**（`snapshot()` 读全部已发生、`subscribe()` 收后续——这使得 `createEditorCore` 构造期间产生的诊断在构造返回后仍可读到）+ **订阅者抛错被隔离**（转为一条内部诊断/日志，不影响其它订阅者，也不让生产方失败）。 — **Reversibility:** costly — 与 D-04 同类：会写入 core 每个子系统的 import 与测试。
- **D-07:** 「必需注册」由两份清单共同声明：**组合根显式清单**（适配器随 config 提供自己的必需项）**+ core 内置必需清单**（core 自身机制性的前置）；判定粒度是**具体 `kind:id`**；构造末尾统一核对，缺失项记 `error` 诊断。
- **D-08:** 「启动即失败」= 构造末尾若必需清单未解析 → **逆序 dispose 已创建的部分** → **抛出专用启动错误**（携带全部诊断）→ **不交出任何半成品**（构造原子）。**只有「必需项缺失」阻断启动**；其它 `error` 级诊断（例如一次被拒的重复注册）**不阻断**，但一并携带在报告里。 — **Reversibility:** costly — 调用方与测试都会依赖「抛错而非返回」这一契约。

### C. 生命周期、隔离与版本常量
- **D-09:** `EditorCore.dispose(): void` **同步**；**逆序拆除**；某项抛错**不中断**剩余拆除（收集后报告）；**幂等**（重复调用无副作用）。需要异步清理的部件在 `dispose` 时只做「取消订阅 / 标记停止」，不等待完成。 — **Reversibility:** costly — Phase 12 冻结后把同步改异步是破坏性变更。
- **D-10:** 「两个实例互不干扰」的验证 = **行为隔离测试**（A 注册的能力 B 看不到；A/B 诊断历史互不可见；dispose A 后 B 仍正常；A 的 disposer 不影响 B）**+ 结构性门禁**（断言 `packages/libs/editor-core/lib/**` 内**无模块级可变绑定**，组合根除外），门禁接入现有 4 个 CI job（不新增 job）。
- **D-11:** `EDITOR_CORE_API_VERSION = "0.1.0"`（semver 字符串；未冻结期按 semver 惯例视为不稳定）。**Phase 12 冻结接口面时升到 `"1.0.0"`** 并开始执行 `EXT-03` 的弃用策略。作为**导出的常量**，不作为 `EditorCore` 实例成员。
- **D-12:** `EditorCore` 实例**最小暴露面**：注册表四件套（D-01）+ `.diagnostics`（诊断总线对象，供 `snapshot()`/`subscribe()`）+ `.dispose()`。**不暴露** `host`/`engine`（由组合根持有，需要时以窄接口注入给具体模块）——遵循「绝不把实例本体交给扩展」（`EXT-01`）与「不要把运行时在能力模块间传递」。

### D. 与现有 singleton 的关系、ports 深度、PORT-02 门禁
- **D-13:** **只增不删**。Phase 3 仅在 core 内新增 `lib/kernel/*` 与 `lib/ports/*` 及其测试；**`@motajs/editor` 一行不改**（Phase 2 已为它加了 `@motajs/editor-core` 依赖与探针导入），应用继续跑现有 6 个 singleton。迁移在 Phase 4/5，切换与删除在 Phase 11。
- **D-14:** 四个 port 接口**都存在并导出**（满足 PORT-01），但**按已知消费者最小定义**：`FsPort`/`HostPort` 依 Phase 4 资源层的真实需求写得较实；`EngineAdapter` 只定义入口形状（Phase 5 扩充）；`PreviewAdapter` 只留最小占位（Phase 11 扩充）。**不猜、不写空接口**。 — **Reversibility:** costly — 给已发布的接口**加成员**对实现者是破坏性变更（Phase 5/11 扩充时要走一次显式的接口演进）。
- **D-15:** PORT-02 用**工具分工**保证：**ESLint 作用域规则**禁全局标识符（`no-restricted-globals`: `fetch`/`window`/`document`/`navigator`/`localStorage`/`XMLHttpRequest`；必要时 `no-restricted-properties` 禁 `process.env`/`import.meta.env`），作用域限定 `packages/libs/editor-core/**`；**dependency-cruiser** 继续管模块边界（core 不得 import 宿主/引擎）。复用已有的 `scripts/verify/lint-severities.js` 完整性检查（保证规则严重级别不被偷偷下调）。**注意**：适配器**可以**用 `fetch`（它负责 HTTP 传输），禁令只针对 core。
- **D-16:** 目录划分：**`lib/kernel/` 放内核机制**（`core.ts` / `registry.ts` / `diagnostics.ts` / `errors.ts`），**`lib/ports/` 单放四个 port 接口**；`lib/index.ts` 汇总导出公开面。理由：ports 是「面向实现者的契约」，与「内核机制」概念不同，且 Phase 5+ 会显著长大。 — **Reversibility:** costly — 目录/文件迁移会牵动 core 内几乎所有 import 与测试路径。

### E. 研究补充决策（2026-09-22，research 暴露的矛盾/缺口）
- **D-17:** `kind` 的合法格式为**一段或多段**，字符集允许 camelCase 与连字符：`^[A-Za-z][\w-]*(\.[A-Za-z][\w-]*)*$`（因此 `command`、`keybinding` 这类单段名合法，`code.language`、`table.fieldEditor` 也合法）。这修正了 D-04 里「要求 `段.段` 却又把单段的 `command` 列为合法示例」的内部矛盾。同时**记录一处需求缺口**：ROADMAP 成功标准 4 把「capability ports」列为导出项，但 capability port 接口属于 Phase 7–10（D-14 只交付四个具名 port，Deferred Ideas 亦然）——**Phase 3 对 PORT-01 是部分满足**，需在计划假设中显式记录，供后续阶段补齐。
- **D-18:** 组合根在**构造期间**满足必需注册的方式是 `config` 传入一个 **`install(registrar)` 回调**，其中 `registrar` 是一个**窄接口**（只含 `register(...)` 与拆除钩子），**不是** `EditorCore` 实例。这既符合 D-12「不暴露实例」，又让 KERN-02 的逆序释放顺序在测试中可观测。
- **D-19:** `EditorCore.snapshotCapabilities()` 返回**扁平的、冻结的条目数组**：`readonly { kind, id, value, owner }[]`（而非嵌套 `ReadonlyMap` 或 `Record`）。理由：对 UI/调试消费方最直观，且避免嵌套只读 Map 的类型噪声。
- **D-20:** `EDITOR_CORE_API_VERSION` 定义在 **`lib/kernel/core.ts`**（不新增第五个内核文件），并从 `lib/index.ts` 再导出。
- **D-21:** `EditorCore.dispose()` 收集到的拆除失败走 **`DiagnosticBus`**（`severity: 'error'` + 专用 code）**并同时 `console` 一份**。这使其可被测试断言，也能在控制台被现场排查者看到。

- **D-22:** **D-10 的有意识细化**（plan-checker 建议、用户批准）：module-state 结构门禁只覆盖**生产源码**，即在忽略列表中除组合根 `lib/kernel/core.ts` 之外，**再排除 `lib/__tests__/**`**。理由：测试文件不随产品发布，且测试合法地需要模块级 fixture 表；门禁的目的是生产模块状态。**测试侧的纪律作为约定保留**（每个建测试的任务都要求：模块级 fixture 表必须 `as const` / `Object.freeze(...)` 或声明在函数内），但它**不受机器强制**——这是本细化的已知代价，记录于此以便后续阶段可重新收紧。

### the agent's Discretion
- 诊断 `code` 的具体命名规则与常量表（但需在 `INTERFACE-NAME.md` 中列明并经确认）。
- `EditorCoreConfig` 的确切字段集（在 D-07/D-13/D-14/D-18 的约束下）。
- 隔离测试与结构门禁的具体断言粒度。
- ESLint 规则的具体选项形状与文件放置方式（放进根配置的 override，还是新建一个 core 专属配置片段）。
- 诊断总线的内部实现细节（监听者容器、历史容量上限等）。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 项目与阶段上下文
- `.planning/PROJECT.md` — 核心价值（引擎无关内核 + 第三方可定制）、纯重构/对外行为不变约束、方向更新（editor-type 后续）
- `.planning/REQUIREMENTS.md` — KERN-01..KERN-06、PORT-01..PORT-02（本阶段覆盖）；VERIFY-05 的 `requireZero` 澄清注
- `.planning/ROADMAP.md` §Phase 3 — 目标与 5 条成功标准；§Phase 4/5/11 用于理解这些 port 与内核的后续消费者
- `.planning/STATE.md` — 分支规则（本次里程碑共用一个分支 `editor/core-extract`）、既有决策与两个 MEDIUM 开放项
- `.planning/research/SUMMARY.md` — 四份研究文件的收敛结论（`EditorCore` 命名统一、`lib/` 约定、capability build order）
- `.planning/research/ARCHITECTURE.md` — **本阶段设计的直接来源**：Pattern 1（per-instance 运行时替代模块 singleton，含 `createEditorRuntime` 示意）、Pattern 2（**两个注册表**：公开 capability registry vs 私有 service wiring，含 `registerCapability`/`getCapability`/`getCapabilityOrThrow`/`snapshotCapabilities` 示意与五条规则）、§4.3 注册流（组合根收集全部诊断后统一报告）、§8 反模式（6 静默默认选择、7 首个注册错误即抛、2 保留模块级 singleton）
- `.planning/codebase/CONCERNS.md` — 现有 6 个模块级 singleton 与它们的调用面（迁移风险来源）
- `AGENTS.md` — Project Rules（**每次 plan 执行前必须简报并等待批准**、重要命名须先经 `INTERFACE-NAME.md` 确认、**描述类方法必须用 `类名.方法名`**、提问只答不改、方向由用户掌握）

### 受影响的现有文件
- `packages/libs/editor-core/package.json` / `tsconfig.json` / `vitest.config.ts` / `lib/index.ts` — Phase 2 建立的骨架；本阶段在其中新增 `lib/kernel/*`、`lib/ports/*` 并从 `lib/index.ts` 汇总导出
- `packages/libs/editor-core/lib/react/index.ts`、`lib/react/CoreProbe.tsx` — Phase 2 的临时探针（Phase 4+ 替换；本阶段不动）
- `.dependencyCruiser.cjs` — Phase 2 建立的边界规则（含针对 6 个 singleton 的 `requireZero` 规则，本阶段仍为空集；core 不得 import 宿主/引擎的规则在此）
- `scripts/verify/coreBoundaries.js`、`coreExports.js`、`corePandaClass.js`、`coreReactCompiler.js`、`editorArtifactAssets.js` — Phase 2 的 verifier 与两极性门禁范式（新门禁沿用同一风格）
- `.github/workflows/ci.yml` + `scripts/verify/ci-workflow.js` — 四 job 契约（新门禁只能塞进现有 job，不得新增/改名 job）
- `packages/apps/editor/eslint.config.js` — per-package ESLint 配置的现有先例（core 的作用域规则可参照）
- `scripts/verify/lint-severities.js` — 保证 ESLint 规则严重级别不被下调的完整性检查（D-15 复用）
- `packages/apps/editor/src/blockly/registry/index.ts:428-490` — **第一方先例**：`registerPack` 返回 `RegisterPackResult`（诊断而非抛错）并在失败时还原上一个 pack；D-02/D-08 的诊断+回滚形状可对照它（core **不得 import** 它，只是模式参照）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/libs/editor-core/`（Phase 2 已建）：`lib/` 布局、7 个 subpath、`vitest.config.ts`（resolvePlugin + react-compiler + jsdom + `@styled-system` 别名）、smoke test——本阶段直接在其中加目录。
- `scripts/verify/*.js`（Phase 1/2）：ESM + 中文头注 + `failures[]` + `process.exit(1)` + 「全部断言通过」的 verifier 范式；`coreBoundaries.js` 的**两极性**证明（真实树过 + 合成违规必须失败）是新增门禁的模板。
- `.dependencyCruiser.cjs`（Phase 2）：已含 `core-must-not-import-consumers`、D-06 单向 DAG 三条、`no-circular`、以及一条当前空转的 `requireZero` 单例规则——本阶段只需新增「无模块级可变绑定」这一类检查（或作为独立 verifier）。
- `packages/apps/service-worker/vite.config.ts:70` 与 `packages/libs/config/resolvePlugin.js`：`@/` 的 importer 相对解析（core 内**不用** `@/`，D-06 已改相对导入）。
- `packages/libs/utils/lib/exception.ts` 等：仓内异常/结果类型的风格参照（命名工厂、判别联合）。

### Established Patterns
- **共享库以源码 TS 直出**（`exports` 指向 `lib/index.ts`，无 build 步骤）；`tsc -b` 只做类型检查。
- **门禁必须是「跑真实工具 + 读真实输出 + 能失败」**（Phase 2 的核心教训）：Phase 2 抓到过一个真实回归（移除 `'@'` 别名导致 CSS `url()` 解析失败、字体被静默丢弃），说明「绿」不等于「活着」。
- **per-package ESLint 配置**已在 editor 存在先例；core 的 PORT-02 规则应放在作用域限定 core 的 override/配置里。
- **四 job CI 契约是硬约束**：`lint`/`typecheck`/`unit`/`build`，新检查只能加步骤。
- **命名集中于 `.planning/phases/<phase>/INTERFACE-NAME.md`**（每 Plan 一节，须说明用途），落盘前须经用户确认。

### Integration Points
- `packages/libs/editor-core/lib/index.ts`（公开面汇总出口）
- `packages/libs/editor-core/lib/kernel/*`、`lib/ports/*`（本阶段新建）
- `.dependencyCruiser.cjs`（新增/调整规则）
- core 作用域的 ESLint 配置（新建 override 或配置片段）
- `.github/workflows/ci.yml`（在现有 job 内追加步骤）
- 以后（非本阶段）的接入点：Phase 4 资源层/历史、Phase 5 `defineEngine` 适配器、Phase 11 组合根切换与删除 singleton

</code_context>

<specifics>
## Specific Ideas

- **「core」不要被理解成新的全局**：`EditorCore` 是组合根创建的一个对象图，每次 `createEditorCore()` 得到独立实例；本阶段交付的就是「实例化能力 + 隔离能力」。命名上避免把实例变量写得像全局（局部变量建议用 `editor`，类型名仍是锁定的 `EditorCore`）。
- **不要把设计框定在 mota-js 上**（用户明确要求）：core 不认识任何引擎的文件结构、路径、词汇、格式；任何引擎都只是第一个适配器。示例与常量一律用引擎中性的说法（如 `acme.anything`），不使用 `mota.*` 作为设计依据。
- **两个注册表分离**是机制要点：公开 capability registry（D-01）与私有 service wiring 不可混同；否则内部实现会意外成为公开 API。
- **诊断优先于抛错**用于「注册/校验」类问题；**抛错**只用于「构造无法完成」这一种情形（D-08）。
- **启动失败要能解释**：专用启动错误必须携带**全部**诊断，使测试与调用方能区分「启动失败」与「代码 bug」。
- **门禁要能失败**：新增的 PORT-02 规则与「无模块级可变绑定」检查都必须有办法证明它会红（沿用 Phase 2 的两极性做法）。
- **本阶段对外行为零变化**：`@motajs/editor` 不改，Phase 1/2 的基线与门禁必须持续为绿。

</specifics>

<deferred>
## Deferred Ideas

- **能力热替换/卸载的真实场景（扩展加载器）** — 本期不实现插件加载；D-02 的 `disposer` 与 D-01 的注册表形状为其预留接口。
- **诊断的 `source`/`timestamp`/`details` 字段、诊断面板/上报** — 需要时再扩契约；本阶段只交付最小形状。
- **`EDITOR_CORE_API_VERSION` 冻结与弃用策略落地** — Phase 12：升到 `1.0.0` 并按 `EXT-03` 执行。
- **port 接口的完整化** — `EngineAdapter` 的完整契约（Phase 5）、`PreviewAdapter` 的启动钩子（Phase 11）、各 capability port（Phase 7–10）。
- **`@microsoft/api-extractor` 报告** — 研究稿建议早期引入、Phase 11 起在 CI 强制；本阶段不做。

None of the above is a new capability for this phase; all are explicitly out of scope or belong to later phases.

</deferred>

---

*Phase: 3-Kernel — Runtime, Ports, Registry, Diagnostics*
*Context gathered: 2026-09-22*
