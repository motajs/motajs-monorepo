# Phase 2: Package Boundary & Build Scaffolding - Context

**Gathered:** 2026-09-21
**Status:** Ready for planning

<domain>
## Phase Boundary

本阶段交付 **`packages/libs/editor-core` 的包骨架与机器强制的边界规则**——不迁移任何 `@motajs/editor` 生产代码。具体四件事：

1. 建立 `packages/libs/editor-core/`：用 `lib/`（非 `src/`）、`private: true`、`type: module`、`sideEffects: false`、完整 subpath exports（`.`, `./code`, `./table`, `./map`, `./asset`, `./shell`, `./react`）。
2. 依赖边界：React/ReactDOM 及 7 个单例库声明为 `peerDependencies` + `catalog:default`，并证明「exactly one copy resolves」。
3. 构建解析一致性：`tsc -b` 与 Vite 对 core 的 `@/` 导入解析一致（**验证，而非假设**）。
4. 样式与编译器跨包覆盖：PandaCSS `include` 覆盖 core 且生成 CSS 含已知 core class；React Compiler 覆盖 core TSX。

外加 **VERIFY-05 的 dependency-cruiser 门禁**（禁止边、no-cycles、singleton `requireZero`）接入 CI。

**不在本阶段范围**：迁移 `fs`/`project/resources`/`history`/四大能力/外壳/preview 的任何源码；实现 `EditorCore`/ports/registry（Phase 3）；插件加载机制；布局自定义；任何对外行为/UI/宿主协议变更。

</domain>

<decisions>
## Implementation Decisions

### A. 包骨架与导出策略
- **D-01:** 7 个 subpath **全部建真实 stub 文件**——每个 `lib/<name>/index.ts` 为空 barrel（`export {}` 占位）+ 根 `lib/index.ts`，`exports` 指向源码 TS（沿用仓内其它 libs 惯例）；另附一份「各 subpath 内容状态」清单，记录 Phase 2 结束时哪个随 path 是探针、哪些是空 barrel。理由：`exports` 指向不存在文件是长期潜伏的隐性 bug（`tsc`/Vite 只在被 import 时报错，未来 `publint`/`attw` 会标红），且 PKG-03/VERIFY-05 需要真实文件节点才能覆盖每个 subpath。
- **D-02:** `peerDependencies` **严格只列 PKG-02 点名的 7 个**：`react`/`react-dom` + `antd`、`@douyinfe/semi-ui`、`alien-signals`、`immer`、`monaco-editor`、`pixi.js`、`blockly`，全部 `catalog:default`；其余（`@tanstack/react-query`、`@ant-design/icons`、`es-toolkit`、`lucide-react`、`acorn` 等）一律普通 `dependencies`。不做「按是否持有全局状态」的扫描扩充——列表以 roadmap 为准，超出部分留待后续 phase 暴露时再处理。
- **D-03:** PKG-04/PKG-05 的探针为 **单个临时 TSX 放 `lib/react/`**，带 PandaCSS 样式；明确标注为 Phase 2 脚手架，Phase 4+ 由真实 React 层替换/删除。不采用「探针即首个真实入口」（会预先定死真实 API），也不为每个 subpath 各放探针（7 个后续都要清）。探针的文件名/符号名须先入 `INTERFACE-NAME.md` 并经用户确认（见 Project Rules）。
- **D-04:** core 的样式策略为 **只准 PandaCSS**（`css()`/`styled`），`sideEffects` 保持严格的 `false`；core 内**不写 import-for-side-effect 的 CSS/less**，全局或第三方样式由 editor 侧入口显式 import。理由：`sideEffects: false` 与 CSS modules 的 import-for-side-effect 语义冲突，下游打包器会静默丢掉样式。 — **Reversibility:** costly — 若后续要放开 CSS modules，需改 `sideEffects` 取值并重新审视 core 内全部样式写法与消费侧的样式加载顺序。

### B. `@/` 解析一致性
- **D-05:** **editor 改用 `resolvePlugin`**：把 `packages/apps/editor/vite.config.ts` 的 `resolve.alias['@']` 换成 `packages/libs/config/resolvePlugin.js`（importer 相对解析）。效果：editor 文件的 `@/x` → `editor/src/x`（结果不变），core 文件的 `@/x` → `editor-core/lib/x`。`@test`/`@styled-system` 保留为硬别名。理由：Vite 的 `resolve.alias` 是 `enforce:'pre'`，会劫持 core 的 `@/`；而 PKG-03 的字面要求是 core 使用 `@/` 导入。 — **Reversibility:** costly — 回退需恢复 editor 的 `@` 硬别名，并同步 `vitest.config.ts` / `tsconfig.app.json` 三处，重新验证 editor 全部 `@/` 解析。
- **D-06:** core 的 subpath 采用 **单向依赖 DAG**：`.（内核）` 不依赖任何能力 subpath；`./react`、`./shell` 只依赖 `.`；四大能力（`./table`/`./code`/`./asset`/`./map`）依赖 `.` + `./react`/`./shell`；**能力之间互不依赖**。跨 subpath 引用统一用包内 `@/`（不自引用包名）。此 DAG 直接成为 VERIFY-05 的禁止边规则。 — **Reversibility:** costly — 违反/修改方向需改动 import 结构与 dependency-cruiser 规则集。
- **D-07:** PKG-03 的证明方式为 **让 editor 声明 `@motajs/editor-core` 依赖并真实 import**（探针或其导出），由现有 `pnpm typecheck`(`tsc -b`) + `pnpm build` 门禁自然覆盖 core 的 `@/` 解析；**不新增专用解析验证工具**。这同时落地 PROJECT 约束「editor-core 作为共享库被 editor 依赖」。
- **D-08:** core 的 package scripts 为 **`typecheck: tsc -b` + `test: vitest run`**，**不提供 `build`**（noEmit 纯源码库，与仓内其它 libs 一致）；由 root `pnpm typecheck` / `pnpm test` fan-out 自动收编，落入 Phase 1 的四个 job。

### C. 样式与编译器跨包覆盖
- **D-09:** **editor 单点拥有 PandaCSS 配置**：`panda.config.ts` 的 `include` 扩到 `../../libs/editor-core/lib/**/*.{ts,tsx}`，CSS 单一产物仍由 editor 的 `postcss.config.cjs`（`@pandacss/dev/postcss`）产出；**core 源码 import `@styled-system/*`**，core 的 `tsconfig` `paths` 与 vitest alias 指向 editor 的 `styled-system/`（已提交入库，`tsc -b` 可解析）。core 不新建 `panda.config.ts`（避免两份 styled-system 与 token 漂移），也符合「不新增主题/token 系统」约束。 — **Reversibility:** costly — core 因此不自包含（依赖 consumer 的生成物）；若改回 core 自带 panda 或改为共享 styled-system 包，需改动 core 内全部样式 import 与两处 tsconfig/alias。
- **D-10:** PKG-04 的断言落在 **`scripts/verify/` 下的专用验证脚本**（与 Phase 1 的 `ci-workflow.js`/`prettier-setup.js` 风格一致）：跑一次 panda 提取并断言输出 CSS 含探针的 **config 稳定静态原子 class**（如 `display:'block'` → `.d_block`），exit 0/非 0。刻意避开含动态值/自定义样式的哈希 class，避免 config 变动导致断言长期假红。
- **D-11:** PKG-05 **先验证默认行为**：对探针 TSX 跑一次 babel + `babel-plugin-react-compiler` 转换，断言产物含 compiler 标记（`react/compiler-runtime` 或 memo-cache 调用），并让 editor build 端到端跑通。默认已覆盖则**不改配置**（`@vitejs/plugin-react` 默认 `exclude: /node_modules/`，pnpm 软链解析到 `packages/libs/editor-core/...` 真实路径，理论会被处理——但必须验证）；仅在默认不覆盖时才加显式 `include`。
- **D-12:** core **自带 `vitest.config.ts`**：`resolvePlugin`（`@/` importer 相对）+ `react()`（含 react-compiler，与生产一致）+ `jsdom` + `@styled-system` alias 指向 editor 的 `styled-system`；Phase 2 写**最小 smoke 测试**（断言探针可 import、`@/` 解析到 core 自身、`@styled-system` 可解析）。理由：`vitest run` 在零测试文件时非零退出会弄红 root `pnpm test`；同时该测试为 core 在 Vite/vitest 环境下的解析提供单测级证据，加固 PKG-03。

### D. 强制门禁与 CI 接入形态
- **D-13:** 新门禁**全部塞进现有 4 个 job**：dependency-cruiser → `lint` job；PKG-04/PKG-05 验证脚本 → `build` job；单例单副本断言 → `typecheck` 或 `build` job。**不新增 job**，因此仓库分支保护设置不变（Phase 1 的 4 个 required checks 保持），`scripts/verify/ci-workflow.js` 的「恰好 4 job」断言仍成立。
- **D-14:** dependency-cruiser **只 cruise `packages/libs/editor-core/lib/**`**（外加断言 editor→core 的边方向）。禁止边：① core 不得 import `@motajs/editor` / 宿主 / 引擎（含 service-worker、`packages/external/mota-js`）② 按 D-06 的 DAG：`.` 不得 import 能力 subpath、能力之间不得互相 import ③ no-cycles。**不做全仓 cruise**——会撞上 Phase 1 已记录的既有债务（双表系统共存等）以致门禁一上来就红，比没有门禁更糟。
- **D-15:** PKG-02 的「exactly one copy resolves」由 **新增 `scripts/verify/` 脚本**证明：对每个 peer 单例库，分别从 editor 与 editor-core 出发用 Node 解析，断言解析到同一 `realpath`，且仓库内实际只有一份安装副本。运行时「单 React 实例 + 信号传播 smoke」留到 Phase 12。
- **D-16:** **`requireZero` 语义更正（用户澄清）**：它不是 dependency-cruiser/ESLint 的选项，而是研究文档 `.planning/research/ARCHITECTURE.md:476` 里提议的示意简写，后被抄进 `ROADMAP.md:91` 与 VERIFY-05。真实含义 = **core 自己的 6 个模块级 singleton**（`projectData`/`projectModel`/`operationHistory`/`FileHandlerManager`/`persistenceMonitor`/`editorConfigService`）**必须有零个边界外依赖者**——只允许 composition root（`lib/kernel/core.ts`）导入它们，任何其他文件导入都算违规。目的是在第一天就把 singleton 引用面锁死在 composition root。dependency-cruiser 中表达为 `forbidden`（`from: { pathNot: '^lib/kernel/core\\.ts$' }`, `to: { path: '…singleton…' }`）或 `required`（`module: { path: '…singleton…', numberOfDependentsLessThan: 1 }`）。**注意与 PKG-02 区分**：本条约束 core 自身 singleton 的引用面，PKG-02 约束外部单例库的 peer 去重。已按用户授权把该澄清追加到 `.planning/REQUIREMENTS.md`（VERIFY-05 条目下）。 — **Reversibility:** one-way — singleton 的 per-instance 化是本期里程碑的承重约束；若允许边界外导入，同页双引擎、按测试隔离、插件作用域都无法成立。
- **D-17:** `requireZero` 规则**同批写好并启用**：Phase 2 交付 dependency-cruiser harness + 当下可强制的规则（禁止边、no-cycles、core 不得反向依赖 editor/宿主/引擎）；`requireZero` 规则同批写好启用，因当前 core 尚无 singleton 而**天然通过（空集）**，Phase 3 引入 `lib/kernel/core.ts` + 6 singleton 后**自动开始生效**。不推迟到 Phase 3，以便 VERIFY-05 在 Phase 2 就有机器证据（规则已链接并运行）。

### the agent's Discretion
- 「各 subpath 内容状态」清单的具体形式（Markdown 表 vs JSON 随 phase 目录）。
- `dependency-cruiser` 配置文件位置与命名、规则的具体 `name`/`severity`（`error`）。
- 探针的 PandaCSS 静态样式取值（只要求 config 稳定、类名可断言）。
- Phase 2 的 smoke 测试断言粒度。
- editor 的 `vitest.config.ts` 是否同步改用 `resolvePlugin`（D-05 未显式覆盖 vitest 侧；实现者需保证与 vite 侧一致）。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 项目与阶段上下文
- `.planning/PROJECT.md` — 纯重构/行为不变约束、`editor-core` 位置与「不读文件、经钩子注入」原则
- `.planning/REQUIREMENTS.md` — 本阶段覆盖 PKG-01..PKG-05、VERIFY-05（含 2026-09-21 追加的 `requireZero` 澄清注）
- `.planning/ROADMAP.md` §Phase 2 — 目标与 5 条成功标准；§Phase 3 用于理解 `lib/kernel/core.ts` 的后续形态
- `.planning/STATE.md` — 两个 MEDIUM 开放项（PandaCSS include 跨包、React Compiler 覆盖 `packages/libs/**`）与既有决策
- `.planning/research/SUMMARY.md` — `lib/` 约定、`@/` 别名 tsc↔Vite 分歧的已知风险、PandaCSS include glob
- `.planning/research/PITFALLS.md` §`@/` alias divergence — importer-relative 解析与 `lib/` 硬编码
- `.planning/research/ARCHITECTURE.md:476` — `requireZero` 的原始出处（示意格式）
- `.planning/phases/01-baseline-verification-net/01-CONTEXT.md` — Phase 1 决策（D-01..D-16），特别是 CI 四 job 与门禁语义
- `.planning/codebase/STRUCTURE.md` — 目录用途与「新增共享库」的标准形状
- `.planning/codebase/CONCERNS.md` — 既有债务（全仓 lint/cruise 会假红的依据）
- `.planning/codebase/STACK.md`、`.planning/codebase/ARCHITECTURE.md` — 依赖版本与分层

### 受影响的现有文件
- `packages/libs/config/resolvePlugin.js` — importer 相对 `@/` 解析；libs→`lib`、apps→`src`
- `packages/libs/config/tsconfig.lib.base.json` — `paths: { "@/*": ["${configDir}/lib/*"] }`（tsc 侧对 core 天然成立）
- `packages/apps/editor/vite.config.ts` — 待把 `resolve.alias['@']` 换成 `resolvePlugin`（D-05）
- `packages/apps/editor/vitest.config.ts` — 同类 alias；core 测试配置需与之一致
- `packages/apps/editor/tsconfig.app.json` — `@/*`、`@test/*`、`@styled-system/*` 三处 paths
- `packages/apps/editor/panda.config.ts` — `include` 待扩到 `../../libs/editor-core/lib/**/*.{ts,tsx}`（D-09）
- `packages/apps/editor/postcss.config.cjs` — `@pandacss/dev/postcss` 单一 CSS 产物来源
- `packages/apps/editor/package.json` — 依赖声明、`prepare: panda codegen`、四个 fan-out 脚本
- `packages/libs/react-hooks/package.json`、`packages/libs/*/package.json` — 共享库 package.json 范本（`type: module`、`exports`→源码 TS、仅有 `typecheck`/`test`）
- `.github/workflows/ci.yml` + `scripts/verify/ci-workflow.js` — 四个 job 的结构断言（D-13 不得破坏）
- `scripts/verify/` — Phase 1 的 verifier 惯例；新增 PKG-02/04/05 脚本放此

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/libs/config/resolvePlugin.js` + `tsconfig.lib.base.json`：**已能**把 `@/` 解析到任意 lib 的 `lib/`，core 无需改动这两者（只需 editor 侧改用 resolvePlugin）。
- `packages/libs/react-hooks/package.json`/`tsconfig.json`：新建共享库的现成模版（`type: module`、`exports` 指向 `./lib/index.ts`、`typecheck`/`test` 脚本、`peerDependencies` 写法）。
- `packages/apps/service-worker/vite.config.ts:70`：`resolvePlugin` 的注册范例。
- `scripts/verify/ci-workflow.js`、`prettier-setup.js`、`lint-severities.js`：新验证脚本的风格与接入方式范本。
- `packages/apps/editor/styled-system/`（已提交）：D-09 下 core 需解析的目标生成物。

### Established Patterns
- **共享库以源码 TS 直出**（`exports` 指向 `lib/index.ts`，无 build 步骤）；`noEmit` + `tsc -b` 仅做类型检查。
- **差异化的 `@/` 归属**：apps→`src`、libs→`lib`；由 `resolvePlugin` 按 importer 包位置决定。
- **PandaCSS 单点配置在 editor**，经 PostCSS 插件在应用构建期提取 CSS，`styled-system/` 已入库。
- **验证器脚本放 `scripts/verify/`**，命名 `xxx.js`，`全部断言通过` 风格输出 + exit code；CI 以非零退出作为门禁。
- **Phase 1 的四 job 结构是硬契约**：`lint`/`typecheck`/`unit`/`build`，每个 job 调一个 root fan-out 脚本。

### Integration Points
- `packages/libs/editor-core/`（新建，全 `lib/` 布局）
- `packages/apps/editor/vite.config.ts` + `vitest.config.ts`（alias → resolvePlugin）
- `packages/apps/editor/panda.config.ts`（include 扩围）
- `packages/apps/editor/package.json`（新增 `@motajs/editor-core` 依赖）
- `pnpm-workspace.yaml`（若需新增 catalog/adapter 解析相关配置）
- `.github/workflows/ci.yml`（在现有 job 内追加 node 脚本调用）
- `scripts/verify/`（新增 PKG-02/PKG-04/PKG-05 验证脚本 + dependency-cruiser 调用）
- root `package.json`（若有新依赖如 dependency-cruiser，需进 catalog / devDependencies）

</code_context>

<specifics>
## Specific Ideas

- **与既有对外契约零冲突**：本阶段不碰 Environment Protocol v1 / Runtime Protocol v4 / Editor Update Protocol v2 / Artifact Manifest schema v2。
- **`@styled-system` 的跨包耦合是自觉选择**：core 的 `tsconfig` `paths` 会指向 `../editor/styled-system/*`，属仓内 monorepo 契约；需在计划里写清这是「core 依赖 consumer 生成物」的已知代价（D-09）。
- **门禁必须只对新边界生效**：全仓 lint/cruise 在 Phase 1 已证会撞既有债务（`deferred-items.md` §5/§7/§8），这是 D-14 的直接依据。
- **PKG-04 的 class 标记必须 config 稳定**：用静态原子 class，绝不用含动态值/自定义样式的哈希 class。
- **探针是临时脚手架**：Phase 4+ 会被真实 React 层替换/删除，其命名仍须先入 `INTERFACE-NAME.md` 确认。
- **`requireZero` 的目标不是外部库**：它是 core 自身 6 个模块级 singleton 的引用面约束，Phase 2 空集通过、Phase 3 自动生效。
- **依赖版本经 catalog**：core 的 peerDependencies 用 `catalog:default`；新增工具依赖（dependency-cruiser 等）也应进 `pnpm-workspace.yaml` 的 catalog，不引入不必要的运行时依赖。

</specifics>

<deferred>
## Deferred Ideas

- **`./react` subpath 的明确拆分意图**——roadmap/REQUIREMENTS 未定义，需用户拍板（React 表面 vs 非 React 内核）；本阶段只建空 barrel，不定义其内容。
- **「研究示意格式 → 真实工具配置」对照文档**——`requireZero` 暴露了研究文档里的示意键与真实 dependency-cruiser/eslint 配置的差异；如需可后续整理，本阶段不做。
- **`editor-core` 的对外发布（PUB-01）**：`publint`/`attw`/`changesets`、`styled-system` 如何随包发布——属 v2 Requirements，本阶段只保证 `exports` 指向真实存在的文件。
- **全仓 dependency-cruiser / 全仓 lint 债务清理**——Phase 1 `deferred-items.md` 已记录，非本阶段。
- **运行时「单 React 实例 + 信号传播 smoke」**——Phase 12 的 VERIFY-08 清单项，本阶段只做静态 realpath 断言。

None of the above is a new capability for this phase; all are explicitly out of scope or belong to later phases.

</deferred>

---

*Phase: 2-Package Boundary & Build Scaffolding*
*Context gathered: 2026-09-21*
