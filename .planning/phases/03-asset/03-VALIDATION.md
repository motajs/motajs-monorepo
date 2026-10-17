---
phase: "03"
slug: "asset"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| ASSET-01 | List a category (list file + directory scan) renders grid populated / empty / loading / error / partial | integration (jsdom, `FakeFileSystem`) | `vitest run src/asset/__tests__/assetPanel.test.tsx` | ❌ W0 | ⬜ pending |
| ASSET-01 | Add (upload) a file → new byte resource + list entry appended; unsaved until 保存 | integration | `vitest run src/asset/__tests__/assetLifecycle.uat.test.tsx` | ❌ W0 | ⬜ pending |
| ASSET-01 | Replace bytes / delete (byte + list entry) with confirm | integration | `vitest run src/asset/__tests__/assetLifecycle.uat.test.tsx` | ❌ W0 | ⬜ pending |
| ASSET-01 | Save writes list with verbatim `.jsonc` prefix; reload still shows changes | unit + integration | `vitest run src/shared/jsonc/__tests__` + lifecycle | ❌ W0 | ⬜ pending |
| ASSET-01 | Config form edits undoable; byte changes are a barrier (undo returns `false`, no chain-skip) | integration | `vitest run src/asset/__tests__/assetUndo.uat.test.tsx` | ❌ W0 | ⬜ pending |
| ASSET-01 | Schema resolution: engine-supplied `.schema.jsonc` wins, else built-in fallback | unit | `vitest run src/asset/model/__tests__` | ❌ W0 | ⬜ pending |
| ASSET-01 | Transcode orchestration (batch, cover-old rename `{file}-origin.{ext}`, override confirm) with a fake `ITranscodeService` | integration | `vitest run src/asset/__tests__/transcode.uat.test.tsx` | ❌ W0 | ⬜ pending |
| ASSET-01 | Picker returns selected ids; empty / loading / error states | integration | `vitest run src/asset/__tests__/assetPicker.test.tsx` | ❌ W0 | ⬜ pending |
| D-15 | `UndoSystem.undo()` / `redo()` return boolean; barrier stops undo | unit (editor-core) | `pnpm --filter @motajs/editor-core test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/asset/__tests__/fixtures.ts` — reuse `FakeFileSystem` pattern (per `editor-impl/src/table/__tests__/fixtures.ts`) with `seed()` for list + bytes
- [ ] `src/asset/__tests__/assetPanel.test.tsx` — list states + category switch + save
- [ ] `src/asset/__tests__/assetLifecycle.uat.test.tsx` — add / replace / delete / persist
- [ ] `src/asset/__tests__/assetUndo.uat.test.tsx` — config undo + byte barrier
- [ ] `src/asset/__tests__/transcode.uat.test.tsx` — fake transcoder orchestration
- [ ] `src/asset/__tests__/assetPicker.test.tsx`
- [ ] `src/asset/model/__tests__` — schema resolution + defaults (`@required`) merge
- [ ] `src/shared/jsonc/__tests__` — moved / added `.jsonc` codec tests (mirror `tableText.test.ts`)
- [ ] extend `packages/libs/editor-core/src/undo/__tests__/undoSystem.test.ts` for boolean return + barrier
- [ ] A jsdom-safe canvas / WebCodecs guard test (assert entry disables gracefully when APIs absent)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Image → WebP and Audio → WebM/Opus produce real, playable output | ASSET-01 | Requires `OffscreenCanvas` / WebCodecs (browser-only; not available in jsdom) | Dev host browser (Chromium): open 素材管理器 → 瘦身转码 → convert a sample image and audio → verify output plays and file shrinks; verify graceful disable message in a browser lacking WebCodecs |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
