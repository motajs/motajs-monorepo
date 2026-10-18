---
phase: 03-asset
reviewed: 2026-10-18T00:00:00Z
depth: deep
files_reviewed: 34
files_reviewed_list:
  - packages/libs/editor-core/src/undo/undoSystem.ts
  - packages/libs/editor-core/src/undo/types.ts
  - packages/libs/editor-core/src/panel/panelContext.ts
  - packages/libs/editor-core/src/panel/types.ts
  - packages/libs/editor-core/src/resource/resource.ts
  - packages/libs/editor-core/src/resource/resourceSystem.ts
  - packages/libs/editor-core/src/resource/types.ts
  - packages/libs/editor-core/src/resource/fileIndex.ts
  - packages/libs/editor-core/src/resource/contentCache.ts
  - packages/libs/editor-impl/src/shared/index.ts
  - packages/libs/editor-impl/src/shared/jsonc/index.ts
  - packages/libs/editor-impl/src/shared/jsonc/tableText.ts
  - packages/libs/editor-impl/src/shared/schemaForm/index.ts
  - packages/libs/editor-impl/src/shared/schemaForm/types.ts
  - packages/libs/editor-impl/src/shared/schemaForm/model/index.ts
  - packages/libs/editor-impl/src/shared/schemaForm/model/fieldPath.ts
  - packages/libs/editor-impl/src/shared/schemaForm/model/validation.ts
  - packages/libs/editor-impl/src/shared/schemaForm/model/traversal.ts
  - packages/libs/editor-impl/src/shared/schemaForm/components/index.ts
  - packages/libs/editor-impl/src/shared/schemaForm/components/TableGrid.tsx
  - packages/libs/editor-impl/src/shared/schemaForm/components/TableRow.tsx
  - packages/libs/editor-impl/src/shared/schemaForm/components/SchemaBanner.tsx
  - packages/libs/editor-impl/src/shared/schemaForm/components/inputs/TextareaInput.tsx
  - packages/libs/editor-impl/src/asset/assetPanel.ts
  - packages/libs/editor-impl/src/asset/assetPanelType.ts
  - packages/libs/editor-impl/src/asset/assetCapabilityProvider.tsx
  - packages/libs/editor-impl/src/asset/types.ts
  - packages/libs/editor-impl/src/asset/constants.ts
  - packages/libs/editor-impl/src/asset/index.ts
  - packages/libs/editor-impl/src/asset/model/assetPaths.ts
  - packages/libs/editor-impl/src/asset/model/assetList.ts
  - packages/libs/editor-impl/src/asset/model/assetDefaults.ts
  - packages/libs/editor-impl/src/asset/model/assetSchema.ts
  - packages/libs/editor-impl/src/asset/model/index.ts
  - packages/libs/editor-impl/src/asset/schemas/builtInSchemas.ts
  - packages/libs/editor-impl/src/asset/schemas/index.ts
  - packages/libs/editor-impl/src/asset/picker/assetPickerItems.ts
  - packages/libs/editor-impl/src/asset/components/AssetPanelView.tsx
  - packages/libs/editor-impl/src/asset/components/AssetDetail.tsx
  - packages/libs/editor-impl/src/asset/components/AssetGrid.tsx
  - packages/libs/editor-impl/src/asset/components/AssetPreview.tsx
  - packages/libs/editor-impl/src/asset/components/AssetToolbar.tsx
  - packages/libs/editor-impl/src/asset/components/AssetFileInput.tsx
  - packages/libs/editor-impl/src/asset/components/CategoryNav.tsx
  - packages/libs/editor-impl/src/asset/components/AssetConfigView.tsx
  - packages/libs/editor-impl/src/asset/components/TranscodeModal.tsx
  - packages/libs/editor-impl/src/asset/components/useAssetObjectUrl.ts
  - packages/libs/editor-impl/src/asset/transcode/browserTranscodeService.ts
  - packages/libs/editor-impl/src/asset/transcode/imageWebp.ts
  - packages/libs/editor-impl/src/asset/transcode/audioOpus.ts
  - packages/libs/editor-impl/src/asset/transcode/types.ts
  - packages/libs/editor-impl/src/asset/transcode/index.ts
  - packages/libs/editor-impl/src/react/capabilities.ts
  - packages/libs/editor-impl/src/react/types.ts
  - packages/libs/editor-impl/src/react/components/CapabilityProvider.tsx
  - packages/libs/editor-impl/src/react/components/MultiSelectModal.tsx
  - packages/libs/editor-impl/src/table/types.ts
  - packages/libs/editor-impl/src/table/index.ts
  - packages/libs/editor-impl/package.json
  - packages/apps/editor-dev/src/demo/assetDemo.ts
  - packages/apps/editor-dev/src/main.tsx
findings:
  critical: 1
  warning: 8
  info: 8
  total: 17
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-10-18
**Depth:** deep
**Files Reviewed:** 34 source files (plus supporting tests / gates used as evidence)
**Status:** issues_found

## Summary

Phase 3 adds a self-contained `asset` capability to `@motajs/editor-impl` (panel data layer, view layer, picker, per-item config form, image/audio transcode, dev-host wiring), plus contract changes to `editor-core` (undo barrier + boolean return, `requestBinary`, `moveResource`) and a relocation of the JSONC codec / schema-form engine into `src/shared/**`.

The architecture is sound and the relocation is clean: `asset` imports only `shared/**` and `react/**` (no `table`/`code`/`map`), engine-neutral terms are absent from both libs' `src`, no `import type` was introduced, every class `implements` an interface, and enums are numeric `const enum`. The security posture on the stated focus areas is mostly correct: **no `dangerouslySetInnerHTML` / `innerHTML` / `eval` anywhere**; asset names and paths are rendered as React text nodes (attributes are auto-escaped by React), so no stored-XSS sink was found; upload filenames go through `sanitizeAssetFileName` before `createResource`; config field writes go through `setByFieldPath`, whose `__proto__`/`constructor`/`prototype` guard blocks prototype pollution via schema field paths.

One **blocker** was found: the transcode "覆盖旧文件" path (which is the default and the tested happy path) deletes the just-written output when the source already carries the target extension — an unrecoverable data-loss bug. Eight warnings and eight info items follow; the most consequential warnings are the transcode capability probe being dead (unsupported browsers are not gated), silent drops of oversized uploads, replace being keyed by the uploaded filename rather than the selected entry, and a `window.document` gate bypass in the relocated schema-form engine.

> Note: `structural_findings` was not supplied for this review, so no `## Structural Findings (fallow)` section is present.

## Critical Issues

### CR-01: Transcode with "覆盖旧文件" deletes the source file when it already has the target extension

**File:** `packages/libs/editor-impl/src/asset/assetPanel.ts:984-1006` (cover branch at `989-991`); helper `packages/libs/editor-impl/src/asset/model/assetPaths.ts:96-103`

**Issue:** For an image already named `logo.webp` (or audio already `.webm`), `resolveTranscodedPath(path, '.webp')` returns the *same* path (`assetPaths.ts:100`). `transcodeEntry` then takes the `options.coverOrigin` branch (default `true`):

```ts
if (options.coverOrigin) {
  await this.context.createResource(targetPath, output); // writes content/texture/logo.webp
  await this.context.deleteResource(entry.path);         // deletes content/texture/logo.webp  ← same path
}
```

`targetPath === entry.path`, so the freshly written output is immediately deleted. The entry is still reported `ok: true` with `exists: true` and the in-memory list points at a now-missing file. The transcode modal lists **all** entries (`AssetPanelView.tsx:257` → `state.entries.map(e => e.name)`), with no filter excluding entries that already carry the target extension, so this is reachable through the normal UI: upload a `.webp`, or transcode once (`a.png → a.webp`) and reload, then transcode again. The existing UAT suite only exercises `.png → .webp` (different path), so it never hits this. This is unrecoverable data loss.

**Fix:** Short-circuit when the target equals the source (do not write-then-delete the same path), e.g.:

```ts
if (targetPath === entry.path) {
  await this.context.createResource(entry.path, output); // in-place replace
} else if (options.coverOrigin) {
  await this.context.createResource(targetPath, output);
  await this.context.deleteResource(entry.path);
} else {
  const originPath = resolveOriginPath(entry.path);
  await this.context.moveResource(entry.path, originPath);
  await this.context.createResource(targetPath, output);
  paths.add(originPath);
}
```

Additionally, filter already-target-extension entries out of the transcode candidate list (they are no-ops that can only cause damage).

## Warnings

### WR-01: "替换" is keyed by the uploaded file's name, not the selected entry's name

**File:** `packages/libs/editor-impl/src/asset/assetPanel.ts:296-298`, `539-573`; `packages/libs/editor-impl/src/asset/components/AssetDetail.tsx:73-79`

**Issue:** `AssetDetail` passes the raw picker payload up (`onReplace(upload)`), and the container calls `this.replaceAsset(upload.name, upload.bytes)`. `replaceAsset` then looks the entry up by `upload.name`. If the user picks a differently-named file (e.g. replaces `hero.png` with `hero-final.png`), `findIndex` returns `-1` and the action silently reports `素材不存在` — the replacement never happens. Replacing a file whose name differs from the entry is the normal case for "replace".

**Fix:** Replace by the currently-selected entry (e.g. `onReplace(entry.name, upload.bytes)`), or if a rename is intended, route through the existing add/delete path explicitly. Do not use `upload.name` as the lookup key.

### WR-02: Oversized uploads are silently discarded (no user feedback)

**File:** `packages/libs/editor-impl/src/asset/components/AssetFileInput.tsx:43-46`; call sites `AssetToolbar.tsx:58-67`, `AssetDetail.tsx:73-79`

**Issue:** In `handleFileChange`, a file over `ASSET_MAX_UPLOAD_BYTES` returns early and only calls `props.onReject` *if it was provided*. Neither `AssetToolbar` nor `AssetDetail` passes `onReject`, and because the guard runs before `onPick`, the panel's own `addAsset`/`replaceAsset` size checks never execute either. The result is a completely silent no-op for oversized uploads.

**Fix:** Wire `onReject` at both call sites (e.g. to a panel message), or surface the rejection through the panel directly instead of relying on an optional callback.

### WR-03: The transcode capability probe is dead — unsupported environments are not gated

**File:** `packages/libs/editor-impl/src/asset/components/AssetPanelView.tsx:195-198`; `packages/libs/editor-impl/src/asset/assetPanel.ts:610-618`; probe at `packages/libs/editor-impl/src/asset/transcode/browserTranscodeService.ts:17-22`

**Issue:** `IAssetTranscodeService.canTranscode` / `canUseImageTranscode` / `canUseAudioTranscode` are implemented and unit-tested, but nothing in the panel or view consults them. `transcodeEnabled` is derived purely from the category kind (Image/Audio). The plan/design (03-15, RESEARCH "Gate the UI on `canEncode('opus')` / `typeof OffscreenCanvas !== 'undefined'`; never silent failure") requires disabling the entry when the environment cannot encode. Today, in a browser without WebCodecs/OffscreenCanvas, the toolbar entry is enabled and every selected item fails individually at runtime.

**Fix:** On category switch, call `transcodeService.canTranscode(kind)` and feed the result into `transcodeEnabled` (and show the reason when disabled). Cache the async probe result per kind.

### WR-04: `window.document` in the relocated schema-form engine bypasses the PORT-02 global gate

**File:** `packages/libs/editor-impl/src/shared/schemaForm/components/inputs/TextareaInput.tsx:51-62` (moved here in this phase from `table/components/inputs/`)

**Issue:** `canMeasureTextareaHeight` calls `window.document.createElement('textarea')` and `window.document.body.appendChild(...)`. The `no-restricted-globals` gate (`eslint.config.js` Block A, proven by `scripts/verify/coreModuleState.js:52`) bans the bare `document` identifier, but a member access on `window` is not a `no-restricted-globals` reference, so this passes lint while still depending on the DOM — contradicting the project rule "no `document` in `editor-impl` src" (`03-PATTERNS.md:523-526`). The relocation made this a shared module imported by both `table` and `asset`, widening its reach.

**Fix:** Either explicitly allowlist this file in the gate (documenting the jsdom-probe exception) or use a DOM-free heuristic. At minimum, do not leave the bypass implicit — the gate claims a guarantee it does not actually hold here.

### WR-05: `scripts/verify/implExports.js` was not updated for the new `./shared` subpath (gate is red)

**File:** `packages/libs/editor-impl/package.json:14`; `scripts/verify/implExports.js:45`, `147`

**Issue:** Phase 03-05 added `"./shared"` to `editor-impl` exports, but `implExports.js` still asserts `EXPECTED_SUBPATHS` contains exactly seven entries (no `./shared`). Running it now fails:

```
implExports: exports 的 subpath 应为七个 [., ./code, ./table, ./map, ./asset, ./shell, ./react]，实际是
[., ./code, ./table, ./shared, ./map, ./asset, ./shell, ./react]（多出 ./shared）
```

The same script also asserts `sideEffects === false` while the manifest is `["./src/**/*.css"]`. `.planning/phases/03-asset/deferred-items.md:9-13` records these as pre-existing, but explicitly claims "the newly added `./shared` subpath is not implicated" — that claim is demonstrably false (`多出 ./shared` is one of the emitted failures). The gate is not run by CI (`.github/workflows/ci.yml` omits `implExports.js`), so the breakage is invisible.

**Fix:** Update `EXPECTED_SUBPATHS`/`SUBPATH_CONTENT` (and `sideEffects` expectation) to include `./shared`, and add `implExports.js` to the CI gate list so the subpath contract is actually enforced.

### WR-06: Preview object URLs are typed with a fixed MIME regardless of the real format

**File:** `packages/libs/editor-impl/src/asset/components/AssetPreview.tsx:17-22`

**Issue:** `previewMime` always returns `image/png` for images and `audio/mpeg` for audio. After a transcode the bytes are WebP/WebM, so the `<audio>` element receives WebM content labelled `audio/mpeg` (playback can fail in some browsers) and the `<img>` gets `image/webp` bytes labelled `image/png` (works only because `<img>` sniffs). The picker inconsistently uses `image/*` / `audio/*` (`assetPickerItems.ts:15-18`).

**Fix:** Derive the MIME from the asset extension (or use the actual byte signature / a category-provided MIME), rather than hardcoding by category kind.

### WR-07: List-file-derived names are not sanitized before path derivation

**File:** `packages/libs/editor-impl/src/asset/model/assetPaths.ts:53-64`; used unsanitized in `packages/libs/editor-impl/src/asset/assetPanel.ts:1016-1026`

**Issue:** `sanitizeAssetFileName` is applied only to *uploads*. Names read from a project's `.list.jsonc` feed straight into `resolveAssetBytePath(category, entry.name)` (`assetPaths.ts:86-88`) and from there into `requestResource` / `readBinary` / `deleteResource` / `moveResource`. A project file containing e.g. `{ "source": "../../secret" }` produces `content/texture/../../secret`. The stated architecture places traversal defense in the injected fs (`03-PATTERNS.md:521`), and the test `FakeFileSystem` rejects `..` — but any host fs that does not will happily read/delete outside the category directory. Sanitizing once at the boundary is cheap defense-in-depth.

**Fix:** Apply `sanitizeAssetFileName` (or a documented equivalent) to names read from list files before deriving paths, or reject entries with `..`/separators at `readAssetList` time.

### WR-08: Non-cover transcode can overwrite an existing `-origin` file

**File:** `packages/libs/editor-impl/src/asset/assetPanel.ts:992-998`

**Issue:** In the non-cover branch, `moveResource(entry.path, originPath)` runs without checking whether `originPath` already exists. `FileIndex.move` deletes the destination node first (`fileIndex.ts:126`), so a prior rename (e.g. an earlier `a-origin.png`) is silently clobbered.

**Fix:** Before moving, check `paths.has(originPath)` (the directory set is already available) and either fail the item or pick a unique suffix.

## Info

### IN-01: `AssetPanel.setTarget` ignores `IAssetPanelTarget.assetName`

**File:** `packages/libs/editor-impl/src/asset/assetPanel.ts:340-342`; interface `types.ts:82-87`

**Issue:** `setTarget` only applies `categoryId`; `assetName` is declared, validated by `isAssetPanelTarget` (`assetPanelType.ts:46-52`), and then dropped. Opening the panel with a target material does not select it.
**Fix:** Apply `assetName` (set `selectedName` / open config) or remove the field until implemented.

### IN-02: Transcode failure banner can render `转码失败：undefined`

**File:** `packages/libs/editor-impl/src/asset/assetPanel.ts:691`

**Issue:** `failed[0].error` is `string | undefined`; `IAssetTranscodeItemResult` allows an omitted `error`, so the message can read `转码失败：undefined`.
**Fix:** Fall back to a fixed message when `error` is undefined (also fixes `AssetPanelView.tsx:229`).

### IN-03: `mergeAssetDefaults` can set the merged object's prototype via a `__proto__` key

**File:** `packages/libs/editor-impl/src/asset/model/assetDefaults.ts:48-55`, `28-36`

**Issue:** `Object.keys(defaults)` includes `__proto__` when a `defaults` JSON file declares it (JSON.parse creates an own property; `Object.keys` surfaces it), and `result[key] = deepCopyValue(...)` then invokes the `__proto__` setter. This only reparents the fresh `result`/`copy` object — it is **not** global `Object.prototype` pollution (writes to a newly created object), and config-path writes are separately guarded by `setByFieldPath` (`fieldPath.ts:12-14`, `84-85`). Still worth `key !== '__proto__'` (or `Object.create(null)`) for clarity.
**Fix:** Skip `__proto__`/`constructor`/`prototype` keys in `mergeAssetDefaults`/`deepCopyValue`.

### IN-04: `writeObjectList` is a silent no-op when an ObjectList category lacks `listKey`

**File:** `packages/libs/editor-impl/src/asset/model/assetList.ts:107-119`

**Issue:** `if (listKey !== undefined) base[listKey] = ...` else the base is returned unchanged, so a misconfigured ObjectList category writes an empty/unchanged document instead of failing (read-side `readObjectList` throws, so the mismatch is only latent on write).
**Fix:** Throw a clear error when `listFormat === ObjectList` and `listKey` is missing.

### IN-05: Empty interface `IBrowserAssetTranscodeService extends IAssetTranscodeService {}`

**File:** `packages/libs/editor-impl/src/asset/transcode/browserTranscodeService.ts:9`

**Issue:** The interface adds no members; `class BrowserAssetTranscodeService implements IBrowserAssetTranscodeService` could `implements IAssetTranscodeService` directly. Triggers the repo-level `no-empty-object-type` warning class.
**Fix:** Drop the redundant interface or give it the browser-specific members it is meant to document.

### IN-06: `save()` persists every category, not the current one

**File:** `packages/libs/editor-impl/src/asset/assetPanel.ts:451-465`

**Issue:** The per-panel "保存" button iterates over all category states. Harmless but surprising (one button writes categories the user is not looking at); the success message at `1128-1130` only reflects the current category.
**Fix:** Either scope the button to the current category or label it as a global save.

### IN-07: Preview picker MIME constants diverge from the panel preview MIME

**File:** `packages/libs/editor-impl/src/asset/picker/assetPickerItems.ts:15-18` vs `components/AssetPreview.tsx:17-22`

**Issue:** The picker uses `image/*` / `audio/*`; the panel uses `image/png` / `audio/mpeg`. Two sources of truth for the same concern (see WR-06).
**Fix:** Centralize MIME resolution in one model helper used by both.

### IN-08: Stale comment in the transcode service test

**File:** `packages/libs/editor-impl/src/asset/transcode/__tests__/transcodeService.test.ts:27`

**Issue:** The comment "覆盖音频转码在接入真实实现之前始终不可用" is no longer accurate — audio transcode is now implemented (`audioOpus.ts`) and only fails in jsdom because `canEncode('opus')` is false. The assertion still passes, so the misleading comment can mask a future real regression.
**Fix:** Update the comment to describe the jsdom/no-WebCodecs condition.

## What was checked and found clean

- **XSS / injection:** No `dangerouslySetInnerHTML`, `innerHTML`, `eval`, or `new Function` anywhere in `asset`/`shared`. Asset names and paths are rendered as React children (`AssetGrid.tsx:52`, `AssetDetail.tsx:56-59`, `TranscodeModal.tsx:128-130`, `MultiSelectModal.tsx:82-84`); media previews use `URL.createObjectURL(new Blob([...], { type }))` in `<img>`/`<audio>`, which do not execute scripts. No stored-XSS sink found.
- **Prototype pollution via config field paths:** `setByFieldPath` rejects `__proto__`/`constructor`/`prototype` at every level (`fieldPath.ts:5`, `84-85`, `109`, `161`). Confirmed the undo path also routes through it (`assetPanel.ts:1096`).
- **Path traversal on upload:** `sanitizeAssetFileName` rejects separators, `..`, leading dots, control characters, Windows-illegal characters, and over-length names before `createResource` (`assetPaths.ts:53-64`).
- **Boundaries:** `asset` imports only `shared/**` and `react/**`; `react/types.ts` imports `shared/schemaForm/types` (types only, no cycle with `shared` components which import `../../../react`). No engine-term literals in either lib's `src`. No `import type` introduced. Classes `implements` interfaces.
- **Undo barrier semantics:** `undo()` returns `false` and fires `onUndoBlocked` without popping when the top entry is a barrier; barrier entries never enter the redo stack (`undoSystem.ts:40-67`), and the dedicated tests pin both the blocked-undo and redo behavior.

---

_Reviewed: 2026-10-18_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_
