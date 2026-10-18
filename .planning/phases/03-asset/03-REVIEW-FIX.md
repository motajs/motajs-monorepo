---
phase: 03-asset
fixed_at: 2026-10-18
review_path: .planning/phases/03-asset/03-REVIEW.md
iteration: 1
findings_in_scope: 17
fixed: 16
skipped: 1
status: partial
---

# Phase 3: Code Review Fix Report

**Fixed at:** 2026-10-18
**Source review:** `.planning/phases/03-asset/03-REVIEW.md`
**Iteration:** 1
**Scope:** CR-01 plus all eight warnings and the eight info items the operator placed in
scope (the two pre-existing reds — react-hooks lockfile mismatch and the legacy
`@motajs/editor` typecheck — were explicitly out of scope).

**Summary:**

- Findings in scope: 17
- Fixed: 16
- Skipped: 1

**Isolation note.** Fixes were applied and committed **in the main checkout**, not in a
throw-away worktree. Although `workflow.use_worktrees` is unset (default `true`), the
worktree path the protocol assumes (`.claude/worktrees/...` gitignored) does not hold here:
`.gitignore` has no `.claude/` rule, and the worktree would have no workspace `node_modules`
to run the required gates. Commits land directly on `editor/core-extract`; the net effect is
identical to the protocol's fast-forward tail.

## Fixed Issues

### CR-01: Transcode with "覆盖旧文件" deletes the source file when it already has the target extension

**Files modified:** `packages/libs/editor-impl/src/asset/assetPanel.ts`, `packages/libs/editor-impl/src/asset/components/AssetPanelView.tsx`, `packages/libs/editor-impl/src/asset/__tests__/transcode.uat.test.tsx`
**Commit:** `c7cd933`
**Applied fix:** `transcodeEntry` now short-circuits when the resolved target path equals the source path and overwrites in place — it never writes the output and then deletes the same path. The transcode candidate list additionally filters out entries that already carry the target extension. Regression tests ⑧/⑨ in `transcode.uat.test.tsx` cover both `coverOrigin: true` and `coverOrigin: false` for a source that already is `.webp`.

### WR-01: "替换" is keyed by the uploaded file's name, not the selected entry

**Files modified:** `packages/libs/editor-impl/src/asset/assetPanel.ts`
**Commit:** `a828e99`
**Applied fix:** the container's `onReplace` now looks up the currently selected entry (`this.store.state.selectedName`) and calls `replaceAsset(name, bytes)`, so replacing `hero.png` with `hero-final.png` hits `hero` instead of reporting 「素材不存在」.

### WR-02: Oversized uploads are silently discarded

**Files modified:** `packages/libs/editor-impl/src/asset/assetPanel.ts`, `packages/libs/editor-impl/src/asset/components/AssetPanelView.tsx`, `packages/libs/editor-impl/src/asset/components/AssetToolbar.tsx`, `packages/libs/editor-impl/src/asset/components/AssetDetail.tsx`
**Commit:** `a828e99`
**Applied fix:** a new `onReject(reason)` callback is threaded from the panel through the view into both `AssetFileInput` call sites; a too-large file now publishes its reason as the panel notice instead of a silent no-op.

### WR-03: The transcode capability probe is dead

**Files modified:** `packages/libs/editor-impl/src/asset/types.ts`, `packages/libs/editor-impl/src/asset/assetPanel.ts`, `packages/libs/editor-impl/src/asset/components/AssetPanelView.tsx`, `packages/libs/editor-impl/src/asset/__tests__/assetView.test.tsx`
**Commit:** `80baef2`
**Applied fix:** `IAssetPanelViewState` gains `transcodeCapable`; `AssetPanel.refreshTranscodeCapability` probes `transcodeService.canTranscode` on every category switch (result cached per kind) and publishes it. The toolbar entry is now disabled unless the probe succeeds, and an `asset-transcode-notice` explains why (「当前环境不支持图片转码」/「…音频转码」). View tests cover capable/incapable image categories.

### WR-04: `window.document` in the relocated schema-form engine bypasses the PORT-02 global gate

**Files modified:** `packages/libs/editor-impl/src/shared/schemaForm/components/inputs/TextareaInput.tsx`
**Commit:** `379a059`
**Applied fix:** the throw-away `window.document.createElement('textarea')` probe is replaced by measuring the **mounted** antd textarea through a ref (`useLayoutEffect` + `textAreaRef.current?.resizableTextArea?.textArea.scrollHeight`). No `document` dependency remains; `autoSize` is enabled only when `scrollHeight > 0`, preserving the jsdom behaviour.

### WR-05: `scripts/verify/implExports.js` was not updated for `./shared`

**Files modified:** `scripts/verify/implExports.js`, `.planning/phases/03-asset/deferred-items.md`
**Commit:** `94b02d5`
**Applied fix:** `EXPECTED_SUBPATHS` / `SUBPATH_CONTENT` now include `./shared`; the `sideEffects` assertion expects the intentional `["./src/**/*.css"]`. The gate no longer reports `./shared` or `sideEffects`. `deferred-items.md`'s false claim ("the newly added `./shared` subpath is not implicated") is corrected.

### WR-06 / IN-07: Preview MIME hardcoded and duplicated

**Files modified:** `packages/libs/editor-impl/src/asset/model/assetMime.ts` (new), `packages/libs/editor-impl/src/asset/model/index.ts`, `packages/libs/editor-impl/src/asset/components/AssetPreview.tsx`, `packages/libs/editor-impl/src/asset/components/AssetDetail.tsx`, `packages/libs/editor-impl/src/asset/picker/assetPickerItems.ts`
**Commit:** `4078530`
**Applied fix:** a single `resolveAssetMime(path, kind)` derives the MIME from the real extension (`.webp`, `.webm`, …) with a per-kind fallback. Both the preview (`AssetPreview`, now taking the asset `path`) and the picker use it; the `image/*` / `audio/*` picker constants are gone.

### WR-07: List-file-derived names are not sanitized before path derivation

**Files modified:** `packages/libs/editor-impl/src/asset/model/assetList.ts`, `packages/libs/editor-impl/src/asset/model/__tests__/assetList.test.ts`
**Commit:** `db50623`
**Applied fix:** `readAssetList` runs every name (string-list element or `source` field) through `sanitizeAssetFileName` and drops anything that fails (separators, `..`, illegal chars). A test covers `../../secret` and `a/b.png`.

### WR-08: Non-cover transcode can overwrite an existing `-origin` file

**Files modified:** `packages/libs/editor-impl/src/asset/assetPanel.ts`, `packages/libs/editor-impl/src/asset/__tests__/transcode.uat.test.tsx`
**Commit:** `7451c1b`
**Applied fix:** before `moveResource`, the non-cover branch checks `paths.has(originPath)` and fails the item with 「保留文件已存在」 instead of clobbering the backup. Test ⑩ covers it.

### IN-01: `AssetPanel.setTarget` ignores `assetName`

**Files modified:** `packages/libs/editor-impl/src/asset/assetPanel.ts`
**Commit:** `8e63cb8`
**Applied fix:** `setTarget` now also applies `target.assetName` to `selectedName`.

### IN-02: Transcode failure banner can render `转码失败：undefined`

**Files modified:** `packages/libs/editor-impl/src/asset/transcode/types.ts`, `packages/libs/editor-impl/src/asset/assetPanel.ts`, `packages/libs/editor-impl/src/asset/components/AssetPanelView.tsx`
**Commit:** `fe9ce8e` (formatting follow-up `3a247f3`)
**Applied fix:** new `ASSET_TRANSCODE_UNKNOWN_ERROR` fallback used by both the panel message and the summary list.

### IN-03: `mergeAssetDefaults` can reparent via a `__proto__` key

**Files modified:** `packages/libs/editor-impl/src/asset/model/assetDefaults.ts`, `packages/libs/editor-impl/src/asset/model/__tests__/assetConfig.test.ts`
**Commit:** `8fcf269`
**Applied fix:** `mergeAssetDefaults`, `deepCopyValue`, and `collectRequiredPaths` skip `__proto__` / `constructor` / `prototype`. A test asserts the merged object's prototype is untouched.

### IN-04: `writeObjectList` is a silent no-op when an ObjectList category lacks `listKey`

**Files modified:** `packages/libs/editor-impl/src/asset/model/assetList.ts`, `packages/libs/editor-impl/src/asset/model/__tests__/assetList.test.ts`
**Commit:** `823f81c`
**Applied fix:** `writeObjectList` now throws 「素材列表缺少容器键定义」 when `listKey` is missing.

### IN-05: Empty interface `IBrowserAssetTranscodeService`

**Files modified:** `packages/libs/editor-impl/src/asset/transcode/browserTranscodeService.ts`
**Commit:** `9920951`
**Applied fix:** the empty interface was removed; `BrowserAssetTranscodeService implements IAssetTranscodeService` directly.

### IN-08: Stale comment in the transcode service test

**Files modified:** `packages/libs/editor-impl/src/asset/transcode/__tests__/transcodeService.test.ts`
**Commit:** `02de062`
**Applied fix:** the comment now describes the jsdom / no-WebCodecs condition (`canEncode('opus') === false`) instead of "before a real implementation exists".

## Skipped Issues

### IN-06: `save()` persists every category, not the current one

**File:** `packages/libs/editor-impl/src/asset/assetPanel.ts:451-465`
**Reason:** not "trivial and clearly correct" — scoping the button to the current category would change behaviour (categories the user never views would never save), and relabelling it as a global save contradicts the UI-SPEC `保存` copy. Left as-is by operator judgement.
**Original issue:** the per-panel 「保存」 button iterates over all category states; the success message only reflects the current category.

---

_Fixed: 2026-10-18_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_
