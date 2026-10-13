---
phase: "2"
slug: "table"
status: approved
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-11"
revised: "2026-10-12"
signed_off: "2026-10-13"
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
>
> ⚠ 方向已于 2026-10-12 修订（`02-CONTEXT.md` §H）：schema 改用**标准 JSON Schema**；D-15 由「跨面板实时广播」
> 改为 **「切入时刷新」**（`onSwitchIn` / `onSwitchOut`，`02-CONTEXT` D-31）。本文件按新模型更新。
> `02-RESEARCH.md` / `02-PATTERNS.md` / `02-UI-SPEC.md` 属旧模型、已过期（stale），待刷新，不作为本文件依据。

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest（工作区统一，catalog）+ @testing-library/react + jsdom |
| **Config file** | `packages/libs/editor-impl/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @motajs/editor-impl test` |
| **Full suite command** | `pnpm --filter @motajs/editor-impl test && pnpm --filter @motajs/editor-impl typecheck` |
| **Estimated runtime** | ~10 seconds |

> 注意：`@motajs/editor-impl` 在 Wave 0（02-04）之前**无测试文件**；`@motajs/editor-core` 自身用例全绿可作参照。
> 全仓 `pnpm test` 当前为红（旧里程碑遗留）。本阶段验收基线是 `editor-impl`（+ 受其影响的 `editor-core`）。

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @motajs/editor-impl test`
- **After every plan wave:** Run `pnpm --filter @motajs/editor-impl test && pnpm --filter @motajs/editor-impl typecheck` + 生效门禁（`scripts/verify/coreImportType.js`、`coreEngineNeutral.js`、`coreModuleState.js`、`coreFsSurface.js`；**必须顺序执行**——脚本会在 `editor-core/src` 下写 / 删探针并全量 lint，并行会竞态）
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

> 失效门禁（引用已归档里程碑路径，本阶段不必然修复，但须知悉）：`scripts/verify/coreBoundaries.js`（本次实为绿）、`coreExports.js`、`implExports.js`（后两者为红）；02-10 已运行并记录真实退出码（见下方 Gate Run Record），不作为阶段门禁。

---

## Per-Task Verification Map

> 每个 `<task>` 的 `<verify><automated>` 都写在此处；`Status` 已由 02-10 Task 2 用真实退出码刷新为 ✅ / ❌。
> 02-04 / 02-06 / 02-07 的行已按新模型（标准 JSON Schema）由 02-10 Task 2 补入。

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-04-1 | 02-04 | 2 | TABLE-01 | — | 工程脚手与 Wave-0 测试基线就位 | typecheck | `pnpm --filter @motajs/editor-impl typecheck` | ✅ | ✅ green |
| 02-04-2 | 02-04 | 2 | TABLE-01 | T-02-11 / T-02-12 / T-02-13 | 注册 → 打开 → 设目标 → 读取 → 渲染 单路径端到端；文本经 React 文本节点、绝不对 schema 求值、错误态固定文案 | typecheck | `pnpm --filter @motajs/editor-impl typecheck` | ✅ | ✅ green |
| 02-04-3 | 02-04 | 2 | TABLE-01 | T-02-11 | 四栏网格 / 分组 / 空态 / 错误态 / 未设目标态 + 危险值字面渲染 | component | `pnpm --filter @motajs/editor-impl test -- __tests__/tracer.test.tsx` | ✅ | ✅ green |
| 02-06-1 | 02-06 | 3 | TABLE-01 | T-02-14 / T-02-27 | ajv 声明式校验、绝不对 schema 求值；无新增依赖 | unit | `pnpm --filter @motajs/editor-impl test -- __tests__/validation.test.ts` | ✅ | ✅ green |
| 02-06-2 | 02-06 | 3 | TABLE-01 | T-02-15 | 控件种类由标准关键字推导、`x-control` 兜底 | typecheck | `pnpm --filter @motajs/editor-impl typecheck` | ✅ | ✅ green |
| 02-06-3 | 02-06 | 3 | TABLE-01 | T-02-16 | 五种行内输入控件行为、值以文本渲染 | component | `pnpm --filter @motajs/editor-impl test -- __tests__/inputs.test.tsx` | ✅ | ✅ green |
| 02-07-1 | 02-07 | 4 | TABLE-01 | T-02-19 | 可编辑叶子行与值单元格控件映射 | typecheck | `pnpm --filter @motajs/editor-impl typecheck` | ✅ | ✅ green |
| 02-07-2 | 02-07 | 4 | TABLE-01 | T-02-17 / T-02-18 | 编辑模式 / 增删 / 统一撤销路径；写失败不记撤销 | typecheck | `pnpm --filter @motajs/editor-impl typecheck` | ✅ | ✅ green |
| 02-07-3 | 02-07 | 4 | TABLE-01 | T-02-17 / T-02-18 | 编辑 / 增删 / 撤销重做、原型污染键拒绝 | component | `pnpm --filter @motajs/editor-impl test -- __tests__/edit.test.tsx __tests__/undo.test.ts` | ✅ | ✅ green |
| 02-08-1 | 02-08 | 5 | TABLE-01 | T-02-22 | schema 呈现规则内建、文本经 React 文本节点 | typecheck / unit | `pnpm --filter @motajs/editor-impl typecheck` | ✅ | ✅ green |
| 02-08-2 | 02-08 | 5 | TABLE-01 | T-02-20 / T-02-23 | 切入刷新幂等；代码编辑器返回经校验写回 | typecheck | `pnpm --filter @motajs/editor-impl typecheck` | ✅ | ✅ green |
| 02-08-3 | 02-08 | 5 | TABLE-01 | T-02-20 | 切入重新请求资源并重算 | component | `pnpm --filter @motajs/editor-impl test -- __tests__/schemaMode.test.tsx __tests__/switchRefresh.test.tsx` | ✅ | ✅ green |
| 02-09-1 | 02-09 | 6 | TABLE-01 | T-02-25 | 弹窗候选项作文本 / `<img src>` 渲染 | typecheck | `pnpm --filter @motajs/editor-impl typecheck` | ✅ | ✅ green |
| 02-09-2 | 02-09 | 6 | TABLE-01 | T-02-24 / T-02-26 | 返回值经校验提交；复制经注入能力 | typecheck | `pnpm --filter @motajs/editor-impl typecheck` | ✅ | ✅ green |
| 02-09-3 | 02-09 | 6 | TABLE-01 | T-02-24 | 分发按 `x-editor` 路由、结果可撤销 | component | `pnpm --filter @motajs/editor-impl test -- __tests__/externalEditor.test.tsx __tests__/modals.test.tsx` | ✅ | ✅ green |
| 02-10-1 | 02-10 | 7 | TABLE-01 | T-02-29 | 完整流程 + 脚本样字段名 / 注释 / 值以字面渲染（XSS 回归守卫） | integration | `pnpm --filter @motajs/editor-impl test -- __tests__/integration.test.tsx` | ✅ | ✅ green |
| 02-10-2 | 02-10 | 7 | TABLE-01 | T-02-28 | 生效门禁真实运行并记录退出码 | gate | `pnpm --filter @motajs/editor-impl test && ... && node scripts/verify/coreFsSurface.js` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*02-10 Task 2 已用真实命令与退出码把上表填齐（含补入 02-04/02-06/02-07 的行）；全部生效检查为绿色。*

---

## Gate Run Record (02-10 Task 2)

按顺序**串行**执行（脚本会在 `editor-core/src` 下写 / 删探针并全量 lint，并行会竞态）。下面每个命令均真实运行、记录退出码。

| # | 命令 | 类型 | 退出码 | 结论 |
|---|------|------|--------|------|
| 1 | `pnpm --filter @motajs/editor-impl test` | 生效 | 0 | ✅ 10 个测试文件 / 82 个用例全绿 |
| 2 | `pnpm --filter @motajs/editor-impl typecheck` | 生效 | 0 | ✅ `tsc -b` 通过 |
| 3 | `pnpm --filter @motajs/editor-core test` | 生效 | 0 | ✅ 6 个测试文件 / 58 个用例全绿 |
| 4 | `pnpm --filter @motajs/editor-core typecheck` | 生效 | 0 | ✅ `tsc -b` 通过 |
| 5 | `node scripts/verify/coreImportType.js` | 生效门禁 | 0 | ✅ 真实树 + 两极性 fixture 全断言通过 |
| 6 | `node scripts/verify/coreEngineNeutral.js` | 生效门禁 | 0 | ✅ 真实树 + 两极性 fixture 全断言通过 |
| 7 | `node scripts/verify/coreModuleState.js` | 生效门禁 | 0 | ✅ 真实树 lint + PORT-02 断言通过 |
| 8 | `node scripts/verify/coreFsSurface.js` | 生效门禁 | 0 | ✅ 真实树 + 两极性探针通过 |
| 9 | `node scripts/verify/coreBoundaries.js` | 失效门禁（记录） | 0 | ⚠️ 现为**绿**（与预期「失效为红」不同；依赖边界 / PKG-03 / 两包 manifest 断言全通过） |
| 10 | `node scripts/verify/coreExports.js` | 失效门禁（记录） | 1 | ❌ 缺已归档 `02-package-boundary-build-scaffolding/subpathStatus.json`；`sideEffects` 非 `false` |
| 11 | `node scripts/verify/implExports.js` | 失效门禁（记录） | 1 | ❌ 同上 + 子路径入口文件缺失 + 多副本 `react` / `react-dom` / `antd` realpath |

> **失效门禁说明：** `coreBoundaries` / `coreExports` / `implExports` 引用已归档的 `02-package-boundary-build-scaffolding` 阶段产物（`subpathStatus.json`）与「`sideEffects === false`」约定，属本阶段外的原因；它们**不是**本阶段门禁，运行时以其真实退出码记录于此，绝不作为阶段通过条件，也绝不削弱任何一个**生效**门禁（第 1–8 行全绿）。
> 意外之处：`coreBoundaries.js` 本次实为**绿**（0），比预想的「失效为红」更好——已如实记录。

---

## Wave 0 Requirements

- [x] `packages/libs/editor-impl/src/table/__tests__/` —— 表格组件 / 面板行为测试（TABLE-01）
- [x] `editor-impl` vitest `setupFiles`（`Map.getOrInsertComputed` 垫片等，参照 `editor-core`）
- [x] 满足 `editor-impl` 的 JSX / 测试依赖（babel 插件等）
- [x] 「切入时刷新」测试：外壳调用 `onSwitchIn`，面板重新请求数据 / schema 资源并重算布局（D-15 修订版 / D-31；**取代**旧的「schema 变更 → 跨面板广播」）
- [x] 「编辑 Schema」开新面板并设目标的机制与测试（D-06 注入式打开器）
- [x] 通用多选弹窗组件所在模块 + 基础测试（D-13 / D-14）
- [x] 接口定义计划（面板类型 / `ITablePanel.setTable` / `ITablePanelOpener` / 能力包等）先于实现

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 表格画面 / 交互与现状一致（行内编辑、折叠、输入控件、外部编辑器） | TABLE-01 | 目视 / 交互验收需真实宿主；`editor-impl` 无独立运行壳 | 以组件测试 + 后续 `@motajs/editor` 接入阶段的手动验收为准 |
| 代码 / 事件「独立面板」的「切走即关」行为、弹窗挂载、schema 呈现模式 | TABLE-01 / D-10…D-14 | 需要真实外壳（标签页）与弹窗挂载 | 同上 |
| D-30「在代码编辑器中打开」的真实代码编辑器集成与写回观感 | TABLE-01 / D-30 | 真实代码编辑器能力由宿主 / 后续阶段提供 | 与上表同批宿主集成验收 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved — 2026-10-13（02-10 Task 2 逐项运行；生效检查 1–8 退出 0；失效门禁 `coreExports` / `implExports` 退出 1、`coreBoundaries` 退出 0，均已记录，不作为阶段门禁）
