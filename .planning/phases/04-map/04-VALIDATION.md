---
phase: "04"
slug: "map"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-20"
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `04-RESEARCH.md` §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x + jsdom 26.1.0 + `@testing-library/react` 16.3.2 |
| **Config file** | `packages/libs/editor-impl/vitest.config.ts` (`environment: 'jsdom'`, `include: ['src/**/*.test.{ts,tsx}']`, `setupFiles: ['src/__tests__/mapPolyfill.ts']`, `css: true`); `packages/apps/editor-dev/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @motajs/editor-impl exec vitest run src/map/__tests__/<file>` |
| **Full suite command** | `pnpm --filter @motajs/editor-impl test` + `pnpm --filter @motajs/editor-core test` + `pnpm --filter @motajs/editor-dev test` |
| **Typecheck** | `pnpm --filter @motajs/editor-impl typecheck` + `pnpm --filter @motajs/editor-core typecheck` + `pnpm --filter @motajs/editor-dev typecheck` |
| **Estimated runtime** | ~30–90 seconds per package suite |

---

## Sampling Rate

- **After every task commit:** Run the affected single Vitest file + that package's `typecheck`.
- **After every plan wave:** `editor-impl` full tests + `editor-core` full tests (when core changed) + `editor-dev` full tests + the four live gates (`coreEngineNeutral`, `coreModuleState`, `coreImportType`, `coreBoundaries`).
- **Before `/gsd-verify-work`:** Three packages green + four live gates green + manual dev-host acceptance list completed.
- **Max feedback latency:** ~60 seconds.

---

## Per-Task Verification Map

> Requirement→behavior map from `04-RESEARCH.md`. Concrete Task IDs / Plan / Wave are filled as each PLAN.md is authored.

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| MAP-01 | 宿主注入地图清单 + 打开 → 面板显示图层 / 图块目录 / 只读通行度 | unit + integration | `pnpm --filter @motajs/editor-impl exec vitest run src/map/__tests__/mapPanel.test.tsx` | ❌ Wave 0 | ⬜ pending |
| MAP-01 | 线 / 矩形 / 填充 / 擦除 / 切层 / 多格笔刷 → 文档即时变化，越界裁剪，图案平铺正确 | unit | `... vitest run src/map/__tests__/model.brush.test.ts` | ❌ Wave 0 | ⬜ pending |
| MAP-01 | 通行度只读：方向叠加计算正确、开关不置脏、不产生撤销、无编辑入口 | unit | `... vitest run src/map/__tests__/model.passability.test.ts` | ❌ Wave 0 | ⬜ pending |
| MAP-01 | 一笔一次撤销 / 重做；屏障（新建 / 加层 / 切图 / 放弃）挡住撤销；返回 `false` | unit + integration | `... vitest run src/map/__tests__/mapPanel.test.tsx` + `pnpm --filter @motajs/editor-core test` | ❌ Wave 0 | ⬜ pending |
| MAP-01 | 新建地图 / 新增图层：宿主回调、校验、失败保留弹窗、成功后新层成为当前层 | integration | `... vitest run src/map/__tests__/mapDialogs.test.tsx` | ❌ Wave 0 | ⬜ pending |
| MAP-01 | 地图属性抽屉：Schema → 行树、字段提交一条撤销、整表保存、无 schema 禁用 | integration | `... vitest run src/map/__tests__/mapProperties.test.tsx` | ❌ Wave 0 | ⬜ pending |
| MAP-01 | 区域复制粘贴：只当前层、左上角锚点、越界裁剪、裁剪计数、一条撤销 | unit + integration | `... vitest run src/map/__tests__/model.clipboard.test.ts` | ❌ Wave 0 | ⬜ pending |
| MAP-01 | 手动保存：分域脏标记、保存快照、失败保留脏、切换 / 新建 / 关闭拦截、放弃回基线 | integration | `... vitest run src/map/__tests__/mapSave.test.tsx` | ❌ Wave 0 | ⬜ pending |
| MAP-01 | 开发宿主端到端：注册 → 打开 → 画 / 擦 / 切层 → 加层 → 属性 → 保存 → 关闭重开仍在 | integration（jsdom，mock Pixi） | `pnpm --filter @motajs/editor-dev test` | ❌ Wave 0 | ⬜ pending |
| MAP-01 | 关闭标签前拦截（core 新钩子）：允许 / 取消 / 非活动标签激活 / dispose 不询问 | unit | `pnpm --filter @motajs/editor-core exec vitest run src/shell/__tests__/shellClose.test.ts` | ❌ Wave 0 | ⬜ pending |
| MAP-01 | 手动验收：开发宿主浏览器里完成 UI-SPEC §开发宿主接入 的清单 | manual | `pnpm --filter @motajs/editor-dev dev`（127.0.0.1:1056） | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/libs/editor-impl/src/map/__tests__/fixtures.ts` — `FakeFileSystem` 同形替身（不得 import table / asset 的）+ `createMapHarness` + 中立文档 / 图块目录 / 属性 Schema 夹具
- [ ] `packages/libs/editor-impl/src/map/__tests__/pixiMock.ts`（或 `vi.mock('./MapSurface')`）— 避免 jsdom 真正初始化 Pixi
- [ ] `URL.createObjectURL` / `revokeObjectURL` 测试桩（地图测试自己的 setup 或每个文件顶部）
- [ ] `PointerEvent` / `setPointerCapture` 守卫（生产代码用可选调用；测试可跳过）
- [ ] `ResizeObserver` 空桩已存在（`src/__tests__/mapPolyfill.ts`），地图若依赖它拿宽度，测试要给它可控宽度或默认宽布局
- [ ] `editor-core` 的关闭前钩子测试文件（若 OQ 1 通过）
- [ ] `editor-dev` 的地图演示数据 / 适配器 / 集成测试
- [x] 无新框架安装；现有 Vitest + RTL + jsdom 足够

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 真实 Pixi 画布渲染、指针手势、多格预览与大地图模式 | MAP-01 | jsdom 不能真正初始化 Pixi 与真实指针 / 尺寸；自动化只能验证纯 `renderModel` 与 mock 表面 | 开发宿主 Chromium（`pnpm --filter @motajs/editor-dev dev`，打开 `http://127.0.0.1:1056`），按 UI-SPEC §开发宿主接入 清单执行：① 打开地图（小图，能看全边界）；② 线 / 矩形 / 填充绘制、擦除、切层、新增图层；③ 多格框选 → 画布出现同尺寸矩形预览 → 落笔图案正确；④ 右键框选 → 复制 → 粘贴（含越界裁剪）→ 清空选区；⑤ 显示通行度（只读）→ 不产生撤销、不置脏；⑥ 地图属性改一个字段 → 撤销 / 重做 → 保存；⑦ 保存 → 关闭 → 重开 → 改动仍在且事件 / 额外字段仍在；⑧ 未保存时切图 / 新建 / 加层 / 关闭标签 → 三个按钮均按预期；⑨ 空态（无地图 / 加载失败 / 图块目录失败 / 未保存确认）；⑩ 大地图整图适配、无标尺、移动无效、绘制与框选仍可用 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
