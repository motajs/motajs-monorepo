---
phase: "03"
slug: "asset"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: true
created: "2026-10-17"
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `03-RESEARCH.md` §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x + jsdom 26.1.0 + `@testing-library/react` 16.3.2 |
| **Config file** | `packages/libs/editor-impl/vitest.config.ts` (`environment: 'jsdom'`, `include: ['src/**/*.test.{ts,tsx}']`, `setupFiles: ['src/__tests__/mapPolyfill.ts']`, `css: true`) |
| **Quick run command** | `pnpm --filter @motajs/editor-impl test -- src/asset` |
| **Full suite command** | `pnpm test` (root `pnpm -r run test`) |
| **Estimated runtime** | ~30–90 seconds per package suite |

---

## Sampling Rate

- **After every task commit:** Run the targeted `vitest run <changed file>` (or the asset quick command when touching `src/asset`)
- **After every plan wave:** Run `pnpm --filter @motajs/editor-impl test` (+ `@motajs/editor-core test` when touching `undo` / shared)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~60 seconds
- **Phase gate (from RESEARCH):** full `pnpm test` + `pnpm typecheck` + `pnpm lint` + live gates (`coreBoundaries`, `coreModuleState`, `coreEngineNeutral`, `coreImportType`, `editorShims`) green + manual dev-host UAT for browser-only transcode

---

## Per-Task Verification Map

> Requirement→behavior map (from `03-RESEARCH.md`). Concrete Task IDs / Plan / Wave are filled as each PLAN.md is authored.

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| ASSET-01 | List a category (list file + directory scan) renders grid populated / empty / loading / error / partial | integration (jsdom, `FakeFileSystem`) | `vitest run src/asset/__tests__/assetPanel.test.tsx` | ✅ | ✅ |
| ASSET-01 | Add (upload) a file → new byte resource + list entry appended; unsaved until 保存 | integration | `vitest run src/asset/__tests__/assetLifecycle.uat.test.tsx` | ✅ | ✅ |
| ASSET-01 | Replace bytes / delete (byte + list entry) with confirm | integration | `vitest run src/asset/__tests__/assetLifecycle.uat.test.tsx` | ✅ | ✅ |
| ASSET-01 | Save writes list with verbatim `.jsonc` prefix; reload still shows changes | unit + integration | `vitest run src/shared/jsonc/__tests__` + lifecycle | ✅ | ✅ |
| ASSET-01 | Config form edits undoable; byte changes are a barrier (undo returns `false`, no chain-skip) | integration | `vitest run src/asset/__tests__/assetUndo.uat.test.tsx` | ✅ | ✅ |
| ASSET-01 | Schema resolution: engine-supplied `.schema.jsonc` wins, else built-in fallback | unit | `vitest run src/asset/model/__tests__` | ✅ | ✅ |
| ASSET-01 | Transcode orchestration (batch, cover-old rename `{file}-origin.{ext}`, override confirm) with a fake `IAssetTranscodeService` | integration | `vitest run src/asset/__tests__/transcode.uat.test.tsx` | ✅ | ✅ |
| ASSET-01 | Picker returns selected ids; empty / loading / error states | integration | `vitest run src/asset/__tests__/assetPicker.test.tsx` | ✅ | ✅ |
| D-15 | `UndoSystem.undo()` / `redo()` return boolean; barrier stops undo | unit (editor-core) | `pnpm --filter @motajs/editor-core test` | ✅ | ✅ |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `src/asset/__tests__/fixtures.ts` — reuse `FakeFileSystem` pattern (per `editor-impl/src/table/__tests__/fixtures.ts`) with `seed()` for list + bytes
- [x] `src/asset/__tests__/assetPanel.test.tsx` — list states + category switch + save
- [x] `src/asset/__tests__/assetLifecycle.uat.test.tsx` — add / replace / delete / persist
- [x] `src/asset/__tests__/assetUndo.uat.test.tsx` — config undo + byte barrier
- [x] `src/asset/__tests__/transcode.uat.test.tsx` — fake transcoder orchestration
- [x] `src/asset/__tests__/assetPicker.test.tsx`
- [x] `src/asset/model/__tests__` — schema resolution + defaults (`@required`) merge
- [x] `src/shared/jsonc/__tests__` — moved / added `.jsonc` codec tests (mirror `tableText.test.ts`)
- [x] extend `packages/libs/editor-core/src/undo/__tests__/undoSystem.test.ts` for boolean return + barrier
- [x] A jsdom-safe canvas / WebCodecs guard test (assert entry disables gracefully when APIs absent) — `src/asset/transcode/__tests__/transcodeService.test.ts` + `audioOpus.test.ts`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Image → WebP and Audio → WebM/Opus produce real, playable output | ASSET-01 | Requires `OffscreenCanvas` / WebCodecs (browser-only; not available in jsdom) | 开发宿主 Chromium（`pnpm --filter @motajs/editor-dev dev`，打开 `http://127.0.0.1:1056`）：① 切到「图片」分类 → 点「瘦身转码」→ 勾选一张素材 → 选「转 WebP」→ 开始 → 确认产出的 `.webp` 在预览里可见、文件体积变小；② 切到「音频」分类 → 瘦身转码 → 转 WebM/Opus → 确认产出的 `.webm` 可播放、体积变小（覆盖旧文件时二次确认才动手）；③ 在缺少 WebCodecs 的浏览器里确认图片 / 音频转码入口禁用并给出提示。真实编码路径在 jsdom 无 WebCodecs，只能人工在开发宿主点一次 |

*If none: "All phase behaviors have automated verification."*

---

## Gate Sweep Record (03-17 close-out)

Run from the repository root on the plan's final tree.

| Gate | Command | Result |
|------|---------|--------|
| Dev-host asset tests | `pnpm --filter @motajs/editor-dev test -- devHostAsset` | ✅ 1 file / 4 tests passed |
| Workspace unit suite | `pnpm test` (`pnpm -r --no-bail run test`) | ⚠️ red in `@motajs/react-hooks` only — **pre-existing** lockfile pin react 19.2.3 vs react-dom 19.3.0 (both at the base commit `f49f7b5`); all other 6 test packages pass (file2x 14, h5animate 202, editor-core 94, packer 94, editor-impl 296, editor-dev 24) |
| Workspace typecheck | `pnpm typecheck` | ⚠️ red in the legacy `@motajs/editor` app only — **pre-existing** (known non-compiling since the 02.1 resource-layer refactor; `@motajs/editor-core` / `editor-impl` / `editor-dev` typecheck exit 0) |
| Workspace lint | `pnpm lint` | ⚠️ 8 prettier errors in files from earlier plans (`editor-core/src/resource/__tests__/fileIndex.test.ts`, `editor-impl/src/table/__tests__/refreshIdentity.uat.test.tsx`, `editor-impl/src/table/tablePanel.ts`, `scripts/verify/coreFsSurface.js`) — none touched by 03-17 (its own files are lint-clean) |
| Boundary gates | `node scripts/verify/coreBoundaries.js` | ✅ exit 0 |
| Boundary gates | `node scripts/verify/coreModuleState.js` | ✅ exit 0 |
| Boundary gates | `node scripts/verify/coreEngineNeutral.js` | ✅ exit 0 |
| Boundary gates | `node scripts/verify/coreImportType.js` | ✅ exit 0 |
| Boundary gates | `node scripts/verify/editorShims.js` | ✅ exit 0 |

The three red root gates are outside 03-17's file scope and were logged per the executor SCOPE BOUNDARY rule (see `deferred-items.md`); this plan neither relaxed a gate nor edited those files.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
