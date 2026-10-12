---
phase: "2"
slug: "table"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-11"
revised: "2026-10-12"
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

> 已知失效门禁（引用已归档里程碑路径，本阶段不必然修复，但须知悉）：`scripts/verify/coreBoundaries.js`、`coreExports.js`、`implExports.js` 当前为红；02-10 会运行并记录，不作为阶段门禁。

---

## Per-Task Verification Map

> 每个 `<task>` 的 `<verify><automated>` 都写在此处；02-10 Task 2 用真实退出码把 `Status` 刷新为 ✅ / ❌。
> 02-04 / 02-06 / 02-07 由**另一并发任务**按新模型重规划，其行随该重规划补入（见下方占位）。

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-08-1 | 02-08 | 5 | TABLE-01 | T-02-22 | schema 呈现规则内建、文本经 React 文本节点 | typecheck / unit | `pnpm --filter @motajs/editor-impl typecheck` | ⬜ | ⬜ pending |
| 02-08-2 | 02-08 | 5 | TABLE-01 | T-02-20 / T-02-23 | 切入刷新幂等；代码编辑器返回经校验写回 | typecheck | `pnpm --filter @motajs/editor-impl typecheck` | ⬜ | ⬜ pending |
| 02-08-3 | 02-08 | 5 | TABLE-01 | T-02-20 | 切入重新请求资源并重算 | component | `pnpm --filter @motajs/editor-impl test -- __tests__/schemaMode.test.tsx __tests__/switchRefresh.test.tsx` | ⬜ | ⬜ pending |
| 02-09-1 | 02-09 | 6 | TABLE-01 | T-02-25 | 弹窗候选项作文本 / `<img src>` 渲染 | typecheck | `pnpm --filter @motajs/editor-impl typecheck` | ⬜ | ⬜ pending |
| 02-09-2 | 02-09 | 6 | TABLE-01 | T-02-24 / T-02-26 | 返回值经校验提交；复制经注入能力 | typecheck | `pnpm --filter @motajs/editor-impl typecheck` | ⬜ | ⬜ pending |
| 02-09-3 | 02-09 | 6 | TABLE-01 | T-02-24 | 分发按 `x-editor` 路由、结果可撤销 | component | `pnpm --filter @motajs/editor-impl test -- __tests__/externalEditor.test.tsx __tests__/modals.test.tsx` | ⬜ | ⬜ pending |
| 02-10-1 | 02-10 | 7 | TABLE-01 | T-02-29 | 脚本样文本以字面渲染（XSS 回归守卫） | integration | `pnpm --filter @motajs/editor-impl test -- __tests__/integration.test.tsx` | ⬜ | ⬜ pending |
| 02-10-2 | 02-10 | 7 | TABLE-01 | T-02-28 | 生效门禁真实运行并记录退出码 | gate | `pnpm --filter @motajs/editor-impl test && ... && node scripts/verify/coreFsSurface.js` | ⬜ | ⬜ pending |
| *(02-04 / 02-06 / 02-07)* | — | 2–4 | TABLE-01 | — | *(由该三计划的新模型重规划补入)* | — | — | ⬜ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*02-10 Task 2 执行时，用真实命令与退出码把上表填齐（含补入 02-04/02-06/02-07 的行）。*

---

## Wave 0 Requirements

- [ ] `packages/libs/editor-impl/src/table/__tests__/` —— 表格组件 / 面板行为测试（TABLE-01）
- [ ] `editor-impl` vitest `setupFiles`（`Map.getOrInsertComputed` 垫片等，参照 `editor-core`）
- [ ] 满足 `editor-impl` 的 JSX / 测试依赖（babel 插件等）
- [ ] 「切入时刷新」测试：外壳调用 `onSwitchIn`，面板重新请求数据 / schema 资源并重算布局（D-15 修订版 / D-31；**取代**旧的「schema 变更 → 跨面板广播」）
- [ ] 「编辑 Schema」开新面板并设目标的机制与测试（D-06 注入式打开器）
- [ ] 通用多选弹窗组件所在模块 + 基础测试（D-13 / D-14）
- [ ] 接口定义计划（面板类型 / `ITablePanel.setTable` / `ITablePanelOpener` / 能力包等）先于实现

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 表格画面 / 交互与现状一致（行内编辑、折叠、输入控件、外部编辑器） | TABLE-01 | 目视 / 交互验收需真实宿主；`editor-impl` 无独立运行壳 | 以组件测试 + 后续 `@motajs/editor` 接入阶段的手动验收为准 |
| 代码 / 事件「独立面板」的「切走即关」行为、弹窗挂载、schema 呈现模式 | TABLE-01 / D-10…D-14 | 需要真实外壳（标签页）与弹窗挂载 | 同上 |
| D-30「在代码编辑器中打开」的真实代码编辑器集成与写回观感 | TABLE-01 / D-30 | 真实代码编辑器能力由宿主 / 后续阶段提供 | 与上表同批宿主集成验收 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
