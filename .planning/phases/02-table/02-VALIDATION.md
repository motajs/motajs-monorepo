---
phase: "2"
slug: "table"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-11"
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest（工作区统一，catalog）+ @testing-library/react + jsdom |
| **Config file** | `packages/libs/editor-impl/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @motajs/editor-impl test` |
| **Full suite command** | `pnpm --filter @motajs/editor-impl test && pnpm --filter @motajs/editor-impl typecheck` |
| **Estimated runtime** | ~10 seconds |

> 注意：`@motajs/editor-impl` 当前**无测试文件**（`test` 直到 Wave 0 补齐才转绿）；`@motajs/editor-core` 自身 51 用例全绿可作参照。全仓 `pnpm test` 当前为红（旧里程碑遗留）。本阶段验收基线是 `editor-impl`（+ 受其影响的 `editor-core`）。

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @motajs/editor-impl test`
- **After every plan wave:** Run `pnpm --filter @motajs/editor-impl test && pnpm --filter @motajs/editor-impl typecheck` + 仍生效门禁（`scripts/verify/coreImportType.js`、`coreEngineNeutral.js`、`coreModuleState.js`（含 editor-impl 源码）、`coreFsSurface.js`）
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

> 已知失效门禁（引用已归档里程碑路径，本阶段不必然修复，但须知悉）：`scripts/verify/coreBoundaries.js`、`coreExports.js`、`implExports.js` 当前为红。

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| *(planner 在 PLAN.md 产出后补全各行)* | | | | | | | | | |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*planner 在 PLAN.md 产出后补全剩余行。*

---

## Wave 0 Requirements

- [ ] `packages/libs/editor-impl/src/table/__tests__/` —— 表格组件/面板行为测试（TABLE-01）
- [ ] `editor-impl` vitest `setupFiles`（`Map.getOrInsertComputed` 垫片等，参照 `editor-core`）
- [ ] 满足 `editor-impl` 的 JSX/测试依赖（babel 插件等；研究 Pitfall 8）
- [ ] D-15「schema 变更 → 布局立刻重渲染」的订阅接缝与测试
- [ ] D-06「开新面板并设目标」的机制与测试
- [ ] 通用多选弹窗组件所在模块 + 基础测试（D-13/D-14）
- [ ] 接口定义计划（面板类型/`ITablePanel.setTable` 等）先于实现

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 表格画面/交互与现状一致（行内编辑、折叠、输入控件、外部编辑器） | TABLE-01 | 目视/交互验收需真实宿主；`editor-impl` 无独立运行壳 | 以组件测试 + 后续 `@motajs/editor` 接入阶段的手动验收为准 |
| 代码/事件「单独面板」与弹窗、schema 呈现模式 | TABLE-01 / D-10…D-14 | 需要真实外壳（标签页）与弹窗挂载 | 同上 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
