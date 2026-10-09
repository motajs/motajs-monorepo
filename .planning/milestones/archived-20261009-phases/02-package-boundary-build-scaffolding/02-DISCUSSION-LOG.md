# Phase 2: Package Boundary & Build Scaffolding - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-21
**Phase:** 2-Package Boundary & Build Scaffolding
**Areas discussed:** A 包骨架与导出策略, B `@/` 解析一致性, C 样式与编译器跨包覆盖, D 强制门禁与 CI 接入形态

---

## A 包骨架与导出策略

### A1 — 7 个 subpath 的落地形态

| Option | Description | Selected |
|--------|-------------|----------|
| 7 个 subpath 全建真实 stub | 每个 subpath 建真实 `lib/<name>/index.ts` 空 barrel，`exports` 指向源码 TS | |
| 只建 `.` 与 `./react`，其余先声明 | 只建根 barrel + react，其余在 exports 里先声明指向未来路径 | |
| 全建，但集中在一个可控的骨架清单 | 探针/占位内容与纯空 barrel 分开，并用清单记录各 subpath 状态 | ✓ |

**User's choice:** 采纳方案 1 + 状态清单
**Notes:** 用户先追问「七个 subpath 指什么」，在得到来源（PKG-01/EXT-05）与用途对照后，进一步问「你认为哪个方案更合理」。助理给出推荐（方案 1：与已锁定决策一致、避免 exports 指向不存在文件、PKG-03/VERIFY-05 才能真验证、成本近零），用户确认采纳方案 1 + 状态清单。

### A2 — peerDependencies 是否只限 PKG-02 的 7 个

| Option | Description | Selected |
|--------|-------------|----------|
| 严格按 PKG-02 的 7 个 | React/ReactDOM + antd/Semi/alien-signals/immer/monaco/pixi/blockly 做 peer；其余普通 deps | ✓ |
| 7 个为下限 + 扫描扩充 | 先按 7 个落地，另加「扫描 editor 依赖是否持有模块级状态/context/registry」子任务决定扩充 | |
| 只有 React 做 peer | 仅 React/ReactDOM 做 peer，其余全 deps | |

**User's choice:** 严格按 PKG-02 的 7 个
**Notes:** 判据（库是否持有模块级全局状态或 React context/注册表）已说明，但用户选择以 roadmap 为准、不做扫描扩充。

### A3 — 探针 TSX 的位置与性质

| Option | Description | Selected |
|--------|-------------|----------|
| 单个临时探针放 `./react` | Phase 2 脚手架，Phase 4+ 替换/删除 | ✓ |
| 探针即首个真实入口 | 把 `./react` 首个真实导出组件当探针，长期保留就地扩展 | |
| 每个 subpath 各一个探针 | 7 个 subpath 各放最小 TSX，证明 glob/compiler 覆盖整棵树 | |

**User's choice:** 单个临时探针放 `./react`

### A4 — 样式策略与 sideEffects

| Option | Description | Selected |
|--------|-------------|----------|
| 只准 PandaCSS，保持 `false` | core 只用 `css()`/`styled`，不写 import-for-side-effect 样式，`sideEffects: false` | ✓ |
| 允许 CSS modules，改 sideEffects 数组 | 允许 core 用 CSS modules，`sideEffects` 列样式 glob | |
| core 不带样式，全 external | core 不引样式，样式全由 editor 负责 | |

**User's choice:** 只准 PandaCSS，保持 `false`

---

## B `@/` 解析一致性

**调研事实（供审计）：** `resolvePlugin.js` 按 importer 包位置把 `@/x` 映射到 `packages/libs/<pkg>/lib/x`；`tsconfig.lib.base.json` 用 `${configDir}/lib/*`，故 tsc 侧对 core 天然成立。但 editor 的 `vite.config.ts` 未注册 resolvePlugin，而用硬别名 `'@' → editor/src`（Vite alias 为 `enforce:'pre'`，优先于普通插件）。现状无任何 lib 使用 `@/` 导入；resolvePlugin 仅在 `service-worker/vite.config.ts:70` 注册。

### B1 — 如何让 core 的 `@/` 在 Vite 下与 tsc 一致

| Option | Description | Selected |
|--------|-------------|----------|
| editor 改用 resolvePlugin | 把 editor 的 `resolve.alias['@']` 换成 resolvePlugin（importer 相对） | ✓ |
| core 用相对路径避开别名 | core 内部全用相对路径，PKG-03 改为验证「解析一致」 | |
| resolvePlugin(enforce:pre) + 删硬别名 | 给插件加 enforce:'pre' 并删掉 editor 的 `'@'` 硬别名 | |

**User's choice:** editor 改用 resolvePlugin

### B2 — core 的 subpath 依赖方向

| Option | Description | Selected |
|--------|-------------|----------|
| 单向依赖 DAG | `.` 不依赖能力；`./react`/`./shell` 依赖 `.`；能力依赖 `.`+react/shell；能力间互不依赖 | ✓ |
| 只禁环，不限方向 | 自由依赖，仅 no-cycles 兜底 | |
| 自引用包名表达 | 用 `@motajs/editor-core/react` 表达跨 subpath 依赖 | |

**User's choice:** 单向依赖 DAG

### B3 — 用什么机制证明解析一致

| Option | Description | Selected |
|--------|-------------|----------|
| 接入 editor 真实 import，用现有门禁 | editor 声明 core 依赖并真实 import，靠 `tsc -b` + `pnpm build` 覆盖 | ✓ |
| 专用解析验证脚本 | 临时 fixture 里 import 探针并跑 vite build + tsc -b 断言 | |
| 两者都做 | 接入依赖 + 专用脚本 | |

**User's choice:** 接入 editor 真实 import，用现有门禁

### B4 — core 的 scripts 与 fan-out

| Option | Description | Selected |
|--------|-------------|----------|
| typecheck + test，不建 build | `typecheck: tsc -b` + `test: vitest run`；noEmit 纯源码库 | ✓ |
| 只有 typecheck | Phase 2 不建测试 | |
| 加 build 环节 | 额外提供 build（tsc emit/tsdown） | |

**User's choice:** typecheck + test，不建 build

---

## C 样式与编译器跨包覆盖

### C1 — core 如何引用 PandaCSS helper

| Option | Description | Selected |
|--------|-------------|----------|
| editor 单点拥有，core 引 `@styled-system` | include 扩到 core、单一 CSS 产物；core 的 paths/alias 指向 editor 的 styled-system | ✓ |
| core 自带 panda config | core 生成自己的 styled-system（两份，token 可能漂移） | |
| core 不调 helper，只导出样式 | core 只导出样式对象，由 consumer 应用 | |

**User's choice:** editor 单点拥有，core 引 `@styled-system`

### C2 — PandaCSS 断言的位置与形式

| Option | Description | Selected |
|--------|-------------|----------|
| scripts/verify 专用脚本 | 跑 panda 提取并断言输出 CSS 含稳定静态原子 class，exit code 门禁 | ✓ |
| editor vitest 测试 | 写成 editor 单测，用 panda API/生成物断言 | |
| 断言完整构建产物 | 直接断言 `vite build` 产物 CSS | |

**User's choice:** scripts/verify 专用脚本

### C3 — React Compiler 覆盖机制与验证

| Option | Description | Selected |
|--------|-------------|----------|
| 先验证默认，不覆盖再改 | 对探针跑 babel+compiler 转换并断言标记；默认覆盖则不改配置 | ✓ |
| 直接显式 include 覆盖 | 直接给 plugin-react 配 include 覆盖 core | |
| 只靠 build 成功 | 不加专用验证 | |

**User's choice:** 先验证默认，不覆盖再改

### C4 — core 的测试基础设施

| Option | Description | Selected |
|--------|-------------|----------|
| 完整 vitest 配置 + smoke 测试 | resolvePlugin + react(含 compiler) + jsdom + `@styled-system` alias；写最小 smoke | ✓ |
| Phase 2 不加 test 脚本 | 测试延后 | |
| test 加 `--passWithNoTests` | 不写测试，仅避免非零退出 | |

**User's choice:** 完整 vitest 配置 + smoke 测试

---

## D 强制门禁与 CI 接入形态

### D1 — 新门禁怎么接入 CI

| Option | Description | Selected |
|--------|-------------|----------|
| 塞进现有 4 job | dependency-cruiser→lint、PKG-04/05→build、单例断言→typecheck/build | ✓ |
| 新增 boundary job | 第 5 个 job，需更新 verifier + 仓库注册 required check | |
| 混合：边界单独 job | 脚本塞现有 job，边界单独 job | |

**User's choice:** 塞进现有 4 job

### D2 — dependency-cruiser 规则集与范围

| Option | Description | Selected |
|--------|-------------|----------|
| 只 cruise core 边界 | 仅 `packages/libs/editor-core/lib/**` + editor→core 边；禁止边按 DAG + no-cycles | ✓ |
| 全仓 cruise | 含 editor/service-worker，会立即红 | |
| 全仓扫描、只报 core 相关边 | includeOnly/doNotFollow 调节 | |

**User's choice:** 只 cruise core 边界

### D3 — 如何证明单例库只有一份

| Option | Description | Selected |
|--------|-------------|----------|
| 解析 realpath 断言脚本 | 从 editor 与 core 分别解析并断言同一 realpath + 仓库仅一份副本 | ✓ |
| resolve.dedupe + 产物断言 | Vite 去重 + build 产物断言 | |
| 推到 Phase 12 | 只做运行时 smoke | |

**User's choice:** 解析 realpath 断言脚本

### D4 — `singleton requireZero` 的语义

| Option | Description | Selected |
|--------|-------------|----------|
| 零运行时依赖 | core 的 dependencies 不含单例库 | |
| 零重复副本 | 依赖图只解析出唯一副本 | |
| 零内部直接引用 | core 源码不得直接 import 单例库 | |
| 用户澄清 | core 自身 6 个模块级 singleton 零边界外依赖者，只有 composition root 可导入 | ✓ |

**User's choice:** 用户澄清（先自行核对研究文档后作答）
**Notes:** 用户指出 `requireZero` 不是 dependency-cruiser/ESLint 选项，而是 `.planning/research/ARCHITECTURE.md:476` 的示意简写，被抄进 `ROADMAP.md:91` 与 VERIFY-05；真实含义为「core 的模块级 singleton 只允许被 composition root（`lib/kernel/core.ts`）导入，其他导入即违规」，并给出 dependency-cruiser 的两种表达方式（forbidden / required + numberOfDependentsLessThan:1）。用户授权在 `REQUIREMENTS.md` 追加澄清描述——已执行（VERIFY-05 条目下）。

### D5 — `requireZero` 规则在 Phase 2 怎么处理

| Option | Description | Selected |
|--------|-------------|----------|
| 规则同批写好并启用 | Phase 2 交付 harness + 当下可强制规则；requireZero 空集通过，Phase 3 自动生效 | ✓ |
| 延迟到 Phase 3 | 等 kernel 出现再加规则 | |

**User's choice:** 规则同批写好并启用

---

## the agent's Discretion

- 「各 subpath 内容状态」清单的具体形式
- dependency-cruiser 配置位置/命名、规则的 name/severity
- 探针的 PandaCSS 静态样式取值（要求 config 稳定、类名可断言）
- Phase 2 smoke 测试的断言粒度
- editor `vitest.config.ts` 是否同步改用 resolvePlugin（需与 vite 侧一致）

## Deferred Ideas

- `./react` subpath 的明确拆分意图 —— roadmap 未定义，需用户拍板
- 「研究示意格式 → 真实工具配置」对照文档
- `editor-core` 对外发布（PUB-01）与 styled-system 发布形态
- 全仓 dependency-cruiser / lint 债务清理
- 运行时「单 React 实例 + 信号传播 smoke」（Phase 12）
