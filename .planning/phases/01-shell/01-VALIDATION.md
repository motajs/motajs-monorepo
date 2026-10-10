---
phase: "1"
slug: "shell"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-09"
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0.18 + @testing-library/react 16.3.2 + jsdom 26.1.0 |
| **Config file** | `packages/libs/editor-core/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @motajs/editor-core test` |
| **Full suite command** | `pnpm --filter @motajs/editor-core test && pnpm --filter @motajs/editor-core typecheck` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @motajs/editor-core test`
- **After every plan wave:** Run `pnpm --filter @motajs/editor-core test && pnpm --filter @motajs/editor-core typecheck` + 仍生效的 core 门禁（`scripts/verify/coreModuleState.js`、`scripts/verify/coreImportType.js`、`scripts/verify/coreEngineNeutral.js`、`scripts/verify/coreBoundaries.js` 的 IO 断言部分）
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

> 注意：全仓 `pnpm test` 当前为红（旧里程碑遗留，`@motajs/editor` 有数百条 TS 错误，`@motajs/editor-impl` 只剩 `export {};`）。本阶段验收基线是 `editor-core` 自身；详见 RESEARCH.md「Assumptions Log」A1 与「Open Questions」第 1 条。

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| *(planner 在 PLAN.md 产出后补全各行)* | | | | | | | | | |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*planner 在 PLAN.md 产出后补全剩余行。*

---

## Wave 0 Requirements

- [ ] `packages/libs/editor-core/src/__tests__/`（或 shell 同目录 `__tests__/`）—— 外壳行为测试（SHELL-01：菜单行 + 标签行 + 默认空白标签、注册类型后空白标签列出该类型、点击开实例、同类型多实例互不冲突、关闭销毁并自动切换、注销不残留、空壳仍渲染）
- [ ] 面板系统测试按新契约重写（现有 `src/panel/__tests__/panelSystem.test.ts`）
- [ ] `src/__tests__/core.test.ts` 中依赖旧面板 API 的用例更新
- [ ] fs 接口定义文件 `packages/libs/editor-core/src/fs/types.ts` + 桶（CORE-01）
- [ ] 一条可失败的「不存在 fs 默认实现 / core·impl 不引用」门禁（建议 `scripts/verify/coreFsSurface.js`），采用与既有门禁相同的「真实树 + 两极性 fixture」写法

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 外壳画面可渲染、可操作（菜单行 + 标签行 + 空白标签 + `+`） | SHELL-01 | 「画面与现状一致」的最终验收需人工目视；本阶段 core 无独立运行壳，能力接入在后续阶段 | 以 core 单测 + 后续 `@motajs/editor` 接入阶段的手动验收为准 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
