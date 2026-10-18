---
phase: 03-asset
status: pending
created: "2026-10-18"
---

# Phase 03 — UAT (human verification)

> Everything that can be proven without a real browser is VERIFIED (`03-VERIFICATION.md`, 12/14 must-haves).
> These items are inherently human/browser checks. Run them in the **dev host** (03-17 wired it):
> `pnpm --filter @motajs/editor-dev dev`, open the 素材管理器 panel.

## UAT-1 — 图片 → WebP（真实浏览器）

- **Requirement:** ASSET-01 / D-19
- **Why manual:** jsdom has no `OffscreenCanvas` / `createImageBitmap`; the encoder cannot be exercised in unit tests.
- **Steps:** 打开图片分类 → 选中一个 `.png` 素材 → 工具栏「瘦身转码」→ 勾「覆盖旧文件」（默认勾选）→ 二次确认 → 开始转换。
- **Expected:** 生成 `.webp`，体积下降、浏览器能正常显示；勾选时原文件被替换、列表条目改名同步；不勾时旧文件保留为 `{file}-origin.{ext}`。

## UAT-2 — 音频 → WebM/Opus（真实浏览器）

- **Requirement:** ASSET-01 / D-20
- **Why manual:** needs WebCodecs (`AudioEncoder` opus) + Mediabunny; jsdom only covers the capability-probe / failure paths.
- **Steps:** 打开音频分类 → 选中一个音频素材 → 「瘦身转码」→（可调码率/采样率）→ 开始转换。
- **Expected:** 生成 `.webm`（容器内 Opus），能在浏览器 / 播放器里正常播放；不支持 WebCodecs 的浏览器里入口**禁用并给出提示**，不静默失败。

## UAT-3 — 画面与行为与现状一致（视觉对齐）

- **Requirement:** ROADMAP SC4「素材相关画面与行为与现状一致」
- **Why manual:** inherently a human visual judgement.
- **Steps:** 对照现有 `@motajs/editor` 的素材界面，走一遍 浏览 / 上传新增 / 替换 / 删除 / 配置 / 保存 的流程。
- **Expected:** 布局、配色、文案、交互观感与现状一致（本文档与 `03-UI-SPEC.md` 所约定）。

---

**Approval:** pending
