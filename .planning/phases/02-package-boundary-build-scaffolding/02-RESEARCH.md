# Phase 2: Package Boundary & Build Scaffolding — Research

**Researched:** 2026-09-21
**Domain:** pnpm-workspace package boundary, TypeScript/Vite module-resolution parity, PandaCSS cross-package extraction, React Compiler coverage, dependency-cruiser CI gating
**Confidence:** HIGH for repo mechanics and failure modes (measured in this session); MEDIUM for the dependency-cruiser rule wiring (tool not yet installed); one **blocking conflict** found in PKG-03 (see below).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** 7 个 subpath **全部建真实 stub 文件**——每个 `lib/<name>/index.ts` 为空 barrel（`export {}` 占位）+ 根 `lib/index.ts`，`exports` 指向源码 TS（沿用仓内其它 libs 惯例）；另附一份「各 subpath 内容状态」清单，记录 Phase 2 结束时哪个随 path 是探针、哪些是空 barrel。理由：`exports` 指向不存在文件是长期潜伏的隐性 bug（`tsc`/Vite 只在被 import 时报错，未来 `publint`/`attw` 会标红），且 PKG-03/VERIFY-05 需要真实文件节点才能覆盖每个 subpath。
- **D-02:** `peerDependencies` **严格只列 PKG-02 点名的 7 个**：`react`/`react-dom` + `antd`、`@douyinfe/semi-ui`、`alien-signals`、`immer`、`monaco-editor`、`pixi.js`、`blockly`，全部 `catalog:default`；其余（`@tanstack/react-query`、`@ant-design/icons`、`es-toolkit`、`lucide-react`、`acorn` 等）一律普通 `dependencies`。不做「按是否持有全局状态」的扫描扩充——列表以 roadmap 为准，超出部分留待后续 phase 暴露时再处理。
- **D-03:** PKG-04/PKG-05 的探针为 **单个临时 TSX 放 `lib/react/`**，带 PandaCSS 样式；明确标注为 Phase 2 脚手架，Phase 4+ 由真实 React 层替换/删除。不采用「探针即首个真实入口」（会预先定死真实 API），也不为每个 subpath 各放探针（7 个后续都要清）。探针的文件名/符号名须先入 `INTERFACE-NAME.md` 并经用户确认（见 Project Rules）。
- **D-04:** core 的样式策略为 **只准 PandaCSS**（`css()`/`styled`），`sideEffects` 保持严格的 `false`；core 内**不写 import-for-side-effect 的 CSS/less**，全局或第三方样式由 editor 侧入口显式 import。理由：`sideEffects: false` 与 CSS modules 的 import-for-side-effect 语义冲突，下游打包器会静默丢掉样式。 — **Reversibility:** costly — 若后续要放开 CSS modules，需改 `sideEffects` 取值并重新审视 core 内全部样式写法与消费侧的样式加载顺序。
- **D-05:** **editor 改用 `resolvePlugin`**：把 `packages/apps/editor/vite.config.ts` 的 `resolve.alias['@']` 换成 `packages/libs/config/resolvePlugin.js`（importer 相对解析）。效果：editor 文件的 `@/x` → `editor/src/x`（结果不变），core 文件的 `@/x` → `editor-core/lib/x`。`@test`/`@styled-system` 保留为硬别名。理由：Vite 的 `resolve.alias` 是 `enforce:'pre'`，会劫持 core 的 `@/`；而 PKG-03 的字面要求是 core 使用 `@/` 导入。 — **Reversibility:** costly — 回退需恢复 editor 的 `@` 硬别名，并同步 `vitest.config.ts` / `tsconfig.app.json` 三处，重新验证 editor 全部 `@/` 解析。
- **D-06:** core 的 subpath 采用 **单向依赖 DAG**：`.（内核）` 不依赖任何能力 subpath；`./react`、`./shell` 只依赖 `.`；四大能力（`./table`/`./code`/`./asset`/`./map`）依赖 `.` + `./react`/`./shell`；**能力之间互不依赖**。跨 subpath 引用统一用包内 `@/`（不自引用包名）。此 DAG 直接成为 VERIFY-05 的禁止边规则。 — **Reversibility:** costly — 违反/修改方向需改动 import 结构与 dependency-cruiser 规则集。
- **D-07:** PKG-03 的证明方式为 **让 editor 声明 `@motajs/editor-core` 依赖并真实 import**（探针或其导出），由现有 `pnpm typecheck`(`tsc -b`) + `pnpm build` 门禁自然覆盖 core 的 `@/` 解析；**不新增专用解析验证工具**。这同时落地 PROJECT 约束「editor-core 作为共享库被 editor 依赖」。
- **D-08:** core 的 package scripts 为 **`typecheck: tsc -b` + `test: vitest run`**，**不提供 `build`**（noEmit 纯源码库，与仓内其它 libs 一致）；由 root `pnpm typecheck` / `pnpm test` fan-out 自动收编，落入 Phase 1 的四个 job。
- **D-09:** **editor 单点拥有 PandaCSS 配置**：`panda.config.ts` 的 `include` 扩到 `../../libs/editor-core/lib/**/*.{ts,tsx}`，CSS 单一产物仍由 editor 的 `postcss.config.cjs`（`@pandacss/dev/postcss`）产出；**core 源码 import `@styled-system/*`**，core 的 `tsconfig` `paths` 与 vitest alias 指向 editor 的 `styled-system/`（已提交入库，`tsc -b` 可解析）。core 不新建 `panda.config.ts`（避免两份 styled-system 与 token 漂移），也符合「不新增主题/token 系统」约束。 — **Reversibility:** costly — core 因此不自包含（依赖 consumer 的生成物）；若改回 core 自带 panda 或改为共享 styled-system 包，需改动 core 内全部样式 import 与两处 tsconfig/alias。
- **D-10:** PKG-04 的断言落在 **`scripts/verify/` 下的专用验证脚本**（与 Phase 1 的 `ci-workflow.js`/`prettier-setup.js` 风格一致）：跑一次 panda 提取并断言输出 CSS 含探针的 **config 稳定静态原子 class**（如 `display:'block'` → `.d_block`），exit 0/非 0。刻意避开含动态值/自定义样式的哈希 class，避免 config 变动导致断言长期假红。
- **D-11:** PKG-05 **先验证默认行为**：对探针 TSX 跑一次 babel + `babel-plugin-react-compiler` 转换，断言产物含 compiler 标记（`react/compiler-runtime` 或 memo-cache 调用），并让 editor build 端到端跑通。默认已覆盖则**不改配置**（`@vitejs/plugin-react` 默认 `exclude: /node_modules/`，pnpm 软链解析到 `packages/libs/editor-core/...` 真实路径，理论会被处理——但必须验证）；仅在默认不覆盖时才加显式 `include`。
- **D-12:** core **自带 `vitest.config.ts`**：`resolvePlugin`（`@/` importer 相对）+ `react()`（含 react-compiler，与生产一致）+ `jsdom` + `@styled-system` alias 指向 editor 的 `styled-system`；Phase 2 写**最小 smoke 测试**（断言探针可 import、`@/` 解析到 core 自身、`@styled-system` 可解析）。理由：`vitest run` 在零测试文件时非零退出会弄红 root `pnpm test`；同时该测试为 core 在 Vite/vitest 环境下的解析提供单测级证据，加固 PKG-03。
- **D-13:** 新门禁**全部塞进现有 4 个 job**：dependency-cruiser → `lint` job；PKG-04/PKG-05 验证脚本 → `build` job；单例单副本断言 → `typecheck` 或 `build` job。**不新增 job**，因此仓库分支保护设置不变（Phase 1 的 4 个 required checks 保持），`scripts/verify/ci-workflow.js` 的「恰好 4 job」断言仍成立。
- **D-14:** dependency-cruiser **只 cruise `packages/libs/editor-core/lib/**`**（外加断言 editor→core 的边方向）。禁止边：① core 不得 import `@motajs/editor` / 宿主 / 引擎（含 service-worker、`packages/external/mota-js`）② 按 D-06 的 DAG：`.` 不得 import 能力 subpath、能力之间不得互相 import ③ no-cycles。**不做全仓 cruise**——会撞上 Phase 1 已记录的既有债务（双表系统共存等）以致门禁一上来就红，比没有门禁更糟。
- **D-15:** PKG-02 的「exactly one copy resolves」由 **新增 `scripts/verify/` 脚本**证明：对每个 peer 单例库，分别从 editor 与 editor-core 出发用 Node 解析，断言解析到同一 `realpath`，且仓库内实际只有一份安装副本。运行时「单 React 实例 + 信号传播 smoke」留到 Phase 12。
- **D-16:** **`requireZero` 语义更正（用户澄清）**：它不是 dependency-cruiser/ESLint 的选项，而是研究文档 `.planning/research/ARCHITECTURE.md:476` 里提议的示意简写，后被抄进 `ROADMAP.md:91` 与 VERIFY-05。真实含义 = **core 自己的 6 个模块级 singleton**（`projectData`/`projectModel`/`operationHistory`/`FileHandlerManager`/`persistenceMonitor`/`editorConfigService`）**必须有零个边界外依赖者**——只允许 composition root（`lib/kernel/core.ts`）导入它们，任何其他文件导入都算违规。目的是在第一天就把 singleton 引用面锁死在 composition root。dependency-cruiser 中表达为 `forbidden`（`from: { pathNot: '^lib/kernel/core\\.ts$' }`, `to: { path: '…singleton…' }`）或 `required`（`module: { path: '…singleton…', numberOfDependentsLessThan: 1 }`）。**注意与 PKG-02 区分**：本条约束 core 自身 singleton 的引用面，PKG-02 约束外部单例库的 peer 去重。已按用户授权把该澄清追加到 `.planning/REQUIREMENTS.md`（VERIFY-05 条目下）。 — **Reversibility:** one-way — singleton 的 per-instance 化是本期里程碑的承重约束；若允许边界外导入，同页双引擎、按测试隔离、插件作用域都无法成立。
- **D-17:** **`requireZero` 规则同批写好并启用**：Phase 2 交付 dependency-cruiser harness + 当下可强制的规则（禁止边、no-cycles、core 不得反向依赖 editor/宿主/引擎）；`requireZero` 规则同批写好启用，因当前 core 尚无 singleton 而**天然通过（空集）**，Phase 3 引入 `lib/kernel/core.ts` + 6 singleton 后**自动开始生效**。不推迟到 Phase 3，以便 VERIFY-05 在 Phase 2 就有机器证据（规则已链接并运行）。

### the agent's Discretion

- 「各 subpath 内容状态」清单的具体形式（Markdown 表 vs JSON 随 phase 目录）。
- `dependency-cruiser` 配置文件位置与命名、规则的具体 `name`/`severity`（`error`）。
- 探针的 PandaCSS 静态样式取值（只要求 config 稳定、类名可断言）。
- Phase 2 的 smoke 测试断言粒度。
- editor 的 `vitest.config.ts` 是否同步改用 `resolvePlugin`（D-05 未显式覆盖 vitest 侧；实现者需保证与 vite 侧一致）。

### Deferred Ideas (OUT OF SCOPE)

- **`./react` subpath 的明确拆分意图**——roadmap/REQUIREMENTS 未定义，需用户拍板（React 表面 vs 非 React 内核）；本阶段只建空 barrel，不定义其内容。
- **「研究示意格式 → 真实工具配置」对照文档**——`requireZero` 暴露了研究文档里的示意键与真实 dependency-cruiser/eslint 配置的差异；如需可后续整理，本阶段不做。
- **`editor-core` 的对外发布（PUB-01）**：`publint`/`attw`/`changesets`、`styled-system` 如何随包发布——属 v2 Requirements，本阶段只保证 `exports` 指向真实存在的文件。
- **全仓 dependency-cruiser / 全仓 lint 债务清理**——Phase 1 `deferred-items.md` 已记录，非本阶段。
- **运行时「单 React 实例 + 信号传播 smoke」**——Phase 12 的 VERIFY-08 清单项，本阶段只做静态 realpath 断言。

None of the above is a new capability for this phase; all are explicitly out of scope or belong to later phases.
</user_constraints>

## Summary

Phase 2 is a **tooling/scaffolding phase**: it creates an empty package skeleton and makes four silent-failure classes loud. All four mechanisms are now measured in this repo, not assumed, and **one of them contradicts the locked plan as written — this is the single most important finding of this research.**

**The blocking finding (PKG-03 / D-06 / D-07).** D-07 assumes that "editor declares and imports `@motajs/editor-core`, so `pnpm typecheck` (`tsc -b`) naturally covers core's `@/` resolution". That assumption is **false**. TypeScript `paths` is a property of *one program*, not of a file: when editor's `tsc -b` descends into core's source, core's `@/x` is resolved with **editor's** mapping (`@/* → ./src/*`), not core's. Measured with a minimal replica of the exact configs: with `packages/apps/editor/src/probe.ts` absent the build fails `TS2307`; with it present the build **silently resolves core's import to the editor's file** (measured via a type mismatch). Project references cannot rescue this — `TS6310: Referenced project may not disable emit`, and core is `noEmit` (D-08). So either core must not use bare `@/` self-imports, or editor's `paths` must carry a second candidate plus a new guard invariant. Vite's side of D-05 **is** confirmed by Vite's own source (aliases run before `enforce:'pre'` plugins), so the Vite half of D-05 is correct as written.

**PKG-04 is also mis-specified in its detail.** D-10's example class `.d_block` is wrong for this config: `panda.config.ts` sets `syntax: 'template-literal'`, which disables Panda's shorthand/prefix, so `display: block` extracts to **`.display_block`** (measured with `panda cssgen`). `styled-system` is also **not committed** (it is gitignored) — but that is harmless because pnpm 12.5.1 **does** run every workspace package's `prepare` script on `pnpm install` (measured), so `panda codegen` regenerates it before any CI gate runs.

**PKG-05 is confirmed to work by default.** `@vitejs/plugin-react@5.1.2` uses `defaultIncludeRE = /\.[tj]sx?$/` / `defaultExcludeRE = /\/node_modules\//`; a real `.tsx` inside a workspace lib is transformed and the compiled output contains `react/compiler-runtime` (measured through a live Vite `transformRequest`). No config change is needed; the plan only needs the marker assertion.

**PKG-02 needs one correction.** `@douyinfe/semi-ui` is **not** a dependency of `@motajs/editor` (it resolves from `@motajs/service-worker`). The dedupe verifier must therefore not assume editor can resolve Semi.

**Primary recommendation:** plan Phase 2 as four independent, small workstreams — (1) package skeleton + exports + peers, (2) resolution parity **after an explicit user decision on the `@/` conflict**, (3) the two probe verifiers (panda class, compiler marker), (4) the dependency-cruiser harness with a **two-polarity** proof that its rules actually fire — and wire every new gate as extra steps inside the existing four CI jobs. Dependency-cruiser must be pinned (`dependency-cruiser@18.2.0` is ≥6 weeks old and avoids the registry age gate that this repo already works around with `minimumReleaseAgeExclude`).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Package skeleton, `exports` map, `private`/`type`/`sideEffects` | Build config (root/package manifests) | — | A pure metadata concern; no runtime tier owns it. |
| Peer/singleton dependency declaration (`catalog:default`) | pnpm workspace resolution | Consumer (`@motajs/editor`) provides the instances | Peer deps exist so the **consumer** supplies the single instance; the library must never install its own copy. |
| `@/` bare-specifier resolution | Build tooling (Vite plugin **and** the TS program) | — | Two different resolvers must be made to agree; this is the phase's hard part. |
| PandaCSS style extraction for core sources | **Editor app build** (single `panda.config.ts` + PostCSS) | core source (only supplies `css()` calls) | D-09: one config, one CSS artifact. Core has no panda config of its own. |
| React Compiler memoisation of core TSX | Editor app build (Vite plugin filter) | core source | The transform lives in the consumer's pipeline; core just must be *inside* the filter. |
| Dependency boundaries (forbidden edges, DAG, cycles, singleton reference surface) | Static analysis gate (dependency-cruiser in CI `lint` job) | — | Machine-enforced boundary, not a runtime concept. |
| CI gating of all of the above | GitHub Actions (the existing 4 jobs) | `scripts/verify/*.js` local verifiers | D-13 forbids new jobs; the verifiers are the evidence producers. |
| `styled-system` generation | Editor package `prepare` (runs on `pnpm install`) | — | Measured: pnpm runs workspace `prepare` on install, so all four CI jobs see generated output. |

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PKG-01 | 建立 `packages/libs/editor-core/`，使用 `lib/` 目录（非 `src/`）、`private: true`、`type: module`、`sideEffects: false`、完整 subpath exports | Exact `exports` shape derived from `packages/libs/react-hooks/package.json:6-8`; 7 subpaths enumerated; `moduleResolution: "bundler"` consumes source `.ts` with no `types` condition (existing single-subpath libs prove it). |
| PKG-02 | React/ReactDOM 及所有单例库（antd、Semi、alien-signals、immer、monaco-editor、pixi.js、blockly）声明为 `peerDependencies` + `catalog:default` | `catalog:` works in `peerDependencies` (react-hooks precedent). Exact pnpm resolution mechanism and a measured dedupe recipe (`createRequire(pkgdir/package.json).resolve(name)` + `fs.realpathSync`). **Correction: Semi does not resolve from editor.** |
| PKG-03 | core tsconfig 与 `@/` 解析策略在 `tsc -b` 与 Vite 下行为一致（有验证） | Measured: Vite side is fixable by D-05 (Vite source ordering confirms aliases beat `enforce:'pre'`); **tsc side is NOT solved by D-07 and needs a user decision**. |
| PKG-04 | PandaCSS `include` 覆盖 `../../libs/editor-core/lib/**/*.{ts,tsx}`，并断言生成 CSS 含已知 core class | Measured class name `.display_block`; exact `cssgen` command; `include` glob confirmed; `@styled-system` resolution path for core's own tsconfig; `styled-system` is regenerated by `prepare` on install. |
| PKG-05 | React Compiler 覆盖 `packages/libs/editor-core/**` 验证通过 | Measured: default filter covers linked lib source; marker string `react/compiler-runtime`; requires the probe to contain a real component (not a hook-free module). |
| VERIFY-05 | `dependency-cruiser` 规则接入 CI（禁止边、singleton 的 `requireZero`、no-cycles） | Rule syntax confirmed from the official rules reference; `numberOfDependentsLessThan` is **`forbidden`-context only** (corrects the wording in REQUIREMENTS.md's note); config/CLI shape and CI placement resolved. |
</phase_requirements>

## Project Constraints (from AGENTS.md)

Source: `E:/github/motajs-monorepo/AGENTS.md` (Project Rules section is user-mandated and not GSD-managed).

| Directive | Consequence for this phase's plan |
|-----------|-----------------------------------|
| **Per-plan briefing before execution (MANDATORY)** — report plan id + goal, content/problem, verification, then **wait for explicit approval**; `--auto` is not approval. | The phase's plans must be executed one at a time with a user checkpoint between them. The executor must not chain plans. |
| **Per-plan completion report (MANDATORY)** — report what the plan did (results / verification evidence / deviations / commits) **and** the next plan, then wait. | Each plan's SUMMARY must carry the exact verify-command outputs (exit codes, counts) the user expects to see. |
| **Important naming requires prior confirmation (MANDATORY)** — file names, interface names, method/function/type/package/exported-symbol names must be reported and confirmed before being written into code, plans, or config; report in `INTERFACE-NAME.md` under the phase dir, one section per plan, stating what each thing is **for**. | The probe file + symbol names (D-03) and every new script file name (`scripts/verify/*.js`), the dependency-cruiser config file name, and the subpath barrel names must appear in `.planning/phases/02-package-boundary-build-scaffolding/INTERFACE-NAME.md` **before** implementation. Local `const`/`let` inside function bodies are exempt. |
| **Questions are answer-only (MANDATORY)** — answer, change nothing. | Research/discussion artifacts may be produced automatically; no repo edits outside a GSD workflow. |
| **Direction is the user's call (MANDATORY)** — never decide scope, architecture direction, package structure, or roadmap changes unilaterally. | The PKG-03 `@/` conflict (below) **must be escalated as a question**, not silently resolved by the plan. |
| Tech stack: TypeScript 5.9 / React 19 / Vite 7 / pnpm workspace catalog pinned versions; **no unnecessary runtime dependencies introduced by the split**. | dependency-cruiser must be a root **devDependency** pinned through the catalog. No new runtime dependency in core beyond the 7 peers + react/react-dom. |
| Compatibility: `@motajs/editor` external behaviour, UI, host protocol must stay as-is; pure refactor. | Phase 2 touches no editor source except `vite.config.ts` / `vitest.config.ts` / `panda.config.ts` / `tsconfig.app.json` / `package.json`. |
| Architecture: `editor-core` must not import host or engine code; must not read files; engine data injected via registered hooks. | dependency-cruiser forbidden-edge rules encode the "core must not import `@motajs/editor` / service-worker / `packages/external/mota-js`" half. |
| Workspace: `editor-core` lives at `packages/libs/editor-core`, consumed as a shared lib; `@/` alias + tsconfig base follow `@motajs/config`. | Confirms `lib/` (never `src/`) and the `${configDir}`-based tsconfig base. |
| Verification: "behaviour unchanged" is judged by existing tests green + manual acceptance of key flows. | Phase 2 adds gates but must not change editor behaviour; `pnpm test` (1257 tests, exit 0) must stay green. |

## Standard Stack

No new **runtime** dependency enters the workspace. The only new package is a root devDependency (dependency-cruiser). Everything else already exists at a catalog-pinned version.

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `typescript` | `catalog:default` → `^5.9.3` (installed 5.9.3) | Core's own `tsc -b` typecheck; the resolver whose `paths` semantics cause the PKG-03 conflict | Already the repo's compiler; `${configDir}` is supported (proven in-repo) |
| `vite` | override `7.3.1` (`pnpm-workspace.yaml:13-14`) | Editor build + core's Vitest pipeline; `resolve.alias` ordering | Already pinned by override |
| `vitest` | `catalog:default` → `^4.0.16` (installed 4.0.18) | Core's smoke test (`test: vitest run`, D-08) | Same runner as every other package |
| `@vitejs/plugin-react` | `catalog:default` → `^5.1.2` (installed 5.1.2) | React Compiler transform in editor + core's vitest config | Already used by both apps |
| `babel-plugin-react-compiler` | `1.0.0` (editor devDependency; **not** in catalog) | The transform whose coverage PKG-05 proves | Already the editor's pinned compiler |
| `@pandacss/dev` | `1.8.1` (editor devDependency; **not** in catalog) | `panda codegen` / `panda cssgen` for PKG-04 | Already the repo's styling system |
| `dependency-cruiser` | **NEW**, pin `18.2.0` (published 2026-08-10) — latest is 18.4.0 (2026-09-20) | VERIFY-05 boundary gate | The only tool that expresses forbidden edges + no-cycles + dependent-count rules in one config |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@motajs/config` | `workspace:*` | Supplies `resolvePlugin` (+ its hand-written `resolvePlugin.d.ts`) and `tsconfig.lib.base.json` to core's devDependencies | Core needs it for its vitest config and tsconfig extends |
| `jsdom` | `26.1.0` (not in catalog; `react-hooks` pins the same) | `environment: 'jsdom'` for core's smoke test (D-12) | Only if the smoke test renders; a pure module-import assertion does not need it |
| `@testing-library/react` | `16.3.2` | Only if the smoke test renders the probe component | Optional — a plain `import`/`renderToString` assertion avoids it |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `dependency-cruiser` | `eslint-plugin-boundaries`, `madge`, `import/no-restricted-paths` | `madge` only does cycles; ESLint boundary plugins do not express "edge direction between subpaths" + "numberOfDependents" in one gate, and the repo's ESLint config already has 108 warnings and a root `ignores` contract — mixing a second concern into it is worse. |
| `dependency-cruiser` | A hand-written `scripts/verify/*.js` import scanner | The repo already writes such verifiers, but a scanner reimplements a resolver and reproduces the exact class of bug this phase exists to prevent (unresolved `@/` → false green). Prefer the real tool plus a two-polarity proof. |
| `panda cssgen` as the PKG-04 probe | Asserting against the editor's built `dist/assets/*.css` | The built CSS is a 6-minute `pnpm build` away and mixes many CSS sources; `cssgen` is a ~0.2 s deterministic extraction of exactly the configured `include` globs. |
| Core-local `panda.config.ts` | Editor-owned config (D-09, chosen) | Two configs = two `styled-system` trees and token drift; a second theme system is explicitly out of scope. |

**Installation:**
```bash
# root devDependency, pinned via the workspace catalog (add `dependency-cruiser: 18.2.0` to catalog first)
pnpm add -Dw dependency-cruiser@catalog:
```

**Version verification (run before finalising the plan):**
```bash
npm view dependency-cruiser version        # 18.4.0   (2026-09-20)
npm view dependency-cruiser time --json    # shows 18.3.1 (2026-09-14), 18.2.0 (2026-08-10)
```
Verified in this session. **Registry age caveat:** the repo carries a `minimumReleaseAgeExclude` list (`pnpm-workspace.yaml:76-77`, currently only `monaco-editor@0.56.0`), which is the standard pnpm 10.16+ supply-chain guard. A version published the day before planning may be rejected by `pnpm install`. Pinning **18.2.0** (≈6 weeks old) sidesteps this entirely; if a newer version is required, add it to `minimumReleaseAgeExclude` the same way `monaco-editor` is. Do not assume the threshold's value — it is not set in `.npmrc` (which contains only `ignore-workspace-root-check = true`) or in the user-level npmrc read this session.

## Package Legitimacy Audit

Ran `gsd-tools query package-legitimacy check --ecosystem npm dependency-cruiser`:

| Package | Registry | Age (latest) | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|--------------|-----------|-------------|---------|-------------|
| `dependency-cruiser` | npm | latest `18.4.0` published **2026-09-20** (1 day before research); `18.2.0` on 2026-08-10 | 2,841,146 / wk | `github.com/sverweij/dependency-cruiser` | **[SUS] — reason: `too-new`** | Kept, but **flagged**: pin `18.2.0` and confirm the install; if the pin is rejected by `minimumReleaseAge`, add an exclude entry. Planner must insert a `checkpoint:human-verify` before the install step. |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** `dependency-cruiser` — the verdict is driven solely by the *latest release date* (`too-new`), not by downloads, deprecation, missing repo, or a `postinstall` script (`signals.postinstall: null`). 2.8 M weekly downloads and a 7.2 k-star primary repo make slopsquatting implausible; the residual risk is a freshly published release, which pinning an older version removes.

| Other packages this phase touches | Provenance |
|---|---|
| `@pandacss/dev@1.8.1`, `@vitejs/plugin-react@5.1.2`, `babel-plugin-react-compiler@1.0.0` | Already installed in the workspace lockfile — no new install, no legitimacy check needed `[VERIFIED: node_modules/@pandacss/dev/package.json, node_modules/.pnpm/@vitejs+plugin-react@5.1.2*, editor node_modules resolution]` |

## Architecture Patterns

### System Architecture Diagram

The phase has no runtime data flow — its "system" is the **resolution and gating chain** that every edit in Phases 3–11 will travel through. Trace it top to bottom:

```text
                       ┌─────────────────────────────────────────────┐
   source edit  ──────▶│ packages/libs/editor-core/lib/**  (only TS) │
                       └───────────────┬─────────────────────────────┘
                                       │
        ┌──────────────────────────────┼───────────────────────────────┐
        │                              │                               │
        ▼                              ▼                               ▼
  ┌───────────┐                 ┌────────────┐                 ┌──────────────┐
  │ core      │                 │ editor     │                 │ editor Vite  │
  │ tsc -b    │                 │ tsc -b     │                 │ build / dev  │
  │ (own      │                 │ (descends  │                 │              │
  │  program) │                 │  into core)│                 │              │
  └─────┬─────┘                 └─────┬──────┘                 └──────┬───────┘
        │                             │                               │
  paths: @/* →                  paths: @/* →                   plugins, in order:
  ${configDir}/lib/*            ./src/*  ⚠ CONFLICT            1 vite:alias  ◀── wins
        │                             │                         2 enforce:'pre'
        ▼                             ▼                         3 vite:resolve
   ✅ resolves to core          ❌ resolves to editor           4 repo resolvePlugin
        │                                                          │
        │                                                          ▼
        │                                                   ✅ resolves to core
        │                                       (importer-relative, if alias removed)
        │
        └───────────────┬──────────────────────────────────────────────┐
                        ▼                                              ▼
              ┌───────────────────┐                       ┌───────────────────────┐
              │ panda postcss     │                       │ react() filter        │
              │ include globs     │                       │ include /\.[tj]sx?$/  │
              │ (editor + core)   │                       │ exclude /node_modules/│
              └─────────┬─────────┘                       └───────────┬───────────┘
                        ▼                                             ▼
             .display_block in emitted CSS              react/compiler-runtime import
                        │                                             │
                        └──────────────┬──────────────────────────────┘
                                       ▼
                         ┌─────────────────────────────┐
                         │ scripts/verify/*.js         │
                         │ + dependency-cruiser        │
                         │ (core/lib/** only)          │
                         └──────────────┬──────────────┘
                                        ▼
                     existing 4 CI jobs (lint / typecheck / unit / build)
```

The diagram's purpose is to make the **one red path** undeniable: editor's `tsc -b` resolves core's `@/x` into `packages/apps/editor/src/x` while Vite resolves the same specifier into core. Any design that leaves this asymmetry in place ships a green gate over a wrong program.

### Recommended Project Structure

```text
packages/libs/editor-core/
├── package.json              # private, type:module, sideEffects:false, 7-subpath exports, peers+deps+devDeps
├── tsconfig.json             # extends @motajs/config/tsconfig.lib.base.json; gains @styled-system/* paths
├── vitest.config.ts          # resolvePlugin + react({babel react-compiler}) + jsdom + @styled-system alias
├── lib/
│   ├── index.ts              # "." barrel — export {}
│   ├── code/index.ts         # "./code" stub barrel — export {}
│   ├── table/index.ts        # "./table" stub barrel — export {}
│   ├── map/index.ts          # "./map" stub barrel — export {}
│   ├── asset/index.ts        # "./asset" stub barrel — export {}
│   ├── shell/index.ts        # "./shell" stub barrel — export {}
│   ├── react/
│   │   ├── index.ts          # "./react" stub barrel — export {}
│   │   └── <probe>.tsx       # D-03 temporary probe: panda `css\`\`` + a real hook component
│   └── __tests__/<probe>.test.ts   # D-12 smoke test
└── (no src/, no panda.config.ts, no build script)

scripts/verify/
├── ci-workflow.js            # existing — must keep passing
├── prettier-setup.js         # existing
├── lint-severities.js        # existing
├── e2e-prerequisite.js       # existing
├── coreExports.js           # NEW  PKG-01/02: exports shape + peer/catalog declarations + realpath dedupe (D-15)
├── corePandaClass.js       # NEW  PKG-04 (D-10)
├── coreReactCompiler.js    # NEW  PKG-05 (D-11)
└── coreBoundaries.js        # NEW  VERIFY-05 harness + two-polarity proof (D-14/D-17)

.dependencyCruiser.cjs       # NEW  root config, cruises packages/libs/editor-core/lib only
```

*(`core-*` file names are proposals — per AGENTS.md they must be confirmed in `INTERFACE-NAME.md` before implementation.)*

### Pattern 1: Two mechanisms, one alias — `resolvePlugin` + tsconfig `paths` (the phase's crux)

**What:** Vite and tsc resolve bare `@/x` by different rules. Vite's rule is *importer-relative*; tsc's rule is *program-global*.
**When to use:** Every time a second package introduces its own `@/` namespace, which is exactly what Phase 2 does for the first time in this repo.
**Evidence — Vite side (correct in D-05):**

`packages/libs/config/resolvePlugin.js:10-20` (verbatim):
```js
const getAliasByPackageType = (type) => {
  switch (type) {
    case 'libs':
      return 'lib';
    case 'apps':
    case 'external':
      return 'src';
    default:
      throw new Error(`unexcepted package type ${type}`);
  }
};
```
`packages/libs/config/resolvePlugin.js:27-34` (verbatim):
```js
  resolveId(source, importer, options) {
    if (!source.startsWith('@/') || !importer) return null;
    const [packages, type, name] = path.relative(WORKSPACE_ROOT, importer).split(path.sep);
    const alias = getAliasByPackageType(type);
    const rest = source.substring(2);
    const result = path.join(WORKSPACE_ROOT, packages, type, name, alias, rest);
    return this.resolve(result, importer, options);
  },
```
`[VERIFIED: packages/libs/config/resolvePlugin.js:10-34]` — note there is **no hard-coded package list**: a brand-new `packages/libs/editor-core/**` importer yields `type === 'libs'` → `lib`, so core needs no change to this file. The constraint it *does* encode is structural: the importer must live at `packages/{libs|apps|external}/<name>/…` (segment 2 must be one of those three or it throws).

`[VERIFIED: node_modules/vite/dist/node/chunks/config.js:28395-28402, 28418]` — Vite 7.3.1's plugin array is:
```js
!isBuild ? preAliasPlugin(config$2) : null,
alias({ entries: config$2.resolve.alias, customResolver: viteAliasCustomResolver }),
...prePlugins,                                   // ← user `enforce:'pre'` plugins land here
...,
resolvePlugin({...}),                            // ← vite:resolve
...,
...normalPlugins,                                // ← the repo's resolvePlugin lands here
```
So **`resolve.alias` is evaluated before both `enforce:'pre'` user plugins and `vite:resolve`**. D-05's premise is confirmed exactly: as long as `resolve.alias['@']` exists in `packages/apps/editor/vite.config.ts` (line 32: `'@': path.resolve(__dirname, './src')`), core's `@/x` can never reach the repo's `resolvePlugin`.

**Evidence — tsc side (D-07 is wrong):** a minimal replica of the repo's exact tsconfig chain (`tsconfig.lib.base.json` with `"@/*": ["${configDir}/lib/*"]`, `tsconfig.app.base.json` with `"@/*": ["${configDir}/src/*"]`, editor-style child overriding `paths` to `["./src/*"]`, a pnpm-style relative symlink from the app into the lib) was compiled with the repo's TypeScript 5.9.3:

| Setup | Result |
|-------|--------|
| lib `lib/index.ts` does `export { PROBE_VALUE } from '@/probe'`; app has **no** `src/probe.ts` | `error TS2307: Cannot find module '@/probe'` in `packages/libs/liba/lib/index.ts` |
| app **has** `src/probe.ts` exporting a `string`; lib's `probe.ts` exports `number` | `error TS2322: Type 'string' is not assignable to type 'number'` **reported in the app's own file** → core's `@/probe` resolved to the app's file (silent wrong resolution) |
| lib compiled by its **own** `tsc -b` | exit 0 → `${configDir}` does resolve per-package |
| app `tsconfig` gains `"paths": { "@/*": ["./src/*", "../../libs/liba/lib/*"] }` and **no** collision exists | exit 0 (fallback works) |
| same two-candidate `paths` **with** a collision present | still resolves to the app's file (first candidate wins) |
| app `tsconfig` adds `"exclude": ["../../libs/liba"]` | `exclude` does **not** stop an imported file entering the program — still `TS2307` |
| app references the lib as a **project reference** with lib `composite: true, noEmit: true` | `error TS6310: Referenced project '…' may not disable emit` |

`[VERIFIED: executed in this session with E:/github/motajs-monorepo/node_modules/typescript/bin/tsc 5.9.3; replica at %TEMP%/opencode/tscpath]`

**Conclusion:** tsc's `paths` cannot be made importer-relative, `exclude` cannot mask the imported package source, and project references are closed by `noEmit`. The plan **must** choose one of the three resolutions in §Open Questions Q1 before it can satisfy PKG-03 as literally worded.

### Pattern 2: `@styled-system/*` for a source file outside the editor package

**What:** core imports `@styled-system/css`; core's `tsconfig` must map it, and the editor's existing mapping must already agree.
**When to use:** all of core's React surface (Phase 4+), seeded now by the probe.
**Example — core's `tsconfig.json` (paths are relative to the config file that declares them):**
```jsonc
{
  "extends": "@motajs/config/tsconfig.lib.base.json",
  "compilerOptions": {
    "paths": {
      "@/*": ["${configDir}/lib/*"],                       // re-declare: a child `paths` replaces the base's
      "@styled-system/*": ["../../apps/editor/styled-system/*"]
    }
  },
  "include": ["${configDir}/lib"]
}
```
The editor's program already maps `@styled-system/*` → `./styled-system/*` (`packages/apps/editor/tsconfig.app.json:12`: `"@styled-system/*": ["./styled-system/*"]`), i.e. the same directory — so under editor's `tsc -b` core's `@styled-system` import also lands correctly. This is the one place where the two programs already agree.

**Measured caveat:** `packages/apps/editor/styled-system` is **gitignored**, not committed — `git check-ignore -v packages/apps/editor/styled-system/helpers.mjs` → `packages/apps/editor/.gitignore:29:styled-system`, and `git ls-files packages/apps/editor/styled-system` → 0 files. D-09's parenthetical "（已提交入库，`tsc -b` 可解析）" is factually wrong. It is still safe, because pnpm 12.5.1 runs each workspace package's `prepare` script on `pnpm install` (measured with a throwaway workspace: `packages/a prepare$ … prepare: Done` → marker file created, even on an "Already up to date" install). Since `packages/apps/editor/package.json:7` is `"prepare": "panda codegen"`, all four CI jobs get `styled-system/` during their `pnpm install --frozen-lockfile` step. `[VERIFIED: packages/apps/editor/.gitignore:29; executed pnpm 12.5.1 workspace-install probe]`

### Pattern 3: PandaCSS extraction ownership across a package boundary

**What:** one config (editor's), one CSS artifact (editor's PostCSS pipeline), core only supplies `css()` calls.
**How the pieces line up (all verified this session):**
- `packages/apps/editor/panda.config.ts:12` — `include: ['./src/**/*.{js,jsx,ts,tsx}']`; `:7` — `syntax: 'template-literal'`; `:23` — `outdir: 'styled-system'`. `include` entries are resolved relative to the panda process cwd (the editor dir when run via `pnpm --filter @motajs/editor exec …`), so the required addition is literally `'../../libs/editor-core/lib/**/*.{ts,tsx}'`.
- The PostCSS plugin is live in the real build: the last committed build's `dist/assets/editor-h9XVKFh-.css` contains `made-with-panda` (1 hit) and `@layer` (4 hits). So widening `include` does flow into the shipped CSS.
- The generated runtime proves the class-naming function and that hashing is off — `styled-system/css/css.mjs` (verbatim):
```js
function transform(prop, value) {
  const className = `${prop}_${withoutSpace(value)}`
  return { className }
}
```
```js
  utility: {
    prefix: undefined,
    transform,
    hasShorthand: false,
    toHash: (path, hashFn) => hashFn(path.join(":")),
    resolveShorthand(prop) {
      return prop
    }
  }
```
plus `hash: false` in the same context object. `[VERIFIED: packages/apps/editor/styled-system/css/css.mjs]`
- **Measured class name:** running `panda cssgen` with a config identical to the editor's on a source containing only `` css`display: block;` `` produced exactly:
```css
@layer utilities{

  .display_block {
    display: block;
}
}
```
So PKG-04's assertion target is **`.display_block`**, *not* `.d_block` as D-10 guessed. The `syntax: 'template-literal'` setting removes Panda's shorthand/prefix (`hasShorthand: false`, `prefix: undefined`), and `hash: false` keeps the name stable/config-independent. `[VERIFIED: panda cssgen 1.8.1 executed on %TEMP%/opencode/pandaprobe]`
- **The template-literal call form is the type-correct one.** `styled-system/css/css.d.ts` declares exactly one overload (verbatim): `export declare function css(template: { raw: readonly string[] | ArrayLike<string> }): string`. An object call is a **type error** under `tsc`. `[VERIFIED: packages/apps/editor/styled-system/css/css.d.ts:2]`
- **Extraction command:** `panda cssgen` (default output `./styled-system/styles.css`, override with `-o/--outfile`). It needs no prior `codegen` — verified by running it in a directory that had no `styled-system/`.

### Pattern 4: React Compiler coverage of linked workspace source

**What:** the consumer's Vite plugin filter decides whether core's `.tsx` is compiled.
**Example — measured transform.** A live Vite `createServer({configFile:false, plugins:[react({babel:{plugins:[[absPathToCompiler]]}})]})` + `server.transformRequest('/packages/libs/react-dark-mode/lib/DarkModeButton/index.tsx')` returned code containing:
```
} from "/node_modules/.pnpm/react@19.2.3/node_modules/react/compiler-runtime.js?v=f406f9eb";
```
`has react/compiler-runtime: true`, `has _c( memo cache: true`. The plugin's own defaults, read from the installed dist, are:
```js
const defaultIncludeRE = /\.[tj]sx?$/;
const defaultExcludeRE = /\/node_modules\//;
```
`[VERIFIED: node_modules/.pnpm/@vitejs+plugin-react@5.1.2*/node_modules/@vitejs/plugin-react/dist/index.js:87-94; measured transformRequest]`

Because Vite resolves pnpm symlinks to real paths by default, core's module id is `…/packages/libs/editor-core/lib/react/<probe>.tsx` — matches `include`, does **not** match `exclude`. **No config change is required (D-11's default branch holds).** Two caveats found by measurement: (a) the compiler emits nothing for a module with no component/hook — an earlier attempt on `packages/libs/react-hooks/lib/browser/serviceWorker.test.tsx` produced no marker at all; the probe must be a real component using a hook. (b) the probe must reach the graph, which D-07 already requires (editor must import core).

### Anti-Patterns to Avoid

- **Asserting the tool's config instead of its behaviour.** `scripts/verify/ci-workflow.js`-style verifiers in this repo assert *parsed/resolved* facts, never config source text. PKG-04/PKG-05 verifiers must run the real tool and read its real output.
- **A `forbidden` rule that can never fire.** A dependency-cruiser rule whose `to.path` matches nothing passes silently. D-17 deliberately ships the singleton rule against an empty set — that is only acceptable if the verifier proves the rule *can* fire (two-polarity).
- **Full-repo cruising.** `deferred-items.md` §5–§9 record pre-existing lint/cruise debt; D-14's restriction to `packages/libs/editor-core/lib/**` is what keeps the gate meaningful instead of red-on-arrival.
- **`export *` shims in the editor during later phases** (PITFALLS.md §10) — out of scope for Phase 2, but the exports map should not be designed in a way that encourages them.
- **A top-level barrel that pulls every subpath in** (PITFALLS.md §16) — the root `lib/index.ts` must stay `export {}` until it has real content.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-subpath forbidden edges / cycles / singleton reference surface | A bespoke import-scanning script | `dependency-cruiser` (`forbidden` + `to.circular` + group matching `$1`) | A hand-rolled scanner needs its own resolver; an unresolved `@/` import yields a **false green** — the exact failure this phase exists to prevent |
| Importer-relative `@/` resolution | A second tsconfig per package or another alias map | `packages/libs/config/resolvePlugin.js` (already written, already typed via `resolvePlugin.d.ts`) | It already implements the libs→`lib` / apps→`src` rule; the phase only needs to *stop* `resolve.alias['@']` from pre-empting it |
| Extracting CSS for core's utility classes | Reading the built `dist` CSS or grepping source for class strings | `panda cssgen` (writes `styled-system/styles.css`) + assert one static atomic class | Extraction is the compiler's job; the built CSS is a 6-minute build away and mixes many sources |
| Proving React Compiler coverage | Re-implementing `/\.[tj]sx?$/` + `/\/node_modules\//` in a verifier | Run the transform with the real plugin and grep for `react/compiler-runtime` | Re-implementing the filter is a replica of the tool, not evidence about it |
| Proving one copy of React/antd/etc. | `pnpm why` text parsing | `createRequire(<pkgdir>/package.json).resolve(name)` + `fs.realpathSync` from **each** consumer dir, assert one distinct realpath | Directly measures what Node will load; `pnpm why` reflects the lockfile, not the resolved graph |
| Generating `styled-system` | A core-local `panda.config.ts` | Editor's existing `prepare: panda codegen` (runs on every `pnpm install`) | Two configs = token drift and two styled-system trees; D-09 locks a single owner |

**Key insight:** every silent-failure class in this phase (alias divergence, missing styles, skipped compiler, duplicate singleton) is invisible to a passing `tsc`/`vitest`. The only durable defence is running the *real* consumer tool and asserting its *real* output — which is why the repo's two-polarity verifier style matters more here than anywhere else.

## Runtime State Inventory

> Phase 2 is a **greenfield scaffold**, not a rename/refactor/migration: it creates a new package and adds gates. The inventory still applies because the phase introduces a new *generated artifact contract* and a new *resolved-dependency contract*. Categories are answered explicitly rather than omitted.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None.** No database, key, collection name, or user id changes. Core ships empty barrels. | None. |
| Live service config | **None.** No workflow lives outside git for this phase; `ci.yml` is the only workflow touched and it is versioned. | None. |
| OS-registered state | **None.** No task scheduler / pm2 / launchd / systemd entries reference this package. | None. |
| Secrets/env vars | **None.** No new env var; `.npmrc` gains nothing (dependency-cruiser is a normal registry dependency). | None. |
| Build artifacts | **`packages/apps/editor/styled-system/**`** (gitignored generated tree that core's `tsc -b` and core's vitest now depend on). Regenerated by editor's `prepare: panda codegen` on every `pnpm install` — verified pnpm 12.5.1 behaviour. Also editor `dist/**` (gitignored, rebuilt). | No migration. Document in the plan that core's typecheck/test now depend on editor's generated output existing (guaranteed by `prepare`), so nobody "fixes" a missing `styled-system` by adding a second panda config. |
| Resolved dependency graph | **New edges:** `@motajs/editor → @motajs/editor-core` (workspace protocol) and core → 8 peers. | No migration; but `pnpm-lock.yaml` must be regenerated (`pnpm install`, not `--frozen-lockfile`) when adding dependency-cruiser and the new workspace package, then committed, or the frozen-lockfile CI install fails. |

**Nothing found in the Stored data / Live service config / OS-registered state / Secrets categories** — verified by the phase's scope (no persistence, no external services, no registrations). Leaving them blank would have been indistinguishable from "not checked"; they were checked against the phase description and the repo's own inventory of singletons/services (`packages/apps/service-worker/src/server/project.ts` Dexie/SW state is untouched this phase).

## Common Pitfalls

### Pitfall 1: tsc silently resolves core's `@/` into the editor's tree (BLOCKING for PKG-03)

**What goes wrong:** `pnpm typecheck` passes while core's imports point at editor files, or fails with `TS2307` for `@/` paths that exist in neither tree. Both polarities were reproduced.
**Why it happens:** TypeScript `paths` belongs to the *program*, not the file. `packages/apps/editor/tsconfig.app.json:9-13` sets `baseUrl: "."` and `paths: { "@/*": ["./src/*"], … }`; editor's `tsc -b` necessarily pulls core's source into that program (imported files are never excluded — measured), so core's `@/x` is matched by editor's `@/*`.
**How to avoid:** pick a resolution from Open Questions Q1 and prove **both** polarities: `pnpm typecheck` must be green **and** a deliberately wrong core `@/` import must fail. Do not rely on a passing `tsc` alone — the silent-wrong-resolution polarity is invisible to it.
**Warning signs:** a core file importing `@/X` where `editor/src/X` also exists; `tsc` green but core's symbol types are the editor's; `TS2307` only after core's tree grows.

### Pitfall 2: `resolve.alias['@']` left behind in either editor config

**What goes wrong:** Core's `@/x` resolves to `editor/src/x` at build/dev time (Vite path), reproducing Pitfall 1 in the *other* resolver, or — worse — the two configs (`vite.config.ts` and `vitest.config.ts`) drift so dev and CI disagree.
**Why it happens:** `vite.config.ts` and `vitest.config.ts` each declare their own alias block; Vitest prefers `vitest.config.ts`, so a fix applied to only one file is invisible until the other tool runs.
**How to avoid:** D-05 covers `vite.config.ts`; the discretion item explicitly extends it to `vitest.config.ts`. Change both to the `resolvePlugin` plugin and keep only `@test` / `@styled-system` as hard aliases. Verify by running **both** `pnpm build` and `pnpm test` (editor's vitest suite is 891 tests and will exercise `@/` heavily).
**Warning signs:** `pnpm build` green, `pnpm test` failing on module resolution (or vice versa).

### Pitfall 3: `styled-system` appears missing on a fresh clone

**What goes wrong:** someone concludes core needs its own `panda.config.ts` because `packages/apps/editor/styled-system` is absent after a clone (it is gitignored).
**Why it happens:** the generated tree is not in git; only `prepare: panda codegen` creates it.
**How to avoid:** state in the plan that `pnpm install` regenerates it (measured: pnpm 12.5.1 runs workspace `prepare` on install) and that CI's four jobs each `pnpm install --frozen-lockfile` first. If a future change ever stops `prepare` running, add an explicit `pnpm --filter @motajs/editor exec panda codegen` step to the additional jobs (the `build` job already carries one as insurance).
**Warning signs:** `TS2307: Cannot find module '@styled-system/css'` in a fresh worktree; a second `panda.config.ts` appearing.

### Pitfall 4: a `css()` object call is a type error under `syntax: 'template-literal'`

**What goes wrong:** the probe writes `css({ display: 'block' })` (the form D-10's example implies) and core's `tsc -b` fails, or the extraction silently yields a different class than the verifier expects.
**Why it happens:** `styled-system/css/css.d.ts` declares only the template form.
**How to avoid:** write the probe as `` className={css`display: block;`} `` and assert `.display_block` — measured for both the template form and the object form.
**Warning signs:** a `TS2345` on the `css` call; a verifier asserting `.d_block` that never passes.

### Pitfall 5: the React Compiler probe produces no marker because there is nothing to memoise

**What goes wrong:** a hook-free or non-component probe compiles normally and contains no `react/compiler-runtime`, so the verifier cannot distinguish "not covered by the filter" from "nothing to compile".
**Why it happens:** the compiler only transforms functions it recognises as components/hooks (measured: a `.test.tsx` module produced no marker; a component module did).
**How to avoid:** the probe must be a real component that calls a hook and reads a prop; the verifier asserts the marker string `react/compiler-runtime` **and** the memo-cache call `_c(`.
**Warning signs:** the verifier passes on an empty file, or fails when the probe is refactored into a plain function.

### Pitfall 6: dependency-cruiser reports a false green because `@/` (and `@styled-system/`) do not resolve

**What goes wrong:** cruising core without tsconfig-aware resolution leaves every `@/x` as an unresolved (`unknown`/`undetermined`) dependency; edge rules that match `to.path` then never fire, and the DAG gate is dead while looking enabled.
**Why it happens:** dependency-cruiser needs `options.tsConfig` (or pre-compilation) to expand `paths`; the repo's `paths` use `${configDir}`, which is a TypeScript-compiler feature and may or may not be expanded by the resolver dependency-cruiser uses.
**How to avoid:** (a) if core's intra-package imports become relative (Q1 option A), this class disappears for DAG edges entirely — the safest outcome; otherwise set `options.tsConfig.fileName` to core's tsconfig and **prove** resolution with the two-polarity test; (b) do not add a blanket "not-to-unresolvable" rule unless `@styled-system` is explicitly excluded, because `@styled-system/*` is a consumer-generated path that will not resolve under cruise.
**Warning signs:** the cruise output lists `@/...` modules as unresolved; a hand-planted forbidden edge does not get reported.

### Pitfall 7: `numberOfDependentsLessThan` is not usable the way REQUIREMENTS.md's note describes

**What goes wrong:** the note suggests `required` + `module: { path, numberOfDependentsLessThan: 1 }`. The official reference states these dependent-count attributes "**only work within the `forbidden` context**" and are written as `from` + `module`, not as a `required` rule.
**Why it happens:** the note was derived from the same illustrative shorthand that D-16 corrects.
**How to avoid:** express the singleton rule in its direct form, which is also the only one that captures D-16's real meaning ("only `lib/kernel/core.ts` may import them"): a plain `forbidden` rule `from: { pathNot: '^lib/kernel/core\\.ts$' }, to: { path: '<the six singleton module paths>' }`. Cite the docs when recording the decision.
**Warning signs:** a `required` rule with `module:` that never reports anything; a singleton rule that passes even after a sibling file imports the composition root's data.

### Pitfall 8: `dependency-cruiser` latest release may be rejected by pnpm's release-age guard

**What goes wrong:** `pnpm install` refuses `dependency-cruiser@18.4.0` (published 2026-09-20) under a `minimumReleaseAge` policy, and the plan interprets the failure as a tooling problem.
**Why it happens:** the repo already carries `minimumReleaseAgeExclude` (`pnpm-workspace.yaml:76-77`) — evidence that a threshold is active somewhere outside `.npmrc`.
**How to avoid:** pin `18.2.0` (2026-08-10). If a newer version is needed, add it to `minimumReleaseAgeExclude` exactly like `monaco-editor@0.56.0`.
**Warning signs:** an install error naming the release age for the package; a lockfile that resolves a *different* version than the catalog pins.

### Pitfall 9: the four CI jobs must keep their exact shape while gaining steps

**What goes wrong:** someone "helpfully" adds a fifth job, renames a job, or adds `submodules: recursive` to `lint`/`typecheck` — silently voiding the branch-protection contract and failing `scripts/verify/ci-workflow.js`.
**Why it happens:** new gates feel like new jobs.
**How to avoid:** D-13 — add **steps** only. `ci-workflow.js:31` fixes `JOB_IDS = ['lint', 'typecheck', 'unit', 'build']`, `:34-39` maps each to its `pnpm …` command, and `:53` fixes `SUBMODULE_JOBS = ['unit', 'build']`; the verifier only asserts presence, so extra `- run: node scripts/verify/…` steps are safe. Re-run `node scripts/verify/ci-workflow.js` after editing.
**Warning signs:** job count ≠ 4; `run: pnpm lint` replaced instead of accompanied.

### Pitfall 10: `pnpm -r run test` goes red for a package with no tests

**What goes wrong:** core declares `test: vitest run` but ships zero test files; Vitest 4 exits non-zero on "no test files found", turning the `unit` job red.
**Why it happens:** the fan-out runs the script in every package that declares it.
**How to avoid:** D-12's smoke test is a **hard requirement**, not a nicety — it must exist by the time `test` is declared. The smoke test is also the resolver evidence for PKG-03.
**Warning signs:** a green core `tsc -b` but a red root `pnpm test` immediately after the package is created.

### Pitfall 11: `packages/libs/theme/pacakge.json` is misspelled — so `packages/libs/theme` is not a workspace package

**What goes wrong:** a new lib is created by copying the wrong template, or a tool assumes every directory under `packages/libs/*` is a package.
**Why it happens:** a long-standing typo (`pacakge.json`) means pnpm/`-r` never sees it.
**How to avoid:** copy `packages/libs/react-hooks/` (valid `package.json`) as the template. Do not "fix" the theme typo in this phase — it is unrelated and out of scope.
**Warning signs:** `pnpm -r run typecheck` reporting 9 packages when you expected 10 (or a new package not appearing in fan-out output).

### Pitfall 12: `@douyinfe/semi-ui` cannot be resolved from `@motajs/editor`

**What goes wrong:** the D-15 dedupe verifier reports `MODULE_NOT_FOUND` for Semi from the editor's directory and the plan either weakens the check or (worse) adds Semi to the editor "to make the check pass".
**Why it happens:** Semi is the **service-worker** UI library; the editor uses antd only. Measured: `createRequire('packages/apps/editor/package.json').resolve('@douyinfe/semi-ui')` → `MODULE_NOT_FOUND`; from `packages/apps/service-worker` it resolves to `…/.pnpm/@douyinfe+semi-ui@2.90.0_…/node_modules/@douyinfe/semi-ui/lib/cjs/index.js`.
**How to avoid:** see Open Questions Q2 — either drop Semi from the peer list (contradicts D-02's letter) or mark it `optional` in `peerDependenciesMeta` and resolve it from its real consumer (service-worker) in the dedupe verifier.
**Warning signs:** a dedupe verifier that silently skips Semi; Semi added to editor's dependencies.

### Pitfall 13: the editor build's 20 MiB artifact budget and the MPA shape

**What goes wrong:** importing the probe (and later core) into the editor can change chunking and the emitted `editor-manifest.json` file list; the artifact must stay under the 20 MiB raw budget with exactly one Monaco `ts.worker`.
**Why it happens:** Phase 2 is the first time an editor build includes a second package.
**How to avoid:** re-run the build gate and compare against `.planning/baseline/editor-manifest.json` (baseline: 57 files / 17,618,356 raw bytes = 84.01 % of 20 MiB / `exactlyOneTsWorker: true` / schema v2). A probe that is a single small component should not move these; if it does, stop and investigate rather than re-baselining.
**Warning signs:** artifact bytes jumping; a second worker file; the runtime entry gaining React/panda weight.

## Code Examples

Verified patterns from this session's measurements and the repo's own sources.

### `exports` map for seven source-TS subpaths (PKG-01)

`packages/libs/react-hooks/package.json:6-8` is the single-subpath precedent (verbatim): `"exports": { ".": "./lib/index.ts" }`. For core, extend the same shape — with `moduleResolution: "bundler"`, tsc and Vite both consume the `.ts` source directly; **no `"types"` and no `"import"` condition are needed**, and `"./package.json"` is not needed for in-workspace consumers:

```jsonc
{
  "name": "@motajs/editor-core",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": "./lib/index.ts",
    "./code": "./lib/code/index.ts",
    "./table": "./lib/table/index.ts",
    "./map": "./lib/map/index.ts",
    "./asset": "./lib/asset/index.ts",
    "./shell": "./lib/shell/index.ts",
    "./react": "./lib/react/index.ts"
  },
  "scripts": { "typecheck": "tsc -b", "test": "vitest run" }
}
```
Every target must exist (D-01's reason) — `tsc`/Vite only fail on the subpath that is actually imported.

### Peer + catalog + devDependency triple for singletons (PKG-02)

`packages/libs/react-hooks/package.json:20-33` is the pattern: `react` appears in **both** `peerDependencies` (`"catalog:default"`) and `devDependencies`, so the package is (a) deduped through the consumer and (b) locally resolvable for its own tests and for the D-15 verifier. Core needs the same for all eight singletons:

```jsonc
{
  "peerDependencies": {
    "react": "catalog:default",
    "react-dom": "catalog:default",
    "antd": "catalog:default",
    "@douyinfe/semi-ui": "catalog:default",
    "alien-signals": "catalog:default",
    "immer": "catalog:default",
    "monaco-editor": "catalog:default",
    "pixi.js": "catalog:default",
    "blockly": "catalog:default"
  },
  "devDependencies": {
    "react": "catalog:default", "react-dom": "catalog:default",
    "antd": "catalog:default", "@douyinfe/semi-ui": "catalog:default",
    "alien-signals": "catalog:default", "immer": "catalog:default",
    "monaco-editor": "catalog:default", "pixi.js": "catalog:default", "blockly": "catalog:default"
  }
}
```
Note `catalog:` entries are only added for packages the catalog already lists: `monaco-editor: 0.56.0` (`pnpm-workspace.yaml:50`), `react: ^19.2.3`, `react-dom: ^19.2.3`, `@douyinfe/semi-ui: ^2.90.0`, `es-toolkit: ^1.43.0`, `ts-pattern: ^5.9.0`, `@types/react`, etc. **`antd`, `alien-signals`, `immer`, `pixi.js`, `blockly` are NOT in the catalog** — `[VERIFIED: pnpm-workspace.yaml:16-74, full catalog block read]` — so either add catalog entries for them (the canonical approach: "依赖版本经 catalog") or pin them to the exact versions the editor already uses (`antd 6.2.1`, `alien-signals 3.1.2`, `immer 11.1.3`, `pixi.js 8.19.0`, `blockly 12.3.1`). `catalog:default` cannot be used for a package the catalog does not define.

### One-copy realpath assertion (D-15) — measured recipe

```js
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const SINGLETONS = ['react', 'react-dom', 'antd', 'alien-signals', 'immer', 'monaco-editor', 'pixi.js', 'blockly'];
const CONSUMERS = ['packages/apps/editor', 'packages/libs/editor-core'];

for (const name of SINGLETONS) {
  const realpaths = new Set();
  for (const dir of CONSUMERS) {
    const req = createRequire(path.resolve(dir, 'package.json'));
    realpaths.add(fs.realpathSync(req.resolve(name)));
  }
  if (realpaths.size !== 1) throw new Error(`${name} resolves to ${realpaths.size} copies`);
}
```
Measured on the current tree: `react` resolves from `packages/apps/editor`, `packages/libs/react-hooks` **and** `packages/libs/react-store` all to the same `…/.pnpm/react@19.2.3/node_modules/react/index.js`; same for `react-dom`. Packages not declared by a consumer correctly throw `MODULE_NOT_FOUND` (that is how the Semi gap and the need for the peer+devDependency triple were discovered). `[VERIFIED: executed in this session]`

### Vite plugin switch in the editor (D-05)

```ts
// packages/apps/editor/vite.config.ts  (and vitest.config.ts identically)
import { resolvePlugin } from '@motajs/config/resolvePlugin';

export default defineConfig({
  plugins: [
    react({ babel: { plugins: [['babel-plugin-react-compiler']] } }),
    nodePolyfills({ include: ['events'] }),
    motaServerPlugin({ motaRoot: MOTA_JS_ROOT }),
    editorArtifactPlugin(packageInfo.version),
    resolvePlugin,                       // ← importer-relative `@/`
  ],
  resolve: {
    alias: {
      // '@' intentionally removed — vite:alias would hijack core's `@/`
      '@test': path.resolve(__dirname, './test'),
      '@styled-system': path.resolve(__dirname, './styled-system'),
    },
  },
});
```
`packages/libs/config/resolvePlugin.d.ts` exists and types the import, and `packages/apps/editor/tsconfig.node.json:14` includes `vite.config.ts` — so this import typechecks. `[VERIFIED: packages/libs/config/resolvePlugin.d.ts:1-3; packages/apps/editor/tsconfig.node.json:14]`

### dependency-cruiser rules (VERIFY-05) — syntax from the official reference

```js
// .dependencyCruiser.cjs  (root; cruise target: packages/libs/editor-core/lib)
module.exports = {
  forbidden: [
    {
      name: 'core-must-not-import-consumers',
      comment: 'editor-core is the lower layer: it may never import the editor, the host or the engine.',
      severity: 'error',
      from: { path: '^packages/libs/editor-core/lib/.+' },
      to: { path: '^(packages/apps/editor|packages/apps/service-worker|packages/external/mota-js)/.+' },
    },
    {
      name: 'kernel-must-not-import-capabilities',
      severity: 'error',
      from: { path: '^packages/libs/editor-core/lib/(index\\.ts|kernel/.*)$' },
      to: { path: '^packages/libs/editor-core/lib/(code|table|map|asset)/.+' },
    },
    {
      name: 'capabilities-must-not-import-each-other',
      severity: 'error',
      from: { path: '^packages/libs/editor-core/lib/(code|table|map|asset)/.+' },
      to: {
        path: '^packages/libs/editor-core/lib/(code|table|map|asset)/.+',
        pathNot: '^packages/libs/editor-core/lib/$1/.+',   // group matching: $1 = the from-capability
      },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: { pathNot: '^node_modules' },
      to: { circular: true },
    },
    {
      name: 'core-singletons-only-imported-by-composition-root',
      comment: 'D-16 requireZero: only lib/kernel/core.ts may import the module-level singletons.',
      severity: 'error',
      from: { pathNot: '^packages/libs/editor-core/lib/kernel/core\\.ts$' },
      to: { path: '^packages/libs/editor-core/lib/(kernel|services)/(projectData|projectModel|operationHistory|FileHandlerManager|persistenceMonitor|editorConfigService)[^/]*\\.ts$' },
    },
  ],
  options: {
    doNotFollow: { path: '^node_modules' },
    tsConfig: { fileName: 'packages/libs/editor-core/tsconfig.json' }, // only needed if core keeps `@/`
  },
};
```
`[CITED: github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md]` — the reference confirms: `forbidden` rules carry `name`/`comment`/`severity`; `from.path`/`to.path` are regular expressions over project-root-relative paths with forward slashes; `'group matching'` allows `$1` in `to.path`/`to.pathNot` when `from.path` captures; `circular: true` is the no-cycles form; dependent-count attributes (`numberOfDependentsLessThan`/`MoreThan`) "**only work within the `forbidden` context**" and are written as `from` + `module` (not `required`); `severity: 'error'` is what makes the `err` reporter exit non-zero.

CLI: `pnpm exec depcruise --config .dependencyCruiser.cjs packages/libs/editor-core/lib` (plus a second invocation/rule asserting the editor→core edge direction, per D-14).

### The PKG-04 verifier's core operation (D-10)

```bash
# run from packages/apps/editor (cwd matters: include globs and the default outfile are cwd-relative)
pnpm --filter @motajs/editor exec panda cssgen -o node_modules/.tmp/core-panda.css
# then assert the extraction output contains the probe's stable atomic class
```
```js
// assert, against the extraction output — NOT the config, NOT a hash class
const css = fs.readFileSync(outfile, 'utf8');
if (!/\.display_block\s*\{\s*display:\s*block/.test(css)) fail('core class .display_block missing');
```

### The PKG-05 verifier's core operation (D-11)

```js
// A live Vite transform of the probe with the editor's exact plugin config; marker = react/compiler-runtime
const result = await server.transformRequest('/packages/libs/editor-core/lib/react/<probe>.tsx');
if (!/react\/compiler-runtime/.test(result.code)) fail('React Compiler did not transform core TSX');
if (!/_c\(/.test(result.code)) fail('no memo-cache call in the compiler output');
```
Measured output for a real lib component contained `react/compiler-runtime.js?v=…` and `_c(` — see Pattern 4.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `resolve.alias['@']` hard alias (editor only had one package's worth of `@/`) | `resolvePlugin` importer-relative resolution (D-05) | This phase — first time a linked lib uses `@/` | Requires removing the alias from **both** `vite.config.ts` and `vitest.config.ts` |
| `paths: {"@/*": ["${configDir}/src/*"]}` per app / lib | unchanged, but now known to be **program-global** | n/a — a TS semantic, surfaced this phase | Forces the Q1 decision; `exclude` and project references are not workarounds (measured) |
| `styleProps` panda shorthand classes (`d_block`) | with `syntax: 'template-literal'`, classes are spelled out (`display_block`) and unhashed | config-dependent, measured here | Verifier must assert `.display_block`; D-10's example was wrong |
| Panda extraction invisible to the app | PostCSS pipeline already injects it (verified in the last build's CSS) | already true | Widening `include` is sufficient; no new wiring |
| `test.skip(!withEditor, …)` silent skips | non-auto required fixture that throws a named error | Phase 1 | Sets the precedent for the two-polarity verifier this phase needs |
| Ad-hoc/manual boundary review | `dependency-cruiser` in CI | this phase | Rules must be proven able to fire, not merely present |

**Deprecated/outdated:**
- `required` + `module.numberOfDependentsLessThan` as the `requireZero` encoding — the dependent-count attributes live in `forbidden` rules only; use the direct `forbidden` edge rule instead.
- `.d_block` as the PandaCSS assertion target — wrong for `syntax: 'template-literal'`.
- "add a dedicated core tsconfig with explicit `paths`" as the fix for cross-package `@/` — measured not to work; the program-level mapping wins regardless of which config `paths` came from.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A `minimumReleaseAge` threshold is active in this environment (inferred only from the existence of `minimumReleaseAgeExclude`; `pnpm config get minimumReleaseAge` returned `undefined` and `.npmrc` does not set it) | Standard Stack / Pitfall 8 | If no threshold exists, pinning 18.2.0 is merely conservative — harmless. If one exists and the plan pins 18.4.0, the install fails at execution time. |
| A2 | `pnpm install --frozen-lockfile` also runs workspace `prepare` scripts (the probe used `--offline`, not `--frozen-lockfile`) | Pattern 2 / Pitfall 3 | If CI's frozen install skips `prepare`, core's `tsc -b`/vitest fail on `@styled-system`. Cheap mitigation: add an explicit `panda codegen` step to `typecheck`/`unit` as well (extra steps are allowed). |
| A3 | dependency-cruiser can expand `${configDir}` in `paths` when given core's tsconfig | Pitfall 6 | If it cannot, `@/` imports stay unresolved and DAG rules go dead — mitigated by choosing Q1 option A (relative imports), which removes the dependency on tsconfig-aware cruise entirely. |
| A4 | The 7 singletons in PKG-02's list are all genuinely singletons the editor will share; `@douyinfe/semi-ui` in particular has no editor consumer | Pitfalls / Q2 | If Semi is dropped from peers, PKG-02's literal wording changes (a roadmap-facing change the user must approve). |
| A5 | Vitest's plugin pipeline honours a Vite `resolveId` plugin (`resolvePlugin`) identically to `vite dev`/`vite build` | Pattern 1 / D-12 | If Vitest bypasses it, core's `@/` imports fail under `pnpm test`; mitigated by D-12's smoke test, which fails loudly and immediately. |
| A6 | `@douyinfe/semi-ui`'s peer status is meant for a *future* consumer rather than today's editor | Q2 | If so, declaring it `optional` is the honest encoding; if the intent was to dedupe against service-worker, the verifier should resolve from there instead. |

**If this table is non-empty:** every row above is a point the planner should surface to the user rather than silently encode. Rows A2–A4 and A6 are cheap to confirm during planning; A1 and A3 are confirmable only at execution time and should be paired with an explicit fallback in the plan.

## Open Questions

1. **How should core's intra-package imports resolve, given that tsc `paths` is program-global?** *(BLOCKING — PKG-03's literal success criterion cannot hold as written; this is a direction decision.)*
   - What we know: Vite can be fixed (D-05 confirmed). tsc cannot: `exclude` does not mask imported package source, project references are rejected by `TS6310` while core is `noEmit`, and a second candidate in editor's `paths` only works while no name collides. Measured evidence in Pattern 1.
   - Options: **(A)** core's cross-subpath imports are **relative** (`../../react/...`); D-06's DAG survives unchanged as dependency-cruiser rules over `lib/<dir>/` paths; zero silent-failure surface; PKG-03's wording becomes "core's intra-package imports resolve identically under `tsc -b` and Vite". **(B)** keep `@/` and add `"@/*": ["./src/*", "../../libs/editor-core/lib/*"]` to `packages/apps/editor/tsconfig.app.json`, plus a guard invariant enforced by a verify script ("no `@/X` used by core may exist as `editor/src/X`; every `@/X` used by editor must exist under `editor/src`"). **(C)** give core a non-colliding alias (e.g. `@core/*`) mapped unambiguously in core's tsconfig, editor's tsconfig, and Vite — preserves the "package-internal alias, not relative" spirit of D-06 but adds a second alias convention.
   - Recommendation: **A** (simplest, removes the entire silent-misresolution class, costs only cosmetic relative paths), with **C** as the fallback if the user wants to keep a package-internal alias. **B is not recommended** because during Phases 3–11 both trees coexist, so `core/lib/fs/...` and `editor/src/fs/...` colliding is the expected case, not the edge case — and the failure is silent.
   - This must be asked as a question, not decided by the plan (AGENTS.md: direction is the user's call).

2. **Should `@douyinfe/semi-ui` stay in core's peer list when no core consumer uses it?**
   - What we know: measured — editor cannot resolve it; service-worker can; the editor uses antd only; D-02 locks the list to PKG-02's seven.
   - Options: keep it and mark `peerDependenciesMeta: { '@douyinfe/semi-ui': { optional: true } }`, excluding it from the D-15 realpath assertion; keep it non-optional and assert it from service-worker (its real consumer); or drop it and note the deviation from ROADMAP PKG-02.
   - Recommendation: keep it (honours D-02) but as an **optional** peer, and have the D-15 verifier assert the eight *consumed* singletons from editor+core while asserting Semi against service-worker — documenting why.

3. **Should the `"各 subpath 内容状态"` manifest (D-01 discretion) be JSON or Markdown, and where?**
   - Recommendation: a small JSON at `.planning/phases/02-package-boundary-build-scaffolding/subpathStatus.json` (machine-checkable by the PKG-01 verifier, which can assert every `exports` target exists and is listed), plus one human sentence in the summary.

4. **Where should the dependency-cruiser config live and how should it be invoked?**
   - Recommendation: root `.dependencyCruiser.cjs` (the tool's conventional name, ESLint/Prettier-adjacent config style in this repo), invoked as `pnpm exec depcruise --config .dependencyCruiser.cjs packages/libs/editor-core/lib` from a `scripts/verify/coreBoundaries.js` wrapper (so the two-polarity proof and the editor→core edge assertion live in the repo's verifier convention).

5. **Does `pnpm test` (root, 1257 tests) still run within a sane time once core is added?**
   - What we know: core adds one Vitest project with one smoke test; the fan-out is `pnpm -r run test`. Pre-existing flake (§1/§10 of `deferred-items.md`) can make the fan-out intermittently red.
   - Recommendation: keep core's suite to a single fast test file; do not add jsdom rendering unless the assertion needs it.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | all gates | ✓ | v24.21.0 (CI pins 24) | — |
| pnpm | install/fan-out | ✓ | 12.5.1 (CI pins 12.5.1) | — |
| TypeScript | core `tsc -b`, editor `tsc -b` | ✓ | 5.9.3 | — |
| Vite | editor build/dev, core vitest | ✓ | 7.3.1 (override) | — |
| Vitest | core smoke test | ✓ | 4.0.18 | — |
| `@pandacss/dev` | PKG-04 | ✓ (editor devDep) | 1.8.1 | — |
| `babel-plugin-react-compiler` | PKG-05 | ✓ (editor devDep) | 1.0.0 | — |
| `@vitejs/plugin-react` | PKG-05 + editor build | ✓ | 5.1.2 | — |
| `dependency-cruiser` | VERIFY-05 | **✗ not installed** | — | Install as root devDependency, pinned 18.2.0 (see Pitfall 8) |
| `packages/external/mota-js` submodule | editor build + unit tests | ✓ initialized (Phase 1, SHA `3efb548e…`) | v2.10.3 | Not needed by the `lint`/`typecheck` jobs; **not** needed to cruise core or resolve singletons |
| `styled-system` generated tree | core `tsc -b` + core vitest | ✓ present locally; regenerated by editor's `prepare` on install | — | Add an explicit `panda codegen` step to `typecheck`/`unit` if `prepare` ever stops running |

**Missing dependencies with no fallback:** none — `dependency-cruiser` has a clear install path.

**Missing dependencies with fallback:** none identified beyond the `styled-system` regeneration fallback above.

## Validation Architecture

> `workflow.nyquist_validation` is not set to `false` in `.planning/config.json` (the key is absent), so this section is included.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4 (installed 4.0.18) for core's own smoke test; Playwright 1.61.1 exists but is **not** used this phase (no UI moves; e2e is not a PR gate per Phase 1 D-01) |
| Config file | `packages/libs/editor-core/vitest.config.ts` (new — D-12). Reference implementations: `packages/apps/editor/vitest.config.ts` (jsdom + setupFiles + react-compiler) and `packages/apps/service-worker/vitest.config.ts` (node + explicit `include`) |
| Quick run command | `pnpm --filter @motajs/editor-core test` |
| Full suite command | `pnpm -r run test` (root fan-out = CI `unit` job) |
| Local verifier convention | `node scripts/verify/<name>.js` — plain ESM, dependency-free where possible, Chinese file header, `failures[]` + one-line-per-failure + `process.exit(1)`, prints `…: 全部断言通过` on success (established by `scripts/verify/ci-workflow.js`, `prettier-setup.js`, `lint-severities.js`, `e2e-prerequisite.js`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| PKG-01 | `packages/libs/editor-core` exists with `lib/` layout, `private`/`type`/`sideEffects`, and all 7 `exports` targets exist on disk | structural verifier | `node scripts/verify/coreExports.js` | ❌ Wave 0 |
| PKG-02 | every singleton is a peer + catalog-declared, and resolves to exactly one realpath across consumers | structural verifier | `node scripts/verify/coreExports.js` (same script, second assertion) | ❌ Wave 0 |
| PKG-03 | core's intra-package imports resolve the same way under `tsc -b` and Vite | unit + build | `pnpm typecheck` (core's own program) **and** `pnpm build` (editor program) **and** core's smoke test asserting the probe's symbol; plus a negative polarity proving a wrong import fails | ❌ Wave 0 (smoke test) + existing gates |
| PKG-04 | PandaCSS extraction covers core and emits a known core class | extraction verifier | `node scripts/verify/corePandaClass.js` (runs `panda cssgen`, asserts `.display_block { display: block }`) | ❌ Wave 0 |
| PKG-05 | React Compiler transforms core TSX | transform verifier | `node scripts/verify/coreReactCompiler.js` (live Vite `transformRequest` on the probe, asserts `react/compiler-runtime` and `_c(`) | ❌ Wave 0 |
| VERIFY-05 | dependency-cruiser rules run in CI and fail on violation | two-polarity gate verifier | `node scripts/verify/coreBoundaries.js` (cruise the real tree → exit 0; cruise a synthetic violating fixture → non-zero, then clean up) | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** the task's own narrow command (e.g. `pnpm --filter @motajs/editor-core typecheck`; the single relevant `node scripts/verify/…` script).
- **Per wave merge:** `pnpm lint && pnpm typecheck && pnpm test` (the three fast gates), plus `node scripts/verify/ci-workflow.js` after any `ci.yml` edit.
- **Phase gate:** all four CI jobs green (`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`) **plus** `node scripts/verify/ci-workflow.js`, `node scripts/verify/coreExports.js`, `node scripts/verify/corePandaClass.js`, `node scripts/verify/coreReactCompiler.js`, `node scripts/verify/coreBoundaries.js`, `pnpm format:check`, and `git status --porcelain` clean — before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `packages/libs/editor-core/package.json`, `tsconfig.json`, `vitest.config.ts`, and the 7 stub barrels + probe (the package itself)
- [ ] `packages/libs/editor-core/lib/__tests__/<probe>.test.ts` — the mandatory smoke test (D-12; without it `pnpm -r run test` goes red — Pitfall 10)
- [ ] `scripts/verify/coreExports.js` — PKG-01 + PKG-02 + D-15 realpath dedupe
- [ ] `scripts/verify/corePandaClass.js` — PKG-04
- [ ] `scripts/verify/coreReactCompiler.js` — PKG-05
- [ ] `scripts/verify/coreBoundaries.js` (+ `.dependencyCruiser.cjs`) — VERIFY-05, with the two-polarity proof
- [ ] `.planning/phases/02-package-boundary-build-scaffolding/INTERFACE-NAME.md` — AGENTS.md requires confirmed names **before** implementation (probe file/symbols, script file names, config file name)
- [ ] Framework install: none — Vitest/Vite/Panda/Compiler are already present; only `dependency-cruiser` needs `pnpm add`

*(No gaps in the existing harness itself: `pnpm lint` = 0 errors / 108 warnings (exit 0), `pnpm typecheck` = 9 packages (exit 0), `pnpm test` = 1257 passed / 0 failed / 0 skipped (exit 0), per `01-VERIFICATION.md:156-158`.)*

## Security Domain

> `security_enforcement` is not set to `false`, so this section is included. Phase 2 is a build/boundary phase: it adds no request handling, no auth, no crypto, and no user input path. The security-relevant surface is **supply chain** and **gate integrity**.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No authentication surface is added or modified. |
| V3 Session Management | no | No session surface. |
| V4 Access Control | no | No access-control surface. |
| V5 Input Validation | no | No runtime input is parsed by this phase (only build-time config/globs). |
| V6 Cryptography | no | No cryptography. `fs.realpathSync` in the dedupe verifier is path normalisation, not crypto. |
| V14 Configuration (supply chain) | **yes** | Pin every new dependency through the workspace catalog and prefer a version past the release-age guard (`dependency-cruiser@18.2.0`); check `scripts.postinstall` (the seam reported `postinstall: null`); keep the four-job `permissions: contents: read` contract and the absence of `secrets`/`environment` in `ci.yml` (asserted by `ci-workflow.js`). |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Slopsquatted / freshly published devDependency | Tampering | Package Legitimacy Gate (run this session → `[SUS] too-new`); pin an older version; optional `checkpoint:human-verify` before install |
| Dependency install lifecycle script executing code in CI | Elevation of Privilege | Inspect `scripts.postinstall` before adopting; `pnpm-workspace.yaml` `allowBuilds` already gates native builds (`esbuild`, `sharp`, `less`, `@parcel/watcher`, `dprint`) — do not add an allowBuild for the new tool |
| A boundary gate that silently passes (rule never fires / all imports unresolved) | Repudiation / Elevation of Privilege | The **two-polarity** verifier: a synthetic violation must be reported; assert `couldNotResolve` is not masking the DAG rules |
| Weakening a gate to make it pass (e.g. adding an ignore, downgrading severity, adding `submodules: recursive` to `lint`) | Elevation of Privilege | `scripts/verify/ci-workflow.js` fixes job ids/commands/submodule placement; `lint-severities.js` already proves rule severities are not downgraded; the new verifiers must assert the *effective* config, not the config text |
| Core reading files / parsing host config (the boundary's real purpose) | Information Disclosure (future) | dependency-cruiser's forbidden-edge rule for `@motajs/editor` / service-worker / `mota-js`; Phase 3 adds the `FsPort`/`HostPort` contract |

## Sources

### Primary (HIGH confidence — read or executed in this session)

- `packages/libs/config/resolvePlugin.js` (lines 1-35, verbatim), `resolvePlugin.d.ts`, `tsconfig.lib.base.json`, `tsconfig.app.base.json`, `tsconfig.vite.json`
- `packages/apps/editor/{vite.config.ts, vitest.config.ts, tsconfig.json, tsconfig.app.json, tsconfig.node.json, panda.config.ts, postcss.config.cjs, package.json, .gitignore}`
- `packages/libs/react-hooks/{package.json, tsconfig.json}`, `packages/apps/service-worker/{vite.config.ts, vitest.config.ts, package.json}`
- `.github/workflows/ci.yml`, `.github/workflows/deploy-editor-h5test.yml`, `scripts/verify/{ci-workflow.js, prettier-setup.js, lint-severities.js}`
- `pnpm-workspace.yaml`, root `package.json`, `.npmrc`, `eslint.config.js`, `packages/apps/editor/eslint.config.js`
- `packages/apps/editor/styled-system/{css/css.d.ts, css/css.mjs, helpers.mjs}`, `packages/apps/editor/dist/assets/*.css`
- `.planning/phases/01-baseline-verification-net/01-VERIFICATION.md`, `deferred-items.md`, `.planning/research/{PITFALLS.md, SUMMARY.md}`, `02-CONTEXT.md`, `REQUIREMENTS.md`, `STATE.md`
- `node_modules/vite/dist/node/chunks/config.js:28383-28427` (plugin ordering), `node_modules/.pnpm/@vitejs+plugin-react@5.1.2*/…/dist/index.js:87-94` (default filter)
- **Executed measurements:** `tsc` 5.9.3 replica (`%TEMP%/opencode/tscpath`) × 7 configurations; `panda cssgen` 1.8.1 (`%TEMP%/opencode/pandaprobe`); live Vite `transformRequest` through `@vitejs/plugin-react` + react-compiler; `createRequire().resolve` + `realpathSync` across editor/libs; pnpm 12.5.1 workspace-`prepare` probe; `gsd-tools query package-legitimacy check`; `npm view dependency-cruiser {version,time}`

### Secondary (MEDIUM confidence)

- `github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md` — `forbidden`/`allowed`/`required` structure, `path`/`pathNot`/group matching, `circular`, `numberOfDependentsLessThan` in the `forbidden` context only, `severity: 'error'` exit-code behaviour. Read via `webfetch` this session; the tool itself is not installed, so the rules are not yet executed.

### Tertiary (LOW confidence)

- pnpm's exact `minimumReleaseAge` default value (undocumented in this environment; inferred from the presence of `minimumReleaseAgeExclude`). Treated as `[ASSUMED]` (row A1).

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — all versions read from the installed tree; the only new package's versions and dates read from the npm registry.
- Architecture / boundary mechanics: **HIGH** — every claim about the two resolvers, PandaCSS, React Compiler and pnpm `prepare` was executed, not recalled. The one low-confidence area is dependency-cruiser's tsconfig-aware resolution (A3), which is why the Q1 option-A recommendation removes the dependency on it.
- Pitfalls: **HIGH** — most rows are reproduced failure modes with commands; the CI-wiring rows are read directly from `ci.yml` + `ci-workflow.js`.
- The PKG-03 conflict: **HIGH** — measured across seven tsc configurations; this is the finding the planner must escalate.

**Research date:** 2026-09-21
**Valid until:** 2026-10-21 (30 days). Re-verify earlier if: `@vitejs/plugin-react`, `@pandacss/dev`, `vite`, `typescript`, `pnpm`, or `dependency-cruiser` change versions; the `dependency-cruiser` release-age situation changes; or the editor's `panda.config.ts` `syntax`/`hash` settings are altered (that would invalidate `.display_block`).


